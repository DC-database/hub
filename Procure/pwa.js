// ==========================================
// INSTALL AS AN APP (PWA)
// Kept in its own file so it still works if anything in app.js fails to load.
// Chrome and Edge offer an "Install app" button. On iPhone/iPad: Share > Add to Home Screen.
// Needs https (or localhost); opening index.html as a file cannot install.
// ==========================================
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker not registered:', err));
    });
}

let deferredInstallPrompt = null;
const installAppBtn = document.getElementById('installAppBtn');
const isStandaloneApp = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// The button is always shown (except inside the installed app). If the browser has not offered
// the install yet, clicking it explains what is missing.
if (installAppBtn && !isStandaloneApp()) installAppBtn.hidden = false;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
});

function installHelpText() {
    if (!/^https?:$/.test(location.protocol)) return 'This page was opened as a file from your computer. Open the website link (https://...) instead, then click Install app.';
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'On iPhone/iPad: tap the Share button in Safari, then "Add to Home Screen".';
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return 'Almost ready: press Ctrl+Shift+R once to reload, wait a few seconds, then click Install app again.';
    return 'Use the browser menu: Chrome ⋮ > Cast, save and share > Install page as app (Edge: ⋯ > Apps > Install this site as an app). If it is already installed, open it from your Start menu.';
}

installAppBtn?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
        alert(installHelpText());
        return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    if (choice && choice.outcome === 'accepted') { installAppBtn.hidden = true; if (typeof showToast === 'function') showToast('Installed. Open Procurement Hub from your apps.', 'ok'); }
});

window.addEventListener('appinstalled', () => { if (installAppBtn) installAppBtn.hidden = true; deferredInstallPrompt = null; });
