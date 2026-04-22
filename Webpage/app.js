// ==========================================
// 1. DATABASE CONFIGURATION
// ==========================================
const DB_KEY = 'iba_construction_db';
const SETTINGS_KEY = 'iba_site_settings';
let currentEditId = null;

const defaultProjects = [
    { id: 1, title: "Architectural Mastery", client: "Private Entity", desc: "Constructing modern living spaces with unparalleled design.", budget: "$120M", duration: "36 Months", area: "450k SQFT", img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80" },
    { id: 2, title: "Inspiring Infrastructure", client: "Ministry of Transport", desc: "Building the bridges and roads that connect the future.", budget: "$85M", duration: "18 Months", area: "2.4 Miles", img: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=800&q=80" },
    { id: 3, title: "Artistry in Steel", client: "Apex Developments", desc: "Elevating commercial construction into a form of modern art.", budget: "$40M", duration: "24 Months", area: "120k SQFT", img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80" },
    { id: 4, title: "Eco-Friendly Hub", client: "Green Future Corp", desc: "Sustainable building practices leading the way for tomorrow.", budget: "$65M", duration: "12 Months", area: "90k SQFT", img: "https://images.unsplash.com/photo-1517089152318-42ec560349c0?auto=format&fit=crop&w=800&q=80" }
];

const defaultSettings = { heroImage: 'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?auto=format&fit=crop&w=1920&q=80' };

function getDatabase() {
    let data = localStorage.getItem(DB_KEY);
    if (!data) { localStorage.setItem(DB_KEY, JSON.stringify(defaultProjects)); return defaultProjects; }
    return JSON.parse(data);
}
function saveDatabase(dataArray) { localStorage.setItem(DB_KEY, JSON.stringify(dataArray)); }
function getSettings() {
    let data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return defaultSettings;
    return JSON.parse(data);
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

    if (!title || !desc || !img) {
        alert("Please fill in at least the Title, Description, and Image URL.");
        return;
    }

    const projects = getDatabase();

    if (currentEditId) {
        const index = projects.findIndex(p => p.id === currentEditId);
        if (index !== -1) {
            projects[index] = { id: currentEditId, title, client: client || "Private Entity", desc, img, budget: budget || "N/A", duration: duration || "N/A", area: area || "N/A" };
        }
        alert("Project Updates Saved!");
        cancelEdit(); 
    } else {
        const newProj = { id: Date.now(), title, client: client || "Private Entity", desc, img, budget: budget || "N/A", duration: duration || "N/A", area: area || "N/A" };
        projects.push(newProj);
        alert("New Project Published!");
        document.querySelectorAll('.form-grid input').forEach(input => input.value = '');
    }
    saveDatabase(projects); 
    renderAdminList();
}

function deleteProject(id) {
    if(confirm("Permanently delete this project?")) {
        let projects = getDatabase();
        projects = projects.filter(proj => proj.id !== id);
        saveDatabase(projects);
        renderAdminList(); 
        if (currentEditId === id) cancelEdit();
    }
}

function clearDatabase() {
    if(confirm("Are you sure? This will wipe everything and reset to default projects.")) {
        localStorage.removeItem(DB_KEY);
        cancelEdit();
        renderAdminList();
    }
}

// ==========================================
// 4. SMART MULTI-PAGE ROUTER
// ==========================================
window.onload = function() {
    const hero = document.getElementById('main-hero');
    if (hero) {
        const settings = getSettings();
        hero.style.backgroundImage = `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${settings.heroImage}')`;
    }
    
    if (document.getElementById('home-project-container')) renderHomeProjects();
    if (document.getElementById('portfolio-container')) renderPortfolioProjects();
    
    if (document.getElementById('admin-list')) {
        renderAdminList();
        loadAdminSettings();
    }

    initScrollAnimations(); 
};