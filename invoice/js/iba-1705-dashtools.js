/* 17.0.5 patch 203 (martin)
   - Dashboard: "Weekly report" button removed (the assistant skill "Weekly report" does it);
     "Refresh" and "Check all" moved to Settings > Dashboard tools, so the Dashboard stays clean.
     The buttons are MOVED (same ids, same clicks, same rights: Check all stays Super Admin).
   - Batch Entry: "Notes to Accounts" sits in the same button group as Search Note / Clear,
     so it looks like the buttons next to it (it was a lone teal button). */
(function () {
    'use strict';
    if (window.ibaDashTools) return;
    const $ = (id) => document.getElementById(id);

    function card() {
        let c = $('iba-dash-tools');
        if (c) return c;
        const after = $('iba-ss-settings') || document.querySelector('.settings-card.settings-audio-card');
        if (!after) return null;
        c = document.createElement('div');
        c.className = 'settings-card iba-dt-card';
        c.id = 'iba-dash-tools';
        c.innerHTML = '<div class="settings-card-header compact"><div class="settings-card-icon"><i class="fa-solid fa-gauge"></i></div><div>' +
            '<h2>Dashboard tools</h2><p>Reload the Dashboard numbers if something looks out of date. It also updates by itself.</p></div></div>' +
            '<div class="iba-dt-btns"></div><p class="iba-dt-note" hidden></p>';
        after.after(c);
        return c;
    }
    function move() {
        const c = card(); if (!c) return;
        const box = c.querySelector('.iba-dt-btns');
        ['wd-active-dashboard-refresh', 'iba-task-check-btn'].forEach((id) => {
            const b = $(id);
            if (b && b.parentElement !== box) { box.appendChild(b); b.classList.add('iba-dt-btn'); }
        });
        const r = $('wd-active-dashboard-refresh');
        if (r && !r.dataset.ibaDt) {
            r.dataset.ibaDt = '1';
            if (!/Refresh/i.test(r.textContent)) r.insertAdjacentHTML('beforeend', ' <span>Refresh Dashboard</span>');
            r.addEventListener('click', () => {
                const n = c.querySelector('.iba-dt-note');
                if (n) { n.hidden = false; n.textContent = 'Refreshing the Dashboard…'; setTimeout(() => { n.textContent = 'Done. Open the Dashboard to see it.'; }, 2500); setTimeout(() => { n.hidden = true; }, 9000); }
            });
        }
    }
    function n2a() {
        const b = $('iba-n2a-btn'), s = $('im-batch-search-by-note-button');
        const g = s && s.parentElement;
        if (!b || !g || !g.classList.contains('iba-bt-grp') || b.parentElement === g) return;
        b.removeAttribute('style');
        g.insertBefore(b, g.firstChild);
    }
    function tick() { try { move(); } catch (_) {} try { n2a(); } catch (_) {} }
    function start() { tick(); setInterval(tick, 1500); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaDashTools = { move };
})();
