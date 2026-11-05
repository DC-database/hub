/* ==========================================================================
   js/iba-1705-batchui.js — 17.0.5 patch 116
   Batch Entry look (martin approved mock-up, Nov 2026). PC only (CSS scoped
   to body.iba-bt-v2:not(.iba-mobile-ui)).
   - One glass panel on top, three rows:
       1) PO search · [Search PO | By Status | + New PO] ...... [Refresh | Total | Save all]
       2) Summary note box · [Search note | Clear] ............ Send all to [CA | IP | WA]
       3) Apply to all: Attention · Status (SUM ALL) · Note (Tell me for all)
     Existing elements are MOVED, never rebuilt: every id and click handler stays.
   - "Set all status" list: (No change), Most used group, then All statuses.
   - CA / IP / WA set the status + attention of every card at once:
       CA = CEO Approval + Hamad, IP = In Process + E.Ali, WA = With Accounts (no attention).
   - Cards: fields regrouped with CSS only (css/iba-1705-fit.css, end).
   ========================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const MOST = ['With Accounts', 'For SRV', 'In Process', 'Report', 'For Summary', 'CEO Approval'];
    const QUICK = {
        CA: { status: 'CEO Approval', person: 'Hamad', sub: 'Hamad' },
        IP: { status: 'In Process', person: 'E.Ali', sub: 'E.Ali' },
        WA: { status: 'With Accounts', person: '', sub: 'no attention' }
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    function say(m) { try { if (typeof window.ibaToast === 'function') return window.ibaToast(m); } catch (_) {} try { if (typeof showToast === 'function') return showToast(m, 'success'); } catch (_) {} }

    function grp(cls, nodes) {
        const g = document.createElement('div');
        g.className = 'iba-bt-grp' + (cls ? ' ' + cls : '');
        nodes.forEach((n) => { if (n) { n.removeAttribute('style'); g.appendChild(n); } });
        return g;
    }
    function lab(text, cls) {
        const s = document.createElement('span');
        s.className = 'iba-bt-lab' + (cls ? ' ' + cls : '');
        s.textContent = text;
        return s;
    }
    function build() {
        const sec = $('im-batch-entry');
        const row = sec && sec.querySelector('.iba-batch-search-row');
        const gc = $('im-batch-global-controls');
        const need = ['im-batch-po-input', 'im-batch-search-existing-button', 'im-batch-search-by-status-button', 'im-batch-add-po-button',
            'im-refresh-batch-button', 'batch-count-display', 'im-batch-save-button', 'im-batch-search-by-note-button', 'im-batch-clear-button'];
        if (!sec || !row || !gc || need.some((id) => !$(id))) return false;
        if ($('iba-bt-panel')) return true;
        const search = $('im-batch-po-input').closest('.search-bar-local');
        const note = sec.querySelector('.batch-note-search-wrapper');
        if (!search || !note) return false;

        const panel = document.createElement('div');
        panel.id = 'iba-bt-panel';
        panel.className = 'iba-bt';
        const r1 = document.createElement('div');
        r1.className = 'iba-bt-row iba-bt-r1';
        search.removeAttribute('style');
        r1.appendChild(search);
        r1.appendChild(grp('', [$('im-batch-search-existing-button'), $('im-batch-search-by-status-button'), $('im-batch-add-po-button')]));
        r1.appendChild(grp('is-right', [$('im-refresh-batch-button'), $('batch-count-display'), $('im-batch-save-button')]));
        const r2 = document.createElement('div');
        r2.className = 'iba-bt-row iba-bt-r2';
        r2.appendChild(lab('Summary note', 'is-w'));
        note.removeAttribute('style');
        r2.appendChild(note);
        r2.appendChild(grp('', [$('im-batch-search-by-note-button'), $('im-batch-clear-button')]));
        const ql = lab('Send all to', 'is-gold is-right');
        r2.appendChild(ql);
        const qg = grp('is-quick', []);
        Object.keys(QUICK).forEach((k) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'iba-bt-q is-' + k.toLowerCase();
            b.dataset.btQuick = k;
            b.title = 'Every card: ' + QUICK[k].status + (QUICK[k].person ? ' · attention ' + QUICK[k].person : ' · no attention');
            b.innerHTML = '<b>' + k + '</b><small>' + QUICK[k].sub + '</small>';
            qg.appendChild(b);
        });
        r2.appendChild(qg);
        panel.appendChild(r1);
        panel.appendChild(r2);
        row.parentNode.insertBefore(panel, row.nextSibling); // after the old row: style.css styles '#im-batch-entry > div:nth-of-type(2)'
        panel.appendChild(gc);
        gc.removeAttribute('style');
        // row 3 labels
        const first = gc.firstElementChild;
        if (first && !first.classList.contains('form-group')) { first.className = 'iba-bt-all'; first.textContent = 'Apply to all'; }
        const la = gc.querySelector('label[for="im-batch-global-attention"]'); if (la) la.textContent = 'Attention';
        const ls = gc.querySelector('label[for="im-batch-global-status"] > span'); if (ls) ls.textContent = 'Status';
        const ln = gc.querySelector('label[for="im-batch-global-note"]'); if (ln) ln.textContent = 'Note';
        document.body.classList.add('iba-bt-v2');
        return true;
    }

    // ---- status list: Most used first -----------------------------------
    function groupStatus() {
        const sel = $('im-batch-global-status');
        if (!sel) return false;
        if (sel.querySelector('optgroup[data-bt]')) return true;
        // options added later (iba-status-options puts Approved / Rejected / own statuses after
        // CEO Approval) belong in "All statuses", not in Most used
        const tidy = () => {
            const m = sel.querySelector('optgroup[data-bt="most"]'), a = sel.querySelector('optgroup[data-bt="all"]');
            if (!m || !a) return;
            Array.from(m.children).forEach((o) => { if (MOST.indexOf(o.value) === -1) a.appendChild(o); });
        };
        setTimeout(() => { try { new MutationObserver(tidy).observe(sel, { childList: true, subtree: true }); tidy(); } catch (_) {} }, 0);
        const opts = Array.from(sel.options);
        const blank = opts.find((o) => o.value === '');
        const most = document.createElement('optgroup');
        most.label = 'Most used';
        most.dataset.bt = 'most';
        const rest = document.createElement('optgroup');
        rest.label = 'All statuses';
        rest.dataset.bt = 'all';
        MOST.forEach((v) => { const o = opts.find((x) => x.value === v); if (o) most.appendChild(o); });
        opts.forEach((o) => { if (o !== blank && o.parentNode === sel) rest.appendChild(o); });
        const keep = sel.value;
        if (blank) sel.appendChild(blank);
        sel.appendChild(most);
        sel.appendChild(rest);
        sel.value = keep;
        return true;
    }

    // ---- CA / IP / WA -----------------------------------------------------
    function attnChoices() { try { return (typeof imBatchGlobalAttentionChoices !== 'undefined' && imBatchGlobalAttentionChoices) ? imBatchGlobalAttentionChoices : null; } catch (_) { return null; } }
    function realName(person) {
        const want = String(person || '').toLowerCase();
        let names = [];
        try { names = ((typeof allUsersData !== 'undefined' && Array.isArray(allUsersData)) ? allUsersData : []).filter((u) => u && u.Name && String(u.Status || '').toLowerCase() !== 'disabled').map((u) => String(u.Name).trim()); } catch (_) {}
        return names.find((n) => n.toLowerCase() === want) || names.find((n) => n.toLowerCase().replace(/[^a-z]/g, '') === want.replace(/[^a-z]/g, '')) || person;
    }
    async function quick(btn) {
        const q = QUICK[btn.dataset.btQuick];
        const sel = $('im-batch-global-status');
        if (!q || !sel) return;
        const cards = document.querySelectorAll('#im-batch-table-body .batch-invoice-card').length;
        if (!cards) { say('Add invoices to the batch first.'); return; }
        btn.disabled = true;
        try {
            sel.value = q.status;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(600);
            let who = '';
            if (q.person) {
                who = realName(q.person);
                const away = window.ibaAwayGuard ? window.ibaAwayGuard.awayOf(who) : null;
                if (away && away.target) { say(away.name + ' is on vacation, so attention is ' + away.target + '.'); who = away.target; }
                const c = attnChoices();
                if (c) {
                    c.setChoiceByValue(who);
                    $('im-batch-global-attention').dispatchEvent(new Event('change', { bubbles: true }));
                    await wait(300);
                    let got = '';
                    try { got = String(c.getValue(true) || ''); } catch (_) {}
                    if (got.toLowerCase() !== who.toLowerCase()) { say(who + ' is not in the Attention list. Status was set; pick the attention by hand.'); return; }
                }
            }
            say(cards + ' card' + (cards === 1 ? '' : 's') + ': ' + q.status + (who ? ' · ' + who : ''));
        } catch (e) {
            console.warn('batch quick', e);
            say('Could not set all cards: ' + ((e && e.message) || e));
        } finally { btn.disabled = false; }
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-bt-quick]');
        if (!b) return;
        e.preventDefault();
        quick(b);
    }, true);

    let tries = 0;
    function onPhone() { const b = document.body; return !!(b && (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone'))); }
    (function boot() {
        if (onPhone()) { if (++tries < 80) setTimeout(boot, 500); return; }
        const a = build(), b = groupStatus();
        if ((!a || !b) && ++tries < 80) setTimeout(boot, 250);
    })();
    window.ibaBatchUi = { quick: quick, QUICK: QUICK };
})();
