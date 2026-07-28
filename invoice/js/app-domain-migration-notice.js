/*
   IBA Portal Domain Migration Notice
   Version: 11.4.6
   Scope: UI-only migration announcement and countdown.
   No redirect, Firebase, authentication, workflow, or domain-link changes.
*/

(function () {
    'use strict';

    const MIGRATION_AT = Date.parse('2026-08-01T00:00:00+03:00');
    const OLD_DOMAIN = 'ibaport.site';
    const NEW_DOMAIN = 'port.iba.com.qa';
    const NOTICE_ID = 'iba-domain-migration-overlay';
    const COUNTDOWN_ID = 'iba-domain-migration-countdown';

    let countdownTimer = null;
    let acknowledgedThisSession = false;
    let lastFocusedElement = null;

    function getRemainingParts() {
        const remaining = Math.max(0, MIGRATION_AT - Date.now());
        const totalSeconds = Math.floor(remaining / 1000);

        return {
            complete: remaining <= 0,
            days: Math.floor(totalSeconds / 86400),
            hours: Math.floor((totalSeconds % 86400) / 3600),
            minutes: Math.floor((totalSeconds % 3600) / 60),
            seconds: totalSeconds % 60
        };
    }

    function pad(value) {
        return String(Math.max(0, Number(value) || 0)).padStart(2, '0');
    }

    function ensureCountdown() {
        let countdown = document.getElementById(COUNTDOWN_ID);
        if (countdown) return countdown;

        countdown = document.createElement('button');
        countdown.id = COUNTDOWN_ID;
        countdown.className = 'iba-domain-migration-countdown';
        countdown.type = 'button';
        countdown.setAttribute('aria-label', 'Open IBA Portal domain migration information');
        countdown.innerHTML = [
            '<span class="iba-domain-migration-countdown-icon" aria-hidden="true">',
                '<i class="fa-solid fa-globe"></i>',
            '</span>',
            '<span class="iba-domain-migration-countdown-copy">',
                '<span class="iba-domain-migration-countdown-label">DOMAIN MIGRATION IN</span>',
                '<span class="iba-domain-migration-countdown-time" aria-live="off">',
                    '<span data-domain-days>00</span><small>D</small>',
                    '<span data-domain-hours>00</span><small>H</small>',
                    '<span data-domain-minutes>00</span><small>M</small>',
                    '<span data-domain-seconds>00</span><small>S</small>',
                '</span>',
                '<span class="iba-domain-migration-countdown-domain">New: ' + NEW_DOMAIN + '</span>',
            '</span>'
        ].join('');

        countdown.addEventListener('click', function () {
            showMigrationDialog(true);
        });

        document.body.appendChild(countdown);
        return countdown;
    }

    function updateCountdown() {
        const countdown = ensureCountdown();
        const parts = getRemainingParts();

        const days = countdown.querySelector('[data-domain-days]');
        const hours = countdown.querySelector('[data-domain-hours]');
        const minutes = countdown.querySelector('[data-domain-minutes]');
        const seconds = countdown.querySelector('[data-domain-seconds]');
        const label = countdown.querySelector('.iba-domain-migration-countdown-label');

        if (days) days.textContent = pad(parts.days);
        if (hours) hours.textContent = pad(parts.hours);
        if (minutes) minutes.textContent = pad(parts.minutes);
        if (seconds) seconds.textContent = pad(parts.seconds);

        countdown.classList.toggle('is-migration-live', parts.complete);
        if (label) {
            label.textContent = parts.complete ? 'NEW DOMAIN IS NOW ACTIVE' : 'DOMAIN MIGRATION IN';
        }
    }

    function startCountdown() {
        const countdown = ensureCountdown();
        countdown.classList.add('is-visible');
        updateCountdown();

        if (countdownTimer) window.clearInterval(countdownTimer);
        countdownTimer = window.setInterval(updateCountdown, 1000);
    }

    function ensureDialog() {
        let overlay = document.getElementById(NOTICE_ID);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = NOTICE_ID;
        overlay.className = 'iba-domain-migration-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="iba-domain-migration-dialog" role="dialog" aria-modal="true" aria-labelledby="iba-domain-migration-title" aria-describedby="iba-domain-migration-description">',
                '<div class="iba-domain-migration-alert-icon" aria-hidden="true">',
                    '<i class="fa-solid fa-globe"></i>',
                '</div>',
                '<div class="iba-domain-migration-kicker">IMPORTANT SYSTEM NOTICE</div>',
                '<h2 id="iba-domain-migration-title">IBA Portal Domain Is Changing</h2>',
                '<p id="iba-domain-migration-description" class="iba-domain-migration-intro">',
                    'Effective <strong>1 August 2026</strong>, the IBA Portal will move to a new domain.',
                '</p>',
                '<div class="iba-domain-migration-route" aria-label="Old and new IBA Portal domains">',
                    '<div class="iba-domain-migration-domain iba-domain-migration-domain-old">',
                        '<span>Current domain</span>',
                        '<strong>' + OLD_DOMAIN + '</strong>',
                    '</div>',
                    '<i class="fa-solid fa-arrow-right-long iba-domain-migration-arrow" aria-hidden="true"></i>',
                    '<div class="iba-domain-migration-domain iba-domain-migration-domain-new">',
                        '<span>New domain</span>',
                        '<strong>' + NEW_DOMAIN + '</strong>',
                    '</div>',
                '</div>',
                '<p class="iba-domain-migration-guidance">',
                    'Please update your saved bookmarks for <strong>Invoice, Inventory, and Vehicle</strong> by replacing ',
                    '<code>' + OLD_DOMAIN + '</code> with <code>' + NEW_DOMAIN + '</code>. ',
                    'The old domain will no longer be available after <strong>31 July 2026</strong>.',
                '</p>',
                '<div class="iba-domain-migration-example">',
                    '<span>Invoice bookmark example</span>',
                    '<div><s>https://' + OLD_DOMAIN + '/invoice</s></div>',
                    '<div><strong>https://' + NEW_DOMAIN + '/invoice</strong></div>',
                '</div>',
                '<button type="button" class="iba-domain-migration-understand">',
                    '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
                    '<span>I Understand</span>',
                '</button>',
            '</div>'
        ].join('');

        const understandButton = overlay.querySelector('.iba-domain-migration-understand');
        if (understandButton) {
            understandButton.addEventListener('click', hideMigrationDialog);
        }

        document.body.appendChild(overlay);
        return overlay;
    }

    function showMigrationDialog(forceOpen) {
        if (acknowledgedThisSession && !forceOpen) return;

        const overlay = ensureDialog();
        lastFocusedElement = document.activeElement;
        overlay.classList.add('is-visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('iba-domain-migration-dialog-open');

        const button = overlay.querySelector('.iba-domain-migration-understand');
        if (button) {
            window.setTimeout(function () {
                try { button.focus(); } catch (_) {}
            }, 30);
        }
    }

    function hideMigrationDialog() {
        const overlay = document.getElementById(NOTICE_ID);
        acknowledgedThisSession = true;

        if (overlay) {
            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('iba-domain-migration-dialog-open');

        const countdown = document.getElementById(COUNTDOWN_ID);
        const focusTarget = countdown || lastFocusedElement;
        if (focusTarget && typeof focusTarget.focus === 'function') {
            try { focusTarget.focus(); } catch (_) {}
        }
    }

    function showDomainMigrationNoticeIfNeeded() {
        startCountdown();
        showMigrationDialog(false);
    }

    function destroyDomainMigrationNotice() {
        if (countdownTimer) {
            window.clearInterval(countdownTimer);
            countdownTimer = null;
        }

        const overlay = document.getElementById(NOTICE_ID);
        const countdown = document.getElementById(COUNTDOWN_ID);
        if (overlay) overlay.remove();
        if (countdown) countdown.remove();
        document.body.classList.remove('iba-domain-migration-dialog-open');
    }

    window.showDomainMigrationNoticeIfNeeded = showDomainMigrationNoticeIfNeeded;
    window.hideDomainMigrationNotice = destroyDomainMigrationNotice;
})();
