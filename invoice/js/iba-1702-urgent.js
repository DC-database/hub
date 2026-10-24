/* ==========================================================================
   js/iba-1702-urgent.js — 17.0.2
   Urgent = the word "urgent" in an invoice Note.
   1) Who marked it: when a save puts "urgent" into a Note that did not have
      it, the invoice history gets a line "Marked URGENT" with who and when.
   2) Only the Super Admin removes it: when anyone else saves a Note without
      "urgent" on an invoice that had it, "URGENT" is kept in front of their
      new text (and they are told).
   Works for every screen (Invoice Entry, Batch Entry, Active Task, Summary
   Note, approvals, assistant): it watches writes under invoice_entries.
   The old Note comes from memory; only when it is not there one tiny read
   (invoice_entries/<PO>/<key>/note) is made.
   ========================================================================== */
(function () {
    'use strict';

    const URGENT = /\burgent/i;
    const isUrgent = (n) => URGENT.test(String(n || ''));

    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name) : 'System'; } catch (_) { return 'System'; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function') return !!imIsCurrentUserSuperAdmin(); } catch (_) {}
        return false;
    }
    function cachedNote(po, key) {
        try { if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) return { note: allInvoiceData[po][key].note || '' }; } catch (_) {}
        try { if (typeof currentPO !== 'undefined' && currentPO === po && typeof currentPOInvoices !== 'undefined' && currentPOInvoices && currentPOInvoices[key]) return { note: currentPOInvoices[key].note || '' }; } catch (_) {}
        return null;
    }
    async function oldNote(po, key) {
        const c = cachedNote(po, key);
        if (c) return c.note;
        const d = idb();
        if (!d) return '';
        try { const s = await d.ref('invoice_entries/' + po + '/' + key + '/note').once('value'); return s.val() || ''; } catch (_) { return ''; }
    }
    function tell(msg) {
        try { if (typeof window.ibaToast === 'function') { window.ibaToast(msg, 'warning'); return; } } catch (_) {}
        try { console.warn('[IBA urgent] ' + msg); } catch (_) {}
    }
    function logMarked(po, key, note) {
        const d = idb();
        if (!d) return;
        let status = '';
        try { if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) status = allInvoiceData[po][key].status || ''; } catch (_) {}
        d.ref('invoice_entries/' + po + '/' + key + '/history').push({
            action: 'Marked URGENT', status: status, kind: 'urgent',
            updatedBy: me(), by: me(), timestamp: Date.now(), note: String(note || '')
        }).catch((e) => console.warn('[IBA urgent] history line not saved', e));
    }

    // Which notes does this write change? -> [{ po, key, note, set(newNote) }]
    function notesIn(parts, name, args) {
        const val = args[0];
        const out = [];
        if (!val || typeof val !== 'object') {
            // ref(invoice_entries/PO/KEY/note).set('...')
            if (name === 'set' && parts.length === 4 && parts[3] === 'note') {
                out.push({ po: parts[1], key: parts[2], note: val, set: (n) => { args[0] = n; } });
            }
            return out;
        }
        if (parts.length === 3 && Object.prototype.hasOwnProperty.call(val, 'note')) {
            out.push({ po: parts[1], key: parts[2], note: val.note, set: (n) => { val.note = n; } });
        } else if (name === 'update' && parts.length <= 2) {
            // multi-path update: { 'PO/KEY/note': ... } or { 'KEY/note': ... }
            Object.keys(val).forEach((k) => {
                const seg = k.split('/').filter(Boolean);
                const full = parts.slice(1).concat(seg);
                if (full.length === 3 && full[2] === 'note') out.push({ po: full[0], key: full[1], note: val[k], set: (n) => { val[k] = n; } });
                else if (full.length === 2 && val[k] && typeof val[k] === 'object' && Object.prototype.hasOwnProperty.call(val[k], 'note')) {
                    const o = val[k];
                    out.push({ po: full[0], key: full[1], note: o.note, set: (n) => { o.note = n; } });
                }
            });
        }
        return out;
    }

    function hook() {
        try {
            const R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaUrgent) return;
            const proto = R.prototype;
            let rootUrl = '';
            const pathOf = (ref) => {
                const d = idb();
                if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    const s = ref.toString();
                    if (s.indexOf(rootUrl + '/invoice_entries') !== 0) return null;
                    const rest = s.slice(rootUrl.length + 1);
                    return rest.split('/').map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            ['set', 'update'].forEach((name) => {
                const orig = proto[name];
                if (typeof orig !== 'function') return;
                proto[name] = function () {
                    const parts = pathOf(this);
                    if (!parts || parts[0] !== 'invoice_entries' || parts.indexOf('history') !== -1) return orig.apply(this, arguments);
                    const args = Array.prototype.slice.call(arguments);
                    let items = [];
                    try { items = notesIn(parts, name, args); } catch (_) { items = []; }
                    if (!items.length) return orig.apply(this, arguments);
                    const ref = this;
                    const sup = isSuper();
                    const decide = (olds) => {
                        const marked = [];
                        let kept = 0;
                        items.forEach((it, i) => {
                            const was = isUrgent(olds[i]);
                            const now = isUrgent(it.note);
                            if (was && !now && !sup) {
                                const text = String(it.note || '').trim();
                                it.set(text ? 'URGENT · ' + text : 'URGENT');
                                kept++;
                            } else if (!was && now) marked.push(it);
                        });
                        if (kept) tell('Only the Super Admin can remove Urgent. "URGENT" was kept in the note.');
                        return marked;
                    };
                    const after = (p, marked) => {
                        if (!marked.length) return p;
                        return Promise.resolve(p).then((r) => { marked.forEach((it) => logMarked(it.po, it.key, it.note)); return r; });
                    };
                    // old notes from memory when every one is there: decide now
                    // a brand-new invoice (set() of a whole record with enteredAt /
                    // createdAt) has no old Note: no read needed
                    const fresh = name === 'set' && parts.length === 3 && args[0] && typeof args[0] === 'object' &&
                        (args[0].enteredAt !== undefined || args[0].createdAt !== undefined);
                    const cached = items.map((it) => cachedNote(it.po, it.key) || (fresh ? { note: '' } : null));
                    if (cached.every(Boolean)) {
                        const marked = decide(cached.map((c) => c.note));
                        return after(orig.apply(ref, args), marked);
                    }
                    // otherwise read the missing notes first (tiny), then write
                    return Promise.all(items.map((it) => oldNote(it.po, it.key))).then((olds) => {
                        const marked = decide(olds);
                        return after(orig.apply(ref, args), marked);
                    });
                };
            });
            proto.__ibaUrgent = true;
        } catch (e) { console.warn('[IBA urgent] hook not set:', e); }
    }
    hook();
    window.ibaUrgentNote = { isUrgent: isUrgent };
})();
