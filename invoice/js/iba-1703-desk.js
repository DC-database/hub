/* 17.0.3 patch 8: click the praying robot (corner, expanded bar or phone) to
   skip prayer until the next prayer time; the other scenes go on as usual.
   17.0.3 patch 7: the expanded-window bar now changes scene by itself (desk,
   forklift, loader; prayer in prayer time), and the phone assistant's robot
   (.iba-aph-bot) also plays the scenes between standing moments.
   17.0.3 patch 6: more idle scenes for the corner robot - forklift and wheel
   loader (random with the desk), and a calm prayer scene that shows ONLY
   during Doha prayer times (30 min from each adhan; then it is the only
   scene). Vests are blue and white (IBA colours), also on the main robot.
   17.0.3 patch 3: the corner robot itself (#iba-ai-fab, PC only) now and
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

    // ---- 17.0.3 patch 6: more idle scenes ----
    // small robot head (front view) for the drivers, centred on 0,0
    const MINI_HEAD =
        '<g class="sc-mini">' +
          '<circle class="dk-ear" cx="-12.5" cy="2" r="2.6"/><circle class="dk-ear" cx="12.5" cy="2" r="2.6"/>' +
          '<rect class="dk-skull" x="-12" y="-7" width="24" height="17" rx="7"/>' +
          '<rect class="dk-visor" x="-9" y="-4" width="18" height="10" rx="5"/>' +
          '<rect class="dk-eye" x="-5.5" y="-1.5" width="3" height="4.5" rx="1.5"/><rect class="dk-eye" x="2.5" y="-1.5" width="3" height="4.5" rx="1.5"/>' +
          '<path class="dk-hat" d="M-13 -5 Q-13 -17 0 -17 Q13 -17 13 -5 Z"/>' +
          '<rect class="dk-brim" x="-15.5" y="-6.5" width="31" height="3" rx="1.5"/>' +
        '</g>';
    // side-view head for prayer, facing right, centred on 0,0
    const SIDE_HEAD =
        '<rect class="dk-skull" x="-10" y="-9" width="20" height="18" rx="7"/>' +
        '<rect class="dk-visor" x="1" y="-5" width="9" height="9" rx="3.5"/>' +
        '<rect class="dk-eye" x="5" y="-3" width="3" height="4.5" rx="1.5"/>' +
        '<circle class="dk-ear" cx="-3" cy="0" r="2.6"/>' +
        '<path class="dk-hat" d="M-11 -7 Q-11 -19 1 -19 Q12 -19 12 -7 Z"/>' +
        '<rect class="dk-brim" x="-12" y="-8.5" width="28" height="3" rx="1.5"/>';
    const SIDE_BODY = '<rect class="dk-torso" x="-8" y="-11" width="16" height="22" rx="6"/><rect class="dk-vest" x="-8" y="-6" width="16" height="14" rx="4"/><rect class="dk-stripe" x="-8" y="1" width="16" height="2"/>';
    function pose(cls, body, head, extra) {
        return '<g class="pr-pose ' + cls + '">' + (extra || '') +
            '<g transform="' + body + '">' + SIDE_BODY + '</g>' +
            '<g transform="' + head + '">' + SIDE_HEAD + '</g></g>';
    }
    const LEG = (d) => '<path class="pr-leg" d="' + d + '"/>';
    const PRAY_SVG =
        '<svg class="iba-desk-svg is-pray" viewBox="18 2 100 74" aria-hidden="true" focusable="false">' +
          '<defs><linearGradient id="ibaDeskHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B6F84"/><stop offset="1" stop-color="#14364F"/></linearGradient>' +
          '<linearGradient id="ibaDeskHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".55" stop-color="#FACC15"/><stop offset="1" stop-color="#D99A06"/></linearGradient>' +
          '<linearGradient id="ibaDeskVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB923C"/><stop offset="1" stop-color="#EA580C"/></linearGradient></defs>' +
          '<ellipse class="pr-glow" cx="66" cy="76" rx="44" ry="5"/>' +
          // prayer mat
          '<rect class="pr-mat" x="24" y="74" width="88" height="4" rx="1"/><rect class="pr-mat-line" x="26" y="75.3" width="84" height="1.2"/>' +
          '<path class="pr-fringe" d="M24 74.5 h-3 M24 77.5 h-3 M112 74.5 h3 M112 77.5 h3"/>' +
          // standing (qiyam): hands folded on the chest
          pose('pr-stand', 'translate(60 47)', 'translate(61 25)',
              LEG('M57 57 v17 M63 57 v17')) .replace('</g></g>', '</g><rect class="pr-arm" x="58" y="42" width="11" height="3.6" rx="1.8"/></g>') +
          // bowing (ruku): back flat, hands on the knees
          pose('pr-ruku', 'translate(70 50) rotate(-90)', 'translate(90 51) rotate(90)',
              LEG('M57 56 v18 M62 56 v18') + '<path class="pr-armline" d="M76 53 L64 64"/>') +
          // prostration (sujood): forehead, hands and knees on the mat
          pose('pr-sujud', 'translate(61 64) rotate(-74)', 'translate(84 63) rotate(90)',
              '<rect class="pr-shin" x="36" y="68.5" width="23" height="5.5" rx="2.7"/>' + LEG('M47 62 L58 70') + '<path class="pr-armline" d="M70 64 L76 71"/><rect class="pr-hand" x="73" y="70.5" width="8" height="3.5" rx="1.7"/>') +
          // sitting between the prostrations (jalsa): hands on the knees
          pose('pr-sit', 'translate(50 56)', 'translate(51 35)',
              '<rect class="pr-shin" x="40" y="68.5" width="24" height="5.5" rx="2.7"/>' + LEG('M50 65 L61 70') + '<path class="pr-armline" d="M53 50 L60 63"/><rect class="pr-hand" x="57" y="62" width="7" height="3.4" rx="1.7"/>') +
        '</svg>';

    const DEFS_VEH = '<defs><linearGradient id="ibaDeskHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B6F84"/><stop offset="1" stop-color="#14364F"/></linearGradient>' +
          '<linearGradient id="ibaDeskHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".55" stop-color="#FACC15"/><stop offset="1" stop-color="#D99A06"/></linearGradient>' +
          '<linearGradient id="ibaDeskYel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE047"/><stop offset="1" stop-color="#EAB308"/></linearGradient></defs>';
    const WHEEL = (cx, cy, r) => '<g class="vh-wheel" style="transform-origin:' + cx + 'px ' + cy + 'px"><circle class="vh-tyre" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/><circle class="vh-hub" cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.45) + '"/>' +
          '<path class="vh-spoke" d="M' + (cx - r * 0.45) + ' ' + cy + ' h' + (r * 0.9) + ' M' + cx + ' ' + (cy - r * 0.45) + ' v' + (r * 0.9) + '"/></g>';
    const FORK_SVG =
        '<svg class="iba-desk-svg is-fork" viewBox="0 0 120 84" aria-hidden="true" focusable="false">' + DEFS_VEH +
          '<rect class="vh-ground" x="2" y="79" width="116" height="2.5" rx="1.2"/>' +
          '<g class="vh-drive">' +
            '<g class="vh-puff"><circle cx="16" cy="40" r="3"/><circle cx="12" cy="34" r="2.2"/></g>' +
            '<path class="vh-pipe" d="M20 50 v-8"/>' +
            // overhead guard
            '<path class="vh-cage" d="M36 50 L40 20 H70 V50"/>' +
            // driver
            '<g class="vh-driver"><rect class="dk-torso" x="46" y="38" width="16" height="14" rx="5"/><g transform="translate(54 30)">' + MINI_HEAD + '</g>' +
              '<path class="vh-steer" d="M62 44 L68 40"/><circle class="dk-hand" cx="66" cy="42" r="2.2"/></g>' +
            // body + counterweight
            '<path class="vh-body" d="M18 52 Q18 46 24 46 H34 L36 50 H74 Q78 50 78 54 V70 H18 Z"/>' +
            '<rect class="vh-stripe" x="22" y="60" width="52" height="2.5"/>' +
            WHEEL(32, 71, 8) + WHEEL(68, 71, 7.5) +
            // mast
            '<rect class="vh-mast" x="79" y="14" width="4" height="62" rx="1"/><rect class="vh-mast" x="84" y="18" width="3" height="58" rx="1"/>' +
            // carriage, forks, pallet, boxes: go up and down
            '<g class="vh-lift">' +
              '<rect class="vh-carr" x="86" y="50" width="4" height="26" rx="1"/>' +
              '<rect class="vh-fork" x="88" y="73" width="26" height="3" rx="1"/>' +
              '<rect class="vh-pallet" x="90" y="67" width="23" height="6" rx="1"/><path class="vh-slat" d="M95 67 v6 M101.5 67 v6 M108 67 v6"/>' +
              '<rect class="vh-box" x="92" y="53" width="19" height="14" rx="1.2"/><path class="vh-tape" d="M101.5 53 v14 M92 59 h19"/>' +
            '</g>' +
          '</g>' +
        '</svg>';
    const LOADER_SVG =
        '<svg class="iba-desk-svg is-loader" viewBox="0 0 120 84" aria-hidden="true" focusable="false">' + DEFS_VEH +
          '<rect class="vh-ground" x="2" y="79" width="116" height="2.5" rx="1.2"/>' +
          '<path class="vh-sand" d="M98 79 Q106 68 116 79 Z"/>' +
          '<g class="vh-drive">' +
            '<g class="vh-puff"><circle cx="20" cy="30" r="3"/><circle cx="16" cy="24" r="2.2"/></g>' +
            '<path class="vh-pipe" d="M23 46 v-12"/>' +
            // cab
            '<path class="vh-cab" d="M34 46 V22 Q34 18 38 18 H58 Q62 18 62 22 V46 Z"/><path class="vh-glass" d="M38 22 H58 V38 H38 Z"/>' +
            '<g transform="translate(48 30)">' + MINI_HEAD + '</g>' +
            // body
            '<path class="vh-body" d="M12 50 Q12 44 18 44 H66 L72 50 V68 H12 Z"/>' +
            '<rect class="vh-stripe" x="16" y="56" width="52" height="2.5"/>' +
            WHEEL(26, 68, 11) + WHEEL(62, 68, 11) +
            // boom + bucket: lifts and tips
            '<g class="vh-boom">' +
              '<path class="vh-arm" d="M64 46 L92 60"/>' +
              '<g class="vh-bucket"><path class="vh-bkt" d="M88 52 L104 54 Q106 66 98 72 L86 68 Z"/><path class="vh-teeth" d="M100 72 l2 2 M96 73 l1.6 2 M92 72 l1 2"/>' +
                '<path class="vh-load" d="M89 55 Q96 50 103 55 Z"/></g>' +
            '</g>' +
          '</g>' +
        '</svg>';

    // Doha prayer times (Qatar: Fajr 18°, Asr shadow 1, Isha = Maghrib + 90 min).
    const LAT = 25.2854, LON = 51.531, TZ = 3;
    function prayerTimes(when) {
        const t = new Date((when || Date.now()) + TZ * 3600000);
        const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
        const rad = Math.PI / 180, deg = 180 / Math.PI;
        const yy = m <= 2 ? y - 1 : y, mm = m <= 2 ? m + 12 : m;
        const A = Math.floor(yy / 100), B = 2 - A + Math.floor(A / 4);
        const jd = Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524.5 - LON / 360;
        const D = jd - 2451545.0;
        const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
        const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
        const L = fix(q + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad), 360);
        const e = 23.439 - 0.00000036 * D;
        const RA = fix(Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) * deg / 15, 24);
        const decl = Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) * deg;
        const eqt = q / 15 - RA;
        const noon = fix(12 + TZ - LON / 15 - eqt, 24);
        const T = (angle) => Math.acos((-Math.sin(angle * rad) - Math.sin(decl * rad) * Math.sin(LAT * rad)) / (Math.cos(decl * rad) * Math.cos(LAT * rad))) * deg / 15;
        const asrAngle = -Math.atan(1 / (1 + Math.tan(Math.abs(LAT - decl) * rad))) * deg;
        const hours = { fajr: noon - T(18), dhuhr: noon + 2 / 60, asr: noon + T(asrAngle), maghrib: noon + T(0.833) + 1 / 60 };
        hours.isha = hours.maghrib + 1.5;
        const day0 = Date.UTC(y, m - 1, d) - TZ * 3600000;   // Qatar midnight
        const out = {};
        Object.keys(hours).forEach((k) => { out[k] = day0 + Math.round(hours[k] * 3600000); });
        return out;
    }
    const PRAY_WINDOW = 30 * 60000;     // from the adhan for 30 minutes
    function prayerWindow(now) {          // start of the open prayer window, or 0
        now = now || Date.now();
        const p = prayerTimes(now);
        const k = Object.keys(p).find((x) => now >= p[x] && now < p[x] + PRAY_WINDOW);
        return k ? p[k] : 0;
    }
    // 17.0.3 patch 8: a click on the praying robot skips prayer until the next
    // prayer time (kept per browser)
    const SKIP_KEY = 'iba-pray-skip-v1';
    function skippedWindow() { try { return Number(localStorage.getItem(SKIP_KEY)) || 0; } catch (_) { return 0; } }
    function inPrayerTime(now) {
        const w = prayerWindow(now);
        return !!w && w !== skippedWindow();
    }

    const SCENES = {
        desk: { svg: SVG, ms: 20000 },
        forklift: { svg: FORK_SVG, ms: 18000 },
        loader: { svg: LOADER_SVG, ms: 18000 },
        pray: { svg: PRAY_SVG, ms: 32000 }
    };
    let lastScene = '';
    function pickScene(last) {
        if (inPrayerTime()) return 'pray';
        const not = last === undefined ? lastScene : last;
        const list = ['desk', 'forklift', 'loader'].filter((k) => k !== not);
        return list[Math.floor(Math.random() * list.length)];
    }

    // ---- corner robot: random idle "desk" moments ----
    let deskTimer = 0, endTimer = 0;
    function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    function canIdle(fab) {
        if (!fab || fab.hidden || !fab.classList.contains('is-bot')) return false;
        if (fab.classList.contains('is-open') || fab.classList.contains('is-talking') || (fab.matches(':hover') && !inPrayerTime())) return false;
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
    function startDesk(name) {
        const fab = document.getElementById('iba-ai-fab');
        if (!canIdle(fab)) return false;
        const key = SCENES[name] ? name : pickScene();
        lastScene = key;
        let sc = fab.querySelector('.iba-desk-scene.is-fab');
        if (!sc) {
            sc = document.createElement('span');
            sc.className = 'iba-desk-scene is-fab';
            sc.setAttribute('aria-hidden', 'true');
            fab.appendChild(sc);
        }
        if (sc.dataset.scene !== key) { sc.innerHTML = SCENES[key].svg; sc.dataset.scene = key; }
        void sc.offsetWidth;            // let the fade-in run
        fab.classList.add('is-desk');
        clearTimeout(endTimer);
        endTimer = setTimeout(stopDesk, SCENES[key].ms);
        return true;
    }
    function plan(first) {
        clearTimeout(deskTimer);
        // in prayer time the robot goes to pray soon and more often
        const wait = inPrayerTime() ? 15000 + Math.random() * 30000
            : first ? 30000 + Math.random() * 30000 : 60000 + Math.random() * 90000;
        deskTimer = setTimeout(() => { if (!startDesk()) { deskTimer = setTimeout(() => plan(false), 15000); return; } plan(false); }, wait);
    }
    // anything the robot has to do (open, talk, hover) ends the desk moment
    function watchFab(fab) {
        new MutationObserver(() => {
            if (fab.classList.contains('is-desk') && (fab.classList.contains('is-open') || fab.classList.contains('is-talking') || !fab.querySelector('.iba-desk-scene.is-fab'))) stopDesk();
        }).observe(fab, { attributes: true, attributeFilter: ['class'], childList: true });
        fab.addEventListener('mouseenter', () => { if (fab.classList.contains('is-desk') && !isPraying(fab)) stopDesk(); });
    }
    function findFab() {
        const fab = document.getElementById('iba-ai-fab');
        if (!fab) return false;
        watchFab(fab);
        plan(true);
        return true;
    }

    // 17.0.3 patch 7: a scene box that keeps changing scene by itself
    // (expanded-window bar and phone hero). Stops when the box is gone.
    function rotate(el, first) {
        if (!el.isConnected) return;
        const key = SCENES[first] ? first : pickScene(el.dataset.scene || '');
        if (el.dataset.scene !== key) { el.innerHTML = SCENES[key].svg; el.dataset.scene = key; }
        clearTimeout(el._ibaRot);
        el._ibaRot = setTimeout(() => rotate(el), SCENES[key].ms);
    }
    // phone: the robot at the top of the phone assistant (.iba-aph-bot) stands
    // for a while, then plays a scene, then stands again
    function heroCycle(hero) {
        if (!hero.isConnected) return;
        let sc = hero.querySelector('.iba-desk-scene.is-hero');
        if (!sc) {
            sc = document.createElement('span');
            sc.className = 'iba-desk-scene is-hero';
            sc.setAttribute('aria-hidden', 'true');
            hero.appendChild(sc);
        }
        if (hero.classList.contains('is-scene')) {
            hero.classList.remove('is-scene');
            hero._ibaHero = setTimeout(() => heroCycle(hero), inPrayerTime() ? 8000 : 12000 + Math.random() * 10000);
            return;
        }
        if (document.hidden || reduced()) { hero._ibaHero = setTimeout(() => heroCycle(hero), 15000); return; }
        const key = pickScene(sc.dataset.scene || '');
        if (sc.dataset.scene !== key) { sc.innerHTML = SCENES[key].svg; sc.dataset.scene = key; }
        hero.classList.add('is-scene');
        hero._ibaHero = setTimeout(() => heroCycle(hero), SCENES[key].ms);
    }
    function findHero() {
        document.querySelectorAll('.iba-aph-bot:not([data-desk])').forEach((h) => {
            h.setAttribute('data-desk', '1');
            h._ibaHero = setTimeout(() => heroCycle(h), 6000);
        });
    }

    function isPraying(fab) {
        const sc = fab && fab.querySelector('.iba-desk-scene.is-fab');
        return !!(fab && fab.classList.contains('is-desk') && sc && sc.dataset.scene === 'pray');
    }
    function skipPrayer() {
        const w = prayerWindow();
        if (!w) return;
        try { localStorage.setItem(SKIP_KEY, String(w)); } catch (_) {}
        // corner robot: straight to another scene
        const fab = document.getElementById('iba-ai-fab');
        if (isPraying(fab)) {
            const key = pickScene('pray');
            const sc = fab.querySelector('.iba-desk-scene.is-fab');
            sc.innerHTML = SCENES[key].svg; sc.dataset.scene = key; lastScene = key;
            clearTimeout(endTimer);
            endTimer = setTimeout(stopDesk, SCENES[key].ms);
            plan(false);
        }
        // expanded-window bar
        document.querySelectorAll('.iba-desk-bar .iba-desk-scene[data-scene="pray"]').forEach((el) => rotate(el));
        // phone robot: next scene now
        document.querySelectorAll('.iba-aph-bot .iba-desk-scene.is-hero[data-scene="pray"]').forEach((sc) => {
            const hero = sc.closest('.iba-aph-bot');
            const key = pickScene('pray');
            sc.innerHTML = SCENES[key].svg; sc.dataset.scene = key;
            clearTimeout(hero._ibaHero);
            hero._ibaHero = setTimeout(() => heroCycle(hero), SCENES[key].ms);
        });
    }
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest) return;
        const fab = t.closest('#iba-ai-fab');
        const hit = (fab && isPraying(fab)) || t.closest('.iba-desk-scene[data-scene="pray"]');
        if (!hit) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        skipPrayer();
    }, true);

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
            box.innerHTML = '<span class="iba-desk-scene is-brief" aria-hidden="true"></span><strong class="iba-desk-bar-hi"></strong>';
            const title = bar.querySelector('.iba-ai-wide-title');
            bar.insertBefore(box, title || bar.firstChild);
            rotate(box.querySelector('.iba-desk-scene'), inPrayerTime() ? 'pray' : 'desk');
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
        findHero();
        setInterval(findHero, 3000);    // the phone assistant is built later
        if (!watchWide()) {
            const iv = setInterval(() => { if (watchWide()) clearInterval(iv); }, 1500);
        }
    }

    window.ibaDeskBot = { VERSION: '17.0.3-p8', addBrief, startDesk, stopDesk, prayerTimes, inPrayerTime, skipPrayer, SCENES, SVG };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
