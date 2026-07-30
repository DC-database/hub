/*
   IBA Portal Domain Migration Cleanup
   Version: 11.6.0
   Scope: Retire the completed migration countdown and blocking dialog.
*/

(function () {
    'use strict';

    const NOTICE_ID = 'iba-domain-migration-overlay';
    const COUNTDOWN_ID = 'iba-domain-migration-countdown';

    function retireDomainMigrationNotice() {
        const overlay = document.getElementById(NOTICE_ID);
        const countdown = document.getElementById(COUNTDOWN_ID);

        if (overlay) overlay.remove();
        if (countdown) countdown.remove();
        document.body.classList.remove('iba-domain-migration-dialog-open');
    }

    window.showDomainMigrationNoticeIfNeeded = retireDomainMigrationNotice;
    window.hideDomainMigrationNotice = retireDomainMigrationNotice;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', retireDomainMigrationNotice, { once: true });
    } else {
        retireDomainMigrationNotice();
    }
})();
