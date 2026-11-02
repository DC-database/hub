/* =====================================================================
   IBA Finance 6.0.0 — app.js
   ---------------------------------------------------------------------
   What changed from 5.9:
   - LOW DOWNLOAD "POCKET": every payment is kept in this browser
     (IndexedDB). On open the app reads one tiny stamp
     (payments_meta). If nothing changed it downloads NOTHING. If
     something changed it downloads only the records saved since this
     browser's last visit (payments ordered by updatedAt) plus the list
     of deleted ids (payments_deleted). Search, PVN numbers, dashboard,
     certificate, export and the teller all read the browser copy.
   - One smart search box: 5 digits = PO, any other number or letter +
     number (170, 1111, M1111, "site 170") = Site, words = Vendor.
   - "Save as New" always takes the next free PVN and asks first.
   - Editing keeps the original Date Entered.
   - Listeners are attached once (no double saves after re-login).
   - CSV import handles commas inside quotes; Export to CSV; backup
     download before Delete All / replace import.
   - Super Admin (Irwin) only: Settings > Background, Delete All,
     replace import, vendor upload.
   ===================================================================== */
'use strict';

const APP_VERSION = '6.0.0';

// ---- SUPER ADMIN -----------------------------------------------------
// Put Irwin's login email here (lower case). Only these accounts see
// Settings, Delete All, replace import and the vendor upload.
const SUPER_ADMIN_EMAILS = ['dc@iba.com.qa'];

// ---- FIREBASE --------------------------------------------------------
const firebaseConfig = {
  apiKey: 'AIzaSyAt0fLWcfgGAWV4yiu4mfhc3xQ5ycolgnU',
  authDomain: 'payment-report-23bda.firebaseapp.com',
  databaseURL: 'https://payment-report-23bda-default-rtdb.firebaseio.com',
  projectId: 'payment-report-23bda',
  storageBucket: 'payment-report-23bda.appspot.com',
  messagingSenderId: '575646169000',
  appId: '1:575646169000:web:e7c4a9222ffe7753138f9d'
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const TS = firebase.database.ServerValue.TIMESTAMP;
const REF = {
  root: db.ref(),
  payments: db.ref('payments'),
  deleted: db.ref('payments_deleted'),
  meta: db.ref('payments_meta'),
  vendors: db.ref('vendors'),
  background: db.ref('system_settings/finance_background')
};

const VENDORS_CSV_URL = 'https://raw.githubusercontent.com/DC-database/Hub/main/Vendors.csv';
const PHOTO_BASE = 'https://raw.githubusercontent.com/DC-database/hub/main/photo/';
const BG_PHOTOS = ['Office1.jpg', 'Office2.jpg', 'Office3.jpg', 'Office4.jpg', 'IBA.jpg', 'Beach-01.jpg', 'Car.jpg', 'earth.jpg', 'e.jpg', 'm.jpg', 'a.jpg'];
const BG_DEFAULT = { photo: PHOTO_BASE + 'Office1.jpg', dimDesktop: 20, dimPhone: 35 };
const MONEY_FIELDS = ['poValue', 'certifiedAmount', 'retention', 'payment'];
const CACHE_VERSION = 1;
const FULL_CHECK_DAYS = 7;   // once a week each browser re-reads everything, to catch writes from old app versions

// =====================================================================
// SMALL HELPERS
// =====================================================================
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function money(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
}
function moneyShort(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return money(n);
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function parseDate(s) {
  if (!s || !String(s).trim()) return null;
  const p = String(s).split('-');
  if (p.length === 3 && p[0].length === 4) { const d = new Date(+p[0], +p[1] - 1, +p[2]); if (!isNaN(d)) return d; }
  const d = new Date(s);
  if (isNaN(d)) return null;
  if (d.getFullYear() < 2000 && d.getFullYear() > 1900) d.setFullYear(d.getFullYear() + 100);
  return d;
}
function fmtDate(s) {
  const d = parseDate(s); if (!d) return s ? String(s) : '';
  const m = d.toLocaleString('en-US', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')}-${m}-${d.getFullYear()}`;
}
function fmtDateLong(d) { return `${d.getDate()}-${d.toLocaleString('en-US', { month: 'long' })}-${d.getFullYear()}`; }
function pvnNum(p) { const n = parseInt(String(p ?? '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? n : 0; }
const isPaid = (r) => String(r.chequeNo ?? '').trim() !== '' || String(r.datePaid ?? '').trim() !== '';
function readFileAsText(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = (e) => res(e.target.result); fr.onerror = () => rej(new Error('Could not read the file')); fr.readAsText(file); }); }
function downloadText(name, text, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

function toast(msg, kind = 'ok', ms = 3200) {
  const icon = kind === 'err' ? 'bi-exclamation-octagon' : kind === 'info' ? 'bi-info-circle' : 'bi-check2-circle';
  const el = document.createElement('div');
  el.className = 'toast-msg ' + (kind === 'ok' ? '' : kind);
  el.innerHTML = `<i class="bi ${icon}"></i><span>${esc(msg)}</span>`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, ms);
}

/** confirmBox({title, html, buttons:[{label, cls, value}]}) -> Promise<value|null> */
function confirmBox({ title, html, buttons }) {
  return new Promise((resolve) => {
    const modalEl = $('confirmModal');
    $('confirmTitle').textContent = title;
    $('confirmBody').innerHTML = html;
    const foot = $('confirmFoot'); foot.innerHTML = '';
    let result = null;
    (buttons || [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: 'OK', cls: 'btn-gold', value: true }]).forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn ' + (b.cls || 'btn-ghost'); btn.textContent = b.label;
      btn.addEventListener('click', () => { result = b.value; bootstrap.Modal.getInstance(modalEl).hide(); });
      foot.appendChild(btn);
    });
    const onHide = () => { modalEl.removeEventListener('hidden.bs.modal', onHide); resolve(result); };
    modalEl.addEventListener('hidden.bs.modal', onHide);
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  });
}

// =====================================================================
// THE POCKET: browser copy + small delta sync
// =====================================================================
const Store = (() => {
  const DB_NAME = 'iba-finance';
  let idb = null;
  let mem = { ver: CACHE_VERSION, payments: {}, syncAt: 0, fullAt: 0, uid: null };
  const listeners = new Set();
  let syncing = null;
  let lastSyncCheck = 0;
  let stats = { mode: 'none', downloaded: 0 };

  function open() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => { idb = req.result; resolve(); };
        req.onerror = () => resolve();
      } catch (e) { resolve(); }
    });
  }
  function idbGet(key) {
    return new Promise((resolve) => {
      if (!idb) return resolve(null);
      try { const r = idb.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); } catch (e) { resolve(null); }
    });
  }
  function idbPut(key, val) {
    return new Promise((resolve) => {
      if (!idb) return resolve();
      try { const tx = idb.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); } catch (e) { resolve(); }
    });
  }
  const save = () => idbPut('state', mem);
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  async function load(uid) {
    await open();
    const s = await idbGet('state');
    if (s && s.ver === CACHE_VERSION && s.uid === uid && s.payments) mem = s;
    else mem = { ver: CACHE_VERSION, payments: {}, syncAt: 0, fullAt: 0, uid };
    if (Object.keys(mem.payments).length) notify();
  }

  async function fullLoad(meta) {
    const snap = await REF.payments.once('value');
    const all = {}; let n = 0;
    snap.forEach((c) => { all[c.key] = { id: c.key, ...c.val() }; n++; });
    mem.payments = all;
    mem.syncAt = Math.max(meta.lastChange || 0, meta.resetAt || 0, Date.now() + serverOffset);
    mem.fullAt = Date.now();
    stats = { mode: 'full', downloaded: n };
  }

  async function deltaLoad(meta) {
    const from = Math.max(0, mem.syncAt - 5000);   // 5 s overlap for safety; repeats are harmless
    const [chg, del] = await Promise.all([
      REF.payments.orderByChild('updatedAt').startAt(from).once('value'),
      REF.deleted.orderByValue().startAt(from).once('value')
    ]);
    let n = 0;
    chg.forEach((c) => { mem.payments[c.key] = { id: c.key, ...c.val() }; n++; });
    del.forEach((c) => {
      const rec = mem.payments[c.key];
      // a record deleted and later re-created keeps the newest one
      if (rec && toNum(rec.updatedAt) > toNum(c.val())) return;
      delete mem.payments[c.key]; n++;
    });
    mem.syncAt = Math.max(mem.syncAt, meta.lastChange || 0);
    stats = { mode: 'delta', downloaded: n };
  }

  /** The only place that downloads payments. */
  function sync({ force = false } = {}) {
    if (syncing) return syncing;
    syncing = (async () => {
      lastSyncCheck = Date.now();
      let meta = {}, metaOk = true;
      try { meta = (await REF.meta.once('value')).val() || {}; }
      catch (e) { metaOk = false; console.warn('payments_meta cannot be read (check Firebase rules); loading the full list instead.', e); }
      const stale = !mem.fullAt || (Date.now() - mem.fullAt) > FULL_CHECK_DAYS * 864e5;
      const reset = toNum(meta.resetAt) > toNum(mem.syncAt);
      if (!metaOk || force || stale || reset || !Object.keys(mem.payments).length && !mem.syncAt) {
        await fullLoad(meta);
      } else if (toNum(meta.lastChange) > toNum(mem.syncAt)) {
        try { await deltaLoad(meta); }
        catch (e) { console.warn('Small download failed (check Firebase rules for payments_deleted); loading the full list instead.', e); await fullLoad(meta); }
      } else {
        stats = { mode: 'none', downloaded: 0 };
      }
      await save();
      notify();
      return stats;
    })().finally(() => { syncing = null; });
    return syncing;
  }

  /** check again when the tab comes back, at most once a minute */
  function syncIfIdle() { if (Date.now() - lastSyncCheck > 60000) sync().catch((e) => console.warn('sync', e)); }

  // ---- writes: always one multi-path update, always stamps the pocket ----
  async function write(updates) {
    const withStamp = { ...updates, 'payments_meta/lastChange': TS };
    try { await REF.root.update(withStamp); }
    catch (e) {
      if (!/permission/i.test(String(e && (e.code || e.message)))) throw e;
      // rules do not allow payments_meta / payments_deleted yet: save the payment itself anyway
      console.warn('Stamp not allowed by Firebase rules; saving without it. Other browsers will see this change at their next full check.', e);
      const plain = {}; Object.entries(updates).forEach(([k, v]) => { if (k.startsWith('payments/')) plain[k] = v; });
      await REF.root.update(plain);
    }
    await sync();
  }
  function stamp(data) {
    const out = { ...data, updatedAt: TS, updatedBy: (auth.currentUser && auth.currentUser.email) || '' };
    return out;
  }
  async function create(data) {
    const id = REF.payments.push().key;
    await write({ ['payments/' + id]: stamp(data) });
    return id;
  }
  async function update(id, data) {
    const u = {};
    Object.entries(stamp(data)).forEach(([k, v]) => { u[`payments/${id}/${k}`] = v; });
    await write(u);
  }
  async function remove(id) {
    await write({ ['payments/' + id]: null, ['payments_deleted/' + id]: TS });
  }
  async function removeAll() {
    await REF.root.update({ payments: null, payments_deleted: null, 'payments_meta/resetAt': TS, 'payments_meta/lastChange': TS });
    mem.payments = {}; mem.syncAt = 0; await save();
    await sync({ force: true });
  }
  async function bulkCreate(list, onProgress) {
    const CHUNK = 400;
    for (let i = 0; i < list.length; i += CHUNK) {
      const u = {};
      list.slice(i, i + CHUNK).forEach((d) => { u['payments/' + REF.payments.push().key] = stamp(d); });
      u['payments_meta/lastChange'] = TS;
      await REF.root.update(u);
      if (onProgress) onProgress(Math.min(i + CHUNK, list.length), list.length);
    }
    await sync();
  }

  let serverOffset = 0;
  db.ref('.info/serverTimeOffset').on('value', (s) => { serverOffset = s.val() || 0; });

  return {
    load, sync, syncIfIdle, create, update, remove, removeAll, bulkCreate,
    all: () => Object.values(mem.payments),
    get: (id) => mem.payments[id],
    count: () => Object.keys(mem.payments).length,
    onChange: (fn) => listeners.add(fn),
    lastStats: () => stats,
    clearLocal: async () => { mem = { ver: CACHE_VERSION, payments: {}, syncAt: 0, fullAt: 0, uid: mem.uid }; await save(); }
  };
})();

// =====================================================================
// QUERIES ON THE POCKET (no downloads)
// =====================================================================
const byPO = (po) => Store.all().filter((r) => String(r.poNo ?? '').trim() === String(po).trim());
function sortPVN(list) { return list.slice().sort((a, b) => pvnNum(a.paymentNo) - pvnNum(b.paymentNo) || String(a.dateEntered || '').localeCompare(String(b.dateEntered || ''))); }
function nextPVN(po) { return 'PVN-' + (byPO(po).reduce((m, r) => Math.max(m, pvnNum(r.paymentNo)), 0) + 1); }

function normSite(s) { return String(s ?? '').toLowerCase().replace(/site/g, '').replace(/[\s\-_.#:]/g, ''); }
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');

/** What the person typed: {mode:'po'|'site'|'vendor', value} */
function classify(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const siteWord = t.match(/^site\s*[:#-]?\s*(.+)$/i);
  if (siteWord) return { mode: 'site', value: siteWord[1].trim() };
  if (/^\d{5}$/.test(t)) return { mode: 'po', value: t };
  if (/^\d+$/.test(t)) return { mode: 'site', value: t };
  if (/^[a-z]{1,3}[\s-]?\d+[a-z]?$/i.test(t)) return { mode: 'site', value: t };
  return { mode: 'vendor', value: t };
}

function siteMatches(recSite, q) {
  const qs = normSite(q), rs = normSite(recSite);
  if (!qs || !rs) return false;
  if (/^\d+$/.test(qs)) return digitsOf(rs) === qs;          // "170" finds 170, M170, Site 170
  return rs === qs || rs.startsWith(qs);                       // "M1111" finds M1111, M1111A
}

/** groups of POs: [{po, vendor, vendorId, site, poValue, certified, paid, waiting, count, last}] */
function groupPOs(records) {
  const map = new Map();
  records.forEach((r) => {
    const po = String(r.poNo ?? '').trim(); if (!po) return;
    let g = map.get(po);
    if (!g) { g = { po, vendor: '', vendorId: '', site: '', poValue: 0, certified: 0, paid: 0, waiting: 0, retention: 0, count: 0, last: '' }; map.set(po, g); }
    const key = String(r.dateEntered || '') + String(pvnNum(r.paymentNo)).padStart(6, '0');
    if (key >= g.last) { g.last = key; g.vendor = String(r.vendor ?? '').trim() || g.vendor; g.vendorId = String(r.vendorId ?? '').trim() || g.vendorId; g.site = String(r.site ?? '').trim() || g.site; g.poValue = toNum(r.poValue) || g.poValue; }
    g.certified += toNum(r.certifiedAmount);
    g.retention += toNum(r.retention);
    if (isPaid(r)) g.paid += toNum(r.payment); else g.waiting += toNum(r.payment);
    g.count++;
  });
  return Array.from(map.values());
}

function searchRecords(mode, value) {
  const all = Store.all();
  if (mode === 'po') return all.filter((r) => String(r.poNo ?? '').trim() === value.trim());
  if (mode === 'site') return all.filter((r) => siteMatches(r.site, value));
  // also catch payments whose name was typed differently but whose vendor ID matches the vendor list
  const ids = new Set(vendorListMatches(value).map((v) => v.id.toLowerCase()));
  return all.filter((r) => vendorMatches(r, value) || ids.has(String(r.vendorId ?? '').trim().toLowerCase()));
}
function vendorListMatches(value) {
  try { return (typeof Vendors !== 'undefined' ? Vendors.all() : []).filter((v) => textMatches(v.name, value) || v.id.toLowerCase() === String(value).trim().toLowerCase()); } catch (e) { return []; }
}

/** "khalifa" finds "Al Khalifa Trading"; small typos such as "kahlifa" still match. */
const normWord = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
function editDist(a, b) {            // typo distance, a swap of two letters counts as 1
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function textMatches(text, query) {
  const t = normWord(text), q = normWord(query);
  if (!t || !q) return false;
  if (t.includes(q) || t.replace(/ /g, '').includes(q.replace(/ /g, ''))) return true;
  const words = t.split(' ');
  return q.split(' ').every((qw) => words.some((w) => {
    if (w.startsWith(qw)) return true;
    if (qw.length < 4) return false;
    const allow = qw.length >= 7 ? 2 : 1;
    return editDist(qw, w) <= allow || (w.length > qw.length && editDist(qw, w.slice(0, qw.length)) <= allow);
  }));
}
function vendorMatches(r, value) {
  const q = String(value ?? '').trim();
  if (!q) return false;
  if (String(r.vendorId ?? '').trim().toLowerCase() === q.toLowerCase()) return true;
  return textMatches(r.vendor, q);
}

// =====================================================================
// STATE + AUTH
// =====================================================================
const state = { searchMode: 'auto', user: null, isSuper: false, view: 'dashboard', lastQuery: null, openPO: null, editId: null, bound: false };
const isSuperEmail = (email) => SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase().trim()).includes(String(email || '').toLowerCase().trim());

document.addEventListener('DOMContentLoaded', () => {
  $('loginVersion').textContent = 'Version ' + APP_VERSION;
  $('appVersion').textContent = 'Version ' + APP_VERSION;
  Background.applyCached();
  $('loginForm').addEventListener('submit', onLogin);
  auth.onAuthStateChanged(onAuth);
});

async function onLogin(e) {
  e.preventDefault();
  const btn = $('loginBtn'); btn.disabled = true; btn.textContent = 'Signing in…';
  $('loginError').hidden = true;
  try { await auth.signInWithEmailAndPassword($('loginEmail').value.trim(), $('loginPassword').value); }
  catch (err) { $('loginError').textContent = err.message; $('loginError').hidden = false; }
  finally { btn.disabled = false; btn.textContent = 'Sign in'; }
}

async function onAuth(user) {
  state.user = user;
  if (!user) {
    $('mainApp').hidden = true; $('loginScreen').hidden = false;
    document.body.classList.remove('signed-in');
    return;
  }
  state.isSuper = isSuperEmail(user.email);
  $('loginScreen').hidden = true; $('mainApp').hidden = false;
  document.body.classList.add('signed-in');
  $('userEmail').textContent = user.email;
  $('avatarBtn').textContent = (user.email || '?').charAt(0).toUpperCase();
  document.querySelectorAll('.super-only').forEach((el) => { el.hidden = !state.isSuper; });
  bindOnce();
  Background.load();
  Vendors.load();
  setSync('Loading…', 'bi-cloud-arrow-down');
  await Store.load(user.uid);
  try {
    const st = await Store.sync();
    syncLabel(st);
  } catch (err) {
    console.error(err);
    const msg = String((err && (err.code || err.message)) || err);
    if (/permission/i.test(msg)) { setSync('No permission to read payments', 'bi-shield-exclamation'); toast('Firebase refused to read payments: ' + msg, 'error', 8000); }
    else { setSync(navigator.onLine ? 'Could not load: ' + msg.slice(0, 60) : 'Offline: using saved copy', 'bi-cloud-slash'); if (navigator.onLine) toast('Could not load payments: ' + msg, 'error', 8000); }
  }
  renderDashboard();
  window.dispatchEvent(new CustomEvent('finance:ready'));
}

function setSync(text, icon) { $('syncText').textContent = text; $('syncPill').querySelector('i').className = 'bi ' + icon; }
function syncLabel(st) {
  const n = Store.count().toLocaleString();
  if (!st || st.mode === 'none') setSync(`${n} records · up to date`, 'bi-cloud-check');
  else if (st.mode === 'delta') setSync(`${n} records · ${st.downloaded} new`, 'bi-cloud-check');
  else setSync(`${n} records · full copy saved`, 'bi-cloud-check');
}

// =====================================================================
// EVENTS (bound ONCE — fixes the double save / double delete)
// =====================================================================
function bindOnce() {
  if (state.bound) return; state.bound = true;

  document.querySelectorAll('[data-view]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showView(a.dataset.view); }));
  $('logoutBtn').addEventListener('click', () => auth.signOut());
  $('reloadAllBtn').addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'Reload all records?', html: '<p>This downloads every payment again. Only needed if something looks out of date.</p>', buttons: [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: 'Reload', cls: 'btn-gold', value: true }] });
    if (!ok) return;
    setSync('Reloading…', 'bi-cloud-arrow-down');
    syncLabel(await Store.sync({ force: true })); toast('All records reloaded');
  });

  // search
  const input = $('smartSearch');
  input.addEventListener('input', onSearchInput);
  input.addEventListener('keydown', onSearchKey);
  input.addEventListener('blur', () => setTimeout(() => { $('suggest').hidden = true; }, 150));
  $('searchBtn').addEventListener('click', () => runSearch());
  $('bgMenuBtn').addEventListener('click', () => { if (state.isSuper) { showView('settings'); window.scrollTo(0, 0); } });
  $('clearSearch').addEventListener('click', () => { input.value = ''; onSearchInput(); state.lastQuery = null; state.openPO = null; renderDashboard(); input.focus(); });
  document.querySelectorAll('#modeSwitch .chip-btn').forEach((b) => b.addEventListener('click', () => setSearchMode(b.dataset.mode)));
  document.querySelectorAll('#modeTabs .mode-tab').forEach((b) => b.addEventListener('click', () => setSearchMode(b.dataset.mode)));
  let savedMode = 'auto'; try { savedMode = localStorage.getItem('fin.searchMode') || 'auto'; } catch (e) { /* ignore */ }
  setSearchMode(savedMode, true);
  $('results').addEventListener('click', onResultsClick);
  $('stats').addEventListener('click', (e) => { const b = e.target.closest('[data-stat]'); if (b) showStatList(b.dataset.stat); });

  // payment form
  ['certifiedAmount', 'retention'].forEach((id) => $(id).addEventListener('input', () => { if (id === 'certifiedAmount') applyPct(); recalc(); }));
  $('retention').addEventListener('input', () => { $('retentionPct').value = ''; markPct(null); });
  $('retentionPct').addEventListener('input', () => { markPct(null); applyPct(); recalc(); });
  document.querySelectorAll('.pct-btn').forEach((b) => b.addEventListener('click', () => { $('retentionPct').value = b.dataset.pct; markPct(b.dataset.pct); applyPct(); recalc(); }));
  MONEY_FIELDS.forEach((id) => { const el = $(id); if (el && !el.readOnly) el.addEventListener('blur', () => { if (el.value.trim()) el.value = money(el.value); }); });
  ['poValue', 'poNo'].forEach((id) => $(id).addEventListener('input', recalc));
  $('saveBtn').addEventListener('click', onSave);
  $('copyNewBtn').addEventListener('click', onCopyAsNew);
  $('vendor').addEventListener('input', () => Vendors.onNameInput());
  $('vendorId').addEventListener('input', () => Vendors.onIdInput());

  // records
  $('exportBtn').addEventListener('click', () => exportCSV('IBA-Finance-payments'));
  $('templateBtn').addEventListener('click', () => downloadText('payment_template.csv', CSV_HEADERS.join(',') + '\n'));
  $('importBtn').addEventListener('click', importCSV);
  $('deleteAllBtn').addEventListener('click', deleteAll);
  $('vendorUploadForm').addEventListener('submit', (e) => { e.preventDefault(); Vendors.upload(); });
  $('vendorReloadBtn').addEventListener('click', () => Vendors.load(true));
  $('vendorFilter').addEventListener('input', () => Vendors.renderTable());
  $('printReportBtn').addEventListener('click', () => window.print());

  Background.bindSettings();

  Store.onChange(() => { if (state.user) refreshCurrent(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user) Store.syncIfIdle(); });
  window.addEventListener('focus', () => { if (state.user) Store.syncIfIdle(); });
}

function showView(v) {
  if (v === 'settings' && !state.isSuper) v = 'dashboard';
  state.view = v;
  ['dashboard', 'vendors', 'records', 'settings'].forEach((n) => { $('view-' + n).hidden = n !== v; });
  document.querySelectorAll('.navlink').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
  if (v === 'vendors') Vendors.renderTable();
  if (v === 'settings') Background.renderSettings();
  if (v === 'dashboard' && !state.lastQuery && !state.openPO) renderDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshCurrent() {
  syncLabel(Store.lastStats());
  if (state.view !== 'dashboard') return;
  renderStats();
  if (state.openPO) renderPO(state.openPO);
  else if (state.lastQuery) renderQuery(state.lastQuery);
  else renderHome();
}

// =====================================================================
// SMART SEARCH
// =====================================================================
const KIND_LABEL = { po: 'PO', site: 'Site', vendor: 'Vendor' };
let suggestItems = [];
let suggestIndex = -1;

const MODE_INFO = {
  auto: { ph: 'e.g. 41287, M1111, site 170, Khalifa', help: 'Auto: 5 digits = PO · 170, M1111, Site 170 = Site · words = Vendor' },
  po: { ph: 'PO number, e.g. 41287', help: 'Searching PO numbers only' },
  site: { ph: 'Site, e.g. 170, M1111', help: 'Searching sites only' },
  vendor: { ph: 'Vendor name or vendor ID, e.g. Khalifa', help: 'Searching vendor names and IDs only (small typos are OK)' },
};
function setSearchMode(mode, silent) {
  if (!MODE_INFO[mode]) mode = 'auto';
  state.searchMode = mode;
  try { localStorage.setItem('fin.searchMode', mode); } catch (e) { /* ignore */ }
  document.querySelectorAll('#modeTabs .mode-tab').forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  $('smartSearch').placeholder = MODE_INFO[mode].ph;
  $('modeHelp').textContent = MODE_INFO[mode].help;
  if (silent) return;
  onSearchInput();
  if ($('smartSearch').value.trim()) runSearch();
  $('smartSearch').focus();
}
/** classify, but obey the PO / Site / Vendor button when one is picked */
function readQuery(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const m = state.searchMode;
  if (m === 'auto') return classify(t);
  if (m === 'site') return { mode: 'site', value: t.replace(/^site\s*[:#-]?\s*/i, '') || t };
  return { mode: m, value: t };
}

function onSearchInput() {
  try { onSearchInputInner(); } catch (err) { console.error('Search typing failed', err); }
}
function onSearchInputInner() {
  const v = $('smartSearch').value;
  const c = readQuery(v);
  const chip = $('detectChip');
  $('clearSearch').hidden = !v;
  if (!c) { chip.hidden = true; $('modeSwitch').hidden = true; $('suggest').hidden = true; return; }
  chip.hidden = false; chip.className = 'detect-chip ' + c.mode;
  chip.textContent = `${KIND_LABEL[c.mode]} ${c.mode === 'vendor' ? '' : c.value}`.trim();
  $('modeSwitch').hidden = state.searchMode !== 'auto';
  buildSuggest(v.trim());
}

function buildSuggest(q) {
  const ql = q.toLowerCase(); const out = []; const seen = new Set();
  const groups = groupPOs(Store.all());
  const c = readQuery(q);
  const m = state.searchMode;
  if (/^\d+$/.test(q) && (m === 'auto' || m === 'po')) groups.filter((g) => g.po.startsWith(q)).slice(0, 5).forEach((g) => { out.push({ kind: 'po', value: g.po, label: `PO ${g.po}`, sub: g.vendor }); });
  if (c && c.mode === 'site') {
    groups.filter((g) => siteMatches(g.site, c.value)).forEach((g) => { const k = 'site:' + String(g.site).toLowerCase(); if (!seen.has(k) && out.length < 9) { seen.add(k); out.push({ kind: 'site', value: g.site, label: `Site ${g.site}`, sub: '' }); } });
  }
  if (q.length >= 2 && ((m === 'auto' && /[a-z]/i.test(q)) || m === 'vendor')) {
    groups.filter((g) => g.vendor && textMatches(g.vendor, q)).forEach((g) => { const k = 'v:' + String(g.vendor).toLowerCase(); if (!seen.has(k) && out.length < 9) { seen.add(k); out.push({ kind: 'vendor', value: g.vendor, label: g.vendor, sub: g.vendorId }); } });
  }
  suggestItems = out; suggestIndex = -1;
  const ul = $('suggest');
  if (!out.length) { ul.hidden = true; return; }
  ul.innerHTML = out.map((s, i) => `<li role="option" data-i="${i}"><span class="kind ${s.kind}">${KIND_LABEL[s.kind]}</span><span>${esc(s.label)}</span><span class="sub">${esc(s.sub)}</span></li>`).join('');
  ul.hidden = false;
  ul.querySelectorAll('li').forEach((li) => li.addEventListener('mousedown', (e) => { e.preventDefault(); pickSuggest(+li.dataset.i); }));
}
function pickSuggest(i) {
  const s = suggestItems[i]; if (!s) return;
  $('smartSearch').value = s.kind === 'site' ? 'site ' + s.value : s.value;
  $('suggest').hidden = true;
  runSearch(s.kind, s.value);
}
function onSearchKey(e) {
  const ul = $('suggest');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (ul.hidden || !suggestItems.length) return;
    e.preventDefault();
    suggestIndex = (suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestItems.length) % suggestItems.length;
    ul.querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', i === suggestIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!ul.hidden && suggestIndex >= 0) pickSuggest(suggestIndex); else runSearch();
  } else if (e.key === 'Escape') { ul.hidden = true; }
}

/** runSearch(forceMode?, forceValue?) */
function runSearch(forceMode, forceValue) {
  try { runSearchInner(forceMode, forceValue); } catch (err) { console.error('Search failed', err); toast('Search failed: ' + (err && err.message ? err.message : err), 'error'); }
}
function runSearchInner(forceMode, forceValue) {
  $('suggest').hidden = true;
  const raw = $('smartSearch').value.trim();
  if (!raw && !forceValue) { toast('Type a PO number, site or vendor', 'info'); return; }
  let q = readQuery(raw) || { mode: 'vendor', value: raw };
  if (forceMode) q = { mode: forceMode, value: forceValue || (forceMode === 'site' ? (classify(raw)?.value || raw) : raw.replace(/^site\s*/i, '')) };
  if (q.mode === 'vendor' && q.value.length < 2) { toast('Type at least 2 letters for a vendor', 'info'); return; }
  // 5 digits that are not a PO but are a site: show the site
  if (q.mode === 'po' && !forceMode && state.searchMode === 'auto' && !byPO(q.value).length && Store.all().some((r) => siteMatches(r.site, q.value))) q = { mode: 'site', value: q.value };
  const chip = $('detectChip'); chip.hidden = false; chip.className = 'detect-chip ' + q.mode; chip.textContent = `${KIND_LABEL[q.mode]} ${q.mode === 'vendor' ? '' : q.value}`.trim();
  state.lastQuery = q;
  if (q.mode === 'po') { openPO(q.value); return; }
  state.openPO = null;
  renderQuery(q);
}

// =====================================================================
// RENDERING
// =====================================================================
function renderDashboard() { renderStats(); if (state.openPO) renderPO(state.openPO); else if (state.lastQuery) renderQuery(state.lastQuery); else renderHome(); }

function computeStats() {
  const all = Store.all();
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let waitingN = 0, waitingAmt = 0, retention = 0, paidMonth = 0, paidMonthN = 0;
  all.forEach((r) => {
    retention += toNum(r.retention);
    if (!isPaid(r)) { waitingN++; waitingAmt += toNum(r.payment); }
    const d = parseDate(r.datePaid);
    if (d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === ym) { paidMonth += toNum(r.payment); paidMonthN++; }
  });
  const near = groupPOs(all).filter((g) => g.poValue > 0 && g.certified / g.poValue >= 0.9);
  return { waitingN, waitingAmt, retention, paidMonth, paidMonthN, nearN: near.length };
}

function renderStats() {
  const s = computeStats();
  const tile = (key, label, value, sub, color) => `<button type="button" class="glass stat" data-stat="${key}"><div class="stat-label">${label}</div><div class="stat-value" style="color:${color}">${value}</div><div class="stat-sub">${sub}</div></button>`;
  $('stats').innerHTML =
    tile('waiting', 'Waiting for payment', s.waitingN.toLocaleString(), `${money(s.waitingAmt)} with no cheque or date paid`, 'var(--orange-2)') +
    tile('retention', 'Retention held', moneyShort(s.retention), money(s.retention), 'var(--text)') +
    tile('month', 'Paid this month', moneyShort(s.paidMonth), `${s.paidMonthN} payments`, 'var(--teal-2)') +
    tile('near', 'POs over 90% certified', s.nearN.toLocaleString(), 'close to PO value', 'var(--gold)');
}

function renderHome() {
  const recent = Store.all().slice().sort((a, b) => toNum(b.updatedAt) - toNum(a.updatedAt) || String(b.dateEntered || '').localeCompare(String(a.dateEntered || ''))).slice(0, 8);
  if (!Store.count()) { $('results').innerHTML = `<div class="glass empty">No payment records yet. Search a PO number to add the first one.</div>`; return; }
  $('results').innerHTML = `<div class="res-head"><h3>Latest entries</h3></div>` + paymentTable(recent, { showPO: true });
}

function poCard(g) {
  const base = Math.max(g.poValue, g.certified, 1);
  const paidW = Math.min(100, (g.paid / base) * 100), waitW = Math.min(100 - paidW, (g.waiting / base) * 100);
  return `<button type="button" class="glass po-card" data-po="${esc(g.po)}">
    <div class="d-flex justify-content-between align-items-center w-100"><span class="po-tag">PO ${esc(g.po)}</span><span class="small muted">${g.site ? 'Site ' + esc(g.site) : ''}</span></div>
    <div class="po-vendor">${esc(g.vendor) || '<span class="muted">No vendor</span>'}</div>
    <div class="bar w-100" aria-hidden="true"><div class="paid" style="width:${paidW}%"></div><div class="wait" style="width:${waitW}%"></div></div>
    <div class="bar-legend w-100"><span><b class="p">${moneyShort(g.paid)}</b> paid</span><span><b class="w">${moneyShort(g.waiting)}</b> waiting</span><span>of ${moneyShort(g.poValue)}</span></div>
  </button>`;
}

function renderQuery(q) {
  if (q.mode === 'stat') { showStatList(q.value); return; }
  const recs = searchRecords(q.mode, q.value);
  const groups = groupPOs(recs).sort((a, b) => b.last.localeCompare(a.last));
  const title = q.mode === 'site' ? `Site ${esc(q.value)}` : `Vendor “${esc(q.value)}”`;
  // vendors from the vendor list that match but have no payment records yet
  let noPay = '';
  if (q.mode === 'vendor') {
    const withPay = new Set(groups.map((g) => String(g.vendorId).toLowerCase()));
    const names = new Set(groups.map((g) => String(g.vendor).toLowerCase()));
    const extra = vendorListMatches(q.value).filter((v) => !withPay.has(v.id.toLowerCase()) && !names.has(v.name.toLowerCase())).slice(0, 20);
    if (extra.length) noPay = `<div class="res-head mt-3"><h3>${groups.length ? 'Other matching vendors' : 'Matching vendors'}</h3><span class="pill">no payments yet</span></div>
      <div class="glass vend-none">${extra.map((v) => `<div class="vn-row"><span>${esc(v.name)}</span><span class="muted">${esc(v.id)}</span></div>`).join('')}
      <div class="small muted mt-2">These vendors are in the vendor list but have no payment saved. To add one, search its PO number and press New payment.</div></div>`;
  }
  if (!groups.length) {
    $('results').innerHTML = noPay ? `<div class="glass empty mb-3">No payments found for ${title}.</div>` + noPay : `<div class="glass empty">Nothing found for ${title}.</div>`;
    return;
  }
  $('results').innerHTML = `<div class="res-head"><h3>${title}</h3><span class="pill">${groups.length} PO${groups.length > 1 ? 's' : ''} · ${recs.length} payments</span></div>
    <div class="po-grid">${groups.map(poCard).join('')}</div>` + noPay;
}

function openPO(po) { state.openPO = String(po).trim(); renderPO(state.openPO); window.dispatchEvent(new CustomEvent('finance:po', { detail: po })); }

function renderPO(po) {
  const recs = sortPVN(byPO(po));
  if (!recs.length) {
    $('results').innerHTML = `<div class="glass empty"><p class="mb-3">No payments for PO <b>${esc(po)}</b> yet.</p><button type="button" class="btn btn-gold" data-act="new" data-po="${esc(po)}"><i class="bi bi-plus-lg"></i> New payment for PO ${esc(po)}</button></div>`;
    return;
  }
  const g = groupPOs(recs)[0];
  const base = Math.max(g.poValue, g.certified, 1);
  const paidW = Math.min(100, (g.paid / base) * 100), waitW = Math.min(100 - paidW, (g.waiting / base) * 100);
  const pct = g.poValue ? Math.round((g.certified / g.poValue) * 100) : 0;
  $('results').innerHTML = `
  <div class="glass po-summary">
    <div class="d-flex align-items-center gap-3 flex-wrap">
      <span class="po-tag">PO ${esc(po)}</span>
      <span class="po-vendor">${esc(g.vendor)}</span>
      <span class="muted small">${g.vendorId ? 'ID ' + esc(g.vendorId) + ' · ' : ''}${g.site ? 'Site ' + esc(g.site) : ''}</span>
      <button type="button" class="btn btn-gold ms-auto" data-act="new" data-po="${esc(po)}"><i class="bi bi-plus-lg"></i> New payment</button>
    </div>
    <div class="bar mt-3" aria-hidden="true"><div class="paid" style="width:${paidW}%"></div><div class="wait" style="width:${waitW}%"></div></div>
    <div class="facts">
      <div><div class="fact-l">PO value</div><div class="fact-v">${money(g.poValue)}</div></div>
      <div><div class="fact-l">Certified (${pct}%)</div><div class="fact-v">${money(g.certified)}</div></div>
      <div><div class="fact-l">Paid</div><div class="fact-v" style="color:var(--teal-2)">${money(g.paid)}</div></div>
      <div><div class="fact-l">Waiting</div><div class="fact-v" style="color:var(--orange-2)">${money(g.waiting)}</div></div>
      <div><div class="fact-l">Retention held</div><div class="fact-v">${money(g.retention)}</div></div>
    </div>
  </div>
  <div class="res-head"><h3>Payment history</h3><span class="pill">${recs.length} payments</span></div>
  ${paymentTable(recs, {})}`;
}

function paymentTable(recs, { showPO }) {
  const rows = recs.map((r) => {
    const paid = isPaid(r);
    const st = `<span class="badge-st ${paid ? 'st-paid' : 'st-wait'}">${paid ? 'Paid' : 'Waiting'}</span>`;
    const acts = `<span class="row-actions">
      <button type="button" class="icon-btn" data-act="report" data-id="${esc(r.id)}" title="Print certificate" aria-label="Print certificate ${esc(r.paymentNo)}"><i class="bi bi-printer"></i></button>
      <button type="button" class="icon-btn" data-act="edit" data-id="${esc(r.id)}" title="Edit" aria-label="Edit ${esc(r.paymentNo)}"><i class="bi bi-pencil"></i></button>
      <button type="button" class="icon-btn del" data-act="delete" data-id="${esc(r.id)}" title="Delete" aria-label="Delete ${esc(r.paymentNo)}"><i class="bi bi-trash"></i></button></span>`;
    return { r, st, acts };
  });
  const table = `<div class="glass table-wrap pay-table"><table class="tbl"><thead><tr>
      ${showPO ? '<th>PO</th><th>Vendor</th>' : ''}<th>PVN</th><th>Entered</th><th>Cheque</th><th class="num">Certified</th><th class="num">Retention</th><th class="num">Net pay</th><th>Date paid</th><th>Status</th><th class="num">Actions</th></tr></thead><tbody>
      ${rows.map(({ r, st, acts }) => `<tr>
        ${showPO ? `<td><a href="#" data-act="po" data-po="${esc(r.poNo)}">${esc(r.poNo)}</a></td><td>${esc(r.vendor)}</td>` : ''}
        <td class="fw-semibold">${esc(r.paymentNo)}</td><td class="muted small">${esc(fmtDate(r.dateEntered))}</td><td>${esc(r.chequeNo) || '-'}</td>
        <td class="num">${money(r.certifiedAmount)}</td><td class="num t-ret">${money(r.retention)}</td><td class="num t-net">${money(r.payment)}</td>
        <td>${esc(fmtDate(r.datePaid))}</td><td>${st}</td><td class="num">${acts}</td></tr>`).join('')}
      </tbody></table></div>`;
  const cards = `<div class="pay-cards">${rows.map(({ r, st, acts }) => `<div class="glass pay-card">
      <div class="top"><b>${showPO ? 'PO ' + esc(r.poNo) + ' · ' : ''}${esc(r.paymentNo)}</b>${st}</div>
      <div class="mid"><span>Cheque ${esc(r.chequeNo) || '-'}</span><span class="t-net">${money(r.payment)}</span></div>
      <div class="mid"><span>Certified ${money(r.certifiedAmount)}</span><span>${esc(fmtDate(r.datePaid))}</span></div>
      <div>${acts}</div></div>`).join('')}</div>`;
  return table + cards;
}

function showStatList(key) {
  const all = Store.all();
  let recs = [], title = '';
  if (key === 'waiting') { recs = all.filter((r) => !isPaid(r)); title = 'Waiting for payment'; }
  else if (key === 'month') { const n = new Date(); recs = all.filter((r) => { const d = parseDate(r.datePaid); return d && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }); title = 'Paid this month'; }
  else if (key === 'retention') { recs = all.filter((r) => toNum(r.retention) > 0); title = 'Payments with retention'; }
  else if (key === 'near') {
    const gs = groupPOs(all).filter((g) => g.poValue > 0 && g.certified / g.poValue >= 0.9);
    state.openPO = null; state.lastQuery = { mode: 'stat', value: key };
    $('results').innerHTML = `<div class="res-head"><h3>POs over 90% certified</h3><span class="pill">${gs.length}</span></div>` + (gs.length ? `<div class="po-grid">${gs.map(poCard).join('')}</div>` : '<div class="glass empty">None</div>');
    return;
  }
  state.openPO = null; state.lastQuery = { mode: 'stat', value: key };
  recs.sort((a, b) => String(a.poNo).localeCompare(String(b.poNo)) || pvnNum(a.paymentNo) - pvnNum(b.paymentNo));
  $('results').innerHTML = `<div class="res-head"><h3>${title}</h3><span class="pill">${recs.length}</span></div>` + (recs.length ? paymentTable(recs, { showPO: true }) : '<div class="glass empty">None</div>');
}

function onResultsClick(e) {
  const el = e.target.closest('[data-act], [data-po]');
  if (!el) return;
  e.preventDefault();
  const act = el.dataset.act;
  if (!act && el.dataset.po) { $('smartSearch').value = el.dataset.po; onSearchInput(); $('suggest').hidden = true; state.lastQuery = { mode: 'po', value: el.dataset.po }; openPO(el.dataset.po); window.scrollTo({ top: $('results').offsetTop - 90, behavior: 'smooth' }); return; }
  if (act === 'po') { $('smartSearch').value = el.dataset.po; onSearchInput(); $('suggest').hidden = true; state.lastQuery = { mode: 'po', value: el.dataset.po }; openPO(el.dataset.po); return; }
  if (act === 'new') { openNewPayment(el.dataset.po); return; }
  const rec = Store.get(el.dataset.id);
  if (!rec) { toast('That record is no longer there. Refreshing…', 'info'); Store.sync(); return; }
  if (act === 'edit') openEditPayment(rec);
  else if (act === 'delete') deletePayment(rec);
  else if (act === 'report') showReport(rec);
}

// =====================================================================
// PAYMENT FORM
// =====================================================================
const FORM_FIELDS = ['paymentNo', 'chequeNo', 'site', 'vendor', 'vendorId', 'poNo', 'poValue', 'certifiedAmount', 'retention', 'datePaid', 'note'];
const paymentModal = () => bootstrap.Modal.getOrCreateInstance($('paymentModal'));

function fillForm(rec) {
  FORM_FIELDS.forEach((f) => { $(f).value = MONEY_FIELDS.includes(f) ? money(rec[f]) : (rec[f] ?? ''); });
  if ($('datePaid').value && !/^\d{4}-\d{2}-\d{2}$/.test($('datePaid').value)) { const d = parseDate($('datePaid').value); $('datePaid').value = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; }
  $('retentionPct').value = ''; markPct(null);
  const cert = toNum(rec.certifiedAmount), ret = toNum(rec.retention);
  if (cert > 0 && ret > 0) { const p = round2((ret / cert) * 100); if (p === 5 || p === 10) markPct(String(p)); }
  recalc();
}

/** open New Payment; prefill = {certifiedAmount, retentionPct, ...} from the teller */
function openNewPayment(po, prefill = {}) {
  state.editId = null;
  const recs = sortPVN(byPO(po || ''));
  const last = recs[recs.length - 1] || {};
  $('paymentForm').reset();
  fillForm({ poNo: po || '', site: last.site || '', vendor: last.vendor || '', vendorId: last.vendorId || '', poValue: last.poValue || '' });
  $('paymentNo').value = po ? nextPVN(po) : '';
  if (prefill.certifiedAmount !== undefined) $('certifiedAmount').value = money(prefill.certifiedAmount);
  if (prefill.retentionPct !== undefined && prefill.retentionPct !== null && prefill.retentionPct !== '') { $('retentionPct').value = prefill.retentionPct; markPct(String(prefill.retentionPct)); applyPct(); }
  if (prefill.retention !== undefined) $('retention').value = money(prefill.retention);
  ['chequeNo', 'datePaid', 'note', 'site', 'vendor', 'vendorId', 'poValue'].forEach((k) => { if (prefill[k] !== undefined && prefill[k] !== '') $(k).value = MONEY_FIELDS.includes(k) ? money(prefill[k]) : prefill[k]; });
  $('paymentTitle').textContent = 'New payment';
  $('copyNewBtn').hidden = true;
  $('saveBtn').textContent = 'Save ' + ($('paymentNo').value || 'payment');
  $('footHint').textContent = prefill.fromTeller ? 'Filled by the teller. Please check, then save.' : '';
  recalc();
  paymentModal().show();
}

function openEditPayment(rec) {
  state.editId = rec.id;
  $('paymentForm').reset();
  fillForm(rec);
  $('paymentTitle').textContent = 'Edit ' + (rec.paymentNo || 'payment');
  const nxt = nextPVN(rec.poNo);
  $('saveBtn').textContent = 'Update ' + (rec.paymentNo || 'this payment');
  $('copyNewBtn').hidden = false; $('copyNewBtn').textContent = 'Copy as new ' + nxt;
  $('footHint').textContent = `Update changes ${rec.paymentNo || 'this payment'}. Copy as new makes ${nxt} and leaves ${rec.paymentNo || 'this one'} as it is.`;
  recalc();
  paymentModal().show();
}

function markPct(p) { document.querySelectorAll('.pct-btn').forEach((b) => b.classList.toggle('active', b.dataset.pct === p)); }
function applyPct() {
  const pct = toNum($('retentionPct').value);
  if (!$('retentionPct').value.trim()) return;
  $('retention').value = money(round2(toNum($('certifiedAmount').value) * pct / 100));
}
function recalc() {
  const cert = toNum($('certifiedAmount').value), ret = toNum($('retention').value);
  $('netPay').textContent = money(round2(cert - ret));
  const po = $('poNo').value.trim();
  $('paymentSub').textContent = [po && 'PO ' + po, $('vendor').value, $('site').value && 'Site ' + $('site').value].filter(Boolean).join(' · ');
  $('pvnBadge').textContent = $('paymentNo').value ? $('paymentNo').value + (state.editId ? '' : ' · next free number') : '';
  if (!state.editId && po && /^\d+$/.test(po)) { $('paymentNo').value = nextPVN(po); $('pvnBadge').textContent = $('paymentNo').value + ' · next free number'; $('saveBtn').textContent = 'Save ' + $('paymentNo').value; }
  // warnings
  const w = [];
  if (ret > cert && cert > 0) w.push(['red', 'Retention is more than the certified amount.']);
  const poValue = toNum($('poValue').value);
  if (po && poValue > 0) {
    const others = byPO(po).filter((r) => r.id !== state.editId).reduce((s, r) => s + toNum(r.certifiedAmount), 0);
    const total = others + cert; const pct = Math.round((total / poValue) * 100);
    if (total > poValue) w.push(['red', `Total certified would be ${money(total)}, which is over the PO value of ${money(poValue)} (${pct}%).`]);
    else if (pct >= 90) w.push(['gold', `After this payment ${pct}% of the PO value is certified (${money(total)} of ${money(poValue)}).`]);
  }
  if (po && !/^\d{5}$/.test(po)) w.push(['gold', 'PO numbers are usually 5 digits. Please check the PO number.']);
  $('formWarnings').innerHTML = w.map(([k, t]) => `<div class="warn ${k}"><i class="bi bi-exclamation-triangle"></i><span>${esc(t)}</span></div>`).join('');
}

function readForm() {
  const d = {};
  FORM_FIELDS.forEach((f) => { const v = $(f).value.trim(); d[f] = MONEY_FIELDS.includes(f) ? (v ? String(round2(toNum(v))) : '') : v; });
  d.payment = String(round2(toNum(d.certifiedAmount) - toNum(d.retention)));
  return d;
}
function validate(d) {
  if (!d.poNo) { toast('Please enter the PO number', 'err'); $('poNo').focus(); return false; }
  if (!d.certifiedAmount) { toast('Please enter the certified amount', 'err'); $('certifiedAmount').focus(); return false; }
  return true;
}
function busy(btn, on, text) { btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${text || 'Saving…'}`; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; }

async function onSave() {
  const d = readForm(); if (!validate(d)) return;
  const btn = $('saveBtn'); busy(btn, true);
  try {
    if (state.editId) {
      const old = Store.get(state.editId) || {};
      delete d.paymentNo; // the PVN of an existing payment never changes here
      await Store.update(state.editId, d);
      toast(`${old.paymentNo || 'Payment'} updated`);
      window.dispatchEvent(new CustomEvent('finance:saved', { detail: { kind: 'update' } }));
    } else {
      d.paymentNo = nextPVN(d.poNo);
      d.dateEntered = todayISO();
      await Store.create(d);
      toast(`${d.paymentNo} saved for PO ${d.poNo}`);
      window.dispatchEvent(new CustomEvent('finance:saved', { detail: { kind: 'new' } }));
    }
    paymentModal().hide();
    afterWrite(d.poNo);
  } catch (err) { console.error(err); toast('Could not save: ' + err.message, 'err', 6000); }
  finally { busy(btn, false); }
}

async function onCopyAsNew() {
  const src = Store.get(state.editId); if (!src) return;
  const d = readForm(); if (!validate(d)) return;
  const nxt = nextPVN(d.poNo);
  paymentModal().hide();
  const choice = await confirmBox({
    title: 'Create a NEW payment?',
    html: `<p>This will create a <b>new</b> payment <b>${esc(nxt)}</b> for PO ${esc(d.poNo)}.</p><p><b>${esc(src.paymentNo)}</b> stays exactly as it is.</p><p class="muted mb-0">Did you only want to change ${esc(src.paymentNo)}? Choose “Update ${esc(src.paymentNo)} instead”.</p>`,
    buttons: [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: `Update ${src.paymentNo} instead`, cls: 'btn-teal', value: 'update' }, { label: `Create ${nxt}`, cls: 'btn-gold', value: 'new' }]
  });
  if (!choice) { paymentModal().show(); return; }
  try {
    if (choice === 'update') { delete d.paymentNo; await Store.update(src.id, d); toast(`${src.paymentNo} updated`); }
    else {
      d.paymentNo = nxt; d.dateEntered = todayISO();
      d.chequeNo = ''; d.datePaid = ''; d.note = '';
      await Store.create(d); toast(`${nxt} created. ${src.paymentNo} was not changed.`);
    }
    window.dispatchEvent(new CustomEvent('finance:saved', { detail: { kind: choice } }));
    afterWrite(d.poNo);
  } catch (err) { console.error(err); toast('Could not save: ' + err.message, 'err', 6000); }
}

async function deletePayment(rec) {
  const ok = await confirmBox({ title: `Delete ${rec.paymentNo || 'this payment'}?`, html: `<p>PO ${esc(rec.poNo)} · ${esc(rec.vendor)}<br>Net ${money(rec.payment)}</p><p class="muted mb-0">This cannot be undone.</p>`, buttons: [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: 'Delete', cls: 'btn-danger', value: true }] });
  if (!ok) return;
  try { await Store.remove(rec.id); toast(`${rec.paymentNo || 'Payment'} deleted`); afterWrite(rec.poNo); }
  catch (err) { toast('Could not delete: ' + err.message, 'err', 6000); }
}

function afterWrite(po) {
  if (po) { state.openPO = String(po); state.lastQuery = { mode: 'po', value: String(po) }; $('smartSearch').value = po; onSearchInput(); $('suggest').hidden = true; }
  if (state.view !== 'dashboard') showView('dashboard'); else renderDashboard();
}

// =====================================================================
// CERTIFICATE (from the pocket: no download)
// =====================================================================
function showReport(sel) {
  const all = sortPVN(byPO(sel.poNo));
  let idx = all.findIndex((r) => r.id === sel.id);
  if (idx < 0) idx = all.length - 1;
  const list = all.slice(0, idx + 1);
  const latest = list[list.length - 1];
  let tc = 0, tr = 0, tp = 0, prev = 0; const notes = [];
  list.forEach((r) => {
    tc += toNum(r.certifiedAmount); tr += toNum(r.retention); tp += toNum(r.payment);
    if (isPaid(r)) prev += toNum(r.payment);
    if (String(r.note || '').trim()) notes.push(String(r.note).trim());
  });
  $('reportDate').textContent = fmtDateLong(new Date());
  $('reportPoNo').textContent = sel.poNo;
  $('reportProject').textContent = latest.site || '';
  $('reportVendorId').textContent = latest.vendorId || '';
  $('reportVendorName').textContent = String(latest.vendor || '').slice(0, 27);
  $('reportTotalPoValue').textContent = money(latest.poValue);
  $('reportTotalCertified').textContent = money(tc);
  $('reportTotalPrevPayment').textContent = money(prev);
  $('reportTotalCommitted').textContent = money(toNum(latest.poValue) - tc);
  $('reportTotalRetention').textContent = money(tr);
  $('reportTableBody').innerHTML = list.map((r) => `<tr><td>${esc(String(r.paymentNo || '').replace('PVN-', ''))}</td><td>${esc(r.chequeNo)}</td><td>${money(r.certifiedAmount)}</td><td>${money(r.retention)}</td><td>${money(r.payment)}</td><td>${esc(fmtDate(r.datePaid))}</td></tr>`).join('');
  $('reportTotalCertifiedAmount').textContent = money(tc);
  $('reportTotalRetentionAmount').textContent = money(tr);
  $('reportTotalPaymentAmount').textContent = money(tp);
  $('reportNotesContent').textContent = notes.join('\n');
  $('reportNotesSection').hidden = !notes.length;
  bootstrap.Modal.getOrCreateInstance($('reportModal')).show();
}

// =====================================================================
// CSV: export, import, delete all
// =====================================================================
const CSV_HEADERS = ['Payment No.', 'Cheque No.', 'Site', 'Vendor', 'Vendor ID', 'PO No.', 'PO Value', 'Certified Amount', 'Retention', 'Payment', 'Date Paid', 'Note', 'Date Entered'];
const CSV_KEYS = ['paymentNo', 'chequeNo', 'site', 'vendor', 'vendorId', 'poNo', 'poValue', 'certifiedAmount', 'retention', 'payment', 'datePaid', 'note', 'dateEntered'];
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function exportCSV(prefix) {
  const rows = Store.all().slice().sort((a, b) => String(a.poNo).localeCompare(String(b.poNo)) || pvnNum(a.paymentNo) - pvnNum(b.paymentNo));
  const text = [CSV_HEADERS.join(',')].concat(rows.map((r) => CSV_KEYS.map((k) => csvCell(r[k])).join(','))).join('\r\n');
  downloadText(`${prefix}-${todayISO()}.csv`, text);
  toast(`${rows.length.toLocaleString()} records exported`);
  return rows.length;
}

function parseCsvRows(text) {
  const rows = []; let row = [], field = '', inQ = false;
  const s = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; continue; }
    if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

async function importCSV() {
  const file = $('paymentCsv').files[0];
  if (!file) { toast('Choose a CSV file first', 'info'); return; }
  const replace = state.isSuper && $('overwriteData').checked;
  try {
    const rows = parseCsvRows(await readFileAsText(file));
    if (rows.length < 2) { toast('The file has no records', 'err'); return; }
    const head = rows[0].map((h) => h.trim());
    const need = CSV_HEADERS.slice(0, 12);
    const missing = need.filter((h) => !head.includes(h));
    if (missing.length) { toast('Missing columns: ' + missing.join(', '), 'err', 7000); return; }
    const idx = Object.fromEntries(CSV_HEADERS.map((h, i) => [CSV_KEYS[i], head.indexOf(h)]));
    const list = rows.slice(1).map((r) => {
      const d = {};
      CSV_KEYS.forEach((k) => { if (idx[k] >= 0) { let v = String(r[idx[k]] ?? '').trim(); if (MONEY_FIELDS.includes(k)) v = v ? String(round2(toNum(v))) : ''; d[k] = v; } });
      if (!d.dateEntered) d.dateEntered = todayISO();
      return d;
    }).filter((d) => d.poNo);
    if (!list.length) { toast('No rows with a PO number', 'err'); return; }
    const ok = await confirmBox({ title: replace ? 'Replace ALL records?' : 'Import records?', html: replace ? `<p>All ${Store.count().toLocaleString()} current records will be deleted and replaced by <b>${list.length.toLocaleString()}</b> rows from the file.</p><p class="muted mb-0">A backup CSV of the current records downloads first.</p>` : `<p>Add <b>${list.length.toLocaleString()}</b> payments from the file?</p>`, buttons: [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: replace ? 'Back up and replace' : 'Import', cls: replace ? 'btn-danger' : 'btn-gold', value: true }] });
    if (!ok) return;
    const btn = $('importBtn'); busy(btn, true, 'Importing…');
    try {
      if (replace) { exportCSV('BACKUP-before-replace'); await Store.removeAll(); }
      await Store.bulkCreate(list, (n, t) => { btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${n} / ${t}`; });
      toast(`${list.length.toLocaleString()} payments imported`);
      $('importForm').reset();
    } finally { busy(btn, false); }
  } catch (err) { console.error(err); toast('Import failed: ' + err.message, 'err', 7000); }
}

async function deleteAll() {
  if (!state.isSuper) return;
  lastTick = false;
  const ok = await confirmBox({ title: 'Delete ALL payment records?', html: `<p>All <b>${Store.count().toLocaleString()}</b> records will be deleted for everyone.</p><p>A backup CSV downloads first. This cannot be undone.</p><div class="form-check"><input class="form-check-input" type="checkbox" id="delAllTick"><label class="form-check-label" for="delAllTick">I understand this deletes everything</label></div>`, buttons: [{ label: 'Cancel', cls: 'btn-ghost', value: null }, { label: 'Back up and delete all', cls: 'btn-danger', value: 'go' }] });
  if (ok !== 'go') return;
  if (!lastTick) { toast('Tick the box to confirm', 'info'); return; }
  exportCSV('BACKUP-before-delete-all');
  await Store.removeAll();
  toast('All records deleted. Backup downloaded.');
  state.openPO = null; state.lastQuery = null; renderDashboard();
}
let lastTick = false;
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'delAllTick') lastTick = e.target.checked; });

// =====================================================================
// VENDORS (GitHub CSV first: no Firebase download)
// =====================================================================
const Vendors = (() => {
  let list = [], byName = new Map(), byId = new Map(), loading = null;
  const KEY = 'iba-fin-vendors-v1';
  function index(l) {
    list = l; byName = new Map(); byId = new Map();
    l.forEach((v) => { byName.set(v.name.toLowerCase(), v); byId.set(v.id.toLowerCase(), v); });
    $('vendorCount').textContent = l.length.toLocaleString() + ' vendors';
  }
  function parse(text) {
    const rows = parseCsvRows(text); if (rows.length < 2) return [];
    const h = rows[0].map((x) => x.trim().toLowerCase());
    const ni = h.indexOf('name'); const ii = h.findIndex((k) => ['supplier id', 'supplierid', 'supplier_id'].includes(k));
    if (ni < 0 || ii < 0) throw new Error('The CSV needs "Name" and "Supplier ID" columns');
    return rows.slice(1).map((r) => ({ name: String(r[ni] ?? '').trim(), id: String(r[ii] ?? '').trim() })).filter((v) => v.name && v.id);
  }
  function load(force) {
    const cached = lsGet(KEY, null);
    if (cached && cached.list) index(cached.list);
    if (!force && cached && Date.now() - cached.at < 12 * 3600e3) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      try {
        const res = await fetch(VENDORS_CSV_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const l = parse(await res.text());
        if (!l.length) throw new Error('empty');
        index(l); lsSet(KEY, { at: Date.now(), list: l });
        if (force) toast(`${l.length.toLocaleString()} vendors loaded`);
      } catch (e) {
        if (list.length) return;
        try {   // backup list in Firebase, only when GitHub fails and nothing is saved
          const snap = await REF.vendors.once('value'); const l = [];
          snap.forEach((c) => { const v = c.val(); if (v && v.name && v.id) l.push({ name: String(v.name).trim(), id: String(v.id).trim() }); });
          index(l); lsSet(KEY, { at: Date.now(), list: l });
        } catch (e2) { console.warn('vendors', e2); }
      } finally { loading = null; renderTable(); }
    })();
    return loading;
  }
  function fillList(dl, items, key) { dl.innerHTML = items.map((v) => `<option value="${esc(v[key])}">${esc(key === 'name' ? v.id : v.name)}</option>`).join(''); }
  function onNameInput() {
    const q = $('vendor').value.trim().toLowerCase();
    fillList($('vendorList'), q ? list.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 40) : [], 'name');
    const hit = byName.get(q); if (hit) $('vendorId').value = hit.id;
    recalc();
  }
  function onIdInput() {
    const q = $('vendorId').value.trim().toLowerCase();
    fillList($('vendorIdList'), q ? list.filter((v) => v.id.toLowerCase().includes(q)).slice(0, 40) : [], 'id');
    const hit = byId.get(q); if (hit) $('vendor').value = hit.name;
  }
  function renderTable() {
    const q = ($('vendorFilter').value || '').trim().toLowerCase();
    const rows = (q ? list.filter((v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)) : list).slice(0, 200);
    $('vendorTable').innerHTML = rows.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.id)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No vendors</td></tr>';
  }
  async function upload() {
    if (!state.isSuper) return;
    const f = $('vendorCsv').files[0]; if (!f) return;
    try {
      const l = parse(await readFileAsText(f));
      if (!l.length) { toast('No vendors in the file', 'err'); return; }
      const u = {}; l.forEach((v) => { u[REF.vendors.push().key] = { name: v.name, id: v.id }; });
      await REF.vendors.set(u);
      index(l); lsSet(KEY, { at: Date.now(), list: l }); renderTable();
      toast(`${l.length.toLocaleString()} vendors uploaded`); $('vendorUploadForm').reset();
    } catch (e) { toast(e.message, 'err', 6000); }
  }
  return { load, onNameInput, onIdInput, renderTable, upload, all: () => list };
})();

// =====================================================================
// BACKGROUND (Super Admin sets it; everyone sees it)
// =====================================================================
const Background = (() => {
  const KEY = 'iba-fin-bg-v1';
  let cur = { ...BG_DEFAULT }, draft = null;
  const isPhone = () => window.matchMedia('(max-width: 768px)').matches;
  function apply(s) {
    const v = { ...BG_DEFAULT, ...(s || {}) };
    document.getElementById('bgLayer').style.backgroundImage = v.photo ? `url("${String(v.photo).replace(/"/g, '%22')}")` : 'none';
    document.documentElement.style.setProperty('--dim', String((isPhone() ? v.dimPhone : v.dimDesktop) / 100));
  }
  function applyCached() { cur = { ...BG_DEFAULT, ...lsGet(KEY, {}) }; apply(cur); window.matchMedia('(max-width: 768px)').addEventListener('change', () => apply(draft || cur)); }
  async function load() {
    try { const v = (await REF.background.once('value')).val(); if (v) { cur = { ...BG_DEFAULT, ...v }; lsSet(KEY, cur); apply(cur); } } catch (e) { console.warn('background', e); }
  }
  function renderSettings() {
    draft = { ...cur };
    $('bgGrid').innerHTML = BG_PHOTOS.map((p) => { const url = PHOTO_BASE + p; return `<button type="button" class="bg-thumb ${draft.photo === url ? 'on' : ''}" data-url="${esc(url)}" style="background-image:url('${esc(url)}')" aria-label="Use ${esc(p)}">${esc(p)}</button>`; }).join('') +
      `<button type="button" class="bg-thumb ${!draft.photo ? 'on' : ''}" data-url="" style="background:#0b1724" aria-label="No photo">No photo</button>`;
    $('dimDesk').value = draft.dimDesktop; $('dimPhone').value = draft.dimPhone; labels();
  }
  function labels() { $('dimDeskVal').textContent = $('dimDesk').value + '%'; $('dimPhoneVal').textContent = $('dimPhone').value + '%'; }
  function bindSettings() {
    $('bgGrid').addEventListener('click', (e) => { const b = e.target.closest('.bg-thumb'); if (!b) return; draft.photo = b.dataset.url; document.querySelectorAll('.bg-thumb').forEach((x) => x.classList.toggle('on', x === b)); apply(draft); });
    $('bgUseUrl').addEventListener('click', () => { const u = $('bgUrl').value.trim(); if (!/^https:\/\//i.test(u)) { toast('The link must start with https://', 'err'); return; } draft.photo = u; document.querySelectorAll('.bg-thumb').forEach((x) => x.classList.remove('on')); apply(draft); });
    ['dimDesk', 'dimPhone'].forEach((id) => $(id).addEventListener('input', () => { draft.dimDesktop = +$('dimDesk').value; draft.dimPhone = +$('dimPhone').value; labels(); apply(draft); }));
    $('bgDefault').addEventListener('click', () => { draft = { ...BG_DEFAULT }; renderSettings(); draft = { ...BG_DEFAULT }; apply(draft); });
    $('bgSave').addEventListener('click', async () => {
      if (!state.isSuper) return;
      try { await REF.background.set({ photo: draft.photo || '', dimDesktop: draft.dimDesktop, dimPhone: draft.dimPhone, by: state.user.email, at: TS }); cur = { ...draft }; lsSet(KEY, cur); toast('Background saved for everyone'); }
      catch (e) { toast('Could not save: ' + e.message, 'err', 6000); }
    });
  }
  return { applyCached, load, renderSettings, bindSettings };
})();

// =====================================================================
// SILENT UPDATES (version.json, same as Procurement Hub)
// =====================================================================
(function silentUpdates() {
  let lastCheck = 0, pending = false;
  const busyNow = () => document.querySelector('.modal.show') || ['INPUT', 'TEXTAREA'].includes((document.activeElement || {}).tagName);
  async function check() {
    if (Date.now() - lastCheck < 30 * 60e3 || !/^https?:$/.test(location.protocol)) return;
    lastCheck = Date.now();
    try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); const v = await r.json(); if (v.version && v.version !== APP_VERSION) pending = true; } catch (e) { /* offline */ }
    tryReload();
  }
  function tryReload() { if (pending && !busyNow()) location.reload(); }
  window.addEventListener('load', check);
  document.addEventListener('visibilitychange', () => { if (document.hidden) tryReload(); else check(); });
  document.addEventListener('hidden.bs.modal', tryReload);
})();

// For the teller (teller.js) — read-only helpers + form opening. Nothing here saves or deletes.
window.Finance = {
  classify, searchRecords, groupPOs, byPO: (po) => sortPVN(byPO(po)), isPaid, money, toNum, fmtDate, nextPVN,
  all: () => Store.all(), openPO: (po) => { showView('dashboard'); $('smartSearch').value = po; onSearchInput(); $('suggest').hidden = true; state.lastQuery = { mode: 'po', value: String(po) }; openPO(po); },
  runQuery: (mode, value) => { showView('dashboard'); $('smartSearch').value = mode === 'site' ? 'site ' + value : value; onSearchInput(); $('suggest').hidden = true; runSearch(mode, value); },
  showReport, openNewPayment: (po, p) => openNewPayment(po, { ...(p || {}), fromTeller: true }),
  user: () => state.user, isSuper: () => state.isSuper, version: APP_VERSION
};
