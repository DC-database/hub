/* 18.0.0 patch 130 (martin: Material Stock still slow): a ticked row in a pop-up table (and in the IRIS "Mark urgent"
   table) is highlighted with the class tr.iba-row-checked. This used to be a css :has(input:checked) rule on every
   table row, which made the browser recheck the whole page whenever any text changed (clock, counters), so scrolling
   long lists was slow. Same look, set here instead: after every click / change, and every 0.6 s for pop-ups that are open. */
(function () {
    'use strict';
    if (window.ibaRowCheck) return;
    const HOSTS = '.modal-overlay:not(#standard-job-modal) > .modal-container tbody, #iba-ai-panel .iba-ai-urg-table tbody';
    function sync(openOnly) {
        let bodies;
        try { bodies = document.querySelectorAll(HOSTS); } catch (_) { return; }
        for (let i = 0; i < bodies.length; i++) {
            const urg = !!bodies[i].closest('.iba-ai-urg-table');
            if (openOnly && !urg) { const m = bodies[i].closest('.modal-overlay'); if (!m || m.classList.contains('hidden') || m.style.display === 'none') continue; }
            const rows = bodies[i].rows || [];
            for (let j = 0; j < rows.length; j++) {
                const tr = rows[j];
                const on = !!tr.querySelector(urg ? 'input:checked' : 'input[type="checkbox"]:checked');
                if (tr.classList.contains('iba-row-checked') !== on) tr.classList.toggle('iba-row-checked', on);
            }
        }
    }
    let t = 0;
    function soon() { clearTimeout(t); t = setTimeout(sync, 0); }
    document.addEventListener('change', soon, true);
    document.addEventListener('click', soon, true);
    setInterval(() => { if (!document.hidden) sync(true); }, 600);
    window.ibaRowCheck = { sync };
})();
