let currentVendorFilter = null;
let currentSearchTerm = "";
let lastSearchPO = "";

// --- GitHub Master Data Config ---
const PO_DATA_URL = "https://raw.githubusercontent.com/DC-database/Hub/main/POVALUE2.csv";
let masterPOCache = {}; // Will hold the data from GitHub: { "PO_NUMBER": {data...} }

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

// Show/hide admin section + login button state
auth.onAuthStateChanged(user => {
  document.getElementById('adminSection')?.classList.toggle('hidden', !user);
  const btn = document.getElementById('loginBtn');
  if (btn) {
    btn.textContent = user ? "Logout" : "Login";
    if (user) btn.classList.add("logout"); else btn.classList.remove("logout");
    btn.onclick = user ? logout : toggleLoginModal;
  }
  if (user) loadGitHubMasterData(); 
});

function login() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
}
function logout() { auth.signOut(); }

// ---------- CSV helpers ----------
function parseCSV(raw) {
  return raw.replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean).map(l=>l.split(",").map(v=>v.trim()));
}
function toNumberOrRaw(v){ const n=parseFloat(v); return isNaN(n)? v : n; }
function downloadCSV(name, headerLine){
  const blob=new Blob([headerLine+"\n"],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---------- GitHub Data Fetcher ----------
async function loadGitHubMasterData() {
  try {
    const response = await fetch(PO_DATA_URL);
    if (!response.ok) throw new Error("Failed to fetch GitHub CSV");
    const text = await response.text();
    const rows = parseCSV(text);
    
    masterPOCache = {};
    rows.slice(1).forEach(cols => {
      const poNum = cols[1]; 
      if (poNum) {
        masterPOCache[poNum] = {
          Site: cols[4] || "",       
          PO: cols[1] || "",         
          IDNo: cols[2] || "",       
          Vendor: cols[3] || "",     
          Value: toNumberOrRaw(cols[5]) 
        };
      }
    });
    console.log(`Loaded ${Object.keys(masterPOCache).length} POs from GitHub.`);
  } catch (err) {
    console.error("Error loading GitHub data:", err);
  }
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
  const tr=document.createElement('tr');
  tr.innerHTML =
    `<td><input type="checkbox" class="rowSelect" data-key="${childKey}" ${checked}></td>
     <td>${data.Site||""}</td>
     <td>${data.PO||""}</td>
     <td>${data.IDNo||""}</td>
     <td>${data.Vendor||""}</td>
     <td>${formatNumber(data.Value)}</td>
     <td><button onclick="showDeleteConfirm('${childKey}')">Delete</button></td>`;
  return tr;
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
function viewCollection(){
  const tbody=document.querySelector('#poTable tbody'); tbody.innerHTML='';
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
  db.ref('records').once('value', snap=>{
    const tbody=document.querySelector('#poTable tbody'); tbody.innerHTML='';
    snap.forEach(child=>{ const d=child.val(); if((d.Vendor||"").toUpperCase().startsWith(letter)) tbody.appendChild(renderRow(child.key,d)); });
    updateResultCount();
  });
}

function searchRecords(){
  const searchInput = document.getElementById('searchBox');
  currentSearchTerm=(searchInput.value||"").toLowerCase();
  lastSearchPO = searchInput.value || "";
  currentVendorFilter=null;

  db.ref('records').once('value', snapshot=>{
    const tbody=document.querySelector('#poTable tbody'); tbody.innerHTML='';
    snapshot.forEach(child=>{
      const d=child.val();
      if(
        (d.PO||"").toLowerCase().includes(currentSearchTerm) ||
        (d.Site||"").toLowerCase().includes(currentSearchTerm) ||
        (d.Vendor||"").toLowerCase().includes(currentSearchTerm) ||
        (d.IDNo||"").toLowerCase().includes(currentSearchTerm)
      ){
        tbody.appendChild(renderRow(child.key,d));
      }
    });
    updateResultCount();
  });
}

function clearSearch(){
  currentSearchTerm=""; currentVendorFilter=null;
  document.getElementById('searchBox').value='';
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

// ---------- Add PO (Uses GitHub Data Now) ----------
function openAddPOModal(){
  if (!auth.currentUser) { alert("Only admin can add PO"); return; }
  if (Object.keys(masterPOCache).length === 0) {
      loadGitHubMasterData().then(() => {
          document.getElementById('addPOStatus').textContent = "GitHub Data Ready.";
      });
  }
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
  if (!po) { if (stat) stat.textContent = "Please enter a PO number."; return; }

  const masterData = masterPOCache[po];
  if (!masterData) {
    if (stat) stat.textContent = `PO ${po} not found in GitHub list.`;
    return;
  }

  const recRef = db.ref('records');
  recRef.orderByChild("PO").equalTo(po).once('value').then(existsSnap => {
    if (existsSnap.exists()) { 
      if (stat) stat.textContent = `PO ${po} already exists in records.`; 
      return; 
    }
    const newRef = recRef.push();
    newRef.set(masterData).then(() => {
      const tbody = document.querySelector('#poTable tbody');
      if (tbody) { tbody.appendChild(renderRow(newRef.key, masterData)); updateResultCount(); }
      if (stat) stat.textContent = `Added PO ${po} ✔`;
      if (inp) { inp.value = ""; inp.focus(); }
    });
  }).catch(e => { if (stat) stat.textContent = "Error: " + e.message; });
}

// ---------- WhatsApp request ----------
function normalizeWhatsAppNumber(num){
  const digits=(num||"").replace(/\D/g,'');
  return digits.length===8 ? '974'+digits : digits; 
}

async function sendWhatsAppRequestAuto() {
  const po = (lastSearchPO || document.getElementById('searchBox').value || "").trim();
  if (!po) { alert("Please enter a PO number first."); return; }
  let vendor = masterPOCache[po] ? masterPOCache[po].Vendor : "";
  const target = normalizeWhatsAppNumber(WHATSAPP_REQUEST_NUMBER);
  const text = `Requesting original for the following:\nPO: ${po}\nVendor: ${vendor || '-'}`;
  window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, '_blank');
}

// ---------- Standard Uploads (Admin) ----------
function uploadCSV(){
  const file=document.getElementById('csvUpload').files[0];
  if(!file) return alert("Select a file");
  const reader=new FileReader();
  reader.onload=e=>{
    const rows=parseCSV(e.target.result);
    const body=rows.slice(1); const updates={};
    body.forEach(cols=>{
      const [Site,PO,IDNo,Vendor,Value]=cols;
      if(Site && PO){ const ref=db.ref('records').push(); updates[ref.key]={Site,PO,IDNo,Vendor,Value:toNumberOrRaw(Value)}; }
    });
    db.ref('records').update(updates).then(()=>alert("Upload complete")).catch(err=>alert(err.message));
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
    loadGitHubMasterData(); 

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
window.downloadMainTemplate=()=>downloadCSV("progress_po_template.csv","Site,PO,ID No,Vendor,Value");
window.addCheckedToCollection=addCheckedToCollection; window.viewCollection=viewCollection; window.clearCollection=clearCollection;
window.sendWhatsAppRequestAuto=sendWhatsAppRequestAuto;