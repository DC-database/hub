// ==========================================
// 1. DATABASE CONFIGURATION (STATELESS SSG)
// ==========================================
const APP_VERSION = "1.2.4"; // AUTO-UPDATES ON EXPORT
let currentEditId = null;

const BASE_URL = 'https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/tawd/image/';

// THE ABSOLUTE SOURCE OF TRUTH FOR TEXT
const defaultSiteContent = {
    "logoPart1": "TAWD",
    "logoPart2": "DEVELOPMENT W.L.L.",
    "copyright": "© 2026 TAWD Development W.L.L. All rights reserved.",
    "address": "Doha, Qatar",
    "email": "info@ibatrading.com",
    "phone": "+974 4040 3535",
    "contactHeading": "Let’s Build<br>Something Great.",
    "contactSub": "Take the first step towards your inspiring residential or commercial space today! Contact us below to get a personalized quote.",
    "contactBtn": "Send Message"
};

const defaultSettings = {
    "heroImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/tawd/image/Main.jpg",
    "aboutImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/tawd/image/Construction-2.jpg",
    "servicesImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/tawd/image/Construction-3.jpg",
    "projectsImage": "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/tawd/image/Construction-1.jpg"
};

// THE ORIGINAL STRUCTURE
const defaultProjects = [
    { "id": 1, "title": "Leqtaifiya Palace", "client": "IBA", "desc": "Dafna Palace construction is an exceptional architectural design innovation. Featuring unique, cutting-edge, & historically significant styles. Its unique and luxurious design is making big impact on its surroundings, elevating the value and desirability of nearby properties. Its contribute to the development of an entire neighborhood or district, attracting other luxury developments, businesses, and amenities. Its construcion features smart building systems, sustainable materials, with its environmentally friendly designs that enhance their status as modern, forward-thinking structures. Dafna Palace is a hallmark of luxury, exclusivity, and architectural excellence.", "img": BASE_URL + "Construction-1.jpg", "folder": "a", "year": "2024", "location": "Dafna", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 2, "title": "Marina Tower 16", "client": "IBA", "desc": "In the middle of a thriving city, Residential Tower 16 unfolds modern-contemporary residences in Lusail Marina’s urban oasis. An integrated locale places homes at the center of it all – Paramount connectivity to the grand spaces of Lusail’s Medical & Education district and proximity to premier lifestyle destinations in Entertainment city.  Marina R-16 is our latest tower in Lusail city. The new 121 Modern residential units are designed to enjoy benefits of natural light, generously sized bathrooms & wide-open sea views.", "img": BASE_URL + "Construction-2.jpg", "folder": "b", "year": "2025", "location": "Lusail Marina", "contractor": "TAWD Development", "status": "In Progress" },
    { "id": 3, "title": "Lusail Twin Towers", "client": "IBA", "desc": "Lusail Twin Towers RES17 & RES19 are the premier residential towers in Lusail City. They are the first residential project to be completed and the first to be occupied in Lusail’s exclusive Marina district. The modern towers design house 158 apartments in each building that sits overlooking the Marina which views the Pearl Qatar and City of Doha. It the most desirable place to live in Lusail.", "img": BASE_URL + "Construction-3.jpg", "folder": "c", "year": "2023", "location": "Lusail City", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 4, "title": "Fox Hills K06 & K14", "client": "IBA", "desc": "Designed to accommodate people for living purposes. Includes living area such as kitchens, bedrooms, bathrooms and private outdoor spaces like gardens & patios. Designed for comport, privacy and personal use.", "img": BASE_URL + "Construction-4.jpg", "folder": "d", "year": "2022", "location": "Fox Hills", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 5, "title": "Al Arqam Academy Schools", "client": "IBA", "desc": "Al Arqam Academy is situated on the main road in Abu Hamour. The all-girls school has become a sought-out school for many parents. The school houses all grades from kindergarten all the way to high school. The school amenities include a swimming pool, gymnasium, outdoor play area along with so much more.", "img": BASE_URL + "Construction-5.jpg", "folder": "e", "year": "2024", "location": "Abu Hamour", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 6, "title": "Al Dana Tower", "client": "IBA", "desc": "The 16 story tower in Al Dafna was one of the first towers to be built in West Bay in the Year 2000. IBA takes pride in being one of the first to build towers in the area and this accomplishment propelled us into other endeavors.", "img": BASE_URL + "Construction-6.jpg", "folder": "f", "year": "2000", "location": "Al Dafna", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 7, "title": "Concorde Hotel", "client": "IBA Group", "desc": "Concorde Hotel Doha is a Five Stars hotel that offers a unique line of products and services. From the carefully appointed bedrooms, contemporary restaurants geared to offering superior experience, superbly appointed conference halls, to a state-of-the-art gymnasium attached with massage room to indulge in, matched with our unwavering commitment and attitude of everyone who works for us. Concorde Hotel Doha stands elegantly in the heart of the city. A heaven of hospitality in the gulf and the preferred venue for prestigious international conferences in Doha, Concorde Hotel Doha is committed to deliver superior experience every time you visit us.", "img": BASE_URL + "Construction-7.jpg", "folder": "g", "year": "2015", "location": "Doha City Center", "contractor": "TAWD Development", "status": "Completed" },
    { "id": 8, "title": "Sustainable Office Tower", "client": "Eco-Hub Real Estate", "desc": "Leed-certified office space designed for energy efficiency and modern workstyles.", "img": BASE_URL + "Construction-8.jpg", "folder": "h", "year": "2026", "location": "Lusail", "contractor": "TAWD Development", "status": "Planning" },
    { "id": 9, "title": "Intermodal Freight Terminal", "client": "Logistics United", "desc": "A critical logistics hub integrating rail, road, and sea transport.", "img": BASE_URL + "Construction-9.jpg", "folder": "i", "year": "2025", "location": "Mesaieed", "contractor": "TAWD Development", "status": "In Progress" },
    { "id": 10, "title": "Community Hospital Wing", "client": "City Health Services", "desc": "New state-of-the-art wing focused on outpatient care and medical research.", "img": BASE_URL + "Construction-10.jpg", "folder": "j", "year": "2024", "location": "Al Wakra", "contractor": "TAWD Development", "status": "Completed" }
];

let liveProjects = JSON.parse(JSON.stringify(defaultProjects));
let liveSettings = JSON.parse(JSON.stringify(defaultSettings));
let liveTextContent = JSON.parse(JSON.stringify(defaultSiteContent));

function getDatabase() { return liveProjects; }
function saveDatabase(dataArray) { liveProjects = dataArray; }
function getSettings() { return liveSettings; }
function saveSettings(settings) { liveSettings = settings; }
function getTextContent() { return liveTextContent; }

// ==========================================
// 2. THE "SMART" IMAGE ROUTER
// ==========================================
function getProjectImages(folderLetter) {
    let urls = [];
    const safeLetter = (folderLetter || "a").toLowerCase().trim();
    for (let i = 1; i <= 4; i++) {
        urls.push(`${BASE_URL}thumb/p${safeLetter}${i}.jpg`);
    }
    return urls;
}

// ==========================================
// 3. PUBLIC PAGE RENDERING LOGIC
// ==========================================
function renderGlobalText() {
    const textData = getTextContent();
    
    document.querySelectorAll('.logo').forEach(logo => {
        if(!logo.innerHTML.includes('ADMIN')) {
            logo.innerHTML = `${textData.logoPart1} <span>${textData.logoPart2}</span>`;
        }
    });

    const copyEl = document.querySelector('.copyright');
    if(copyEl) copyEl.innerText = textData.copyright;

    const infoItems = document.querySelectorAll('.footer-info-item');
    if(infoItems.length >= 3) {
        infoItems[0].innerHTML = `<span class="icon">📍</span> ${textData.address}`;
        infoItems[1].innerHTML = `<span class="icon">✉️</span> ${textData.email}`;
        infoItems[2].innerHTML = `<span class="icon">📞</span> ${textData.phone}`;
    }

    const contactHeading = document.querySelector('.inject-contact-heading');
    if (contactHeading) contactHeading.innerHTML = textData.contactHeading;
    
    const contactSub = document.querySelector('.inject-contact-sub');
    if (contactSub) contactSub.innerHTML = textData.contactSub;

    const contactBtn = document.querySelector('.inject-contact-btn');
    if (contactBtn) contactBtn.innerHTML = textData.contactBtn;
}

function renderHomeProjects() {
    const projects = liveProjects.slice(0, 3); 
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
    const projects = liveProjects;
    const container = document.getElementById('portfolio-container');
    if (!container) return; 
    container.innerHTML = ''; 
    projects.forEach(proj => {
        const blockHTML = `
            <div class="project-card reveal" onclick="openDetailView(${proj.id})">
                <img src="${proj.img}" alt="${proj.title}" class="project-image" onerror="this.src='https://via.placeholder.com/600x400?text=Photo+Missing'">
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

// ==========================================
// 4. ANIMATED TEXT DECODER & NUMBER COUNTER
// ==========================================
function initNumberCounters() {
    const counters = document.querySelectorAll('.count-up');
    if (counters.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.getAttribute('data-target'));
                const duration = 2000; 
                let startTime = null;

                function step(currentTime) {
                    if (!startTime) startTime = currentTime;
                    const progress = Math.min((currentTime - startTime) / duration, 1);
                    el.innerText = Math.floor(progress * target);
                    if (progress < 1) {
                        window.requestAnimationFrame(step);
                    } else {
                        el.innerText = target; 
                    }
                }
                window.requestAnimationFrame(step);
                observer.unobserve(el); 
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
        counter.innerText = '0'; 
        observer.observe(counter);
    });
}

function animateTextScramble(element, finalString) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let iteration = 0;
    
    if (element.scrambleInterval) clearInterval(element.scrambleInterval);
    
    element.scrambleInterval = setInterval(() => {
        element.innerText = finalString.split('').map((letter, index) => {
            if (letter === ' ') return ' ';
            if (index < iteration) return finalString[index];
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        
        if (iteration >= finalString.length) clearInterval(element.scrambleInterval);
        iteration += 1 / 3; 
    }, 30);
}

// ==========================================
// 5. SMART SQUARE GALLERY & LIGHTBOX SLIDER
// ==========================================
let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openDetailView(projectId) {
    const proj = liveProjects.find(p => p.id === projectId);
    if(!proj) return;

    const oldMainImg = document.getElementById('detail-img');
    if (oldMainImg) oldMainImg.style.background = `url('${proj.img}') no-repeat center center / cover`;

    const thumbContainer = document.getElementById('thumb-container');
    if(thumbContainer) {
        thumbContainer.innerHTML = '';
        const urls = getProjectImages(proj.folder); 
        
        urls.forEach((url) => {
            const t = document.createElement('img');
            t.src = url;
            t.onerror = function() { this.remove(); };
            t.style = "aspect-ratio: 1 / 1; flex: 1; max-width: 150px; min-width: 110px; object-fit: cover; border-radius: 8px; cursor: zoom-in; transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 2px solid transparent;";
            t.onmouseover = () => t.style.borderColor = "#FF9800";
            t.onmouseout = () => t.style.borderColor = "transparent";
            t.onclick = (e) => { e.stopPropagation(); openLightboxWithImage(url); };
            thumbContainer.appendChild(t);
        });
    }

    document.getElementById('detail-client').innerText = `CLIENT // ${proj.client}`;
    const titleEl = document.getElementById('detail-title');
    titleEl.innerText = proj.title; 
    animateTextScramble(titleEl, proj.title); 
    document.getElementById('detail-desc').innerText = proj.desc;
    
    if(document.getElementById('detail-year')) document.getElementById('detail-year').innerText = proj.year || "N/A";
    if(document.getElementById('detail-location')) document.getElementById('detail-location').innerText = proj.location || "N/A";
    if(document.getElementById('detail-contractor')) document.getElementById('detail-contractor').innerText = proj.contractor || "N/A";
    if(document.getElementById('detail-status')) document.getElementById('detail-status').innerText = proj.status || "N/A";

    document.getElementById('project-detail-view').classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

function closeDetailView() {
    document.getElementById('project-detail-view').classList.remove('active');
    document.body.style.overflow = 'auto'; 
}

function openLightboxWithImage(url) {
    const visibleThumbs = document.querySelectorAll('#thumb-container img');
    currentLightboxImages = Array.from(visibleThumbs).map(img => img.src);
    
    currentLightboxIndex = currentLightboxImages.indexOf(url);
    if (currentLightboxIndex === -1) currentLightboxIndex = 0;

    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxView = document.getElementById('lightbox-view');
    if(lightboxImg && lightboxView) {
        lightboxImg.src = currentLightboxImages[currentLightboxIndex];
        lightboxView.style.display = 'flex';
    }
}

function prevLightboxImage() {
    if(currentLightboxImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex];
}

function nextLightboxImage() {
    if(currentLightboxImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex];
}

function closeLightbox() {
    const lightboxView = document.getElementById('lightbox-view');
    if(lightboxView) lightboxView.style.display = 'none';
}

// ==========================================
// 6. ADMIN PANEL LOGIC (IN-MEMORY)
// ==========================================
function loadAdminSettings() {
    const settings = getSettings();
    if(document.getElementById('site-hero-img')) document.getElementById('site-hero-img').value = settings.heroImage || '';
    if(document.getElementById('site-about-img')) document.getElementById('site-about-img').value = settings.aboutImage || '';
    if(document.getElementById('site-services-img')) document.getElementById('site-services-img').value = settings.servicesImage || '';
    if(document.getElementById('site-projects-img')) document.getElementById('site-projects-img').value = settings.projectsImage || '';

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
    saveSettings({ 
        heroImage: document.getElementById('site-hero-img').value || defaultSettings.heroImage,
        aboutImage: document.getElementById('site-about-img').value || defaultSettings.aboutImage,
        servicesImage: document.getElementById('site-services-img').value || defaultSettings.servicesImage,
        projectsImage: document.getElementById('site-projects-img').value || defaultSettings.projectsImage
    });
    alert('Site Banners updated in Memory! Ready to Export.');
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
                    <p>Folder: <strong>${(proj.folder || "a").toUpperCase()}</strong> | Year: ${proj.year}</p>
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
    document.getElementById('proj-img').value = proj.img;
    document.getElementById('proj-desc').value = proj.desc;
    
    if(document.getElementById('proj-folder')) document.getElementById('proj-folder').value = proj.folder || "a";

    document.getElementById('proj-year').value = proj.year;
    document.getElementById('proj-location').value = proj.location;
    document.getElementById('proj-contractor').value = proj.contractor;
    document.getElementById('proj-status').value = proj.status;

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
    const img = document.getElementById('proj-img').value;
    const desc = document.getElementById('proj-desc').value;
    
    const folderInput = document.getElementById('proj-folder');
    const folder = folderInput ? folderInput.value.toLowerCase().trim() : "a";

    const year = document.getElementById('proj-year').value;
    const location = document.getElementById('proj-location').value;
    const contractor = document.getElementById('proj-contractor').value;
    const status = document.getElementById('proj-status').value;

    if (!title || !desc || !img || !folder) { alert("Please fill in the Title, Description, Folder Letter, and Main Image URL."); return; }

    const projects = getDatabase();

    if (currentEditId) {
        const index = projects.findIndex(p => p.id === currentEditId);
        if (index !== -1) projects[index] = { id: currentEditId, title, client: client || "Private Entity", img, desc, folder, year: year || "N/A", location: location || "N/A", contractor: contractor || "N/A", status: status || "N/A" }; 
        alert("Project Updates Saved to Memory! Ready to Export."); 
        cancelEdit(); 
    } else {
        const newProj = { id: Date.now(), title, client: client || "Private Entity", img, desc, folder, year: year || "N/A", location: location || "N/A", contractor: contractor || "N/A", status: status || "N/A" };
        projects.push(newProj); 
        alert("New Project Published to Memory! Ready to Export.");
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
// 7. SMART MULTI-PAGE ROUTER & BANNERS
// ==========================================
window.onload = function() {
    renderGlobalText();
    setupPageTransitions();

    const currentPath = window.location.pathname.toLowerCase();
    const homeHero = document.getElementById('main-hero');
    if (homeHero) homeHero.style.setProperty('background-image', `linear-gradient(to right, rgba(27, 27, 27, 0.95) 0%, rgba(27, 27, 27, 0.7) 45%, transparent 100%), url('${liveSettings.heroImage}')`, 'important');

    const subPageHero = document.querySelector('.page-hero');
    if (subPageHero) {
        let activeBg = liveSettings.projectsImage; 
        if (currentPath.includes('about')) activeBg = liveSettings.aboutImage;
        if (currentPath.includes('services')) activeBg = liveSettings.servicesImage;
        if (currentPath.includes('projects')) activeBg = liveSettings.projectsImage;
        subPageHero.style.setProperty('background', `linear-gradient(rgba(15, 22, 33, 0.8), rgba(15, 22, 33, 0.8)), url('${activeBg}') center/cover no-repeat`, 'important');
    }
    
    const versionDisplay = document.getElementById('app-version-display');
    if (versionDisplay) versionDisplay.innerText = "Build v" + APP_VERSION;
    
    if (document.getElementById('home-project-container')) renderHomeProjects();
    if (document.getElementById('portfolio-container')) renderPortfolioProjects();
    if (document.getElementById('admin-list')) { renderAdminList(); loadAdminSettings(); }

    initScrollAnimations(); 
    initNumberCounters(); 
};

// ==========================================
// 8. STATIC SITE GENERATOR (GITHUB EXPORT)
// ==========================================
async function downloadUpdatedAppJs() {
    try {
        const response = await fetch('app.js');
        let code = await response.text();

        const versionParts = APP_VERSION.split('.');
        const newBuild = parseInt(versionParts[2]) + 1;
        const newVersion = `${versionParts[0]}.${versionParts[1]}.${newBuild}`;

        const projectsString = 'const defaultProjects = ' + JSON.stringify(getDatabase(), null, 4) + ';';
        const settingsString = 'const defaultSettings = ' + JSON.stringify(getSettings(), null, 4) + ';';
        const textString = 'const defaultSiteContent = ' + JSON.stringify(getTextContent(), null, 4) + ';';

        code = code.replace(/const defaultProjects = \[[\s\S]*?\];/, projectsString);
        code = code.replace(/const defaultSettings = \{[\s\S]*?\};/, settingsString);
        code = code.replace(/const defaultSiteContent = \{[\s\S]*?\};/, textString);
        code = code.replace(/const APP_VERSION = "[\d\.]+";/, `const APP_VERSION = "${newVersion}";`);

        const blob = new Blob([code], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'app.js';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

        alert(`Success! Version upgraded to v${newVersion}. Check your Downloads folder for the new app.js file.`);
    } catch (error) { alert("Failed to export. This tool must be run on the live GitHub server or a local server."); }
}

// ==========================================
// 9. PROFESSIONAL DESIGN REVIEW PDF GENERATOR
// ==========================================
async function generatePresentationPDF() {
    const printContainer = document.createElement('div');
    printContainer.id = 'print-presentation';
    const pages = ['index.html', 'about.html', 'services.html', 'projects.html'];

    const allProjects = getDatabase();
    
    let tocProjectsHTML = allProjects.map((p, index) => `<li style="margin-bottom: 8px;"><strong>4.${index + 1}</strong> ${p.title}</li>`).join('');

    let combinedHTML = `
        <style>
            @media print {
                body { background: white !important; font-family: sans-serif; }
                
                .review-box { 
                    border: 2px dashed #FF5722; 
                    padding: 20px; 
                    margin-bottom: 30px; 
                    position: relative; 
                    border-radius: 8px; 
                    page-break-inside: avoid !important; 
                    break-inside: avoid !important; 
                    display: block; 
                    width: 100%; 
                    box-sizing: border-box; 
                }
                
                .review-tag { background: #FF5722; color: white; padding: 6px 14px; position: absolute; top: -16px; left: 20px; font-weight: bold; font-size: 14px; font-family: monospace; border-radius: 4px; text-transform: uppercase; }
                .annotation { display: inline-flex; align-items: center; background: #FFECB3; color: #E65100; border: 1px solid #FF9800; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 15px; page-break-inside: avoid; }
                .remarks-box { margin-top: 20px; background: #fafafa; border: 1px solid #ccc; padding: 15px; font-family: monospace; color: #666; min-height: 80px; page-break-inside: avoid; break-inside: avoid; }
                .remarks-line { border-bottom: 1px solid #ddd; height: 25px; margin-top: 5px; }
                .pdf-cover { display: flex; flex-direction: column; justify-content: center; height: 100vh; padding: 10% 8%; }
                .print-page-break { page-break-after: always; padding: 20px; }
                
                img { max-width: 100%; page-break-inside: avoid; break-inside: avoid; }
            }
        </style>
        <div class="print-page-break pdf-cover">
            <div class="annotation">➔ CEO Review Document</div>
            <h1 style="font-size: 4.5rem; color: #111; font-weight: 900; line-height: 1;">TAWD DEVELOPMENT</h1>
            <h2 style="font-size: 1.8rem; color: #FF9800; margin-bottom: 40px;">Website Wireframe & Design Audit</h2>
            <hr style="border: 2px solid #eee; margin-bottom: 40px;">

            <div class="review-box">
                <div class="review-tag">Approval Required</div>
                <p><strong>Instructions:</strong> Please review the generated layouts, text, and data below. Use the attached "Remarks" boxes to write in any requested changes.</p>
                <div class="remarks-box">
                    <strong>General Notes / Executive Remarks:</strong>
                    <div class="remarks-line"></div>
                    <div class="remarks-line"></div>
                    <div class="remarks-line"></div>
                </div>
            </div>

            <h3 style="font-size: 2.2rem; margin-bottom: 20px;">Table of Contents</h3>
            <ul style="list-style: none; padding: 0; font-size: 1.4rem; line-height: 2;">
                <li><strong>1. Home Page</strong></li>
                <li><strong>2. About Us</strong></li>
                <li><strong>3. Services</strong></li>
                <li><strong>4. Project Portfolio Grid</strong>
                    <ul style="list-style: none; padding-left: 40px; font-size: 1.1rem; line-height: 1.6; margin-top: 10px;">
                        ${tocProjectsHTML}
                    </ul>
                </li>
                <li><strong>5. Project Detail View (Sample Popup)</strong></li>
                <li><strong>6. Global Master Components</strong></li>
            </ul>
        </div>
    `;

    alert("Compiling Blueprint PDF... Please wait a moment.");

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

            const pgHero = virtualDoc.querySelector('.page-hero');
            if (pgHero) {
                let pBg = liveSettings.projectsImage;
                if (page.includes('about')) pBg = liveSettings.aboutImage;
                if (page.includes('services')) pBg = liveSettings.servicesImage;
                pgHero.style.setProperty('background', `linear-gradient(rgba(15, 22, 33, 0.8), rgba(15, 22, 33, 0.8)), url('${pBg}') center/cover no-repeat`, 'important');
            }

            if (!sharedNavHTML) {
                const navElement = virtualDoc.querySelector('nav');
                if (navElement) {
                    navElement.className = ''; navElement.style.cssText = 'background:#1b1b1b; padding:20px 5%; display:flex; justify-content:space-between; align-items:center; page-break-inside: avoid; break-inside: avoid;';
                    sharedNavHTML = navElement.outerHTML;
                }
            }
            if (!sharedContactHTML) {
                const contactSection = virtualDoc.querySelector('.contact-banner');
                if (contactSection) {
                    contactSection.style.pageBreakInside = 'avoid';
                    sharedContactHTML = contactSection.outerHTML;
                }
            }
            if (!sharedFooterHTML) {
                const footerSection = virtualDoc.querySelector('.main-footer');
                if (footerSection) {
                    footerSection.style.pageBreakInside = 'avoid';
                    sharedFooterHTML = footerSection.outerHTML;
                }
            }

            const nav = virtualDoc.querySelector('nav'); if (nav) nav.remove();
            const footer = virtualDoc.querySelector('footer'); if (footer) footer.remove();
            const modals = virtualDoc.querySelectorAll('.detail-overlay'); modals.forEach(m => m.remove());
            const contactBanner = virtualDoc.querySelector('.contact-banner'); if (contactBanner) contactBanner.remove();

            const homeContainer = virtualDoc.getElementById('home-project-container');
            if (homeContainer) {
                const topProjects = allProjects.slice(0, 3);
                homeContainer.style.display = 'block';
                homeContainer.style.width = '100%';
                homeContainer.innerHTML = topProjects.map(proj => `
                    <div style="display: inline-block; width: 31%; margin: 1%; background: url('${proj.img}') center/cover; position: relative; height: 200px; border-radius: 8px; page-break-inside: avoid; break-inside: avoid; box-sizing: border-box;">
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent); padding: 15px; border-radius: 0 0 8px 8px;">
                            <p style="color: #FF9800; margin:0; font-weight: bold; font-size: 0.7rem; text-transform: uppercase;">${proj.client}</p>
                            <h3 style="margin:0; font-size: 1rem; color: white;">${proj.title}</h3>
                        </div>
                    </div>
                `).join('');
            }

            const portfolioContainer = virtualDoc.getElementById('portfolio-container');
            if (portfolioContainer) {
                portfolioContainer.style.display = 'block';
                portfolioContainer.style.width = '100%';
                
                portfolioContainer.innerHTML = allProjects.map((proj, index) => {
                    const urls = getProjectImages(proj.folder);
                    const thumbnailsHTML = urls.map(u => `<img src="${u}" onerror="this.remove()" style="width:45px; height:45px; object-fit:cover; border-radius:4px; margin-right:5px;">`).join('');

                    // EXTREMELY TRUNCATED DESCRIPTION FOR THE PDF GRID TO SAVE SPACE
                    const shortDesc = proj.desc.substring(0, 100) + '...';

                    return `
                    <div class="review-box" style="display: inline-block; width: 48%; margin: 1%; vertical-align: top;">
                        <div class="review-tag">4.${index + 1} - Project Card</div>
                        <img src="${proj.img}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; box-shadow: 0 5px 10px rgba(0,0,0,0.1);">
                        <div style="margin-bottom: 10px; display: flex;">${thumbnailsHTML}</div>
                        <p style="color: #FF9800; font-weight: bold; font-size: 0.75rem; margin-bottom: 3px; text-transform: uppercase;">${proj.client}</p>
                        <h3 style="font-size: 1.3rem; margin-bottom: 8px; color: #111; font-weight: 800;">4.${index + 1} ${proj.title}</h3>
                        <p style="color: #666; font-size: 0.85rem; line-height: 1.4;">${shortDesc}</p>
                        <div style="margin-top: 10px; font-size: 0.8rem; background: #f8fafc; padding: 10px; border-left: 3px solid #FF9800;">
                            <strong>Year:</strong> ${proj.year} | <strong>Status:</strong> ${proj.status}<br>
                            <strong>Contractor:</strong> ${proj.contractor} | <strong>Location:</strong> ${proj.location}
                        </div>
                    </div>
                `}).join('');
            }

            const pageName = page.replace('.html', '').toUpperCase();
            combinedHTML += `
                <div class="print-page-break">
                    <div class="review-box" style="background:#fdfdfd; margin-top:20px;">
                        <div class="review-tag">Page Render: ${pageName}</div>
                        <div class="annotation">➔ Background Image: Set via Admin Control</div>
                        
                        <div style="border: 2px solid #eee; padding: 15px; border-radius: 8px; background: var(--page-bg-color); display: block; overflow: hidden;">
                            ${virtualDoc.body.innerHTML}
                        </div>

                        <div class="remarks-box"><strong>Page Specific Remarks:</strong><div class="remarks-line"></div><div class="remarks-line"></div></div>
                    </div>
                </div>
            `;
        } catch (error) { console.error("Error fetching " + page, error); }
    }

    // INJECTING THE PROJECT DETAIL POPUP SAMPLE
    const sampleProj = allProjects[0];
    const sampleUrls = getProjectImages(sampleProj.folder);
    const sampleThumbs = sampleUrls.map(u => `<img src="${u}" onerror="this.remove()" style="aspect-ratio: 1/1; flex: 1; max-width: 120px; object-fit: cover; border-radius: 8px; border: 2px solid #ddd;">`).join('');

    combinedHTML += `
        <div class="print-page-break">
            <h2 style="font-size: 2rem; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 30px;">5. Project Detail View (Sample)</h2>
            <div class="review-box" style="background:#fdfdfd;">
                <div class="review-tag">Component: Overlay Popup (Project 1)</div>
                <div class="annotation">➔ User Interaction: Opens when clicking a project on the grid</div>
                
                <div style="display: flex; gap: 30px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; margin-top: 15px;">
                    <div style="flex: 1; min-height: 400px; background: url('${sampleProj.img}') center/cover; border-radius: 12px;"></div>
                    
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; gap: 10px; margin-bottom: 20px;">${sampleThumbs}</div>
                        <span style="color: #FF9800; font-weight: bold; font-size: 0.9rem; text-transform: uppercase;">CLIENT // ${sampleProj.client}</span>
                        <h2 style="font-size: 2rem; margin: 5px 0 15px 0; color: #111;">${sampleProj.title}</h2>
                        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">${sampleProj.desc.substring(0, 200)}...</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 5px solid #FF9800;">
                            <div><span style="font-size:0.8rem; color:#64748b; text-transform:uppercase; font-weight:bold;">Project Year</span><br><strong style="font-size:1.1rem; color:#111;">${sampleProj.year}</strong></div>
                            <div><span style="font-size:0.8rem; color:#64748b; text-transform:uppercase; font-weight:bold;">Status</span><br><strong style="font-size:1.1rem; color:#111;">${sampleProj.status}</strong></div>
                            <div><span style="font-size:0.8rem; color:#64748b; text-transform:uppercase; font-weight:bold;">Contractor</span><br><strong style="font-size:1.1rem; color:#111;">${sampleProj.contractor}</strong></div>
                            <div><span style="font-size:0.8rem; color:#64748b; text-transform:uppercase; font-weight:bold;">Location</span><br><strong style="font-size:1.1rem; color:#111;">${sampleProj.location}</strong></div>
                        </div>
                    </div>
                </div>
                
                <div class="remarks-box">Remarks:<div class="remarks-line"></div></div>
            </div>
        </div>
    `;

    combinedHTML += `
        <div class="print-page-break">
            <h2 style="font-size: 2rem; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 30px;">6. Global Master Components</h2>
            
            <div class="review-box">
                <div class="review-tag">Component: Top Navigation</div>
                <div class="annotation">➔ Background Color: #1b1b1b (Change to: _______)</div>
                ${sharedNavHTML}
                <div class="remarks-box">Remarks:<div class="remarks-line"></div></div>
            </div>

            <div class="review-box">
                <div class="review-tag">Component: Contact Banner</div>
                <div class="annotation">➔ Button Color: Primary Orange #FF9800 (Change to: _______)</div>
                ${sharedContactHTML}
                <div class="remarks-box">Remarks:<div class="remarks-line"></div></div>
            </div>

            <div class="review-box" style="break-inside: avoid;">
                <div class="review-tag">Component: Master Footer</div>
                ${sharedFooterHTML}
                <div class="remarks-box">Remarks:<div class="remarks-line"></div></div>
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

// ==========================================
// 10. BI-DIRECTIONAL WIND SWEEP TRANSITION
// ==========================================
function setupPageTransitions() {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    document.body.appendChild(overlay);
    setTimeout(() => { overlay.classList.add('reveal-page'); }, 50);

    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.endsWith('.html') && this.target !== '_blank') {
                e.preventDefault(); 
                overlay.classList.remove('reveal-page');
                setTimeout(() => { window.location.href = href; }, 500);
            }
        });
    });
}
setupPageTransitions();