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
    // patch 36: more ways the browser writes her name (Irish, Ires, Aris, Eye Ris, I race, Iriz ...)
    const WAKE = /^\s*(?:(?:hi|hey|hello|ok|okay|oh|so|and|yes)[\s,.]+){0,2}(?:iris|irish|iriss?|irises|i ?ris|irus|ires|iras|aris|iriz|irie|eye ?ris|eyes|i race|i rise|iris's)\b['’s]*[\s,.:;!?-]*/i;
    const RISKY = /\b(?:approve|reject|delete|remove|cancel|send|forward)\b|\bmark\b.*\bpaid\b/i;
    const YES = /^\s*(?:yes|yeah|yep|yup|ok|okay|sure|go ahead|do it|confirm|correct|proceed|continue)\b/i;
    const NO = /^\s*(?:no|nope|cancel|stop|don'?t|do not|never ?mind)\b/i;
    const HELLO = /^\s*(?:hi|hello|hey|are you there)\b[\s\w]{0,20}[?.!]*\s*$/i;
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
    // 18.0.0 patch 36 (martin): IRIS sounds, made by the browser (no files): wake = soft rising chime when she hears
    // "Iris", done = light ding when something runs, oops = gentle low tone when she can't. On/off per person
    // (Assistant Settings > Look and voice), on by default.
    const SND_KEY = () => { let k = ''; try { k = localStorage.getItem('approverKey') || ''; } catch (_) {} return 'iba-iris-sound-v1:' + (k || 'me'); };
    // patch 40 (martin): "Hi, <command> please" works like "Iris, <command>" (tick in IRIS settings, on by default).
    // Without "please" at the end a "hi" sentence is ignored, so office greetings don't wake her.
    const HI_KEY = () => SND_KEY().replace('iba-iris-sound-v1:', 'iba-iris-hi-v1:');
    function hiOn() { try { return localStorage.getItem(HI_KEY()) !== '0'; } catch (_) { return true; } }
    function hiCmd(t) {
        if (!hiOn() || WAKE.test(t)) return null;
        const m = String(t || '').match(/^\s*(?:hi|hey|hello)\b[\s,.!]*(.+)$/i); if (!m) return null;
        if (!END_W.test(' ' + m[1]) || !/\bplease\b[\s.!?]*$/i.test(m[1])) return null;
        const c = m[1].replace(END_W, '').replace(/[\s,.]+$/, '').trim();
        return c || null;
    }
    function soundOn() { try { return localStorage.getItem(SND_KEY()) !== '0'; } catch (_) { return true; } }
    let sctx = null;
    function chime(kind) {
        if (!soundOn()) return;
        try {
            const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
            if (!sctx) sctx = new C(); if (sctx.state === 'suspended') sctx.resume().catch(() => {});
            const t0 = sctx.currentTime + 0.01;
            const note = (f, at, dur, type, vol, f2) => {
                const o = sctx.createOscillator(), g = sctx.createGain();
                o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0 + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + at + dur);
                g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
                o.connect(g); g.connect(sctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
            };
            if (kind === 'wake') { note(660, 0, 0.16, 'sine', 0.10); note(990, 0.09, 0.22, 'sine', 0.10); note(1980, 0.09, 0.18, 'sine', 0.025); }
            else if (kind === 'done') { note(1320, 0, 0.35, 'sine', 0.09); note(2640, 0, 0.18, 'sine', 0.025); note(1760, 0.07, 0.3, 'sine', 0.05); }
            else if (kind === 'oops') { note(392, 0, 0.18, 'triangle', 0.09, 370); note(294, 0.13, 0.26, 'triangle', 0.09, 277); }
        } catch (_) {}
    }
    function chimeFor(t) {
        if (/^(?:sorry|i can.t|there is no|open batch entry first|which |did you mean|please say|i see two|i found \d+ people)/i.test(t)) chime('oops');
        else if (/^(?:opening|done|ticked|unticked|pressed|the chat with|your message to|here are all)|\bis now\b/i.test(t)) chime('done');
    }
    let typedMode = false; // 18.0.0 patch 34: a typed command answers in the chat (speaks only while Talk mode is on)
    // patch 39 (martin): her answer is also written in the pill for 7 s (in case the voice is silent) + Console log
    let ansTxt = '', ansUntil = 0;
    let sink = null; // patch 41: phone IRIS page collects her built-in answers instead of speaking here
    function say(t) { if (sink) { sink(String(t || '')); return; } lastSaid = t; ansTxt = String(t || '').replace(/\s+/g, ' ').trim(); ansTxt = ansTxt.length > 70 ? ansTxt.slice(0, 69) + '…' : ansTxt; ansUntil = Date.now() + 7000; setTimeout(paint, 0); setTimeout(paint, 7100); try { console.info('[iris] said:', t); } catch (_) {} chimeFor(String(t || '')); if (typedMode) { note('IRIS: ' + t); if (!on) return; } try { if (A().speak) A().speak(t, { quick: String(t || '').length <= 70 }); } catch (_) {} }
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
    // patch 36: what she heard without her name is shown for 4 s, so you can see if "Iris" was heard as another word
    let heardTxt = '', heardUntil = 0;
    // patch 37 (martin): show the words live in the pill/bar while she hears them, so you can see she heard you right
    let liveTxt = '', liveUntil = 0, liveT = 0, heardAt = 0, soundOn2 = false;
    function liveShow(t) {
        t = String(t || '').replace(/\s+/g, ' ').trim(); if (!t) return;
        liveTxt = t.length > 56 ? '…' + t.slice(-55) : t; liveUntil = Date.now() + 3500; paint();
        clearTimeout(liveT); liveT = setTimeout(paint, 3600);
    }
    function heardShow(t) { heardTxt = String(t).trim().slice(0, 60); heardUntil = Date.now() + 4000; paint(); setTimeout(paint, 4100); }
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
            const ps = pl.querySelector('[data-pill-st]'); if (ps) ps.textContent = (Date.now() < ansUntil && (s === 'speak' || Date.now() >= liveUntil || ansUntil - 7000 > liveUntil - 3500)) ? 'IRIS: ' + ansTxt : (Date.now() < liveUntil && s !== 'speak') ? '“' + liveTxt + '”' : (s === 'listen' && Date.now() < heardUntil) ? 'heard “' + heardTxt + '” · start with Iris' : ({ listen: 'listening', think: 'thinking', speak: 'speaking', muted: 'muted', ask: 'waiting for you' }[s] || '');
            const pm = pl.querySelector('[data-talk-mute]'); if (pm) { pm.innerHTML = muted ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>'; pm.title = muted ? 'Unmute' : 'Mute'; }
        }
        const t = $('iba-ai-talk');
        if (t) { t.classList.toggle('is-on', on); t.title = on ? 'Talk mode is on (click to turn off)' : 'Talk mode: say “Iris, …” and IRIS answers out loud'; }
        const b = on ? bar() : $('iba-talk-bar');
        if (!b) return;
        b.hidden = !on;
        b.className = 'is-' + s;
        const st = b.querySelector('[data-talk-st]'); if (st) st.textContent = (Date.now() < liveUntil && s !== 'speak') ? 'You: “' + liveTxt + '”' : s === 'listen' && Date.now() < follow ? 'Listening… go ahead' : (s === 'listen' && Date.now() < heardUntil) ? 'I heard “' + heardTxt + '”. Start with “Iris”.' : TXT[s];
        const m = b.querySelector('[data-talk-mute]'); if (m) m.innerHTML = muted ? '<i class="fa-solid fa-microphone"></i> Unmute' : '<i class="fa-solid fa-microphone-slash"></i> Mute';
    }

    // 18.0.0 patch 36 (martin): noisy room = the browser waits for silence that never comes. So a sentence that
    // starts with "Iris" (or answers her) is acted on early: when it ends with an end word (please, go, over, now,
    // thanks) or when the words stop changing for 1.5 s. The rest of that sentence is then ignored.
    const END_W = /[\s,.]+(?:please|go|over|now|thanks|thank you|okay go|that's all)[\s.!?]*$/i;
    let stallT = 0, stallTxt = '', doneEarly = '';
    const norm2 = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    function wanted(t) { return WAKE.test(t) || !!hiCmd(t) || !!pending || !!choice || (Date.now() < follow && !talking()); }
    function fire(t) {
        clearTimeout(stallT); stallT = 0;
        const said = String(t || '').replace(END_W, '').trim();
        if (!said) return;
        doneEarly = norm2(t);
        const hc = hiCmd(t);
        hear(hc ? 'Iris ' + hc : said);
        try { if (rec) rec.abort(); } catch (_) {} // start fresh: the noise after it is not added to this sentence
    }
    function early(t) {
        if (!t || talking() || !wanted(t)) return;
        const rest = t.replace(WAKE, '').trim();
        if (WAKE.test(t) && !rest) return; // only her name so far
        if (END_W.test(' ' + t)) { fire(t); return; }
        if (t !== stallTxt) { stallTxt = t; clearTimeout(stallT); stallT = setTimeout(() => { if (stallTxt === t) fire(t); }, 1000); } // patch 40: 1 s (was 1.5 s)
    }
    function start() {
        if (!on || muted || rec || !SR) return;
        try {
            rec = new SR();
            rec.lang = (navigator.language && /^en/i.test(navigator.language)) ? navigator.language : 'en-US';
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            // patch 37: the orb no longer opens the mic itself (a 2nd mic stream can starve speech recognition on
            // some PCs); it moves when the recogniser hears sound / words instead.
            rec.onsoundstart = () => { soundOn2 = true; }; rec.onsoundend = () => { soundOn2 = false; };
            rec.onresult = (e) => {
                fails = 0; heardAt = Date.now();
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i]; const t = (r[0] && r[0].transcript) || '';
                    if (!talking()) liveShow(t);
                    if (!r.isFinal) {
                        if (talking() && WAKE.test(t)) { try { A().stopSpeak(); } catch (_) {} } // barge in
                        early(t); continue;
                    }
                    clearTimeout(stallT); stallT = 0;
                    try { console.info('[iris] heard:', t); } catch (_) {}
                    if (doneEarly && norm2(t).startsWith(doneEarly)) { doneEarly = ''; continue; } // already handled
                    doneEarly = '';
                    hear(t);
                }
            };
            rec.onerror = (e) => {
                const c = e && e.error;
                if (c === 'no-speech' || c === 'aborted') return;
                liveShow('mic problem: ' + c); try { console.warn('[iris] mic', c); } catch (_) {}
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
        const m = t.match(WAKE), hc = m ? null : hiCmd(t);
        let q;
        if (m) { q = t.slice(m[0].length).trim(); chime('wake'); }
        else if (hc) { q = hc; chime('wake'); }
        else if (Date.now() < follow && !talking() && !echo(t)) q = t;
        else { if (!talking() && !echo(t)) heardShow(t); return; }
        if (!m && !hc && /^(?:no|nope|ok|okay|yes|yeah|good|great|nice|cool|nothing|fine|alright|thanks?|thank you)\b[\s\w]{0,12}$/i.test(q)) { if (/thank/i.test(q)) say('You’re welcome.'); follow = 0; return; }
        if (talking()) { try { A().stopSpeak(); } catch (_) {} }
        lastCmd = Date.now();
        if (m || hc) { pending = null; pendingAct = null; choice = null; }
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
    // patch 37 (martin): PO pull-out list "mark all pulled" / "mark PO 57376 pulled" / "mark row 3 not pulled".
    // Each Pulled is a toggle button (data-pull-tick), so we press only the rows that need to change.
    const PULL_RE = /^\s*(?:please\s+)?(un-?mark|mark|tick|untick|set|make|put|turn)\s+(.+?)\s+(?:as\s+|to\s+|is\s+)?(not\s+|un)?pull(?:ed)?(?:\s*out)?\b.*$/i;
    function pullWin() { const w = document.querySelector('#iba-esn.iba-pull'); return w && vis(w) ? w : null; }
    function pullRows(w) {
        return Array.from(w.querySelectorAll('.iba-pull-out tbody tr')).map((tr, i) => {
            const b = tr.querySelector('[data-pull-tick]'), td = tr.children;
            return { i: i + 1, key: b && b.getAttribute('data-pull-tick'), on: tr.classList.contains('is-pulled'), po: clean((td[1] || {}).textContent || ''), sup: clean((td[2] || {}).textContent || '').toLowerCase() };
        }).filter((r) => r.key);
    }
    function markPulled(m, sure) {
        const w = pullWin(); if (!w) return false;
        const want = !(m[3] || /^un/i.test(m[1]));
        let what = m[2].replace(/\b(?:in|on|from)\s+(?:the\s+)?(?:po\s+)?(?:pull-?\s?out\s+)?list\b/ig, '').replace(/\b(?:the|of|them|entries|entry|pos?|items?)\b/ig, ' ').trim();
        const rows = pullRows(w);
        if (!rows.length) { say('The pull-out list is empty.'); return true; }
        let pick;
        if (!what || /^(?:all|every\s*thing|everything|every\s*one|all\s+of)$/i.test(what) || /^all\b/i.test(what)) pick = rows;
        else {
            const nums = what.match(/\d+/g) || [];
            const byRow = /\b(?:row|line|number)\b/i.test(what);
            if (nums.length) pick = rows.filter((r) => nums.some((n) => byRow ? String(r.i) === n : (r.po === n || r.po.endsWith(n) || (n.length <= 2 && String(r.i) === n))));
            else { const t = what.toLowerCase(); pick = rows.filter((r) => r.sup && (r.sup.includes(t) || t.split(/\s+/).every((x) => r.sup.includes(x)))); }
        }
        if (!pick.length) { say('I can’t find ' + what + ' in the pull-out list.'); return true; }
        const todo = pick.filter((r) => r.on !== want);
        const word = want ? 'Pulled' : 'not pulled';
        if (!todo.length) { say(pick.length === 1 ? 'PO ' + pick[0].po + ' is already ' + word + '.' : 'They are already ' + word + '.'); return true; }
        const run = async () => {
            for (const r of todo) { const b = w.querySelector('[data-pull-tick="' + CSS.escape(r.key) + '"]'); if (b) { b.click(); await wait(60); } }
            say('Done, ' + todo.length + (todo.length === 1 ? ' PO' : ' POs') + ' marked ' + word + '. Press Proceed when you are ready.');
        };
        const ask = 'Mark ' + (todo.length === 1 ? 'PO ' + todo[0].po : todo.length + ' POs') + ' as ' + word + '?';
        if (!sure) { pendingAct = run; pending = 'mark ' + word; note('IRIS: ' + ask + ' Say yes or no.'); say(ask + ' Say yes or no.'); paint(); return true; }
        run(); return true;
    }
    async function voiceControl(q, sure) {
        if (CLEAR_RE.test(q) && (/batch/i.test(q) || clearBatchBtn())) {
            const b = clearBatchBtn();
            if (!b) { say('Open Batch Entry first, then ask me to clear it.'); return true; }
            if (!sure) { pendingAct = () => { b.click(); say('Done, the batch is cleared. Nothing saved was touched.'); }; pending = 'clear the batch'; note('IRIS: Clear every card in Batch Entry? Say yes or no.'); say('Clear every card in Batch Entry? Say yes or no.'); paint(); return true; }
            b.click(); say('Done, the batch is cleared. Nothing saved was touched.'); return true;
        }
        let m = q.match(PULL_RE);
        if (m && markPulled(m, sure)) return true;
        m = q.match(/^\s*(?:please\s+)?(tick|untick|uncheck|unselect|deselect|untik|select|check)\s+(.+)$/i);
        if (m) {
            const verb = m[1].toLowerCase(), rest = m[2];
            if (verb === 'check' && !/^\s*(?:all|everything|row|line|number|\d)/i.test(rest)) return false; // "check notes" is a button
            tickRows(rest, !/^un|^de/.test(verb)); return true;
        }
        // patch 37 (martin): "save all 9 entries in batch entry please" / "save" / "submit" = press the Save button here
        m = q.match(/^\s*(?:please\s+)?(save|submit|update)\b(.*)$/i);
        if (m && !/\s(?:to|as|into)\s/i.test(m[2])) {
            const all = /\b(?:all|every|everything|entries|invoices|cards|batch)\b/i.test(m[2]);
            press(m[1].toLowerCase() + (all ? ' all' : ''), sure); return true;
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
        try { if (await builtin(q)) return; } catch (err) { console.warn('[iris] built-in', err); }
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
            // patch 40: first switch-on of the day before noon = good morning + the short brief out loud
            const day = new Date().toLocaleDateString('en-CA', { timeZone: TZ }), hr = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }));
            const MK = SND_KEY().replace('iba-iris-sound-v1:', 'iba-iris-morning-v1:');
            let first = false; try { first = hr >= 4 && hr < 12 && localStorage.getItem(MK) !== day; if (first) localStorage.setItem(MK, day); } catch (_) {}
            if (first) {
                (async () => { let t = ''; try { t = A().pendingSay ? await A().pendingSay() : ''; } catch (_) {} say(t || ('Good morning' + (myFirst() ? ', ' + myFirst() : '') + '! Say Iris, then your question.')); })();
            } else say('Hi, I’m Iris. Say Iris, then your question.');
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
    // 18.0.0 patch 36 (martin): built-in answers, spoken or typed, no AI:
    //   her name ("what is your name", "what does IRIS mean / stand for", "who are you"), the time, the date,
    //   "anything pending I must do?" (the brief, said in words), "send a message to Imran saying ..." (opens the
    //   message window with the text typed in; YOU press Send).
    const NAME_RE = /\b(?:what(?:'s| is) your name|your name|who are you|what are you|introduce yourself|(?:iris|irish) (?:mean|means|stand|stands)|what (?:does|do|is) (?:iris|irish)\b|what (?:does|do) (?:the )?(?:name|it) (?:mean|stand))/i;
    const TIME_RE = /^(?:(?:what(?:'s| is)?|tell me) (?:the )?time(?: is it)?(?: now)?|what time is it(?: now)?|time now|the time)\s*$/i;
    const DATE_RE = /^(?:(?:what(?:'s| is)?|tell me) (?:the )?(?:date|day)(?: today| is it| is today)?|what day is (?:it|today)(?: today)?|today'?s date|what is today)\s*$/i;
    const PEND_RE = /\b(?:pending|anything (?:for me|(?:that )?i (?:must|need to|have to|should) do)|what (?:do|should|must) i (?:do|work on)|what(?:'s| is) waiting(?: for me)?|my (?:tasks|to ?do|work) (?:today|now)|do i have (?:any )?(?:tasks|work))\b/i;
    const MSG_RE = /^(?:please\s+)?(?:send|write)\s+(?:a\s+)?(?:message|msg|text|note|chat)\s+to\s+(.+?)(?:\s*(?:,|:|\bsaying\b|\bthat\b|\babout\b)\s*(.+))?$/i;
    const MSG_RE2 = /^(?:please\s+)?(?:message|tell)\s+([a-z][a-z .']{1,30}?)\s*(?:,|:|\bsaying\b|\bthat\b)\s*(.+)$/i;
    const TZ = 'Asia/Qatar';
    // patch 36: maths ("1 plus 1", "25 times 4 divided by 2", "square root of 81", "20 percent of 500", "2 to the power of 8")
    // patch 37 (martin): Chrome sometimes writes the numbers as words ("one plus one", "twenty five times two")
    const NW = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
        sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
    function numWords(t) {
        return t.replace(/\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|point)(?:[\s-]+|$))+/g, (run) => {
            const w = run.trim().split(/[\s-]+/); let total = 0, cur = 0, dec = '', inDec = false;
            for (const x of w) {
                if (x === 'point') { inDec = true; continue; }
                if (inDec) { if (NW[x] !== undefined && NW[x] < 10) dec += NW[x]; continue; }
                if (x === 'hundred') cur = (cur || 1) * 100;
                else if (x === 'thousand' || x === 'million') { total += (cur || 1) * (x === 'thousand' ? 1e3 : 1e6); cur = 0; }
                else cur += NW[x];
            }
            return ' ' + (total + cur) + (dec ? '.' + dec : '') + ' ';
        });
    }
    function mathOf(q) {
        q = numWords(q.toLowerCase());
        let t = ' ' + q.toLowerCase().replace(/^(?:what(?:'s| is)|how much is|calculate|compute|solve)\s+/, '').replace(/,(?=\d{3})/g, '') + ' ';
        if (!/\d/.test(t)) return null;
        t = t.replace(/\b(?:the|is|equals?|equal to|answer(?: of| to)?|please|what|iris|calculate|of the)\b(?!\s*(?:root|power))/g, ' ');
        t = t.replace(/\bsquare ?root of\b|\bsqrt\b|√/g, ' r ').replace(/\bcube ?root of\b/g, ' c ')
            .replace(/(\d+(?:\.\d+)?)\s*(?:percent|%)\s*of\b/g, '($1/100)*').replace(/(\d+(?:\.\d+)?)\s*(?:percent|%)/g, '($1/100)')
            .replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3').replace(/\bto the power of\b|\bpower of\b|\bto the\b|\*\*/g, '^')
            .replace(/\bplus\b|\band\b/g, '+').replace(/\bminus\b|\bless\b|\btake away\b/g, '-').replace(/\btimes\b|\bmultiplied by\b|\bmultiply(?: by)?\b|\binto\b(?=\s*\d)|(?<=\d)\s*x\s*(?=\d)|×/g, '*')
            .replace(/\bdivided by\b|\bdivide by\b|\bover\b|÷/g, '/').replace(/\bopen bracket\b/g, '(').replace(/\bclose bracket\b/g, ')').replace(/[=?]/g, ' ');
        if (/[a-bd-qs-z]/.test(t.replace(/\b[rc]\b/g, ''))) return null; // other words left: not maths
        const tk = t.match(/\d+(?:\.\d+)?|[-+*/^()rc]/g); if (!tk || !tk.some((x) => /[-+*/^rc]/.test(x))) return null;
        let i = 0;
        const peek = () => tk[i], next = () => tk[i++];
        function prim() { const x = next(); if (x === '(') { const v = expr(); if (next() !== ')') throw 0; return v; } if (x === '-') return -prim(); if (x === 'r') return Math.sqrt(pow()); if (x === 'c') return Math.cbrt(pow()); if (x !== undefined && /^\d/.test(x)) return parseFloat(x); throw 0; }
        function pow() { const b = prim(); if (peek() === '^') { next(); return Math.pow(b, pow()); } return b; }
        function term() { let v = pow(); while (peek() === '*' || peek() === '/') { const o = next(), w = pow(); v = o === '*' ? v * w : v / w; } return v; }
        function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = next(), w = term(); v = o === '+' ? v + w : v - w; } return v; }
        try { const v = expr(); if (i !== tk.length || !isFinite(v)) return null; return Math.round(v * 1e6) / 1e6; } catch (_) { return null; }
    }
    // patch 36: units ("convert 10 inches to meters", "5 feet in cm", "how many cm in 3 inches", "20 kg to pounds")
    const UNITS = { mm: ['l', 0.001, 'millimetres'], millimeter: ['l', 0.001], millimetre: ['l', 0.001], cm: ['l', 0.01, 'centimetres'], centimeter: ['l', 0.01], centimetre: ['l', 0.01],
        m: ['l', 1, 'metres'], meter: ['l', 1], metre: ['l', 1], km: ['l', 1000, 'kilometres'], kilometer: ['l', 1000], kilometre: ['l', 1000],
        in: ['l', 0.0254, 'inches'], inch: ['l', 0.0254], inche: ['l', 0.0254], ft: ['l', 0.3048, 'feet'], foot: ['l', 0.3048], feet: ['l', 0.3048], yard: ['l', 0.9144, 'yards'], yd: ['l', 0.9144], mile: ['l', 1609.344, 'miles'],
        g: ['w', 0.001, 'grams'], gram: ['w', 0.001], kg: ['w', 1, 'kilograms'], kilo: ['w', 1], kilogram: ['w', 1], lb: ['w', 0.45359237, 'pounds'], pound: ['w', 0.45359237], ton: ['w', 1000, 'tonnes'], tonne: ['w', 1000],
        sqm: ['a', 1, 'square metres'], 'square meter': ['a', 1], 'square metre': ['a', 1], sqft: ['a', 0.09290304, 'square feet'], 'square foot': ['a', 0.09290304], 'square feet': ['a', 0.09290304],
        l: ['v', 1, 'litres'], liter: ['v', 1], litre: ['v', 1], gallon: ['v', 3.785411784, 'gallons'], ml: ['v', 0.001, 'millilitres'] };
    const unitOf = (w) => { w = String(w || '').toLowerCase().trim().replace(/\.$/, ''); if (UNITS[w]) return w; const s1 = w.replace(/(?:es|s)$/, ''); if (UNITS[s1]) return s1; const s2 = w.replace(/s$/, ''); return UNITS[s2] ? s2 : ''; };
    const UW = '(square (?:meters?|metres?|feet|foot)|[a-z]+)';
    function convOf(q) {
        const t = numWords(q.toLowerCase()).replace(/\s+/g, ' ').trim().replace(/^(?:please\s+)?(?:convert|change)\s+/, '');
        let m = t.match(new RegExp('^(?:how many|how much)\\s+' + UW + '\\s+(?:in|is|are)\\s+(\\d+(?:\\.\\d+)?)\\s*' + UW + '$'));
        let n, a, b;
        if (m) { b = m[1]; n = m[2]; a = m[3]; }
        else { m = t.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*' + UW + '\\s+(?:to|in|into|as|is how many|in how many)\\s+' + UW + '$')); if (!m) return null; n = m[1]; a = m[2]; b = m[3]; }
        const ua = unitOf(a), ub = unitOf(b); if (!ua || !ub || UNITS[ua][0] !== UNITS[ub][0]) return null;
        const v = Number(n) * UNITS[ua][1] / UNITS[ub][1];
        const nice = (x) => Number(x.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 4 });
        const nm = (u) => { if (UNITS[u][2]) return UNITS[u][2]; const k = Object.keys(UNITS).find((x) => UNITS[x][0] === UNITS[u][0] && UNITS[x][1] === UNITS[u][1] && UNITS[x][2]); return k ? UNITS[k][2] : u + 's'; };
        const one = { inches: 'inch', feet: 'foot', 'square feet': 'square foot' };
        const nm1 = (u, x) => { const w = nm(u); return x === 1 ? (one[w] || w.replace(/s$/, '')) : w; };
        return nice(Number(n)) + ' ' + nm1(ua, Number(n)) + ' is ' + nice(v) + ' ' + nm(ub, v) + '.';
    }
    const JOKES = ['Why did the invoice go to therapy? It had too many unresolved issues.', 'I told the printer a joke. It did not get it, so I sent it again, and again, and again.',
        'Why do accountants never get lost? They always follow the paper trail.', 'Why was the computer cold? It left its Windows open.',
        'What does a PO say to an invoice? I think we are a match.', 'Why did the spreadsheet break up with the calculator? It felt it was being taken for granted, one cell at a time.',
        'Why did the stapler get promoted? It held everything together.', 'My password is the last three digits of pi. Do not tell anyone: one, four, one.',
        'Why do programmers prefer dark mode? Because light attracts bugs.', 'Why was the batch entry so calm? It knew how to handle things one card at a time.'];
    let jokeN = Math.floor(Math.random() * JOKES.length);
    const SMALL = [
        [/^(?:how are you|how are you doing|how(?:'s| is) it going|how do you do|are you ok(?:ay)?)\b/i, () => 'I am doing great, thank you for asking! How can I help you today?'],
        [/^(?:i am|i'm) (?:fine|good|great|ok(?:ay)?|well)\b/i, () => 'Good to hear! Tell me what you need.'],
        [/^(?:what are you doing|what's up|whats up|wassup)\b/i, () => 'Just here, listening and ready to help.'],
        [/^(?:good (?:morning|afternoon|evening))\b/i, (q) => { const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ })); return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + (myFirst() ? ', ' + myFirst() : '') + '!' + (/night/i.test(q) ? ' Have a good rest.' : ''); }],
        [/^(?:thank you|thanks|thank u|thx)\b/i, () => 'You are welcome!'],
        [/^(?:you are|you're) (?:great|good|smart|amazing|awesome|the best|nice|cool|funny)\b/i, () => 'Thank you! You are not bad yourself.'],
        [/^(?:i love you|love you)\b/i, () => 'That is sweet. I am happy to work with you every day.'],
        [/^(?:are you (?:a )?(?:human|real|robot|ai))\b/i, () => 'I am an assistant built into your IBA system, not a human. But I am here every day.'],
        [/^(?:who (?:made|built|created) you)\b/i, () => 'I was built for the IBA system, to help with invoices, approvals and the daily work.'],
        [/^(?:how old are you)\b/i, () => 'I am very new. I started working with you this month.'],
        [/^(?:sorry)\b/i, () => 'No problem at all.'],
        // patch 39 (martin): small talk like a person ("how is your day", "did you eat lunch", "how do you feel")
        [/\bhow(?:'s| is| was) (?:your|ur) (?:day|morning|night|evening|week|weekend)\b/i, () => anyOf(['My day is going well, thank you! Lots of invoices moving. How is yours?', 'Busy but good! How about your day?', 'Pretty good so far. I like it when the approvals are moving. And you?'])],
        [/\b(?:did|have) you (?:eat|ate|eaten|had|have)\b.*\b(?:lunch|dinner|breakfast|food|anything)\b|\bare you hungry\b/i, () => anyOf(['I don’t eat, but thank you for asking! Did you have your lunch?', 'No lunch for me, I run on electricity. Don’t forget to eat yours!', 'Not yet, and never will! But please take your break and eat something.'])],
        [/\bhow (?:do|are) you feel(?:ing)?\b|\bare you (?:happy|sad|ok|okay|fine|alright)\b|\bwhat do you feel\b/i, () => anyOf(['I feel good today, thank you! Talking with you helps.', 'Happy and ready to work. How are you feeling?', 'I am feeling great. No errors today, so far!'])],
        [/\bare you (?:tired|sleepy|bored|busy)\b|\bdo you (?:sleep|rest|get tired)\b/i, () => anyOf(['Never tired! I am here day and night.', 'I don’t sleep, but the screensaver gives me a little rest.', 'Not at all. I like being busy with you.'])],
        [/\b(?:i am|i'm|im|i feel) (?:tired|exhausted|sleepy)\b/i, () => anyOf(['You worked hard today. Take a short break and drink some water.', 'Rest a little. The invoices will still be here, I promise.'])],
        [/\b(?:i am|i'm|im|i feel) (?:sad|stressed|upset|angry|not ok(?:ay)?|bad)\b/i, () => anyOf(['I am sorry to hear that. Take a deep breath, one thing at a time. I am here to help.', 'That sounds hard. Tell me what I can take off your hands.'])],
        [/\b(?:i am|i'm|im|i feel) (?:bored)\b/i, () => 'Want a joke? Say: Iris, tell me a joke.'],
        [/\b(?:i am|i'm|im|i feel) (?:happy|excited|good today)\b/i, () => 'That makes me happy too!'],
        [/\bwhere (?:are you from|do you live|are you)\b/i, () => 'I live inside the IBA system, here in Qatar with you.'],
        [/\bdo you (?:like|love) (?:me|your job|working|work|your work)\b/i, () => anyOf(['Of course! Working with you is the best part of my day.', 'Yes! Helping you is what I like most.'])],
        [/\bdo you have (?:a )?(?:family|friends?|boyfriend|girlfriend|husband|wife)\b|\bare you (?:married|single)\b/i, () => 'My family is the IBA team. You are one of my favourites.'],
        [/\bwhat(?:'s| is) your (?:favourite|favorite) (?:\w+)\b/i, () => 'My favourite thing is an invoice that is fully paid!'],
        [/\b(?:good job|well done|nice work|great job)\b/i, () => 'Thank you! We make a good team.'],
        [/\b(?:good ?night|see you tomorrow|i am going home|i'm going home|going home)\b/i, () => anyOf(['Good night! Rest well, see you tomorrow.', 'Take care going home. See you tomorrow!'])],
        [/\b(?:joke|make me laugh|something funny)\b/i, () => { jokeN = (jokeN + 1) % JOKES.length; return JOKES[jokeN]; }],
        [/^(?:what(?:'s| is) my name|who am i|do you know (?:me|my name))\b/i, () => myFirst() ? 'You are ' + myFull() + '.' : 'I don’t know who is signed in yet.']
    ];
    function anyOf(a) { return a[Math.floor(Math.random() * a.length)]; }
    function myFull() { try { const u = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null; return String((u && (u.Name || u.name)) || '').trim(); } catch (_) { return ''; } }
    function myFirst() { return myFull().split(/\s+/)[0] || ''; }
    // patch 36: forgiving words (typos and short forms) before the built-ins look at it
    const FIX = [[/\b(?:wat|wht|whta|waht|wut|whats|what's|wats)\b/g, 'what is'], [/\b(?:da|teh|th|d)\b/g, 'the'], [/\b(?:iz|si)\b/g, 'is'],
        [/\b(?:nmber|numbr|nuber|numer|nmbr|numbar)\b/g, 'number'], [/\b(?:emial|emai|emil|mail|e-mail|eamil|emal)\b/g, 'email'],
        [/\b(?:mobil|mobail|mobiel|moblie|mob|cell|cellphone|cp)\b/g, 'mobile'], [/\b(?:phon|fone|fon|telephone|tel)\b/g, 'phone'],
        [/\b(?:pls|plz|pliz|plese)\b/g, 'please'], [/\b(?:u)\b/g, 'you'], [/\b(?:r)\b/g, 'are'], [/\b(?:ur|yor)\b/g, 'your'], [/\b(?:whatsap|watsapp|wattsapp|watsap)\b/g, 'whatsapp'],
        [/\b(?:minas|mines|minis)\b/g, 'minus'], [/\b(?:pluss|pls one)\b/g, 'plus'], [/\b(?:devide|divid|dived|devided|divded)\b/g, 'divide'], [/\b(?:tims|time)\b(?=\s*\d)/g, 'times'],
        [/\b(?:swuare|sqaure|squre|sqare|suare)\b/g, 'square'], [/\b(?:rooth|rut|rot)\b/g, 'root'], [/\b(?:inchs|inchis|inces|ince|inche)\b/g, 'inches'], [/\b(?:metre|metr|mter|meeter)s?\b/g, 'meters'],
        [/\b(?:jok|jokes|joek)\b/g, 'joke'], [/\b(?:nam|nmae|naem)\b/g, 'name'], [/\b(?:tim)\b/g, 'time'], [/\b(?:thx|tnx|thanx|thanks?s)\b/g, 'thanks']];
    function fixWords(q) { let t = ' ' + String(q || '').toLowerCase() + ' '; FIX.forEach(([re, w]) => { t = t.replace(re, w); }); return t.replace(/\s+/g, ' ').trim(); }
    const CONTACT_W = /\b(?:mobile|phone|number|contact|email|whatsapp)\b/;
    const FILL = new Set('what is the of his her their give me tell show find get i need want please can you could and or s whats number mobile phone contact email whatsapp address a an for to know details detail info'.split(' '));
    async function builtin(text, before) {
        const q = fixWords(String(text || '').replace(WAKE, '').replace(/[?.!]+$/, '').trim());
        if (!q) return false;
        const go = () => { try { before && before(); } catch (_) {} };
        const wasTyped = !!before;
        const run1 = async (fn) => { go(); if (wasTyped) typedMode = true; try { await fn(); } finally { if (wasTyped) typedMode = false; } return true; };
        // patch 43: the "What can IRIS do?" guide and the About box
        const G = window.ibaIrisGuide;
        if (G && /^(?:what (?:can|else can|do) you do|what are you able to do|how (?:do i|to) use you|help(?: me)?|show (?:me )?(?:the )?(?:guide|commands|help)|(?:iris )?guide|all (?:your )?commands)\b/i.test(q) && q.split(/\s+/).length <= 9) return run1(async () => { G.open('do'); say('Here is what I can do. Tap any example to try it.'); });
        if (G && /^(?:about (?:you|iris)|who are you|tell me about (?:you|yourself|iris))\b/i.test(q)) return run1(async () => { G.open('about'); say('I am IRIS, Intelligent Records and Invoice System, your IBA assistant.'); });
        if (G && NAME_RE.test(q) && q.split(/\s+/).length <= 9) { try { G.open('about'); } catch (_) {} }
        if (NAME_RE.test(q) && q.split(/\s+/).length <= 9) return run1(async () => say('I am IRIS, Intelligent Records and Invoice System, your IBA assistant.'));
        if (TIME_RE.test(q)) return run1(async () => say('It is ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) + '.'));
        if (DATE_RE.test(q)) return run1(async () => say('Today is ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) + '.'));
        if (PEND_RE.test(q) && q.split(/\s+/).length <= 10 && !/\b\d{4,}\b/.test(q) && !/\b(?:approv\w*|invoices?|vendors?|po|transfers?|payments?|site)\b/i.test(q)) return run1(async () => { let t = ''; try { t = A().pendingSay ? await A().pendingSay() : ''; } catch (_) {} say(t || 'Your brief is on the screen.'); });
        // patch 40: "good night" answers, then switches Talk mode off
        if (/^(?:good ?night|goodnight|nighty? night)\b/i.test(q) && q.split(/\s+/).length <= 6) return run1(async () => { say(anyOf(['Good night' + (myFirst() ? ', ' + myFirst() : '') + '! Rest well, see you tomorrow.', 'Good night! Take care going home. See you tomorrow.'])); if (on) setTimeout(() => { if (on) setOn(false); }, 4500); });
        for (const [re, fn] of SMALL) { if (re.test(q) && q.split(/\s+/).length <= 10) return run1(async () => say(fn(q))); }
        const cv = convOf(q); if (cv) return run1(async () => say(cv));
        const mv = mathOf(q); if (mv !== null && mv !== undefined) return run1(async () => say('That is ' + mv.toLocaleString('en-US', { maximumFractionDigits: 6 }) + '.'));
        const cw = CONTACT_W.test(q) && !/\d{3,}/.test(q) && !/\b(?:po|invoice|vendor|supplier|my|your)\b/.test(q) && q.split(/\s+/).length <= 10
            ? q.replace(/'s\b/g, ' ').split(/[^a-z.']+/).filter((w) => w && !FILL.has(w) && !/^(?:mr|ms|mrs|engr|eng)\.?$/.test(w)).join(' ').trim() : '';
        if (cw) {
            const who = cw;
            const wantMail = /email/.test(q), wantTel = /mobile|phone|number|whatsapp|contact/.test(q);
            return run1(async () => {
                let r = {}; try { r = A().contactOf ? await A().contactOf(who) : {}; } catch (_) {}
                if (r.one) {
                    const p = r.one, bits = [];
                    if ((wantTel || !wantMail) && p.mobile) bits.push('mobile ' + (typedMode ? String(p.mobile).trim() : String(p.mobile).replace(/\D+/g, '').split('').join(' ')));
                    if ((wantMail || !wantTel) && p.email) bits.push('email ' + p.email);
                    say(bits.length ? p.name + ': ' + bits.join(', and ') + '. It is on the screen too.' : 'I found ' + p.name + ', but there is no ' + (wantMail ? 'email' : 'number') + ' saved.');
                } else if (r.many) say('I found ' + r.many + ' people for ' + who + '. They are on the screen.');
                else say('I can’t find ' + who + ' in the user list.');
            });
        }
        const m = q.match(MSG_RE) || q.match(MSG_RE2);
        if (m && m[1]) {
            const who = m[1].replace(/\s+(?:please|now)$/i, '').trim(), msg = (m[2] || '').trim();
            return run1(async () => {
                let r = {}; try { r = A().messageTo ? await A().messageTo(who, msg) : {}; } catch (_) {}
                if (r.one) say(r.typed ? 'Your message to ' + r.one + ' is ready. Check it and press Send.' : 'The chat with ' + r.one + ' is open. Type your message and press Send.');
                else if (r.many) say('I found ' + r.many + ' people for ' + who + '. Press Message on the right one.');
                else say('I can’t find ' + who + ' in the user list.');
            });
        }
        return false;
    }
    // 18.0.0 patch 34 (martin): window commands TYPED in the chat ("clear the batch", "tick 62812", "press Check notes",
    // "change status to With Accounts") run here without the AI, but ALWAYS after Proceed (button, or say "proceed").
    const CMD_RE = /^\s*(?:please\s+)?(?:save|submit|mark|unmark|un-mark|tick|untick|uncheck|unselect|deselect|select|check|press|click|hit|tap|push|change|set|put|make|update|edit|clear|empty|reset|remove all)\b/i;
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
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'iba-iris-hi') { try { localStorage.setItem(HI_KEY(), e.target.checked ? '1' : '0'); } catch (_) {} } });
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'iba-iris-snd') { try { localStorage.setItem(SND_KEY(), e.target.checked ? '1' : '0'); } catch (_) {} if (e.target.checked) chime('done'); } });
    async function answer(text) { let out = null; sink = (t) => { out = out ? out + ' ' + t : t; }; try { const ok = await builtin(text); return ok ? out : null; } finally { sink = null; } }
    window.ibaTalk = { answer, mathOf: (q) => mathOf(q), convOf: (q) => convOf(q), hiOn, _hi: hiCmd, heardAt: () => heardAt, sound: () => soundOn2, _early: (t) => early(t), chime, soundOn, on: () => on, set: setOn, hear, stage, match, pageOf, typed, builtin, _vc: voiceControl, _root: frontRoot };
})();
