/* ==========================================================================
   js/iba-office-print.js — 18.0.0 patch 140 (martin: "Ready to Print" bot)
   IBA Office (Super Admin only). Loaded by js/iba-office.js when the office opens.

   1. Trigger: every office refresh between 8:30 AM and 6:00 PM (Qatar time) the
      bot looks in the saved invoice copy for invoices that are Approved, have an
      ESN, are back with you (Attention = you or your stand-in) and are not site
      flow. Each one gets ONE queue row per ESN in
      system_settings/office_print_queue/{PO}_{key} (Firebase transaction), so
      re-saves never stage it again. A later approval (new ESN) stages it again.
      Approvals from before the first run are not staged by themselves (they may
      already be on paper): the tray offers "Add older approved".
   2. The printer in your office = "Ready to Print". Each row: the PDF found in
      DC Files\INVOICE (or the problem / a pick list), the ESN place (1st ESN
      Middle, 2nd Right bottom, 3rd Right middle; you can change it), Preview,
      Print, Skip.
   3. Print: page 1 only + the same QR sticker as the Print ESN window, drawn into
      the page (pdf-lib), sent to the small Windows helper, which prints it on
      THE NEW BLACK. Queue row -> printed, a history line on the invoice and an
      office log line. "Print again" asks first. The invoice status is not changed.
   The Windows helper (others\print-helper\iba-print-helper.ps1) is the only
   thing that touches your PC: it reads the INVOICE folder and prints.
   ========================================================================== */
(function () {
'use strict';
if (window.ibaOfficePrint) return;
const VERSION = '18.0.0-p140';
const ROOT = 'system_settings/office_print_queue';
const HELPER = 'http://localhost:47123';
const TOKEN_KEY = 'iba-print-helper-token-v1';
const PRINTER = 'THE NEW BLACK';
const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const PLACES = [['M', 'Middle'], ['RB', 'Right bottom'], ['RM', 'Right middle'], ['RT', 'Right top'], ['L', 'Left']];
// mm from the paper edges, same as the Print ESN window (js/iba-1702-esn.js PLACE_CSS)
const PLACE_MM = { L: { left: 10, bottom: 20 }, M: { center: true, bottom: 20 }, RB: { right: 10, bottom: 20 }, RM: { right: 10, bottom: 39 }, RT: { right: 10, bottom: 58 } };
const STICKER_W = 46, STICKER_H = 14.6;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
const G = (n) => { try { return eval('typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined'); } catch (_) { return undefined; } };
const mainDb = () => G('db') || window.db || null;
const invDb = () => G('invoiceDb') || window.invoiceDb || null;
const me = () => { const u = G('currentApprover') || window.currentApprover || {}; return String(u.Name || 'Irwin').trim(); };
const safe = (v) => String(v || '').replace(/[.#$\[\]\/\\]/g, '_');
const idOf = (po, key) => safe(po) + '_' + safe(key);
const placeName = (k) => (PLACES.find((p) => p[0] === k) || [k, k])[1];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function money(v) { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
function qatarNow() { try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()); const h = +p.find((x) => x.type === 'hour').value, m = +p.find((x) => x.type === 'minute').value; return h * 60 + m; } catch (_) { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); } }
function inHours() { const t = qatarNow(); return t >= 8 * 60 + 30 && t < 18 * 60; }
function clock(t) { if (!t) return ''; const d = new Date(Number(t)); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + ((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? ' AM' : ' PM'); }

// ---------------------------------------------------------------- who / which
function forMe(att) { const A = window.ibaApprovals; try { if (A && A.namedForMe) return A.namedForMe(att); } catch (_) {} return norm(att).includes(norm(me())); }
function approvedAt(r) { const d = r.approvalDecision || {}; return Number(d.timestamp) || Number(r.statusChangedAt) || 0; }
function slots(r) { const n = Number(r.approvalCount); return n > 0 ? n : 1; }
function defaultPlace(r) { const n = slots(r); return n <= 1 ? 'M' : n === 2 ? 'RB' : 'RM'; }
function wants(r) {
  return r && norm(r.status) === 'approved' && String(r.esn || '').trim() && r.approvalFlow !== 'site' && !r.esnState && forMe(r.attention);
}

// ---------------------------------------------------------------- queue
let Qd = {}, meta = {}, ctx = null, busyIds = {};
async function loadQueue() {
  const d = mainDb(); if (!d) return Qd;
  const v = (await d.ref(ROOT).once('value')).val() || {};
  meta = v._meta || {}; delete v._meta; Qd = v; return Qd;
}
function rowsOf(state) { return Object.keys(Qd).map((k) => Object.assign({ id: k }, Qd[k])).filter((x) => !state || x.state === state || (state === 'staged' && (x.state === 'error' || x.state === 'printing'))); }
function count() { return rowsOf('staged').length; }

async function stage(r, why) {
  const id = idOf(r.po, r.key), esn = String(r.esn).trim();
  // fresh read of the one invoice: the saved copy can be minutes old
  let inv = r; try { const s = (await invDb().ref(`invoice_entries/${r.po}/${r.key}`).once('value')).val(); if (s) inv = Object.assign({ po: r.po, key: r.key }, s); } catch (_) {}
  if (!wants(inv) || String(inv.esn).trim() !== esn) return false;
  const pi = (ctx && ctx.poInfo) ? ctx.poInfo(r.po, inv) : {};
  const res = await mainDb().ref(`${ROOT}/${id}`).transaction((cur) => {
    if (cur && cur.esn === esn) return; // already staged / printed / skipped for this ESN
    return { esn, state: 'staged', place: defaultPlace(inv), po: String(r.po), key: String(r.key), invNumber: inv.invNumber || '', invName: inv.invName || '', invEntryID: inv.invEntryID || '',
      vendor: pi.vendor || inv.vendorName || '', site: String(pi.site || inv.site || ''), value: inv.invValue || '', approver: inv.last_approver || '', approvals: slots(inv),
      stagedAt: Date.now(), stagedBy: why || 'bot', prev: cur && cur.state === 'printed' ? { esn: cur.esn || '', printedAt: cur.printedAt || 0, place: cur.place || '' } : null };
  });
  if (res.committed) Qd[id] = res.snapshot.val();
  return res.committed;
}
// rows = every invoice in the office's saved copy (no extra download)
let scanning = false, olderN = 0, olderList = [];
async function scan(rows, c, force) {
  if (c) ctx = c; if (scanning) return 0; scanning = true; let n = 0;
  try {
    await loadQueue();
    if (!meta.startedAt) { meta.startedAt = Date.now(); try { await mainDb().ref(ROOT + '/_meta').update({ startedAt: meta.startedAt, by: me() }); } catch (_) {} }
    const cand = (rows || []).filter((r) => wants(r) && !((Qd[idOf(r.po, r.key)] || {}).esn === String(r.esn).trim()));
    olderList = cand.filter((r) => approvedAt(r) && approvedAt(r) < meta.startedAt); olderN = olderList.length;
    if (!inHours() && !force) return 0;
    for (const r of cand.filter((x) => !(approvedAt(x) && approvedAt(x) < meta.startedAt))) { try { if (await stage(r)) n++; } catch (e) { console.warn('[ready to print] stage', r.po, e); } }
    if (n && ctx && ctx.log) ctx.log(`<b>Rafi</b> put ${n} approved invoice${n > 1 ? 's' : ''} on <b>Ready to Print</b>. Nothing prints until you press Print.`);
    if (n && ctx && ctx.botSay) ctx.botSay('Rafi', `${n} ready to print`);
  } finally { scanning = false; }
  return n;
}

// ---------------------------------------------------------------- helper on the PC
function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } }
async function helper(path, opts) {
  opts = opts || {}; const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try {
    const res = await fetch(HELPER + path, { method: opts.method || 'GET', body: opts.body, signal: ctl.signal, headers: Object.assign({ 'X-IBA-Token': token() }, opts.headers || {}) });
    if (opts.bytes) { if (!res.ok) throw new Error((await res.text()) || ('Helper error ' + res.status)); return new Uint8Array(await res.arrayBuffer()); }
    const j = await res.json().catch(() => ({ ok: false, error: 'Helper answered in a way I did not understand.' }));
    if (!res.ok || j.ok === false) throw new Error(j.error || ('Helper error ' + res.status));
    return j;
  } catch (e) { if (e.name === 'AbortError') throw new Error('The print helper did not answer in time.'); if (e instanceof TypeError) throw new Error('The print helper is not running on this PC.'); throw e; }
  finally { clearTimeout(t); }
}
let health = null;
async function checkHelper() { try { health = await helper('/health', { timeout: 4000 }); } catch (e) { health = { ok: false, error: e.message }; } return health; }
function baseName(name) { const f = G('getSharePointPdfBaseName'); if (typeof f === 'function') return f(name); return String(name || '').replace(/\s*\.pdf\s*$/i, '').replace(/\s+/g, ' ').trim(); }
async function findPdf(x) {
  const name = baseName(x.invName);
  if (!name || norm(name) === 'nil') return { found: null, candidates: [], problem: 'This invoice has no invoice name (Nil), so there is no PDF to look for.' };
  const prefix = [x.site, x.po, x.invEntryID].filter(Boolean).join('-');
  const j = await helper('/find?name=' + encodeURIComponent(name + '.pdf') + '&prefix=' + encodeURIComponent(prefix));
  return { found: j.found || null, how: j.how || '', candidates: j.candidates || [], problem: j.found ? '' : (j.candidates && j.candidates.length ? 'No PDF with exactly this name. Pick the right one.' : 'No PDF with this name in DC Files\\INVOICE.') };
}

// ---------------------------------------------------------------- the sticker (same look as design A)
let libP = null;
function pdfLib() { if (window.PDFLib) return Promise.resolve(window.PDFLib); if (libP) return libP; libP = new Promise((ok, bad) => { const s = document.createElement('script'); s.src = PDFLIB; s.onload = () => ok(window.PDFLib); s.onerror = () => { libP = null; bad(new Error('The PDF tool did not load. Check the internet connection.')); }; document.head.appendChild(s); }); return libP; }
function qrPng(text) {
  if (typeof QRCode !== 'function' || !text) return '';
  const h = document.createElement('div'); h.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(h);
  try { new QRCode(h, { text: String(text), width: 256, height: 256, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0 }); const c = h.querySelector('canvas'), i = h.querySelector('img'); return (c && c.toDataURL) ? c.toDataURL('image/png') : (i ? i.src : ''); }
  catch (_) { return ''; } finally { h.remove(); }
}
async function stickerFor(x) {
  let list = [];
  try { list = (await window.handlePrintSticker(x.key, 'Invoice', x.po, { position: '4', collect: true })) || []; } catch (e) { console.warn('[ready to print] stickers', e); }
  const E = window.ibaEsnFlow; if (E && E.addTimes && list.length) { try { await E.addTimes(list); } catch (_) {} }
  const s = list.find((y) => String(y.esn || '').trim() === x.esn) || list.find((y) => String(y.esn || '').endsWith(x.esn)) || null;
  if (s) return s;
  return { esn: x.esn, approverName: x.approver || '', poDisplay: x.po, invoiceOrdinal: '01', when: '' };
}
const MM = 72 / 25.4;
async function stampPage1(bytes, x, place) {
  const L = await pdfLib(); const { PDFDocument, rgb, StandardFonts, degrees } = L;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  if (!src.getPageCount()) throw new Error('The PDF has no pages.');
  const out = await PDFDocument.create();
  const sp = src.getPage(0), box = sp.getCropBox ? sp.getCropBox() : sp.getMediaBox(), rot = ((sp.getRotation().angle % 360) + 360) % 360;
  const emb = await out.embedPage(sp, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height });
  const side = rot === 90 || rot === 270; const Wv = side ? box.height : box.width, Hv = side ? box.width : box.height;
  const page = out.addPage([Wv, Hv]);
  // the page as it looks on screen (its /Rotate applied), then the sticker on top
  if (rot === 0) page.drawPage(emb, { x: 0, y: 0 });
  else if (rot === 90) page.drawPage(emb, { x: 0, y: Hv, rotate: degrees(-90) });
  else if (rot === 180) page.drawPage(emb, { x: Wv, y: Hv, rotate: degrees(180) });
  else page.drawPage(emb, { x: Wv, y: 0, rotate: degrees(90) });
  const s = await stickerFor(x);
  const P = PLACE_MM[place] || PLACE_MM.M, w = STICKER_W * MM, h = STICKER_H * MM;
  const left = P.center ? (Wv - w) / 2 : P.right != null ? Wv - P.right * MM - w : P.left * MM, bottom = P.bottom * MM;
  const ink = rgb(0.067, 0.067, 0.067), green = rgb(0.06, 0.42, 0.18);
  const bold = await out.embedFont(StandardFonts.HelveticaBold), mono = await out.embedFont(StandardFonts.CourierBold);
  page.drawRectangle({ x: left, y: bottom, width: w, height: h, color: rgb(1, 1, 1), borderColor: ink, borderWidth: 0.4 * MM });
  const qs = 12.6 * MM, pad = 1 * MM, qx = left + pad, qy = bottom + (h - qs) / 2;
  const png = qrPng(s.pdf || s.esn);
  if (png) { const img = await out.embedPng(png); page.drawImage(img, { x: qx, y: qy, width: qs, height: qs }); }
  else page.drawText('ESN', { x: qx + 2, y: qy + qs / 2 - 3, size: 6.5, font: bold, color: ink });
  const div = qx + qs + pad; page.drawLine({ start: { x: div, y: bottom }, end: { x: div, y: bottom + h }, thickness: 0.4 * MM, color: ink });
  const tx = div + 1.5 * MM, tw = left + w - tx - 1.2 * MM; let ty = bottom + h - 0.8 * MM;
  const fit = (text, font, size) => { let z = size; while (z > 4 && font.widthOfTextAtSize(text, z) > tw) z -= 0.2; return z; };
  const line = (text, font, size, color, gap) => { const z = fit(text, font, size); ty -= z * 0.95; page.drawText(text, { x: tx, y: ty, size: z, font, color }); ty -= gap || 0; };
  line('APPROVED', bold, 9.1, green, 0.4 * MM);
  line('PO ' + String(s.poDisplay || x.po) + ' · INV ' + String(s.invoiceOrdinal || '01').padStart(2, '0'), bold, 7, ink, 0.35 * MM);
  line(String(s.esn || x.esn), mono, 6.7, ink, 0.6 * MM);
  page.drawLine({ start: { x: tx, y: ty }, end: { x: left + w - 1.2 * MM, y: ty }, thickness: 0.2 * MM, color: rgb(0.53, 0.53, 0.53) });
  ty -= 0.4 * MM; line(String(s.when || s.date || ''), bold, 5.8, ink);
  return await out.save();
}

// ---------------------------------------------------------------- preview (pdf.js, already on the page)
async function renderPreview(bytes, canvas) {
  if (!window.pdfjsLib) throw new Error('The PDF viewer is not loaded on this page.');
  const doc = await window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const p = await doc.getPage(1);
  const v0 = p.getViewport({ scale: 1 }), sc = Math.min(2, 760 / v0.width), v = p.getViewport({ scale: sc });
  canvas.width = Math.round(v.width); canvas.height = Math.round(v.height); await p.render({ canvasContext: canvas.getContext('2d'), viewport: v }).promise;
}

// ---------------------------------------------------------------- print one
async function prepare(x, place) {
  let file = x.file || '';
  if (!file) { const f = await findPdf(x); if (!f.found) { const err = new Error(f.problem); err.candidates = f.candidates; throw err; } file = f.found; }
  const raw = await helper('/pdf?file=' + encodeURIComponent(file), { bytes: true, timeout: 60000 });
  const bytes = await stampPage1(raw, x, place);
  return { file, bytes };
}
async function claim(x, again) {
  const ref = mainDb().ref(`${ROOT}/${x.id}`), who = me();
  const r = await ref.transaction((cur) => {
    if (!cur || cur.esn !== x.esn) return;
    const stale = cur.state === 'printing' && Date.now() - Number(cur.claimAt || 0) > 5 * 60000;
    if (cur.state === 'staged' || cur.state === 'error' || stale || (again && cur.state === 'printed') || (again && cur.state === 'skipped')) return Object.assign({}, cur, { state: 'printing', claimAt: Date.now(), claimBy: who });
    return;
  });
  return r.committed;
}
async function printOne(x, place, again) {
  if (busyIds[x.id]) return; busyIds[x.id] = true;
  const ref = mainDb().ref(`${ROOT}/${x.id}`);
  try {
    if (!(await claim(x, again))) { await loadQueue(); paint(); ctx.log(`PO ${esc(x.po)}: already printed or printing. Nothing sent.`); return; }
    setRow(x.id, 'Getting the PDF…');
    // the invoice must still be approved with this ESN
    const inv = (await invDb().ref(`invoice_entries/${x.po}/${x.key}`).once('value')).val() || {};
    if (String(inv.esn || '').trim() !== x.esn) throw new Error('The ESN on this invoice changed. Refresh the office.');
    const p = await prepare(x, place);
    setRow(x.id, 'Printing page 1…');
    await helper('/print?job=' + encodeURIComponent(x.id + '_' + x.esn.replace(/[^A-Za-z0-9]/g, '')) + (again ? '&again=1' : ''), { method: 'POST', body: p.bytes, headers: { 'Content-Type': 'application/pdf' }, timeout: 90000 });
    const upd = { state: 'printed', place, file: p.file, printedAt: Date.now(), printedBy: me(), printer: PRINTER, error: null, claimAt: null, claimBy: null, again: again ? (Number(x.again || 0) + 1) : (x.again || 0) };
    await ref.update(upd); Object.assign(Qd[x.id] = Qd[x.id] || {}, x, upd);
    try { if (window.logInvoiceHistory) await window.logInvoiceHistory(x.po, x.key, inv.status || 'Approved', `${again ? 'Printed again' : 'Printed'}: ESN ${x.esn} on page 1 (${placeName(place)}) to ${PRINTER} by ${me()} · IBA Office`); } catch (_) {}
    ctx.log(`<b>Rafi</b> printed PO ${esc(x.po)} ${esc(x.invNumber || '')} page 1 with the ESN (${esc(placeName(place))}) on ${PRINTER}.`);
    if (ctx.botWalk) ctx.botWalk('Rafi', 'Printed PO ' + x.po);
  } catch (e) {
    console.warn('[ready to print] print', x.po, e);
    try { await ref.update({ state: 'error', error: String(e.message || e).slice(0, 300), claimAt: null, claimBy: null }); Object.assign(Qd[x.id] || {}, { state: 'error', error: e.message }); } catch (_) {}
    if (e.candidates) tmp[x.id] = { candidates: e.candidates };
    ctx.log(`PO ${esc(x.po)}: not printed. ${esc(e.message || e)}`);
  } finally { busyIds[x.id] = false; paint(); if (ctx.refreshSum) ctx.refreshSum(); }
}

// ---------------------------------------------------------------- tray UI
let tmp = {}, showDone = false, body = null;
function setRow(id, txt) { const el = body && body.querySelector(`tr[data-id="${CSS.escape(id)}"] .iba-rtp-msg`); if (el) el.textContent = txt; }
async function open(c) {
  ctx = c || ctx; body = ctx.body; tmp = {};
  ctx.title('Printer · Ready to Print');
  ctx.note('Approved invoices with an ESN that came back to you. Check the PDF and the place, then Print: page 1 only, with the ESN sticker, on ' + PRINTER + '. Nothing prints by itself.');
  body.innerHTML = '<div class="iba-rtp-load">Reading the list…</div>'; ctx.show();
  await Promise.all([loadQueue(), checkHelper()]);
  paint();
}
function helperBar() {
  if (health && health.ok) return `<div class="iba-rtp-helper is-ok">Print helper connected · printer <b>${esc(health.printer || PRINTER)}</b> ${health.printerFound === false ? '<em>not found on this PC</em>' : 'ready'}${health.folderFound === false ? ' · <em>INVOICE folder not found</em>' : ''}</div>`;
  const tokenBad = health && /token/i.test(health.error || '');
  return `<div class="iba-rtp-helper is-bad"><b>${tokenBad ? 'The helper needs its key.' : 'Print helper not running on this PC.'}</b> ${tokenBad ? 'Paste the key it showed when it started:' : 'Run others\\print-helper\\Install print helper.bat once (after that it starts with Windows by itself), paste its key, then press Check:'} <input type="password" class="iba-rtp-token" placeholder="Helper key" value="${esc(token())}" aria-label="Helper key"> <button type="button" data-rtp="check">Check</button></div>`;
}
function paint() {
  if (!body || !body.isConnected) return;
  const open = rowsOf('staged').sort((a, b) => String(a.site).localeCompare(String(b.site), undefined, { numeric: true }) || String(a.po).localeCompare(String(b.po), undefined, { numeric: true }));
  const done = rowsOf().filter((x) => x.state === 'printed' || x.state === 'skipped').sort((a, b) => (b.printedAt || b.skippedAt || 0) - (a.printedAt || a.skippedAt || 0)).slice(0, 40);
  const ready = health && health.ok;
  const row = (x) => { const t = tmp[x.id] || {}; const place = t.place || x.place || 'M'; const cands = t.candidates || [];
    const st = x.state === 'printing' ? 'Printing…' : x.state === 'error' ? `<span class="iba-rtp-err">${esc(x.error || 'Did not print')}</span>` : '';
    const fileCell = x.file ? `<span title="Picked">${esc(x.file)}</span>` : cands.length ? `<select data-f="file"><option value="">Pick the PDF…</option>${cands.map((n) => `<option>${esc(n)}</option>`).join('')}</select>` : `<span class="iba-rtp-name">${esc(baseName(x.invName) || '(no name)')}.pdf</span>`;
    return `<tr data-id="${esc(x.id)}"><td><b>${esc(x.po)}</b><br><small>${esc(x.invNumber || '')}</small></td><td>${esc(x.vendor || '')}<br><small>Site ${esc(x.site || '')}</small></td><td class="n">${esc(money(x.value))}</td>
      <td><span class="iba-rtp-esn">${esc(x.esn)}</span><br><small>${esc(x.approver || '')}${x.approvals > 1 ? ` · approval ${x.approvals}` : ''}${x.prev ? ' · earlier ESN printed ' + esc(clock(x.prev.printedAt)) : ''}</small></td>
      <td>${fileCell}<br><small class="iba-rtp-msg">${st}</small></td>
      <td><select data-f="place">${PLACES.map(([k, l]) => `<option value="${k}" ${k === place ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td class="iba-rtp-act"><button type="button" data-rtp="preview" ${ready ? '' : 'disabled'}>Preview</button><button type="button" data-rtp="print" class="is-go" ${ready && x.state !== 'printing' ? '' : 'disabled'}>Print</button><button type="button" data-rtp="skip">Skip</button></td></tr>`; };
  const doneRow = (x) => `<tr data-id="${esc(x.id)}"><td><b>${esc(x.po)}</b><br><small>${esc(x.invNumber || '')}</small></td><td>${esc(x.vendor || '')}</td><td>${esc(x.esn)}</td><td>${x.state === 'printed' ? `Printed ${esc(clock(x.printedAt))} · ${esc(placeName(x.place))}${x.again ? ' · again ×' + x.again : ''}` : 'Skipped ' + esc(clock(x.skippedAt))}</td><td class="iba-rtp-act">${x.state === 'printed' ? `<button type="button" data-rtp="again" ${ready ? '' : 'disabled'}>Print again</button>` : '<button type="button" data-rtp="unskip">Back to the list</button>'}</td></tr>`;
  body.innerHTML = helperBar()
    + `<div class="iba-rtp-head"><span>${open.length} ready to print${inHours() ? '' : ' · the bot looks for new ones 8:30 AM – 6:00 PM'}</span>${olderN ? `<button type="button" data-rtp="older" title="Approved before Ready to Print started; they may already be on paper">Add older approved (${olderN})</button>` : ''}<button type="button" data-rtp="basket">Print basket</button></div>`
    + (open.length ? `<div class="iba-off-rows"><table class="iba-off-tray iba-rtp"><thead><tr><th>PO</th><th>Vendor · Site</th><th>Value</th><th>ESN</th><th>PDF (DC Files\\INVOICE)</th><th>ESN place</th><th></th></tr></thead><tbody>${open.map(row).join('')}</tbody></table></div>` : '<div class="iba-off-empty">Nothing waiting. New approvals land here by themselves.</div>')
    + `<div class="iba-rtp-prev" hidden><div class="iba-rtp-prevh"><b></b><button type="button" data-rtp="closeprev">Close preview</button></div><canvas></canvas></div>`
    + `<details class="iba-rtp-done" ${showDone ? 'open' : ''}><summary>Printed and skipped (${done.length})</summary>${done.length ? `<table class="iba-off-tray"><tbody>${done.map(doneRow).join('')}</tbody></table>` : '<div class="iba-off-empty">None yet.</div>'}</details>`;
}
function rowOf(el) { const tr = el.closest('tr[data-id]'); return tr ? Object.assign({ id: tr.dataset.id }, Qd[tr.dataset.id] || {}) : null; }
async function onClick(e) {
  if (!body || !body.contains(e.target)) return;
  const b = e.target.closest('[data-rtp]'); if (!b) return; const act = b.dataset.rtp, x = rowOf(b);
  if (act === 'check') { const t = body.querySelector('.iba-rtp-token'); if (t) { try { localStorage.setItem(TOKEN_KEY, t.value.trim()); } catch (_) {} } b.textContent = 'Checking…'; await checkHelper(); paint(); return; }
  if (act === 'basket') { if (ctx.basket) ctx.basket(); return; }
  if (act === 'closeprev') { body.querySelector('.iba-rtp-prev').hidden = true; return; }
  if (act === 'older') { b.disabled = true; b.textContent = 'Adding…'; let n = 0; for (const r of olderList) { try { if (await stage(r, 'you (older)')) n++; } catch (_) {} } olderN = 0; olderList = []; ctx.log(`Added ${n} older approved invoice${n === 1 ? '' : 's'} to Ready to Print.`); paint(); if (ctx.refreshSum) ctx.refreshSum(); return; }
  if (!x) return;
  const place = (tmp[x.id] && tmp[x.id].place) || x.place || 'M';
  if (act === 'preview') {
    const pv = body.querySelector('.iba-rtp-prev'); b.disabled = true; b.textContent = 'Making…';
    try { const p = await prepare(x, place); pv.hidden = false; pv.querySelector('b').textContent = `PO ${x.po} · ${p.file} · ESN ${placeName(place)}`; await renderPreview(p.bytes, pv.querySelector('canvas')); pv.scrollIntoView({ block: 'nearest' }); }
    catch (err) { if (err.candidates) { tmp[x.id] = Object.assign(tmp[x.id] || {}, { candidates: err.candidates }); } ctx.log(`PO ${esc(x.po)}: ${esc(err.message)}`); paint(); return; }
    finally { b.disabled = false; b.textContent = 'Preview'; }
    return;
  }
  if (act === 'print') { if (!x.file && tmp[x.id] && tmp[x.id].candidates && tmp[x.id].candidates.length) { ctx.log(`PO ${esc(x.po)}: pick the PDF first.`); return; } return printOne(x, place, false); }
  if (act === 'again') { if (!confirm(`PO ${x.po} was printed ${clock(x.printedAt)}. Print page 1 again on ${PRINTER}?`)) return; return printOne(x, x.place || 'M', true); }
  if (act === 'skip') { await mainDb().ref(`${ROOT}/${x.id}`).update({ state: 'skipped', skippedAt: Date.now(), skippedBy: me() }); Object.assign(Qd[x.id], { state: 'skipped', skippedAt: Date.now() }); ctx.log(`PO ${esc(x.po)}: skipped (not printed).`); paint(); if (ctx.refreshSum) ctx.refreshSum(); return; }
  if (act === 'unskip') { await mainDb().ref(`${ROOT}/${x.id}`).update({ state: 'staged', skippedAt: null, skippedBy: null }); Object.assign(Qd[x.id], { state: 'staged' }); showDone = true; paint(); if (ctx.refreshSum) ctx.refreshSum(); }
}
async function onChange(e) {
  if (!body || !body.contains(e.target)) return; const t = e.target; const x = rowOf(t); if (!x) return;
  if (t.dataset.f === 'place') { tmp[x.id] = Object.assign(tmp[x.id] || {}, { place: t.value }); try { await mainDb().ref(`${ROOT}/${x.id}/place`).set(t.value); Qd[x.id].place = t.value; } catch (_) {} }
  if (t.dataset.f === 'file' && t.value) { try { await mainDb().ref(`${ROOT}/${x.id}/file`).set(t.value); Qd[x.id].file = t.value; } catch (_) {} ctx.log(`PO ${esc(x.po)}: PDF picked: ${esc(t.value)}.`); paint(); }
}
document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
document.addEventListener('toggle', (e) => { if (e.target && e.target.classList && e.target.classList.contains('iba-rtp-done')) showDone = e.target.open; }, true);

window.ibaOfficePrint = { VERSION, scan, count, open, loadQueue, stampPage1, checkHelper, inHours, PRINTER };
console.info('%cIBA Office Ready to Print ' + VERSION + ' loaded', 'color:#138A97;font-weight:700');
})();
