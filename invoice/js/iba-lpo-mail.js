/* ==========================================================================
   iba-lpo-mail.js — 17.0.4 patch 3 (+ patch 4/5: Type of work suggestions
   from class.csv; mobile from POVALUE2 "Buyer Mobile" first, then
   Site_Contacts.csv (Name, Mobile), else a name match from the user list,
   highlighted to double-check unless the name is exactly the same)
   (+ patch 6: CC procure@ + a.ahmed@ + {site}@iba.com.qa on every email,
   part of the template; "Open all in Outlook" opens every email at once
   when Chrome allows pop-ups for the site)
   (+ patch 9: "Open in: Microsoft Edge" for people whose Outlook web is
   signed in in Edge: the emails are saved for a moment under
   system_settings/lpo_handoff/{id} and lpo-open.html opens in Edge, reads
   them once, deletes them and opens each one in Outlook web)
   (+ patch 10: Signature box in the Template, added under every body,
   because Outlook web does not add the signature to a linked email)
   (+ patch 11: Scope per email - Delivery / Supply / Supply and Delivery /
   Supply, Delivery and Installation - makes the work line "Supply and
   Delivery of Cement"; the last scope picked is the next default;
   "Open emails in" also offers the Outlook app for Open next / Open all)
   (+ patch 12: Vendor / Site / IBA contact boxes on every email with
   suggestions from Vendors.csv / Site.csv / Site_Contacts.csv: picking one
   fills To, Project + site CC group, Mobile. A PO not in POVALUE2.csv is
   also looked up in the POs added in the system (purchase_orders))
   (+ 17.0.5 patch 1: Open all - Outlook app emails start 0.15 s apart so
   all of them start while the click still counts (0.9 s apart let only the
   first ~5 through); blocked web emails stay "not opened" and the button
   turns into "Open the rest (N)"; clear steps when the browser blocks)
   "LPO emails": type one or many PO numbers and get one ready email per PO
   to send the approved LPO to the vendor:
   - Subject  LPO# {PO}-{ReqNum}-{Vendor}-{Type of work}-{Site}
   - To       the vendor's email (Vendors.csv, column Email, by Supplier ID)
   - Body     the template with the work, project (Site.csv) and IBA contact
              (POVALUE2 "Buyer Name" + the mobile from the user list)
   Everything can be changed before opening. Each email opens in Outlook 365
   (web) or the Outlook app as a new message: attach the LPO, check, send.
   Outlook keeps it in Drafts if it is closed without sending.
   Who: the Super Admin, and the people the Super Admin adds to "Who can send
   LPO emails" (system_settings/lpo_mailers/{userKey}, kept by name + mobile
   like "Who can print ESN"). Reads only the free GitHub CSV files and the
   user list; no invoice data.
   ========================================================================== */
(function () {
    'use strict';

    const SET_PATH = 'system_settings/lpo_mailers';
    const TPL_KEY = 'iba-lpo-tpl-v1';
    const WHERE_KEY = 'iba-lpo-where-v1';
    const SCOPE_KEY = 'iba-lpo-scope-v1';
    const SCOPES = ['Delivery', 'Supply', 'Supply and Delivery', 'Supply, Delivery and Installation'];
    function scopeSaved() { try { const v = localStorage.getItem(SCOPE_KEY); return v == null ? 'Supply and Delivery' : v; } catch (_) { return 'Supply and Delivery'; } }
    // "Supply and Delivery" + "Cement" -> "Supply and Delivery of Cement"
    function workLine(m) {
        if (String(m.work || '').trim()) return m.work;
        const t = String(m.type || '').trim();
        return m.scope ? (t ? m.scope + ' of ' + t : m.scope) : t;
    }
    const HANDOFF_PATH = 'system_settings/lpo_handoff';
    const LIVE_PAGE = 'https://port.iba.com.qa/invoice/lpo-open.html';
    const RAW = 'https://raw.githubusercontent.com/DC-database/Hub/main/';
    const DEFAULT_SUBJECT = 'LPO# {po}-{req}-{vendor}-{type}-{site}';
    const DEFAULT_CC = 'procure@iba.com.qa, a.ahmed@iba.com.qa, {site}@iba.com.qa';
    const DEFAULT_BODY = 'Dear Sir,\n\n' +
        'Kindly find the attached approved LPO for the {work} at {project}.\n\n' +
        'Please ensure that you acknowledge receipt of this LPO by signing, stamping, and returning it to us as confirmation of your acceptance.\n\n' +
        'IBA Contact: {contact}: {mobile}\n';

    const $ = (id) => document.getElementById(id);
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
    function normMob(v) {
        const s = String(v == null ? '' : v);
        try { if (typeof normalizeMobile === 'function') return normalizeMobile(s); } catch (_) {}
        const d = s.replace(/\D/g, '');
        return d.length === 8 ? '974' + d : d;
    }
    function flow() { return window.ibaEsnFlow || null; }
    function mainDb() { try { return (typeof db !== 'undefined') ? db : window.db; } catch (_) { return window.db; } }
    function user() { try { return (typeof currentApprover !== 'undefined' && currentApprover) ? currentApprover : (window.currentApprover || null); } catch (_) { return window.currentApprover || null; } }
    function myName() { const u = user(); return String((u && u.Name) || '').trim(); }
    function myKey() { const u = user(); return String((u && u.key) || localStorage.getItem('approverKey') || '').trim(); }
    function isSuper() { const f = flow(); try { if (f && f.isSuper) return !!f.isSuper(); } catch (_) {} try { return typeof imIsCurrentUserSuperAdmin === 'function' && !!imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
    function ts() { return firebase.database.ServerValue.TIMESTAMP; }
    function dateOf(v) { const n = Number(v); if (!n) return ''; const d = new Date(n); return d.toLocaleDateString('en-GB'); }
    function onPhone() { return !!(document.body && document.body.classList.contains('iba-phone')); }

    // ------------------------------------------------------------------
    // who may use it
    // ------------------------------------------------------------------
    let mailers = null;
    async function loadMailers(force) {
        if (!force && mailers) return mailers;
        try { mailers = (await mainDb().ref(SET_PATH).once('value')).val() || {}; } catch (e) { console.warn('[lpo] list not read', e); mailers = mailers || {}; }
        return mailers;
    }
    function matches(entry, rec) {
        if (!entry || !rec) return false;
        return norm(entry.name) === norm(rec.Name || rec.name) && !!normMob(entry.mobile) && normMob(entry.mobile) === normMob(rec.Mobile || rec.mobile);
    }
    function canSync() {
        if (isSuper()) return true;
        const u = user();
        return !!(mailers && u && u.key && matches(mailers[u.key], u));
    }
    function allowedSync(key) {
        if (!key || !mailers || !mailers[key]) return false;
        let rec = null;
        try { if (typeof getApproversDataSafe === 'function') rec = (getApproversDataSafe() || {})[key]; } catch (_) {}
        try { if (!rec && typeof allApproverData !== 'undefined' && allApproverData) rec = allApproverData[key]; } catch (_) {}
        return matches(mailers[key], rec);
    }
    async function canFresh() {
        if (isSuper()) return true;
        const k = myKey();
        if (!k) return false;
        try {
            const d = mainDb();
            const [e, r] = await Promise.all([d.ref(SET_PATH + '/' + k).once('value'), d.ref('approvers/' + k).once('value')]);
            return matches(e.val(), r.val());
        } catch (_) { return false; }
    }

    // ------------------------------------------------------------------
    // data: POVALUE2 (already loaded by the app), Vendors.csv, Site.csv
    // ------------------------------------------------------------------
    function parseCsv(text) {
        const rows = [];
        let row = [], cur = '', q = false;
        const t = String(text || '').replace(/^﻿/, '');
        for (let i = 0; i < t.length; i++) {
            const c = t[i];
            if (q) {
                if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === ',') { row.push(cur); cur = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && t[i + 1] === '\n') i++;
                row.push(cur); cur = '';
                if (row.some((x) => x.trim() !== '')) rows.push(row);
                row = [];
            } else cur += c;
        }
        row.push(cur);
        if (row.some((x) => x.trim() !== '')) rows.push(row);
        return rows.map((r) => r.map((x) => x.replace(/�/g, ' ').trim()));
    }
    async function csvUrl(name) {
        try { if (typeof getFirebaseCSVUrl === 'function') { const u = await getFirebaseCSVUrl(name); if (u) return u; } } catch (_) {}
        return RAW + name + '?v=' + Date.now();
    }
    async function fetchCsv(name) {
        const r = await fetch(await csvUrl(name), { cache: 'no-store' });
        if (!r.ok) throw new Error(name + ' could not be read (' + r.status + ')');
        // Excel saves some CSVs as Windows-1252 (class.csv: "Façade")
        const buf = await r.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
        catch (_) { text = new TextDecoder('windows-1252').decode(buf); }
        return parseCsv(text);
    }
    let vendors = null, vendorsAt = 0;
    async function vendorMail() {
        if (vendors && Date.now() - vendorsAt < 10 * 60000) return vendors;
        const rows = await fetchCsv('Vendors.csv');
        const h = (rows[0] || []).map(norm);
        const iName = h.indexOf('name'), iId = h.findIndex((x) => x.indexOf('supplier id') !== -1 || x === 'id'), iMail = h.findIndex((x) => x.indexOf('mail') !== -1);
        const byId = {}, byName = {}, list = [], seen = {};
        rows.slice(1).forEach((r) => {
            const mail = String(r[iMail === -1 ? 2 : iMail] || '').trim();
            const shown = String(r[iName === -1 ? 0 : iName] || '').replace(/\s+/g, ' ').trim();
            if (shown && !seen[shown.toLowerCase()]) { seen[shown.toLowerCase()] = 1; list.push(shown); }
            if (!mail) return;
            const id = String(r[iId === -1 ? 1 : iId] || '').trim();
            const name = norm(r[iName === -1 ? 0 : iName]);
            if (id) byId[id] = mail;
            if (name) byName[name] = byName[name] === undefined ? mail : (byName[name] === mail ? mail : ''); // two vendors, same name: no guess
        });
        vendors = { byId, byName, list: list.sort((a, b) => a.localeCompare(b)) };
        vendorsAt = Date.now();
        return vendors;
    }
    let sites = null;
    async function siteNames() {
        if (sites) return sites;
        const rows = await fetchCsv('Site.csv');
        sites = {};
        rows.slice(1).forEach((r) => { const k = String(r[0] || '').trim(); if (k) sites[k] = String(r[1] || '').replace(/\s+/g, ' ').trim(); });
        return sites;
    }
    // Type of work suggestions: class.csv "Class Name" ("Reinforcement." -> "Reinforcement")
    let classes = null;
    async function classNames() {
        if (classes) return classes;
        try {
            const rows = await fetchCsv('class.csv');
            const h = (rows[0] || []).map(norm);
            let iN = h.indexOf('class name');
            if (iN === -1) iN = 1;
            const seen = {};
            classes = [];
            rows.slice(1).forEach((r) => {
                const n = String(r[iN] || '').replace(/\.+$/, '').replace(/\s+/g, ' ').trim();
                if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; classes.push(n); }
            });
        } catch (e) { console.warn('[lpo] class.csv not read', e); classes = []; }
        return classes;
    }
    async function poRow(po) {
        let rows = null;
        try { if (typeof allPOData !== 'undefined' && allPOData) rows = allPOData; } catch (_) {}
        if (!rows || !Object.keys(rows).length) {
            try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (_) {}
            try { if (typeof allPOData !== 'undefined' && allPOData) rows = allPOData; } catch (_) {}
        }
        return rows ? (rows[String(po).toUpperCase()] || null) : null;
    }
    function pick(row, keys) {
        for (const k of keys) {
            const v = row && row[k];
            if (v != null && String(v).trim() && String(v).trim() !== 'N/A') return String(v).trim();
        }
        return '';
    }
    // Buyer Name -> user mobile. Exact same name = filled as it is. Anything
    // looser ("Eng. Khamis Farhan" vs user "E.Khamis") is filled but marked
    // "check" (yellow) so it is looked at before sending; never a silent guess.
    let people = null;
    const TITLES = { eng: 1, engr: 1, mr: 1, ms: 1, mrs: 1, dr: 1 };
    function nameWords(n) {
        return norm(n).split(/[^a-z0-9]+/).filter((w) => w && !TITLES[w]);
    }
    let contacts = null, contactsAt = 0;
    async function siteContacts() {
        if (contacts && Date.now() - contactsAt < 10 * 60000) return contacts;
        try {
            const rows = await fetchCsv('Site_Contacts.csv');
            const h = (rows[0] || []).map(norm);
            const iN = Math.max(0, h.indexOf('name')), iM = h.findIndex((x) => x.indexOf('mobile') !== -1 || x.indexOf('phone') !== -1);
            contacts = rows.slice(1).map((r) => ({ name: String(r[iN] || '').trim(), mobile: String(r[iM === -1 ? 1 : iM] || '').trim() })).filter((c) => c.name && c.mobile);
            contactsAt = Date.now();
        } catch (e) { console.warn('[lpo] Site_Contacts.csv not read', e); contacts = contacts || []; }
        return contacts;
    }
    async function buyerMobile(buyer) {
        const out = { mobile: '', note: '', check: false, options: [] };
        if (!buyer) return out;
        if (!people) { const f = flow(); people = f && f.approvers ? await f.approvers() : []; }
        const bw = nameWords(buyer);
        if (!bw.length) return out;
        // Site_Contacts.csv first: same name there = its mobile, no checking
        const sc = await siteContacts();
        const inSc = sc.filter((c) => nameWords(c.name).join(' ') === bw.join(' '));
        if (inSc.length === 1 || (inSc.length > 1 && inSc.every((c) => normMob(c.mobile) === normMob(inSc[0].mobile)))) { out.mobile = inSc[0].mobile; return out; }
        // otherwise Site_Contacts + user list, looser matches marked "check"
        const withMob = sc.map((c) => ({ name: c.name, mobile: c.mobile })).concat(people.filter((p) => p.mobile));
        const same = people.filter((p) => p.mobile && nameWords(p.name).join(' ') === bw.join(' '));
        if (same.length === 1) { out.mobile = same[0].mobile; return out; }
        // score = full words (2+ letters) both names share; one-letter parts must fit an initial
        const full = bw.filter((w) => w.length > 1);
        let scored = withMob.map((p) => {
            const pw = nameWords(p.name);
            const pf = pw.filter((w) => w.length > 1);
            const shared = full.filter((w) => pf.indexOf(w) !== -1).length;
            if (!shared) return null;
            const initOk = (ini, other) => ini.every((i) => other.some((w) => w[0] === i));
            // initials may stand for a title too ("E.Khamis" = "Eng. Khamis")
            const raw = (n) => norm(n).split(/[^a-z0-9]+/).filter(Boolean);
            const ok = initOk(bw.filter((w) => w.length === 1), raw(p.name)) && initOk(pw.filter((w) => w.length === 1), raw(buyer));
            return ok ? { p, shared } : null;
        }).filter(Boolean).sort((x, y) => y.shared - x.shared);
        if (same.length > 1) scored.unshift(...same.map((p) => ({ p, shared: 99 })));
        // the same mobile twice (in Site_Contacts and the user list) is one person
        scored = scored.filter((x, i) => scored.findIndex((y) => normMob(y.p.mobile) === normMob(x.p.mobile)) === i);
        out.options = scored.slice(0, 8).map((x) => ({ mobile: x.p.mobile, name: x.p.name }));
        if (!scored.length) { out.note = '"' + buyer + '" is not in Site_Contacts.csv: type the mobile'; out.check = true; return out; }
        const top = scored.filter((x) => x.shared === scored[0].shared);
        if (top.length === 1) {
            out.mobile = top[0].p.mobile;
            out.check = true;
            out.note = 'Not exact: taken from "' + top[0].p.name + '", please check';
        } else {
            out.check = true;
            out.note = top.length + ' people fit "' + buyer + '": pick the mobile';
        }
        return out;
    }

    // ------------------------------------------------------------------
    // the template
    // ------------------------------------------------------------------
    function tpl() {
        try { const t = JSON.parse(localStorage.getItem(TPL_KEY) || 'null'); if (t && t.subject && t.body) return { subject: t.subject, body: t.body, cc: t.cc == null ? DEFAULT_CC : t.cc, sig: t.sig || '' }; } catch (_) {}
        return { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, cc: DEFAULT_CC, sig: '' };
    }
    function fill(text, d) {
        return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (d[k] != null ? String(d[k]) : m));
    }
    // empty parts leave no double dashes in the subject
    function fillSubject(text, d) {
        return fill(text, d).replace(/-{2,}/g, '-').replace(/-\s*$/, '').replace(/#\s*-/, '# ').trim();
    }
    // "{site}@iba.com.qa" with no site is left out; no repeats
    function fillCc(text, d) {
        const seen = {};
        return fill(text, d).split(/[\s,;]+/).map((x) => x.trim()).filter((x) => {
            const k = x.toLowerCase();
            if (!/^[^@\s{}]+@[^@\s{}]+\.[^@\s{}]+$/.test(x) || seen[k]) return false;
            seen[k] = 1; return true;
        }).join(', ');
    }
    function cleanPos(v) {
        return Array.from(new Set(String(v || '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase().replace(/^PO[#:-]*/, '')).filter((x) => /^[A-Z0-9_-]{1,30}$/.test(x))));
    }

    // ------------------------------------------------------------------
    // the window
    // ------------------------------------------------------------------
    // 17.0.4 p10: Outlook web fills CC only when the whole email is handed
    // over as one mailto link (mailtouri=); ?to=&cc= left CC empty (tested by
    // martin in Edge)
    function outlookWebUrl(m) {
        return 'https://outlook.office.com/mail/deeplink/compose?mailtouri=' + encodeURIComponent(mailtoUrl(m));
    }
    function mailList(v) {
        return String(v || '').split(/[\s,;]+/).filter(Boolean).map((x) => encodeURIComponent(x).replace(/%40/g, '@')).join(',');
    }
    function mailtoUrl(m) {
        return 'mailto:' + mailList(m.to) + '?' + (m.cc ? 'cc=' + mailList(m.cc) + '&' : '') +
            'subject=' + encodeURIComponent(m.subject || '') + '&body=' + encodeURIComponent((m.body || '').replace(/\r?\n/g, '\r\n'));
    }

    // ------------------------------------------------------------------
    // Microsoft Edge (Windows): Chrome asks "Open Microsoft Edge?" the first
    // time (tick "Always allow"); one Edge start per click, so several emails
    // go through the hand-off page
    // ------------------------------------------------------------------
    function edgeOffered() {
        const ua = navigator.userAgent || '';
        return /Windows/.test(ua) && !/\bEdg\//.test(ua);
    }
    function whereSaved() {
        let v = 'here';
        try { v = localStorage.getItem(WHERE_KEY) || 'here'; } catch (_) {}
        if (v === 'edge' && !edgeOffered()) v = 'here';
        return v === 'edge' || v === 'app' ? v : 'here';
    }
    function launchEdge(url) {
        const a = document.createElement('a');
        a.href = 'microsoft-edge:' + url;
        document.body.appendChild(a); a.click(); a.remove();
    }
    function handoffPage() {
        return /^https?:$/.test(location.protocol) ? new URL('lpo-open.html', location.href).href : LIVE_PAGE;
    }
    async function toEdge(list) {
        const d = mainDb();
        const base = String((d && d.app && d.app.options && d.app.options.databaseURL) || '').replace(/\/$/, '');
        if (!base) throw new Error('The database address is missing; refresh the page.');
        const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).replace(/[^a-z0-9]/g, '');
        await d.ref(HANDOFF_PATH + '/' + id).set({ at: Date.now(), by: myName(), mails: list.map((m) => ({ po: m.po, subject: m.subject || '', url: outlookWebUrl(m) })) });
        launchEdge(handoffPage() + '#' + encodeURIComponent(id + '|' + base));
    }

    async function open(prefill) {
        const f = flow();
        if (!f || !f.openWin) { alert('Please refresh the page and try again.'); return; }
        if (onPhone()) { alert('LPO emails work on the computer (Outlook 365).'); return; }
        if (!(await canFresh())) { alert('"LPO emails" is switched off for you. Ask the Super Admin to add you to "Who can send LPO emails".'); return; }
        const T = tpl();
        const W = f.openWin('LPO emails', 'fa-envelope-open-text',
            '<p class="iba-esn-sub">Type the PO numbers. Each PO gets one email to the vendor, filled from the PO list, Vendors.csv and Site.csv. ' +
            'Change anything you need, then open it in Outlook, <b>attach the LPO</b> and send. Put your signature once under Template.</p>' +
            '<div class="iba-lpo-top"><input type="text" class="iba-esn-q iba-lpo-pos" placeholder="PO numbers, e.g. 66940, 66941" inputmode="numeric" autocomplete="off">' +
            '<button type="button" class="iba-esn-btn is-go" data-lpo-load><i class="fa-solid fa-wand-magic-sparkles"></i> Make emails</button>' +
            '<button type="button" class="iba-esn-btn" data-lpo-tpl><i class="fa-solid fa-pen-to-square"></i> Template</button></div>' +
            '<div class="iba-lpo-where"><span>Open emails in</span>' +
                '<label><input type="radio" name="iba-lpo-where" value="here"> This browser</label>' +
                (edgeOffered() ? '<label><input type="radio" name="iba-lpo-where" value="edge"> <i class="fa-brands fa-edge"></i> Microsoft Edge</label>' : '') +
                '<label><input type="radio" name="iba-lpo-where" value="app"> <i class="fa-solid fa-desktop"></i> Outlook app</label>' +
                '<small>' + (edgeOffered() ? 'Edge: Chrome asks "Open Microsoft Edge?" the first time; tick "Always allow". In Edge, allow pop-ups for port.iba.com.qa once. ' : '') +
                'Outlook app: the browser asks to open Outlook the first time; tick "Always allow".</small></div>' +
            '<div class="iba-lpo-tplbox" hidden>' +
              '<label class="iba-esn-lab">CC</label><input type="text" class="iba-esn-q" data-tpl-cc value="' + esc(T.cc) + '">' +
              '<label class="iba-esn-lab">Subject</label><input type="text" class="iba-esn-q" data-tpl-subject value="' + esc(T.subject) + '">' +
              '<label class="iba-esn-lab">Body</label><textarea class="iba-lpo-ta" data-tpl-body rows="8">' + esc(T.body) + '</textarea>' +
              '<label class="iba-esn-lab">Signature (added under every email; Outlook does not add it to these)</label><textarea class="iba-lpo-ta" data-tpl-sig rows="5" placeholder="Best regards,&#10;Your name&#10;Position&#10;IBA ...&#10;Mobile / phone">' + esc(T.sig) + '</textarea>' +
              '<p class="iba-esn-sub">CC is split by commas; an address with an empty fill-in is left out. Fill-ins: {po} {req} {vendor} {type} {scope} {site} {work} {project} {contact} {mobile}. Saved in this browser.</p>' +
              '<div class="iba-lpo-row"><button type="button" class="iba-esn-btn is-go" data-tpl-save>Save template</button><button type="button" class="iba-esn-btn" data-tpl-reset>Back to the original</button></div>' +
            '</div>' +
            '<div class="iba-lpo-list"></div><div class="iba-esn-err" role="alert"></div>',
            '<span class="iba-lpo-count"></span><span class="iba-esn-sp"></span><button type="button" class="iba-esn-btn" data-esn-x>Close</button>' +
            '<button type="button" class="iba-esn-btn" data-lpo-all disabled><i class="fa-solid fa-layer-group"></i> Open all in Outlook</button>' +
            '<button type="button" class="iba-esn-btn is-go" data-lpo-next disabled><i class="fa-brands fa-microsoft"></i> Open next in Outlook</button>', true);
        const box = W.w;
        box.classList.add('iba-lpo');
        const listEl = box.querySelector('.iba-lpo-list');
        const posEl = box.querySelector('.iba-lpo-pos');
        const nextBtn = box.querySelector('[data-lpo-next]');
        const allBtn = box.querySelector('[data-lpo-all]');
        const countEl = box.querySelector('.iba-lpo-count');
        let mails = [];
        let where = whereSaved();
        box.querySelectorAll('input[name="iba-lpo-where"]').forEach((r) => {
            r.checked = r.value === where;
            r.addEventListener('change', () => { if (r.checked) { where = r.value; try { localStorage.setItem(WHERE_KEY, where); } catch (_) {} paintCount(); } });
        });

        posEl.addEventListener('input', () => {
            // ", " after each finished 5-digit PO (same as Add to Batch)
            const v = posEl.value;
            if (/\d{5}$/.test(v) && !/[\s,]$/.test(v) && v.length > (posEl.__last || '').length) posEl.value = v + ', ';
            posEl.__last = posEl.value;
        });
        posEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); build(); } });

        const paintCount = () => {
            const done = mails.filter((m) => m.opened).length;
            countEl.textContent = mails.length ? done + ' of ' + mails.length + ' opened' : '';
            const next = mails.find((m) => !m.opened && m.ok);
            nextBtn.disabled = !next;
            const left = mails.filter((m) => !m.opened && m.ok).length;
            allBtn.disabled = left < 2;
            const inEdge = where === 'edge' ? ' (Edge)' : (where === 'app' ? ' app' : '');
            const some = mails.some((m) => m.opened);
            allBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i> ' + (some ? 'Open the rest' : 'Open all in Outlook' + inEdge) + (left > 1 ? ' (' + left + ')' : '');
            nextBtn.innerHTML = '<i class="fa-brands fa-microsoft"></i> ' + (next ? 'Open next in Outlook' + inEdge + ' (PO ' + esc(next.po) + ')' : (mails.length ? 'All opened' : 'Open next in Outlook'));
        };
        const recompute = (m) => {
            const T2 = tpl();
            const d = { po: m.po, req: m.req, vendor: m.vendor, type: m.type, site: m.site, work: workLine(m), scope: m.scope || '', project: m.project, contact: m.contact, mobile: m.mobile };
            if (!m.subjectEdited) m.subject = fillSubject(T2.subject, d);
            if (!m.ccEdited) m.cc = fillCc(T2.cc, d);
            if (!m.bodyEdited) m.body = fill(T2.body, d).replace(/: \n/, '\n').replace(/\s+$/, '') + (T2.sig && T2.sig.trim() ? '\n\n' + T2.sig.replace(/\s+$/, '') : '') + '\n';
        };
        const card = (m, i) => '<div class="iba-lpo-card' + (m.problem ? ' is-bad' : '') + (m.opened ? ' is-done' : '') + '" data-i="' + i + '">' +
            '<div class="iba-lpo-head"><b>PO ' + esc(m.po) + '</b><span>' + esc([m.vendor, m.site ? 'Site ' + m.site : ''].filter(Boolean).join(' · ')) + '</span>' +
            (m.opened ? '<span class="iba-lpo-tag is-ok"><i class="fa-solid fa-check"></i> Opened</span>' : '') + '</div>' +
            (m.problem ? '<p class="iba-lpo-warn">' + esc(m.problem) + '</p>' : '') +
            '<div class="iba-lpo-grid">' +
              '<label class="is-wide"><span>CC</span><input type="text" data-f="cc" value="' + esc(m.cc) + '" placeholder="copy to"></label>' +
              '<label class="is-two"><span>Vendor</span><input type="text" data-f="vendor" list="iba-lpo-vendors" autocomplete="off" value="' + esc(m.vendor) + '" placeholder="type part of the vendor name, then pick"></label>' +
              '<label><span>Site</span><input type="text" data-f="site" list="iba-lpo-sites" autocomplete="off" value="' + esc(m.site) + '" placeholder="site no. or name"></label>' +
              '<label><span>To</span><input type="text" data-f="to" value="' + esc(m.to) + '" placeholder="vendor email">' + (m.to ? '' : '<small class="iba-lpo-miss">No email in Vendors.csv</small>') + '</label>' +
              '<label><span>Type of work (subject)</span><input type="text" data-f="type" list="iba-lpo-classes" autocomplete="off" value="' + esc(m.type) + '" placeholder="e.g. Cement (type, then pick)"></label>' +
              '<label><span>Scope</span><select data-f="scope"><option value="">(none)</option>' + SCOPES.map((x) => '<option' + (x === m.scope ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></label>' +
              '<label class="is-two"><span>Work (body)</span><input type="text" data-f="work" list="iba-lpo-classes" autocomplete="off" value="' + esc(m.work) + '" placeholder="' + esc(workLine(Object.assign({}, m, { work: '' })) || 'empty = Scope of Type of work') + '"></label>' +
              '<label><span>Project</span><input type="text" data-f="project" value="' + esc(m.project) + '"></label>' +
              '<label><span>IBA contact</span><input type="text" data-f="contact" list="iba-lpo-contacts" autocomplete="off" value="' + esc(m.contact) + '" placeholder="engineer name"></label>' +
              '<label' + (m.mobileCheck ? ' class="is-check"' : '') + '><span>Mobile' + (m.mobileCheck ? ' · check' : '') + '</span><input type="text" data-f="mobile" autocomplete="off"' + ((m.mobileOptions || []).length ? ' list="iba-lpo-mob-' + i + '"' : '') + ' value="' + esc(m.mobile) + '">' +
                (m.mobileNote ? '<small class="iba-lpo-miss">' + esc(m.mobileNote) + '</small>' : '') +
                ((m.mobileOptions || []).length ? '<datalist id="iba-lpo-mob-' + i + '">' + m.mobileOptions.map((o) => '<option value="' + esc(o.mobile) + '">' + esc(o.name) + '</option>').join('') + '</datalist>' : '') + '</label>' +
              '<label class="is-wide"><span>Subject</span><input type="text" data-f="subject" value="' + esc(m.subject) + '"></label>' +
              '<label class="is-wide"><span>Body</span><textarea data-f="body" rows="7">' + esc(m.body) + '</textarea></label>' +
            '</div>' +
            '<div class="iba-lpo-row"><button type="button" class="iba-esn-btn is-go" data-open="web"' + (m.ok ? '' : ' disabled') + '><i class="fa-brands fa-microsoft"></i> Open in Outlook 365</button>' +
            '<button type="button" class="iba-esn-btn" data-open="app"' + (m.ok ? '' : ' disabled') + ' title="Opens in the Outlook program on this computer"><i class="fa-solid fa-desktop"></i> Outlook app</button>' +
            '<button type="button" class="iba-esn-btn" data-copy title="Copy subject and body"><i class="fa-regular fa-copy"></i> Copy</button></div></div>';
        const paint = () => { listEl.innerHTML = mails.map(card).join(''); paintCount(); };
        const classList = document.createElement('datalist');
        classList.id = 'iba-lpo-classes';
        box.appendChild(classList);
        const paintClasses = (list) => { classList.innerHTML = (list || []).map((n) => '<option value="' + esc(n) + '"></option>').join(''); };
        classNames().then(paintClasses);
        // 17.0.4 p12: suggestions for Vendor / Site / IBA contact
        const mkList = (id) => { const d = document.createElement('datalist'); d.id = id; box.appendChild(d); return d; };
        const vendorDl = mkList('iba-lpo-vendors'), siteDl = mkList('iba-lpo-sites'), contactDl = mkList('iba-lpo-contacts');
        let siteMap = {};
        const paintLookups = async () => {
            try { const v = await vendorMail(); vendorDl.innerHTML = (v.list || []).map((n) => '<option value="' + esc(n) + '"></option>').join(''); } catch (_) {}
            try { siteMap = await siteNames(); siteDl.innerHTML = Object.keys(siteMap).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((k) => '<option value="' + esc(k) + '">' + esc(siteMap[k]) + '</option>').join(''); } catch (_) {}
            try {
                const sc = await siteContacts();
                if (!people) { const f2 = flow(); people = f2 && f2.approvers ? await f2.approvers() : []; }
                const seenC = {}, rows = [];
                sc.concat(people.filter((p) => p.mobile)).forEach((c) => { const k = norm(c.name); if (!seenC[k]) { seenC[k] = 1; rows.push(c); } });
                contactDl.innerHTML = rows.map((c) => '<option value="' + esc(c.name) + '">' + esc(c.mobile) + '</option>').join('');
            } catch (_) {}
        };
        paintLookups();
        // Tab on a half-typed type of work ("Ceme") completes it ("Cement")
        listEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || e.shiftKey) return;
            const inp = e.target.closest('[data-f="type"], [data-f="work"]');
            if (!inp || !classes || !inp.value.trim()) return;
            const t = inp.value.trim().toLowerCase();
            if (classes.some((n) => n.toLowerCase() === t)) return;
            const hit = classes.find((n) => n.toLowerCase().startsWith(t)) || classes.find((n) => n.toLowerCase().indexOf(t) !== -1);
            if (hit) { inp.value = hit; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        });

        async function build() {
            const pos = cleanPos(posEl.value);
            W.err('');
            if (!pos.length) { W.err('Type at least one PO number.'); return; }
            if (pos.length > 30) { W.err('Up to 30 POs at a time, please.'); return; }
            listEl.innerHTML = '<p class="iba-esn-sub">Reading the PO list, vendors and sites…</p>';
            let vm, sn;
            classNames().then(paintClasses);
            try { [vm, sn] = await Promise.all([vendorMail(), siteNames()]); }
            catch (e) { listEl.innerHTML = ''; W.err((e && e.message) || String(e)); return; }
            const keep = {};
            mails.forEach((m) => { keep[m.po] = m; });
            mails = [];
            for (const po of pos) {
                if (keep[po]) { mails.push(keep[po]); continue; }
                let row = await poRow(po), problem = '';
                if (!row) {
                    // 17.0.4 p12: a PO added in the system (purchase_orders) before POVALUE2.csv has it
                    try {
                        if (typeof getInvoicePurchaseOrderDetails === 'function') {
                            const d2 = await getInvoicePurchaseOrderDetails(po);
                            if (d2 && (pick(d2, ['Supplier Name']) || pick(d2, ['Project ID']))) row = d2;
                        }
                    } catch (_) {}
                    problem = row ? 'PO ' + po + ' is not in POVALUE2.csv yet; vendor and site come from the PO added in the system. Check the rest.'
                        : 'PO ' + po + ' is not in POVALUE2.csv yet: pick the Vendor, Site and IBA contact below (type a few letters).';
                }
                const m = { po, ok: true, problem: problem, type: '', work: '', scope: scopeSaved() };
                const sid = pick(row, ['Supplier ID', 'Supplier Id', 'Vendor ID']);
                m.vendor = pick(row, ['Supplier Name', 'Supplier Name:', 'Supplier']);
                m.req = pick(row, ['ReqNum', 'Req Num', 'Req No']);
                m.site = pick(row, ['Project ID', 'Site']);
                m.project = (m.site && sn[m.site]) || '';
                m.contact = pick(row, ['Buyer Name', 'Buyer']);
                m.to = (sid && vm.byId[sid]) || vm.byName[norm(m.vendor)] || '';
                // a mobile column in POVALUE2 wins (exact, no checking needed)
                const own = pick(row, ['Buyer Mobile', 'Buyer Mobile No', 'Buyer Mobile Number', 'Buyer Contact', 'Mobile', 'Contact No', 'Contact Number']);
                if (own) { m.mobile = own; m.mobileNote = ''; m.mobileCheck = false; m.mobileOptions = []; }
                else {
                    const bm = await buyerMobile(m.contact);
                    m.mobile = bm.mobile; m.mobileNote = bm.note; m.mobileCheck = bm.check; m.mobileOptions = bm.options;
                }
                recompute(m);
                mails.push(m);
            }
            paint();
        }
        function openMail(i, how, many) {
            const m = mails[i];
            if (!m) return false;
            if (!many && !m.to && !confirm('PO ' + m.po + ' has no "To" email. Open it anyway?')) return false;
            if (how === 'app' || (how === 'web' && where === 'app')) {
                const a = document.createElement('a');
                a.href = mailtoUrl(m);
                document.body.appendChild(a); a.click(); a.remove();
            } else if (where === 'edge') {
                const u = outlookWebUrl(m);
                if (u.length < 2000) launchEdge(u); // Windows passes up to ~2000 characters
                else toEdge([m]).catch((e) => W.err('Could not open in Edge: ' + ((e && e.message) || e)));
            } else {
                // without "noopener" so a blocked pop-up shows as null
                const w = window.open(outlookWebUrl(m), '_blank');
                if (!w) return false;
                try { w.opener = null; } catch (_) {}
            }
            m.opened = true;
            const el = listEl.querySelector('.iba-lpo-card[data-i="' + i + '"]');
            if (el) { el.outerHTML = card(m, i); }
            paintCount();
            return true;
        }
        // Chrome lets one click open one tab; the rest open only when pop-ups
        // are allowed for this site (icon at the right end of the address bar)
        async function openAll() {
            W.err('');
            const todo = mails.map((m, i) => i).filter((i) => !mails[i].opened && mails[i].ok);
            const noTo = todo.filter((i) => !mails[i].to);
            if (where === 'edge') {
                const go = todo.filter((i) => mails[i].to);
                if (!go.length) { W.err('Not opened (no "To" email): PO ' + noTo.map((i) => mails[i].po).join(', ') + '.'); return; }
                try { await toEdge(go.map((i) => mails[i])); }
                catch (e) { W.err('Could not open in Edge: ' + ((e && e.message) || e)); return; }
                go.forEach((i) => { mails[i].opened = true; });
                paint();
                W.err('Sent ' + go.length + ' email' + (go.length === 1 ? '' : 's') + ' to Edge.' + (noTo.length ? ' Not opened (no "To" email): PO ' + noTo.map((i) => mails[i].po).join(', ') + '.' : ''));
                return;
            }
            if (where === 'app') {
                // one new Outlook window per email, a moment apart so Windows
                // keeps up; the browser may ask once to open Outlook
                const go = todo.filter((i) => mails[i].to);
                // the browser accepts these only while the click still counts
                // (about 5 s), so they start close together
                go.forEach((i, k) => { if (k === 0) openMail(i, 'app', true); else setTimeout(() => openMail(i, 'app', true), k * 150); });
                W.err('Opening ' + go.length + ' email' + (go.length === 1 ? '' : 's') + ' in the Outlook app, each in its own window. The first time, the browser asks to open Outlook: tick "Always allow" and press Open all again for the rest.' +
                    (noTo.length ? ' Not opened (no "To" email): PO ' + noTo.map((i) => mails[i].po).join(', ') + '.' : ''));
                return;
            }
            let done = 0, blocked = 0;
            todo.filter((i) => mails[i].to).forEach((i) => { if (openMail(i, 'web', true)) done++; else blocked++; });
            const msg = [];
            if (blocked) {
                msg.push('The browser opened ' + done + ' and blocked ' + blocked + '. One time only: click the pop-up icon at the right end of the address bar, choose "Always allow pop-ups and redirects", press Done, then press "Open all" again for the rest.');
                if (location.protocol === 'file:') msg.push('(A copy opened from the disk cannot always get this permission; use port.iba.com.qa.)');
            }
            if (noTo.length) msg.push('Not opened (no "To" email): PO ' + noTo.map((i) => mails[i].po).join(', ') + '.');
            if (msg.length) W.err(msg.join(' '));
        }
        listEl.addEventListener('input', (e) => {
            const inp = e.target.closest('[data-f]');
            if (!inp) return;
            const i = Number(inp.closest('.iba-lpo-card').getAttribute('data-i'));
            const m = mails[i];
            if (!m) return;
            const f2 = inp.getAttribute('data-f');
            m[f2] = inp.value;
            if (f2 === 'subject') m.subjectEdited = true;
            if (f2 === 'body') m.bodyEdited = true;
            if (f2 === 'cc') m.ccEdited = true;
            if (f2 === 'to') m.toEdited = true;
            const card2 = inp.closest('.iba-lpo-card');
            const setF = (name, v) => { const el = card2.querySelector('[data-f="' + name + '"]'); if (el && el !== inp) el.value = v; };
            if (f2 === 'vendor') {
                // a vendor picked from the list fills To (unless To was typed by hand)
                const mail = vendors && vendors.byName[norm(m.vendor)];
                if (mail && !m.toEdited) {
                    m.to = mail; setF('to', mail);
                    const miss = card2.querySelector('[data-f="to"] + small'); if (miss) miss.remove();
                }
            }
            if (f2 === 'site') {
                const code = String(m.site || '').trim().split(/[\s·-]/)[0];
                if (code && siteMap[code]) {
                    if (code !== m.site) { m.site = code; inp.value = code; }
                    m.project = siteMap[code]; setF('project', m.project);
                }
            }
            if (f2 === 'contact') {
                // a contact picked from the list fills the mobile (no check needed)
                const hit = contactDl.querySelector('option[value="' + String(m.contact).replace(/["\\]/g, '') + '"]');
                if (hit && hit.textContent) {
                    m.mobile = hit.textContent; setF('mobile', m.mobile);
                    m.mobileCheck = false; m.mobileNote = '';
                    const ml = card2.querySelector('[data-f="mobile"]'); const lab = ml && ml.closest('label');
                    if (lab) { lab.classList.remove('is-check'); const sp = lab.querySelector('span'); if (sp) sp.textContent = 'Mobile'; const sm = lab.querySelector('small'); if (sm) sm.remove(); }
                }
            }
            if (f2 === 'vendor' || f2 === 'site') {
                const hs = card2.querySelector('.iba-lpo-head span');
                if (hs) hs.textContent = [m.vendor, m.site ? 'Site ' + m.site : ''].filter(Boolean).join(' · ');
            }
            if (f2 === 'scope') { try { localStorage.setItem(SCOPE_KEY, m.scope); } catch (_) {} }
            if (f2 === 'type' || f2 === 'scope') {
                // the Work box shows what the email will say while it is empty
                const w = inp.closest('.iba-lpo-card').querySelector('[data-f="work"]');
                if (w) w.placeholder = workLine(Object.assign({}, m, { work: '' })) || 'empty = Scope of Type of work';
            }
            if (f2 === 'mobile' && m.mobileCheck) {
                // looked at / changed by hand: no more yellow
                m.mobileCheck = false; m.mobileNote = '';
                const lab = inp.closest('label');
                if (lab) { lab.classList.remove('is-check'); const sp = lab.querySelector('span'); if (sp) sp.textContent = 'Mobile'; const sm = lab.querySelector('small'); if (sm) sm.remove(); }
            }
            if (f2 !== 'subject' && f2 !== 'body' && f2 !== 'to' && f2 !== 'cc') {
                recompute(m);
                const c = inp.closest('.iba-lpo-card');
                const s = c.querySelector('[data-f="subject"]'), b = c.querySelector('[data-f="body"]');
                if (s && !m.subjectEdited) s.value = m.subject;
                if (b && !m.bodyEdited) b.value = m.body;
                const ccEl = c.querySelector('[data-f="cc"]');
                if (ccEl && !m.ccEdited) ccEl.value = m.cc;
            }
        });
        box.addEventListener('click', async (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-lpo-load')) return build();
            if (b.hasAttribute('data-lpo-all')) return openAll();
            if (b.hasAttribute('data-lpo-next')) { const i = mails.findIndex((m) => !m.opened && m.ok); if (i > -1) openMail(i, 'web'); return; }
            if (b.hasAttribute('data-lpo-tpl')) { const t = box.querySelector('.iba-lpo-tplbox'); t.hidden = !t.hidden; return; }
            if (b.hasAttribute('data-tpl-save') || b.hasAttribute('data-tpl-reset')) {
                const reset = b.hasAttribute('data-tpl-reset');
                const sEl = box.querySelector('[data-tpl-subject]'), bEl = box.querySelector('[data-tpl-body]'), cEl = box.querySelector('[data-tpl-cc]'), gEl = box.querySelector('[data-tpl-sig]');
                // the signature stays when the rest goes back to the original
                if (reset) { sEl.value = DEFAULT_SUBJECT; bEl.value = DEFAULT_BODY; cEl.value = DEFAULT_CC; try { localStorage.setItem(TPL_KEY, JSON.stringify({ subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, cc: DEFAULT_CC, sig: gEl.value })); } catch (_) {} }
                else { try { localStorage.setItem(TPL_KEY, JSON.stringify({ subject: sEl.value, body: bEl.value, cc: cEl.value, sig: gEl.value })); } catch (_) {} }
                mails.forEach((m) => { m.subjectEdited = false; m.bodyEdited = false; m.ccEdited = false; recompute(m); });
                paint();
                box.querySelector('.iba-lpo-tplbox').hidden = true;
                return;
            }
            const c = b.closest('.iba-lpo-card');
            if (!c) return;
            const i = Number(c.getAttribute('data-i'));
            if (b.hasAttribute('data-open')) return openMail(i, b.getAttribute('data-open'));
            if (b.hasAttribute('data-copy')) {
                const m = mails[i];
                const text = 'To: ' + (m.to || '') + (m.cc ? '\nCc: ' + m.cc : '') + '\nSubject: ' + m.subject + '\n\n' + m.body;
                try { await navigator.clipboard.writeText(text); b.innerHTML = '<i class="fa-solid fa-check"></i> Copied'; }
                catch (_) { W.err('Copy is blocked here; select the text in the boxes instead.'); }
            }
        });
        if (prefill) { posEl.value = Array.isArray(prefill) ? prefill.join(', ') : String(prefill); build(); }
        else setTimeout(() => posEl.focus(), 30);
        return W.closed;
    }

    // ------------------------------------------------------------------
    // "Who can send LPO emails" (Super Admin)
    // ------------------------------------------------------------------
    async function openSettings() {
        const f = flow();
        if (!isSuper()) { alert('"Who can send LPO emails" is for the Super Admin only.'); return; }
        if (!f || !f.openWin) { alert('Please refresh the page and try again.'); return; }
        const W = f.openWin('Who can send LPO emails', 'fa-envelope-open-text',
            '<p class="iba-esn-sub">People on this list can use <b>LPO emails</b>. They are kept by their user record with today\'s name and mobile; if either changes, it switches off for them (red) until you add them again.</p>' +
            '<div class="iba-esn-cur"><p class="iba-esn-sub">Loading…</p></div>' +
            '<label class="iba-esn-lab">Add a person</label>' +
            '<input type="search" class="iba-esn-q" placeholder="Find a name, position, site or mobile" autocomplete="off">' +
            '<div class="iba-esn-people"></div><div class="iba-esn-err" role="alert"></div>', '', true);
        const box = W.w;
        const cur = box.querySelector('.iba-esn-cur');
        const q = box.querySelector('.iba-esn-q');
        const listEl = box.querySelector('.iba-esn-people');
        let ppl = [];
        const byKey = {};
        const line = (p) => [p.pos, p.site ? 'Site ' + p.site : '', p.mobile].filter(Boolean).join(' · ');
        const paintCur = () => {
            const keys = Object.keys(mailers || {});
            if (!keys.length) { cur.innerHTML = '<p class="iba-esn-sub"><b>Nobody yet.</b> Only the Super Admin can use LPO emails.</p>'; return; }
            cur.innerHTML = '<div class="iba-esn-scroll"><table class="iba-esn-table"><thead><tr><th>Person</th><th>Saved when added</th><th>Now</th><th></th></tr></thead><tbody>' + keys.map((k) => {
                const e = mailers[k] || {};
                const p = byKey[k];
                const ok = matches(e, p ? { Name: p.name, Mobile: p.mobile } : null);
                return '<tr class="' + (ok ? 'is-ok' : 'is-bad') + '"><td><b>' + esc(p ? p.name : e.name) + '</b><small>' + esc(p ? [p.pos, p.site ? 'Site ' + p.site : ''].filter(Boolean).join(' · ') : '') + '</small></td>' +
                    '<td>' + esc((e.name || '') + ' · ' + (e.mobile || '')) + '<small>by ' + esc(e.addedBy || '') + ' ' + esc(dateOf(e.addedAt)) + '</small></td>' +
                    '<td>' + (ok ? '<span class="iba-esn-ok"><i class="fa-solid fa-circle-check"></i> Can use</span>' : '<span class="iba-esn-bad"><i class="fa-solid fa-triangle-exclamation"></i> Details changed: switched off</span>') + '</td>' +
                    '<td><button type="button" class="iba-esn-btn is-small" data-rm="' + esc(k) + '">Remove</button></td></tr>';
            }).join('') + '</tbody></table></div>';
        };
        const paintAdd = () => {
            const t = norm(q.value);
            if (!t) { listEl.innerHTML = ''; return; }
            const hit = ppl.filter((p) => !(mailers && mailers[p.key]) && norm([p.name, p.pos, p.site, p.mobile].join(' ')).indexOf(t) !== -1).slice(0, 30);
            listEl.innerHTML = hit.length ? hit.map((p) => '<button type="button" class="iba-esn-person" data-add="' + esc(p.key) + '"><b>' + esc(p.name) + '</b><small>' + esc(line(p) || '—') + '</small><span class="iba-esn-addtag"><i class="fa-solid fa-plus"></i> Add</span></button>').join('')
                : '<p class="iba-esn-sub">No one found (people already on the list are not shown).</p>';
        };
        q.addEventListener('input', paintAdd);
        box.addEventListener('click', async (e) => {
            const add = e.target.closest('[data-add]');
            const rm = e.target.closest('[data-rm]');
            W.err('');
            try {
                if (add) {
                    const p = byKey[add.getAttribute('data-add')];
                    if (!p) return;
                    if (!normMob(p.mobile)) { W.err(p.name + ' has no mobile saved, so the safety check cannot work. Add the mobile to the user first.'); return; }
                    await mainDb().ref(SET_PATH + '/' + p.key).set({ name: p.name, mobile: p.mobile, addedBy: myName(), addedAt: ts() });
                } else if (rm) {
                    const k = rm.getAttribute('data-rm');
                    if (!confirm('Remove ' + (((mailers || {})[k] || {}).name || 'this person') + ' from "Who can send LPO emails"?')) return;
                    await mainDb().ref(SET_PATH + '/' + k).remove();
                } else return;
                await loadMailers(true);
                paintCard();
                q.value = '';
                paintCur(); paintAdd();
            } catch (err) { W.err('Not saved: ' + ((err && err.message) || err)); }
        });
        const [list] = await Promise.all([f.approvers(), loadMailers(true)]);
        ppl = list;
        ppl.forEach((p) => { byKey[p.key] = p; });
        paintCur();
        setTimeout(() => q.focus(), 30);
        return W.closed;
    }

    // Settings card (Super Admin), under "Who can print ESN"
    async function paintCard() {
        const sec = $('settings-form') || $('wd-settings');
        if (!sec) return;
        let card = $('iba-lpo-settings-card');
        if (!isSuper()) { if (card) card.remove(); return; }
        if (!card) {
            card = document.createElement('div');
            card.id = 'iba-lpo-settings-card';
            card.className = 'settings-card';
            card.innerHTML = '<div class="settings-card-header"><div class="settings-card-icon"><i class="fa-solid fa-envelope-open-text"></i></div><div>' +
                '<h2>Who can send LPO emails</h2><p>Super Admin only. People on this list can make the LPO emails to vendors (one Outlook email per PO).</p></div></div>' +
                '<p class="iba-lpo-card-sum">Loading…</p>' +
                '<div class="settings-action-row"><button class="primary-btn" type="button" data-lpo-open-list><i class="fa-solid fa-user-pen"></i> Open the list</button>' +
                '<button class="secondary-btn" type="button" data-lpo-open-mail><i class="fa-solid fa-envelope-open-text"></i> LPO emails</button></div>';
            const esnCard = $('iba-esn-settings-card');
            const before = $('iba-shell-bg-settings') || $('iba-login-opening-settings');
            if (esnCard && esnCard.parentElement) esnCard.insertAdjacentElement('afterend', card);
            else if (before && before.parentElement) before.parentElement.insertBefore(card, before);
            else sec.appendChild(card);
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-lpo-open-list]')) { e.preventDefault(); openSettings(); }
                if (e.target.closest('[data-lpo-open-mail]')) { e.preventDefault(); open(); }
            });
        }
        const sum = card.querySelector('.iba-lpo-card-sum');
        const list = await loadMailers();
        const keys = Object.keys(list || {});
        sum.innerHTML = !keys.length ? 'Nobody yet: only the <b>Super Admin</b> uses LPO emails.'
            : '<b>' + keys.length + '</b> ' + (keys.length === 1 ? 'person' : 'people') + ': ' + keys.map((k) => esc(list[k].name || k)).join(', ');
    }
    (function watchSettings() {
        const sec = $('wd-settings');
        if (!sec) { setTimeout(watchSettings, 1000); return; }
        let was = false;
        new MutationObserver(() => {
            const openNow = !sec.classList.contains('hidden');
            if (openNow && !was) setTimeout(paintCard, 300); // after the ESN card
            was = openNow;
        }).observe(sec, { attributes: true, attributeFilter: ['class'] });
        if (!sec.classList.contains('hidden')) setTimeout(paintCard, 300);
    })();
    // the list once after sign-in (a few bytes) so the assistant chip knows
    (function waitUser(n) {
        if (user() && user().Name) { loadMailers(); return; }
        if (n < 240) setTimeout(() => waitUser(n + 1), 500);
    })(0);

    window.ibaLpoMail = { open, openSettings, canSync, canFresh, allowedSync, loadMailers, _parseCsv: parseCsv, _fill: fill };
})();
