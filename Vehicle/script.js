
// ==== Firebase Config (provided) ====
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

// Global variables
let allData = [];
let vehicleDataMap = new Map();
let vehicleSummaryData = [];
let openingValue = 0;
let closingValue = 0;
let currentVehicleNumber = '';
let yearlySpendingChart;
let vehicleTypeChart;
let currentChartType = 'bar'; // 'bar' or 'line'

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
const resultsTable = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
const totalTransactionsSpan = document.getElementById('totalTransactions');
const totalAmountSpan = document.getElementById('totalAmount');
const openingValueSpan = document.getElementById('openingValue');
const closingValueSpan = document.getElementById('closingValue');

// Dashboard elements
const dashboardSection = document.getElementById('dashboard');
const adminSection = document.getElementById('adminSection');
const adminBtn = document.getElementById('adminBtn');
const singleReportSection = document.getElementById('singleReport');
const fullReportSection = document.getElementById('fullReport');
const dashboardBtn = document.getElementById('dashboardBtn');
const singleReportBtn = document.getElementById('singleReportBtn');
const fullReportBtn = document.getElementById('fullReportBtn');
const dashboardYearFilter = document.getElementById('dashboardYearFilter');
const refreshDashboardBtn = document.getElementById('refreshDashboard');
const toggleChartTypeBtn = document.getElementById('toggleChartType');
const dashboardSearchInput = document.getElementById('dashboardSearch');
const dashboardClearSearchBtn = document.getElementById('dashboardClearSearch');
const dashboardVehiclesTableBody = document.getElementById('dashboardVehiclesTableBody');

// Dashboard cards
const dashboardTotalVehicles = document.getElementById('dashboardTotalVehicles');
const dashboardYearlySpending = document.getElementById('dashboardYearlySpending');
const dashboardCurrentYear = document.getElementById('dashboardCurrentYear');
const dashboardHighestSpender = document.getElementById('dashboardHighestSpender');

// Mobile menu elements
const menuToggle = document.querySelector('.menu-toggle');
const closeMenu = document.querySelector('.close-menu');
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.overlay');

// Full report elements
const printFullReportBtn = document.getElementById('printFullReportBtn');
const fullReportPreview = document.getElementById('fullReportPreview');

// Book8.csv data (converted to array)
let book8Data = [
    {plate: "102095", type: "BUS 66 SEATER - TATA", fleetNo: "IBA/BUS/011", driver: "ARBAB KHAN PIR GUL - 01666"},
    {plate: "104498", type: "BUS 66 SEATER - ASHOK LEYLAND", fleetNo: "IBA/BUS/003", driver: "NAEEM AHMED - 01712"},
    {plate: "105086", type: "3 TON SINGLE CABIN PICKUP - MITSUBISHI", fleetNo: "IBA/TS2/002", driver: "MOHAMMAD USUF A.KHA - 01711"},
    {plate: "132981", type: "3 TON SINGLE CABIN PICKUP - MITSUBISHI", fleetNo: "IBA/TS2/003", driver: "TEJBEER SINGH PARGAT SINGH(BALRAM) - 01702"},
    {plate: "134494", type: "3 TON SINGLE CABIN PICKUP - MITSUBISHI", fleetNo: "IBA/TS2/001", driver: "NAEEM AHMED - 01712"},
    {plate: "13890", type: "TIPPER TRAILER BOX - ", fleetNo: "IBA/TRLB/001", driver: "RANJIT SINGH - 01658"},
    {plate: "145759", type: "TRAILER - MERCEDES", fleetNo: "IBA/TRL/001", driver: "RANJIT SINGH - 01658"},
    {plate: "167502", type: "DOUBLE CABIN PICKUP 2X4 - NISSAN", fleetNo: "IBA/PD4/001", driver: "ABILASH - 00043"},
    {plate: "167503", type: "DOUBLE CABIN PICKUP 4X4 - NISSAN", fleetNo: "IBA/PD4/008", driver: "ASALAM MANSUR AHAMED SOLANKI - 01706"},
    {plate: "173492", type: "BUS 66 SEATER - TATA", fleetNo: "IBA/BUS/010", driver: "MOHAMMAD USUF A.KHA - 01711"},
    {plate: "179713", type: "3 TON DOUBLE CABIN PICKUP  - MITSUBISHI", fleetNo: "IBA/TS2/004", driver: "NOOR SHAIB SHAHZAD - 01710"},
    {plate: "191684", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/005", driver: "HASSAN ABDOLLAHI - 00063"},
    {plate: "192934", type: "SALOON CAR - NISSAN", fleetNo: "IBA/CAR/002", driver: "NA"},
    {plate: "192955", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/006", driver: "HALIMI - 00061"},
    {plate: "193120", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/002", driver: "ELSAYED MOKHTAR ELSAYED ABDERABOU  - 03103"},
    {plate: "195891", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/009", driver: "SAHIL - 03157"},
    {plate: "206713", type: "MINI BUS 26 SEATER - TOYOTA", fleetNo: "IBA/BUS/001", driver: "BALRAM - 01662"},
    {plate: "220266", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/013", driver: "SAMAD NIYAZ AHMAD SHAIKH - 59003"},
    {plate: "238490", type: "MINI BUS 30 SEATER - NISSAN", fleetNo: "IBA/BUS/002", driver: "SUMAN - 0283N"},
    {plate: "24004", type: "TELEHANDLER 13M - CATERPILLER", fleetNo: "IBA/TELE/002", driver: "ARUN KUMAR - "},
    {plate: "250117", type: "BUS 66 SEATER - ASHOK LEYLAND", fleetNo: "IBA/BUS/004", driver: "TEJBEER SINGH PARGAT SINGH - 01702"},
    {plate: "254081", type: "BUS 66 SEATER - TATA", fleetNo: "IBA/BUS/007", driver: "AHMAD ANSARI MAHAMMAD NASIR - 01697"},
    {plate: "254258", type: "BUS 66 SEATER - TATA", fleetNo: "IBA/BUS/006", driver: "RANJIT SINGH KARTAR SINGH  - 01658"},
    {plate: "262203", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/004", driver: "AZAM KHAN ZERA KHAN - 1677N"},
    {plate: "279977", type: "MINI BUS 13 SEATER - TOYOTA", fleetNo: "IBA/BUS/009", driver: "DHARMENDRA SINGH RISHIDEV SINGH - 59063"},
    {plate: "281839", type: "TRAILER - MERCEDES", fleetNo: "IBA/TRL/003", driver: "SUKHDEV SINGHĀ  - 01705"},
    {plate: "281840", type: "TRAILER - MERCEDES", fleetNo: "IBA/TRL/002", driver: "MUFTAH UD DIN PIR KHAN - 01708"},
    {plate: "31062", type: "KOMATSU WHEEL LOADER - KOMATSU", fleetNo: "IBA/WLL/002", driver: "KARAM HUSEN MUSALMAN - 0760N"},
    {plate: "31107", type: "WATER TANKER  - TATA", fleetNo: "IBA/TAN/001", driver: "MOHAMMAD BADSHAH - 01681"},
    {plate: "314419", type: "DOUBLE CABIN PICKUP 2X4 - NISSAN", fleetNo: "IBA/PD4/012", driver: "KARTIK - 01708"},
    {plate: "317673", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/010", driver: "PIRATHEEPAN NARAYANAN - 59063"},
    {plate: "318505", type: "MINI BUS 13 SEATER - TOYOTA", fleetNo: "IBA/BUS/008", driver: "PRASAD SUNKAM SUNKAM GANGA RAM - 01692"},
    {plate: "32218", type: "SKID LOADER - CATERPILLER", fleetNo: "IBA/LWN/001", driver: "SATROHAN YADAV - 02355"},
    {plate: "334239", type: "SUV CAR - FORD", fleetNo: "IBA/SUV/002", driver: "MR. ALI ALMUGHRABI - 00013"},
    {plate: "33930", type: "TELEHANDLER 13M - CATERPILLER", fleetNo: "IBA/TELE/004", driver: "GUL REHMAN ZAR BAD - 02030"},
    {plate: "345468", type: "SUV CAR - TOYOTA", fleetNo: "IBA/SUV/001", driver: "ABDRRAHMAN YOSSRY MOHAMED - 00109"},
    {plate: "35237", type: "3 TON SINGLE CABIN PICKUP - MITSUBISHI", fleetNo: "IBA/TS2/005", driver: "ARBAB KHAN PIR GUL - 01666"},
    {plate: "36588", type: "KOMATSU WHEEL LOADER - KOMATSU", fleetNo: "IBA/WLL/001", driver: "JAYASEELAN KANDASAMY - 01651"},
    {plate: "37481", type: "TIPPER TRAILER BOX - ", fleetNo: "IBA/TRLB/003", driver: "SUKHDEV SINGHĀ  - 01705"},
    {plate: "37510", type: "TIPPER TRAILER BOX - ", fleetNo: "IBA/TRLB/002", driver: "MUFTAH UD DIN PIR KHAN - 01708"},
    {plate: "456103", type: "SALOON CAR - NISSAN", fleetNo: "IBA/CAR/006", driver: "NA"},
    {plate: "458630", type: "SALOON CAR - NISSAN", fleetNo: "IBA/CAR/001", driver: "AHSAN ULLAH - 03131"},
    {plate: "47054", type: "TELEHANDLER 17M - JCB", fleetNo: "IBA/TELE/003", driver: "DELI BAHADUR - 00933"},
    {plate: "47055", type: "TELEHANDLER 17M - JCB", fleetNo: "IBA/TELE/001", driver: "NAVEED KHAN - 00980"},
    {plate: "4735", type: "SUV CAR - DODGE", fleetNo: "IBA/SUV/006", driver: "AL BARA MUNIR GHARAIBEH - 00004"},
    {plate: "47524", type: "BUS 66 SEATER - ASHOK LEYLAND", fleetNo: "IBA/BUS/005", driver: "BALWINDER KUMAR KASHIRI LAL - 01707"},
    {plate: "4896", type: "SUV CAR - FORD", fleetNo: "IBA/SUV/008", driver: "ACHRAF MILADI - 59001"},
    {plate: "49921", type: "SKID LOADER - JCB", fleetNo: "IBA/LWN/002", driver: "CHANDESHWAR - 00408"},
    {plate: "507521", type: "SUV CAR - NISSAN", fleetNo: "IBA/SUV/007", driver: "ESMAEIL ABDOLLAHI - 00062"},
    {plate: "526051", type: "SALOON CAR - NISSAN", fleetNo: "IBA/CAR/004", driver: "NA"},
    {plate: "56551", type: "MOBILE CRANE 50 TON -XCMG - XCMG", fleetNo: "IBA/CRN/001", driver: "SHARIF KHAN MOMEEN - 01682"},
    {plate: "59150", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/003", driver: "ABDUL MUQEED MOHAMMED - 03137"},
    {plate: "66588", type: "SKID LOADER - BOBCAT", fleetNo: "IBA/LWN/003", driver: "AJAY KUMAR"},
    {plate: "66589", type: "SKID LOADER - BOBCAT", fleetNo: "IBA/LWN/004", driver: "ABDUL QUDUSH ANSARI - 02014"},
    {plate: "698271", type: "SUV CAR - TOYOTA", fleetNo: "IBA/SUV/005", driver: "ASIF HUSSEIN - 0"},
    {plate: "751056", type: "SALOON CAR - NISSAN", fleetNo: "IBA/CAR/007", driver: "MD SAKIR HUSSAIN - 00112"},
    {plate: "78209", type: "5 TON FORKLIFT - HYUNDAI", fleetNo: "IBA/FLT/001", driver: "MOUHASIN ABDUL MAJID - 00269"},
    {plate: "78409", type: "ROLLER COMPACTOR 3 TON  - JCB", fleetNo: "IBA/VRC/001", driver: "AQIB - 14-01-2025 169 - 00979"},
    {plate: "820045", type: "SUV CAR - GMC", fleetNo: "IBA/SUV/003", driver: "MR. MOSTAFA MOHAMED SHENISHN - 00133"},
    {plate: "925770", type: "SUV CAR - MITSUBISHI", fleetNo: "IBA/SUV/011", driver: "MOHAMED MUKHTAR OTHMAN - 00100"},
    {plate: "95128", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/007", driver: "NOSHER KHAN GULAB KHAN - 01680N"},
    {plate: "95137", type: "DOUBLE CABIN PICKUP 4X4 - TOYOTA", fleetNo: "IBA/PD4/011", driver: "ZAHID KHAN FAIYAZ KHAN-BALRAM - 01698"},
    {plate: "981446", type: "SALOON CAR - MG", fleetNo: "IBA/CAR/008", driver: "ELSHARIF AHMED MOBELDING FAHMY ALI - OS1N"},
    {plate: "981447", type: "SALOON CAR - MG", fleetNo: "IBA/CAR/009", driver: "SHAHULHAMEED MOHAMMED ALI - 5502"},
    {plate: "981448", type: "SALOON CAR - MG", fleetNo: "IBA/CAR/010", driver: "MICHEL LOPEZ GHOSSAIN  - 00131"},
    {plate: "30408", type: "DOUBLE CABIN PICKUP 4X4 - MAXUS", fleetNo: "NA", driver: "NA"},
    {plate: "30412", type: "DOUBLE CABIN PICKUP 4X4 - MAXUS", fleetNo: "NA", driver: "NA"},
    {plate: "30394", type: "DOUBLE CABIN PICKUP 4X4 - MAXUS", fleetNo: "NA", driver: "NA"},
    {plate: "332092", type: "WATER TANKER - JAC", fleetNo: "IBA/TAN/002", driver: "MOHAMMAD BADSHAH - 01681"},
    {plate: "42222", type: "WATER TANKER - WATER TANKER", fleetNo: "IBA/RTANK/001", driver: "MOHAMMAD BADSHAH - 01681"},
    {plate: "187676", type: "3 TON SINGLE CABIN TIPPER - MITSUBISHI", fleetNo: "IBA/TS2/006", driver: "BALRAM - 01662"},
    {plate: "78519", type: "SKID LOADER - BOBCAT", fleetNo: "IBA/LWN/006", driver: "PHUL MAHAMAD MANSURI - 01009"},
    {plate: "78520", type: "SKID LOADER WITH BURSH - BOBCAT", fleetNo: "IBA/LWN/007", driver: "SATROHAN YADAV - 02355"}
];

// Initialize the application
function init() {
    setupEventListeners();
    loadCSVFromURL();
    updateDateTime();
    setInterval(updateDateTime, 60000); // Update time every minute
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    document.getElementById('footerDate').textContent = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function setupEventListeners() {
    // Mobile menu listeners
    menuToggle.addEventListener('click', toggleMenu);
    closeMenu.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    
    // Dashboard listeners
    dashboardBtn.addEventListener('click', () => {
        switchReport('dashboard');
        toggleMenu();
    });
    
    singleReportBtn.addEventListener('click', () => {
        switchReport('single');
        toggleMenu();
    });

    fullReportBtn.addEventListener('click', () => {
        switchReport('full');
        toggleMenu();
    });

    adminBtn.addEventListener('click', () => {
        switchReport('admin');
        toggleMenu();
    });
    
    // Dashboard controls
    dashboardYearFilter.addEventListener('change', updateDashboard);
    refreshDashboardBtn.addEventListener('click', updateDashboard);
    toggleChartTypeBtn.addEventListener('click', toggleChartType);
    dashboardSearchInput.addEventListener('input', filterDashboardTable);
    dashboardClearSearchBtn.addEventListener('click', () => {
        dashboardSearchInput.value = '';
        filterDashboardTable();
    });
    
    // Single vehicle report listeners
    searchBtn.addEventListener('click', searchTransactions);
    printBtn.addEventListener('click', printReport);
    yearFilter.addEventListener('change', filterResults);
    descriptionFilter.addEventListener('input', filterResults);
    clearBtn.addEventListener('click', clearFilters);
    
    vehicleNumberInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchTransactions();
    });

    // Full report listeners
    printFullReportBtn.addEventListener('click', printFullReport);
}

function toggleMenu() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
}

function switchReport(type) {
    if (type === 'dashboard') {
        dashboardSection.classList.add('active');
        singleReportSection.classList.remove('active');
        fullReportSection.classList.remove('active');
        dashboardBtn.classList.add('active');
        singleReportBtn.classList.remove('active');
        fullReportBtn.classList.remove('active');
    } else if (type === 'single') {
        dashboardSection.classList.remove('active');
        singleReportSection.classList.add('active');
        fullReportSection.classList.remove('active');
        dashboardBtn.classList.remove('active');
        singleReportBtn.classList.add('active');
        fullReportBtn.classList.remove('active');
    } else if (type === 'admin') {
        dashboardSection.classList.remove('active');
        singleReportSection.classList.remove('active');
        fullReportSection.classList.remove('active');
        adminSection.classList.add('active');
        dashboardBtn.classList.remove('active');
        singleReportBtn.classList.remove('active');
        fullReportBtn.classList.remove('active');
        adminBtn.classList.add('active');
    } else {
        dashboardSection.classList.remove('active');
        singleReportSection.classList.remove('active');
        fullReportSection.classList.add('active');
        adminSection.classList.remove('active');
        dashboardBtn.classList.remove('active');
        singleReportBtn.classList.remove('active');
        fullReportBtn.classList.add('active');
        adminBtn.classList.remove('active');
        generateFullReportPreview();
    }
}

function formatFinancial(num) {
    return parseFloat(num || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


async function loadBook8FromRTDB(){
  try{
    const snap = await db.ref('registered vehicle').get();
    const val = snap.val();
    let rows = [];
    if (Array.isArray(val)) rows = val.filter(Boolean);
    else if (val && typeof val === 'object') rows = Object.values(val);
    if (rows.length){
      // Normalize header keys
      book8Data = rows.map(r=>({ 
        plate: String(r.plate || r.Plate || r.PlateNo || '').trim(),
        type: String(r.type || r.Type || '').trim(),
        fleetNo: String(r.fleetNo || r['fleet no'] || r.FleetNo || '').trim(),
        driver: String(r.driver || r.Driver || '').trim()
      })).filter(r=>r.plate);
    }
  }catch(e){ console.error('loadBook8FromRTDB error', e); }
}

function loadCSVFromURL() {
    const url = "https://raw.githubusercontent.com/DC-database/Invoice/main/Vehicle.csv";
    
    Papa.parse(url, {
        download: true,
        header: true,
        complete: function(results) {
            allData = results.data.filter(row => row['Year']);
            processData(allData);
            generateVehicleSummary();
            updateDashboard();
            
            filtersSection.style.display = 'block';
            resultsSection.style.display = 'block';
            loadingIndicator.style.display = 'none';
        },
        error: function(error) {
            console.error('Error loading CSV:', error);
            loadingIndicator.innerHTML = `
                <div style="color: red; padding: 20px;">
                    <p>Error loading data</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    });
}

function processData(data) {
    vehicleDataMap.clear();
    if (!data.length) return;

    const knownVehicleNumbers = book8Data.map(item => item.plate);

    // Process data and populate vehicleDataMap
    data.forEach(row => {
        const transaction = {
            year: row['Year'],
            poNumber: row['PO #'],
            site: row['Project #'],
            description: row['Description'],
            amount: row['Delivered Amount']
        };
        
        knownVehicleNumbers.forEach(num => {
            if (row[num] && row[num].trim() !== '') {
                if (!vehicleDataMap.has(num)) {
                    vehicleDataMap.set(num, []);
                }
                vehicleDataMap.get(num).push(transaction);
            }
        });
    });

    // Populate year filter and datalist
    populateYearFilter(data);
    populateVehicleDatalist();
}

function populateYearFilter(data) {
    const years = [...new Set(data.map(row => row['Year']).filter(Boolean))].sort();
    yearFilter.innerHTML = '<option value="">All Years</option>';
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

function populateVehicleDatalist() {
    const datalist = document.getElementById('vehicleNumbers');
    datalist.innerHTML = '';
    Array.from(vehicleDataMap.keys()).sort().forEach(num => {
        const option = document.createElement('option');
        option.value = num;
        datalist.appendChild(option);
    });
}

// Dashboard functions
function updateDashboard() {
    const selectedYear = dashboardYearFilter.value;
    generateVehicleSummary(selectedYear);
    updateDashboardCards(selectedYear);
    renderYearlySpendingChart(selectedYear);
    renderVehicleTypeChart(selectedYear);
    renderDashboardTable(selectedYear);
}

function updateDashboardCards(selectedYear) {
    let totalVehicles = vehicleSummaryData.length;
    let totalSpendingAllYears = 0;
    let selectedYearTotal = 0;
    let highestSpender = { plate: '', amount: 0 };

    // Update year card title
    const yearCardTitle = document.getElementById('yearCardTitle');
    if (selectedYear === 'all') {
        yearCardTitle.textContent = 'Current Year (2025)';
    } else {
        yearCardTitle.textContent = `Selected Year (${selectedYear})`;
    }

    // Calculate totals
    vehicleSummaryData.forEach(vehicle => {
        // Always add to total spending for all years
        totalSpendingAllYears += vehicle.total;
        
        // Calculate spending for the selected year
        const yearAmount = vehicleDataMap.get(vehicle.plate)?.reduce((sum, t) => {
            if (selectedYear === 'all') {
                // For "All Years" filter, show 2025 amount
                return t.year === '2025' ? sum + (parseFloat(t.amount) || 0) : sum;
            } else {
                // For specific year filter
                return t.year === selectedYear ? sum + (parseFloat(t.amount) || 0) : sum;
            }
        }, 0) || 0;
        
        selectedYearTotal += yearAmount;
        
        // Update highest spender for the selected year
        if (yearAmount > highestSpender.amount) {
            highestSpender = {
                plate: vehicle.plate,
                amount: yearAmount
            };
        }
    });

    dashboardTotalVehicles.textContent = totalVehicles;
    dashboardYearlySpending.textContent = formatFinancial(totalSpendingAllYears);
    dashboardCurrentYear.textContent = formatFinancial(selectedYearTotal);
    
    if (highestSpender.plate) {
        const vehicleInfo = book8Data.find(v => v.plate === highestSpender.plate);
        const vehicleType = vehicleInfo ? vehicleInfo.type.split(' - ')[0] : '';
        dashboardHighestSpender.textContent = `${highestSpender.plate} (${vehicleType}) - ${formatFinancial(highestSpender.amount)}`;
    } else {
        dashboardHighestSpender.textContent = 'N/A';
    }
}
function renderYearlySpendingChart(selectedYear) {
    const ctx = document.getElementById('yearlySpendingChart').getContext('2d');
    
    // Destroy previous chart if it exists
    if (yearlySpendingChart) {
        yearlySpendingChart.destroy();
    }
    
    // Prepare data
    const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
    const yearlyTotals = {};
    
    years.forEach(year => {
        yearlyTotals[year] = 0;
    });
    
    vehicleSummaryData.forEach(vehicle => {
        const transactions = vehicleDataMap.get(vehicle.plate) || [];
        transactions.forEach(t => {
            if (years.includes(t.year)) {
                yearlyTotals[t.year] += parseFloat(t.amount) || 0;
            }
        });
    });
    
    const data = {
        labels: years,
        datasets: [{
            label: 'Yearly Spending',
            data: years.map(year => yearlyTotals[year]),
            backgroundColor: years.map((_, i) => {
                const hue = (i * 137.508) % 360;
                return `hsla(${hue}, 70%, 60%, 0.7)`;
            }),
            borderColor: years.map((_, i) => {
                const hue = (i * 137.508) % 360;
                return `hsla(${hue}, 70%, 60%, 1)`;
            }),
            borderWidth: 1
        }]
    };
    
    const config = {
        type: currentChartType,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Amount: ${formatFinancial(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatFinancial(value);
                        }
                    }
                }
            },
            // Add onClick event
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const year = years[index];
                    dashboardYearFilter.value = year;
                    updateDashboard();
                    
                    // Add visual feedback
                    const chartCanvas = document.getElementById('yearlySpendingChart');
                    chartCanvas.classList.add('chart-clicked');
                    setTimeout(() => {
                        chartCanvas.classList.remove('chart-clicked');
                    }, 300);
                }
            }
        }
    };
    
    yearlySpendingChart = new Chart(ctx, config);
}


function toggleChartType() {
    currentChartType = currentChartType === 'bar' ? 'line' : 'bar';
    toggleChartTypeBtn.innerHTML = `<i class="fas fa-exchange-alt"></i> ${currentChartType === 'bar' ? 'Line' : 'Bar'} Chart`;
    renderYearlySpendingChart(dashboardYearFilter.value);
}

function renderVehicleTypeChart(selectedYear) {
    const ctx = document.getElementById('vehicleTypeChart').getContext('2d');
    
    // Destroy previous chart if it exists
    if (vehicleTypeChart) {
        vehicleTypeChart.destroy();
    }
    
    // Group by vehicle type
    const typeMap = {};
    
    book8Data.forEach(vehicle => {
        const type = vehicle.type.split(' - ')[0] || 'Other';
        if (!typeMap[type]) {
            typeMap[type] = 0;
        }
        
        const transactions = vehicleDataMap.get(vehicle.plate) || [];
        transactions.forEach(t => {
            if (selectedYear === 'all' || t.year === selectedYear) {
                typeMap[type] += parseFloat(t.amount) || 0;
            }
        });
    });
    
    // Prepare data for chart
    const labels = Object.keys(typeMap);
    const data = Object.values(typeMap);
    
    // Generate colors
    const backgroundColors = labels.map((_, i) => {
        const hue = (i * 137.508) % 360; // Golden angle approximation
        return `hsla(${hue}, 70%, 60%, 0.7)`;
    });
    
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));
    
    const chartData = {
        labels: labels,
        datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
        }]
    };
    
    const config = {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${formatFinancial(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    };
    
    vehicleTypeChart = new Chart(ctx, config);
}

function renderDashboardTable(selectedYear) {
    dashboardVehiclesTableBody.innerHTML = '';
    
    if (!vehicleSummaryData.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = 'No vehicle data available';
        cell.className = 'no-results';
        row.appendChild(cell);
        dashboardVehiclesTableBody.appendChild(row);
        return;
    }
    
    // Sort by total amount descending
    const sortedData = [...vehicleSummaryData].sort((a, b) => {
        const aTotal = selectedYear === 'all' ? a.total : 
            (vehicleDataMap.get(a.plate)?.reduce((sum, t) => t.year === selectedYear ? sum + (parseFloat(t.amount) || 0) : sum, 0) || 0);
        const bTotal = selectedYear === 'all' ? b.total : 
            (vehicleDataMap.get(b.plate)?.reduce((sum, t) => t.year === selectedYear ? sum + (parseFloat(t.amount) || 0) : sum, 0) || 0);
        return bTotal - aTotal;
    });
    
    // Only show top 10 vehicles by default
    const vehiclesToShow = dashboardSearchInput.value.trim() ? sortedData : sortedData.slice(0, 10);
    
    // Populate table rows
    vehiclesToShow.forEach(vehicle => {
        // Calculate total for selected year
        const totalAmount = selectedYear === 'all' ? vehicle.total : 
            (vehicleDataMap.get(vehicle.plate)?.reduce((sum, t) => t.year === selectedYear ? sum + (parseFloat(t.amount) || 0) : sum, 0) || 0);
        
        // Skip vehicles with no transactions for the selected year
        if (selectedYear !== 'all' && totalAmount === 0) return;
        
        const row = document.createElement('tr');
        
        // Plate
        const plateCell = document.createElement('td');
        plateCell.textContent = vehicle.plate;
        row.appendChild(plateCell);
        
        // Type
        const typeCell = document.createElement('td');
        typeCell.textContent = vehicle.type.split(' - ')[0] || 'N/A';
        row.appendChild(typeCell);
        
        // Fleet No.
        const fleetNoCell = document.createElement('td');
        fleetNoCell.textContent = vehicle.fleetNo || 'N/A';
        row.appendChild(fleetNoCell);
        
        // Total Amount
        const amountCell = document.createElement('td');
        amountCell.className = 'financial';
        amountCell.textContent = formatFinancial(totalAmount);
        row.appendChild(amountCell);
        
        // Actions
        const actionCell = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.innerHTML = '<i class="fas fa-eye"></i> View';
        viewBtn.addEventListener('click', () => {
            vehicleNumberInput.value = vehicle.plate;
            switchReport('single');
            searchTransactions();
        });
        actionCell.appendChild(viewBtn);
        row.appendChild(actionCell);
        
        dashboardVehiclesTableBody.appendChild(row);
    });
}

function filterDashboardTable() {
    const searchTerm = dashboardSearchInput.value.trim().toLowerCase();
    const rows = dashboardVehiclesTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const plate = row.cells[0].textContent.toLowerCase();
        const type = row.cells[1].textContent.toLowerCase();
        const fleetNo = row.cells[2].textContent.toLowerCase();
        
        const showRow = !searchTerm || 
            plate.includes(searchTerm) || 
            type.includes(searchTerm) || 
            fleetNo.includes(searchTerm);
        
        row.style.display = showRow ? '' : 'none';
    });
}

// Single vehicle report functions
function searchTransactions() {
    const vehicleNumber = vehicleNumberInput.value.trim();
    if (!vehicleNumber) {
        alert('Please enter a vehicle number');
        return;
    }

    if (!vehicleDataMap.has(vehicleNumber)) {
        displayResults([]);
        updateSummaryValues(0, 0, 0, 0);
        alert('No transactions found for: ' + vehicleNumber);
        return;
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
        
        if (!isNaN(year)) {
            if (year >= 2020 && year <= 2024) openingValue += amount;
            closingValue += amount;
        }
    });
    
    updateSummaryValues(
        transactions.length,
        transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        openingValue,
        closingValue
    );
}

function updateSummaryValues(totalTransactions, totalAmount, opening, closing) {
    totalTransactionsSpan.textContent = totalTransactions;
    totalAmountSpan.textContent = formatFinancial(totalAmount);
    openingValueSpan.textContent = formatFinancial(opening);
    closingValueSpan.textContent = formatFinancial(closing);
}

function displayResults(results) {
    resultsTable.innerHTML = '';
    
    if (!results.length) {
        const row = resultsTable.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = 'No transactions found';
        cell.className = 'no-results';
        return;
    }
    
    results.forEach(t => {
        const row = resultsTable.insertRow();
        row.setAttribute('data-year', t.year);
        row.setAttribute('data-description', t.description);
        row.setAttribute('data-amount', t.amount);
        
        row.insertCell().textContent = t.year || '';
        row.insertCell().textContent = t.poNumber || '';
        row.insertCell().textContent = t.site || '';
        row.insertCell().textContent = t.description || '';
        
        const amountCell = row.insertCell();
        amountCell.textContent = formatFinancial(t.amount);
        amountCell.className = 'financial';
    });
    
    filterResults();
}

function filterResults() {
    const year = yearFilter.value;
    const description = descriptionFilter.value.trim().toLowerCase();
    
    const rows = resultsTable.rows;
    let visibleCount = 0;
    let filteredAmount = 0;
    
    for (let row of rows) {
        const rowYear = row.getAttribute('data-year');
        const rowDesc = row.getAttribute('data-description').toLowerCase();
        const rowAmount = parseFloat(row.getAttribute('data-amount')) || 0;
        
        const showRow = (!year || rowYear === year) && 
                       (!description || rowDesc.includes(description));
        
        row.style.display = showRow ? '' : 'none';
        if (showRow) {
            visibleCount++;
            filteredAmount += rowAmount;
        }
    }
    
    updateSummaryValues(visibleCount, filteredAmount, openingValue, closingValue);
}

function clearFilters() {
    yearFilter.value = '';
    descriptionFilter.value = '';
    vehicleNumberInput.value = '';
    filterResults();
// Show all transactions again
    const transactions = vehicleDataMap.get(currentVehicleNumber) || [];
    displayResults(transactions);
    calculateOpeningClosingValues(transactions);
}

function printReport() {
    if (!currentVehicleNumber) {
        alert('Please search for a vehicle first');
        return;
    }
    
    const preparedByName = "System Generated";
    const yearlySummary = generateYearlySummary(currentVehicleNumber);
    const filteredTransactions = getFilteredTransactions();
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const formattedTime = currentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Vehicle Report - ${currentVehicleNumber}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    
                    body { 
                        font-family: 'Roboto', sans-serif; 
                        margin: 0; 
                        padding: 0; 
                        color: #333;
                        background-color: #fff;
                    }
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                    .container {
                        width: 100%;
                        max-width: 100%;
                        margin: 0;
                        padding: 10px;
                        box-sizing: border-box;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .company-name {
                        font-size: 20px;
                        font-weight: 700;
                        color: #2c3e50;
                        margin: 0;
                    }
                    .company-details {
                        font-size: 12px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    .report-title {
                        font-size: 18px;
                        font-weight: 500;
                        color: #2c3e50;
                        margin: 0;
                    }
                    .report-subtitle {
                        font-size: 14px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    .report-meta {
                        font-size: 12px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    .section {
                        margin-bottom: 15px;
                        page-break-inside: avoid;
                    }
                    .section-title {
                        font-size: 16px;
                        font-weight: 500;
                        color: #2c3e50;
                        margin-bottom: 10px;
                        padding-bottom: 5px;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10pt;
                        page-break-inside: auto;
                    }
                    th, td {
                        padding: 6px 4px;
                        border: 1px solid #ddd;
                    }
                    th {
                        background-color: #3498db;
                        color: white;
                        font-weight: 500;
                    }
                    .financial {
                        text-align: right;
                        font-family: 'Roboto Mono', monospace;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    .summary-item {
                        background-color: #f8f9fa;
                        border-radius: 4px;
                        padding: 10px;
                    }
                    .summary-label {
                        font-size: 12px;
                        color: #7f8c8d;
                    }
                    .summary-value {
                        font-size: 16px;
                        font-weight: 500;
                    }
                    .total-row {
                        font-weight: 700;
                        background-color: #f0f7ff;
                    }
                    .footer {
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #e0e0e0;
                        font-size: 11px;
                        color: #7f8c8d;
                        text-align: center;
                    }
                    @media print {
                        body {
                            padding: 0;
                            zoom: 0.9;
                        }
                        * {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        th {
                            background-color: #3498db !important;
                            color: white !important;
                        }
                        .section {
                            page-break-inside: avoid;
                        }
                        tr {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-info">
                            <h1 class="company-name">IBA Trading & Contracting & Transportation WLL</h1>
                            <div class="company-details">
                                C-Ring Road, Building No: 223<br>
                                P.O.Box-15, Doha-Qatar<br>
                                Phone: +974 4040 3535
                            </div>
                        </div>
                        <div class="report-info">
                            <h2 class="report-title">Vehicle Transaction Report</h2>
                            <div class="report-subtitle">Vehicle #${currentVehicleNumber}</div>
                            <div class="report-meta">
                                Generated: ${formattedDate} at ${formattedTime}<br>
                                Prepared by: ${preparedByName}
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-label">Opening Value (2020-2024)</div>
                            <div class="summary-value financial">${formatFinancial(openingValue)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Closing Value (All Years)</div>
                            <div class="summary-value financial">${formatFinancial(closingValue)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Total Transactions</div>
                            <div class="summary-value">${filteredTransactions.length}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Report Period</div>
                            <div class="summary-value">2020 - ${new Date().getFullYear()}</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Yearly Summary</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Year</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${yearlySummary.map(item => `
                                    <tr>
                                        <td>${item.year}</td>
                                        <td class="financial">${formatFinancial(item.amount)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td><strong>Total</strong></td>
                                    <td class="financial"><strong>${formatFinancial(yearlySummary.reduce((sum, item) => sum + parseFloat(item.amount), 0))}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="section">
                        <h3 class="section-title">Transaction Details</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Year</th>
                                    <th>PO Number</th>
                                    <th>Site</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredTransactions.map(transaction => `
                                    <tr>
                                        <td>${transaction.year || ''}</td>
                                        <td>${transaction.poNumber || ''}</td>
                                        <td>${transaction.site || ''}</td>
                                        <td>${transaction.description || ''}</td>
                                        <td class="financial">${formatFinancial(transaction.amount)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="4"><strong>Total</strong></td>
                                    <td class="financial"><strong>${formatFinancial(filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0))}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="footer">
                        <p>Confidential - For internal use only</p>
                        <p>Page 1 of 1 | Generated by Vehicle Transaction System</p>
                    </div>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function getFilteredTransactions() {
    const transactions = [];
    const rows = resultsTable.rows;
    
    for (let row of rows) {
        if (row.style.display !== 'none') {
            transactions.push({
                year: row.getAttribute('data-year'),
                poNumber: row.cells[1].textContent,
                site: row.cells[2].textContent,
                description: row.getAttribute('data-description'),
                amount: row.getAttribute('data-amount')
            });
        }
    }
    
    return transactions;
}

function generateYearlySummary() {
    const summary = {};
    const transactions = vehicleDataMap.get(currentVehicleNumber) || [];
    
    transactions.forEach(t => {
        if (t.year) {
            summary[t.year] = (summary[t.year] || 0) + (parseFloat(t.amount) || 0);
        }
    });
    
    return Object.entries(summary)
        .map(([year, amount]) => ({ year, amount }))
        .sort((a, b) => a.year - b.year);
}

// Summary report functions
function generateVehicleSummary(selectedYear = 'all') {
    vehicleSummaryData = book8Data.map(vehicle => {
        const plate = vehicle.plate;
        const summary = {
            plate: plate,
            type: vehicle.type,
            fleetNo: vehicle.fleetNo,
            driver: vehicle.driver,
            total: 0,
            total2020to2024: 0,
            year2025: 0
        };
        
        // Get transactions for this vehicle
        const transactions = vehicleDataMap.get(plate) || [];
        
        // Calculate yearly totals
        transactions.forEach(transaction => {
            const year = parseInt(transaction.year);
            const amount = parseFloat(transaction.amount) || 0;
            
            if (year >= 2020 && year <= 2024) {
                summary.total2020to2024 += amount;
                summary.total += amount;
            } else if (year === 2025) {
                summary.year2025 += amount;
                summary.total += amount;
            }
        });
        
        return summary;
    });
}

function generateFullReportPreview() {
    const previewContainer = document.getElementById('fullReportPreview');
    previewContainer.innerHTML = '';
    
    // Sort by plate number
    const sortedData = [...vehicleSummaryData].sort((a, b) => a.plate.localeCompare(b.plate));
    
    // Calculate totals
    const grandTotal2020to2024 = sortedData.reduce((sum, vehicle) => sum + vehicle.total2020to2024, 0);
    const grandTotal2025 = sortedData.reduce((sum, vehicle) => sum + vehicle.year2025, 0);
    const grandTotal = grandTotal2020to2024 + grandTotal2025;
    
    const table = document.createElement('table');
    table.className = 'full-report-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = [
        'Plate No.', 'Type', 'Fleet No.', 'Driver',
        '2020-2024 Total', '2025 Total', 'Grand Total'
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header;
        if (index === 4) th.className = 'blue-header';
        if (index === 5) th.className = 'red-header';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    sortedData.forEach(vehicle => {
        const row = document.createElement('tr');
        
        const plateCell = document.createElement('td');
        plateCell.textContent = vehicle.plate;
        row.appendChild(plateCell);
        
        const typeCell = document.createElement('td');
        typeCell.textContent = vehicle.type.split(' - ')[0] || 'N/A';
        row.appendChild(typeCell);
        
        const fleetCell = document.createElement('td');
        fleetCell.textContent = vehicle.fleetNo || 'N/A';
        row.appendChild(fleetCell);
        
        const driverCell = document.createElement('td');
        driverCell.textContent = vehicle.driver.split(' - ')[0] || 'N/A';
        row.appendChild(driverCell);
        
        const total2020to2024Cell = document.createElement('td');
        total2020to2024Cell.textContent = formatFinancial(vehicle.total2020to2024);
        total2020to2024Cell.className = 'financial';
        row.appendChild(total2020to2024Cell);
        
        const total2025Cell = document.createElement('td');
        total2025Cell.textContent = formatFinancial(vehicle.year2025);
        total2025Cell.className = 'financial';
        row.appendChild(total2025Cell);
        
        const grandTotalCell = document.createElement('td');
        grandTotalCell.textContent = formatFinancial(vehicle.total);
        grandTotalCell.className = 'financial';
        row.appendChild(grandTotalCell);
        
        tbody.appendChild(row);
    });
    
    // Add totals row
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    
    const totalLabelCell = document.createElement('td');
    totalLabelCell.colSpan = 4;
    totalLabelCell.textContent = 'Grand Totals';
    totalRow.appendChild(totalLabelCell);
    
    const total2020to2024Cell = document.createElement('td');
    total2020to2024Cell.textContent = formatFinancial(grandTotal2020to2024);
    total2020to2024Cell.className = 'financial';
    totalRow.appendChild(total2020to2024Cell);
    
    const total2025Cell = document.createElement('td');
    total2025Cell.textContent = formatFinancial(grandTotal2025);
    total2025Cell.className = 'financial';
    totalRow.appendChild(total2025Cell);
    
    const grandTotalCell = document.createElement('td');
    grandTotalCell.textContent = formatFinancial(grandTotal);
    grandTotalCell.className = 'financial';
    totalRow.appendChild(grandTotalCell);
    
    tbody.appendChild(totalRow);
    table.appendChild(tbody);
    
    previewContainer.appendChild(table);
}

function printFullReport() {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const formattedTime = currentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Sort by plate number
    const sortedData = [...vehicleSummaryData].sort((a, b) => a.plate.localeCompare(b.plate));
    
    // Calculate totals
    const grandTotal2020to2024 = sortedData.reduce((sum, vehicle) => sum + vehicle.total2020to2024, 0);
    const grandTotal2025 = sortedData.reduce((sum, vehicle) => sum + vehicle.year2025, 0);
    const grandTotal = grandTotal2020to2024 + grandTotal2025;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Full Vehicle Summary Report</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                    
                    body { 
                        font-family: 'Roboto', sans-serif; 
                        margin: 0; 
                        padding: 0; 
                        color: #333;
                        background-color: #fff;
                    }
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                    .container {
                        width: 100%;
                        max-width: 100%;
                        margin: 0;
                        padding: 10px;
                        box-sizing: border-box;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .company-name {
                        font-size: 20px;
                        font-weight: 700;
                        color: #2c3e50;
                        margin: 0;
                    }
                    .company-details {
                        font-size: 12px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    .report-title {
                        font-size: 18px;
                        font-weight: 500;
                        color: #2c3e50;
                        margin: 0;
                    }
                    .report-subtitle {
                        font-size: 14px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    .report-meta {
                        font-size: 12px;
                        color: #7f8c8d;
                        margin-top: 5px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10pt;
                        page-break-inside: auto;
                    }
                    th, td {
                        padding: 6px 4px;
                        border: 1px solid #ddd;
                    }
                    th {
                        font-weight: 500;
                    }
                    .blue-header {
                        background-color: #3498db;
                        color: white;
                    }
                    .red-header {
                        background-color: #e74c3c;
                        color: white;
                    }
                    .financial {
                        text-align: right;
                        font-family: 'Roboto Mono', monospace;
                    }
                    .total-row {
                        font-weight: 700;
                        background-color: #f0f7ff;
                    }
                    .footer {
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 1px solid #e0e0e0;
                        font-size: 11px;
                        color: #7f8c8d;
                        text-align: center;
                    }
                    @media print {
                        body {
                            padding: 0;
                            zoom: 0.9;
                        }
                        * {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .blue-header {
                            background-color: #3498db !important;
                            color: white !important;
                        }
                        .red-header {
                            background-color: #e74c3c !important;
                            color: white !important;
                        }
                        table {
                            page-break-inside: auto;
                        }
                        tr {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="company-info">
                            <h1 class="company-name">IBA Trading & Contracting & Transportation WLL</h1>
                            <div class="company-details">
                                C-Ring Road, Building No: 223<br>
                                P.O.Box-15, Doha-Qatar<br>
                                Phone: +974 4040 3535
                            </div>
                        </div>
                        <div class="report-info">
                            <h2 class="report-title">Full Vehicle Summary Report</h2>
                            <div class="report-subtitle">All Vehicles - Transaction Summary</div>
                            <div class="report-meta">
                                Generated: ${formattedDate} at ${formattedTime}<br>
                                Prepared by: System Generated
                            </div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Plate No.</th>
                                <th>Type</th>
                                <th>Fleet No.</th>
                                <th>Driver</th>
                                <th class="blue-header">2020-2024 Total</th>
                                <th class="red-header">2025 Total</th>
                                <th>Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedData.map(vehicle => `
                                <tr>
                                    <td>${vehicle.plate}</td>
                                    <td>${vehicle.type.split(' - ')[0] || 'N/A'}</td>
                                    <td>${vehicle.fleetNo || 'N/A'}</td>
                                    <td>${vehicle.driver.split(' - ')[0] || 'N/A'}</td>
                                    <td class="financial">${formatFinancial(vehicle.total2020to2024)}</td>
                                    <td class="financial">${formatFinancial(vehicle.year2025)}</td>
                                    <td class="financial">${formatFinancial(vehicle.total)}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="4"><strong>Grand Totals</strong></td>
                                <td class="financial"><strong>${formatFinancial(grandTotal2020to2024)}</strong></td>
                                <td class="financial"><strong>${formatFinancial(grandTotal2025)}</strong></td>
                                <td class="financial"><strong>${formatFinancial(grandTotal)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div class="footer">
                        <p>Confidential - For internal use only</p>
                        <p>Page 1 of 1 | Generated by Vehicle Transaction System</p>
                    </div>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);


// ===== Admin: Auth + Book8 uploader =====
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authStatus = document.getElementById('authStatus');
const book8AdminInput = document.getElementById('book8AdminInput');
const uploadBook8Btn = document.getElementById('uploadBook8Btn');
const dlBook8TemplateBtn = document.getElementById('dlBook8TemplateBtn');
const book8AdminStatus = document.getElementById('book8AdminStatus');

const ADMIN_UID = 'uX2za3AV63XYj2AGAQfPHDYCiYr1';

auth.onAuthStateChanged(user => {
  if (user) {
    authStatus.textContent = `Signed in: ${user.email} (UID: ${user.uid})`;
  } else {
    authStatus.textContent = 'Not signed in';
  }
});

if (signInBtn) signInBtn.addEventListener('click', async () => {
  try{
    await auth.signInWithEmailAndPassword(authEmail.value.trim(), authPass.value);
  }catch(e){ alert('Sign-in failed: ' + (e.message||e)); }
});
if (signOutBtn) signOutBtn.addEventListener('click', () => auth.signOut());

function downloadBook8Template(){
  const csv = 'plate,type,fleetNo,driver\n102095,BUS 66 SEATER - TATA,IBA/BUS/011,ARBAB KHAN PIR GUL - 0168\n104498,BUS 66 SEATER - TATA,IBA/BUS/012,ABDUL RAHIM - 0169';
  // Fix the sample to valid CSV
}

if (dlBook8TemplateBtn) dlBook8TemplateBtn.addEventListener('click', ()=>{
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download = 'book8_template.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});

if (uploadBook8Btn) uploadBook8Btn.addEventListener('click', ()=>{
  if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID){
    alert('You must sign in as admin to upload.');
    return;
  }
  const f = book8AdminInput.files && book8AdminInput.files[0];
  if (!f){ alert('Choose Book8.csv first.'); return; }
  book8AdminStatus.textContent = 'Parsing CSV…';
  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,
    complete: async (res)=>{
      try{
        let rows = (res.data||[]).map(r=>({ 
          plate: String(r.plate || r.Plate || r.PlateNo || '').trim(),
          type: String(r.type || r.Type || '').trim(),
          fleetNo: String(r.fleetNo || r['fleet no'] || r.FleetNo || '').trim(),
          driver: String(r.driver || r.Driver || '').trim()
        })).filter(r=>r.plate);
        if (!rows.length){ throw new Error('CSV empty or headers missing (need plate,type,fleetNo,driver).'); }
        book8AdminStatus.textContent = 'Writing to Realtime Database…';
        await db.ref('registered vehicle').set(rows);
        book8AdminStatus.innerHTML = '<span style="color:green">Uploaded & saved to <b>registered vehicle</b>. Reloading data…</span>';
        await loadBook8FromRTDB();
        updateDashboard(); // refresh cards that depend on book8 types
      }catch(e){
        console.error(e);
        book8AdminStatus.innerHTML = '<span style="color:red">Upload failed: '+(e.message||e)+'</span>';
      }
    },
    error: (err)=>{
      book8AdminStatus.innerHTML = '<span style="color:red">Parse error: '+(err.message||err)+'</span>';
    }
  });
});


// === Bottom Mobile Navigation wiring ===
document.addEventListener('DOMContentLoaded', function(){
  function q(id){ return document.getElementById(id); }
  const bnDashboard = q('bnDashboard');
  const bnSingle    = q('bnSingle');
  const bnFull      = q('bnFull');
  const bnAdmin     = q('bnAdmin');

  function setBottomNavActive(el){
    const items = [bnDashboard, bnSingle, bnFull, bnAdmin];
    items.forEach(i => i && i.classList.remove('active'));
    if(el && el.classList) el.classList.add('active');
  }

  // Bind clicks
  if (bnDashboard) bnDashboard.addEventListener('click', ()=>{ switchReport('dashboard'); setBottomNavActive(bnDashboard); });
  if (bnSingle)    bnSingle.addEventListener('click',    ()=>{ switchReport('single');    setBottomNavActive(bnSingle);    });
  if (bnFull)      bnFull.addEventListener('click',      ()=>{ switchReport('full');      setBottomNavActive(bnFull);      });
  if (bnAdmin)     bnAdmin.addEventListener('click',     ()=>{ switchReport('admin');     setBottomNavActive(bnAdmin);     });

  // Sync when using sidebar/top buttons too
  const dashboardBtn    = q('dashboardBtn');
  const singleReportBtn = q('singleReportBtn');
  const fullReportBtn   = q('fullReportBtn');
  const adminBtn        = q('adminBtn');

  if (dashboardBtn)    dashboardBtn.addEventListener('click', ()=> setBottomNavActive(bnDashboard));
  if (singleReportBtn) singleReportBtn.addEventListener('click', ()=> setBottomNavActive(bnSingle));
  if (fullReportBtn)   fullReportBtn.addEventListener('click', ()=> setBottomNavActive(bnFull));
  if (adminBtn)        adminBtn.addEventListener('click', ()=> setBottomNavActive(bnAdmin));

  // Initialize default active to whatever section is visible
  const dashboardSection    = document.getElementById('dashboard');
  const singleReportSection = document.getElementById('singleReport');
  const fullReportSection   = document.getElementById('fullReport');
  const adminSection        = document.getElementById('adminSection') || document.getElementById('admin');

  if (dashboardSection && dashboardSection.classList.contains('active')) setBottomNavActive(bnDashboard);
  else if (singleReportSection && singleReportSection.classList.contains('active')) setBottomNavActive(bnSingle);
  else if (fullReportSection && fullReportSection.classList.contains('active')) setBottomNavActive(bnFull);
  else if (adminSection && adminSection.classList.contains('active')) setBottomNavActive(bnAdmin);
  else setBottomNavActive(bnDashboard);
});
// === End Bottom Mobile Navigation wiring ===

