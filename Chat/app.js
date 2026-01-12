// IBA Messages - standalone (1.0.10)
// NOTE: This uses your existing RTDB approvers + dm_* nodes (same as the main system).
// For true privacy, lock down Firebase rules (recommended: Firebase Auth).

const firebaseConfig = {
  apiKey: "AIzaSyBCHiQsjqhEUVZN9KhhckSqkw8vVT9LcXc",
  authDomain: "ibainvoice-3ea51.firebaseapp.com",
  databaseURL: "https://ibainvoice-3ea51-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ibainvoice-3ea51",
  storageBucket: "ibainvoice-3ea51.firebasestorage.app",
  messagingSenderId: "152429622957",
  appId: "1:152429622957:web:f79a80df75ce662e97b824",
  measurementId: "G-KR3KDQ3NRC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let storage = null;
try { storage = firebase.storage(); } catch (_) { storage = null; }
let auth = null;
try { auth = firebase.auth(); } catch (_) { auth = null; }

const DM_PRESENCE_ROOT = 'presence';
const DM_INBOX_ROOT    = 'dm_inbox';
const DM_THREADS_ROOT  = 'dm_threads';
const DM_UNREAD_ROOT   = 'dm_unread';

// Upload limits (keeps it fast + reduces mobile data usage)
const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;   // final upload limit (after compression): 4MB
const MAX_IMAGE_PICK_BYTES   = 20 * 1024 * 1024;  // refuse huge images to avoid memory issues: 20MB
const MAX_IMAGE_DIM          = 1600;              // px (largest side)
const MIN_JPEG_QUALITY       = 0.55;

// ========================
// THEME (light / dark)
// ========================
const THEME_KEY = 'iba_msg_theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {}
  return 'light';
}

function applyTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  updateThemeButtons();
}

function updateThemeButtons() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const nextIcon = isDark ? '#ico-sun' : '#ico-moon';
  const nextLabel = isDark ? 'Light' : 'Dark';
  const btnIds = ['theme-toggle', 'theme-toggle-float'];
  for (const id of btnIds) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const use = btn.querySelector('use');
    if (use) use.setAttribute('href', nextIcon);
    const span = btn.querySelector('span');
    if (span) span.textContent = nextLabel;
  }
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatChatTime(ts) {
  try {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

function normalizeMobile(v) {
  // Qatar default: users often store/enter numbers with country code 974.
  // Normalize so login/search works whether user types 55xxxxxx or 97455xxxxxx.
  let s = String(v || '').replace(/\D/g, '');
  // Handle cases like 00974XXXXXXXX (after stripping non-digits it becomes '00974...')
  if (s.startsWith('00974')) s = s.slice(5);
  // Strip Qatar country code when present
  if (s.startsWith('974') && s.length > 8) s = s.slice(3);
  // Optional: strip a single leading 0 if someone typed 0XXXXXXXX
  if (s.startsWith('0') && s.length === 9) s = s.slice(1);
  return s;
}

function safeText(t) {
  return String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
}
function sanitizeFileName(name) {
  return String(name || 'image')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
}

async function fileToImageBitmap(file) {
  if (window.createImageBitmap) return await createImageBitmap(file);
  // Fallback for older browsers
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await new Promise((res, rej) => { img.onload = () => res(); img.onerror = rej; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d')?.drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function maybeResizeImage(file, maxDim = 1280, quality = 0.86) {
  // Keep small files as-is
  if (!file || file.size <= 1500 * 1024) return file;

  try {
    const bmp = await fileToImageBitmap(file);
    const w = bmp.width || bmp.naturalWidth || 0;
    const h = bmp.height || bmp.naturalHeight || 0;
    if (!w || !h) return file;

    const maxSide = Math.max(w, h);
    if (maxSide <= maxDim) return file;

    const scale = maxDim / maxSide;
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, nw, nh);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    if (!blob) return file;

    return new File([blob], (sanitizeFileName(file.name).replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.warn('Resize skipped:', e);
    return file;
  }
}

async function optimizeImageForUpload(file, maxBytes = MAX_IMAGE_UPLOAD_BYTES) {
  // Goal: keep uploads small, especially for mobile, while still accepting normal photos.
  // Strategy: convert to JPEG, resize if needed, then reduce JPEG quality until <= maxBytes.
  if (!file) return file;

  if (file.size > MAX_IMAGE_PICK_BYTES) {
    throw new Error('IMAGE_TOO_BIG_PICK');
  }

  // If already within size, still consider resizing huge dimensions (mobile camera photos)
  let workingFile = file;

  // Force a resize step if dimensions are large, OR if file is fairly big
  try {
    // Resize down to MAX_IMAGE_DIM (also converts to JPEG)
    workingFile = await (async () => {
      try {
        const bmp = await fileToImageBitmap(workingFile);
        const w = bmp.width || bmp.naturalWidth || 0;
        const h = bmp.height || bmp.naturalHeight || 0;
        if (!w || !h) return workingFile;

        const maxSide = Math.max(w, h);
        const targetMax = Math.min(MAX_IMAGE_DIM, maxSide);
        const scale = targetMax / maxSide;
        const nw = Math.max(1, Math.round(w * scale));
        const nh = Math.max(1, Math.round(h * scale));

        // If image is small and already under the limit, don't touch it (keep original)
        if (maxSide <= targetMax && workingFile.size <= maxBytes) return workingFile;

        const canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, nw, nh);

        // Start with decent quality then tune down if needed
        let q = 0.86;
        let outBlob = null;

        for (let i = 0; i < 10; i++) {
          outBlob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', q);
          });
          if (!outBlob) break;
          if (outBlob.size <= maxBytes) break;
          q = Math.max(MIN_JPEG_QUALITY, q - 0.07);
          if (q === MIN_JPEG_QUALITY) break;
        }

        if (!outBlob) return workingFile;

        // If still too large, scale down a bit more and re-encode (a couple tries)
        let attempts = 0;
        let curBlob = outBlob;
        let curW = nw;
        let curH = nh;
        while (curBlob.size > maxBytes && attempts < 3) {
          attempts++;
          const shrink = 0.85;
          curW = Math.max(1, Math.round(curW * shrink));
          curH = Math.max(1, Math.round(curH * shrink));
          const c2 = document.createElement('canvas');
          c2.width = curW;
          c2.height = curH;
          c2.getContext('2d')?.drawImage(canvas, 0, 0, curW, curH);
          const b2 = await new Promise((resolve) => {
            c2.toBlob((b) => resolve(b), 'image/jpeg', MIN_JPEG_QUALITY);
          });
          if (!b2) break;
          curBlob = b2;
        }

        if (curBlob.size > maxBytes) {
          // We tried; let caller decide (we'll reject)
          throw new Error('IMAGE_TOO_BIG_FINAL');
        }

        const baseName = sanitizeFileName(workingFile.name).replace(/\.[^.]+$/, '') || 'photo';
        return new File([curBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
      } catch (e) {
        // If we can't process, fallback to original (caller may still reject by size)
        if (String(e?.message || '').includes('IMAGE_TOO_BIG')) throw e;
        return workingFile;
      }
    })();
  } catch (e) {
    throw e;
  }

  // Final guard
  if (workingFile.size > maxBytes) {
    throw new Error('IMAGE_TOO_BIG_FINAL');
  }
  return workingFile;
}

function setComposeBusy(busy, labelText) {
  const sendBtn = document.getElementById('dm-send');
  const attachBtn = document.getElementById('dm-attach');
  const micBtn = document.getElementById('dm-mic');
  const sendText = document.querySelector('#dm-send .dm-send-text');
  if (sendBtn) sendBtn.disabled = !!busy;
  if (attachBtn) attachBtn.disabled = !!busy;
  if (micBtn) micBtn.disabled = !!busy;
  if (sendText) sendText.textContent = busy ? (labelText || '...') : 'Send';
}
async function ensureAnonAuth() {
  // Helps Firebase Storage rules like: allow read, write: if request.auth != null
  if (!auth) return false;
  try {
    if (auth.currentUser) return true;
    await auth.signInAnonymously();
    return !!auth.currentUser;
  } catch (e) {
    console.warn('Anonymous auth failed:', e);
    return false;
  }
}

function msgElId(msgId) {
  return `dm-msg-${String(msgId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function getThreadId(aKey, bKey) {
  const a = String(aKey || '').trim();
  const b = String(bKey || '').trim();
  if (!a || !b) return '';
  return (a < b) ? `${a}__${b}` : `${b}__${a}`;
}

function isMobileLayout() {
  try { return window.matchMedia('(max-width: 820px)').matches; }
  catch { return (window.innerWidth || 1024) <= 820; }
}

function setMobileScreen(screen) {
  const root = document.getElementById('dm-root');
  if (!root) return;
  const mob = isMobileLayout();
  root.classList.toggle('dm-mobile-list', mob && screen === 'list');
  root.classList.toggle('dm-mobile-chat', mob && screen === 'chat');
}

function toast(title, body) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b>${escapeHtml(title)}</b><div>${escapeHtml(body)}</div>`;
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s ease';
    setTimeout(() => el.remove(), 260);
  }, 4200);
}

// ========================
// FIXED TOPBAR HEIGHT (mobile)
// ========================
// On some mobile widths the topbar can wrap (user pill + buttons), which can hide the search bar.
// We measure the real height and store it in CSS var --topbar-h.
function syncTopbarHeight() {
  const tb = document.querySelector('.topbar');
  if (!tb) return;
  // If the topbar is hidden (login screen), offsetHeight may be 0.
  // Don't overwrite the CSS default in that case.
  const rect = tb.getBoundingClientRect?.();
  const rawH = (rect && rect.height) ? rect.height : (tb.offsetHeight || 0);
  if (!rawH || rawH < 1) return;
  const h = Math.max(48, Math.round(rawH));
  document.documentElement.style.setProperty('--topbar-h', `${h}px`);
}

window.addEventListener('resize', () => {
  requestAnimationFrame(() => {
    syncTopbarHeight();
  });
});

// Run a couple times to catch first layout + font load.
requestAnimationFrame(syncTopbarHeight);
setTimeout(syncTopbarHeight, 50);
setTimeout(syncTopbarHeight, 250);

// ========================
// AUTH (same approach as main system)
// ========================
let approversCache = null; // { key: record }
let currentUser = null; // {key, Name, Email, Mobile, Password}

async function loadApprovers() {
  if (approversCache) return approversCache;
  const snap = await db.ref('approvers').once('value');
  approversCache = snap.val() || {};
  return approversCache;
}

async function getApproverByKey(key) {
  const snap = await db.ref(`approvers/${key}`).once('value');
  const v = snap.val();
  if (!v) return null;
  return { key, ...v };
}

async function findApprover(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return null;

  const isEmail = id.includes('@');
  const mobileSearch = normalizeMobile(id);
  const data = await loadApprovers();

  for (const [key, rec] of Object.entries(data)) {
    if (!rec) continue;
    if (isEmail) {
      const em = String(rec.Email || '').trim().toLowerCase();
      if (em && em === id.toLowerCase()) return { key, ...rec };
    } else {
      const mob = normalizeMobile(rec.Mobile || '');
      if (mob && mob === mobileSearch) return { key, ...rec };
    }
  }
  return null;
}

function showScreen(which) {
  document.getElementById('login-screen').classList.toggle('hidden', which !== 'login');
  document.getElementById('chat-screen').classList.toggle('hidden', which !== 'chat');

  // Only show the floating theme button on the login screen (chat already has a topbar toggle)
  document.getElementById('theme-toggle-float')?.classList.toggle('hidden', which !== 'login');

  // IMPORTANT: after revealing the chat screen, re-measure the topbar height.
  // This prevents the search bar from being hidden behind the fixed header on mobile.
  if (which === 'chat') {
    requestAnimationFrame(syncTopbarHeight);
    setTimeout(syncTopbarHeight, 50);
    setTimeout(syncTopbarHeight, 250);
  }
}

async function doLogin(identifier, password) {
  const user = await findApprover(identifier);
  if (!user) return { ok:false, reason:'Access denied. User not found.' };
  if (!user.Password) return { ok:false, reason:'Password not set for this user. Open the main system once to set it.' };
  if (String(password || '') !== String(user.Password || '')) return { ok:false, reason:'Incorrect password.' };
  currentUser = user;
  localStorage.setItem('approverKey', user.key);
  return { ok:true };
}

function doLogout() {
  try { localStorage.removeItem('approverKey'); } catch {}
  shutdownDM();
  currentUser = null;
  showScreen('login');
}

// ========================
// DM STATE + SUBSCRIPTIONS
// ========================
const dm = {
  open: false,
  userKey: null,
  userName: '',
  toKey: null,
  toName: '',
  threadId: null,

  // refs/listeners
  connectedRef: null,
  onConnected: null,
  presenceRef: null,
  heartbeat: null,

  unreadRef: null,
  onUnread: null,
  unreadCache: {},

  inboxRef: null,
  onInbox: null,

  presenceListRef: null,
  onPresenceChild: null,
  onPresenceRemoved: null,
  presenceCache: {},

  threadMessagesRef: null,
  onThreadMsg: null,

  // user list (array)
  users: [],
};

function setChatHeader() {
  const title = document.getElementById('dm-chat-title');
  const avatar = document.getElementById('dm-chat-avatar');
  const status = document.getElementById('dm-chat-status');

  const name = dm.toName ? dm.toName : 'Select a user';
  if (title) title.textContent = name;

  const initials = name.split(' ').filter(Boolean).slice(0,2).map(s => s[0].toUpperCase()).join('') || '?';
  if (avatar) avatar.textContent = initials;

  if (status) {
    if (!dm.toKey) status.textContent = '';
    else {
      const pres = dm.presenceCache[dm.toKey] || {};
      const online = (pres.status === 'online');
      status.textContent = online ? 'Online' : (pres.lastSeen ? `Last seen ${new Date(pres.lastSeen).toLocaleString()}` : 'Offline');
    }
  }
}

function renderOnlineStrip() {
  const wrap = document.getElementById('dm-online-strip');
  const sep = document.getElementById('dm-online-sep');
  if (!wrap) return;

  const qRaw = (document.getElementById('dm-user-search')?.value || '').trim().toLowerCase();
  const qTerms = qRaw.split(/\s+/).filter(Boolean);
  const qMob = normalizeMobile(qRaw);

  const matchesQ = (u) => {
    if (!qTerms.length) return true;
    const name = String(u.Name || '').toLowerCase();
    const email = String(u.Email || '').toLowerCase();
    const mob = normalizeMobile(u.Mobile || '');
    const hay = `${name} ${email}`;
    // Require all typed terms to appear in name/email; also allow mobile numeric search.
    const termsOk = qTerms.every(t => hay.includes(t));
    const mobOk = qMob ? mob.includes(qMob) : false;
    return termsOk || mobOk;
  };

  const onlineUsers = dm.users
    .filter(u => u && u.key && u.key !== dm.userKey)
    .filter(u => dm.presenceCache?.[u.key]?.status === 'online')
    .filter(matchesQ);

  onlineUsers.sort((a, b) => String(a.Name || '').toLowerCase().localeCompare(String(b.Name || '').toLowerCase()));

  wrap.innerHTML = '';

  // If no one is online (after search filtering), hide the strip + separator.
  if (onlineUsers.length === 0) {
    wrap.style.display = 'none';
    if (sep) sep.style.display = 'none';
    return;
  }

  // Ensure the strip is visible when we have online users.
  wrap.style.display = 'flex';

  // Render up to 20 online users to keep the strip fast on mobile.
  for (const u of onlineUsers.slice(0, 20)) {
    const item = document.createElement('div');
    item.className = `dm-online-item ${u.key === dm.toKey ? 'active' : ''}`;

    const name = String(u.Name || 'User');
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'U';

    item.innerHTML = `
      <div class="dm-online-avatar">${escapeHtml(initials)}
        <span class="dm-dot online"></span>
      </div>
      <div class="dm-online-name">${escapeHtml(name)}</div>
    `;

    item.addEventListener('click', () => openThread(u.key, u.Name || 'User'));
    wrap.appendChild(item);
  }

  if (sep) sep.style.display = '';
}

function renderUserList() {
  const list = document.getElementById('dm-user-list');
  if (!list) return;

  // Keep the online strip in sync with search / presence changes.
  renderOnlineStrip();

  const qRaw = (document.getElementById('dm-user-search')?.value || '').trim().toLowerCase();
  const qTerms = qRaw.split(/\s+/).filter(Boolean);
  const qMob = normalizeMobile(qRaw);

  const matchesQ = (u) => {
    if (!qTerms.length) return true;
    const name = String(u.Name || '').toLowerCase();
    const email = String(u.Email || '').toLowerCase();
    const mob = normalizeMobile(u.Mobile || '');
    const hay = `${name} ${email}`;
    const termsOk = qTerms.every(t => hay.includes(t));
    const mobOk = qMob ? mob.includes(qMob) : false;
    return termsOk || mobOk;
  };

  const users = dm.users
    .filter(u => u.key !== dm.userKey)
    .filter(matchesQ);

  // Sort with online users always at the top (then by name)
  users.sort((a, b) => {
    const ao = (dm.presenceCache?.[a.key]?.status === 'online') ? 1 : 0;
    const bo = (dm.presenceCache?.[b.key]?.status === 'online') ? 1 : 0;
    if (bo !== ao) return bo - ao;
    const an = String(a.Name || '').toLowerCase();
    const bn = String(b.Name || '').toLowerCase();
    return an.localeCompare(bn);
  });

  list.innerHTML = '';

  if (users.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'dm-no-results';
    empty.textContent = 'No matching users';
    list.appendChild(empty);
    return;
  }

  users.forEach(u => {
    const active = (u.key === dm.toKey);
    const pres = dm.presenceCache[u.key] || {};
    const online = (pres.status === 'online');

    const unread = dm.unreadCache?.[dm.userKey]?.[getThreadId(dm.userKey, u.key)]?.count
      ?? dm.unreadCache?.[getThreadId(dm.userKey, u.key)]?.count
      ?? 0;

    const initials = String(u.Name || 'U').split(' ').filter(Boolean).slice(0,2).map(s => s[0].toUpperCase()).join('');

    const row = document.createElement('div');
    row.className = `dm-user ${active ? 'active' : ''}`;
    row.innerHTML = `
      <div class="dm-left">
        <div class="dm-avatar">${escapeHtml(initials || 'U')}
          <span class="dm-dot ${online ? 'online' : ''}"></span>
        </div>
        <div style="min-width:0;">
          <div class="dm-name">${escapeHtml(String(u.Name || 'User'))}</div>
          <div class="dm-meta">${escapeHtml(String(u.Position || u.Site || ''))}</div>
        </div>
      </div>
      ${Number(unread) > 0 ? `<div class="dm-badge">${Number(unread)}</div>` : ``}
    `;
    row.addEventListener('click', () => openThread(u.key, u.Name || 'User'));
    list.appendChild(row);
  });
}

function clearThreadListener() {
  try {
    if (dm.threadMessagesRef && dm.onThreadMsg) {
      dm.threadMessagesRef.off('child_added', dm.onThreadMsg);
    }
    if (dm.threadMessagesRef && dm.onThreadMsgChanged) {
      dm.threadMessagesRef.off('child_changed', dm.onThreadMsgChanged);
    }
  } catch {}
  dm.threadMessagesRef = null;
  dm.onThreadMsg = null;
  dm.onThreadMsgChanged = null;
}

// ========================
// MESSAGE ACTIONS (Edit / Delete)
// ========================
let activeSheet = null;
let activeSheetOnKey = null;

function closeSheet() {
  try { if (activeSheetOnKey) window.removeEventListener('keydown', activeSheetOnKey); } catch {}
  activeSheetOnKey = null;
  if (activeSheet) {
    try { activeSheet.remove(); } catch {}
  }
  activeSheet = null;
}

function openSheet(titleText, bodyNode, actionsNode) {
  closeSheet();

  const back = document.createElement('div');
  back.className = 'dm-sheet-backdrop';
  back.addEventListener('click', (e) => {
    if (e.target === back) closeSheet();
  });

  const sheet = document.createElement('div');
  sheet.className = 'dm-sheet';

  const head = document.createElement('div');
  head.className = 'dm-sheet-head';
  head.textContent = titleText || '';

  const body = document.createElement('div');
  body.className = 'dm-sheet-body';
  if (bodyNode) body.appendChild(bodyNode);

  sheet.appendChild(head);
  sheet.appendChild(body);
  if (actionsNode) sheet.appendChild(actionsNode);
  back.appendChild(sheet);
  document.body.appendChild(back);

  activeSheet = back;
  activeSheetOnKey = (e) => {
    if (e.key === 'Escape') closeSheet();
  };
  window.addEventListener('keydown', activeSheetOnKey);

  // focus first button/textarea
  setTimeout(() => {
    try {
      const focusEl = sheet.querySelector('textarea, button');
      focusEl?.focus?.();
    } catch {}
  }, 0);
}

function makeSheetButton(label, { danger = false, onClick } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `dm-sheet-btn${danger ? ' danger' : ''}`;
  b.textContent = label;
  b.addEventListener('click', () => {
    try { onClick?.(); } catch (_) {}
  });
  return b;
}

async function openEditModal(threadId, msgId, msgObj) {
  const m = msgObj;
  if (!m || m.deleted) return;
  const type = String(m.type || (m.imageUrl ? 'image' : (m.audioUrl ? 'audio' : 'text')));
  const isText = (type === 'text');
  // Requirement: edit for TEXT messages only (images are delete-only).
  if (!isText) return;

  const oldText = String(m.text ?? '');

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '10px';

  const ta = document.createElement('textarea');
  ta.className = 'dm-edit-area';
  ta.value = oldText;
  ta.placeholder = 'Edit message...';
  wrap.appendChild(ta);

  const hint = document.createElement('div');
  hint.className = 'dm-edit-hint';
  hint.textContent = 'Update your message.';
  wrap.appendChild(hint);

  const actions = document.createElement('div');
  actions.className = 'dm-sheet-actions';

  const cancel = makeSheetButton('Cancel', { onClick: closeSheet });
  const save = makeSheetButton('Save', {
    onClick: async () => {
      const next = safeText(ta.value);
      if (!next) { toast('Messages', 'Message cannot be empty.'); return; }
      try {
        await updateMessageContent(threadId, msgId, m, next);
        closeSheet();
      } catch (e) {
        console.warn(e);
        toast('Messages', 'Failed to edit message.');
      }
    }
  });
  actions.appendChild(cancel);
  actions.appendChild(save);

  openSheet('Edit message', wrap, actions);
}

async function updateMessageContent(threadId, msgId, m, nextText) {
  if (!threadId || !msgId || !m) return;
  if (String(m.fromKey || '') !== String(dm.userKey || '')) {
    toast('Messages', 'You can only edit your own messages.');
    return;
  }

  const type = String(m.type || (m.imageUrl ? 'image' : (m.audioUrl ? 'audio' : 'text')));
  const isText = (type === 'text');
  if (!isText) return;

  const threadRef = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`);
  const toKey = String(m.toKey || dm.toKey || '');
  const inboxRef = toKey ? db.ref(`${DM_INBOX_ROOT}/${toKey}/${msgId}`) : null;

  const patch = {
    edited: true,
    editedAt: firebase.database.ServerValue.TIMESTAMP,
  };
  patch.text = safeText(nextText);

  await threadRef.update(patch);
  try {
    if (inboxRef) {
      await inboxRef.update({ text: patch.text, edited: true, editedAt: patch.editedAt });
    }
  } catch (_) {}

  // Best-effort: keep unread preview in sync if it matches the previous text
  try {
    if (toKey) {
      const unreadRef = db.ref(`${DM_UNREAD_ROOT}/${toKey}/${threadId}`);
      const us = await unreadRef.once('value');
      const u = us.val();
      if (u && typeof u.lastText === 'string') {
        const oldPreview = String(u.lastText || '');
        const newPreview = patch.text;
        const prevWas = String(m.text || '');
        if (oldPreview === prevWas) {
          await unreadRef.child('lastText').set(newPreview);
        }
      }
    }
  } catch (_) {}
}

async function openMessageActions(threadId, msgId) {
  if (!threadId || !msgId) return;
  try {
    const ref = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`);
    const snap = await ref.once('value');
    const m = snap.val();
    if (!m) return;
    if (String(m.fromKey || '') !== String(dm.userKey || '')) return;

    const type = String(m.type || (m.imageUrl ? 'image' : (m.audioUrl ? 'audio' : 'text')));
    // Requirement: edit is allowed for TEXT messages only. Images can be deleted (not edited).
    const canEdit = !m.deleted && (type === 'text');

    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '10px';

    if (canEdit) {
      body.appendChild(makeSheetButton('Edit', {
        onClick: () => {
          closeSheet();
          openEditModal(threadId, msgId, m);
        }
      }));
    }

    body.appendChild(makeSheetButton('Delete', {
      danger: true,
      onClick: async () => {
        closeSheet();
        await promptDelete(threadId, msgId);
      }
    }));

    body.appendChild(makeSheetButton('Cancel', { onClick: closeSheet }));

    openSheet('Message', body, null);
  } catch (e) {
    console.warn(e);
  }
}

function attachMessageActions(el, threadId, msgId) {
  if (!el) return;

  // Desktop: right-click
  el.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    await openMessageActions(threadId, msgId);
  });

  // Mobile: long-press
  let pressTimer = null;
  const clear = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  el.addEventListener('pointerdown', () => {
    clear();
    pressTimer = setTimeout(() => { openMessageActions(threadId, msgId); }, 520);
  });
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointercancel', clear);
  el.addEventListener('pointerleave', clear);

  // Quick desktop edit: double click
  el.addEventListener('dblclick', async () => {
    try {
      const ref = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`);
      const snap = await ref.once('value');
      const m = snap.val();
      if (!m || m.deleted) return;
      const type = String(m.type || 'text');
      // Double-click edit: text only
      if (String(m.fromKey || '') === String(dm.userKey || '') && type === 'text') {
        await openEditModal(threadId, msgId, m);
      }
    } catch (_) {}
  });
}

async function promptDelete(threadId, msgId) {
  // Only allow delete for the sender (UI guard). Actual privacy requires RTDB rules.
  const el = document.getElementById(msgElId(msgId));
  if (!el || !el.classList.contains('me')) return;
  if (!threadId || !msgId) return;
  if (!confirm('Delete this message?')) return;

  try {
    const ref = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`);
    const snap = await ref.once('value');
    const v = snap.val();
    if (!v) return;
    if (String(v.fromKey || '') !== String(dm.userKey || '')) {
      toast('Messages', 'You can only delete your own messages.');
      return;
    }
    await ref.update({
  text: '',
  caption: '',
  imageUrl: '',
  audioUrl: '',
  audioPath: '',
  durationMs: 0,
  deleted: true,
  deletedBy: dm.userKey,
  deletedAt: firebase.database.ServerValue.TIMESTAMP
});

// Best-effort: delete the uploaded file from Storage (if rules allow)
try {
  if (storage && v.imagePath) {
    await firebase.storage().ref(v.imagePath).delete();
  }
  if (storage && v.audioPath) {
    await firebase.storage().ref(v.audioPath).delete();
  }
} catch (_) {}
  } catch (e) {
    console.warn(e);
    toast('Messages', 'Failed to delete message.');
  }
}

function renderMessage(msgId, m) {
  const msgList = document.getElementById('dm-message-list');
  if (!msgList) return;

  const isDeleted = !!m?.deleted;
  const type = String(m?.type || (m?.imageUrl ? 'image' : (m?.audioUrl ? 'audio' : 'text')));

  const caption = isDeleted ? '' : safeText(m?.caption ?? m?.text ?? '');
  const imageUrl = isDeleted ? '' : String(m?.imageUrl || '');

  if (!isDeleted) {
    if (type === 'text' && !caption) return;
    if (type === 'image' && !imageUrl) return;
  }

  // remove empty state
  document.getElementById('dm-empty-state')?.remove();

  const isMe = String(m.fromKey || '') === dm.userKey;
  const id = msgElId(msgId);

  let el = document.getElementById(id);
  const firstTime = !el;
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = `dm-msg ${isMe ? 'me' : ''}`;
    if (isMe) el.title = 'Right click (desktop) or long press (mobile) to edit / delete';
    msgList.appendChild(el);
  }

  let bodyHtml = '';
  if (isDeleted) {
    bodyHtml = `<div class="dm-deleted">This message was deleted</div>`;
  } else if (type === 'audio') {
    const safeUrl = escapeHtml(String(m?.audioUrl || ''));
    const dur = formatDurationMs(m?.durationMs);
    bodyHtml = `
      <audio class="dm-audio" controls src="${safeUrl}"></audio>
      <div class="dm-audio-meta">${escapeHtml(dur || '')}</div>
    `;
  } else if (type === 'image') {
    const safeUrl = escapeHtml(imageUrl);
    const cap = caption ? `<div class="dm-caption">${escapeHtml(caption)}</div>` : '';
    bodyHtml = `
      <a class="dm-img-wrap" href="${safeUrl}" target="_blank" rel="noopener">
        <img class="dm-img" src="${safeUrl}" alt="Photo"/>
      </a>
      ${cap}
    `;
  } else {
    bodyHtml = `<div>${escapeHtml(caption)}</div>`;
  }

  const edited = !!(m?.edited || m?.editedAt);
  const tsLabel = `${formatChatTime(m.ts)}${edited ? ' · edited' : ''}`;

  el.innerHTML = `
    ${bodyHtml}
    <div class="dm-ts">${escapeHtml(tsLabel)}</div>
  `;

  if (firstTime && isMe) attachMessageActions(el, dm.threadId, msgId);

  const nearBottom = (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight) < 120;
  if (nearBottom) msgList.scrollTop = msgList.scrollHeight;
}

function openThread(toKey, toName) {
  dm.toKey = String(toKey || '').trim();
  dm.toName = String(toName || '').trim();
  dm.threadId = getThreadId(dm.userKey, dm.toKey);

  setChatHeader();
  renderUserList();
  setMobileScreen('chat');

  // mark read
  if (dm.threadId) db.ref(`${DM_UNREAD_ROOT}/${dm.userKey}/${dm.threadId}`).remove().catch(() => {});

  // clear messages container
  const msgList = document.getElementById('dm-message-list');
  if (msgList) {
    msgList.innerHTML = '';
    msgList.innerHTML = `
      <div class="dm-empty" id="dm-empty-state">
        <div class="dm-empty-title">No messages yet</div>
        <div class="dm-empty-sub">Say hello 👋</div>
      </div>
    `;
  }

  clearThreadListener();
  if (!dm.threadId) return;

  dm.threadMessagesRef = db.ref(`${DM_THREADS_ROOT}/${dm.threadId}/messages`).limitToLast(200);
  dm.onThreadMsg = (snap) => {
    const v = snap.val();
    if (v) renderMessage(snap.key, v);
  };
  dm.onThreadMsgChanged = (snap) => {
    const v = snap.val();
    if (v) renderMessage(snap.key, v);
  };
  dm.threadMessagesRef.on('child_added', dm.onThreadMsg);
  dm.threadMessagesRef.on('child_changed', dm.onThreadMsgChanged);

  try { document.getElementById('dm-input')?.focus(); } catch {}
}


async function sendTextMessage(text) {
  if (!dm.toKey || !dm.threadId) { toast('Messages', 'Select a user first.'); return; }
  const msgText = safeText(text);
  if (!msgText) return;

  const threadId = getThreadId(dm.userKey, dm.toKey);
  const msgId = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages`).push().key;

  const msg = {
    fromKey: dm.userKey,
    fromName: dm.userName,
    toKey: dm.toKey,
    toName: dm.toName,
    type: 'text',
    text: msgText,
    ts: firebase.database.ServerValue.TIMESTAMP
  };

  const updates = {};
  updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.userKey}`] = true;
  updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.toKey}`] = true;
  updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.userKey}`] = dm.userName;
  updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.toKey}`] = dm.toName;
  updates[`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`] = msg;
  updates[`${DM_INBOX_ROOT}/${dm.toKey}/${msgId}`] = msg;

  await db.ref().update(updates);

  const base = db.ref(`${DM_UNREAD_ROOT}/${dm.toKey}/${threadId}`);
  base.child('count').transaction(c => (Number(c) || 0) + 1);
  base.child('lastText').set(msgText);
  base.child('lastTs').set(firebase.database.ServerValue.TIMESTAMP);
  base.child('fromName').set(dm.userName);
  base.child('fromKey').set(dm.userKey);
}

async function sendImage(file, captionText) {
  if (!dm.toKey || !dm.threadId) { toast('Messages', 'Select a user first.'); return; }
  if (!file) return;
  if (!String(file.type || '').startsWith('image/')) { toast('Messages', 'Please select an image file.'); return; }

  // Hard limits to keep it fast + protect data usage
  // We will try to compress/rescale, but we also refuse extremely huge files to avoid browser memory issues.
  if (file.size > MAX_IMAGE_PICK_BYTES) {
    toast('Messages', `Image is too large (max ${Math.round(MAX_IMAGE_PICK_BYTES/1024/1024)}MB). Please choose a smaller photo.`);
    return;
  }

  if (!storage) {
    toast('Messages', 'Photo upload is not enabled (Firebase Storage missing / blocked).');
    return;
  }

  const threadId = getThreadId(dm.userKey, dm.toKey);
  const msgRef = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages`).push();
  const msgId = msgRef.key;

  const caption = safeText(captionText || '').slice(0, 300);
  const preview = caption ? `📷 Photo: ${caption}` : '📷 Photo';

  setComposeBusy(true, 'Upload…');

  const authed = await ensureAnonAuth();
  if (!authed) {
    console.warn('No Firebase auth session; if Storage rules require auth, enable Anonymous auth in Firebase Console.');
  }

  try {
    const uploadFile = await optimizeImageForUpload(file, MAX_IMAGE_UPLOAD_BYTES);
    const filename = sanitizeFileName(uploadFile.name || file.name || 'photo.jpg');
    const path = `dm_uploads/${threadId}/${msgId}_${Date.now()}_${filename}`;

    const storageRef = firebase.storage().ref().child(path);
    const task = storageRef.put(uploadFile, { contentType: uploadFile.type || file.type || 'image/jpeg' });

    await new Promise((resolve, reject) => {
      task.on('state_changed', (snap) => {
        try {
          const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          setComposeBusy(true, pct ? `Upload ${pct}%` : 'Upload…');
        } catch (_) {}
      }, reject, resolve);
    });

    const url = await task.snapshot.ref.getDownloadURL();

    const msg = {
      fromKey: dm.userKey,
      fromName: dm.userName,
      toKey: dm.toKey,
      toName: dm.toName,
      type: 'image',
      text: caption,   // keep text for previews
      caption,
      imageUrl: url,
      imagePath: path,
      ts: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.userKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.toKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.userKey}`] = dm.userName;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.toKey}`] = dm.toName;
    updates[`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`] = msg;
    updates[`${DM_INBOX_ROOT}/${dm.toKey}/${msgId}`] = { ...msg, text: preview };

    await db.ref().update(updates);

    const base = db.ref(`${DM_UNREAD_ROOT}/${dm.toKey}/${threadId}`);
    base.child('count').transaction(c => (Number(c) || 0) + 1);
    base.child('lastText').set(preview);
    base.child('lastTs').set(firebase.database.ServerValue.TIMESTAMP);
    base.child('fromName').set(dm.userName);
    base.child('fromKey').set(dm.userKey);
  } catch (e) {
    console.warn(e);
    if (String(e?.message || '') === 'IMAGE_TOO_BIG_FINAL') {
      toast('Messages', `Could not shrink the image enough. Max upload size is ${Math.round(MAX_IMAGE_UPLOAD_BYTES/1024/1024)}MB.`);
    } else {
      toast('Messages', 'Photo failed to upload. Enable Firebase Storage + (recommended) enable Anonymous Auth, and ensure Storage rules allow upload/read.');
    }
  } finally {
    setComposeBusy(false);
  }
}

function preferredAudioMimeType() {
  const cands = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4'
  ];
  try {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (const t of cands) {
      try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (_) {}
    }
  } catch (_) {}
  return '';
}

function formatDurationMs(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2,'0')}`;
}

async function sendAudioBlob(blob, durationMs) {
  if (!dm.toKey || !dm.threadId) { toast('Messages', 'Select a user first.'); return; }
  if (!blob || !(blob.size > 0)) return;

  // Keep reasonable limits (voice notes, not huge files)
  if (blob.size > 12 * 1024 * 1024) { toast('Messages', 'Voice message too large (max 12MB).'); return; }

  if (!storage) {
    toast('Messages', 'Voice upload is not enabled (Firebase Storage missing / blocked).');
    return;
  }

  const threadId = getThreadId(dm.userKey, dm.toKey);
  const msgRef = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages`).push();
  const msgId = msgRef.key;

  const preview = '🎤 Voice message';

  setComposeBusy(true, 'Upload…');

  const authed = await ensureAnonAuth();
  if (!authed) {
    console.warn('No Firebase auth session; if Storage rules require auth, enable Anonymous auth in Firebase Console.');
  }

  try {
    const ext = (String(blob.type || '').includes('mp4')) ? 'm4a' : (String(blob.type || '').includes('ogg') ? 'ogg' : 'webm');
    const path = `dm_uploads/${threadId}/${msgId}_${Date.now()}_voice.${ext}`;

    const storageRef = firebase.storage().ref().child(path);
    const task = storageRef.put(blob, { contentType: blob.type || 'audio/webm' });

    await new Promise((resolve, reject) => {
      task.on('state_changed', (snap) => {
        try {
          const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          setComposeBusy(true, pct ? `Upload ${pct}%` : 'Upload…');
        } catch (_) {}
      }, reject, resolve);
    });

    const url = await task.snapshot.ref.getDownloadURL();

    const msg = {
      fromKey: dm.userKey,
      fromName: dm.userName,
      toKey: dm.toKey,
      toName: dm.toName,
      type: 'audio',
      text: preview,
      audioUrl: url,
      audioPath: path,
      durationMs: Number(durationMs) || 0,
      ts: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.userKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${dm.toKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.userKey}`] = dm.userName;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${dm.toKey}`] = dm.toName;
    updates[`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`] = msg;
    updates[`${DM_INBOX_ROOT}/${dm.toKey}/${msgId}`] = { ...msg, text: preview };

    await db.ref().update(updates);

    const base = db.ref(`${DM_UNREAD_ROOT}/${dm.toKey}/${threadId}`);
    base.child('count').transaction(c => (Number(c) || 0) + 1);
    base.child('lastText').set(preview);
    base.child('lastTs').set(firebase.database.ServerValue.TIMESTAMP);
    base.child('fromName').set(dm.userName);
    base.child('fromKey').set(dm.userKey);
  } catch (e) {
    console.warn(e);
    toast('Messages', 'Voice message failed to upload. Ensure Firebase Storage is enabled and rules allow upload/read.');
  } finally {
    setComposeBusy(false);
  }
}


function subscribePresence() {
  if (!dm.userKey) return;

  dm.connectedRef = db.ref('.info/connected');
  dm.onConnected = (snap) => {
    if (snap.val() !== true) return;
    dm.presenceRef = db.ref(`${DM_PRESENCE_ROOT}/${dm.userKey}`);
    const offline = { name: dm.userName, status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP };
    dm.presenceRef.onDisconnect().set(offline);
    dm.presenceRef.set({ name: dm.userName, status: 'online', lastSeen: firebase.database.ServerValue.TIMESTAMP });
  };
  dm.connectedRef.on('value', dm.onConnected);

  if (dm.heartbeat) clearInterval(dm.heartbeat);
  dm.heartbeat = setInterval(() => {
    dm.presenceRef?.update({ status:'online', lastSeen: firebase.database.ServerValue.TIMESTAMP });
  }, 120000);

  // Presence list (other users)
  dm.presenceListRef = db.ref(DM_PRESENCE_ROOT);
  dm.onPresenceChild = (snap) => {
    dm.presenceCache[snap.key] = snap.val() || {};
    renderUserList();
    setChatHeader();
  };
  dm.onPresenceRemoved = (snap) => {
    try { delete dm.presenceCache[snap.key]; } catch {}
    renderUserList();
    setChatHeader();
  };
  dm.presenceListRef.on('child_added', dm.onPresenceChild);
  dm.presenceListRef.on('child_changed', dm.onPresenceChild);
  dm.presenceListRef.on('child_removed', dm.onPresenceRemoved);
}

function subscribeUnread() {
  dm.unreadRef = db.ref(`${DM_UNREAD_ROOT}/${dm.userKey}`);
  dm.onUnread = (snap) => {
    dm.unreadCache = snap.val() || {};
    renderUserList();
  };
  dm.unreadRef.on('value', dm.onUnread);
}

function subscribeInbox() {
  dm.inboxRef = db.ref(`${DM_INBOX_ROOT}/${dm.userKey}`).limitToLast(50);
  dm.onInbox = (snap) => {
    const m = snap.val();
    if (m) {
      const preview = (String(m.type||'') === 'image')
        ? (safeText(m.text) ? `📷 Photo: ${safeText(m.text)}` : '📷 Photo')
        : (String(m.type||'') === 'audio')
          ? '🎤 Voice message'
          : safeText(m.text);
      if (preview) toast(m.fromName || 'Message', preview);
    }
    snap.ref.remove().catch(() => {});
  };
  dm.inboxRef.on('child_added', dm.onInbox);
}

function shutdownDM() {
  try {
    clearThreadListener();

    if (dm.heartbeat) { clearInterval(dm.heartbeat); dm.heartbeat = null; }
    dm.presenceRef?.update({ status:'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    if (dm.connectedRef && dm.onConnected) dm.connectedRef.off('value', dm.onConnected);

    if (dm.presenceListRef && dm.onPresenceChild) {
      dm.presenceListRef.off('child_added', dm.onPresenceChild);
      dm.presenceListRef.off('child_changed', dm.onPresenceChild);
      dm.presenceListRef.off('child_removed', dm.onPresenceRemoved);
    }

    if (dm.unreadRef && dm.onUnread) dm.unreadRef.off('value', dm.onUnread);
    if (dm.inboxRef && dm.onInbox) dm.inboxRef.off('child_added', dm.onInbox);
  } catch (e) {
    console.warn('DM shutdown warning:', e);
  }
}

// ========================
// INIT UI
// ========================

// Theme init + toggle buttons
applyTheme(getInitialTheme());
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-float')?.addEventListener('click', toggleTheme);

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-error');
  if (err) err.textContent = '';

  const identifier = document.getElementById('login-identifier')?.value || '';
  const password = document.getElementById('login-password')?.value || '';

  try {
    const res = await doLogin(identifier, password);
    if (!res.ok) { if (err) err.textContent = res.reason; return; }
    await startApp();
  } catch (e2) {
    console.error(e2);
    if (err) err.textContent = 'Login failed. Check connection.';
  }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  if (confirm('Logout?')) doLogout();
});

document.getElementById('dm-send')?.addEventListener('click', async () => {
  const input = document.getElementById('dm-input');
  const t = input?.value || '';
  if (input) input.value = '';
  try { await sendTextMessage(t); }
  catch (e) { console.warn(e); toast('Messages', 'Message failed to send.'); }
});
// Photo upload
const photoInput = document.getElementById('dm-photo');
document.getElementById('dm-attach')?.addEventListener('click', () => {
  try { photoInput?.click(); } catch (_) {}
});
photoInput?.addEventListener('change', async () => {
  const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
  photoInput.value = '';
  if (!file) return;

  // Use current input text as optional caption
  const input = document.getElementById('dm-input');
  const caption = input?.value || '';
  if (input) input.value = '';

  await sendImage(file, caption);
});


// Voice recording (MediaRecorder)
const micBtn = document.getElementById('dm-mic');
const recInd = document.getElementById('dm-rec-ind');
const recTimer = document.getElementById('dm-rec-timer');
let rec = { active:false, stream:null, media:null, chunks:[], startedAt:0, timer:null, autoStop:null };

function setRecordingUI(on) {
  if (micBtn) micBtn.classList.toggle('recording', !!on);
  const use = micBtn?.querySelector('use');
  if (use) use.setAttribute('href', on ? '#ico-stop' : '#ico-mic');
  if (recInd) recInd.classList.toggle('hidden', !on);

  const input = document.getElementById('dm-input');
  const sendBtn = document.getElementById('dm-send');
  const attachBtn = document.getElementById('dm-attach');

  if (input) {
    input.disabled = !!on;
    input.placeholder = on ? 'Recording voice…' : 'Message...';
  }
  if (sendBtn) sendBtn.disabled = !!on;
  if (attachBtn) attachBtn.disabled = !!on;
}

function clearRecTimer() {
  try { if (rec.timer) clearInterval(rec.timer); } catch {}
  rec.timer = null;
  if (recTimer) recTimer.textContent = '0:00';
}

async function startRecording() {
  if (rec.active) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast('Messages', 'Voice recording is not supported on this browser. Use Chrome/Edge, or update iOS.');
    return;
  }
  if (!dm.toKey || !dm.threadId) { toast('Messages', 'Select a user first.'); return; }
  if (!storage) { toast('Messages', 'Voice upload needs Firebase Storage enabled.'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = preferredAudioMimeType();
    const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    rec = { active:true, stream, media, chunks:[], startedAt:Date.now(), timer:null, autoStop:null };

    media.addEventListener('dataavailable', (e) => {
      try { if (e.data && e.data.size > 0) rec.chunks.push(e.data); } catch (_) {}
    });

    media.addEventListener('stop', async () => {
      const durationMs = Date.now() - (rec.startedAt || Date.now());
      const blob = new Blob(rec.chunks, { type: media.mimeType || mimeType || 'audio/webm' });

      // Cleanup stream
      try { rec.stream?.getTracks?.().forEach(t => t.stop()); } catch (_) {}
      clearRecTimer();
      setRecordingUI(false);

      // Ignore accidental taps (< 700ms)
      if (durationMs < 700 || blob.size < 800) return;

      await sendAudioBlob(blob, durationMs);
    });

    setRecordingUI(true);
    clearRecTimer();
    rec.timer = setInterval(() => {
      try {
        const ms = Date.now() - rec.startedAt;
        if (recTimer) recTimer.textContent = formatDurationMs(ms);
      } catch (_) {}
    }, 250);

    // Auto-stop after 3 minutes
    rec.autoStop = setTimeout(() => {
      try { if (rec.active) stopRecording(); } catch (_) {}
    }, 3 * 60 * 1000);

    media.start(250);
  } catch (e) {
    console.warn(e);
    toast('Messages', 'Microphone permission denied or unavailable.');
    try { rec.stream?.getTracks?.().forEach(t => t.stop()); } catch (_) {}
    rec = { active:false, stream:null, media:null, chunks:[], startedAt:0, timer:null, autoStop:null };
    clearRecTimer();
    setRecordingUI(false);
  }
}

function stopRecording() {
  if (!rec.active) return;
  rec.active = false;
  try { if (rec.autoStop) clearTimeout(rec.autoStop); } catch {}
  rec.autoStop = null;
  try { rec.media?.stop(); } catch (_) {
    try { rec.stream?.getTracks?.().forEach(t => t.stop()); } catch {};
    clearRecTimer();
    setRecordingUI(false);
  }
}

micBtn?.addEventListener('click', () => {
  if (rec.active) stopRecording();
  else startRecording();
});

// Hint: MediaRecorder requires HTTPS (GitHub Pages is OK). If opened via http:// or file:// mic will not work.
document.getElementById('dm-input')?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('dm-input');
    const t = input?.value || '';
    if (input) input.value = '';
    try { await sendTextMessage(t); }
    catch (err) { console.warn(err); toast('Messages', 'Message failed to send.'); }
  }
});

// Some mobile browsers can be finicky with input events depending on keyboard / autofill.
// Listen to a few related events to ensure the user list always filters as you type.
(() => {
  const el = document.getElementById('dm-user-search');
  if (!el) return;
  const handler = () => {
    try {
      // Keep results visible from the top when filtering.
      document.getElementById('dm-user-list')?.scrollTo?.({ top: 0, behavior: 'auto' });
    } catch {}
    renderUserList();
  };
  ['input', 'keyup', 'change', 'search'].forEach(evt => el.addEventListener(evt, handler));
})();

document.getElementById('dm-back-users')?.addEventListener('click', () => setMobileScreen('list'));
document.getElementById('dm-users-btn')?.addEventListener('click', () => setMobileScreen('list'));
window.addEventListener('resize', () => setMobileScreen(isMobileLayout() ? (dm.toKey ? 'chat' : 'list') : 'list'));

async function startApp() {
  // Load current user (fresh)
  currentUser = await getApproverByKey(currentUser.key);
  if (!currentUser) { doLogout(); return; }

  dm.userKey = String(currentUser.key);
  dm.userName = String(currentUser.Name || currentUser.Email || currentUser.Mobile || 'User').trim();

  // Load approvers list
  const data = await loadApprovers();
  dm.users = Object.entries(data).map(([key, rec]) => ({ key, ...rec })).filter(x => x && x.key);

  // UI
  document.getElementById('me-pill').textContent = `${dm.userName} (${currentUser.Email || currentUser.Mobile || ''})`;
  showScreen('chat');

  // Default mobile layout
  setMobileScreen(isMobileLayout() ? 'list' : 'list');

  // Subscriptions
  subscribePresence();
  subscribeUnread();
  subscribeInbox();

  setChatHeader();
  renderUserList();
}

// Session restore
(async function boot() {
  const savedKey = localStorage.getItem('approverKey');
  if (!savedKey) return;

  try {
    const u = await getApproverByKey(savedKey);
    if (u && u.Password) {
      currentUser = u;
      await startApp();
    } else {
      localStorage.removeItem('approverKey');
    }
  } catch (e) {
    console.warn('Boot restore failed:', e);
  }
})();
