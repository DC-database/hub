/* 17.0.5 patch 191 (martin): moving rain over the background photo (PC only).
 * Drawn by code on a canvas inside #iba-bg-layer (over the photo, under the dimming layer and
 * every page), so no video to download. Never on phone / tablet phone view / Z Flip cover; pauses
 * when the tab is hidden; off when the computer asks for less motion. About 30 frames a second.
 * 17.0.5 patch 192: chosen PER PAGE (Welcome / WorkDesk / Inventory / Invoice Management), Settings >
 * Shell Backgrounds (Super Admin), saved for everyone in system_settings/shell_backgrounds/rainPages
 * {login, workdesk, inventory, invoice}. Old single value (.../rain) still read when rainPages is missing.
 * 17.0.5 patch 193: a VIDEO per page too (videoPages {page: 'V-Beach-01'}), files in the app's video/ folder
 * (same site, so GitHub Pages sends them as real mp4). Video sits under the rain; the photo shows until it plays.
 * Only the open page's video is downloaded; phones / less motion keep the photo; pauses when the tab is hidden.
 * 17.0.5 patch 194: buttons were left locked when Settings was built before the Super Admin sign-in.
 * 17.0.5 patch 218 (martin): THUNDER per page (thunderPages {page: off|light|heavy}), only together with rain.
 * Light = soft flash in the clouds every 20-40 s, sometimes a faint far bolt. Heavy = bright double flash +
 * a clear bolt with branches every 8-15 s. Silent. Drawn on the same canvas, flash only lights the background
 * (never over the pages). Rain + thunder now also on PHONES (fewer drops, ~24 fps) inside the phone
 * workspace background; never on the Z Flip cover screen. Videos stay PC only.
 * 18.0.0 patch 11 (martin): WEATHER per page (weatherPages {page: rain|snow|sand|summer|meteor|twister}), the
 * Off / Light / Heavy level is the old rainPages value, thunder only with rain. Snow = drifting flakes, Sandstorm =
 * orange haze + dust streaks, Summer = sun glare + heat dust + a tumbleweed rolling by now and then, Meteors =
 * fireball with a tail that explodes when it lands (flash, sparks, ring, smoke), Twister = a small faint funnel far
 * away. Older saves without weatherPages stay Rain. */
(function () {
  'use strict';
  if (window.ibaRain) return;
  var PATH = 'system_settings/shell_backgrounds';
  var KEY = 'iba-rain-pages-v1', VKEY = 'iba-bg-video-v1';
  var VIDEO_BASE = 'video/';
  // 17.0.5 patch 196: the list comes from GitHub (hub/invoice/video, .mp4 only), saved 6 h in this browser,
  // like the photos. Built-in names below are only used until GitHub answers.
  var VIDEOS = ['V-Beach-01', 'V-Beach-02', 'V-Bus-01', 'V-City-01', 'V-City-02'];
  var VIDEO_API = 'https://api.github.com/repos/DC-database/hub/contents/invoice/video?ref=main';
  var VLIST = 'iba-bg-video-list-v1', VLIST_TTL = 6 * 3600 * 1000;
  function okName(v) { return /^[A-Za-z0-9 ._-]{1,80}$/.test(v) ? v : ''; }
  try { var vl = JSON.parse(localStorage.getItem(VLIST) || 'null'); if (vl && Array.isArray(vl.files) && vl.files.length) VIDEOS = vl.files; } catch (_) {}
  var vlBusy = false;
  function loadVideoList(fresh) {
    var vl = null; try { vl = JSON.parse(localStorage.getItem(VLIST) || 'null'); } catch (_) {}
    // patch 217: opening the video list (Super Admin) re-checks GitHub if the copy is over 1 min old
    if (vl && Date.now() - (vl.at || 0) < (fresh ? 60 * 1000 : VLIST_TTL)) return;
    if (vlBusy) return; vlBusy = true;
    if (typeof fetch !== 'function') return;
    fetch(VIDEO_API, { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('GitHub ' + r.status); return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items)) return;
        var files = items.filter(function (it) { return it && it.type === 'file' && /\.mp4$/i.test(String(it.name || '')); })
          .map(function (it) { return okName(String(it.name).replace(/\.mp4$/i, '')); }).filter(Boolean)
          .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
        if (!files.length) return;
        VIDEOS = files;
        try { localStorage.setItem(VLIST, JSON.stringify({ at: Date.now(), files: files })); } catch (_) {}
        fillSelects(); paint();
        try { window.dispatchEvent(new CustomEvent('iba:video-list')); } catch (_) {}
      })
      .catch(function () {})
      .then(function () { vlBusy = false; });
  }
  var LEVELS = { off: 0, light: 110, heavy: 260 };
  var PAGES = [['login', 'Welcome screen', 'fa-door-open'], ['workdesk', 'WorkDesk', 'fa-briefcase'], ['dashboard', 'Dashboard', 'fa-chart-pie'], ['inventory', 'Inventory', 'fa-boxes-stacked'], ['invoice', 'Invoice Management', 'fa-file-invoice'], ['phone', 'Phone', 'fa-mobile-screen-button']];
  // 18.0.0 patch 8 (martin): phones have their OWN rain / thunder choice (row "Phone"). Older saves without it
  // keep what phones showed before (the Invoice Management choice) until the Super Admin saves.
  function lv(v) { v = String(v || '').toLowerCase(); return LEVELS.hasOwnProperty(v) ? v : 'off'; }
  function norm(o) { var r = {}; PAGES.forEach(function (p) { r[p[0]] = lv(o && o[p[0]]); }); if (o && !Object.prototype.hasOwnProperty.call(o, 'phone')) r.phone = lv(o.invoice); if (!o || !Object.prototype.hasOwnProperty.call(o, 'dashboard')) r.dashboard = r.workdesk; return r; }
  function same(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  function copy(o) { return norm(o); }
  var saved = norm({});
  try { var ls = JSON.parse(localStorage.getItem(KEY) || 'null'); if (ls) saved = norm(ls); } catch (_) {}
  var shown = copy(saved);
  function vnorm(o) { var r = {}; PAGES.forEach(function (p) { var v = String((o && o[p[0]]) || '').replace(/\.mp4$/i, ''); r[p[0]] = okName(v); }); if (!o || !Object.prototype.hasOwnProperty.call(o, 'dashboard')) r.dashboard = r.workdesk; return r; }
  function vsame(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  var vsaved = vnorm({});
  try { var lv2 = JSON.parse(localStorage.getItem(VKEY) || 'null'); if (lv2) vsaved = vnorm(lv2); } catch (_) {}
  var vshown = vnorm(vsaved), videoVal = null;
  // 18.0.0 patch 11: weather kind per page
  var KINDS = [['rain', 'Rain'], ['snow', 'Snow'], ['sand', 'Sandstorm'], ['summer', 'Summer'], ['meteor', 'Meteors'], ['twister', 'Twister']];
  function wk(v) { v = String(v || '').toLowerCase(); return KINDS.some(function (k) { return k[0] === v; }) ? v : 'rain'; }
  function wnorm(o) { var r = {}; PAGES.forEach(function (p) { r[p[0]] = wk(o && o[p[0]]); }); if (o && !Object.prototype.hasOwnProperty.call(o, 'phone')) r.phone = wk(o.invoice); if (!o || !Object.prototype.hasOwnProperty.call(o, 'dashboard')) r.dashboard = r.workdesk; return r; }
  var WKEY = 'iba-weather-pages-v1', wsaved = wnorm({}), weatherVal = null;
  try { var lw = JSON.parse(localStorage.getItem(WKEY) || 'null'); if (lw) wsaved = wnorm(lw); } catch (_) {}
  var wshown = wnorm(wsaved);
  var TKEY = 'iba-thunder-pages-v1', tsaved = norm({}), thunderVal = null;
  try { var lt = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (lt) tsaved = norm(lt); } catch (_) {}
  var tshown = copy(tsaved);
  var legacy = null, pagesVal = null;
  var cv = null, ctx = null, drops = [], raf = 0, last = 0, W = 0, H = 0;

  function phoneRoot() { var b = document.body; return b && b.classList.contains('iba-phone') ? document.getElementById('iba-phone') : null; }
  function page() {
    var b = document.body;
    var pr = phoneRoot();
    if (pr) return 'phone';
    if (!b || !b.classList.contains('iba-shell-on')) return 'login';
    if (b.classList.contains('iba-mobile-ui')) return 'phone';
    var m = String(window.__ibaActiveModule || '').toLowerCase();
    if (m === 'inventory') return 'inventory';
    if (m === 'invoice' || m === 'invoice-management') return 'invoice';
    if (m === 'login' || m === 'home') return 'login';
    // 18.0.0 patch 22 (martin): the Dashboard has its own background / weather (until saved it follows WorkDesk)
    var dsec = document.getElementById('wd-dashboard');
    if (dsec && !dsec.classList.contains('hidden') && dsec.offsetParent !== null) return 'dashboard';
    return 'workdesk';
  }
  // 18.0.0 patch 13 (martin): Preview button on each row shows that row's weather on this screen for 20 s
  var pv = null, pvTimer = 0;
  function cur() { return pv || page(); }
  function level() { return shown[cur()] || 'off'; }
  function kind() { return wshown[cur()] || 'rain'; }
  function tlevel() { return (level() === 'off' || kind() !== 'rain') ? 'off' : (tshown[cur()] || 'off'); }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function onPhone() {
    var b = document.body; if (!b) return true;
    if (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone')) return true;
    return Math.min(window.innerWidth, window.innerHeight) < 600;
  }
  function cover() { var pr = phoneRoot(); return !!(pr && pr.classList.contains('is-cover')); }
  function small() { return onPhone(); }
  // where the rain is drawn: the phone workspace (its photo is its own background) or the desktop photo layer
  function host() { return phoneRoot() || document.getElementById('iba-bg-layer'); }
  function wanted() { return LEVELS[level()] > 0 && !reduced() && !cover() && !document.hidden && !!host(); }
  function count() { var n = LEVELS[level()]; return small() ? Math.round(n * 0.4) : n; }

  function drop(top) {
    return { x: Math.random() * (W + 200) - 100, y: top ? -Math.random() * H : Math.random() * H, l: (small() ? 12 : 18) + Math.random() * 24, v: 11 + Math.random() * 9, a: 0.25 + Math.random() * 0.3, w: Math.random() < 0.15 ? 1.4 : 0.9 };
  }
  function size() {
    if (!cv) return;
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
  }
  function ensure() {
    var hs = host();
    if (!hs) return false;
    if (cv && cv.isConnected && cv.parentNode !== hs) { cv.remove(); if (fl) fl.remove(); }
    if (!cv || !cv.isConnected) {
      cv = document.createElement('canvas');
      cv.id = 'iba-rain';
      cv.setAttribute('aria-hidden', 'true');
      // phone: z-index -1 = above the workspace photo, under all its cards (the workspace is position:fixed)
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block' + (hs.id === 'iba-phone' ? ';z-index:-1' : '');
      fl = document.createElement('div');
      fl.id = 'iba-thunder-flash';
      fl.setAttribute('aria-hidden', 'true');
      fl.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen;background:radial-gradient(ellipse at var(--fx,50%) 0%,rgba(225,232,255,.95),rgba(160,180,255,.55) 45%,rgba(120,140,220,.2) 100%)' + (hs.id === 'iba-phone' ? ';z-index:-1' : '');
      hs.appendChild(cv); hs.appendChild(fl);
      ctx = cv.getContext('2d');
      size();
    }
    var n = count();
    while (drops.length < n) drops.push(drop(false));
    if (drops.length > n) drops.length = n;
    return true;
  }
  function frame(t) {
    raf = 0;
    if (!wanted()) { stop(); return; }
    raf = requestAnimationFrame(frame);
    if (t - last < (small() ? 42 : 33)) return; // ~30 fps (phone ~24)
    var dt = Math.min(3, (t - last) / 16.7 || 1); last = t;
    ctx.clearRect(0, 0, W, H);
    if (kind() !== 'rain') { fxFrame(t, dt); return; }
    ctx.lineCap = 'round';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.y += d.v * dt; d.x += d.v * 0.18 * dt;
      if (d.y > H + 20 || d.x > W + 60) { drops[i] = drop(true); continue; }
      ctx.strokeStyle = 'rgba(200,225,255,' + d.a.toFixed(2) + ')';
      ctx.lineWidth = d.w;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.18, d.y - d.l); ctx.stroke();
    }
    var tl = tlevel();
    if (tl === 'off') nextT = 0;
    else if (!nextT) sched(t);
    else if (t >= nextT) { strike(); sched(t); }
    drawBolts(t);
  }
  // ---- other weather (18.0.0 patch 11) ----
  var P = [], X = null, fxKey = '';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fxInit() {
    var kd = kind(), k = level() === 'heavy' ? 2 : 1, m = small() ? 0.5 : 1, n = function (c) { return Math.round(c * k * m); };
    P = []; X = { next: performance.now() + 1500, bolts: [], booms: [], tw: null, tumble: null };
    var i;
    if (kd === 'snow') for (i = 0; i < n(110); i++) P.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 3.4), v: rnd(.4, 1.3), p: rnd(0, 6) });
    if (kd === 'sand') for (i = 0; i < n(140); i++) P.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(8, 40), v: rnd(6, 14), a: rnd(.15, .5) });
    if (kd === 'summer') for (i = 0; i < n(45); i++) P.push({ x: rnd(0, W), y: rnd(H * .3, H), r: rnd(.8, 2.2), v: rnd(.1, .4), p: rnd(0, 6) });
    if (kd === 'meteor') for (i = 0; i < Math.round(130 * m); i++) P.push({ x: rnd(0, W), y: rnd(0, H * .75), r: rnd(.3, 1.3), p: rnd(0, 6) });
    if (kd === 'twister') for (i = 0; i < 20; i++) P.push({ a: rnd(0, 6.28), h: rnd(0, 1), s: rnd(.02, .06), d: rnd(0, 1) });
  }
  function fxFrame(t, dt) {
    var kd = kind(), key = kd + ':' + level() + ':' + W + 'x' + H;
    if (key !== fxKey) { fxKey = key; fxInit(); }
    var k = level() === 'heavy' ? 2 : 1, sm = small() ? 0.6 : 1;
    if (kd === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      P.forEach(function (p) { p.y += p.v * dt; p.p += .02 * dt; p.x += Math.sin(p.p) * .5 * dt; if (p.y > H + 5) { p.y = -5; p.x = rnd(0, W); } ctx.beginPath(); ctx.arc(p.x, p.y, p.r * sm, 0, 7); ctx.fill(); });
    } else if (kd === 'sand') {
      ctx.fillStyle = 'rgba(190,130,70,' + (k === 2 ? .30 : .16) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1.2;
      P.forEach(function (p) { p.x -= p.v * dt; p.y += Math.sin((t / 400) + p.l) * .3; if (p.x < -50) { p.x = W + rnd(0, 60); p.y = rnd(0, H); } ctx.strokeStyle = 'rgba(240,200,150,' + p.a.toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.l, p.y - 1); ctx.stroke(); });
    } else if (kd === 'summer') {
      var g = ctx.createRadialGradient(W * .88, H * .1, 0, W * .88, H * .1, H * .75);
      g.addColorStop(0, 'rgba(255,240,190,' + (k === 2 ? .6 : .45) + ')'); g.addColorStop(.25, 'rgba(255,215,140,.18)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,236,190,.6)';
      P.forEach(function (p) { p.p += .01 * dt; p.x += Math.sin(p.p) * .3 * dt; p.y -= p.v * dt; if (p.y < H * .2) { p.y = H; p.x = rnd(0, W); } ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); });
      if (!X.tumble && t > X.next) X.tumble = { x: -60, ph: 0, r: rnd(22, 34) * sm };
      var tb = X.tumble;
      if (tb) {
        tb.x += 2.4 * k * dt; tb.ph += .09 * k * dt; var by = H - tb.r - 14 - Math.abs(Math.sin(tb.ph * .9)) * 28;
        ctx.fillStyle = 'rgba(60,40,20,.25)'; ctx.beginPath(); ctx.ellipse(tb.x, H - 12, tb.r * .9, 5, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(tb.x, by); ctx.rotate(tb.ph * 2); ctx.strokeStyle = 'rgba(150,110,60,.85)'; ctx.lineWidth = 1.3;
        for (var i = 0; i < 26; i++) { var a = i * 2.4; ctx.beginPath(); ctx.ellipse(0, 0, tb.r * (.6 + .38 * Math.abs(Math.sin(i))), tb.r * (.6 + .35 * Math.abs(Math.cos(i * 1.3))), a, 0, 3.9); ctx.stroke(); }
        ctx.restore();
        if (tb.x > W + 80) { X.tumble = null; X.next = t + rnd(6000, 14000) / k; }
      }
    } else if (kd === 'meteor') meteors(t, dt, k, sm);
    else if (kd === 'twister') {
      if (!X.tw) X.tw = { x: -40 }; var tw = X.tw; tw.x += .25 * k * dt; if (tw.x > W + 60) tw.x = -40;
      var base = H * .84, top = H * .5, s2 = sm * (k === 2 ? 1.15 : 1), cx = function (f) { return tw.x + Math.sin(t / 900 + f * 3) * 6 * (1 - f); };
      for (var j = 0; j < 22; j++) { var f = j / 22, y = base - (base - top) * f, w = (3 + f * f * 34) * s2; ctx.fillStyle = 'rgba(55,52,46,' + (.14 - .05 * f).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(cx(f), y, w, 2.5 + f * 4, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(70,60,45,.3)';
      P.forEach(function (p) { p.a += p.s * dt * 2; var f2 = p.h * .5, y2 = base - (base - top) * f2, w2 = (3 + f2 * f2 * 34) * s2 * (1.2 + p.d * .5); ctx.fillRect(cx(f2) + Math.cos(p.a) * w2, y2 + Math.sin(p.a) * 3, 1.5, 1.5); });
    }
  }
  function meteors(t, dt, k, sm) {
    P.forEach(function (p) { p.p += .03; ctx.fillStyle = 'rgba(255,255,255,' + (.3 + .3 * Math.sin(p.p)).toFixed(2) + ')'; ctx.fillRect(p.x, p.y, p.r, p.r); });
    if (t > X.next) { X.next = t + rnd(3500, 7000) / k; var big = Math.random() < .6; X.bolts.push({ x: rnd(W * .35, W * 1.05), y: -30, vx: -rnd(3.2, 4.6), vy: rnd(4.2, 5.6), gy: rnd(H * .72, H * .93), r: (big ? rnd(7, 10) : rnd(4.5, 6)) * sm, trail: [] }); }
    ctx.globalCompositeOperation = 'lighter';
    X.bolts = X.bolts.filter(function (m) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.random() < .9) m.trail.push({ x: m.x + rnd(-m.r * .4, m.r * .4), y: m.y + rnd(-m.r * .4, m.r * .4), l: 1, s: rnd(1, m.r * .55) });
      var tl = 22, gr = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * tl, m.y - m.vy * tl);
      gr.addColorStop(0, 'rgba(255,230,170,.95)'); gr.addColorStop(.25, 'rgba(255,140,40,.7)'); gr.addColorStop(1, 'rgba(200,60,20,0)');
      ctx.strokeStyle = gr; ctx.lineCap = 'round'; ctx.lineWidth = m.r * 1.6; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * tl, m.y - m.vy * tl); ctx.stroke();
      m.trail = m.trail.filter(function (q) { q.l -= .035 * dt; q.y += .25 * dt; if (q.l <= 0) return false; ctx.fillStyle = 'rgba(255,' + (120 + Math.round(110 * q.l)) + ',50,' + (q.l * .8).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * q.l, 0, 7); ctx.fill(); return true; });
      var hg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
      hg.addColorStop(0, 'rgba(255,255,235,1)'); hg.addColorStop(.2, 'rgba(255,215,140,.9)'); hg.addColorStop(.5, 'rgba(255,120,40,.35)'); hg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 4, 0, 7); ctx.fill();
      if (m.y >= m.gy) { var sp = []; for (var i = 0; i < 50 + m.r * 5; i++) { var a2 = rnd(Math.PI * 1.05, Math.PI * 1.95), v = rnd(1.5, 6 + m.r * .4); sp.push({ x: m.x, y: m.y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, l: 1, s: rnd(1.5, 3.2) }); } X.booms.push({ x: m.x, y: m.y, t: t, sp: sp, r: m.r }); return false; }
      return true;
    });
    X.booms = X.booms.filter(function (b) {
      var age = (t - b.t) / 1000; if (age > 3) return false; var sc = b.r / 8;
      var f = Math.max(0, 1 - age / .45);
      if (f) { var rr = 220 * sc + 60, g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr); g.addColorStop(0, 'rgba(255,245,210,' + f.toFixed(2) + ')'); g.addColorStop(.3, 'rgba(255,170,70,' + (.7 * f).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,90,30,0)'); ctx.fillStyle = g; ctx.fillRect(b.x - rr, b.y - rr, rr * 2, rr * 2); ctx.fillStyle = 'rgba(255,200,140,' + (.12 * f).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      var fb = Math.max(0, 1 - age / 1.1);
      if (fb) { ctx.fillStyle = 'rgba(255,' + (130 + Math.round(80 * fb)) + ',50,' + (.55 * fb).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(b.x, b.y - age * 20, (20 + age * 60) * sc + 8, 0, 7); ctx.fill(); }
      b.sp.forEach(function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += .13 * dt; q.l -= .01 * dt; if (q.l > 0) { ctx.fillStyle = 'rgba(255,' + (140 + Math.round(100 * q.l)) + ',70,' + q.l.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.s * q.l, 0, 7); ctx.fill(); } });
      ctx.strokeStyle = 'rgba(255,190,110,' + Math.max(0, .7 - age * .45).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(b.x, b.y, age * 200 * sc + 10, age * 40 * sc + 3, 0, 0, 7); ctx.stroke();
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    X.booms.forEach(function (b) { var age = (t - b.t) / 1000; if (age < .4) return; var a3 = Math.min(1, (age - .4)) * Math.max(0, 1 - (age - .4) / 2.6); ctx.fillStyle = 'rgba(60,55,60,' + (.35 * a3).toFixed(3) + ')'; for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(b.x + (i - 2) * 14, b.y - age * 28 - i * 6, 18 + age * 14, 0, 7); ctx.fill(); } });
  }
  // ---- thunder ----
  var fl = null, nextT = 0, bolts = [];
  var GAP = { light: [20000, 40000], heavy: [8000, 15000] };
  function sched(t) { var g = GAP[tlevel()]; nextT = g ? t + g[0] + Math.random() * (g[1] - g[0]) : 0; }
  function boltPath(x0, y0, y1, rough) { var pts = [[x0, y0]], x = x0, y = y0; while (y < y1) { y += 8 + Math.random() * 18; x += (Math.random() - 0.5) * rough; pts.push([x, y]); } return pts; }
  function strike(force) {
    var tl = force || tlevel(); if (tl === 'off' || !fl || !cv) return;
    var heavy = tl === 'heavy', fx = 10 + Math.random() * 80;
    fl.style.setProperty('--fx', fx + '%');
    var pk = heavy ? 0.55 : 0.22;
    var seq = heavy ? [[0, pk], [90, 0.08], [150, pk * 0.85], [260, 0.15], [420, 0]] : [[0, pk], [160, 0.06], [380, 0]];
    var end = seq[seq.length - 1][0];
    try { fl.animate(seq.map(function (q) { return { opacity: q[1], offset: q[0] / end }; }), { duration: end, easing: 'ease-out' }); } catch (_) {}
    if (heavy || Math.random() < 0.35) {
      var x = W * fx / 100, y1 = H * (heavy ? 0.55 + Math.random() * 0.25 : 0.25 + Math.random() * 0.15);
      var main = boltPath(x, -10, y1, heavy ? 34 : 22), br = [];
      if (heavy) for (var i = 0; i < 3; i++) { var q = main[3 + Math.floor(Math.random() * Math.max(1, main.length - 4))] || main[main.length - 1]; br.push(boltPath(q[0], q[1], q[1] + H * (0.08 + Math.random() * 0.15), 26)); }
      bolts.push({ main: main, br: br, born: performance.now(), life: heavy ? 520 : 320, w: (heavy ? 2.6 : 1.3) * (small() ? 0.8 : 1), a: heavy ? 1 : 0.5 });
    }
  }
  function drawBolts(t) {
    if (!bolts.length) return;
    bolts = bolts.filter(function (o) { return t - o.born < o.life; });
    bolts.forEach(function (o) {
      var k = 1 - (t - o.born) / o.life, f = Math.random() < 0.25 ? 0.6 : 1;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(170,190,255,.95)'; ctx.shadowBlur = 18;
      var line = function (pts, w, a) { ctx.strokeStyle = 'rgba(235,240,255,' + (a * k * f).toFixed(2) + ')'; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); };
      line(o.main, o.w, o.a); o.br.forEach(function (p) { line(p, o.w * 0.55, o.a * 0.8); });
      ctx.restore();
    });
  }
  function start() {
    if (!wanted() || !ensure()) { stop(); return; }
    cv.style.display = 'block';
    if (!raf) { last = 0; nextT = 0; raf = requestAnimationFrame(frame); }
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (cv) { try { ctx.clearRect(0, 0, W, H); } catch (_) {} cv.style.display = 'none'; }
  }
  // ---- video ----
  // 18.0.0 patch 6 (martin: on a page change the still photo showed for a moment before the moving
  // background): the old video now keeps playing until the new one really plays, then the new one fades
  // in OVER it (no photo gap). The last 3 videos stay loaded (paused), so going back is instant.
  var vd = null, pool = {}, poolOrder = [];
  function vWanted() { var n = vshown[cur()]; return n && !reduced() && !onPhone() && document.getElementById('iba-bg-layer') ? n : ''; }
  function vids(host) { return Array.prototype.filter.call(host.children, function (c) { return c.tagName === 'VIDEO'; }); }
  function onTop(host, el) { var vs = vids(host); var last = vs[vs.length - 1]; if (last !== el) host.insertBefore(el, last ? last.nextSibling : host.firstChild); }
  function hideOthers() { Object.keys(pool).forEach(function (k) { var o = pool[k]; if (o && o !== vd) { o.style.opacity = '0'; try { o.pause(); } catch (_) {} o.removeAttribute('id'); } }); }
  function makeVid(n, host) {
    var el = document.createElement('video');
    el.muted = true; el.defaultMuted = true; el.loop = true; el.autoplay = false; el.playsInline = true;
    el.setAttribute('muted', ''); el.setAttribute('playsinline', ''); el.setAttribute('aria-hidden', 'true'); el.setAttribute('disablepictureinpicture', ''); el.preload = 'auto';
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:0;transition:opacity .8s ease;display:block';
    el.addEventListener('playing', function () { if (el !== vd) return; el.style.opacity = '1'; clearTimeout(el.__t); el.__t = setTimeout(function () { if (el === vd) hideOthers(); }, 850); });
    el.addEventListener('error', function () { el.style.opacity = '0'; if (el === vd) hideOthers(); }); // missing file: the photo shows
    el.setAttribute('src', VIDEO_BASE + encodeURIComponent(n) + '.mp4');
    onTop(host, el);                         // videos always stay BEFORE the rain canvas / thunder flash
    pool[n] = el; poolOrder.push(n);
    while (poolOrder.length > 3) {
      var i = 0; while (i < poolOrder.length && pool[poolOrder[i]] === vd) i++;
      if (i >= poolOrder.length) break;
      var old = poolOrder.splice(i, 1)[0], o = pool[old]; delete pool[old];
      if (o) { try { o.pause(); } catch (_) {} o.removeAttribute('src'); try { o.load(); } catch (_) {} if (o.parentNode) o.parentNode.removeChild(o); }
    }
    return el;
  }
  function video() {
    var host = document.getElementById('iba-bg-layer');
    var n = vWanted();
    if (!n) {
      if (vd) { vd.style.opacity = '0'; try { vd.pause(); } catch (_) {} vd = null; }
      hideOthers();
      if (onPhone() || reduced()) { Object.keys(pool).forEach(function (k) { var o = pool[k]; try { o.pause(); } catch (_) {} o.removeAttribute('src'); try { o.load(); } catch (_) {} if (o.parentNode) o.parentNode.removeChild(o); }); pool = {}; poolOrder = []; }
      return;
    }
    var el = pool[n];
    if (el && !el.isConnected) { delete pool[n]; poolOrder = poolOrder.filter(function (k) { return k !== n; }); el = null; }
    if (!el) el = makeVid(n, host);
    else { poolOrder = poolOrder.filter(function (k) { return k !== n; }); poolOrder.push(n); }
    if (el !== vd) {
      if (vd) vd.removeAttribute('id');
      vd = el; vd.id = 'iba-bgvid';
      onTop(host, vd);                       // new one above the old one, the old keeps playing under it
      vd.style.opacity = '0';
      if (!vd.paused && vd.readyState >= 3) { vd.style.opacity = '1'; setTimeout(function () { if (el === vd) hideOthers(); }, 850); }
    }
    if (document.hidden) { Object.keys(pool).forEach(function (k) { try { pool[k].pause(); } catch (_) {} }); }
    else if (vd.paused) { var pr = vd.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  var lastKey = '';
  function update() {
    try { video(); } catch (_) {}
    var k = page() + ':' + level() + ':' + tlevel() + ':' + vWanted() + ':' + (host() ? host().id : '') + ':' + kind();
    if (k !== lastKey) { var tl0 = lastKey.split(':')[2]; lastKey = k; if (cv) ensure(); if (tl0 !== tlevel()) nextT = 0; }
    if (wanted()) start(); else stop();
  }

  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', function () { size(); update(); });
  window.addEventListener('iba:backgrounds-changed', update);
  // patch 194: the box is built before sign-in, so re-check Super Admin when the body class changes
  var lastSup = null;
  function onClass() { var su = isSuper(); if (su !== lastSup) { lastSup = su; paint(); } update(); }
  try { new MutationObserver(onClass).observe(document.body || document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch (_) {}
  // page switches (WorkDesk / Inventory / Invoice) only change a JS variable: cheap check each second
  // 18.0.0 patch 6: 4x a second (was 1 s) + right after a menu click, so the video changes with the page
  function check() { if (page() + ':' + level() + ':' + tlevel() + ':' + vWanted() + ':' + (host() ? host().id : '') + ':' + kind() !== lastKey) update(); }
  setInterval(check, 250);
  document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('[data-iba-nav], .iba-nav-btn, .iba-nav-link')) { setTimeout(check, 0); setTimeout(check, 120); } }, true);

  // ---- Firebase (same place as the photos and the dimming) ----
  function mainDb() { try { return (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db : null; } catch (_) { return null; } }
  function fromServer() {
    if (pagesVal && typeof pagesVal === 'object') return norm(pagesVal);
    var l = lv(legacy); // patch 191 single value = the three shell pages, Welcome stays still
    return norm({ login: 'off', workdesk: l, inventory: l, invoice: l });
  }
  function got() {
    var dirty = !same(shown, saved) || !vsame(vshown, vsaved) || !same(tshown, tsaved) || !vsame(wshown, wsaved);
    saved = fromServer(); vsaved = vnorm(videoVal); tsaved = norm(thunderVal); wsaved = wnorm(weatherVal);
    try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); localStorage.setItem(TKEY, JSON.stringify(tsaved)); localStorage.setItem(WKEY, JSON.stringify(wsaved)); } catch (_) {}
    if (!dirty) { shown = copy(saved); vshown = vnorm(vsaved); tshown = copy(tsaved); wshown = wnorm(wsaved); }
    fillSelects();
    paint(); update();
  }
  var watching = false;
  (function tryWatch(n) {
    var d = mainDb();
    if (d && !watching) {
      watching = true;
      try {
        d.ref(PATH + '/rain').on('value', function (s) { legacy = s && s.val(); got(); });
        d.ref(PATH + '/rainPages').on('value', function (s) { pagesVal = s && s.val(); got(); });
        d.ref(PATH + '/videoPages').on('value', function (s) { videoVal = s && s.val(); got(); });
        d.ref(PATH + '/thunderPages').on('value', function (s) { thunderVal = s && s.val(); got(); });
        d.ref(PATH + '/weatherPages').on('value', function (s) { weatherVal = s && s.val(); got(); });
      } catch (_) { watching = false; }
    }
    if (!watching && n < 60) setTimeout(function () { tryWatch(n + 1); }, 500);
  })(0);

  // ---- Settings > Shell Backgrounds ----
  function isSuper() { return !!(document.body && document.body.classList.contains('iba-is-super-admin')); }
  function box() { return document.getElementById('iba-rain-box'); }
  function build() {
    var host = document.getElementById('iba-shell-bg-settings');
    if (!host || box()) return;
    var el = document.createElement('div');
    el.id = 'iba-rain-box';
    el.className = 'iba-dim-box iba-rain-box';
    el.innerHTML = '<div class="iba-dim-head"><i class="fa-solid fa-cloud-rain"></i><div><h3>Moving background: video and weather</h3>' +
      '<p>Pick it for each page. A video plays instead of the photo, the weather moves on top (you can use both): Rain, Snow, Sandstorm, Summer, Meteors or Twister, Light or Heavy. Thunder comes only with rain. The Phone row is for phones (all pages, lighter); videos are desktop only. Still photo + Off = as it is now. Applies for everyone after Save.</p></div></div>' +
      PAGES.map(function (p) {
        return '<div class="iba-rain-row" data-rain-page="' + p[0] + '"><span class="iba-rain-pg"><i class="fa-solid ' + p[2] + '"></i> ' + p[1] + '</span>' +
          '<label class="iba-rain-vid iba-wx-pick"><i class="fa-solid fa-cloud-sun-rain"></i> <select data-wx-page="' + p[0] + '" aria-label="Weather on ' + p[1] + '">' + KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select></label>' +
          '<div class="iba-rain-opts" role="radiogroup" aria-label="Weather on ' + p[1] + '">' +
          ['off', 'light', 'heavy'].map(function (k) { return '<button type="button" class="secondary-btn" role="radio" data-rain="' + k + '">' + (k === 'off' ? 'Off' : k === 'light' ? 'Light' : 'Heavy') + '</button>'; }).join('') +
          '</div><div class="iba-rain-opts iba-thunder-opts" role="radiogroup" aria-label="Thunder on ' + p[1] + '">' +
          ['off', 'light', 'heavy'].map(function (k) { return '<button type="button" class="secondary-btn" role="radio" data-thunder="' + k + '"><i class="fa-solid ' + (k === 'off' ? 'fa-cloud' : 'fa-bolt') + '"></i> ' + (k === 'off' ? 'No thunder' : k === 'light' ? 'Light thunder' : 'Heavy thunder') + '</button>'; }).join('') +
          '</div><button type="button" class="secondary-btn iba-wx-prev" data-wx-preview="' + p[0] + '"><i class="fa-solid fa-eye"></i> Preview</button>' + (p[0] === 'phone' ? '<span class="iba-rain-vid iba-rain-novid"><i class="fa-solid fa-image"></i> Photo (no video on phones)</span>' : '<label class="iba-rain-vid"><i class="fa-solid fa-film"></i> <select data-vid-page="' + p[0] + '" aria-label="Video on ' + p[1] + '"></select></label>') + '</div>';
      }).join('') +
      '<div class="iba-dim-acts"><span class="iba-dim-note"></span><button type="button" class="primary-btn iba-bg-save" data-rain-save>Save</button></div>';
    host.appendChild(el);
    fillSelects(); loadVideoList();
    el.addEventListener('click', function (e) {
      if (!isSuper()) return;
      var b = e.target.closest('[data-rain]');
      if (b) { var r = b.closest('[data-rain-page]'); if (r) { shown[r.getAttribute('data-rain-page')] = lv(b.getAttribute('data-rain')); paint(); update(); } return; }
      var tb = e.target.closest('[data-thunder]');
      if (tb) { var tr = tb.closest('[data-rain-page]'); if (tr) { tshown[tr.getAttribute('data-rain-page')] = lv(tb.getAttribute('data-thunder')); paint(); update(); } return; }
      var pb = e.target.closest('[data-wx-preview]');
      if (pb) { preview(pb.getAttribute('data-wx-preview')); return; }
      if (e.target.closest('[data-rain-save]')) save();
    });
    el.addEventListener('pointerdown', function (e) { if (isSuper() && e.target.closest('[data-vid-page]')) loadVideoList(true); }, true);
    el.addEventListener('focusin', function (e) { if (isSuper() && e.target.closest('[data-vid-page]')) loadVideoList(true); });
    el.addEventListener('change', function (e) {
      var ws = e.target.closest('[data-wx-page]');
      if (ws) { if (!isSuper()) { paint(); return; } wshown[ws.getAttribute('data-wx-page')] = wk(ws.value); paint(); update(); return; }
      var sl = e.target.closest('[data-vid-page]'); if (!sl) return;
      if (!isSuper()) { paint(); return; }
      vshown[sl.getAttribute('data-vid-page')] = sl.value; paint(); update();
    });
    paint();
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fillSelects() {
    var el = box(); if (!el) return;
    el.querySelectorAll('[data-vid-page]').forEach(function (sl) {
      var pg = sl.getAttribute('data-vid-page'), names = VIDEOS.slice();
      [vshown[pg], vsaved[pg]].forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); }); // keep a saved one even if not listed
      sl.innerHTML = '<option value="">Still photo</option>' + names.map(function (v) { return '<option value="' + esc(v) + '">Video ' + esc(v.replace(/^V-/, '')) + '</option>'; }).join('');
      sl.value = vshown[pg] || '';
    });
  }
  function say(t, bad) { var n = box() && box().querySelector('.iba-dim-note'); if (n) { n.textContent = t || ''; n.classList.toggle('is-bad', !!bad); } }
  function paint() {
    var el = box(); if (!el) return;
    el.querySelectorAll('[data-rain-page]').forEach(function (r) {
      var pg = r.getAttribute('data-rain-page');
      r.querySelectorAll('[data-rain]').forEach(function (b) { var on = b.getAttribute('data-rain') === shown[pg]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.disabled = !isSuper(); });
      var ws = r.querySelector('[data-wx-page]'); if (ws) { ws.value = wshown[pg] || 'rain'; ws.disabled = !isSuper(); }
      var noRain = shown[pg] === 'off' || wshown[pg] !== 'rain';
      r.querySelectorAll('[data-thunder]').forEach(function (b) { var on = b.getAttribute('data-thunder') === (noRain ? 'off' : tshown[pg]); b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.disabled = !isSuper() || noRain; b.title = noRain ? 'Thunder comes with rain: pick Rain + Light or Heavy first' : ''; });
      var sl = r.querySelector('[data-vid-page]'); if (sl) { sl.value = vshown[pg] || ''; sl.disabled = !isSuper(); }
    });
    el.querySelectorAll('[data-wx-preview]').forEach(function (b) { var on = pv === b.getAttribute('data-wx-preview'); b.hidden = !isSuper(); b.classList.toggle('is-on', on); b.innerHTML = on ? '<i class="fa-solid fa-stop"></i> Stop preview' : '<i class="fa-solid fa-eye"></i> Preview'; });
    if (!same(shown, saved) || !vsame(vshown, vsaved) || !same(tshown, tsaved) || !vsame(wshown, wsaved)) say('Not saved yet. Only this screen shows it (on this page).');
    else if ((el.querySelector('.iba-dim-note').textContent || '').indexOf('Not saved') === 0) say('');
  }
  // 18.0.0 patch 22 (martin): Preview = full screen. The page's chosen (unsaved) photo + video + weather fill the
  // screen with nothing on top; moving the mouse, a click/tap or Escape goes back to Settings to Save or try another.
  var pvBack = null;
  function pvPhoto(pg) {
    var g = pg === 'phone' ? 'phone-invoice' : pg;
    var row = document.querySelector('.iba-bg-row[data-iba-bg-group="' + g + '"]');
    if (row && row.dataset.dirty === '1' && row.dataset.pending) return row.dataset.pending;
    try { return window.ibaShellBackgroundFor ? window.ibaShellBackgroundFor(g) : ''; } catch (_) { return ''; }
  }
  function pvEnd() {
    clearTimeout(pvTimer);
    if (!pv) return;
    pv = null;
    document.removeEventListener('mousemove', pvMove, true); document.removeEventListener('keydown', pvKey, true);
    document.removeEventListener('pointerdown', pvDown, true); document.removeEventListener('touchstart', pvDown, true);
    var L = document.getElementById('iba-bg-layer');
    if (L && pvBack) { L.style.backgroundImage = pvBack.img; L.style.display = pvBack.disp; }
    pvBack = null;
    document.body.classList.remove('iba-bgpv-on');
    paint(); update(); say('');
  }
  var pvStart = 0, pvXY = null;
  function pvMove(e) {
    if (Date.now() - pvStart < 900) { pvXY = [e.clientX, e.clientY]; return; }
    if (pvXY && Math.abs(e.clientX - pvXY[0]) + Math.abs(e.clientY - pvXY[1]) < 8) return;
    pvEnd();
  }
  function pvKey(e) { if (e.key === 'Escape' || Date.now() - pvStart > 900) { e.preventDefault(); e.stopPropagation(); pvEnd(); } }
  function pvDown(e) { if (Date.now() - pvStart < 400) return; e.preventDefault(); e.stopPropagation(); pvEnd(); }
  function preview(pg) {
    clearTimeout(pvTimer);
    if (pv) pvEnd();
    var L = document.getElementById('iba-bg-layer');
    if (!L) return;
    pv = pg;
    pvBack = { img: L.style.backgroundImage, disp: L.style.display };
    var ph = pvPhoto(pg);
    if (ph) L.style.backgroundImage = 'url("' + ph + '")';
    L.style.display = 'block';
    document.body.classList.add('iba-bgpv-on');
    pvStart = Date.now(); pvXY = null;
    document.addEventListener('mousemove', pvMove, true); document.addEventListener('keydown', pvKey, true);
    document.addEventListener('pointerdown', pvDown, true); document.addEventListener('touchstart', pvDown, true);
    paint(); update();
    if (tlevel() !== 'off') setTimeout(function () { if (pv === pg) strike(); }, 900);
    pvTimer = setTimeout(function () { if (pv === pg) pvEnd(); }, 60000); // safety: back after 1 minute
  }
  function save() {
    var d = mainDb(); if (!d) { say('Could not reach Firebase. Try again.', true); return; }
    say('Saving...');
    var v = copy(shown), vv = vnorm(vshown), tv = copy(tshown), wv = wnorm(wshown);
    d.ref(PATH).update({ rainPages: v, videoPages: vv, thunderPages: tv, weatherPages: wv }).then(function () { saved = v; vsaved = vv; tsaved = tv; wsaved = wv; try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); localStorage.setItem(TKEY, JSON.stringify(tsaved)); localStorage.setItem(WKEY, JSON.stringify(wsaved)); } catch (_) {} paint(); say('Saved for everyone.'); }, function () { say('Firebase did not accept it. Nothing was changed for others.', true); });
  }
  function boot() {
    build(); update();
    // the settings page may be built later
    var tries = 0; (function again() { if (!box() && tries++ < 40) { build(); setTimeout(again, 750); } })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.ibaRain = {
    refreshVideos: function () { loadVideoList(true); },
    strike: function (k) { if (fl && cv) strike(k === 'heavy' || k === 'light' ? k : undefined); },
    thunder: function (pg, v) { if (v === undefined) { v = pg; pg = page(); } if (tshown.hasOwnProperty(pg)) { tshown[pg] = lv(v); paint(); update(); } },
    weather: function (pg, v) { if (v === undefined) { v = pg; pg = page(); } if (wshown.hasOwnProperty(pg)) { wshown[pg] = wk(v); paint(); update(); } },
    get: function () { return { page: page(), kind: kind(), weather: wnorm(wshown), saved: copy(saved), shown: copy(shown), thunder: copy(tshown), thunderSaved: copy(tsaved), video: vnorm(vshown), videoSaved: vnorm(vsaved) }; },
    video: function (pg, v) { if (vshown.hasOwnProperty(pg)) { vshown[pg] = okName(String(v || '').replace(/\.mp4$/i, '')); fillSelects(); paint(); update(); } },
    set: function (pg, v) { if (v === undefined) { v = pg; pg = page(); } if (shown.hasOwnProperty(pg)) { shown[pg] = lv(v); paint(); update(); } }
  };
})();
