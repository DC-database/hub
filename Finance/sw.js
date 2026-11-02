/* IBA Finance service worker — lets Chrome, Edge and phones install the app.
   It stores NOTHING: pages and files always come from the server, so uploads
   and version.json updates work as before. With no connection at all a short
   "No internet" page is shown instead of the browser error. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IBA Finance</title>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1724;color:#e6eef5;font:16px Arial,sans-serif;text-align:center">' +
    '<div><b style="color:#f2c230;font-size:28px">IBA Finance</b><p>No internet connection.</p><button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:10px;background:#36c3b2;color:#062b27;font-weight:700">Try again</button></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
