/* 17.0.5 patch 203 (martin)
   1) Assistant side panel folds back to the robot when the mouse has been outside it for
      MINIMIZE_MS (PC only). Not the big expanded window, not while it is working, while you
      type in it, while a receipt / pop-up is open, or if the mouse never went into it.
      Nothing is cleared: the robot opens it again exactly as it was.
   2) Screensaver (PC only). Off by default; everyone has their own On/Off switch
      (Settings > Screensaver, saved in this browser). The Super Admin picks ONE video and
      after how many idle minutes it starts (default 5), saved for everyone in
      system_settings/screensaver, with a Preview button. Full screen video + clock.
      Any mouse move, click or key closes it; that first click/key does nothing else.
      It does not start while you type, while a pop-up is open or while the tab is hidden. */
(function () {
    'use strict';
    if (window.ibaIdle) return;
    const MINIMIZE_MS = 7000;                 // martin: 5-7 s; one place to change it
    const SS_PATH = 'system_settings/screensaver';
    const SS_ON = 'iba-ss-on-v1', SS_CFG = 'iba-ss-cfg-v1', VLIST = 'iba-bg-video-list-v1';
    const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30];
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const onPhone = () => !!(document.body && (document.body.classList.contains('iba-mobile-ui') || document.body.classList.contains('iba-phone')));
    function isSuper() { return !!(document.body && document.body.classList.contains('iba-is-super-admin')); }
    function signedIn() { return !!(document.body && document.body.classList.contains('iba-shell-on')); }
    function popupOpen() {
        return Array.from(document.querySelectorAll('.modal-overlay:not(.hidden), .iba-pb-layer, #iba-trk-rcpt, [role="dialog"][aria-modal="true"]:not([hidden])'))
            .some((x) => x.id !== 'iba-ss' && !x.closest('#iba-ai-panel:not(:has(#iba-trk-rcpt))') && x.getClientRects().length > 0);
    }
    function typing() {
        const a = document.activeElement;
        if (!a || a === document.body) return false;
        if (a.isContentEditable) return true;
        if (/^(TEXTAREA)$/.test(a.tagName)) return !!a.value;
        if (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(a.type)) return !!a.value;
        return false;
    }

    // ================= 1) assistant auto-minimize =================
    let entered = false, leaveT = 0;
    function panel() { return $('iba-ai-panel'); }
    function canFold(p) {
        if (!p || p.hidden || onPhone()) return false;
        if (p.classList.contains('is-wide')) return false;
        try { if (window.ibaAssistant && window.ibaAssistant._state && window.ibaAssistant._state.busy) return false; } catch (_) {}
        if (p.contains(document.activeElement) && typing()) return false;
        if (popupOpen()) return false;
        return true;
    }
    function fold() {
        leaveT = 0;
        const p = panel();
        if (!canFold(p)) return;
        p.hidden = true;
        const fab = $('iba-ai-fab'); if (fab) fab.classList.remove('is-open');
        entered = false;
    }
    function inside(el) { return !!(el && el.closest && el.closest('#iba-ai-panel, #iba-ai-fab, .iba-ai-float, .choices__list--dropdown')); }
    document.addEventListener('mouseover', (e) => {
        const p = panel(); if (!p || p.hidden) { entered = false; return; }
        if (inside(e.target)) { entered = true; if (leaveT) { clearTimeout(leaveT); leaveT = 0; } }
        else if (entered && !leaveT) leaveT = setTimeout(fold, MINIMIZE_MS);
    }, true);
    // typing / clicking in the panel keeps it open
    document.addEventListener('focusin', (e) => { if (inside(e.target) && leaveT) { clearTimeout(leaveT); leaveT = 0; } }, true);

    // ================= 2) screensaver =================
    let cfg = { video: '', minutes: 5 };
    try { const c = JSON.parse(localStorage.getItem(SS_CFG) || 'null'); if (c) cfg = norm(c); } catch (_) {}
    function norm(c) {
        const v = String((c && c.video) || '').replace(/\.mp4$/i, '');
        const m = Number(c && c.minutes);
        return { video: /^[A-Za-z0-9 ._-]{1,80}$/.test(v) ? v : '', minutes: MINUTES.indexOf(m) >= 0 ? m : 5 };
    }
    function userOn() { try { return localStorage.getItem(SS_ON) === '1'; } catch (_) { return false; } }
    function setUserOn(v) { try { localStorage.setItem(SS_ON, v ? '1' : '0'); } catch (_) {} }
    function videos() {
        let list = [];
        try { const vl = JSON.parse(localStorage.getItem(VLIST) || 'null'); if (vl && Array.isArray(vl.files)) list = vl.files.slice(); } catch (_) {}
        if (!list.length) list = ['V-Beach-01', 'V-Beach-02', 'V-Bus-01', 'V-City-01', 'V-City-02'];
        if (cfg.video && list.indexOf(cfg.video) < 0) list.push(cfg.video);
        return list;
    }
    function mainDb() { try { return (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db : null; } catch (_) { return null; } }
    (function watch(n) {
        const d = mainDb();
        if (d) {
            try { d.ref(SS_PATH).on('value', (s) => { const v = s && s.val(); if (v) { cfg = norm(v); try { localStorage.setItem(SS_CFG, JSON.stringify(cfg)); } catch (_) {} paint(); } }); return; } catch (_) {}
        }
        if (n < 60) setTimeout(() => watch(n + 1), 500);
    })(0);

    let last = Date.now(), ss = null, shownAt = 0, startX = null, startY = null, clockT = 0;
    function activity() { last = Date.now(); }
    ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'pointerdown', 'scroll'].forEach((t) => window.addEventListener(t, activity, { capture: true, passive: true }));

    function clockHtml() {
        const d = new Date();
        let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        const t = h + ':' + String(d.getMinutes()).padStart(2, '0');
        const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return '<div class="iba-ss-time">' + t + '<small>' + ap + '</small></div><div class="iba-ss-date">' + esc(day) + '</div>';
    }
    function show(preview) {
        if (ss) return;
        ss = document.createElement('div');
        ss.id = 'iba-ss';
        ss.setAttribute('role', 'dialog'); ss.setAttribute('aria-label', 'Screensaver');
        const v = preview && preview.video !== undefined ? preview.video : cfg.video;
        ss.innerHTML = (v ? '<video muted loop playsinline autoplay preload="auto" src="video/' + encodeURIComponent(v) + '.mp4"></video>' : '') +
            '<div class="iba-ss-clock"></div><div class="iba-ss-hint">Move the mouse or press any key</div>';
        document.body.appendChild(ss);
        const vd = ss.querySelector('video');
        if (vd) { vd.addEventListener('playing', () => vd.classList.add('is-on')); vd.addEventListener('error', () => vd.remove()); const pr = vd.play(); if (pr && pr.catch) pr.catch(() => {}); }
        const ck = ss.querySelector('.iba-ss-clock');
        const tick = () => { if (ck) ck.innerHTML = clockHtml(); };
        tick(); clockT = setInterval(tick, 1000);
        shownAt = Date.now(); startX = startY = null;
        requestAnimationFrame(() => { if (ss) ss.classList.add('is-in'); });
    }
    function hide() {
        if (!ss) return;
        const el = ss; ss = null;
        clearInterval(clockT);
        el.classList.remove('is-in');
        setTimeout(() => el.remove(), 250);
        activity();
    }
    // closing input: the first move / click / key only closes it
    function eat(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    let eatClickUntil = 0;
    window.addEventListener('mousemove', (e) => {
        if (!ss || Date.now() - shownAt < 600) return;
        if (startX === null) { startX = e.clientX; startY = e.clientY; return; }
        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 8) hide();
    }, true);
    ['pointerdown', 'mousedown', 'touchstart'].forEach((t) => window.addEventListener(t, (e) => { if (!ss) return; eat(e); eatClickUntil = Date.now() + 600; hide(); }, { capture: true, passive: false }));
    ['click', 'mouseup', 'pointerup', 'dblclick', 'contextmenu'].forEach((t) => window.addEventListener(t, (e) => { if (ss || Date.now() < eatClickUntil) eat(e); }, true));
    window.addEventListener('keydown', (e) => { if (!ss) return; eat(e); hide(); }, true);
    window.addEventListener('wheel', (e) => { if (ss) { hide(); } }, { capture: true, passive: true });

    setInterval(() => {
        if (ss || !userOn() || !signedIn() || onPhone() || document.hidden) return;
        if (Date.now() - last < cfg.minutes * 60000) return;
        if (typing() || popupOpen()) { activity(); return; }
        show();
    }, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) activity(); });
    window.addEventListener('iba:video-list', () => paint());

    // ---- Settings card (everyone: On/Off; Super Admin: video, minutes, Preview, Save) ----
    function card() { return $('iba-ss-settings'); }
    function build() {
        if (card()) return true;
        const after = document.querySelector('.settings-card.settings-audio-card');
        if (!after) return false;
        const el = document.createElement('div');
        el.className = 'settings-card iba-ss-card';
        el.id = 'iba-ss-settings';
        el.innerHTML = '<div class="settings-card-header compact"><div class="settings-card-icon"><i class="fa-solid fa-tv"></i></div><div>' +
            '<h2>Screensaver</h2><p>When you leave the computer, a calm video with the time fills the screen. Move the mouse or press a key to come back. This switch is only for you.</p></div></div>' +
            '<button type="button" class="secondary-btn iba-ss-toggle" data-ss-toggle></button>' +
            '<div class="iba-ss-admin" data-ss-admin hidden>' +
            '<div class="iba-ss-admin-t"><i class="fa-solid fa-user-shield"></i> Super Admin · for everyone</div>' +
            '<label>Video <select data-ss-video></select></label>' +
            '<label>Start after <select data-ss-min>' + MINUTES.map((m) => '<option value="' + m + '">' + m + ' min' + (m === 1 ? '' : 's') + ' idle</option>').join('') + '</select></label>' +
            '<div class="iba-ss-acts"><button type="button" class="secondary-btn" data-ss-preview><i class="fa-solid fa-play"></i> Preview</button>' +
            '<button type="button" class="primary-btn" data-ss-save>Save</button><span class="iba-ss-note" data-ss-note></span></div></div>';
        after.after(el);
        el.addEventListener('click', (e) => {
            if (e.target.closest('[data-ss-toggle]')) { setUserOn(!userOn()); activity(); paint(); return; }
            if (e.target.closest('[data-ss-preview]')) { const sel = el.querySelector('[data-ss-video]'); setTimeout(() => show({ video: sel ? sel.value : cfg.video }), 150); return; }
            if (e.target.closest('[data-ss-save]')) save();
        });
        el.addEventListener('change', (e) => { const x = e.target.closest('[data-ss-video],[data-ss-min]'); if (x) { x.dataset.picked = '1'; note('Not saved yet. Press Save to use it for everyone.'); } });
        el.addEventListener('pointerdown', (e) => { if (isSuper() && e.target.closest('[data-ss-video]') && window.ibaRain && typeof window.ibaRain.refreshVideos === 'function') window.ibaRain.refreshVideos(); }, true);
        paint();
        return true;
    }
    let painted = '';
    function paint() {
        const el = card(); if (!el) return;
        const on = userOn();
        const t = el.querySelector('[data-ss-toggle]');
        if (t) { t.classList.toggle('is-on', on); t.innerHTML = on ? '<i class="fa-solid fa-toggle-on"></i> Screensaver On' : '<i class="fa-solid fa-toggle-off"></i> Screensaver Off'; t.setAttribute('aria-pressed', on ? 'true' : 'false'); }
        const adm = el.querySelector('[data-ss-admin]');
        if (adm) adm.hidden = !isSuper();
        const key = JSON.stringify(videos()) + '|' + JSON.stringify(cfg);
        if (key !== painted) {
            painted = key;
            const sv = el.querySelector('[data-ss-video]');
            // patch 217: a new video list must not undo an unsaved pick
            const keepV = sv && sv.dataset.picked === '1' ? sv.value : null;
            const sm = el.querySelector('[data-ss-min]'), keepM = sm && sm.dataset.picked === '1' ? sm.value : null;
            if (sv) { sv.innerHTML = '<option value="">No video (clock only)</option>' + videos().map((v) => '<option value="' + esc(v) + '">' + esc(v.replace(/^V-/, '')) + '</option>').join(''); sv.value = keepV != null ? keepV : cfg.video; }
            if (sm) sm.value = keepM != null ? keepM : String(cfg.minutes);
        }
    }
    function note(t, bad) { const n = card() && card().querySelector('[data-ss-note]'); if (n) { n.textContent = t || ''; n.classList.toggle('is-bad', !!bad); } }
    function save() {
        if (!isSuper()) return;
        const el = card(); const d = mainDb();
        if (!d) { note('Could not reach Firebase. Try again.', true); return; }
        const next = norm({ video: el.querySelector('[data-ss-video]').value, minutes: Number(el.querySelector('[data-ss-min]').value) });
        note('Saving...');
        d.ref(SS_PATH).set({ video: next.video, minutes: next.minutes }).then(() => { cfg = next; el.querySelectorAll('[data-picked]').forEach((x) => { delete x.dataset.picked; }); try { localStorage.setItem(SS_CFG, JSON.stringify(cfg)); } catch (_) {} painted = ''; paint(); note('Saved for everyone.'); },
            () => note('Firebase did not accept it. Nothing was changed.', true));
    }
    function boot() { let n = 0; (function again() { if (!build() && n++ < 60) setTimeout(again, 750); })(); setInterval(paint, 3000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

    window.ibaIdle = { MINIMIZE_MS, show, hide, fold, cfg: () => Object.assign({}, cfg), on: userOn };
})();
