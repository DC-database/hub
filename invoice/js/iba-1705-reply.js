/* ==========================================================================
   js/iba-1705-reply.js — 17.0.5 patch 31
   "Reply" for invoices with a typed status (Other…, e.g. "Suggestion
   Require"): a question and answer between two people that keeps the
   invoice moving.
   - Active Task (PC row, phone card): "Reply" instead of "Process".
     17.0.5 patch 32: also the Dashboard My Tasks cards and the assistant
     brief (js/iba-assistant.js taskActs / phoneActs).
   - The Reply window shows the question (current note) and who asked it.
     The reply is mandatory; "Send to" is optional and starts with the
     person who asked. The status is not shown and stays as it is.
   - Send: Attention = Send to, note = "<me>: <reply>", askedBy = me (so the
     next reply goes back to me), a history line, the task lists updated.
   - Saving a typed status anywhere (Invoice Entry, Batch Entry, ...) stamps
     askedBy / askedAt with the person who saved it.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : ''; } catch (_) { return ''; } }
    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function toast(m) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(m); } catch (_) {} }

    // a typed status = an open personal task that is not one of the app's own statuses
    function isTyped(status) {
        const s = String(status || '').trim();
        if (!s) return false;
        try {
            if (typeof wdActiveTaskExactInvoiceStatusLabel === 'function' && wdActiveTaskExactInvoiceStatusLabel(s)) return false;
            if (typeof wdActiveTaskStatusFromLookup === 'function') return !!wdActiveTaskStatusFromLookup({ status: s });
        } catch (_) {}
        return false;
    }
    function tasks() { try { return Array.isArray(userActiveTasks) ? userActiveTasks : []; } catch (_) { return []; } }
    function taskByKey(k) { return tasks().find((t) => t && String(t.key) === String(k)) || null; }
    function isReplyTask(t) { return !!t && t.source === 'invoice' && isTyped(t.status || t.remarks) && !!(t.originalPO || t.po); }
    function idsOf(t) {
        const po = String(t.originalPO || t.po || '').trim();
        let key = String(t.originalKey || t.invoiceKey || '').trim();
        if (!key && String(t.key || '').indexOf('_') !== -1) key = String(t.key).split('_').slice(1).join('_');
        return { po, key };
    }
    function fallbackAsker() { try { return (typeof imBatchFallbackAttentionName === 'function') ? imBatchFallbackAttentionName() : 'Irwin'; } catch (_) { return 'Irwin'; } }
    function people() {
        try {
            const map = (typeof ibaApproverMap === 'function') ? (ibaApproverMap() || {}) : {};
            const out = [], seen = new Set();
            Object.values(map).forEach((a) => {
                const n = a && String(a.Name || '').trim();
                if (!n || seen.has(norm(n))) return;
                seen.add(norm(n));
                out.push({ name: n, pos: String(a.Position || '').trim() });
            });
            return out.sort((a, b) => a.name.localeCompare(b.name));
        } catch (_) { return []; }
    }
    function exists(name) { const n = norm(name); return !!n && people().some((p) => norm(p.name) === n); }
    function canonical(name) { const n = norm(name); const p = people().find((x) => norm(x.name) === n); return p ? p.name : String(name || '').trim(); }

    // ------------------------------------------------------------------
    // Stamp who asked when a typed status is saved
    // ------------------------------------------------------------------
    function hook() {
        try {
            const R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaReply) return;
            const proto = R.prototype;
            let root = '';
            const pathOf = (ref) => {
                const d = idb();
                if (!d) return null;
                try {
                    if (!root) root = d.ref().toString().replace(/\/$/, '');
                    const s = ref.toString();
                    if (s.indexOf(root + '/invoice_entries/') !== 0) return null;
                    return s.slice(root.length + 1).split('/').map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            ['set', 'update'].forEach((name) => {
                const orig = proto[name];
                if (typeof orig !== 'function') return;
                proto[name] = function () {
                    try {
                        const parts = pathOf(this);
                        const v = arguments[0];
                        if (parts && parts.length === 3 && v && typeof v === 'object' && isTyped(v.status) && !v.askedBy) {
                            const who = me();
                            if (who) arguments[0] = Object.assign({}, v, { askedBy: who, askedAt: Date.now() });
                        }
                    } catch (_) {}
                    return orig.apply(this, arguments);
                };
            });
            proto.__ibaReply = true;
        } catch (e) { console.warn('[IBA reply] stamp hook not set:', e); }
    }
    hook();

    // ------------------------------------------------------------------
    // Buttons
    // ------------------------------------------------------------------
    const BTN = (k) => '<button type="button" class="wd-row-action wd-action-process iba-reply-btn" data-reply-key="' + esc(k) + '" title="Answer this and send it back (or to someone else)"><i class="fa-solid fa-reply"></i> Reply</button>';
    function paintPc() {
        const body = document.getElementById('active-task-table-body');
        if (!body) return;
        body.querySelectorAll('tr[data-key]').forEach((tr) => {
            const t = taskByKey(tr.getAttribute('data-key'));
            if (!isReplyTask(t)) return;
            const mod = tr.querySelector('.modify-btn');
            if (mod) mod.outerHTML = BTN(t.key);
            else if (!tr.querySelector('.iba-reply-btn') && tr.lastElementChild) tr.lastElementChild.insertAdjacentHTML('beforeend', BTN(t.key));
        });
    }
    // phone cards have no key: match them to the tasks by PO + status, in order
    function paintPhone() {
        const box = document.getElementById('active-task-mobile-view');
        if (!box) return;
        const cards = Array.from(box.querySelectorAll('.invoice-mobile-task-card'));
        if (!cards.length) return;
        const used = new Set();
        cards.forEach((card) => {
            if (card.querySelector('.iba-reply-btn')) return;
            const subs = card.querySelectorAll('.mobile-card-header .m-card-sub');
            const po = subs[0] ? subs[0].textContent.trim() : '';
            const st = subs[1] ? subs[1].textContent.trim() : '';
            if (!isTyped(st)) return;
            const t = tasks().find((x) => x && !used.has(x.key) && isReplyTask(x) && String(x.po || x.ref || '').trim() === po && String(x.remarks || x.status || '').trim() === st);
            if (!t) return;
            used.add(t.key);
            const lock = Array.from(card.querySelectorAll('.mobile-card-body > div')).find((d) => /View Only/.test(d.textContent || ''));
            const html = '<div class="m-btn-row iba-reply-row">' + BTN(t.key).replace('wd-row-action wd-action-process ', 'm-btn-approve ') + '</div>';
            if (lock) lock.outerHTML = html;
            else { const b = card.querySelector('.mobile-card-body'); if (b) b.insertAdjacentHTML('beforeend', html); }
        });
    }
    let queued = false;
    function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; try { paintPc(); } catch (_) {} try { paintPhone(); } catch (_) {} }, 120); }
    function watch() {
        ['active-task-table-body', 'active-task-mobile-view'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && !el.__ibaReplyObs) { el.__ibaReplyObs = true; try { new MutationObserver(queue).observe(el, { childList: true, subtree: true }); } catch (_) {} }
        });
        queue();
    }

    // ------------------------------------------------------------------
    // The Reply window
    // ------------------------------------------------------------------
    function docUrl(kind, name) {
        try {
            if (!name || /^nil$/i.test(String(name).trim()) || typeof buildSharePointPdfUrl !== 'function') return '';
            const base = kind === 'srv' ? (typeof SRV_BASE_PATH !== 'undefined' ? SRV_BASE_PATH : '') : (typeof PDF_BASE_PATH !== 'undefined' ? PDF_BASE_PATH : '');
            return base ? buildSharePointPdfUrl(base, String(name).trim()) : '';
        } catch (_) { return ''; }
    }
    let settle = null;
    function close() { const w = document.getElementById('iba-reply-pop'); if (w) w.remove(); if (settle) { const f = settle; settle = null; f(); } }
    async function open(t) {
        const { po, key } = idsOf(t);
        if (!po || !key) { alert('This invoice could not be found. Please refresh.'); return; }
        const d = idb();
        if (!d) return;
        let inv = null;
        try { const s = await d.ref('invoice_entries/' + po + '/' + key).once('value'); inv = s.val(); } catch (_) { inv = null; }
        if (!inv) { alert('This invoice could not be found. Please refresh.'); return; }
        const status = String(inv.status || '').trim();
        if (!isTyped(status)) { alert('This invoice is now "' + status + '". Please refresh your tasks.'); return; }
        const asker = canonical(inv.askedBy || '') || fallbackAsker();
        const to0 = norm(asker) === norm(me()) ? '' : asker;
        const invUrl = docUrl('inv', inv.invName || t.invName), srvUrl = docUrl('srv', inv.srvName || t.srvName);
        const links = (invUrl || srvUrl) ? '<div class="iba-reply-docs">' +
            (invUrl ? '<a href="' + esc(invUrl) + '" target="_blank" rel="noopener"><i class="fa-solid fa-file-pdf"></i> Open invoice</a>' : '') +
            (srvUrl ? '<a href="' + esc(srvUrl) + '" target="_blank" rel="noopener"><i class="fa-solid fa-file-circle-check"></i> Open SRV</a>' : '') + '</div>' : '';
        const list = people().map((p) => '<option value="' + esc(p.name) + '">' + esc(p.pos) + '</option>').join('');
        close();
        const w = document.createElement('div');
        w.id = 'iba-reply-pop';
        w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-reply" role="dialog" aria-modal="true" aria-labelledby="iba-reply-t">' +
            '<div class="iba-pb-head"><b id="iba-reply-t"><i class="fa-solid fa-reply"></i> Reply</b>' +
            '<span>PO ' + esc(po) + (inv.invNumber ? ' · ' + esc(inv.invNumber) : '') + (inv.vendorName || t.vendorName ? ' · ' + esc(inv.vendorName || t.vendorName) : '') + '</span></div>' +
            '<div class="iba-reply-body">' +
            '<div class="iba-reply-q"><small><span class="iba-reply-st">' + esc(status) + '</span> asked by <b>' + esc(inv.askedBy || asker) + '</b></small>' +
            '<p>' + (inv.note ? esc(inv.note) : '<i>No note was written.</i>') + '</p>' + links + '</div>' +
            '<label for="iba-reply-text">Your reply <em>required</em></label>' +
            '<textarea id="iba-reply-text" rows="4" placeholder="Write what to do with this invoice…"></textarea>' +
            '<label for="iba-reply-to">Send to <em>optional</em></label>' +
            '<input id="iba-reply-to" list="iba-reply-people" autocomplete="off" value="' + esc(to0) + '" placeholder="' + esc(asker) + '">' +
            '<datalist id="iba-reply-people">' + list + '</datalist>' +
            '<p class="iba-reply-msg" hidden></p></div>' +
            '<div class="iba-pb-foot"><span></span><button type="button" data-x>Cancel</button><button type="button" data-send class="is-main" disabled><i class="fa-solid fa-paper-plane"></i> Send</button></div></div>';
        document.body.appendChild(w);
        const closed = new Promise((r) => { settle = r; });
        const txt = w.querySelector('#iba-reply-text'), toEl = w.querySelector('#iba-reply-to'), send = w.querySelector('[data-send]'), msg = w.querySelector('.iba-reply-msg');
        const say = (m) => { msg.hidden = !m; msg.textContent = m || ''; };
        txt.addEventListener('input', () => { send.disabled = !txt.value.trim(); say(''); });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
        w.addEventListener('click', async (e) => {
            if (e.target === w) return close();
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-x')) return close();
            if (!b.hasAttribute('data-send')) return;
            const reply = txt.value.replace(/\s+/g, ' ').trim();
            if (!reply) { say('Please write your reply.'); txt.focus(); return; }
            let to = canonical(toEl.value.trim() || asker);
            if (!exists(to)) { say('"' + to + '" is not a user. Pick a name from the list.'); toEl.focus(); return; }
            const away = (window.ibaAwayGuard && window.ibaAwayGuard.awayOf) ? window.ibaAwayGuard.awayOf(to) : null;
            if (away) { say(to + ' is on vacation. Send it to ' + away.target + ' instead.'); toEl.value = away.target; return; }
            send.disabled = true;
            send.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
            try {
                await save(po, key, inv, status, reply, to);
                close();
                toast('Reply sent to ' + to + '.');
            } catch (err) {
                send.disabled = false;
                send.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send';
                say('Not sent: ' + ((err && err.message) || err));
            }
        });
        setTimeout(() => txt.focus(), 30);
        return closed;
    }

    async function save(po, key, inv, status, reply, to) {
        const d = idb();
        const by = me() || 'System';
        const oldAttention = inv.attention || '';
        const note = by + ': ' + reply;
        const updates = { attention: to, note: note, askedBy: by, askedAt: Date.now(), lastUpdated: firebase.database.ServerValue.TIMESTAMP };
        const hist = { action: 'Reply', status: status, by: by, to: to, note: reply, timestamp: Date.now() };
        await Promise.all([
            d.ref('invoice_entries/' + po + '/' + key).update(updates),
            d.ref('invoice_entries/' + po + '/' + key + '/history').push(hist)
        ]);
        const merged = Object.assign({}, inv, updates, { lastUpdated: Date.now() });
        try { if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(po, key, merged, oldAttention); } catch (e) { console.warn('[IBA reply] task list not updated', e); }
        try { if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(po, key, merged); } catch (_) {}
        // off my list right away (unless I sent it to myself)
        if (norm(to) !== norm(by)) {
            try {
                const list = tasks();
                for (let i = list.length - 1; i >= 0; i--) { const ids = idsOf(list[i]); if (ids.po === po && ids.key === key) list.splice(i, 1); }
            } catch (_) {}
            document.querySelectorAll('.iba-reply-btn').forEach((b) => {
                const t = taskByKey(b.getAttribute('data-reply-key'));
                if (!t) { const row = b.closest('tr, .invoice-mobile-task-card'); if (row) row.remove(); }
            });
        }
        try {
            sessionStorage.removeItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V3');
            if (typeof wdClearWorkdeskDashboardCache === 'function') wdClearWorkdeskDashboardCache();
        } catch (_) {}
    }

    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.iba-reply-btn') : null;
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        const t = taskByKey(b.getAttribute('data-reply-key'));
        if (!t) { alert('This task could not be found. Please refresh.'); return; }
        open(t);
    }, true);
    // "Process" on a typed-status task (e.g. from another screen) opens Reply too
    document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('.modify-btn[data-key]') : null;
        if (!b) return;
        const t = taskByKey(b.getAttribute('data-key'));
        if (!isReplyTask(t)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        open(t);
    }, true);

    // any other way into the old Process window for such a task opens Reply
    if (typeof window.openModifyTaskModal === 'function' && !window.openModifyTaskModal.__ibaReply) {
        const origModify = window.openModifyTaskModal;
        window.openModifyTaskModal = function (task) {
            if (isReplyTask(task)) return open(task);
            return origModify.apply(this, arguments);
        };
        window.openModifyTaskModal.__ibaReply = true;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    setInterval(watch, 3000);
    window.ibaReply = { open, isTyped, isReplyTask };
})();
