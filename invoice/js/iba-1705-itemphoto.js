/* 17.0.5 patch 169: item photos live in the app's own "item-photo" folder
   (next to index.html, uploaded with the app). item-photo/list.json is made by
   shrink-photos.bat. A photo in the list loads from there; anything else falls
   back to the OneDrive Photo folder. No Firebase, no Microsoft sign-in. */
(function () {
    'use strict';
    const DIR = 'item-photo/';
    const CACHE = 'iba-item-photo-list-v1';
    const TTL = 6 * 60 * 60 * 1000;
    const ONEDRIVE = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/documents/dc%20files/photo/';
    let names = [];          // as in list.json: "nail" (= nail.jpg) or "bolt.png"
    let files = new Set();   // lower-case file names: "nail.jpg", "bolt.png"
    let loadP = null;

    function setNames(list) {
        names = Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [];
        files = new Set(names.map((n) => (/\.(jpe?g|png|webp|gif)$/i.test(n) ? n : n + '.jpg').toLowerCase()));
    }
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && Array.isArray(c.photos)) setNames(c.photos); } catch (_) {}

    function load(force) {
        let c = null;
        try { c = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (_) {}
        if (!force && c && Date.now() - (c.at || 0) < TTL) return Promise.resolve(names);
        if (loadP) return loadP;
        const tag = (window.IBA_PATCH || '') + '-' + Math.floor(Date.now() / TTL);
        loadP = fetch(DIR + 'list.json?v=' + encodeURIComponent(tag), { cache: 'no-cache' })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (j && Array.isArray(j.photos)) {
                    setNames(j.photos);
                    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), photos: names })); } catch (_) {}
                }
                return names;
            })
            .catch(() => names)
            .finally(() => { loadP = null; });
        return loadP;
    }
    function fileOf(nameOrFile) {
        const n = String(nameOrFile || '').trim().split(/[\\/]/).pop();
        if (!n) return '';
        return /\.(jpe?g|png|webp|gif)$/i.test(n) ? n : n + '.jpg';
    }
    function has(nameOrFile) { const f = fileOf(nameOrFile); return !!f && files.has(f.toLowerCase()); }
    function urlFor(nameOrFile) {
        const f = fileOf(nameOrFile);
        if (!f || !files.has(f.toLowerCase())) return '';
        try { return new URL(DIR + encodeURIComponent(f), document.baseURI).href; } catch (_) { return DIR + encodeURIComponent(f); }
    }
    // any photo link -> the item-photo copy when we have it, else the link unchanged
    function map(url) {
        const u = String(url || '').trim();
        if (!u || u.toLowerCase().indexOf(ONEDRIVE) !== 0) return u;
        let f = '';
        try { f = decodeURIComponent(new URL(u).pathname.split('/').pop() || ''); } catch (_) { return u; }
        return urlFor(f) || u;
    }
    window.ibaItemPhotos = { load: load, list: () => names.slice(), has: has, url: urlFor, map: map };
    load();
})();
