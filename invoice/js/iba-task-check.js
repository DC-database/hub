/* ==========================================================================
   IBA 15.0.0 patch 2 - "Check all": no open invoice left off the Dashboard
   --------------------------------------------------------------------------
   Why: to save downloads, the Dashboard never reads every invoice. It reads
   the small open-task list in Firebase (invoice_tasks_by_user/All), which each
   save keeps up to date. An open invoice that never got onto that list (for
   example saved by an older version that skipped blank-Attention invoices)
   is invisible to the Dashboard while Invoice Records still shows it.

   What this does (Super Admin only):
   - Compares the real invoice records (invoice_entries) with the list.
   - Adds every open invoice that is missing, refreshes rows whose status or
     person is out of date, and removes old copies left in someone's personal
     list (invoice now closed or addressed to someone else - the same rule
     Active Task already uses).
   - The invoices themselves are never changed; only the list.

   Downloads:
   - Automatic and free when Invoice Records (or a report/export) has already
     loaded all invoices: it runs quietly at most once every 6 hours and only
     reads the open-task list.
   - The "Check all" button on the Dashboard uses those loaded invoices too;
     if they are not loaded it asks first, then reads invoice_entries once
     (the same download as opening Invoice Records) and keeps it in memory so
     Invoice Records does not download it again.
   ========================================================================== */
(function () {
  "use strict";
  if (window.ibaTaskCheck) return;

  const AUTO_KEY = "iba-task-check-last-v1";
  const AUTO_EVERY = 6 * 60 * 60 * 1000;
  let running = false;

  // ---------------- helpers ----------------
  const norm = (v) => String(v || "").toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  const ownerNorm = (v) => String(v || "").replace(/[.#$\[\]\/\\_]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const poNorm = (v) => String(v || "").trim().toUpperCase();
  const statusOf = (inv) => String((inv && (inv.status || inv.remarks)) || "").trim();
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");

  function isSuper() { return !!(document.body && document.body.classList.contains("iba-is-super-admin")); }
  function idb() {
    try { return (typeof invoiceDb !== "undefined" && invoiceDb && typeof invoiceDb.ref === "function") ? invoiceDb : null; } catch (_) { return null; }
  }
  function myName() {
    try { return (typeof currentApprover !== "undefined" && currentApprover && (currentApprover.Name || currentApprover.name)) || ""; } catch (_) { return ""; }
  }
  function isOpen(inv) {
    if (!inv || typeof inv !== "object") return false;
    if (typeof isInvoiceTaskActive === "function") return isInvoiceTaskActive(inv);
    const s = norm(statusOf(inv));
    if (!s) return false;
    return !/(under review|with accounts|srv done|paid|closed|cancel|completed|^done$)/.test(s);
  }
  // the same loose match Active Task uses: "Maria Manager" matches
  // "Maria Manager", "Maria Manager / Khalid" and so on
  function addressedTo(attention, owner) {
    const a = ownerNorm(attention);
    const o = ownerNorm(owner);
    if (!a || !o) return false;
    if (a === o || a.includes(o) || o.includes(a)) return true;
    return a.split(/\s*(?:,|;|\||&|\+|->|➔|\band\b|\bor\b)\s*/i).some((p) => ownerNorm(p) === o);
  }
  // the Dashboard's own rule for "yours": one of the Attention names is you
  function namesIn(attention) {
    return String(attention || "").split(/\s*(?:,|;|\/|\||&|\+|->|➔|\band\b|\bor\b)\s*/i).map(ownerNorm).filter(Boolean);
  }
  function fullInvoicesInMemory() {
    try {
      if (window.__invoiceEntriesFullLoaded === true && typeof allInvoiceData !== "undefined" && allInvoiceData && typeof allInvoiceData === "object") return allInvoiceData;
    } catch (_) {}
    return null;
  }

  // ---------------- compare (no Firebase, testable) ----------------
  function compare(invoices, tasksRoot) {
    const all = (tasksRoot && tasksRoot.All && typeof tasksRoot.All === "object") ? tasksRoot.All : {};
    const me = ownerNorm(myName());
    const res = {
      checked: 0, open: 0, listed: 0,
      missing: [], outdated: [], ghosts: [],
      byStatus: {}, // status -> { total, mine, added }
      personalChecked: !!(tasksRoot && Object.keys(tasksRoot).some((k) => norm(k) !== "all"))
    };

    // rows of the list that point at an invoice by an older key style
    const legacy = new Set();
    Object.keys(all).forEach((k) => {
      const r = all[k] || {};
      const po = poNorm(r.po || r.originalPO);
      [k, r.originalKey, r.invoiceKey, r.key, r.invEntryID].forEach((x) => { if (x) legacy.add(po + "|" + norm(x)); });
    });

    const byKey = new Map();
    Object.keys(invoices || {}).forEach((po) => {
      const group = invoices[po];
      if (!group || typeof group !== "object") return;
      Object.keys(group).forEach((key) => {
        const inv = group[key];
        if (!inv || typeof inv !== "object") return;
        res.checked += 1;
        byKey.set(key, { po, key, inv });
        if (!isOpen(inv)) return;
        res.open += 1;
        const st = statusOf(inv) || "Pending";
        const b = res.byStatus[st] || (res.byStatus[st] = { total: 0, mine: 0, added: 0 });
        b.total += 1;
        if (me && namesIn(inv.attention).includes(me)) b.mine += 1;

        const row = all[key];
        if (row) {
          res.listed += 1;
          if (norm(row.status) !== norm(st) || ownerNorm(row.attention) !== ownerNorm(inv.attention)) {
            res.outdated.push({ po, key, inv, oldAttention: String(row.attention || "") });
          }
          return;
        }
        const p = poNorm(po);
        if (legacy.has(p + "|" + norm(key)) || (inv.invEntryID && legacy.has(p + "|" + norm(inv.invEntryID)))) {
          res.listed += 1;
          return;
        }
        res.missing.push({ po, key, inv });
        b.added += 1;
      });
    });

    // old copies in personal lists (only when the invoice can be found)
    Object.keys(tasksRoot || {}).forEach((owner) => {
      if (norm(owner) === "all") return;
      const rows = tasksRoot[owner];
      if (!rows || typeof rows !== "object") return;
      Object.keys(rows).forEach((k) => {
        const r = rows[k] || {};
        const hit = byKey.get(k) || (r.originalKey && byKey.get(r.originalKey)) || (r.invoiceKey && byKey.get(r.invoiceKey));
        if (!hit) return; // cannot be checked here: leave it
        const rowPo = r.po || r.originalPO;
        if (rowPo && poNorm(rowPo) !== poNorm(hit.po)) return;
        if (!isOpen(hit.inv) || !addressedTo(hit.inv.attention, owner)) {
          res.ghosts.push({ owner, key: k, po: hit.po, status: statusOf(hit.inv), attention: String(hit.inv.attention || "") });
        }
      });
    });
    return res;
  }

  // ---------------- Firebase ----------------
  async function readTaskLists() {
    const d = idb();
    if (!d) throw new Error("Firebase is not ready.");
    try {
      const snap = await d.ref("invoice_tasks_by_user").once("value");
      return snap.val() || {};
    } catch (_) {
      // the rules may allow each list but not the whole folder: use All only
      const snap = await d.ref("invoice_tasks_by_user/All").once("value");
      return { All: snap.val() || {} };
    }
  }
  async function readAllInvoices() {
    const mem = fullInvoicesInMemory();
    if (mem) return mem;
    const d = idb();
    if (!d) throw new Error("Firebase is not ready.");
    const snap = await d.ref("invoice_entries").once("value");
    const data = snap.val() || {};
    // keep it, exactly as Invoice Records would, so it is not downloaded again
    try {
      allInvoiceData = data;
      window.__invoiceEntriesFullLoaded = true;
      if (typeof cacheTimestamps !== "undefined" && cacheTimestamps) cacheTimestamps.invoiceData = Date.now();
      if (typeof allUniqueNotes !== "undefined") {
        allUniqueNotes = new Set();
        Object.keys(data).forEach((po) => Object.keys(data[po] || {}).forEach((k) => {
          const n = data[po][k] && data[po][k].note;
          if (n && String(n).trim()) allUniqueNotes.add(String(n).trim());
        }));
      }
    } catch (_) {}
    return data;
  }
  async function repair(res, progress) {
    const out = { added: 0, updated: 0, removed: 0, failed: 0 };
    const total = res.missing.length + res.outdated.length + res.ghosts.length;
    let done = 0;
    const step = () => { done += 1; if (progress) progress(done, total); };
    const write = async (po, key, inv, oldAttention) => {
      await updateInvoiceTaskLookup(po, key, Object.assign({}, inv, { po_number: inv.po_number || po }), oldAttention || null, { skipPaymentReadySync: true });
    };
    if (typeof updateInvoiceTaskLookup !== "function") throw new Error("The save helper is not loaded.");
    for (const m of res.missing) {
      try { await write(m.po, m.key, m.inv, null); out.added += 1; } catch (e) { out.failed += 1; console.warn("[IBA check] add failed", m.po, m.key, e); }
      step();
    }
    for (const o of res.outdated) {
      try { await write(o.po, o.key, o.inv, o.oldAttention); out.updated += 1; } catch (e) { out.failed += 1; console.warn("[IBA check] update failed", o.po, o.key, e); }
      step();
    }
    const d = idb();
    for (const g of res.ghosts) {
      try { await d.ref("invoice_tasks_by_user/" + g.owner + "/" + g.key).remove(); out.removed += 1; } catch (e) { out.failed += 1; console.warn("[IBA check] remove failed", g.owner, g.key, e); }
      step();
    }
    return out;
  }

  function remember() { try { localStorage.setItem(AUTO_KEY, String(Date.now())); } catch (_) {} }
  function lastRun() { try { return Number(localStorage.getItem(AUTO_KEY) || 0) || 0; } catch (_) { return 0; } }

  // ---------------- report ----------------
  function statusLines(res) {
    return Object.keys(res.byStatus)
      .sort((a, b) => res.byStatus[b].total - res.byStatus[a].total || a.localeCompare(b))
      .map((s) => {
        const b = res.byStatus[s];
        const bits = [];
        if (b.mine) bits.push(b.mine + " yours");
        if (b.added) bits.push(b.added + " were missing");
        return "  " + s + ": " + fmt(b.total) + (bits.length ? " (" + bits.join(", ") + ")" : "");
      });
  }
  function summary(res, out) {
    const lines = [
      "Checked " + fmt(res.checked) + " invoice records.",
      "Open (not yet With Accounts, Paid, SRV Done or Closed): " + fmt(res.open),
      "",
      "Added to the Dashboard (were missing): " + fmt(out.added),
      "Updated (status or person was out of date): " + fmt(out.updated),
      "Old copies removed from personal lists: " + fmt(out.removed)
    ];
    if (!res.personalChecked) lines.push("(Personal lists could not be read, so they were not checked.)");
    if (out.failed) lines.push("Could not write " + fmt(out.failed) + " row(s). Run Check all again.");
    lines.push("", "Open invoices by status (\"yours\" are under My personal tasks):");
    return lines.concat(statusLines(res)).join("\n");
  }

  // ---------------- toast (automatic run) ----------------
  function toast(text) {
    let el = document.getElementById("iba-task-check-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "iba-task-check-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-on"), 9000);
  }
  function refreshDashboard() {
    const btn = document.getElementById("wd-active-dashboard-refresh");
    const dash = document.getElementById("wd-dashboard");
    if (btn && dash && !dash.classList.contains("hidden") && dash.offsetParent !== null) btn.click();
  }

  // ---------------- button on the Dashboard ----------------
  function button() { return document.getElementById("iba-task-check-btn"); }
  function label(text) {
    const b = button();
    if (!b) return;
    if (text) {
      if (!b.dataset.ibaLabel) b.dataset.ibaLabel = b.innerHTML;
      b.disabled = true;
      b.classList.add("is-busy");
      b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + text;
    } else {
      if (b.dataset.ibaLabel) b.innerHTML = b.dataset.ibaLabel;
      delete b.dataset.ibaLabel;
      b.disabled = false;
      b.classList.remove("is-busy");
    }
  }
  async function runManual() {
    if (running || !isSuper()) return;
    const inMemory = !!fullInvoicesInMemory();
    const ask = inMemory
      ? "Check every invoice record against the Dashboard list?\n\nAll invoices are already loaded, so this only reads the open-task list. Open invoices that are missing get added and old copies get removed. Invoices themselves are not changed."
      : "Check every invoice record against the Dashboard list?\n\nThis reads all invoice records once (the same download as opening Invoice Records) plus the open-task list. Open invoices that are missing get added and old copies get removed. Invoices themselves are not changed.";
    if (!confirm(ask)) return;
    running = true;
    try {
      label("Reading...");
      const [invoices, lists] = await Promise.all([readAllInvoices(), readTaskLists()]);
      label("Checking...");
      const res = compare(invoices, lists);
      const out = await repair(res, (n, t) => label("Fixing " + n + " of " + t + "..."));
      remember();
      label("");
      alert(summary(res, out));
      refreshDashboard();
    } catch (e) {
      console.warn("[IBA check] failed", e);
      label("");
      alert("The check could not finish: " + ((e && e.message) || e) + "\n\nNothing else was changed. Try again.");
    } finally {
      running = false;
      label("");
    }
  }
  async function runAuto(reason) {
    if (running || !isSuper()) return;
    const invoices = fullInvoicesInMemory();
    if (!invoices) return;
    if (Date.now() - lastRun() < AUTO_EVERY) return;
    running = true;
    try {
      const lists = await readTaskLists();
      const res = compare(invoices, lists);
      const out = await repair(res);
      remember();
      const changed = out.added + out.updated + out.removed;
      if (changed) {
        const bits = [];
        if (out.added) bits.push(out.added + " open invoice" + (out.added === 1 ? "" : "s") + " added");
        if (out.updated) bits.push(out.updated + " updated");
        if (out.removed) bits.push(out.removed + " old cop" + (out.removed === 1 ? "y" : "ies") + " removed");
        toast("Dashboard list checked: " + bits.join(", ") + ".");
        refreshDashboard();
      }
      console.info("[IBA check] automatic (" + (reason || "loaded") + "):", { checked: res.checked, open: res.open, out });
    } catch (e) {
      console.warn("[IBA check] automatic check skipped", e);
    } finally {
      running = false;
    }
  }

  function addButton() {
    if (button()) return true;
    const refresh = document.getElementById("wd-active-dashboard-refresh");
    if (!refresh || !refresh.parentNode) return false;
    const b = document.createElement("button");
    b.type = "button";
    b.id = "iba-task-check-btn";
    b.className = "secondary-btn wd-dashboard-refresh-btn iba-task-check-btn";
    b.title = "Super Admin: find open invoices missing from the Dashboard and add them";
    b.innerHTML = '<i class="fa-solid fa-list-check"></i> Check all';
    b.addEventListener("click", runManual);
    refresh.parentNode.insertBefore(b, refresh);
    return true;
  }

  // run quietly whenever all invoices have just been loaded anyway
  function hookFullLoad() {
    if (typeof window.ensureInvoiceDataFetched !== "function" || window.ensureInvoiceDataFetched.__ibaCheck) return;
    const original = window.ensureInvoiceDataFetched;
    const wrapped = async function () {
      const result = await original.apply(this, arguments);
      try { if (fullInvoicesInMemory()) setTimeout(() => runAuto("invoices loaded"), 4000); } catch (_) {}
      return result;
    };
    wrapped.__ibaCheck = true;
    window.ensureInvoiceDataFetched = wrapped;
  }

  function start() {
    addButton();
    hookFullLoad();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.ibaTaskCheck = { compare, run: runManual, auto: runAuto, _readTaskLists: readTaskLists };
})();
