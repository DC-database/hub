/* 18.0.0 patch 34 (martin picked design D): the IRIS orb.
   While Talk mode is on (PC only), the small IRIS pill shows a living orb: a liquid ball of light inside an
   electric ring. The screen edge lights up only while IRIS hears you, thinks or speaks (fades while she waits).
   Colours: listening teal/blue, thinking gold/teal/violet, speaking warm gold, muted grey.
   "Hearing you" follows the real mic level (a small level meter on this PC only, nothing is recorded or sent).
   Reads window.ibaTalk.stage() every frame; draws nothing and holds no mic when Talk mode is off. */
(function () {
    'use strict';
    if (window.ibaOrb) return;
    const $ = (id) => document.getElementById(id);
    const PAL = {
        listen: ['#2fd3c2', '#3a7bd5', '#7be3ff', '#2fd3c2'], hear: ['#2fd3c2', '#3a7bd5', '#7be3ff', '#6ff7d9'],
        think: ['#e0b54a', '#2fd3c2', '#a77bff', '#ff7ab6'], ask: ['#e0b54a', '#2fd3c2', '#a77bff', '#ff7ab6'],
        speak: ['#f3d77a', '#e0b54a', '#ff9d5c', '#2fd3c2'], muted: ['#5b6470', '#3c434c', '#5b6470', '#3c434c'], off: ['#5b6470', '#3c434c', '#5b6470', '#3c434c']
    };
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    const phone = () => !!(document.body && (document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone')));
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
    let cur = PAL.listen.map(hex), t = 0, lvl = 0, raf = 0, cv = null, edge = null;

    // ---- mic level (only while Talk mode is on and not muted) ----
    let mic = null, an = null, buf = null, micCtx = null, micWant = false, micBusy = false;
    async function micOn() {
        if (mic || micBusy || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        micBusy = true;
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            if (!micWant) { s.getTracks().forEach((x) => x.stop()); return; }
            const C = window.AudioContext || window.webkitAudioContext; micCtx = new C();
            an = micCtx.createAnalyser(); an.fftSize = 512; buf = new Uint8Array(an.fftSize);
            micCtx.createMediaStreamSource(s).connect(an); mic = s;
        } catch (_) { mic = null; } finally { micBusy = false; }
    }
    function micOff() { if (mic) { try { mic.getTracks().forEach((x) => x.stop()); } catch (_) {} } mic = null; an = null; if (micCtx) { try { micCtx.close(); } catch (_) {} } micCtx = null; }
    function micLevel() {
        if (!an) return 0;
        an.getByteTimeDomainData(buf); let s = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
        return Math.min(1, Math.sqrt(s / buf.length) * 6);
    }

    // ---- drawing ----
    function blob(c, x, y, r, col, ph, wob) {
        c.beginPath();
        for (let i = 0; i <= 64; i++) {
            const a = i / 64 * Math.PI * 2, k = r * (1 + wob * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 - ph * 1.3) * 0.3 + Math.sin(a * 2 + ph * 0.7) * 0.2));
            const px = x + Math.cos(a) * k, py = y + Math.sin(a) * k; if (i) c.lineTo(px, py); else c.moveTo(px, py);
        }
        c.closePath();
        const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.3);
        g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.6, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.fill();
    }
    function draw(c, W, S) {
        const m = W / 2, sp = S === 'muted' ? 0 : 1, fast = S === 'think' || S === 'ask';
        c.clearRect(0, 0, W, W);
        // liquid orb
        const r = W * 0.19 * (1 + lvl * 0.28);
        c.globalCompositeOperation = 'screen';
        const tt = t * sp * (fast ? 2.4 : 1), wob = 0.08 + lvl * 0.22;
        for (let i = 0; i < 4; i++) { const a = tt * 0.9 + i * 1.7; blob(c, m + Math.cos(a) * r * 0.22, m + Math.sin(a * 1.2) * r * 0.22, r * (0.78 + i * 0.06), cur[i], tt * 1.3 + i, wob); }
        c.globalCompositeOperation = 'source-over';
        const hl = c.createRadialGradient(m - r * 0.35, m - r * 0.4, 0, m - r * 0.35, m - r * 0.4, r * 0.6);
        hl.addColorStop(0, 'rgba(255,255,255,.3)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.beginPath(); c.arc(m, m, r, 0, 7); c.fill();
        // electric ring
        const R = W * 0.3;
        c.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 3; j++) {
            c.beginPath();
            const amp = W * 0.008 + lvl * W * 0.06 * (1 - j * 0.2), f = [3, 5, 7][j], ph = t * sp * (fast ? 3 : 1.2) * (j % 2 ? -1 : 1) + j * 2;
            for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2, rr = R + Math.sin(a * f + ph) * amp * Math.sin(a * 2 + ph * 0.5 + 1); const x = m + Math.cos(a) * rr, y = m + Math.sin(a) * rr; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
            c.closePath(); c.strokeStyle = rgba(cur[j], 0.9); c.lineWidth = W * 0.009; c.shadowColor = rgba(cur[j], 1); c.shadowBlur = W * 0.05; c.stroke();
        }
        c.shadowBlur = 0; c.globalCompositeOperation = 'source-over';
    }

    function ensure() {
        const pill = $('iba-talk-pill');
        if (!pill) return null;
        if (!cv || !pill.contains(cv)) {
            const old = pill.querySelector('.iba-talk-orb'); if (old) old.remove();
            cv = document.createElement('canvas'); cv.className = 'iba-orb-cv'; cv.width = 132; cv.height = 132;
            pill.insertBefore(cv, pill.firstChild); pill.classList.add('has-orb');
        }
        if (!edge) { edge = document.createElement('div'); edge.id = 'iba-orb-edge'; edge.innerHTML = '<i class="is-blur"></i><i></i>'; edge.setAttribute('aria-hidden', 'true'); document.body.appendChild(edge); }
        return pill;
    }
    function frame() {
        raf = 0;
        const T = window.ibaTalk; let S = 'off';
        try { S = T && T.stage ? T.stage() : 'off'; } catch (_) {}
        if (S === 'off' || phone()) { micWant = false; micOff(); if (edge) edge.style.opacity = '0'; return; } // stops until Talk mode is on again
        micWant = S !== 'muted'; if (micWant) micOn(); else micOff();
        const pill = ensure();
        t += 0.016;
        const ml = S === 'listen' ? micLevel() : 0;
        let shown = S; if (S === 'listen' && ml > 0.12) shown = 'hear';
        let tgt = 0;
        if (shown === 'hear') tgt = Math.min(1, ml * 1.3);
        else if (S === 'speak') tgt = Math.abs(Math.sin(t * 7) * 0.55 + Math.sin(t * 15.3) * 0.3);
        else if (S === 'think' || S === 'ask') tgt = 0.15 + 0.1 * Math.sin(t * 4);
        else if (S === 'listen') tgt = 0.05 + 0.05 * Math.sin(t * 1.6);
        if (reduced()) tgt = 0;
        lvl += (tgt - lvl) * 0.25;
        const p = (PAL[shown] || PAL.listen).map(hex);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) cur[i][k] += (p[i][k] - cur[i][k]) * 0.06;
        if (pill && !pill.hidden && cv) { const c = cv.getContext('2d'); draw(c, 132, shown); }
        if (edge) {
            const act = shown === 'hear' || S === 'think' || S === 'speak' || S === 'ask';
            edge.style.opacity = act ? (0.7 + lvl * 0.3).toFixed(2) : '0';
            edge.style.setProperty('--w', (1.5 + lvl * 4).toFixed(1) + 'px');
            const P = PAL[shown] || PAL.listen; ['--c1', '--c2', '--c3', '--c4'].forEach((k, i) => edge.style.setProperty(k, P[i]));
            edge.style.setProperty('--sp', (S === 'think' || S === 'ask') ? '1.6s' : '8s');
        }
        if (pill) { pill.classList.add('has-orb'); pill.classList.toggle('is-hear', shown === 'hear'); }
        raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    // Talk mode on/off is a click on the headset or a voice command: check a few times a second while idle
    setInterval(() => { try { if (window.ibaTalk && window.ibaTalk.on && window.ibaTalk.on()) kick(); } catch (_) {} }, 400);
    window.ibaOrb = { kick, level: () => lvl };
})();
