
# IBA Portal PWA Kit

This kit makes your `index.html` installable on Android (Chrome) and adds reliable offline support.

## Files
- `sw.js` — Service worker with offline caching.
- `manifest.webmanifest` — PWA manifest (name, icons, colors).
- `install.js` — Handles "Add to Home screen" prompt and intro sound on first tap/press.
- `icons/` — (Create this folder) Add icon PNGs as listed in the manifest.

## How to use
1. Place **all files at your site root** (same folder as `index.html`). If using GitHub Pages with custom domain (ibaport.site), the root of the repo should contain:
   - `index.html`, `sw.js`, `manifest.webmanifest`, `install.js`, and `icons/` folder.
2. Ensure your `index.html` has:
   ```html
   <link rel="manifest" href="/manifest.webmanifest">
   <meta name="theme-color" content="#003A5C">
   <script>
     if ('serviceWorker' in navigator) {
       window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
     }
   </script>
   <script defer src="/install.js"></script>
   ```
3. Add an **Install** button (optional):
   ```html
   <button id="install-btn" class="btn cloud-btn" style="display:none">
     <i class="fas fa-download"></i> Install App
   </button>
   ```
4. Add icons (create folder `/icons` and place PNGs):
   - `icons/icon-192.png`
   - `icons/icon-512.png`
   - `icons/maskable-192.png`
   - `icons/maskable-512.png`

5. Commit & push. Open `https://ibaport.site` on Android Chrome:
   - You should see the install prompt (or use your button).
   - App launches as standalone, with offline available after first load.

## Notes
- **Intro sound**: Browsers block autoplay. `install.js` plays it after the first tap/press on the page.
- **Caching**: `sw.js` is HTML network‑first (so updates load), and cache‑first for static assets.
- When you change files, bump the `CACHE_NAME` (e.g., `v2`) to refresh old caches on users' devices.
