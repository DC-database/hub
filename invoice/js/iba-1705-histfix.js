/* ==========================================================================
   js/iba-1705-histfix.js — 17.0.5 patch 63
   Fixing mistakes in the INVOICE history, everywhere in the system.
   1) Quick correction: when someone changes an invoice status and, within
      15 minutes, the SAME person changes it again to another status, a
      pop-up asks "Was this a correction?". Yes = the wrong line is removed
      (the new line remembers what it replaced). No = both lines stay.
      Works for every screen because it watches every new line written to
      invoice_entries/<PO>/<key>/history (one tiny read of the last 3 lines).
      Lines with an ESN (approvals), Urgent lines and other special lines
      are never touched.
   2) Super Admin: a small trash button on each line of the Invoice Status
      History window, to remove a wrong line later ("Are you sure?" first).
   ========================================================================== */
(function () {
    'use strict';

    const WINDOW_MS = 15 * 60 * 1000;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s || '').trim().toLowerCase();
    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name) : ''; } catch (_) { return ''; } }
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function toast(msg, tone) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg, tone || 'success'); } catch (_) {} }

    // a plain status line (not an approval with ESN, not Urgent / special lines)
    function plain(h) {
        if (!h || typeof h !== 'object' || !h.status) return false;
        if (h.esn || h.kind || h.pdfLink) return false;
        if (h.action && norm(h.action) !== norm(h.status)) return false;
        return true;
    }
    const whoOf = (h) => String((h && (h.updatedBy || h.by)) || '');

    // ---- pop-up (same glass box as the other IBA pop-ups) -----------------
    function ask(o) {
        return new Promise((done) => {
            const old = document.getElementById('iba-hf-pop');
            if (old) old.remove();
            const w = document.createElement('div');
            w.id = 'iba-hf-pop';
            w.className = 'iba-pb-layer';
            w.innerHTML = '<div class="iba-pb-box" role="alertdialog" aria-modal="true" aria-labelledby="iba-hf-t" style="width:min(520px,100%)">' +
                '<div class="iba-pb-head"><b id="iba-hf-t"><i class="fa-solid ' + (o.icon || 'fa-clock-rotate-left') + '"></i> ' + esc(o.title) + '</b></div>' +
                '<div class="iba-pb-sub">' + o.html + '</div>' +
                '<div class="iba-pb-foot"><span></span><button type="button" data-no>' + esc(o.no) + '</button>' +
                '<button type="button" data-yes class="is-main"' + (o.danger ? ' style="background:rgba(220,53,69,.6) !important;border-color:rgba(255,107,107,.85) !important;color:#fff !important"' : '') + '>' + esc(o.yes) + '</button></div></div>';
            document.body.appendChild(w);
            const end = (v) => { w.remove(); done(v); };
            w.addEventListener('click', (e) => {
                if (e.target === w) return end(false);
                const b = e.target.closest('button');
                if (b) end(b.hasAttribute('data-yes'));
            });
            w.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); end(false); } });
            setTimeout(() => { const n = w.querySelector('[data-no]'); if (n) n.focus(); }, 0); // Enter never confirms by mistake
        });
    }

    // ---- 1) quick correction ---------------------------------------------
    let queue = [];
    let timer = 0;
    async function check(po, key, newKey, val) {
        const d = idb();
        const name = me();
        if (!d || !name || !plain(val) || whoOf(val) !== name) return;
        let snap;
        try { snap = await d.ref('invoice_entries/' + po + '/' + key + '/history').orderByKey().endAt(newKey).limitToLast(2).once('value'); } catch (_) { return; }
        const rows = [];
        try { snap.forEach((c) => { rows.push({ k: c.key, v: c.val() }); }); } catch (_) { return; }
        if (rows.length < 2 || rows[1].k !== newKey) return;
        const prev = rows[0];
        if (!plain(prev.v) || whoOf(prev.v) !== name) return;
        if (norm(prev.v.status) === norm(val.status)) return;
        const gap = (Number(val.timestamp) || Date.now()) - (Number(prev.v.timestamp) || 0);
        if (!(gap >= 0 && gap <= WINDOW_MS)) return;
        queue.push({ po: po, key: key, prevKey: prev.k, prev: prev.v, newKey: newKey, val: val });
        clearTimeout(timer);
        timer = setTimeout(offer, 900); // a Batch save writes many lines: one pop-up for all
    }
    function invNo(it) {
        try { const r = allInvoiceData && allInvoiceData[it.po] && allInvoiceData[it.po][it.key]; if (r && r.invNumber) return r.invNumber; } catch (_) {}
        return '';
    }
    async function offer() {
        const list = queue;
        queue = [];
        if (!list.length) return;
        const rows = list.slice(0, 12).map((it) => '<li><b>PO ' + esc(it.po) + '</b>' + (invNo(it) ? ' · ' + esc(invNo(it)) : '') + ': <s>' + esc(it.prev.status) + '</s> → <b>' + esc(it.val.status) + '</b></li>').join('') +
            (list.length > 12 ? '<li>+' + (list.length - 12) + ' more</li>' : '');
        const yes = await ask({
            title: 'Was this a correction?',
            html: '<p>You changed ' + (list.length === 1 ? 'this status' : 'these statuses') + ' again within a few minutes:</p><ul class="iba-hf-list">' + rows + '</ul>' +
                '<p><b>Yes, it was a mistake</b>: the wrong status is removed from the history.<br><b>No</b>: both stay as two real steps.</p>',
            yes: 'Yes, it was a mistake', no: 'No, keep both'
        });
        if (!yes) return;
        const d = idb();
        let ok = 0;
        for (const it of list) {
            try {
                const base = 'invoice_entries/' + it.po + '/' + it.key + '/history/';
                const upd = { correctedFrom: String(it.prev.status || ''), correctedAt: Date.now() };
                // keep "Initial Entry" on the line that stays
                if (/^initial entry/i.test(String(it.prev.note || '')) && !/^initial entry/i.test(String(it.val.note || ''))) upd.note = String(it.prev.note);
                await d.ref(base + it.newKey).update(upd);
                await d.ref(base + it.prevKey).remove();
                ok++;
            } catch (e) { console.warn('[IBA history] correction not saved', e); }
        }
        toast(ok === list.length ? 'History corrected.' : ('History corrected for ' + ok + ' of ' + list.length + '.'), ok === list.length ? 'success' : 'warning');
    }

    function hook() {
        try {
            const R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaHistFix) return;
            const proto = R.prototype;
            const orig = proto.push;
            let rootUrl = '';
            const pathOf = (ref) => {
                const d = idb();
                if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    const s = ref.toString();
                    if (s.indexOf(rootUrl + '/invoice_entries/') !== 0) return null;
                    return s.slice(rootUrl.length + 1).split('/').map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            proto.push = function (value) {
                const res = orig.apply(this, arguments);
                try {
                    const parts = arguments.length ? pathOf(this) : null;
                    if (parts && parts.length === 4 && parts[3] === 'history' && plain(value) && res && res.key) {
                        const po = parts[1], key = parts[2], newKey = res.key, val = value;
                        Promise.resolve(res).then(() => check(po, key, newKey, val)).catch(() => {});
                    }
                } catch (_) {}
                return res;
            };
            proto.__ibaHistFix = true;
        } catch (e) { console.warn('[IBA history] hook not set:', e); }
    }
    hook();

    // ---- 2) Super Admin: remove a line in the history window --------------
    let shown = null; // { po, key }
    function fmt(ts) { try { if (typeof ibaHistoryFormatTime === 'function') return ibaHistoryFormatTime(ts); } catch (_) {} return ''; }
    async function addTrash(po, key) {
        if (!isSuper()) return;
        const d = idb();
        const tbody = document.getElementById('history-table-body');
        if (!d || !tbody) return;
        let snap;
        try { snap = await d.ref('invoice_entries/' + po + '/' + key + '/history').once('value'); } catch (_) { return; }
        const lines = [];
        snap.forEach((c) => { const v = c.val() || {}; lines.push({ k: c.key, label: norm(v.action || v.status || 'Status Updated'), time: fmt(v.timestamp), used: false }); });
        tbody.querySelectorAll('tr.history-row').forEach((tr) => {
            if (tr.querySelector('[data-hf-del]')) return;
            const pill = tr.querySelector('.history-status-pill');
            const date = tr.querySelector('.history-date-chip');
            if (!pill || !date) return;
            const label = norm(pill.textContent), time = String(date.textContent || '').trim();
            const hit = lines.find((l) => !l.used && l.label === label && l.time === time);
            if (!hit) return; // e.g. the "current status" line that is not saved in the history
            hit.used = true;
            const cell = tr.querySelector('.history-status-cell') || tr.cells[0];
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-hf-del';
            b.setAttribute('data-hf-del', hit.k);
            b.title = 'Remove this line (wrong status)';
            b.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            if (pill.parentNode === cell) pill.insertAdjacentElement('afterend', b); else cell.appendChild(b);
        });
    }
    document.addEventListener('click', async (e) => {
        const b = e.target.closest && e.target.closest('[data-hf-del]');
        if (!b || !shown || !isSuper()) return;
        e.preventDefault();
        e.stopPropagation();
        const tr = b.closest('tr');
        const st = tr && tr.querySelector('.history-status-pill') ? tr.querySelector('.history-status-pill').textContent.trim() : 'this line';
        const tm = tr && tr.querySelector('.history-date-chip') ? tr.querySelector('.history-date-chip').textContent.trim() : '';
        const yes = await ask({
            title: 'Remove this history line?', icon: 'fa-trash-can', danger: true,
            html: '<p>Remove <b>' + esc(st) + '</b>' + (tm ? ' (' + esc(tm) + ')' : '') + ' from the history of PO ' + esc(shown.po) + '?</p><p>Only the history line is removed. The invoice status itself does not change.</p>',
            yes: 'Remove', no: 'Cancel'
        });
        if (!yes) return;
        const d = idb();
        const { po, key } = shown;
        try {
            await d.ref('invoice_entries/' + po + '/' + key + '/history/' + b.getAttribute('data-hf-del')).remove();
            toast('History line removed.');
            if (typeof window.showInvoiceHistory === 'function') window.showInvoiceHistory(po, key);
        } catch (err) { toast('Could not remove: ' + ((err && err.message) || err), 'error'); }
    }, true);

    function wrapShow() {
        const orig = window.showInvoiceHistory;
        if (typeof orig !== 'function' || orig.__ibaHistFix) return !!(orig && orig.__ibaHistFix);
        const w = async function (po, key) {
            shown = { po: po, key: key };
            const r = await orig.apply(this, arguments);
            try { await addTrash(po, key); } catch (_) {}
            return r;
        };
        w.__ibaHistFix = true;
        window.showInvoiceHistory = w;
        return true;
    }
    if (!wrapShow()) document.addEventListener('DOMContentLoaded', wrapShow);
    window.ibaHistFix = { check: check, WINDOW_MS: WINDOW_MS };
})();
