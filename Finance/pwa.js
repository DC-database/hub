/* Install as an app (kept apart so it works even if app.js fails). */
(function () {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
  }
  let deferred = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  function help() {
    if (!/^https?:$/.test(location.protocol)) return 'Open the website link (https://...) instead of the file, then press Install app.';
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'On iPhone/iPad: tap Share in Safari, then "Add to Home Screen".';
    return 'Use the browser menu: Chrome ⋮ > Cast, save and share > Install page as app (Edge: ⋯ > Apps > Install this site as an app).';
  }
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('installAppBtn');
    if (!btn || standalone()) return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      if (!deferred) { alert(help()); return; }
      deferred.prompt();
      const c = await deferred.userChoice.catch(() => null);
      deferred = null;
      if (c && c.outcome === 'accepted') btn.hidden = true;
    });
  });
  window.addEventListener('appinstalled', () => { const b = document.getElementById('installAppBtn'); if (b) b.hidden = true; });
})();
