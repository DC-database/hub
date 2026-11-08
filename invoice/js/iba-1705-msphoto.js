/* 17.0.5 patch 166: inventory photo picker reads the real OneDrive Photo folder
   (Microsoft Graph, read only). No Firebase, no PhotoIndex.csv.
   Needs window.IBA_MS_GRAPH = { clientId, tenantId } in index.html (from IT's
   Azure app registration). Until then the picker falls back to names already
   used on stock items. */
(function () {
    'use strict';
    const FOLDER_OWNER = 'dc@iba.com.qa';          // ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa
    const FOLDER_PATH = 'DC Files/Photo';
    const SCOPES = ['Files.Read.All'];
    const CACHE = 'iba-ms-photo-folder-v1';
    const TTL = 30 * 60 * 1000;                    // folder list kept 30 min in this browser
    const MSAL_SRC = 'js/vendor/msal-browser-2.38.3.min.js';
    let app = null, appP = null, listP = null, lastError = '';

    function cfg() {
        const c = window.IBA_MS_GRAPH || {};
        return (c.clientId && c.tenantId) ? c : null;
    }
    function loadMsal() {
        if (window.msal && window.msal.PublicClientApplication) return Promise.resolve();
        return new Promise((ok, bad) => {
            const s = document.createElement('script');
            s.src = MSAL_SRC; s.async = true;
            s.onload = () => ok(); s.onerror = () => bad(new Error('Microsoft sign-in library did not load'));
            document.head.appendChild(s);
        });
    }
    function getApp() {
        const c = cfg();
        if (!c) return Promise.resolve(null);
        if (app) return Promise.resolve(app);
        if (appP) return appP;
        appP = loadMsal().then(async () => {
            const a = new window.msal.PublicClientApplication({
                auth: { clientId: c.clientId, authority: 'https://login.microsoftonline.com/' + c.tenantId, redirectUri: c.redirectUri || new URL('msal-redirect.html', location.href).href },
                cache: { cacheLocation: 'localStorage' }
            });
            if (a.initialize) await a.initialize();
            try { await a.handleRedirectPromise(); } catch (_) {}
            app = a; return a;
        }).finally(() => { appP = null; });
        return appP;
    }
    async function token(interactive) {
        const a = await getApp();
        if (!a) return '';
        const acc = a.getAllAccounts()[0];
        if (acc) {
            try { return (await a.acquireTokenSilent({ scopes: SCOPES, account: acc })).accessToken; } catch (_) {}
        }
        if (!interactive) return '';
        const r = await a.loginPopup({ scopes: SCOPES, prompt: 'select_account' });
        a.setActiveAccount && a.setActiveAccount(r.account);
        return r.accessToken || (await a.acquireTokenSilent({ scopes: SCOPES, account: r.account })).accessToken;
    }
    function readCache() {
        try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && Array.isArray(c.names) ? c : null; } catch (_) { return null; }
    }
    // "nail.jpg" -> "nail" (the app adds .jpg); other types keep their extension
    function toName(file) {
        const f = String(file || '').trim();
        if (!/\.(jpe?g|png|webp|gif)$/i.test(f)) return '';
        return /\.jpg$/i.test(f) ? f.replace(/\.jpg$/i, '') : f;
    }
    async function fetchAll(tk) {
        const names = [];
        let url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(FOLDER_OWNER) + '/drive/root:/' +
            FOLDER_PATH.split('/').map(encodeURIComponent).join('/') + ':/children?$select=name,file&$top=999';
        for (let n = 0; url && n < 30; n++) {
            const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tk } });
            if (!r.ok) throw new Error('Microsoft said ' + r.status + (r.status === 403 || r.status === 404 ? ' (no access to the Photo folder)' : ''));
            const j = await r.json();
            (j.value || []).forEach((x) => { if (x && x.file) { const nm = toName(x.name); if (nm) names.push(nm); } });
            url = j['@odata.nextLink'] || '';
        }
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }
    // returns { names, state }: state = 'ok' | 'cached' | 'signin' | 'off' | 'error'
    async function list(opts) {
        opts = opts || {};
        if (!cfg()) return { names: null, state: 'off' };
        const c = readCache();
        if (c && !opts.force && Date.now() - (c.at || 0) < TTL) return { names: c.names, state: 'cached' };
        if (listP) return listP;
        listP = (async () => {
            try {
                const tk = await token(!!opts.interactive);
                if (!tk) return { names: c ? c.names : null, state: 'signin' };
                const names = await fetchAll(tk);
                try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), names: names })); } catch (_) {}
                lastError = '';
                return { names: names, state: 'ok' };
            } catch (e) {
                lastError = (e && e.message) || String(e);
                console.warn('[photo folder]', lastError);
                return { names: c ? c.names : null, state: 'error', error: lastError };
            }
        })().finally(() => { listP = null; });
        return listP;
    }
    window.ibaFolderPhotos = { list: list, configured: () => !!cfg(), lastError: () => lastError };
})();
