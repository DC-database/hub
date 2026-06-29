// =================================================================================================
// IBA WorkDesk - Invoice Management Dashboard Module
// Version 8.4.9
// Purpose: Premium Invoice Management dashboard UI polish only. Existing data source and chart logic preserved.
// =================================================================================================

async function populateInvoiceDashboard(forceRefresh = false) {
    const dashboardSection = document.getElementById('im-dashboard');
    if (!dashboardSection) return;

    dashboardSection.innerHTML = `
        <div class="im-premium-dashboard-shell">
            <div class="im-dashboard-hero">
                <div class="im-dashboard-hero-main">
                    <div class="im-dashboard-eyebrow">Invoice Management</div>
                    <div class="im-dashboard-title-row">
                        <div class="icon-wrapper im-dashboard-title-icon"><i class="fa-solid fa-building-columns"></i></div>
                        <h1><span class="im-command-title-text">Invoice Dashboard</span></h1>
                    </div>
                    <p>Monitor committed values, delivered amounts, outstanding balances, top vendors, project sites, and activity flow from one clean management view.</p>
                </div>
                <div class="im-dashboard-hero-actions">
                    <button id="im-dashboard-refresh-btn" class="im-dashboard-refresh-btn" type="button" title="Force refresh data">
                        <i class="fa-solid fa-rotate"></i>
                        Refresh Data
                    </button>
                </div>
            </div>

            <div class="im-dashboard-summary-row" id="im-dashboard-summary-row">
                <div class="im-dashboard-summary-card loading"><span>Loading</span><strong>--</strong><small>Total committed</small></div>
                <div class="im-dashboard-summary-card loading"><span>Loading</span><strong>--</strong><small>Delivered amount</small></div>
                <div class="im-dashboard-summary-card loading"><span>Loading</span><strong>--</strong><small>Outstanding balance</small></div>
                <div class="im-dashboard-summary-card loading"><span>Loading</span><strong>--</strong><small>Active months</small></div>
            </div>

            <div class="im-dashboard-quick-actions" aria-label="Invoice quick actions">
                <button type="button" class="im-dashboard-action-tile" data-im-jump="im-invoice-entry">
                    <i class="fa-solid fa-file-pen"></i>
                    <span>Invoice Entry</span>
                    <small>Create or continue invoice entry</small>
                </button>
                <button type="button" class="im-dashboard-action-tile" data-im-jump="im-batch-entry">
                    <i class="fa-solid fa-table-list"></i>
                    <span>Batch Entry</span>
                    <small>Update multiple invoices safely</small>
                </button>
                <button type="button" class="im-dashboard-action-tile" data-im-jump="im-reporting">
                    <i class="fa-solid fa-chart-line"></i>
                    <span>Invoice Records</span>
                    <small>Search complete invoice records</small>
                </button>
                <button type="button" class="im-dashboard-action-tile" data-im-jump="im-summary-note">
                    <i class="fa-solid fa-receipt"></i>
                    <span>Summary Note</span>
                    <small>Prepare payment summary notes</small>
                </button>
                <button type="button" class="im-dashboard-action-tile" data-im-jump="im-payments">
                    <i class="fa-solid fa-money-check-dollar"></i>
                    <span>Payments</span>
                    <small>Review payment records</small>
                </button>
            </div>

            <div class="im-dashboard-grid im-dashboard-premium-grid">
                <div class="im-chart-card im-premium-rank-card">
                    <div class="im-card-title-row">
                        <div>
                            <span class="im-card-kicker">Procurement</span>
                            <h2>Top 5 Vendors</h2>
                        </div>
                        <i class="fa-solid fa-ranking-star"></i>
                    </div>
                    <ul id="top-vendors-list" class="dashboard-top5-list im-premium-top5-list"></ul>
                </div>
                <div class="im-chart-card im-premium-rank-card">
                    <div class="im-card-title-row">
                        <div>
                            <span class="im-card-kicker">Projects</span>
                            <h2>Top 5 Project Sites</h2>
                        </div>
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <ul id="top-projects-list" class="dashboard-top5-list im-premium-top5-list"></ul>
                </div>
                <div class="im-chart-card im-premium-rank-card">
                    <div class="im-card-title-row">
                        <div>
                            <span class="im-card-kicker">Scope</span>
                            <h2>Top 5 Activities</h2>
                        </div>
                        <i class="fa-solid fa-layer-group"></i>
                    </div>
                    <ul id="top-activities-list" class="dashboard-top5-list im-premium-top5-list"></ul>
                </div>
                <div class="im-chart-card full-width-card im-dashboard-flow-card">
                    <div class="dashboard-chart-header im-dashboard-flow-header">
                        <div>
                            <span class="im-card-kicker">Finance Flow</span>
                            <h2>Yearly Overview</h2>
                            <p>Committed, delivered, and outstanding movement by active month.</p>
                        </div>
                        <div class="dashboard-chart-controls im-dashboard-chart-controls">
                            <select id="im-yearly-chart-year-select" aria-label="Select dashboard year"></select>
                        </div>
                    </div>
                    <div class="im-chart-container-full im-premium-chart-container">
                        <canvas id="imYearlyChartCanvas"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    const topVendorsList = document.getElementById('top-vendors-list');
    const topProjectsList = document.getElementById('top-projects-list');
    const topActivitiesList = document.getElementById('top-activities-list');
    const yearSelect = document.getElementById('im-yearly-chart-year-select');
    const summaryRow = document.getElementById('im-dashboard-summary-row');

    const showLoading = (list) => {
        if (list) list.innerHTML = '<li class="im-dashboard-list-loading">Loading dashboard data...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    const jumpButtons = dashboardSection.querySelectorAll('[data-im-jump]');
    jumpButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-im-jump');
            const navLink = document.querySelector(`#im-nav a[data-section="${target}"]`);
            if (navLink) {
                navLink.click();
            } else if (typeof showIMSection === 'function') {
                showIMSection(target);
            }
        });
    });

    try {
        const data = await ensureEcostDataFetched(forceRefresh);

        if (!data) {
            dashboardSection.innerHTML = `
                <div class="im-dashboard-error-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h2>Unable to load dashboard data</h2>
                    <p>Please refresh or check the connection.</p>
                </div>`;
            return;
        }

        const yearlyData = {};
        const availableYears = new Set();

        data.forEach(row => {
            const year = row['Year'];
            if (year) {
                availableYears.add(year);
                if (!yearlyData[year]) {
                    yearlyData[year] = {
                        'Total Committed': Array(12).fill(0),
                        'Delivered Amount': Array(12).fill(0),
                        'Outstanding': Array(12).fill(0),
                    };
                }
                const month = row['Month'];
                if (month !== null && month !== undefined && month >= 0 && month < 12) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

        yearSelect.innerHTML = '';
        if (sortedYears.length === 0) {
            const chart = document.getElementById('imYearlyChartCanvas');
            if (chart) chart.style.display = 'none';
            yearSelect.innerHTML = '<option>No data</option>';
            topVendorsList.innerHTML = '<li class="im-dashboard-empty-line">No data found.</li>';
            topProjectsList.innerHTML = '<li class="im-dashboard-empty-line">No data found.</li>';
            topActivitiesList.innerHTML = '<li class="im-dashboard-empty-line">No data found.</li>';
            if (summaryRow) {
                summaryRow.innerHTML = '<div class="im-dashboard-summary-card wide"><span>No Records</span><strong>0</strong><small>No dashboard records found.</small></div>';
            }
            return;
        }

        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        const updateSummaryCards = (selectedYear) => {
            const dataForYear = yearlyData[selectedYear];
            if (!dataForYear || !summaryRow) return;

            const totalCommitted = dataForYear['Total Committed'].reduce((a, b) => a + b, 0);
            const totalDelivered = dataForYear['Delivered Amount'].reduce((a, b) => a + b, 0);
            const totalOutstanding = Math.max(totalCommitted - totalDelivered, dataForYear['Outstanding'].slice(-1)[0] || 0);
            const activeMonths = dataForYear['Delivered Amount'].filter(v => v > 0).length || dataForYear['Total Committed'].filter(v => v > 0).length;

            summaryRow.innerHTML = `
                <div class="im-dashboard-summary-card committed">
                    <span>Total Committed</span>
                    <strong>QAR ${formatCurrency(totalCommitted)}</strong>
                    <small>Selected year ${selectedYear}</small>
                </div>
                <div class="im-dashboard-summary-card delivered">
                    <span>Delivered Amount</span>
                    <strong>QAR ${formatCurrency(totalDelivered)}</strong>
                    <small>Movement already delivered</small>
                </div>
                <div class="im-dashboard-summary-card outstanding">
                    <span>Outstanding Balance</span>
                    <strong>QAR ${formatCurrency(totalOutstanding)}</strong>
                    <small>Still pending delivery/value</small>
                </div>
                <div class="im-dashboard-summary-card months">
                    <span>Active Months</span>
                    <strong>${activeMonths}</strong>
                    <small>Months with movement</small>
                </div>
            `;
        };

        const updateTop5Lists = (selectedYear) => {
            const source = Array.isArray(allEcostData) && allEcostData.length ? allEcostData : data;
            const yearData = source.filter(row => row['Year'] === selectedYear);

            const getTop5 = (rows, keyField, valueField) => {
                const aggregated = rows.reduce((acc, row) => {
                    const key = row[keyField];
                    if (key) {
                        acc[key] = (acc[key] || 0) + row[valueField];
                    }
                    return acc;
                }, {});

                return Object.entries(aggregated)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);
            };

            const renderTop5List = (listElement, rows) => {
                if (!listElement) return;
                listElement.innerHTML = '';
                if (rows.length === 0) {
                    listElement.innerHTML = '<li class="im-dashboard-empty-line">No data found.</li>';
                    return;
                }
                const max = Math.max(...rows.map(([, value]) => value), 1);
                rows.forEach(([name, value], index) => {
                    const percent = Math.max(8, Math.round((value / max) * 100));
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="im-top5-rank">${index + 1}</div>
                        <div class="im-top5-main">
                            <span class="top5-name">${name || 'N/A'}</span>
                            <div class="im-top5-bar"><span style="width:${percent}%"></span></div>
                        </div>
                        <span class="top5-value">QAR ${formatCurrency(value)}</span>
                    `;
                    listElement.appendChild(li);
                });
            };

            renderTop5List(topVendorsList, getTop5(yearData, 'Vendor', 'Total Committed'));
            renderTop5List(topProjectsList, getTop5(yearData, 'Project #', 'Total Committed'));
            renderTop5List(topActivitiesList, getTop5(yearData, 'Activity Name', 'Total Committed'));
        };

        const renderYearlyChart = (selectedYear) => {
            const canvas = document.getElementById('imYearlyChartCanvas');
            const container = document.querySelector('.im-premium-chart-container');
            if (!canvas || !container) return;

            canvas.style.display = 'block';
            const oldMsg = container.querySelector('.im-dashboard-chart-empty');
            if (oldMsg) oldMsg.remove();

            const ctx = canvas.getContext('2d');
            const dataForYear = yearlyData[selectedYear];
            if (!dataForYear) return;

            const monthlyCommitted = dataForYear['Total Committed'];
            const monthlyDelivered = dataForYear['Delivered Amount'];

            let cumCommitted = 0;
            let cumDelivered = 0;
            const cumulativeCommitted = [];
            const cumulativeOutstanding = [];
            for (let i = 0; i < 12; i++) {
                cumCommitted += monthlyCommitted[i];
                cumDelivered += monthlyDelivered[i];
                cumulativeCommitted.push(cumCommitted);
                cumulativeOutstanding.push(cumCommitted - cumDelivered);
            }

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const activeIndices = [];
            for (let i = 0; i < 12; i++) {
                if (monthlyDelivered[i] > 0 || monthlyCommitted[i] > 0) activeIndices.push(i);
            }

            if (activeIndices.length === 0) {
                if (imYearlyChart) imYearlyChart.destroy();
                canvas.style.display = 'none';
                container.insertAdjacentHTML('beforeend', '<div class="im-dashboard-chart-empty"><i class="fa-regular fa-folder-open"></i><span>No movement data for this year.</span></div>');
                return;
            }

            const filteredLabels = activeIndices.map(i => months[i]);
            const filteredBlue = activeIndices.map(i => cumulativeCommitted[i]);
            const filteredGreen = activeIndices.map(i => monthlyDelivered[i]);
            const filteredYellow = activeIndices.map(i => cumulativeOutstanding[i]);

            if (imYearlyChart) imYearlyChart.destroy();

            const colors = {
                blue: 'rgba(14, 116, 144, 1)',
                green: 'rgba(22, 163, 74, 1)',
                yellow: 'rgba(245, 158, 11, 1)'
            };

            imYearlyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: filteredLabels,
                    datasets: [
                        {
                            label: 'Cumulative Committed',
                            data: filteredBlue,
                            borderColor: colors.blue,
                            backgroundColor: 'rgba(14, 116, 144, .08)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.34,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: colors.blue,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Monthly Delivered',
                            data: filteredGreen,
                            borderColor: colors.green,
                            backgroundColor: 'rgba(22, 163, 74, .08)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.34,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: colors.green,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Outstanding Balance',
                            data: filteredYellow,
                            borderColor: colors.yellow,
                            backgroundColor: 'rgba(245, 158, 11, .08)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.34,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: colors.yellow,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: '#334155',
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8,
                                boxHeight: 8,
                                font: { weight: '700' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) {
                                        label += `QAR ${formatCurrency(context.parsed.y)}`;
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#64748b', font: { weight: '700' } },
                            grid: { color: 'rgba(148, 163, 184, 0.15)' }
                        },
                        y: {
                            ticks: {
                                callback: (value) => {
                                    if (value >= 1000000) return `QAR ${value / 1000000}M`;
                                    if (value >= 1000) return `QAR ${value / 1000}K`;
                                    return `QAR ${value}`;
                                },
                                color: '#64748b',
                                font: { weight: '700' }
                            },
                            grid: { color: 'rgba(148, 163, 184, 0.18)' }
                        }
                    }
                }
            });
        };

        const initialYear = parseInt(sortedYears[0]);
        updateSummaryCards(initialYear);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            const selectedYear = parseInt(e.target.value);
            updateSummaryCards(selectedYear);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });

        const refreshBtn = document.getElementById('im-dashboard-refresh-btn');
        if (refreshBtn) {
            const run = async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
                await populateInvoiceDashboard(true);
            };
            if (window.__attachRefreshCooldown) {
                window.__attachRefreshCooldown(refreshBtn, 'im-dashboard-refresh', run, 30);
            } else {
                refreshBtn.addEventListener('click', run);
            }
        }

    } catch (error) {
        console.error("Error populating invoice dashboard:", error);
        dashboardSection.innerHTML = `
            <div class="im-dashboard-error-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h2>Error loading dashboard data</h2>
                <p>Please check the console for details.</p>
            </div>`;
    }
}
