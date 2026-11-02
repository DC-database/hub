/* =====================================================================
   IBA Finance 6.0 — the Teller (robot + chat)
   ---------------------------------------------------------------------
   - Same robot as the Invoice assistant, dressed as a bank officer:
     peaked cap with the gold bank badge, shoulder boards, waistcoat,
     bow tie, name badge and a gold coin.
   - While idle he looks around, flips his coin, counts paper money in a
     counting machine or puts money in the vault. He salutes when the app
     opens and when a payment is saved. After 1 minute without use he
     fades to 30%; after 3 minutes he dozes. Mouse near him = awake.
   - Chat works WITHOUT any key for simple asks (PO / site / vendor,
     waiting payments, certificate, new payment). With an AI key (kept
     only in this browser) he understands free text too.
   - Reads only the browser copy (window.Finance). He never saves,
     edits or deletes: "new payment" only fills the form for you.
   ===================================================================== */
(function () {
  'use strict';
  if (window.ibaTeller) return;
  const F = () => window.Finance;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------------ robot
  function robotSVG(id, withProps) {
    const vb = withProps ? '-44 -4 168 100' : '0 0 80 96';
    const props = withProps ? `
<g class="prop prop-counter">
  <rect x="-41" y="64" width="38" height="25" rx="4" fill="#2b3440" stroke="#E3C98A" stroke-width="1"></rect>
  <rect x="-37" y="61" width="30" height="5" rx="2" fill="#1b222b" stroke="#E3C98A" stroke-width="0.8"></rect>
  <rect x="-36" y="69" width="18" height="8" rx="1.5" fill="#07121C"></rect>
  <text class="cnt c1" x="-34.5" y="75.3" font-size="5.6" font-family="monospace" fill="#5ED6C4">0100</text>
  <text class="cnt c2" x="-34.5" y="75.3" font-size="5.6" font-family="monospace" fill="#5ED6C4" opacity="0">0250</text>
  <text class="cnt c3" x="-34.5" y="75.3" font-size="5.6" font-family="monospace" fill="#5ED6C4" opacity="0">0500</text>
  <circle cx="-12" cy="73" r="2.2" fill="#36c3b2"></circle>
  <rect x="-37" y="81" width="30" height="3" rx="1" fill="#1b222b"></rect>
  <g class="bill-in b1"><rect x="-33" y="53" width="22" height="9" rx="1" fill="#5aa86a" stroke="#2f6b3c" stroke-width="0.6"></rect><circle cx="-22" cy="57.5" r="2" fill="#2f6b3c"></circle></g>
  <g class="bill-in b2"><rect x="-33" y="53" width="22" height="9" rx="1" fill="#6bbb7b" stroke="#2f6b3c" stroke-width="0.6"></rect><circle cx="-22" cy="57.5" r="2" fill="#2f6b3c"></circle></g>
  <g class="bill-in b3"><rect x="-33" y="53" width="22" height="9" rx="1" fill="#5aa86a" stroke="#2f6b3c" stroke-width="0.6"></rect><circle cx="-22" cy="57.5" r="2" fill="#2f6b3c"></circle></g>
  <g class="bill-out b1"><rect x="-44" y="83" width="18" height="7" rx="1" fill="#6bbb7b" stroke="#2f6b3c" stroke-width="0.6"></rect></g>
  <g class="bill-out b2"><rect x="-44" y="83" width="18" height="7" rx="1" fill="#5aa86a" stroke="#2f6b3c" stroke-width="0.6"></rect></g>
</g>
<g class="prop prop-vault">
  <rect x="76" y="50" width="42" height="40" rx="4" fill="#3b4a5a" stroke="#E3C98A" stroke-width="1"></rect>
  <rect x="80" y="54" width="34" height="32" rx="3" fill="#0b1724"></rect>
  <rect x="84" y="62" width="26" height="5" rx="1" fill="#5aa86a"></rect><rect x="84" y="68" width="26" height="5" rx="1" fill="#6bbb7b"></rect><rect x="84" y="74" width="26" height="5" rx="1" fill="#f2c230"></rect>
  <g class="vault-door">
    <rect x="80" y="54" width="34" height="32" rx="3" fill="#6b7c8f" stroke="#a9b6c4" stroke-width="0.8"></rect>
    <circle cx="97" cy="70" r="11" fill="#55657a" stroke="#f2c230" stroke-width="1.2"></circle>
    <g class="vault-wheel"><path d="M97 61 V79 M88 70 H106 M90.6 63.6 L103.4 76.4 M103.4 63.6 L90.6 76.4" stroke="#f2c230" stroke-width="1.6" stroke-linecap="round"></path><circle cx="97" cy="70" r="2.6" fill="#f2c230"></circle></g>
  </g>
  <rect x="73" y="88" width="48" height="3" rx="1" fill="#2b3440"></rect>
</g>
<g class="rb-flybill"><rect x="56" y="70" width="10" height="5" rx="0.8" fill="#6bbb7b" stroke="#2f6b3c" stroke-width="0.5"></rect></g>` : '';
    return `<svg class="rb" viewBox="${vb}" aria-hidden="true" focusable="false">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B6F84"></stop><stop offset="1" stop-color="#14364F"></stop></linearGradient></defs>
${props}
<ellipse cx="40" cy="92" rx="20" ry="3" fill="rgba(0,0,0,0.35)"></ellipse>
<g class="rb-all">
<rect x="30" y="78" width="7" height="9" rx="3" fill="#0E2A40" stroke="#E3C98A" stroke-width="1.2"></rect><rect x="43" y="78" width="7" height="9" rx="3" fill="#0E2A40" stroke="#E3C98A" stroke-width="1.2"></rect>
<rect x="27" y="85" width="11" height="5" rx="2.2" fill="#111827" stroke="#E3C98A" stroke-width="0.8"></rect><rect x="42" y="85" width="11" height="5" rx="2.2" fill="#111827" stroke="#E3C98A" stroke-width="0.8"></rect>
<path class="rb-armdown" d="M26 62 q-8 4 -7 13" fill="none" stroke="#E3C98A" stroke-width="4" stroke-linecap="round"></path>
<path class="rb-armcount" d="M26 62 q-14 0 -26 2" fill="none" stroke="#E3C98A" stroke-width="4" stroke-linecap="round"></path>
<path d="M54 62 q8 4 7 13" fill="none" stroke="#E3C98A" stroke-width="4" stroke-linecap="round"></path>
<rect x="24" y="57" width="32" height="24" rx="9" fill="#F8FAFC" stroke="#E3C98A" stroke-width="1.4"></rect>
<path d="M24 66 q0 -9 9 -9 h3 l4 9 l4 -9 h3 q9 0 9 9 v6 q0 9 -9 9 h-14 q-9 0 -9 -9 z" fill="#12324a" stroke="#0b1724" stroke-width="0.8"></path>
<circle cx="40" cy="70" r="1.2" fill="#f2c230"></circle><circle cx="40" cy="75" r="1.2" fill="#f2c230"></circle>
<path d="M34 57.5 L40 60.5 L46 57.5 V63.5 L40 60.5 L34 63.5 Z" fill="#c0392b"></path><circle cx="40" cy="60.5" r="1.4" fill="#8e2a20"></circle>
<rect x="45.5" y="65" width="7" height="4.5" rx="1" fill="#f2c230"></rect>
<rect x="22.5" y="56" width="10" height="3.6" rx="1.2" fill="#f2c230" stroke="#a16207" stroke-width="0.5"></rect><rect x="47.5" y="56" width="10" height="3.6" rx="1.2" fill="#f2c230" stroke="#a16207" stroke-width="0.5"></rect>
<g class="rb-head">
<circle cx="15" cy="42" r="4.2" fill="#E3C98A"></circle><circle cx="65" cy="42" r="4.2" fill="#E3C98A"></circle>
<rect x="16" y="26" width="48" height="33" rx="14" fill="url(#${id})" stroke="#E3C98A" stroke-width="1.6"></rect>
<rect x="22" y="32" width="36" height="20" rx="10" fill="#07121C"></rect>
<g class="rb-eyes"><rect class="rb-eye" x="29" y="37" width="6" height="9" rx="3" fill="#5ED6C4"></rect><rect class="rb-eye" x="45" y="37" width="6" height="9" rx="3" fill="#5ED6C4"></rect></g>
<path d="M36 48 q4 3 8 0" fill="none" stroke="#5ED6C4" stroke-width="2" stroke-linecap="round"></path>
<path d="M10 21 Q40 2 70 21 Q68 27 61 28 H19 Q12 27 10 21 Z" fill="#12324a" stroke="#07121C" stroke-width="1"></path>
<path d="M16 17 Q40 6 64 17" fill="none" stroke="#2B6F84" stroke-width="1.2" opacity="0.7"></path>
<rect x="18" y="25" width="44" height="6" rx="1.5" fill="#0b1724"></rect><rect x="18" y="26.6" width="44" height="1.4" fill="#f2c230"></rect>
<path d="M22 31 Q40 38 58 31 L57 34 Q40 42 23 34 Z" fill="#05090f" stroke="#2a3a4a" stroke-width="0.6"></path>
<path d="M20 31.5 Q40 36 60 31.5" fill="none" stroke="#f2c230" stroke-width="1.1"></path>
<path d="M40 11 L46 15 H34 Z" fill="#f2c230"></path><rect x="34.5" y="15.5" width="11" height="1" fill="#f2c230"></rect>
<rect x="35.3" y="17" width="1.6" height="4.5" fill="#f2c230"></rect><rect x="39.2" y="17" width="1.6" height="4.5" fill="#f2c230"></rect><rect x="43.1" y="17" width="1.6" height="4.5" fill="#f2c230"></rect>
<rect x="34" y="22" width="12" height="1.4" fill="#f2c230"></rect>
</g>
<g class="rb-coin"><circle cx="61" cy="77" r="5.5" fill="#f2c230" stroke="#a16207" stroke-width="1"></circle><circle cx="61" cy="77" r="3" fill="none" stroke="#a16207" stroke-width="0.8"></circle></g>
<path class="rb-armup" d="M25 60 Q13 52 17 33" fill="none" stroke="#E3C98A" stroke-width="4" stroke-linecap="round"></path>
<text class="rb-z" x="64" y="20" font-size="9" font-weight="700" fill="#5ED6C4" font-family="Arial">z</text>
<text class="rb-z rb-z2" x="70" y="12" font-size="7" font-weight="700" fill="#5ED6C4" font-family="Arial">z</text>
</g>
</svg>`;
  }

  // ------------------------------------------------------------------ DOM
  const root = document.createElement('div');
  root.className = 'teller-root';
  root.innerHTML = `<div class="teller-stage">${robotSVG('rbMain', true)}<button type="button" class="teller-hit" aria-label="Ask the teller"></button><div class="teller-bubble" id="tellerBubble">Hi! Ask the teller</div></div>`;
  const panel = document.createElement('aside');
  panel.className = 'teller-panel'; panel.setAttribute('aria-label', 'Teller chat'); panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
  <div class="tp-head">${robotSVG('rbHead', false)}
    <div><div class="tp-title">Teller</div><div class="tp-status" id="tpStatus"></div></div>
    <button type="button" class="icon-btn ms-auto" id="tpGear" aria-label="Teller settings" title="AI settings"><i class="bi bi-sliders"></i></button>
    <button type="button" class="icon-btn" id="tpClose" aria-label="Close teller"><i class="bi bi-x-lg"></i></button>
  </div>
  <div class="tp-settings" id="tpSettings" hidden>
    <b>AI brain (optional)</b>
    <span class="help">Without a key the teller still answers simple asks. With a key he understands free text. The key stays only in this browser.</span>
    <label for="tpBrain" class="form-label mb-0">Service</label>
    <select id="tpBrain" class="form-select form-select-sm"></select>
    <label for="tpModel" class="form-label mb-0">Model</label><input id="tpModel" class="form-control form-control-sm">
    <div id="tpUrlRow"><label for="tpUrl" class="form-label mb-0">Address (ends with /v1)</label><input id="tpUrl" class="form-control form-control-sm"></div>
    <label for="tpKey" class="form-label mb-0">API key</label><input id="tpKey" type="password" class="form-control form-control-sm" autocomplete="off">
    <span class="help" id="tpKeyHelp"></span>
    <div class="d-flex gap-2"><button type="button" class="btn btn-gold btn-sm" id="tpSave">Save</button><button type="button" class="btn btn-ghost btn-sm" id="tpForget">Remove key</button></div>
  </div>
  <div class="tp-body" id="tpBody" aria-live="polite"></div>
  <div class="tp-foot">
    <div class="tp-chips">
      <button type="button" data-ask="What is waiting for payment?">Waiting payments</button>
      <button type="button" data-fill="PO ">Find a PO</button>
      <button type="button" data-fill="certificate PO ">Make a report</button>
      <button type="button" data-fill="new payment PO  certified  retention 10%">New payment</button>
    </div>
    <form class="tp-form" id="tpForm"><label for="tpInput" class="visually-hidden">Ask the teller</label>
      <input id="tpInput" class="form-control" placeholder="Ask the teller… e.g. unpaid on site 170" autocomplete="off">
      <button type="submit" class="tp-send" aria-label="Send"><i class="bi bi-send-fill"></i></button></form>
  </div>`;
  document.body.appendChild(root); document.body.appendChild(panel);

  // ------------------------------------------------------------------ idle behaviour
  const MODES = { look: 4000, coin: 2600, count: 5000, vault: 5200 };
  let lastActivity = Date.now(), lastNear = Date.now(), modeTimer = null, nextTimer = null, faded = false, dozing = false;
  const onPhone = () => window.matchMedia('(max-width: 768px)').matches;
  function setMode(m, ms) {
    clearTimeout(modeTimer);
    root.classList.remove('m-look', 'm-coin', 'm-count', 'm-vault', 'm-salute', 'm-doze');
    if (!m) return;
    void root.offsetWidth; // restart CSS animations
    root.classList.add('m-' + m);
    if (ms) modeTimer = setTimeout(() => root.classList.remove('m-' + m), ms);
  }
  function scheduleNext() {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => {
      if (!document.hidden && !panel.classList.contains('open') && !dozing) {
        const keys = Object.keys(MODES); const k = keys[Math.floor(Math.random() * keys.length)];
        setMode(k, MODES[k]);
      }
      scheduleNext();
    }, 15000 + Math.random() * 15000);
  }
  // any use of the app keeps him awake; only coming NEAR him (or tapping him) brings him back from see-through
  function active() { lastActivity = Date.now(); if (dozing) { dozing = false; setMode(null); } }
  function near() { active(); lastNear = Date.now(); if (faded) { faded = false; root.classList.remove('faded'); } }
  const wake = near;
  setInterval(() => {
    const now = Date.now();
    if (!faded && now - lastNear > (onPhone() ? 15000 : 60000)) { faded = true; root.classList.add('faded'); }
    if (!dozing && now - lastActivity > 180000) { dozing = true; setMode('doze'); }
  }, 3000);
  ['keydown', 'pointerdown', 'wheel', 'scroll'].forEach((ev) => document.addEventListener(ev, active, { passive: true }));
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = root.getBoundingClientRect();
    if (e.clientX > r.left - 140 && e.clientY > r.top - 140) near();
  }, { passive: true });
  function salute(text) {
    wake(); setMode('salute', 2700);
    if (text) { $('tellerBubble').textContent = text; root.classList.add('say'); setTimeout(() => { root.classList.remove('say'); $('tellerBubble').textContent = 'Hi! Ask the teller'; }, 3200); }
  }
  window.addEventListener('finance:ready', () => { const u = F().user(); const n = u && u.email ? u.email.split('@')[0] : ''; salute('Welcome' + (n ? ', ' + n.charAt(0).toUpperCase() + n.slice(1) : '') + '!'); scheduleNext(); });
  window.addEventListener('finance:saved', () => salute('Saved. Well done!'));
  root.querySelector('.teller-hit').addEventListener('click', openPanel);
  const navBtn = document.getElementById('tellerNavBtn'); if (navBtn) navBtn.addEventListener('click', openPanel);

  // ------------------------------------------------------------------ AI settings
  const BRAINS = {
    groq: { label: 'Groq (free)', url: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', help: 'console.groq.com > API Keys > Create API Key (starts with gsk_).' },
    openrouter: { label: 'OpenRouter (free models)', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-oss-20b:free', help: 'openrouter.ai > Keys > Create key (starts with sk-or-).' },
    gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', help: 'aistudio.google.com > Get API key.' },
    openai: { label: 'OpenAI (paid)', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', help: 'platform.openai.com > API keys.' },
    custom: { label: 'Other (OpenAI-compatible)', url: '', model: '', help: 'Any service that says "OpenAI-compatible".' }
  };
  const cfgKey = () => 'iba-fin-teller-ai-' + ((F() && F().user() && F().user().email) || 'anon').toLowerCase();
  function cfg() { try { return JSON.parse(localStorage.getItem(cfgKey()) || 'null') || { brain: 'groq', key: '', model: BRAINS.groq.model, url: BRAINS.groq.url }; } catch (e) { return { brain: 'groq', key: '' }; } }
  function saveCfg(c) { try { localStorage.setItem(cfgKey(), JSON.stringify(c)); } catch (e) { /* ignore */ } }
  function paintStatus() { const c = cfg(); const s = $('tpStatus'); s.textContent = c.key ? 'Online · AI on (' + (BRAINS[c.brain] || {}).label + ')' : 'Online · simple mode (no AI key)'; s.classList.toggle('off', !c.key); }
  function fillSettings() {
    const c = cfg();
    $('tpBrain').innerHTML = Object.entries(BRAINS).map(([k, b]) => `<option value="${k}" ${k === c.brain ? 'selected' : ''}>${esc(b.label)}</option>`).join('');
    $('tpModel').value = c.model || BRAINS[c.brain].model; $('tpUrl').value = c.url || BRAINS[c.brain].url; $('tpKey').value = c.key || '';
    $('tpUrlRow').hidden = c.brain !== 'custom'; $('tpKeyHelp').textContent = BRAINS[c.brain].help;
  }
  $('tpBrain').addEventListener('change', () => { const b = BRAINS[$('tpBrain').value]; $('tpModel').value = b.model; $('tpUrl').value = b.url; $('tpUrlRow').hidden = $('tpBrain').value !== 'custom'; $('tpKeyHelp').textContent = b.help; });
  $('tpGear').addEventListener('click', () => { const s = $('tpSettings'); s.hidden = !s.hidden; if (!s.hidden) fillSettings(); });
  $('tpSave').addEventListener('click', () => { const brain = $('tpBrain').value; saveCfg({ brain, model: $('tpModel').value.trim(), url: (brain === 'custom' ? $('tpUrl').value.trim() : BRAINS[brain].url).replace(/\/+$/, ''), key: $('tpKey').value.trim() }); $('tpSettings').hidden = true; paintStatus(); bot('Saved. ' + (cfg().key ? 'I can understand free text now.' : 'Simple mode.')); });
  $('tpForget').addEventListener('click', () => { const c = cfg(); c.key = ''; saveCfg(c); fillSettings(); paintStatus(); bot('Key removed from this browser.'); });

  // ------------------------------------------------------------------ chat
  const history = [];
  let greeted = false;
  function openPanel() {
    wake(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); root.classList.add('chat-open'); paintStatus();
    if (!greeted) { greeted = true; greet(); }
    setTimeout(() => $('tpInput').focus(), 250);
  }
  function closePanel() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); root.classList.remove('chat-open'); }
  $('tpClose').addEventListener('click', closePanel);
  let modalOpen = 0;
  document.addEventListener('show.bs.modal', () => { modalOpen++; });
  document.addEventListener('hidden.bs.modal', () => { modalOpen = Math.max(0, modalOpen - 1); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('open') && !modalOpen && !document.querySelector('.modal.show')) closePanel(); }, true);
  panel.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => ask(b.dataset.ask)));
  panel.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => { const i = $('tpInput'); i.value = b.dataset.fill; i.focus(); const pos = b.dataset.fill.indexOf('PO ') + 3; i.setSelectionRange(pos, pos); }));
  $('tpForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('tpInput').value.trim(); if (!t) return; $('tpInput').value = ''; ask(t); });

  function scrollDown() { const b = $('tpBody'); b.scrollTop = b.scrollHeight; }
  function me(text) { const d = document.createElement('div'); d.className = 'msg me'; d.textContent = text; $('tpBody').appendChild(d); scrollDown(); }
  /** bot(text, {list:[[left,right]], actions:[{label, gold, run}]}) */
  function bot(text, extra = {}) {
    const d = document.createElement('div'); d.className = 'msg bot';
    d.appendChild(document.createTextNode(text));
    if (extra.list && extra.list.length) {
      const l = document.createElement('div'); l.className = 'list';
      l.innerHTML = extra.list.map(([a, b]) => `<div class="li"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
      d.appendChild(l);
    }
    if (extra.actions && extra.actions.length) {
      const a = document.createElement('div'); a.className = 'acts';
      extra.actions.forEach((x) => { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = x.label; if (x.gold) btn.className = 'gold'; btn.addEventListener('click', () => { x.run(); if (window.matchMedia('(max-width: 768px)').matches) closePanel(); }); a.appendChild(btn); });
      d.appendChild(a);
    }
    $('tpBody').appendChild(d); scrollDown(); return d;
  }
  function greet() {
    const all = F().all(); const waiting = all.filter((r) => !F().isPaid(r));
    const u = F().user(); const n = u && u.email ? u.email.split('@')[0] : '';
    bot(`Good ${partOfDay()}${n ? ' ' + n.charAt(0).toUpperCase() + n.slice(1) : ''}. I'm your teller. ${waiting.length} payment${waiting.length === 1 ? ' is' : 's are'} waiting for a cheque.\n\nTry: "PO 41287", "unpaid on site 170", "certificate PO 41287 PVN 3" or "new payment PO 41287 certified 280k retention 10%".`);
  }
  function partOfDay() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }

  // ------------------------------------------------------------------ tools (shared by simple mode and AI)
  const T = {
    search(query, mode) {
      const c = mode ? { mode, value: query } : F().classify(query);
      if (!c) return { found: 0 };
      const recs = F().searchRecords(c.mode, c.value);
      const groups = F().groupPOs(recs).sort((a, b) => b.last.localeCompare(a.last));
      return { mode: c.mode, value: c.value, pos: groups.slice(0, 12).map((g) => ({ po: g.po, vendor: g.vendor, site: g.site, poValue: g.poValue, certified: g.certified, paid: g.paid, waiting: g.waiting, payments: g.count })), totalPOs: groups.length };
    },
    poSummary(po) {
      const recs = F().byPO(po); if (!recs.length) return { po, found: false };
      const g = F().groupPOs(recs)[0];
      return { po, found: true, vendor: g.vendor, vendorId: g.vendorId, site: g.site, poValue: g.poValue, certified: g.certified, paid: g.paid, waiting: g.waiting, retentionHeld: g.retention, remainingToCertify: g.poValue - g.certified, payments: recs.map((r) => ({ pvn: r.paymentNo, cheque: r.chequeNo || '', certified: F().toNum(r.certifiedAmount), retention: F().toNum(r.retention), net: F().toNum(r.payment), datePaid: r.datePaid || '', status: F().isPaid(r) ? 'paid' : 'waiting' })) };
    },
    waiting(scope) {
      let recs = F().all().filter((r) => !F().isPaid(r));
      if (scope && scope.value) { const ids = new Set(F().searchRecords(scope.mode, scope.value).map((r) => r.id)); recs = recs.filter((r) => ids.has(r.id)); }
      recs.sort((a, b) => String(a.poNo).localeCompare(String(b.poNo)));
      return { count: recs.length, total: recs.reduce((s, r) => s + F().toNum(r.payment), 0), items: recs.slice(0, 25).map((r) => ({ po: r.poNo, pvn: r.paymentNo, vendor: r.vendor, site: r.site, net: F().toNum(r.payment) })) };
    },
    certificate(po, pvn) {
      const recs = F().byPO(po); if (!recs.length) return { ok: false, reason: 'No payments for PO ' + po };
      let rec = recs[recs.length - 1];
      if (pvn) { const n = parseInt(String(pvn).replace(/\D/g, ''), 10); const hit = recs.find((r) => parseInt(String(r.paymentNo).replace(/\D/g, ''), 10) === n); if (!hit) return { ok: false, reason: `PO ${po} has no PVN-${n}` }; rec = hit; }
      F().showReport(rec); return { ok: true, opened: rec.paymentNo };
    },
    prepare(po, p) { F().openNewPayment(String(po), p); return { ok: true, filled: true, pvn: F().nextPVN(String(po)), note: 'Form filled, NOT saved. The person must check and press Save.' }; },
    open(po) { F().openPO(String(po)); return { ok: true }; }
  };
  const fm = (n) => F().money(n);

  // ------------------------------------------------------------------ simple mode (no key)
  function parseAmount(s) {
    if (!s) return null; const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
    if (!m) return null; let n = parseFloat(m[1]); const u = (m[2] || '').toLowerCase();
    if (u === 'k' || u === 'thousand') n *= 1e3; if (u === 'm' || u === 'million') n *= 1e6; return n;
  }
  function findScope(t) {
    const po = t.match(/\b(\d{5})\b/); if (po) return { mode: 'po', value: po[1] };
    const site = t.match(/\bsite\s*[:#-]?\s*([a-z]{0,3}\s?-?\d+[a-z]?)\b/i) || t.match(/\b([a-z]{1,3}-?\d{2,}[a-z]?)\b/i) || t.match(/\b(\d{1,4}|\d{6,})\b/);
    if (site) return { mode: 'site', value: site[1] };
    const v = t.match(/\b(?:for|from|vendor|of|to)\s+([a-z][a-z0-9 .&'-]{1,40})$/i); if (v) return { mode: 'vendor', value: v[1].trim() };
    return null;
  }
  function simple(text) {
    const t = text.trim(); const low = t.toLowerCase();
    if (/^(hi|hello|hey|salam|good (morning|afternoon|evening))\b/.test(low)) { greet(); return; }
    if (/^help|what can you do/.test(low)) { bot('I can find a PO, site or vendor, list what is waiting for payment, explain a PO, open a payment certificate and fill a new payment for you to check. I never save, edit or delete on my own.'); return; }
    if (/\b(new|make|add|create|prepare)\b.*\bpayment\b|\bpayment\b.*\bnew\b/.test(low)) {
      const po = (t.match(/\b(\d{5})\b/) || [])[1];
      if (!po) { bot('Which PO? For example: "new payment PO 41287 certified 280k retention 10%".'); return; }
      const cert = parseAmount((low.match(/(?:certified|cert|amount)\s*(?:amount)?\s*(?:of|=|:)?\s*([\d.,]+\s*(?:k|m|million|thousand)?)/) || [])[1]);
      const pct = (low.match(/retention\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*%/) || low.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
      const retAmt = !pct ? parseAmount((low.match(/retention\s*(?:of|=|:)?\s*([\d.,]+\s*(?:k|m)?)/) || [])[1]) : null;
      const p = {}; if (cert) p.certifiedAmount = cert; if (pct) p.retentionPct = pct; else if (retAmt) p.retention = retAmt;
      const r = T.prepare(po, p);
      bot(`I filled the New Payment form as ${r.pvn} for PO ${po}${cert ? `: certified ${fm(cert)}` : ''}${pct ? `, retention ${pct}%` : retAmt ? `, retention ${fm(retAmt)}` : ''}. Please check it and press Save.`);
      return;
    }
    if (/\b(certificate|report|print)\b/.test(low)) {
      const po = (t.match(/\b(\d{5})\b/) || [])[1];
      if (!po) { bot('Which PO? For example: "certificate PO 41287" or "certificate PO 41287 PVN 3".'); return; }
      const pvn = (low.match(/pvn\s*-?\s*(\d+)/) || [])[1];
      const r = T.certificate(po, pvn);
      bot(r.ok ? `Opened the certificate for PO ${po}, ${r.opened}.` : r.reason); return;
    }
    if (/\b(waiting|unpaid|pending|not paid|outstanding|no cheque)\b/.test(low)) {
      const scope = findScope(low.replace(/\b(waiting|unpaid|pending|payments?|not paid|outstanding|no cheque|what|is|are|on|in|the|for|show|me|list)\b/g, ' ').replace(/\s+/g, ' ').trim()) || null;
      const r = T.waiting(scope);
      const where = scope ? (scope.mode === 'po' ? ` on PO ${scope.value}` : scope.mode === 'site' ? ` on site ${scope.value}` : ` for ${scope.value}`) : '';
      if (!r.count) { bot(`Nothing is waiting${where}. Everything has a cheque or date paid.`); return; }
      bot(`${r.count} payment${r.count > 1 ? 's' : ''}${where} ha${r.count > 1 ? 've' : 's'} no cheque yet, ${fm(r.total)} in total.`, { list: r.items.slice(0, 8).map((i) => [`PO ${i.po} · ${i.pvn} · ${i.vendor || ''}`, fm(i.net)]), actions: r.items.slice(0, 3).map((i) => ({ label: `Open PO ${i.po}`, run: () => T.open(i.po) })) });
      return;
    }
    // plain search: "PO 41287", "site 170", "M1111", "Gulf Steel"
    const cleaned = t.replace(/^(find|search|show|open|look ?up|check|status|summary|how much|balance)\s+(of\s+|for\s+)?/i, '').replace(/^po\s*/i, '').trim();
    const c = F().classify(cleaned);
    if (!c) { bot('Tell me a PO number, a site or a vendor name.'); return; }
    if (c.mode === 'po') {
      const s = T.poSummary(c.value);
      if (!s.found) { bot(`No payments for PO ${c.value} yet.`, { actions: [{ label: `New payment for PO ${c.value}`, gold: true, run: () => T.prepare(c.value, {}) }] }); return; }
      bot(`PO ${s.po} · ${s.vendor}${s.site ? ' · Site ' + s.site : ''}\nPO value ${fm(s.poValue)}. Certified ${fm(s.certified)}. Paid ${fm(s.paid)}. Waiting ${fm(s.waiting)}. Retention held ${fm(s.retentionHeld)}.`,
        { actions: [{ label: 'Open PO', gold: true, run: () => T.open(s.po) }, { label: 'Certificate (latest)', run: () => T.certificate(s.po) }, { label: 'New payment', run: () => T.prepare(s.po, {}) }] });
      return;
    }
    const r = T.search(c.value, c.mode);
    if (!r.totalPOs) { bot(`I found nothing for ${c.mode} "${c.value}".`); return; }
    bot(`${c.mode === 'site' ? 'Site ' + c.value : '"' + c.value + '"'}: ${r.totalPOs} PO${r.totalPOs > 1 ? 's' : ''}.`, { list: r.pos.slice(0, 8).map((p) => [`PO ${p.po} · ${p.vendor}`, `${fm(p.waiting)} waiting`]), actions: [{ label: 'Show all', gold: true, run: () => F().runQuery(c.mode, c.value) }].concat(r.pos.slice(0, 2).map((p) => ({ label: `Open PO ${p.po}`, run: () => T.open(p.po) }))) });
  }

  // ------------------------------------------------------------------ AI mode
  const TOOLS = [
    { type: 'function', function: { name: 'search_records', description: 'Find POs by PO number (5 digits), site (e.g. 170, M1111) or vendor name. Returns PO totals.', parameters: { type: 'object', properties: { query: { type: 'string' }, mode: { type: 'string', enum: ['po', 'site', 'vendor'], description: 'optional; guessed when missing' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'po_summary', description: 'Full detail of one PO: value, certified, paid, waiting, retention and every PVN.', parameters: { type: 'object', properties: { po: { type: 'string' } }, required: ['po'] } } },
    { type: 'function', function: { name: 'list_waiting', description: 'Payments with no cheque number and no date paid. Optional scope by po, site or vendor.', parameters: { type: 'object', properties: { mode: { type: 'string', enum: ['po', 'site', 'vendor'] }, value: { type: 'string' } } } } },
    { type: 'function', function: { name: 'open_po', description: 'Show a PO on screen.', parameters: { type: 'object', properties: { po: { type: 'string' } }, required: ['po'] } } },
    { type: 'function', function: { name: 'open_certificate', description: 'Open the printable payment certificate of a PO, up to a PVN (latest when pvn is missing).', parameters: { type: 'object', properties: { po: { type: 'string' }, pvn: { type: 'string' } }, required: ['po'] } } },
    { type: 'function', function: { name: 'prepare_new_payment', description: 'Fill the New Payment form for the person to check. Never saves.', parameters: { type: 'object', properties: { po: { type: 'string' }, certifiedAmount: { type: 'number' }, retentionPercent: { type: 'number' }, retentionAmount: { type: 'number' }, chequeNo: { type: 'string' }, datePaid: { type: 'string', description: 'YYYY-MM-DD' }, note: { type: 'string' } }, required: ['po'] } } }
  ];
  function runTool(name, a) {
    switch (name) {
      case 'search_records': return T.search(a.query, a.mode);
      case 'po_summary': return T.poSummary(a.po);
      case 'list_waiting': return T.waiting(a.mode && a.value ? { mode: a.mode, value: a.value } : null);
      case 'open_po': return T.open(a.po);
      case 'open_certificate': return T.certificate(a.po, a.pvn);
      case 'prepare_new_payment': {
        const p = {}; if (a.certifiedAmount != null) p.certifiedAmount = a.certifiedAmount; if (a.retentionPercent != null) p.retentionPct = a.retentionPercent; else if (a.retentionAmount != null) p.retention = a.retentionAmount;
        ['chequeNo', 'datePaid', 'note'].forEach((k) => { if (a[k]) p[k] = a[k]; });
        return T.prepare(a.po, p);
      }
      default: return { error: 'unknown tool' };
    }
  }
  const SYSTEM = () => `You are "Teller", the assistant inside IBA Finance, a payment system for construction purchase orders. Today is ${new Date().toDateString()}.
Facts: a PO number is always 5 digits. A site is any other number or letters+number (170, 1111, M1111). Each payment has a PVN number (PVN-1, PVN-2...) per PO. "Waiting" means no cheque number and no date paid. Net payment = certified - retention.
Use the tools for every number; never invent records. You cannot save, edit or delete anything: prepare_new_payment only fills the form and the person presses Save. Answer briefly in plain English, with amounts formatted like 1,234.00. Do not use markdown tables.`;
  async function ai(text) {
    const c = cfg();
    history.push({ role: 'user', content: text });
    while (history.length > 12) history.shift();
    const msgs = [{ role: 'system', content: SYSTEM() }].concat(history);
    const typing = bot('…'); typing.classList.add('typing');
    try {
      for (let round = 0; round < 5; round++) {
        const res = await fetch(c.url + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key }, body: JSON.stringify({ model: c.model, messages: msgs, tools: TOOLS, tool_choice: 'auto', temperature: 0.2 }) });
        if (!res.ok) { const e = await res.text(); throw new Error(`${res.status} ${e.slice(0, 160)}`); }
        const data = await res.json();
        const m = data.choices && data.choices[0] && data.choices[0].message;
        if (!m) throw new Error('Empty answer');
        if (m.tool_calls && m.tool_calls.length) {
          msgs.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
          m.tool_calls.forEach((tc) => {
            let args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { /* bad json */ }
            let out; try { out = runTool(tc.function.name, args); } catch (e) { out = { error: e.message }; }
            msgs.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 12000) });
          });
          continue;
        }
        typing.remove();
        const answer = String(m.content || '').replace(/\*\*/g, '').trim() || 'Done.';
        history.push({ role: 'assistant', content: answer });
        bot(answer);
        return;
      }
      typing.remove(); bot('That took too many steps. Please ask in a simpler way.');
    } catch (err) {
      typing.remove();
      console.warn('teller ai', err);
      bot('The AI did not answer (' + err.message + '). I will answer in simple mode:');
      simple(text);
    }
  }

  function ask(text) {
    wake(); me(text);
    if (!F() || !F().user()) { bot('Please sign in first.'); return; }
    if (cfg().key) ai(text); else simple(text);
  }

  window.ibaTeller = { open: openPanel, close: closePanel, salute, setMode };
})();
