/* ==========================================================================
   js/iba-1702-clear.js — 17.0.2 patch 11
   A small clear (×) button in the assistant's search boxes: the chat box,
   Invoice / Inventory tracking and the phone search. It shows only while
   the box has text; one tap empties the box (tracking: also Site and
   Year) and puts the cursor back in it. No data is read or written.
   ========================================================================== */
(function () {
    'use strict';
    // box id -> other boxes emptied together with it
    const BOXES = {
        'iba-ai-text': [],
        'iba-ai-track-q': ['iba-ai-track-site', 'iba-ai-track-year'],
        'iba-aph-q': [],
        'iba-ai-skill-find': []
    };
    const $ = (id) => document.getElementById(id);

    function hasText(id) {
        return [id].concat(BOXES[id] || []).some((k) => { const el = $(k); return !!(el && String(el.value || '').trim()); });
    }
    function refresh(id) {
        const btn = document.querySelector('.iba-clear-x[data-clear-for="' + id + '"]');
        const box = $(id);
        if (!btn || !box) return;
        btn.hidden = !hasText(id);
        if (btn.hidden || !box.offsetParent) return;
        // sits over the right end of the box, whatever the row layout is
        btn.style.left = (box.offsetLeft + box.offsetWidth - 30) + 'px';
        btn.style.top = (box.offsetTop + Math.round((Math.min(box.offsetHeight, 44) - 24) / 2)) + 'px';
    }
    function ensure(id) {
        const box = $(id);
        if (!box || box.dataset.ibaClear) return;
        box.dataset.ibaClear = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'iba-clear-x';
        btn.dataset.clearFor = id;
        btn.title = 'Clear';
        btn.setAttribute('aria-label', 'Clear');
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        btn.hidden = true;
        // keep the box focused (phone keyboard stays open)
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            [id].concat(BOXES[id] || []).forEach((k) => {
                const el = $(k);
                if (!el) return;
                el.value = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
            });
            if (box.tagName === 'TEXTAREA') box.style.height = '';
            btn.hidden = true;
            try { box.focus(); } catch (_) {}
        });
        const host = box.parentElement;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        box.classList.add('iba-has-clear');
        host.appendChild(btn);
        refresh(id);
    }
    function owner(el) {
        if (!el || !el.id) return null;
        if (BOXES[el.id]) return el.id;
        return Object.keys(BOXES).find((k) => BOXES[k].indexOf(el.id) !== -1) || null;
    }
    function onEvent(e) {
        const id = owner(e.target);
        if (!id) return;
        ensure(id);
        refresh(id);
    }
    document.addEventListener('input', onEvent, true);
    document.addEventListener('focusin', onEvent, true);
    document.addEventListener('change', onEvent, true);
    // boxes filled by a chip or a link (no typing): check now and then while the panel is open
    setInterval(() => {
        const panel = $('iba-ai-panel');
        if (!panel || panel.hidden) return;
        Object.keys(BOXES).forEach((id) => { if ($(id)) { ensure(id); refresh(id); } });
    }, 1000);
})();
