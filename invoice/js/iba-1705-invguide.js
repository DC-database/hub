/* ==========================================================================
   js/iba-1705-invguide.js — 17.0.5 patch 140 (+141: "Hands it over" renamed "Source contact")
   Guided inventory windows (martin approved the mock-up, 07-Nov-2026):
     Transfer / Usage / Restock / Return  (openTransferModal)
     Register material                    (Material Stock "Register New Material")
   Same idea as New invoice: numbered steps, the step to do now glows gold,
   done steps turn teal.
   Transfer page 1: ONE material row (photo | item search | source with stock |
   qty). "+ Add more" loads the row on the truck (🚚 Loaded N in the title)
   and empties it; a filled row is loaded by itself on Proceed. Page 2 =
   confirm window: items (✎ change / × remove) + locked delivery details.
   Nothing is saved before "Confirm & save".
   The window draws in a shadow root (app CSS cannot touch it). Saving goes
   through the app's own routines: saveTransferEntry (window.__ibaTfGuided
   carries the values; same stock check, control no. and records) and
   handleSaveNewMaterial (the hidden Register form is filled first).
   New field on transfer records: requiredDate (the date it is needed). The
   real arrivalDate is still written only when the receiver confirms.
   "Old form" in the footer opens the normal form. Return made from a task
   (initiateReturn, prefilled) and Edit keep the normal forms.
   Downloads: only the picked item's stock card(s) (same as the old form).
   ========================================================================== */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
    const r3 = (n) => Math.round(n * 1000) / 1000;
    const ymd = (d) => { const z = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
    // 3 working days after the send date (Friday is off)
    function plusWork(from, n) {
        const d = from ? new Date(from + 'T12:00:00') : new Date();
        if (isNaN(d.getTime())) return '';
        while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 5) n--; }
        return ymd(d);
    }
    function siteMatch(a, b) {
        if (!a || !b) return false;
        try { if (typeof stockSiteKeysMatch === 'function') return !!stockSiteKeysMatch(a, b); } catch (_) {}
        return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    }

    const CFG = {
        Transfer: { title: 'New transfer', save: 'Save transfer', go: 'Proceed to delivery', what: '<b>Transfer</b> moves material from one or more sites to one site. The source contact releases it, an approver OKs it, one receiver confirms it arrived.',
            steps: [
                { n: 2, head: 'To where', help: 'Pick the site and the one receiver.', need: ['to', 'recv'] },
                { n: 3, head: 'Who checks it', help: 'Pick the source contact. Approver and Required date are filled for you.', need: ['give', 'appr', 'arr'] }] },
        Usage: { title: 'Record usage', save: 'Save usage', go: 'Proceed to confirm', what: '<b>Usage</b> records material used up at a site, so the stock goes down. Nothing moves between sites.',
            steps: [{ n: 2, head: 'Who approves', help: 'Pick the approver. The date is today unless you change it.', need: ['appr'] }] },
        Restock: { title: 'Restock', save: 'Save restock', go: 'Proceed to confirm', what: '<b>Restock</b> adds new stock that arrived (bought or delivered) to a site.',
            steps: [
                { n: 2, head: 'Where it arrives', help: 'Pick the site and the receiver.', need: ['to', 'recv'] },
                { n: 3, head: 'Who approves', help: 'Pick the approver.', need: ['appr'] }] },
        Return: { title: 'Return material', save: 'Save return', go: 'Proceed to confirm', what: '<b>Return</b> sends unused material back, usually from a site to Main Store.',
            steps: [
                { n: 2, head: 'Back to', help: 'Usually Main Store.', need: ['to'] },
                { n: 3, head: 'Who approves', help: 'Pick the approver.', need: ['appr'] }] },
        Register: { title: 'Register material', save: 'Save material', what: '<b>Register material</b> adds a new item to the list so it can be transferred and counted. Do this once per item.',
            steps: [
                { n: 1, head: 'Group', help: 'Pick the family and the type. The Product ID is made for you.', need: ['fam', 'rel'] },
                { n: 2, head: 'Name and unit', help: 'Write it the way people say it, with size or colour.', need: ['name', 'unit'] },
                { n: 3, head: 'Photo', help: 'Optional: type the photo name or Browse the photo folder.', need: [] },
                { n: 4, head: 'Opening stock', help: 'Optional: how many you already have, and where.', need: [] }] }
    };
    const LABEL = { to: 'the site', recv: 'the receiver', give: 'the source contact', appr: 'the approver', arr: 'the Required date', fam: 'the family', rel: 'the type', name: 'the name', unit: 'the unit' };
    const FIELD = { to: 'i-to', recv: 'i-recv', give: 'i-give', appr: 'i-appr', arr: 'i-arr', fam: 'i-fam', rel: 'i-rel', name: 'i-name' };
    const UNITS = ['pcs', 'kg', 'm', 'm²', 'm³', 'box', 'roll', 'bag', 'set', 'ltr', 'sheet', 'length'];

    const S = { on: false, type: '', v: {}, rows: [], cur: null, mode: 'pick', toast: '', busy: false, skip: 0,
        mats: [], sites: [], people: [], admins: [], arrAuto: true, no: '' };
    let host = null, root = null, win = null;

    // ---- data from the app ---------------------------------------------------
    function store(ch) { try { return (ch && ch._store && ch._store.choices) || []; } catch (_) { return []; } }
    function loadLists() {
        let units = {};
        try {
            const all = (typeof window.__ibaGetMaterialStockData === 'function') ? (window.__ibaGetMaterialStockData() || []) : [];
            all.forEach((x) => { const id = String((x && (x.productID || x.productId)) || '').trim(); if (id && x.unit && !units[id]) units[id] = String(x.unit); });
        } catch (_) {}
        let pc = []; try { pc = store(transferProductChoices); } catch (_) {}
        S.mats = pc.filter((c) => c && c.value && !c.placeholder).map((c) => {
            const cp = c.customProperties || {};
            return { id: String(c.value), name: String(cp.name || ''), details: cp.details || '', sites: cp.sites || {}, choice: c, unit: units[String(c.value)] || '' };
        });
        let sc = []; try { sc = store(tfToSiteChoices); } catch (_) {}
        S.sites = sc.filter((c) => c && c.value && !c.placeholder).map((c) => ({ value: String(c.value), label: String(c.label || c.value) }));
        const users = (typeof allApproverData !== 'undefined' && allApproverData) ? Object.values(allApproverData) : [];
        if (users.length) {
            S.people = users.filter((u) => u && u.Name).map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : ''), site: String(u.Site || '') }));
            S.admins = users.filter((u) => u && u.Name && String(u.Role || '').toLowerCase() === 'admin').map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : '') + ' (Admin)', site: String(u.Site || '') }));
        } else {
            let a = [], p = [];
            try { a = store(tfApproverChoices); p = store(tfReceiverChoices); } catch (_) {}
            S.admins = a.filter((c) => c && c.value).map((c) => ({ value: String(c.value), label: String(c.label), site: '' }));
            S.people = p.filter((c) => c && c.value).map((c) => ({ value: String(c.value), label: String(c.label), site: '' }));
        }
        S.people.sort((x, y) => x.value.localeCompare(y.value));
        S.admins.sort((x, y) => x.value.localeCompare(y.value));
    }
    // 17.0.5 patch 142: Approves = only the people ticked "Approve deliveries" in
    // Settings > Inventory permissions (default E.Ali). The normal form's list too.
    async function loadApprovers() {
        let list = null;
        try { if (window.ibaInvPerm && typeof window.ibaInvPerm.deliveryApprovers === 'function') list = await window.ibaInvPerm.deliveryApprovers(); } catch (_) { list = null; }
        if (!Array.isArray(list)) return;
        S.admins = list.map((u) => ({ value: u.Name, label: u.Name + (u.Position ? ' - ' + u.Position : ''), site: String(u.Site || '') }))
            .sort((x, y) => x.value.localeCompare(y.value));
        try {
            if (typeof tfApproverChoices !== 'undefined' && tfApproverChoices) {
                tfApproverChoices.clearStore();
                tfApproverChoices.setChoices(S.admins.map((p) => ({ value: p.value, label: p.label })), 'value', 'label', true);
            }
        } catch (_) {}
    }
    function siteLabel(key) {
        const k = String(key || '');
        const s = S.sites.find((x) => x.value === k) || S.sites.find((x) => siteMatch(x.value, k));
        return s ? s.label : k;
    }
    function photoOf(m) {
        try { return m && typeof tfGetProductPhotoUrlFromChoice === 'function' ? (tfGetProductPhotoUrlFromChoice(m.choice) || '') : ''; } catch (_) { return ''; }
    }
    // the picked item read fresh (same as the old form: its own card(s) only)
    async function freshSites(m) {
        const cp = (m.choice && m.choice.customProperties) || {};
        const keys = (Array.isArray(cp.allKeys) && cp.allKeys.length) ? cp.allKeys : (cp.key ? [cp.key] : []);
        if (!keys.length) return m.sites || {};
        try {
            const database = (typeof inventoryDb !== 'undefined' && inventoryDb) ? inventoryDb : getInventoryDatabase();
            const snaps = await Promise.all(keys.map((k) => database.ref('material_stock/' + k).once('value')));
            const cards = [];
            snaps.forEach((sn, i) => { const x = sn && sn.val(); if (x && String(x.productID || x.productId || '').trim() === m.id) cards.push(Object.assign({ key: keys[i] }, x)); });
            const best = cards.length ? (typeof tfPickBestCard === 'function' ? tfPickBestCard(cards, null) : cards[0]) : null;
            if (best) { if (best.unit && !m.unit) m.unit = String(best.unit); return best.sites || {}; }
        } catch (e) { console.warn('[guided] fresh stock read failed, using the list copy', e); }
        return m.sites || {};
    }
    // free = stock - waiting requests (app rule) - what is already on this truck
    function freeAt(m, site, skipRow) {
        const raw = num((m.sites || {})[site]);
        let f = raw;
        try { if (typeof calculateRealAvailable === 'function') f = calculateRealAvailable(m.id, site, raw); } catch (_) {}
        S.rows.forEach((r) => { if (r !== skipRow && r.m.id === m.id && siteMatch(r.from, site)) f -= num(r.qty); });
        return Math.max(0, r3(f));
    }

    // ---- state ------------------------------------------------------------------
    function hasFrom() { return S.type !== 'Restock'; }
    function canAdd() {
        const c = S.cur; if (!c || c.loading) return false;
        const q = num(c.qty); if (!(q > 0)) return false;
        if (!hasFrom()) return true;
        return !!c.from && q <= freeAt(c.m, c.from) + 1e-9;
    }
    function curValid() { return !!S.cur && canAdd(); }
    function curPartial() { return !!S.cur && !canAdd(); }
    function itemCount() { return S.rows.length + (curValid() ? 1 : 0); }
    function filled(k) { return !!String(S.v[k] || '').trim(); }
    function stepStates() {
        let now = 0;
        return CFG[S.type].steps.map((s) => {
            if (!s.need.length) return now ? 'wait' : 'done';
            if (s.need.every(filled)) return 'done';
            if (!now) { now = s.n; return 'now'; }
            return 'wait';
        });
    }
    function short(name) { return String(name || ''); }

    // ---- html pieces --------------------------------------------------------------
    function head(c) {
        const truck = S.type !== 'Register' ? '<button type="button" class="truck" data-go' + (itemCount() && S.mode !== 'out' ? '' : ' disabled') + ' title="Items on this delivery"><span aria-hidden="true">🚚</span> Loaded <b>' + itemCount() + '</b></button>' : '';
        return '<div class="head"><h2>' + esc(c.title) + '</h2>' + (S.no ? '<span class="pill">' + esc(S.no) + '</span>' : '') + truck +
            (S.type !== 'Register' ? '<button type="button" class="x mn" data-min aria-label="Minimize" title="Minimize: keep it and come back later (stock is taken only at Confirm &amp; save)">–</button>' : '') +
            '<button type="button" class="x" data-close aria-label="Close">×</button></div>' +
            '';
    }
    function curNote() {
        const c = S.cur; if (!c) return ['', ''];
        if (c.loading) return ['Reading the stock…', ''];
        const u = c.m.unit || '';
        const q = num(c.qty);
        if (!hasFrom()) return q > 0 && S.v.to ? [siteLabel(S.v.to) + ' gets ' + q + ' ' + u + ' more.', 'good'] : ['', ''];
        if (!c.from) return [Object.keys(c.m.sites || {}).length ? 'Pick the source site.' : 'No stock of this item anywhere.', 'bad'];
        const free = freeAt(c.m, c.from);
        if (!(q > 0)) return [free + ' ' + u + ' free at ' + siteLabel(c.from) + '.', ''];
        if (q > free + 1e-9) return ['Only ' + free + ' ' + u + ' free at ' + siteLabel(c.from) + '.', 'bad'];
        return ['OK. ' + r3(free - q) + ' ' + u + ' stay at ' + siteLabel(c.from) + '.', 'good'];
    }
    function phHtml(m, cls) {
        const u = m ? photoOf(m) : '';
        return '<span class="ph ' + (cls || '') + (m ? '' : ' none') + '" aria-hidden="true">' + (u ? '<img alt="" src="' + esc(u) + '" onerror="this.remove()">' : '') + '</span>';
    }
    function rowFormHtml() {
        const c = S.cur;
        const name = c
            ? '<div class="rn"><b>' + esc(c.m.name) + '</b><small>' + esc(c.m.id) + (c.m.unit ? ' · ' + esc(c.m.unit) : '') + ' <button type="button" class="lnk" data-cur-x>change</button></small></div>'
            : '<div class="srch"><input id="i-mat" placeholder="Search item: name or ID" autocomplete="off" aria-label="Item"><div class="res" id="i-res" hidden></div></div>';
        let src = '';
        if (hasFrom()) {
            let o = '<option value="">Source</option>';
            if (c && !c.loading) {
                const keys = Object.keys(c.m.sites || {});
                o = keys.length ? keys.map((k) => { const f = freeAt(c.m, k); return '<option value="' + esc(k) + '"' + (k === c.from ? ' selected' : '') + (f > 0 ? '' : ' disabled') + '>' + esc(siteLabel(k)) + ' (' + f + ')</option>'; }).join('') : '<option value="">No stock</option>';
                if (!c.from) o = '<option value="">Pick the source</option>' + o;
            }
            src = '<select id="i-from" data-cur-from aria-label="Source"' + (c && !c.loading ? '' : ' disabled') + '>' + o + '</select>';
        }
        const qty = '<div class="unitbox"><input id="i-qty" inputmode="decimal" value="' + esc(c ? c.qty : '') + '" placeholder="Qty" aria-label="How many"' + (c && !c.loading ? '' : ' disabled') + '><span>' + esc(c ? c.m.unit : '') + '</span></div>';
        const n = curNote();
        return '<div class="irow' + (hasFrom() ? '' : ' nofrom') + '"><div class="ih"><span></span><span>Item</span>' + (hasFrom() ? '<span>' + (S.type === 'Usage' ? 'Used at' : 'Source') + ' (free)</span>' : '') + '<span>Qty</span></div>' +
            '<div class="ib2">' + phHtml(c && c.m, 'rowph') + name + src + qty + '</div></div>' +
            '<div class="iafter"><span class="note ' + n[1] + '">' + esc(n[0]) + (S.toast && !c ? S.toast : '') + '</span>' +
            '<button type="button" class="btn sm addm" data-add' + (curValid() ? '' : ' disabled') + ' title="Load this item on the truck and pick another">+ Add more</button></div>';
    }
    function pickerHtml(k, id, label, list, hint) {
        const cur = S.v[k] || '';
        return '<div class="f"><label for="' + id + '">' + label + (hint ? ' <em>' + hint + '</em>' : '') + '</label><div class="srch"><input id="' + id + '" data-pk="' + k + '" value="' + esc(cur) + '" placeholder="Type a name…" autocomplete="off"><div class="res" data-pl="' + k + '" hidden></div></div></div>';
    }
    function siteSelHtml(k, id, label, exclude) {
        const list = S.sites.filter((s) => !(exclude || []).some((x) => siteMatch(x, s.value)));
        return '<div class="f"><label for="' + id + '">' + label + '</label><select id="' + id + '" data-k="' + k + '"><option value="">Pick a site</option>' +
            list.map((s) => '<option value="' + esc(s.value) + '"' + (s.value === S.v[k] ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('') + '</select></div>';
    }
    function stepBody(need) {
        const t = S.type;
        let h = '';
        if (need.indexOf('to') !== -1) {
            const froms = t === 'Restock' ? [] : S.rows.map((r) => r.from).concat(S.cur && S.cur.from ? [S.cur.from] : []);
            h += siteSelHtml('to', 'i-to', t === 'Return' ? 'Back to' : t === 'Restock' ? 'Arrives at' : 'To', froms);
        }
        if (need.indexOf('recv') !== -1) {
            h += pickerHtml('recv', 'i-recv', 'Receives it', 'people', S.v.to ? '(people at ' + esc(siteLabel(S.v.to)) + ' on top)' : '');
        }
        if (need.indexOf('give') !== -1) {
            const fs = Array.from(new Set(S.rows.map((r) => r.from).concat(S.cur && S.cur.from ? [S.cur.from] : []).filter(Boolean)));
            h += pickerHtml('give', 'i-give', 'Source contact', 'people', fs.length ? '(at ' + esc(fs.map(siteLabel).join(', ')) + ')' : '');
        }
        if (need.indexOf('appr') !== -1) {
            h += pickerHtml('appr', 'i-appr', 'Approves', 'admins', '');
            h += '<div class="row2"><div class="f"><label for="i-ship">' + (t === 'Usage' ? 'Date used' : t === 'Restock' ? 'Delivery date' : 'Send date') + '</label><input id="i-ship" type="date" data-k="ship" value="' + esc(S.v.ship) + '"></div>' +
                (t === 'Transfer' ? '<div class="f"><label for="i-arr" title="3 working days after the send date (Friday off). The real arrival is saved when the receiver confirms.">Required date</label><input id="i-arr" type="date" data-k="arr" value="' + esc(S.v.arr || '') + '"></div>' : '<div></div>') + '</div>';
            h += '<div class="f"><label for="i-note">Note <em>(optional)</em></label><textarea id="i-note" data-k="note" rows="1" placeholder="e.g. for the lobby floor">' + esc(S.v.note || '') + '</textarea></div>';
        }
        return h;
    }
    function itemsHtml() {
        const hf = hasFrom();
        return '<section class="st wide items"><div class="sh"><span class="num">✓</span><b>Items (' + S.rows.length + ')</b><button type="button" class="btn sm" data-more>+ Add more</button></div>' +
            '<div class="rt"><table><thead><tr><th></th><th>Material</th><th>ID</th>' + (hf ? '<th>' + (S.type === 'Usage' ? 'Used at' : 'From') + '</th>' : '') + '<th class="r">How many</th>' + (hf ? '<th class="r">Stays after</th>' : '') + '<th></th></tr></thead><tbody>' +
            S.rows.map((r, i) => '<tr' + (r.short ? ' class="short"' : '') + '><td>' + phHtml(r.m, 'sm') + '</td><td>' + esc(r.m.name) + '</td><td class="mono">' + esc(r.m.id) + '</td>' + (hf ? '<td>' + esc(siteLabel(r.from)) + '</td>' : '') +
                '<td class="r mono">' + esc(r.qty) + ' ' + esc(r.m.unit) + '</td>' + (hf ? '<td class="r mono">' + (r.short ? '—' : freeAt(r.m, r.from) + ' ' + esc(r.m.unit)) + '</td>' : '') +
                '<td class="r nw"><button type="button" class="ib" data-edit="' + i + '" aria-label="Change" title="Change">✎</button><button type="button" class="ib" data-del="' + i + '" aria-label="Remove" title="Remove">×</button></td></tr>' + shortRow(r, i, hf ? 7 : 5)).join('') +
            '</tbody></table></div></section>';
    }
    // 17.0.5 patch 147: an item whose free stock went down since it was loaded (never removed silently)
    function shortRow(r, i, cols) {
        if (!r.short) return '';
        const u = r.m.unit || '', f = r.short.free;
        const at = r.at ? new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const msg = f > 0
            ? 'Only <b>' + esc(f + ' ' + u) + '</b> free now (you loaded ' + esc(r.qty + ' ' + u) + (at ? ' at ' + esc(at) : '') + '). Someone else used some of it.'
            : 'None left at <b>' + esc(siteLabel(r.from)) + '</b>. Used by another transfer since you loaded it.';
        const acts = f > 0
            ? '<button type="button" class="btn sm main" data-take="' + i + '">Take ' + esc(f + ' ' + u) + '</button><button type="button" class="btn sm" data-del="' + i + '">Remove</button>'
            : '<button type="button" class="btn sm main" data-edit="' + i + '">Pick another source</button><button type="button" class="btn sm" data-del="' + i + '">Remove</button>';
        return '<tr class="shortmsg"><td colspan="' + cols + '"><div><span>⚠ ' + msg + '</span><span class="acts">' + acts + '</span></div></td></tr>';
    }
    function route() {
        const v = S.v, t = S.type;
        if (t === 'Register') {
            const id = regId();
            return '<div class="route"><p>' + (v.name ? 'Adds <b>' + esc(v.name) + '</b>' : 'Adds the new material') + (id ? ' as <b>' + esc(id) + '</b>' : '') + (v.unit ? ', counted in <b>' + esc(v.unit) + '</b>' : '') +
                (num(v.oqty) > 0 ? ', with <b>' + esc(v.oqty) + ' ' + esc(v.unit || '') + '</b> at ' + esc(v.osite || 'Main Store') : '') + '.</p></div>';
        }
        const tot = S.rows.length;
        const who = { appr: short(v.appr) || 'the approver', recv: short(v.recv) || 'the receiver', give: short(v.give) || 'Someone' };
        const to = esc(siteLabel(v.to) || '…');
        const end = {
            Transfer: 'All go to <b>' + to + '</b>' + (v.arr ? ', required on <b>' + esc(v.arr) + '</b>' : '') + '. ' + esc(who.give) + ' releases it from the source, ' + esc(who.appr) + ' approves, ' + esc(who.recv) + ' confirms it arrived.',
            Usage: 'Stock goes down after ' + esc(who.appr) + ' approves.',
            Restock: 'Arrives at <b>' + to + '</b>. ' + esc(who.recv) + ' confirms it, ' + esc(who.appr) + ' approves.',
            Return: 'Goes back to <b>' + to + '</b> after ' + esc(who.appr) + ' approves.'
        }[t];
        return '<div class="route"><p><b>' + tot + ' item' + (tot === 1 ? '' : 's') + '</b> on the list' + (hasFrom() && tot ? ' (from ' + esc(Array.from(new Set(S.rows.map((r) => siteLabel(r.from)))).join(', ')) + ')' : '') + '. ' + end + '</p></div>';
    }

    // ---- pages --------------------------------------------------------------------
    function renderPick(c, focusId) {
        const D = c.steps;
        const s1 = curPartial() ? 'now' : itemCount() ? 'done' : 'now';
        let seen = s1 === 'now';
        const dst = stepStates().map((st) => { if (st === 'now' && seen) return 'wait'; if (st === 'now') seen = true; return st; });
        const all = [s1].concat(dst);
        const nowIx = all.indexOf('now'), ready = nowIx === -1;
        const missing = nowIx >= 1 ? D[nowIx - 1].need.filter((k) => !filled(k))[0] : '';
        const help1 = 'Pick the item' + (hasFrom() ? ', source' : '') + ' and qty. More items? Press + Add more.';
        win.innerHTML = head(c) +
            '<div class="kick"><b>' + (ready ? 'All set' : 'Step ' + (nowIx + 1) + ' of ' + all.length) + '</b><span>' + (ready ? 'Press ' + esc(c.go) + ' to check everything before it is saved.' : esc(nowIx === 0 ? help1 : D[nowIx - 1].help)) + '</span><span class="bar">' +
            all.map((st) => '<i class="' + (st === 'done' ? 'on' : st === 'now' ? 'now' : '') + '"></i>').join('') + '</span></div>' +
            '<div class="mid"><div class="steps">' +
            '<section class="st wide ' + s1 + '"><div class="sh"><span class="num">1</span><b>' + (S.type === 'Usage' ? 'Material used' : 'Material') + '</b><small>' + (S.rows.length ? itemCount() + ' loaded' + (curValid() ? ' (incl. this row)' : '') : (s1 === 'done' ? 'Done' : 'Do this now')) + '</small></div>' +
            rowFormHtml() + '</section>' +
            D.map((d, k) => {
                const st = all[k + 1], tag = st === 'done' ? 'Done' : st === 'now' ? 'Do this now' : 'Next';
                return '<section class="st ' + st + (D.length === 1 ? ' wide' : '') + '"><div class="sh"><span class="num">' + (k + 2) + '</span><b>' + esc(d.head) + '</b><small>' + tag + '</small></div>' +
                    stepBody(d.need) + '</section>';
            }).join('') + '</div></div>' +
            '<div class="foot"><button type="button" class="btn" data-close>Cancel</button>' +
            '<span class="next">' + (ready ? (itemCount() + ' item' + (itemCount() === 1 ? '' : 's') + ' will go to the confirm window.') : nowIx === 0 ? (S.cur ? 'Next: <b>' + (hasFrom() && !S.cur.from ? 'the source' : 'the quantity') + '</b>' : 'Next: <b>pick an item</b>') : 'Next: <b>' + esc(LABEL[missing] || '') + '</b>') + '</span>' +
            '<button type="button" class="btn main' + (ready ? '' : ' off') + '" data-go' + (ready ? '' : ' aria-disabled="true" data-miss="' + esc(nowIx === 0 ? (S.cur ? (hasFrom() && !S.cur.from ? 'from' : 'qty') : 'mat') : missing) + '"') + '>' + esc(c.go) + ' →</button></div>';
        const g = nowIx === 0 ? (S.cur ? root.getElementById(hasFrom() && !S.cur.from ? 'i-from' : 'i-qty') : root.getElementById('i-mat')) : (missing && root.getElementById(FIELD[missing]));
        if (g) g.classList.add('glow');
        focus(focusId);
    }
    function renderReview(c) {
        const v = S.v, t = S.type, facts = [];
        if (v.to) facts.push([t === 'Return' ? 'Back to' : t === 'Restock' ? 'Arrives at' : 'To', siteLabel(v.to)]);
        if (v.recv) facts.push(['Receives it', v.recv]);
        if (v.give) facts.push(['Source contact', v.give]);
        if (v.appr) facts.push(['Approves', v.appr]);
        if (v.ship) facts.push([t === 'Usage' ? 'Date used' : t === 'Restock' ? 'Delivery date' : 'Send date', v.ship]);
        if (t === 'Transfer' && v.arr) facts.push(['Required date', v.arr]);
        if (v.note) facts.push(['Note', v.note]);
        win.innerHTML = head(c) +
            (S.checking ? '<div class="kick"><b>Checking</b><span>Checking the stock again…</span></div>'
                : anyShort() ? '<div class="kick warn"><b>Stock changed</b><span>Fix the amber item' + (S.rows.filter((r) => r.short).length === 1 ? '' : 's') + ', then confirm.</span></div>'
                : '<div class="kick"><b>Confirm</b><span>Nothing is saved yet. ✎ change, × remove.</span></div>') +
            '<div class="mid"><div class="steps">' + itemsHtml() +
            '<section class="st wide"><div class="sh"><span class="num">🔒</span><b>Delivery details</b><button type="button" class="ib" data-back aria-label="Change details" title="Change: goes back to the first page">✎</button></div><dl class="facts">' +
            facts.map((f) => '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl></section></div>' + route() + '</div>' +
            '<div class="foot"><button type="button" class="btn" data-back>← Back</button><span class="next"></span><button type="button" class="btn main" data-save' + (S.rows.length && !S.busy && !S.checking && !anyShort() ? '' : ' disabled') + '>' +
            (S.busy ? 'Saving…' : 'Confirm &amp; ' + esc(c.save.toLowerCase())) + '</button></div>';
    }
    function focus(id) {
        if (!id) return;
        const el = root.getElementById(id);
        if (!el) return;
        el.focus();
        try { const l = el.value.length; el.setSelectionRange(l, l); } catch (_) {}
    }
    function render(focusId) {
        if (!S.on || !win) return;
        const c = CFG[S.type];
        if (S.type === 'Register') return renderReg(c, focusId);
        if (S.mode === 'out') return renderReview(c);
        return renderPick(c, focusId);
    }

    // ---- Register material ------------------------------------------------------------
    function legends() { try { return (typeof STOCK_LEGENDS !== 'undefined' && STOCK_LEGENDS) || {}; } catch (_) { return {}; } }
    function regId() {
        const v = S.v;
        if (!v.fam || !v.rel) return '';
        const f = $('ms-new-family'), r = $('ms-new-relation'), d = $('ms-new-id-display');
        try {
            if (f && f.value !== v.fam) { f.value = v.fam; if (typeof f.onchange === 'function') f.onchange.call(f); }
            if (r && r.value !== v.rel) { r.value = v.rel; }
            if (typeof generatePreviewID === 'function') generatePreviewID();
        } catch (_) {}
        return d && /\d/.test(d.value) ? d.value : '';
    }
    function lookAlike(name) {
        const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').split(' ').filter((w) => w.length >= 2);
        const a = words(name);
        if (a.length < 2) return null;
        let best = null, bestScore = 0;
        const all = (typeof window.__ibaGetMaterialStockData === 'function') ? (window.__ibaGetMaterialStockData() || []) : [];
        all.forEach((x) => {
            const b = words(x && x.productName);
            if (!b.length) return;
            const common = a.filter((w) => b.indexOf(w) !== -1).length;
            const score = common / Math.max(a.length, b.length);
            if (score > bestScore) { bestScore = score; best = x; }
        });
        return bestScore >= 0.75 ? best : null;
    }
    function regBody(n) {
        const v = S.v, L = legends();
        let h = '';
        if (n === 1) {
            const fams = Object.keys(L).sort();
            const rels = v.fam && L[v.fam] && L[v.fam].relations ? Object.keys(L[v.fam].relations).sort() : [];
            h += '<div class="row2"><div class="f"><label for="i-fam">Family</label><select id="i-fam" data-k="fam"><option value="">Pick a family</option>' +
                fams.map((k) => '<option value="' + esc(k) + '"' + (k === v.fam ? ' selected' : '') + '>' + esc(k + ' - ' + (L[k].name || '')) + '</option>').join('') + '</select></div>' +
                '<div class="f"><label for="i-rel">Type</label><select id="i-rel" data-k="rel"' + (v.fam ? '' : ' disabled') + '><option value="">' + (v.fam ? 'Pick a type' : 'Pick the family first') + '</option>' +
                rels.map((k) => '<option value="' + esc(k) + '"' + (k === v.rel ? ' selected' : '') + '>' + esc(k + ' - ' + L[v.fam].relations[k]) + '</option>').join('') + '</select></div></div>';
            const id = regId();
            h += '<div class="f"><label>Product ID <em>(made for you)</em></label><div class="ro"><span class="idbig">' + esc(id || '— — —') + '</span></div></div>';
        } else if (n === 2) {
            h += '<div class="f"><label for="i-name">Name</label><input id="i-name" data-k="name" value="' + esc(v.name) + '" placeholder="e.g. Marble Black Carrara 75 x 13 cm" autocomplete="off"></div>';
            const la = v.name ? lookAlike(v.name) : null;
            h += '<div class="note bad">' + (la ? 'Looks like one we already have: <b>' + esc(la.productName) + '</b> (' + esc(la.productID || la.productId || '') + '). Use that one instead?' : '') + '</div>';
            const own = v.unit && UNITS.indexOf(v.unit) === -1;
            h += '<div class="f"><label>Unit <em>(how it is counted)</em></label><div class="units">' + UNITS.map((u) => '<button type="button" class="chip' + (v.unit === u ? ' sel' : '') + '" data-unit="' + esc(u) + '">' + esc(u) + '</button>').join('') +
                '<input id="i-unit" data-k="unit" class="unitown' + (own ? ' sel' : '') + '" value="' + esc(own ? v.unit : '') + '" placeholder="other…" maxlength="20" autocomplete="off" aria-label="Other unit"></div></div>';
        } else if (n === 3) {
            let url = ''; try { url = v.photo && typeof msPhotoUrlFromInput === 'function' ? msPhotoUrlFromInput(v.photo) : ''; } catch (_) {}
            h += '<div class="mat"><span class="ph' + (url ? '' : ' none') + '" aria-hidden="true">' + (url ? '<img alt="" src="' + esc(url) + '" onerror="this.remove()">' : '') + '</span>' +
                '<div class="f grow"><label for="i-photo">Photo name</label><input id="i-photo" data-k="photo" value="' + esc(v.photo) + '" placeholder="e.g. IBA-Sample (.jpg is added)" autocomplete="off"></div>' +
                '<button type="button" class="btn sm" data-photo>Browse</button></div>';
        } else {
            const sel = $('ms-new-site-select');
            const opts = sel ? Array.from(sel.options).filter((o) => o.value) : [];
            h += '<div class="row2"><div class="f"><label for="i-os">Site</label><select id="i-os" data-k="osite">' +
                (opts.length ? opts.map((o) => '<option value="' + esc(o.value) + '"' + (o.value === (v.osite || 'Main Store') ? ' selected' : '') + '>' + esc(o.textContent) + '</option>').join('') : '<option>Main Store</option>') + '</select></div>' +
                '<div class="f"><label for="i-oq">Quantity</label><div class="unitbox"><input id="i-oq" data-k="oqty" inputmode="decimal" value="' + esc(v.oqty) + '" placeholder="0"><span>' + esc(v.unit || '') + '</span></div></div></div>' +
                '<details' + (v.status && v.status !== 'Active' ? ' open' : '') + '><summary>More options</summary><div class="f" style="margin-top:8px"><label for="i-stat">Status</label><select id="i-stat" data-k="status">' +
                ['Active', 'Broken', 'Inactive'].map((s) => '<option' + ((v.status || 'Active') === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div></details>';
        }
        return h;
    }
    function renderReg(c, focusId) {
        const SS = c.steps, states = stepStates();
        const nowIx = states.indexOf('now'), nowStep = nowIx === -1 ? null : SS[nowIx];
        const missing = nowStep ? nowStep.need.filter((k) => !filled(k))[0] : '';
        const ready = nowIx === -1;
        win.innerHTML = head(c) +
            '<div class="kick"><b>' + (ready ? 'All set' : 'Step ' + nowStep.n + ' of ' + SS.length) + '</b><span>' + (ready ? 'Everything needed is filled. Check the line below and save.' : esc(nowStep.help)) + '</span><span class="bar">' +
            states.map((s) => '<i class="' + (s === 'done' ? 'on' : s === 'now' ? 'now' : '') + '"></i>').join('') + '</span></div>' +
            '<div class="mid"><div class="steps">' + SS.map((s, i) => {
                const st = states[i], tag = st === 'done' ? (s.need.length ? 'Done' : 'Optional') : st === 'now' ? 'Do this now' : (s.need.length ? 'Next' : 'Optional');
                return '<section class="st ' + st + '"><div class="sh"><span class="num">' + s.n + '</span><b>' + esc(s.head) + '</b><small>' + tag + '</small></div>' + regBody(s.n) + '</section>';
            }).join('') + '</div>' + route() + '</div>' +
            '<div class="foot"><button type="button" class="btn" data-close>Cancel</button>' +
            '<span class="next">' + (ready ? '' : 'Next: <b>' + esc(LABEL[missing] || '') + '</b>') + '</span>' +
            '<button type="button" class="btn main" ' + (ready && !S.busy ? '' : 'disabled') + ' data-save>' + (S.busy ? 'Saving…' : esc(c.save)) + '</button></div>';
        const gid = FIELD[missing];
        if (gid && root.getElementById(gid)) root.getElementById(gid).classList.add('glow');
        focus(focusId);
    }

    // ---- search lists -------------------------------------------------------------------
    function matHits(q) {
        const toks = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (!toks.length) return [];
        const out = [];
        for (let i = 0; i < S.mats.length && out.length < 40; i++) {
            const m = S.mats[i], hay = (m.id + ' ' + m.name + ' ' + (m.details || '')).toLowerCase();
            if (toks.every((t) => hay.indexOf(t) !== -1)) out.push(m);
        }
        return out;
    }
    function showMatList(inp) {
        const box = root.getElementById('i-res'); if (!box) return;
        const hits = matHits(inp.value);
        if (!inp.value.trim()) { box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = false;
        box.innerHTML = hits.length ? hits.map((m, i) => {
            const tot = r3(Object.values(m.sites || {}).reduce((n, x) => n + num(x), 0));
            return '<button type="button" class="opt' + (i === 0 ? ' act' : '') + '" data-mat="' + esc(m.id) + '">' + phHtml(m, 'xs') + '<span class="ot"><b>' + esc(m.name) + '</b><small>' + esc(m.id) + (m.unit ? ' · ' + esc(m.unit) : '') + (hasFrom() ? ' · ' + tot + ' in stock' : '') + '</small></span></button>';
        }).join('') : '<div class="none">No item found. ' + (S.type === 'Restock' ? 'New item? Register it first in Material Stock.' : 'Try another word or the ID.') + '</div>';
    }
    function peopleFor(k) {
        const base = k === 'appr' ? S.admins : S.people;
        let near = [];
        if (k === 'recv' && S.v.to) near = [S.v.to];
        if (k === 'give') near = S.rows.map((r) => r.from).concat(S.cur && S.cur.from ? [S.cur.from] : []);
        if (!near.length) return base;
        const at = (p) => near.some((s) => p.site && (siteMatch(p.site, s) || String(siteLabel(s)).toLowerCase().indexOf(String(p.site).toLowerCase()) === 0));
        return base.filter(at).concat(base.filter((p) => !at(p)));
    }
    function showPeople(inp) {
        const k = inp.getAttribute('data-pk');
        const box = root.querySelector('[data-pl="' + k + '"]'); if (!box) return;
        const q = inp.value.trim().toLowerCase();
        const list = peopleFor(k).filter((p) => !q || p.label.toLowerCase().indexOf(q) !== -1).slice(0, 40);
        box.hidden = false;
        box.innerHTML = list.length ? list.map((p, i) => '<button type="button" class="opt' + (i === 0 && (q || k !== 'give') ? ' act' : '') + '" data-person="' + esc(p.value) + '" data-for="' + k + '"><span class="ot"><b>' + esc(p.value) + '</b><small>' + esc(p.label.slice(p.value.length).replace(/^ - /, '')) + (p.site ? ' · ' + esc(p.site) : '') + '</small></span></button>').join('') : (k === 'appr' ? '<div class="none">Nobody found. Approvers are set in Settings &gt; Inventory permissions (Approve deliveries).</div>' : '<div class="none">Nobody found.</div>');
    }
    function closeLists(except) { root.querySelectorAll('.res').forEach((b) => { if (b !== except) b.hidden = true; }); }

    // ---- actions -----------------------------------------------------------------------
    async function pickMat(id) {
        const m = S.mats.find((x) => x.id === id);
        if (!m) return;
        S.toast = '';
        const cur = { m: m, from: '', qty: '', loading: true };
        S.cur = cur;
        render();
        m.sites = await freshSites(m);
        if (S.cur !== cur) return;
        cur.loading = false;
        if (hasFrom()) {
            const keys = Object.keys(m.sites || {}).filter((k) => freeAt(m, k) > 0).sort((a, b) => freeAt(m, b) - freeAt(m, a));
            cur.from = keys.length === 1 ? keys[0] : ''; // 17.0.5 patch 213: only one site has it -> picked for you; several -> the user picks
        }
        render(hasFrom() && !cur.from ? 'i-from' : 'i-qty');
    }
    function addCur() {
        if (!canAdd()) return;
        const c = S.cur;
        c.at = Date.now();
        S.rows.push(c);
        S.toast = '✓ ' + esc(c.qty + ' ' + (c.m.unit || '') + ' ' + c.m.name) + ' loaded on the truck (' + S.rows.length + '). Search the next item, or go on.';
        S.cur = null;
        render('i-mat');
    }
    // 17.0.5 patch 212: Go pressed with something missing -> say what (red), glow + focus that box
    function missNote(k) {
        const name = k === 'give' ? 'source contact' : k === 'mat' ? 'item' : k === 'from' ? 'source site' : k === 'qty' ? 'quantity' : String(LABEL[k] || 'field').replace(/^the /, '');
        const sp = root.querySelector('.foot .next');
        if (sp) sp.innerHTML = '<b class="iba-ig-miss">Missing ' + esc(name) + '. Please complete this first.</b>';
        const id = k === 'mat' ? 'i-mat' : k === 'from' ? 'i-from' : k === 'qty' ? 'i-qty' : FIELD[k];
        const f = id && root.getElementById(id);
        if (f) { f.classList.add('glow'); try { f.scrollIntoView({ block: 'center' }); f.focus(); } catch (_) {} }
    }
    function goOut() {
        if (S.cur && canAdd()) { S.cur.at = Date.now(); S.rows.push(S.cur); S.cur = null; }
        if (!S.rows.length) return;
        S.mode = 'out'; S.toast = '';
        render();
        try { root.querySelector('.ov').scrollTop = 0; } catch (_) {}
    }
    async function saveTransfer() {
        if (S.busy || !S.rows.length) return;
        if (typeof saveTransferEntry !== 'function') { alert('The inventory form is not loaded. Please refresh the page.'); return; }
        S.busy = true; render();
        if (await recheck()) { S.busy = false; S.mode = 'out'; render(); return; }
        if (!S.on) { S.busy = false; return; }
        const v = S.v;
        window.__ibaTfGuided = {
            to: S.type === 'Usage' ? '' : (v.to || ''),
            recv: (S.type === 'Transfer' || S.type === 'Restock') ? (v.recv || '') : '',
            give: S.type === 'Transfer' ? (v.give || '') : '',
            appr: v.appr || '', ship: v.ship || '', required: S.type === 'Transfer' ? (v.arr || '') : '', note: String(v.note || '').trim(),
            items: S.rows.map((r) => ({ productID: r.m.id, productName: r.m.name, details: r.m.details || '', qty: num(r.qty), fromSite: hasFrom() ? (r.from || '') : '' }))
        };
        let ok = false;
        try { ok = await saveTransferEntry(); } catch (e) { console.error(e); }
        window.__ibaTfGuided = null;
        S.busy = false;
        if (ok === true) close(true); else render();
    }
    async function saveRegister() {
        if (S.busy) return;
        const v = S.v;
        if (!v.fam || !v.rel || !v.name || !v.unit) return;
        if (typeof handleSaveNewMaterial !== 'function') { alert('The Material Stock form is not loaded. Please refresh the page.'); return; }
        regId();
        const set = (id, val) => { const el = $(id); if (el) el.value = val == null ? '' : val; };
        set('ms-new-name', v.name); set('ms-new-unit', v.unit); set('ms-new-photo-url', v.photo || '');
        set('ms-new-site-select', v.osite || ($('ms-new-site-select') && $('ms-new-site-select').value) || 'Main Store');
        set('ms-new-stock-qty', num(v.oqty) > 0 ? v.oqty : ''); set('ms-new-status', v.status || 'Active');
        S.busy = true; render();
        try { await handleSaveNewMaterial(); } catch (e) { console.error(e); }
        S.busy = false;
        const name = $('ms-new-name');
        if (name && !name.value) close(true); else render();
    }

    // ---- open / close ------------------------------------------------------------------
    function build() {
        if (host) return;
        host = document.createElement('div');
        host.id = 'iba-ig-host';
        host.setAttribute('style', 'position:fixed;inset:0;z-index:100600;display:none;');
        root = host.attachShadow({ mode: 'open' });
        // the app's own font (same family as the other pop-ups)
        try { const ff = getComputedStyle(document.body).fontFamily; if (ff) host.style.setProperty('--iba-ig-font', ff); } catch (_) {}
        root.innerHTML = '<style>' + CSS + '</style><div class="ov" data-ov><div class="win" role="dialog" aria-modal="true"></div></div>';
        win = root.querySelector('.win');
        document.body.appendChild(host);
        root.addEventListener('keydown', onKey);
        root.addEventListener('input', onInput);
        root.addEventListener('change', onChange);
        root.addEventListener('click', onClick);
        root.addEventListener('focusin', (e) => {
            const t = e.target;
            if (t && t.hasAttribute && t.hasAttribute('data-pk')) { t.select && t.select(); showPeople(t); }
        });
    }
    function hideOrig(id, on) {
        const m = $(id); if (!m) return;
        if (on) m.style.setProperty('display', 'none', 'important');
        else m.style.removeProperty('display');
    }
    function show() {
        build();
        S.on = true;
        { const pp = $('iba-ig-pill'); if (pp) pp.remove(); }
        host.style.display = 'block';
        document.body.classList.add('iba-ig-on');
        try { root.querySelector('.ov').scrollTop = 0; } catch (_) {}
        S.v0 = JSON.stringify(S.v);
        render(S.type === 'Register' ? 'i-fam' : 'i-mat');
    }
    // 17.0.5 patch 146: closing with something entered asks first (all would have to be entered again)
    function dirty() {
        return S.rows.length > 0 || !!S.cur || JSON.stringify(S.v) !== S.v0;
    }
    function askClose() {
        if (!dirty()) { close(false); return; }
        const ov = root.querySelector('.ov');
        if (!ov || ov.querySelector('.cfm')) return;
        const what = S.type === 'Register' ? 'The details you typed' : 'The loaded items and details';
        const c = document.createElement('div');
        c.className = 'cfm';
        c.innerHTML = '<div class="cfmbox" role="alertdialog" aria-modal="true" aria-label="Close without saving?"><b>Close without saving?</b>' +
            '<p>' + what + ' will be lost and you will have to enter them again.</p>' +
            '<div class="cfmacts"><button type="button" class="btn" data-cfm-close>Close anyway</button><button type="button" class="btn main" data-cfm-keep>Keep editing</button></div></div>';
        ov.appendChild(c);
        const keep = c.querySelector('[data-cfm-keep]');
        if (keep) keep.focus();
    }
    function dropCfm() { const c = root && root.querySelector('.cfm'); if (c) c.remove(); }
    function close(saved, keep) {
        if (!S.on) return;
        dropCfm();
        S.on = false;
        if (!keep) clearMin();
        setTimeout(pill, 0);
        if (host) host.style.display = 'none';
        document.body.classList.remove('iba-ig-on');
        if (S.type === 'Register') {
            if (!saved && typeof window.msCloseNewMaterialModal === 'function') window.msCloseNewMaterialModal();
            const m = $('ms-new-material-modal'); if (m) m.classList.add('hidden');
            hideOrig('ms-new-material-modal', false);
        } else {
            const m = $('transfer-job-modal'); if (m) m.classList.add('hidden');
            hideOrig('transfer-job-modal', false);
        }
    }
    function oldForm() {
        const t = S.type;
        S.on = false;
        if (host) host.style.display = 'none';
        document.body.classList.remove('iba-ig-on');
        if (t === 'Register') hideOrig('ms-new-material-modal', false);
        else {
            hideOrig('transfer-job-modal', false);
            // carry the first item over when there is one
            const first = S.rows[0] || (S.cur && !S.cur.loading ? S.cur : null);
            if (first) {
                try {
                    transferProductChoices.setChoiceByValue(first.m.id);
                    $('tf-product-select').dispatchEvent(new Event('change'));
                    const q = $('tf-req-qty'); if (q && first.qty) q.value = first.qty;
                } catch (_) {}
            }
        }
    }
    // ---- 17.0.5 patch 147: minimize (kept until the end of the day, holds no stock) ----------
    function minKey() { let k = ''; try { k = (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.key) || localStorage.getItem('approverKey') || ''; } catch (_) {} return 'iba-ig-min-v1:' + k; }
    let MIN = null;
    function loadMin() {
        try { MIN = JSON.parse(localStorage.getItem(minKey()) || 'null'); } catch (_) { MIN = null; }
        if (MIN && (MIN.day !== ymd(new Date()) || !CFG[MIN.type])) clearMin();
        return MIN;
    }
    function clearMin() { MIN = null; try { localStorage.removeItem(minKey()); } catch (_) {} }
    function anyShort() { return S.rows.some((r) => r.short); }
    function minimize() {
        MIN = { day: ymd(new Date()), type: S.type, v: S.v, mode: S.mode,
            rows: S.rows.map((r) => ({ id: r.m.id, from: r.from, qty: r.qty, at: r.at || Date.now() })),
            cur: S.cur && !S.cur.loading ? { id: S.cur.m.id, from: S.cur.from, qty: S.cur.qty } : null };
        try { localStorage.setItem(minKey(), JSON.stringify(MIN)); } catch (_) {}
        close(false, true);
    }
    function matOf(id) { return S.mats.find((x) => x.id === id) || { id: id, name: id, details: '', sites: {}, choice: null, unit: '' }; }
    function restore(d) {
        S.v = Object.assign({}, S.v, d.v || {});
        S.rows = (d.rows || []).map((r) => ({ m: matOf(r.id), from: r.from, qty: r.qty, at: r.at }));
        S.cur = d.cur ? { m: matOf(d.cur.id), from: d.cur.from, qty: d.cur.qty } : null;
        S.mode = d.mode === 'out' && S.rows.length ? 'out' : 'pick';
        S.arrAuto = false;
    }
    // free stock read fresh; each row counts the rows before it on the same truck
    async function recheck() {
        if (!hasFrom() || !S.rows.length) return false;
        S.checking = true; render();
        const seen = new Set();
        await Promise.all(S.rows.map(async (r) => { if (seen.has(r.m)) return; seen.add(r.m); try { r.m.sites = await freshSites(r.m); } catch (_) {} }));
        S.checking = false;
        S.rows.forEach((r, i) => {
            delete r.short;
            const raw = num((r.m.sites || {})[r.from]);
            let f = raw;
            try { if (typeof calculateRealAvailable === 'function') f = calculateRealAvailable(r.m.id, r.from, raw); } catch (_) {}
            S.rows.slice(0, i).forEach((o) => { if (o.m.id === r.m.id && siteMatch(o.from, r.from)) f -= num(o.qty); });
            f = Math.max(0, r3(f));
            if (num(r.qty) > f + 1e-9) r.short = { free: f };
        });
        return anyShort();
    }
    // the floating pill (every page) until it is saved or thrown away
    function pill() {
        let p = $('iba-ig-pill');
        const d = S.on ? null : loadMin();
        if (!d) { if (p) p.remove(); return; }
        if (!$('iba-ig-pill-css')) {
            const st = document.createElement('style');
            st.id = 'iba-ig-pill-css';
            st.textContent = '#iba-ig-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:100550;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;border-radius:999px;border:1px solid rgba(127,227,214,.55);background:linear-gradient(160deg,rgba(20,44,68,.72),rgba(8,18,30,.84));backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);box-shadow:0 14px 34px rgba(0,0,0,.45);color:#F3EAD3;font:600 13.5px/1.2 ' + (getComputedStyle(document.body).fontFamily || 'system-ui') + ';max-width:calc(100vw - 24px)}' +
                '#iba-ig-pill .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#iba-ig-pill .t b{color:#7FE3D6}' +
                '#iba-ig-pill button{height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}' +
                '#iba-ig-pill button.go{border-color:rgba(127,227,214,.6);background:linear-gradient(180deg,rgba(64,196,206,.34),rgba(19,138,151,.2))}' +
                '#iba-ig-pill button:hover{background:rgba(255,255,255,.16)}#iba-ig-pill button.x{width:32px;padding:0}' +
                'body.iba-mobile-ui #iba-ig-pill{bottom:calc(84px + env(safe-area-inset-bottom,0px))}';
            document.head.appendChild(st);
        }
        if (!p) {
            p = document.createElement('div');
            p.id = 'iba-ig-pill';
            p.setAttribute('role', 'status');
            document.body.appendChild(p);
            p.addEventListener('click', (e) => {
                const b = e.target.closest('button'); if (!b) return;
                if (b.hasAttribute('data-open')) resumeNow();
                else if (b.hasAttribute('data-ask')) { p.dataset.ask = '1'; pill(); }
                else if (b.hasAttribute('data-no')) { delete p.dataset.ask; pill(); }
                else if (b.hasAttribute('data-yes')) { delete p.dataset.ask; clearMin(); pill(); }
            });
        }
        const n = (d.rows || []).length + (d.cur ? 1 : 0);
        const what = d.type + ' in progress';
        p.innerHTML = p.dataset.ask
            ? '<span class="t">Throw away this ' + esc(d.type.toLowerCase()) + '? You would have to enter it again.</span><button type="button" data-no class="go">Keep it</button><button type="button" data-yes>Throw away</button>'
            : '<span aria-hidden="true">🚚</span><span class="t">' + esc(what) + ' <b>(' + n + ' item' + (n === 1 ? '' : 's') + ')</b></span><button type="button" class="go" data-open>Open</button><button type="button" class="x" data-ask aria-label="Throw away" title="Throw away">×</button>';
    }
    async function resumeNow() {
        const d = loadMin(); if (!d) { pill(); return; }
        let have = 0;
        try { have = store(transferProductChoices).length; } catch (_) { have = 0; }
        try {
            if (!have && typeof window.ibaOpenShellPage === 'function') {
                await window.ibaOpenShellPage('inv-active-job');
                try { if (typeof ensureAllEntriesFetched === 'function') await ensureAllEntriesFetched(false); } catch (_) {}
            }
            await window.openTransferModal(d.type);
        } catch (e) { console.error('[guided] reopen failed', e); }
    }
    setTimeout(pill, 1500);
    function reset(type) {
        S.type = type; S.rows = []; S.cur = null; S.mode = 'pick'; S.toast = ''; S.busy = false; S.arrAuto = true;
        const today = ymd(new Date());
        S.v = type === 'Register' ? { osite: 'Main Store', status: 'Active' } : { ship: today, arr: plusWork(today, 3) };
        if (type !== 'Register' && S.admins.length === 1) S.v.appr = S.admins[0].value;
        if (type === 'Return') {
            const ms = S.sites.find((s) => /main\s*store/i.test(s.label));
            if (ms) S.v.to = ms.value;
        }
    }
    const ORIG = window.openTransferModal;
    async function openGuided(type) {
        type = type || 'Transfer';
        const kept = (CFG[type] && type !== 'Register' && !(S.skip > Date.now())) ? loadMin() : null;
        if (kept) type = kept.type;
        if (!CFG[type] || type === 'Register' || S.skip > Date.now() || typeof ORIG !== 'function') {
            const out = await ORIG.apply(this, arguments);
            await loadApprovers();
            return out;
        }
        hideOrig('transfer-job-modal', true);
        try { await ORIG.call(this, type); } catch (e) { hideOrig('transfer-job-modal', false); throw e; }
        const m = $('transfer-job-modal');
        if (!m || m.classList.contains('hidden')) { hideOrig('transfer-job-modal', false); return; }
        loadLists();
        await loadApprovers();
        S.no = ($('tf-control-no') && $('tf-control-no').value) || '';
        if (/generat/i.test(S.no)) S.no = '';
        reset(type);
        if (kept) { restore(kept); clearMin(); }
        show();
        if (kept) {
            if (await recheck()) S.mode = 'out';
            render();
        }
    }
    if (typeof ORIG === 'function') window.openTransferModal = openGuided;
    // a Return made from a task fills the normal form itself: keep the normal form
    const ORIG_RET = window.initiateReturn;
    if (typeof ORIG_RET === 'function') {
        window.initiateReturn = function () { S.skip = Date.now() + 1500; return ORIG_RET.apply(this, arguments); };
    }
    // Register New Material button (bound by materialStock.js to the function itself)
    document.addEventListener('click', async (e) => {
        const b = e.target && e.target.closest && e.target.closest('#ms-add-new-btn');
        if (!b || typeof window.openNewMaterialModal !== 'function') return;
        e.preventDefault(); e.stopImmediatePropagation();
        hideOrig('ms-new-material-modal', true);
        try { await window.openNewMaterialModal(); } catch (err) { console.error(err); }
        const m = $('ms-new-material-modal');
        if (!m || m.classList.contains('hidden')) { hideOrig('ms-new-material-modal', false); return; }
        S.no = '';
        reset('Register');
        show();
    }, true);
    // photo picked in the app's photo browser
    document.addEventListener('input', (e) => {
        if (!S.on || S.type !== 'Register' || !e.target || e.target.id !== 'ms-new-photo-url') return;
        S.v.photo = e.target.value; render();
    }, true);

    // ---- events -------------------------------------------------------------------------
    function onKey(e) {
        const t = e.target;
        if (e.key === 'Escape') {
            if (root.querySelector('.cfm')) { e.stopPropagation(); dropCfm(); const f = root.querySelector('.win input:not([disabled]), .win button'); if (f) f.focus(); return; }
            const open = root.querySelector('.res:not([hidden])');
            if (open) { open.hidden = true; e.stopPropagation(); return; }
            e.stopPropagation(); askClose(); return;
        }
        const list = t && t.parentNode && t.parentNode.querySelector && t.parentNode.querySelector('.res:not([hidden])');
        if (list && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const opts = Array.from(list.querySelectorAll('.opt'));
            let i = opts.findIndex((o) => o.classList.contains('act'));
            opts.forEach((o) => o.classList.remove('act'));
            i = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
            if (opts[i]) { opts[i].classList.add('act'); opts[i].scrollIntoView({ block: 'nearest' }); }
            return;
        }
        if (e.key !== 'Enter') return;
        if (list) { const a = list.querySelector('.opt.act') || (t.getAttribute('data-pk') === 'give' ? null : list.querySelector('.opt')); if (a) { e.preventDefault(); a.click(); } else if (t.getAttribute('data-pk') === 'give') { e.preventDefault(); } return; }
        if (t.id === 'i-qty') { e.preventDefault(); if (canAdd()) addCur(); }
    }
    function onInput(e) {
        const t = e.target;
        if (t.id === 'i-mat') { showMatList(t); return; }
        if (t.hasAttribute('data-pk')) { S.v[t.getAttribute('data-pk')] = ''; showPeople(t); return; }
        if (t.id === 'i-qty' && S.cur) { S.cur.qty = t.value; render(t.id); return; }
        const k = t.getAttribute('data-k');
        if (k && t.type !== 'date' && t.tagName !== 'SELECT') {
            S.v[k] = t.value;
            if (k === 'unit') root.querySelectorAll('[data-unit]').forEach((c) => c.classList.remove('sel'));
            if (k === 'note') return;   // no redraw while typing a note
            render(t.id);
        }
    }
    function onChange(e) {
        const t = e.target;
        if (t.hasAttribute('data-cur-from') && S.cur) { S.cur.from = t.value; render('i-qty'); return; }
        const k = t.getAttribute('data-k');
        if (!k) return;
        if (t.type === 'date' || t.tagName === 'SELECT') {
            S.v[k] = t.value;
            if (k === 'fam') S.v.rel = '';
            if (k === 'arr') S.arrAuto = false;
            if (k === 'ship' && S.arrAuto && S.type === 'Transfer') S.v.arr = plusWork(t.value, 3);
            if (k === 'to' && S.v.recv && S.type !== 'Return') { /* keep the receiver; people at the new site go on top */ }
            render();
        }
    }
    function onClick(e) {
        const ov = e.target.closest('[data-ov]');
        if (e.target === ov) return;   // a click beside the window does nothing (no lost work)
        const b = e.target.closest('button');
        if (!e.target.closest('.srch')) closeLists();
        if (!b) return;
        if (b.hasAttribute('data-cfm-keep')) { dropCfm(); const f = root.querySelector('.win input:not([disabled]), .win button'); if (f) f.focus(); return; }
        if (b.hasAttribute('data-cfm-close')) { close(false); return; }
        if (root.querySelector('.cfm')) return;
        if (b.hasAttribute('data-close')) { askClose(); return; }
        if (b.hasAttribute('data-min')) { minimize(); return; }
        if (b.dataset.take != null) { const r = S.rows[Number(b.dataset.take)]; if (r && r.short) { r.qty = String(r.short.free); delete r.short; } render(); return; }
        if (b.hasAttribute('data-old')) { oldForm(); return; }
        if (b.dataset.mat) { pickMat(b.dataset.mat); return; }
        if (b.dataset.person) { S.v[b.dataset.for] = b.dataset.person; closeLists(); render(); return; }
        if (b.dataset.unit) { S.v.unit = b.dataset.unit; render(); return; }
        if (b.hasAttribute('data-photo')) {
            try {
                if (typeof msOpenMaterialPhotoBrowser === 'function') {
                    const pm = $('ms-photo-browser-modal'); if (pm) pm.style.setProperty('z-index', '100700', 'important');
                    msOpenMaterialPhotoBrowser({ mode: 'input', targetInputId: 'ms-new-photo-url' });
                }
            } catch (err) { console.error(err); }
            return;
        }
        if (b.hasAttribute('data-save')) { if (S.type === 'Register') saveRegister(); else saveTransfer(); return; }
        if (b.dataset.del != null) { S.rows.splice(Number(b.dataset.del), 1); if (!S.rows.length) S.mode = 'pick'; if (anyShort()) recheck().then(() => render()); else render(); return; }
        if (b.dataset.edit != null) {
            const i = Number(b.dataset.edit);
            if (S.cur && canAdd()) S.rows.push(S.cur);
            S.cur = S.rows.splice(i, 1)[0]; delete S.cur.short; S.toast = ''; S.mode = 'pick'; render('i-qty'); return;
        }
        if (b.hasAttribute('data-go')) { if (b.getAttribute('aria-disabled') === 'true') { missNote(b.getAttribute('data-miss')); return; } if (S.mode !== 'out') goOut(); return; }
        if (b.hasAttribute('data-back') || b.hasAttribute('data-more')) { S.mode = 'pick'; render(b.hasAttribute('data-more') ? 'i-mat' : ''); return; }
        if (b.hasAttribute('data-add')) { addCur(); return; }
        if (b.hasAttribute('data-cur-x')) { S.cur = null; render('i-mat'); return; }
    }

    window.ibaInvGuide = { open: (t) => window.openTransferModal(t), close: () => close(false), state: () => S };

    // ---- look (inside the shadow root, so the app's CSS cannot change it) -------------------
    const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.ov { position: fixed; inset: 0; background: rgba(3,10,18,.55); display: flex; align-items: center; justify-content: center; padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 12px max(12px, env(safe-area-inset-left, 0px)); overflow: hidden;
  /* 17.0.5 patch 142: same family as the app's pop-ups: colours come from the system UI tokens (--ui-*) */
  --line: var(--ui-line, rgba(255,255,255,.14)); --line-soft: var(--ui-line-soft, rgba(255,255,255,.07)); --card: rgba(255,255,255,.035);
  --text: var(--ui-text, #EEF3F8); --soft: var(--ui-text-2, #A7B6C6); --mute: var(--ui-text-3, #7F90A3);
  --act: var(--ui-teal, #138A97); --act-hover: var(--ui-teal-hover, #17A0AE); --act-soft: var(--ui-teal-soft, rgba(19,138,151,.18));
  --teal: #7FE3D6; --gold: #FCD34D; --bad: var(--ui-red, #EF8A7A); --ok-ink: #05211F; --now-ink: #2A1E00; --input: rgba(255,255,255,.05);
  --f-ui: var(--iba-ig-font, "Segoe UI", system-ui, Arial, sans-serif); --f-no: "JetBrains Mono", Consolas, ui-monospace, monospace;
  color: var(--text); font: 500 14px/1.45 var(--f-ui); }
.win { width: min(980px, 100%); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, #17324C 0%, #0F2235 100%); background-color: #12283D; border: 1px solid rgba(255,255,255,.12); border-radius: var(--ui-radius-l, 16px); box-shadow: 0 28px 70px rgba(0,0,0,.5); position: relative; }
.head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 18px 10px; margin-bottom: 10px; border-bottom: 1px solid var(--line-soft); }
.mid { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.kick { flex: none; }
.foot { flex: none; }
.head h2 { margin: 0; font-size: 18px; font-weight: 800; color: var(--text); }
.pill { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: rgba(127,227,214,.14); color: var(--teal); font-family: var(--f-no); }
.x { margin-left: auto; width: 34px; height: 34px; display: inline-grid; place-items: center; padding: 0; border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--soft); font-size: 20px; font-weight: 400; line-height: 1; cursor: pointer; }
.x:hover { background: rgba(255,255,255,.07); color: var(--text); }
.truck + .x, .x + .x { margin-left: 0; }
.truck { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font: 600 13px var(--f-ui); color: var(--text); background: rgba(255,255,255,.05); border: 1px solid var(--line); border-radius: 10px; min-height: 34px; padding: 0 12px; cursor: pointer; }
.truck:hover:not(:disabled) { background: rgba(255,255,255,.10); }
.truck b { min-width: 22px; height: 22px; border-radius: 99px; display: inline-grid; place-items: center; background: var(--teal); color: var(--ok-ink); font-size: 12px; }
.truck:disabled { opacity: .55; cursor: default; }
.what { margin: 0 18px 12px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.04); color: var(--soft); display: flex; gap: 10px; align-items: flex-start; }
.what b { color: var(--text); }
.kick { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 18px 10px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0,0,0,.18); }
.kick b { color: var(--teal); font-size: 14px; }
.kick span { color: var(--soft); font-size: 12.5px; min-width: 0; flex: 1 1 260px; }
.kick .bar { display: flex; gap: 6px; flex: none; margin-left: auto; }
.bar i { display: block; width: 36px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.16); }
.bar i.on { background: var(--teal); } .bar i.now { background: var(--gold); }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 18px 12px; }
.st { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px; border-radius: 14px; border: 1px solid var(--line); background: var(--card); }
.st.done { border-color: rgba(127,227,214,.38); }
.st.now { border-color: rgba(252,211,77,.6); box-shadow: 0 0 0 3px rgba(252,211,77,.08); }
.st.wait { opacity: .62; } .st.wait:focus-within, .st.wait:hover { opacity: 1; }
.st.wide { grid-column: 1 / -1; }
.sh { display: flex; align-items: center; gap: 10px; }
.num { width: 26px; height: 26px; border-radius: 99px; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: rgba(255,255,255,.12); color: var(--soft); flex: none; }
.st.done .num { background: var(--teal); color: var(--ok-ink); } .st.now .num { background: var(--gold); color: var(--now-ink); }
.sh b { font-size: 14.5px; color: var(--text); }
.sh small { margin-left: auto; font-size: 11.5px; font-weight: 700; color: var(--teal); }
.st.now .sh small { color: var(--gold); } .st.wait .sh small { color: var(--mute); }
.items .sh .btn, .sh .ib { margin-left: 8px; }
.help { font-size: 12.5px; color: var(--mute); margin-top: -4px; }
.f { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.f.grow { flex: 1; }
.f label { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--soft); }
.f label em { font-style: normal; color: var(--mute); font-weight: 500; letter-spacing: 0; text-transform: none; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
input, select, textarea { width: 100%; min-width: 0; min-height: 40px; height: auto; margin: 0; font: 500 14px var(--f-ui); color: var(--text); background: var(--input); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; outline: none; box-shadow: none; }
select { appearance: none; -webkit-appearance: none; padding-right: 34px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A7B6C6' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 11px center; background-size: 15px; }
select option { background: #13293F; color: var(--text); }
input:focus, select:focus, textarea:focus { border-color: var(--act); box-shadow: 0 0 0 3px var(--act-soft); }
input::placeholder, textarea::placeholder { color: var(--mute); font-weight: 400; opacity: 1; }
input[type=date]::-webkit-calendar-picker-indicator { filter: invert(.8); cursor: pointer; }
input[type=date] { color-scheme: dark; }
textarea { resize: vertical; min-height: 40px; height: 40px; }
select:disabled, input:disabled { opacity: .55; }
.glow { border-color: var(--gold) !important; box-shadow: 0 0 0 3px rgba(252,211,77,.15) !important; }
.unitbox { position: relative; }
.unitbox input { padding-right: 52px; font-family: var(--f-no); }
.unitbox span { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--mute); font-weight: 700; font-size: 12.5px; pointer-events: none; }
.ro { min-height: 42px; display: flex; align-items: center; padding: 0 12px; border-radius: 10px; background: rgba(255,255,255,.05); color: var(--soft); font-weight: 700; }
.idbig { font-family: var(--f-no); font-size: 20px; font-weight: 600; color: var(--gold); letter-spacing: .04em; }
.note { font-size: 12.5px; line-height: 1.4; color: var(--mute); }
.note b { color: var(--text); }
.note.good { color: var(--teal); } .note.bad { color: var(--bad); } .note:empty { display: none; }
.btn { font: 600 13.5px var(--f-ui); border-radius: 10px; min-height: 38px; padding: 0 16px; cursor: pointer; border: 1px solid var(--line); background: rgba(255,255,255,.05); color: var(--text); display: inline-flex; align-items: center; justify-content: center; gap: 7px; white-space: nowrap; }
.btn:hover:not(:disabled) { background: rgba(255,255,255,.10); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.main { background: var(--act); color: #fff; border-color: transparent; }
.btn.main:hover:not(:disabled) { background: var(--act-hover); }
.btn.main:disabled { background: rgba(255,255,255,.05); color: var(--mute); border-color: var(--line); opacity: .7; }
.btn.sm { min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.addm { background: var(--act-soft); color: var(--text); border-color: var(--act); }
.addm:disabled { opacity: .45; cursor: not-allowed; }
.lnk { border: 0; background: none; color: var(--teal); font: 700 12px var(--f-ui); cursor: pointer; padding: 0 0 0 6px; }
.lnk.old { color: var(--mute); font-weight: 600; text-decoration: underline; }
.ib { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,.05); color: var(--soft); cursor: pointer; font-size: 13px; }
.chip { font: 700 12px var(--f-ui); padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,.04); color: var(--soft); cursor: pointer; }
.chip.sel { border-color: var(--teal); background: rgba(127,227,214,.12); color: var(--teal); }
.units { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.units .unitown { width: 110px; min-height: 30px; height: 30px; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
.units .unitown.sel { border-color: var(--teal); }
details summary { cursor: pointer; color: var(--mute); font-size: 12.5px; font-weight: 700; }
.ph { width: 54px; height: 54px; border-radius: 10px; flex: none; display: block; overflow: hidden; background: linear-gradient(135deg, #2B2F36, #0B0C0E 55%, #3A3F47); position: relative; }
.ph img { width: 100%; height: 100%; object-fit: cover; display: block; position: relative; z-index: 1; }
.ph.none { background: rgba(255,255,255,.04); border: 1px dashed var(--line); }
.ph.sm { width: 34px; height: 34px; border-radius: 8px; }
.ph.xs { width: 30px; height: 30px; border-radius: 7px; }
.mat { display: flex; gap: 12px; align-items: flex-end; padding: 10px; border-radius: 12px; background: rgba(0,0,0,.2); border: 1px solid var(--line); }
.irow { display: flex; flex-direction: column; gap: 6px; }
.irow .ih, .irow .ib2 { display: grid; grid-template-columns: 54px minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(0, 1fr); gap: 10px; align-items: center; }
.irow.nofrom .ih, .irow.nofrom .ib2 { grid-template-columns: 54px minmax(0, 2.4fr) minmax(0, 1fr); }
.irow .ih span { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); }
.irow .ib2 { padding: 8px; border-radius: 12px; background: rgba(0,0,0,.2); border: 1px solid var(--line); }
.rn { display: flex; flex-direction: column; min-width: 0; }
.rn b { overflow-wrap: anywhere; }
.rn small { font-family: var(--f-no); color: var(--mute); font-size: 12px; }
.iafter { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.iafter .note { flex: 1; min-width: 0; }
.srch { position: relative; min-width: 0; }
.res { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20; max-height: 300px; overflow: auto; padding: 4px; border-radius: 12px; background: #0E2133; border: 1px solid rgba(127,227,214,.35); box-shadow: 0 18px 40px rgba(0,0,0,.55); }
.res .opt { width: 100%; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--text); text-align: left; cursor: pointer; font: inherit; }
.res .opt.act, .res .opt:hover { background: rgba(127,227,214,.12); }
.res .ot { display: flex; flex-direction: column; min-width: 0; }
.res .ot b { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res .ot small { font-size: 11.5px; color: var(--mute); font-family: var(--f-no); }
.res .none { padding: 10px; color: var(--mute); font-size: 12.5px; }
.rt { overflow: auto; min-height: 0; }
.rt table { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--text); }
.rt th { text-align: left; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); padding: 6px 8px; border-bottom: 1px solid var(--line); }
.rt td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.06); vertical-align: middle; }
.rt .r { text-align: right; } .rt .mono { font-family: var(--f-no); font-variant-numeric: tabular-nums; } .rt .nw { white-space: nowrap; }
.rt td .ib { margin-left: 4px; }
.facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.facts div { padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,.2); min-width: 0; }
.facts dt { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); }
.facts dd { margin: 2px 0 0; font-weight: 700; overflow-wrap: anywhere; }
.route { margin: 0 18px 14px; padding: 12px 14px; border-radius: 12px; border: 1px dashed rgba(127,227,214,.35); background: rgba(127,227,214,.05); }
.route p { margin: 0; color: var(--soft); } .route p b { color: var(--text); }
.foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 18px; border-top: 1px solid var(--line-soft); background: rgba(0,0,0,.16); border-radius: 0 0 var(--ui-radius-l, 16px) var(--ui-radius-l, 16px); }
.foot .next { margin-left: auto; color: var(--mute); font-size: 12.5px; }
.foot .next b { color: var(--gold); }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
@media (max-width: 760px) { .steps { grid-template-columns: 1fr; } }
@media (max-height: 800px) { input, select, textarea { min-height: 36px; padding-top: 6px; padding-bottom: 6px; } textarea { height: 36px; min-height: 36px; } .ph.rowph, .ph { width: 46px; height: 46px; } .irow .ih, .irow .ib2 { grid-template-columns: 46px minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(0, 1fr); } .irow.nofrom .ih, .irow.nofrom .ib2 { grid-template-columns: 46px minmax(0, 2.4fr) minmax(0, 1fr); } .ph.sm { width: 30px; height: 30px; } .ph.xs { width: 28px; height: 28px; } }
@media (max-width: 640px) {
  .irow .ih { display: none; }
  .irow .ib2, .irow.nofrom .ib2 { grid-template-columns: 54px minmax(0, 1fr); }
  .irow .ib2 > select, .irow .ib2 > .unitbox { grid-column: 1 / -1; }
  .head, .what, .kick, .steps, .route, .foot { margin-left: 0; margin-right: 0; }
  .what, .kick, .route { margin-left: 12px; margin-right: 12px; }
  .steps { padding: 0 12px 14px; } .foot { padding: 12px; } .head { padding: 14px 12px 10px; }
  .kick .bar { display: none; }
}
@media (max-width: 460px) { .row2 { grid-template-columns: 1fr; } }
/* 17.0.5 patch 145: same glass and buttons as the app's own pop-ups (ESN / assistant family);
   delivery details as a clean list, not boxes */
.ov { background: rgba(4,12,22,.36); }
.win { background: linear-gradient(160deg, rgba(20,44,68,.66), rgba(8,18,30,.78)); background-color: transparent; backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); border: 1px solid rgba(127,227,214,.38); border-radius: 18px; box-shadow: 0 28px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08); color: #F3EAD3; }
.head { background: rgba(8,18,30,.22); border-bottom: 1px solid rgba(227,201,138,.22); padding-top: 12px; }
.st { background: rgba(255,255,255,.03); border-color: rgba(255,255,255,.12); }
.kick { background: rgba(6,14,24,.3); border-color: rgba(255,255,255,.12); }
.foot { background: rgba(8,18,30,.22); border-top: 1px solid rgba(227,201,138,.22); border-radius: 0 0 18px 18px; }
input, select, textarea { background-color: rgba(6,14,24,.42); border-color: rgba(255,255,255,.16); }
.btn, .truck, .addm { height: 36px; min-height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff; font: 700 13.5px var(--f-ui); box-shadow: none; }
.btn:hover:not(:disabled), .truck:hover:not(:disabled), .addm:hover:not(:disabled) { background: rgba(255,255,255,.14); }
.btn.main, .addm { border-color: rgba(127,227,214,.6); background: linear-gradient(180deg, rgba(64,196,206,.34), rgba(19,138,151,.20)); color: #fff; }
.btn.main:hover:not(:disabled), .addm:hover:not(:disabled) { background: linear-gradient(180deg, rgba(64,196,206,.46), rgba(19,138,151,.30)); }
.btn.main:disabled { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: var(--mute); opacity: .55; }
.btn.main.off { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: var(--mute); opacity: .55; cursor: not-allowed; }
.iba-ig-miss { color: #ff8a80; font-weight: 700; }
.btn.sm { height: 30px; min-height: 30px; padding: 0 10px; font-size: 12.5px; }
.x, .ib { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff; }
.x:hover, .ib:hover { background: rgba(255,255,255,.14); }
.res { background: rgba(12,28,44,.96); }
.facts { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; row-gap: 0; }
.facts div { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 8px 2px; border-radius: 0; background: none; border-bottom: 1px solid rgba(255,255,255,.08); }
.facts dt { flex: none; font-size: 12px; font-weight: 600; letter-spacing: .02em; text-transform: none; color: #E3C98A; }
.facts dd { margin: 0; text-align: right; font-weight: 700; color: #fff; min-width: 0; }
@media (max-width: 640px) { .facts { grid-template-columns: 1fr; } }
/* 17.0.5 patch 146: scrollbars like the app's tables (dark track, gold thumb); the app's own rules cannot reach inside this window */
.ov, .mid, .rt, .res, .ov * { scrollbar-width: thin; scrollbar-color: rgba(227,201,138,.75) rgba(255,255,255,.06); }
::-webkit-scrollbar { width: 10px; height: 10px; background: rgba(255,255,255,.06); }
::-webkit-scrollbar-thumb { background: rgba(227,201,138,.75); border-radius: 99px; border: 2px solid rgba(12,24,40,.8); }
::-webkit-scrollbar-corner { background: transparent; }
.cfm { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(4,12,22,.36); }
.cfmbox { width: min(420px, 100%); padding: 18px 20px 16px; border-radius: 16px; border: 1px solid rgba(227,201,138,.4); background: linear-gradient(160deg, rgba(20,44,68,.82), rgba(8,18,30,.9)); backdrop-filter: blur(16px) saturate(1.4); -webkit-backdrop-filter: blur(16px) saturate(1.4); box-shadow: 0 24px 60px rgba(0,0,0,.5); color: #F3EAD3; }
.cfmbox b { font-size: 16px; color: #fff; }
.cfmbox p { margin: 8px 0 16px; color: var(--soft); }
.cfmacts { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.x.mn { font-size: 22px; }
.rt tr.short td { background: rgba(252,211,77,.08); }
.rt tr.short td:first-child { box-shadow: inset 3px 0 0 #F5B544; }
.rt tr.shortmsg td { padding: 0 8px 8px; background: rgba(252,211,77,.08); border-bottom: 1px solid rgba(252,211,77,.3); }
.rt tr.shortmsg div { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: #F5D78A; font-size: 12.5px; }
.rt tr.shortmsg span:first-child { flex: 1 1 280px; } .rt tr.shortmsg b { color: #fff; }
.rt tr.shortmsg .acts { display: flex; gap: 6px; }
.kick.warn { border-color: rgba(252,211,77,.5); } .kick.warn b { color: #F5B544; }
`;
})();
