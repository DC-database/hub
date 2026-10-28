/* ==========================================================================
   js/iba-1705-srvpick.js — 17.0.5 patch 28
   "Select Person for SRV" (Invoice Entry and Batch Entry, For SRV when the
   site has several SRV people):
   - drawn like the other pop-ups (glass), one row per person: name,
     position, site;
   - people on vacation are greyed out with their return date and
     replacement, and cannot be picked (available people first);
   - the automatic pick (one person, or the top rank: Site DC first) never
     lands on someone on vacation; when everyone at the site is away, their
     replacement is offered instead.
   Uses window.ibaAwayGuard.awayOf (js/iba-1705-away.js). PC only.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');

    function awayOf(name) {
        try { return (window.ibaAwayGuard && window.ibaAwayGuard.awayOf(name)) || null; } catch (_) { return null; }
    }
    function returnDate(name) {
        try {
            const map = (typeof ibaApproverMap === 'function') ? (ibaApproverMap() || {}) : {};
            const a = Object.values(map).find((x) => x && norm(x.Name) === norm(name) && String(x.DateReturn || '').trim());
            return a ? String(a.DateReturn).trim() : '';
        } catch (_) { return ''; }
    }
    const nameOf = (c) => (c && typeof c === 'object') ? c.name : c;

    // candidates: mark who is away; if nobody at the site is available, add
    // the replacement(s) so the invoice still goes to someone who is working
    const origCands = window.imBatchGetAttentionCandidatesForSRV;
    if (typeof origCands === 'function') {
        window.imBatchGetAttentionCandidatesForSRV = async function () {
            const list = (await origCands.apply(this, arguments)) || [];
            list.forEach((c) => { if (c && c.name && !c.isFallback) { const a = awayOf(c.name); if (a) c.away = a; } });
            const real = list.filter((c) => c && c.name && !c.isFallback);
            if (real.length && real.every((c) => c.away)) {
                const have = new Set(list.map((c) => norm(c.name)));
                real.forEach((c) => {
                    const t = c.away.target;
                    if (!t || have.has(norm(t)) || awayOf(t)) return;
                    have.add(norm(t));
                    list.push({ name: t, position: 'Covering for ' + c.name, group: c.group, site: c.site, isReplacement: true });
                });
            }
            return list;
        };
    }
    // automatic pick: only among the people who are working
    const origBest = window.imSrvBestCandidate;
    if (typeof origBest === 'function') {
        window.imSrvBestCandidate = function (candidates) {
            const free = (candidates || []).filter((c) => !(c && typeof c === 'object' && (c.away || awayOf(c.name))));
            if (free.length === 1 && free[0] && free[0].name) return free[0].name;
            return origBest.call(this, free);
        };
    }

    // the pop-up
    window.showCandidatePicker = function (candidates, title, callback) {
        if (!candidates || !candidates.length) return;
        // own id: style.css still paints the old #dynamic-candidate-picker white
        ['dynamic-candidate-picker', 'iba-srv-picker'].forEach((id) => { const o = document.getElementById(id); if (o) o.remove(); });
        const rows = candidates.map((c) => {
            const o = (c && typeof c === 'object') ? c : { name: c };
            return Object.assign({}, o, { away: o.away || awayOf(o.name) });
        }).filter((c) => c.name);
        rows.sort((a, b) => (a.away ? 1 : 0) - (b.away ? 1 : 0));
        const free = rows.filter((c) => !c.away).length;
        const row = (c, i) => {
            const pos = [c.position || '', c.site ? 'Site ' + String(c.site).split(/[\s-]+/)[0] : ''].filter(Boolean).join(' · ');
            if (c.away) {
                const back = returnDate(c.name);
                return '<button type="button" class="iba-srvp-row is-away" disabled aria-disabled="true">' +
                    '<i class="fa-solid fa-umbrella-beach"></i><span><b>' + esc(c.name) + '</b><small>' + esc(pos) + '</small>' +
                    '<em>On vacation' + (back ? ' · back ' + esc(back) : '') + ' · replacement: ' + esc(c.away.target) + '</em></span></button>';
            }
            return '<button type="button" class="iba-srvp-row" data-i="' + i + '">' +
                '<i class="fa-solid ' + (c.isReplacement ? 'fa-user-clock' : 'fa-user-check') + '"></i><span><b>' + esc(c.name) + '</b><small>' + esc(pos) + '</small>' +
                (c.isFallback ? '<em>Fallback</em>' : '') + '</span></button>';
        };
        const w = document.createElement('div');
        w.id = 'iba-srv-picker';
        w.className = 'iba-pb-layer';
        w.innerHTML = '<div class="iba-pb-box iba-srvp" role="dialog" aria-modal="true" aria-labelledby="iba-srvp-t">' +
            '<div class="iba-pb-head"><b id="iba-srvp-t"><i class="fa-solid fa-user-check"></i> ' + esc(title || 'Select Person for SRV') + '</b>' +
            '<span>' + rows.length + ' people at this site · ' + (free ? free + ' available' : 'nobody available') + '</span></div>' +
            '<div class="iba-srvp-list">' + rows.map(row).join('') + '</div>' +
            (free ? '' : '<p class="iba-pb-sub">Everyone at this site is on vacation. Close this and pick their replacement in Attention.</p>') +
            '<div class="iba-pb-foot"><span></span><button type="button" data-x>Cancel</button></div></div>';
        document.body.appendChild(w);
        let done = false;
        const finish = (v) => { if (done) return; done = true; w.remove(); try { callback(v); } catch (err) { console.warn(err); } };
        w.addEventListener('click', (e) => {
            if (e.target === w) return finish(null);
            const b = e.target.closest('button');
            if (!b || b.disabled) return;
            if (b.hasAttribute('data-x')) return finish(null);
            const c = rows[Number(b.getAttribute('data-i'))];
            if (c && !c.away) finish(c.name);
        });
        w.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } });
        const first = w.querySelector('.iba-srvp-row:not([disabled])') || w.querySelector('[data-x]');
        if (first) setTimeout(() => first.focus(), 0);
    };
})();
