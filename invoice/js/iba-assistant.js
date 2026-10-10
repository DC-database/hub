/* ==========================================================================
   js/iba-assistant.js  —  14.0.0 patch 12 : IBA Assistant (AI)
   --------------------------------------------------------------------------
   A personal assistant inside the system, for the Super Admin first.
   - Brain: any OpenAI-compatible chat API. Default: Groq free plan with
     openai/gpt-oss-120b. Brain switch: Groq, Google Gemini, Ollama on a PC,
     or another compatible service. The API key is kept ONLY in this
     browser (localStorage); it is never written to the code or Firebase.
   - Jobs (tools the brain may call):
       get_brief          what is waiting (Active Task, Active Job, oldest,
                          PO Close Out) - from memory, no new download
       list_my_tasks      the waiting list with a filter - memory only
       find_po            one PO: vendor, site, value, invoices, remaining -
                          one small read of that PO only
       open_po            opens the PO on Invoice Entry - changes nothing
       fill_invoice_form  prepares a NEW invoice in the Invoice Entry form;
                          it never saves - you check and press Add
       find_person        names / positions / sites for Attention and
                          messages - memory only
     Drafting messages needs no tool: the brain writes them, you copy.
   - Skills: a job that worked can be saved with a name. Running a skill
     replays the same steps WITHOUT the AI (no quota used).
   - Never saves, approves or deletes anything by itself.
   Patch 13: for every user (desktop), each with their OWN key (kept in the
   browser per person). "Track an invoice" works for everyone WITHOUT a key
   and without the AI: by PO, or vendor + site / year, it shows where each
   invoice is (Reception, Invoice Entry, SRV, Approval, Accounts, Paid), who
   has it and for how long. Site rule: CEO, COO, Finance, Accounting, QS,
   Senior QS, Logistic, Procurement and any Manager see all sites; everyone
   else only the site(s) on their account. Amounts follow the system's own
   rule (Admin, Accounting, the vacation replacement, the Super Admin).
   Open PO / New invoice stay Super Admin only.
   ========================================================================== */
(function () {
    'use strict';
    if (window.ibaAssistant) return;

    const VERSION = '15.0.0';
    const CFG_KEY = 'iba-ai-brain-v1';
    const SKILLS_KEY = 'iba-ai-skills-v1';
    const BRIEF_KEY = 'iba-ai-brief-day-v1';
    const MAX_TOOL_ROUNDS = 5;
    const HISTORY_KEEP = 8;

    const BRAINS = {
        groq: { label: 'Groq (free)', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', needsKey: true,
            keyUrl: 'https://console.groq.com/keys', keyHelp: 'Sign in at console.groq.com (free, no card) > API Keys > Create API Key. Tip: in Settings > Data Controls turn on Zero Data Retention.' },
        gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', needsKey: true,
            keyUrl: 'https://aistudio.google.com/apikey', keyHelp: 'Google AI Studio > Get API key. On the free plan Google may use and read what you send.' },
        ollama: { label: 'Ollama (a PC)', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:8b', needsKey: false,
            keyUrl: 'https://ollama.com/download', keyHelp: 'Install Ollama on the PC, pull a model, and start it with OLLAMA_ORIGINS set to this site. Chrome asks once to allow the local connection.' },
        custom: { label: 'Other (OpenAI-compatible)', baseUrl: '', model: '', needsKey: true, keyUrl: '', keyHelp: 'Any service with an OpenAI-compatible /chat/completions endpoint.' }
    };

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function num(v) {
        if (v === null || v === undefined || v === '') return 0;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }
    function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    // patch 14: only "Paid" is paid; only "With Accounts" is payment in process
    function paymentState(status) {
        const k = norm(status);
        if (k === 'paid') return 'Paid (vendor has been paid)';
        if (k === 'with accounts') return 'Payment in process (with Accounts)';
        return 'Not paid yet (not with Accounts)';
    }
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function qatarParts(d) {
        try {
            const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d || new Date());
            const g = (t) => (p.find((x) => x.type === t) || {}).value;
            return { y: g('year'), m: g('month'), d: g('day'), h: Number(g('hour')) };
        } catch (_) {
            const x = d || new Date();
            return { y: String(x.getFullYear()), m: String(x.getMonth() + 1).padStart(2, '0'), d: String(x.getDate()).padStart(2, '0'), h: x.getHours() };
        }
    }
    function todayISO() { const q = qatarParts(); return q.y + '-' + q.m + '-' + q.d; }
    // patch 15: "last Thursday", "past week", "September 2025" -> exact dates (Qatar)
    const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    function qDay() { const q = qatarParts(); return new Date(Date.UTC(Number(q.y), Number(q.m) - 1, Number(q.d))); }
    function isoDay(d) { return d.toISOString().slice(0, 10); }
    function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
    function dayOfISO(v) {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'number' || /^\d{10,}$/.test(String(v))) { const q = qatarParts(new Date(Number(v))); return q.y + '-' + q.m + '-' + q.d; }
        const s0 = String(v).trim();
        let m = s0.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        m = s0.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
        const t = Date.parse(s0);
        return Number.isFinite(t) ? dayOfISO(t) : '';
    }
    function parseWhen(w) {
        const t = norm(w).replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return null;
        const today = qDay();
        const dow = today.getUTCDay();
        const r = (a, b, label) => ({ from: isoDay(a), to: isoDay(b), label: label || '' });
        let m;
        if ((m = t.match(/^(\d{4}-\d{2}-\d{2})$/))) return { from: m[1], to: m[1] };
        if (t === 'today') return r(today, today, 'today');
        if (t === 'yesterday') return r(addDays(today, -1), addDays(today, -1), 'yesterday');
        if ((m = t.match(/^(?:last |past |previous |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/))) {
            let back = (dow - WEEKDAYS.indexOf(m[1]) + 7) % 7;
            if (back === 0) back = 7;
            const d = addDays(today, -back);
            return r(d, d, m[1]);
        }
        if (/^this week$/.test(t)) return r(addDays(today, -dow), today, 'this week');
        if (/^(?:the )?(?:past|last) (?:7 days|seven days)$|^(?:the )?past week$/.test(t)) return r(addDays(today, -6), today, 'past 7 days');
        if (/^last week$/.test(t)) return r(addDays(today, -dow - 7), addDays(today, -dow - 1), 'last week');
        if ((m = t.match(/^(?:the )?(?:past|last) (\d{1,3}) days?$/))) return r(addDays(today, -(Number(m[1]) - 1)), today, 'past ' + m[1] + ' days');
        if (/^this month$/.test(t)) return r(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), today, 'this month');
        if (/^last month$/.test(t)) {
            const a = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
            return r(a, new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)), 'last month');
        }
        if ((m = t.match(/^(?:this year|(\d{4}))$/))) {
            const y = m[1] ? Number(m[1]) : today.getUTCFullYear();
            return r(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y, 11, 31)), String(y));
        }
        if ((m = t.match(/^([a-z]{3,9})(?: (\d{4}))?$/))) {
            const mi = MONTH_NAMES.findIndex((n) => n.startsWith(m[1]));
            if (mi !== -1) {
                let y = m[2] ? Number(m[2]) : today.getUTCFullYear();
                if (!m[2] && mi > today.getUTCMonth()) y -= 1;
                return r(new Date(Date.UTC(y, mi, 1)), new Date(Date.UTC(y, mi + 1, 0)), MONTH_NAMES[mi] + ' ' + y);
            }
        }
        return null;
    }
    function rangeOf(a) {
        const x = a || {};
        const f = dayOfISO(x.from), t = dayOfISO(x.to);
        if (f || t) return { from: f || '0000-01-01', to: t || f || '9999-12-31' };
        return x.when ? parseWhen(x.when) : null;
    }
    function inRange(day, rg) { return !!day && (!rg || (day >= rg.from && day <= rg.to)); }
    function fmtDate(v) {
        if (!v) return '';
        const t = typeof v === 'number' ? v : Date.parse(v);
        if (!Number.isFinite(t)) return String(v);
        const q = qatarParts(new Date(t));
        return q.d + '-' + MONTHS[Number(q.m) - 1] + '-' + q.y;
    }
    function daysSince(t) {
        if (!t) return null;
        const d = Math.floor((Date.now() - Number(t)) / 86400000);
        return d >= 0 ? d : 0;
    }
    function withTimeout(p, ms, label) {
        return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error((label || 'step') + ' took too long')), ms))]);
    }
    function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }

    function me() {
        try { if (typeof currentApprover !== 'undefined' && currentApprover) return currentApprover; } catch (_) {}
        return null;
    }
    function myName() { const a = me(); return a ? String(a.Name || '').trim() : ''; }
    function superName() {
        try { if (typeof SUPER_ADMIN_NAME !== 'undefined' && SUPER_ADMIN_NAME) return String(SUPER_ADMIN_NAME); } catch (_) {}
        return 'Irwin';
    }
    function isSuper() { const n = myName(); return !!n && norm(n) === norm(superName()); }
    function isDelegate() {
        try { return typeof isVacationDelegateUser === 'function' && !!isVacationDelegateUser(); } catch (_) { return false; }
    }
    const WIDE_TOKENS = ['coo', 'ceo', 'finance', 'accounting', 'accounts', 'qs', 'seniorqs', 'logistic', 'logistics', 'procurement'];
    function access() {
        const a = me() || {};
        const pos = norm(a.Position);
        const role = norm(a.Role);
        const tokens = pos.split(/[^a-z0-9]+/).filter(Boolean);
        const sup = isSuper();
        const del = isDelegate();
        const wide = sup || del || pos.includes('manager') || /senior\s*qs/.test(pos) || tokens.some((t) => WIDE_TOKENS.indexOf(t) !== -1);
        const sites = String(a.Site || '').split(/[,;\/]+/).map((x) => (String(x).match(/\d+/) || [''])[0]).filter(Boolean);
        return { super: sup, delegate: del, allSites: wide, sites: sites, amounts: sup || del || role === 'admin' || tokens.indexOf('accounting') !== -1 };
    }
    // Who may use the assistant: "everyone" (default) or "me" (Super Admin only).
    // Set by the Super Admin in Setup; kept in Firebase (iba_assistant/settings).
    let audience = '';
    let audienceAsked = false;
    function settingsRef() {
        try { return (typeof db !== 'undefined' && db && db.ref) ? db.ref('iba_assistant/settings/audience') : null; } catch (_) { return null; }
    }
    function readAudience() {
        if (audienceAsked) return;
        audienceAsked = true;
        const ref = settingsRef();
        if (!ref) { audience = 'everyone'; return; }
        withTimeout(ref.once('value'), 8000, 'settings').then((snap) => {
            const v = snap && snap.val();
            audience = v === 'me' ? 'me' : 'everyone';
            watch();
        }).catch(() => { audience = 'everyone'; watch(); });
    }
    function allowed() {
        const b = document.body;
        if (!b || !b.classList.contains('iba-shell-on') || b.classList.contains('iba-phone')) return false;
        if (!myName()) return false;
        readAudience();
        if (isSuper()) return true;
        return audience === 'everyone';
    }

    // ------------------------------------------------------------------
    // Brain settings (this browser only)
    // ------------------------------------------------------------------
    function userSlug() { return norm(myName()).replace(/[^a-z0-9]+/g, '_') || 'user'; }
    function cfgKey() { return CFG_KEY + ':' + userSlug(); }
    function getCfg() {
        let c = lsGet(cfgKey(), null);
        if (!c && isSuper()) {
            // patch 12 kept one key per browser; it was the Super Admin's
            const old = lsGet(CFG_KEY, null);
            if (old) { lsSet(cfgKey(), old); try { localStorage.removeItem(CFG_KEY); } catch (_) {} c = old; }
        }
        c = c || {};
        const brain = BRAINS[c.brain] ? c.brain : 'groq';
        const def = BRAINS[brain];
        return {
            brain: brain,
            baseUrl: String(c.baseUrl || def.baseUrl || '').replace(/\/+$/, ''),
            model: String(c.model || def.model || ''),
            key: String(c.key || '')
        };
    }
    function setCfg(c) { return lsSet(cfgKey(), c); }
    function ready() {
        const c = getCfg();
        if (!c.baseUrl || !c.model) return false;
        if (BRAINS[c.brain].needsKey && !c.key) return false;
        return true;
    }
    function brainLabel() {
        const c = getCfg();
        return (BRAINS[c.brain] ? BRAINS[c.brain].label.replace(/\s*\(.*\)$/, '') : 'AI') + ' · ' + (c.model || '—');
    }

    // ------------------------------------------------------------------
    // Data the jobs use (memory first; small reads only)
    // ------------------------------------------------------------------
    function waiting() {
        try { if (window.ibaLiveCounts && typeof window.ibaLiveCounts.items === 'function') return window.ibaLiveCounts.items(); } catch (_) {}
        return null;
    }
    function statusOptions() {
        const s = $('im-status');
        if (!s) return [];
        return Array.from(s.options).map((o) => o.value).filter(Boolean);
    }
    function people() {
        try { if (typeof ibaAllAttentionNames === 'function') return ibaAllAttentionNames(); } catch (_) {}
        return [];
    }
    function resolvePerson(q) {
        const query = norm(q);
        if (!query) return { name: '', matches: [] };
        const list = people();
        const exact = list.filter((p) => norm(p.value) === query);
        if (exact.length) return { name: exact[0].value, matches: exact };
        const starts = list.filter((p) => norm(p.value).startsWith(query) || norm(p.value).split(/\s+/).some((w) => w === query));
        if (starts.length === 1) return { name: starts[0].value, matches: starts };
        const has = starts.length ? starts : list.filter((p) => norm(p.value).includes(query) || norm(p.position).includes(query));
        if (has.length === 1) return { name: has[0].value, matches: has };
        return { name: '', matches: has.slice(0, 6) };
    }
    function cleanPO(v) {
        const po = String(v == null ? '' : v).trim().toUpperCase().replace(/^PO[\s#:-]*/i, '');
        return /^[A-Z0-9_-]{1,30}$/.test(po) ? po : '';
    }
    async function poBase(po) {
        try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await withTimeout(ensureInvoicePOBaseDataFetched(false), 9000, 'PO list'); } catch (_) {}
        try { if (typeof allPOData !== 'undefined' && allPOData) return allPOData[po] || null; } catch (_) {}
        return null;
    }
    async function poInvoices(po) {
        try {
            if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po]) return allInvoiceData[po];
        } catch (_) {}
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !idb.ref) return {};
        const snap = await withTimeout(idb.ref('invoice_entries/' + po).once('value'), 9000, 'PO invoices');
        return (snap && snap.val()) || {};
    }
    function rowWaitDays(r) { return daysSince(r.at); }

    // ------------------------------------------------------------------
    // Tools (what the brain may ask the system to do)
    // ------------------------------------------------------------------
    function toolDefs() {
        const statuses = statusOptions();
        const statusProp = statuses.length ? { type: 'string', enum: statuses } : { type: 'string' };
        return [
            { name: 'get_brief', description: 'What is waiting for the user now: Active Task (invoices and WorkDesk jobs addressed to them), Active Job (inventory requests at their step), the oldest items, and PO Close Out counts.',
              parameters: { type: 'object', properties: {} } },
            { name: 'list_my_tasks', description: "List the user's waiting items, oldest first, with an optional filter.",
              parameters: { type: 'object', properties: {
                  text: { type: 'string', description: 'Words to match in PO, invoice no., vendor, site, status or note' },
                  kind: { type: 'string', enum: ['any', 'invoice', 'job', 'inventory'] },
                  limit: { type: 'integer', description: '1 to 30, default 15' } } } },
            { name: 'find_po', description: 'Look up one PO: vendor, site, PO value, its invoices (no., value, status, attention, note), total invoiced and remaining.',
              parameters: { type: 'object', properties: { po: { type: 'string', description: 'PO number' } }, required: ['po'] } },
            { name: 'open_po', description: 'Open a PO on the Invoice Entry page so the user sees it. Changes nothing.',
              parameters: { type: 'object', properties: { po: { type: 'string' } }, required: ['po'] } },
            { name: 'fill_invoice_form', description: 'Prepare a NEW invoice for a PO: opens the PO and the Invoice Entry form and fills it. It never saves; the user checks and presses Add.',
              parameters: { type: 'object', properties: {
                  po: { type: 'string' },
                  invoice_no: { type: 'string' },
                  value: { type: 'number', description: 'Invoice value in QAR' },
                  amount_paid: { type: 'number' },
                  invoice_date: { type: 'string', description: 'YYYY-MM-DD; leave out for today' },
                  status: statusProp,
                  attention: { type: 'string', description: 'Person name (first name is fine)' },
                  note: { type: 'string' },
                  details: { type: 'string' } }, required: ['po'] } },
            { name: 'add_to_batch', description: 'Put the existing invoices of one or more POs into Batch Entry so the user can update them together (status, attention, note) and save once. Optional status filter, e.g. "CEO Approval" = only invoices now in that status. Can also fill the Batch Entry "Set All" status / attention / note when the user says what to change. Never saves: the user checks the rows and presses Save.',
              parameters: { type: 'object', properties: {
                  pos: { type: 'array', items: { type: 'string' }, description: 'PO numbers' },
                  status: { type: 'string', description: 'Only invoices whose current status is this (leave out for all invoices of the POs)' },
                  set_status: { type: 'string', description: 'New status for all rows (Set All Statuses To), only if the user asked' },
                  set_attention: { type: 'string', description: 'Person for all rows (Set All Attention To), only if the user asked' },
                  set_note: { type: 'string', description: 'Note for all rows, only if the user asked' } }, required: ['pos'] } },
            { name: 'find_person', description: 'Find people in the system by name, position or site (for Attention or for a message).',
              parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
            { name: 'track_invoices', description: 'Where invoices are now and who has them: by PO number, or by vendor name with optional site and year. Each invoice shows its stage (Reception, Invoice Entry, SRV, Approval, Accounts, Paid), who has it, since when, and recent steps. When a vendor has many POs it returns counts by year and site instead: then ask the user which year or site.',
              parameters: { type: 'object', properties: {
                  po: { type: 'string', description: 'PO number' },
                  vendor: { type: 'string', description: 'Vendor (supplier) name or part of it' },
                  site: { type: 'string', description: 'Site number, e.g. 177' },
                  year: { type: 'string', description: 'Year, e.g. 2026: matches invoices whose invoice date or paid date is in that year' } } } },
            { name: 'job_records', description: 'WorkDesk Job Records, the intake register (Reception encodes most jobs): Invoice, IPC Application, IPC Processed, PR, Payment, Report, Trip and other types such as PO Revision. Filter by type, period (job date), who entered it (a name, or a role like "reception" or "qs"), who has it now, status, site, vendor or PO. Gives each job and where it is now (open, in Invoice Entry with the live invoice status, or done) plus counts. Use for what was received / entered / encoded, and for open IPC or PR jobs.',
              parameters: { type: 'object', properties: {
                  type: { type: 'string', description: 'invoice, ipc (both IPC types), ipc application, ipc processed, pr, payment, report, trip, another type name, or any' },
                  when: { type: 'string', description: 'Words like "last thursday", "yesterday", "past week", "this month", "september 2026", "2026" (the system works out the dates)' },
                  from: { type: 'string', description: 'YYYY-MM-DD (optional instead of when)' },
                  to: { type: 'string', description: 'YYYY-MM-DD' },
                  entered_by: { type: 'string', description: 'Only if the user names a person or a role: name, or reception / qs / accounting / procurement / dc' },
                  with: { type: 'string', description: 'Who has the job now (Attention): name or role' },
                  status: { type: 'string', description: 'Job status words, e.g. New Entry, Pending, Waiting Invoice, For IPC, IPC Done' },
                  open_only: { type: 'boolean', description: 'Only jobs still open (not done, not yet in Invoice Entry)' },
                  vendor: { type: 'string' }, po: { type: 'string' }, site: { type: 'string' } } } },
            { name: 'invoices_by_status', description: 'Active invoices in Invoice Entry by status, oldest first, with counts per status (e.g. For SRV, For IPC, On Hold, For Approval, CEO Approval, Pending, Report). Without a status it lists all active invoices. Not included: Under Review, SRV Done, With Accounts, Paid.',
              parameters: { type: 'object', properties: {
                  status: { type: 'string' }, site: { type: 'string' }, vendor: { type: 'string' },
                  with: { type: 'string', description: 'Who has it (Attention): name or role' } } } },
            { name: 'invoice_activity', description: 'Who handled the invoices of a vendor or a PO and when: the latest actions (status changes and who did them, newest first), the last action, and who has each invoice now. Looks at the newest POs of the vendor. Use for "who last handled", "who managed", "what happened".',
              parameters: { type: 'object', properties: {
                  vendor: { type: 'string' }, po: { type: 'string' },
                  when: { type: 'string', description: 'Optional period words, e.g. "past week", "2026"' },
                  from: { type: 'string' }, to: { type: 'string' },
                  person: { type: 'string', description: 'Only actions by this person' } } } }
        ].filter((t) => isSuper() || SUPER_ONLY.indexOf(t.name) === -1);
    }

    function compactTask(r) {
        const o = { type: r.type || r.kind, po: r.po || undefined, ref: r.ref || undefined, vendor: r.vendor || undefined, site: r.site || undefined,
            status: r.status || undefined, amount: r.amount ? money(r.amount) : undefined, waiting_days: rowWaitDays(r) };
        if (r.note) o.note = String(r.note).slice(0, 80);
        return o;
    }
    function compactJob(j) {
        return { control: j.control, type: j.type, product: j.product, step: j.step, from: j.from || undefined, to: j.to || undefined,
            qty: j.qty || undefined, requestor: j.requestor || undefined, waiting_days: daysSince(j.at) };
    }
    function oldestFirst(a, b) { return (a.at || 9e15) - (b.at || 9e15); }

    async function toolBrief() {
        const w = waiting();
        if (!w || !w.running) return { result: { error: 'The waiting list is not ready yet. Try again in a few seconds.' } };
        const tasks = w.tasks.slice().sort(oldestFirst);
        const jobs = w.jobs.slice().sort(oldestFirst);
        const byStatus = {};
        tasks.forEach((t) => { const k = t.status || 'Other'; byStatus[k] = (byStatus[k] || 0) + 1; });
        let closeout = null;
        if (typeof window.poCloseoutCollectRows === 'function') {
            try {
                const rows = await withTimeout(window.poCloseoutCollectRows(), 9000, 'PO Close Out');
                closeout = { waiting_site: rows.filter((r) => r.waitingSite).length, ready_to_close: rows.filter((r) => r.waitingHo).length };
            } catch (_) { closeout = null; }
        }
        const result = {
            active_task: w.counts.task || tasks.length,
            active_job: w.counts.job || jobs.length,
            tasks_by_status: byStatus,
            oldest_tasks: tasks.slice(0, 8).map(compactTask),
            inventory_jobs: jobs.slice(0, 6).map(compactJob),
            inventory_not_loaded: w.jobsNotLoaded || 0,
            po_closeout: closeout || undefined
        };
        return { result: result, card: { kind: 'brief', data: { result: result, tasks: tasks.slice(0, 6), jobs: jobs.slice(0, 4) } } };
    }

    async function toolList(args) {
        const w = waiting();
        if (!w || !w.running) return { result: { error: 'The waiting list is not ready yet.' } };
        const kind = norm(args && args.kind) || 'any';
        const text = norm(args && args.text);
        let limit = Math.round(num(args && args.limit)) || 15;
        limit = Math.max(1, Math.min(30, limit));
        let rows = [];
        if (kind === 'any' || kind === 'invoice' || kind === 'job') rows = rows.concat(w.tasks.filter((t) => kind === 'any' || t.kind === kind));
        if (kind === 'any' || kind === 'inventory') rows = rows.concat(w.jobs);
        if (text) {
            const words = text.split(/\s+/).filter(Boolean);
            rows = rows.filter((r) => {
                const hay = norm([r.po, r.ref, r.vendor, r.site, r.status, r.note, r.control, r.product, r.step, r.from, r.to, r.type].join(' '));
                return words.every((wd) => hay.includes(wd));
            });
        }
        rows.sort(oldestFirst);
        const out = rows.slice(0, limit).map((r) => (r.kind === 'inventory' ? compactJob(r) : compactTask(r)));
        return { result: { total: rows.length, shown: out.length, items: out }, card: { kind: 'list', data: { total: rows.length, rows: rows.slice(0, limit), all: rows, text: text, kind: kind } } };
    }

    function poInvRow(i) {
        return { entry: i.invEntryID || '', invoice_no: i.invNumber || '', value: money(i.invValue),
            invoice_date: fmtDate(i.invoiceDate), status: i.status || '', payment: paymentState(i.status), attention: i.attention || undefined, note: i.note ? String(i.note).slice(0, 60) : undefined };
    }
    async function toolFindPO(args) {
        const po = cleanPO(args && args.po);
        if (!po) return { result: { error: 'That does not look like a PO number.' } };
        const [rec, invMap] = await Promise.all([poBase(po), poInvoices(po).catch(() => ({}))]);
        const invs = Object.keys(invMap || {}).map((k) => Object.assign({ key: k }, invMap[k] || {}))
            .sort((a, b) => String(a.invEntryID || '').localeCompare(String(b.invEntryID || ''), undefined, { numeric: true }));
        const r = rec || {};
        const poValue = num(r.Amount || r['PO Amount'] || r['PO Value']);
        const invoiced = invs.reduce((s, i) => s + num(i.invValue || i.invoiceValue), 0);
        let jobs = [];
        try {
            if (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries)) {
                jobs = workdeskSystemEntries.filter((e) => e && String(e.po || '').toUpperCase() === po && e.source !== 'transfer_entry').slice(0, 5)
                    .map((e) => ({ for: e.for || '', ref: e.ref || '', status: e.remarks || e.status || '', attention: e.attention || '', date: fmtDate(e.date || e.timestamp) }));
            }
        } catch (_) {}
        const found = !!rec || invs.length > 0;
        const result = {
            po: po, found: found,
            vendor: r['Supplier Name'] || r['Supplier Name:'] || r.Supplier || (invs[0] && invs[0].vendorName) || '',
            site: r['Project ID'] || r.Project || '',
            po_value: poValue ? money(poValue) : undefined,
            invoiced_total: money(invoiced),
            remaining: poValue ? money(poValue - invoiced) : undefined,
            paid_total: money(invs.filter((i) => norm(i.status) === 'paid').reduce((x, i) => x + num(i.invValue || i.invoiceValue), 0)),
            with_accounts_total: money(invs.filter((i) => norm(i.status) === 'with accounts').reduce((x, i) => x + num(i.invValue || i.invoiceValue), 0)),
            invoices: invs.slice(0, 25).map(poInvRow),
            more_invoices: invs.length > 25 ? invs.length - 25 : undefined,
            workdesk_jobs: jobs.length ? jobs : undefined
        };
        if (!found) result.note = 'No PO record and no invoices found for this number.';
        return { result: result, card: { kind: 'po', data: Object.assign({}, result, { all_invoices: invs.map(poInvRow) }) } };
    }

    async function openPO(po) {
        if (typeof window.ibaOpenShellPage === 'function') window.ibaOpenShellPage('im-invoice-entry');
        await wait(450);
        const top = $('im-po-search-input');
        if (top) top.value = po;
        if (typeof handlePOSearch === 'function') {
            try { await withTimeout(Promise.resolve(handlePOSearch(po)), 15000, 'Search PO'); } catch (_) {}
        }
        // the page finishes loading the PO a moment after the search returns
        for (let i = 0; i < 40; i++) {
            let cur = '';
            try { cur = String(currentPO || ''); } catch (_) {}
            if (norm(cur) === norm(po)) return true;
            await wait(200);
        }
        return false;
    }

    async function toolOpenPO(args) {
        const po = cleanPO(args && args.po);
        if (!po) return { result: { error: 'That does not look like a PO number.' } };
        const ok = await openPO(po);
        return { result: { opened: ok, po: po, note: ok ? 'Shown on Invoice Entry. Nothing was changed.' : 'Could not open this PO.' },
                 card: { kind: 'action', data: { ok: ok, icon: 'fa-folder-open', text: ok ? 'Opened PO ' + po + ' on Invoice Entry' : 'Could not open PO ' + po }, minimize: ok } };
    }

    function setField(id, value) {
        const el = $(id);
        if (!el || value === undefined || value === null || value === '') return false;
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    async function toolFill(args) {
        const a = args || {};
        const po = cleanPO(a.po);
        if (!po) return { result: { error: 'A PO number is needed.' } };
        const warnings = [];
        let cur = '';
        try { cur = String(currentPO || ''); } catch (_) {}
        if (norm(cur) !== norm(po)) {
            const ok = await openPO(po);
            if (!ok) return { result: { error: 'PO ' + po + ' could not be opened on Invoice Entry.' } };
        } else if (typeof window.ibaOpenShellPage === 'function' && window.__ibaNavKey !== 'im-invoice-entry') {
            window.ibaOpenShellPage('im-invoice-entry');
            await wait(400);
        }
        const modal = $('im-invoice-entry-modal');
        if (modal && modal.classList.contains('hidden') && typeof openIMInvoiceEntryModal === 'function') {
            openIMInvoiceEntryModal();
            await wait(350);
        }
        // always a NEW invoice: an invoice open for editing is put back to New (nothing is saved)
        let editing = null;
        try { editing = currentlyEditingInvoiceKey; } catch (_) {}
        if (editing && typeof resetInvoiceForm === 'function') {
            try { resetInvoiceForm(); } catch (_) {}
            warnings.push('An invoice was open for editing; the form was switched to a new invoice (nothing saved).');
            await wait(300);
        }
        const filled = {};
        if (a.invoice_no && setField('im-inv-no', String(a.invoice_no).trim())) filled.invoice_no = String(a.invoice_no).trim();
        if (a.value !== undefined && a.value !== null && a.value !== '' && setField('im-inv-value', num(a.value).toFixed(2))) filled.value = money(a.value);
        if (a.amount_paid !== undefined && a.amount_paid !== null && a.amount_paid !== '' && setField('im-amount-paid', num(a.amount_paid).toFixed(2))) filled.amount_paid = money(a.amount_paid);
        // no date given: the form keeps its own default (today)
        const date = String(a.invoice_date || '').trim();
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) { if (setField('im-invoice-date', date)) filled.invoice_date = fmtDate(date); }
        else if (date) warnings.push('Invoice date "' + date + '" was not understood; the form date was kept.');
        if (a.status) {
            const st = statusOptions().find((s) => norm(s) === norm(a.status));
            if (st) {
                if (typeof window.imApplyQuickStatus === 'function') window.imApplyQuickStatus(st);
                else setField('im-status', st);
                filled.status = st;
                await wait(700); // let the status pick its usual Attention first
            } else warnings.push('Status "' + a.status + '" is not in the list; left as it was.');
        }
        if (a.attention) {
            const who = resolvePerson(a.attention);
            if (who.name) {
                try { if (typeof window.ibaWriteAttention === 'function') window.ibaWriteAttention(who.name); } catch (_) {}
                try { if (window.ibaAttentionPicker && typeof window.ibaAttentionPicker.paintBox === 'function') window.ibaAttentionPicker.paintBox(); } catch (_) {}
                filled.attention = who.name;
            } else if (who.matches.length) {
                warnings.push('Attention "' + a.attention + '" matches several people: ' + who.matches.map((p) => p.value).join(', ') + '. Please pick one in the form.');
            } else warnings.push('No person called "' + a.attention + '" was found; Attention left as it was.');
        }
        if (a.note && setField('im-note', String(a.note))) filled.note = String(a.note);
        if (a.details && setField('im-details', String(a.details))) filled.details = String(a.details);
        // same invoice number already on this PO?
        try {
            const bucket = (typeof allInvoiceData !== 'undefined' && allInvoiceData) ? (allInvoiceData[po] || {}) : {};
            const dup = filled.invoice_no && Object.values(bucket).some((i) => norm(i && i.invNumber) === norm(filled.invoice_no));
            if (dup) warnings.push('Invoice No. ' + filled.invoice_no + ' already exists on PO ' + po + '. The system will refuse a duplicate.');
        } catch (_) {}
        const addBtn = $('im-add-invoice-button');
        if (addBtn) {
            addBtn.classList.add('iba-ai-pulse');
            setTimeout(() => addBtn.classList.remove('iba-ai-pulse'), 9000);
        }
        const result = { po: po, filled: filled, warnings: warnings.length ? warnings : undefined, saved: false,
            next: 'Not saved. The user must check the form and press Add.' };
        return { result: result, card: { kind: 'form', data: result }, minimize: true };
    }

    async function toolPerson(args) {
        const q = norm(args && args.query);
        if (!q) return { result: { error: 'Who should I look for?' } };
        const list = people().filter((p) => norm([p.value, p.position, p.site].join(' ')).includes(q)).slice(0, 8)
            .map((p) => ({ name: p.value, position: p.position || undefined, site: p.site || undefined }));
        return { result: { found: list.length, people: list }, card: { kind: 'people', data: list } };
    }


    // ------------------------------------------------------------------
    // Track an invoice (patch 13) - no AI needed
    // ------------------------------------------------------------------
    const STAGES = ['Reception', 'Invoice Entry', 'SRV', 'Approval', 'Accounts', 'Paid'];
    const STAGE_OF = {
        'under review': 1, 'in process': 1, 'for summary': 1,
        'for srv': 2, 'srv done': 2, 'no need srv': 2,
        'for approval': 3, 'ceo approval': 3, 'report': 3, 'report approval': 3, 'report approved': 3,
        'with accounts': 4, 'paid': 5
    };
    const MAX_POS = 10;
    function stageOf(status) { const k = norm(status); return Object.prototype.hasOwnProperty.call(STAGE_OF, k) ? STAGE_OF[k] : -1; }
    function siteNo(v) { return (String(v == null ? '' : v).match(/\d+/) || [''])[0]; }
    function poYear(rec) { const m = String((rec && (rec['Entry Date'] || rec['Order Date'] || rec.Date)) || '').match(/(\d{4})/); return m ? m[1] : ''; }
    function poDateValue(rec) {
        const d = String((rec && (rec['Entry Date'] || rec['Order Date'] || rec.Date)) || '');
        const m = d.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (m) return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        const t = Date.parse(d);
        return Number.isFinite(t) ? t : 0;
    }
    function poMap() { try { return (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {}; } catch (_) { return {}; } }
    async function ensureBase() {
        try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await withTimeout(ensureInvoicePOBaseDataFetched(false), 12000, 'PO list'); } catch (_) {}
    }
    // patch 16: Job Records are read by the assistant itself. The screen's job list can
    // hold only the few jobs touched on this page (e.g. after saving an invoice in
    // Invoice Entry), so it is used only right after a full load.
    const JOB_TTL = 5 * 60 * 1000;
    const jobStore = { all: null, at: 0, q: {} };
    const IDX_KEY = 'iba-ai-jobidx-v1';
    function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : null; } catch (_) { return null; } }
    function snapList(snap) { const v = (snap && typeof snap.val === 'function' && snap.val()) || {}; return Object.keys(v).map((k) => Object.assign({ key: k }, v[k] || {})); }
    function screenJobsIfFull() {
        try {
            const at = Number(window.__wdLastAllEntriesFullFetchAt || 0);
            if (at && Date.now() - at < JOB_TTL && typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries) && workdeskSystemEntries.length) {
                return workdeskSystemEntries.filter((e) => e && e.source !== 'transfer_entry');
            }
        } catch (_) {}
        return null;
    }
    // Does Firebase have the index for this field? (asked once a day until it is there)
    async function jobIndexed(field) {
        let memo = {};
        try { memo = JSON.parse(localStorage.getItem(IDX_KEY) || '{}') || {}; } catch (_) { memo = {}; }
        const m = memo[field];
        if (m && Date.now() - m.at < (m.ok ? 7 : 1) * 864e5) return !!m.ok;
        const d = mainDb();
        let base = '';
        try { base = String((d && d.app && d.app.options && d.app.options.databaseURL) || '').replace(/\/$/, ''); } catch (_) {}
        if (!base || typeof fetch !== 'function') return false;
        let ok = null;
        try {
            const res = await withTimeout(fetch(base + '/job_entries.json?orderBy=' + encodeURIComponent('"' + field + '"') + '&limitToFirst=1', { cache: 'no-store' }), 6000, 'index check');
            if (res.ok) ok = true;
            else if (res.status === 400) { let t = ''; try { t = await res.text(); } catch (_) {} if (/index/i.test(t)) ok = false; }
        } catch (_) {}
        if (ok === null) return false; // offline / rules: do not remember, use the safe path
        memo[field] = { ok: ok, at: Date.now() };
        try { localStorage.setItem(IDX_KEY, JSON.stringify(memo)); } catch (_) {}
        return ok;
    }
    async function jobsAll() {
        const s = screenJobsIfFull();
        if (s) return s;
        if (jobStore.all && Date.now() - jobStore.at < JOB_TTL) return jobStore.all;
        const d = mainDb();
        if (!d) return [];
        const snap = await withTimeout(d.ref('job_entries').once('value'), 25000, 'job records');
        jobStore.all = snapList(snap); jobStore.at = Date.now();
        return jobStore.all;
    }
    async function jobsQuery(key, field, build) {
        const c = jobStore.q[key];
        if (c && Date.now() - c.at < JOB_TTL) return c.list;
        const d = mainDb();
        if (!d) return [];
        const snap = await withTimeout(build(d.ref('job_entries').orderByChild(field)).once('value'), 15000, 'job records');
        const list = snapList(snap);
        jobStore.q[key] = { list: list, at: Date.now() };
        return list;
    }
    // the smallest read that answers: a date range or POs when Firebase has the index,
    // otherwise the whole Job Records list once (kept 5 minutes)
    async function jobSource(o) {
        const opt = o || {};
        const s = screenJobsIfFull();
        if (s) return s;
        if (jobStore.all && Date.now() - jobStore.at < JOB_TTL) return jobStore.all;
        if (opt.rg && await jobIndexed('timestamp')) {
            const a = Date.parse(opt.rg.from + 'T00:00:00Z') - 2 * 864e5;
            const b = Date.parse(opt.rg.to + 'T23:59:59Z') + 864e5;
            return jobsQuery('t:' + opt.rg.from + ':' + opt.rg.to, 'timestamp', (r) => r.startAt(a).endAt(b));
        }
        const pos = (opt.pos || []).filter(Boolean);
        if (pos.length && pos.length <= 10 && await jobIndexed('po')) {
            const parts = await Promise.all(pos.map((p) => jobsQuery('p:' + p, 'po', (r) => r.equalTo(p)).catch(() => [])));
            return [].concat.apply([], parts);
        }
        return jobsAll();
    }
    async function ensureJobs(pos) { return jobSource({ pos: pos }); }
    function historyList(inv) {
        const h = inv && inv.history;
        const arr = Array.isArray(h) ? h : (h && typeof h === 'object' ? Object.values(h) : []);
        return arr.filter(Boolean).map((x) => ({ status: String(x.status || x.action || '').trim(), by: String(x.updatedBy || x.by || '').trim(),
            at: Number(x.timestamp) || Date.parse(x.date || '') || 0 })).filter((x) => x.status).sort((a, b) => a.at - b.at);
    }
    function trackInvoice(inv, acc) {
        const status = String(inv.status || '').trim() || 'Under Review';
        const hist = historyList(inv);
        let st = stageOf(status);
        let side = '';
        if (st < 0) {
            side = status;
            for (let i = hist.length - 1; i >= 0; i--) { const x = stageOf(hist[i].status); if (x >= 0) { st = x; break; } }
            if (st < 0) st = 1;
        }
        let since = 0;
        for (let i = hist.length - 1; i >= 0; i--) {
            if (norm(hist[i].status) === norm(status)) since = hist[i].at; else if (since) break;
        }
        if (!since) since = Number(inv.lastUpdated || inv.createdAt) || Date.parse(inv.invoiceDate || '') || 0;
        let holder = String(inv.attention || '').trim();
        if (!holder && st === 4) holder = 'Accounts';
        const lastOf = (name) => { for (let i = hist.length - 1; i >= 0; i--) if (norm(hist[i].status) === name) return hist[i].at; return 0; };
        const paidAt = lastOf('paid');
        const accAt = lastOf('with accounts');
        const enteredAt = (hist[0] && hist[0].at) || Number(inv.createdAt) || 0;
        return {
            kind: 'invoice', invoice_no: inv.invNumber || inv.invEntryID || '—', status: status, payment: paymentState(status), stage: STAGES[st], stage_index: st,
            side_status: side || undefined, with: (st === 5 && !side) ? undefined : (holder || undefined),
            since: since ? fmtDate(since) : undefined, days: (since && !(st === 5 && !side)) ? daysSince(since) : undefined,
            value: acc.amounts && inv.invValue ? money(inv.invValue) : undefined,
            invoice_date: fmtDate(inv.invoiceDate) || undefined, entered: enteredAt ? fmtDate(enteredAt) : undefined,
            with_accounts_on: accAt ? fmtDate(accAt) : undefined, paid_on: paidAt ? fmtDate(paidAt) : undefined,
            _years: [dayOfISO(inv.invoiceDate), dayOfISO(paidAt), dayOfISO(enteredAt)].filter(Boolean).map((d) => d.slice(0, 4)),
            steps: hist.slice(-6).map((h) => ({ status: h.status, by: h.by || undefined, date: fmtDate(h.at) }))
        };
    }
    function receptionItems(jobs, po, acc) {
        return (jobs || []).filter((e) => {
            if (!e || String(e.po || '').trim().toUpperCase() !== po || norm(e.for) !== 'invoice') return false;
            if (e.convertedToInvoice || e.archived) return false;
            try { if (typeof isTaskComplete === 'function' && isTaskComplete(e)) return false; } catch (_) {}
            const r = norm(e.remarks || e.status || 'new entry');
            return r === 'new entry' || r === 'pending' || r === '';
        }).map((e) => {
            const at = Number(e.timestamp) || Date.parse(e.date || '') || 0;
            return { kind: 'reception', invoice_no: e.ref || '—', status: 'At Reception (job entry)', payment: 'Not paid yet (not with Accounts)', stage: STAGES[0], stage_index: 0,
                entered: at ? fmtDate(at) : undefined, entered_by: e.enteredBy || undefined, _years: at ? [dayOfISO(at).slice(0, 4)] : [],
                with: e.attention || undefined, since: at ? fmtDate(at) : undefined, days: at ? daysSince(at) : undefined,
                value: acc.amounts && e.amount ? money(e.amount) : undefined, steps: [] };
        });
    }
    function vendorPOs(vendor, map) {
        const words = vendorWords(vendor);
        const scores = {};
        const list = [];
        Object.keys(map || {}).forEach((k) => {
            const r = map[k] || {};
            const raw = String(r['Supplier Name'] || r['Supplier Name:'] || r.Supplier || '');
            const name = vnorm(raw);
            if (!name || !words.length) return;
            const compact = name.replace(/ /g, '');
            const hit = (w) => name.includes(w) || compact.includes(w);
            if (words.every(hit)) { list.push({ po: String(k).toUpperCase(), rec: r }); return; }
            const sc = words.filter((w) => hit(w) || (w.length >= 4 && name.split(' ').some((nw) => nw.startsWith(w.slice(0, 4))))).length;
            if (sc) scores[raw] = Math.max(scores[raw] || 0, sc);
        });
        const sugg = list.length ? [] : Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b)).slice(0, 6);
        return { list: list, sugg: sugg };
    }
    function poInfo(p) {
        const r = p.rec || {};
        return { po: p.po, known: !!p.rec, vendor: String(r['Supplier Name'] || r['Supplier Name:'] || r.Supplier || ''), siteLabel: String(r['Project ID'] || r.Project || ''),
            site: siteNo(r['Project ID'] || r.Project || ''), year: poYear(r), when: poDateValue(r), poValue: num(r.Amount || r['PO Amount'] || r['PO Value']) };
    }
    const VENDOR_SKIP = ['wll', 'llc', 'spc', 'ltd', 'limited', 'co', 'est', 'invoice', 'invoices', 'po', 'pos', 'vendor', 'supplier', 'for', 'of', 'from', 'the', 'and'];
    function vnorm(v) { return norm(v).replace(/&/g, ' and ').replace(/w\.\s*l\.\s*l\.?/g, ' wll ').replace(/[^a-z0-9]+/g, ' ').trim(); }
    function vendorWords(v) { return vnorm(v).split(' ').filter((w) => w.length > 1 && VENDOR_SKIP.indexOf(w) === -1); }
    function countBy(list, key) {
        const out = {};
        list.forEach((p) => { const k = p[key] || 'unknown'; out[k] = (out[k] || 0) + 1; });
        return out;
    }
    async function trackSearch(q) {
        const acc = access();
        const poQ = cleanPO(q && q.po);
        const vendor = String((q && q.vendor) || '').trim();
        const site = siteNo(q && q.site);
        const year = (String((q && q.year) || '').match(/\d{4}/) || [''])[0];
        if (!poQ && !vendor) return { mode: 'error', message: 'Type a PO number or a vendor name.' };
        if (!acc.allSites && !acc.sites.length) return { mode: 'error', message: 'Your account has no site, so there is nothing to show. Ask Irwin to add your site.' };
        await ensureBase();
        const map = poMap();
        let list = [];
        if (poQ) {
            list = [{ po: poQ, rec: map[poQ] || null }];
        } else {
            const vp = vendorPOs(vendor, map);
            list = vp.list;
            if (!list.length && vp.sugg.length) return { mode: 'suggest', message: 'No vendor called "' + vendor + '". Did you mean:', suggestions: vp.sugg, query: { site: site, year: year } };
        }
        list = list.map(poInfo);
        if (poQ) {
            const p = list[0];
            if (!acc.allSites) {
                if (!p.known) return { mode: 'error', message: 'PO ' + poQ + ' is not in the PO list, so its site cannot be checked.' };
                if (acc.sites.indexOf(p.site) === -1) return { mode: 'error', message: 'PO ' + poQ + ' belongs to site ' + (p.site || '?') + '. You can track invoices for your site' + (acc.sites.length > 1 ? 's' : '') + ' only: ' + acc.sites.join(', ') + '.' };
            }
        } else {
            const before = list.length;
            if (!acc.allSites) list = list.filter((p) => acc.sites.indexOf(p.site) !== -1);
            if (!list.length) return { mode: 'none', message: before ? 'This vendor has no POs for your site(s).' : 'No vendor found matching "' + vendor + '".' };
        }
        if (site) list = list.filter((p) => p.site === site);
        // a year matches an invoice whose invoice date OR paid date (or entry) is in that year,
        // so POs from the year before are looked at too
        if (year) list = list.filter((p) => !p.year || p.year === year || p.year === String(Number(year) - 1));
        if (!list.length) return { mode: 'none', message: 'Nothing matches that site / year.' };
        list.sort((a, b) => (b.when || 0) - (a.when || 0));
        const vendorLabel = poQ ? (list[0].vendor || '') : (list[0].vendor || vendor);
        if (!poQ && list.length > MAX_POS && !(site && year)) {
            return { mode: 'summary', vendor: vendorLabel, total: list.length, by_year: countBy(list, 'year'), by_site: countBy(list, 'siteLabel'),
                query: { vendor: vendor, site: site, year: year },
                ask: 'Too many to show at once. Ask which year and/or site.' };
        }
        const shown = list.slice(0, MAX_POS);
        const jobs = await ensureJobs(shown.map((p) => p.po));
        const pos = await Promise.all(shown.map(async (p) => {
            let invMap = {};
            try { invMap = await poInvoices(p.po); } catch (_) { invMap = {}; }
            const invs = Object.keys(invMap || {}).map((k) => invMap[k] || {})
                .sort((a, b) => String(a.invEntryID || '').localeCompare(String(b.invEntryID || ''), undefined, { numeric: true }));
            let items = receptionItems(jobs, p.po, acc).concat(invs.map((inv) => trackInvoice(inv, acc)));
            if (year) items = items.filter((i) => (i._years || []).indexOf(year) !== -1);
            items.forEach((i) => { delete i._years; });
            return { po: p.po, vendor: p.vendor || (invs[0] && invs[0].vendorName) || '', site: p.siteLabel || undefined, year: p.year || undefined,
                po_value: acc.amounts && p.poValue ? money(p.poValue) : undefined, items: items };
        }));
        const posOut = year ? pos.filter((p) => p.items.length || p.year === year) : pos;
        return { mode: 'pos', vendor: vendorLabel, total: year ? posOut.length : list.length, shown: posOut.length, more: list.length > shown.length ? list.length - shown.length : undefined, checked: shown.length,
            year_rule: year ? 'Invoices with invoice date or paid date in ' + year : undefined,
            query: { po: poQ, vendor: vendor, site: site, year: year }, pos: posOut };
    }
    function trackForAI(r) {
        if (r.mode !== 'pos') return r;
        return Object.assign({}, r, { pos: r.pos.map((p) => Object.assign({}, p, { items: p.items.map((i) => Object.assign({}, i, { steps: i.steps && i.steps.length ? i.steps.slice(-3) : undefined })) })) });
    }
    async function toolTrack(args) {
        const r = await trackSearch(args || {});
        return { result: trackForAI(r), card: { kind: 'track', data: r } };
    }


    // ------------------------------------------------------------------
    // patch 15: what Reception received, and who handled a vendor / PO
    // ------------------------------------------------------------------
    function vendorOfJob(e) {
        if (e.vendorName) return String(e.vendorName);
        const r = poMap()[String(e.po || '').toUpperCase()];
        return r ? String(r['Supplier Name'] || r.Supplier || '') : '';
    }
    function periodLabel(rg) { return rg ? (rg.label ? rg.label + ' (' : '') + (rg.from === rg.to ? fmtDate(rg.from) : fmtDate(rg.from) + ' to ' + fmtDate(rg.to)) + (rg.label ? ')' : '') : 'any time'; }
    // ---- 15.0.0: put invoices into Batch Entry (never saves) ----
    function parsePOs(v) {
        const raw = Array.isArray(v) ? v.join(',') : String(v == null ? '' : v);
        const out = [];
        raw.split(/[\s,;|()\[\]]+/).forEach((t) => {
            const po = cleanPO(t);
            if (po && /\d/.test(po) && out.indexOf(po) === -1) out.push(po);
        });
        return out;
    }
    function statusMatch(status, want) {
        const a = norm(status), b = norm(want);
        if (!b) return true;
        return a === b || (b.length >= 3 && a.indexOf(b) !== -1);
    }
    function batchVisible() {
        const sec = $('im-batch-entry');
        return !!(sec && $('im-batch-table-body') && sec.offsetParent !== null && !sec.classList.contains('hidden'));
    }
    async function openBatchEntry() {
        // opening the page empties its table, so only open it when it is not already open
        if (batchVisible()) return true;
        if (typeof window.ibaOpenShellPage === 'function') window.ibaOpenShellPage('im-batch-entry');
        for (let i = 0; i < 60; i++) {
            await wait(150);
            let ready = false;
            try { ready = batchVisible() && typeof imBatchGlobalAttentionChoices !== 'undefined' && !!imBatchGlobalAttentionChoices; } catch (_) { ready = false; }
            if (ready) { await wait(200); return true; }
        }
        return batchVisible();
    }
    function pickOption(selectEl, want) {
        if (!selectEl || !want) return '';
        const opts = Array.from(selectEl.options).map((o) => o.value).filter(Boolean);
        return opts.find((v) => norm(v) === norm(want)) || opts.find((v) => norm(v).indexOf(norm(want)) !== -1) || '';
    }
    async function toolBatch(args) {
        const a = args || {};
        const pos = parsePOs(a.pos || a.po);
        if (!pos.length) return { result: { error: 'Give the PO numbers to put into Batch Entry, e.g. 123, 234.' } };
        if (pos.length > 30) return { result: { error: 'Up to 30 POs at a time, please.' } };
        if (typeof addInvoiceToBatchTable !== 'function') return { result: { error: 'Batch Entry is not available on this page.' } };
        const want = String(a.status || '').trim();
        await ensureBase();
        const map = poMap();
        const lists = await Promise.all(pos.map(async (po) => {
            try { return { po: po, inv: await poInvoices(po) }; } catch (_) { return { po: po, inv: null }; }
        }));
        const found = [];
        const notAdded = [];
        lists.forEach((x) => {
            const inv = x.inv || {};
            const keys = Object.keys(inv);
            if (!keys.length) { notAdded.push({ po: x.po, reason: 'No invoices on this PO' }); return; }
            const pi = poInfo({ po: x.po, rec: map[x.po] || null });
            const match = keys.filter((k) => statusMatch((inv[k] || {}).status, want))
                .sort((p, q) => String((inv[p] || {}).invEntryID || '').localeCompare(String((inv[q] || {}).invEntryID || ''), undefined, { numeric: true }));
            if (!match.length) {
                const has = Array.from(new Set(keys.map((k) => String((inv[k] || {}).status || '').trim() || 'no status')));
                notAdded.push({ po: x.po, reason: 'No invoice in ' + want + ' (now: ' + has.join(', ') + ')' });
                return;
            }
            match.forEach((k) => found.push({ key: k, po: x.po, site: pi.siteLabel || 'N/A', vendor: pi.vendor || 'N/A', inv: inv[k] || {} }));
        });
        const result = { asked: pos, status_filter: want || undefined, added: [], already_in_batch: [], not_added: notAdded, filled: {} };
        if (found.length) {
            if (!(await openBatchEntry())) return { result: { error: 'Batch Entry could not be opened.' } };
            const body = $('im-batch-table-body');
            for (const f of found) {
                const row = { po: f.po, invoice_no: f.inv.invNumber || f.inv.invEntryID || '—', status: f.inv.status || '', with: f.inv.attention || undefined };
                const already = Array.from(body.querySelectorAll('.batch-invoice-card')).some((c) => c.getAttribute('data-key') === f.key);
                if (already) { result.already_in_batch.push(row); continue; }
                // the same data the Batch Entry search window gives
                await addInvoiceToBatchTable(Object.assign({ key: f.key, po: f.po, site: f.site, vendor: f.vendor }, f.inv));
                result.added.push(row);
            }
        }
        // optional: fill the "Set All" boxes (nothing is saved)
        if (found.length && (a.set_status || a.set_attention || a.set_note)) {
            if (a.set_status) {
                const sel = $('im-batch-global-status');
                const v = pickOption(sel, a.set_status);
                if (v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); result.filled.status = v; await wait(900); }
                else result.filled.status_error = 'No status called "' + a.set_status + '" in Batch Entry.';
            }
            if (a.set_attention) {
                const r = resolvePerson(a.set_attention);
                if (r.name) {
                    try {
                        imBatchGlobalAttentionChoices.setChoiceByValue(r.name);
                        $('im-batch-global-attention').dispatchEvent(new Event('change', { bubbles: true }));
                        result.filled.attention = r.name;
                        await wait(500);
                    } catch (_) { result.filled.attention_error = 'Could not set Attention.'; }
                } else result.filled.attention_error = r.matches.length ? 'More than one person matches "' + a.set_attention + '": ' + r.matches.map((m) => m.value).join(', ') : 'Nobody called "' + a.set_attention + '".';
            }
            if (a.set_note) {
                const n = $('im-batch-global-note');
                if (n) { n.value = String(a.set_note); n.dispatchEvent(new Event('blur')); result.filled.note = String(a.set_note); }
            }
        }
        try { if (typeof updateBatchCount === 'function') updateBatchCount(); } catch (_) {}
        if (!Object.keys(result.filled).length) delete result.filled;
        result.saved = false;
        result.next = result.added.length || result.already_in_batch.length
            ? 'Nothing is saved yet. Check the rows in Batch Entry (Set All Status / Attention / Note), then press Save.'
            : 'Nothing was added.';
        const btn = $('im-batch-save-button');
        if (btn && result.added.length) { btn.classList.remove('iba-ai-pulse'); void btn.offsetWidth; btn.classList.add('iba-ai-pulse'); setTimeout(() => btn.classList.remove('iba-ai-pulse'), 6000); }
        return { result: result, card: { kind: 'batch', data: result } };
    }

    // ---- patch 16: every Job Record type, people by name or by role ----
    const ROLE_RE = {
        'reception': /reception/, 'receptionist': /reception/, 'front desk': /reception/,
        'accounting': /accounting|accounts|accountant/, 'accounts': /accounting|accounts|accountant/, 'accountant': /accounting|accounts|accountant/,
        'qs': /\bqs\b|quantity surveyor/, 'quantity surveyor': /\bqs\b|quantity surveyor/, 'senior qs': /senior\s*qs/,
        'procurement': /procurement|purchas/, 'purchasing': /procurement|purchas/, 'logistic': /logistic/, 'logistics': /logistic/,
        'head office dc': /head\s*office/, 'dc': /\bdc\b|document control/, 'site dc': /\bdc\b|document control/, 'document controller': /\bdc\b|document control/,
        'manager': /manager/, 'finance': /finance/
    };
    function roleNames(q) {
        const t0 = norm(q).replace(/^(the|our|all)\s+/, '').replace(/\s+team$/, '').trim();
        const t = ROLE_RE[t0] ? t0 : t0.replace(/s$/, '');
        const re = ROLE_RE[t];
        if (!re) return null;
        let list = people().filter((p) => re.test(norm(p.position)));
        if (t === 'site dc') list = list.filter((p) => !/head\s*office/.test(norm(p.position)));
        return { role: t, names: list.map((p) => p.value) };
    }
    function personFilter(q) {
        const s0 = String(q || '').trim();
        if (!s0) return null;
        const r = roleNames(s0);
        if (r) {
            if (!r.names.length) return { label: s0, none: true, test: () => true };
            const set = r.names.map(norm);
            return { label: r.role.replace(/^./, (c) => c.toUpperCase()) + ' (' + r.names.join(', ') + ')', test: (v) => set.indexOf(norm(v)) !== -1 };
        }
        const n = norm(s0);
        return { label: s0, test: (v) => !!n && norm(v).includes(n) };
    }
    function typeFilter(t0) {
        const t = norm(t0).replace(/\b(jobs?|records?|entries|entry)\b/g, ' ').replace(/\s+/g, ' ').trim().replace(/^invoices$/, 'invoice').replace(/^ipcs$/, 'ipc');
        if (!t || t === 'any' || t === 'all') return null;
        const one = (x) => !!x && (x === t || (t === 'ipc' && x.startsWith('ipc')) || (t.length > 3 && (x.includes(t) || t.includes(x))));
        return (e) => one(norm(e.for)) || (t.startsWith('ipc') && one(norm(e.convertedFromFor)));
    }
    function jobNow(e) {
        if (e.convertedToInvoice || e.linkedInvoiceKey) return { kind: 'moved', text: 'Moved to Invoice Entry', po: String(e.linkedInvoicePO || e.po || '').trim(), key: e.linkedInvoiceKey || '', last: e.linkedInvoiceStatus || e.invoiceWorkflowStatus || '' };
        let done = false;
        try { done = typeof isTaskComplete === 'function' && isTaskComplete(e); } catch (_) {}
        const st = String(e.remarks || e.status || '').trim();
        if (done || e.archived) return { kind: 'done', text: 'Done (' + (st || 'completed') + ')' };
        return { kind: 'open', text: 'Open: ' + (st || 'Pending') + (e.attention ? ' with ' + e.attention : '') };
    }
    async function invoiceNow(po, key) {
        if (!po || !key) return null;
        try {
            if (typeof allInvoiceData !== 'undefined' && allInvoiceData && allInvoiceData[po] && allInvoiceData[po][key]) {
                const i = allInvoiceData[po][key];
                return { status: String(i.status || ''), with: String(i.attention || '') };
            }
        } catch (_) {}
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !idb.ref) return null;
        try {
            const base = 'invoice_entries/' + po + '/' + key + '/';
            const r = await withTimeout(Promise.all([idb.ref(base + 'status').once('value'), idb.ref(base + 'attention').once('value')]), 8000, 'invoice status');
            const st = String((r[0] && r[0].val()) || '');
            return st ? { status: st, with: String((r[1] && r[1].val()) || '') } : null;
        } catch (_) { return null; }
    }
    function shortText(v, n) { const t = String(v || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
    function topCounts(o, n) { const out = {}; Object.keys(o).sort((x, y) => o[y] - o[x]).slice(0, n || 8).forEach((k) => { out[k] = o[k]; }); return out; }
    async function toolJobs(args) {
        const a = args || {};
        const acc = access();
        if (!acc.allSites && !acc.sites.length) return { result: { error: 'Your account has no site.' } };
        const po = cleanPO(a.po);
        const tf = typeFilter(a.type);
        const openOnly = a.open_only === true || norm(a.open_only) === 'true';
        let rg = rangeOf(a);
        if ((a.when || a.from) && !rg) return { result: { error: 'I could not understand the date "' + (a.when || a.from) + '".' } };
        if (!rg && !po && !a.vendor && !a.status && !openOnly && !a.with) rg = parseWhen('past week');
        await ensureBase();
        const list = await jobSource({ rg: rg, pos: po ? [po] : [] });
        const by = personFilter(a.entered_by);
        const withF = personFilter(a.with);
        const vw = vendorWords(a.vendor || '');
        const site = siteNo(a.site);
        const stq = norm(a.status);
        const rows = [];
        (list || []).forEach((e) => {
            if (!e || e.source === 'transfer_entry' || !e.for) return;
            if (tf && !tf(e)) return;
            const day = dayOfISO(e.date) || dayOfISO(e.timestamp);
            if (rg && !inRange(day, rg)) return;
            const es = siteNo(e.site);
            if (!acc.allSites && acc.sites.indexOf(es) === -1) return;
            if (site && es !== site) return;
            if (po && String(e.po || '').trim().toUpperCase() !== po) return;
            if (by && !by.test(e.enteredBy || e.createdBy)) return;
            if (withF && !withF.test(e.attention)) return;
            if (stq && !norm(e.remarks || e.status).includes(stq)) return;
            const n = jobNow(e);
            if (openOnly && n.kind !== 'open') return;
            const vendor = vendorOfJob(e);
            if (vw.length && !vw.every((w) => vnorm(vendor).includes(w) || vnorm(vendor).replace(/ /g, '').includes(w))) return;
            const was = e.convertedFromFor && norm(e.convertedFromFor) !== norm(e.for) ? String(e.convertedFromFor) : '';
            rows.push({ day: day, at: Number(e.timestamp) || 0, n: n, date: fmtDate(day), type: String(e.for) + (was ? ' (was ' + was + ')' : ''), ref: e.ref || undefined,
                po: String(e.po || '') || undefined, vendor: vendor || undefined, site: e.site || undefined, amount: acc.amounts && e.amount ? money(e.amount) : undefined,
                entered_by: e.enteredBy || e.createdBy || undefined, with: e.attention || undefined, status: String(e.remarks || e.status || '') || undefined,
                note: shortText(e.details || e.note, 60) || undefined });
        });
        rows.sort((x, y) => (y.day > x.day ? 1 : y.day < x.day ? -1 : (y.at - x.at)));
        const byType = {}, byPerson = {}, byNow = {};
        rows.forEach((r) => {
            const tk = r.type.replace(/ \(was .*\)$/, '');
            byType[tk] = (byType[tk] || 0) + 1;
            const pk = r.entered_by || 'unknown'; byPerson[pk] = (byPerson[pk] || 0) + 1;
            const nk = r.n.kind === 'open' ? 'Open' : r.n.kind === 'moved' ? 'In Invoice Entry' : 'Done'; byNow[nk] = (byNow[nk] || 0) + 1;
        });
        const shown = rows.slice(0, 30);
        await Promise.all(shown.map(async (r) => {
            if (r.n.kind !== 'moved') { r.now = r.n.text; return; }
            const inv = await invoiceNow(r.n.po, r.n.key);
            const st = (inv && inv.status) || r.n.last;
            r.now = 'In Invoice Entry' + (st ? ': ' + st : '') + (inv && inv.with ? ' with ' + inv.with : '');
            if (st) r.payment = paymentState(st);
        }));
        const items = shown.map((r) => { const o = Object.assign({}, r); delete o.day; delete o.at; delete o.n; return o; });
        const notes = [];
        if (by && by.none) notes.push('Nobody has the position "' + by.label + '" in Approvers, so all people are shown.');
        if (withF && withF.none) notes.push('Nobody has the position "' + withF.label + '" in Approvers, so all people are shown.');
        const result = { period: rg ? periodLabel(rg) : 'any time', from: rg ? rg.from : undefined, to: rg ? rg.to : undefined,
            type: a.type || 'any', entered_by_filter: by && !by.none ? by.label : undefined, with_filter: withF && !withF.none ? withF.label : undefined,
            open_only: openOnly || undefined, total: rows.length, by_type: topCounts(byType), entered_by: topCounts(byPerson), by_now: byNow, shown: items.length, items: items,
            notes: notes.length ? notes : undefined };
        return { result: result, card: { kind: 'jobs', data: Object.assign({}, result, { all: rows }) } };
    }
    // older saved skills still call this name
    async function toolReception(args) { return toolJobs(Object.assign({ type: 'invoice' }, args || {})); }

    // ---- patch 16: active invoices by status (the system's active-invoice list) ----
    const activeStore = { list: null, at: 0 };
    async function activeInvoices() {
        if (activeStore.list && Date.now() - activeStore.at < JOB_TTL) return activeStore.list;
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !idb.ref) return [];
        const snap = await withTimeout(idb.ref('invoice_tasks_by_user/All').once('value'), 20000, 'active invoices');
        activeStore.list = snapList(snap); activeStore.at = Date.now();
        return activeStore.list;
    }
    function tsOf(v) { if (!v) return 0; const n = Number(v); if (Number.isFinite(n) && n > 1e11) return n; const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
    async function toolStatus(args) {
        const a = args || {};
        const acc = access();
        if (!acc.allSites && !acc.sites.length) return { result: { error: 'Your account has no site.' } };
        await ensureBase();
        const map = poMap();
        const list = await activeInvoices();
        const stq = norm(a.status);
        const site = siteNo(a.site);
        const vw = vendorWords(a.vendor || '');
        const withF = personFilter(a.with);
        const byStatus = {};
        const rows = [];
        const seen = {};
        (list || []).forEach((t) => {
            if (!t || !t.po) return;
            const id = String(t.po) + '/' + String(t.invoiceKey || t.key || '');
            if (seen[id]) return; seen[id] = 1;
            const pi = poInfo({ po: String(t.po).toUpperCase(), rec: map[String(t.po).toUpperCase()] || null });
            const es = siteNo(t.site) || pi.site;
            if (!acc.allSites && acc.sites.indexOf(es) === -1) return;
            if (site && es !== site) return;
            const vendor = String(t.vendorName || pi.vendor || '');
            if (vw.length && !vw.every((w) => vnorm(vendor).includes(w) || vnorm(vendor).replace(/ /g, '').includes(w))) return;
            if (withF && !withF.test(t.attention)) return;
            const st = String(t.status || '').trim() || 'Pending';
            byStatus[st] = (byStatus[st] || 0) + 1;
            if (stq && !norm(st).includes(stq)) return;
            const at = tsOf(t.statusQueueAt) || tsOf(t.queueAt) || tsOf(t.statusChangedAt) || tsOf(t.enteredAt) || tsOf(t.createdAt);
            rows.push({ at: at, po: String(t.po), invoice_no: t.ref || undefined, vendor: vendor || undefined, site: String(t.site || pi.siteLabel || '') || undefined,
                status: st, with: t.attention || undefined, since: at ? fmtDate(at) : undefined, days: at ? daysSince(at) : undefined,
                amount: acc.amounts && t.amount ? money(t.amount) : undefined, payment: paymentState(st), note: shortText(t.note, 60) || undefined });
        });
        rows.sort((x, y) => (x.at || 9e15) - (y.at || 9e15));
        const items = rows.slice(0, 30).map((r) => { const o = Object.assign({}, r); delete o.at; return o; });
        const result = { status: a.status || 'all active', total: rows.length, by_status: topCounts(byStatus, 12), shown: items.length, items: items,
            note: 'Active invoices only. Under Review, SRV Done, With Accounts and Paid are not in this list (use track_invoices for those).' };
        return { result: result, card: { kind: 'status', data: Object.assign({}, result, { all: rows }) } };
    }

    async function toolActivity(args) {
        const a = args || {};
        const acc = access();
        if (!acc.allSites && !acc.sites.length) return { result: { error: 'Your account has no site.' } };
        const rg = rangeOf(a);
        const person = norm(a.person);
        await ensureBase();
        const map = poMap();
        const poQ = cleanPO(a.po);
        let list = [];
        let vendorLabel = '';
        if (poQ) list = [poInfo({ po: poQ, rec: map[poQ] || null })];
        else if (String(a.vendor || '').trim()) {
            const vp = vendorPOs(a.vendor, map);
            if (!vp.list.length) return { result: { error: 'No vendor called "' + a.vendor + '".', suggestions: vp.sugg.length ? vp.sugg : undefined }, card: vp.sugg.length ? { kind: 'track', data: { mode: 'suggest', message: 'No vendor called "' + a.vendor + '". Did you mean:', suggestions: vp.sugg, query: {} } } : undefined };
            list = vp.list.map(poInfo);
        } else return { result: { error: 'Give a vendor name or a PO number.' } };
        if (!acc.allSites) {
            if (poQ && (!list[0].known || acc.sites.indexOf(list[0].site) === -1)) return { result: { error: 'PO ' + poQ + ' is not one of your site(s): ' + acc.sites.join(', ') + '.' } };
            list = list.filter((p) => acc.sites.indexOf(p.site) !== -1);
            if (!list.length) return { result: { error: 'This vendor has no POs for your site(s).' } };
        }
        if (rg) {
            const y0 = Number(rg.from.slice(0, 4)) - 1;
            list = list.filter((p) => !p.year || Number(p.year) >= y0);
        }
        list.sort((x, y) => (y.when || 0) - (x.when || 0));
        vendorLabel = (list[0] && list[0].vendor) || String(a.vendor || '');
        const pick = list.slice(0, 5);
        const jobs = await ensureJobs(pick.map((p) => p.po));
        const events = [];
        const now = [];
        await Promise.all(pick.map(async (p) => {
            let invMap = {};
            try { invMap = await poInvoices(p.po); } catch (_) { invMap = {}; }
            Object.keys(invMap || {}).forEach((k) => {
                const inv = invMap[k] || {};
                const no = inv.invNumber || inv.invEntryID || '—';
                historyList(inv).forEach((h) => events.push({ at: h.at, day: dayOfISO(h.at), po: p.po, invoice_no: no, action: h.status, by: h.by || undefined }));
                now.push({ po: p.po, invoice_no: no, status: inv.status || '', payment: paymentState(inv.status), with: inv.attention || undefined });
            });
            (jobs || []).forEach((e) => {
                if (!e || norm(e.for) !== 'invoice' || String(e.po || '').toUpperCase() !== p.po) return;
                const at = Number(e.timestamp) || Date.parse(e.date || '') || 0;
                events.push({ at: at, day: dayOfISO(e.date) || dayOfISO(at), po: p.po, invoice_no: e.ref || '—', action: 'Received at Reception', by: e.enteredBy || undefined });
            });
        }));
        let ev = events.filter((x) => x.at || x.day);
        if (rg) ev = ev.filter((x) => inRange(x.day, rg));
        if (person) ev = ev.filter((x) => norm(x.by).includes(person));
        ev.sort((x, y) => (y.at || 0) - (x.at || 0));
        const out = ev.slice(0, 15).map((x) => ({ date: fmtDate(x.at || x.day), po: x.po, invoice_no: x.invoice_no, action: x.action, by: x.by }));
        const result = { vendor: vendorLabel || undefined, pos_checked: pick.map((p) => p.po + (p.year ? ' (' + p.year + ')' : '')), more_pos: list.length > pick.length ? list.length - pick.length : undefined,
            period: rg ? periodLabel(rg) : undefined, last_action: out[0] || undefined, events: out, now: now.slice(0, 12) };
        if (!out.length) result.note = 'No recorded actions' + (rg ? ' in that period' : '') + (person ? ' by that person' : '') + '.';
        return { result: result, card: { kind: 'activity', data: Object.assign({}, result, { all_events: ev.map((x) => ({ date: fmtDate(x.at || x.day), po: x.po, invoice_no: x.invoice_no, action: x.action, by: x.by })), all_now: now }) } };
    }

    const RUN = {
        get_brief: toolBrief,
        list_my_tasks: toolList,
        find_po: toolFindPO,
        open_po: toolOpenPO,
        fill_invoice_form: toolFill,
        find_person: toolPerson,
        track_invoices: toolTrack,
        reception_received: toolReception,
        job_records: toolJobs,
        add_to_batch: toolBatch,
        invoices_by_status: toolStatus,
        invoice_activity: toolActivity
    };
    const SUPER_ONLY = ['find_po', 'open_po', 'fill_invoice_form', 'add_to_batch'];
    async function runTool(name, args) {
        if (SUPER_ONLY.indexOf(name) !== -1 && !isSuper()) return { result: { error: 'This job is only for the Super Admin.' } };
        const fn = RUN[name];
        if (!fn) return { result: { error: 'Unknown job: ' + name } };
        try { return await fn(args || {}); }
        catch (err) { return { result: { error: String((err && err.message) || err) } }; }
    }

    // ------------------------------------------------------------------
    // The brain (OpenAI-compatible chat API)
    // ------------------------------------------------------------------
    function roleLine() {
        const ppl = people();
        const by = (re) => ppl.filter((p) => re.test(norm(p.position))).map((p) => p.value);
        const reception = by(/reception/);
        const accounting = by(/accounting|accounts/);
        const hodc = by(/head\s*office/);
        const sitedc = by(/\bdc\b|document controller/).filter((n) => hodc.indexOf(n) === -1);
        const qs = by(/\bqs\b|quantity surveyor/);
        const list = (a) => a.length ? (a.length > 6 ? a.slice(0, 6).join(', ') + ' and ' + (a.length - 6) + ' more' : a.join(', ')) : 'none listed';
        return 'People by role: Reception: ' + list(reception) + '. Accounting: ' + list(accounting) + '. Head Office DC: ' + list(hodc) + '. Site DCs: ' + list(sitedc) + '. QS: ' + list(qs) + '. Use find_person for others.';
    }
    function systemPrompt() {
        const a = me() || {};
        const q = qatarParts();
        return [
            'You are the IBA Assistant inside the IBA invoice, WorkDesk and inventory system, a helpful personal assistant for ' + (a.Name || 'the user') +
                (a.Position ? ' (' + a.Position + ')' : '') + '.',
            'Today is ' + WEEKDAYS[qDay().getUTCDay()].replace(/^./, (c) => c.toUpperCase()) + ' ' + fmtDate(todayISO()) + ' in Qatar' + (Number.isFinite(q.h) ? ', about ' + q.h + ':00.' : '.'),
            'How an invoice moves: 1) Reception receives the vendor invoice and records a WorkDesk job entry (New Entry). 2) Accounting registers it in Invoice Entry (Under Review / In Process). 3) The Site DC (Head Office DC for head-office items) confirms delivery: For SRV, then SRV Done. 4) Approvals when needed (For Approval, CEO Approval, Report...). 5) With Accounts = payment in process. 6) Paid. Each invoice keeps a history of who changed its status and when.',
            roleLine(),
            'WorkDesk Job Records are the intake register: Reception encodes the jobs (Invoice, IPC Application, IPC Processed, PR, PO revision and others); QS works the IPC jobs (IPC Application: Pending, For IPC, IPC Done, IPC Issue; IPC Processed: IPC is done and Reception waits for the actual invoice). An invoice job moves to Invoice Entry when Accounting registers it.',
            'Which tool: received / entered / encoded / came in / submitted to Reception -> job_records (do not pass entered_by unless the user names a person or role; the answer already shows who entered each). The user\'s own waiting items (my tasks, with me, assigned to me) -> list_my_tasks. Where an invoice is now and its steps -> track_invoices. Who handled / who last managed -> invoice_activity. Invoices in a status (For SRV, On Hold, For IPC, approvals) -> invoices_by_status. "Invoices for IPC process" -> call job_records with type ipc and open_only true AND invoices_by_status with status For IPC, then answer in two groups (IPC jobs still in WorkDesk / invoices in Invoice Entry waiting for IPC).',
            'For dates, pass the user\'s words in the "when" field (e.g. "last thursday", "past week", "2026"); the system works out the exact dates.',
            'Be warm, brief and practical. Reply in the language the user writes in.',
            'Use the tools for any fact about POs, invoices, tasks, inventory or people. Never guess numbers, names or statuses.',
            'Money is QAR with 2 decimals. Dates look like 08-Oct-2026.',
            'PAYMENT RULE: an invoice is paid ONLY when its status is "Paid". Status "With Accounts" means payment is in process (Accounts will pay). Every other status (SRV Done, For SRV, approvals, On Hold, ...) means NOT paid yet. "Invoiced" means invoices received, not paid. Always use the payment field; never say paid otherwise.',
            'When the user names a vendor, supplier or company (with or without a PO), call track_invoices with vendor (and site / year if given). If it returns suggestions, ask which vendor they mean.',
            'You cannot save, approve, delete or send anything. To prepare a new invoice use fill_invoice_form, then tell the user to check the form and press Add.',
            isSuper() ? 'To update several invoices at once use Batch Entry: add_to_batch with the PO numbers (status filter when the user names the current status, e.g. "the CEO Approval ones"; set_status / set_attention / set_note only when the user says what to change). Then tell the user to check the rows and press Save. You can use Batch Entry; never say you cannot.' : '',
            'For a message or reminder, write it ready to copy: short, polite, with the PO/invoice facts from the tools. Do not invent phone numbers or emails.',
            'If something is not found, say so plainly and suggest the next step.',
            'To answer where an invoice is, who has it or what happened to it, use track_invoices. If it returns counts by year and site, ask the user to choose before going further.',
            isSuper() ? '' : 'This user can only look things up: never offer to create, change or open invoices for them.'
        ].filter(Boolean).join('\n');
    }

    async function callBrain(messages, withTools, opts) {
        const c = getCfg();
        if (!ready()) throw Object.assign(new Error('The assistant is not set up yet.'), { setup: true });
        const body = { model: c.model, messages: messages, temperature: 0.3, max_tokens: 1200 };
        if (withTools) { body.tools = toolDefs().map((t) => ({ type: 'function', function: t })); body.tool_choice = 'auto'; }
        if (c.brain === 'groq' && /gpt-oss/i.test(c.model) && !(opts && opts.noReasoningEffort)) body.reasoning_effort = 'low';
        const headers = { 'Content-Type': 'application/json' };
        if (c.key) headers.Authorization = 'Bearer ' + c.key;
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 60000) : 0;
        let res;
        try {
            res = await fetch(c.baseUrl + '/chat/completions', { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
        } catch (err) {
            throw Object.assign(new Error(c.brain === 'ollama'
                ? 'Could not reach Ollama on this PC. Is it running, and allowed for this site (OLLAMA_ORIGINS)?'
                : 'Could not reach ' + BRAINS[c.brain].label + '. Check the internet connection. If it keeps failing while the internet works, the service may be refusing calls from a web page; a small free relay can be added for that.'), { network: true });
        } finally { if (timer) clearTimeout(timer); }
        let data = null;
        let text = '';
        try { text = await res.text(); data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        if (!res.ok) {
            const msg = (data && data.error && (data.error.message || data.error)) || text || ('HTTP ' + res.status);
            if (res.status === 400 && body.reasoning_effort && /reasoning/i.test(String(msg))) return callBrain(messages, withTools, { noReasoningEffort: true });
            if (res.status === 429) {
                const ra = Number(res.headers.get('retry-after')) || 0;
                throw Object.assign(new Error('The free limit is used up for now.'), { rate: true, retryAfter: ra });
            }
            if (res.status === 401 || res.status === 403) throw Object.assign(new Error('The key was not accepted. Check it in Setup.'), { setup: true });
            if (res.status === 404) throw Object.assign(new Error('Model "' + c.model + '" was not found. Check the model name in Setup.'), { setup: true });
            throw new Error(String(msg).slice(0, 300));
        }
        const choice = data && data.choices && data.choices[0];
        if (!choice || !choice.message) throw new Error('The AI sent an empty answer.');
        return choice.message;
    }

    // ------------------------------------------------------------------
    // Conversation
    // ------------------------------------------------------------------
    const state = { history: [], busy: false, lastTurn: null, view: 'chat', built: false };
    let typingEl = null;

    async function ask(userText, opts) {
        const text = String(userText || '').trim();
        if (!text || state.busy) return;
        if (!ready()) {
            addUser(text);
            addNote(isSuper() ? 'Let\'s set me up first: it takes 2 minutes and is free.' : 'To ask in plain words, add your own free key in Setup (2 minutes). Tracking an invoice works without it.', 'setup');
            showView('setup');
            return;
        }
        state.busy = true;
        setBusy(true);
        if (!(opts && opts.silentUser)) addUser(text);
        const steps = [];
        let minimize = false;
        const msgs = [{ role: 'system', content: systemPrompt() }].concat(state.history.slice(-HISTORY_KEEP), [{ role: 'user', content: text }]);
        try {
            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                const m = await callWithRetry(msgs, round < MAX_TOOL_ROUNDS);
                const calls = Array.isArray(m.tool_calls) ? m.tool_calls.filter((tc) => tc && tc.function && tc.function.name) : [];
                if (calls.length && round < MAX_TOOL_ROUNDS) {
                    msgs.push({ role: 'assistant', content: m.content || '', tool_calls: calls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments || '{}' } })) });
                    for (const tc of calls) {
                        let args = {};
                        try { args = JSON.parse(tc.function.arguments || '{}') || {}; } catch (_) { args = {}; }
                        const out = await runTool(tc.function.name, args);
                        steps.push({ tool: tc.function.name, args: args });
                        if (out.card) addCard(out.card);
                        if (out.minimize) minimize = true;
                        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out.result || {}).slice(0, 6000) });
                    }
                    continue;
                }
                const answer = String(m.content || '').trim() || (steps.length ? 'Done.' : '…');
                state.lastTurn = { prompt: text, steps: steps.slice(), answer: answer };
                addBot(answer, { canSave: steps.length > 0, prompt: text, steps: steps.slice() });
                state.history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
                if (state.history.length > 2 * HISTORY_KEEP) state.history = state.history.slice(-2 * HISTORY_KEEP);
                if (minimize) peek(answer);
                break;
            }
        } catch (err) {
            addError(err);
        } finally {
            state.busy = false;
            setBusy(false);
        }
    }

    async function callWithRetry(msgs, withTools) {
        try { return await callBrain(msgs, withTools); }
        catch (err) {
            if (err && err.rate) {
                const s = Math.min(30, Math.max(3, err.retryAfter || 8));
                const note = addNote('The free limit is used up for this minute. Trying again in ' + s + ' s…', 'wait');
                await wait(s * 1000);
                if (note && note.parentNode) note.parentNode.removeChild(note);
                return callBrain(msgs, withTools);
            }
            throw err;
        }
    }

    // ------------------------------------------------------------------
    // Skills: replay saved steps without the AI
    // ------------------------------------------------------------------
    function skillsKey() { return SKILLS_KEY + ':' + userSlug(); }
    function skills() {
        let s = lsGet(skillsKey(), null);
        if (!s && isSuper()) {
            const old = lsGet(SKILLS_KEY, null);
            if (Array.isArray(old)) { lsSet(skillsKey(), old); try { localStorage.removeItem(SKILLS_KEY); } catch (_) {} s = old; }
        }
        return Array.isArray(s) ? s : [];
    }
    function saveSkills(list) { lsSet(skillsKey(), list); syncSkillsUp(list); }
    function skillsRef() {
        try {
            if (typeof db === 'undefined' || !db || !db.ref) return null;
            const key = String(myName() || '').replace(/[.#$[\]\/\\]/g, '_').replace(/\s+/g, '_');
            return key ? db.ref('iba_assistant/' + key + '/skills') : null;
        } catch (_) { return null; }
    }
    function syncSkillsUp(list) {
        const ref = skillsRef();
        if (!ref) return;
        try { ref.set(list.length ? list : null).catch(() => {}); } catch (_) {}
    }
    let skillsPulled = false;
    function syncSkillsDown() {
        if (skillsPulled) return;
        skillsPulled = true;
        const ref = skillsRef();
        if (!ref) return;
        try {
            withTimeout(ref.once('value'), 8000, 'skills').then((snap) => {
                const remote = snap && snap.val();
                if (!Array.isArray(remote)) return;
                const local = skills();
                const byName = new Map(local.map((s) => [norm(s.name), s]));
                remote.forEach((s) => { if (s && s.name && !byName.has(norm(s.name))) byName.set(norm(s.name), s); });
                lsSet(skillsKey(), Array.from(byName.values()));
                if (state.view === 'skills') renderSkills();
            }).catch(() => {});
        } catch (_) {}
    }
    function addSkill(name, prompt, steps) {
        const clean = String(name || '').trim().slice(0, 60);
        if (!clean || !steps.length) return false;
        const list = skills().filter((s) => norm(s.name) !== norm(clean));
        list.unshift({ name: clean, prompt: String(prompt || '').slice(0, 400), steps: steps.slice(0, 12), at: Date.now() });
        saveSkills(list.slice(0, 40));
        return true;
    }
    async function runSkill(name) {
        const sk = skills().find((s) => norm(s.name) === norm(name));
        if (!sk || state.busy) return;
        showView('chat');
        addUser('▶ ' + sk.name, true);
        state.busy = true;
        setBusy(true);
        let minimize = false;
        try {
            for (const step of sk.steps) {
                const out = await runTool(step.tool, step.args);
                if (out.card) addCard(out.card);
                else if (out.result && out.result.error) addError(new Error(out.result.error));
                if (out.minimize) minimize = true;
            }
            const done = addBot('Done — "' + sk.name + '" ran without the AI (no quota used).', { again: sk.prompt });
            if (minimize) peek('Skill "' + sk.name + '" done.');
            return done;
        } finally {
            state.busy = false;
            setBusy(false);
        }
    }

    // ------------------------------------------------------------------
    // Screen
    // ------------------------------------------------------------------
    function build() {
        if (state.built) return;
        state.built = true;
        const fab = document.createElement('button');
        fab.type = 'button';
        fab.id = 'iba-ai-fab';
        fab.className = 'iba-ai-fab';
        fab.title = 'IBA Assistant';
        fab.setAttribute('aria-label', 'Open the IBA Assistant');
        fab.hidden = true;
        fab.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span class="iba-ai-fab-dot" aria-hidden="true"></span>';
        document.body.appendChild(fab);

        const bubble = document.createElement('div');
        bubble.id = 'iba-ai-bubble';
        bubble.className = 'iba-ai-bubble';
        bubble.hidden = true;
        bubble.setAttribute('role', 'status');
        document.body.appendChild(bubble);

        const panel = document.createElement('section');
        panel.id = 'iba-ai-panel';
        panel.className = 'iba-ai-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'IBA Assistant');
        panel.innerHTML =
            '<header class="iba-ai-head">' +
              '<span class="iba-ai-mark" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span>' +
              '<div class="iba-ai-title"><strong>IBA Assistant</strong><small id="iba-ai-brain"></small></div>' +
              '<button type="button" class="iba-ai-icon" data-ai="track" title="Track an invoice"><i class="fa-solid fa-route"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="skills" title="Skills"><i class="fa-solid fa-bolt"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="setup" title="Setup"><i class="fa-solid fa-gear"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="new" title="New chat"><i class="fa-solid fa-rotate-left"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="close" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>' +
            '</header>' +
            '<div class="iba-ai-view" data-view="chat"><div class="iba-ai-log" id="iba-ai-log" aria-live="polite"></div></div>' +
            '<div class="iba-ai-view" data-view="skills" hidden><div class="iba-ai-pane" id="iba-ai-skills"></div></div>' +
            '<div class="iba-ai-view" data-view="setup" hidden><div class="iba-ai-pane" id="iba-ai-setup"></div></div>' +
            '<div class="iba-ai-view" data-view="track" hidden><div class="iba-ai-pane" id="iba-ai-track">' +
              '<h3><i class="fa-solid fa-route"></i> Track an invoice</h3>' +
              '<p class="iba-ai-help">Type a PO number, or a vendor name. Add a site or year to narrow it down. This does not use the AI.</p>' +
              '<form class="iba-ai-track-form" id="iba-ai-track-form" autocomplete="off">' +
                '<input id="iba-ai-track-q" type="text" placeholder="PO number or vendor"/>' +
                '<input id="iba-ai-track-site" type="text" inputmode="numeric" placeholder="Site"/>' +
                '<input id="iba-ai-track-year" type="text" inputmode="numeric" placeholder="Year"/>' +
                '<button type="submit" class="iba-ai-btn is-main"><i class="fa-solid fa-magnifying-glass"></i> Track</button>' +
              '</form>' +
              '<div class="iba-ai-track-out" id="iba-ai-track-out"></div>' +
            '</div></div>' +
            '<div class="iba-ai-chips" id="iba-ai-chips">' +
              '<button type="button" data-chip="What is waiting for me?"><i class="fa-solid fa-sun"></i> What\'s waiting?</button>' +
              '<button type="button" data-view-go="track"><i class="fa-solid fa-route"></i> Track invoice</button>' +
              '<button type="button" data-chip-fill="Show PO " data-super-only><i class="fa-solid fa-magnifying-glass"></i> Find PO</button>' +
              '<button type="button" data-chip-fill="New invoice for PO " data-super-only><i class="fa-solid fa-file-circle-plus"></i> New invoice</button>' +
              '<button type="button" data-chip-fill="Draft a reminder to "><i class="fa-solid fa-pen-nib"></i> Draft a message</button>' +
            '</div>' +
            '<form class="iba-ai-input" id="iba-ai-form" autocomplete="off">' +
              '<textarea id="iba-ai-text" rows="1" placeholder="Ask, or tell me what to do…"></textarea>' +
              '<button type="submit" id="iba-ai-send" title="Send (Enter)"><i class="fa-solid fa-paper-plane"></i></button>' +
            '</form>';
        document.body.appendChild(panel);

        fab.addEventListener('click', () => toggle(true));
        panel.addEventListener('click', onPanelClick);
        $('iba-ai-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const t = $('iba-ai-text');
            if (state.busy || !t.value.trim()) return; // keep the text until the last answer is in
            const v = t.value;
            t.value = '';
            autoSize(t);
            ask(v);
        });
        $('iba-ai-track-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const q = String($('iba-ai-track-q').value || '').trim();
            const looksPO = /\d/.test(q) && /^\s*(po[\s#:-]*)?[a-z0-9_-]+\s*$/i.test(q);
            runTrack({ po: looksPO ? q : '', vendor: looksPO ? '' : q, site: $('iba-ai-track-site').value, year: $('iba-ai-track-year').value }, $('iba-ai-track-out'));
        });
        const ta = $('iba-ai-text');
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('iba-ai-form').requestSubmit ? $('iba-ai-form').requestSubmit() : $('iba-ai-form').dispatchEvent(new Event('submit', { cancelable: true })); }
        });
        ta.addEventListener('input', () => autoSize(ta));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !panel.hidden && !document.querySelector('.modal-overlay:not(.hidden) .modal-container:focus-within')) toggle(false);
        });
        bubble.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.bubble === 'open') {
                hideBubble();
                toggle(true);
                if (b.dataset.then === 'brief') { showView('chat'); runDirect('get_brief', {}); }
                if (b.dataset.then === 'setup') showView('setup');
                if (b.dataset.then === 'track') showView('track');
            }
            else hideBubble();
        });
        greetIfEmpty();
    }

    function autoSize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }

    function toggle(open) {
        const p = $('iba-ai-panel');
        if (!p) return;
        p.hidden = !open;
        $('iba-ai-fab').classList.toggle('is-open', !!open);
        if (open) {
            hideBubble();
            $('iba-ai-brain').textContent = ready() ? brainLabel() : 'Not set up yet';
            syncSkillsDown();
            document.querySelectorAll('#iba-ai-panel [data-super-only]').forEach((el) => { el.hidden = !isSuper(); });
            if (!ready() && state.view === 'chat' && !$('iba-ai-log').querySelector('.is-user')) showView(isSuper() ? 'setup' : 'track');
            setTimeout(() => { const t = $('iba-ai-text'); if (t && state.view === 'chat') t.focus(); }, 30);
        }
    }

    function showView(v) {
        state.view = v;
        document.querySelectorAll('#iba-ai-panel .iba-ai-view').forEach((el) => { el.hidden = el.dataset.view !== v; });
        document.querySelectorAll('#iba-ai-panel .iba-ai-icon[data-ai]').forEach((b) => b.classList.toggle('is-on', b.dataset.ai === v));
        const chat = v === 'chat';
        $('iba-ai-chips').hidden = !chat;
        $('iba-ai-form').hidden = !chat;
        if (v === 'skills') renderSkills();
        if (v === 'setup') renderSetup();
    }

    function onPanelClick(e) {
        const b = e.target.closest('button, a[data-ai-po]');
        if (!b) return;
        const act = b.dataset.ai;
        if (act === 'close') return toggle(false);
        if (act === 'new') { state.history = []; state.lastTurn = null; $('iba-ai-log').innerHTML = ''; greetIfEmpty(true); return showView('chat'); }
        if (act === 'skills' || act === 'setup' || act === 'track') return showView(state.view === act ? 'chat' : act);
        if (b.dataset.viewGo) return showView(b.dataset.viewGo);
        if (b.dataset.track) {
            let q = {};
            try { q = JSON.parse(b.dataset.track); } catch (_) {}
            const out = b.closest('#iba-ai-track-out') ? $('iba-ai-track-out') : null;
            return runTrack(q, out);
        }
        if (b.dataset.rep) return onReport(b);
        if (b.dataset.trkHist !== undefined) {
            const item = b.closest('.iba-ai-trk-item');
            if (item) item.classList.toggle('show-steps');
            return;
        }
        if (b.dataset.chip) { showView('chat'); return ask(b.dataset.chip); }
        if (b.dataset.chipFill) {
            showView('chat');
            const t = $('iba-ai-text');
            t.value = b.dataset.chipFill;
            t.focus();
            t.setSelectionRange(t.value.length, t.value.length);
            return;
        }
        if (b.dataset.aiPo) { e.preventDefault(); return runDirect('open_po', { po: b.dataset.aiPo }); }
        if (b.dataset.aiNewInv) { showView('chat'); const t = $('iba-ai-text'); t.value = 'New invoice for PO ' + b.dataset.aiNewInv + ': '; t.focus(); return; }
        if (b.dataset.copy !== undefined) {
            const msg = b.closest('.iba-ai-msg');
            const txt = msg ? (msg.querySelector('.iba-ai-text') || {}).innerText || '' : '';
            copyText(txt).then((ok) => { b.innerHTML = ok ? '<i class="fa-solid fa-check"></i> Copied' : '<i class="fa-solid fa-xmark"></i> Copy failed'; setTimeout(() => { b.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 1800); });
            return;
        }
        if (b.dataset.saveSkill !== undefined) return openSaveSkill(b);
        if (b.dataset.again) { showView('chat'); return ask(b.dataset.again); }
        if (b.dataset.runSkill) return runSkill(b.dataset.runSkill);
        if (b.dataset.delSkill) {
            if (!confirm('Delete the skill "' + b.dataset.delSkill + '"?')) return;
            saveSkills(skills().filter((s) => norm(s.name) !== norm(b.dataset.delSkill)));
            return renderSkills();
        }
        if (b.dataset.showForm !== undefined) { peek('Check the form, then press Add.'); return; }
        if (b.dataset.showBatch !== undefined) { peek('Check the rows in Batch Entry, then press Save.'); return; }
    }

    async function runTrack(q, out) {
        if (state.busy) return;
        state.busy = true;
        if (out) out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        else setBusy(true);
        try {
            const r = await trackSearch(q || {});
            if (out) { out.innerHTML = ''; addCard({ kind: 'track', data: r }, out); }
            else addCard({ kind: 'track', data: r });
        } catch (err) {
            if (out) out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
            else addError(err);
        } finally {
            state.busy = false;
            if (!out) setBusy(false);
        }
    }

    async function runDirect(tool, args) {
        if (state.busy) return;
        state.busy = true;
        setBusy(true);
        try {
            const out = await runTool(tool, args);
            if (out.card) addCard(out.card);
            if (out.minimize) peek(out.card && out.card.data && out.card.data.text ? out.card.data.text : 'Done.');
        } finally { state.busy = false; setBusy(false); }
    }

    function copyText(t) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallbackCopy(t));
        return Promise.resolve(fallbackCopy(t));
    }
    function fallbackCopy(t) {
        try {
            const ta = document.createElement('textarea');
            ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (_) { return false; }
    }

    // ---- chat log -------------------------------------------------------
    function log() { return $('iba-ai-log'); }
    function scrollEnd() { const l = log(); if (l) l.scrollTop = l.scrollHeight; }
    function put(el) {
        const l = log();
        l.appendChild(el);
        if (typingEl && typingEl.parentNode === l) l.appendChild(typingEl);
        scrollEnd();
        return el;
    }
    function md(text) {
        // tiny, safe formatting: **bold**, `code`, bullet lines, line breaks
        const lines = esc(text).split(/\r?\n/);
        let html = '';
        let inList = false;
        lines.forEach((ln) => {
            const li = ln.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + li[1] + '</li>'; return; }
            if (inList) { html += '</ul>'; inList = false; }
            html += ln.trim() ? '<p>' + ln + '</p>' : '';
        });
        if (inList) html += '</ul>';
        return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    function addUser(text, isSkill) {
        const d = document.createElement('div');
        d.className = 'iba-ai-msg is-user' + (isSkill ? ' is-skill' : '');
        d.innerHTML = '<div class="iba-ai-text">' + esc(text).replace(/\n/g, '<br>') + '</div>';
        return put(d);
    }
    function addBot(text, opts) {
        const o = opts || {};
        const d = document.createElement('div');
        d.className = 'iba-ai-msg is-bot';
        let tools = '<button type="button" class="iba-ai-mini" data-copy><i class="fa-regular fa-copy"></i> Copy</button>';
        if (o.canSave) tools += '<button type="button" class="iba-ai-mini" data-save-skill><i class="fa-solid fa-bolt"></i> Save as skill</button>';
        if (o.again) tools += '<button type="button" class="iba-ai-mini" data-again="' + esc(o.again) + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Ask AI again</button>';
        d.innerHTML = '<div class="iba-ai-text">' + md(text) + '</div><div class="iba-ai-msg-tools">' + tools + '</div>';
        if (o.canSave) { d.__prompt = o.prompt; d.__steps = o.steps; }
        return put(d);
    }
    function addNote(text, kind) {
        const d = document.createElement('div');
        d.className = 'iba-ai-note' + (kind ? ' is-' + kind : '');
        d.innerHTML = '<i class="fa-solid ' + (kind === 'wait' ? 'fa-hourglass-half' : kind === 'setup' ? 'fa-gear' : 'fa-circle-info') + '"></i> <span>' + esc(text) + '</span>';
        return put(d);
    }
    function addError(err) {
        const d = document.createElement('div');
        d.className = 'iba-ai-note is-error';
        const setup = err && err.setup;
        d.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>' + esc((err && err.message) || String(err)) + '</span>' +
            (setup ? ' <button type="button" class="iba-ai-mini" data-ai="setup">Open Setup</button>' : '');
        put(d);
    }
    function setBusy(on) {
        const send = $('iba-ai-send');
        if (send) send.disabled = !!on;
        if (on && !typingEl) {
            typingEl = document.createElement('div');
            typingEl.className = 'iba-ai-typing';
            typingEl.innerHTML = '<span></span><span></span><span></span>';
            log().appendChild(typingEl);
            scrollEnd();
        } else if (!on && typingEl) {
            if (typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
            typingEl = null;
        }
    }

    // ---- cards (what the jobs found) -------------------------------------
    function poLink(po) { return po ? '<button type="button" class="iba-ai-po" data-ai-po="' + esc(po) + '" title="Open on Invoice Entry">' + esc(po) + '</button>' : ''; }
    function ageChip(days) {
        if (days === null || days === undefined) return '';
        const tone = days >= 30 ? 'critical' : days >= 8 ? 'alert' : days >= 3 ? 'watch' : 'fresh';
        return '<span class="iba-ai-age is-' + tone + '">' + days + 'd</span>';
    }
    const STAGE_SHORT = ['Reception', 'Entry', 'SRV', 'Approval', 'Accounts', 'Paid'];
    function trackQueryAttr(base, extra) { return esc(JSON.stringify(Object.assign({}, base || {}, extra || {}))); }
    function trackHtml(r) {
        if (!r || r.mode === 'error') return '<div class="iba-ai-card-head is-bad"><i class="fa-solid fa-circle-exclamation"></i> ' + esc((r && r.message) || 'Something went wrong.') + '</div>';
        if (r.mode === 'none') return '<div class="iba-ai-card-head"><i class="fa-solid fa-route"></i> ' + esc(r.message) + '</div>';
        if (r.mode === 'suggest') return '<div class="iba-ai-card-head"><i class="fa-solid fa-route"></i> ' + esc(r.message) + '</div><div class="iba-ai-chiprow">' +
            r.suggestions.map((v) => '<button type="button" class="iba-ai-chip" data-track="' + trackQueryAttr(r.query, { vendor: v }) + '">' + esc(v) + '</button>').join('') + '</div>';
        if (r.mode === 'summary') {
            const base = r.query || {};
            const years = Object.keys(r.by_year || {}).sort().reverse();
            const sites = Object.keys(r.by_site || {}).sort();
            return '<div class="iba-ai-card-head"><i class="fa-solid fa-route"></i> ' + esc(r.vendor) + ' · ' + esc(r.total) + ' POs</div>' +
                '<p class="iba-ai-foot">That is a lot. Pick a year or a site to narrow it down:</p>' +
                '<div class="iba-ai-sub">Year</div><div class="iba-ai-chiprow">' + years.map((y) =>
                    '<button type="button" class="iba-ai-chip" data-track="' + trackQueryAttr(base, { year: y === 'unknown' ? '' : y }) + '">' + esc(y) + ' <b>' + esc(r.by_year[y]) + '</b></button>').join('') + '</div>' +
                '<div class="iba-ai-sub">Site</div><div class="iba-ai-chiprow">' + sites.map((st) =>
                    '<button type="button" class="iba-ai-chip" data-track="' + trackQueryAttr(base, { site: siteNo(st) }) + '">' + esc(st || '?') + ' <b>' + esc(r.by_site[st]) + '</b></button>').join('') + '</div>';
        }
        let h = '<div class="iba-ai-card-head"><i class="fa-solid fa-route"></i> ' + esc(r.vendor ? r.vendor + ' · ' : '') + esc(r.total) + ' PO' + (r.total === 1 ? '' : 's') + '</div>';
        if (r.more) h += '<p class="iba-ai-foot">' + (r.year_rule ? 'Checked the ' + esc(r.checked) + ' newest POs; ' + esc(r.more) + ' older not checked. Add a site to narrow it down.'
            : 'Showing the ' + esc(r.shown) + ' newest; ' + esc(r.more) + ' more. Add a site or year to narrow it down.') + '</p>';
        if (r.year_rule) h += '<p class="iba-ai-foot">' + esc(r.year_rule) + '.</p>';
        r.pos.forEach((p) => {
            h += '<div class="iba-ai-trk-po"><div class="iba-ai-trk-po-head"><b>PO ' + esc(p.po) + '</b><span>' + esc([p.vendor, p.site, p.year].filter(Boolean).join(' · ')) + '</span>' +
                (p.po_value ? '<span class="iba-ai-trk-val">QAR ' + esc(p.po_value) + '</span>' : '') + '</div>';
            if (!p.items.length) h += '<p class="iba-ai-empty">No invoice received yet for this PO.</p>';
            p.items.forEach((it) => {
                const side = !!it.side_status;
                const now = it.side_status || it.status;
                const who = [it.stage_index === 4 && !side ? 'payment in process' : '', it.with ? 'with ' + it.with : '', it.days !== undefined ? it.days + ' day' + (it.days === 1 ? '' : 's') : '', it.since ? (it.stage_index === 5 && !side ? 'paid ' : 'since ') + it.since : ''].filter(Boolean).join(' · ');
                h += '<div class="iba-ai-trk-item' + (side ? ' is-side' : '') + '">' +
                    '<div class="iba-ai-trk-top"><span class="iba-ai-tag">' + esc(it.invoice_no) + '</span><span class="iba-ai-grow"><strong>' + esc(now) + '</strong><small>' + esc(who) + '</small></span>' +
                    (it.value ? '<span class="iba-ai-trk-val">' + esc(it.value) + '</span>' : '') + '</div>' +
                    (it.invoice_date || it.paid_on || it.with_accounts_on ? '<div class="iba-ai-trk-dates">' + [it.invoice_date ? 'Invoice ' + esc(it.invoice_date) : '', it.with_accounts_on ? 'With Accounts ' + esc(it.with_accounts_on) : '', it.paid_on ? 'Paid ' + esc(it.paid_on) : ''].filter(Boolean).join(' · ') + '</div>' : '') +
                    '<ol class="iba-ai-pipe">' + STAGE_SHORT.map((lbl, i) => '<li class="' + (i < it.stage_index ? 'is-done' : i === it.stage_index ? ('is-now' + (side ? ' is-side' : '') + (i === 5 ? ' is-final' : '')) : '') + '"><span></span>' + lbl + '</li>').join('') + '</ol>' +
                    (it.steps && it.steps.length ? '<button type="button" class="iba-ai-mini iba-ai-trk-histbtn" data-trk-hist><i class="fa-solid fa-clock-rotate-left"></i> History</button>' +
                        '<ul class="iba-ai-trk-steps">' + it.steps.map((x) => '<li><b>' + esc(x.status) + '</b> · ' + esc(x.date) + (x.by ? ' · ' + esc(x.by) : '') + '</li>').join('') + '</ul>' : '') +
                    '</div>';
            });
            h += '</div>';
        });
        return h;
    }
    // ------------------------------------------------------------------
    // patch 17: Print and Excel for the assistant's result cards
    // ------------------------------------------------------------------
    const REPORT_KINDS = ['jobs', 'status', 'track', 'activity', 'list', 'po'];
    function canReport(card) {
        const x = (card && card.data) || {};
        if (!card || REPORT_KINDS.indexOf(card.kind) === -1) return false;
        if (card.kind === 'track') return x.mode === 'pos' && (x.pos || []).some((p) => (p.items || []).length);
        if (card.kind === 'activity') return (x.all_events || x.events || []).length > 0;
        if (card.kind === 'po') return (x.all_invoices || x.invoices || []).length > 0;
        return Number(x.total) > 0;
    }
    function countOf(list, fn) { const o = {}; list.forEach((r) => { const k = fn(r) || '—'; o[k] = (o[k] || 0) + 1; }); return o; }
    function nowStamp() {
        try { return 'Generated: ' + new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; }
    }
    function dropEmptyCols(cols, rows) {
        const keep = cols.map((c, i) => !c.optional || rows.some((r) => r[i] != null && String(r[i]).trim() !== ''));
        return { columns: cols.filter((c, i) => keep[i]), rows: rows.map((r) => r.filter((v, i) => keep[i])) };
    }
    function fitWidths(cols) {
        const total = cols.reduce((n, c) => n + (c.w || 8), 0);
        return cols.map((c) => Object.assign({}, c, { width: ((c.w || 8) / total * 100).toFixed(2) + '%' }));
    }
    async function reportOf(card) {
        const x = card.data || {};
        const acc = access();
        let rep = null;
        if (card.kind === 'jobs') {
            const all = x.all || [];
            const todo = all.filter((r) => !r.now && r.n && r.n.kind === 'moved').slice(0, 300);
            for (let i = 0; i < todo.length; i += 20) {
                await Promise.all(todo.slice(i, i + 20).map(async (r) => {
                    const inv = await invoiceNow(r.n.po, r.n.key);
                    const st = (inv && inv.status) || r.n.last;
                    r.now = 'In Invoice Entry' + (st ? ': ' + st : '') + (inv && inv.with ? ' with ' + inv.with : '');
                }));
            }
            const filt = [x.entered_by_filter ? 'entered by ' + x.entered_by_filter : '', x.with_filter ? 'with ' + x.with_filter : '', x.open_only ? 'open only' : ''].filter(Boolean).join(' · ');
            const typeLabel = x.type && x.type !== 'any' ? String(x.type).replace(/^./, (c) => c.toUpperCase()) : '';
            rep = { title: 'Job Records' + (typeLabel ? ' · ' + typeLabel : ''), fileName: 'IBA Job Records ' + todayISO(),
                meta: [{ label: 'Period', value: x.period }, { label: 'Filter', value: filt }, { label: 'Total', value: String(all.length) }],
                chart: Object.keys(x.by_type || {}).length > 1 ? { title: 'Jobs per type', data: x.by_type } : { title: 'Where they are now', data: x.by_now },
                columns: [{ label: 'Date', kind: 'date', w: 8 }, { label: 'Type', w: 9 }, { label: 'Ref / Invoice', w: 9 }, { label: 'PO', w: 6 }, { label: 'Vendor', w: 13 },
                    { label: 'Site', w: 5 }, { label: 'Amount', kind: 'amount', w: 7, optional: true }, { label: 'Entered by', w: 7 }, { label: 'With', w: 7 },
                    { label: 'Status', kind: 'status', w: 8 }, { label: 'Now', w: 13 }, { label: 'Note', w: 11, optional: true }],
                rows: all.map((r) => [r.date, r.type, r.ref, r.po, r.vendor, r.site, acc.amounts ? r.amount : '', r.entered_by, r.with, r.status, r.now || (r.n && r.n.text) || '', r.note]) };
        } else if (card.kind === 'status') {
            const all = x.all || [];
            rep = { title: 'Active invoices' + (x.status && x.status !== 'all active' ? ' · ' + x.status : ''), fileName: 'IBA Active invoices ' + todayISO(),
                meta: [{ label: 'Status', value: x.status }, { label: 'Total', value: String(all.length) }],
                chart: { title: 'Invoices per status', data: x.status && x.status !== 'all active' ? countOf(all, (r) => r.status) : x.by_status },
                columns: [{ label: 'PO', w: 6 }, { label: 'Invoice No', w: 9 }, { label: 'Vendor', w: 15 }, { label: 'Site', w: 9 }, { label: 'Status', kind: 'status', w: 9 },
                    { label: 'With', w: 9 }, { label: 'Since', kind: 'date', w: 8 }, { label: 'Days', kind: 'number', w: 5 }, { label: 'Amount', kind: 'amount', w: 8, optional: true },
                    { label: 'Payment', w: 11 }, { label: 'Note', w: 11, optional: true }],
                rows: all.map((r) => [r.po, r.invoice_no, r.vendor, r.site, r.status, r.with, r.since, r.days, acc.amounts ? r.amount : '', r.payment, r.note]),
                note: x.note };
        } else if (card.kind === 'track') {
            const rows = [];
            (x.pos || []).forEach((p) => (p.items || []).forEach((i) => rows.push([p.po, p.site || '', i.invoice_no, i.side_status || i.status, i.stage, i.with || '', i.since || '', i.days,
                i.invoice_date || '', i.with_accounts_on || '', i.paid_on || '', i.payment || '', acc.amounts ? (i.value || '') : ''])));
            rep = { title: 'Invoice tracking · ' + (x.vendor || 'PO ' + ((x.query && x.query.po) || '')), fileName: 'IBA Tracking ' + (x.vendor || (x.query && x.query.po) || '') + ' ' + todayISO(),
                meta: [{ label: 'Vendor', value: x.vendor || '' }, { label: 'POs', value: String((x.pos || []).length) }, { label: 'Invoices', value: String(rows.length) }, { label: 'Year', value: x.year_rule || '' }],
                chart: { title: 'Invoices per stage', data: countOf(rows, (r) => r[4]) },
                columns: [{ label: 'PO', w: 6 }, { label: 'Site', w: 9 }, { label: 'Invoice No', w: 9 }, { label: 'Status', kind: 'status', w: 9 }, { label: 'Stage', w: 8 },
                    { label: 'With', w: 8 }, { label: 'Since', kind: 'date', w: 8 }, { label: 'Days', kind: 'number', w: 5 }, { label: 'Invoice date', kind: 'date', w: 8 },
                    { label: 'With Accounts', kind: 'date', w: 8 }, { label: 'Paid', kind: 'date', w: 8 }, { label: 'Payment', w: 11 }, { label: 'Value', kind: 'amount', w: 8, optional: true }],
                rows: rows };
        } else if (card.kind === 'activity') {
            const ev = x.all_events || x.events || [];
            const la = x.last_action;
            rep = { title: 'Activity · ' + (x.vendor || ''), fileName: 'IBA Activity ' + (x.vendor || '') + ' ' + todayISO(),
                meta: [{ label: 'Period', value: x.period || 'any time' }, { label: 'Last handled by', value: la ? (la.by || '—') + ' (' + la.action + ', ' + la.date + ')' : '' },
                    { label: 'POs checked', value: (x.pos_checked || []).join(', ') }],
                chart: { title: 'Actions per person', data: countOf(ev, (e) => e.by) },
                columns: [{ label: 'Date', kind: 'date', w: 10 }, { label: 'Action', kind: 'status', w: 16 }, { label: 'By', w: 12 }, { label: 'PO', w: 8 }, { label: 'Invoice', w: 12 }],
                rows: ev.map((e) => [e.date, e.action, e.by, e.po, e.invoice_no]) };
        } else if (card.kind === 'list') {
            const all = x.all || x.rows || [];
            rep = { title: 'My waiting items', fileName: 'IBA My waiting items ' + todayISO(),
                meta: [{ label: 'Person', value: myName() }, { label: 'Filter', value: [x.kind && x.kind !== 'any' ? x.kind : '', x.text || ''].filter(Boolean).join(' · ') }, { label: 'Total', value: String(all.length) }],
                chart: { title: 'Items per status', data: countOf(all, (r) => r.kind === 'inventory' ? r.step : r.status) },
                columns: [{ label: 'Type', w: 9 }, { label: 'PO / Control', w: 9 }, { label: 'Ref / Product', w: 12 }, { label: 'Vendor / Route', w: 16 }, { label: 'Site', w: 9 },
                    { label: 'Status', kind: 'status', w: 10 }, { label: 'Amount', kind: 'amount', w: 8, optional: true }, { label: 'Waiting days', kind: 'number', w: 7 }, { label: 'Note', w: 14, optional: true }],
                rows: all.map((r) => r.kind === 'inventory'
                    ? [r.type, r.control, r.product, [r.from, r.to].filter(Boolean).join(' > '), '', r.step, '', daysSince(r.at), '']
                    : [r.type || r.kind, r.po, r.ref, r.vendor, r.site, r.status, acc.amounts && r.amount ? money(r.amount) : '', daysSince(r.at), r.note ? String(r.note).slice(0, 80) : '']) };
        } else if (card.kind === 'po') {
            const inv = x.all_invoices || x.invoices || [];
            rep = { title: 'PO ' + x.po + (x.vendor ? ' · ' + x.vendor : ''), fileName: 'IBA PO ' + x.po + ' ' + todayISO(),
                meta: [{ label: 'Site', value: x.site }, { label: 'PO value', value: x.po_value || '' }, { label: 'Invoiced', value: x.invoiced_total }, { label: 'Paid', value: x.paid_total },
                    { label: 'With Accounts', value: x.with_accounts_total }, { label: 'Remaining', value: x.remaining || '' }],
                chart: { title: 'Invoices per status', data: countOf(inv, (i) => i.status) },
                columns: [{ label: 'Entry', w: 7 }, { label: 'Invoice No', w: 11 }, { label: 'Invoice date', kind: 'date', w: 9 }, { label: 'Value', kind: 'amount', w: 10 },
                    { label: 'Status', kind: 'status', w: 11 }, { label: 'Payment', w: 15 }, { label: 'With', w: 10 }, { label: 'Note', w: 17, optional: true }],
                rows: inv.map((i) => [i.entry, i.invoice_no, i.invoice_date, i.value, i.status, i.payment, i.attention || '', i.note || '']) };
        }
        if (!rep) return null;
        const fitted = dropEmptyCols(rep.columns, rep.rows);
        return Object.assign(rep, { subtitle: 'IBA Assistant report', generated: nowStamp(), columns: fitWidths(fitted.columns), rows: fitted.rows });
    }
    async function onReport(btn) {
        const cardEl = btn.closest('.iba-ai-card');
        const card = cardEl && cardEl.__card;
        if (!card || !window.ibaPrint) return;
        const how = btn.dataset.rep;
        const label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing';
        try {
            const rep = await reportOf(card);
            if (!rep || !rep.rows.length) throw new Error('Nothing to put in the report.');
            if (how === 'excel') window.ibaPrint.excel(rep);
            else window.ibaPrint.table(rep);
        } catch (err) {
            addNote('Could not make the report: ' + ((err && err.message) || err), 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = label;
        }
    }
    function addCard(card, target) {
        const d = document.createElement('div');
        d.className = 'iba-ai-card is-' + card.kind;
        const x = card.data || {};
        if (card.kind === 'brief') {
            const r = x.result;
            let h = '<div class="iba-ai-card-head"><i class="fa-solid fa-sun"></i> Your brief</div>' +
                '<div class="iba-ai-stats">' +
                  '<div><b>' + esc(r.active_task) + '</b><span>Active Task</span></div>' +
                  '<div><b>' + esc(r.active_job) + '</b><span>Active Job</span></div>' +
                  (r.po_closeout ? '<div><b>' + esc(r.po_closeout.ready_to_close) + '</b><span>Ready to close</span></div>' : '') +
                '</div>';
            if (x.tasks.length) {
                h += '<div class="iba-ai-sub">Oldest waiting</div><ul class="iba-ai-rows">' + x.tasks.map((t) =>
                    '<li>' + poLink(t.po) + '<span class="iba-ai-grow">' + esc(t.vendor || t.ref || t.type) + '<small>' + esc(t.status) + (t.amount ? ' · QAR ' + esc(money(t.amount)) : '') + '</small></span>' + ageChip(daysSince(t.at)) + '</li>').join('') + '</ul>';
            }
            if (x.jobs.length) {
                h += '<div class="iba-ai-sub">Inventory waiting for your step</div><ul class="iba-ai-rows">' + x.jobs.map((j) =>
                    '<li><span class="iba-ai-tag">' + esc(j.control) + '</span><span class="iba-ai-grow">' + esc(j.product) + '<small>' + esc(j.step) + (j.from || j.to ? ' · ' + esc(j.from) + ' → ' + esc(j.to) : '') + '</small></span>' + ageChip(daysSince(j.at)) + '</li>').join('') + '</ul>';
            }
            if (!x.tasks.length && !x.jobs.length) h += '<p class="iba-ai-empty"><i class="fa-solid fa-mug-hot"></i> Nothing is waiting for you.</p>';
            if (r.po_closeout) h += '<p class="iba-ai-foot">PO Close Out: ' + esc(r.po_closeout.waiting_site) + ' waiting at Site, ' + esc(r.po_closeout.ready_to_close) + ' ready to close.</p>';
            d.innerHTML = h;
        } else if (card.kind === 'list') {
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-list-check"></i> ' + esc(x.total) + ' found' + (x.total > x.rows.length ? ' · first ' + x.rows.length : '') + '</div>' +
                (x.rows.length ? '<ul class="iba-ai-rows">' + x.rows.map((t) => t.kind === 'inventory'
                    ? '<li><span class="iba-ai-tag">' + esc(t.control) + '</span><span class="iba-ai-grow">' + esc(t.product) + '<small>' + esc(t.step) + '</small></span>' + ageChip(daysSince(t.at)) + '</li>'
                    : '<li>' + poLink(t.po) + '<span class="iba-ai-grow">' + esc(t.vendor || t.ref || t.type) + '<small>' + esc(t.status) + (t.amount ? ' · QAR ' + esc(money(t.amount)) : '') + '</small></span>' + ageChip(daysSince(t.at)) + '</li>').join('') + '</ul>' : '<p class="iba-ai-empty">Nothing matches.</p>');
        } else if (card.kind === 'po') {
            if (!x.found) {
                d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-magnifying-glass"></i> PO ' + esc(x.po) + '</div><p class="iba-ai-empty">No PO record and no invoices found.</p>';
            } else {
                d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-file-invoice"></i> PO ' + esc(x.po) +
                    '<span class="iba-ai-head-actions"><button type="button" class="iba-ai-mini" data-ai-po="' + esc(x.po) + '"><i class="fa-solid fa-folder-open"></i> Open</button>' +
                    '<button type="button" class="iba-ai-mini" data-ai-new-inv="' + esc(x.po) + '"><i class="fa-solid fa-file-circle-plus"></i> New invoice</button></span></div>' +
                    '<div class="iba-ai-po-who">' + esc(x.vendor || '—') + (x.site ? ' · ' + esc(x.site) : '') + '</div>' +
                    '<div class="iba-ai-stats">' +
                      '<div><b>' + esc(x.po_value || '—') + '</b><span>PO value</span></div>' +
                      '<div><b>' + esc(x.invoiced_total) + '</b><span>Invoiced</span></div>' +
                      '<div><b>' + esc(x.paid_total || '0.00') + '</b><span>Paid</span></div>' +
                      '<div><b>' + esc(x.remaining || '—') + '</b><span>Remaining</span></div>' +
                    '</div>' +
                    (x.invoices.length ? '<table class="iba-ai-table"><thead><tr><th>Inv. No.</th><th>Value</th><th>Status</th><th>Attention</th></tr></thead><tbody>' +
                        x.invoices.map((i) => '<tr><td>' + esc(i.invoice_no || i.entry) + '</td><td class="num">' + esc(i.value) + '</td><td>' + esc(i.status) + '</td><td>' + esc(i.attention || '') + '</td></tr>').join('') +
                        '</tbody></table>' + (x.more_invoices ? '<p class="iba-ai-foot">+' + esc(x.more_invoices) + ' more</p>' : '') : '<p class="iba-ai-empty">No invoices yet.</p>');
            }
        } else if (card.kind === 'form') {
            const f = x.filled || {};
            const labels = { invoice_no: 'Invoice No.', value: 'Value', amount_paid: 'Amount paid', invoice_date: 'Invoice date', status: 'Status', attention: 'Attention', note: 'Note', details: 'Details' };
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-file-circle-plus"></i> New invoice ready · PO ' + esc(x.po) + '<span class="iba-ai-badge">Not saved</span></div>' +
                '<dl class="iba-ai-dl">' + Object.keys(labels).filter((k) => f[k]).map((k) => '<dt>' + labels[k] + '</dt><dd>' + esc(f[k]) + '</dd>').join('') + '</dl>' +
                (x.warnings ? '<ul class="iba-ai-warn">' + x.warnings.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
                '<p class="iba-ai-foot">Check the form, then press <b>Add</b>. <button type="button" class="iba-ai-mini" data-show-form><i class="fa-regular fa-eye"></i> Show form</button></p>';
        } else if (card.kind === 'people') {
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-user"></i> People</div>' + (x.length ? '<ul class="iba-ai-rows">' + x.map((p) =>
                '<li><span class="iba-ai-grow">' + esc(p.name) + '<small>' + esc([p.position, p.site].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' : '<p class="iba-ai-empty">Nobody found.</p>');
        } else if (card.kind === 'action') {
            d.innerHTML = '<div class="iba-ai-card-head' + (x.ok ? '' : ' is-bad') + '"><i class="fa-solid ' + esc(x.icon || 'fa-check') + '"></i> ' + esc(x.text) + '</div>';
        } else if (card.kind === 'track') {
            d.innerHTML = trackHtml(x);
        } else if (card.kind === 'reception') {
            const ppl = Object.keys(x.entered_by || {}).map((k) => esc(k) + ' ' + esc(x.entered_by[k])).join(' · ');
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-inbox"></i> Received at Reception · ' + esc(x.period) + '<span class="iba-ai-badge is-plain">' + esc(x.total) + '</span></div>' +
                (ppl ? '<p class="iba-ai-foot">Entered by: ' + ppl + '</p>' : '') +
                (x.items.length ? '<ul class="iba-ai-rows">' + x.items.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc([r.vendor, r.invoice_no].filter(Boolean).join(' · ') || '—') +
                    '<small>' + esc([r.date, r.entered_by ? 'by ' + r.entered_by : '', r.now].filter(Boolean).join(' · ')) + '</small></span>' + (r.amount ? '<span class="iba-ai-trk-val">' + esc(r.amount) + '</span>' : '') + '</li>').join('') + '</ul>' +
                    (x.total > x.shown ? '<p class="iba-ai-foot">First ' + esc(x.shown) + ' of ' + esc(x.total) + '.</p>' : '')
                    : '<p class="iba-ai-empty">Nothing was received in that period.</p>');
        } else if (card.kind === 'jobs') {
            const cnt = (o) => Object.keys(o || {}).map((k) => '<span class="iba-ai-cnt">' + esc(k) + ' <b>' + esc(o[k]) + '</b></span>').join('');
            const filt = [x.type && x.type !== 'any' ? x.type : '', x.entered_by_filter ? 'entered by ' + x.entered_by_filter : '', x.with_filter ? 'with ' + x.with_filter : '', x.open_only ? 'open only' : ''].filter(Boolean).join(' · ');
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-inbox"></i> Job Records · ' + esc(x.period) + '<span class="iba-ai-badge is-plain">' + esc(x.total) + '</span></div>' +
                (filt ? '<p class="iba-ai-foot">' + esc(filt) + '</p>' : '') +
                (x.notes ? '<ul class="iba-ai-warn">' + x.notes.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
                (x.total ? '<div class="iba-ai-cnts">' + cnt(x.by_type) + '</div><div class="iba-ai-cnts">' + cnt(x.by_now) + '</div>' : '') +
                (x.items.length ? '<ul class="iba-ai-rows">' + x.items.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow"><span class="iba-ai-jtype">' + esc(r.type) + '</span>' + esc([r.ref, r.vendor].filter(Boolean).join(' · ') || '—') +
                    '<small>' + esc([r.date, r.entered_by ? 'by ' + r.entered_by : '', r.now].filter(Boolean).join(' · ')) + '</small></span>' + (r.amount ? '<span class="iba-ai-trk-val">' + esc(r.amount) + '</span>' : '') + '</li>').join('') + '</ul>' +
                    (x.total > x.shown ? '<p class="iba-ai-foot">Newest ' + esc(x.shown) + ' of ' + esc(x.total) + '. Add a type, person or shorter period to narrow it down.</p>' : '')
                    : '<p class="iba-ai-empty">No job records match that.</p>');
        } else if (card.kind === 'status') {
            const cnt = Object.keys(x.by_status || {}).map((k) => '<span class="iba-ai-cnt">' + esc(k) + ' <b>' + esc(x.by_status[k]) + '</b></span>').join('');
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-list-check"></i> Active invoices · ' + esc(x.status) + '<span class="iba-ai-badge is-plain">' + esc(x.total) + '</span></div>' +
                (cnt ? '<div class="iba-ai-cnts">' + cnt + '</div>' : '') +
                (x.items.length ? '<ul class="iba-ai-rows">' + x.items.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc([r.invoice_no, r.vendor].filter(Boolean).join(' · ') || '—') +
                    '<small>' + esc([r.status, r.with ? 'with ' + r.with : '', r.days != null ? r.days + (r.days === 1 ? ' day' : ' days') : ''].filter(Boolean).join(' · ')) + '</small></span>' + (r.amount ? '<span class="iba-ai-trk-val">' + esc(r.amount) + '</span>' : '') + '</li>').join('') + '</ul>' +
                    (x.total > x.shown ? '<p class="iba-ai-foot">Oldest ' + esc(x.shown) + ' of ' + esc(x.total) + '.</p>' : '')
                    : '<p class="iba-ai-empty">No active invoices match that.</p>') +
                '<p class="iba-ai-foot">' + esc(x.note) + '</p>';
        } else if (card.kind === 'batch') {
            const added = x.added || [], already = x.already_in_batch || [], na = x.not_added || [];
            const f = x.filled || {};
            const fill = [f.status ? 'Status: ' + f.status : '', f.attention ? 'Attention: ' + f.attention : '', f.note ? 'Note: ' + f.note : ''].filter(Boolean).join(' · ');
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-layer-group"></i> Batch Entry · ' + esc(added.length) + ' added' + (x.status_filter ? ' (' + esc(x.status_filter) + ')' : '') + '<span class="iba-ai-badge">Not saved</span></div>' +
                (added.length ? '<ul class="iba-ai-rows">' + added.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc(r.invoice_no) + '<small>' + esc([r.status, r.with ? 'with ' + r.with : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' : '') +
                (already.length ? '<p class="iba-ai-foot">Already in the batch: ' + esc(already.map((r) => r.po + ' ' + r.invoice_no).join(', ')) + '</p>' : '') +
                (na.length ? '<ul class="iba-ai-warn">' + na.map((r) => '<li>PO ' + esc(r.po) + ': ' + esc(r.reason) + '</li>').join('') + '</ul>' : '') +
                (fill ? '<p class="iba-ai-foot">Filled in Set All: ' + esc(fill) + '</p>' : '') +
                ((f.status_error || f.attention_error) ? '<ul class="iba-ai-warn">' + [f.status_error, f.attention_error].filter(Boolean).map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') +
                ((added.length || already.length) ? '<p class="iba-ai-foot">Check the rows, then press <b>Save</b> in Batch Entry. <button type="button" class="iba-ai-mini" data-show-batch><i class="fa-regular fa-eye"></i> Show Batch Entry</button></p>' : '');
        } else if (card.kind === 'activity') {
            const la = x.last_action;
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-user-clock"></i> ' + esc(x.vendor || 'Activity') + (x.period ? ' · ' + esc(x.period) : '') + '</div>' +
                (la ? '<p class="iba-ai-lastact">Last handled by <b>' + esc(la.by || '—') + '</b>: ' + esc(la.action) + ' · PO ' + esc(la.po) + ' · ' + esc(la.invoice_no) + ' · ' + esc(la.date) + '</p>' : '<p class="iba-ai-empty">' + esc(x.note || 'No recorded actions.') + '</p>') +
                (x.events.length ? '<div class="iba-ai-sub">Latest actions</div><ul class="iba-ai-rows iba-ai-timeline">' + x.events.map((e) => '<li><span class="iba-ai-tl-date">' + esc(e.date) + '</span><span class="iba-ai-grow">' + esc(e.action) +
                    '<small>' + esc([e.by, 'PO ' + e.po, e.invoice_no].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' : '') +
                (x.now.length ? '<div class="iba-ai-sub">Now</div><ul class="iba-ai-rows">' + x.now.map((n) => '<li>' + poLink(n.po) + '<span class="iba-ai-grow">' + esc(n.invoice_no + ' · ' + n.status) +
                    '<small>' + esc([n.with ? 'with ' + n.with : '', n.payment].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' : '') +
                '<p class="iba-ai-foot">Checked POs: ' + esc(x.pos_checked.join(', ')) + (x.more_pos ? ' (+' + esc(x.more_pos) + ' older)' : '') + '</p>';
        }
        if (canReport(card)) {
            d.__card = card;
            const acts = document.createElement('div');
            acts.className = 'iba-ai-cardacts';
            acts.innerHTML = '<button type="button" class="iba-ai-mini" data-rep="print"><i class="fa-solid fa-print"></i> Print</button>' +
                '<button type="button" class="iba-ai-mini" data-rep="excel"><i class="fa-solid fa-file-excel"></i> Excel</button>';
            d.appendChild(acts);
        }
        if (target) { target.appendChild(d); return d; }
        return put(d);
    }

    function openSaveSkill(btn) {
        const msg = btn.closest('.iba-ai-msg');
        if (!msg || msg.querySelector('.iba-ai-skill-form')) return;
        const f = document.createElement('form');
        f.className = 'iba-ai-skill-form';
        f.innerHTML = '<input type="text" maxlength="60" placeholder="Skill name, e.g. Morning check"/><button type="submit" class="iba-ai-mini is-main">Save</button><button type="button" class="iba-ai-mini" data-cancel>Cancel</button>';
        const input = f.querySelector('input');
        input.value = String(msg.__prompt || '').replace(/\s+/g, ' ').slice(0, 40);
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            if (addSkill(input.value, msg.__prompt, msg.__steps || [])) {
                f.outerHTML = '<p class="iba-ai-saved"><i class="fa-solid fa-bolt"></i> Saved as skill "' + esc(input.value.trim()) + '". Find it under the lightning button.</p>';
            }
        });
        f.querySelector('[data-cancel]').addEventListener('click', () => f.remove());
        msg.appendChild(f);
        input.focus();
        input.select();
    }

    function renderSkills() {
        const box = $('iba-ai-skills');
        const list = skills();
        box.innerHTML = '<h3><i class="fa-solid fa-bolt"></i> Skills</h3>' +
            '<p class="iba-ai-help">A skill repeats a job that worked, in one click, without the AI (no quota used). Save one with "Save as skill" under an answer.</p>' +
            (list.length ? '<ul class="iba-ai-skill-list">' + list.map((s) =>
                '<li><div class="iba-ai-grow"><strong>' + esc(s.name) + '</strong><small>' + esc(s.prompt) + '</small><small>' + s.steps.length + ' step' + (s.steps.length === 1 ? '' : 's') + ' · ' + esc(fmtDate(s.at)) + '</small></div>' +
                '<button type="button" class="iba-ai-mini is-main" data-run-skill="' + esc(s.name) + '"><i class="fa-solid fa-play"></i> Run</button>' +
                '<button type="button" class="iba-ai-mini" data-del-skill="' + esc(s.name) + '" title="Delete"><i class="fa-solid fa-trash"></i></button></li>').join('') + '</ul>'
            : '<p class="iba-ai-empty"><i class="fa-solid fa-bolt"></i> No skills yet.</p>');
    }

    function renderSetup() {
        const box = $('iba-ai-setup');
        const c = getCfg();
        const b = BRAINS[c.brain];
        box.innerHTML = '<h3><i class="fa-solid fa-gear"></i> Setup</h3>' +
            '<label class="iba-ai-field"><span>Brain</span><select id="iba-ai-brain-pick">' + Object.keys(BRAINS).map((k) =>
                '<option value="' + k + '"' + (k === c.brain ? ' selected' : '') + '>' + esc(BRAINS[k].label) + (k === 'groq' ? ' — recommended' : '') + '</option>').join('') + '</select></label>' +
            '<p class="iba-ai-help" id="iba-ai-key-help">' + esc(b.keyHelp) + (b.keyUrl ? ' <a href="' + esc(b.keyUrl) + '" target="_blank" rel="noopener">Open <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') + '</p>' +
            '<label class="iba-ai-field" id="iba-ai-key-row"' + (b.needsKey ? '' : ' hidden') + '><span>API key</span><input id="iba-ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste the key here" value="' + esc(c.key) + '"/></label>' +
            '<label class="iba-ai-field"><span>Model</span><input id="iba-ai-model" type="text" spellcheck="false" value="' + esc(c.model) + '"/></label>' +
            '<label class="iba-ai-field"><span>Address</span><input id="iba-ai-url" type="text" spellcheck="false" value="' + esc(c.baseUrl) + '"/></label>' +
            (isSuper() ? '<label class="iba-ai-field"><span>Who can use the assistant</span><select id="iba-ai-aud">' +
                '<option value="everyone"' + (audience !== 'me' ? ' selected' : '') + '>Everyone (each with their own key; tracking needs no key)</option>' +
                '<option value="me"' + (audience === 'me' ? ' selected' : '') + '>Only me</option></select></label>' : '') +
            '<div class="iba-ai-setup-actions"><button type="button" class="iba-ai-btn is-main" id="iba-ai-save"><i class="fa-solid fa-floppy-disk"></i> Save</button>' +
            '<button type="button" class="iba-ai-btn" id="iba-ai-test"><i class="fa-solid fa-plug-circle-check"></i> Test</button></div>' +
            '<p class="iba-ai-status" id="iba-ai-setup-status"></p>' +
            '<p class="iba-ai-help small"><i class="fa-solid fa-lock"></i> This key is yours: it stays only in this browser, for your account. It is not saved in the system or in Firebase, and nobody else uses it. ' +
            'The assistant reads only what a job needs and never saves, approves or deletes anything by itself.</p>';
        const pick = $('iba-ai-brain-pick');
        pick.addEventListener('change', () => {
            const nb = BRAINS[pick.value];
            $('iba-ai-model').value = nb.model;
            $('iba-ai-url').value = nb.baseUrl;
            $('iba-ai-key-row').hidden = !nb.needsKey;
            const saved = lsGet(cfgKey(), {}) || {};
            $('iba-ai-key').value = saved.brain === pick.value ? (saved.key || '') : '';
            $('iba-ai-key-help').innerHTML = esc(nb.keyHelp) + (nb.keyUrl ? ' <a href="' + esc(nb.keyUrl) + '" target="_blank" rel="noopener">Open <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '');
        });
        const save = () => {
            const brain = pick.value;
            setCfg({ brain: brain, key: String($('iba-ai-key').value || '').trim(), model: String($('iba-ai-model').value || '').trim(),
                     baseUrl: String($('iba-ai-url').value || '').trim().replace(/\/+$/, '') });
            $('iba-ai-brain').textContent = ready() ? brainLabel() : 'Not set up yet';
            refreshFab();
        };
        $('iba-ai-save').addEventListener('click', () => {
            save();
            const aud = $('iba-ai-aud');
            if (aud && isSuper() && aud.value !== (audience || 'everyone')) {
                const ref = settingsRef();
                audience = aud.value;
                if (ref) ref.set(aud.value).catch(() => {
                    const st2 = $('iba-ai-setup-status');
                    if (st2) { st2.className = 'iba-ai-status is-bad'; st2.textContent = 'Could not save "Who can use the assistant" (Firebase rules). See PATCH.txt.'; }
                });
            }
            const st = $('iba-ai-setup-status');
            st.className = 'iba-ai-status ' + (ready() ? 'is-ok' : 'is-bad');
            st.textContent = ready() ? 'Saved. Press Test, or go back and ask me something.' : 'Saved, but the key or model is still missing.';
        });
        $('iba-ai-test').addEventListener('click', async () => {
            save();
            const st = $('iba-ai-setup-status');
            st.className = 'iba-ai-status';
            st.textContent = 'Testing…';
            try {
                const m = await callBrain([{ role: 'system', content: 'Reply with exactly: OK' }, { role: 'user', content: 'Test' }], false);
                st.className = 'iba-ai-status is-ok';
                st.textContent = 'Working. The brain answered: ' + String(m.content || '').trim().slice(0, 60);
            } catch (err) {
                st.className = 'iba-ai-status is-bad';
                st.textContent = (err && err.message) || String(err);
            }
        });
    }

    // ---- greeting, peek and the daily brief ---------------------------
    function greetingWord() { const h = qatarParts().h; return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
    function firstName() { return (myName().split(/\s+/)[0]) || ''; }
    function greetIfEmpty(force) {
        const l = log();
        if (!l || (l.children.length && !force)) return;
        addBot(greetingWord() + ', ' + firstName() + '. How can I help?\n' + (isSuper()
            ? '- "What\'s waiting for me?"\n- "Show PO 12345"\n- "Where is the Al Noor invoice for site 177, 2025?"\n- "New invoice for PO 12345: B-300, 5,000, For SRV to Bob"\n- "Draft a reminder to Bob about PO 12345"'
            : '- "Where is the invoice for PO 12345?"\n- "Al Noor invoices, site 177, 2025"\n- "What\'s waiting for me?"\n- "Draft a reminder to Bob about PO 12345"\nTo track an invoice without the AI, use the route button above.'), {});
        const last = l.lastElementChild;
        if (last) { const t = last.querySelector('.iba-ai-msg-tools'); if (t) t.remove(); }
    }
    function peek(text) {
        toggle(false);
        showBubble('<i class="fa-solid fa-wand-magic-sparkles"></i><div class="iba-ai-bubble-text">' + md(String(text || '').split('\n')[0].slice(0, 160)) + '</div>' +
            '<div class="iba-ai-bubble-actions"><button type="button" data-bubble="open">Back to chat</button><button type="button" data-bubble="x" title="Dismiss">×</button></div>', 12000);
    }
    let bubbleTimer = 0;
    function showBubble(html, ms) {
        const b = $('iba-ai-bubble');
        if (!b) return;
        b.innerHTML = html;
        b.hidden = false;
        clearTimeout(bubbleTimer);
        if (ms) bubbleTimer = setTimeout(hideBubble, ms);
    }
    function hideBubble() { const b = $('iba-ai-bubble'); if (b) b.hidden = true; clearTimeout(bubbleTimer); }

    function briefOnce() {
        const day = todayISO() + '|' + norm(myName());
        if (lsGet(BRIEF_KEY, '') === day) return;
        let tries = 0;
        const tick = () => {
            if (!allowed()) return;
            const w = waiting();
            if ((!w || !w.running || !(w.counts.task || w.counts.job || w.tasks.length)) && tries++ < 8) { setTimeout(tick, 2500); return; }
            lsSet(BRIEF_KEY, day);
            const tasks = w ? w.tasks.slice().sort(oldestFirst) : [];
            const nt = w ? (w.counts.task || tasks.length) : 0;
            const nj = w ? (w.counts.job || w.jobs.length) : 0;
            const oldest = tasks[0];
            let line = nt || nj
                ? '<b>' + nt + '</b> task' + (nt === 1 ? '' : 's') + ' and <b>' + nj + '</b> job' + (nj === 1 ? '' : 's') + ' are waiting.' +
                  (oldest && oldest.po ? ' Oldest: PO ' + esc(oldest.po) + (daysSince(oldest.at) !== null ? ' · ' + daysSince(oldest.at) + ' days' : '') + '.' : '')
                : 'Nothing is waiting for you right now.';
            const setup = !ready();
            const track = setup && !isSuper();
            showBubble('<i class="fa-solid fa-wand-magic-sparkles"></i><div class="iba-ai-bubble-text"><strong>' + esc(greetingWord()) + ', ' + esc(firstName()) + '.</strong> ' + line +
                (track ? '<br><small>New: ask the assistant where any invoice is, no setup needed.</small>' : setup ? '<br><small>Your assistant is ready to set up (free, 2 minutes).</small>' : '') + '</div>' +
                '<div class="iba-ai-bubble-actions"><button type="button" data-bubble="open" data-then="' + (track ? 'track' : setup ? 'setup' : 'brief') + '">' + (track ? 'Track invoice' : setup ? 'Set up' : 'Open brief') + '</button>' +
                '<button type="button" data-bubble="x" title="Dismiss">×</button></div>', 20000);
        };
        setTimeout(tick, 4000);
    }

    function pillCount() {
        let n = 0;
        document.querySelectorAll('#iba-live-counts .iba-live-pill[data-count]').forEach((p) => { if (!p.hidden) n += Number(p.getAttribute('data-count')) || 0; });
        return n;
    }
    function refreshFab() {
        const fab = $('iba-ai-fab');
        if (!fab) return;
        const n = pillCount();
        fab.classList.toggle('has-items', n > 0);
        fab.classList.toggle('needs-setup', !ready());
    }

    // ---- start / stop with the session --------------------------------
    let on = false;
    function watch() {
        const ok = allowed();
        if (ok && !on) {
            on = true;
            build();
            $('iba-ai-fab').hidden = false;
            refreshFab();
            briefOnce();
        } else if (!ok && on) {
            on = false;
            const fab = $('iba-ai-fab');
            if (fab) fab.hidden = true;
            toggle(false);
            hideBubble();
            state.history = [];
            state.lastTurn = null;
            if (log()) log().innerHTML = '';
            skillsPulled = false;
        } else if (ok) refreshFab();
    }
    function boot() {
        watch();
        setInterval(watch, 2000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    window.ibaAssistant = {
        VERSION: VERSION,
        open: () => { if (allowed()) { build(); toggle(true); } },
        ask: (t) => { if (allowed()) { build(); toggle(true); return ask(t); } },
        runSkill: (n) => runSkill(n),
        tools: () => toolDefs().map((t) => t.name),
        _run: runTool,
        _card: (c) => addCard(c),
        _state: state
    };
})();
