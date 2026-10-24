/* ==========================================================================
   js/iba-17-p1.js — 17.0.0 patch 1
   Batch Entry:
   - APP button on each row: sets the row to "For Approval" (like REPORT/SRV).
   - SUM ALL button next to "Set All Statuses To": presses SUM on every row
     (For Summary + the summary note), so no row has to be clicked by hand.
   Attention (Invoice Entry and Batch Entry):
   - "None" picked on purpose is accepted on save, so an invoice can be saved
     with nobody handling it. The list itself (None row, typed names) is in
     js/iba-attention-picker.js.
   ========================================================================== */
(function () {
    'use strict';

    const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
    const body = () => document.getElementById('im-batch-table-body');

    function setRowStatus(card, status) {
        const sel = card ? card.querySelector('select[name="status"]') : null;
        if (!sel) return;
        try { if (typeof window.ibaStatusOptionsRefresh === 'function') window.ibaStatusOptionsRefresh(); } catch (_) {}
        if (!Array.from(sel.options).some((o) => o.value === status)) {
            const o = document.createElement('option');
            o.value = status;
            o.textContent = status;
            sel.appendChild(o);
        }
        sel.value = status;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest ? e.target : null;
        if (!t) return;

        const app = t.closest('.btn-quick-status-app');
        if (app && body() && body().contains(app)) {
            e.preventDefault();
            setRowStatus(app.closest('.batch-invoice-card'), 'For Approval');
            return;
        }

        if (t.closest('#iba-batch-sum-all')) {
            e.preventDefault();
            e.stopPropagation();
            const tb = body();
            const cards = tb ? Array.from(tb.querySelectorAll('.batch-invoice-card')) : [];
            const buttons = cards.map((c) => c.querySelector('.btn-quick-status-sum')).filter(Boolean);
            if (!buttons.length) { alert('There are no rows in Batch Entry yet.'); return; }
            if (!confirm('Set all ' + buttons.length + ' row(s) to For Summary and fill their summary notes?')) return;
            buttons.forEach((b) => b.click());
        }
    }, true);

    // ------------------------------------------------------------------
    // None picked on purpose
    // ------------------------------------------------------------------
    function invoiceNoneChosen(status) {
        const pick = window.ibaAttnExplicitNone;
        if (!pick || norm(pick.status) !== norm(status)) return false;
        const sel = document.getElementById('im-attention');
        const v = sel ? String(sel.value || '').trim() : '';
        return !v || v === 'None';
    }

    function wrap() {
        const req = window.imIsAttentionRequiredForStatus;
        if (typeof req === 'function' && !req.__ibaP1) {
            const w = function (status) {
                if (invoiceNoneChosen(status)) return false;
                return req.apply(this, arguments);
            };
            w.__ibaP1 = true;
            window.imIsAttentionRequiredForStatus = w;
        }
        const res = window.imBatchResolveAttentionForSave;
        if (typeof res === 'function' && !res.__ibaP1) {
            const w = async function (statusValue, siteCode, groupValue, currentAttention, row) {
                const attn = String(currentAttention || '').trim();
                if (row && row.dataset && row.dataset.ibaNone != null &&
                    norm(row.dataset.ibaNone) === norm(statusValue) && (!attn || attn === 'None')) return '';
                return res.apply(this, arguments);
            };
            w.__ibaP1 = true;
            window.imBatchResolveAttentionForSave = w;
        }
    }
    wrap();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap);
    window.addEventListener('load', wrap);
})();
