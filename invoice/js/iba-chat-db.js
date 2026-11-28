/* js/iba-chat-db.js - 18.0.0 patch 162 (martin): chat, online status and reminders live in their OWN Firebase
   project (ibachat-f1250), so chat downloads never count against the main database's 10 GB.
   Everything that talks (Messages window, Forward task, IBA Office, IRIS reminders, Stuck "Remind",
   vacation hand-over notes) uses window.ibaChatDb. If this file is missing or the config is empty,
   window.ibaChatDb stays undefined and everything falls back to the main database exactly as before. */
(function () {
    'use strict';
    var CFG = {
        apiKey: 'AIzaSyDoKVbEIP-p2EO6um-Wn9Ia06X0qgJhE9c',
        authDomain: 'ibachat-f1250.firebaseapp.com',
        databaseURL: 'https://ibachat-f1250-default-rtdb.europe-west1.firebasedatabase.app',
        projectId: 'ibachat-f1250',
        storageBucket: 'ibachat-f1250.firebasestorage.app',
        messagingSenderId: '1056783330120',
        appId: '1:1056783330120:web:9db01f7439b71d4343217d'
    };
    try {
        if (!CFG.databaseURL || !CFG.apiKey || !window.firebase || !firebase.initializeApp) return;
        var app = (firebase.apps || []).filter(function (a) { return a && a.name === 'ibaChat'; })[0] || firebase.initializeApp(CFG, 'ibaChat');
        window.ibaChatDb = app.database();
        window.IBA_CHAT_DB_NAME = CFG.projectId;
    } catch (e) { console.warn('[chat db] could not start, using the main database', e); }
})();

/* Settings › "Chat usage" card (Super Admin only): today's messages per person and the last 7 days, read from
   chat_usage/{day}/{userKey} {p: private, u: public, n: name} in the chat database (a few hundred bytes a day). */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function isSuper() { try { return typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function day(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    async function paint() {
        var sec = $('settings-form') || $('wd-settings'); if (!sec) return;
        var card = $('iba-chatuse-card');
        if (!isSuper() || !window.ibaChatDb) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div'); card.id = 'iba-chatuse-card'; card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-comments"></i></div><div>' +
                '<h2>Chat usage</h2><p>Super Admin only. Messages sent today and this week (chat database ' + esc(window.IBA_CHAT_DB_NAME || '') + '). Limits per person a day: 200 private, 20 public, 200 characters in the office.</p></div></div>' +
                '<div class="iba-chatuse-body" style="font-size:13.5px;line-height:1.5">Loading…</div>' +
                '<div class="settings-action-row"><button class="primary-btn" type="button" data-cu-refresh><i class="fa-solid fa-rotate"></i> Refresh</button></div>';
            var after = $('iba-sa-settings-card') || $('iba-lpo-settings-card') || $('iba-esn-settings-card');
            if (after && after.parentElement) after.insertAdjacentElement('afterend', card); else sec.appendChild(card);
            card.addEventListener('click', function (e) { if (e.target.closest('[data-cu-refresh]')) { e.preventDefault(); paint(); } });
        }
        var body = card.querySelector('.iba-chatuse-body');
        try {
            var snap = await window.ibaChatDb.ref('chat_usage').orderByKey().limitToLast(7).once('value'); var all = snap.val() || {};
            var today = all[day(new Date())] || {}; var rows = Object.keys(today).map(function (k) { var v = today[k] || {}; return { n: v.n || k, p: +v.p || 0, u: +v.u || 0 }; }).sort(function (a, b) { return (b.p + b.u) - (a.p + a.u); });
            var tp = 0, tu = 0; rows.forEach(function (r) { tp += r.p; tu += r.u; });
            var week = 0; Object.keys(all).forEach(function (d) { var o = all[d] || {}; Object.keys(o).forEach(function (k) { week += (+o[k].p || 0) + (+o[k].u || 0); }); });
            body.innerHTML = '<p><b>Today:</b> ' + tp + ' private · ' + tu + ' public · <b>7 days:</b> ' + week + ' messages</p>' +
                (rows.length ? '<table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr><th style="text-align:left">Person</th><th>Private</th><th>Public</th></tr></thead><tbody>' +
                    rows.slice(0, 15).map(function (r) { var hot = r.p >= 150 || r.u >= 15; return '<tr' + (hot ? ' style="color:#ff9a9d"' : '') + '><td>' + esc(r.n) + '</td><td style="text-align:center">' + r.p + '</td><td style="text-align:center">' + r.u + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>No messages yet today.</p>');
        } catch (e) { body.textContent = 'Could not read the usage: ' + (e && e.message || e); }
    }
    (function watch() {
        var sec = $('wd-settings'); if (!sec) { setTimeout(watch, 1500); return; }
        var was = false;
        new MutationObserver(function () { var vis = !sec.classList.contains('hidden'); if (vis && !was) setTimeout(paint, 350); was = vis; }).observe(sec, { attributes: true, attributeFilter: ['class'] });
    })();
    window.ibaChatUsage = { paint: paint };
})();
