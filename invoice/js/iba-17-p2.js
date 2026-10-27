/* ==========================================================================
   js/iba-17-p2.js — 17.0.0 patch 2
   Invoice Entry: search a PO by vendor name.
   Type a vendor name (or part of it, e.g. "dot") in either PO search box:
   a list of that vendor's POs shows under the box with the PO number, site
   and PO value. Click one (or pick it with the arrows + Enter) and the PO
   loads exactly as if its number had been typed.
   A PO number still works as before.
   ========================================================================== */
(function () {
    'use strict';

    const INPUTS = ['im-po-search-input', 'im-po-search-input-bottom'];
    const MAX_ROWS = 60;
    const SKIP = ['wll', 'llc', 'spc', 'ltd', 'limited', 'co', 'est', 'trading', 'and', 'the', 'of', 'for'];

    const norm = (v) => String(v == null ? '' : v).toLowerCase().replace(/&/g, ' and ').replace(/w\.\s*l\.\s*l\.?/g, ' wll ').replace(/[^a-z0-9]+/g, ' ').trim();
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function poData() {
        try { if (typeof allPOData !== 'undefined' && allPOData) return allPOData; } catch (_) {}
        return null;
    }
    async function ensurePOs() {
        if (poData() && Object.keys(poData()).length) return poData();
        try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
        return poData();
    }
    function vendorOf(r) { return String((r && (r['Supplier Name'] || r['Supplier Name:'] || r.Supplier || r['Vendor Name'])) || '').trim(); }
    function siteOf(r) { return String((r && (r['Project ID'] || r.Project || r.Site)) || '').trim(); }
    function valueOf(r) {
        const v = r && (r.Amount != null ? r.Amount : (r['PO Amount'] != null ? r['PO Amount'] : r['PO Value']));
        const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, ''));
        return isFinite(n) && String(v || '').trim() ? n : null;
    }
    function money(n) {
        if (n == null) return '';
        try { return 'QAR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (_) { return 'QAR ' + n; }
    }

    // text that is a vendor search, not a PO number
    function isVendorText(text) {
        const t = String(text || '').trim();
        if (t.length < 2 || !/[a-z]/i.test(t)) return false;
        const map = poData();
        const up = t.toUpperCase().replace(/^PO[\s#:-]*/i, '');
        if (map && (map[t.toUpperCase()] || map[up])) return false;
        if (/^PO[\s#:-]*\d+$/i.test(t)) return false;
        return true;
    }

    function search(text, map) {
        const q = norm(text);
        const words = q.split(' ').filter((w) => w && SKIP.indexOf(w) === -1);
        if (!words.length) words.push(q);
        const groups = {};
        Object.keys(map || {}).forEach((po) => {
            const r = map[po] || {};
            const vendor = vendorOf(r);
            if (!vendor) return;
            const name = norm(vendor);
            const compact = name.replace(/ /g, '');
            if (!words.every((w) => name.includes(w) || compact.includes(w))) return;
            (groups[vendor] = groups[vendor] || []).push({ po: String(po).toUpperCase(), site: siteOf(r), value: valueOf(r) });
        });
        const first = words[0];
        const vendors = Object.keys(groups).sort((a, b) => {
            const as = norm(a).indexOf(first) === 0 ? 0 : 1, bs = norm(b).indexOf(first) === 0 ? 0 : 1;
            return (as - bs) || a.localeCompare(b);
        });
        vendors.forEach((v) => groups[v].sort((a, b) => b.po.localeCompare(a.po, undefined, { numeric: true })));
        // 17.0.5 patch 22: POs with an unpaid invoice first (newest invoice
        // on top), then the paid-up ones; no download (memory / saved copy)
        if (typeof window.ibaPoRankNow === 'function') {
            const rk = {};
            let ready = true;
            vendors.forEach((v) => groups[v].forEach((p) => {
                const r = window.ibaPoRankNow(p.po, ready ? redo : null);
                if (!r) ready = false;
                rk[p.po] = r || {};
            }));
            if (ready) vendors.forEach((v) => groups[v].sort((a, b) =>
                ((rk[b.po].open ? 1 : 0) - (rk[a.po].open ? 1 : 0)) || ((rk[b.po].last || 0) - (rk[a.po].last || 0))));
        }
        return { vendors, groups };
    }

    // ------------------------------------------------------------------
    // The list under the box
    // ------------------------------------------------------------------
    let box = null;        // the input the list belongs to
    let rows = [];         // POs in the order shown
    let active = -1;

    function menu() { return document.getElementById('iba-vendor-po-menu'); }
    function close() {
        const m = menu();
        if (m) m.remove();
        box = null; rows = []; active = -1;
        window.removeEventListener('scroll', place, true);
        window.removeEventListener('resize', place);
    }
    function place(e) {
        const m = menu();
        if (!m || !box) return;
        if (e && e.type === 'scroll' && m.contains(e.target)) return;
        const r = box.getBoundingClientRect();
        if (!r.width) { close(); return; }
        const width = Math.min(Math.max(420, Math.round(r.width)), window.innerWidth - 16);
        m.style.width = width + 'px';
        m.style.left = Math.min(Math.max(8, Math.round(r.left)), window.innerWidth - width - 8) + 'px';
        const below = window.innerHeight - r.bottom - 12;
        if (below < 220 && r.top > below) {
            m.style.top = 'auto';
            m.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
            m.style.maxHeight = Math.max(160, Math.min(420, r.top - 12)) + 'px';
        } else {
            m.style.bottom = 'auto';
            m.style.top = Math.round(r.bottom + 6) + 'px';
            m.style.maxHeight = Math.max(160, Math.min(420, below)) + 'px';
        }
    }
    function setActive(i) {
        const m = menu();
        if (!m) return;
        const opts = m.querySelectorAll('.iba-vpo-opt');
        if (!opts.length) { active = -1; return; }
        active = Math.max(0, Math.min(i, opts.length - 1));
        opts.forEach((o, k) => o.classList.toggle('is-active', k === active));
        opts[active].scrollIntoView({ block: 'nearest' });
    }

    function render(input, text, found) {
        let m = menu();
        if (box !== input && m) { m.remove(); m = null; }
        box = input;
        if (!m) {
            m = document.createElement('div');
            m.id = 'iba-vendor-po-menu';
            m.setAttribute('role', 'listbox');
            document.body.appendChild(m);
            m.addEventListener('mousedown', (e) => e.preventDefault());
            m.addEventListener('click', (e) => {
                const o = e.target.closest('.iba-vpo-opt');
                if (o) choose(o.getAttribute('data-po'));
            });
            m.addEventListener('mousemove', (e) => {
                const o = e.target.closest('.iba-vpo-opt');
                if (o) { const i = Number(o.getAttribute('data-i')); if (i !== active) setActive(i); }
            });
            window.addEventListener('scroll', place, true);
            window.addEventListener('resize', place);
        }
        rows = [];
        let html = '';
        let count = 0;
        found.vendors.forEach((v) => {
            const list = found.groups[v];
            if (count >= MAX_ROWS) return;
            html += '<div class="iba-vpo-vendor">' + esc(v) + '<span>' + list.length + ' PO' + (list.length === 1 ? '' : 's') + '</span></div>';
            list.forEach((p) => {
                if (count >= MAX_ROWS) return;
                html += '<button type="button" class="iba-vpo-opt" role="option" data-i="' + rows.length + '" data-po="' + esc(p.po) + '">' +
                    '<span class="iba-vpo-po">' + esc(p.po) + '</span>' +
                    '<span class="iba-vpo-site">' + esc(p.site || '-') + '</span>' +
                    '<span class="iba-vpo-val">' + esc(money(p.value)) + '</span></button>';
                rows.push(p.po);
                count++;
            });
        });
        const total = found.vendors.reduce((n, v) => n + found.groups[v].length, 0);
        m.innerHTML = '<div class="iba-vpo-head">POs for vendor &ldquo;' + esc(text) + '&rdquo;</div>' +
            (html || '<div class="iba-vpo-empty">No vendor matches &ldquo;' + esc(text) + '&rdquo;.</div>') +
            (total > count ? '<div class="iba-vpo-empty">Showing ' + count + ' of ' + total + ' POs. Type more of the name to narrow it.</div>' : '');
        active = -1;
        if (rows.length) setActive(0);
        place();
    }

    // the saved invoice copy arrived: show the list again in the new order
    function redo() {
        const input = box;
        if (!input || !menu()) return;
        const text = String(input.value || '').trim();
        if (text.length >= 2 && poData() && isVendorText(text)) render(input, text, search(text, poData()));
    }

    function choose(po) {
        const input = box;
        close();
        if (!po) return;
        INPUTS.forEach((id) => { const el = document.getElementById(id); if (el) el.value = po; });
        const run = window.handlePOSearch;
        const p = typeof run === 'function' ? run(po) : null;
        Promise.resolve(p).finally(() => setTimeout(() => document.getElementById('im-inv-no')?.focus(), 0));
        if (input) input.blur();
    }

    let timer = null;
    async function suggest(input, now) {
        clearTimeout(timer);
        const go = async () => {
            const text = String(input.value || '').trim();
            if (text.length < 2 || !/[a-z]/i.test(text)) { if (box === input) close(); return; }
            const map = await ensurePOs();
            if (String(input.value || '').trim() !== text) return; // typed on meanwhile
            if (!map || !isVendorText(text)) { if (box === input) close(); return; }
            render(input, text, search(text, map));
        };
        if (now) return go();
        timer = setTimeout(go, 220);
    }

    document.addEventListener('input', (e) => {
        const el = e.target;
        if (el && INPUTS.indexOf(el.id) !== -1) suggest(el, false);
    }, true);

    // Runs before the page's own keys: Space adds to batch and Enter searches a
    // PO there, so vendor names would not get through.
    document.addEventListener('keydown', (e) => {
        const el = e.target;
        if (!el || INPUTS.indexOf(el.id) === -1) return;
        const open = box === el && !!menu();
        const vendorText = isVendorText(el.value);
        if ((e.key === ' ' || e.code === 'Space') && vendorText) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            const s = el.selectionStart, t = el.selectionEnd;
            try { el.setRangeText(' ', s, t, 'end'); } catch (_) { el.value += ' '; }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        if (e.key === 'ArrowDown' && open) { e.preventDefault(); e.stopImmediatePropagation(); setActive(active + 1); return; }
        if (e.key === 'ArrowUp' && open) { e.preventDefault(); e.stopImmediatePropagation(); setActive(active - 1); return; }
        if (e.key === 'Escape' && open) { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
        if (e.key === 'Enter' && vendorText) {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            if (open && active >= 0 && rows[active]) { choose(rows[active]); return; }
            suggest(el, true);
        }
    }, true);
    // the old "keypress" Enter search on the top box
    document.addEventListener('keypress', (e) => {
        const el = e.target;
        if (el && INPUTS.indexOf(el.id) !== -1 && (e.key === 'Enter' || e.key === ' ') && isVendorText(el.value)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
        }
    }, true);

    // the Search PO buttons with a vendor name in the box
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        const m = menu();
        if (m && !m.contains(t) && !(box && box.contains(t))) close();
        const btn = t.closest('#im-po-search-button, #im-po-search-button-bottom');
        if (!btn) return;
        const input = document.getElementById(btn.id === 'im-po-search-button' ? 'im-po-search-input' : 'im-po-search-input-bottom');
        if (input && isVendorText(input.value)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            suggest(input, true);
            input.focus();
        }
    }, true);

    document.addEventListener('focusout', (e) => {
        if (e.target && e.target === box) setTimeout(() => { if (box && document.activeElement !== box) close(); }, 150);
    }, true);

    function placeholders() {
        const a = document.getElementById('im-po-search-input');
        const b = document.getElementById('im-po-search-input-bottom');
        if (a && /PO Number/i.test(a.placeholder)) a.placeholder = 'PO number or vendor name...';
        if (b && /^Search PO/i.test(b.placeholder)) b.placeholder = 'PO or vendor...';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeholders);
    else placeholders();

    const css = document.createElement('style');
    css.textContent =
        '#iba-vendor-po-menu{position:fixed;z-index:99990;overflow:auto;scrollbar-width:none;border-radius:12px;padding:6px;' +
        'background:rgba(13,25,39,.96);border:1px solid rgba(227,201,138,.35);box-shadow:0 18px 40px rgba(0,0,0,.45);' +
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-size:13px;color:#EEF3F8}' +
        '#iba-vendor-po-menu::-webkit-scrollbar{display:none}' +
        '#iba-vendor-po-menu .iba-vpo-head{padding:6px 10px 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#E3C98A}' +
        '#iba-vendor-po-menu .iba-vpo-vendor{display:flex;justify-content:space-between;gap:10px;padding:8px 10px 4px;font-weight:700;color:#F3DFA8;border-top:1px solid rgba(255,255,255,.08)}' +
        '#iba-vendor-po-menu .iba-vpo-vendor span{font-weight:500;font-size:11.5px;color:#EBD8A8}' +
        '#iba-vendor-po-menu .iba-vpo-opt{display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;width:100%;text-align:left;' +
        'padding:7px 10px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:inherit}' +
        '#iba-vendor-po-menu .iba-vpo-opt.is-active{background:rgba(19,138,151,.35)}' +
        '#iba-vendor-po-menu .iba-vpo-po{font-weight:700;color:#fff}' +
        '#iba-vendor-po-menu .iba-vpo-site{color:#EBD8A8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '#iba-vendor-po-menu .iba-vpo-val{color:#7FE3D6;font-variant-numeric:tabular-nums;white-space:nowrap}' +
        '#iba-vendor-po-menu .iba-vpo-empty{padding:8px 10px;color:#EBD8A8}';
    document.head.appendChild(css);

    window.ibaVendorPOSearch = { search: (t) => search(t, poData()), close };
})();
