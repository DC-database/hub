// Procurement Hub service worker: makes the app installable and lets it open without internet.
// App files: network first (you always get the newest version), saved copy when offline.
// Fonts and libraries from CDNs: saved copy first. Firebase, Groq and GitHub data are never cached here
// (the app keeps its own catalog cache).
const CACHE = 'procurement-hub-v8.0.2';
const SHELL = ['./', './index.html', './style.css', './app.js', './pwa.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
        // no-cache: always ask the server if the file changed, so a new patch is picked up right away.
        if (url.pathname.endsWith('version.json')) return;
        const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req.url, { cache: 'no-cache' });
        event.respondWith(fresh.then(res => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
        return;
    }
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
            if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        })));
    }
});
