/* 18.0.0 patch 5 (martin, mock-up https://claude.ai/artifact/KnhqNXWMGCJzV9sSRWx8zq): SKILL ACCESS.
   The Super Admin chooses, per assistant skill, who may use it:
     - As built   : the skill's own rule (Super Admin only / Admins / everyone)
     - Everyone   : every signed-in user
     - Only these : the positions ticked (from each user's record, so a new person in that position
                    gets it by themselves) and/or named people (kept by user key + name)
   The Super Admin always keeps every skill. Saved for everyone in system_settings/skill_access/{skillId}
   (tiny node, read once at sign-in and kept live). Some skills are locked to the Super Admin because the
   page behind them is Super Admin only (Batch Entry, merge delete, hand-overs, ...); LPO emails is kept in
   Settings › "Who can send LPO emails" and the ESN printers in Settings › "Who can print ESN".
   Open: All skills › Skill access, or Settings › Skill access card.  window.ibaSkillAccess */
(function () {
    'use strict';
    if (window.ibaSkillAccess) return;
    const PATH = 'system_settings/skill_access';
    const CACHE = 'iba-skill-access-v1';
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : (window.db || null); } catch (_) { return window.db || null; } }
    function user() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function myKey() { const u = user(); let k = u && u.key; if (!k) { try { k = localStorage.getItem('approverKey'); } catch (_) {} } return String(k || '').trim(); }
    function superName() { try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) return String(SUPER_ADMIN_NAME); } catch (_) {} return 'Irwin'; }
    function isSuper() { const u = user(); return !!(u && norm(u.Name) && norm(u.Name) === norm(superName())); }
    function approvers() {
        let m = {};
        try { if (typeof ibaApproverMap === 'function') m = ibaApproverMap() || {}; } catch (_) {}
        return Object.keys(m).map((k) => ({ key: k, name: String(m[k].Name || '').trim(), position: String(m[k].Position || '').trim(), site: String(m[k].Site || '').trim() }))
            .filter((p) => p.name);
    }

    // ---- the rules (cached so the chips are right before Firebase answers) ----
    let rules = null;
    try { rules = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (_) {}
    let live = false;
    function listen() {
        if (live) return;
        const d = mainDb();
        if (!d || !user()) { setTimeout(listen, 1500); return; }
        live = true;
        try {
            d.ref(PATH).on('value', (s) => {
                rules = s.val() || {};
                try { localStorage.setItem(CACHE, JSON.stringify(rules)); } catch (_) {}
                try { window.dispatchEvent(new CustomEvent('iba:skill-access')); } catch (_) {}
            }, (e) => { console.warn('[skill access] not read', e); live = false; });
        } catch (e) { live = false; setTimeout(listen, 5000); }
    }
    function rule(id) {
        const r = rules && rules[id];
        return r && (r.who === 'all' || r.who === 'only') ? r : null;
    }
    // true / false when a rule decides, null = no rule (use the skill's own rule)
    function decide(id) {
        const r = rule(id);
        if (!r) return null;
        if (isSuper() || r.who === 'all') return true;
        const u = user();
        if (!u) return false;
        const pos = norm(u.Position);
        if (pos && (r.pos || []).some((p) => norm(p) === pos)) return true;
        const k = myKey(), n = norm(u.Name);
        return (r.ppl || []).some((p) => p && p.key === k && norm(p.name) === n);
    }
    function summary(r) {
        if (!r) return '';
        if (r.who === 'all') return 'Everyone';
        const bits = (r.pos || []).concat((r.ppl || []).map((p) => p.name));
        return bits.length ? bits.join(', ') : 'Only the Super Admin';
    }

    // ---- the window ----
    function css() {
        if ($('iba-sa-css')) return;
        const st = document.createElement('style');
        st.id = 'iba-sa-css';
        st.textContent =
            'html body #iba-esn .iba-esn-box.iba-sa-box { width: min(980px, 100%); height: min(680px, calc(100vh - 36px)); }' +
            'html body #iba-esn .iba-sa-box .iba-esn-body { padding: 0; }' +
            '.iba-sa { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); min-height: 0; flex: 1; height: 100%; }' +
            '.iba-sa-list { border-right: 1px solid rgba(255,255,255,.1); padding: 10px; overflow: auto; display: grid; gap: 3px; align-content: start; }' +
            '.iba-sa-find { height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); color: inherit; padding: 0 10px; font: inherit; margin-bottom: 4px; }' +
            '.iba-sa-gt { font-size: 11px; letter-spacing: .14em; color: #e8c547; font-weight: 800; margin: 10px 6px 2px; text-transform: uppercase; }' +
            '.iba-sa-sk { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; background: none; color: inherit; font: inherit; text-align: left; width: 100%; }' +
            '.iba-sa-sk:hover { background: rgba(255,255,255,.06); } .iba-sa-sk.is-on { background: rgba(232,197,71,.12); border-color: rgba(232,197,71,.55); }' +
            '.iba-sa-sk span { font-weight: 700; font-size: 13.5px; } .iba-sa-sk em { font-style: normal; font-size: 11.5px; color: #cfd6df; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }' +
            '.iba-sa-sk.is-changed em { color: #7FE3D6; } .iba-sa-sk.is-lock span { opacity: .6; }' +
            '.iba-sa-ed { padding: 16px 20px; display: grid; gap: 14px; align-content: start; overflow: auto; }' +
            '.iba-sa-ed h3 { margin: 0; font-size: 18px; } .iba-sa-ed p { margin: 0; color: #cfd6df; font-size: 13.5px; }' +
            '.iba-sa-lbl { font-size: 11.5px; letter-spacing: .1em; color: #c9b98f; font-weight: 800; }' +
            '.iba-sa-opt { display: flex; gap: 8px; flex-wrap: wrap; }' +
            '.iba-sa-opt button { font: inherit; font-weight: 700; font-size: 13.5px; color: inherit; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 8px 14px; cursor: pointer; }' +
            '.iba-sa-opt button.is-on { background: rgba(127,227,214,.16); border-color: rgba(127,227,214,.75); }' +
            '.iba-sa-pos { display: flex; flex-wrap: wrap; gap: 8px; }' +
            '.iba-sa-pos label { color: #F3EAD3 !important; display: flex; align-items: center; gap: 7px; padding: 6px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); font-size: 13px; cursor: pointer; }' +
            '.iba-sa-pos label.is-on { background: rgba(232,197,71,.14); border-color: rgba(232,197,71,.6); } .iba-sa-pos small { color: #c9b98f; }' +
            '.iba-sa-ppl { display: grid; gap: 6px; }' +
            '.iba-sa-p { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); font-size: 13.5px; }' +
            '.iba-sa-p small { color: #c9b98f; } .iba-sa-p button { background: none; border: 0; color: #ff9b9b; font: inherit; font-weight: 700; cursor: pointer; }' +
            '.iba-sa-add { height: 38px; border-radius: 10px; border: 1px dashed rgba(255,255,255,.3); background: rgba(255,255,255,.03); color: inherit; padding: 0 12px; font: inherit; }' +
            '.iba-sa-sum { padding: 10px 12px; border-radius: 10px; background: rgba(127,227,214,.08); border: 1px solid rgba(127,227,214,.35); font-size: 13.5px; } .iba-sa-sum b { color: #7FE3D6; }' +
            '.iba-sa-lock { padding: 12px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: #dfe5ec; }' +
            '@media (max-width: 760px) { .iba-sa { grid-template-columns: 1fr; } .iba-sa-list { max-height: 34vh; border-right: 0; border-bottom: 1px solid rgba(255,255,255,.1); } }';
        document.head.appendChild(st);
    }
    // catalog comes from the assistant: [{id, name, group, built, lock}]
    function catalog() { try { return typeof window.ibaAiSkillCatalog === 'function' ? window.ibaAiSkillCatalog() : []; } catch (_) { return []; } }

    async function open(firstId) {
        if (!isSuper()) { alert('Skill access is for the Super Admin only.'); return; }
        const f = window.ibaEsnFlow;
        if (!f || !f.openWin) { alert('Skill access could not open (page not ready). Please try again.'); return; }
        listen();
        const list = catalog();
        if (!list.length) { alert('The assistant is still loading. Please try again in a moment.'); return; }
        css();
        const draft = {};
        list.forEach((s) => { const r = rule(s.id); draft[s.id] = r ? JSON.parse(JSON.stringify(r)) : null; });
        const ppl = approvers();
        const posCount = {};
        ppl.forEach((p) => { if (p.position) posCount[p.position] = (posCount[p.position] || 0) + 1; });
        const positions = Object.keys(posCount).sort((a, b) => a.localeCompare(b));
        let cur = (firstId && list.some((s) => s.id === firstId)) ? firstId : (list.find((s) => !s.lock) || list[0]).id;
        let q = '';
        const W = f.openWin('Skill access', 'fa-user-lock',
            '<div class="iba-sa"><div class="iba-sa-list" data-sa-list></div><div class="iba-sa-ed" data-sa-ed></div></div>' +
            '<datalist id="iba-sa-names">' + ppl.map((p) => '<option value="' + esc(p.name + ' - ' + (p.position || '') + (p.site ? ' - ' + p.site : '')) + '"></option>').join('') + '</datalist>',
            '<span class="iba-esn-err" style="flex:1"></span><button type="button" class="secondary-btn" data-esn-x>Cancel</button>' +
            '<button type="button" class="primary-btn" data-sa-save><i class="fa-solid fa-floppy-disk"></i> Save</button>', true);
        W.w.querySelector('.iba-esn-box').classList.add('iba-sa-box');
        const L = W.w.querySelector('[data-sa-list]'), E = W.w.querySelector('[data-sa-ed]');
        const changed = (id) => JSON.stringify(draft[id] || null) !== JSON.stringify(rule(id) || null);
        function short(s) { if (s.lock) return '🔒 ' + s.lockShort; const r = draft[s.id]; return r ? summary(r) : s.built; }
        function drawList() {
            let g = '', h = '<input type="search" class="iba-sa-find" data-sa-find placeholder="Find a skill" value="' + esc(q) + '">';
            list.forEach((s) => {
                if (q && norm(s.name).indexOf(norm(q)) === -1) return;
                if (s.group !== g) { g = s.group; h += '<div class="iba-sa-gt">' + esc(g) + '</div>'; }
                h += '<button type="button" class="iba-sa-sk' + (s.id === cur ? ' is-on' : '') + (s.lock ? ' is-lock' : '') + (changed(s.id) ? ' is-changed' : '') + '" data-sa-sk="' + s.id + '"><span>' + esc(s.name) + '</span><em>' + esc(short(s)) + '</em></button>';
            });
            L.innerHTML = h;
            const fi = L.querySelector('[data-sa-find]');
            if (fi && document.activeElement !== fi && q) { /* keep */ }
        }
        function count(r) {
            if (!r) return '';
            if (r.who === 'all') return 'every user';
            const set = new Set();
            ppl.forEach((p) => { if ((r.pos || []).some((x) => norm(x) === norm(p.position))) set.add(p.key); });
            (r.ppl || []).forEach((p) => set.add(p.key));
            return set.size + (set.size === 1 ? ' person' : ' people');
        }
        function drawEd() {
            const s = list.find((x) => x.id === cur);
            if (!s) { E.innerHTML = ''; return; }
            if (s.lock) { E.innerHTML = '<h3>' + esc(s.name) + '</h3><div class="iba-sa-lock">🔒 ' + esc(s.lock) + '</div>'; return; }
            const r = draft[s.id];
            const who = r ? r.who : 'built';
            E.innerHTML = '<h3>' + esc(s.name) + '</h3>' + (s.desc ? '<p>' + esc(s.desc) + '</p>' : '') +
                '<div class="iba-sa-lbl">WHO CAN USE IT</div>' +
                '<div class="iba-sa-opt"><button type="button" data-sa-who="built" class="' + (who === 'built' ? 'is-on' : '') + '">As built: ' + esc(s.built) + '</button>' +
                '<button type="button" data-sa-who="all" class="' + (who === 'all' ? 'is-on' : '') + '">Everyone</button>' +
                '<button type="button" data-sa-who="only" class="' + (who === 'only' ? 'is-on' : '') + '">Only these</button></div>' +
                (who === 'only' ?
                    '<div class="iba-sa-lbl">POSITIONS</div><div class="iba-sa-pos">' + (positions.length ? positions.map((p) => {
                        const on = (r.pos || []).some((x) => norm(x) === norm(p));
                        return '<label class="' + (on ? 'is-on' : '') + '"><input type="checkbox" data-sa-pos="' + esc(p) + '"' + (on ? ' checked' : '') + '> ' + esc(p) + ' <small>' + posCount[p] + '</small></label>';
                    }).join('') : '<p>No user list loaded yet.</p>') + '</div>' +
                    '<div class="iba-sa-lbl">ALSO THESE PEOPLE</div><div class="iba-sa-ppl">' +
                    (r.ppl || []).map((p, i) => { const a = ppl.find((x) => x.key === p.key); return '<div class="iba-sa-p"><span><b>' + esc(p.name) + '</b> <small>' + esc(a ? [a.position, a.site].filter(Boolean).join(' · ') : 'not in the user list any more') + '</small></span><button type="button" data-sa-rm="' + i + '">Remove</button></div>'; }).join('') +
                    '<input class="iba-sa-add" list="iba-sa-names" data-sa-add placeholder="+ Add a person (type a name, pick the right one)" autocomplete="off"></div>' : '') +
                '<div class="iba-sa-sum">' + (who === 'built' ? 'Who sees it: <b>' + esc(s.built) + '</b> (the skill\'s own rule).' : 'Who sees it: <b>' + esc(count(r)) + '</b> + you (Super Admin).') + '</div>';
        }
        function redraw() { drawList(); drawEd(); }
        L.addEventListener('click', (e) => { const b = e.target.closest('[data-sa-sk]'); if (!b) return; cur = b.dataset.saSk; redraw(); });
        L.addEventListener('input', (e) => { if (!e.target.matches('[data-sa-find]')) return; q = e.target.value; drawList(); const fi = L.querySelector('[data-sa-find]'); if (fi) { fi.focus(); fi.setSelectionRange(fi.value.length, fi.value.length); } });
        E.addEventListener('click', (e) => {
            const w = e.target.closest('[data-sa-who]');
            if (w) {
                const v = w.dataset.saWho, r = draft[cur];
                if (v === 'built') draft[cur] = null;
                else if (v === 'all') draft[cur] = { who: 'all', pos: (r && r.pos) || [], ppl: (r && r.ppl) || [] };
                else draft[cur] = { who: 'only', pos: (r && r.pos) || [], ppl: (r && r.ppl) || [] };
                redraw(); return;
            }
            const rm = e.target.closest('[data-sa-rm]');
            if (rm && draft[cur]) { draft[cur].ppl.splice(+rm.dataset.saRm, 1); redraw(); }
        });
        E.addEventListener('change', (e) => {
            const r = draft[cur];
            if (!r) return;
            if (e.target.matches('[data-sa-pos]')) {
                const p = e.target.dataset.saPos;
                r.pos = (r.pos || []).filter((x) => norm(x) !== norm(p));
                if (e.target.checked) r.pos.push(p);
                redraw(); return;
            }
            if (e.target.matches('[data-sa-add]')) {
                const v = norm(e.target.value);
                const hit = ppl.find((p) => norm(p.name + ' - ' + (p.position || '') + (p.site ? ' - ' + p.site : '')) === v) || ppl.filter((p) => norm(p.name) === v)[0];
                if (!hit) { W.err('Pick the person from the list (name - position - site).'); return; }
                W.err('');
                r.ppl = (r.ppl || []).filter((p) => p.key !== hit.key);
                r.ppl.push({ key: hit.key, name: hit.name });
                redraw();
                const a = E.querySelector('[data-sa-add]'); if (a) a.focus();
            }
        });
        W.w.addEventListener('click', async (e) => {
            if (!e.target.closest('[data-sa-save]')) return;
            const d = mainDb();
            if (!d) { W.err('No connection to the database.'); return; }
            const up = {};
            list.forEach((s) => {
                if (s.lock || !changed(s.id)) return;
                const r = draft[s.id];
                up[s.id] = r ? { who: r.who, pos: r.who === 'only' ? (r.pos || []) : [], ppl: r.who === 'only' ? (r.ppl || []) : [], by: (user() || {}).Name || '', at: firebase.database.ServerValue.TIMESTAMP } : null;
            });
            if (!Object.keys(up).length) { W.close(); return; }
            const btn = e.target.closest('[data-sa-save]');
            btn.disabled = true;
            try {
                await d.ref(PATH).update(up);
                Object.keys(up).forEach((k) => { if (up[k]) { rules = rules || {}; rules[k] = Object.assign({}, up[k], { at: Date.now() }); } else if (rules) delete rules[k]; });
                try { localStorage.setItem(CACHE, JSON.stringify(rules || {})); } catch (_) {}
                try { window.dispatchEvent(new CustomEvent('iba:skill-access')); } catch (_) {}
                W.close();
                try { if (typeof window.ibaToast === 'function') window.ibaToast('Skill access saved (' + Object.keys(up).length + ' skill' + (Object.keys(up).length === 1 ? '' : 's') + ').'); } catch (_) {}
                paintCard();
            } catch (err) { btn.disabled = false; W.err('Not saved: ' + (err && err.message || err)); }
        });
        redraw();
        const on = L.querySelector('.is-on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }

    // ---- Settings card (Super Admin), next to "Who can print ESN" / "Who can send LPO emails" ----
    function paintCard() {
        const sec = $('settings-form') || $('wd-settings');
        if (!sec) return;
        let card = $('iba-sa-settings-card');
        if (!isSuper()) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div');
            card.id = 'iba-sa-settings-card';
            card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-user-lock"></i></div><div>' +
                '<h2>Skill access</h2><p>Super Admin only. Choose who can use each assistant skill: as built, everyone, or only some positions / people.</p></div></div>' +
                '<p class="iba-sa-card-sum">…</p>' +
                '<div class="settings-action-row"><button class="primary-btn" type="button" data-sa-open><i class="fa-solid fa-user-lock"></i> Open skill access</button></div>';
            const after = $('iba-lpo-settings-card') || $('iba-esn-settings-card');
            const before = $('iba-shell-bg-settings') || $('iba-login-opening-settings');
            if (after && after.parentElement) after.insertAdjacentElement('afterend', card);
            else if (before && before.parentElement) before.parentElement.insertBefore(card, before);
            else sec.appendChild(card);
            card.addEventListener('click', (e) => { if (e.target.closest('[data-sa-open]')) { e.preventDefault(); open(); } });
        }
        const n = Object.keys(rules || {}).filter((k) => rule(k)).length;
        const sum = card.querySelector('.iba-sa-card-sum');
        if (sum) sum.innerHTML = n ? '<b>' + n + '</b> skill' + (n === 1 ? '' : 's') + ' changed from the built-in rule.' : 'Every skill uses its built-in rule.';
    }
    (function watchSettings() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watchSettings, 1000); return; }
        let was = false;
        new MutationObserver(() => {
            const vis = !sec.classList.contains('hidden');
            if (vis && !was) setTimeout(paintCard, 300);
            was = vis;
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
    })();
    window.addEventListener('iba:skill-access', () => { if ($('iba-sa-settings-card')) paintCard(); });

    window.ibaSkillAccess = { open, decide, rule, summary, paintCard, listen, rules: () => rules || {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listen); else listen();
})();
