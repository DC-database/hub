/* ==========================================================================
   IBA 14.0.0 patch 18 - background dimming you can set
   --------------------------------------------------------------------------
   - The background photo is darkened by a see-through layer so text stays
     readable. Before this patch: desktop about 36% (from the original
     14.0.0 design) and phone about 72% (patch 8). New defaults are lighter:
     desktop 20%, phone 35%.
   - Settings > Shell Backgrounds (Super Admin) has two sliders, Desktop and
     Phone, 0% (photo as it is) to 80%. Moving a slider shows the change at
     once; Save applies it for everyone, like the photos. "Default" puts back
     20% / 35%. 36% / 72% gives exactly the old look.
   - Stored in Firebase next to the photos (system_settings/shell_backgrounds:
     dim_desktop, dim_phone) and remembered in the browser so it shows at
     once on the next visit. Only the darkness of that layer changes.
   ========================================================================== */
(function () {
  "use strict";
  if (window.ibaBgDim) return;

  const PATH = "system_settings/shell_backgrounds";
  const KEY = "iba-bg-dim-v1";
  const DEF = { desktop: 20, phone: 35 };
  const MAX = 80;
  const STEP = 5;
  const PHOTO_BASE = "https://raw.githubusercontent.com/DC-database/hub/main/photo/";

  function clamp(v, d) {
    if (v === null || v === undefined || v === "") return d;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX, n)) : d;
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o) return { desktop: clamp(o.desktop, DEF.desktop), phone: clamp(o.phone, DEF.phone) };
    } catch (_) {}
    return { desktop: DEF.desktop, phone: DEF.phone };
  }
  function remember(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} }

  // one number per screen; the layer keeps its shape (a little lighter at the
  // top, a little darker at the bottom, where the long lists sit)
  function layers(v) {
    const d = v.desktop / 100, p = v.phone / 100;
    return {
      "--iba-dim-top": (d * 0.77).toFixed(3),
      "--iba-dim-bot": Math.min(0.95, d * 1.23).toFixed(3),
      "--iba-ph-dim-top": (p * 0.8).toFixed(3),
      "--iba-ph-dim-mid": p.toFixed(3),
      "--iba-ph-dim-bot": Math.min(0.95, p * 1.2).toFixed(3)
    };
  }
  function apply(v) {
    const r = document.documentElement.style;
    const l = layers(v);
    Object.keys(l).forEach(function (k) { r.setProperty(k, l[k]); });
  }

  let saved = load();   // what everyone has
  let shown = { desktop: saved.desktop, phone: saved.phone }; // what the sliders show
  apply(saved);

  function isSuper() { return !!(document.body && document.body.classList.contains("iba-is-super-admin")); }
  function mainDb() { try { return (typeof db !== "undefined" && db && typeof db.ref === "function") ? db : null; } catch (_) { return null; } }

  // ---------------- Firebase: same place as the photos ----------------
  let watching = false;
  function watch() {
    if (watching) return true;
    const d = mainDb();
    if (!d) return false;
    watching = true;
    try {
      d.ref(PATH).on("value", function (snap) {
        const v = (snap && snap.val()) || {};
        const next = { desktop: clamp(v.dim_desktop, DEF.desktop), phone: clamp(v.dim_phone, DEF.phone) };
        const dirty = shown.desktop !== saved.desktop || shown.phone !== saved.phone;
        saved = next;
        remember(saved);
        if (!dirty) { shown = { desktop: saved.desktop, phone: saved.phone }; apply(saved); }
        paint();
      });
    } catch (_) { watching = false; return false; }
    return true;
  }
  (function tryWatch(n) {
    if (watch() || n > 60) return;
    setTimeout(function () { tryWatch(n + 1); }, 500);
  })(0);

  // ---------------- Settings > Shell Backgrounds ----------------
  function photoOf(group) {
    try {
      const v = localStorage.getItem("iba-shell-bg-" + group);
      if (v && v !== "none") return v;
    } catch (_) {}
    return "";
  }
  function previewBg(kind, v) {
    const l = layers(v);
    if (kind === "desktop") {
      const url = photoOf("workdesk") || PHOTO_BASE + "a.jpg";
      return "linear-gradient(180deg, rgba(8,12,22," + l["--iba-dim-top"] + "), rgba(8,12,22," + l["--iba-dim-bot"] + ")), url(\"" + url + "\") center / cover no-repeat, #0B1220";
    }
    const url = photoOf("phone-invoice") || photoOf("invoice") || PHOTO_BASE + "g.jpg";
    return "linear-gradient(180deg, rgba(8,16,26," + l["--iba-ph-dim-top"] + ") 0%, rgba(8,16,26," + l["--iba-ph-dim-mid"] + ") 45%, rgba(8,16,26," + l["--iba-ph-dim-bot"] + ") 100%), url(\"" + url + "\") center / cover no-repeat, #0B1724";
  }
  function box() { return document.getElementById("iba-dim-box"); }
  function build() {
    const host = document.getElementById("iba-shell-bg-settings");
    if (!host || box()) return !!host;
    const el = document.createElement("div");
    el.id = "iba-dim-box";
    el.className = "iba-dim-box";
    const row = function (kind, label, help) {
      return '<div class="iba-dim-row" data-dim="' + kind + '">' +
        '<div class="iba-dim-prev is-' + kind + '" aria-hidden="true"><span>Aa</span></div>' +
        '<div class="iba-dim-main"><div class="iba-dim-top"><h3>' + label + '</h3><b class="iba-dim-val">0%</b></div>' +
        '<input type="range" min="0" max="' + MAX + '" step="' + STEP + '" aria-label="' + label + ' background dimming">' +
        '<p class="iba-dim-help">' + help + "</p></div></div>";
    };
    el.innerHTML = '<div class="iba-dim-head"><i class="fa-solid fa-circle-half-stroke"></i><div><h3>Background dimming</h3>' +
      "<p>How dark the see-through layer over the photo is. 0% shows the photo as it is; more dimming makes white text easier to read. Applies for everyone after Save.</p></div></div>" +
      row("desktop", "Desktop", "All desktop pages. Default 20% (it was 36%).") +
      row("phone", "Phone", "Phone view. Default 35% (it was 72%).") +
      '<div class="iba-dim-acts"><span class="iba-dim-note"></span>' +
      '<button type="button" class="secondary-btn" data-dim-reset>Default</button>' +
      '<button type="button" class="primary-btn iba-bg-save" data-dim-save>Save</button></div>';
    host.appendChild(el);
    el.addEventListener("input", function (e) {
      const input = e.target.closest("input[type=range]");
      if (!input || !isSuper()) return;
      const kind = input.closest(".iba-dim-row").getAttribute("data-dim");
      shown[kind] = clamp(input.value, shown[kind]);
      apply(shown);
      paint();
    });
    el.addEventListener("click", function (e) {
      if (!isSuper()) return;
      if (e.target.closest("[data-dim-reset]")) {
        shown = { desktop: DEF.desktop, phone: DEF.phone };
        apply(shown);
        paint();
        return;
      }
      if (e.target.closest("[data-dim-save]")) save();
    });
    paint();
    return true;
  }
  function say(text, bad) {
    const n = box() && box().querySelector(".iba-dim-note");
    if (!n) return;
    n.textContent = text || "";
    n.classList.toggle("is-bad", !!bad);
  }
  function paint() {
    const el = box();
    if (!el) return;
    ["desktop", "phone"].forEach(function (kind) {
      const row = el.querySelector('.iba-dim-row[data-dim="' + kind + '"]');
      if (!row) return;
      const input = row.querySelector("input");
      if (document.activeElement !== input) input.value = String(shown[kind]);
      input.disabled = !isSuper();
      row.querySelector(".iba-dim-val").textContent = shown[kind] + "%";
      row.querySelector(".iba-dim-prev").style.background = previewBg(kind, shown);
    });
    const dirty = shown.desktop !== saved.desktop || shown.phone !== saved.phone;
    el.classList.toggle("is-dirty", dirty);
    if (dirty) say("Not saved yet. Only this screen shows it.");
    else if (el.querySelector(".iba-dim-note").textContent.indexOf("Not saved") === 0) say("");
  }
  function save() {
    const v = { desktop: shown.desktop, phone: shown.phone };
    const d = mainDb();
    if (!d) { say("Could not reach Firebase. Try again.", true); return; }
    say("Saving...");
    d.ref(PATH).update({ dim_desktop: v.desktop, dim_phone: v.phone }).then(function () {
      saved = v;
      remember(saved);
      apply(saved);
      paint();
      say("Saved for everyone.");
    }).catch(function () {
      say("Firebase did not accept it. Nothing was changed for others.", true);
    });
  }
  // leaving Settings without saving puts the saved look back
  function revertIfLeft() {
    const el = box();
    if (!el) return;
    const visible = el.offsetParent !== null;
    if (!visible && (shown.desktop !== saved.desktop || shown.phone !== saved.phone)) {
      shown = { desktop: saved.desktop, phone: saved.phone };
      apply(saved);
      paint();
    }
  }
  function start() {
    if (!build()) return;
    // Settings opens and closes as a page; check when the page changes
    document.addEventListener("click", function () { setTimeout(revertIfLeft, 300); }, true);
    // the Super Admin mark arrives after sign-in: enable the sliders then
    try { new MutationObserver(function () { paint(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (_) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.ibaBgDim = {
    get: function () { return { saved: Object.assign({}, saved), shown: Object.assign({}, shown) }; },
    defaults: Object.assign({}, DEF),
    _layers: layers
  };
})();
