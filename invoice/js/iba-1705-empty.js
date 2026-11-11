/* 17.0.5 patch 198 (martin): hide empty areas until there is something to show (PC only).
   Hide, never remove: the elements stay in the page, only a class on the section changes.
   - WorkDesk Active Task / Inventory Active Job: no tasks at all (filter All, no search)
     -> search, Clear, filters, date tabs, summary and table hidden, one short line instead
   - Invoice Records: the sheet (header + rows) and grand total hidden until a search runs
   - Invoice Entry page: PO details strip hidden until a PO is searched
   - Job Records: table and summary hidden until a tab or a search loads records
   - Summary Note: Prev Summary + Print moved to the left panel above Full refresh,
     PDF pane hidden until a summary is generated
   17.0.5 patch 205: Material Stock table (header too) hidden until a Family tab is clicked or a
     search is typed; Work History opens without loading a tab (same as Job Records). */
(function () {
    'use strict';
    if (window.ibaEmpty) return;
    const $ = (id) => document.getElementById(id);
    const txt = (el) => String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
    const isPhone = () => document.body.classList.contains('iba-mobile-ui');
    function set(el, cls, on) { if (el && el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }

    function hint(sec, after, cls, msg) {
        let h = sec.querySelector(':scope > .iba-empty-hint');
        if (!h) {
            h = document.createElement('div');
            h.className = 'iba-empty-hint ' + cls;
            h.innerHTML = msg;
            if (after && after.parentElement === sec) after.after(h); else sec.appendChild(h);
        }
    }

    // ---- Active Task (WorkDesk / Invoice) and Inventory Active Job ----
    function noTasks(body, search, dates) {
        if (!body) return false;
        const rows = body.querySelectorAll(':scope > tr');
        if (rows.length !== 1) return false;
        const e = rows[0].querySelector('.wd-modern-empty-row');
        if (!e || e.classList.contains('wd-select-category-state')) return false;
        if (!/under "All"/i.test(txt(e))) return false;          // another filter picked: keep the tabs
        if (search && String(search.value || '').trim()) return false;
        if (dates) { const a = dates.querySelector('.active'); if (a && a !== dates.firstElementChild) return false; }
        return true;
    }
    function tasks() {
        const a = $('wd-activetask');
        if (a) {
            hint(a, a.querySelector(':scope > .wd-page-hero'), 'iba-eh-tasks', '<i class="fa-solid fa-circle-check"></i> Nothing to do right now.');
            set(a, 'iba-empty', noTasks($('active-task-table-body'), $('active-task-search'), $('active-task-date-tabs')));
        }
        const v = $('inv-active-job');
        if (v) {
            hint(v, v.querySelector(':scope > .inv-job-hero'), 'iba-eh-tasks', '<i class="fa-solid fa-clipboard-check"></i> Nothing to do right now.');
            set(v, 'iba-empty', noTasks($('inv-active-job-table-body'), $('inv-active-job-search'), $('inv-active-job-date-tabs')));
        }
    }

    // ---- Invoice Records ----
    function records() {
        const s = $('im-reporting'), c = $('im-reporting-content');
        if (!s || !c) return;
        const t = txt(c);
        const idle = !c.querySelector('.fa-spin, .master-grid-row') && (!t || /^(Enter a search term|Please enter a PO)/i.test(t));
        set(s, 'iba-empty', idle);
    }

    // ---- Invoice Entry page ----
    function entry() {
        const s = $('im-invoice-entry'), d = $('im-modal-po-details');
        if (!s || !d) return;
        const no = txt(d.querySelector('.im-po-no'));
        set(s, 'iba-empty', !no || /^-+$/.test(no));
    }

    // ---- Job Records ----
    function jobs() {
        const s = $('wd-reporting'), b = $('reporting-table-body');
        if (!s || !b) return;
        hint(s, s.querySelector('#job-records-summary-strip'), 'iba-eh-jobs', '<i class="fa-solid fa-hand-pointer"></i> Pick a category above or type a search to load records.');
        // patch 207: the line sits on its own row under the tabs (just before the table area)
        const pa = $('reporting-printable-area'), hj = s.querySelector(':scope > .iba-eh-jobs');
        if (hj && pa && pa.parentElement === s && hj.nextElementSibling !== pa) pa.before(hj);
        const hv = hj, want = b.querySelector('[data-iba-hint]');
        const msg = want ? want.getAttribute('data-iba-hint') : 'Pick a category above or type a search to load records.';
        if (hv && hv.dataset.msg !== msg) { hv.dataset.msg = msg; hv.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> ' + msg; }
        set(s, 'iba-empty', !!b.querySelector('.wd-select-category-state') || !b.querySelector('tr'));
    }

    // ---- Material Stock (patch 205) ----
    function stock() {
        const s = $('wd-material-stock'), b = $('ms-table-body');
        if (!s || !b) return;
        const w = s.querySelector('.ms-premium-tablewrap');
        if (w && !s.querySelector('.iba-eh-stock')) {
            const h = document.createElement('div');
            h.className = 'iba-empty-hint iba-eh-stock';
            h.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Pick a Family tab above or type a search to see materials.';
            w.before(h);
        }
        set(s, 'iba-empty', !b.querySelector('tr') || /^List cleared/i.test(txt(b)));
    }

    // ---- Summary Note ----
    function summary() {
        const s = $('im-summary-note');
        if (!s) return;
        const prev = $('summary-note-prev-pdf-btn'), pr = $('summary-note-print-btn'), ref = $('im-refresh-summary-button');
        if (prev && pr && ref && !isPhone() && !s.querySelector('.iba-sn-tools')) {
            const row = document.createElement('div');
            row.className = 'iba-sn-tools';
            const box = ref.parentElement;
            box.parentElement.insertBefore(row, box);
            row.append(prev, pr);
        }
        const area = $('summary-note-printable-area');
        const none = !area || area.classList.contains('hidden');
        set(s, 'iba-sn-empty', none);
        if (pr) { set(pr, 'iba-sn-off', none); pr.setAttribute('aria-disabled', none ? 'true' : 'false'); }
    }

    function run() {
        const pc = !isPhone();
        set(document.body, 'iba-empty-on', pc);
        try { tasks(); } catch (_) {}
        try { records(); } catch (_) {}
        try { entry(); } catch (_) {}
        try { jobs(); } catch (_) {}
        try { summary(); } catch (_) {}
        try { stock(); } catch (_) {}
    }
    let t = 0;
    function soon() { if (t) return; t = setTimeout(() => { t = 0; run(); }, 120); }

    function start() {
        run();
        const ids = ['active-task-table-body', 'inv-active-job-table-body', 'im-reporting-content', 'im-modal-po-details', 'reporting-table-body', 'summary-note-printable-area', 'ms-table-body', 'active-task-date-tabs', 'inv-active-job-date-tabs'];
        const mo = new MutationObserver(soon);
        ids.forEach((id) => { const el = $(id); if (el) mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] }); });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('input', (e) => { if (e.target && /^(active-task-search|inv-active-job-search)$/.test(e.target.id)) soon(); }, true);
        document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#summary-note-print-btn.iba-sn-off')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        setInterval(run, 3000);
    }
    window.ibaEmpty = { run };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
