// ==========================================
// 1. DATABASE CONFIGURATION (STATELESS SSG)
// ==========================================
const APP_VERSION = "1.1.2"; // AUTO-UPDATES ON EXPORT
let currentEditId = null;

const BASE_URL = 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/';

// THE ABSOLUTE SOURCE OF TRUTH FOR TEXT
const defaultSiteContent = {
    "logoPart1": "IBA",
    "logoPart2": "TRADING",
    "copyright": "© 2026 IBA Trading W.L.L. All rights reserved.",
    "address": "Doha, Qatar",
    "email": "info@ibatrading.com",
    "phone": "+974 4444 0000",
    "contactHeading": "Let’s Build<br>Something Great.",
    "contactSub": "Take the first step towards your inspiring residential or commercial space today! Contact us below to get a personalized quote.",
    "contactBtn": "Send Message"
};

const defaultSettings = {
    "heroImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Webpage/Image/Main.jpg"
};

// THE ABSOLUTE SOURCE OF TRUTH FOR PROJECTS
const defaultProjects = [
    { "id": 1, "title": "Architectural Mastery", "client": "Private Entity", "desc": "Constructing modern living spaces with unparalleled design.", "img": BASE_URL + "Construction-1.jpg", "budget": "120M QR", "duration": "36 Months", "area": "450k SQFT" },
    { "id": 2, "title": "Inspiring Infrastructure", "client": "Ministry of Transport", "desc": "Building the bridges and roads that connect the future.", "img": BASE_URL + "Construction-2.jpg", "budget": "85M QR", "duration": "18 Months", "area": "2.4 Miles" },
    { "id": 3, "title": "Artistry in Steel", "client": "Apex Developments", "desc": "Elevating commercial construction into a form of modern art.", "img": BASE_URL + "Construction-3.jpg", "budget": "40M QR", "duration": "24 Months", "area": "120k SQFT" },
    { "id": 4, "title": "Eco-Friendly Hub", "client": "Green Future Corp", "desc": "Sustainable building practices leading the way for tomorrow.", "img": BASE_URL + "Construction-4.jpg", "budget": "65M QR", "duration": "12 Months", "area": "90k SQFT" },
    { "id": 5, "title": "Airport Terminal Expansion", "client": "Global Airports Corp", "desc": "Phase II expansion increasing passenger capacity by 40%.", "img": BASE_URL + "Construction-5.jpg", "budget": "210M QR", "duration": "48 Months", "area": "800k SQFT" },
    { "id": 6, "title": "Civic Center Renovation", "client": "City Council", "desc": "Complete historical restoration and modernization of the central library.", "img": BASE_URL + "Construction-6.jpg", "budget": "25M QR", "duration": "18 Months", "area": "60k SQFT" },
    { "id": 7, "title": "Oceanfront Resort", "client": "Azure Hotels", "desc": "A world-class resort featuring a unique architectural design and sustainable water management.", "img": BASE_URL + "Construction-7.jpg", "budget": "150M QR", "duration": "36 Months", "area": "350k SQFT" },
    { "id": 8, "title": "Sustainable Office Tower", "client": "Eco-Hub Real Estate", "desc": "Leed-certified office space designed for energy efficiency and modern workstyles.", "img": BASE_URL + "Construction-8.jpg", "budget": "95M QR", "duration": "24 Months", "area": "180k SQFT" },
    { "id": 9, "title": "Intermodal Freight Terminal", "client": "Logistics United", "desc": "A critical logistics hub integrating rail, road, and sea transport.", "img": BASE_URL + "Construction-9.jpg", "budget": "70M QR", "duration": "30 Months", "area": "1.2M SQFT" },
    { "id": 10, "title": "Community Hospital Wing", "client": "City Health Services", "desc": "New state-of-the-art wing focused on outpatient care and medical research.", "img": BASE_URL + "Construction-10.jpg", "budget": "110M QR", "duration": "36 Months", "area": "220k SQFT" }
];

// IN-MEMORY DATABASE
let liveProjects = JSON.parse(JSON.stringify(defaultProjects));
let liveSettings = JSON.parse(JSON.stringify(defaultSettings));
let liveTextContent = JSON.parse(JSON.stringify(defaultSiteContent));

function getDatabase() { return liveProjects; }
function saveDatabase(dataArray) { liveProjects = dataArray; }
function getSettings() { return liveSettings; }
function saveSettings(settings) { liveSettings = settings; }
function getTextContent() { return liveTextContent; }

// ==========================================
// 2. PUBLIC PAGE RENDERING LOGIC (STATIC BYPASS)
// ==========================================

// Auto-Inject Text into HTML globally
function renderGlobalText() {
    const textData = getTextContent();
    
    // Update Logos
    document.querySelectorAll('.logo').forEach(logo => {
        if(!logo.innerHTML.includes('ADMIN')) {
            logo.innerHTML = `${textData.logoPart1} <span>${textData.logoPart2}</span>`;
        }
    });

    // Update Footer Copyright & Info
    const copyEl = document.querySelector('.copyright');
    if(copyEl) copyEl.innerText = textData.copyright;

    const infoItems = document.querySelectorAll('.footer-info-item');
    if(infoItems.length >= 3) {
        infoItems[0].innerHTML = `<span class="icon">📍</span> ${textData.address}`;
        infoItems[1].innerHTML = `<span class="icon">✉️</span> ${textData.email}`;
        infoItems[2].innerHTML = `<span class="icon">📞</span> ${textData.phone}`;
    }

    // Update Contact Banner
    const contactHeading = document.querySelector('.inject-contact-heading');
    if (contactHeading) contactHeading.innerHTML = textData.contactHeading;
    
    const contactSub = document.querySelector('.inject-contact-sub');
    if (contactSub) contactSub.innerHTML = textData.contactSub;

    const contactBtn = document.querySelector('.inject-contact-btn');
    if (contactBtn) contactBtn.innerHTML = textData.contactBtn;
}

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

    const txt = getTextContent();
    if(document.getElementById('text-logo-1')) document.getElementById('text-logo-1').value = txt.logoPart1;
    if(document.getElementById('text-logo-2')) document.getElementById('text-logo-2').value = txt.logoPart2;
    if(document.getElementById('text-copyright')) document.getElementById('text-copyright').value = txt.copyright;
    if(document.getElementById('text-address')) document.getElementById('text-address').value = txt.address;
    if(document.getElementById('text-email')) document.getElementById('text-email').value = txt.email;
    if(document.getElementById('text-phone')) document.getElementById('text-phone').value = txt.phone;
    if(document.getElementById('text-contact-heading')) document.getElementById('text-contact-heading').value = txt.contactHeading;
    if(document.getElementById('text-contact-sub')) document.getElementById('text-contact-sub').value = txt.contactSub;
    if(document.getElementById('text-contact-btn')) document.getElementById('text-contact-btn').value = txt.contactBtn;
}

function saveSiteSettings() {
    const heroInput = document.getElementById('site-hero-img').value;
    saveSettings({ heroImage: heroInput || defaultSettings.heroImage });
    alert('Site background updated in Memory! Ready to Export.');
}

function saveTextContent() {
    liveTextContent = {
        logoPart1: document.getElementById('text-logo-1').value,
        logoPart2: document.getElementById('text-logo-2').value,
        copyright: document.getElementById('text-copyright').value,
        address: document.getElementById('text-address').value,
        email: document.getElementById('text-email').value,
        phone: document.getElementById('text-phone').value,
        contactHeading: document.getElementById('text-contact-heading').value,
        contactSub: document.getElementById('text-contact-sub').value,
        contactBtn: document.getElementById('text-contact-btn').value
    };
    alert('Global Text updated in Memory! Ready to Export.');
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
        liveTextContent = JSON.parse(JSON.stringify(defaultSiteContent));
        cancelEdit(); renderAdminList(); loadAdminSettings();
    }
}

// ==========================================
// 4. SMART MULTI-PAGE ROUTER
// ==========================================
window.onload = function() {
    renderGlobalText();

    const hero = document.getElementById('main-hero');
    if (hero) {
        hero.style.setProperty('background-image', `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${defaultSettings.heroImage}')`, 'important');
    }
    
    const versionDisplay = document.getElementById('app-version-display');
    if (versionDisplay) versionDisplay.innerText = "Build v" + APP_VERSION;
    
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

        const versionParts = APP_VERSION.split('.');
        const newBuild = parseInt(versionParts[2]) + 1;
        const newVersion = `${versionParts[0]}.${versionParts[1]}.${newBuild}`;

        const currentProjects = getDatabase();
        const currentSettings = getSettings();
        const currentText = getTextContent();

        const projectsString = 'const defaultProjects = ' + JSON.stringify(currentProjects, null, 4) + ';';
        const settingsString = 'const defaultSettings = ' + JSON.stringify(currentSettings, null, 4) + ';';
        const textString = 'const defaultSiteContent = ' + JSON.stringify(currentText, null, 4) + ';';

        code = code.replace(/const defaultProjects = \[[\s\S]*?\];/, projectsString);
        code = code.replace(/const defaultSettings = \{[\s\S]*?\};/, settingsString);
        code = code.replace(/const defaultSiteContent = \{[\s\S]*?\};/, textString);
        code = code.replace(/const APP_VERSION = "[\d\.]+";/, `const APP_VERSION = "${newVersion}";`);

        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'app.js';
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Success! Version upgraded to v${newVersion}. Check your Downloads folder for the new app.js file.`);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export. This tool must be run on the live GitHub server or a local server to read the file.");
    }
}

// ==========================================
// 6. SMART PDF PRESENTATION GENERATOR
// ==========================================
async function generatePresentationPDF() {
    const printContainer = document.createElement('div');
    printContainer.id = 'print-presentation';
    const pages = ['index.html', 'about.html', 'services.html', 'projects.html'];

    const allProjects = getDatabase();
    let tocProjectsHTML = allProjects.map((p, index) =>
        `<li style="margin-bottom: 8px;"><strong>4.${index + 1}</strong> ${p.title} <span style="color: var(--text-muted); font-size: 0.95rem;">— ${p.client}</span></li>`
    ).join('');

    let combinedHTML = `
        <div class="print-page-break" style="padding: 10% 8%; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
            <h1 style="font-size: 4.5rem; color: var(--text-main); font-weight: 800; text-transform: uppercase; margin-bottom: 10px; line-height: 1;">IBA Contracting</h1>
            <h2 style="font-size: 1.8rem; color: var(--accent-color); margin-bottom: 40px;">Website Content Review Document</h2>
            <hr style="border: 2px solid #e2e8f0; margin-bottom: 40px;">

            <h3 style="font-size: 2.2rem; margin-bottom: 20px; font-weight: 800;">Table of Contents</h3>
            <ul style="list-style: none; padding: 0; font-size: 1.4rem; line-height: 2;">
                <li><strong>1. Home Page</strong> <span style="color: var(--text-muted); font-size: 1.1rem;">(Executive Summary)</span></li>
                <li><strong>2. About Us</strong> <span style="color: var(--text-muted); font-size: 1.1rem;">(Company History & Pillars)</span></li>
                <li><strong>3. Services</strong> <span style="color: var(--text-muted); font-size: 1.1rem;">(Core Competencies)</span></li>
                <li><strong>4. Project Portfolio</strong>
                    <ul style="list-style: none; padding-left: 40px; font-size: 1.2rem; line-height: 1.6; margin-top: 15px;">
                        ${tocProjectsHTML}
                    </ul>
                </li>
                <li><strong>5. Global Design Elements</strong>
                    <ul style="list-style: none; padding-left: 40px; font-size: 1.2rem; line-height: 1.6; margin-top: 15px;">
                        <li><strong>A.</strong> Header / Navigation Area</li>
                        <li><strong>B.</strong> Contact Us & Bottom Footer</li>
                    </ul>
                </li>
            </ul>

            <div style="margin-top: auto; padding-top: 30px; border-top: 2px solid #e2e8f0; color: var(--text-muted); font-size: 1.1rem;">
                <strong>IBA Contracting W.L.L.</strong> | 📍 Doha, Qatar | ✉️ info@ibacontracting.com | 📞 +974 4444 0000
            </div>
        </div>
    `;

    alert("Compiling presentation with live data... Please wait a moment.");

    let sharedNavHTML = "";
    let sharedContactHTML = "";
    let sharedFooterHTML = "";

    for (const page of pages) {
        try {
            const response = await fetch(page);
            const htmlString = await response.text();
            const parser = new DOMParser();
            const virtualDoc = parser.parseFromString(htmlString, 'text/html');

            const textData = getTextContent();
            
            // Inject text into PDF virtual document
            virtualDoc.querySelectorAll('.logo').forEach(logo => {
                if(!logo.innerHTML.includes('ADMIN')) logo.innerHTML = `${textData.logoPart1} <span>${textData.logoPart2}</span>`;
            });
            const copyEl = virtualDoc.querySelector('.copyright');
            if(copyEl) copyEl.innerText = textData.copyright;
            
            const infoItems = virtualDoc.querySelectorAll('.footer-info-item');
            if(infoItems.length >= 3) {
                infoItems[0].innerHTML = `<span class="icon">📍</span> ${textData.address}`;
                infoItems[1].innerHTML = `<span class="icon">✉️</span> ${textData.email}`;
                infoItems[2].innerHTML = `<span class="icon">📞</span> ${textData.phone}`;
            }

            const cHeading = virtualDoc.querySelector('.inject-contact-heading');
            if(cHeading) cHeading.innerHTML = textData.contactHeading;
            const cSub = virtualDoc.querySelector('.inject-contact-sub');
            if(cSub) cSub.innerHTML = textData.contactSub;
            const cBtn = virtualDoc.querySelector('.inject-contact-btn');
            if(cBtn) cBtn.innerHTML = textData.contactBtn;

            if (!sharedNavHTML) {
                const navElement = virtualDoc.querySelector('nav');
                if (navElement) {
                    navElement.className = ''; 
                    navElement.style.position = 'relative';
                    navElement.style.backgroundColor = '#1b1b1b';
                    navElement.style.padding = '20px 5%';
                    navElement.style.display = 'flex';
                    navElement.style.justifyContent = 'space-between';
                    navElement.style.alignItems = 'center';
                    sharedNavHTML = navElement.outerHTML;
                }
            }
            if (!sharedContactHTML) {
                const contactSection = virtualDoc.querySelector('.contact-banner');
                if (contactSection) sharedContactHTML = contactSection.outerHTML;
            }
            if (!sharedFooterHTML) {
                const footerSection = virtualDoc.querySelector('.main-footer');
                if (footerSection) sharedFooterHTML = footerSection.outerHTML;
            }

            const nav = virtualDoc.querySelector('nav'); if (nav) nav.remove();
            const footer = virtualDoc.querySelector('footer'); if (footer) footer.remove();
            const modals = virtualDoc.querySelectorAll('.detail-overlay'); modals.forEach(m => m.remove());
            const contactBanner = virtualDoc.querySelector('.contact-banner'); if (contactBanner) contactBanner.remove();

            const homeContainer = virtualDoc.getElementById('home-project-container');
            if (homeContainer) {
                const topProjects = allProjects.slice(0, 3);
                homeContainer.innerHTML = topProjects.map(proj => `
                    <div style="background: url('${proj.img}') center/cover; position: relative; height: 350px; border-radius: 8px; break-inside: avoid; margin-bottom: 20px;">
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 30px 20px 20px 20px; border-radius: 0 0 8px 8px;">
                            <p style="color: var(--accent-color); margin:0; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${proj.client}</p>
                            <h3 style="margin:0; font-size: 1.5rem; color: white;">${proj.title}</h3>
                        </div>
                    </div>
                `).join('');
            }

            const portfolioContainer = virtualDoc.getElementById('portfolio-container');
            if (portfolioContainer) {
                portfolioContainer.style.columnCount = '1';
                portfolioContainer.style.display = 'grid';
                portfolioContainer.style.gridTemplateColumns = '1fr 1fr';
                portfolioContainer.style.gap = '40px';

                portfolioContainer.innerHTML = allProjects.map(proj => `
                    <div style="break-inside: avoid; padding-bottom: 20px;">
                        <img src="${proj.img}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                        <p style="color: var(--accent-color); font-weight: bold; font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase;">${proj.client}</p>
                        <h3 style="font-size: 1.6rem; margin-bottom: 10px; color: var(--text-main); font-weight: 800; line-height: 1.1;">${proj.title}</h3>
                        <p style="color: var(--text-muted); font-size: 1rem; line-height: 1.5;">${proj.desc}</p>
                        <div style="margin-top: 15px; font-size: 0.9rem; color: #475569; background: #f8fafc; padding: 10px; border-radius: 4px; display: inline-block;">
                            <strong>Budget:</strong> ${proj.budget} &nbsp;|&nbsp; <strong>Duration:</strong> ${proj.duration}
                        </div>
                    </div>
                `).join('');
            }

            const pageName = page.replace('.html', '').toUpperCase();
            combinedHTML += `
                <div class="print-page-break">
                    <div style="background: #f8fafc; padding: 15px 30px; border-left: 6px solid var(--accent-color); margin: 40px 5%; font-size: 1.5rem; color: var(--text-main); font-weight: 800;">
                        SECTION // ${pageName}
                    </div>
                    ${virtualDoc.body.innerHTML}
                </div>
            `;
        } catch (error) {
            console.error("Error fetching " + page, error);
        }
    }

    combinedHTML += `
        <div class="print-page-break">
            <div style="background: #f8fafc; padding: 15px 30px; border-left: 6px solid var(--accent-color); margin: 40px 5%; font-size: 1.5rem; color: var(--text-main); font-weight: 800;">
                SECTION // 5. GLOBAL DESIGN ELEMENTS
            </div>
            
            <div style="margin: 0 5%; border: 2px dashed #cbd5e1; margin-bottom: 40px;">
                <h4 style="background: #e2e8f0; margin: 0; padding: 10px 20px; font-size: 1.1rem; color: var(--text-main);">A. Header & Navigation Area</h4>
                ${sharedNavHTML}
            </div>

            <div style="margin: 0 5%; border: 2px dashed #cbd5e1;">
                <h4 style="background: #e2e8f0; margin: 0; padding: 10px 20px; font-size: 1.1rem; color: var(--text-main);">B. Contact Us & Bottom Footer</h4>
                ${sharedContactHTML}
                ${sharedFooterHTML}
            </div>
        </div>
    `;

    printContainer.innerHTML = combinedHTML;
    document.body.appendChild(printContainer);

    setTimeout(() => {
        window.print();
        setTimeout(() => { document.body.removeChild(printContainer); }, 1000);
    }, 1500);
}