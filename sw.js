/* sw.js - Simple offline-first service worker for ibaport.site */
const CACHE_NAME = 'ibaport-cache-v1';
const CORE_ASSETS = [
  '/',            // if hosted at domain root
  '/index.html',
  '/manifest.webmanifest',
  '/sw.js',
  '/install.js',
  // Add your assets below as you add them to the project:
  // '/styles.css', '/app.js', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bypass non-GET and cross-origin requests (e.g., Firebase endpoints)
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) {
    return;
  }

  // Network-first for HTML pages (ensures updates), cache-first for everything else.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request)
            .then((response) => {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
              return response;
            })
            .catch(() => cached)
        );
      })
    );
  }
});
