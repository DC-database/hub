// js/iba-vacation-handover.js
// 15.0.0 patch 30: automatic vacation hand-over.
//
// When a person is on vacation (Vacation = Yes in their profile, return date
// not passed), their open tasks move to their replacement by themselves:
//   - invoices in their task list (For SRV, For Approval, ...): Attention is
//     changed to the replacement, with a history line and the task lists fixed
//   - their open WorkDesk jobs (only those already loaded, no extra download)
// The replacement gets a reminder in the assistant listing what came to them.
//
// No replacement in the profile -> the tasks come to Irwin (the usual
// fallback) and Irwin gets a reminder to set the replacement. As soon as a
// replacement is set, those tasks move on to the replacement by themselves.
//
// Low cost: nothing is read when nobody is on vacation. For each person on
// vacation, only their own small task list is read (every 30 minutes), and
// only the invoices in it. One browser at a time does the work (a lock).
(function () {
  "use strict";
  const VERSION = "15.0.0-p39";
  const EVERY = 30 * 60000;
  const ACTIVE_MS = 12 * 3600000;
  const CLOSED = /(with accounts|paid|srv done|closed|cancel|deleted|archived|complete)/i;
  const norm = (v) => String(v == null ? "" : v).trim().toLowerCase();
  const safe = (k) => String(k || "").replace(/[.#$[\]\/\\]/g, "_").replace(/\s+/g, "_");
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  let running = false;

  function mainDb() { try { return (typeof db !== "undefined" && db && db.ref) ? db : null; } catch (_) { return null; } }
  function invDb() { try { return (typeof invoiceDb !== "undefined" && invoiceDb && invoiceDb.ref) ? invoiceDb : null; } catch (_) { return null; } }
  function me() { try { return (typeof currentApprover !== "undefined" && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
  function approvers() {
    try { if (typeof allApproverData !== "undefined" && allApproverData) return allApproverData; } catch (_) {}
    try { if (typeof getCachedApproversData === "function") return getCachedApproversData() || {}; } catch (_) {}
    return {};
  }
  function onVacationFlag(v) { return v === true || norm(v) === "yes"; }
  function returned(a) {
    const s = String(a.DateReturn || "").trim();
    if (!s) return false;
    const d = new Date(s);
    if (isNaN(d)) return false;
    d.setHours(23, 59, 59, 999);
    return Date.now() > d.getTime();
  }
  function fallbackName() {
    try { if (typeof imBatchFallbackAttentionName === "function") return imBatchFallbackAttentionName() || "Irwin"; } catch (_) {}
    try { if (typeof resolveVacationAssignee === "function") return resolveVacationAssignee("Irwin") || "Irwin"; } catch (_) {}
    return "Irwin";
  }
  function exists(name) { const n = norm(name); return Object.values(approvers()).some((a) => a && norm(a.Name) === n); }
  // the replacement, following the chain if the replacement is away too
  function finalTarget(name) {
    let t = String(name || "").trim(), seen = new Set();
    while (t && !seen.has(norm(t))) {
      seen.add(norm(t));
      let next = t;
      try { if (typeof resolveVacationAssignee === "function") next = resolveVacationAssignee(t) || t; } catch (_) {}
      if (norm(next) === norm(t)) break;
      t = next;
    }
    return t;
  }
  // everyone on vacation now: { name, target, noReplacement }
  function awayList() {
    const out = [], fb = fallbackName();
    Object.values(approvers()).forEach((a) => {
      if (!a || !a.Name || !onVacationFlag(a.Vacation) || returned(a)) return;
      const name = String(a.Name).trim();
      // 15.0.0 patch 39: someone who is working is not away, whatever the
      // Vacation flag says (a flag left on by mistake must not move tasks):
      // never the person signed in here, nor anyone signed in in the last 12 h
      if (me() && norm(me().Name) === norm(name)) return;
      const ds = a.DesktopSession;
      if (ds && Number(ds.at) && Date.now() - Number(ds.at) < ACTIVE_MS) return;
      const rep = String(a.ReplacementName || "").trim();
      const valid = rep && norm(rep) !== norm(name) && exists(rep);
      let target = valid ? finalTarget(rep) : fb;
      if (norm(target) === norm(name)) target = fb;
      if (norm(target) === norm(name)) return; // the fallback person himself, with nobody to take over
      out.push({ name: name, target: target, noReplacement: !valid, rep: rep });
    });
    return out;
  }

  async function lock() {
    const d = mainDb();
    if (!d) return false;
    const who = (me() && me().Name) || "?";
    try {
      const r = await d.ref("iba_assistant/handover_lock").transaction((cur) => {
        if (cur && cur.at && Date.now() - Number(cur.at) < EVERY - 60000 && cur.by !== who) return; // someone else did it recently
        return { at: Date.now(), by: who };
      });
      return !!(r && r.committed);
    } catch (_) { return false; }
  }

  async function moveInvoice(po, key, from, to, why) {
    const idb = invDb();
    const s = await idb.ref("invoice_entries/" + po + "/" + key).once("value");
    const inv = s && s.val();
    if (!inv || CLOSED.test(String(inv.status || ""))) return null;
    if (norm(inv.attention) !== norm(from)) return null; // already moved or changed by someone
    const note = why + ": " + from + " -> " + to;
    const upd = { attention: to, handedOverFrom: from, handedOverAt: TS(), lastUpdated: TS() };
    await Promise.all([
      idb.ref("invoice_entries/" + po + "/" + key).update(upd),
      idb.ref("invoice_entries/" + po + "/" + key + "/history").push({ action: "Handed over", status: inv.status || "", by: "IBA (vacation hand-over)", timestamp: TS(), note: note })
    ]);
    try { if (typeof updateInvoiceTaskLookup === "function") await updateInvoiceTaskLookup(po, key, Object.assign({}, inv, { attention: to }), from); } catch (e) { console.warn("Hand-over: task list update", e); }
    return { kind: "invoice", po: po, key: key, ref: inv.invNumber || inv.invEntryID || "", status: String(inv.status || "") };
  }

  async function moveJob(e, from, to, why) {
    const d = mainDb();
    const note = why + ": " + from + " -> " + to;
    await Promise.all([
      d.ref("job_entries/" + e.key).update({ attention: to, handedOverFrom: from, handedOverAt: TS() }),
      d.ref("job_entries/" + e.key + "/history").push({ action: "Handed over", status: e.remarks || e.status || "", by: "IBA (vacation hand-over)", timestamp: TS(), note: note })
    ]);
    const local = Object.assign({}, e, { attention: to, handedOverFrom: from });
    try { if (typeof wdUpsertLocalWorkdeskJobEntryCache === "function") wdUpsertLocalWorkdeskJobEntryCache(e.key, local); } catch (_) {}
    try { if (typeof wdWriteWorkdeskJobRecentMarker === "function") await wdWriteWorkdeskJobRecentMarker(e.key, local, "updated"); } catch (_) {}
    return { kind: "job", po: e.po || "", key: e.key, ref: e.ref || "", status: e.for ? e.for + (e.remarks ? " · " + e.remarks : "") : (e.remarks || "") };
  }

  function loadedJobs() {
    try { if (typeof allSystemEntries !== "undefined" && Array.isArray(allSystemEntries)) return allSystemEntries; } catch (_) {}
    return [];
  }
  function jobOpen(e) {
    if (!e || !e.key || e.source === "invoice" || e.originalPO) return false;
    try { if (typeof isTaskComplete === "function" && isTaskComplete(e)) return false; } catch (_) {}
    return !CLOSED.test(String(e.remarks || e.status || ""));
  }

  async function handOver(p) {
    const idb = invDb(), d = mainDb();
    const why = p.noReplacement ? "On vacation, no replacement set" : "On vacation";
    const moved = [];
    // 1. invoices in the person's task list
    const s = await idb.ref("invoice_tasks_by_user/" + safe(p.name)).once("value");
    const rows = (s && s.val()) || {};
    for (const k of Object.keys(rows)) {
      const r = rows[k] || {};
      const po = String(r.originalPO || r.po || "").trim(), key = String(r.originalKey || r.invoiceKey || k).trim();
      if (!po || !key) continue;
      try { const m = await moveInvoice(po, key, p.name, p.target, why); if (m) moved.push(m); } catch (e) { console.warn("Hand-over invoice", po, key, e); }
    }
    // 2. open WorkDesk jobs already in memory
    for (const e of loadedJobs()) {
      if (!jobOpen(e) || norm(e.attention) !== norm(p.name)) continue;
      try { moved.push(await moveJob(e, p.name, p.target, why)); } catch (err) { console.warn("Hand-over job", e.key, err); }
    }
    // 3. no replacement: remember what went to the fallback person, so it can
    //    move on when a replacement is set
    if (p.noReplacement && moved.length) {
      const pend = {};
      moved.forEach((m) => { pend[safe(p.name) + "/" + safe(m.key)] = { kind: m.kind, po: m.po, key: m.key, ref: m.ref, at: TS() }; });
      try { await d.ref("iba_assistant/handover_pending").update(pend); } catch (_) {}
    }
    // 4. a replacement is set now: move what was parked with the fallback person
    if (!p.noReplacement) {
      try {
        const ps = await d.ref("iba_assistant/handover_pending/" + safe(p.name)).once("value");
        const parked = (ps && ps.val()) || {};
        const fb = fallbackName();
        for (const pk of Object.keys(parked)) {
          const x = parked[pk] || {};
          let m = null;
          if (x.kind === "invoice") m = await moveInvoice(x.po, x.key, fb, p.target, "On vacation (" + p.name + "), replacement now set");
          else {
            const js = await d.ref("job_entries/" + x.key).once("value"), e = js && js.val();
            if (e && jobOpen(Object.assign({ key: x.key }, e)) && norm(e.attention) === norm(fb)) m = await moveJob(Object.assign({ key: x.key }, e), fb, p.target, "On vacation (" + p.name + "), replacement now set");
          }
          if (m) moved.push(m);
        }
        if (Object.keys(parked).length) await d.ref("iba_assistant/handover_pending/" + safe(p.name)).remove();
      } catch (e) { console.warn("Hand-over parked tasks", e); }
    }
    if (!moved.length) return null;
    // 5. tell the person who received them (and log it)
    const list = moved.slice(0, 15).map((m) => "- " + (m.po ? "PO " + m.po + " " : "") + (m.ref || "") + (m.status ? " · " + m.status : "")).join("\n") + (moved.length > 15 ? "\n+ " + (moved.length - 15) + " more" : "");
    const text = p.noReplacement
      ? p.name + " is on vacation with NO replacement set. " + moved.length + " task(s) came to you:\n" + list + "\nOpen " + p.name + "'s profile and set the Replacement - these tasks then move to that person by themselves."
      : moved.length + " task(s) handed over to you from " + p.name + " (on vacation" + (p.target !== p.rep && p.rep ? ", via " + p.rep : "") + "):\n" + list;
    try {
      const ref = d.ref("iba_assistant/reminders/" + safe(p.target)).push();
      await Promise.all([
        ref.set({ from: "IBA hand-over", to: p.target, text: text, po: moved[0].po || "", at: TS() }),
        d.ref("iba_assistant/handover_log").push({ from: p.name, to: p.target, noReplacement: !!p.noReplacement, count: moved.length, items: moved.slice(0, 50), at: TS(), by: (me() && me().Name) || "" })
      ]);
    } catch (e) { console.warn("Hand-over reminder", e); }
    return { from: p.name, to: p.target, count: moved.length, noReplacement: p.noReplacement };
  }

  async function run(force) {
    if (running) return [];
    const u = me();
    if (!u || !u.Name || !invDb() || !mainDb()) return [];
    if (document.body && document.body.classList.contains("iba-phone")) return [];
    running = true;
    try {
      try { if (typeof ensureApproverDataCached === "function") await ensureApproverDataCached(false); } catch (_) {}
      const away = awayList();
      if (!away.length) return [];
      if (!force && !(await lock())) return [];
      const done = [];
      for (const p of away) {
        try { const r = await handOver(p); if (r) done.push(r); } catch (e) { console.warn("Hand-over", p.name, e); }
      }
      if (done.length && typeof ibaToast === "function") {
        try { ibaToast("Vacation hand-over: " + done.map((r) => r.count + " from " + r.from + " to " + r.to).join(", "), "ok"); } catch (_) {}
      }
      return done;
    } finally { running = false; }
  }

  function start() {
    // first run 20 s after sign-in, then every 30 minutes
    const first = () => { if (!me() || !me().Name) { setTimeout(first, 15000); return; } run(false).catch(() => {}); };
    setTimeout(first, 20000);
    setInterval(() => { run(false).catch(() => {}); }, EVERY);
  }
  // 15.0.0 patch 39: Super Admin - undo a hand-over (puts back only the tasks
  // that are still with the person who received them)
  async function log(limit) {
    const d = mainDb();
    if (!d) return [];
    const s = await d.ref("iba_assistant/handover_log").limitToLast(limit || 30).once("value");
    const v = (s && s.val()) || {};
    const arr = (x) => Array.isArray(x) ? x.filter(Boolean) : Object.values(x || {}).filter(Boolean);
    return Object.keys(v).map((k) => Object.assign({ id: k }, v[k] || {}, { items: arr((v[k] || {}).items) })).filter((x) => !x.undone).reverse();
  }
  async function undo(id) {
    const d = mainDb();
    const u = me();
    if (!document.body || !document.body.classList.contains("iba-is-super-admin")) throw new Error("Only the Super Admin can undo a hand-over.");
    const s = await d.ref("iba_assistant/handover_log/" + id).once("value");
    const x = s && s.val();
    if (!x) throw new Error("Hand-over not found.");
    let back = 0, left = 0;
    const items = Array.isArray(x.items) ? x.items.filter(Boolean) : Object.values(x.items || {}).filter(Boolean);
    for (const m of items) {
      try {
        let r = null;
        if (m.kind === "invoice") r = await moveInvoice(m.po, m.key, x.to, x.from, "Hand-over undone by " + ((u && u.Name) || "Super Admin"));
        else {
          const js = await d.ref("job_entries/" + m.key).once("value"), e = js && js.val();
          if (e && jobOpen(Object.assign({ key: m.key }, e)) && norm(e.attention) === norm(x.to)) r = await moveJob(Object.assign({ key: m.key }, e), x.to, x.from, "Hand-over undone");
        }
        if (r) back++; else left++;
      } catch (_) { left++; }
    }
    await d.ref("iba_assistant/handover_log/" + id).update({ undone: true, undoneAt: firebase.database.ServerValue.TIMESTAMP, undoneBy: (u && u.Name) || "" });
    try { await d.ref("iba_assistant/handover_pending/" + safe(x.from)).remove(); } catch (_) {}
    return { back: back, left: left, from: x.from, to: x.to };
  }
  window.ibaVacationHandover = { VERSION: VERSION, run: run, away: awayList, log: log, undo: undo };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
