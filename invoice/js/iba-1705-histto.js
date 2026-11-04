/* 17.0.5 patch 96: every new invoice history row also saves `to` = who has the
 * invoice after that step (its Attention). The app first saves the invoice
 * (set/update with attention) and then pushes the history row, so we remember
 * the attention written for that PO/invoice for a few seconds and add it to the
 * history row. No extra reads from Firebase. */
(function () {
    'use strict';
    var KEEP_MS = 15000;
    var last = {}; // 'po/key' -> { to, at }
    function invDb() { try { return (typeof invoiceDb !== 'undefined' && invoiceDb) || null; } catch (_) { return null; } }
    function note(po, key, att) { last[po + '/' + key] = { to: String(att == null ? '' : att).trim(), at: Date.now() }; }
    function scan(parts, name, val) {
        // parts: ['invoice_entries', po?, key?, field?]
        if (parts.length === 4 && parts[3] === 'attention' && name === 'set') { note(parts[1], parts[2], val); return; }
        if (!val || typeof val !== 'object') return;
        if (parts.length === 3) { if ('attention' in val) note(parts[1], parts[2], val.attention); return; }
        if (name === 'update' && parts.length <= 2) {
            Object.keys(val).forEach(function (k) {
                var full = parts.slice(1).concat(k.split('/').filter(Boolean));
                if (full.length === 3 && full[2] === 'attention') note(full[0], full[1], val[k]);
                else if (full.length === 2 && val[k] && typeof val[k] === 'object' && 'attention' in val[k]) note(full[0], full[1], val[k].attention);
            });
        }
    }
    function hook() {
        try {
            var R = window.firebase && firebase.database && firebase.database.Reference;
            if (!R || !R.prototype || R.prototype.__ibaHistTo) return;
            var proto = R.prototype, rootUrl = '';
            var pathOf = function (ref) {
                var d = invDb(); if (!d) return null;
                try {
                    if (!rootUrl) rootUrl = d.ref().toString().replace(/\/$/, '');
                    var s = ref.toString();
                    if (s.indexOf(rootUrl + '/invoice_entries') !== 0) return null;
                    return s.slice(rootUrl.length + 1).split('/').map(function (p) { try { return decodeURIComponent(p); } catch (_) { return p; } });
                } catch (_) { return null; }
            };
            ['set', 'update'].forEach(function (name) {
                var orig = proto[name]; if (typeof orig !== 'function') return;
                proto[name] = function () {
                    try { var parts = pathOf(this); if (parts && parts.indexOf('history') === -1) scan(parts, name, arguments[0]); } catch (_) {}
                    return orig.apply(this, arguments);
                };
            });
            var push = proto.push;
            if (typeof push === 'function') {
                proto.push = function () {
                    try {
                        var parts = pathOf(this), v = arguments[0];
                        if (parts && parts.length === 4 && parts[3] === 'history' && v && typeof v === 'object' && !('to' in v)) {
                            var m = last[parts[1] + '/' + parts[2]];
                            if (m && Date.now() - m.at < KEEP_MS) {
                                var args = Array.prototype.slice.call(arguments);
                                args[0] = Object.assign({}, v, { to: m.to });
                                return push.apply(this, args);
                            }
                        }
                    } catch (_) {}
                    return push.apply(this, arguments);
                };
            }
            proto.__ibaHistTo = true;
        } catch (e) { console.warn('[histto] hook not set', e); }
    }
    hook();
    if (!(window.firebase && firebase.database)) document.addEventListener('DOMContentLoaded', hook);
})();
