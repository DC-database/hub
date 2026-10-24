/* ==========================================================================
   sw.js — 17.0.2 patch 5
   Lets phones and Chrome install IBA System as an app (full screen, no
   address bar). It stores NOTHING: every page and file still comes from
   the server, so uploads to GitHub and the version check work as before.
   Only when the phone has no connection at all, a short message is shown
   instead of the browser's error page.
   ========================================================================== */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
    if (e.request.mode !== 'navigate') return; // files and Firebase: untouched
    e.respondWith(fetch(e.request).catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>IBA System</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1724;color:#e6eef5;font:16px Arial,sans-serif;text-align:center">' +
        '<div><b style="color:#5ed6c4;font-size:28px">IBA</b><p>No internet connection.</p><button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:10px;background:#0d7e85;color:#fff;font-weight:700">Try again</button></div>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
