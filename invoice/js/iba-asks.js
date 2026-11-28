/* ==========================================================================
   js/iba-asks.js — 18.0.0 patch 163 (martin): Remind / Do this now requests
   Sent from the info robot search window (IBA Office). Loaded for EVERYONE, so the
   person holding the invoice gets it on their own screen:
   1. A request card pops up in the middle with a sound (it rings every 4 s for up to a
      minute): "Irwin asks: Do this now · PO 67486 · INV-123 · For SRV" + the note.
      They press "Yes, I'll work on it" (or Later: the card closes, the red pill stays).
   2. A Yes request sits in their "Tasks from Irwin" pill (bottom centre) until they press
      Complete.
   3. Complete sends a done message back: the sender gets a toast with a sound,
      "Done by Imran · 10:42 AM", and the request shows Done in the search window.
   All of it lives in the CHAT database (ibachat-f1250, js/iba-chat-db.js), never the main one:
     iba_asks/{person}/{id}        the request (state new / yes / done)
     iba_asks_sent/{sender}/{id}   the sender's copy (same state, read by the search window)
     iba_asks_back/{sender}/{id}   "yes" / "done" notes for the sender (removed once shown)
   Reads: each person listens to their own two small nodes (last 30 requests); done
   requests older than 3 days are removed by the person. Needs the new rules pasted into
   ibachat-f1250 (Realtime Database > Rules), see chat-database-rules.json of patch 163.
   ========================================================================== */
(function () {
'use strict';
if (window.ibaAsks) return;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (n) => String(n || '').trim().replace(/[.#$\[\]\/\\]/g, '_').replace(/\s+/g, '_');
const KEEP_DONE = 3 * 864e5;
function cdb() { return window.ibaChatDb || null; }
function me() { try { return String((typeof currentApprover !== 'undefined' && currentApprover && currentApprover.Name) || '').trim(); } catch (_) { return ''; } }
function TS() { return firebase.database.ServerValue.TIMESTAMP; }
function ampm(t) { const d = new Date(Number(t) || Date.now()); const h = d.getHours(); return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }

const CSS = `
#iba-ask-card{position:fixed;inset:0;z-index:2147480080;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,14,.35)}
#iba-ask-card[hidden]{display:none}
#iba-ask-card .w{width:min(440px,100%);background:rgba(22,28,44,.96);color:#EEF2FA;border:1px solid rgba(224,176,79,.55);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);padding:16px 18px;font:14px/1.45 Inter,"Segoe UI",Arial,sans-serif;animation:askIn .25s cubic-bezier(.2,1.3,.4,1) both}
#iba-ask-card .w.now{border-color:#E5484D;box-shadow:0 0 0 4px rgba(229,72,77,.25),0 24px 70px rgba(0,0,0,.55)}
@keyframes askIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
#iba-ask-card .t{display:flex;gap:10px;align-items:center;margin-bottom:10px}
#iba-ask-card .t i{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(224,176,79,.18);color:#E0B04F;font-size:18px;flex:none;font-style:normal;animation:askBell 1s ease-in-out infinite}
#iba-ask-card .w.now .t i{background:rgba(229,72,77,.2);color:#FF8A8E}
@keyframes askBell{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-6deg)}}
#iba-ask-card .t b{display:block;font:800 16px "Space Grotesk",Inter,sans-serif}
#iba-ask-card .t small{color:#9DA8BD}
#iba-ask-card .d{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 11px;font-size:13px}
#iba-ask-card .d b{font-size:14px}
#iba-ask-card .n{margin-top:8px;padding:8px 11px;border-left:3px solid #E0B04F;background:rgba(224,176,79,.08);border-radius:6px;font-size:13px;white-space:pre-wrap}
#iba-ask-card .a{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
#iba-ask-card button{border:0;border-radius:10px;padding:9px 14px;font:800 13px Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:#EEF2FA}
#iba-ask-card button.y{background:#E0B04F;color:#1B2030}
#iba-ask-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:2147480070;font:13px/1.4 Inter,"Segoe UI",Arial,sans-serif}
#iba-ask-pill[hidden]{display:none}
#iba-ask-pill>button{display:flex;gap:8px;align-items:center;border:1px solid rgba(224,176,79,.6);background:rgba(22,28,44,.95);color:#F3D48F;border-radius:999px;padding:8px 14px;font:800 13px Inter,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#iba-ask-pill>button em{font-style:normal;background:#E5484D;color:#fff;border-radius:9px;padding:0 7px;font-size:11.5px}
#iba-ask-pill .p{position:absolute;left:50%;transform:translateX(-50%);bottom:46px;width:min(420px,calc(100vw - 28px));max-height:60vh;overflow:auto;background:rgba(22,28,44,.97);color:#EEF2FA;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px;box-shadow:0 18px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:8px}
#iba-ask-pill .p[hidden]{display:none}
#iba-ask-pill .p h4{margin:2px 2px 0;font:800 13px Inter,sans-serif;color:#E0B04F}
#iba-ask-pill .it{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 10px}
#iba-ask-pill .it.now{border-left:3px solid #E5484D}
#iba-ask-pill .it small{display:block;color:#9DA8BD;font-size:11.5px}
#iba-ask-pill .it .n{font-size:12.5px;color:#C7CFDD;margin-top:3px;white-space:pre-wrap}
#iba-ask-pill .it .r{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
#iba-ask-pill .it button{border:0;border-radius:8px;padding:5px 11px;font:800 12px Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:#EEF2FA}
#iba-ask-pill .it button.y{background:#E0B04F;color:#1B2030}
#iba-ask-pill .it button.c{background:#4CC38A;color:#06210F}
#iba-ask-toast{position:fixed;right:16px;bottom:16px;z-index:2147480090;display:flex;flex-direction:column;gap:8px;font:13.5px/1.4 Inter,"Segoe UI",Arial,sans-serif}
#iba-ask-toast div{background:rgba(22,28,44,.97);color:#EEF2FA;border:1px solid rgba(76,195,138,.6);border-left:4px solid #4CC38A;border-radius:12px;padding:10px 14px;box-shadow:0 12px 34px rgba(0,0,0,.45);max-width:360px;animation:askIn .25s ease-out both;cursor:pointer}
#iba-ask-toast div.yes{border-color:rgba(63,184,200,.6);border-left-color:#3FB8C8}
body.iba-mobile-ui #iba-ask-pill{bottom:76px}
`;
function css() { if (document.getElementById('iba-ask-css')) return; const s = document.createElement('style'); s.id = 'iba-ask-css'; s.textContent = CSS; document.head.appendChild(s); }

// ---------------------------------------------------------------- sound (made by the browser, no file)
let actx = null, ring = 0, ringEnd = 0, wait = null;
function chime(urgent) {
  const c = actx, t0 = c.currentTime + .05;
  (urgent ? [[0, 988], [.16, 1319], [.32, 988], [.48, 1319]] : [[0, 880], [.22, 1175], [.44, 1568]]).forEach(([dt, f]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(.32, t0 + dt + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dt + .8);
    o.connect(g); g.connect(c.destination); o.start(t0 + dt); o.stop(t0 + dt + .85);
  });
}
function stopRing() { clearInterval(ring); clearTimeout(ringEnd); ring = 0; if (wait) { document.removeEventListener('pointerdown', wait, true); document.removeEventListener('keydown', wait, true); wait = null; } }
function startRing(urgent, once) {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  try { if (!actx) actx = new C(); } catch (_) { return; }
  stopRing();
  const go = () => { chime(urgent); if (once) return; ring = setInterval(() => { if (actx.state === 'running') chime(urgent); }, 4000); ringEnd = setTimeout(stopRing, 60000); };
  if (actx.state === 'running') { go(); return; }
  // browsers allow sound only after the first click / key on the page
  wait = () => { actx.resume().then(() => { if (actx.state === 'running') { document.removeEventListener('pointerdown', wait, true); document.removeEventListener('keydown', wait, true); wait = null; go(); } }).catch(() => {}); };
  document.addEventListener('pointerdown', wait, true); document.addEventListener('keydown', wait, true);
  actx.resume().then(() => { if (actx.state === 'running' && wait) wait(); }).catch(() => {});
}

// ---------------------------------------------------------------- sending (info robot)
async function send(o) {
  const d = cdb(); if (!d) throw new Error('the chat database is not connected on this page');
  const from = me(), to = String(o.to || '').trim(); if (!from || !to) throw new Error('no person to send it to');
  const ref = d.ref('iba_asks/' + safe(to)).push();
  const a = { id: ref.key, kind: o.kind === 'now' ? 'now' : 'remind', from, to, po: String(o.po || ''), key: String(o.key || ''), inv: String(o.inv || ''), vendor: String(o.vendor || '').slice(0, 80),
    site: String(o.site || ''), status: String(o.status || ''), value: String(o.value || ''), note: String(o.note || '').slice(0, 300), state: 'new', at: TS() };
  const upd = {}; upd['iba_asks/' + safe(to) + '/' + ref.key] = a; upd['iba_asks_sent/' + safe(from) + '/' + ref.key] = a;
  await d.ref().update(upd);
  return Object.assign({}, a, { at: Date.now() });
}
async function sentList() {
  const d = cdb(), m = me(); if (!d || !m) return {};
  const s = await d.ref('iba_asks_sent/' + safe(m)).limitToLast(100).once('value');
  const v = s.val() || {}; const out = {}; Object.keys(v).forEach((k) => { if (v[k]) out[k] = Object.assign({ id: k }, v[k]); });
  // tidy: the sender's copies older than 30 days
  const old = Object.keys(out).filter((k) => Number(out[k].at) < Date.now() - 30 * 864e5);
  if (old.length) { const u = {}; old.forEach((k) => { u[k] = null; delete out[k]; }); d.ref('iba_asks_sent/' + safe(m)).update(u).catch(() => {}); }
  return out;
}

// ---------------------------------------------------------------- receiving
let who = '', inRef = null, backRef = null, list = [], shownCard = '', panelOpen = false;
const SEEN_KEY = 'iba-asks-seen-v1';
function seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (_) { return []; } }
function markSeen(id) { try { const s = seen(); if (s.indexOf(id) < 0) { s.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-80))); } } catch (_) {} }
function stop() { try { if (inRef) inRef.off(); if (backRef) backRef.off(); } catch (_) {} inRef = backRef = null; list = []; who = ''; paintPill(); hideCard(); }
function start(name) {
  const d = cdb(); if (!d || !name) return;
  who = name; css();
  inRef = d.ref('iba_asks/' + safe(name)).limitToLast(30);
  inRef.on('value', (s) => {
    const v = s.val() || {};
    list = Object.keys(v).map((k) => Object.assign({ id: k }, v[k] || {})).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
    const gone = list.filter((a) => a.state === 'done' && Number(a.doneAt) < Date.now() - KEEP_DONE);
    if (gone.length) { const u = {}; gone.forEach((a) => { u[a.id] = null; }); d.ref('iba_asks/' + safe(name)).update(u).catch(() => {}); }
    paintPill();
    const fresh = list.find((a) => a.state === 'new' && seen().indexOf(a.id) < 0);
    if (fresh && shownCard !== fresh.id) showCard(fresh);
  }, (e) => console.warn('[requests] no access to iba_asks (paste the patch 163 chat rules)', e && e.message));
  backRef = d.ref('iba_asks_back/' + safe(name));
  backRef.on('child_added', (s) => {
    const b = s.val() || {}; s.ref.remove().catch(() => {});
    if (!b || Number(b.at) < Date.now() - 7 * 864e5) return;
    toast(b);
  });
}
function line(a) { return `PO ${esc(a.po)}${a.inv ? ' · ' + esc(a.inv) : ''}${a.status ? ' · ' + esc(a.status) : ''}`; }
function sub(a) { return [a.vendor, a.site ? 'site ' + a.site : '', a.value ? 'QAR ' + a.value : ''].filter(Boolean).map(esc).join(' · '); }
function showCard(a) {
  css(); let c = document.getElementById('iba-ask-card');
  if (!c) { c = document.createElement('div'); c.id = 'iba-ask-card'; c.setAttribute('role', 'alertdialog'); document.body.appendChild(c); c.addEventListener('click', cardClick); }
  shownCard = a.id; const now = a.kind === 'now';
  c.innerHTML = `<div class="w${now ? ' now' : ''}" aria-live="assertive"><div class="t"><i>🔔</i><div><b>${esc(a.from)} asks: ${now ? 'Do this now' : 'Reminder'}</b><small>${esc(ampm(a.at))}</small></div></div>
    <div class="d"><b>${line(a)}</b><br><small>${sub(a)}</small></div>${a.note ? `<div class="n">${esc(a.note)}</div>` : ''}
    <div class="a"><button type="button" data-later="${esc(a.id)}">Later</button><button type="button" class="y" data-yes="${esc(a.id)}">Yes, I'll work on it</button></div></div>`;
  c.hidden = false; startRing(now);
  setTimeout(() => { const y = c.querySelector('.y'); if (y) try { y.focus(); } catch (_) {} }, 50);
}
function hideCard() { const c = document.getElementById('iba-ask-card'); if (c) c.hidden = true; shownCard = ''; stopRing(); }
function cardClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.getAttribute('data-yes') || b.getAttribute('data-later'); if (!id) return;
  markSeen(id); hideCard();
  if (b.hasAttribute('data-yes')) answer(id, 'yes');
  const next = list.find((a) => a.state === 'new' && seen().indexOf(a.id) < 0); if (next) setTimeout(() => showCard(next), 400);
}
async function answer(id, what) {
  const d = cdb(), a = list.find((x) => x.id === id); if (!d || !a) return;
  const stamp = TS(), u = {};
  const mine = 'iba_asks/' + safe(who) + '/' + id, theirs = 'iba_asks_sent/' + safe(a.from) + '/' + id;
  u[mine + '/state'] = what; u[theirs + '/state'] = what;
  u[mine + '/' + (what === 'done' ? 'doneAt' : 'yesAt')] = stamp; u[theirs + '/' + (what === 'done' ? 'doneAt' : 'yesAt')] = stamp;
  u['iba_asks_back/' + safe(a.from) + '/' + id + '_' + what] = { what, by: who, po: a.po, inv: a.inv, kind: a.kind, at: stamp };
  try { await d.ref().update(u); } catch (e) { console.warn('[requests] answer', e); alert('Could not save your answer: ' + ((e && e.message) || e)); }
}
function toast(b) {
  css(); let t = document.getElementById('iba-ask-toast'); if (!t) { t = document.createElement('div'); t.id = 'iba-ask-toast'; document.body.appendChild(t); }
  const div = document.createElement('div'); if (b.what === 'yes') div.className = 'yes';
  div.innerHTML = b.what === 'done' ? `✅ <b>Done by ${esc(b.by)}</b> · ${esc(ampm(b.at))}<br><small>PO ${esc(b.po)}${b.inv ? ' · ' + esc(b.inv) : ''}</small>`
    : `👍 <b>${esc(b.by)}</b> is working on it · ${esc(ampm(b.at))}<br><small>PO ${esc(b.po)}${b.inv ? ' · ' + esc(b.inv) : ''}</small>`;
  div.addEventListener('click', () => div.remove()); t.appendChild(div);
  setTimeout(() => div.remove(), b.what === 'done' ? 20000 : 9000);
  if (b.what === 'done') startRing(false, true);
  try { window.dispatchEvent(new CustomEvent('iba-asks-back', { detail: b })); } catch (_) {}
}
function paintPill() {
  const open = list.filter((a) => a.state === 'new' || a.state === 'yes');
  let p = document.getElementById('iba-ask-pill');
  if (!open.length) { if (p) p.hidden = true; panelOpen = false; return; }
  css();
  if (!p) { p = document.createElement('div'); p.id = 'iba-ask-pill'; document.body.appendChild(p); p.addEventListener('click', pillClick); }
  const nNew = open.filter((a) => a.state === 'new').length, froms = Array.from(new Set(open.map((a) => a.from)));
  p.hidden = false;
  p.innerHTML = `<button type="button" data-tg aria-expanded="${panelOpen}">📋 Tasks from ${esc(froms.length === 1 ? froms[0] : 'the office')} (${open.length})${nNew ? ` <em>${nNew} new</em>` : ''}</button>
    <div class="p"${panelOpen ? '' : ' hidden'}><h4>Requests for you</h4>${open.map((a) => `<div class="it${a.kind === 'now' ? ' now' : ''}"><b>${a.kind === 'now' ? 'Do this now' : 'Reminder'} · ${line(a)}</b><small>from ${esc(a.from)} · ${esc(ampm(a.at))}${a.state === 'yes' ? ' · you said Yes ' + esc(ampm(a.yesAt)) : ''}</small><small>${sub(a)}</small>${a.note ? `<div class="n">${esc(a.note)}</div>` : ''}
      <div class="r">${a.state === 'new' ? `<button type="button" class="y" data-yes="${esc(a.id)}">Yes, I'll work on it</button>` : `<button type="button" class="c" data-done="${esc(a.id)}">Complete</button>`}</div></div>`).join('')}</div>`;
}
function pillClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-tg')) { panelOpen = !panelOpen; return paintPill(); }
  const y = b.getAttribute('data-yes'), dn = b.getAttribute('data-done');
  if (y) { markSeen(y); if (shownCard === y) hideCard(); answer(y, 'yes'); }
  if (dn) { b.disabled = true; b.textContent = 'Sending…'; answer(dn, 'done'); }
}
// follow the signed-in person (sign in / out / switch user)
setInterval(() => { const n = me(); if (n === who) return; if (who) stop(); if (n && cdb()) start(n); }, 3000);
window.ibaAsks = { send, sentList, list: () => list.slice(), _show: showCard };
})();
