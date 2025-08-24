// install.js - Handles the custom PWA install flow and the intro sound trigger
let deferredPrompt;
const hasShownInstall = 'pwa_install_prompt_shown';

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  deferredPrompt = e;

  // Optionally show your own UI (a button) to prompt installation
  const btn = document.getElementById('install-btn');
  if (btn && !localStorage.getItem(hasShownInstall)) {
    btn.style.display = 'inline-flex';
  }
});

// Wire up a button with id="install-btn" if present
document.addEventListener('click', async (e) => {
  const target = e.target.closest('#install-btn');
  if (!target || !deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  // hide after one try (accepted or dismissed)
  localStorage.setItem(hasShownInstall, '1');
  target.style.display = 'none';
});

// Play intro sound after first user gesture to satisfy autoplay policies
(function attachIntroSoundHandler() {
  const audio = document.getElementById('startup-chime');
  if (!audio) return;

  function tryPlay() {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    document.removeEventListener('pointerdown', tryPlay, true);
    document.removeEventListener('keydown', tryPlay, true);
  }
  document.addEventListener('pointerdown', tryPlay, true);
  document.addEventListener('keydown', tryPlay, true);
})();
