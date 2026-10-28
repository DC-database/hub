/* ==========================================================================
   js/iba-17-p7.js — 17.0.0 patch 7
   Fewer Firebase downloads of the whole invoice list (invoice_entries, ~14 MB).

   1) Saved copy + changes. Every place that needed all invoices (Invoice
      Records full search, Finance reports and exports, Reporting refresh and
      CSV, the assistant's exports, the task check) now asks
      window.ibaInvoiceEntriesLoad(). It keeps the list in this browser
      (IndexedDB, the same store Invoice Records and the Weekly report use)
      and downloads only the POs that changed since the last time, found
      through the small workdesk_dashboard_recent change rows.
      The whole list is read again only when:
        - there is no saved copy in this browser yet,
        - the saved copy's last full read is older than 12 hours,
        - the change rows cannot be read, or more than 400 POs changed.
   2) Change rows for every invoice write. Most saves already wrote a change
      row; a few did not (invoice number edit, delete, approval / history
      lines). Any write under invoice_entries/<PO>/<invoice> from this app now
      also stamps that invoice's change row (a tiny write, no download), so
      other browsers pick it up. POs written in this browser are also
      remembered locally.
   ========================================================================== */
(function () {
    'use strict';

    const FULL_MAX = 12 * 3600000;
    const OVERLAP = 10 * 60000;
    const MANY = 400;
    const TOUCH_KEY = 'iba-inv-touched-v1';
    const IDB_NAME = 'iba_invoice_records';
    const IDB_STORE = 'snapshot';
    const IDB_KEY = 'invoice_entries';

    function idb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
    const size = (v) => { try { return JSON.stringify(v || {}).length; } catch (_) { return 0; } };

    // ------------------------------------------------------------------
    // Saved copy (IndexedDB)
    // ------------------------------------------------------------------
    function open() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB_STORE); } catch (_) {} };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function getSaved() {
        try {
            const d = await open();
            return await new Promise((resolve) => {
                try { const r = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); }
                catch (_) { resolve(null); }
            }).finally(() => { try { d.close(); } catch (_) {} });
        } catch (_) { return null; }
    }
    async function putSaved(v) {
        try {
            const d = await open();
            await new Promise((resolve) => {
                try { const tx = d.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(v, IDB_KEY); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); }
                catch (_) { resolve(false); }
            });
            try { d.close(); } catch (_) {}
        } catch (_) {}
    }

    async function serverNow(d) {
        let off = 0;
        try { const s = await d.ref('.info/serverTimeOffset').once('value'); off = Number(s.val()) || 0; } catch (_) {}
        return Date.now() + off;
    }

    // ------------------------------------------------------------------
    // POs written in this browser
    // ------------------------------------------------------------------
    function touchedSince(t) {
        let m = {};
        try { m = JSON.parse(localStorage.getItem(TOUCH_KEY) || '{}') || {}; } catch (_) { m = {}; }
        return Object.keys(m).filter((po) => Number(m[po]) >= t);
    }
    function touch(po) {
        try {
            const m = JSON.parse(localStorage.getItem(TOUCH_KEY) || '{}') || {};
            const cut = Date.now() - 2 * FULL_MAX;
            Object.keys(m).forEach((k) => { if (Number(m[k]) < cut) delete m[k]; });
            m[po] = Date.now();
            localStorage.setItem(TOUCH_KEY, JSON.stringify(m));
        } catch (_) {}
    }

    // keep the app's memory in step, exactly as a full read would
    function toMemory(data, at) {
        try {
            allInvoiceData = data;
            window.__invoiceEntriesFullLoaded = true;
            window.__ibaInvSyncAt = at;
            if (typeof cacheTimestamps !== 'undefined' && cacheTimestamps) cacheTimestamps.invoiceData = Date.now();
            if (typeof allUniqueNotes !== 'undefined') {
                allUniqueNotes = new Set();
                Object.keys(data).forEach((po) => Object.keys(data[po] || {}).forEach((k) => {
                    const n = data[po][k] && data[po][k].note;
                    if (n && String(n).trim()) allUniqueNotes.add(String(n).trim());
                }));
            }
        } catch (_) {}
    }

    // ------------------------------------------------------------------
    // The loader
    // ------------------------------------------------------------------
    let running = null;
    async function load(opts) {
        const o = opts || {};
        if (running) return running;
        running = (async () => {
            const d = idb();
            if (!d) throw new Error('The invoice database is not available on this page.');
            const t0 = await serverNow(d);
            const info = { mode: '', why: '', changed: 0, bytes: 0, fullAt: 0, at: Date.now() };

            const full = async (why) => {
                const s = await d.ref('invoice_entries').once('value');
                const data = (s && s.val()) || {};
                info.mode = 'full'; info.why = why; info.bytes = size(data); info.fullAt = t0;
                await putSaved({ savedAt: t0, fullAt: t0, data: data });
                return data;
            };

            let data;
            if (o.full) data = await full('asked');
            else {
                // base: this page's memory when it holds the whole list, otherwise the saved copy
                let base = null;
                try {
                    if (window.__invoiceEntriesFullLoaded === true && window.__ibaInvFullAt && window.__ibaInvSyncAt &&
                        typeof allInvoiceData !== 'undefined' && allInvoiceData) {
                        base = { data: allInvoiceData, fullAt: window.__ibaInvFullAt, savedAt: window.__ibaInvSyncAt, mem: true };
                    }
                } catch (_) {}
                if (!base) {
                    const s = await getSaved();
                    if (s && s.data && typeof s.data === 'object') base = { data: s.data, fullAt: Number(s.fullAt || s.savedAt || 0), savedAt: Number(s.savedAt || 0) };
                }
                if (!base) data = await full('no saved copy');
                else if (!(t0 - base.fullAt < FULL_MAX)) data = await full('saved copy older than 12 h');
                else {
                    const since = Math.max(0, base.savedAt - OVERLAP);
                    let rows = null;
                    try {
                        const s = await d.ref('workdesk_dashboard_recent').orderByChild('updatedAt').startAt(since).once('value');
                        rows = (s && s.val()) || {};
                        info.bytes += size(rows);
                    } catch (e) { rows = null; }
                    if (!rows) data = await full('change rows not readable');
                    else {
                        const set = new Set(touchedSince(since - (t0 - Date.now())));
                        Object.keys(rows).forEach((k) => {
                            const r = rows[k] || {};
                            const po = String(r.po || r.originalPO || '').trim();
                            if (po && !/[.#$[\]\/]/.test(po)) set.add(po);
                        });
                        const pos = Array.from(set);
                        if (pos.length > MANY) data = await full('many changes');
                        else {
                            data = base.mem ? base.data : Object.assign({}, base.data);
                            for (let i = 0; i < pos.length; i += 20) {
                                const part = pos.slice(i, i + 20);
                                const got = await Promise.all(part.map((po) => d.ref('invoice_entries/' + po).once('value').then((x) => x.val(), () => undefined)));
                                got.forEach((v, j) => {
                                    if (v === undefined) return;
                                    info.bytes += size(v);
                                    if (v) data[part[j]] = v; else delete data[part[j]];
                                });
                            }
                            info.mode = 'saved'; info.changed = pos.length; info.fullAt = base.fullAt;
                            if (pos.length || !base.mem) putSaved({ savedAt: t0, fullAt: base.fullAt, data: data });
                        }
                    }
                }
            }
            window.__ibaInvFullAt = info.fullAt;
            toMemory(data, t0);
            window.__ibaInvLoadLast = info;
            try { console.info('[IBA invoices] ' + (info.mode === 'full' ? 'full read (' + info.why + ')' : 'saved copy + ' + info.changed + ' changed PO(s)') + ', ~' + Math.round(info.bytes / 1024) + ' KB'); } catch (_) {}
            return { data: data, info: info };
        })();
        try { return await running; } finally { running = null; }
    }

    // ------------------------------------------------------------------
    // Change rows for every invoice write
    // ------------------------------------------------------------------
    function hook() {
        try {
            const R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaP7) return;
            const proto = R.prototype;
            let rootUrl = '';
            const pathOf = (ref) => {
                const d = idb();
                if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    const s = ref.toString();
                    if (s.indexOf(rootUrl + '/invoice_entries/') !== 0) return null;
                    return s.slice(rootUrl.length + 1).split('/').map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            const recent = {};
            const stamp = (parts, removed) => {
                const po = parts[1], key = parts[2];
                if (!po) return;
                touch(po);
                if (!key) return;
                const id = po + '/' + key;
                if (!removed && recent[id] && Date.now() - recent[id] < 3000) return;
                recent[id] = Date.now();
                const d = idb();
                if (!d) return;
                const row = { po: po, originalPO: po, invoiceKey: key, originalKey: key, updatedAt: firebase.database.ServerValue.TIMESTAMP };
                if (removed) row.active = false;
                // delay a little so the app's own (fuller) change row is written first
                setTimeout(() => {
                    d.ref('workdesk_dashboard_recent/' + key).update(row).catch(() => {});
                }, 1500);
            };
            // 17.0.5 patch 30: a save made in this browser goes into the full
            // list in memory right away (no download), so exports and searches
            // see a just-added / just-changed invoice without a page refresh
            const plain = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; } };
            const toMem = (name, p, val) => {
                try {
                    if (window.__invoiceEntriesFullLoaded !== true || typeof allInvoiceData === 'undefined' || !allInvoiceData) return;
                    const po = p[1], key = p[2];
                    if (po && !key && p.length === 2 && name === 'update' && val && typeof val === 'object') {
                        Object.keys(val).forEach((k) => { if (k.indexOf('/') === -1) toMem(val[k] === null ? 'remove' : 'set', [p[0], po, k], val[k]); });
                        return;
                    }
                    if (!po || !key) return;
                    if (name === 'remove' || (name === 'set' && val === null)) {
                        if (p.length === 3) { if (allInvoiceData[po]) delete allInvoiceData[po][key]; }
                        else if (p.length === 4 && allInvoiceData[po] && allInvoiceData[po][key]) delete allInvoiceData[po][key][p[3]];
                        return;
                    }
                    if (val === undefined || typeof val === 'function') return;
                    const v = plain(val);
                    if (v === null && val !== null) return;
                    const now = Date.now();
                    const stampTs = (o) => { if (o && typeof o === 'object') Object.keys(o).forEach((k) => { const x = o[k]; if (x && typeof x === 'object' && x['.sv'] === 'timestamp') o[k] = now; else if (x && typeof x === 'object') stampTs(x); }); };
                    stampTs(v);
                    if (!allInvoiceData[po]) allInvoiceData[po] = {};
                    if (p.length === 3) {
                        if (name === 'update' && v && typeof v === 'object') {
                            const cur = allInvoiceData[po][key] || {};
                            Object.keys(v).forEach((k) => {
                                if (k.indexOf('/') === -1) { if (v[k] === null) delete cur[k]; else cur[k] = v[k]; }
                            });
                            allInvoiceData[po][key] = cur;
                        } else if (name === 'set' || name === 'push') allInvoiceData[po][key] = v;
                    } else if (p.length === 4 && (name === 'set' || name === 'update')) {
                        const cur = allInvoiceData[po][key] || (allInvoiceData[po][key] = {});
                        if (name === 'set') cur[p[3]] = v;
                        else if (v && typeof v === 'object') cur[p[3]] = Object.assign({}, cur[p[3]] || {}, v);
                    }
                } catch (_) {}
            };
            ['set', 'update', 'remove', 'push', 'transaction'].forEach((name) => {
                const orig = proto[name];
                if (typeof orig !== 'function') return;
                proto[name] = function () {
                    const parts = pathOf(this);
                    if (!parts || parts.length < 2) return orig.apply(this, arguments);
                    let p = parts.slice();
                    const removed = (name === 'remove' || (name === 'set' && arguments[0] === null)) && p.length === 3;
                    const val = arguments[0];
                    const out = orig.apply(this, arguments);
                    // push() on invoice_entries/<PO> makes a new invoice: its key is the new ref's key
                    if (name === 'push' && p.length === 2 && out && out.key) p = p.concat(out.key);
                    if (name !== 'transaction' && !(name === 'push' && val === undefined)) toMem(name, p, val);
                    try {
                        const done = (out && typeof out.then === 'function') ? out : Promise.resolve();
                        done.then(() => stamp(p, removed), () => {});
                    } catch (_) {}
                    return out;
                };
            });
            proto.__ibaP7 = true;
        } catch (e) { console.warn('[IBA invoices] change stamp hook not set:', e); }
    }
    hook();

    window.ibaInvoiceEntriesLoad = load;
})();
