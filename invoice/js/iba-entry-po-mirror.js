/* ==========================================================================
   IBA 14.0.0 patch 10 - Invoice Entry: PO field fills the Active Jobs search
   --------------------------------------------------------------------------
   - Typing a PO in the Invoice Entry popup's "Search PO..." field (or the
     page's top PO field) also types it in the side panel's Active Jobs
     search, so the list narrows to that PO without typing it twice.
   - Only typing does this. Opening a job from the list, or a search started
     from a task, leaves the list as it is, so the next job can still be
     picked from the full list.
   - Emptying the PO field (or the page Clear button) empties the side
     panel search again, but only when the side search still holds the PO
     that was copied there; anything typed in the side panel itself is left.
   - When the cursor comes back to the empty PO field (after Add, Update or
     Clear) the copied PO is taken out of the side search, so the full list
     is there for the next job. If the field still holds a PO, it is
     selected, so the next PO can be typed straight over it.
   - Jobs whose PO matches exactly are marked so they stand out.
   No saving, searching or access rules are changed.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__ibaPoMirror) return;
  window.__ibaPoMirror = true;

  const FIELD_IDS = ["im-po-search-input-bottom", "im-po-search-input"];
  let lastMirror = "";
  let timer = 0;
  let pointerField = null;
  let pointerAt = 0;

  function sideBox() { return document.getElementById("im-sidebar-search"); }

  function sideLoaded() {
    try { return typeof imIsActiveJobsSidebarLoaded === "function" ? imIsActiveJobsSidebarLoaded() : true; }
    catch (_) { return true; }
  }

  function markExact(term) {
    const want = String(term || "").trim().toUpperCase();
    document.querySelectorAll("#im-entry-sidebar-list .im-sidebar-item").forEach(function (item) {
      const hit = !!want && String(item.dataset.po || "").trim().toUpperCase() === want;
      if (item.classList.contains("iba-po-hit") !== hit) item.classList.toggle("iba-po-hit", hit);
    });
  }

  function runFilter(term) {
    try { if (typeof filterActiveJobsSidebarItems === "function") filterActiveJobsSidebarItems(term); } catch (_) {}
    markExact(term);
  }

  function mirror(value) {
    const box = sideBox();
    if (!box) return;
    const term = String(value || "").trim();
    if (!term) {
      // Only undo what was copied here; leave the user's own side search.
      if (lastMirror && box.value.trim() === lastMirror) {
        box.value = "";
        lastMirror = "";
        runFilter("");
      }
      return;
    }
    box.value = term;
    lastMirror = term;
    if (!sideLoaded() && typeof populateActiveJobsSidebar === "function") {
      // The list applies the side search itself once it has loaded.
      Promise.resolve(populateActiveJobsSidebar(false)).then(function () { markExact(sideBox() && sideBox().value); }).catch(function () {});
      return;
    }
    runFilter(term);
  }

  function schedule(value) {
    clearTimeout(timer);
    timer = setTimeout(function () { mirror(value); }, 140);
  }

  function wireField(field) {
    if (!field || field.__ibaPoMirror) return;
    field.__ibaPoMirror = true;
    field.addEventListener("input", function (e) {
      if (!e.isTrusted) return;
      schedule(field.value);
    });
    field.addEventListener("pointerdown", function () { pointerField = field; pointerAt = Date.now(); }, true);
    field.addEventListener("focus", function () {
      // Back in an empty PO field (the form is cleared after Add / Update /
      // Clear): the job just worked on is done, so show the full list again.
      if (!field.value.trim()) { mirror(""); return; }
      // A click places the cursor where the user clicked. Any other way in
      // (the automatic move, or Tab) selects the old PO so the next one can
      // be typed straight over it.
      if (pointerField === field && Date.now() - pointerAt < 600) return;
      setTimeout(function () {
        if (document.activeElement === field) { try { field.select(); } catch (_) {} }
      }, 0);
    });
  }

  function wire() {
    FIELD_IDS.forEach(function (id) { wireField(document.getElementById(id)); });
    const side = sideBox();
    if (side && !side.__ibaPoMirror) {
      side.__ibaPoMirror = true;
      // Typing in the side panel itself: that text is now the user's own.
      side.addEventListener("input", function (e) {
        if (!e.isTrusted) return;
        lastMirror = "";
        markExact(side.value);
      });
    }
    // Page Clear button empties both PO fields without an input event.
    const clearBtn = document.getElementById("im-po-clear-button");
    if (clearBtn && !clearBtn.__ibaPoMirror) {
      clearBtn.__ibaPoMirror = true;
      clearBtn.addEventListener("click", function () { setTimeout(function () { mirror(""); }, 0); });
    }
    // Keep the exact-PO mark after the list is drawn again.
    const list = document.getElementById("im-entry-sidebar-list");
    if (list && !list.__ibaPoMirror && typeof MutationObserver !== "undefined") {
      list.__ibaPoMirror = true;
      let queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          const box = sideBox();
          const term = box ? box.value : "";
          if (term && term.trim()) markExact(term);
        });
      }).observe(list, { childList: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  window.ibaPoMirror = { mirror: mirror, last: function () { return lastMirror; } };
})();
