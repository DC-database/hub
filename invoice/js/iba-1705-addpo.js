/* ==========================================================================
   js/iba-1705-addpo.js — 17.0.5 patch 49
   A PO that is not in POVALUE2.csv yet (Invoice Entry search / Batch Entry
   add by PO):
   1) look in the PO file (progress-po "records") for THAT ONE PO only
      (indexed query on PO, nothing else is downloaded); found = use it.
   2) not there and Super Admin: "PO X is not in the records yet. Add it?"
      -> Add new PO window (PO already filled in, vendor name <-> vendor ID
      fill each other from Vendors.csv, Status always Inactive). Save writes
      records/<new key> (same shape as martin's records: PO text, Amount number,
      DateFiled "") and the Invoice / Batch entry carries on with it.
   Everyone else keeps the normal "not found" message.
   window.ibaAddPo.resolve(po) -> poData (POVALUE2 shape) or null
   ========================================================================== */
(function () {
    'use strict';
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const normPO = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');
    function progDb() { try { return (typeof progressDb !== 'undefined' && progressDb && progressDb.ref) ? progressDb : null; } catch (_) { return null; } }
    function isSuper() {
        try { if (typeof imIsCurrentUserSuperAdmin === 'function' && imIsCurrentUserSuperAdmin()) return true; } catch (_) {}
        return !!(document.body && document.body.classList.contains('iba-is-super-admin'));
    }
    function field(rec, name) {
        if (!rec) return '';
        if (rec[name] != null) return rec[name];
        const k = Object.keys(rec).find((x) => x.toLowerCase().replace(/\s/g, '') === name.toLowerCase());
        return k ? rec[k] : '';
    }
    function vendors() { try { return (typeof allVendorsData !== 'undefined' && allVendorsData) ? allVendorsData : {}; } catch (_) { return {}; } }
    function poMap() { try { if (typeof allPOData !== 'undefined') { if (!allPOData) allPOData = {}; return allPOData; } } catch (_) {} return null; }

    // PO file record -> the shape POVALUE2.csv rows have
    function toPoData(rec, po) {
        return {
            'PO': String(field(rec, 'PO') || po),
            'ReqNum': String(field(rec, 'ReqNum') || ''),
            'Supplier ID': String(field(rec, 'SupplierID') || ''),
            'Supplier Name': String(field(rec, 'SupplierName') || ''),
            'Project ID': String(field(rec, 'ProjectID') || ''),
            'Amount': field(rec, 'Amount') || 0,
            'Status': String(field(rec, 'Status') || ''),
            __fromPoFile: true
        };
    }

    // one PO only, remembered for this session (found or not)
    // 17.0.5 p50: "not there" is remembered for 10 min too (never one read per key press)
    const seen = new Map(), missAt = new Map(), running = new Map();
    const MISS_MS = 10 * 60 * 1000;
    function find(po) {
        const p = normPO(po);
        if (!p || !progDb()) return Promise.resolve(null);
        if (seen.has(p)) return Promise.resolve(seen.get(p));
        if (missAt.has(p) && Date.now() - missAt.get(p) < MISS_MS) return Promise.resolve(null);
        if (running.has(p)) return running.get(p);
        const job = findNow(p).then((r) => { if (r) seen.set(p, r); else missAt.set(p, Date.now()); return r; })
            .finally(() => running.delete(p));
        running.set(p, job);
        return job;
    }
    // ONE PO only: indexed query on PO (never the whole records list)
    async function findNow(p) {
        const d = progDb();
        let val = null;
        if (window.ibaPoFile && typeof window.ibaPoFile.lookup === 'function') val = await window.ibaPoFile.lookup(p);
        else {
            let s = await d.ref('records').orderByChild('PO').equalTo(p).once('value');
            if (!s.exists()) s = await d.ref('records').orderByChild('PO').equalTo(parseInt(p, 10)).once('value');
            val = s.exists() ? s.val() : null;
        }
        let out = null;
        if (val && typeof val === 'object') {
            const keys = Object.keys(val);
            const k = keys.find((x) => String(field(val[x], 'Status')).toLowerCase() === 'active') || keys[0];
            if (k) out = toPoData(val[k], p);
        }
        return out;
    }
    // read-only fallback for other screens: PO file row -> kept with the POVALUE2 rows
    async function fill(po) {
        const key = String(po || '').trim().toUpperCase();
        if (!key) return null;
        try { const hit = await find(key); if (hit) keep(key, hit); return hit; }
        catch (e) { console.warn('[IBA] PO file lookup failed:', e); return null; }
    }
    function keep(po, data) {
        const m = poMap();
        if (m && data) { m[po] = data; const p = normPO(po); if (p && p !== po) m[p] = data; }
    }

    async function resolve(po) {
        const key = String(po || '').trim();
        if (!key) return null;
        try {
            const hit = await find(key);
            if (hit) { keep(key, hit); return hit; }
        } catch (e) { console.warn('[IBA] PO file lookup failed:', e); }
        if (!isSuper()) return null;
        const added = await openForm(key);
        if (added) { seen.set(normPO(key), added); missAt.delete(normPO(key)); keep(key, added); }
        return added;
    }

    // ---- the window ---------------------------------------------------------
    let win = null;
    function close(result) { if (win) { const w = win; win = null; w.remove(); if (w.__done) w.__done(result || null); } }

    function openForm(po) {
        return new Promise((resolveP) => {
            if (win) close(null);
            try { if (typeof ensureVendorsDataFetchedForJobEntry === 'function') ensureVendorsDataFetchedForJobEntry(false).then(fillLists).catch(() => {}); } catch (_) {}
            win = document.createElement('div');
            win.id = 'iba-esn';
            win.className = 'iba-esn-ov iba-addpo';
            win.__done = resolveP;
            win.innerHTML = '<div class="iba-esn-box" role="dialog" aria-modal="true" aria-label="Add new PO">' +
                '<div class="iba-esn-head"><b><i class="fa-solid fa-file-circle-plus"></i> PO not in the records</b>' +
                '<button type="button" class="iba-esn-x" data-ap-x aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="iba-esn-body">' +
                '<div class="iba-ap-ask"><p class="iba-ap-q">PO <b>' + esc(po) + '</b> is not in POVALUE2 or the PO file yet. Do you want to add it?</p>' +
                '<div class="iba-ap-btns"><button type="button" class="iba-esn-btn" data-ap-x>Not now</button><button type="button" class="iba-esn-btn is-go" data-ap-yes><i class="fa-solid fa-plus"></i> Add PO</button></div></div>' +
                '<form class="iba-ap-form" autocomplete="off" hidden>' +
                '<label><span class="iba-esn-lab">PO number</span><input class="iba-esn-q" name="po" required value="' + esc(po) + '"></label>' +
                '<label><span class="iba-esn-lab">Req. number</span><input class="iba-esn-q" name="req"></label>' +
                '<label class="is-wide"><span class="iba-esn-lab">Vendor name</span><input class="iba-esn-q" name="vname" list="iba-ap-vnames" required placeholder="Type a few letters"></label>' +
                '<label><span class="iba-esn-lab">Vendor ID</span><input class="iba-esn-q" name="vid" list="iba-ap-vids" required></label>' +
                '<label><span class="iba-esn-lab">Site (Project ID)</span><input class="iba-esn-q" name="site" list="iba-ap-sites" required></label>' +
                '<label><span class="iba-esn-lab">PO amount (QAR)</span><input class="iba-esn-q" name="amt" inputmode="decimal" required></label>' +
                '<label><span class="iba-esn-lab">Status</span><input class="iba-esn-q" value="Inactive" disabled></label>' +
                '<datalist id="iba-ap-vnames"></datalist><datalist id="iba-ap-vids"></datalist><datalist id="iba-ap-sites"></datalist>' +
                '<div class="iba-esn-err is-wide"></div>' +
                '<div class="iba-ap-btns is-wide"><button type="button" class="iba-esn-btn" data-ap-x>Cancel</button><button type="submit" class="iba-esn-btn is-go"><i class="fa-solid fa-floppy-disk"></i> Save PO and continue</button></div>' +
                '</form></div></div>';
            document.body.appendChild(win);
            const w = win, f = w.querySelector('form');
            const err = w.querySelector('.iba-esn-err');
            function fillLists() {
                if (!w.isConnected) return;
                const v = vendors();
                const ids = Object.keys(v);
                w.querySelector('#iba-ap-vnames').innerHTML = ids.map((id) => '<option value="' + esc(v[id]) + '">' + esc(id) + '</option>').join('');
                w.querySelector('#iba-ap-vids').innerHTML = ids.map((id) => '<option value="' + esc(id) + '">' + esc(v[id]) + '</option>').join('');
                const sites = new Set();
                const m = poMap() || {};
                Object.keys(m).forEach((k) => { const s = m[k] && (m[k]['Project ID'] || m[k]['Project ID:']); if (s) sites.add(String(s).trim()); });
                w.querySelector('#iba-ap-sites').innerHTML = Array.from(sites).sort().slice(0, 600).map((s) => '<option value="' + esc(s) + '">').join('');
            }
            fillLists();
            // vendor name <-> vendor ID
            f.vname.addEventListener('input', () => {
                const v = vendors(), t = f.vname.value.trim().toLowerCase();
                const id = Object.keys(v).find((k) => String(v[k]).trim().toLowerCase() === t);
                if (id) f.vid.value = id;
            });
            f.vid.addEventListener('input', () => {
                const v = vendors(), t = f.vid.value.trim().toLowerCase();
                const id = Object.keys(v).find((k) => k.trim().toLowerCase() === t);
                if (id) f.vname.value = v[id];
            });
            w.addEventListener('click', (e) => {
                if (e.target === w || e.target.closest('[data-ap-x]')) return close(null);
                if (e.target.closest('[data-ap-yes]')) {
                    w.querySelector('.iba-ap-ask').hidden = true;
                    f.hidden = false;
                    w.querySelector('.iba-esn-head b').innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Add new PO';
                    setTimeout(() => (f.req.focus()), 30);
                }
            });
            w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
            setTimeout(() => { const b = w.querySelector('[data-ap-yes]'); if (b) b.focus(); }, 30);
            f.addEventListener('submit', async (e) => {
                e.preventDefault();
                err.textContent = '';
                const p = normPO(f.po.value);
                const amt = parseFloat(String(f.amt.value).replace(/,/g, ''));
                if (!p) { err.textContent = 'Type the PO number (digits).'; return; }
                if (!isFinite(amt) || amt <= 0) { err.textContent = 'Type the PO amount.'; return; }
                const btn = f.querySelector('button[type=submit]');
                btn.disabled = true;
                try {
                    // someone may have added it meanwhile
                    seen.delete(p); missAt.delete(p);
                    const again = await find(p);
                    if (again) { close(again); return; }
                    const rec = {
                        ReqNum: f.req.value.trim(),
                        PO: p,
                        SupplierID: f.vid.value.trim(),
                        SupplierName: f.vname.value.trim(),
                        ProjectID: f.site.value.trim(),
                        Amount: amt,
                        Status: 'Inactive',
                        DateFiled: ''
                    };
                    await progDb().ref('records').push(rec);
                    try { if (typeof window.ibaToast === 'function') window.ibaToast('PO ' + p + ' added to the PO file (Inactive).'); } catch (_) {}
                    close(toPoData(rec, p));
                } catch (ex) {
                    btn.disabled = false;
                    const m = String((ex && (ex.code || ex.message)) || ex);
                    err.textContent = /permission/i.test(m) ? 'The PO file did not allow the save (Firebase rules). Add the new rules line, then try again.' : ('Could not save: ' + m);
                }
            });
        });
    }

    window.ibaAddPo = { find, fill, resolve, open: openForm };
})();
