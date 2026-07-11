/*
 * IBA 11.0.8 — Chrome Only + Single Active Tab Guard
 * Purpose: reduce duplicate Firebase reads by allowing only one active IBA tab
 * per browser/profile and blocking unsupported browsers.
 */
(function () {
  'use strict';

  const VERSION = '11.0.6';
  const TAB_ID_KEY = 'IBA_SINGLE_TAB_ID_V1';
  const ACTIVE_KEY = 'IBA_SINGLE_ACTIVE_TAB_V1';
  const CHANNEL_NAME = 'IBA_SINGLE_TAB_GUARD_V1';
  const HEARTBEAT_MS = 2000;
  const STALE_MS = 9000;
  const APP_NAME = 'IBA System';

  function now() { return Date.now(); }

  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(storage, key, val) {
    try { storage.setItem(key, val); return true; } catch (_) { return false; }
  }
  function safeRemove(storage, key) {
    try { storage.removeItem(key); } catch (_) {}
  }
  function parseJSON(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function createTabId() {
    const existing = safeGet(window.sessionStorage, TAB_ID_KEY);
    if (existing) return existing;
    const id = 'tab_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
    safeSet(window.sessionStorage, TAB_ID_KEY, id);
    return id;
  }

  const tabId = createTabId();
  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL_NAME); } catch (_) { channel = null; }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  let brands = '';
  try {
    brands = (navigator.userAgentData && navigator.userAgentData.brands)
      ? navigator.userAgentData.brands.map(function (b) { return b.brand || ''; }).join(' ')
      : '';
  } catch (_) { brands = ''; }
  const uaAll = (ua + ' ' + vendor + ' ' + brands);
  const isBlockedChromiumFork = /Edg|Microsoft Edge|OPR|Opera|SamsungBrowser|Firefox|FxiOS|Brave|Vivaldi/i.test(uaAll);
  const isChromiumLike = /Chrome|CriOS|Chromium|Google Chrome/i.test(uaAll) || /Google Inc\./i.test(vendor);
  const isChrome = isChromiumLike && !isBlockedChromiumFork;

  // Start from booting so unsupported browsers still render the blocking overlay on first load.
  let state = 'booting'; // booting | active | duplicate | unsupported
  let overlayEl = null;
  let heartbeatTimer = null;
  let checking = false;

  function activeRecord() {
    return parseJSON(safeGet(window.localStorage, ACTIVE_KEY));
  }

  function writeActiveRecord() {
    const rec = {
      tabId,
      updatedAt: now(),
      path: location.pathname,
      title: document.title || APP_NAME,
      version: window.IBA_SYSTEM_VERSION || VERSION
    };
    safeSet(window.localStorage, ACTIVE_KEY, JSON.stringify(rec));
    if (channel) {
      try { channel.postMessage({ type: 'active', tabId, updatedAt: rec.updatedAt }); } catch (_) {}
    }
  }

  function isActiveRecordMine(rec) {
    return rec && rec.tabId === tabId;
  }

  function recordIsFresh(rec) {
    return rec && rec.updatedAt && (now() - Number(rec.updatedAt)) < STALE_MS;
  }

  function canBecomeActive() {
    const rec = activeRecord();
    return !recordIsFresh(rec) || isActiveRecordMine(rec);
  }

  function dispatchChange() {
    try {
      document.dispatchEvent(new CustomEvent('iba:tabguardchange', {
        detail: {
          active: isActive(),
          state,
          tabId,
          unsupportedBrowser: !isChrome
        }
      }));
    } catch (_) {}
  }

  function setState(nextState, reason) {
    // Even when the state is unchanged, unsupported/duplicate tabs must still show the overlay.
    if (state === nextState) {
      window.IBA_TAB_GUARD_STATE = state;
      window.IBA_TAB_GUARD_BLOCKED = !isActive();
      if (nextState !== 'active') showOverlay(reason || nextState);
      dispatchChange();
      return;
    }
    state = nextState;
    window.IBA_TAB_GUARD_STATE = state;
    window.IBA_TAB_GUARD_BLOCKED = !isActive();
    if (nextState === 'active') {
      hideOverlay();
      startHeartbeat();
    } else {
      stopHeartbeat();
      showOverlay(reason || nextState);
    }
    dispatchChange();
  }

  function isActive() {
    return state === 'active';
  }

  function claimActive(reason) {
    if (!isChrome) {
      setState('unsupported', 'unsupported');
      return false;
    }
    writeActiveRecord();
    setState('active', reason || 'claimed');
    return true;
  }

  function checkActive(reason) {
    if (checking) return isActive();
    checking = true;
    try {
      if (!isChrome) {
        setState('unsupported', 'unsupported');
        return false;
      }
      const rec = activeRecord();
      if (!recordIsFresh(rec) || isActiveRecordMine(rec)) {
        return claimActive(reason || 'available');
      }
      setState('duplicate', reason || 'duplicate');
      return false;
    } finally {
      checking = false;
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    writeActiveRecord();
    heartbeatTimer = setInterval(function () {
      if (state !== 'active') return;
      writeActiveRecord();
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>'"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch] || ch;
    });
  }


  function setOverlaySubMessage(message) {
    try {
      if (overlayEl) {
        const sub = overlayEl.querySelector('.iba-tab-guard-sub');
        if (sub) sub.textContent = message || '';
      }
    } catch (_) {}
  }

  function copyTextFallback(text) {
    try {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    } catch (_) { return false; }
  }

  function copyLinkForChrome() {
    const link = window.location.href;
    const done = function (ok) {
      setOverlaySubMessage(ok
        ? 'Link copied. Open Google Chrome and paste it in the address bar.'
        : 'Please manually copy this page link and open it in Google Chrome.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function () { done(true); }).catch(function () { done(copyTextFallback(link)); });
      } else {
        done(copyTextFallback(link));
      }
    } catch (_) {
      done(copyTextFallback(link));
    }
  }

  function overlayCopy() {
    if (state === 'unsupported') {
      return {
        icon: '🌐',
        title: 'Google Chrome Required',
        body: 'IBA System is allowed only in Google Chrome. Browser security does not allow this page to open Chrome automatically. Copy this link, then open it in Google Chrome to continue.',
        sub: 'Edge, Safari, Firefox, Opera, and other browsers are blocked even in Test Mode.',
        duplicate: false,
      };
    }
    if (state === 'active') return null;
    const rec = activeRecord();
    const last = rec && rec.updatedAt ? new Date(Number(rec.updatedAt)).toLocaleTimeString() : '';
    return {
      icon: '🛡️',
      title: 'IBA System is Already Open',
      body: 'Another active IBA tab is already running in this browser. To reduce Firebase downloads and avoid duplicate sync, please use the existing tab or switch this tab to active.',
      sub: last ? ('Last active check: ' + escapeHtml(last)) : '',
      duplicate: true
    };
  }

  function showOverlay(reason) {
    if (state === 'active') return;
    const copy = overlayCopy();
    if (!copy) return;

    const render = function () {
      if (!document.body) return;
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.id = 'iba-single-tab-guard-overlay';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.innerHTML = `
          <div class="iba-tab-guard-card">
            <div class="iba-tab-guard-icon"></div>
            <h2></h2>
            <p class="iba-tab-guard-body"></p>
            <p class="iba-tab-guard-sub"></p>
            <div class="iba-tab-guard-actions">
              <button type="button" class="iba-tab-guard-primary">Use This Tab Instead</button>
              <button type="button" class="iba-tab-guard-secondary">Recheck</button>
            </div>
            <div class="iba-tab-guard-note">Only the active tab runs Firebase sync.</div>
          </div>`;
        const style = document.createElement('style');
        style.id = 'iba-single-tab-guard-style';
        style.textContent = `
          #iba-single-tab-guard-overlay {
            position: fixed; inset: 0; z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            background: radial-gradient(circle at top, rgba(17,96,69,.24), rgba(2,6,23,.74));
            backdrop-filter: blur(7px); padding: 22px; box-sizing: border-box;
            font-family: Inter, Arial, sans-serif;
          }
          #iba-single-tab-guard-overlay .iba-tab-guard-card {
            width: min(520px, 94vw); border-radius: 24px; padding: 28px;
            background: linear-gradient(135deg, #ffffff, #f8fafc);
            box-shadow: 0 28px 70px rgba(15,23,42,.30);
            border: 1px solid rgba(15,23,42,.08); text-align: center; color: #0f172a;
          }
          #iba-single-tab-guard-overlay .iba-tab-guard-icon { font-size: 2.4rem; margin-bottom: 8px; }
          #iba-single-tab-guard-overlay h2 { margin: 0 0 10px; font-size: 1.45rem; color: #0f5132; }
          #iba-single-tab-guard-overlay p { margin: 0; line-height: 1.5; color: #334155; }
          #iba-single-tab-guard-overlay .iba-tab-guard-sub { margin-top: 10px; font-size: .86rem; color: #64748b; }
          #iba-single-tab-guard-overlay .iba-tab-guard-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 22px; }
          #iba-single-tab-guard-overlay button { border: 0; border-radius: 999px; padding: 11px 18px; font-weight: 900; cursor: pointer; }
          #iba-single-tab-guard-overlay .iba-tab-guard-primary { background: #116045; color: #fff; box-shadow: 0 10px 22px rgba(17,96,69,.25); }
          #iba-single-tab-guard-overlay .iba-tab-guard-secondary { background: #e2e8f0; color: #0f172a; }
          #iba-single-tab-guard-overlay .iba-tab-guard-note { margin-top: 16px; font-size: .78rem; color: #64748b; font-weight: 800; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(overlayEl);
        overlayEl.querySelector('.iba-tab-guard-primary').addEventListener('click', function () {
          if (state === 'unsupported') {
            copyLinkForChrome();
            return;
          }
          claimActive('manual-takeover');
        });
        overlayEl.querySelector('.iba-tab-guard-secondary').addEventListener('click', function () {
          checkActive('manual-recheck');
        });
      }
      overlayEl.querySelector('.iba-tab-guard-icon').textContent = copy.icon;
      overlayEl.querySelector('h2').textContent = copy.title;
      overlayEl.querySelector('.iba-tab-guard-body').textContent = copy.body;
      overlayEl.querySelector('.iba-tab-guard-sub').textContent = copy.sub || '';
      const primary = overlayEl.querySelector('.iba-tab-guard-primary');
      const secondary = overlayEl.querySelector('.iba-tab-guard-secondary');
      const note = overlayEl.querySelector('.iba-tab-guard-note');
      primary.style.display = '';
      primary.textContent = copy.duplicate ? 'Use This Tab Instead' : 'Copy Link for Chrome';
      secondary.textContent = copy.duplicate ? 'Recheck' : 'Check Again';
      if (note) {
        note.textContent = copy.duplicate
          ? 'Only the active tab runs Firebase sync.'
          : 'Open Google Chrome and paste the copied link. Unsupported browsers cannot continue.';
      }
      overlayEl.classList.remove('hidden');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render, { once: true });
    } else {
      render();
    }
  }

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.add('hidden');
  }

  function shouldPause(label, silent) {
    if (isActive()) return false;
    if (!silent) {
      console.warn('[IBA Tab Guard] Paused Firebase work in inactive tab:', label || 'unknown');
    }
    showOverlay('paused');
    return true;
  }

  window.IBA_TAB_GUARD = {
    version: VERSION,
    tabId,
    isChrome,
    isUnsupportedBrowser: function () { return !isChrome; },
    isActive,
    checkActive,
    claimActive,
    shouldPause,
    getState: function () { return state; }
  };
  window.ibaShouldPauseFirebase = shouldPause;
  window.IBA_TAB_GUARD_STATE = state;
  window.IBA_TAB_GUARD_BLOCKED = true;
  window.IBA_UNSUPPORTED_BROWSER = !isChrome;

  window.addEventListener('storage', function (ev) {
    if (ev.key !== ACTIVE_KEY) return;
    const rec = parseJSON(ev.newValue);
    if (isActiveRecordMine(rec)) return;
    if (recordIsFresh(rec)) {
      if (state === 'active') setState('duplicate', 'taken-over');
      else checkActive('storage-change');
    }
  });

  if (channel) {
    channel.onmessage = function (ev) {
      const msg = ev && ev.data ? ev.data : {};
      if (!msg || msg.tabId === tabId) return;
      if (msg.type === 'active') {
        if (state === 'active') setState('duplicate', 'broadcast-active');
        else checkActive('broadcast-active');
      }
    };
  }

  window.addEventListener('beforeunload', function () {
    const rec = activeRecord();
    if (isActiveRecordMine(rec)) safeRemove(window.localStorage, ACTIVE_KEY);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkActive('visible');
  });

  checkActive('initial-load');
})();
