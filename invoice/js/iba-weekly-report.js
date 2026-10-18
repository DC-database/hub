/* ==========================================================================
   js/iba-weekly-report.js  -  15.0.0 patch 19 : Weekly project report
   Super Admin only. A printable meeting report (A4 landscape, print or save
   as PDF) of everything still open in WorkDesk and Invoice Management
   (With Accounts and Paid are left out), with charts, action lists, a
   suggested next move per line, site staffing for For SRV, PO Close Out and
   the decisions saved at the last meeting.

   Data (kept small):
     - invoices: the browser's saved copy (Invoice Records) when it is less
       than 24 hours old + only the invoices changed since then (from the
       small "recently changed" list), read live. Otherwise (or with "Full
       refresh") one full read, which also refreshes the saved copy.
     - WorkDesk jobs, PO Close Out and the user list: as already loaded by
       IBA (read once if not loaded yet).
     - meeting decisions: iba_assistant/meetings/{week} (a few KB).
   Week: Saturday to Thursday (Qatar).
   ========================================================================== */
(function () {
  "use strict";
  const VERSION = "15.0.0-p37";
  const DAY = 86400000;
  const SNAP_MAX = 24 * 3600000;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (v) => String(v == null ? "" : v).trim().toLowerCase();
  const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  const money = (v) => num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyShort = (v) => { const n = num(v); return n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(0); };
  function tms(v) {
    if (v === null || v === undefined || v === "") return 0;
    let t = typeof v === "number" ? v : (Date.parse(v) || parseInt(v, 10) || 0);
    if (t > 0 && t < 1e12) t *= 1000;
    return Number.isFinite(t) ? t : 0;
  }
  function qParts(t) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Qatar", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t));
    const g = (k) => (p.find((x) => x.type === k) || {}).value;
    return { y: +g("year"), m: +g("month"), d: +g("day"), wd: g("weekday"), hh: g("hour"), mm: g("minute") };
  }
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtD = (t) => { if (!t) return ""; const q = qParts(t); return String(q.d).padStart(2, "0") + "-" + MON[q.m - 1] + "-" + q.y; };
  const fmtDT = (t) => { if (!t) return ""; const q = qParts(t); return fmtD(t) + " " + q.hh + ":" + q.mm; };
  // Qatar midnight of a given time
  function qMidnight(t) { const q = qParts(t); return Date.UTC(q.y, q.m - 1, q.d) - 3 * 3600000; }
  // the Saturday that starts the week containing t (Sat..Fri; Thu is the last work day)
  function weekStart(t) {
    const mid = qMidnight(t);
    const wd = new Date(mid + 3 * 3600000).getUTCDay(); // 0 Sun .. 6 Sat
    const back = (wd + 1) % 7; // Sat -> 0, Sun -> 1, ... Fri -> 6
    return mid - back * DAY;
  }
  const weekLabel = (s) => "Sat " + fmtD(s) + " – Thu " + fmtD(s + 5 * DAY);
  const weekId = (s) => { const q = qParts(s + 3 * 3600000); return q.y + "-" + String(q.m).padStart(2, "0") + "-" + String(q.d).padStart(2, "0"); };

  function isSuper() { return !!(document.body && document.body.classList.contains("iba-is-super-admin")); }
  function me() { try { return (typeof currentApprover !== "undefined" && currentApprover) ? currentApprover : (window.currentApprover || {}); } catch (_) { return window.currentApprover || {}; } }
  function invDb() { try { return (typeof invoiceDb !== "undefined" && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
  function mainDb() { try { return (typeof db !== "undefined" && db && db.ref) ? db : null; } catch (_) { return null; } }
  function poMap() { try { return (typeof allPOData !== "undefined" && allPOData) ? allPOData : {}; } catch (_) { return {}; } }
  function approvers() {
    try { if (typeof ibaApproverMap === "function") return ibaApproverMap() || {}; } catch (_) {}
    try { return (typeof allApproverData !== "undefined" && allApproverData) ? allApproverData : {}; } catch (_) { return {}; }
  }
  const sizeText = (b) => b >= 1048576 ? (b / 1048576).toFixed(2) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  const sizeOf = (v) => { try { return JSON.stringify(v || {}).length; } catch (_) { return 0; } };

  // ------------------------------------------------------------------
  // Saved copy (same store as Invoice Records)
  // ------------------------------------------------------------------
  function idbOpen() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("no IndexedDB")); return; }
      const req = indexedDB.open("iba_invoice_records", 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore("snapshot"); } catch (_) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet() {
    const d = await idbOpen();
    return new Promise((resolve) => {
      try { const r = d.transaction("snapshot", "readonly").objectStore("snapshot").get("invoice_entries"); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); }
      catch (_) { resolve(null); }
    });
  }
  async function idbPut(v) {
    const d = await idbOpen();
    return new Promise((resolve) => {
      try { const tx = d.transaction("snapshot", "readwrite"); tx.objectStore("snapshot").put(v, "invoice_entries"); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); }
      catch (_) { resolve(false); }
    });
  }

  async function loadInvoices(full, note) {
    const idb = invDb();
    if (!idb) throw new Error("The invoice database is not available on this page.");
    const info = { mode: "", bytes: 0, changed: 0, snapAt: 0 };
    let snap = null;
    if (!full) {
      try { snap = await idbGet(); } catch (_) { snap = null; }
      if (snap && (!snap.data || Date.now() - Number(snap.savedAt || 0) > SNAP_MAX)) snap = null;
    }
    if (snap) {
      note("Using the saved copy from " + fmtDT(snap.savedAt) + "; reading what changed since then…");
      const data = Object.assign({}, snap.data);
      let rows = null;
      try {
        const s = await idb.ref("workdesk_dashboard_recent").orderByChild("updatedAt").startAt(Number(snap.savedAt) - 5 * 60000).once("value");
        rows = (s && s.val()) || {};
        info.bytes += sizeOf(rows);
      } catch (_) { rows = null; }
      if (rows) {
        const pos = Array.from(new Set(Object.keys(rows).map((k) => String((rows[k] || {}).po || (rows[k] || {}).originalPO || "").trim()).filter(Boolean)));
        for (let i = 0; i < pos.length; i += 20) {
          const part = pos.slice(i, i + 20);
          const res = await Promise.all(part.map((po) => idb.ref("invoice_entries/" + po).once("value").then((x) => x.val(), () => undefined)));
          res.forEach((v, j) => { if (v === undefined) return; info.bytes += sizeOf(v); if (v) data[part[j]] = v; else delete data[part[j]]; });
        }
        info.changed = pos.length;
        info.mode = "saved";
        info.snapAt = Number(snap.savedAt);
        return { data, info };
      }
    }
    note("Reading all invoices once (no recent saved copy)…");
    const s = await idb.ref("invoice_entries").once("value");
    const data = (s && s.val()) || {};
    info.bytes += sizeOf(data);
    info.mode = "full";
    try { await idbPut({ savedAt: Date.now(), data: data }); } catch (_) {}
    return { data, info };
  }

  async function loadJobs(note) {
    let list = [];
    try { if (typeof allSystemEntries !== "undefined" && Array.isArray(allSystemEntries) && allSystemEntries.length) list = allSystemEntries; } catch (_) {}
    if (!list.length) {
      note("Reading WorkDesk jobs…");
      try { if (typeof ensureAllEntriesFetched === "function") await ensureAllEntriesFetched(false); } catch (_) {}
      try { if (typeof allSystemEntries !== "undefined" && Array.isArray(allSystemEntries)) list = allSystemEntries; } catch (_) {}
    }
    return list;
  }

  async function loadCloseout() {
    try { if (typeof window.poCloseoutCollectRows === "function") return (await window.poCloseoutCollectRows()) || []; } catch (_) {}
    return [];
  }

  function meetingsRef(id) { const d = mainDb(); return d ? d.ref("iba_assistant/meetings" + (id ? "/" + id : "")) : null; }
  async function loadLastMeeting(currentId) {
    const ref = meetingsRef();
    if (!ref) return null;
    try {
      const s = await ref.orderByKey().endAt(currentId).limitToLast(2).once("value");
      const v = (s && s.val()) || {};
      const keys = Object.keys(v).sort();
      const prev = keys.filter((k) => k < currentId).pop();
      const cur = v[currentId] || null;
      return { prevId: prev || "", prev: prev ? v[prev] : null, current: cur };
    } catch (_) { return null; }
  }

  // ------------------------------------------------------------------
  // Rules (15.0.0 patch 20: brief - only the WorkDesk action statuses)
  //   In:  For SRV, For Approval, On Hold, Pending, Unresolved (+ IPC and Report, patches 21-22)
  //   Out: With Accounts, Paid, New Entry, CEO Approval, In Process,
  //        For Summary and any other CEO / COO step
  // ------------------------------------------------------------------
  const KEEP = [
    { id: "for srv", label: "For SRV", color: "#2a78d6" },
    { id: "for approval", label: "For Approval", color: "#eb6834" },
    { id: "on hold", label: "On Hold", color: "#1baf7a" },
    { id: "pending", label: "Pending", color: "#eda100" },
    { id: "unresolved", label: "Unresolved", color: "#e87ba4" },
    // 15.0.0 patch 22: IPC, same buckets as the WorkDesk Dashboard. WorkDesk IPC
    // jobs (for: IPC Application / IPC / IPC Processed) by their type; invoices
    // by their status (IPC Application, IPC Issue, Waiting Invoice)
    { id: "ipc application", label: "IPC Application", color: "#7a4bb3", match: /^(ipc application|ipc issue)$/ },
    { id: "ipc processed", label: "IPC Processed", color: "#285f9f", match: /^(ipc processed|ipc|waiting invoice)$/ },
    // 15.0.0 patch 21: the report steps (Report, Report Approval, Report Approved)
    { id: "report", label: "Report", color: "#008300", match: /^report( approval| approved)?$/ }
  ];
  const keepOf = (st) => { const s = norm(st); return KEEP.find((k) => (k.match ? k.match.test(s) : k.id === s)) || null; };
  const SITE_ROLES = ["Site DC", "Storekeeper", "Camp Boss"];

  function nextMove(r) {
    const s = norm(r.status), who = r.with || "", late = (r.days || 0) > 30;
    if (s === "on hold") return "Decide: release or cancel" + (r.note ? "" : " (no reason noted)");
    if (s === "unresolved") return "Resolve with the vendor / site";
    if (s === "report approved") return "Send it to In Process";
    if (s === "ipc issue") return "Resolve the IPC issue" + (who ? " with " + who : "");
    if (s === "ipc processed" || s === "waiting invoice" || s === "ipc") return (late ? "Escalate: " : "") + (who ? who + " to " : "") + "get the invoice from the vendor";
    if (!who) return "Assign a person (no Attention)";
    if (s === "ipc application") return (late ? "Escalate: " : "") + who + " to finish the IPC application";
    if (s === "report") return (late ? "Escalate: " : "") + who + " to prepare the report and send it for approval";
    if (s === "report approval") return (late ? "Escalate: " : "") + who + " to approve the report";
    if (s === "for srv") return late ? "Escalate: " + who + " to confirm delivery (SRV Done) or report the problem" : "Remind " + who + " to do SRV Done";
    if (s === "for approval") return (late ? "Escalate: " : "") + who + " to approve or reject";
    if (s === "on hold") return "Decide: release or cancel" + (r.note ? "" : " (no reason noted)");
    if (s === "pending") return (late ? "Escalate: " : "") + who + " to process it";
    if (s === "unresolved") return "Resolve with the vendor / site";
    return "Follow up with " + who;
  }

  function lastStatusTime(inv) {
    const st = norm(inv.status);
    let best = 0, latest = 0;
    try {
      const h = inv.history;
      const list = Array.isArray(h) ? h : (h && typeof h === "object" ? Object.values(h) : []);
      list.forEach((e) => {
        if (!e) return;
        const t = tms(e.timestamp || e.date);
        if (t > latest) latest = t;
        if (norm(e.status || e.action) === st && t > best) best = t;
      });
    } catch (_) {}
    return best || tms(inv.statusChangedAt) || Math.max(tms(inv.updatedAt), tms(inv.lastUpdated)) || latest || tms(inv.createdAt) || tms(inv.enteredAt);
  }
  function ipcOpen(st) {
    try { if (typeof wdIsOpenIPCJobStatus === "function") return !!wdIsOpenIPCJobStatus(st); } catch (_) {}
    const r = norm(st);
    if (!r) return true;
    return !/(with accounts|closed|cancel|deleted|srv done|completed|paid)/.test(r);
  }
  function siteNo(v) { return (String(v == null ? "" : v).match(/\d+/) || [""])[0]; }
  // 15.0.0 patch 22: the exact site code, as Invoice Records shows it
  // ("177 - Lusail" -> "177", "M170 - Mall" -> "M170"). No more digits-only
  // grouping, so 170 and M170 are two different sites.
  function siteCode(v) {
    const s = String(v == null ? "" : v).trim();
    if (!s || /^n\/?a$/i.test(s)) return "";
    return s.split(/\s+-\s*|\s*-\s+|\s+/)[0].toUpperCase();
  }

  // ------------------------------------------------------------------
  // Build the data
  // ------------------------------------------------------------------
  function buildModel(invData, jobs, closeRows, period, meeting, info) {
    const now = Date.now();
    const pm = poMap();
    const all = [];
    const mismatch = [];
    // the site of a PO = its Project ID, exactly like Invoice Records
    const poSite = (po) => { const r = pm[po]; const v = r && String(r["Project ID"] || "").trim(); return v && !/^n\/?a$/i.test(v) ? v : ""; };
    const labelOf = {};
    Object.keys(pm).forEach((po) => { const v = poSite(po), c = siteCode(v); if (!c) return; const m = labelOf[c] = labelOf[c] || {}; m[v] = (m[v] || 0) + 1; });
    const siteLabel = (c, fallback) => { const m = labelOf[c]; if (!m) return fallback || c; return Object.keys(m).sort((a, b) => m[b] - m[a])[0]; };
    Object.keys(invData || {}).forEach((po) => {
      const rows = invData[po] || {};
      if (typeof rows !== "object") return;
      const rec = pm[po] || {};
      Object.keys(rows).forEach((k) => {
        const inv = rows[k];
        if (!inv || typeof inv !== "object") return;
        const kp = keepOf(inv.status);
        if (!kp) return;
        const at = lastStatusTime(inv);
        const own = String(inv.site || inv.site_name || inv.siteName || "").trim(), ps = poSite(po);
        if (own && ps && siteCode(own) && siteCode(own) !== siteCode(ps)) mismatch.push({ po: po, inv: inv.invNumber || inv.invEntryID || "", saved: own, poSite: ps, status: String(inv.status || "").trim() });
        all.push({ kind: "invoice", po: po, key: k, inv: inv.invNumber || inv.invEntryID || "", invDate: inv.invoiceDate || "", vendor: inv.vendorName || inv.vendor_name || rec["Supplier Name"] || rec["Supplier"] || "",
          site: ps || own, status: kp.match ? String(inv.status).trim() : kp.label, sk: kp.id, with: String(inv.attention || "").trim(), value: num(inv.invValue || inv.amount),
          note: [inv.note, inv.approvalNote ? "Approver: " + inv.approvalNote : ""].filter(Boolean).join(" · "), days: at ? Math.max(0, Math.floor((now - at) / DAY)) : null });
      });
    });
    // WorkDesk jobs (not invoices waiting for entry) in the same statuses
    (jobs || []).forEach((e) => {
      if (!e || !e.key) return;
      try { if (typeof isWorkdeskTaskRecord === "function" && !isWorkdeskTaskRecord(e)) return; } catch (_) {}
      if (String(e.for || "") === "Invoice") return; // reception entries (New Entry) are left out
      const ft = norm(e.for || e.type), raw = String(e.remarks || e.status || "").trim();
      let kp, ipcNote = "";
      if (ft === "ipc" || ft === "ipc processed" || ft === "ipc application") {
        // IPC jobs: open until closed, whatever the remark says (as the Dashboard)
        if (!ipcOpen(raw)) return;
        kp = KEEP.find((k) => k.id === (ft === "ipc application" ? "ipc application" : "ipc processed"));
        if (raw && norm(raw) !== kp.id && !/^(pending|new entry)$/.test(norm(raw))) ipcNote = "Status: " + (norm(raw) === "ipc" ? "Waiting Invoice" : raw);
      } else {
        try { if (typeof isTaskComplete === "function" && isTaskComplete(e)) return; } catch (_) {}
        kp = keepOf(raw);
        if (!kp) return;
      }
      const t = tms(e.timestamp) || tms(e.date);
      all.push({ kind: "job", po: String(e.po || ""), key: e.key, inv: e.ref || "", type: ft === "ipc" ? "IPC Processed" : (e.for || ""), vendor: e.vendorName || (pm[String(e.po || "")] || {})["Supplier Name"] || "", site: poSite(String(e.po || "")) || String(e.site || "").trim(), status: ipcNote !== "" || kp.id.indexOf("ipc") === 0 ? kp.label : (kp.match ? raw : kp.label), sk: kp.id,
        with: String(e.attention || "").trim(), value: num(e.amount), note: [ipcNote, e.note || e.details || ""].filter(Boolean).join(" · "), days: t ? Math.floor((now - t) / DAY) : null });
    });
    all.forEach((r) => { r.move = nextMove(r); r.siteId = siteCode(r.site) || "—"; r.siteLabel = r.siteId === "—" ? "No site" : siteLabel(r.siteId, r.site); });
    // people assigned per site
    const team = {};
    const users = approvers();
    Object.keys(users).forEach((k) => {
      const a = users[k] || {};
      const pos = norm(a.Position);
      let role = "";
      if (pos.includes("site dc")) role = "Site DC"; else if (pos.includes("storekeeper")) role = "Storekeeper"; else if (pos.includes("camp boss")) role = "Camp Boss"; else if (pos.includes("logistic")) role = "Logistic";
      if (!role || !a.Name) return;
      String(a.Site || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => {
        const id = siteCode(s);
        if (id && !(team[id] || []).some((p) => p.name === String(a.Name).trim())) (team[id] = team[id] || []).push({ name: String(a.Name).trim(), role: role });
      });
    });
    // group by site (exact site code; the name is the PO's Project ID as in Invoice Records)
    const sites = {};
    all.forEach((r) => {
      const s = sites[r.siteId] = sites[r.siteId] || { id: r.siteId, label: r.siteLabel, items: [], count: {}, holders: {}, oldest: 0, inv: 0, jobs: 0, pos: {} };
      if (r.kind === "job") s.jobs++; else { s.inv++; s.pos[r.po] = 1; }
      s.items.push(r);
      s.count[r.sk] = (s.count[r.sk] || 0) + 1;
      s.oldest = Math.max(s.oldest, r.days || 0);
      const who = r.with || "(nobody)";
      s.holders[who] = (s.holders[who] || 0) + 1;
    });
    const superName = norm(me().Name);
    const order = (r) => KEEP.findIndex((k) => k.id === r.sk);
    const siteList = Object.values(sites).map((s) => {
      s.items.sort((a, b) => (order(a) - order(b)) || ((b.days || 0) - (a.days || 0)));
      s.people = team[s.id] || [];
      s.siteTeam = s.people.filter((p) => SITE_ROLES.indexOf(p.role) !== -1);
      const srvHolders = {};
      s.items.filter((r) => r.sk === "for srv").forEach((r) => { const w = r.with || "(nobody)"; srvHolders[w] = (srvHolders[w] || 0) + 1; });
      s.srvHolders = srvHolders;
      s.toSuper = Object.keys(srvHolders).filter((w) => norm(w) === superName || w === "(nobody)").reduce((a, w) => a + srvHolders[w], 0);
      return s;
    }).sort((a, b) => b.items.length - a.items.length);
    // site allocation: (a) no Site DC / Storekeeper / Camp Boss (For SRV goes to Irwin or Logistic)
    //                  (b) 2 or more people holding For SRV of the same site
    const noTeam = siteList.filter((s) => s.id !== "—" && !s.siteTeam.length && (s.count["for srv"] || 0) > 0);
    const shared = siteList.filter((s) => Object.keys(s.srvHolders).filter((w) => w !== "(nobody)").length >= 2);
    const close = { site: closeRows.filter((r) => r.waitingSite), ho: closeRows.filter((r) => r.waitingHo) };
    const totals = {};
    KEEP.forEach((k) => {
      const list = all.filter((r) => r.sk === k.id);
      const invs = list.filter((r) => r.kind === "invoice"), pos = {};
      invs.forEach((r) => { pos[r.po] = 1; });
      const steps = {};
      list.forEach((r) => { steps[r.status] = (steps[r.status] || 0) + 1; });
      totals[k.id] = { n: list.length, inv: invs.length, pos: Object.keys(pos).length, jobs: list.length - invs.length, steps: steps,
        v: list.reduce((a, r) => a + r.value, 0), oldest: list.reduce((a, r) => Math.max(a, r.days || 0), 0), late: list.filter((r) => (r.days || 0) > 30).length };
    });
    mismatch.sort((a, b) => String(a.po).localeCompare(String(b.po), undefined, { numeric: true }));
    return { now: now, period: period, info: info, meeting: meeting, all: all, sites: siteList, noTeam: noTeam, shared: shared, close: close, totals: totals, mismatch: mismatch,
      late: all.filter((r) => (r.days || 0) > 30).length };
  }

  // ------------------------------------------------------------------
  // Chart: tasks per site, stacked by status (one colour per status, in a
  // fixed order, with a legend and the total at the end of each bar)
  // ------------------------------------------------------------------
  function siteStack(sites, w) {
    const rows = sites.slice(0, 14);
    const max = Math.max(1, ...rows.map((s) => s.items.length));
    const lw = 170, rowH = 26, bw = w - lw - 46, h = rows.length * rowH + 8;
    return '<svg class="ch" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Open tasks per site by status">' + rows.map((s, i) => {
      const y = i * rowH + 5;
      let x = lw, out = '<text x="' + (lw - 8) + '" y="' + (y + 13) + '" text-anchor="end" class="lbl">' + esc(String(s.label).slice(0, 26)) + "</text>";
      KEEP.forEach((k) => {
        const n = s.count[k.id] || 0;
        if (!n) return;
        const len = Math.max(3, bw * n / max - 2);
        out += '<rect x="' + x + '" y="' + y + '" width="' + len + '" height="16" rx="3" fill="' + k.color + '"><title>' + esc(k.label + ": " + n) + "</title></rect>";
        if (len > 16) out += '<text x="' + (x + len / 2) + '" y="' + (y + 12) + '" text-anchor="middle" class="in">' + n + "</text>";
        x += len + 2;
      });
      return out + '<text x="' + (x + 6) + '" y="' + (y + 13) + '" class="val">' + s.items.length + "</text>";
    }).join("") + "</svg>" +
      '<div class="legend">' + KEEP.map((k) => '<span><i style="background:' + k.color + '"></i>' + esc(k.label) + "</span>").join("") + "</div>";
  }

  // ------------------------------------------------------------------
  // The report page
  // ------------------------------------------------------------------
  function itemId(r) { return (r.kind === "job" ? "j_" : "i_") + String(r.po || "") + "_" + String(r.key || "").replace(/[.#$\[\]\/]/g, "_"); }
  function siteTable(items, dec) {
    // 15.0.0 patch 22: no Invoice / Ref column; widths in % so Notes keeps
    // real room on screen and in print (it was squeezed to one letter a line)
    return '<table class="sitet"><colgroup><col style="width:3%"><col style="width:11%"><col style="width:10.5%"><col style="width:12%"><col style="width:8.5%"><col style="width:4.5%"><col style="width:6%"><col style="width:22%"><col style="width:13.5%"><col style="width:9%"></colgroup>' +
      '<thead><tr><th class="c">✓</th><th>Status</th><th>PO</th><th>Vendor</th><th>With</th><th class="n">Days</th><th class="n">Value</th><th>Notes / remarks</th><th>Next move</th><th class="dec">Decision</th></tr></thead><tbody>' +
      items.map((r) => {
        const id = itemId(r), d = dec[id] || {}, k = KEEP.find((x) => x.id === r.sk) || {};
        return '<tr data-id="' + esc(id) + '"' + (r.kind === "job" ? ' class="job"' : "") + '><td class="c"><input type="checkbox" class="agree"' + (d.agreed ? " checked" : "") + ' title="Agreed"></td>' +
          '<td><span class="st" style="--c:' + (k.color || "#999") + '">' + esc(r.status) + "</span></td><td><b>" + esc(r.po || "—") + "</b>" + (r.kind === "job" ? '<span class="wd">WorkDesk' + (r.type ? " · " + esc(r.type) : "") + (r.inv ? " · " + esc(r.inv) : "") + "</span>" : "") + "</td>" +
          "<td>" + esc(String(r.vendor || "").slice(0, 40)) + "</td><td>" + esc(r.with || "—") + "</td>" +
          '<td class="n' + ((r.days || 0) > 30 ? " late" : (r.days || 0) > 14 ? " warn" : "") + '">' + (r.days == null ? "" : r.days) + '</td><td class="n">' + (r.value ? moneyShort(r.value) : "") + "</td>" +
          '<td class="note">' + esc(String(r.note || "").slice(0, 240)) + '</td><td class="move">' + esc(r.move) + "</td>" +
          '<td class="dec"><input class="d-text" value="' + esc(d.decision || "") + '"></td></tr>';
      }).join("") + "</tbody></table>";
  }

  function reportHtml(m) {
    const dec = (m.meeting && m.meeting.current && m.meeting.current.items) || {};
    // 15.0.0 patch 22: each tile says what the number is made of, so it can be
    // checked against Invoice Records ("Found" there counts POs, not invoices)
    const tile = (k) => {
      const t = m.totals[k.id];
      const parts = [];
      if (t.inv) parts.push(t.inv + " invoice" + (t.inv === 1 ? "" : "s") + " on " + t.pos + " PO" + (t.pos === 1 ? "" : "s"));
      if (t.jobs) parts.push(t.jobs + " WorkDesk job" + (t.jobs === 1 ? "" : "s"));
      const steps = k.match && Object.keys(t.steps).length > 1 ? '<em class="steps">' + Object.keys(t.steps).sort().map((s) => esc(s) + " " + t.steps[s]).join(" · ") + "</em>" : "";
      return '<div class="kpi" style="--c:' + k.color + '"><b>' + t.n + "</b><span>" + esc(k.label) + "</span>" +
        (parts.length ? '<em class="mk">' + esc(parts.join(" + ")) + "</em>" : "") + steps +
        "<small>" + (t.n ? "oldest " + t.oldest + " d" + (t.late ? " · " + t.late + " over 30 d" : "") : "none") + "</small></div>";
    };
    // follow-up from the last meeting
    let follow = "";
    const prev = m.meeting && m.meeting.prev;
    if (prev && prev.items) {
      const items = Object.keys(prev.items).map((id) => Object.assign({ id: id }, prev.items[id])).filter((x) => x.agreed || x.decision);
      if (items.length) {
        const cur = {}; m.all.forEach((r) => { cur[itemId(r)] = r; });
        follow = '<section class="sec"><h2>Follow-up from the last meeting <small>' + esc(m.meeting.prevId) + '</small></h2><table class="fu"><thead><tr><th>PO</th><th>Invoice / Ref</th><th>Agreed</th><th>Then</th><th>Now</th><th>Result</th></tr></thead><tbody>' +
          items.map((x) => { const now = cur[x.id]; const moved = now && norm(now.status) !== norm(x.status);
            return "<tr><td><b>" + esc(x.po || "") + "</b></td><td>" + esc(x.inv || "") + "</td><td>" + esc(x.decision || "Agreed") + (x.owner ? " · " + esc(x.owner) : "") + "</td><td>" + esc(x.status || "") + "</td><td>" + esc(now ? now.status : "Done") + '</td><td class="' + (!now || moved ? "ok" : "late") + '">' + (!now ? "✔ Done" : moved ? "↗ Moved" : "✖ Not moved") + "</td></tr>"; }).join("") +
          "</tbody></table></section>";
      }
    }
    // site allocation
    const alloc = '<div class="cbox alloc"><h3>Site allocation - to sort out</h3>' +
      '<h4><span class="dot red"></span>No Site DC / Storekeeper / Camp Boss (For SRV goes to ' + esc(me().Name || "Irwin") + ' or Logistic)</h4>' +
      (m.noTeam.length ? "<ul>" + m.noTeam.map((s) => "<li><b>" + esc(s.label) + "</b> - " + (s.count["for srv"] || 0) + " For SRV" + (s.toSuper ? ", " + s.toSuper + " with " + esc(me().Name || "Irwin") : "") +
        (s.people.length ? " · now: " + s.people.map((p) => esc(p.name) + " (" + esc(p.role) + ")").join(", ") : " · nobody assigned") + "</li>").join("") + "</ul>" : '<p class="none">None - every site with For SRV has a site person.</p>') +
      '<h4><span class="dot amber"></span>2 or more people holding For SRV of the same site</h4>' +
      (m.shared.length ? "<ul>" + m.shared.map((s) => "<li><b>" + esc(s.label) + "</b> - " + Object.keys(s.srvHolders).filter((w) => w !== "(nobody)").sort((a, b) => s.srvHolders[b] - s.srvHolders[a]).map((w) => esc(w) + " " + s.srvHolders[w]).join(", ") + "</li>").join("") + "</ul>" : '<p class="none">None.</p>') +
      "</div>";
    // sites
    const siteBlocks = m.sites.map((s) => {
      const flags = [];
      if (!s.siteTeam.length && (s.count["for srv"] || 0)) flags.push('<span class="tag red">No site person</span>');
      if (Object.keys(s.srvHolders).filter((w) => w !== "(nobody)").length >= 2) flags.push('<span class="tag amber">Shared by ' + Object.keys(s.srvHolders).filter((w) => w !== "(nobody)").length + " people</span>");
      if (s.oldest > 30) flags.push('<span class="tag red">Oldest ' + s.oldest + " d</span>");
      const counts = KEEP.filter((k) => s.count[k.id]).map((k) => '<span class="chip" style="--c:' + k.color + '">' + esc(k.label) + " <b>" + s.count[k.id] + "</b></span>").join("");
      const made = [s.inv ? s.inv + " invoice" + (s.inv === 1 ? "" : "s") + " on " + Object.keys(s.pos).length + " PO" + (Object.keys(s.pos).length === 1 ? "" : "s") : "", s.jobs ? s.jobs + " WorkDesk" : ""].filter(Boolean).join(" + ");
      return '<section class="site"><div class="site-h"><div><h2>' + esc(s.label) + " <small>" + s.items.length + " open · " + esc(made) + "</small></h2>" +
        '<div class="team">' + (s.people.length ? s.people.map((p) => esc(p.name) + " <i>" + esc(p.role) + "</i>").join(" · ") : '<span class="late">Nobody assigned to this site</span>') + "</div></div>" +
        '<div class="site-r">' + counts + flags.join("") + "</div></div>" + siteTable(s.items, dec) + "</section>";
    }).join("");
    // PO close out: just PO, site, close-out total against the PO value
    const ctab = (rows) => rows.length ? '<table class="co"><thead><tr><th>PO</th><th>Site</th><th class="n">PO value</th><th class="n">Close-out total</th><th class="n">Balance</th></tr></thead><tbody>' +
      rows.map((r) => { const pv = num(r.poValue), iv = num(r.invoiceValue); return "<tr><td><b>" + esc(r.poNumber) + "</b></td><td>" + esc(r.site || "") + '</td><td class="n">' + (pv ? money(pv) : "") + '</td><td class="n">' + (iv ? money(iv) : "") + '</td><td class="n">' + (pv ? money(pv - iv) : "") + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="none">None.</p>';
    // invoices saved with a site different from their PO's site (Project ID)
    const MM = 60;
    const mism = m.mismatch.length ? '<section class="sec"><h2>Site check <small>' + m.mismatch.length + " invoice(s) saved with a site different from their PO - the report uses the PO site, like Invoice Records</small></h2>" +
      '<table class="co mm"><thead><tr><th>PO</th><th>Invoice</th><th>Status</th><th>Site saved on the invoice</th><th>PO site (used)</th></tr></thead><tbody>' +
      m.mismatch.slice(0, MM).map((x) => "<tr><td><b>" + esc(x.po) + "</b></td><td>" + esc(x.inv) + "</td><td>" + esc(x.status) + '</td><td class="late">' + esc(x.saved) + "</td><td>" + esc(x.poSite) + "</td></tr>").join("") +
      "</tbody></table>" + (m.mismatch.length > MM ? '<p class="none">+ ' + (m.mismatch.length - MM) + " more</p>" : "") + "</section>" : "";
    const info = m.info;
    const dataLine = info.mode === "saved" ? "saved copy from " + fmtDT(info.snapAt) + " + " + info.changed + " changed PO(s) read live" : "full read of all invoices";
    const total = m.all.length;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>IBA weekly site report - ' + esc(m.period.label) + "</title><style>" + CSS + "</style></head><body>" +
      '<div class="tools"><span id="saveNote"></span><button id="saveBtn" type="button">Save decisions</button><button type="button" onclick="window.print()">Print / Save as PDF</button><button type="button" class="ghost" onclick="window.close()">Close</button></div>' +
      '<header class="top"><div><div class="brand">IBA</div><h1>Weekly site report<small>' + esc(m.period.label) + '</small></h1></div><div class="meta">Prepared ' + esc(fmtDT(m.now)) + " · " + esc(me().Name || "") + "<br>" + KEEP.map((k) => k.label).join(" · ") + "<br>" + total + " open · " + m.late + " over 30 days</div></header>" +
      '<div class="kpis">' + KEEP.map(tile).join("") + "</div>" +
      '<div class="row2"><div class="cbox"><h3>Open tasks per site</h3>' + (m.sites.length ? siteStack(m.sites, 620) : '<p class="none">Nothing open.</p>') + "</div>" + alloc + "</div>" +
      follow + siteBlocks +
      '<section class="sec"><h2>PO Close Out</h2><div class="row2 co2"><div><h4>Waiting at site (' + m.close.site.length + ")</h4>" + ctab(m.close.site) + "</div><div><h4>Ready to close (" + m.close.ho.length + ")</h4>" + ctab(m.close.ho) + "</div></div></section>" + mism +
      '<footer>IBA ' + esc(VERSION) + " · Data: " + esc(dataLine) + " · about " + sizeText(info.bytes) + " read · " + esc(fmtDT(m.now)) + "</footer>" +
      "</body></html>";
  }

  const CSS =
    "@page{margin:9mm}*{box-sizing:border-box}body{margin:0;padding:16px 22px 36px;font:11.5px/1.4 Arial,Helvetica,sans-serif;color:#141b24;background:#fff}" +
    ".tools{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:8px 0;background:#fff}.tools button{font:700 12px Arial;padding:8px 14px;border-radius:7px;border:1px solid #1E7F74;background:#1E7F74;color:#fff;cursor:pointer}.tools button.ghost{background:#fff;color:#1E7F74}#saveNote{color:#52514e;font-size:12px}" +
    ".top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0B1724;padding-bottom:10px;margin-bottom:12px}.top>div:first-child{display:flex;gap:14px;align-items:center}.brand{width:52px;height:52px;border-radius:12px;background:#0B1724;color:#E3C98A;font:900 17px Georgia,serif;display:flex;align-items:center;justify-content:center;letter-spacing:.08em}" +
    "h1{margin:0;font-size:23px}h1 small{display:block;font-size:13px;font-weight:600;color:#52514e;margin-top:3px}.meta{text-align:right;color:#52514e;font-size:11px;line-height:1.55}" +
    ".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.kpi{border:1px solid #d7dde4;border-left:6px solid var(--c);border-radius:10px;padding:9px 12px}.kpi b{display:block;font-size:24px;line-height:1.1}.kpi span{display:block;font-weight:700;font-size:12px}.kpi small{display:block;color:#52514e;font-size:10.5px}.kpi em{display:block;font-style:normal;font-size:10.5px;color:#141b24;margin-top:1px}.kpi em.steps{color:#52514e}" +
    ".row2{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-bottom:6px}.co2{grid-template-columns:1fr 1fr}.cbox{border:1px solid #d7dde4;border-radius:10px;padding:10px 12px;page-break-inside:avoid}.cbox h3{margin:0 0 8px;font-size:13px}" +
    "svg.ch{display:block;width:100%;height:auto;overflow:visible}svg .lbl{font-size:11px;fill:#141b24}svg .val{font-size:11px;font-weight:700;fill:#141b24}svg .in{font-size:10px;font-weight:700;fill:#fff}" +
    ".legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:11px;color:#52514e}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}" +
    ".alloc h4{margin:6px 0 4px;font-size:11.5px}.alloc ul{margin:0 0 6px;padding-left:18px}.alloc li{margin:2px 0}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}.dot.red{background:#c0392b}.dot.amber{background:#b36b00}" +
    ".sec,.site{margin-top:14px}.sec h2{font-size:14px;margin:0 0 6px;padding:6px 10px;background:#0B1724;color:#fff;border-radius:6px}.sec h2 small{font-weight:400;color:#C9D3DD;margin-left:8px;font-size:11px}h4{margin:6px 0 4px;font-size:12px}" +
    ".site{page-break-inside:auto}.site-h{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:7px 10px;background:#0B1724;color:#fff;border-radius:6px 6px 0 0}.site-h h2{margin:0;font-size:14.5px}.site-h h2 small{font-weight:400;color:#C9D3DD;font-size:11px;margin-left:6px}" +
    ".team{color:#C9D3DD;font-size:11px;margin-top:2px}.team i{font-style:normal;color:#E3C98A}.site-r{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}" +
    ".chip{display:inline-block;padding:2px 8px;border-radius:999px;background:#fff;color:#141b24;border-left:5px solid var(--c);font-size:10.5px}.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff}.tag.red{background:#c0392b}.tag.amber{background:#b36b00}" +
    "table{width:100%;border-collapse:collapse}table.sitet{table-layout:fixed}table.sitet td{overflow-wrap:break-word;word-break:normal}table.sitet th{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:#52514e;border-bottom:1.5px solid #9aa6b2;padding:4px 5px;background:#f5f7f9}td{border-bottom:1px solid #e3e8ed;padding:4px 5px;vertical-align:top}tr{page-break-inside:avoid}" +
    "td.n,th.n{text-align:right;white-space:nowrap}td.c,th.c{width:20px;text-align:center}td.note{color:#3d4854;white-space:normal;line-height:1.35}.wd{display:block;font-size:9.5px;font-weight:700;color:#6b4fa0;margin-top:1px}tr.job td:first-child{box-shadow:inset 3px 0 0 #6b4fa0}td.move{font-weight:700;color:#0b5c53}td.late,.late{color:#c0392b;font-weight:700}td.warn{color:#b36b00;font-weight:700}.ok{color:#1e7f3a;font-weight:700}" +
    ".st{display:inline-block;padding:1px 7px;border-radius:999px;border-left:4px solid var(--c);background:#f5f7f9;font-weight:700;font-size:10.5px;white-space:nowrap}" +
    "td.dec input{width:100%;border:0;border-bottom:1px dotted #9aa6b2;font:11px Arial;padding:2px 0;background:transparent}.none{color:#52514e;font-style:italic;margin:4px 0}" +
    "footer{margin-top:16px;color:#7b8794;font-size:10px;text-align:center}" +
    "@media print{.tools{display:none}body{padding:0}.site-h,.sec h2,.kpi,.chip,.tag,.st{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";

  // ------------------------------------------------------------------
  // Launcher
  // ------------------------------------------------------------------
  function launcher() {
    let el = $("iba-wr-launch");
    if (el) { el.hidden = false; return; }
    const now = Date.now();
    const thisWk = weekStart(now);
    const q = qParts(now);
    const defaultLast = q.wd === "Sat" || q.wd === "Sun" || q.wd === "Fri";
    el = document.createElement("div");
    el.id = "iba-wr-launch";
    el.className = "iba-wr-launch";
    el.innerHTML = '<div class="iba-wr-card" role="dialog" aria-label="Weekly project report">' +
      '<h3><i class="fa-solid fa-chart-column"></i> Weekly project report</h3>' +
      '<p>For SRV, For Approval, On Hold, Pending, Unresolved, IPC Application, IPC Processed and Report, grouped by site, with what to do next, sites to sort out and PO Close Out. Print it or save it as PDF.</p>' +
      '<label><input type="radio" name="iba-wr-week" value="this"' + (defaultLast ? "" : " checked") + "> This week · " + esc(weekLabel(thisWk)) + "</label>" +
      '<label><input type="radio" name="iba-wr-week" value="last"' + (defaultLast ? " checked" : "") + "> Last week · " + esc(weekLabel(thisWk - 7 * DAY)) + "</label>" +
      '<label class="iba-wr-full"><input type="checkbox" id="iba-wr-full"> Full refresh (read every invoice again)</label>' +
      '<p class="iba-wr-status" id="iba-wr-status"></p>' +
      '<div class="iba-wr-acts"><button type="button" class="primary-btn" id="iba-wr-go"><i class="fa-solid fa-file-lines"></i> Build report</button><button type="button" class="secondary-btn" id="iba-wr-x">Close</button></div></div>';
    document.body.appendChild(el);
    $("iba-wr-x").addEventListener("click", () => { el.hidden = true; });
    el.addEventListener("click", (e) => { if (e.target === el) el.hidden = true; });
    $("iba-wr-go").addEventListener("click", () => {
      const pick = (el.querySelector('input[name="iba-wr-week"]:checked') || {}).value || "this";
      const start = pick === "last" ? thisWk - 7 * DAY : thisWk;
      // open the window now (inside the click) so pop-up blockers allow it
      const w = window.open("", "_blank");
      if (!w) { $("iba-wr-status").textContent = "Please allow pop-ups for IBA, then try again."; return; }
      w.document.write('<!doctype html><title>Building report…</title><body style="font:15px Arial;padding:40px;color:#141b24">Building the weekly report…</body>');
      build({ start: start, label: weekLabel(start), id: weekId(start) }, !!$("iba-wr-full").checked, w).catch((err) => {
        $("iba-wr-status").textContent = "Could not build the report: " + ((err && err.message) || err);
        try { w.close(); } catch (_) {}
      });
    });
  }

  async function build(period, full, w) {
    const status = $("iba-wr-status");
    let written = false;
    const note = (t) => { if (status) status.textContent = t; if (!written) { try { w.document.body.textContent = t; } catch (_) {} } };
    const go = $("iba-wr-go");
    if (go) go.disabled = true;
    try {
      try { if (typeof ensureApproverDataCached === "function") await ensureApproverDataCached(false); } catch (_) {}
      try { if (typeof ensureInvoicePOBaseDataFetched === "function") await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
      const inv = await loadInvoices(full, note);
      const jobs = await loadJobs(note);
      note("Reading PO Close Out…");
      const close = await loadCloseout();
      const meeting = (await loadLastMeeting(period.id)) || {};
      const model = buildModel(inv.data, jobs, close, period, meeting, inv.info);
      w.document.open(); w.document.write(reportHtml(model)); w.document.close();
      written = true;
      wireSave(w, model);
      note("Report ready (" + sizeText(inv.info.bytes) + " read).");
    } finally { if (go) go.disabled = false; }
  }

  function wireSave(w, model) {
    const btn = w.document.getElementById("saveBtn");
    const out = w.document.getElementById("saveNote");
    if (!btn) return;
    const byId = {}; model.all.forEach((r) => { byId[itemId(r)] = r; });
    btn.addEventListener("click", async () => {
      const items = {};
      w.document.querySelectorAll("tr[data-id]").forEach((tr) => {
        const id = tr.getAttribute("data-id");
        const agreed = tr.querySelector(".agree") && tr.querySelector(".agree").checked;
        const decision = (tr.querySelector(".d-text") || {}).value || "";
        const owner = "", due = "";
        if (!agreed && !decision) return;
        const r = byId[id] || {};
        items[id] = { agreed: !!agreed, decision: decision.slice(0, 300), owner: owner.slice(0, 80), due: due.slice(0, 40), po: r.po || "", inv: r.inv || "", status: r.status || "" };
      });
      const ref = meetingsRef(model.period.id);
      if (!ref) { out.textContent = "Cannot save here."; return; }
      btn.disabled = true; out.textContent = "Saving…";
      try {
        await ref.set({ week: model.period.label, savedAt: firebase.database.ServerValue.TIMESTAMP, by: me().Name || "", items: Object.keys(items).length ? items : null });
        out.textContent = "Saved " + Object.keys(items).length + " decision(s). Next week's report starts with them.";
      } catch (e) { out.textContent = "Could not save (Firebase rules?)."; }
      finally { btn.disabled = false; }
    });
  }

  // a button next to the Dashboard's Refresh / Check all (Super Admin, desktop)
  function addButton() {
    if (!isSuper() || $("iba-wr-btn")) return;
    const refresh = $("wd-active-dashboard-refresh");
    if (!refresh || !refresh.parentNode) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "iba-wr-btn";
    b.className = "secondary-btn wd-dashboard-refresh-btn iba-wr-btn";
    b.title = "Super Admin: weekly project report for the meeting (print or PDF)";
    b.innerHTML = '<i class="fa-solid fa-chart-column"></i> Weekly report';
    b.addEventListener("click", launcher);
    refresh.parentNode.insertBefore(b, refresh);
  }
  setInterval(addButton, 2000);

  // ------------------------------------------------------------------
  // 15.0.0 patch 28: site list by status (Super Admin skill, no AI).
  // One status (For SRV by default) for one site or all sites, as a
  // printable list. Same data and rules as the weekly report: the PO's
  // Project ID is the site, saved copy + changed POs only (low download).
  // ------------------------------------------------------------------
  function siteChoices() {
    const pm = poMap(), lab = {};
    Object.keys(pm).forEach((po) => {
      const v = String((pm[po] || {})["Project ID"] || "").trim(), c = siteCode(v);
      if (!c || /^n\/?a$/i.test(v)) return;
      const m = lab[c] = lab[c] || {}; m[v] = (m[v] || 0) + 1;
    });
    return Object.keys(lab).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((c) => [c, Object.keys(lab[c]).sort((a, b) => lab[c][b] - lab[c][a])[0]]);
  }
  const statusChoices = () => KEEP.map((k) => [k.id, k.label]);

  function listTable(items) {
    return '<table class="lt"><colgroup><col style="width:3%"><col style="width:3%"><col style="width:7.5%"><col style="width:11%"><col style="width:16%"><col style="width:10%"><col style="width:9%"><col style="width:12%"><col style="width:6.5%"><col style="width:22%"></colgroup>' +
      '<thead><tr><th class="c">#</th><th class="c">✓</th><th>PO</th><th>Invoice / Ref</th><th>Vendor</th><th>Inv. date</th><th class="n">Value</th><th>With</th><th class="n">Days</th><th>Notes</th></tr></thead><tbody>' +
      items.map((r, i) => '<tr' + (r.kind === "job" ? ' class="job"' : "") + '><td class="c">' + (i + 1) + '</td><td class="c"><span class="box"></span></td><td><b>' + esc(r.po || "—") + "</b></td>" +
        "<td>" + esc(r.inv || "") + (r.kind === "job" ? '<span class="wd">WorkDesk' + (r.type ? " · " + esc(r.type) : "") + "</span>" : "") + (r.sk && r.statusShown ? '<span class="wd">' + esc(r.status) + "</span>" : "") + "</td>" +
        "<td>" + esc(String(r.vendor || "").slice(0, 60)) + "</td><td>" + esc(r.invDate ? fmtD(tms(r.invDate)) || r.invDate : "") + '</td><td class="n">' + (r.value ? money(r.value) : "") + "</td>" +
        "<td>" + esc(r.with || "—") + '</td><td class="n' + ((r.days || 0) > 30 ? " late" : (r.days || 0) > 14 ? " warn" : "") + '">' + (r.days == null ? "" : r.days) + "</td>" +
        '<td class="note">' + esc(String(r.note || "").slice(0, 300)) + "</td></tr>").join("") + "</tbody></table>";
  }
  function holdersLine(items) {
    const h = {}; items.forEach((r) => { const w = r.with || "(nobody)"; h[w] = (h[w] || 0) + 1; });
    return Object.keys(h).sort((a, b) => h[b] - h[a]).map((w) => esc(w) + " <b>" + h[w] + "</b>").join(" · ");
  }
  function madeOf(items) {
    const inv = items.filter((r) => r.kind === "invoice"), pos = {}; inv.forEach((r) => { pos[r.po] = 1; });
    const jobs = items.length - inv.length;
    return [inv.length ? inv.length + " invoice" + (inv.length === 1 ? "" : "s") + " on " + Object.keys(pos).length + " PO" + (Object.keys(pos).length === 1 ? "" : "s") : "", jobs ? jobs + " WorkDesk job" + (jobs === 1 ? "" : "s") : ""].filter(Boolean).join(" + ");
  }
  // 15.0.0 patch 37: chart - one bar per site, split by how long items wait
  const AGE = [{ id: "a", label: "Under 15 days", color: "#1baf7a", test: (d) => (d || 0) < 15 }, { id: "b", label: "15-30 days", color: "#eda100", test: (d) => (d || 0) >= 15 && (d || 0) <= 30 }, { id: "c", label: "Over 30 days", color: "#c0392b", test: (d) => (d || 0) > 30 }];
  function ageChart(sites) {
    const rows = sites.slice(0, 30);
    const max = Math.max(1, ...rows.map((s) => s.items.length));
    const W = 760, lw = 180, rowH = 26, bw = W - lw - 50, h = rows.length * rowH + 6;
    const bars = rows.map((s, i) => {
      const y = i * rowH + 4;
      let x = lw, out = '<text x="' + (lw - 8) + '" y="' + (y + 13) + '" text-anchor="end" class="lbl">' + esc(String(s.label).slice(0, 28)) + "</text>";
      AGE.forEach((a) => {
        const n = s.items.filter((r) => a.test(r.days)).length;
        if (!n) return;
        const len = Math.max(4, bw * n / max - 2);
        out += '<rect x="' + x + '" y="' + y + '" width="' + len + '" height="17" rx="3" fill="' + a.color + '"><title>' + esc(s.label + " - " + a.label + ": " + n) + "</title></rect>";
        if (len > 18) out += '<text x="' + (x + len / 2) + '" y="' + (y + 12.5) + '" text-anchor="middle" class="in">' + n + "</text>";
        x += len + 2;
      });
      return out + '<text x="' + (x + 6) + '" y="' + (y + 13) + '" class="val">' + s.items.length + "</text>";
    }).join("");
    return '<div class="chartbox"><svg class="ch" viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="Items per site by days waiting">' + bars + "</svg>" +
      '<div class="legend">' + AGE.map((a) => '<span><i style="background:' + a.color + '"></i>' + esc(a.label) + "</span>").join("") + (sites.length > 30 ? "<span>(first 30 sites)</span>" : "") + "</div></div>";
  }
  function listHtml(m, o) {
    const total = m.sites.reduce((a, s) => a + s.items.length, 0);
    const value = m.sites.reduce((a, s) => a + s.items.reduce((b, r) => b + (r.value || 0), 0), 0);
    const all = [].concat.apply([], m.sites.map((s) => s.items));
    const late = all.filter((r) => (r.days || 0) > 30).length;
    const title = o.statusLabel + " list · " + (o.site ? m.sites[0] ? m.sites[0].label : o.site : "All sites");
    const summary = !o.site && m.sites.length > 1 ? '<section class="sum"><h2>By site</h2>' + ageChart(m.sites) + '<table class="st"><colgroup><col style="width:24%"><col style="width:8%"><col style="width:24%"><col style="width:9%"><col style="width:10%"><col style="width:25%"></colgroup><thead><tr><th>Site</th><th class="n">Open</th><th>Made of</th><th class="n">Oldest</th><th class="n">Over 30 d</th><th>With</th></tr></thead><tbody>' +
      m.sites.map((s) => "<tr><td><b>" + esc(s.label) + '</b></td><td class="n">' + s.items.length + "</td><td>" + esc(madeOf(s.items)) + '</td><td class="n' + (s.oldest > 30 ? " late" : "") + '">' + s.oldest + ' d</td><td class="n">' + s.items.filter((r) => (r.days || 0) > 30).length + "</td><td>" + holdersLine(s.items) + "</td></tr>").join("") +
      "</tbody></table></section>" : "";
    const blocks = m.sites.map((s, i) => '<section class="site' + (!o.site && i > 0 && o.pageEach ? " brk" : "") + '"><div class="site-h"><h2>' + esc(s.label) + " <small>" + s.items.length + " · " + esc(madeOf(s.items)) + "</small></h2>" +
      (o.site ? ageChart([s]) : "") +
      '<div class="team">Site team: ' + (s.people.length ? s.people.map((p) => esc(p.name) + " <i>" + esc(p.role) + "</i>").join(" · ") : '<span class="late">nobody assigned</span>') + '</div><div class="team">With: ' + holdersLine(s.items) + "</div></div>" +
      listTable(s.items) + "</section>").join("");
    const info = m.info;
    const dataLine = info.mode === "saved" ? "saved copy from " + fmtDT(info.snapAt) + " + " + info.changed + " changed PO(s) read live" : "full read of all invoices";
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>IBA ' + esc(title) + "</title><style>" + LCSS + "</style></head><body>" +
      '<div class="tools"><button type="button" onclick="window.print()">Print / Save as PDF</button><button type="button" class="ghost" onclick="window.close()">Close</button></div>' +
      '<header class="top"><div><div class="brand">IBA</div><h1>' + esc(o.statusLabel) + ' list<small>' + esc(o.site ? (m.sites[0] ? m.sites[0].label : "Site " + o.site) : "All sites · " + m.sites.length + " site" + (m.sites.length === 1 ? "" : "s")) + "</small></h1></div>" +
      '<div class="meta">Prepared ' + esc(fmtDT(m.now)) + " · " + esc(me().Name || "") + "<br><b>" + total + "</b> open · " + esc(madeOf(all) || "none") + (value ? " · QAR " + money(value) : "") + "<br>" + (late ? '<span class="late">' + late + " over 30 days</span>" : "none over 30 days") + "</div></header>" +
      (total ? summary + blocks : '<p class="none">Nothing is in ' + esc(o.statusLabel) + (o.site ? " for this site" : "") + " right now.</p>") +
      "<footer>IBA " + esc(VERSION) + " · Data: " + esc(dataLine) + " · about " + sizeText(info.bytes) + " read · no AI used</footer></body></html>";
  }
  const LCSS =
    "@page{margin:9mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}th{white-space:nowrap}body{margin:0;padding:14px 20px 30px;font:11px/1.4 Arial,Helvetica,sans-serif;color:#141b24;background:#fff}" +
    ".tools{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:flex-end;padding:8px 0;background:#fff}.tools button{font:700 12px Arial;padding:8px 14px;border-radius:7px;border:1px solid #1E7F74;background:#1E7F74;color:#fff;cursor:pointer}.tools button.ghost{background:#fff;color:#1E7F74}" +
    ".top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #0B1724;padding-bottom:10px;margin-bottom:12px}.top>div:first-child{display:flex;gap:12px;align-items:center}.brand{width:48px;height:48px;border-radius:11px;background:#0B1724;color:#E3C98A;font:900 16px Georgia,serif;display:flex;align-items:center;justify-content:center;letter-spacing:.08em}" +
    "h1{margin:0;font-size:21px}h1 small{display:block;font-size:13px;font-weight:600;color:#52514e;margin-top:3px}.meta{text-align:right;color:#52514e;font-size:11px;line-height:1.6}.meta b{color:#141b24;font-size:13px}" +
    "h2{font-size:14px;margin:0 0 4px}h2 small{font-weight:600;color:#52514e;font-size:11px}.sum{margin-bottom:14px}.site{margin:0 0 16px}.site.brk{break-before:page}.site-h{margin-bottom:6px}.team{color:#52514e;font-size:10.5px}.team i{font-style:normal;color:#8a8f96}.team b{color:#141b24}" +
    "table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d7dde4;padding:4px 5px;vertical-align:top;text-align:left;overflow-wrap:anywhere}th{background:#eef2f6;font-size:10px;text-transform:uppercase;letter-spacing:.02em}" +
    "thead{display:table-header-group}tr{break-inside:avoid}td.n,th.n{text-align:right}td.c,th.c{text-align:center}td.note{white-space:normal;color:#30353b}.box{display:inline-block;width:11px;height:11px;border:1.5px solid #52514e;border-radius:2px}" +
    "tr.job td{background:#f7f5ff}.wd{display:block;font-size:9.5px;color:#7a4bb3}.late{color:#b42318;font-weight:700}.warn{color:#b36b00;font-weight:700}.none{color:#52514e;font-size:13px;padding:30px 0}" +
    ".chartbox{border:1px solid #d7dde4;border-radius:10px;padding:10px 12px;margin:0 0 10px;break-inside:avoid}svg.ch{display:block;width:100%;max-width:820px;height:auto;overflow:visible}svg .lbl{font-size:11px;fill:#141b24}svg .val{font-size:11px;font-weight:700;fill:#141b24}svg .in{font-size:10px;font-weight:700;fill:#fff}" +
    ".legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:10.5px;color:#52514e}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}" +
    "footer{margin-top:18px;color:#8a8f96;font-size:10px;border-top:1px solid #d7dde4;padding-top:6px}@media print{.tools{display:none}body{padding:0}}";

  async function siteList(opts, w) {
    if (!isSuper()) throw new Error("This list is for the Super Admin only.");
    const o = Object.assign({ status: "for srv", site: "", pageEach: true }, opts || {});
    const statusIds = o.status === "all" ? KEEP.map((k) => k.id) : [norm(o.status)];
    const kp = KEEP.find((k) => k.id === statusIds[0]);
    if (!kp) throw new Error("Unknown status: " + o.status);
    o.statusLabel = o.status === "all" ? "Open items" : kp.label;
    const win = w || window.open("", "_blank");
    if (!win) throw new Error("Please allow pop-ups for IBA, then run it again.");
    let done = false;
    const note = (t) => { if (!done) { try { win.document.body.textContent = t; } catch (_) {} } };
    try { win.document.write('<!doctype html><title>Building list…</title><body style="font:15px Arial;padding:40px;color:#141b24">Building the ' + esc(o.statusLabel) + ' list…</body>'); } catch (_) {}
    try {
      try { if (typeof ensureApproverDataCached === "function") await ensureApproverDataCached(false); } catch (_) {}
      try { if (typeof ensureInvoicePOBaseDataFetched === "function") await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
      const inv = await loadInvoices(!!o.full, note);
      const jobs = await loadJobs(note);
      const m = buildModel(inv.data, jobs, [], { label: "" }, null, inv.info);
      const siteId = o.site ? siteCode(o.site) : "";
      m.sites = m.sites.map((s) => Object.assign({}, s, { items: s.items.filter((r) => statusIds.indexOf(r.sk) !== -1).map((r) => Object.assign({}, r, { statusShown: o.status === "all" || !!kp.match })) }))
        .filter((s) => s.items.length && (!siteId || s.id === siteId))
        .map((s) => { s.items.sort((a, b) => ((b.days || 0) - (a.days || 0)) || String(a.po).localeCompare(String(b.po), undefined, { numeric: true })); s.oldest = s.items.reduce((a, r) => Math.max(a, r.days || 0), 0); return s; })
        .sort((a, b) => b.items.length - a.items.length);
      if (siteId && !m.sites.length) { const lbl = (siteChoices().find((x) => x[0] === siteId) || [])[1]; o.site = lbl || siteId; }
      win.document.open(); win.document.write(listHtml(m, o)); win.document.close();
      done = true;
      const n = m.sites.reduce((a, s) => a + s.items.length, 0);
      return { count: n, sites: m.sites.length, bytes: inv.info.bytes, mode: inv.info.mode, by_site: m.sites.map((s) => ({ site: s.label, count: s.items.length, oldest_days: s.oldest })) };
    } catch (err) {
      if (!w) { try { win.close(); } catch (_) {} }
      throw err;
    }
  }

  // 15.0.0 patch 23: the low-cost invoice loader (saved copy + changed POs) is
  // shared with the assistant's "Download invoice list".
  window.ibaWeeklyReport = { VERSION: VERSION, open: () => { if (isSuper()) launcher(); }, loadInvoices: (full, note) => loadInvoices(!!full, typeof note === "function" ? note : () => {}),
    siteList: siteList, siteChoices: siteChoices, statusChoices: statusChoices, _weekStart: weekStart, _build: buildModel, _next: nextMove };
})();
