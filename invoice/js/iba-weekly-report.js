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
  const VERSION = "15.0.0-p21";
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
  //   In:  For SRV, For Approval, On Hold, Pending, Unresolved
  //   Out: With Accounts, Paid, New Entry, CEO Approval, In Process,
  //        For Summary and any other CEO / COO step
  // ------------------------------------------------------------------
  const KEEP = [
    { id: "for srv", label: "For SRV", color: "#2a78d6" },
    { id: "for approval", label: "For Approval", color: "#eb6834" },
    { id: "on hold", label: "On Hold", color: "#1baf7a" },
    { id: "pending", label: "Pending", color: "#eda100" },
    { id: "unresolved", label: "Unresolved", color: "#e87ba4" },
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
    if (!who) return "Assign a person (no Attention)";
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
  function siteNo(v) { return (String(v == null ? "" : v).match(/\d+/) || [""])[0]; }

  // ------------------------------------------------------------------
  // Build the data
  // ------------------------------------------------------------------
  function buildModel(invData, jobs, closeRows, period, meeting, info) {
    const now = Date.now();
    const pm = poMap();
    const all = [];
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
        all.push({ kind: "invoice", po: po, key: k, inv: inv.invNumber || inv.invEntryID || "", vendor: inv.vendorName || inv.vendor_name || rec["Supplier Name"] || rec["Supplier"] || "",
          site: inv.site || inv.site_name || rec["Project ID"] || "", status: kp.match ? String(inv.status).trim() : kp.label, sk: kp.id, with: String(inv.attention || "").trim(), value: num(inv.invValue || inv.amount),
          note: [inv.note, inv.approvalNote ? "Approver: " + inv.approvalNote : ""].filter(Boolean).join(" · "), days: at ? Math.max(0, Math.floor((now - at) / DAY)) : null });
      });
    });
    // WorkDesk jobs (not invoices waiting for entry) in the same statuses
    (jobs || []).forEach((e) => {
      if (!e || !e.key) return;
      try { if (typeof isWorkdeskTaskRecord === "function" && !isWorkdeskTaskRecord(e)) return; } catch (_) {}
      try { if (typeof isTaskComplete === "function" && isTaskComplete(e)) return; } catch (_) {}
      if (String(e.for || "") === "Invoice") return; // reception entries (New Entry) are left out
      const kp = keepOf(e.remarks || e.status);
      if (!kp) return;
      const t = tms(e.timestamp) || tms(e.date);
      all.push({ kind: "job", po: String(e.po || ""), key: e.key, inv: e.ref || "", type: e.for || "", vendor: e.vendorName || "", site: e.site || "", status: kp.match ? String(e.remarks || e.status).trim() : kp.label, sk: kp.id,
        with: String(e.attention || "").trim(), value: num(e.amount), note: e.note || e.details || "", days: t ? Math.floor((now - t) / DAY) : null });
    });
    all.forEach((r) => { r.move = nextMove(r); r.siteId = siteNo(r.site) || "—"; });
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
        const id = siteNo(s);
        if (id) (team[id] = team[id] || []).push({ name: String(a.Name).trim(), role: role });
      });
    });
    // group by site
    const sites = {};
    all.forEach((r) => {
      const s = sites[r.siteId] = sites[r.siteId] || { id: r.siteId, label: r.site || r.siteId, items: [], count: {}, holders: {}, oldest: 0 };
      if (String(r.site).length > String(s.label).length) s.label = r.site;
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
      totals[k.id] = { n: list.length, v: list.reduce((a, r) => a + r.value, 0), oldest: list.reduce((a, r) => Math.max(a, r.days || 0), 0), late: list.filter((r) => (r.days || 0) > 30).length };
    });
    return { now: now, period: period, info: info, meeting: meeting, all: all, sites: siteList, noTeam: noTeam, shared: shared, close: close, totals: totals,
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
    return '<table class="sitet"><colgroup><col style="width:24px"><col style="width:118px"><col style="width:62px"><col style="width:110px"><col style="width:150px"><col style="width:112px"><col style="width:44px"><col style="width:58px"><col><col style="width:220px"><col style="width:140px"></colgroup>' +
      '<thead><tr><th class="c">✓</th><th>Status</th><th>PO</th><th>Invoice / Ref</th><th>Vendor</th><th>With</th><th class="n">Days</th><th class="n">Value</th><th>Notes / remarks</th><th>Next move</th><th class="dec">Decision</th></tr></thead><tbody>' +
      items.map((r) => {
        const id = itemId(r), d = dec[id] || {}, k = keepOf(r.status) || {};
        return '<tr data-id="' + esc(id) + '"><td class="c"><input type="checkbox" class="agree"' + (d.agreed ? " checked" : "") + ' title="Agreed"></td>' +
          '<td><span class="st" style="--c:' + (k.color || "#999") + '">' + esc(r.status) + "</span></td><td><b>" + esc(r.po || "—") + "</b></td><td>" + esc(r.inv || "") + (r.kind === "job" && r.type ? " <small>(" + esc(r.type) + ")</small>" : "") + "</td>" +
          "<td>" + esc(String(r.vendor || "").slice(0, 34)) + "</td><td>" + esc(r.with || "—") + "</td>" +
          '<td class="n' + ((r.days || 0) > 30 ? " late" : (r.days || 0) > 14 ? " warn" : "") + '">' + (r.days == null ? "" : r.days) + '</td><td class="n">' + (r.value ? moneyShort(r.value) : "") + "</td>" +
          '<td class="note">' + esc(String(r.note || "").slice(0, 120)) + '</td><td class="move">' + esc(r.move) + "</td>" +
          '<td class="dec"><input class="d-text" value="' + esc(d.decision || "") + '"></td></tr>';
      }).join("") + "</tbody></table>";
  }

  function reportHtml(m) {
    const dec = (m.meeting && m.meeting.current && m.meeting.current.items) || {};
    const tile = (k) => { const t = m.totals[k.id]; return '<div class="kpi" style="--c:' + k.color + '"><b>' + t.n + "</b><span>" + esc(k.label) + "</span><small>" + (t.n ? "oldest " + t.oldest + " d" + (t.late ? " · " + t.late + " over 30 d" : "") : "none") + "</small></div>"; };
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
      return '<section class="site"><div class="site-h"><div><h2>' + esc(s.label) + " <small>" + s.items.length + " open</small></h2>" +
        '<div class="team">' + (s.people.length ? s.people.map((p) => esc(p.name) + " <i>" + esc(p.role) + "</i>").join(" · ") : '<span class="late">Nobody assigned to this site</span>') + "</div></div>" +
        '<div class="site-r">' + counts + flags.join("") + "</div></div>" + siteTable(s.items, dec) + "</section>";
    }).join("");
    // PO close out: just PO, site, close-out total against the PO value
    const ctab = (rows) => rows.length ? '<table class="co"><thead><tr><th>PO</th><th>Site</th><th class="n">PO value</th><th class="n">Close-out total</th><th class="n">Balance</th></tr></thead><tbody>' +
      rows.map((r) => { const pv = num(r.poValue), iv = num(r.invoiceValue); return "<tr><td><b>" + esc(r.poNumber) + "</b></td><td>" + esc(r.site || "") + '</td><td class="n">' + (pv ? money(pv) : "") + '</td><td class="n">' + (iv ? money(iv) : "") + '</td><td class="n">' + (pv ? money(pv - iv) : "") + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="none">None.</p>';
    const info = m.info;
    const dataLine = info.mode === "saved" ? "saved copy from " + fmtDT(info.snapAt) + " + " + info.changed + " changed PO(s) read live" : "full read of all invoices";
    const total = m.all.length;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>IBA weekly site report - ' + esc(m.period.label) + "</title><style>" + CSS + "</style></head><body>" +
      '<div class="tools"><span id="saveNote"></span><button id="saveBtn" type="button">Save decisions</button><button type="button" onclick="window.print()">Print / Save as PDF</button><button type="button" class="ghost" onclick="window.close()">Close</button></div>' +
      '<header class="top"><div><div class="brand">IBA</div><h1>Weekly site report<small>' + esc(m.period.label) + '</small></h1></div><div class="meta">Prepared ' + esc(fmtDT(m.now)) + " · " + esc(me().Name || "") + "<br>For SRV · For Approval · On Hold · Pending · Unresolved · Report<br>" + total + " open · " + m.late + " over 30 days</div></header>" +
      '<div class="kpis">' + KEEP.map(tile).join("") + "</div>" +
      '<div class="row2"><div class="cbox"><h3>Open tasks per site</h3>' + (m.sites.length ? siteStack(m.sites, 620) : '<p class="none">Nothing open.</p>') + "</div>" + alloc + "</div>" +
      follow + siteBlocks +
      '<section class="sec"><h2>PO Close Out</h2><div class="row2 co2"><div><h4>Waiting at site (' + m.close.site.length + ")</h4>" + ctab(m.close.site) + "</div><div><h4>Ready to close (" + m.close.ho.length + ")</h4>" + ctab(m.close.ho) + "</div></div></section>" +
      '<footer>IBA ' + esc(VERSION) + " · Data: " + esc(dataLine) + " · about " + sizeText(info.bytes) + " read · " + esc(fmtDT(m.now)) + "</footer>" +
      "</body></html>";
  }

  const CSS =
    "@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{margin:0;padding:16px 22px 36px;font:11.5px/1.4 Arial,Helvetica,sans-serif;color:#141b24;background:#fff}" +
    ".tools{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:8px 0;background:#fff}.tools button{font:700 12px Arial;padding:8px 14px;border-radius:7px;border:1px solid #1E7F74;background:#1E7F74;color:#fff;cursor:pointer}.tools button.ghost{background:#fff;color:#1E7F74}#saveNote{color:#52514e;font-size:12px}" +
    ".top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0B1724;padding-bottom:10px;margin-bottom:12px}.top>div:first-child{display:flex;gap:14px;align-items:center}.brand{width:52px;height:52px;border-radius:12px;background:#0B1724;color:#E3C98A;font:900 17px Georgia,serif;display:flex;align-items:center;justify-content:center;letter-spacing:.08em}" +
    "h1{margin:0;font-size:23px}h1 small{display:block;font-size:13px;font-weight:600;color:#52514e;margin-top:3px}.meta{text-align:right;color:#52514e;font-size:11px;line-height:1.55}" +
    ".kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:12px}.kpi{border:1px solid #d7dde4;border-left:6px solid var(--c);border-radius:10px;padding:9px 12px}.kpi b{display:block;font-size:24px;line-height:1.1}.kpi span{display:block;font-weight:700;font-size:12px}.kpi small{color:#52514e;font-size:10.5px}" +
    ".row2{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-bottom:6px}.co2{grid-template-columns:1fr 1fr}.cbox{border:1px solid #d7dde4;border-radius:10px;padding:10px 12px;page-break-inside:avoid}.cbox h3{margin:0 0 8px;font-size:13px}" +
    "svg.ch{display:block;width:100%;height:auto;overflow:visible}svg .lbl{font-size:11px;fill:#141b24}svg .val{font-size:11px;font-weight:700;fill:#141b24}svg .in{font-size:10px;font-weight:700;fill:#fff}" +
    ".legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:11px;color:#52514e}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}" +
    ".alloc h4{margin:6px 0 4px;font-size:11.5px}.alloc ul{margin:0 0 6px;padding-left:18px}.alloc li{margin:2px 0}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}.dot.red{background:#c0392b}.dot.amber{background:#b36b00}" +
    ".sec,.site{margin-top:14px}.sec h2{font-size:14px;margin:0 0 6px;padding:6px 10px;background:#0B1724;color:#fff;border-radius:6px}.sec h2 small{font-weight:400;color:#C9D3DD;margin-left:8px;font-size:11px}h4{margin:6px 0 4px;font-size:12px}" +
    ".site{page-break-inside:auto}.site-h{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:7px 10px;background:#0B1724;color:#fff;border-radius:6px 6px 0 0}.site-h h2{margin:0;font-size:14.5px}.site-h h2 small{font-weight:400;color:#C9D3DD;font-size:11px;margin-left:6px}" +
    ".team{color:#C9D3DD;font-size:11px;margin-top:2px}.team i{font-style:normal;color:#E3C98A}.site-r{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}" +
    ".chip{display:inline-block;padding:2px 8px;border-radius:999px;background:#fff;color:#141b24;border-left:5px solid var(--c);font-size:10.5px}.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff}.tag.red{background:#c0392b}.tag.amber{background:#b36b00}" +
    "table{width:100%;border-collapse:collapse}table.sitet{table-layout:fixed}table.sitet td{overflow-wrap:anywhere}th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:#52514e;border-bottom:1.5px solid #9aa6b2;padding:4px 5px;background:#f5f7f9}td{border-bottom:1px solid #e3e8ed;padding:4px 5px;vertical-align:top}tr{page-break-inside:avoid}" +
    "td.n,th.n{text-align:right;white-space:nowrap}td.c,th.c{width:20px;text-align:center}td.note{color:#3d4854;max-width:230px}td.move{font-weight:700;color:#0b5c53}td.late,.late{color:#c0392b;font-weight:700}td.warn{color:#b36b00;font-weight:700}.ok{color:#1e7f3a;font-weight:700}" +
    ".st{display:inline-block;padding:1px 7px;border-radius:999px;border-left:4px solid var(--c);background:#f5f7f9;font-weight:700;font-size:10.5px;white-space:nowrap}" +
    "td.dec,th.dec{width:140px}td.dec input{width:100%;border:0;border-bottom:1px dotted #9aa6b2;font:11px Arial;padding:2px 0;background:transparent}.none{color:#52514e;font-style:italic;margin:4px 0}" +
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
      '<p>For SRV, For Approval, On Hold, Pending, Unresolved and Report, grouped by site, with what to do next, sites to sort out and PO Close Out. Print it or save it as PDF.</p>' +
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

  window.ibaWeeklyReport = { VERSION: VERSION, open: () => { if (isSuper()) launcher(); }, _weekStart: weekStart, _build: buildModel, _next: nextMove };
})();
