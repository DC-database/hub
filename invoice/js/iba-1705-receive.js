/* 17.0.5 patch 175: Receive a delivery by scan (phones and tablets only).
   The receiver scans the barcode on the transfer paper (approval ESN) or types
   the TRF number / ESN. Reads ONLY the lines that are "In Transit" (indexed
   query on remarks), picks the scanned transfer, then the receiver swipes each
   line: right = arrived, left = none came, tap = type how many came.
   Confirm adds only what arrived to the destination site. Missing qty:
   "not loaded" goes back to the source site, "damaged / lost" does not.
   Same stock routine (runStockTransaction) and save (commitUpdate) as the PC. */
(function () {
    'use strict';
    const ID = 'iba-rcv';
    const MQ = '(pointer: coarse)';
    let st = null;          // current screen state
    let stream = null, scanTimer = 0, detector = null;
    let transitCache = null; // { at, list }

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    const fmt = (n) => (Math.round(n * 1000) / 1000).toLocaleString('en-US');

    function touch() { try { return !!(window.matchMedia && window.matchMedia(MQ).matches); } catch (_) { return false; } }
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null; } catch (_) { return null; } }
    function myName() { const a = me(); return a ? String(a.Name || '').trim() : ''; }
    function superName() { try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) return String(SUPER_ADMIN_NAME); } catch (_) {} return 'Irwin'; }
    function isSuper() { const n = myName(); return !!n && norm(n) === norm(superName()); }
    function db() {
        try { if (typeof inventoryDb !== 'undefined' && inventoryDb) return inventoryDb; } catch (_) {}
        return (typeof getInventoryDatabase === 'function') ? getInventoryDatabase() : null;
    }
    function ctrlOf(t) { return String(t.controlNumber || t.controlId || t.ref || '').trim(); }
    function nameOf(t) { return String(t.productName || t.vendorName || t.productID || t.productId || 'Item').trim(); }
    function sentOf(t) { return num(t.approvedQty != null && t.approvedQty !== '' ? t.approvedQty : t.orderedQty); }
    function site(s) { s = String(s || '').trim(); return /^\d+$/.test(s) ? 'Site ' + s : s; }
    function fromOf(t) { return String(t.fromLocation || t.fromSite || '').trim(); }
    function toOf(t) { return String(t.toLocation || t.toSite || '').trim(); }
    function receiverOf(t) { return String(t.receiver || t.attention || '').trim(); }
    function typeOf(t) { return String(t.jobType || t.for || 'Transfer').trim(); }
    // "ABC123DEF456/NAME/HLW" -> "ABC123DEF456"; "trf 0415" -> "TRF0415"
    function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
    function esnBase(s) { return key(String(s || '').split('/')[0]); }

    // ---------------------------------------------------------------- data
    async function inTransit(force) {
        if (!force && transitCache && Date.now() - transitCache.at < 60000) return transitCache.list;
        const d = db();
        if (!d) throw new Error('Inventory is not ready yet. Try again in a moment.');
        const snap = await d.ref('transfer_entries').orderByChild('remarks').equalTo('In Transit').once('value');
        const list = [];
        snap.forEach((c) => { const v = c.val(); if (v && typeof v === 'object') list.push(Object.assign({}, v, { key: c.key })); });
        transitCache = { at: Date.now(), list: list };
        return list;
    }
    function matches(t, code) {
        const k = key(code), b = esnBase(code);
        if (!k) return false;
        const c = key(ctrlOf(t));
        if (c && (c === k || c.replace(/^[A-Z]+/, '') === k.replace(/^[A-Z]+/, '') && /\d/.test(k))) return true;
        return !!t.esn && esnBase(t.esn) === b && b.length >= 6;
    }
    // older, already finished transfer: one small indexed read by control number
    async function lookupDone(code) {
        const d = db();
        const raw = String(code || '').trim().toUpperCase();
        const tries = [raw];
        const m = raw.match(/^([A-Z]+)[\s-]*(\d+)$/);
        if (m) tries.push(m[1] + '-' + m[2]);
        for (const c of Array.from(new Set(tries))) {
            try {
                const s = await d.ref('transfer_entries').orderByChild('controlNumber').equalTo(c).once('value');
                if (s.exists()) { const out = []; s.forEach((x) => { out.push(Object.assign({}, x.val(), { key: x.key })); }); return out; }
            } catch (_) {}
        }
        return [];
    }

    // ---------------------------------------------------------------- shell
    function root() {
        let r = document.getElementById(ID);
        const host = document.getElementById('iba-phone') || document.body; // inside the phone: same background photo
        if (r) { if (r.parentNode !== host) host.appendChild(r); return r; }
        r = document.createElement('div');
        r.id = ID;
        r.setAttribute('role', 'dialog');
        r.setAttribute('aria-modal', 'true');
        r.innerHTML = '<div class="rcv-top"><button type="button" class="rcv-x" data-rcv="close" aria-label="Close">‹ Back</button><b>Receive a delivery</b></div><div class="rcv-body" id="iba-rcv-body"></div><div class="rcv-foot" id="iba-rcv-foot"></div><div class="rcv-sheet" id="iba-rcv-sheet" hidden></div>';
        host.appendChild(r);
        r.addEventListener('click', onClick);
        r.addEventListener('pointerdown', onDown);
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'iba-rcv-code') { e.preventDefault(); find(e.target.value); } });
        return r;
    }
    function body(h) { const b = document.getElementById('iba-rcv-body'); if (b) b.innerHTML = h; }
    function foot(h) { const f = document.getElementById('iba-rcv-foot'); if (f) { f.innerHTML = h || ''; f.hidden = !h; } }
    function sheet(h) { const s = document.getElementById('iba-rcv-sheet'); if (!s) return; s.innerHTML = h ? '<div class="rcv-dim" data-rcv="sheet-x"></div><div class="rcv-sbox">' + h + '</div>' : ''; s.hidden = !h; }

    function open(code) {
        if (!myName()) return;
        root().classList.add('is-on');
        document.body.classList.add('iba-rcv-open');
        if (code) { find(code); return; }
        showScan();
    }
    function close() {
        stopCam();
        const r = document.getElementById(ID);
        if (r) r.classList.remove('is-on');
        document.body.classList.remove('iba-rcv-open');
        st = null;
    }

    // ---------------------------------------------------------------- scan
    function camOk() { return !!(window.BarcodeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
    function showScan(msg) {
        st = { view: 'scan' };
        sheet('');
        foot('');
        const cam = camOk();
        body(
            (cam ? '<div class="rcv-cam"><video id="iba-rcv-video" playsinline muted></video><div class="rcv-frame"></div><div class="rcv-laser"></div><div class="rcv-camtip" id="iba-rcv-camtip">Point at the barcode on the transfer paper</div></div>'
                 : '<div class="rcv-glass rcv-nocam"><i class="fa-solid fa-barcode"></i><b>Type the number</b><span>This browser can\'t scan (iPhone or old browser). Type the TRF number or the code under the barcode.</span></div>') +
            (msg ? '<div class="rcv-msg">' + esc(msg) + '</div>' : '') +
            '<div class="rcv-type"><input id="iba-rcv-code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" placeholder="TRF number or barcode code" enterkeyhint="search"><button type="button" class="rcv-btn" data-rcv="find">Find</button></div>' +
            (cam ? '<div class="rcv-row"><button type="button" class="rcv-pill" data-rcv="torch" id="iba-rcv-torch" hidden><i class="fa-solid fa-lightbulb"></i> Torch</button></div>' : '') +
            '<p class="rcv-small">Only the receiver named on the transfer (or Super Admin) can receive it.</p>');
        if (cam) startCam(); else setTimeout(() => { const i = document.getElementById('iba-rcv-code'); if (i) i.focus(); }, 50);
    }
    async function startCam() {
        stopCam();
        const v = document.getElementById('iba-rcv-video');
        if (!v) return;
        try {
            if (!detector) {
                let fm = ['code_128', 'qr_code', 'code_39', 'ean_13', 'data_matrix'];
                try { const sup = await window.BarcodeDetector.getSupportedFormats(); if (sup && sup.length) fm = fm.filter((f) => sup.indexOf(f) !== -1); } catch (_) {}
                detector = new window.BarcodeDetector(fm.length ? { formats: fm } : undefined);
            }
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            if (!st || st.view !== 'scan') { stopCam(); return; }
            v.srcObject = stream;
            await v.play().catch(() => {});
            try {
                const tr = stream.getVideoTracks()[0];
                const caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
                const tb = document.getElementById('iba-rcv-torch');
                if (tb && caps && caps.torch) tb.hidden = false;
            } catch (_) {}
            const tick = async () => {
                if (!stream || !st || st.view !== 'scan') return;
                try {
                    if (v.readyState >= 2) {
                        const got = await detector.detect(v);
                        const val = got && got[0] && String(got[0].rawValue || '').trim();
                        if (val) { try { navigator.vibrate && navigator.vibrate(60); } catch (_) {} stopCam(); find(val); return; }
                    }
                } catch (_) {}
                scanTimer = setTimeout(tick, 220);
            };
            tick();
        } catch (e) {
            const tip = document.getElementById('iba-rcv-camtip');
            if (tip) tip.textContent = 'Camera not allowed. Type the number below.';
        }
    }
    function stopCam() {
        clearTimeout(scanTimer); scanTimer = 0;
        if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {} stream = null; }
    }
    async function torch() {
        try {
            const tr = stream && stream.getVideoTracks()[0];
            if (!tr) return;
            const on = !(st && st.torch);
            await tr.applyConstraints({ advanced: [{ torch: on }] });
            st.torch = on;
            const b = document.getElementById('iba-rcv-torch'); if (b) b.classList.toggle('is-on', on);
        } catch (_) {}
    }

    // ---------------------------------------------------------------- find
    async function find(code) {
        code = String(code || '').trim();
        if (!code) { const i = document.getElementById('iba-rcv-code'); if (i) i.focus(); return; }
        stopCam();
        st = { view: 'busy' };
        foot('');
        body('<div class="rcv-glass rcv-wait"><i class="fa-solid fa-spinner fa-spin"></i> Looking for ' + esc(code) + '…</div>');
        try {
            let list = await inTransit(false);
            let hit = list.find((t) => matches(t, code));
            if (!hit) { list = await inTransit(true); hit = list.find((t) => matches(t, code)); }
            if (!hit) {
                const done = await lookupDone(code);
                if (done.length) {
                    const c = done.find((t) => /completed/i.test(t.remarks || '')) || done[0];
                    const when = c.receivedAt ? new Date(c.receivedAt) : null;
                    const by = c.receivedBy || '';
                    const txt = /completed/i.test(c.remarks || '')
                        ? 'Already received' + (by ? ' by ' + by : '') + (when ? ' on ' + when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '') + '.'
                        : 'This transfer is not on the way yet (now: ' + (c.remarks || c.status || '?') + ').';
                    return showStop(ctrlOf(c) || code, txt, '');
                }
                return showScan('Nothing on the way matches "' + code + '". Check the number and try again.');
            }
            const ctrl = ctrlOf(hit);
            const lines = ctrl ? list.filter((t) => ctrlOf(t) === ctrl) : [hit];
            const rcv = receiverOf(hit);
            const mine = lines.filter((t) => norm(receiverOf(t)) === norm(myName()));
            if (!isSuper() && !mine.length) {
                return showStop(ctrl || code, 'This delivery is for ' + (rcv || 'someone else') + (toOf(hit) ? ' · ' + site(toOf(hit)) : '') + '.', 'Only ' + (rcv || 'the receiver') + ' or Super Admin can receive it.');
            }
            showList(ctrl || code, isSuper() ? lines : mine);
        } catch (e) {
            showScan((e && e.message) || 'Could not read the delivery. Check the connection and try again.');
        }
    }
    function showStop(ctrl, line1, line2) {
        st = { view: 'stop' };
        foot('');
        body('<div class="rcv-glass rcv-stop"><div class="rcv-ic">!</div><b class="rcv-c">' + esc(ctrl) + '</b><b>' + esc(line1) + '</b>' + (line2 ? '<span>' + esc(line2) + '</span>' : '') +
            '<button type="button" class="rcv-btn rcv-wide" data-rcv="again">Scan another</button></div>');
    }

    // ---------------------------------------------------------------- list
    function showList(ctrl, lines) {
        st = { view: 'list', ctrl: ctrl, lines: lines.map((t) => ({ t: t, sent: sentOf(t), got: null })), edit: -1 };
        paintList();
    }
    function paintList() {
        const L = st.lines, f = L[0].t;
        const checked = L.filter((x) => x.got != null).length;
        const rows = L.map((x, i) => {
            const cls = x.got == null ? '' : (x.got >= x.sent ? 'is-ok' : (x.got > 0 ? 'is-part' : 'is-no'));
            const q = x.got == null ? fmt(x.sent) : (x.got >= x.sent ? fmt(x.sent) : fmt(x.got) + ' / ' + fmt(x.sent));
            let h = '<div class="rcv-sw ' + cls + '" data-i="' + i + '"><div class="rcv-bg rcv-bg-ok">✓ Arrived</div><div class="rcv-bg rcv-bg-no">None came ✕</div>' +
                '<div class="rcv-fg"><span class="rcv-sn">' + (i + 1) + '</span><span class="rcv-nm">' + esc(nameOf(x.t)) + '</span><span class="rcv-q">' + q + '</span></div></div>';
            if (st.edit === i) {
                h += '<div class="rcv-qbox"><span>How many arrived?</span><div class="rcv-qr"><input id="iba-rcv-qty" type="number" inputmode="decimal" min="0" max="' + x.sent + '" step="any" value="' + (x.got == null ? '' : x.got) + '"><span class="rcv-of">of ' + fmt(x.sent) + '</span></div>' +
                    '<div class="rcv-chips"><button type="button" data-rcv="q-none">None came</button><button type="button" data-rcv="q-all">All ' + fmt(x.sent) + '</button><button type="button" class="is-ok" data-rcv="q-save">Save</button></div><div class="rcv-qerr" id="iba-rcv-qerr"></div></div>';
            }
            return h;
        }).join('');
        body('<div class="rcv-glass rcv-head"><div class="rcv-r"><b class="rcv-c">' + esc(st.ctrl) + '</b><span>' + esc(site(fromOf(f)) || '?') + ' → ' + esc(site(toOf(f)) || '?') + '</span></div>' +
            '<div class="rcv-r"><span><b>' + L.length + ' item' + (L.length === 1 ? '' : 's') + '</b> · ' + checked + ' checked</span><button type="button" class="rcv-all" data-rcv="all">✓ Receive all</button></div>' +
            '<div class="rcv-bar"><i style="width:' + Math.round(checked * 100 / L.length) + '%"></i></div></div>' +
            '<div class="rcv-glass rcv-list">' + rows + '</div>' +
            '<p class="rcv-small">Swipe right = arrived · swipe left = none came · tap = type how many came</p>');
        const full = L.filter((x) => x.got != null && x.got >= x.sent).length;
        const part = L.filter((x) => x.got != null && x.got > 0 && x.got < x.sent).length;
        const none = L.filter((x) => x.got === 0).length;
        const left = L.length - checked;
        const sumTxt = checked ? 'Received <b>' + full + ' full' + (part ? ' · ' + part + ' short' : '') + (none ? ' · ' + none + ' missing' : '') + '</b>' : '<b>Nothing checked yet</b>';
        foot('<div class="rcv-sum"><span>' + sumTxt + '</span><span>' + (left ? left + ' left' : 'all checked') + '</span></div>' +
            '<button type="button" class="rcv-big" data-rcv="confirm">Confirm receipt</button>');
        if (st.edit >= 0) setTimeout(() => { const i = document.getElementById('iba-rcv-qty'); if (i) { i.focus(); i.select(); } }, 30);
    }
    function setGot(i, v) { const x = st.lines[i]; if (!x) return; x.got = v == null ? null : Math.max(0, Math.min(x.sent, v)); }

    // swipe: pointer on a row's foreground
    let drag = null;
    function onDown(e) {
        const fg = e.target && e.target.closest && e.target.closest('#' + ID + ' .rcv-fg');
        if (!fg || !st || st.view !== 'list') return;
        const row = fg.parentNode;
        drag = { row: row, fg: fg, x0: e.clientX, y0: e.clientY, dx: 0, moved: false, i: Number(row.getAttribute('data-i')) };
        const move = (ev) => {
            if (!drag) return;
            const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
            if (!drag.moved && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { end(null); return; } // scrolling
            if (Math.abs(dx) > 6) drag.moved = true;
            if (!drag.moved) return;
            ev.preventDefault();
            drag.dx = dx;
            drag.fg.style.transform = 'translateX(' + dx + 'px)';
            drag.row.classList.toggle('to-ok', dx > 0);
            drag.row.classList.toggle('to-no', dx < 0);
        };
        const end = (ev) => {
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', end);
            document.removeEventListener('pointercancel', end);
            const d = drag; drag = null;
            if (!d) return;
            d.fg.style.transform = '';
            if (!ev) return;
            if (!d.moved) { st.edit = st.edit === d.i ? -1 : d.i; paintList(); return; }
            const w = d.row.offsetWidth || 300;
            if (d.dx > Math.min(90, w * 0.28)) { setGot(d.i, st.lines[d.i].sent); if (st.edit === d.i) st.edit = -1; paintList(); }
            else if (d.dx < -Math.min(90, w * 0.28)) { setGot(d.i, 0); if (st.edit === d.i) st.edit = -1; paintList(); }
            else d.row.classList.remove('to-ok', 'to-no');
        };
        document.addEventListener('pointermove', move, { passive: false });
        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);
    }

    function saveQty(v) {
        const i = st.edit, x = st.lines[i];
        if (!x) return;
        if (v == null) {
            const inp = document.getElementById('iba-rcv-qty');
            const raw = inp ? String(inp.value).trim() : '';
            const n = parseFloat(raw);
            const err = document.getElementById('iba-rcv-qerr');
            if (raw === '' || !isFinite(n) || n < 0) { if (err) err.textContent = 'Type a number (0 if none came).'; return; }
            if (n > x.sent) { if (err) err.textContent = 'Only ' + fmt(x.sent) + ' were sent. Type up to ' + fmt(x.sent) + '.'; return; }
            v = n;
        }
        setGot(i, v);
        st.edit = -1;
        paintList();
    }

    // ---------------------------------------------------------------- confirm
    function confirmStart() {
        const L = st.lines;
        const left = L.filter((x) => x.got == null);
        if (left.length) {
            sheet('<h3>' + left.length + ' item' + (left.length === 1 ? '' : 's') + ' not checked yet</h3><p class="rcv-small">' + left.map((x) => esc(nameOf(x.t))).join(', ') + '</p>' +
                '<button type="button" class="rcv-big" data-rcv="left-ok">Yes, they all arrived</button><button type="button" class="rcv-ghost" data-rcv="sheet-x">Go back and check</button>');
            return;
        }
        const short = L.filter((x) => x.got < x.sent);
        if (!short.length) return save('');
        st.reason = st.reason || 'notloaded';
        const src = site(fromOf(short[0].t)) || 'the source';
        const restock = short.every((x) => /restock/i.test(typeOf(x.t)));
        const got = L.reduce((a, x) => a + x.got, 0);
        sheet('<h3>' + short.length + ' item' + (short.length === 1 ? '' : 's') + ' came short</h3>' +
            short.map((x) => '<div class="rcv-mis"><span>' + esc(nameOf(x.t)) + '</span><b>' + fmt(x.sent - x.got) + '</b></div>').join('') +
            (restock ? '' :
            '<button type="button" class="rcv-opt' + (st.reason === 'notloaded' ? ' is-on' : '') + '" data-rcv="r-notloaded"><span class="rcv-rd"></span><span><b>Not loaded — still at ' + esc(src) + '</b><small>Goes back into ' + esc(src) + ' stock.</small></span></button>') +
            '<button type="button" class="rcv-opt' + (st.reason === 'lost' || restock ? ' is-on' : '') + '" data-rcv="r-lost"><span class="rcv-rd"></span><span><b>Damaged / lost on the way</b><small>Does not go back. Marked for Super Admin.</small></span></button>' +
            '<button type="button" class="rcv-big" data-rcv="save">Confirm · save ' + fmt(got) + ' received</button>' +
            '<button type="button" class="rcv-ghost" data-rcv="sheet-x">Go back</button>');
        if (restock) st.reason = 'lost';
    }
    function esnCode(n, m) {
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', D = '0123456789';
        let r = '';
        for (let i = 0; i < n; i++) r += A.charAt(Math.floor(Math.random() * A.length));
        for (let i = 0; i < m; i++) r += D.charAt(Math.floor(Math.random() * D.length));
        return r.split('').sort(() => 0.5 - Math.random()).join('');
    }
    async function save() {
        const L = st.lines, reason = st.reason || 'notloaded';
        sheet('<div class="rcv-wait"><i class="fa-solid fa-spinner fa-spin"></i> Saving…</div>');
        const d = db();
        const who = myName();
        const clean = who.replace(/Engr\.?\s*/gi, '').trim().toUpperCase().split(' ')[0];
        const today = new Date();
        const ymd = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const done = [];
        for (const x of L) {
            if (x.saved) { done.push(x); continue; }
            const t = x.t, k = t.key;
            try {
                // fresh read of this one line: still In Transit?
                const snap = await d.ref('transfer_entries/' + k).once('value');
                const now = snap.val();
                if (!now || now.remarks !== 'In Transit') { x.skip = 'already ' + (now ? (now.remarks || now.status) : 'removed'); done.push(x); continue; }
                const pID = now.productID || now.productId;
                const dest = toOf(now), src = fromOf(now);
                if (!pID || !dest) throw new Error(nameOf(now) + ': missing product or destination site.');
                const sent = sentOf(now), got = x.got, miss = Math.max(0, sent - got);
                const back = miss > 0 && reason === 'notloaded' && !/restock/i.test(typeOf(now)) && !!src;
                if (got > 0) await runStockTransaction(pID, got, 'Add', dest);
                if (back) await runStockTransaction(pID, miss, 'Add', src);
                const up = {
                    status: 'Completed', remarks: 'Completed', attention: 'Records',
                    receivedQty: got, arrivalDate: ymd, receiverEsn: esnCode(4, 4) + '/' + clean,
                    receivedBy: who, receivedAt: Date.now(), receivedVia: 'scan',
                    dateResponded: today.toLocaleDateString('en-GB')
                };
                let note = 'Received ' + fmt(got) + ' of ' + fmt(sent) + ' by ' + who;
                if (miss > 0) {
                    up.shortQty = miss;
                    up.shortReason = back ? 'Not loaded - back to source' : 'Damaged or lost on the way';
                    if (back) { up.returnedToSource = miss; note += ' · ' + fmt(miss) + ' not loaded, back to ' + site(src); }
                    else { up.lossFlag = true; up.lossFlagFor = superName(); note += ' · ' + fmt(miss) + ' damaged/lost on the way'; }
                }
                up.note = note;
                await commitUpdate(d, k, up, note, { keepModalOpen: true, deferRefresh: true });
                x.saved = true; x.back = back ? miss : 0; x.lost = !back ? miss : 0; x.src = site(src);
                done.push(x);
            } catch (e) {
                console.warn('[receive]', e);
                const ok = L.filter((y) => y.saved).length;
                sheet('<h3>Stopped at ' + esc(nameOf(t)) + '</h3><p class="rcv-small">' + esc((e && e.message) || 'Save failed.') + '</p>' +
                    (ok ? '<p class="rcv-small">' + ok + ' item' + (ok === 1 ? ' was' : 's were') + ' already saved and will not be saved twice.</p>' : '') +
                    '<button type="button" class="rcv-big" data-rcv="save">Try again</button><button type="button" class="rcv-ghost" data-rcv="sheet-x">Go back</button>');
                return;
            }
        }
        transitCache = null;
        try { window.dispatchEvent(new CustomEvent('iba-transfer-received', { detail: { control: st.ctrl } })); } catch (_) {}
        try { if (typeof window.ibaPhoneRefresh === 'function') window.ibaPhoneRefresh(); } catch (_) {}
        showDone(done);
    }
    function showDone(done) {
        sheet('');
        const got = done.reduce((a, x) => a + (x.saved ? x.got : 0), 0);
        const sent = done.reduce((a, x) => a + (x.saved ? x.sent : 0), 0);
        const back = done.reduce((a, x) => a + (x.back || 0), 0);
        const src = (done.find((x) => x.back) || {}).src || '';
        st = { view: 'done' };
        body('<div class="rcv-glass rcv-done"><div class="rcv-tick">✓</div><b class="rcv-dt">' + esc(document.getElementById('iba-rcv-body') ? (done[0] ? ctrlOf(done[0].t) : '') : '') + ' received</b><span>' + fmt(got) + ' of ' + fmt(sent) + (back ? ' · ' + fmt(back) + ' back to ' + esc(src) : '') + '</span></div>' +
            '<div class="rcv-glass rcv-list">' + done.map((x, i) => {
                const sub = x.skip ? 'not saved: ' + esc(x.skip) : fmt(x.got) + ' of ' + fmt(x.sent) + (x.back ? ' · <em>' + fmt(x.back) + ' back to ' + esc(x.src) + '</em>' : '') + (x.lost ? ' · <em class="rcv-red">' + fmt(x.lost) + ' damaged/lost</em>' : '');
                return '<div class="rcv-fg rcv-static"><span class="rcv-sn">' + (i + 1) + '</span><span class="rcv-nm">' + esc(nameOf(x.t)) + '<small>' + sub + '</small></span><span class="rcv-q ' + (x.got > 0 && !x.skip ? 'rcv-plus' : '') + '">' + (x.skip ? '–' : (x.got > 0 ? '+' + fmt(x.got) : '0')) + '</span></div>';
            }).join('') + '</div>');
        foot('<button type="button" class="rcv-big" data-rcv="again">Scan next delivery</button>');
    }

    // ---------------------------------------------------------------- clicks
    function onClick(e) {
        const b = e.target && e.target.closest && e.target.closest('[data-rcv]');
        if (!b) return;
        const a = b.getAttribute('data-rcv');
        if (a === 'close') return close();
        if (a === 'find') { const i = document.getElementById('iba-rcv-code'); return find(i ? i.value : ''); }
        if (a === 'again') return showScan();
        if (a === 'torch') return torch();
        if (a === 'sheet-x') return sheet('');
        if (!st || !st.lines) return;
        if (a === 'all') { st.lines.forEach((x) => { x.got = x.sent; }); st.edit = -1; return paintList(); }
        if (a === 'q-none') return saveQty(0);
        if (a === 'q-all') return saveQty(st.lines[st.edit] ? st.lines[st.edit].sent : null);
        if (a === 'q-save') return saveQty(null);
        if (a === 'confirm') return confirmStart();
        if (a === 'left-ok') { st.lines.forEach((x) => { if (x.got == null) x.got = x.sent; }); sheet(''); paintList(); return confirmStart(); }
        if (a === 'r-notloaded' || a === 'r-lost') { st.reason = a === 'r-lost' ? 'lost' : 'notloaded'; return confirmStart(); }
        if (a === 'save') return save();
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && e.target.id === 'iba-rcv-qty') { e.preventDefault(); saveQty(null); }
        if (e.key === 'Escape' && document.body.classList.contains('iba-rcv-open')) { const s = document.getElementById('iba-rcv-sheet'); if (s && !s.hidden) sheet(''); else close(); }
    });

    window.ibaReceive = { open: open, close: close, available: () => touch() && !!myName(), _test: { matches: matches, find: find } };
})();
