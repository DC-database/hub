/* 17.0.5 patch 155: "Notes to Accounts" (Super Admin, PC).
 * The CEO approved Summary Notes come back: every invoice under a note is
 * CEO Approval, one note = one vendor = one SRV name (one scanned PDF).
 * 1. Tick the notes (notes whose invoices are CEO Approval are listed; any
 *    note can also be typed).
 * 2. Check: every invoice of the note is read fresh. SRV name = first 23
 *    characters of the vendor + today (same formula as Summary Note
 *    "going to Accounts"). Flags: invoice already has an SRV name, invoice
 *    not CEO Approval, more than one vendor, SRV name already used elsewhere.
 * 3. Send to Batch Entry: each invoice gets a card with Status With Accounts
 *    and the SRV name filled. NOTHING is saved until Save in Batch Entry.
 * 4. Copy / Download CSV: one row per unique SRV name (to rename the scans).
 * Never reads the whole invoice list from Firebase: the saved copy
 * (window.ibaInvoiceEntriesLoad) + one invoice at a time. */
(function () {
    'use strict';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var CEO = 'ceo approval';
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function txt(v) { return String(v == null ? '' : v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
    function low(v) { return txt(v).toLowerCase(); }
    function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
    function money(v) { return (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function isSuper() {
        try {
            var me = (typeof currentApprover !== 'undefined' && currentApprover) || window.currentApprover || {};
            var sup = (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) ? SUPER_ADMIN_NAME : 'Irwin';
            return low(me.Name) === low(sup);
        } catch (_) { return false; }
    }
    function allowed() {
        var b = document.body;
        return isSuper() && !(b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone'));
    }
    function idb() { try { if (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) return invoiceDb; } catch (_) {} return null; }
    function poRec(po) {
        try { var m = (typeof allPOData !== 'undefined' && allPOData) || {}; return m[po] || m[String(po).toUpperCase()] || {}; } catch (_) { return {}; }
    }
    // the same vendor Summary Note shows for an invoice
    function vendorOf(po, inv) {
        var r = poRec(po);
        return txt((inv && (inv.vendor || inv.vendor_name || inv.vendorName)) || r['Supplier Name'] || r['Supplier Name:'] || r.Supplier || '');
    }
    function siteOf(po, inv) { var r = poRec(po); return txt((inv && (inv.site || inv.site_name || inv.siteName)) || r['Project ID'] || ''); }
    function amountOf(inv) {
        var c = [inv.amountPaid, inv.amtPaid, inv.paidAmount, inv.amount_paid, inv.paymentAmount, inv.actualPaid];
        for (var i = 0; i < c.length; i++) { var n = num(c[i]); if (n > 0) return n; }
        return num(inv.invValue);
    }
    function today() { var d = new Date(); return String(d.getDate()).padStart(2, '0') + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear(); }
    // Summary Note "going to Accounts": vendor cut at 23 characters + today
    function srvFor(vendor) {
        var v = txt(vendor);
        if (!v || v === 'N/A') return '';
        if (v.length > 23) v = v.substring(0, 23).trim();
        return v + ' ' + today();
    }
    function hasSrv(inv) { var s = low(inv && inv.srvName); return !!s && s !== 'nil'; }

    async function savedCopy() {
        try { return ((typeof window.ibaInvoiceEntriesLoad === 'function' ? await window.ibaInvoiceEntriesLoad() : null) || {}).data || {}; } catch (_) { return {}; }
    }
    // notes whose invoices are CEO Approval (from the saved copy)
    function ceoNotes(all) {
        var by = {};
        Object.keys(all).forEach(function (po) {
            var invs = all[po];
            if (!invs || typeof invs !== 'object') return;
            Object.keys(invs).forEach(function (k) {
                var e = invs[k];
                if (!e || typeof e !== 'object' || low(e.status) !== CEO) return;
                var n = txt(e.note);
                if (!n) return;
                var g = by[low(n)] || (by[low(n)] = { note: n, vendor: vendorOf(po, e), n: 0, total: 0, at: 0 });
                g.n++; g.total += amountOf(e);
                g.at = Math.max(g.at, Number(e.statusChangedAt || e.updatedAt || 0) || Date.parse(e.invoiceDate || '') || 0);
            });
        });
        return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (b.at - a.at) || a.note.localeCompare(b.note); });
    }
    // every invoice of a note, read fresh one by one
    async function noteInvoices(note, all) {
        var db = idb();
        var key = low(note);
        var cand = {};
        try {
            if (typeof window.loadInvoiceNoteRefs === 'function') {
                var refs = await window.loadInvoiceNoteRefs(txt(note));
                (refs || []).forEach(function (r) { var po = txt(r && r.po), k = txt(r && (r.invoiceKey || r.key)); if (po && k) cand[po + '::' + k] = { po: po, key: k }; });
            }
        } catch (_) {}
        Object.keys(all).forEach(function (po) {
            var invs = all[po];
            if (!invs || typeof invs !== 'object') return;
            Object.keys(invs).forEach(function (k) { var e = invs[k]; if (e && typeof e === 'object' && low(e.note) === key) cand[po + '::' + k] = { po: po, key: k }; });
        });
        var list = Object.keys(cand).map(function (k) { return cand[k]; });
        var out = [];
        var i = 0;
        async function worker() {
            while (i < list.length) {
                var c = list[i++];
                var inv = null;
                if (db) { try { var s = await db.ref('invoice_entries/' + c.po + '/' + c.key).once('value'); inv = s && s.val(); } catch (_) { inv = null; } }
                else inv = (all[c.po] || {})[c.key] || null;
                if (inv && low(inv.note) === key) out.push({ po: c.po, key: c.key, inv: inv });
            }
        }
        await Promise.all([worker(), worker(), worker(), worker()]);
        out.sort(function (a, b) { return String(a.po).localeCompare(String(b.po)) || String(a.inv.invoiceDate || '').localeCompare(String(b.inv.invoiceDate || '')); });
        return out;
    }

    var state = { all: null, notes: [], groups: null, busy: false };
    function close() { var o = $('iba-n2a-pop'); if (o) o.remove(); state.groups = null; }
    function open() {
        if (!allowed()) { alert('Notes to Accounts is for the Super Admin on the PC.'); return; }
        close();
        var wrap = document.createElement('div');
        wrap.id = 'iba-n2a-pop';
        wrap.className = 'iba-pb-layer';
        wrap.innerHTML = '<div class="iba-pb-box iba-watch-box iba-n2a-box" role="dialog" aria-modal="true" aria-labelledby="iba-n2a-t">' +
            '<div class="iba-pb-head"><b id="iba-n2a-t"><i class="fa-solid fa-file-export"></i> Notes to Accounts</b>' +
            '<button type="button" class="iba-watch-x" data-n2a-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<p class="iba-n2a-hint">Tick the Summary Notes the CEO approved. Every invoice under them goes into Batch Entry as <b>With Accounts</b> with the note\'s SRV name (first 23 letters of the vendor + today). Nothing is saved until you press Save in Batch Entry.</p>' +
            '<div id="iba-n2a-out" class="iba-n2a-out"></div>' +
            '<div class="iba-n2a-acts" id="iba-n2a-acts"></div>' +
            '</div>';
        document.body.appendChild(wrap);
        wrap.addEventListener('click', onClick);
        wrap.addEventListener('change', onChange);
        wrap.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            if (e.key === 'Enter' && e.target && e.target.id === 'iba-n2a-q') { e.preventDefault(); addTyped(); }
        });
        showPick();
    }

    // ---- step 1: pick notes ----
    async function showPick() {
        var out = $('iba-n2a-out');
        out.innerHTML = '<p class="iba-n2a-note"><i class="fa-solid fa-spinner fa-spin"></i> Finding notes at CEO Approval…</p>';
        $('iba-n2a-acts').innerHTML = '';
        state.all = await savedCopy();
        if (!$('iba-n2a-pop')) return;
        state.notes = ceoNotes(state.all);
        paintPick();
    }
    function paintPick() {
        var out = $('iba-n2a-out');
        if (!out) return;
        var known = [];
        try { if (typeof window.getInvoiceNotesLatestFirst === 'function') known = window.getInvoiceNotesLatestFirst().slice(0, 400).map(function (x) { return typeof x === 'string' ? x : (x && x.text) || ''; }).filter(Boolean); } catch (_) {}
        var h = '<label class="iba-n2a-find"><i class="fa-solid fa-magnifying-glass"></i><input id="iba-n2a-q" list="iba-n2a-dl" autocomplete="off" placeholder="Type another note, e.g. Khalifa Steel 21-July-2026"/>' +
            '<button type="button" class="iba-trk-btn" data-n2a-add>Add</button></label>' +
            '<datalist id="iba-n2a-dl">' + known.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
        if (!state.notes.length) h += '<p class="iba-n2a-empty">No note has invoices in CEO Approval right now. Type the note above.</p>';
        else {
            h += '<div class="iba-n2a-sel"><label><input type="checkbox" data-n2a-all/> Select all</label><span>' + state.notes.length + ' note' + (state.notes.length === 1 ? '' : 's') + ' at CEO Approval</span></div>' +
                '<div class="iba-n2a-list"><table><thead><tr><th></th><th>Note</th><th>Vendor</th><th class="is-n">Invoices</th><th class="is-n">QAR</th></tr></thead><tbody>' +
                state.notes.map(function (g, i) {
                    return '<tr><td><input type="checkbox" data-n2a-pick="' + i + '"' + (g.picked ? ' checked' : '') + '/></td><td class="is-note">' + esc(g.note) + (g.typed ? ' <em>typed</em>' : '') + '</td><td class="is-ven">' + esc(g.vendor || '—') + '</td><td class="is-n">' + (g.typed ? '—' : g.n) + '</td><td class="is-n">' + (g.typed ? '—' : money(g.total)) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }
        out.innerHTML = h;
        paintPickActs();
    }
    function picked() { return state.notes.filter(function (g) { return g.picked; }); }
    function paintPickActs() {
        var n = picked().length;
        $('iba-n2a-acts').innerHTML = '<button type="button" class="iba-trk-btn" data-n2a-close>Cancel</button>' +
            '<button type="button" class="iba-trk-btn is-main" data-n2a-check' + (n ? '' : ' disabled') + '>Check ' + (n || '') + ' note' + (n === 1 ? '' : 's') + '</button>';
    }
    function addTyped() {
        var q = $('iba-n2a-q');
        var n = txt(q && q.value);
        if (!n) return;
        var ex = state.notes.find(function (g) { return low(g.note) === low(n); });
        if (ex) ex.picked = true;
        else state.notes.unshift({ note: n, vendor: '', n: 0, total: 0, typed: true, picked: true });
        paintPick();
    }

    // ---- step 2: check ----
    async function check() {
        var notes = picked();
        if (!notes.length || state.busy) return;
        state.busy = true;
        var out = $('iba-n2a-out');
        out.innerHTML = '<p class="iba-n2a-note"><i class="fa-solid fa-spinner fa-spin"></i> Reading the invoices of ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + '…</p>';
        $('iba-n2a-acts').innerHTML = '';
        var groups = [];
        try {
            for (var i = 0; i < notes.length; i++) {
                var rows = await noteInvoices(notes[i].note, state.all || {});
                if (!$('iba-n2a-pop')) return;
                var vendors = {};
                rows.forEach(function (r) { var v = vendorOf(r.po, r.inv); if (v) vendors[low(v)] = v; });
                var vendor = rows.length ? vendorOf(rows[0].po, rows[0].inv) : notes[i].vendor;
                var g = { note: notes[i].note, vendor: vendor, srv: srvFor(vendor), rows: rows.map(function (r) {
                    return { po: r.po, key: r.key, inv: r.inv, no: r.inv.invNumber || r.inv.invEntryID || r.key, amt: amountOf(r.inv), status: txt(r.inv.status), oldSrv: hasSrv(r.inv) ? txt(r.inv.srvName) : '',
                        notCeo: low(r.inv.status) !== CEO, on: low(r.inv.status) === CEO }; // not CEO Approval = shown, left unticked
                }), warn: [] };
                if (Object.keys(vendors).length > 1) g.warn.push('More than one vendor under this note: ' + Object.keys(vendors).map(function (k) { return vendors[k]; }).join(', ') + '. The SRV name uses ' + (vendor || '—') + '.');
                if (!g.srv) g.warn.push('No vendor found, so no SRV name. Type it in the box.');
                groups.push(g);
            }
            // same SRV name twice in this list, or already used by other invoices
            var seen = {};
            groups.forEach(function (g) { if (g.srv) (seen[low(g.srv)] = seen[low(g.srv)] || []).push(g); });
            Object.keys(seen).forEach(function (k) { if (seen[k].length > 1) seen[k].forEach(function (g) { g.warn.push('Same SRV name as another note in this list: ' + seen[k].filter(function (x) { return x !== g; }).map(function (x) { return x.note; }).join(', ') + '.'); }); });
            var all = state.all || {};
            groups.forEach(function (g) {
                if (!g.srv) return;
                var mine = {}; g.rows.forEach(function (r) { mine[r.po + '::' + r.key] = 1; });
                var used = 0;
                Object.keys(all).forEach(function (po) { var invs = all[po]; if (!invs || typeof invs !== 'object') return; Object.keys(invs).forEach(function (k) { var e = invs[k]; if (e && typeof e === 'object' && !mine[po + '::' + k] && low(e.srvName) === low(g.srv)) used++; }); });
                if (used) g.warn.push('This SRV name is already used by ' + used + ' other invoice' + (used === 1 ? '' : 's') + '.');
            });
        } finally { state.busy = false; }
        state.groups = groups;
        paintCheck();
    }
    function paintCheck() {
        var out = $('iba-n2a-out');
        if (!out || !state.groups) return;
        var gs = state.groups;
        var nInv = 0, total = 0, flags = 0;
        gs.forEach(function (g) { g.rows.forEach(function (r) { if (r.on) { nInv++; total += r.amt; } if (r.oldSrv || r.notCeo) flags++; }); });
        var h = '<div class="iba-n2a-sum"><div><b>' + gs.length + '</b><span>notes / SRV names</span></div><div><b>' + nInv + '</b><span>invoices ticked</span></div><div class="is-amt"><b>' + money(total) + '</b><span>QAR</span></div>' +
            (flags ? '<div class="is-warn"><b>' + flags + '</b><span>to look at</span></div>' : '') + '</div>';
        h += gs.map(function (g, gi) {
            var sub = g.rows.reduce(function (s, r) { return s + (r.on ? r.amt : 0); }, 0);
            return '<section class="iba-n2a-g' + (g.warn.length ? ' is-warn' : '') + '">' +
                '<div class="iba-n2a-gh"><div><b>' + esc(g.note) + '</b><small>' + esc(g.vendor || '—') + ' · ' + g.rows.length + ' invoice' + (g.rows.length === 1 ? '' : 's') + ' · QAR ' + money(sub) + '</small></div>' +
                '<label class="iba-n2a-srv"><span>SRV name</span><input data-n2a-srv="' + gi + '" value="' + esc(g.srv) + '" spellcheck="false"/></label></div>' +
                (g.warn.length ? '<ul class="iba-n2a-warn">' + g.warn.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
                (g.rows.length ? '<table><thead><tr><th></th><th>PO</th><th>Invoice</th><th>Site</th><th>Status</th><th>SRV name now</th><th class="is-n">QAR</th></tr></thead><tbody>' +
                g.rows.map(function (r, ri) {
                    var cls = r.notCeo ? ' class="is-bad"' : (r.oldSrv ? ' class="is-old"' : '');
                    return '<tr' + cls + '><td><input type="checkbox" data-n2a-row="' + gi + ':' + ri + '"' + (r.on ? ' checked' : '') + '/></td><td>' + esc(r.po) + '</td><td>' + esc(r.no) + '</td><td>' + esc(siteOf(r.po, r.inv)) + '</td>' +
                        '<td>' + esc(r.status || '—') + (r.notCeo ? ' <em>not CEO Approval</em>' : '') + '</td><td>' + (r.oldSrv ? '<em>' + esc(r.oldSrv) + '</em>' : '—') + '</td><td class="is-n">' + money(r.amt) + '</td></tr>';
                }).join('') + '</tbody></table>' : '<p class="iba-n2a-empty">No invoice found with this note. Open it once in Summary Note (Generate), then try again.</p>') +
                '</section>';
        }).join('');
        h += '<p class="iba-n2a-note iba-n2a-said" id="iba-n2a-said"></p>';
        out.innerHTML = h;
        $('iba-n2a-acts').innerHTML = '<button type="button" class="iba-trk-btn" data-n2a-back><i class="fa-solid fa-chevron-left"></i> Back</button>' +
            '<span class="iba-n2a-grow"></span>' +
            '<button type="button" class="iba-trk-btn" data-n2a-copy><i class="fa-regular fa-copy"></i> Copy SRV list</button>' +
            '<button type="button" class="iba-trk-btn" data-n2a-csv><i class="fa-solid fa-file-csv"></i> Download CSV</button>' +
            '<button type="button" class="iba-trk-btn is-main" data-n2a-send' + (nInv ? '' : ' disabled') + '><i class="fa-solid fa-table-list"></i> Send ' + nInv + ' to Batch Entry</button>';
    }
    function paintCounts() {
        var gs = state.groups || [];
        var nInv = 0, total = 0;
        gs.forEach(function (g) { g.rows.forEach(function (r) { if (r.on) { nInv++; total += r.amt; } }); });
        var b = document.querySelector('#iba-n2a-pop [data-n2a-send]');
        if (b) { b.disabled = !nInv; b.innerHTML = '<i class="fa-solid fa-table-list"></i> Send ' + nInv + ' to Batch Entry'; }
        var s = document.querySelectorAll('#iba-n2a-pop .iba-n2a-sum > div');
        if (s[1]) s[1].querySelector('b').textContent = nInv;
        if (s[2]) s[2].querySelector('b').textContent = money(total);
    }

    // ---- SRV list (one row per unique SRV name) ----
    function srvRows() {
        var by = {};
        (state.groups || []).forEach(function (g) {
            var on = g.rows.filter(function (r) { return r.on; });
            if (!on.length || !txt(g.srv)) return;
            var k = low(g.srv);
            var x = by[k] || (by[k] = { srv: txt(g.srv), notes: [], vendor: g.vendor, n: 0, pos: [], total: 0 });
            if (x.notes.indexOf(g.note) === -1) x.notes.push(g.note);
            on.forEach(function (r) { x.n++; x.total += r.amt; if (x.pos.indexOf(r.po) === -1) x.pos.push(r.po); });
        });
        return Object.keys(by).map(function (k) { return by[k]; });
    }
    var HEAD = ['SRV Name', 'PDF file name', 'Note', 'Vendor', 'Invoices', 'POs', 'Total (QAR)'];
    function rowVals(x) { return [x.srv, x.srv + '.pdf', x.notes.join(' | '), x.vendor || '', String(x.n), x.pos.join(', '), x.total.toFixed(2)]; }
    function say(t) { var s = $('iba-n2a-said'); if (s) s.textContent = t; }
    function copyList() {
        var rows = srvRows();
        if (!rows.length) return say('Nothing ticked.');
        var tsv = [HEAD].concat(rows.map(rowVals)).map(function (r) { return r.map(function (c) { return String(c).replace(/[\t\r\n]+/g, ' '); }).join('\t'); }).join('\r\n');
        var done = function (ok) { say(ok ? rows.length + ' SRV name' + (rows.length === 1 ? '' : 's') + ' copied. Click a cell in Excel and press Ctrl+V.' : 'Could not copy. Use Download CSV.'); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(tsv).then(function () { done(true); }, function () { done(legacyCopy(tsv)); });
        else done(legacyCopy(tsv));
    }
    function legacyCopy(t) {
        try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok; } catch (_) { return false; }
    }
    function csv() {
        var rows = srvRows();
        if (!rows.length) return say('Nothing ticked.');
        var q = function (c) { c = String(c); return /[",\r\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };
        var body = '﻿' + [HEAD].concat(rows.map(rowVals)).map(function (r) { return r.map(q).join(','); }).join('\r\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
        a.download = 'SRV names ' + today() + '.csv';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        say(rows.length + ' SRV name' + (rows.length === 1 ? '' : 's') + ' in the CSV.');
    }

    // ---- step 3: Batch Entry ----
    function sameCard(c, p) { var po = c.getAttribute('data-po'); return c.getAttribute('data-key') === p.key && (!po || String(po) === String(p.po)); }
    async function send() {
        if (state.busy || !state.groups) return;
        if (typeof window.ibaAddToBatch !== 'function') return say('Batch Entry is not available on this page.');
        var plan = [];
        state.groups.forEach(function (g) { g.rows.forEach(function (r) { if (r.on) plan.push({ po: r.po, key: r.key, srv: txt(g.srv) }); }); });
        if (!plan.length) return;
        state.busy = true;
        say('Putting ' + plan.length + ' invoices in Batch Entry…');
        var res = {};
        try { res = (await window.ibaAddToBatch(plan.map(function (p) { return { po: p.po, key: p.key }; }))) || {}; }
        catch (e) { state.busy = false; return say('Could not add: ' + ((e && e.message) || e)); }
        // every card of these invoices (new or already there): With Accounts + the note's SRV name
        var set = 0, miss = [];
        for (var i = 0; i < plan.length; i++) {
            var p = plan[i];
            var card = null;
            document.querySelectorAll('#im-batch-table-body .batch-invoice-card').forEach(function (c) { if (sameCard(c, p)) card = c; });
            if (!card) { miss.push('PO ' + p.po); continue; }
            var st = card.querySelector('select[name="status"]');
            if (st && st.value !== 'With Accounts') {
                var opt = Array.from(st.options).find(function (o) { return low(o.value) === 'with accounts'; });
                if (opt) { st.value = opt.value; st.dispatchEvent(new Event('change', { bubbles: true })); }
            }
            card.classList.add('iba-n2a-card');
            set++;
        }
        await wait(600); // status handlers first, then the SRV name (so nothing overwrites it)
        plan.forEach(function (p) {
            document.querySelectorAll('#im-batch-table-body .batch-invoice-card').forEach(function (c) {
                if (!sameCard(c, p)) return;
                var s = c.querySelector('[name="srvName"]');
                if (s && p.srv) { s.value = p.srv; s.dispatchEvent(new Event('input', { bubbles: true })); }
            });
        });
        state.busy = false;
        var t = set + ' invoice' + (set === 1 ? '' : 's') + ' in Batch Entry as With Accounts with the SRV name. Check them, then press Save.' + (miss.length ? ' Not added: ' + miss.join(', ') + '.' : '');
        close();
        try { if (typeof window.ibaToast === 'function') window.ibaToast(t, miss.length ? 'warning' : 'success'); } catch (_) {}
        var btn = $('im-batch-save-button');
        if (btn) { btn.classList.remove('iba-ai-pulse'); void btn.offsetWidth; btn.classList.add('iba-ai-pulse'); setTimeout(function () { btn.classList.remove('iba-ai-pulse'); }, 6000); }
        return res;
    }

    function onClick(e) {
        var t = e.target;
        var wrap = $('iba-n2a-pop');
        if (t === wrap || (t.closest && t.closest('[data-n2a-close]'))) return close();
        if (!t.closest) return;
        if (t.closest('[data-n2a-add]')) return addTyped();
        if (t.closest('[data-n2a-check]')) return check();
        if (t.closest('[data-n2a-back]')) { state.groups = null; return paintPick(); }
        if (t.closest('[data-n2a-copy]')) return copyList();
        if (t.closest('[data-n2a-csv]')) return csv();
        if (t.closest('[data-n2a-send]')) return send();
    }
    function onChange(e) {
        var t = e.target;
        if (t.hasAttribute('data-n2a-all')) { state.notes.forEach(function (g) { g.picked = t.checked; }); document.querySelectorAll('#iba-n2a-pop [data-n2a-pick]').forEach(function (c) { c.checked = t.checked; }); return paintPickActs(); }
        if (t.hasAttribute('data-n2a-pick')) { var g = state.notes[Number(t.getAttribute('data-n2a-pick'))]; if (g) g.picked = t.checked; return paintPickActs(); }
        if (t.hasAttribute('data-n2a-row')) {
            var p = t.getAttribute('data-n2a-row').split(':').map(Number);
            var r = state.groups && state.groups[p[0]] && state.groups[p[0]].rows[p[1]];
            if (r) r.on = t.checked;
            return paintCounts();
        }
        if (t.hasAttribute('data-n2a-srv')) { var gg = state.groups && state.groups[Number(t.getAttribute('data-n2a-srv'))]; if (gg) gg.srv = txt(t.value); }
    }

    // a "Notes to Accounts" button next to the note search in Batch Entry
    function addButton() {
        var w = document.querySelector('#im-batch-entry .batch-note-search-wrapper');
        if (!w || $('iba-n2a-btn') || !allowed()) return;
        var b = document.createElement('button');
        b.type = 'button'; b.id = 'iba-n2a-btn'; b.className = 'secondary-btn';
        b.innerHTML = '<i class="fa-solid fa-file-export"></i> Notes to Accounts';
        b.title = 'CEO approved notes: all their invoices as With Accounts with the SRV name';
        b.addEventListener('click', open);
        w.parentNode.insertBefore(b, w.nextSibling);
    }
    setInterval(function () { var p = $('im-batch-entry'); if (p && p.offsetParent && !$('iba-n2a-btn')) addButton(); }, 2000);
    window.ibaNotesToAcc = { allowed: allowed, open: open, srvFor: srvFor, ceoNotes: ceoNotes, _state: state };
})();
