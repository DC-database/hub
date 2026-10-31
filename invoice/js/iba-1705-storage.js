/* ==========================================================================
   js/iba-1705-storage.js — 17.0.5 patch 43
   The browser's small storage for this site (localStorage, ~5 MB) can fill
   up with saved copies (the whole Material Stock list, CSV lists ...). Then
   nothing can be saved there: signing in fails (approverKey) and Firebase
   throws QuotaExceededError.
   Guard: when a save does not fit, the saved COPIES are removed (biggest
   first, they are downloaded again when needed) and the save is tried again.
   Sign-in, settings and anything that is not a copy are never removed.
   Loaded first in <head>, before Firebase.
   ========================================================================== */
(function () {
    'use strict';
    let S;
    try { S = window.Storage && window.Storage.prototype; } catch (_) { return; }
    if (!S || S.__ibaGuard) return;
    const set = S.setItem;
    // saved copies only (all can be read again from Firebase / the CSV files)
    const COPY = /^(cached_|iba-invoice-records|iba-photo-list|iba-ms-photo|firebase:previous_websocket_failure$)/i;
    const full = (e) => e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

    function freeSpace(store, keep) {
        const keys = [];
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k && k !== keep && COPY.test(k)) keys.push([k, (store.getItem(k) || '').length]);
        }
        keys.sort((a, b) => b[1] - a[1]);
        return keys;
    }
    S.setItem = function (key, value) {
        try { return set.call(this, key, value); }
        catch (e) {
            if (!full(e)) throw e;
            const list = freeSpace(this, String(key));
            for (const [k] of list) {
                try { this.removeItem(k); } catch (_) {}
                try { const r = set.call(this, key, value); console.warn('[IBA] Browser storage was full: removed saved copies to make room.'); return r; } catch (e2) { if (!full(e2)) throw e2; }
            }
            // still no room: a saved copy itself is simply not kept
            if (COPY.test(String(key))) { console.warn('[IBA] Not enough browser storage to keep a copy of ' + key + '.'); return; }
            throw e;
        }
    };
    S.__ibaGuard = true;

    // at start: when the storage is nearly full (over 80 %), drop the biggest
    // saved copies now, so signing in and Firebase always have room
    try {
        const ls = window.localStorage;
        let used = 0;
        for (let i = 0; i < ls.length; i++) { const k = ls.key(i); used += (k ? k.length : 0) + (ls.getItem(k) || '').length; }
        const LIMIT = 4 * 1024 * 1024; // characters; Chrome keeps about 5 million
        if (used > LIMIT) {
            for (const [k, n] of freeSpace(ls, '')) {
                if (used <= LIMIT * 0.6) break;
                try { ls.removeItem(k); used -= n; } catch (_) {}
            }
            console.warn('[IBA] Browser storage was nearly full: old saved copies removed.');
        }
    } catch (_) {}
})();
