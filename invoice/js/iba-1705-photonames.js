/* 17.0.5 patch 180: Photo names list in Firebase (no more PhotoIndex.csv).
   Database requisition-bf146, path photoList/photo_names = { <key>: "<file name>" }
   ("nail" = nail.jpg; other types keep their ending, e.g. "bolt.jpeg").
   Read/written with plain REST (one small JSON, about 30 KB for 550 names), kept
   6 h in this browser. Window "Photo names" (Material Stock > More tools, and the
   assistant skill): add one name, upload a CSV of names, search, remove a typo.
   Who may change it: Super Admin always + people ticked in Settings > Inventory
   permissions ("Photo names list"). Everyone reads it (Browse Photo). */
(function () {
    'use strict';
    const URL_BASE = 'https://requisition-bf146-default-rtdb.firebaseio.com/photoList/photo_names';
    const CACHE = 'iba-photo-names-v1';
    const TTL = 6 * 60 * 60 * 1000;
    const EXTS = ['.jpg', '.jpeg', '.png', '.gif'];
    const ONEDRIVE = 'https://ibaqatar-my.sharepoint.com/personal/dc_iba_com_qa/Documents/DC%20Files/Photo/';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);

    let map = {};        // key -> name
    let loadedAt = 0, loadP = null;
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && c.map) { map = c.map; loadedAt = c.at || 0; } } catch (_) {}

    function keyOf(name) { return String(name || '').trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_'); }
    const hasExt = (n) => /\.(jpe?g|png|gif|webp)$/i.test(String(n || ''));
    // "nail.jpg" -> "nail" (the app adds .jpg); others keep their ending
    function tidy(n) { n = String(n || '').trim().replace(/^["']|["']$/g, '').split(/[\\/]/).pop(); return /\.jpg$/i.test(n) ? n.replace(/\.jpg$/i, '') : n; }
    function save() { try { localStorage.setItem(CACHE, JSON.stringify({ at: loadedAt, map: map })); } catch (_) {} }
    function names() { return Object.keys(map).map((k) => map[k]).filter((v) => typeof v === 'string' && v).sort((a, b) => a.localeCompare(b)); }
    function inList(n) { const t = tidy(n); return !!map[keyOf(t)] || (!hasExt(t) && EXTS.some((e) => !!map[keyOf(t + e)])); }

    function load(force) {
        if (!force && loadedAt && Date.now() - loadedAt < TTL && Object.keys(map).length) return Promise.resolve(names());
        if (loadP) return loadP;
        loadP = fetch(URL_BASE + '.json', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Firebase said ' + r.status))))
            .then((j) => { map = (j && typeof j === 'object') ? j : {}; loadedAt = Date.now(); save(); return names(); })
            .catch((e) => { console.warn('[photo names]', e); return names(); })
            .finally(() => { loadP = null; });
        return loadP;
    }
    async function write(obj) {
        const r = await fetch(URL_BASE + '.json', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
        if (!r.ok) throw new Error('Could not save (Firebase said ' + r.status + ').');
        Object.assign(map, obj); loadedAt = Date.now(); save();
    }
    async function remove(k) {
        const r = await fetch(URL_BASE + '/' + encodeURIComponent(k) + '.json', { method: 'DELETE' });
        if (!r.ok) throw new Error('Could not remove (Firebase said ' + r.status + ').');
        delete map[k]; save();
    }

    // who may change the list
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function allowed() {
        if (isSuper()) return true;
        try { if (typeof window.ibaInvCan === 'function') return !!window.ibaInvCan('photo_names', false); } catch (_) {}
        return false;
    }

    // the real ending, from the OneDrive Photo folder
    function probe(url) {
        return new Promise((res) => {
            const img = new Image(); let done = false;
            const end = (ok) => { if (done) return; done = true; clearTimeout(t); img.onload = img.onerror = null; res(ok); };
            const t = setTimeout(() => end(false), 8000);
            img.onload = () => end(img.naturalWidth > 0); img.onerror = () => end(false);
            img.src = url;
        });
    }
    async function findEnding(base) {
        const hits = await Promise.all(EXTS.map((e) => probe(ONEDRIVE + encodeURIComponent(base + e))));
        const i = hits.indexOf(true);
        return i === -1 ? '' : EXTS[i];
    }
    // name as typed -> { name (to save), state: 'ok' | 'dup' | 'notfound' }
    async function resolve(raw) {
        let n = String(raw || '').trim().replace(/^["']|["']$/g, '').split(/[\\/]/).pop();
        if (!n) return { name: '', state: 'empty' };
        if (!hasExt(n)) {
            const e = await findEnding(n);
            if (!e) return { name: n, state: inList(n) ? 'dup' : 'notfound' };
            n = n + e;
        }
        const t = tidy(n);
        return { name: t, state: inList(t) ? 'dup' : 'ok' };
    }

    // ---------------------------------------------------------------- window
    let st = { q: '', msg: '', msgKind: '', just: '', upload: null, busy: false, pick: '' };
    function root() {
        let r = $('iba-pn');
        if (r) return r;
        r = document.createElement('div');
        r.id = 'iba-pn';
        r.innerHTML = '<div class="pn-dim" data-pn="close"></div><div class="pn-win" role="dialog" aria-modal="true" aria-label="Photo names"></div>';
        document.body.appendChild(r);
        r.addEventListener('click', onClick);
        r.addEventListener('input', (e) => { if (e.target && e.target.id === 'iba-pn-q') { st.q = e.target.value; paintList(); } });
        r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'iba-pn-new') { e.preventDefault(); addOne(); } if (e.key === 'Escape') close(); });
        r.addEventListener('change', (e) => { if (e.target && e.target.id === 'iba-pn-file') readFile(e.target.files && e.target.files[0]); });
        return r;
    }
    function win() { return root().querySelector('.pn-win'); }
    async function open() {
        if (!allowed()) { try { (window.ibaToast || alert)('Photo names is for the Super Admin and the people ticked in Settings > Inventory permissions.'); } catch (_) {} return; }
        st = { q: '', msg: '', msgKind: '', just: '', upload: null, busy: false, pick: '' };
        root().classList.add('is-on');
        paint();
        await load(true);
        paint();
        setTimeout(() => { const i = $('iba-pn-new'); if (i) i.focus(); }, 30);
    }
    function close() { const r = $('iba-pn'); if (r) r.classList.remove('is-on'); }

    function paint() {
        const w = win();
        if (st.upload) return paintUpload();
        w.innerHTML = '<div class="pn-head"><b>Photo names</b><span class="pn-cnt">' + names().length + '</span><button type="button" class="pn-x" data-pn="close" aria-label="Close">✕</button></div>' +
            '<div class="pn-add"><input id="iba-pn-new" type="text" autocomplete="off" placeholder="File name as in OneDrive, e.g. nail or bolt.jpeg"><button type="button" class="pn-go" data-pn="add">+ Add</button></div>' +
            '<label class="pn-up"><input id="iba-pn-file" type="file" accept=".csv,.txt,text/csv,text/plain" hidden>⇪ Upload list (CSV)</label>' +
            '<div id="iba-pn-msg"></div>' +
            '<div class="pn-srch"><span>⌕</span><input id="iba-pn-q" type="search" placeholder="Search the list" value="' + esc(st.q) + '"></div>' +
            '<ul class="pn-list" id="iba-pn-list"></ul><div class="pn-more" id="iba-pn-more"></div>';
        paintMsg(); paintList();
    }
    function paintMsg() {
        const m = $('iba-pn-msg');
        if (!m) return;
        let h = st.msg ? '<div class="pn-msg is-' + (st.msgKind || 'ok') + '">' + st.msg + '</div>' : '';
        if (st.pick) h += '<div class="pn-pick">' + EXTS.map((e) => '<button type="button" data-pn="ext" data-ext="' + e + '">' + esc(st.pick + e) + '</button>').join('') + '</div>';
        m.innerHTML = h;
    }
    function paintList() {
        const ul = $('iba-pn-list'), more = $('iba-pn-more');
        if (!ul) return;
        const q = st.q.trim().toLowerCase();
        let all = Object.keys(map).map((k) => ({ k: k, n: map[k] })).filter((x) => typeof x.n === 'string');
        if (q) all = all.filter((x) => x.n.toLowerCase().indexOf(q) !== -1);
        all.sort((a, b) => (a.k === st.just ? -1 : b.k === st.just ? 1 : a.n.localeCompare(b.n)));
        const shown = all.slice(0, 80);
        ul.innerHTML = shown.map((x) => '<li class="' + (x.k === st.just ? 'is-new' : '') + '"><span title="' + esc(x.n) + '">' + esc(x.n) + '</span>' +
            (x.k === st.just ? '<em>just added</em>' : '') + '<button type="button" data-pn="del" data-k="' + esc(x.k) + '" aria-label="Remove ' + esc(x.n) + '">✕</button></li>').join('') ||
            '<li class="pn-empty">' + (q ? 'No name has "' + esc(st.q) + '".' : 'The list is empty.') + '</li>';
        more.textContent = all.length > shown.length ? 'Showing ' + shown.length + ' of ' + all.length + ' · type to search' : (q ? all.length + ' match' + (all.length === 1 ? '' : 'es') : all.length + ' names');
    }
    function say(msg, kind) { st.msg = msg; st.msgKind = kind || 'ok'; paintMsg(); }

    async function addOne(forced) {
        if (st.busy) return;
        const inp = $('iba-pn-new');
        const raw = forced || (inp ? inp.value : '');
        if (!String(raw).trim()) { if (inp) inp.focus(); return; }
        st.busy = true; st.pick = '';
        say('<i class="fa-solid fa-spinner fa-spin"></i> Checking OneDrive…', 'wait');
        try {
            const r = forced ? { name: tidy(forced), state: inList(forced) ? 'dup' : 'ok' } : await resolve(raw);
            if (r.state === 'dup') { say('<b>' + esc(r.name) + '</b> is already in the list.', 'warn'); return; }
            if (r.state === 'notfound') {
                st.pick = r.name;
                say('No photo called <b>' + esc(r.name) + '</b> found in OneDrive (not uploaded yet, or this browser is not signed in to OneDrive). Pick the ending to add it anyway:', 'warn');
                return;
            }
            const k = keyOf(r.name);
            await write({ [k]: r.name });
            st.just = k; st.q = '';
            if (inp) inp.value = '';
            const q = $('iba-pn-q'); if (q) q.value = '';
            say('✓ <b>' + esc(r.name) + '</b> added. Everyone can pick it now.', 'ok');
            const c = win().querySelector('.pn-cnt'); if (c) c.textContent = names().length;
            paintList();
        } catch (e) { say(esc((e && e.message) || 'Could not save.'), 'err'); }
        finally { st.busy = false; }
    }
    async function del(k) {
        if (st.busy || !map[k]) return;
        const n = map[k];
        st.busy = true;
        try { await remove(k); say('Removed <b>' + esc(n) + '</b>.', 'ok'); const c = win().querySelector('.pn-cnt'); if (c) c.textContent = names().length; paintList(); }
        catch (e) { say(esc((e && e.message) || 'Could not remove.'), 'err'); }
        finally { st.busy = false; }
    }

    // ---- CSV upload
    function parseCsv(text) {
        const out = [];
        String(text || '').replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
            const first = String(line.split(/[,;\t]/)[0] || '').trim().replace(/^["']|["']$/g, '');
            if (!first) return;
            if (i === 0 && /^(photo\s*name|photoname|name|file\s*name)$/i.test(first)) return;
            out.push(first);
        });
        return Array.from(new Set(out));
    }
    async function readFile(f) {
        if (!f) return;
        let text = '';
        try { text = await f.text(); } catch (_) { say('Could not read the file.', 'err'); return; }
        const list = parseCsv(text);
        if (!list.length) { say('No names found in ' + esc(f.name) + '. Put one name per line (first column).', 'warn'); return; }
        st.upload = { file: f.name, rows: list.map((n) => ({ raw: n, name: n, state: 'wait' })), done: false };
        paintUpload();
        // check endings, 4 at a time
        const rows = st.upload.rows;
        let i = 0;
        const work = async () => { while (i < rows.length) { const r = rows[i++]; const x = await resolve(r.raw); r.name = x.name; r.state = x.state; r.ext = !hasExt(r.raw) && x.state === 'ok' ? (x.name.match(/\.[a-z]+$/i) || ['.jpg'])[0] : ''; if (st.upload) paintUpload(); } };
        await Promise.all([work(), work(), work(), work()]);
        // same name twice inside the CSV
        const seen = new Set();
        rows.forEach((r) => { if (r.state === 'ok') { const k = keyOf(r.name); if (seen.has(k)) r.state = 'dup'; seen.add(k); } });
        if (st.upload) paintUpload();
    }
    function paintUpload() {
        const u = st.upload, rows = u.rows;
        const c = (s) => rows.filter((r) => r.state === s).length;
        const waiting = c('wait');
        const nNew = c('ok');
        win().innerHTML = '<div class="pn-head"><b>Upload list</b><span class="pn-cnt">' + esc(u.file) + '</span><button type="button" class="pn-x" data-pn="up-x" aria-label="Back">✕</button></div>' +
            '<div class="pn-sum">' + (waiting ? '<span class="pn-tag t-wait">checking ' + (rows.length - waiting) + ' / ' + rows.length + '</span>' : '') +
            '<span class="pn-tag t-new">' + nNew + ' new</span><span class="pn-tag t-dup">' + c('dup') + ' already in list</span>' + (c('notfound') ? '<span class="pn-tag t-ask">' + c('notfound') + ' not found in OneDrive</span>' : '') + '</div>' +
            '<ul class="pn-list">' + rows.map((r) => '<li><span>' + esc(r.raw) + '</span>' + (r.ext ? '<em class="pn-ext">→ ' + esc(r.ext) + '</em>' : '') +
                '<b class="pn-tag ' + ({ ok: 't-new', dup: 't-dup', notfound: 't-ask', wait: 't-wait' }[r.state] || 't-dup') + '">' + ({ ok: 'new', dup: 'in list', notfound: 'not in OneDrive', wait: '…' }[r.state] || r.state) + '</b></li>').join('') + '</ul>' +
            (u.done ? '<div class="pn-msg is-ok">✓ ' + u.done + ' name' + (u.done === 1 ? '' : 's') + ' added.</div><button type="button" class="pn-go pn-wide" data-pn="up-x">Back to the list</button>'
                : '<button type="button" class="pn-go pn-wide" data-pn="up-save"' + (waiting || !nNew ? ' disabled' : '') + '>' + (waiting ? 'Checking OneDrive…' : 'Add ' + nNew + ' name' + (nNew === 1 ? '' : 's')) + '</button>') +
            '<div class="pn-more">One name per line (first column). Names without an ending get .jpg / .jpeg / .png / .gif from OneDrive. "Not in OneDrive" names are skipped.</div>';
    }
    async function upSave() {
        const u = st.upload;
        if (!u || st.busy) return;
        const obj = {};
        u.rows.filter((r) => r.state === 'ok').forEach((r) => { obj[keyOf(r.name)] = r.name; });
        if (!Object.keys(obj).length) return;
        st.busy = true;
        try { await write(obj); u.done = Object.keys(obj).length; u.rows.forEach((r) => { if (r.state === 'ok') r.state = 'dup'; }); paintUpload(); }
        catch (e) { st.upload = null; paint(); say(esc((e && e.message) || 'Could not save.'), 'err'); }
        finally { st.busy = false; }
    }

    function onClick(e) {
        const b = e.target.closest && e.target.closest('[data-pn]');
        if (!b) return;
        const a = b.getAttribute('data-pn');
        if (a === 'close') return close();
        if (a === 'add') return addOne();
        if (a === 'del') return del(b.getAttribute('data-k'));
        if (a === 'ext') { const n = st.pick + b.getAttribute('data-ext'); st.pick = ''; return addOne(n); }
        if (a === 'up-x') { st.upload = null; return paint(); }
        if (a === 'up-save') return upSave();
    }

    // ---- entry: Material Stock "More tools" button (moved there by iba-1705-msmenu.js)
    function ensureBtn() {
        let b = $('iba-pn-btn');
        if (!b) {
            const host = $('ms-add-new-btn') && $('ms-add-new-btn').parentElement;
            if (!host) return;
            b = document.createElement('button');
            b.type = 'button'; b.id = 'iba-pn-btn'; b.className = 'secondary-btn';
            b.innerHTML = '<i class="fa-solid fa-images"></i> Photo names';
            b.addEventListener('click', (e) => { e.preventDefault(); open(); });
            host.appendChild(b);
        }
        const ok = allowed();
        if (b.hidden === ok) b.hidden = !ok;
    }
    function start() { ensureBtn(); setInterval(ensureBtn, 3000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.ibaPhotoNames = { load: load, list: names, has: inList, open: open, allowed: allowed, close: close, _test: { parseCsv: parseCsv, tidy: tidy, keyOf: keyOf } };
})();
