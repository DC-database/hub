// js/app-audio.js
// Extracted from app.js in v8.0.4 — audio engine only.
// Keep as classic script before app.js; public globals preserved.

var soundClick = window.soundClick = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Click.mp3');
var soundClear = window.soundClear = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Clear.mp3');
var soundDelete = window.soundDelete = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Delete.mp3'); 
var soundConfirm = window.soundConfirm = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Confirm.mp3'); // <-- NEW
var soundSuccess = window.soundSuccess = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Success.mp3');
var soundError = window.soundError = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Error.mp3');
var soundPop = window.soundPop = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Pop.mp3');
var soundSent = window.soundSent = new Audio('https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/Sent.mp3');

soundClick.preload = 'auto';
soundClear.preload = 'auto';
soundDelete.preload = 'auto'; 
soundConfirm.preload = 'auto'; // <-- NEW
soundSuccess.preload = 'auto';
soundError.preload = 'auto';
soundPop.preload = 'auto';
soundSent.preload = 'auto';

// Keeping your preferred balanced volumes!
soundClick.volume = 1.0;   
soundClear.volume = 1.0; 
soundDelete.volume = 1.0;   
soundConfirm.volume = 1.0; // <-- NEW (Matches Click/Clear/Delete)
soundSuccess.volume = 0.2; 
soundError.volume = 0.2;   
soundPop.volume = 1.0;
soundSent.volume = 1.0;

// --- THE MASTER KILL SWITCH ---
window.isAudioMuted = localStorage.getItem('iba_audio_muted') === 'true';

window.toggleSystemAudio = function() {
    window.isAudioMuted = !window.isAudioMuted;
    localStorage.setItem('iba_audio_muted', window.isAudioMuted);
    
    if (!window.isAudioMuted) {
        soundSuccess.currentTime = 0;
        soundSuccess.play().catch(e=>{});
    }
    return window.isAudioMuted;
};

// --- STRICT USER INTENT LOCK ---
window.searchIntentActive = false;
let intentTimer = null;

window.armSearchIntent = function() {
    window.searchIntentActive = true;
    clearTimeout(intentTimer);
    // Arms the sound for up to 5 seconds
    intentTimer = setTimeout(() => { window.searchIntentActive = false; }, 5000);
};

// GLOBAL OVERRIDES WITH SNAP-SHUT LOCK
let lastSuccessTime = 0;
window.playSystemSuccess = function() { 
    if (window.isAudioMuted) return; 
    if (!window.searchIntentActive) return; 
    
    window.searchIntentActive = false; 

    const now = Date.now();
    if (now - lastSuccessTime < 2000) return; 
    lastSuccessTime = now;
    soundSuccess.currentTime = 0; 
    soundSuccess.play().catch(e=>{}); 
};

let lastErrorTime = 0;
window.playSystemError = function() { 
    if (window.isAudioMuted) return; 
    if (!window.searchIntentActive) return; 
    
    window.searchIntentActive = false; 

    const now = Date.now();
    if (now - lastErrorTime < 2000) return; 
    lastErrorTime = now;
    soundError.currentTime = 0; 
    soundError.play().catch(e=>{}); 
};

// GLOBAL CHAT, DELETE, & CONFIRM SOUND OVERRIDES
window.playMessagePop = function() { 
    if (window.isAudioMuted) return;
    soundPop.currentTime = 0; 
    soundPop.play().catch(e=>{}); 
};

window.playMessageSent = function() { 
    if (window.isAudioMuted) return;
    soundSent.currentTime = 0; 
    soundSent.play().catch(e=>{}); 
};

window.playSystemDelete = function() {  
    if (window.isAudioMuted) return;
    soundDelete.currentTime = 0; 
    soundDelete.play().catch(e=>{}); 
};

window.playSystemConfirm = function() {  // <-- NEW GLOBAL OVERRIDE
    if (window.isAudioMuted) return;
    soundConfirm.currentTime = 0; 
    soundConfirm.play().catch(e=>{}); 
};

window.playSystemClear = function() {
    if (window.isAudioMuted) return;
    soundClear.currentTime = 0;
    soundClear.play().catch(e=>{});
};

let soundsActive = false;
setTimeout(() => { soundsActive = true; }, 2500); 

// 1. INSTANT CLICKS & NAVIGATION DETECTION
document.addEventListener('click', function(event) {
    if (!soundsActive) return;

    const tag = event.target.tagName.toLowerCase();
    if (tag === 'textarea') return;
    if (tag === 'input' && event.target.type !== 'button' && event.target.type !== 'submit' && event.target.type !== 'checkbox') return;

    const clickedItem = event.target.closest(
        'button, a, select, [data-section], [role="button"], .btn, .primary-btn, .secondary-btn, .action-btn, .danger-btn, .im-help-tab-btn, .close, i.fa-solid, i.fas, i.fa-regular'
    );

    if (clickedItem) {
        const itemText = (clickedItem.innerText || '').toLowerCase();
        const itemId = (clickedItem.id || '').toLowerCase();
        
        // Is this a navigation/menu button?
        const isNavigation = clickedItem.tagName.toLowerCase() === 'a' || 
                             clickedItem.hasAttribute('data-section') || 
                             itemId.includes('nav') || 
                             itemId.includes('menu') || 
                             itemId.includes('tab') || 
                             clickedItem.closest('nav, .sidebar, .menu, ul, li');

        // If it IS navigation, completely kill the search intent immediately.
        if (isNavigation) {
            window.searchIntentActive = false;
        }

        const isSearchBtn = !isNavigation && (itemText.includes('search') || itemText.includes('filter') || itemText.includes('apply') || itemText.includes('find') || itemId.includes('search') || itemId.includes('filter') || itemId.includes('find') || clickedItem.querySelector('.fa-magnifying-glass') || clickedItem.querySelector('.fa-search'));
        
        const isDeleteBtn = itemText.includes('delete') || itemId.includes('delete') || clickedItem.querySelector('.fa-trash') || clickedItem.querySelector('.fa-trash-can');
        
        // --- NEW: Strict Confirm Check (Looks for "Update" or "Add") ---
        const isConfirmBtn = itemText.includes('update') || itemText.includes('add') || itemId.includes('update') || itemId.includes('add');

        if (itemText.includes('clear') || itemId.includes('clear')) {
            if (!window.isAudioMuted) {
                soundClear.currentTime = 0;
                soundClear.play().catch(e => {});
            }
        } 
        else if (isDeleteBtn) {
            if (!window.isAudioMuted) {
                soundDelete.currentTime = 0;
                soundDelete.play().catch(e => {});
            }
        }
        // --- NEW: Play Confirm Sound ---
        else if (isConfirmBtn) {
            if (!window.isAudioMuted) {
                soundConfirm.currentTime = 0;
                soundConfirm.play().catch(e => {});
            }
        }
        else {
            if (!itemId.includes('audio-toggle')) {
                if (!window.isAudioMuted) {
                    soundClick.currentTime = 0;
                    soundClick.play().catch(e => {});
                }
            }
            
            // Arm the sound ONLY if it's a real search button
            if (isSearchBtn) {
                window.armSearchIntent();
            }
        }
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && event.target.tagName.toLowerCase() === 'input') {
        window.armSearchIntent(); 
    }
});

// 2. WATCH TABLES 
const observeTables = [
    'reporting-table-body', 'active-task-table-body', 'im-invoices-table-body', 
    'im-batch-table-body', 'im-payment-modal-results',
    'invoice-table-body', 'records-table-body', 'invoice-records-table-body'
];

observeTables.forEach(tableId => {
    const targetNode = document.getElementById(tableId);
    if (targetNode) {
        const observer = new MutationObserver((mutationsList) => {
            if (!soundsActive) return;
            if (!window.searchIntentActive) return; // Ignores everything if lock is shut!
            
            const contentChanged = mutationsList.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0);
            
            if (contentChanged) {
                const htmlContent = targetNode.innerHTML.toLowerCase();
                
                if (htmlContent.includes('no entries') || htmlContent.includes('no tasks') || htmlContent.includes('no records') || htmlContent.includes('no invoices') || htmlContent.includes('no results')) {
                    window.playSystemError(); // The lock snaps shut inside this function!
                } 
                else if (htmlContent.includes('loading') || htmlContent.includes('searching') || htmlContent.includes('cleared')) {
                    // Ignore
                }
                else if (targetNode.children.length > 0) {
                    window.playSystemSuccess(); // The lock snaps shut inside this function!
                }
            }
        });
        observer.observe(targetNode, { childList: true, subtree: true });
    }
});
