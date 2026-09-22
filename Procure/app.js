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
const ACTIVITY_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/activity.csv";
const VENDORS_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Vendors.csv";
const SITE_CSV_URL = "https://raw.githubusercontent.com/DC-database/hub/main/Site.csv";

let allSearchableItems = []; let allVendors = []; let allSites = [];
let cart = []; let legacyItems = []; let dynamicActivityData = {};
let activitiesMap = {}; 
let sessionNewlyCreatedItems = []; 

let currentGroupCode = null; let generatedSeries = null; let generatedPartCode = null;
let selectedVendor = { id: '', name: '' }; let selectedSite = { code: '', name: '' };

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
const CATALOG_CACHE_KEY = 'pr_catalog_cache_v2';
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

function applyActivityRows(rows) {
    const mainFilter = document.getElementById('mainCategoryFilter');
    const editMainFilter = document.getElementById('editMainCategoryFilter');
    mainFilter.innerHTML = '<option value="">-- Select Main Category --</option>';
    editMainFilter.innerHTML = '<option value="">-- Select Main Category --</option>';
    dynamicActivityData = {};
    activitiesMap = {};
    rows.forEach(row => {
        const groupCode = row["Group Code"]; const groupName = row["Group Name"];
        const classCode = row["Class Code"] || "N/A"; const className = row["Class Name"] || "N/A";
        const activityCode = row["Activity Code"] || "N/A"; const activityName = row["Activity Name"] || row["Activity"] || "Uncategorized";
        if (groupCode && groupName) {
            dynamicActivityData[groupCode] = { groupName, classCode, className, activityCode, activityName };
            const mainCat = activityName;
            if (!activitiesMap[mainCat]) {
                activitiesMap[mainCat] = [];
                const option1 = document.createElement('option'); option1.value = mainCat; option1.textContent = mainCat; mainFilter.appendChild(option1);
                const option2 = document.createElement('option'); option2.value = mainCat; option2.textContent = mainCat; editMainFilter.appendChild(option2);
            }
            if (!activitiesMap[mainCat].some(g => g.groupCode === groupCode)) {
                activitiesMap[mainCat].push({ groupCode, groupName });
            }
        }
    });
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

async function fetchText(url) {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Failed to fetch ' + url);
    return res.text();
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
    const cacheBuster = forceNetwork ? ('?v=' + Date.now()) : '';
    const [activityText, vendorsText, sitesText, firebaseItems, catalogVersion] = await Promise.all([
        fetchText(ACTIVITY_CSV_URL + cacheBuster),
        fetchText(VENDORS_CSV_URL + cacheBuster),
        fetchText(SITE_CSV_URL + cacheBuster),
        loadFirebaseItems(true),
        getCatalogVersion()
    ]);
    const activities = await parseCsv(activityText);
    const vendors = await parseCsv(vendorsText);
    const sites = await parseCsv(sitesText);
    writeCatalogCache({ items: [], activities, vendors, sites, firebaseItems, catalogVersion });
    return { items: [], activities, vendors, sites, firebaseItems, catalogVersion, fromCache: false };
}

function itemPartCode(item) {
    return String((item && (item["Part Code"] || item["Part code"])) || "").trim();
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
    allVendors = data.vendors || [];
    allSites = data.sites || [];
    if ((data.activities || []).length) applyActivityRows(data.activities);
    const firebaseItems = data.firebaseItems || [];
    allSearchableItems = firebaseItems.slice();
    catalogReady = true;
    const count = allSearchableItems.length;
    const writable = firebaseItems.filter(item => item && item.firebaseKey).length;
    setCatalogStatus(`${count.toLocaleString()} items · Firebase · ${sourceLabel}`, 'ready');
    updateCatalogImportStats(legacyItems.length, firebaseItems.length, count);
}

async function initializeApp(forceRefresh) {
    loadSession();
    try {
        const cache = readCatalogCache();
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
        if (cache && cache.items) {
            applyCatalog(cache, 'cached fallback');
        } else {
            setCatalogStatus('Catalog failed to load', 'warn');
        }
    }
}
initializeApp(false);

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

function renderSearchResults(rawQuery) {
    const meta = document.getElementById('searchMeta');
    const query = String(rawQuery || '').toLowerCase().trim();
    searchResults.innerHTML = '';
    if (query.length < 2) {
        if (meta) meta.textContent = catalogReady ? `${allSearchableItems.length.toLocaleString()} items ready` : 'Catalog still loading…';
        return;
    }
    if (!catalogReady) {
        searchResults.innerHTML = '<div class="no-results">Catalog is still loading. Try again in a moment.</div>';
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
    if (meta) meta.textContent = matches.length ? `Showing ${Math.min(matches.length, searchLimit)} of ${matches.length} matches` : 'No matches';
    if (matches.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No items found. Click Create item to generate a part code.</div>';
        return;
    }
    matches.slice(0, searchLimit).forEach(item => {
        const partNo = item["Part Code"] || item["Part code"] || "N/A";
        const desc = item["Description"] || item["description"] || "N/A";
        const uom = item["UOM"] || "EA";
        const groupName = item["Group Name"] || item["Group name"] || "N/A";
        const actName = item["Activity Name"] || item["Activity name"] || item["Activity"] || "N/A";
        const groupCode = item["Group Code"] || item["Group code"] || "N/A";
        const seriesCode = item["Series"] || String(partNo).split('.')[1] || "";
        const classValue = item["Class Code"] || item["Class"] || item["Class Name"] || "N/A";
        const safeDesc = String(desc).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeGroup = String(groupName).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeAct = String(actName).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeClass = String(classValue).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const div = document.createElement('div');
        div.className = 'result-item';
        const safeKey = item.firebaseKey ? `'${item.firebaseKey}'` : null;
        let actionButtons = `<button class="add-btn" onclick="addToCart('${partNo}', '${safeDesc}', '${uom}', '${safeGroup}', '${safeAct}', '${safeClass}')"><i class="fa-solid fa-plus"></i> Add</button>`;
        if (safeKey) {
            if (canEditItems()) actionButtons += `<button class="icon-btn edit" onclick="openEditModal(${safeKey}, '${partNo}', '${seriesCode}', '${safeDesc}', '${uom}', '${groupCode}')" title="Edit item"><i class="fa-solid fa-pen"></i></button>`;
            if (canDeleteItems()) actionButtons += `<button class="icon-btn delete" onclick="deleteFirebaseItem(${safeKey})" title="Delete item"><i class="fa-solid fa-trash"></i></button>`;
        }
        if (canUpdatePhotos()) {
            const keyArg = item.firebaseKey ? `'${item.firebaseKey}'` : 'null';
            actionButtons += `<button class="icon-btn edit" onclick="updateItemPhoto(${keyArg}, '${partNo}', '${safeDesc}')" title="Update photo link"><i class="fa-solid fa-image"></i></button>`;
        }
        const fileName = item.PhotoFile || item.photoFile || item.photoName || '';
        const photoUrls = photoUrlCandidates(fileName);
        const safePhoto = String(photoUrls[0] || '').replace(/"/g, '&quot;');
        const safeAlts = photoUrls.slice(1).join('|').replace(/"/g, '&quot;');
        div.innerHTML = `<div class="result-photo">${safePhoto ? `<img class="item-thumb" src="${safePhoto}" alt="${partNo}" referrerpolicy="no-referrer" data-alts="${safeAlts}" onclick="openPhotoView(this.src, '${partNo} | ${safeDesc}')" onerror="if(this.dataset.alts){const a=this.dataset.alts.split('|').filter(Boolean);if(a.length){this.src=a.shift();this.dataset.alts=a.join('|');}else{this.style.background='#e2e8f0';}}else{this.style.background='#e2e8f0';}">` : ''}</div><div class="result-info"><strong>${partNo}</strong> | ${desc} <em>(${uom})</em><br><span><i class="fa-solid fa-folder-tree"></i> ${groupName} &nbsp;|&nbsp; <i class="fa-solid fa-clipboard-check"></i> ${actName}${fileName ? ` &nbsp;|&nbsp; photo: ${fileName}` : ''}</span></div><div class="result-actions" style="display:flex; align-items:center;">${actionButtons}</div>`;
        searchResults.appendChild(div);
    });
    if (matches.length > searchLimit) {
        const more = document.createElement('div');
        more.className = 'no-results';
        more.innerHTML = `<button class="ghost-btn" id="showMoreResults">Show more (${matches.length - searchLimit} remaining)</button>`;
        searchResults.appendChild(more);
        document.getElementById('showMoreResults').onclick = () => {
            searchLimit += SEARCH_PAGE_SIZE;
            renderSearchResults(rawQuery);
        };
    }
}

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
        const comment = String(item.comment || '').replace(/"/g, '&quot;');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${cartPhotoHtml(item)}</td>
            <td><strong>${item.partNo}</strong><br><em class="cart-group-name">${item.groupName} (${item.actName || ''})</em></td>
            <td>${item.description}<br><input type="text" class="calc-input cart-comment-input" placeholder="Add a comment (optional)..." value="${comment}" data-index="${index}"></td>
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
            <td><strong>${item.partNo}</strong></td>
            <td>${item.description}</td>
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
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>${item["Part Code"]}</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item["Description"] || ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item["UOM"] || ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color:#64748b;">${actText}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color:#64748b;">${groupText}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color:#64748b;">${classText}</td>
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
// 5. MODAL (CREATE NEW ITEM)
// ==========================================
const modal = document.getElementById('generatorModal'); 
const openBtn = document.getElementById('openGeneratorBtn'); 
const closeBtn = document.getElementById('closeModalBtn');
if (openBtn && modal) openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!canAddItems()) { denyAccess('add items'); return; }
    modal.classList.add('active');
});
if (closeBtn && modal) closeBtn.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('active'); });

const mainCategoryFilter = document.getElementById('mainCategoryFilter');
const activitySearch = document.getElementById('activitySearch'); 
const activitySuggestions = document.getElementById('activitySuggestions');
const saveBtn = document.getElementById('saveBtn');

let currentCategoryGroups = []; 
mainCategoryFilter.addEventListener('change', (e) => {
    const selectedCat = e.target.value; activitySearch.value = ''; activitySuggestions.innerHTML = '';
    document.getElementById('dispGroup').value = ''; document.getElementById('dispClass').value = ''; document.getElementById('dispActivity').value = '';
    saveBtn.disabled = true; saveBtn.textContent = "Select Group First"; currentGroupCode = null;
    if (!selectedCat) { activitySearch.disabled = true; activitySearch.placeholder = "-- Select Main Category First --"; currentCategoryGroups = []; return; }
    activitySearch.disabled = false; activitySearch.placeholder = "Click to see all, or type to search..."; currentCategoryGroups = activitiesMap[selectedCat] || [];
});

function showActivitySuggestions(query = "") {
    activitySuggestions.innerHTML = ''; if (currentCategoryGroups.length === 0) return;
    const q = query.toLowerCase().trim();
    const matches = currentCategoryGroups.filter(g => { return g.groupName.toLowerCase().includes(q) || g.groupCode.toLowerCase().includes(q); });
    matches.forEach(g => {
        const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${g.groupCode}</strong> - ${g.groupName}`;
        div.onclick = async () => {
            activitySearch.value = `${g.groupName} (Group: ${g.groupCode})`; activitySuggestions.innerHTML = ''; currentGroupCode = g.groupCode; 
            const data = dynamicActivityData[currentGroupCode]; 
            document.getElementById('dispGroup').value = `${currentGroupCode} - ${data.groupName}`; document.getElementById('dispClass').value = `${data.classCode} - ${data.className}`; document.getElementById('dispActivity').value = `${data.activityCode} - ${data.activityName}`;
            await calculateNextSeries(currentGroupCode);
        };
        activitySuggestions.appendChild(div);
    });
}
activitySearch.addEventListener('focus', () => { showActivitySuggestions(''); });
activitySearch.addEventListener('click', () => { showActivitySuggestions(''); });
activitySearch.addEventListener('input', (e) => {
    showActivitySuggestions(e.target.value); currentGroupCode = null;
    document.getElementById('dispGroup').value = ''; document.getElementById('dispClass').value = ''; document.getElementById('dispActivity').value = '';
    saveBtn.disabled = true; saveBtn.textContent = "Select Group First";
});

async function calculateNextSeries(groupCode) {
    saveBtn.disabled = true; saveBtn.textContent = "Calculating..."; let highestSeries = 100000; 
    try {
        allSearchableItems.forEach(item => { 
            if (item["Series"]) {
                const sNum = parseInt(item["Series"], 10); 
                if (!isNaN(sNum) && sNum > highestSeries) highestSeries = sNum; 
            }
        });
        
        const snap = await dbReq.ref("items").orderByChild("Series").limitToLast(1).once("value");
        if (snap.exists()) {
            snap.forEach((childSnap) => { 
                const sNum = parseInt(childSnap.val().Series, 10); 
                if (!isNaN(sNum) && sNum > highestSeries) highestSeries = sNum; 
            });
        }
        
        generatedSeries = (highestSeries + 1).toString(); generatedPartCode = `${groupCode}.${generatedSeries}`;
        document.getElementById('previewPartCode').textContent = generatedPartCode; document.getElementById('previewSeries').textContent = `Series: ${generatedSeries}`;
        const previewImg = document.getElementById('createItemPhotoPreview');
        if (previewImg) {
            previewImg.src = itemPhotoUrl(generatedPartCode);
            previewImg.style.display = '';
            previewImg.onerror = () => { previewImg.style.display = 'none'; };
        }
        saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart";
    } catch (err) { console.error(err); alert("Error calculating series."); }
}

document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if(!currentGroupCode || !generatedSeries) return;
    if (!canAddItems()) { denyAccess('add items'); return; }
    const data = dynamicActivityData[currentGroupCode]; const itemDesc = document.getElementById('description').value; const itemUOM = document.getElementById('uom').value;
    const newItemRecord = { "Part Code": generatedPartCode, "Series": generatedSeries, "Description": itemDesc, "UOM": itemUOM, "Group Code": currentGroupCode, "Group Name": data.groupName, "Class Code": data.classCode, "Class Name": data.className, "Activity Code": data.activityCode, "Activity Name": data.activityName, "CreatedAt": new Date().toISOString() };
    try {
        saveBtn.disabled = true; saveBtn.textContent = "Saving...";
        
        const newRef = dbReq.ref("items").push();
        newItemRecord.firebaseKey = newRef.key;
        await newRef.set(newItemRecord);
        
        allSearchableItems.push(newItemRecord); 
        sessionNewlyCreatedItems.push(newItemRecord);
        await publishRecentItem(newItemRecord);
        await bumpCatalogVersion();
        const cache = readCatalogCache() || {};
        cache.firebaseItems = (cache.firebaseItems || []).concat([newItemRecord]);
        writeCatalogCache({
            items: cache.items || legacyItems,
            activities: cache.activities,
            vendors: cache.vendors || allVendors,
            sites: cache.sites || allSites,
            firebaseItems: cache.firebaseItems
        }); 
        addToCart(generatedPartCode, itemDesc, itemUOM, data.groupName, data.activityName, data.classCode); 
        
        document.getElementById('itemForm').reset(); document.getElementById('previewPartCode').textContent = 'XXXXX.XXXXXX'; document.getElementById('previewSeries').textContent = 'Series: ------';
        saveBtn.disabled = true; saveBtn.textContent = "Select Group First"; modal.classList.remove('active'); 
        activitySearch.value = ''; activitySearch.disabled = true; activitySearch.placeholder = "-- Select Main Category First --";
    } catch (error) { console.error("Error adding item: ", error); alert("Failed to save to Firebase."); saveBtn.disabled = false; saveBtn.textContent = "Save Item & Add to Cart"; }
});

// ==========================================
// 6. FIREBASE ITEM MANAGEMENT (EDIT/DELETE)
// ==========================================
window.deleteFirebaseItem = async function(key) {
    if (!canDeleteItems()) { denyAccess('delete items'); return; }
    if(confirm("Are you sure you want to permanently delete this item from the database?")) {
        try {
            await dbReq.ref("items").child(key).remove();
            await dbReq.ref(RECENT_ITEMS_PATH).child(key).remove().catch(() => {});
            await bumpCatalogVersion();
            allSearchableItems = allSearchableItems.filter(item => item.firebaseKey !== key);
            document.getElementById('searchInput').dispatchEvent(new Event('input'));
            alert("Item deleted successfully.");
        } catch (error) { console.error("Error deleting item:", error); alert("Failed to delete item."); }
    }
};

let editCurrentGroupCode = null; let editCurrentSeries = null; let editCategoryGroups = [];
const editMainCategoryFilter = document.getElementById('editMainCategoryFilter');
const editActivitySearch = document.getElementById('editActivitySearch');
const editActivitySuggestions = document.getElementById('editActivitySuggestions');

editMainCategoryFilter.addEventListener('change', (e) => {
    const selectedCat = e.target.value; editActivitySearch.value = ''; editActivitySuggestions.innerHTML = '';
    document.getElementById('editDispGroup').value = ''; document.getElementById('editDispClass').value = ''; document.getElementById('editDispActivity').value = '';
    
    if (!selectedCat) { 
        editActivitySearch.disabled = true; editActivitySearch.placeholder = "-- Select Main Category First --"; 
        editCategoryGroups = []; 
        document.getElementById('editPartCodePreview').textContent = `${document.getElementById('editOriginalGroupCode').value}.${editCurrentSeries}`;
        editCurrentGroupCode = document.getElementById('editOriginalGroupCode').value;
        return; 
    }
    editActivitySearch.disabled = false; editActivitySearch.placeholder = "Click to see all, or type to search..."; editCategoryGroups = activitiesMap[selectedCat] || [];
});

function showEditActivitySuggestions(query = "") {
    editActivitySuggestions.innerHTML = ''; if (editCategoryGroups.length === 0) return;
    const q = query.toLowerCase().trim();
    const matches = editCategoryGroups.filter(g => { return g.groupName.toLowerCase().includes(q) || g.groupCode.toLowerCase().includes(q); });
    matches.forEach(g => {
        const div = document.createElement('div'); div.className = 'suggestion-item'; div.innerHTML = `<strong>${g.groupCode}</strong> - ${g.groupName}`;
        div.onclick = () => {
            editActivitySearch.value = `${g.groupName} (Group: ${g.groupCode})`; editActivitySuggestions.innerHTML = ''; editCurrentGroupCode = g.groupCode; 
            const data = dynamicActivityData[editCurrentGroupCode]; 
            document.getElementById('editDispGroup').value = `${editCurrentGroupCode} - ${data.groupName}`; document.getElementById('editDispClass').value = `${data.classCode} - ${data.className}`; document.getElementById('editDispActivity').value = `${data.activityCode} - ${data.activityName}`;
            document.getElementById('editPartCodePreview').textContent = `${editCurrentGroupCode}.${editCurrentSeries}`;
        };
        editActivitySuggestions.appendChild(div);
    });
}
editActivitySearch.addEventListener('focus', () => { showEditActivitySuggestions(''); });
editActivitySearch.addEventListener('click', () => { showEditActivitySuggestions(''); });
editActivitySearch.addEventListener('input', (e) => { showEditActivitySuggestions(e.target.value); });

window.openEditModal = function(key, partCode, series, desc, uom, groupCode) {
    if (!canEditItems()) { denyAccess('edit items'); return; }
    document.getElementById('editFirebaseKey').value = key;
    editCurrentSeries = series || partCode.split('.')[1]; 
    editCurrentGroupCode = groupCode;
    document.getElementById('editOriginalGroupCode').value = groupCode;

    document.getElementById('editPartCodePreview').textContent = partCode;
    document.getElementById('editDescription').value = desc;
    
    const uomSelect = document.getElementById('editUom');
    for(let i=0; i<uomSelect.options.length; i++) {
        if(uomSelect.options[i].value === uom) { uomSelect.selectedIndex = i; break; }
    }

    if (groupCode && dynamicActivityData[groupCode]) {
        const data = dynamicActivityData[groupCode];
        const mainCat = data.activityName;
        document.getElementById('editMainCategoryFilter').value = mainCat;
        editCategoryGroups = activitiesMap[mainCat] || [];
        
        editActivitySearch.disabled = false;
        editActivitySearch.value = `${data.groupName} (Group: ${groupCode})`;
        document.getElementById('editDispGroup').value = `${groupCode} - ${data.groupName}`;
        document.getElementById('editDispClass').value = `${data.classCode} - ${data.className}`;
        document.getElementById('editDispActivity').value = `${data.activityCode} - ${data.activityName}`;
    }

    document.getElementById('editItemModal').classList.add('active');
};

document.getElementById('closeEditModalBtn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('editItemModal').classList.remove('active'); });

document.getElementById('editItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canEditItems()) { denyAccess('edit items'); return; }
    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true; saveBtn.textContent = "Updating...";

    const key = document.getElementById('editFirebaseKey').value;
    const newDesc = document.getElementById('editDescription').value;
    const newUom = document.getElementById('editUom').value;
    
    const finalGroupCode = editCurrentGroupCode || document.getElementById('editOriginalGroupCode').value;
    const data = dynamicActivityData[finalGroupCode];
    const newPartCode = `${finalGroupCode}.${editCurrentSeries}`;

    const updateData = {
        "Part Code": newPartCode,
        "Description": newDesc,
        "UOM": newUom,
        "Group Code": finalGroupCode,
        "Group Name": data.groupName,
        "Class Code": data.classCode,
        "Class Name": data.className,
        "Activity Code": data.activityCode,
        "Activity Name": data.activityName
    };

    try {
        await dbReq.ref("items").child(key).update(updateData);
        await bumpCatalogVersion();
        
        const itemIndex = allSearchableItems.findIndex(item => item.firebaseKey === key);
        if(itemIndex > -1) {
            allSearchableItems[itemIndex] = { ...allSearchableItems[itemIndex], ...updateData };
        }
        
        document.getElementById('editItemModal').classList.remove('active');
        document.getElementById('searchInput').dispatchEvent(new Event('input'));
        alert("Item successfully updated!");
    } catch (error) { 
        console.error("Error updating item:", error); alert("Failed to update item."); 
    } finally {
        saveBtn.disabled = false; saveBtn.textContent = "Update Item";
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

function normalizeCatalogRow(row) {
    const partCode = pickField(row, ['Part Code', 'Part code', 'Part No', 'Part Number']);
    if (!partCode) return null;
    const groupCode = pickField(row, ['Group Code', 'Group code']);
    const series = pickField(row, ['Series']) || (partCode.includes('.') ? partCode.split('.').slice(1).join('.') : '');
    const activityMeta = (groupCode && dynamicActivityData[groupCode]) ? dynamicActivityData[groupCode] : null;
    return {
        "Part Code": partCode,
        "Series": series,
        "Description": pickField(row, ['Description', 'description', 'Item Description']),
        "UOM": pickField(row, ['UOM', 'Unit', 'Unit of Measure']) || 'Pcs',
        "Group Code": groupCode,
        "Group Name": pickField(row, ['Group Name', 'Group name']) || (activityMeta ? activityMeta.groupName : ''),
        "Class Code": pickField(row, ['Class Code', 'Class']) || (activityMeta ? activityMeta.classCode : ''),
        "Class Name": pickField(row, ['Class Name']) || (activityMeta ? activityMeta.className : ''),
        "Activity Code": pickField(row, ['Activity Code']) || (activityMeta ? activityMeta.activityCode : ''),
        "Activity Name": pickField(row, ['Activity Name', 'Activity']) || (activityMeta ? activityMeta.activityName : '')
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
        if (seen.has(item["Part Code"])) return;
        seen.add(item["Part Code"]);
        normalized.push(item);
    });
    if (!normalized.length) throw new Error('No usable rows found. Check that the file has a Part Code column.');

    setImportProgress(`Preparing ${normalized.length.toLocaleString()} rows from ${sourceLabel}…`);
    const existing = await loadFirebaseItems(true);
    const byCode = new Map();
    existing.forEach((item) => {
        const code = itemPartCode(item);
        if (code) byCode.set(code, item);
    });

    const writes = [];
    let skipped = 0;
    let overwrites = 0;
    const now = new Date().toISOString();
    normalized.forEach((item) => {
        const current = byCode.get(item["Part Code"]);
        if (current && current.firebaseKey) {
            if (mode === 'skip') { skipped += 1; return; }
            writes.push({
                key: current.firebaseKey,
                record: { ...current, ...item, firebaseKey: current.firebaseKey, UpdatedAt: now, Source: sourceLabel }
            });
            overwrites += 1;
            return;
        }
        const key = firebaseItemKeyFromPartCode(item["Part Code"]);
        writes.push({
            key,
            record: { ...item, firebaseKey: key, CreatedAt: now, Source: sourceLabel }
        });
    });

    if (!writes.length) {
        setImportProgress(`Nothing to import. ${skipped.toLocaleString()} existing Part Codes were skipped.`);
        return { imported: 0, skipped, overwrites, total: normalized.length };
    }

    await writeFirebaseBatches(writes, (done, total) => {
        setImportProgress(`Writing ${done.toLocaleString()} / ${total.toLocaleString()} Firebase records…`);
    });
    const catalogVersion = await bumpCatalogVersion();

    const freshFirebase = await loadFirebaseItems(true);
    const cache = readCatalogCache() || {};
    writeCatalogCache({
        items: cache.items || legacyItems,
        activities: cache.activities,
        vendors: cache.vendors || allVendors,
        sites: cache.sites || allSites,
        firebaseItems: freshFirebase,
        catalogVersion
    });
    applyCatalog({
        items: cache.items || legacyItems,
        activities: cache.activities || [],
        vendors: cache.vendors || allVendors,
        sites: cache.sites || allSites,
        firebaseItems: freshFirebase
    }, 'imported');

    setImportProgress(`Done. Imported/updated ${writes.length.toLocaleString()} · skipped ${skipped.toLocaleString()} · source ${sourceLabel}. Refresh catalog if search looks stale.`);
    return { imported: writes.length, skipped, overwrites, total: normalized.length };
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
        alert(`Import finished.\nImported/updated: ${result.imported}\nSkipped: ${result.skipped}\nRows read: ${result.total}`);
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
    if (!confirm('Import the selected file into Firebase now? Existing Firebase Part Codes will follow the conflict setting below.')) return;
    btn.disabled = true;
    try {
        setImportProgress('Reading file…');
        const rows = await parseCatalogFile(input.files[0]);
        const result = await importRowsToFirebase(rows, 'excel-import');
        alert(`Import finished.\nImported/updated: ${result.imported}\nSkipped: ${result.skipped}\nRows read: ${result.total}`);
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
    if (img && img.src && img.style.display !== 'none') openPhotoView(img.src, document.getElementById('previewPartCode')?.textContent || 'Photo');
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
        const nameEl = document.getElementById('bgFileName');
        loadBgFile().then(f => { if (nameEl) nameEl.textContent = f ? ('Attached: ' + (f.name || 'photo')) : ''; });
        applyAccessUI();
        if (isAccessAdmin()) loadAccessUsers().then(renderAccessUserList);
        settingsModal.classList.add('active');
    });
}
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
document.getElementById('saveBgBtn')?.addEventListener('click', () => {
    const s = {
        bgUrl: document.getElementById('bgImageUrl').value.trim(),
        bgBlur: Number(document.getElementById('bgBlur').value),
        bgDim: Number(document.getElementById('bgDim').value),
        photoFolder: document.getElementById('photoFolderUrl').value.trim() || DEFAULT_PHOTO_FOLDER,
        photoListUrl: document.getElementById('photoListUrl').value.trim() || DEFAULT_PHOTO_LIST_URL,
        photoExt: document.getElementById('photoExt').value
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
