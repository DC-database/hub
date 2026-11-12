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
 * workspace background; never on the Z Flip cover screen. Videos stay PC only. */
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
  var PAGES = [['login', 'Welcome screen', 'fa-door-open'], ['workdesk', 'WorkDesk', 'fa-briefcase'], ['inventory', 'Inventory', 'fa-boxes-stacked'], ['invoice', 'Invoice Management', 'fa-file-invoice']];
  function lv(v) { v = String(v || '').toLowerCase(); return LEVELS.hasOwnProperty(v) ? v : 'off'; }
  function norm(o) { var r = {}; PAGES.forEach(function (p) { r[p[0]] = lv(o && o[p[0]]); }); return r; }
  function same(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  function copy(o) { return norm(o); }
  var saved = norm({});
  try { var ls = JSON.parse(localStorage.getItem(KEY) || 'null'); if (ls) saved = norm(ls); } catch (_) {}
  var shown = copy(saved);
  function vnorm(o) { var r = {}; PAGES.forEach(function (p) { var v = String((o && o[p[0]]) || '').replace(/\.mp4$/i, ''); r[p[0]] = okName(v); }); return r; }
  function vsame(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  var vsaved = vnorm({});
  try { var lv2 = JSON.parse(localStorage.getItem(VKEY) || 'null'); if (lv2) vsaved = vnorm(lv2); } catch (_) {}
  var vshown = vnorm(vsaved), videoVal = null;
  var TKEY = 'iba-thunder-pages-v1', tsaved = norm({}), thunderVal = null;
  try { var lt = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (lt) tsaved = norm(lt); } catch (_) {}
  var tshown = copy(tsaved);
  var legacy = null, pagesVal = null;
  var cv = null, ctx = null, drops = [], raf = 0, last = 0, W = 0, H = 0;

  function phoneRoot() { var b = document.body; return b && b.classList.contains('iba-phone') ? document.getElementById('iba-phone') : null; }
  function page() {
    var b = document.body;
    var pr = phoneRoot();
    if (pr) return pr.getAttribute('data-side') === 'inventory' ? 'inventory' : 'invoice';
    if (!b || !b.classList.contains('iba-shell-on')) return 'login';
    var m = String(window.__ibaActiveModule || '').toLowerCase();
    if (m === 'inventory') return 'inventory';
    if (m === 'invoice' || m === 'invoice-management') return 'invoice';
    if (m === 'login' || m === 'home') return 'login';
    return 'workdesk';
  }
  function level() { return shown[page()] || 'off'; }
  function tlevel() { return level() === 'off' ? 'off' : (tshown[page()] || 'off'); }
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
  var vd = null;
  function vWanted() { var n = vshown[page()]; return n && !reduced() && !onPhone() && document.getElementById('iba-bg-layer') ? n : ''; }
  function video() {
    var host = document.getElementById('iba-bg-layer');
    var n = vWanted();
    if (!n) {
      if (vd) { try { vd.pause(); } catch (_) {} vd.style.opacity = '0'; if (vd.getAttribute('src')) { vd.removeAttribute('src'); try { vd.load(); } catch (_) {} } }
      return;
    }
    if (!vd || !vd.isConnected) {
      vd = document.createElement('video');
      vd.id = 'iba-bgvid';
      vd.muted = true; vd.defaultMuted = true; vd.loop = true; vd.autoplay = true; vd.playsInline = true;
      vd.setAttribute('muted', ''); vd.setAttribute('playsinline', ''); vd.setAttribute('aria-hidden', 'true'); vd.setAttribute('disablepictureinpicture', ''); vd.preload = 'auto';
      vd.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:0;transition:opacity .8s ease;display:block';
      vd.addEventListener('playing', function () { vd.style.opacity = '1'; });
      vd.addEventListener('error', function () { vd.style.opacity = '0'; }); // missing file: the photo stays
      host.insertBefore(vd, host.firstChild);
    }
    var src = VIDEO_BASE + encodeURIComponent(n) + '.mp4';
    if (vd.getAttribute('src') !== src) { vd.style.opacity = '0'; vd.setAttribute('src', src); }
    if (document.hidden) { try { vd.pause(); } catch (_) {} }
    else if (vd.paused) { var pr = vd.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  var lastKey = '';
  function update() {
    try { video(); } catch (_) {}
    var k = page() + ':' + level() + ':' + tlevel() + ':' + vWanted() + ':' + (host() ? host().id : '');
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
  setInterval(function () { if (page() + ':' + level() + ':' + tlevel() + ':' + vWanted() + ':' + (host() ? host().id : '') !== lastKey) update(); }, 1000);

  // ---- Firebase (same place as the photos and the dimming) ----
  function mainDb() { try { return (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db : null; } catch (_) { return null; } }
  function fromServer() {
    if (pagesVal && typeof pagesVal === 'object') return norm(pagesVal);
    var l = lv(legacy); // patch 191 single value = the three shell pages, Welcome stays still
    return norm({ login: 'off', workdesk: l, inventory: l, invoice: l });
  }
  function got() {
    var dirty = !same(shown, saved) || !vsame(vshown, vsaved) || !same(tshown, tsaved);
    saved = fromServer(); vsaved = vnorm(videoVal); tsaved = norm(thunderVal);
    try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); localStorage.setItem(TKEY, JSON.stringify(tsaved)); } catch (_) {}
    if (!dirty) { shown = copy(saved); vshown = vnorm(vsaved); tshown = copy(tsaved); }
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
    el.innerHTML = '<div class="iba-dim-head"><i class="fa-solid fa-cloud-rain"></i><div><h3>Moving background: video and rain</h3>' +
      '<p>Pick it for each page. A video plays instead of the photo, rain falls on top (you can use both), thunder comes with the rain. Rain and thunder also show on phones (lighter); videos are desktop only. Still photo + No rain = as it is now. Applies for everyone after Save.</p></div></div>' +
      PAGES.map(function (p) {
        return '<div class="iba-rain-row" data-rain-page="' + p[0] + '"><span class="iba-rain-pg"><i class="fa-solid ' + p[2] + '"></i> ' + p[1] + '</span>' +
          '<div class="iba-rain-opts" role="radiogroup" aria-label="Rain on ' + p[1] + '">' +
          ['off', 'light', 'heavy'].map(function (k) { return '<button type="button" class="secondary-btn" role="radio" data-rain="' + k + '">' + (k === 'off' ? 'No rain' : k === 'light' ? 'Light rain' : 'Heavy rain') + '</button>'; }).join('') +
          '</div><div class="iba-rain-opts iba-thunder-opts" role="radiogroup" aria-label="Thunder on ' + p[1] + '">' +
          ['off', 'light', 'heavy'].map(function (k) { return '<button type="button" class="secondary-btn" role="radio" data-thunder="' + k + '"><i class="fa-solid ' + (k === 'off' ? 'fa-cloud' : 'fa-bolt') + '"></i> ' + (k === 'off' ? 'No thunder' : k === 'light' ? 'Light thunder' : 'Heavy thunder') + '</button>'; }).join('') +
          '</div><label class="iba-rain-vid"><i class="fa-solid fa-film"></i> <select data-vid-page="' + p[0] + '" aria-label="Video on ' + p[1] + '"></select></label></div>';
      }).join('') +
      '<div class="iba-dim-acts"><span class="iba-dim-note"></span><button type="button" class="secondary-btn" data-thunder-test><i class="fa-solid fa-bolt"></i> Show a strike</button><button type="button" class="primary-btn iba-bg-save" data-rain-save>Save</button></div>';
    host.appendChild(el);
    fillSelects(); loadVideoList();
    el.addEventListener('click', function (e) {
      if (!isSuper()) return;
      var b = e.target.closest('[data-rain]');
      if (b) { var r = b.closest('[data-rain-page]'); if (r) { shown[r.getAttribute('data-rain-page')] = lv(b.getAttribute('data-rain')); paint(); update(); } return; }
      var tb = e.target.closest('[data-thunder]');
      if (tb) { var tr = tb.closest('[data-rain-page]'); if (tr) { tshown[tr.getAttribute('data-rain-page')] = lv(tb.getAttribute('data-thunder')); paint(); update(); } return; }
      if (e.target.closest('[data-thunder-test]')) { if (tlevel() === 'off') say('Pick rain and thunder for this page first (the strike shows on the background of this page).'); else strike(); return; }
      if (e.target.closest('[data-rain-save]')) save();
    });
    el.addEventListener('pointerdown', function (e) { if (isSuper() && e.target.closest('[data-vid-page]')) loadVideoList(true); }, true);
    el.addEventListener('focusin', function (e) { if (isSuper() && e.target.closest('[data-vid-page]')) loadVideoList(true); });
    el.addEventListener('change', function (e) {
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
      var noRain = shown[pg] === 'off';
      r.querySelectorAll('[data-thunder]').forEach(function (b) { var on = b.getAttribute('data-thunder') === (noRain ? 'off' : tshown[pg]); b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.disabled = !isSuper() || noRain; b.title = noRain ? 'Thunder comes with rain: pick Light or Heavy rain first' : ''; });
      var sl = r.querySelector('[data-vid-page]'); if (sl) { sl.value = vshown[pg] || ''; sl.disabled = !isSuper(); }
    });
    var tt = el.querySelector('[data-thunder-test]'); if (tt) tt.hidden = !isSuper();
    if (!same(shown, saved) || !vsame(vshown, vsaved) || !same(tshown, tsaved)) say('Not saved yet. Only this screen shows it (on this page).');
    else if ((el.querySelector('.iba-dim-note').textContent || '').indexOf('Not saved') === 0) say('');
  }
  function save() {
    var d = mainDb(); if (!d) { say('Could not reach Firebase. Try again.', true); return; }
    say('Saving...');
    var v = copy(shown), vv = vnorm(vshown), tv = copy(tshown);
    d.ref(PATH).update({ rainPages: v, videoPages: vv, thunderPages: tv }).then(function () { saved = v; vsaved = vv; tsaved = tv; try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); localStorage.setItem(TKEY, JSON.stringify(tsaved)); } catch (_) {} paint(); say('Saved for everyone.'); }, function () { say('Firebase did not accept it. Nothing was changed for others.', true); });
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
    get: function () { return { page: page(), saved: copy(saved), shown: copy(shown), thunder: copy(tshown), thunderSaved: copy(tsaved), video: vnorm(vshown), videoSaved: vnorm(vsaved) }; },
    video: function (pg, v) { if (vshown.hasOwnProperty(pg)) { vshown[pg] = okName(String(v || '').replace(/\.mp4$/i, '')); fillSelects(); paint(); update(); } },
    set: function (pg, v) { if (v === undefined) { v = pg; pg = page(); } if (shown.hasOwnProperty(pg)) { shown[pg] = lv(v); paint(); update(); } }
  };
})();
