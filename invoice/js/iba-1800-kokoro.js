/* 18.0.0 patch 31 (martin): Kokoro natural voice for the assistant / IRIS (PC only, per person, OFF until switched on
   in Assistant Settings > Look and voice). Free, runs on this PC: the voice (~90 MB, Kokoro-82M q8) is downloaded once
   from Hugging Face and kept by the browser. Text never leaves the PC. If it cannot load (blocked network, old PC),
   the assistant keeps using the normal browser voice. Speaks sentence by sentence (next one is prepared while one plays). */
(function () {
    'use strict';
    if (window.ibaKokoro) return;
    const LIB = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
    const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
    const VOICES = [['af_heart', 'Heart (woman, US)'], ['af_bella', 'Bella (woman, US)'], ['bf_emma', 'Emma (woman, UK)'], ['am_michael', 'Michael (man, US)'], ['bm_george', 'George (man, UK)']];
    const SPEEDS = [['0.9', 'Slower'], ['1', 'Normal'], ['1.1', 'A bit faster'], ['1.2', 'Faster']];
    const $ = (id) => document.getElementById(id);
    const phone = () => !!(document.body && (document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone')));
    function who() { let k = ''; try { k = localStorage.getItem('approverKey') || ''; } catch (_) {} return k || 'me'; }
    const KEY = () => 'iba-kokoro-v1:' + who();
    function cfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(KEY()) || '{}') || {}; } catch (_) {} return { on: c.on === true, voice: c.voice || 'af_heart', speed: Number(c.speed) || 1 }; }
    function setCfg(p) { const c = Object.assign(cfg(), p); try { localStorage.setItem(KEY(), JSON.stringify(c)); } catch (_) {} return c; }

    let tts = null, loadP = null, state = 'idle', pct = 0, why = '', failedAt = 0;
    function status() {
        if (state === 'ready') return 'Ready. The natural voice is on this PC.';
        if (state === 'loading') return 'Downloading the voice… ' + (pct ? pct + '%' : '') + ' (only the first time, about 90 MB). Until it is ready the normal voice speaks.';
        if (state === 'failed') return 'Could not load the natural voice (' + why + '). The normal voice is used.';
        return 'Not downloaded yet. It downloads once (about 90 MB) when you switch it on.';
    }
    function paintStatus() { const s = $('iba-kok-status'); if (s) s.textContent = status(); }
    function load(force) {
        if (loadP) return loadP;
        if (!force && state === 'failed' && Date.now() - failedAt < 10 * 60000) return Promise.resolve(null);
        state = 'loading'; pct = 0; paintStatus();
        loadP = (async () => {
            const mod = await import(/* webpackIgnore: true */ LIB);
            const seen = {};
            const t = await mod.KokoroTTS.from_pretrained(MODEL, {
                dtype: 'q8', device: 'wasm',
                progress_callback: (p) => {
                    if (!p || p.status !== 'progress' || !p.total) return;
                    seen[p.file] = [p.loaded || 0, p.total];
                    let a = 0, b = 0; Object.values(seen).forEach((x) => { a += x[0]; b += x[1]; });
                    const n = Math.min(99, Math.round(a / b * 100)); if (n !== pct) { pct = n; paintStatus(); }
                }
            });
            tts = t; state = 'ready'; paintStatus();
            return t;
        })().catch((e) => { state = 'failed'; failedAt = Date.now(); const m = String((e && e.message) || e || ''); why = /fetch|network|load|import/i.test(m) ? 'the download was blocked or there is no internet' : /memory|wasm/i.test(m) ? 'this PC is too slow or low on memory' : 'error: ' + m.slice(0, 60); loadP = null; paintStatus(); console.warn('[kokoro]', e); return null; });
        return loadP;
    }

    let ctx = null, src = null, run = 0;
    function audioCtx() { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    function sentences(t) {
        const parts = String(t || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [];
        const out = []; let cur = '';
        parts.forEach((p) => { p = p.trim(); if (!p) return; if ((cur + ' ' + p).length < 140) cur = (cur ? cur + ' ' : '') + p; else { if (cur) out.push(cur); cur = p; } });
        if (cur) out.push(cur);
        return out.slice(0, 12);
    }
    function play(audio, my) {
        return new Promise((res) => {
            const c = audioCtx(); if (!c || my !== run) return res(false);
            const data = audio.audio, rate = audio.sampling_rate || 24000;
            const buf = c.createBuffer(1, data.length, rate); buf.copyToChannel(data, 0);
            const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
            src = s; s.onended = () => { if (src === s) src = null; res(true); };
            s.start();
        });
    }
    function stop() { run++; try { if (src) src.stop(); } catch (_) {} src = null; }
    // returns false when it cannot speak now (the caller then uses the normal voice)
    async function speak(text, onStart, onEnd) {
        const c = cfg();
        if (!c.on || phone()) return false;
        if (state !== 'ready') { load(); return false; }
        const list = sentences(text); if (!list.length) return false;
        stop(); const my = run;
        if (!audioCtx()) return false;
        const gen = (s) => tts.generate(s, { voice: c.voice, speed: c.speed });
        let started = false;
        try {
            let next = gen(list[0]);
            for (let i = 0; i < list.length; i++) {
                const a = await next;
                if (my !== run) break;
                if (i + 1 < list.length) next = gen(list[i + 1]);
                if (!started) { started = true; try { onStart && onStart(); } catch (_) {} }
                await play(a, my);
                if (my !== run) break;
            }
        } catch (e) {
            console.warn('[kokoro] speak', e);
            if (!started) return false;
        } finally {
            if (started && my === run) { try { onEnd && onEnd(); } catch (_) {} }
        }
        return true;
    }

    // Settings block (Assistant > Settings > Look and voice): filled into #iba-kokoro-set
    function paintSettings() {
        const box = $('iba-kokoro-set'); if (!box) return;
        if (phone()) { box.innerHTML = ''; return; }
        const c = cfg();
        box.innerHTML = '<label class="iba-ai-check"><input type="checkbox" id="iba-kok-on"' + (c.on ? ' checked' : '') + '/> Natural voice (Kokoro) · PC only · free, downloads once (about 90 MB)</label>' +
            '<div class="iba-kok-row"><label class="iba-ai-field"><span>Voice</span><select id="iba-kok-voice">' + VOICES.map((v) => '<option value="' + v[0] + '"' + (v[0] === c.voice ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label>' +
            '<label class="iba-ai-field"><span>Speed</span><select id="iba-kok-speed">' + SPEEDS.map((v) => '<option value="' + v[0] + '"' + (Number(v[0]) === c.speed ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label>' +
            '<button type="button" class="iba-ai-btn" id="iba-kok-play"><i class="fa-solid fa-play"></i> Play sample</button></div>' +
            '<p class="iba-ai-help small" id="iba-kok-status"></p>' +
            '<label class="iba-ai-check"><input type="checkbox" id="iba-iris-snd"' + ((window.ibaTalk && window.ibaTalk.soundOn && !window.ibaTalk.soundOn()) ? '' : ' checked') + '/> IRIS sounds (a soft chime when she hears "Iris", a ding when done)</label>' +
            '<label class="iba-ai-check"><input type="checkbox" id="iba-iris-hi"' + ((window.ibaTalk && window.ibaTalk.hiOn && !window.ibaTalk.hiOn()) ? '' : ' checked') + '/> Also answer to "Hi … please" (e.g. "Hi, open Batch Entry please")</label>';
        paintStatus();
        if (c.on && state === 'idle') load();
    }
    function sample() {
        const n = (VOICES.find((v) => v[0] === cfg().voice) || VOICES[0])[1].split(' ')[0];
        const t = 'Hi, I am Iris, with the ' + n + ' voice. Your approvals are waiting, and P O 6 2 8 1 2 is with Accounts.';
        if (state !== 'ready') { load(true).then((x) => { if (x) speak(t); }); return; }
        speak(t);
    }
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.id === 'iba-kok-on') { setCfg({ on: t.checked }); if (t.checked) load(true); else stop(); }
        else if (t.id === 'iba-kok-voice') setCfg({ voice: t.value });
        else if (t.id === 'iba-kok-speed') setCfg({ speed: Number(t.value) || 1 });
    });
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#iba-kok-play')) { e.preventDefault(); audioCtx(); if (!cfg().on) { setCfg({ on: true }); const cb = $('iba-kok-on'); if (cb) cb.checked = true; } sample(); } });
    // pre-load in the background for people who switched it on (only after the page is idle)
    setTimeout(() => { if (cfg().on && !phone()) load(); }, 8000);
    window.ibaKokoro = { wanted: () => cfg().on && !phone(), ready: () => state === 'ready', speak, stop, load, paintSettings, status, cfg };
})();
