/* ==========================================================================
   js/iba-1705-ieui.js — 17.0.5 patch 116
   Invoice Entry look (martin approved mock-up, Nov 2026):
   - Search PO / refresh / Clear joined in one glass button group.
   - PO strip: small labels above big values (PO, Site, PO value, Vendor),
     PO record + OPF / +Del grouped on the right.
   - Active jobs side panel: 2 lines per job
       PO  [new] [N]                 value
       Vendor                   05-Nov-26
   Only moves / relabels existing elements: every button keeps its id and its
   click handler. Styles: end of css/iba-1705-fit.css (body.iba-ie-v2).
   ========================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function top() {
        const box = $('im-po-search-container');
        const s = $('im-po-search-button'), r = $('im-refresh-entry-button'), c = $('im-po-clear-button');
        if (!box || !s || !r || !c) return false;
        if (!box.querySelector('.iba-ie-grp')) {
            const g = document.createElement('div');
            g.className = 'iba-ie-grp';
            s.parentNode.insertBefore(g, s);
            g.appendChild(s); g.appendChild(r); g.appendChild(c);
            c.removeAttribute('style');
        }
        const grid = document.querySelector('#im-modal-po-details .po-compact-grid');
        if (grid && !grid.dataset.ibaUi) {
            const names = ['PO', 'Site', 'PO value', 'Vendor'];
            Array.prototype.slice.call(grid.children, 0, 4).forEach((d, i) => {
                const l = d.querySelector('span');
                if (l) { l.textContent = names[i]; l.classList.add('iba-ie-lab'); }
                d.classList.add('iba-ie-fact');
            });
            const rec = grid.children[4];
            if (rec) {
                rec.classList.add('iba-ie-rec');
                const l = rec.querySelector('span');
                if (l && !l.classList.contains('im-po-record')) { l.textContent = 'PO record'; l.classList.add('iba-ie-lab'); }
            }
            grid.dataset.ibaUi = '1';
        }
        document.body.classList.add('iba-ie-v2');
        return true;
    }

    // ---- Active jobs side panel ---------------------------------------------
    function shortDate(v) {
        const t = String(v || '').trim();
        if (!t) return '';
        if (typeof window.ibaDay === 'function') return window.ibaDay(t); // 17.0.5 p157
        let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return m[3].padStart(2, '0') + '-' + MON[Number(m[2]) - 1] + '-' + m[1].slice(2);
        m = t.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ](\d{2,4})/);
        if (m) return m[1].padStart(2, '0') + '-' + m[2].charAt(0).toUpperCase() + m[2].slice(1, 3).toLowerCase() + '-' + m[3].slice(-2);
        m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return m[1].padStart(2, '0') + '-' + MON[Number(m[2]) - 1] + '-' + m[3].slice(2);
        const d = new Date(t);
        return isNaN(d) ? t : String(d.getDate()).padStart(2, '0') + '-' + MON[d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
    }
    function money(v) {
        try { if (typeof formatCurrency === 'function') return formatCurrency(v); } catch (_) {}
        const n = Number(String(v == null ? '' : v).replace(/,/g, ''));
        return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : esc(v);
    }
    function compact(li) {
        if (!li || li.dataset.ibaUi || !li.classList.contains('im-sidebar-item')) return;
        const st = li.querySelector('.im-compact-status');
        const cat = li.querySelector('.im-compact-category');
        const status = st ? String(st.firstChild && st.firstChild.nodeType === 3 ? st.firstChild.nodeValue : st.textContent).trim() : '';
        const group = cat ? cat.textContent.trim() : '';
        const stTag = /^new entry$/i.test(status) ? 'new' : status;
        const vendor = li.dataset.vendorName || 'No vendor';
        li.dataset.ibaUi = '1';
        li.classList.add('iba-ie-job');
        li.title = [li.dataset.po ? 'PO ' + li.dataset.po : '', vendor, status, group].filter(Boolean).join(' · ');
        li.innerHTML =
            '<span class="iba-ie-j-po"><b>' + esc(li.dataset.po || 'N/A') + '</b>' +
            (stTag ? '<i class="iba-ie-j-st' + (stTag === 'new' ? ' is-new' : '') + '">' + esc(stTag) + '</i>' : '') +
            (group ? '<i class="iba-ie-j-gr" title="' + esc(group) + '">' + esc(group.charAt(0).toUpperCase()) + '</i>' : '') + '</span>' +
            '<span class="iba-ie-j-val">' + money(li.dataset.amount) + '</span>' +
            '<span class="iba-ie-j-ven">' + esc(vendor) + '</span>' +
            '<span class="iba-ie-j-date">' + esc(shortDate(li.dataset.date)) + '</span>';
    }
    function side() {
        if (typeof window.renderActiveJobsSidebar !== 'function' || window.renderActiveJobsSidebar.__ibaUi) return typeof window.renderActiveJobsSidebar === 'function';
        const orig = window.renderActiveJobsSidebar;
        const w = function () {
            const r = orig.apply(this, arguments);
            if (onPhone()) return r;
            try { document.querySelectorAll('#im-entry-sidebar-list li.im-sidebar-item, li.im-sidebar-item').forEach(compact); } catch (e) { console.warn('ieui side', e); }
            return r;
        };
        w.__ibaUi = true;
        window.renderActiveJobsSidebar = w;
        try { document.querySelectorAll('li.im-sidebar-item').forEach(compact); } catch (_) {}
        return true;
    }

    function onPhone() { const b = document.body; return !!(b && (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone'))); }
    let tries = 0;
    (function boot() {
        if (onPhone()) { if (++tries < 80) setTimeout(boot, 500); return; } // phone keeps its own look
        const a = top(), b = side();
        if ((!a || !b) && ++tries < 60) setTimeout(boot, 250);
    })();
    window.ibaIeUi = { compact: compact, shortDate: shortDate };
})();
