/* 12.8.4 — General Important Announcement
   Reusable, system-wide announcement stored at system_settings/general_announcement.
   Only Super Admin can edit it. Active notices automatically disappear after expiry.
*/
(function () {
  'use strict';

  const PATH = 'system_settings/general_announcement';
  const DEFAULT_ANNOUNCEMENT = {
    enabled: true,
    title: 'Inventory Maintenance Notice',
    message: 'Inventory will undergo scheduled database maintenance starting Thursday. Please complete any required Inventory work before maintenance begins. Expected availability: Saturday.',
    startAt: '2026-08-29T00:00:00+03:00',
    endAt: '2026-09-05T23:59:00+03:00',
    countdown: true
  };

  let announcement = null;
  let announcementSourceLoaded = false;
  let countdownTimer = null;
  let adminPollTimer = null;
  let authPollTimer = null;
  let lastRenderKey = '';
  let sidebarExpanded = true;
  let sidebarCollapseTimer = null;
  let lastSidebarKey = '';
  let isMainPortalPopup = false;
  let poppedOutFromSidebar = false;
  let sidebarObserver = null;
  // The maximized announcement is shown automatically only once per full
  // browser page load. SPA/module navigation does not reset this flag; a
  // real browser refresh does. Manual clicks can still open the notice.
  // Each module gets one automatic maximized popup per full browser page load.
  // The Welcome/Main Portal is intentionally excluded: its announcement stays
  // visible whenever the Welcome screen is active. A real browser refresh
  // resets these in-memory flags.
  const modulePopupShownThisPageLoad = Object.create(null);
  let currentAnnouncementArea = '';
  let maxPopupShownThisPageLoad = false;

  function el(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? '' : value); }
  function esc(value) {
    return text(value).replace(/[&<>'"]/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]);
    });
  }
  function normalize(value) { return text(value).trim().toLowerCase(); }

  function getCurrentUserName() {
    try {
      let ca = {};
      try { ca = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || {}); } catch (_) { ca = window.currentApprover || {}; }
      return text(ca.Name || ca.name || '').trim();
    } catch (_) { return ''; }
  }

  function isSuperAdmin() {
    const user = normalize(getCurrentUserName());
    let superName = '';
    try { superName = normalize(typeof SUPER_ADMIN_NAME !== 'undefined' ? SUPER_ADMIN_NAME : 'Irwin'); } catch (_) { superName = 'irwin'; }
    let roleText = '';
    try {
      let ca = {};
      try { ca = (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || {}); } catch (_) { ca = window.currentApprover || {}; }
      roleText = normalize([ca.Role, ca.role, ca.AccountRole, ca.accountRole, ca.Access, ca.access, ca.Position, ca.position].filter(Boolean).join(' '));
    } catch (_) {}
    return !!user && ((superName && user === superName) || roleText.includes('super admin') || roleText === 'superadmin');
  }

  function parseDate(value) {
    if (!value) return NaN;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
  }

  function activeConfig() {
    const cfg = announcement;
    if (!cfg || cfg.enabled !== true) return null;
    const now = Date.now();
    const start = parseDate(cfg.startAt);
    const end = parseDate(cfg.endAt);
    if (Number.isFinite(start) && now < start) return cfg;
    if (Number.isFinite(end) && now >= end) return null;
    return cfg;
  }

  function countdownTarget(cfg) {
    const now = Date.now();
    const start = parseDate(cfg.startAt);
    const end = parseDate(cfg.endAt);
    if (Number.isFinite(start) && now < start) return { time: start, label: 'STARTS IN' };
    if (Number.isFinite(end) && now < end) return { time: end, label: 'ENDS IN' };
    return null;
  }

  function formatCountdown(ms) {
    ms = Math.max(0, Number(ms) || 0);
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  }

  function isVisibleNode(node) {
    if (!node) return false;
    const cs = window.getComputedStyle(node);
    const r = node.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }


  function getActiveAnnouncementArea() {
    // Use the actual SPA view containers so WorkDesk, Invoice Management, and
    // Inventory are treated independently even though they share one sidebar.
    const views = [
      ['workdesk', '#workdesk-view'],
      ['invoice', '#invoice-management-view'],
      ['inventory', '#inventory-view']
    ];
    for (const pair of views) {
      const node = document.querySelector(pair[1]);
      if (node && isVisibleNode(node)) return pair[0];
    }
    const dashboard = document.querySelector('#dashboard-view');
    if (dashboard && isVisibleNode(dashboard)) return 'welcome';
    return '';
  }

  function findActiveSidebar() {
    const sidebars = Array.from(document.querySelectorAll('aside.workdesk-sidebar'));
    return sidebars.find(isVisibleNode) || null;
  }

  function moveAnnouncementToSidebar() {
    const box = el('general-important-announcement');
    if (!box) return null;
    const sidebar = findActiveSidebar();
    if (!sidebar) return null;
    let host = sidebar.querySelector('.general-announcement-sidebar-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'general-announcement-sidebar-host';
      const footer = sidebar.querySelector('.workdesk-footer-nav');
      if (footer) sidebar.insertBefore(host, footer);
      else sidebar.appendChild(host);
    }
    if (box.parentElement !== host) host.appendChild(box);
    return sidebar;
  }

  function sidebarKey(sidebar) {
    if (!sidebar) return '';
    return sidebar.id || sidebar.closest('[id]')?.id || sidebar.innerText.slice(0,80);
  }

  function scheduleSidebarCollapse(sidebar, forceExpand) {
    const key = sidebarKey(sidebar);
    lastSidebarKey = key;
    if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
    // Module pages should receive the notice already minimized so it never
    // blocks the working area. The user can click it to open the center popup.
    sidebarExpanded = !!forceExpand;
    applySidebarState();
  }

  function applySidebarState() {
    const box = el('general-important-announcement');
    if (!box) return;
    box.classList.toggle('gia-collapsed', !sidebarExpanded);
    box.setAttribute('aria-expanded', sidebarExpanded ? 'true' : 'false');
  }

  function openAnnouncementPopupFromSidebar() {
    const box = el('general-important-announcement');
    if (!box) return;
    poppedOutFromSidebar = true;
    isMainPortalPopup = true;
    sidebarExpanded = true;
    if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
    // Clear the inline geometry used by the Welcome-side card. Those inline
    // values otherwise override the popup CSS and keep the notice small/off-center.
    ['position','width','minWidth','maxWidth','minHeight','maxHeight','margin','transform','top','left','right','bottom'].forEach(function (prop) {
      box.style[prop] = '';
    });
    document.body.appendChild(box);
    box.classList.add('gia-main-popup');
    box.classList.remove('gia-welcome-card', 'gia-collapsed', 'hidden');
    box.setAttribute('aria-expanded', 'true');
  }

  function minimizeAnnouncementToSidebar() {
    const sidebar = findActiveSidebar();
    const box = el('general-important-announcement');
    if (!box || !sidebar) return;
    poppedOutFromSidebar = false;
    isMainPortalPopup = false;
    sidebarExpanded = false;
    if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
    moveAnnouncementToSidebar();
    // Remove popup inline geometry before the sidebar CSS takes control.
    ['position','width','minWidth','maxWidth','minHeight','maxHeight','margin','transform','top','left','right','bottom'].forEach(function (prop) {
      box.style[prop] = '';
    });
    box.classList.remove('gia-main-popup', 'gia-welcome-card');
    box.classList.remove('hidden');
    applySidebarState();
  }

  function toggleAnnouncementDetails() {
    if (isMainPortalPopup && findActiveSidebar()) {
      minimizeAnnouncementToSidebar();
      return;
    }
    if (findActiveSidebar()) {
      openAnnouncementPopupFromSidebar();
      maxPopupShownThisPageLoad = true;
      return;
    }
    sidebarExpanded = !sidebarExpanded;
    if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
    applySidebarState();
  }

  function positionWelcomeAnnouncement() {
    const box = el('general-important-announcement');
    const dashboard = document.querySelector('#dashboard-view');
    const card = dashboard ? dashboard.querySelector('.cyber-dashboard-card') : null;
    if (!box || !dashboard || !card || !isVisibleNode(card)) return;

    // Position the announcement independently of the portal card. Never put
    // the notice into the dashboard's flex/grid flow: the original portal
    // card must keep its exact width and the six module buttons must not shrink.
    const rect = card.getBoundingClientRect();
    const gap = 18;
    const noticeWidth = Math.min(360, Math.max(300, Math.floor(window.innerWidth * 0.24)));
    box.style.position = 'fixed';
    box.style.width = `${noticeWidth}px`;
    box.style.minWidth = '0';
    box.style.maxWidth = `${noticeWidth}px`;
    box.style.transform = 'none';
    box.style.top = `${Math.max(18, rect.top + 120)}px`;

    let left = rect.right + gap;
    if (left + noticeWidth > window.innerWidth - 12) {
      left = rect.left - gap - noticeWidth;
    }
    // On very narrow screens there may be no side space; use a centered,
    // non-overlapping fallback rather than squeezing the portal card.
    if (left < 12) {
      left = Math.max(12, (window.innerWidth - noticeWidth) / 2);
      box.style.top = `${Math.max(12, rect.bottom + gap)}px`;
    }
    box.style.left = `${left}px`;
    box.style.right = 'auto';
  }

  function render() {
    const box = el('general-important-announcement');
    if (!box) return;

    // The announcement has two intentional display modes:
    // 1) Main Portal / Welcome screen: prominent pop-up so the user sees it first.
    // 2) WorkDesk / Invoice Management / Inventory: moved into the active left
    //    sidebar and automatically minimized after 10 seconds.
    const sidebar = findActiveSidebar();

    // Keep the global notice off the login screen; it becomes visible after a user is authenticated.
    if (!getCurrentUserName()) {
      document.querySelector('#dashboard-view')?.classList.remove('gia-welcome-layout');
      box.classList.add('hidden');
      return;
    }

    const cfg = activeConfig();
    if (!cfg) {
      document.querySelector('#dashboard-view')?.classList.remove('gia-welcome-layout');
      box.classList.add('hidden');
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      return;
    }
    const key = JSON.stringify([cfg.title, cfg.message, cfg.startAt, cfg.endAt, cfg.countdown]);
    if (key !== lastRenderKey) {
      lastRenderKey = key;
      el('gia-title').textContent = text(cfg.title || 'IBA TEAM ANNOUNCEMENT');
      el('gia-message').textContent = text(cfg.message || '');
    }

    const area = getActiveAnnouncementArea();
    if (area !== currentAnnouncementArea) {
      currentAnnouncementArea = area;
      // A module gets its maximized announcement the first time it becomes
      // active during this browser page load. Returning to the same module
      // keeps the notice minimized in the sidebar.
    }

    if (area === 'welcome') {
      // Main Portal / Welcome screen: keep the maximized announcement alive
      // whenever this screen is active. It is not counted against the
      // per-module popup limit.
      const dashboardView = document.querySelector('#dashboard-view');
      maxPopupShownThisPageLoad = true;
      isMainPortalPopup = true;
      poppedOutFromSidebar = false;
      dashboardView?.classList.add('gia-welcome-layout');
      box.classList.remove('gia-main-popup');
      box.classList.add('gia-welcome-card');
      box.classList.remove('gia-collapsed', 'hidden');
      if (dashboardView && box.parentElement !== dashboardView) dashboardView.appendChild(box);
      positionWelcomeAnnouncement();
      sidebarExpanded = true;
      if (sidebarCollapseTimer) { clearTimeout(sidebarCollapseTimer); sidebarCollapseTimer = null; }
    } else if (sidebar) {
      document.querySelector('#dashboard-view')?.classList.remove('gia-welcome-layout');
      if (poppedOutFromSidebar) {
        // User explicitly opened the notice from the sidebar. Keep it centered
        // until they click it again to minimize it back into the sidebar.
        isMainPortalPopup = true;
        box.classList.add('gia-main-popup');
        box.classList.remove('gia-collapsed', 'hidden');
        box.setAttribute('aria-expanded', 'true');
      } else if (area && !modulePopupShownThisPageLoad[area]) {
        // First visit to this module during this page load: automatically show
        // the same maximized reading card once. The sidebar version remains
        // available after the user minimizes it.
        modulePopupShownThisPageLoad[area] = true;
        openAnnouncementPopupFromSidebar();
      } else {
        isMainPortalPopup = false;
        moveAnnouncementToSidebar();
        box.classList.remove('gia-main-popup');
        box.classList.remove('hidden');
        scheduleSidebarCollapse(sidebar, false);
      }
    } else {
      // Authenticated non-module screens: keep the existing safe hidden state.
      isMainPortalPopup = false;
      box.classList.remove('gia-main-popup', 'gia-welcome-card', 'gia-collapsed');
      box.classList.add('hidden');
    }
    const cd = el('gia-countdown-wrap');
    const cdLabel = el('gia-countdown-label');
    const cdValue = el('gia-countdown');
    const target = cfg.countdown !== false ? countdownTarget(cfg) : null;
    if (target) {
      cd.classList.remove('hidden');
      cdLabel.textContent = target.label;
      cdValue.textContent = formatCountdown(target.time - Date.now());
      if (!countdownTimer) countdownTimer = setInterval(updateCountdown, 1000);
    } else {
      cd.classList.add('hidden');
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }
  }

  function updateCountdown() {
    const cfg = activeConfig();
    if (!cfg) { render(); return; }
    const target = cfg.countdown !== false ? countdownTarget(cfg) : null;
    const wrap = el('gia-countdown-wrap');
    if (!target || !wrap) { render(); return; }
    wrap.classList.remove('hidden');
    el('gia-countdown-label').textContent = target.label;
    el('gia-countdown').textContent = formatCountdown(target.time - Date.now());
  }

  function setMessage(msg, ok) {
    const node = el('general-announcement-message-line');
    if (!node) return;
    node.textContent = msg || '';
    node.style.color = ok ? '#166534' : '#b91c1c';
  }

  function toQatarInput(iso) {
    const ms = parseDate(iso);
    if (!Number.isFinite(ms)) return '';
    const d = new Date(ms + 3 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  function fromQatarInput(value) {
    if (!value) return '';
    return value.length === 16 ? `${value}:00+03:00` : `${value}+03:00`;
  }

  function fillManager(cfg) {
    cfg = cfg || { enabled:false, title:'', message:'', startAt:'', endAt:'', countdown:true };
    const enabled = el('general-announcement-enabled');
    if (enabled) enabled.checked = cfg.enabled === true;
    if (el('general-announcement-title')) el('general-announcement-title').value = text(cfg.title || '');
    if (el('general-announcement-message')) el('general-announcement-message').value = text(cfg.message || '');
    if (el('general-announcement-start')) el('general-announcement-start').value = toQatarInput(cfg.startAt);
    if (el('general-announcement-end')) el('general-announcement-end').value = toQatarInput(cfg.endAt);
    if (el('general-announcement-countdown')) el('general-announcement-countdown').checked = cfg.countdown !== false;
  }

  function managerConfigFromInputs() {
    return {
      enabled: !!el('general-announcement-enabled')?.checked,
      title: text(el('general-announcement-title')?.value).trim() || 'IBA TEAM ANNOUNCEMENT',
      message: text(el('general-announcement-message')?.value).trim(),
      startAt: fromQatarInput(el('general-announcement-start')?.value),
      endAt: fromQatarInput(el('general-announcement-end')?.value),
      countdown: !!el('general-announcement-countdown')?.checked,
      updatedAt: new Date().toISOString(),
      updatedBy: getCurrentUserName() || 'Super Admin'
    };
  }

  function validate(cfg) {
    if (!cfg.message) return 'Please enter an announcement message.';
    const start = parseDate(cfg.startAt), end = parseDate(cfg.endAt);
    if (cfg.startAt && !Number.isFinite(start)) return 'Please enter a valid start date/time.';
    if (cfg.endAt && !Number.isFinite(end)) return 'Please enter a valid end date/time.';
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) return 'The end date/time must be after the start date/time.';
    return '';
  }

  async function saveConfig(cfg) {
    if (!isSuperAdmin()) { setMessage('Only the Super Admin can manage this announcement.', false); return; }
    const error = validate(cfg);
    if (error) { setMessage(error, false); return; }
    if (typeof db === 'undefined' || !db || typeof db.ref !== 'function') { setMessage('Firebase database is not ready. Please try again.', false); return; }
    try {
      await db.ref(PATH).set(cfg);
      announcement = cfg;
      announcementSourceLoaded = true;
      lastRenderKey = '';
      render();
      setMessage('Announcement saved. It is now available to all users during the configured date/time.', true);
    } catch (err) {
      console.error('[General Announcement] save failed', err);
      setMessage('Could not save the announcement. Please try again.', false);
    }
  }

  async function disableAnnouncement() {
    if (!isSuperAdmin()) { setMessage('Only the Super Admin can manage this announcement.', false); return; }
    if (typeof db === 'undefined' || !db || typeof db.ref !== 'function') { setMessage('Firebase database is not ready. Please try again.', false); return; }
    const disabled = Object.assign({}, announcement || DEFAULT_ANNOUNCEMENT, { enabled:false, updatedAt:new Date().toISOString(), updatedBy:getCurrentUserName() || 'Super Admin' });
    try {
      await db.ref(PATH).set(disabled);
      announcement = disabled;
      announcementSourceLoaded = true;
      lastRenderKey = '';
      render();
      fillManager(disabled);
      setMessage('Announcement turned off. It will remain saved for future reuse.', true);
    } catch (err) {
      console.error('[General Announcement] disable failed', err);
      setMessage('Could not turn off the announcement. Please try again.', false);
    }
  }

  function preview() {
    const cfg = managerConfigFromInputs();
    const error = validate(cfg);
    if (error) { setMessage(error, false); return; }

    // Settings Preview is a visual preview only. Temporarily force the same
    // centered/maximized reading view used when a user clicks the minimized
    // notice. Do not save anything and do not permanently change its location.
    const oldAnnouncement = announcement;
    const oldPoppedOut = poppedOutFromSidebar;
    const oldMainPopup = isMainPortalPopup;
    const oldSidebarExpanded = sidebarExpanded;

    announcement = cfg;
    poppedOutFromSidebar = true;
    isMainPortalPopup = true;
    sidebarExpanded = true;
    lastRenderKey = '';
    render();
    setMessage('Preview shown. This is only a preview and was not saved.', true);

    setTimeout(function () {
      // Restore exactly the state that existed before Preview was clicked.
      announcement = oldAnnouncement;
      poppedOutFromSidebar = oldPoppedOut;
      isMainPortalPopup = oldMainPopup;
      sidebarExpanded = oldSidebarExpanded;
      lastRenderKey = '';
      render();
    }, 15000);
  }

  function syncAdminPanel() {
    const panel = el('general-announcement-settings-container');
    if (!panel) return;
    if (isSuperAdmin()) {
      panel.classList.remove('hidden');
      if (announcementSourceLoaded && !panel.dataset.filled) { fillManager(announcement); panel.dataset.filled = '1'; }
    } else {
      panel.classList.add('hidden');
    }
  }

  function init() {
    const panel = el('general-announcement-settings-container');
    const box = el('general-important-announcement');
    if (box) {
      box.addEventListener('click', function (event) {
        if (event.target.closest('button, a, input, textarea, select')) return;
        box.classList.add('gia-active-click');
        setTimeout(function(){ box.classList.remove('gia-active-click'); }, 1400);
        toggleAnnouncementDetails();
      });
      box.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleAnnouncementDetails();
        }
      });
      box.setAttribute('tabindex', '0');
      box.setAttribute('role', 'button');
    }
    if (el('general-announcement-save-btn')) el('general-announcement-save-btn').addEventListener('click', function () { saveConfig(managerConfigFromInputs()); });
    if (el('general-announcement-disable-btn')) el('general-announcement-disable-btn').addEventListener('click', disableAnnouncement);
    if (el('general-announcement-preview-btn')) el('general-announcement-preview-btn').addEventListener('click', preview);

    // The public notice is read once and then maintained by Firebase listener updates.
    try {
      if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
        db.ref(PATH).on('value', function (snap) {
          announcement = snap.exists() ? (snap.val() || null) : DEFAULT_ANNOUNCEMENT;
          announcementSourceLoaded = true;
          lastRenderKey = '';
          render();
          if (isSuperAdmin() && panel) { fillManager(announcement); panel.dataset.filled = '1'; }
        }, function (err) {
          console.warn('[General Announcement] read failed', err);
          if (!announcementSourceLoaded) { announcement = DEFAULT_ANNOUNCEMENT; announcementSourceLoaded = true; render(); }
        });
      } else {
        announcement = DEFAULT_ANNOUNCEMENT;
        announcementSourceLoaded = true;
        render();
      }
    } catch (err) {
      announcement = DEFAULT_ANNOUNCEMENT;
      announcementSourceLoaded = true;
      render();
    }

    syncAdminPanel();
    try {
      sidebarObserver = new MutationObserver(function () {
        const sidebar = findActiveSidebar();
        if (sidebar && activeConfig() && !poppedOutFromSidebar) {
          // While the notice is opened from the sidebar, it lives on document.body
          // as a centered modal. Do not let the sidebar observer immediately
          // pull it back into the sidebar.
          moveAnnouncementToSidebar();
          scheduleSidebarCollapse(sidebar, false);
        }
      });
      sidebarObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    } catch (_) {}
    adminPollTimer = setInterval(syncAdminPanel, 1500);
    authPollTimer = setInterval(function () { render(); syncAdminPanel(); }, 1500);
  window.addEventListener('resize', function () { if (!findActiveSidebar() && activeConfig()) positionWelcomeAnnouncement(); });
    window.addEventListener('beforeunload', function () {
      if (countdownTimer) clearInterval(countdownTimer);
      if (adminPollTimer) clearInterval(adminPollTimer);
      if (authPollTimer) clearInterval(authPollTimer);
      if (sidebarCollapseTimer) clearTimeout(sidebarCollapseTimer);
      if (sidebarObserver) sidebarObserver.disconnect();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
