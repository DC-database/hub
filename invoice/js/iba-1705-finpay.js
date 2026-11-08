/* 17.0.5 patch 101: Finance link (read only). Accounts fill cheque + Date Paid in the
 * Finance app (payment-report db, path payments, indexed on poNo). Finance combines
 * payments, the invoice app splits per invoice, so we match on the PO only and show
 * it as a HINT; a person still marks Paid.
 * See: Super Admin, Admin Finance/Accounts/Accounting, Admin CEO/COO/Manager/Engineer.
 * Use (Month to Payments "Finance" column + paid date): people who can open Payments.
 * One small indexed read per PO, kept for the session. Never writes to Finance. */
(function () {
    'use strict';
    var cache = {}; // po -> Promise<[payments]>
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || {}; } catch (_) { return {}; } }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
    function isSuper() { try { return typeof paymentIsSuperAdmin === 'function' && paymentIsSuperAdmin(); } catch (_) { return false; } }
    function canUse() { try { return typeof canCurrentUserAccessPayments === 'function' && canCurrentUserAccessPayments(); } catch (_) { return false; } }
    function canSee() {
        if (isSuper() || canUse()) return true;
        var u = me();
        if (norm(u.Role || u.role) !== 'admin') return false;
        var pos = norm(u.Position || u.position);
        return /\b(ceo|coo|manager|engineer|eng)\b/.test(pos);
    }
    function db() { try { return typeof paymentDb !== 'undefined' ? paymentDb : null; } catch (_) { return null; } }
    function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
    // 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY' or anything Date can read -> 'YYYY-MM-DD'
    function isoOf(v) {
        var s = String(v == null ? '' : v).trim(); if (!s) return '';
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
        m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
        if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
        var t = Date.parse(s); if (isNaN(t)) return '';
        var d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function show(iso) { try { return typeof paymentDisplayDate === 'function' ? paymentDisplayDate(iso) : iso; } catch (_) { return iso; } }
    async function read(po) {
        var d = db(); if (!d || !po) return [];
        var out = [];
        var tryOne = async function (val) {
            var snap = await d.ref('payments').orderByChild('poNo').equalTo(val).once('value');
            snap.forEach(function (c) { var v = c.val() || {}; out.push({ id: c.key, pvn: String(v.paymentNo || '').replace(/^PVN-/i, ''), cheque: v.chequeNo || '', amount: num(v.payment), certified: num(v.certifiedAmount), retention: num(v.retention), poValue: num(v.poValue), datePaid: isoOf(v.datePaid), note: v.note || '' }); });
        };
        await tryOne(String(po));
        if (!out.length && /^\d+$/.test(String(po))) await tryOne(Number(po));
        out.sort(function (a, b) { return (a.datePaid || '9').localeCompare(b.datePaid || '9'); });
        return out;
    }
    function forPo(po) {
        po = String(po || '').trim().toUpperCase();
        if (!po) return Promise.resolve([]);
        if (!cache[po]) cache[po] = read(po).catch(function (e) { delete cache[po]; throw e; });
        return cache[po];
    }
    // first Finance payment WITH a Date Paid on/after the With Accounts date
    function match(list, sinceIso) {
        var s = isoOf(sinceIso);
        for (var i = 0; i < list.length; i++) { var p = list[i]; if (p.datePaid && (!s || p.datePaid >= s)) return p; }
        return null;
    }
    function boxHtml(list, sinceIso) {
        var hit = match(list, sinceIso);
        var head = '<span class="iba-trk-lbl">FINANCE</span>';
        if (!list.length) return head + '<p class="iba-fin-none">No payment in Finance for this PO yet.</p>';
        return head + (hit ? '<p class="iba-fin-hit"><i class="fa-solid fa-circle-check"></i> Possible payment: paid <b>' + esc(show(hit.datePaid)) + '</b>' + (hit.cheque ? ' · cheque <b>' + esc(hit.cheque) + '</b>' : '') + '</p>' : '<p class="iba-fin-none">No Finance payment dated after it reached Accounts yet.</p>') +
            '<ul class="iba-fin-list">' + list.slice(-6).reverse().map(function (p) {
                return '<li><span>' + (p.pvn ? 'PVN ' + esc(p.pvn) : 'Payment') + (p.cheque ? ' · Chq ' + esc(p.cheque) : '') + '</span><b>' + esc(p.amount ? p.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—') + '</b><em>' + esc(p.datePaid ? show(p.datePaid) : 'not paid') + '</em></li>';
            }).join('') + '</ul><p class="iba-fin-foot">Finance pays per PO (can be several invoices together), so check before marking Paid.</p>';
    }
    // receipt / phone detail placeholder: <div class="iba-fin-box" data-fin-po data-fin-since>
    function placeholder(po, sinceText) {
        if (!canSee() || !po) return '';
        return '<div class="iba-fin-box" data-fin-po="' + esc(po) + '" data-fin-since="' + esc(isoOf(sinceText)) + '"><span class="iba-trk-lbl">FINANCE</span><p class="iba-fin-none"><i class="fa-solid fa-spinner fa-spin"></i> Checking Finance…</p></div>';
    }
    function fill(root) {
        (root || document).querySelectorAll('.iba-fin-box[data-fin-po]:not([data-fin-done])').forEach(function (el) {
            el.setAttribute('data-fin-done', '1');
            forPo(el.getAttribute('data-fin-po')).then(function (list) { if (el.isConnected) el.innerHTML = boxHtml(list, el.getAttribute('data-fin-since')); });
        });
    }
    // 17.0.5 p102: PO-level mini Finance sheet (button on the PO card, loads on press)
    function m2(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function btnHtml(po, poVal) {
        if (!canSee() || !po) return '';
        // 17.0.5 patch 167: starts hidden; shown only when Finance has a record for this PO
        return '<button type="button" class="iba-fin-btn" data-fin-check style="display:none !important" data-fin-open="' + esc(po) + '" data-fin-poval="' + esc(poVal || '') + '" aria-expanded="false"><i class="fa-solid fa-building-columns"></i> Finance</button>';
    }
    function sheetHtml(po, list, poValText) {
        var top = '<div class="iba-fin-sh-head"><span class="iba-trk-lbl">FINANCE · PO ' + esc(po) + '</span></div>';
        var pv = 0;
        list.forEach(function (p) { if (!pv && p.poValue) pv = p.poValue; });
        if (!pv) pv = num(poValText);
        if (!list.length) return top + '<p class="iba-fin-none">No record in Finance for PO ' + esc(po) + ' yet.' + (pv ? ' PO value ' + m2(pv) + '.' : '') + '</p>';
        var cert = 0, ret = 0, pay = 0, paid = 0;
        list.forEach(function (p) { cert += p.certified; ret += p.retention; pay += p.amount; if (p.datePaid) paid += p.amount; });
        var tiles = [['PO value', pv ? m2(pv) : '—'], ['Certified', m2(cert)], ['Paid', m2(paid), 'is-ok'], ['Retention held', m2(ret)],
            ['Certified, not paid yet', m2(pay - paid), pay - paid > 0.005 ? 'is-warn' : ''], ['Balance left on PO', pv ? m2(pv - cert) : '—']];
        var rows = list.slice().sort(function (a, b) { return (b.datePaid || '9999').localeCompare(a.datePaid || '9999') || (Number(b.pvn) || 0) - (Number(a.pvn) || 0); });
        return top + '<div class="iba-fin-tiles">' + tiles.map(function (t) { return '<div class="' + (t[2] || '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b></div>'; }).join('') + '</div>' +
            '<div class="iba-fin-tbl"><table><thead><tr><th>PVN</th><th>Cheque</th><th class="is-n">Certified</th><th class="is-n">Retention</th><th class="is-n">Payment</th><th>Date paid</th></tr></thead><tbody>' +
            rows.map(function (p) {
                return '<tr><td>' + esc(p.pvn || '—') + '</td><td>' + esc(p.cheque || '—') + '</td><td class="is-n">' + m2(p.certified) + '</td><td class="is-n">' + m2(p.retention) + '</td><td class="is-n">' + m2(p.amount) + '</td><td>' + (p.datePaid ? esc(show(p.datePaid)) : '<em>not paid</em>') + '</td></tr>';
            }).join('') + '</tbody></table></div>' + (rows.some(function (p) { return p.note; }) ? '<p class="iba-fin-foot">' + esc(rows.filter(function (p) { return p.note; }).map(function (p) { return p.note; }).slice(0, 3).join(' · ')) + '</p>' : '');
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-fin-open]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        var host = b.closest('.iba-trk-pc-wrap, .iba-trk-pm, .iba-trk-r-po, .iba-trk-pohead') || b.parentNode;
        var sh = host.parentNode && host.parentNode.querySelector(':scope > .iba-fin-sheet[data-fin-for="' + b.getAttribute('data-fin-open') + '"]');
        if (sh) { var open = sh.hidden; sh.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false'); return; }
        sh = document.createElement('div');
        sh.className = 'iba-fin-sheet';
        sh.setAttribute('data-fin-for', b.getAttribute('data-fin-open'));
        sh.innerHTML = '<p class="iba-fin-none"><i class="fa-solid fa-spinner fa-spin"></i> Checking Finance…</p>';
        host.parentNode.insertBefore(sh, host.nextSibling);
        b.setAttribute('aria-expanded', 'true');
        var po = b.getAttribute('data-fin-open'), pv = b.getAttribute('data-fin-poval');
        var go = function () {
            forPo(po).then(function (list) { sh.innerHTML = sheetHtml(po, list, pv); })
                .catch(function () { sh.innerHTML = '<p class="iba-fin-none">Couldn\'t reach Finance. <button type="button" class="iba-trk-btn" data-fin-retry>Try again</button></p>'; var r = sh.querySelector('[data-fin-retry]'); if (r) r.addEventListener('click', function (ev) { ev.stopPropagation(); sh.innerHTML = '<p class="iba-fin-none"><i class="fa-solid fa-spinner fa-spin"></i> Checking Finance…</p>'; go(); }); });
        };
        go();
    }, true);
    // 17.0.5 patch 167: no Finance record for the PO -> no Finance button (people clicked it and found nothing)
    var ckT = null;
    function checkBtns() {
        ckT = null;
        document.querySelectorAll('button[data-fin-check]:not([data-fin-checked])').forEach(function (b) {
            b.setAttribute('data-fin-checked', '1');
            forPo(b.getAttribute('data-fin-open')).then(function (list) {
                if (list && list.length) b.style.removeProperty('display');
            }, function () { b.style.removeProperty('display'); });
        });
    }
    try {
        new MutationObserver(function () { if (!ckT) ckT = setTimeout(checkBtns, 150); })
            .observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    window.ibaFinPay = { btnHtml: btnHtml, sheetHtml: sheetHtml, canSee: canSee, canUse: canUse, forPo: forPo, match: match, placeholder: placeholder, isoOf: isoOf, fill: fill };
})();
