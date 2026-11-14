/* 18.0.0 patch 10 (martin, mock-up https://claude.ai/artifact/35PiSWT9UZxGDDjxCkZ3ZW): NEW DASHBOARD.
   The WorkDesk Dashboard becomes one chart of the OPEN work, in the same 3 groups the old cards used:
     01 Preliminary / Work in Progress : For SRV, Pending, On Hold, IPC Application, IPC Processed, For Approval
     02 Approval Area                  : In Process, CEO Approval, For Summary
     03 Finance                        : With Accounts given in the last 7 days (2026 only)
   - Donut with arrow labels (count, %, "★ N yours"). Click a piece = its invoices, yours first ("★ Yours"),
     "Only mine" tick. Admin / Super Admin see every row; normal users see only their own rows.
   - QAR only for the Super Admin and the people allowed in Skill access › "Dashboard: QAR amounts".
   - Super Admin only: "With Accounts over 7 days (2026)" box = invoices Accounts has not marked Paid yet,
     with Mark Paid (the existing pocket routine: With Accounts date + 1 day, Friday -> Saturday).
   - Old cards + My personal tasks are hidden, and the old Dashboard loaders / 30 s recounts do not run.
     Settings › Dashboard › "Show old Dashboard cards" brings them back (system_settings/dash_old_cards).
   Data (no big downloads): invoice_tasks_by_user/All (the small open-task index the old cards read) once per
   visit (kept 3 min), the With Accounts pocket (only for people who already load it), and a tiny
   system_settings/dash_summary/fin node (Finance count written by those people) for everyone else.
   No monthly trend (martin: avoid downloads). PC only.  window.ibaDash2
   18.0.0 patch 11: With Accounts window 60 -> 7 days (Accounts pay Saturday + Tuesday); older = Super box with
   tick boxes + "Mark Paid (N)"; Reception New Entry jobs counted in 01 (from the in-memory Job Records, the saved
   Job Records copy, or the same for=Invoice query the old Dashboard used). */
(function () {
    'use strict';
    if (window.ibaDash2) return;
    const G = [
        // 18.0.0 patch 12 (martin): everything still with us is Work in progress (incl. Report and For Summary,
        // which come back to martin); only In Process + CEO Approval are Approval; Finance = With Accounts only.
        { id: 'wip', n: '01', name: 'Ongoing', short: 'Ongoing', full: 'Preliminary / Work in Progress', sub: 'New Entry, For SRV, SRV Done, Pending, On Hold, IPC, For Approval, Report, For Summary', col: '#2fa7a0', st: [] },
        { id: 'apv', n: '02', name: 'Mgmt Approval', short: 'Mgmt Approval', full: 'Under Management Approval', sub: 'COO (In Process) and CEO (CEO Approval)', col: '#3b6fd8', st: ['in process', 'ceo approval'] },
        { id: 'fin', n: '03', name: 'Fin', full: 'Finance', sub: 'With Accounts (last 7 days)', col: '#c9a44c', st: [] }
    ];
    const YEAR = 2026, DAYS7 = 7 * 86400000, KEEP = 3 * 60000;
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    const call = (name, ...a) => { try { const f = window[name]; return typeof f === 'function' ? f(...a) : undefined; } catch (_) { return undefined; } };
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null; } catch (_) { return null; } }
    function isSuper() { const u = me(); let sn = 'Irwin'; try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) sn = SUPER_ADMIN_NAME; } catch (_) {} return !!(u && norm(u.Name) === norm(sn)); }
    const wide = () => isSuper() || call('wdIsWideAccessUser') === true;
    const seesPocket = () => isSuper() || call('wdCanSeePaymentPocket') === true;
    // QAR: Super Admin always; then the Skill access rule if one is saved; with no rule = Finance / Accounts / CEO positions
    // (18.0.0 patch 12, martin: normal users never see any money)
    function moneyByPosition() { const u = me(); const pos = norm(u && (u.Position || u.position)); return /\b(finance|accounts?|accounting|ceo)\b/.test(pos); }
    // 18.0.0 patch 21 (martin): amounts hidden by default (counts only); money people can switch QAR on
    let showQ = false; // not saved: every reload starts hidden (people may look at the screen)
    function qSwitch() { return money() ? `<label class="iba-d2-qsw"><input type="checkbox" data-d2-qar${showQ ? ' checked' : ''}><span></span>Show QAR</label>` : ''; }
    function money() {
        if (isSuper()) return true;
        let d = null; try { d = window.ibaSkillAccess ? window.ibaSkillAccess.decide('dash_money') : null; } catch (_) {}
        if (d === true || d === false) return d;
        return moneyByPosition();
    }
    const phone = () => document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone');

    // the QAR rule lives in Skill access
    window.ibaSkillAccessExtra = (window.ibaSkillAccessExtra || []).concat([{ id: 'dash_money', name: 'Dashboard: QAR amounts', group: 'Dashboard', desc: 'Who sees money (QAR) on the Dashboard chart and lists. Everyone else sees invoice counts only.', built: 'Super Admin + Finance / Accounts / CEO positions' }]);

    // ---- old cards switch ----
    let oldCards = false;
    try { oldCards = localStorage.getItem('iba-dash-old-v1') === '1'; } catch (_) {}
    let watching = false;
    function watch() {
        if (watching) return; const d = mainDb(); if (!d) { setTimeout(watch, 1500); return; }
        watching = true;
        d.ref('system_settings/dash_old_cards').on('value', (s) => {
            const v = s.val() === true;
            try { localStorage.setItem('iba-dash-old-v1', v ? '1' : '0'); } catch (_) {}
            if (v !== oldCards) { oldCards = v; apply(true); }
            paintSettings();
        });
    }
    const on = () => !oldCards && !phone();

    // ---- stop the old Dashboard loaders while the chart is on ----
    function hook() {
        if (window.__ibaDash2Hooked) return;
        if (typeof window.populateWorkdeskDashboard !== 'function' || typeof window.wdIsDashboardVisible !== 'function') { setTimeout(hook, 800); return; }
        window.__ibaDash2Hooked = 1;
        const pop = window.populateWorkdeskDashboard, vis = window.wdIsDashboardVisible;
        window.populateWorkdeskDashboard = function (force) {
            if (on()) { apply(!!force); return Promise.resolve(); }
            return pop.apply(this, arguments);
        };
        window.wdIsDashboardVisible = function () { return on() ? false : vis.apply(this, arguments); };
    }

    // ---- data ----
    let rows = null, rowsAt = 0, busy = null, pocket = [], finSum = null, paidN = null, err = '';
    function toMs(v) {
        if (v == null || v === '') return 0;
        if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
        const s = String(v).trim();
        if (/^\d{12,}$/.test(s)) return Number(s);
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
        m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
        const t = Date.parse(s); return isNaN(t) ? 0 : t;
    }
    const daysSince = (ms) => ms ? Math.max(0, Math.floor((Date.now() - ms) / 86400000)) : null;
    // martin: not finished (With Accounts / Paid / Closed / Cancelled) and not In Process / CEO Approval = Work in progress
    function done(status) {
        const r = norm(status);
        if (!r) return false;
        if (['with accounts', 'paid', 'closed', 'cancelled', 'canceled', 'completed', 'done', 'deleted', 'removed', 'converted to invoice'].indexOf(r) !== -1) return true;
        return /with accounts|\bpaid\b|cancel|closed/.test(r);
    }
    function groupOf(status) {
        if (done(status)) return null;
        const r = norm(status);
        if (r === 'in process' || r === 'ceo approval') return G[1];
        return G[0];
    }
    function mine(t) {
        const n = call('wdCurrentUserNameNorm');
        const r = call('wdTaskHasAttentionName', t, n);
        if (r !== undefined) return !!r;
        const u = me(); return !!(u && norm(t.attention).split(/[,;/]/).map((x) => x.trim()).indexOf(norm(u.Name)) !== -1);
    }
    async function loadRows(force) {
        if (!force && rows && Date.now() - rowsAt < KEEP) return rows;
        if (busy) return busy;
        const d = invDb(); if (!d) return rows || [];
        busy = (async () => {
            try {
                const all = (await d.ref('invoice_tasks_by_user/All').once('value')).val() || {};
                const out = [];
                Object.keys(all).forEach((k) => {
                    const t = all[k]; if (!t || typeof t !== 'object') return;
                    const status = call('wdCurrentInvoiceTaskStatus', t, null) || t.status || '';
                    const g = groupOf(status); if (!g) return;
                    const at = toMs(t.statusChangedAt) || toMs(t.statusQueueAt) || toMs(t.queueAt) || toMs(t.dateAdded) || toMs(t.enteredAt) || toMs(t.createdAt);
                    out.push({ g: g.id, key: k, po: String(t.po || t.originalPO || ''), inv: String(t.ref || ''), vendor: String(t.vendorName || ''), site: String(t.site || ''), status: String(status), with: String(t.attention || ''), days: daysSince(at), amount: Number(t.amount) || 0, mine: mine(t), urgent: t.urgent === true });
                });
                try { (await newEntries()).forEach((r) => out.push(r)); } catch (e2) { console.warn('[dashboard] new entries not read', e2); }
                rows = out; rowsAt = Date.now(); err = '';
            } catch (e) { console.warn('[dashboard] open tasks not read', e); err = 'Could not read the open tasks. Try Refresh.'; rows = rows || []; }
            busy = null; return rows;
        })();
        return busy;
    }
    // Reception New Entry jobs (01). No new download when the Job Records list is already in memory or saved.
    async function newEntries() {
        let raw = null;
        try { if (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length) { raw = {}; workdeskSystemEntries.forEach((e) => { if (e && e.source === 'job_entry' && e.for === 'Invoice' && e.key) raw[e.key] = e; }); } } catch (_) {}
        if (!raw && typeof window.ibaJobsFromPocketWhere === 'function') raw = await window.ibaJobsFromPocketWhere((v) => v.for === 'Invoice');
        if (!raw) { const d = mainDb(); if (!d) return []; raw = (await d.ref('job_entries').orderByChild('for').equalTo('Invoice').once('value')).val() || {}; }
        const out = [];
        Object.keys(raw).forEach((k) => {
            const j = raw[k]; if (!j || typeof j !== 'object') return;
            if (j.convertedToInvoice || j.archived) return;
            const st = norm(j.remarks || j.status || '');
            if (st && st !== 'new entry') return;
            const at = toMs(j.timestamp) || toMs(j.enteredAt) || toMs(j.dateAdded) || toMs(j.date);
            if (at && new Date(at).getFullYear() < YEAR) return;          // nothing from 2025
            out.push({ g: 'wip', key: 'job:' + k, po: String(j.po || ''), inv: String(j.ref || ''), vendor: String(j.vendorName || ''), site: String(j.site || ''), status: 'New Entry', with: String(j.attention || ''), days: daysSince(at), amount: Number(j.amount) || 0, mine: mine(j), urgent: false });
        });
        return out;
    }
    // With Accounts: only people who already load the pocket (Finance / CEO / Super Admin)
    let pocketHooked = false;
    function hookPocket() {
        if (pocketHooked || !seesPocket()) return;
        const api = window.ibaPaymentPocket; if (!api || typeof api.subscribe !== 'function') return;
        pocketHooked = true;
        try { if (typeof api.ensureLoaded === 'function') api.ensureLoaded(); } catch (_) {}
        try { pocket = (api.getItems && api.getItems()) || []; } catch (_) {}
        api.subscribe((items) => { pocket = Array.isArray(items) ? items : []; writeFin(); if (shown()) paint(); });
    }
    function pocketSplit() {
        const now = Date.now(), recent = [], old = [];
        try { const api = window.ibaPaymentPocket; if (seesPocket() && api && api.getItems) { const it = api.getItems(); if (Array.isArray(it) && it.length) pocket = it; } } catch (_) {}
        (pocket || []).forEach((it) => {
            if (!it || doneKeys.has(it.indexKey)) return;                                     // just marked Paid here
            const ms = toMs(it.releaseDate); if (!ms || new Date(ms).getFullYear() !== YEAR) return;   // 2026 only
            const row = { g: 'fin', item: it, key: it.indexKey, po: String(it.po || ''), inv: String(it.invoiceNo || it.invEntryID || ''), vendor: String(it.vendorName || ''), site: String(it.site || ''), status: 'With Accounts', with: 'Accounts', days: daysSince(ms), amount: Number(it.invoiceValue || it.amountPaid) || 0, mine: false };
            (now - ms <= DAYS7 ? recent : old).push(row);
        });
        return { recent, old };
    }
    const doneKeys = new Set();
    let lastFin = '';
    function writeFin() {
        const d = mainDb(); if (!d || !seesPocket() || !pocket.length) return;
        const r = pocketSplit().recent, sum = { n: r.length, v: Math.round(r.reduce((a, x) => a + x.amount, 0)) };
        const k = JSON.stringify(sum); if (k === lastFin) return; lastFin = k;
        d.ref('system_settings/dash_summary/fin').set(Object.assign({ at: Date.now() }, sum)).catch(() => {});
    }
    async function readFin() {
        if (seesPocket()) return;
        const d = mainDb(); if (!d) return;
        try { finSum = (await d.ref('system_settings/dash_summary/fin').once('value')).val(); } catch (_) {}
    }
    async function readPaid() {
        if (!money()) return;
        try { const n = await call('wdLoadPaidHistoryDashboardCount', false); if (typeof n === 'number') paidN = n; } catch (_) {}
    }

    // ---- monthly received vs paid (18.0.0 patch 14, martin) ----
    // system_settings/dash_trend/<YEAR> = { at, m: {"01": {r, w, p}, ...}, i: {"<po>~<key>": "RRPPWW"} }
    //   RR = month received (invoice date), PP = month PAID (paidDate) when Paid, WW = month given to Accounts
    //   (With Accounts date) while it is still With Accounts; 00 = none / not 2026.
    //   martin picked 3 bars per month (Received / With Accounts / Paid) with the name + number on each bar.
    // Filled ONCE by the Super Admin (button), then kept up to date from the change rows every invoice save
    // already writes (workdesk_dashboard_recent): only the invoices that changed are read (status + date).
    // Money people read only .../m and .../at (a few hundred bytes). Nobody re-reads the whole list.
    const TREND = 'system_settings/dash_trend/' + YEAR, SYNC_GAP = 10 * 60000, OVERLAP = 5 * 60000, MAXCH = 300;
    let trend = null, trendAt = 0, trendBusy = false, trendMsg = '', lastSync = 0;
    function monthOf(v, fb) {
        try { if (v && typeof window.normalizeDateForInput === 'function') v = window.normalizeDateForInput(v) || v; } catch (_) {}
        const ms = toMs(v) || (fb ? toMs(fb) : 0);
        if (!ms) return '00';
        const d = new Date(ms); return d.getFullYear() === YEAR ? String(d.getMonth() + 1).padStart(2, '0') : '00';
    }
    const isPaid = (st) => /\bpaid\b/.test(norm(st)) && !/unpaid|not paid/.test(norm(st));
    function stateOf(inv) {
        if (!inv || typeof inv !== 'object') return 'x';
        const r = monthOf(inv.invoiceDate || inv.date || '', inv.dateAdded || inv.createdAt);
        const p = isPaid(inv.status) ? monthOf(inv.paidDate || inv.releaseDate || '', null) : '00';
        const w = /with accounts/.test(norm(inv.status)) ? monthOf(inv.releaseDate || inv.withAccountsDate || '', null) : '00';
        return (r === '00' && p === '00' && w === '00') ? 'x' : r + p + w;
    }
    function addState(m, st, k) {
        if (!st || st === 'x') return;
        const r = st.slice(0, 2), p = st.slice(2, 4), w = st.slice(4, 6) || '00';
        const at = (mo, f) => { if (mo === '00') return; const c = m[mo] || (m[mo] = { r: 0, w: 0, p: 0 }); c[f] = Math.max(0, (c[f] || 0) + k); };
        at(r, 'r'); at(p, 'p'); at(w, 'w');
    }
    async function readTrend() {
        if (!money()) return;
        const d = mainDb(); if (!d) return;
        try {
            const [m, at] = await Promise.all([d.ref(TREND + '/m').once('value'), d.ref(TREND + '/at').once('value')]);
            trend = m.val(); trendAt = Number(at.val()) || 0;
        } catch (e) { console.warn('[dashboard] trend not read', e); }
        if (trend && Date.now() - lastSync > SYNC_GAP) syncTrend().catch((e) => console.warn('[dashboard] trend sync', e));
    }
    async function bump(prev, next) {
        if (prev === next) return;
        const d = mainDb();
        await d.ref(TREND + '/m').transaction((m) => {
            m = m || {};
            addState(m, prev, -1); addState(m, next, 1); return m;
        });
    }
    async function syncTrend() {
        const d = mainDb(), v = invDb(); if (!d || !v || !trendAt) return;
        lastSync = Date.now();
        const since = Math.max(0, trendAt - OVERLAP);
        const rows = (await v.ref('workdesk_dashboard_recent').orderByChild('updatedAt').startAt(since).once('value')).val() || {};
        const ids = {}; let top = trendAt;
        Object.keys(rows).forEach((k) => {
            const r = rows[k] || {}; const po = String(r.po || r.originalPO || '').trim(), key = String(r.invoiceKey || r.originalKey || k || '').trim();
            if (!po || !key || /[.#$[\]\/~]/.test(po + key)) return;
            ids[po + '~' + key] = [po, key]; const u = Number(r.updatedAt) || 0; if (u > top) top = u;
        });
        const list = Object.keys(ids).slice(0, MAXCH);
        for (const id of list) {
            const [po, key] = ids[id];
            const inv = (await v.ref('invoice_entries/' + po + '/' + key).once('value')).val();
            const next = stateOf(inv); let prev = null, changed = false;
            const res = await d.ref(TREND + '/i/' + id).transaction((cur) => { prev = cur || 'x'; if (prev === next) return; changed = true; return next === 'x' ? null : next; });
            if (res && res.committed && changed) await bump(prev, next);
        }
        if (list.length === Object.keys(ids).length && top > trendAt) { await d.ref(TREND + '/at').set(top); trendAt = top; }
        if (list.length) { trend = (await d.ref(TREND + '/m').once('value')).val(); if (shown()) paint(); }
    }
    async function buildTrend(btn) {
        if (!isSuper() || trendBusy) return;
        if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Sure? It reads the whole invoice list once'; setTimeout(() => { if (btn.isConnected && btn.dataset.sure === '1') { btn.dataset.sure = ''; btn.textContent = 'Fill the 2026 chart (one-time)'; } }, 5000); return; }
        const d = mainDb(), v = invDb(); if (!d || !v) return;
        trendBusy = true; trendMsg = 'Reading the invoice list once…'; paint();
        try {
            let data = null;
            if (typeof window.ibaInvoiceEntriesLoad === 'function') { try { const r = await window.ibaInvoiceEntriesLoad(); data = r && r.data; } catch (_) {} }
            if (!data) data = (await v.ref('invoice_entries').once('value')).val() || {};
            const m = {}, i = {}; let n = 0;
            Object.keys(data).forEach((po) => {
                const invs = data[po]; if (!invs || typeof invs !== 'object' || /[.#$[\]\/~]/.test(po)) return;
                Object.keys(invs).forEach((key) => {
                    if (/[.#$[\]\/~]/.test(key)) return;
                    const st = stateOf(invs[key]); if (st === 'x') return;
                    i[po + '~' + key] = st; n++;
                    addState(m, st, 1);
                });
            });
            const at = Date.now();
            await d.ref(TREND).set({ at, m, i, builtAt: at, builtBy: (me() && me().Name) || '' });
            trend = m; trendAt = at; lastSync = Date.now();
            trendMsg = n + ' invoices counted.';
        } catch (e) { console.warn('[dashboard] trend build', e); trendMsg = 'Could not fill the chart: ' + ((e && e.message) || 'error'); }
        trendBusy = false; paint();
    }
    function trendHtml() {
        if (!money()) return '';
        const now = new Date(), last = now.getFullYear() === YEAR ? now.getMonth() + 1 : 12;
        const head = `<div class="iba-d2-trh"><div><b>Invoice Flow ${YEAR}</b></div>`;
        if (!trend) {
            return `<div class="iba-d2-trend">${head}</div>` + (isSuper() ? `<p class="iba-d2-note">${esc(trendMsg || 'Not filled yet. Fill it once: your PC reads the invoice list one time (it may already have a saved copy), then only changed invoices are read.')}</p><div class="iba-d2-acts"><button type="button" class="secondary-btn" data-d2-trend${trendBusy ? ' disabled' : ''}><i class="fa-solid fa-chart-column"></i> ${trendBusy ? 'Working…' : 'Fill the 2026 chart (one-time)'}</button></div>` : `<p class="iba-d2-note">The Super Admin has not filled this chart yet.</p>`) + `</div>`;
        }
        const mo = []; for (let k = 1; k <= last; k++) { const key = String(k).padStart(2, '0'), c = trend[key] || {}; mo.push({ k, r: c.r || 0, w: c.w || 0, p: c.p || 0 }); }
        const max = Math.max(10, ...mo.map((x) => Math.max(x.r, x.w, x.p))), step = max > 200 ? 100 : max > 100 ? 50 : max > 40 ? 20 : 10, top = Math.ceil(max * 1.08 / step) * step;
        const Wd = 1100, Ht = 400, L = 40, B = 28, T = 16, cw = (Wd - L - 10) / mo.length, y = (v) => T + (Ht - T - B) * (1 - v / top);
        const S = [['r', 'Received', 'bar'], ['w', 'With Accounts', 'wa'], ['p', 'Paid', 'pd']];
        const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let g = '';
        for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${Wd - 6}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`;
        mo.forEach((x) => {
            const cx = L + cw * (x.k - 1) + cw / 2, bw = Math.min(26, (cw - 14) / 3), gap = 2;
            S.forEach(([f, name, cls], j) => {
                const v = x[f], bx = cx - (1.5 * bw + gap) + j * (bw + gap), by = y(v), h = Math.max(0, y(0) - by), mid = bx + bw / 2;
                g += `<rect x="${bx}" y="${by}" width="${bw}" height="${h}" class="${cls}${f === 'w' && wam === key2(x.k) ? ' is-on' : ''}"${f === 'w' && v && isSuper() ? ` data-d2-wam="${key2(x.k)}"` : ''}><title>${MN[x.k - 1]} · ${name}: ${v}${f === 'w' && v && isSuper() ? ' · click to list and mark Paid' : ''}</title></rect>`;
                g += `<text x="${mid}" y="${by - 4}" text-anchor="middle" class="vl ${cls}">${v}</text>`;
                if (h > name.length * 6.4 + 10) g += `<text transform="translate(${mid + 4},${y(0) - 6}) rotate(-90)" class="bn">${name}</text>`;
            });
            g += `<text x="${cx}" y="${Ht - 8}" text-anchor="middle" class="ax">${MN[x.k - 1]}</text>`;
        });
        const tr = mo.reduce((a, x) => a + x.r, 0), tw = mo.reduce((a, x) => a + x.w, 0), tp = mo.reduce((a, x) => a + x.p, 0);
        return `<div class="iba-d2-trend">${head}<span class="iba-d2-trk"><i class="b"></i>Received ${tr.toLocaleString('en-US')} <i class="w"></i>With Accounts ${tw.toLocaleString('en-US')} <i class="l"></i>Paid ${tp.toLocaleString('en-US')}</span></div><div class="iba-d2-tw"><svg viewBox="0 0 ${Wd} ${Ht}" class="iba-d2-trsvg" role="img" aria-label="Invoices received, with Accounts and paid per month">${g}</svg></div>${trendMsg && isSuper() ? `<p class="iba-d2-note">${esc(trendMsg)}</p>` : ''}</div>`;
    }

    // ---- view ----
    let sel = null, onlyMine = false, painting = false;
    const shown = () => { const s = $('wd-dashboard'); return !!(s && !s.classList.contains('hidden') && s.offsetParent !== null); };
    const fmtQ = (v) => 'QAR ' + Math.round(v).toLocaleString('en-US');
    const fmtM = (v) => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v));
    function data() {
        const r = rows || [], m = money() && showQ, sp = pocketSplit();
        const fin = r.filter((x) => x.g === 'fin').concat(sp.recent);
        const by = { wip: r.filter((x) => x.g === 'wip'), apv: r.filter((x) => x.g === 'apv'), fin };
        const out = G.map((g) => {
            const list = by[g.id];
            let n = list.length, v = list.reduce((a, x) => a + x.amount, 0);
            if (g.id === 'fin' && !seesPocket() && finSum) { n += Number(finSum.n) || 0; v += Number(finSum.v) || 0; }
            return Object.assign({}, g, { list, n, v, yours: list.filter((x) => x.mine).length });
        });
        return { groups: out, money: m, old: sp.old };
    }
    // 18.0.0 patch 21 (martin): clicking a piece "cuts" it out of the pie: it lifts out and the other pieces fade away
    let pieSel = null;
    function donut(D) {
        const val = (g) => D.money ? g.v : g.n;
        const tot = D.groups.reduce((a, g) => a + val(g), 0);
        const cx = 220, cy = 150, R = 138;
        if (!tot) return '<div class="iba-d2-empty">No open work right now.</div>';
        const prev = pieSel, chg = prev !== sel; pieSel = sel;
        const stateOf = (id) => {
            if (sel) return id === sel ? (chg ? 'is-sel lift' : 'is-sel') : (chg ? 'gone out' : 'gone');
            return (chg && prev) ? (id === prev ? 'drop' : 'back') : '';
        };
        let a = -Math.PI / 2, h = ''; const labels = [];
        const P = (r, x) => [cx + r * Math.cos(x), cy + r * Math.sin(x)];
        D.groups.forEach((g) => {
            const share = val(g) / tot; if (!share) return;
            const b = a + share * 2 * Math.PI, m = (a + b) / 2, st = stateOf(g.id);
            const off = share > .999 ? 0 : 16, tx = (off * Math.cos(m)).toFixed(1), ty = (off * Math.sin(m)).toFixed(1);
            const [x0, y0] = P(R, a), [x1, y1] = P(R, b);
            const path = share > .999 ? `M${cx - R} ${cy}A${R} ${R} 0 1 1 ${cx + R} ${cy}A${R} ${R} 0 1 1 ${cx - R} ${cy}Z` : `M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`;
            const pct = share < .01 ? '<1%' : Math.round(share * 100) + '%';
            const big = share >= .12; // big piece: %, amount and invoice count inside it; small piece: all outside
            let txt = '';
            if (big) {
                const [px, py] = P(share > .999 ? 0 : R * .58, m);
                txt = `<text x="${px.toFixed(1)}" y="${(py - 6).toFixed(1)}" text-anchor="middle" class="iba-d2-pin">${pct}</text>` +
                    `<text x="${px.toFixed(1)}" y="${(py + 13).toFixed(1)}" text-anchor="middle" class="iba-d2-pis">${D.money ? esc(fmtM(g.v)) + ' · ' : ''}${g.n} inv.</text>`;
            }
            h += `<g class="iba-d2-pc ${st}" style="--tx:${tx}px;--ty:${ty}px"><path class="iba-d2-slice" data-g="${g.id}" d="${path}" fill="${g.col}"><title>${esc(g.full)}</title></path>${txt}</g>`;
            const [ax, ay] = P(R + 8, m), [bx, by] = P(R + 32, m), right = Math.cos(m) >= 0;
            labels.push({ g, st, tx, ty, ax, ay, bx, by: Math.sin(m) > .5 ? Math.max(by, ay + 18) : by, right, pct, inside: big }); // bottom labels: the line always shows above the name
            a = b;
        });
        // small pieces next to each other: push their labels apart so the text never overlaps
        [true, false].forEach((side) => {
            const L = labels.filter((l) => l.right === side).sort((p, q) => p.by - q.by);
            for (let i = 1; i < L.length; i++) if (L[i].by - L[i - 1].by < 52) L[i].by = L[i - 1].by + 52;
            for (let i = L.length - 1; i >= 0; i--) if (L[i].by > 318) { L[i].by = 318; if (i > 0 && L[i].by - L[i - 1].by < 52) L[i - 1].by = L[i].by - 52; }
        });
        labels.forEach(({ g, st, tx, ty, ax, ay, bx, by, right, pct, inside }) => {
            const ex = right ? bx + 26 : bx - 26, lx = right ? ex + 6 : ex - 6, an = right ? 'start' : 'end';
            h += `<g class="iba-d2-pc ${st}" style="--tx:${tx}px;--ty:${ty}px"><polyline points="${ax},${ay} ${bx},${by} ${ex},${by}" fill="none" stroke="#e8edf5" stroke-width="1.6" class="iba-d2-ld"/><circle cx="${ax}" cy="${ay}" r="3" fill="#e8edf5"/>` +
                `<text x="${lx}" y="${by - 3}" text-anchor="${an}" class="iba-d2-tl">${esc(g.name)}</text>` +
                (inside ? '' : `<text x="${lx}" y="${by + 13}" text-anchor="${an}" class="iba-d2-ts" fill="${g.col}">${esc(pct)}</text>`) + '</g>'; // details are in the 3 figures below
        });
        return `<svg viewBox="-75 -20 590 356" class="iba-d2-svg" role="img" aria-label="Open work by step">${h}</svg>`;
    }
    // 18.0.0 patch 23 (martin): the total of the 3 steps sits under them (was under the pie)
    function totHtml(D) {
        const n = D.groups.reduce((a, g) => a + g.n, 0); if (!n) return '';
        const v = D.groups.reduce((a, g) => a + (g.v || 0), 0);
        return `<div class="iba-d2-tot"><span class="lb">Total open</span><em>${D.money ? esc(Math.round(v).toLocaleString('en-US')) : n}</em><small>${D.money ? 'QAR · ' + n + ' inv.' : 'invoices'}</small></div>`;
    }
    function listHtml(D) {
        const g = D.groups.find((x) => x.id === sel); if (!g) return '';
        const all = wide() || isSuper();
        let list = g.list.slice();
        if (!all) list = list.filter((x) => x.mine);            // normal users: own rows only
        if (onlyMine) list = list.filter((x) => x.mine);
        list.sort((a, b) => (b.mine - a.mine) || ((b.days || 0) - (a.days || 0)));
        const shownN = list.length; list = list.slice(0, 300);
        const note = !all ? `<p class="iba-d2-note">You see only your own invoices here. The chart counts the whole company.</p>` : '';
        return `<div class="iba-d2-lh"><b><i style="background:${g.col}"></i>${esc(g.full)} · ${g.n} invoices${g.yours ? ` <em>(${g.yours} yours)</em>` : ''}</b>` +
            `<span>${all ? `<label><input type="checkbox" data-d2-mine${onlyMine ? ' checked' : ''}> Only mine</label>` : ''}<button type="button" data-d2-close>Close ✕</button></span></div>` + note +
            (shownN ? `<div class="iba-d2-tw"><table class="iba-d2-t"><thead><tr><th>PO</th><th>Invoice</th><th>Vendor</th><th>Site</th><th>Status</th><th>With</th><th class="n">Days</th>${D.money ? '<th class="n">QAR</th>' : ''}</tr></thead><tbody>` +
                list.map((x) => `<tr class="${x.mine ? 'is-mine' : ''}"><td>${esc(x.po)}${x.mine ? ' <span class="iba-d2-yours">★ Yours</span>' : ''}${x.urgent ? ' <span class="iba-d2-urg">⚡</span>' : ''}</td><td>${esc(x.inv || '—')}</td><td class="v" title="${esc(x.vendor)}">${esc(x.vendor || '—')}</td><td>${esc(x.site || '—')}</td><td><span class="iba-d2-tag">${esc(x.status)}</span></td><td>${esc(x.with || '—')}</td><td class="n${(x.days || 0) > 7 ? ' old' : ''}">${x.days == null ? '—' : x.days}</td>${D.money ? `<td class="n">${x.amount ? Math.round(x.amount).toLocaleString('en-US') : '—'}</td>` : ''}</tr>`).join('') +
                `</tbody></table></div>` + (shownN > 300 ? `<p class="iba-d2-note">Showing the first 300 of ${shownN}.</p>` : '')
                : `<p class="iba-d2-note">${!all || onlyMine ? 'Nothing here is yours.' : 'Nothing in this step.'}</p>`) +
            (D.money ? '' : '<p class="iba-d2-lock"><i class="fa-solid fa-lock"></i> Amounts are hidden for your account.</p>') +
            `<div class="iba-d2-acts"><button type="button" class="secondary-btn" data-d2-go="wd-active-task"><i class="fa-solid fa-list-check"></i> Open Active Task</button></div>`;
    }
    let oldOpen = false; const picked = new Set(); let markBusy = false;
    // 18.0.0 patch 19 (martin): click a teal With Accounts bar = that month's With Accounts invoices (from the pocket) to mark Paid
    let wam = null;
    const key2 = (k) => String(k).padStart(2, '0');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function waList() {
        const sp = pocketSplit(); if (!wam) return sp.old;
        return sp.recent.concat(sp.old).filter((x) => { const ms = toMs(x.item.releaseDate); return ms && key2(new Date(ms).getMonth() + 1) === wam; });
    }
    function oldHtml(D) {
        const LST = waList();
        if (!isSuper() || !wam) return ''; // patch 21 (martin): the With Accounts list shows only after clicking a teal bar
        const sum = LST.reduce((a, x) => a + x.amount, 0);
        const byMonth = {};
        LST.forEach((x) => { const ms = toMs(x.item.releaseDate); const k = new Date(ms).toLocaleString('en-US', { month: 'short' }); byMonth[k] = (byMonth[k] || 0) + 1; });
        const months = Object.keys(byMonth).map((k) => k + ' ' + byMonth[k]).join(' · ');
        const list = LST.slice().sort((a, b) => (b.days || 0) - (a.days || 0));
        const keys = new Set(list.map((x) => x.key)); Array.from(picked).forEach((k) => { if (!keys.has(k)) picked.delete(k); });
        const n = picked.size, all = n && n === list.length, pv = list.filter((x) => picked.has(x.key)).reduce((a, x) => a + x.amount, 0);
        return `<div class="iba-d2-old"><div class="iba-d2-oh"><div>${wam ? `<b>With Accounts · ${MONTHS[+wam - 1]} ${YEAR}: ${LST.length}</b><span>Given to Accounts in ${MONTHS[+wam - 1]}, not marked Paid yet · ${esc(fmtQ(sum))}</span>` : `<b>With Accounts over 7 days (2026): ${LST.length}</b><span>Probably paid, Accounts has not marked them Paid yet · ${esc(fmtQ(sum))} · ${esc(months)}</span>`}</div>` +
            `<span class="iba-d2-ob">${oldOpen ? `<button type="button" class="iba-d2-paid iba-d2-paidall" data-d2-paidsel${n && !markBusy ? '' : ' disabled'}>Mark Paid (${n})</button>` : ''}${wam ? `<button type="button" class="secondary-btn" data-d2-wam="">Close</button>` : `<button type="button" class="secondary-btn" data-d2-old>${oldOpen ? 'Hide list' : 'Show list'}</button>`}</span></div>` +
            (oldOpen ? (n ? `<p class="iba-d2-note">${n} picked · ${esc(fmtQ(pv))}. Each gets its own Paid date: With Accounts date + 1 day, Friday moves to Saturday.</p>` : `<p class="iba-d2-note">Tick the invoices Accounts has paid, or tick the top box for all, then Mark Paid.</p>`) +
                `<div class="iba-d2-tw"><table class="iba-d2-t"><thead><tr><th class="ck"><input type="checkbox" data-d2-pickall${all ? ' checked' : ''} title="Select all"></th><th>PO</th><th>Invoice</th><th>Vendor</th><th>With Accounts</th><th>Paid date</th><th class="n">Days</th><th class="n">QAR</th></tr></thead><tbody>` +
                list.map((x) => { const pd = call('wdPaymentPocketCalculatedPaidDate', x.item); return `<tr class="${picked.has(x.key) ? 'is-pick' : ''}"><td class="ck"><input type="checkbox" data-d2-pick="${esc(x.key)}"${picked.has(x.key) ? ' checked' : ''}></td><td>${esc(x.po)}</td><td>${esc(x.inv || '—')}</td><td class="v" title="${esc(x.vendor)}">${esc(x.vendor || '—')}</td><td>${esc(x.item.releaseDate || '')}</td><td>${esc(pd || '—')}</td><td class="n">${x.days}</td><td class="n">${Math.round(x.amount).toLocaleString('en-US')}</td></tr>`; }).join('') +
                `</tbody></table></div>` : '') + `</div>`;
    }
    // update ticks, button and note in place (a full repaint would jump the list back to the top)
    function pickUi() {
        const box = document.querySelector('#iba-d2 .iba-d2-old'); if (!box) return;
        const old = waList(), n = picked.size, pv = old.filter((x) => picked.has(x.key)).reduce((a, x) => a + x.amount, 0);
        box.querySelectorAll('[data-d2-pick]').forEach((c) => { const on = picked.has(c.getAttribute('data-d2-pick')); c.checked = on; const tr = c.closest('tr'); if (tr) tr.classList.toggle('is-pick', on); });
        const all = box.querySelector('[data-d2-pickall]'); if (all) { all.checked = !!n && n === old.length; all.indeterminate = !!n && n < old.length; }
        const btn = box.querySelector('[data-d2-paidsel]'); if (btn) { btn.disabled = !n || markBusy; btn.dataset.sure = ''; btn.classList.remove('is-sure'); btn.textContent = `Mark Paid (${n})`; }
        const note = box.querySelector('.iba-d2-note'); if (note) note.textContent = n ? `${n} picked · ${fmtQ(pv)}. Each gets its own Paid date: With Accounts date + 1 day, Friday moves to Saturday.` : 'Tick the invoices Accounts has paid, or tick the top box for all, then Mark Paid.';
    }
    async function markPicked(btn) {
        if (!isSuper() || markBusy) return;
        const rowsOld = waList().filter((x) => picked.has(x.key)); if (!rowsOld.length) return;
        if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = `Sure? Mark ${rowsOld.length} Paid`; btn.classList.add('is-sure'); setTimeout(() => { if (btn.isConnected && btn.dataset.sure === '1') pickUi(); }, 5000); return; }
        const api = window.ibaPaymentPocket;
        if (!api || typeof api.markWorkdeskInvoicePaid !== 'function') { btn.textContent = 'Not ready, try again'; return; }
        markBusy = true; let ok = 0, bad = 0;
        for (const r of rowsOld) {
            btn.textContent = `Saving ${ok + bad + 1} of ${rowsOld.length}…`;
            try { await api.markWorkdeskInvoicePaid(r.item, () => {}); ok++; picked.delete(r.key); doneKeys.add(r.key); pocket = pocket.filter((x) => x.indexKey !== r.key); }
            catch (er) { bad++; console.warn('[dashboard] mark paid failed', r.po, er); }
        }
        markBusy = false; paint();
        const b = document.querySelector('#iba-d2 .iba-d2-old .iba-d2-note'); if (b) b.textContent = `${ok} marked Paid${bad ? `, ${bad} failed (still ticked, try again)` : ''}.`;
    }
    function paint() {
        const box = $('iba-d2'); if (!box || painting) return;
        painting = true;
        try {
            const D = data();
            const loading = !rows;
            const TR = trendHtml(); // 18.0.0 patch 19: chart + 3 steps on the left, monthly bars on the right
            box.innerHTML = `<div class="iba-d2-head"><div><h2>Where the invoices are now</h2><p>Open work in 3 steps · ${new Date().getFullYear() === YEAR ? '2026' : YEAR}${loading ? ' · loading…' : ''}${err ? ' · <span class="bad">' + esc(err) + '</span>' : ''}</p></div>` +
                `<div class="iba-d2-hb">${(D.money && paidN != null) ? `<span class="iba-d2-paidn">Paid in ${YEAR}: <b>${paidN.toLocaleString('en-US')}</b></span>` : ''}</div></div>` +
                (TR ? `<div class="iba-d2-body has-tr"><div class="iba-d2-left"><div class="iba-d2-chart">${loading ? '<div class="iba-d2-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading open work…</div>' : donut(D)}${(loading || !D.groups.some((g) => g.n)) ? '' : '<p class="iba-d2-hint">Click a piece to see its invoices.</p>'}</div>` +
                `<div class="iba-d2-legend">${D.groups.map((g) => `<button type="button" class="iba-d2-lg${sel === g.id ? ' is-sel' : ''}" data-g="${g.id}" title="${esc(g.full + ': ' + g.sub)}"><span class="lb" style="--c:${g.col}">${esc(g.short || g.full.split(' /')[0])}</span><em>${D.money ? esc(Math.round(g.v).toLocaleString('en-US')) : g.n}</em><small>${D.money ? 'QAR · ' + g.n + ' inv.' : 'invoices'}${g.yours ? ` · <b>★ ${g.yours}</b>` : ''}</small></button>`).join('')}${totHtml(D)}</div></div><div class="iba-d2-right">${qSwitch()}${TR}</div></div>`
                    : `<div class="iba-d2-body"><div class="iba-d2-chart">${qSwitch()}${loading ? '<div class="iba-d2-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading open work…</div>' : donut(D)}${(loading || !D.groups.some((g) => g.n)) ? '' : '<p class="iba-d2-hint">Click a piece to see its invoices.</p>'}</div>` +
                `<div class="iba-d2-legend">${D.groups.map((g) => `<button type="button" class="iba-d2-lg${sel === g.id ? ' is-sel' : ''}" data-g="${g.id}" title="${esc(g.full + ': ' + g.sub)}"><span class="lb" style="--c:${g.col}">${esc(g.short || g.full.split(' /')[0])}</span><em>${D.money ? esc(Math.round(g.v).toLocaleString('en-US')) : g.n}</em><small>${D.money ? 'QAR · ' + g.n + ' inv.' : 'invoices'}${g.yours ? ` · <b>★ ${g.yours}</b>` : ''}</small></button>`).join('')}${totHtml(D)}</div></div>`) +
                (sel ? `<div class="iba-d2-list">${listHtml(D)}</div>` : '') + oldHtml(D);
        } finally { painting = false; }
    }
    function mount() {
        const sec = $('wd-dashboard'); if (!sec) return false;
        let box = $('iba-d2');
        if (!box) {
            box = document.createElement('div'); box.id = 'iba-d2'; box.className = 'iba-d2';
            const hero = sec.querySelector('.wd-control-center-hero');
            if (hero) hero.insertAdjacentElement('afterend', box); else sec.insertBefore(box, sec.firstChild);
            box.addEventListener('click', onClick);
            box.addEventListener('change', (e) => {
                const el = e.target;
                if (el.matches('[data-d2-mine]')) { onlyMine = el.checked; paint(); return; }
                if (el.matches('[data-d2-qar]')) { showQ = el.checked; paint(); return; }
                if (el.matches('[data-d2-pick]')) { const k = el.getAttribute('data-d2-pick'); if (el.checked) picked.add(k); else picked.delete(k); pickUi(); return; }
                if (el.matches('[data-d2-pickall]')) { picked.clear(); if (el.checked) waList().forEach((x) => picked.add(x.key)); pickUi(); }
            });
        }
        return true;
    }
    async function onClick(e) {
        const t = e.target;
        const wb = t.closest('[data-d2-wam]');
        if (wb) {
            const m = wb.getAttribute('data-d2-wam') || null; wam = (m && m !== wam) ? m : null; picked.clear(); oldOpen = !!wam || oldOpen; paint();
            const o = document.querySelector('#iba-d2 .iba-d2-old'); if (o && wam) o.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return;
        }
        const gEl = t.closest('[data-g]');
        if (gEl) { const id = gEl.getAttribute('data-g'); sel = sel === id ? null : id; paint(); if (sel) { const l = document.querySelector('#iba-d2 .iba-d2-list'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } return; }
        if (t.closest('[data-d2-close]')) { sel = null; paint(); return; }
        if (t.closest('[data-d2-old]')) { oldOpen = !oldOpen; paint(); return; }
        const go = t.closest('[data-d2-go]'); if (go) { call('ibaOpenShellPage', go.getAttribute('data-d2-go')); return; }
        const pa = t.closest('[data-d2-paidsel]'); if (pa) { markPicked(pa); return; }
        const tb = t.closest('[data-d2-trend]'); if (tb) { buildTrend(tb); return; }
    }
    let lastOn = null;
    async function apply(force) {
        document.body.classList.toggle('iba-dash2-on', on());
        if (!on()) {
            const box = $('iba-d2'); if (box) box.remove();
            if (lastOn === true) { lastOn = false; call('populateWorkdeskDashboard', false); }
            lastOn = false; return;
        }
        lastOn = true;
        if (!mount()) return;
        hookPocket();
        paint();
        await Promise.all([loadRows(!!force), readFin(), readPaid(), readTrend()]);
        paint();
    }

    // ---- Settings › Dashboard card (Super Admin) ----
    function paintSettings() {
        const sec = $('wd-settings'); if (!sec) return;
        let card = $('iba-d2-settings-card');
        // 18.0.0 patch 14 (martin): the Refresh button left the Dashboard; it lives here for everyone (PC)
        const sup = isSuper();
        if (card && card.dataset.sup !== String(sup)) { card.remove(); card = null; }
        if (!card) {
            card = document.createElement('div'); card.id = 'iba-d2-settings-card'; card.className = 'settings-card'; card.dataset.sup = String(sup);
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-chart-pie"></i></div><div><h2>Dashboard</h2><p>' + (sup ? 'The Dashboard shows the open-work chart. Turn the old cards back on here, choose who sees QAR amounts, or read the numbers again now.' : 'The Dashboard updates by itself every few minutes. Use this only if you need the newest numbers right now.') + '</p></div></div>' +
                (sup ? '<label class="iba-d2-sw"><input type="checkbox" data-d2-oldcards> Show old Dashboard cards (instead of the chart)</label>' : '') +
                '<div class="settings-action-row"><button class="secondary-btn" type="button" data-d2-reload><i class="fa-solid fa-rotate"></i> Refresh Dashboard numbers</button>' + (sup ? '<button class="secondary-btn" type="button" data-d2-money><i class="fa-solid fa-coins"></i> Who sees QAR</button>' : '') + '<span class="iba-d2-msg"></span></div>';
            const after = $('iba-sa-settings-card') || $('iba-lpo-settings-card');
            if (after && after.parentElement) after.insertAdjacentElement('afterend', card); else (sec.querySelector('#settings-form') || sec).appendChild(card);
            card.addEventListener('change', (e) => {
                if (!e.target.matches('[data-d2-oldcards]')) return;
                const d = mainDb(); const v = e.target.checked; const msg = card.querySelector('.iba-d2-msg');
                if (!d) { msg.textContent = 'Firebase not ready.'; return; }
                d.ref('system_settings/dash_old_cards').set(v ? true : null).then(() => { msg.textContent = v ? 'Old cards are back for everyone.' : 'Chart is on for everyone.'; }, () => { msg.textContent = 'Could not save.'; });
            });
            card.addEventListener('click', async (e) => {
                if (e.target.closest('[data-d2-money]') && window.ibaSkillAccess) { window.ibaSkillAccess.open('dash_money'); return; }
                const rb = e.target.closest('[data-d2-reload]'); if (!rb || rb.disabled) return;
                const msg = card.querySelector('.iba-d2-msg'); rb.disabled = true; msg.textContent = 'Reading…';
                try { rows = null; await Promise.all([loadRows(true), readFin(), readPaid()].concat(typeof readTrend === 'function' ? [readTrend()] : [])); msg.textContent = 'Done. The Dashboard shows the newest numbers.'; }
                catch (_) { msg.textContent = 'Could not read now, try again.'; }
                rb.disabled = false;
            });
        }
        const cb = card.querySelector('[data-d2-oldcards]'); if (cb && cb.checked !== oldCards) cb.checked = oldCards;
    }

    // ---- start ----
    let lastShown = false;
    setInterval(() => {
        const s = shown();
        if (s && !lastShown) apply(false);
        lastShown = s;
        if ($('wd-settings') && !phone() && (!$('iba-d2-settings-card') || $('iba-d2-settings-card').dataset.sup !== String(isSuper()))) paintSettings();
    }, 700);
    window.addEventListener('iba:skill-access', () => { if (shown() && on()) { readPaid().then(paint); paint(); } });
    hook(); watch();
    window.ibaDash2 = { apply, paint, syncTrend: () => { lastSync = 0; return readTrend().then(() => syncTrend()); }, data: () => data(), rows: () => rows, reload: () => loadRows(true).then(paint) };
})();
