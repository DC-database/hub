/* 18.0.0 patch 25 (martin approved mock-up): Batch Entry top area = 2 thin rows (PC).
     Row 1: [PO | Status | Note] switch · one search box (or the note list) · its search button · + New PO
            ...... count · Clear · More ▾ · Save
     Row 2: FOR ALL N: Status · Attention · Note · CA IP WA SUM · ⚡ Urgent · Tell me
   Existing elements are MOVED (iba-1705-batchui.js already built #iba-bt-panel): ids and click handlers stay.
   More menu: Notes to Accounts, Add in-file POs to pull-out list (red number), New entries from Reception (Super).
   Clear now asks first when cards are in the batch (it empties the whole batch). Refresh Data is hidden (CSS). */
(function () {
    'use strict';
    if (window.ibaBatchBar) return;
    const $ = (id) => document.getElementById(id);
    const MODES = { po: 'PO number…  Enter = add', status: 'Status, e.g. For SRV', note: '' };
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function grp(cls, nodes) {
        const g = document.createElement('div');
        g.className = 'iba-bt-grp' + (cls ? ' ' + cls : '');
        nodes.forEach((n) => { if (n) { n.removeAttribute('style'); g.appendChild(n); } });
        return g;
    }
    function nCards() { const b = $('im-batch-table-body'); return b ? b.querySelectorAll('.batch-invoice-card').length : 0; }
    function setMode(panel, m) {
        panel.dataset.mode = m;
        panel.querySelectorAll('[data-bb-mode]').forEach((b) => b.classList.toggle('is-on', b.dataset.bbMode === m));
        const inp = $('im-batch-po-input');
        if (inp && MODES[m]) inp.placeholder = MODES[m];
        try { localStorage.setItem('iba-bb-mode-v1', m); } catch (_) {}
    }
    function paintCount() {
        const n = nCards();
        const l = $('iba-bb-all-lab');
        if (l) l.textContent = 'For all ' + n;
        const s = $('im-batch-save-button');
        if (s && !s.classList.contains('is-saving') && !s.disabled) s.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save all' + (n ? ' ' + n : '');
    }
    function paintMore(n) {
        const b = $('iba-bb-badge');
        if (b) { b.textContent = n ? String(n) : ''; b.hidden = !n; }
    }
    // parts other scripts add a bit later (Urgent / Tell me ticks, Notes to Accounts)
    function late() {
        const gc = $('im-batch-global-controls'), menu = $('iba-bb-menu');
        if (!gc || !menu) return;
        // 18.0.0 patch 26: Urgent + Tell me side by side in our own box, short words (the row already says "For all N")
        let box = $('iba-bb-ticks');
        if (!box) { box = document.createElement('span'); box.id = 'iba-bb-ticks'; box.className = 'iba-bb-ticks'; gc.appendChild(box); }
        const urg = $('iba-urg-all-wrap'), tell = $('iba-ret-all') && $('iba-ret-all').closest('label');
        [[urg, 'Urgent'], [tell, 'Tell me']].forEach(([lab, word]) => {
            if (!lab) return;
            if (lab.parentNode !== box) { lab.removeAttribute('style'); box.appendChild(lab); }
            if (!lab.dataset.bbShort) {
                lab.dataset.bbShort = '1';
                Array.from(lab.childNodes).forEach((n) => { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ' ' + word; });
                if (!lab.title) lab.title = word + ' for every invoice in this batch';
            }
        });
        if (urg && tell && urg.nextSibling !== tell) box.insertBefore(urg, tell);
        const old = gc.querySelector('.iba-urg-tickgrp'); if (old && !old.children.length) old.remove();
        const n2a = $('iba-n2a-btn');
        if (n2a && n2a.parentNode !== menu) { n2a.removeAttribute('style'); menu.insertBefore(n2a, menu.firstChild); }
        const bd = $('iba-bd-all');
        if (bd && bd.parentNode !== menu) menu.appendChild(bd);
        if (!$('iba-bb-recv') && isSuper() && window.ibaReceptionBatch) {
            const rb = document.createElement('button');
            rb.type = 'button'; rb.id = 'iba-bb-recv'; rb.className = 'secondary-btn';
            rb.innerHTML = '<i class="fa-solid fa-inbox"></i> New entries from Reception';
            rb.title = 'Every reception New Entry waiting for you becomes a new card here';
            menu.appendChild(rb);
        }
    }
    function build() {
        const panel = $('iba-bt-panel');
        if (!panel) return false;
        if (panel.classList.contains('iba-bt3')) return true;
        const r1 = panel.querySelector('.iba-bt-r1'), r2 = panel.querySelector('.iba-bt-r2'), gc = $('im-batch-global-controls');
        const search = $('im-batch-po-input') && $('im-batch-po-input').closest('.search-bar-local');
        const note = panel.querySelector('.batch-note-search-wrapper');
        if (!r1 || !r2 || !gc || !search || !note) return false;

        // ---- row 1 ----
        const seg = document.createElement('div');
        seg.className = 'iba-bb-seg';
        seg.setAttribute('role', 'tablist');
        seg.innerHTML = '<button type="button" data-bb-mode="po">PO</button><button type="button" data-bb-mode="status">Status</button><button type="button" data-bb-mode="note">Note</button>';
        const findBtns = grp('iba-bb-find', [$('im-batch-search-existing-button'), $('im-batch-search-by-status-button'), $('im-batch-search-by-note-button')]);
        const ss = $('im-batch-search-by-status-button'); if (ss) { ss.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Find'; ss.title = 'Add every invoice in this status'; }
        const sn = $('im-batch-search-by-note-button'); if (sn) { sn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Find'; sn.title = 'Add the invoices of this summary note'; }
        const addG = grp('', [$('im-batch-add-po-button')]);
        const right = document.createElement('div');
        right.className = 'iba-bb-right';
        const cnt = $('batch-count-display');
        const clr = $('im-batch-clear-button'); if (clr) clr.title = 'Clear the batch (removes all cards, nothing saved is touched)';
        const more = document.createElement('div');
        more.className = 'iba-bb-more';
        more.innerHTML = '<button type="button" id="iba-bb-more-btn" class="secondary-btn" aria-haspopup="true" aria-expanded="false">More <i class="fa-solid fa-chevron-down"></i><span id="iba-bb-badge" hidden></span></button>' +
            '<div id="iba-bb-menu" class="iba-bb-menu" hidden></div>';
        const menu = more.querySelector('#iba-bb-menu');
        const n2a = $('iba-n2a-btn'); if (n2a) { n2a.removeAttribute('style'); menu.appendChild(n2a); }
        const bd = $('iba-bd-all'); if (bd) menu.appendChild(bd);
        right.appendChild(grp('', [cnt, clr]));
        right.appendChild(more);
        right.appendChild(grp('iba-bb-save', [$('im-batch-save-button')]));
        r1.innerHTML = '';
        search.removeAttribute('style');
        note.removeAttribute('style');
        [seg, search, note, findBtns, addG, right].forEach((n) => r1.appendChild(n));

        // ---- row 2 = the "for all" controls ----
        const all = gc.querySelector('.iba-bt-all');
        if (all) { all.id = 'iba-bb-all-lab'; }
        const quick = r2.querySelector('.iba-bt-grp.is-quick');
        const sum = $('iba-batch-sum-all');
        if (quick) { if (sum) { sum.removeAttribute('style'); sum.className = 'iba-bt-q is-sum'; sum.innerHTML = '<b>SUM</b>'; quick.appendChild(sum); } gc.appendChild(quick); }
        const st = $('im-batch-global-status');
        if (st && st.options[0] && st.options[0].value === '') st.options[0].text = 'Status: no change';
        const nt = $('im-batch-global-note'); if (nt) nt.placeholder = 'Summary note for all…'; // p105
        r2.hidden = true;
        late();
        let k = 0; const iv = setInterval(() => { late(); if (++k > 40) clearInterval(iv); }, 500);
        panel.classList.add('iba-bt3');
        document.body.classList.add('iba-bb3');
        let m = 'po'; try { m = localStorage.getItem('iba-bb-mode-v1') || 'po'; } catch (_) {}
        setMode(panel, MODES.hasOwnProperty(m) ? m : 'po');
        paintCount();
        const tb = $('im-batch-table-body');
        if (tb) new MutationObserver(paintCount).observe(tb, { childList: true });
        // patch 84 (martin): after Save the app puts back the label it had BEFORE saving ("Save all 26"), so the count
        // is painted again as soon as the button stops saving
        const sb = $('im-batch-save-button');
        if (sb && !sb.dataset.bbWatch) { sb.dataset.bbWatch = '1'; new MutationObserver(() => setTimeout(paintCount, 0)).observe(sb, { attributes: true, attributeFilter: ['class', 'disabled'] }); }
        try { if (window.ibaBatchDel) window.ibaBatchDel.scan(); } catch (_) {}
        return true;
    }
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t.closest) return;
        const mb = t.closest('[data-bb-mode]');
        if (mb) { e.preventDefault(); setMode($('iba-bt-panel'), mb.dataset.bbMode); const i = mb.dataset.bbMode === 'note' ? null : $('im-batch-po-input'); if (i) i.focus(); return; }
        const menu = $('iba-bb-menu'), btn = $('iba-bb-more-btn');
        if (t.closest('#iba-bb-more-btn')) { e.preventDefault(); late(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); return; }
        if (menu && !menu.hidden && t.closest('#iba-bb-menu button')) setTimeout(() => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }, 0);
        else if (menu && !menu.hidden && !t.closest('#iba-bb-menu')) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
        if (t.closest('#iba-bb-recv')) {
            e.preventDefault();
            window.ibaReceptionBatch.run(false).then((r) => {
                const n = r && r.added ? r.added.length : 0;
                const msg = !r || !r.total ? 'No reception entries are waiting.' : n + ' added' + (r.skipped && r.skipped.length ? ', ' + r.skipped.length + ' skipped' : '') + '.';
                try { window.ibaToast ? window.ibaToast(msg) : alert(msg); } catch (_) {}
            }).catch((err) => alert('New entries from Reception: ' + ((err && err.message) || err)));
            return;
        }
        // Clear empties the whole batch: ask first
        if (t.closest('#im-batch-clear-button')) {
            const n = nCards();
            if (n && !confirm('Clear the batch?\n\nThis removes all ' + n + ' card' + (n === 1 ? '' : 's') + ' from the screen. Nothing saved is deleted.')) { e.preventDefault(); e.stopImmediatePropagation(); }
        }
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = $('iba-bb-menu'); if (m && !m.hidden) m.hidden = true; } });
    window.addEventListener('iba:bd-count', (e) => paintMore((e.detail && e.detail.n) || 0));
    let tries = 0;
    function onPhone() { const b = document.body; return !!(b && (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone'))); }
    (function boot() {
        if (onPhone()) { if (++tries < 120) setTimeout(boot, 500); return; }
        if (!build() && ++tries < 120) setTimeout(boot, 300);
    })();
    window.ibaBatchBar = { build, setMode };
})();
