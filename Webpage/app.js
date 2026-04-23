// ==========================================
// 1. DATABASE CONFIGURATION (STATELESS SSG)
// ==========================================
let currentEditId = null;

const BASE_URL = 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/';

// THE ABSOLUTE SOURCE OF TRUTH
const defaultProjects = [
    {
        "id": 1,
        "title": "Architectural Mastery",
        "client": "Private Entity",
        "desc": "Constructing modern living spaces with unparalleled design.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-1.jpg",
        "budget": "120M QR",
        "duration": "36 Months",
        "area": "450k SQFT"
    },
    {
        "id": 2,
        "title": "Inspiring Infrastructure",
        "client": "Ministry of Transport",
        "desc": "Building the bridges and roads that connect the future.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-2.jpg",
        "budget": "85M QR",
        "duration": "18 Months",
        "area": "2.4 Miles"
    },
    {
        "id": 3,
        "title": "Artistry in Steel",
        "client": "Apex Developments",
        "desc": "Elevating commercial construction into a form of modern art.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-3.jpg",
        "budget": "40M QR",
        "duration": "24 Months",
        "area": "120k SQFT"
    },
    {
        "id": 4,
        "title": "Eco-Friendly Hub",
        "client": "Green Future Corp",
        "desc": "Sustainable building practices leading the way for tomorrow.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-4.jpg",
        "budget": "65M QR",
        "duration": "12 Months",
        "area": "90k SQFT"
    },
    {
        "id": 5,
        "title": "Airport Terminal Expansion",
        "client": "Global Airports Corp",
        "desc": "Phase II expansion increasing passenger capacity by 40%.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-5.jpg",
        "budget": "210M QR",
        "duration": "48 Months",
        "area": "800k SQFT"
    },
    {
        "id": 6,
        "title": "Civic Center Renovation",
        "client": "City Council",
        "desc": "Complete historical restoration and modernization of the central library.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-6.jpg",
        "budget": "25M QR",
        "duration": "18 Months",
        "area": "60k SQFT"
    },
    {
        "id": 7,
        "title": "Oceanfront Resort",
        "client": "Azure Hotels",
        "desc": "A world-class resort featuring a unique architectural design and sustainable water management.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-7.jpg",
        "budget": "150M QR",
        "duration": "36 Months",
        "area": "350k SQFT"
    },
    {
        "id": 8,
        "title": "Sustainable Office Tower",
        "client": "Eco-Hub Real Estate",
        "desc": "Leed-certified office space designed for energy efficiency and modern workstyles.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-8.jpg",
        "budget": "95M QR",
        "duration": "24 Months",
        "area": "180k SQFT"
    },
    {
        "id": 9,
        "title": "Intermodal Freight Terminal",
        "client": "Logistics United",
        "desc": "A critical logistics hub integrating rail, road, and sea transport.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-9.jpg",
        "budget": "70M QR",
        "duration": "30 Months",
        "area": "1.2M SQFT"
    },
    {
        "id": 10,
        "title": "Community Hospital Wing",
        "client": "City Health Services",
        "desc": "New state-of-the-art wing focused on outpatient care and medical research.",
        "img": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Construction-10.jpg",
        "budget": "110M QR",
        "duration": "36 Months",
        "area": "220k SQFT"
    }
];

const defaultSettings = {
    "heroImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Main.jpg"
};

// IN-MEMORY DATABASE: Completely bypasses Local Storage.
// Every time the page loads, it exactly mirrors the hardcoded arrays above.
let liveProjects = JSON.parse(JSON.stringify(defaultProjects));
let liveSettings = JSON.parse(JSON.stringify(defaultSettings));

function getDatabase() { return liveProjects; }
function saveDatabase(dataArray) { liveProjects = dataArray; }

function getSettings() { return liveSettings; }
function saveSettings(settings) { liveSettings = settings; }

// ==========================================
// 2. PUBLIC PAGE RENDERING LOGIC (STATIC BYPASS)
// ==========================================
function renderHomeProjects() {
    const projects = defaultProjects.slice(0, 3); 
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
    const projects = defaultProjects;
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
    const proj = defaultProjects.find(p => p.id === projectId);
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
// 3. ADMIN PANEL LOGIC (IN-MEMORY)
// ==========================================
function loadAdminSettings() {
    const settings = getSettings();
    const heroInput = document.getElementById('site-hero-img');
    if (heroInput) heroInput.value = settings.heroImage;
}

function saveSiteSettings() {
    const heroInput = document.getElementById('site-hero-img').value;
    saveSettings({ heroImage: heroInput || defaultSettings.heroImage });
    alert('Site background updated in Memory! Ready to Export.');
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
        alert("Project Updates Saved to Memory! Ready to Export."); cancelEdit(); 
    } else {
        const newProj = { id: Date.now(), title, client: client || "Private Entity", desc, img, budget: budget || "N/A", duration: duration || "N/A", area: area || "N/A" };
        projects.push(newProj); alert("New Project Published to Memory! Ready to Export.");
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
    if(confirm("Are you sure? This will wipe your current session edits and reload from the hardcoded file.")) {
        liveProjects = JSON.parse(JSON.stringify(defaultProjects));
        cancelEdit(); renderAdminList();
    }
}

// ==========================================
// 4. SMART MULTI-PAGE ROUTER
// ==========================================
window.onload = function() {
    const hero = document.getElementById('main-hero');
    if (hero) {
        hero.style.setProperty('background-image', `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${defaultSettings.heroImage}')`, 'important');
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