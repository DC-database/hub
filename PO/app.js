// Add this at the top of app.js in the PO Site folder
function syncCollectionFromStorage() {
    try {
        const stored = localStorage.getItem('selectedPOs');
        if (stored) {
            // This updates the local variable 'selectedPOs' used by your PO site
            selectedPOs = JSON.parse(stored);
            // If your PO site has a 'renderCollection' function, call it here
            if (typeof renderCollection === 'function') renderCollection();
        }
    } catch (e) {
        console.error("Sync error", e);
    }
}

// Run the sync every time the PO site is opened
window.addEventListener('load', syncCollectionFromStorage);

let currentVendorFilter = null;
let currentSearchTerm = "";
let lastSearchPO = "";

// --- Record fields ---
// Firebase 'records' holds every PO. Status "Active" = original is in my custody,
// "Inactive" = released (kept in Firebase so it can be re-activated).
const CSV_HEADER = "ReqNum,PO,Supplier ID,Supplier Name,Project ID,Amount,Status";

// Normalizes a record, falling back to the old field names (Site, IDNo, Vendor, Value, DateAdded)
function rec(d){
  d = d || {};
  return {
    ReqNum: d.ReqNum ?? "",
    PO: d.PO ?? "",
    SupplierID: d.SupplierID ?? d.IDNo ?? "",
    SupplierName: d.SupplierName ?? d.Vendor ?? "",
    ProjectID: d.ProjectID ?? d.Site ?? "",
    Amount: d.Amount ?? d.Value ?? "",
    Status: d.Status === "Inactive" ? "Inactive" : "Active",
    DateFiled: d.DateFiled || d.DateAdded || "",
    DateReleased: d.DateReleased || ""
  };
}
// Old field names to clear whenever a record is rewritten with the new ones
const OLD_FIELDS = { Site: null, IDNo: null, Vendor: null, Value: null, DateAdded: null };

// "" = blank, "Active" / "Inactive", or null = not understood
function parseStatus(v){
  const s = String(v ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!s) return "";
  if (["active","a","yes","y","1","true"].includes(s)) return "Active";
  if (["inactive","in active","non active","nonactive","not active","released","release","no","n","0","false"].includes(s)) return "Inactive";
  return null;
}
function statusFilter(){ return document.getElementById('statusFilter')?.value || "Active"; }
function matchesStatus(d){ const f = statusFilter(); return f === "All" || rec(d).Status === f; }

// ---------- Local record cache (keeps Firebase downloads small) ----------
// Only Active records (a few hundred) are synced when the page opens. The full list
// (tens of thousands) is downloaded only when needed: Inactive/All view, upload, export.
// Both stay live after that, so Firebase only sends changes. Needs ".indexOn": ["Status","PO"] on records.
const recordCache = { active: null, all: null };
let activeReady = null, allReady = null;
function asSnap(map){ return { forEach(cb){ Object.keys(map || {}).forEach(k => cb({ key: k, val: () => map[k] })); } }; }
function toMap(snap){ const m = {}; snap.forEach(c => { m[c.key] = c.val(); }); return m; }
function syncActive(){
  if (!activeReady) activeReady = new Promise(res => {
    db.ref('records').orderByChild('Status').equalTo('Active').on('value', snap => {
      recordCache.active = toMap(snap); renderTotals(); res();
    });
  });
  return activeReady;
}
function syncAll(){
  if (!allReady) allReady = new Promise(res => {
    db.ref('records').on('value', snap => { recordCache.all = toMap(snap); renderTotals(); res(); });
  });
  return allReady;
}
// Resolves to a snapshot-like object for the given status filter
function getRecords(filter){
  if (filter === "Active" && !recordCache.all) return syncActive().then(() => asSnap(recordCache.active));
  return syncAll().then(() => asSnap(recordCache.all));
}
function renderTotals(){
  const totals = document.getElementById('statusTotals');
  if (!totals) return;
  const all = recordCache.all;
  const active = all ? Object.values(all).filter(d => rec(d).Status === "Active").length : Object.keys(recordCache.active || {}).length;
  const total = all ? Object.keys(all).length : null;
  totals.innerHTML =
    `<span class="status-badge status-active">Active: ${active.toLocaleString()}</span> ` +
    (all
      ? `<span class="status-badge status-inactive">Inactive: ${(total - active).toLocaleString()}</span> <span class="status-badge">Total: ${total.toLocaleString()}</span>`
      : `<span class="status-badge status-inactive" title="Choose Inactive or All to load every PO">Inactive / Total: choose All</span>`);
}
// One-time fix for records saved before Status existed: they are the POs in my custody, so mark them Active.
// With the Status index this only downloads records that have no Status yet (none after the first run).
function migrateMissingStatus(){
  return db.ref('records').orderByChild('Status').equalTo(null).once('value').then(snap => {
    const updates = {};
    snap.forEach(c => { updates[c.key + '/Status'] = "Active"; });
    const n = Object.keys(updates).length;
    if (n) return db.ref('records').update(updates).then(() => console.log(`Marked ${n} old records as Active.`));
  }).catch(err => console.error("Status migration failed:", err));
}

// cache & collection
const lastRenderedRows = {};
let selectedPOs = {};
try { selectedPOs = JSON.parse(localStorage.getItem('selectedPOs') || '{}'); } catch { selectedPOs = {}; }

// WhatsApp target
const WHATSAPP_REQUEST_NUMBER = "5099 2079";

// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyC7cfmocz3oPyERDIiJj5XIDeA3wc6rQZI",
  authDomain: "progress-po.firebaseapp.com",
  projectId: "progress-po",
  storageBucket: "progress-po.firebasestorage.app",
  messagingSenderId: "100311283897",
  appId: "1:100311283897:web:0dc641fd38df3f241f8368",
  measurementId: "G-YYE9BBQ9SE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ---------- Audio Helpers ----------
function playErrorSound() {
  // Replace 'error.mp3' with the actual name of your sound file
  const errorAudio = new Audio('error.mp3');
  
  // The catch block prevents the app from crashing if the browser blocks autoplay
  errorAudio.play().catch(err => console.log("Audio play prevented by browser:", err));
}

// Show/hide admin section + login button state
auth.onAuthStateChanged(user => {
  document.getElementById('adminSection')?.classList.toggle('hidden', !user);
  document.getElementById('deleteSelectedBtn')?.classList.toggle('hidden', !user); // This line toggles the new delete button
  
  const btn = document.getElementById('loginBtn');
  if (btn) {
    btn.textContent = user ? "Logout" : "Login";
    if (user) btn.classList.add("logout"); else btn.classList.remove("logout");
    btn.onclick = user ? logout : toggleLoginModal;
  }
  if (user) migrateMissingStatus();
  // Re-draw rows so the admin buttons appear/disappear
  document.querySelectorAll('#poTable tbody tr[data-key]').forEach(tr => {
    const key = tr.dataset.key;
    if (lastRenderedRows[key]) tr.replaceWith(renderRow(key, lastRenderedRows[key]));
  });
});

function login() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
}
function logout() { auth.signOut(); }

// ---------- CSV helpers ----------
// Splits CSV lines, honouring "quoted, values" (as saved by Excel)
function parseCSV(raw) {
  return raw.replace(/^\uFEFF/,"").replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
    const out=[]; let cur="", q=false;
    for (let i=0;i<l.length;i++){
      const c=l[i];
      if (q) { if (c==='"' && l[i+1]==='"') { cur+='"'; i++; } else if (c==='"') q=false; else cur+=c; }
      else if (c==='"') q=true;
      else if (c===',') { out.push(cur.trim()); cur=""; }
      else cur+=c;
    }
    out.push(cur.trim());
    return out;
  });
}
function csvCell(v){ v=String(v ?? ""); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function toNumberOrRaw(v){ const n=parseFloat(v); return isNaN(n)? v : n; }
function downloadCSV(name, headerLine){
  const blob=new Blob([headerLine+"\n"],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---------- UI helpers ----------
function formatNumber(val){ const num=parseFloat(val); if(isNaN(num)) return val??""; return num.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function generateAZFilter(){
  const c=document.getElementById("letterFilter"); 
  if(!c) return;
  c.innerHTML = "";
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter=>{
    const btn=document.createElement("button"); btn.textContent=letter; btn.onclick=()=>filterByVendorLetter(letter); c.appendChild(btn);
  });
}

function renderRow(childKey, data){
  lastRenderedRows[childKey]=data;
  const checked = selectedPOs[childKey] ? 'checked' : '';
  const r = rec(data);
  const isAdmin = !!auth.currentUser;
  const statusBtn = r.Status === "Active"
    ? `<button onclick="releaseRecord('${childKey}')">Release</button>`
    : `<button onclick="reactivateRecord('${childKey}')">Re-activate</button>`;

  const tr=document.createElement('tr');
  tr.dataset.key = childKey;
  if (r.Status === "Inactive") tr.classList.add('row-inactive');
  tr.innerHTML =
    `<td><input type="checkbox" class="rowSelect" data-key="${childKey}" ${checked}></td>
     <td>${r.ReqNum}</td>
     <td>${r.PO}</td>
     <td>${r.SupplierID}</td>
     <td>${r.SupplierName}</td>
     <td>${r.ProjectID}</td>
     <td>${formatNumber(r.Amount)}</td>
     <td><span class="status-badge status-${r.Status.toLowerCase()}">${r.Status}</span></td>
     <td>${r.DateFiled || "-"}</td>
     <td>${r.DateReleased || "-"}</td>
     <td>${isAdmin ? `<button onclick="openEditModal('${childKey}')">Edit</button> ` + statusBtn + ` <button class="btn-hard-delete" onclick="showDeleteConfirm('${childKey}')">Delete</button>` : ""}</td>`;
  return tr;
}

// Re-draws one row in place after its status changes
function refreshRow(key, data){
  const old = document.querySelector(`#poTable tbody tr[data-key="${key}"]`);
  if (!old) return;
  if (!matchesStatus(data)) { old.remove(); delete lastRenderedRows[key]; }
  else old.replaceWith(renderRow(key, data));
  if (selectedPOs[key]) { selectedPOs[key] = data; persistSelected(); }
  updateResultCount();
}

function updateResultCount(){
  const count=document.querySelectorAll('#poTable tbody tr').length;
  const el=document.getElementById('resultCount');
  if (el) el.textContent = count>0 ? `Total Results: ${count}` : '';
  const bar=document.getElementById('noResultsBar');
  if (bar) bar.classList.toggle('hidden', count!==0);
}

// ---- COLLECTION helpers ----
function persistSelected(){ localStorage.setItem('selectedPOs', JSON.stringify(selectedPOs)); updateSelectedCount(); }
function updateSelectedCount(){ const btn=document.getElementById('viewCollectionBtn'); if(btn) btn.textContent=`View (${Object.keys(selectedPOs).length})`; }
function addCheckedToCollection(){
  const checks=document.querySelectorAll('#poTable tbody input.rowSelect:checked');
  if(!checks.length){ alert("No rows selected."); return; }
  checks.forEach(chk=>{ const key=chk.getAttribute('data-key'); if(key && lastRenderedRows[key]) selectedPOs[key]=lastRenderedRows[key]; });
  persistSelected();
}
function viewCollection(skipReload){
  // When View is clicked by the user, refresh the page first,
  // then automatically show the saved collection after reload.
  if (!skipReload) {
    sessionStorage.setItem('showPOCollectionAfterReload', '1');
    window.location.reload();
    return;
  }

  const tbody=document.querySelector('#poTable tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  Object.keys(selectedPOs).forEach(key=>tbody.appendChild(renderRow(key, selectedPOs[key])));
  updateResultCount();
}
function clearCollection() {
  if (!confirm("Clear all items in the collection?")) return;
  selectedPOs = {}; persistSelected();
  document.querySelectorAll('#poTable tbody input.rowSelect').forEach(chk => chk.checked = false);
  const tbody = document.querySelector('#poTable tbody'); if (tbody) tbody.innerHTML = '';
  document.getElementById('noResultsBar')?.classList.add('hidden');
  updateResultCount();
}

// ---------- Search / Filter ----------
function filterByVendorLetter(letter){
  currentVendorFilter=letter; currentSearchTerm="";
  getRecords(statusFilter()).then(snap=>{
    const tbody=document.querySelector('#poTable tbody'); tbody.innerHTML='';
    snap.forEach(child=>{ const d=child.val(); if(matchesStatus(d) && String(rec(d).SupplierName).toUpperCase().startsWith(letter)) tbody.appendChild(renderRow(child.key,d)); });
    updateResultCount();
  });
}

function searchRecords(){
  const searchInput = document.getElementById('searchBox');
  currentSearchTerm=(searchInput.value||"").toLowerCase();
  lastSearchPO = searchInput.value || "";
  currentVendorFilter=null;

  // NEW: Get the calendar date and format it to match our database (DD-MMM-YYYY)
  const dateElement = document.getElementById('datePicker');
  let targetDate = "";
  
  if (dateElement && dateElement.value) {
    const d = new Date(dateElement.value);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const day = d.getDate().toString().padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    targetDate = `${day}-${month}-${year}`;
  }

  getRecords(statusFilter()).then(snapshot=>{
    const tbody=document.querySelector('#poTable tbody'); tbody.innerHTML='';
    let matchCount = 0; 

    snapshot.forEach(child=>{
      const d=child.val();
      
      const r=rec(d);
      if (!matchesStatus(d)) return;
      // If a date is selected on the calendar, ignore records filed on other dates
      if (targetDate !== "" && r.DateFiled !== targetDate) return;

      if([r.ReqNum, r.PO, r.SupplierID, r.SupplierName, r.ProjectID]
          .some(v => String(v).toLowerCase().includes(currentSearchTerm))
      ){
        tbody.appendChild(renderRow(child.key,d));
        matchCount++;
      }
    });

    if (matchCount === 0 && (currentSearchTerm !== "" || targetDate !== "")) {
      playErrorSound(); 
    }

    updateResultCount();
  });
}

function clearSearch(){
  currentSearchTerm=""; currentVendorFilter=null;
  document.getElementById('searchBox').value='';
  document.getElementById('datePicker').value=''; // <-- This clears the calendar
  document.querySelector('#poTable tbody').innerHTML='';
  updateResultCount();
}

// ---------- Delete flow ----------
let deleteKeyPending=null;
function showDeleteConfirm(key){ deleteKeyPending=key; document.getElementById("deleteConfirmModal").classList.remove("hidden"); }
function proceedDelete(){
  if(deleteKeyPending){ deleteRecord(deleteKeyPending); deleteKeyPending=null; }
  document.getElementById("deleteConfirmModal").classList.add("hidden");
}
function cancelDelete(){ deleteKeyPending=null; document.getElementById("deleteConfirmModal").classList.add("hidden"); }
function deleteRecord(key){
  if(!auth.currentUser){ alert("Only admin can delete"); return; }
  db.ref('records/' + key).remove().then(() => {
    if (selectedPOs[key]) { delete selectedPOs[key]; persistSelected(); }
    if (lastRenderedRows[key]) { delete lastRenderedRows[key]; }
    const rowCheckbox = document.querySelector(`#poTable tbody input.rowSelect[data-key="${key}"]`);
    const row = rowCheckbox ? rowCheckbox.closest('tr') : null;
    if (row) row.remove();
    updateResultCount();
  }).catch(err => alert(err.message));
}

// ---------- Release / Re-activate ----------
// Release = original left my custody: mark Inactive and stamp Date Released.
function releaseRecord(key){
  if(!auth.currentUser){ alert("Only admin can release"); return; }
  const changes = { Status: "Inactive", DateReleased: getFormattedDate() };
  db.ref('records/' + key).update(changes)
    .then(() => refreshRow(key, { ...lastRenderedRows[key], ...changes }))
    .catch(err => alert(err.message));
}
// Re-activate = original is back with me: mark Active, new Date Filed, clear Date Released.
function reactivateRecord(key){
  if(!auth.currentUser){ alert("Only admin can re-activate"); return; }
  const changes = { Status: "Active", DateFiled: getFormattedDate(), DateReleased: null, DateAdded: null };
  db.ref('records/' + key).update(changes)
    .then(() => refreshRow(key, { ...lastRenderedRows[key], ...changes }))
    .catch(err => alert(err.message));
}

// ---------- Edit record (Admin) ----------
const EDIT_FIELDS = ["ReqNum","PO","SupplierID","SupplierName","ProjectID","Amount"];
let editKeyPending = null;
function openEditModal(key){
  if(!auth.currentUser){ alert("Only admin can edit"); return; }
  const r = rec(lastRenderedRows[key]);
  editKeyPending = key;
  EDIT_FIELDS.forEach(f => { const el = document.getElementById('edit' + f); if (el) el.value = r[f] ?? ""; });
  document.getElementById('editModal')?.classList.remove('hidden');
}
function closeEditModal(){ editKeyPending = null; document.getElementById('editModal')?.classList.add('hidden'); }
function saveEdit(){
  if(!auth.currentUser || !editKeyPending){ return; }
  const key = editKeyPending;
  const fields = {};
  EDIT_FIELDS.forEach(f => { fields[f] = (document.getElementById('edit' + f)?.value || "").trim(); });
  if (!fields.PO) { alert("PO cannot be empty."); return; }
  fields.Amount = toNumberOrRaw(fields.Amount);
  const cur = rec(lastRenderedRows[key]);
  const next = { ...cur, ...fields, ...OLD_FIELDS, DateReleased: cur.DateReleased || null };
  db.ref('records/' + key).update(next)
    .then(() => { refreshRow(key, next); closeEditModal(); })
    .catch(err => alert(err.message));
}

// ---------- Mark PO Active (looks up Firebase records) ----------
function openAddPOModal(){
  if (!auth.currentUser) { alert("Only admin can add PO"); return; }
  document.getElementById('addPOModal')?.classList.remove('hidden');
  const inp = document.getElementById('addPOInput');
  if (document.getElementById('addPOStatus')) document.getElementById('addPOStatus').textContent = "";
  if (inp) { inp.value = ""; setTimeout(()=>inp.focus(), 50); }
}

function closeAddPOModal(){
  document.getElementById('addPOModal')?.classList.add('hidden');
}

function addPOFromModal(){
  if (!auth.currentUser) { alert("Only admin can add PO"); return; }
  const inp = document.getElementById('addPOInput');
  const stat = document.getElementById('addPOStatus');
  const po = (inp?.value || "").trim();
  
  if (!po) { 
    if (stat) stat.textContent = "Please enter a PO number."; 
    playErrorSound(); // <-- Trigger sound
    return; 
  }

  findRecordByPO(po).then(found => {
    if (!found) {
      if (stat) stat.textContent = `PO ${po} is not in the records. Upload it with the CSV first.`;
      playErrorSound(); // <-- Trigger sound
      return;
    }
    const [key, data] = found;
    if (rec(data).Status === "Active") {
      if (stat) stat.textContent = `PO ${po} is already Active.`;
      playErrorSound(); // <-- Trigger sound
      return;
    }
    const changes = { Status: "Active", DateFiled: getFormattedDate(), DateReleased: null, DateAdded: null };
    return db.ref('records/' + key).update(changes).then(() => {
      const updated = { ...data, ...changes };
      const tbody = document.querySelector('#poTable tbody');
      const shown = document.querySelector(`#poTable tbody tr[data-key="${key}"]`);
      if (shown) refreshRow(key, updated);
      else if (tbody) { tbody.appendChild(renderRow(key, updated)); updateResultCount(); }
      if (stat) stat.textContent = `PO ${po} marked Active ✔`;
      if (inp) { inp.value = ""; inp.focus(); }
    });
  }).catch(e => {
    if (stat) stat.textContent = "Error: " + e.message; 
    playErrorSound(); // <-- Trigger sound
  });
}


// ---------- WhatsApp request ----------
function normalizeWhatsAppNumber(num){
  const digits=(num||"").replace(/\D/g,'');
  return digits.length===8 ? '974'+digits : digits; 
}

async function sendWhatsAppRequestAuto() {
  const po = (lastSearchPO || document.getElementById('searchBox').value || "").trim();
  if (!po) { alert("Please enter a PO number first."); return; }
  const found = await findRecordByPO(po).catch(() => null);
  const vendor = found ? rec(found[1]).SupplierName : "";
  const target = normalizeWhatsAppNumber(WHATSAPP_REQUEST_NUMBER);
  const text = `Requesting original for the following:\nPO: ${po}\nVendor: ${vendor || '-'}`;
  window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, '_blank');
}

// Finds a record by PO number. Resolves to [key, data] or null.
function findRecordByPO(po){
  // Indexed query on PO, so only matching records are downloaded. PO may be saved as text or number.
  const q = v => db.ref('records').orderByChild('PO').equalTo(v).once('value').then(snap => {
    let found = null;
    snap.forEach(child => { if (!found) found = [child.key, child.val()]; });
    return found;
  });
  const trimmed = String(po).trim();
  return q(trimmed).then(f => f || (trimmed !== "" && !isNaN(trimmed) ? q(Number(trimmed)) : null));
}

// ---------- Standard Uploads (Admin) ----------
// Columns: ReqNum, PO, Supplier ID, Supplier Name, Project ID, Amount, Status
// Safety rules:
// - Header must match the template, otherwise nothing is uploaded.
// - Existing PO: details updated in place (no duplicate). Its status is NEVER changed by an upload;
//   blank cells keep the current value. Unchanged POs are not written at all.
// - New PO: saved with Date Filed = upload date. Status column (optional) applies only here; blank = Inactive.
// - Unknown Status words stop the upload.
// - A summary is shown for confirmation, and a backup CSV of all records is downloaded before saving.
// True when two records hold the same values (ignores blank/empty fields and old field names)
function sameRecord(a, b){
  const clean = o => { const r = {}; Object.keys(o || {}).sort().forEach(k => { const v = o[k]; if (v !== null && v !== undefined && v !== "") r[k] = String(v); }); return JSON.stringify(r); };
  return clean(a) === clean(b);
}
function poKey(v){ return String(v ?? "").replace(/\s+/g, "").toUpperCase(); }

function uploadCSV(){
  if(!auth.currentUser){ alert("Only admin can upload"); return; }
  const file=document.getElementById('csvUpload').files[0];
  if(!file) return alert("Select a file");
  const reader=new FileReader();
  
  reader.onload=e=>{
    const rows=parseCSV(e.target.result);
    if (!rows.length) { alert("The file is empty."); return; }

    // Status column is optional (only used for new POs)
    const expected = CSV_HEADER.split(",").map(h => h.toLowerCase().replace(/\s+/g, ""));
    const got = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ""));
    if (expected.slice(0, 6).some((h, i) => h !== got[i]) || (got[6] && got[6] !== expected[6])) {
      alert(`Upload stopped: the header row must be\n${CSV_HEADER}\n(Status is optional)\n\nYour file has\n${rows[0].join(",")}\n\nNothing was changed.`);
      return;
    }

    const body=rows.slice(1);
    const badStatus = [];
    body.forEach((cols, i) => { if (parseStatus(cols[6]) === null) badStatus.push(`row ${i + 2}: "${cols[6]}"`); });
    if (badStatus.length) {
      alert(`Upload stopped: Status must be Active, Inactive or blank.\n${badStatus.slice(0, 10).join("\n")}${badStatus.length > 10 ? `\n...and ${badStatus.length - 10} more` : ""}\n\nNothing was changed.`);
      return;
    }

    const uploadDate = getFormattedDate(); 

    getRecords("All").then(snap => {
      const byPO = {};
      const backup = [CSV_HEADER + ",Date Filed,Date Released"];
      snap.forEach(child => {
        const po = poKey(child.val().PO);
        if (po && !byPO[po]) byPO[po] = [child.key, child.val()];
        const r = rec(child.val());
        backup.push([r.ReqNum, r.PO, r.SupplierID, r.SupplierName, r.ProjectID, r.Amount, r.Status, r.DateFiled, r.DateReleased].map(csvCell).join(","));
      });

      let activeBefore = 0;
      snap.forEach(child => { if (rec(child.val()).Status === "Active") activeBefore++; });

      const updates = {};
      let added = 0, addedActive = 0, updated = 0, unchanged = 0, skipped = 0, keptActive = 0;

      body.forEach(cols=>{
        const [ReqNum="",PO="",SupplierID="",SupplierName="",ProjectID="",Amount="",StatusRaw=""]=cols;
        if(!PO){ skipped++; return; }
        const status = parseStatus(StatusRaw);
        const fields = { ReqNum, PO, SupplierID, SupplierName, ProjectID, Amount: Amount === "" ? "" : toNumberOrRaw(Amount) };
        const k = poKey(PO);

        if (byPO[k]) {
          const [key, data] = byPO[k];
          const cur = rec(data);
          const next = { ...cur, ...OLD_FIELDS, PO: cur.PO || PO };
          // Blank cells keep what is already saved
          ["ReqNum","SupplierID","SupplierName","ProjectID","Amount"].forEach(f => { if (fields[f] !== "") next[f] = fields[f]; });
          // Upload never changes the status of a PO that is already saved.
          // Status only changes with Release / Re-activate / Mark Active.
          if (cur.Status === "Active") keptActive++;
          if (!next.DateReleased) next.DateReleased = null;
          byPO[k] = [key, next];
          // Only write records that actually changed (re-uploading the same file writes nothing)
          if (sameRecord(data, next)) { unchanged++; return; }
          updates[key] = next;
          updated++;
        } else {
          const ref = db.ref('records').push();
          // Blank Status on a new PO = Inactive (full PO lists are mostly not in my custody)
          const next = { ...fields, Status: status || "Inactive", DateFiled: uploadDate };
          if (next.Status === "Active") addedActive++;
          updates[ref.key] = next;
          byPO[k] = [ref.key, next];
          added++;
        }
      });

      if (!added && !updated) {
        alert(unchanged ? `Nothing new: all ${unchanged} POs in the file are already saved with the same details. Nothing was changed.` : "No rows with a PO found. Nothing was changed.");
        return;
      }

      const summary =
        `Please check before saving:\n\n` +
        `Existing POs found: ${updated + unchanged} (${unchanged} unchanged, ${updated} to update)\n` +
        `  - staying Active: ${keptActive}\n` +
        `  - statuses are never changed by an upload\n` +
        `New POs: ${added} (${added - addedActive} Inactive, ${addedActive} Active)\n` +
        (skipped ? `Rows skipped (no PO): ${skipped}\n` : "") +
        `\nTotal Active: ${activeBefore} now -> ${activeBefore + addedActive} after upload\n` +
        `\nA backup of all current records will download first.\nSave these changes?`;
      if (!confirm(summary)) { alert("Upload cancelled. Nothing was changed."); return; }

      downloadCSV(`po_records_backup_before_upload_${uploadDate}.csv`, backup.join("\n"));
      return db.ref('records').update(updates)
        .then(()=>alert(`Upload complete: ${added} added, ${updated} updated.`));
    }).catch(err=>alert(err.message));
  };
  
  reader.readAsText(file);
}

// ---------- Login Modal ----------
function toggleLoginModal() {
  document.getElementById('loginModal').classList.toggle('hidden');
}
function popupLogin() {
  const email = document.getElementById('popupEmail').value;
  const pass = document.getElementById('popupPassword').value;
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => toggleLoginModal())
    .catch(err => alert(err.message));
}

// ---------- Menu Toggle ----------
function toggleMenu() {
  const menu = document.getElementById('sideMenu');
  if (menu) menu.classList.toggle('show');
}

// ---------- Initializers ----------
window.onload = () => { 
    generateAZFilter(); 
    updateSelectedCount();

    // If the View button triggered a refresh, show the collection after reload
    if (sessionStorage.getItem('showPOCollectionAfterReload') === '1') {
      sessionStorage.removeItem('showPOCollectionAfterReload');
      viewCollection(true);
    }

    loadAvailableDates();

    // Existing: Enter key for main search box
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchRecords();
      });
    }

    // --- FIX STARTS HERE ---
    // Fix: Enter key for Add PO modal input
    const addPOInput = document.getElementById('addPOInput');
    if (addPOInput) {
      addPOInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPOFromModal();
      });
    }
    // --- FIX ENDS HERE ---

    // Row Click Delegation
    const tbody = document.querySelector('#poTable tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        if (e.target.closest('input,button')) return;
        const tr = e.target.closest('tr');
        if (tr) {
          const chk = tr.querySelector('input.rowSelect');
          if (chk) { chk.checked = !chk.checked; }
        }
      });
    }
};

// ---------- Select All / Batch Delete ----------
function toggleSelectAll() {
  const isChecked = document.getElementById('selectAllCheckbox').checked;
  const checkboxes = document.querySelectorAll('#poTable tbody input.rowSelect');
  checkboxes.forEach(chk => {
    chk.checked = isChecked;
  });
}

// Releases the selected records (marks them Inactive). They stay in Firebase.
function deleteSelectedRecords() {
  if (!auth.currentUser) {
    alert("Only admin can release records.");
    return;
  }

  const checks = document.querySelectorAll('#poTable tbody input.rowSelect:checked');
  if (!checks.length) {
    alert("No records selected to release.");
    return;
  }

  if (!confirm(`Release these ${checks.length} records? They will be marked Inactive and can be re-activated later.`)) {
    return;
  }

  const today = getFormattedDate();
  const updates = {};
  const keys = [];
  checks.forEach(chk => {
    const key = chk.getAttribute('data-key');
    if (key && rec(lastRenderedRows[key]).Status === "Active") {
      updates[key + '/Status'] = "Inactive";
      updates[key + '/DateReleased'] = today;
      keys.push(key);
    }
  });
  if (!keys.length) { alert("The selected records are already Inactive."); return; }

  db.ref('records').update(updates).then(() => {
    keys.forEach(key => refreshRow(key, { ...lastRenderedRows[key], Status: "Inactive", DateReleased: today }));
    document.getElementById('selectAllCheckbox').checked = false;
  }).catch(err => alert("Error releasing records: " + err.message));
}

// ---------- Date Generator ----------
function getFormattedDate() {
  const d = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  let day = d.getDate().toString().padStart(2, '0');
  let month = months[d.getMonth()];
  let year = d.getFullYear();
  return `${day}-${month}-${year}`; // Outputs exactly like "24-MAR-2026"
}

// ---------- Date Dropdown Manager ----------
function loadAvailableDates() {
  // Starts the live Active sync and shows the totals (kept name for existing callers)
  syncActive();
}

function filterByDateSelection() {
  searchRecords(); // Triggers the search which respects the date dropdown
}

// ---------- Filter by Calendar Date ----------
function filterBySpecificDate() {
  const pickerVal = document.getElementById('datePicker').value; 
  if (!pickerVal) return; // Do nothing if date is cleared
  
  // Convert standard calendar output (YYYY-MM-DD) to our format (DD-MMM-YYYY)
  const d = new Date(pickerVal);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  const targetDate = `${day}-${month}-${year}`; // e.g., "24-MAR-2026"

  // Pull only records that match this exact date
  getRecords(statusFilter()).then(snapshot => {
    const tbody = document.querySelector('#poTable tbody'); 
    tbody.innerHTML = ''; // Clear the table first
    let matchCount = 0;

    snapshot.forEach(child => {
      const data = child.val();
      // If the record's Date Filed matches the calendar date, add it to the table
      if (matchesStatus(data) && rec(data).DateFiled === targetDate) {
        tbody.appendChild(renderRow(child.key, data));
        matchCount++;
      }
    });

    if (matchCount === 0) {
      playErrorSound(); // Play sound if nothing was added on that date
    }

    updateResultCount();
  });
}

// ============================================================
// AUTO-SEARCH & ADD TO COLLECTION (From Invoice Redirect)
// ============================================================
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const poToSearch = urlParams.get('search');
    const action = urlParams.get('action');

    if (poToSearch) {
        const searchInput = document.getElementById('searchBox');
        if (searchInput) {
            // 1. Fill the search box
            searchInput.value = poToSearch;
            
            // 2. Execute the Search
            if (typeof searchRecords === 'function') {
                searchRecords();
            }

            // 3. If action is autoAdd, wait for Firebase then Add to Collection
            if (action === 'autoAdd') {
                // We wait 2 seconds to ensure the table has rendered
                setTimeout(() => {
                    // Find the checkbox for this PO in the results table
                    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                    
                    if (checkboxes.length > 0) {
                        // Check all found results (usually just the one searched)
                        checkboxes.forEach(cb => cb.checked = true);
                        
                        // Execute the Add to Collection function
                        if (typeof addCheckedToCollection === 'function') {
                            addCheckedToCollection();
                            console.log(`PO ${poToSearch} automatically added to collection.`);
                            
                            // Optional: Alert the user it's ready
                            alert(`PO ${poToSearch} has been added to your collection for deletion.`);
                        }
                    } else {
                        console.warn("Search finished but no checkboxes found to add.");
                    }
                }, 2000); 
            }
        }
    }
});

// --- ADD THIS AT THE BOTTOM ---
// Listener for Cross-Tab Automation from Invoice Management
window.addEventListener('message', (event) => {
    // Security check: only allow messages from your own domain
    if (event.origin !== 'https://ibaport.site') return; 
    
    if (event.data && event.data.action === 'triggerDeleteBtn') {
        const btn = document.getElementById('deleteselectedbtn');
        if (btn) {
            console.log("Remote trigger: Clicking Delete Button");
            btn.click();
        } else {
            console.warn("Remote trigger failed: Button 'deleteselectedbtn' not found.");
        }
    }
});

// Ensure the function is available globally
window.filterBySpecificDate = filterBySpecificDate;

// Make sure filterByDateSelection is accessible globally
window.filterByDateSelection = filterByDateSelection;

// Global Expose
window.login=login; window.logout=logout;
window.toggleLoginModal=toggleLoginModal; window.popupLogin=popupLogin;
window.toggleMenu=toggleMenu;
window.showTab=(id)=>{
  document.querySelectorAll('.tabContent').forEach(t=>t.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('sideMenu').classList.remove('show');
};
window.searchRecords=searchRecords; window.clearSearch=clearSearch;
window.showDeleteConfirm=showDeleteConfirm; window.proceedDelete=proceedDelete; window.cancelDelete=cancelDelete;
window.openAddPOModal=openAddPOModal; window.closeAddPOModal=closeAddPOModal; window.addPOFromModal=addPOFromModal;
window.uploadCSV=uploadCSV; 
window.downloadMainTemplate=()=>downloadCSV("progress_po_template.csv",CSV_HEADER);

// Exports every record (all statuses). The first 7 columns match the upload, so the file can be edited and re-uploaded.
function exportRecordsCSV(){
  getRecords("All").then(snap => {
    const lines = [CSV_HEADER + ",Date Filed,Date Released"];
    snap.forEach(child => {
      const r = rec(child.val());
      lines.push([r.ReqNum, r.PO, r.SupplierID, r.SupplierName, r.ProjectID, r.Amount, r.Status, r.DateFiled, r.DateReleased].map(csvCell).join(","));
    });
    downloadCSV(`po_records_${getFormattedDate()}.csv`, lines.join("\n"));
  }).catch(err => alert(err.message));
}
window.exportRecordsCSV=exportRecordsCSV;
window.releaseRecord=releaseRecord; window.reactivateRecord=reactivateRecord;
window.openEditModal=openEditModal; window.closeEditModal=closeEditModal; window.saveEdit=saveEdit;
window.addCheckedToCollection=addCheckedToCollection; window.viewCollection=viewCollection; window.clearCollection=clearCollection;
window.sendWhatsAppRequestAuto=sendWhatsAppRequestAuto;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelectedRecords = deleteSelectedRecords;
