/* ==========================================================================
   js/iba-1705-ver.js — 17.0.5 patch 27
   Settings shows which version and patch this page is running
   (window.IBA_PATCH in index.html), and "Check now" reads index.html on
   the server (no Firebase) to say if a newer patch has been uploaded.
   Every upload: bump window.IBA_PATCH / IBA_PATCH_DATE in index.html.
   ========================================================================== */
(function () {
    'use strict';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const mine = () => ({ ver: String(window.IBA_SYSTEM_VERSION || ''), patch: String(window.IBA_PATCH || ''), date: String(window.IBA_PATCH_DATE || '') });
    const label = (v) => (v.patch ? 'Version ' + v.ver + ' · patch ' + v.patch : 'Version ' + v.ver);

    function card() {
        const v = mine();
        return '<div class="settings-card-header compact">' +
            '<div class="settings-card-icon"><i class="fa-solid fa-code-branch"></i></div>' +
            '<div><h2>System Version</h2><p>The version and patch this page is running.</p></div></div>' +
            '<div class="iba-ver-body"><b class="iba-ver-now">' + esc(label(v)) + '</b>' +
            (v.date ? '<small>Updated ' + esc(v.date) + '</small>' : '') +
            '<p class="iba-ver-msg" data-ver-msg></p>' +
            '<button type="button" class="secondary-btn settings-audio-btn" data-ver-check><i class="fa-solid fa-rotate"></i> Check now</button></div>';
    }
    function paint() {
        const sec = document.getElementById('wd-settings');
        const grid = sec && sec.querySelector('.settings-grid');
        if (!grid || document.getElementById('iba-ver-card')) return;
        const el = document.createElement('div');
        el.id = 'iba-ver-card';
        el.className = 'settings-card settings-audio-card iba-ver-card';
        el.innerHTML = card();
        const audio = grid.querySelector('.settings-audio-card');
        if (audio && audio.nextSibling) grid.insertBefore(el, audio.nextSibling); else grid.appendChild(el);
    }
    async function check(btn) {
        const box = document.getElementById('iba-ver-card');
        const msg = box && box.querySelector('[data-ver-msg]');
        if (!msg) return;
        btn.disabled = true;
        msg.className = 'iba-ver-msg';
        msg.textContent = 'Checking…';
        try {
            const r = await fetch('index.html?ibaVer=' + Date.now(), { cache: 'no-store' });
            const t = await r.text();
            const m = t.match(/IBA_PATCH\s*=\s*['"]([^'"]*)['"]/);
            const sv = t.match(/IBA_SYSTEM_VERSION\s*=\s*['"]([^'"]*)['"]/);
            const srv = { ver: sv ? sv[1] : '', patch: m ? m[1] : '' };
            const v = mine();
            if (srv.ver === v.ver && srv.patch === v.patch) {
                msg.classList.add('is-ok');
                msg.textContent = 'You are on the latest upload.';
            } else {
                msg.classList.add('is-new');
                msg.innerHTML = 'A newer upload is on the server: <b>' + esc(label(srv)) + '</b>. <button type="button" data-ver-reload>Reload now</button>';
            }
        } catch (err) {
            msg.textContent = 'Could not check now (no connection?).';
        }
        btn.disabled = false;
    }
    document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest ? e.target.closest('[data-ver-check], [data-ver-reload]') : null;
        if (!t) return;
        e.preventDefault();
        if (t.hasAttribute('data-ver-reload')) { location.reload(); return; }
        check(t);
    });
    function start() {
        paint();
        // Settings may be drawn again: put the card back when needed
        try { new MutationObserver(() => { if (!document.getElementById('iba-ver-card')) paint(); }).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    window.ibaVersion = { mine, check: () => { const b = document.querySelector('[data-ver-check]'); if (b) check(b); } };
})();
