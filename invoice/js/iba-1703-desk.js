/* 17.0.3 patch 3: the corner robot itself (#iba-ai-fab, PC only) now and
   then sits down at a laptop while idle: typing, a coffee sip, a wave, then
   back to standing. The speech bubble stays plain (patch 1 put the scene
   inside the bubble; martin wanted the robot itself to do it).
   17.0.3 patch 2: the same scene sits in the greeting line of the Now brief
   in the expanded (big) assistant window, in place of the sun.
   Pure SVG + CSS (css/iba-1703-desk.css). */
(function () {
    'use strict';
    if (window.ibaDeskBot) return;

    const SVG =
        '<svg class="iba-desk-svg" viewBox="0 0 120 84" aria-hidden="true" focusable="false">' +
          '<defs><linearGradient id="ibaDeskHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B6F84"/><stop offset="1" stop-color="#14364F"/></linearGradient>' +
          '<linearGradient id="ibaDeskHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".55" stop-color="#FACC15"/><stop offset="1" stop-color="#D99A06"/></linearGradient>' +
          '<linearGradient id="ibaDeskVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB923C"/><stop offset="1" stop-color="#EA580C"/></linearGradient></defs>' +
          // chair back
          '<rect class="dk-chair" x="33" y="36" width="54" height="34" rx="11"/>' +
          // body
          '<rect class="dk-torso" x="42" y="49" width="36" height="22" rx="9"/>' +
          '<path class="dk-vest" d="M42 58 q0 -9 9 -9 h3 l6 8 l6 -8 h3 q9 0 9 9 v4 q0 9 -9 9 h-18 q-9 0 -9 -9 z"/>' +
          '<rect class="dk-stripe" x="42" y="62" width="36" height="2.2"/>' +
          // head (the corner robot's head, 80%)
          '<g class="dk-head"><g transform="translate(28 1) scale(.8)">' +
            '<circle class="dk-ear" cx="15" cy="42" r="4.2"/><circle class="dk-ear" cx="65" cy="42" r="4.2"/>' +
            '<rect class="dk-skull" x="16" y="26" width="48" height="33" rx="14"/>' +
            '<rect class="dk-visor" x="22" y="32" width="36" height="20" rx="10"/>' +
            '<g class="dk-eyes"><rect class="dk-eye" x="29" y="37" width="6" height="9" rx="3"/><rect class="dk-eye" x="45" y="37" width="6" height="9" rx="3"/></g>' +
            '<path class="dk-mouth" d="M36 48 q4 3 8 0"/>' +
            '<path class="dk-hat" d="M15 30 Q15 7 40 7 Q65 7 65 30 Z"/>' +
            '<rect class="dk-ridge" x="36.5" y="7.5" width="7" height="22" rx="3.5"/>' +
            '<rect class="dk-brim" x="10" y="27.5" width="60" height="5" rx="2.5"/>' +
            '<circle class="dk-bulb" cx="40" cy="18" r="3.2"/>' +
          '</g></g>' +
          // typing arms: hands peek over the laptop lid
          '<g class="dk-arm dk-arm-l"><path d="M44 54 q-5 2 2 5"/><circle class="dk-hand" cx="47" cy="58.5" r="3"/></g>' +
          '<g class="dk-arm dk-arm-r"><path d="M76 54 q5 2 -2 5"/><circle class="dk-hand" cx="73" cy="58.5" r="3"/></g>' +
          // laptop, back of the screen towards us
          '<path class="dk-lid" d="M42 59 h36 a2 2 0 0 1 2 2 v8 h-40 v-8 a2 2 0 0 1 2 -2 z"/>' +
          '<circle class="dk-logo" cx="60" cy="64.5" r="2.6"/>' +
          '<rect class="dk-base" x="34" y="69" width="52" height="3" rx="1.5"/>' +
          // coffee break: left hand brings a mug to the mouth
          '<g class="dk-sip"><path class="dk-limb" d="M44 54 q-6 -3 6 -8"/><rect class="dk-cup" x="49" y="38.5" width="8" height="9" rx="1.6"/><path class="dk-handle" d="M49 40.5 q-3 0 -3 2.5 q0 2.5 3 2.5"/><circle class="dk-hand" cx="50" cy="46" r="3"/></g>' +
          // hello: right hand up and waving
          '<g class="dk-wave"><path class="dk-limb" d="M76 54 q10 -3 12 -15"/><circle class="dk-hand" cx="88" cy="38" r="3.4"/></g>' +
          // little bits flying out of the laptop
          '<g class="dk-bits"><text class="dk-bit dk-bit-1" x="50" y="50">1</text><text class="dk-bit dk-bit-2" x="62" y="50">✓</text><text class="dk-bit dk-bit-3" x="70" y="50">0</text></g>' +
          // mug with steam
          '<g class="dk-mug"><path class="dk-steam dk-steam-1" d="M19 59 q-2 -3 0 -6 q2 -3 0 -6"/><path class="dk-steam dk-steam-2" d="M23 59 q-2 -3 0 -6 q2 -3 0 -6"/>' +
            '<rect class="dk-cup" x="16" y="61" width="10" height="11" rx="2"/><path class="dk-handle" d="M26 64 q4 0 4 3 q0 3 -4 3"/></g>' +
          // desk
          '<rect class="dk-desk" x="4" y="72" width="112" height="5" rx="2.5"/>' +
        '</svg>';

    // ---- corner robot: random idle "desk" moments ----
    const SHOW_MS = 20000;              // two 10 s loops
    let deskTimer = 0, endTimer = 0;
    function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    function canIdle(fab) {
        if (!fab || fab.hidden || !fab.classList.contains('is-bot')) return false;
        if (fab.classList.contains('is-open') || fab.classList.contains('is-talking') || fab.matches(':hover')) return false;
        if (document.hidden || document.body.classList.contains('iba-phone') || reduced()) return false;
        const tip = document.getElementById('iba-ai-tip');
        if (tip && tip.classList.contains('is-on')) return false;
        const big = document.getElementById('iba-ai-bubble');
        if (big && !big.hidden) return false;
        return true;
    }
    function stopDesk() {
        clearTimeout(endTimer);
        const fab = document.getElementById('iba-ai-fab');
        if (!fab) return;
        fab.classList.remove('is-desk');
        setTimeout(() => {
            if (fab.classList.contains('is-desk')) return;
            const sc = fab.querySelector('.iba-desk-scene.is-fab');
            if (sc) sc.remove();
        }, 400);
    }
    function startDesk() {
        const fab = document.getElementById('iba-ai-fab');
        if (!canIdle(fab)) return false;
        let sc = fab.querySelector('.iba-desk-scene.is-fab');
        if (!sc) {
            sc = document.createElement('span');
            sc.className = 'iba-desk-scene is-fab';
            sc.setAttribute('aria-hidden', 'true');
            sc.innerHTML = SVG;
            fab.appendChild(sc);
        }
        void sc.offsetWidth;            // let the fade-in run
        fab.classList.add('is-desk');
        clearTimeout(endTimer);
        endTimer = setTimeout(stopDesk, SHOW_MS);
        return true;
    }
    function plan(first) {
        clearTimeout(deskTimer);
        const wait = first ? 30000 + Math.random() * 30000 : 60000 + Math.random() * 90000;
        deskTimer = setTimeout(() => { if (!startDesk()) { deskTimer = setTimeout(() => plan(false), 15000); return; } plan(false); }, wait);
    }
    // anything the robot has to do (open, talk, hover) ends the desk moment
    function watchFab(fab) {
        new MutationObserver(() => {
            if (fab.classList.contains('is-desk') && (fab.classList.contains('is-open') || fab.classList.contains('is-talking') || !fab.querySelector('.iba-desk-scene.is-fab'))) stopDesk();
        }).observe(fab, { attributes: true, attributeFilter: ['class'], childList: true });
        fab.addEventListener('mouseenter', () => { if (fab.classList.contains('is-desk')) stopDesk(); });
    }
    function findFab() {
        const fab = document.getElementById('iba-ai-fab');
        if (!fab) return false;
        watchFab(fab);
        plan(true);
        return true;
    }

    // big window: robot + "Good morning, Irwin" go into the fixed top bar
    // (next to "Back to side panel") so they stay put while the brief scrolls
    function addBrief(wb) {
        const bar = document.querySelector('#iba-ai-panel .iba-ai-wide-bar');
        const head = wb.querySelector('.iba-ai-card.is-brief > .iba-ai-card-head');
        let box = bar && bar.querySelector('.iba-desk-bar');
        if (!head || !bar) { if (box) box.remove(); return; }
        // the greeting text in the card head gets a span so it can be hidden there
        let hello = head.querySelector('.iba-desk-hello');
        if (!hello) {
            const tn = Array.from(head.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
            if (!tn) return;
            hello = document.createElement('span');
            hello.className = 'iba-desk-hello';
            hello.textContent = tn.textContent.trim();
            tn.replaceWith(hello);
            head.classList.add('has-desk');
        }
        if (!box) {
            box = document.createElement('span');
            box.className = 'iba-desk-bar';
            box.innerHTML = '<span class="iba-desk-scene is-brief" aria-hidden="true">' + SVG + '</span><strong class="iba-desk-bar-hi"></strong>';
            const title = bar.querySelector('.iba-ai-wide-title');
            bar.insertBefore(box, title || bar.firstChild);
        }
        const hi = box.querySelector('.iba-desk-bar-hi');
        if (hi.textContent !== hello.textContent) hi.textContent = hello.textContent;
    }
    function watchWide() {
        const wb = document.getElementById('iba-ai-wide-body');
        if (!wb) return false;
        addBrief(wb);
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; addBrief(wb); });
        }).observe(wb, { childList: true, subtree: true });
        return true;
    }

    function start() {
        if (!findFab()) {
            const iv = setInterval(() => { if (findFab()) clearInterval(iv); }, 1500);
        }
        if (!watchWide()) {
            const iv = setInterval(() => { if (watchWide()) clearInterval(iv); }, 1500);
        }
    }

    window.ibaDeskBot = { VERSION: '17.0.3-p3', addBrief, startDesk, stopDesk, SVG };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
