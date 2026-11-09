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
 * 17.0.5 patch 194: buttons were left locked when Settings was built before the Super Admin sign-in. */
(function () {
  'use strict';
  if (window.ibaRain) return;
  var PATH = 'system_settings/shell_backgrounds';
  var KEY = 'iba-rain-pages-v1', VKEY = 'iba-bg-video-v1';
  var VIDEO_BASE = 'video/';
  // martin's files in Project_01\video (add new names here)
  var VIDEOS = ['V-Beach-01', 'V-Beach-02', 'V-Bus-01', 'V-City-01', 'V-City-02'];
  var LEVELS = { off: 0, light: 110, heavy: 260 };
  var PAGES = [['login', 'Welcome screen', 'fa-door-open'], ['workdesk', 'WorkDesk', 'fa-briefcase'], ['inventory', 'Inventory', 'fa-boxes-stacked'], ['invoice', 'Invoice Management', 'fa-file-invoice']];
  function lv(v) { v = String(v || '').toLowerCase(); return LEVELS.hasOwnProperty(v) ? v : 'off'; }
  function norm(o) { var r = {}; PAGES.forEach(function (p) { r[p[0]] = lv(o && o[p[0]]); }); return r; }
  function same(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  function copy(o) { return norm(o); }
  var saved = norm({});
  try { var ls = JSON.parse(localStorage.getItem(KEY) || 'null'); if (ls) saved = norm(ls); } catch (_) {}
  var shown = copy(saved);
  function vnorm(o) { var r = {}; PAGES.forEach(function (p) { var v = String((o && o[p[0]]) || '').replace(/\.mp4$/i, ''); r[p[0]] = VIDEOS.indexOf(v) >= 0 ? v : ''; }); return r; }
  function vsame(a, b) { return PAGES.every(function (p) { return a[p[0]] === b[p[0]]; }); }
  var vsaved = vnorm({});
  try { var lv2 = JSON.parse(localStorage.getItem(VKEY) || 'null'); if (lv2) vsaved = vnorm(lv2); } catch (_) {}
  var vshown = vnorm(vsaved), videoVal = null;
  var legacy = null, pagesVal = null;
  var cv = null, ctx = null, drops = [], raf = 0, last = 0, W = 0, H = 0;

  function page() {
    var b = document.body;
    if (!b || !b.classList.contains('iba-shell-on')) return 'login';
    var m = String(window.__ibaActiveModule || '').toLowerCase();
    if (m === 'inventory') return 'inventory';
    if (m === 'invoice' || m === 'invoice-management') return 'invoice';
    if (m === 'login' || m === 'home') return 'login';
    return 'workdesk';
  }
  function level() { return shown[page()] || 'off'; }
  function reduced() { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function onPhone() {
    var b = document.body; if (!b) return true;
    if (b.classList.contains('iba-mobile-ui') || b.classList.contains('iba-phone')) return true;
    return Math.min(window.innerWidth, window.innerHeight) < 600;
  }
  function wanted() { return LEVELS[level()] > 0 && !reduced() && !onPhone() && !document.hidden && !!document.getElementById('iba-bg-layer'); }

  function drop(top) {
    return { x: Math.random() * (W + 200) - 100, y: top ? -Math.random() * H : Math.random() * H, l: 18 + Math.random() * 24, v: 11 + Math.random() * 9, a: 0.25 + Math.random() * 0.3, w: Math.random() < 0.15 ? 1.4 : 0.9 };
  }
  function size() {
    if (!cv) return;
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
  }
  function ensure() {
    var host = document.getElementById('iba-bg-layer');
    if (!host) return false;
    if (!cv || !cv.isConnected) {
      cv = document.createElement('canvas');
      cv.id = 'iba-rain';
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block';
      host.appendChild(cv);
      ctx = cv.getContext('2d');
      size();
    }
    var n = LEVELS[level()];
    while (drops.length < n) drops.push(drop(false));
    if (drops.length > n) drops.length = n;
    return true;
  }
  function frame(t) {
    raf = 0;
    if (!wanted()) { stop(); return; }
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return; // ~30 fps
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
  }
  function start() {
    if (!wanted() || !ensure()) { stop(); return; }
    cv.style.display = 'block';
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
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
    var src = VIDEO_BASE + n + '.mp4';
    if (vd.getAttribute('src') !== src) { vd.style.opacity = '0'; vd.setAttribute('src', src); }
    if (document.hidden) { try { vd.pause(); } catch (_) {} }
    else if (vd.paused) { var pr = vd.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  var lastKey = '';
  function update() {
    try { video(); } catch (_) {}
    var k = page() + ':' + level() + ':' + vWanted();
    if (k !== lastKey) { lastKey = k; if (cv) ensure(); }
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
  setInterval(function () { if (page() + ':' + level() + ':' + vWanted() !== lastKey) update(); }, 1000);

  // ---- Firebase (same place as the photos and the dimming) ----
  function mainDb() { try { return (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db : null; } catch (_) { return null; } }
  function fromServer() {
    if (pagesVal && typeof pagesVal === 'object') return norm(pagesVal);
    var l = lv(legacy); // patch 191 single value = the three shell pages, Welcome stays still
    return norm({ login: 'off', workdesk: l, inventory: l, invoice: l });
  }
  function got() {
    var dirty = !same(shown, saved) || !vsame(vshown, vsaved);
    saved = fromServer(); vsaved = vnorm(videoVal);
    try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); } catch (_) {}
    if (!dirty) { shown = copy(saved); vshown = vnorm(vsaved); }
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
      '<p>Pick it for each page. A video plays instead of the photo, rain falls on top (you can use both). Desktop only, phones keep the still photo. Still photo + Off = as it is now. Applies for everyone after Save.</p></div></div>' +
      PAGES.map(function (p) {
        return '<div class="iba-rain-row" data-rain-page="' + p[0] + '"><span class="iba-rain-pg"><i class="fa-solid ' + p[2] + '"></i> ' + p[1] + '</span>' +
          '<div class="iba-rain-opts" role="radiogroup" aria-label="Rain on ' + p[1] + '">' +
          ['off', 'light', 'heavy'].map(function (k) { return '<button type="button" class="secondary-btn" role="radio" data-rain="' + k + '">' + (k === 'off' ? 'No rain' : k === 'light' ? 'Light rain' : 'Heavy rain') + '</button>'; }).join('') +
          '</div><label class="iba-rain-vid"><i class="fa-solid fa-film"></i> <select data-vid-page="' + p[0] + '" aria-label="Video on ' + p[1] + '"><option value="">Still photo</option>' +
          VIDEOS.map(function (v) { return '<option value="' + v + '">Video ' + v.replace(/^V-/, '') + '</option>'; }).join('') + '</select></label></div>';
      }).join('') +
      '<div class="iba-dim-acts"><span class="iba-dim-note"></span><button type="button" class="primary-btn iba-bg-save" data-rain-save>Save</button></div>';
    host.appendChild(el);
    el.addEventListener('click', function (e) {
      if (!isSuper()) return;
      var b = e.target.closest('[data-rain]');
      if (b) { var r = b.closest('[data-rain-page]'); if (r) { shown[r.getAttribute('data-rain-page')] = lv(b.getAttribute('data-rain')); paint(); update(); } return; }
      if (e.target.closest('[data-rain-save]')) save();
    });
    el.addEventListener('change', function (e) {
      var sl = e.target.closest('[data-vid-page]'); if (!sl) return;
      if (!isSuper()) { paint(); return; }
      vshown[sl.getAttribute('data-vid-page')] = sl.value; paint(); update();
    });
    paint();
  }
  function say(t, bad) { var n = box() && box().querySelector('.iba-dim-note'); if (n) { n.textContent = t || ''; n.classList.toggle('is-bad', !!bad); } }
  function paint() {
    var el = box(); if (!el) return;
    el.querySelectorAll('[data-rain-page]').forEach(function (r) {
      var pg = r.getAttribute('data-rain-page');
      r.querySelectorAll('[data-rain]').forEach(function (b) { var on = b.getAttribute('data-rain') === shown[pg]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.disabled = !isSuper(); });
      var sl = r.querySelector('[data-vid-page]'); if (sl) { sl.value = vshown[pg] || ''; sl.disabled = !isSuper(); }
    });
    if (!same(shown, saved) || !vsame(vshown, vsaved)) say('Not saved yet. Only this screen shows it (on this page).');
    else if ((el.querySelector('.iba-dim-note').textContent || '').indexOf('Not saved') === 0) say('');
  }
  function save() {
    var d = mainDb(); if (!d) { say('Could not reach Firebase. Try again.', true); return; }
    say('Saving...');
    var v = copy(shown), vv = vnorm(vshown);
    d.ref(PATH).update({ rainPages: v, videoPages: vv }).then(function () { saved = v; vsaved = vv; try { localStorage.setItem(KEY, JSON.stringify(saved)); localStorage.setItem(VKEY, JSON.stringify(vsaved)); } catch (_) {} paint(); say('Saved for everyone.'); }, function () { say('Firebase did not accept it. Nothing was changed for others.', true); });
  }
  function boot() {
    build(); update();
    // the settings page may be built later
    var tries = 0; (function again() { if (!box() && tries++ < 40) { build(); setTimeout(again, 750); } })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.ibaRain = {
    get: function () { return { page: page(), saved: copy(saved), shown: copy(shown), video: vnorm(vshown), videoSaved: vnorm(vsaved) }; },
    video: function (pg, v) { if (vshown.hasOwnProperty(pg)) { var n = String(v || '').replace(/\.mp4$/i, ''); vshown[pg] = VIDEOS.indexOf(n) >= 0 ? n : ''; paint(); update(); } },
    set: function (pg, v) { if (v === undefined) { v = pg; pg = page(); } if (shown.hasOwnProperty(pg)) { shown[pg] = lv(v); paint(); update(); } }
  };
})();
