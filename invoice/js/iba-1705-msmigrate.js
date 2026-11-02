/* ==========================================================================
   js/iba-1705-msmigrate.js — 17.0.5 patch 74
   Material Stock: change Title, Unit, Family, Relationship (and so the
   Product ID) from the Download Titles CSV. Super Admin only.
   - Every item stays under its own Firebase key (material_stock/<key>);
     quantity and site stock are never written.
   - Product ID = Family.Relationship.Series. A new family / relationship
     keeps the item's own series (unique), e.g. 1.104.00150 -> 5.502.00150.
   - Transfers, stock adjustments and transfer requests store the Product ID
     TEXT, so the item and all its linked records are saved in ONE Firebase
     write per item (all or nothing).
   - The old ID is kept on the item (oldProductIDs), so searches and printed
     stickers with the old number still find it ("was 1.104.00150").
   - Preview first: every change and every blocked row is shown before saving.
   window.ibaMsMigrate.run(text)  (called from Update Titles for Super Admin)
   ========================================================================== */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name) : 'Irwin'; } catch (_) { return 'Irwin'; } }
    function invDb() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb && inventoryDb.ref) return inventoryDb; } catch (_) {}
        try { if (typeof getInventoryDatabase === 'function') return getInventoryDatabase(); } catch (_) {}
        return null;
    }
    function legends() { try { return (typeof STOCK_LEGENDS !== 'undefined' && STOCK_LEGENDS) || {}; } catch (_) { return {}; } }
    function stock() { try { return (typeof allMaterialStockData !== 'undefined' && Array.isArray(allMaterialStockData)) ? allMaterialStockData : []; } catch (_) { return []; } }
    const pidOf = (it) => String((it && (it.productID || it.productId)) || '').trim();
    const oldIds = (it) => (Array.isArray(it && it.oldProductIDs) ? it.oldProductIDs : (it && it.oldProductIDs ? Object.values(it.oldProductIDs) : [])).map((x) => String(x || '').trim()).filter(Boolean);
    function cleanUnit(v) { try { if (typeof msCleanUnit === 'function') return msCleanUnit(v); } catch (_) {} return String(v == null ? '' : v).trim().slice(0, 20); }

    // CSV with quotes (titles can contain commas)
    function parseCsv(text) {
        const rows = [];
        let row = [], cur = '', q = false;
        const s = String(text || '').replace(/^﻿/, '');
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (q) {
                if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === ',') { row.push(cur); cur = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && s[i + 1] === '\n') i++;
                row.push(cur); rows.push(row); row = []; cur = '';
            } else cur += c;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows.map((r) => r.map((x) => String(x).trim())).filter((r) => r.some(Boolean));
    }

    // family: code ("1") or name ("Civil & Structural"); relationship: code ("104") or name, inside that family
    function famCode(v) {
        const L = legends(), t = norm(v);
        if (!t) return '';
        if (L[String(v).trim()]) return String(v).trim();
        return Object.keys(L).find((k) => norm(L[k].name) === t) || null;
    }
    function relCode(fam, v) {
        const L = legends(), t = norm(v);
        if (!t || !L[fam]) return t ? null : '';
        const rels = L[fam].relations || {};
        if (rels[String(v).trim()]) return String(v).trim();
        return Object.keys(rels).find((k) => norm(rels[k]) === t) || null;
    }
    function seriesPart(item) {
        const m = pidOf(item).match(/^\d+\.\d+\.(\d+)$/);
        if (m) return m[1];
        const n = parseInt(item && item.series, 10);
        return Number.isFinite(n) ? String(n).padStart(5, '0') : '';
    }

    // ---- download: the rows on the screen with Unit / Family / Relationship ----
    function download(rows) {
        const L = legends();
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        // the Firebase key comes first with "FB:" in front (Excel turns a value starting with "-" into a formula)
        const lines = ['Firebase Key,Product ID,New Title,Unit,Family,Relationship,Family name (info only),Relationship name (info only)'];
        (rows || []).forEach((it) => {
            const id = pidOf(it);
            if (!id) return;
            const f = String(it.familyCode || '').trim(), r = String(it.relationCode || '').trim();
            lines.push(['FB:' + (it.key || ''), id, it.productName || '', it.unit || '', f, r, (L[f] && L[f].name) || it.family || '', (L[f] && L[f].relations && L[f].relations[r]) || it.relationship || ''].map(q).join(','));
        });
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (typeof window.msTitlesFileName === 'function') ? window.msTitlesFileName() : 'Material_Titles.csv'; // patch 80: named after the family tab
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    // ---- plan: what each row would change (nothing saved) -------------------
    function plan(text) {
        const rows = parseCsv(text);
        if (!rows.length) return { error: 'The file is empty.' };
        let col = { key: -1, id: 0, title: 1, unit: -1, fam: -1, rel: -1 };
        const h = rows[0].map(norm);
        const isHead = h.some((x) => /product id|firebase key|^key$/.test(x));
        if (isHead) {
            // columns are found by their header name: extra columns people add are ignored
            const find = (re) => h.findIndex((x) => re.test(x) && !/info only/.test(x));
            col = { key: find(/firebase key|^key$/), id: find(/product id|^id$/), title: find(/title|item name|^name$/), unit: find(/^unit/), fam: find(/^family/), rel: find(/^relation/) };
        }
        const byKey = new Map();
        const items = stock();
        const byId = new Map();
        items.forEach((it) => { if (it.key) byKey.set(String(it.key), it); });
        items.forEach((it) => { const p = pidOf(it); if (!p) return; if (!byId.has(p)) byId.set(p, []); byId.get(p).push(it); });
        const taken = new Map(); // id -> item key that owns it (current or old)
        items.forEach((it) => { const p = pidOf(it); if (p) taken.set(p, it.key); oldIds(it).forEach((o) => { if (!taken.has(o)) taken.set(o, it.key); }); });
        const L = legends();
        const out = [], newIds = new Map(), dupKeys = new Map();
        rows.slice(isHead ? 1 : 0).forEach((r, i) => {
            const get = (k) => (col[k] >= 0 ? String(r[col[k]] || '').trim() : '');
            const fk = get('key').replace(/^fb:\s*/i, '').trim();
            const idIn = get('id');
            if (!fk && !idIn) return;
            const line = { n: i + 1, id: idIn, block: '' };
            out.push(line);
            let it = null;
            if (fk) {
                // saved under the Firebase key, whatever the Product ID says
                it = byKey.get(fk);
                if (!it) { line.block = 'Firebase key not found'; return; }
            } else {
                const hits = byId.get(idIn) || [];
                if (!hits.length) { line.block = 'Product ID not found'; return; }
                if (hits.length > 1) { line.block = 'This ID is used by ' + hits.length + ' items - add the Firebase Key column'; return; }
                it = hits[0];
            }
            const id = pidOf(it);
            line.id = id;
            if (dupKeys.has(it.key)) { line.block = 'Same item is also in row ' + dupKeys.get(it.key); return; }
            dupKeys.set(it.key, line.n);
            // the same Product ID on 2 items (old duplicate): only transfers that carry THIS item's key move with it
            line.shared = (byId.get(id) || []).length > 1;
            line.key = it.key;
            line.item = it;
            const title = get('title'), unit = cleanUnit(get('unit'));
            const famIn = get('fam'), relIn = get('rel');
            const curF = String(it.familyCode || '').trim(), curR = String(it.relationCode || '').trim();
            let f = curF, rr = curR;
            if (famIn) { f = famCode(famIn); if (!f) { line.block = 'Unknown family "' + famIn + '"'; return; } }
            if (relIn) { rr = relCode(f, relIn); if (!rr) { line.block = 'Relationship "' + relIn + '" is not in family ' + f; return; } }
            else if (f !== curF) { line.block = 'New family ' + f + ': give a relationship of that family too'; return; }
            if (f && rr && (!L[f] || !L[f].relations || !L[f].relations[rr])) { line.block = 'Relationship ' + rr + ' is not in family ' + f; return; }
            line.title = title && title !== String(it.productName || '') ? title : '';
            line.unit = unit && unit !== cleanUnit(it.unit) ? unit : '';
            line.fam = f; line.rel = rr;
            line.famChanged = f !== curF || rr !== curR;
            line.newId = id;
            if (famIn || relIn) {
                const sp = seriesPart(it);
                if (!sp) { line.block = 'Cannot read the series number of this ID'; return; }
                const nid = f + '.' + rr + '.' + sp;
                if (nid !== id) {
                    const owner = taken.get(nid);
                    if (owner && owner !== it.key) { line.block = 'New ID ' + nid + ' already belongs to another item'; return; }
                    if (newIds.has(nid)) { line.block = 'New ID ' + nid + ' is also given to row ' + newIds.get(nid); return; }
                    newIds.set(nid, line.n);
                    line.newId = nid;
                }
            }
            line.idChanged = line.newId !== id;
            if (!line.title && !line.unit && !line.famChanged && !line.idChanged) line.same = true;
        });
        return { rows: out };
    }

    // ---- linked records (one read each, inventory database only) -----------
    async function linked(ids) {
        const d = invDb();
        const want = new Set(ids);
        const res = { transfers: {}, adjust: {}, requests: {} };
        if (!want.size || !d) return res;
        const add = (m, id, v) => { (m[id] = m[id] || []).push(v); };
        // transfers: the list the Material Stock page already holds + only the ones added since (small read);
        // a full read only when the page has none in memory
        let mem = [];
        try { if (typeof allTransferData !== 'undefined' && Array.isArray(allTransferData)) mem = allTransferData; } catch (_) {}
        let since = 0;
        mem.forEach((x) => { const ts = Number(x && x.timestamp) || 0; if (ts > since) since = ts; });
        const tRead = mem.length && since
            ? d.ref('transfer_entries').orderByChild('timestamp').startAt(since).once('value').then((snap) => {
                const all = {};
                mem.forEach((x) => { if (x && x.key) all[x.key] = x; });
                const v = (snap && snap.val && snap.val()) || {};
                Object.keys(v).forEach((k) => { all[k] = v[k]; });
                return { val: () => all };
            }).catch(() => null)
            : d.ref('transfer_entries').once('value').catch(() => null);
        res.read = mem.length && since ? 'memory' : 'full';
        const [t, a, q] = await Promise.all([
            tRead,
            d.ref('stock_adjustments').once('value').catch(() => null),
            d.ref('inventory_requests').once('value').catch(() => null)
        ]);
        const each = (snap, fn) => { const v = snap && snap.val ? snap.val() : null; if (v && typeof v === 'object') Object.keys(v).forEach((k) => fn(k, v[k] || {})); };
        each(t, (k, x) => { const p = String(x.productID || x.productId || '').trim(); if (want.has(p)) add(res.transfers, p, { k: k, f: x.productID != null ? 'productID' : 'productId', mk: x.materialKey || '' }); });
        each(a, (k, x) => { const p = String(x.productID || x.productId || '').trim(); if (want.has(p)) add(res.adjust, p, { k: k, f: x.productID != null ? 'productID' : 'productId', key: x.key || '' }); });
        each(q, (k, x) => {
            const its = x.items;
            if (!its || typeof its !== 'object') return;
            Object.keys(its).forEach((i) => { const it = its[i] || {}; const p = String(it.productID || it.productId || '').trim(); if (want.has(p)) add(res.requests, p, { k: k, i: i, f: it.productID != null ? 'productID' : 'productId' }); });
        });
        return res;
    }

    // ---- preview window -------------------------------------------------------
    function box(html) {
        const old = document.getElementById('iba-msm');
        if (old) old.remove();
        const w = document.createElement('div');
        w.id = 'iba-msm';
        w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-msm-box" role="dialog" aria-modal="true" aria-labelledby="iba-msm-t">' + html + '</div>';
        document.body.appendChild(w);
        return w;
    }
    function mine(r, list) { return (list || []).filter((t) => !r.shared || t.mk === r.key || t.key === r.key); }
    function rowHtml(r, link) {
        const it = r.item || {};
        const L = legends();
        const fn = (f, rr) => esc(f) + '.' + esc(rr) + ((L[f] && L[f].relations && L[f].relations[rr]) ? ' <small>' + esc(L[f].relations[rr]) + '</small>' : '');
        const tr = mine(r, link.transfers[r.id]).length, rq = r.shared ? 0 : (link.requests[r.id] || []).length;
        const lk = (r.idChanged ? (tr + ' transfers, ' + mine(r, link.adjust[r.id]).length + ' adjustments' + (rq ? ', ' + rq + ' requests' : '')) : (r.title ? tr + ' transfers renamed' : '')) +
            (r.shared && (r.idChanged || r.title) ? ' (ID shared with another item: its other transfers stay)' : '');
        const st = r.block ? '<span class="iba-msm-bad"><i class="fa-solid fa-ban"></i> ' + esc(r.block) + '</span>' : (r.same ? '<span class="iba-msm-same">No change</span>' : '<span class="iba-msm-ok"><i class="fa-solid fa-check"></i> Ready</span>');
        return '<tr class="' + (r.block ? 'is-bad' : r.same ? 'is-same' : '') + '"><td>' + r.n + '</td>' +
            '<td class="iba-msm-id">' + (r.idChanged ? '<s>' + esc(r.id) + '</s><br><b>' + esc(r.newId) + '</b>' : '<b>' + esc(r.id) + '</b>') + '</td>' +
            '<td>' + (r.title ? '<s>' + esc(it.productName) + '</s><br>' + esc(r.title) : esc(it.productName || '')) + '</td>' +
            '<td>' + (r.unit ? (it.unit ? '<s>' + esc(it.unit) + '</s> ' : '') + '<b>' + esc(r.unit) + '</b>' : esc(it.unit || '-')) + '</td>' +
            '<td>' + (r.famChanged ? '<s>' + fn(it.familyCode || '', it.relationCode || '') + '</s><br>' : '') + (r.item ? fn(r.fam || '', r.rel || '') : '') + '</td>' +
            '<td>' + esc(lk) + '</td><td>' + st + '</td></tr>';
    }

    async function run(text) {
        if (!isSuper()) { alert('Only the Super Admin can change family, relationship, unit or Product ID.'); return; }
        const p = plan(text);
        if (p.error) { alert(p.error); return; }
        const ready = p.rows.filter((r) => !r.block && !r.same);
        let w = box('<div class="iba-pb-head"><b id="iba-msm-t"><i class="fa-solid fa-pen-to-square"></i> Update materials - preview</b></div><div class="iba-pb-sub"><p><i class="fa-solid fa-circle-notch fa-spin"></i> Checking ' + p.rows.length + ' rows and their transfers…</p></div>');
        const ids = ready.filter((r) => r.idChanged || r.title).map((r) => r.id);
        let link;
        try { link = await linked(ids); } catch (e) { w.remove(); alert('Could not read the transfers: ' + ((e && e.message) || e)); return; }
        const bad = p.rows.filter((r) => r.block).length, same = p.rows.filter((r) => r.same).length;
        const idCh = ready.filter((r) => r.idChanged).length;
        w = box('<div class="iba-pb-head"><b id="iba-msm-t"><i class="fa-solid fa-pen-to-square"></i> Update materials - preview</b><button type="button" class="iba-msm-x" data-msm-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-pb-sub"><p><b>' + ready.length + '</b> to change' + (idCh ? ' (' + idCh + ' get a new Product ID)' : '') + (same ? ' · ' + same + ' no change' : '') + (bad ? ' · <span class="iba-msm-bad">' + bad + ' blocked (skipped)</span>' : '') +
            '. Quantity and site stock are not touched. Each item is saved together with its linked records (all or nothing). The old ID is remembered on the item.</p>' +
            '<div class="iba-msm-scroll"><table class="iba-msm-table"><thead><tr><th>#</th><th>Product ID</th><th>Title</th><th>Unit</th><th>Family.Relationship</th><th>Linked records</th><th></th></tr></thead><tbody>' +
            p.rows.map((r) => rowHtml(r, link)).join('') + '</tbody></table></div><p class="iba-msm-msg" data-msm-msg></p></div>' +
            '<div class="iba-pb-foot"><span></span><button type="button" data-msm-x>Cancel</button><button type="button" class="is-main" data-msm-go' + (ready.length ? '' : ' disabled') + '><i class="fa-solid fa-check"></i> Apply ' + ready.length + ' change' + (ready.length === 1 ? '' : 's') + '</button></div>');
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.__busy) w.remove(); });
        w.addEventListener('click', async (e) => {
            if (w.__busy) return;
            if (e.target === w || e.target.closest('[data-msm-x]')) return w.remove();
            const go = e.target.closest('[data-msm-go]');
            if (!go) return;
            if (!go.dataset.sure) { go.dataset.sure = '1'; go.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Yes, apply ' + ready.length; return; }
            w.__busy = true;
            go.disabled = true;
            w.querySelectorAll('[data-msm-x]').forEach((b) => { b.disabled = true; });
            const res = await apply(ready, link, w.querySelector('[data-msm-msg]'));
            w.__busy = false;
            w.querySelectorAll('[data-msm-x]').forEach((b) => { b.disabled = false; });
            go.hidden = true;
            const m = w.querySelector('[data-msm-msg]');
            m.innerHTML = '<b>' + res.ok + ' of ' + ready.length + ' saved.</b>' + (res.fail.length ? '<br><span class="iba-msm-bad">Not saved: ' + res.fail.map(esc).join('; ') + '</span>' : '');
        });
        const firstBtn = w.querySelector('[data-msm-x]');
        if (firstBtn) firstBtn.focus();
    }

    async function apply(ready, link, msg) {
        const d = invDb();
        const L = legends();
        const who = me();
        let ok = 0;
        const fail = [], done = [];
        for (let i = 0; i < ready.length; i++) {
            const r = ready[i], it = r.item, k = r.key;
            if (msg) msg.textContent = 'Saving ' + (i + 1) + ' of ' + ready.length + ': ' + r.newId + '…';
            const u = {};
            const base = 'material_stock/' + k + '/';
            if (r.title) u[base + 'productName'] = r.title;
            if (r.unit) u[base + 'unit'] = r.unit;
            if (r.famChanged) {
                u[base + 'familyCode'] = r.fam; u[base + 'family'] = L[r.fam].name; u[base + 'category'] = L[r.fam].name;
                u[base + 'relationCode'] = r.rel; u[base + 'relationship'] = L[r.fam].relations[r.rel]; u[base + 'details'] = L[r.fam].relations[r.rel];
            }
            if (r.idChanged) {
                u[base + 'productID'] = r.newId;
                if (it.productId != null) u[base + 'productId'] = null;
                u[base + 'oldProductIDs'] = oldIds(it).concat([r.id]).filter((x, j, a) => a.indexOf(x) === j);
                u[base + 'idChangedAt'] = Date.now();
                u[base + 'idChangedBy'] = who;
                mine(r, link.transfers[r.id]).forEach((t) => {
                    u['transfer_entries/' + t.k + '/' + t.f] = r.newId;
                    if (!t.mk) u['transfer_entries/' + t.k + '/materialKey'] = k;
                });
                mine(r, link.adjust[r.id]).forEach((a) => { if (!a.key || a.key === k) u['stock_adjustments/' + a.k + '/' + a.f] = r.newId; });
                (r.shared ? [] : (link.requests[r.id] || [])).forEach((q) => { u['inventory_requests/' + q.k + '/items/' + q.i + '/' + q.f] = r.newId; });
            }
            if (r.title) mine(r, link.transfers[r.id]).forEach((t) => { u['transfer_entries/' + t.k + '/productName'] = r.title; });
            u[base + 'lastUpdated'] = Date.now();
            u[base + 'updatedBy'] = who;
            // safety lock: this update may NEVER write a quantity or site stock field
            const QTY = /\/(stockQty|balanceQty|transferredQty|sites|qty|requiredQty|orderedQty|receivedQty|approvedQty|before|after)(\/|$)/i;
            const bad = Object.keys(u).filter((pth) => QTY.test(pth));
            if (bad.length) { fail.push(r.id + ' (blocked: would touch ' + bad[0] + ')'); continue; }
            try {
                await d.ref().update(u); // one write: the item and all its linked records, or nothing
                ok++;
                done.push(k);
                // keep the page's list in step
                if (r.title) it.productName = r.title;
                if (r.unit) it.unit = r.unit;
                if (r.famChanged) { it.familyCode = r.fam; it.family = L[r.fam].name; it.relationCode = r.rel; it.relationship = L[r.fam].relations[r.rel]; it.category = it.family; it.details = it.relationship; }
                if (r.idChanged) { it.oldProductIDs = u[base + 'oldProductIDs']; it.productID = r.newId; delete it.productId; }
            } catch (e) { fail.push(r.id + ' (' + ((e && e.message) || e) + ')'); }
        }
        try {
            if (typeof allTransferData !== 'undefined' && Array.isArray(allTransferData)) {
                ready.forEach((r) => { if (!r.idChanged && !r.title) return; allTransferData.forEach((t) => { if (String(t.productID || t.productId || '').trim() === r.id && done.indexOf(r.key) !== -1 && (!r.shared || t.materialKey === r.key)) { if (r.idChanged) t.productID = r.newId; if (r.title) t.productName = r.title; } }); });
            }
        } catch (_) {}
        done.forEach((k) => { try { Promise.resolve(window.inventoryPocket && window.inventoryPocket.publishMaterialByKey(k)).catch(() => {}); } catch (_) {} });
        try { localStorage.removeItem('cached_MATERIAL_STOCK'); } catch (_) {}
        try { if (typeof populateMaterialStock === 'function') populateMaterialStock(true); } catch (_) {}
        return { ok: ok, fail: fail };
    }

    window.ibaMsMigrate = { run: run, plan: plan, download: download, parseCsv: parseCsv, oldIds: oldIds };
})();
