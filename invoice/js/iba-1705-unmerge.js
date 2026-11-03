/* ==========================================================================
   js/iba-1705-unmerge.js — 17.0.5 patch 81
   Material Stock: "Undo a merge" (Super Admin). Lists the recent merges
   from the merge log (stock_merges) and undoes one made by mistake:
   - the main card gives back EXACTLY the quantities the log says, per site
     (stops if the main card no longer has that much at a site: nothing changes);
   - each merged card gets its quantities back (a deleted card is rebuilt
     from the full copy the log keeps since patch 81, or from ID + quantities);
   - the transfers that were moved go back to their old Product ID;
   - the log entry is marked undone (it cannot be undone twice).
   Transfers made on the main card AFTER the merge stay on the main card.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || 'Irwin'; } catch (_) { return 'Irwin'; } }
    function db() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb && inventoryDb.ref) return inventoryDb; } catch (_) {}
        try { if (typeof getInventoryDatabase === 'function') return getInventoryDatabase(); } catch (_) {}
        return null;
    }
    function canon(site) {
        try { if (typeof window.stockCanonicalSiteKey === 'function') return window.stockCanonicalSiteKey(site); } catch (_) {}
        try { if (typeof msCanonSiteKey === 'function') return msCanonSiteKey(site); } catch (_) {}
        return String(site || '').trim().replace(/[.#$[\]\/]/g, '');
    }
    function siteName(s) { try { if (typeof msSiteDisplayName === 'function') return msSiteDisplayName(s); } catch (_) {} return s; }
    function total(sites) { let t = 0; Object.values(sites || {}).forEach((v) => { t += num(v); }); return t; }
    const list = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    function when(ts) { const d = new Date(Number(ts) || 0); return isNaN(d) || !ts ? '' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

    // amounts the main card must give back, by its (canonical) site keys
    function need(log) {
        const out = {};
        list(log.merged).forEach((m) => Object.entries(m.sites || {}).forEach(([s, q]) => { const k = canon(s) || s; out[k] = (out[k] || 0) + num(q); }));
        Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
        return out;
    }

    function layer(html) {
        const old = document.getElementById('iba-unmerge');
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-unmerge';
        w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-um-box" role="dialog" aria-modal="true" aria-label="Undo a merge">' + html + '</div>';
        document.body.appendChild(w);
        return w;
    }
    const head = '<div class="iba-pb-head"><b><i class="fa-solid fa-rotate-left"></i> Undo a merge</b><button type="button" class="iba-um-x" data-um-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>';

    let logs = [];
    async function open() {
        if (!isSuper()) { alert('Only the Super Admin can undo a merge.'); return; }
        const d = db();
        if (!d) { alert('The inventory database is not loaded.'); return; }
        const w = layer(head + '<div class="iba-pb-sub"><p><i class="fa-solid fa-circle-notch fa-spin"></i> Loading recent merges…</p></div>');
        bind(w);
        try {
            const snap = await d.ref('stock_merges').limitToLast(25).once('value');
            const v = (snap && snap.val()) || {};
            logs = Object.keys(v).map((k) => Object.assign({ k: k }, v[k])).sort((a, b) => num(b.at) - num(a.at));
        } catch (e) { w.querySelector('.iba-pb-sub').innerHTML = '<p class="iba-um-bad">Could not read the merge log: ' + esc((e && e.message) || e) + '</p>'; return; }
        draw(w);
    }
    function draw(w) {
        const sub = w.querySelector('.iba-pb-sub');
        if (!logs.length) { sub.innerHTML = '<p>No merges found.</p>'; return; }
        sub.innerHTML = '<p>The last ' + logs.length + ' merges, newest first. <b>Undo</b> gives every card back exactly what the merge moved. Transfers made on the main card after the merge stay where they are.</p>' +
            '<div class="iba-um-scroll"><table class="iba-um-table"><thead><tr><th>When</th><th>Into (main card)</th><th>Merged cards and quantities moved</th><th>By</th><th></th></tr></thead><tbody>' +
            logs.map((l) => '<tr class="' + (l.undoneAt ? 'is-done' : '') + '"><td>' + esc(when(l.at)) + '</td><td><b>' + esc(l.mainId) + '</b></td><td>' +
                list(l.merged).map((m) => '<div><b>' + esc(m.id) + '</b>' + (m.card && m.card.productName ? ' · ' + esc(m.card.productName) : '') + ': ' +
                    (Object.entries(m.sites || {}).filter(([, q]) => num(q)).map(([s, q]) => esc(siteName(s)) + ' ' + fmt(num(q))).join(', ') || '0') + '</div>').join('') +
                '</td><td>' + esc(l.by || '') + '</td><td>' + (l.undoneAt ? '<span class="iba-um-done">Undone ' + esc(when(l.undoneAt)) + '</span>' : '<button type="button" class="iba-um-btn" data-um-undo="' + esc(l.k) + '"><i class="fa-solid fa-rotate-left"></i> Undo</button>') + '</td></tr>').join('') +
            '</tbody></table></div><p class="iba-um-msg" data-um-msg></p>';
    }
    function bind(w) {
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.__busy) w.remove(); });
        w.addEventListener('click', async (e) => {
            if (w.__busy) return;
            if (e.target === w || e.target.closest('[data-um-x]')) return w.remove();
            const b = e.target.closest('[data-um-undo]');
            if (!b) return;
            const log = logs.find((l) => l.k === b.getAttribute('data-um-undo'));
            if (!log) return;
            if (!b.dataset.sure) {
                w.querySelectorAll('[data-um-undo]').forEach((x) => { if (x !== b && x.dataset.sure) { delete x.dataset.sure; x.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Undo'; } });
                b.dataset.sure = '1';
                b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Yes, undo';
                const n = need(log);
                const m = w.querySelector('[data-um-msg]');
                if (m) m.innerHTML = 'Undo takes <b>' + Object.entries(n).map(([s, q]) => esc(siteName(s)) + ' ' + fmt(q)).join(', ') + '</b> off ' + esc(log.mainId) + ' and gives it back to ' + list(log.merged).map((x) => esc(x.id)).join(', ') + '. Press <b>Yes, undo</b> to go ahead.';
                // 17.0.5 patch 86: a merged card that was deleted and has no saved copy -> ask its name / unit here
                askNames(w, log);
                return;
            }
            list(log.merged).forEach((x) => {
                const ni = w.querySelector('[data-um-name="' + x.key + '"]'), ui = w.querySelector('[data-um-unit="' + x.key + '"]');
                x.typedName = ni ? String(ni.value || '').trim() : ''; x.typedUnit = ui ? String(ui.value || '').trim() : '';
            });
            w.__busy = true;
            b.disabled = true;
            const m = w.querySelector('[data-um-msg]');
            const res = await undo(log, (t) => { if (m) m.textContent = t; });
            w.__busy = false;
            if (m) m.innerHTML = res.ok ? '<span class="iba-um-ok"><i class="fa-solid fa-check"></i> ' + esc(res.text) + '</span>' : '<span class="iba-um-bad">' + esc(res.text) + '</span>';
            if (res.ok) { log.undoneAt = Date.now(); draw(w); const m2 = w.querySelector('[data-um-msg]'); if (m2) m2.innerHTML = '<span class="iba-um-ok"><i class="fa-solid fa-check"></i> ' + esc(res.text) + '</span>'; }
            else { b.disabled = false; delete b.dataset.sure; b.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Undo'; }
        });
    }

    async function askNames(w, log) {
        const d = db();
        const gone = [];
        for (const x of list(log.merged)) {
            if (x.card || !x.key) continue;
            try { if (!(await d.ref('material_stock/' + x.key).once('value')).exists()) gone.push(x); } catch (_) {}
        }
        const m = w.querySelector('[data-um-msg]');
        if (!gone.length || !m || !w.isConnected) return;
        const box = document.createElement('div');
        box.className = 'iba-um-names';
        box.innerHTML = '<p><i class="fa-solid fa-pen"></i> ' + (gone.length === 1 ? 'This card was deleted' : 'These cards were deleted') + ' after the merge. Type the name (and unit) to bring ' + (gone.length === 1 ? 'it' : 'them') + ' back with it:</p>' +
            gone.map((x) => '<div class="iba-um-namerow"><b>' + esc(x.id) + '</b><input type="text" data-um-name="' + esc(x.key) + '" placeholder="Item name" autocomplete="off" spellcheck="false">' +
                '<input type="text" data-um-unit="' + esc(x.key) + '" placeholder="Unit" autocomplete="off" spellcheck="false"></div>').join('');
        m.appendChild(box);
        const first = box.querySelector('input');
        if (first) try { first.focus(); } catch (_) {}
    }

    async function undo(log, say) {
        const d = db();
        const who = me();
        const TS = firebase.database.ServerValue.TIMESTAMP;
        const n = need(log);
        // 0) not undone already (fresh read)
        try { const s = await d.ref('stock_merges/' + log.k + '/undoneAt').once('value'); if (s.val()) return { ok: false, text: 'This merge was already undone.' }; } catch (_) {}
        // 1) take the amounts off the main card, all or nothing (transaction)
        say('Checking ' + log.mainId + '…');
        let short = '';
        let res;
        try {
            res = await d.ref('material_stock/' + log.mainKey).transaction((cur) => {
                short = '';
                if (!cur) { short = 'the main card ' + log.mainId + ' is not there any more'; return cur; } // null: Firebase retries with the real value
                const sites = {};
                Object.entries(cur.sites || {}).forEach(([s, q]) => { const k = canon(s) || s; sites[k] = num(sites[k]) + num(q); });
                for (const [k, q] of Object.entries(n)) {
                    if (num(sites[k]) + 1e-9 < q) { short = siteName(k) + ' has ' + fmt(num(sites[k])) + ' on ' + log.mainId + ', the merge moved ' + fmt(q); return; }
                }
                Object.entries(n).forEach(([k, q]) => { sites[k] = Math.round((num(sites[k]) - q) * 1000) / 1000; if (!sites[k]) delete sites[k]; });
                cur.sites = sites;
                cur.stockQty = total(sites); cur.balanceQty = cur.stockQty;
                cur.lastUpdated = TS;
                return cur;
            });
        } catch (e) { return { ok: false, text: 'Could not change ' + log.mainId + ': ' + ((e && e.message) || e) + '. Nothing was changed.' }; }
        if (!res || !res.committed || !(res.snapshot && res.snapshot.exists && res.snapshot.exists())) return { ok: false, text: 'Cannot undo: ' + (short || 'the main card changed') + '. Some of it was used after the merge, so nothing was changed.' };

        // 2) give each merged card its quantities back (rebuild a deleted card)
        const back = [];
        for (const m of list(log.merged)) {
            say('Giving back ' + m.id + '…');
            let ok = false;
            let wasGone = false;
            try { wasGone = !(await d.ref('material_stock/' + m.key).once('value')).exists(); } catch (_) {}
            try {
                const r = await d.ref('material_stock/' + m.key).transaction((cur) => {
                    const base = cur || (m.card ? JSON.parse(JSON.stringify(m.card)) : Object.assign({ productID: m.id, productName: m.typedName || (m.id + ' (restored - type the name)'), status: 'Active', transferredQty: 0 }, m.typedUnit ? { unit: m.typedUnit } : {}));
                    const sites = Object.assign({}, cur ? (cur.sites || {}) : {});
                    Object.entries(m.sites || {}).forEach(([s, q]) => { sites[s] = num(sites[s]) + num(q); });
                    base.sites = sites;
                    base.stockQty = total(sites); base.balanceQty = base.stockQty;
                    base.mergedInto = null; base.mergedAt = null;
                    base.restoredFromMerge = log.k;
                    base.lastUpdated = TS;
                    return base;
                });
                ok = !!(r && r.committed);
                // 17.0.5 patch 85: older merges keep no card copy: take the card's own name for its history
                try { if (ok && r.snapshot) { const v = r.snapshot.val() || {}; if (v.productName && !/\(restored - type the name\)/.test(v.productName)) m.name = v.productName; } } catch (_) {}
                // a deleted card is back: the item counter goes up again
                if (ok && wasGone) { try { await d.ref().update({ 'material_stock_meta/count': firebase.database.ServerValue.increment(1), 'material_stock_meta/updatedAt': TS }); } catch (_) {} }
            } catch (e) { console.error('Undo merge: card', m.id, e); }
            if (ok) back.push(m);
            else {
                // could not give it back: return that amount to the main card so nothing is lost
                try {
                    await d.ref('material_stock/' + log.mainKey).transaction((cur) => {
                        if (!cur) return cur;
                        const sites = Object.assign({}, cur.sites || {});
                        Object.entries(m.sites || {}).forEach(([s, q]) => { const k = canon(s) || s; sites[k] = num(sites[k]) + num(q); });
                        cur.sites = sites; cur.stockQty = total(sites); cur.balanceQty = cur.stockQty; cur.lastUpdated = TS;
                        return cur;
                    });
                } catch (_) {}
            }
        }

        // 3) transfers moved by the merge go back to their old ID
        say('Moving the history back…');
        const upd = {};
        let moved = 0;
        const backIds = {};
        back.forEach((m) => { backIds[m.id] = m; });
        if (log.transfers && typeof log.transfers === 'object') {
            Object.entries(log.transfers).forEach(([tk, t]) => {
                const m = backIds[t && t.id];
                if (!m) return;
                upd['transfer_entries/' + tk + '/productID'] = m.id;
                upd['transfer_entries/' + tk + '/productId'] = m.id;
                if (t.name) upd['transfer_entries/' + tk + '/productName'] = t.name;
                upd['transfer_entries/' + tk + '/mergedFrom'] = null;
                moved++;
            });
        } else {
            try { if (typeof fetchTransfersOnly === 'function') await fetchTransfersOnly(); } catch (_) {}
            let all = [];
            try { all = (typeof allTransferData !== 'undefined' && Array.isArray(allTransferData)) ? allTransferData : []; } catch (_) {}
            all.forEach((t) => {
                const m = backIds[String(t.mergedFrom || '').trim()];
                if (!m || !t.key || String(t.productID || t.productId || '').trim() !== String(log.mainId)) return;
                upd['transfer_entries/' + t.key + '/productID'] = m.id;
                upd['transfer_entries/' + t.key + '/productId'] = m.id;
                const nm = m.name || (m.card && m.card.productName);
                if (nm) upd['transfer_entries/' + t.key + '/productName'] = nm;
                upd['transfer_entries/' + t.key + '/mergedFrom'] = null;
                moved++;
            });
        }
        const keys = Object.keys(upd);
        try { for (let i = 0; i < keys.length; i += 400) { const b = {}; keys.slice(i, i + 400).forEach((k) => { b[k] = upd[k]; }); await d.ref().update(b); } }
        catch (e) { console.error('Undo merge: transfers', e); }

        // 4) mark the log, refresh everything
        try { await d.ref('stock_merges/' + log.k).update({ undoneAt: TS, undoneBy: who, undoneCards: back.map((m) => m.id) }); } catch (_) {}
        try { await window.inventoryPocket?.publishMaterialByKey(log.mainKey); for (const m of back) await window.inventoryPocket?.publishMaterialByKey(m.key); } catch (_) {}
        try { if (typeof transferStockItemKeyCache !== 'undefined') Object.keys(transferStockItemKeyCache).forEach((k) => { delete transferStockItemKeyCache[k]; }); } catch (_) {}
        try { localStorage.removeItem('cached_MATERIAL_STOCK'); } catch (_) {}
        try { if (typeof populateMaterialStock === 'function') populateMaterialStock(true); } catch (_) {}
        const missed = list(log.merged).length - back.length;
        return { ok: !missed, text: 'Undone: ' + back.map((m) => m.id).join(', ') + ' got their stock back from ' + log.mainId + '; ' + moved + ' history record' + (moved === 1 ? '' : 's') + ' moved back.' + (missed ? ' ' + missed + ' card(s) could not be restored (their stock stayed on ' + log.mainId + ').' : '') };
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#ms-merge-undo-btn');
        if (!b) return;
        e.preventDefault();
        open();
    });
    window.ibaUnmerge = { open: open, undo: undo, need: need };
})();
