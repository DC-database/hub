/* 18.0.0 patch 43 (martin): "What can IRIS do?" guide + "About IRIS" (the ⓘ, like a design program's About box).
   Opened by: "Iris, what can you do" (voice or typed), the ? on the IRIS pill / Talk bar, Assistant settings,
   the ⓘ on the phone IRIS page. Each example can be tapped to try it. The "Your skills" list comes from the
   skills this person may use, so it grows by itself when a new skill is added.
   window.ibaIrisGuide.open('do' | 'about') */
(function () {
    'use strict';
    if (window.ibaIrisGuide) return;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const phone = () => !!(document.body && document.body.classList.contains('iba-mobile-ui'));

    // [title, icon, note, [examples]]  - an example in {curly} is a description, not something to tap
    const SECTIONS = [
        ['How to talk to me', 'fa-comment-dots', 'Start with my name, or say hi and end with please. Commands that change something always ask yes or no (typed: Proceed).', [
            'Iris, what time is it', 'Hi, open Batch Entry please', '{Right after I answer, you have a few seconds to reply without my name}',
            '{When I ask “A or B?”, just say first, second, or the name}', '{Noisy room: end with please, go or now and I act straight away}', 'Iris, stop', 'Iris, good night']],
        ['Pages and skills', 'fa-compass', 'Say the page or skill name. Word order and small typos are fine.', [
            'Iris, open Summary Note', 'Iris, open Invoice Records', 'Iris, where is my invoice', 'Iris, open notes to accounts', 'Iris, all skills']],
        ['On the screen', 'fa-hand-pointer', 'I work the window that is open in front of you.', [
            'Iris, save all the entries', 'Iris, press Check notes', 'Iris, tick row 3', 'Iris, tick all', 'Iris, clear the batch',
            'Iris, change status to With Accounts', 'Iris, mark all pulled', 'Iris, mark PO 57376 not pulled']],
        ['Invoices and POs', 'fa-file-invoice', 'On the phone IRIS page (Super Admin) I can also change a status for you.', [
            'PO 12345', 'Brief me', 'What do you have for me', 'What can you do', 'Mark the biggest For Approval to Imran', 'The SRV done one', 'Remind Gio', 'Save a note for the office']],
        ['Lists', 'fa-table-list', 'Invoices in a status and open reception jobs. No AI key needed.', [
            'Iris, pending for IPC', 'Iris, show For SRV invoices', 'Iris, what is On Hold', 'Iris, invoices in CEO Approval', 'Iris, pending IPC Application',
            'Iris, open IPC Processed', 'Iris, show PR', 'Iris, open credit notes', 'Iris, pending original PO', 'Iris, show cancel jobs', 'Iris, show other jobs']],
        ['Quick answers', 'fa-bolt', 'No AI key needed for these.', [
            'Iris, what is today', 'Iris, is there anything pending for me', 'Iris, what is Hafiz mobile number', 'Iris, send a message to Hafiz saying I am on my way',
            'Iris, 25 times 4', 'Iris, square root of 144', 'Iris, 15 percent of 2000', 'Iris, convert 10 inches to cm', 'Iris, 20 kg to pounds', 'Hi multiply 100 by 100 please', 'Iris, 50 linear meter to feet', 'Iris, 20 ft by 10 ft', 'Iris, width 2 meter height 3 meter in square feet', 'Iris, 3 by 2 by 0.5 meters', 'Iris, 20 linear meter at 1.2 meter wide to square meter', 'Iris, 100 C to F']],
        ['Just talking', 'fa-face-smile', 'A little chat is fine too.', [
            'Iris, how is your day', 'Iris, did you eat lunch', 'Iris, tell me a joke', 'Iris, what is my name', 'Iris, what does Iris mean', 'Iris, I am tired']],
        ['What I can’t do yet', 'fa-circle-info', 'Tell martin what you need, and I learn it in the next update.', [
            '{Open questions about anything outside the system need the AI key}', '{Things outside your access areas: I will tell you}', '{I never send a WhatsApp or email by myself: you press Send}',
            '{Talk mode is on the PC; on the phone the Super Admin has the IRIS page}']]
    ];

    function skills() {
        try { return (window.ibaAssistant && window.ibaAssistant.skillList ? window.ibaAssistant.skillList() : []).map((s) => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b)); } catch (_) { return []; }
    }
    function version() {
        let v = '', p = '', d = '';
        try { v = window.IBA_SYSTEM_VERSION || ''; p = window.IBA_PATCH || ''; d = window.IBA_PATCH_DATE || ''; } catch (_) {}
        return (v ? 'IBA System ' + v : '') + (p ? ' · patch ' + p : '') + (d ? ' · ' + d : '');
    }

    function doHtml() {
        const sk = skills();
        return SECTIONS.map((s) => '<section class="igd-sec"><h3><i class="fa-solid ' + s[1] + '"></i> ' + esc(s[0]) + '</h3><p>' + esc(s[2]) + '</p><div class="igd-ex">' +
            s[3].map((x) => /^\{.*\}$/.test(x) ? '<span class="igd-tip">' + esc(x.slice(1, -1)) + '</span>' : '<button type="button" data-igd-try="' + esc(x) + '">“' + esc(x) + '”</button>').join('') + '</div></section>').join('') +
            (sk.length ? '<section class="igd-sec"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> Your skills (' + sk.length + ')</h3><p>Say “Iris,” and the skill name. This list grows when a new skill is added.</p><div class="igd-ex">' +
                sk.map((n) => '<button type="button" data-igd-try="' + esc('Iris, ' + n) + '">' + esc(n) + '</button>').join('') + '</div></section>' : '');
    }
    function aboutHtml() {
        const L = [['I', 'Intelligent', 'understands what you say or type, with or without the AI key'], ['R', 'Records', 'knows your POs, invoices, jobs, stock and people'],
            ['I', 'Invoice', 'follows every invoice from entry to payment'], ['S', 'System', 'built into the IBA system, on the PC and the phone']];
        return '<div class="igd-about"><div class="igd-logo"><span></span></div><div class="igd-name">IRIS</div><div class="igd-full">Intelligent Records &amp; Invoice System</div>' +
            '<div class="igd-letters">' + L.map((x) => '<div><b>' + x[0] + '</b><div><strong>' + x[1] + '</strong><span>' + x[2] + '</span></div></div>').join('') + '</div>' +
            '<p class="igd-brief">IRIS is the IBA assistant you can talk to. Say her name, or hi … please, and she opens pages, runs skills, works the window in front of you, ' +
            'finds POs and colleagues, does quick maths and conversions, and reads you your brief. Anything that changes data asks yes or no first, and she only does what your access allows. ' +
            'She runs on this computer or phone, so most answers need no internet AI and cost nothing.</p>' +
            '<div class="igd-meta"><div><span>Version</span><b>' + esc(version() || 'IBA System') + '</b></div><div><span>Born</span><b>November 2026 (18.0.0)</b></div><div><span>Voice</span><b>Windows voice · Kokoro natural voice (PC)</b></div><div><span>Wake words</span><b>“Iris …”, or “Hi … please”</b></div></div></div>';
    }

    function build() {
        let w = $('iba-igd');
        if (w) return w;
        w = document.createElement('div');
        w.id = 'iba-igd'; w.hidden = true;
        w.innerHTML = '<div class="igd-box" role="dialog" aria-modal="true" aria-label="What can IRIS do?"><div class="igd-head">' +
            '<button type="button" class="igd-tab" data-igd-tab="do"><i class="fa-solid fa-list-check"></i> What can IRIS do?</button>' +
            '<button type="button" class="igd-tab" data-igd-tab="about"><i class="fa-solid fa-circle-info"></i> About IRIS</button>' +
            '<button type="button" class="igd-x" data-igd-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><div class="igd-body" data-igd-body></div></div>';
        document.body.appendChild(w);
        w.addEventListener('click', (e) => {
            if (e.target === w || e.target.closest('[data-igd-x]')) return close();
            const tb = e.target.closest('[data-igd-tab]'); if (tb) return show(tb.getAttribute('data-igd-tab'));
            const tr = e.target.closest('[data-igd-try]'); if (tr) return tryIt(tr.getAttribute('data-igd-try'));
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.hidden) close(); });
        return w;
    }
    function show(tab) {
        const w = build();
        w.querySelectorAll('[data-igd-tab]').forEach((b) => b.classList.toggle('is-on', b.getAttribute('data-igd-tab') === tab));
        w.querySelector('[data-igd-body]').innerHTML = tab === 'about' ? aboutHtml() : doHtml();
        w.querySelector('[data-igd-body]').scrollTop = 0;
    }
    function open(tab) { const w = build(); show(tab === 'about' ? 'about' : 'do'); w.hidden = false; }
    function close() { const w = $('iba-igd'); if (w) w.hidden = true; }
    function tryIt(text) {
        close();
        const ph = $('iba-irisph');
        if (ph && !ph.hidden && window.ibaIrisPhone) { window.ibaIrisPhone.handle(text); return; }
        try { if (window.ibaAssistant && window.ibaAssistant.ask) window.ibaAssistant.ask(text); } catch (_) {}
    }

    // the ? on the IRIS pill / Talk bar, and the link in Assistant settings
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-iris-guide]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        open(b.getAttribute('data-iris-guide'));
    }, true);
    function addButtons() {
        const pill = $('iba-talk-pill');
        if (pill && !pill.querySelector('[data-iris-guide]')) {
            const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-iris-guide', 'do'); b.title = 'What can IRIS do?'; b.innerHTML = '<i class="fa-solid fa-question"></i>';
            const end = pill.querySelector('[data-talk-mute]'); pill.insertBefore(b, end || null);
        }
        const bar = $('iba-talk-bar');
        if (bar && !bar.querySelector('[data-iris-guide]')) {
            const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-iris-guide', 'do'); b.title = 'What can IRIS do?'; b.innerHTML = '<i class="fa-solid fa-question"></i> Help';
            const end = bar.querySelector('[data-talk-mute]'); bar.insertBefore(b, end || null);
        }
        const set = $('iba-kokoro-set');
        if (set && set.innerHTML && !set.querySelector('[data-iris-guide]')) {
            const p = document.createElement('p'); p.className = 'iba-ai-help small';
            p.innerHTML = '<button type="button" class="iba-ai-btn" data-iris-guide="do"><i class="fa-solid fa-list-check"></i> What can IRIS do?</button> <button type="button" class="iba-ai-btn" data-iris-guide="about"><i class="fa-solid fa-circle-info"></i> About IRIS</button>';
            set.appendChild(p);
        }
        const top = document.querySelector('#iba-irisph .iph-top');
        if (top && !top.querySelector('[data-iris-guide]')) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'iph-x iph-i'; b.setAttribute('data-iris-guide', 'about'); b.setAttribute('aria-label', 'About IRIS'); b.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
            const x = top.querySelector('[data-iph-x]'); top.insertBefore(b, x || null);
        }
    }
    setInterval(addButtons, 1200);
    window.ibaIrisGuide = { open, close, _sections: SECTIONS };
})();
