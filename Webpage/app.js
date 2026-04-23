// ==========================================
// 1. DATABASE CONFIGURATION
// ==========================================
const DB_KEY = 'iba_construction_db';
const SETTINGS_KEY = 'iba_site_settings';
let currentEditId = null;

const BASE_URL = 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/';

const defaultProjects = [
    { id: 1, title: "Modern High-Rise", client: "Apex Developments", desc: "Constructing modern living spaces with unparalleled design.", budget: "$120M", duration: "36 Months", area: "450k SQFT", img: BASE_URL + "Construction-1.jpg" },
    { id: 2, title: "Metropolitan Bridge", client: "Ministry of Transport", desc: "Connecting the city with state-of-the-art infrastructure.", budget: "$85M", duration: "18 Months", area: "2.4 Miles", img: BASE_URL + "Construction-2.jpg" },
    { id: 3, title: "Steel Frameworks", client: "Industrial Solutions Ltd.", desc: "Custom steel fabrication and erection for heavy industry.", budget: "$40M", duration: "24 Months", area: "120k SQFT", img: BASE_URL + "Construction-3.jpg" },
    { id: 4, title: "Luxury Residences", client: "Private Entity", desc: "Exquisite residential complex with a focus on sustainable materials.", budget: "$65M", duration: "12 Months", area: "90k SQFT", img: BASE_URL + "Construction-4.jpg" },
    { id: 5, title: "Airport Terminal Expansion", client: "Global Airports Corp", desc: "Phase II expansion increasing passenger capacity by 40%.", budget: "$210M", duration: "48 Months", area: "800k SQFT", img: BASE_URL + "Construction-5.jpg" },
    { id: 6, title: "Civic Center Renovation", client: "City Council", desc: "Complete historical restoration and modernization of the central library.", budget: "$25M", duration: "18 Months", area: "60k SQFT", img: BASE_URL + "Construction-6.jpg" },
    { id: 7, title: "Oceanfront Resort", client: "Azure Hotels", desc: "A world-class resort featuring a unique architectural design and sustainable water management.", budget: "$150M", duration: "36 Months", area: "350k SQFT", img: BASE_URL + "Construction-7.jpg" },
    { id: 8, title: "Sustainable Office Tower", client: "Eco-Hub Real Estate", desc: "Leed-certified office space designed for energy efficiency and modern workstyles.", budget: "$95M", duration: "24 Months", area: "180k SQFT", img: BASE_URL + "Construction-8.jpg" },
    { id: 9, title: "Intermodal Freight Terminal", client: "Logistics United", desc: "A critical logistics hub integrating rail, road, and sea transport.", budget: "$70M", duration: "30 Months", area: "1.2M SQFT", img: BASE_URL + "Construction-9.jpg" },
    { id: 10, title: "Community Hospital Wing", client: "City Health Services", desc: "New state-of-the-art wing focused on outpatient care and medical research.", budget: "$110M", duration: "36 Months", area: "220k SQFT", img: BASE_URL + "Construction-10.jpg" }
];

const defaultSettings = { heroImage: BASE_URL + 'Main.jpg' };

function getDatabase() {
    let data = localStorage.getItem(DB_KEY);
    if (!data) { localStorage.setItem(DB_KEY, JSON.stringify(defaultProjects)); return defaultProjects; }
    try { return JSON.parse(data); } catch (e) { return defaultProjects; }
}
function saveDatabase(dataArray) { localStorage.setItem(DB_KEY, JSON.stringify(dataArray)); }

function getSettings() {
    let data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return defaultSettings;
    try { return JSON.parse(data); } catch (e) { return defaultSettings; }
}
function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

// ==========================================
// 2. PUBLIC PAGE RENDERING LOGIC
// ==========================================
function renderHomeProjects() {
    const projects = getDatabase().slice(0, 3); 
    const container = document.getElementById('home-project-container');
    if (!container) return; 
    container.innerHTML = ''; 
    projects.forEach(proj => {
        const blockHTML = `
            <div class="home-project-card reveal" style="background: url('${proj.img}') center/cover;" onclick="openDetailView(${proj.id})">
                <div class="home-project-info">
                    <p>${proj.client}</p>
                    <h3>${proj.title}</h3>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', blockHTML);
    });
}

function renderPortfolioProjects() {
    const projects = getDatabase();
    const container = document.getElementById('portfolio-container');
    if (!container) return; 
    container.innerHTML = ''; 
    projects.forEach(proj => {
        const blockHTML = `
            <div class="project-card reveal" onclick="openDetailView(${proj.id})">
                <img src="${proj.img}" alt="${proj.title}" class="project-image">
                <div class="project-info">
                    <h3 class="project-title">${proj.title}</h3>
                    <p class="project-desc">${proj.desc}</p>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', blockHTML);
    });
}

function initScrollAnimations() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.15 });
    reveals.forEach(reveal => observer.observe(reveal));
}

function openDetailView(projectId) {
    const proj = getDatabase().find(p => p.id === projectId);
    if(!proj) return;
    document.getElementById('detail-img').style.background = `url('${proj.img}') no-repeat center center / cover`;
    document.getElementById('detail-client').innerText = `CLIENT // ${proj.client}`;
    document.getElementById('detail-title').innerText = proj.title;
    document.getElementById('detail-desc').innerText = proj.desc;
    document.getElementById('detail-budget').innerText = proj.budget;
    document.getElementById('detail-duration').innerText = proj.duration;
    document.getElementById('detail-area').innerText = proj.area;
    document.getElementById('project-detail-view').classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

function closeDetailView() {
    document.getElementById('project-detail-view').classList.remove('active');
    document.body.style.overflow = 'auto'; 
}

// ==========================================
// 3. ADMIN PANEL LOGIC
// ==========================================
function loadAdminSettings() {
    const settings = getSettings();
    const heroInput = document.getElementById('site-hero-img');
    if (heroInput) heroInput.value = settings.heroImage;
}

function saveSiteSettings() {
    const heroInput = document.getElementById('site-hero-img').value;
    saveSettings({ heroImage: heroInput || defaultSettings.heroImage });
    alert('Site background updated! Check the live site.');
}

function renderAdminList() {
    const projects = getDatabase();
    const list = document.getElementById('admin-list');
    if (!list) return; 
    list.innerHTML = ''; 
    projects.forEach(proj => {
        const itemHTML = `
            <div class="inventory-item">
                <div class="inventory-info">
                    <h4>${proj.title}</h4>
                    <p>${proj.client} | ${proj.budget}</p>
                </div>
                <div class="inventory-actions">
                    <button class="btn-edit" onclick="editProject(${proj.id})">Edit</button>
                    <button class="btn-danger" onclick="deleteProject(${proj.id})">Remove</button>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function editProject(id) {
    const projects = getDatabase();
    const proj = projects.find(p => p.id === id);
    if (!proj) return;

    document.getElementById('proj-title').value = proj.title;
    document.getElementById('proj-client').value = proj.client;
    document.getElementById('proj-desc').value = proj.desc;
    document.getElementById('proj-img').value = proj.img;
    document.getElementById('proj-budget').value = proj.budget;
    document.getElementById('proj-duration').value = proj.duration;
    document.getElementById('proj-area').value = proj.area;

    currentEditId = id;
    document.getElementById('form-title').innerText = "Edit Existing Project";
    document.getElementById('submit-btn').innerText = "Save Changes";
    document.getElementById('cancel-edit-btn').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    currentEditId = null;
    document.querySelectorAll('.form-grid input').forEach(input => input.value = ''); 
    document.getElementById('form-title').innerText = "Log New Project";
    document.getElementById('submit-btn').innerText = "Publish to Portfolio";
    document.getElementById('cancel-edit-btn').style.display = "none";
}

function saveProject() {
    const title = document.getElementById('proj-title').value;
    const client = document.getElementById('proj-client').value;
    const desc = document.getElementById('proj-desc').value;
    const img = document.getElementById('proj-img').value;
    const budget = document.getElementById('proj-budget').value;
    const duration = document.getElementById('proj-duration').value;
    const area = document.getElementById('proj-area').value;

    if (!title || !desc || !img) { alert("Please fill in at least the Title, Description, and Image URL."); return; }

    const projects = getDatabase();

    if (currentEditId) {
        const index = projects.findIndex(p => p.id === currentEditId);
        if (index !== -1) { projects[index] = { id: currentEditId, title, client: client || "Private Entity", desc, img, budget: budget || "N/A", duration: duration || "N/A", area: area || "N/A" }; }
        alert("Project Updates Saved!"); cancelEdit(); 
    } else {
        const newProj = { id: Date.now(), title, client: client || "Private Entity", desc, img, budget: budget || "N/A", duration: duration || "N/A", area: area || "N/A" };
        projects.push(newProj); alert("New Project Published!");
        document.querySelectorAll('.form-grid input').forEach(input => input.value = '');
    }
    saveDatabase(projects); renderAdminList();
}

function deleteProject(id) {
    if(confirm("Permanently delete this project?")) {
        let projects = getDatabase();
        projects = projects.filter(proj => proj.id !== id);
        saveDatabase(projects); renderAdminList(); 
        if (currentEditId === id) cancelEdit();
    }
}

function clearDatabase() {
    if(confirm("Are you sure? This will wipe everything and reset to default projects.")) {
        localStorage.removeItem(DB_KEY); cancelEdit(); renderAdminList();
    }
}

// ==========================================
// 4. SMART MULTI-PAGE ROUTER
// ==========================================
window.onload = function() {
    const hero = document.getElementById('main-hero');
    if (hero) {
        const settings = getSettings();
        if (settings && settings.heroImage && settings.heroImage !== defaultSettings.heroImage) {
            hero.style.setProperty('background-image', `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${settings.heroImage}')`, 'important');
        } else {
            hero.style.setProperty('background-image', `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${defaultSettings.heroImage}')`, 'important');
        }
    }
    
    if (document.getElementById('home-project-container')) renderHomeProjects();
    if (document.getElementById('portfolio-container')) renderPortfolioProjects();
    if (document.getElementById('admin-list')) { renderAdminList(); loadAdminSettings(); }

    initScrollAnimations(); 
};

// ==========================================
// 5. STATIC SITE GENERATOR (GITHUB EXPORT)
// ==========================================
async function downloadUpdatedAppJs() {
    try {
        const response = await fetch('app.js');
        let code = await response.text();

        const currentProjects = getDatabase();
        const currentSettings = getSettings();

        const projectsString = 'const defaultProjects = ' + JSON.stringify(currentProjects, null, 4) + ';';
        const settingsString = 'const defaultSettings = ' + JSON.stringify(currentSettings, null, 4) + ';';

        code = code.replace(/const defaultProjects = \[[\s\S]*?\];/, projectsString);
        code = code.replace(/const defaultSettings = \{[\s\S]*?\};/, settingsString);

        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'app.js';
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("Success! Check your Downloads folder for the new app.js file. Upload it to GitHub to make changes permanent.");
    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export. This tool must be run on the live GitHub server or a local server to read the file.");
    }
}