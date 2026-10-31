/* ==========================================================================
   js/iba-1705-sitestock.js — 17.0.5 patch 40 (41: records with no ID and no name left out)
   Site stock: the current stock of ONE site, all items or one product
   (e.g. site 170 + "plywood"), with Print PDF and Download CSV.
   Items with 0 at that site are left out.
   Who: Super Admin and E.Ali only.
   Opened from the "Site stock" button next to Stock Report (Material Stock
   page) or the assistant skill "Site stock". PC only (no printing on phone).
   Stock = the card's site quantities (material_stock/<key>/sites), the same
   number the Stock table and Stock Report use. Read from the copy already
   in memory / saved on this computer; Firebase only when there is none.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || null; } catch (_) { return null; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    // E.Ali: user Name "E.Ali" / "E. Ali" / "E Ali"
    function isEAli() { const u = me(); return /^e\.?\s*ali$/i.test(String((u && u.Name) || '').trim()); }
    // 17.0.5 patch 44: Settings > Inventory permissions can give / take it per person
    function allowed() { const d = isSuper() || isEAli(); return typeof window.ibaInvCan === 'function' ? !!window.ibaInvCan('site_stock', d) : d; }
    function onPhone() { return !!(document.body && (document.body.classList.contains('iba-phone') || document.body.classList.contains('iba-mobile-ui'))); }
    function say(msg) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(msg); } catch (_) {} alert(msg); }

    function canon(site) {
        if (typeof window.stockCanonicalSiteKey === 'function') return window.stockCanonicalSiteKey(site);
        if (typeof msCanonSiteKey === 'function') return msCanonSiteKey(site);
        const raw = String(site || '').trim();
        if (!raw) return '';
        if (raw.toLowerCase() === 'main store') return 'Main Store';
        return raw.split(/\s+-\s+/)[0].trim().replace(/[.#$[\]\/]/g, '');
    }
    function siteList() {
        try { if (typeof allSitesCSVData !== 'undefined' && Array.isArray(allSitesCSVData) && allSitesCSVData.length) return allSitesCSVData; } catch (_) {}
        try { return (JSON.parse(localStorage.getItem('cached_SITES') || '{}').data) || []; } catch (_) { return []; }
    }
    function siteName(code) {
        if (code === 'Main Store') return 'Main Store';
        const s = siteList().find((x) => x && canon(x.site) === code);
        return s && s.description ? code + ' - ' + s.description : code;
    }
    function family(item) {
        try { if (typeof STOCK_LEGENDS !== 'undefined' && item.familyCode && STOCK_LEGENDS[item.familyCode]) return STOCK_LEGENDS[item.familyCode].name || item.familyCode; } catch (_) {}
        return item.family || item.category || item.familyCode || '';
    }
    function unit(item) { try { if (typeof msCleanUnit === 'function') return msCleanUnit(item.unit); } catch (_) {} return String(item.unit || ''); }

    // ---- the stock list ----------------------------------------------------
    async function stock() {
        try { if (typeof allMaterialStockData !== 'undefined' && Array.isArray(allMaterialStockData) && allMaterialStockData.length) return allMaterialStockData; } catch (_) {}
        try {
            const c = JSON.parse(localStorage.getItem('cached_MATERIAL_STOCK') || '{}');
            if (Array.isArray(c.data) && c.data.length) return c.data;
        } catch (_) {}
        const d = (typeof window.getInventoryDatabase === 'function') ? window.getInventoryDatabase() : window.inventoryDb;
        if (!d) throw new Error('The stock list is not available. Open Material Stock once, then try again.');
        const s = await d.ref('material_stock').once('value');
        const v = s.val() || {};
        const list = Object.keys(v).map((k) => Object.assign({ key: k }, v[k]));
        try { if (typeof window.__ibaSetMaterialStockData === 'function') window.__ibaSetMaterialStockData(list); } catch (_) {}
        return list;
    }
    const pid = (i) => String(i.productID || i.productId || i.ProductID || i.id || '').trim();
    const pname = (i) => String(i.productName || i.ProductName || i.name || i.title || i.description || '').trim();
    // site code + words -> rows with qty > 0 at that site
    function report(list, site, words) {
        const code = canon(site);
        report.broken = 0;
        const terms = String(words || '').toLowerCase().split(/\s+/).filter(Boolean);
        const seen = new Map();
        list.forEach((item) => {
            if (!item || !item.sites) return;
            let qty = 0;
            Object.keys(item.sites).forEach((k) => { if (canon(k) === code) qty += num(item.sites[k]); });
            if (qty <= 0) return;
            // a card with no Product ID and no name is a broken record (only site numbers left): not stock
            if (!pid(item) && !pname(item)) { report.broken = (report.broken || 0) + 1; return; }
            const text = [pid(item), pname(item), item.details, item.relationship, family(item)].join(' ').toLowerCase();
            if (terms.some((t) => text.indexOf(t) === -1)) return;
            // one row per real card (newest wins, like the Stock table)
            const k = String(item.key || item.productID || item.productId || '');
            const cur = seen.get(k);
            if (cur && num(cur.item.lastUpdated) > num(item.lastUpdated)) return;
            seen.set(k, { item, qty });
        });
        return Array.from(seen.values()).map(({ item, qty }) => ({
            id: pid(item), name: pname(item), family: family(item), unit: unit(item), qty
        })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    }
    function knownSites(list) {
        const s = new Set();
        list.forEach((i) => Object.keys((i && i.sites) || {}).forEach((k) => { if (num(i.sites[k]) > 0) s.add(canon(k)); }));
        return Array.from(s).filter(Boolean).sort((a, b) => (parseFloat(a) || 1e9) - (parseFloat(b) || 1e9) || a.localeCompare(b));
    }
    const title = (site, words) => 'Site ' + siteName(canon(site)) + (String(words || '').trim() ? ' · ' + String(words).trim() : ' · all items');
    const stamp = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // ---- Print PDF / CSV -----------------------------------------------------
    function printHtml(rows, site, words) {
        const logo = (typeof MS_REQUIRED_LIST_LOGO_URL !== 'undefined') ? MS_REQUIRED_LIST_LOGO_URL : '';
        return '<!doctype html><html><head><meta charset="utf-8"><title>Site Stock ' + esc(canon(site)) + '</title><style>' +
            '*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}body{margin:20px;color:#111;background:#fff}' +
            '.hdr{display:flex;align-items:center;gap:18px;border-bottom:2px solid #003A5C;padding-bottom:12px;margin-bottom:14px}.hdr img{height:58px;width:auto}' +
            'h1{margin:0;color:#003A5C;font-size:20px}.sub{margin-top:4px;color:#333;font-size:13px;font-weight:700}' +
            '.meta{display:flex;justify-content:space-between;gap:12px;margin:10px 0 14px;color:#444;font-size:12px}' +
            'table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #9fb3c2;padding:6px 8px;vertical-align:top}' +
            'th{background:#003A5C;color:#fff;text-align:left;text-transform:uppercase;font-size:11px;letter-spacing:.03em;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            '.mono{font-family:Consolas,Monaco,monospace;font-weight:700;color:#003A5C}.num{text-align:right;font-weight:800}' +
            'tfoot td{font-weight:800;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            '.foot{margin-top:18px;border-top:1px solid #d9e3ef;padding-top:8px;font-size:11px;color:#64748b;display:flex;justify-content:space-between}' +
            '@page{size:A4 portrait;margin:10mm}@media print{body{margin:0}}</style></head><body>' +
            '<div class="hdr">' + (logo ? '<img src="' + esc(logo) + '" alt="IBA">' : '') + '<div><h1>Site Stock Report</h1><div class="sub">' + esc(title(site, words)) + '</div></div></div>' +
            '<div class="meta"><div><b>Generated:</b> ' + esc(stamp()) + '</div><div><b>Items:</b> ' + rows.length + '</div></div>' +
            '<table><thead><tr><th style="width:5%">#</th><th style="width:15%">Product ID</th><th>Name</th><th style="width:18%">Family</th><th style="width:11%;text-align:right">Qty</th><th style="width:9%">Unit</th></tr></thead><tbody>' +
            rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(r.id) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.family) + '</td><td class="num">' + esc(fmt(r.qty)) + '</td><td>' + esc(r.unit) + '</td></tr>').join('') +
            '</tbody><tfoot><tr><td colspan="4">Total (' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + ')</td><td class="num">' + esc(fmt(rows.reduce((s, r) => s + r.qty, 0))) + '</td><td></td></tr></tfoot></table>' +
            '<div class="foot"><span>System Generated Report</span><span>Signature: _______________________</span></div></body></html>';
    }
    function print(rows, site, words) {
        if (!rows.length) return say('Nothing to print.');
        if (typeof msPrintHtmlInHiddenFrame === 'function') return msPrintHtmlInHiddenFrame(printHtml(rows, site, words), 'iba-site-stock-print-frame');
        const w = window.open('', '_blank');
        if (w) { w.document.write(printHtml(rows, site, words)); w.document.close(); setTimeout(() => w.print(), 400); }
    }
    function csv(rows, site, words) {
        if (!rows.length) return say('Nothing to download.');
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = [q('Site Stock Report: ' + title(site, words)), q('Generated: ' + stamp()), '',
            ['#', 'Product ID', 'Name', 'Family', 'Qty', 'Unit'].map(q).join(',')]
            .concat(rows.map((r, i) => [i + 1, q(r.id), q(r.name), q(r.family), r.qty, q(r.unit)].join(',')))
            .concat([['', '', q('Total'), '', rows.reduce((s, r) => s + r.qty, 0), ''].join(',')]);
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const w = String(words || '').trim().replace(/[^\w-]+/g, '_');
        a.download = 'Site_Stock_' + canon(site).replace(/[^\w-]+/g, '_') + (w ? '_' + w : '') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    // ---- the window ------------------------------------------------------------
    let win = null;
    function close() { if (win && win.isConnected) win.remove(); win = null; }
    async function open(site, words) {
        if (!allowed()) return say('Site stock is for the Super Admin and E.Ali only.');
        if (onPhone()) return say('Site stock is on the PC (no printing on the phone).');
        close();
        win = document.createElement('div');
        win.id = 'iba-esn';
        win.className = 'iba-esn-ov iba-sitestock';
        win.innerHTML = '<div class="iba-esn-box is-wide" role="dialog" aria-modal="true" aria-label="Site stock">' +
            '<div class="iba-esn-head"><b><i class="fa-solid fa-warehouse"></i> Site stock</b>' +
            '<button type="button" class="iba-esn-x" data-ss-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iba-esn-body"><form class="iba-ss-form" autocomplete="off">' +
            '<label><span class="iba-esn-lab">Site</span><input class="iba-esn-q" data-ss-site list="iba-ss-sites" placeholder="e.g. 170" value="' + esc(site || '') + '"></label>' +
            '<label><span class="iba-esn-lab">Product (empty = all items)</span><input class="iba-esn-q" data-ss-words list="iba-ss-items" placeholder="e.g. plywood" value="' + esc(words || '') + '"><datalist id="iba-ss-items"></datalist></label>' +
            '<button type="submit" class="iba-esn-btn is-go"><i class="fa-solid fa-magnifying-glass"></i> Show</button><datalist id="iba-ss-sites"></datalist></form>' +
            '<div class="iba-ss-out"></div><div class="iba-esn-err"></div></div>' +
            '<div class="iba-esn-foot"><span class="iba-esn-picked" data-ss-count></span><span class="iba-esn-sp"></span>' +
            '<button type="button" class="iba-esn-btn" data-ss-csv disabled><i class="fa-solid fa-file-csv"></i> Download CSV</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-ss-print disabled><i class="fa-solid fa-print"></i> Print PDF</button></div></div>';
        document.body.appendChild(win);
        const w = win;
        const siteIn = w.querySelector('[data-ss-site]'), wordsIn = w.querySelector('[data-ss-words]');
        w.addEventListener('click', (e) => {
            if (e.target === w || e.target.closest('[data-ss-x]')) return close();
            if (e.target.closest('[data-ss-print]')) return print(w.__rows || [], w.__site, w.__words);
            if (e.target.closest('[data-ss-csv]')) return csv(w.__rows || [], w.__site, w.__words);
        });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        wordsIn.addEventListener('focus', () => {
            const rows = (w.__list && String(siteIn.value).trim()) ? report(w.__list, siteIn.value, '') : [];
            w.querySelector('#iba-ss-items').innerHTML = rows.slice(0, 400).map((r) => '<option value="' + esc(r.name || r.id) + '">' + esc((r.id ? r.id + ' · ' : '') + fmt(r.qty) + ' ' + r.unit) + '</option>').join('');
        });
        w.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); show(w, siteIn.value, wordsIn.value); });
        const out = w.querySelector('.iba-ss-out');
        out.innerHTML = '<p class="iba-esn-sub"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading stock…</p>';
        try { w.__list = await stock(); }
        catch (e) { out.innerHTML = ''; w.querySelector('.iba-esn-err').textContent = (e && e.message) || String(e); return; }
        w.querySelector('#iba-ss-sites').innerHTML = knownSites(w.__list).map((c) => '<option value="' + esc(c) + '">' + esc(siteName(c)) + '</option>').join('');
        if (String(site || '').trim()) show(w, site, words);
        else { out.innerHTML = '<p class="iba-esn-sub">Type a site (and a product if you want one item), then press <b>Show</b>.</p>'; siteIn.focus(); }
    }
    function show(w, site, words) {
        const out = w.querySelector('.iba-ss-out'), err = w.querySelector('.iba-esn-err');
        err.textContent = '';
        const code = canon(site);
        if (!code) { err.textContent = 'Type a site first.'; return; }
        const rows = report(w.__list || [], code, words);
        w.__rows = rows; w.__site = code; w.__words = String(words || '').trim();
        w.querySelector('[data-ss-print]').disabled = !rows.length;
        w.querySelector('[data-ss-csv]').disabled = !rows.length;
        const total = rows.reduce((s, r) => s + r.qty, 0);
        const broken = report.broken || 0;
        if (broken) err.textContent = broken + ' record' + (broken === 1 ? '' : 's') + ' at this site with no Product ID and no name ' + (broken === 1 ? 'was' : 'were') + ' left out (broken records, not real stock).';
        w.querySelector('[data-ss-count]').innerHTML = rows.length ? '<b>' + rows.length + '</b> item' + (rows.length === 1 ? '' : 's') + ' · ' + esc(title(code, words)) : '';
        if (!rows.length) { out.innerHTML = '<p class="iba-esn-sub">No stock at site <b>' + esc(code) + '</b>' + (w.__words ? ' for "' + esc(w.__words) + '"' : '') + '.</p>'; return; }
        out.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>#</th><th>Product ID</th><th>Name</th><th>Family</th><th style="text-align:right">Qty</th><th>Unit</th></tr></thead><tbody>' +
            rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(r.id) + '</b></td><td>' + esc(r.name) + '</td><td>' + esc(r.family) + '</td><td style="text-align:right"><b>' + esc(fmt(r.qty)) + '</b></td><td>' + esc(r.unit) + '</td></tr>').join('') +
            '</tbody><tfoot><tr><td colspan="4"><b>Total</b></td><td style="text-align:right"><b>' + esc(fmt(total)) + '</b></td><td></td></tr></tfoot></table></div>';
    }

    // ---- "Site stock" button next to Stock Report ----------------------------
    function addButton() {
        const rep = document.getElementById('ms-open-report-modal-btn');
        if (!rep) return;
        let b = document.getElementById('iba-ss-btn');
        if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.id = 'iba-ss-btn';
            b.className = 'download-btn';
            b.title = 'Current stock of one site: all items or one product, Print PDF / CSV';
            b.innerHTML = '<i class="fa-solid fa-warehouse"></i> Site stock';
            b.addEventListener('click', () => open());
            rep.insertAdjacentElement('afterend', b);
        }
        b.hidden = !allowed();
    }
    function start() {
        addButton();
        // sign-in changes who is allowed
        setInterval(addButton, 4000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    // 17.0.5 patch 42: suggestions for the assistant skill (and the window boxes)
    async function siteOptions() { const list = await stock(); return knownSites(list).map((c) => [c, siteName(c)]); }
    async function productOptions(site) {
        const list = await stock();
        const rows = String(site || '').trim() ? report(list, site, '') : [];
        return rows.map((r) => [r.name || r.id, (r.id ? r.id + ' · ' : '') + fmt(r.qty) + ' ' + r.unit]);
    }

    window.ibaSiteStock = { open, allowed, report, siteOptions, productOptions };
})();
