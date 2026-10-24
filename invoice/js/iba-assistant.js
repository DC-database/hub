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

    const VERSION = '17.0.2';
    const CFG_KEY = 'iba-ai-brain-v1';
    const SKILLS_KEY = 'iba-ai-skills-v1';
    const BRIEF_KEY = 'iba-ai-brief-day-v1';
    const MAX_TOOL_ROUNDS = 5;
    const HISTORY_KEEP = 8;

    const BRAINS = {
        groq: { label: 'Groq (free)', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', needsKey: true,
            keyUrl: 'https://console.groq.com/keys', keyHelp: 'Sign in at console.groq.com (free, no card) > API Keys > Create API Key. Tip: in Settings > Data Controls turn on Zero Data Retention.' },
        gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', needsKey: true,
            keyUrl: 'https://aistudio.google.com/apikey', keyHelp: 'Open Google AI Studio (aistudio.google.com) > Get API key > Create API key, then copy it here. Use the copy button next to the key so the whole key is copied. On the free plan Google may use and read what you send.' },
        ollama: { label: 'Ollama (a PC)', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:8b', needsKey: false,
            keyUrl: 'https://ollama.com/download', keyHelp: 'Runs on this PC only (no internet AI, nothing leaves the PC). Needs a good PC (8 GB RAM or more; 16 GB is better). Easiest: press "Download setup file", run it once (double-click), then come back and press Find models, Save and Test.',
            setupFile: true,
            guide: [
                'Download and install Ollama from ollama.com/download, then open it once.',
                'Open "Command Prompt" and type:  ollama pull qwen3:8b  (a few GB; wait until it finishes).',
                'Allow this website to use it: press Windows key, type "environment variables", open "Edit the system environment variables" > Environment Variables > New (under "User variables"). Name: OLLAMA_ORIGINS  Value: https://port.iba.com.qa',
                'Quit Ollama (right-click its icon near the clock > Quit) and open it again.',
                'Back here: Brain = Ollama, Model = qwen3:8b, press Save, then Test. If Chrome asks to allow access to local devices, press Allow.'
            ] },
        // 15.0.0 patch 25: more ready-made services (all "OpenAI-compatible").
        // Paste a key and the right one is picked; the model list comes from
        // the service itself (Find models), so new model names just work.
        openrouter: { label: 'OpenRouter (free models)', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-oss-20b:free', needsKey: true,
            keyUrl: 'https://openrouter.ai/keys', keyHelp: 'Sign in at openrouter.ai > Keys > Create key (starts with "sk-or-"). Models whose name ends with ":free" cost nothing.' },
        cerebras: { label: 'Cerebras (free)', baseUrl: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', needsKey: true,
            keyUrl: 'https://cloud.cerebras.ai/platform', keyHelp: 'Sign in at cloud.cerebras.ai > API Keys > Generate (starts with "csk-"). Free plan with daily limits.' },
        mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', needsKey: true,
            keyUrl: 'https://console.mistral.ai/api-keys', keyHelp: 'Sign in at console.mistral.ai > API Keys > Create new key. The free "Experiment" plan works.' },
        openai: { label: 'OpenAI (paid)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true,
            keyUrl: 'https://platform.openai.com/api-keys', keyHelp: 'platform.openai.com > API keys > Create new secret key (starts with "sk-"). Paid per use.' },
        custom: { label: 'Other (OpenAI-compatible)', baseUrl: '', model: '', needsKey: true, keyUrl: '', keyHelp: 'Any other AI service that says "OpenAI-compatible": paste its address (ends with /v1) and its key, then press Find models.' }
    };
    // which service a key belongs to, from how it starts
    function brainOfKey(k) {
        const key = String(k || '').trim();
        if (/^gsk_/i.test(key)) return 'groq';
        if (/^(AIza|AQ\.)/.test(key)) return 'gemini';
        if (/^sk-or-/i.test(key)) return 'openrouter';
        if (/^csk-/i.test(key)) return 'cerebras';
        if (/^sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/.test(key)) return 'openai';
        return '';
    }
    // the best model from the service's own list
    const MODEL_PREF = {
        groq: [/^openai\/gpt-oss-120b$/, /^llama-3\.3-70b-versatile$/, /^openai\/gpt-oss-20b$/, /llama|qwen|gpt-oss/],
        gemini: [/^gemini-[\d.]+-flash$/, /^gemini-flash-latest$/, /^gemini-[\d.]+-flash(-\d+)?$/, /flash(?!.*(lite|image|tts|live|audio|embed|thinking))/, /^gemini-[\d.]+-pro$/],
        openrouter: [/gpt-oss-120b:free$/, /gpt-oss-20b:free$/, /llama-3\.3-70b-instruct:free$/, /qwen.*:free$/, /:free$/],
        cerebras: [/^gpt-oss-120b$/, /^llama-3\.3-70b$/, /qwen-3/, /llama/],
        mistral: [/^mistral-small-latest$/, /^mistral-medium-latest$/, /^mistral-large-latest$/, /^mistral-/],
        openai: [/^gpt-4\.1-mini$/, /^gpt-4o-mini$/, /^gpt-[\d.]+-mini$/, /^gpt-/],
        ollama: [/^qwen3/, /^qwen/, /^llama3/, /./],
        custom: [/./]
    };
    const MODEL_SKIP = /(embed|whisper|tts|audio|image|vision-only|guard|moderation|transcribe|dall-e|veo|imagen|aqa|rerank|-live)/i;
    function pickModel(brain, ids, current) {
        const list = (ids || []).filter((m) => !MODEL_SKIP.test(m));
        if (current && list.indexOf(current) !== -1) return current;
        const prefs = MODEL_PREF[brain] || [/./];
        for (const re of prefs) {
            const hits = list.filter((m) => re.test(m)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            if (hits.length) return hits[0];
        }
        return list[0] || current || '';
    }
    async function listModels(c) {
        const url = String(c.baseUrl || '').replace(/\/+$/, '') + '/models';
        const tryOnce = async (googleHeader) => {
            const headers = {};
            if (c.key && googleHeader) headers['x-goog-api-key'] = c.key;
            else if (c.key) headers.Authorization = 'Bearer ' + c.key;
            const res = await fetch(url, { headers: headers, cache: 'no-store' });
            let data = null; try { data = await res.json(); } catch (_) {}
            if (!res.ok) { const e = new Error((data && data.error && (data.error.message || data.error)) || ('HTTP ' + res.status)); e.status = res.status; throw e; }
            const arr = (data && (data.data || data.models)) || [];
            return arr.map((m) => String((m && (m.id || m.name)) || '').replace(/^models\//, '')).filter(Boolean);
        };
        try { return await tryOnce(false); }
        catch (e) { if (c.brain === 'gemini' && (e.status === 401 || e.status === 403)) return await tryOnce(true); throw e; }
    }

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
    // 15.0.0 patch 37: Admins (and the Super Admin) may mark approvals urgent
    function isAdminUser() { const a = me(); return isSuper() || (!!a && norm(a.Role).indexOf('admin') !== -1); }
    function isDelegate() {
        try { return typeof isVacationDelegateUser === 'function' && !!isVacationDelegateUser(); } catch (_) { return false; }
    }
    // 15.0.0 patch 1: Reception receives invoices for every site, so it sees all sites too
    const WIDE_TOKENS = ['coo', 'ceo', 'finance', 'accounting', 'accounts', 'qs', 'seniorqs', 'logistic', 'logistics', 'procurement', 'reception', 'receptionist'];
    function access() {
        const a = me() || {};
        const pos = norm(a.Position);
        const role = norm(a.Role);
        const tokens = pos.split(/[^a-z0-9]+/).filter(Boolean);
        const sup = isSuper();
        const del = isDelegate();
        // 15.0.0 patch 18: Site "All" (as in the rest of IBA) means every site
        const allSite = /(^|[\s,;\/])all([\s,;\/]|$)/i.test(String(a.Site || ''));
        const wide = sup || del || allSite || pos.includes('manager') || /senior\s*qs/.test(pos) || tokens.some((t) => WIDE_TOKENS.indexOf(t) !== -1);
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
    // 15.0.0 patch 23: the assistant also runs on the phone, opened from a
    // robot button in the phone's top bar (no floating robot or tips there),
    // full screen. Jobs that open desktop pages are left out on the phone.
    function onPhone() { const b = document.body; return !!(b && b.classList.contains('iba-phone')); }
    // 15.0.0 patch 25: on the phone the assistant only searches, tracks,
    // reminds and messages. Everything else (brief, Batch Entry, new invoice,
    // reports, downloads) is on the computer.
    // 15.0.0 patch 27: invoices by PO or vendor only (no search by status)
    const PHONE_ALLOW = ['track_invoices', 'invoice_activity', 'find_po', 'track_transfer', 'find_transfers', 'find_person'];
    const PHONE_TPL = ['inv_status', 'transfer', 'person'];
    function phoneOk(name) { return !onPhone() || PHONE_ALLOW.indexOf(name) !== -1; }
    const PHONE_NO = 'On the phone the assistant searches, tracks, reminds and messages (and shows Now brief). Batch Entry, new invoices, reports and downloads are on the computer.';
    function allowed() {
        const b = document.body;
        if (!b || !(b.classList.contains('iba-shell-on') || b.classList.contains('iba-phone'))) return false;
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
        // 15.0.0 patch 9: older setups saved a Gemini model name that is not always available
        if (brain === 'gemini' && /^gemini-flash-latest$/i.test(String(c.model || ''))) c.model = def.model;
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
                  pos: { type: 'array', items: { type: 'string' }, description: 'PO numbers. Leave out (with a status) to take every invoice now in that status, e.g. "all the CEO Approval ones".' },
                  status: { type: 'string', description: 'Only invoices whose current status is this (leave out for all open invoices of the POs; With Accounts and Paid are then left out)' },
                  latest_only: { type: 'boolean', description: 'true = only the last invoice entered on each PO ("the recent / last invoice")' },
                  include_finished: { type: 'boolean', description: 'true only if the user wants With Accounts / Paid invoices too' },
                  set_status: { type: 'string', description: 'New status for all rows (Set All Statuses To), only if the user asked' },
                  set_attention: { type: 'string', description: 'Person for all rows (Set All Attention To), only if the user asked' },
                  set_note: { type: 'string', description: 'Note for all rows, only if the user asked' } } } },
            { name: 'recent_status_changes', description: 'Invoices whose status was changed to a given status within a time window (last N hours, this morning, this afternoon, today, yesterday), optionally only changes the user made. By default they are put into Batch Entry so the user can move them on together. Use for "take the Under Review ones from the last 2 hours", "the CEO Approval I did this morning".',
              parameters: { type: 'object', properties: {
                  status: statusProp,
                  hours: { type: 'number', description: 'Last N hours (e.g. 2). Leave out when the user says morning / afternoon / today / yesterday.' },
                  period: { type: 'string', enum: ['morning', 'afternoon', 'whole_day'], description: 'morning = before 12:00, afternoon = from 12:00 (Qatar time)' },
                  day: { type: 'string', enum: ['today', 'yesterday'] },
                  by_me: { type: 'boolean', description: 'true when the user says I / me / my (changes the user made)' },
                  add_to_batch: { type: 'boolean', description: 'false only when the user just wants to see the list' },
                  set_status: { type: 'string', description: 'New status for all rows in Batch Entry, only if the user asked' },
                  set_attention: { type: 'string', description: 'Person for all rows, only if the user asked' } }, required: ['status'] } },
            { name: 'find_person', description: 'A colleague\'s profile from the IBA user list: name, position, site, mobile number and email, with a button to message them inside IBA. Use for "what is the number of X", "who is X", "email of X", "who is the DC of site 177", "who works at site 178" (site + position).',
              parameters: { type: 'object', properties: {
                  name: { type: 'string', description: 'Name or first name (e.g. "Irwin"), or a mobile number (e.g. 55512345). Leave out when searching by site / position.' },
                  site: { type: 'string', description: 'Site number, e.g. "178": everyone working at that site' },
                  position: { type: 'string', description: 'Position(s), several separated by commas, e.g. "Site DC, Storekeeper"' } } } },
            { name: 'track_transfer', description: 'Inventory / Material: where a Transfer, Restock, Return or Usage request is now and WHO MUST ACT NEXT, by its control number (TRF-0361, STK-0012, USE-0040, RET-0007; digits alone also work). Gives each item, its step (Transfer: 1 source site confirms and sends -> 2 admin authorizes -> 3 receiver confirms receipt), the person who must act, since when, problems (e.g. no person set, name not a user) and the recent steps.',
              parameters: { type: 'object', properties: { control: { type: 'string', description: 'Control number(s), e.g. "TRF-0361"; several separated by commas.' } }, required: ['control'] } },
            { name: 'find_transfers', description: 'Inventory / Material: find Transfer, Restock, Return or Usage requests by what they say - a vehicle or equipment number (e.g. 36588), an item or machine (e.g. wheel loader, Komatsu), a product, a person or a site. Lists each matching control number with its items, the matching text, its step and who has it now. It looks through the transfers already loaded; when it says older ones were not searched, tell the user to press "Search all transfers" on the card (or call again with all=true only if the user asked to search everything).',
              parameters: { type: 'object', properties: {
                  text: { type: 'string', description: 'Words to look for, e.g. "36588" or "wheel loader"' },
                  open_only: { type: 'boolean', description: 'Only requests still waiting for someone' },
                  site: { type: 'string' }, when: { type: 'string', description: 'Optional period words for the request date' },
                  all: { type: 'boolean', description: 'Search every transfer (one download). Only when the user asks to search everything.' } }, required: ['text'] } },
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
            { name: 'download_invoices', description: 'Make a CSV file (opens in Excel) of the invoices now in ANY status, including Under Review, With Accounts and Paid - the same set Invoice Records shows for that status - optionally only those that reached it in a period, at a site or for a vendor. The user downloads it from the card. Use for "download / export / list / excel / csv" of invoices in a status.',
              parameters: { type: 'object', properties: {
                  status: { type: 'string', description: 'One status, or several joined with commas, e.g. "Under Review, With Accounts"' },
                  when: { type: 'string', description: 'any (default), 2h, today, yesterday, week, month, 30d' },
                  site: { type: 'string' }, vendor: { type: 'string' } }, required: ['status'] } },
            { name: 'invoice_activity', description: 'Who handled the invoices of a vendor or a PO and when: the latest actions (status changes and who did them, newest first), the last action, and who has each invoice now. Looks at the newest POs of the vendor. Use for "who last handled", "who managed", "what happened".',
              parameters: { type: 'object', properties: {
                  vendor: { type: 'string' }, po: { type: 'string' },
                  when: { type: 'string', description: 'Optional period words, e.g. "past week", "2026"' },
                  from: { type: 'string' }, to: { type: 'string' },
                  person: { type: 'string', description: 'Only actions by this person' } } } }
        ].filter((t) => (isSuper() || SUPER_ONLY.indexOf(t.name) === -1) && phoneOk(t.name));
    }

    // 15.0.0 patch 9: what the holder should do next, by status / step
    const NEXT_STEP = {
        'new entry': 'register it in Invoice Entry', 'pending': 'check it and move it to its next status',
        'under review': 'check the invoice and move it on (For SRV / In Process)',
        'for srv': 'confirm the delivery and mark SRV Done', 'srv done': 'send it on (approval or In Process)',
        'for approval': 'approve or reject it', 'ceo approval': 'CEO to approve it',
        'report': 'prepare the report and send it for approval', 'report approval': 'approve the report',
        'report approved': 'send it on to In Process', 'approved': 'process it: move it to its next step',
        'rejected': 'read the approver note, fix it and send it again', 'in process': 'get the CEO/COO approval, then send it With Accounts',
        'on hold': 'follow up why it is on hold', 'for ipc': 'prepare the IPC', 'ipc application': 'work the IPC application',
        'ipc processed': 'wait for the actual invoice, then enter it', 'for summary': 'include it in the summary for the CEO',
        'unresolved': 'resolve the issue with the vendor or site', 'with accounts': 'pay it', 'po close out': 'confirm the remaining quantity and close the PO',
        'pending source': 'confirm and send the items', 'pending admin': 'authorize the request', 'in transit': 'confirm the items were received',
        'pending confirmation': 'confirm the actual usage'
    };
    function nextStep(status) { return NEXT_STEP[norm(status)] || 'open it and move it to its next step'; }

    function compactTask(r) {
        const o = { type: r.type || r.kind, po: r.po || undefined, ref: r.ref || undefined, vendor: r.vendor || undefined, site: r.site || undefined,
            status: r.status || undefined, amount: r.amount ? money(r.amount) : undefined, waiting_days: rowWaitDays(r), next: nextStep(r.status) };
        if (r.note) o.note = String(r.note).slice(0, 80);
        return o;
    }
    function compactJob(j) {
        return { control: j.control, type: j.type, product: j.product, step: j.step, from: j.from || undefined, to: j.to || undefined,
            qty: j.qty || undefined, requestor: j.requestor || undefined, waiting_days: daysSince(j.at), next: nextStep(j.step) };
    }
    function oldestFirst(a, b) { return (a.at || 9e15) - (b.at || 9e15); }

    // 15.0.0 patch 10: the brief uses the same list as the Active Task page
    // (the Dashboard builds it at login and keeps it current), plus anything
    // newer from the live counts. No extra download.
    function atTime(t) {
        try { if (typeof wdActiveTaskQueueTimestamp === 'function') { const v = Number(wdActiveTaskQueueTimestamp(t)); if (v) return v; } } catch (_) {}
        return Number(t.timestamp || t.invoiceLastUpdated) || Date.parse(t.date || t.dateEntered || '') || 0;
    }
    function activeTaskSnapshot() {
        try {
            const raw = sessionStorage.getItem('IBA_ACTIVE_TASK_WORKDESK_SNAPSHOT_V3');
            if (!raw) return null;
            const snap = JSON.parse(raw);
            if (!snap || !Array.isArray(snap.tasks)) return null;
            if (typeof wdActiveTaskCacheUserKey === 'function' && snap.userKey !== wdActiveTaskCacheUserKey()) return null;
            return snap.tasks;
        } catch (_) { return null; }
    }
    function briefLists(w) {
        const seen = new Set();
        const sig = (r) => [r.key ? 'k:' + String(r.key) : '', r.po && r.ref ? 'p:' + norm(r.po) + '|' + norm(r.ref) : ''].filter(Boolean);
        const add = (list, r) => { const k = sig(r); if (k.some((x) => seen.has(x))) return; k.forEach((x) => seen.add(x)); list.push(r); };
        const tasks = [];
        const snap = activeTaskSnapshot();
        if (snap) snap.forEach((t) => {
            if (!t || t.isUrgent === false) return;
            add(tasks, { kind: t.source === 'invoice' ? 'invoice' : 'job', key: String(t.key || ''), type: String(t.displayFor || t.for || (t.source === 'invoice' ? 'Invoice' : '')),
                po: String(t.po || t.originalPO || ''), ref: String(t.ref || t.invNumber || t.invEntryID || ''), vendor: String(t.vendorName || ''),
                site: String(t.site || ''), status: String(t.remarks || t.status || ''), amount: t.amount || t.invValue || '',
                attention: String(t.attention || ''), note: String(t.note || ''), at: atTime(t) });
        });
        (w.tasks || []).forEach((t) => add(tasks, t));
        const jobs = [];
        const ctl = new Set();
        let inv = [];
        try { if (typeof inventoryActiveTasks !== 'undefined' && Array.isArray(inventoryActiveTasks)) inv = inventoryActiveTasks; } catch (_) {}
        inv.forEach((e) => {
            if (!e || e.isUrgent !== true) return;
            const c = String(e.controlNumber || e.controlId || e.ref || e.key || '');
            // 15.0.0 patch 11: one line per item (a Multi transfer has several
            // items under the same control number)
            const id = 'k:' + String(e.key || c);
            if (ctl.has(id)) return;
            ctl.add(id);
            jobs.push({ kind: 'inventory', key: String(e.key || ''), control: c, type: String(e.jobType || e.for || 'Transfer'), product: String(e.productName || e.vendorName || ''),
                step: String(e.remarks || e.status || ''), from: String(e.fromSite || e.fromLocation || ''), to: String(e.toSite || e.toLocation || ''),
                qty: e.orderedQty || e.requiredQty || '', requestor: String(e.requestor || ''), at: Number(e.timestamp) || 0 });
        });
        (w.jobs || []).forEach((j) => { const id = 'k:' + String(j.key || j.control); if (!ctl.has(id)) { ctl.add(id); jobs.push(j); } });
        return { tasks: tasks, jobs: jobs };
    }

    // ------------------------------------------------------------------
    // 15.0.0 patch 11: printable brief (A4 checklist with charts). Opens a
    // print page; "Save as PDF" in the print window keeps a copy.
    // ------------------------------------------------------------------
    const briefStore = new Map();
    let briefSeq = 0;
    function ageBucket(days) { return days === null || days === undefined ? 3 : days <= 2 ? 0 : days <= 7 ? 1 : days <= 30 ? 2 : 3; }
    function barsSvg(rows, w) {
        // one series, so one ink colour; every bar carries its own label and value
        const max = Math.max(1, ...rows.map((r) => r.n));
        const lw = 128, rowH = 22, bw = w - lw - 44;
        const h = rows.length * rowH + 4;
        return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img">' + rows.map((r, i) => {
            const y = i * rowH + 3;
            const len = Math.max(r.n ? 3 : 0, Math.round(bw * r.n / max));
            return '<text x="' + (lw - 8) + '" y="' + (y + 13) + '" text-anchor="end" class="lbl">' + esc(r.label) + '</text>' +
                '<rect x="' + lw + '" y="' + (y + 2) + '" width="' + bw + '" height="14" rx="3" class="track"/>' +
                (len ? '<rect x="' + lw + '" y="' + (y + 2) + '" width="' + len + '" height="14" rx="3" class="bar' + (r.cls ? ' ' + r.cls : '') + '"/>' : '') +
                '<text x="' + (lw + len + 6) + '" y="' + (y + 13) + '" class="val">' + r.n + '</text>';
        }).join('') + '</svg>';
    }
    function printBrief(x) {
        const r = x.result || {};
        const tasks = x.tasks || [], jobs = x.jobs || [];
        const now = new Date();
        const when = fmtDate(now.getTime()) + ' ' + fmtClock(now.getTime());
        const byStatus = r.tasks_by_status || {};
        const stRows = Object.keys(byStatus).sort((a, b) => byStatus[b] - byStatus[a]).map((k) => ({ label: k, n: byStatus[k] }));
        const ages = [0, 0, 0, 0];
        tasks.concat(jobs).forEach((t) => { ages[ageBucket(daysSince(t.at))]++; });
        const ageRows = [{ label: '0-2 days', n: ages[0] }, { label: '3-7 days', n: ages[1] }, { label: '8-30 days', n: ages[2], cls: 'warn' }, { label: 'Over 30 days', n: ages[3], cls: 'late' }];
        const rems = remList.filter((m) => !m.seenAt);
        const apv = ((x.approvals && x.approvals.items) || []).slice().sort((p, q) => apvWho(p).localeCompare(apvWho(q)) || ((q.days || 0) - (p.days || 0)));
        const box = '<span class="box"></span>';
        const kpi = (n, l) => '<div class="kpi"><b>' + esc(n) + '</b><span>' + esc(l) + '</span></div>';
        const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>IBA brief - ' + esc(firstName()) + ' - ' + esc(fmtDate(now.getTime())) + '</title><style>' +
            '@page{margin:14mm 12mm}*{box-sizing:border-box}body{margin:0;font:12px/1.4 Arial,Helvetica,sans-serif;color:#1b2430;background:#fff}' +
            '.bar-top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E7F74;padding-bottom:8px;margin-bottom:12px}' +
            'h1{margin:0;font-size:20px;letter-spacing:.02em}h1 small{display:block;font-size:12px;font-weight:400;color:#5b6775;margin-top:2px}.meta{text-align:right;color:#5b6775;font-size:11px}' +
            '.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}.kpi{border:1px solid #d5dce3;border-radius:8px;padding:8px 10px}.kpi b{display:block;font-size:20px}.kpi span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#5b6775}' +
            '.charts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}.chartbox{border:1px solid #d5dce3;border-radius:8px;padding:8px 10px}.chartbox h3{margin:0 0 6px;font-size:12px}' +
            'svg.chart{display:block;max-width:100%;height:auto}svg .lbl{font-size:10.5px;fill:#1b2430}svg .val{font-size:10.5px;font-weight:700;fill:#1b2430}svg .track{fill:#eef2f5}svg .bar{fill:#1E7F74}svg .bar.warn{fill:#B7791F}svg .bar.late{fill:#B42318}' +
            'h2{font-size:13px;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #d5dce3}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#5b6775;border-bottom:1px solid #b8c2cc;padding:4px 5px}' +
            'td{border-bottom:1px solid #e3e8ed;padding:5px;vertical-align:top}tr{page-break-inside:avoid}td.c{width:22px}td.n{text-align:right;white-space:nowrap}td.next{color:#3d4854;font-style:italic}.late{color:#B42318;font-weight:700}' +
            '.box{display:inline-block;width:12px;height:12px;border:1.5px solid #1b2430;border-radius:2px}.notes{margin-top:16px}.notes div{border-bottom:1px solid #b8c2cc;height:24px}' +
            '.foot{margin-top:14px;color:#8a95a1;font-size:10px;text-align:center}.tools{position:fixed;top:10px;right:10px;display:flex;gap:6px}.tools button{font:600 12px Arial;padding:7px 12px;border-radius:6px;border:1px solid #1E7F74;background:#1E7F74;color:#fff;cursor:pointer}.tools button+button{background:#fff;color:#1E7F74}' +
            '.newpage{page-break-before:always;break-before:page}' +
            '@media print{.tools{display:none}}' +
            '</style></head><body>' +
            '<div class="tools"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>' +
            '<div class="bar-top"><h1>IBA daily brief<small>' + esc(myName()) + '</small></h1><div class="meta">' + esc(when) + '<br>Checklist: tick each item when done</div></div>' +
            '<div class="kpis">' + kpi(r.active_task || 0, 'Active Task') + kpi(r.active_job || 0, 'Active Job') + kpi(r.new_today || 0, 'New today') + kpi(rems.length, 'Reminders') +
                kpi(r.po_closeout ? r.po_closeout.ready_to_close : '—', 'Ready to close') + '</div>' +
            '<div class="charts"><div class="chartbox"><h3>Tasks by status</h3>' + (stRows.length ? barsSvg(stRows, 330) : '<p>Nothing waiting.</p>') + '</div>' +
                '<div class="chartbox"><h3>How long items have waited</h3>' + barsSvg(ageRows, 330) + '</div></div>' +
            (rems.length ? '<h2>Reminders for you</h2><table><thead><tr><th></th><th>From</th><th>Reminder</th><th>PO / No.</th><th>Date</th></tr></thead><tbody>' +
                rems.map((m) => '<tr><td class="c">' + box + '</td><td>' + esc(m.from || '') + '</td><td>' + esc(m.text || '') + '</td><td>' + esc(m.po || m.control || '') + '</td><td class="n">' + esc(fmtDate(m.at)) + '</td></tr>').join('') + '</tbody></table>' : '') +
            '<h2>Active Task (' + tasks.length + ', oldest first)</h2>' + (tasks.length ? '<table><thead><tr><th></th><th>#</th><th>PO</th><th>Vendor / Ref</th><th>Status</th><th>Next step</th><th>Amount</th><th>Waiting</th></tr></thead><tbody>' +
                tasks.map((t, i) => { const dd = daysSince(t.at); return '<tr><td class="c">' + box + '</td><td>' + (i + 1) + '</td><td><b>' + esc(t.po || '—') + '</b></td><td>' + esc(t.vendor || t.type || '') + (t.ref ? '<br><small>' + esc(t.ref) + '</small>' : '') + '</td><td>' + esc(t.status || '') + '</td><td class="next">' + esc(nextStep(t.status)) + '</td><td class="n">' + (t.amount ? esc(money(t.amount)) : '') + '</td><td class="n' + (dd > 30 ? ' late' : '') + '">' + (dd === null ? '' : dd + ' d') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>Nothing waiting.</p>') +
            (jobs.length ? '<h2>Active Job - inventory (' + jobs.length + ')</h2><table><thead><tr><th></th><th>Control</th><th>Item</th><th>Step</th><th>Route</th><th>Next step</th><th>Waiting</th></tr></thead><tbody>' +
                jobs.map((j) => { const dd = daysSince(j.at); return '<tr><td class="c">' + box + '</td><td><b>' + esc(j.control) + '</b></td><td>' + esc(j.product || '') + '</td><td>' + esc(j.step || '') + '</td><td>' + esc([j.from, j.to].filter(Boolean).join(' → ')) + '</td><td class="next">' + esc(nextStep(j.step)) + '</td><td class="n' + (dd > 30 ? ' late' : '') + '">' + (dd === null ? '' : dd + ' d') + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
            // 15.0.0 patch 44: invoices sent for approval, on a page of their own
            (apv.length ? '<div class="newpage"></div><h2>In the company: waiting for approval (' + apv.length + ')</h2><table><thead><tr><th></th><th>PO</th><th>Vendor / Inv. No.</th><th>Status</th><th>With</th><th>Amount</th><th>Waiting</th></tr></thead><tbody>' +
                apv.map((a) => '<tr><td class="c">' + box + '</td><td><b>' + esc(a.po) + '</b>' + (a.urgent ? '<br><small class="late">URGENT</small>' : '') + '</td><td>' + esc(a.vendor || '') + (a.no ? '<br><small>' + esc(a.no) + '</small>' : '') + '</td><td>' + esc(a.status) + '</td><td>' + esc(a.with || '') + '</td><td class="n">' + (a.value ? esc(money(a.value)) : '') + '</td><td class="n' + (a.days > 7 ? ' late' : '') + '">' + (a.days === null ? '' : a.days + ' d') + '</td></tr>').join('') + '</tbody></table>' : '') +
            '<div class="notes"><h2>Notes</h2><div></div><div></div><div></div></div>' +
            '<div class="foot">Printed from IBA ' + esc(VERSION) + ' · ' + esc(when) + '</div>' +
            '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});<\/script></body></html>';
        const w = window.open('', '_blank');
        if (!w) { alert('Please allow pop-ups for IBA to print the brief.'); return; }
        w.document.open(); w.document.write(html); w.document.close();
    }

    // ------------------------------------------------------------------
    // 15.0.0 patch 44: invoices sent for approval (For Approval / CEO
    // Approval), waiting on the CEO, the COO or another approver. Rows come
    // from the small approval list Active Task already uses (status index);
    // each invoice is then read once for its INV / SRV files and who sent it.
    // ------------------------------------------------------------------
    const APV_LIMIT = 80;
    function attNames(att) { return String(att || '').split(/\s*(?:,|;|\/|&|\band\b)\s*/i).map(norm).filter(Boolean); }
    async function sentForApproval() {
        if (typeof window.wdReadApprovalRowsFromAll !== 'function') return { items: [], error: 'the approval list is not available on this page' };
        const rows = (await window.wdReadApprovalRowsFromAll()) || {};
        const idb = (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null;
        const mine = norm(myName());
        const acc = access();
        const seen = new Set();
        const list = [];
        Object.keys(rows).forEach((k) => {
            const r = rows[k];
            if (!r || typeof r !== 'object' || !APPROVAL_RX.test(String(r.status || '').trim())) return;
            const po = String(r.po || r.originalPO || '').trim();
            const key = String(r.originalKey || r.invoiceKey || k).trim();
            if (!po || !key || seen.has(po + '|' + key)) return;
            seen.add(po + '|' + key);
            if (mine && attNames(r.attention).indexOf(mine) !== -1) return; // already in your own Active Task
            if (!acc.allSites && acc.sites.indexOf(siteNo(r.site)) === -1) return;
            list.push({ po: po, key: key, row: r });
        });
        list.sort((a, b) => (Number(a.row.statusChangedAt) || Number(a.row.invoiceLastUpdated) || 9e15) - (Number(b.row.statusChangedAt) || Number(b.row.invoiceLastUpdated) || 9e15));
        const pm = poMap();
        const items = [];
        await Promise.all(list.slice(0, APV_LIMIT).map(async (c) => {
            let inv = null;
            try { if (idb) inv = (await idb.ref('invoice_entries/' + c.po + '/' + c.key).once('value')).val(); } catch (_) { inv = null; }
            const r = c.row;
            const src = inv || r;
            const status = String(src.status || '').trim();
            if (!APPROVAL_RX.test(status)) return; // moved on since the list was written
            const rec = pm[String(c.po).toUpperCase()] || {};
            const hist = inv ? historyList(inv) : [];
            let sentAt = 0, sentBy = '';
            for (let i = hist.length - 1; i >= 0; i--) {
                if (norm(hist[i].status) === norm(status)) { sentAt = hist[i].at; sentBy = hist[i].by; } else if (sentAt) break;
            }
            const at = sentAt || Number(src.approvalRequestedAt) || Number(src.statusChangedAt) || Number(src.lastUpdated || src.invoiceLastUpdated) || 0;
            const value = num(src.invValue || r.amount);
            items.push({
                po: c.po, key: c.key, no: src.invNumber || r.ref || src.invEntryID || '', entry: src.invEntryID || '',
                vendor: src.vendorName || r.vendorName || rec['Supplier Name'] || '', site: src.site || r.site || rec['Project ID'] || '',
                value: acc.amounts && value ? value : 0, status: status, with: String(src.attention || r.attention || '').trim(),
                at: at, days: at ? daysSince(at) : null, sent_by: sentBy || String(src.enteredBy || r.enteredBy || ''),
                note: String(src.note || ''), urgent: isUrgentNote(src.note), invoice_date: src.invoiceDate || r.invoiceDate || '',
                details: String((inv && inv.details) || ''),
                pdf: invPdfUrl(src), srv: inv ? srvPdfUrl(inv) : '', approvals: Number((inv && inv.approvalCount) || 0)
            });
        }));
        items.sort((a, b) => ((b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)) || ((b.days || 0) - (a.days || 0)) || String(a.po).localeCompare(String(b.po)));
        return { items: items, more: Math.max(0, list.length - APV_LIMIT) };
    }
    // 15.0.0 patch 45: counts by who is approving (the CEO marked as such)
    function apvWho(a) { return (a.with || 'Nobody named') + (/ceo/i.test(a.status) ? ' (CEO)' : ''); }
    function apvCounts(items) {
        const by = {};
        items.forEach((a) => { const k = apvWho(a); by[k] = (by[k] || 0) + 1; });
        return by;
    }
    // 15.0.0 patch 45: the approvals print is ONE list, grouped by who is
    // approving (or by status / site - switch in the print window), each
    // group with its count and value. Replaces the one-page-per-invoice print.
    const APV_GROUPS = [['with', 'Who is approving'], ['status', 'Status'], ['site', 'Site']];
    function printApprovalList(items, groupBy) {
        if (!items || !items.length) { alert('No invoice is waiting for approval.'); return; }
        const now = new Date();
        const when = fmtDate(now.getTime()) + ' ' + fmtClock(now.getTime());
        const keyOf = { with: apvWho, status: (a) => a.status || '—', site: (a) => a.site || '—' };
        const anyValue = items.some((a) => a.value);
        const files = (a) => [a.pdf ? '<a href="' + esc(a.pdf) + '">INV</a>' : '', a.srv ? '<a href="' + esc(a.srv) + '">SRV</a>' : ''].filter(Boolean).join(' · ');
        const section = (g) => {
            const groups = new Map();
            items.forEach((a) => { const k = keyOf[g](a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });
            const keys = Array.from(groups.keys()).sort((x, y) => groups.get(y).length - groups.get(x).length || x.localeCompare(y));
            const cols = [['#', ''], ['', 'c'], ['PO', ''], ['Vendor / Invoice no.', '']].concat(g === 'with' ? [] : [['With', '']]).concat(g === 'status' ? [] : [['Status', '']]).concat(g === 'site' ? [] : [['Site', '']])
                .concat(anyValue ? [['Value (QAR)', 'n']] : []).concat([['Waiting', 'n'], ['Note', ''], ['Files', '']]);
            return '<div class="g g-' + g + '">' + keys.map((k) => {
                const list = groups.get(k);
                const total = list.reduce((t, a) => t + (a.value || 0), 0);
                const urg = list.filter((a) => a.urgent).length;
                return '<section class="grp"><h2>' + esc(k) + ' <span>' + list.length + ' invoice' + (list.length === 1 ? '' : 's') + (anyValue ? ' · QAR ' + esc(money(total)) : '') + (urg ? ' · <b class="late">' + urg + ' urgent</b>' : '') + '</span></h2>' +
                    '<table><thead><tr>' + cols.map((c) => '<th class="' + c[1] + '">' + esc(c[0]) + '</th>').join('') + '</tr></thead><tbody>' +
                    list.map((a, i) => '<tr' + (a.urgent ? ' class="urg"' : '') + '><td>' + (i + 1) + '</td><td class="c"><span class="box"></span></td><td><b>' + esc(a.po) + '</b>' + (a.urgent ? '<br><small class="late">URGENT</small>' : '') + '</td>' +
                        '<td>' + esc(a.vendor || '') + (a.no ? '<br><small>' + esc(a.no) + '</small>' : '') + '</td>' +
                        (g === 'with' ? '' : '<td>' + esc(a.with || '') + '</td>') + (g === 'status' ? '' : '<td>' + esc(a.status) + '</td>') + (g === 'site' ? '' : '<td>' + esc(a.site || '') + '</td>') +
                        (anyValue ? '<td class="n">' + (a.value ? esc(money(a.value)) : '') + '</td>' : '') +
                        '<td class="n' + (a.days > 7 ? ' late' : '') + '">' + (a.days === null || a.days === undefined ? '' : a.days + ' d') + '</td>' +
                        '<td class="note">' + esc(String(a.note || '').slice(0, 120)) + '</td><td class="files">' + files(a) + '</td></tr>').join('') + '</tbody></table></section>';
            }).join('') + '</div>';
        };
        const g0 = APV_GROUPS.some((x) => x[0] === groupBy) ? groupBy : 'with';
        const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>IBA approvals - ' + esc(fmtDate(now.getTime())) + ' (' + items.length + ')</title><style>' +
            '@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box}body{margin:0;padding:16px 18px;font:11.5px/1.4 Arial,Helvetica,sans-serif;color:#1b2430;background:#fff}' +
            '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E7F74;padding-bottom:8px;margin-bottom:10px}h1{margin:0;font-size:19px}h1 small{display:block;font-size:11.5px;font-weight:400;color:#5b6775;margin-top:2px}.meta{text-align:right;color:#5b6775;font-size:11px}' +
            '.sum{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.sum span{border:1px solid #d5dce3;border-radius:999px;padding:3px 9px}.sum b{margin-left:3px}' +
            '.g{display:none}body[data-g=with] .g-with,body[data-g=status] .g-status,body[data-g=site] .g-site{display:block}' +
            'body.newpage .grp+.grp{page-break-before:always;break-before:page}.grp{margin-bottom:14px}' +
            'h2{font-size:13px;margin:12px 0 5px;padding:5px 8px;background:#eef6f5;border-left:3px solid #1E7F74}h2 span{font-weight:400;color:#3d4854;font-size:11.5px;margin-left:6px}' +
            'table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#5b6775;border-bottom:1px solid #b8c2cc;padding:4px 5px}' +
            'td{border-bottom:1px solid #e3e8ed;padding:4px 5px;vertical-align:top}tr{page-break-inside:avoid}tr.urg td{background:#fdf1f0}td.c,th.c{width:20px}td.n,th.n{text-align:right;white-space:nowrap}td.note{max-width:220px;color:#3d4854}td.files a{color:#1E7F74}.late{color:#B42318;font-weight:700}' +
            '.box{display:inline-block;width:11px;height:11px;border:1.5px solid #1b2430;border-radius:2px}.foot{margin-top:12px;color:#8a95a1;font-size:10px;text-align:center}' +
            '.tools{position:fixed;top:10px;right:10px;display:flex;gap:6px;align-items:center;background:#fff;padding:6px;border:1px solid #d5dce3;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12)}.tools label{font:600 12px Arial;color:#3d4854;display:flex;gap:5px;align-items:center}' +
            '.tools select{font:12px Arial;padding:5px}.tools button{font:600 12px Arial;padding:7px 12px;border-radius:6px;border:1px solid #1E7F74;background:#1E7F74;color:#fff;cursor:pointer}.tools button.alt{background:#fff;color:#1E7F74}' +
            '@media print{.tools{display:none}body{padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
            '</style></head><body data-g="' + g0 + '">' +
            '<div class="tools"><label>Group by <select onchange="document.body.setAttribute(\'data-g\',this.value)">' + APV_GROUPS.map((x) => '<option value="' + x[0] + '"' + (x[0] === g0 ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select></label>' +
                '<label><input type="checkbox" onchange="document.body.classList.toggle(\'newpage\',this.checked)"> Each group on a new page</label>' +
                '<button onclick="window.print()">Print / Save as PDF</button><button class="alt" onclick="window.close()">Close</button></div>' +
            '<div class="top"><h1>Invoices waiting for approval<small>' + items.length + ' invoice' + (items.length === 1 ? '' : 's') + (anyValue ? ' · QAR ' + esc(money(items.reduce((t, a) => t + (a.value || 0), 0))) : '') + ' · ' + items.filter((a) => a.urgent).length + ' urgent</small></h1><div class="meta">' + esc(when) + '<br>' + esc(myName()) + '</div></div>' +
            '<div class="sum">' + Object.entries(apvCounts(items)).sort((x, y) => y[1] - x[1]).map((e) => '<span>' + esc(e[0]) + '<b>' + e[1] + '</b></span>').join('') + '</div>' +
            APV_GROUPS.map((x) => section(x[0])).join('') +
            '<div class="foot">Printed from IBA ' + esc(VERSION) + ' · ' + esc(when) + '</div></body></html>';
        const w = window.open('', '_blank');
        if (!w) { alert('Please allow pop-ups for IBA to print the list.'); return; }
        w.document.open(); w.document.write(html); w.document.close();
    }

    let coCache = null;
    let coBusy = null;
    function refreshCloseout() {
        if (coBusy) return coBusy;
        coBusy = withTimeout(window.poCloseoutCollectRows(), 20000, 'PO Close Out').then((rows) => {
            coCache = { at: Date.now(), val: { waiting_site: rows.filter((r) => r.waitingSite).length, ready_to_close: rows.filter((r) => r.waitingHo).length } };
            paintCloseout(coCache.val);
        }, () => paintCloseout(null)).then(() => { coBusy = null; });
        return coBusy;
    }
    function paintCloseout(v) {
        document.querySelectorAll('.iba-ai-card.is-brief [data-co-ready]').forEach((el) => { el.textContent = v ? String(v.ready_to_close) : '—'; });
        document.querySelectorAll('.iba-ai-card.is-brief [data-co-foot]').forEach((el) => {
            el.textContent = v ? v.ready_to_close + ' ready to close · ' + v.waiting_site + ' waiting at site' : 'could not be loaded';
        });
        briefStore.forEach((d) => { if (v && d.result && d.result.po_closeout_loading) { d.result.po_closeout = v; delete d.result.po_closeout_loading; } });
    }

    // 15.0.0 patch 25: right after sign-in the task counter needs a few
    // seconds; wait for it (up to 12 s) instead of failing at once.
    async function waitingReady(ms) {
        let w = waiting();
        const t0 = Date.now();
        while ((!w || !w.running) && Date.now() - t0 < (ms || 12000)) { await wait(400); w = waiting(); }
        return (w && w.running) ? w : null;
    }
    const NOT_READY = 'Your task list is still loading after sign-in. Please try again in a moment.';
    async function toolBrief() {
        const w = await waitingReady();
        if (!w) return { result: { error: NOT_READY } };
        const lists = briefLists(w);
        const tasks = lists.tasks.sort(oldestFirst);
        const jobs = lists.jobs.sort(oldestFirst);
        const byStatus = {};
        tasks.forEach((t) => { const k = t.status || 'Other'; byStatus[k] = (byStatus[k] || 0) + 1; });
        // 15.0.0 patch 11: PO Close Out (Super Admin) no longer holds the brief
        // back: the last numbers (5 min) are used, or they fill in when ready.
        let closeout = null;
        let closeoutPending = false;
        if (isSuper() && typeof window.poCloseoutCollectRows === 'function') {
            if (coCache && Date.now() - coCache.at < 5 * 60000) closeout = coCache.val;
            else { closeoutPending = true; refreshCloseout(); }
        }
        // 15.0.0 patch 44: invoices sent for approval (CEO / COO / any approver), for Admins
        let approvals = null;
        if (isAdminUser() && !onPhone()) {
            try { approvals = await withTimeout(sentForApproval(), 15000, 'Approval list'); } catch (e) { approvals = { items: [], error: (e && e.message) || 'could not be read' }; }
        }
        const result = {
            active_task: Math.max(Number(w.counts.task) || 0, tasks.length),
            active_job: Math.max(Number(w.counts.job) || 0, jobs.length),
            new_today: tasks.concat(jobs).filter((t) => t.at && new Date(Number(t.at) || t.at).toDateString() === new Date().toDateString()).length,
            tasks_by_status: byStatus,
            oldest_tasks: tasks.slice(0, 8).map(compactTask),
            inventory_jobs: jobs.slice(0, 6).map(compactJob),
            reminders_for_you: remList.filter((r) => !r.seenAt).slice(0, 5).map((r) => ({ from: r.from, text: r.text, po: r.po || undefined, control: r.control || undefined })),
            inventory_not_loaded: Math.max(0, (Number(w.counts.job) || 0) - jobs.length),
            po_closeout: closeout || undefined,
            po_closeout_loading: closeoutPending || undefined,
            sent_for_approval: approvals ? approvals.items.length : undefined,
            sent_for_approval_oldest: approvals && approvals.items.length ? approvals.items.slice(0, 8).map((a) => ({ po: a.po, invoice_no: a.no, vendor: a.vendor || undefined, status: a.status, with: a.with || undefined, waiting_days: a.days, urgent: a.urgent || undefined })) : undefined
        };
        return { result: result, card: { kind: 'brief', data: { result: result, tasks: tasks, jobs: jobs, approvals: approvals } } };
    }

    async function toolList(args) {
        const w = await waitingReady();
        if (!w) return { result: { error: NOT_READY } };
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



    // ------------------------------------------------------------------
    // 15.0.0 patch 4: Inventory - where is a transfer and who must act now.
    // No AI needed. Reads only the rows with that control number (Firebase
    // index on controlNumber), so it costs a few hundred bytes.
    // Same step rules as Active Job: Pending Source -> source contact,
    // Pending Admin -> approver, In Transit -> receiver, Pending Confirmation
    // -> requester (Usage).
    // ------------------------------------------------------------------
    const TRF_PREFIXES = ['TRF', 'STK', 'USE', 'RET'];
    const TRF_TYPE_OF_PREFIX = { TRF: 'Transfer', STK: 'Restock', USE: 'Usage', RET: 'Return' };
    const TRF_FLOW = {
        Transfer: ['Pending Source', 'Pending Admin', 'In Transit'],
        Restock: ['Pending Admin', 'In Transit'],
        Return: ['Pending Admin', 'In Transit'],
        Usage: ['Pending Admin', 'Pending Confirmation']
    };
    const TRF_STEP = {
        'pending source': { short: 'Source', label: 'Source site confirms and sends', field: 'sourceContact', site: 'from' },
        'pending admin': { short: 'Admin', label: 'Admin authorizes', field: 'approver' },
        'pending': { short: 'Admin', label: 'Admin authorizes', field: 'approver' },
        'approved': { short: 'Receiver', label: 'Receiver confirms receipt', field: 'receiver', site: 'to' },
        'in transit': { short: 'Receiver', label: 'Receiver confirms receipt', field: 'receiver', site: 'to' },
        'pending confirmation': { short: 'Requester', label: 'Requester confirms actual usage', field: 'requestor' }
    };
    const TRF_FIELD_NAME = { sourceContact: 'source contact', approver: 'approver', receiver: 'receiver', requestor: 'requester' };
    function looksTransfer(q) { return /^\s*(?:(?:trf|stk)[\s#:-]*\d|(?:use|ret)[-#:]?\d)/i.test(String(q || '')); }
    function transferCandidates(raw) {
        const typed = String(raw || '').trim();
        const s = typed.toUpperCase().replace(/\s+/g, '').replace(/^#/, '');
        const out = [];
        const add = (v) => { if (v && out.indexOf(v) === -1) out.push(v); };
        let m = s.match(/^([A-Z]{3})[-:#]?(\d+)$/);
        if (m) { add(m[1] + '-' + m[2].padStart(4, '0')); add(m[1] + '-' + m[2]); }
        else if ((m = s.match(/^(\d+)$/))) TRF_PREFIXES.forEach((p) => add(p + '-' + m[1].padStart(4, '0')));
        else { add(s); add(typed); }
        return out;
    }
    function invDb() {
        try {
            if (typeof window.getInventoryDatabase === 'function') return window.getInventoryDatabase();
            if (typeof inventoryDb !== 'undefined' && inventoryDb) return inventoryDb;
        } catch (_) {}
        return null;
    }
    function memoryTransfers() {
        try { if (typeof inventorySystemEntries !== 'undefined' && Array.isArray(inventorySystemEntries) && inventorySystemEntries.length) return inventorySystemEntries; } catch (_) {}
        try { if (typeof allSystemEntries !== 'undefined' && Array.isArray(allSystemEntries)) return allSystemEntries.filter((e) => e && e.source === 'transfer_entry'); } catch (_) {}
        return [];
    }
    function personOf(name) {
        const n = norm(name);
        if (!n) return null;
        const p = people().find((x) => norm(x.value) === n);
        return p ? { name: p.value, position: p.position || '', site: p.site || '' } : null;
    }
    function trfHistory(h) {
        const arr = Array.isArray(h) ? h : (h && typeof h === 'object' ? Object.values(h) : []);
        return arr.filter((x) => x && typeof x === 'object')
            .map((x) => ({ at: Number(x.timestamp) || Date.parse(x.date || '') || 0, action: String(x.action || x.remarks || x.status || ''), by: String(x.by || ''), note: String(x.note || '') }))
            .sort((a, b) => a.at - b.at);
    }
    function trfClosed(e) {
        const s = norm(e.remarks || e.status);
        return /^(completed|complete|received|rejected|cancel|closed|done)/.test(s);
    }
    function trfMentions(e, name) {
        const n = norm(name);
        return !!n && ['requestor', 'sourceContact', 'approver', 'receiver', 'attention', 'enteredBy'].some((f) => norm(e[f]) === n);
    }
    function trfItem(e) {
        const type = String(e.jobType || e.for || 'Transfer');
        const step = String(e.remarks || e.status || 'Pending').trim();
        const def = TRF_STEP[norm(step)] || null;
        const closed = trfClosed(e);
        const flow = TRF_FLOW[type] || TRF_FLOW.Transfer;
        let pos = def ? flow.indexOf(step === 'Pending' ? 'Pending Admin' : (step === 'Approved' ? 'In Transit' : step)) : -1;
        const hist = trfHistory(e.history);
        const last = hist.length ? hist[hist.length - 1] : null;
        const since = (last && last.at) || Number(e.lastUpdated) || Number(e.timestamp) || 0;
        const out = {
            key: e.key || '', control: String(e.controlNumber || e.controlId || e.ref || ''), type: type,
            product: String(e.productName || ''), product_id: String(e.productID || ''),
            qty_ordered: e.orderedQty || e.requiredQty || '', qty_approved: e.approvedQty != null ? e.approvedQty : '', qty_received: e.receivedQty != null ? e.receivedQty : '',
            from: String(e.fromSite || e.fromLocation || ''), to: String(e.toSite || e.toLocation || ''),
            requester: String(e.requestor || ''), source_contact: String(e.sourceContact || ''), approver: String(e.approver || ''), receiver: String(e.receiver || ''),
            entered_by: String(e.enteredBy || ''), created: fmtDate(Number(e.timestamp) || (hist[0] && hist[0].at) || 0),
            step: step, open: !closed,
            flow: flow.map((s) => (TRF_STEP[norm(s)] || {}).short || s),
            step_no: pos >= 0 ? pos + 1 : null, steps_total: flow.length,
            since: fmtDate(since), days_at_step: daysSince(since),
            history: hist.slice(-6).reverse().map((x) => ({ date: fmtDate(x.at), action: x.action, by: x.by || undefined, note: x.note || undefined }))
        };
        if (closed) { out.waiting_for = null; out.next = 'Nothing: ' + step; return out; }
        // Active Job shows the step to the person in the step's own field;
        // only at the admin step does Attention count as well.
        const field = def ? def.field : 'attention';
        const isAdminStep = !!def && def.field === 'approver';
        const blank = (v) => !String(v || '').trim() || norm(v) === 'none';
        const roleName = String(e[field] || '').trim();
        const attn = String(e.attention || '').trim();
        let who = blank(roleName) ? '' : roleName;
        const warn = [];
        if (!who && (isAdminStep || !def) && !blank(attn)) who = attn;
        const p = personOf(who);
        out.next = def ? def.label : ('Step "' + step + '"');
        out.waiting_for = who || null;
        if (p) { out.waiting_for_position = p.position || undefined; out.waiting_for_site = p.site || undefined; }
        if (def && def.site) out.at_site = def.site === 'from' ? out.from : out.to;
        if (isAdminStep && who && !blank(attn) && norm(attn) !== norm(who)) out.also_with = attn;
        if (!who) {
            warn.push('No ' + (TRF_FIELD_NAME[field] || 'person') + ' is set for this step, so it is in nobody\'s Active Job' +
                (!blank(attn) ? ' (Attention says ' + attn + ', but Active Job does not use Attention at this step)' : '') +
                '. Someone with Inventory rights must correct the request with the right person.');
        } else if (!p) {
            warn.push('"' + who + '" is not in the users list (name spelled differently, or no longer a user), so nobody sees this step in Active Job.');
        }
        if (warn.length) out.problems = warn;
        return out;
    }
    async function transferRows(raw) {
        const tries = transferCandidates(raw);
        const found = new Map();
        const d = invDb();
        if (d && d.ref) {
            const reads = tries.map((c) => withTimeout(d.ref('transfer_entries').orderByChild('controlNumber').equalTo(c).once('value'), 9000, 'Inventory')
                .then((snap) => { const v = (snap && snap.val()) || {}; Object.keys(v).forEach((k) => { if (v[k]) found.set(k, Object.assign({ key: k }, v[k])); }); })
                .catch(() => null));
            await Promise.all(reads);
        }
        if (!found.size) {
            // older rows saved under another field name: only what is already loaded
            const want = tries.map(norm);
            memoryTransfers().forEach((e) => {
                if (!e) return;
                const id = norm(e.controlNumber || e.controlId || e.ref || '');
                if (id && want.indexOf(id) !== -1) found.set(String(e.key || id + found.size), e);
            });
        }
        return Array.from(found.values());
    }
    async function transferSearch(args) {
        const raw = String((args && (args.control || args.q)) || '').trim();
        if (!raw) return { error: 'Which transfer? Give its control number, e.g. TRF-0361.' };
        const parts = raw.split(/\s*(?:,|;|&|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean).slice(0, 5);
        const acc = access();
        const myN = myName();
        const out = [];
        for (const part of parts) {
            const rows = await transferRows(part);
            if (!rows.length) { out.push({ control: transferCandidates(part)[0] || part, found: false }); continue; }
            const visible = rows.filter((e) => acc.allSites || trfMentions(e, myN) ||
                acc.sites.some((s) => s === siteNo(e.fromSite || e.fromLocation) || s === siteNo(e.toSite || e.toLocation)));
            if (!visible.length) { out.push({ control: rows[0].controlNumber || part, found: true, hidden: true, note: 'This request is for sites you do not cover.' }); continue; }
            const items = visible.map(trfItem).sort((a, b) => (a.open === b.open ? 0 : (a.open ? -1 : 1)));
            const open = items.filter((i) => i.open);
            const waiting = {};
            open.forEach((i) => { const k = i.waiting_for || '(nobody set)'; waiting[k] = (waiting[k] || 0) + 1; });
            out.push({ control: items[0].control || part, found: true, type: items[0].type, from: items[0].from, to: items[0].to,
                items_total: items.length, items_open: open.length, waiting_for: waiting, items: items });
        }
        return { transfers: out, how_it_moves: 'Transfer: 1 Source site confirms and sends (Pending Source) -> 2 Admin authorizes, stock leaves the source (Pending Admin) -> 3 Receiver confirms receipt, stock is added (In Transit) -> Completed. Restock / Return: Admin -> Receiver. Usage: Admin -> Requester confirms actual usage. The person shown sees it in their Active Job (Inventory).' };
    }
    async function toolTransfer(args) {
        const r = await transferSearch(args || {});
        if (r.error) return { result: { error: r.error } };
        return { result: r, card: { kind: 'transfer', data: r } };
    }
    function transferHtml(x) {
        if (x.error) return '<div class="iba-ai-note is-error">' + esc(x.error) + '</div>';
        return (x.transfers || []).map((t) => {
            if (!t.found) return '<div class="iba-ai-card-head"><i class="fa-solid fa-dolly"></i> ' + esc(t.control) + '</div><p class="iba-ai-empty">No transfer with this control number was found. Check the number (e.g. TRF-0361, STK-0012, USE-0040, RET-0007).</p>';
            if (t.hidden) return '<div class="iba-ai-card-head"><i class="fa-solid fa-dolly"></i> ' + esc(t.control) + '</div><p class="iba-ai-empty">' + esc(t.note) + '</p>';
            const first = t.items[0];
            const badge = t.items_open ? (t.items_open + ' open') : first.step;
            let h = '<div class="iba-ai-card-head"><i class="fa-solid fa-dolly"></i> ' + esc(t.control) + ' · ' + esc(t.type) +
                (t.from || t.to ? ' · ' + esc(t.from || '?') + ' → ' + esc(t.to || '?') : '') + '<span class="iba-ai-badge' + (t.items_open ? '' : ' is-plain') + '">' + esc(badge) + '</span></div>';
            // one block per (step, person)
            const groups = [];
            t.items.forEach((i) => {
                const key = i.open ? i.step + '|' + (i.waiting_for || '') : 'closed|' + i.step;
                let g = groups.find((x) => x.key === key);
                if (!g) { g = { key, head: i, items: [] }; groups.push(g); }
                g.items.push(i);
            });
            groups.forEach((g) => {
                const i = g.head;
                if (i.open) {
                    const who = i.waiting_for ? '<b>' + esc(i.waiting_for) + '</b>' + ((i.waiting_for_position || i.waiting_for_site) ? ' <small>(' + esc([i.waiting_for_position, i.waiting_for_site].filter(Boolean).join(' · ')) + ')</small>' : '') : '<b>nobody</b>';
                    h += '<p class="iba-ai-lastact">Waiting for ' + who + ': ' + esc(i.next) + (i.at_site ? ' at ' + esc(i.at_site) : '') +
                        (i.step_no ? ' (step ' + esc(i.step_no) + ' of ' + esc(i.steps_total) + ')' : '') +
                        (i.since ? ' · since ' + esc(i.since) + (i.days_at_step != null ? ' (' + esc(i.days_at_step) + (i.days_at_step === 1 ? ' day' : ' days') + ')' : '') : '') +
                        (i.also_with ? '<br><small>Also in the Active Job of ' + esc(i.also_with) + ' (Attention).</small>' : '') + '</p>';
                    h += '<div class="iba-ai-trf-flow">' + i.flow.map((s, n) => '<span class="' + (i.step_no && n + 1 < i.step_no ? 'is-done' : (i.step_no === n + 1 ? 'is-now' : '')) + '">' + esc(s) + '</span>').join('<i class="fa-solid fa-chevron-right"></i>') + '</div>';
                    if (i.problems) h += '<ul class="iba-ai-warn">' + i.problems.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>';
                    if (i.waiting_for) h += '<div class="iba-ai-trk-acts"><button type="button" class="iba-ai-mini" data-ai-remind="' + esc(JSON.stringify({ control: i.control || t.control, type: t.type, step: i.next, with: i.waiting_for, days: i.days_at_step })) + '"><i class="fa-solid fa-bell"></i> Remind ' + esc(i.waiting_for) + '</button></div>';
                } else {
                    h += '<p class="iba-ai-foot">' + esc(i.step) + ':</p>';
                }
                h += '<ul class="iba-ai-rows">' + g.items.map((r) => '<li><span class="iba-ai-grow">' + esc(r.product || r.product_id || 'Item') +
                    '<small>' + esc(['Qty ' + (r.qty_ordered || '?') + (r.qty_approved !== '' ? ' · approved ' + r.qty_approved : '') + (r.qty_received !== '' ? ' · received ' + r.qty_received : ''), r.requester ? 'requested by ' + r.requester : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>';
            });
            const hist = first.history || [];
            if (hist.length) {
                h += '<div class="iba-ai-sub">Recent steps</div><ul class="iba-ai-rows iba-ai-timeline">' + hist.map((e) => '<li><span class="iba-ai-tl-date">' + esc(e.date || '—') + '</span><span class="iba-ai-grow">' + esc(e.action || '—') +
                    '<small>' + esc([e.by, e.note].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>';
            }
            const ppl = [first.requester ? 'Requester: ' + first.requester : '', first.source_contact ? 'Source: ' + first.source_contact : '', first.approver ? 'Approver: ' + first.approver : '', first.receiver ? 'Receiver: ' + first.receiver : ''].filter(Boolean).join(' · ');
            if (ppl) h += '<p class="iba-ai-foot">' + esc(ppl) + (first.created ? ' · created ' + esc(first.created) : '') + '</p>';
            return h;
        }).join('<hr class="iba-ai-sep">');
    }
    // ------------------------------------------------------------------
    // 15.0.0 patch 5: find transfers by what they say (vehicle no., item,
    // "loader", a person, a site...). Firebase cannot search inside text,
    // so this looks through transfers already in the browser:
    //  - all of them when the Inventory page has loaded them (free),
    //  - otherwise the latest 60 that the Active Job counter already
    //    follows (free), and offers "Search all transfers": one download,
    //    the same one the Inventory page makes, kept for the session.
    // ------------------------------------------------------------------
    const TRF_STOP = ['the', 'a', 'an', 'of', 'for', 'to', 'and', 'or', 'with', 'who', 'has', 'have', 'where', 'is', 'are', 'was', 'what', 'which',
        'transfer', 'transfers', 'request', 'requests', 'transaction', 'transactions', 'item', 'items', 'about', 'find', 'show', 'me', 'please', 'any', 'all', 'it', 'this', 'that', 'in', 'on', 'at', 'by'];
    const TRF_TEXT_FIELDS = ['controlNumber', 'controlId', 'ref', 'jobType', 'productName', 'productID', 'details', 'note', 'notes', 'remarks', 'status', 'purpose', 'reason',
        'vehicle', 'vehicleNo', 'equipment', 'requestor', 'sourceContact', 'approver', 'receiver', 'attention', 'enteredBy', 'fromSite', 'toSite', 'fromLocation', 'toLocation', 'shippingDate', 'esn', 'receiverEsn'];
    function trfWords(q) {
        return String(q || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ')
            .filter((w) => w && (w.length > 1 || /\d/.test(w)) && TRF_STOP.indexOf(w) === -1);
    }
    function trfText(e) {
        const parts = [];
        TRF_TEXT_FIELDS.forEach((f) => { const v = e[f]; if (v != null && (typeof v === 'string' || typeof v === 'number')) parts.push(String(v)); });
        // any other short text the request carries (older forms used other names)
        Object.keys(e).forEach((k) => {
            if (TRF_TEXT_FIELDS.indexOf(k) !== -1 || k === 'history' || k === 'key') return;
            const v = e[k];
            if (typeof v === 'string' && v.length <= 300 && !/^https?:/i.test(v)) parts.push(v);
        });
        trfHistory(e.history).forEach((h) => { if (h.note) parts.push(h.note); });
        return parts.join(' • ');
    }
    let trfAllCache = null; // full list for this session, after "Search all"
    function trfFullList() {
        if (trfAllCache) return trfAllCache;
        try {
            if (typeof inventorySystemEntries !== 'undefined' && Array.isArray(inventorySystemEntries) && inventorySystemEntries.length) return inventorySystemEntries;
        } catch (_) {}
        return null;
    }
    let trfLatestMemo = null;
    async function trfLatest() {
        if (trfLatestMemo && Date.now() - trfLatestMemo.at < 60000) return trfLatestMemo.rows;
        const d = invDb();
        if (!d || !d.ref) return [];
        // the same query the Active Job counter listens to, so it comes from memory
        const snap = await withTimeout(d.ref('transfer_entries').orderByKey().limitToLast(60).once('value'), 9000, 'Inventory');
        const v = (snap && snap.val()) || {};
        const rows = Object.keys(v).map((k) => Object.assign({ key: k }, v[k] || {}));
        trfLatestMemo = { at: Date.now(), rows: rows };
        return rows;
    }
    async function trfLoadAll() {
        if (typeof ensureAllEntriesFetched === 'function') {
            try { await ensureAllEntriesFetched(false, { mode: 'inventory' }); } catch (_) {}
            const full = trfFullList();
            if (full) return full;
        }
        const d = invDb();
        if (!d || !d.ref) throw new Error('Inventory database is not ready.');
        const snap = await withTimeout(d.ref('transfer_entries').once('value'), 30000, 'Inventory');
        const v = (snap && snap.val()) || {};
        trfAllCache = Object.keys(v).map((k) => Object.assign({ key: k }, v[k] || {}));
        return trfAllCache;
    }
    // 15.0.0 patch 6: a number matches only as a whole number, so 36588 does
    // not match 136588 or 365880 (a PO, a phone number...). Words match anywhere.
    function trfFindAt(low, w) {
        if (!/^\d+$/.test(w)) return low.indexOf(w);
        const m = new RegExp('(^|[^0-9])' + w + '(?![0-9])').exec(low);
        return m ? m.index + m[1].length : -1;
    }
    function trfSnippet(text, words) {
        const low = text.toLowerCase();
        let at = -1;
        words.forEach((w) => { const i = trfFindAt(low, w); if (i !== -1 && (at === -1 || i < at)) at = i; });
        if (at === -1) return '';
        // the piece of text around the first match, cut at the separators
        const start = Math.max(text.lastIndexOf(' • ', at) + 3, at - 60, 0);
        let end = text.indexOf(' • ', at);
        if (end === -1 || end - at > 90) end = Math.min(text.length, at + 90);
        return (start > 0 && text.slice(start - 3, start) !== ' • ' ? '…' : '') + text.slice(start, end).trim() + (end < text.length && text.slice(end, end + 3) !== ' • ' ? '…' : '');
    }
    async function transferFind(args) {
        const x = args || {};
        const words = trfWords(x.text || x.q);
        if (!words.length) return { error: 'What should I look for? For example a vehicle number (36588), an item (wheel loader) or a name.' };
        let list = trfFullList();
        let complete = !!list;
        if (!list && x.all) { list = await trfLoadAll(); complete = true; }
        if (!list) list = await trfLatest();
        const rg = rangeOf(x);
        const acc = access();
        const myN = myName();
        const site = siteNo(x.site);
        const groups = new Map();
        let checked = 0;
        list.forEach((e) => {
            if (!e || typeof e !== 'object') return;
            if (e.source && e.source !== 'transfer_entry') return;
            checked += 1;
            const text = trfText(e);
            const low = text.toLowerCase();
            if (!words.every((w) => trfFindAt(low, w) !== -1)) return;
            if (!(acc.allSites || trfMentions(e, myN) || acc.sites.some((s) => s === siteNo(e.fromSite || e.fromLocation) || s === siteNo(e.toSite || e.toLocation)))) return;
            if (site && site !== siteNo(e.fromSite || e.fromLocation) && site !== siteNo(e.toSite || e.toLocation)) return;
            const created = Number(e.timestamp) || 0;
            if (rg && !inRange(created ? qatarISO(created) : '', rg)) return;
            const item = trfItem(e);
            if (x.open_only && !item.open) return;
            const key = item.control || e.key;
            let g = groups.get(key);
            if (!g) { g = { control: item.control || '(no number)', type: item.type, from: item.from, to: item.to, created: item.created, at: created, items: [], open: 0, match: '' }; groups.set(key, g); }
            g.items.push(item);
            if (item.open) g.open += 1;
            if (!g.match) g.match = trfSnippet(text, words);
        });
        const all = Array.from(groups.values()).sort((a, b) => (b.open > 0) - (a.open > 0) || (b.at - a.at));
        const rows = all.map((g) => {
            const first = g.items.find((i) => i.open) || g.items[0];
            return { control: g.control, type: g.type, from: g.from || undefined, to: g.to || undefined, created: g.created,
                products: Array.from(new Set(g.items.map((i) => i.product).filter(Boolean))).slice(0, 4).join(', '),
                match: g.match, status: g.open ? first.step : first.step, open: g.open > 0,
                waiting_for: g.open ? (first.waiting_for || 'nobody') : undefined, days_at_step: g.open ? first.days_at_step : undefined,
                problems: g.open && first.problems ? first.problems.length : undefined };
        });
        return { query: words.join(' '), total: rows.length, shown: Math.min(rows.length, 25), checked: checked, all_checked: complete,
            note: complete ? 'Searched all ' + checked + ' transfers.' : 'Searched the latest ' + checked + ' transfers only. Older ones need "Search all transfers" (one download, the same as opening Inventory).',
            items: rows.slice(0, 25) };
    }
    function qatarISO(ms) { const q = qatarParts(new Date(ms)); return q.y + '-' + q.m + '-' + q.d; }
    async function toolTransferFind(args) {
        const r = await transferFind(args || {});
        if (r.error) return { result: { error: r.error } };
        return { result: r, card: { kind: 'trf_find', data: Object.assign({ text: (args && (args.text || args.q)) || '', open_only: !!(args && args.open_only), site: (args && args.site) || '' }, r) } };
    }
    function transferFindHtml(x) {
        if (x.error) return '<div class="iba-ai-note is-error">' + esc(x.error) + '</div>';
        const again = esc(JSON.stringify({ text: x.text || x.query, open_only: !!x.open_only, site: x.site || '', all: true }));
        return '<div class="iba-ai-card-head"><i class="fa-solid fa-magnifying-glass"></i> Transfers · "' + esc(x.text || x.query) + '"<span class="iba-ai-badge is-plain">' + esc(x.total) + '</span></div>' +
            (x.items.length ? '<ul class="iba-ai-rows">' + x.items.map((r) => '<li><button type="button" class="iba-ai-chip iba-ai-trf-no" data-trf="' + esc(r.control) + '" title="Who has it now">' + esc(r.control) + '</button>' +
                '<span class="iba-ai-grow">' + esc([r.type, r.products].filter(Boolean).join(' · ')) +
                (r.match ? '<small class="iba-ai-trf-match">' + esc(r.match) + '</small>' : '') +
                '<small>' + esc([(r.from || r.to) ? (r.from || '?') + ' → ' + (r.to || '?') : '', r.created, r.open ? r.status + ' · with ' + r.waiting_for + (r.days_at_step != null ? ' · ' + r.days_at_step + 'd' : '') : r.status].filter(Boolean).join(' · ')) + '</small>' +
                (r.problems ? '<small class="iba-ai-trf-warn">Stuck: open it to see why</small>' : '') + '</span></li>').join('') + '</ul>' +
                (x.total > x.shown ? '<p class="iba-ai-foot">Showing ' + esc(x.shown) + ' of ' + esc(x.total) + '. Add more words to narrow it down.</p>' : '')
                : '<p class="iba-ai-empty">No transfer mentions that.</p>') +
            '<p class="iba-ai-foot">' + esc(x.note) + (x.all_checked ? '' : ' <button type="button" class="iba-ai-mini" data-trf-find="' + again + '"><i class="fa-solid fa-database"></i> Search all transfers</button>') + '</p>' +
            (x.items.length ? '<p class="iba-ai-foot">Click a number to see who must act on it now.</p>' : '');
    }
    async function runTransferFind(args, out) {
        if (state.busy) return;
        state.busy = true;
        if (out) out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        else setBusy(true);
        try {
            const r = await transferFind(args);
            const card = { kind: 'trf_find', data: Object.assign({ text: args.text || '', open_only: !!args.open_only, site: args.site || '' }, r) };
            if (out) { out.innerHTML = ''; addCard(card, out); } else addCard(card);
        } catch (err) {
            if (out) out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
            else addError(err);
        } finally {
            state.busy = false;
            if (!out) setBusy(false);
        }
    }

    // 15.0.0 patch 7: Track tab - two buttons side by side instead of a list:
    // Invoices (PO, vendor) and Inventory (Transfer, Usage, Restock, Return).
    const TRACK_KIND_KEY = 'iba-ai-track-kind-v1';
    function trackKind() {
        const on = document.querySelector('#iba-ai-track-kind button.is-on');
        return on ? on.dataset.kind : 'inv';
    }
    function setTrackKind(kind, remember) {
        const k = kind === 'trf' ? 'trf' : 'inv';
        document.querySelectorAll('#iba-ai-track-kind button[data-kind]').forEach((b) => {
            const on = b.dataset.kind === k;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        const trf = k === 'trf';
        const q = $('iba-ai-track-q'), year = $('iba-ai-track-year'), form = $('iba-ai-track-form'), help = $('iba-ai-track-help');
        if (q) q.placeholder = trf ? 'TRF-0361, 36588, wheel loader...' : 'PO number or vendor';
        if (year) year.hidden = trf;
        const rec = $('iba-ai-recent');
        if (rec) {
            rec.hidden = trf || !isSuper(); // 15.0.0 patch 12: Super Admin only
            const sel = $('iba-ai-recent-status');
            if (sel && !sel.options.length) {
                const opts = statusOptions();
                (opts.length ? opts : ['Under Review', 'For SRV', 'For Approval', 'In Process', 'CEO Approval', 'For Summary', 'With Accounts'])
                    .forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o; sel.appendChild(op); });
                if (opts.indexOf('Under Review') !== -1 || !opts.length) sel.value = 'Under Review';
            }
            const go = rec.querySelector('[data-recent-go] span');
            if (go) go.textContent = 'Find and put in Batch Entry';
        }
        if (form) form.classList.toggle('is-trf', trf);
        if (help) help.textContent = trf
            ? 'A request number (TRF-0361, USE-0040, STK-0012, RET-0007) or words it contains, like a vehicle number (36588) or "wheel loader". Add a site to narrow it down. This does not use the AI.'
            : 'A PO number or a vendor name. Add a site or year to narrow it down. This does not use the AI.';
        if (remember) lsSet(TRACK_KIND_KEY, k);
    }

    async function runTransferTrack(q, out) {
        if (state.busy) return;
        state.busy = true;
        if (out) out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        try {
            const r = await transferSearch({ control: q });
            if (out) { out.innerHTML = ''; addCard({ kind: 'transfer', data: r }, out); }
            else addCard({ kind: 'transfer', data: r });
        } catch (err) {
            if (out) out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
            else addError(err);
        } finally {
            state.busy = false;
        }
    }

    // ------------------------------------------------------------------
    // Track an invoice (patch 13) - no AI needed
    // ------------------------------------------------------------------
    // 15.0.0 patch 9: the stages as IBA works: the approvals of the SRV
    // (For Approval, Report ...) belong to the SRV step, and In Process /
    // CEO Approval are the CEO-COO approval, just before Accounts.
    const STAGES = ['Reception', 'Invoice Entry', 'SRV', 'CEO/COO Approval', 'Accounts', 'Paid'];
    const STAGE_OF = {
        'under review': 1, 'pending': 1,
        'for srv': 2, 'srv done': 2, 'no need srv': 2,
        'for approval': 2, 'report': 2, 'report approval': 2, 'report approved': 2, 'approved': 2, 'rejected': 2,
        // 15.0.0 patch 11: For Summary = approved by the COO, going to the CEO
        // in the group summary, so it sits at the CEO/COO Approval step.
        'in process': 3, 'for summary': 3, 'ceo approval': 3,
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
        // 17.0.0 patch 7: the app's saved Job Records copy (only changed jobs are downloaded)
        const snap = (typeof window.ibaJobsPocketLoad === 'function')
            ? await withTimeout(window.ibaJobsPocketLoad(false), 25000, 'job records')
            : await withTimeout(d.ref('job_entries').once('value'), 25000, 'job records');
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
        // 15.0.0 patch 11: a step the invoice went past is counted as done
        // (it already moved on), so nothing is marked as skipped any more.
        return {
            kind: 'invoice', key: inv.__key || undefined, pdf: invPdfUrl(inv) || undefined, srv: srvPdfUrl(inv) || undefined, urgent: (APPROVAL_RX.test(status) && isUrgentNote(inv.note)) || undefined, invoice_no: inv.invNumber || inv.invEntryID || '—', status: status, payment: paymentState(status), stage: STAGES[st], stage_index: st,
            side_status: side || undefined, with: (st === 5 && !side) ? undefined : (holder || undefined),
            since: since ? fmtDate(since) : undefined, days: (since && !(st === 5 && !side)) ? daysSince(since) : undefined,
            value: acc.amounts && inv.invValue ? money(inv.invValue) : undefined,
            invoice_date: fmtDate(inv.invoiceDate) || undefined, entered: enteredAt ? fmtDate(enteredAt) : undefined,
            with_accounts_on: accAt ? fmtDate(accAt) : undefined, paid_on: paidAt ? fmtDate(paidAt) : undefined,
            _years: [dayOfISO(inv.invoiceDate), dayOfISO(paidAt), dayOfISO(enteredAt)].filter(Boolean).map((d) => d.slice(0, 4)),
            steps: hist.slice(-6).map((h) => ({ status: h.status, by: h.by || undefined, date: fmtDate(h.at) })),
            _t: Number(since) || Number(paidAt) || Number(accAt) || Number(enteredAt) || 0
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
            return { kind: 'reception', _t: at, invoice_no: e.ref || '—', status: 'At Reception (job entry)', payment: 'Not paid yet (not with Accounts)', stage: STAGES[0], stage_index: 0,
                entered: at ? fmtDate(at) : undefined, entered_by: e.enteredBy || undefined, _years: at ? [dayOfISO(at).slice(0, 4)] : [],
                with: e.attention || undefined, since: at ? fmtDate(at) : undefined, days: at ? daysSince(at) : undefined,
                value: acc.amounts && e.amount ? money(e.amount) : undefined, steps: [] };
        }).concat(ipcItems(jobs, po, acc));
    }
    // 15.0.0 patch 27: received jobs sent to the QS for IPC show in the same
    // trail (Reception step, marked "with QS"), so a vendor / PO search shows
    // where every received item is and who has it.
    function ipcOpen(st) {
        try { if (typeof wdIsOpenIPCJobStatus === 'function') return !!wdIsOpenIPCJobStatus(st); } catch (_) {}
        const r = norm(st);
        return !r || !/(with accounts|closed|cancel|deleted|srv done|completed|paid)/.test(r);
    }
    function ipcItems(jobs, po, acc) {
        return (jobs || []).filter((e) => {
            if (!e || String(e.po || '').trim().toUpperCase() !== po) return false;
            const ft = norm(e.for || e.type);
            if (ft !== 'ipc application' && ft !== 'ipc' && ft !== 'ipc processed') return false;
            if (e.convertedToInvoice || e.archived) return false;
            return ipcOpen(String(e.remarks || e.status || ''));
        }).sort((a, b) => (norm(a.for || a.type) === 'ipc application' ? 0 : 1) - (norm(b.for || b.type) === 'ipc application' ? 0 : 1)).map((e) => {
            const ft = norm(e.for || e.type);
            const raw = String(e.remarks || e.status || '').trim();
            const at = Number(e.statusChangedAt) || Number(e.updatedAt) || Number(e.timestamp) || Date.parse(e.date || '') || 0;
            const processed = ft !== 'ipc application';
            const label = processed ? 'IPC done - waiting for the actual invoice' : 'With QS for IPC' + (raw && !/^(pending|new entry|ipc application)$/i.test(raw) ? ' (' + raw + ')' : '');
            return { kind: 'ipc', _t: at, invoice_no: e.ref || (processed ? 'IPC' : 'IPC app.'), status: label, side_status: label, payment: 'Not paid yet (not with Accounts)', stage: STAGES[0], stage_index: 0,
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
        // 15.0.0 patch 9: a vendor with many POs shows its newest POs first,
        // then its sites to look further (no more "unknown" year step)
        let bySite = null;
        if (!poQ && list.length > MAX_POS && !site) {
            bySite = countBy(list, 'siteLabel');
            delete bySite.unknown;
        }
        const shown = list.slice(0, MAX_POS);
        const jobs = await ensureJobs(shown.map((p) => p.po));
        const pos = await Promise.all(shown.map(async (p) => {
            let invMap = {};
            try { invMap = await poInvoices(p.po); } catch (_) { invMap = {}; }
            const invs = Object.keys(invMap || {}).map((k) => Object.assign({ __key: k }, invMap[k] || {}))
                .sort((a, b) => String(a.invEntryID || '').localeCompare(String(b.invEntryID || ''), undefined, { numeric: true }));
            let items = receptionItems(jobs, p.po, acc).concat(invs.map((inv) => trackInvoice(inv, acc)));
            if (year) items = items.filter((i) => (i._years || []).indexOf(year) !== -1);
            // 15.0.0 patch 36: still in progress first, With Accounts / Paid last;
            // newest first inside each group
            const done = (i) => (i.stage_index >= 4 && !i.side_status) ? 1 : 0;
            items.sort((a, b) => (done(a) - done(b)) || ((b._t || 0) - (a._t || 0)));
            const open = items.some((i) => !done(i));
            const last = items.reduce((m, i) => Math.max(m, i._t || 0), 0);
            items.forEach((i) => { delete i._years; delete i._t; });
            return { po: p.po, vendor: p.vendor || (invs[0] && invs[0].vendorName) || '', site: p.siteLabel || undefined, year: p.year || undefined,
                po_value: acc.amounts && p.poValue ? money(p.poValue) : undefined, items: items, _open: open, _last: last };
        }));
        pos.sort((a, b) => ((b._open ? 1 : 0) - (a._open ? 1 : 0)) || ((b._last || 0) - (a._last || 0)));
        pos.forEach((p) => { delete p._open; delete p._last; });
        const posOut = year ? pos.filter((p) => p.items.length || p.year === year) : pos;
        return { mode: 'pos', vendor: vendorLabel, total: year ? posOut.length : list.length, shown: posOut.length, more: list.length > shown.length ? list.length - shown.length : undefined, checked: shown.length,
            by_site: bySite || undefined,
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
    // ------------------------------------------------------------------
    // 15.0.0 patch 11: recent status changes -> Batch Entry
    // "Under Review from the last 2 hours", "the CEO Approval ones I did this
    // morning". Uses the small shared task list (status + last update), then
    // reads only the matching invoices to confirm who changed it and when.
    // ------------------------------------------------------------------
    function qMidnight(offsetDays) { return qDay().getTime() - 3 * 3600000 + (offsetDays || 0) * 86400000; }
    function recentWindow(a) {
        const now = Date.now();
        const hours = Number(a.hours);
        if (Number.isFinite(hours) && hours > 0) return { from: now - Math.min(hours, 24 * 14) * 3600000, to: now, label: 'last ' + hours + ' hour' + (hours === 1 ? '' : 's') };
        const day = norm(a.day) === 'yesterday' ? -1 : 0;
        const p = norm(a.period);
        const base = qMidnight(day);
        const dayWord = day ? 'yesterday' : 'today';
        if (p === 'morning') return { from: base, to: Math.min(now, base + 12 * 3600000), label: (day ? 'yesterday' : 'this') + ' morning' };
        if (p === 'afternoon') return { from: base + 12 * 3600000, to: Math.min(now, base + 24 * 3600000), label: (day ? 'yesterday' : 'this') + ' afternoon' };
        return { from: base, to: Math.min(now, base + 24 * 3600000), label: dayWord };
    }
    function fmtClock(t) {
        try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)); } catch (_) { return ''; }
    }
    async function toolRecent(args) {
        const a = args || {};
        // 15.0.0 patch 12: Super Admin only
        if (!isSuper()) return { result: { error: 'Recent status changes are for the Super Admin only.' } };
        const want = String(a.status || '').trim();
        if (!want) return { result: { error: 'Which status? e.g. Under Review, CEO Approval, In Process.' } };
        const win = recentWindow(a);
        const mine = a.by_me === true || norm(a.by_me) === 'true';
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !idb.ref) return { result: { error: 'The invoice database is not available on this page.' } };
        // 1) candidates: the small "recently changed" list every invoice update
        //    writes (workdesk_dashboard_recent; only rows changed since the start
        //    of the window are downloaded). If that cannot be read, the shared
        //    task list is used instead (active statuses only).
        const cand = new Map();
        const take = (k, r) => {
            const po = String((r && (r.po || r.originalPO)) || '').trim();
            if (!po || !statusMatch(r.status || r.remarks, want)) return;
            const up = Number(r.updatedAt) || 0;
            if (up && up < win.from) return;
            cand.set(po + '|' + k, { po: po, key: String(r.invoiceKey || r.originalKey || k) });
        };
        let recentOk = false;
        try {
            const snap = await withTimeout(idb.ref('workdesk_dashboard_recent').orderByChild('updatedAt').startAt(win.from - 60000).once('value'), 12000, 'recent changes');
            const rows = (snap && snap.val()) || {};
            Object.keys(rows).forEach((k) => take(k, rows[k] || {}));
            recentOk = true;
        } catch (_) {}
        if (!recentOk || !cand.size) {
            try {
                const snap = await withTimeout(idb.ref('invoice_tasks_by_user/All').once('value'), 12000, 'task list');
                const all = (snap && snap.val()) || {};
                Object.keys(all).forEach((k) => take(k, all[k] || {}));
            } catch (_) {}
        }
        // statuses that are not in the task list: invoices already in memory (no download)
        try {
            if (typeof allInvoiceData !== 'undefined' && allInvoiceData) Object.keys(allInvoiceData).forEach((po) => {
                const inv = allInvoiceData[po] || {};
                Object.keys(inv).forEach((k) => {
                    const v = inv[k] || {};
                    if (!statusMatch(v.status, want)) return;
                    if (historyList(v).some((h) => statusMatch(h.status, want) && h.at >= win.from && h.at <= win.to)) cand.set(po + '|' + k, { po: po, key: k });
                });
            });
        } catch (_) {}
        const list = Array.from(cand.values()).slice(0, 120);
        // 2) confirm each from the invoice itself (fresh read, 8 at a time)
        const me = norm(myName());
        const found = [];
        let i = 0;
        const worker = async () => {
            while (i < list.length) {
                const c = list[i++];
                try {
                    const snap = await withTimeout(idb.ref('invoice_entries/' + c.po + '/' + c.key).once('value'), 9000, 'invoice');
                    const v = (snap && snap.val()) || null;
                    if (!v || !statusMatch(v.status, want)) continue;
                    const hist = historyList(v);
                    let hit = null;
                    for (let j = hist.length - 1; j >= 0; j--) {
                        const h = hist[j];
                        if (!statusMatch(h.status, want)) continue;
                        if (h.at >= win.from && h.at <= win.to && (!mine || norm(h.by) === me)) { hit = h; }
                        break; // only the latest change to this status counts
                    }
                    if (!hit && !hist.length) {
                        const t = Number(v.statusChangedAt || v.lastUpdated || v.updatedAt) || 0;
                        const by = String(v.updatedBy || v.enteredBy || '');
                        if (t >= win.from && t <= win.to && (!mine || norm(by) === me)) hit = { at: t, by: by };
                    }
                    if (hit) found.push({ key: c.key, po: c.po, inv: v, at: hit.at, by: hit.by });
                } catch (_) {}
            }
        };
        await Promise.all(Array.from({ length: Math.min(8, list.length) }, worker));
        found.sort((p, q) => p.at - q.at);
        const rows = found.map((f) => ({ po: f.po, invoice_no: f.inv.invNumber || f.inv.invEntryID || '—', status: f.inv.status || '', with: f.inv.attention || undefined,
            vendor: f.inv.vendorName || undefined, changed_at: fmtDate(f.at) + ' ' + fmtClock(f.at), changed_by: f.by || undefined }));
        const label = want + ' · ' + win.label + (mine ? ' · by you' : '');
        const toBatch = a.add_to_batch !== false && norm(a.add_to_batch) !== 'false' && isSuper() && found.length && typeof addInvoiceToBatchTable === 'function';
        if (toBatch) {
            await ensureBase();
            const map = poMap();
            const items = found.map((f) => { const pi = poInfo({ po: f.po, rec: map[f.po] || null }); return { key: f.key, po: f.po, site: pi.siteLabel || 'N/A', vendor: pi.vendor || f.inv.vendorName || 'N/A', inv: f.inv, at: f.at, by: f.by }; });
            const out = await toolBatch(Object.assign({}, a, { _found: items, _label: label, _asked: [] }));
            if (out.result) { out.result.found = rows.length; out.result.window = win.label; out.result.changes = rows.slice(0, 40); }
            return out;
        }
        return { result: { status: want, window: win.label, by_me: mine || undefined, found: rows.length, invoices: rows.slice(0, 40) },
            card: { kind: 'recent', data: { label: label, rows: rows } } };
    }

    // ------------------------------------------------------------------
    // 15.0.0 patch 15: people - a colleague's profile from the IBA user list
    // (already loaded for the Attention lists; nothing extra is downloaded)
    // ------------------------------------------------------------------
    // 15.0.0 patch 31: site and position filters ("Site DC and Storekeeper at 178")
    function userSiteCodes(v) {
        return String(v == null ? '' : v).split(/[,;\/]+/).map((x) => x.trim()).filter(Boolean)
            .map((x) => x.split(/\s+-\s*|\s*-\s+|\s+/)[0].toUpperCase());
    }
    function siteTokenOf(v) { const s = String(v == null ? '' : v).trim(); return s ? s.split(/\s+-\s*|\s*-\s+|\s+/)[0].toUpperCase() : ''; }
    const POS_ALIASES = { 'srv team': ['site dc', 'storekeeper', 'camp boss'], 'store keeper': ['storekeeper'], 'storekeeper': ['storekeeper', 'store keeper'], 'dc': ['site dc'], 'site dc': ['site dc'] };
    function posWanted(v) {
        return String(v == null ? '' : v).split(/[,;\/&]+|\band\b/i).map((x) => norm(x)).filter(Boolean)
            .reduce((a, x) => a.concat(POS_ALIASES[x] || [x.replace(/s$/, '')]), []);
    }
    function posMatches(pos, wanted) {
        const p = norm(pos), c = p.replace(/[.\s_\-]+/g, '');
        return wanted.some((w) => p.indexOf(w) !== -1 || c.indexOf(w.replace(/[.\s_\-]+/g, '')) !== -1);
    }
    async function toolPerson(args) {
        const a = args || {};
        let q = norm(a.name || a.person || a.text || a.query);
        let site = siteTokenOf(a.site);
        let wanted = posWanted(a.position || a.positions);
        // a site number typed in the name box ("site dc 178") is a site filter
        if (!site && q && !/^\+?[\d\s\-()]{7,}$/.test(q)) { const m = q.match(/(?:^|\s)(?:site\s*)?([a-z]?\d{2,4})(?:\s|$)/i); if (m && (a.site === undefined)) { site = m[1].toUpperCase(); q = norm(q.replace(m[0], ' ')).replace(/^site\s*|\s*site$/g, '').trim(); } }
        if (!q && !site && !wanted.length) return { result: { error: 'Whose profile? Give a name, a position or a site.' } };
        let map = {};
        try { if (typeof ibaApproverMap === 'function') map = ibaApproverMap() || {}; } catch (_) {}
        if (!Object.keys(map).length) {
            try { if (typeof ensureApproverDataCached === 'function') await withTimeout(ensureApproverDataCached(false), 9000, 'users'); } catch (_) {}
            try { if (typeof ibaApproverMap === 'function') map = ibaApproverMap() || {}; } catch (_) {}
        }
        const words = q.split(/\s+/).filter(Boolean);
        let all = Object.keys(map).map((k) => Object.assign({ key: k }, map[k] || {})).filter((a) => a.Name);
        if (site) all = all.filter((x) => userSiteCodes(x.Site).indexOf(site) !== -1);
        if (wanted.length) all = all.filter((x) => posMatches(x.Position, wanted));
        const hay = (a) => norm([a.Name, a.Position, a.Role, a.Site, a.Email].join(' '));
        let hits = q ? all.filter((a) => norm(a.Name) === q) : [];
        // 15.0.0 patch 41: a mobile number finds the person (with or without +974 / spaces)
        const digits = q.replace(/[\s+\-()]/g, '');
        if (!hits.length && /^\d{5,}$/.test(digits)) {
            const d8 = digits.replace(/^(00)?974/, '');
            hits = all.filter((a) => { const m = String(a.Mobile || a.mobile || a.Phone || '').replace(/\D+/g, '').replace(/^(00)?974/, ''); return m && (m.indexOf(d8) !== -1 || d8.indexOf(m) !== -1); });
            if (hits.length) words.length = 0;
        }
        if (!hits.length) hits = all.filter((a) => words.every((w) => hay(a).indexOf(w) !== -1));
        // site lists: the site people first (Site DC, Storekeeper, Camp Boss, Logistic), then by name
        const rank = (x) => { const p = norm(x.Position); return /site\s*dc/.test(p) ? 0 : /store\s*keeper/.test(p) ? 1 : /camp boss/.test(p) ? 2 : /logistic/.test(p) ? 3 : 4; };
        if (site || wanted.length) hits.sort((x, y) => rank(x) - rank(y) || String(x.Name).localeCompare(String(y.Name)));
        hits = hits.slice(0, site || wanted.length ? 40 : 6);
        if (!hits.length && (site || wanted.length)) return { result: { found: 0, error: 'Nobody' + (wanted.length ? ' with position ' + (a.position || wanted.join(', ')) : '') + (site ? ' at site ' + site : '') + ' in the user list.' } };
        // 15.0.0 patch 33: Active / On vacation (same rule as the vacation hand-over)
        const awayOf = (x) => {
            const on = x.Vacation === true || norm(x.Vacation) === 'yes';
            if (!on) return null;
            const r = String(x.DateReturn || '').trim();
            if (r) { const d = new Date(r); if (!isNaN(d)) { d.setHours(23, 59, 59, 999); if (Date.now() > d.getTime()) return null; } }
            return { back: r ? fmtDate(r) || r : '', by: String(x.ReplacementName || '').trim() };
        };
        const everyone = Object.keys(map).map((k) => map[k] || {});
        const coverFor = (name) => everyone.filter((x) => x.Name && awayOf(x) && norm(x.ReplacementName) === norm(name)).map((x) => String(x.Name));
        // 15.0.0 patch 34: the replacement's contact on a vacation card
        const keyOfName = {}; Object.keys(map).forEach((k) => { const x = map[k] || {}; if (x.Name) keyOfName[norm(x.Name)] = k; });
        const contactOf = (name) => {
            const k = keyOfName[norm(name)]; if (!k) return null;
            const x = map[k] || {};
            return { key: k, name: String(x.Name || name), position: String(x.Position || ''), mobile: String(x.Mobile || x.mobile || x.Phone || ''), email: String(x.Email || x.email || '') };
        };
        const people = hits.map((a) => {
            const v = awayOf(a);
            return { key: a.key, name: String(a.Name || ''), position: String(a.Position || ''), role: String(a.Role || ''),
                site: String(a.Site || ''), mobile: String(a.Mobile || a.mobile || a.Phone || ''), email: String(a.Email || a.email || ''),
                status: v ? 'On vacation' : 'Active', back: v ? v.back : '', replacement: v ? v.by : '', rep: v && v.by ? contactOf(v.by) : null, covering: coverFor(a.Name) };
        });
        return { result: { found: people.length, people: people.map((p) => ({ name: p.name, position: p.position, site: p.site, mobile: p.mobile, email: p.email,
            status: p.status, back_on: p.back || undefined, replacement: p.replacement || undefined,
            replacement_contact: p.rep ? { position: p.rep.position || undefined, mobile: p.rep.mobile || undefined, email: p.rep.email || undefined } : undefined, covering_for: p.covering.length ? p.covering : undefined })) },
            card: { kind: 'person', data: { q: [a.position || '', site ? 'site ' + site : '', q].filter(Boolean).join(' · '), people: people } } };
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
        if (a._found) return batchAdd(a._found, a, [], { asked: a._asked || [], status_filter: a._label || undefined });
        const pos = parsePOs(a.pos || a.po);
        // 17.0.0 patch 34: no POs but a status = every invoice now in that status
        if (!pos.length && String(a.status || '').trim()) return batchByStatus(a);
        if (!pos.length) return { result: { error: 'Give the PO numbers to put into Batch Entry, or pick a status to take every invoice in it.' } };
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
            // 15.0.0 patch 15: without a status, finished invoices (With Accounts,
            // Paid) are left out unless asked; "latest only" keeps just the
            // last invoice entered on each PO.
            const finished = (st) => /^(with accounts|paid)$/.test(norm(st));
            let match = keys.filter((k) => statusMatch((inv[k] || {}).status, want) && (want || a.include_finished === true || !finished((inv[k] || {}).status)))
                .sort((p, q) => String((inv[p] || {}).invEntryID || '').localeCompare(String((inv[q] || {}).invEntryID || ''), undefined, { numeric: true }));
            if (match.length && (a.latest_only === true || norm(a.latest_only) === 'true')) {
                const t = (k) => Number((inv[k] || {}).createdAt || (inv[k] || {}).enteredAt) || 0;
                match = [match.slice().sort((p, q) => (t(p) - t(q)) || String((inv[p] || {}).invEntryID || '').localeCompare(String((inv[q] || {}).invEntryID || ''), undefined, { numeric: true })).pop()];
            }
            if (!match.length && !want && keys.length && keys.every((k) => finished((inv[k] || {}).status))) {
                notAdded.push({ po: x.po, reason: 'All its invoices are With Accounts or Paid (left out)' });
                return;
            }
            if (!match.length) {
                const has = Array.from(new Set(keys.map((k) => String((inv[k] || {}).status || '').trim() || 'no status')));
                notAdded.push({ po: x.po, reason: 'No invoice in ' + want + ' (now: ' + has.join(', ') + ')' });
                return;
            }
            match.forEach((k) => found.push({ key: k, po: x.po, site: pi.siteLabel || 'N/A', vendor: pi.vendor || 'N/A', inv: inv[k] || {} }));
        });
        return batchAdd(found, a, notAdded, { asked: pos, status_filter: want || undefined });
    }
    // Every invoice whose status is exactly a.status, from the saved invoice
    // copy + changes (window.ibaInvoiceEntriesLoad), never a new full read
    // when the copy is fresh. Up to BY_STATUS_MAX rows.
    const BY_STATUS_MAX = 100;
    async function batchByStatus(a) {
        if (typeof addInvoiceToBatchTable !== 'function') return { result: { error: 'Batch Entry is not available on this page.' } };
        if (typeof window.ibaInvoiceEntriesLoad !== 'function') return { result: { error: 'The invoice list is not available on this page.' } };
        const want = norm(a.status);
        await ensureBase();
        const map = poMap();
        const all = ((await window.ibaInvoiceEntriesLoad()) || {}).data || {};
        let found = [];
        Object.keys(all).forEach((po) => {
            const inv = all[po];
            if (!inv || typeof inv !== 'object') return;
            Object.keys(inv).forEach((k) => {
                const e = inv[k];
                if (!e || typeof e !== 'object' || norm(e.status) !== want) return;
                found.push({ key: k, po: po, inv: e });
            });
        });
        found.sort((p, q) => String(p.po).localeCompare(String(q.po), undefined, { numeric: true }) ||
            String(p.inv.invEntryID || '').localeCompare(String(q.inv.invEntryID || ''), undefined, { numeric: true }));
        const total = found.length;
        const notAdded = [];
        if (!total) notAdded.push({ po: '—', reason: 'No invoice is in ' + a.status + ' right now' });
        if (total > BY_STATUS_MAX) {
            notAdded.push({ po: '—', reason: (total - BY_STATUS_MAX) + ' more in ' + a.status + ' were left out (up to ' + BY_STATUS_MAX + ' at a time); save these, then run it again' });
            found = found.slice(0, BY_STATUS_MAX);
        }
        found.forEach((f) => {
            const pi = poInfo({ po: f.po, rec: map[f.po] || null });
            f.site = pi.siteLabel || 'N/A';
            f.vendor = pi.vendor || 'N/A';
        });
        return batchAdd(found, a, notAdded, { asked: ['every PO'], status_filter: a.status });
    }
    async function batchAdd(found, a, notAdded, head) {
        if (typeof addInvoiceToBatchTable !== 'function') return { result: { error: 'Batch Entry is not available on this page.' } };
        const result = Object.assign({}, head, { added: [], already_in_batch: [], not_added: notAdded, filled: {} });
        if (found.length) {
            if (!(await openBatchEntry())) return { result: { error: 'Batch Entry could not be opened.' } };
            const body = $('im-batch-table-body');
            for (const f of found) {
                const row = { po: f.po, invoice_no: f.inv.invNumber || f.inv.invEntryID || '—', status: f.inv.status || '', with: f.inv.attention || undefined,
                    changed_at: f.at ? fmtDate(f.at) + ' ' + fmtClock(f.at) : undefined, changed_by: f.by || undefined };
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

    // ------------------------------------------------------------------
    // 15.0.0 patch 23: download a list of invoices in ANY status (Under
    // Review, With Accounts, Paid, ...) as a CSV for Excel, the same set
    // Invoice Records shows for that status. Low cost: it uses the invoices
    // already in memory, or the saved copy (Invoice Records / weekly report)
    // plus only the POs changed since then; a full read happens only when
    // there is no copy from the last 24 hours (and that copy is then saved).
    // ------------------------------------------------------------------
    const EXPORT_WHEN = [['any', 'Any time (all now in this status)'], ['2h', 'Last 2 hours'], ['today', 'Today'], ['yesterday', 'Yesterday'],
        ['week', 'This week (from Saturday)'], ['month', 'This month'], ['30d', 'Last 30 days']];
    function exportStatusOpts() {
        const base = ['Under Review', 'With Accounts', 'Paid', 'SRV Done', 'For SRV', 'For Approval', 'CEO Approval', 'In Process', 'For Summary', 'Report', 'Report Approval', 'Report Approved', 'On Hold', 'Pending', 'Unresolved', 'IPC Application'];
        const seen = new Set();
        return base.concat(statusOptions()).filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; }).map((x) => [x, x]);
    }
    function exportWindow(when) {
        const w = norm(when || 'any'), now = Date.now();
        if (!w || w === 'any' || w === 'all') return null;
        if (w === '2h') return { from: now - 2 * 3600000, to: now, label: 'last 2 hours' };
        if (w === 'today') return { from: qMidnight(0), to: now, label: 'today' };
        if (w === 'yesterday') return { from: qMidnight(-1), to: qMidnight(0), label: 'yesterday' };
        if (w === 'week') { const back = (qDay().getUTCDay() + 1) % 7; return { from: qMidnight(-back), to: now, label: 'this week' }; }
        if (w === 'month') { const d = qDay(); return { from: qMidnight(-(d.getUTCDate() - 1)), to: now, label: 'this month' }; }
        if (w === '30d') return { from: now - 30 * 86400000, to: now, label: 'last 30 days' };
        const h = parseFloat(w);
        if (Number.isFinite(h) && h > 0) return { from: now - h * 3600000, to: now, label: 'last ' + h + ' hours' };
        return null;
    }
    async function exportLoadInvoices() {
        try {
            if (window.__invoiceEntriesFullLoaded === true && typeof allInvoiceData !== 'undefined' && allInvoiceData && Object.keys(allInvoiceData).length) {
                return { data: allInvoiceData, info: { mode: 'memory', bytes: 0 } };
            }
        } catch (_) {}
        if (typeof window.ibaInvoiceEntriesLoad === 'function') return await window.ibaInvoiceEntriesLoad();
        if (window.ibaWeeklyReport && typeof window.ibaWeeklyReport.loadInvoices === 'function') {
            return await window.ibaWeeklyReport.loadInvoices(false, () => {});
        }
        const snap = await invoiceDb.ref('invoice_entries').once('value');
        return { data: (snap && snap.val()) || {}, info: { mode: 'full', bytes: 0 } };
    }
    function fileNameFor(inv, st) {
        const s2 = norm(st);
        const pick = (...k) => { for (const x of k) { const v = String((inv && inv[x]) || '').trim(); if (v && !/^nil$/i.test(v)) return v; } return ''; };
        if (/report/.test(s2)) return pick('reportName', 'report_name');
        if (/with accounts|srv done|paid/.test(s2)) return pick('srvName', 'srv_name');
        return pick('invName', 'inv_name');
    }
    function csvCell(v) {
        const t = String(v === null || v === undefined ? '' : v).replace(/\r?\n/g, ' ');
        return /[",;]/.test(t) || /^\s|\s$/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }
    async function toolExport(args) {
        const a = args || {};
        if (!isSuper()) return { result: { error: 'Downloading invoice lists is for the Super Admin only.' } };
        const want = String(a.status || '').trim();
        if (!want) return { result: { error: 'Which status? e.g. Under Review, With Accounts, Paid.' } };
        const wants = want.split(/\s*[,+&]\s*|\s+and\s+/i).map(norm).filter(Boolean);
        const win = exportWindow(a.when || a.period);
        const siteQ = norm(a.site), vendorQ = norm(a.vendor);
        const loaded = await exportLoadInvoices();
        const data = loaded.data || {};
        const poMapX = (typeof allPOData !== 'undefined' && allPOData) ? allPOData : {};
        const reached = (inv, st) => (typeof ibaStatusReachedAt === 'function') ? ibaStatusReachedAt(inv, st) : (Number(inv.statusChangedAt) || 0);
        const rows = [];
        Object.keys(data).forEach((po) => {
            const bucket = data[po];
            if (!bucket || typeof bucket !== 'object') return;
            const rec = poMapX[po] || {};
            Object.keys(bucket).forEach((k) => {
                const inv = bucket[k];
                if (!inv || typeof inv !== 'object') return;
                const st = String(inv.status || '').trim();
                if (wants.indexOf(norm(st)) === -1) return; // exact, as Invoice Records
                const site = String(rec['Project ID'] || inv.site || '').trim();
                const vendor = String(inv.vendorName || inv.vendor_name || rec['Supplier Name'] || '').trim();
                if (siteQ && norm(site).indexOf(siteQ) === -1) return;
                if (vendorQ && norm(vendor).indexOf(vendorQ) === -1) return;
                const at = reached(inv, norm(st));
                if (win && (!at || at < win.from || at > win.to)) return;
                rows.push({ po: po, key: k, invoice_no: String(inv.invNumber || '').trim(), entry: String(inv.invEntryID || '').trim(), vendor: vendor, site: site,
                    invoice_date: inv.invoiceDate || '', value: num(inv.invValue), paid: num(inv.amountPaid), status: st, since: at ? fmtDate(at) + ' ' + fmtClock(at) : '',
                    days: at ? Math.max(0, Math.floor((Date.now() - at) / 86400000)) : '', attention: String(inv.attention || '').trim(), entered_by: String(inv.enteredBy || '').trim(),
                    release: inv.releaseDate || '', note: String(inv.note || '').trim(), _at: at || 0, file: fileNameFor(inv, st) });
            });
        });
        rows.sort((x, y) => (x._at - y._at) || String(x.po).localeCompare(String(y.po), undefined, { numeric: true }));
        // 15.0.0 patch 41: only what is needed to rename the scanned files.
        // "Inv name / SRV name / Report name" is the one name that changes with the
        // status: Report steps -> report name, With Accounts / SRV Done / Paid ->
        // SRV name, everything else (e.g. Under Review) -> invoice name.
        const head = ['Time', 'PO', 'Site', 'Inv No', 'Inv name / SRV name / Report name', 'Inv Amount', 'Amount Paid', 'Status'];
        const csv = [head.join(',')].concat(rows.map((r) => [r.since, r.po, r.site, r.invoice_no, r.file, r.value.toFixed(2), r.paid.toFixed(2), r.status].map(csvCell).join(','))).join('\r\n');
        const pos = new Set(rows.map((r) => r.po)).size;
        const total = rows.reduce((t, r) => t + r.value, 0);
        const label = wants.map((w) => (exportStatusOpts().find((o) => norm(o[0]) === w) || [w])[0]).join(' + ') + (win ? ' · ' + win.label : '') + (a.site ? ' · site ' + a.site : '') + (a.vendor ? ' · ' + a.vendor : '');
        const src = loaded.info && loaded.info.mode === 'memory' ? 'invoices already loaded (no download)'
            : loaded.info && loaded.info.mode === 'saved' ? 'saved copy + ' + (loaded.info.changed || 0) + ' changed PO(s) read'
            : 'all invoices read once (saved for next time)';
        const fname = 'IBA_' + wants.map((w) => w.replace(/[^a-z0-9]+/g, '_')).join('_') + (win ? '_' + norm(win.label).replace(/[^a-z0-9]+/g, '_') : '') + '_' + todayISO() + '.csv';
        const result = { found: rows.length, pos: pos, total_value: money(total), label: label, source: src,
            first: rows.slice(0, 15).map((r) => ({ po: r.po, invoice_no: r.invoice_no, vendor: r.vendor, value: money(r.value), since: r.since, with: r.attention })) };
        if (!rows.length) result.note = 'No invoice is in that status' + (win ? ' for that time' : '') + '.';
        return { result: result, card: { kind: 'export', data: Object.assign({}, result, { csv: csv, file: fname, rows: rows.slice(0, 8) }) } };
    }

    const RUN = {
        get_brief: toolBrief,
        list_my_tasks: toolList,
        find_po: toolFindPO,
        open_po: toolOpenPO,
        fill_invoice_form: toolFill,
        track_invoices: toolTrack,
        reception_received: toolReception,
        job_records: toolJobs,
        add_to_batch: toolBatch,
        find_person: toolPerson,
        recent_status_changes: toolRecent,
        invoices_by_status: toolStatus,
        invoice_activity: toolActivity,
        track_transfer: toolTransfer,
        find_transfers: toolTransferFind,
        download_invoices: toolExport
    };
    const SUPER_ONLY = ['find_po', 'open_po', 'fill_invoice_form', 'add_to_batch', 'recent_status_changes', 'download_invoices'];
    async function runTool(name, args) {
        if (SUPER_ONLY.indexOf(name) !== -1 && !isSuper()) return { result: { error: 'This job is only for the Super Admin.' } };
        if (!phoneOk(name)) return { result: { error: PHONE_NO } };
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
            isSuper() && !onPhone() ? 'Status changes in a time window ("last 2 hours", "this morning", "this afternoon", "today", "yesterday", "I did / I made") -> recent_status_changes (it also puts them into Batch Entry).' : '',
            'A colleague\'s number, email, site or position, or "who is X" -> find_person (it shows a button to message them in IBA).',
            isSuper() ? 'A file / download / Excel / CSV / full list of invoices in a status (also Under Review, With Accounts, Paid, which invoices_by_status leaves out) -> download_invoices; then say the file is ready on the card.' : '',
            'Which tool: received / entered / encoded / came in / submitted to Reception -> job_records (do not pass entered_by unless the user names a person or role; the answer already shows who entered each). The user\'s own waiting items (my tasks, with me, assigned to me) -> list_my_tasks. Where an invoice is now and its steps -> track_invoices. Who handled / who last managed -> invoice_activity. Invoices in a status (For SRV, On Hold, For IPC, approvals) -> invoices_by_status. "Invoices for IPC process" -> call job_records with type ipc and open_only true AND invoices_by_status with status For IPC, then answer in two groups (IPC jobs still in WorkDesk / invoices in Invoice Entry waiting for IPC).',
            'Inventory (Material): a Transfer moves stock between sites in 3 steps: the source site contact confirms and sends (Pending Source), the admin/approver authorizes (Pending Admin; stock leaves the source), the receiver at the destination confirms receipt (In Transit; stock is added), then Completed. Restock and Return: approver then receiver. Usage: approver then the requester confirms actual usage (Pending Confirmation). For any control number like TRF-0361 / STK- / USE- / RET-, or "who has / who must confirm this transfer", call track_transfer and name the person who must act, the step, and since when; mention any problems it reports. PO numbers and vehicle numbers can look the same (5 digits): a bare number is a PO for invoice questions; when the user says vehicle, Vh, plate, equipment, machine, loader, truck, material or transfer with the number, it is NOT a PO - use find_transfers; if it is unclear, ask which one they mean. To find requests by what they contain (a vehicle/equipment number like 36588, a machine like "wheel loader", an item, a person) call find_transfers with those words, then name the matching control numbers and who has each.',
            'For dates, pass the user\'s words in the "when" field (e.g. "last thursday", "past week", "2026"); the system works out the exact dates.',
            'Be warm, brief and practical. Reply in the language the user writes in.',
            // 15.0.0 patch 46: short replies, the cards already show the details
            'The tool results are already shown to the user as cards right above your reply. Do NOT repeat them: no tables, no lists of invoices or jobs, no headings, no PO summary. Reply in 1 or 2 short sentences with only the key point or the next step, e.g. "PO 62921: 1 invoice, paid in full; QAR 6,494,543.00 is still open on the PO." Never end with offers such as "Let me know if you need...".',
            'Use the tools for any fact about POs, invoices, tasks, inventory or people. Never guess numbers, names or statuses.',
            'Money is QAR with 2 decimals. Dates look like 08-Oct-2026.',
            'PAYMENT RULE: an invoice is paid ONLY when its status is "Paid". Status "With Accounts" means payment is in process (Accounts will pay). Every other status (SRV Done, For SRV, approvals, On Hold, ...) means NOT paid yet. "Invoiced" means invoices received, not paid. Always use the payment field; never say paid otherwise.',
            'When the user names a vendor, supplier or company (with or without a PO), call track_invoices with vendor (and site / year if given). If it returns suggestions, ask which vendor they mean.',
            'You cannot save, approve, delete or send anything. To prepare a new invoice use fill_invoice_form, then tell the user to check the form and press Add.',
            onPhone() ? 'The user is on the PHONE. Here you only search and track by PO or vendor (track_invoices shows every received item: at Reception, with the QS for IPC, in Invoice Entry, approvals, Accounts, paid) and transfers, help them remind someone (the Remind button on a result) and find a colleague to message or call (find_person). For anything else (brief, Batch Entry, new invoice, reports, downloads) say it is on the computer.' : '',
            isSuper() && !onPhone() ? 'To update several invoices at once use Batch Entry: add_to_batch with the PO numbers (status filter when the user names the current status, e.g. "the CEO Approval ones"; set_status / set_attention / set_note only when the user says what to change). Then tell the user to check the rows and press Save. You can use Batch Entry; never say you cannot.' : '',
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
        if (withTools) {
            // 15.0.0 patch 9: Gemini refuses a tool whose parameters have no fields
            // ("properties: should be non-empty for OBJECT type"), which made
            // every question fail after a successful Test.
            body.tools = toolDefs().map((t) => {
                const fn = Object.assign({}, t);
                const props = fn.parameters && fn.parameters.properties;
                if (!props || !Object.keys(props).length) delete fn.parameters;
                return { type: 'function', function: fn };
            });
            body.tool_choice = 'auto';
        }
        if (c.brain === 'groq' && /gpt-oss/i.test(c.model) && !(opts && opts.noReasoningEffort)) body.reasoning_effort = 'low';
        const headers = { 'Content-Type': 'application/json' };
        // 15.0.0 patch 24: Google AI Studio now gives "AQ." keys. They normally
        // work as "Bearer" on the OpenAI-compatible address; if Google refuses
        // that, the call is tried once more with Google's own key header.
        const googleHeader = !!(opts && opts.googleKeyHeader);
        if (c.key && googleHeader) headers['x-goog-api-key'] = c.key;
        else if (c.key) headers.Authorization = 'Bearer ' + c.key;
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
            const m = String(msg);
            const reasonOf = () => { try { const det = (data && data.error && data.error.details) || []; const r = det.map((d) => d && d.reason).filter(Boolean)[0]; return r || ((m.match(/[A-Z_]{12,}/) || [])[0] || ''); } catch (_) { return ''; } };
            if (res.status === 401 || res.status === 403 || /api.?key.*(not valid|invalid)|API_KEY_INVALID|permission/i.test(m)) {
                if (c.brain === 'gemini' && !googleHeader) return callBrain(messages, withTools, Object.assign({}, opts || {}, { googleKeyHeader: true }));
                const why = reasonOf();
                let tip = '. Check it in Setup.';
                if (c.brain === 'gemini') {
                    tip = ' by Google' + (why ? ' (' + why + ')' : '') + '. ';
                    if (/SERVICE_BLOCKED|API_KEY_SERVICE/i.test(why)) tip += 'The key is not allowed to use the Gemini API: in aistudio.google.com > API Keys open the key, or in Google Cloud > Credentials set its API restriction to "Generative Language API" (or no restriction), then Test again.';
                    else if (/TOKEN_TYPE|INVALID|EXPIRED/i.test(why)) tip += 'Usually the key was not copied whole. In aistudio.google.com > API Keys press the copy button on the key row and paste it here again (no spaces). If it still fails, create a new key in the same page.';
                    else tip += 'In aistudio.google.com > API Keys press the copy button on the key row and paste the whole key here (no spaces).';
                }
                throw Object.assign(new Error('The key was not accepted' + tip), { setup: true });
            }
            if (res.status === 404 || /model.*not (found|supported)|is not found for API version/i.test(m)) {
                throw Object.assign(new Error('Model "' + c.model + '" was not found. In Setup press Find models (or Test) to pick one your key can use.'), { setup: true });
            }
            if (withTools && /tool|function.?call/i.test(m) && (res.status === 400 || res.status === 404 || res.status === 422)) {
                throw Object.assign(new Error('Model "' + c.model + '" cannot use the assistant\'s jobs (tools). In Setup pick another model (Find models), e.g. one with "gpt-oss", "llama-3.3" or "qwen" in the name.'), { setup: true });
            }
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
        // 15.0.0 patch 4: a transfer number (TRF-0361, STK-, USE-, RET-) is
        // answered straight away without the AI: no key needed, no quota used.
        const trfNos = text.match(/\b(?:(?:trf|stk)[\s#:-]*\d{1,6}|(?:use|ret)[-#:]?\d{1,6})\b/gi);
        if (trfNos && trfNos.length && !(opts && opts.silentUser)) {
            addUser(text);
            state.busy = true;
            setBusy(true);
            try { addCard({ kind: 'transfer', data: await transferSearch({ control: trfNos.join(', ') }) }); }
            catch (err) { addError(err); }
            finally { state.busy = false; setBusy(false); }
            return;
        }
        // 15.0.0 patch 47: answered without the AI (key or no key): a PO
        // number, a report / skill word; with no key also a name or vendor
        if (!(opts && opts.silentUser) && await localAnswer(text)) return;
        if (!ready() && /\b(brief|waiting|today|remind(?:er)?s?|my tasks?|pending)\b/i.test(text)) {
            addUser(text);
            return openBrief();
        }
        if (!ready()) {
            showView('chat');
            addUser(text);
            addNote('I need an AI key to answer this properly. Add a free one in Setup (2 minutes). Without it I can still look up a PO number, a vendor, a transfer number or a colleague, and run these:', 'setup');
            quickPicks(QUICK_ALL, true);
            return;
        }
        state.busy = true;
        setBusy(true);
        if (!(opts && opts.silentUser)) addUser(text);
        const steps = [];
        let minimize = false;
        let cardShown = false;
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
                        if (out.card) { addCard(out.card); cardShown = true; }
                        if (out.minimize) minimize = true;
                        msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out.result || {}).slice(0, 6000) });
                    }
                    continue;
                }
                const answer = tidyAnswer(String(m.content || '').trim(), cardShown) || (steps.length ? 'Done. The details are on the card above.' : '…');
                state.lastTurn = { prompt: text, steps: steps.slice(), answer: answer };
                addBot(answer, { canSave: steps.length > 0, prompt: text, steps: steps.slice() });
                if (look().voice) speak(answer);
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
    // 15.0.0 patch 9: a saved number (PO, transfer, vehicle...) is a blank
    // that the skill asks for each time it runs, so "Show PO 12345" works
    // for any PO. Skills without numbers run straight away as before.
    const SKILL_PARAM_KEYS = { po: 'PO number', pos: 'PO number(s)', control: 'Transfer number', text: 'Vehicle / item / words', vendor: 'Vendor', site: 'Site', person: 'Person', with: 'Person' };
    function skillParams(sk) {
        const out = [];
        const seen = {};
        (sk.steps || []).forEach((st) => {
            const a = st.args || {};
            Object.keys(a).forEach((k) => {
                const v = a[k];
                if (v === null || v === undefined || typeof v === 'object' || typeof v === 'boolean') return;
                const sv = String(v).trim();
                if (!sv) return;
                const asks = (k === 'po' || k === 'pos' || k === 'control') || (/\d{3,}/.test(sv) && (k === 'text' || k === 'site'));
                if (!asks || seen[sv]) return;
                seen[sv] = true;
                out.push({ key: k, label: SKILL_PARAM_KEYS[k] || 'Value', example: sv });
            });
        });
        return out;
    }
    function skillWithValues(sk, values) {
        let json = JSON.stringify(sk.steps || []);
        let prompt = String(sk.prompt || '');
        values.forEach((pv) => {
            if (!pv.value || pv.value === pv.example) return;
            const esc2 = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(esc2(JSON.stringify(pv.example).slice(1, -1)), 'g');
            json = json.replace(re, JSON.stringify(pv.value).slice(1, -1));
            prompt = prompt.replace(new RegExp(esc2(pv.example), 'g'), pv.value);
        });
        return Object.assign({}, sk, { steps: JSON.parse(json), prompt: prompt });
    }
    // 15.0.0 patch 36: every question form can be closed - Cancel, the x in
    // its corner or Esc; opening another skill closes an unanswered form
    let openAsk = null;
    function wireAskCancel(f, resolve) {
        const close = () => {
            if (openAsk === close) openAsk = null;
            if (f.querySelector('button[type="submit"]:disabled')) return; // already answered and running
            if (f.parentNode) f.remove();
            resolve(null);
        };
        if (openAsk) { try { openAsk(); } catch (_) {} }
        openAsk = close;
        const head = f.querySelector('.iba-ai-card-head');
        if (head) head.insertAdjacentHTML('beforeend', '<button type="button" class="iba-ai-ask-x" data-cancel-x title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>');
        f.querySelectorAll('[data-cancel], [data-cancel-x]').forEach((b) => b.addEventListener('click', close));
        f.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    }
    function askSkillValues(sk, params) {
        return new Promise((resolve) => {
            const f = document.createElement('form');
            f.className = 'iba-ai-card is-action iba-ai-skill-ask';
            f.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-bolt"></i> ' + esc(sk.name) + '</div>' +
                params.map((p, i) => '<label class="iba-ai-rem-row"><span>' + esc(p.label) + '</span><input type="text" data-i="' + i + '" placeholder="' + esc(p.example) + '"></label>').join('') +
                '<div class="iba-ai-rem-acts"><button type="submit" class="iba-ai-mini is-main"><i class="fa-solid fa-play"></i> Run</button><button type="button" class="iba-ai-mini iba-ai-cancel" data-cancel><i class="fa-solid fa-xmark"></i> Cancel</button></div>';
            put(f);
            wireAskCancel(f, resolve);
            const first = f.querySelector('input');
            if (first) first.focus();
            f.addEventListener('submit', (e) => {
                e.preventDefault();
                const vals = params.map((p, i) => Object.assign({}, p, { value: String((f.querySelector('input[data-i="' + i + '"]') || {}).value || '').trim() || p.example }));
                f.querySelectorAll('input, button').forEach((x) => { x.disabled = true; });
                resolve(vals);
            });
        });
    }
    // ------------------------------------------------------------------
    // 15.0.0 patch 15: ready-made skills. Each asks for what it needs every
    // time it runs and works without the AI (no key, no quota). You can run
    // them as they are, or save one under your own name in "My skills".
    // ------------------------------------------------------------------
    const WHEN_OPTS = [['2h', 'Last 2 hours'], ['morning', 'This morning'], ['afternoon', 'This afternoon'], ['today', 'Today'], ['yesterday', 'Yesterday']];
    function statusOptsWith(first) { const o = statusOptions(); return [['', first]].concat((o.length ? o : ['Under Review', 'For SRV', 'SRV Done', 'For Approval', 'In Process', 'CEO Approval', 'For Summary', 'Report', 'On Hold']).map((x) => [x, x])); }
    function teamSiteOptions() {
        let map = {};
        try { if (typeof ibaApproverMap === 'function') map = ibaApproverMap() || {}; } catch (_) {}
        const codes = {};
        Object.values(map).forEach((a) => { if (a && a.Name) userSiteCodes(a.Site).forEach((c) => { if (c && /\d/.test(c)) codes[c] = 1; }); });
        let labels = {};
        try { (window.ibaWeeklyReport && window.ibaWeeklyReport.siteChoices ? window.ibaWeeklyReport.siteChoices() : []).forEach((x) => { labels[x[0]] = x[1]; }); } catch (_) {}
        return Object.keys(codes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((c) => [c, labels[c] || c]);
    }
    // 15.0.0 patch 45: quick work - open the real forms, already started
    const JOB_TYPES = ['Invoice', 'PR', 'IPC Application', 'IPC Processed', 'Payment', 'Trip', 'Report', 'Other'];
    async function openNewJob(type, po) {
        if (typeof window.ibaOpenShellPage !== 'function' || typeof window.openStandardJobModal !== 'function') throw new Error('Add New Job is not available on this page.');
        toggle(false);
        await window.ibaOpenShellPage('wd-add-job');
        await waitFor(() => { const m = $('standard-job-modal'); return m && !m.classList.contains('hidden'); }, 6000);
        await wait(300);
        const sel = $('job-for');
        if (sel && type) {
            const has = Array.from(sel.options).some((o) => o.value === type);
            sel.value = has ? type : 'Other';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            if (!has) { const other = $('job-other-specify'); if (other) other.value = type; }
            await wait(250);
        }
        const poEl = $('job-po');
        if (poEl && po) {
            poEl.value = String(po).trim();
            poEl.dispatchEvent(new Event('input', { bubbles: true }));
            poEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const next = ['job-ref', 'job-amount'].map($).find((el) => el && !el.value && el.offsetParent);
        if (next) next.focus();
    }
    async function openNewDelivery(type) {
        if (typeof window.ibaOpenShellPage !== 'function' || typeof openTransferModal !== 'function') throw new Error('The Inventory form is not available on this page.');
        toggle(false);
        await window.ibaOpenShellPage('inv-active-job');
        try { if (typeof ensureAllEntriesFetched === 'function') await withTimeout(ensureAllEntriesFetched(false), 15000, 'Inventory'); } catch (_) {}
        await openTransferModal(type || 'Transfer');
    }
    const SKILL_TPL = {
        // 17.0.0 patch 24: who can open what (js/iba-17-p24.js)
        access_check: { name: 'Access check', icon: 'fa-user-shield', superOnly: true, desc: 'Every user with the pages and buttons the system gives them (Invoice Management, Entry, Records, Payments, Dashboard, Financial Report, Stock, skills), and anything a non-Super-Admin should not have. Nothing is saved.',
            ask: () => [], action: () => { if (typeof window.ibaAccessCheck === 'function') window.ibaAccessCheck(); } },
        new_job: { name: 'Add new job', icon: 'fa-file-circle-plus', desc: 'Pick what the job is for and type the PO: the Add New Job form opens with vendor, vendor ID and site filled from the PO list. Check it and press Add. No AI used.',
            ask: () => [{ key: 'for', label: 'What is it for?', type: 'select', options: JOB_TYPES.map((t) => [t, t]) },
                { key: 'po', label: 'PO number (leave empty if none)', placeholder: 'e.g. 66176', optional: true }],
            run: async (v) => { await openNewJob(v.for, v.po); return null; } },
        // 15.0.0 patch 47: reports picked from a list, no AI needed
        po_report: { name: 'PO report', icon: 'fa-file-invoice-dollar', desc: 'Asks for a PO number, then shows the PO value, invoiced, paid and remaining, every invoice and where it is now. Print or Excel from the card. No AI used.',
            ask: () => [{ key: 'po', label: 'PO number', placeholder: 'e.g. 62921' }],
            build: (v) => [{ tool: 'find_po', args: { po: v.po } }, { tool: 'track_invoices', args: { po: v.po } }] },
        approvals_list: { name: 'Approvals waiting', icon: 'fa-stamp', adminOnly: true, desc: 'Every invoice now in For Approval or CEO Approval, as one printable list grouped by who is approving (or by status / site). No AI used.',
            ask: () => [], run: async () => {
                const r = await sentForApproval();
                if (r.error) throw new Error('The approval list could not be read: ' + r.error);
                if (!r.items.length) return 'Nothing is waiting for approval right now.';
                printApprovalList(r.items, 'with');
                return 'Opened the list of ' + r.items.length + ' invoice' + (r.items.length === 1 ? '' : 's') + ' waiting for approval in a new tab. Press "Print / Save as PDF" there.';
            } },
        new_delivery: { name: 'New delivery', icon: 'fa-truck-fast', desc: 'Opens the Inventory form for a Transfer (delivery to a site), Restock, Return or Usage, numbered and ready to fill in. No AI used.',
            ask: () => [{ key: 'type', label: 'What kind?', type: 'select', options: [['Transfer', 'Transfer - delivery to a site'], ['Restock', 'Restock - stock received'], ['Return', 'Return'], ['Usage', 'Usage']] }],
            run: async (v) => { await openNewDelivery(v.type); return null; } },
        inv_status: { name: 'Check invoice status', icon: 'fa-file-invoice', desc: 'Asks for a PO or vendor, then shows where each invoice is and who has it.',
            ask: () => [{ key: 'q', label: 'PO number or vendor', placeholder: 'e.g. 66176 or Al Noor' }],
            build: (v) => /^\s*(po)?[\s#:-]*\d+\s*$/i.test(v.q) ? [{ tool: 'track_invoices', args: { po: v.q.replace(/\D+/g, '') } }] : [{ tool: 'track_invoices', args: { vendor: v.q } }] },
        transfer: { name: 'Find a transfer', icon: 'fa-truck-ramp-box', desc: 'Asks for a transfer number, vehicle or item, then shows who must act next.',
            ask: () => [{ key: 'q', label: 'Transfer no., vehicle or item', placeholder: 'e.g. TRF-0361, 36588, wheel loader' }],
            build: (v) => looksTransfer(v.q) ? [{ tool: 'track_transfer', args: { control: v.q } }] : [{ tool: 'find_transfers', args: { text: v.q } }] },
        person: { name: 'Find a colleague', icon: 'fa-id-badge', desc: 'Asks for a name, then shows position, site, mobile and email, with a button to message them.',
            ask: () => [{ key: 'q', label: 'Name, position or site', placeholder: 'e.g. Irwin' }],
            build: (v) => [{ tool: 'find_person', args: { name: v.q } }] },
        // 15.0.0 patch 31: who works at a site (no AI): site + position
        site_team: { name: 'Site team', icon: 'fa-people-group', desc: 'Pick a site and the positions you need (e.g. Site DC and Storekeeper) and get each person with mobile, email, WhatsApp and Message. No AI used.',
            ask: () => [{ key: 'site', label: 'Site', type: 'select', options: teamSiteOptions() },
                { key: 'pos', label: 'Who', type: 'select', options: [['site dc, storekeeper, camp boss', 'SRV team: Site DC, Storekeeper, Camp Boss'], ['site dc', 'Site DC'], ['storekeeper', 'Storekeeper'], ['camp boss', 'Camp Boss'], ['logistic', 'Logistic'], ['engineer', 'Engineer'], ['', 'Everyone at the site']] }],
            build: (v) => [{ tool: 'find_person', args: { site: v.site, position: v.pos } }] },
        brief: { name: 'My brief', icon: 'fa-sun', desc: 'Today\'s tasks, inventory jobs and reminders.', ask: () => [], build: () => [{ tool: 'get_brief', args: {} }] },
        batch: { name: 'Add to Batch', icon: 'fa-layer-group', superOnly: true, desc: 'Asks for the POs, which status and which invoices, then puts them into Batch Entry. Leave the POs empty and pick a status to take every invoice in that status (e.g. all CEO Approval). With Accounts and Paid are left out unless you pick them.',
            ask: () => [{ key: 'pos', label: 'PO numbers (empty = every invoice in the status below)', placeholder: 'e.g. 66176, 66180, 66201', poList: true, optional: true },
                { key: 'status', label: 'Only invoices now in', type: 'select', options: statusOptsWith('Any open status (not With Accounts / Paid)') },
                { key: 'which', label: 'Which invoices', type: 'select', options: [['all', 'All of them'], ['latest', 'Only the last invoice entered on each PO']] }],
            build: (v) => {
                const pos = String(v.pos || '').split(/[\s,;]+/).filter(Boolean);
                return [{ tool: 'add_to_batch', args: { pos: pos, status: v.status || undefined, latest_only: v.which === 'latest' } }];
            } },
        // 17.0.2: reception New Entries -> Batch Entry (js/iba-1702-reception-batch.js)
        reception_batch: { name: 'New entries to Batch', icon: 'fa-inbox', superOnly: true, desc: 'Every reception New Entry waiting for you goes into Batch Entry as a new invoice: PO, invoice no., amount, invoice date and group filled in, the next invoice number on the PO, status Under Review, and +Del when the original PO is in the file. You can change any box. On Save each reception entry is closed as Converted to Invoice. POs not in POVALUE2.csv yet are left out and listed. No AI used.',
            ask: () => [], run: async () => {
                if (!window.ibaReceptionBatch) throw new Error('This skill is not loaded on this page.');
                const r = await window.ibaReceptionBatch.run(openBatchEntry);
                if (!r.total) return 'No reception New Entry is waiting for you right now.';
                const line = (x) => '- PO ' + x.po + (x.inv ? ' (' + x.inv + ')' : '') + (x.invoice_no ? ', inv. ' + x.invoice_no : '') + (x.amount ? ', ' + x.amount : '') + (x.reason ? ': ' + x.reason : '');
                let msg = '**' + r.added.length + ' of ' + r.total + '** reception entr' + (r.total === 1 ? 'y' : 'ies') + ' added to Batch Entry as Under Review.';
                if (r.added.length) msg += '\n\n' + r.added.map(line).join('\n');
                if (r.skipped.length) msg += '\n\n**Left out (' + r.skipped.length + ')**\n' + r.skipped.map(line).join('\n');
                if (r.added.length) {
                    msg += '\n\nNothing is saved yet. Check or change the rows, then press Save: each reception entry is then closed as Converted to Invoice.';
                    const btn = $('im-batch-save-button');
                    if (btn) { btn.classList.remove('iba-ai-pulse'); void btn.offsetWidth; btn.classList.add('iba-ai-pulse'); setTimeout(() => btn.classList.remove('iba-ai-pulse'), 6000); }
                }
                return msg;
            } },
        weekly: { name: 'Weekly report', icon: 'fa-chart-column', superOnly: true, desc: 'The meeting report by site: For SRV, For Approval, On Hold, Pending, Unresolved, IPC Application, IPC Processed, Report, sites to sort out and PO Close Out. Print or PDF.',
            ask: () => [], action: () => { if (window.ibaWeeklyReport) window.ibaWeeklyReport.open(); } },
        // 15.0.0 patch 28: For SRV (or another status) by site, as a printable
        // list. No AI, no key: same low-cost data as the weekly report.
        site_list: { name: 'Site list by status', icon: 'fa-clipboard-list', superOnly: true, desc: 'Pick a site (or all sites) and a status - For SRV by default - and get a printable list: PO, invoice, vendor, value, who has it and days. Each site on its own page. No AI used.',
            ask: () => {
                const wr = window.ibaWeeklyReport || {};
                const sites = typeof wr.siteChoices === 'function' ? wr.siteChoices() : [];
                const sts = typeof wr.statusChoices === 'function' ? wr.statusChoices() : [['for srv', 'For SRV']];
                return [{ key: 'site', label: 'Site', type: 'select', options: [['', 'All sites (each on its own page)']].concat(sites) },
                    { key: 'status', label: 'Status', type: 'select', options: sts.concat([['all', 'All of these statuses']]) }];
            },
            run: async (v) => {
                if (!window.ibaWeeklyReport || typeof window.ibaWeeklyReport.siteList !== 'function') throw new Error('The report module is not loaded on this page.');
                const r = await window.ibaWeeklyReport.siteList({ site: v.site, status: v.status || 'for srv' });
                return 'Opened the list in a new tab: ' + r.count + ' item' + (r.count === 1 ? '' : 's') + (v.site ? '' : ' on ' + r.sites + ' site' + (r.sites === 1 ? '' : 's')) + '. Press "Print / Save as PDF" there. No AI used' + (r.mode === 'saved' ? ', only the changed POs were read.' : '.');
            } },
        // 15.0.0 patch 37: mark For Approval / CEO Approval invoices URGENT
        urgent: { name: 'Mark urgent', icon: 'fa-bolt', adminOnly: true, desc: 'Lists every invoice now in For Approval or CEO Approval. Tick the ones to rush and press Mark urgent: they move to the approver\'s Urgent tab right away. No AI used.',
            ask: () => [], run: async () => { await urgentCard(); return null; } },
        // 15.0.0 patch 39: see and undo vacation hand-overs
        handover: { name: 'Vacation hand-overs', icon: 'fa-people-arrows', superOnly: true, desc: 'Who the system treats as on vacation now, and the recent automatic hand-overs. Undo puts the tasks back to the person (only those still with the receiver).',
            ask: () => [], run: async () => { await handoverCard(); return null; } },
        // 15.0.0 patch 43: which Firebase indexes exist (missing ones make filtered reads download whole lists)
        dbcheck: { name: 'Database check', icon: 'fa-database', superOnly: true, desc: 'Checks the Firebase indexes the system relies on to keep downloads small, and shows the rule to add for any that are missing. Each check reads about 1 KB.',
            ask: () => [], run: async () => { await dbCheckCard(); return null; } },
        export: { name: 'Download invoice list', icon: 'fa-file-csv', superOnly: true, desc: 'Asks for a status (Under Review, With Accounts, Paid, ...) and a period, then gives a CSV file for Excel. Uses the saved copy: little or no download.',
            ask: () => [{ key: 'status', label: 'Status', type: 'select', options: exportStatusOpts() },
                { key: 'when', label: 'Reached that status', type: 'select', options: EXPORT_WHEN }],
            build: (v) => [{ tool: 'download_invoices', args: { status: v.status, when: v.when } }] },
        recent: { name: 'Recent changes to Batch', icon: 'fa-clock-rotate-left', superOnly: true, desc: 'Invoices moved to a status in a time window (e.g. CEO Approval this morning), into Batch Entry.',
            ask: () => [{ key: 'status', label: 'Status', type: 'select', options: statusOptsWith('Pick a status').slice(1) },
                { key: 'when', label: 'When', type: 'select', options: WHEN_OPTS },
                { key: 'mine', label: 'Whose changes', type: 'select', options: [['me', 'Only mine'], ['all', 'Everyone\'s']] }],
            build: (v) => {
                const a = { status: v.status, by_me: v.mine !== 'all' };
                if (v.when === '2h') a.hours = 2; else if (v.when === 'yesterday') { a.day = 'yesterday'; a.period = 'whole_day'; } else if (v.when === 'today') a.period = 'whole_day'; else a.period = v.when;
                return [{ tool: 'recent_status_changes', args: a }];
            } }
    };
    function tplAllowed(id) { const t = SKILL_TPL[id]; return !!t && (!t.superOnly || isSuper()) && (!t.adminOnly || isAdminUser()) && (!onPhone() || PHONE_TPL.indexOf(id) !== -1); }
    function askTplValues(title, fields) {
        return new Promise((resolve) => {
            const f = document.createElement('form');
            f.className = 'iba-ai-card is-action iba-ai-skill-ask';
            f.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-bolt"></i> ' + esc(title) + '</div>' +
                fields.map((p, i) => '<label class="iba-ai-rem-row"><span>' + esc(p.label) + '</span>' + (p.type === 'select'
                    ? '<select data-i="' + i + '">' + p.options.map((o) => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>').join('') + '</select>'
                    : '<input type="text" data-i="' + i + '" placeholder="' + esc(p.placeholder || '') + '"' + (p.optional ? '' : ' required') + (p.poList ? ' data-po-list inputmode="numeric" autocomplete="off"' : '') + '>') + '</label>').join('') +
                '<div class="iba-ai-rem-acts"><button type="submit" class="iba-ai-mini is-main"><i class="fa-solid fa-play"></i> Run</button><button type="button" class="iba-ai-mini iba-ai-cancel" data-cancel><i class="fa-solid fa-xmark"></i> Cancel</button></div>';
            put(f);
            wireAskCancel(f, resolve);
            const first = f.querySelector('input, select');
            if (first) first.focus();
            f.addEventListener('submit', (e) => {
                e.preventDefault();
                const vals = {};
                fields.forEach((p, i) => { vals[p.key] = String((f.querySelector('[data-i="' + i + '"]') || {}).value || '').trim(); });
                if (fields.some((p) => p.type !== 'select' && !p.optional && !vals[p.key])) return;
                f.querySelectorAll('input, select, button').forEach((x) => { x.disabled = true; });
                resolve(vals);
            });
        });
    }
    // ------------------------------------------------------------------
    // 15.0.0 patch 37: URGENT for approvals. An approval is Urgent when its
    // Note says "urgent" (the rule the approver's Urgent tab already uses),
    // so marking = "URGENT · " in front of the note, with a history line and
    // the approver's task list updated so it moves to Urgent at once.
    // ------------------------------------------------------------------
    const APPROVAL_RX = /^(for approval|ceo approval)$/i;
    const isUrgentNote = (n) => /\burgent/i.test(String(n || ''));
    const stripUrgent = (n) => String(n || '').replace(/\burgent(ly)?\b\s*[·:\-|,!]*\s*/gi, '').trim();
    // 15.0.0 patch 38: the invoice attachment (same link as the Dashboard's INV button)
    function invPdfUrl(inv) {
        try {
            const name = inv && inv.invName;
            if (!name || /^nil$/i.test(String(name).trim()) || typeof buildSharePointPdfUrl !== 'function' || typeof PDF_BASE_PATH === 'undefined') return '';
            return buildSharePointPdfUrl(PDF_BASE_PATH, name) || '';
        } catch (_) { return ''; }
    }
    // 15.0.0 patch 44: the SRV attachment (SharePoint SRV folder, same as Invoice Records / Summary Note)
    function srvPdfUrl(inv) {
        try {
            const name = inv && inv.srvName;
            if (!name || /^nil$/i.test(String(name).trim()) || typeof buildSharePointPdfUrl !== 'function' || typeof SRV_BASE_PATH === 'undefined') return '';
            return buildSharePointPdfUrl(SRV_BASE_PATH, name) || '';
        } catch (_) { return ''; }
    }
    function srvLink(u) {
        return u ? '<a class="iba-ai-mini" href="' + esc(u) + '" target="_blank" rel="noopener" title="Open the SRV attachment"><i class="fa-regular fa-file-lines"></i> SRV</a>' : '';
    }
    function invPdfBtn(inv) {
        const u = invPdfUrl(inv);
        return u ? '<a class="iba-ai-mini" href="' + esc(u) + '" target="_blank" rel="noopener" title="Open the invoice attachment"><i class="fa-regular fa-file-pdf"></i> INV</a>' : '';
    }
    // on: true = mark (Admins, Super Admin), false = remove (Super Admin only)
    async function setUrgent(list, on, remind, reason) {
        if (!on && !isSuper()) throw new Error('Only the Super Admin can remove urgent.');
        if (on && !isAdminUser()) throw new Error('Only Admins can mark urgent.');
        const idb = (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) ? invoiceDb : null;
        if (!idb) throw new Error('The invoice database is not available on this page.');
        const TS = firebase.database.ServerValue.TIMESTAMP;
        const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        const done = [], skipped = [];
        await Promise.all(list.map(async (x) => {
            try {
                const ref = idb.ref('invoice_entries/' + x.po + '/' + x.key);
                const inv = (await ref.once('value')).val();
                if (!inv || !APPROVAL_RX.test(String(inv.status || '').trim())) { skipped.push(Object.assign({ why: inv ? 'now ' + inv.status : 'not found' }, x)); return; }
                const old = String(inv.note || '');
                if (on === isUrgentNote(old)) { done.push(Object.assign({ inv: inv }, x)); return; }
                let upd;
                if (on) {
                    // "URGENT - reason · old note"; the old note is kept to put back on Remove
                    const note = 'URGENT' + (why ? ' - ' + why : '') + (old.trim() ? ' · ' + old.trim() : '');
                    upd = { note: note, urgentPrevNote: old, urgentReason: why || null, urgentBy: myName(), urgentAt: TS, lastUpdated: TS };
                } else {
                    const back = typeof inv.urgentPrevNote === 'string' ? inv.urgentPrevNote : stripUrgent(old);
                    upd = { note: back, urgentPrevNote: null, urgentReason: null, urgentBy: null, urgentAt: null, lastUpdated: TS };
                }
                await Promise.all([
                    ref.update(upd),
                    ref.child('history').push({ action: on ? 'Marked urgent' : 'Urgent removed', status: inv.status || '', by: myName(), timestamp: TS,
                        note: on ? 'Marked URGENT for ' + (inv.attention || 'the approver') + (why ? ': ' + why : '') : 'Back to normal' })
                ]);
                const nv = Object.assign({}, inv, { note: upd.note });
                try { if (typeof updateInvoiceTaskLookup === 'function') await updateInvoiceTaskLookup(x.po, x.key, nv, inv.attention); } catch (e) { console.warn('urgent: task list', e); }
                done.push(Object.assign({ inv: nv }, x));
            } catch (e) { skipped.push(Object.assign({ why: (e && e.message) || 'error' }, x)); }
        }));
        if (on && remind && done.length) {
            const d = mainDb(), by = {};
            done.forEach((x) => { const w = String(x.inv.attention || '').trim(); if (w) (by[w] = by[w] || []).push(x); });
            await Promise.all(Object.keys(by).map((w) => {
                const rows = by[w];
                const text = rows.length + ' invoice' + (rows.length === 1 ? '' : 's') + ' marked URGENT by ' + myName() + (why ? ' - ' + why : '') + ':\n' + rows.slice(0, 12).map((x) => '- PO ' + x.po + ' · ' + (x.inv.invNumber || x.inv.invEntryID || '') + ' · ' + x.inv.status).join('\n') + '\nPlease approve first.';
                const ref = d.ref('iba_assistant/reminders/' + remSafe(w)).push();
                return ref.set({ from: myName(), to: w, text: text, po: rows[0].po, at: TS }).catch(() => {});
            }));
        }
        return { done: done, skipped: skipped };
    }
    const DB_INDEX_CHECKS = [
        { db: 'main', path: 'workdesk_job_recent', field: 'updatedAt', why: 'Job Records changes (every open WorkDesk checks every 30 s)' },
        { db: 'main', path: 'job_entries', field: 'for', why: 'Invoice / IPC jobs (Invoice Entry, Dashboard)' },
        { db: 'main', path: 'job_entries', field: 'po', why: 'jobs of a PO (assistant)' },
        { db: 'main', path: 'job_entries', field: 'timestamp', why: 'jobs of a period (assistant)' },
        { db: 'inv', path: 'workdesk_dashboard_recent', field: 'updatedAt', why: 'invoice changes (Dashboard every 30 s, saved invoice copy)' },
        { db: 'inv', path: 'invoice_tasks_by_user/All', field: 'status', why: 'approval rows (Active Task, phone Approve, PO Close Out)' }
    ];
    async function dbIndexState(c) {
        const d = c.db === 'main' ? mainDb() : ((typeof invoiceDb !== 'undefined' && invoiceDb) ? invoiceDb : null);
        let base = '';
        try { base = String((d && d.app && d.app.options && d.app.options.databaseURL) || '').replace(/\/$/, ''); } catch (_) {}
        if (!base) return 'unknown';
        try {
            const res = await withTimeout(fetch(base + '/' + c.path + '.json?orderBy=' + encodeURIComponent('"' + c.field + '"') + '&limitToFirst=1', { cache: 'no-store' }), 8000, 'check');
            if (res.ok) return 'ok';
            let t = ''; try { t = await res.text(); } catch (_) {}
            if (res.status === 400 && /index/i.test(t)) return 'missing';
            return 'unknown';
        } catch (_) { return 'unknown'; }
    }
    async function dbCheckCard() {
        addUser('▶ Database check', true);
        const card = document.createElement('div');
        card.className = 'iba-ai-card';
        card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-database"></i> Database check</div><div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        put(card);
        const states = await Promise.all(DB_INDEX_CHECKS.map(dbIndexState));
        const missing = DB_INDEX_CHECKS.filter((c, i) => states[i] === 'missing');
        const dbName = (c) => c.db === 'main' ? 'ibainvoice-3ea51' : 'invoiceentry-b15a8';
        card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-database"></i> Database check · ' + (missing.length ? missing.length + ' index' + (missing.length === 1 ? '' : 'es') + ' missing' : 'all good') + '</div>' +
            '<ul class="iba-ai-rows">' + DB_INDEX_CHECKS.map((c, i) => '<li><span class="iba-ai-grow"><strong>' + (states[i] === 'ok' ? '✅' : states[i] === 'missing' ? '❌' : '❔') + ' ' + esc(dbName(c)) + ' · ' + esc(c.path) + ' by ' + esc(c.field) + '</strong><small>' + esc(c.why) + (states[i] === 'unknown' ? ' - could not check (offline or rules need sign-in)' : '') + '</small></span></li>').join('') + '</ul>' +
            (missing.length ? '<p class="iba-ai-foot">Missing indexes make Firebase send the whole list for every filtered read. In the Firebase console open each database > Realtime Database > Rules and add inside "rules":</p><pre class="iba-ai-pre" style="white-space:pre-wrap;font-size:11.5px;background:rgba(0,0,0,.25);padding:8px;border-radius:8px">' +
                esc(['ibainvoice-3ea51', 'invoiceentry-b15a8'].map((n) => { const m = missing.filter((c) => dbName(c) === n); if (!m.length) return ''; const by = {}; m.forEach((c) => { (by[c.path] = by[c.path] || []).push(c.field); }); return '// ' + n + '\n' + Object.keys(by).map((pth) => { const parts = pth.split('/'); let txt = '".indexOn": ' + JSON.stringify(by[pth]); for (let k = parts.length - 1; k >= 0; k--) txt = '"' + parts[k] + '": { ' + txt + ' }'; return txt; }).join(',\n'); }).filter(Boolean).join('\n\n')) + '</pre>' : '<p class="iba-ai-foot">Every filtered read downloads only what it needs.</p>');
    }
    async function handoverCard() {
        addUser('▶ Vacation hand-overs', true);
        const card = document.createElement('div');
        card.className = 'iba-ai-card';
        card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-people-arrows"></i> Vacation hand-overs</div><div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        put(card);
        const vh = window.ibaVacationHandover;
        if (!vh || typeof vh.log !== 'function') { card.innerHTML = '<div class="iba-ai-note is-error">The hand-over module is not loaded.</div>'; return; }
        let list = [];
        try { list = await vh.log(30); } catch (e) { card.innerHTML = '<div class="iba-ai-note is-error">' + esc((e && e.message) || e) + '</div>'; return; }
        let away = [];
        try { away = vh.away() || []; } catch (_) {}
        const when = (t) => t ? fmtDate(t) + ' ' + new Date(Number(t)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
        const paint = () => {
            card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-people-arrows"></i> Vacation hand-overs</div>' +
                '<div class="iba-ai-sub">On vacation now (tasks move to the replacement)</div>' +
                (away.length ? '<ul class="iba-ai-rows">' + away.map((a) => '<li><span class="iba-ai-grow"><strong>' + esc(a.name) + '</strong><small>' + esc(a.noReplacement ? 'No replacement set - tasks go to ' + a.target : 'Replacement: ' + a.target) + '</small></span></li>').join('') + '</ul>'
                    : '<p class="iba-ai-empty">Nobody. (People signed in during the last 12 hours are never treated as away, even if Vacation is still Yes in their profile.)</p>') +
                '<div class="iba-ai-sub">Recent hand-overs</div>' +
                (list.length ? '<ul class="iba-ai-rows">' + list.map((x, i) => '<li><span class="iba-ai-grow"><strong>' + esc(x.from) + ' → ' + esc(x.to) + ' · ' + esc(x.count) + ' task' + (x.count === 1 ? '' : 's') + '</strong><small>' +
                    esc([when(x.at), x.noReplacement ? 'no replacement set' : '', (x.items || []).slice(0, 4).map((m) => (m.po ? 'PO ' + m.po + ' ' : '') + (m.ref || '')).join(', ')].filter(Boolean).join(' · ')) + '</small></span>' +
                    '<button type="button" class="iba-ai-mini is-danger" data-ho-undo="' + i + '"><i class="fa-solid fa-rotate-left"></i> Undo</button></li>').join('') + '</ul>'
                    : '<p class="iba-ai-empty">No hand-overs so far.</p>') + '<p class="iba-ai-urg-msg"></p>';
        };
        paint();
        card.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-ho-undo]');
            if (!b) return;
            const x = list[Number(b.dataset.hoUndo)];
            b.disabled = true;
            const msg = card.querySelector('.iba-ai-urg-msg');
            if (msg) msg.textContent = 'Putting the tasks back to ' + x.from + '…';
            try {
                const r = await vh.undo(x.id);
                list = list.filter((y) => y !== x);
                paint();
                const m2 = card.querySelector('.iba-ai-urg-msg');
                if (m2) m2.textContent = r.back + ' task' + (r.back === 1 ? '' : 's') + ' back with ' + r.from + '.' + (r.left ? ' ' + r.left + ' left as they are (already moved on or finished).' : '');
            } catch (err) { b.disabled = false; if (msg) msg.textContent = 'Could not undo: ' + ((err && err.message) || err); }
        });
    }
    async function urgentCard() {
        addUser('▶ Mark urgent', true);
        const card = document.createElement('div');
        card.className = 'iba-ai-card iba-ai-urgent';
        card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-bolt"></i> Mark urgent · For Approval / CEO Approval</div><div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        put(card);
        let data;
        try {
            if (!window.ibaWeeklyReport || typeof window.ibaWeeklyReport.loadInvoices !== 'function') throw new Error('The invoice list is not available on this page.');
            data = (await window.ibaWeeklyReport.loadInvoices(false)).data || {};
        } catch (e) { card.innerHTML = '<div class="iba-ai-note is-error">' + esc((e && e.message) || e) + '</div>'; return; }
        const pm = poMap();
        const rows = [];
        Object.keys(data).forEach((po) => {
            const m = data[po] || {};
            if (typeof m !== 'object') return;
            Object.keys(m).forEach((k) => {
                const inv = m[k];
                if (!inv || !APPROVAL_RX.test(String(inv.status || '').trim())) return;
                const at = Number(inv.statusChangedAt) || Number(inv.lastUpdated) || Number(inv.createdAt) || 0;
                const rec = pm[String(po).toUpperCase()] || {};
                rows.push({ po: po, key: k, no: inv.invNumber || inv.invEntryID || '', vendor: inv.vendorName || rec['Supplier Name'] || '', value: Number(String(inv.invValue || 0).replace(/,/g, '')) || 0,
                    status: String(inv.status).trim(), with: inv.attention || '', days: at ? daysSince(at) : null, note: String(inv.note || ''), urgent: isUrgentNote(inv.note), pdf: invPdfUrl(inv), srv: srvPdfUrl(inv), reason: inv.urgentReason || '', by: inv.urgentBy || '' });
            });
        });
        const order = () => rows.sort((a, b) => (b.days || 0) - (a.days || 0));
        order();
        let filter = 'all';
        const sup = isSuper();
        const pdf = (r) => (r.pdf ? '<a class="iba-ai-mini" href="' + esc(r.pdf) + '" target="_blank" rel="noopener" title="Open the invoice attachment"><i class="fa-regular fa-file-pdf"></i> INV</a>' : '') + srvLink(r.srv);
        const line = (r) => '<span class="iba-ai-grow"><strong>PO ' + esc(r.po) + ' · ' + esc(r.no) + '</strong><small>' + esc([r.vendor, r.status, r.with ? 'with ' + r.with : '', r.days != null ? r.days + ' day' + (r.days === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')) + '</small>' +
            (r.note ? '<small class="iba-ai-urg-note">' + esc(r.note.slice(0, 140)) + '</small>' : '') + '</span>' + (r.value ? '<span class="iba-ai-trk-val">' + esc(money(r.value)) + '</span>' : '');
        const paint = () => {
            const inF = (r) => filter === 'all' || norm(r.status) === filter;
            const normal = rows.filter((r) => !r.urgent && inF(r)), urg = rows.filter((r) => r.urgent && inF(r));
            const cnt = (st) => rows.filter((r) => !r.urgent && norm(r.status) === st).length;
            const openNow = card.querySelector('details.iba-ai-urg-done') && card.querySelector('details.iba-ai-urg-done').open;
            card.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-bolt"></i> Mark urgent · ' + rows.filter((r) => !r.urgent).length + ' waiting for approval</div>' +
                '<div class="iba-ai-chiprow">' + [['all', 'All', rows.filter((r) => !r.urgent).length], ['for approval', 'For Approval (COO)', cnt('for approval')], ['ceo approval', 'CEO Approval', cnt('ceo approval')]].map((c) =>
                    '<button type="button" class="iba-ai-chip' + (filter === c[0] ? ' is-on' : '') + '" data-urg-filter="' + c[0] + '">' + esc(c[1]) + ' <b>' + c[2] + '</b></button>').join('') + '</div>' +
                (normal.length ? '<ul class="iba-ai-urg-list">' + normal.map((r) => '<li><input type="checkbox" data-urg-i="' + rows.indexOf(r) + '" aria-label="Select">' + line(r) + pdf(r) + '</li>').join('') + '</ul>'
                    : '<p class="iba-ai-empty">Nothing else is waiting in ' + (filter === 'all' ? 'For Approval or CEO Approval' : esc(filter)) + '.</p>') +
                (normal.length ? '<div class="iba-ai-urg-acts"><label class="iba-ai-urg-all"><input type="checkbox" data-urg-all> Select all shown</label>' +
                    '<label class="iba-ai-urg-reason"><span>Reason (optional) - the approver sees it in the note</span><input type="text" maxlength="200" data-urg-reason placeholder="e.g. Supplier needs this payment to pay another supplier"></label>' +
                    '<label class="iba-ai-urg-all"><input type="checkbox" data-urg-remind> Also send the approver a reminder</label>' +
                    '<button type="button" class="iba-ai-mini is-main is-danger" data-urg-go><i class="fa-solid fa-bolt"></i> Mark urgent</button><span class="iba-ai-urg-msg"></span></div>' : '') +
                (urg.length ? '<details class="iba-ai-urg-done"' + (openNow ? ' open' : '') + '><summary><span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span> Already urgent <b>' + urg.length + '</b></summary><ul class="iba-ai-urg-list">' +
                    urg.map((r) => '<li class="is-urgent">' + line(r) + pdf(r) + (sup ? '<button type="button" class="iba-ai-mini" data-urg-off="' + rows.indexOf(r) + '" title="Back to normal (Super Admin)">Remove</button>' : '') + '</li>').join('') + '</ul></details>' : '');
        };
        paint();
        card.addEventListener('click', async (e) => {
            const b = e.target.closest('button, input[data-urg-all]');
            if (!b) return;
            if (b.dataset.urgFilter) { filter = b.dataset.urgFilter; paint(); return; }
            if (b.hasAttribute('data-urg-all')) { card.querySelectorAll('input[data-urg-i]').forEach((x) => { x.checked = b.checked; }); return; }
            const msg = () => card.querySelector('.iba-ai-urg-msg');
            if (b.dataset.urgOff !== undefined) {
                const r = rows[Number(b.dataset.urgOff)];
                b.disabled = true;
                try { const out = await setUrgent([r], false, false); if (out.done.length) { r.urgent = false; r.note = String(out.done[0].inv.note || ''); } paint(); } catch (err) { b.disabled = false; }
                return;
            }
            if (b.hasAttribute('data-urg-go')) {
                const pick = Array.from(card.querySelectorAll('input[data-urg-i]:checked')).map((x) => rows[Number(x.dataset.urgI)]);
                if (!pick.length) { if (msg()) msg().textContent = 'Tick at least one invoice.'; return; }
                const remind = !!(card.querySelector('input[data-urg-remind]') || {}).checked;
                const reason = String((card.querySelector('input[data-urg-reason]') || {}).value || '');
                b.disabled = true; if (msg()) msg().textContent = 'Marking ' + pick.length + '…';
                try {
                    const out = await setUrgent(pick, true, remind, reason);
                    out.done.forEach((x) => { const r = rows.find((y) => y.po === x.po && y.key === x.key); if (r) { r.urgent = true; r.note = String(x.inv.note || ''); } });
                    paint();
                    const m = msg();
                    const text = out.done.length + ' marked urgent' + (remind ? ' and the approver reminded' : '') + '.' + (out.skipped.length ? ' ' + out.skipped.length + ' skipped (status changed).' : '');
                    if (m) m.textContent = text; else card.insertAdjacentHTML('beforeend', '<p class="iba-ai-urg-msg">' + esc(text) + '</p>');
                } catch (err) { b.disabled = false; if (msg()) msg().textContent = 'Could not mark: ' + ((err && err.message) || err); }
            }
        });
        // 15.0.0 patch 44: a working list - it opens in the big window
        if (!onPhone()) openWide(card);
    }
    function skillUseKey() { return 'iba-ai-skill-use-v1:' + userSlug(); }
    function bumpSkillUse(id) { const u = lsGet(skillUseKey(), {}) || {}; u[id] = (Number(u[id]) || 0) + 1; lsSet(skillUseKey(), u); }
    // 15.0.0 patch 50: PO list boxes - a ", " is added after each 5-digit PO
    // so POs can be typed one after another; a pasted list is tidied too
    function tidyPOList(v) { return String(v || '').split(/[\s,;]+/).filter(Boolean).join(', '); }
    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!el || !el.matches || !el.matches('input[data-po-list]')) return;
        if (e.inputType === 'insertFromPaste') { el.value = tidyPOList(el.value) + (el.value.trim() ? ', ' : ''); return; }
        if (e.inputType && e.inputType.indexOf('delete') === 0) return;
        if (el.selectionStart !== el.value.length) return; // typing in the middle: leave it
        if (/(^|[\s,;])\d{5}$/.test(el.value)) el.value = el.value + ', ';
    }, true);
    async function runTemplate(id, title) {
        if (!tplAllowed(id)) { showView('chat'); addNote('This skill is for the Super Admin only.'); return; }
        if (state.busy) return;
        bumpSkillUse(id);
        const t = SKILL_TPL[id];
        const name = title || t.name;
        if (t.action) { toggle(false); t.action(); return; }
        showView('chat');
        const fields = t.ask();
        let vals = {};
        if (fields.length) {
            vals = await askTplValues(name, fields);
            if (!vals) return;
            addUser('▶ ' + name + ': ' + fields.map((p) => {
                const v = vals[p.key];
                if (p.type === 'select') { const o = p.options.find((x) => x[0] === v); return o ? o[1] : v; }
                return v;
            }).join(' · '), true);
        } else addUser('▶ ' + name, true);
        state.busy = true;
        setBusy(true);
        try {
            if (t.run) {
                try { const msg = await t.run(vals); return msg ? addBot(msg, {}) : null; }
                catch (err) { return addError(err); }
            }
            for (const step of t.build(vals)) {
                const out = await runTool(step.tool, step.args);
                if (out.card) addCard(out.card);
                else if (out.result && out.result.error) addError(new Error(out.result.error));
            }
            return addBot('Done — "' + name + '" ran without the AI (no quota used).', {});
        } finally {
            state.busy = false;
            setBusy(false);
        }
    }
    function addTplSkill(name, id) {
        const clean = String(name || '').trim().slice(0, 60);
        if (!clean || !tplAllowed(id)) return false;
        const list = skills().filter((s) => norm(s.name) !== norm(clean));
        list.unshift({ name: clean, tpl: id, prompt: SKILL_TPL[id].desc, steps: [], at: Date.now() });
        saveSkills(list.slice(0, 40));
        return true;
    }

    async function runSkill(name) {
        let sk = skills().find((s) => norm(s.name) === norm(name));
        if (!sk || state.busy) return;
        if (sk.tpl) return runTemplate(sk.tpl, sk.name);
        showView('chat');
        const params = skillParams(sk);
        if (params.length) {
            const vals = await askSkillValues(sk, params);
            if (!vals) return;
            sk = skillWithValues(sk, vals);
            addUser('▶ ' + sk.name + ': ' + vals.map((v) => v.value).join(', '), true);
        } else {
            addUser('▶ ' + sk.name, true);
        }
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
        paintFab(fab);
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
              '<button type="button" class="iba-ai-icon iba-aph-only" data-ai="phone" title="Search"><i class="fa-solid fa-house"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="brief" title="Today\'s brief: tasks and reminders (no key needed)"><i class="fa-solid fa-sun"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="track" title="Track an invoice"><i class="fa-solid fa-route"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="skills" title="Skills"><i class="fa-solid fa-bolt"></i></button>' +
              '<button type="button" class="iba-ai-icon iba-ai-head-expand" data-ai="expand" title="Expand: open the latest card in the big window (again to go back)"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="setup" title="Setup"><i class="fa-solid fa-gear"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="new" title="New chat"><i class="fa-solid fa-rotate-left"></i></button>' +
              '<button type="button" class="iba-ai-icon" data-ai="close" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>' +
            '</header>' +
            '<div class="iba-ai-view" data-view="chat"><div class="iba-ai-log" id="iba-ai-log" aria-live="polite"></div></div>' +
            '<div class="iba-ai-view" data-view="skills" hidden><div class="iba-ai-pane" id="iba-ai-skills"></div></div>' +
            // 15.0.0 patch 44: the big window - one result moved here to read and work on
            '<div class="iba-ai-view iba-ai-wide-view" data-view="wide" hidden>' +
              '<div class="iba-ai-wide-bar" title="Drag to move · double-click to put it back in place"><i class="fa-solid fa-grip-vertical iba-ai-wide-handle" aria-hidden="true"></i><span class="iba-ai-wide-title" id="iba-ai-wide-title"></span>' +
                '<button type="button" class="iba-ai-mini" data-wide-close title="Back to the side panel (Esc)"><i class="fa-solid fa-down-left-and-up-right-to-center"></i> Back to side panel</button></div>' +
              '<div class="iba-ai-pane iba-ai-wide-body" id="iba-ai-wide-body"></div>' +
              '<span class="iba-ai-wide-grip" data-wide-grip title="Drag to resize" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="iba-ai-view" data-view="setup" hidden><div class="iba-ai-pane" id="iba-ai-setup"></div></div>' +
            '<div class="iba-ai-view" data-view="track" hidden><div class="iba-ai-pane" id="iba-ai-track">' +
              '<h3><i class="fa-solid fa-route"></i> Track</h3>' +
              '<p class="iba-ai-help" id="iba-ai-track-help"></p>' +
              '<form class="iba-ai-track-form" id="iba-ai-track-form" autocomplete="off">' +
                '<div class="iba-ai-seg" id="iba-ai-track-kind" role="radiogroup" aria-label="What to track">' +
                  '<button type="button" role="radio" data-kind="inv"><i class="fa-solid fa-file-invoice"></i><span>Invoices</span><small>PO · Vendor</small></button>' +
                  '<button type="button" role="radio" data-kind="trf"><i class="fa-solid fa-boxes-stacked"></i><span>Inventory</span><small>Transfer · Usage · Stock</small></button>' +
                '</div>' +
                '<input id="iba-ai-track-q" type="text" placeholder="PO, vendor or TRF-0361"/>' +
                '<input id="iba-ai-track-site" type="text" inputmode="numeric" placeholder="Site"/>' +
                '<input id="iba-ai-track-year" type="text" inputmode="numeric" placeholder="Year"/>' +
                '<button type="submit" class="iba-ai-btn is-main"><i class="fa-solid fa-magnifying-glass"></i> Track</button>' +
              '</form>' +
              // 15.0.0 patch 11: recent status changes (no AI needed)
              '<details class="iba-ai-recent" id="iba-ai-recent">' +
                '<summary><i class="fa-solid fa-clock-rotate-left"></i> Recent status changes <small>to Batch Entry</small></summary>' +
                '<div class="iba-ai-recent-body">' +
                  '<select id="iba-ai-recent-status" aria-label="Status"></select>' +
                  '<div class="iba-ai-recent-when" role="radiogroup" aria-label="When">' +
                    '<button type="button" data-recent-when="2h" class="is-on">Last 2 h</button>' +
                    '<button type="button" data-recent-when="morning">This morning</button>' +
                    '<button type="button" data-recent-when="afternoon">This afternoon</button>' +
                    '<button type="button" data-recent-when="today">Today</button>' +
                    '<button type="button" data-recent-when="yesterday">Yesterday</button>' +
                  '</div>' +
                  '<label class="iba-ai-recent-mine"><input type="checkbox" id="iba-ai-recent-mine" checked/> Only changes I made</label>' +
                  '<button type="button" class="iba-ai-btn is-main" data-recent-go><i class="fa-solid fa-layer-group"></i> <span>Find</span></button>' +
                '</div>' +
              '</details>' +
              '<div class="iba-ai-track-out" id="iba-ai-track-out"></div>' +
            '</div></div>' +
            // 15.0.0 patch 25: the phone home - search, track, remind, message
            '<div class="iba-ai-view iba-ai-phone" data-view="phone" hidden><div class="iba-ai-pane">' +
              '<div class="iba-aph-hero"><span class="iba-aph-bot">' + BOT_SVG + '</span><div class="iba-aph-hi"><strong id="iba-aph-hello">Hello</strong><small>Search · Track · Remind · Message</small></div></div>' +
              // 17.0.0 patch 5: Now brief on the phone
              '<button type="button" class="iba-aph-brief" data-aph-brief><i class="fa-solid fa-sun"></i><span><b>Now brief</b><small id="iba-aph-brief-n">Your tasks, urgent first</small></span><i class="fa-solid fa-chevron-right"></i></button>' +
              '<form class="iba-aph-search" id="iba-aph-form" autocomplete="off"><i class="fa-solid fa-magnifying-glass"></i>' +
                '<input id="iba-aph-q" type="search" enterkeyhint="search" placeholder="PO, vendor, transfer no. or a name"/>' +
                '<button type="submit" class="iba-aph-go" aria-label="Search"><i class="fa-solid fa-arrow-right"></i></button></form>' +
              '<div class="iba-aph-tiles" role="radiogroup" aria-label="What to look for">' +
                '<button type="button" data-aph-mode="inv" style="--c:#2a78d6"><i class="fa-solid fa-file-invoice"></i><b>Invoice</b><small>PO or vendor: received, QS, entry, paid</small></button>' +
                '<button type="button" data-aph-mode="trf" style="--c:#14a37f"><i class="fa-solid fa-truck-ramp-box"></i><b>Inventory</b><small>Transfer, vehicle, item</small></button>' +
                '<button type="button" data-aph-mode="person" style="--c:#eb6834"><i class="fa-solid fa-id-badge"></i><b>Colleague</b><small>Message, call, WhatsApp</small></button>' +
              '</div>' +
              '<div class="iba-aph-rem" id="iba-aph-rem"></div>' +
              '<div class="iba-ai-track-out iba-aph-out" id="iba-aph-out"></div>' +
              '<p class="iba-aph-foot"><i class="fa-solid fa-bell"></i> Every invoice or transfer you find has a <b>Remind</b> button. The full assistant is on the computer.' +
                ' <button type="button" class="iba-ai-mini" data-aph-chat data-needs-ai><i class="fa-solid fa-comments"></i> Ask in words</button></p>' +
            '</div></div>' +
            '<div class="iba-ai-chips" id="iba-ai-chips">' +
              '<button type="button" data-ai="brief"><i class="fa-solid fa-sun"></i> Today\'s brief</button>' +
              '<button type="button" data-view-go="track"><i class="fa-solid fa-route"></i> Track invoice</button>' +
              '<button type="button" data-chip-fill="Show PO " data-super-only><i class="fa-solid fa-magnifying-glass"></i> Find PO</button>' +
              '<button type="button" data-chip-fill="New invoice for PO " data-super-only><i class="fa-solid fa-file-circle-plus"></i> New invoice</button>' +
              '<button type="button" data-chip-fill="Draft a reminder to " data-needs-ai><i class="fa-solid fa-pen-nib"></i> Draft a message</button>' +
              // 17.0.0 patch 21: more skills one click away (hidden when the user may not run them)
              '<button type="button" data-run-tpl="po_report" data-tpl-chip><i class="fa-solid fa-file-invoice-dollar"></i> PO report</button>' +
              '<button type="button" data-run-tpl="approvals_list" data-tpl-chip><i class="fa-solid fa-stamp"></i> Approvals waiting</button>' +
              '<button type="button" data-run-tpl="person" data-tpl-chip><i class="fa-solid fa-id-badge"></i> Find colleague</button>' +
              '<button type="button" data-run-tpl="transfer" data-tpl-chip><i class="fa-solid fa-truck-ramp-box"></i> Find transfer</button>' +
              '<button type="button" data-run-tpl="new_job" data-tpl-chip><i class="fa-solid fa-file-circle-plus"></i> Add new job</button>' +
              '<button type="button" data-chip-basket><i class="fa-solid fa-cart-shopping"></i> Print basket</button>' +
              '<button type="button" data-run-tpl="access_check" data-tpl-chip><i class="fa-solid fa-user-shield"></i> Access check</button>' +
            '</div>' +
            '<form class="iba-ai-input" id="iba-ai-form" autocomplete="off">' +
              '<textarea id="iba-ai-text" rows="1" placeholder="Ask, or tell me what to do…"></textarea>' +
              (SR ? '<button type="button" id="iba-ai-mic" title="Speak your question (Chrome / Edge)"><i class="fa-solid fa-microphone"></i></button>' : '') +
              '<button type="submit" id="iba-ai-send" title="Send (Enter)"><i class="fa-solid fa-paper-plane"></i></button>' +
            '</form>';
        document.body.appendChild(panel);

        fab.addEventListener('click', () => toggle(true));
        panel.addEventListener('click', onPanelClick);
        bindWideMove(panel);
        // 15.0.0 patch 44: every result card gets a "big window" button
        let decoFrame = 0;
        new MutationObserver(() => { if (!decoFrame) decoFrame = requestAnimationFrame(() => { decoFrame = 0; decorateCards(); }); }).observe(panel, { childList: true, subtree: true });
        $('iba-ai-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const t = $('iba-ai-text');
            if (state.busy || !t.value.trim()) return; // keep the text until the last answer is in
            const v = t.value;
            t.value = '';
            autoSize(t);
            ask(v);
        });
        $('iba-ai-track-kind').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-kind]');
            if (!btn) return;
            setTrackKind(btn.dataset.kind, true);
            $('iba-ai-track-q').focus();
        });
        setTrackKind(lsGet(TRACK_KIND_KEY, 'inv'), false);
        $('iba-ai-track-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const q = String($('iba-ai-track-q').value || '').trim();
            if (looksTransfer(q)) { setTrackKind('trf', false); runTransferTrack(q, $('iba-ai-track-out')); return; }
            if (trackKind() === 'trf') { runTransferFind({ text: q, site: $('iba-ai-track-site').value }, $('iba-ai-track-out')); return; }
            const looksPO = /\d/.test(q) && /^\s*(po[\s#:-]*)?[a-z0-9_-]+\s*$/i.test(q);
            runTrack({ po: looksPO ? q : '', vendor: looksPO ? '' : q, site: $('iba-ai-track-site').value, year: $('iba-ai-track-year').value }, $('iba-ai-track-out'));
        });
        $('iba-aph-form').addEventListener('submit', (e) => { e.preventDefault(); const q = $('iba-aph-q'); phoneSearch(q.value); q.blur(); });
        const ta = $('iba-ai-text');
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('iba-ai-form').requestSubmit ? $('iba-ai-form').requestSubmit() : $('iba-ai-form').dispatchEvent(new Event('submit', { cancelable: true })); }
        });
        ta.addEventListener('input', () => autoSize(ta));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !panel.hidden && !document.querySelector('.modal-overlay:not(.hidden) .modal-container:focus-within')) { if (wide) closeWide(); else toggle(false); }
        });
        bubble.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.bubble === 'open') {
                hideBubble();
                toggle(true);
                if (b.dataset.then === 'brief') openBrief();
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
        if (!open && wide) closeWide();
        p.hidden = !open;
        $('iba-ai-fab').classList.toggle('is-open', !!open);
        if (open) {
            hideBubble();
            hideTip();
            $('iba-ai-brain').textContent = ready() ? brainLabel() : 'Not set up yet';
            syncSkillsDown();
            document.querySelectorAll('#iba-ai-panel [data-super-only]').forEach((el) => { el.hidden = !isSuper(); });
            document.querySelectorAll('#iba-ai-panel [data-needs-ai]').forEach((el) => { el.hidden = !ready(); });
            document.querySelectorAll('#iba-ai-panel [data-tpl-chip]').forEach((el) => { el.hidden = !tplAllowed(el.dataset.runTpl); });
            document.querySelectorAll('#iba-ai-panel [data-chip-basket]').forEach((el) => { el.hidden = !(window.ibaPrintBasket && window.ibaPrintBasket.allowed()); });
            // 15.0.0 patch 10: without a key the panel opens on today's brief
            // (tasks + reminders), which needs no AI. Super Admin still gets Setup.
            if (onPhone()) {
                if (state.view !== 'setup' && !(state.view === 'chat' && state.phoneChat)) showView('phone');
                paintPhone();
            } else if (state.view === 'phone') showView('chat');
            if (!onPhone() && !ready() && state.view === 'chat' && !$('iba-ai-log').querySelector('.is-user')) {
                if (isSuper()) showView('setup');
                else if (!$('iba-ai-log').querySelector('.iba-ai-card.is-brief')) setTimeout(openBrief, 0);
            }
            setTimeout(() => { const t = $('iba-ai-text'); if (t && state.view === 'chat') t.focus(); }, 30);
        }
    }

    function showView(v) {
        if (v !== 'wide' && wide) restoreWide();
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
        if (b.hasAttribute('data-wide-open')) { e.preventDefault(); return openWide(b.closest('.iba-ai-card')); }
        if (b.hasAttribute('data-wide-close')) { e.preventDefault(); return closeWide(); }
        if (b.hasAttribute('data-brief-apv-print')) {
            const card = b.closest('.iba-ai-card');
            const data = card && briefStore.get(card.getAttribute('data-brief-id'));
            if (data && data.approvals) printApprovalList(data.approvals.items, 'with');
            return;
        }
        if (b.hasAttribute('data-co-toggle')) {
            const tile = b.closest('.iba-ai-co-tile');
            const list = tile && tile.querySelector('[data-co-list]');
            if (list) {
                list.hidden = !list.hidden;
                b.setAttribute('aria-expanded', list.hidden ? 'false' : 'true');
                b.innerHTML = list.hidden ? '<i class="fa-solid fa-chevron-down"></i> Show list' : '<i class="fa-solid fa-chevron-up"></i> Hide list';
            }
            return;
        }
        const inWide = !!b.closest('#iba-ai-wide-body');
        if (act === 'close') return toggle(false);
        if (act === 'new') { if (wide) closeWide(); state.history = []; state.lastTurn = null; $('iba-ai-log').innerHTML = ''; greetIfEmpty(true); return showView('chat'); }
        if (act === 'brief') return openBrief();
        if (b.hasAttribute('data-chip-basket')) { if (window.ibaPrintBasket) window.ibaPrintBasket.open(); return; }
        if (b.dataset.runTpl) { if (b.hasAttribute('data-tpl-chip')) showView('chat'); return runTemplate(b.dataset.runTpl); }
        if (b.dataset.urgConfirm !== undefined) {
            // 15.0.0 patch 38: the small reason box under "Mark urgent" on a tracking result
            e.preventDefault();
            const box = b.closest('.iba-ai-urg-mini');
            const btn = box && box.__btn;
            if (!box || !btn) return;
            if (b.dataset.urgConfirm === 'no') { box.remove(); return; }
            const reason = String((box.querySelector('input') || {}).value || '');
            box.remove();
            btn.dataset.urgReason = reason;
            btn.dataset.urgGo = '1';
            btn.click();
            return;
        }
        if (b.dataset.urgPo) {
            // 15.0.0 patch 37/38: Mark urgent (with an optional reason) / Remove urgent (Super Admin)
            e.preventDefault();
            const on = b.dataset.urgOn === '1';
            if (on && b.dataset.urgGo !== '1') {
                const holder = b.closest('.iba-ai-trk-item');
                if (!holder || holder.querySelector('.iba-ai-urg-mini')) return;
                const box = document.createElement('div');
                box.className = 'iba-ai-urg-mini';
                box.innerHTML = '<input type="text" maxlength="200" placeholder="Reason (optional), e.g. supplier needs the payment">' +
                    '<button type="button" class="iba-ai-mini is-main is-danger" data-urg-confirm="yes"><i class="fa-solid fa-bolt"></i> Mark urgent</button>' +
                    '<button type="button" class="iba-ai-mini iba-ai-cancel" data-urg-confirm="no"><i class="fa-solid fa-xmark"></i> Cancel</button>';
                box.__btn = b;
                holder.appendChild(box);
                box.querySelector('input').focus();
                box.querySelector('input').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); box.querySelector('[data-urg-confirm="yes"]').click(); } if (ev.key === 'Escape') box.remove(); });
                return;
            }
            const reason = b.dataset.urgReason || '';
            delete b.dataset.urgGo; delete b.dataset.urgReason;
            b.disabled = true;
            setUrgent([{ po: b.dataset.urgPo, key: b.dataset.urgKey }], on, false, reason).then((out) => {
                b.disabled = false;
                if (!out.done.length) { b.textContent = 'Status changed - not marked'; return; }
                b.dataset.urgOn = on ? '0' : '1';
                b.classList.toggle('is-danger', !on);
                b.innerHTML = '<i class="fa-solid fa-bolt"></i> ' + (on ? 'Remove urgent' : 'Mark urgent');
                const strong = b.closest('.iba-ai-trk-item') && b.closest('.iba-ai-trk-item').querySelector('.iba-ai-trk-top strong');
                if (strong) { const old = strong.querySelector('.iba-ai-urg-badge'); if (on && !old) strong.insertAdjacentHTML('beforeend', ' <span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span>'); if (!on && old) old.remove(); }
                if (on && !isSuper()) b.remove(); // only the Super Admin can take it back
            }).catch((err) => { b.disabled = false; b.title = (err && err.message) || ''; });
            return;
        }
        if (b.dataset.dmKey && ((me() || {}).key && String(b.dataset.dmKey) === String(me().key))) return;
        if (b.dataset.dmKey) {
            try {
                if (onPhone()) toggle(false); // the message window opens on the phone screen
                if (typeof dmState !== 'undefined' && dmState && !dmState.initialized && typeof initDirectMessages === 'function') initDirectMessages();
                if (typeof dmOpenThread === 'function') dmOpenThread(b.dataset.dmKey, b.dataset.dmName || '');
                else if (typeof dmOpen === 'function') dmOpen();
            } catch (_) {}
            return;
        }
        if (b.dataset.recentWhen) {
            b.parentNode.querySelectorAll('[data-recent-when]').forEach((x) => x.classList.toggle('is-on', x === b));
            return;
        }
        if (b.hasAttribute('data-recent-go')) return runRecent();
        if (b.hasAttribute('data-brief-say')) {
            const card = b.closest('.iba-ai-card');
            const data = card && briefStore.get(card.getAttribute('data-brief-id'));
            if (data) { if (talking) stopSpeak(); else speak(briefSpeech(data)); }
            return;
        }
        if (b.hasAttribute('data-say')) {
            const msg = b.closest('.iba-ai-msg');
            const t = msg && msg.querySelector('.iba-ai-text');
            if (t) { if (talking) stopSpeak(); else speak(t.innerText); }
            return;
        }
        if (b.id === 'iba-ai-mic') return listen(b);
        if (b.dataset.taskAct) return taskAct(b);
        if (b.hasAttribute('data-aph-brief')) return phoneBrief();
        if (b.dataset.aphPo) { const q = $('iba-aph-q'); if (q) q.value = b.dataset.aphPo; return phoneSearch(b.dataset.aphPo); }
        if (b.dataset.openTask) { let q = {}; try { q = JSON.parse(b.dataset.openTask); } catch (_) {} return openTaskPage(q); }
        if (b.dataset.openJob) return openJobPage(b.dataset.openJob);
        if (b.hasAttribute('data-brief-print')) {
            const card = b.closest('.iba-ai-card');
            const data = card && briefStore.get(card.getAttribute('data-brief-id'));
            if (data) printBrief(data);
            return;
        }
        if (b.dataset.briefMore) {
            const card = b.closest('.iba-ai-card');
            const ul = card && card.querySelector('[data-brief-list="' + b.dataset.briefMore + '"]');
            if (ul) ul.querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; });
            b.remove();
            return;
        }
        if (act === 'phone') { state.phoneChat = false; showView('phone'); return paintPhone(); }
        if (b.dataset.aphMode) return setPhoneMode(b.dataset.aphMode, true);
        if (b.hasAttribute('data-aph-chat')) { state.phoneChat = true; return showView('chat'); }
        // 17.0.0 patch 18: Expand in the header: the newest card in the big window, or back
        if (act === 'expand') {
            if (wide) return restoreWide();
            const cards = Array.from(document.querySelectorAll('#iba-ai-log .iba-ai-card')).filter((c) => !c.classList.contains('is-action') && !c.closest('.iba-ai-skill-ask'));
            if (!cards.length) { addNote('Nothing to expand yet. Open Today\'s brief (the sun) or ask something first.'); return; }
            if (state.view !== 'chat') showView('chat');
            return openWide(cards[cards.length - 1]);
        }
        if (act === 'skills' || act === 'setup' || act === 'track') return showView(state.view === act ? (onPhone() ? 'phone' : 'chat') : act);
        if (b.dataset.viewGo) return showView(b.dataset.viewGo);
        if (b.dataset.track) {
            let q = {};
            try { q = JSON.parse(b.dataset.track); } catch (_) {}
            const out = b.closest('#iba-ai-track-out') ? $('iba-ai-track-out') : (inWide ? wideMore() : null);
            return runTrack(q, out);
        }
        if (b.dataset.rep) return onReport(b);
        if (b.dataset.trf && inWide) return runTransferTrack(b.dataset.trf, wideMore());
        if (b.dataset.trf) {
            const host = b.closest('#iba-ai-track-out');
            if (host) {
                let box = $('iba-ai-trf-detail');
                if (!box) { box = document.createElement('div'); box.id = 'iba-ai-trf-detail'; host.appendChild(box); }
                runTransferTrack(b.dataset.trf, box).then(() => { try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} });
                return;
            }
            showView('chat');
            return runTransferTrack(b.dataset.trf);
        }
        if (b.dataset.trfFind) {
            let q = {};
            try { q = JSON.parse(b.dataset.trfFind); } catch (_) {}
            const host = b.closest('#iba-ai-track-out') ? $('iba-ai-track-out') : (inWide ? wideMore() : null);
            return runTransferFind(q, host);
        }
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
        // 15.0.0 patch 9: a PO in a list shows where its invoices are (with
        // "Open in Invoice Records"); before it tried to open Invoice Entry.
        if (b.dataset.aiPo && inWide) { e.preventDefault(); return runTrack({ po: b.dataset.aiPo }, wideMore()); }
        if (b.dataset.aiPo) { e.preventDefault(); showView('chat'); return runTrack({ po: b.dataset.aiPo }); }
        if (b.dataset.aiRecords) { e.preventDefault(); if (wide) closeWide(); return openInRecords(b.dataset.aiRecords); }
        if (b.hasAttribute('data-rem-all')) {
            e.preventDefault();
            const card = b.closest('.iba-ai-card');
            const ids = remList.filter((x) => !x.seenAt).map((x) => x.id);
            if (card) card.querySelectorAll('.iba-ai-remlist li:not(.iba-ai-ttab-head)').forEach((li) => li.remove());
            b.remove();
            ids.forEach((id) => { remMarkSeen(id); });
            return;
        }
        if (b.dataset.remSeen) { e.preventDefault(); const li = b.closest('li'); if (li) li.remove(); return remMarkSeen(b.dataset.remSeen); }
        if (b.dataset.aiRemind) { e.preventDefault(); let q = {}; try { q = JSON.parse(b.dataset.aiRemind); } catch (_) {} return openRemind(q, b); }
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

    // ------------------------------------------------------------------
    // 15.0.0 patch 44: the big window. The side panel grows into a large
    // window in the middle of the screen and shows one result card (the
    // brief, a tracking result, Mark urgent, ...). The card itself is moved,
    // so its buttons keep working; "Back to side panel" (or Esc) puts it back
    // where it was. A PO or transfer opened from inside shows below it.
    // ------------------------------------------------------------------
    let wide = null;
    function decorateCards() {
        if (onPhone()) return;
        document.querySelectorAll('#iba-ai-panel .iba-ai-card').forEach((card) => {
            if (card.closest('#iba-ai-wide-body') || card.classList.contains('is-action') || card.closest('.iba-ai-skill-ask')) return;
            const head = card.querySelector(':scope > .iba-ai-card-head');
            if (!head || head.querySelector('[data-wide-open]')) return;
            const btn = '<button type="button" class="iba-ai-mini iba-ai-expand" data-wide-open title="Open in a big window to read and work on it"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Expand</button>';
            let acts = head.querySelector(':scope > .iba-ai-head-actions');
            if (acts) acts.insertAdjacentHTML('afterbegin', btn);
            else head.insertAdjacentHTML('beforeend', '<span class="iba-ai-head-actions">' + btn + '</span>');
            // 17.0.0 patch 18: also at the bottom of a long card, so it is not missed
            if (card.querySelectorAll('li').length > 4 && !card.querySelector(':scope > .iba-ai-expand-foot')) {
                card.insertAdjacentHTML('beforeend', '<button type="button" class="iba-ai-mini iba-ai-expand iba-ai-expand-foot" data-wide-open title="Open in a big window"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Open in big window</button>');
            }
            // 17.0.0 patch 18: the Now brief opens in the big window by itself (once)
            if (card.classList.contains('is-brief') && !card.dataset.autoWide && !wide) {
                card.dataset.autoWide = '1';
                setTimeout(() => { if (!wide && card.isConnected && !card.closest('#iba-ai-wide-body')) openWide(card); }, 60);
            }
        });
    }
    function openWide(card) {
        const p = $('iba-ai-panel');
        const body = $('iba-ai-wide-body');
        if (!card || !p || !body || onPhone()) return;
        if (wide) restoreWide();
        const ph = document.createElement('div');
        ph.className = 'iba-ai-note iba-ai-wide-ph';
        ph.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> <span>Shown in the big window.</span>';
        card.parentNode.insertBefore(ph, card);
        const head = card.querySelector(':scope > .iba-ai-card-head');
        let title = 'IBA Assistant';
        if (head) { const h = head.cloneNode(true); h.querySelectorAll('.iba-ai-head-actions, button').forEach((x) => x.remove()); title = h.textContent.trim().replace(/\s+/g, ' ').slice(0, 90) || title; }
        $('iba-ai-wide-title').textContent = title;
        body.innerHTML = '';
        body.appendChild(card);
        const more = document.createElement('div');
        more.id = 'iba-ai-wide-more';
        body.appendChild(more);
        wide = { card: card, ph: ph, prev: state.view === 'wide' ? 'chat' : state.view };
        p.classList.add('is-wide');
        applyWidePos(lsGet(WIDE_POS_KEY, null));
        showView('wide');
        body.scrollTop = 0;
    }
    function restoreWide() {
        const w = wide;
        wide = null;
        const p = $('iba-ai-panel');
        if (p) p.classList.remove('is-wide');
        applyWidePos(null);
        if (!w) return;
        if (w.ph && w.ph.isConnected) w.ph.replaceWith(w.card);
        else if (w.card && w.card.parentNode) w.card.parentNode.removeChild(w.card);
        const body = $('iba-ai-wide-body');
        if (body) body.innerHTML = '';
        return w.prev;
    }
    function closeWide() {
        const prev = restoreWide();
        showView(prev || 'chat');
        scrollEnd();
    }
    // 15.0.0 patch 45: move (drag the bar) and resize (drag the corner); the
    // place is kept in this browser. Double-click the bar to put it back.
    const WIDE_POS_KEY = 'iba-ai-wide-pos-v1';
    function applyWidePos(pos) {
        const p = $('iba-ai-panel');
        if (!p) return;
        if (!pos || !p.classList.contains('is-wide')) {
            p.classList.remove('is-moved');
            ['--wx', '--wy', '--ww', '--wh'].forEach((v) => p.style.removeProperty(v));
            return;
        }
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = Math.max(420, Math.min(vw - 8, Number(pos.w) || 900));
        const hgt = Math.max(300, Math.min(vh - 8, Number(pos.h) || 600));
        const x = Math.max(4, Math.min(vw - 120, Number(pos.x) || 0));
        const y = Math.max(4, Math.min(vh - 60, Number(pos.y) || 0));
        p.style.setProperty('--wx', x + 'px'); p.style.setProperty('--wy', y + 'px');
        p.style.setProperty('--ww', w + 'px'); p.style.setProperty('--wh', hgt + 'px');
        p.classList.add('is-moved');
    }
    function bindWideMove(panel) {
        const start = (e, mode) => {
            if (!panel.classList.contains('is-wide') || e.button !== 0) return;
            e.preventDefault();
            const r = panel.getBoundingClientRect();
            const o = { x: e.clientX, y: e.clientY, r: r };
            const move = (ev) => {
                const dx = ev.clientX - o.x, dy = ev.clientY - o.y;
                applyWidePos(mode === 'move' ? { x: o.r.left + dx, y: o.r.top + dy, w: o.r.width, h: o.r.height } : { x: o.r.left, y: o.r.top, w: o.r.width + dx, h: o.r.height + dy });
            };
            const up = () => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                panel.classList.remove('is-dragging');
                const q = panel.getBoundingClientRect();
                if (panel.classList.contains('is-moved')) lsSet(WIDE_POS_KEY, { x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height) });
            };
            panel.classList.add('is-dragging');
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
        };
        panel.addEventListener('pointerdown', (e) => {
            if (e.target.closest('[data-wide-grip]')) return start(e, 'size');
            if (e.target.closest('.iba-ai-wide-bar, .iba-ai-head') && !e.target.closest('button, a, input, select, textarea')) return start(e, 'move');
        });
        panel.addEventListener('dblclick', (e) => {
            if (!panel.classList.contains('is-wide') || !e.target.closest('.iba-ai-wide-bar, .iba-ai-head') || e.target.closest('button')) return;
            try { localStorage.removeItem(WIDE_POS_KEY); } catch (_) {}
            applyWidePos(null);
        });
    }
    function wideMore() {
        let box = $('iba-ai-wide-more');
        const body = $('iba-ai-wide-body');
        if (!box && body) { box = document.createElement('div'); box.id = 'iba-ai-wide-more'; body.appendChild(box); }
        setTimeout(() => { try { box.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }, 60);
        return box;
    }

    // ------------------------------------------------------------------
    // 15.0.0 patch 25: phone home logic (no AI needed)
    // ------------------------------------------------------------------
    const APH_MODE_KEY = 'iba-ai-aph-mode';
    const APH_HINT = { auto: 'PO, vendor, transfer no. or a name', inv: 'PO number or vendor name', trf: 'TRF-0361, vehicle no. or item', person: 'Name, position, site or mobile no.' };
    let aphMode = 'auto';
    function setPhoneMode(m, user) {
        aphMode = (user && aphMode === m) ? 'auto' : (APH_HINT[m] !== undefined ? m : 'auto');
        lsSet(APH_MODE_KEY, aphMode);
        document.querySelectorAll('#iba-ai-panel [data-aph-mode]').forEach((x) => { const on = x.dataset.aphMode === aphMode; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
        const q = $('iba-aph-q');
        if (q) q.placeholder = APH_HINT[aphMode] || APH_HINT.auto;
        if (user && q) q.focus();
    }
    function paintPhoneRem() {
        const box = $('iba-aph-rem');
        if (box) box.innerHTML = remindersHtml();
    }
    function paintPhone() {
        const h = $('iba-aph-hello');
        if (h) h.textContent = greetingWord() + (firstName() ? ', ' + firstName() : '');
        if (!document.querySelector('#iba-ai-panel [data-aph-mode].is-on') && aphMode === 'auto') setPhoneMode(lsGet(APH_MODE_KEY, 'auto'), false);
        document.querySelectorAll('#iba-ai-panel [data-needs-ai]').forEach((el) => { el.hidden = !ready(); });
        paintPhoneRem();
    }
    async function phoneCard(promise, out) {
        if (state.busy) return;
        state.busy = true;
        out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        try {
            const o = await promise();
            out.innerHTML = '';
            if (o && o.card) addCard(o.card, out);
            else out.innerHTML = '<div class="iba-ai-note is-error">' + esc((o && o.result && o.result.error) || 'Nothing found.') + '</div>';
        } catch (err) {
            out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
        } finally { state.busy = false; }
    }
    function phoneSearch(raw) {
        const q = String(raw || '').trim();
        const out = $('iba-aph-out');
        if (!q || !out) return;
        const m = aphMode;
        if (m === 'person') return phoneCard(() => runTool('find_person', { name: q }), out);
        if (looksTransfer(q)) return runTransferTrack(q, out);
        if (m === 'trf') return runTransferFind({ text: q }, out);
        const looksPO = /\d/.test(q) && /^\s*(po[\s#:-]*)?[a-z0-9_-]+\s*$/i.test(q);
        if (m === 'inv') return runTrack({ po: looksPO ? q : '', vendor: looksPO ? '' : q }, out);
        // auto: a PO number, a colleague's name, else a vendor
        // 15.0.0 patch 41: a mobile number (8+ digits) looks up the colleague
        if (/^\+?[\d\s\-()]{8,}$/.test(q) && q.replace(/\D+/g, '').length >= 8) return phoneCard(() => runTool('find_person', { name: q }), out);
        if (looksPO) return runTrack({ po: q, vendor: '' }, out);
        const pr = resolvePerson(q);
        if (pr.name || (pr.matches.length && pr.matches.length <= 3 && pr.matches.every((x) => norm(x.value).includes(norm(q))))) return phoneCard(() => runTool('find_person', { name: q }), out);
        return runTrack({ po: '', vendor: q }, out);
    }

    // 15.0.0 patch 47: what can be answered without the AI
    const QUICK_ALL = ['po_report', 'inv_status', 'approvals_list', 'site_list', 'weekly', 'export', 'recent', 'new_job', 'new_delivery', 'transfer', 'person', 'brief'];
    const INTENTS = [
        [/\b(reports?|list|lists|summary|print|statement)\b/i, ['po_report', 'inv_status', 'approvals_list', 'site_list', 'weekly', 'export', 'recent']],
        [/\b(download|csv|excel|export)\b/i, ['export', 'po_report', 'inv_status']],
        [/\b(urgent|rush)\b/i, ['urgent', 'approvals_list']],
        [/\b(approvals?|approve|ceo|coo)\b/i, ['approvals_list', 'urgent', 'inv_status']],
        [/\b(new|add)\s+(job|entry)\b|\bjob entry\b|\breception\b/i, ['new_job']],
        [/\b(deliver(y|ies)?|restock|return|usage|stock|material)\b/i, ['new_delivery', 'transfer']],
        [/\b(colleague|contact|phone|mobile|email|who is)\b/i, ['person', 'site_team']]
    ];
    function quickPicks(ids, all) {
        const ok = ids.filter((id) => SKILL_TPL[id] && tplAllowed(id));
        if (!ok.length) return false;
        const d = document.createElement('div');
        d.className = 'iba-ai-card is-action iba-ai-quick';
        d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-hand-pointer"></i> ' + (all ? 'Pick one' : 'Pick the one you need') + '</div>' +
            '<div class="iba-ai-quick-btns">' + ok.map((id) => {
                const t = SKILL_TPL[id];
                const l = SKILL_LOOK[id] || ['', '#138A97'];
                return '<button type="button" class="iba-ai-quick-btn" data-run-tpl="' + id + '" style="--c:' + l[1] + '" title="' + esc(t.desc || '') + '"><i class="fa-solid ' + t.icon + '"></i><b>' + esc(t.name) + '</b>' + (l[0] ? '<small>' + esc(l[0]) + '</small>' : '') + '</button>';
            }).join('') + '</div>';
        put(d);
        return true;
    }
    async function localDo(text, fn) {
        showView('chat');
        addUser(text);
        state.busy = true;
        setBusy(true);
        try { await fn(); } catch (err) { addError(err); } finally { state.busy = false; setBusy(false); }
        return true;
    }
    async function localAnswer(text) {
        const t = text.replace(/[?!.]+$/, '').trim();
        const words = t.split(/\s+/).filter(Boolean).length;
        // a PO number, alone or as "po 62921" / "status of po 62921"
        const po = (t.match(/^(?:(?:status|track|check|where is|show)(?:\s+(?:of|the|for))?\s+)?(?:po|p\.o\.?)?[\s#:-]*(\d{4,7})$/i) || [])[1];
        if (po && words <= 6 && !onPhone()) {
            return localDo(text, async () => {
                for (const n of ['find_po', 'track_invoices']) {
                    const out = await runTool(n, { po: po });
                    if (out.card) addCard(out.card);
                    else if (out.result && out.result.error && n === 'find_po') addNote(out.result.error);
                }
            });
        }
        // a report / skill word in a short message: the buttons to pick from
        if (words <= 5 || !ready()) {
            const hit = INTENTS.find((x) => x[0].test(t));
            if (hit && !(ready() && /\b(why|how many|how much|compare|which|when did)\b/i.test(t))) {
                showView('chat');
                addUser(text);
                if (!quickPicks(hit[1])) addNote('That is not available for your account.');
                return true;
            }
        }
        // 17.0.0 patch 2: a short name that is a vendor in the PO list is
        // looked up straight away, key or no key (e.g. "dot")
        if (words <= 3 && /[a-z]/i.test(t) && !/\b(hi|hello|hey|thanks?|thank you|good (morning|afternoon|evening)|help|brief|today|waiting|remind(er)?s?|my tasks?|pending|why|how|what|who|when|which)\b/i.test(t)) {
            const pr = resolvePerson(t);
            if (!pr.name) {
                try { await ensureBase(); } catch (_) {}
                if (vendorPOs(t, poMap()).list.length) {
                    return localDo(text, async () => { addCard({ kind: 'track', data: await trackSearch({ po: '', vendor: t }) }); });
                }
            }
        }
        if (ready()) return false;
        // no key: a colleague, a mobile number, else a vendor (short text only)
        if (/^\+?[\d\s\-()]{8,}$/.test(t) && t.replace(/\D+/g, '').length >= 8) return localDo(text, async () => { const o = await runTool('find_person', { name: t }); if (o.card) addCard(o.card); });
        if (words <= 4 && /[a-z]/i.test(t) && !/\b(hi|hello|hey|thanks?|thank you|good (morning|afternoon|evening)|help|brief|today|waiting|remind(er)?s?|my tasks?|pending)\b/i.test(t)) {
            const pr = resolvePerson(t);
            if (pr.name || (pr.matches.length && pr.matches.length <= 3 && pr.matches.every((x) => norm(x.value).includes(norm(t))))) {
                return localDo(text, async () => { const o = await runTool('find_person', { name: t }); if (o.card) addCard(o.card); });
            }
            return localDo(text, async () => { addCard({ kind: 'track', data: await trackSearch({ po: '', vendor: t }) }); });
        }
        return false;
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

    // 17.0.0 patch 3: the brief's tasks are done right there. Each row gets
    // the same buttons as in WorkDesk Active Task (Approve / Reject, SRV Done,
    // Process, Close out, Make approval, Print) and runs the same routines,
    // so ESN, Attention hand-over and the task lists work exactly as there.
    // Their windows open above the assistant.
    const SRV_STEPS = ['for srv', 'waiting signature', 'waiting approval'];
    function isManagerUser() {
        const a = me() || {};
        const pos = String(a.Position || '').toLowerCase();
        return pos.indexOf('manager') !== -1 || pos.indexOf('director') !== -1 || pos.indexOf('ceo') !== -1 || String(a.Role || '').toLowerCase() === 'admin';
    }
    function taskActs(t) {
        const st = norm(t.status);
        const apv = window.ibaApprovals;
        const inv = t.kind === 'invoice';
        if (inv && (st === 'approved' || st === 'rejected')) return (st === 'approved' && apv ? [['print', 'Print', 'fa-print']].concat(window.ibaPrintBasket && window.ibaPrintBasket.allowed() ? [['basket', 'Add to print', 'fa-cart-plus']] : []) : []).concat([['process', 'Process', 'fa-pen-to-square']]);
        if (inv && apv && (st === 'for approval' || st === 'ceo approval')) {
            let ok = false;
            try { ok = apv.canDecide({ status: t.status, attention: t.attention }) || (st === 'for approval' && isManagerUser()); } catch (_) {}
            if (ok) return [['approve', 'Approve', 'fa-check'], ['reject', 'Reject', 'fa-xmark']];
        }
        if (document.body.classList.contains('is-ceo') && typeof openCEOApprovalModal === 'function') return [['ceo', 'Make approval', 'fa-stamp']];
        if (st === 'po close out' && typeof window.handlePOCloseOutDone === 'function') return [['closeout', 'Close out', 'fa-flag-checkered']];
        const out = [];
        if (SRV_STEPS.indexOf(st) !== -1 && typeof handleSRVDone === 'function') out.push(['srv', 'SRV Done', 'fa-circle-check']);
        if (typeof openModifyTaskModal === 'function') out.push(['process', 'Process', 'fa-pen-to-square']);
        return out;
    }
    // 17.0.0 patch 9 / 12: Now Brief tasks as a table, one block per status
    // (martin: keep New Entry, Approved, ... apart); the site is a column.
    function taskSite(t) {
        let v = String(t.site || '').trim();
        if (!v && t.po) { try { const r = poMap()[String(t.po).toUpperCase()] || poMap()[t.po]; if (r) v = String(r['Project ID'] || r.Project || '').trim(); } catch (_) {} }
        return v;
    }
    const STATUS_ORDER = ['for approval', 'approved', 'for srv', 'srv done', 'new entry', 'under review', 'for summary', 'report', 'with accounts'];
    function taskSiteTable(tasks, MORE) {
        const groups = new Map();
        tasks.forEach((t) => { const s = String(t.status || '').trim() || 'No status'; const k = norm(s); if (!groups.has(k)) groups.set(k, { name: s, list: [] }); groups.get(k).list.push(t); });
        const rank = (k) => { const i = STATUS_ORDER.indexOf(k); return i === -1 ? 99 : i; };
        const order = Array.from(groups.keys()).sort((a, b) => rank(a) - rank(b) || groups.get(b).list.length - groups.get(a).list.length || a.localeCompare(b));
        return '<div class="iba-ai-ttab-wrap">' + order.map((k, g) => {
            const grp = groups.get(k), list = grp.list;
            const urg = list.filter((t) => isUrgentNote(t.note)).length;
            const total = list.reduce((n, t) => n + num(t.amount), 0);
            return '<div class="iba-ai-ttab-site"><div class="iba-ai-ttab-sitehead"><i class="fa-solid fa-layer-group"></i> <b>' + esc(grp.name) + '</b>' +
                '<span class="iba-ai-ttab-count">' + list.length + ' task' + (list.length === 1 ? '' : 's') + '</span>' +
                (urg ? '<span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> ' + urg + ' urgent</span>' : '') +
                '<span class="iba-ai-ttab-step"><i class="fa-solid fa-arrow-right"></i> ' + esc(nextStep(grp.name)) + '</span>' +
                (total ? '<span class="iba-ai-ttab-total">QAR ' + esc(money(total)) + '</span>' : '') + '</div>' +
                '<ul class="iba-ai-rows iba-ai-ttab" data-brief-list="tasks-' + g + '">' +
                '<li class="iba-ai-ttab-head" aria-hidden="true"><span class="c-po">PO</span><span class="c-site">Site</span><span class="c-main">Vendor · invoice</span><span class="c-age">Age</span><span class="c-act"></span></li>' +
                list.map((t, i) => {
                    const u = isUrgentNote(t.note);
                    const site = taskSite(t);
                    return '<li' + (i >= MORE ? ' hidden' : '') + (u ? ' class="is-urgent"' : '') + '>' +
                        '<span class="c-po">' + poLink(t.po) + '</span>' +
                        '<span class="c-site">' + esc(site || '—') + '</span>' +
                        '<span class="iba-ai-grow c-main">' + esc(t.vendor || t.type || '—') + (u ? ' <span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span>' : '') +
                            '<small>' + esc([t.ref, t.amount ? 'QAR ' + money(t.amount) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
                        '<span class="c-age">' + ageChip(daysSince(t.at)) + '</span>' +
                        '<span class="c-act">' + taskActionsHtml(t) +
                        '<button type="button" class="iba-ai-mini iba-ai-go is-open" data-open-task="' + esc(JSON.stringify({ key: t.key || '', po: t.po || '', ref: t.ref || '' })) + '" title="Open it in Active Task"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></span></li>';
                }).join('') + '</ul>' +
                (list.length > MORE ? '<button type="button" class="iba-ai-mini iba-ai-brief-more" data-brief-more="tasks-' + g + '"><i class="fa-solid fa-chevron-down"></i> Show all ' + list.length + '</button>' : '') + '</div>';
        }).join('') + '</div>';
    }
    function taskActionsHtml(t, phone) {
        const q = esc(JSON.stringify({ key: t.key || '', po: t.po || '', ref: t.ref || '', kind: t.kind || '', status: t.status || '', vendor: t.vendor || '', at: t.at || 0 }));
        const acts = phone ? phoneActs(t) : taskActs(t);
        if (!acts.length) return '';
        return '<span class="iba-ai-acts">' + acts.map((a) =>
            '<button type="button" class="iba-ai-mini iba-ai-act is-' + a[0] + '" data-task-act="' + a[0] + '" data-task="' + q + '" title="' + esc(a[1]) + '"><i class="fa-solid ' + a[2] + '"></i> ' + esc(a[1]) + '</button>').join('') + '</span>';
    }

    // 17.0.0 patch 5: on the phone a task can be approved / rejected, a
    // colleague reminded, or the task pinned as a reminder to do it on the PC.
    function phoneActs(t) {
        const out = [];
        const st = norm(t.status);
        const apv = window.ibaApprovals;
        if (t.kind === 'invoice' && apv && (st === 'for approval' || st === 'ceo approval')) {
            let ok = false;
            try { ok = apv.canDecide({ status: t.status, attention: t.attention }); } catch (_) {}
            if (ok) out.push(['approve', 'Approve', 'fa-check'], ['reject', 'Reject', 'fa-xmark']);
        }
        out.push(['pc', 'Do on PC', 'fa-desktop'], ['remind', 'Remind', 'fa-bell']);
        return out;
    }
    async function pinForPC(q, btn) {
        const d = mainDb();
        const me = myName();
        if (!d || !me) return;
        const li = btn.closest('li');
        const text = 'Do on PC: PO ' + (q.po || '') + (q.ref ? ' · ' + q.ref : '') + (q.vendor ? ' · ' + q.vendor : '') + (q.status ? ' · ' + q.status : '');
        btn.disabled = true;
        try {
            await d.ref('iba_assistant/reminders/' + remSafe(me)).push({ from: me, to: me, text: text, po: q.po || '', control: '', at: firebase.database.ServerValue.TIMESTAMP });
            if (li) rowNote(li, '<i class="fa-solid fa-check"></i> Pinned: it waits in your reminders on the PC.', 'done');
        } catch (err) {
            btn.disabled = false;
            if (li) rowNote(li, 'Could not pin: ' + esc((err && err.message) || err), 'error');
        }
    }
    async function phoneBrief() {
        const out = $('iba-aph-out');
        if (!out || state.busy) return;
        state.busy = true;
        out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        try {
            for (let i = 0; i < 8; i++) { const w = waiting(); if (w && w.running) break; await wait(1250); }
            const o = await toolBrief(); // read-only: on the phone too
            if (!o || !o.card) { out.innerHTML = '<div class="iba-ai-note is-error">' + esc((o && o.result && o.result.error) || 'The brief is not ready yet. Try again in a moment.') + '</div>'; return; }
            out.innerHTML = phoneBriefHtml(o.card.data);
            try { out.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {}
            const n = $('iba-aph-brief-n');
            const x = o.card.data;
            if (n) n.textContent = (x.tasks || []).length + ' task' + ((x.tasks || []).length === 1 ? '' : 's') + ' · ' + (x.tasks || []).filter((t) => isUrgentNote(t.note)).length + ' urgent';
        } catch (err) {
            out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
        } finally { state.busy = false; }
    }
    function phoneBriefHtml(x) {
        const r = x.result || {};
        const tasks = (x.tasks || []).map((t, i) => ({ t: t, i: i, u: isUrgentNote(t.note) ? 1 : 0 })).sort((p, q) => (q.u - p.u) || (p.i - q.i)).map((o) => o.t);
        const jobs = x.jobs || [];
        const nUrg = tasks.filter((t) => isUrgentNote(t.note)).length;
        const nLate = tasks.concat(jobs).filter((t) => (daysSince(t.at) || 0) > 7).length;
        const MORE = 8;
        let h = '<div class="iba-ai-card is-brief is-aph-brief">' +
            '<div class="iba-ai-card-head"><i class="fa-solid fa-sun"></i> ' + esc(greetingWord() + (firstName() ? ', ' + firstName() : '')) + '</div>' +
            '<div class="iba-aph-kpis"><div><b>' + tasks.length + '</b><span>Tasks</span></div><div class="is-urg"><b>' + nUrg + '</b><span>Urgent</span></div>' +
            '<div class="is-late"><b>' + nLate + '</b><span>Over 7 days</span></div><div><b>' + (r.active_job || 0) + '</b><span>Inventory</span></div></div>';
        h += remindersHtml();
        if (tasks.length) {
            h += '<div class="iba-ai-sub">Your tasks' + (nUrg ? ' · urgent first' : ' · oldest first') + '</div><ul class="iba-ai-rows iba-aph-tasks" data-brief-list="aph">' + tasks.map((t, i) => {
                const dd = daysSince(t.at);
                return '<li' + (i >= MORE ? ' hidden' : '') + (isUrgentNote(t.note) ? ' class="is-urgent"' : '') + '>' +
                    '<div class="iba-aph-trow"><button type="button" class="iba-ai-po" data-aph-po="' + esc(t.po || '') + '">' + esc(t.po || '—') + '</button>' +
                    '<span class="iba-ai-grow">' + esc(t.vendor || t.ref || t.type || '') + (isUrgentNote(t.note) ? ' <span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span>' : '') +
                    '<small>' + esc([t.ref, t.status, t.amount ? 'QAR ' + money(t.amount) : ''].filter(Boolean).join(' · ')) + '</small></span>' +
                    (dd === null ? '' : '<span class="iba-aph-age' + (dd > 7 ? ' is-late' : '') + '">' + dd + 'd</span>') + '</div>' +
                    taskActionsHtml(t, true) + '</li>';
            }).join('') + '</ul>' + (tasks.length > MORE ? '<button type="button" class="iba-ai-mini iba-ai-brief-more" data-brief-more="aph"><i class="fa-solid fa-chevron-down"></i> Show all ' + tasks.length + '</button>' : '');
        }
        if (jobs.length) {
            h += '<div class="iba-ai-sub">Inventory waiting for you (' + jobs.length + ')</div><ul class="iba-ai-rows">' + jobs.slice(0, MORE).map((j) =>
                '<li><button type="button" class="iba-ai-chip iba-ai-trf-no" data-trf="' + esc(j.control) + '">' + esc(j.control) + '</button><span class="iba-ai-grow">' + esc(j.product || '') + '<small>' + esc(j.step || '') + '</small></span>' +
                (daysSince(j.at) === null ? '' : '<span class="iba-aph-age">' + daysSince(j.at) + 'd</span>') + '</li>').join('') + '</ul>';
        }
        if (!tasks.length && !jobs.length) h += '<p class="iba-ai-empty"><i class="fa-solid fa-mug-hot"></i> Nothing is waiting for you.</p>';
        h += '<p class="iba-aph-foot">Process, SRV Done and printing are on the PC. <b>Do on PC</b> pins a task to your reminders there.</p></div>';
        return h;
    }

    async function fullTask(q) {
        const key = String(q.key || '');
        const find = (list) => (Array.isArray(list) ? list.find((x) => x && String(x.key || '') === key) : null) || null;
        let t = null;
        try { if (typeof userActiveTasks !== 'undefined') t = find(userActiveTasks); } catch (_) {}
        if (t) return t;
        if (q.kind === 'job') {
            let list = [];
            try { if (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries)) list = workdeskSystemEntries; } catch (_) {}
            const e = find(list);
            if (!e) return null;
            let display = e.remarks || e.status || 'Pending';
            if (e.for === 'Invoice' && display === 'Pending') display = 'New Entry';
            t = Object.assign({}, e, {
                source: ['Transfer', 'Restock', 'Return', 'Usage'].indexOf(e.for) !== -1 ? 'transfer_entry' : 'job_entry',
                note: e.note || e.details || e.currentNote || '', remarks: display, dateEntered: e.date || '', jobRecordDateEntered: e.date || ''
            });
        } else {
            if (typeof wdLoadPersonalInvoiceLookupTasksForActiveTask !== 'function') return null;
            const names = [myName()];
            try { if (typeof getDelegatorsForReplacement === 'function') names.push.apply(names, getDelegatorsForReplacement(myName()) || []); } catch (_) {}
            for (const force of [false, true]) {
                try { t = find(await withTimeout(wdLoadPersonalInvoiceLookupTasksForActiveTask(names, force), 15000, 'task')); } catch (_) { t = null; }
                if (t) break;
            }
            if (!t) return null;
        }
        try { if (typeof userActiveTasks !== 'undefined' && Array.isArray(userActiveTasks)) userActiveTasks.push(t); } catch (_) {}
        return t;
    }

    // a window from the page (Process, approval, SRV close-out) is open
    function pageWindowOpen() {
        return Array.from(document.querySelectorAll('.modal-overlay:not(.hidden), #iba-apd:not(.hidden)'))
            .some((el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; });
    }
    async function withPageWindows(run) {
        document.body.classList.add('iba-ai-acting');
        try {
            const p = Promise.resolve(run());
            await wait(400);
            const t0 = Date.now();
            // wait until the work is finished and its windows are closed
            let done = false;
            p.then(() => { done = true; }, () => { done = true; });
            while ((!done || pageWindowOpen()) && Date.now() - t0 < 30 * 60000) await wait(400);
            return await p;
        } finally {
            document.body.classList.remove('iba-ai-acting');
        }
    }

    function rowNote(li, html, kind) {
        let n = li.querySelector('.iba-ai-act-note');
        if (!n) { n = document.createElement('small'); n.className = 'iba-ai-act-note'; (li.querySelector('.iba-ai-grow') || li).appendChild(n); }
        n.className = 'iba-ai-act-note' + (kind ? ' is-' + kind : '');
        n.innerHTML = html;
    }
    async function readTaskNow(q) {
        if (q.kind === 'job') {
            let list = [];
            try { if (typeof workdeskSystemEntries !== 'undefined' && Array.isArray(workdeskSystemEntries)) list = workdeskSystemEntries; } catch (_) {}
            const e = list.find((x) => x && String(x.key || '') === String(q.key));
            return e ? { status: e.remarks || e.status || '', attention: e.attention || '' } : null;
        }
        const k = String(q.key || '');
        const po = String(q.po || '').trim();
        const invKey = po && k.indexOf(po + '_') === 0 ? k.slice(po.length + 1) : (k.indexOf('_') !== -1 ? k.split('_').slice(1).join('_') : k);
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined') idb = invoiceDb; } catch (_) {}
        if (!idb || !po || !invKey) return undefined;
        const snap = await withTimeout(idb.ref('invoice_entries/' + po + '/' + invKey).once('value'), 9000, 'invoice');
        const v = snap && snap.val();
        return v ? { status: v.status || v.remarks || '', attention: v.attention || '' } : null;
    }
    async function markIfMoved(li, q) {
        await wait(900);
        let now;
        try { now = await readTaskNow(q); } catch (_) { return; }
        if (now === undefined) return;
        if (now === null) { li.classList.add('is-done'); rowNote(li, '<i class="fa-solid fa-check"></i> Done', 'done'); return; }
        const apv = window.ibaApprovals;
        let stillMine = true;
        try { stillMine = apv ? apv.namedForMe(now.attention) : norm(now.attention).indexOf(norm(myName())) !== -1; } catch (_) {}
        if (norm(now.status) === norm(q.status) && stillMine) return; // nothing changed (closed without saving)
        li.classList.add('is-done');
        const acts = li.querySelector('.iba-ai-acts');
        if (acts) acts.remove();
        rowNote(li, '<i class="fa-solid fa-check"></i> Done: now ' + esc(now.status || 'closed') + (now.attention && !stillMine ? ' with ' + esc(now.attention) : ''), 'done');
    }

    async function taskAct(btn) {
        const li = btn.closest('li, .wd-cork-note');
        if (!li || li.classList.contains('is-busy')) return;
        let q = {};
        try { q = JSON.parse(btn.dataset.task || '{}'); } catch (_) {}
        const act = btn.dataset.taskAct;
        if (act === 'pc') return pinForPC(q, btn);
        if (act === 'remind') {
            const days = q.at ? daysSince(Number(q.at)) : null;
            return openRemind({ po: q.po, items: [{ no: q.ref, status: q.status, days: days }] }, btn);
        }
        if (act === 'basket') {
            // 17.0.0 patch 4: the print basket (one combined print)
            const k = String(q.key || ''), po = String(q.po || '');
            const invKey = po && k.indexOf(po + '_') === 0 ? k.slice(po.length + 1) : k;
            if (window.ibaPrintBasket) await window.ibaPrintBasket.add({ po: po, key: invKey, ref: q.ref || '', vendor: q.vendor || '' });
            return;
        }
        li.classList.add('is-busy');
        rowNote(li, '<i class="fa-solid fa-spinner fa-spin"></i> Opening...');
        try {
            const task = await fullTask(q);
            if (!task) { li.classList.add('is-done'); rowNote(li, 'Not in your Active Task any more: it may be done already.', 'done'); return; }
            rowNote(li, '');
            const apv = window.ibaApprovals;
            if (act === 'print') {
                const ids = apv.taskIds(task);
                await apv.printStamp(ids.po, ids.key);
                return;
            }
            if (act === 'approve' || act === 'reject') {
                const action = act === 'approve' ? 'Approved' : 'Rejected';
                await withPageWindows(() => (typeof handleDesktopApproval === 'function' ? handleDesktopApproval(task, action) : apv.openDialog(task)));
            } else if (act === 'ceo') {
                await withPageWindows(() => openCEOApprovalModal(task));
            } else if (act === 'process') {
                await withPageWindows(() => openModifyTaskModal(task));
            } else if (act === 'srv') {
                if (!confirm('Mark SRV Done for PO ' + (q.po || '') + (q.ref ? ' (' + q.ref + ')' : '') + '?')) return;
                rowNote(li, '<i class="fa-solid fa-spinner fa-spin"></i> Saving...');
                await withPageWindows(() => handleSRVDone(null, task.key));
            } else if (act === 'closeout') {
                rowNote(li, '<i class="fa-solid fa-spinner fa-spin"></i> Saving...');
                await withPageWindows(() => window.handlePOCloseOutDone(null, task.key));
            }
            rowNote(li, '');
            await markIfMoved(li, q);
        } catch (err) {
            rowNote(li, esc((err && err.message) || String(err)), 'error');
        } finally {
            li.classList.remove('is-busy');
        }
    }

    // 15.0.0 patch 18: "Do it" in the brief takes the user straight to the
    // task in WorkDesk Active Task (or the request in Inventory Active Job),
    // on the right tab, highlighted, so they can do the next step there
    // (e.g. For SRV -> SRV Done, IPC Application -> next status).
    function waitFor(test, ms) {
        return new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => { let ok = false; try { ok = !!test(); } catch (_) {} if (ok || Date.now() - t0 > ms) resolve(ok); else setTimeout(tick, 200); };
            tick();
        });
    }
    async function openTaskPage(q) {
        if (typeof window.ibaOpenShellPage !== 'function' || typeof window.wdFocusActiveTask !== 'function') return;
        toggle(false);
        window.ibaOpenShellPage('wd-active-task');
        await waitFor(() => window.IBA_ACTIVE_TASK_LAST_MODE === 'workdesk' && document.querySelector('#active-task-filters [data-status-filter]'), 8000);
        await wait(300);
        const ok = await window.wdFocusActiveTask(q);
        if (!ok) peek('PO ' + (q.po || '') + ' is not in your Active Task any more - it may be done already.');
    }
    async function openJobPage(control) {
        if (typeof window.ibaOpenShellPage !== 'function') return;
        toggle(false);
        window.ibaOpenShellPage('inv-active-job');
        await waitFor(() => document.querySelector('#inv-active-job-table-body tr'), 8000);
        await wait(400);
        const input = $('inv-active-job-search');
        if (input) { input.value = control; input.dispatchEvent(new Event('input', { bubbles: true })); }
        await wait(900);
        const body = $('inv-active-job-table-body');
        const rows = body ? Array.from(body.querySelectorAll('tr')).filter((r) => norm(r.textContent).indexOf(norm(control)) !== -1) : [];
        if (!rows.length) { peek(control + ' is not in your Active Job any more - it may be done already.'); return; }
        const head = rows.find((r) => r.classList.contains('controlid-group-header'));
        if (head && !head.classList.contains('open')) head.click();
        const focus = head ? [head].concat(Array.from(body.querySelectorAll('tr[data-parent-group="' + head.getAttribute('data-group-id') + '"]'))) : rows;
        focus.forEach((r) => r.classList.add('wd-row-focus'));
        try { focus[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
        setTimeout(() => focus.forEach((r) => r.classList.remove('wd-row-focus')), 7000);
    }

    async function runRecent() {
        const out = $('iba-ai-track-out');
        if (state.busy || !out) return;
        const w = (document.querySelector('#iba-ai-recent [data-recent-when].is-on') || {}).dataset || {};
        const when = w.recentWhen || '2h';
        const args = { status: $('iba-ai-recent-status').value, by_me: !!$('iba-ai-recent-mine').checked };
        if (when === '2h') args.hours = 2;
        else if (when === 'yesterday') { args.day = 'yesterday'; args.period = 'whole_day'; }
        else if (when === 'today') args.period = 'whole_day';
        else args.period = when;
        state.busy = true;
        out.innerHTML = '<div class="iba-ai-typing"><span></span><span></span><span></span></div>';
        try {
            const r = await toolRecent(args);
            out.innerHTML = '';
            if (r.card) addCard(r.card, out);
            else out.innerHTML = '<div class="iba-ai-note is-error">' + esc((r.result && r.result.error) || 'Nothing found.') + '</div>';
        } catch (err) {
            out.innerHTML = '<div class="iba-ai-note is-error">' + esc((err && err.message) || String(err)) + '</div>';
        } finally { state.busy = false; }
    }

    // 15.0.0 patch 10: today's brief for everyone, key or not. Waits a few
    // seconds for the waiting list (Active Task / Active Job) after login.
    let briefBusy = false;
    async function openBrief() {
        if (briefBusy) return;
        briefBusy = true;
        try {
            showView('chat');
            for (let i = 0; i < 8; i++) { const w = waiting(); if (w && w.running) break; await new Promise((r) => setTimeout(r, 1250)); }
            await runDirect('get_brief', {});
            if (look().voice) {
                const cards = document.querySelectorAll('#iba-ai-log .iba-ai-card.is-brief');
                const last = cards[cards.length - 1];
                const data = last && briefStore.get(last.getAttribute('data-brief-id'));
                if (data) speak(briefSpeech(data));
            }
        } finally { briefBusy = false; }
    }

    async function runDirect(tool, args) {
        if (state.busy) return;
        state.busy = true;
        setBusy(true);
        try {
            const out = await runTool(tool, args);
            if (out.card) addCard(out.card);
            else if (out.result && out.result.error) addError(new Error(out.result.error));
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
    // 15.0.0 patch 46: the AI's reply without what the cards already show
    // (tables and their titles) and without the "Let me know if..." offers
    function tidyAnswer(text, cardShown) {
        let lines = String(text || '').split(/\r?\n/);
        const isTable = (ln) => /^\s*\|.*\|\s*$/.test(ln);
        const isBullet = (ln) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(ln);
        // offers at the end: from "Let me know..." (and its bullets) to the end
        const offer = /(^|[.!?)]\s+)(?:\*\*)?(?:let me know|if you (?:need|want|would like)|feel free|would you like|do you want|anything else|need anything|is there anything)/i;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(offer);
            if (m && lines.slice(i + 1).every((ln) => !ln.trim() || isBullet(ln))) {
                lines = lines.slice(0, i).concat([lines[i].slice(0, m.index + m[1].length).trim()]);
                break;
            }
        }
        // a message drafted to copy (Dear / Hi ... Regards) is left whole
        const draft = /^(?:dear|hi|hello|good (?:morning|afternoon|day))\b|\b(?:regards|thank you|thanks),?\s*$/im.test(text);
        if (cardShown && !draft) {
            const out = [];
            for (let i = 0; i < lines.length; i++) {
                if (isTable(lines[i])) {
                    // drop a short title line right before the table too
                    while (out.length && (!out[out.length - 1].trim() || (out[out.length - 1].trim().length < 70 && !/[.!?:]$/.test(out[out.length - 1].trim()) && !isBullet(out[out.length - 1])))) {
                        const t = out.pop();
                        if (t.trim()) break;
                    }
                    while (i + 1 < lines.length && isTable(lines[i + 1])) i++;
                    continue;
                }
                out.push(lines[i]);
            }
            lines = out;
            // "Type: Invoice" style field lists repeat the card too (with their title)
            const kept = [];
            for (let i = 0; i < lines.length; i++) {
                if (isBullet(lines[i]) && /^\s*(?:[-*•]|\d+[.)])\s+\**[A-Za-z][\w ./()'-]{0,30}\**\s*:\s*\S/.test(lines[i])) {
                    while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
                    const t = kept.length ? kept[kept.length - 1].trim() : '';
                    if (t && t.length < 70 && !/[.!?]$/.test(t) && !isBullet(t)) kept.pop();
                    continue;
                }
                kept.push(lines[i]);
            }
            lines = kept;
        }
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    function md(text) {
        // tiny, safe formatting: **bold**, `code`, bullet lines, line breaks
        const lines = esc(text).split(/\r?\n/);
        let html = '';
        let inList = false;
        let table = null;
        const cells = (ln) => ln.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const endTable = () => {
            if (!table) return;
            html += '<div class="iba-ai-mdtable"><table>' + table.map((r, i) => '<tr>' + r.map((c) => i === 0 ? '<th>' + c + '</th>' : '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table></div>';
            table = null;
        };
        lines.forEach((ln) => {
            if (/^\s*\|.*\|\s*$/.test(ln)) {
                if (inList) { html += '</ul>'; inList = false; }
                if (/^\s*\|[\s:|-]+\|\s*$/.test(ln)) return; // the |---|---| line
                (table = table || []).push(cells(ln));
                return;
            }
            endTable();
            const hd = ln.match(/^\s*#{1,6}\s+(.*)$/);
            if (hd) { if (inList) { html += '</ul>'; inList = false; } html += '<p><strong>' + hd[1] + '</strong></p>'; return; }
            const li = ln.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
            if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + li[1] + '</li>'; return; }
            if (inList) { html += '</ul>'; inList = false; }
            html += ln.trim() ? '<p>' + ln + '</p>' : '';
        });
        endTable();
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
        let tools = '<button type="button" class="iba-ai-mini" data-copy><i class="fa-regular fa-copy"></i> Copy</button>' +
            (canSpeak() ? '<button type="button" class="iba-ai-mini" data-say title="Read it aloud"><i class="fa-solid fa-volume-high"></i> Listen</button>' : '');
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
    function poLink(po) { return po ? '<button type="button" class="iba-ai-po" data-ai-po="' + esc(po) + '" title="Show this PO\'s invoices">' + esc(po) + '</button>' : ''; }
    // ------------------------------------------------------------------
    // 15.0.0 patch 9: reminders. "Remind" on a PO or transfer writes a short
    // note for a person (iba_assistant/reminders/{person}); their assistant
    // shows it until they mark it seen. Optional WhatsApp with the same text.
    // ------------------------------------------------------------------
    const REM_SEEN_KEY = 'iba-ai-rem-shown-v1';
    let remList = [];
    let remRef = null;
    function remSafe(n) { return String(n || '').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_'); }
    function remText(q) {
        const me = myName() || 'IBA';
        if (q.control) {
            return 'Reminder from ' + me + ': ' + q.control + (q.type ? ' (' + q.type + ')' : '') + ' is waiting for you' + (q.step ? ' - ' + q.step : '') +
                (q.days != null ? ', ' + q.days + ' day' + (q.days === 1 ? '' : 's') : '') + '. Please action it in Active Job. Thank you.';
        }
        const lines = ['Reminder from ' + me + ': PO ' + q.po];
        (q.items || []).slice(0, 6).forEach((it) => lines.push('- ' + [it.no, it.status, it.days != null ? 'waiting ' + it.days + ' day' + (it.days === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')));
        lines.push('Please action it. Thank you.');
        return lines.join('\n');
    }
    function remDefaultTo(q) {
        if (q.with) return q.with;
        const it = (q.items || []).find((i) => i.with && !/^accounts$/i.test(i.with));
        return it ? String(it.with).split(/\s*(?:,|;|\/|&|\band\b)\s*/i)[0] : '';
    }
    function openRemind(q, btn) {
        const card = btn.closest('.iba-ai-trk-item') || btn.closest('.iba-ai-card') || btn.parentElement;
        const old = card.querySelector(':scope > .iba-ai-remind');
        if (old) { old.remove(); return; }
        const box = document.createElement('div');
        box.className = 'iba-ai-remind';
        const listId = 'iba-ai-rem-people-' + Date.now();
        box.innerHTML = '<div class="iba-ai-sub"><i class="fa-solid fa-bell"></i> Remind</div>' +
            '<label class="iba-ai-rem-row"><span>To</span><input type="text" list="' + listId + '" class="iba-ai-rem-to" placeholder="Name" value="' + esc(remDefaultTo(q)) + '"></label>' +
            '<datalist id="' + listId + '">' + people().map((p) => '<option value="' + esc(p.value) + '">' + esc([p.position, p.site].filter(Boolean).join(' · ')) + '</option>').join('') + '</datalist>' +
            '<textarea class="iba-ai-rem-text" rows="4">' + esc(remText(q)) + '</textarea>' +
            '<div class="iba-ai-rem-acts"><button type="button" class="iba-ai-mini is-main" data-rem-send><i class="fa-solid fa-paper-plane"></i> Send reminder</button>' +
            '<button type="button" class="iba-ai-mini" data-rem-wa><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>' +
            '<button type="button" class="iba-ai-mini iba-ai-cancel" data-rem-cancel><i class="fa-solid fa-xmark"></i> Cancel</button>' +
            '<span class="iba-ai-rem-msg"></span></div>';
        card.appendChild(box);
        // 15.0.0 patch 36: the reminder box can be closed without sending
        box.querySelector('[data-rem-cancel]').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); box.remove(); });
        box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box.remove(); } });
        const msg = box.querySelector('.iba-ai-rem-msg');
        const who = () => {
            const typed = String(box.querySelector('.iba-ai-rem-to').value || '').trim();
            const p = people().find((x) => norm(x.value) === norm(typed));
            return p ? p.value : '';
        };
        box.addEventListener('click', async (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            e.stopPropagation();
            const to = who();
            const text = String(box.querySelector('.iba-ai-rem-text').value || '').trim();
            if (!to) { msg.textContent = 'Pick a name from the list.'; msg.className = 'iba-ai-rem-msg is-bad'; return; }
            if (!text) { msg.textContent = 'Write a message.'; msg.className = 'iba-ai-rem-msg is-bad'; return; }
            if (b.hasAttribute('data-rem-wa')) {
                if (window.ibaApprovals && window.ibaApprovals.whatsAppTo) await window.ibaApprovals.whatsAppTo(to, text);
                return;
            }
            if (b.hasAttribute('data-rem-send')) {
                const d = mainDb();
                if (!d) { msg.textContent = 'Firebase is not ready.'; return; }
                b.disabled = true;
                try {
                    const ref = d.ref('iba_assistant/reminders/' + remSafe(to)).push();
                    const sentPath = 'iba_assistant/reminders_sent/' + remSafe(myName()) + '/' + ref.key;
                    const row = { from: myName() || '', to: to, text: text, po: q.po || '', control: q.control || '', at: firebase.database.ServerValue.TIMESTAMP, sentPath: sentPath };
                    await Promise.all([ref.set(row), d.ref(sentPath).set({ to: to, text: text, po: q.po || '', control: q.control || '', at: firebase.database.ServerValue.TIMESTAMP })]);
                    msg.textContent = 'Sent to ' + to + '. It shows in their assistant until they mark it seen.';
                    msg.className = 'iba-ai-rem-msg is-ok';
                } catch (err) {
                    msg.textContent = 'Could not send: ' + ((err && err.message) || err);
                    msg.className = 'iba-ai-rem-msg is-bad';
                    b.disabled = false;
                }
            }
        });
        box.querySelector('.iba-ai-rem-to').focus();
    }
    function remindersHtml() {
        const open = remList.filter((r) => !r.seenAt);
        if (!open.length) return '';
        // 17.0.0 patch 18: one table; "All seen" clears the list at once
        return '<div class="iba-ai-sub"><i class="fa-solid fa-bell"></i> Reminders for you (' + open.length + ')' + (open.length > 1 ? ' <button type="button" class="iba-ai-mini" data-rem-all title="Mark every reminder as seen"><i class="fa-solid fa-check-double"></i> All seen</button>' : '') + '</div>' +
            '<div class="iba-ai-ttab-wrap"><div class="iba-ai-ttab-site"><ul class="iba-ai-rows iba-ai-remlist iba-ai-ttab is-rem">' +
            '<li class="iba-ai-ttab-head" aria-hidden="true"><span class="c-po">PO / TRF</span><span class="c-site">From · date</span><span class="c-main">Message</span><span class="c-age"></span><span class="c-act"></span></li>' +
            open.map((r) =>
            '<li><span class="c-po">' + (r.po ? poLink(r.po) : '') + (r.control && r.control !== r.po ? '<button type="button" class="iba-ai-chip iba-ai-trf-no" data-trf="' + esc(r.control) + '">' + esc(r.control) + '</button>' : '') + '</span>' +
            '<span class="c-site"><b>' + esc(r.from || 'Someone') + '</b><small>' + esc(fmtDate(Number(r.at) || 0)) + '</small></span>' +
            '<span class="iba-ai-grow c-main"><small class="iba-ai-rem-body">' + esc(r.text) + '</small></span><span class="c-age"></span>' +
            '<span class="c-act"><button type="button" class="iba-ai-mini" data-rem-seen="' + esc(r.id) + '" title="Mark as seen"><i class="fa-solid fa-check"></i> Seen</button></span></li>').join('') + '</ul></div></div>';
    }
    async function remMarkSeen(id) {
        const d = mainDb();
        const r = remList.find((x) => x.id === id);
        if (!d || !r) return;
        const upd = {};
        upd['iba_assistant/reminders/' + remSafe(myName()) + '/' + id + '/seenAt'] = firebase.database.ServerValue.TIMESTAMP;
        if (r.sentPath) upd[r.sentPath + '/seenAt'] = firebase.database.ServerValue.TIMESTAMP;
        try { await d.ref().update(upd); } catch (_) {
            try { await d.ref('iba_assistant/reminders/' + remSafe(myName()) + '/' + id + '/seenAt').set(firebase.database.ServerValue.TIMESTAMP); } catch (__) {}
        }
    }
    function startReminders() {
        const d = mainDb();
        const me = myName();
        if (!d || !me || remRef) return;
        remRef = d.ref('iba_assistant/reminders/' + remSafe(me)).limitToLast(30);
        remRef.on('value', (snap) => {
            const v = (snap && snap.val()) || {};
            remList = Object.keys(v).map((k) => Object.assign({ id: k }, v[k] || {})).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
            const open = remList.filter((r) => !r.seenAt);
            const fab = $('iba-ai-fab');
            if (fab) { fab.classList.toggle('has-reminder', open.length > 0); fab.setAttribute('data-rem', open.length ? String(open.length) : ''); }
            const phb = $('iba-ph-ai');
            if (phb) { phb.classList.toggle('has-reminder', open.length > 0); phb.setAttribute('data-rem', open.length ? String(open.length) : ''); }
            paintPhoneRem();
            // a new one: say it once
            const shown = lsGet(REM_SEEN_KEY, []);
            const fresh = open.filter((r) => shown.indexOf(r.id) === -1);
            if (fresh.length) {
                lsSet(REM_SEEN_KEY, shown.concat(fresh.map((r) => r.id)).slice(-100));
                const r = fresh[0];
                showBubble('<i class="fa-solid fa-bell"></i><div class="iba-ai-bubble-text"><b>Reminder from ' + esc(r.from || 'someone') + '</b><br>' + esc(String(r.text || '').split('\n')[0].slice(0, 140)) + '</div>' +
                    '<div class="iba-ai-bubble-actions"><button type="button" data-bubble="open" data-then="brief">Open</button><button type="button" data-bubble="x" title="Dismiss">×</button></div>', 30000);
            }
        }, () => { /* no access: reminders off */ });
    }
    function stopReminders() { try { if (remRef) remRef.off(); } catch (_) {} remRef = null; remList = []; }

    // 15.0.0 patch 9: Invoice Records, searched for this PO
    async function openInRecords(po) {
        if (typeof window.ibaOpenShellPage === 'function') { try { await window.ibaOpenShellPage('im-reporting'); } catch (_) {} }
        await wait(500);
        const input = $('im-reporting-search');
        const form = $('im-reporting-form');
        if (input) { input.value = po; input.dispatchEvent(new Event('input', { bubbles: true })); }
        if (form) { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
        peek('PO ' + po + ' in Invoice Records.');
    }
    function ageChip(days) {
        if (days === null || days === undefined) return '';
        const tone = days >= 30 ? 'critical' : days >= 8 ? 'alert' : days >= 3 ? 'watch' : 'fresh';
        return '<span class="iba-ai-age is-' + tone + '">' + days + 'd</span>';
    }
    const STAGE_SHORT = ['Reception', 'Entry', 'SRV', 'CEO/COO', 'Accounts', 'Paid'];
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
            const inRecords = p.items.some((it) => it.kind === 'invoice');
            h += '<div class="iba-ai-trk-po"><div class="iba-ai-trk-po-head"><b>PO ' + esc(p.po) + '</b><span>' + esc([p.vendor, p.site, p.year].filter(Boolean).join(' · ')) + '</span>' +
                (p.po_value ? '<span class="iba-ai-trk-val">QAR ' + esc(p.po_value) + '</span>' : '') + '</div>';
            if (!p.items.length) h += '<p class="iba-ai-empty">No invoice received yet for this PO - it is not in Invoice Records.</p>';
            p.items.forEach((it) => {
                const side = !!it.side_status;
                const now = it.side_status || it.status;
                const who = [it.stage_index === 4 && !side ? 'payment in process' : '', it.with ? 'with ' + it.with : '', it.days !== undefined ? it.days + ' day' + (it.days === 1 ? '' : 's') : '', it.since ? (it.stage_index === 5 && !side ? 'paid ' : 'since ') + it.since : ''].filter(Boolean).join(' · ');
                h += '<div class="iba-ai-trk-item' + (side ? ' is-side' : '') + '">' +
                    '<div class="iba-ai-trk-top"><span class="iba-ai-tag">' + esc(it.invoice_no) + '</span><span class="iba-ai-grow"><strong>' + esc(now) + (it.urgent ? ' <span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span>' : '') + '</strong><small>' + esc(who) + '</small></span>' +
                    (it.value ? '<span class="iba-ai-trk-val">' + esc(it.value) + '</span>' : '') + '</div>' +
                    (it.invoice_date || it.paid_on || it.with_accounts_on ? '<div class="iba-ai-trk-dates">' + [it.invoice_date ? 'Invoice ' + esc(it.invoice_date) : '', it.with_accounts_on ? 'With Accounts ' + esc(it.with_accounts_on) : '', it.paid_on ? 'Paid ' + esc(it.paid_on) : ''].filter(Boolean).join(' · ') + '</div>' : '') +
                    '<ol class="iba-ai-pipe">' + STAGE_SHORT.map((lbl, i) => '<li class="' + ((it.skipped_index || []).indexOf(i) !== -1 ? 'is-skipped' : i < it.stage_index ? 'is-done' : i === it.stage_index ? ('is-now' + (side ? ' is-side' : '') + (i === 5 ? ' is-final' : '')) : '') + '"' + ((it.skipped_index || []).indexOf(i) !== -1 ? ' title="Skipped"' : '') + '><span></span>' + lbl + '</li>').join('') + '</ol>' +
                    (it.pdf ? '<a class="iba-ai-mini" href="' + esc(it.pdf) + '" target="_blank" rel="noopener" title="Open the invoice attachment"><i class="fa-regular fa-file-pdf"></i> INV</a>' : '') +
                    // 15.0.0 patch 44: the SRV file too (same link as Invoice Records)
                    srvLink(it.srv) +
                    // 15.0.0 patch 40: Remind on each open invoice, to the person who has it
                    (it.stage_index < 5 && it.with ? '<button type="button" class="iba-ai-mini" data-ai-remind="' + esc(JSON.stringify({ po: p.po, with: String(it.with).split(/\s*(?:,|;|\/|&|\band\b)\s*/i)[0], items: [{ no: it.invoice_no, status: it.status, with: it.with || '', days: it.days }] })) + '" title="Remind ' + esc(it.with) + ' about this invoice"><i class="fa-solid fa-bell"></i> Remind</button>' : '') +
                    (it.kind === 'invoice' && it.key && APPROVAL_RX.test(String(it.status || '')) && (it.urgent ? isSuper() : isAdminUser()) ? '<button type="button" class="iba-ai-mini' + (it.urgent ? '' : ' is-danger') + '" data-urg-po="' + esc(p.po) + '" data-urg-key="' + esc(it.key) + '" data-urg-on="' + (it.urgent ? '0' : '1') + '"><i class="fa-solid fa-bolt"></i> ' + (it.urgent ? 'Remove urgent' : 'Mark urgent') + '</button>' : '') +
                    (it.steps && it.steps.length ? '<button type="button" class="iba-ai-mini iba-ai-trk-histbtn" data-trk-hist><i class="fa-solid fa-clock-rotate-left"></i> History</button>' +
                        '<ul class="iba-ai-trk-steps">' + it.steps.map((x) => '<li><b>' + esc(x.status) + '</b> · ' + esc(x.date) + (x.by ? ' · ' + esc(x.by) : '') + '</li>').join('') + '</ul>' : '') +
                    '</div>';
            });
            // 15.0.0 patch 27: Remind also for items still at Reception or with the QS
            const openIt = p.items.filter((it) => it.stage_index < 5);
            if (inRecords || openIt.length) h += '<div class="iba-ai-trk-acts">' + (inRecords ? '<button type="button" class="iba-ai-mini" data-ai-records="' + esc(p.po) + '"><i class="fa-solid fa-table-list"></i> Open in Invoice Records</button>' : '') +
                (openIt.length ? '<button type="button" class="iba-ai-mini" data-ai-remind="' + esc(JSON.stringify({ po: p.po, items: openIt.map((it) => ({ no: it.invoice_no, status: it.status, with: it.with || '', days: it.days })) })) + '"><i class="fa-solid fa-bell"></i> ' + (openIt.length > 1 ? 'Remind all (' + openIt.length + ')' : 'Remind') + '</button>' : '') + '</div>';
            h += '</div>';
        });
        if (r.by_site && Object.keys(r.by_site).length) {
            const base = r.query || {};
            const sites = Object.keys(r.by_site).sort();
            h += '<div class="iba-ai-sub">Not in the newest? Look in a site</div><div class="iba-ai-chiprow">' + sites.map((st) =>
                '<button type="button" class="iba-ai-chip" data-track="' + trackQueryAttr({ vendor: base.vendor || r.vendor }, { site: siteNo(st) }) + '">' + esc(st || '?') + ' <b>' + esc(r.by_site[st]) + '</b></button>').join('') + '</div>';
        }
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
            // 15.0.0 patch 45: your own work first and in full; what happens in
            // the company (approvals, PO Close Out) as a short line you can open.
            const r = x.result;
            const bid = 'b' + (++briefSeq);
            briefStore.set(bid, x);
            if (briefStore.size > 6) briefStore.delete(briefStore.keys().next().value);
            d.setAttribute('data-brief-id', bid);
            const MORE = 5;
            const moreBtn = (n, what) => n > MORE ? '<button type="button" class="iba-ai-mini iba-ai-brief-more" data-brief-more="' + what + '"><i class="fa-solid fa-chevron-down"></i> Show all ' + n + '</button>' : '';
            const urgentFirst = (list) => list.map((t, i) => ({ t: t, i: i, u: isUrgentNote(t.note) ? 1 : 0 })).sort((p, q) => (q.u - p.u) || (p.i - q.i)).map((o) => o.t);
            const tasks = urgentFirst(x.tasks || []);
            const jobs = x.jobs || [];
            const rems = remList.filter((m) => !m.seenAt);
            const nUrg = tasks.filter((t) => isUrgentNote(t.note)).length;
            const nLate = tasks.concat(jobs).filter((t) => (daysSince(t.at) || 0) > 7).length;
            let h = '<div class="iba-ai-card-head"><i class="fa-solid fa-sun"></i> ' + esc(greetingWord() + (firstName() ? ', ' + firstName() : '')) +
                '<span class="iba-ai-head-actions">' + (canSpeak() ? '<button type="button" class="iba-ai-mini" data-brief-say title="Read the brief aloud"><i class="fa-solid fa-volume-high"></i></button>' : '') + '<button type="button" class="iba-ai-mini" data-brief-print title="Print or save as PDF: a checklist with charts"><i class="fa-solid fa-print"></i> Print</button></span></div>' +
                '<div class="iba-ai-stats">' +
                  '<div><b>' + esc(r.active_task) + '</b><span>Your tasks</span></div>' +
                  '<div><b>' + esc(r.active_job) + '</b><span>Inventory</span></div>' +
                  '<div><b>' + esc(rems.length) + '</b><span>Reminders</span></div>' +
                  '<div><b>' + esc(r.new_today || 0) + '</b><span>New today</span></div>' +
                '</div>';
            if (nUrg || nLate) h += '<div class="iba-ai-brief-alert">' + (nUrg ? '<span class="is-urgent"><i class="fa-solid fa-bolt"></i> ' + nUrg + ' urgent</span>' : '') + (nLate ? '<span class="is-late"><i class="fa-solid fa-hourglass-half"></i> ' + nLate + ' waiting over 7 days</span>' : '') + '</div>';
            h += remindersHtml();
            if (tasks.length) {
                // 17.0.0 patch 9: a table grouped by site (most tasks first);
                // inside each site urgent first, then oldest.
                h += '<div class="iba-ai-sub">Your tasks by status' + (nUrg ? ' (urgent first, then oldest)' : ' (oldest first)') + '</div>' + taskSiteTable(tasks, MORE);
            }
            if (jobs.length) {
                // 17.0.0 patch 18: one table, like the tasks
                h += '<div class="iba-ai-sub">Inventory waiting for your step (' + jobs.length + ')</div><div class="iba-ai-ttab-wrap"><div class="iba-ai-ttab-site">' +
                    '<ul class="iba-ai-rows iba-ai-ttab is-jobs" data-brief-list="jobs">' +
                    '<li class="iba-ai-ttab-head" aria-hidden="true"><span class="c-po">Transfer</span><span class="c-site">From → to</span><span class="c-main">Item · step</span><span class="c-age">Age</span><span class="c-act"></span></li>' +
                    jobs.map((j, i) =>
                    '<li' + (i >= MORE ? ' hidden' : '') + '><span class="c-po"><button type="button" class="iba-ai-chip iba-ai-trf-no" data-trf="' + esc(j.control) + '">' + esc(j.control) + '</button></span>' +
                    '<span class="c-site">' + esc(j.from || j.to ? (j.from || '—') + ' → ' + (j.to || '—') : '—') + '</span>' +
                    '<span class="iba-ai-grow c-main">' + esc(j.product || j.type || '—') + '<small>' + esc(j.step) + '</small>' +
                    '<small class="iba-ai-next"><i class="fa-solid fa-arrow-right"></i> ' + esc(nextStep(j.step)) + '</small></span>' +
                    '<span class="c-age">' + ageChip(daysSince(j.at)) + '</span>' +
                    '<span class="c-act"><button type="button" class="iba-ai-mini iba-ai-go" data-open-job="' + esc(j.control) + '" title="Open it in Active Job to do the next step"><i class="fa-solid fa-arrow-up-right-from-square"></i> Do it</button></span></li>').join('') + '</ul>' + moreBtn(jobs.length, 'jobs') + '</div></div>';
            }
            if (r.inventory_not_loaded) h += '<p class="iba-ai-foot">' + esc(r.inventory_not_loaded) + ' more Active Job item' + (r.inventory_not_loaded === 1 ? '' : 's') + ' not loaded yet: open Active Job to see them.</p>';
            if (!tasks.length && !jobs.length) h += '<p class="iba-ai-empty"><i class="fa-solid fa-mug-hot"></i> Nothing is waiting for you.</p>';
            // the company, in short
            // 17.0.0 patch 21: one table with a header, like the status tables
            // (was tiles with a two-column list in the big window)
            const co = [];
            if (x.approvals) {
                const apv = x.approvals.items || [];
                const cnt = apvCounts(apv);
                const urg = apv.filter((a) => a.urgent).length;
                const total = apv.reduce((n, a) => n + num(a.value), 0);
                if (x.approvals.error) co.push('<div class="iba-ai-ttab-site"><div class="iba-ai-ttab-sitehead"><i class="fa-solid fa-stamp"></i> <b>Approvals</b><span>could not be read (' + esc(x.approvals.error) + ')</span></div></div>');
                else co.push('<div class="iba-ai-ttab-site"><div class="iba-ai-ttab-sitehead"><i class="fa-solid fa-stamp"></i> <b>Waiting for approval</b>' +
                    '<span class="iba-ai-ttab-count">' + apv.length + '</span>' +
                    (urg ? '<span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> ' + urg + ' urgent</span>' : '') +
                    '<span class="iba-ai-ttab-step">' + esc(Object.keys(cnt).sort((p, q) => cnt[q] - cnt[p]).slice(0, 4).map((k) => k + ' ' + cnt[k]).join(' · ') + (Object.keys(cnt).length > 4 ? ' · …' : '')) + '</span>' +
                    (total ? '<span class="iba-ai-ttab-total">QAR ' + esc(money(total)) + '</span>' : '') +
                    (apv.length ? '<span class="iba-ai-co-acts"><button type="button" class="iba-ai-mini" data-brief-apv-print title="One list, grouped by who is approving (or status / site)"><i class="fa-solid fa-print"></i> Print list</button>' +
                        (tplAllowed('urgent') ? '<button type="button" class="iba-ai-mini" data-run-tpl="urgent" title="Pick invoices to rush"><i class="fa-solid fa-bolt"></i> Mark urgent</button>' : '') + '</span>' : '') + '</div>' +
                    (apv.length ? '<ul class="iba-ai-rows iba-ai-ttab is-co" data-brief-list="co">' +
                        '<li class="iba-ai-ttab-head" aria-hidden="true"><span class="c-po">PO</span><span class="c-site">With</span><span class="c-main">Vendor · invoice · status</span><span class="c-age">Age</span><span class="c-act">Files</span></li>' +
                        apv.map((a, i) =>
                        '<li' + (i >= MORE ? ' hidden' : '') + (a.urgent ? ' class="is-urgent"' : '') + '><span class="c-po">' + poLink(a.po) + '</span>' +
                        '<span class="c-site">' + esc(a.with || '—') + '</span>' +
                        '<span class="iba-ai-grow c-main">' + esc(a.vendor || a.no || '—') + (a.urgent ? ' <span class="iba-ai-urg-badge"><i class="fa-solid fa-bolt"></i> URGENT</span>' : '') +
                        '<small>' + esc([a.no, a.status, a.value ? 'QAR ' + money(a.value) : ''].filter(Boolean).join(' · ')) + '</small>' +
                        (a.note ? '<small class="iba-ai-urg-note">' + esc(a.note.slice(0, 140)) + '</small>' : '') + '</span>' +
                        '<span class="c-age">' + ageChip(a.days) + '</span>' +
                        '<span class="c-act iba-ai-apv-files">' + (a.pdf ? '<a class="iba-ai-mini" href="' + esc(a.pdf) + '" target="_blank" rel="noopener" title="Open the invoice attachment"><i class="fa-regular fa-file-pdf"></i> INV</a>' : '') + srvLink(a.srv) + '</span></li>').join('') + '</ul>' +
                        moreBtn(apv.length, 'co') +
                        (x.approvals.more ? '<p class="iba-ai-foot">' + esc(x.approvals.more) + ' more not shown (the oldest ' + APV_LIMIT + ' are listed).</p>' : '') : '') + '</div>');
            }
            if (r.po_closeout || r.po_closeout_loading) co.push('<div class="iba-ai-ttab-site"><div class="iba-ai-ttab-sitehead"><i class="fa-solid fa-box-archive"></i> <b>PO Close Out</b><span class="iba-ai-ttab-step" data-co-foot>' +
                (r.po_closeout ? esc(r.po_closeout.ready_to_close) + ' ready to close · ' + esc(r.po_closeout.waiting_site) + ' waiting at site' : 'counting…') + '</span></div></div>');
            if (co.length) h += '<div class="iba-ai-co"><div class="iba-ai-sub"><i class="fa-solid fa-building"></i> In the company</div><div class="iba-ai-ttab-wrap">' + co.join('') + '</div></div>';
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
        } else if (card.kind === 'transfer') {
            d.innerHTML = transferHtml(x);
        } else if (card.kind === 'trf_find') {
            d.innerHTML = transferFindHtml(x);
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
        } else if (card.kind === 'person') {
            const ps = x.people || [];
            // 15.0.0 patch 41: you never message yourself
            const meA = me() || {};
            const isMe = (q) => !!q && ((meA.key && String(q.key) === String(meA.key)) || (myName() && norm(q.name) === norm(myName())));
            const tel = (m) => { const d = String(m || '').replace(/\D+/g, ''); return d ? (d.length === 8 ? '+974' + d : '+' + d.replace(/^00/, '')) : ''; };
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-id-badge"></i> ' + (ps.length ? (ps.length === 1 ? 'Profile' : ps.length + ' people found') : 'Nobody found') + (ps.length > 1 && x.q ? ' · ' + esc(x.q) : '') + '</div>' +
                (ps.length ? ps.map((p) => '<div class="iba-ai-person">' +
                    '<div class="iba-ai-person-top"><span class="iba-ai-avatar">' + esc(p.name.split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()) + '</span>' +
                    '<span class="iba-ai-grow"><strong>' + esc(p.name) + '</strong><small>' + esc([p.position, p.role && p.role !== p.position ? p.role : ''].filter(Boolean).join(' · ') || '—') + '</small></span>' +
                    (p.status ? '<span style="flex:0 0 auto;align-self:flex-start;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;' + (p.status === 'On vacation' ? 'background:rgba(245,158,11,.18);color:#FBBF24;-webkit-text-fill-color:#FBBF24;border:1px solid rgba(245,158,11,.45)' : 'background:rgba(34,197,94,.15);color:#4ADE80;-webkit-text-fill-color:#4ADE80;border:1px solid rgba(34,197,94,.4)') + '">' + (p.status === 'On vacation' ? '<i class="fa-solid fa-umbrella-beach"></i> On vacation' : '<i class="fa-solid fa-circle-check"></i> Active') + '</span>' : '') + '</div>' +
                    (p.status === 'On vacation' ? '<p style="margin:6px 0 0;font-size:12px;color:#FCD34D;-webkit-text-fill-color:#FCD34D">' + esc((p.back ? 'Back on ' + p.back : 'Return date not set') + ' · ' + (p.replacement ? 'Replacement: ' + p.replacement : 'No replacement set - tasks go to Irwin')) + '</p>' : '') +
                    (p.rep ? '<div style="margin:8px 0 2px;padding:8px 10px;border-radius:10px;border:1px dashed rgba(245,158,11,.5);background:rgba(245,158,11,.07)">' +
                        '<div style="font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#FCD34D;-webkit-text-fill-color:#FCD34D">Contact instead</div>' +
                        '<div style="margin:2px 0 6px;font-size:13px"><strong>' + esc(p.rep.name) + '</strong>' + (p.rep.position ? ' · ' + esc(p.rep.position) : '') +
                        (p.rep.mobile ? ' · <a href="tel:' + esc(tel(p.rep.mobile)) + '">' + esc(p.rep.mobile) + '</a>' : '') + (p.rep.email ? ' · <a href="mailto:' + esc(p.rep.email) + '">' + esc(p.rep.email) + '</a>' : '') + '</div>' +
                        '<div class="iba-ai-person-acts">' + (isMe(p.rep) ? '<span class="iba-ai-me-tag"><i class="fa-solid fa-user"></i> You are the replacement</span>' : '<button type="button" class="iba-ai-mini is-main" data-dm-key="' + esc(p.rep.key) + '" data-dm-name="' + esc(p.rep.name) + '"><i class="fa-solid fa-comments"></i> Message ' + esc(p.rep.name.split(/\s+/)[0]) + '</button>') +
                        (p.rep.mobile ? '<a class="iba-ai-mini" href="https://wa.me/' + esc(tel(p.rep.mobile).replace('+', '')) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>' : '') + '</div></div>' : '') +
                    (p.covering && p.covering.length ? '<p style="margin:6px 0 0;font-size:12px;color:#93C5FD;-webkit-text-fill-color:#93C5FD">Covering for ' + esc(p.covering.join(', ')) + ' (on vacation)</p>' : '') +
                    '<dl class="iba-ai-person-dl">' +
                      '<dt>Site</dt><dd>' + esc(p.site || '—') + '</dd>' +
                      '<dt>Mobile</dt><dd>' + (p.mobile ? '<a href="tel:' + esc(tel(p.mobile)) + '">' + esc(p.mobile) + '</a>' : '—') + '</dd>' +
                      '<dt>Email</dt><dd>' + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '—') + '</dd>' +
                    '</dl>' +
                    '<div class="iba-ai-person-acts">' + (isMe(p) ? '<span class="iba-ai-me-tag"><i class="fa-solid fa-user"></i> This is you</span>' : '<button type="button" class="iba-ai-mini is-main" data-dm-key="' + esc(p.key) + '" data-dm-name="' + esc(p.name) + '"><i class="fa-solid fa-comments"></i> Message in IBA</button>') +
                    (p.mobile && !isMe(p) ? '<a class="iba-ai-mini" href="https://wa.me/' + esc(tel(p.mobile).replace('+', '')) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>' : '') + '</div>' +
                    '</div>').join('') : '<p class="iba-ai-empty">No user matches "' + esc(x.q) + '".</p>');
        } else if (card.kind === 'recent') {
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-clock-rotate-left"></i> ' + esc(x.rows.length) + ' found · ' + esc(x.label) + '</div>' +
                (x.rows.length ? '<ul class="iba-ai-rows">' + x.rows.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc(r.invoice_no) + (r.vendor ? ' · ' + esc(r.vendor) : '') +
                    '<small>' + esc([r.status, r.changed_at, r.changed_by ? 'by ' + r.changed_by : '', r.with ? 'with ' + r.with : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>'
                    : '<p class="iba-ai-empty">No invoice was moved to this status in that time.</p>');
        } else if (card.kind === 'export') {
            let href = '';
            try { href = (typeof window.ibaCsvHref === 'function') ? window.ibaCsvHref(x.csv) : URL.createObjectURL(new Blob(['\uFEFF' + x.csv], { type: 'text/csv;charset=utf-8' })); } catch (_) {}
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-file-csv"></i> ' + esc(x.label) + '</div>' +
                '<div class="iba-ai-stats"><div><b>' + esc(x.found) + '</b><span>Invoices</span></div><div><b>' + esc(x.pos) + '</b><span>POs</span></div><div><b>' + esc(x.total_value) + '</b><span>Value (QAR)</span></div></div>' +
                (x.rows.length ? '<ul class="iba-ai-rows">' + x.rows.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc(r.invoice_no || r.entry) + (r.vendor ? ' · ' + esc(r.vendor) : '') +
                    '<small>' + esc([r.file ? 'File: ' + r.file : 'No file name yet', money(r.value), r.since ? 'since ' + r.since : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' +
                    (x.found > x.rows.length ? '<p class="iba-ai-foot">+ ' + esc(x.found - x.rows.length) + ' more in the file</p>' : '') : '<p class="iba-ai-empty">' + esc(x.note || 'Nothing found.') + '</p>') +
                (x.found && href ? '<p class="iba-ai-foot"><a class="iba-ai-mini is-main" href="' + esc(href) + '" download="' + esc(x.file) + '"><i class="fa-solid fa-download"></i> Download CSV (' + esc(x.found) + ')</a></p>' : '') +
                '<p class="iba-ai-foot">Data: ' + esc(x.source) + '</p>';
        } else if (card.kind === 'batch') {
            const added = x.added || [], already = x.already_in_batch || [], na = x.not_added || [];
            const f = x.filled || {};
            const fill = [f.status ? 'Status: ' + f.status : '', f.attention ? 'Attention: ' + f.attention : '', f.note ? 'Note: ' + f.note : ''].filter(Boolean).join(' · ');
            d.innerHTML = '<div class="iba-ai-card-head"><i class="fa-solid fa-layer-group"></i> Batch Entry · ' + esc(added.length) + ' added' + (x.status_filter ? ' (' + esc(x.status_filter) + ')' : '') + '<span class="iba-ai-badge">Not saved</span></div>' +
                (added.length ? '<ul class="iba-ai-rows">' + added.map((r) => '<li>' + poLink(r.po) + '<span class="iba-ai-grow">' + esc(r.invoice_no) + '<small>' + esc([r.status, r.changed_at, r.changed_by ? 'by ' + r.changed_by : '', r.with ? 'with ' + r.with : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>' : '') +
                (x.found === 0 || (x.window && !added.length && !already.length) ? '<p class="iba-ai-empty">No invoice was moved to this status in that time.</p>' : '') +
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

    // 15.0.0 patch 27: skills as tap tiles (like the phone home):
    // a short line and a colour for each ready-made skill
    const SKILL_LOOK = {
        inv_status: ['Where is it, who has it', '#2a78d6'], transfer: ['Who must act next', '#1f9d7a'], person: ['Message, call, email', '#e46b2c'], site_team: ['Site DC, Storekeeper at a site', '#0f766e'],
        brief: ['Today\'s tasks and reminders', '#d39b12'], reception_batch: ['Reception entries into Batch', '#0d7e85'], batch: ['POs into Batch Entry', '#7a4bb3'], weekly: ['Meeting report by site', '#c2410c'],
        site_list: ['For SRV by site, to print', '#2563eb'], dbcheck: ['Indexes that keep downloads small', '#475569'], handover: ['See / undo moved tasks', '#9333ea'], urgent: ['Rush approvals (COO / CEO)', '#dc2626'],
        export: ['CSV for Excel', '#15803d'], recent: ['Moved lately, into Batch', '#0e7490'],
        new_job: ['PO in, form filled', '#138A97'], new_delivery: ['Transfer, Restock, Return, Usage', '#0f9f6e'],
        po_report: ['Value, invoiced, paid, remaining', '#2a78d6'], approvals_list: ['Grouped list to print', '#b45309']
    };
    // 15.0.0 patch 45: skills in groups, most used on top, with a search box
    const SKILL_GROUPS = [
        ['Quick work', ['new_job', 'new_delivery', 'brief', 'reception_batch']],
        ['Find and track', ['inv_status', 'transfer', 'person', 'site_team']],
        ['Approvals', ['approvals_list', 'urgent']],
        ['Reports and lists', ['po_report', 'weekly', 'site_list', 'export', 'recent', 'batch']],
        ['Admin tools', ['handover', 'dbcheck']]
    ];
    function skillTile(attr, icon, name, sub, color, title, extra) {
        return '<div class="iba-ai-tile-wrap"><button type="button" class="iba-ai-tile" ' + attr + ' style="--c:' + color + '" title="' + esc(title || '') + '">' +
            '<i class="fa-solid ' + icon + '"></i><b>' + esc(name) + '</b><small>' + esc(sub) + '</small></button>' + (extra || '') + '</div>';
    }
    function renderSkills() {
        const box = $('iba-ai-skills');
        const list = skills();
        const tpls = Object.keys(SKILL_TPL).filter(tplAllowed);
        const asks = (s) => s.tpl ? (SKILL_TPL[s.tpl] ? SKILL_TPL[s.tpl].ask().map((p) => p.label) : []) : skillParams(s).map((p) => p.label);
        const tplTile = (id) => { const t = SKILL_TPL[id], l = SKILL_LOOK[id] || [t.desc, '#2a78d6'];
            return skillTile('data-run-tpl="' + id + '" data-find="' + esc(norm(t.name + ' ' + l[0] + ' ' + t.desc)) + '"', t.icon, t.name, l[0], l[1], t.desc, t.superOnly || t.adminOnly ? '<span class="iba-ai-tile-admin" title="' + (t.superOnly ? 'Super Admin only' : 'Admins only') + '"><i class="fa-solid fa-shield-halved"></i></span>' : ''); };
        const use = lsGet(skillUseKey(), {}) || {};
        const top = tpls.filter((id) => (Number(use[id]) || 0) >= 2).sort((a, b) => use[b] - use[a]).slice(0, 4);
        const grouped = new Set();
        const groups = SKILL_GROUPS.map((g) => { const ids = g[1].filter((id) => tpls.indexOf(id) !== -1); ids.forEach((id) => grouped.add(id)); return [g[0], ids]; });
        const rest = tpls.filter((id) => !grouped.has(id));
        if (rest.length) groups.push(['More', rest]);
        box.innerHTML = '<h3><i class="fa-solid fa-bolt"></i> Skills</h3>' +
            '<p class="iba-ai-help">One click does the job, without the AI (no key, no quota). A skill asks for what it needs each time.</p>' +
            '<label class="iba-ai-skill-find"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="iba-ai-skill-find" placeholder="Find a skill, e.g. delivery, approval, report" autocomplete="off"></label>' +
            (top.length ? '<div class="iba-ai-skill-group" data-group><div class="iba-ai-sub"><i class="fa-solid fa-star"></i> Most used</div><div class="iba-ai-tiles">' + top.map(tplTile).join('') + '</div></div>' : '') +
            groups.filter((g) => g[1].length).map((g) => '<div class="iba-ai-skill-group" data-group><div class="iba-ai-sub">' + esc(g[0]) + '</div><div class="iba-ai-tiles">' + g[1].map(tplTile).join('') + '</div></div>').join('') +
            '<p class="iba-ai-empty" id="iba-ai-skill-none" hidden>No skill matches that.</p>' +
            '<div class="iba-ai-sub">My skills</div>' +
            (list.length ? '<div class="iba-ai-tiles">' + list.map((s) => {
                const t = s.tpl && SKILL_TPL[s.tpl], l = (s.tpl && SKILL_LOOK[s.tpl]) || ['', '#475569'];
                const sub = t ? t.name : (s.steps || []).length + ' step' + ((s.steps || []).length === 1 ? '' : 's') + (asks(s).length ? ' · asks ' + asks(s).join(', ') : '');
                return skillTile('data-run-skill="' + esc(s.name) + '"', t ? t.icon : 'fa-bolt', s.name, sub, l[1], (t ? t.desc : s.prompt) + ' · saved ' + fmtDate(s.at),
                    '<button type="button" class="iba-ai-tile-del" data-del-skill="' + esc(s.name) + '" title="Delete this skill" aria-label="Delete ' + esc(s.name) + '"><i class="fa-solid fa-xmark"></i></button>');
            }).join('') + '</div>'
            : '<p class="iba-ai-empty"><i class="fa-solid fa-bolt"></i> No skills of your own yet.</p>') +
            '<details class="iba-ai-skill-add"><summary><i class="fa-solid fa-plus"></i> Add your own skill</summary>' +
            '<form class="iba-ai-skill-new" id="iba-ai-skill-new" autocomplete="off">' +
              '<input type="text" id="iba-ai-skill-name" maxlength="60" placeholder="Name, e.g. Status of my site invoices" required>' +
              '<select id="iba-ai-skill-tpl">' + tpls.map((id) => '<option value="' + id + '">' + esc(SKILL_TPL[id].name) + '</option>').join('') + '</select>' +
              '<button type="submit" class="iba-ai-mini is-main"><i class="fa-solid fa-plus"></i> Add</button>' +
            '</form>' +
            '<p class="iba-ai-help small">Or ask me something, then press "Save as skill" under my answer to keep exactly those steps.</p></details>';
        const find = $('iba-ai-skill-find');
        if (find) find.addEventListener('input', () => {
            const q = norm(find.value);
            let shown = 0;
            box.querySelectorAll('[data-group]').forEach((g) => {
                let n = 0;
                g.querySelectorAll('[data-find]').forEach((t) => { const ok = !q || t.dataset.find.indexOf(q) !== -1; t.closest('.iba-ai-tile-wrap').hidden = !ok; if (ok) n++; });
                g.hidden = !n; shown += n;
            });
            const none = $('iba-ai-skill-none');
            if (none) none.hidden = !!shown || !q;
        });
        const form = $('iba-ai-skill-new');
        if (form) form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (addTplSkill($('iba-ai-skill-name').value, $('iba-ai-skill-tpl').value)) renderSkills();
        });
    }

    function brainHelpHtml(b) {
        let h = esc(b.keyHelp) + (b.keyUrl ? ' <a href="' + esc(b.keyUrl) + '" target="_blank" rel="noopener">Open <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '');
        if (b.setupFile) h += '<div class="iba-ai-setupfile"><button type="button" class="iba-ai-btn is-main" data-ollama-bat><i class="fa-solid fa-download"></i> Download setup file (Windows)</button>' +
            '<small>It installs Ollama if needed, allows this website to use it, and downloads the AI (one time, 3-5 GB). If the browser later asks to allow access to devices on your network, press Allow.</small></div>';
        if (b.guide && b.guide.length) h += (b.setupFile ? '<details class="iba-ai-manual"><summary>Or do it by hand</summary>' : '') + '<ol class="iba-ai-guide">' + b.guide.map((g) => '<li>' + esc(g) + '</li>').join('') + '</ol>' + (b.setupFile ? '</details>' : '');
        return h;
    }
    // 15.0.0 patch 25: a Windows setup file for Ollama (one double-click)
    function ollamaBat() {
        const origin = location.origin && /^https?:/.test(location.origin) ? location.origin : 'https://port.iba.com.qa';
        const origins = origin + ',http://localhost,http://127.0.0.1';
        return [
            '@echo off',
            'title IBA Assistant - free AI on this PC (Ollama)',
            'echo.',
            'echo  IBA Assistant - setting up the free AI on this PC (Ollama)',
            'echo  This is done once. Keep this window open until it says DONE.',
            'echo.',
            'set "OLLAMA_EXE="',
            'where ollama >nul 2>nul && set "OLLAMA_EXE=ollama"',
            'if not defined OLLAMA_EXE if exist "%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe" set "OLLAMA_EXE=%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe"',
            'if defined OLLAMA_EXE goto have',
            'echo [1/4] Installing Ollama (a few minutes)...',
            'winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements',
            'if exist "%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe" (set "OLLAMA_EXE=%LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe" & goto have)',
            'echo Could not install it automatically. The download page will open: install Ollama, then run this file again.',
            'start https://ollama.com/download',
            'pause',
            'exit /b 1',
            ':have',
            'echo [1/4] Ollama is installed.',
            'echo [2/4] Allowing the IBA website to use it...',
            'setx OLLAMA_ORIGINS "' + origins + '" >nul',
            'set "OLLAMA_ORIGINS=' + origins + '"',
            'echo [3/4] Restarting Ollama...',
            'taskkill /f /im "ollama app.exe" >nul 2>nul',
            'taskkill /f /im ollama.exe >nul 2>nul',
            'timeout /t 2 /nobreak >nul',
            'if exist "%LOCALAPPDATA%\\Programs\\Ollama\\ollama app.exe" (start "" "%LOCALAPPDATA%\\Programs\\Ollama\\ollama app.exe") else (start "Ollama" /min "%OLLAMA_EXE%" serve)',
            'timeout /t 6 /nobreak >nul',
            'set "MODEL=qwen3:8b"',
            'for /f %%a in (\'powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)"\') do set "RAM=%%a"',
            'if defined RAM if %RAM% LSS 14 set "MODEL=qwen3:4b"',
            'echo [4/4] Downloading the AI model %MODEL% (one time, a few GB)...',
            '"%OLLAMA_EXE%" pull %MODEL%',
            'echo.',
            'echo  DONE. Go back to IBA: Assistant ^> Setup ^> Brain = Ollama ^> Find models ^> Save ^> Test.',
            'echo.',
            'pause',
            ''
        ].join('\r\n');
    }
    function downloadOllamaBat() {
        try {
            const url = URL.createObjectURL(new Blob([ollamaBat()], { type: 'application/octet-stream' }));
            const a = document.createElement('a');
            a.href = url; a.download = 'IBA-Ollama-Setup.bat';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (_) {}
    }
    function renderSetup() {
        const box = $('iba-ai-setup');
        const c = getCfg();
        const b = BRAINS[c.brain];
        box.innerHTML = '<h3><i class="fa-solid fa-gear"></i> Setup</h3>' +
            '<label class="iba-ai-field"><span>Brain</span><select id="iba-ai-brain-pick">' + Object.keys(BRAINS).map((k) =>
                '<option value="' + k + '"' + (k === c.brain ? ' selected' : '') + '>' + esc(BRAINS[k].label) + (k === 'groq' ? ' — recommended' : '') + '</option>').join('') + '</select></label>' +
            '<div class="iba-ai-help" id="iba-ai-key-help">' + brainHelpHtml(b) + '</div>' +
            '<label class="iba-ai-field" id="iba-ai-key-row"' + (b.needsKey ? '' : ' hidden') + '><span>API key</span><input id="iba-ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste the key here" value="' + esc(c.key) + '"/></label>' +
            '<label class="iba-ai-field"><span>Model</span><span class="iba-ai-model-row"><input id="iba-ai-model" type="text" spellcheck="false" list="iba-ai-models" value="' + esc(c.model) + '"/>' +
              '<button type="button" class="iba-ai-btn" id="iba-ai-models-btn" title="Ask the service which models your key can use, and pick a good one"><i class="fa-solid fa-list"></i> Find models</button></span></label>' +
            '<datalist id="iba-ai-models"></datalist>' +
            '<label class="iba-ai-field"><span>Address</span><input id="iba-ai-url" type="text" spellcheck="false" value="' + esc(c.baseUrl) + '"/></label>' +
            (isSuper() ? '<label class="iba-ai-field"><span>Who can use the assistant</span><select id="iba-ai-aud">' +
                '<option value="everyone"' + (audience !== 'me' ? ' selected' : '') + '>Everyone (brief, reminders and tracking need no key)</option>' +
                '<option value="me"' + (audience === 'me' ? ' selected' : '') + '>Only me</option></select></label>' : '') +
            '<div class="iba-ai-setup-actions"><button type="button" class="iba-ai-btn is-main" id="iba-ai-save"><i class="fa-solid fa-floppy-disk"></i> Save</button>' +
            '<button type="button" class="iba-ai-btn" id="iba-ai-test"><i class="fa-solid fa-plug-circle-check"></i> Test</button></div>' +
            '<p class="iba-ai-status" id="iba-ai-setup-status"></p>' +
            '<h3 class="iba-ai-look-h"><i class="fa-solid fa-robot"></i> Look and voice</h3>' +
            '<label class="iba-ai-check"><input type="checkbox" id="iba-ai-look-bot"' + (look().bot ? ' checked' : '') + '/> Animated assistant (the little engineer robot in the corner)</label>' +
            '<label class="iba-ai-check"><input type="checkbox" id="iba-ai-look-tips"' + (look().tips ? ' checked' : '') + '/> Speech bubbles ("Hi, I\'m here if you need me" and tips)</label>' +
            (canSpeak() ? '<label class="iba-ai-check"><input type="checkbox" id="iba-ai-look-voice"' + (look().voice ? ' checked' : '') + '/> Read answers and the brief aloud</label>' +
                '<button type="button" class="iba-ai-btn" id="iba-ai-voice-test"><i class="fa-solid fa-volume-high"></i> Test voice</button>' : '<p class="iba-ai-help small">This browser cannot speak. Chrome or Edge can.</p>') +
            '<p class="iba-ai-help small"><i class="fa-solid fa-lock"></i> This key is yours: it stays only in this browser, for your account. It is not saved in the system or in Firebase, and nobody else uses it. ' +
            'The assistant reads only what a job needs and never saves, approves or deletes anything by itself.</p>';
        const lb = $('iba-ai-look-bot'), lv = $('iba-ai-look-voice'), vt = $('iba-ai-voice-test');
        if (lb) lb.addEventListener('change', () => { setLook({ bot: lb.checked }); paintFab($('iba-ai-fab')); });
        const lt = $('iba-ai-look-tips');
        if (lt) lt.addEventListener('change', () => { setLook({ tips: lt.checked }); if (!lt.checked) hideTip(); });
        if (lv) lv.addEventListener('change', () => { setLook({ voice: lv.checked }); if (!lv.checked) stopSpeak(); });
        if (vt) vt.addEventListener('click', () => speak(greetingWord() + ', ' + firstName() + '. I am your IBA assistant. I can read your brief and my answers aloud.'));
        const pick = $('iba-ai-brain-pick');
        pick.addEventListener('change', () => {
            const nb = BRAINS[pick.value];
            $('iba-ai-model').value = nb.model;
            $('iba-ai-url').value = nb.baseUrl;
            $('iba-ai-key-row').hidden = !nb.needsKey;
            const saved = lsGet(cfgKey(), {}) || {};
            $('iba-ai-key').value = saved.brain === pick.value ? (saved.key || '') : '';
            $('iba-ai-key-help').innerHTML = brainHelpHtml(nb);
            const st0 = $('iba-ai-setup-status'); if (st0) { st0.className = 'iba-ai-status'; st0.textContent = ''; }
            if (pick.value === 'ollama') setTimeout(() => findModels(true), 50); // already installed? fill the model
        });
        // 15.0.0 patch 25: a pasted key picks its service; Find models fills the list
        const keyEl = $('iba-ai-key');
        const stEl = () => $('iba-ai-setup-status');
        let msgSeq = 0; // a newer action (e.g. Test) wins the status line
        const findModels = async (quiet) => {
            const mySeq = ++msgSeq;
            const cfgNow = { brain: pick.value, key: String(keyEl.value || '').trim(), baseUrl: String($('iba-ai-url').value || '').trim().replace(/\/+$/, '') };
            if (!cfgNow.baseUrl || (BRAINS[cfgNow.brain].needsKey && !cfgNow.key)) { if (!quiet) { stEl().className = 'iba-ai-status is-bad'; stEl().textContent = 'Paste the key (and the address for "Other") first.'; } return null; }
            const st = stEl();
            if (!quiet) { st.className = 'iba-ai-status'; st.textContent = 'Asking ' + BRAINS[cfgNow.brain].label + ' which models your key can use…'; }
            try {
                const ids = await listModels(cfgNow);
                if (quiet && mySeq !== msgSeq) return null;
                const dl = $('iba-ai-models');
                if (dl) dl.innerHTML = ids.filter((m) => !MODEL_SKIP.test(m)).slice(0, 200).map((m) => '<option value="' + esc(m) + '"></option>').join('');
                const cur = String($('iba-ai-model').value || '').trim();
                const best = pickModel(cfgNow.brain, ids, cur);
                if (best) $('iba-ai-model').value = best;
                if (!ids.length) return null;
                st.className = 'iba-ai-status is-ok';
                st.textContent = ids.length + ' models found. Using "' + best + '"' + (cur && best !== cur ? ' ("' + cur + '" is not available for this key)' : '') + '. You can pick another from the list. Press Save.';
                return { ids: ids, model: best };
            } catch (err) {
                if (quiet) return null; // automatic look-up: Test reports problems
                st.className = 'iba-ai-status is-bad';
                st.textContent = 'Could not get the model list: ' + ((err && err.message) || err) + (cfgNow.brain === 'ollama' ? ' Is Ollama running? Run the setup file once.' : ' Check the key.');
                return null;
            }
        };
        let keyTimer = 0;
        const onKey = () => {
            clearTimeout(keyTimer);
            keyTimer = setTimeout(() => {
                const k = String(keyEl.value || '').trim();
                if (!k) return;
                const guess = brainOfKey(k);
                if (guess && guess !== pick.value && !(guess === 'openai' && pick.value === 'custom')) {
                    pick.value = guess;
                    const nb = BRAINS[guess];
                    $('iba-ai-model').value = nb.model; $('iba-ai-url').value = nb.baseUrl;
                    $('iba-ai-key-row').hidden = !nb.needsKey;
                    $('iba-ai-key-help').innerHTML = brainHelpHtml(nb);
                    stEl().className = 'iba-ai-status'; stEl().textContent = 'This is a ' + nb.label + ' key - switched to ' + nb.label + '.';
                }
                findModels(true);
            }, 450);
        };
        keyEl.addEventListener('input', onKey);
        keyEl.addEventListener('paste', () => setTimeout(onKey, 0));
        $('iba-ai-models-btn').addEventListener('click', () => findModels(false));
        $('iba-ai-key-help').addEventListener('click', (e) => { if (e.target.closest('[data-ollama-bat]')) downloadOllamaBat(); });
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
            clearTimeout(keyTimer); msgSeq++;
            save();
            const st = $('iba-ai-setup-status');
            const cfg = getCfg();
            st.className = 'iba-ai-status';
            // 15.0.0 patch 24: Google now also gives keys that do not start with
            // "AIza" (newer AI Studio keys). The key is no longer judged by its
            // first letters: Test asks Google, which says if it is accepted.
            if (cfg.brain === 'gemini' && cfg.key && /\s/.test(cfg.key)) {
                st.className = 'iba-ai-status is-bad';
                st.textContent = 'The key has a space or line break inside. Copy it again with the copy button in Google AI Studio and paste it here.';
                return;
            }
            if (cfg.brain === 'gemini' && cfg.key && /^\.\.\./.test(cfg.key)) {
                st.className = 'iba-ai-status is-bad';
                st.textContent = 'That is only the end of the key as the list shows it. In Google AI Studio press the copy button on the key row, then paste the whole key here.';
                return;
            }
            st.textContent = 'Testing the key…';
            try {
                const m = await callBrain([{ role: 'system', content: 'Reply with exactly: OK' }, { role: 'user', content: 'Test' }], false);
                // 15.0.0 patch 9: also test a real question with the tools, as the chat uses them
                st.textContent = 'Key works. Testing a real question…';
                await callBrain([{ role: 'system', content: 'Answer in one word.' }, { role: 'user', content: 'Say OK.' }], true);
                st.className = 'iba-ai-status is-ok';
                st.textContent = 'Working. The brain answered: ' + String(m.content || '').trim().slice(0, 60) + ' - questions with tools work too.';
            } catch (err0) {
                let err = err0;
                // 15.0.0 patch 25: the model was retired or not offered to this key:
                // pick one from the service's own list and try again once
                if (err && /was not found|not found|does not exist|not available|decommission|deprecat/i.test(err.message || '') && !err.rate && !err.network) {
                    const got = await findModels(true);
                    if (got && got.model) {
                        save();
                        try {
                            await callBrain([{ role: 'system', content: 'Answer in one word.' }, { role: 'user', content: 'Say OK.' }], true);
                            st.className = 'iba-ai-status is-ok';
                            st.textContent = 'Working with model "' + got.model + '" (the old model name is no longer offered). Saved.';
                            return;
                        } catch (err2) { err = err2; }
                    }
                }
                st.className = 'iba-ai-status is-bad';
                st.textContent = (err && err.rate) ? 'The key works, but the free limit is used up for now. Try again in a minute.'
                    : (err && err.network) ? ((err && err.message) || 'Could not reach the service.')
                    : ((err && err.message) || String(err));
            }
        });
    }

    // ---- greeting, peek and the daily brief ---------------------------
    function greetingWord() { const h = qatarParts().h; return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
    function firstName() { return (myName().split(/\s+/)[0]) || ''; }
    function greetIfEmpty(force) {
        const l = log();
        if (!l || (l.children.length && !force)) return;
        if (!ready() && !isSuper()) {
            // 15.0.0 patch 10: without a key, only show what works without one.
            addBot(greetingWord() + ', ' + firstName() + '. Here is what I can do for you, no key needed:\n- Sun button: today\'s brief, your tasks and reminders\n- Route button: where an invoice or a transfer (TRF, STK, USE, RET) is\n- Type a transfer number, e.g. "TRF-0361"\nTo ask in plain words, add a free key in Setup (gear button).', {});
            const l0 = l.lastElementChild;
            if (l0) { const t = l0.querySelector('.iba-ai-msg-tools'); if (t) t.remove(); }
            return;
        }
        addBot(greetingWord() + ', ' + firstName() + '. How can I help?\n' + (isSuper()
            ? '- "What\'s waiting for me?"\n- "Show PO 12345"\n- "Where is the Al Noor invoice for site 177, 2025?"\n- "New invoice for PO 12345: B-300, 5,000, For SRV to Bob"\n- "Draft a reminder to Bob about PO 12345"'
            : '- "Where is the invoice for PO 12345?"\n- "Al Noor invoices, site 177, 2025"\n- "What\'s waiting for me?"\n- "Draft a reminder to Bob about PO 12345"\nNo key needed: the sun button shows today\'s tasks and reminders, the route button tracks invoices and transfers.'), {});
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
            const setup = !ready() && isSuper();
            const remN = remList.filter((r) => !r.seenAt).length;
            if (remN) line += ' <b>' + remN + '</b> reminder' + (remN === 1 ? '' : 's') + ' for you.';
            showBubble('<i class="fa-solid fa-wand-magic-sparkles"></i><div class="iba-ai-bubble-text"><strong>' + esc(greetingWord()) + ', ' + esc(firstName()) + '.</strong> ' + line +
                (setup ? '<br><small>Plain-word questions need a free key (Setup, 2 minutes).</small>' : '') + '</div>' +
                '<div class="iba-ai-bubble-actions"><button type="button" data-bubble="open" data-then="brief">Open brief</button>' +
                (setup ? '<button type="button" data-bubble="open" data-then="setup">Set up</button>' : '') +
                '<button type="button" data-bubble="x" title="Dismiss">×</button></div>', 20000);
        };
        setTimeout(tick, 4000);
    }

    function pillCount() {
        let n = 0;
        document.querySelectorAll('#iba-live-counts .iba-live-pill[data-count]').forEach((p) => { if (!p.hidden) n += Number(p.getAttribute('data-count')) || 0; });
        return n;
    }
    // ------------------------------------------------------------------
    // 15.0.0 patch 11: the animated assistant (a small robot drawn in SVG,
    // animated with CSS only; it pauses when the tab is in the background and
    // follows "reduce motion") and its voice (the browser's own speech: free,
    // no key). Desktop only, like the rest of the assistant.
    // ------------------------------------------------------------------
    const LOOK_KEY = 'iba-ai-look-v1';
    function look() { const v = lsGet(LOOK_KEY, {}) || {}; return { bot: v.bot !== false, voice: v.voice === true, tips: v.tips !== false }; }
    function setLook(p) { lsSet(LOOK_KEY, Object.assign(look(), p || {})); }
    // 15.0.0 patch 15: the robot is now a site engineer - yellow hard hat
    // with a lamp, orange hi-vis vest with reflective stripes, ID badge and
    // safety boots. Same animations (float, blink, look, wave, talk).
    const BOT_SVG =
        '<svg class="iba-ai-bot" viewBox="0 0 80 96" aria-hidden="true" focusable="false">' +
          '<defs><linearGradient id="ibaBotHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B6F84"/><stop offset="1" stop-color="#14364F"/></linearGradient>' +
          '<linearGradient id="ibaBotHat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".55" stop-color="#FACC15"/><stop offset="1" stop-color="#D99A06"/></linearGradient>' +
          '<linearGradient id="ibaBotVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB923C"/><stop offset="1" stop-color="#EA580C"/></linearGradient></defs>' +
          '<ellipse class="bot-shadow" cx="40" cy="92" rx="20" ry="3"/>' +
          '<g class="bot-all">' +
            '<g class="bot-legs"><rect x="30" y="78" width="7" height="9" rx="3"/><rect x="43" y="78" width="7" height="9" rx="3"/></g>' +
            '<g class="bot-boots"><rect x="27" y="85" width="11" height="5" rx="2.2"/><rect x="42" y="85" width="11" height="5" rx="2.2"/></g>' +
            '<path class="bot-arm bot-arm-l" d="M26 62 q-8 4 -7 13" />' +
            '<path class="bot-arm bot-arm-r" d="M54 62 q8 4 7 13" />' +
            '<rect class="bot-torso" x="24" y="57" width="32" height="24" rx="9"/>' +
            '<path class="bot-vest" d="M24 66 q0 -9 9 -9 h3 l4 9 l4 -9 h3 q9 0 9 9 v6 q0 9 -9 9 h-14 q-9 0 -9 -9 z"/>' +
            '<rect class="bot-stripe" x="24" y="68" width="32" height="2.6"/><rect class="bot-stripe" x="24" y="74" width="32" height="2.6"/>' +
            '<rect class="bot-heart" x="27.5" y="60.5" width="6" height="4.5" rx="1"/>' +
            '<g class="bot-head">' +
              '<circle class="bot-ear" cx="15" cy="42" r="4.2"/><circle class="bot-ear" cx="65" cy="42" r="4.2"/>' +
              '<rect class="bot-skull" x="16" y="26" width="48" height="33" rx="14"/>' +
              '<rect class="bot-visor" x="22" y="32" width="36" height="20" rx="10"/>' +
              '<g class="bot-eyes"><rect class="bot-eye" x="29" y="37" width="6" height="9" rx="3"/><rect class="bot-eye" x="45" y="37" width="6" height="9" rx="3"/></g>' +
              '<path class="bot-mouth" d="M36 48 q4 3 8 0"/>' +
              '<path class="bot-hat" d="M15 30 Q15 7 40 7 Q65 7 65 30 Z"/>' +
              '<rect class="bot-ridge" x="36.5" y="7.5" width="7" height="22" rx="3.5"/>' +
              '<rect class="bot-brim" x="10" y="27.5" width="60" height="5" rx="2.5"/>' +
              '<circle class="bot-bulb" cx="40" cy="18" r="3.2"/>' +
            '</g>' +
          '</g>' +
        '</svg>';
    function paintFab(fab) {
        if (!fab) return;
        const bot = look().bot;
        fab.classList.toggle('is-bot', bot);
        fab.innerHTML = (bot ? BOT_SVG : '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>') + '<span class="iba-ai-fab-dot" aria-hidden="true"></span>';
        // 15.0.0 patch 27: on the phone only the robot's head shows, in a round bubble
        fab.dataset.mode = onPhone() ? 'phone' : 'desk';
        const svg = fab.querySelector('svg.iba-ai-bot');
        if (svg && onPhone()) svg.setAttribute('viewBox', '10 4 60 60');
        placePhoneFab(fab);
    }
    // ------------------------------------------------------------------
    // 15.0.0 patch 27: phone "bubble head" - floats over the screen, tap to
    // open the assistant, drag it anywhere; it snaps to the nearest side and
    // the place is remembered on this phone.
    // ------------------------------------------------------------------
    const PH_POS_KEY = 'iba-ai-ph-bubble-pos';
    function placePhoneFab(fab) {
        if (!fab) return;
        const setPos = (l, t, r, b) => {
            [['--iba-ph-l', l], ['--iba-ph-t', t], ['--iba-ph-r', r], ['--iba-ph-b', b]].forEach(([k, v]) => { if (v == null) fab.style.removeProperty(k); else fab.style.setProperty(k, v); });
        };
        fab.__setPos = setPos;
        const pos = onPhone() ? lsGet(PH_POS_KEY, null) : null;
        if (!pos || !Number.isFinite(Number(pos.y))) { setPos(null, null, null, null); return; }
        const size = fab.offsetWidth || 62;
        const y = Math.max(70, Math.min(window.innerHeight - size - 70, Number(pos.y) * window.innerHeight));
        // left in pixels on both sides, so the snap to the side glides
        const x = pos.side === 'left' ? 12 : Math.max(12, window.innerWidth - size - 12);
        setPos(x + 'px', y + 'px', 'auto', 'auto');
    }
    function bindPhoneDrag(fab) {
        if (!fab || fab.__phDrag) return;
        fab.__phDrag = true;
        let start = null, moved = false;
        fab.addEventListener('pointerdown', (e) => {
            if (!onPhone()) return;
            const r = fab.getBoundingClientRect();
            start = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
            moved = false;
        });
        fab.addEventListener('pointermove', (e) => {
            if (!start || e.pointerId !== start.id) return;
            if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
            if (!moved) { moved = true; fab.classList.add('is-dragging'); try { fab.setPointerCapture(start.id); } catch (_) {} hideTip(); }
            const size = fab.offsetWidth || 60;
            const x = Math.max(4, Math.min(window.innerWidth - size - 4, e.clientX - start.dx));
            const y = Math.max(60, Math.min(window.innerHeight - size - 8, e.clientY - start.dy));
            if (fab.__setPos) fab.__setPos(x + 'px', y + 'px', 'auto', 'auto');
            e.preventDefault();
        });
        const end = (e) => {
            if (!start) return;
            const wasMoved = moved;
            start = null;
            fab.classList.remove('is-dragging');
            if (!wasMoved) return;
            const r = fab.getBoundingClientRect();
            const side = (r.left + r.width / 2) < window.innerWidth / 2 ? 'left' : 'right';
            lsSet(PH_POS_KEY, { side: side, y: r.top / window.innerHeight });
            placePhoneFab(fab);
            fab.__justDragged = Date.now();
        };
        fab.addEventListener('pointerup', end);
        fab.addEventListener('pointercancel', end);
        // a drag is not a tap: do not open the assistant after dragging
        fab.addEventListener('click', (e) => {
            if (fab.__justDragged && Date.now() - fab.__justDragged < 400) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);
        window.addEventListener('resize', () => placePhoneFab(fab));
    }
    // 15.0.0 patch 15: the robot says hello in a small speech bubble, then a
    // helpful tip now and then (at most every 7 minutes, 6 times a visit,
    // never while the panel or another message is open). Click it to open me.
    let tipTimer = 0, tipHide = 0, tipN = 0, tipIdx = 0;
    function tipList() {
        const n = pillCount();
        const t = [greetingWord() + ', ' + firstName() + '! I\'m here if you need me.'];
        if (n) t.push('You have ' + n + ' thing' + (n === 1 ? '' : 's') + ' waiting. Tap me for today\'s brief.');
        t.push('Tap me for today\'s brief: your tasks and reminders.');
        t.push('Lost an invoice? Tell me the PO or the vendor and I\'ll find where it is.');
        t.push('Transfers too: type TRF-0361, a vehicle number or "wheel loader".');
        t.push('I can print your brief as a checklist with charts.');
        if (isSuper()) t.push('Moved invoices this morning? I can put them back into Batch Entry for you.');
        t.push('Need someone\'s number? Ask me for their profile, then message them here.');
        return t;
    }
    function hideTip() { const el = $('iba-ai-tip'); if (el) el.classList.remove('is-on'); clearTimeout(tipHide); }
    function showTip(text) {
        const fab = $('iba-ai-fab');
        if (!fab || fab.hidden || fab.classList.contains('is-open') || !look().bot || !look().tips || document.hidden) return false;
        const big = $('iba-ai-bubble');
        if (big && !big.hidden) return false;
        let el = $('iba-ai-tip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'iba-ai-tip';
            el.className = 'iba-ai-tip';
            el.setAttribute('role', 'status');
            el.innerHTML = '<span class="iba-ai-tip-text"></span><button type="button" class="iba-ai-tip-x" aria-label="Hide">×</button>';
            el.addEventListener('click', (e) => {
                hideTip();
                if (e.target.closest('.iba-ai-tip-x')) return;
                build(); toggle(true);
            });
            document.body.appendChild(el);
        }
        el.querySelector('.iba-ai-tip-text').textContent = text;
        el.classList.add('is-on');
        fab.classList.add('is-talking');
        setTimeout(() => { if (!talking) fab.classList.remove('is-talking'); }, 1600);
        clearTimeout(tipHide);
        tipHide = setTimeout(hideTip, 7000);
        return true;
    }
    function nextTip() {
        if (tipN >= 6) return true;
        const list = tipList();
        const text = tipN === 0 ? list[0] : list[1 + (tipIdx % (list.length - 1))];
        if (!showTip(text)) return false; // busy (panel or another message open): try again soon
        if (tipN > 0) tipIdx++;
        tipN++;
        return true;
    }
    function startTips() {
        stopTips();
        tipTimer = setTimeout(function loop() { tipTimer = setTimeout(loop, nextTip() ? 7 * 60000 : 25000); }, 8000);
    }
    function stopTips() { clearTimeout(tipTimer); hideTip(); }

    try {
        document.addEventListener('visibilitychange', () => { document.body && document.body.classList.toggle('iba-ai-tab-hidden', document.hidden); });
    } catch (_) {}

    let talking = false;
    function canSpeak() { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function'; }
    function plainForSpeech(t) {
        return String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/[*_`#>|]/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/QAR/g, 'riyals').replace(/\bPO\b/g, 'P O').replace(/\s+/g, ' ').trim().slice(0, 1400);
    }
    function pickVoice() {
        try {
            const vs = window.speechSynthesis.getVoices() || [];
            return vs.find((v) => /en-GB/i.test(v.lang) && /female|libby|sonia|hazel|google uk english female/i.test(v.name)) ||
                vs.find((v) => /^en/i.test(v.lang) && /natural|online/i.test(v.name)) || vs.find((v) => /^en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
        } catch (_) { return null; }
    }
    function setTalking(onOff) {
        talking = onOff;
        const fab = $('iba-ai-fab'); if (fab) fab.classList.toggle('is-talking', onOff);
        const mark = document.querySelector('#iba-ai-panel .iba-ai-mark'); if (mark) mark.classList.toggle('is-talking', onOff);
    }
    function speak(text) {
        if (!canSpeak()) return;
        const t = plainForSpeech(text);
        if (!t) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(t);
            const v = pickVoice();
            if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
            u.rate = 1; u.pitch = 1.05;
            u.onstart = () => setTalking(true);
            u.onend = u.onerror = () => setTalking(false);
            window.speechSynthesis.speak(u);
        } catch (_) { setTalking(false); }
    }
    function stopSpeak() { try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (_) {} setTalking(false); }
    function briefSpeech(x) {
        const r = x.result || {};
        const tasks = x.tasks || [];
        const rems = remList.filter((m) => !m.seenAt);
        const parts = [greetingWord() + ', ' + firstName() + '.'];
        const nt = Number(r.active_task) || 0, nj = Number(r.active_job) || 0;
        parts.push(nt || nj ? 'You have ' + nt + ' task' + (nt === 1 ? '' : 's') + ' and ' + nj + ' inventory job' + (nj === 1 ? '' : 's') + ' waiting.' : 'Nothing is waiting for you right now.');
        if (r.new_today) parts.push(r.new_today + ' arrived today.');
        const byStatus = r.tasks_by_status || {};
        const top = Object.keys(byStatus).sort((a, b) => byStatus[b] - byStatus[a]).slice(0, 3);
        if (top.length) parts.push('Most are ' + top.map((k) => byStatus[k] + ' ' + k).join(', ') + '.');
        if (tasks[0] && tasks[0].po) { const d = daysSince(tasks[0].at); parts.push('The oldest is PO ' + tasks[0].po + (d !== null ? ', waiting ' + d + ' days' : '') + '. Next step: ' + nextStep(tasks[0].status) + '.'); }
        if (rems.length) parts.push('You have ' + rems.length + ' reminder' + (rems.length === 1 ? '' : 's') + '. ' + rems.slice(0, 2).map((m) => 'From ' + (m.from || 'someone') + ': ' + String(m.text || '').split('\n')[0]).join('. ') + '.');
        if (r.po_closeout && r.po_closeout.ready_to_close) parts.push(r.po_closeout.ready_to_close + ' P O are ready to close.');
        if (r.sent_for_approval) parts.push(r.sent_for_approval + ' invoice' + (r.sent_for_approval === 1 ? ' is' : 's are') + ' waiting for approval.');
        return parts.join(' ');
    }
    // asking by voice (Chrome / Edge speech recognition)
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
    let rec = null;
    function listen(btn) {
        if (!SR) return;
        if (rec) { try { rec.stop(); } catch (_) {} return; }
        try {
            rec = new SR();
            rec.lang = (navigator.language && /^en/i.test(navigator.language)) ? navigator.language : 'en-US';
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            btn.classList.add('is-listening');
            rec.onresult = (e) => {
                const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
                if (t) { const ta = $('iba-ai-text'); ta.value = t; ask(t); ta.value = ''; }
            };
            rec.onerror = (e) => { if (e && e.error === 'not-allowed') addNote('The microphone is blocked for this site. Allow it in the browser address bar, then try again.'); };
            rec.onend = () => { btn.classList.remove('is-listening'); rec = null; };
            rec.start();
        } catch (_) { btn.classList.remove('is-listening'); rec = null; }
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
        const phBtn = $('iba-ph-ai');
        if (phBtn) phBtn.hidden = !ok;
        if (ok && !on) {
            on = true;
            build();
            $('iba-ai-fab').hidden = false;
            bindPhoneDrag($('iba-ai-fab'));
            if ($('iba-ai-fab').dataset.mode !== (onPhone() ? 'phone' : 'desk')) paintFab($('iba-ai-fab'));
            refreshFab();
            if (!onPhone()) { briefOnce(); startTips(); }
            startReminders();
        } else if (!ok && on) {
            on = false;
            const fab = $('iba-ai-fab');
            if (fab) fab.hidden = true;
            stopReminders();
            stopTips();
            toggle(false);
            hideBubble();
            state.history = [];
            state.lastTurn = null;
            if (log()) log().innerHTML = '';
            skillsPulled = false;
        } else if (ok) {
            const fab = $('iba-ai-fab');
            if (fab && fab.dataset.mode !== (onPhone() ? 'phone' : 'desk')) {
                fab.hidden = false;
                bindPhoneDrag(fab);
                paintFab(fab);
                if (onPhone()) { stopTips(); hideBubble(); hideTip(); } else startTips();
            }
            refreshFab();
            if (phBtn) phBtn.classList.toggle('has-items', !!(fab && fab.classList.contains('has-items')));
        }
    }
    function boot() {
        watch();
        setInterval(watch, 2000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    // 17.0.0 patch 19: put given invoices ({po, key}) into Batch Entry (used by
    // the print basket's "Move to Batch Entry"). Each invoice is read fresh.
    // 17.0.0 patch 21: the same task buttons on the Dashboard cards
    // (js/iba-17-p21.js), running the same routines as the brief
    window.ibaAssistantSkillList = () => Object.keys(SKILL_TPL).map((id) => ({ id: id, name: SKILL_TPL[id].name, superOnly: !!SKILL_TPL[id].superOnly, adminOnly: !!SKILL_TPL[id].adminOnly }));
    window.ibaTaskActions = {
        html: (t) => taskActionsHtml(t),
        run: (btn) => taskAct(btn),
        open: (q) => openTaskPage(q)
    };

    window.ibaAddToBatch = async function (items) {
        let idb = null;
        try { if (typeof invoiceDb !== 'undefined' && invoiceDb && invoiceDb.ref) idb = invoiceDb; } catch (_) {}
        if (!idb) throw new Error('The invoice database is not available.');
        const found = [], notAdded = [];
        for (const it of (items || [])) {
            if (!it || !it.po || !it.key) continue;
            let inv = null;
            try { const s = await idb.ref('invoice_entries/' + it.po + '/' + it.key).once('value'); inv = s && s.val(); } catch (_) {}
            if (!inv) { notAdded.push({ po: it.po, reason: 'Invoice not found' }); continue; }
            const rec = poMap()[String(it.po).toUpperCase()] || poMap()[it.po] || {};
            found.push({ key: it.key, po: it.po, site: inv.site || rec['Project ID'] || 'N/A', vendor: inv.vendorName || rec['Supplier Name'] || 'N/A', inv: inv });
        }
        const r = await batchAdd(found, {}, notAdded, {});
        return (r && r.result) || {};
    };
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
