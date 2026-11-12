/* 17.0.5 patch 197 (martin): small copy icon next to the invoice number
 *   - WorkDesk Active Task: inside the Ref chip of each row (copies without opening the PDF)
 *   - Invoice Entry pop-up: at the right end of the "Invoice No." box
 *   - 18.0.0 (martin): Invoice Entry "Existing Invoices" table, after each Inv No. (copies, does not open the invoice)
 * Tap = copied, the icon turns into a green tick for 1.2 s. */
(function () {
    'use strict';
    if (window.ibaCopyInv) return;
    var ICON = '<i class="fa-regular fa-copy"></i>';
    function btn(cls) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'iba-cpy ' + (cls || ''); b.setAttribute('data-cpy', '');
        b.title = 'Copy invoice number'; b.setAttribute('aria-label', 'Copy invoice number'); b.tabIndex = -1;
        b.innerHTML = ICON; return b;
    }
    function copyText(t) {
        t = String(t || '').trim(); if (!t) return Promise.reject();
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { return fallback(t); });
        return fallback(t);
    }
    function fallback(t) {
        return new Promise(function (ok, bad) {
            var a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(a); a.select();
            var done = false; try { done = document.execCommand('copy'); } catch (_) {}
            a.remove(); done ? ok() : bad();
        });
    }
    function textFor(b) {
        var cell = b.closest('td[data-cpy-cell]');
        if (cell) { var k = cell.cloneNode(true); k.querySelectorAll('.iba-cpy').forEach(function (x) { x.remove(); }); return k.textContent; }
        var chip = b.closest('.wd-ref-chip');
        if (chip) { var c = chip.cloneNode(true); c.querySelectorAll('.iba-cpy').forEach(function (x) { x.remove(); }); return c.textContent; }
        var w = b.closest('.iba-cpy-wrap'); var inp = w && w.querySelector('input');
        return inp ? inp.value : '';
    }
    // capture: the row's own click (open PDF) must not run
    document.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-cpy]');
        if (!b) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        copyText(textFor(b)).then(function () {
            b.classList.add('is-done'); b.innerHTML = '<i class="fa-solid fa-check"></i>'; b.title = 'Copied';
            clearTimeout(b.__t); b.__t = setTimeout(function () { b.classList.remove('is-done'); b.innerHTML = ICON; b.title = 'Copy invoice number'; }, 1200);
        }, function () { b.title = 'Could not copy'; });
    }, true);
    ['mousedown', 'pointerdown', 'dblclick'].forEach(function (ev) {
        document.addEventListener(ev, function (e) { if (e.target && e.target.closest && e.target.closest('[data-cpy]')) e.stopPropagation(); }, true);
    });

    function decorate() {
        document.querySelectorAll('#active-task-table-body .wd-ref-chip').forEach(function (chip) {
            if (chip.querySelector('.iba-cpy')) return;
            if (!String(chip.textContent || '').trim()) return;
            chip.appendChild(btn('is-chip'));
        });
        document.querySelectorAll('#im-invoices-table-body > tr > td:nth-child(2)').forEach(function (td) {
            if (td.querySelector('.iba-cpy') || td.querySelector('input,select,textarea')) return;
            if (!String(td.textContent || '').trim()) return;
            td.setAttribute('data-cpy-cell', '');
            td.appendChild(btn('is-cell'));
        });
        var inp = document.getElementById('im-inv-no');
        if (inp && !inp.parentElement.classList.contains('iba-cpy-wrap')) {
            var w = document.createElement('span'); w.className = 'iba-cpy-wrap';
            inp.parentElement.insertBefore(w, inp); w.appendChild(inp); w.appendChild(btn('is-field'));
        }
    }
    var t = 0;
    function soon() { if (!t) t = setTimeout(function () { t = 0; decorate(); }, 120); }
    function boot() {
        decorate();
        var tb = document.getElementById('active-task-table-body');
        try { new MutationObserver(soon).observe(tb || document.body, { childList: true, subtree: true }); } catch (_) {}
        var ib = document.getElementById('im-invoices-table-body');
        try { if (ib) new MutationObserver(soon).observe(ib, { childList: true, subtree: true }); } catch (_) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    window.ibaCopyInv = { decorate: decorate };
})();
