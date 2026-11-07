/* ==========================================================================
   js/iba-1705-ret.js  —  17.0.5 patch 93
   "Tell me when they act" (action return bell). Different from Notify me
   (js/iba-1705-watch.js, which follows an invoice A to Z for anyone).

   - Invoice Entry: a tick box under Status. Batch Entry: a bell button on
     each card + "Tell me for all" next to Set All Statuses To.
   - When you save with it ticked, the invoice is remembered for YOU (by your
     approver key): iba_assistant/ret/<your key>/<po>~<invoice key> with the
     status you set (e.g. For Approval).
   - When someone acts (the status is no longer the one you set, e.g.
     Approved / Rejected / SRV Done), your own bell (return arrow) in the top
     bar gets +1: "For Approval -> Approved · by E.Ali".
   - The bell list has Print ESN (approved invoices with an ESN) and Got it.
   - When YOU save that invoice again with a new status, it is removed by
     itself, unless you tick it again (then it waits for the next person).
   - Downloads: only the status of each ticked invoice (a few bytes) at
     sign-in and every 15 minutes, plus the last history line when it moved.
   ========================================================================== */
(function () {
    'use strict';

    var CHECK_MS = 15 * 60 * 1000;
    var MAX = 80;
    var NO_TICK = /^(under review|paid|with accounts|closed|cancelled|canceled|)$/i;

    var st = { user: '', list: {}, status: {}, loaded: false, checking: false, checkedAt: 0, armed: [], armedAt: 0 };

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } }
    function myName() { var a = me(); return a ? String(a.Name || '').trim() : ''; }
    function myKey() {
        var a = me();
        var k = a && a.key ? String(a.key) : '';
        if (!k) { try { k = localStorage.getItem('approverKey') || ''; } catch (_) {} }
        return k && k !== '__IBA_TEST_PREVIEW__' ? k.replace(/[.#$\[\]\/]/g, '_') : '';
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function safe(s) { return String(s || '').replace(/[.#$\[\]\/]/g, '_'); }
    function idOf(po, key) { return safe(po) + '~' + safe(key); }
    function path() { return 'iba_assistant/ret/' + myKey(); }
    function money(v) {
        var n = Number(String(v || '').replace(/,/g, ''));
        return isFinite(n) && n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v || '');
    }
    function ago(t) {
        var m = Math.round((Date.now() - Number(t || 0)) / 60000);
        if (!t || m < 0) return '';
        if (m < 1) return 'just now';
        if (m < 60) return m + ' min ago';
        var h = Math.round(m / 60);
        if (h < 24) return h + 'h ago';
        return Math.round(h / 24) + 'd ago';
    }
    function moved(id) {
        var w = st.list[id];
        var s = st.status[id];
        // 17.0.5 patch 137: a row without PO / sent status is a leftover, never an alert
        return !!(w && w.po && w.key && w.sent && s && s !== '__gone' && norm(s) !== norm(w.sent));
    }
    function alerts() { return Object.keys(st.list).filter(function (id) { return moved(id) && !st.list[id].seen; }); }

    // ---- remember / forget ---------------------------------------------------
    function infoFromCache(po, key) {
        try { if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) return allInvoiceData[po][key]; } catch (_) {}
        try { if (typeof currentPO !== 'undefined' && currentPO === po && typeof currentPOInvoices !== 'undefined' && currentPOInvoices && currentPOInvoices[key]) return currentPOInvoices[key]; } catch (_) {}
        return {};
    }
    function remember(po, key, val) {
        var d = mainDb();
        if (!d || !myKey()) return;
        var id = idOf(po, key);
        if (!st.list[id] && Object.keys(st.list).length >= MAX) return;
        var c = infoFromCache(po, key);
        var w = {
            po: String(po), key: String(key), sent: String(val.status || ''),
            inv: String(val.invNumber || c.invNumber || ''),
            vendor: String(val.vendor_name || c.vendor_name || c.vendorName || ''),
            site: String(val.site_name || c.site_name || c.site || ''),
            value: String(val.invValue || c.invValue || ''),
            to: String(val.attention || ''),
            at: Date.now()
        };
        st.list[id] = w;
        st.status[id] = w.sent;
        d.ref(path() + '/' + id).set(w).catch(function (e) { console.warn('[ret] not saved', e); });
        paint();
    }
    function forget(id) {
        var d = mainDb();
        if (!st.list[id]) return;
        delete st.list[id];
        delete st.status[id];
        if (d && myKey()) d.ref(path() + '/' + id).remove().catch(function () {});
        paint();
    }

    // ---- what the next save should remember (armed by the tick) --------------
    function arm(list) { st.armed = list; st.armedAt = Date.now(); }
    function armedFor(po, key, val) {
        if (!st.armed.length || Date.now() - st.armedAt > 30 * 1000) return false;
        var inv = norm(val && val.invNumber);
        return st.armed.some(function (a) {
            if (String(a.po) !== String(po)) return false;
            if (a.key && a.key === key) return true;
            if (a.inv && inv && norm(a.inv) === inv) return true;
            return a.any === true;
        });
    }

    // My own saves: an invoice write that carries a status.
    function onMyWrite(po, key, val) {
        if (!myKey() || !po || !key || !val || val.status === undefined) return;
        var id = idOf(po, key);
        var tick = armedFor(po, key, val) && !NO_TICK.test(String(val.status || '').trim());
        if (tick) { remember(po, key, val); return; }
        // I moved it on myself: the reminder is done (unless I tick again)
        if (st.list[id] && norm(val.status) !== norm(st.list[id].sent)) forget(id);
    }
    function writesIn(parts, name, val) {
        var out = [];
        if (!val || typeof val !== 'object') return out;
        if (parts.length === 3) { if (val.status !== undefined) out.push({ po: parts[1], key: parts[2], val: val }); return out; }
        if (name === 'update' && parts.length <= 2) {
            var grouped = {};
            Object.keys(val).forEach(function (k) {
                var seg = k.split('/').filter(Boolean);
                var full = parts.slice(1).concat(seg);
                if (full.length === 2 && val[k] && typeof val[k] === 'object' && val[k].status !== undefined) out.push({ po: full[0], key: full[1], val: val[k] });
                else if (full.length === 3) { var g = full[0] + '/' + full[1]; grouped[g] = grouped[g] || {}; grouped[g][full[2]] = val[k]; }
            });
            Object.keys(grouped).forEach(function (g) { if (grouped[g].status !== undefined) { var p = g.split('/'); out.push({ po: p[0], key: p[1], val: grouped[g] }); } });
        }
        return out;
    }
    function hook() {
        try {
            var R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaRet) return;
            var proto = R.prototype;
            var rootUrl = '';
            var pathOf = function (ref) {
                var d = invDb();
                if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    var s = ref.toString();
                    if (s.indexOf(rootUrl + '/invoice_entries') !== 0) return null;
                    return s.slice(rootUrl.length + 1).split('/').map(function (p) { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            ['set', 'update'].forEach(function (name) {
                var orig = proto[name];
                if (typeof orig !== 'function') return;
                proto[name] = function () {
                    var res = orig.apply(this, arguments);
                    try {
                        var parts = pathOf(this);
                        if (parts && parts[0] === 'invoice_entries' && parts.indexOf('history') === -1) {
                            var items = writesIn(parts, name, arguments[0]);
                            if (items.length) Promise.resolve(res).then(function () { items.forEach(function (it) { onMyWrite(it.po, it.key, it.val); }); }).catch(function () {});
                        }
                    } catch (_) {}
                    return res;
                };
            });
            proto.__ibaRet = true;
        } catch (e) { console.warn('[ret] hook not set', e); }
    }

    // ---- load + check -----------------------------------------------------------
    async function load() {
        var d = mainDb();
        if (!d || !myKey()) return;
        try { var snap = await d.ref(path()).once('value'); st.list = (snap && snap.val()) || {}; } catch (_) { st.list = {}; }
        // 17.0.5 patch 137: a late 'who acted' / 'Got it' write after the row was removed left a
        // half row (no PO, only the new status): the pop-up showed "PO" with nothing. Remove those.
        Object.keys(st.list).forEach(function (id) {
            var w = st.list[id];
            if (!w || typeof w !== 'object' || !w.po || !w.key || !w.sent) { delete st.list[id]; try { d.ref(path() + '/' + id).remove().catch(function () {}); } catch (_) {} }
        });
        Object.keys(st.list).forEach(function (id) { if (st.status[id] === undefined && st.list[id].last) st.status[id] = st.list[id].last; });
        st.loaded = true;
        await check(true);
    }
    async function check(force) {
        var d = invDb();
        if (!d || st.checking) return;
        if (!force && Date.now() - st.checkedAt < CHECK_MS - 5000) return;
        st.checking = true;
        try {
            await Promise.all(Object.keys(st.list).map(function (id) {
                var w = st.list[id];
                if (!w || !w.po || !w.key) return null;
                return d.ref('invoice_entries/' + w.po + '/' + w.key + '/status').once('value').then(function (s) {
                    var v = s && s.val();
                    st.status[id] = v == null ? '__gone' : String(v);
                    // 17.0.5 patch 149: also redo old rows that wrongly say "by Reception"
                    if (moved(id) && (w.last !== st.status[id] || /^reception$/i.test(String(w.lastBy || '').trim()))) return who(id);
                }).catch(function () {});
            }));
            st.checkedAt = Date.now();
        } finally { st.checking = false; }
        paint();
    }
    // who acted: the NEWEST history line by time. 17.0.5 patch 149: not limitToLast(1),
    // which goes by key: the "imported_0" line of invoices made from Reception sorts
    // after every pushed "-..." key, so it always said "by Reception". History is small.
    async function who(id) {
        var d = invDb(), m = mainDb(), w = st.list[id];
        if (!d || !w) return;
        var by = '', when = 0;
        try {
            var s = await d.ref('invoice_entries/' + w.po + '/' + w.key + '/history').once('value');
            var h = (s && s.val()) || {};
            var last = null, lastT = -1;
            Object.keys(h).forEach(function (k) {
                var x = h[k]; if (!x || typeof x !== 'object') return;
                var t = Number(x.timestamp) || 0;
                if (t >= lastT) { lastT = t; last = x; }
            });
            last = last || {};
            by = String(last.updatedBy || last.by || last.user || '').trim();
            when = Number(last.timestamp) || 0;
        } catch (_) {}
        var upd = { last: st.status[id], lastBy: by, lastAt: when || Date.now(), seen: null };
        Object.assign(w, upd);
        delete w.seen;
        if (m && myKey() && st.list[id] === w) m.ref(path() + '/' + id).update(upd).catch(function () {});
    }

    // ---- top bar bell ---------------------------------------------------------------
    function badges() {
        var n = myKey() ? alerts().length : 0;
        var host = $('iba-live-counts');
        var pill = $('iba-ret-pill');
        if (!pill && host && myKey()) {
            pill = document.createElement('button');
            pill.type = 'button';
            pill.id = 'iba-ret-pill';
            pill.className = 'iba-live-pill iba-ret-pill';
            pill.setAttribute('data-live', 'ret');
            pill.hidden = true;
            pill.innerHTML = '<span class="iba-live-glow" aria-hidden="true"></span><span class="iba-live-dot" aria-hidden="true"></span>' +
                '<span class="iba-ret-ico" aria-hidden="true"><i class="fa-solid fa-bell"></i><i class="fa-solid fa-reply"></i></span><span class="iba-live-label">Returned</span><span class="iba-live-num">0</span>';
            host.appendChild(pill);
        }
        if (pill) {
            var hide = !(n > 0) || !myKey();
            if (pill.hidden !== hide) pill.hidden = hide;
            var num = pill.querySelector('.iba-live-num');
            if (num && num.textContent !== String(n)) num.textContent = String(n);
            var t = n + ' invoice' + (n === 1 ? '' : 's') + ' you sent came back (someone acted)';
            if (pill.title !== t) { pill.title = t; pill.setAttribute('aria-label', t); }
        }
    }
    function paint() {
        badges();
        var box = $('iba-ret-pop');
        if (box && !box.__keep) openBox();
        paintTicks();
    }

    function closeBox() { var o = $('iba-ret-pop'); if (o) o.remove(); }
    function openBox() {
        var ids = alerts().sort(function (a, b) { return (Number(st.list[b].lastAt) || 0) - (Number(st.list[a].lastAt) || 0); });
        closeBox();
        if (!ids.length) return;
        var wrap = document.createElement('div');
        wrap.id = 'iba-ret-pop';
        wrap.className = 'iba-pb-layer';
        wrap.innerHTML = '<div class="iba-pb-box iba-watch-box iba-ret-box" role="dialog" aria-modal="true" aria-labelledby="iba-ret-t">' +
            '<div class="iba-pb-head"><b id="iba-ret-t"><i class="fa-solid fa-reply"></i> ' + (ids.length === 1 ? 'An invoice came back to you' : ids.length + ' invoices came back to you') + '</b>' +
            '<span class="iba-ret-head-acts">' + (ids.length > 1 ? '<button type="button" class="iba-trk-btn" data-ret-all><i class="fa-solid fa-check-double"></i> Got all</button>' : '') +
            '<button type="button" class="iba-watch-x" data-ret-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></span></div>' +
            ids.map(function (id) {
                var w = st.list[id], now = st.status[id];
                var tone = /approved/i.test(now) ? 'is-ok' : /reject|return|hold|unresolved/i.test(now) ? 'is-bad' : 'is-mid';
                var canEsn = /approved/i.test(now) && window.ibaEsnFlow && typeof window.ibaEsnFlow.printWindow === 'function';
                return '<div class="iba-watch-item iba-ret-item ' + tone + '" data-ret-id="' + esc(id) + '">' +
                    '<div class="iba-watch-po"><span class="is-no">PO ' + esc(w.po) + '</span>' + (w.vendor ? '<span class="is-vend">' + esc(w.vendor) + '</span>' : '') + (w.site ? '<span class="is-site">Site ' + esc(w.site) + '</span>' : '') + '</div>' +
                    '<div class="iba-watch-line">' + esc([w.inv, w.value ? 'QAR ' + money(w.value) : ''].filter(Boolean).join(' · ')) + '</div>' +
                    '<div class="iba-ret-move"><span class="is-from">' + esc(w.sent) + '</span><i class="fa-solid fa-arrow-right"></i><b class="is-now">' + esc(now) + '</b>' +
                    (w.lastBy ? '<span class="is-by">by ' + esc(w.lastBy) + '</span>' : '') + (w.lastAt ? '<span class="is-ago">' + esc(ago(w.lastAt)) + '</span>' : '') + '</div>' +
                    '<div class="iba-watch-acts">' + (canEsn ? '<button type="button" class="iba-trk-btn is-main" data-ret-esn="' + esc(id) + '"><i class="fa-solid fa-print"></i> Print ESN</button>' : '') +
                    '<button type="button" class="iba-trk-btn" data-ret-seen="' + esc(id) + '"><i class="fa-solid fa-check"></i> Got it</button></div></div>';
            }).join('') + '</div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeBox(); } });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) closeBox(); });
        setTimeout(function () { var b = wrap.querySelector('[data-ret-close]'); if (b) try { b.focus(); } catch (_) {} }, 0);
    }
    function seen(id) {
        var w = st.list[id], m = mainDb();
        if (!w) return;
        w.seen = Date.now();
        if (m && myKey() && w.po && w.key) m.ref(path() + '/' + id).update({ seen: w.seen }).catch(function () {});
    }

    // ---- tick boxes ---------------------------------------------------------------------
    function modalTick() {
        var sel = $('im-status');
        if (!sel) return;
        var box = $('iba-ret-tick');
        if (!box) {
            var lab = document.createElement('label');
            lab.className = 'iba-ret-tick';
            lab.id = 'iba-ret-tick-wrap';
            lab.innerHTML = '<input type="checkbox" id="iba-ret-tick"> <i class="fa-solid fa-reply" aria-hidden="true"></i> Tell me when they act';
            lab.title = 'Your Returned bell gets +1 when the person acts on it (e.g. approves). Removed by itself when you change the status again.';
            sel.parentNode.appendChild(lab);
            box = $('iba-ret-tick');
        }
        var wrap = $('iba-ret-tick-wrap');
        var hide = NO_TICK.test(String(sel.value || '').trim());
        if (wrap && wrap.hidden !== hide) wrap.hidden = hide;
        // opening another invoice: the tick shows whether this one is already waiting
        var key = '';
        try { key = (typeof currentlyEditingInvoiceKey !== 'undefined' && currentlyEditingInvoiceKey) || ''; } catch (_) {}
        var po = ''; try { po = (typeof currentPO !== 'undefined' && currentPO) || ''; } catch (_) {}
        var sig = po + '|' + key;
        if (box.dataset.sig !== sig) { box.dataset.sig = sig; box.checked = !!(key && st.list[idOf(po, key)] && !moved(idOf(po, key))); }
    }
    function batchTicks() {
        var body = $('im-batch-table-body');
        if (!body) return;
        body.querySelectorAll('.batch-invoice-card').forEach(function (card) {
            if (card.querySelector('.iba-ret-card')) return;
            var app = card.querySelector('.btn-quick-status-app');
            if (!app || !app.parentNode) return;
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-ret-card';
            b.title = 'Tell me when they act (Returned bell)';
            b.setAttribute('aria-pressed', 'false');
            b.innerHTML = '<i class="fa-solid fa-reply"></i>';
            app.parentNode.appendChild(b);
        });
        var gl = $('im-batch-global-status');
        if (gl && !$('iba-ret-all')) {
            var lab = document.createElement('label');
            lab.className = 'iba-ret-tick is-batch';
            lab.innerHTML = '<input type="checkbox" id="iba-ret-all"> <i class="fa-solid fa-reply" aria-hidden="true"></i> Tell me for all';
            lab.title = 'Every invoice in this batch: your Returned bell gets +1 when the person acts on it';
            // 17.0.5 p110: sits on the "Set All Notes To" title line, right corner (martin)
            var nl = document.querySelector('label[for="im-batch-global-note"]');
            if (nl && nl.parentNode) {
                var row = document.createElement('div');
                row.className = 'iba-ret-note-row';
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;';
                nl.parentNode.insertBefore(row, nl);
                nl.style.marginBottom = '0';
                row.appendChild(nl);
                lab.classList.add('is-in-note');
                row.appendChild(lab);
            } else gl.parentNode.appendChild(lab);
        }
    }
    function paintTicks() {
        try { modalTick(); } catch (_) {}
        try { batchTicks(); } catch (_) {}
    }

    // ---- clicks -----------------------------------------------------------------------------
    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('#iba-ret-pill,[data-ret-close],[data-ret-seen],[data-ret-esn],[data-ret-all],.iba-ret-card,#im-add-invoice-button,#im-update-invoice-button,#im-batch-save-button');
        if (!t) return;
        // saves: remember what is ticked (the save itself goes on as normal)
        if (t.id === 'im-add-invoice-button' || t.id === 'im-update-invoice-button') {
            var box = $('iba-ret-tick');
            if (box && box.checked && !$('iba-ret-tick-wrap').hidden) {
                var po = ''; try { po = (typeof currentPO !== 'undefined' && currentPO) || ''; } catch (_) {}
                var key = ''; try { key = t.id === 'im-update-invoice-button' ? ((typeof currentlyEditingInvoiceKey !== 'undefined' && currentlyEditingInvoiceKey) || '') : ''; } catch (_) {}
                arm([{ po: po, key: key, inv: ($('im-inv-no') || {}).value || '' }]);
            } else {
                arm([]);
                // unticked on Update: stop waiting for this invoice
                try {
                    var upo = (typeof currentPO !== 'undefined' && currentPO) || '';
                    var ukey = t.id === 'im-update-invoice-button' ? ((typeof currentlyEditingInvoiceKey !== 'undefined' && currentlyEditingInvoiceKey) || '') : '';
                    if (box && ukey && st.list[idOf(upo, ukey)] && !moved(idOf(upo, ukey))) forget(idOf(upo, ukey));
                } catch (_) {}
            }
            return;
        }
        if (t.id === 'im-batch-save-button') {
            var all = $('iba-ret-all') && $('iba-ret-all').checked;
            var list = [];
            document.querySelectorAll('#im-batch-table-body .batch-invoice-card').forEach(function (card) {
                var cb = card.querySelector('.iba-ret-card'); var on = all || !!(cb && cb.getAttribute('aria-pressed') === 'true');
                if (!on) return;
                var inv = card.querySelector('[name="invNumber"]');
                list.push({ po: card.getAttribute('data-po') || '', key: card.getAttribute('data-key') || '', inv: inv ? inv.value : '' });
            });
            arm(list);
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (t.classList.contains('iba-ret-card')) {
            var on = t.getAttribute('aria-pressed') !== 'true';
            t.setAttribute('aria-pressed', on ? 'true' : 'false');
            t.classList.toggle('is-on', on);
            return;
        }
        if (t.id === 'iba-ret-pill') return openBox();
        if (t.hasAttribute('data-ret-close')) return closeBox();
        if (t.hasAttribute('data-ret-all')) { alerts().forEach(seen); closeBox(); badges(); return; }
        var id = t.getAttribute('data-ret-seen') || t.getAttribute('data-ret-esn');
        var w = st.list[id];
        if (!w) return;
        if (t.hasAttribute('data-ret-esn')) { try { window.ibaEsnFlow.printWindow(w.po, w.key); } catch (err) { alert('Could not open the ESN print: ' + (err && err.message || err)); } return; }
        if (t.hasAttribute('data-ret-seen')) {
            seen(id);
            var item = t.closest('.iba-ret-item');
            if (item) item.remove();
            var bx = $('iba-ret-pop');
            if (bx && !bx.querySelector('.iba-ret-item')) closeBox();
            badges();
        }
    }, true);
    document.addEventListener('change', function (e) { if (e.target && e.target.id === 'im-status') modalTick(); }, true);

    // ---- start after sign-in -------------------------------------------------------------------
    function tick() {
        var k = myKey();
        if (k !== st.user) {
            st.user = k;
            st.list = {}; st.status = {}; st.loaded = false; st.checkedAt = 0;
            closeBox();
            if (k) load(); else badges();
            return;
        }
        if (k && st.loaded && document.visibilityState !== 'hidden') check(false);
        badges();
        paintTicks();
    }
    hook();
    setInterval(tick, 3000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && st.loaded) check(false); });

    window.ibaReturnBell = {
        refresh: function () { return check(true); },
        open: openBox,
        list: function () { return st.list; },
        // 17.0.5 patch 117: phone Home "Returned" counter (moved since you sent it)
        items: function () { return Object.keys(st.list).filter(moved).map(function (id) { var w = st.list[id] || {}; return { id: id, po: w.po, key: w.key, inv: w.inv, vendor: w.vendor, site: w.site, value: w.value, sent: w.sent, status: st.status[id] || '', seen: !!w.seen, at: Number(w.at) || 0 }; }); },
        _onWrite: onMyWrite
    };
})();
