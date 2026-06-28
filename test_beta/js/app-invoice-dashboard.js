// =================================================================================================
// IBA WorkDesk - Invoice Management Dashboard Module
// Version 8.1.6
// Purpose: Dashboard chart/top-list rendering moved out of app.js without changing behavior.
// =================================================================================================

async function populateInvoiceDashboard(forceRefresh = false) {
    const dashboardSection = document.getElementById('im-dashboard');
    dashboardSection.innerHTML = `
        <h1>Dashboard</h1>
        <div class="im-dashboard-grid">
            <div class="im-chart-card">
                <h2>Top 5 Vendors</h2>
                <ul id="top-vendors-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Project Sites</h2>
                <ul id="top-projects-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card">
                <h2>Top 5 Activities</h2>
                <ul id="top-activities-list" class="dashboard-top5-list"></ul>
            </div>
            <div class="im-chart-card full-width-card">
                <div class="dashboard-chart-header">
                    <h2>Yearly Overview</h2>
                    <div class="dashboard-chart-controls">
                        <select id="im-yearly-chart-year-select"></select>
                        <button id="im-dashboard-refresh-btn" class="secondary-btn" title="Force refresh data"><i class="fa-solid fa-sync"></i></button>
                    </div>
                </div>
                <div class="im-chart-container-full">
                    <canvas id="imYearlyChartCanvas"></canvas>
                </div>
            </div>
        </div>
    `;

    const topVendorsList = document.getElementById('top-vendors-list');
    const topProjectsList = document.getElementById('top-projects-list');
    const topActivitiesList = document.getElementById('top-activities-list');
    const yearSelect = document.getElementById('im-yearly-chart-year-select');

    const showLoading = (list) => {
        if (list) list.innerHTML = '<li>Loading...</li>';
    };
    showLoading(topVendorsList);
    showLoading(topProjectsList);
    showLoading(topActivitiesList);

    try {
        const data = await ensureEcostDataFetched(forceRefresh);

        if (!data) {
            dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please try again later.</p>';
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
                if (month !== null) {
                    yearlyData[year]['Total Committed'][month] += row['Total Committed'];
                    yearlyData[year]['Delivered Amount'][month] += row['Delivered Amount'];
                    yearlyData[year]['Outstanding'][month] += row['Outstanding'];
                }
            }
        });

        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

        yearSelect.innerHTML = '';
        if (sortedYears.length === 0) {
            document.getElementById('imYearlyChartCanvas').style.display = 'none';
            yearSelect.innerHTML = '<option>No data</option>';
            topVendorsList.innerHTML = '<li>No data found.</li>';
            topProjectsList.innerHTML = '<li>No data found.</li>';
            topActivitiesList.innerHTML = '<li>No data found.</li>';
            return;
        }

        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        const updateTop5Lists = (selectedYear) => {
            const yearData = allEcostData.filter(row => row['Year'] === selectedYear);

            const getTop5 = (data, keyField, valueField) => {
                const aggregated = data.reduce((acc, row) => {
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

            const renderTop5List = (listElement, data) => {
                if (!listElement) return;
                listElement.innerHTML = '';
                if (data.length === 0) {
                    listElement.innerHTML = '<li>No data found.</li>';
                    return;
                }
                data.forEach(([name, value]) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="top5-name">${name || 'N/A'}</span>
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
    const ctx = document.getElementById('imYearlyChartCanvas').getContext('2d');
    const dataForYear = yearlyData[selectedYear];
    if (!dataForYear) return;

    const monthlyCommitted = dataForYear['Total Committed'];   // new POs per month
    const monthlyDelivered = dataForYear['Delivered Amount'];  // deliveries per month

    // Build cumulative arrays (full year)
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

    // Find months where delivery > 0
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const activeIndices = [];
    for (let i = 0; i < 12; i++) {
        if (monthlyDelivered[i] > 0) activeIndices.push(i);
    }

    // If no active months, show a message
    if (activeIndices.length === 0) {
        if (imYearlyChart) imYearlyChart.destroy();
        document.getElementById('imYearlyChartCanvas').style.display = 'none';
        const container = document.querySelector('.im-chart-container-full');
        if (container) container.innerHTML = '<div style="text-align:center; padding:40px;">No delivery data for this year.</div>';
        return;
    }

    // Filter data for active months only
    const filteredLabels = activeIndices.map(i => months[i]);
    const filteredBlue = activeIndices.map(i => cumulativeCommitted[i]);
    const filteredGreen = activeIndices.map(i => monthlyDelivered[i]);
    const filteredYellow = activeIndices.map(i => cumulativeOutstanding[i]);

    if (imYearlyChart) imYearlyChart.destroy();

    const colors = {
        blue: 'rgba(54, 162, 235, 1)',
        green: 'rgba(75, 192, 192, 1)',
        yellow: 'rgba(255, 206, 86, 1)'
    };

    imYearlyChart = new Chart(ctx, {
        type: 'line',  // ← changed from 'bar' to 'line'
        data: {
            labels: filteredLabels,
            datasets: [
                {
                    label: 'Cumulative Committed',
                    data: filteredBlue,
                    borderColor: colors.blue,
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,          // smooth curve
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
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,
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
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,
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
                    labels: { color: 'rgba(230, 241, 255, 0.9)' }
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
                    ticks: { color: 'rgba(168, 178, 209, 0.7)' },
                    grid: { color: 'rgba(48, 63, 96, 0.5)' }
                },
                y: {
                    ticks: {
                        callback: (value) => {
                            if (value >= 1000000) return `QAR ${value / 1000000}M`;
                            if (value >= 1000) return `QAR ${value / 1000}K`;
                            return `QAR ${value}`;
                        },
                        color: 'rgba(168, 178, 209, 0.7)'
                    },
                    grid: { color: 'rgba(48, 63, 96, 0.5)' }
                }
            }
        }
    });
};

        const initialYear = parseInt(sortedYears[0]);
        renderYearlyChart(initialYear);
        updateTop5Lists(initialYear);

        yearSelect.addEventListener('change', (e) => {
            const selectedYear = parseInt(e.target.value);
            renderYearlyChart(selectedYear);
            updateTop5Lists(selectedYear);
        });        const refreshBtn = document.getElementById('im-dashboard-refresh-btn');
        if (refreshBtn) {
            const run = async () => {
                alert('Forcing dashboard refresh... This may take a moment.');
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
        dashboardSection.innerHTML = '<h1>Dashboard</h1><p>Error loading dashboard data. Please check console for details.</p>';
    }
}
