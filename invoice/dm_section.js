// DIRECT MESSAGES (DM) — SIMPLE 1:1 IN-APP CHAT + ONLINE STATUS + OFFLINE INBOX
// - Works without Firebase Auth (your rules currently allow reads/writes).
// - If recipient is online (system open) → instant pop-up.
// - If recipient is offline → delivered from inbox once they login.
// - UI entry points added to: WorkDesk + Invoice Management + Inventory.
// ============================================================================

const DM_PRESENCE_ROOT = 'presence';
const DM_INBOX_ROOT = 'dm_inbox';
const DM_THREADS_ROOT = 'dm_threads';
const DM_UNREAD_ROOT = 'dm_unread';

let dmState = {
    initialized: false,
    userKey: null,
    userName: '',
    open: false,
    // current thread
    threadId: null,
    toKey: null,
    toName: '',
    // refs/listeners
    presenceRef: null,
    connectedRef: null,
    onConnected: null,
    heartbeatInterval: null,
    inboxRef: null,
    onInbox: null,
    unreadRef: null,
    onUnread: null,
    presenceListRef: null,
    onPresenceList: null,
    onPresenceChild: null,
    onPresenceRemoved: null,
    threadMessagesRef: null,
    onThreadMsg: null,
    // caches
    presenceCache: {},
    unreadCache: {},
    // ui
    mobileScreen: 'list',
};

function dmIsMobile() {
    // Mobile mode should activate when the viewport is too small for split-view,
    // and on tablets/phones (even when "Request Desktop Site" is enabled).
    try {
        const w = window.innerWidth || document.documentElement.clientWidth || 1024;
        const mq = window.matchMedia ? window.matchMedia.bind(window) : null;

        const isVeryNarrow = mq ? mq('(max-width: 760px)').matches : (w <= 760);
        if (isVeryNarrow) return true;

        const isTabletWidth = mq ? mq('(max-width: 1024px)').matches : (w <= 1024);
        const isCoarse = mq ? mq('(pointer: coarse)').matches : false;
        const maxTouch = (typeof navigator !== 'undefined' && navigator && typeof navigator.maxTouchPoints === 'number')
            ? navigator.maxTouchPoints
            : 0;
        const ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent) ? navigator.userAgent : '';
        const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);

        return isTabletWidth && (isCoarse || maxTouch > 0 || isMobileUA);
    } catch (_) {
        return (window.innerWidth || 1024) <= 760;
    }
}

function dmSetMobileScreen(screen) {
    dmState.mobileScreen = (screen === 'chat') ? 'chat' : 'list';
    const card = document.querySelector('#dm-modal .dm-card');
    if (!card) return;

    const isMob = dmIsMobile();
    card.classList.toggle('dm-mobile', isMob);
    card.classList.toggle('dm-mobile-list', isMob && dmState.mobileScreen === 'list');
    card.classList.toggle('dm-mobile-chat', isMob && dmState.mobileScreen === 'chat');

    const backBtn = document.getElementById('dm-back-users');
    if (backBtn) {
        backBtn.style.display = (isMob && dmState.mobileScreen === 'chat') ? 'inline-flex' : 'none';
    }
}

function dmGetThreadId(aKey, bKey) {
    const a = String(aKey || '').trim();
    const b = String(bKey || '').trim();
    if (!a || !b) return '';
    return (a < b) ? `${a}__${b}` : `${b}__${a}`;
}

function dmSafeText(t) {
    return String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
}

function dmEnsureInlineStyles() {
    // Minimal fallback styles (full styles also exist in style.css).
    if (document.getElementById('dm-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'dm-inline-style';
    style.textContent = `
.dm-hidden{display:none !important}

/* Toast */
.dm-toast-wrap{position:fixed;right:18px;top:18px;z-index:999999;display:flex;flex-direction:column;gap:10px;max-width:min(420px,calc(100vw - 36px))}
.dm-toast{background:rgba(20,20,24,.88);color:#fff;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:16px;padding:12px 14px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
.dm-toast b{display:block;margin-bottom:4px}

/* Modal */
.dm-modal{position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.34);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.dm-card{width:min(1040px,calc(100vw - 28px));height:min(720px,calc(100vh - 28px));border-radius:22px;overflow:hidden;
  background:linear-gradient(180deg,rgba(28,28,34,.92),rgba(16,16,18,.82));
  border:1px solid rgba(255,255,255,.14);box-shadow:0 26px 110px rgba(0,0,0,.55);color:#fff;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif}
.dm-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.10)}
.dm-header .dm-title{font-weight:850;letter-spacing:.2px;display:flex;align-items:center;gap:10px}
.dm-close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;opacity:.9}
.dm-close:hover{opacity:1}

.dm-body{display:grid;grid-template-columns:360px 1fr;height:calc(100% - 58px);min-height:0}

/* Users */
.dm-users{border-right:1px solid rgba(255,255,255,.10);display:flex;flex-direction:column;min-height:0}
.dm-search-wrap{display:flex;align-items:center;gap:10px;margin:12px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);padding:10px 12px}
.dm-search-wrap i{opacity:.8}
.dm-users input{flex:1;border:0;background:transparent;color:#fff;outline:none;padding:0;margin:0}
.dm-user-list{flex:1;overflow:auto;padding:6px 8px 12px 8px}
.dm-user{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border-radius:16px;cursor:pointer;user-select:none}
.dm-user:hover{background:rgba(255,255,255,.08)}
.dm-user.active{background:rgba(255,255,255,.12)}
.dm-user .dm-left{display:flex;align-items:center;gap:12px;min-width:0}
.dm-avatar{width:38px;height:38px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);font-weight:800;letter-spacing:.4px;flex:0 0 auto;position:relative}
.dm-dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:999px;background:rgba(255,255,255,.30);border:2px solid rgba(18,18,20,.95)}
.dm-dot.online{background:#27c46b}
.dm-name{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-meta{font-size:12px;opacity:.80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-badge{background:#e53935;color:#fff;border-radius:999px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;padding:0 7px}

/* Chat */
.dm-chat{display:flex;flex-direction:column;min-width:0;min-height:0}
.dm-chat-top{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.10);display:flex;align-items:center;justify-content:space-between;gap:12px}
.dm-chat-top-left{display:flex;align-items:center;gap:10px;min-width:0}
.dm-chat-ident{display:flex;align-items:center;gap:10px;min-width:0}
.dm-chat-avatar{width:36px;height:36px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);font-weight:850;flex:0 0 auto}
.dm-back{display:none;align-items:center;justify-content:center;width:36px;height:36px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer}
.dm-chat-top .dm-chat-title{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-chat-actions{display:flex;align-items:center;gap:8px}
.dm-action{display:inline-flex;align-items:center;gap:8px;border-radius:14px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);color:#fff;padding:9px 12px;cursor:pointer;font-weight:750}
.dm-action span{font-size:13px;opacity:.92}
.dm-action:hover{background:rgba(255,255,255,.09)}

.dm-message-list{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:0}
.dm-empty{margin:auto;max-width:440px;text-align:center;opacity:.86;padding:18px 16px;border-radius:18px;border:1px dashed rgba(255,255,255,.18);background:rgba(255,255,255,.04)}
.dm-empty-title{font-weight:900;margin-bottom:6px}
.dm-empty-sub{font-size:13px;opacity:.85}

.dm-msg{max-width:min(620px,92%);padding:10px 12px;border-radius:18px 18px 18px 8px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.07);line-height:1.35}
.dm-msg.me{align-self:flex-end;border-radius:18px 18px 8px 18px;background:rgba(90,160,255,.20)}
.dm-msg .dm-ts{font-size:11px;opacity:.72;margin-top:6px;text-align:right}

.dm-compose{display:flex;gap:10px;align-items:center;padding:12px 14px;border-top:1px solid rgba(255,255,255,.10)}
.dm-compose input{flex:1;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;padding:12px 12px;outline:none}
.dm-compose button{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.dm-compose button:hover{background:rgba(255,255,255,.18)}

/* Mobile: WhatsApp-style list <-> chat with Back (touch devices only; controlled by dm-mobile class) */
@media (max-width: 820px){
  .dm-toast-wrap{left:14px;right:14px;top:14px;max-width:none}
  .dm-card.dm-mobile{width:100vw;height:100vh;border-radius:0}
  .dm-card.dm-mobile .dm-body{grid-template-columns:1fr}
  .dm-card.dm-mobile.dm-mobile-list .dm-chat{display:none}
  .dm-card.dm-mobile.dm-mobile-chat .dm-users{display:none}
  .dm-card.dm-mobile .dm-back{display:inline-flex}
}
`;
    document.head.appendChild(style);
}

function dmEnsureUI() {
    dmEnsureInlineStyles();

    if (!document.getElementById('dm-toast-wrap')) {
        const toastWrap = document.createElement('div');
        toastWrap.id = 'dm-toast-wrap';
        toastWrap.className = 'dm-toast-wrap';
        document.body.appendChild(toastWrap);
    }

    if (document.getElementById('dm-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'dm-modal';
    modal.className = 'dm-modal dm-hidden';
    modal.innerHTML = `
<div class="dm-card" role="dialog" aria-modal="true">
  <div class="dm-header">
    <div class="dm-title"><i class="fa-solid fa-comments"></i> Messages</div>
    <button class="dm-close" id="dm-close" title="Close">&times;</button>
  </div>
  <div class="dm-body">
    <aside class="dm-users" aria-label="Users">
      <div class="dm-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="dm-user-search" type="text" placeholder="Search..." />
      </div>
      <div class="dm-user-list" id="dm-user-list"></div>
    </aside>
    <section class="dm-chat" aria-label="Chat">
      <div class="dm-chat-top">
        <div class="dm-chat-top-left">
          <button id="dm-back-users" class="dm-back" type="button" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="dm-chat-ident">
            <div class="dm-chat-avatar" id="dm-chat-avatar">?</div>
            <div style="min-width:0;">
              <div class="dm-chat-title" id="dm-chat-title">Select a user</div>
              <div class="dm-meta" id="dm-chat-status"></div>
            </div>
          </div>
        </div>
        <div class="dm-chat-actions">
          <button id="dm-users-btn" class="dm-action" type="button" title="Users">
            <i class="fa-solid fa-users"></i><span>Users</span>
          </button>
        </div>
      </div>
      <div class="dm-message-list" id="dm-message-list">
        <div class="dm-empty" id="dm-empty-state">
          <div class="dm-empty-title">No conversation selected</div>
          <div class="dm-empty-sub">Pick a user from the list to start chatting.</div>
        </div>
      </div>
      <div class="dm-compose">
        <input id="dm-input" type="text" placeholder="Message..." autocomplete="off" />
        <button id="dm-send" type="button" title="Send">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </section>
  </div>
</div>
`;

    document.body.appendChild(modal);

    // Close actions
    modal.addEventListener('click', (e) => {
        if (e.target === modal) dmClose();
    });
    document.getElementById('dm-close')?.addEventListener('click', dmClose);
    document.addEventListener('keydown', (e) => {
        if (dmState.open && e.key === 'Escape') dmClose();
    });

    // Send
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');
    sendBtn?.addEventListener('click', () => dmSendCurrent());
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dmSendCurrent();
        }
    });

    // Search
    const search = document.getElementById('dm-user-search');
    search?.addEventListener('input', () => dmRenderUserList());

    // Mobile back (WhatsApp-like: Users list ↔ Chat)
    document.getElementById('dm-back-users')?.addEventListener('click', () => {
        dmSetMobileScreen('list');
        try { document.getElementById('dm-user-search')?.focus(); } catch (_) { /* ignore */ }
    });

// Users button (desktop + mobile): always brings you back to the user list.
document.getElementById('dm-users-btn')?.addEventListener('click', () => {
    dmSetMobileScreen('list');
    try { document.getElementById('dm-user-search')?.focus(); } catch (_) { /* ignore */ }
});


    // Keep layout correct on rotate / resize
    window.addEventListener('resize', () => {
        if (!dmState.open) return;
        dmSetMobileScreen(dmState.mobileScreen);
    });
}

function dmToast(fromName, text) {
    dmEnsureUI();
    const wrap = document.getElementById('dm-toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'dm-toast';
    el.innerHTML = `<b>${escapeHtml(fromName || 'Message')}</b><div>${escapeHtml(text || '')}</div>`;
    wrap.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 260ms ease';
        setTimeout(() => el.remove(), 280);
    }, 3800);
}

function dmOpen() {
    dmEnsureUI();
    const modal = document.getElementById('dm-modal');
    if (!modal) return;
    modal.classList.remove('dm-hidden');
    dmState.open = true;
    dmSetMobileScreen('list');
    try { dmSubscribePresenceList(); } catch (_) { /* ignore */ }
    // Ensure approver list is loaded so the user picker isn't empty.
    try {
        const cached = getCachedApproversData();
        if (!cached || (typeof cached === 'object' && Object.keys(cached).length === 0)) {
            ensureApproverDataCached(true).then(() => {
                if (dmState.open) dmRenderUserList();
            });
        }
    } catch (_) { /* ignore */ }
    dmRenderUserList();
    setTimeout(() => {
        try {
            if (!dmState.open) return;
            if (dmIsMobile() && dmState.mobileScreen === 'list') {
                document.getElementById('dm-user-search')?.focus();
            }
        } catch (_) { /* ignore */ }
    }, 0);
}

function dmClose() {
    const modal = document.getElementById('dm-modal');
    if (modal) modal.classList.add('dm-hidden');
    dmState.open = false;
    try { dmUnsubscribePresenceList(); } catch (_) { /* ignore */ }
    dmSetMobileScreen('list');
}

function dmGetApproversList() {
    const data = getApproversDataSafe();
    if (!data) return [];
    const list = [];
    for (const key of Object.keys(data)) {
        const a = data[key];
        if (!a) continue;
        const name = String(a.Name || '').trim();
        if (!name) continue;
        // Hide self
        if (dmState.userKey && key === dmState.userKey) continue;
        list.push({
            key,
            name,
            position: String(a.Position || ''),
            role: String(a.Role || ''),
            site: String(a.Site || '')
        });
    }
    // Sort by online first then name
    list.sort((x, y) => {
        const xOn = !!(dmState.presenceCache?.[x.key]?.status === 'online');
        const yOn = !!(dmState.presenceCache?.[y.key]?.status === 'online');
        if (xOn !== yOn) return xOn ? -1 : 1;
        return x.name.localeCompare(y.name);
    });
    return list;
}

function dmTotalUnreadCount() {
    let total = 0;
    const u = dmState.unreadCache || {};
    for (const tid of Object.keys(u)) {
        const c = Number(u[tid]?.count || 0);
        if (c > 0) total += c;
    }
    return total;
}

function dmUpdateBadges() {
    const total = dmTotalUnreadCount();
    document.querySelectorAll('.dm-unread-badge').forEach(b => {
        if (!b) return;
        b.textContent = String(total);
        b.style.display = total > 0 ? 'inline-flex' : 'none';
    });
}

function dmInitials(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const parts = s.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '').charAt(0);
    const b = (parts[1] || '').charAt(0);
    const out = (a + b).toUpperCase();
    return out || s.charAt(0).toUpperCase();
}

function dmRenderUserList() {
    const listEl = document.getElementById('dm-user-list');
    if (!listEl) return;

    const q = String(document.getElementById('dm-user-search')?.value || '').trim().toLowerCase();
    const users = dmGetApproversList().filter(u => {
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || (u.position || '').toLowerCase().includes(q);
    });

    listEl.innerHTML = '';
    if (!users.length) {
        listEl.innerHTML = `<div style="padding:14px;opacity:.8;">No users found.</div>`;
        return;
    }

    for (const u of users) {
        const pres = dmState.presenceCache?.[u.key] || {};
        const isOnline = pres.status === 'online';
        const threadId = dmGetThreadId(dmState.userKey, u.key);
        const unreadObj = dmState.unreadCache?.[threadId] || {};
        const unread = Number(unreadObj?.count || 0);
        const lastText = dmSafeText(unreadObj?.lastText || '');
        const lastTs = Number(unreadObj?.lastTs || 0);

        const metaText = lastText ? lastText : String((u.position || '').trim() || (u.site ? ('Site ' + u.site) : ''));
        const metaTime = lastTs ? formatChatTime(lastTs) : '';
        const active = dmState.toKey && dmState.toKey === u.key;

        const row = document.createElement('div');
        row.className = `dm-user${active ? ' active' : ''}`;
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        const initials = dmInitials(u.name);

        row.innerHTML = `
          <div class="dm-left">
            <div class="dm-avatar" aria-hidden="true">
              ${escapeHtml(initials)}
              <span class="dm-dot ${isOnline ? 'online' : ''}"></span>
            </div>
            <div style="min-width:0;">
              <div class="dm-name">${escapeHtml(u.name)}</div>
              <div class="dm-meta">${escapeHtml(metaText)}</div>
            </div>
          </div>
          ${unread > 0 ? `<div class="dm-badge">${unread}</div>` : (metaTime ? `<div class="dm-meta">${escapeHtml(metaTime)}</div>` : ``)}
        `;

        const open = () => dmOpenThread(u.key, u.name);
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });

        listEl.appendChild(row);
    }

    dmUpdateBadges();
}

function dmSetChatHeader() {
    const titleEl = document.getElementById('dm-chat-title');
    const statusEl = document.getElementById('dm-chat-status');
    const avatarEl = document.getElementById('dm-chat-avatar');
    if (!titleEl || !statusEl) return;

    if (!dmState.toKey) {
        titleEl.textContent = 'Select a user';
        statusEl.textContent = '';
        if (avatarEl) avatarEl.textContent = '?';
        return;
    }

    titleEl.textContent = dmState.toName || 'Chat';
    if (avatarEl) avatarEl.textContent = dmInitials(dmState.toName || '');

    const pres = dmState.presenceCache?.[dmState.toKey];
    const isOnline = pres && pres.status === 'online';
    if (isOnline) {
        statusEl.textContent = 'Online';
    } else {
        const lastSeen = Number(pres?.lastSeen || 0);
        statusEl.textContent = lastSeen ? (`Offline • last seen ${formatChatTime(lastSeen)}`) : 'Offline';
    }
}

function dmClearThreadListener() {
    try {
        if (dmState.threadMessagesRef && dmState.onThreadMsg) {
            dmState.threadMessagesRef.off('child_added', dmState.onThreadMsg);
        }
    } catch (_) { /* ignore */ }
    dmState.threadMessagesRef = null;
    dmState.onThreadMsg = null;
}

function dmOpenThread(toKey, toName) {
    dmEnsureUI();

    // If the modal is already open, do NOT re-run dmOpen() (it can reset layout & feel "stuck" on desktop).
    if (!dmState.open) dmOpen();

    dmState.toKey = String(toKey || '').trim();
    dmState.toName = String(toName || '').trim();
    dmState.threadId = dmGetThreadId(dmState.userKey, dmState.toKey);

    dmSetChatHeader();
    dmRenderUserList(); // update active highlight

    // Mobile (touch) mode: switch to chat view immediately (WhatsApp-like)
    dmSetMobileScreen('chat');
    try { document.getElementById('dm-input')?.focus(); } catch (_) { /* ignore */ }

    // mark read
    if (dmState.threadId) {
        db.ref(`${DM_UNREAD_ROOT}/${dmState.userKey}/${dmState.threadId}`).remove().catch(() => {});
    }

    // clear list and subscribe
    const msgList = document.getElementById('dm-message-list');
    if (msgList) {
        msgList.innerHTML = '';
        msgList.scrollTop = msgList.scrollHeight;
    }

    dmClearThreadListener();
    if (!dmState.threadId) return;

    dmState.threadMessagesRef = db.ref(`${DM_THREADS_ROOT}/${dmState.threadId}/messages`).limitToLast(200);
    dmState.onThreadMsg = (snap) => {
        const m = snap.val();
        if (!m) return;
        dmRenderMessage(m);
    };
    dmState.threadMessagesRef.on('child_added', dmState.onThreadMsg);
}

function dmRenderMessage(m) {
    const msgList = document.getElementById('dm-message-list');
    if (!msgList) return;

    const fromKey = String(m.fromKey || '');
    const isMe = (fromKey === dmState.userKey);
    const text = dmSafeText(m.text || '');
    if (!text) return;

    const el = document.createElement('div');
    el.className = `dm-msg ${isMe ? 'me' : ''}`;
    const ts = m.ts && typeof m.ts === 'number' ? m.ts : null;
    el.innerHTML = `
      <div>${escapeHtml(text)}</div>
      <div class="dm-ts">${escapeHtml(formatChatTime(ts))}</div>
    `;
    msgList.appendChild(el);

    // Auto scroll if near bottom
    const nearBottom = (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight) < 120;
    if (nearBottom) msgList.scrollTop = msgList.scrollHeight;
}

function dmSendCurrent() {
    if (!dmState.toKey || !dmState.threadId) {
        dmToast('Messages', 'Select a user first.');
        return;
    }
    const input = document.getElementById('dm-input');
    const text = dmSafeText(input?.value || '');
    if (!text) return;
    if (input) input.value = '';
    dmSendMessage(dmState.toKey, dmState.toName, text);
}

async function dmSendMessage(toKey, toName, text) {
    const fromKey = dmState.userKey;
    const fromName = dmState.userName;
    const threadId = dmGetThreadId(fromKey, toKey);
    if (!fromKey || !toKey || !threadId) return;

    const msgId = db.ref(`${DM_THREADS_ROOT}/${threadId}/messages`).push().key;
    const msg = {
        fromKey,
        fromName,
        toKey,
        toName: String(toName || '').trim(),
        text: dmSafeText(text),
        ts: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${fromKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/participants/${toKey}`] = true;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${fromKey}`] = fromName;
    updates[`${DM_THREADS_ROOT}/${threadId}/names/${toKey}`] = String(toName || '').trim();
    updates[`${DM_THREADS_ROOT}/${threadId}/messages/${msgId}`] = msg;
    updates[`${DM_INBOX_ROOT}/${toKey}/${msgId}`] = msg;

    try {
        await db.ref().update(updates);
        // Unread counters for recipient
        const base = db.ref(`${DM_UNREAD_ROOT}/${toKey}/${threadId}`);
        base.child('count').transaction(c => (Number(c) || 0) + 1);
        base.child('lastText').set(msg.text);
        base.child('lastTs').set(firebase.database.ServerValue.TIMESTAMP);
        base.child('fromName').set(fromName);
        base.child('fromKey').set(fromKey);
    } catch (e) {
        console.warn('DM send failed:', e);
        dmToast('Messages', 'Message failed to send (check rules / connection).');
    }
}

function dmInjectMessagesButtons() {
    // One Messages entry per sidebar (avoid duplicates).
    // The WorkDesk/IM/Inventory nav becomes the mobile bottom bar on small screens.
    const targets = [
        { ul: document.querySelector('#workdesk-nav ul'), id: 'dm-wd-link', liClass: 'wd-nav-messages-mobile' },
        { ul: document.querySelector('#im-nav ul'),       id: 'dm-im-link', liClass: 'im-nav-messages-mobile' },
        { ul: document.querySelector('#inv-nav ul'),      id: 'dm-inv-link', liClass: 'inv-nav-messages-mobile' },
    ];

    for (const t of targets) {
        if (!t.ul) continue;
        if (t.ul.querySelector(`#${t.id}`)) continue;

        const li = document.createElement('li');
        if (t.liClass) li.className = t.liClass;
        li.innerHTML = `
          <a href="#" id="${t.id}" class="dm-messages-link">
            <i class="fa-solid fa-comments"></i> Messages
            <span class="notification-badge dm-unread-badge" style="display:none; margin-left:8px;">0</span>
          </a>
        `;

        // Insert before logout if possible
        const logoutLi = Array.from(t.ul.children).find(x => (x.textContent || '').toLowerCase().includes('logout'));
        if (logoutLi) t.ul.insertBefore(li, logoutLi);
        else t.ul.appendChild(li);

        li.querySelector('a')?.addEventListener('click', (e) => {
            e.preventDefault();
            dmOpen();
        });
    }

    dmUpdateBadges();
}

function dmStartPresence() {
    if (!dmState.userKey) return;
    dmState.connectedRef = db.ref('.info/connected');
    dmState.onConnected = (snap) => {
        if (snap.val() !== true) return;
        dmState.presenceRef = db.ref(`${DM_PRESENCE_ROOT}/${dmState.userKey}`);
        const offlinePayload = {
            name: dmState.userName,
            status: 'offline',
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        };
        dmState.presenceRef.onDisconnect().set(offlinePayload);
        dmState.presenceRef.set({
            name: dmState.userName,
            status: 'online',
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    };
    dmState.connectedRef.on('value', dmState.onConnected);

    if (dmState.heartbeatInterval) clearInterval(dmState.heartbeatInterval);
    // Heartbeat keeps your "online" status fresh. Slower interval = less mobile data.
    dmState.heartbeatInterval = setInterval(() => {
        if (dmState.presenceRef) {
            dmState.presenceRef.update({ status: 'online', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
    }, 120_000);

    window.addEventListener('beforeunload', () => {
        try {
            dmState.presenceRef?.update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        } catch (_) { /* ignore */ }
    });

    // NOTE: We subscribe to the presence list only while the Messages window is open.
    // This reduces background downloads on mobile.
}

function dmSubscribePresenceList() {
    if (dmState.presenceListRef) return;
    dmState.presenceCache = dmState.presenceCache || {};
    dmState.presenceListRef = db.ref(DM_PRESENCE_ROOT);

    const onChild = (snap) => {
        dmState.presenceCache[snap.key] = snap.val() || {};
        if (dmState.open) dmRenderUserList();
        dmSetChatHeader();
    };
    const onRemoved = (snap) => {
        try { delete dmState.presenceCache[snap.key]; } catch (_) { /* ignore */ }
        if (dmState.open) dmRenderUserList();
        dmSetChatHeader();
    };

    dmState.onPresenceChild = onChild;
    dmState.onPresenceRemoved = onRemoved;

    dmState.presenceListRef.on('child_added', onChild);
    dmState.presenceListRef.on('child_changed', onChild);
    dmState.presenceListRef.on('child_removed', onRemoved);
}

function dmUnsubscribePresenceList() {
    try {
        if (!dmState.presenceListRef) return;
        if (dmState.onPresenceChild) {
            dmState.presenceListRef.off('child_added', dmState.onPresenceChild);
            dmState.presenceListRef.off('child_changed', dmState.onPresenceChild);
        }
        if (dmState.onPresenceRemoved) {
            dmState.presenceListRef.off('child_removed', dmState.onPresenceRemoved);
        }
    } catch (_) { /* ignore */ }
    dmState.presenceListRef = null;
    dmState.onPresenceChild = null;
    dmState.onPresenceRemoved = null;
}

function dmSubscribeInbox() {
    if (!dmState.userKey) return;
    dmState.inboxRef = db.ref(`${DM_INBOX_ROOT}/${dmState.userKey}`).limitToLast(50);
    dmState.onInbox = (snap) => {
        const m = snap.val();
        if (!m) return;
        const fromName = String(m.fromName || m.from || 'Message');
        const text = dmSafeText(m.text || '');
        if (text) dmToast(fromName, text);

        // remove from inbox to avoid duplicates
        snap.ref.remove().catch(() => {});
    };
    dmState.inboxRef.on('child_added', dmState.onInbox);
}

function dmSubscribeUnread() {
    if (!dmState.userKey) return;
    dmState.unreadRef = db.ref(`${DM_UNREAD_ROOT}/${dmState.userKey}`);
    dmState.onUnread = (snap) => {
        dmState.unreadCache = snap.val() || {};
        dmUpdateBadges();
        if (dmState.open) dmRenderUserList();
    };
    dmState.unreadRef.on('value', dmState.onUnread);
}

function initDirectMessages() {
    if (dmState.initialized) return;
    if (!currentApprover || !currentApprover.key) return;

    dmState.userKey = String(currentApprover.key);
    dmState.userName = String(currentApprover.Name || currentApprover.Username || currentApprover.Email || 'User').trim();
    dmState.initialized = true;

    // Preload approvers so the user list can render immediately.
    try {
        ensureApproverDataCached(false).then(() => {
            if (dmState.open) dmRenderUserList();
        });
    } catch (_) { /* ignore */ }

    // If an older "Live Chat" bubble exists in the DOM from previous versions,
    // hide it to avoid confusion (DM is the supported chat feature).
    try {
        document.getElementById('live-chat-fab')?.classList.add('hidden');
        document.getElementById('live-chat-panel')?.classList.add('hidden');
    } catch (_) { /* ignore */ }

    try { dmEnsureUI(); } catch (_) {}
    try { dmInjectMessagesButtons(); } catch (_) {}
    try { dmStartPresence(); } catch (e) { console.warn('DM presence init failed:', e); }
    try { dmSubscribeUnread(); } catch (e) { console.warn('DM unread init failed:', e); }
    try { dmSubscribeInbox(); } catch (e) { console.warn('DM inbox init failed:', e); }
}

function shutdownDirectMessages() {
    try {
        dmClearThreadListener();
        if (dmState.heartbeatInterval) {
            clearInterval(dmState.heartbeatInterval);
            dmState.heartbeatInterval = null;
        }
        if (dmState.presenceRef) {
            dmState.presenceRef.update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
        if (dmState.connectedRef && dmState.onConnected) dmState.connectedRef.off('value', dmState.onConnected);
        if (dmState.inboxRef && dmState.onInbox) dmState.inboxRef.off('child_added', dmState.onInbox);
        if (dmState.unreadRef && dmState.onUnread) dmState.unreadRef.off('value', dmState.onUnread);
        dmUnsubscribePresenceList();
    } catch (e) {
        console.warn('DM shutdown warning:', e);
    }
}

