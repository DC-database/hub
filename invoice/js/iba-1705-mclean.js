/* 17.0.5 patch 201 (martin): Material Stock > More tools > "Empty merged items" (Super Admin).
   A merge leaves the merged-away cards at zero with mergedInto = the main ID. This window lists
   them in a table for review, then deletes them one by one or all ticked at once.
   - Only the empty CARD is removed (material_stock/<key>); movement history is never touched
     (Delete Selected also deletes history, this does not).
   - A card that has stock again (or is no longer marked merged) cannot be deleted: checked
     again on the live record just before deleting.
   - Undo a merge still works later: it rebuilds a deleted card from the merge log.
   Uses the list already loaded on the page + the last 300 merge log rows (for "By"). */
(function () {
    'use strict';
    if (window.ibaMergeClean) return;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function db() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb && inventoryDb.ref) return inventoryDb; } catch (_) {}
        try { if (typeof getInventoryDatabase === 'function') return getInventoryDatabase(); } catch (_) {}
        return null;
    }
    function stockOf(c) {
        let t = 0, any = false;
        Object.values((c && c.sites) || {}).forEach((v) => { t += num(v); any = true; });
        return any ? t : num(c && (c.stockQty != null ? c.stockQty : c.balanceQty));
    }
    function when(ts) { const d = new Date(Number(ts) || 0); return !ts || isNaN(d) ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    function items() { try { return (typeof allMaterialStockData !== 'undefined' && Array.isArray(allMaterialStockData)) ? allMaterialStockData : []; } catch (_) { return []; } }

    // ---- the menu button (moved into More tools by iba-1705-msmenu.js) ----
    function ensureBtn() {
        let b = $('ms-merge-clean-btn');
        const undo = $('ms-merge-undo-btn');
        if (!b && undo) {
            b = document.createElement('button');
            b.id = 'ms-merge-clean-btn'; b.type = 'button'; b.className = 'secondary-btn hidden';
            b.title = 'Review and delete the empty cards left after a merge';
            b.innerHTML = '<i class="fa-solid fa-broom"></i> Empty merged items';
            undo.after(b);
        }
        if (b) { const ok = isSuper(); if (b.classList.contains('hidden') === ok) b.classList.toggle('hidden', !ok); }
    }

    // ---- window ----
    let rows = [];
    function layer(html) {
        const old = $('iba-mclean'); if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-mclean'; w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-um-box" role="dialog" aria-modal="true" aria-label="Empty merged items">' + html + '</div>';
        document.body.appendChild(w);
        return w;
    }
    const head = '<div class="iba-pb-head"><b><i class="fa-solid fa-broom"></i> Empty merged items</b><button type="button" class="iba-um-x" data-mc-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>';

    async function open() {
        if (!isSuper()) { alert('Only the Super Admin can delete merged items.'); return; }
        const w = layer(head + '<div class="iba-pb-sub"><p><i class="fa-solid fa-circle-notch fa-spin"></i> Looking for merged items…</p></div>');
        bind(w);
        const by = {};
        try {
            const d = db();
            if (d) {
                const s = await d.ref('stock_merges').limitToLast(300).once('value');
                const v = s.val() || {};
                Object.values(v).forEach((l) => {
                    const list = Array.isArray(l && l.merged) ? l.merged : Object.values((l && l.merged) || {});
                    list.forEach((m) => { if (m && m.key && !l.undoneAt) by[m.key] = { by: l.by || '', at: l.at || 0 }; });
                });
            }
        } catch (e) { console.warn('[IBA] merge log', e); }
        rows = items().filter((c) => c && c.key && c.mergedInto).map((c) => {
            const st = stockOf(c);
            const lg = by[c.key] || {};
            return { key: c.key, id: String(c.productID || c.productId || '').trim(), name: String(c.productName || c.productTitle || c.name || '').trim(),
                into: String(c.mergedInto).trim(), at: Number(c.mergedAt) || Number(lg.at) || 0, by: lg.by || '', stock: st, ok: Math.abs(st) < 1e-9 };
        }).sort((a, b) => (b.at - a.at) || a.id.localeCompare(b.id, undefined, { numeric: true }));
        draw(w);
    }

    function draw(w) {
        const sub = w.querySelector('.iba-pb-sub');
        if (!rows.length) {
            sub.innerHTML = '<p>No merged items left to clean up.</p>' + (items().length ? '' : '<p class="iba-um-bad">Material Stock is not loaded in this browser yet. Open Material Stock first, then try again.</p>');
            return;
        }
        const can = rows.filter((r) => r.ok).length;
        sub.innerHTML = '<p>' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + ' were merged into another card. Check them, then delete. ' +
            'Only the empty card goes: <b>its movement history stays</b>. Greyed rows still have stock and cannot be deleted.</p>' +
            '<div class="iba-mc-bar"><label class="iba-mc-all"><input type="checkbox" data-mc-all> Select all (' + can + ')</label>' +
            '<button type="button" class="iba-um-btn" data-mc-delsel disabled><i class="fa-solid fa-trash"></i> Delete ticked (0)</button></div>' +
            '<div class="iba-um-scroll"><table class="iba-um-table"><thead><tr><th></th><th>Item ID</th><th>Name</th><th>Merged into</th><th>Merged on</th><th>By</th><th class="r">Stock</th><th></th></tr></thead><tbody>' +
            rows.map((r) => '<tr data-mc-row="' + esc(r.key) + '" class="' + (r.ok ? '' : 'is-done') + '">' +
                '<td>' + (r.ok ? '<input type="checkbox" data-mc-tick="' + esc(r.key) + '">' : '') + '</td>' +
                '<td><b>' + esc(r.id) + '</b></td><td>' + esc(r.name) + '</td><td><b>' + esc(r.into) + '</b></td>' +
                '<td>' + esc(when(r.at)) + '</td><td>' + esc(r.by) + '</td><td class="r">' + esc(fmt(r.stock)) + '</td>' +
                '<td>' + (r.ok ? '<button type="button" class="iba-um-btn" data-mc-del="' + esc(r.key) + '"><i class="fa-solid fa-trash"></i> Delete</button>' : '<span class="iba-um-bad">has stock</span>') + '</td></tr>').join('') +
            '</tbody></table></div><p class="iba-um-msg" data-mc-msg></p>';
    }

    function ticked(w) { return Array.from(w.querySelectorAll('[data-mc-tick]:checked')).map((x) => x.getAttribute('data-mc-tick')); }
    function paintSel(w) {
        const b = w.querySelector('[data-mc-delsel]'); if (!b) return;
        const n = ticked(w).length;
        b.disabled = !n; delete b.dataset.sure;
        b.innerHTML = '<i class="fa-solid fa-trash"></i> Delete ticked (' + n + ')';
    }
    function msg(w, html) { const m = w.querySelector('[data-mc-msg]'); if (m) m.innerHTML = html; }

    async function remove(keys) {
        const d = db();
        if (!d) return { done: [], skipped: keys.map((k) => ({ k, why: 'database not loaded' })) };
        const upd = {}, done = [], skipped = [];
        for (const k of keys) {
            let live = null;
            try { live = (await d.ref('material_stock/' + k).once('value')).val(); } catch (e) { skipped.push({ k, why: 'could not read' }); continue; }
            if (!live) { done.push(k); continue; }                       // already gone
            if (!live.mergedInto) { skipped.push({ k, why: 'no longer marked as merged' }); continue; }
            if (Math.abs(stockOf(live)) > 1e-9) { skipped.push({ k, why: 'has stock again' }); continue; }
            upd['material_stock/' + k] = null;
            done.push(k);
        }
        const n = Object.keys(upd).length;
        if (n) {
            upd['material_stock_meta/count'] = firebase.database.ServerValue.increment(-n);
            upd['material_stock_meta/updatedAt'] = firebase.database.ServerValue.TIMESTAMP;
            await d.ref().update(upd);
            for (const k of done) { try { await window.inventoryPocket?.removeMaterialFromPocketByKey(k); } catch (_) {} }
            try { localStorage.removeItem('cached_MATERIAL_STOCK'); } catch (_) {}
        }
        // take them out of the page list straight away
        try { const set = new Set(done); for (let i = allMaterialStockData.length - 1; i >= 0; i--) if (set.has(allMaterialStockData[i].key)) allMaterialStockData.splice(i, 1); } catch (_) {}
        return { done, skipped };
    }

    async function run(w, keys, btn) {
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Deleting…';
        let res;
        try { res = await remove(keys); }
        catch (e) { msg(w, '<span class="iba-um-bad">Could not delete: ' + esc((e && e.message) || e) + '. Nothing was changed.</span>'); btn.disabled = false; delete btn.dataset.sure; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete'; return; }
        const gone = new Set(res.done);
        const names = rows.filter((r) => gone.has(r.key)).map((r) => r.id);
        rows = rows.filter((r) => !gone.has(r.key));
        draw(w);
        let t = names.length ? '<span class="iba-um-ok"><i class="fa-solid fa-check"></i> Deleted ' + names.length + ': ' + esc(names.join(', ')) + '</span>' : '';
        if (res.skipped.length) t += ' <span class="iba-um-bad">Not deleted: ' + res.skipped.map((s) => esc((rows.find((r) => r.key === s.k) || {}).id || s.k) + ' (' + esc(s.why) + ')').join(', ') + '</span>';
        msg(w, t);
        try { if (typeof populateMaterialStock === 'function') populateMaterialStock(true); } catch (_) {}
    }

    function bind(w) {
        w.addEventListener('click', (e) => {
            if (e.target === w || (e.target.closest && e.target.closest('[data-mc-x]'))) { w.remove(); return; }
            const one = e.target.closest && e.target.closest('[data-mc-del]');
            const sel = e.target.closest && e.target.closest('[data-mc-delsel]');
            const b = one || sel;
            if (!b || b.disabled) return;
            const keys = one ? [one.getAttribute('data-mc-del')] : ticked(w);
            if (!keys.length) return;
            if (!b.dataset.sure) {
                w.querySelectorAll('[data-mc-del], [data-mc-delsel]').forEach((x) => { if (x !== b && x.dataset.sure) { delete x.dataset.sure; x.innerHTML = x.hasAttribute('data-mc-delsel') ? '<i class="fa-solid fa-trash"></i> Delete ticked (' + ticked(w).length + ')' : '<i class="fa-solid fa-trash"></i> Delete'; } });
                b.dataset.sure = '1';
                b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Yes, delete' + (keys.length > 1 ? ' ' + keys.length : '');
                msg(w, 'Are you sure? Press <b>Yes, delete</b> to remove ' + (keys.length === 1 ? 'this empty card' : keys.length + ' empty cards') + '. History is kept.');
                return;
            }
            run(w, keys, b);
        });
        w.addEventListener('change', (e) => {
            if (e.target.matches('[data-mc-all]')) w.querySelectorAll('[data-mc-tick]').forEach((x) => { x.checked = e.target.checked; });
            if (e.target.matches('[data-mc-all], [data-mc-tick]')) paintSel(w);
        });
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { w.remove(); document.removeEventListener('keydown', esc); } });
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#ms-merge-clean-btn');
        if (!b) return;
        e.preventDefault();
        open();
    });
    function start() { ensureBtn(); setInterval(ensureBtn, 3000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaMergeClean = { open, remove };
})();
