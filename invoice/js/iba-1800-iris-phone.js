/* 18.0.0 patch 41 (martin): IRIS on the phone, Super Admin only. Own full-screen page: the orb, the
   conversation, a big mic button and a keyboard. Everything runs ON THE PHONE (same Firebase data), no office PC.
   - "PO 12345" / "look for PO 12345" -> reads ONLY invoice_entries/12345 (never the full list: the phone has no
     saved copy and the 10 GB limit matters). Says the invoices, then "What do you want to do?"
   - "What can you do?" -> numbered menu: 1 change a status, 2 WhatsApp reminder, 3 pending invoices, 4 note for the PC.
   - Picks invoices by "the biggest / smallest / newest / oldest / first / second / 884 / the SRV done one / both".
   - For Approval without a name -> "To whom?". Always "yes or no?" before anything is saved.
     Marking an invoice that has no SRV yet For Approval -> warns once.
   - WhatsApp: the message opens already written, the person presses Send (IRIS never sends by herself).
   - Paid and With Accounts invoices are never offered for a change.
   - Anything else: her built-in answers (time, maths, jokes, small talk) via ibaTalk.answer. */
(function () {
    'use strict';
    if (window.ibaIrisPhone) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const phone = () => !!(document.body && document.body.classList.contains('iba-mobile-ui'));
    const isSuper = () => {
        if (document.body && document.body.classList.contains('iba-is-super-admin')) return true;
        let sn = 'Irwin'; try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) sn = String(SUPER_ADMIN_NAME); } catch (_) {}
        const n = me(); return !!n && norm(n) === norm(sn);
    };
    const me = () => { try { return (typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) ? String(currentApprover.Name).trim() : ''; } catch (_) { return ''; } };
    const first = () => me().split(/\s+/)[0] || '';
    const idb = () => { try { return (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } };
    const mdb = () => { try { return (typeof db !== 'undefined' && db && db.ref) ? db : (firebase.apps && firebase.apps[0] ? firebase.app().database() : null); } catch (_) { return null; } };
    const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
    const money = (v) => { const n = num(v); return n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'; };
    const remSafe = (s) => String(s || '').replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_');

    const SET = { 'for approval': 'For Approval', 'for srv': 'For SRV', 'in process': 'In Process' };
    const CLOSED = /^(?:paid|with accounts|cancelled|canceled|closed|void)$/i;
    const WAKE = /^\s*(?:(?:hi|hey|hello|ok|okay)[\s,.!]+){0,2}(?:iris|irish|ires|aris|iriz|eye ?ris)?\b[\s,.:!?-]*/i;

    let ctx = null;          // { po, vendor, site, invs: [{key, no, amount, status, attention, date}] }
    let pend = null;         // what she is waiting for
    let rec = null, listening = false, auto = false, speaking = false;
    // patch 44 (martin): hands-free. While her page is open and the screen is on she keeps listening, and answers only
    // "Iris …" or "Hi … please" (so other voices in the room are ignored), plus a short reply right after she asked something.
    const HF_KEY = 'iba-irisph-hf-v1';
    let hf = false, followUntil = 0;
    try { hf = localStorage.getItem(HF_KEY) === '1'; } catch (_) {}
    const IDLE = () => (hf ? 'Hands-free: say “Iris …” or “Hi … please”' : 'Tap the mic and talk');

    // ---------- people ----------
    function people() {
        try {
            const map = (typeof ibaApproverMap === 'function') ? (ibaApproverMap() || {}) : ((typeof allApproverData !== 'undefined' && allApproverData) || {});
            const out = [], seen = new Set();
            Object.values(map).forEach((a) => {
                const n = a && String(a.Name || '').trim();
                if (!n || seen.has(norm(n))) return; seen.add(norm(n));
                out.push({ name: n, pos: String(a.Position || '').trim(), mobile: String(a.Mobile || a.mobile || '').replace(/\D/g, '') });
            });
            return out;
        } catch (_) { return []; }
    }
    function findPeople(text) {
        const t = norm(text).replace(/\b(?:to|for|send|give|it|him|her|please|the|mark|attention|of|mr|ms|sir)\b/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return [];
        const ps = people();
        const exact = ps.filter((p) => norm(p.name) === t);
        if (exact.length) return exact;
        const words = t.split(' ').filter((w) => w.length > 1);
        return ps.filter((p) => { const n = norm(p.name); const nw = n.split(' '); return words.some((w) => nw.some((x) => x === w || (w.length >= 4 && x.startsWith(w)))); }).slice(0, 4);
    }
    // the names that match the most words of what was said ("Imran Khan" beats "Imran Ali")
    function bestNames(text, list) {
        const tw = norm(text).split(' ');
        const sc = list.map((x) => ({ x, n: norm(x.name).split(' ').filter((w) => w.length > 1 && tw.includes(w)).length }));
        const top = Math.max(0, ...sc.map((y) => y.n));
        return top ? sc.filter((y) => y.n === top).map((y) => y.x) : [];
    }
    function awayOf(name) { try { return window.ibaAwayGuard && window.ibaAwayGuard.awayOf ? window.ibaAwayGuard.awayOf(name) : null; } catch (_) { return null; } }

    // ---------- the page ----------
    function build() {
        let w = $('iba-irisph');
        if (w) return w;
        w = document.createElement('div');
        w.id = 'iba-irisph'; w.hidden = true;
        w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'IRIS');
        w.innerHTML = '<div class="iph-top"><b>IRIS</b><span class="iph-chip">Super Admin</span><button type="button" class="iph-x iph-i iph-g" data-iph-set aria-label="Voice settings"><i class="fa-solid fa-gear"></i></button><button type="button" class="iph-x" data-iph-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="iph-orb"><canvas width="380" height="380"></canvas><div class="iph-st" data-iph-st>Tap the mic and talk</div></div>' +
            '<div class="iph-log" data-iph-log></div>' +
            '<form class="iph-type" data-iph-form hidden><input type="text" data-iph-in placeholder="Type to IRIS…" autocomplete="off" enterkeyhint="send"><button type="submit" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></form>' +
            '<div class="iph-bar"><button type="button" class="iph-sm" data-iph-kb aria-label="Keyboard"><i class="fa-solid fa-keyboard"></i></button>' +
            '<button type="button" class="iph-mic" data-iph-mic aria-label="Talk"><i class="fa-solid fa-microphone"></i></button>' +
            '<button type="button" class="iph-sm" data-iph-menu aria-label="What can you do?"><i class="fa-solid fa-list-ol"></i></button>' +
            '<button type="button" class="iph-sm iph-hf" data-iph-hf aria-label="Hands-free"><i class="fa-solid fa-ear-listen"></i><span>Hands-free</span></button></div>';
        document.body.appendChild(w);
        w.addEventListener('click', (e) => {
            if (e.target.closest('[data-iph-x]')) return close();
            if (e.target.closest('[data-iph-mic]')) return listening && !hfWait() ? stopListen() : (stopListen(), listen('tap'));
            if (e.target.closest('[data-iph-hf]')) return setHf(!hf);
            if (e.target.closest('[data-iph-set]')) return showSet(true);
            if (e.target.closest('[data-iph-set-x]')) return showSet(false);
            if (e.target.closest('[data-iph-kplay]')) { const K = window.ibaKokoro; if (K) { try { K.unlock(); } catch (_) {} if (!K.cfg().on) { K.setCfg({ on: true }); paintSet(); } K.sample(); } return; }
            if (e.target.closest('[data-iph-vplay]')) { const was = window.ibaKokoro && window.ibaKokoro.cfg().on; if (was) window.ibaKokoro.setCfg({ on: false }); speak('Hi, I am Iris. P O 12345 has 2 invoices waiting for approval.', false); if (was) setTimeout(() => window.ibaKokoro.setCfg({ on: true }), 50); return; }
            if (e.target.closest('[data-iph-kb]')) { const f = w.querySelector('[data-iph-form]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); return; }
            if (e.target.closest('[data-iph-menu]')) return handle('what can you do');
            const opt = e.target.closest('[data-iph-say]'); if (opt) return handle(opt.getAttribute('data-iph-say'));
            const wa = e.target.closest('[data-iph-wa]'); if (wa) { try { window.open(wa.getAttribute('data-iph-wa'), '_blank', 'noopener'); } catch (_) {} return; }
        });
        w.querySelector('[data-iph-form]').addEventListener('submit', (e) => { e.preventDefault(); const i = w.querySelector('[data-iph-in]'); const t = i.value.trim(); i.value = ''; if (t) { stopListen(); handle(t); } });
        w.addEventListener('change', (e) => {
            const t = e.target, K = window.ibaKokoro;
            if (t.id === 'iph-kok-on' && K) { K.setCfg({ on: t.checked }); if (t.checked) { try { K.unlock(); } catch (_) {} K.load(true); } else K.stop(); paintSet(); }
            else if (t.id === 'iph-kok-voice' && K) K.setCfg({ voice: t.value });
            else if (t.id === 'iph-kok-speed' && K) K.setCfg({ speed: Number(t.value) || 1 });
            else if (t.id === 'iph-sys-voice') { try { localStorage.setItem(VOICE_KEY, t.value); } catch (_) {} }
        });
        orbStart(w.querySelector('canvas'));
        paintHf();
        return w;
    }
    function open() {
        if (!isSuper()) return;
        const w = build(); w.hidden = false; document.body.classList.add('iba-irisph-on');
        try { const K = window.ibaKokoro; if (K && K.wanted()) K.load(); } catch (_) {}
        const log = w.querySelector('[data-iph-log]');
        if (!log.children.length) irisSay('Hi' + (first() ? ' ' + first() : '') + '! Tell me a PO number, or ask what I can do.', { opts: ['What can you do?'] });
        else if (hf) setTimeout(() => listen('hf'), 400);
    }
    function close() { if (window.IBA_IRIS_APP && isSuper()) return; stopListen(); auto = false; try { speechSynthesis.cancel(); } catch (_) {} try { if (window.ibaKokoro) window.ibaKokoro.stop(); } catch (_) {} const w = $('iba-irisph'); if (w) w.hidden = true; document.body.classList.remove('iba-irisph-on'); }
    function st(t) { const e = document.querySelector('#iba-irisph [data-iph-st]'); if (e) e.textContent = t; }
    function addMsg(cls, html) {
        const log = document.querySelector('#iba-irisph [data-iph-log]'); if (!log) return;
        const d = document.createElement('div'); d.className = 'iph-m ' + cls; d.innerHTML = html; log.appendChild(d);
        log.scrollTop = log.scrollHeight;
    }
    function youSaid(t) { addMsg('iph-me', esc(t)); }
    // o: { html (extra card), opts: [words to tap], wa: url, listen: bool }
    function irisSay(text, o) {
        o = o || {};
        addMsg('iph-ir', '<small>IRIS</small>' + esc(text) + (o.html || '') +
            (o.opts && o.opts.length ? '<div class="iph-opts">' + o.opts.map((x) => '<button type="button" data-iph-say="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' : '') +
            (o.wa ? '<div class="iph-opts"><button type="button" class="is-wa" data-iph-wa="' + esc(o.wa) + '"><i class="fa-brands fa-whatsapp"></i> Open WhatsApp</button></div>' : ''));
        speak(text, o.listen !== false && (!!pend || o.listen));
    }
    // patch 50: her voice = Kokoro (natural, when switched on in ⚙ and downloaded), else the phone's own voice
    const VOICE_KEY = 'iba-irisph-voice-v1';
    function sysVoice() { let n = ''; try { n = localStorage.getItem(VOICE_KEY) || ''; } catch (_) {} if (!n) return null; try { return speechSynthesis.getVoices().find((v) => v.name === n) || null; } catch (_) { return null; } }
    let sayRun = 0;
    function speak(text, thenListen) {
        const my = ++sayRun;
        const said = String(text).replace(/\bPO\b/g, 'P O').replace(/\bSRV\b/g, 'S R V').replace(/\bINV-?/g, 'invoice ');
        const done = () => {
            if (my !== sayRun) return;
            speaking = false; st(IDLE());
            if ($('iba-irisph').hidden) return;
            if (thenListen) followUntil = Date.now() + 9000;
            if (thenListen && (auto || hf)) setTimeout(() => listen('follow'), 250);
            else if (hf) setTimeout(() => listen('hf'), 300);
        };
        const browserSay = () => {
            try {
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(said);
                const v = sysVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
                u.rate = 1.02;
                u.onend = u.onerror = done;
                speechSynthesis.speak(u);
            } catch (_) { done(); }
        };
        try { speechSynthesis.cancel(); } catch (_) {}
        speaking = true; st('speaking');
        const K = window.ibaKokoro;
        if (K && K.wanted && K.wanted()) {
            try { K.stop(); } catch (_) {}
            K.speak(said, null, done).then((ok) => { if (!ok && my === sayRun) browserSay(); }).catch(() => { if (my === sayRun) browserSay(); });
            return;
        }
        browserSay();
    }

    // ---------- listening (tap to talk; after a question she listens again by herself) ----------
    // mode: 'tap' (mic pressed: anything goes), 'follow' (she just asked: a short reply is fine), 'hf' (hands-free: wake words only)
    let lmode = 'tap', micErr = 0, ignAt = 0;
    function hfWait() { return listening && lmode === 'hf'; }
    function wakeOk(t) {
        if (/^\s*(?:(?:hi|hey|hello|ok|okay)[\s,.!]+){0,2}(?:iris|irish|ires|aris|iriz|eye ?ris)\b/i.test(t)) return true;           // Iris …
        if (/^\s*(?:hi|hey|hello)\b/i.test(t) && /\b(?:please|pls)[\s.!?]*$/i.test(t)) return true;                         // Hi … please
        return false;
    }
    function heard(text, conf, m) {
        const t = text.trim(); if (!t) return false;
        // far-away or mumbled speech comes back with low confidence (0 = the phone did not say)
        if (m !== 'tap' && conf > 0 && conf < 0.55) { ignAt = Date.now(); st('Not clear: “' + t + '”. Come closer and say it again.'); console.log('[iris phone] unclear', conf.toFixed(2), t); return false; }
        if (m === 'hf' && !wakeOk(t)) { ignAt = Date.now(); st('Ignored: “' + t + '” (start with Iris, or end with please)'); console.log('[iris phone] ignored (no Iris / Hi … please):', t); return false; }
        if (m === 'follow' && Date.now() > followUntil && !wakeOk(t)) return false;
        return true;
    }
    function hfAgain(ms) {
        if (!hf || listening || speaking) return;
        const w = $('iba-irisph'); if (!w || w.hidden || document.hidden) return;
        setTimeout(() => { if (hf && !listening && !speaking) listen(Date.now() < followUntil ? 'follow' : 'hf'); }, ms || 300);
    }
    function listen(m) {
        if (!SR) { st('This phone browser cannot listen. Use the keyboard.'); return; }
        if (listening) return;
        lmode = m || 'tap';
        try { speechSynthesis.cancel(); } catch (_) {}
        try { if (window.ibaKokoro) window.ibaKokoro.stop(); } catch (_) {}
        try {
            rec = new SR(); rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
            let fin = '', conf = 0; const my = lmode;
            rec.onresult = (e) => {
                let t = '';
                for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) { fin = e.results[i][0].transcript; conf = Number(e.results[i][0].confidence) || 0; } }
                if (my !== 'hf' || wakeOk(t)) st('“' + t.trim() + '”');
            };
            rec.onerror = (e) => {
                const c = e && e.error;
                if (c === 'not-allowed' || c === 'service-not-allowed') { micErr = 9; if (hf) setHf(false); st('The microphone is blocked. Allow it in Chrome › Site settings › Microphone.'); return; }
                if (c && c !== 'no-speech' && c !== 'aborted') { micErr++; st('Mic problem: ' + c); }
            };
            rec.onend = async () => {
                listening = false; rec = null; paintMic();
                if (fin.trim() && heard(fin, conf, my)) { micErr = 0; auto = true; followUntil = 0; await handle(fin.trim()); }
                else if (!speaking && my !== 'hf') st(IDLE());
                if (micErr < 5) hfAgain(micErr ? 1500 : 300);
            };
            rec.start(); listening = true; paintMic(); if (lmode !== 'hf' || Date.now() - ignAt > 3000) st(lmode === 'hf' ? IDLE() : 'listening…');
        } catch (_) { listening = false; paintMic(); }
    }
    function setHf(on) {
        hf = !!on; try { localStorage.setItem(HF_KEY, hf ? '1' : '0'); } catch (_) {}
        paintHf(); micErr = 0;
        if (hf) { irisSay('Hands-free is on. Start with Iris, or say hi and end with please. I stop when the screen locks.', { listen: false }); }
        else { stopListen(); irisSay('Hands-free is off. Tap the mic when you want to talk.', { listen: false }); }
    }
    // ---------- patch 50: ⚙ voice settings ----------
    function showSet(on) {
        const w = $('iba-irisph'); if (!w) return;
        let p = w.querySelector('[data-iph-setbox]');
        if (!p) { p = document.createElement('div'); p.className = 'iph-set'; p.setAttribute('data-iph-setbox', ''); w.appendChild(p); }
        p.hidden = !on;
        if (on) paintSet();
    }
    function paintSet() {
        const p = document.querySelector('#iba-irisph [data-iph-setbox]'); if (!p || p.hidden) return;
        const K = window.ibaKokoro, c = K ? K.cfg() : { on: false, voice: '', speed: 1 };
        let vs = []; try { vs = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); } catch (_) {}
        let mine = ''; try { mine = localStorage.getItem(VOICE_KEY) || ''; } catch (_) {}
        p.innerHTML = '<div class="iph-set-box"><div class="iph-set-head"><b>IRIS voice</b><button type="button" class="iph-x" data-iph-set-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            (K ? '<label class="iph-set-check"><input type="checkbox" id="iph-kok-on"' + (c.on ? ' checked' : '') + '> Natural voice (Kokoro)</label>' +
                '<p class="iph-set-note">Free, runs on this ' + (phone() ? 'phone' : 'PC') + '. Downloads once (about 90 MB), best on Wi-Fi. On a phone she starts speaking 1 to 3 seconds later.</p>' +
                '<div class="iph-set-row"><label>Voice<select id="iph-kok-voice">' + K.VOICES.map((v) => '<option value="' + v[0] + '"' + (v[0] === c.voice ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label>' +
                '<label>Speed<select id="iph-kok-speed">' + K.SPEEDS.map((v) => '<option value="' + v[0] + '"' + (Number(v[0]) === c.speed ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label></div>' +
                '<button type="button" class="iph-set-btn" data-iph-kplay><i class="fa-solid fa-play"></i> Play sample</button><p class="iph-set-note" id="iph-kok-status">' + esc(K.status()) + '</p>' : '') +
            '<hr><label class="iph-set-lab">Phone voice (used when the natural voice is off or not ready)<select id="iph-sys-voice"><option value="">Default</option>' +
                vs.map((v) => '<option value="' + esc(v.name) + '"' + (v.name === mine ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('') + '</select></label>' +
            '<button type="button" class="iph-set-btn" data-iph-vplay><i class="fa-solid fa-play"></i> Try phone voice</button></div>';
    }
    try { speechSynthesis.addEventListener('voiceschanged', paintSet); } catch (_) {}
    function paintHf() { const b = document.querySelector('#iba-irisph [data-iph-hf]'); if (b) { b.classList.toggle('is-on', hf); b.setAttribute('aria-pressed', hf ? 'true' : 'false'); } }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopListen(); else hfAgain(600); });
    function stopListen() { if (rec) { try { rec.abort(); } catch (_) {} } rec = null; listening = false; paintMic(); }
    function paintMic() { const b = document.querySelector('#iba-irisph [data-iph-mic]'); if (b) { b.classList.toggle('is-on', listening && lmode !== 'hf'); b.classList.toggle('is-hf', listening && lmode === 'hf'); } }

    // ---------- reading one PO ----------
    async function loadPO(po) {
        const d = idb(); if (!d) throw new Error('Not signed in.');
        const snap = await d.ref('invoice_entries/' + po).once('value');
        const v = snap.val() || {};
        const invs = Object.keys(v).filter((k) => v[k] && typeof v[k] === 'object' && (v[k].invNumber || v[k].invEntryID || v[k].status)).map((k) => {
            const i = v[k];
            return { key: k, no: String(i.invNumber || i.invEntryID || k), amount: num(i.invValue || i.invoiceValue || i.amount), status: String(i.status || 'Pending').trim(),
                attention: String(i.attention || ''), date: String(i.invoiceDate || ''), at: num(i.invoiceDateTs) || Date.parse(i.invoiceDate) || 0, vendor: String(i.vendorName || ''), site: String(i.site || ''), raw: i };
        }).sort((a, b) => (b.at || 0) - (a.at || 0));
        let vendor = (invs.find((x) => x.vendor) || {}).vendor || '', site = (invs.find((x) => x.site) || {}).site || '';
        if (!vendor) {
            try { const r = await window.ibaAssistant._run('find_po', { po: po }); const x = r && r.result; if (x) { vendor = x.vendor || ''; site = site || x.site || ''; } } catch (_) {}
        }
        return { po, vendor, site, invs };
    }
    const openOnes = () => (ctx ? ctx.invs.filter((i) => !CLOSED.test(i.status)) : []);
    function invLine(i) { return i.no + ', ' + i.status + ', QAR ' + money(i.amount); }
    function invCard(list) {
        return '<div class="iph-card"><div class="iph-po">' + esc(ctx.po) + '</div><div class="iph-v">' + esc([ctx.vendor, ctx.site].filter(Boolean).join(' · ')) + '</div>' +
            list.map((i) => '<div class="iph-row"><span>' + esc(i.no) + '</span><em class="iph-s ' + (CLOSED.test(i.status) ? 'is-done' : '') + '">' + esc(i.status) + '</em><b>' + esc(money(i.amount)) + '</b></div>').join('') + '</div>';
    }
    async function lookup(po) {
        st('thinking'); pend = null;
        try { ctx = await loadPO(po); } catch (e) { irisSay('I could not read PO ' + po + ': ' + ((e && e.message) || e)); return; }
        if (!ctx.invs.length) { irisSay('PO ' + po + (ctx.vendor ? ', ' + ctx.vendor + ',' : '') + ' has no invoices yet.', { listen: false }); return; }
        const by = {}; ctx.invs.forEach((i) => { by[i.status] = (by[i.status] || 0) + 1; });
        const parts = Object.keys(by).map((s) => by[s] + ' ' + s);
        pend = { type: 'what' };
        irisSay('PO ' + po + (ctx.vendor ? ', ' + ctx.vendor + ',' : '') + ' has ' + ctx.invs.length + (ctx.invs.length === 1 ? ' invoice: ' : ' invoices: ') + parts.join(', ') + '. What do you want to do?',
            { html: invCard(ctx.invs.slice(0, 8)), opts: ['What can you do?'] });
    }

    // ---------- picking invoices ----------
    function pick(text, list) {
        const t = norm(text);
        if (!list.length) return [];
        if (list.length === 1 && !/\d{3,}/.test(t)) return list.slice();
        if (/\b(?:both|all|every|everything|all of them)\b/.test(t)) return list.slice();
        const byAmt = list.slice().sort((a, b) => b.amount - a.amount), byDate = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
        if (/\b(?:biggest|bigger|largest|highest|higher|big one|most)\b/.test(t)) return [byAmt[0]];
        if (/\b(?:smallest|smaller|lowest|lower|small one|least)\b/.test(t)) return [byAmt[byAmt.length - 1]];
        if (/\b(?:newest|latest|newer|recent|last one)\b/.test(t)) return [byDate[0]];
        if (/\b(?:oldest|older|earliest)\b/.test(t)) return [byDate[byDate.length - 1]];
        const ord = { first: 0, '1st': 0, one: 0, second: 1, '2nd': 1, two: 1, third: 2, '3rd': 2, three: 2, fourth: 3, four: 3 };
        const om = t.match(/\b(first|1st|second|2nd|third|3rd|fourth)\b/); if (om && list[ord[om[1]]]) return [list[ord[om[1]]]];
        const nums = t.match(/\d{2,}/g) || [];
        if (nums.length) { const hit = list.filter((i) => nums.some((n) => norm(i.no).replace(/ /g, '').includes(n))); if (hit.length) return hit; }
        const sts = list.filter((i) => t.includes(norm(i.status)));
        if (sts.length) return sts;
        if (/\bsrv\b/.test(t)) { const s2 = list.filter((i) => /srv/i.test(i.status)); if (s2.length) return s2; }
        return [];
    }
    function askWhich(list, then, job) {
        pend = { type: 'which', list, then, job };
        irisSay('Which one: ' + list.map(invLine).join('; or ') + '? Or both?', { opts: list.map((i) => i.no).concat(list.length > 1 ? ['Both'] : []) });
    }

    // ---------- 1: change a status ----------
    function statusOf(t) { t = norm(t); if (/for approval|approval|approve it|to approve/.test(t)) return 'For Approval'; if (/for srv|srv/.test(t) && !/srv done/.test(t)) return 'For SRV'; if (/in process|process/.test(t)) return 'In Process'; return ''; }
    function startStatus(text, pre) {
        if (!ctx) { irisSay('Which PO? Say the PO number first.'); pend = { type: 'po-then', text }; return; }
        const status = statusOf(text);
        const list = openOnes();
        if (!list.length) { irisSay('All invoices on PO ' + ctx.po + ' are paid or with Accounts, so there is nothing to change.', { listen: false }); return; }
        const job = Object.assign({ status: '', who: null, invs: null, warned: false }, pre || {});
        if (status) job.status = status;
        const w = findWho(text); if (w) job.who = w;
        // patch 47: "all In Process to For Approval": the status they are IN now picks the invoices (not every open one)
        if (!job.invs && status) {
            const nt = norm(text).replace(new RegExp('\\b' + norm(status) + '\\b'), ' ');
            const from = list.filter((i) => norm(i.status) !== norm(status) && nt.includes(norm(i.status)));
            if (from.length) job.invs = from;
        }
        if (!job.invs) { const chosen = pick(text.replace(/\b(?:for approval|for srv|in process)\b/ig, ' ').replace(/\bto\s+[a-z].*$/i, ''), list); if (chosen.length && (chosen.length < list.length || list.length === 1 || /\b(?:both|all)\b/i.test(text))) job.invs = chosen; }
        if (!job.status) { pend = { type: 'status', job }; irisSay((job.invs ? job.invs.map((i) => i.no).join(' and ') + '. ' : '') + 'Which status: For Approval, For SRV, or In Process?', { opts: ['For Approval', 'For SRV', 'In Process'] }); return; }
        if (job.invs) return nextStep(job);
        askWhich(list, (invs) => { job.invs = invs; nextStep(job); }, job);
    }
    function findWho(text) {
        // patch 47: "to X", "attention X", "with X", "under X"; the LAST one counts; a trailing please is dropped
        const s = String(text).replace(/\b(?:for approval|for srv|in process)\b/ig, ' ').replace(/[\s,.]+(?:please|pls|thanks|thank you|now)[\s.!?]*$/i, '');
        const all = Array.from(s.matchAll(/\b(?:to|attention|with|under)\s+(?=([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?))/ig))
            .map((m) => m[1].replace(/\b(?:please|thanks|now)\b.*$/i, '').trim())
            .map((c) => c.replace(/^(?:mr|ms|sir|engineer|eng)\.?\s+/i, ''))
            .filter((c) => c && !/^(?:approval|srv|process|for|in|under|to|status|the|him|her|it)\b/i.test(c));
        if (!all.length) return null;
        const cand = all[all.length - 1];
        let ps = findPeople(cand);
        if (!ps.length && /\s/.test(cand)) ps = findPeople(cand.split(/\s+/)[0]);
        return ps.length ? ps : { none: cand };
    }
    function nextStep(job) {
        if (job.status === 'For Approval' && !job.warned) {
            const noSrv = job.invs.filter((i) => /in process|for srv|pending|under review/i.test(i.status));
            if (noSrv.length) { job.warned = true; pend = { type: 'confirm', yes: () => nextStep(job), no: () => irisSay('Okay, I left it.', { listen: false }) }; irisSay(noSrv.map((i) => i.no).join(' and ') + (noSrv.length === 1 ? ' has' : ' have') + ' no SRV yet. Mark For Approval anyway? Yes or no.', { opts: ['Yes', 'No'] }); return; }
        }
        if (!job.person) {
            const w = job.who;
            if (w && Array.isArray(w) && w.length === 1) job.person = w[0].name;
            else if (w && Array.isArray(w) && w.length > 1) { pend = { type: 'who', job, list: w }; irisSay('I found ' + w.map((p) => p.name).join(', ') + '. Which one?', { opts: w.map((p) => p.name) }); return; }
            else if (job.status === 'For Approval' || (w && w.none)) { pend = { type: 'who', job }; irisSay((w && w.none ? 'I can’t find ' + w.none + '. ' : '') + 'To whom?'); return; }
        }
        if (job.person) { const a = awayOf(job.person); if (a && a.target && !job.awayDone) { job.awayDone = true; pend = { type: 'confirm', yes: () => { job.person = a.target; nextStep(job); }, no: () => nextStep(job) }; irisSay(job.person + ' is on vacation. Send it to ' + a.target + ' instead? Yes or no.', { opts: ['Yes', 'No'] }); return; } }
        const what = job.invs.map((i) => i.no).join(' and ');
        pend = { type: 'confirm', yes: () => saveStatus(job), no: () => irisSay('Okay, nothing changed.', { listen: false }) };
        irisSay('Mark ' + what + ' on PO ' + ctx.po + ' ' + job.status + (job.person ? ', attention ' + job.person : '') + '? Yes or no.', { opts: ['Yes', 'No'] });
    }
    async function saveStatus(job) {
        const d = idb(); const by = me() || 'IRIS';
        st('saving');
        const done = [];
        try {
            for (const i of job.invs) {
                const fresh = (await d.ref('invoice_entries/' + ctx.po + '/' + i.key).once('value')).val() || {};
                if (CLOSED.test(String(fresh.status || ''))) continue; // someone moved it meanwhile
                const old = String(fresh.attention || '');
                const updates = { status: job.status, statusChangedAt: firebase.database.ServerValue.TIMESTAMP, statusQueueAt: firebase.database.ServerValue.TIMESTAMP, lastUpdated: firebase.database.ServerValue.TIMESTAMP };
                if (job.person) updates.attention = job.person;
                await Promise.all([
                    d.ref('invoice_entries/' + ctx.po + '/' + i.key).update(updates),
                    d.ref('invoice_entries/' + ctx.po + '/' + i.key + '/history').push({ action: job.status, status: job.status, by: by, to: job.person || old || '', note: 'By IRIS on phone', timestamp: Date.now() })
                ]);
                const merged = Object.assign({}, fresh, updates, { statusChangedAt: Date.now(), statusQueueAt: Date.now(), lastUpdated: Date.now() });
                try { if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(ctx.po, i.key, merged, old); } catch (e) { console.warn('[iris phone] task list', e); }
                try { if (typeof updateLocalInvoiceCache === 'function') updateLocalInvoiceCache(ctx.po, i.key, merged); } catch (_) {}
                i.status = job.status; if (job.person) i.attention = job.person;
                done.push(i.no);
            }
        } catch (e) { pend = null; irisSay('Sorry, it did not save: ' + ((e && e.message) || e), { listen: false }); return; }
        pend = null;
        if (!done.length) { irisSay('Nothing changed: it was already paid or with Accounts.', { listen: false }); return; }
        irisSay('Done. ' + done.join(' and ') + (done.length === 1 ? ' is ' : ' are ') + job.status + (job.person ? ' with ' + job.person : '') + '. Anything else?', { opts: ['What can you do?'], listen: true });
    }

    // ---------- 2: WhatsApp reminder ----------
    function startRemind(text) {
        if (!ctx) { irisSay('Which PO is the reminder about? Say the PO number first.'); pend = { type: 'po-then', text }; return; }
        const w = findWho(text) || (/\b(?:remind|whatsapp|message)\s+([a-z]+)/i.test(text) ? findPeople(text.match(/\b(?:remind|whatsapp|message)\s+([a-z]+)/i)[1]) : null);
        const list = Array.isArray(w) ? w : [];
        if (list.length !== 1) { pend = { type: 'remind-who', list }; irisSay(list.length > 1 ? 'Which one: ' + list.map((p) => p.name).join(', ') + '?' : 'Who should I remind?', { opts: list.map((p) => p.name) }); return; }
        waTo(list[0]);
    }
    function waTo(p) {
        pend = null;
        let m = p.mobile; if (m.length === 8) m = '974' + m;
        const open = openOnes();
        const text = 'Hi ' + p.name.split(/\s+/)[0] + ', a reminder about PO ' + ctx.po + (ctx.vendor ? ' (' + ctx.vendor + ')' : '') + (open.length ? ': ' + open.map((i) => i.no + ' ' + i.status).join(', ') : '') + '. Thank you. ' + (me() || '');
        if (!m) { irisSay(p.name + ' has no mobile number in the system. Here is the message to copy.', { html: '<div class="iph-card">' + esc(text) + '</div>', listen: false }); return; }
        irisSay('The WhatsApp message to ' + p.name + ' is ready. Tap Open WhatsApp, then press Send.', { wa: 'https://wa.me/' + m + '?text=' + encodeURIComponent(text), html: '<div class="iph-card">' + esc(text) + '</div>', listen: false });
    }

    // ---------- 3: pending ----------
    function pendingList() {
        if (!ctx) { irisSay('Which PO? Say the PO number first.'); pend = { type: 'po-then', text: 'pending' }; return; }
        const list = openOnes();
        pend = { type: 'what' };
        if (!list.length) { irisSay('Nothing pending on PO ' + ctx.po + '. Everything is paid or with Accounts.', { listen: false }); return; }
        irisSay(list.length + ' pending on PO ' + ctx.po + ': ' + list.map(invLine).join('; ') + '.', { html: invCard(list) });
    }

    // ---------- 4: note for the PC ----------
    async function noteForPC(text) {
        const d = mdb(), who = me();
        if (!d || !who) { irisSay('Sign in first, then try again.', { listen: false }); return; }
        const extra = String(text || '').replace(/^\s*(?:number\s*)?(?:four|4|fourth)\b[\s,.:-]*/i, '').replace(/\b(?:add|save|make|put)?\s*(?:it\s+)?(?:as\s+)?(?:a\s+)?(?:note|reminder)\b/i, '').replace(/\b(?:please|thanks)\b/ig, '').trim();
        const body = 'Do on PC: ' + (ctx ? 'PO ' + ctx.po + (ctx.vendor ? ' · ' + ctx.vendor : '') : '') + (extra ? (ctx ? ' · ' : '') + extra : '');
        try {
            await d.ref('iba_assistant/reminders/' + remSafe(who)).push({ from: who, to: who, text: body.slice(0, 600), po: ctx ? ctx.po : '', control: '', at: firebase.database.ServerValue.TIMESTAMP });
            pend = null;
            irisSay('Saved as a note for the PC: ' + body.replace(/^Do on PC: /, '') + '. It waits in your reminders at the office.', { listen: false });
        } catch (e) { irisSay('Could not save the note: ' + ((e && e.message) || e), { listen: false }); }
    }

    // ---------- menu ----------
    function menu() {
        pend = { type: 'menu' };
        if (!ctx) {
            irisSay('Say a PO number first, like: PO 12345. Then I can change a status, send a WhatsApp reminder, tell you the pending invoices, or save a note for the PC. I also know the time, maths and jokes.', { opts: ['What time is it?', 'Tell me a joke'] });
            return;
        }
        irisSay('For PO ' + ctx.po + ' I can: 1, change a status. 2, a WhatsApp reminder to someone. 3, tell you the pending invoices. 4, save a note to do at the office.',
            { html: '<div class="iph-card iph-menu"><div>1 · Change a status (For Approval, For SRV, In Process)</div><div>2 · WhatsApp reminder to someone</div><div>3 · The pending invoices</div><div>4 · A note to do at the office</div></div>', opts: ['1', '2', '3', '4'] });
    }

    function greetLine() {
        const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Qatar' })) || new Date().getHours();
        return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + (first() ? ', ' + first() : '') + '!';
    }
    async function briefSay() {
        pend = null; st('thinking… reading your brief');
        let t = '';
        try { t = window.ibaAssistant && window.ibaAssistant.briefWords ? await window.ibaAssistant.briefWords() : ''; } catch (e) { console.warn('[iris phone] brief', e); }
        st('');
        irisSay(t || 'Your brief is not ready yet. Try again in a moment.', { listen: false, opts: ['What can you do?'] });
    }

    // ---------- the brain ----------
    async function handle(raw) {
        let t = String(raw || '').trim(); if (!t) return;
        youSaid(t);
        t = t.replace(WAKE, '').replace(/[\s,.]+(?:please|thanks|thank you|now)[\s.!?]*$/i, '').replace(/[.!?]+$/, '').trim();
        const q = norm(t);
        if (!q) { irisSay('Yes?'); return; }
        if (/^(?:close|bye|goodbye|good bye|exit|that s all|nothing|no thanks|stop)$/.test(q)) { pend = null; auto = false; irisSay('Okay. Bye for now!', { listen: false }); return; }
        if (/^(?:cancel|never mind|forget it)$/.test(q)) { pend = null; irisSay('Okay, cancelled.', { listen: false }); return; }

        // a new command or a new PO number starts over (the old question is dropped)
        if (pend && pend.type !== 'confirm' && ((/\b(?:mark|set|change|make|put|move|turn|switch|update)\b/.test(q) && statusOf(t)) || /\b(?:po|p o)\s*\d{4,6}\b/.test(q))) pend = null;
        const p = pend;
        if (p && p.type === 'confirm') {
            if (/^(?:yes|yeah|yep|yup|ok|okay|sure|go|go ahead|proceed|do it|confirm|correct|right)\b/.test(q)) { pend = null; return p.yes(); }
            if (/^(?:no|nope|don t|dont|not now|wait)\b/.test(q)) { pend = null; return p.no(); }
            irisSay('Please say yes or no.', { opts: ['Yes', 'No'] }); return;
        }
        if (p && p.type === 'which') {
            const got = pick(t.replace(/\bto\s+[a-z].*$/i, ''), p.list);
            const w = findWho(t) || (!got.length && !/\d/.test(q) ? (findPeople(t).length ? findPeople(t) : null) : null);
            if (w && p.job) p.job.who = w;
            if (got.length) { pend = null; return p.then(got); }
            if (w && p.job) { irisSay('Okay, to ' + (Array.isArray(w) && w.length === 1 ? w[0].name : t) + '. Which invoice: ' + p.list.map(invLine).join('; or ') + '?', { opts: p.list.map((i) => i.no).concat(p.list.length > 1 ? ['Both'] : []) }); return; }
        }
        if (p && p.type === 'who') {
            let ps = p.list ? bestNames(t, p.list) : findPeople(t);
            if (p.list && !ps.length) ps = findPeople(t);
            if (ps.length === 1) { pend = null; p.job.person = ps[0].name; p.job.who = [ps[0]]; return nextStep(p.job); }
            if (ps.length > 1) { pend = { type: 'who', job: p.job, list: ps }; irisSay('Which one: ' + ps.map((x) => x.name).join(', ') + '?', { opts: ps.map((x) => x.name) }); return; }
            if (!/\d/.test(q) && q.split(' ').length <= 4) { irisSay('I can’t find ' + t + ' in the user list. Say the name again?'); return; }
        }
        if (p && p.type === 'remind-who') {
            const ps = findPeople(t);
            if (ps.length === 1) return waTo(ps[0]);
            if (ps.length > 1) { pend = { type: 'remind-who', list: ps }; irisSay('Which one: ' + ps.map((x) => x.name).join(', ') + '?', { opts: ps.map((x) => x.name) }); return; }
        }
        if (p && p.type === 'status') {
            if (statusOf(t)) { pend = null; return startStatus(t, p.job); }
            const got = pick(t, openOnes()); if (got.length) { p.job.invs = got; irisSay(got.map((i) => i.no).join(' and ') + '. Which status: For Approval, For SRV, or In Process?', { opts: ['For Approval', 'For SRV', 'In Process'] }); return; }
        }

        // 18.0.0 patch 51: maths, units, width x height (before the PO check, so "1000 times 2000" is not a PO)
        try { const c = window.ibaTalk && window.ibaTalk.calc ? window.ibaTalk.calc(t) : null; if (c) { irisSay(c, { listen: false }); return; } } catch (_) {}
        // a PO number
        const pom = t.match(/\b(\d{4,6})\b/);
        if (pom && (/\b(?:po|p o|look|find|search|open|check|status|show|track|about)\b/.test(q) || q === pom[1] || (!ctx && !pend))) {
            const po = pom[1];
            const after = p && p.type === 'po-then' ? p.text : '';
            await lookup(po);
            if (after) handle(after);
            return;
        }
        // numbered menu answers
        const nm = q.match(/^(?:number\s*|option\s*)?(one|1|first|two|2|second|three|3|third|four|4|fourth|for)\b(.*)$/);
        if (nm && ctx && (!p || p.type === 'menu' || p.type === 'what')) {
            const n = { one: 1, 1: 1, first: 1, two: 2, 2: 2, second: 2, three: 3, 3: 3, third: 3, four: 4, 4: 4, fourth: 4, for: 4 }[nm[1]];
            const rest = nm[2] || '';
            if (n === 1) return startStatus(rest || '');
            if (n === 2) return startRemind(rest);
            if (n === 3) return pendingList();
            if (n === 4) return noteForPC(rest);
        }
        // patch 44: greetings alone, and the brief
        if (/^(?:(?:hi|hey|hello|hullo|yo|ok|okay)\s*){1,3}(?:iris)?$/.test(q)) { irisSay(greetLine() + ' Tell me a PO number, or ask for your brief.', { opts: ['Brief me', 'What can you do?'] }); return; }
        if (/\bbrief\b|\b(?:what|anything) (?:do )?(?:you )?(?:have|got) for me\b|\bwhat(?: s| is)? (?:waiting|pending) for me\b|\banything (?:pending|waiting|for me)\b|\bwhat (?:do|should|must) i (?:do|work on)\b|\bmy (?:tasks|work|to ?do)\b|\b(?:tasks?|work) (?:for )?today\b/.test(q) && !/\b\d{4,6}\b/.test(q)) return briefSay();
        if (/^(?:help|guide|all commands|show (?:the )?guide|about (?:you|iris))$/.test(q) && window.ibaIrisGuide) { window.ibaIrisGuide.open(/about/.test(q) ? 'about' : 'do'); irisSay(/about/.test(q) ? 'This is me.' : 'Here is everything I can do. Tap an example to try it.', { listen: false }); return; }
        if (/\bwhat (?:can|else can|do) you (?:do|help)|\bhelp me\b|^help$|\boptions?\b|\bmenu\b/.test(q)) return menu();
        if (/\b(?:remind|reminder|whatsapp|whats app|message)\b/.test(q)) return startRemind(t);
        if (/\b(?:mark|set|change|make|put|move|send|give|forward|turn|switch|update)\b/.test(q) && statusOf(t)) return startStatus(t);
        if (/\b(?:pending|open|not paid|unpaid|waiting)\b/.test(q) && ctx) return pendingList();
        if (/\b(?:note|later|at the office|in the office|on the pc|on pc|tomorrow)\b/.test(q) && ctx) return noteForPC(t);
        if (p && p.type === 'which') { askWhich(p.list, p.then); return; }

        // her built-in answers (time, maths, jokes, small talk, what does Iris mean)
        try { const a = window.ibaTalk && window.ibaTalk.answer ? await window.ibaTalk.answer('Iris ' + t) : null; if (a) { irisSay(a, { listen: false }); return; } } catch (_) {}
        irisSay('I don’t know that one yet. Say a PO number, or ask: what can you do?', { opts: ['What can you do?'], listen: false });
    }

    // ---------- the orb (design D) ----------
    function orbStart(cv) {
        const c = cv.getContext('2d'), W = cv.width;
        const PAL = { listen: ['#2fd3c2', '#3a7bd5', '#7be3ff', '#2fd3c2'], hear: ['#2fd3c2', '#3a7bd5', '#7be3ff', '#6ff7d9'], think: ['#e0b54a', '#2fd3c2', '#a77bff', '#ff7ab6'], speak: ['#f3d77a', '#e0b54a', '#ff9d5c', '#2fd3c2'] };
        const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const rgba = (x, a) => 'rgba(' + (x[0] | 0) + ',' + (x[1] | 0) + ',' + (x[2] | 0) + ',' + a + ')';
        let cur = PAL.listen.map(hex), t = 0, lvl = 0, odd = false;
        function blob(x, y, r, col, ph, wob) {
            c.beginPath();
            for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, k = r * (1 + wob * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 - ph * 1.3) * 0.3 + Math.sin(a * 2 + ph * 0.7) * 0.2)); const px = x + Math.cos(a) * k, py = y + Math.sin(a) * k; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
            c.closePath(); const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.3);
            g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.6, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fill();
        }
        function frame() {
            const w = $('iba-irisph');
            if (!w || w.hidden) { setTimeout(() => requestAnimationFrame(frame), 400); return; }
            t += 0.016; odd = !odd;
            if (!odd) { requestAnimationFrame(frame); return; } // 30 frames a second is enough (patch 42)
            const mode = (listening && lmode !== 'hf') ? 'hear' : speaking ? 'speak' : (st && /thinking|saving/.test((w.querySelector('[data-iph-st]') || {}).textContent || '')) ? 'think' : 'listen';
            const tgt = mode === 'speak' ? Math.abs(Math.sin(t * 7) * 0.55 + Math.sin(t * 15.3) * 0.3) : mode === 'hear' ? 0.35 + 0.3 * Math.abs(Math.sin(t * 9)) : mode === 'think' ? 0.15 + 0.1 * Math.sin(t * 4) : 0.05 + 0.05 * Math.sin(t * 1.6);
            lvl += (tgt - lvl) * 0.2;
            const p = PAL[mode].map(hex); for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) cur[i][k] += (p[i][k] - cur[i][k]) * 0.06;
            const m = W / 2; c.clearRect(0, 0, W, W);
            const r = W * 0.19 * (1 + lvl * 0.28), fast = mode === 'think', tt = t * (fast ? 2.4 : 1), wob = 0.08 + lvl * 0.22;
            c.globalCompositeOperation = 'screen';
            for (let i = 0; i < 4; i++) { const a = tt * 0.9 + i * 1.7; blob(m + Math.cos(a) * r * 0.22, m + Math.sin(a * 1.2) * r * 0.22, r * (0.78 + i * 0.06), cur[i], tt * 1.3 + i, wob); }
            c.globalCompositeOperation = 'source-over';
            const hl = c.createRadialGradient(m - r * 0.35, m - r * 0.4, 0, m - r * 0.35, m - r * 0.4, r * 0.6); hl.addColorStop(0, 'rgba(255,255,255,.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.beginPath(); c.arc(m, m, r, 0, 7); c.fill();
            const R = W * 0.3; c.globalCompositeOperation = 'lighter';
            for (let j = 0; j < 3; j++) {
                c.beginPath(); const amp = W * 0.008 + lvl * W * 0.06 * (1 - j * 0.2), f = [3, 5, 7][j], ph = t * (fast ? 3 : 1.2) * (j % 2 ? -1 : 1) + j * 2;
                for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2, rr = R + Math.sin(a * f + ph) * amp * Math.sin(a * 2 + ph * 0.5 + 1); const x = m + Math.cos(a) * rr, y = m + Math.sin(a) * rr; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
                c.closePath(); c.strokeStyle = rgba(cur[j], 0.9); c.lineWidth = W * 0.009; c.shadowColor = rgba(cur[j], 1); c.shadowBlur = W * 0.05; c.stroke();
            }
            c.shadowBlur = 0; c.globalCompositeOperation = 'source-over';
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // ---------- the button that opens it (phone, Super Admin only) ----------
    function fab() {
        let b = $('iba-irisph-fab');
        const want = phone() && isSuper();
        if (!want) { if (b) b.hidden = true; return; }
        if (!b) {
            b = document.createElement('button'); b.type = 'button'; b.id = 'iba-irisph-fab'; b.setAttribute('aria-label', 'IRIS'); b.title = 'IRIS';
            b.innerHTML = '<span></span><b>IRIS</b>';
            b.addEventListener('click', open);
            document.body.appendChild(b);
        }
        b.hidden = !!document.body.classList.contains('iba-irisph-on');
    }
    setInterval(fab, 1500);

    // ---------- 18.0.0 patch 48: IRIS as her own app (the IRIS shortcut opens ?app=iris) ----------
    // Only her page, no ✕ and no way to the rest of the system (the IBA Invoice shortcut is for that).
    function appTick() {
        if (!window.IBA_IRIS_APP) return;
        const b = document.body; if (!b) return;
        b.classList.add('iba-iris-app');
        try { document.title = 'IRIS'; } catch (_) {}
        if (!me()) return; // still on the sign-in screen
        let no = $('iba-irisapp-no');
        if (!isSuper()) {
            if (!no) {
                no = document.createElement('div'); no.id = 'iba-irisapp-no';
                no.innerHTML = '<div><b>IRIS</b><p>IRIS is for the Super Admin account. Please use the IBA Invoice app.</p></div>';
                b.appendChild(no);
            }
            no.hidden = false; return;
        }
        if (no) no.hidden = true;
        const w = $('iba-irisph');
        if (!w || w.hidden) open();
    }
    if (window.IBA_IRIS_APP) { setInterval(appTick, 1000); appTick(); }
    window.ibaIrisPhone = { open, close, handle, _ctx: () => ctx, _pend: () => pend };
})();
