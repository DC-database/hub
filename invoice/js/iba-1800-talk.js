/* 18.0.0 patch 29 (martin): Talk mode = talk to the assistant like a person. Her name is IRIS
   (Intelligent Records & Invoice System). PC only, OFF until the person presses the headset button.
   - Listens all the time (Chrome speech recognition), but only answers a sentence that starts with "Iris"
     ("Hi Iris", "Irish" also work). Right after she spoke, 8 s to answer without the name (follow-up / yes / no).
   - Answers out loud with the existing assistant voice; the AI is told to keep it to 1-3 spoken sentences.
   - Say "Iris, ..." while she talks to interrupt. "Iris, stop" = quiet. "Iris, goodbye" = Talk mode off.
   - Approve / Reject / Delete / Cancel / Paid / Send ... : she asks "yes or no?" first.
   - Goes off by itself after 15 min without a question. Not kept after a reload.
   Nothing else in the assistant changes: typing, mic button, chips and skills work as before. */
(function () {
    'use strict';
    if (window.ibaTalk) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const A = () => window.ibaAssistant || {};
    const $ = (id) => document.getElementById(id);
    const WAKE = /^\s*(?:(?:hi|hey|hello|ok|okay|oh)[\s,.]+)?(?:iris|irish|iriss?|i ?ris|irus)\b['’s]*[\s,.:;!?-]*/i;
    const RISKY = /\b(?:approve|reject|delete|remove|cancel|send|forward)\b|\bmark\b.*\bpaid\b/i;
    const YES = /^\s*(?:yes|yeah|yep|yup|ok|okay|sure|go ahead|do it|confirm|correct|proceed|continue)\b/i;
    const NO = /^\s*(?:no|nope|cancel|stop|don'?t|do not|never ?mind)\b/i;
    const HELLO = /^\s*(?:hi|hello|hey|good (?:morning|afternoon|evening)|how are you|are you there)\b[\s\w]{0,20}[?.!]*\s*$/i;
    const IDLE_OFF = 15 * 60000, FOLLOW = 8000;
    let pendingAct = null;
    let on = false, muted = false, rec = null, pending = null, follow = 0, lastCmd = 0, wasTalking = false, lastSaid = '', poll = 0, fails = 0;

    const phone = () => !!(document.body && (document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone')));
    const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    function echo(t) { // her own voice coming back through the speakers
        const a = words(t); if (!a.length || !lastSaid) return false;
        const b = new Set(words(lastSaid));
        return a.filter((w) => b.has(w)).length / a.length >= 0.6;
    }
    function talking() { try { return !!(A().talking && A().talking()); } catch (_) { return false; } }
    function busy() { try { return !!(A().busy && A().busy()); } catch (_) { return false; } }
    let typedMode = false; // 18.0.0 patch 34: a typed command answers in the chat (speaks only while Talk mode is on)
    function say(t) { lastSaid = t; if (typedMode) { note('IRIS: ' + t); if (!on) return; } try { if (A().speak) A().speak(t); } catch (_) {} }
    function note(t) { try { if (A().note) A().note(t); } catch (_) {} }

    function bar() {
        let b = $('iba-talk-bar');
        const form = $('iba-ai-form');
        if (!b && form && form.parentNode) {
            b = document.createElement('div');
            b.id = 'iba-talk-bar';
            b.setAttribute('role', 'status');
            b.innerHTML = '<span class="iba-talk-orb"><i></i><i></i><i></i><i></i></span><span class="iba-talk-txt"><b>IRIS</b> <span data-talk-st></span></span>' +
                '<button type="button" data-talk-mute title="Mute: she does not hear you"><i class="fa-solid fa-microphone-slash"></i> Mute</button>' +
                '<button type="button" data-talk-end title="Turn Talk mode off"><i class="fa-solid fa-xmark"></i> End</button>';
            form.parentNode.insertBefore(b, form);
        }
        return b;
    }
    function stage() { if (!on) return 'off'; if (muted) return 'muted'; if (pending || choice) return 'ask'; if (busy()) return 'think'; if (talking()) return 'speak'; return 'listen'; }
    const TXT = { listen: 'Listening… start with “Iris”', think: 'Thinking…', speak: 'Speaking… say “Iris” to interrupt', muted: 'Muted: not listening', ask: 'Waiting for your answer…', off: '' };
    // 18.0.0 patch 31: small IRIS pill above every window, so you can see she is on without opening the assistant
    // (opening the assistant over a pop-up closes that pop-up, since a click outside a pop-up closes it)
    function pill() {
        let p = $('iba-talk-pill');
        if (!p && document.body) {
            p = document.createElement('div');
            p.id = 'iba-talk-pill';
            p.setAttribute('role', 'status');
            p.innerHTML = '<span class="iba-talk-orb"><i></i><i></i><i></i><i></i></span><b>IRIS</b><span data-pill-st></span>' +
                '<button type="button" data-talk-mute title="Mute"><i class="fa-solid fa-microphone-slash"></i></button><button type="button" data-talk-end title="Turn Talk mode off"><i class="fa-solid fa-xmark"></i></button>';
            ['mousedown', 'pointerdown', 'click'].forEach((t) => p.addEventListener(t, (e) => e.stopPropagation()));
            document.body.appendChild(p);
        }
        return p;
    }
    function paint() {
        const s = stage();
        const pnl = $('iba-ai-panel'), pl = on ? pill() : $('iba-talk-pill');
        if (pl) {
            pl.hidden = !on || !(pnl && !pnl.hidden ? false : true);
            pl.className = 'is-' + s + (pl.querySelector('.iba-orb-cv') ? ' has-orb' : '');
            const ps = pl.querySelector('[data-pill-st]'); if (ps) ps.textContent = { listen: 'listening', think: 'thinking', speak: 'speaking', muted: 'muted', ask: 'waiting for you' }[s] || '';
            const pm = pl.querySelector('[data-talk-mute]'); if (pm) { pm.innerHTML = muted ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>'; pm.title = muted ? 'Unmute' : 'Mute'; }
        }
        const t = $('iba-ai-talk');
        if (t) { t.classList.toggle('is-on', on); t.title = on ? 'Talk mode is on (click to turn off)' : 'Talk mode: say “Iris, …” and IRIS answers out loud'; }
        const b = on ? bar() : $('iba-talk-bar');
        if (!b) return;
        b.hidden = !on;
        b.className = 'is-' + s;
        const st = b.querySelector('[data-talk-st]'); if (st) st.textContent = s === 'listen' && Date.now() < follow ? 'Listening… go ahead' : TXT[s];
        const m = b.querySelector('[data-talk-mute]'); if (m) m.innerHTML = muted ? '<i class="fa-solid fa-microphone"></i> Unmute' : '<i class="fa-solid fa-microphone-slash"></i> Mute';
    }

    function start() {
        if (!on || muted || rec || !SR) return;
        try {
            rec = new SR();
            rec.lang = (navigator.language && /^en/i.test(navigator.language)) ? navigator.language : 'en-US';
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            rec.onresult = (e) => {
                fails = 0;
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i]; const t = (r[0] && r[0].transcript) || '';
                    if (!r.isFinal) { if (talking() && WAKE.test(t)) { try { A().stopSpeak(); } catch (_) {} } continue; } // barge in
                    hear(t);
                }
            };
            rec.onerror = (e) => {
                const c = e && e.error;
                if (c === 'no-speech' || c === 'aborted') return;
                const m = A().micError ? A().micError(c) : '';
                if (m) note(m);
                if (c === 'not-allowed' || c === 'service-not-allowed' || c === 'audio-capture') setOn(false);
                else fails++;
            };
            rec.onend = () => { rec = null; if (on && !muted) setTimeout(start, fails > 3 ? 4000 : 250); };
            rec.start();
        } catch (_) { rec = null; }
    }
    function stopRec() { const r = rec; rec = null; if (r) { try { r.onend = null; r.abort(); } catch (_) {} } }

    function hear(text) {
        const t = String(text || '').trim();
        if (!t || !on || muted) return;
        // 18.0.0 patch 33 (martin): the answer to "Did you mean A, or B?" is one of her own words, so the echo
        // filter used to throw it away. Now only her whole question coming back is ignored; "Iris, B" works too.
        if (choice) {
            const rest = t.replace(WAKE, '').trim();
            if (rest && !choiceEcho(rest)) { pick(rest); return; }
            if (!rest || !WAKE.test(t)) return;
        }
        if (pending) {
            if (YES.test(t)) { const q = pending, act = pendingAct; pending = null; pendingAct = null; paint(); if (act) act(); else run(q, true); return; }
            if (NO.test(t)) { pending = null; pendingAct = null; say('Okay, I won’t do it.'); paint(); return; }
        }
        const m = t.match(WAKE);
        let q;
        if (m) q = t.slice(m[0].length).trim();
        else if (Date.now() < follow && !talking() && !echo(t)) q = t;
        else return;
        if (!m && /^(?:no|nope|ok|okay|yes|yeah|good|great|nice|cool|nothing|fine|alright|thanks?|thank you)\b[\s\w]{0,12}$/i.test(q)) { if (/thank/i.test(q)) say('You’re welcome.'); follow = 0; return; }
        if (talking()) { try { A().stopSpeak(); } catch (_) {} }
        lastCmd = Date.now();
        if (m) { pending = null; pendingAct = null; choice = null; }
        if (!q) { say('Yes?'); return; }
        if (/^(?:stop|be quiet|quiet|shut up|enough|that'?s enough)\b/i.test(q)) { follow = 0; paint(); return; }
        if (/^(?:good ?bye|bye|stop listening|turn (?:it )?off|talk mode off|go to sleep)\b/i.test(q)) { say('Okay. Bye for now.'); setTimeout(() => setOn(false), 1800); return; }
        if (HELLO.test(q)) { say('Hi! How can I help you?'); return; }
        run(q, false);
    }
    // 18.0.0 patch 30 (martin): skills first, matched on this PC (no AI, never runs out); the AI only when nothing fits
    const STOP = new Set('please can could would you me my mine the a an to for of and or on in at it this that these those is are be do does show open run start give get let lets want need i id im we our some all just now quickly quick go see check tell about with up what whats which today todays tomorrow no yes ok okay'.split(' '));
    const ALIAS = { brief: 'today morning waiting tasks work day', approvals_list: 'approvals approve approval waiting management pending sign', inv_status: 'where invoice track tracking status find', dash_charts: 'charts chart pie bars graph hide dashboard', dash_print: 'print dashboard report pie chart graph', site_stock: 'stock site inventory balance', po_pull: 'pull pulled out file original deletion', remind_me: 'remind reminder remember', new_invoice: 'new add invoice', new_job: 'new add job entry', person: 'colleague phone number contact who', transfer: 'transfer trf find', sn_print_all: 'print summary notes note', urgent: 'urgent rush mark', screensaver: 'screensaver screen saver', weekly: 'weekly week report', po_report: 'po report purchase order', batch: 'batch add', xl_wa: 'download excel csv list copy paste accounts srv', xl_ur: 'download excel csv list copy paste review invoice', new_delivery: 'delivery deliver restock return usage', receive_delivery: 'receive received delivery', site_team: 'site team people', site_list: 'site list status', lpo_mail: 'lpo email emails mail', access_check: 'access check pages', skill_access: 'skill skills access', notes_to_acc: 'notes accounts', today_batch: 'today batch', recent: 'recent changes batch', new_requisition: 'new add requisition req' };
    const stem = (w) => w.replace(/'s$/, '').replace(/(?:ies)$/, 'y').replace(/(?<=\w{3})s$/, '');
    const toks = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ']+/g, ' ').split(/\s+/).filter((w) => w.length > 1).map(stem).filter((w) => !STOP.has(w));
    function match(q, withDenied) {
        let list = [];
        try { list = (A().skillList && A().skillList()) || []; } catch (_) {}
        if (withDenied) { try { list = list.concat((A().deniedSkills && A().deniedSkills()) || []); } catch (_) {} }
        q = String(q || '').replace(/^\s*(?:please\s+)?(?:can you\s+)?(?:open|run|start|show|use)?\s*(?:the\s+|my\s+)?skills?\s+(?:for|of|called|named|to)\s+/i, '');
        q = q.replace(/\s+skills?\s*$/i, ''); // p33: "open note to accounts skill"
        const Q = toks(q);
        if (!Q.length || !list.length) return [];
        const sets = list.map((k) => ({ k, N: new Set(toks(k.name)), T: new Set(toks(k.name + ' ' + (k.tile || '') + ' ' + (ALIAS[k.id] || ''))) }));
        const df = {}; sets.forEach((x) => x.T.forEach((w) => { df[w] = (df[w] || 0) + 1; }));
        return sets.map((x) => { let h = 0, w = 0; Q.forEach((q1) => { if (x.T.has(q1)) { h++; w += (x.N.has(q1) ? 2 : 1) / df[q1]; } }); if (x.N.size > 1 && Array.from(x.N).every((n) => Q.includes(n))) w += 2; /* p33: the whole skill name was said */ return { k: x.k, h, w }; })
            .filter((x) => x.h && (x.h >= 2 || x.w >= 0.5)).sort((a, b) => (b.w - a.w) || (b.h - a.h));
    }
    const NOT_YOURS = 'Sorry, this is not part of your access areas.';
    let choice = null; // [skill, skill] while she asks "A or B?"
    const spoken = (n) => String(n || '').replace(/\?$/, '').replace(/\s*\/\s*/g, ' or ');
    async function openSkill(k) {
        say('Opening ' + spoken(k.name) + '.' + (k.asks ? ' Please fill in the boxes on screen.' : ''));
        try { await A().runTpl(k.id); } catch (_) {}
    }
    function choiceEcho(t) { // her own "Did you mean A, or B?" heard back: it holds both names (or "did you mean")
        if (/did you mean/i.test(t)) return true;
        const [a, b] = choice; const w = new Set(words(t));
        const has = (k) => words(k.name).filter((x) => x.length > 2).every((x) => w.has(x));
        return has(a) && has(b);
    }
    let pickTries = 0;
    function pick(t) {
        const [a, b] = choice;
        const nm = (k) => words(k.name).filter((x) => x.length > 2);
        const w = new Set(words(t));
        const full = [a, b].filter((k) => nm(k).length && nm(k).every((x) => w.has(x) || w.has(x.replace(/s$/, '')) || w.has(x + 's')));
        full.sort((x, y) => nm(y).length - nm(x).length);
        if (full.length === 1 || (full.length === 2 && nm(full[0]).length > nm(full[1]).length)) { choice = null; pickTries = 0; paint(); return openSkill(full[0]); }
        choice = null; paint();
        if (/\b(first|one|1|a|former)\b/i.test(t)) return openSkill(a);
        if (/\b(second|two|2|b|last|latter|other)\b/i.test(t)) return openSkill(b);
        const r = match(t).filter((x) => x.k.id === a.id || x.k.id === b.id);
        if (r.length && (r.length === 1 || r[0].w > r[1].w * 1.3)) { pickTries = 0; return openSkill(r[0].k); }
        if (/\b(?:no|none|neither|never ?mind|cancel|stop)\b/i.test(t) || ++pickTries > 1) { pickTries = 0; say('Okay, never mind.'); return; }
        choice = [a, b]; const q = 'Sorry, say first for ' + spoken(a.name) + ', or second for ' + spoken(b.name) + '.'; note('IRIS: ' + q); say(q); paint();
    }
    // ---------------------------------------------------------------------------------------------
    // 18.0.0 patch 31 (martin): voice control in the window in front (works in every pop-up / page):
    //   "Iris, tick Khalifa Steel" / "untick row 3" / "tick all"   "Iris, press Check notes"
    //   "Iris, change the invoice value to 1000" / "set status to With Accounts" / "change attention to Imran"
    // Buttons that save or change data ask yes / no first. A changed box is said back. She never saves by herself.
    const DANGER = /\b(add|create|save|update|proceed|approve|reject|submit|delete|remove|send|apply|confirm|close ?out|cancel|pay|paid|forward|post|transfer|convert|archive|clear)\b/i;
    const SYN = { amt: 'amount', inv: 'invoice', no: 'number', num: 'number', qty: 'quantity', attn: 'attention', srv: 'srv', po: 'po', ref: 'reference', desc: 'description' };
    const FSTOP = new Set(['the', 'a', 'an', 'to', 'of', 'for', 'my', 'please', 'this', 'that', 'it', 'on', 'in', 'box', 'field', 'button']);
    const ftoks = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean).map((w) => SYN[w] || stem(w)).filter((w) => !FSTOP.has(w));
    const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };
    function vis(el) {
        if (!el || !el.getClientRects || !el.getClientRects().length) return false;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0') return false;
        const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2;
    }
    function zOf(el) { let z = 0; for (let e = el; e && e !== document.body; e = e.parentElement) { const v = parseInt(getComputedStyle(e).zIndex, 10); if (v > z) z = v; } return z; }
    const notMine = (el) => !el.closest('#iba-ai-panel, #iba-talk-bar, #iba-ai-fab');
    function frontRoot() {
        const c = Array.from(document.querySelectorAll('.modal, [role="dialog"], [class*="modal"], [id*="modal"], [class*="popup"], [id*="popup"], [class*="overlay"]'))
            .filter((el) => notMine(el) && !el.querySelector('#iba-ai-panel') && vis(el) && el.querySelector('input, select, textarea, button'));
        if (!c.length) return document.body;
        const z = Math.max.apply(null, c.map(zOf));
        const top = c.filter((el) => zOf(el) === z);
        const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
        const full = innerWidth * innerHeight * 0.92;
        const boxed = top.filter((el) => area(el) < full);
        const best = (boxed.length ? boxed : top).sort((x, y) => area(y) - area(x))[0];
        return best;
    }
    function fuzz(qt, label, df) {
        const L = ftoks(label); if (!L.length || !qt.length) return 0;
        const ls = new Set(L); let hit = 0, w = 0;
        qt.forEach((q1) => { if (ls.has(q1) || L.some((l) => l.length >= 3 && q1.length >= 3 && (l.startsWith(q1) || q1.startsWith(l)))) { hit++; w += 1 / ((df && df[q1]) || 1); } });
        if (!hit) return 0;
        return w + hit / L.length + (hit === qt.length ? 0.5 : 0);
    }
    function bestOf(items, q, textOf) {
        const qt = ftoks(q);
        const df = {}; items.forEach((el) => new Set(ftoks(textOf(el))).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
        const r = items.map((el) => ({ el, s: fuzz(qt, textOf(el), df) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
        if (!r.length) return { none: true };
        if (r.length > 1 && r[1].s >= r[0].s - 0.05 && textOf(r[0].el) !== textOf(r[1].el)) return { two: [r[0].el, r[1].el] };
        return { one: r[0].el };
    }
    function rowOf(cb) { return cb.closest('tr, li, label, [class*="row"], [class*="item"], [class*="card"]') || cb.parentElement; }
    const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    function rowText(cb) { return clean(rowOf(cb).innerText).slice(0, 160); }
    function boxes(root) {
        return Array.from(root.querySelectorAll('input[type="checkbox"]')).filter((cb) => notMine(cb) && !cb.disabled && (vis(cb) || vis(cb.closest('label') || cb.parentElement)));
    }
    function setTick(cb, want) { if (cb.checked !== want) { const l = cb.closest('label'); (vis(cb) || !l ? cb : l).click(); if (cb.checked !== want) { cb.checked = want; cb.dispatchEvent(new Event('change', { bubbles: true })); } } }
    function tickRows(rest, want) {
        const root = frontRoot();
        const all = boxes(root);
        if (!all.length) { say('I can’t find anything to tick in this window.'); return; }
        const isAll = (cb) => !!cb.closest('thead, th') || /\b(select|tick|check) all\b|^all$/i.test(clean((cb.closest('label') || {}).innerText || cb.title || cb.getAttribute('aria-label') || ''));
        const rows = all.filter((cb) => !isAll(cb));
        if (/^\s*(?:everything|all|every (?:one|row|line))\b/i.test(rest)) {
            const head = all.find(isAll);
            if (head) setTick(head, want);
            rows.forEach((cb) => setTick(cb, want));
            say((want ? 'Ticked all ' : 'Unticked all ') + rows.length + '.'); return;
        }
        const n = rest.match(/\b(?:row|line|number|no)\.?\s*(\d{1,3})\b/i) || rest.match(/\b(?:row|line|number)\s+([a-z]+)\b/i) || rest.match(/^\s*(\d{1,3}|first|second|third|fourth|fifth|last)\b(?:\s+(?:one|row|line))?\s*$/i);
        if (n) {
            let k = /^\d+$/.test(n[1]) ? Number(n[1]) : NUMW[n[1].toLowerCase()];
            if (k === undefined) { say('Which row? Say a number, like row 3.'); return; }
            if (k === -1) k = rows.length;
            const cb = rows[k - 1];
            if (!cb) { say('There is no row ' + n[1] + '. I see ' + rows.length + ' rows.'); return; }
            setTick(cb, want); say((want ? 'Ticked row ' : 'Unticked row ') + k + '.'); return;
        }
        const r = bestOf(rows, rest, rowText);
        if (r.none) { say('I can’t find ' + rest + ' in this window.'); return; }
        if (r.two) { const a = rows.indexOf(r.two[0]) + 1, b = rows.indexOf(r.two[1]) + 1; say('I see two: row ' + a + ' and row ' + b + '. Say tick row ' + a + ' or row ' + b + '.'); return; }
        setTick(r.one, want); say((want ? 'Ticked ' : 'Unticked ') + rowText(r.one).split(' ').slice(0, 5).join(' ') + '.');
    }
    function btnText(b) { return clean(b.textContent || b.value || b.getAttribute('aria-label') || b.title || ''); }
    function press(rest, sure) {
        const root = frontRoot();
        const btns = Array.from(root.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"], [role="button"]')).filter((b) => notMine(b) && vis(b) && !b.disabled && btnText(b));
        const r = bestOf(btns, rest, btnText);
        if (r.none) { say('I can’t find a ' + rest + ' button here.'); return; }
        if (r.two) { say('Which one: ' + btnText(r.two[0]) + ', or ' + btnText(r.two[1]) + '?'); return; }
        const label = btnText(r.one);
        if (!sure && DANGER.test(label)) { pendingAct = () => { r.one.click(); say('Done, I pressed ' + label + '.'); }; pending = 'press ' + label; note('IRIS: Press “' + label + '”? Say yes or no.'); say('Press ' + label + '? Say yes or no.'); paint(); return; }
        r.one.click(); say('Pressed ' + label + '.');
    }
    function fieldLabel(f) {
        let t = '';
        if (f.id) { const l = document.querySelector('label[for="' + CSS.escape(f.id) + '"]'); if (l) t = l.textContent; }
        if (!t) { const l = f.closest('label'); if (l) t = l.textContent; }
        if (!t) t = f.getAttribute('aria-label') || '';
        if (!t) { const g = f.closest('.form-group, .field, [class*="field"], [class*="group"], td, .grid-cell'); const l = g && g.querySelector('label, .label, small, b'); if (l && !l.contains(f)) t = l.textContent; }
        if (!t) t = f.placeholder || '';
        if (!t) t = String(f.name || f.id || '').replace(/^im-|^iba-/, '').replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
        return clean(t).slice(0, 60);
    }
    function fields(root) {
        return Array.from(root.querySelectorAll('input:not([type]), input[type="text"], input[type="number"], input[type="search"], input[type="email"], input[type="tel"], input[type="date"], textarea, select'))
            .filter((f) => notMine(f) && !f.disabled && !f.readOnly && (vis(f) || (f.tagName === 'SELECT' && f.closest('.choices') && (vis(f.closest('.choices')) || (f.id && vis(document.querySelector('label[for="' + CSS.escape(f.id) + '"]')))))));
    }
    function nativeSet(f, v) {
        const proto = f.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : f.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const d = Object.getOwnPropertyDescriptor(proto, 'value'); if (d && d.set) d.set.call(f, v); else f.value = v;
        f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function pickChoices(sel, val) {
        const box = sel.closest('.choices'); const inner = box.querySelector('.choices__inner') || box;
        ['mousedown', 'mouseup', 'click'].forEach((t) => inner.dispatchEvent(new MouseEvent(t, { bubbles: true })));
        await wait(120);
        const inp = box.querySelector('input.choices__input--cloned, input[type="search"], input[type="text"]');
        if (inp) { inp.focus(); nativeSet(inp, val); inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' })); await wait(300); }
        const items = Array.from(box.querySelectorAll('.choices__list--dropdown .choices__item--selectable, .choices__list[role="listbox"] .choices__item--choice')).filter((i) => !i.classList.contains('has-no-choices') && !i.classList.contains('has-no-results'));
        const r = bestOf(items, val, (i) => i.innerText);
        if (r.none) { try { inp && nativeSet(inp, ''); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (_) {} return { none: true }; }
        if (r.two) { const t = [clean(r.two[0].innerText), clean(r.two[1].innerText)]; try { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (_) {} return { two: t }; }
        ['mousedown', 'mouseup', 'click'].forEach((t) => r.one.dispatchEvent(new MouseEvent(t, { bubbles: true })));
        await wait(150);
        return { one: clean(r.one.innerText).split('\n')[0] };
    }
    async function change(what, val) {
        const root = frontRoot();
        const fs = fields(root);
        const r = bestOf(fs, what, fieldLabel);
        if (r.none) return false; // not a box here: maybe a skill ("set a reminder to ...")
        if (r.two) { say('Which box: ' + fieldLabel(r.two[0]) + ', or ' + fieldLabel(r.two[1]) + '?'); return; }
        const f = r.one, label = fieldLabel(f);
        let v = clean(val).replace(/[.]$/, '');
        if (f.tagName === 'SELECT') {
            if (f.closest('.choices')) {
                const c = await pickChoices(f, v);
                if (c.none) { say('I can’t find ' + v + ' in the ' + label + ' list.'); return; }
                if (c.two) { say('I see ' + c.two[0] + ' and ' + c.two[1] + '. Which one?'); return; }
                say(label + ' is now ' + c.one.replace(/\s*\(.*$/, '') + '.'); return;
            }
            const o = bestOf(Array.from(f.options).filter((x) => !x.disabled && x.value !== ''), v, (x) => x.text);
            if (o.none) { say('I can’t find ' + v + ' in the ' + label + ' list.'); return; }
            if (o.two) { say('I see ' + o.two[0].text + ' and ' + o.two[1].text + '. Which one?'); return; }
            nativeSet(f, o.one.value); say(label + ' is now ' + o.one.text + '.'); return;
        }
        if (f.type === 'number' || /value|amount|amt|price|total|qty|quantity/i.test(label)) {
            const n = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
            if (!n) { say('Please say a number for ' + label + '.'); return; }
            v = n[0];
        }
        f.focus(); nativeSet(f, v); try { f.blur(); } catch (_) {}
        say(label + ' is now ' + (/^-?\d+(?:\.\d+)?$/.test(v) ? Number(v).toLocaleString('en-US') : v) + '.');
    }
    // 18.0.0 patch 34: "clear the list / clear the batch (in batch entry)" = Batch Entry's red eraser button
    function clearBatchBtn() { const b = document.getElementById('im-batch-clear-button'); return b && vis(b) ? b : null; }
    const CLEAR_RE = /^\s*(?:please\s+)?(?:clear|empty|reset|remove all(?: the)?(?: cards| rows)?(?: from)?)\s+(?:all\s+)?(?:the\s+)?(?:list|batch|cards?|rows?|batch entry|batch list)\b/i;
    async function voiceControl(q, sure) {
        if (CLEAR_RE.test(q) && (/batch/i.test(q) || clearBatchBtn())) {
            const b = clearBatchBtn();
            if (!b) { say('Open Batch Entry first, then ask me to clear it.'); return true; }
            if (!sure) { pendingAct = () => { b.click(); say('Done, the batch is cleared. Nothing saved was touched.'); }; pending = 'clear the batch'; note('IRIS: Clear every card in Batch Entry? Say yes or no.'); say('Clear every card in Batch Entry? Say yes or no.'); paint(); return true; }
            b.click(); say('Done, the batch is cleared. Nothing saved was touched.'); return true;
        }
        let m = q.match(/^\s*(?:please\s+)?(tick|untick|uncheck|unselect|deselect|untik|select|check)\s+(.+)$/i);
        if (m) {
            const verb = m[1].toLowerCase(), rest = m[2];
            if (verb === 'check' && !/^\s*(?:all|everything|row|line|number|\d)/i.test(rest)) return false; // "check notes" is a button
            tickRows(rest, !/^un|^de/.test(verb)); return true;
        }
        m = q.match(/^\s*(?:please\s+)?(?:press|click|hit|tap|push)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button)?\s*$/i);
        if (m) { press(m[1], sure); return true; }
        m = q.match(/^\s*(?:please\s+)?(?:change|set|put|make|update|edit)\s+(?:the\s+)?(.+?)\s+(?:to|as|into|=|is)\s+(.+)$/i);
        if (m && (await change(m[1], m[2])) !== false) return true;
        return false;
    }
    // 18.0.0 patch 32: "Iris, open Invoice Entry" / "go to Batch Entry page" = the page itself (no AI)
    const PAGES = [['dashboard', 'Dashboard', 'dashboard home'], ['wd-add-job', 'Add New Job', 'add new job job entry'], ['wd-active-task', 'Active Task', 'active task tasks'],
        ['wd-job-records', 'Job Records', 'job records'], ['inv-active-job', 'Active Job', 'active job inventory'], ['inv-work-history', 'Work History', 'work history'],
        ['inv-request-review', 'Request Review', 'request review'], ['inv-material-stock', 'Material Stock', 'material stock'], ['im-invoice-entry', 'Invoice Entry', 'invoice entry'],
        ['im-batch-entry', 'Batch Entry', 'batch entry'], ['im-summary-note', 'Summary Note', 'summary note'], ['im-reporting', 'Invoice Records', 'reporting invoice records report'],
        ['im-payments', 'Payments', 'payments payment'], ['im-po-closeout', 'PO Close Out', 'po close out closeout'], ['settings', 'Settings', 'settings']];
    function pageOf(q) {
        const t = String(q || '').toLowerCase().replace(/^\s*(?:please\s+)?(?:open|go to|goto|show|take me to|switch to|bring up)\s+(?:me\s+)?(?:the\s+|my\s+)?/, '').replace(/\s+(?:page|screen|window|modal|tab)\s*$/, '');
        const Q = ftoks(t); if (!Q.length) return null;
        let best = null;
        PAGES.forEach((p) => {
            const name = ftoks(p[1]), al = new Set(ftoks(p[2] + ' ' + p[1]));
            if (!name.every((w) => Q.includes(w))) return;          // the whole page name was said
            const extra = Q.filter((w) => !al.has(w)).length;       // and (almost) nothing else
            if (extra > 0) return;
            if (!best || name.length > best.n) best = { key: p[0], name: p[1], n: name.length };
        });
        return best;
    }
    async function run(q, sure) {
        try { if (await voiceControl(q, sure)) return; } catch (err) { console.warn('[iris] voice control', err); say('Sorry, I could not do that here.'); return; }
        if (!sure && RISKY.test(q)) { pending = q; note('IRIS: You said “' + q + '”. Should I go ahead? Say yes or no.'); say('You said: ' + q.replace(/[.?!]+$/, '') + '. Should I go ahead? Say yes or no.'); paint(); return; }
        for (let i = 0; i < 60 && busy(); i++) await new Promise((r) => setTimeout(r, 500));
        if (/^(?:(?:show|open|list|tell me)\s+(?:me\s+)?)?(?:all\s+|my\s+)?(?:the\s+)?skills\b|what can you do|help me\s*$|^help$/i.test(q)) {
            try { if (A().open) A().open(); const b = document.querySelector('#iba-ai-panel [data-ai="skills"]'); if (b) b.click(); } catch (_) {}
            say('Here are all your skills on the screen. Say the name of one, like: Iris, notes to accounts.'); return;
        }
        const pg = pageOf(q);
        if (pg && typeof window.ibaShellPageAllowed === 'function' && !window.ibaShellPageAllowed(pg.key)) { say(NOT_YOURS); return; }
        if (pg && typeof window.ibaOpenShellPage === 'function') { say('Opening ' + pg.name + '.'); try { await window.ibaOpenShellPage(pg.key); } catch (_) {} return; }
        if (!/\b\d{4,6}\b|\b(?:trf|stk|use|ret)\b/i.test(q)) { // a PO / transfer number is answered by the assistant without the AI
            const all = match(q, true);
            if (all.length && all[0].k.denied && (all.length === 1 || all[0].w > all[1].w * 1.3)) { say(NOT_YOURS); return; }
            const r = all.filter((x) => !x.k.denied);
            if (r.length && (r.length === 1 || r[0].w > r[1].w * 1.3)) return openSkill(r[0].k);
            if (r.length > 1) { choice = [r[0].k, r[1].k]; const t = 'Did you mean ' + spoken(r[0].k.name) + ', or ' + spoken(r[1].k.name) + '?'; note('IRIS: ' + t); say(t); paint(); return; }
        }
        const log = document.getElementById('iba-ai-log');
        const before = log ? log.querySelectorAll('.iba-ai-msg.is-bot').length : 0;
        const lastEl = () => { const l = log && log.querySelectorAll('.iba-ai-msg, .iba-ai-note, .iba-ai-card'); return l && l.length ? l[l.length - 1] : null; };
        const mark = lastEl();
        paint();
        // 18.0.0 patch 32 (martin): Talk mode NEVER uses the AI (no token limit): skills, voice control and the
        // assistant's own lookups (PO / transfer numbers, names) only
        let res = 'no-ai';
        try { if (A().askLocal) res = await A().askLocal(q); } catch (_) {}
        if (res === 'no-ai') {
            const t = 'Sorry, I don’t have a skill for that. Say: Iris, all skills, to see what I can do.';
            note('IRIS: I heard “' + q + '”. ' + t); say(t); return;
        }
        const after = log ? log.querySelectorAll('.iba-ai-msg.is-bot').length : 0;
        if (after > before) return; // the AI answered and the assistant already speaks it
        const el = lastEl();
        if (!el || el === mark) { say('Sorry, I could not do that.'); return; }
        if (el.classList.contains('iba-ai-note')) { say(el.innerText.replace(/\s+/g, ' ').slice(0, 260)); return; }
        say('Here it is on your screen.');
    }

    function tick() {
        if (!on) return;
        const tk = talking();
        if (wasTalking && !tk) follow = Date.now() + FOLLOW;
        wasTalking = tk;
        if (Date.now() - lastCmd > IDLE_OFF) { setOn(false); note('Talk mode went off after 15 minutes without a question. Press the headset button to talk again.'); return; }
        paint();
    }
    function setOn(v) {
        v = !!v && !!SR && !phone();
        if (v === on) { paint(); return; }
        on = v; muted = false; pending = null; pendingAct = null; choice = null; follow = 0;
        clearInterval(poll);
        if (on) {
            lastCmd = Date.now();
            try { if (A().open) A().open(); } catch (_) {}
            start();
            poll = setInterval(tick, 300);
            say('Hi, I’m Iris. Say Iris, then your question.');
        } else {
            stopRec();
            try { A().stopSpeak && A().stopSpeak(); } catch (_) {}
        }
        paint();
        return on;
    }
    document.addEventListener('click', (e) => {
        const t = e.target.closest && e.target.closest('#iba-ai-talk, [data-talk-mute], [data-talk-end]');
        if (!t) return;
        e.preventDefault(); e.stopPropagation();
        if (t.id === 'iba-ai-talk') { setOn(!on); return; }
        if (t.hasAttribute('data-talk-end')) { setOn(false); return; }
        muted = !muted;
        if (muted) stopRec(); else { lastCmd = Date.now(); start(); }
        paint();
    }, true);
    // 18.0.0 patch 34 (martin): window commands TYPED in the chat ("clear the batch", "tick 62812", "press Check notes",
    // "change status to With Accounts") run here without the AI, but ALWAYS after Proceed (button, or say "proceed").
    const CMD_RE = /^\s*(?:please\s+)?(?:tick|untick|uncheck|unselect|deselect|select|check|press|click|hit|tap|push|change|set|put|make|update|edit|clear|empty|reset|remove all)\b/i;
    function isCmd(q) {
        if (CLEAR_RE.test(q)) return true;
        if (!CMD_RE.test(q)) return false;
        if (/^\s*(?:please\s+)?(?:change|set|put|make|update|edit)\b/i.test(q) && !/\s(?:to|as|into|=|is)\s/i.test(q)) return false; // "set a reminder" etc.
        if (/^\s*(?:please\s+)?check\b/i.test(q) && !/^\s*(?:please\s+)?check\s+(?:all|everything|row|line|number|\d)/i.test(q)) return false; // "check po 62812" = a question
        return true;
    }
    async function runTyped(q) {
        typedMode = true;
        try { await voiceControl(q, true); } catch (err) { console.warn('[iris] typed', err); say('Sorry, I could not do that here.'); }
        finally { typedMode = false; }
    }
    function typed(text, before) {
        const q = String(text || '').replace(WAKE, '').replace(/\s+in\s+(?:the\s+)?batch(?:\s+entry)?\s*$/i, ' batch').replace(/[.!]+$/, '').trim();
        if (!q || !isCmd(q)) return false;
        try { before && before(); } catch (_) {}
        const log = $('iba-ai-log'); if (!log) return false;
        const d = document.createElement('div');
        d.className = 'iba-ai-card is-action iba-iris-confirm';
        d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-circle-question"></i> IRIS: proceed?</div>' +
            '<p class="iba-ai-foot">' + q.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]) + '</p>' +
            '<p class="iba-ai-foot"><button type="button" class="iba-ai-mini is-main" data-iris-go><i class="fa-solid fa-check"></i> Proceed</button> ' +
            '<button type="button" class="iba-ai-mini" data-iris-no><i class="fa-solid fa-xmark"></i> Cancel</button></p>';
        let done = false;
        const finish = (go) => {
            if (done) return; done = true;
            d.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            if (pending === 'typed') { pending = null; pendingAct = null; paint(); }
            if (go) runTyped(q); else note('IRIS: Okay, cancelled.');
        };
        d.addEventListener('click', (e) => { if (e.target.closest('[data-iris-go]')) finish(true); else if (e.target.closest('[data-iris-no]')) finish(false); });
        log.appendChild(d); try { d.scrollIntoView({ block: 'nearest' }); } catch (_) {}
        if (on) { pending = 'typed'; pendingAct = () => finish(true); say('Proceed? Say proceed, or no.'); paint(); }
        return true;
    }
    window.ibaTalk = { on: () => on, set: setOn, hear, stage, match, pageOf, typed, _vc: voiceControl, _root: frontRoot };
})();
