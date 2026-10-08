// Inventory Active Job — own DOM IDs. WorkDesk keeps #wd-activetask / #active-task-*.
(function () {
  function bind(kind) {
    // 14.0.0 patch 2: remember the selected tab per page before switching surfaces.
    try { if (window.ibaSurfaces) window.ibaSurfaces.switchTaskSurface(kind); } catch (_) {}
    const inv = kind === "inventory";
    const table = document.getElementById(inv ? "inv-active-job-table-body" : "active-task-table-body");
    const filters = document.getElementById(inv ? "inv-active-job-filters" : "active-task-filters");
    const search = document.getElementById(inv ? "inv-active-job-search" : "active-task-search");
    const count = document.getElementById(inv ? "inv-active-job-count-display" : "active-task-count-display");
    const clearBtn = document.getElementById(inv ? "inv-active-job-clear-button" : "active-task-clear-button");
    try {
      if (table) activeTaskTableBody = table;
      if (filters) activeTaskFilters = filters;
      if (search) activeTaskSearchInput = search;
      if (count) activeTaskCountDisplay = count;
      if (clearBtn) activeTaskClearButton = clearBtn;
    } catch (e) {
      console.warn("ibaBindTaskSurface: active-task refs are not rebindable", e);
    }
  }

  function taskRoot() {
    if (typeof isInventoryContext === "function" && isInventoryContext()) {
      return document.getElementById("inv-active-job") || document.getElementById("wd-activetask");
    }
    return document.getElementById("wd-activetask");
  }

  function bindInventoryControls() {
    const search = document.getElementById("inv-active-job-search");
    const filters = document.getElementById("inv-active-job-filters");
    const clearBtn = document.getElementById("inv-active-job-clear-button");
    if (search && search.dataset.ibaBound !== "1") {
      search.dataset.ibaBound = "1";
      const run = (typeof debounce === "function")
        ? debounce((e) => handleActiveTaskSearch(e.target.value), 500)
        : (e) => handleActiveTaskSearch(e.target.value);
      search.addEventListener("input", run);
    }
    if (filters && filters.dataset.ibaBound !== "1") {
      filters.dataset.ibaBound = "1";
      filters.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const currentActive = filters.querySelector(".active");
        if (currentActive) currentActive.classList.remove("active");
        btn.classList.add("active");
        currentActiveTaskFilter = btn.dataset.statusFilter;
        if (typeof handleActiveTaskSearch === "function") handleActiveTaskSearch(search ? search.value : "");
      });
    }
    if (clearBtn && clearBtn.dataset.ibaBound !== "1") {
      clearBtn.dataset.ibaBound = "1";
      clearBtn.addEventListener("click", () => {
        if (search) search.value = "";
        // 14.0.0 patch 2: Clear on Active Job clears only Active Job's saved search.
        try { if (window.ibaSurfaces) window.ibaSurfaces.clearSearch("activeTask", "inventory"); else sessionStorage.removeItem("activeTaskSearch"); } catch (_) {}
        if (typeof handleActiveTaskSearch === "function") handleActiveTaskSearch("");
      });
    }
  }

  window.ibaBindTaskSurface = bind;
  window.ibaActiveTaskRoot = taskRoot;
  window.ibaActiveJobStage = window.ibaActiveJobStage || "";

  const TYPE_ORDER = ["Transfer", "Restock", "Return", "Usage"];

  function typeSlug(name) {
    return String(name || "transfer").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function ensureFolder() {
    let folder = document.getElementById("iba-aj-folder");
    if (folder) return folder;
    const host = document.getElementById("inv-active-job");
    const filters = document.getElementById("inv-active-job-filters");
    if (!host) return null;
    folder = document.createElement("div");
    folder.id = "iba-aj-folder";
    folder.className = "iba-aj-folder";
    folder.innerHTML = '<div id="iba-aj-tabs" class="iba-aj-tabs"></div><div id="iba-aj-stage" class="iba-aj-stage"></div>';
    if (filters && filters.parentNode === host) host.insertBefore(folder, filters);
    else host.insertBefore(folder, host.querySelector(".table-wrapper"));
    folder.addEventListener("click", function (event) {
      const typeBtn = event.target.closest("[data-iba-aj-type]");
      const stageBtn = event.target.closest("[data-iba-aj-stage]");
      const search = document.getElementById("inv-active-job-search");
      if (typeBtn) {
        try { currentActiveTaskFilter = typeBtn.getAttribute("data-iba-aj-type") || "Transfer"; } catch (_) {}
        if (typeof handleActiveTaskSearch === "function") handleActiveTaskSearch(search ? search.value : "");
        return;
      }
      if (stageBtn) {
        window.ibaActiveJobStage = stageBtn.getAttribute("data-iba-aj-stage") === "multi" ? "multi" : "single";
        if (typeof handleActiveTaskSearch === "function") handleActiveTaskSearch(search ? search.value : "");
      }
    });
    return folder;
  }

  window.ibaPaintActiveJobFolder = function (info) {
    const folder = ensureFolder();
    if (!folder || !info) return;
    const tasks = Array.isArray(info.tasks) ? info.tasks : [];
    const present = TYPE_ORDER.filter(function (type) {
      return tasks.some(function (task) { return task && task.for === type; });
    });
    const types = present.length ? present : ["Transfer"];
    const type = types.indexOf(info.type) >= 0 ? info.type : types[0];
    const stage = info.stage === "multi" ? "multi" : "single";
    const slug = typeSlug(type);
    folder.className = "iba-aj-folder iba-aj-tone-" + slug;
    const tabs = document.getElementById("iba-aj-tabs");
    const stageEl = document.getElementById("iba-aj-stage");
    if (tabs) {
      tabs.innerHTML = types.map(function (name) {
        return '<button type="button" class="iba-aj-tab iba-aj-tone-' + typeSlug(name) + (name === type ? " is-on" : "") + '" data-iba-aj-type="' + name + '">' + name + "</button>";
      }).join("");
    }
    if (stageEl) {
      stageEl.className = "iba-aj-stage iba-aj-tone-" + slug;
      stageEl.innerHTML =
        '<button type="button" class="iba-aj-stage-btn' + (stage === "single" ? " is-on" : "") + '" data-iba-aj-stage="single">Single <b>' + Number(info.singleCount || 0) + "</b></button>" +
        '<span class="iba-aj-stage-line" aria-hidden="true"></span>' +
        '<button type="button" class="iba-aj-stage-btn' + (stage === "multi" ? " is-on" : "") + '" data-iba-aj-stage="multi">Multi <b>' + Number(info.multiCount || 0) + "</b></button>";
    }
  };

  function bindActiveJobFrost() {
    if (document.documentElement.dataset.ibaAjFrost === "1") return;
    document.documentElement.dataset.ibaAjFrost = "1";
    let current = null;
    function rowFrom(el) {
      if (!el || !el.closest) return null;
      const tr = el.closest("#inv-active-job tbody tr");
      if (!tr || tr.querySelector("td[colspan]")) return null;
      return tr;
    }
    function show(tr) {
      const table = tr.closest("table");
      const parent = table && table.parentElement;
      if (!parent) return;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      let bar = parent.querySelector(":scope > .iba-aj-row-frost");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "iba-aj-row-frost";
        parent.insertBefore(bar, table);
      }
      const pr = parent.getBoundingClientRect();
      const rr = tr.getBoundingClientRect();
      const tl = table.getBoundingClientRect();
      bar.style.display = "block";
      bar.style.top = (rr.top - pr.top + parent.scrollTop) + "px";
      bar.style.height = rr.height + "px";
      bar.style.left = (tl.left - pr.left + parent.scrollLeft) + "px";
      bar.style.width = table.offsetWidth + "px";
    }
    function hide(tr) {
      const table = tr && tr.closest("table");
      const bar = table && table.parentElement && table.parentElement.querySelector(":scope > .iba-aj-row-frost");
      if (bar) bar.style.display = "none";
    }
    document.addEventListener("mouseover", function (event) {
      const tr = rowFrom(event.target);
      if (tr === current) return;
      if (current) hide(current);
      current = tr;
      if (current) show(current);
    }, true);
    document.addEventListener("mouseout", function (event) {
      if (!current) return;
      if (rowFrom(event.relatedTarget) === current) return;
      hide(current);
      current = null;
    }, true);
  }

  function bindInventoryAction() {
    const body = document.getElementById("inv-active-job-table-body");
    if (!body || body.dataset.ibaActionBound === "1") return;
    body.dataset.ibaActionBound = "1";
    body.addEventListener("click", async function (event) {
      const btn = event.target.closest(".transfer-action-btn");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const key = btn.getAttribute("data-key");
      const list = (typeof userActiveTasks !== "undefined" && Array.isArray(userActiveTasks)) ? userActiveTasks : [];
      const task = list.find(function (item) { return item && item.key === key; });
      if (task && typeof window.openTransferActionModal === "function") {
        await window.openTransferActionModal(task);
        return;
      }
      alert(task ? "Transfer Logic script not loaded." : "Task not found. Please refresh.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindInventoryControls();
      bindInventoryAction();
    });
  } else {
    bindInventoryControls();
    bindInventoryAction();
  }
  // 14.0.0 patch 4: row hover now comes from css/iba-ui.css (same on every list).
})();

