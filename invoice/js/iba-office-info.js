/* ==========================================================================
   js/iba-office-info.js — 18.0.0 patch 163 (martin picked sample A "Folders on the desk")
   The info robot's own search window. Click the big robot in the hall: a window opens in the
   middle of the office (over the 3D view, not in the side panel) with the robot head and a
   search box. Type a vendor, PO, invoice no. or site and press Search: the robot looks
   through the cabinets (short animation, the 3D robot spins), then lays ONE folder per
   department where it was found:
     Not paid yet:   Reception (new entries) · QS / Site (For SRV, Report, On hold...) ·
                     Management (CEO Approval, In Process) · IRWIN (your desk)
     Accounts:       With Accounts / Paid, last 3 months only; "Older records" shows the rest.
   Click a folder = its invoices. Each row: INV / SRV / LPO (PDF preview on the right with Print,
   js/iba-1800-pdfpanel.js), Remind / Do this now (a request card with a sound on that
   person's screen, js/iba-asks.js), Open (Invoice Records with that PO).
   Data = the office's saved invoice copy (window.ibaInvoiceEntriesLoad, no new reads). The
   only extra read is your own sent requests (iba_asks_sent/{you}, chat database, a few KB).
   Super Admin only: this file is loaded by the office, which only the Super Admin can open.
   ========================================================================== */
(function () {
'use strict';
if (window.ibaOfficeInfo) return;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const D = () => window.ibaOfficeData || null;
const DAY = 864e5, ACC_DAYS = 92;
const DEPTS = [
  { id: 'rec', name: 'Reception', sub: 'New entries', col: '#9FD7E0', grp: 'open' },
  { id: 'qs', name: 'QS / Site', sub: 'For SRV · Report · On hold', col: '#F3D48F', grp: 'open' },
  { id: 'mgmt', name: 'Management', sub: 'CEO Approval · In Process', col: '#F2B8A0', grp: 'open' },
  { id: 'me', name: 'IRWIN', sub: 'Your desk · For Approval', col: '#C9B6FF', grp: 'open' },
  { id: 'acc', name: 'Accounts', sub: 'With Accounts · Paid', col: '#A8E6C4', grp: 'done' },
];
const ACC_ST = /^(with accounts|paid|epicore close|epicor closed)$/i;
const SKIP_ST = /^(cancelled|canceled|closed|original po|retention)$/i;
const MGMT_ST = /^(ceo approval|in process)$/i;
const ME_ST = /^(under review|for approval)$/i;

const CSS = `
#iba-oinfo{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,8,14,.28)}
#iba-oinfo[hidden]{display:none}
#iba-oinfo .oi-win{width:min(1060px,100%);max-height:min(720px,100%);display:flex;flex-direction:column;background:rgba(22,28,44,.93);color:#EEF2FA;border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.55);font:14px/1.45 Inter,"Segoe UI",Arial,sans-serif;animation:oiIn .22s ease-out both}
@keyframes oiIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
#iba-oinfo .oi-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.12);background:linear-gradient(180deg,rgba(224,176,79,.14),transparent)}
#iba-oinfo .oi-bot{width:46px;height:46px;border-radius:50%;background:#F5F5F7;display:grid;place-items:center;flex:none;box-shadow:0 0 0 3px rgba(224,176,79,.55)}
#iba-oinfo .oi-bot i{width:31px;height:21px;border-radius:7px;background:#131826;display:flex;align-items:center;justify-content:center;gap:5px}
#iba-oinfo .oi-bot i b{width:6px;height:6px;border-radius:50%;background:#E0B04F}
#iba-oinfo .oi-bot.look i b{animation:oiLook 1s ease-in-out infinite}
@keyframes oiLook{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}
#iba-oinfo .oi-t{flex:1;min-width:0}
#iba-oinfo .oi-t b{display:block;font:700 16px "Space Grotesk",Inter,sans-serif}
#iba-oinfo .oi-t span{color:#9DA8BD;font-size:12px}
#iba-oinfo .oi-x{border:1px solid rgba(255,255,255,.16);background:none;color:#EEF2FA;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:15px}
#iba-oinfo form{display:flex;gap:8px;padding:12px 14px 6px}
#iba-oinfo form input{flex:1;min-width:0;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#EEF2FA;border-radius:11px;padding:10px 12px;font:600 14px Inter,sans-serif;outline:none}
#iba-oinfo form input:focus{border-color:#E0B04F}
#iba-oinfo .oi-clear{border:1px solid rgba(255,255,255,.18);border-radius:11px;background:rgba(255,255,255,.06);color:#EEF2FA;font:800 13px Inter,sans-serif;padding:0 14px;cursor:pointer}
#iba-oinfo .oi-go{border:0;border-radius:11px;background:#E0B04F;color:#1B2030;font:800 13px Inter,sans-serif;padding:0 18px;cursor:pointer}
#iba-oinfo .oi-status{padding:2px 14px 10px;color:#9DA8BD;font-size:12.5px;min-height:20px}
#iba-oinfo .oi-vend{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px}
#iba-oinfo .oi-vend:empty{display:none}
#iba-oinfo .oi-vend button{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#EEF2FA;border-radius:999px;padding:4px 11px;font:700 12px Inter,sans-serif;cursor:pointer}
#iba-oinfo .oi-vend button.on{background:#E0B04F;color:#1B2030;border-color:#E0B04F}
#iba-oinfo .oi-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);border-top:1px solid rgba(255,255,255,.12)}
#iba-oinfo .oi-left{padding:14px;min-width:0;display:flex;flex-direction:column;gap:12px;overflow:auto}
#iba-oinfo .oi-empty{margin:auto;color:#9DA8BD;text-align:center;max-width:42ch;font-size:13px;padding:30px 0}
#iba-oinfo .oi-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
#iba-oinfo .oi-fold{all:unset;cursor:pointer;position:relative;border-radius:4px 12px 12px 12px;padding:24px 11px 11px;min-height:92px;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;color:#1B2030;transform-origin:bottom;animation:oiDrop .45s cubic-bezier(.2,1.4,.4,1) both;box-shadow:0 6px 16px rgba(0,0,0,.3)}
#iba-oinfo .oi-fold::before{content:"";position:absolute;top:-8px;left:0;width:46%;height:12px;border-radius:6px 6px 0 0;background:inherit;filter:brightness(.88)}
#iba-oinfo .oi-fold b{font:800 14px Inter,sans-serif}
#iba-oinfo .oi-fold small{font-size:11.5px;opacity:.82}
#iba-oinfo .oi-fold .n{position:absolute;top:8px;right:9px;font:800 12px Inter,sans-serif;background:rgba(0,0,0,.18);border-radius:10px;padding:1px 8px}
#iba-oinfo .oi-fold.on{outline:3px solid #EEF2FA;outline-offset:2px}
#iba-oinfo .oi-fold:focus-visible{outline:3px solid #E0B04F;outline-offset:2px}
@keyframes oiDrop{from{opacity:0;transform:translateY(-22px) rotate(-6deg)}to{opacity:1;transform:none}}
#iba-oinfo .oi-grp{font:800 11px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#9DA8BD;display:flex;justify-content:space-between;gap:8px;align-items:center}
#iba-oinfo .oi-older{border:1px dashed rgba(255,255,255,.22);background:none;color:#C7CFDD;border-radius:9px;padding:5px 10px;cursor:pointer;font:700 12px Inter,sans-serif;text-transform:none;letter-spacing:0}
#iba-oinfo .oi-none{color:#7F8AA0;font-size:12.5px;padding:2px 0 4px}
#iba-oinfo .oi-list{display:flex;flex-direction:column;gap:6px}
#iba-oinfo .oi-lh{display:flex;justify-content:space-between;align-items:center;gap:8px;font:800 12px Inter,sans-serif;color:#E0B04F;margin-top:2px}
#iba-oinfo .oi-lh input{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#EEF2FA;border-radius:8px;padding:5px 9px;font:600 12px Inter,sans-serif;width:200px;max-width:50%}
#iba-oinfo .oi-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 10px}
#iba-oinfo .oi-row .l{min-width:0}
#iba-oinfo .oi-row .l b{font-size:13px}
#iba-oinfo .oi-row .l small{display:block;color:#9DA8BD;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#iba-oinfo .oi-pill{display:inline-block;font:700 10.5px Inter,sans-serif;padding:1px 7px;border-radius:9px;background:rgba(255,255,255,.1);margin-left:6px}
#iba-oinfo .oi-ask{display:inline-block;font:700 10.5px Inter,sans-serif;padding:1px 7px;border-radius:9px;margin-left:6px;background:rgba(224,176,79,.2);color:#F3D48F}
#iba-oinfo .oi-ask.yes{background:rgba(63,184,200,.2);color:#9FE8F0}
#iba-oinfo .oi-ask.done{background:rgba(76,195,138,.2);color:#A8E6C4}
#iba-oinfo .oi-acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
#iba-oinfo .oi-acts button{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#EEF2FA;border-radius:8px;padding:4px 9px;font:700 11.5px Inter,sans-serif;cursor:pointer}
#iba-oinfo .oi-acts button:disabled{opacity:.35;cursor:default}
#iba-oinfo .oi-acts .pdf{border-color:rgba(63,184,200,.6);color:#9FE8F0}
#iba-oinfo .oi-acts .ask{border-color:rgba(224,176,79,.6);color:#F3D48F}
#iba-oinfo .oi-acts .now{border-color:rgba(229,72,77,.7);color:#FFB3B5}
#iba-oinfo .oi-scan{display:flex;gap:10px;align-items:flex-end;height:74px;padding-top:6px}
#iba-oinfo .oi-cab{flex:1;height:64px;border-radius:6px;background:#3A2C22;border:2px solid #57412F;position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;font:800 10px Inter,sans-serif;color:#E9D7B8}
#iba-oinfo .oi-cab::after{content:"";position:absolute;left:20%;right:20%;top:38%;height:4px;border-radius:2px;background:#E0B04F;opacity:.7}
#iba-oinfo .oi-cab.hot{animation:oiShake .35s ease-in-out 2;border-color:#E0B04F}
@keyframes oiShake{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
#iba-oinfo .oi-form{display:flex;flex-direction:column;gap:8px;background:rgba(224,176,79,.08);border:1px solid rgba(224,176,79,.4);border-radius:10px;padding:10px;margin:2px 0 4px}
#iba-oinfo .oi-form textarea{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);color:#EEF2FA;border-radius:8px;padding:7px 9px;font:13px Inter,sans-serif;min-height:52px;resize:vertical}
#iba-oinfo .oi-form .r{display:flex;gap:6px;justify-content:flex-end;align-items:center;flex-wrap:wrap}
#iba-oinfo .oi-form .r span{flex:1;color:#C7CFDD;font-size:12px}
#iba-oinfo .oi-form button{border:0;border-radius:8px;padding:6px 12px;font:800 12px Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:#EEF2FA}
#iba-oinfo .oi-form button.send{background:#E0B04F;color:#1B2030}
#iba-oinfo .oi-form button.send.now{background:#E5484D;color:#fff}
#iba-oinfo .oi-msg{font-size:12.5px;padding:8px 10px;border-radius:10px;background:rgba(76,195,138,.15);border:1px solid rgba(76,195,138,.5)}
#iba-oinfo .oi-msg.bad{background:rgba(229,72,77,.15);border-color:rgba(229,72,77,.5)}
@media (max-width:760px){#iba-oinfo{padding:8px;align-items:flex-end}#iba-oinfo .oi-folders{grid-template-columns:repeat(2,minmax(0,1fr))}#iba-oinfo .oi-lh input{width:120px}}
@media (prefers-reduced-motion:reduce){#iba-oinfo *{animation:none!important}}
`;

let el = null, st = { q: '', hits: [], vendors: [], vendor: '', dept: '', older: false, ask: null, msg: '', sent: {} };
function build() {
  const host = document.getElementById('iba-office'); if (!host) return null;
  if (el && el.isConnected) return el;
  if (!document.getElementById('iba-oinfo-css')) { const s = document.createElement('style'); s.id = 'iba-oinfo-css'; s.textContent = CSS; document.head.appendChild(s); }
  el = document.createElement('div'); el.id = 'iba-oinfo'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'IBA Information');
  el.innerHTML = `<div class="oi-win">
    <div class="oi-head"><div class="oi-bot"><i><b></b><b></b></i></div><div class="oi-t"><b>IBA Information</b><span>Ask me where an invoice is: vendor, PO, invoice no. or site</span></div><button type="button" class="oi-x" aria-label="Close">✕</button></div>
    <form autocomplete="off"><input type="search" aria-label="Search vendor, PO, invoice no. or site" placeholder="e.g. khalifa · 67486 · site 175"><button type="button" class="oi-clear" title="Clear the search and the folders">Clear</button><button type="submit" class="oi-go">Search</button></form>
    <div class="oi-status"></div><div class="oi-vend"></div>
    <div class="oi-body"><div class="oi-left"><p class="oi-empty">Type a vendor and press Search. I look in every cabinet and put a folder on the desk for each department that has it.</p></div></div></div>`;
  host.appendChild(el);
  el.addEventListener('click', onClick);
  el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const q = el.querySelector('form input').value.trim(); if (q) search(q); });
  el.addEventListener('input', (e) => { if (e.target.matches('.oi-lh input')) paintList(e.target.value); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  return el;
}

// ---------------------------------------------------------------- search
function me() { const d = D(); return d ? d.me() : ''; }
function info(r) { const d = D(); return d ? d.poInfo(r.po, r) : { vendor: '', site: '' }; }
function when(r) { const d = D(); return d ? d.dateOf(r) : 0; }
function deptOf(r) {
  const s = String(r.status || '').trim();
  if (r.job) return 'rec';
  if (SKIP_ST.test(s)) return '';
  if (ACC_ST.test(s)) return 'acc';
  if (/^new entry$/i.test(s)) return 'rec';
  if (MGMT_ST.test(s)) return 'mgmt';
  if (ME_ST.test(s) || (me() && norm(r.attention) === norm(me()))) return 'me';
  return 'qs';
}
function match(term) {
  const d = D(); if (!d) return [];
  const all = d.rows().concat(d.jobs());
  const sm = term.match(/^(?:site|project)\s*(?:no\.?|#)?\s*(.+)$/i); const siteQ = sm ? norm(sm[1]) : '';
  const q = norm(term), digits = /^\d{4,}$/.test(term.trim());
  const F = window.ibaFuzzy && typeof window.ibaFuzzy.score === 'function' ? window.ibaFuzzy : null; const vs = {};
  return all.filter((r) => {
    if (digits) return String(r.po) === term.trim() || norm(r.invNumber) === q;
    const pi = info(r);
    if (siteQ) return norm(pi.site) === siteQ || norm(pi.site).includes(siteQ);
    if ([pi.vendor, pi.site, r.invNumber, r.po, r.invName].some((v) => norm(v).includes(q))) return true;
    if (F && pi.vendor) { if (vs[pi.vendor] == null) { try { vs[pi.vendor] = F.score(term, pi.vendor); } catch (_) { vs[pi.vendor] = 0; } } return vs[pi.vendor] >= .55; }
    return false;
  }).filter((r) => deptOf(r)).sort((a, b) => when(b) - when(a));
}
let searching = false;
async function search(q) {
  if (searching) return; searching = true;
  st = Object.assign(st, { q, hits: [], vendors: [], vendor: '', dept: '', older: false, ask: null, msg: '' });
  const bot = el.querySelector('.oi-bot'), left = el.querySelector('.oi-left');
  bot.classList.add('look'); setStatus('Looking through the cabinets…'); el.querySelector('.oi-vend').innerHTML = '';
  left.innerHTML = '<div class="oi-scan">' + DEPTS.map((x) => `<div class="oi-cab">${esc(x.name)}</div>`).join('') + '</div>';
  left.querySelectorAll('.oi-cab').forEach((c, i) => setTimeout(() => c.classList.add('hot'), i * 200));
  try { window.ibaOfficeKioskBusy = true; } catch (_) {}
  const d = D(); if (d && d.log) d.log(`You asked the info robot: "${esc(q)}"`);
  const t0 = Date.now();
  let hits = []; try { hits = match(q); } catch (e) { console.warn('[info robot] search', e); }
  loadSent(); // your sent requests (small, chat database)
  await new Promise((ok) => setTimeout(ok, Math.max(0, 1150 - (Date.now() - t0))));
  bot.classList.remove('look'); try { window.ibaOfficeKioskBusy = false; } catch (_) {}
  st.hits = hits;
  const cnt = {}; hits.forEach((r) => { const v = info(r).vendor || '(no vendor)'; cnt[v] = (cnt[v] || 0) + 1; });
  st.vendors = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).map((v) => [v, cnt[v]]);
  searching = false; paint();
}
function setStatus(t) { const s = el && el.querySelector('.oi-status'); if (s) s.innerHTML = t; }
function shown() { return st.vendor ? st.hits.filter((r) => (info(r).vendor || '(no vendor)') === st.vendor) : st.hits; }
function inDept(id, older) {
  const now = Date.now();
  return shown().filter((r) => deptOf(r) === id && (id !== 'acc' || (older ? when(r) < now - ACC_DAYS * DAY : when(r) >= now - ACC_DAYS * DAY || !when(r))));
}
function paint() {
  const left = el.querySelector('.oi-left');
  const vend = el.querySelector('.oi-vend');
  if (!st.hits.length) { setStatus(''); vend.innerHTML = ''; left.innerHTML = `<p class="oi-empty">I found nothing for "<b>${esc(st.q)}</b>" in the cabinets. Try part of the name, a PO number or "site 175".</p>`; return; }
  vend.innerHTML = st.vendors.length > 1 ? `<button type="button" data-v=""${st.vendor ? '' : ' class="on"'}>All (${st.hits.length})</button>` + st.vendors.slice(0, 8).map(([v, n]) => `<button type="button" data-v="${esc(v)}"${st.vendor === v ? ' class="on"' : ''}>${esc(v)} (${n})</button>`).join('') : '';
  const found = DEPTS.filter((x) => inDept(x.id).length);
  const oldAcc = inDept('acc', true);
  const name = st.vendor || (st.vendors.length === 1 ? st.vendors[0][0] : `"${st.q}"`);
  setStatus(found.length ? `Found <b>${esc(name)}</b> in ${found.length} department${found.length === 1 ? '' : 's'}.` : `Found <b>${esc(name)}</b> only in older Accounts records.`);
  const fold = (x) => `<button type="button" class="oi-fold${st.dept === x.id && !st.older ? ' on' : ''}" data-d="${x.id}" style="background:${x.col}"><span class="n">${inDept(x.id).length}</span><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></button>`;
  const open = found.filter((x) => x.grp === 'open'), done = found.filter((x) => x.grp === 'done');
  left.innerHTML = `<div class="oi-grp"><span>Not paid yet</span></div>${open.length ? `<div class="oi-folders">${open.map(fold).join('')}</div>` : '<div class="oi-none">Nothing open: every invoice of this vendor is with Accounts or paid.</div>'}
    <div class="oi-grp"><span>With Accounts / Paid · last 3 months</span>${oldAcc.length ? `<button type="button" class="oi-older${st.older ? ' on' : ''}">Older records (${oldAcc.length})</button>` : ''}</div>
    ${done.length ? `<div class="oi-folders">${done.map(fold).join('')}</div>` : '<div class="oi-none">Nothing with Accounts or paid in the last 3 months.</div>'}
    <div class="oi-lst"></div>`;
  if (!st.dept && found.length === 1) st.dept = found[0].id;
  if (st.dept || st.older) paintList('');
}
function curList() { return st.older ? inDept('acc', true) : st.dept ? inDept(st.dept) : []; }
function money(v) { const d = D(); return d && d.money ? d.money(v) : String(v || ''); }
function fmt(t) { if (!t) return ''; const d = new Date(t); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'); }
function hasName(n) { const s = String(n || '').trim(); return !!s && !/^nil$/i.test(s); }
function askOf(r) { const list = Object.values(st.sent || {}).filter((a) => a && a.po === String(r.po) && (a.key === r.key || (!a.key && r.job))); list.sort((a, b) => (b.at || 0) - (a.at || 0)); return list[0] || null; }
function askPill(r) {
  const a = askOf(r); if (!a) return '';
  if (a.state === 'done') return `<span class="oi-ask done">Done by ${esc(a.to)} ${esc(fmtTime(a.doneAt))}</span>`;
  if (a.state === 'yes') return `<span class="oi-ask yes">${esc(a.to)} is working on it</span>`;
  return `<span class="oi-ask">${a.kind === 'now' ? 'Do this now' : 'Reminder'} sent · waiting</span>`;
}
function fmtTime(t) { if (!t) return ''; const d = new Date(t); const h = d.getHours(); return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function rowHtml(r, i) {
  const pi = info(r), who = String(r.attention || '').trim(), paid = /^paid$/i.test(String(r.status || '')), mine = norm(who) === norm(me());
  const canAsk = who && !mine && !paid && !!window.ibaAsks;
  const noAsk = !who ? 'Nobody is named on this invoice' : mine ? 'This one is with you' : paid ? 'Already paid' : 'Requests are not loaded';
  const form = st.ask && st.ask.i === i ? `<div class="oi-form" style="grid-column:1/-1"><div class="r"><span><b>${st.ask.kind === 'now' ? 'Do this now' : 'Remind'}</b> → ${esc(who)}'s screen, with a sound. They answer Yes, it stays in their tasks until they press Complete.</span></div>
      <textarea maxlength="300" placeholder="Note (optional), e.g. please send the SRV today">${esc(st.ask.note || '')}</textarea>
      <div class="r"><button type="button" data-cancel>Cancel</button><button type="button" class="send${st.ask.kind === 'now' ? ' now' : ''}" data-send="${i}">Send to ${esc(who)}</button></div></div>` : '';
  return `<div class="oi-row"><div class="l"><b>PO ${esc(r.po)} · ${esc(r.invNumber || (r.job ? 'new entry' : r.key))}</b><span class="oi-pill">${esc(r.job ? 'Reception' : r.status || '')}</span>${askPill(r)}
      <small>QAR ${esc(money(r.invValue))} · ${esc(pi.vendor || '')}${pi.site ? ' · site ' + esc(pi.site) : ''} · with ${esc(who || 'nobody')} · ${esc(fmt(when(r)))}</small></div>
    <div class="oi-acts"><button type="button" class="pdf" data-pv="INV" data-i="${i}"${hasName(r.invName) ? '' : ' disabled title="No invoice PDF name yet"'}>INV</button><button type="button" class="pdf" data-pv="SRV" data-i="${i}"${hasName(r.srvName) ? '' : ' disabled title="No SRV PDF name yet"'}>SRV</button>
<button type="button" class="pdf" data-pv="LPO" data-i="${i}" title="The LPO of PO ${esc(r.po)}">LPO</button>
      <button type="button" class="ask" data-ask="remind" data-i="${i}"${canAsk ? '' : ` disabled title="${esc(noAsk)}"`}>Remind</button><button type="button" class="now" data-ask="now" data-i="${i}"${canAsk ? '' : ` disabled title="${esc(noAsk)}"`}>Do this now</button>
      ${r.job ? '' : `<button type="button" data-open="${i}" title="Invoice Records with this PO">Open</button>`}</div>${form}</div>`;
}
let lastFilter = '';
function paintList(filter) {
  lastFilter = filter || '';
  const box = el.querySelector('.oi-lst'); if (!box) return;
  const list = curList(); const t = norm(lastFilter);
  const pick = t ? list.filter((r) => { const pi = info(r); return [r.po, r.invNumber, pi.vendor, pi.site, r.attention, r.status, r.invValue].some((v) => norm(v).includes(t)); }) : list;
  const dep = st.older ? 'Accounts · older than 3 months' : (DEPTS.find((x) => x.id === st.dept) || {}).name || '';
  const MAX = 120, rows = pick.slice(0, MAX);
  const hadFocus = document.activeElement && document.activeElement.matches && document.activeElement.matches('.oi-lh input');
  box.innerHTML = `<div class="oi-lh"><span>${esc(dep)} · ${pick.length} invoice${pick.length === 1 ? '' : 's'}${pick.length > MAX ? ' · newest ' + MAX : ''}</span><input type="search" placeholder="Narrow: PO, inv no., site…" value="${esc(lastFilter)}" aria-label="Narrow the list"></div>
    ${st.msg ? `<div class="oi-msg${st.msg.bad ? ' bad' : ''}">${st.msg.html}</div>` : ''}<div class="oi-list">${rows.map((r) => rowHtml(r, list.indexOf(r))).join('') || '<div class="oi-none">Nothing matches.</div>'}</div>`;
  if (hadFocus) { const i = box.querySelector('.oi-lh input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

// ---------------------------------------------------------------- requests (js/iba-asks.js)
async function loadSent() { try { if (window.ibaAsks && window.ibaAsks.sentList) { st.sent = await window.ibaAsks.sentList(); if (el && !el.hidden && (st.dept || st.older)) paintList(lastFilter); } } catch (e) { console.warn('[info robot] sent list', e); } }
async function send(i) {
  const r = curList()[i]; if (!r || !st.ask) return; const pi = info(r);
  const ta = el.querySelector('.oi-form textarea'); const note = ta ? ta.value.trim() : '';
  const kind = st.ask.kind;
  const b = el.querySelector('[data-send]'); if (b) { b.disabled = true; b.textContent = 'Sending…'; }
  try {
    const a = await window.ibaAsks.send({ kind, to: String(r.attention || '').trim(), po: String(r.po), key: r.job ? '' : r.key, inv: r.invNumber || '', vendor: pi.vendor || '', site: pi.site || '', status: r.job ? 'Reception · New entry' : (r.status || ''), value: r.invValue ? money(r.invValue) : '', note });
    st.sent[a.id] = a; st.ask = null;
    st.msg = { html: `<b>${kind === 'now' ? 'Do this now' : 'Reminder'}</b> sent to <b>${esc(a.to)}</b>'s screen with a sound. PO ${esc(r.po)}${r.invNumber ? ' · ' + esc(r.invNumber) : ''}. You get a message here when they press Complete.` };
    const d = D(); if (d && d.log) d.log(`Info robot sent <b>${kind === 'now' ? 'Do this now' : 'Remind'}</b> to <b>${esc(a.to)}</b> for PO ${esc(r.po)}.`);
  } catch (e) { st.msg = { bad: true, html: 'Not sent: ' + esc((e && e.message) || e) }; }
  paintList(lastFilter);
}

function scrollList() { const x = el.querySelector('.oi-lst'); if (x) setTimeout(() => { try { x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} }, 30); }
// ---------------------------------------------------------------- clicks
function onClick(e) {
  if (e.target === el) { close(); return; }
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.classList.contains('oi-x')) return close();
  if (b.classList.contains('oi-clear')) return clear();
  if (b.hasAttribute('data-v')) { st.vendor = b.getAttribute('data-v'); st.dept = ''; st.older = false; st.ask = null; st.msg = ''; return paint(); }
  if (b.classList.contains('oi-fold')) { st.dept = b.dataset.d; st.older = false; st.ask = null; st.msg = ''; el.querySelectorAll('.oi-fold').forEach((x) => x.classList.toggle('on', x === b)); el.querySelectorAll('.oi-older').forEach((x) => x.classList.remove('on')); paintList(''); return scrollList(); }
  if (b.classList.contains('oi-older')) { st.older = true; st.dept = ''; st.ask = null; st.msg = ''; el.querySelectorAll('.oi-fold').forEach((x) => x.classList.remove('on')); b.classList.add('on'); paintList(''); return scrollList(); }
  if (b.hasAttribute('data-cancel')) { st.ask = null; return paintList(lastFilter); }
  if (b.hasAttribute('data-send')) return send(+b.getAttribute('data-send'));
  const i = b.hasAttribute('data-i') ? +b.getAttribute('data-i') : b.hasAttribute('data-open') ? +b.getAttribute('data-open') : -1;
  const r = i >= 0 ? curList()[i] : null; if (!r) return;
  if (b.hasAttribute('data-open')) { const d = D(); close(); if (d && d.openRecords) d.openRecords(r.po); return; }
  if (b.dataset.pv) {
    const P = window.ibaPdfPanel; const pi = info(r);
    const name = b.dataset.pv === 'INV' ? r.invName : b.dataset.pv === 'SRV' ? r.srvName : '';
    if (P && b.dataset.pv === 'LPO' && !P.inPanel('LPO')) { if (window.ibaFindLpo && window.ibaFindLpo.open) { window.ibaFindLpo.open(String(r.po)); } return; }
    if (P) P.open({ kind: b.dataset.pv, name, po: r.po, site: pi.site, invEntryID: r.invEntryID || '', title: `${b.dataset.pv} · PO ${r.po}${r.invNumber ? ' · ' + r.invNumber : ''}` });
    return;
  }
  if (b.dataset.ask) { st.ask = st.ask && st.ask.i === i && st.ask.kind === b.dataset.ask ? null : { i, kind: b.dataset.ask }; st.msg = ''; paintList(lastFilter); const t = el.querySelector('.oi-form textarea'); if (t) t.focus(); }
}

const EMPTY = '<p class="oi-empty">Type a vendor and press Search. I look in every cabinet and put a folder on the desk for each department that has it.</p>';
function clear() {
  if (searching) return;
  st = Object.assign(st, { q: '', hits: [], vendors: [], vendor: '', dept: '', older: false, ask: null, msg: '' });
  const inp = el.querySelector('form input'); inp.value = ''; setStatus(''); el.querySelector('.oi-vend').innerHTML = '';
  el.querySelector('.oi-left').innerHTML = EMPTY; if (window.ibaPdfPanel) window.ibaPdfPanel.close(); try { inp.focus(); } catch (_) {}
}
function open(q) {
  if (!build()) return; el.hidden = false;
  const inp = el.querySelector('form input');
  if (q) { inp.value = q; search(q); }
  setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 60);
  loadSent();
}
function close() { if (!el) return; el.hidden = true; try { window.ibaOfficeKioskBusy = false; } catch (_) {} if (window.ibaPdfPanel) window.ibaPdfPanel.close(); }
window.addEventListener('iba-asks-back', () => { if (el && !el.hidden) loadSent(); });
window.ibaOfficeInfo = { open, close, search: (q) => open(q), isOpen: () => !!(el && !el.hidden) };
})();
