/* ==========================================================================
   js/iba-1705-notesync.js — 17.0.5 patch 133
   Summary Note suggestions miss notes made today (the saved note-name list
   is kept up to 12 h per browser / folder). Now, every time the note
   suggestions are filled (Summary Note opens, its Refresh), only the notes
   used since the last check are read: invoice_note_index ordered by
   lastUsedAt, startAt(last check) — a few rows, not the 500-note list.
   They join the list in memory and the saved copy, newest first.
   window.ibaNotesFresh() is also used by "Print summary notes".
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaNotesFresh) return;
    const KEY = 'iba-note-fresh-v1';
    const BACK = 5 * 60000;
    let running = null;

    function cacheKey() { try { return (typeof IM_NOTE_INDEX_CACHE_KEY !== 'undefined') ? IM_NOTE_INDEX_CACHE_KEY : 'cached_INVOICE_NOTE_INDEX'; } catch (_) { return 'cached_INVOICE_NOTE_INDEX'; } }
    function since() {
        let t = 0;
        try { t = Number(localStorage.getItem(KEY) || 0); } catch (_) {}
        if (!t) { try { const raw = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); t = Number(raw && raw.timestamp) || 0; } catch (_) {} }
        return t ? t - BACK : 0;
    }
    // add notes to the list in memory and the saved copy (text is the key)
    function merge(items) {
        try { if (typeof imApplyNoteIndexToMemory === 'function') imApplyNoteIndexToMemory(items); } catch (_) {}
        try {
            const c = (typeof getCache === 'function') ? getCache(cacheKey()) : null;
            const old = c && c.data ? (Array.isArray(c.data) ? c.data : Object.values(c.data)) : [];
            const map = new Map();
            old.forEach((x) => { const t = String((x && (x.text || x.note)) || '').trim().toLowerCase(); if (t) map.set(t, x); });
            items.forEach((x) => { const t = String(x.text || x.note).trim().toLowerCase(); map.set(t, Object.assign({}, map.get(t) || {}, x, { usageOrderVersion: 2 })); });
            // 17.0.5 patch 134: keep the list's own date, so the full list still reloads after 12 h
            let ts = Date.now();
            try { const raw = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (raw && raw.timestamp) ts = Number(raw.timestamp); } catch (_) {}
            localStorage.setItem(cacheKey(), JSON.stringify({ data: Array.from(map.values()), timestamp: ts }));
        } catch (_) {}
    }
    async function fresh() {
        if (running) return running;
        running = (async () => {
            let d = null;
            try { d = (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) {}
            if (!d) return 0;
            // 17.0.5 patch 134: a short saved list (e.g. a folder copy that never loaded the
            // whole list) or the first run after this patch: read the 500-note list once
            let count = 0;
            try { const c = (typeof getCache === 'function') ? getCache(cacheKey()) : null; count = c && c.data ? (Array.isArray(c.data) ? c.data.length : Object.keys(c.data).length) : 0; } catch (_) {}
            let once = '';
            try { once = localStorage.getItem('iba-note-full-v1') || ''; } catch (_) {}
            if (!once || (count < 60 && Date.now() - Number(once) > 12 * 3600000)) {
                try { localStorage.setItem('iba-note-full-v1', String(Date.now())); } catch (_) {}
                if (typeof loadInvoiceNoteIndex === 'function') { await loadInvoiceNoteIndex(true); try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {} return 1; }
            }
            const from = since();
            if (!from) return 0;                      // no saved list yet: the app's own first load does it
            const startedAt = Date.now();
            const snap = await d.ref('invoice_note_index').orderByChild('lastUsedAt').startAt(from).limitToLast(200).once('value');
            const got = (snap && snap.val()) || {};
            const items = Object.keys(got).map((k) => got[k]).filter((x) => x && typeof x === 'object' && (x.text || x.note));
            if (items.length) merge(items);
            try { localStorage.setItem(KEY, String(startedAt)); } catch (_) {}
            return items.length;
        })().catch((e) => { console.warn('[IBA notes] fresh notes not read:', e); return 0; });
        try { return await running; } finally { running = null; }
    }
    window.ibaNotesFresh = fresh;

    // 17.0.5 patch 136: the list holds only the 500 most recently used notes, so an older
    // note (e.g. May) is missing. While typing in a note box, read the saved notes whose
    // name STARTS with what was typed (the note index is keyed by the name): a few rows.
    const asked = new Set();
    let tmr = null;
    function slug(t) { return String(t || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+/, ''); }
    async function typed(text) {
        let sl = slug(text);
        if (sl.length > 44) sl = sl.slice(0, 44);
        if (sl.replace(/_/g, '').length < 5) return;
        // "qatar_pipeline_" -> "qatar_pipeline" covers it; one read per start text
        const base = sl.replace(/_+$/, '');
        for (const k of asked) { if (base.indexOf(k) === 0) return; }
        let d = null;
        try { d = (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) {}
        if (!d) return;
        try { if (window.ibaShouldPauseFirebase && window.ibaShouldPauseFirebase('note-typed-search', true)) return; } catch (_) {}
        asked.add(base);
        try {
            const snap = await d.ref('invoice_note_index').orderByKey().startAt(base).endAt(base + '\uf8ff').limitToLast(40).once('value');
            const got = (snap && snap.val()) || {};
            const have = (typeof allUniqueNotes !== 'undefined' && allUniqueNotes) ? allUniqueNotes : new Set();
            const items = Object.keys(got).map((k) => got[k]).filter((x) => x && typeof x === 'object' && (x.text || x.note));
            const fresh = items.filter((x) => !have.has(String(x.text || x.note).replace(/\s+/g, ' ').trim()));
            if (!items.length || items.length >= 40) asked.delete(base);   // none / maybe more: a longer name asks again
            if (!items.length) return;
            merge(items);
            if (fresh.length) {
                const orig = window.initializeNoteSuggestions && window.initializeNoteSuggestions.__ibaOrig;
                try { if (typeof orig === 'function') await orig(); } catch (_) {}
            }
        } catch (e) { asked.delete(base); console.warn('[IBA notes] typed note search skipped:', e); }
    }
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el || el.tagName !== 'INPUT' || el.getAttribute('list') !== 'note-suggestions') return;
        clearTimeout(tmr);
        const v = el.value;
        tmr = setTimeout(() => { typed(v); }, 450);
    }, true);

    // fill the suggestions with the fresh notes too
    (function hook() {
        const orig = window.initializeNoteSuggestions;
        if (typeof orig !== 'function') { setTimeout(hook, 400); return; }
        if (orig.__ibaFresh) return;
        const w = async function () {
            const r = await orig.apply(this, arguments);
            const n = await fresh();
            if (n) { try { await orig.apply(this, arguments); } catch (_) {} }
            return r;
        };
        w.__ibaFresh = true;
        w.__ibaOrig = orig;
        window.initializeNoteSuggestions = w;
    })();
})();
