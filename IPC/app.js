const firebaseConfig = {
  apiKey: "AIzaSyC7cfmocz3oPyERDIiJj5XIDeA3wc6rQZI",
  authDomain: "progress-po.firebaseapp.com",
  databaseURL: "https://progress-po-default-rtdb.firebaseio.com",
  projectId: "progress-po",
  storageBucket: "progress-po.appspot.com",
  messagingSenderId: "100311283897",
  appId: "1:100311283897:web:0dc641fd38df3f241f8368",
  measurementId: "G-YYE9BBQ9SE"
};
// Utility to manage the 'Add IPC Entry' label dynamically
function hideAddIPCLabel() {
  const lab = document.getElementById('addIPCLabel');
  if (lab) lab.remove();
}
function showAddIPCLabel() {
  hideAddIPCLabel();
  const poInputEl = document.getElementById('poInput');
  if (!poInputEl) return;
  const label = document.createElement('span');
  label.id = 'addIPCLabel';
  label.innerHTML = '<strong>Add IPC Entry</strong>';
  label.style.marginLeft = '12px';
  poInputEl.insertAdjacentElement('afterend', label);
}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// === QAR helpers (minimal) ===
function parseQAR(value) {
  const n = parseFloat(String(value ?? '').toString().replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}
function formatQAR(n) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  return 'QAR ' + Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// === end helpers ===

const ADMIN_EMAIL = 'dc@iba.com.qa';
let currentUserData = null;
let currentPO = "";
let currentEditingUserId = null;

function showSection(id) {
  document.querySelectorAll("section").forEach(s => s.style.display = "none");

  if (id === 'welcomeBox') {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('welcomeBox').style.display = 'block';
  } else {
    document.getElementById(id).style.display = "block";
  }

  if (id === 'settingsSection') {
    updateSettingsUI();
  }
  if (id === 'activeIPCSection') {
    loadActivePOs();
  }
}

function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  alert(`Operation failed: ${error.message}`);
  return null;
}

function showMessage(message, color, elementId = 'passwordChangeMessage') {
  const messageElement = document.getElementById(elementId);
  messageElement.textContent = message;
  messageElement.style.display = 'block';
  messageElement.style.color = color;
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}

async function loginUser() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) return alert("Please enter both email and password.");

  if (email === ADMIN_EMAIL) {
    try {
      const userCred = await auth.signInWithEmailAndPassword(email, password);
      const user = userCred.user;
      const snapshot = await db.ref('users/' + user.uid).once('value');

      const userData = snapshot.val() || {
        uid: user.uid,
        name: user.email.split('@')[0],
        email: user.email,
        role: 'admin'
      };

      currentUserData = userData;
      showAdminUI(userData);
    } catch (err) {
      console.error("Admin login error:", err);
      alert("Admin login failed.");
    }
  } else {
    try {
      const usersSnap = await db.ref('users').once('value');
      let found = false;

      usersSnap.forEach(child => {
        const user = child.val();
        if (user.email === email && user.password === password) {
          found = true;
          const userData = {
            uid: child.key,
            name: user.name,
            email: user.email,
            role: user.role || 'user'
          };
          currentUserData = userData;
          showUserUI(userData);
        }
      });

      if (!found) {
        alert("Login failed. User not found or incorrect password.");
      }
    } catch (err) {
      console.error("Regular login error:", err);
      alert("Login failed. Please try again.");
    }
  }
}

function showAdminUI(userData) {
  currentUserData = userData;
  document.getElementById('welcomeMsg').textContent = `Welcome ${userData.name} (Admin)`;
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('welcomeBox').style.display = 'block';
  document.getElementById('settingsMenu').style.display = 'block';
  document.getElementById('ipcMenu').style.display = 'block';
  document.getElementById('activeIPCMenu').style.display = 'block';
  document.getElementById('logoutButton').style.display = 'block';
  document.getElementById('authButton').style.display = 'none';
  document.getElementById('userDisplay').textContent = `👤 ${userData.name} (Admin)`;
  document.getElementById('userDisplay').style.display = 'block';
  startIPC();
}

function showUserUI(userData) {
  currentUserData = userData;
  document.getElementById('welcomeMsg').textContent = `Welcome ${userData.name}`;
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('welcomeBox').style.display = 'block';
  document.getElementById('settingsMenu').style.display = 'block';
  document.getElementById('ipcMenu').style.display = 'block';
  document.getElementById('activeIPCMenu').style.display = 'block';
  document.getElementById('logoutButton').style.display = 'block';
  document.getElementById('authButton').style.display = 'none';
  document.getElementById('userDisplay').textContent = `👤 ${userData.name}`;
  document.getElementById('userDisplay').style.display = 'block';
  startIPC();
}

function updateSettingsUI() {
  const userData = currentUserData;
  if (!userData) return;

  document.getElementById("userInfoSection").style.display = "block";
  document.getElementById('userInfoName').textContent = userData.name;
  document.getElementById('userInfoEmail').textContent = userData.email;

  if (userData.role === 'admin') {
    document.getElementById("settingsTitle").innerText = "Admin Settings";
    document.getElementById("changePasswordSection").style.display = "none";
    document.getElementById("userManagementSection").style.display = "block";
    loadUsersList();
  } else {
    document.getElementById("settingsTitle").innerText = "User Settings";
    document.getElementById("changePasswordSection").style.display = "block";
    document.getElementById("userManagementSection").style.display = "none";
  }
}

function loadUsersList() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';
    

  db.ref('users').once('value', snapshot => {
    snapshot.forEach(child => {
      const user = child.val();
      const key = child.key;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td class="actions">
          <button onclick="populateUserForm('${key}', '${user.name}', '${user.email}', '${user.role}', '${user.password}')">Edit</button>
          <button class="delete-btn" onclick="deleteUser('${key}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function populateUserForm(key, name, email, role, password) {
  currentEditingUserId = key;
  document.getElementById('newName').value = name;
  document.getElementById('newEmail').value = email;
  document.getElementById('userRole').value = role;
  document.getElementById('tempPassword').value = password;

  document.getElementById('addNewUserBtn').style.display = 'none';
  document.getElementById('updateUserBtn').style.display = 'inline-block';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
}

function cancelEdit() {
  currentEditingUserId = null;
  document.getElementById('newName').value = '';
  document.getElementById('newEmail').value = '';
  document.getElementById('userRole').value = 'user';
  document.getElementById('tempPassword').value = '';

  document.getElementById('addNewUserBtn').style.display = 'inline-block';
  document.getElementById('updateUserBtn').style.display = 'none';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

function deleteUser(key) {
  if (confirm("Are you sure you want to delete this user?")) {
    db.ref('users/' + key).remove()
      .then(() => {
        loadUsersList();
        alert("User deleted.");
      })
      .catch(err => handleError(err, 'deleteUser'));
  }
}

function updateUser() {
  if (!currentEditingUserId) return alert("No user selected for update.");

  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const password = document.getElementById('tempPassword').value;

  if (!name || !email || !password) return alert("All fields are required.");

  db.ref('users/' + currentEditingUserId).update({ name, email, role, password })
    .then(() => {
      loadUsersList();
      cancelEdit();
      alert("User updated successfully.");
    })
    .catch(err => handleError(err, 'updateUser'));
}

function addNewUser() {
  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const password = document.getElementById('tempPassword').value;

  if (!name || !email || !password) return alert("All fields are required.");

  const newRef = db.ref('users').push();
  newRef.set({ name, email, role, password })
    .then(() => {
      loadUsersList();
      cancelEdit();
      alert("User added successfully.");
    })
    .catch(err => handleError(err, 'addNewUser'));
}

function changePassword() {
  const current = document.getElementById("currentPassword").value.trim();
  const newPass = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();

  if (!current || !newPass || !confirm) {
    showMessage("All fields are required.", "red");
    return;
  }

  if (newPass !== confirm) {
    showMessage("New passwords do not match.", "red");
    return;
  }

  if (!currentUserData) {
    showMessage("No user data found.", "red");
    return;
  }

  if (currentUserData.role === 'admin') {
    showMessage("Admins must change password through Firebase.", "red");
    return;
  }

  db.ref(`users/${currentUserData.uid}`).once('value', snapshot => {
    const user = snapshot.val();
    if (!user || user.password !== current) {
      showMessage("Current password is incorrect.", "red");
      return;
    }

    db.ref(`users/${currentUserData.uid}`).update({ password: newPass })
      .then(() => {
        showMessage("Password updated successfully.", "green");
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
      })
      .catch(err => handleError(err, "changePassword"));
  });
}

function logout() {
  auth.signOut().catch(err => console.error("Logout failed:", err));
  location.reload();
}

/* ===== IPC Management ===== */
let ensurePOInfoOpenRan = false;
function ensurePOInfoOpen() {
  const wrap = document.getElementById('poInfoWrap');
  const icon = document.getElementById('poInfoIcon');
  const row  = document.querySelector('.toggle-row');
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.style.maxHeight = '';
  wrap.style.opacity = '1';
  if (icon) icon.textContent = '−';
  if (row) row.setAttribute('aria-expanded', 'true');
}

// Toggle for PO info card
function togglePOInfo() {
  const wrap = document.getElementById('poInfoWrap');
  const icon = document.getElementById('poInfoIcon');
  if (!wrap) return;
  const isOpen = wrap.style.display !== 'none';
  if (isOpen) {
    wrap.style.display = 'none';
    if (icon) icon.textContent = '+';
  } else {
    wrap.style.display = 'block';
    if (icon) icon.textContent = '−';
  }
}

async function fetchPO() {
  const oldLabel = document.getElementById('addIPCLabel');
  if (oldLabel) oldLabel.remove();
  const po = document.getElementById('poInput').value.trim();
  if (!po) return alert('Enter PO number');
  currentPO = po;

  try {
    const snapshot = await db.ref('IPC/' + po).once('value');

    if (snapshot.exists()) {
      const firstEntry = snapshot.val();
      document.getElementById("poDetails").style.display = "block";
      document.getElementById("site").value = firstEntry.Site || "";
      document.getElementById("idNo").value = firstEntry.IDNo || "";
      document.getElementById("vendor").value = firstEntry.Vendor || "";
      document.getElementById("value").value = firstEntry.Value || "";
      document.getElementById("ipcEntrySection").style.display = "block";
      wireRetentionCalcListeners();
      computeRetentionFromInputs();
      showIPCRightColumn();
      document.getElementById("infoSite").textContent = document.getElementById("site").value;
      document.getElementById("infoIdNo").textContent = document.getElementById("idNo").value;
      document.getElementById("infoVendor").textContent = document.getElementById("vendor").value;
      document.getElementById("infoValue").textContent = document.getElementById("value").value;
      document.getElementById("poInfoDisplay").style.display = "block";

      ensurePOInfoOpen();
      loadIPCEntries(po);
    } else {
      const masterSnap = await db.ref('master-po/' + po).once('value');
      if (masterSnap.exists()) {
        const data = masterSnap.val();
        document.getElementById("site").value = data.Site || "";
        document.getElementById("idNo").value = data.IDNo || "";
        document.getElementById("vendor").value = data.Vendor || "";
        document.getElementById("value").value = data.Value || "";
        document.getElementById("poDetails").style.display = "block";

        document.getElementById("ipcEntrySection").style.display = "block";
        wireRetentionCalcListeners();
        computeRetentionFromInputs();
        showIPCRightColumn();

        document.getElementById("infoSite").textContent = document.getElementById("site").value;
        document.getElementById("infoIdNo").textContent = document.getElementById("idNo").value;
        document.getElementById("infoVendor").textContent = document.getElementById("vendor").value;
        document.getElementById("infoValue").textContent = document.getElementById("value").value;
        document.getElementById("poInfoDisplay").style.display = "block";

        ensurePOInfoOpen();
        loadIPCEntries(po);
      } else {
        alert('PO not found in master database');
      }
    }
  } catch (err) {
    handleError(err, "fetchPO");
  }
}

async function addIPC() {
  if (!currentPO) return alert('No PO selected');

  try {
    const site = document.getElementById('site').value || '';
    const idNo = document.getElementById('idNo').value || '';
    const vendor = document.getElementById('vendor').value || '';
    const value = document.getElementById('value').value || '';

    const rootRef = db.ref('IPC/' + currentPO);

    // Ensure metadata exists
    await rootRef.update({
      Site: site,
      IDNo: idNo,
      Vendor: vendor,
      Value: value
    });

    const ipcRef = rootRef.child('entries');
    const snapshot = await ipcRef.once('value');

    const count = snapshot.numChildren() + 1;
    const ipcNo = "IPC " + String(count).padStart(2, '0');
    const entry = {
      CertifiedAmount: document.getElementById('certifiedAmount').value || '0',
      PreviousPayment: document.getElementById('previousPayment').value || '0',
      Retention: document.getElementById('retention').value || '0',
      AmountToPaid: (parseQAR(document.getElementById('amountToPaid')?.value)||0).toFixed(2),
      Comments: ''
    };

    await ipcRef.child(ipcNo).set(entry);
    loadIPCEntries(currentPO);

    document.getElementById('certifiedAmount').value = '';
    document.getElementById('previousPayment').value = '';
    document.getElementById('retention').value = '';
    document.getElementById('amountToPaid').value = '';
  } catch (err) {
    handleError(err, "addIPC");
  }
}

async function loadIPCEntries(po) {
  try {
    const tbody = document.getElementById('ipcTableBody');
    tbody.innerHTML = '';
    let __mgrTotalATP = 0;
    if (!po) po = currentPO;
    const snapshot = await db.ref('IPC/' + po + '/entries').once('value');
    if (!snapshot.exists()) {
      tbody.innerHTML = '<tr><td colspan="9">No IPC entries found for this PO</td></tr>';
      return;
    }

    snapshot.forEach(child => {
      const ipcNo = child.key;
      const data = child.val();
      __mgrTotalATP += parseQAR(data && data.AmountToPaid != null ? data.AmountToPaid : 0);
      
      const remarks = (data.Remarks || '').toLowerCase();
      const comments = data.Comments || ''; // Get comments

      const isUnderDone = remarks === 'under process' || remarks === 'ipc completed';
      const isReadyDone = remarks === 'ipc completed';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${ipcNo}</td>
        <td>${data.CertifiedAmount || '0'}</td>
        <td>${data.PreviousPayment || '0'}</td>
        <td>${data.Retention || '0'}</td>
        <td>${formatQAR(data.AmountToPaid) || 'QAR 0.00'}</td>
        <td>${data.Date || ""}</td>
        <td>${data.Remarks || ""}</td>
        <td class="comment-cell">
          <span>${comments}</span>
          <button class="edit-comment-btn" onclick="editComment('${ipcNo}')">
            ${comments ? 'Edit' : 'Add'}
          </button>
        </td>
        <td>
          <div class="ipc-action-buttons">
            <button class="delete-btn" onclick="deleteIPC('${ipcNo}')">Delete</button>
            <button
              class="under-btn ${isUnderDone ? 'done' : ''}"
              onclick="markUnderProcess('${ipcNo}')"
              ${isUnderDone ? 'disabled' : ''}>
              Under Process
            </button>
            <button
              class="ready-btn ${isReadyDone ? 'done' : ''}"
              onclick="markIPCReady('${ipcNo}')"
              ${(!isUnderDone || isReadyDone) ? 'disabled' : ''}>
              IPC Ready
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    const totalTr = document.createElement('tr');
    totalTr.className = 'entries-total-row';
    totalTr.innerHTML = `
      <td style="font-weight:600">TOTAL</td>
      <td></td>
      <td></td>
      <td></td>
      <td style="font-weight:700">${formatQAR(__mgrTotalATP)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td> 
    `;
    tbody.appendChild(totalTr);
  } catch (err) {
    handleError(err, "loadIPCEntries");
  }
}

async function editComment(ipcNo) {
  if (!currentPO || !ipcNo) return;

  try {
    // Get the current comment to pre-fill the prompt
    const snap = await db.ref(`IPC/${currentPO}/entries/${ipcNo}/Comments`).once('value');
    const currentComment = snap.val() || '';

    const newComment = prompt("Enter comment for " + ipcNo + ":", currentComment);

    // If the user clicks "Cancel", the prompt returns null
    if (newComment === null) {
      return; 
    }

    // Update the comment in Firebase
    await db.ref(`IPC/${currentPO}/entries/${ipcNo}`).update({
      Comments: newComment.trim()
    });

    // Refresh the IPC list to show the new comment
    loadIPCEntries(currentPO);

  } catch (err) {
    handleError(err, 'editComment');
  }
}

async function deleteIPC(ipcNo) {
  if (!currentPO || !ipcNo) return;
  try {
    // Only allow deleting the most recent IPC for the current PO
    const snap = await db.ref('IPC/' + currentPO + '/entries').once('value');
    if (!snap.exists()) return;
    const entries = snap.val() || {};
    const keys = Object.keys(entries).sort((a,b) => {
      const an = parseInt(String(a).replace('IPC ', '')) || 0;
      const bn = parseInt(String(b).replace('IPC ', '')) || 0;
      return an - bn;
    });
    const lastKey = keys[keys.length - 1];
    if (ipcNo !== lastKey) {
      alert('You can only delete the most recent IPC (' + lastKey + '). Delete newer entries first.');
      return;
    }
    if (!confirm('Are you sure you want to delete ' + ipcNo + '?')) return;
    await db.ref('IPC/' + currentPO + '/entries/' + ipcNo).remove();
    loadIPCEntries(currentPO);
  } catch (err) {
    handleError(err, 'deleteIPC');
  }
}


// Auto-fill Previous Payment
document.addEventListener('DOMContentLoaded', () => {
  const ca = document.getElementById('certifiedAmount');
  if (ca) {
    ca.addEventListener('input', async () => {
      const po = currentPO;
      if (!po || document.getElementById('certifiedAmount').value.trim() === "") return;

      const ipcEntriesSnap = await db.ref('IPC/' + po + '/entries').once('value');
      if (ipcEntriesSnap.exists()) {
        const entries = ipcEntriesSnap.val();
        const sortedKeys = Object.keys(entries).sort((a, b) => {
          const aNum = parseInt(a.replace("IPC ", ""));
          const bNum = parseInt(b.replace("IPC ", ""));
          return aNum - bNum;
        });
        const lastKey = sortedKeys[sortedKeys.length - 1];
        const lastEntry = entries[lastKey];
        const lastPaid = parseFloat(lastEntry.AmountToPaid) || 0;
        document.getElementById('previousPayment').value = lastPaid.toFixed(2);
      } else {
        document.getElementById('previousPayment').value = '0.00';
      }
    });
    ca.addEventListener('input', calculateAmountToPaid);
  }
  const r = document.getElementById('retention');
  if (r) r.addEventListener('input', calculateAmountToPaid);
});

function calculateAmountToPaid() {
  try {
    var atp = document.getElementById('amountToPaid');
    if (atp && atp.dataset && atp.dataset.manual === '1') return; // manual mode: don't overwrite
  } catch(e) {}
  const certified = parseFloat(document.getElementById('certifiedAmount').value) || 0;
  const retention = parseFloat(document.getElementById('retention').value) || 0;
  const toPaid = certified - retention;
  document.getElementById('amountToPaid').value = toPaid.toFixed(2);
}

function clearIPCFields() {
  const rp=document.getElementById('retentionPercent'); if (rp) rp.value='';
  const rb=document.getElementById('retentionBase'); if (rb) rb.value='';
  const r=document.getElementById('retention'); if (r){ r.readOnly=false; r.classList.remove('computed'); }
  document.getElementById('certifiedAmount').value = '';
  document.getElementById('previousPayment').value = '';
  document.getElementById('retention').value = '';
  document.getElementById('amountToPaid').value = '';
}

/* ===== Mobile helpers ===== */
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const isOpen = sb.classList.contains('open');
  if (isOpen) {
    sb.classList.remove('open');
    ov.classList.remove('show');
  } else {
    sb.classList.add('open');
    ov.classList.add('show');
  }
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
function navigateFromSidebar(sectionId) {
  showSection(sectionId);
  closeSidebar();
}

/* ===== Active IPC page ===== */
let activePOs = []; // cached list

async function loadActivePOs() {
  try {
    const snap = await db.ref('IPC').once('value');
    activePOs = [];
    if (snap.exists()) {
      const data = snap.val();
      Object.keys(data).forEach(po => {
        const meta = data[po] || {};
        activePOs.push({
          po,
          Site: meta.Site || '',
          IDNo: meta.IDNo || '',
          Vendor: meta.Vendor || '',
          Value: meta.Value || '',
          entries: meta.entries || null
        });
      });
    }
    renderActivePOs(activePOs);
  } catch (err) {
    handleError(err, "loadActivePOs");
  }
}

function renderActivePOs(list) {
  const tbody = document.getElementById('activePOTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6">No active POs found</td></tr>';
    return;
  }

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <button class="mini-toggle" onclick="togglePOEntries('${item.po}', this)">+</button>
      </td>
      <td class="po-cell">${item.po}</td>
      <td>${item.Site}</td>
      <td>${item.IDNo}</td>
      <td>${item.Vendor}</td>
      <td>${item.Value ? formatQAR(item.Value) : 'QAR 0.00'}</td>
    `;
    tbody.appendChild(tr);

    // hidden row for entries
    const trDetails = document.createElement('tr');
    trDetails.className = 'details-row';
    trDetails.id = `details-${item.po}`;
    trDetails.style.display = 'none';
    trDetails.innerHTML = `
      <td colspan="6">
        <div class="entries-wrap">
          <div class="entries-title">IPC Entries for PO ${item.po}</div>
          <div class="entries-table-container">
            <table class="active-ipc-table" class="inner-table">
              <thead>
                <tr>
                  <th>IPC No</th>
                  <th>Amount To Paid</th>
                  <th>Date</th>
                  <th>Remarks</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody id="entries-body-${item.po}">
                <tr><td colspan="5" class="muted">Click + to load entries…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(trDetails);
  });
}

async function togglePOEntries(po, btn) {
  const row = document.getElementById(`details-${po}`);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    btn.textContent = '+';
    return;
  }
  // open
  row.style.display = 'table-row';
  btn.textContent = '−';

  const body = document.getElementById(`entries-body-${po}`);
  body.innerHTML = '<tr><td colspan="5" class="muted">Loading…</td></tr>';

  try {
    const snap = await db.ref(`IPC/${po}/entries`).once('value');
    if (!snap.exists()) {
      body.innerHTML = '<tr><td colspan="5" class="muted">No entries for this PO</td></tr>';
      return;
    }
    const entries = snap.val();
    const keys = Object.keys(entries).sort((a,b) => {
      const an = parseInt(a.replace('IPC ','')); const bn = parseInt(b.replace('IPC ',''));
      return an - bn;
    });
    body.innerHTML = '';
    let __totalAmountToPaid = 0;
    keys.forEach(k => {
      const e = entries[k];
      __totalAmountToPaid += parseQAR(e && e.AmountToPaid != null ? e.AmountToPaid : 0);
      const amount = (e && e.AmountToPaid != null) ? formatQAR(e.AmountToPaid) : 'QAR 0.00';
      const date   = (e && e.Date) ? e.Date : '—';
      const remarks= (e && e.Remarks) ? e.Remarks : '—';
      const comments = (e && e.Comments) ? e.Comments : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${k}</td>
        <td>${amount}</td>
        <td>${date}</td>
        <td>${remarks}</td>
        <td>${comments}</td>
      `;
      body.appendChild(tr);
    });

    // Append TOTAL row for Amount To Paid
    const totalRow = document.createElement('tr');
    totalRow.className = 'entries-total-row';
    totalRow.innerHTML = `
      <td style="font-weight:600">TOTAL</td>
      <td style="font-weight:700">${formatQAR(__totalAmountToPaid)}</td>
      <td></td>
      <td></td>
      <td></td>
    `;
    body.appendChild(totalRow);
  } catch (err) {
    handleError(err, "togglePOEntries");
  }
}

function filterActivePOs() {
  const q = (document.getElementById('activePOSearch').value || '').trim().toLowerCase();
  if (!q) return renderActivePOs(activePOs);
  const f = activePOs.filter(x =>
    x.po.toLowerCase().includes(q) ||
    (x.Site || '').toLowerCase().includes(q) ||
    (x.IDNo || '').toLowerCase().includes(q) ||
    (x.Vendor || '').toLowerCase().includes(q)
  );
  renderActivePOs(f);
}

function showIPCRightColumn() {
  const rc = document.querySelector('.ipc-right-column');
  if (rc) rc.style.display = 'block';
}
function hideIPCRightColumn() {
  const rc = document.querySelector('.ipc-right-column');
  if (rc) rc.style.display = 'none';
}

// --- Retention calculator (wired if needed) ---
function computeRetentionFromInputs() {
  const p = parseFloat(document.getElementById('retentionPercent')?.value);
  const baseStr = document.getElementById('retentionBase')?.value;
  const base = parseFloat(baseStr);
  const retentionEl = document.getElementById('retention');
  if (!retentionEl) return;

  if (!isNaN(p) && !isNaN(base)) {
    const val = (p / 100) * base;
    retentionEl.value = val.toFixed(2);
    retentionEl.readOnly = true;
    retentionEl.classList.add('computed');
    if (typeof calculateAmountToPaid === 'function') { calculateAmountToPaid(); }
  } else {
    // allow manual typing
    retentionEl.readOnly = false;
    retentionEl.classList.remove('computed');
  }
}

function wireRetentionCalcListeners() {
  const ids = ['retentionPercent','retentionBase'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._wired) {
      el.addEventListener('input', computeRetentionFromInputs);
      el._wired = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const atp = document.getElementById('amountToPaid');
  if (atp) {
    atp.addEventListener('focus', () => {
      const n = parseQAR(atp.value);
      atp.value = n ? String(n) : '';
    });
    atp.addEventListener('blur', () => {
      const n = parseQAR(atp.value);
      atp.value = n ? formatQAR(n) : '';
    });
  }
});

async function markUnderProcess(ipcNo) {
  if (!currentPO || !ipcNo) return;

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // yyyy-mm-dd

  try {
    await db.ref(`IPC/${currentPO}/entries/${ipcNo}`).update({
      Date: dateStr,
      Remarks: "Under Process"
    });

    // Instant visual feedback
    const btn = document.querySelector(`button[onclick="markUnderProcess('${ipcNo}')"]`);
    if (btn) { btn.classList.add('done'); btn.disabled = true; }

    loadIPCEntries(currentPO);
  } catch (err) {
    handleError(err, "markUnderProcess");
  }
}

async function markIPCReady(ipcNo) {
  if (!currentPO || !ipcNo) return;

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // yyyy-mm-dd

  try {
    // Require 'Under Process' before allowing 'IPC Completed'
    const snap = await db.ref(`IPC/${currentPO}/entries/${ipcNo}`).once('value');
    if (!snap.exists()) return;
    const val = snap.val() || {};
    const remarks = String(val.Remarks || '').toLowerCase();
    if (remarks !== 'under process') {
      alert('Please press "Under Process" first.');
      return;
    }

    await db.ref(`IPC/${currentPO}/entries/${ipcNo}`).update({
      Date: dateStr,
      Remarks: 'IPC Completed'
    });

    const btn = document.querySelector(`button[onclick="markIPCReady('${ipcNo}')"]`);
    if (btn) { btn.classList.add('done'); btn.disabled = true; }
    loadIPCEntries(currentPO);
  } catch (err) {
    handleError(err, 'markIPCReady');
  }
}



function startIPC() {
  // Hide welcome + login and go straight to IPC Entry
  var welcome = document.getElementById('welcomeBox');
  if (welcome) welcome.style.display = 'none';
  var loginSec = document.getElementById('loginSection');
  if (loginSec) loginSec.style.display = 'none';
  showSection('ipcSection');
  // Focus PO input so user can fetch immediately
  setTimeout(() => {
    const po = document.getElementById('poInput');
    if (po) { po.focus(); }
  }, 0);
}



/* ===== Bottom Nav Routing ===== */
function setActiveBottom(id) {
  try {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => b.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  } catch(e){}
}

function navIPC() {
  // Only allow accessing IPC if logged in; else send to Login
  if (!currentUserData) {
    showSection('loginSection');
    setActiveBottom('navIPC');
    alert('Please login to access IPC Entry.');
    return;
  }
  showSection('ipcSection');
  setActiveBottom('navIPC');
  // Close sidebar overlay if open (mobile)
  closeSidebar();
}

function navActive() {
  showSection('activeIPCSection');
  setActiveBottom('navActive');
  closeSidebar();
}

function navSettings() {
  if (!currentUserData) {
    showSection('loginSection');
  } else {
    showSection('settingsSection');
  }
  setActiveBottom('navSettings');
  closeSidebar();
}

/* keep bottom nav state in sync on direct section changes */
const _origShowSection = showSection;
showSection = function(id){
  _origShowSection(id);
  if (id === 'ipcSection') setActiveBottom('navIPC');
  else if (id === 'activeIPCSection') setActiveBottom('navActive');
  else if (id === 'settingsSection' || id === 'loginSection') setActiveBottom('navSettings');
}