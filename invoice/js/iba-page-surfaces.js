/* ==========================================================================
   js/iba-page-surfaces.js  —  14.0.0 patch 2
   Keeps the paired pages separate:
     WorkDesk  Active Task   <->  Inventory  Active Job
     WorkDesk  Job Records   <->  Inventory  Work History
   - each page has its own saved search (sessionStorage key)
   - each Active page remembers its own selected tab
   - a load ticket: if the user switches page while a load is still running,
     the late result is dropped instead of being drawn on the other page.
   No Firebase reads/writes, no access rules, no layout here.
   ========================================================================== */
(function () {
    'use strict';

    function isInventory() {
        try {
            if (typeof isInventoryContext === 'function') return !!isInventoryContext();
        } catch (_) {}
        return !!(document.body && document.body.classList.contains('inventory-mode'));
    }

    function surface() {
        return isInventory() ? 'inventory' : 'workdesk';
    }

    const KEYS = {
        activeTask: { workdesk: 'activeTaskSearch', inventory: 'invActiveJobSearch' },
        records: { workdesk: 'reportingSearch', inventory: 'invWorkHistorySearch' }
    };

    function searchKey(kind, forSurface) {
        const map = KEYS[kind] || KEYS.activeTask;
        return map[forSurface || surface()] || map.workdesk;
    }

    function readSearch(kind, forSurface) {
        try { return sessionStorage.getItem(searchKey(kind, forSurface)) || ''; } catch (_) { return ''; }
    }

    function writeSearch(kind, value, forSurface) {
        try { sessionStorage.setItem(searchKey(kind, forSurface), String(value || '')); } catch (_) {}
    }

    function clearSearch(kind, forSurface) {
        try { sessionStorage.removeItem(searchKey(kind, forSurface)); } catch (_) {}
    }

    // ---- load tickets -------------------------------------------------------
    const seq = { activeTask: 0, records: 0 };

    function beginLoad(kind) {
        seq[kind] = (seq[kind] || 0) + 1;
        return { kind: kind, seq: seq[kind], surface: surface() };
    }

    function isCurrent(ticket) {
        if (!ticket) return true;
        return ticket.seq === seq[ticket.kind] && ticket.surface === surface();
    }

    // ---- per-page tab memory for Active Task / Active Job -------------------
    const tabMemory = { workdesk: null, inventory: null };
    let boundTaskSurface = null;

    function switchTaskSurface(kind) {
        const next = kind === 'inventory' ? 'inventory' : 'workdesk';
        try {
            if (boundTaskSurface && boundTaskSurface !== next && typeof currentActiveTaskFilter !== 'undefined') {
                tabMemory[boundTaskSurface] = currentActiveTaskFilter;
            }
            if (boundTaskSurface !== next) {
                const remembered = tabMemory[next];
                // 'All' lets each page pick its own first tab, exactly as before.
                currentActiveTaskFilter = remembered || 'All';
            }
        } catch (_) {}
        boundTaskSurface = next;
    }

    function markRecordsSurface() {
        const section = document.getElementById('wd-reporting');
        if (section) section.setAttribute('data-iba-surface', surface());
    }

    window.ibaSurfaces = {
        surface: surface,
        searchKey: searchKey,
        readSearch: readSearch,
        writeSearch: writeSearch,
        clearSearch: clearSearch,
        beginLoad: beginLoad,
        isCurrent: isCurrent,
        switchTaskSurface: switchTaskSurface,
        markRecordsSurface: markRecordsSurface
    };
})();
