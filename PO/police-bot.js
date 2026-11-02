/* ==========================================================================
   police-bot.js — Officer PO, the PO Records assistant
   --------------------------------------------------------------------------
   The PO file is the jail: Active = the original PO is locked up in my
   custody, Inactive = released (someone took it / it went to accounts).

   - Works WITHOUT AI for short commands:
       "find 12345"            look up one or more POs
       "jail 12345 12346"      put POs in jail (mark Active)
       "release 12345"         release POs (mark Inactive)
       "how many in jail"      counts
       "supplier aamaal"       search active POs by supplier / project / ReqNum
   - With an AI key (any OpenAI-compatible service, Groq by default) it
     understands normal sentences. The key stays in this browser only. If
     IBA System already has a key saved in this browser it can be reused.
   - It never jails or releases on its own: it shows the POs and you press
     Confirm. Jail / release need the admin login, like the buttons.
   Uses the record helpers from app.js (rec, findRecordByPO, getRecords...).
   ========================================================================== */
(function () {
  'use strict';

  const CFG_KEY = 'po-bot-brain-v1';
  const IBA_KEY_PREFIX = 'iba-ai-brain-v1';
  const BRAINS = {
    groq: { label: 'Groq (free)', baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
    gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
    openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-oss-20b:free' },
    cerebras: { label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b' },
    openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
  };
  const MAX_TOOL_ROUNDS = 4;
  const history = [];   // AI conversation (kept short)

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isAdmin = () => typeof auth !== 'undefined' && !!auth.currentUser;

  // ---------------- Brain settings (this browser only) ----------------
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function brainOfKey(k) {
    k = String(k || '').trim();
    if (/^gsk_/i.test(k)) return 'groq';
    if (/^(AIza|AQ\.)/.test(k)) return 'gemini';
    if (/^sk-or-/i.test(k)) return 'openrouter';
    if (/^csk-/i.test(k)) return 'cerebras';
    if (/^sk-/i.test(k)) return 'openai';
    return 'groq';
  }
  // A key saved by IBA System's assistant in this browser (same site), if any
  function ibaSystemCfg() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(IBA_KEY_PREFIX)) continue;
        const c = lsGet(k);
        if (c && c.key) return c;
      }
    } catch (e) {}
    return null;
  }
  function getCfg() {
    const c = lsGet(CFG_KEY) || {};
    if (c.useIba) {
      const iba = ibaSystemCfg();
      if (iba) {
        const b = BRAINS[iba.brain] || BRAINS[brainOfKey(iba.key)];
        return { key: iba.key, baseUrl: String(iba.baseUrl || b.baseUrl).replace(/\/+$/, ''), model: iba.model || b.model, from: 'IBA System' };
      }
    }
    if (!c.key) return null;
    const b = BRAINS[brainOfKey(c.key)];
    return { key: c.key, baseUrl: (c.baseUrl || b.baseUrl).replace(/\/+$/, ''), model: c.model || b.model, from: b.label };
  }
  function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} }

  // ---------------- Data helpers ----------------
  const today = () => (typeof getFormattedDate === 'function' ? getFormattedDate() : new Date().toDateString());
  function cleanPO(v) { return String(v ?? '').trim().replace(/^PO[\s#:-]*/i, '').trim(); }
  function poTokens(text) {
    const out = [];
    String(text || '').replace(/\b(?:PO[\s#:-]*)?([A-Z]{0,4}\d{3,}[A-Z0-9-]*)\b/gi, (m, po) => { if (!out.includes(po)) out.push(po); return m; });
    return out;
  }
  async function lookup(po) {
    const found = await findRecordByPO(cleanPO(po));
    return found ? { key: found[0], data: found[1], r: rec(found[1]) } : null;
  }
  async function counts() {
    await syncActive();
    const active = Object.keys(recordCache.active || {}).length;
    const all = recordCache.all ? Object.keys(recordCache.all).length : null;
    return { inJail: active, released: all === null ? null : all - active, total: all };
  }
  async function searchText(q, status) {
    const term = String(q || '').toLowerCase().trim();
    const snap = await getRecords(status === 'Inactive' || status === 'All' ? 'All' : 'Active');
    const hits = [];
    snap.forEach(c => {
      const r = rec(c.val());
      if (status && status !== 'All' && r.Status !== status) return;
      if ([r.PO, r.ReqNum, r.SupplierID, r.SupplierName, r.ProjectID].some(v => String(v).toLowerCase().includes(term))) hits.push({ key: c.key, data: c.val(), r });
    });
    return hits;
  }
  async function setStatus(item, status) {
    const changes = status === 'Active'
      ? { Status: 'Active', DateFiled: today(), DateReleased: null, DateAdded: null }
      : { Status: 'Inactive', DateReleased: today() };
    await db.ref('records/' + item.key).update(changes);
    const updated = { ...item.data, ...changes };
    if (typeof refreshRow === 'function') refreshRow(item.key, updated);
    return updated;
  }

  // ---------------- UI ----------------
  const BOT_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="14" y="22" width="36" height="30" rx="10" fill="#dfe6ee"/>
    <path d="M12 22 L32 10 L52 22 Z" fill="#1d3a6b"/><rect x="12" y="20" width="40" height="6" rx="3" fill="#152c52"/>
    <path d="M29 13 h6 l-3 5 z" fill="#e3b341"/>
    <rect x="19" y="31" width="26" height="11" rx="5.5" fill="#131a23"/>
    <circle cx="26" cy="36.5" r="3" fill="#36c3b2"/><circle cx="38" cy="36.5" r="3" fill="#36c3b2"/>
    <rect x="27" y="45" width="10" height="2.6" rx="1.3" fill="#8592a1"/>
    <path d="M26 52 h12 l-2 6 h-8 z" fill="#e3b341"/>
  </svg>`;

  // Full-body officer for the corner (same robot family as the Procurement Hub wizard)
  const OFFICER_SVG = `<svg class="robot officer" viewBox="0 0 120 150" aria-hidden="true">
    <ellipse class="robot-shadow" cx="60" cy="144" rx="28" ry="5"/>
    <g class="robot-body">
      <!-- left arm: flashlight -->
      <g class="cop-arm-light">
        <path class="cop-beam" d="M22 132 L-30 112 L-26 150 Z"/>
        <rect class="cop-torch" x="14" y="126" width="14" height="7" rx="2" transform="rotate(-18 21 129)"/>
        <path class="cop-sleeve" d="M38 104 C30 110 25 120 22 130 L33 133 C35 124 38 117 43 111 Z"/>
        <g class="cop-clip"><rect x="14" y="104" width="22" height="28" rx="2.5"/><rect class="cop-clip-paper" x="16.5" y="108" width="17" height="21" rx="1"/><rect class="cop-clip-top" x="20" y="102" width="10" height="5" rx="1.5"/><path class="cop-clip-lines" d="M19 113 h11 M19 118 h11 M19 123 h7"/></g>
        <circle class="robot-arm" cx="27" cy="131" r="5"/>
      </g>
      <!-- uniform -->
      <path class="cop-shirt" d="M38 101 C33 114 31 124 32 134 L88 134 C89 124 87 114 82 101 Z"/>
      <path class="cop-tie" d="M57 103 h6 l2 15 -5 5 -5 -5 Z"/>
      <path class="cop-badge" d="M74 110 l6 -2 6 2 -1 7 c-1 3 -3 5 -5 6 c-2 -1 -4 -3 -5 -6 Z"/>
      <rect class="cop-pocket" x="40" y="110" width="12" height="9" rx="2"/>
      <rect class="cop-belt" x="31" y="130" width="58" height="7" rx="3"/>
      <rect class="cop-buckle" x="56" y="130" width="8" height="7" rx="1.5"/>
      <g class="cop-cuffs"><circle cx="40" cy="138" r="3.6"/><circle cx="46" cy="138" r="3.6"/></g>
      <g class="cop-keys"><circle cx="80" cy="140" r="4.2"/><path d="M78 143 v6 h2 M82 143 l2 5 h2 M80 144 v5"/></g>
      <!-- legs / boots -->
      <g class="wiz-leg cop-leg-l"><rect x="44" y="136" width="14" height="10" rx="4.5"/></g>
      <g class="wiz-leg cop-leg-r"><rect x="62" y="136" width="14" height="10" rx="4.5"/></g>
      <!-- right arm: waves / salutes / whistle -->
      <g class="robot-arm-wave">
        <path class="cop-sleeve" d="M82 104 C90 110 95 120 98 130 L87 133 C85 124 82 117 77 111 Z"/>
        <g class="cop-cup"><path d="M88 118 h11 l-1.5 12 h-8 Z"/><path class="cop-cup-handle" d="M99 121 q4 1 3 4 q-1 3 -4 2"/><g class="cop-steam"><path d="M91 115 q-2 -3 0 -6 q2 -3 0 -6"/><path d="M96 115 q-2 -3 0 -6 q2 -3 0 -6"/></g></g>
        <circle class="robot-arm" cx="93" cy="131" r="5"/>
      </g>
      <!-- head (same robot as the wizard) -->
      <rect class="robot-ear" x="11" y="62" width="10" height="22" rx="5"/>
      <rect class="robot-ear" x="99" y="62" width="10" height="22" rx="5"/>
      <rect class="robot-head" x="19" y="46" width="82" height="56" rx="22"/>
      <rect class="robot-face" x="29" y="57" width="62" height="37" rx="15"/>
      <g class="robot-eyes"><rect class="robot-eye" x="43" y="67" width="10" height="15" rx="5"/><rect class="robot-eye" x="67" y="67" width="10" height="15" rx="5"/></g>
      <g class="robot-eyes-sleep"><path d="M43 76 h10"/><path d="M67 76 h10"/></g>
      <g class="robot-eyes-happy"><path d="M42 77 Q48 68 54 77"/><path d="M66 77 Q72 68 78 77"/></g>
      <path class="robot-mouth" d="M53 87 Q60 92.5 67 87"/>
      <g class="cop-whistle"><rect x="58" y="86" width="12" height="6" rx="3"/><line x1="70" y1="89" x2="80" y2="96"/></g>
      <!-- police cap -->
      <g class="cop-cap">
        <path class="cop-cap-top" d="M20 40 C22 22 44 14 60 14 C76 14 98 22 100 40 Z"/>
        <rect class="cop-cap-band" x="22" y="36" width="76" height="11" rx="4"/>
        <text class="cop-cap-text" x="60" y="44.2" text-anchor="middle">WARDEN</text>
        <path class="cop-cap-badge" d="M60 18 l7 3 -1 8 c-1 3 -3 5 -6 6 c-3 -1 -5 -3 -6 -6 l-1 -8 Z"/>
        <path class="cop-visor" d="M24 46 Q60 58 96 46 L92 51 Q60 61 28 51 Z"/>
      </g>
      <g class="cop-zzz"><text x="96" y="52">z</text><text x="104" y="40">z</text><text x="112" y="26">Z</text></g>
      <g class="cop-notes"><path d="M104 70 q6 -4 10 0"/><path d="M106 62 q8 -6 14 0"/></g>
    </g>
  </svg>`;

  function buildUi() {
    const dock = document.createElement('button');
    dock.id = 'botDock'; dock.className = 'bot-dock'; dock.title = 'Officer PO, the jail warden';
    dock.setAttribute('aria-label', 'Open Officer PO');
    dock.innerHTML = '<span class="bot-bubble">Warden on duty. Need a PO found, jailed or released?</span>' + OFFICER_SVG;
    dock.onclick = () => { stopAct(); toggle(); };
    const panel = document.createElement('aside');
    panel.id = 'botPanel'; panel.className = 'bot-panel hidden';
    panel.innerHTML = `
      <header class="bot-head">
        <div class="bot-avatar">${BOT_SVG}</div>
        <div><b>Officer PO</b><small id="botBrain">Basic mode</small></div>
        <button class="bot-icon" id="botSettingsBtn" title="AI settings"><i class="fa-solid fa-key"></i></button>
        <button class="bot-icon" id="botCloseBtn" title="Close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="bot-settings hidden" id="botSettings">
        <p>Optional: an AI key lets me understand normal sentences. Kept in this browser only.</p>
        <label class="bot-check" id="botUseIbaWrap"><input type="checkbox" id="botUseIba"> Use the key saved in IBA System</label>
        <input type="password" id="botKey" placeholder="Paste a key (Groq gsk_…, Gemini, OpenRouter…)" autocomplete="off">
        <div class="bot-row"><a href="https://console.groq.com/keys" target="_blank" rel="noopener">Get a free Groq key</a>
          <button class="btn btn-sm btn-primary" id="botSaveKey">Save</button></div>
      </div>
      <div class="bot-log" id="botLog"></div>
      <div class="bot-chips" id="botChips">
        <button data-say="how many in jail">How many in jail?</button>
        <button data-fill="find ">Find a PO</button>
        <button data-fill="jail ">Jail a PO</button>
        <button data-fill="release ">Release a PO</button>
        <button data-say="help">What can you do?</button>
      </div>
      <form class="bot-input" id="botForm">
        <input type="text" id="botText" placeholder="e.g. release 12345 12346" autocomplete="off">
        <button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-paper-plane"></i></button>
      </form>`;
    document.body.append(dock, panel);

    $('botCloseBtn').onclick = toggle;
    $('botSettingsBtn').onclick = () => { $('botSettings').classList.toggle('hidden'); paintSettings(); };
    $('botSaveKey').onclick = () => {
      saveCfg({ key: $('botKey').value.trim(), useIba: $('botUseIba').checked });
      $('botSettings').classList.add('hidden'); paintBrain();
      say(getCfg() ? `AI is on (${esc(getCfg().from)}). Talk to me normally.` : 'Basic mode: use short commands like "find 12345".');
    };
    $('botForm').onsubmit = e => { e.preventDefault(); const t = $('botText').value.trim(); if (t) { $('botText').value = ''; handle(t); } };
    $('botChips').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.say) handle(b.dataset.say);
      else { $('botText').value = b.dataset.fill; $('botText').focus(); }
    };
    $('botLog').addEventListener('click', onLogClick);
    paintBrain();
  }
  function paintSettings() {
    const c = lsGet(CFG_KEY) || {};
    const iba = ibaSystemCfg();
    $('botUseIbaWrap').classList.toggle('hidden', !iba);
    $('botUseIba').checked = !!(c.useIba && iba);
    $('botKey').value = c.key || '';
  }
  function paintBrain() { const c = getCfg(); $('botBrain').textContent = c ? 'AI on · ' + c.from : 'Basic mode'; }
  let greeted = false;
  function toggle() {
    const p = $('botPanel');
    p.classList.toggle('hidden'); document.body.classList.toggle('bot-open', !p.classList.contains('hidden'));
    if (!p.classList.contains('hidden')) {
      if (!greeted) { greeted = true; greet(); }
      setTimeout(() => $('botText').focus(), 50);
    }
  }
  async function greet() {
    const c = await counts().catch(() => null);
    say(`Officer PO reporting. ${c ? `<b>${c.inJail.toLocaleString()}</b> POs are in jail (in your custody).` : ''} Tell me a PO number, or say <i>jail</i> / <i>release</i> with PO numbers.`);
  }

  function say(html, cls) {
    const d = document.createElement('div');
    d.className = 'bot-msg ' + (cls || 'bot');
    d.innerHTML = html;
    $('botLog').appendChild(d);
    $('botLog').scrollTop = $('botLog').scrollHeight;
    return d;
  }
  function card(item) {
    const r = item.r;
    const jailed = r.Status === 'Active';
    return `<div class="bot-card ${jailed ? 'in' : 'out'}">
      <div class="bot-card-top"><b class="bot-po">${esc(r.PO)}</b><span class="status-badge status-${jailed ? 'active' : 'inactive'}">${jailed ? 'In jail' : 'Released'}</span></div>
      <div>${esc(r.SupplierName || '—')} ${r.SupplierID ? `<small>(${esc(r.SupplierID)})</small>` : ''}</div>
      <small>Project ${esc(r.ProjectID || '—')} · Req ${esc(r.ReqNum || '—')} · QAR ${esc(formatNumber(r.Amount))}</small>
      <small>${jailed ? 'Jailed ' + esc(r.DateFiled || '—') : 'Released ' + esc(r.DateReleased || '—')}</small>
      <div class="bot-row"><button class="btn btn-sm btn-ghost" data-show="${esc(item.key)}">Show in table</button></div>
    </div>`;
  }

  // ---------------- Actions with confirm ----------------
  const pending = {};
  let pendingSeq = 0;
  async function proposeStatus(pos, status) {
    if (!isAdmin()) { say('Only the admin can jail or release POs. Please log in first.'); return { ok: false, reason: 'not logged in' }; }
    const want = status === 'Active' ? 'Active' : 'Inactive';
    const ready = [], skipped = [], missing = [];
    for (const po of pos) {
      const it = await lookup(po);
      if (!it) missing.push(cleanPO(po));
      else if (it.r.Status === want) skipped.push(it.r.PO);
      else ready.push(it);
    }
    let html = '';
    if (ready.length) {
      const id = 'p' + (++pendingSeq);
      pending[id] = { items: ready, status: want };
      html += `<p>${want === 'Active' ? 'Put these in jail' : 'Release these'} (${ready.length})?</p>` + ready.map(card).join('') +
        `<div class="bot-row"><button class="btn btn-sm btn-ghost" data-cancel="${id}">Cancel</button><button class="btn btn-sm ${want === 'Active' ? 'btn-accent' : 'btn-warn'}" data-confirm="${id}">${want === 'Active' ? 'Confirm jail' : 'Confirm release'}</button></div>`;
    }
    if (skipped.length) html += `<p class="bot-note">Already ${want === 'Active' ? 'in jail' : 'released'}: ${skipped.map(esc).join(', ')}</p>`;
    if (missing.length) html += `<p class="bot-note">Not in the records: ${missing.map(esc).join(', ')}` + (want === 'Active' ? ` <button class="btn btn-sm btn-ghost" data-add="${esc(missing[0])}">Add ${esc(missing[0])}</button>` : '') + '</p>';
    say(html || 'No PO numbers found.');
    return { ok: true, waiting_for_confirm: ready.map(i => i.r.PO), already: skipped, not_found: missing };
  }
  async function onLogClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.show) {
      const tbody = document.querySelector('#poTable tbody');
      const it = lastRenderedRows[b.dataset.show] || (recordCache.all || {})[b.dataset.show] || (recordCache.active || {})[b.dataset.show];
      const found = it ? null : await db.ref('records/' + b.dataset.show).once('value').then(s => s.val());
      const data = it || found;
      if (tbody && data) { viewingCollection = false; hasSearched = true; tbody.innerHTML = ''; tbody.appendChild(renderRow(b.dataset.show, data)); updateResultCount(); }
    } else if (b.dataset.add) {
      openNewPOModal(b.dataset.add);
    } else if (b.dataset.cancel) {
      delete pending[b.dataset.cancel];
      b.closest('.bot-msg').querySelectorAll('[data-confirm],[data-cancel]').forEach(x => x.remove());
      say('Cancelled. Nothing was changed.');
    } else if (b.dataset.confirm) {
      const p = pending[b.dataset.confirm]; if (!p) return;
      delete pending[b.dataset.confirm];
      b.closest('.bot-msg').querySelectorAll('[data-confirm],[data-cancel]').forEach(x => x.remove());
      let done = 0;
      for (const it of p.items) { try { await setStatus(it, p.status); done++; } catch (err) { say('Could not update ' + esc(it.r.PO) + ': ' + esc(err.message)); } }
      await new Promise(r => setTimeout(r, 400)); // let the live Active list catch up
      const c = await counts().catch(() => null);
      say(`${p.status === 'Active' ? '🔒 Locked up' : '🔓 Released'} ${done} PO${done === 1 ? '' : 's'}.${c ? ` Now <b>${c.inJail.toLocaleString()}</b> in jail.` : ''}`);
      if (typeof showToast === 'function') showToast(`${done} PO${done === 1 ? '' : 's'} ${p.status === 'Active' ? 'jailed' : 'released'}`);
    }
  }

  // ---------------- Basic mode (no AI) ----------------
  const HELP = `I can:<br>• <b>find 12345</b> — check one or more POs<br>• <b>jail 12345 12346</b> — put POs in jail (Active)<br>• <b>release 12345</b> — release POs (Inactive)<br>• <b>how many in jail</b><br>• <b>supplier aamaal</b> — search POs in jail by supplier, project or ReqNum<br>Jail and release always ask you to confirm.`;
  async function basic(text) {
    const t = text.toLowerCase();
    const pos = poTokens(text);
    if (/^(help|\?|what can you do)/.test(t)) return say(HELP);
    if (/how many|count|total|inmates|in jail\??$/.test(t) && !pos.length) {
      const c = await counts();
      return say(`<b>${c.inJail.toLocaleString()}</b> POs in jail.` + (c.total !== null ? ` ${c.released.toLocaleString()} released, ${c.total.toLocaleString()} in total.` : ' Choose "All" in the status filter to load the released count.'));
    }
    if (pos.length && /\b(release|free|out|let go|inactive|discharge|parole)\b/.test(t)) return proposeStatus(pos, 'Inactive');
    if (pos.length && /\b(jail|lock|arrest|in custody|active|back|book|put in)\b/.test(t)) return proposeStatus(pos, 'Active');
    if (pos.length) {
      for (const po of pos) { const it = await lookup(po); say(it ? card(it) : `PO ${esc(cleanPO(po))} is not in the records.`); }
      return;
    }
    const m = t.match(/^(?:supplier|vendor|project|search|find|who is)\s+(.+)/);
    if (m) {
      const hits = await searchText(m[1], 'Active');
      if (!hits.length) return say(`No POs in jail match "${esc(m[1])}".`);
      return say(`${hits.length} in jail match "${esc(m[1])}":` + hits.slice(0, 8).map(card).join('') + (hits.length > 8 ? `<p class="bot-note">…and ${hits.length - 8} more. Use the search box to see all.</p>` : ''));
    }
    say(`I didn't catch that. ${getCfg() ? '' : 'Tip: add an AI key (🔑) so I understand normal sentences.<br>'}${HELP}`);
  }

  // ---------------- AI mode (tool calling) ----------------
  const TOOLS = [
    { type: 'function', function: { name: 'find_po', description: 'Look up POs by number. Shows each PO to the user.', parameters: { type: 'object', properties: { pos: { type: 'array', items: { type: 'string' } } }, required: ['pos'] } } },
    { type: 'function', function: { name: 'count_jail', description: 'How many POs are in jail (Active) and released (Inactive).', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'search_records', description: 'Search POs by supplier name/ID, project ID, ReqNum or PO text.', parameters: { type: 'object', properties: { text: { type: 'string' }, status: { type: 'string', enum: ['Active', 'Inactive', 'All'] } }, required: ['text'] } } },
    { type: 'function', function: { name: 'jail_pos', description: 'Put POs in jail (mark Active: the original is back in custody). The user must press Confirm.', parameters: { type: 'object', properties: { pos: { type: 'array', items: { type: 'string' } } }, required: ['pos'] } } },
    { type: 'function', function: { name: 'release_pos', description: 'Release POs from jail (mark Inactive: the original left custody). The user must press Confirm.', parameters: { type: 'object', properties: { pos: { type: 'array', items: { type: 'string' } } }, required: ['pos'] } } }
  ];
  const SYSTEM = `You are Officer PO, a friendly police-officer assistant inside "PO Records". The PO file is a jail: a PO "in jail" (Status Active) means its original paper is in the user's custody; "released" (Inactive) means it left custody (someone took it or it went to accounts). Use the tools for every fact; never invent PO data. jail_pos and release_pos only prepare a confirm card; tell the user to press Confirm. Keep replies short (1-3 sentences), plain English, a light police flavour is fine. Amounts are QAR. Today is ${new Date().toDateString()}.`;

  async function runTool(name, args) {
    args = args || {};
    if (name === 'count_jail') return counts();
    if (name === 'find_po') {
      const out = [];
      for (const po of (args.pos || []).slice(0, 15)) { const it = await lookup(po); if (it) { say(card(it)); out.push(it.r); } else out.push({ PO: cleanPO(po), found: false }); }
      return out;
    }
    if (name === 'search_records') {
      const hits = await searchText(args.text, args.status || 'Active');
      if (hits.length) say(hits.slice(0, 6).map(card).join(''));
      return { count: hits.length, first: hits.slice(0, 20).map(h => h.r) };
    }
    if (name === 'jail_pos') return proposeStatus((args.pos || []).slice(0, 50), 'Active');
    if (name === 'release_pos') return proposeStatus((args.pos || []).slice(0, 50), 'Inactive');
    return { error: 'unknown tool' };
  }
  async function ai(text, cfg) {
    history.push({ role: 'user', content: text });
    while (history.length > 10) history.shift();
    const messages = [{ role: 'system', content: SYSTEM }, ...history];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(cfg.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.2, max_tokens: 700 })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body.error && body.error.message) || ('AI error ' + res.status));
      const msg = body.choices && body.choices[0] && body.choices[0].message;
      if (!msg) throw new Error('Empty AI reply');
      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          let args = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
          const out = await runTool(call.function.name, args).catch(err => ({ error: err.message }));
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out).slice(0, 6000) });
        }
        continue;
      }
      const reply = String(msg.content || '').trim();
      if (reply) { say(esc(reply).replace(/\n/g, '<br>')); history.push({ role: 'assistant', content: reply }); }
      return;
    }
  }

  async function handle(text) {
    say(esc(text), 'me');
    const thinking = say('<span class="bot-typing"><i></i><i></i><i></i></span>');
    try {
      const cfg = getCfg();
      // Plain commands are answered instantly without using the AI
      const plain = /^(help|\?|how many|count)/i.test(text) || /^(find|jail|release|lock|free|supplier|vendor)\b/i.test(text) || /^[\sA-Z0-9#,-]*\d{3,}[\sA-Z0-9#,-]*$/i.test(text);
      thinking.remove();
      if (cfg && !plain) await ai(text, cfg);
      else await basic(text);
    } catch (err) {
      thinking.remove();
      say('⚠️ ' + esc(err.message) + '. Switching to basic mode for this one.');
      try { await basic(text); } catch (e) {}
    }
  }


  // ---------------- Officer comes alive ----------------
  // Every so often (page visible, panel closed, nobody pointing at him) he patrols a little,
  // blows the whistle, or checks with the flashlight. Respects "reduce motion".
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let busy = false;
  function dockEl() { return $('botDock'); }
  function mayAct() {
    const d = dockEl();
    return d && !busy && !reduced.matches && document.visibilityState === 'visible'
      && $('botPanel').classList.contains('hidden') && !d.matches(':hover')
      && !document.querySelector('.modal:not(.hidden)');
  }
  function stopAct() {
    const d = dockEl(); if (!d) return;
    d.style.setProperty('--walk-time', '0s'); d.style.setProperty('--walk-x', '0px');
    d.classList.remove('walking', 'face-left', 'whistle', 'torch', 'salute', 'greet', 'coffee', 'doze', 'keys', 'clipboard', 'talk');
    setBubble();
  }
  async function act(name, ms) { const d = dockEl(); d.classList.add(name); await wait(ms); d.classList.remove(name); }
  const DEFAULT_BUBBLE = 'Warden on duty. Need a PO found, jailed or released?';
  function setBubble(text) { const b = dockEl() && dockEl().querySelector('.bot-bubble'); if (b) b.textContent = text || DEFAULT_BUBBLE; }
  async function sayAct(text, cls, ms) {
    const d = dockEl(); setBubble(text); d.classList.add('talk', cls);
    await wait(ms); d.classList.remove('talk', cls); await wait(300); setBubble();
  }
  async function rollCall() {
    let n = null;
    try { n = (await counts()).inJail; } catch (e) {}
    const lines = n === null ? ['Roll call… all inmates present.'] : [
      `Roll call: ${n.toLocaleString()} POs in jail. All present.`,
      `Counted the cells: ${n.toLocaleString()} POs locked up.`,
      `${n.toLocaleString()} inmates, zero escapes. Good shift so far.`];
    await sayAct(lines[Math.floor(Math.random() * lines.length)], 'clipboard', 4200);
  }
  async function patrol() {
    const d = dockEl();
    const dist = Math.round(Math.min(320, window.innerWidth * 0.3));
    const secs = dist / 45;
    d.style.setProperty('--walk-time', secs + 's');
    d.classList.add('walking', 'face-left'); d.style.setProperty('--walk-x', -dist + 'px');
    await wait(secs * 1000);
    d.classList.remove('walking');
    await act(Math.random() < 0.5 ? 'torch' : 'whistle', 2600);
    d.classList.add('walking'); d.classList.remove('face-left'); d.style.setProperty('--walk-x', '0px');
    await wait(secs * 1000);
    d.classList.remove('walking');
  }
  async function tick() {
    if (mayAct()) {
      busy = true;
      try {
        const r = Math.random();
        if (r < 0.28) await patrol();
        else if (r < 0.40) await rollCall();
        else if (r < 0.50) await sayAct('Coffee break. Still watching the cells.', 'coffee', 3600);
        else if (r < 0.60) await act('doze', 4200);
        else if (r < 0.70) await act('keys', 2600);
        else if (r < 0.78) await act('clipboard', 3200);
        else if (r < 0.88) await act('whistle', 2600);
        else if (r < 0.95) await act('torch', 3000);
        else await act('salute', 2200);
      } catch (e) {} finally { busy = false; }
    }
    setTimeout(tick, 18000 + Math.random() * 17000);
  }
  function greetOnce() {
    try { if (sessionStorage.getItem('po_bot_greeted')) return; sessionStorage.setItem('po_bot_greeted', '1'); } catch (e) {}
    setTimeout(() => { const d = dockEl(); if (!d || !mayAct()) return; d.classList.add('greet'); setTimeout(() => d.classList.remove('greet'), 6000); }, 1500);
  }

  function start() { buildUi(); greetOnce(); setTimeout(tick, 9000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.policeBot = { open: () => { if ($('botPanel').classList.contains('hidden')) toggle(); }, ask: handle };
})();
