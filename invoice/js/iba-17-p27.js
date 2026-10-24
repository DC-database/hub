/* ==========================================================================
   js/iba-17-p27.js — 17.0.0 patch 27 (patch 28: full A4 width, no side bar)
   Summary Note print, new design (option C): bigger text, cards for vendor /
   previous / current payment with the QR, full bill description, site tag on
   each row, amount in words next to a bold total card, signature lines.
   Just before printing, the page fills #sn-c from what is on screen (the
   edited description and date boxes included). The screen view is unchanged;
   only the print uses #sn-c (css/iba-17-p27.css).
   #sn-c sits directly in <body> and draws its content in a shadow root, so
   the app's own styles (themes, the old print rules) cannot change it, and
   it starts at the top left of the A4 page at full width.
   ========================================================================== */
(function () {
    'use strict';

    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const txt = (id) => { const el = document.getElementById(id); return el ? String(el.textContent || '').trim() : ''; };
    const STYLE = [
        ':host{all:initial;display:block;visibility:visible}',
        '*{box-sizing:border-box;visibility:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
        '.p{--b:#0e4d7a;--b2:#e9f2f8;--b3:#cfe0ec;--ink:#14212d;--mut:#617180;font-family:"Segoe UI",Inter,Arial,sans-serif;color:var(--ink);font-size:11pt;line-height:1.35;padding:0 1mm}',
        '.hd{display:flex;justify-content:space-between;align-items:center}',
        '.logo{width:72mm;height:auto;display:block}',
        '.badge{background:var(--b2);color:var(--b);border-radius:999px;padding:1.6mm 4mm;font-size:9.5pt;font-weight:700;letter-spacing:1px}',
        '.title{display:flex;justify-content:space-between;align-items:flex-end;margin-top:5mm}',
        'h1{margin:0;font-size:28pt;font-weight:800;letter-spacing:-.5px;color:var(--ink);line-height:1.1}',
        'h1 span{color:var(--b)}',
        '.title p{margin:0;font-size:11pt;color:var(--mut);text-align:right;line-height:1.5}.title p b{color:var(--ink)}',
        '.cards{display:grid;grid-template-columns:1.3fr 1fr 1fr 25mm;gap:2.6mm;margin-top:4.5mm;break-inside:avoid}',
        '.cards.no-qr{grid-template-columns:1.3fr 1fr 1fr}',
        '.cd{background:var(--b2);border:.4mm solid #9fb3c2;border-radius:2.6mm;padding:3mm 3.6mm}',
        '.cd span{display:block;font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700}',
        '.cd b{display:block;margin-top:1mm;font-size:14.5pt;line-height:1.2;font-variant-numeric:tabular-nums}',
        '.cd b i{font-style:normal;font-size:9pt;color:var(--mut);margin-left:1mm;font-weight:600}',
        '.cd.vendor b{font-size:13pt}',
        '.cd.dark{background:var(--b);border-color:var(--b);color:#fff}.cd.dark span,.cd.dark b i{color:#bcd6e8}',
        '.cd.qr{background:#fff;border:.4mm solid #9fb3c2;padding:2mm;text-align:center}',
        '.qrb{width:16mm;height:16mm;margin:0 auto}.qrb img{width:100%;height:100%;display:block}',
        '.cd.qr small{display:block;font-size:7.5pt;color:var(--mut);font-weight:700;margin-top:.8mm;line-height:1.2}',
        'table{width:100%;border-collapse:separate;border-spacing:0;margin-top:5mm;font-size:11pt}',
        'thead{display:table-header-group}',
        'th{font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;color:#fff;text-align:left;padding:2.4mm 2mm;background:var(--b);white-space:nowrap;font-weight:700;border:0}',
        'th:first-child{border-radius:2mm 0 0 0}th:last-child{border-radius:0 2mm 0 0}',
        'td{padding:2.4mm 2mm;border-bottom:.3mm solid #9fb3c2;vertical-align:top}',
        'tbody tr:last-child td{border-bottom:.4mm solid var(--b)}',
        'tr{break-inside:avoid}',
        '.c{text-align:center;white-space:nowrap}.nw{white-space:nowrap}.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.r{font-weight:600}',
        '.pill{display:inline-block;background:var(--b2);color:var(--b);font-weight:700;font-size:9.5pt;border-radius:1.3mm;padding:.2mm 1.8mm}',
        '.sum{display:grid;grid-template-columns:1fr 72mm;gap:3.6mm;margin-top:4mm;break-inside:avoid}',
        '.words{border:.4mm solid #9fb3c2;border-radius:2.6mm;padding:3mm 3.6mm;font-size:10.5pt;line-height:1.4}',
        '.words span{display:block;font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:.8mm}',
        '.total{background:#fff;color:var(--ink);border:.4mm solid #9fb3c2;border-radius:2.6mm;padding:3mm 4.6mm;text-align:right}',
        '.total span{font-size:8.5pt;letter-spacing:1.5px;color:var(--mut);font-weight:700;text-transform:uppercase}',
        '.total b{display:block;font-size:17pt;font-variant-numeric:tabular-nums;color:var(--ink)}',
        '.note{margin-top:3.6mm;font-size:10.5pt;color:#33424f;white-space:pre-wrap;break-inside:avoid}',
        '.note b{color:var(--b);font-size:8.5pt;letter-spacing:1px;text-transform:uppercase;margin-right:2mm}',
        '.sign{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:22mm;break-inside:avoid}',
        '.sign div{border-top:.4mm solid var(--ink);padding-top:2mm;display:flex;justify-content:space-between;align-items:baseline}',
        '.sign b{font-size:11.5pt}.sign small{font-size:9pt;color:var(--mut)}'
    ].join('\n');
    const amount = (s) => String(s || '').replace(/\s*Qatari Riyals?\s*$/i, '').trim();

    function fmtDate(v) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
        return m ? m[3] + '-' + MONTHS[Number(m[2]) - 1] + '-' + m[1] : String(v || '');
    }
    function description(input) {
        if (!input) return '';
        const full = input.getAttribute('data-print-full');
        // the user changed the box: print what they typed
        if (full == null || input.value !== input.defaultValue) return input.value;
        return full || input.value;
    }
    function qrHtml() {
        const box = document.getElementById('sn-prev-summary-qr');
        if (!box) return '';
        const canvas = box.querySelector('canvas');
        const img = box.querySelector('img');
        let src = '';
        try { if (canvas && canvas.width) src = canvas.toDataURL('image/png'); } catch (_) {}
        if (!src && img && img.getAttribute('src')) src = img.getAttribute('src');
        return src ? '<img alt="" src="' + esc(src) + '">' : '';
    }
    function ensureRoot() {
        let host = document.getElementById('sn-c');
        if (!host) {
            host = document.createElement('div');
            host.id = 'sn-c';
            host.setAttribute('aria-hidden', 'true');
        }
        if (host.parentElement !== document.body) document.body.appendChild(host);
        return host.shadowRoot || host.attachShadow({ mode: 'open' });
    }

    // the note names sit in the bottom margin of every A4 page (@page margin box)
    function pageFooter(text) {
        let st = document.getElementById('sn-c-page');
        if (!st) {
            st = document.createElement('style');
            st.id = 'sn-c-page';
            document.head.appendChild(st);
        }
        const css = String(text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
        st.textContent = '@media print { @page sn-c { margin-bottom: 18mm;' +
            (css ? ' @bottom-left { content: "' + css + '"; font-family: "Segoe UI", Inter, Arial, sans-serif; font-size: 7.5pt; font-style: italic; color: #8a97a3; vertical-align: top; }' : '') +
            ' } }';
    }

    function build() {
        const area = document.getElementById('summary-note-printable-area');
        // only when the Summary Note is really on screen (not for other prints)
        if (!area || area.classList.contains('hidden') || !area.getClientRects().length) return;
        const rows = Array.from(document.querySelectorAll('#sn-table-body tr')).map((tr) => {
            const td = tr.children;
            return {
                sn: td[0] ? td[0].textContent.trim() : '',
                po: td[1] ? td[1].textContent.trim() : '',
                site: td[2] ? td[2].textContent.trim() : '',
                desc: description(tr.querySelector('input[name="details"]')),
                date: fmtDate((tr.querySelector('input[name="invoiceDate"]') || {}).value),
                amt: td[5] ? td[5].textContent.trim() : ''
            };
        });
        const sites = new Set(rows.map((r) => r.site).filter(Boolean)).size;
        const date = txt('sn-date').replace(/^Date:\s*/i, '').replace(/-/g, ' ');
        const prevDate = txt('sn-prev-summary-date').replace(/[()]/g, '').trim();
        const noteInput = document.getElementById('summary-note-custom-notes-input');
        const note = noteInput ? String(noteInput.value || '').trim() : txt('sn-print-notes-content');
        const val = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
        const prevNote = val('summary-note-previous-input');
        const curNote = val('summary-note-current-input');
        const qr = qrHtml();
        const logo = area.querySelector('.sn-print-company img');

        ensureRoot().innerHTML =
            '<style>' + STYLE + '</style><div class="p"><div class="hd">' + (logo ? '<img class="logo" alt="IBA" src="' + esc(logo.getAttribute('src')) + '">' : '<span></span>') +
                '</div>' +
            '<div class="title"><h1>Payment <span>Summary</span></h1>' +
                '<p>Date <b>' + esc(date) + '</b><br><b>' + rows.length + '</b> invoice' + (rows.length === 1 ? '' : 's') + ' · <b>' + sites + '</b> site' + (sites === 1 ? '' : 's') + '</p></div>' +
            '<div class="cards' + (qr ? '' : ' no-qr') + '">' +
                '<div class="cd vendor"><span>Summary for</span><b>' + esc(txt('sn-vendor-name')) + '</b></div>' +
                '<div class="cd"><span>Previous payment</span><b>' + esc(amount(txt('sn-previous-payment'))) + '<i>QAR</i></b></div>' +
                '<div class="cd dark"><span>Current payment</span><b>' + esc(amount(txt('sn-current-payment'))) + '<i>QAR</i></b></div>' +
                (qr ? '<div class="cd qr"><div class="qrb">' + qr + '</div><small>Prev summary' + (prevDate ? '<br>' + esc(prevDate) : '') + '</small></div>' : '') +
            '</div>' +
            '<table><thead><tr><th class="c">S/N</th><th>P.O. No.</th><th class="c">Site</th><th>Bill description</th><th class="c">Bill date</th><th class="r">Amount (QAR)</th></tr></thead><tbody>' +
                rows.map((r) => '<tr><td class="c">' + esc(r.sn) + '</td><td class="nw">' + esc(r.po) + '</td><td class="c">' + (r.site ? '<span class="pill">' + esc(r.site) + '</span>' : '') + '</td><td>' + esc(r.desc) + '</td><td class="c">' + esc(r.date) + '</td><td class="r">' + esc(r.amt) + '</td></tr>').join('') +
            '</tbody></table>' +
            '<div class="sum"><div class="words"><span>Amount in words</span><div>' + esc(txt('sn-total-in-words')) + '</div></div>' +
                '<div class="total"><span>Total current payment · QAR</span><b>' + esc(txt('sn-total-numeric')) + '</b></div></div>' +
            (note ? '<div class="note"><b>Notes</b><span>' + esc(note) + '</span></div>' : '') +
            '<div class="sign"><div><b>Prepared By</b><small>Name · Signature · Date</small></div><div><b>Managing Director</b><small>Name · Signature · Date</small></div></div>' +
            '</div>';
        pageFooter([prevNote ? 'Previous note: ' + prevNote : '', curNote ? 'Current note: ' + curNote : ''].filter(Boolean).join('   ·   '));
        document.body.classList.add('iba-sn-print-c');
    }

    window.addEventListener('beforeprint', build);
    window.addEventListener('afterprint', () => document.body.classList.remove('iba-sn-print-c'));
    // the Print button paints first and then calls window.print(); build here too
    // so the page is ready even where beforeprint comes late
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#summary-note-print-btn')) setTimeout(build, 0);
    }, true);
    window.ibaSummaryPrintBuild = build;
})();
