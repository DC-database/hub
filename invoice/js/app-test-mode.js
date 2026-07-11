/*
 * IBA 11.0.8 — Test Mode / Firebase Blocker
 * Purpose: allow safe local/UI testing without downloading or writing Firebase data.
 * Rules:
 *   - file:/// localhost 127.0.0.1 = TEST MODE by default (Firebase OFF)
 *   - ?testmode=1 = force TEST MODE anywhere
 *   - ?livefirebase=1 = allow Firebase for intentional local workflow testing
 */
(function () {
  'use strict';

  const VERSION = '11.0.8';
  const MODE_BADGE_ID = 'iba-test-mode-badge';
  const TOAST_ID = 'iba-test-mode-toast';
  const LOG_PREFIX = '[IBA Test Mode]';

  const params = new URLSearchParams(window.location.search || '');
  const protocol = (window.location.protocol || '').toLowerCase();
  const host = (window.location.hostname || '').toLowerCase();

  function truthy(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function falsey(value) {
    return /^(0|false|no|off)$/i.test(String(value || '').trim());
  }

  const isLocal = protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  const forceTestMode = truthy(params.get('testmode')) || truthy(params.get('firebaseoff')) || truthy(params.get('cacheonly'));
  const forceLiveFirebase = truthy(params.get('livefirebase')) || truthy(params.get('firebaseon')) || falsey(params.get('testmode'));
  const firebaseBlocked = forceTestMode || (isLocal && !forceLiveFirebase);
  const mode = firebaseBlocked ? 'test' : 'live';

  let lastNoticeAt = 0;
  let installed = false;
  let badgeReady = false;

  function setParamUrl(adds, removes) {
    const url = new URL(window.location.href);
    (removes || []).forEach(function (name) { url.searchParams.delete(name); });
    Object.keys(adds || {}).forEach(function (name) { url.searchParams.set(name, adds[name]); });
    return url.toString();
  }

  function emptySnapshot(path) {
    const key = String(path || '').split('/').filter(Boolean).pop() || null;
    return {
      key: key,
      ref: null,
      val: function () { return null; },
      exists: function () { return false; },
      numChildren: function () { return 0; },
      hasChild: function () { return false; },
      hasChildren: function () { return false; },
      child: function (childPath) { return emptySnapshot(String(path || '') + '/' + String(childPath || '')); },
      forEach: function () { return false; },
      exportVal: function () { return null; },
      toJSON: function () { return null; }
    };
  }

  function getRefPath(ref) {
    try {
      if (ref && typeof ref.toString === 'function') return ref.toString();
    } catch (_) {}
    return 'firebase/path';
  }

  function fakeRef(path) {
    const fakeKey = 'test_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const ref = {
      key: fakeKey,
      path: path || 'test-mode',
      toString: function () { return 'test-mode://' + (path || fakeKey); },
      child: function (childPath) { return fakeRef(String(path || fakeKey) + '/' + String(childPath || '')); },
      set: function () { notifyBlocked('Firebase write blocked in Test Mode.'); return Promise.resolve(null); },
      update: function () { notifyBlocked('Firebase update blocked in Test Mode.'); return Promise.resolve(null); },
      remove: function () { notifyBlocked('Firebase delete blocked in Test Mode.'); return Promise.resolve(null); },
      once: function () { notifyBlocked('Firebase read blocked in Test Mode.', true); return Promise.resolve(emptySnapshot(path)); },
      on: function (eventType, callback) {
        notifyBlocked('Firebase listener blocked in Test Mode.', true);
        if (typeof callback === 'function') setTimeout(function () { callback(emptySnapshot(path)); }, 0);
        return callback || function () {};
      },
      off: function () {}
    };
    return ref;
  }

  function notifyBlocked(message, silent) {
    const now = Date.now();
    if (!silent && now - lastNoticeAt > 1400) {
      lastNoticeAt = now;
      showToast(message || 'Firebase is disabled in Test Mode.');
    }
    try { console.warn(LOG_PREFIX, message || 'Firebase blocked', { mode: mode, isLocal: isLocal }); } catch (_) {}
  }

  function shouldBlock(label, silent) {
    if (!firebaseBlocked) return false;
    notifyBlocked(label ? ('Blocked: ' + label) : 'Firebase is disabled in Test Mode.', silent);
    return true;
  }

  function installFirebaseBlocker() {
    if (installed || !firebaseBlocked || !window.firebase) return;
    installed = true;

    try {
      const dbNs = window.firebase.database;
      const storageNs = window.firebase.storage;

      function wrapOnce(proto, name) {
        if (!proto || proto.__ibaTestModeOnceWrapped) return;
        proto.__ibaTestModeOnceWrapped = true;
        const originalOnce = proto.once;
        const originalOn = proto.on;
        proto.once = function (eventType, successCallback, failureCallback, context) {
          if (!firebaseBlocked) return originalOnce.apply(this, arguments);
          const snap = emptySnapshot(getRefPath(this));
          notifyBlocked('Firebase read blocked in Test Mode: ' + name + '.once()', true);
          if (typeof successCallback === 'function') {
            setTimeout(function () { successCallback.call(context || null, snap); }, 0);
          }
          return Promise.resolve(snap);
        };
        proto.on = function (eventType, callback, cancelCallback, context) {
          if (!firebaseBlocked) return originalOn.apply(this, arguments);
          const snap = emptySnapshot(getRefPath(this));
          notifyBlocked('Firebase listener blocked in Test Mode: ' + name + '.on()', true);
          if (typeof callback === 'function') {
            setTimeout(function () { callback.call(context || null, snap); }, 0);
          }
          return callback || function () {};
        };
      }

      function wrapWrite(proto, methodName) {
        if (!proto || !proto[methodName] || proto['__ibaTestMode_' + methodName]) return;
        proto['__ibaTestMode_' + methodName] = true;
        const original = proto[methodName];
        proto[methodName] = function () {
          if (!firebaseBlocked) return original.apply(this, arguments);
          notifyBlocked('Firebase ' + methodName + ' blocked in Test Mode. Use the live system for real save/update/delete.');
          return Promise.resolve(null);
        };
      }

      if (dbNs) {
        wrapOnce(dbNs.Reference && dbNs.Reference.prototype, 'Reference');
        wrapOnce(dbNs.Query && dbNs.Query.prototype, 'Query');
        ['set', 'update', 'remove', 'transaction'].forEach(function (method) {
          wrapWrite(dbNs.Reference && dbNs.Reference.prototype, method);
        });
        if (dbNs.Reference && dbNs.Reference.prototype && !dbNs.Reference.prototype.__ibaTestModePushWrapped) {
          dbNs.Reference.prototype.__ibaTestModePushWrapped = true;
          const originalPush = dbNs.Reference.prototype.push;
          dbNs.Reference.prototype.push = function (value, onComplete) {
            if (!firebaseBlocked) return originalPush.apply(this, arguments);
            notifyBlocked('Firebase push blocked in Test Mode. Use the live system for real new entries.');
            const ref = fakeRef(getRefPath(this));
            if (typeof onComplete === 'function') setTimeout(function () { onComplete(null); }, 0);
            return ref;
          };
        }
      }

      if (storageNs && storageNs.Reference && storageNs.Reference.prototype) {
        ['put', 'putString', 'delete'].forEach(function (methodName) {
          if (!storageNs.Reference.prototype[methodName] || storageNs.Reference.prototype['__ibaTestMode_' + methodName]) return;
          storageNs.Reference.prototype['__ibaTestMode_' + methodName] = true;
          const original = storageNs.Reference.prototype[methodName];
          storageNs.Reference.prototype[methodName] = function () {
            if (!firebaseBlocked) return original.apply(this, arguments);
            notifyBlocked('Firebase Storage ' + methodName + ' blocked in Test Mode.');
            return Promise.resolve({ state: 'test-mode-blocked', ref: this });
          };
        });
        if (storageNs.Reference.prototype.getDownloadURL && !storageNs.Reference.prototype.__ibaTestModeGetDownloadURL) {
          storageNs.Reference.prototype.__ibaTestModeGetDownloadURL = true;
          const originalGetUrl = storageNs.Reference.prototype.getDownloadURL;
          storageNs.Reference.prototype.getDownloadURL = function () {
            if (!firebaseBlocked) return originalGetUrl.apply(this, arguments);
            notifyBlocked('Firebase Storage URL blocked in Test Mode.', true);
            return Promise.reject(new Error('Firebase Storage is disabled in IBA Test Mode.'));
          };
        }
      }

      try { console.info(LOG_PREFIX, 'Firebase blocker installed. Local/UI testing will not read or write Firebase.'); } catch (_) {}
    } catch (error) {
      console.warn(LOG_PREFIX, 'Could not install Firebase blocker:', error);
    }
  }

  function showToast(message) {
    if (!document.body) return;
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      toast.style.cssText = 'position:fixed;left:18px;bottom:76px;z-index:2147483647;max-width:360px;padding:12px 14px;border-radius:14px;background:#7f1d1d;color:#fff;font:800 13px/1.35 Arial,sans-serif;box-shadow:0 14px 35px rgba(0,0,0,.28);opacity:0;transform:translateY(8px);transition:.18s ease;';
      document.body.appendChild(toast);
    }
    toast.textContent = message || 'Firebase is disabled in Test Mode.';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast.__ibaTimer);
    toast.__ibaTimer = setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
    }, 2800);
  }

  function renderBadge() {
    if (badgeReady || !document.body) return;
    badgeReady = true;
    const badge = document.createElement('div');
    badge.id = MODE_BADGE_ID;
    const isTest = firebaseBlocked;
    const title = isTest ? 'TEST MODE — Firebase Disabled' : 'LIVE MODE — Firebase Active';
    const sub = isTest
      ? (isLocal && !forceTestMode ? 'Local testing is using cache only. Real save/search/update/delete is blocked.' : 'Manual test mode is active. Real Firebase is blocked.')
      : (isLocal && forceLiveFirebase ? 'Local override is active. This can consume real Firebase data.' : 'Real system mode. Firebase reads/writes are allowed.');

    const actionUrl = isTest
      ? (isLocal && !forceTestMode
          ? setParamUrl({ livefirebase: '1' }, ['testmode', 'firebaseoff', 'cacheonly'])
          : setParamUrl({}, ['testmode', 'firebaseoff', 'cacheonly']))
      : setParamUrl({ testmode: '1' }, ['livefirebase', 'firebaseon']);
    const actionText = isTest ? 'Reload Firebase ON' : 'Safe Test';

    badge.innerHTML = '' +
      '<div class="iba-test-mode-title">' + title + '</div>' +
      '<div class="iba-test-mode-sub">' + sub + '</div>' +
      '<div class="iba-test-mode-actions">' +
      '<a class="iba-test-mode-action" href="' + actionUrl.replace(/"/g, '&quot;') + '">' + actionText + '</a>' +
      '<button type="button" class="iba-test-mode-close" aria-label="Hide mode badge">×</button>' +
      '</div>';

    const style = document.createElement('style');
    style.id = 'iba-test-mode-style';
    style.textContent = '' +
      '#iba-test-mode-badge{position:fixed;left:16px;bottom:16px;z-index:2147483646;width:min(360px,calc(100vw - 32px));border-radius:18px;padding:12px 14px;box-sizing:border-box;font-family:Inter,Arial,sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.38);}' +
      '#iba-test-mode-badge .iba-test-mode-title{font-size:12px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;}' +
      '#iba-test-mode-badge .iba-test-mode-sub{font-size:11px;font-weight:750;line-height:1.35;opacity:.92;}' +
      '#iba-test-mode-badge .iba-test-mode-actions{display:flex;gap:8px;align-items:center;margin-top:9px;}' +
      '#iba-test-mode-badge .iba-test-mode-action,#iba-test-mode-badge .iba-test-mode-close{border:0;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:950;text-decoration:none;cursor:pointer;}' +
      '#iba-test-mode-badge .iba-test-mode-close{margin-left:auto;width:28px;height:28px;padding:0;}' +
      '#iba-test-mode-badge.is-test{background:linear-gradient(135deg,#991b1b,#f59e0b);color:#fff;}' +
      '#iba-test-mode-badge.is-live{background:linear-gradient(135deg,#064e3b,#16a34a);color:#fff;opacity:.94;}' +
      '#iba-test-mode-badge.is-live .iba-test-mode-action,#iba-test-mode-badge.is-test .iba-test-mode-action{background:#fff;color:#0f172a;}' +
      '#iba-test-mode-badge .iba-test-mode-close{background:rgba(255,255,255,.24);color:#fff;}' +
      '#iba-test-preview-login-note{margin:12px 0 8px;padding:10px 12px;border-radius:14px;background:linear-gradient(135deg,rgba(153,27,27,.12),rgba(245,158,11,.14));border:1px solid rgba(245,158,11,.42);color:#7c2d12;font:800 12px/1.35 Inter,Arial,sans-serif;text-align:left;}' +
      '#iba-test-preview-login-btn{width:100%;margin-top:8px;border:0;border-radius:999px;padding:11px 14px;background:linear-gradient(135deg,#991b1b,#f59e0b);color:#fff;font:1000 13px/1 Inter,Arial,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 12px 28px rgba(153,27,27,.22);}' +
      '#iba-test-preview-login-btn i{margin-right:8px;}' +
      '.iba-test-preview-active #iba-test-mode-badge .iba-test-mode-title::after{content:" • PREVIEW";}' +
      '@media(max-width:640px){#iba-test-mode-badge{left:10px;bottom:10px;width:calc(100vw - 20px);}}';

    badge.className = isTest ? 'is-test' : 'is-live';
    document.head.appendChild(style);
    document.body.appendChild(badge);
    const close = badge.querySelector('.iba-test-mode-close');
    if (close) close.addEventListener('click', function () { badge.remove(); });
  }

  window.IBA_TEST_MODE = {
    version: VERSION,
    mode: mode,
    isLocal: isLocal,
    firebaseBlocked: firebaseBlocked,
    forceTestMode: forceTestMode,
    forceLiveFirebase: forceLiveFirebase,
    installFirebaseBlocker: installFirebaseBlocker,
    notifyBlocked: notifyBlocked
  };
  window.IBA_ENV_MODE = mode;
  window.IBA_FIREBASE_BLOCKED = firebaseBlocked;
  window.ibaIsFirebaseBlocked = function () { return firebaseBlocked; };
  window.ibaShouldUseCacheOnly = shouldBlock;
  window.ibaNotifyFirebaseBlocked = notifyBlocked;

  const previousShouldPauseFirebase = window.ibaShouldPauseFirebase;
  window.ibaShouldPauseFirebase = function (label, silent) {
    if (shouldBlock(label || 'firebase-work', silent)) return true;
    if (typeof previousShouldPauseFirebase === 'function') return previousShouldPauseFirebase(label, silent);
    return false;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBadge, { once: true });
  } else {
    renderBadge();
  }

  installFirebaseBlocker();
  try { console.info(LOG_PREFIX, mode === 'test' ? 'TEST MODE active: Firebase disabled.' : 'LIVE MODE active: Firebase allowed.'); } catch (_) {}
})();
