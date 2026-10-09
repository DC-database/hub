/* ==========================================================================
   js/iba-phone.js — 14.0.0 patch 5
   Phone workspace. On a phone the desktop pages, side menu and dashboard are
   not shown. The phone gets a small workspace of its own:

     Invoice side   : Approve (invoices waiting for you) · Records · Messages · Logout
     Inventory side : Approve (Pending Admin requests)   · Item search · Messages · Logout

   - The header shows the IBA mark, your name and an Invoice | Inventory
     switch with only the sides you use.
   - Invoice decisions use the same routine as the desktop (js/iba-approvals.js).
   - Inventory decisions use the existing transfer engine (handleTransferAction).
   - Chrome's "Desktop site" mode still gets the full desktop.
   ========================================================================== */
(function () {
    'use strict';

    const VERSION = '14.0.0-p7';
    const STALE_MS = 60 * 1000;

    const state = {
        on: false,
        side: '',
        tab: 'approve',
        inv: { list: [], loading: false, loadedAt: 0, error: '' },
        stk: { list: [], loading: false, loadedAt: 0, error: '' },
        recordsReady: false,
        invSeen: false
    };

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    function A() { return window.ibaApprovals; }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function $(id) { return document.getElementById(id); }
    function user() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function myName() { const u = user(); return String((u && u.Name) || '').trim(); }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
    function money(v) { return A() ? A().money(v) : String(v || ''); }
    function qtyText(v) {
        const n = parseFloat(v);
        if (!Number.isFinite(n)) return '0';
        return Number.isInteger(n) ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 3 });
    }

    // signed in and the desktop pages are showing (not the sign-in screen)
    function signedInView() {
        return document.body.classList.contains('iba-shell-on');
    }

    function isPhone() {
        try {
            if (typeof isMobileViewport === 'function') return !!isMobileViewport();
        } catch (_) {}
        return (window.innerWidth || 0) <= 900;
    }

    function canRecords() {
        const u = user() || {};
        const name = norm(u.Name);
        const role = norm(u.Role);
        let superName = 'irwin';
        try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) superName = norm(SUPER_ADMIN_NAME); } catch (_) {}
        let vacation = false;
        try { vacation = typeof isVacationDelegateUser === 'function' && !!isVacationDelegateUser(); } catch (_) {}
        return role === 'admin' || name === superName || vacation;
    }

    function myNames() {
        if (A()) return A().myNames();
        return [myName()].filter(Boolean);
    }

    function isMeOrDelegated(name) {
        const n = norm(name);
        if (!n) return false;
        return myNames().some(m => norm(m) === n);
    }

    // Inventory requests are approved by admins (the transfer form only lists
    // admins as Approver), or by someone standing in for an admin on vacation.
    // Others never load the transfer list on the phone.
    function mayApproveInventory() {
        const u = user() || {};
        if (norm(u.Role) === 'admin') return true;
        let data = null;
        try { if (typeof getCachedApproversData === 'function') data = getCachedApproversData(); } catch (_) {}
        if (!data) return false;
        const covered = myNames().map(norm).filter(n => n && n !== norm(u.Name));
        if (!covered.length) return false;
        return Object.values(data).some(a => a && covered.includes(norm(a.Name)) && norm(a.Role) === 'admin');
    }

    // Sides this person uses. Inventory (Item search) is for everyone; the
    // invoice side shows for Records access or when an invoice waits for them.
    function sides() {
        const out = [];
        // Once invoice work showed up in this session the side stays, so it
        // does not vanish right after the last approval.
        if (state.inv.list.length > 0) state.invSeen = true;
        if (canRecords() || state.invSeen) out.push('invoice');
        out.push('inventory');
        return out;
    }

    // ------------------------------------------------------------------
    // Shell
    // ------------------------------------------------------------------
    function build() {
        let root = $('iba-phone');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'iba-phone';
        root.className = 'iba-ph';
        root.innerHTML = `
          <header class="iba-ph-head">
            <div class="iba-ph-brand">
              <span class="iba-ph-mark" aria-hidden="true">IBA</span>
              <div class="iba-ph-who">
                <strong id="iba-ph-name"></strong>
                <small id="iba-ph-pos"></small>
              </div>
            </div>
            <button type="button" class="iba-ph-icon" id="iba-ph-refresh" aria-label="Refresh"><i class="fa-solid fa-rotate-right"></i></button>
          </header>
          <div class="iba-ph-switch" id="iba-ph-switch" role="tablist" aria-label="Workspace"></div>
          <main class="iba-ph-main" id="iba-ph-main">
            <section class="iba-ph-pane" data-pane="invoice-approve"></section>
            <section class="iba-ph-pane" data-pane="invoice-records">
              <form class="iba-ph-search" id="iba-ph-rec-form" autocomplete="off">
                <div class="iba-ph-search-row">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <input type="search" id="iba-ph-rec-term" placeholder="PO, vendor or invoice no." enterkeyhint="search">
                </div>
                <div class="iba-ph-search-row2">
                  <select id="iba-ph-rec-status" aria-label="Status"><option value="">All statuses</option></select>
                  <button type="submit" class="iba-ph-btn is-primary">Search</button>
                </div>
              </form>
              <div id="iba-ph-rec-host" class="iba-ph-rec-host"></div>
            </section>
            <section class="iba-ph-pane" data-pane="inventory-approve"></section>
            <section class="iba-ph-pane" data-pane="inventory-search"><div id="iba-ph-find-host"></div></section>
          </main>
          <nav class="iba-ph-tabs" id="iba-ph-tabs" aria-label="Phone menu"></nav>
          <div class="iba-ph-sheet hidden" id="iba-ph-sheet" role="dialog" aria-modal="true">
            <div class="iba-ph-sheet-box">
              <div class="iba-ph-sheet-grip"></div>
              <h3 id="iba-ph-sheet-title"></h3>
              <div id="iba-ph-sheet-body" class="iba-ph-sheet-body"></div>
              <textarea id="iba-ph-sheet-note" rows="3"></textarea>
              <div class="iba-ph-sheet-err" id="iba-ph-sheet-err" role="alert"></div>
              <div class="iba-ph-sheet-actions">
                <button type="button" class="iba-ph-btn is-ghost" data-sheet="cancel">Cancel</button>
                <button type="button" class="iba-ph-btn is-primary" data-sheet="ok">OK</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(root);

        $('iba-ph-refresh').addEventListener('click', () => refresh(true));
        $('iba-ph-switch').addEventListener('click', e => {
            const b = e.target.closest('[data-side]');
            if (!b) return;
            setSide(b.getAttribute('data-side'));
        });
        $('iba-ph-tabs').addEventListener('click', e => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            const id = b.getAttribute('data-tab');
            if (id === 'messages') { openMessages(); return; }
            if (id === 'logout') { logout(); return; }
            setTab(id);
        });
        $('iba-ph-rec-form').addEventListener('submit', e => { e.preventDefault(); runRecordsSearch(); });
        root.addEventListener('click', onPaneClick);
        root.addEventListener('change', onPaneChange);
        root.addEventListener('input', onPaneInput);
        return root;
    }

    function paintHeader() {
        const u = user() || {};
        $('iba-ph-name').textContent = u.Name || 'User';
        $('iba-ph-pos').textContent = u.Position || '';
    }

    function paintSwitch() {
        const list = sides();
        const sw = $('iba-ph-switch');
        if (list.length < 2) {
            sw.innerHTML = '';
            sw.classList.add('hidden');
            return;
        }
        sw.classList.remove('hidden');
        sw.innerHTML = list.map(s => {
            const n = s === 'invoice' ? state.inv.list.length : state.stk.list.length;
            return `<button type="button" role="tab" data-side="${s}" class="${s === state.side ? 'is-on' : ''}" aria-selected="${s === state.side}">
                ${s === 'invoice' ? '<i class="fa-solid fa-file-invoice"></i> Invoice' : '<i class="fa-solid fa-boxes-stacked"></i> Inventory'}
                ${n ? `<span class="iba-ph-count">${n}</span>` : ''}
            </button>`;
        }).join('');
    }

    function tabsFor(side) {
        if (side === 'invoice') {
            const t = [{ id: 'approve', icon: 'fa-file-signature', label: 'Approve', count: state.inv.list.length }];
            if (canRecords()) t.push({ id: 'records', icon: 'fa-folder-open', label: 'Records' });
            return t;
        }
        const t = [];
        if (mayApproveInventory()) t.push({ id: 'approve', icon: 'fa-clipboard-check', label: 'Approve', count: state.stk.list.length });
        t.push({ id: 'search', icon: 'fa-magnifying-glass', label: 'Item search' });
        return t;
    }

    function paintTabs() {
        const tabs = tabsFor(state.side).concat([
            { id: 'messages', icon: 'fa-comments', label: 'Messages', dm: true },
            { id: 'logout', icon: 'fa-right-from-bracket', label: 'Logout' }
        ]);
        $('iba-ph-tabs').innerHTML = tabs.map(t => `
            <button type="button" data-tab="${t.id}" class="${t.id === state.tab ? 'is-on' : ''}">
              <span class="iba-ph-tab-ic"><i class="fa-solid ${t.icon}"></i>
                ${t.count ? `<span class="iba-ph-badge">${t.count}</span>` : ''}
                ${t.dm ? '<span class="iba-ph-badge dm-unread-badge" style="display:none">0</span>' : ''}
              </span>
              <span class="iba-ph-tab-label">${t.label}</span>
            </button>`).join('');
        try { if (typeof dmUpdateBadges === 'function') dmUpdateBadges(); } catch (_) {}
    }

    function showPane() {
        const pane = `${state.side}-${state.tab}`;
        document.querySelectorAll('#iba-phone .iba-ph-pane').forEach(p => {
            p.classList.toggle('is-on', p.getAttribute('data-pane') === pane);
        });
        const main = $('iba-ph-main');
        if (main) main.scrollTop = 0;
    }

    // 14.0.0 patch 7: each side has its own background photo, chosen in
    // Settings (Shell Backgrounds > Phone). "none" = plain dark.
    function paintPhoneBg() {
        const root = $('iba-phone');
        if (!root) return;
        let url = '';
        try {
            if (typeof window.ibaShellBackgroundFor === 'function') {
                url = String(window.ibaShellBackgroundFor(state.side === 'inventory' ? 'phone-inventory' : 'phone-invoice') || '');
            }
        } catch (_) {}
        const has = !!url && url !== 'none' && /^https?:\/\//i.test(url);
        root.classList.toggle('has-photo', has);
        if (has) root.style.setProperty('--ph-photo', 'url("' + url.replace(/"/g, '%22') + '")');
        else root.style.removeProperty('--ph-photo');
    }

    function setSide(side) {
        if (!sides().includes(side)) side = sides()[0];
        state.side = side;
        paintPhoneBg();
        try {
            window.__ibaActiveModule = side === 'inventory' ? 'inventory' : 'invoice';
            document.body.classList.toggle('inventory-mode', side === 'inventory');
        } catch (_) {}
        const allowed = tabsFor(side).map(t => t.id);
        if (!allowed.includes(state.tab)) state.tab = allowed[0];
        paintSwitch();
        setTab(state.tab);
    }

    function setTab(tab) {
        state.tab = tab;
        paintTabs();
        showPane();
        if (state.side === 'invoice' && tab === 'approve') { renderInvoiceApprove(); if (stale(state.inv)) loadInvoice(); }
        if (state.side === 'invoice' && tab === 'records') openRecords();
        if (state.side === 'inventory' && tab === 'approve') { renderInventoryApprove(); if (stale(state.stk)) loadInventory(); }
        if (state.side === 'inventory' && tab === 'search') openSearch();
    }

    function stale(bucket) { return !bucket.loading && (Date.now() - bucket.loadedAt > STALE_MS); }

    function refresh(force) {
        if (force) { state.inv.loadedAt = 0; state.stk.loadedAt = 0; }
        if (state.side === 'invoice' && state.tab === 'records') { runRecordsSearch(); }
        if (state.side === 'inventory' && state.tab === 'search') {
            try { if (typeof window.openInventoryMobileMaterialFinder === 'function') window.openInventoryMobileMaterialFinder(); } catch (_) {}
        }
        loadInvoice(force);
        loadInventory(force);
    }

    // ------------------------------------------------------------------
    // Enter / leave the phone workspace
    // ------------------------------------------------------------------
    async function enter() {
        if (state.on) return;
        if (!isPhone() || !myName()) return;
        state.on = true;
        build();
        document.body.classList.add('iba-phone');
        paintPhoneBg();
        paintHeader();
        // While the lists load, show a neutral "Loading" page (nothing else
        // is opened yet, so no other data is downloaded).
        state.side = 'invoice';
        state.tab = 'approve';
        $('iba-ph-switch').classList.add('hidden');
        $('iba-ph-tabs').innerHTML = '';
        showPane();
        const first = document.querySelector('#iba-phone [data-pane="invoice-approve"]');
        if (first) first.innerHTML = '<div class="iba-ph-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading your work…</p></div>';
        try { if (typeof ensureApproverDataCached === 'function') await ensureApproverDataCached(); } catch (_) {}
        await Promise.all([loadInvoice(true), loadInventory(true)]);
        // Land where the work is.
        if (state.inv.list.length) { state.tab = 'approve'; setSide('invoice'); }
        else if (state.stk.list.length) { state.tab = 'approve'; setSide('inventory'); }
        else if (canRecords()) { state.tab = 'approve'; setSide('invoice'); }
        else { state.tab = 'search'; setSide('inventory'); }
    }

    function leave() {
        if (!state.on) return;
        state.on = false;
        document.body.classList.remove('iba-phone');
    }

    function openMessages() {
        try {
            if (typeof dmOpen === 'function') dmOpen();
            else if (typeof initDirectMessages === 'function') { initDirectMessages(); if (typeof dmOpen === 'function') dmOpen(); }
        } catch (e) { console.warn('[phone] messages', e); }
    }

    function logout() {
        try { if (typeof handleLogout === 'function') { handleLogout(); return; } } catch (_) {}
        try { localStorage.removeItem('approverKey'); } catch (_) {}
        location.reload();
    }

    // ------------------------------------------------------------------
    // Bottom sheet (confirm / note)
    // ------------------------------------------------------------------
    function sheet(opts) {
        return new Promise(resolve => {
            const box = $('iba-ph-sheet');
            $('iba-ph-sheet-title').textContent = opts.title || '';
            $('iba-ph-sheet-body').innerHTML = opts.body || '';
            const note = $('iba-ph-sheet-note');
            note.value = '';
            note.placeholder = opts.placeholder || 'Note for the sender (optional)';
            note.classList.toggle('hidden', opts.note === false);
            const err = $('iba-ph-sheet-err');
            err.textContent = '';
            const ok = box.querySelector('[data-sheet="ok"]');
            const cancel = box.querySelector('[data-sheet="cancel"]');
            ok.textContent = opts.okLabel || 'OK';
            ok.className = 'iba-ph-btn ' + (opts.tone === 'danger' ? 'is-danger' : 'is-primary');
            cancel.classList.toggle('hidden', opts.cancel === false);
            box.classList.remove('hidden');
            if (opts.requireNote) setTimeout(() => note.focus(), 80);
            const done = val => {
                box.classList.add('hidden');
                ok.onclick = null; cancel.onclick = null; box.onclick = null;
                resolve(val);
            };
            ok.onclick = () => {
                const v = String(note.value || '').trim();
                if (opts.requireNote && !v) {
                    err.textContent = opts.requireMessage || 'Please write a note.';
                    note.focus();
                    return;
                }
                done({ ok: true, note: v });
            };
            cancel.onclick = () => done({ ok: false });
            box.onclick = e => { if (e.target === box) done({ ok: false }); };
        });
    }

    function busy(on, text) {
        let el = $('iba-ph-busy');
        if (!el) {
            el = document.createElement('div');
            el.id = 'iba-ph-busy';
            el.className = 'iba-ph-busy hidden';
            el.innerHTML = '<div><i class="fa-solid fa-spinner fa-spin"></i><span></span></div>';
            $('iba-phone').appendChild(el);
        }
        el.querySelector('span').textContent = text || 'Saving…';
        el.classList.toggle('hidden', !on);
    }

    // ------------------------------------------------------------------
    // Invoice approvals
    // ------------------------------------------------------------------
    async function loadInvoice(force) {
        if (!A()) return;
        if (state.inv.loading) return;
        if (!force && !stale(state.inv)) return;
        state.inv.loading = true;
        state.inv.error = '';
        if (state.side === 'invoice' && state.tab === 'approve') renderInvoiceApprove();
        try {
            state.inv.list = await A().loadMyInvoiceApprovals();
            state.inv.loadedAt = Date.now();
        } catch (e) {
            console.warn('[phone] invoice approvals', e);
            state.inv.error = 'Could not load your approvals. Tap refresh to try again.';
        } finally {
            state.inv.loading = false;
        }
        if (!state.on) return;
        paintSwitch();
        paintTabs();
        if (state.side === 'invoice' && state.tab === 'approve') renderInvoiceApprove();
    }

    function invCard(t) {
        const pdf = A().pdfUrl(t);
        const ceo = t.kind === 'ceo';
        const amount = t.amountPaid || t.amount || '';
        const used = Number(t.approvalCount || 0);
        return `
          <article class="iba-ph-card" data-inv="${esc(t.key)}">
            <div class="iba-ph-card-top">
              <label class="iba-ph-tick" aria-label="Select"><input type="checkbox" class="iba-ph-sel" data-kind="inv" value="${esc(t.key)}"><span></span></label>
              <div class="iba-ph-card-main">
                <div class="iba-ph-card-kicker">${ceo ? '<span class="iba-ph-chip is-gold">CEO Approval</span>' : '<span class="iba-ph-chip">For Approval</span>'}
                  <span class="iba-ph-chip is-soft" title="Approvals used">${used} of ${A().MAX_APPROVALS}</span></div>
                <h3>${esc(t.vendorName || 'Unknown vendor')}</h3>
                <div class="iba-ph-meta"><span>PO ${esc(t.po)}</span><span>INV ${esc(t.invNumber || '—')}</span></div>
                <div class="iba-ph-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(t.site || '—')}</span></div>
              </div>
              <div class="iba-ph-amount"><strong>${esc(money(amount))}</strong><small>QAR</small></div>
            </div>
            ${t.note ? `<p class="iba-ph-note">${esc(t.note)}</p>` : ''}
            <div class="iba-ph-card-foot">
              ${pdf ? `<a class="iba-ph-link" href="${esc(pdf)}" target="_blank" rel="noopener"><i class="fa-regular fa-file-pdf"></i> View PDF</a>` : '<span class="iba-ph-link is-off">No PDF</span>'}
              <span class="iba-ph-spacer"></span>
              <button type="button" class="iba-ph-btn is-ghost-danger" data-act="inv-reject" data-key="${esc(t.key)}">Reject</button>
              <button type="button" class="iba-ph-btn is-primary" data-act="inv-approve" data-key="${esc(t.key)}">Approve</button>
            </div>
          </article>`;
    }

    function renderInvoiceApprove() {
        const pane = document.querySelector('#iba-phone [data-pane="invoice-approve"]');
        if (!pane) return;
        const list = state.inv.list;
        let html = `<div class="iba-ph-title"><h2>Invoices to approve</h2><span>${state.inv.loading ? 'Loading…' : (list.length + ' waiting')}</span></div>`;
        if (state.inv.error) html += `<div class="iba-ph-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><p>${esc(state.inv.error)}</p></div>`;
        if (!list.length && !state.inv.loading && !state.inv.error) {
            html += `<div class="iba-ph-empty"><i class="fa-solid fa-circle-check"></i><p>Nothing is waiting for your approval.</p></div>`;
        }
        if (list.length) {
            html += bulkBar('inv');
            html += list.map(invCard).join('');
        }
        pane.innerHTML = html;
        updateBulk('inv');
    }

    function bulkBar(kind) {
        return `
          <div class="iba-ph-bulk" data-bulk="${kind}">
            <label class="iba-ph-tick"><input type="checkbox" class="iba-ph-all" data-kind="${kind}"><span></span></label>
            <span class="iba-ph-bulk-text" data-bulk-count="${kind}">Select all</span>
            <button type="button" class="iba-ph-btn is-primary is-small" data-act="${kind}-approve-selected" disabled><i class="fa-solid fa-check-double"></i> Approve selected</button>
          </div>`;
    }

    function selected(kind) {
        return Array.from(document.querySelectorAll(`#iba-phone .iba-ph-sel[data-kind="${kind}"]:checked`)).map(c => c.value);
    }

    function updateBulk(kind) {
        const sel = selected(kind);
        const all = document.querySelectorAll(`#iba-phone .iba-ph-sel[data-kind="${kind}"]`);
        const btn = document.querySelector(`#iba-phone [data-act="${kind}-approve-selected"]`);
        const txt = document.querySelector(`#iba-phone [data-bulk-count="${kind}"]`);
        const allBox = document.querySelector(`#iba-phone .iba-ph-all[data-kind="${kind}"]`);
        if (btn) { btn.disabled = sel.length === 0; btn.innerHTML = `<i class="fa-solid fa-check-double"></i> Approve${sel.length ? ' ' + sel.length : ''} selected`; }
        if (txt) txt.textContent = sel.length ? `${sel.length} selected` : 'Select all';
        if (allBox) allBox.checked = all.length > 0 && sel.length === all.length;
        document.querySelectorAll(`#iba-phone .iba-ph-sel[data-kind="${kind}"]`).forEach(c => {
            const card = c.closest('.iba-ph-card');
            if (card) card.classList.toggle('is-picked', c.checked);
        });
    }

    function findInv(key) { return state.inv.list.find(t => t.key === key) || null; }

    async function approveInvoices(keys) {
        const tasks = keys.map(findInv).filter(Boolean);
        if (!tasks.length) return;
        const one = tasks.length === 1;
        const total = tasks.reduce((s, t) => s + (parseFloat(String(t.amountPaid || t.amount || 0).replace(/,/g, '')) || 0), 0);
        const body = one
            ? `<p><strong>${esc(tasks[0].vendorName)}</strong><br>PO ${esc(tasks[0].po)} · INV ${esc(tasks[0].invNumber || '—')} · QAR ${esc(money(tasks[0].amountPaid || tasks[0].amount))}</p><p class="iba-ph-hint">The invoice gets its own ESN and goes back to ${esc(A().senderName())}.</p>`
            : `<p><strong>${tasks.length} invoices</strong> · total QAR ${esc(money(total))}</p><p class="iba-ph-hint">Each invoice gets its own ESN and goes back to ${esc(A().senderName())}.</p>`;
        const r = await sheet({ title: one ? 'Approve this invoice?' : `Approve ${tasks.length} invoices?`, body, okLabel: 'Approve', placeholder: 'Note for the sender (optional)' });
        if (!r.ok) return;
        busy(true, 'Approving…');
        const results = [];
        const failed = [];
        for (let i = 0; i < tasks.length; i++) {
            busy(true, `Approving ${i + 1} of ${tasks.length}…`);
            try { results.push(await A().decide(tasks[i], 'Approved', { note: r.note })); }
            catch (e) { failed.push(`${tasks[i].po} / ${tasks[i].invNumber || ''}: ${e && e.message ? e.message : e}`); }
        }
        busy(false);
        const done = new Set(results.map(x => x.po + '_' + x.key));
        state.inv.list = state.inv.list.filter(t => !done.has(t.key));
        paintSwitch(); paintTabs(); renderInvoiceApprove();
        await showResults(results, failed);
        loadInvoice(true);
    }

    async function rejectInvoice(key) {
        const t = findInv(key);
        if (!t) return;
        const r = await sheet({
            title: 'Reject this invoice?',
            body: `<p><strong>${esc(t.vendorName)}</strong><br>PO ${esc(t.po)} · INV ${esc(t.invNumber || '—')}</p><p class="iba-ph-hint">It goes back to ${esc(A().senderName())} with your note. No ESN is given.</p>`,
            okLabel: 'Reject', tone: 'danger', requireNote: true,
            placeholder: 'Why is it rejected? (required)',
            requireMessage: 'Please write a note for the sender before rejecting.'
        });
        if (!r.ok) return;
        busy(true, 'Rejecting…');
        try {
            const res = await A().decide(t, 'Rejected', { note: r.note });
            state.inv.list = state.inv.list.filter(x => x.key !== key);
            busy(false);
            paintSwitch(); paintTabs(); renderInvoiceApprove();
            await showResults([res], []);
        } catch (e) {
            busy(false);
            await sheet({ title: 'Not rejected', body: `<p>${esc(e && e.message ? e.message : e)}</p>`, note: false, cancel: false, okLabel: 'OK' });
        }
        loadInvoice(true);
    }

    async function showResults(results, failed) {
        const approved = results.filter(r => r.action === 'Approved');
        const rejected = results.filter(r => r.action === 'Rejected');
        let body = '';
        if (approved.length) {
            body += `<ul class="iba-ph-results">${approved.map(r => `<li><i class="fa-solid fa-circle-check"></i><div><strong>${esc(r.vendorName || 'Invoice')}</strong><span>PO ${esc(r.po)} · INV ${esc(r.invNumber || '—')}</span><code>${esc(r.esn)}</code></div></li>`).join('')}</ul>`;
        }
        if (rejected.length) {
            body += `<ul class="iba-ph-results">${rejected.map(r => `<li class="is-rej"><i class="fa-solid fa-circle-xmark"></i><div><strong>${esc(r.vendorName || 'Invoice')}</strong><span>PO ${esc(r.po)} · INV ${esc(r.invNumber || '—')} · rejected</span></div></li>`).join('')}</ul>`;
        }
        if (failed.length) {
            body += `<div class="iba-ph-failed"><strong>Not done (${failed.length})</strong><ul>${failed.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
        }
        if (results.length) body += `<p class="iba-ph-hint">Sent back to ${esc(results[0].sender || A().senderName())}.</p>`;
        if (approved.length) body += `<button type="button" class="iba-ph-btn is-wa" id="iba-ph-wa"><i class="fa-brands fa-whatsapp"></i> Send to WhatsApp (optional)</button>`;
        const title = approved.length && !rejected.length ? (approved.length === 1 ? 'Approved' : `${approved.length} approved`)
            : (rejected.length && !approved.length ? 'Rejected' : (results.length ? 'Done' : 'Nothing was saved'));
        const p = sheet({ title, body, note: false, cancel: false, okLabel: 'Done' });
        const wa = $('iba-ph-wa');
        if (wa) wa.onclick = () => A().sendWhatsApp(approved);
        await p;
    }

    // ------------------------------------------------------------------
    // Inventory approvals (Pending Admin step)
    // ------------------------------------------------------------------
    function inventoryTypes() {
        try { if (Array.isArray(window.INVENTORY_TYPES)) return window.INVENTORY_TYPES; } catch (_) {}
        return ['Transfer', 'Restock', 'Return', 'Usage'];
    }

    function isMyInventoryApproval(e) {
        if (!e || !inventoryTypes().includes(e.for || e.jobType)) return false;
        const st = String(e.remarks || '').trim();
        if (st !== 'Pending Admin' && st !== 'Pending') return false;
        return isMeOrDelegated(e.approver) || isMeOrDelegated(e.attention);
    }

    async function loadInventory(force) {
        if (state.stk.loading) return;
        if (!mayApproveInventory()) { state.stk.list = []; return; }
        if (!force && !stale(state.stk)) return;
        state.stk.loading = true;
        state.stk.error = '';
        if (state.side === 'inventory' && state.tab === 'approve') renderInventoryApprove();
        try {
            if (typeof ensureAllEntriesFetched === 'function') {
                await ensureAllEntriesFetched(!!force && state.stk.loadedAt > 0, { mode: 'inventory' });
            }
            let src = [];
            try { if (typeof inventorySystemEntries !== 'undefined' && Array.isArray(inventorySystemEntries)) src = inventorySystemEntries; } catch (_) {}
            if (!src.length) { try { if (typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) src = allSystemEntries; } catch (_) {} }
            state.stk.list = src.filter(isMyInventoryApproval)
                .sort((a, b) => (Number(b.timestamp || 0) - Number(a.timestamp || 0)));
            state.stk.loadedAt = Date.now();
        } catch (e) {
            console.warn('[phone] inventory approvals', e);
            state.stk.error = 'Could not load inventory requests. Tap refresh to try again.';
        } finally {
            state.stk.loading = false;
        }
        if (!state.on) return;
        paintSwitch();
        paintTabs();
        if (state.side === 'inventory' && state.tab === 'approve') renderInventoryApprove();
    }

    function requestedQty(t) {
        const a = parseFloat(t.approvedQty);
        if (Number.isFinite(a) && a > 0) return a;
        const o = parseFloat(t.orderedQty != null ? t.orderedQty : t.requiredQty);
        return Number.isFinite(o) ? o : 0;
    }

    function route(t) {
        const type = t.for || t.jobType;
        const from = t.fromLocation || t.fromSite || '';
        const to = t.toLocation || t.toSite || '';
        if (type === 'Usage') return `Used at ${from || '—'}`;
        if (type === 'Restock') return `Into ${to || '—'}`;
        return `${from || '—'} <i class="fa-solid fa-arrow-right-long"></i> ${to || '—'}`;
    }

    function stkCard(t) {
        const type = t.for || t.jobType || 'Transfer';
        const req = requestedQty(t);
        return `
          <article class="iba-ph-card is-stk" data-stk="${esc(t.key)}">
            <div class="iba-ph-card-top">
              <label class="iba-ph-tick" aria-label="Select"><input type="checkbox" class="iba-ph-sel" data-kind="stk" value="${esc(t.key)}"><span></span></label>
              <div class="iba-ph-card-main">
                <div class="iba-ph-card-kicker"><span class="iba-ph-chip is-type-${esc(String(type).toLowerCase())}">${esc(type)}</span><span class="iba-ph-ref">${esc(t.controlNumber || t.ref || '')}</span></div>
                <h3>${esc(t.productName || 'Unknown item')}</h3>
                <div class="iba-ph-meta"><span>${route(t)}</span></div>
                <div class="iba-ph-meta"><span><i class="fa-solid fa-user"></i> ${esc(t.requestor || t.requestedBy || '—')}</span>${t.date ? `<span>${esc(t.date)}</span>` : ''}</div>
              </div>
              <div class="iba-ph-amount"><strong>${esc(qtyText(req))}</strong><small>requested</small></div>
            </div>
            ${t.details ? `<p class="iba-ph-note">${esc(t.details)}</p>` : ''}
            <div class="iba-ph-qty">
              <label for="iba-ph-qty-${esc(t.key)}">Approve qty</label>
              <input type="number" inputmode="decimal" min="0" step="any" max="${esc(req)}" id="iba-ph-qty-${esc(t.key)}" class="iba-ph-qty-in" data-key="${esc(t.key)}" value="${esc(req)}">
              <span class="iba-ph-qty-hint" data-qty-hint="${esc(t.key)}">of ${esc(qtyText(req))}</span>
            </div>
            <div class="iba-ph-card-foot">
              <span class="iba-ph-spacer"></span>
              <button type="button" class="iba-ph-btn is-ghost-danger" data-act="stk-reject" data-key="${esc(t.key)}">Reject</button>
              <button type="button" class="iba-ph-btn is-primary" data-act="stk-approve" data-key="${esc(t.key)}">Approve</button>
            </div>
          </article>`;
    }

    function renderInventoryApprove() {
        const pane = document.querySelector('#iba-phone [data-pane="inventory-approve"]');
        if (!pane) return;
        const list = state.stk.list;
        let html = `<div class="iba-ph-title"><h2>Requests to approve</h2><span>${state.stk.loading ? 'Loading…' : (list.length + ' waiting')}</span></div>`;
        if (state.stk.error) html += `<div class="iba-ph-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><p>${esc(state.stk.error)}</p></div>`;
        if (!list.length && !state.stk.loading && !state.stk.error) {
            html += `<div class="iba-ph-empty"><i class="fa-solid fa-circle-check"></i><p>No transfer, restock, usage or return request is waiting for you.</p></div>`;
        }
        if (list.length) {
            html += bulkBar('stk');
            html += list.map(stkCard).join('');
        }
        pane.innerHTML = html;
        updateBulk('stk');
    }

    function findStk(key) { return state.stk.list.find(t => t.key === key) || null; }

    function qtyFor(key) {
        const el = document.querySelector(`#iba-phone .iba-ph-qty-in[data-key="${CSS.escape(key)}"]`);
        const t = findStk(key);
        const req = t ? requestedQty(t) : 0;
        if (!el) return req;
        const v = parseFloat(el.value);
        return Number.isFinite(v) ? v : NaN;
    }

    // Read the request fresh. Only the approval step may be decided here;
    // if someone else already moved it on, nothing is done.
    async function freshTransfer(key) {
        const dbx = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : ((typeof getInventoryDatabase === 'function') ? getInventoryDatabase() : null);
        if (!dbx) throw new Error('Inventory database is not available.');
        const snap = await dbx.ref(`transfer_entries/${key}`).once('value');
        const t = snap.val();
        if (!t) throw new Error('This request was not found. It may have been deleted.');
        const st = String(t.remarks || '').trim();
        if (st !== 'Pending Admin' && st !== 'Pending') throw new Error(`Already processed (now ${st || t.status || 'changed'}).`);
        return Object.assign({}, t, { key });
    }

    function fillTransferInputs(key, qty, note) {
        const set = (id, v) => { const el = $(id); if (el) el.value = v; };
        set('transfer-modal-key', key);
        set('transfer-modal-qty', qty);
        set('transfer-modal-note', note || '');
        set('transfer-modal-date', new Date().toISOString().split('T')[0]);
    }

    async function runTransfer(key, action, qty, note) {
        if (typeof window.handleTransferAction !== 'function') throw new Error('The inventory engine is not loaded. Please refresh.');
        const fresh = await freshTransfer(key);
        fillTransferInputs(key, qty, note);
        const ok = await window.handleTransferAction(action, {
            skipConfirm: true, silent: true, deferRefresh: true, keepModalOpen: true, prefetchedTask: fresh
        });
        if (ok === false) throw new Error('Not saved. Please check the request on the desktop.');
        return fresh;
    }

    async function approveInventory(keys) {
        const items = keys.map(findStk).filter(Boolean);
        if (!items.length) return;
        const bad = [];
        const plan = items.map(t => {
            const q = qtyFor(t.key);
            const req = requestedQty(t);
            if (!(q > 0)) bad.push(`${t.productName}: enter a quantity above 0`);
            else if (q > req) bad.push(`${t.productName}: cannot approve more than ${qtyText(req)}`);
            return { t, q, req };
        });
        if (bad.length) {
            await sheet({ title: 'Check the quantity', body: `<ul class="iba-ph-plain">${bad.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`, note: false, cancel: false, okLabel: 'OK' });
            return;
        }
        const one = plan.length === 1;
        const body = `<ul class="iba-ph-plain">${plan.map(p => `<li><strong>${esc(p.t.productName)}</strong> · ${esc(p.t.for || p.t.jobType)} · ${esc(qtyText(p.q))}${p.q < p.req ? ` <em>(lowered from ${esc(qtyText(p.req))})</em>` : ''}</li>`).join('')}</ul>`;
        const r = await sheet({ title: one ? 'Approve this request?' : `Approve ${plan.length} requests?`, body, okLabel: 'Approve', placeholder: 'Note (optional)' });
        if (!r.ok) return;
        const done = [];
        const failed = [];
        for (let i = 0; i < plan.length; i++) {
            busy(true, `Approving ${i + 1} of ${plan.length}…`);
            try {
                await runTransfer(plan[i].t.key, 'Approved', plan[i].q, r.note || 'Phone approval');
                done.push(plan[i]);
            } catch (e) {
                failed.push(`${plan[i].t.productName}: ${e && e.message ? e.message : e}`);
            }
        }
        busy(false);
        const doneKeys = new Set(done.map(p => p.t.key));
        state.stk.list = state.stk.list.filter(t => !doneKeys.has(t.key));
        paintSwitch(); paintTabs(); renderInventoryApprove();
        let msg = '';
        if (done.length) msg += `<ul class="iba-ph-results">${done.map(p => `<li><i class="fa-solid fa-circle-check"></i><div><strong>${esc(p.t.productName)}</strong><span>${esc(p.t.for || p.t.jobType)} · ${esc(qtyText(p.q))} approved</span></div></li>`).join('')}</ul>`;
        if (failed.length) msg += `<div class="iba-ph-failed"><strong>Not done (${failed.length})</strong><ul>${failed.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
        await sheet({ title: done.length ? (done.length === 1 ? 'Approved' : `${done.length} approved`) : 'Nothing was saved', body: msg, note: false, cancel: false, okLabel: 'Done' });
    }

    async function rejectInventory(key) {
        const t = findStk(key);
        if (!t) return;
        const r = await sheet({
            title: 'Reject this request?',
            body: `<p><strong>${esc(t.productName)}</strong><br>${esc(t.for || t.jobType)} · ${esc(t.controlNumber || t.ref || '')} · ${esc(qtyText(requestedQty(t)))}</p>`,
            okLabel: 'Reject', tone: 'danger', requireNote: true,
            placeholder: 'Why is it rejected? (required)',
            requireMessage: 'Please write a note before rejecting.'
        });
        if (!r.ok) return;
        busy(true, 'Rejecting…');
        try {
            await runTransfer(key, 'Rejected', requestedQty(t), r.note);
            state.stk.list = state.stk.list.filter(x => x.key !== key);
            busy(false);
            paintSwitch(); paintTabs(); renderInventoryApprove();
        } catch (e) {
            busy(false);
            await sheet({ title: 'Not rejected', body: `<p>${esc(e && e.message ? e.message : e)}</p>`, note: false, cancel: false, okLabel: 'OK' });
        }
    }

    // ------------------------------------------------------------------
    // Records (view only) — reuses the existing Invoice Records search and
    // its phone cards.
    // ------------------------------------------------------------------
    function openRecords() {
        try { if (typeof openMobileInvoiceRecordsRoute === 'function') openMobileInvoiceRecordsRoute(); } catch (e) { console.warn('[phone] records route', e); }
        try { if (typeof imEnsureMobileInvoiceRecordsShell === 'function') imEnsureMobileInvoiceRecordsShell(); } catch (_) {}
        const host = $('iba-ph-rec-host');
        const view = $('im-reporting-mobile-view');
        if (host && view && view.parentNode !== host) host.appendChild(view);
        if (view) {
            view.classList.remove('hidden');
            view.style.setProperty('display', 'block', 'important');
            if (!view.innerHTML.trim()) view.innerHTML = emptyRecords();
        }
        if (!state.recordsReady) {
            state.recordsReady = true;
            const src = $('im-reporting-status-filter');
            const dst = $('iba-ph-rec-status');
            if (src && dst && src.options && src.options.length) {
                dst.innerHTML = Array.from(src.options).map(o => `<option value="${esc(o.value)}">${esc(o.value ? o.textContent : 'All statuses')}</option>`).join('');
            } else if (dst) {
                dst.innerHTML = ['', 'For Approval', 'CEO Approval', 'Approved', 'Rejected', 'For SRV', 'Pending', 'In Process', 'On Hold', 'Report', 'With Accounts', 'Paid']
                    .map(v => `<option value="${esc(v)}">${esc(v || 'All statuses')}</option>`).join('');
            }
            const saved = (() => { try { return sessionStorage.getItem('imReportingSearch') || ''; } catch (_) { return ''; } })();
            if (saved && $('iba-ph-rec-term')) $('iba-ph-rec-term').value = saved;
        }
    }

    function emptyRecords() {
        return '<div class="iba-ph-empty"><i class="fa-solid fa-magnifying-glass"></i><p>Search by PO, vendor or invoice number.</p></div>';
    }

    async function runRecordsSearch() {
        const term = String(($('iba-ph-rec-term') || {}).value || '').trim();
        const status = String(($('iba-ph-rec-status') || {}).value || '');
        const set = (id, v) => { const el = $(id); if (el) el.value = v; };
        set('im-reporting-search', term);
        set('im-reporting-status-filter', status);
        set('im-reporting-site-filter', '');
        set('im-reporting-month-filter', '');
        set('im-reporting-year-filter', '');
        set('im-mobile-inline-search-term', term);
        set('im-mobile-inline-status-filter', status);
        try { sessionStorage.setItem('imReportingSearch', term); } catch (_) {}
        const view = $('im-reporting-mobile-view');
        if (!term && !status) {
            if (view) view.innerHTML = emptyRecords();
            return;
        }
        if (view) view.innerHTML = '<div class="iba-ph-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Searching…</p></div>';
        try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (_) {}
        try {
            if (typeof populateInvoiceReporting === 'function') await populateInvoiceReporting(term);
        } catch (e) {
            console.warn('[phone] records search', e);
            if (view) view.innerHTML = '<div class="iba-ph-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><p>Search failed. Please try again.</p></div>';
        }
        // The search renders into the phone cards; keep them in the phone pane.
        const v2 = $('im-reporting-mobile-view');
        const host = $('iba-ph-rec-host');
        if (v2 && host && v2.parentNode !== host) host.appendChild(v2);
    }

    // ------------------------------------------------------------------
    // Item search — reuses the existing Item Finder (search, scan, photo,
    // stock, movement history, add to request).
    // ------------------------------------------------------------------
    function openSearch() {
        try {
            window.__ibaActiveModule = 'inventory';
            document.body.classList.add('inventory-mode');
            if (typeof window.openInventoryMobileMaterialFinder === 'function') window.openInventoryMobileMaterialFinder();
        } catch (e) { console.warn('[phone] item search', e); }
        const host = $('iba-ph-find-host');
        const sec = $('wd-inv-mobile-material-finder');
        if (host && sec && sec.parentNode !== host) host.appendChild(sec);
        if (sec) { sec.classList.remove('hidden'); sec.classList.add('is-open'); }
        if (!sec && host && !host.innerHTML.trim()) {
            host.innerHTML = '<div class="iba-ph-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><p>Item search is not available. Please refresh.</p></div>';
        }
    }

    // ------------------------------------------------------------------
    // Pane events
    // ------------------------------------------------------------------
    function onPaneClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b || !b.closest('#iba-phone')) return;
        const act = b.getAttribute('data-act');
        const key = b.getAttribute('data-key');
        if (act === 'inv-approve') approveInvoices([key]);
        else if (act === 'inv-reject') rejectInvoice(key);
        else if (act === 'inv-approve-selected') approveInvoices(selected('inv'));
        else if (act === 'stk-approve') approveInventory([key]);
        else if (act === 'stk-reject') rejectInventory(key);
        else if (act === 'stk-approve-selected') approveInventory(selected('stk'));
    }

    function onPaneChange(e) {
        const t = e.target;
        if (!t) return;
        if (t.classList.contains('iba-ph-all')) {
            const kind = t.getAttribute('data-kind');
            document.querySelectorAll(`#iba-phone .iba-ph-sel[data-kind="${kind}"]`).forEach(c => { c.checked = t.checked; });
            updateBulk(kind);
        } else if (t.classList.contains('iba-ph-sel')) {
            updateBulk(t.getAttribute('data-kind'));
        }
    }

    function onPaneInput(e) {
        const t = e.target;
        if (!t || !t.classList.contains('iba-ph-qty-in')) return;
        const key = t.getAttribute('data-key');
        const it = findStk(key);
        const req = it ? requestedQty(it) : 0;
        const v = parseFloat(t.value);
        const hint = document.querySelector(`#iba-phone [data-qty-hint="${CSS.escape(key)}"]`);
        const bad = !(v > 0) || v > req;
        t.classList.toggle('is-bad', bad);
        t.classList.toggle('is-lower', !bad && v < req);
        if (hint) hint.textContent = bad ? (v > req ? `max ${qtyText(req)}` : 'above 0') : (v < req ? `lowered from ${qtyText(req)}` : `of ${qtyText(req)}`);
    }

    // ------------------------------------------------------------------
    // Hooks
    // ------------------------------------------------------------------
    function hookLogin() {
        const orig = window.handleSuccessfulLogin;
        if (typeof orig !== 'function' || orig.__ibaPhone) return;
        const wrapped = function () {
            if (!isPhone()) return orig.apply(this, arguments);
            // On a phone, do not open the desktop dashboard behind the phone
            // workspace (saves the dashboard's Firebase downloads).
            const openPage = window.ibaOpenShellPage;
            window.ibaOpenShellPage = function () { return Promise.resolve(); };
            let result;
            try { result = orig.apply(this, arguments); }
            finally {
                const restore = () => { window.ibaOpenShellPage = openPage; };
                if (result && typeof result.then === 'function') result.then(restore, restore);
                else restore();
            }
            const go = () => { enter(); };
            if (result && typeof result.then === 'function') result.then(go, go);
            else go();
            return result;
        };
        wrapped.__ibaPhone = true;
        window.handleSuccessfulLogin = wrapped;
    }

    function boot() {
        hookLogin();
        // 14.0.0 patch 6: follow the window size both ways. Shrinking a signed-in
        // desktop window to phone width opens the phone workspace; widening it
        // again goes back to the desktop page that was open. Waits until the
        // resizing stops, so dragging the window edge does not flip it back and
        // forth.
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (state.on && !isPhone()) {
                    leave();
                    try {
                        if (typeof window.ibaOpenShellPage === 'function') window.ibaOpenShellPage(window.__ibaNavKey || 'dashboard');
                    } catch (_) {}
                } else if (!state.on && isPhone() && myName() && signedInView()) {
                    enter();
                }
            }, 300);
        });
        window.addEventListener('iba:backgrounds-changed', () => { if (state.on) paintPhoneBg(); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !state.on) return;
            if (state.side === 'invoice' && state.tab === 'approve') loadInvoice(false);
            if (state.side === 'inventory' && state.tab === 'approve') loadInventory(false);
        });
        console.info(`%cIBA phone workspace ${VERSION} loaded`, 'color:#138A97;font-weight:700');
    }

    window.ibaPhone = {
        VERSION,
        enter, leave, refresh, setSide, setTab,
        isOn: () => state.on,
        state: () => ({ side: state.side, tab: state.tab, invoices: state.inv.list.length, inventory: state.stk.list.length })
    };

    boot();
})();
