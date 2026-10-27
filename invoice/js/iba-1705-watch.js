/* ==========================================================================
   js/iba-1705-watch.js  —  17.0.5 patch 21
   "Notify me": follow an invoice until it reaches Accounts.

   - The invoice receipt (Where is my invoice?) has a Notify me button. It
     saves a small note for YOU (by your approver key, so two people with the
     same name never share it): iba_assistant/watch/<your key>/<po>~<invoice>.
   - Now brief shows a "Watching" table: each invoice and where it is now.
   - When a watched invoice reaches With Accounts, a bell with a red number
     shows in the top bar (next to Active Task) and on the phone Brief tab.
     The box has Email (accounts@iba.com.qa) and WhatsApp (Gio's mobile from
     the approver list) buttons with the message ready; you press Send.
     "Got it" clears the number. When Accounts marks it Paid the bell shows
     "Paid" once; a day after that the invoice leaves the list.
   - Downloads: only the status of each watched invoice
     (invoice_entries/<po>/<key>/status, a few bytes), when you sign in and
     every 15 minutes while the app is open. Never the invoice list.
   ========================================================================== */
(function () {
    'use strict';

    var ACCOUNTS_EMAIL = 'accounts@iba.com.qa';
    var WA_NAME = /^gio\b/i;            // Accounts on WhatsApp
    var CHECK_MS = 15 * 60 * 1000;
    var PAID_KEEP_MS = 24 * 60 * 60 * 1000;
    var MAX_WATCH = 40;

    var st = { user: '', list: {}, status: {}, loaded: false, checking: false, timer: 0, checkedAt: 0 };

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
    function path() { return 'iba_assistant/watch/' + myKey(); }
    function isAcc(s) { return norm(s) === 'with accounts'; }
    function isPaid(s) { return norm(s) === 'paid'; }
    function onPhone() { var b = document.body; return !!(b && (b.classList.contains('iba-phone') || b.classList.contains('iba-mobile-ui'))); }

    // ---- loading and checking --------------------------------------------
    async function load() {
        var d = mainDb();
        if (!d || !myKey()) return;
        try {
            var snap = await d.ref(path()).once('value');
            st.list = (snap && snap.val()) || {};
        } catch (_) { st.list = {}; }
        st.loaded = true;
        await check(true);
    }
    async function check(force) {
        var d = invDb();
        if (!d || st.checking) return;
        if (!force && Date.now() - st.checkedAt < CHECK_MS - 5000) return;
        st.checking = true;
        try {
            var ids = Object.keys(st.list);
            await Promise.all(ids.map(function (id) {
                var w = st.list[id];
                if (!w || !w.po || !w.key) return null;
                return d.ref('invoice_entries/' + w.po + '/' + w.key + '/status').once('value')
                    .then(function (s) { var v = s && s.val(); st.status[id] = v == null ? '__gone' : String(v); })
                    .catch(function () {});
            }));
            st.checkedAt = Date.now();
            await tidy();
        } finally { st.checking = false; }
        paint();
    }
    // Paid and seen more than a day ago: off the list
    async function tidy() {
        var d = mainDb();
        var now = Date.now();
        var drop = Object.keys(st.list).filter(function (id) {
            var w = st.list[id] || {};
            return isPaid(st.status[id]) && w.paidSeen && now - Number(w.paidSeen) > PAID_KEEP_MS;
        });
        if (!drop.length || !d) return;
        var upd = {};
        drop.forEach(function (id) { upd[id] = null; delete st.list[id]; });
        try { await d.ref(path()).update(upd); } catch (_) {}
    }

    // what needs the person now
    function alerts() {
        return Object.keys(st.list).map(function (id) {
            var w = st.list[id] || {};
            var s = st.status[id];
            if (isPaid(s) && !w.paidSeen) return { id: id, w: w, kind: 'paid' };
            if (isAcc(s) && !w.accSeen) return { id: id, w: w, kind: 'acc' };
            return null;
        }).filter(Boolean);
    }

    // ---- watch / stop ------------------------------------------------------
    async function toggle(info) {
        var d = mainDb();
        if (!d || !myKey()) { alert('Please sign in again, then try Notify me.'); return false; }
        var id = idOf(info.po, info.key);
        if (st.list[id]) {
            delete st.list[id];
            delete st.status[id];
            try { await d.ref(path() + '/' + id).remove(); } catch (_) {}
            paint();
            return false;
        }
        if (Object.keys(st.list).length >= MAX_WATCH) { alert('You are already watching ' + MAX_WATCH + ' invoices. Stop one first (Now brief, Watching).'); return false; }
        var w = {
            po: String(info.po), key: String(info.key), inv: String(info.inv || ''),
            vendor: String(info.vendor || ''), site: String(info.site || ''), value: String(info.value || ''),
            by: myName(), at: Date.now()
        };
        st.list[id] = w;
        if (info.status) st.status[id] = String(info.status);
        try { await d.ref(path() + '/' + id).set(w); } catch (e) {
            delete st.list[id];
            alert('Could not save Notify me. Please try again.');
            paint();
            return false;
        }
        paint();
        return true;
    }
    async function markSeen(id) {
        var d = mainDb();
        var w = st.list[id];
        if (!w || !d) return;
        var now = Date.now();
        var upd = { accSeen: w.accSeen || now };
        if (isPaid(st.status[id])) upd.paidSeen = now;
        Object.assign(w, upd);
        try { await d.ref(path() + '/' + id).update(upd); } catch (_) {}
        paint();
    }

    // ---- Email / WhatsApp ----------------------------------------------------
    function waNumber() {
        var all = {};
        try { all = (typeof window.getApproversDataSafe === 'function' && window.getApproversDataSafe()) || {}; } catch (_) {}
        if (!all || !Object.keys(all).length) { try { all = (typeof allApproverData !== 'undefined' && allApproverData) || {}; } catch (_) {} }
        var hit = Object.keys(all).map(function (k) { return all[k] || {}; }).find(function (a) { return WA_NAME.test(String(a.Name || '').trim()); });
        var m = hit ? String(hit.Mobile || hit.mobile || '').replace(/\D/g, '') : '';
        if (m.length === 8) m = '974' + m;
        return m;
    }
    function money(v) {
        var n = Number(String(v || '').replace(/,/g, ''));
        return isFinite(n) && n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v || '');
    }
    function what(w) {
        return 'PO ' + w.po + (w.inv ? ' / ' + w.inv : '') +
            (w.vendor || w.site || w.value ? ' (' + [w.vendor, w.site ? 'Site ' + w.site : '', w.value ? 'QAR ' + money(w.value) : ''].filter(Boolean).join(', ') + ')' : '');
    }
    function message(w) {
        return 'Dear Accounts,\n\n' + what(w) + ' is now with Accounts. Kindly proceed with the payment, or let me know if it is already paid.\n\nThank you,\n' + (myName() || '');
    }
    function sendEmail(w) {
        var href = 'mailto:' + ACCOUNTS_EMAIL + '?subject=' + encodeURIComponent('Payment: PO ' + w.po + (w.inv ? ' / ' + w.inv : '')) + '&body=' + encodeURIComponent(message(w));
        var a = document.createElement('a');
        a.href = href;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); }, 0);
    }
    function sendWhatsApp(w) {
        var n = waNumber();
        window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(message(w)), '_blank', 'noopener');
    }

    // ---- the box (bell / Ask Accounts) ---------------------------------------
    function closeBox() { var o = $('iba-watch-pop'); if (o) o.remove(); }
    function openBox(onlyId) {
        closeBox();
        var list = onlyId ? [{ id: onlyId, w: st.list[onlyId], kind: isPaid(st.status[onlyId]) ? 'paid' : 'acc' }].filter(function (x) { return x.w; }) : alerts();
        if (!list.length) return;
        var wrap = document.createElement('div');
        wrap.id = 'iba-watch-pop';
        wrap.className = 'iba-pb-layer';
        wrap.innerHTML = '<div class="iba-pb-box iba-watch-box" role="dialog" aria-modal="true" aria-labelledby="iba-watch-t">' +
            '<div class="iba-pb-head"><b id="iba-watch-t"><i class="fa-solid fa-bell"></i> ' + (list.length === 1 ? (list[0].kind === 'paid' ? 'Your invoice is paid' : 'Your invoice reached Accounts') : list.length + ' invoices you are watching moved') + '</b>' +
            '<button type="button" class="iba-watch-x" data-watch-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            list.map(function (x) {
                var w = x.w;
                var paid = x.kind === 'paid';
                return '<div class="iba-watch-item' + (paid ? ' is-paid' : '') + '" data-watch-id="' + esc(x.id) + '">' +
                    '<div class="iba-watch-po"><span class="is-no">PO ' + esc(w.po) + '</span>' + (w.vendor ? '<span class="is-vend">' + esc(w.vendor) + '</span>' : '') + (w.site ? '<span class="is-site">Site ' + esc(w.site) + '</span>' : '') + '</div>' +
                    '<div class="iba-watch-line">' + esc([w.inv, w.value ? 'QAR ' + money(w.value) : '', paid ? 'Paid' : 'With Accounts'].filter(Boolean).join(' · ')) + '</div>' +
                    (paid ? '' :
                    '<div class="iba-watch-msg"><span>Message (ready, you press Send)</span>' + esc(message(w)).replace(/\n/g, '<br>') + '</div>' +
                    '<div class="iba-watch-acts"><button type="button" class="iba-trk-btn is-main" data-watch-mail="' + esc(x.id) + '"><i class="fa-regular fa-envelope"></i> Email</button>' +
                    '<button type="button" class="iba-trk-btn is-wa" data-watch-wa="' + esc(x.id) + '"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>') +
                    (paid ? '<div class="iba-watch-acts">' : '') +
                    '<button type="button" class="iba-trk-btn" data-watch-seen="' + esc(x.id) + '"><i class="fa-solid fa-check"></i> Got it</button></div></div>';
            }).join('') + '</div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeBox(); } });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) closeBox(); });
        setTimeout(function () { var b = wrap.querySelector('[data-watch-close]'); if (b) try { b.focus(); } catch (_) {} }, 0);
    }

    // ---- top bar bell + phone Brief tab --------------------------------------
    function paint() {
        badges();
        // a brief that is open now: refresh its Watching table
        document.querySelectorAll('[data-watch-brief]').forEach(function (el) { el.outerHTML = briefHtml(); });
        // receipt buttons
        document.querySelectorAll('[data-watch-btn]').forEach(function (b) { setBtn(b); });
    }
    function badges() {
        var n = myKey() ? alerts().length : 0;
        var host = $('iba-live-counts');
        var pill = $('iba-watch-pill');
        if (!pill && host && myKey()) {
            pill = document.createElement('button');
            pill.type = 'button';
            pill.id = 'iba-watch-pill';
            pill.className = 'iba-live-pill iba-watch-pill';
            pill.setAttribute('data-live', 'watch');
            pill.hidden = true;
            pill.innerHTML = '<span class="iba-live-glow" aria-hidden="true"></span><span class="iba-live-dot" aria-hidden="true"></span>' +
                '<i class="fa-solid fa-bell" aria-hidden="true"></i><span class="iba-live-label">Accounts</span><span class="iba-live-num">0</span>';
            host.appendChild(pill);
        }
        if (pill) {
            pill.hidden = !(n > 0) || !myKey();
            pill.querySelector('.iba-live-num').textContent = String(n);
            pill.title = n + ' watched invoice' + (n === 1 ? '' : 's') + ' reached Accounts or got paid';
            pill.setAttribute('aria-label', pill.title);
        }
        var phb = $('iba-ph-ai');
        if (phb) {
            var pn = phb.querySelector('.iba-watch-phn');
            if (!pn) { pn = document.createElement('span'); pn.className = 'iba-watch-phn'; pn.setAttribute('aria-hidden', 'true'); phb.appendChild(pn); }
            pn.hidden = !(n > 0);
            pn.textContent = String(n);
        }
        var tab = document.querySelector('[data-aph-tab="brief"]');
        if (tab) {
            var b = tab.querySelector('.iba-watch-tabn');
            if (!b) { b = document.createElement('span'); b.className = 'iba-watch-tabn'; tab.appendChild(b); }
            b.hidden = !(n > 0);
            b.textContent = String(n);
        }
    }

    // ---- Now brief: Watching table ---------------------------------------------
    function briefHtml() {
        var ids = Object.keys(st.list);
        if (!ids.length) return '<div data-watch-brief hidden></div>';
        ids.sort(function (a, b) { return (Number((st.list[b] || {}).at) || 0) - (Number((st.list[a] || {}).at) || 0); });
        // reached Accounts / paid first
        ids.sort(function (a, b) { return rank(b) - rank(a); });
        var nAcc = ids.filter(function (id) { return isAcc(st.status[id]); }).length;
        return '<div data-watch-brief><div class="iba-ai-sub"><i class="fa-solid fa-bell"></i> Watching (' + ids.length + ')' + (nAcc ? ' · ' + nAcc + ' reached Accounts' : '') + '</div>' +
            '<div class="iba-ai-ttab-wrap"><div class="iba-ai-ttab-site"><ul class="iba-ai-rows iba-ai-remlist iba-ai-ttab is-rem iba-watch-list">' +
            '<li class="iba-ai-ttab-head" aria-hidden="true"><span class="c-po">PO</span><span class="c-site">Vendor · site</span><span class="c-main">Invoice · where it is now</span><span class="c-age"></span><span class="c-act"></span></li>' +
            ids.map(function (id) {
                var w = st.list[id] || {};
                var s = st.status[id];
                var tone = isPaid(s) ? 'is-paid' : isAcc(s) ? 'is-acc' : '';
                var label = s === '__gone' ? 'Not found (deleted?)' : (s || 'Checking…');
                return '<li class="' + tone + '"><span class="c-po"><b class="iba-watch-pono">' + esc(w.po) + '</b></span>' +
                    '<span class="c-site"><b>' + esc(w.vendor || '—') + '</b><small>' + esc(w.site ? 'Site ' + w.site : '') + '</small></span>' +
                    '<span class="iba-ai-grow c-main">' + esc([w.inv, w.value ? 'QAR ' + money(w.value) : ''].filter(Boolean).join(' · ')) + ' <span class="iba-watch-st ' + tone + '">' + esc(label) + '</span></span><span class="c-age"></span>' +
                    '<span class="c-act">' + (isAcc(s) ? '<button type="button" class="iba-ai-mini" data-watch-ask="' + esc(id) + '"><i class="fa-regular fa-paper-plane"></i> Ask Accounts</button>' : '') +
                    '<button type="button" class="iba-ai-mini" data-watch-stop="' + esc(id) + '" title="Stop watching this invoice"><i class="fa-solid fa-bell-slash"></i> Stop</button></span></li>';
            }).join('') + '</ul></div></div></div>';
    }
    function rank(id) { var s = st.status[id]; return isAcc(s) ? 2 : isPaid(s) ? 1 : 0; }

    // ---- receipt button ------------------------------------------------------------
    function btnInner(on) { return on ? '<i class="fa-solid fa-check"></i> Watching · stop' : '<i class="fa-regular fa-bell"></i> Notify me'; }
    function btnTitle(on) { return on ? 'You will be told when it reaches With Accounts. Press to stop.' : 'Tell me when this invoice reaches With Accounts'; }
    function btnHtml(info) {
        var on = !!st.list[idOf(info.po, info.key)];
        return '<button type="button" class="iba-trk-btn iba-watch-btn' + (on ? ' is-on' : '') + '" title="' + esc(btnTitle(on)) + '" data-watch-btn="' + esc(JSON.stringify(info)) + '">' + btnInner(on) + '</button>';
    }
    function setBtn(b) {
        var info = {};
        try { info = JSON.parse(b.getAttribute('data-watch-btn')) || {}; } catch (_) {}
        var on = !!st.list[idOf(info.po, info.key)];
        b.classList.toggle('is-on', on);
        b.innerHTML = btnInner(on);
        b.title = btnTitle(on);
    }

    // ---- clicks -----------------------------------------------------------------------
    document.addEventListener('click', function (e) {
        var t = e.target.closest && e.target.closest('[data-watch-btn],[data-watch-stop],[data-watch-ask],[data-watch-mail],[data-watch-wa],[data-watch-seen],[data-watch-close],#iba-watch-pill');
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        if (t.id === 'iba-watch-pill') return openBox();
        if (t.hasAttribute('data-watch-close')) return closeBox();
        if (t.hasAttribute('data-watch-btn')) {
            var info = {};
            try { info = JSON.parse(t.getAttribute('data-watch-btn')) || {}; } catch (_) {}
            t.disabled = true;
            toggle(info).then(function () { t.disabled = false; setBtn(t); });
            return;
        }
        var id = t.getAttribute('data-watch-stop') || t.getAttribute('data-watch-ask') || t.getAttribute('data-watch-mail') || t.getAttribute('data-watch-wa') || t.getAttribute('data-watch-seen');
        var w = st.list[id];
        if (!w) return;
        if (t.hasAttribute('data-watch-stop')) return toggle({ po: w.po, key: w.key });
        if (t.hasAttribute('data-watch-ask')) return openBox(id);
        if (t.hasAttribute('data-watch-mail')) return sendEmail(w);
        if (t.hasAttribute('data-watch-wa')) return sendWhatsApp(w);
        if (t.hasAttribute('data-watch-seen')) {
            markSeen(id).then(function () {
                var item = t.closest('.iba-watch-item');
                if (item) item.remove();
                var box = $('iba-watch-pop');
                if (box && !box.querySelector('.iba-watch-item')) closeBox();
            });
        }
    }, true);

    // ---- start after sign-in, stop on sign-out ---------------------------------------
    function tick() {
        var k = myKey();
        if (k !== st.user) {
            st.user = k;
            st.list = {}; st.status = {}; st.loaded = false; st.checkedAt = 0;
            closeBox();
            if (k) load(); else paint();
            return;
        }
        if (k && st.loaded && document.visibilityState !== 'hidden') check(false);
        badges();
    }
    setInterval(tick, 3000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && st.loaded) check(false); });

    window.ibaWatch = {
        btnHtml: btnHtml,
        briefHtml: briefHtml,
        isOn: function (po, key) { return !!st.list[idOf(po, key)]; },
        refresh: function () { return check(true); },
        open: openBox
    };
})();
