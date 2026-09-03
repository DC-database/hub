/*
 * IBA Inventory Pocket — 12.8.5
 *
 * Inventory-only shared change pocket. The permanent material_stock / transfer_entries
 * database remains authoritative. This layer only keeps recently changed material records
 * so other browsers can refresh changed items without repeatedly downloading the full stock.
 */
(function () {
    'use strict';

    const INVENTORY_DB_URL = 'https://material-8f545-default-rtdb.firebaseio.com';
    const INVENTORY_DB_APP_NAME = 'ibaInventory';
    const POCKET_PATH = 'inventory_pocket';
    const WEEKLY_SYNC_KEY = 'iba_inventory_weekly_sync_v1';
    const POCKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

    function getInventoryDb() {
        if (window.inventoryDb) return window.inventoryDb;
        if (typeof firebase === 'undefined' || !firebase.database) throw new Error('Firebase Database SDK is not loaded.');
        let app;
        try { app = firebase.app(INVENTORY_DB_APP_NAME); }
        catch (_) {
            // RTDB operations do not require Firebase Auth configuration here; the database URL
            // is sufficient for this named database connection. Rules remain the final security gate.
            app = firebase.initializeApp({ databaseURL: INVENTORY_DB_URL }, INVENTORY_DB_APP_NAME);
        }
        window.inventoryDb = app.database();
        return window.inventoryDb;
    }

    window.getInventoryDatabase = getInventoryDb;

    function clean(v) { return String(v == null ? '' : v).trim(); }
    function safeKey(v) { return clean(v).replace(/[.#$[\]\/\\]/g, '_') || '_'; }
    function now() { return Date.now(); }

    function pocketRef(productID) {
        return getInventoryDb().ref(`${POCKET_PATH}/${safeKey(productID)}`);
    }

    async function publishMaterialItem(item, keyOverride) {
        if (!item) return false;
        const productID = clean(item.productID || item.productId);
        if (!productID) return false;
        const key = keyOverride || item.key || '';
        const payload = {
            productID,
            productName: item.productName || '',
            familyCode: item.familyCode || '',
            family: item.family || '',
            relationCode: item.relationCode || '',
            relationship: item.relationship || '',
            category: item.category || '',
            details: item.details || '',
            stockQty: Number(item.stockQty) || 0,
            balanceQty: Number(item.balanceQty) || 0,
            transferredQty: Number(item.transferredQty) || 0,
            sites: item.sites || {},
            status: item.status || 'Active',
            photoName: item.photoName || '',
            photoUrl: item.photoUrl || '',
            sourceKey: key || null,
            changedAt: now(),
            expiresAt: now() + POCKET_RETENTION_MS,
            version: String(item.lastUpdated || item.timestamp || now())
        };
        await pocketRef(productID).set(payload);
        return true;
    }

    async function publishMaterialByKey(key) {
        const snap = await getInventoryDb().ref(`material_stock/${key}`).once('value');
        if (!snap.exists()) return removeMaterialFromPocketByKey(key);
        return publishMaterialItem({ key, ...(snap.val() || {}) }, key);
    }

    async function removeMaterialFromPocket(productID) {
        const id = clean(productID);
        if (!id) return;
        await pocketRef(id).remove();
    }

    async function removeMaterialFromPocketByKey(key) {
        const snap = await getInventoryDb().ref(POCKET_PATH).orderByChild('sourceKey').equalTo(String(key)).once('value');
        const updates = {};
        snap.forEach(child => { updates[`${POCKET_PATH}/${child.key}`] = null; });
        if (Object.keys(updates).length) await getInventoryDb().ref().update(updates);
    }

    async function getPocketMaterial(productID) {
        const id = clean(productID);
        if (!id) return null;
        const snap = await getInventoryDb().ref(POCKET_PATH).orderByChild('productID').equalTo(id).once('value');
        let found = null;
        snap.forEach(child => { found = { key: child.key, ...(child.val() || {}) }; });
        return found;
    }

    function mergePocketIntoLocal(item) {
        if (!item || typeof window.__ibaGetMaterialStockData !== 'function') return;
        const data = window.__ibaGetMaterialStockData();
        if (!Array.isArray(data)) return;
        const productID = clean(item.productID || item.productId);
        const idx = data.findIndex(x => clean(x.productID || x.productId) === productID);
        const merged = { ...(idx >= 0 ? data[idx] : {}), ...item };
        if (idx >= 0) data[idx] = merged;
        else data.push(merged);
        if (typeof window.__ibaSetMaterialStockData === 'function') window.__ibaSetMaterialStockData(data);
        try { localStorage.setItem('cached_MATERIAL_STOCK', JSON.stringify({ data, timestamp: now() })); } catch (_) {}
        try {
            const table = document.getElementById('ms-table-body');
            if (table && typeof window.renderMaterialStockTable === 'function') window.renderMaterialStockTable(data);
        } catch (_) {}
        return merged;
    }

    async function applyPocketItemToBrowser(productID) {
        const item = await getPocketMaterial(productID);
        return item ? mergePocketIntoLocal(item) : null;
    }

    function getUserKey() {
        try {
            if (window.currentApprover && window.currentApprover.Name) return safeKey(window.currentApprover.Name);
            if (window.currentUser && (window.currentUser.username || window.currentUser.Name)) return safeKey(window.currentUser.username || window.currentUser.Name);
        } catch (_) {}
        return 'UnknownUser';
    }

    function weeklySyncId(date = new Date()) {
        // Saturday starts a new cycle. Friday is outside the normal sync window.
        const d = new Date(date);
        const day = d.getDay(); // Sun=0 ... Fri=5 Sat=6
        const diffToSaturday = (day - 6 + 7) % 7;
        d.setDate(d.getDate() - diffToSaturday);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
    }

    function getSyncState() {
        try { return JSON.parse(localStorage.getItem(WEEKLY_SYNC_KEY) || '{}') || {}; } catch (_) { return {}; }
    }

    function setSyncDone(cycle) {
        const state = getSyncState();
        state[getUserKey()] = { cycle, syncedAt: now() };
        try { localStorage.setItem(WEEKLY_SYNC_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function needsWeeklySync() {
        const cycle = weeklySyncId();
        const state = getSyncState();
        return !state[getUserKey()] || state[getUserKey()].cycle !== cycle;
    }

    async function ensureWeeklySafetySync(force = false) {
        if (!force && !needsWeeklySync()) return { synced: false, reason: 'already-synced' };
        const snap = await getInventoryDb().ref('material_stock').once('value');
        const data = snap.val() || {};
        const list = Object.entries(data).map(([key, value]) => ({ key, ...(value || {}) }));
        if (typeof window.__ibaSetMaterialStockData === 'function') window.__ibaSetMaterialStockData(list);
        try { localStorage.setItem('cached_MATERIAL_STOCK', JSON.stringify({ data: list, timestamp: now() })); } catch (_) {}
        setSyncDone(weeklySyncId());
        return { synced: true, count: list.length };
    }

    function startPocketListener() {
        if (window.__ibaInventoryPocketListenerStarted) return;
        try {
            const ref = getInventoryDb().ref(POCKET_PATH);
            ref.on('child_added', snap => { try { mergePocketIntoLocal({ key: snap.key, ...(snap.val() || {}) }); } catch (_) {} });
            ref.on('child_changed', snap => { try { mergePocketIntoLocal({ key: snap.key, ...(snap.val() || {}) }); } catch (_) {} });
            ref.on('child_removed', snap => {
                try {
                    const productID = clean((snap.val() || {}).productID);
                    if (!productID || typeof window.__ibaGetMaterialStockData !== 'function') return;
                    const data = window.__ibaGetMaterialStockData();
                    const local = Array.isArray(data) ? data.find(x => clean(x.productID || x.productId) === productID) : null;
                    // Removal from Pocket does NOT remove permanent/browser stock. The browser copy remains valid.
                    if (local) local.__pocketExpired = true;
                } catch (_) {}
            });
            window.__ibaInventoryPocketListenerStarted = true;
        } catch (e) { console.warn('Inventory Pocket listener unavailable:', e); }
    }

    async function cleanupExpiredPocketEntries() {
        const snap = await getInventoryDb().ref(POCKET_PATH).once('value');
        const updates = {};
        const t = now();
        snap.forEach(child => {
            const v = child.val() || {};
            if (Number(v.expiresAt || 0) > 0 && Number(v.expiresAt) <= t) updates[`${POCKET_PATH}/${child.key}`] = null;
        });
        if (Object.keys(updates).length) await getInventoryDb().ref().update(updates);
    }

    window.inventoryPocket = {
        getDb: getInventoryDb,
        publishMaterialItem,
        publishMaterialByKey,
        removeMaterialFromPocket,
        removeMaterialFromPocketByKey,
        getPocketMaterial,
        applyPocketItemToBrowser,
        ensureWeeklySafetySync,
        needsWeeklySync,
        cleanupExpiredPocketEntries,
        startPocketListener,
        POCKET_RETENTION_MS
    };

    // Start only the lightweight Pocket listener. It reads only the small recent-change tree.
    document.addEventListener('DOMContentLoaded', () => {
        try { startPocketListener(); } catch (_) {}
        try { cleanupExpiredPocketEntries(); } catch (_) {}
    });
})();
