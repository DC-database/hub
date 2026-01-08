// IBA Messages - standalone (1.0.0)
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

const DM_PRESENCE_ROOT = 'presence';
const DM_INBOX_ROOT    = 'dm_inbox';
const DM_THREADS_ROOT  = 'dm_threads';
const DM_UNREAD_ROOT   = 'dm_unread';

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
  return String(v || '').replace(/\D/g, '');
}

function safeText(t) {
  return String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
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

function renderUserList() {
  const list = document.getElementById('dm-user-list');
  if (!list) return;

  const q = (document.getElementById('dm-user-search')?.value || '').trim().toLowerCase();

  const users = dm.users
    .filter(u => u.key !== dm.userKey)
    .filter(u => !q || String(u.Name || '').toLowerCase().includes(q) || String(u.Email || '').toLowerCase().includes(q) || normalizeMobile(u.Mobile).includes(normalizeMobile(q)));

  list.innerHTML = '';

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
  } catch {}
  dm.threadMessagesRef = null;
  dm.onThreadMsg = null;
}

function renderMessage(m) {
  const msgList = document.getElementById('dm-message-list');
  if (!msgList) return;

  const text = safeText(m?.text || '');
  if (!text) return;

  // remove empty state
  document.getElementById('dm-empty-state')?.remove();

  const isMe = String(m.fromKey || '') === dm.userKey;

  const el = document.createElement('div');
  el.className = `dm-msg ${isMe ? 'me' : ''}`;
  el.innerHTML = `
    <div>${escapeHtml(text)}</div>
    <div class="dm-ts">${escapeHtml(formatChatTime(m.ts))}</div>
  `;
  msgList.appendChild(el);

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
  if (msgList) msgList.innerHTML = '';

  clearThreadListener();
  if (!dm.threadId) return;

  dm.threadMessagesRef = db.ref(`${DM_THREADS_ROOT}/${dm.threadId}/messages`).limitToLast(200);
  dm.onThreadMsg = (snap) => {
    const v = snap.val();
    if (v) renderMessage(v);
  };
  dm.threadMessagesRef.on('child_added', dm.onThreadMsg);

  try { document.getElementById('dm-input')?.focus(); } catch {}
}

async function sendMessage(text) {
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
    if (m && safeText(m.text)) toast(m.fromName || 'Message', m.text);
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
  try { await sendMessage(t); }
  catch (e) { console.warn(e); toast('Messages', 'Message failed to send.'); }
});

document.getElementById('dm-input')?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('dm-input');
    const t = input?.value || '';
    if (input) input.value = '';
    try { await sendMessage(t); }
    catch (err) { console.warn(err); toast('Messages', 'Message failed to send.'); }
  }
});

document.getElementById('dm-user-search')?.addEventListener('input', renderUserList);

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
