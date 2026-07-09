/* =========================================================
   IBA System Version Checker - v11.0.1
   Purpose: Notify users when their open browser tab is older
            than the live version.json file.
   Scope: UI notice only. No workflow/Firebase/data logic.
   ========================================================= */
(function () {
    'use strict';

    var CURRENT_VERSION = String(window.IBA_SYSTEM_VERSION || window.APP_VERSION || '').trim();
    var VERSION_URL = window.IBA_VERSION_CHECK_URL || './version.json';
    var CHECK_INTERVAL_MS = 120000; // 2 minutes
    var REMIND_LATER_MS = 15 * 60 * 1000; // 15 minutes
    var lastShownForVersion = '';
    var lastCheckAt = 0;
    var remindLaterUntil = 0;

    function normalizeVersion(version) {
        return String(version || '')
            .trim()
            .replace(/^v/i, '')
            .split(/[\s+-]/)[0];
    }

    function compareVersions(a, b) {
        var av = normalizeVersion(a).split('.').map(function (n) { return parseInt(n, 10) || 0; });
        var bv = normalizeVersion(b).split('.').map(function (n) { return parseInt(n, 10) || 0; });
        var max = Math.max(av.length, bv.length, 3);
        for (var i = 0; i < max; i++) {
            var ai = av[i] || 0;
            var bi = bv[i] || 0;
            if (ai > bi) return 1;
            if (ai < bi) return -1;
        }
        return 0;
    }

    function removeExistingNotice() {
        var existing = document.getElementById('iba-system-update-notice');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }

    function buildReloadUrl() {
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('iba_refresh', Date.now().toString());
            return url.toString();
        } catch (e) {
            var sep = window.location.href.indexOf('?') === -1 ? '?' : '&';
            return window.location.href + sep + 'iba_refresh=' + Date.now();
        }
    }

    function updateNow() {
        try {
            sessionStorage.removeItem('ibaUpdateDismissedVersion');
        } catch (e) {}
        window.location.replace(buildReloadUrl());
    }

    function remindLater(latestVersion) {
        remindLaterUntil = Date.now() + REMIND_LATER_MS;
        try {
            sessionStorage.setItem('ibaUpdateDismissedVersion', latestVersion + '|' + remindLaterUntil);
        } catch (e) {}
        removeExistingNotice();
    }

    function readDismissed(latestVersion) {
        try {
            var stored = sessionStorage.getItem('ibaUpdateDismissedVersion') || '';
            var parts = stored.split('|');
            if (parts[0] === latestVersion && Number(parts[1]) > Date.now()) {
                remindLaterUntil = Number(parts[1]);
                return true;
            }
        } catch (e) {}
        return remindLaterUntil > Date.now();
    }

    function showUpdateNotice(data) {
        var latestVersion = normalizeVersion(data.version);
        var currentVersion = normalizeVersion(CURRENT_VERSION);
        var message = data.message || 'A newer version of IBA System is available. Please refresh to continue using the latest version.';

        if (!latestVersion || compareVersions(currentVersion, latestVersion) >= 0) {
            removeExistingNotice();
            lastShownForVersion = '';
            return;
        }

        if (readDismissed(latestVersion)) return;
        if (lastShownForVersion === latestVersion && document.getElementById('iba-system-update-notice')) return;

        removeExistingNotice();
        lastShownForVersion = latestVersion;

        var notice = document.createElement('div');
        notice.id = 'iba-system-update-notice';
        notice.className = 'iba-system-update-notice';
        notice.setAttribute('role', 'dialog');
        notice.setAttribute('aria-live', 'polite');
        notice.innerHTML = [
            '<div class="iba-system-update-icon">↻</div>',
            '<div class="iba-system-update-body">',
                '<div class="iba-system-update-title">System Update Available</div>',
                '<div class="iba-system-update-text">' + escapeHtml(message) + '</div>',
                '<div class="iba-system-update-version">Current: V ' + escapeHtml(currentVersion || 'Unknown') + ' &nbsp;•&nbsp; Latest: V ' + escapeHtml(latestVersion) + '</div>',
                '<div class="iba-system-update-actions">',
                    '<button type="button" class="iba-system-update-later">Later</button>',
                    '<button type="button" class="iba-system-update-now">Update Now</button>',
                '</div>',
            '</div>'
        ].join('');

        document.body.appendChild(notice);

        var laterBtn = notice.querySelector('.iba-system-update-later');
        var updateBtn = notice.querySelector('.iba-system-update-now');
        if (laterBtn) laterBtn.addEventListener('click', function () { remindLater(latestVersion); });
        if (updateBtn) updateBtn.addEventListener('click', updateNow);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function checkLatestVersion() {
        if (!CURRENT_VERSION) return;
        lastCheckAt = Date.now();
        var cacheBust = VERSION_URL.indexOf('?') === -1 ? '?' : '&';
        var url = VERSION_URL + cacheBust + 't=' + Date.now();

        fetch(url, { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('Version file not available');
                return res.json();
            })
            .then(showUpdateNotice)
            .catch(function (err) {
                if (window.console && console.warn) {
                    console.warn('[IBA Version Check]', err && err.message ? err.message : err);
                }
            });
    }

    function startVersionChecker() {
        if (!CURRENT_VERSION) {
            if (window.console && console.warn) console.warn('[IBA Version Check] Current version not defined.');
            return;
        }

        setTimeout(checkLatestVersion, 4000);
        setInterval(checkLatestVersion, CHECK_INTERVAL_MS);

        window.addEventListener('focus', function () {
            if (Date.now() - lastCheckAt > 30000) checkLatestVersion();
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && Date.now() - lastCheckAt > 30000) checkLatestVersion();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startVersionChecker);
    } else {
        startVersionChecker();
    }
})();
