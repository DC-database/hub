/* ==========================================================================
   js/iba-1800-sumnote.js — 18.0.0 patch 105 (martin)
   The Summary note has its own field (invoice.summaryNote); Note = remarks.
   - Summary Note page: own suggestion lists.
       Current note  = summary notes dated this month or last month (newest first).
       Previous note = the same vendor's 3 newest notes before the current one;
                       the newest is filled in for you (you can change it).
     Any older note can still be typed by its full name.
   - Invoice Entry: "Summary note" box with a SUM button
     (status For Summary + "<vendor 16 letters> <dd-Mon-yyyy>"), same as Batch.
   - Batch Entry: the 💬 button on a row shows / hides that row's remark (Note).
   Helpers live in js/app-core.js: ibaSumNoteOf / ibaSumNoteRaw / ibaNoteIsDated.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaSumNoteUi) return;
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const SB = () => window.ibaSummaryBatch || {};

    function list(id) {
        let dl = $(id);
        if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
        return dl;
    }
    function fill(dl, items) {
        const html = (items || []).map((t) => '<option value="' + esc(t) + '"></option>').join('');
        if (dl.__html !== html) { dl.innerHTML = html; dl.__html = html; }
    }
    function currentOptions() { try { return SB().currentOptions ? SB().currentOptions() : []; } catch (_) { return []; } }
    function previousOptions(cur) { try { return SB().previousOptions ? SB().previousOptions(cur, 3) : []; } catch (_) { return []; } }
    // 18.0.0 patch 160 (martin): Previous = the vendor's newest finished note (With Accounts / Paid);
    // Current list = notes active now (For Summary / CEO Approval / In Process), read when the box is used
    function previousPick(cur) { try { return SB().previousPick ? SB().previousPick(cur) : ''; } catch (_) { return ''; } }
    function withActive(fn) { try { if (SB().refreshActive) SB().refreshActive().then(fn).catch(() => null); } catch (_) {} }

    // ---- Summary Note page ---------------------------------------------------------
    function wireSummaryPage() {
        const cur = $('summary-note-current-input'), prev = $('summary-note-previous-input');
        if (!cur || !prev || cur.__ibaSum) return !!(cur && cur.__ibaSum);
        cur.__ibaSum = true;
        const cl = list('iba-sn-cur-list'), pl = list('iba-sn-prev-list');
        cur.setAttribute('list', 'iba-sn-cur-list');
        prev.setAttribute('list', 'iba-sn-prev-list');
        const fillCur = () => fill(cl, currentOptions());
        const fillCurFresh = () => { fillCur(); withActive(fillCur); };
        const fillPrev = () => fill(pl, previousOptions(cur.value));
        // the newest earlier note of the same vendor goes in Previous (unless you typed your own)
        const autoPrev0 = () => {
            const opts = previousOptions(cur.value);
            fill(pl, opts);
            const typed = String(prev.value || '').trim();
            if (!typed || typed === prev.dataset.ibaAuto) {
                prev.value = previousPick(cur.value);
                prev.dataset.ibaAuto = prev.value;
            }
        };
        const autoPrev = () => { autoPrev0(); withActive(autoPrev0); }; // again once the active notes are known
        cur.addEventListener('focus', fillCurFresh);
        cur.addEventListener('input', fillCur);
        cur.addEventListener('change', autoPrev);
        cur.addEventListener('blur', () => { if (String(cur.value || '').trim()) autoPrev(); });
        prev.addEventListener('focus', fillPrev);
        prev.addEventListener('input', () => { if (prev.value !== prev.dataset.ibaAuto) prev.dataset.ibaAuto = ''; });
        fillCur();
        return true;
    }

    // ---- Invoice Entry ---------------------------------------------------------------
    function todayStamp() {
        const q = new Date(Date.now() + 3 * 3600e3); // Qatar day
        const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][q.getUTCMonth()];
        return String(q.getUTCDate()).padStart(2, '0') + '-' + mon + '-' + q.getUTCFullYear();
    }
    function poVendor() {
        let po = '';
        try { po = (typeof currentPO !== 'undefined' && currentPO) ? String(currentPO) : ''; } catch (_) {}
        let d = null;
        try { d = po && allPOData ? (allPOData[po] || allPOData[po.toUpperCase()]) : null; } catch (_) {}
        let v = d ? String(d['Supplier Name'] || d['Supplier Name:'] || d.Supplier || '').replace(/\s+/g, ' ').trim() : '';
        if (/^n\/?a$/i.test(v)) v = '';
        return v;
    }
    function ieSum() {
        const inp = $('im-sumnote-field');
        if (!inp) return;
        const v = poVendor().slice(0, 16).trimEnd();
        inp.value = v ? v + ' ' + todayStamp() : todayStamp();
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        const st = $('im-status');
        if (st) { st.value = 'For Summary'; st.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('#iba-ie-sum-btn');
        if (b) { e.preventDefault(); ieSum(); return; }
        // p106: Batch Entry "INV Nil" / "SRV Nil" = that file name is Nil (the name boxes are hidden)
        const nb = e.target.closest && e.target.closest('.iba-bt-nil');
        if (nb) {
            e.preventDefault(); e.stopPropagation();
            const card = nb.closest('.batch-invoice-card') || nb.closest('tr');
            const inv = card && card.querySelector('input[name="' + (nb.dataset.f === 'srvName' ? 'srvName' : 'invName') + '"]');
            if (!inv) return;
            const on = !nb.classList.contains('is-on');
            nb.classList.toggle('is-on', on);
            inv.value = on ? 'Nil' : (/^nil$/i.test(inv.value.trim()) ? '' : inv.value);
            inv.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        // Batch Entry: 💬 shows / hides the row's remark (Note)
        const r = e.target.closest && e.target.closest('.iba-bt-rmk');
        if (r) {
            e.preventDefault(); e.stopPropagation();
            const card = r.closest('.batch-invoice-card') || r.closest('tr');
            const inp = card && card.querySelector('input[name="remark"]');
            if (!inp) return;
            inp.hidden = !inp.hidden;
            if (!inp.hidden) { try { inp.focus(); } catch (_) {} }
        }
    }, true);
    document.addEventListener('input', (e) => {
        const t = e.target;
        if (t && t.name === 'remark') {
            const card = t.closest('.batch-invoice-card') || t.closest('tr');
            const b = card && card.querySelector('.iba-bt-rmk');
            if (b) b.classList.toggle('is-on', !!String(t.value || '').trim());
        }
        if (t && t.id === 'im-sumnote-field') fill(list('iba-ie-sum-list'), currentOptions());
    }, true);
    document.addEventListener('focusin', (e) => {
        if (e.target && e.target.id === 'im-sumnote-field') { fill(list('iba-ie-sum-list'), currentOptions()); withActive(() => fill(list('iba-ie-sum-list'), currentOptions())); }
    }, true);

    (function boot(n) {
        if (wireSummaryPage() || n > 120) return;
        setTimeout(() => boot(n + 1), 500);
    })(0);

    window.ibaSumNoteUi = { currentOptions, previousOptions, ieSum, todayStamp };
})();
