/* 18.0.0 patch 62 (martin): smoother on middle / older office PCs ("not too old, not too fast").
   Light mode = no background video, no weather / rain canvas, no glass blur, no endless glow / pulse
   animations (spinners still turn). Everything else works exactly the same.
   Auto (default): on when the PC has 4 or fewer processor cores or 4 GB or less memory, or when the screen
   draws slowly in the first seconds (checked once, remembered 7 days). Each person can pick
   Auto / Light / Full in Settings > Speed (saved on this PC only). Phones are left as they are. */
(function () {
  'use strict';
  if (window.ibaLite) return;
  var MODE = 'iba-lite-v1', AUTO = 'iba-lite-auto-v1';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } return null; }
  function mode() { var m = ls(MODE); return m === 'on' || m === 'off' ? m : 'auto'; }
  function cores() { return Number(navigator.hardwareConcurrency) || 8; }
  function mem() { return Number(navigator.deviceMemory) || 8; }
  function weakHw() { return cores() <= 4 || mem() <= 4; }
  function slowSeen() { try { var o = JSON.parse(ls(AUTO) || 'null'); return !!(o && o.slow && Date.now() - o.at < 7 * 864e5); } catch (_) { return false; } }
  function pc() { try { return window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 900; } catch (_) { return true; } }
  function on() { var m = mode(); return m === 'on' || (m === 'auto' && pc() && (weakHw() || slowSeen())); }
  function why() {
    var m = mode();
    if (m === 'on') return 'Light (you chose it)';
    if (m === 'off') return 'Full (you chose it)';
    if (weakHw()) return 'Auto: light, this PC has ' + cores() + ' cores' + (navigator.deviceMemory ? ' / ' + mem() + ' GB' : '');
    if (slowSeen()) return 'Auto: light, the screen was drawing slowly';
    return 'Auto: full, this PC is fast enough';
  }
  function apply() {
    var r = document.documentElement, v = on();
    r.classList.toggle('iba-lite', v);
    try { if (window.ibaRain && window.ibaRain.refresh) window.ibaRain.refresh(); } catch (_) {}
    if (v) document.querySelectorAll('#iba-bg-layer video').forEach(function (x) { try { x.pause(); } catch (_) {} });
  }
  function set(m) { ls(MODE, m === 'on' || m === 'off' ? m : 'auto'); apply(); paint(); }

  // light CSS (added once, early)
  (function css() {
    var st = document.createElement('style');
    st.id = 'iba-lite-css';
    st.textContent = 'html.iba-lite *, html.iba-lite *::before, html.iba-lite *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }' +
      'html.iba-lite *:not(.fa-spin):not(.fa-spinner):not(.fa-circle-notch):not(.fa-sync):not(.fa-rotate), html.iba-lite *::before, html.iba-lite *::after { animation-iteration-count: 1 !important; }' +
      'html.iba-lite #iba-bg-layer video, html.iba-lite #iba-bg-layer canvas { display: none !important; }' +
      '#iba-lite-card .iba-lite-opts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }' +
      '#iba-lite-card .iba-lite-opts button { border: 1px solid rgba(255,255,255,.25); background: transparent; color: #eef3f8; border-radius: 999px; padding: 6px 14px; font-weight: 600; cursor: pointer; }' +
      '#iba-lite-card .iba-lite-opts button.is-on { background: rgba(47,211,194,.18); border-color: #2fd3c2; color: #2fd3c2; }' +
      '#iba-lite-card .iba-lite-why { display: block; margin-top: 8px; color: #E3C98A; font-size: 12.5px; }';
    (document.head || document.documentElement).appendChild(st);
  })();
  apply();

  // one quick check of how fast the screen draws (auto mode, PC, not already light)
  function measure() {
    if (mode() !== 'auto' || on() || document.hidden || !pc()) return;
    var t0 = 0, last = 0, gaps = [];
    function f(t) {
      if (!t0) { t0 = last = t; return requestAnimationFrame(f); }
      gaps.push(t - last); last = t;
      if (t - t0 < 3000) return requestAnimationFrame(f);
      gaps.sort(function (a, b) { return a - b; });
      var med = gaps[Math.floor(gaps.length / 2)] || 16;
      var slow = med > 28 && !document.hidden;
      ls(AUTO, JSON.stringify({ slow: slow, at: Date.now(), med: Math.round(med) }));
      if (slow) apply();
    }
    requestAnimationFrame(f);
  }
  window.addEventListener('load', function () { setTimeout(measure, 6000); });

  // Settings > Speed (everyone, this PC only)
  function paint() {
    var sec = document.getElementById('wd-settings');
    if (!sec) return;
    var card = document.getElementById('iba-lite-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'iba-lite-card';
      card.className = 'settings-card';
      card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-gauge-high"></i></div><div>' +
        '<h2>Speed</h2><p>For this PC only. Light = no moving background, weather or glow effects, so pages open and scroll smoother on older PCs. Everything else works the same.</p></div></div>' +
        '<div class="iba-lite-opts"><button type="button" data-lite="auto">Auto (best)</button><button type="button" data-lite="on">Light</button><button type="button" data-lite="off">Full</button></div>' +
        '<small class="iba-lite-why"></small>';
      var still = document.getElementById('iba-still-card');
      if (still && still.parentElement) still.after(card); else sec.appendChild(card);
      card.addEventListener('click', function (e) { var b = e.target.closest('[data-lite]'); if (b) set(b.getAttribute('data-lite')); });
    }
    var m = mode();
    card.querySelectorAll('[data-lite]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-lite') === m); });
    var w = card.querySelector('.iba-lite-why'); if (w) w.textContent = 'Now: ' + why() + '.';
  }
  (function watch() {
    var sec = document.getElementById('wd-settings');
    if (!sec) { setTimeout(watch, 1000); return; }
    var was = false;
    new MutationObserver(function () { var vis = !sec.classList.contains('hidden'); if (vis && !was) setTimeout(paint, 400); was = vis; }).observe(sec, { attributes: true, attributeFilter: ['class'] });
    if (!sec.classList.contains('hidden')) paint();
  })();
  window.ibaLite = { on: on, set: set, mode: mode, why: why };
})();
