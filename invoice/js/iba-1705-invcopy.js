/* ==========================================================================
   js/iba-1705-invcopy.js — 17.0.5 patch 129
   Fewer downloads from the material (inventory) database.

   Before: Material Stock, the phone material finder, Inventory loading, the
   assistant's transfer search, Site stock ... each downloaded the WHOLE
   material_stock and/or transfer_entries list every time they opened.

   Now every whole-list read of material_stock / transfer_entries is answered
   from a saved copy in this browser (IndexedDB) that is brought up to date
   with only what changed:
     - every write to material_stock/<key> or transfer_entries/<key> from this
       app also writes a tiny change row to iba_inv_changes (push key = time),
     - a read asks only the change rows since the last check (orderByKey, no
       index needed) and re-reads just those items,
     - new transfers are also picked up by key (orderByKey startAt last key),
     - the whole list is read again only when this browser has no copy yet,
       the copy's last full read is older than 24 h, the change rows cannot
       be read, or more than 300 items changed.
   Small filtered reads (equalTo, limitToLast ...) are answered from the copy
   only when a copy is already here; otherwise they go to Firebase as before,
   so a phone that never needed the whole list never downloads it.
   window.ibaInvCopy.info() -> what the last reads did (also in the console).
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaInvCopy) return;

    const PATHS = { material_stock: 1, transfer_entries: 1 };
    const LOG = 'iba_inv_changes';
    const FULL_MAX = 24 * 3600000;
    const FRESH_MS = 45000;
    const OVERLAP = 3 * 60000;
    const MANY = 300;
    const KEEP_LOG = 4 * 24 * 3600000;
    const IDB_NAME = 'iba_inventory_copy';
    const IDB_STORE = 'copy';
    const PUSH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

    const fb = window.firebase;
    const Q = fb && fb.database && fb.database.Query;
    const R = fb && fb.database && fb.database.Reference;
    if (!Q || !Q.prototype || typeof Q.prototype.once !== 'function' || !R || !R.prototype) return;

    const origOnce = Q.prototype.once;
    const mem = {};          // path -> { data, fullAt, savedAt, checkedAt }
    const running = {};
    const log = [];
    let broken = false;      // change rows unreadable in this session

    function invDb() {
        try { return (typeof window.getInventoryDatabase === 'function') ? window.getInventoryDatabase() : (window.inventoryDb || null); } catch (_) { return null; }
    }
    // the material database only (by its address: never opens a connection itself)
    const HOST = 'material-8f545-default-rtdb.firebaseio.com';
    function pathOf(ref) {
        try {
            const s = String(ref.toString());
            const i = s.indexOf(HOST);
            if (i < 0 || i > 12) return null;
            const rest = s.slice(i + HOST.length).replace(/^\/+/, '');
            return rest ? rest.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (_) { return p; } }) : [];
        } catch (_) { return null; }
    }
    const size = (v) => { try { return JSON.stringify(v || {}).length; } catch (_) { return 0; } };
    const clone = (v) => {
        if (v === null || v === undefined || typeof v !== 'object') return v === undefined ? null : v;
        try { if (typeof structuredClone === 'function') return structuredClone(v); } catch (_) {}
        return JSON.parse(JSON.stringify(v));
    };
    function note(path, what, bytes) {
        const row = { at: new Date().toISOString().slice(11, 19), path: path, what: what, kb: Math.round((bytes || 0) / 1024) };
        log.push(row); if (log.length > 40) log.shift();
        try { console.info('[IBA material copy] ' + path + ': ' + what + ' (~' + row.kb + ' KB)'); } catch (_) {}
    }

    // ---- push-key time prefix (push keys sort by time) ---------------------
    function prefix(t) {
        let n = Math.max(0, Math.floor(t)), s = '';
        for (let i = 0; i < 8; i++) { s = PUSH.charAt(n % 64) + s; n = Math.floor(n / 64); }
        return s;
    }

    // ---- saved copy (IndexedDB) --------------------------------------------
    function open() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => { try { req.result.createObjectStore(IDB_STORE); } catch (_) {} };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function getSaved(path) {
        try {
            const d = await open();
            return await new Promise((resolve) => {
                try { const r = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(path); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); }
                catch (_) { resolve(null); }
            }).finally(() => { try { d.close(); } catch (_) {} });
        } catch (_) { return null; }
    }
    async function putSaved(path, v) {
        try {
            const d = await open();
            await new Promise((resolve) => {
                try { const tx = d.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(v, path); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); }
                catch (_) { resolve(false); }
            });
            try { d.close(); } catch (_) {}
        } catch (_) {}
    }
    let offset = null;
    async function serverNow(d) {
        if (offset === null) {
            offset = 0;
            try { const s = await Promise.race([origOnce.call(d.ref('.info/serverTimeOffset'), 'value'), new Promise((r) => setTimeout(() => r(null), 2500))]); offset = (s && Number(s.val())) || 0; } catch (_) {}
        }
        return Date.now() + offset;
    }

    // ---- bring one list up to date -------------------------------------------
    async function sync(path, allowFull) {
        if (running[path]) {
            const r = await running[path];
            if (r || !allowFull) return r;
        }
        running[path] = (async () => {
            const d = invDb();
            if (!d) return null;
            let base = mem[path];
            if (!base) {
                const s = await getSaved(path);
                if (s && s.data && typeof s.data === 'object') base = mem[path] = { data: s.data, fullAt: Number(s.fullAt || 0), savedAt: Number(s.savedAt || 0), checkedAt: 0 };
            }
            const t0 = await serverNow(d);
            if (base && base.checkedAt && t0 - base.checkedAt < FRESH_MS) return base.data;

            const full = async (why) => {
                if (!allowFull) return null;
                const s = await origOnce.call(d.ref(path), 'value');
                const data = (s && s.val()) || {};
                mem[path] = { data: data, fullAt: t0, savedAt: t0, checkedAt: t0 };
                putSaved(path, { data: data, fullAt: t0, savedAt: t0 });
                note(path, 'whole list read (' + why + ')', size(data));
                return data;
            };
            if (!base) return full('no saved copy yet');
            if (!(t0 - base.fullAt < FULL_MAX)) return full('saved copy older than 24 h');
            if (broken) return full('change rows not readable');

            const since = Math.max(0, base.savedAt - OVERLAP);
            let rows;
            try {
                const s = await origOnce.call(d.ref(LOG).orderByKey().startAt(prefix(since)), 'value');
                rows = (s && s.val()) || {};
            } catch (e) { broken = true; return full('change rows not readable'); }
            let bytes = size(rows);
            const keys = new Set();
            let whole = false;
            Object.keys(rows).forEach((k) => {
                const r = rows[k] || {};
                if (r.p !== path) return;
                if (r.all) whole = true;
                else if (r.k && !/[.#$[\]\/]/.test(r.k)) keys.add(String(r.k));
            });
            if (whole) return full('whole list was rewritten');
            if (keys.size > MANY) return full('many changes');
            const data = base.data;
            // new items by key (push keys only): catches adds from anywhere
            const own = Object.keys(data);
            let last = '';
            for (let i = 0; i < own.length; i++) if (own[i].charAt(0) === '-' && own[i] > last) last = own[i];
            if (last) {
                try {
                    const s = await origOnce.call(d.ref(path).orderByKey().startAt(last).limitToFirst(MANY + 1), 'value');
                    const v = (s && s.val()) || {};
                    bytes += size(v);
                    const nk = Object.keys(v);
                    if (nk.length > MANY) return full('many new items');
                    nk.forEach((k) => { data[k] = v[k]; keys.delete(k); });
                } catch (_) {}
            }
            const list = Array.from(keys);
            for (let i = 0; i < list.length; i += 20) {
                const part = list.slice(i, i + 20);
                const got = await Promise.all(part.map((k) => origOnce.call(d.ref(path + '/' + k), 'value').then((x) => x.val(), () => undefined)));
                got.forEach((v, j) => {
                    if (v === undefined) return;
                    bytes += size(v);
                    if (v === null) delete data[part[j]]; else data[part[j]] = v;
                });
            }
            base.savedAt = t0; base.checkedAt = t0;
            putSaved(path, { data: data, fullAt: base.fullAt, savedAt: t0 });
            note(path, 'saved copy + ' + list.length + ' changed item(s)', bytes);
            return data;
        })();
        try { return await running[path]; } finally { running[path] = null; }
    }

    // ---- answer a query from the copy ------------------------------------------
    function rank(v) {
        if (v === null || v === undefined) return 0;
        if (v === false) return 1;
        if (v === true) return 2;
        if (typeof v === 'number') return 3;
        if (typeof v === 'string') return 4;
        return 5;
    }
    function cmpVal(a, b) {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 3) return a - b;
        if (ra === 4) return a < b ? -1 : (a > b ? 1 : 0);
        return 0;
    }
    const INT = /^-?(0|[1-9]\d{0,9})$/;
    function cmpKey(a, b) {
        const ia = INT.test(a), ib = INT.test(b);
        if (ia && ib) return Number(a) - Number(b) || (a < b ? -1 : (a > b ? 1 : 0));
        if (ia) return -1;
        if (ib) return 1;
        return a < b ? -1 : (a > b ? 1 : 0);
    }
    function deep(v, p) {
        if (!p) return v;
        const parts = String(p).split('/').filter(Boolean);
        let cur = v;
        for (let i = 0; i < parts.length; i++) { if (cur === null || cur === undefined || typeof cur !== 'object') return null; cur = cur[parts[i]]; }
        return cur === undefined ? null : cur;
    }
    function orderedKeys(data, q) {
        if (!data || typeof data !== 'object') return [];
        let keys = Object.keys(data);
        const by = q && q.by;
        const val = (k) => by === 'child' ? deep(data[k], q.child) : (by === 'value' ? data[k] : k);
        const cmp = (by === 'child' || by === 'value') ? (a, b) => cmpVal(val(a), val(b)) || cmpKey(a, b) : cmpKey;
        keys.sort(cmp);
        if (q) {
            const test = by === 'child' || by === 'value' ? (k, x) => cmpVal(val(k), x) : (k, x) => cmpKey(k, String(x));
            if (q.hasOwnProperty('eq')) keys = keys.filter((k) => (by === 'child' || by === 'value') ? (val(k) === q.eq || (q.eq === null && (val(k) === null))) : k === String(q.eq));
            if (q.hasOwnProperty('start')) keys = keys.filter((k) => test(k, q.start) >= 0);
            if (q.hasOwnProperty('after')) keys = keys.filter((k) => test(k, q.after) > 0);
            if (q.hasOwnProperty('end')) keys = keys.filter((k) => test(k, q.end) <= 0);
            if (q.hasOwnProperty('before')) keys = keys.filter((k) => test(k, q.before) < 0);
            if (q.first) keys = keys.slice(0, q.first);
            if (q.last) keys = keys.slice(Math.max(0, keys.length - q.last));
        }
        return keys;
    }
    function snap(ref, key, value, q) {
        const has = value !== null && value !== undefined;
        const kids = (has && typeof value === 'object') ? orderedKeys(value, q) : [];
        const s = {
            key: key, ref: ref,
            val: () => clone(has ? value : null),
            exportVal: () => clone(has ? value : null),
            toJSON: () => clone(has ? value : null),
            exists: () => has,
            numChildren: () => kids.length,
            hasChildren: () => kids.length > 0,
            hasChild: (p) => deep(value, p) !== null,
            child: (p) => { const parts = String(p).split('/').filter(Boolean); let r = ref; try { r = ref.child(p); } catch (_) {} return snap(r, parts[parts.length - 1] || null, deep(value, p), null); },
            forEach: (cb) => {
                for (let i = 0; i < kids.length; i++) {
                    let r = ref; try { r = ref.child(kids[i]); } catch (_) {}
                    if (cb(snap(r, kids[i], value[kids[i]], null)) === true) return true;
                }
                return false;
            },
            getPriority: () => null
        };
        return s;
    }

    // ---- remember query parts on the Query objects ------------------------------
    const QP = Q.prototype;
    const tag = (name, fn) => {
        const orig = QP[name];
        if (typeof orig !== 'function') return;
        QP[name] = function () {
            const out = orig.apply(this, arguments);
            try { if (out && typeof out === 'object') { const q = Object.assign({}, this.__ibaQ || {}); fn(q, arguments); out.__ibaQ = q; } } catch (_) {}
            return out;
        };
    };
    tag('orderByChild', (q, a) => { q.by = 'child'; q.child = String(a[0]); });
    tag('orderByKey', (q) => { q.by = 'key'; });
    tag('orderByValue', (q) => { q.by = 'value'; });
    tag('orderByPriority', (q) => { q.by = 'priority'; });
    tag('equalTo', (q, a) => { q.eq = a[0]; if (a.length > 1) q.odd = true; });
    tag('startAt', (q, a) => { q.start = a[0]; if (a.length > 1) q.odd = true; });
    tag('endAt', (q, a) => { q.end = a[0]; if (a.length > 1) q.odd = true; });
    tag('startAfter', (q, a) => { q.after = a[0]; if (a.length > 1) q.odd = true; });
    tag('endBefore', (q, a) => { q.before = a[0]; if (a.length > 1) q.odd = true; });
    tag('limitToFirst', (q, a) => { q.first = Number(a[0]) || 0; });
    tag('limitToLast', (q, a) => { q.last = Number(a[0]) || 0; });

    QP.once = function (ev, cb, failCb, ctx) {
        if (ev !== 'value') return origOnce.apply(this, arguments);
        const parts = pathOf(this);
        if (!parts || parts.length !== 1 || !PATHS[parts[0]]) return origOnce.apply(this, arguments);
        const q = this.__ibaQ || null;
        if (q && (q.odd || q.by === 'priority')) return origOnce.apply(this, arguments);
        const plain = !q || !(q.hasOwnProperty('eq') || q.hasOwnProperty('start') || q.hasOwnProperty('end') || q.hasOwnProperty('after') || q.hasOwnProperty('before') || q.first || q.last);
        const self = this;
        const args = arguments;
        const p = (async () => {
            let data = null;
            try { data = await sync(parts[0], plain); } catch (e) { data = null; }
            if (data === null) return origOnce.call(self, 'value');
            const ref = self.ref || self;
            const keys = orderedKeys(data, q);
            const picked = {};
            keys.forEach((k) => { picked[k] = data[k]; });
            return snap(ref, parts[0], keys.length ? picked : null, q);
        })();
        if (typeof cb === 'function') {
            p.then((s) => { try { cb.call(ctx || (typeof failCb === 'object' ? failCb : undefined), s); } catch (e) { setTimeout(() => { throw e; }); } },
                (e) => { if (typeof failCb === 'function') failCb.call(ctx, e); });
        }
        void args;
        return p;
    };

    // ---- change rows for every write from this app ------------------------------
    const recent = {};
    function stamp(path, key, all) {
        try {
            const d = invDb();
            if (!d) return;
            if (mem[path]) mem[path].checkedAt = 0;
            const id = path + '/' + (all ? '*' : key);
            if (recent[id] && Date.now() - recent[id] < 1500) return;
            recent[id] = Date.now();
            const row = { p: path, at: fb.database.ServerValue.TIMESTAMP };
            if (all) row.all = true; else row.k = String(key);
            d.ref(LOG).push(row).catch(() => { broken = true; });
        } catch (_) {}
    }
    function touched(parts, name, val, out) {
        const hits = [];
        if (!parts) return hits;
        if (parts.length >= 2 && PATHS[parts[0]]) hits.push([parts[0], parts[1]]);
        else if (parts.length === 1 && PATHS[parts[0]]) {
            if (name === 'push' && out && out.key) hits.push([parts[0], out.key]);
            else if (name === 'update' && val && typeof val === 'object') Object.keys(val).forEach((k) => { const s = k.split('/').filter(Boolean); if (s[0]) hits.push([parts[0], s[0]]); });
            else if (name === 'set' || name === 'remove' || name === 'transaction') hits.push([parts[0], null]);
        } else if (parts.length === 0 && name === 'update' && val && typeof val === 'object') {
            Object.keys(val).forEach((k) => { const s = k.split('/').filter(Boolean); if (PATHS[s[0]]) hits.push([s[0], s[1] || null]); });
        }
        return hits;
    }
    ['set', 'update', 'remove', 'push', 'transaction', 'setWithPriority'].forEach((name) => {
        const orig = R.prototype[name];
        if (typeof orig !== 'function') return;
        R.prototype[name] = function () {
            const parts = pathOf(this);
            const val = arguments[0];
            const out = orig.apply(this, arguments);
            try {
                const hits = touched(parts, name, val, out);
                if (hits.length) {
                    hits.forEach((h) => stamp(h[0], h[1], !h[1]));
                    const done = (out && typeof out.then === 'function') ? out : Promise.resolve();
                    done.then(() => { hits.forEach((h) => { recent[h[0] + '/' + (h[1] || '*')] = 0; stamp(h[0], h[1], !h[1]); }); }, () => {});
                }
            } catch (_) {}
            return out;
        };
    });

    // ---- old change rows: tidy once a day per browser ---------------------------
    function tidy() {
        try {
            const K = 'iba-inv-log-tidy-v1';
            if (Date.now() - Number(localStorage.getItem(K) || 0) < 24 * 3600000) return;
            localStorage.setItem(K, String(Date.now()));
            const d = invDb();
            if (!d) return;
            origOnce.call(d.ref(LOG).orderByKey().endAt(prefix(Date.now() - KEEP_LOG)).limitToFirst(400), 'value').then((s) => {
                const v = (s && s.val()) || {};
                const del = {};
                Object.keys(v).forEach((k) => { del[k] = null; });
                if (Object.keys(del).length) d.ref(LOG).update(del).catch(() => {});
            }).catch(() => {});
        } catch (_) {}
    }
    setTimeout(tidy, 90000);

    window.ibaInvCopy = {
        sync: (path) => sync(path, true),
        info: () => log.slice(),
        forget: () => { Object.keys(mem).forEach((k) => delete mem[k]); },
        _orderedKeys: orderedKeys, _prefix: prefix
    };
})();
