/* 17.0.5 patch 189 (martin): "Delete & undo" a COMPLETED inventory transaction (Super Admin only).
 * Example: a site got a Restock approved instead of a Transfer for the one telehandler -> +1 that does
 * not exist. The button reverses exactly what that transaction did to the stock, removes the record,
 * and keeps a full copy in stock_adjustments (who, when, why, what changed) so it can be traced.
 *   Restock  : took +received at To          -> undo: -received at To
 *   Usage    : took -used at From             -> undo: +used at From
 *   Transfer : -approved at From, +received at To -> undo: +approved at From, -received at To
 *   Return   : (from Restock) -approved at From; (from Usage) +approved at From;
 *              else -approved at From, +received at To -> the opposite
 * Never blocks: if a site no longer holds enough to take back, it says so and offers to take what is there.
 * Buttons: Material Stock > open a row > Movement History, and Inventory Job Records. */
(function () {
    'use strict';
    var DONE = ['Completed', 'Received', 'SRV Done'];
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        var u = me(); return !!u && u.Name === 'Irwin';
    }
    function db() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb) return inventoryDb; } catch (_) {}
        try { if (typeof getInventoryDatabase === 'function') return getInventoryDatabase(); } catch (_) {}
        return null;
    }
    function canon(s) {
        try { if (typeof window.stockCanonicalSiteKey === 'function') return window.stockCanonicalSiteKey(s); } catch (_) {}
        var raw = String(s || '').trim(); if (!raw) return '';
        if (raw.toLowerCase() === 'main store') return 'Main Store';
        return raw.split(/\s+-\s+/)[0].trim().replace(/[.#$[\]\/]/g, '');
    }
    function same(a, b) {
        try { if (typeof window.stockSiteKeysMatch === 'function') return window.stockSiteKeysMatch(a, b); } catch (_) {}
        return canon(a) === canon(b);
    }
    function isDone(t) { return DONE.indexOf(String((t && t.remarks) || '').trim()) !== -1; }
    function pidOf(t) { return String((t && (t.productID || t.productId)) || '').trim(); }

    // what undoing this transaction does to each site
    function effects(t) {
        var type = String(t.jobType || t.for || '').trim();
        var orig = String(t.originalJobType || '').trim();
        var from = String(t.fromLocation || t.fromSite || '').trim();
        var to = String(t.toLocation || t.toSite || '').trim();
        var recv = num(t.receivedQty) || num(t.approvedQty) || num(t.orderedQty);
        var appr = num(t.approvedQty) || num(t.orderedQty) || recv;
        var out = [];
        if (type === 'Restock') out.push({ site: to, delta: -recv });
        else if (type === 'Usage') out.push({ site: from, delta: recv });
        else if (type === 'Transfer') { out.push({ site: from, delta: appr }); out.push({ site: to, delta: -recv }); }
        else if (type === 'Return') {
            if (orig === 'Restock') out.push({ site: from, delta: appr });
            else if (orig === 'Usage') out.push({ site: from, delta: -appr });
            else { out.push({ site: from, delta: appr }); out.push({ site: to, delta: -recv }); }
        }
        return out.filter(function (e) { return e.site && e.delta; });
    }

    // loose: the row only knows key + status (Inventory Job Records); the product is read on press
    function btn(t, loose) {
        if (!t || !t.key || !isSuper() || !isDone(t) || (!loose && !pidOf(t))) return '';
        return '<button type="button" class="iba-txundo-btn" data-tx-undo="' + esc(t.key) + '" title="Super Admin: delete this transaction and undo its stock change"><i class="fa-solid fa-rotate-left"></i> Delete &amp; undo</button>';
    }

    async function siteQty(pid) {
        var d = db(); var out = {};
        var snap = await d.ref('material_stock').orderByChild('productID').equalTo(pid).once('value');
        if (!snap.exists()) snap = await d.ref('material_stock').orderByChild('productId').equalTo(pid).once('value');
        var v = snap.val() || {};
        var name = '';
        Object.keys(v).forEach(function (k) {
            var c = v[k] || {}; if (c.mergedInto) return;
            if (!name) name = c.productName || '';
            Object.keys(c.sites || {}).forEach(function (s) { out[s] = (out[s] || 0) + num(c.sites[s]); });
        });
        return { sites: out, name: name };
    }
    function qtyAt(map, site) { var n = 0; Object.keys(map).forEach(function (s) { if (same(s, site)) n += map[s]; }); return n; }
    function fmt(n) { return String(Math.round(n * 1000) / 1000); }

    function modal(html) {
        var o = document.createElement('div');
        o.className = 'iba-txundo-ov';
        o.innerHTML = '<div class="iba-txundo-box" role="dialog" aria-modal="true" aria-label="Delete and undo">' + html + '</div>';
        document.body.appendChild(o);
        o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
        return o;
    }

    async function run(key) {
        if (!isSuper()) { alert('Only Super Admin can delete and undo a transaction.'); return; }
        var d = db(); if (!d) { alert('Inventory is not ready yet. Try again in a moment.'); return; }
        var o = modal('<h3><i class="fa-solid fa-rotate-left"></i> Delete &amp; undo</h3><p class="iba-txundo-muted"><i class="fa-solid fa-spinner fa-spin"></i> Checking…</p>');
        var t, info;
        try {
            var snap = await d.ref('transfer_entries/' + key).once('value');
            t = snap.val();
            if (!t) { o.querySelector('.iba-txundo-box').innerHTML = '<h3>Delete &amp; undo</h3><p>This transaction is not there any more (already deleted?).</p><div class="iba-txundo-acts"><button type="button" data-x>Close</button></div>'; o.querySelector('[data-x]').onclick = function () { o.remove(); }; return; }
            t.key = key;
            info = await siteQty(pidOf(t));
        } catch (e) { o.remove(); alert('Could not read the transaction: ' + (e && e.message ? e.message : e)); return; }
        if (!isDone(t)) { o.remove(); alert('This transaction is not completed yet. Use Del (it puts back any stock already taken).'); return; }
        if (!pidOf(t)) { o.remove(); alert('This record has no product ID, so its stock change cannot be worked out. Nothing was changed.'); return; }
        var eff = effects(t);
        var ctrl = t.controlNumber || t.controlId || t.ref || key;
        var type = t.jobType || t.for || '';
        var short = [];
        var rows = eff.map(function (e) {
            var before = qtyAt(info.sites, e.site), after = before + e.delta;
            if (after < -1e-9) short.push({ site: e.site, have: before, need: -e.delta });
            return '<tr><td>' + esc(canon(e.site) || e.site) + '</td><td>' + fmt(before) + '</td><td>→</td><td class="' + (after < 0 ? 'is-neg' : '') + '"><b>' + fmt(Math.max(0, after)) + '</b></td><td class="iba-txundo-muted">' + (e.delta > 0 ? '+' : '') + fmt(e.delta) + '</td></tr>';
        }).join('');
        var warn = short.length ? '<div class="iba-txundo-warn"><i class="fa-solid fa-triangle-exclamation"></i> ' + short.map(function (s) { return esc(canon(s.site)) + ' has only ' + fmt(s.have) + ', so ' + fmt(s.need) + ' can\'t all be taken back (it may have moved since). It will go to 0.'; }).join('<br>') + '</div>' : '';
        o.querySelector('.iba-txundo-box').innerHTML =
            '<h3><i class="fa-solid fa-rotate-left"></i> Delete &amp; undo</h3>' +
            '<p><b>' + esc(type) + ' ' + esc(ctrl) + '</b> · ' + esc(t.productName || info.name || pidOf(t)) + '</p>' +
            '<p class="iba-txundo-muted">' + esc(t.fromLocation || t.fromSite || '') + ((t.toLocation || t.toSite) ? ' → ' + esc(t.toLocation || t.toSite) : '') + ' · qty ' + esc(t.receivedQty || t.approvedQty || t.orderedQty || '') + ' · ' + esc(t.remarks || '') + '</p>' +
            (rows ? '<table class="iba-txundo-tbl"><thead><tr><th>Site</th><th>Now</th><th></th><th>After</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p>No stock change to undo (no qty recorded). Only the record will be removed.</p>') +
            warn +
            '<label class="iba-txundo-lbl">Reason (optional)<input type="text" data-why placeholder="e.g. Restock by mistake, should have been a transfer"></label>' +
            '<p class="iba-txundo-muted">The record is removed. A full copy is kept in the stock adjustments log.</p>' +
            '<div class="iba-txundo-acts"><button type="button" data-x>Cancel</button><button type="button" class="is-danger" data-go>Delete &amp; undo</button></div>';
        o.querySelector('[data-x]').onclick = function () { o.remove(); };
        o.querySelector('[data-go]').onclick = async function () {
            var b = this; b.disabled = true; b.textContent = 'Working…';
            var why = String((o.querySelector('[data-why]') || {}).value || '').trim();
            var done = [];
            try {
                // take back first (a failure here stops before anything is added), then give back
                var order = eff.slice().sort(function (a, c) { return a.delta - c.delta; });
                for (var i = 0; i < order.length; i++) {
                    var e = order[i];
                    var amt = Math.abs(e.delta);
                    if (e.delta < 0) {
                        var have = qtyAt((await siteQty(pidOf(t))).sites, e.site);
                        amt = Math.min(amt, have);
                        if (amt <= 0) { done.push({ site: canon(e.site), delta: 0 }); continue; }
                        await runStockTransaction(pidOf(t), amt, 'Deduct', e.site);
                        done.push({ site: canon(e.site), delta: -amt });
                    } else {
                        await runStockTransaction(pidOf(t), amt, 'Add', e.site);
                        done.push({ site: canon(e.site), delta: amt });
                    }
                }
                var u = me();
                await d.ref('stock_adjustments').push({
                    type: 'Delete & undo', productID: pidOf(t), productName: t.productName || info.name || '', controlNumber: ctrl, transferKey: key,
                    changes: done, reason: why, by: (u && u.Name) || '', at: Date.now(), entry: JSON.parse(JSON.stringify(t))
                });
                await d.ref('transfer_entries/' + key).remove();
            } catch (err) {
                b.disabled = false; b.textContent = 'Delete & undo';
                alert('Stopped: ' + (err && err.message ? err.message : err) + (done.length ? '\n\nAlready changed: ' + done.map(function (x) { return x.site + ' ' + (x.delta > 0 ? '+' : '') + x.delta; }).join(', ') + '. The record was NOT removed.' : '\n\nNothing was changed.'));
                return;
            }
            o.remove();
            refresh(key);
            alert('Deleted ' + ctrl + '. Stock: ' + (done.length ? done.map(function (x) { return x.site + ' ' + (x.delta > 0 ? '+' : '') + fmt(x.delta); }).join(', ') : 'no change') + '.');
        };
    }

    function refresh(key) {
        try { if (typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) { var i = allSystemEntries.findIndex(function (x) { return x && x.key === key; }); if (i !== -1) allSystemEntries.splice(i, 1); } } catch (_) {}
        try { if (typeof filterAndRenderReport === 'function' && document.getElementById('reporting-table-body')) filterAndRenderReport(allSystemEntries); } catch (_) {}
        // 17.0.5 patch 190: Movement History reads allTransferData (kept in memory), drop the deleted one
        // so the history, the "should be here" check and Align match the stock at once (no page refresh)
        try { if (typeof allTransferData !== 'undefined' && Array.isArray(allTransferData)) { for (var j = allTransferData.length - 1; j >= 0; j--) { if (allTransferData[j] && allTransferData[j].key === key) allTransferData.splice(j, 1); } } } catch (_) {}
        try { document.querySelectorAll('tr[data-item-key]').forEach(function (r) { if (r.dataset.ready === '1') r.dataset.ready = ''; }); } catch (_) {}
        try { if (typeof STOCK_CACHE_KEY !== 'undefined') localStorage.removeItem(STOCK_CACHE_KEY); } catch (_) {}
        try {
            if (typeof populateMaterialStock === 'function' && document.getElementById('ms-table-body')) {
                Promise.resolve(populateMaterialStock(true)).then(function () {
                    // re-fill any item still open with the fresh stock + history
                    document.querySelectorAll('tr[data-item-key]').forEach(function (r) { if (r.dataset.ready !== '1' && r.offsetParent && typeof window.msFillStockDetail === 'function') window.msFillStockDetail(r); });
                }, function () {});
            }
        } catch (_) {}
        document.querySelectorAll('[data-tx-undo="' + key + '"]').forEach(function (b) { var tr = b.closest('tr'); if (tr) tr.remove(); });
    }

    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-tx-undo]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        run(b.getAttribute('data-tx-undo'));
    }, true);

    window.ibaTxUndo = { btn: btn, run: run, effects: effects };
})();
