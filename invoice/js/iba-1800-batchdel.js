/* 18.0.0 patch 25 (martin): Batch Entry + PO pull-out list.
   - Every Batch card whose original PO is Active in the PO file (progress-po records) gets +Del,
     but only ONE per PO: with 3 new invoices on one PO the first card carries it (one paper = one click).
     After the click it shows "On pull-out list" (ibaPoFile.markButton).
   - Toolbar button "Add in-file POs to pull-out list (N)": one click puts every Active PO of the batch
     on the pull-out list. Wrong ones are removed in the PO pull-out list skill.
   - Super Admin only (same as the pull-out list). One indexed read per PO (cached 10 min), never the file. */
(function () {
    'use strict';
    if (window.ibaBatchDel) return;
    const TTL = 10 * 60 * 1000;
    const cache = {};            // po -> { at, p: Promise<bool> }
    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
    const $ = (id) => document.getElementById(id);
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function say(m) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(m); } catch (_) {} alert(m); }
    function inFile(po) {
        const p = normPO(po);
        if (!p || !window.ibaPoFile) return Promise.resolve(false);
        const c = cache[p];
        if (c && Date.now() - c.at < TTL) return c.p;
        const pr = window.ibaPoFile.lookup(p).then((v) => !!window.ibaPoFile.activeOf(v)).catch(() => false);
        cache[p] = { at: Date.now(), p: pr };
        return pr;
    }
    function cards() { const b = $('im-batch-table-body'); return b ? Array.from(b.querySelectorAll('.batch-invoice-card')) : []; }
    function headOf(card) {
        return card.querySelector('.batch-card-header [title="PO Number"] > div:last-child') || card.querySelector('.batch-card-header [title="PO Number"]');
    }
    function makeBtn(card, po) {
        const head = headOf(card);
        if (!head) return null;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'iba-rb-del im-po-collect-btn';
        head.appendChild(b);
        if (typeof window.imResetPOFileActionButton === 'function') window.imResetPOFileActionButton(b, po, false);
        else b.onclick = () => window.imAddToDeletionCollection && window.imAddToDeletionCollection(po);
        b.dataset.poFilePo = po;
        if (!b.classList.contains('is-added')) {
            b.innerHTML = '<i class="fa-solid fa-folder-open"></i> +Del';
            b.title = 'Original PO is in the file: add it to the PO pull-out list';
        }
        if (window.ibaPoFile && window.ibaPoFile.markButton) window.ibaPoFile.markButton(b);
        return b;
    }
    let active = [];             // Active POs in the batch (for the toolbar button)
    let seq = 0;
    async function scan() {
        const my = ++seq;
        if (!isSuper()) { paintAll(); return; }
        const byPo = {};
        cards().forEach((c) => { const p = normPO(c.dataset.po); if (p) (byPo[p] = byPo[p] || []).push(c); });
        const pos = Object.keys(byPo);
        const res = await Promise.all(pos.map((p) => inFile(p)));
        if (my !== seq) return;
        active = [];
        pos.forEach((p, i) => {
            const list = byPo[p].filter((c) => c.isConnected);
            if (!list.length) return;
            const btns = list.map((c) => c.querySelector('.iba-rb-del'));
            if (!res[i]) { btns.forEach((b) => b && b.remove()); return; }
            active.push(p);
            // keep one button (the first one already there, else on the first card), drop the rest
            let keep = btns.find(Boolean) || null;
            btns.forEach((b) => { if (b && b !== keep) b.remove(); });
            if (!keep) keep = makeBtn(list[0], p);
            else if (window.ibaPoFile && window.ibaPoFile.markButton) window.ibaPoFile.markButton(keep);
        });
        paintAll();
    }
    function pending() {
        return active.filter((p) => !cards().some((c) => normPO(c.dataset.po) === p && c.querySelector('.iba-rb-del.is-added')));
    }
    function paintAll() {
        let b = $('iba-bd-all');
        const menu = $('iba-bb-menu'), anchor = $('im-batch-search-by-status-button');
        if (!b && (menu || (anchor && anchor.parentNode))) {
            b = document.createElement('button');
            b.type = 'button';
            b.id = 'iba-bd-all';
            b.className = 'secondary-btn';
            (menu || anchor.parentNode).appendChild(b);
        }
        if (!b) return;
        if (menu && b.parentNode !== menu) menu.appendChild(b);
        const n = isSuper() ? pending().length : 0;
        try { window.dispatchEvent(new CustomEvent('iba:bd-count', { detail: { n } })); } catch (_) {}
        b.hidden = !n;
        b.style.display = n ? '' : 'none';
        b.innerHTML = '<i class="fa-solid fa-folder-minus"></i> Add in-file POs to pull-out list (' + n + ')';
        b.title = 'Put every PO of this batch whose original is in your file on the PO pull-out list (one click). Remove wrong ones in the pull-out list.';
    }
    async function addAll(btn) {
        const list = pending();
        if (!list.length || !window.ibaPoFile || !window.ibaPoFile.addOne) return;
        btn.disabled = true;
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding ' + list.length + '…';
        let ok = 0; const bad = [];
        for (const p of list) {
            const r = await window.ibaPoFile.addOne(p);
            if (r && r.ok) ok += 1; else if (r && r.why && r.why !== 'already on the list') bad.push('PO ' + p + ': ' + r.why);
        }
        btn.disabled = false; btn.innerHTML = old;
        document.querySelectorAll('#im-batch-table-body .iba-rb-del').forEach((b) => window.ibaPoFile.markButton && window.ibaPoFile.markButton(b));
        paintAll();
        say(ok + ' PO' + (ok === 1 ? '' : 's') + ' added to the pull-out list.' + (bad.length ? ' Not added: ' + bad.join('; ') : ''));
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#iba-bd-all');
        if (b) { e.preventDefault(); addAll(b); }
        else if (e.target.closest && e.target.closest('#im-batch-table-body .iba-rb-del')) setTimeout(paintAll, 1500);
    }, true);
    let t = 0;
    const kick = () => { clearTimeout(t); t = setTimeout(scan, 350); };
    function hook() {
        const body = $('im-batch-table-body');
        if (!body) return false;
        new MutationObserver((m) => { if (m.some((x) => x.type === 'childList' && Array.from(x.addedNodes).concat(Array.from(x.removedNodes)).some((n) => n.nodeType === 1 && n.classList && n.classList.contains('batch-invoice-card')))) kick(); })
            .observe(body, { childList: true });
        kick();
        return true;
    }
    if (!hook()) document.addEventListener('DOMContentLoaded', hook, { once: true });
    window.ibaBatchDel = { scan, inFile };
})();
