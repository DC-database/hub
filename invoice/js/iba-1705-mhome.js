/* ==========================================================================
   js/iba-1705-mhome.js — 17.0.5 patch 117
   Phone Home (martin approved mock-up, Nov 2026). Phone workspace only
   (#iba-phone, js/iba-phone.js tab "home"); the PC never runs this page.
   - Approver: gold bar "N waiting for your approval · M urgent" -> Approve tab.
   - "Where is my invoice?" search: PO or vendor, same search as the assistant
     (window.ibaTrack.search: your sites only, reads one PO at a time).
   - 4 counters, each opens its list: Active task / Active job (the same lists
     as the PC top bar), Returned (Tell me when they act), Accounts (Notify me
     invoices that reached With Accounts / Paid).
   - Invoice view: PO left, Site right, vendor, invoice / value / date / with,
     View invoice / SRV, "Where it is" steps.
   - Look only: nothing can be changed here. Tasks are done on the PC.
     "Ask about this" opens Messages to the person, with the PO written in.
   Downloads: nothing new on Home; a tap on an invoice reads that PO only.
   ========================================================================== */
(function () {
    'use strict';
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const STEPS = ['Received', 'Entered', 'SRV', 'Approval', 'With Accounts', 'Paid'];
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    const st = { view: 'home', list: '', status: '', inv: null, find: null, q: '', busy: false, back: [] };
    let pane = null;

    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } }
    function myName() { const a = me(); return a ? String(a.Name || '').trim() : ''; }
    function P() { return window.ibaPhone || null; }
    function money(v) {
        if (v === undefined || v === null || v === '') return '';
        const n = Number(String(v).replace(/,/g, ''));
        return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
    }
    function shortDate(v) {
        if (!v) return '';
        if (typeof window.ibaDay === 'function') return window.ibaDay(v); // 17.0.5 p157
        if (window.ibaIeUi && typeof window.ibaIeUi.shortDate === 'function') { try { return window.ibaIeUi.shortDate(v); } catch (_) {} }
        const d = new Date(typeof v === 'number' ? v : String(v));
        return isNaN(d) ? String(v) : String(d.getDate()).padStart(2, '0') + '-' + MON[d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
    }
    function ago(t) {
        t = Number(t) || 0;
        if (!t) return '';
        const d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? 'today' : d + ' day' + (d === 1 ? '' : 's');
    }
    function tone(s) {
        const x = norm(s);
        if (x === 'paid') return 'paid';
        if (x === 'with accounts') return 'acc';
        if (/reject|hold|cancel/.test(x)) return 'stop';
        if (/approval|approved|^report/.test(x)) return 'apv';
        if (/srv/.test(x)) return 'srv';
        if (/new entry|pending|reception|under review|in process/.test(x)) return 'new';
        return 'oth';
    }
    function chip(s) { return s ? '<span class="iba-mh-chip is-' + tone(s) + '">' + esc(s) + '</span>' : ''; }
    // site code as written: digits, sometimes a letter in front (M40)
    function siteCode(v) { const t = String(v == null ? '' : v); const m = t.match(/\b[A-Za-z]?\d+/) || t.match(/\d+/); return m ? m[0].toUpperCase() : t.replace(/^site\s*/i, ''); }
    function greet() {
        const h = new Date().getHours();
        return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    }

    // ---- data -----------------------------------------------------------
    function live() { try { return (window.ibaLiveCounts && window.ibaLiveCounts.items()) || null; } catch (_) { return null; } }
    function tasks() {
        const l = live();
        const t = (l && l.tasks) ? l.tasks.slice() : [];
        t.sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
        return t;
    }
    function jobs() { const l = live(); return (l && l.jobs) ? l.jobs.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)) : []; }
    function rets() { try { return (window.ibaReturnBell && window.ibaReturnBell.items) ? window.ibaReturnBell.items() : []; } catch (_) { return []; } }
    function accs() {
        try {
            const l = (window.ibaWatch && window.ibaWatch.items) ? window.ibaWatch.items() : [];
            return l.filter((w) => /^(with accounts|paid)$/i.test(String(w.status || '').trim())).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
        } catch (_) { return []; }
    }
    function counts() {
        const l = live();
        const t = tasks(), j = jobs();
        return {
            task: Math.max(l && l.counts ? Number(l.counts.task) || 0 : 0, t.length),
            job: Math.max(l && l.counts ? Number(l.counts.job) || 0 : 0, j.length),
            ret: rets().filter((r) => !r.seen).length || rets().length,
            acc: accs().length
        };
    }
    function apv() { try { return P() && P().approvals ? P().approvals() : { list: [], qs: [], urgent: 0 }; } catch (_) { return { list: [], qs: [], urgent: 0 }; } }

    // ---- pieces ---------------------------------------------------------
    // 17.0.5 patch 170: For Approval invoices can be approved on the phone -> open Approve
    function isApvTask(t) { return !!t && (t.kind === 'invoice' || (t.po && /invoice/i.test(t.type || ''))) && norm(t.status) === 'for approval'; }
    function taskCard(t, i, src) {
        const isInv = t.kind === 'invoice' || (t.po && /invoice/i.test(t.type || ''));
        const apv = isApvTask(t);
        return '<button type="button" class="iba-mh-card' + (apv ? ' is-apv' : '') + '" ' + (apv ? 'data-mh-apv' : 'data-mh-open') + '="' + esc(src) + ':' + i + '">' +
            '<span class="iba-mh-po">' + (t.po ? 'PO ' + esc(t.po) : esc(t.type || 'Job') + (t.ref ? ' ' + esc(t.ref) : '')) + '</span>' +
            '<span class="iba-mh-val">' + esc(money(t.amount)) + '</span>' +
            '<span class="iba-mh-ven">' + esc(t.vendor || (isInv ? '' : t.type) || '—') + '</span>' +
            '<span class="iba-mh-age">' + esc(ago(t.at)) + '</span>' +
            '<span class="iba-mh-foot">' + chip(t.status) + (t.site ? '<span class="iba-mh-site">Site ' + esc(siteCode(t.site)) + '</span>' : '') +
            (apv ? '<span class="iba-mh-pc is-apv"><i class="fa-solid fa-check"></i> approve here</span>' : '<span class="iba-mh-pc"><i class="fa-solid fa-desktop"></i> do it on PC</span>') + '</span></button>';
    }
    function goApprove(t) {
        const ph = P();
        if (!ph) return;
        ph.setSide('invoice'); ph.setTab('approve');
        const A = window.ibaApprovals;
        let n = 0;
        const find = () => {
            const a = ph.approvals && ph.approvals();
            if (!a || a.loading) return null;
            const ref = norm(t.ref || t.inv || t.invoice_no || '');
            return a.list.find((x) => String(x.key || '') === String(t.key || '')) ||
                a.list.find((x) => String(x.po || '') === String(t.po || '') && (!ref || norm(x.invNumber) === ref)) ||
                a.list.find((x) => String(x.po || '') === String(t.po || '')) || (a.list.length ? false : null);
        };
        const step = () => {
            const it = find();
            if (it === null && ++n < 25) { setTimeout(step, 300); return; }
            if (!it) return;
            const urg = A && A.isUrgent && A.isUrgent(it) ? 'urgent' : 'normal';
            const tab = document.querySelector('#iba-phone [data-act="inv-urg"][data-urg="' + urg + '"]');
            if (tab && !tab.classList.contains('is-on')) tab.click();
            setTimeout(() => {
                const btn = document.querySelector('#iba-phone [data-act="inv-approve"][data-key="' + (window.CSS && CSS.escape ? CSS.escape(it.key) : it.key) + '"]');
                const card = btn && btn.closest('.iba-ph-card');
                if (!card) return;
                try { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
                card.classList.add('is-flash');
                setTimeout(() => card.classList.remove('is-flash'), 2400);
            }, 120);
        };
        setTimeout(step, 150);
    }
    function invCard(w, i, src, label) {
        return '<button type="button" class="iba-mh-card" data-mh-open="' + esc(src) + ':' + i + '">' +
            '<span class="iba-mh-po">PO ' + esc(w.po) + '</span>' +
            '<span class="iba-mh-val">' + esc(money(w.value)) + '</span>' +
            '<span class="iba-mh-ven">' + esc(w.vendor || '—') + '</span>' +
            '<span class="iba-mh-age">' + esc(w.inv || '') + '</span>' +
            '<span class="iba-mh-foot">' + (label || '') + chip(w.status) + '</span></button>';
    }
    function jobCard(j, i) {
        return '<button type="button" class="iba-mh-card" data-mh-open="job:' + i + '">' +
            '<span class="iba-mh-po">' + esc(j.control || j.key) + '</span>' +
            '<span class="iba-mh-val">' + esc(j.qty ? 'Qty ' + j.qty : '') + '</span>' +
            '<span class="iba-mh-ven">' + esc(j.product || j.type || '—') + '</span>' +
            '<span class="iba-mh-age">' + esc(ago(j.at)) + '</span>' +
            '<span class="iba-mh-foot">' + chip(j.step || j.type) + ((j.from || j.to) ? '<span class="iba-mh-site">' + esc((j.from || '?') + ' → ' + (j.to || '?')) + '</span>' : '') +
            '<span class="iba-mh-pc"><i class="fa-solid fa-desktop"></i> do it on PC</span></span></button>';
    }
    function back(label) { return '<button type="button" class="iba-mh-back" data-mh-back><i class="fa-solid fa-chevron-left"></i> ' + esc(label || 'Back') + '</button>'; }
    function empty(txt) { return '<div class="iba-ph-empty"><i class="fa-solid fa-circle-check"></i><p>' + esc(txt) + '</p></div>'; }

    // ---- views ----------------------------------------------------------
    function homeHtml() {
        const a = apv(), c = counts(), t = tasks();
        const n = a.list.length + a.qs.length;
        const stk = P() && P().inventoryWaiting ? P().inventoryWaiting() : 0;
        const first = myName().split(/[\s.]+/)[0] || '';
        // 17.0.5 patch 162 (martin): Home kept clean - no greeting, no waiting rows, no search box.
        // The date sits in the top bar; the Approve tab badge shows what is waiting.
        let h = '';
        if (false && n) h += '<button type="button" class="iba-mh-apv" data-mh-go="approve"><b>' + n + '</b><span>waiting for your approval</span>' +
            (a.urgent ? '<i class="iba-mh-urg">' + a.urgent + ' urgent</i>' : '') + '<i class="fa-solid fa-chevron-right"></i></button>';
        if (false && stk) h += '<button type="button" class="iba-mh-apv is-stk" data-mh-go="inventory"><b>' + stk + '</b><span>inventory waiting for you</span><i class="fa-solid fa-chevron-right"></i></button>';
        if (false) h += '<form class="iba-mh-find" data-mh-find autocomplete="off"><i class="fa-solid fa-magnifying-glass"></i>' +
            '<input type="search" id="iba-mh-q" placeholder="Where is my invoice? PO or vendor" enterkeyhint="search" value="' + esc(st.q) + '">' +
            (st.q ? '<button type="button" class="iba-mh-x" data-mh-clear aria-label="Clear">×</button>' : '') + '</form>';
        if (false) h += '<div class="iba-mh-found" id="iba-mh-found">' + foundHtml() + '</div>';
        h += '<div class="iba-mh-counts">' +
            cnt('task', c.task, 'Active task') + cnt('job', c.job, 'Active job') + cnt('ret', c.ret, 'Returned') + cnt('acc', c.acc, 'Accounts') + '</div>';
        h += '<div class="iba-mh-head"><b>My tasks</b>' + (t.length ? '<span>' + t.length + '</span>' : '') + '</div>';
        h += t.length ? groupsHtml(t) : empty('No tasks for you right now.');
        h += '<p class="iba-mh-note">Tasks are done on the PC. Here you can see them, open the invoice and ask.</p>';
        return h;
    }
    // 17.0.5 patch 158: My tasks grouped by status (martin). Groups in order of
    // their newest task; one task = just the card, more = first 2 + "See all".
    function groupsHtml(t) {
        const groups = [];
        const byKey = {};
        t.forEach((x, i) => {
            const label = String(x.status || 'Other').trim() || 'Other';
            const k = norm(label);
            if (!byKey[k]) { byKey[k] = { label: label, items: [] }; groups.push(byKey[k]); }
            byKey[k].items.push([x, i]);
        });
        return '<div class="iba-mh-groups">' + groups.map((g) => {
            const n = g.items.length;
            const attr = ' data-mh-list="task" data-mh-status="' + esc(g.label) + '"';
            return '<div class="iba-mh-grp is-' + tone(g.label) + '">' +
                '<button type="button" class="iba-mh-gh"' + (n > 2 ? attr : ' tabindex="-1"') + '><i class="iba-mh-dot"></i><b>' + esc(g.label) + '</b><span class="iba-mh-gn">' + n + '</span>' + (n > 2 ? '<i class="fa-solid fa-chevron-right"></i>' : '') + '</button>' +
                g.items.slice(0, 2).map((p) => taskCard(p[0], p[1], 'task')).join('') +
                (n > 2 ? '<button type="button" class="iba-mh-more"' + attr + '>See all ' + n + ' ' + esc(g.label) + ' <i class="fa-solid fa-chevron-right"></i></button>' : '') +
                '</div>';
        }).join('') + '</div>';
    }
    function cnt(k, n, label) {
        return '<button type="button" class="iba-mh-cnt is-' + k + '" data-mh-list="' + k + '"><b>' + n + '</b><span>' + esc(label) + '</span></button>';
    }
    const LISTS = {
        task: { title: 'Active task', note: 'Tap one to see it. For Approval opens Approve.', get: tasks, card: (x, i) => taskCard(x, i, 'task'), none: 'No tasks for you right now.' },
        job: { title: 'Active job', note: 'Inventory jobs waiting for you. Do them on the PC.', get: jobs, card: jobCard, none: 'No inventory jobs for you.' },
        ret: { title: 'Returned', note: 'Invoices you sent with "Tell me when they act" that someone acted on.', get: rets, card: (x, i) => invCard(x, i, 'ret', x.sent ? '<span class="iba-mh-site">' + esc(x.sent) + ' →</span>' : ''), none: 'Nothing came back yet.' },
        acc: { title: 'Accounts', note: 'Invoices you follow (Notify me) that reached Accounts. Accounts pay on Saturday and Tuesday.', get: accs, card: (x, i) => invCard(x, i, 'acc'), none: 'None of the invoices you follow reached Accounts yet.' }
    };
    function listHtml(k) {
        const L = LISTS[k];
        const all = L.get();
        const f = k === 'task' && st.status ? norm(st.status) : '';
        const l = all.map((x, i) => [x, i]).filter((p) => !f || norm(String(p[0].status || 'Other').trim() || 'Other') === f);
        // p163: the note sits in the title bar, small and italic (no extra card)
        return back('Home') + '<div class="iba-mh-head is-big"><b>' + esc(f ? st.status : L.title) + '</b><em class="iba-mh-hnote">' + esc(L.note) + '</em><span>' + l.length + '</span></div>' +
            (l.length ? '<div class="iba-mh-cards">' + l.map((p) => L.card(p[0], p[1])).join('') + '</div>' : empty(L.none));
    }
    function foundHtml() {
        const f = st.find;
        if (!f) return '';
        if (f.loading) return '<div class="iba-ph-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Looking…</p></div>';
        if (f.error) return '<div class="iba-ph-empty is-error"><i class="fa-solid fa-circle-info"></i><p>' + esc(f.error) + '</p></div>';
        if (f.mode === 'suggest') return '<div class="iba-mh-sugg"><p>' + esc(f.message || 'Did you mean:') + '</p>' + (f.suggestions || []).map((s) => '<button type="button" data-mh-sugg="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>';
        if (f.mode !== 'pos') return '<div class="iba-ph-empty"><i class="fa-solid fa-circle-info"></i><p>' + esc(f.message || 'Nothing found.') + '</p></div>';
        return (f.pos || []).map((p, pi) => '<div class="iba-mh-pobox"><div class="iba-mh-pohead"><b>PO ' + esc(p.po) + '</b>' + (p.site ? '<span>Site ' + esc(siteCode(p.site)) + '</span>' : '') + '</div>' +
            '<div class="iba-mh-poven">' + esc(p.vendor || '') + '</div>' +
            ((p.items || []).length ? (p.items || []).map((it, ii) => '<button type="button" class="iba-mh-row" data-mh-found="' + pi + ':' + ii + '">' +
                '<span class="iba-mh-rno">' + esc(it.invoice_no || '—') + '</span><span class="iba-mh-rval">' + esc(it.value || '') + '</span>' +
                '<span class="iba-mh-rst">' + chip(it.side_status || it.status) + '</span><span class="iba-mh-rdt">' + esc(shortDate(it.invoice_date || it.entered || '')) + '</span></button>').join('')
                : '<p class="iba-mh-note">No invoices on this PO yet.</p>') + '</div>').join('') +
            (f.more ? '<p class="iba-mh-note">' + f.more + ' older POs not shown. Type the PO number to see one.</p>' : '');
    }
    function stepsHtml(it) {
        const cur = Number(it.stage_index);
        const side = it.side_status;
        const hist = it.steps || [];
        const when = (i) => {
            if (i === 5 && it.paid_on) return it.paid_on;
            if (i === 4 && it.with_accounts_on) return it.with_accounts_on;
            if (i === 0 && it.entered) return it.entered;
            return '';
        };
        return '<ol class="iba-mh-steps">' + STEPS.map((s, i) => {
            const done = i < cur || (i === cur && i === 5);
            const now = i === cur && i !== 5;
            let sub = '';
            if (now) sub = [it.with ? 'with ' + it.with : '', it.since ? 'since ' + shortDate(it.since) : '', it.days !== undefined ? '(' + (it.days === 0 ? 'today' : it.days + ' day' + (it.days === 1 ? '' : 's')) + ')' : ''].filter(Boolean).join(' · ');
            else if (done) sub = shortDate(when(i));
            else if (i === cur + 1) sub = 'next';
            const name = now ? (side ? side : (it.status || s)) : s;
            return '<li class="' + (done ? 'is-done' : now ? 'is-now' + (side ? ' is-stop' : '') : '') + '"><b>' + esc(name) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</li>';
        }).join('') + '</ol>' +
            (hist.length ? '<details class="iba-mh-hist"><summary>History (' + hist.length + ')</summary><ul>' + hist.slice().reverse().map((h) =>
                '<li><b>' + esc(h.status || '') + '</b><span>' + esc([h.by, shortDate(h.date)].filter(Boolean).join(' · ')) + '</span></li>').join('') + '</ul></details>' : '');
    }
    function invHtml() {
        const v = st.inv;
        if (!v) return back('Back') + empty('Nothing to show.');
        if (v.loading) return back('Back') + '<div class="iba-ph-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Opening PO ' + esc(v.po) + '…</p></div>';
        const it = v.item, t0 = v.task || {};
        const p = Object.assign({}, v.p || {});
        if (!p.vendor) p.vendor = t0.vendor || v.vendor || '';
        if (!p.site) p.site = t0.site || v.site || '';
        if (!it) {
            // a WorkDesk job (not an invoice yet) or not found
            const t = v.task || {};
            return back('Back') + '<div class="iba-mh-inv"><div class="iba-mh-ivtop"><b>' + esc(t.po ? 'PO ' + t.po : (t.type || 'Job')) + '</b>' + (t.site ? '<span>Site ' + esc(siteCode(t.site)) + '</span>' : '') + '</div>' +
                '<div class="iba-mh-ivven">' + esc(t.vendor || t.product || '') + '</div>' +
                '<div class="iba-mh-facts">' + fact('Job', t.type || '—') + fact('Value', money(t.amount) || '—', 1) + fact('Ref', t.ref || t.control || '—') + fact('Status', t.status || t.step || '—', 1) + '</div>' +
                (t.note ? '<p class="iba-mh-note">' + esc(t.note) + '</p>' : '') + '</div>' +
                (v.error ? '<p class="iba-mh-note">' + esc(v.error) + '</p>' : '') +
                mine(t) + askBtn();
        }
        return back('Back') + '<div class="iba-mh-inv"><div class="iba-mh-ivtop"><b>PO ' + esc(p.po || v.po) + '</b>' + (p.site ? '<span>Site ' + esc(siteCode(p.site)) + '</span>' : '') + '</div>' +
            '<div class="iba-mh-ivven">' + esc(p.vendor || '') + '</div>' +
            '<div class="iba-mh-facts">' + fact('Invoice', it.invoice_no || '—') + fact('Value', it.value ? 'QAR ' + it.value : '—', 1) +
            fact('Invoice date', shortDate(it.invoice_date) || '—') + fact('With', [it.with, it.side_status || it.status].filter(Boolean).join(' · ') || '—', 1, 'is-gold') + (it.release ? fact('Release date', shortDate(it.release)) : '') + '</div></div>' +
            '<div class="iba-mh-files">' + (it.pdf ? '<a href="' + esc(it.pdf) + '" target="_blank" rel="noopener"><i class="fa-regular fa-file-pdf"></i> View invoice</a>' : '<span class="is-off">No invoice file</span>') +
            (it.srv ? '<a href="' + esc(it.srv) + '" target="_blank" rel="noopener"><i class="fa-regular fa-file-lines"></i> SRV</a>' : '<span class="is-off">SRV (not yet)</span>') + '</div>' +
            '<div class="iba-mh-head"><b>Where it is</b></div>' + stepsHtml(it) +
            mine({ attention: it.with, status: it.side_status || it.status }) + askBtn();
    }
    function fact(l, v, right, cls) { return '<div class="iba-mh-fact' + (right ? ' is-r' : '') + '"><span>' + esc(l) + '</span><b class="' + (cls || '') + '">' + esc(v) + '</b></div>'; }
    function mine(t) {
        const a = norm(t && t.attention);
        if (!a || a !== norm(myName())) return '';
        return '<p class="iba-mh-yours"><i class="fa-solid fa-desktop"></i> This task is yours: open the PC to do it' + (t.status ? ' (' + esc(t.status) + ')' : '') + '.</p>';
    }
    function askBtn() {
        const who = askWho();
        return '<button type="button" class="iba-mh-ask" data-mh-ask><i class="fa-regular fa-comments"></i> Ask about this' + (who ? ' <small>to ' + esc(who) + '</small>' : '') + '</button>' +
            '<p class="iba-mh-note">Ask a question, e.g. "should this be 2 invoices?". Changes are made on the PC.</p>';
    }

    // ---- Ask about this -----------------------------------------------------
    // who sent it to me: the last person in the history who is not me, else
    // whoever entered the job
    function askWho() {
        const v = st.inv;
        if (!v) return '';
        const mine = norm(myName());
        const hist = (v.item && v.item.steps) || [];
        for (let i = hist.length - 1; i >= 0; i--) { const b = String(hist[i].by || '').trim(); if (b && norm(b) !== mine && !/^system$/i.test(b)) return b; }
        const raw = v.raw || {};
        const e = String(raw.enteredBy || raw.updatedBy || raw.createdBy || '').trim();
        if (e && norm(e) !== mine) return e;
        const w = v.item && v.item.with;
        if (w && norm(w) !== mine && !/^accounts$/i.test(w)) return w;
        return '';
    }
    function userByName(name) {
        let list = [];
        try { list = (typeof allUsersData !== 'undefined' && Array.isArray(allUsersData)) ? allUsersData : []; } catch (_) {}
        const n = norm(name);
        const hits = list.filter((u) => u && u.key && norm(u.Name) === n && norm(u.Status) !== 'disabled');
        return hits.length === 1 ? hits[0] : null; // same-name users: let the person pick
    }
    function askText() {
        const v = st.inv || {};
        const it = v.item, p = v.p || {}, t = v.task || {};
        const parts = ['PO ' + (p.po || v.po || t.po || '')];
        if (it && it.invoice_no && it.invoice_no !== '—') parts.push('Invoice ' + it.invoice_no);
        const ven = p.vendor || t.vendor;
        if (ven) parts.push(ven);
        const s = it ? (it.side_status || it.status) : (t.status || '');
        if (s) parts.push(s);
        return 'About ' + parts.filter((x) => x && x !== 'PO ').join(' · ') + ': ';
    }
    function ask() {
        const text = askText();
        const u = userByName(askWho());
        try {
            if (u && typeof dmOpenThread === 'function') dmOpenThread(u.key, u.Name);
            else if (P() && P().openMessages) P().openMessages();
            else if (typeof dmOpen === 'function') dmOpen();
        } catch (e) { console.warn('[mhome] ask', e); }
        const fill = () => { const i = document.getElementById('dm-input'); if (i && !String(i.value || '').trim()) { i.value = text; try { i.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {} } };
        fill(); setTimeout(fill, 250); setTimeout(fill, 900);
    }

    // ---- open an invoice ------------------------------------------------------
    async function openInv(po, key, extra) {
        st.back.push({ view: st.view, list: st.list });
        st.view = 'inv';
        st.inv = Object.assign({ po: String(po || ''), key: String(key || ''), loading: !!po }, extra || {});
        paint();
        if (!po) { st.inv.loading = false; paint(); return; }
        try {
            if (!window.ibaTrack) throw new Error('not ready');
            const r = await window.ibaTrack.search({ po: po });
            if (st.inv.po !== String(po)) return;
            if (r && r.mode === 'pos' && r.pos && r.pos[0]) {
                const p = r.pos[0];
                const items = p.items || [];
                let it = key ? items.find((x) => String(x.key || '') === String(key)) : null;
                if (!it && !key && extra && extra.task && extra.task.ref) it = items.find((x) => norm(x.invoice_no) === norm(extra.task.ref));
                st.inv.p = p;
                st.inv.item = it || null;
                if (!it && extra && extra.task) st.inv.error = '';
                else if (!it) st.inv.error = 'This invoice is no longer on PO ' + po + '.';
            } else if (r) st.inv.error = r.message || '';
        } catch (e) { st.inv.error = 'Could not open PO ' + po + '. Tap refresh to try again.'; }
        st.inv.loading = false;
        paint();
    }
    function openFrom(src, i) {
        if (src === 'task') {
            const t = tasks()[i];
            if (!t) return;
            if (t.kind === 'invoice') {
                const key = t.key.indexOf(t.po + '_') === 0 ? t.key.slice(t.po.length + 1) : t.key;
                return openInv(t.po, key, { task: t });
            }
            let raw = null;
            try { if (Array.isArray(window.workdeskSystemEntries)) raw = window.workdeskSystemEntries.find((e) => e && String(e.key) === String(t.key)); } catch (_) {}
            try { if (!raw && typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries)) raw = workdeskSystemEntries.find((e) => e && String(e.key) === String(t.key)); } catch (_) {}
            // a WorkDesk job: show the job; the invoice only when it is an invoice job with a ref
            return openInv(/invoice/i.test(t.type || '') && t.po ? t.po : '', '', { task: t, raw: raw || {} });
        }
        if (src === 'job') { const j = jobs()[i]; if (j) openInv('', '', { task: Object.assign({ type: j.type, status: j.step, ref: j.control, product: j.product, amount: '' }, j) }); return; }
        const l = src === 'ret' ? rets() : accs();
        const w = l[i];
        if (w) openInv(w.po, w.key, { vendor: w.vendor, site: w.site });
    }

    // ---- search -----------------------------------------------------------------
    async function find(q) {
        q = String(q || '').trim();
        st.q = q;
        if (!q) { st.find = null; paint(); return; }
        const po = /^\d{3,}$/.test(q.replace(/\s/g, '')) ? q.replace(/\s/g, '') : '';
        st.find = { loading: true };
        paint();
        try {
            if (!window.ibaTrack) throw new Error('Search is still loading. Try again in a moment.');
            const r = await window.ibaTrack.search(po ? { po: po } : { vendor: q });
            if (st.q !== q) return;
            st.find = r || { mode: 'none', message: 'Nothing found.' };
            if (r && r.mode === 'error') st.find = { error: r.message };
        } catch (e) { st.find = { error: (e && e.message) || 'Search failed.' }; }
        paint();
        const box = document.getElementById('iba-mh-found');
        if (box && box.scrollIntoView) try { box.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {}
    }

    // ---- paint / events ---------------------------------------------------------
    function paint() {
        if (!pane) return;
        const keepY = (pane.closest('.iba-ph-main') || {}).scrollTop;
        let h = '';
        if (st.view === 'list' && LISTS[st.list]) h = listHtml(st.list);
        else if (st.view === 'inv') h = invHtml();
        else { st.view = 'home'; h = homeHtml(); }
        look();
        const sig = st.view + '|' + h;
        if (pane.__mhSig === sig) return;
        // never repaint under the person's typing
        const ae = document.activeElement;
        if (ae && ae.id === 'iba-mh-q' && st.view === 'home' && pane.contains(ae) && !st.busy) {
            const box = document.getElementById('iba-mh-found');
            if (box) box.innerHTML = foundHtml();
            return;
        }
        pane.__mhSig = sig;
        pane.innerHTML = '<div class="iba-mh">' + h + '</div>';
        const main = pane.closest('.iba-ph-main');
        if (main && st.view === pane.__mhView && typeof keepY === 'number') main.scrollTop = keepY;
        else if (main) main.scrollTop = 0;
        pane.__mhView = st.view;
    }
    function render(p) {
        pane = p;
        if (!p.__mhWired) {
            p.__mhWired = true;
            p.addEventListener('click', onClick);
            // p162: leaving the Active job list by the switch or the Home tab goes back to Home
            document.addEventListener('click', (e) => {
                const t = e.target && e.target.closest && e.target.closest('#iba-ph-switch [data-side], #iba-ph-tabs [data-tab="home"]');
                if (!t) return;
                // p163: the bottom Home button always goes back to Home (from any list or invoice)
                const homeBtn = t.matches('[data-tab="home"]');
                if ((homeBtn && st.view !== 'home') || (st.view === 'list' && st.list === 'job')) {
                    st.view = 'home'; st.list = ''; st.status = ''; st.inv = null; st.back = []; pane.__mhSig = '';
                    setTimeout(paint, 0);
                }
            }, true);
            p.addEventListener('submit', (e) => {
                if (!e.target.closest('[data-mh-find]')) return;
                e.preventDefault();
                const i = document.getElementById('iba-mh-q');
                try { i && i.blur(); } catch (_) {}
                find(i ? i.value : '');
            });
            p.addEventListener('input', (e) => { if (e.target && e.target.id === 'iba-mh-q' && !e.target.value) { st.q = ''; st.find = null; } });
        }
        pane.__mhSig = '';
        paint();
    }
    // 17.0.5 patch 162: Active job is inventory work, so its list shows in the
    // pink Inventory look (switch on Inventory). Back / Home / Invoice return.
    function look() {
        try {
            const root = document.getElementById('iba-phone');
            if (!root || !pane || !pane.classList.contains('is-on')) return;
            const real = (P() && P().state) ? P().state().side : 'invoice';
            const side = (st.view === 'list' && st.list === 'job') ? 'inventory' : real;
            root.setAttribute('data-side', side);
            root.querySelectorAll('.iba-ph-switch [data-side]').forEach((b) => b.classList.toggle('is-on', b.getAttribute('data-side') === side));
        } catch (_) {}
    }
    function onClick(e) {
        const t = e.target;
        let b;
        if ((b = t.closest('[data-mh-back]'))) { const prev = st.back.pop() || { view: 'home' }; st.view = prev.view; st.list = prev.list || ''; if (st.view === 'home') st.status = ''; if (st.view !== 'inv') st.inv = null; paint(); return; }
        if ((b = t.closest('[data-mh-go]'))) {
            const g = b.getAttribute('data-mh-go');
            if (g === 'approve' && P()) P().setTab('approve');
            if (g === 'inventory' && P()) { P().setSide('inventory'); P().setTab('approve'); }
            return;
        }
        if ((b = t.closest('[data-mh-list]'))) { st.back = [{ view: 'home' }]; st.view = 'list'; st.list = b.getAttribute('data-mh-list'); st.status = b.getAttribute('data-mh-status') || ''; paint(); return; }
        if ((b = t.closest('[data-mh-apv]'))) {
            const x = b.getAttribute('data-mh-apv').split(':');
            const L = LISTS[x[0]];
            const item = L && L.get ? L.get()[Number(x[1])] : null;
            st.view = 'home'; st.list = ''; st.status = ''; st.inv = null; st.back = []; pane.__mhSig = '';
            if (item) goApprove(item);
            return;
        }
        if ((b = t.closest('[data-mh-open]'))) { const x = b.getAttribute('data-mh-open').split(':'); openFrom(x[0], Number(x[1])); return; }
        if ((b = t.closest('[data-mh-found]'))) {
            const x = b.getAttribute('data-mh-found').split(':').map(Number);
            const p = st.find && st.find.pos && st.find.pos[x[0]];
            const it = p && p.items && p.items[x[1]];
            if (!it) return;
            st.back.push({ view: st.view, list: st.list });
            st.view = 'inv';
            st.inv = { po: p.po, key: it.key || '', p: p, item: it, raw: it.entered_by ? { enteredBy: it.entered_by } : {} };
            paint();
            return;
        }
        if ((b = t.closest('[data-mh-sugg]'))) { const v = b.getAttribute('data-mh-sugg'); const i = document.getElementById('iba-mh-q'); if (i) i.value = v; find(v); return; }
        if ((b = t.closest('[data-mh-clear]'))) { st.q = ''; st.find = null; pane.__mhSig = ''; paint(); return; }
        if ((b = t.closest('[data-mh-ask]'))) { ask(); return; }
    }
    function visible() { return !!(pane && pane.classList.contains('is-on') && document.body.classList.contains('iba-phone')); }
    // counters follow the live lists (memory only, nothing is read)
    setInterval(() => { if (visible() && st.view !== 'inv' && document.visibilityState !== 'hidden') paint(); }, 4000);

    window.ibaPhoneHome = {
        render: render,
        refresh: function () {
            try { window.ibaReturnBell && window.ibaReturnBell.refresh(); } catch (_) {}
            try { window.ibaWatch && window.ibaWatch.refresh(); } catch (_) {}
            if (st.view === 'inv' && st.inv && st.inv.po) { const v = st.inv; st.back.pop(); openInv(v.po, v.key, { task: v.task, raw: v.raw }); return; }
            if (st.q) find(st.q); else { if (pane) pane.__mhSig = ''; paint(); }
        },
        _state: st
    };
})();
