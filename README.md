# Make ibaport.site installable on Android (PWA)

This is a drop-in PWA starter tailored for `ibaport.site`. It provides:
- `manifest.webmanifest` with your theme color (#003A5C) and app metadata
- `sw.js` (service worker) for offline caching
- Simple **Install App** button logic in `install.js`
- App icons (192px & 512px).

## How to use on GitHub Pages (custom domain)
1. Copy **all files and folders** in this package to the **root** of your GitHub Pages repo that serves `ibaport.site` (same level as `index.html`).
2. In your **index.html** `<head>`, add:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#003A5C" />
<script>
  if ('serviceWorker' in navigator) {{
    window.addEventListener('load', () => {{
      navigator.serviceWorker.register('/sw.js');
    }});
  }}
</script>
<script src="/install.js" defer></script>
```
3. (Optional) Add a button anywhere in your HTML to trigger the install prompt:
```html
<button id="installAppBtn" style="display:none" onclick="installApp()">Install IBA Port</button>
```
4. Commit & push. After Pages finishes building, open `ibaport.site` in **Chrome on Android**:
   - You should see an **Install app** option in the browser menu, and sometimes a bottom sheet prompt.
   - When installed, it opens full-screen, just like a native app.
