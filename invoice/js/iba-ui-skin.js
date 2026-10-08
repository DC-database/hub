/* =============================================================================
   js/iba-ui-skin.js  —  14.0.0 patch 4 (look only)
   (patch 6: drag a wide list sideways; patch 9: frozen headers flush with the
    top of their list)

   Batch Entry cards are built with fixed inline colours (white fields, teal
   header, peach line). Inline "!important" colours cannot be themed from a
   stylesheet, so when a card is added this removes those inline styles once
   and tags each part with a class. css/iba-ui.css then draws the card in the
   dark theme.

   Nothing else changes: same elements, same names, same values, same buttons
   and events. Kept as-is:
     - the hidden Attention <select> holder (it must stay hidden)
     - the red "PO needs close out" dot
     - anything inside a Choices dropdown
   Removing this file (and its <script> line) brings the old card colours back.
   ============================================================================= */
(function () {
  "use strict";

  function keepInline(el) {
    if (!el || !el.matches) return false;
    if (el.matches(".po-closeout-ready-dot, .choices, .choices *")) return true;
    const st = el.getAttribute("style") || "";
    return /visibility\s*:\s*hidden/i.test(st);
  }

  function tagHeaderPart(el) {
    if (!el || el.nodeType !== 1) return;
    const title = el.getAttribute("title") || "";
    if (title === "PO Number") el.classList.add("bc-po");
    else if (title === "Site") el.classList.add("bc-site");
    else if (title === "Vendor") el.classList.add("bc-vendor");
    else if (el.querySelector('input[name="invNumber"]')) el.classList.add("bc-field", "bc-inv");
    else if (el.querySelector(".batch-attention-btn")) el.classList.add("bc-field", "bc-att");
    else if (el.querySelector('select[name="status"]')) el.classList.add("bc-field", "bc-status");
    else if (el.querySelector('input[name="note"]')) el.classList.add("bc-field", "bc-note");
    else if (el.querySelector(".batch-remove-btn")) el.classList.add("bc-remove");
  }

  function skinBatchCard(card) {
    if (!card || card.nodeType !== 1 || !card.classList.contains("batch-invoice-card")) return;
    if (card.dataset.uiSkin === "1") return;
    card.dataset.uiSkin = "1";

    const header = card.querySelector(":scope > .batch-card-header");
    if (header) Array.prototype.forEach.call(header.children, tagHeaderPart);
    card.querySelectorAll(".batch-input-grid > div").forEach(function (el) {
      el.classList.add("bc-field", "bc-f");
    });

    const styled = [card].concat(Array.prototype.slice.call(card.querySelectorAll("[style]")));
    styled.forEach(function (el) {
      if (!el.hasAttribute("style") || keepInline(el)) return;
      // the wrapper of the red close-out dot keeps its small spacing
      if (el.querySelector && el.querySelector(":scope > .po-closeout-ready-dot")) {
        el.setAttribute("style", "margin-bottom:4px;line-height:0;");
        return;
      }
      el.removeAttribute("style");
    });
  }

  function skinAll(root) {
    if (!root) return;
    root.querySelectorAll(".batch-invoice-card").forEach(skinBatchCard);
  }

  function watchBatch() {
    const body = document.getElementById("im-batch-table-body");
    if (!body || body.dataset.uiSkinWatch === "1") return;
    body.dataset.uiSkinWatch = "1";
    skinAll(body);
    const mo = new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.classList.contains("batch-invoice-card")) skinBatchCard(n);
          else skinAll(n);
        });
      });
    });
    mo.observe(body, { childList: true, subtree: true });
  }

  window.ibaSkinBatchCard = skinBatchCard;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchBatch);
  else watchBatch();
})();

/* =============================================================================
   14.0.0 patch 6: drag a wide list sideways (desktop, mouse only)

   Scrollbars are hidden on every screen (css/iba-ui.css 1c). Wheel, trackpad,
   touch and keys still scroll. For a list that is wider than its box, the
   mouse can also hold and drag it left or right.
   - Starts only after the mouse has moved about 6px sideways, so a normal
     click on a row still opens it.
   - Never starts on a field, button, link, dropdown or a popup title bar.
   - The click that ends a drag is ignored, so a row does not open by mistake.
   ============================================================================= */
(function () {
  "use strict";

  const SKIP = "input, select, textarea, button, a, label, option, [contenteditable], [draggable='true'], .choices, .modal-header, .iba-no-drag, #iba-phone";
  const START_PX = 6;
  let drag = null;

  function sidewaysBox(el) {
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.scrollWidth > el.clientWidth + 2) {
        const ox = window.getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function swallowNextClick() {
    const stop = function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      window.removeEventListener("click", stop, true);
    };
    window.addEventListener("click", stop, true);
    setTimeout(function () { window.removeEventListener("click", stop, true); }, 400);
  }

  function finish() {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    document.body.classList.remove("iba-drag-scrolling");
    if (moved) swallowNextClick();
  }

  document.addEventListener("pointerdown", function (e) {
    drag = null;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if (window.innerWidth <= 900) return;
    const t = e.target;
    if (!t || !t.closest || t.closest(SKIP)) return;
    const box = sidewaysBox(t);
    if (!box) return;
    drag = { box: box, id: e.pointerId, x: e.clientX, y: e.clientY, left: box.scrollLeft, moved: false };
  }, true);

  document.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!(e.buttons & 1)) { finish(); return; }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < START_PX) return;
      drag.moved = true;
      document.body.classList.add("iba-drag-scrolling");
      try { window.getSelection().removeAllRanges(); } catch (_) {}
    }
    drag.box.scrollLeft = drag.left - dx;
    e.preventDefault();
  }, true);

  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
  window.addEventListener("blur", finish);
})();

/* -----------------------------------------------------------------------------
   14.0.0 patch 9: frozen column headers sit flush with the top edge of the
   list that scrolls. A scrolling list with inner spacing (padding) would hold
   its header a little below its edge and let rows show above it; the first
   time a list scrolls, its top spacing is noted on it (--iba-sticky-top) and
   css/iba-ui-tables.css lifts the header by that much. Look only.
   ----------------------------------------------------------------------------- */
(function () {
  "use strict";
  // checked when a list starts to scroll (again at most every half second,
  // because one scrolling area can hold different pages)
  const lastCheck = new WeakMap();
  document.addEventListener("scroll", function (e) {
    const box = e.target;
    if (!box || box.nodeType !== 1) return;
    const now = Date.now();
    if (now - (lastCheck.get(box) || 0) < 500) return;
    lastCheck.set(box, now);
    const pad = parseFloat(getComputedStyle(box).paddingTop) || 0;
    const value = (-pad) + "px";
    if (box.style.getPropertyValue("--iba-sticky-top") !== value) box.style.setProperty("--iba-sticky-top", value);
  }, { capture: true, passive: true });
})();

/* 14.0.0 patch 10: Batch Entry "Summary note" list - the type-to-filter box
   at the top of the open list had no hint, so it looked like an empty bar. */
(function () {
  "use strict";
  function hint(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const wrap = t.closest("#im-batch-entry .batch-note-search-wrapper");
    if (!wrap) return;
    const input = wrap.querySelector("input.choices__input");
    if (input && !input.getAttribute("placeholder")) input.setAttribute("placeholder", "Type to filter notes...");
  }
  document.addEventListener("pointerdown", hint, true);
  document.addEventListener("focusin", hint, true);
})();
