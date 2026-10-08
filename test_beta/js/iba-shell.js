// IBA 12.9.3 shell: analog clock + date, unified nav, dashboard left-stack focus.
(function () {
  const PHOTO_BASE = "https://raw.githubusercontent.com/DC-database/hub/main/photo/";
  const PHOTO_FILES = ["a.jpg","b.jpg","c.jpg","d.jpg","e.jpg","f.jpg","g.jpg","h.jpg","i.jpg","j.jpg","k.jpg","l.jpg","m.jpg"];
  const GROUPS = ["workdesk", "inventory", "invoice", "login"];
  const DEFAULTS = {
    workdesk: PHOTO_BASE + "a.jpg",
    inventory: PHOTO_BASE + "e.jpg",
    invoice: PHOTO_BASE + "g.jpg",
    login: PHOTO_BASE + "d.jpg"
  };

  function $(id) { return document.getElementById(id); }

  function bgKey(group) { return "iba-shell-bg-" + group; }

  function storedBg(group) {
    try {
      const v = localStorage.getItem(bgKey(group));
      if (v) return v;
      if (group === "workdesk") {
        const legacy = localStorage.getItem("iba-shell-background");
        if (legacy) return legacy;
      }
    } catch (_) {}
    return DEFAULTS[group] || DEFAULTS.workdesk;
  }

  function currentGroup() {
    const m = String(window.__ibaActiveModule || "").toLowerCase();
    if (m === "inventory") return "inventory";
    if (m === "invoice" || m === "invoice-management") return "invoice";
    if (m === "login" || m === "home") return "login";
    return "workdesk";
  }

  function paintLayer(src) {
    const layer = $("iba-bg-layer");
    const onShell = document.body.classList.contains("iba-shell-on");
    if (layer) {
      if (onShell) {
        layer.style.display = "block";
        layer.style.backgroundImage = 'url("' + src + '")';
      } else {
        layer.style.backgroundImage = "";
        layer.style.display = "none";
      }
    }
    document.documentElement.style.setProperty("--iba-shell-bg", 'url("' + src + '")');
    document.body.style.backgroundImage = 'url("' + src + '")';
  }

  function applyGroupBackground(group, url) {
    const g = GROUPS.indexOf(group) >= 0 ? group : currentGroup();
    if (url) {
      try { localStorage.setItem(bgKey(g), url); } catch (_) {}
    }
    const src = storedBg(g);
    const onShell = document.body.classList.contains("iba-shell-on");
    if (g === "login") {
      document.documentElement.style.setProperty("--iba-login-bg", 'url("' + src + '")');
      if (!onShell) {
        document.body.style.backgroundImage = 'url("' + src + '")';
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center center";
        const layer = $("iba-bg-layer");
        if (layer) {
          layer.style.display = "block";
          layer.style.backgroundImage = 'url("' + src + '")';
          layer.style.backgroundSize = "cover";
          layer.style.backgroundPosition = "center center";
        }
      }
    }
    if (onShell && g === currentGroup()) paintLayer(src);
  }

  function applyBackground() {
    GROUPS.forEach(function (g) {
      const src = storedBg(g);
      if (g === "login") document.documentElement.style.setProperty("--iba-login-bg", 'url("' + src + '")');
    });
    if (document.body.classList.contains("iba-shell-on")) paintLayer(storedBg(currentGroup()));
    else {
      const src = storedBg("login");
      document.documentElement.style.setProperty("--iba-login-bg", 'url("' + src + '")');
      document.body.style.backgroundImage = 'url("' + src + '")';
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center center";
      const layer = $("iba-bg-layer");
      if (layer) {
        layer.style.display = "block";
        layer.style.backgroundImage = 'url("' + src + '")';
        layer.style.backgroundSize = "cover";
        layer.style.backgroundPosition = "center center";
      }
    }
  }

  function isIrwin() {
    const superName = String(typeof SUPER_ADMIN_NAME !== "undefined" ? SUPER_ADMIN_NAME : "Irwin").trim().toLowerCase();
    const candidates = [
      window.currentApprover && (window.currentApprover.Name || window.currentApprover.name),
      typeof currentApprover !== "undefined" && currentApprover && (currentApprover.Name || currentApprover.name),
      window.currentUser && (window.currentUser.username || window.currentUser.Name),
      $("settings-name") && $("settings-name").value,
      $("iba-shell-username") && $("iba-shell-username").textContent
    ];
    return candidates.some(function (n) { return String(n || "").trim().toLowerCase() === superName; });
  }

  function tickClock() {
    const now = new Date();
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const hourEl = $("iba-clock-hour");
    const minEl = $("iba-clock-minute");
    const secEl = $("iba-clock-second");
    if (hourEl) hourEl.style.transform = "rotate(" + (h * 30 + m * 0.5) + "deg)";
    if (minEl) minEl.style.transform = "rotate(" + (m * 6) + "deg)";
    if (secEl) secEl.style.transform = "rotate(" + (s * 6) + "deg)";
    const dateEl = $("iba-shell-date");
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-GB", {
        weekday: "short", day: "2-digit", month: "short", year: "numeric"
      });
    }
  }

  function resolveUserName() {
    const list = [
      window.currentApprover && (window.currentApprover.Name || window.currentApprover.name),
      typeof currentApprover !== "undefined" && currentApprover && (currentApprover.Name || currentApprover.name),
      window.currentUser && (window.currentUser.Name || window.currentUser.username),
      $("settings-name") && $("settings-name").value,
      $("dashboard-username") && $("dashboard-username").textContent,
      $("welcome-person-name") && $("welcome-person-name").textContent
    ];
    for (let i = 0; i < list.length; i++) {
      const s = String(list[i] || "").trim();
      if (s && s.toLowerCase() !== "user") return s;
    }
    return "";
  }

  function paintUsername() {
    const el = $("iba-shell-username");
    if (!el) return;
    const name = resolveUserName();
    if (name) el.textContent = name;
    applyShellAccess();
  }

  function shellAccessMap() {
    const user = window.currentApprover || (typeof currentApprover !== "undefined" ? currentApprover : null) || null;
    const name = String(user && (user.Name || user.name) || "").trim().toLowerCase();
    const role = String(user && (user.Role || user.role) || "").trim().toLowerCase();
    const pos = String(user && (user.Position || user.position) || "").trim().toLowerCase();
    const superName = String(typeof SUPER_ADMIN_NAME !== "undefined" ? SUPER_ADMIN_NAME : "Irwin").trim().toLowerCase();
    const isSuper = !!(name && name === superName);
    const isAdmin = role === "admin";
    let vacation = false;
    try { vacation = typeof isVacationDelegateUser === "function" && !!isVacationDelegateUser(); } catch (_) {}
    const tokens = pos.split(/[^a-z0-9]+/).filter(Boolean);
    const finance = tokens.some(function (t) { return ["finance", "accounts", "accounting", "ceo", "coo"].indexOf(t) >= 0; });
    const epicorePos = tokens.some(function (t) { return ["finance", "accounts", "accounting", "ceo", "coo", "qs", "seniorqs"].indexOf(t) >= 0; });
    const payments = (typeof canCurrentUserAccessPayments === "function")
      ? !!canCurrentUserAccessPayments()
      : (isSuper || (isAdmin && tokens.some(function (t) { return ["finance", "accounts", "accounting"].indexOf(t) >= 0; })));
    return {
      "im-invoice-entry": isSuper,
      "im-batch-entry": isSuper,
      "im-summary-note": isSuper,
      "im-po-closeout": isSuper,
      "im-reporting": isAdmin || isSuper || vacation,
      "im-payments": payments,
      "epicore": isSuper || vacation || (isAdmin && epicorePos),
      "finance-report": isSuper || (isAdmin && finance),
      "po-system": isSuper
    };
  }

  function firstAllowedImPage() {
    const root = document.querySelector("#iba-app-shell [data-iba-im-root]");
    if (!root) return "";
    const order = ["im-invoice-entry", "im-batch-entry", "im-summary-note", "im-reporting", "im-payments", "im-po-closeout"];
    for (let i = 0; i < order.length; i++) {
      const el = root.querySelector('[data-iba-nav="' + order[i] + '"]');
      const li = el && el.closest("li");
      if (li && li.style.display !== "none") return order[i];
    }
    return "";
  }

  function applyShellAccess() {
    const map = shellAccessMap();
    document.querySelectorAll("#iba-app-shell [data-iba-nav]").forEach(function (el) {
      const key = el.getAttribute("data-iba-nav");
      if (!Object.prototype.hasOwnProperty.call(map, key)) return;
      const li = el.closest("li") || el;
      li.style.display = map[key] ? "" : "none";
    });
    document.querySelectorAll("#iba-app-shell [data-iba-im-branch], #iba-app-shell [data-iba-im-root]").forEach(function (group) {
      const items = group.querySelectorAll(":scope > ul > li");
      const any = Array.from(items).some(function (li) { return li.style.display !== "none"; });
      group.style.display = any ? "" : "none";
    });
    const park = document.querySelector('#iba-dash-stack [data-iba-sys="im"]');
    if (park) {
      const first = firstAllowedImPage();
      park.style.display = first ? "" : "none";
      if (first) park.setAttribute("data-iba-dash-park", first);
    }
  }

  function stripSearchChrome(sectionId) {
    const root = $(sectionId);
    if (!root) return;
    root.querySelectorAll(".wd-premium-searchbar, .search-and-filter-group, .wd-search-field, .search-bar-local").forEach(function (el) {
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("border", "0", "important");
      el.style.setProperty("padding", "0", "important");
    });
    // 14.0.0 patch 3: the search field colours now come from css/iba-ui.css
    // (glass field, gold focus ring), so no inline white background here.
  }

  function placeJobOtherField() {
    const other = $("job-other-specify");
    const jobFor = $("job-for");
    if (!other || !jobFor) return;
    const typeGroup = jobFor.closest(".form-group");
    if (!typeGroup || !typeGroup.parentNode) return;
    if (other.parentNode !== typeGroup.parentNode || other.previousElementSibling !== typeGroup) {
      typeGroup.parentNode.insertBefore(other, typeGroup.nextSibling);
    }
  }

  function unlockJobDropdowns() {
    const modal = $("standard-job-modal");
    if (!modal) return;
    const nodes = [modal];
    modal.querySelectorAll(".transfer-2col-grid, .transfer-col, .form-group, .choices").forEach(function (el) { nodes.push(el); });
    nodes.forEach(function (el) {
      el.style.setProperty("overflow", "visible", "important");
    });
    // 14.0.0 patch 6: the form scrolls inside its panel (Add / Clear / Cancel stay
    // in view on short screens). The page's lists are plain selects now, so the
    // panel and its body no longer need to spill over.
    modal.querySelectorAll(".modal-container, .modal-content").forEach(function (el) {
      el.style.removeProperty("overflow");
    });
  }

  function copyChoicesToSelect(instance, selectEl) {
    if (!instance || !selectEl || !instance._store) return false;
    const list = instance._store.choices || [];
    if (!list.length) return false;
    const cur = selectEl.value;
    selectEl.innerHTML = "";
    list.forEach(function (c) {
      if (!c || c.placeholder) return;
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = c.label || c.value;
      opt.disabled = !!c.disabled;
      selectEl.appendChild(opt);
    });
    if (cur) selectEl.value = cur;
    return selectEl.options.length > 1;
  }

  function paintNativeJobSelects() {
    const siteEl = $("job-site");
    if (siteEl) {
      let filled = false;
      try {
        if (typeof allSitesCSVData !== "undefined" && allSitesCSVData && allSitesCSVData.length) {
          siteEl.innerHTML = "";
          const first = document.createElement("option");
          first.value = "";
          first.textContent = "Select a Site";
          siteEl.appendChild(first);
          allSitesCSVData.forEach(function (site) {
            if (!site || !site.site) return;
            const opt = document.createElement("option");
            opt.value = site.site;
            opt.textContent = site.description ? (site.site + " - " + site.description) : String(site.site);
            siteEl.appendChild(opt);
          });
          filled = siteEl.options.length > 1;
        }
      } catch (_) {}
      if (!filled) {
        try { copyChoicesToSelect(siteSelectChoices, siteEl); } catch (_) {}
      }
    }
    const attEl = $("job-attention");
    if (attEl) {
      let filled = false;
      try { filled = copyChoicesToSelect(attentionSelectChoices, attEl); } catch (_) {}
      if (!filled) {
        try {
          const cache = (typeof allApproverDataCache !== "undefined") ? allApproverDataCache : null;
          const rows = cache && (Array.isArray(cache) ? cache : Object.values(cache));
          if (rows && rows.length) {
            attEl.innerHTML = "";
            const first = document.createElement("option");
            first.value = "";
            first.textContent = "Select Attention";
            attEl.appendChild(first);
            rows.forEach(function (p) {
              const name = (p && (p.Name || p.name)) || "";
              if (!name) return;
              const opt = document.createElement("option");
              opt.value = name;
              opt.textContent = name;
              attEl.appendChild(opt);
            });
          }
        } catch (_) {}
      }
    }
  }

  function refillJobDropdowns() {
    try {
      if (typeof populateSiteDropdown === "function") {
        const p = populateSiteDropdown();
        if (p && typeof p.then === "function") p.then(paintNativeJobSelects).catch(function () { paintNativeJobSelects(); });
      }
    } catch (_) {}
    try {
      if (typeof populateAttentionDropdown === "function" && typeof attentionSelectChoices !== "undefined" && attentionSelectChoices) {
        const p = populateAttentionDropdown(attentionSelectChoices);
        if (p && typeof p.then === "function") p.then(paintNativeJobSelects).catch(function () { paintNativeJobSelects(); });
      }
    } catch (_) {}
    paintNativeJobSelects();
    setTimeout(paintNativeJobSelects, 400);
    setTimeout(paintNativeJobSelects, 1200);
  }

  function portJobChoicesDropdown(select, show) {
    return;
  }

  let dashFocusPinnedWas = null;
  let dashFocusSection = "";
  let dashFocusStatus = "";
  let dashFocusPay = "";

  function resolveFocusCard() {
    const cards = document.querySelectorAll("#wd-active-dashboard-cards .wd-active-status-card");
    if (dashFocusStatus) {
      const live = Array.prototype.find.call(cards, function (el) {
        if ((el.getAttribute("data-status") || "") !== dashFocusStatus) return false;
        if (!dashFocusPay) return true;
        return (el.getAttribute("data-payment-view") || "") === dashFocusPay;
      });
      if (live) return live;
    }
    const section = dashSections().find(function (s) { return s.id === dashFocusSection; });
    if (section) {
      const direct = section.el.querySelector(".wd-active-status-card.active:not(.wd-search-category-match)");
      if (direct) return direct;
      const any = section.el.querySelector(".wd-active-status-card.active");
      if (any) return any;
      const first = section.el.querySelector(".wd-active-status-card");
      if (first) return first;
    }
    return document.querySelector("#wd-active-dashboard-cards .wd-active-status-card.active");
  }

  function rememberFocusCard(card) {
    if (!card) return;
    dashFocusStatus = card.getAttribute("data-status") || "";
    dashFocusPay = card.getAttribute("data-payment-view") || "";
  }

  function dashSections() {
    return [
      { id: "person", el: document.querySelector("#wd-active-dashboard-cards .wd-dashboard-person-section"), label: "My tasks" },
      { id: "01", el: document.querySelector("#wd-active-dashboard-cards .wd-preliminary-section"), label: "1 Preliminary" },
      { id: "02", el: document.querySelector("#wd-active-dashboard-cards .wd-approval-section"), label: "2 Approval" },
      { id: "03", el: document.querySelector("#wd-active-dashboard-cards .wd-finance-section"), label: "3 Finance" }
    ].filter(function (s) { return s.el; });
  }

  function dashSectionIcon(id) {
    if (id === "person") return "fa-regular fa-user";
    if (id === "01") return "fa-solid fa-house";
    if (id === "02") return "fa-regular fa-file-lines";
    return "fa-solid fa-database";
  }

  function dashMiniIcon(name) {
    const n = String(name || "").toLowerCase();
    if (n.indexOf("srv") >= 0) return "fa-regular fa-star";
    if (n.indexOf("new") >= 0 || n.indexOf("entry") >= 0) return "fa-regular fa-file";
    if (n.indexOf("pending") >= 0) return "fa-regular fa-clock";
    if (n.indexOf("hold") >= 0) return "fa-solid fa-pause";
    if (n.indexOf("ipc") >= 0) return "fa-solid fa-layer-group";
    if (n.indexOf("approval") >= 0 || n.indexOf("ceo") >= 0) return "fa-solid fa-user-check";
    if (n.indexOf("summary") >= 0) return "fa-solid fa-book";
    if (n.indexOf("process") >= 0) return "fa-solid fa-gears";
    if (n.indexOf("report") >= 0) return "fa-solid fa-chart-column";
    if (n.indexOf("paid") >= 0 || n.indexOf("history") >= 0) return "fa-solid fa-clock-rotate-left";
    if (n.indexOf("account") >= 0 || n.indexOf("payment") >= 0) return "fa-solid fa-wallet";
    return "fa-regular fa-circle";
  }

  function syncDashStack(opts) {
    const keepSection = !!(opts && opts.keepSection);
    const layers = $("iba-dash-layers");
    const cardsBox = $("iba-dash-front-cards");
    const stack = $("iba-dash-stack");
    let hero = $("iba-dash-hero");
    if (!layers || !cardsBox || !stack) return;
    if (!hero) {
      hero = document.createElement("div");
      hero.id = "iba-dash-hero";
      hero.className = "iba-dash-hero";
      stack.insertBefore(hero, cardsBox);
    }
    if (layers.parentNode !== stack) {
      stack.insertBefore(layers, hero);
    }
    const activeCard = resolveFocusCard();
    if (!activeCard) {
      if (!(document.body.classList.contains("iba-dash-focus") && dashFocusSection)) {
        exitDashFocus();
      }
      return;
    }
    const sections = dashSections();
    const activeSection = sections.find(function (s) { return s.el.contains(activeCard); }) || sections[0];
    if (!keepSection || !dashFocusSection) dashFocusSection = (activeSection && activeSection.id) || dashFocusSection;
    const showSection = sections.find(function (s) { return s.id === dashFocusSection; }) || activeSection;
    const frontLabel = (activeCard.getAttribute("data-dashboard-label") || (showSection && showSection.label) || "My personal tasks").trim();
    const tag = (showSection && showSection.id === "person") ? "Personal" : ((showSection && showSection.label) || "").replace(/^\d+\s*/, "");
    layers.innerHTML = "";
    layers.style.removeProperty("height");
    const peek = sections.filter(function (s) { return !(showSection && s.id === showSection.id); });
    peek.forEach(function (s) {
      const rail = document.createElement("button");
      rail.type = "button";
      rail.className = "iba-dash-rail";
      rail.setAttribute("data-iba-dash-rail", s.id);
      rail.innerHTML = '<i class="' + dashSectionIcon(s.id) + '"></i><span></span>';
      rail.querySelector("span").textContent = s.label.replace(/^\d+\s*/, "");
      layers.appendChild(rail);
    });
    hero.innerHTML = '<span class="iba-dash-hero-ico"><i class="' + dashSectionIcon((showSection && showSection.id) || "person") + '"></i></span><span class="iba-dash-hero-copy"><small>WELCOME</small><strong></strong><em></em></span>';
    hero.querySelector("strong").textContent = frontLabel;
    hero.querySelector("em").textContent = tag;
    cardsBox.innerHTML = "";
    if (showSection) {
      const group = document.createElement("div");
      group.className = "iba-dash-section-label";
      group.textContent = showSection.id === "person" ? "MY ENTRY" : tag.toUpperCase();
      cardsBox.appendChild(group);
      const q = String(($("wd-active-dashboard-search") || {}).value || "").trim();
      const selectedStatus = activeCard.getAttribute("data-status") || "";
      const selectedPay = activeCard.getAttribute("data-payment-view") || "";
      const foundTitles = [];
      showSection.el.querySelectorAll(".wd-active-status-card").forEach(function (card) {
        if (q) {
          const sectionHasHit = !!showSection.el.querySelector(".wd-search-category-match");
          if (sectionHasHit && !card.classList.contains("wd-search-category-match")) return;
        }
        const status = card.getAttribute("data-status") || "";
        const pay = card.getAttribute("data-payment-view") || "";
        const em = card.querySelector("em");
        const title = ((em && em.textContent.trim()) || card.getAttribute("data-dashboard-label") || "Card").replace(/\s+\d+\s*$/, "");
        const btn = document.createElement("button");
        btn.type = "button";
        const isCurrent = status === selectedStatus && pay === selectedPay;
        const isFound = !!(q && card.classList.contains("wd-search-category-match") && !isCurrent);
        btn.className = "iba-dash-mini" + (isCurrent ? " is-active" : "") + (isFound ? " iba-dash-found" : "");
        if (isFound) foundTitles.push(title);
        btn.setAttribute("data-iba-mini-status", status);
        if (pay) btn.setAttribute("data-iba-mini-pay", pay);
        btn.innerHTML = '<i class="' + dashMiniIcon(title) + '"></i><span></span>';
        btn.querySelector("span").textContent = title;
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          let sel = '#wd-active-dashboard-cards .wd-active-status-card[data-status="' + status.replace(/"/g, "") + '"]';
          if (pay) sel += '[data-payment-view="' + pay.replace(/"/g, "") + '"]';
          const live = document.querySelector(sel);
          if (!live) return;
          rememberFocusCard(live);
          live.click();
        });
        cardsBox.appendChild(btn);
      });
      if (foundTitles.length) {
        const note = document.createElement("div");
        note.className = "iba-dash-found-note";
        note.textContent = "Found in " + foundTitles.join(", ");
        const firstMini = cardsBox.querySelector(".iba-dash-mini");
        if (firstMini) cardsBox.insertBefore(note, firstMini);
        else cardsBox.appendChild(note);
      }
    }
    const label = (activeCard.getAttribute("data-dashboard-label") || "").trim();
    if (window.__ibaNavKey === "wd-dashboard") setTitle("WorkDesk", label || "Dashboard");
    stack.hidden = false;
    blinkDashSearchRails();
    setTimeout(blinkDashSearchRails, 60);
  }

    function blinkDashSearchRails() {
    const q = String(($("wd-active-dashboard-search") || {}).value || "").trim().toLowerCase();
    document.querySelectorAll(".iba-dash-rail").forEach(function (rail) {
      rail.classList.remove("iba-dash-blink");
    });
    if (!q || q.length < 2) return;

    const payHit = typeof wdGlobalPaymentSearchHasMatch === "function" && (
      wdGlobalPaymentSearchHasMatch(q) ||
      (typeof wdDashboardSearchValue === "function" && wdGlobalPaymentSearchHasMatch(wdDashboardSearchValue()))
    );

    dashSections().forEach(function (s) {
      const rail = document.querySelector('.iba-dash-rail[data-iba-dash-rail="' + s.id + '"]');
      if (!rail || rail.classList.contains("is-front")) return;
      const hit = !!(s.el && s.el.querySelector(".wd-active-status-card.wd-search-category-match"));
      if (hit || (s.id === "03" && payHit)) rail.classList.add("iba-dash-blink");
    });
  }

  function captureByAttr(sel, attr) {
    const map = {};
    document.querySelectorAll(sel).forEach(function (el) {
      const k = el.getAttribute(attr);
      if (!k) return;
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) map[k] = r;
    });
    return map;
  }

  function flipEl(el, from) {
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const sx = from.width / Math.max(to.width, 1);
    const sy = from.height / Math.max(to.height, 1);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.03 && Math.abs(sy - 1) < 0.03) return;
    el.style.transition = "none";
    el.style.transformOrigin = "top left";
    el.style.willChange = "transform";
    el.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.transition = "transform 0.52s cubic-bezier(.22,.82,.24,1)";
        el.style.transform = "none";
      });
    });
    setTimeout(function () {
      el.style.transition = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.willChange = "";
    }, 600);
  }

  function glowHero() {
    const hero = $("iba-dash-hero");
    if (!hero) return;
    hero.classList.remove("iba-dash-hero-glow");
    void hero.offsetWidth;
    hero.classList.add("iba-dash-hero-glow");
  }

  function playSectionMorph(fromRect, railsBefore) {
    const hero = $("iba-dash-hero");
    if (hero && fromRect) flipEl(hero, fromRect);
    glowHero();
    document.querySelectorAll(".iba-dash-rail").forEach(function (el) {
      const id = el.getAttribute("data-iba-dash-rail");
      if (id && railsBefore && railsBefore[id]) flipEl(el, railsBefore[id]);
    });
  }

  function enterDashFocus() {
    const staying = document.body.classList.contains("iba-dash-focus") && !!dashFocusSection;
    const sysFrom = staying ? null : captureByAttr(".iba-nav-list [data-iba-sys]", "data-iba-sys");
    if (!document.body.classList.contains("iba-dash-focus")) {
      dashFocusPinnedWas = document.body.classList.contains("iba-sidebar-pinned");
      document.body.classList.add("iba-dash-focus");
      document.body.classList.add("iba-sidebar-pinned");
    }
    const stack = $("iba-dash-stack");
    if (stack) stack.hidden = false;
    syncDashStack({ keepSection: staying });
    if (!staying) {
      requestAnimationFrame(function () {
        document.querySelectorAll("#iba-dash-stack [data-iba-sys]").forEach(function (el) {
          const k = el.getAttribute("data-iba-sys");
          if (sysFrom && sysFrom[k]) flipEl(el, sysFrom[k]);
        });
        const hero = $("iba-dash-hero");
        if (hero) {
          hero.classList.remove("iba-dash-hero-in");
          void hero.offsetWidth;
          hero.classList.add("iba-dash-hero-in");
        }
        setTimeout(glowHero, 480);
      });
    }
    applyViewDensity();
  }

  function exitDashFocus() {
    document.body.classList.remove("iba-dash-focus");
    const stack = $("iba-dash-stack");
    if (stack) stack.hidden = true;
    if (dashFocusPinnedWas === false) document.body.classList.remove("iba-sidebar-pinned");
    dashFocusPinnedWas = null;
    dashFocusSection = "";
    dashFocusStatus = "";
    dashFocusPay = "";
    applyViewDensity();
  }

  function glideSystemHome(sysFrom) {
    if (!sysFrom) return;
    const run = function () {
      document.querySelectorAll(".iba-nav-list > li.iba-nav-group").forEach(function (li) {
        const btn = li.querySelector(":scope > [data-iba-sys]");
        if (!btn) return;
        const from = sysFrom[btn.getAttribute("data-iba-sys")];
        if (!from) return;
        const to = li.getBoundingClientRect();
        if (to.width < 2 || to.height < 2) return;
        const dy = from.top - to.top;
        if (Math.abs(dy) < 6) return;
        li.style.transition = "none";
        li.style.transform = "translateY(" + dy + "px)";
        li.style.opacity = "0.4";
        li.style.zIndex = "5";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            li.style.transition = "transform 0.72s cubic-bezier(.22,.82,.24,1), opacity 0.4s ease";
            li.style.transform = "none";
            li.style.opacity = "1";
          });
        });
        setTimeout(function () {
          li.style.transition = "";
          li.style.transform = "";
          li.style.opacity = "";
          li.style.zIndex = "";
        }, 800);
      });
    };
    setTimeout(run, 30);
  }

  function bindDashFocus() {
    document.addEventListener("click", function (e) {
      const back = e.target.closest && e.target.closest("#iba-dash-back");
      if (back) {
        e.preventDefault();
        e.stopPropagation();
        const sysFrom = captureByAttr("#iba-dash-stack [data-iba-sys]", "data-iba-sys");
        try {
          if (typeof WD_DASHBOARD_NONE !== "undefined") wdActiveDashboardSelectedStatus = WD_DASHBOARD_NONE;
          else wdActiveDashboardSelectedStatus = "";
          wdAllActiveCorkboardSelectedSiteKey = "";
          wdActiveDashboardSelectedQueueDate = "";
          wdPaymentPocketShowPaidHistory = false;
        } catch (_) {}
        exitDashFocus();
        try {
          document.querySelectorAll("#wd-active-dashboard-cards .wd-active-status-card.active").forEach(function (el) {
            el.classList.remove("active");
          });
          if (typeof wdRenderDashboardCards === "function") wdRenderDashboardCards();
          if (typeof wdRenderDashboardList === "function") wdRenderDashboardList();
        } catch (_) {}
        setTitle("WorkDesk", "Dashboard");
        glideSystemHome(sysFrom);
        return;
      }
      const rail = e.target.closest && e.target.closest("[data-iba-dash-rail]");
      if (rail) {
        e.preventDefault();
        e.stopPropagation();
        rail.classList.add("iba-dash-pick");
        const fromRect = rail.getBoundingClientRect();
        const railsBefore = captureByAttr(".iba-dash-rail", "data-iba-dash-rail");
        dashFocusSection = rail.getAttribute("data-iba-dash-rail") || "";
        const section = dashSections().find(function (s) { return s.id === dashFocusSection; });
        const q = String(($("wd-active-dashboard-search") || {}).value || "").trim();
        const firstMatch = section && q ? section.el.querySelector(".wd-active-status-card.wd-search-category-match") : null;
        const selected = document.querySelector("#wd-active-dashboard-cards .wd-active-status-card.active");
        const alreadyOn = !!(section && selected && section.el.contains(selected) && !selected.classList.contains("wd-search-category-muted"));
        const first = firstMatch || (section && section.el.querySelector(".wd-active-status-card"));
        const finish = function () {
          playSectionMorph(fromRect, railsBefore);
        };
        if (first && (!alreadyOn || (firstMatch && firstMatch !== selected))) {
          rememberFocusCard(first);
          first.click();
          setTimeout(finish, 40);
        } else {
          syncDashStack({ keepSection: true });
          finish();
        }
        return;
      }
      const park = e.target.closest && e.target.closest("[data-iba-dash-park]");
      if (park) {
        e.preventDefault();
        const sysFrom = captureByAttr("#iba-dash-stack [data-iba-sys]", "data-iba-sys");
        const key = park.getAttribute("data-iba-dash-park");
        exitDashFocus();
        glideSystemHome(sysFrom);
        if (key) openPage(key);
        return;
      }
      if (e.target.closest && e.target.closest("#wd-active-dashboard-clear")) {
        return;
      }
      if (e.target.closest && e.target.closest("#wd-active-dashboard-cards .wd-active-status-card")) {
        const card = e.target.closest(".wd-active-status-card");
        rememberFocusCard(card);
        setTimeout(function () {
          const none = (typeof WD_DASHBOARD_NONE !== "undefined") ? WD_DASHBOARD_NONE : "";
          const selected = (typeof wdActiveDashboardSelectedStatus !== "undefined") ? wdActiveDashboardSelectedStatus : "";
          if (selected && selected !== none) enterDashFocus();
        }, 80);
      }
    });
  }

  function setTitle(group, detail) {
    const t = $("iba-shell-page-title");
    const d = $("iba-shell-page-detail");
    window.__ibaShellTitle = { group: group || "", detail: detail || "" };
    if (t) t.textContent = group || "";
    if (d) d.textContent = detail || "";
  }

  function lockTitle(group, detail) {
    setTitle(group, detail);
    [0, 40, 160, 400].forEach(function (ms) {
      setTimeout(function () { setTitle(group, detail); }, ms);
    });
  }

  function setActiveNav(key) {
    document.querySelectorAll("#iba-app-shell [data-iba-nav]").forEach(el => {
      el.classList.toggle("is-active", el.getAttribute("data-iba-nav") === key);
    });
    const list = document.querySelector("#iba-app-shell .iba-nav-list");
    if (list) {
      list.querySelectorAll(":scope > .iba-nav-group").forEach(function (group) {
        group.classList.toggle("is-open", !!group.querySelector('[data-iba-nav].is-active'));
      });
    }
    const imRoot = document.querySelector("[data-iba-im-root]");
    if (imRoot) {
      const entryKeys = ["im-invoice-entry", "im-batch-entry", "im-summary-note"];
      const financeKeys = ["im-reporting", "im-payments", "im-po-closeout", "epicore"];
      imRoot.querySelectorAll("[data-iba-im-branch]").forEach(function (branch) {
        const kind = branch.getAttribute("data-iba-im-branch");
        const open = (kind === "entry" && entryKeys.indexOf(key) >= 0) || (kind === "finance" && financeKeys.indexOf(key) >= 0);
        branch.classList.toggle("is-open", open);
      });
    }
  }

  function applyViewDensity() {
    const pinned = document.body.classList.contains("iba-sidebar-pinned");
    const side = pinned ? 248 : 0;
    const w = Math.max(0, window.innerWidth - side);
    const h = window.innerHeight;
    document.body.classList.toggle("iba-view-narrow", w < 1200);
    document.body.classList.toggle("iba-view-tight", w < 980);
    document.body.classList.toggle("iba-view-short", h < 860);
    document.body.classList.toggle("iba-view-short2", h < 760);
  }

  function isPinned() {
    try { return localStorage.getItem("iba-sidebar-pinned") === "1"; } catch (_) { return false; }
  }

  function setPinned(on) {
    document.body.classList.toggle("iba-sidebar-pinned", !!on);
    document.body.classList.remove("iba-sidebar-peek");
    try { localStorage.setItem("iba-sidebar-pinned", on ? "1" : "0"); } catch (_) {}
    const btn = $("iba-sidebar-pin");
    if (btn) btn.title = on ? "Unpin side panel" : "Pin side panel";
    applyViewDensity();
  }

  let peekTimer = 0;
  function peekSidebar(on) {
    if (document.body.classList.contains("iba-sidebar-pinned")) return;
    clearTimeout(peekTimer);
    if (on) document.body.classList.add("iba-sidebar-peek");
    else peekTimer = setTimeout(function () { document.body.classList.remove("iba-sidebar-peek"); }, 160);
  }

  function showShell() {
    document.body.classList.add("iba-shell-on");
    const shell = $("iba-app-shell");
    if (shell) shell.classList.remove("hidden");
    const name = resolveUserName();
    if ($("iba-shell-username")) $("iba-shell-username").textContent = name || "User";
    paintUsername();
    document.body.classList.toggle("iba-is-super-admin", isIrwin());
    setPinned(isPinned());
    applyBackground();
    if (isIrwin()) {
      renderBgPicker();
      paintOpeningPicker();
    }
  }

  function hideShell() {
    document.body.classList.remove("iba-shell-on", "iba-shell-nav-open");
    const shell = $("iba-app-shell");
    if (shell) shell.classList.add("hidden");
    const layer = $("iba-bg-layer");
    if (layer) {
      layer.style.backgroundImage = "";
      layer.style.display = "none";
    }
    applyGroupBackground("login");
  }

  async function openPage(key) {
    const access = shellAccessMap();
    if (Object.prototype.hasOwnProperty.call(access, key) && !access[key]) return;
    window.__ibaNavKey = key;
    showShell();
    document.body.classList.remove("iba-shell-nav-open", "iba-sidebar-peek");
    if (key !== "wd-add-job") {
      document.body.classList.remove("iba-add-job-page");
      const jobModal = $("standard-job-modal");
      if (jobModal) jobModal.classList.add("hidden");
    }
    const review = $("wd-inv-request-review");
    if (review) {
      if (key === "inv-request-review") review.classList.remove("hidden");
      else review.classList.add("hidden");
    }
    document.body.classList.toggle("iba-page-request-review", key === "inv-request-review");
    setActiveNav(key);
    if (key !== "dashboard") exitDashFocus();

    const showViewFn = window.showView;
    const showWd = window.showWorkdeskSection;
    const showIm = window.showIMSection;

    const bindInv = window.ibaBindTaskSurface;

    switch (key) {
      case "dashboard":
        try { window.__ibaActiveModule = "workdesk"; } catch (_) {}
        document.body.classList.remove("inventory-mode");
        exitDashFocus();
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-dashboard");
        if (typeof window.wdResetDashboardSearchAndSelection === "function") window.wdResetDashboardSearchAndSelection();
        else exitDashFocus();
        setTitle("WorkDesk", "Dashboard");
        break;
      case "wd-add-job":
        try { window.__ibaActiveModule = "workdesk"; } catch (_) {}
        document.body.classList.remove("inventory-mode");
        document.body.classList.add("iba-add-job-page");
        if (typeof showViewFn === "function") showViewFn("workdesk");
        document.querySelectorAll("#workdesk-view .workdesk-section").forEach(function (s) { s.classList.add("hidden"); });
        const pendingEdit = window.__ibaJobEditEntry || null;
        if (pendingEdit) window.__ibaJobEditEntry = null;
        if (pendingEdit && typeof window.openStandardJobModal === "function") window.openStandardJobModal("Edit", pendingEdit);
        else if (typeof window.openStandardJobModal === "function") window.openStandardJobModal("Add");
        placeJobOtherField();
        unlockJobDropdowns();
        refillJobDropdowns();
        setTimeout(placeJobOtherField, 50);
        setTimeout(unlockJobDropdowns, 50);
        setTimeout(refillJobDropdowns, 80);
        setTitle("WorkDesk", "Add New Job");
        break;
      case "wd-active-task":
        try { window.__ibaActiveModule = "workdesk"; } catch (_) {}
        document.body.classList.remove("inventory-mode");
        if (typeof bindInv === "function") bindInv("workdesk");
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-activetask");
        stripSearchChrome("wd-activetask");
        setTitle("WorkDesk", "Active Task");
        break;
      case "wd-job-records":
        try { window.__ibaActiveModule = "workdesk"; } catch (_) {}
        document.body.classList.remove("inventory-mode");
        if (typeof isolateJobRecordsStage === "function") isolateJobRecordsStage("workdesk");
        try {
          if (typeof wdReportDefaultJobTypes === "function") {
            const types = wdReportDefaultJobTypes();
            if (typeof currentReportFilter !== "undefined" && !types.includes(currentReportFilter)) currentReportFilter = types[0];
          }
        } catch (_) {}
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-reporting");
        stripSearchChrome("wd-reporting");
        lockTitle("WorkDesk", "Job Records");
        if (typeof wdUiSetRecordsHeroContext === "function") wdUiSetRecordsHeroContext("workdesk");
        break;
      case "inv-active-job":
        try { window.__ibaActiveModule = "inventory"; } catch (_) {}
        document.body.classList.add("inventory-mode");
        if (typeof isolateJobRecordsStage === "function") isolateJobRecordsStage("");
        if (typeof bindInv === "function") bindInv("inventory");
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("inv-active-job");
        lockTitle("Inventory", "Active Job");
        break;
      case "inv-work-history":
        try { window.__ibaActiveModule = "inventory"; } catch (_) {}
        document.body.classList.add("inventory-mode");
        if (typeof isolateJobRecordsStage === "function") isolateJobRecordsStage("inventory");
        try {
          if (typeof wdReportDefaultJobTypes === "function") {
            const types = wdReportDefaultJobTypes();
            if (typeof currentReportFilter !== "undefined" && !types.includes(currentReportFilter)) currentReportFilter = types[0];
          }
        } catch (_) {}
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-reporting");
        lockTitle("Inventory", "Work History");
        if (typeof wdUiSetRecordsHeroContext === "function") wdUiSetRecordsHeroContext("inventory");
        break;
      case "inv-request-review":
        try { window.__ibaActiveModule = "inventory"; } catch (_) {}
        document.body.classList.add("inventory-mode");
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof window.openInventoryRequestReview === "function") window.openInventoryRequestReview();
        setTitle("Inventory", "Request Review");
        break;
      case "inv-material-stock":
        try { window.__ibaActiveModule = "inventory"; } catch (_) {}
        document.body.classList.add("inventory-mode");
        if (typeof isolateJobRecordsStage === "function") isolateJobRecordsStage("");
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-material-stock");
        setTitle("Inventory", "Material Stock");
        break;
      case "im-invoice-entry":
      case "im-batch-entry":
      case "im-summary-note":
      case "im-reporting":
      case "im-payments":
      case "im-po-closeout":
        try { window.__ibaActiveModule = "invoice"; } catch (_) {}
        document.body.classList.remove("inventory-mode");
        if (typeof showViewFn === "function") showViewFn("invoice-management");
        if (typeof showIm === "function") showIm(key);
        setTitle("Invoice Management", ({
          "im-invoice-entry": "Invoice Entry",
          "im-batch-entry": "Batch Entry",
          "im-summary-note": "Summary Note",
          "im-reporting": "Invoice Records",
          "im-payments": "Payments",
          "im-po-closeout": "PO Close Out"
        })[key]);
        break;
      case "settings":
        if (typeof showViewFn === "function") showViewFn("workdesk");
        if (typeof showWd === "function") await showWd("wd-settings");
        setTitle("Settings", isIrwin() ? "Super Admin" : "Account");
        renderBgPicker();
        paintOpeningPicker();
        break;
      default:
        break;
    }
    applyBackground();
  }

  function fileNameFromUrl(url) {
    const s = String(url || "");
    const i = s.lastIndexOf("/");
    return i >= 0 ? s.slice(i + 1) : s;
  }

  function fillBgRow(row, url) {
    const src = url || storedBg(row.getAttribute("data-iba-bg-group"));
    const img = row.querySelector(".iba-bg-preview");
    const name = row.querySelector(".iba-bg-filename");
    const select = row.querySelector(".iba-bg-select");
    if (img) img.src = src;
    if (name) name.textContent = fileNameFromUrl(src);
    if (select) select.value = src;
    row.dataset.pending = src;
  }

  function renderBgPicker() {
    document.querySelectorAll(".iba-bg-row[data-iba-bg-group]").forEach(function (row) {
      const group = row.getAttribute("data-iba-bg-group");
      const select = row.querySelector(".iba-bg-select");
      if (select && !select.options.length) {
        PHOTO_FILES.forEach(function (file) {
          const opt = document.createElement("option");
          opt.value = PHOTO_BASE + file;
          opt.textContent = file;
          select.appendChild(opt);
        });
      }
      fillBgRow(row, storedBg(group));
    });
  }

  // 14.0.0 patch 4: five openings (a-e). Unknown values fall back to B as before.
  const OPENING_KINDS = ["a", "b", "c", "d", "e"];
  function isOpeningKind(v) { return OPENING_KINDS.indexOf(v) >= 0; }

  function openingKind() {
    const v = String(window.__ibaLoginOpening || "").toLowerCase();
    if (isOpeningKind(v)) return v;
    try {
      const saved = String(localStorage.getItem("iba-login-opening") || "").toLowerCase();
      if (isOpeningKind(saved)) return saved;
    } catch (_) {}
    return "b";
  }

  function rememberOpening(kind) {
    const k = String(kind || "").toLowerCase();
    const v = isOpeningKind(k) ? k : "b";
    window.__ibaLoginOpening = v;
    try { localStorage.setItem("iba-login-opening", v); } catch (_) {}
    return v;
  }

  function paintOpeningPicker() {
    const kind = openingKind();
    document.querySelectorAll(".iba-open-choice").forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.getAttribute("data-iba-open") === kind);
    });
  }

  function watchOpeningPref() {
    try {
      const cached = localStorage.getItem("iba-login-opening");
      if (cached) rememberOpening(cached);
    } catch (_) {}
    paintOpeningPicker();
    try {
      if (typeof db === "undefined" || !db || typeof db.ref !== "function") return;
      if (window.__ibaOpeningWatch) return;
      window.__ibaOpeningWatch = true;
      db.ref("system_settings/login_opening").on("value", function (snap) {
        const v = String(snap.val() || "").toLowerCase();
        if (isOpeningKind(v)) {
          rememberOpening(v);
          paintOpeningPicker();
        }
      });
    } catch (_) {}
  }

  function saveOpeningPref(kind) {
    const v = rememberOpening(kind);
    paintOpeningPicker();
    const note = $("iba-open-message");
    const writeLocal = function (text) { if (note) note.textContent = text; };
    try {
      if (typeof db !== "undefined" && db && typeof db.ref === "function") {
        return db.ref("system_settings/login_opening").set(v).then(function () {
          writeLocal("Saved. Every login will use " + v.toUpperCase() + ".");
        }).catch(function () {
          writeLocal("Saved on this browser. Firebase did not accept the write.");
        });
      }
    } catch (_) {}
    writeLocal("Saved on this browser only.");
    return Promise.resolve();
  }

  // 14.0.0 patch 4: redrawn openings. Same timing as before (the page is
  // ready underneath and the opening lifts off after about 3 seconds).
  function openingReduced() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (_) { return false; }
  }

  function openingGreeting() {
    let name = "";
    try { name = String((window.currentApprover && window.currentApprover.Name) || (typeof currentApprover !== "undefined" && currentApprover && currentApprover.Name) || "").trim(); } catch (_) {}
    const first = name.split(/\s+/)[0] || "";
    return first ? "Welcome back, " + first : "Welcome back";
  }

  function openingMarkup(kind) {
    const letters = '<span class="iba-op-l">I</span><span class="iba-op-l">B</span><span class="iba-op-l">A</span>';
    const mark = '<div class="iba-op-mark" aria-hidden="true">' + letters + '</div>';
    const hello = '<div class="iba-op-hello">' + openingGreeting().replace(/[<>&]/g, "") + '</div>';
    if (kind === "a") {
      return '<div class="iba-op-glow"></div><div class="iba-op-center">' + mark + '<div class="iba-op-line"></div>' + hello + '</div>';
    }
    if (kind === "b") {
      return '<div class="iba-op-center"><svg class="iba-op-seal" viewBox="0 0 200 200" aria-hidden="true">' +
        '<circle class="iba-op-ticks" cx="100" cy="100" r="92"></circle>' +
        '<circle class="iba-op-ring" cx="100" cy="100" r="84"></circle>' +
        '<circle class="iba-op-ring-in" cx="100" cy="100" r="70"></circle></svg>' + mark + hello + '</div>';
    }
    if (kind === "c") {
      return '<div class="iba-op-photo"></div><div class="iba-op-beam"></div><div class="iba-op-center">' + mark + hello + '</div>';
    }
    if (kind === "d") {
      return '<div class="iba-op-grid"></div><svg class="iba-op-frame" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<path d="M60 220 L60 70 L200 20 L340 70 L340 220 Z"></path>' +
        '<path d="M60 120 L340 120 M60 170 L340 170 M130 220 L130 45 M270 220 L270 45"></path>' +
        '<path class="iba-op-ground" d="M20 220 L380 220"></path></svg>' +
        '<div class="iba-op-center iba-op-low">' + mark + hello + '</div>';
    }
    let towers = "";
    [38, 62, 46, 80, 54, 92, 66, 44, 74, 50, 60, 36].forEach(function (h, i) {
      towers += '<span class="iba-op-tower" style="--h:' + h + '%;--i:' + i + '"></span>';
    });
    return '<div class="iba-op-sky"></div><div class="iba-op-skyline">' + towers + '</div><div class="iba-op-center iba-op-high">' + mark + hello + '</div>';
  }

  function buildOpening(kind) {
    const old = $("iba-login-opening");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "iba-login-opening";
    el.className = "iba-op iba-op-" + kind + (openingReduced() ? " iba-op-reduced" : "");
    el.setAttribute("data-kind", kind);
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = openingMarkup(kind);
    document.body.appendChild(el);
    // start on the next frame so every opening begins from its first keyframe
    requestAnimationFrame(function () { el.classList.add("is-play"); });
    return el;
  }

  function dismissOpening(el) {
    setTimeout(function () {
      if (el && el.parentNode) el.remove();
      document.body.classList.remove("iba-opening-active");
    }, openingReduced() ? 1100 : 2900);
  }

  function playLoginOpening() {
    return new Promise(function (resolve) {
      const kind = openingKind();
      document.body.classList.add("iba-opening-active");
      const el = buildOpening(kind);
      setTimeout(function () { resolve(el); }, 40);
    });
  }

  // Settings > Opening > Preview: play the chosen opening over the current page
  window.ibaPreviewOpening = function (kind) {
    const k = isOpeningKind(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : openingKind();
    const el = buildOpening(k);
    el.classList.add("is-preview");
    setTimeout(function () { if (el && el.parentNode) el.remove(); }, openingReduced() ? 1100 : 2900);
    return el;
  };

  function bind() {
    tickClock();
    setInterval(tickClock, 1000);
    applyBackground();
    watchOpeningPref();

    document.addEventListener("click", function (e) {
      const nav = e.target.closest && e.target.closest("[data-iba-nav]");
      if (nav) {
        e.preventDefault();
        const key = nav.getAttribute("data-iba-nav");
        if (key === "epicore") {
          window.open("https://port.iba.com.qa/Epicore/", "_blank", "noopener");
          return;
        }
        if (key === "requisition") {
          window.open("https://port.iba.com.qa/Procure/", "_blank", "noopener");
          return;
        }
        if (key === "finance-report") {
          window.open("https://port.iba.com.qa/Finance/", "_blank", "noopener");
          return;
        }
        if (key === "po-system") {
          window.open("https://port.iba.com.qa/PO/", "_blank", "noopener");
          return;
        }
        openPage(key);
        return;
      }
      const toggle = e.target.closest && e.target.closest("[data-iba-group-toggle]");
      if (toggle) {
        e.preventDefault();
        const group = toggle.closest(".iba-nav-group");
        if (!group) return;
        if (group.hasAttribute("data-iba-im-branch")) {
          const opening = !group.classList.contains("is-open");
          const root = group.closest("[data-iba-im-root]");
          if (root) root.querySelectorAll("[data-iba-im-branch]").forEach(function (b) { b.classList.remove("is-open"); });
          if (opening) group.classList.add("is-open");
          if (root) root.classList.add("is-open");
          const list = document.querySelector("#iba-app-shell .iba-nav-list");
          if (list) list.querySelectorAll(":scope > .iba-nav-group").forEach(function (g) {
            if (g !== root) g.classList.remove("is-open");
          });
        } else {
          const list = document.querySelector("#iba-app-shell .iba-nav-list");
          if (list) list.querySelectorAll(":scope > .iba-nav-group").forEach(function (g) {
            g.classList.toggle("is-open", g === group);
          });
          if (!list) group.classList.add("is-open");
          const sys = toggle.getAttribute("data-iba-sys");
          if (sys === "wd") openPage("wd-active-task");
          else if (sys === "inv") openPage("inv-active-job");
          else if (sys === "im") {
            const first = firstAllowedImPage();
            if (first) openPage(first);
          }
        }
        return;
      }
      if (document.body.classList.contains("iba-add-job-page") && e.target.closest && e.target.closest("#standard-job-modal")) {
        unlockJobDropdowns();
        placeJobOtherField();
      }
    });

    const settingsBtn = $("iba-shell-settings-btn");
    if (settingsBtn) settingsBtn.addEventListener("click", () => openPage("settings"));

    const logoutBtn = $("iba-shell-logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
      if (typeof handleLogout === "function") handleLogout();
    });

    const menuBtn = $("iba-shell-menu-btn");
    if (menuBtn) menuBtn.addEventListener("click", function () {
      document.body.classList.toggle("iba-shell-nav-open");
    });

    const pinBtn = $("iba-sidebar-pin");
    if (pinBtn) pinBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setPinned(!document.body.classList.contains("iba-sidebar-pinned"));
    });
    const hotspot = $("iba-sidebar-hotspot");
    const sidebar = $("iba-shell-sidebar");
    if (hotspot) {
      hotspot.addEventListener("mouseenter", function () { peekSidebar(true); });
      hotspot.addEventListener("click", function () { peekSidebar(true); });
    }
    if (sidebar) {
      sidebar.addEventListener("mouseenter", function () { peekSidebar(true); });
      sidebar.addEventListener("mouseleave", function () { peekSidebar(false); });
    }
    setPinned(isPinned());

    const bgHost = $("iba-shell-bg-settings");
    if (bgHost) {
      bgHost.addEventListener("click", function (e) {
        if (!isIrwin()) return;
        const row = e.target.closest(".iba-bg-row");
        if (!row) return;
        const group = row.getAttribute("data-iba-bg-group");
        const select = row.querySelector(".iba-bg-select");
        if (e.target.closest(".iba-bg-browse")) {
          if (select) {
            select.classList.remove("hidden");
            select.focus();
            if (typeof select.showPicker === "function") {
              try { select.showPicker(); } catch (_) {}
            }
          }
          return;
        }
        if (e.target.closest(".iba-bg-save")) {
          const url = row.dataset.pending || (select && select.value) || storedBg(group);
          applyGroupBackground(group, url);
          fillBgRow(row, url);
          if (select) select.classList.add("hidden");
        }
      });
      bgHost.addEventListener("change", function (e) {
        const select = e.target.closest(".iba-bg-select");
        if (!select) return;
        const row = select.closest(".iba-bg-row");
        if (!row) return;
        fillBgRow(row, select.value);
      });
    }

    const openHost = $("iba-login-opening-settings");
    if (openHost) {
      openHost.addEventListener("click", function (e) {
        if (!isIrwin()) return;
        const choice = e.target.closest && e.target.closest(".iba-open-choice");
        if (choice) {
          rememberOpening(choice.getAttribute("data-iba-open"));
          paintOpeningPicker();
          return;
        }
        if (e.target.closest && e.target.closest("#iba-open-save")) {
          const selected = openHost.querySelector(".iba-open-choice.is-selected");
          saveOpeningPref(selected ? selected.getAttribute("data-iba-open") : openingKind());
        }
        if (e.target.closest && e.target.closest("#iba-open-preview")) {
          const selected = openHost.querySelector(".iba-open-choice.is-selected");
          window.ibaPreviewOpening(selected ? selected.getAttribute("data-iba-open") : openingKind());
        }
      });
    }

    const origShowView = window.showView;
    if (typeof origShowView === "function") {
      window.showView = function (viewName) {
        if (viewName === "dashboard") {
          openPage("dashboard");
          return;
        }
        const result = origShowView.apply(this, arguments);
        if (viewName === "workdesk" || viewName === "invoice-management" || viewName === "inventory") {
          showShell();
        } else if (viewName === "login" || viewName === "password" || viewName === "setup") {
          hideShell();
        }
        paintUsername();
        return result;
      };
    }

    const origLogin = window.handleSuccessfulLogin;
    if (typeof origLogin === "function") {
      window.handleSuccessfulLogin = function () {
        const play = window.__ibaPlayLoginOpening === true;
        window.__ibaPlayLoginOpening = false;
        const run = function () {
          const result = origLogin.apply(this, arguments);
          paintUsername();
          setTimeout(paintUsername, 150);
          setTimeout(paintUsername, 800);
          return result;
        }.bind(this);
        if (!play) return run();
        return playLoginOpening().then(function (el) {
          let result;
          try { result = run(); }
          catch (err) {
            dismissOpening(el);
            throw err;
          }
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { dismissOpening(el); });
          });
          return result;
        });
      };
    }
    paintUsername();
    setInterval(paintUsername, 2500);

    document.addEventListener("showDropdown", function (e) {
      if (!document.body.classList.contains("iba-add-job-page")) return;
      unlockJobDropdowns();
      const select = e.target;
      setTimeout(function () { portJobChoicesDropdown(select, true); }, 0);
    }, true);
    document.addEventListener("hideDropdown", function (e) {
      portJobChoicesDropdown(e.target, false);
    }, true);
    bindDashFocus();
    applyViewDensity();
    window.addEventListener("resize", applyViewDensity);
    document.addEventListener("input", function (e) {
      if (!e.target || e.target.id !== "wd-active-dashboard-search") return;
      if (document.body.classList.contains("iba-dash-focus")) return;
      setTimeout(blinkDashSearchRails, 80);
    });
  }

  window.ibaOpenShellPage = openPage;
  window.ibaShowShell = showShell;
  window.ibaApplyShellBackground = applyBackground;
  window.ibaSyncDashFocus = function () {
    const none = (typeof WD_DASHBOARD_NONE !== "undefined") ? WD_DASHBOARD_NONE : "";
    const selected = (typeof wdActiveDashboardSelectedStatus !== "undefined") ? wdActiveDashboardSelectedStatus : "";
    if ((!selected || selected === none) && !dashFocusSection) {
      exitDashFocus();
      return;
    }
    enterDashFocus();
  };
  window.ibaEnterDashFocus = enterDashFocus;
  window.ibaBlinkDashSearch = blinkDashSearchRails;
  window.ibaExitDashFocus = exitDashFocus;

  function injectRowHoverCss() {
    if (document.getElementById("iba-row-hover-css")) return;
    const s = document.createElement("style");
    s.id = "iba-row-hover-css";
    s.textContent = [
      "html body.iba-shell-on:not(.inventory-mode) #workdesk-view#workdesk-view#workdesk-view table tbody tr:nth-child(even) td,",
      "html body.iba-shell-on:not(.inventory-mode) #workdesk-view#workdesk-view#workdesk-view table tbody tr:nth-child(odd) td {",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "}",
      "html body.iba-shell-on:not(.inventory-mode) #workdesk-view#workdesk-view#workdesk-view table tbody tr:hover td,",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view table tbody tr:hover td {",
      "  background: rgba(255,255,255,0.16) !important;",
      "  background-color: rgba(255,255,255,0.16) !important;",
      "  background-image: none !important;",
      "  color: #0b1c2e !important;",
      "  -webkit-text-fill-color: #0b1c2e !important;",
      "  text-shadow: none !important;",
      "}",
      "html body.iba-shell-on:not(.inventory-mode) #workdesk-view#workdesk-view#workdesk-view table tbody tr:hover td *,",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view table tbody tr:hover td * {",
      "  color: #0b1c2e !important;",
      "  -webkit-text-fill-color: #0b1c2e !important;",
      "  text-shadow: none !important;",
      "}",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-dashboard-pdf-btn.srv,",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-dashboard-pdf-btn.srv * {",
      "  background: #dc2626 !important;",
      "  color: #fff !important;",
      "  -webkit-text-fill-color: #fff !important;",
      "}",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-payment-pocket-mark-paid,",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-payment-pocket-mark-paid *,",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-paid-po-view-btn,",
      "html body.iba-shell-on #workdesk-view table tbody tr:hover .wd-paid-po-view-btn * {",
      "  background: #1e4d8c !important;",
      "  color: #fff !important;",
      "  -webkit-text-fill-color: #fff !important;",
      "}",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view#workdesk-view .wd-payment-pocket-table tbody tr:hover td,",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view#workdesk-view .wd-paid-po-history-table tbody tr:hover td,",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view#workdesk-view #wd-activetask table tbody tr:hover td,",
      "html body.iba-shell-on #workdesk-view#workdesk-view#workdesk-view#workdesk-view #wd-reporting #job-records-table tbody tr:hover td {",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "  background-image: none !important;",
      "  border-left: 0 !important;",
      "  border-right: 0 !important;",
      "  box-shadow: none !important;",
      "  backdrop-filter: none !important;",
      "}"
    ].join("\n");
    (document.body || document.documentElement).appendChild(s);
  }

  function bindPaymentRowHover() {
    if (document.documentElement.dataset.ibaPayHover === "1") return;
    document.documentElement.dataset.ibaPayHover = "1";
    const TABLE = ".wd-payment-pocket-table, .wd-paid-po-history-table, #wd-activetask table, #wd-reporting #job-records-table";
    const SKIP = "button, a, .wd-dashboard-pdf-btn, .wd-payment-pocket-mark-paid, .wd-paid-po-view-btn, .history-btn, .wd-action-history";
    const FG = "#122033";
    let current = null;
    let held = null;

    function openGroupRow() {
      if (!document.body.classList.contains("inventory-mode")) return null;
      const reporting = document.getElementById("wd-reporting");
      if (!reporting || reporting.classList.contains("hidden")) return null;
      return reporting.querySelector("tr.inv-job-group-row.is-open");
    }

    function holdOpenGroup() {
      const open = openGroupRow();
      if (held && held !== open) paintText(held, false);
      held = open;
      if (!held) {
        const table = document.querySelector("#wd-reporting #job-records-table");
        const bar = table && table.parentElement && table.parentElement.querySelector(":scope > .iba-open-frost");
        if (bar) bar.style.display = "none";
        return;
      }
      paintText(held, true);
      placeOpenBar(held);
      if (current && current !== held) return;
    }

    function placeOpenBar(tr) {
      const table = tr && tr.closest("table");
      if (!table) return;
      const parent = table.parentElement;
      if (!parent) return;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      let bar = parent.querySelector(":scope > .iba-open-frost");
      if (!tr || !tr.classList.contains("is-open")) {
        if (bar) bar.style.display = "none";
        return;
      }
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "iba-row-frost iba-open-frost";
        parent.insertBefore(bar, table);
      }
      let top = 0;
      let node = tr;
      const seen = new Set();
      while (node && node !== parent && !seen.has(node)) {
        seen.add(node);
        top += node.offsetTop || 0;
        node = node.offsetParent;
      }
      bar.style.display = "block";
      bar.style.zIndex = "0";
      bar.style.pointerEvents = "none";
      bar.style.top = top + "px";
      bar.style.height = (tr.offsetHeight || 0) + "px";
      bar.style.left = "0px";
      bar.style.width = "100%";
    }

    function rowFrom(el) {
      if (!el || !el.closest) return null;
      const tr = el.closest("tbody tr");
      if (!tr || tr.closest("thead")) return null;
      if (!tr.closest(TABLE)) return null;
      return tr;
    }

    function barFor(table) {
      const parent = table.parentElement;
      if (!parent) return null;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      let bar = parent.querySelector(":scope > .iba-row-frost:not(.iba-open-frost)");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "iba-row-frost";
        parent.insertBefore(bar, table);
      }
      return bar;
    }

    function hideBar(tr) {
      const table = tr && tr.closest("table");
      const bar = table && table.parentElement && table.parentElement.querySelector(":scope > .iba-row-frost:not(.iba-open-frost)");
      if (bar) bar.style.display = "none";
    }

    function paintText(tr, on) {
      tr.querySelectorAll("td, td *").forEach(function (el) {
        if (el.closest && el.closest(SKIP)) return;
        if (on) {
          const openHead = tr.classList.contains("inv-job-group-row") && tr.classList.contains("is-open");
          el.style.setProperty("color", FG, "important");
          el.style.setProperty("-webkit-text-fill-color", FG, "important");
          el.style.setProperty("text-shadow", "none", "important");
          if (!(openHead && el.tagName === "TD")) {
            el.style.setProperty("background", "transparent", "important");
            el.style.setProperty("background-color", "transparent", "important");
          }
          el.style.setProperty("border", "0", "important");
          el.style.setProperty("border-left", "0", "important");
          el.style.setProperty("border-right", "0", "important");
          el.style.setProperty("border-top", "0", "important");
          el.style.setProperty("border-bottom", "0", "important");
          el.style.setProperty("outline", "none", "important");
          el.style.setProperty("box-shadow", "none", "important");
          el.style.setProperty("backdrop-filter", "none", "important");
          el.style.setProperty("-webkit-backdrop-filter", "none", "important");
        } else {
          ["color", "-webkit-text-fill-color", "text-shadow", "background", "background-color", "border", "border-left", "border-right", "border-top", "border-bottom", "outline", "box-shadow", "backdrop-filter", "-webkit-backdrop-filter"].forEach(function (p) {
            el.style.removeProperty(p);
          });
        }
      });
    }

    function showBar(tr) {
      const table = tr.closest("table");
      const bar = barFor(table);
      if (!bar) return;
      const parent = bar.parentElement;
      let top = 0;
      let node = tr;
      const seen = new Set();
      while (node && node !== parent && !seen.has(node)) {
        seen.add(node);
        top += node.offsetTop || 0;
        node = node.offsetParent;
      }
      bar.style.display = "block";
      bar.style.zIndex = "0";
      bar.style.top = top + "px";
      bar.style.height = (tr.offsetHeight || 0) + "px";
      bar.style.left = "0px";
      bar.style.width = "100%";
    }

    document.addEventListener("mouseover", function (e) {
      const tr = rowFrom(e.target);
      if (tr === current) return;
      if (current && current !== held) paintText(current, false);
      current = tr;
      if (!current) return;
      paintText(current, true);
      showBar(current);
    }, true);
    document.addEventListener("mouseout", function (e) {
      if (!current) return;
      if (rowFrom(e.relatedTarget) === current) return;
      if (current !== held) paintText(current, false);
      current = null;
      holdOpenGroup();
    }, true);
    document.addEventListener("scroll", function (e) {
      const row = (current && (!held || current !== held)) ? current : held;
      if (held && held.classList.contains("is-open")) placeOpenBar(held);
      if (!row || !e.target || !e.target.contains || !e.target.contains(row)) return;
      if (row !== held) showBar(row);
    }, true);
    window.ibaHoldOpenGroupFrost = holdOpenGroup;
  }

  // 14.0.0 patch 4: row hover is one style for every list (css/iba-ui.css).
  // The old white frost bar + dark text painting is no longer switched on.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  if (/[?&]preview=shell/.test(location.search || "")) {
    window.addEventListener("load", function () {
      document.body.classList.add("iba-shell-on", "iba-is-super-admin");
      ["login-view", "password-view", "setup-view", "dashboard-view"].forEach(id => {
        const el = $(id);
        if (el) el.classList.add("hidden");
      });
      const wd = $("workdesk-view");
      if (wd) wd.classList.remove("hidden");
      const app = $("app-container");
      if (app) app.style.display = "none";
      showShell();
      setTitle("WorkDesk", "Active Task");
      const section = $("wd-activetask") || $("inv-active-job");
      if (section) section.classList.remove("hidden");
    });
  }
})();
