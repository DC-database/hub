// ==== Firebase Config ====
const firebaseConfig = {
  apiKey: "AIzaSyDeb_IqhFmvkzwD1kmzVqznul9uZZWju3M",
  authDomain: "vehicle-4441a.firebaseapp.com",
  databaseURL: "https://vehicle-4441a-default-rtdb.firebaseio.com",
  projectId: "vehicle-4441a",
  storageBucket: "vehicle-4441a.firebasestorage.app",
  messagingSenderId: "1081587346093",
  appId: "1:1081587346093:web:d92f6ad09e0fdbbc25b424",
  measurementId: "G-CKLQ1RTLHZ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ==== DOM Elements for Auth and App Containers ====
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');

let isAppInitialized = false; // Flag to prevent multiple initializations

// ============ AUTHENTICATION GATE (Single-Page Version) ============
auth.onAuthStateChanged(user => {
    const adminLi = document.getElementById('adminBtn').parentElement;
    const bnAdmin = document.getElementById('bnAdmin');

    if (user) {
        // User is logged in, show the app and hide the login screen
        loginScreen.style.display = 'none';
        appContainer.style.display = 'block';
        
        // --- NEW: Check for Admin User ---
        if (user.email === 'dc@iba.com.qa') {
            adminLi.style.display = 'block';
            bnAdmin.style.display = 'flex';
        } else {
            adminLi.style.display = 'none';
            bnAdmin.style.display = 'none';
            // If a non-admin is on the admin tab, switch them to the dashboard
            if (adminSection.classList.contains('active')) {
                switchReport('dashboard');
            }
        }

        // Initialize the main app logic ONLY if it hasn't been done before
        if (!isAppInitialized) {
            init();
            isAppInitialized = true;
        }
    } else {
        // User is signed out, show the login screen and hide the app
        loginScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        isAppInitialized = false; // Reset for next login
    }
});

// ==== LOGIN FORM LOGIC ====
loginBtn.addEventListener('click', () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
        loginStatus.textContent = 'Please enter both email and password.';
        return;
    }
    loginStatus.textContent = 'Signing in...';

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            let errorMessage = 'Login failed. Please try again.';
            if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid email or password.';
            }
            loginStatus.textContent = errorMessage;
            console.error('Login error:', error);
        });
});
loginPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});


// =========================================================================
// =================== MAIN DASHBOARD APPLICATION LOGIC ====================
// =========================================================================

// Global variables
let allData = [];
let vehicleDataMap = new Map();
let vehicleSummaryData = [];
let book8Data = [];
let openingValue = 0;
let closingValue = 0;
let currentVehicleNumber = '';
let yearlySpendingChart;
let currentChartType = 'bar';

// DOM elements
const loadingIndicator = document.getElementById('loadingIndicator');
const filtersSection = document.querySelector('.filters');
const resultsSection = document.querySelector('.results');
const vehicleNumberInput = document.getElementById('vehicleNumber');
const searchBtn = document.getElementById('searchBtn');
const printBtn = document.getElementById('printBtn');
const yearFilter = document.getElementById('yearFilter');
const descriptionFilter = document.getElementById('descriptionFilter');
const clearBtn = document.getElementById('clearBtn');
const resultsTableBody = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
const resultsTableFooter = document.getElementById('resultsTable').getElementsByTagName('tfoot')[0];
const totalTransactionsSpan = document.getElementById('totalTransactions');
const totalAmountSpan = document.getElementById('totalAmount');
const openingValueSpan = document.getElementById('openingValue');
const closingValueSpan = document.getElementById('closingValue');
const dashboardVehiclesTableBody = document.getElementById('dashboardVehiclesTableBody');

// Dashboard elements
const dashboardSection = document.getElementById('dashboard');
const singleReportSection = document.getElementById('singleReport');
const fullReportSection = document.getElementById('fullReport');
const adminSection = document.getElementById('adminSection');
const dashboardBtn = document.getElementById('dashboardBtn');
const singleReportBtn = document.getElementById('singleReportBtn');
const fullReportBtn = document.getElementById('fullReportBtn');
const adminBtn = document.getElementById('adminBtn');
const dashboardYearFilter = document.getElementById('dashboardYearFilter');
const refreshDashboardBtn = document.getElementById('refreshDashboard');
const toggleChartTypeBtn = document.getElementById('toggleChartType');
const dashboardSearchInput = document.getElementById('dashboardSearch');

// Mobile menu elements
const menuToggle = document.querySelector('.menu-toggle');
const closeMenuBtn = document.querySelector('.close-menu');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.overlay');

// Initialize the application
function init() {
    console.log("Initializing main application...");
    setupEventListeners();
    loadInitialData();
    updateDateTime();
    setInterval(updateDateTime, 60000);
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    document.getElementById('footerDate').textContent = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function setupEventListeners() {
    // Navigation
    const navMapping = {
        'dashboardBtn': { section: 'dashboard', nav: 'bnDashboard' },
        'singleReportBtn': { section: 'single', nav: 'bnSingle' },
        'fullReportBtn': { section: 'full', nav: 'bnFull' },
        'adminBtn': { section: 'admin', nav: 'bnAdmin' },
        'bnDashboard': { section: 'dashboard', nav: 'bnDashboard' },
        'bnSingle': { section: 'single', nav: 'bnSingle' },
        'bnFull': { section: 'full', nav: 'bnFull' },
        'bnAdmin': { section: 'admin', nav: 'bnAdmin' },
    };

    Object.keys(navMapping).forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            const { section, nav } = navMapping[id];
            switchReport(section);
            setBottomNavActive(document.getElementById(nav));
            closeMenuIfOpen();
        });
    });

    // --- NEW: Sign Out Button Listener ---
    document.getElementById('signOutNavBtn').addEventListener('click', () => {
        auth.signOut();
    });

    menuToggle.addEventListener('click', toggleMenu);
    closeMenuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);

    // Dashboard controls
    dashboardYearFilter.addEventListener('change', updateDashboard);
    refreshDashboardBtn.addEventListener('click', updateDashboard);
    toggleChartTypeBtn.addEventListener('click', toggleChartType);
    dashboardSearchInput.addEventListener('input', filterDashboardTable);
    document.getElementById('dashboardClearSearch').addEventListener('click', () => {
        dashboardSearchInput.value = '';
        filterDashboardTable();
    });

    // Single vehicle report
    searchBtn.addEventListener('click', searchTransactions);
    printBtn.addEventListener('click', printReport);
    yearFilter.addEventListener('change', filterResults);
    descriptionFilter.addEventListener('input', filterResults);
    clearBtn.addEventListener('click', clearFilters);
    vehicleNumberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTransactions(); });

    // Full report
    document.getElementById('printFullReportBtn').addEventListener('click', printFullReport);
}

function closeMenuIfOpen() {
    if (sidebar?.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function setBottomNavActive(activeEl) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    if(activeEl) activeEl.classList.add('active');
}

function switchReport(type) {
    const sections = { dashboard: dashboardSection, single: singleReportSection, full: fullReportSection, admin: adminSection };
    const buttons = { dashboard: dashboardBtn, single: singleReportBtn, full: fullReportBtn, admin: adminBtn };

    Object.values(sections).forEach(s => s.classList.remove('active'));
    Object.values(buttons).forEach(b => b.classList.remove('active'));

    if (sections[type]) sections[type].classList.add('active');
    if (buttons[type]) buttons[type].classList.add('active');
    
    if (type === 'full') generateFullReportPreview();
}

function formatFinancial(num) {
    return parseFloat(num || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function loadInitialData() {
    try {
        loadingIndicator.querySelector('p').textContent = 'Fetching transaction records...';
        await Promise.all([loadBook8FromRTDB(), loadCSVFromURL()]);
        loadingIndicator.querySelector('p').textContent = 'Processing data and building dashboard...';
        await new Promise(resolve => setTimeout(resolve, 50)); 
        processData(allData);
        generateVehicleSummary();
        updateDashboard();
        filtersSection.style.display = 'flex';
        resultsSection.style.display = 'block';
        loadingIndicator.style.display = 'none';
    } catch (e) {
        console.error('Error during initial data load:', e);
        loadingIndicator.innerHTML = `
            <div style="color: red; padding: 20px;">
                <h3>Failed to Load Data</h3>
                <p>${e.message}</p>
                <button onclick="location.reload()" class="refresh-btn">Retry</button>
            </div>
        `;
    }
}

async function loadBook8FromRTDB() {
    try {
        const snapshot = await db.ref('registered vehicle').get();
        const val = snapshot.val();
        if (Array.isArray(val)) {
            book8Data = val.filter(Boolean).map(r => ({
                plate: String(r.plate || '').trim(),
                type: String(r.type || '').trim(),
                fleetNo: String(r.fleetNo || '').trim(),
                driver: String(r.driver || '').trim()
            }));
        }
    } catch (e) {
        console.error('Could not load registered vehicles from Firebase.', e);
    }
}

function loadCSVFromURL() {
    return new Promise((resolve, reject) => {
        const url = "https://raw.githubusercontent.com/DC-database/Invoice/main/Vehicle.csv";
        Papa.parse(url, {
            download: true,
            header: true,
            complete: (results) => {
                allData = results.data.filter(row => row && row['Year']);
                resolve();
            },
            error: (error) => {
                console.error('Error loading CSV:', error);
                reject(new Error('Could not fetch vehicle transaction data from GitHub.'));
            }
        });
    });
}

function processData(data) {
    vehicleDataMap.clear();
    const knownVehicleNumbers = new Set(book8Data.map(item => item.plate));
    const nonVehicleKeys = new Set(['Year', 'PO #', 'Project #', 'Description', 'Delivered Amount']);
    data.forEach(row => {
        const transaction = {
            year: row['Year'],
            poNumber: row['PO #'],
            site: row['Project #'],
            description: row['Description'],
            amount: row['Delivered Amount']
        };
        for (const key in row) {
            if (!nonVehicleKeys.has(key) && knownVehicleNumbers.has(key) && row[key] && String(row[key]).trim() !== '') {
                if (!vehicleDataMap.has(key)) {
                    vehicleDataMap.set(key, []);
                }
                vehicleDataMap.get(key).push(transaction);
            }
        }
    });
    populateYearFilter(data);
    populateVehicleDatalist();
}

function populateYearFilter(data) {
    const years = [...new Set(data.map(row => row.Year).filter(Boolean))].sort((a, b) => b - a);
    yearFilter.innerHTML = '<option value="">All Years</option>';
    years.forEach(year => yearFilter.add(new Option(year, year)));
}

function populateVehicleDatalist() {
    const datalist = document.getElementById('vehicleNumbers');
    datalist.innerHTML = '';
    const fragment = document.createDocumentFragment();
    Array.from(vehicleDataMap.keys()).sort().forEach(num => {
        fragment.appendChild(new Option('', num));
    });
    datalist.appendChild(fragment);
}

function updateDashboard() {
    const selectedYear = dashboardYearFilter.value;
    generateVehicleSummary(selectedYear);
    updateDashboardCards(selectedYear);
    renderYearlySpendingChart();
    renderDashboardTable(selectedYear);
}

function updateDashboardCards(selectedYear) {
    const totalVehicles = book8Data.length;
    let totalSpendingAllYears = 0;
    let selectedYearTotal = 0;
    let highestSpender = { plate: '', amount: -1 };
    document.getElementById('yearCardTitle').textContent = selectedYear === 'all' 
        ? `Current Year (${new Date().getFullYear()})`
        : `Selected Year (${selectedYear})`;
    vehicleSummaryData.forEach(vehicle => {
        totalSpendingAllYears += vehicle.total;
        const yearAmount = vehicleDataMap.get(vehicle.plate)?.reduce((sum, t) => {
            const yearCheck = selectedYear === 'all' ? String(new Date().getFullYear()) : selectedYear;
            return t.year === yearCheck ? sum + (parseFloat(t.amount) || 0) : sum;
        }, 0) || 0;
        selectedYearTotal += yearAmount;
        if (yearAmount > highestSpender.amount) {
            highestSpender = { plate: vehicle.plate, amount: yearAmount };
        }
    });
    const hsCard = document.querySelector('.highest-spender');
    if (highestSpender.plate && highestSpender.amount > 0) {
        const vehicleInfo = book8Data.find(v => v.plate === highestSpender.plate);
        document.getElementById('dashboardHighestSpender').textContent = `${highestSpender.plate} (${vehicleInfo?.type.split(' - ')[0] || ''})`;
        hsCard.classList.remove('fire');
        void hsCard.offsetWidth;
        hsCard.classList.add('fire');
    } else {
        document.getElementById('dashboardHighestSpender').textContent = 'N/A';
        hsCard.classList.remove('fire');
    }
    animateCount(document.getElementById('dashboardTotalVehicles'), totalVehicles, { currency: false });
    animateCount(document.getElementById('dashboardYearlySpending'), totalSpendingAllYears);
    animateCount(document.getElementById('dashboardCurrentYear'), selectedYearTotal);
}

function renderYearlySpendingChart() {
    const ctx = document.getElementById('yearlySpendingChart').getContext('2d');
    if (yearlySpendingChart) yearlySpendingChart.destroy();
    const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
    const yearlyTotals = years.reduce((acc, year) => ({...acc, [year]: 0}), {});
    vehicleDataMap.forEach(transactions => {
        transactions.forEach(t => {
            if (yearlyTotals.hasOwnProperty(t.year)) {
                yearlyTotals[t.year] += parseFloat(t.amount) || 0;
            }
        });
    });
    yearlySpendingChart = new Chart(ctx, {
        type: currentChartType,
        data: {
            labels: years,
            datasets: [{
                label: 'Yearly Spending',
                data: Object.values(yearlyTotals),
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1,
                tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `Amount: ${formatFinancial(c.raw)}` } } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => formatFinancial(v) } } },
            onClick: (_, elements) => {
                if (elements.length > 0) {
                    dashboardYearFilter.value = years[elements[0].index];
                    updateDashboard();
                }
            }
        }
    });
}

function toggleChartType() {
    currentChartType = currentChartType === 'bar' ? 'line' : 'bar';
    toggleChartTypeBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${currentChartType === 'bar' ? 'To Line' : 'To Bar'}`;
    renderYearlySpendingChart();
}

function renderDashboardTable(selectedYear) {
    dashboardVehiclesTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const getYearlyTotal = (plate) => vehicleDataMap.get(plate)?.reduce((sum, t) => t.year === selectedYear ? sum + (parseFloat(t.amount) || 0) : sum, 0) || 0;
    let sortedData = [];
    if (selectedYear === 'all') {
        sortedData = [...vehicleSummaryData].sort((a, b) => b.total - a.total);
    } else {
        sortedData = [...vehicleSummaryData]
            .map(v => ({ ...v, yearlyTotal: getYearlyTotal(v.plate) }))
            .filter(v => v.yearlyTotal > 0)
            .sort((a, b) => b.yearlyTotal - a.yearlyTotal);
    }
    const top10 = sortedData.slice(0, 10);
    top10.forEach(vehicle => {
        const totalAmount = selectedYear === 'all' ? vehicle.total : vehicle.yearlyTotal;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vehicle.plate}</td>
            <td>${vehicle.type.split(' - ')[0] || 'N/A'}</td>
            <td>${vehicle.fleetNo || 'N/A'}</td>
            <td class="financial">${formatFinancial(totalAmount)}</td>
            <td><button class="action-btn"><i class="fas fa-eye"></i> View</button></td>
        `;
        row.querySelector('.action-btn').addEventListener('click', () => {
            vehicleNumberInput.value = vehicle.plate;
            switchReport('single');
            setBottomNavActive(document.getElementById('bnSingle'));
            searchTransactions();
        });
        fragment.appendChild(row);
    });
    dashboardVehiclesTableBody.appendChild(fragment);
    filterDashboardTable();
}

function filterDashboardTable() {
    const searchTerm = dashboardSearchInput.value.trim().toLowerCase();
    dashboardVehiclesTableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
    });
}

function searchTransactions() {
    const vehicleNumber = vehicleNumberInput.value.trim();
    if (!vehicleNumber) return alert('Please enter a vehicle number.');
    if (!vehicleDataMap.has(vehicleNumber)) {
        displayResults([]);
        updateSummaryValues(0, 0, 0, 0);
        return alert('No transactions found for: ' + vehicleNumber);
    }
    currentVehicleNumber = vehicleNumber;
    const transactions = vehicleDataMap.get(vehicleNumber);
    displayResults(transactions);
    calculateOpeningClosingValues(transactions);
}

function calculateOpeningClosingValues(transactions) {
    openingValue = 0;
    closingValue = 0;
    transactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const year = parseInt(t.year);
        if (year >= 2020 && year <= 2024) openingValue += amount;
        closingValue += amount;
    });
    updateSummaryValues(
        transactions.length,
        transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        openingValue,
        closingValue
    );
}

function updateSummaryValues(total, amount, opening, closing) {
    totalTransactionsSpan.textContent = total;
    totalAmountSpan.textContent = formatFinancial(amount);
    openingValueSpan.textContent = formatFinancial(opening);
    closingValueSpan.textContent = formatFinancial(closing);
}

function displayResults(results) {
    resultsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    if (!results.length) {
        const row = fragment.appendChild(document.createElement('tr'));
        row.innerHTML = `<td colspan="5" style="text-align:center;">No transactions found</td>`;
    } else {
        results.forEach(t => {
            const row = document.createElement('tr');
            row.dataset.year = t.year;
            row.dataset.description = t.description;
            row.dataset.amount = t.amount;
            row.innerHTML = `
                <td>${t.year || ''}</td>
                <td>${t.poNumber || ''}</td>
                <td>${t.site || ''}</td>
                <td class="description-cell">${t.description || ''}</td>
                <td class="financial">${formatFinancial(t.amount)}</td>
            `;
            fragment.appendChild(row);
        });
    }
    resultsTableBody.appendChild(fragment);
    filterResults();
}

function filterResults() {
    const year = yearFilter.value;
    const description = descriptionFilter.value.trim().toLowerCase();
    let visibleCount = 0;
    let filteredAmount = 0;
    for (const row of resultsTableBody.rows) {
        const showRow = (!year || row.dataset.year === year) && 
                       (!description || row.dataset.description.toLowerCase().includes(description));
        row.style.display = showRow ? '' : 'none';
        if (showRow) {
            visibleCount++;
            filteredAmount += parseFloat(row.dataset.amount) || 0;
        }
    }
    updateSummaryValues(visibleCount, filteredAmount, openingValue, closingValue);
    resultsTableFooter.innerHTML = '';
    if (visibleCount > 0) {
        const footerRow = resultsTableFooter.insertRow();
        footerRow.className = 'total-row';
        const totalLabel = (year || description) ? "Filtered Total" : "Grand Total";
        footerRow.innerHTML = `
            <td colspan="4"><strong>${totalLabel}</strong></td>
            <td class="financial"><strong>${formatFinancial(filteredAmount)}</strong></td>
        `;
    }
}

function clearFilters() {
    yearFilter.value = '';
    descriptionFilter.value = '';
    vehicleNumberInput.value = '';
    const transactions = vehicleDataMap.get(currentVehicleNumber) || [];
    displayResults(transactions);
    if(transactions.length > 0) calculateOpeningClosingValues(transactions);
}

function generateYearlySummary(vehicleNumber) {
    const transactions = vehicleDataMap.get(vehicleNumber) || [];
    if (transactions.length === 0) return '<p>No transactions found for this vehicle.</p>';
    const summary = {};
    transactions.forEach(t => {
        const year = t.year || 'N/A';
        const amount = parseFloat(t.amount) || 0;
        if (!summary[year]) {
            summary[year] = 0;
        }
        summary[year] += amount;
    });
    let html = '<table><thead><tr><th>Year</th><th>Total Spending</th></tr></thead><tbody>';
    Object.keys(summary).sort((a, b) => b - a).forEach(year => {
        html += `<tr><td>${year}</td><td class="financial">${formatFinancial(summary[year])}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function printReport() {
    if (!currentVehicleNumber || resultsTableBody.rows.length === 0 || (resultsTableBody.rows.length === 1 && resultsTableBody.rows[0].cells[0].colSpan === 5)) {
        alert('No data available to print.');
        return;
    }
    const vehicleNo = currentVehicleNumber;
    const summaryData = {
        transactions: totalTransactionsSpan.textContent,
        totalAmount: totalAmountSpan.textContent,
        openingValue: openingValueSpan.textContent,
        closingValue: closingValueSpan.textContent
    };
    const yearlySummaryHTML = generateYearlySummary(vehicleNo);
    let tableHTML = '<table><thead><tr><th>Year</th><th>PO #</th><th>Site</th><th>Description</th><th>Amount</th></tr></thead><tbody>';
    for (const row of resultsTableBody.rows) {
        if (row.style.display !== 'none') {
            tableHTML += `<tr>
                <td>${row.cells[0].textContent}</td>
                <td>${row.cells[1].textContent}</td>
                <td>${row.cells[2].textContent}</td>
                <td>${row.cells[3].textContent}</td>
                <td class="financial">${row.cells[4].textContent}</td>
            </tr>`;
        }
    }
    tableHTML += '</tbody>';
    if(resultsTableFooter.rows.length > 0) {
        tableHTML += `<tfoot>${resultsTableFooter.innerHTML}</tfoot>`;
    }
    tableHTML += '</table>';
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vehicle Report - ${vehicleNo}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; margin: 20px; }
                h1, h2, h3 { color: #2c3e50; margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 0.9em; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                tfoot .total-row { font-weight: bold; background-color: #f0f7ff; }
                tfoot .total-row td { border-top: 2px solid #2c3e50; }
                .summary-container, .yearly-summary { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .summary-item { display: flex; justify-content: space-between; }
                .financial { text-align: right; font-family: monospace; }
                header, footer { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
                footer { border-top: 1px solid #ccc; border-bottom: none; margin-top: 20px; padding-top: 10px; font-size: 0.8em; color: #777; }
                @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            <header>
                <h1>IBA Trading & Transportation WLL</h1>
                <h2>Vehicle Transaction Report</h2>
                <h3>Vehicle Plate No: ${vehicleNo}</h3>
            </header>
            <div class="summary-container">
                <h3>Filtered Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item"><strong>Transactions:</strong><span>${summaryData.transactions}</span></div>
                    <div class="summary-item"><strong>Total Amount:</strong><span>${summaryData.totalAmount}</span></div>
                    <div class="summary-item"><strong>Opening Value (2020-2024):</strong><span>${summaryData.openingValue}</span></div>
                    <div class="summary-item"><strong>Closing Value (All Years):</strong><span>${summaryData.closingValue}</span></div>
                </div>
            </div>
            <div class="yearly-summary">
                <h3>Yearly Breakdown (All Transactions)</h3>
                ${yearlySummaryHTML}
            </div>
            ${tableHTML}
            <footer>
                System Generated Report - ${new Date().toLocaleString()}
            </footer>
        </body>
        </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

function generateVehicleSummary() {
    vehicleSummaryData = book8Data.map(vehicle => {
        const transactions = vehicleDataMap.get(vehicle.plate) || [];
        const summary = {
            plate: vehicle.plate, type: vehicle.type, fleetNo: vehicle.fleetNo,
            driver: vehicle.driver, total: 0, total2020to2024: 0, year2025: 0
        };
        transactions.forEach(t => {
            const year = parseInt(t.year);
            const amount = parseFloat(t.amount) || 0;
            summary.total += amount;
            if (year >= 2020 && year <= 2024) summary.total2020to2024 += amount;
            if (year === 2025) summary.year2025 += amount;
        });
        return summary;
    });
}

function generateFullReportPreview() {
    const previewContainer = document.getElementById('fullReportPreview');
    previewContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const sortedData = [...vehicleSummaryData].sort((a, b) => a.plate.localeCompare(b.plate));
    const grandTotal2020to2024 = sortedData.reduce((sum, v) => sum + v.total2020to2024, 0);
    const grandTotal2025 = sortedData.reduce((sum, v) => sum + v.year2025, 0);
    const table = document.createElement('table');
    table.className = 'full-report-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Plate No.</th><th>Type</th><th>Fleet No.</th><th>Driver</th>
                <th class="blue-header">2020-2024 Total</th><th class="red-header">2025 Total</th><th>Grand Total</th>
            </tr>
        </thead>
    `;
    const tbody = document.createElement('tbody');
    sortedData.forEach(v => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${v.plate}</td><td>${v.type.split(' - ')[0] || 'N/A'}</td><td>${v.fleetNo || 'N/A'}</td>
            <td>${v.driver.split(' - ')[0] || 'N/A'}</td><td class="financial">${formatFinancial(v.total2020to2024)}</td>
            <td class="financial">${formatFinancial(v.year2025)}</td><td class="financial">${formatFinancial(v.total)}</td>
        `;
    });
    const totalRow = tbody.insertRow();
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td colspan="4"><strong>Grand Totals</strong></td>
        <td class="financial"><strong>${formatFinancial(grandTotal2020to2024)}</strong></td>
        <td class="financial"><strong>${formatFinancial(grandTotal2025)}</strong></td>
        <td class="financial"><strong>${formatFinancial(grandTotal2020to2024 + grandTotal2025)}</strong></td>
    `;
    table.appendChild(tbody);
    fragment.appendChild(table);
    previewContainer.appendChild(fragment);
}

function printFullReport() {
    const previewContent = document.getElementById('fullReportPreview').innerHTML;
    if (!previewContent.trim()) return alert('No report data to print.');
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Full Vehicle Summary Report</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; margin: 20px; }
                h1, h2 { text-align: center; color: #2c3e50; margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .financial { text-align: right; font-family: monospace; }
                .full-report-table thead tr th { background-color: #2c3e50; color: white; }
                .full-report-table .blue-header { background-color: #3498db !important; }
                .full-report-table .red-header { background-color: #e74c3c !important; }
                .total-row { font-weight: bold; background-color: #f0f7ff; }
                .total-row td { border-top: 2px solid #2c3e50; }
                header, footer { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
                footer { border-top: 1px solid #ccc; border-bottom: none; margin-top: 20px; padding-top: 10px; font-size: 0.8em; color: #777; }
                @media print { @page { size: A4 landscape; } }
            </style>
        </head>
        <body>
            <header>
                <h1>IBA Trading & Transportation WLL</h1>
                <h2>Full Vehicle Summary Report</h2>
            </header>
            ${previewContent}
            <footer>
                System Generated Report - ${new Date().toLocaleString()}
            </footer>
        </body>
        </html>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}

// ===== Admin Section Logic =====
const authStatus = document.getElementById('authStatus');
const book8AdminInput = document.getElementById('book8AdminInput');
const uploadBook8Btn = document.getElementById('uploadBook8Btn');
const dlBook8TemplateBtn = document.getElementById('dlBook8TemplateBtn');
const book8AdminStatus = document.getElementById('book8AdminStatus');
auth.onAuthStateChanged(user => {
  if(user) {
    authStatus.textContent = `Admin privileges active for ${user.email}`;
  }
});
dlBook8TemplateBtn?.addEventListener('click', ()=>{
  const csv = 'plate,type,fleetNo,driver\n102095,BUS 66 SEATER - TATA,IBA/BUS/011,ARBAB KHAN - 0168';
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download = 'book8_template.csv';
  a.click();
});
uploadBook8Btn?.addEventListener('click', ()=>{
  const user = auth.currentUser;
  if (user?.email !== 'dc@iba.com.qa') return alert('Admin access required.');
  const file = book8AdminInput.files?.[0];
  if (!file) return alert('Please select a Book8.csv file.');
  book8AdminStatus.textContent = 'Parsing CSV...';
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: async (res)=>{
      try{
        let rows = (res.data||[]).map(r=>({ 
          plate: String(r.plate || '').trim(), type: String(r.type || '').trim(),
          fleetNo: String(r.fleetNo || '').trim(), driver: String(r.driver || '').trim()
        })).filter(r=>r.plate);
        if (!rows.length) throw new Error('CSV is empty or missing required headers.');
        book8AdminStatus.textContent = 'Uploading to Firebase...';
        await db.ref('registered vehicle').set(rows);
        book8AdminStatus.innerHTML = '<span style="color:green">Upload successful! Reloading data...</span>';
        await loadInitialData();
      } catch(e) { book8AdminStatus.innerHTML = `<span style="color:red">Upload failed: ${e.message}</span>`; }
    },
    error: (err) => { book8AdminStatus.innerHTML = `<span style="color:red">Parse error: ${err.message}</span>`;}
  });
});

// ===== Modern Animation Enhancements =====
(function(){
  document.querySelectorAll('.dashboard-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (((e.clientX - rect.left) / rect.width) - 0.5).toFixed(3));
      card.style.setProperty('--my', (((e.clientY - rect.top) / rect.height) - 0.5).toFixed(3));
    });
    card.addEventListener('mouseleave', ()=>{
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  });
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, {threshold: 0.15});
  document.querySelectorAll('[data-animate]').forEach(el=>io.observe(el));
})();

function animateCount(el, toValue, opts={}){
  const duration = opts.duration || 1000;
  const isCurrency = opts.currency !== false;
  const fromValue = parseFloat((el.textContent||'').replace(/,/g,'')) || 0;
  const start = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  function frame(now){
    const t = Math.min((now - start) / duration, 1);
    const val = fromValue + (toValue - fromValue) * easeOutCubic(t);
    el.textContent = isCurrency ? formatFinancial(val) : String(Math.round(val));
    if (t < 1) requestAnimationFrame(frame);
  }
  el.classList.add('metric-pulse');
  setTimeout(()=>el.classList.remove('metric-pulse'), 600);
  requestAnimationFrame(frame);
}