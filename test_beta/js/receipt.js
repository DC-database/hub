// receipt.js — 12.6.2 Approval Preview
(function () {
    function esc(v) {
        return String(v ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function money(v) {
        const n = Number(v || 0);
        return n.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getData() {
        const raw = localStorage.getItem('approvalPrintData');
        if (!raw) throw new Error('No approval print data is available.');
        return JSON.parse(raw);
    }

    document.addEventListener('DOMContentLoaded', function () {
        try {
            const data = getData();
            const title = document.getElementById('receipt-title');
            const date = document.getElementById('footer-date');
            const esn = document.getElementById('footer-esn');

            if (title) title.textContent = data.title || 'APPROVED';
            if (date) date.textContent = data.date || new Date().toLocaleDateString('en-GB');
            if (esn) esn.textContent = data.approver || '';

            const list = document.getElementById('approved-print-list');
            if (list) {
                const tasks = Array.isArray(data.tasks) ? data.tasks : [];
                list.innerHTML = `
                    <div class="approval-count">${tasks.length} approved item${tasks.length === 1 ? '' : 's'}</div>
                    ${tasks.map((task) => `
                        <div class="approval-item">
                            <div class="approval-status">APPROVED</div>
                            <div class="approval-esn">${esc(task.esn || '')}</div>
                            <div class="approval-detail"><strong>PO:</strong> ${esc(task.po || 'N/A')}</div>
                            <div class="approval-detail"><strong>INV:</strong> ${esc(task.inv || 'N/A')}</div>
                            <div class="approval-detail"><strong>Vendor:</strong> ${esc(task.vendor || 'N/A')}</div>
                            <div class="approval-detail"><strong>Site:</strong> ${esc(task.site || 'N/A')}</div>
                            <div class="approval-detail"><strong>Amount:</strong> QAR ${money(task.amount)}</div>
                        </div>
                    `).join('')}
                `;
            }

            const send = document.getElementById('send-whatsapp-btn');
            if (send) {
                send.disabled = false;
                send.addEventListener('click', function () {
                    const lines = ['APPROVAL', ''];
                    (data.tasks || []).forEach(task => {
                        lines.push(`ESN: ${task.esn || ''}`);
                        lines.push(`PO: ${task.po || 'N/A'}`);
                        lines.push(`INV: ${task.inv || 'N/A'}`);
                        lines.push(`Vendor: ${task.vendor || 'N/A'}`);
                        lines.push(`Site: ${task.site || 'N/A'}`);
                        lines.push(`Invoice Amount: QAR ${money(task.amount)}`);
                        lines.push('');
                    });
                    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
                });
            }

            const print = document.getElementById('print-receipt-btn');
            if (print) print.addEventListener('click', function () {
                window.print();
            });

            const autoPrint = new URLSearchParams(window.location.search).get('autoprint');
            if (autoPrint === '1') {
                setTimeout(() => window.print(), 250);
            }
        } catch (error) {
            document.body.innerHTML =
                '<div style="font-family:Arial,sans-serif;text-align:center;padding:40px;">' +
                '<h2>Approval Print Unavailable</h2><p>' +
                esc(error.message || error) + '</p></div>';
        }
    });
})();
