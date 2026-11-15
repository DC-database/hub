/* 18.0.0 patch 32 (martin): personal "Moving / Still photo" background switch in Settings.
   - Who: Super Admin + Accounts / Accounting positions by default; martin can change it in Skill access ("Background: Moving / Still switch").
   - Still = no video and no weather / thunder for THIS person (on this PC); they see the page photo the Super Admin picked.
   - Moving = everything the Super Admin set (video, rain, thunder...) comes back. They can never change the actual choice. */
(function () {
    'use strict';
    if (window.ibaStill) return;
    const $ = (id) => document.getElementById(id);
    function me() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : null; } catch (_) { return null; } }
    function who() { const u = me(); let k = u && u.key; if (!k) { try { k = localStorage.getItem('approverKey'); } catch (_) {} } return String(k || 'me'); }
    const KEY = () => 'iba-bg-still-v1:' + who();
    const isSuper = () => !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    function allowed() {
        if (isSuper()) return true;
        let d = null; try { d = window.ibaSkillAccess ? window.ibaSkillAccess.decide('bg_still') : null; } catch (_) {}
        if (d === true || d === false) return d;
        const u = me(); const pos = String((u && (u.Position || u.position)) || '').toLowerCase();
        return /\baccount(?:s|ing|ant)?\b/.test(pos);
    }
    function on() { if (!allowed()) return false; try { return localStorage.getItem(KEY()) === '1'; } catch (_) { return false; } }
    function set(v) {
        try { localStorage.setItem(KEY(), v ? '1' : '0'); } catch (_) {}
        try { if (window.ibaRain && window.ibaRain.refresh) window.ibaRain.refresh(); } catch (_) {}
        paint();
    }
    window.ibaSkillAccessExtra = (window.ibaSkillAccessExtra || []).concat([{ id: 'bg_still', name: 'Background: Moving / Still switch', group: 'Settings', desc: 'A switch in their own Settings: Still photo (no video, no rain or thunder) or Moving (what you set). Only for their own screen; they cannot change the video, photo or weather you picked.', built: 'Super Admin + Accounts / Accounting positions' }]);

    function paint() {
        const sec = $('wd-settings');
        let card = $('iba-still-card');
        if (!sec) return;
        if (!allowed()) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div');
            card.id = 'iba-still-card';
            card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-image"></i></div><div>' +
                '<h2>My background</h2><p>Only for your own screen on this PC. On = the moving background and effects as set for everyone. Off = the still photo only, no video, rain or thunder.</p></div></div>' +
                '<label class="iba-still-sw"><input type="checkbox" data-still-sw><span></span><b class="iba-still-lbl"></b></label>';
            const before = $('iba-shell-bg-settings') || $('iba-login-opening-settings');
            if (before && before.parentElement) before.parentElement.insertBefore(card, before); else sec.appendChild(card);
            card.addEventListener('change', (e) => { if (e.target.matches('[data-still-sw]')) set(!e.target.checked); });
        }
        const s = on();
        const cb = card.querySelector('[data-still-sw]'); if (cb) cb.checked = !s;
        const lb = card.querySelector('.iba-still-lbl'); if (lb) lb.innerHTML = s ? '<i class="fa-solid fa-image"></i> Off: still photo, no effects' : '<i class="fa-solid fa-film"></i> On: moving background with effects';
    }
    (function watch() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watch, 1000); return; }
        let was = false;
        new MutationObserver(() => { const vis = !sec.classList.contains('hidden'); if (vis && !was) setTimeout(paint, 300); was = vis; }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (!sec.classList.contains('hidden')) paint();
    })();
    // the sign-in can come after the page loaded: re-check the background once the user is known
    let tries = 0;
    (function waitUser() { if (me() || ++tries > 60) { try { if (window.ibaRain && window.ibaRain.refresh) window.ibaRain.refresh(); } catch (_) {} return; } setTimeout(waitUser, 1000); })();
    window.ibaStill = { on, allowed, set, paint };
})();
