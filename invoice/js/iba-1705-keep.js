// 17.0.5 p106: pages keep what you left on them while you move around the system.
// - Batch Entry: the card list (with everything typed in it) comes back when you
//   return; it only goes on Save or Clear.
// - Invoice Records: the last search results come back for 1 hour, with a small
//   "kept from" note + Refresh. After 1 hour only the search text stays.
// - Add New Job (WorkDesk / Inventory): a half-typed new job comes back when you
//   open Add again; pressing Add Job (save) or Clear ends the draft.
// - Invoice Entry: the Attention picked in the invoice pop-up survives a module switch.
// Nothing is saved to the browser or Firebase: it lives in memory only, so a
// refresh or sign-out (which reloads the page) clears everything. PC only.
(function () {
    'use strict';
    var RESULTS_MS = 60 * 60 * 1000;
    function onPhone() {
        var b = document.body;
        return !!(b && (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone')));
    }
    function $(id) { return document.getElementById(id); }
    function hhmm(t) {
        try { return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }
    var kept = { batch: null, rec: null };

    function realRows(tb) {
        if (!tb) return [];
        return Array.prototype.filter.call(tb.children, function (n) {
            return n.nodeType === 1 && !n.querySelector('td[colspan]') && !n.classList.contains('im-batch-empty');
        });
    }
    function saveBatch() {
        var tb = $('im-batch-table-body');
        var rows = realRows(tb);
        kept.batch = rows.length ? Array.prototype.slice.call(tb.childNodes) : null;
    }
    function restoreBatch() {
        var tb = $('im-batch-table-body');
        if (!tb || !kept.batch) return;
        if (realRows(tb).length) { kept.batch = null; return; }
        var frag = document.createDocumentFragment();
        kept.batch.forEach(function (n) { frag.appendChild(n); });
        tb.innerHTML = '';
        tb.appendChild(frag);
        kept.batch = null;
        try { if (typeof updateBatchCount === 'function') updateBatchCount(); } catch (_) {}
    }

    function saveRec() {
        var box = $('im-reporting-content');
        if (!box) return;
        var data = [];
        try { data = (typeof currentReportData !== 'undefined' && Array.isArray(currentReportData)) ? currentReportData : []; } catch (_) {}
        if (!data.length || !box.children.length) return;
        kept.rec = {
            nodes: Array.prototype.slice.call(box.childNodes).filter(function (n) { return !(n.id === 'iba-keep-note'); }),
            data: data,
            q: ($('im-reporting-search') || {}).value || '',
            at: (kept.rec && kept.rec.data === data) ? kept.rec.at : Date.now()
        };
    }
    function restoreRec() {
        var r = kept.rec, box = $('im-reporting-content');
        if (!r || !box) return;
        if (Date.now() - r.at > RESULTS_MS) { kept.rec = null; return; }
        var inp = $('im-reporting-search');
        if (inp && r.q && inp.value && inp.value !== r.q) return; // a new search was typed / passed in
        var frag = document.createDocumentFragment();
        r.nodes.forEach(function (n) { frag.appendChild(n); });
        box.innerHTML = '';
        box.appendChild(frag);
        try { currentReportData = r.data; } catch (_) {}
        if (inp && r.q) inp.value = r.q;
        note(box, r.at);
    }
    function note(box, at) {
        var old = $('iba-keep-note'); if (old) old.remove();
        var d = document.createElement('div');
        d.id = 'iba-keep-note';
        d.className = 'iba-keep-note';
        d.style.cssText = 'display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12px;opacity:.85;';
        d.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Kept from ' + hhmm(at) +
            ' <button type="button" class="iba-keep-refresh secondary-btn" style="padding:2px 10px;font-size:12px;min-height:0;"><i class="fa-solid fa-rotate"></i> Refresh</button>';
        d.querySelector('button').addEventListener('click', function () {
            kept.rec = null; d.remove();
            var b = $('im-reporting-search-btn'); if (b) b.click();
        });
        box.insertBefore(d, box.firstChild);
    }

    function wrapIm() {
        var orig = window.showIMSection;
        if (typeof orig !== 'function' || orig.__ibaKeep) return !!(orig && orig.__ibaKeep);
        var w = function (sectionId) {
            if (onPhone()) return orig.apply(this, arguments);
            if (sectionId === 'im-batch-entry') saveBatch();
            if (sectionId === 'im-reporting') saveRec();
            var res = orig.apply(this, arguments);
            try {
                if (sectionId === 'im-batch-entry') restoreBatch();
                if (sectionId === 'im-reporting') restoreRec();
            } catch (e) { console.warn('keep restore', e); }
            return res;
        };
        w.__ibaKeep = true;
        window.showIMSection = w;
        return true;
    }
    // remember the Records data while it is on screen (so the 1 hour counts from the search)
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#im-reporting-search-btn')) kept.rec = null;
    }, true);

    // ---- Add New Job draft ----
    var job = { dirty: false, lastMode: '', vals: null };
    function jobFields() {
        var m = $('standard-job-modal');
        if (!m) return [];
        return Array.prototype.filter.call(m.querySelectorAll('input, textarea, select'), function (el) {
            if (!el.id) return false;
            var t = (el.type || '').toLowerCase();
            if (t === 'hidden' || t === 'file' || t === 'password' || t === 'button' || t === 'submit') return false;
            if (el.closest('.choices')) return false; // Choices pickers keep their own state
            return true;
        });
    }
    function wrapJob() {
        var orig = window.openStandardJobModal;
        if (typeof orig !== 'function' || orig.__ibaKeep) return !!(orig && orig.__ibaKeep);
        var w = function (mode) {
            var draft = null;
            if (!onPhone() && mode === 'Add' && job.lastMode === 'Add' && job.dirty) {
                draft = jobFields().map(function (el) {
                    return [el.id, (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value];
                });
            }
            job.lastMode = mode;
            var res = orig.apply(this, arguments);
            if (mode !== 'Add') job.dirty = false;
            if (draft) {
                try {
                    draft.forEach(function (p) {
                        var el = $(p[0]); if (!el) return;
                        if (typeof p[1] === 'boolean') { el.checked = p[1]; return; }
                        if (p[1] && !el.value) {
                            el.value = p[1];
                            if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                } catch (e) { console.warn('keep job', e); }
            }
            return res;
        };
        w.__ibaKeep = true;
        window.openStandardJobModal = w;
        return true;
    }
    document.addEventListener('input', function (e) {
        if (e.target && e.target.closest && e.target.closest('#standard-job-modal') && job.lastMode === 'Add') job.dirty = true;
    }, true);
    document.addEventListener('change', function (e) {
        if (e.isTrusted && e.target && e.target.closest && e.target.closest('#standard-job-modal') && job.lastMode === 'Add') job.dirty = true;
    }, true);
    // Add Job (save) or a Clear button inside the job pop-up ends the draft
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('#add-job-button, #standard-job-modal [id*="clear"], #standard-job-modal .clear-btn');
        if (b) job.dirty = false;
    }, true);

    // ---- Invoice Entry: Attention survives the Invoice Management button rebuilding its picker ----
    document.addEventListener('click', function (e) {
        if (onPhone()) return;
        if (!(e.target.closest && e.target.closest('#invoice-mgmt-button'))) return;
        var v = '';
        try { v = window.imAttentionSelectChoices ? window.imAttentionSelectChoices.getValue(true) : ''; } catch (_) {}
        if (Array.isArray(v)) v = v[0] || '';
        if (!v) return;
        var before = window.imAttentionSelectChoices, n = 0;
        (function wait() {
            var c = window.imAttentionSelectChoices;
            if (c && c !== before) {
                setTimeout(function () { try { c.setChoiceByValue(v); } catch (_) {} }, 300);
                return;
            }
            if (++n < 40) setTimeout(wait, 100);
        })();
    }, true);

    var tries = 0;
    (function boot() {
        var a = wrapIm(), b = wrapJob();
        if ((!a || !b) && ++tries < 60) setTimeout(boot, 250);
    })();
    window.ibaKeep = { kept: kept, job: job };
})();
