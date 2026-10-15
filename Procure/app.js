// ==========================================
// FIREBASE: requisition-bf146 only
// items, requisitions, access, and app settings
// ==========================================
const firebaseConfigReq = {
    apiKey: "AIzaSyCxQKz3MOzyyKsJQhB54ZO1EKH_9QPkI44",
    authDomain: "requisition-bf146.firebaseapp.com",
    databaseURL: "https://requisition-bf146-default-rtdb.firebaseio.com",
    projectId: "requisition-bf146",
    storageBucket: "requisition-bf146.firebasestorage.app",
    messagingSenderId: "419583502521",
    appId: "1:419583502521:web:4eb33209e0f645f3145368",
    measurementId: "G-D60S6XVEGQ"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfigReq); }
const dbReq = firebase.database(); 

// ==========================================
// URLs & GLOBALS
// ==========================================
const ITEMS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Item.csv";
const CLASS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/class.csv";
const GROUP_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/group.csv";
const VENDORS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Vendors.csv";
const SITE_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Site.csv";

let allSearchableItems = []; let allVendors = []; let allSites = [];
let cart = []; let legacyItems = []; let dynamicActivityData = {};
let activitiesMap = {};
let classByCode = {};
let classesByActivity = {};   // activity code ("1".."5") -> [class entries]
let activityList = [];        // [{ code, name, label }] sorted 1..5
let allGroups = [];
let groupsByCode = {};
let lookupRows = { activities: [], groups: [], vendors: [], sites: [] }; // raw GitHub rows, kept for cache writes
let sessionNewlyCreatedItems = [];

let selectedVendor = { id: '', name: '' }; let selectedSite = { code: '', name: '' };

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ==========================================
// USER ACCESS (stored in requisition Firebase)
// ==========================================
const ACCESS_PATH = 'appAccess/users';
const ACCESS_SESSION_PATH = 'appAccess/sessions';
const ACCESS_SESSION_KEY = 'pr_access_session_v1';
const SUPER_ADMIN = { name: 'irwin', mobile: '50992023' };
let currentAccessUser = null;

function normalizeMobile(value) {
    return String(value || '').replace(/\D/g, '');
}

function accessUserKey(mobile) {
    return normalizeMobile(mobile) || '';
}

function accessFlag(value) {
    if (value === true || value === 1) return true;
    const text = String(value ?? '').trim().toLowerCase();
    return text === 'true' || text === 'yes' || text === '1' || text === 'y';
}

function normalizeAccessRecord(key, raw) {
    const row = raw || {};
    const name = String(row.name || row.Name || row['full name'] || row['Full name'] || '').trim();
    const mobile = String(row.mobile || row['mobile number'] || row.mobileNumber || row.Mobile || row['Mobile number'] || key || '').trim();
    const canAdd = accessFlag(row.add ?? row.Add ?? row.canAdd);
    const canEdit = accessFlag(row.edit ?? row.Edit ?? row.canEdit);
    const canDelete = accessFlag(row.delete ?? row.Delete ?? row.canDelete);
    const canPhoto = accessFlag(row.photo ?? row.Photo ?? row.canPhoto);
    const isAdmin = accessFlag(row.admin ?? row.isAdmin ?? row.Admin) || (canAdd && canEdit && canDelete);
    return { key, name, mobile, canAdd, canEdit, canDelete, canPhoto, isAdmin };
}

function isSuperAdminIdentity(name, mobile) {
    return String(name || '').trim().toLowerCase() === SUPER_ADMIN.name
        && normalizeMobile(mobile) === SUPER_ADMIN.mobile;
}

function superAdminRecord() {
    return {
        key: SUPER_ADMIN.mobile,
        name: 'irwin',
        mobile: SUPER_ADMIN.mobile,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canPhoto: true,
        isAdmin: true
    };
}

function findAccessMatch(users, name, mobile) {
    const wantName = String(name || '').trim().toLowerCase();
    const wantMobile = normalizeMobile(mobile);
    if (!wantName || !wantMobile) return null;
    if (isSuperAdminIdentity(wantName, wantMobile)) return superAdminRecord();
    for (const key of Object.keys(users || {})) {
        const user = normalizeAccessRecord(key, users[key]);
        if (user.name.toLowerCase() === wantName && normalizeMobile(user.mobile) === wantMobile) return user;
    }
    return null;
}

function findAccessByMobile(users, mobile) {
    const wantMobile = normalizeMobile(mobile);
    if (!wantMobile) return null;
    for (const key of Object.keys(users || {})) {
        const raw = users[key] || {};
        const user = normalizeAccessRecord(key, raw);
        if (normalizeMobile(user.mobile) === wantMobile) {
            return { ...user, password: String(raw.password || raw.Password || raw.pin || '') };
        }
    }
    if (wantMobile === SUPER_ADMIN.mobile) {
        return { ...superAdminRecord(), password: '' };
    }
    return null;
}

function passwordsMatch(stored, typed) {
    return String(stored || '') === String(typed || '');
}

function canAddItems() { return !!(currentAccessUser && (currentAccessUser.isAdmin || currentAccessUser.canAdd)); }
function canEditItems() { return !!(currentAccessUser && (currentAccessUser.isAdmin || currentAccessUser.canEdit)); }
function canDeleteItems() { return !!(currentAccessUser && (currentAccessUser.isAdmin || currentAccessUser.canDelete)); }
function canUpdatePhotos() { return !!(currentAccessUser && (currentAccessUser.isAdmin || currentAccessUser.canPhoto)); }
function isAccessAdmin() { return !!(currentAccessUser && currentAccessUser.isAdmin); }

function denyAccess(action) {
    alert('You do not have permission to ' + action + '. Sign in with an account that has this access.');
}

function saveAccessSession(user) {
    if (!user) {
        localStorage.removeItem(ACCESS_SESSION_KEY);
        sessionStorage.removeItem(ACCESS_SESSION_KEY);
        return;
    }
    const payload = JSON.stringify({
        key: user.key,
        mobile: user.mobile,
        name: user.name,
        sessionId: user.sessionId || ''
    });
    localStorage.setItem(ACCESS_SESSION_KEY, payload);
    sessionStorage.setItem(ACCESS_SESSION_KEY, payload);
}

function readAccessSession() {
    try {
        return JSON.parse(localStorage.getItem(ACCESS_SESSION_KEY) || sessionStorage.getItem(ACCESS_SESSION_KEY) || 'null');
    }
    catch (err) { return null; }
}

const TAB_LOCK_KEY = 'pr_hub_active_tab';
const TAB_ID = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let isPrimaryTab = true;

function readTabLock() {
    try { return JSON.parse(localStorage.getItem(TAB_LOCK_KEY) || 'null'); }
    catch (err) { return null; }
}

function claimTabLock() {
    const lock = readTabLock();
    const lockFresh = !!(lock && lock.id && (Date.now() - Number(lock.at || 0) < 10000));
    if (lockFresh && lock.id !== TAB_ID) {
        isPrimaryTab = false;
        return false;
    }
    try {
        localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ id: TAB_ID, at: Date.now() }));
        isPrimaryTab = true;
        return true;
    } catch (err) {
        isPrimaryTab = true;
        return true;
    }
}

claimTabLock();
setInterval(() => {
    if (isPrimaryTab) claimTabLock();
    else claimTabLock();
}, 4000);
window.addEventListener('beforeunload', () => {
    const lock = readTabLock();
    if (lock && lock.id === TAB_ID) localStorage.removeItem(TAB_LOCK_KEY);
});
window.addEventListener('storage', (e) => {
    if (e.key === ACCESS_SESSION_KEY) refreshCurrentAccessUser();
    if (e.key === TAB_LOCK_KEY) claimTabLock();
});

async function loadAccessUsers() {
    const snap = await dbReq.ref(ACCESS_PATH).once('value');
    return snap.exists() ? (snap.val() || {}) : {};
}

function applyAccessUI() {
    const label = document.getElementById('accessBtnLabel');
    if (label) label.textContent = currentAccessUser ? (currentAccessUser.name || 'Signed in') : 'Sign in';

    const settingsBtn = document.getElementById('openSettingsBtn');
    if (settingsBtn) settingsBtn.style.display = isAccessAdmin() ? '' : 'none';

    const createBtn = document.getElementById('openGeneratorBtn');
    if (createBtn) {
        createBtn.style.display = canAddItems() ? '' : 'none';
        createBtn.title = canAddItems() ? 'Create item' : 'Sign in with Add access to create items';
    }

    const adminSection = document.getElementById('userAccessSection');
    if (adminSection) adminSection.style.display = isAccessAdmin() ? '' : 'none';

    const importGithub = document.getElementById('importGithubItemsBtn');
    const importFile = document.getElementById('importFileItemsBtn');
    if (importGithub) importGithub.style.display = canAddItems() ? '' : 'none';
    if (importFile) importFile.style.display = canAddItems() ? '' : 'none';

    const signedBox = document.getElementById('accessSignedInBox');
    const loginBox = document.getElementById('accessLoginBox');
    const signedText = document.getElementById('accessSignedInText');
    if (currentAccessUser && signedBox && signedText) {
        const rights = [
            currentAccessUser.isAdmin ? 'Admin' : null,
            currentAccessUser.canAdd ? 'Add' : null,
            currentAccessUser.canEdit ? 'Edit' : null,
            currentAccessUser.canDelete ? 'Delete' : null,
            currentAccessUser.canPhoto ? 'Photo' : null
        ].filter(Boolean).join(', ') || 'Read only';
        signedText.textContent = `${currentAccessUser.name} · ${currentAccessUser.mobile} · ${rights}`;
        signedBox.style.display = '';
        if (loginBox) loginBox.style.display = 'none';
    } else if (signedBox) {
        signedBox.style.display = 'none';
        if (loginBox) loginBox.style.display = '';
    }

}

function renderAccessUserList(users) {
    const box = document.getElementById('accessUserList');
    if (!box) return;
    const list = Object.keys(users || {}).map((key) => normalizeAccessRecord(key, users[key]));
    if (!list.length) {
        box.textContent = 'No access users yet.';
        return;
    }
    box.innerHTML = list.map((user) => {
        const rights = [
            user.isAdmin ? 'Admin' : null,
            user.canAdd ? 'Add' : null,
            user.canEdit ? 'Edit' : null,
            user.canDelete ? 'Delete' : null,
            user.canPhoto ? 'Photo' : null
        ].filter(Boolean).join(' · ') || 'Read only';
        return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.12);">
            <div><strong>${user.name || 'User'}</strong><br>${user.mobile || user.key} · ${rights}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button type="button" class="ghost-btn" data-edit-access="${user.key}">Edit</button>
                <button type="button" class="ghost-btn" data-clear-pass="${user.key}">Clear password</button>
                <button type="button" class="ghost-btn" data-remove-access="${user.key}">Remove</button>
            </div>
        </div>`;
    }).join('');
    box.querySelectorAll('[data-edit-access]').forEach((btn) => {
        btn.onclick = () => {
            const key = btn.getAttribute('data-edit-access');
            const user = list.find((row) => row.key === key);
            if (!user) return;
            document.getElementById('accessNewName').value = user.name || '';
            document.getElementById('accessNewMobile').value = user.mobile || '';
            if (document.getElementById('accessNewPassword')) document.getElementById('accessNewPassword').value = '';
            document.getElementById('accessNewAdd').checked = !!user.canAdd;
            document.getElementById('accessNewEdit').checked = !!user.canEdit;
            document.getElementById('accessNewDelete').checked = !!user.canDelete;
            if (document.getElementById('accessNewPhoto')) document.getElementById('accessNewPhoto').checked = !!user.canPhoto;
            document.getElementById('accessNewAdmin').checked = !!user.isAdmin;
        };
    });
    box.querySelectorAll('[data-clear-pass]').forEach((btn) => {
        btn.onclick = async () => {
            const key = btn.getAttribute('data-clear-pass');
            if (!confirm('Clear this password? They can set a new one at next login.')) return;
            await dbReq.ref(ACCESS_PATH).child(key).update({ password: '', updatedAt: new Date().toISOString() });
            alert('Password cleared. They can enter a new password next time they sign in.');
        };
    });
    box.querySelectorAll('[data-remove-access]').forEach((btn) => {
        btn.onclick = async () => {
            const key = btn.getAttribute('data-remove-access');
            if (!confirm('Remove this user access?')) return;
            await dbReq.ref(ACCESS_PATH).child(key).remove();
            if (currentAccessUser && currentAccessUser.key === key) {
                currentAccessUser = null;
                saveAccessSession(null);
            }
            applyAccessUI();
            renderAccessUserList(await loadAccessUsers());
        };
    });
}

function newSessionId() {
    return 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function liveSessionRef(mobile) {
    return dbReq.ref(ACCESS_SESSION_PATH).child(accessUserKey(mobile) || 'unknown');
}

async function writeLiveSession(user) {
    if (!user || !user.mobile || !user.sessionId) return;
    await liveSessionRef(user.mobile).set({
        sessionId: user.sessionId,
        name: user.name || '',
        mobile: user.mobile,
        at: new Date().toISOString()
    });
}

async function clearLiveSession(user) {
    if (!user || !user.mobile || !user.sessionId) return;
    try {
        const snap = await liveSessionRef(user.mobile).once('value');
        if (snap.exists() && String(snap.val().sessionId || '') === String(user.sessionId)) {
            await liveSessionRef(user.mobile).remove();
        }
    } catch (err) {}
}

async function sessionStillActive(user) {
    if (!user || !user.mobile || !user.sessionId) return false;
    const snap = await liveSessionRef(user.mobile).once('value');
    if (!snap.exists()) return false;
    return String(snap.val().sessionId || '') === String(user.sessionId);
}

function refreshSearchActions() {
    const input = document.getElementById('searchInput');
    if (input && input.value.trim().length >= 2) renderSearchResults(input.value);
}

function forceLocalSignOut(message) {
    currentAccessUser = null;
    saveAccessSession(null);
    applyAccessUI();
    refreshSearchActions();
    if (message) alert(message);
}

async function ensureSuperAdminRecord() {
    const key = SUPER_ADMIN.mobile;
    const record = {
        name: 'irwin',
        mobile: SUPER_ADMIN.mobile,
        'mobile number': SUPER_ADMIN.mobile,
        add: true,
        edit: true,
        delete: true,
        admin: true,
        updatedAt: new Date().toISOString()
    };
    try {
        await dbReq.ref(ACCESS_PATH).child(key).update(record);
    } catch (err) {
        console.warn('Could not save super admin record.', err);
    }
}

async function refreshCurrentAccessUser() {
    const session = readAccessSession();
    if (!session || !session.key) {
        currentAccessUser = null;
        applyAccessUI();
        return;
    }
    if (session.sessionId) {
        if (!(await sessionStillActive(session))) {
            forceLocalSignOut('Signed out because this account signed in on another browser.');
            return;
        }
    } else {
        session.sessionId = newSessionId();
        saveAccessSession(session);
        await writeLiveSession(session);
    }
    if (isSuperAdminIdentity(session.name, session.mobile || session.key)) {
        currentAccessUser = { ...superAdminRecord(), sessionId: session.sessionId || '' };
        applyAccessUI();
        ensureSuperAdminRecord();
        return;
    }
    const snap = await dbReq.ref(ACCESS_PATH).child(session.key).once('value');
    if (!snap.exists()) {
        forceLocalSignOut();
        return;
    }
    currentAccessUser = { ...normalizeAccessRecord(session.key, snap.val()), sessionId: session.sessionId || '' };
    applyAccessUI();
}

async function initializeAccess() {
    try {
        await refreshCurrentAccessUser();
        setInterval(() => {
            if (currentAccessUser) refreshCurrentAccessUser();
        }, 15000);
    } catch (err) {
        console.warn('Access list could not load.', err);
        applyAccessUI();
    }
}

document.getElementById('openAccessBtn')?.addEventListener('click', () => {
    applyAccessUI();
    document.getElementById('accessModal')?.classList.add('active');
});
document.getElementById('closeAccessBtn')?.addEventListener('click', () => {
    document.getElementById('accessModal')?.classList.remove('active');
});
document.getElementById('accessSignOutBtn')?.addEventListener('click', async () => {
    await clearLiveSession(currentAccessUser || readAccessSession());
    forceLocalSignOut();
    refreshSearchActions();
    document.getElementById('accessModal')?.classList.remove('active');
});
document.getElementById('accessChangeOwnPasswordBtn')?.addEventListener('click', async () => {
    if (!currentAccessUser) { denyAccess('change password'); return; }
    const next = (document.getElementById('accessOwnPassword')?.value || '').trim();
    if (next.length < 4) { alert('Password must be at least 4 characters.'); return; }
    await dbReq.ref(ACCESS_PATH).child(currentAccessUser.key || accessUserKey(currentAccessUser.mobile)).update({
        password: next,
        updatedAt: new Date().toISOString()
    });
    document.getElementById('accessOwnPassword').value = '';
    alert('Your password was updated.');
});
document.getElementById('accessLoginBtn')?.addEventListener('click', async () => {
    const mobile = (document.getElementById('accessLoginMobile')?.value || '').trim();
    const password = (document.getElementById('accessLoginPassword')?.value || '').trim();
    if (!mobile || !password) { alert('Enter mobile number and password.'); return; }
    const users = await loadAccessUsers();
    const matched = findAccessByMobile(users, mobile);
    if (!matched) {
        alert('No access record matches that mobile number.');
        return;
    }
    if (matched.password) {
        if (!passwordsMatch(matched.password, password)) {
            alert('Mobile or password is not correct.');
            return;
        }
    } else {
        await dbReq.ref(ACCESS_PATH).child(matched.key || accessUserKey(matched.mobile)).update({
            password,
            updatedAt: new Date().toISOString()
        });
    }
    currentAccessUser = { ...matched, sessionId: newSessionId() };
    delete currentAccessUser.password;
    saveAccessSession(currentAccessUser);
    await writeLiveSession(currentAccessUser);
    if (matched.isAdmin && normalizeMobile(matched.mobile) === SUPER_ADMIN.mobile) {
        ensureSuperAdminRecord();
    }
    applyAccessUI();
    refreshSearchActions();
    if (document.getElementById('createdBy') && currentAccessUser.name && !document.getElementById('createdBy').value) {
        document.getElementById('createdBy').value = currentAccessUser.name;
    }
    if (document.getElementById('mobileNumber') && currentAccessUser.mobile && !document.getElementById('mobileNumber').value) {
        document.getElementById('mobileNumber').value = currentAccessUser.mobile;
    }
    saveSession();
    document.getElementById('accessModal')?.classList.remove('active');
});
document.getElementById('saveAccessUserBtn')?.addEventListener('click', async () => {
    if (!isAccessAdmin()) { denyAccess('manage users'); return; }
    const name = (document.getElementById('accessNewName')?.value || '').trim();
    const mobile = (document.getElementById('accessNewMobile')?.value || '').trim();
    const key = accessUserKey(mobile);
    if (!name || !key) { alert('Name and mobile are required.'); return; }
    const isAdmin = !!document.getElementById('accessNewAdmin')?.checked;
    const record = {
        name,
        mobile,
        'mobile number': mobile,
        add: isAdmin || !!document.getElementById('accessNewAdd')?.checked,
        edit: isAdmin || !!document.getElementById('accessNewEdit')?.checked,
        delete: isAdmin || !!document.getElementById('accessNewDelete')?.checked,
        photo: isAdmin || !!document.getElementById('accessNewPhoto')?.checked,
        admin: isAdmin,
        updatedAt: new Date().toISOString()
    };
    const password = (document.getElementById('accessNewPassword')?.value || '').trim();
    if (password) record.password = password;
    await dbReq.ref(ACCESS_PATH).child(key).update(record);
    document.getElementById('accessNewName').value = '';
    document.getElementById('accessNewMobile').value = '';
    if (document.getElementById('accessNewPassword')) document.getElementById('accessNewPassword').value = '';
    document.getElementById('accessNewAdd').checked = false;
    document.getElementById('accessNewEdit').checked = false;
    document.getElementById('accessNewDelete').checked = false;
    if (document.getElementById('accessNewPhoto')) document.getElementById('accessNewPhoto').checked = false;
    document.getElementById('accessNewAdmin').checked = false;
    renderAccessUserList(await loadAccessUsers());
    alert('User access saved.');
});

initializeAccess();

// ==========================================
// SESSION STORAGE LOGIC
// ==========================================
function saveSession() {
    const data = {
        cart: cart, vendor: selectedVendor, site: selectedSite,
        createdBy: document.getElementById('createdBy').value,
        mobileNumber: document.getElementById('mobileNumber').value,
        newItems: sessionNewlyCreatedItems
    };
    sessionStorage.setItem('pr_session_data', JSON.stringify(data));
}

function loadSession() {
    const stored = sessionStorage.getItem('pr_session_data');
    if (stored) {
        const data = JSON.parse(stored);
        cart = data.cart || [];
        sessionNewlyCreatedItems = data.newItems || [];
        selectedVendor = data.vendor || { id: '', name: '' };
        selectedSite = data.site || { code: '', name: '' };
        document.getElementById('createdBy').value = data.createdBy || '';
        document.getElementById('mobileNumber').value = data.mobileNumber || '';

        if(selectedVendor.id) document.getElementById('selectedVendorDisplay').innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${selectedVendor.id}</strong> - ${selectedVendor.name}`;
        if(selectedSite.code) document.getElementById('selectedSiteDisplay').innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${selectedSite.code}</strong> - ${selectedSite.name}`;
        
        renderCart();
    }
}

document.getElementById('createdBy').addEventListener('input', saveSession);
document.getElementById('mobileNumber').addEventListener('input', saveSession);

document.getElementById('clearSessionBtn').addEventListener('click', () => {
    if(confirm("Clear selected items only? Vendor, site, your details, session new items, and the item catalog cache will stay.")) {
        cart = [];
        saveSession();
        renderCart();
    }
});

// ==========================================
// 1. INITIALIZATION
// ==========================================
// v4: old v3 caches were built from activity.csv and had no group list, so they are ignored.
const CATALOG_CACHE_KEY = 'pr_catalog_cache_v4';
try { localStorage.removeItem('pr_catalog_cache_v3'); } catch (err) {}
const CATALOG_VERSION_PATH = 'appSettings/catalogVersion';
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SEARCH_PAGE_SIZE = 40;
let catalogReady = false;
let searchLimit = SEARCH_PAGE_SIZE;
let lastSearchQuery = '';

function setCatalogStatus(text, cls) {
    const el = document.getElementById('catalogStatus');
    if (!el) return;
    const hide = cls === 'ready' || /cached/i.test(String(text || ''));
    el.style.display = hide ? 'none' : '';
    el.textContent = hide ? '' : text;
    el.className = 'status-pill' + (cls ? ' ' + cls : '');
}

function parseCsv(text) {
    return new Promise((resolve) => {
        Papa.parse(text, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data || []) });
    });
}

function activityLabel(code, name) {
    const n = String(name || '').trim() || 'Uncategorized';
    const c = String(code || '').trim();
    return c ? `${c}. ${n}` : n;
}

// class.csv columns: Class Code, Class Name, Group ID, Group Name, Activity, Activity Code
// Each class is locked to one activity (main category 1-5) and carries a default group.
function applyClassRows(rows) {
    dynamicActivityData = {};
    activitiesMap = {};
    classByCode = {};
    classesByActivity = {};
    const order = {};
    (rows || []).forEach(row => {
        const classCode = String(pickField(row, ['Class Code', 'Class']) || '').trim();
        const className = String(pickField(row, ['Class Name']) || '').trim();
        const groupId = String(pickField(row, ['Group ID', 'Group Code', 'Group']) || '').trim();
        const groupName = String(pickField(row, ['Group Name']) || '').trim();
        const activityName = String(pickField(row, ['Activity', 'Activity Name']) || '').trim();
        const activityCode = String(pickField(row, ['Activity Code']) || '').trim();
        if (!classCode || !className) return;
        const entry = { classCode, className, groupId, groupName, activityCode, activityName };
        classByCode[classCode] = entry;
        if (groupId && !dynamicActivityData[groupId]) {
            dynamicActivityData[groupId] = { groupName, classCode, className, activityCode, activityName };
        }
        const mainCat = activityLabel(activityCode, activityName);
        if (!activitiesMap[mainCat]) activitiesMap[mainCat] = [];
        activitiesMap[mainCat].push(entry);
        if (!classesByActivity[activityCode]) classesByActivity[activityCode] = [];
        classesByActivity[activityCode].push(entry);
        if (!order[activityCode]) order[activityCode] = { code: activityCode, name: activityName, label: mainCat };
    });
    activityList = Object.values(order).sort((a, b) => (parseInt(a.code, 10) || 999) - (parseInt(b.code, 10) || 999));
    Object.values(classesByActivity).forEach(list => list.sort((a, b) => (parseInt(a.classCode, 10) || 0) - (parseInt(b.classCode, 10) || 0)));
    if (typeof renderCategoryChipsAll === 'function') renderCategoryChipsAll();
}

// group.csv columns: Group, Description
function applyGroupRows(rows) {
    allGroups = [];
    groupsByCode = {};
    (rows || []).forEach(row => {
        const code = String(pickField(row, ['Group', 'Group Code', 'Group ID']) || '').trim();
        const name = String(pickField(row, ['Description', 'Group Name', 'Name']) || '').trim();
        if (!code) return;
        if (groupsByCode[code]) return;
        const entry = { code, name: name || code };
        groupsByCode[code] = entry;
        allGroups.push(entry);
    });
    allGroups.sort((a, b) => a.name.localeCompare(b.name));
}

function groupRecord(code) {
    const key = String(code || '').trim();
    return groupsByCode[key] || null;
}

// Default group for a class: name from group.csv, falling back to class.csv.
function classDefaultGroup(cls) {
    if (!cls || !cls.groupId) return null;
    const g = groupRecord(cls.groupId);
    return { code: cls.groupId, name: (g && g.name) || cls.groupName || cls.groupId };
}

function activityByCode(code) {
    return activityList.find(a => a.code === String(code || '').trim()) || null;
}

function readCatalogCache() {
    try {
        const raw = localStorage.getItem(CATALOG_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (!cache || !cache.savedAt) return null;
        if (Date.now() - cache.savedAt > CATALOG_TTL_MS) return { ...cache, stale: true };
        return cache;
    } catch (err) {
        return null;
    }
}

function slimFirebaseItems(items) {
    return (items || []).map((item) => ({
        "Part Code": item["Part Code"] || item["Part code"] || '',
        "Description": item["Description"] || '',
        "UOM": item["UOM"] || '',
        "Series": item["Series"] || '',
        "Group Code": item["Group Code"] || '',
        "Group Name": item["Group Name"] || '',
        "Class Code": item["Class Code"] || '',
        "Class Name": item["Class Name"] || '',
        "Activity Code": item["Activity Code"] || '',
        "Activity Name": item["Activity Name"] || '',
        PhotoFile: item.PhotoFile || '',
        firebaseKey: item.firebaseKey || null
    }));
}

function writeCatalogCache(payload) {
    const slim = {
        ...payload,
        items: [],
        firebaseItems: slimFirebaseItems(payload.firebaseItems || []),
        savedAt: Date.now()
    };
    try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(slim));
    } catch (err) {
        try {
            localStorage.removeItem(CATALOG_CACHE_KEY);
            localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
                activities: payload.activities || [],
                groups: payload.groups || [],
                vendors: payload.vendors || [],
                sites: payload.sites || [],
                firebaseItems: slim.firebaseItems,
                catalogVersion: payload.catalogVersion || 0,
                savedAt: Date.now()
            }));
        } catch (err2) {
            console.warn('Catalog cache not saved (storage full or blocked).', err2);
        }
    }
}

// GitHub CSVs saved from Excel are often Windows-1252, not UTF-8 (e.g. "Façade").
function decodeCsvBuffer(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (err) { return new TextDecoder('windows-1252').decode(buf); }
}

async function fetchText(url) {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Failed to fetch ' + url);
    return decodeCsvBuffer(await res.arrayBuffer());
}

// class.csv, group.csv, Vendors.csv and Site.csv come from GitHub (no Firebase cost).
// The query string changes every 12 hours so the browser cache cannot pin an old copy.
async function loadLookupCsvs(forceNetwork) {
    const buster = '?v=' + (forceNetwork ? Date.now() : Math.floor(Date.now() / CATALOG_TTL_MS));
    const [classText, groupText, vendorsText, sitesText] = await Promise.all([
        fetchText(CLASS_CSV_URL + buster),
        fetchText(GROUP_CSV_URL + buster),
        fetchText(VENDORS_CSV_URL + buster),
        fetchText(SITE_CSV_URL + buster)
    ]);
    return {
        activities: await parseCsv(classText),
        groups: await parseCsv(groupText),
        vendors: await parseCsv(vendorsText),
        sites: await parseCsv(sitesText)
    };
}

function cacheHasLookups(cache) {
    return !!(cache && Array.isArray(cache.activities) && cache.activities.length
        && Array.isArray(cache.groups) && cache.groups.length
        && cache.activities.some(r => pickField(r, ['Group ID'])));
}

async function loadFirebaseItems(force) {
    const cache = readCatalogCache();
    if (!force && cache && !cache.stale && Array.isArray(cache.firebaseItems)) {
        return cache.firebaseItems;
    }
    const snapshot = await dbReq.ref("items").once("value");
    const items = [];
    if (snapshot.exists()) {
        snapshot.forEach(childSnap => {
            const itemData = childSnap.val() || {};
            itemData.firebaseKey = childSnap.key;
            items.push(itemData);
        });
    }
    return items;
}

async function getCatalogVersion() {
    try {
        const snap = await dbReq.ref(CATALOG_VERSION_PATH).once('value');
        return Number(snap.val() || 0);
    } catch (err) {
        return 0;
    }
}

async function bumpCatalogVersion() {
    const next = Date.now();
    try { await dbReq.ref(CATALOG_VERSION_PATH).set(next); } catch (err) {}
    return next;
}

async function loadRemoteCatalog(forceNetwork) {
    setCatalogStatus('Downloading catalog…', 'warn');
    const [lookups, firebaseItems, catalogVersion] = await Promise.all([
        loadLookupCsvs(forceNetwork),
        loadFirebaseItems(true),
        getCatalogVersion()
    ]);
    const { activities, groups, vendors, sites } = lookups;
    writeCatalogCache({ items: [], activities, groups, vendors, sites, firebaseItems, catalogVersion });
    return { items: [], activities, groups, vendors, sites, firebaseItems, catalogVersion, fromCache: false };
}

// After this browser creates, edits or deletes an item: bump the shared version so other
// browsers refresh, and keep this browser's cache so it does not re-download all items.
async function commitCatalogChange() {
    const cache = readCatalogCache() || {};
    let before = null;
    try { before = await getCatalogVersion(); } catch (err) {}
    const inSync = before !== null && Number(cache.catalogVersion || 0) === Number(before || 0);
    const next = await bumpCatalogVersion();
    writeCatalogCache({
        items: [],
        ...lookupRows,
        firebaseItems: allSearchableItems.filter(item => item && item.firebaseKey),
        catalogVersion: inSync ? next : (cache.catalogVersion || 0)
    });
}

function itemPartCode(item) {
    return String((item && (item["Part Code"] || item["Part code"] || item["Part No"] || item["Part Number"])) || "").trim();
}

function mergeCatalogItems(githubItems, firebaseItems) {
    const map = new Map();
    (githubItems || []).forEach((item) => {
        const code = itemPartCode(item);
        if (code) map.set(code, item);
    });
    (firebaseItems || []).forEach((item) => {
        const code = itemPartCode(item);
        if (code) map.set(code, item); // Firebase wins so imported/edited rows become writable
        else if (item && item.firebaseKey) map.set("key:" + item.firebaseKey, item);
    });
    return Array.from(map.values());
}

function applyCatalog(data, sourceLabel) {
    legacyItems = data.items || [];
    if ((data.vendors || []).length) { allVendors = data.vendors; lookupRows.vendors = data.vendors; }
    if ((data.sites || []).length) { allSites = data.sites; lookupRows.sites = data.sites; }
    if ((data.activities || []).length) { applyClassRows(data.activities); lookupRows.activities = data.activities; }
    if ((data.groups || []).length) { applyGroupRows(data.groups); lookupRows.groups = data.groups; }
    const firebaseItems = data.firebaseItems || [];
    allSearchableItems = firebaseItems.slice();
    catalogReady = true;
    if (typeof invalidateAssistantIndex === 'function') invalidateAssistantIndex();
    const count = allSearchableItems.length;
    const writable = firebaseItems.filter(item => item && item.firebaseKey).length;
    setCatalogStatus(`${count.toLocaleString()} items · Firebase · ${sourceLabel}`, 'ready');
    updateCatalogImportStats(legacyItems.length, firebaseItems.length, count);
}

async function initializeApp(forceRefresh) {
    loadSession();
    try {
        let cache = readCatalogCache();
        // Cached Firebase items are fine, but class/group lists must exist and be under 12 hours old.
        // Re-reading them only hits GitHub, never Firebase.
        if (!forceRefresh && cache && Array.isArray(cache.firebaseItems) && (!cacheHasLookups(cache) || cache.stale)) {
            try {
                const lookups = await loadLookupCsvs(!cacheHasLookups(cache));
                cache = { ...cache, ...lookups, stale: false };
                writeCatalogCache(cache);
            } catch (err) {
                console.warn('Could not refresh class/group lists from GitHub.', err);
            }
        }
        const extraTab = !isPrimaryTab;
        if (extraTab && cache && Array.isArray(cache.firebaseItems)) {
            applyCatalog(cache, 'cached · extra tab');
            setCatalogStatus((allSearchableItems.length || 0).toLocaleString() + ' items · cached extra tab', 'warn');
            return;
        }
        if (!forceRefresh && cache && Array.isArray(cache.firebaseItems)) {
            const remoteVersion = await getCatalogVersion();
            applyCatalog(cache, cache.catalogVersion === remoteVersion ? 'cached' : 'cached (updating)');
            if (cache.catalogVersion === remoteVersion) return;
        }
        const fresh = await loadRemoteCatalog(!!forceRefresh);
        applyCatalog(fresh, 'live');
    } catch (err) {
        console.error(err);
        const cache = readCatalogCache();
        if (cache && Array.isArray(cache.firebaseItems)) {
            applyCatalog(cache, 'cached fallback');
        } else {
            setCatalogStatus('Catalog failed to load. Check your connection, then Refresh catalog.', 'warn');
        }
    }
}
// Start after the whole script has run, so every function and constant below exists.
Promise.resolve().then(() => initializeApp(false));

const refreshCatalogBtn = document.getElementById('refreshCatalogBtn');
if (refreshCatalogBtn) {
    refreshCatalogBtn.addEventListener('click', async () => {
        if (!isPrimaryTab) {
            alert('Another Procurement Hub tab is already open. This tab uses the local cache so Firebase is not downloaded again.');
            return;
        }
        refreshCatalogBtn.disabled = true;
        await initializeApp(true);
        refreshCatalogBtn.disabled = false;
        if (searchInput.value.trim().length >= 2) renderSearchResults(searchInput.value);
    });
}

// ==========================================
// 2. VENDOR & SITE AUTOCOMPLETE
// ==========================================
const vendorSearch = document.getElementById('vendorSearch'); const vendorSuggestions = document.getElementById('vendorSuggestions'); const selectedVendorDisplay = document.getElementById('selectedVendorDisplay');
vendorSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim(); vendorSuggestions.innerHTML = ''; if (q.length < 1) return;
    const matches = allVendors.filter(v => { return String(v["Name"] || "").toLowerCase().includes(q) || String(v["Supplier ID"] || "").toLowerCase().includes(q); }).slice(0, 8);
    matches.forEach(v => {
        const name = v["Name"] || "N/A"; const id = v["Supplier ID"] || "N/A"; const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${id}</strong> - ${name}`;
        div.onclick = () => { selectedVendor = { id: id, name: name }; selectedVendorDisplay.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${id}</strong> - ${name}`; vendorSearch.value = name; vendorSuggestions.innerHTML = ''; saveSession(); };
        vendorSuggestions.appendChild(div);
    });
});

const siteSearch = document.getElementById('siteSearch'); const siteSuggestions = document.getElementById('siteSuggestions'); const selectedSiteDisplay = document.getElementById('selectedSiteDisplay');
siteSearch.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim(); siteSuggestions.innerHTML = ''; if (q.length < 1) return;
    const matches = allSites.filter(s => { return String(s["Description"] || "").toLowerCase().includes(q) || String(s["Warehouse"] || "").toLowerCase().includes(q); }).slice(0, 8);
    matches.forEach(s => {
        const name = s["Description"] || "N/A"; const code = s["Warehouse"] || "N/A"; const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${code}</strong> - ${name}`;
        div.onclick = () => { selectedSite = { code: code, name: name }; selectedSiteDisplay.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <strong>${code}</strong> - ${name}`; siteSearch.value = name; siteSuggestions.innerHTML = ''; saveSession(); };
        siteSuggestions.appendChild(div);
    });
});

document.addEventListener('click', (e) => { if (!e.target.closest('.autocomplete-wrapper')) { vendorSuggestions.innerHTML = ''; siteSuggestions.innerHTML = ''; } });

// ==========================================
// 3. SHOPPING CART & SEARCH LOGIC
// ==========================================
const searchInput = document.getElementById('searchInput'); const searchResults = document.getElementById('searchResults'); const cartBody = document.getElementById('cartBody');
function itemSearchText(item) {
    return [
        item["Part Code"] || item["Part code"],
        item["Description"] || item["description"],
        item["Group Name"] || item["Group name"],
        item["Group Code"] || item["Group code"],
        item["Class Code"] || item["Class"] || item["Class Name"],
        item["Activity Name"] || item["Activity name"] || item["Activity"],
        item["UOM"]
    ].map(v => String(v || '').toLowerCase()).join(' ');
}

let currentResultItems = [];

function itemField(item, names) {
    for (const n of names) { if (item && item[n] != null && String(item[n]).trim() !== '') return String(item[n]).trim(); }
    return '';
}

function bindPhotoFallback(img) {
    img.addEventListener('error', () => {
        const alts = String(img.dataset.alts || '').split('|').filter(Boolean);
        if (alts.length) { img.src = alts.shift(); img.dataset.alts = alts.join('|'); }
        else { img.classList.add('thumb-missing'); img.removeAttribute('src'); }
    });
}

function partCodeChipHtml(partNo) {
    const code = String(partNo || '');
    const dot = code.indexOf('.');
    if (dot < 0) return `<span class="code-chip">${escapeHtml(code || 'N/A')}</span>`;
    return `<span class="code-chip"><span class="code-chip-prefix">${escapeHtml(code.slice(0, dot))}</span><span class="code-chip-dot">.</span>${escapeHtml(code.slice(dot + 1))}</span>`;
}

function renderSearchResults(rawQuery) {
    const meta = document.getElementById('searchMeta');
    const query = String(rawQuery || '').toLowerCase().trim();
    searchResults.innerHTML = '';
    currentResultItems = [];
    if (query.length < 2) {
        if (meta) meta.textContent = catalogReady ? `${allSearchableItems.length.toLocaleString()} items ready to search` : 'Catalog still loading…';
        return;
    }
    if (!catalogReady) {
        searchResults.innerHTML = '<div class="no-results">The catalog is still loading. Try again in a moment.</div>';
        return;
    }
    if (query !== lastSearchQuery) {
        lastSearchQuery = query;
        searchLimit = SEARCH_PAGE_SIZE;
    }
    const tokens = query.split(/\s+/).filter(Boolean);
    const matches = allSearchableItems.filter(item => {
        const hay = itemSearchText(item);
        return tokens.every(tok => hay.includes(tok));
    });
    if (meta) meta.textContent = matches.length ? `Showing ${Math.min(matches.length, searchLimit)} of ${matches.length.toLocaleString()} matches` : 'No matches';
    if (matches.length === 0) {
        searchResults.innerHTML = `<div class="empty-state">
            <p><strong>Nothing in the catalog matches “${escapeHtml(rawQuery.trim())}”.</strong></p>
            <p>Ask the assistant where it belongs. It suggests a class and group for the category you pick, then fills in the new item form.</p>
            <button type="button" class="btn btn-accent" data-act="assist"><i class="fa-solid fa-wand-magic-sparkles"></i> Ask the assistant</button>
        </div>`;
        return;
    }
    currentResultItems = matches.slice(0, searchLimit);
    const rows = currentResultItems.map((item, idx) => {
        const partNo = itemField(item, ['Part Code', 'Part code']) || 'N/A';
        const desc = itemField(item, ['Description', 'description']) || 'N/A';
        const uom = itemField(item, ['UOM']) || 'EA';
        const groupName = itemField(item, ['Group Name', 'Group name']);
        const groupCode = itemField(item, ['Group Code', 'Group code']);
        const className = itemField(item, ['Class Name']) || (classByCode[itemField(item, ['Class Code'])] || {}).className || '';
        const actCode = itemField(item, ['Activity Code']);
        const actName = itemField(item, ['Activity Name', 'Activity name', 'Activity']);
        const fileName = item.PhotoFile || item.photoFile || item.photoName || '';
        const photoUrls = photoUrlCandidates(fileName);
        const photo = photoUrls.length
            ? `<img class="item-thumb" src="${escapeHtml(photoUrls[0])}" alt="" referrerpolicy="no-referrer" data-alts="${escapeHtml(photoUrls.slice(1).join('|'))}" data-act="photo" data-idx="${idx}">`
            : '<span class="item-thumb thumb-missing" aria-hidden="true"></span>';
        let actions = `<button type="button" class="add-btn" data-act="add" data-idx="${idx}"><i class="fa-solid fa-plus"></i> Add</button>`;
        if (item.firebaseKey && canEditItems()) actions += `<button type="button" class="icon-btn edit" data-act="edit" data-idx="${idx}" title="Edit item" aria-label="Edit item"><i class="fa-solid fa-pen"></i></button>`;
        if (item.firebaseKey && canDeleteItems()) actions += `<button type="button" class="icon-btn delete" data-act="delete" data-idx="${idx}" title="Delete item" aria-label="Delete item"><i class="fa-solid fa-trash"></i></button>`;
        if (canUpdatePhotos()) actions += `<button type="button" class="icon-btn photo" data-act="setphoto" data-idx="${idx}" title="Set photo" aria-label="Set photo"><i class="fa-solid fa-image"></i></button>`;
        const tags = [
            groupName || groupCode ? `<span class="tag" title="Group ${escapeHtml(groupCode)}"><i class="fa-solid fa-folder-tree"></i> ${escapeHtml(groupName || groupCode)}</span>` : '',
            className ? `<span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(className)}</span>` : '',
            actName ? `<span class="tag tag-act act-${escapeHtml(actCode)}">${escapeHtml(actCode ? actCode + ' ' : '')}${escapeHtml(actName)}</span>` : ''
        ].join('');
        return `<div class="result-item">
            <div class="result-photo">${photo}</div>
            <div class="result-info">
                <div class="result-line">${partCodeChipHtml(partNo)}<span class="result-desc">${escapeHtml(desc)}</span><span class="uom">${escapeHtml(uom)}</span></div>
                <div class="result-tags">${tags}</div>
            </div>
            <div class="result-actions">${actions}</div>
        </div>`;
    });
    searchResults.innerHTML = rows.join('');
    searchResults.querySelectorAll('img[data-alts]').forEach(bindPhotoFallback);
    if (matches.length > searchLimit) {
        const more = document.createElement('div');
        more.className = 'no-results';
        more.innerHTML = `<button type="button" class="ghost-btn" data-act="more">Show ${Math.min(SEARCH_PAGE_SIZE, matches.length - searchLimit)} more (${(matches.length - searchLimit).toLocaleString()} left)</button>`;
        searchResults.appendChild(more);
    }
}

searchResults.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'more') { searchLimit += SEARCH_PAGE_SIZE; renderSearchResults(searchInput.value); return; }
    if (act === 'assist') { openAssistant(searchInput.value.trim(), true); return; }
    const item = currentResultItems[Number(el.dataset.idx)];
    if (!item) return;
    const partNo = itemField(item, ['Part Code', 'Part code']);
    const desc = itemField(item, ['Description', 'description']);
    if (act === 'add') {
        addToCart(partNo, desc, itemField(item, ['UOM']) || 'EA', itemField(item, ['Group Name', 'Group name']), itemField(item, ['Activity Name', 'Activity name', 'Activity']), itemField(item, ['Class Code', 'Class', 'Class Name']));
        el.classList.add('added');
        el.innerHTML = '<i class="fa-solid fa-check"></i> Added';
        setTimeout(() => { el.classList.remove('added'); el.innerHTML = '<i class="fa-solid fa-plus"></i> Add'; }, 1400);
    } else if (act === 'edit') {
        openEditModal(item.firebaseKey);
    } else if (act === 'delete') {
        deleteFirebaseItem(item.firebaseKey);
    } else if (act === 'setphoto') {
        updateItemPhoto(item.firebaseKey || null, partNo, desc);
    } else if (act === 'photo') {
        openPhotoView(el.src, `${partNo} | ${desc}`);
    }
});

let searchTimer = null;

const clearSearchBtn = document.getElementById('clearSearchBtn');
if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        lastSearchQuery = '';
        searchLimit = SEARCH_PAGE_SIZE;
        searchResults.innerHTML = '';
        const meta = document.getElementById('searchMeta');
        if (meta) meta.textContent = catalogReady ? `${allSearchableItems.length.toLocaleString()} items ready` : '';
        searchInput.focus();
    });
}

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderSearchResults(e.target.value), 80);
});

window.addToCart = function(partCode, description, unit, groupName, actName, classValue) {
    // Keep the Class with the cart item even though Class is not displayed in the on-screen cart table.
    if (!classValue || classValue === 'undefined') {
        const sourceItem = allSearchableItems.find(i => String(i["Part Code"] || i["Part code"] || '') === String(partCode));
        classValue = sourceItem ? (sourceItem["Class Code"] || sourceItem["Class"] || sourceItem["Class Name"] || 'N/A') : 'N/A';
    }
    const sourceItem = allSearchableItems.find(i => String(i["Part Code"] || i["Part code"] || '') === String(partCode));
    cart.push({
        partNo: partCode,
        description: description,
        unit: unit,
        groupName: groupName,
        actName: actName,
        classValue: classValue,
        comment: '',
        qty: 1,
        price: 0,
        photoFile: (sourceItem && (sourceItem.PhotoFile || sourceItem.photoFile || sourceItem.photoName)) || '',
        photoUrl: itemPhotoUrl(partCode, sourceItem)
    });
    renderCart(); saveSession();
    const wrap = document.querySelector('#cartPanel .table-responsive');
    const last = document.querySelector('#cartBody tr:last-child');
    if (wrap && last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

function unitOptionsHtml(item) {
    const units = ['Annual', 'Bag', 'Box', 'Bun', 'Day', 'Doz', 'Dr', 'Gal', 'Hrs', 'Kg', 'Litre', 'Lm', 'm2', 'm3', 'Mon', 'Pcs', 'Pkts', 'Rolls', 'Set', 'Sum', 'Ton', 'Trip'];
    let unitOptions = ''; let found = false;
    units.forEach(u => { if (item.unit && u.toLowerCase() === item.unit.toLowerCase()) { unitOptions += `<option value="${u}" selected>${u}</option>`; found = true; } else { unitOptions += `<option value="${u}">${u}</option>`; } });
    if (!found) { unitOptions += `<option value="${item.unit || 'EA'}" selected>${item.unit || 'EA'}</option>`; }
    return unitOptions;
}

function setCartVisible(show) {
    const box = document.getElementById('appContainer');
    const panel = document.getElementById('cartPanel');
    if (box) box.classList.toggle('cart-hidden', !show);
    if (panel) panel.classList.toggle('cart-hidden-panel', !show);
}

function bindFullCartEditors() {
    document.querySelectorAll('#fullCartBody .qty-input, #fullCartBody .price-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = e.target.dataset.index; const field = e.target.dataset.field;
            cart[idx][field] = parseFloat(e.target.value) || 0; saveSession();
            const rowNode = e.target.closest('tr'); const totalNode = rowNode.querySelector('.row-total');
            const newTotal = cart[idx].qty * cart[idx].price;
            if (totalNode) totalNode.textContent = newTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
            let newGrand = 0; cart.forEach(i => newGrand += (i.qty * i.price));
            const g1 = document.getElementById('grandTotalVal');
            const g2 = document.getElementById('fullGrandTotalVal');
            if (g1) g1.textContent = newGrand.toLocaleString('en-US', {minimumFractionDigits: 2});
            if (g2) g2.textContent = newGrand.toLocaleString('en-US', {minimumFractionDigits: 2});
        });
    });
    document.querySelectorAll('#fullCartBody .unit-input, #fullCartBody .cart-comment-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const field = e.target.classList.contains('unit-input') ? 'unit' : 'comment';
            cart[e.target.dataset.index][field] = e.target.value; saveSession();
        });
    });
}

function cartPhotoHtml(item) {
    const source = allSearchableItems.find(i => itemPartCode(i) === String(item.partNo || ''));
    const fileName = item.photoFile || (source && (source.PhotoFile || source.photoFile || source.photoName)) || '';
    const urls = photoUrlCandidates(fileName);
    if (!urls.length) return '';
    const first = String(urls[0]).replace(/"/g, '&quot;');
    const alts = urls.slice(1).join('|').replace(/"/g, '&quot;');
    const title = `${item.partNo || ''} | ${item.description || ''}`;
    return `<img class="item-thumb" src="${first}" alt="" referrerpolicy="no-referrer" data-alts="${alts}" onclick="openCartPhotoShow(${cart.indexOf(item)}, this.src)" onerror="if(this.dataset.alts){const a=this.dataset.alts.split('|').filter(Boolean);if(a.length){this.src=a.shift();this.dataset.alts=a.join('|');}else{this.style.background='#e2e8f0';}}else{this.style.background='#e2e8f0';}">`;
}

function renderFullCart() {
    const body = document.getElementById('fullCartBody');
    if (!body) return;
    body.innerHTML = '';
    let grandTotal = 0;
    cart.forEach((item, index) => {
        const total = item.qty * item.price; grandTotal += total;
        const comment = escapeHtml(item.comment || '');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${cartPhotoHtml(item)}</td>
            <td><strong>${escapeHtml(item.partNo)}</strong><br><em class="cart-group-name">${escapeHtml(item.groupName)}${item.actName ? ' (' + escapeHtml(item.actName) + ')' : ''}</em></td>
            <td>${escapeHtml(item.description)}<br><input type="text" class="calc-input cart-comment-input" placeholder="Add a comment (optional)..." value="${comment}" data-index="${index}"></td>
            <td><input type="number" min="1" class="calc-input qty-input" value="${item.qty}" data-index="${index}" data-field="qty"></td>
            <td><select class="calc-input unit-input" data-index="${index}">${unitOptionsHtml(item)}</select></td>
            <td><input type="number" min="0" step="0.01" class="calc-input price-input" value="${item.price}" data-index="${index}" data-field="price"></td>
            <td class="row-total">${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="action-col"><button class="remove-btn" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        body.appendChild(tr);
    });
    const g2 = document.getElementById('fullGrandTotalVal');
    if (g2) g2.textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
    bindFullCartEditors();
}

function renderCart() {
    const cartBody = document.getElementById('cartBody');
    if (!cartBody) return;
    cartBody.innerHTML = ''; let grandTotal = 0;
    const previewBtn = document.getElementById('previewBtn');
    const saveBtnAction = document.getElementById('saveBtnAction');
    const copyExcelBtn = document.getElementById('copyExcelBtn');
    const copyReqEntryBtn = document.getElementById('copyReqEntryBtn');
    setCartVisible(cart.length > 0);

    if (cart.length === 0) {
        cartBody.innerHTML = '<tr class="empty-row"><td colspan="4">No items added yet.</td></tr>';
        previewBtn.disabled = true; saveBtnAction.disabled = true;
        if (copyExcelBtn) copyExcelBtn.disabled = true;
        if (copyReqEntryBtn) copyReqEntryBtn.disabled = true;
        document.getElementById('grandTotalVal').textContent = "0.00";
        document.getElementById('fullCartView')?.classList.remove('active');
        document.body.classList.remove('full-cart-open');
        return;
    }

    previewBtn.disabled = false; saveBtnAction.disabled = false;
    if (copyExcelBtn) copyExcelBtn.disabled = false;
    if (copyReqEntryBtn) copyReqEntryBtn.disabled = false;
    cart.forEach((item, index) => {
        const total = item.qty * item.price; grandTotal += total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(item.partNo)}</strong></td>
            <td>${escapeHtml(item.description)}</td>
            <td class="action-col"><button class="remove-btn" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        cartBody.appendChild(tr);
    });
    document.getElementById('grandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
    if (document.getElementById('fullCartView')?.classList.contains('active')) renderFullCart();
}
window.removeFromCart = function(index) { cart.splice(index, 1); renderCart(); saveSession(); };

// ==========================================
// COPY CART FOR EXCEL
// ==========================================
const copyExcelBtn = document.getElementById('copyExcelBtn');

function getCartClassValue(item) {
    // Prefer the exact Class stored on the cart item.
    if (item.classValue && item.classValue !== 'N/A' && item.classValue !== 'undefined') {
        // Export Class as the CODE only. Older cart rows may contain 'CODE - NAME'.
        return String(item.classValue).split(' - ')[0].trim();
    }

    // Recover the original item so older/session-saved cart rows also get Class.
    const sourceItem = allSearchableItems.find(i => String(i["Part Code"] || i["Part code"] || '') === String(item.partNo));
    if (sourceItem) {
        const directClass = sourceItem["Class Code"] || sourceItem["Class"] || sourceItem["Class Name"];
        if (directClass && directClass !== 'N/A') return directClass;

        // In the item database, Class can be represented through the item's Group Code.
        const groupCode = sourceItem["Group Code"] || sourceItem["Group code"];
        if (groupCode && dynamicActivityData[groupCode]) {
            return dynamicActivityData[groupCode].classCode || 'N/A';
        }
    }

    // Final fallback: use the cart's Group Code if a future item structure stores it.
    if (item.groupCode && dynamicActivityData[item.groupCode]) {
        return dynamicActivityData[item.groupCode].classCode || 'N/A';
    }

    return 'N/A';
}

function excelCellValue(value) {
    // Keep pasted Excel cells clean and prevent accidental tabs/newlines from shifting columns.
    return String(value ?? '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ').trim();
}

async function writeClipboardText(excelText) {
    try {
        await navigator.clipboard.writeText(excelText);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = excelText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }
}

function flashCopied(btn) {
    if (!btn) return;
    const originalHtml = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied! Paste in Excel';
    setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = originalHtml;
    }, 2200);
}

async function copyCartForExcel() {
    if (!cart.length) return;

    const rows = cart.map((item, index) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const total = qty * price;
        return [
            index + 1,
            item.partNo || '',
            getCartClassValue(item),
            item.description || '',
            qty,
            item.unit || '',
            price.toFixed(2),
            'Our',
            total.toFixed(2),
            item.comment || ''
        ].map(excelCellValue).join('\t');
    });

    await writeClipboardText(rows.join('\r\n'));
    flashCopied(copyExcelBtn);
    flashCopied(document.getElementById('fullCopyExcelBtn'));
}

async function copyRequisitionEntry() {
    if (!cart.length) return;

    const blankIfMissing = (value) => {
        const text = String(value ?? '').trim();
        if (!text || text === 'N/A' || text === 'No Vendor Selected') return '';
        return text;
    };
    const vendorId = blankIfMissing(selectedVendor && selectedVendor.id);
    const vendorName = blankIfMissing(selectedVendor && selectedVendor.name);

    const rows = [];
    cart.forEach((item, index) => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const total = qty * price;
        rows.push([
            index + 1,
            '',
            item.partNo || '',
            item.description || '',
            getCartClassValue(item),
            qty,
            item.unit || '',
            price.toFixed(2),
            total.toFixed(2),
            item.comment || '',
            vendorId,
            vendorName
        ].map(excelCellValue).join('\t'));
    });

    await writeClipboardText(rows.join('\r\n'));
    flashCopied(document.getElementById('copyReqEntryBtn'));
    flashCopied(document.getElementById('fullCopyReqEntryBtn'));
}

if (copyExcelBtn) copyExcelBtn.addEventListener('click', copyCartForExcel);
document.getElementById('copyReqEntryBtn')?.addEventListener('click', copyRequisitionEntry);

// ==========================================
// 4. NEW ITEMS MODAL (SESSION VIEW) - UPDATED WITH CLASS & CODES
// ==========================================
const newItemsModal = document.getElementById('newItemsModal');
const viewNewItemsBtn = document.getElementById('viewNewItemsBtn');
const closeNewItemsModalBtn = document.getElementById('closeNewItemsModalBtn');

const RECENT_ITEMS_PATH = 'recentItems';
let sharedRecentItems = [];

function recentItemPayload(item) {
    return {
        "Part Code": item["Part Code"] || '',
        "Description": item["Description"] || '',
        "UOM": item["UOM"] || '',
        "Activity Code": item["Activity Code"] || '',
        "Activity Name": item["Activity Name"] || '',
        "Group Code": item["Group Code"] || '',
        "Group Name": item["Group Name"] || '',
        "Class Code": item["Class Code"] || '',
        "Class Name": item["Class Name"] || '',
        "CreatedAt": item["CreatedAt"] || new Date().toISOString(),
        firebaseKey: item.firebaseKey || null
    };
}

async function publishRecentItem(item) {
    if (!item || !item.firebaseKey) return;
    await dbReq.ref(RECENT_ITEMS_PATH).child(item.firebaseKey).set(recentItemPayload(item));
}

async function loadSharedRecentItems() {
    const snap = await dbReq.ref(RECENT_ITEMS_PATH).once('value');
    const rows = [];
    if (snap.exists()) {
        snap.forEach((child) => {
            rows.push({ firebaseKey: child.key, ...(child.val() || {}) });
        });
    }
    rows.sort((a, b) => String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || '')));
    sharedRecentItems = rows.slice(0, 200);
    return sharedRecentItems;
}

function renderRecentItemsTable(list, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(item => {
        const actText = item["Activity Code"] && item["Activity Code"] !== "N/A" ? `[${item["Activity Code"]}] ${item["Activity Name"]}` : (item["Activity Name"] || '');
        const groupText = item["Group Code"] ? `[${item["Group Code"]}] ${item["Group Name"]}` : (item["Group Name"] || '');
        const classText = item["Class Code"] && item["Class Code"] !== "N/A" ? `[${item["Class Code"]}] ${item["Class Name"]}` : (item["Class Name"] || "N/A");
        tbody.innerHTML += `<tr>
            <td><strong>${escapeHtml(item["Part Code"])}</strong></td>
            <td>${escapeHtml(item["Description"] || '')}</td>
            <td>${escapeHtml(item["UOM"] || '')}</td>
            <td class="muted-cell">${escapeHtml(actText)}</td>
            <td class="muted-cell">${escapeHtml(groupText)}</td>
            <td class="muted-cell">${escapeHtml(classText)}</td>
        </tr>`;
    });
}

if(viewNewItemsBtn && newItemsModal) {
    viewNewItemsBtn.addEventListener('click', async () => {
        const tbody = document.getElementById('newItemsTableBody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;">Loading recent items…</td></tr>';
        newItemsModal.classList.add('active');
        try {
            const list = await loadSharedRecentItems();
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color: #64748b; font-style: italic;">No recently created items yet.</td></tr>';
                document.getElementById('printNewItemsBtn').disabled = true;
            } else {
                renderRecentItemsTable(list, 'newItemsTableBody');
                document.getElementById('printNewItemsBtn').disabled = false;
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;">Could not load recent items.</td></tr>';
        }
    });
}

if(closeNewItemsModalBtn) {
    closeNewItemsModalBtn.addEventListener('click', () => newItemsModal.classList.remove('active'));
}

document.getElementById('printNewItemsBtn').addEventListener('click', () => {
    const d = new Date();
    document.getElementById('printNewItemsDate').textContent = d.toLocaleString();
    
    const tbody = document.getElementById('printNewItemsTableBody');
    tbody.innerHTML = '';
    const printList = sharedRecentItems.length ? sharedRecentItems : sessionNewlyCreatedItems;
    printList.forEach(item => {
        // Combine Codes with Names for printing
        const actText = item["Activity Code"] && item["Activity Code"] !== "N/A" ? `[${item["Activity Code"]}] ${item["Activity Name"]}` : item["Activity Name"];
        const groupText = item["Group Code"] ? `[${item["Group Code"]}] ${item["Group Name"]}` : item["Group Name"];
        const classText = item["Class Code"] && item["Class Code"] !== "N/A" ? `[${item["Class Code"]}] ${item["Class Name"]}` : (item["Class Name"] || "N/A");

        tbody.innerHTML += `<tr>
            <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">${item["Part Code"]}</td>
            <td style="border: 1px solid #000; padding: 8px;">${item["Description"]}</td>
            <td style="border: 1px solid #000; padding: 8px;">${item["UOM"]}</td>
            <td style="border: 1px solid #000; padding: 8px; font-size: 11px;">${actText}</td>
            <td style="border: 1px solid #000; padding: 8px; font-size: 11px;">${groupText}</td>
            <td style="border: 1px solid #000; padding: 8px; font-size: 11px;">${classText}</td>
        </tr>`;
    });
    
    document.body.classList.add('printing-new-items'); 
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-new-items'); }, 1000);
});

// ==========================================
// 5. CLASSIFICATION PICKER (shared by Create and Edit)
// Main category (1-5, class.csv) -> Class (locked to its activity) -> Group (class default, or any group from group.csv)
// Part Code = chosen group code + "." + series. Changing the group only changes the prefix.
// ==========================================
const $id = (id) => document.getElementById(id);

function showToast(message, kind) {
    let host = $id('toastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toastHost';
        host.className = 'toast-host no-print';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
}

// Small accessible combobox: focus shows the full list, typing filters, arrows + Enter pick, Esc restores.
function attachCombo(input, box, cfg) {
    let items = []; let active = -1; let open = false;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    function paintActive() {
        box.querySelectorAll('[data-i]').forEach((el) => el.classList.toggle('active', Number(el.dataset.i) === active));
        const el = box.querySelector(`[data-i="${active}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function render(q) {
        items = cfg.options(String(q || '')) || [];
        active = items.length ? 0 : -1;
        box.innerHTML = items.length
            ? items.map((it, i) => `<div class="suggestion-item${it.cls ? ' ' + it.cls : ''}" role="option" data-i="${i}">${it.html}</div>`).join('') + (cfg.footer ? cfg.footer(q, items) : '')
            : `<div class="suggestion-empty">${escapeHtml(cfg.emptyText ? cfg.emptyText(q) : 'No matches')}</div>`;
        open = true;
        box.classList.add('open');
        input.setAttribute('aria-expanded', 'true');
        paintActive();
    }
    function close(restore) {
        box.innerHTML = '';
        open = false;
        box.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        if (restore && cfg.restore) input.value = cfg.restore();
    }
    function choose(i) {
        const it = items[i];
        if (!it) return;
        close(false);
        cfg.pick(it.value);
    }
    input.addEventListener('focus', () => {
        if (input.disabled) return;
        input.select();
        render('');
    });
    input.addEventListener('click', () => { if (!open && !input.disabled) render(''); });
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) render(input.value); else { active = Math.min(items.length - 1, active + 1); paintActive(); } }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0) choose(active); }
        else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'Tab' && open) { close(true); }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) close(true); }, 150));
    box.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const el = e.target.closest('[data-i]');
        if (el) choose(Number(el.dataset.i));
    });
    return { render, close };
}

function textMatchesAll(text, query) {
    const hay = String(text || '').toLowerCase();
    return String(query || '').toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t));
}

function groupLabel(g) { return g ? `${g.code} - ${g.name}` : ''; }

const pickerRegistry = [];
function renderCategoryChipsAll() { pickerRegistry.forEach(p => p.renderChips()); }

function createClassificationPicker(ids, onChange) {
    const chips = $id(ids.chips);
    const classInput = $id(ids.classInput);
    const classBox = $id(ids.classBox);
    const groupInput = $id(ids.groupInput);
    const groupBox = $id(ids.groupBox);
    const groupState = $id(ids.groupState);
    const state = { activityCode: '', cls: null, group: null };

    function defaultGroup() { return state.cls && !state.cls.unknown ? classDefaultGroup(state.cls) : null; }
    function isDefaultGroup() {
        const d = defaultGroup();
        return !!(d && state.group && d.code === state.group.code);
    }
    function classDisplay() {
        if (!state.cls) return '';
        return state.cls.unknown ? `${state.cls.className || 'Unknown class'} (not in class.csv)` : `${state.cls.className} (class ${state.cls.classCode})`;
    }

    function renderChips() {
        if (!chips) return;
        if (!activityList.length) { chips.innerHTML = '<span class="hint">Loading categories…</span>'; return; }
        chips.innerHTML = activityList.map(a => `<button type="button" class="cat-chip act-${escapeHtml(a.code)}" data-code="${escapeHtml(a.code)}" aria-pressed="${a.code === state.activityCode}"><span class="cat-num">${escapeHtml(a.code)}</span>${escapeHtml(a.name)}</button>`).join('');
    }

    function paint() {
        renderChips();
        const hasCat = !!state.activityCode;
        classInput.disabled = !hasCat;
        classInput.placeholder = hasCat ? 'Click to see the classes, or type to search' : 'Pick a main category first';
        classInput.value = classDisplay();
        groupInput.disabled = !state.cls;
        groupInput.placeholder = state.cls ? 'Keep the default, or type to search all groups' : 'Pick a class first';
        groupInput.value = groupLabel(state.group);
        if (ids.dispClass) $id(ids.dispClass).value = state.cls ? `${state.cls.classCode} - ${state.cls.className}` : '';
        if (ids.dispActivity) $id(ids.dispActivity).value = state.cls ? `${state.cls.activityCode} - ${state.cls.activityName}` : '';
        if (groupState) {
            const d = defaultGroup();
            if (!state.cls || !state.group) { groupState.innerHTML = ''; groupState.className = 'group-state'; }
            else if (isDefaultGroup() || !d) { groupState.className = 'group-state is-default'; groupState.innerHTML = '<i class="fa-solid fa-circle-check"></i> Default group for this class'; }
            else {
                groupState.className = 'group-state is-changed';
                groupState.innerHTML = `<i class="fa-solid fa-arrow-right-arrow-left"></i> Changed from the class default ${escapeHtml(groupLabel(d))} <button type="button" class="link-btn" data-reset-group>Use default</button>`;
            }
        }
        if (onChange) onChange(get());
    }

    function setCategory(code) {
        code = String(code || '');
        if (code === state.activityCode) return;
        state.activityCode = code;
        if (state.cls && state.cls.activityCode !== code) { state.cls = null; state.group = null; }
        paint();
    }
    function setClass(cls, keepGroup) {
        state.cls = cls;
        state.activityCode = cls ? cls.activityCode : state.activityCode;
        if (!keepGroup || !state.group) state.group = classDefaultGroup(cls);
        paint();
    }
    function setGroup(g) { state.group = g ? { code: g.code, name: g.name } : null; paint(); }
    function reset() { state.activityCode = ''; state.cls = null; state.group = null; paint(); }
    function get() { return { activityCode: state.activityCode, cls: state.cls, group: state.group, defaultGroup: defaultGroup(), isDefault: isDefaultGroup() }; }

    // Load a saved classification (edit, or a suggestion from the assistant).
    function load({ activityCode, classCode, className, activityName, groupCode, groupName }) {
        const known = classByCode[String(classCode || '').trim()];
        if (known) state.cls = known;
        else if (classCode || className) state.cls = { classCode: String(classCode || ''), className: className || '', activityCode: String(activityCode || ''), activityName: activityName || '', groupId: '', groupName: '', unknown: true };
        else state.cls = null;
        state.activityCode = state.cls ? state.cls.activityCode : String(activityCode || '');
        const gCode = String(groupCode || '').trim();
        const g = groupRecord(gCode);
        state.group = gCode ? { code: gCode, name: (g && g.name) || groupName || gCode } : classDefaultGroup(state.cls);
        paint();
    }

    chips?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-code]');
        if (!btn) return;
        setCategory(btn.dataset.code);
        if (!state.cls) setTimeout(() => classInput.focus(), 0);
    });
    groupState?.addEventListener('click', (e) => {
        if (e.target.closest('[data-reset-group]')) setGroup(defaultGroup());
    });

    attachCombo(classInput, classBox, {
        options: (q) => (classesByActivity[state.activityCode] || [])
            .filter(c => !q || textMatchesAll(`${c.classCode} ${c.className} ${c.groupId} ${c.groupName}`, q))
            .map(c => {
                const g = classDefaultGroup(c);
                return {
                    value: c,
                    cls: state.cls && state.cls.classCode === c.classCode ? 'current' : '',
                    html: `<span class="opt-code">${escapeHtml(c.classCode)}</span><span class="opt-main">${escapeHtml(c.className)}<small>Default group ${escapeHtml(groupLabel(g))}</small></span>`
                };
            }),
        pick: (c) => { setClass(c, false); setTimeout(() => groupInput.focus(), 0); },
        restore: () => classDisplay(),
        emptyText: (q) => `No class in this category matches “${q}”.`
    });

    attachCombo(groupInput, groupBox, {
        options: (q) => {
            const d = defaultGroup();
            const list = [];
            if (d && (!q || textMatchesAll(`${d.code} ${d.name}`, q))) list.push({ value: d, cls: 'is-default-opt', html: `<span class="opt-code">${escapeHtml(d.code)}</span><span class="opt-main">${escapeHtml(d.name)}<small>Default for this class</small></span>` });
            allGroups.forEach(g => {
                if (d && g.code === d.code) return;
                if (q && !textMatchesAll(`${g.code} ${g.name}`, q)) return;
                list.push({ value: g, cls: state.group && state.group.code === g.code ? 'current' : '', html: `<span class="opt-code">${escapeHtml(g.code)}</span><span class="opt-main">${escapeHtml(g.name)}</span>` });
            });
            return list.slice(0, 200);
        },
        pick: (g) => setGroup(g),
        restore: () => groupLabel(state.group),
        emptyText: (q) => `No group in group.csv matches “${q}”.`
    });

    const api = { renderChips, setCategory, setClass, setGroup, reset, get, load, paint };
    pickerRegistry.push(api);
    renderChips();
    return api;
}

// ---------- Series numbers ----------
// One shared counter (a single number in Firebase) so two people never get the same series,
// and so we never have to download the whole items list to find the highest series.
const SERIES_COUNTER_PATH = 'appSettings/lastSeries';
const SERIES_FLOOR = 100000;

function localMaxSeries() {
    let max = SERIES_FLOOR;
    allSearchableItems.forEach(item => {
        const raw = (item && (item["Series"] || String(itemPartCode(item)).split('.')[1])) || '';
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return max;
}

async function peekNextSeries() {
    let counter = 0;
    try { counter = Number((await dbReq.ref(SERIES_COUNTER_PATH).once('value')).val()) || 0; } catch (err) {}
    return Math.max(counter, localMaxSeries()) + 1;
}

async function claimNextSeries() {
    const floor = localMaxSeries();
    try {
        const result = await dbReq.ref(SERIES_COUNTER_PATH).transaction(cur => Math.max(Number(cur) || 0, floor) + 1);
        if (result && result.committed) return Number(result.snapshot.val());
    } catch (err) {
        console.warn('Series counter not available; using the local catalog instead.', err);
    }
    return floor + 1;
}

// ---------- Create item ----------
const modal = $id('generatorModal');
const saveBtn = $id('saveBtn');
const createState = { series: null, token: 0 };

const createPicker = createClassificationPicker({
    chips: 'createCategoryChips', classInput: 'activitySearch', classBox: 'activitySuggestions',
    groupInput: 'groupSearch', groupBox: 'groupSuggestions', groupState: 'createGroupState',
    dispClass: 'dispClass', dispActivity: 'dispActivity'
}, () => updateCreatePreview());

function paintCodeTag(tagId, prefixId, seriesId, prefix, series, changed) {
    const tag = $id(tagId);
    if (tag) tag.classList.toggle('is-changed', !!changed);
    if ($id(prefixId)) $id(prefixId).textContent = prefix || '·····';
    if ($id(seriesId)) $id(seriesId).textContent = series || '······';
}

function updateCreatePreview() {
    const p = createPicker.get();
    paintCodeTag('createCodeTag', 'previewPrefix', 'previewSeriesNum', p.group && p.group.code, createState.series, p.group && !p.isDefault);
    const status = $id('seriesStatusText');
    if (status) {
        if (!p.cls) status.textContent = 'Pick a category, class and group. The prefix is the group code.';
        else if (!createState.series) status.textContent = 'Getting the next series number…';
        else status.textContent = p.isDefault ? 'Prefix is the class default group.' : 'Prefix follows the group you chose. The series stays the same.';
    }
    const ready = !!(p.cls && !p.cls.unknown && p.group && createState.series);
    saveBtn.disabled = !ready;
    saveBtn.textContent = ready ? 'Save item and add to cart' : (p.cls ? 'Getting series…' : 'Pick a class first');
    const previewImg = $id('createItemPhotoPreview');
    if (previewImg) previewImg.style.display = 'none';
}

async function refreshCreateSeries() {
    const token = ++createState.token;
    createState.series = null;
    updateCreatePreview();
    const next = await peekNextSeries();
    if (token !== createState.token) return;
    createState.series = String(next);
    updateCreatePreview();
}

function openCreateModal(prefill) {
    if (!canAddItems()) { denyAccess('add items'); return; }
    $id('itemForm').reset();
    createPicker.reset();
    if (prefill) {
        if (prefill.classCode) createPicker.load(prefill);
        else if (prefill.activityCode) createPicker.setCategory(prefill.activityCode);
        if (prefill.description) $id('description').value = prefill.description;
        if (prefill.uom) $id('uom').value = prefill.uom;
    }
    modal.classList.add('active');
    refreshCreateSeries();
    setTimeout(() => {
        const p = createPicker.get();
        if (!p.activityCode) $id('createCategoryChips')?.querySelector('button')?.focus();
        else if (!p.cls) $id('activitySearch').focus();
        else $id('description').focus();
    }, 50);
}
window.openCreateModal = openCreateModal;

$id('openGeneratorBtn')?.addEventListener('click', (e) => { e.preventDefault(); openCreateModal(); });
$id('closeModalBtn')?.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('active'); });

$id('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canAddItems()) { denyAccess('add items'); return; }
    const p = createPicker.get();
    if (!p.cls || p.cls.unknown || !p.group) { alert('Pick a main category, a class and a group first.'); return; }
    const itemDesc = $id('description').value.trim();
    const itemUOM = $id('uom').value;
    if (!itemDesc || !itemUOM) { alert('Enter a description and pick a UOM.'); return; }
    try {
        saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
        const series = String(await claimNextSeries());
        const partCode = `${p.group.code}.${series}`;
        const newItemRecord = {
            "Part Code": partCode,
            "Series": series,
            "Description": itemDesc,
            "UOM": itemUOM,
            "Group Code": p.group.code,
            "Group Name": p.group.name,
            "Class Code": p.cls.classCode,
            "Class Name": p.cls.className,
            "Activity Code": p.cls.activityCode,
            "Activity Name": p.cls.activityName,
            "CreatedAt": new Date().toISOString()
        };
        const newRef = dbReq.ref("items").push();
        newItemRecord.firebaseKey = newRef.key;
        await newRef.set(newItemRecord);
        allSearchableItems.push(newItemRecord);
        invalidateAssistantIndex();
        sessionNewlyCreatedItems.push(newItemRecord);
        await publishRecentItem(newItemRecord).catch(err => console.warn(err));
        await commitCatalogChange().catch(err => console.warn(err));
        addToCart(partCode, itemDesc, itemUOM, p.group.name, p.cls.activityName, p.cls.classCode);
        modal.classList.remove('active');
        createPicker.reset();
        $id('itemForm').reset();
        showToast(`Saved ${partCode} and added it to the cart.`, 'ok');
    } catch (error) {
        console.error('Error adding item: ', error);
        alert('Could not save to Firebase. Check your connection and sign-in, then try again.');
    } finally {
        updateCreatePreview();
    }
});

// ==========================================
// 6. FIREBASE ITEM MANAGEMENT (EDIT/DELETE)
// ==========================================
window.deleteFirebaseItem = async function(key) {
    if (!canDeleteItems()) { denyAccess('delete items'); return; }
    const item = allSearchableItems.find(i => i.firebaseKey === key);
    const label = item ? `${itemPartCode(item)} ${item["Description"] || ''}`.trim() : 'this item';
    if (!confirm(`Delete ${label} from the catalog permanently?`)) return;
    try {
        await dbReq.ref("items").child(key).remove();
        await dbReq.ref(RECENT_ITEMS_PATH).child(key).remove().catch(() => {});
        allSearchableItems = allSearchableItems.filter(i => i.firebaseKey !== key);
        invalidateAssistantIndex();
        await commitCatalogChange().catch(err => console.warn(err));
        renderSearchResults(searchInput.value);
        showToast('Item deleted.', 'ok');
    } catch (error) { console.error("Error deleting item:", error); alert("Could not delete the item. Check your connection and try again."); }
};

const editState = { key: null, item: null, series: '', originalCode: '' };
const editPicker = createClassificationPicker({
    chips: 'editCategoryChips', classInput: 'editActivitySearch', classBox: 'editActivitySuggestions',
    groupInput: 'editGroupSearch', groupBox: 'editGroupSuggestions', groupState: 'editGroupState',
    dispClass: 'editDispClass', dispActivity: 'editDispActivity'
}, () => updateEditPreview());

function editNewPartCode() {
    const p = editPicker.get();
    if (!editState.series || !p.group) return editState.originalCode;
    return `${p.group.code}.${editState.series}`;
}

function updateEditPreview() {
    if (!editState.key) return;
    const p = editPicker.get();
    const newCode = editNewPartCode();
    const changed = newCode !== editState.originalCode;
    paintCodeTag('editCodeTag', 'editPrefix', 'editSeriesNum', p.group && p.group.code, editState.series || '', changed);
    const was = $id('editPartCodeWas');
    if (was) {
        if (!editState.series) was.textContent = `This item has no series number, so its part code stays ${editState.originalCode}.`;
        else was.textContent = changed ? `Was ${editState.originalCode}. Saving changes the prefix only. The series stays ${editState.series}.` : 'Part code unchanged.';
    }
    const btn = $id('saveEditBtn');
    if (btn) btn.disabled = !(p.cls && p.group);
}

window.openEditModal = function(key) {
    if (!canEditItems()) { denyAccess('edit items'); return; }
    const item = allSearchableItems.find(i => i.firebaseKey === key);
    if (!item) { alert('This item is no longer in the catalog. Click Refresh catalog and try again.'); return; }
    const partCode = itemPartCode(item);
    editState.key = key;
    editState.item = item;
    editState.originalCode = partCode;
    editState.series = String(item["Series"] || (partCode.includes('.') ? partCode.split('.').slice(1).join('.') : '')).trim();
    $id('editFirebaseKey').value = key;
    $id('editDescription').value = item["Description"] || '';
    const uomSelect = $id('editUom');
    const uom = String(item["UOM"] || '');
    if (uom && !Array.from(uomSelect.options).some(o => o.value === uom)) uomSelect.add(new Option(uom, uom));
    uomSelect.value = uom;
    editPicker.load({
        activityCode: item["Activity Code"], activityName: item["Activity Name"] || item["Activity"],
        classCode: item["Class Code"], className: item["Class Name"],
        groupCode: item["Group Code"] || (partCode.includes('.') ? partCode.split('.')[0] : ''), groupName: item["Group Name"]
    });
    updateEditPreview();
    $id('editItemModal').classList.add('active');
};

$id('closeEditModalBtn').addEventListener('click', (e) => { e.preventDefault(); $id('editItemModal').classList.remove('active'); });

$id('editItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canEditItems()) { denyAccess('edit items'); return; }
    const btn = $id('saveEditBtn');
    const key = editState.key;
    const p = editPicker.get();
    if (!key || !p.cls || !p.group) return;
    const newPartCode = editNewPartCode();
    const updateData = {
        "Part Code": newPartCode,
        "Series": editState.series,
        "Description": $id('editDescription').value.trim(),
        "UOM": $id('editUom').value,
        "Group Code": p.group.code,
        "Group Name": p.group.name,
        "Class Code": p.cls.classCode,
        "Class Name": p.cls.className,
        "Activity Code": p.cls.activityCode,
        "Activity Name": p.cls.activityName,
        "UpdatedAt": new Date().toISOString()
    };
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
        await dbReq.ref("items").child(key).update(updateData);
        const idx = allSearchableItems.findIndex(item => item.firebaseKey === key);
        if (idx > -1) allSearchableItems[idx] = { ...allSearchableItems[idx], ...updateData };
        invalidateAssistantIndex();
        await commitCatalogChange().catch(err => console.warn(err));
        // Keep any cart rows for this item in step with the new code.
        let cartTouched = false;
        cart.forEach(row => {
            if (row.partNo === editState.originalCode) {
                Object.assign(row, { partNo: newPartCode, description: updateData["Description"], groupName: updateData["Group Name"], actName: updateData["Activity Name"], classValue: updateData["Class Code"] });
                cartTouched = true;
            }
        });
        if (cartTouched) { renderCart(); saveSession(); }
        $id('editItemModal').classList.remove('active');
        renderSearchResults(searchInput.value);
        showToast(newPartCode !== editState.originalCode ? `Updated. Part code is now ${newPartCode}.` : 'Item updated.', 'ok');
        editState.key = null;
    } catch (error) {
        console.error("Error updating item:", error); alert("Could not update the item. Check your connection and try again.");
    } finally {
        btn.disabled = false; btn.textContent = "Update item";
    }
});

// ==========================================
// 7. PREVIEW & SAVE LOGIC
// ==========================================
function populatePrintLayout(reqNum, dateStr, createdBy, mobile) {
    document.getElementById('printReqNumber').textContent = reqNum; document.getElementById('printReqDate').textContent = dateStr;
    document.getElementById('printVendorId').textContent = selectedVendor.id || '_________________'; document.getElementById('printVendorName').textContent = selectedVendor.name || '_________________';
    document.getElementById('printSiteId').textContent = selectedSite.code || '_________________'; document.getElementById('printSiteName').textContent = selectedSite.name || '_________________';
    
    const d = new Date(); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0'); const min = String(d.getMinutes()).padStart(2, '0'); const ss = String(d.getSeconds()).padStart(2, '0');
    const exactTimeStr = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    const cleanCreatedBy = createdBy || "N/A"; const cleanMobile = mobile || "N/A";
    document.getElementById('printFooterInfo').textContent = `${cleanCreatedBy}:${cleanMobile}: ${exactTimeStr}`;

    let grandTotal = 0; let html = `<thead><tr><th>SN</th><th>Part No</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th></tr></thead><tbody>`;
    cart.forEach((item, i) => {
        const total = item.qty * item.price; grandTotal += total;
        const commentHTML = item.comment ? `<br><em style="font-size: 10px; color: #64748b; font-style: italic;">${item.comment}</em>` : '';
        html += `<tr><td>${i + 1}</td><td><strong>${item.partNo}</strong><br><em style="font-size: 10px; color: #64748b;">${item.groupName} (${item.actName || ''})</em></td><td>${item.description} ${commentHTML}</td><td>${item.qty}</td><td>${item.unit}</td><td>${item.price.toLocaleString('en-US', {minimumFractionDigits: 2})}</td><td>${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</td></tr>`;
    });
    
    document.getElementById('printTable').innerHTML = html + `</tbody>`;
    document.getElementById('printGrandTotalVal').textContent = grandTotal.toLocaleString('en-US', {minimumFractionDigits: 2});
}

document.getElementById('previewBtn').addEventListener('click', () => {
    const d = new Date(); const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
    const createdBy = document.getElementById('createdBy').value.trim(); const mobile = document.getElementById('mobileNumber').value.trim();
    populatePrintLayout("DRAFT", formattedDate, createdBy, mobile);
    
    document.body.classList.add('printing-pr'); 
    window.print();
    setTimeout(() => { document.body.classList.remove('printing-pr'); }, 1000);
});

document.getElementById('saveBtnAction').addEventListener('click', async () => {
    const createdBy = document.getElementById('createdBy').value.trim(); const mobile = document.getElementById('mobileNumber').value.trim();
    if (!createdBy || !mobile) { alert("Wait! Please fill in your 'Created By' Name and 'Mobile Number' at the top before saving."); return; }

    const saveBtnAction = document.getElementById('saveBtnAction'); saveBtnAction.disabled = true; saveBtnAction.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        let nextReqNum = 100001; 
        const prRef = dbReq.ref("requisitions");
        
        const snapshot = await prRef.orderByChild("reqNumber").limitToLast(1).once("value");
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const lastNum = child.val().reqNumber;
                nextReqNum = parseInt(lastNum) + 1;
            });
        }

        const d = new Date(); const formattedDate = `${String(d.getDate()).padStart(2, '0')} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${d.getFullYear()}`;
        let grandTotal = 0; cart.forEach(item => grandTotal += (item.qty * item.price));

        await prRef.child(nextReqNum.toString()).set({
            reqNumber: nextReqNum, createdAt: d.toISOString(), dateFormatted: formattedDate,
            vendor: selectedVendor, site: selectedSite, createdBy: createdBy, mobileNumber: mobile, items: cart, totalValue: grandTotal
        });

        populatePrintLayout(nextReqNum, formattedDate, createdBy, mobile);
        
        document.body.classList.add('printing-pr');
        window.print();
        
        setTimeout(() => {
            document.body.classList.remove('printing-pr');
            alert(`Success! Requisition Number ${nextReqNum} has been saved.`);
            sessionStorage.removeItem('pr_session_data'); 
            location.reload(); 
        }, 1000);
        
    } catch (error) { console.error(error); alert("Database Error. Check connection."); } finally { saveBtnAction.disabled = false; saveBtnAction.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save Requisition'; }
});

// ==========================================
// CATALOG IMPORT (GitHub / Excel -> Firebase)
// ==========================================
function updateCatalogImportStats(githubCount, firebaseCount, mergedCount) {
    const el = document.getElementById('catalogImportStats');
    if (!el) return;
    el.innerHTML = `GitHub Item.csv: <strong>${Number(githubCount || 0).toLocaleString()}</strong> · Firebase items: <strong>${Number(firebaseCount || 0).toLocaleString()}</strong> · Searchable after merge: <strong>${Number(mergedCount || 0).toLocaleString()}</strong>`;
}

function setImportProgress(text) {
    const el = document.getElementById('catalogImportProgress');
    if (el) el.textContent = text || '';
}

function normalizeHeader(name) {
    return String(name || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickField(row, aliases) {
    if (!row) return '';
    for (const alias of aliases) {
        if (row[alias] != null && String(row[alias]).trim() !== '') return String(row[alias]).trim();
    }
    const wanted = aliases.map(normalizeHeader);
    for (const key of Object.keys(row)) {
        if (wanted.includes(normalizeHeader(key)) && row[key] != null && String(row[key]).trim() !== '') {
            return String(row[key]).trim();
        }
    }
    return '';
}

function normalizePartCodeKey(code) {
    return String(code || '').trim().replace(/\s+/g, '');
}

function normalizeCatalogRow(row) {
    const partCode = pickField(row, ['Part Code', 'Part code', 'Part No', 'Part Number', 'PartCode', 'part code']);
    if (!partCode) return null;
    const description = pickField(row, ['Description', 'description', 'Item Description']);
    const uom = pickField(row, ['UOM', 'Uom', 'Unit']);
    const groupCode = pickField(row, ['Group Code', 'Group code', 'GroupCode', 'group code']) || (partCode.includes('.') ? partCode.split('.')[0] : '');
    let series = pickField(row, ['Series', 'series']);
    if (!series && partCode.includes('.')) {
        series = partCode.split('.').slice(1).join('.');
    }
    const knownClass = classByCode[pickField(row, ['Class Code', 'Class code', 'Class', 'ClassCode'])];
    const knownGroup = groupRecord(groupCode);
    const groupName = pickField(row, ['Group Name', 'Group name', 'GroupName']) || (knownGroup ? knownGroup.name : '') || (knownClass ? knownClass.groupName : '');
    const classCode = pickField(row, ['Class Code', 'Class code', 'Class', 'ClassCode']) || '';
    const className = pickField(row, ['Class Name', 'Class name', 'ClassName']) || (knownClass ? knownClass.className : '');
    const activityCode = pickField(row, ['Activity Code', 'Activity code', 'ActivityCode']) || (knownClass ? knownClass.activityCode : '');
    const activityName = pickField(row, ['Activity Name', 'Activity name', 'Activity', 'ActivityName']) || (knownClass ? knownClass.activityName : '');
    return {
        "Part Code": partCode,
        "Series": series,
        "Description": description,
        "UOM": uom,
        "Group Code": groupCode,
        "Group Name": groupName,
        "Class Code": classCode,
        "Class Name": className,
        "Activity Code": activityCode,
        "Activity Name": activityName
    };
}

function firebaseItemKeyFromPartCode(partCode) {
    return 'imp_' + String(partCode || '').replace(/[.#$\[\]\/]/g, '_');
}

async function parseCatalogFile(file) {
    const name = (file && file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') throw new Error('Excel library failed to load. Use CSV or refresh the page.');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }
    const text = await file.text();
    return parseCsv(text);
}

async function writeFirebaseBatches(updatesList, onProgress) {
    const BATCH = 400;
    for (let i = 0; i < updatesList.length; i += BATCH) {
        const chunk = updatesList.slice(i, i + BATCH);
        const payload = {};
        chunk.forEach(({ key, record }) => { payload['items/' + key] = record; });
        await dbReq.ref().update(payload);
        if (onProgress) onProgress(Math.min(i + BATCH, updatesList.length), updatesList.length);
    }
}

async function importRowsToFirebase(rawRows, sourceLabel) {
    const modeEl = document.getElementById('importConflictMode');
    const mode = modeEl ? modeEl.value : 'skip';
    const normalized = [];
    const seen = new Set();
    (rawRows || []).forEach((row) => {
        const item = normalizeCatalogRow(row);
        if (!item) return;
        const codeKey = normalizePartCodeKey(item["Part Code"]);
        if (!codeKey || seen.has(codeKey)) return;
        seen.add(codeKey);
        normalized.push(item);
    });
    if (!normalized.length) throw new Error('No usable rows found. Check that the file has a Part Code column.');

    setImportProgress(`Preparing ${normalized.length.toLocaleString()} rows from ${sourceLabel}…`);
    const existing = await loadFirebaseItems(true);
    const byCode = new Map();
    existing.forEach((item) => {
        const code = normalizePartCodeKey(itemPartCode(item));
        if (code) byCode.set(code, item);
    });

    // Fields that upload is allowed to replace on matching Part Codes
    const REPLACE_FIELDS = [
        "Part Code", "Series", "Description", "UOM",
        "Group Code", "Group Name", "Class Code", "Class Name",
        "Activity Code", "Activity Name"
    ];

    const writes = [];
    let skipped = 0;
    let overwrites = 0;
    let created = 0;
    const now = new Date().toISOString();
    normalized.forEach((item) => {
        const codeKey = normalizePartCodeKey(item["Part Code"]);
        const current = byCode.get(codeKey);
        if (current && current.firebaseKey) {
            if (mode === 'skip') { skipped += 1; return; }
            // Overwrite: keep photo / timestamps / other keys, replace catalog fields from file
            const record = { ...current };
            REPLACE_FIELDS.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(item, field)) {
                    record[field] = item[field];
                }
            });
            record.firebaseKey = current.firebaseKey;
            record.UpdatedAt = now;
            record.Source = sourceLabel;
            writes.push({ key: current.firebaseKey, record });
            overwrites += 1;
            return;
        }
        const key = firebaseItemKeyFromPartCode(item["Part Code"]);
        writes.push({
            key,
            record: { ...item, firebaseKey: key, CreatedAt: now, Source: sourceLabel }
        });
        created += 1;
    });

    if (!writes.length) {
        setImportProgress(`Nothing to import. ${skipped.toLocaleString()} existing Part Codes were skipped (conflict mode = Skip). Switch to "Overwrite Firebase with file values" to update them.`);
        return { imported: 0, skipped, overwrites, created, total: normalized.length };
    }

    await writeFirebaseBatches(writes, (done, total) => {
        setImportProgress(`Writing ${done.toLocaleString()} / ${total.toLocaleString()} Firebase records…`);
    });
    const catalogVersion = await bumpCatalogVersion();

    const freshFirebase = await loadFirebaseItems(true);
    const cache = readCatalogCache() || {};
    writeCatalogCache({
        items: [],
        ...lookupRows,
        firebaseItems: freshFirebase,
        catalogVersion
    });
    applyCatalog({
        items: [],
        ...lookupRows,
        firebaseItems: freshFirebase
    }, 'imported');

    setImportProgress(`Done. Updated ${overwrites.toLocaleString()} · created ${created.toLocaleString()} · skipped ${skipped.toLocaleString()} · source ${sourceLabel}.`);
    return { imported: writes.length, skipped, overwrites, created, total: normalized.length };
}

document.getElementById('importGithubItemsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('importGithubItemsBtn');
    if (!canAddItems()) { denyAccess('import items'); return; }
    if (!confirm('Import the public GitHub Item.csv into Firebase now? Existing Firebase Part Codes will follow the conflict setting below.')) return;
    btn.disabled = true;
    try {
        setImportProgress('Downloading GitHub Item.csv…');
        const text = await fetchText(ITEMS_CSV_URL + '?v=' + Date.now());
        const rows = await parseCsv(text);
        const result = await importRowsToFirebase(rows, 'github-import');
        alert(`Import finished.\nUpdated existing: ${result.overwrites || 0}\nCreated new: ${result.created || 0}\nSkipped: ${result.skipped}\nRows read: ${result.total}`);
    } catch (err) {
        console.error(err);
        setImportProgress('Import failed: ' + (err.message || err));
        alert('Import failed: ' + (err.message || err));
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('importFileItemsBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('catalogImportFile');
    const btn = document.getElementById('importFileItemsBtn');
    if (!canAddItems()) { denyAccess('import items'); return; }
    if (!input || !input.files || !input.files[0]) {
        alert('Choose an Excel or CSV file first.');
        return;
    }
    if (!confirm('Import the selected file into Firebase now?\n\n• Matching Part Codes will use the conflict setting below.\n• To replace Series, Description, Group, Class, Activity fields on existing items, choose "Overwrite Firebase with file values".')) return;
    btn.disabled = true;
    try {
        setImportProgress('Reading file…');
        const rows = await parseCatalogFile(input.files[0]);
        const result = await importRowsToFirebase(rows, 'excel-import');
        alert(`Import finished.\nUpdated existing: ${result.overwrites || 0}\nCreated new: ${result.created || 0}\nSkipped: ${result.skipped}\nRows read: ${result.total}`);
    } catch (err) {
        console.error(err);
        setImportProgress('Import failed: ' + (err.message || err));
        alert('Import failed: ' + (err.message || err));
    } finally {
        btn.disabled = false;
    }
});

// ==========================================
// SETTINGS: BACKGROUND IMAGE
// ==========================================

const DEFAULT_PHOTO_FOLDER = "https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/";
const DEFAULT_PHOTO_LIST_URL = "https://raw.githubusercontent.com/DC-database/hub/main/PhotoIndex.csv";
const PHOTO_LIST_CACHE_KEY = 'pr_photo_list_v1';
let photoFileList = [];
let photoPickerContext = { key: null, partNo: '' };
let photoPickerSelected = '';

function photoFolderBase() {
    const s = loadUiSettings();
    let base = (s.photoFolder || DEFAULT_PHOTO_FOLDER).trim();
    if (base && !base.endsWith('/')) base += '/';
    return base;
}

function photoUrlCandidates(fileName) {
    const base = photoFolderBase();
    if (!base || !fileName) return [];
    const stem = String(fileName).trim().replace(/\.(jpg|jpeg|png|webp)$/i, '');
    if (!stem) return [];
    const names = [stem, stem.replace(/[\s_]+/g, '-'), stem.replace(/[\s_-]+/g, '')].filter((name, idx, arr) => name && arr.indexOf(name) === idx);
    const urls = [];
    names.forEach((name) => {
        urls.push(base + encodeURIComponent(name + '.jpg'));
        urls.push(base + encodeURIComponent(name + '.jpeg'));
    });
    return urls;
}

function composePhotoUrl(fileName) {
    return photoUrlCandidates(fileName)[0] || '';
}

let photoShowList = [];
let photoShowIndex = 0;

function showPhotoAt(index) {
    if (!photoShowList.length) return;
    photoShowIndex = (index + photoShowList.length) % photoShowList.length;
    const item = photoShowList[photoShowIndex];
    const img = document.getElementById('photoViewImage');
    const heading = document.getElementById('photoViewTitle');
    const count = document.getElementById('photoViewCount');
    if (heading) heading.textContent = item.title || 'Photo';
    const urls = (item.urls && item.urls.length) ? item.urls.slice() : (item.url ? [item.url] : []);
    if (img) {
        img.setAttribute('referrerpolicy', 'no-referrer');
        let n = 0;
        img.onerror = () => {
            n += 1;
            if (n < urls.length) img.src = urls[n];
        };
        img.src = urls[0] || '';
    }
    if (count) count.textContent = (photoShowIndex + 1) + ' / ' + photoShowList.length;
}

window.openPhotoView = function(url, title) {
    if (!url) return;
    photoShowList = [{ url, title: title || 'Photo' }];
    showPhotoAt(0);
    document.getElementById('photoViewModal')?.classList.add('active');
};

window.openCartPhotoShow = function(startIndex, currentSrc) {
    photoShowList = cart.map((item, idx) => {
        const source = allSearchableItems.find(i => itemPartCode(i) === String(item.partNo || ''));
        const fileName = item.photoFile || (source && (source.PhotoFile || source.photoFile || source.photoName)) || '';
        const urls = photoUrlCandidates(fileName);
        if (idx === startIndex && currentSrc) urls.unshift(currentSrc);
        const unique = Array.from(new Set(urls.filter(Boolean)));
        return unique.length ? { urls: unique, title: (item.partNo || '') + ' | ' + (item.description || '') } : null;
    }).filter(Boolean);
    if (!photoShowList.length) return;
    const start = currentSrc ? photoShowList.findIndex((row) => (row.urls || []).indexOf(currentSrc) !== -1) : (startIndex || 0);
    showPhotoAt(start >= 0 ? start : 0);
    document.getElementById('photoViewModal')?.classList.add('active');
};
document.getElementById('closePhotoViewBtn')?.addEventListener('click', () => {
    document.getElementById('photoViewModal')?.classList.remove('active');
});
document.getElementById('photoViewPrevBtn')?.addEventListener('click', () => showPhotoAt(photoShowIndex - 1));
document.getElementById('photoViewNextBtn')?.addEventListener('click', () => showPhotoAt(photoShowIndex + 1));
document.getElementById('createItemPhotoPreview')?.addEventListener('click', () => {
    const img = document.getElementById('createItemPhotoPreview');
    if (img && img.src && img.style.display !== 'none') openPhotoView(img.src, document.getElementById('createCodeTag')?.textContent || 'Photo');
});

function itemPhotoUrl(partNo, item) {
    const fileName = item && (item.PhotoFile || item.photoFile || item.photoName);
    if (!fileName) return '';
    const bare = String(fileName).replace(/\.[a-z0-9]+$/i, '');
    if (/^\d+(\.\d+)?$/.test(bare)) return '';
    return composePhotoUrl(fileName);
}

function extractPhotoFileName(row) {
    return String(
        row.photoName || row.PhotoName || row.File || row.file || row.Filename || row.filename ||
        row.Name || row.name || row.Photo || row.photo || row['File Name'] || row['file name'] || ''
    ).trim();
}

async function loadPhotoFileList(force) {
    if (!force && photoFileList.length) return photoFileList;
    try {
        const cached = JSON.parse(localStorage.getItem(PHOTO_LIST_CACHE_KEY) || 'null');
        if (!force && cached && Array.isArray(cached.files) && Date.now() - cached.savedAt < 12 * 60 * 60 * 1000) {
            photoFileList = cached.files;
            return photoFileList;
        }
    } catch (err) {}
    const s = loadUiSettings();
    const url = (s.photoListUrl || DEFAULT_PHOTO_LIST_URL).trim();
    const text = await fetchText(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now());
    const rows = await parseCsv(text);
    const files = [];
    rows.forEach((row) => {
        const name = extractPhotoFileName(row);
        if (name) files.push(name);
    });
    photoFileList = Array.from(new Set(files));
    try { localStorage.setItem(PHOTO_LIST_CACHE_KEY, JSON.stringify({ files: photoFileList, savedAt: Date.now() })); } catch (err) {}
    return photoFileList;
}

function renderPhotoPickerList(query) {
    const box = document.getElementById('photoPickerList');
    if (!box) return;
    let q = String(query || '').toLowerCase().trim();
    if (/^\d+(\.\d+)?$/.test(q)) q = '';
    const qKey = q.replace(/[\s_-]+/g, '');
    const matches = photoFileList.filter((name) => {
        if (!q) return true;
        const lower = name.toLowerCase();
        return lower.includes(q) || lower.replace(/[\s_-]+/g, '').includes(qKey);
    }).slice(0, 120);
    if (!photoFileList.length) {
        box.innerHTML = '<div class="suggestion-item photo-empty">No photo list loaded. Check GitHub PhotoIndex.csv.</div>';
        return;
    }
    if (!matches.length) {
        box.innerHTML = '<div class="suggestion-item photo-empty">No matching photo names</div>';
        return;
    }
    box.innerHTML = matches.map((name) => `<div class="suggestion-item" data-photo-file="${String(name).replace(/"/g, '&quot;')}">${name}</div>`).join('');
    box.querySelectorAll('[data-photo-file]').forEach((el) => {
        el.onclick = () => {
            photoPickerSelected = el.getAttribute('data-photo-file') || '';
            const label = document.getElementById('photoPickerChosen');
            if (label) label.textContent = 'Selected: ' + photoPickerSelected + '  →  click Save photo tag';
            box.querySelectorAll('.suggestion-item').forEach((row) => row.style.background = '');
            el.style.background = '#dbeafe';
        };
    });
}

async function savePickedPhoto(fileName) {
    const partNo = photoPickerContext.partNo;
    const current = allSearchableItems.find(i => (photoPickerContext.key && i.firebaseKey === photoPickerContext.key) || itemPartCode(i) === String(partNo));
    const itemKey = photoPickerContext.key || (current && current.firebaseKey) || firebaseItemKeyFromPartCode(partNo);
    const photoURL = composePhotoUrl(fileName, partNo);
    await dbReq.ref('items').child(itemKey).update({
        "Part Code": partNo,
        PhotoFile: fileName || '',
        PhotoURL: photoURL,
        firebaseKey: itemKey,
        PhotoUpdatedAt: new Date().toISOString()
    });
    if (current) {
        current.PhotoFile = fileName || '';
        current.PhotoURL = photoURL;
        current.firebaseKey = itemKey;
    } else {
        allSearchableItems.push({ "Part Code": partNo, PhotoFile: fileName || '', PhotoURL: photoURL, firebaseKey: itemKey });
    }
    document.getElementById('photoPickerModal')?.classList.remove('active');
    if (document.getElementById('searchInput').value.trim().length >= 2) {
        renderSearchResults(document.getElementById('searchInput').value);
    }
}

window.updateItemPhoto = async function(key, partNo, itemName) {
    if (!canUpdatePhotos()) { denyAccess('update photos'); return; }
    const label = String(itemName || '').trim();
    photoPickerContext = { key, partNo, itemName: label };
    const title = document.getElementById('photoPickerTitle');
    if (title) title.textContent = partNo + (label ? ' | ' + label : '');
    const search = document.getElementById('photoPickerSearch');
    if (search) search.value = label;
    document.getElementById('photoPickerModal')?.classList.add('active');
    const box = document.getElementById('photoPickerList');
    if (box) box.innerHTML = '<div class="suggestion-item">Loading photo list…</div>';
    try {
        await loadPhotoFileList(true);
        renderPhotoPickerList(label);
    } catch (err) {
        if (box) box.innerHTML = '<div class="suggestion-item">Could not load GitHub PhotoIndex.csv.</div>';
    }
};

document.getElementById('closePhotoPickerBtn')?.addEventListener('click', () => {
    document.getElementById('photoPickerModal')?.classList.remove('active');
});
document.getElementById('photoPickerSearch')?.addEventListener('input', (e) => {
    renderPhotoPickerList(e.target.value);
});
document.getElementById('photoPickerSearch')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!photoPickerSelected) {
        const first = document.querySelector('#photoPickerList [data-photo-file]');
        if (first) {
            photoPickerSelected = first.getAttribute('data-photo-file') || '';
            const label = document.getElementById('photoPickerChosen');
            if (label) label.textContent = 'Selected: ' + photoPickerSelected;
        }
    }
    if (photoPickerSelected) savePickedPhoto(photoPickerSelected);
});
document.getElementById('photoPickerSaveBtn')?.addEventListener('click', () => {
    if (!photoPickerSelected) { alert('Click a photo name first, then Save photo tag.'); return; }
    savePickedPhoto(photoPickerSelected);
});
document.getElementById('photoPickerClearBtn')?.addEventListener('click', () => {
    photoPickerSelected = '';
    savePickedPhoto('');
});

function bindEnterToClick(inputIds, buttonId) {
    inputIds.forEach((id) => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            document.getElementById(buttonId)?.click();
        });
    });
}
bindEnterToClick(['accessLoginMobile', 'accessLoginPassword'], 'accessLoginBtn');
bindEnterToClick(['accessOwnPassword'], 'accessChangeOwnPasswordBtn');
bindEnterToClick(['accessNewName', 'accessNewMobile', 'accessNewPassword'], 'saveAccessUserBtn');
bindEnterToClick(['bgImageUrl', 'photoFolderUrl', 'photoListUrl'], 'saveBgBtn');

const UI_SETTINGS_KEY = 'pr_ui_settings_v1';

function loadUiSettings() {
    try { return JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || '{}'); }
    catch (e) { return {}; }
}
function saveUiSettings(s) {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(s));
}
const BG_DB = 'pr_bg_db';
function openBgDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BG_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('bg');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function saveBgFile(file) {
    const db = await openBgDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction('bg', 'readwrite');
        tx.objectStore('bg').put(file, 'file');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}
async function loadBgFile() {
    try {
        const db = await openBgDb();
        return await new Promise((resolve) => {
            const tx = db.transaction('bg', 'readonly');
            const req = tx.objectStore('bg').get('file');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) { return null; }
}
async function clearBgFile() {
    try {
        const db = await openBgDb();
        await new Promise((resolve) => {
            const tx = db.transaction('bg', 'readwrite');
            tx.objectStore('bg').delete('file');
            tx.oncomplete = resolve;
            tx.onerror = resolve;
        });
    } catch (e) {}
}
let currentBgObjectUrl = '';
async function applyBackground(settings) {
    const s = settings || loadUiSettings();
    document.documentElement.style.setProperty('--bg-blur', (s.bgBlur ?? 2) + 'px');
    document.documentElement.style.setProperty('--bg-dim', String((s.bgDim ?? 12) / 100));
    const file = await loadBgFile();
    if (file) {
        if (currentBgObjectUrl) URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = URL.createObjectURL(file);
        document.documentElement.style.setProperty('--bg-image', `url("${currentBgObjectUrl}")`);
        return;
    }
    const url = (s.bgUrl || '').trim();
    if (url) document.documentElement.style.setProperty('--bg-image', `url("${url.replace(/"/g, '')}")`);
    else document.documentElement.style.removeProperty('--bg-image');
}
applyBackground();

const SHARED_BG_PATH = "appSettings/backgroundUrl";
function saveSharedBackground(url) {
    return dbReq.ref(SHARED_BG_PATH).set(url || null);
}
if (isPrimaryTab) dbReq.ref(SHARED_BG_PATH).on("value", (snap) => {
    const url = snap.val();
    if (!url) return;
    const s = loadUiSettings();
    s.bgUrl = url;
    saveUiSettings(s);
    const input = document.getElementById('bgImageUrl');
    if (input) input.value = url;
    applyBackground(s);
});

const SHARED_PHOTO_FOLDER_PATH = "appSettings/photoFolder";
if (isPrimaryTab) dbReq.ref(SHARED_PHOTO_FOLDER_PATH).on("value", (snap) => {
    const folder = snap.val();
    if (!folder) return;
    const s = loadUiSettings();
    s.photoFolder = folder;
    saveUiSettings(s);
    const input = document.getElementById('photoFolderUrl');
    if (input) input.value = folder;
});

const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', () => {
        if (!isAccessAdmin()) { denyAccess('open settings'); return; }
        const s = loadUiSettings();
        document.getElementById('bgImageUrl').value = s.bgUrl || '';
        document.getElementById('bgBlur').value = s.bgBlur ?? 2;
        document.getElementById('bgDim').value = s.bgDim ?? 12;
        document.getElementById('photoFolderUrl').value = s.photoFolder || DEFAULT_PHOTO_FOLDER;
        document.getElementById('photoListUrl').value = s.photoListUrl || DEFAULT_PHOTO_LIST_URL;
        document.getElementById('photoExt').value = s.photoExt || 'jpeg';
        const groqEl = document.getElementById('groqApiKey');
        if (groqEl) groqEl.value = s.groqKey || '';
        const groqModelEl = document.getElementById('groqModel');
        if (groqModelEl) groqModelEl.value = s.groqModel || DEFAULT_GROQ_MODEL;
        const nameEl = document.getElementById('bgFileName');
        loadBgFile().then(f => { if (nameEl) nameEl.textContent = f ? ('Attached: ' + (f.name || 'photo')) : ''; });
        applyAccessUI();
        if (isAccessAdmin()) loadAccessUsers().then(renderAccessUserList);
        settingsModal.classList.add('active');
    });
}
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
document.getElementById('saveBgBtn')?.addEventListener('click', () => {
    const prev = loadUiSettings();
    const s = {
        ...prev,
        bgUrl: document.getElementById('bgImageUrl').value.trim(),
        bgBlur: Number(document.getElementById('bgBlur').value),
        bgDim: Number(document.getElementById('bgDim').value),
        photoFolder: document.getElementById('photoFolderUrl').value.trim() || DEFAULT_PHOTO_FOLDER,
        photoListUrl: document.getElementById('photoListUrl').value.trim() || DEFAULT_PHOTO_LIST_URL,
        photoExt: document.getElementById('photoExt').value,
        groqKey: (document.getElementById('groqApiKey')?.value ?? prev.groqKey ?? '').trim(),
        groqModel: (document.getElementById('groqModel')?.value || prev.groqModel || DEFAULT_GROQ_MODEL).trim()
    };
    saveUiSettings(s);
    applyBackground(s);
    if (s.bgUrl) saveSharedBackground(s.bgUrl);
    dbReq.ref(SHARED_PHOTO_FOLDER_PATH).set(s.photoFolder || null);
    settingsModal.classList.remove('active');
});
document.getElementById('bgImageFile')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await saveBgFile(file);
    const s = loadUiSettings();
    s.bgUrl = '';
    saveUiSettings(s);
    document.getElementById('bgImageUrl').value = '';
    const nameEl = document.getElementById('bgFileName');
    if (nameEl) nameEl.textContent = 'Attached: ' + file.name;
    applyBackground(s);
});
document.getElementById('clearBgBtn')?.addEventListener('click', async () => {
    const s = loadUiSettings();
    s.bgUrl = '';
    saveUiSettings(s);
    document.getElementById('bgImageUrl').value = '';
    const fileInput = document.getElementById('bgImageFile');
    if (fileInput) fileInput.value = '';
    const nameEl = document.getElementById('bgFileName');
    if (nameEl) nameEl.textContent = '';
    await clearBgFile();
    applyBackground(s);
    saveSharedBackground(null);
});

document.getElementById('openFullCartBtn')?.addEventListener('click', () => {
    renderFullCart();
    document.getElementById('fullCartView').classList.add('active');
    document.body.classList.add('full-cart-open');
});
document.getElementById('closeFullCartBtn')?.addEventListener('click', () => {
    document.getElementById('fullCartView').classList.remove('active');
    document.body.classList.remove('full-cart-open');
    renderCart();
});
document.getElementById('fullPreviewBtn')?.addEventListener('click', () => document.getElementById('previewBtn')?.click());
document.getElementById('fullSaveBtn')?.addEventListener('click', () => document.getElementById('saveBtnAction')?.click());

document.getElementById('fullCopyExcelBtn')?.addEventListener('click', copyCartForExcel);
document.getElementById('fullCopyReqEntryBtn')?.addEventListener('click', copyRequisitionEntry);

const GITHUB_PHOTO_API = "https://api.github.com/repos/DC-database/hub/contents/photo?ref=main";
const GITHUB_PHOTO_RAW = "https://raw.githubusercontent.com/DC-database/hub/main/photo/";

document.getElementById('browseGithubPhotosBtn')?.addEventListener('click', async () => {
    const grid = document.getElementById('githubPhotoGrid');
    if (!grid) return;
    grid.innerHTML = '<p class="hint">Loading photos…</p>';
    try {
        const res = await fetch(GITHUB_PHOTO_API);
        const files = await res.json();
        const images = (Array.isArray(files) ? files : []).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
        if (!images.length) { grid.innerHTML = '<p class="hint">No images found in /photo.</p>'; return; }
        grid.innerHTML = '';
        images.forEach(f => {
            const url = f.download_url || (GITHUB_PHOTO_RAW + f.name);
            const img = document.createElement('img');
            img.src = url;
            img.alt = f.name;
            img.title = f.name;
            img.onclick = () => {
                grid.querySelectorAll('img').forEach(i => i.classList.remove('selected'));
                img.classList.add('selected');
                document.getElementById('bgImageUrl').value = url;
                const s = loadUiSettings();
                s.bgUrl = url;
                saveUiSettings(s);
                clearBgFile();
                applyBackground(s);
                saveSharedBackground(url);
            };
            grid.appendChild(img);
        });
    } catch (err) {
        grid.innerHTML = '<p class="hint">Could not list GitHub folder. Check the repo is public.</p>';
    }
});

// ==========================================
// ITEM ASSISTANT
// 1. You type the item (e.g. "nail").  2. It asks the main category (1-5).
// 3. It suggests several Class + Group placements, learned from how similar items are
//    already filed in the catalog. With a Groq key in Settings, an AI ranks them too.
// Works offline from the cached catalog: no Firebase downloads.
// ==========================================

// <assistant-engine>
const ASSIST_STOP = new Set(['for', 'the', 'and', 'with', 'of', 'to', 'in', 'on', 'an', 'new', 'item', 'items', 'need', 'needs', 'want', 'some', 'use', 'used', 'type', 'kind', 'please']);

function assistStem(t) {
    if (t.length > 4 && /(ches|shes|sses|xes|zes)$/.test(t)) return t.slice(0, -2);
    if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
    if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
    return t;
}

function assistTokens(text) {
    return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1 && !ASSIST_STOP.has(t)).map(assistStem);
}

let assistantIndex = null;
let assistantGroupUsage = null; // activityCode -> groupCode -> Map(classCode -> count)

function invalidateAssistantIndex() { assistantIndex = null; assistantGroupUsage = null; }

function getAssistantIndex() {
    if (assistantIndex) return assistantIndex;
    assistantIndex = [];
    assistantGroupUsage = {};
    allSearchableItems.forEach(item => {
        const partCode = itemPartCode(item);
        if (!partCode) return;
        const classCode = String(item["Class Code"] || '').trim();
        const cls = classByCode[classCode];
        const entry = {
            item, partCode,
            desc: String(item["Description"] || ''),
            tokens: new Set(assistTokens(item["Description"])),
            classCode,
            activityCode: String((cls && cls.activityCode) || item["Activity Code"] || '').trim(),
            groupCode: String(item["Group Code"] || partCode.split('.')[0] || '').trim()
        };
        assistantIndex.push(entry);
        if (cls) {
            const byGroup = assistantGroupUsage[entry.activityCode] || (assistantGroupUsage[entry.activityCode] = {});
            const m = byGroup[entry.groupCode] || (byGroup[entry.groupCode] = new Map());
            m.set(classCode, (m.get(classCode) || 0) + 1);
        }
    });
    return assistantIndex;
}

function assistScoreItem(entry, qTokens) {
    let got = 0; let total = 0; let wordHit = false;
    for (const q of qTokens) {
        const w = /\d/.test(q) ? 0.5 : 1;
        total += w;
        if (entry.tokens.has(q)) { got += w; if (w === 1) wordHit = true; continue; }
        if (q.length >= 3) {
            for (const t of entry.tokens) {
                if (t.startsWith(q) || (t.length >= 4 && q.startsWith(t))) { got += 0.6 * w; if (w === 1) wordHit = true; break; }
            }
        }
    }
    return wordHit && total ? got / total : 0;
}

// Class in this category that best fits a group: the class whose default it is, else the class most used with it.
function bestClassForGroup(groupCode, activityCode) {
    const list = classesByActivity[activityCode] || [];
    const own = list.find(c => c.groupId === groupCode);
    if (own) return own;
    getAssistantIndex();
    const usage = assistantGroupUsage[activityCode] && assistantGroupUsage[activityCode][groupCode];
    if (!usage) return null;
    let best = null; let bestN = 0;
    usage.forEach((n, code) => { if (n > bestN && classByCode[code]) { best = classByCode[code]; bestN = n; } });
    return bestN >= 3 ? best : null;
}

// General classes of a category (Sundries, Consumables, Miscellaneous), busiest first.
function genericClasses(activityCode) {
    getAssistantIndex();
    const counts = {};
    Object.values(assistantGroupUsage[activityCode] || {}).forEach(m => m.forEach((n, code) => { counts[code] = (counts[code] || 0) + n; }));
    return (classesByActivity[activityCode] || [])
        .filter(c => /sundr|consumab|miscell|general/i.test(c.className))
        .sort((a, b) => (counts[b.classCode] || 0) - (counts[a.classCode] || 0));
}

function assistAnalyze(query, activityCode) {
    const qTokens = Array.from(new Set(assistTokens(query)));
    const index = getAssistantIndex();
    const scored = [];
    if (qTokens.length) index.forEach(e => { const s = assistScoreItem(e, qTokens); if (s >= 0.5) scored.push({ e, s }); });
    scored.sort((a, b) => b.s - a.s);
    const inCat = scored.filter(x => x.e.activityCode === activityCode);
    const outCat = scored.filter(x => x.e.activityCode !== activityCode);
    const options = new Map();

    function addOpt(cls, group, weight, source, example) {
        if (!cls || !group || !group.code || cls.activityCode !== activityCode) return null;
        const key = cls.classCode + '|' + group.code;
        let o = options.get(key);
        if (!o) { o = { key, cls, group: { code: group.code, name: group.name }, score: 0, bonus: 0, maxS: 0, sumSq: 0, count: 0, examples: [], sources: new Set(), from: '' }; options.set(key, o); }
        o.sources.add(source);
        if (example) {
            // Catalog evidence: best match counts most, volume counts with diminishing returns.
            o.count += 1;
            o.maxS = Math.max(o.maxS, weight);
            o.sumSq += weight * weight;
            if (o.examples.length < 3) o.examples.push(example);
        } else {
            o.bonus += weight;
        }
        o.score = (o.count ? 3 * o.maxS + 1.5 * Math.log2(1 + o.sumSq) : 0) + o.bonus;
        return o;
    }

    // 1. How matching items are already filed in this category (strongest signal).
    inCat.forEach(({ e, s }) => {
        const cls = classByCode[e.classCode];
        const g = groupRecord(e.groupCode) || { code: e.groupCode, name: e.item["Group Name"] || e.groupCode };
        addOpt(cls, g, s, 'catalog', { partCode: e.partCode, desc: e.desc });
    });

    // 2. Class names and group names that contain the words.
    (classesByActivity[activityCode] || []).forEach(c => {
        const names = new Set(assistTokens(c.className));
        const hit = qTokens.filter(q => names.has(q)).length;
        if (hit) addOpt(c, classDefaultGroup(c), 2.5 * hit / qTokens.length, 'class-name');
    });
    allGroups.forEach(g => {
        const names = new Set(assistTokens(g.name));
        const hit = qTokens.filter(q => names.has(q)).length;
        if (!hit) return;
        const cls = bestClassForGroup(g.code, activityCode);
        if (cls) addOpt(cls, g, 2 * hit / qTokens.length, 'group-name');
    });

    // 3. Only filed under other categories so far: keep the group, pick the best class here.
    if (options.size < 3 && outCat.length) {
        const tally = new Map();
        outCat.slice(0, 80).forEach(({ e, s }) => {
            const t = tally.get(e.groupCode) || { w: 0, example: null, act: e.activityCode };
            t.w += s;
            if (!t.example) t.example = { partCode: e.partCode, desc: e.desc };
            tally.set(e.groupCode, t);
        });
        Array.from(tally.entries()).sort((a, b) => b[1].w - a[1].w).slice(0, 3).forEach(([gCode, t]) => {
            const g = groupRecord(gCode);
            if (!g) return;
            const cls = bestClassForGroup(gCode, activityCode) || genericClasses(activityCode)[0];
            const o = addOpt(cls, g, 0.6 + 0.1 * t.w, 'other-category');
            if (o && !o.from) { o.from = t.act; o.elsewhere = t.example; }
        });
    }

    // 4. Nothing specific: offer the general classes of this category (or all of them if it is small).
    if (options.size < 2) {
        const all = classesByActivity[activityCode] || [];
        const generic = genericClasses(activityCode);
        (generic.length ? generic : (all.length <= 6 ? all : [])).slice(0, 3).forEach(c => addOpt(c, classDefaultGroup(c), 0.3, 'general'));
    }

    const otherCats = {};
    outCat.forEach(({ e }) => { otherCats[e.activityCode] = (otherCats[e.activityCode] || 0) + 1; });
    return {
        qTokens,
        exact: inCat.filter(x => x.s >= 0.99).slice(0, 5).map(x => x.e),
        options: Array.from(options.values()).sort((a, b) => b.score - a.score).slice(0, 6),
        otherCats,
        matchesAnywhere: scored.filter(x => x.s >= 0.99).length
    };
}
// </assistant-engine>

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function groqSettings() {
    const s = loadUiSettings();
    return { key: String(s.groqKey || '').trim(), model: String(s.groqModel || DEFAULT_GROQ_MODEL).trim() };
}

function parseAssistantJson(text) {
    const raw = String(text || '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('the AI did not return a suggestion');
    return JSON.parse(raw.slice(start, end + 1));
}

async function askGroqForPlacement(query, activity, analysis) {
    const { key, model } = groqSettings();
    if (!key) return null;
    const classes = (classesByActivity[activity.code] || []).map(c => `${c.classCode} | ${c.className} | default group ${c.groupId} ${(classDefaultGroup(c) || {}).name || ''}`).join('\n');
    const groups = allGroups.map(g => `${g.code} | ${g.name}`).join('\n');
    const evidence = analysis.options.filter(o => o.count).map(o => `class ${o.cls.classCode} ${o.cls.className} + group ${o.group.code} ${o.group.name}: ${o.count} similar items, e.g. ${o.examples.map(x => x.desc).join('; ')}`).join('\n') || 'none';
    const prompt = `A construction company's procurement team needs a new catalog item.
Item: "${query}"
Main category chosen: ${activity.code} ${activity.name}

Rules:
- The class must be one of the classes listed for this category (each class is locked to its category).
- The group can be the class's default group or any group from the group list.
- Prefer how similar items are already filed when that makes sense.
- Give 2 to 5 options, best first, each with one short reason a site engineer would understand.
- Also suggest a catalog description in the house style: UPPERCASE, size or spec in brackets, e.g. WOOD NAIL (2 INCH).

Classes in ${activity.name}:
${classes}

Groups:
${groups}

How similar items are already filed in ${activity.name}:
${evidence}

Reply with JSON only:
{"description":"","options":[{"classCode":"","groupCode":"","why":""}]}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 700,
                messages: [
                    { role: 'system', content: 'You file construction materials into a company catalog. Reply with JSON only.' },
                    { role: 'user', content: prompt }
                ]
            })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body.error && body.error.message) || ('Groq error ' + res.status));
        return parseAssistantJson(body.choices?.[0]?.message?.content || '');
    } finally {
        clearTimeout(timer);
    }
}

// Put AI picks first (only valid class/group codes), then the catalog-based ones.
function mergeAiOptions(analysis, ai, activityCode) {
    if (!ai || !Array.isArray(ai.options)) return analysis.options;
    const byKey = new Map(analysis.options.map(o => [o.key, o]));
    const merged = [];
    ai.options.forEach(opt => {
        const cls = classByCode[String(opt.classCode || '').trim()];
        const g = groupRecord(String(opt.groupCode || '').trim());
        if (!cls || !g || cls.activityCode !== activityCode) return;
        const key = cls.classCode + '|' + g.code;
        if (merged.some(o => o.key === key)) return;
        const o = byKey.get(key) || { key, cls, group: { code: g.code, name: g.name }, score: 0, count: 0, examples: [], sources: new Set() };
        o.ai = true;
        o.aiWhy = String(opt.why || '').trim();
        merged.push(o);
        byKey.delete(key);
    });
    return merged.concat(Array.from(byKey.values())).slice(0, 6);
}

function shortText(text, max) {
    const t = String(text || '').trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function optionWhy(o) {
    if (o.ai && o.aiWhy) return o.aiWhy;
    if (o.count) return `${o.count} similar item${o.count === 1 ? ' is' : 's are'} filed here, e.g. ${shortText(o.examples[0].desc, 60)}`;
    if (o.sources.has('class-name')) return 'The class name matches your words.';
    if (o.sources.has('group-name')) return 'The group name matches your words.';
    if (o.sources.has('other-category')) {
        const act = activityByCode(o.from);
        return `Similar items use this group in ${act ? act.code + ' ' + act.name : 'another category'}${o.elsewhere ? ', e.g. ' + shortText(o.elsewhere.desc, 60) : ''}.`;
    }
    return 'General class for this category.';
}

// ---------- Assistant drawer UI ----------
const assistantUi = { query: '', activityCode: '', options: [], description: '', busy: false, started: false };
const assistantDrawer = $id('assistantDrawer');
const assistantThread = $id('assistantThread');
const assistantInput = $id('assistantInput');

function assistantModeText() {
    return groqSettings().key ? 'AI (Groq) + your catalog' : 'Suggestions from your catalog';
}

function assistantPost(role, html) {
    const el = document.createElement('div');
    el.className = 'msg ' + (role === 'user' ? 'msg-user' : 'msg-bot');
    el.innerHTML = html;
    assistantThread.appendChild(el);
    // Show the start of a new answer, not its end.
    assistantThread.scrollTop = role === 'user' ? assistantThread.scrollHeight : Math.max(0, el.offsetTop - 12);
    return el;
}

function categoryChipsHtml(exclude) {
    return `<div class="cat-chips">${activityList.filter(a => a.code !== exclude).map(a => `<button type="button" class="cat-chip act-${escapeHtml(a.code)}" data-assist-cat="${escapeHtml(a.code)}"><span class="cat-num">${escapeHtml(a.code)}</span>${escapeHtml(a.name)}</button>`).join('')}</div>`;
}

function assistantIntro() {
    assistantThread.innerHTML = '';
    assistantPost('bot', `<p>Tell me the item you need, like <em>wood nail 2 inch</em> or <em>cable 4mm</em>.</p><p>I'll ask which main category it's for, then show where it fits: a class and a group, with the part code prefix.</p>${groqSettings().key ? '' : '<p class="muted">Suggestions come from how your existing items are filed. An admin can add a free Groq key in Settings to have an AI rank them too.</p>'}`);
    const mode = $id('assistantMode');
    if (mode) mode.textContent = assistantModeText();
}

function openAssistant(query, autoSend) {
    if (!assistantUi.started) { assistantIntro(); assistantUi.started = true; }
    const mode = $id('assistantMode');
    if (mode) mode.textContent = assistantModeText();
    assistantDrawer.classList.add('open');
    assistantDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('assistant-open');
    const q = String(query || '').trim();
    if (q && autoSend && q.toLowerCase() !== assistantUi.query.toLowerCase()) assistantAskItem(q);
    else if (q) assistantInput.value = q;
    setTimeout(() => assistantInput.focus(), 60);
}
window.openAssistant = openAssistant;

function closeAssistant() {
    assistantDrawer.classList.remove('open');
    assistantDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('assistant-open');
}

function assistantAskItem(query) {
    const q = String(query || '').trim();
    if (!q) return;
    assistantInput.value = '';
    assistantPost('user', escapeHtml(q));
    if (!catalogReady || !activityList.length) {
        assistantPost('bot', '<p>The catalog is still loading. Try again in a moment.</p>');
        return;
    }
    if (!assistTokens(q).length) {
        assistantPost('bot', '<p>Type at least one word that describes the item, like <em>nail</em> or <em>pvc pipe</em>.</p>');
        return;
    }
    assistantUi.query = q;
    assistantUi.activityCode = '';
    const anywhere = assistAnalyze(q, '__none__').matchesAnywhere;
    const existing = anywhere
        ? `<p class="note-line"><i class="fa-solid fa-circle-info"></i> ${anywhere.toLocaleString()} item${anywhere === 1 ? '' : 's'} like this ${anywhere === 1 ? 'is' : 'are'} already in the catalog. <button type="button" class="link-btn" data-assist-search>Show in search</button></p>`
        : '';
    assistantPost('bot', `${existing}<p>Which main category is <strong>${escapeHtml(q)}</strong> for?</p>${categoryChipsHtml('')}`);
}

async function assistantRunCategory(code) {
    const activity = activityByCode(code);
    if (!activity || !assistantUi.query || assistantUi.busy) return;
    assistantUi.busy = true;
    assistantUi.activityCode = code;
    assistantPost('user', `${escapeHtml(activity.code)} ${escapeHtml(activity.name)}`);
    const wait = assistantPost('bot', `<p class="thinking"><i class="fa-solid fa-spinner fa-spin"></i> Checking where similar items sit in ${escapeHtml(activity.name)}…</p>`);
    const analysis = assistAnalyze(assistantUi.query, code);
    let ai = null; let aiNote = '';
    if (groqSettings().key) {
        try { ai = await askGroqForPlacement(assistantUi.query, activity, analysis); }
        catch (err) { aiNote = `AI is unavailable right now (${err.name === 'AbortError' ? 'timed out' : (err.message || err)}). These picks come from your catalog.`; }
    }
    const options = mergeAiOptions(analysis, ai, code);
    assistantUi.options = options;
    assistantUi.description = (ai && ai.description ? String(ai.description) : assistantUi.query).trim().toUpperCase();
    wait.remove();

    let html = '';
    if (analysis.exact.length) {
        html += `<div class="assist-existing"><p><strong>Already in ${escapeHtml(activity.name)}.</strong> Check these before creating a new one:</p>${analysis.exact.map(e => `
            <div class="assist-existing-row">${partCodeChipHtml(e.partCode)}<span class="result-desc">${escapeHtml(e.desc)}</span><button type="button" class="add-btn" data-assist-add="${escapeHtml(e.partCode)}"><i class="fa-solid fa-plus"></i> Add</button></div>`).join('')}</div>`;
    }
    if (options.length) {
        html += `<p>You can file <strong>${escapeHtml(assistantUi.query)}</strong> in ${escapeHtml(activity.code)} ${escapeHtml(activity.name)} under:</p>`;
        html += options.map((o, i) => {
            const def = classDefaultGroup(o.cls);
            const isDefault = def && def.code === o.group.code;
            return `<div class="assist-option${i === 0 ? ' is-best' : ''}">
                <div class="assist-option-head">
                    <span class="code-chip"><span class="code-chip-prefix">${escapeHtml(o.group.code)}</span><span class="code-chip-dot">.</span>series</span>
                    ${o.ai ? '<span class="badge badge-ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI pick</span>' : ''}
                    ${o.count ? `<span class="badge">${o.count} in catalog</span>` : ''}
                    ${!o.ai && !o.count && !o.sources.has('class-name') && !o.sources.has('group-name') ? '<span class="badge badge-weak">Weaker match</span>' : ''}
                </div>
                <dl class="assist-kv">
                    <dt>Class</dt><dd>${escapeHtml(o.cls.classCode)} ${escapeHtml(o.cls.className)}</dd>
                    <dt>Group</dt><dd>${escapeHtml(o.group.code)} ${escapeHtml(o.group.name)}${isDefault ? ' <span class="muted">(class default)</span>' : ''}</dd>
                </dl>
                <p class="why">${escapeHtml(optionWhy(o))}</p>
                <button type="button" class="btn btn-accent btn-sm" data-assist-create="${i}"><i class="fa-solid fa-plus"></i> ${canAddItems() ? 'Create item here' : 'Sign in to create'}</button>
            </div>`;
        }).join('');
    } else {
        html += `<p>I couldn't find a good fit in ${escapeHtml(activity.name)}. Try another category, or open Create item and pick the class yourself.</p>`;
    }
    const others = Object.keys(analysis.otherCats).filter(k => activityByCode(k));
    if (others.length && !analysis.exact.length) {
        html += `<p class="note-line"><i class="fa-solid fa-circle-info"></i> Similar items exist in ${others.map(k => { const a = activityByCode(k); return `${escapeHtml(a.code)} ${escapeHtml(a.name)}`; }).join(', ')}.</p>`;
    }
    if (aiNote) html += `<p class="note-line warn"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(aiNote)}</p>`;
    html += `<p class="muted">Different category?</p>${categoryChipsHtml(code)}`;
    assistantPost('bot', html);
    assistantUi.busy = false;
}

function assistantCreate(index) {
    const o = assistantUi.options[index];
    if (!o) return;
    if (!canAddItems()) {
        assistantPost('bot', `<p>Creating items needs an account with Add access. Sign in, or send this to someone who has it: class <strong>${escapeHtml(o.cls.classCode)} ${escapeHtml(o.cls.className)}</strong>, group <strong>${escapeHtml(o.group.code)} ${escapeHtml(o.group.name)}</strong>.</p><button type="button" class="ghost-btn" data-assist-signin><i class="fa-solid fa-user-lock"></i> Sign in</button>`);
        return;
    }
    closeAssistant();
    openCreateModal({
        activityCode: o.cls.activityCode, classCode: o.cls.classCode, className: o.cls.className, activityName: o.cls.activityName,
        groupCode: o.group.code, groupName: o.group.name, description: assistantUi.description
    });
}

assistantThread?.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-assist-cat]');
    if (cat) { assistantRunCategory(cat.dataset.assistCat); return; }
    const create = e.target.closest('[data-assist-create]');
    if (create) { assistantCreate(Number(create.dataset.assistCreate)); return; }
    const add = e.target.closest('[data-assist-add]');
    if (add) {
        const item = allSearchableItems.find(i => itemPartCode(i) === add.dataset.assistAdd);
        if (item) {
            addToCart(itemPartCode(item), item["Description"] || '', item["UOM"] || 'EA', item["Group Name"] || '', item["Activity Name"] || '', item["Class Code"] || '');
            add.innerHTML = '<i class="fa-solid fa-check"></i> Added';
            add.disabled = true;
        }
        return;
    }
    if (e.target.closest('[data-assist-search]')) {
        searchInput.value = assistantUi.query;
        renderSearchResults(assistantUi.query);
        if (window.innerWidth < 900) closeAssistant();
        searchInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
    }
    if (e.target.closest('[data-assist-signin]')) {
        closeAssistant();
        applyAccessUI();
        $id('accessModal')?.classList.add('active');
    }
});

$id('assistantForm')?.addEventListener('submit', (e) => { e.preventDefault(); assistantAskItem(assistantInput.value); });
$id('assistantFab')?.addEventListener('click', () => openAssistant(searchInput.value.trim(), false));
$id('closeAssistantBtn')?.addEventListener('click', closeAssistant);
$id('assistantRestartBtn')?.addEventListener('click', () => { assistantUi.query = ''; assistantUi.activityCode = ''; assistantIntro(); assistantInput.focus(); });
$id('askAssistantBtn')?.addEventListener('click', () => openAssistant(searchInput.value.trim(), true));

// Esc closes the assistant, or the top-most open window.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (assistantDrawer && assistantDrawer.classList.contains('open')) { closeAssistant(); return; }
    const open = Array.from(document.querySelectorAll('.modal-overlay.active'));
    if (open.length) open[open.length - 1].classList.remove('active');
});

