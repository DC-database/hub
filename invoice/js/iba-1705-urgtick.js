/* ==========================================================================
   js/iba-1705-urgtick.js — 17.0.5 patch 150
   ⚡ Urgent tick (martin). Urgent is a FLAG on the invoice, not a word in the
   Note: urgent:true + urgentBy + urgentAt. It only counts while the invoice
   is "For Approval" (the urgent thing is the approval). When the status moves
   on (Approved, Rejected, anything else) the flag is cleared in the same
   save. Unticking removes it at once. The Note stays as the person typed it.
   - Invoice Entry: "⚡ Urgent" under Status, beside "Tell me when they act".
   - Batch Entry: a ⚡ button on each card and "Urgent for all".
   Readers (approvals Urgent tab, phone, assistant) use window.ibaIsUrgent(x):
   flag + For Approval, or the old "urgent" word in the Note (older invoices).
   Who may untick an invoice already saved as urgent: the person who marked
   it, or the Super Admin.
   ========================================================================== */
(function () {
    'use strict';

    var WORD = /\burgent/i;
    var FOR_APPROVAL = /^for approval$/i;
    function forApproval(s) { return FOR_APPROVAL.test(String(s || '').trim()); }
    // the one rule every screen uses
    function isUrgentItem(x) {
        if (!x) return false;
        if (x.urgent === true) return forApproval(x.status || x.invoiceStatus || x.remarks);
        return WORD.test(String(x.note || x.invoiceNote || ''));
    }
    window.ibaIsUrgent = isUrgentItem;

    function $(id) { return document.getElementById(id); }
    function myName() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name) : 'System'; } catch (_) { return 'System'; } }
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function tell(msg) {
        try { if (typeof window.ibaToast === 'function') { window.ibaToast(msg, 'warning'); return; } } catch (_) {}
        try { console.warn('[IBA urgent tick] ' + msg); } catch (_) {}
    }
    function curPO() { try { return (typeof currentPO !== 'undefined' && currentPO) || ''; } catch (_) { return ''; } }
    function curKey() { try { return (typeof currentlyEditingInvoiceKey !== 'undefined' && currentlyEditingInvoiceKey) || ''; } catch (_) { return ''; } }
    function saved(po, key) {
        if (!po || !key) return null;
        try { if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) return allInvoiceData[po][key]; } catch (_) {}
        try { if (typeof currentPOInvoices !== 'undefined' && currentPOInvoices && currentPO === po && currentPOInvoices[key]) return currentPOInvoices[key]; } catch (_) {}
        return null;
    }
    function savedFlag(po, key) { var s = saved(po, key); return !!(s && s.urgent === true && forApproval(s.status)); }
    function mayUntick(po, key) {
        if (!savedFlag(po, key) || isSuper()) return true;
        var s = saved(po, key) || {};
        return String(s.urgentBy || '').trim().toLowerCase() === myName().trim().toLowerCase();
    }

    // ---- Invoice Entry --------------------------------------------------------------
    function modalTick() {
        var sel = $('im-status');
        if (!sel || !sel.parentNode) return;
        var box = $('iba-urg-tick');
        if (!box) {
            var lab = document.createElement('label');
            lab.className = 'iba-ret-tick iba-urg-tick';
            lab.id = 'iba-urg-tick-wrap';
            lab.innerHTML = '<input type="checkbox" id="iba-urg-tick"> <span aria-hidden="true">⚡</span> Urgent';
            lab.title = 'Urgent approval: the approver sees it in the Urgent tab. It ends by itself when the approver acts. The Note is not changed.';
            var ret = $('iba-ret-tick-wrap');
            if (ret && ret.parentNode === sel.parentNode) sel.parentNode.insertBefore(lab, ret.nextSibling);
            else sel.parentNode.appendChild(lab);
            box = $('iba-urg-tick');
        }
        var wrap = $('iba-urg-tick-wrap');
        var hide = !forApproval(sel.value);
        if (wrap && wrap.hidden !== hide) wrap.hidden = hide;
        // another invoice opened (or the form cleared): show what is saved
        var sig = curPO() + '|' + curKey();
        if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.checked = savedFlag(curPO(), curKey()); }
    }

    // ---- Batch Entry ---------------------------------------------------------------
    function globalStatus() { var g = $('im-batch-global-status'); return g ? String(g.value || '').trim() : ''; }
    function cardStatus(card) {
        var g = globalStatus();
        if (g) return g;
        var s = card.querySelector('select[name="status"]');
        return s ? String(s.value || '').trim() : '';
    }
    function press(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('is-on', on); }
    function cardsPaint() {
        var body = $('im-batch-table-body');
        if (!body) return;
        body.querySelectorAll('.batch-invoice-card').forEach(function (card) {
            var b = card.querySelector('.iba-urg-card');
            if (!b) {
                var anchor = card.querySelector('.iba-ret-card') || card.querySelector('.btn-quick-status-app');
                if (!anchor || !anchor.parentNode) return;
                b = document.createElement('button');
                b.type = 'button';
                b.className = 'iba-urg-card';
                b.title = 'Urgent approval (For Approval only). Ends by itself when the approver acts.';
                b.innerHTML = '⚡';
                anchor.parentNode.insertBefore(b, anchor.nextSibling);
                press(b, savedFlag(card.getAttribute('data-po') || '', card.getAttribute('data-key') || ''));
            }
            b.hidden = !forApproval(cardStatus(card));
        });
        var gl = $('iba-ret-all');
        if (gl && !$('iba-urg-all-wrap')) {
            var retLab = gl.closest('label');
            if (retLab && retLab.parentNode) {
                var lab = document.createElement('label');
                lab.className = 'iba-ret-tick is-batch iba-urg-tick' + (retLab.classList.contains('is-in-note') ? ' is-in-note' : '');
                lab.id = 'iba-urg-all-wrap';
                lab.innerHTML = '<input type="checkbox" id="iba-urg-all"> <span aria-hidden="true">⚡</span> Urgent for all';
                lab.title = 'Every invoice in this batch that goes to For Approval is saved as an urgent approval.';
                var row = retLab.parentNode;
                if (row.classList && row.classList.contains('iba-ret-note-row')) {
                    var grp = document.createElement('span');
                    grp.className = 'iba-urg-tickgrp';
                    grp.style.cssText = 'display:inline-flex;align-items:center;gap:14px;';
                    row.insertBefore(grp, retLab);
                    grp.appendChild(lab);
                    grp.appendChild(retLab);
                } else row.insertBefore(lab, retLab);
            }
        }
    }

    document.addEventListener('change', function (e) {
        var t = e.target;
        if (!t) return;
        if (t.id === 'im-status') { modalTick(); return; }
        if (t.id === 'iba-urg-tick' && !t.checked && !mayUntick(curPO(), curKey())) {
            t.checked = true; tell('Only the person who marked it urgent, or the Super Admin, can remove Urgent.'); return;
        }
        if (t.matches && t.matches('#im-batch-table-body select[name="status"], #im-batch-global-status')) cardsPaint();
    }, true);
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.iba-urg-card');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var on = b.getAttribute('aria-pressed') !== 'true';
        var card = b.closest('.batch-invoice-card');
        if (!on && card && !mayUntick(card.getAttribute('data-po') || '', card.getAttribute('data-key') || '')) {
            tell('Only the person who marked it urgent, or the Super Admin, can remove Urgent.'); return;
        }
        press(b, on);
    }, true);

    // ---- at save: which invoices are written urgent / not urgent -------------------
    var armed = [], armedAt = 0;
    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('#im-add-invoice-button,#im-update-invoice-button,#im-batch-save-button');
        if (!t) return;
        armed = []; armedAt = Date.now();
        if (t.id === 'im-batch-save-button') {
            var all = !!($('iba-urg-all') && $('iba-urg-all').checked);
            document.querySelectorAll('#im-batch-table-body .batch-invoice-card').forEach(function (card) {
                if (!forApproval(cardStatus(card))) return;
                var b = card.querySelector('.iba-urg-card');
                var po = card.getAttribute('data-po') || '', key = card.getAttribute('data-key') || '';
                var on = all || !!(b && b.getAttribute('aria-pressed') === 'true');
                if (!on && !savedFlag(po, key)) return;
                var inv = card.querySelector('[name="invNumber"]');
                armed.push({ po: po, key: key, inv: inv ? String(inv.value || '').trim() : '', on: on });
            });
            return;
        }
        var box = $('iba-urg-tick'), wrap = $('iba-urg-tick-wrap');
        if (!box || !wrap || wrap.hidden) return;
        var key = t.id === 'im-update-invoice-button' ? curKey() : '';
        if (t.id === 'im-add-invoice-button') setTimeout(function () { box.dataset.sig = ''; }, 2500);
        if (box.checked || savedFlag(curPO(), key)) armed.push({ po: curPO(), key: key, inv: String(($('im-inv-no') || {}).value || '').trim(), on: !!box.checked });
    }, true);
    function armedFor(po, key, val) {
        if (!armed.length || Date.now() - armedAt > 60000) return null;
        var inv = String((val && (val.invNumber || val.invoiceNumber)) || '').trim();
        for (var i = 0; i < armed.length; i++) {
            var a = armed[i];
            if (String(a.po) !== String(po)) continue;
            if (a.key && key) { if (String(a.key) === String(key)) return a; continue; }
            if (a.inv && inv && a.inv === inv) return a;
        }
        return null;
    }

    // ---- the writes ------------------------------------------------------------------
    var recent = {};   // invoice key -> { on, by, at, t } for the task list copy written right after
    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function logLine(po, key, on, status) {
        var d = idb(); if (!d) return;
        d.ref('invoice_entries/' + po + '/' + key + '/history').push({
            action: on ? 'Marked URGENT' : 'Urgent removed', kind: 'urgent', status: status || '',
            updatedBy: myName(), by: myName(), timestamp: Date.now(), note: on ? 'Urgent approval' : 'Back to normal'
        }).catch(function (e) { console.warn('[IBA urgent tick] history line not saved', e); });
    }
    // o = the invoice fields being written. Returns a history job or null.
    function fix(po, key, o) {
        if (!o || typeof o !== 'object') return null;
        var a = armedFor(po, key, o);
        var hasStatus = Object.prototype.hasOwnProperty.call(o, 'status');
        var status = hasStatus ? o.status : ((saved(po, key) || {}).status || 'For Approval');
        var was = savedFlag(po, key);
        if (a && forApproval(status)) {
            if (a.on) {
                o.urgent = true;
                o.urgentBy = was ? ((saved(po, key) || {}).urgentBy || myName()) : myName();
                o.urgentAt = was ? ((saved(po, key) || {}).urgentAt || Date.now()) : Date.now();
            } else { o.urgent = null; o.urgentBy = null; o.urgentAt = null; }
            recent[key] = { on: a.on, by: o.urgentBy, at: o.urgentAt, t: Date.now() };
            return was === a.on ? null : { po: po, key: key, on: a.on, status: status };
        }
        // the status moves on: the urgent approval is over
        if (hasStatus && !forApproval(o.status)) {
            o.urgent = null; o.urgentBy = null; o.urgentAt = null;
            recent[key] = { on: false, t: Date.now() };
        }
        return null;
    }
    function hook() {
        try {
            var R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaUrgTick) return;
            var proto = R.prototype, rootUrl = '';
            var pathOf = function (ref) {
                var d = idb(); if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    var s = ref.toString();
                    if (s.indexOf(rootUrl + '/') !== 0) return null;
                    return s.slice(rootUrl.length + 1).split('/').map(function (p) { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            ['set', 'update'].forEach(function (name) {
                var orig = proto[name];
                if (typeof orig !== 'function') return;
                proto[name] = function () {
                    var jobs = [];
                    try {
                        var parts = pathOf(this), val = arguments[0];
                        if (parts && val && typeof val === 'object' && parts.indexOf('history') === -1) {
                            if (parts[0] === 'invoice_entries') {
                                if (parts.length === 3) jobs.push(fix(parts[1], parts[2], val));
                                else if (name === 'update' && parts.length <= 2) {
                                    Object.keys(val).forEach(function (k) {
                                        var full = parts.slice(1).concat(k.split('/').filter(Boolean));
                                        if (full.length === 2) jobs.push(fix(full[0], full[1], val[k]));
                                        else if (full.length === 3 && full[2] === 'status' && !forApproval(val[k])) {
                                            var base = k.slice(0, k.length - 'status'.length);
                                            val[base + 'urgent'] = null; val[base + 'urgentBy'] = null; val[base + 'urgentAt'] = null;
                                        }
                                    });
                                }
                            } else if (parts[0] === 'invoice_tasks_by_user' && parts.length === 3) {
                                // the task list copy (Active Task, approvals, phone) carries the flag too
                                var r = recent[parts[2]];
                                if (r && Date.now() - r.t < 120000) {
                                    val.urgent = r.on ? true : null;
                                    val.urgentBy = r.on ? (r.by || null) : null;
                                    val.urgentAt = r.on ? (r.at || null) : null;
                                }
                            }
                        }
                    } catch (_) {}
                    var res = orig.apply(this, arguments);
                    jobs = jobs.filter(Boolean);
                    if (jobs.length) Promise.resolve(res).then(function () { jobs.forEach(function (j) { logLine(j.po, j.key, j.on, j.status); }); }).catch(function () {});
                    return res;
                };
            });
            proto.__ibaUrgTick = true;
        } catch (e) { console.warn('[IBA urgent tick] hook not set:', e); }
    }
    hook();
    setInterval(function () { try { modalTick(); } catch (_) {} try { cardsPaint(); } catch (_) {} }, 1500);
})();
