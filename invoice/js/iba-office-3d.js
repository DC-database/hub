/* ==========================================================================
   js/iba-office-3d.js — 18.0.0 patch 153 (IBA Office new look, Super Admin only)
   Draws the same office as js/iba-office.js (rooms, walls, desks, chairs, people,
   bots, cabinets) in the look martin picked:
     Clean  = "Walnut and navy"  (warm wood, navy carpet, gold trim)
     Pixel  = "Crimson noir"     (black/red checker floor, stained glass, pixel render)
   Anime-style 3D people: every person's hair, uniform, colours, glasses and beard
   can be chosen in "Characters" (saved in system_settings/office_look_v1/{key}).
   All office logic (who sits where, walking, bots, cabinets, printing, presence,
   lunch/away, 6 PM go-home) stays in iba-office.js; this file only draws it.
   Interface kept: window.ibaOffice3DInit(state) / window.ibaOffice3DFrame(t, state).
   ========================================================================== */
(function () {
'use strict';
if (!window.THREE || !window.ibaOffice3DState) return;
const T = window.THREE;

// ---------------------------------------------------------------- small helpers
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = (x, y) => [x - 23, y - 20]; // grid tile -> world metres (1 tile = 1 m)
function getUv(faceDir, normal, uvAxis, projAxis, radius, sideLength) {
  const tot = 2 * Math.PI * radius / 4, centre = Math.max(sideLength - 2 * radius, 0), half = Math.PI / 4;
  const n = normal.clone(); n[projAxis] = 0; n.normalize();
  const arc = .5 * tot / (tot + centre), ang = 1 - (n.angleTo(faceDir) / half);
  if (Math.sign(n[uvAxis]) === 1) return ang * arc;
  return centre / (tot + centre) + arc + arc * (1 - ang);
}
const RB_CACHE = new Map();
function roundedBox(width, height, depth, segments, radius) { // adapted from three/examples RoundedBoxGeometry (MIT)
  const ts = segments * 2 + 1; radius = Math.min(width / 2, height / 2, depth / 2, radius);
  const geo = new T.BoxGeometry(1, 1, 1, ts, ts, ts); const g2 = geo.toNonIndexed();
  geo.index = null; geo.attributes.position = g2.attributes.position; geo.attributes.normal = g2.attributes.normal; geo.attributes.uv = g2.attributes.uv;
  const position = new T.Vector3(), normal = new T.Vector3(), box = new T.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv.array, faceTris = P.length / 6, fd = new T.Vector3(), hs = .5 / ts;
  for (let i = 0, j = 0; i < P.length; i += 3, j += 2) {
    position.fromArray(P, i); normal.copy(position); normal.x -= Math.sign(normal.x) * hs; normal.y -= Math.sign(normal.y) * hs; normal.z -= Math.sign(normal.z) * hs; normal.normalize();
    P[i] = box.x * Math.sign(position.x) + normal.x * radius; P[i + 1] = box.y * Math.sign(position.y) + normal.y * radius; P[i + 2] = box.z * Math.sign(position.z) + normal.z * radius;
    N[i] = normal.x; N[i + 1] = normal.y; N[i + 2] = normal.z;
    switch (Math.floor(i / faceTris)) {
      case 0: fd.set(1, 0, 0); U[j] = getUv(fd, normal, 'z', 'y', radius, depth); U[j + 1] = 1 - getUv(fd, normal, 'y', 'z', radius, height); break;
      case 1: fd.set(-1, 0, 0); U[j] = 1 - getUv(fd, normal, 'z', 'y', radius, depth); U[j + 1] = 1 - getUv(fd, normal, 'y', 'z', radius, height); break;
      case 2: fd.set(0, 1, 0); U[j] = 1 - getUv(fd, normal, 'x', 'z', radius, width); U[j + 1] = getUv(fd, normal, 'z', 'x', radius, depth); break;
      case 3: fd.set(0, -1, 0); U[j] = 1 - getUv(fd, normal, 'x', 'z', radius, width); U[j + 1] = 1 - getUv(fd, normal, 'z', 'x', radius, depth); break;
      case 4: fd.set(0, 0, 1); U[j] = 1 - getUv(fd, normal, 'x', 'y', radius, width); U[j + 1] = 1 - getUv(fd, normal, 'y', 'x', radius, height); break;
      default: fd.set(0, 0, -1); U[j] = getUv(fd, normal, 'x', 'y', radius, width); U[j + 1] = 1 - getUv(fd, normal, 'y', 'x', radius, height);
    }
  }
  return geo;
}
// shared (cached) geometry: people and furniture reuse the same shapes
const RB = (w, h, d, r = .04, s = 3) => { const k = [w, h, d, r, s].map((v) => +(+v).toFixed(4)).join('|'); let g = RB_CACHE.get(k); if (!g) { g = roundedBox(w, h, d, s, Math.max(.002, Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002))); g.userData.shared = true; RB_CACHE.set(k, g); } return g; };
const cyl = (rt, rb, h, s = 20, open = false) => new T.CylinderGeometry(rt, rb, h, s, 1, open);
function add(p, geo, mat, x, y, z, o = {}) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; if (o.sc) m.scale.set(...o.sc); m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.noOutline) m.userData.noOutline = true; if (o.side) { m.material = mat.clone(); m.material.side = T.DoubleSide; } p.add(m); return m; }
function grp(p, x, z, ry = 0, y = 0) { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g; }
function tex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]); const t = new T.DataTexture(d, 3, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (o) => new T.MeshToonMaterial(Object.assign({ gradientMap: grad }, o));
const glowM = (c, i = 1.4) => new T.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: i, gradientMap: grad });
function outlineMat(th, col) { const m = new T.MeshBasicMaterial({ color: col, side: T.BackSide }); m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${th.toFixed(4)};`); }; m.customProgramCacheKey = () => 'iba-out-' + th.toFixed(4); return m; }
function addOutlines(root, mat) { const list = []; root.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline && !o.userData.hit && !(o.material && o.material.transparent)) list.push(o); }); list.forEach((o) => { const m = new T.Mesh(o.geometry, mat); m.userData.isOutline = true; m.castShadow = false; o.add(m); }); }
function mergeGeos(list) {
  let n = 0; list.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  list.forEach((g) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; g.dispose(); });
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); return m;
}

// ---------------------------------------------------------------- themes (martin's picks: B and D)
const THEMES = {
  warm: { bg: 0xE6DED2, floor: '#EAE2D6', floorLine: '#D3C6B2', wood: '#8A5A3A', woodDark: '#5A3620', carpet: '#3C4A66', carpet2: '#DCCBAE', wall: 0xF6F0E8, wallDark: 0xBFB09C, trimA: 0xC9A24A, trimB: 0x2C3D6B, glass: 0xD8EEF0, metal: 0x6A6A70, chair: 0x2C3D6B, sofa: 0x2F5A48, sofa2: 0xE8DCC8, accent: 0xC9A24A, plantPot: 0x2E2A28, sky: 'day', hemi: 1.45, sun: 2.1, out: 0x2A2220, glow: .25, base: 0xB8AE9E, sign: '#2C3D6B', iba: 0x2C3D6B, ibaEdge: 0xC9A24A, lab: ['rgba(255,250,242,.95)', '#C9A24A', '#2C2420'], px: 1 },
  noir: { dark: true, bg: 0x0E0B0C, floor: '#1E1A1C', floorB: '#3E1418', floorLine: '#0A0808', checker: true, wood: '#2E1C18', woodDark: '#140C0A', carpet: '#7A1220', carpet2: '#1E2E30', wall: 0x2E2628, wallDark: 0x161214, trimA: 0x2FE0D0, trimB: 0xF3C45B, glass: 0xFF9A8A, metal: 0x4A4044, chair: 0x7A1220, sofa: 0x5A0E18, sofa2: 0xB88A2A, accent: 0x2FE0D0, plantPot: 0x0E0A0A, sky: 'stained', hemi: 1.35, sun: 1.5, out: 0x050304, glow: .9, base: 0x161012, sign: '#F3C45B', iba: 0x8A1626, ibaEdge: 0xF3C45B, lab: ['rgba(20,12,12,.92)', '#F3C45B', '#FFF2E6'], px: 2 },
};
let P = THEMES.warm, DARK = false, M = {}, OUT = null, OUTC = null, OUTP = null;
function materials() {
  seed = 7;
  const planks = (base, dark) => tex(256, 256, (g, w, h) => { const rows = 6, ph = h / rows; for (let r = 0; r < rows; r++) { let x = -rnd() * 120; while (x < w) { const len = 110 + rnd() * 120; const n = parseInt(base.slice(1), 16), d = (rnd() - .5) * 22; g.fillStyle = `rgb(${(n >> 16) + d},${((n >> 8) & 255) + d},${(n & 255) + d})`; g.fillRect(x, r * ph, len, ph); g.fillStyle = dark; g.fillRect(x, r * ph, 2, ph); x += len; } g.fillStyle = dark; g.fillRect(0, r * ph, w, 2); } });
  const tiles = tex(128, 128, (g, w, h) => { g.fillStyle = P.floor; g.fillRect(0, 0, w, h); if (P.checker) { g.fillStyle = P.floorB; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); } for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .12})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); } g.strokeStyle = P.floorLine; g.lineWidth = 4; g.strokeRect(0, 0, w, h); });
  const carpet = (base) => tex(128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rnd() * .08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); });
  const sky = tex(256, 128, (g, w, h) => {
    if (P.sky === 'stained') { const cols = ['#FF3AA8', '#B6FF3A', '#6A3AFF', '#2FE0D0', '#F3C45B', '#C21A3A']; g.fillStyle = '#0A0710'; g.fillRect(0, 0, w, h); const n = 4, pw = w / n;
      for (let i = 0; i < n; i++) { const x0 = i * pw + 6, x1 = (i + 1) * pw - 6; g.save(); g.beginPath(); g.moveTo(x0, h - 4); g.lineTo(x0, 40); g.quadraticCurveTo((x0 + x1) / 2, -14, x1, 40); g.lineTo(x1, h - 4); g.closePath(); g.clip();
        for (let y = 0; y < h; y += 16) for (let x = x0; x < x1; x += 14) { g.fillStyle = cols[(((x / 14) | 0) + ((y / 16) | 0) * 3 + i) % cols.length]; g.globalAlpha = .55 + rnd() * .35; g.fillRect(x, y, 14, 16); }
        g.globalAlpha = 1; g.strokeStyle = '#0A0710'; g.lineWidth = 3; for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); } for (let x = x0; x < x1; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        g.beginPath(); g.arc((x0 + x1) / 2, 46, 14, 0, Math.PI * 2); g.fillStyle = cols[i % 6]; g.fill(); g.stroke(); g.restore(); } return; }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8FD0F0'); gr.addColorStop(1, '#E2F4FA'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 20 + rnd() * 10) { const bh = 30 + rnd() * 70, bw = 14 + rnd() * 12; g.fillStyle = '#A9BDCC'; g.fillRect(x, h - bh, bw, bh); for (let y = h - bh + 5; y < h - 4; y += 8) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if (rnd() < .25) { g.fillStyle = '#F4FAFC'; g.fillRect(xx, y, 3, 4); } } });
  M = {
    tiles: toon({ map: tiles }), wood: toon({ map: planks(P.wood, P.woodDark) }), carpet: toon({ map: carpet(P.carpet) }), carpet2: toon({ map: carpet(P.carpet2) }), carpet3: toon({ map: carpet(P.carpet3 || (P.dark ? '#26324A' : '#2F6468')) }),
    woodTop: toon({ color: new T.Color(P.wood) }), woodDark: toon({ color: new T.Color(P.woodDark) }), wall: toon({ color: P.wall }), wallDark: toon({ color: P.wallDark }),
    trimA: glowM(P.trimA, P.glow), trimB: glowM(P.trimB, P.glow * .9), gold: glowM(0xF3C45B, P.glow),
    glass: new T.MeshPhongMaterial({ color: P.glass, transparent: true, opacity: DARK ? .28 : .3, shininess: 90, specular: 0xffffff, depthWrite: false }),
    metal: toon({ color: P.metal }), chrome: toon({ color: 0xD8DDE4 }), black: toon({ color: 0x22202C }),
    chair: toon({ color: P.chair }), leather: toon({ color: DARK ? 0x3A2E3A : 0x4A3A33 }),
    sofa: toon({ color: P.sofa }), sofa2: toon({ color: P.sofa2 }), pillow: toon({ color: P.accent }), pillow2: toon({ color: DARK ? 0x9B5CFF : 0xFFFFFF }),
    pot: toon({ color: P.plantPot }), soil: toon({ color: 0x3B2A1E }), leaf: toon({ color: 0x2E9A4A, side: T.DoubleSide }), leaf2: toon({ color: 0x5DBB52, side: T.DoubleSide }),
    screen: glowM(DARK ? 0x7A5CFF : 0x5FA8E0, DARK ? 1.2 : .6), screen2: glowM(0x3FE0F0, DARK ? 1.2 : .6),
    sky: new T.MeshBasicMaterial({ map: sky }), paper: toon({ color: 0xF7F5F0 }), white: toon({ color: 0xF2F4F8 }),
    lamp: glowM(0xFFD58A, DARK ? 1.6 : .8), porcelain: toon({ color: 0xF6F6F4 }), mirror: new T.MeshPhongMaterial({ color: 0xBFE6F2, shininess: 120, specular: 0xffffff }),
    binder: [0x3FE0F0, 0x9B5CFF, 0xF39A3A, 0xEDEDED].map((c) => toon({ color: c })), flower: [0xE86FB5, 0xF3C45B, 0x9B5CFF, 0xFF7A7A].map((c) => toon({ color: c })),
    book: [0x8E2F2F, 0x2F4F8E, 0x2F7A5B, 0xC9A24B, 0x5B3E8E, 0x1F2A36].map((c) => toon({ color: c })), box: toon({ color: 0xC89A5E }), base: toon({ color: P.base }),
  };
  OUT = outlineMat(.014, P.out); OUTC = outlineMat(.018, P.out); OUTP = outlineMat(.0075, P.out);
}

// ---------------------------------------------------------------- furniture models (metres, front = -z unless noted)
function chairOffice(p, x, z, ry, mat) {
  const g = grp(p, x, z, ry); mat = mat || M.chair;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(g, RB(.3, .04, .05, .015), M.black, Math.cos(a) * .15, .07, Math.sin(a) * .15, { ry: -a }); add(g, new T.SphereGeometry(.035, 8, 6), M.black, Math.cos(a) * .29, .035, Math.sin(a) * .29, { noOutline: true }); }
  add(g, cyl(.03, .03, .3, 10), M.chrome, 0, .22, 0, { noOutline: true });
  add(g, RB(.52, .1, .5, .05), mat, 0, .42, 0); add(g, RB(.5, .6, .09, .05), mat, 0, .78, .24, { rx: -.1 }); add(g, RB(.34, .14, .08, .04), mat, 0, 1.15, .28, { rx: -.12 });
  [-1, 1].forEach((s) => { add(g, RB(.05, .2, .05, .02), M.black, s * .27, .54, .03, { noOutline: true }); add(g, RB(.08, .04, .3, .02), M.black, s * .27, .65, .03); });
  return g;
}
function chairGuest(p, x, z, ry) {
  const g = grp(p, x, z, ry);
  add(g, RB(.5, .1, .48, .05), M.leather, 0, .44, 0); add(g, RB(.5, .52, .1, .05), M.leather, 0, .74, .22, { rx: -.12 });
  [-1, 1].forEach((s) => { add(g, RB(.04, .04, .6, .02), M.chrome, s * .26, .03, 0, { noOutline: true }); add(g, RB(.04, .42, .04, .02), M.chrome, s * .26, .22, -.28, { noOutline: true }); add(g, RB(.04, .04, .5, .02), M.chrome, s * .27, .62, 0, { noOutline: true }); add(g, RB(.04, .2, .04, .02), M.chrome, s * .27, .52, .24, { noOutline: true }); });
  return g;
}
function stool(p, x, z) { const g = grp(p, x, z); add(g, cyl(.17, .15, .06, 16), M.leather, 0, .7, 0); add(g, cyl(.025, .025, .68, 6), M.chrome, 0, .35, 0, { noOutline: true }); add(g, cyl(.17, .19, .03, 16), M.black, 0, .015, 0); add(g, new T.TorusGeometry(.14, .012, 6, 18), M.chrome, 0, .28, 0, { rx: Math.PI / 2, noOutline: true }); return g; }
function pouf(p, x, z) { const g = grp(p, x, z); add(g, cyl(.26, .24, .4, 18), M.sofa, 0, .21, 0); add(g, cyl(.27, .27, .03, 18, true), M.trimB, 0, .05, 0, { cast: false, noOutline: true }); return g; }
function monitor(p, x, y, z, ry, scr) {
  const g = grp(p, x, z, ry, y);
  add(g, RB(.24, .02, .16, .008), M.black, 0, .01, 0, { noOutline: true }); add(g, RB(.05, .26, .04, .015), M.black, 0, .14, .03, { noOutline: true });
  add(g, RB(.66, .42, .05, .02), M.black, 0, .38, 0); add(g, new T.PlaneGeometry(.6, .36), scr || M.screen, 0, .38, -.027, { ry: Math.PI, cast: false, noOutline: true });
  add(g, RB(.44, .025, .15, .008), M.black, 0, .012, -.3, { noOutline: true }); add(g, RB(.08, .025, .1, .02), M.black, .32, .012, -.3, { noOutline: true });
  return g;
}
function plantSmall(p, x, y, z) { const g = grp(p, x, z, 0, y); add(g, cyl(.06, .05, .1, 10), M.pot, 0, .05, 0, { noOutline: true }); for (let i = 0; i < 5; i++) { const l = add(g, new T.SphereGeometry(.07, 6, 5), M.leaf2, Math.cos(i * 1.3) * .04, .15 + i * .015, Math.sin(i * 1.3) * .04, { noOutline: true }); l.scale.set(1, .4, .6); l.rotation.z = .6; l.rotation.y = i * 1.3; } return g; }
// desk: the chair sits at local (0, -.62) in the sample; here the chair is drawn separately
function deskWork(p, x, z, ry, s = .8, sx = 1) {
  const g = grp(p, x, z, ry); g.scale.set(s * sx, s, s);
  add(g, RB(1.4, .07, .74, .03), M.woodTop, 0, .76, 0); add(g, RB(1.4, .025, .025, .01), M.trimA, 0, .735, -.37, { cast: false, noOutline: true });
  add(g, RB(.06, .74, .64, .02), M.metal, -.66, .37, 0); add(g, RB(.42, .62, .62, .03), M.woodDark, .44, .32, 0);
  [.18, .38, .56].forEach((y) => add(g, RB(.14, .02, .02, .008), M.chrome, .44, y, -.31, { noOutline: true }));
  add(g, RB(1.4, .4, .03, .015), M.glass, 0, 1.0, .36, { cast: false, noOutline: true }); add(g, RB(1.4, .03, .05, .01), M.trimA, 0, 1.2, .36, { cast: false, noOutline: true });
  monitor(g, -.08, .795, .1, 0);
  add(g, RB(.46, .025, .15, .01), M.black, -.08, .8, -.2, { noOutline: true }); add(g, RB(.08, .025, .12, .03), M.black, .3, .8, -.2, { noOutline: true }); // keyboard + mouse
  for (let i = 0; i < 3; i++) add(g, RB(.045, .22, .16, .01), M.binder[i], .42 + i * .055, .91, .16, { noOutline: true });
  add(g, cyl(.035, .03, .09, 10), M.porcelain, -.5, .84, -.15, { noOutline: true });
  if (rnd() < .5) plantSmall(g, .55, .795, -.2);
  return g;
}
function deskExec(p, x, z, ry, s = 1) {
  const g = grp(p, x, z, ry); g.scale.setScalar(s);
  add(g, RB(2.1, .09, .95, .035), M.woodTop, 0, .78, 0); add(g, RB(2.0, .72, .85, .04), M.woodDark, 0, .37, .02);
  add(g, RB(2.0, .03, .03, .01), M.gold, 0, .1, -.43, { cast: false, noOutline: true });
  monitor(g, .2, .825, .15, 0, M.screen2);
  add(g, RB(.46, .025, .15, .01), M.black, .2, .835, -.22, { noOutline: true }); add(g, RB(.08, .025, .12, .03), M.black, .55, .835, -.22, { noOutline: true }); // keyboard + mouse
  add(g, cyl(.08, .09, .03, 14), M.black, .82, .84, .25, { noOutline: true }); add(g, cyl(.012, .012, .35, 6), M.chrome, .82, 1.0, .25, { noOutline: true }); add(g, RB(.2, .09, .13, .03), M.lamp, .76, 1.18, .25, { cast: false });
  add(g, RB(.32, .015, .22, .005), M.paper, -.45, .83, -.1, { ry: .2, noOutline: true }); add(g, RB(.3, .015, .21, .005), M.paper, -.42, .845, -.08, { ry: .05, noOutline: true });
  add(g, RB(.24, .12, .14, .02), M.black, -.75, .88, .2, { noOutline: true }); vase(g, -.8, .83, -.2, .55);
  return g;
}
function plantBig(p, x, z, s = 1) {
  const g = grp(p, x, z); g.scale.setScalar(s);
  add(g, cyl(.24, .18, .46, 18), M.pot, 0, .23, 0); add(g, cyl(.25, .25, .04, 18), M.trimA, 0, .06, 0, { cast: false, noOutline: true }); add(g, cyl(.22, .22, .02, 16), M.soil, 0, .468, 0, { noOutline: true });
  for (let i = 0; i < 11; i++) { const a = i * 2.4, r = .05 + rnd() * .1, h = .5 + rnd() * .55; const lf = add(g, new T.SphereGeometry(.2, 9, 6), i % 2 ? M.leaf : M.leaf2, Math.cos(a) * r * 1.8, .45 + h * .7, Math.sin(a) * r * 1.8); lf.scale.set(1, .16, .55); lf.rotation.set(rnd() * .5 - .25, -a, .55 + rnd() * .45); }
  return g;
}
function vase(p, x, y, z, s = 1) { const g = grp(p, x, z, 0, y); g.scale.setScalar(s); add(g, cyl(.07, .1, .22, 14), M.porcelain, 0, .11, 0); add(g, cyl(.05, .07, .05, 12), M.porcelain, 0, .24, 0, { noOutline: true });
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = .08 + rnd() * .05, h = .38 + rnd() * .15; add(g, cyl(.006, .006, h - .2, 4), M.leaf, Math.cos(a) * r * .5, .2 + (h - .2) / 2, Math.sin(a) * r * .5, { rz: Math.cos(a) * .25, rx: Math.sin(a) * .25, noOutline: true }); add(g, new T.SphereGeometry(.045, 8, 6), M.flower[i % 4], Math.cos(a) * r, h, Math.sin(a) * r); } return g; }
// front = +z
function cabinet(p, x, z, ry, w = 1) { const g = grp(p, x, z, ry); g.scale.set(w, 1, 1);
  add(g, RB(.96, 1.9, .45, .03), M.woodDark, 0, .95, 0);
  for (let s = 0; s < 3; s++) { const y = .3 + s * .55; add(g, RB(.88, .03, .4, .01), M.metal, 0, y, .01, { noOutline: true }); for (let i = 0; i < 8; i++) add(g, RB(.08, .36, .3, .01), M.binder[(i + s) % 4], -.35 + i * .1, y + .2, .03, { noOutline: true }); }
  add(g, RB(.9, 1.8, .02, .01), M.glass, 0, .95, .23, { cast: false, noOutline: true }); add(g, RB(.03, 1.8, .03, .01), M.trimB, -.48, .95, .23, { cast: false, noOutline: true }); return g; }
function bookcase(p, x, z, ry, w = 1) { const g = grp(p, x, z, ry);
  add(g, RB(w * .96, 2.0, .4, .02), M.woodDark, 0, 1.0, -.02); const n = Math.max(4, Math.round(w * 9));
  for (let s = 0; s < 4; s++) { const y = .12 + s * .48; add(g, RB(w * .9, .03, .36, .01), M.woodTop, 0, y, .03, { noOutline: true }); for (let i = 0; i < n; i++) { if (rnd() < .15) continue; const bh = .26 + rnd() * .12; add(g, RB(.07, bh, .26, .01), M.book[(i * 3 + s) % 6], -w * .42 + i * (w * .84 / n), y + .02 + bh / 2, .04, { noOutline: true }); } } return g; }
function cubby(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.4, .6, .45, .03), M.woodDark, 0, .3, 0); [.12, .3, .48].forEach((y) => add(g, RB(.3, .015, .02, .006), M.chrome, 0, y, .23, { noOutline: true })); return g; }
function shelfBoxes(p, x, z, ry, w = 1.1) { const g = grp(p, x, z, ry); [-w / 2, w / 2].forEach((dx) => add(g, RB(.05, 1.9, .5, .01), M.metal, dx, .95, 0)); for (let s = 0; s < 4; s++) { add(g, RB(w, .04, .5, .01), M.metal, 0, .1 + s * .55, 0, { noOutline: true }); const n = Math.max(1, Math.round(w / .36)); for (let i = 0; i < n; i++) if (rnd() < .8) add(g, RB(.3, .26, .36, .02), M.box, -w / 2 + .2 + i * (w - .4) / Math.max(1, n - 1), .25 + s * .55, 0); } return g; }
function boxes(p, x, z) { const g = grp(p, x, z); add(g, RB(.6, .45, .5, .02), M.box, 0, .225, 0); add(g, RB(.5, .38, .45, .02), M.box, .04, .64, -.02, { ry: .2 }); add(g, RB(.36, .3, .32, .02), M.box, -.08, .99, .03, { ry: -.3 }); return g; }
// front = -z (seats at local z ~ -.05)
function sofa(p, x, z, ry, n, mat) { const g = grp(p, x, z, ry); const w = n * .72 + .36;
  add(g, RB(w, .28, .92, .08), mat, 0, .24, 0);
  for (let i = 0; i < n; i++) { const cx = -w / 2 + .18 + .36 + i * .72; add(g, RB(.7, .17, .72, .08, 4), mat, cx, .45, .05); add(g, RB(.68, .52, .22, .1, 4), mat, cx, .74, .35, { rx: .1 }); }
  [-1, 1].forEach((s) => add(g, RB(.22, .6, .92, .09, 4), mat, s * (w / 2 - .11), .4, 0));
  add(g, RB(w, .03, .03, .01), M.trimB, 0, .1, -.46, { cast: false, noOutline: true });
  add(g, RB(.36, .34, .12, .06, 4), M.pillow, -w / 2 + .5, .66, .2, { rx: .2, ry: .3 }); if (n > 1) add(g, RB(.36, .34, .12, .06, 4), M.pillow2, w / 2 - .5, .66, .2, { rx: .2, ry: -.3 });
  return g; }
function roundTable(p, x, z, r = .5, h = .5) { const g = grp(p, x, z); add(g, cyl(r, r, .06, 32), M.woodTop, 0, h, 0); add(g, cyl(.05, .05, h - .04, 10), M.black, 0, h / 2, 0, { noOutline: true }); add(g, cyl(.28, .3, .04, 24), M.black, 0, .02, 0); add(g, cyl(.3, .3, .015, 24, true), M.trimA, 0, .045, 0, { cast: false, noOutline: true }); return g; }
function meetTable(p, x, z, w, d) { const g = grp(p, x, z); add(g, RB(w, .08, d, .2, 4), M.woodTop, 0, .74, 0); add(g, RB(w - .2, .03, d - .2, .1), M.gold, 0, .785, 0, { cast: false, noOutline: true });
  [-1, 1].forEach((s) => { add(g, RB(.12, .7, d * .6, .03), M.woodDark, s * (w / 2 - .6), .36, 0); });
  for (let i = 0; i < Math.round(w / 1.2); i++) add(g, RB(.32, .015, .22, .005), M.paper, -w / 2 + .7 + i * 1.2, .79, (i % 2 ? .25 : -.25), { ry: rnd() * .4 - .2, noOutline: true });
  vase(g, 0, .78, 0, .7); return g; }
function printer(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.7, .8, .6, .04), M.porcelain, 0, .4, 0); add(g, RB(.7, .2, .6, .04), M.white, 0, .9, 0); add(g, RB(.24, .14, .02, .01), M.screen2, .18, .88, -.31, { noOutline: true }); [.18, .36, .54].forEach((y) => add(g, RB(.6, .015, .02, .005), M.metal, 0, y, -.305, { noOutline: true })); add(g, RB(.4, .02, .3, .005), M.paper, -.05, 1.01, .05, { noOutline: true }); return g; }
function coffeeBar(p, x, z, ry, w = 2.4) { const g = grp(p, x, z, ry); const k = w / 2.4;
  add(g, RB(w, .95, .6, .04), M.woodDark, 0, .475, 0); add(g, RB(w + .1, .05, .7, .02), M.porcelain, 0, .97, 0); add(g, RB(w, .03, .03, .01), M.trimB, 0, .15, -.31, { cast: false, noOutline: true });
  add(g, RB(.32, .42, .32, .04), M.black, -.7 * k, 1.2, .05); add(g, RB(.08, .08, .02, .01), M.trimA, -.7 * k, 1.3, -.115, { cast: false, noOutline: true });
  for (let i = 0; i < 4; i++) add(g, cyl(.04, .035, .09, 10), M.paper, .1 + i * .14, 1.04, 0, { noOutline: true });
  add(g, RB(w, .9, .3, .03), M.woodDark, 0, 1.95, .2); [1.7, 2.1].forEach((y) => add(g, RB(w - .1, .03, .28, .01), M.woodTop, 0, y, .15, { noOutline: true })); for (let i = 0; i < 6; i++) add(g, cyl(.05, .04, .1, 10), M.porcelain, (-.8 + i * .3) * k, 1.77, .12, { noOutline: true });
  return g; }
function barCounter(p, x, z, ry, w) { const g = grp(p, x, z, ry); add(g, RB(w, .05, .55, .02), M.woodTop, 0, 1.02, 0); add(g, RB(w - .1, .95, .4, .03), M.woodDark, 0, .48, -.05); add(g, RB(w - .1, .03, .03, .01), M.trimA, 0, .2, .16, { cast: false, noOutline: true }); for (let i = 0; i < 3; i++) add(g, cyl(.04, .035, .09, 10), M.paper, -w / 3 + i * w / 3, 1.09, 0, { noOutline: true }); return g; }
function fridge(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.76, 1.95, .7, .05), M.white, 0, .975, 0); add(g, RB(.74, .015, .02, .005), M.metal, 0, 1.3, -.355, { noOutline: true }); add(g, RB(.03, .4, .04, .01), M.chrome, .3, 1.55, -.37, { noOutline: true }); add(g, RB(.03, .3, .04, .01), M.chrome, .3, .95, -.37, { noOutline: true }); return g; }
// water dispenser: white stand, red/blue taps, drip tray, blue bottle on top (front = -z like the fridge)
function waterDisp(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.36, .95, .36, .04), M.white, 0, .475, 0); add(g, RB(.26, .03, .1, .01), M.black, 0, .5, -.2, { noOutline: true });
  add(g, RB(.05, .06, .05, .01), toon({ color: 0xE04848 }), -.07, .72, -.2, { noOutline: true }); add(g, RB(.05, .06, .05, .01), toon({ color: 0x3C7FE0 }), .07, .72, -.2, { noOutline: true });
  add(g, new T.CylinderGeometry(.05, .07, .06, 12), M.chrome, 0, .98, 0); add(g, new T.CylinderGeometry(.16, .16, .44, 18), new T.MeshPhongMaterial({ color: 0x5FB6F0, transparent: true, opacity: .55, shininess: 100, specular: 0xffffff }), 0, 1.23, 0, { noOutline: true });
  add(g, new T.CylinderGeometry(.165, .165, .03, 18), toon({ color: 0x3C8FD0 }), 0, 1.3, 0, { noOutline: true }); return g; }
// snack vending machine: red body, glass window with rows of snacks, keypad, pick-up slot, lit sign
function vending(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.9, 1.95, .78, .04), toon({ color: DARK ? 0x8A1E2A : 0xC8323C }), 0, .975, 0);
  add(g, RB(.6, 1.25, .02, .01), M.black, -.1, 1.15, -.39, { noOutline: true });
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) add(g, RB(.1, .14, .06, .01), [...M.binder, ...M.flower][(r * 4 + c) % 8], -.34 + c * .16, .66 + r * .24, -.4, { noOutline: true, cast: false });
  for (let r = 0; r < 5; r++) add(g, RB(.58, .015, .03, .005), M.chrome, -.1, .58 + r * .24, -.405, { noOutline: true, cast: false });
  add(g, new T.PlaneGeometry(.58, 1.22), M.glass, -.1, 1.15, -.412, { ry: Math.PI, cast: false, noOutline: true });
  add(g, RB(.16, .42, .02, .01), M.black, .31, 1.3, -.4, { noOutline: true }); for (let i = 0; i < 9; i++) add(g, RB(.035, .035, .01, .003), M.chrome, .27 + (i % 3) * .04, 1.4 - Math.floor(i / 3) * .05, -.412, { noOutline: true, cast: false });
  add(g, RB(.55, .16, .02, .01), M.black, -.1, .3, -.4, { noOutline: true }); add(g, RB(.8, .14, .02, .01), M.lamp, 0, 1.86, -.4, { noOutline: true, cast: false }); return g; }
// upright drinks fridge with a glass door: open shell, lit back, shelves of bottles
function drinksFridge(p, x, z, ry) { const g = grp(p, x, z, ry); const fr = toon({ color: DARK ? 0x15131C : 0x2A2F3A });
  add(g, RB(.8, 1.95, .05, .01), M.white, 0, .975, .33); [-1, 1].forEach((s) => add(g, RB(.06, 1.95, .7, .01), fr, s * .37, .975, 0)); add(g, RB(.8, .2, .7, .02), fr, 0, 1.85, 0); add(g, RB(.8, .12, .7, .02), fr, 0, .06, 0);
  add(g, RB(.68, .1, .02, .01), glowM(0x5FD0F0, DARK ? 1.2 : .6), 0, 1.86, -.36, { noOutline: true, cast: false });
  for (let r = 0; r < 4; r++) { const y = .22 + r * .4; add(g, RB(.68, .02, .6, .005), M.chrome, 0, y, 0, { noOutline: true, cast: false });
    for (let c = 0; c < 5; c++) add(g, new T.CylinderGeometry(.045, .045, .26, 10), [...M.flower, ...M.binder][(r * 5 + c) % 8], -.24 + c * .12, y + .14, -.08, { noOutline: true, cast: false }); }
  add(g, new T.PlaneGeometry(.72, 1.62), M.glass, 0, .96, -.35, { ry: Math.PI, cast: false, noOutline: true }); add(g, RB(.03, .5, .04, .01), M.chrome, .3, 1.0, -.38, { noOutline: true }); return g; }
// reception wall TV playing IBA adverts (slides change every few seconds, see ADS in the frame loop)
const AD_SLIDES = [['IBA', 'W E L C O M E'], ['Quality', 'Safety · Teamwork'], ['IBA', 'Building together'], ['Welcome', 'Please take a seat']];
function drawAd(c, w, h, i) { const s = AD_SLIDES[i % AD_SLIDES.length]; const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, ['#1E2433', '#123A4A', '#2A1E3A', '#1E3326'][i % 4]); gr.addColorStop(1, ['#3A4A6E', '#1F6A7A', '#5A3A7A', '#2F6A48'][i % 4]); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = '#C9A24A'; c.fillRect(0, h - 18, w * ((i % 4) + 1) / 4, 6); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#F3C45B'; c.font = (s[0].length > 4 ? '800 92px' : '900 140px') + ' Arial Black, Segoe UI, sans-serif'; c.fillText(s[0], w / 2, h / 2 - 22);
  c.fillStyle = '#F6EBD2'; c.font = '700 30px Segoe UI, Arial, sans-serif'; c.fillText(s[1], w / 2, h - 52); c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '700 18px Segoe UI, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('IBA', w - 16, 22); }
function adTV(p, x, z, ry, len, ads) { const g = grp(p, x, z, ry); const w = len, h = len * .56; add(g, RB(w + .1, h + .1, .08, .02), M.black, 0, 1.45, -.36);
  const t = tex(512, 288, (c, cw, ch) => drawAd(c, cw, ch, 0)); add(g, new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t }), 0, 1.45, -.315, { cast: false, noOutline: true });
  add(g, RB(.3, .04, .1, .01), M.black, 0, 1.45 - h / 2 - .1, -.34, { noOutline: true }); if (ads) ads.push({ t, i: 0, tm: 0 }); return g; }
function tv(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(1.2, .5, .42, .03), M.woodDark, 0, .25, 0); add(g, RB(1.3, .76, .06, .02), M.black, 0, 1.05, .05); add(g, new T.PlaneGeometry(1.2, .66), M.screen2, 0, 1.05, .081, { cast: false, noOutline: true }); return g; }
function sink(p, x, z, ry, w = .8) { const g = grp(p, x, z, ry); add(g, RB(w, .1, .5, .03), M.porcelain, 0, .85, 0); add(g, RB(w - .1, .8, .45, .03), M.wallDark, 0, .4, 0); const n = Math.max(1, Math.round(w / .8)); for (let i = 0; i < n; i++) { const dx = -w / 2 + w * (i + .5) / n; add(g, cyl(.18, .15, .06, 16), M.mirror, dx, .9, -.02, { noOutline: true }); add(g, RB(.04, .18, .04, .01), M.chrome, dx, 1.0, .18, { noOutline: true }); } add(g, RB(w - .1, .8, .03, .01), M.mirror, 0, 1.6, .24); return g; }
function toilet(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.42, .38, .55, .12), M.porcelain, 0, .2, -.05); add(g, RB(.44, .06, .5, .1), M.white, 0, .42, -.07, { noOutline: true }); add(g, RB(.4, .36, .16, .04), M.porcelain, 0, .58, .22); return g; }
function urinal(p, x, z, ry) { const g = grp(p, x, z, ry); add(g, RB(.4, .6, .3, .12), M.porcelain, 0, .85, .3); add(g, RB(.3, .3, .16, .08), M.white, 0, .7, .2, { noOutline: true }); add(g, RB(.04, .2, .04, .01), M.chrome, 0, 1.25, .42, { noOutline: true }); return g; }
function partition(p, x, z, ry, w) { const g = grp(p, x, z, ry); add(g, RB(w, 1.6, .05, .01), M.metal, 0, .9, 0); add(g, RB(w, .04, .07, .01), M.trimA, 0, 1.72, 0, { cast: false, noOutline: true }); return g; }
function receptionDesk(p, x, z, ry, s = 1, pcs) { const g = grp(p, x, z, ry); g.scale.setScalar(s);
  add(g, RB(3.0, 1.0, .7, .2, 4), M.woodTop, 0, .5, 0); add(g, RB(3.1, .06, .8, .03), M.black, 0, 1.03, 0);
  add(g, RB(3.0, .04, .04, .01), M.trimA, 0, .55, -.36, { cast: false, noOutline: true }); add(g, RB(3.0, .04, .04, .01), M.trimB, 0, .1, -.36, { cast: false, noOutline: true });
  add(g, RB(2.4, .06, .5, .02), M.woodDark, 0, .74, .45); (pcs && pcs.length ? pcs : [-.4]).forEach((mx) => { monitor(g, mx, .77, .5, Math.PI); add(g, RB(.42, .02, .14, .01), M.black, mx, .785, .64); }); vase(g, .3, 1.06, -.05, .7); // one PC per reception chair
  const ib = tex(512, 104, (c, w, h) => { c.fillStyle = DARK ? '#1B1636' : '#FFFFFF'; c.fillRect(0, 0, w, h); c.strokeStyle = '#C9A24A'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = P.sign; c.font = '800 60px Space Grotesk, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RECEPTION', w / 2, h / 2 + 2); }); // p157 (martin): the desk carries its name plate
  add(g, new T.PlaneGeometry(1.5, .3), toon({ map: ib, emissive: 0xffffff, emissiveMap: ib, emissiveIntensity: DARK ? .5 : 0 }), 0, .65, -.36, { ry: Math.PI, cast: false, noOutline: true });
  return g; }
function wallClock(p, x, y, z, ry) { const g = grp(p, x, z, ry, y); add(g, cyl(.22, .22, .05, 28), M.porcelain, 0, 0, 0, { rx: Math.PI / 2 }); add(g, new T.TorusGeometry(.22, .025, 6, 28), M.black, 0, 0, 0, { noOutline: true });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(g, RB(.02, .045, .01, .004), M.black, Math.sin(a) * .17, Math.cos(a) * .17, .03, { rz: -a, noOutline: true }); }
  return g; }
function hands(x, y, z, ry) { const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; const hh = grp(g, 0, .035); add(hh, RB(.025, .11, .01, .005), M.black, 0, .05, 0, { noOutline: true, cast: false }); const mh = grp(g, 0, .04); add(mh, RB(.018, .16, .01, .005), M.trimB, 0, .075, 0, { noOutline: true, cast: false }); g.userData.hands = [hh, mh]; return g; }

// ---------------------------------------------------------------- the building, from the office plan in iba-office.js
const DIRV = { S: [0, 1], N: [0, -1], W: [-1, 0], E: [1, 0] };
const FACE = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }; // person rotation that looks that way
const LEAD = ['me', 'md', 'coo', 'pd', 'fin', 'spA', 'spB'];
const CAR_ROOMS = ['me', 'md', 'coo', 'fin', 'spA', 'pd']; // p157: Irwin + the managers come by their own car (reserved bays by the door)
let ADS = []; let BAYS = [], DOORZ = 0; let OUTER = [], CLOCKS = [], IBA = null, SIGN = null, FOUNT = null, chairByTile = new Map();
function roomOf(state, x, y) { return state.rooms.find((r) => r.id !== 'plaza' && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || state.rooms.find((r) => r.id === 'plaza'); }
// rotation so the model's front (+z when frontZ=1, -z when frontZ=-1) looks into its room
function faceIn(state, o, frontZ) {
  if (o.face && DIRV[o.face]) { const v = DIRV[o.face]; return Math.atan2(v[0], v[1]) + (frontZ < 0 ? Math.PI : 0); } // the plan says which way it looks
  const cx = o.x + o.w / 2, cy = o.y + o.d / 2, r = roomOf(state, Math.floor(cx), Math.floor(cy)); if (!r) return 0;
  const l = cx - r.x, rt = r.x + r.w - cx, tp = cy - r.y, bt = r.y + r.h - cy, m = Math.min(l, rt, tp, bt);
  const dir = m === tp ? [0, 1] : m === bt ? [0, -1] : m === l ? [1, 0] : [-1, 0];
  return Math.atan2(dir[0], dir[1]) + (frontZ < 0 ? Math.PI : 0);
}
function floorArea(p, x0, y0, x1, y1, mat, rep, y = 0) { const [ax, az] = W(x0, y0), [bx, bz] = W(x1, y1); const m = mat.clone(); if (mat.map) { m.map = mat.map.clone(); m.map.repeat.set((bx - ax) / rep, (bz - az) / rep); m.map.needsUpdate = true; } add(p, new T.BoxGeometry(bx - ax, .04, bz - az), m, (ax + bx) / 2, y, (az + bz) / 2, { cast: false, noOutline: true }); }
// a straight exterior wall with windows / a door; it drops low when it stands between you and the room
function wallRun(parent, x0, z0, x1, z1, h, opens, outN, inSign) {
  const g = new T.Group(); parent.add(g); const rec = { g, n: outN, k: 1, door: null }; OUTER.push(rec);
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0); g.position.set(x0, 0, z0); g.rotation.y = -ang;
  let s = 0; const T0 = .26; const seg = (a, b) => { if (b - a > .01) add(g, new T.BoxGeometry(b - a, h, T0), M.wall, (a + b) / 2, h / 2, 0); };
  opens.sort((a, b) => a.a - b.a).forEach((o) => { seg(s, o.a); const a = o.a, b = o.b;
    if (o.door) { add(g, new T.BoxGeometry(b - a, h - 2.4, T0), M.wall, (a + b) / 2, 2.4 + (h - 2.4) / 2, 0); const d = grp(g, (a + b) / 2, 0); rec.door = d;
      add(d, RB(.1, 2.4, .32, .02), M.wallDark, -(b - a) / 2 - .05, 1.2, 0); add(d, RB(.1, 2.4, .32, .02), M.wallDark, (b - a) / 2 + .05, 1.2, 0);
      add(d, RB(b - a, .06, .34, .01), M.trimA, 0, 2.43, 0, { cast: false, noOutline: true });
      const pw = (b - a) / 2 + .04; d.userData.leaves = [-1, 1].map((sd) => { const l = grp(d, sd * pw / 2, .06 * inSign); add(l, RB(pw, 2.3, .05, .01), M.glass, 0, 1.15, 0, { noOutline: true, cast: false });
        add(l, RB(.05, 2.3, .07, .01), M.black, -sd * pw / 2, 1.15, 0, { noOutline: true }); add(l, RB(.05, 2.3, .07, .01), M.black, sd * pw / 2, 1.15, 0, { noOutline: true }); add(l, RB(pw, .06, .07, .01), M.black, 0, .03, 0, { noOutline: true }); add(l, RB(pw, .06, .07, .01), M.black, 0, 2.28, 0, { noOutline: true });
        add(l, RB(.04, .5, .08, .01), M.chrome, -sd * (pw / 2 - .12), 1.1, 0, { noOutline: true }); l.userData.home = sd * pw / 2; l.userData.side = sd; l.userData.w = pw; return l; });
      add(d, RB(b - a + .2, .22, .3, .02), M.black, 0, 2.5, .06 * inSign, { noOutline: true }); add(d, RB(.12, .03, .02, .005), M.screen2, 0, 2.5, .22 * inSign, { cast: false, noOutline: true });
      const ext = tex(256, 64, (c, w, hh) => { c.fillStyle = '#16A34A'; c.fillRect(0, 0, w, hh); c.fillStyle = '#fff'; c.font = '800 30px Inter, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ENTRANCE / EXIT', w / 2, hh / 2 + 2); });
      add(d, RB(1.2, .28, .04, .01), toon({ map: ext, emissive: 0xffffff, emissiveMap: ext, emissiveIntensity: .4 }), 0, 2.62, .18 * inSign, { cast: false, noOutline: true });
    } else {
      add(g, new T.BoxGeometry(b - a, .85, T0), M.wall, (a + b) / 2, .425, 0); add(g, new T.BoxGeometry(b - a, h - 2.25, T0), M.wall, (a + b) / 2, 2.25 + (h - 2.25) / 2, 0);
      add(g, new T.PlaneGeometry(b - a, 1.4), M.sky, (a + b) / 2, 1.55, -.08 * inSign, { ry: inSign > 0 ? 0 : Math.PI, cast: false, noOutline: true });
      add(g, new T.BoxGeometry(b - a, 1.4, .03), M.glass, (a + b) / 2, 1.55, 0, { cast: false, noOutline: true });
      add(g, new T.BoxGeometry(.06, 1.4, .3), M.black, (a + b) / 2, 1.55, 0); add(g, new T.BoxGeometry(b - a, .07, .34), M.black, (a + b) / 2, .85, 0);
    }
    s = b; });
  seg(s, len);
  add(g, new T.BoxGeometry(len, .07, .32), M.trimA, len / 2, h + .03, 0, { cast: false, noOutline: true }); add(g, new T.BoxGeometry(len, .06, .3), M.trimB, len / 2, .1, 0, { cast: false, noOutline: true });
  return g;
}
// a room polygon cut to the octagon (corner diagonals x+y=c etc.)
function clipOct(poly, c) { if (!c) return poly; const planes = [[1, 1, c], [-1, 1, c - 46], [1, -1, c - 40], [-1, -1, c - 86]]; // a*x + b*y >= k
  planes.forEach(([a, b, k]) => { const out = []; for (let i = 0; i < poly.length; i++) { const P = poly[i], Q = poly[(i + 1) % poly.length]; const fp = a * P[0] + b * P[1] - k, fq = a * Q[0] + b * Q[1] - k;
    if (fp >= 0) out.push(P); if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); } } poly = out; }); return poly; }
function floorPoly(p, pts, mat, rep, y) { if (!pts || pts.length < 3) return; const sh = new T.Shape(); pts.forEach(([x, yy], i) => { const [wx, wz] = W(x, yy); i ? sh.lineTo(wx, -wz) : sh.moveTo(wx, -wz); }); sh.closePath();
  const geo = new T.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); const m = mat.clone(); if (mat.map) { m.map = mat.map.clone(); m.map.repeat.set(1 / rep, 1 / rep); m.map.needsUpdate = true; } add(p, geo, m, 0, y, 0, { cast: false, noOutline: true }); }
// solid walls between rooms, cut low (like a doll house) so the rooms stay visible; door cells stay open
function solidRun(p, x1, y1, x2, y2, doors, h = 1.35) {
  const vertical = x1 === x2, start = vertical ? y1 : x1, end = vertical ? y2 : x2, open = new Set(doors || []); const runs = []; let run = start;
  for (let c = start; c < end; c++) if (open.has(c)) { if (c > run) runs.push([run, c]); run = c + 1; }
  if (run < end) runs.push([run, end]);
  runs.forEach(([a, b]) => { const len = b - a + .16; const [cx, cz] = vertical ? W(x1, (a + b) / 2) : W((a + b) / 2, y1); const g = grp(p, cx, cz, vertical ? Math.PI / 2 : 0);
    add(g, new T.BoxGeometry(len, h, .16), M.wall, 0, h / 2, 0); add(g, new T.BoxGeometry(len + .02, .06, .2), M.trimA, 0, h + .03, 0, { cast: false, noOutline: true }); add(g, new T.BoxGeometry(len + .01, .1, .18), M.trimB, 0, .05, 0, { cast: false, noOutline: true }); });
}
// low glass dividers between rooms; door cells stay open
function glassRun(p, x1, y1, x2, y2, doors, h = 1.3) {
  const vertical = x1 === x2, start = vertical ? y1 : x1, end = vertical ? y2 : x2, open = new Set(doors || []); const runs = []; let run = start;
  for (let c = start; c < end; c++) if (open.has(c)) { if (c > run) runs.push([run, c]); run = c + 1; }
  if (run < end) runs.push([run, end]);
  runs.forEach(([a, b]) => { const len = b - a; const [cx, cz] = vertical ? W(x1, (a + b) / 2) : W((a + b) / 2, y1); const g = grp(p, cx, cz, vertical ? Math.PI / 2 : 0);
    add(g, new T.BoxGeometry(len, h - .1, .03), M.glass, 0, h / 2 + .03, 0, { cast: false, noOutline: true });
    add(g, new T.BoxGeometry(len, .05, .08), M.metal, 0, h, 0); add(g, new T.BoxGeometry(len, .05, .09), M.trimA, 0, .03, 0, { cast: false, noOutline: true });
    const n = Math.max(1, Math.round(len / 1.4)); for (let i = 0; i <= n; i++) add(g, RB(.08, h + .04, .08, .02), M.metal, -len / 2 + len * i / n, h / 2, 0); });
}
// 18.0.0 patch 157 (martin, his sample photos): every room name is a flat black acrylic plaque on the wall beside
// its door (white name, thin line, small gold pins) - no door frames. Shared areas: the plaque sits flat on the glass.
function plateMat(text, sub) { const t = tex(640, 180, (c, w, h) => { c.fillStyle = '#0C0D10'; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); // acrylic shine
  c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.textBaseline = 'middle'; let f = 64; do { c.font = `700 ${f}px Inter, Segoe UI, Arial, sans-serif`; f -= 2; } while (c.measureText(text).width > w - 150 && f > 22);
  const ty = sub ? h * .4 : h * .44; c.fillText(text, w / 2, ty); const lw = Math.min(w - 150, c.measureText(text).width + 30);
  c.fillRect(w / 2 - lw / 2, ty + f * .62, lw, 3);
  if (sub) { c.font = `500 28px Inter, Segoe UI, Arial, sans-serif`; c.fillText(sub, w / 2, ty + f * .62 + 30); } });
  return toon({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: DARK ? .55 : .2 }); }
// w = width in m; both = a face on each side (glass)
function wallPlaque(p, x, y, z, ry, text, textB, both, w = 1.15) { const g = grp(p, x, z, ry, y); const h = w * 180 / 640, d = both ? .03 : .025;
  add(g, RB(w, h, d, .006), M.black, 0, 0, both ? 0 : d / 2 + .02, { noOutline: true });
  add(g, new T.PlaneGeometry(w - .01, h - .01), plateMat(text), 0, 0, (both ? d / 2 : d + .02) + .002, { cast: false, noOutline: true });
  if (both) add(g, new T.PlaneGeometry(w - .01, h - .01), plateMat(textB || text), 0, 0, -d / 2 - .002, { ry: Math.PI, cast: false, noOutline: true });
  [-1, 1].forEach((sd) => [1, both ? -1 : 0].forEach((fz) => { if (!fz) return; add(g, cyl(.028, .028, .05, 12), M.gold, sd * (w / 2 - .07), 0, fz * (both ? d / 2 + .02 : d + .04), { rx: Math.PI / 2, noOutline: true }); }));
  return g; }
function roomPlates(p, state) { const done = new Set();
  const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const Y = 1.0; // the inner walls are 1.35 m high: the plaque sits just under the top trim
  state.rooms.forEach((r) => { if (!r.name || r.id === 'plaza' || r.id === 'rec') return; let best = null; // reception: the name is on the front desk
    (state.walls || []).forEach(([x1, y1, x2, y2, g, doors]) => { if (!doors || !doors.length) return; const v = x1 === x2;
      const cells = doors.filter((c) => v ? (inR(r, x1 - 1, c) || inR(r, x1, c)) : (inR(r, c, y1 - 1) || inR(r, c, y1))); if (!cells.length) return;
      const run = [cells[0]]; while (cells.includes(run[run.length - 1] + 1)) run.push(run[run.length - 1] + 1);
      const outside = v ? (inR(r, x1, run[0]) ? -1 : 1) : (inR(r, run[0], y1) ? -1 : 1); // side of the wall that is NOT this room
      const out = v ? [outside < 0 ? x1 - 1 : x1, run[0]] : [run[0], outside < 0 ? y1 - 1 : y1]; const o = roomOf(state, out[0], out[1]);
      const hub = o && o.id === 'plaza'; if (o && o.id === r.id) return; if (!best || (hub && !best.hub)) best = { v, line: v ? x1 : y1, a: run[0], b: run[run.length - 1] + 1, hub, sd: outside }; });
    if (!best) return; const key = (best.v ? 'v' : 'h') + best.line + ':' + best.a; if (done.has(key)) return; done.add(key);
    const lo = best.v ? r.y : r.x, hi = best.v ? r.y + r.h : r.x + r.w; let at = best.b + .7; if (at > hi - .5) at = best.a - .7; if (at < lo + .5) at = (best.a + best.b) / 2; // beside the door, inside the wall length
    let off = best.sd * .09; let [x, z] = best.v ? W(best.line + off, at) : W(at, best.line + off);
    let ry = best.v ? (best.sd < 0 ? -Math.PI / 2 : Math.PI / 2) : (best.sd < 0 ? Math.PI : 0);
    // p161 (martin): IRWIN's plaque sat on the pantry side of his wall. It goes on the hub face of the wall beside his door.
    if (r.id === 'me') { [x, z] = W(9, 7 + .09); ry = 0; }
    // martin: a room shared by two departments = two plaques, one above the other
    if (r.depts && r.depts.length > 1) { wallPlaque(p, x, 1.14, z, ry, r.depts[0], null, false, 1.15); wallPlaque(p, x, .8, z, ry, r.depts[1], null, false, 1.15); }
    else wallPlaque(p, x, Y, z, ry, r.name, null, false, 1.3); });
  (state.plates || []).forEach(([px, py, k, text, textB, side]) => { const v = k === 'v';
    const doors = []; (state.walls || []).forEach(([x1, y1, x2, y2, g, ds]) => { if (v ? (x1 === x2 && x1 === px) : (y1 === y2 && y1 === py)) (ds || []).forEach((c) => doors.push(c)); });
    let c = v ? py : px; const c0 = Math.floor(c); if (doors.includes(c0)) { let a = c0, b = c0 + 1; while (doors.includes(a - 1)) a--; while (doors.includes(b)) b++; c = side === 'a' ? a - .65 : side === 'b' ? b + .65 : doors.includes(b) ? a - .65 : b + .65; } // beside the opening, on the glass
    const [x, z] = v ? W(px, c) : W(c, py); wallPlaque(p, x, 1.05, z, v ? Math.PI / 2 : 0, text, textB, true, 1.3); });
}
// p157 (martin): a small wooden name bar on each person's desk (their name, white letters)
function deskBarMat(text) { const t = tex(320, 72, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3B2416'); g.addColorStop(.5, '#5A3722'); g.addColorStop(1, '#3B2416'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, 6 + i * 7); c.bezierCurveTo(w * .3, 2 + i * 7, w * .6, 11 + i * 7, w, 5 + i * 7); c.stroke(); }
  c.fillStyle = '#F4F1EA'; c.textAlign = 'center'; c.textBaseline = 'middle'; let f = 40; do { c.font = `700 ${f}px Inter, Segoe UI, Arial, sans-serif`; f -= 2; } while (c.measureText(text).width > w - 24 && f > 14); c.fillText(text, w / 2, h / 2 + 2); });
  return toon({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: DARK ? .35 : .05 }); }
function deskBar(state, p) {
  if (!p.human || !p.home) return null; const c = chairByTile.get(p.home[0] + ',' + p.home[1]); if (!c || !c.deskH) return null;
  if (roomOf(state, c.x, c.y).id === 'rec') return null; // reception desk has its own plate
  const exec = c.deskH > .72, v = DIRV[c.dir] || DIRV.S, k = exec ? .85 : .64, [px, pz] = W(c.x + .5, c.y + .5);
  const g = new T.Group(); g.position.set(px + v[0] * k, 0, pz + v[1] * k); g.rotation.y = FACE[c.dir] + Math.PI;
  const top = exec ? .835 : .62, bx = exec ? -.62 : -.3, bz = exec ? -.36 : -.2, name = String(p.name || '').slice(0, 18);
  const b = grp(g, bx, bz, Math.PI, top); add(b, RB(.52, .012, .09, .004), M.black, 0, .006, 0, { noOutline: true });
  const bar = grp(b, 0, 0, 0, .062); bar.rotation.x = -.35; add(bar, RB(.5, .11, .014, .003), M.woodDark, 0, 0, 0, { noOutline: true }); add(bar, new T.PlaneGeometry(.48, .1), deskBarMat(name), 0, 0, .0085, { cast: false, noOutline: true });
  return g; }
function ibaSign(p, x, z, s, lift = 0) {
  const g = grp(p, x, z); g.position.y = lift; g.scale.setScalar(s);
  add(g, cyl(2.2, 2.35, .3, 8), M.wallDark, 0, .15, 0); add(g, cyl(2.24, 2.24, .05, 8, true), M.trimA, 0, .3, 0, { cast: false, noOutline: true });
  add(g, cyl(1.9, 1.9, .03, 40), toon({ color: DARK ? 0x3A2E7A : 0xE8E4DC }), 0, .32, 0, { noOutline: true });
  // bold IBA letters: one solid extruded shape per letter (no seams, holes cut cleanly)
  IBA = new T.Group(); IBA.position.set(x, lift + .35 * s, z); IBA.scale.setScalar(s);
  const mat = DARK ? glowM(P.iba, .35) : toon({ color: P.iba }), edge = DARK ? glowM(P.ibaEdge, .9) : toon({ color: P.ibaEdge });
  const ex = (shape, x0) => { const geo = new T.ExtrudeGeometry(shape, { depth: .5, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 2, curveSegments: 18 }); geo.translate(x0, 0, -.25); const m = new T.Mesh(geo, [mat, edge]); m.castShadow = true; m.receiveShadow = true; IBA.add(m); };
  const H = 2.0;
  { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(.42, 0); sh.lineTo(.42, H); sh.lineTo(0, H); sh.closePath(); ex(sh, -2.15); }
  { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(.72, 0); sh.bezierCurveTo(1.16, 0, 1.3, .32, 1.3, .55); sh.bezierCurveTo(1.3, .82, 1.12, .98, .98, 1.03); sh.bezierCurveTo(1.12, 1.1, 1.22, 1.26, 1.22, 1.48); sh.bezierCurveTo(1.22, 1.78, 1.0, H, .66, H); sh.lineTo(0, H); sh.closePath();
    const h1 = new T.Path(); h1.moveTo(.4, .34); h1.lineTo(.7, .34); h1.bezierCurveTo(.86, .34, .9, .46, .9, .56); h1.bezierCurveTo(.9, .68, .84, .82, .68, .82); h1.lineTo(.4, .82); h1.closePath();
    const h2 = new T.Path(); h2.moveTo(.4, 1.2); h2.lineTo(.64, 1.2); h2.bezierCurveTo(.78, 1.2, .83, 1.32, .83, 1.42); h2.bezierCurveTo(.83, 1.54, .76, 1.66, .62, 1.66); h2.lineTo(.4, 1.66); h2.closePath();
    sh.holes.push(h1, h2); ex(sh, -1.55); }
  { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(.44, 0); sh.lineTo(.56, .42); sh.lineTo(1.08, .42); sh.lineTo(1.2, 0); sh.lineTo(1.64, 0); sh.lineTo(1.04, H); sh.lineTo(.6, H); sh.closePath();
    const h = new T.Path(); h.moveTo(.66, .76); h.lineTo(.98, .76); h.lineTo(.82, 1.38); h.closePath(); sh.holes.push(h); ex(sh, .05); }
  addOutlines(IBA, OUTC); return IBA;
}
function chairsFor(state, o) { // every work chair that uses this desk (two people can share one desk, back to back)
  return state.chairs.filter((c) => { if (c.noDesk || c.hidden || c.stool) return false; const v = DIRV[c.dir] || DIRV.S; const dx = c.x + v[0], dy = c.y + v[1];
    return dx >= Math.floor(o.x) && dx < Math.floor(o.x) + Math.max(1, Math.round(o.w)) && dy >= Math.floor(o.y) && dy < Math.floor(o.y) + Math.max(1, Math.round(o.d)); });
}
function chairFor(state, o) { // the work chair that uses this desk (and which side it sits)
  return state.chairs.find((c) => { if (c.noDesk || c.hidden || c.stool) return false; const v = DIRV[c.dir] || DIRV.S; const dx = c.x + v[0], dy = c.y + v[1];
    return dx >= Math.floor(o.x) && dx < Math.floor(o.x) + Math.max(1, Math.round(o.w)) && dy >= Math.floor(o.y) && dy < Math.floor(o.y) + Math.max(1, Math.round(o.d)); });
}
function furniture(st, state, o) {
  const [cx, cz] = W(o.x + o.w / 2, o.y + o.d / 2), long = Math.max(o.w, o.d), alongZ = o.d > o.w;
  switch (o.t) {
    case 'desk': { const cs = chairsFor(state, o); if (!cs.length) return deskWork(st, cx, cz, 0); let g = null;
      cs.forEach((c) => { c.deskH = .64; if (roomOf(state, c.x, c.y).id === 'rec' && c.dir === 'W') { c.deskH = .8; return; } const v = DIRV[c.dir] || DIRV.S; const [px, pz] = W(c.x + .5, c.y + .5); const k = cs.length > 1 ? .62 : .66; g = deskWork(st, px + v[0] * k, pz + v[1] * k, FACE[c.dir] + Math.PI, .8, .88); }); return g; }
    case 'exec': { const c = chairFor(state, o); const s = Math.min(1, Math.max(o.w, o.d) / 2.2 + .05); if (!c) return deskExec(st, cx, cz, 0, s); c.deskH = .8; const v = DIRV[c.dir] || DIRV.S; const [px, pz] = W(c.x + .5, c.y + .5);
      return deskExec(st, v[0] ? px + v[0] * .85 : px, v[1] ? pz + v[1] * .85 : pz, FACE[c.dir] + Math.PI, s); }
    case 'counter': if (roomOf(state, Math.floor(o.x), Math.floor(o.y)).id === 'rec') return null; return receptionDesk(st, cx, cz, Math.PI, Math.min(1, long * .9 / 3));
    case 'table': if (long <= 1.2) { roundTable(st, cx, cz, .42, .5); return vase(st, cx, .53, cz, .5); } return meetTable(st, cx, cz, o.w - .2, o.d - .3);
    case 'sofa': return sofa(st, cx, cz, faceInSofa(state, o), Math.max(1, Math.round(long * .95)), M.sofa);
    case 'books': return bookcase(st, cx, cz, alongZ ? faceIn(state, o, 1) : faceIn(state, o, 1), long * .95);
    case 'shelf': return bookcase(st, cx, cz, faceIn(state, o, 1), .95);
    case 'cabinet': return cabinet(st, cx, cz, faceIn(state, o, 1));
    case 'cubby': return cubby(st, cx, cz, faceIn(state, o, 1));
    case 'printer': return printer(st, cx, cz, faceIn(state, o, -1));
    case 'kitchen': return coffeeBar(st, cx, cz, faceIn(state, o, -1), long * .95);
    case 'fridge': return fridge(st, cx, cz, faceIn(state, o, -1));
    case 'bar': return barCounter(st, cx, cz, alongZ ? Math.PI / 2 : 0, long * .95);
    case 'rack': { const n = Math.max(1, Math.round(long / 1.2)); for (let i = 0; i < n; i++) { const k = (i + .5) / n - .5; shelfBoxes(st, alongZ ? cx : cx + k * long, alongZ ? cz + k * long : cz, alongZ ? Math.PI / 2 : 0, Math.min(1.1, long / n - .1)); } return null; }
    case 'boxes': return boxes(st, cx, cz);
    case 'tv': return tv(st, cx, cz, faceIn(state, o, 1));
    case 'sink': return sink(st, cx, cz, faceIn(state, o, -1), long * .9);
    case 'toilet': return toilet(st, cx, cz, faceIn(state, o, 1) + Math.PI);
    case 'urinal': return urinal(st, cx, cz, faceIn(state, o, 1) + Math.PI);
    case 'stall': return partition(st, cx, cz, alongZ ? Math.PI / 2 : 0, long);
    case 'plant': return plantBig(st, cx, cz, 1.35);
    case 'rug': { const r = roomOf(state, Math.floor(cx + 23), Math.floor(cz + 20)); const mat = r && (LEAD.includes(r.id) || r.id === 'meet') ? M.carpet2 : M.carpet; floorPoly(st, clipOct([[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.d], [o.x, o.y + o.d]], state.oct || 0), mat, 1.4, .02); return null; } // p156: rugs stop at the cut corners
    case 'tilefloor': floorPoly(st, clipOct([[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.d], [o.x, o.y + o.d]], state.oct || 0), M.tiles, 1.2, .012); return null;
    case 'lowcab': { const g = grp(st, cx, cz, faceIn(state, o, 1)); const len = Math.max(o.w, o.d) * .92; add(g, RB(len, .78, .46, .03), M.woodDark, 0, .39, 0); add(g, RB(len + .04, .04, .5, .01), M.woodTop || M.woodDark, 0, .8, 0, { noOutline: true });
      for (let i = 0; i < Math.max(2, Math.round(len / .45)); i++) { const n = Math.max(2, Math.round(len / .45)), x0 = -len / 2 + len * (i + .5) / n; add(g, RB(len / n - .04, .66, .02, .01), M.wood, x0, .4, .235, { noOutline: true }); add(g, RB(.1, .02, .02, .005), M.chrome, x0, .62, .25, { noOutline: true }); }
      return g; }
    case 'board': { const g = grp(st, cx, cz, faceIn(state, o, 1)); const len = Math.max(o.w, o.d) * .8; add(g, RB(len + .08, 1.1, .05, .02), M.metal, 0, 1.45, -.38); add(g, RB(len, 1.0, .02, .01), M.paper || M.white, 0, 1.45, -.35, { noOutline: true });
      add(g, RB(len * .9, .04, .1, .01), M.metal, 0, .92, -.3); [-.3, -.1, .15].forEach((x, i) => add(g, RB(.1, .02, .02, .005), [M.trimA, M.trimB, M.black][i], x * len, .95, -.27, { noOutline: true }));
      const ink = toon({ color: 0x2C3D6B }); [[-.3, 1.7, .5], [-.25, 1.55, .35], [.1, 1.62, .45], [-.05, 1.3, .6]].forEach(([x, y, w]) => add(g, RB(w * len * .5, .02, .01, .002), ink, x * len, y, -.335, { cast: false, noOutline: true })); return g; }
    case 'art': { const g = grp(st, cx, cz, faceIn(state, o, 1)); const k = o.k || 1;
      const pic = tex(256, 180, (c, w, h) => { const pals = [['#1E3A5F', '#C9A24A', '#E8DCC8', '#8A2D3A'], ['#2F5A48', '#E3C98A', '#F4F1EA', '#2C3D6B'], ['#5A2A4A', '#F3C45B', '#2FE0D0', '#141214'], ['#E8DCC8', '#2C3D6B', '#C9A24A', '#7A4A2A']][k % 4];
        c.fillStyle = pals[0]; c.fillRect(0, 0, w, h); for (let i = 0; i < 7; i++) { c.fillStyle = pals[1 + (i + k) % 3]; c.globalAlpha = .55 + .4 * ((i * 37 + k * 13) % 10) / 10; c.beginPath();
          if ((i + k) % 3) c.arc(((i * 71 + k * 29) % 220) + 18, ((i * 43 + k * 17) % 140) + 20, 16 + (i * 11 + k) % 34, 0, Math.PI * 2); else c.rect(((i * 53 + k * 31) % 200) + 10, ((i * 29 + k * 7) % 120) + 10, 30 + (i * 19) % 60, 8 + (i * 7) % 22); c.fill(); } c.globalAlpha = 1; });
      add(g, RB(1.05, .76, .05, .01), k % 2 ? M.gold || M.trimA : M.black, 0, 1.75, -.44); add(g, new T.PlaneGeometry(.92, .63), toon({ map: pic }), 0, 1.75, -.41, { cast: false, noOutline: true }); return g; }
    case 'logo': { const g = grp(st, cx, cz, faceIn(state, o, 1)); const len = Math.max(o.w, o.d) * .95;
      const lt = tex(512, 256, (c, w, h) => { c.fillStyle = DARK ? '#140E10' : '#1E2433'; c.fillRect(0, 0, w, h); c.fillStyle = DARK ? '#F3C45B' : '#C9A24A'; c.font = '900 150px Arial Black, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('IBA', w / 2, h / 2 - 14);
        c.font = '700 26px Segoe UI, Arial, sans-serif'; c.fillStyle = '#F6EBD2'; c.fillText('W E L C O M E', w / 2, h - 34); c.fillRect(w * .2, h - 60, w * .6, 3); });
      add(g, RB(len, 2.2, .16, .03), M.woodDark, 0, 1.1, -.38); add(g, new T.PlaneGeometry(len * .86, len * .43), toon({ map: lt, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: DARK ? .5 : .15 }), 0, 1.35, -.295, { cast: false, noOutline: true });
      add(g, RB(len + .04, .06, .2, .01), M.trimA, 0, 2.23, -.38, { cast: false, noOutline: true }); add(g, RB(len * .9, .04, .04, .01), M.lamp, 0, 2.12, -.27, { cast: false, noOutline: true }); return g; }
    case 'divider': { const along = o.w >= o.d, len = Math.max(o.w, o.d); const g = grp(st, cx, cz, along ? 0 : Math.PI / 2); add(g, new T.BoxGeometry(len - .06, .5, .03), M.glass, 0, .9, 0, { cast: false, noOutline: true }); add(g, new T.BoxGeometry(len, .04, .06), M.metal, 0, 1.16, 0); [-1, 1].forEach((sd) => add(g, new T.BoxGeometry(.04, .56, .06), M.metal, sd * len / 2, .88, 0)); return g; }
    case 'cooler': return waterDisp(st, cx, cz, faceIn(state, o, -1));
    case 'vending': return vending(st, cx, cz, faceIn(state, o, -1));
    case 'drinks': return drinksFridge(st, cx, cz, faceIn(state, o, -1));
    case 'adtv': return adTV(st, cx, cz, faceIn(state, o, 1), Math.max(o.w, o.d) * .8, ADS);
    case 'fountain': return kiosk(st, cx, cz); // p159 (martin): the info robot stands in the middle; the IBA fountain moved to the entrance roundabout
    case 'chair': return null;
    default: { const g = grp(st, cx, cz); add(g, RB(Math.max(.3, o.w * .9), Math.max(.4, (o.h || 20) / 30), Math.max(.3, o.d * .9), .04), M.woodDark, 0, Math.max(.4, (o.h || 20) / 30) / 2, 0); return g; }
  }
}
function faceInSofa(state, o) { // sofas look the way the plan says, else toward the middle of their room
  if (o.face && DIRV[o.face]) { const v = DIRV[o.face]; return Math.atan2(v[0], v[1]) + Math.PI; }
  const cx = o.x + o.w / 2, cy = o.y + o.d / 2, r = roomOf(state, Math.floor(cx), Math.floor(cy)); if (!r) return 0;
  const dx = r.x + r.w / 2 - cx, dy = r.y + r.h / 2 - cy; const v = o.w >= o.d ? [0, Math.sign(dy) || 1] : [Math.sign(dx) || 1, 0];
  return Math.atan2(v[0], v[1]) + Math.PI;
}
function chair(st, c) {
  const [x, z] = W(c.x + .5, c.y + .5), ry = FACE[c.dir] || 0;
  if (c.stool) return stool(st, x, z);
  if (c.hidden) return null; // a seat on a sofa: the sofa is already there
  if (c.sprite === 'visitor') return chairGuest(st, x, z, ry);
  if (c.sprite === 'lounge') return sofa(st, x, z, ry, 1, M.sofa2);
  const lead = c.col === '#3A2A20'; return chairOffice(st, x, z, ry, lead ? M.leather : M.chair);
}
// 18.0.0 patch 159 (martin): the info desk in the middle of the office. A big-head IBA robot in uniform behind a round
// counter with screens. Anyone can ask it where an invoice is (it opens Ana's search); later it takes requests too.
let KIOSK = null;
function kiosk(st, x, z) {
  const oct = { ry: Math.PI / 8, cast: false, noOutline: true };
  add(st, cyl(7.3, 7.3, .03, 8), M.carpet, x, .015, z, oct); add(st, cyl(7.45, 7.45, .02, 8), M.trimA, x, .008, z, oct);
  add(st, cyl(3.1, 3.25, .2, 8), M.wallDark, x, .1, z, { ry: Math.PI / 8 }); add(st, cyl(3.16, 3.16, .04, 8, true), M.trimA, x, .21, z, oct);
  // round counter (open at the back so the robot can walk in), wooden top, gold trim
  const ring = (r0, r1, h, y, mat, a0 = .5, len = Math.PI * 2 - 1) => { const sh = new T.Shape(); sh.absarc(0, 0, r1, a0, a0 + len, false); sh.absarc(0, 0, r0, a0 + len, a0, true);
    const geo = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 40 }); geo.rotateX(-Math.PI / 2); return add(st, geo, mat, x, y, z, { ry: Math.PI / 2 }); };
  ring(1.75, 2.0, .9, .2, M.wall); ring(1.7, 2.08, .07, 1.1, M.woodDark); ring(2.0, 2.1, .05, .7, M.trimA);
  // p162 (martin): 3 big screens standing ON the front counter (the open back is where the robot walks in), facing
  // the visitors, with a moving "searching the folders" picture; the INFORMATION plates follow the curve of the counter.
  const scr = kioskScreen();
  [-.5, 0, .5].forEach((a) => { const g = grp(st, x + Math.sin(a) * 1.86, z + Math.cos(a) * 1.86, a, 1.17);
    add(g, cyl(.05, .09, .1, 10), M.black, 0, .05, -.05); add(g, RB(.06, .22, .05, .01), M.black, 0, .2, -.07);
    add(g, RB(.86, .56, .05, .02), M.black, 0, .55, -.03); add(g, new T.PlaneGeometry(.8, .5), scr.mat, 0, .55, .0, { cast: false, noOutline: true }); });
  const sg = tex(1024, 128, (c, w, h) => { c.fillStyle = DARK ? '#140E10' : '#1E2433'; c.fillRect(0, 0, w, h); c.fillStyle = '#C9A24A'; c.fillRect(0, 6, w, 4); c.fillRect(0, h - 10, w, 4);
    c.fillStyle = '#F6EBD2'; c.font = '800 64px Space Grotesk, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('i   INFORMATION', w / 2, h / 2 + 3); });
  const sm = toon({ map: sg, side: T.FrontSide });
  [0, Math.PI / 2, -Math.PI / 2].forEach((a) => { const len = 1.05; const geo = new T.CylinderGeometry(2.012, 2.012, .26, 24, 1, true, a - len / 2, len);
    add(st, geo, sm, x, .5, z, { cast: false, noOutline: true }); }); // curved, flush on the counter front (below the gold trim)
  // the robot: dynamic (it turns to look around), big head, IBA navy uniform with gold tie and badge
  const g0 = new T.Group(); g0.position.set(x, .22, z);
  const r = bot(g0, { name: 'IBA', color: 0xC9A24A, tie: true }); r.scale.setScalar(2.0); r.userData.uid = 777; r.userData.act = 'stand';
  const rig = r.userData.rig; rig.head.scale.setScalar(1.18);
  const navy = toon({ color: 0x24305E }); add(rig.torso, RB(.46, .3, .33, .12, 4), navy, 0, .19, 0);
  const badge = tex(128, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#C9A24A'; c.font = '900 40px Inter, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('IBA', w / 2, h / 2 + 2); });
  add(rig.torso, new T.PlaneGeometry(.2, .1), new T.MeshBasicMaterial({ map: badge, transparent: true }), -.11, .27, -.17, { ry: Math.PI, cast: false, noOutline: true });
  const hit = add(g0, new T.CylinderGeometry(2.1, 2.1, 2.6, 12), new T.MeshBasicMaterial({ visible: false }), 0, 1.3, 0, { cast: false, noOutline: true }); hit.userData.hit = { type: 'kiosk' }; pickables.push(hit);
  KIOSK = { g: g0, r }; return null;
}
// the info desk screens: one small moving picture shared by the 3 screens (redrawn 8 times a second)
let KSCR = null;
function kioskScreen() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200; const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
  KSCR = { cv, c: cv.getContext('2d'), t, last: 0, mat: new T.MeshBasicMaterial({ map: t, toneMapped: false }) }; drawKScr(0); return KSCR;
}
const KSCR_WORDS = ['Find a PO', 'Find a vendor', 'Where is my invoice?', 'Ask me'];
function drawKScr(ts) {
  const { c } = KSCR, w = 320, h = 200; const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0E2A3A'); g.addColorStop(1, '#0A1622'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = '#C9A24A'; c.fillRect(0, 0, w, 26); c.fillStyle = '#14202E'; c.font = '800 16px Inter, Segoe UI, sans-serif'; c.textBaseline = 'middle'; c.fillText('IBA  ·  INFORMATION', 10, 14);
  // a row of folders; the magnifier glides over them, the one under it lifts and glows
  const cols = ['#3FB8C8', '#E0A526', '#9B7CFF', '#4CC38A', '#E5484D'], n = 5, fw = 44, gap = 14, x0 = (w - (n * fw + (n - 1) * gap)) / 2, y0 = 70;
  const mx = x0 + fw / 2 + ((Math.sin(ts * .9) + 1) / 2) * ((n - 1) * (fw + gap)); const on = Math.round((mx - x0 - fw / 2) / (fw + gap));
  for (let i = 0; i < n; i++) { const fx = x0 + i * (fw + gap), lift = i === on ? 8 : 0; c.fillStyle = cols[i]; c.globalAlpha = i === on ? 1 : .55;
    c.fillRect(fx, y0 - lift, fw * .45, 7); c.fillRect(fx, y0 + 5 - lift, fw, 34); c.globalAlpha = 1; }
  c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; c.beginPath(); c.arc(mx, y0 + 18, 17, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(mx + 12, y0 + 31); c.lineTo(mx + 24, y0 + 44); c.stroke();
  // typing line
  const word = KSCR_WORDS[Math.floor(ts / 3) % KSCR_WORDS.length], k = Math.min(word.length, Math.floor((ts % 3) * 12));
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(16, 140, w - 32, 36); c.fillStyle = '#F6EBD2'; c.font = '600 18px Inter, Segoe UI, sans-serif';
  c.fillText(word.slice(0, k) + (Math.floor(ts * 2) % 2 ? '|' : ''), 26, 158);
  KSCR.t.needsUpdate = true;
}
function kioskTick(K, ts, dt) { if (!K) return; if (KSCR && ts - KSCR.last > .125) { KSCR.last = ts; try { drawKScr(ts); } catch (_) {} } const r = K.r; if (window.ibaOfficeKioskBusy) { K.spin = (K.spin || 0) + dt * 5.5; r.rotation.y = Math.PI + Math.sin(ts * .25) * 1.1 + K.spin; r.position.y = Math.abs(Math.sin(ts * 9)) * .12; } else { if (K.spin) K.spin = 0; r.rotation.y = Math.PI + Math.sin(ts * .25) * 1.1; r.position.y = Math.sin(ts * 1.6) * .03; } /* p163: spins + hops while searching */ try { applyPose(r, dt, ts); } catch (_) {} }
// the hub: octagon fountain, IBA turning on top, an octagon rug around it
function fountain(st, x, z, outdoor) {
  const oct = { ry: Math.PI / 8, cast: false, noOutline: true };
  if (!outdoor) { add(st, cyl(7.3, 7.3, .03, 8), M.carpet, x, .015, z, oct); add(st, cyl(7.45, 7.45, .02, 8), M.trimA, x, .008, z, oct); }
  add(st, cyl(3.3, 3.4, .5, 8), M.wallDark, x, .25, z, { ry: Math.PI / 8 }); add(st, cyl(3.36, 3.36, .05, 8, true), M.trimA, x, .52, z, oct);
  const water = toon({ color: DARK ? 0x1E8A96 : 0x4FB0D8, emissive: DARK ? 0x0E3A40 : 0x0A2A3A, emissiveIntensity: .35 });
  add(st, cyl(3.05, 3.05, .06, 8), water, x, .54, z, oct);
  add(st, cyl(1.55, 1.75, .75, 8), M.wall, x, .62, z, { ry: Math.PI / 8 }); add(st, cyl(1.6, 1.6, .04, 8, true), M.trimA, x, 1.0, z, oct);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, r = 2.85; add(st, cyl(.06, .08, .1, 8), M.trimA, x + Math.sin(a) * r, .6, z + Math.cos(a) * r, { cast: false, noOutline: true }); } // jet nozzles
  FOUNT = fountainWater(x, z, water);
  SIGN = ibaSign(st, x, z, .62, .78); return null;
}
// p158 (martin): moving water - 8 arcs of drops from the pool into the centre, a water sheet falling off the top basin, rings spreading on the pool
function fountainWater(x, z, poolMat) {
  const g = new T.Group(); g.position.set(x, 0, z);
  const N = 8, PER = 16, drop = new T.InstancedMesh(new T.SphereGeometry(.045, 6, 5), new T.MeshBasicMaterial({ color: DARK ? 0x9FF3FF : 0xE6FAFF, transparent: true, opacity: .85, depthWrite: false }), N * PER);
  drop.frustumCulled = false; drop.castShadow = false; g.add(drop);
  const sheetT = tex(64, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const sx = Math.random() * w, sy = Math.random() * h, l = 10 + Math.random() * 30; const gr = c.createLinearGradient(0, sy, 0, sy + l); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(sx, sy, 1.5 + Math.random() * 2, l); } }, [6, 1]);
  sheetT.colorSpace = T.NoColorSpace;
  const sheet = new T.Mesh(new T.CylinderGeometry(1.64, 1.8, .44, 32, 1, true), new T.MeshBasicMaterial({ color: DARK ? 0x7FE6F2 : 0xBFEFFF, map: sheetT, transparent: true, opacity: .55, depthWrite: false, side: T.DoubleSide }));
  sheet.position.y = .8; g.add(sheet);
  const rings = []; for (let i = 0; i < 4; i++) { const m = new T.Mesh(new T.RingGeometry(.94, 1, 40), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = .58; g.add(m); rings.push(m); }
  const splash = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + Math.PI / 8; const m = new T.Mesh(new T.RingGeometry(.6, 1, 20), rings[0].material.clone()); m.rotation.x = -Math.PI / 2; m.position.set(Math.sin(a) * 1.85, .58, Math.cos(a) * 1.85); g.add(m); splash.push(m); }
  return { g, drop, sheetT, rings, splash, poolMat, N, PER, base: poolMat.emissiveIntensity || .35, m4: new T.Matrix4(), v: new T.Vector3() };
}
function fountainTick(F, ts) {
  if (!F) return; const { N, PER, drop, m4, v } = F, T0 = 1.1; // seconds for one drop to fly
  for (let j = 0; j < N; j++) { const a = j / N * Math.PI * 2 + Math.PI / 8, sx = Math.sin(a), sz = Math.cos(a);
    for (let k = 0; k < PER; k++) { const u = ((ts / T0) + k / PER + j * .037) % 1; const r = 2.85 - u * 1.0, y = .66 + Math.sin(u * Math.PI) * .75 - u * .08;
      v.set(sx * r, y, sz * r); const sc = .7 + .5 * Math.sin(u * Math.PI); m4.makeScale(sc, sc * 1.4, sc).setPosition(v); drop.setMatrixAt(j * PER + k, m4); } }
  drop.instanceMatrix.needsUpdate = true;
  F.sheetT.offset.y = (ts * .9) % 1;
  F.rings.forEach((m, i) => { const u = ((ts * .28) + i / F.rings.length) % 1, r = 1.85 + u * 1.15; m.scale.set(r, r, 1); m.material.opacity = .32 * (1 - u); });
  F.splash.forEach((m, i) => { const u = ((ts / T0) * 2 + i * .13) % 1, r = .12 + u * .22; m.scale.set(r, r, 1); m.material.opacity = .5 * (1 - u); });
  F.poolMat.emissiveIntensity = F.base + Math.sin(ts * 2.1) * .06;
}
function seatY(c) { return !c ? .42 : c.stool ? .73 : c.hidden ? .42 : c.sprite === 'lounge' ? .5 : c.sprite === 'visitor' ? .46 : .44; }
function mergeStatic(st) {
  st.updateMatrixWorld(true); const by = new Map(), byNo = new Map();
  st.traverse((o) => { if (!o.isMesh) return; const key = o.material; const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    ['uv1', 'uv2', 'tangent', 'color'].forEach((a) => g.deleteAttribute(a)); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const map = o.userData.noOutline ? byNo : by; if (!map.has(key)) map.set(key, { cast: o.castShadow, list: [] }); map.get(key).list.push(g); });
  const out = new T.Group(); const outl = [];
  for (const [map, outline] of [[by, true], [byNo, false]]) for (const [mat, v] of map) { const geo = mergeGeos(v.list); const m = new T.Mesh(geo, mat); m.castShadow = v.cast; m.receiveShadow = true; out.add(m); if (outline && !mat.transparent) outl.push(geo.clone()); }
  if (outl.length) out.add(new T.Mesh(mergeGeos(outl), OUT));
  st.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  return out;
}
function car(p, x, z, ry, col) { const g = grp(p, x, z, ry); const body = toon({ color: col });
  add(g, RB(1.8, .55, 4.1, .2, 3), body, 0, .55, 0); add(g, RB(1.6, .5, 2.1, .22, 3), body, 0, 1.05, .15); add(g, RB(1.5, .4, 2.0, .18, 3), M.glass, 0, 1.08, .15, { noOutline: true, cast: false });
  [[-.85, 1.3], [.85, 1.3], [-.85, -1.3], [.85, -1.3]].forEach(([wx, wz]) => add(g, cyl(.34, .34, .24, 16), M.black, wx, .34, wz, { rz: Math.PI / 2 }));
  add(g, RB(1.5, .12, .05, .02), M.lamp, 0, .62, -2.05, { cast: false, noOutline: true }); add(g, RB(1.5, .1, .05, .02), toon({ color: 0xC21A3A, emissive: 0xC21A3A, emissiveIntensity: .5 }), 0, .66, 2.05, { cast: false, noOutline: true }); return g; }
function streetLamp(p, x, z) { const g = grp(p, x, z); add(g, cyl(.06, .08, 3.4, 8), M.black, 0, 1.7, 0); add(g, RB(.7, .1, .22, .03), M.black, .3, 3.4, 0); add(g, RB(.5, .04, .16, .02), M.lamp, .4, 3.34, 0, { cast: false, noOutline: true }); return g; }
// outside the entrance wall: pavement, a walkway to the door, parking bays with cars
function outside(st, door) {
  const asph = toon({ color: DARK ? 0x141214 : 0x6B6E74 }), pave = toon({ color: DARK ? 0x2A2224 : 0xCFC6B8 }), grass = toon({ color: DARK ? 0x15241A : 0x7DAA5A }), line = DARK ? M.gold : M.white;
  add(st, new T.BoxGeometry(14, .3, 44), grass, -30, -.17, 0, { cast: false, noOutline: true });
  add(st, new T.BoxGeometry(2.4, .06, 40.4), pave, -24.4, .01, 0, { cast: false, noOutline: true });
  add(st, new T.BoxGeometry(9.4, .04, 38), asph, -30.4, 0, 0, { cast: false, noOutline: true });
  const [, dz] = W(0, door[1] + .5); add(st, new T.BoxGeometry(9.6, .07, 2.2), pave, -30.3, .02, dz, { cast: false, noOutline: true });
  for (let i = 0; i < 4; i++) add(st, new T.BoxGeometry(1.2, .02, .35), M.white, -27.6, .065, dz - .75 + i * .5, { cast: false, noOutline: true });
  const cols = DARK ? [0x8A1626, 0x22202C, 0xB88A2A, 0x2E4A5A, 0x5A5A60] : [0xF2F4F8, 0x22305A, 0x8A2D3A, 0x9AA3AD, 0x2F5A48, 0xC9A24A];
  // p157 (martin): the 6 bays nearest the door are reserved for the managers + Irwin (their own car shows while they are in)
  DOORZ = dz; BAYS = []; const zs = []; for (let z = -18; z <= 18; z += 2.6) if (Math.abs(z - dz) >= 2.4) zs.push(z); const res = new Set(zs.slice().sort((a, b) => Math.abs(a - dz) - Math.abs(b - dz)).slice(0, CAR_ROOMS.length));
  let k = 0; zs.forEach((z) => { add(st, new T.BoxGeometry(5.2, .02, .1), line, -32.2, .03, z - 1.3, { cast: false, noOutline: true });
    if (res.has(z)) { BAYS.push(z); add(st, new T.BoxGeometry(.5, .02, 2.3), M.gold || M.trimA, -34.6, .035, z, { cast: false, noOutline: true }); return; }
    if (rnd() < .72) car(st, -32.4, z, Math.PI / 2 + (rnd() < .5 ? 0 : Math.PI), cols[k++ % cols.length]); }); BAYS.sort((a, b) => Math.abs(a - dz) - Math.abs(b - dz));
  add(st, new T.BoxGeometry(.1, .02, 38), line, -29.6, .03, 0, { cast: false, noOutline: true });
  [-16, -6, 6, 16].forEach((z) => streetLamp(st, -25.6, z)); [-12, 0, 12].forEach((z) => { if (Math.abs(z - dz) > 2) plantBig(st, -24.2, z, 1.1); });
}
// 18.0.0 patch 159 (martin): the land around the building was empty. Now: a road all round, pavements with trees
// and street lamps, a park with palms, paths and benches at the back, a second car park, a bus stop and
// low neighbour buildings in the distance. All static, merged with the rest (no extra cost per frame).
function surroundings(st, door) {
  const o = { cast: false, noOutline: true };
  const grass = toon({ color: DARK ? 0x15241A : 0x86B160 }), grass2 = toon({ color: DARK ? 0x1A2C20 : 0x95BE6C }), asph = toon({ color: DARK ? 0x141214 : 0x5F6268 }),
    pave = toon({ color: DARK ? 0x2A2224 : 0xD6CDBE }), kerb = toon({ color: DARK ? 0x3A3034 : 0xB9B0A2 }), path = toon({ color: DARK ? 0x33292B : 0xE2D3B6 }),
    line = DARK ? M.gold : M.white, trunk = toon({ color: DARK ? 0x2A1A14 : 0x7A5236 }), leafA = toon({ color: DARK ? 0x1E5A3A : 0x4E8F3A }), leafB = toon({ color: DARK ? 0x26704A : 0x5FA645 }),
    palm = toon({ color: DARK ? 0x1F6A48 : 0x3F8F4A }), bench = toon({ color: DARK ? 0x3A2A20 : 0x8A5A3A }), water = toon({ color: DARK ? 0x1E8A96 : 0x5BB6D8, emissive: DARK ? 0x0E3A40 : 0x0A2A3A, emissiveIntensity: .3 });
  const box = (w, h, d, m, x, y, z, extra) => add(st, new T.BoxGeometry(w, h, d), m, x, y, z, Object.assign({}, o, extra || {}));
  // the ground everywhere + the road ring (north, south, east; the west road runs past the front car park)
  box(260, .1, 240, grass, 0, -.24, 0);
  const R0 = 24.2, RW = 7;                                   // pavement starts at the building, road after it
  box(52, .06, 3.4, pave, 0, -.03, -21.9); box(52, .06, 3.4, pave, 0, -.03, 21.9); box(3.4, .06, 47, pave, 24.9, -.03, 0);
  box(86, .05, RW, asph, -6, -.05, -(R0 + 2.4 + RW / 2)); box(86, .05, RW, asph, -6, -.05, R0 + 2.4 + RW / 2); box(RW, .05, 74, asph, 30.1, -.05, 0);
  box(RW, .05, 74, asph, -42.5, -.05, 0);
  [[-(R0 + 2.4), 'z'], [R0 + 2.4, 'z'], [R0 + 2.4 + RW, 'z'], [-(R0 + 2.4 + RW), 'z']].forEach(([z]) => box(86, .12, .25, kerb, -6, -.01, z));
  [26.6, 33.6].forEach((x) => box(.25, .12, 74, kerb, x, -.01, 0));
  for (let x = -46; x < 36; x += 4) { box(2, .02, .18, line, x, -.02, -(R0 + 2.4 + RW / 2)); box(2, .02, .18, line, x, -.02, R0 + 2.4 + RW / 2); }
  const [, DZ] = W(0, door[1] + .5);
  for (let z = -34; z < 34; z += 4) { box(.18, .02, 2, line, 30.1, -.02, z); if (Math.abs(z - DZ) > 8.5) box(.18, .02, 2, line, -42.5, -.02, z); }
  // zebra crossings at the front door road and the back park
  for (let i = 0; i < 6; i++) { box(.5, .02, 1.6, M.white, -2 + i * .9, -.02, R0 + 2.4 + RW / 2); box(1.6, .02, .5, M.white, 30.1, -.02, -2 + i * .9); }
  // outer pavements beyond the road
  box(90, .06, 3, pave, -6, -.03, -(R0 + 2.4 + RW + 1.5)); box(90, .06, 3, pave, -6, -.03, R0 + 2.4 + RW + 1.5); box(3, .06, 80, pave, 35.1, -.03, 0);
  // trees: round ones along the pavements, palms in the park
  const tree = (x, z, s = 1) => { const g = grp(st, x, z); g.scale.setScalar(s); add(g, cyl(.12, .17, 1.6, 8), trunk, 0, .8, 0, o); const c = rnd() < .5 ? leafA : leafB;
    add(g, new T.IcosahedronGeometry(1.0, 1), c, 0, 2.2, 0, o); add(g, new T.IcosahedronGeometry(.7, 1), c === leafA ? leafB : leafA, .45, 2.7, .2, o); add(g, new T.IcosahedronGeometry(.6, 1), c, -.4, 2.6, -.3, o);
    add(g, cyl(.55, .55, .05, 12), M.soil, 0, .0, 0, o); return g; };
  const palmT = (x, z, s = 1) => { const g = grp(st, x, z); g.scale.setScalar(s); const h = 3.4 + rnd() * .8; const lean = (rnd() - .5) * .25;
    for (let i = 0; i < 6; i++) add(g, cyl(.14 - i * .01, .16 - i * .01, h / 6 + .02, 7), trunk, lean * i * .25, h / 12 + i * h / 6, 0, o);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + rnd() * .3; const lf = add(g, new T.ConeGeometry(.22, 1.9, 4), palm, lean * 1.5 + Math.sin(a) * .8, h - .05, Math.cos(a) * .8, o); lf.rotation.set(Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15); lf.scale.set(1, 1, .25); }
    add(g, new T.SphereGeometry(.2, 8, 6), trunk, lean * 1.5, h, 0, o); return g; };
  const lamp = (x, z) => { const g = grp(st, x, z); add(g, cyl(.06, .08, 3.4, 8), M.black, 0, 1.7, 0, o); add(g, RB(.7, .1, .22, .03), M.black, .3, 3.4, 0, o); add(g, RB(.5, .04, .16, .02), M.lamp, .4, 3.34, 0, o); return g; };
  const benchAt = (x, z, ry) => { const g = grp(st, x, z, ry); add(g, RB(1.6, .08, .45, .02), bench, 0, .45, 0, o); add(g, RB(1.6, .4, .08, .02), bench, 0, .7, .2, o); [-.7, .7].forEach((dx) => add(g, RB(.08, .45, .45, .01), M.black, dx, .22, 0, o)); };
  for (let x = -20; x <= 20; x += 6) { tree(x, -21.6, .9); tree(x, 21.6, .9); }
  for (let z = -18; z <= 18; z += 6) tree(25.2, z, .9);
  for (let x = -44; x <= 30; x += 7) { tree(x, -(R0 + 2.4 + RW + 1.5), 1); tree(x + 3.5, R0 + 2.4 + RW + 1.5, 1); }
  for (let z = -30; z <= 30; z += 7) tree(35.2, z, 1);
  [[-14, -22.8], [6, -22.8], [-14, 22.8], [6, 22.8], [24.4, -12], [24.4, 12]].forEach(([x, z]) => lamp(x, z));
  // the park behind the building (south): lawn, paths, a round pond, palms and benches
  const pz = R0 + 2.4 + RW + 3, PW = 60, PD = 22;
  box(PW, .08, PD, grass2, -6, -.16, pz + PD / 2);
  box(PW - 4, .06, 2.2, path, -6, -.11, pz + PD / 2); box(2.2, .06, PD - 2, path, -6, -.11, pz + PD / 2); box(2.2, .06, PD - 2, path, -26, -.11, pz + PD / 2); box(2.2, .06, PD - 2, path, 14, -.11, pz + PD / 2);
  add(st, cyl(4.2, 4.2, .3, 28), kerb, -6, -.05, pz + PD / 2, o); add(st, cyl(3.8, 3.8, .06, 28), water, -6, .08, pz + PD / 2, o);
  [[-30, 4], [-22, 4], [-16, 16], [4, 16], [10, 4], [18, 18], [-32, 18], [22, 6]].forEach(([x, dz]) => palmT(x, pz + dz, 1));
  [[-12, 8.2, 0], [0, 8.2, 0], [-12, 13.8, Math.PI], [0, 13.8, Math.PI], [-26, 5, Math.PI / 2], [14, 17, -Math.PI / 2]].forEach(([x, dz, ry]) => benchAt(x, pz + dz, ry));
  // a small football pitch in the park
  { const fx = 24, fz = pz + 11; box(14, .05, 9, toon({ color: DARK ? 0x1C3A24 : 0x5E9E48 }), fx, -.1, fz);
    [[14, .12, .1, 0, -4.5], [14, .12, .1, 0, 4.5], [.1, .12, 9, -7, 0], [.1, .12, 9, 7, 0], [.1, .12, 9, 0, 0]].forEach(([w, h, d, dx, dz]) => box(w, .02, d, M.white, fx + dx, -.06, fz + dz));
    add(st, new T.TorusGeometry(1.2, .05, 4, 28), M.white, fx, -.06, fz, Object.assign({ rx: Math.PI / 2 }, o));
    [-7, 7].forEach((dx) => { const g = grp(st, fx + dx, fz); add(g, cyl(.05, .05, 1.2, 6), M.white, 0, .6, -1.5, o); add(g, cyl(.05, .05, 1.2, 6), M.white, 0, .6, 1.5, o); add(g, cyl(.05, .05, 3, 6), M.white, 0, 1.2, 0, Object.assign({ rx: Math.PI / 2 }, o)); }); }
  // second car park on the north side, across the road
  { const cz = -(R0 + 2.4 + RW + 3 + 8); box(40, .05, 14, asph, -14, -.12, cz);
    for (let i = 0; i < 9; i++) { box(.12, .02, 5, line, -32 + i * 4.5, -.09, cz - 3.5); box(.12, .02, 5, line, -32 + i * 4.5, -.09, cz + 3.5); }
    const cols = DARK ? [0x8A1626, 0x22202C, 0xB88A2A, 0x2E4A5A, 0x5A5A60] : [0xF2F4F8, 0x22305A, 0x8A2D3A, 0x9AA3AD, 0x2F5A48, 0xC9A24A];
    [0, 1, 3, 4, 6, 7].forEach((i, k) => car(st, -29.75 + i * 4.5, cz - 3.5, 0, cols[k % cols.length]));
    [1, 2, 5, 7].forEach((i, k) => car(st, -29.75 + i * 4.5, cz + 3.5, Math.PI, cols[(k + 2) % cols.length]));
    for (let x = -32; x <= 4; x += 6) tree(x, cz - 8.2, .9); }
  // bus stop on the east pavement
  { const g = grp(st, 35.2, 8); add(g, RB(.1, 2.4, 3, .02), M.glass, -.6, 1.2, 0, o); add(g, RB(1.4, .1, 3.2, .03), M.black, 0, 2.45, 0, o); [-1.5, 1.5].forEach((dz) => add(g, cyl(.05, .05, 2.4, 6), M.black, .6, 1.2, dz, o)); add(g, RB(.4, .08, 2.4, .02), bench, -.3, .45, 0, o); }
  // p159 (martin): the main entrance = a mini roundabout on the front road with the IBA fountain on a planted island,
  // a walkway from the door straight to it. Cars drive round it to the door.
  { const rx = -42.5, rz = DZ; add(st, cyl(7.2, 7.2, .04, 56), asph, rx, .0, rz, o); add(st, new T.TorusGeometry(5.6, .06, 4, 56), line, rx, .025, rz, Object.assign({ rx: Math.PI / 2 }, o));
    add(st, cyl(4.05, 4.15, .26, 48), kerb, rx, .13, rz, o); add(st, cyl(3.95, 3.95, .04, 48), grass2, rx, .27, rz, o);
    const fl = [0xE05A8A, 0xF3C45B, 0xFFFFFF, 0xB35AE0].map((c) => toon({ color: c })); for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; add(st, new T.SphereGeometry(.12, 8, 6), fl[i % 4], rx + Math.sin(a) * 3.72, .36, rz + Math.cos(a) * 3.72, o); }
    const isl = grp(st, 0, 0); isl.position.y = .27; fountain(isl, rx, rz, true); if (FOUNT) FOUNT.g.position.y = .27; if (IBA) IBA.position.y += .27;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => palmT(rx + sx * 5.9, rz + sz * 5.9, .8));
    box(4.6, .07, 2.4, pave, -37.4, -.0, rz); for (let i = 0; i < 4; i++) box(.35, .02, 1.6, M.white, -39.4 + i * -.01 + 0, .04, rz - .6 + i * .4, { ry: Math.PI / 2 }); }
  // low neighbour buildings in the distance (windows painted on)
  const facade = tex(128, 128, (c, w, h) => { c.fillStyle = DARK ? '#2A2228' : '#E4DCCF'; c.fillRect(0, 0, w, h); c.fillStyle = DARK ? '#F3C45B' : '#6E8FA8'; for (let y = 10; y < h; y += 32) for (let x = 10; x < w; x += 30) c.fillRect(x, y, 16, 18); }, [3, 2]);
  const fm = toon({ color: 0xFFFFFF, map: facade }), roofM = toon({ color: DARK ? 0x1A1416 : 0xB8AEA0 });
  [[-20, -66, 18, 6, 10], [8, -68, 14, 8, 10], [32, -64, 12, 5, 12], [54, -30, 12, 6, 16], [56, 2, 10, 8, 12], [54, 32, 12, 5, 14], [-62, 56, 14, 5, 10], [-22, 72, 20, 4, 10], [14, 72, 14, 7, 10], [44, 66, 12, 6, 12], [-66, -40, 10, 7, 14], [-66, -6, 10, 5, 12], [-66, 28, 10, 6, 14]]
    .forEach(([x, z, w, h, d]) => { add(st, new T.BoxGeometry(w, h, d), fm, x, h / 2 - .2, z, { cast: false }); add(st, new T.BoxGeometry(w + .3, .3, d + .3), roofM, x, h - .05, z, o); });
}
function buildOffice(state, edit) {
  seed = 7; ADS = []; OUTER = []; CLOCKS = []; SIGN = null; FOUNT = null; KIOSK = null; chairByTile = new Map();
  const st = new T.Group(), low = new T.Group();
  // ground + floors (wood / carpet / tiles, per room)
  // the building is an octagon: base slab, floors cut to the octagon, eight outside walls
  const oc = state.oct || 0, OCTP = [[oc, 0], [46 - oc, 0], [46, oc], [46, 40 - oc], [46 - oc, 40], [oc, 40], [0, 40 - oc], [0, oc]];
  { const sh = new T.Shape(); OCTP.forEach(([x, y], i) => { const [wx, wz] = W(x, y), px = wx * 1.012, pz = wz * 1.014; i ? sh.lineTo(px, -pz) : sh.moveTo(px, -pz); }); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: .4, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); add(st, geo, M.base, 0, -.42, 0, { cast: false }); }
  floorPoly(st, OCTP, M.tiles, 1.4, 0);
  state.rooms.forEach((r) => { if (r.id === 'plaza') return; if (r.mat && M[r.mat]) { floorPoly(st, clipOct([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], oc), M[r.mat], r.mat === 'wood' ? 2.4 : 1.4, .004); return; } /* p161: floor picked in Build mode */ const mat = r.kind === 'wood' ? M.wood : r.kind === 'carpet' ? (r.id === 'rec' ? M.carpet3 : LEAD.includes(r.id) || r.id === 'meet' ? M.carpet : M.carpet2) : M.tiles;
    floorPoly(st, clipOct([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], oc), mat, r.kind === 'wood' ? 2.4 : 1.4, .004); });
  // outside walls: windows along every side, the one door at the entrance (left wall, Reception)
  const H = 2.8, door = state.door || [0, 3];
  OCTP.forEach((p0, i) => { const p1 = OCTP[(i + 1) % 8]; const [x0, z0] = W(p0[0], p0[1]), [x1, z1] = W(p1[0], p1[1]); const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, nl = Math.hypot(mx, mz) || 1, n = { x: mx / nl, z: mz / nl }; if (Math.abs(n.x) > .9 || Math.abs(n.z) > .9) { n.x = Math.round(n.x); n.z = Math.round(n.z); } else { n.x = Math.sign(n.x) * Math.SQRT1_2; n.z = Math.sign(n.z) * Math.SQRT1_2; }
    const inSign = Math.sign(-Math.sin(ang) * -n.x + Math.cos(ang) * -n.z) || 1; const opens = []; let dA = -1, dB = -1;
    if (p0[0] === 0 && p1[0] === 0 && door[0] === 0) { const s0 = Math.abs(door[1] - .4 - p0[1]), s1 = Math.abs(door[1] + 1.4 - p0[1]); dA = Math.min(s0, s1); dB = Math.max(s0, s1); opens.push({ a: dA, b: dB, door: true }); }
    // windows: centred in each room along this side, so a room wall never cuts a window (diagonal sides: centred)
    const horiz = p0[1] === p1[1], vert = p0[0] === p1[0], spans = [];
    if (horiz || vert) { const lo = horiz ? Math.min(p0[0], p1[0]) : Math.min(p0[1], p1[1]), hi = horiz ? Math.max(p0[0], p1[0]) : Math.max(p0[1], p1[1]);
      state.rooms.forEach((r) => { if (r.id === 'plaza') return; const on = horiz ? (r.y === p0[1] || r.y + r.h === p0[1]) : (r.x === p0[0] || r.x + r.w === p0[0]); if (!on) return;
        const a0 = Math.max(lo, horiz ? r.x : r.y), b0 = Math.min(hi, horiz ? r.x + r.w : r.y + r.h); if (b0 - a0 < 2.2) return; const c0 = horiz ? p0[0] : p0[1]; spans.push([Math.abs(a0 - c0), Math.abs(b0 - c0)].sort((u, v) => u - v)); }); }
    else spans.push([0, L]);
    spans.forEach(([sa, sb]) => { const span = sb - sa, n = span > 9 ? 2 : 1, w = Math.min(2.2, span / n - 1.4); if (w < .8) return;
      for (let k = 0; k < n; k++) { const m = sa + span * (k + .5) / n, a = m - w / 2, b = m + w / 2; if (a < .5 || b > L - .5) continue; if (dA >= 0 && b > dA - .6 && a < dB + .6) continue; opens.push({ a, b }); } });
    wallRun(low, x0, z0, x1, z1, H, opens, n, inSign); });
  // walls between rooms: solid (cut low so you can see in); glass only where the plan says (the lead's room)
  (state.walls || []).forEach(([x1, y1, x2, y2, g, doors]) => (g === 2 ? glassRun(st, x1, y1, x2, y2, doors) : solidRun(st, x1, y1, x2, y2, doors)));
  try { roomPlates(st, state); } catch (e) { console.warn('Office 3D: plates', e); }
  // furniture + chairs (every seat has its chair; desks face the chair that uses them)
  let ed = null; // p161: in Build mode every piece is its own group, so it can be picked and moved
  if (edit) { ed = new T.Group(); state.furniture.forEach((o) => editPiece(ed, state, o)); state.chairs.forEach((c) => { chairByTile.set(c.x + ',' + c.y, c); editPiece(ed, state, c, true); }); }
  else {
  state.furniture.forEach((o) => { try { furniture(st, state, o); } catch (e) { console.warn('Office 3D: furniture', o.t, e); } });
  state.chairs.forEach((c) => { chairByTile.set(c.x + ',' + c.y, c); chair(st, c); }); }
  // Reception: one long front desk between the receptionists and the entrance, facing the door
  const recR = state.rooms.find((r) => r.id === 'rec'); if (recR) { const rs = state.chairs.filter((c) => c.x >= recR.x && c.x < recR.x + recR.w && c.y >= recR.y && c.y < recR.y + recR.h && c.dir === 'W' && !c.noDesk);
    if (rs.length) { const y0 = Math.min(...rs.map((c) => c.y)), y1 = Math.max(...rs.map((c) => c.y)); const [rx, rz] = W(rs[0].x - .6, (y0 + y1) / 2 + .5); const sc = Math.min(1, (y1 - y0 + 1.6) / 3); receptionDesk(st, rx, rz, Math.PI / 2, sc, rs.map((c) => -(W(c.x + .5, c.y + .5)[1] - rz) / sc)); } }
  outside(st, state.door || [0, 3]);
  try { surroundings(st, state.door || [0, 3]); } catch (e) { console.warn('Office 3D: surroundings', e); }
  // wall clocks over the back wall of the leaders' rooms
  state.rooms.filter((r) => r.y === 0 && LEAD.includes(r.id) && r.x >= (state.oct || 0) && r.x + r.w <= 46 - (state.oct || 0)).forEach((r) => { const [x, z] = W(r.x + r.w / 2 + 1.2, 0); wallClock(st, x, 2.15, z + .16, 0); CLOCKS.push(hands(x, 2.15, z + .16, 0)); });
  // IBA in the middle of the plaza (its footprint is blocked in the plan)
  let sign = SIGN; if (!sign) { const ib = W(23.5, 19.5); sign = ibaSign(st, ib[0], ib[1], .62); }
  const statics = mergeStatic(st);
  const lowM = new T.Group(); low.children.slice().forEach((g) => lowM.add(g)); // exterior walls stay separate groups (they lower)
  return { statics, low: lowM, sign, clocks: CLOCKS, fount: FOUNT, kiosk: KIOSK, edit: ed };
}

// ================= anime-style 3D people (hair, uniform and style are all options) =================
const SKIN = ['#FBE0C8', '#F1C9A5', '#DDA57C', '#B97D57', '#8D5A3B', '#6A4029'];
const HAIRC = { black: '#1E1A22', dark: '#3A2A22', brown: '#6B4428', chestnut: '#8A4B2A', blonde: '#E2B867', grey: '#B9BCC4', navy: '#24305E', plum: '#5A2D63', teal: '#1F7A80', pink: '#E27BA8' };
const HEAD_PTS = (() => { const pts = []; const N = 30; for (let i = 0; i <= N; i++) { const y = -.205 + (.43 * i) / N; let r;
  if (y < -.12) { const k = (y + .205) / .085; r = .07 + Math.sin(k * Math.PI / 2) * .06; }          // chin -> jaw
  else if (y < .02) { const k = (y + .12) / .14; r = .13 + Math.sin(k * Math.PI / 2) * .068; } // cheeks
  else { const k = (y - .02) / .205; r = .198 * Math.sqrt(Math.max(0, 1 - k * k)); }         // skull
  pts.push(new T.Vector2(Math.max(.001, r), y)); } return pts; })();
const FACE_CACHE = {};
function faceTex(o) {
  const key = [o.g, o.eyes, o.brow, o.mood, o.hairC].join('|'); if (FACE_CACHE[key]) return FACE_CACHE[key];
  const t = tex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); const hc = HAIRC[o.hairC] || o.hairC || '#1E1A22'; const fem = o.g === 'f';
    const eye = (cx, side) => { const cy = 286, ew = fem ? 66 : 60, eh = fem ? 74 : 62;
      // white
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(cx, cy + 4, ew * .55, eh * .5, 0, 0, Math.PI * 2); g.fill();
      // iris
      const gr = g.createLinearGradient(0, cy - eh * .45, 0, cy + eh * .45); gr.addColorStop(0, '#120E18'); gr.addColorStop(.45, o.eyes); gr.addColorStop(1, lighten(o.eyes, .55));
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx + side * 3, cy + 6, ew * .36, eh * .46, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0D0A12'; g.beginPath(); g.ellipse(cx + side * 3, cy + 4, ew * .15, eh * .2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(cx - 9 + side * 3, cy - 12, 10, 12, -.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + 11 + side * 3, cy + 20, 5, 0, Math.PI * 2); g.fill();
      // upper lash line (thick, with a flick on the outer side)
      g.strokeStyle = '#17121C'; g.lineCap = 'round'; g.lineWidth = fem ? 11 : 8; g.beginPath(); g.ellipse(cx, cy + 4, ew * .58, eh * .52, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      if (fem) { g.lineWidth = 7; g.beginPath(); const ox = cx + side * ew * .56, oy = cy - eh * .12; g.moveTo(ox - side * 6, oy - 2); g.lineTo(ox + side * 12, oy - 14); g.stroke(); }
      g.lineWidth = 3; g.strokeStyle = 'rgba(23,18,28,.55)'; g.beginPath(); g.ellipse(cx, cy + 6, ew * .5, eh * .5, 0, Math.PI * .25, Math.PI * .75); g.stroke();
      // brow
      g.strokeStyle = hc; g.lineWidth = o.brow === 'thick' ? 12 : 7; g.beginPath(); const by = 216 - (o.mood === 'happy' ? 4 : 0); g.moveTo(cx - side * 30, by + 6); g.quadraticCurveTo(cx, by - 8, cx + side * 34, by + (fem ? 2 : -2)); g.stroke(); };
    eye(256 - 92, -1); eye(256 + 92, 1);
    // nose + mouth + blush
    g.strokeStyle = 'rgba(120,60,50,.55)'; g.lineWidth = 4; g.beginPath(); g.moveTo(252, 352); g.lineTo(258, 360); g.stroke();
    g.strokeStyle = '#7A3A34'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath();
    if (o.mood === 'happy') { g.fillStyle = '#8A3A3A'; g.moveTo(232, 402); g.quadraticCurveTo(256, 432, 280, 402); g.closePath(); g.fill(); g.fillStyle = '#E8888A'; g.beginPath(); g.ellipse(256, 416, 9, 5, 0, 0, Math.PI * 2); g.fill(); }
    else if (o.mood === 'calm') { g.moveTo(240, 406); g.quadraticCurveTo(256, 414, 272, 406); g.stroke(); }
    else { g.moveTo(236, 402); g.quadraticCurveTo(256, 420, 276, 402); g.stroke(); }
    g.fillStyle = 'rgba(240,120,120,.28)'; [148, 364].forEach((x) => { g.beginPath(); g.ellipse(x, 352, 34, 16, 0, 0, Math.PI * 2); g.fill(); });
  });
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; FACE_CACHE[key] = t; return t;
}
function lighten(hex, k) { const c = new T.Color(hex); c.lerp(new T.Color('#FFFFFF'), k); return '#' + c.getHexString(); }
const grad2 = (() => { const d = new Uint8Array([175, 175, 175, 255, 255, 255, 255, 255]); const t = new T.DataTexture(d, 2, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
const mt = (c) => new T.MeshToonMaterial({ color: new T.Color(c), gradientMap: grad2 });
// 18.0.0 patch 159 (martin: faces looked like bricks): skin + face get a soft, smooth light ramp instead of hard 2-3 tone bands
const gradSoft = (() => { const d = new Uint8Array([200, 200, 200, 255, 232, 232, 232, 255, 255, 255, 255, 255]); const t = new T.DataTexture(d, 3, 1); t.minFilter = t.magFilter = T.LinearFilter; t.needsUpdate = true; return t; })();
const mtSoft = (c) => new T.MeshToonMaterial({ color: new T.Color(c), gradientMap: gradSoft });
// beard / moustache painted on a thin shell over the lower face (soft edges, a gap for the mouth)
const BEARD_CACHE = {};
function beardTex(o) {
  const key = [o.beard || '', o.mustache ? 1 : 0, o.hairC].join('|'); if (BEARD_CACHE[key]) return BEARD_CACHE[key];
  const hc = HAIRC[o.hairC] || o.hairC || '#1E1A22';
  const t = tex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = hc; g.strokeStyle = hc; g.shadowColor = hc; g.shadowBlur = 6;
    // canvas top = nose level, bottom = chin; the middle column is the front of the face
    const X = (u) => u * w, Y = (v) => (1 - v) * h; const mx = .5, mv = .44; // mouth
    if (o.beard) { const full = o.beard === 'full', side = full ? .9 : .78, cheek = full ? .5 : .4, chin = 0;
      g.beginPath(); g.moveTo(X(.1), Y(side)); g.lineTo(X(.14), Y(side));
      g.bezierCurveTo(X(.16), Y(cheek + .05), X(.3), Y(cheek - .02), X(.38), Y(mv + .13));        // cheek line down to the moustache
      g.lineTo(X(.62), Y(mv + .13));
      g.bezierCurveTo(X(.7), Y(cheek - .02), X(.84), Y(cheek + .05), X(.86), Y(side)); g.lineTo(X(.9), Y(side));
      g.bezierCurveTo(X(.95), Y(.4), X(.85), Y(chin), X(.5), Y(chin)); g.bezierCurveTo(X(.15), Y(chin), X(.05), Y(.4), X(.1), Y(side)); g.closePath(); g.fill();
      // the mouth stays open
      g.save(); g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 4; g.beginPath(); g.ellipse(X(mx), Y(mv - .01), w * .06, h * .035, 0, 0, Math.PI * 2); g.fill(); g.restore();
      if (!full) { g.save(); g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 10; g.beginPath(); g.ellipse(X(mx), Y(.6), w * .16, h * .14, 0, 0, Math.PI * 2); g.fill(); g.restore(); } }
    if (o.mustache || o.beard === 'full') { g.beginPath(); g.moveTo(X(mx), Y(mv + .1)); g.bezierCurveTo(X(.43), Y(mv + .16), X(.37), Y(mv + .12), X(.35), Y(mv + .04)); g.bezierCurveTo(X(.4), Y(mv + .07), X(.45), Y(mv + .06), X(mx), Y(mv + .07));
      g.bezierCurveTo(X(.55), Y(mv + .06), X(.6), Y(mv + .07), X(.65), Y(mv + .04)); g.bezierCurveTo(X(.63), Y(mv + .12), X(.57), Y(mv + .16), X(mx), Y(mv + .1)); g.fill(); }
  });
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; BEARD_CACHE[key] = t; return t;
}
function sph(p, r, mat, x, y, z, sc, o = {}) { return add(p, new T.SphereGeometry(r, 20, 14), mat, x, y, z, Object.assign({ sc }, o)); }
function capsule(p, r, len, mat, x, y, z, o) { return add(p, new T.CapsuleGeometry(r, len, 6, 14), mat, x, y, z, o); }
function shell(p, r, mat, phiStart, phiLen, th0, thLen, sc, y = 0, z = 0, o = {}) { return add(p, new T.SphereGeometry(r, 28, 18, phiStart, phiLen, th0, thLen), Object.assign(mat.clone ? mat : mat, {}), 0, y, z, Object.assign({ sc }, o)); }
const FRONT = Math.PI * 1.5; // sphere phi that faces -z (the face side)
function hairDo(head, o, hm) {
  const style = o.hair; const hl = mt(lighten(HAIRC[o.hairC] || o.hairC, .28));
  const cap = (low = .6, tilt = .42) => add(head, new T.SphereGeometry(.214, 30, 18, 0, Math.PI * 2, 0, Math.PI * low), hm, 0, .005, .012, { sc: [1.05, 1.1, 1.07], rx: tilt, side: true });
  const ring = () => null;
  const bangs = (n, len, spread, tilt = 0, y0 = .14) => { for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1) - .5; const a = k * spread + tilt * .25; const L = len * (1 - Math.abs(k) * .35) * (i % 2 ? .82 : 1); const c = add(head, new T.SphereGeometry(.06, 14, 12), hm, Math.sin(a) * .2, y0 + .03 - L * .5, -Math.cos(a) * .2 + .004, { sc: [1, L * 8.3, .4] }); c.rotation.order = 'YXZ'; c.rotation.set(Math.PI - .32, -a, -k * .45 + tilt * .35); } };
  const sideLocks = (len, w = .06) => [-1, 1].forEach((s) => add(head, new T.SphereGeometry(w, 12, 10), hm, s * .185, .06 - len * .45, -.07, { sc: [.55, len * 9, .5], rz: s * .1 }));
  if (style === 'bald') return;
  // 18.0.0 patch 159 (martin): new male hair. One clean base that hugs the skull (front hairline above the brows,
  // down to the ears and the nape), then rounded locks per style. No sharp cones, no gaps on top.
  const base = (th = .53, sc = 1.07, tilt = .6) => add(head, new T.SphereGeometry(.205, 40, 24, 0, Math.PI * 2, 0, Math.PI * th), hm, 0, .03, .012, { sc: [sc, sc * 1.03, sc * 1.03], rx: tilt, side: true });
  const lock = (x, y, z, len, w, rx, rz, ry = 0) => { const m = add(head, new T.SphereGeometry(w, 16, 12), hm, x, y, z, { sc: [1, len / w, .55] }); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, rz); return m; };
  if (style === 'buzz') { base(.53, 1.025, .6); return; }
  if (style === 'side') { base(.53, 1.07, .6);
    add(head, new T.SphereGeometry(.15, 24, 16), hm, -.035, .19, -.03, { sc: [1.25, .55, 1.15], rz: .12 });            // volume on top, swept to one side
    for (let i = 0; i < 5; i++) { const k = i / 4; lock(-.13 + k * .22, .16 - k * .03, -.17 + Math.abs(k - .4) * .03, .07 - k * .015, .048, -.5, -.9 + k * .15); } // fringe swept across
    [-1, 1].forEach((sd) => lock(sd * .19, .05, -.06, .07, .04, 0, sd * .15)); return; }                                   // tidy sideburns
  if (style === 'slick') { base(.52, 1.05, .66);
    add(head, new T.SphereGeometry(.16, 24, 16), hm, 0, .17, .05, { sc: [1.08, .38, 1.25], rx: -.1 });
    for (let i = 0; i < 3; i++) lock(-.07 + i * .07, .19, -.11, .06, .04, -1.3, 0); [-1, 1].forEach((sd) => lock(sd * .19, .05, -.05, .06, .035, 0, sd * .1)); return; }
  if (style === 'curly') { base(.53, 1.05, .6);
    for (let i = 0; i < 34; i++) { const t = (i + .5) / 34, th = Math.acos(1 - t * .95), ph = i * 2.39996; const r = .215;
      const x = Math.sin(th) * Math.sin(ph) * r * 1.04, y = .03 + Math.cos(th) * r * 1.06, z = .012 + Math.sin(th) * Math.cos(ph) * r * 1.04;
      if (z < -.12 && y < .14) continue; add(head, new T.SphereGeometry(.052, 12, 10), hm, x, y, z); } return; }
  if (style === 'spiky') { base(.53, 1.07, .6);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const c = add(head, new T.ConeGeometry(.06, .16, 14), hm, Math.sin(a) * .11, .2 + Math.cos(a) * .015, Math.cos(a) * .1 + .03, { rx: Math.cos(a) * .9 + .25, rz: -Math.sin(a) * .9 });
      add(head, new T.SphereGeometry(.022, 10, 8), hm, Math.sin(a) * .16, .26, Math.cos(a) * .15 + .04); }
    for (let i = 0; i < 5; i++) { const k = i / 4 - .5; lock(k * .26, .15, -.17, .065, .048, -.5, k * .8); } return; }
  if (style === 'ghutra') { const cloth = mt('#F6F6F2'), agal = mt('#151318');
    add(head, new T.SphereGeometry(.23, 30, 18, 0, Math.PI * 2, 0, Math.PI * .56), cloth, 0, .01, .015, { sc: [1.05, 1.1, 1.06], rx: .5, side: true });
    add(head, new T.SphereGeometry(.245, 30, 18, FRONT + .95, Math.PI * 2 - 1.9, Math.PI * .4, Math.PI * .5), cloth, 0, -.02, .01, { sc: [1.02, 1.6, 1.04], side: true });
    [-1, 1].forEach((s) => add(head, RB(.1, .42, .05, .03), cloth, s * .2, -.24, .03, { rz: s * .08 })); add(head, RB(.34, .4, .05, .03), cloth, 0, -.24, .2);
    add(head, new T.TorusGeometry(.2, .02, 8, 30), agal, 0, .15, .04, { rx: Math.PI / 2 + .3 }); add(head, new T.TorusGeometry(.2, .02, 8, 30), agal, 0, .18, .045, { rx: Math.PI / 2 + .3, noOutline: true }); return; }
  if (style === 'hijab') { const cloth = mt(o.hijab || '#5A4E7A');
    add(head, new T.SphereGeometry(.238, 30, 20, FRONT + .78, Math.PI * 2 - 1.56, 0, Math.PI * .86), cloth, 0, -.01, .005, { sc: [1.04, 1.1, 1.06], side: true });
    add(head, new T.SphereGeometry(.236, 30, 12, 0, Math.PI * 2, 0, Math.PI * .3), cloth, 0, -.005, .005, { sc: [1.04, 1.1, 1.06] });
    add(head, new T.TorusGeometry(.17, .03, 8, 26, Math.PI * 1.05), cloth, 0, .0, -.05, { ry: 0, rz: Math.PI * 1.98, sc: [1.1, 1.3, 1] });
    add(head, cyl(.2, .32, .26, 24), cloth, 0, -.3, .02); return; }
  cap(style === 'bob' || style === 'long' ? .62 : .6, style === 'slick' ? .55 : .42);
  if (style === 'spiky') { bangs(5, .17, 1.4, 0); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(head, new T.ConeGeometry(.055, .14, 8), hm, Math.sin(a) * .12, .19 + Math.cos(a) * .02, Math.cos(a) * .11 + .05, { rx: Math.cos(a) * .8 + .35, rz: -Math.sin(a) * .8 }); } ring(); }
  else if (style === 'side') { add(head, new T.SphereGeometry(.12, 16, 12), hm, -.05, .17, -.12, { sc: [1.5, .55, .75], rz: -.3 }); bangs(4, .15, .9, -1, .14); sideLocks(.1, .04); ring(); add(head, new T.SphereGeometry(.12, 14, 10), hm, .05, .2, .03, { sc: [1.4, .7, 1.4] }); }
  else if (style === 'slick') { add(head, new T.SphereGeometry(.15, 16, 12), hm, 0, .19, .02, { sc: [1.3, .7, 1.45] }); add(head, new T.SphereGeometry(.1, 14, 10), hm, 0, .2, -.1, { sc: [1.7, .6, .7], rx: -.3 }); ring(); }
  else if (style === 'curly') { for (let i = 0; i < 22; i++) { const a = i * 2.39996, yy = .06 + (i % 5) * .04; const r = .2 * Math.sqrt(Math.max(.1, 1 - Math.pow((yy - .06) / .22, 2))); add(head, new T.SphereGeometry(.065, 10, 8), hm, Math.sin(a) * r, yy + .05, Math.cos(a) * r * .95 + .02); } bangs(4, .08, 1.1, 0, .16); }
  else if (style === 'bob' || style === 'long' || style === 'pony' || style === 'bun') {
    bangs(style === 'bob' ? 7 : 6, .16, 1.6, 0, .15);
    if (style === 'bob' || style === 'long') { add(head, new T.SphereGeometry(.232, 30, 20, FRONT + .62, Math.PI * 2 - 1.24, Math.PI * .1, Math.PI * (style === 'bob' ? .62 : .66)), hm, 0, -.01, .015, { sc: [1.07, style === 'bob' ? 1.12 : 1.4, 1.08], side: true }); sideLocks(style === 'bob' ? .2 : .42, .06); }
    if (style === 'long') { add(head, RB(.36, .5, .09, .045, 4), hm, 0, -.38, .16, { rx: .08 }); }
    if (style === 'pony') { add(head, new T.SphereGeometry(.05, 10, 8), mt(o.tieC || '#E05A8A'), 0, .06, .23); const tail = add(head, new T.ConeGeometry(.08, .5, 10), hm, 0, -.2, .28, { rx: Math.PI - .25 }); sideLocks(.16, .045); }
    if (style === 'bun') { add(head, new T.SphereGeometry(.11, 16, 12), hm, 0, .2, .14); add(head, new T.TorusGeometry(.08, .015, 6, 18), mt(o.tieC || '#F3C45B'), 0, .16, .1, { rx: 1.1, noOutline: true }); sideLocks(.14, .04); }
    ring();
  }
}
function person(p, o) {
  const g = new T.Group(); p.add(g); const fem = o.g === 'f';
  const skin = mtSoft(typeof o.skin === 'string' ? o.skin : SKIN[o.skin ?? 1]); const hm = mt(HAIRC[o.hairC] || o.hairC || '#1E1A22');
  const U = OUTFITS[o.outfit] || OUTFITS.shirt; const top = mt(o.top || U.top), bottom = mt(o.bottom || U.bottom), shoe = mt(U.shoe || '#1A1720');
  const sleeve = mt(o.sleeve || U.sleeve || o.top || U.top);
  const hips = new T.Group(); hips.position.y = .82; g.add(hips);
  const torso = new T.Group(); hips.add(torso);
  // body: waist -> chest, slimmer for women
  add(torso, new T.CapsuleGeometry(fem ? .12 : .132, .24, 8, 18), top, 0, .28, 0, { sc: [fem ? 1.15 : 1.28, 1, .78] });
  add(torso, new T.CapsuleGeometry(fem ? .115 : .12, .06, 8, 18), bottom, 0, .04, 0, { sc: [fem ? 1.25 : 1.15, 1, .8] });
  add(torso, cyl(.045, .05, .14, 12), skin, 0, .53, 0, { noOutline: true });
  if (U.extra) U.extra(torso, o, { top, bottom, skin, fem });
  // head
  const head = new T.Group(); head.position.y = .76; torso.add(head);
  add(head, new T.LatheGeometry(HEAD_PTS, 64), skin, 0, 0, 0, { sc: [1, 1, .94] });
  const face = add(head, new T.LatheGeometry(HEAD_PTS, 40, Math.PI - 1.0, 2.0), new T.MeshToonMaterial({ map: faceTex(o), transparent: true, alphaTest: .35, gradientMap: gradSoft, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, 0, { sc: [1.004, 1, .944], noOutline: true, cast: false });
  [-1, 1].forEach((s) => sph(head, .035, skin, s * .19, -.01, .01, [.6, 1, 1]));
  if (o.glasses) { const gm = mt(o.glassesC || '#1A1620'); [-1, 1].forEach((s) => add(head, new T.TorusGeometry(.052, .008, 6, 20), gm, s * .072, -.012, -.192, { sc: [1.15, .85, 1], noOutline: true })); add(head, RB(.04, .01, .01, .004), gm, 0, -.0, -.198, { noOutline: true }); }
  if (o.beard || o.mustache) { const low = HEAD_PTS.filter((v) => v.y <= .0); const bt = beardTex(o);
    add(head, new T.LatheGeometry(low, 48, Math.PI - 1.3, 2.6), new T.MeshToonMaterial({ map: bt, transparent: true, alphaTest: .4, gradientMap: grad2, polygonOffset: true, polygonOffsetFactor: -4 }), 0, 0, 0, { sc: [1.03, 1, .975], noOutline: true, cast: false }); }
  hairDo(head, o, hm);
  if (o.hat === 'helmet') { const hc = mt(o.hatC || '#F6C21C'); add(head, new T.SphereGeometry(.24, 26, 14, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, .05, .0, { sc: [1.04, 1.02, 1.1] }); add(head, cyl(.27, .27, .025, 26), hc, 0, .055, -.03, { sc: [1, 1, 1.1] }); add(head, RB(.05, .04, .44, .02), hc, 0, .3, 0, { noOutline: true }); }
  // arms: shoulder -> elbow -> hand
  const arm = (s) => { const sh = new T.Group(); sh.position.set(s * (fem ? .17 : .195), .44, 0); torso.add(sh); sph(sh, .058, sleeve, 0, 0, 0, [1, 1, 1]); capsule(sh, .048, .17, sleeve, 0, -.12, 0); const el = new T.Group(); el.position.y = -.25; sh.add(el); capsule(el, .042, .16, U.shortSleeve ? skin : sleeve, 0, -.1, 0); sph(el, .046, skin, 0, -.22, -.005, [1, 1.15, .75]); sh.userData.el = el; return sh; };
  const armL = arm(-1), armR = arm(1);
  if (o.tablet) add(armL.userData.el, RB(.2, .27, .02, .02), mt('#2A2E3A'), .04, -.22, -.08, { rx: -.3 });
  // legs: hip -> knee -> shoe
  const leg = (s) => { const hp = new T.Group(); hp.position.set(s * (fem ? .065 : .072), -.02, 0); hips.add(hp); capsule(hp, fem ? .06 : .066, .26, bottom, 0, -.18, 0); const kn = new T.Group(); kn.position.y = -.38; hp.add(kn); capsule(kn, fem ? .048 : .054, .26, U.skirt || U.robe ? (U.robe ? bottom : mt(o.legs || '#2A2430')) : bottom, 0, -.17, 0); add(kn, RB(.1, .07, .22, .035), shoe, 0, -.385, -.04); hp.userData.kn = kn; return hp; };
  const legL = leg(-1), legR = leg(1);
  let skirt = null; if (U.skirt || U.robe) { skirt = add(hips, cyl(U.robe ? .15 : .14, U.robe ? .21 : .19, U.robe ? .74 : .4, 24), bottom, 0, U.robe ? -.37 : -.19, 0, { sc: [1.1, 1, .85] }); }
  addOutlines(g, OUTP);
  g.userData = { rig: { hips, torso, head, armL, armR, legL, legR, mouth: new T.Object3D(), eyes: [], skirt }, pose: newPose(), look: o, kind: 'person' };
  return g;
}
// uniforms: colours can be changed per person
const OUTFITS = {
  suit: { top: '#1F2A4A', bottom: '#1F2A4A', extra: (t, o) => { add(t, RB(.08, .2, .02, .01), mt('#F4F6FA'), 0, .42, -.098, { noOutline: true }); add(t, RB(.035, .22, .02, .01), mt(o.tie || '#2FB8D0'), 0, .38, -.106, { noOutline: true }); [-1, 1].forEach((s) => add(t, RB(.045, .18, .015, .008), mt(lighten(o.top || '#1F2A4A', .18)), s * .055, .42, -.1, { rz: s * .32, noOutline: true })); } },
  shirt: { top: '#DCE6F5', bottom: '#2A2E3A', extra: (t, o) => { if (o.tie) add(t, RB(.045, .24, .02, .01), mt(o.tie), 0, .36, -.106, { noOutline: true }); [-1, 1].forEach((s) => add(t, RB(.06, .035, .03, .01), mt(lighten(o.top || '#DCE6F5', .3)), s * .04, .5, -.08, { rz: s * .5, noOutline: true })); lanyard(t); } },
  vest: { top: '#2C3D6B', sleeve: '#F2F2F2', bottom: '#33323A', extra: (t, o) => { add(t, RB(.08, .14, .02, .01), mt('#F2F2F2'), 0, .44, -.1, { noOutline: true }); add(t, RB(.04, .16, .02, .01), mt(o.tie || '#8A2D3A'), 0, .4, -.108, { noOutline: true }); lanyard(t); } },
  polo: { top: '#2A8F8A', bottom: '#C9B79A', shortSleeve: true, shoe: '#5A3A22', extra: (t, o) => { add(t, new T.TorusGeometry(.07, .02, 6, 18, Math.PI), mt(lighten(o.top || '#2A8F8A', .25)), 0, .5, -.05, { rx: -1.3, rz: Math.PI, noOutline: true }); logo(t, .1, .4); } },
  blouse: { top: '#F4E7EF', bottom: '#2C2A3E', skirt: true, extra: (t, o) => { add(t, new T.TorusGeometry(.06, .025, 6, 18), mt('#FFFFFF'), 0, .5, -.05, { rx: -1.2, noOutline: true }); if (o.cardigan) [-1, 1].forEach((s) => add(t, RB(.09, .36, .02, .01), mt(o.cardigan), s * .1, .3, -.12, { noOutline: true })); lanyard(t); } },
  site: { top: '#22305A', bottom: '#22305A', shoe: '#5A3A22', extra: (t, o) => { const v = mt(o.vest || '#D8F020'), s = mt('#D0D4DA'); add(t, new T.CapsuleGeometry(.142, .18, 8, 18), v, 0, .3, 0, { sc: [1.3, 1, .82] }); [.2, .33].forEach((y) => add(t, cyl(.187, .187, .025, 24, true), s, 0, y, 0, { sc: [1.0, 1, .83], noOutline: true })); } },
  thobe: { top: '#F7F7F4', bottom: '#F7F7F4', robe: true, shoe: '#6A4A2A', extra: (t) => { add(t, RB(.02, .18, .02, .01), mt('#E2E2DC'), 0, .4, -.104, { noOutline: true }); } },
  abaya: { top: '#1C1A24', bottom: '#1C1A24', robe: true, extra: (t, o) => { add(t, RB(.03, .5, .02, .01), mt(o.trim || '#C9A24A'), 0, .2, -.104, { noOutline: true }); } },
  hoodie: { top: '#3A3046', bottom: '#2B3448', extra: (t, o) => { add(t, new T.TorusGeometry(.11, .045, 8, 20), mt(o.top || '#3A3046'), 0, .5, .04, { rx: -1.3 }); logo(t, 0, .3); } },
};
function lanyard(t) { add(t, RB(.07, .09, .012, .008), mt('#FFFFFF'), .03, .22, -.106, { noOutline: true }); add(t, RB(.05, .02, .014, .004), mt('#2FB8D0'), .03, .25, -.11, { noOutline: true }); add(t, RB(.012, .24, .01, .004), mt('#2FB8D0'), -.025, .36, -.104, { rz: .25, noOutline: true }); }
function logo(t, x, y) { const lt = tex(64, 32, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.font = '800 22px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('IBA', w / 2, h / 2 + 1); }); add(t, new T.PlaneGeometry(.09, .045), new T.MeshBasicMaterial({ map: lt, transparent: true }), x, y, -.106, { ry: Math.PI, noOutline: true, cast: false }); }

function bot(p, o) {
  const g = new T.Group(); p.add(g); const c = o.color;
  const white = toon({ color: 0xF2F4F8 }), dark = toon({ color: 0x1B1F33 }), acc = glowM(c, 1.3), accM = toon({ color: c });
  const hips = new T.Group(); hips.position.y = .32; g.add(hips); const torso = new T.Group(); hips.add(torso);
  add(torso, RB(.42, .36, .3, .12, 4), white, 0, .2, 0); add(torso, RB(.14, .05, .02, .01), acc, 0, .25, -.155, { noOutline: true }); add(torso, RB(.14, .05, .02, .01), acc, 0, .17, -.155, { noOutline: true });
  if (o.skirt) add(torso, cyl(.25, .31, .14, 18), accM, 0, .03, 0); if (o.tie) add(torso, RB(.06, .18, .02, .01), accM, 0, .27, -.16, { noOutline: true });
  const head = new T.Group(); head.position.y = .68; torso.add(head);
  add(head, RB(.66, .54, .54, .22, 5), white, 0, 0, 0); add(head, RB(.54, .38, .1, .15, 4), dark, 0, -.01, -.24, { noOutline: true });
  const eyes = [-.11, .11].map((dx) => add(head, new T.TorusGeometry(.05, .016, 6, 14, Math.PI), acc, dx, .03, -.295, { noOutline: true }));
  const mouth = add(head, new T.TorusGeometry(.065, .014, 6, 14, Math.PI), acc, 0, -.08, -.295, { rz: Math.PI, noOutline: true });
  if (o.glasses) [-.11, .11].forEach((dx) => add(head, RB(.15, .1, .012, .03), toon({ color: c, transparent: true, opacity: .45 }), dx, .03, -.3, { noOutline: true }));
  [-1, 1].forEach((s) => { add(head, cyl(.09, .09, .06, 16), dark, s * .34, 0, 0, { rz: Math.PI / 2 }); add(head, cyl(.065, .065, .065, 16, true), acc, s * .35, 0, 0, { rz: Math.PI / 2, noOutline: true }); });
  add(head, cyl(.013, .013, .14, 6), dark, 0, .33, 0, { noOutline: true }); add(head, new T.SphereGeometry(.05, 10, 8), acc, 0, .42, 0, { noOutline: true });
  if (o.bow) [-.22, -.08].forEach((dx) => add(head, new T.SphereGeometry(.085, 10, 8), accM, dx, .27, 0, { sc: [1, .7, .5] }));
  if (o.heart) add(head, new T.SphereGeometry(.075, 10, 8), accM, .2, .3, 0, { sc: [1, .9, .5] });
  const limb = (x, y, len, m) => { const s = new T.Group(); s.position.set(x, y, 0); torso.add(s); add(s, new T.CapsuleGeometry(.06, len, 4, 8), m, 0, -len / 2 - .03, 0); const el = new T.Group(); el.position.y = -len; s.add(el); add(el, new T.SphereGeometry(.07, 10, 8), white, 0, -.05, 0); s.userData.el = el; return s; };
  const armL = limb(-.27, .33, .14, white), armR = limb(.27, .33, .14, white);
  const leg = (x) => { const hp = new T.Group(); hp.position.set(x, .03, 0); hips.add(hp); add(hp, RB(.13, .22, .15, .05), dark, 0, -.11, 0); const kn = new T.Group(); kn.position.y = -.2; hp.add(kn); add(kn, RB(.15, .08, .22, .03), white, 0, -.06, -.02); hp.userData.kn = kn; return hp; };
  const legL = leg(-.1), legR = leg(.1);
  const paper = add(armR.userData.el, RB(.24, .02, .3, .005), toon({ color: 0xF7F5F0 }), 0, -.1, -.15, { noOutline: true }); paper.visible = false;
  addOutlines(g, OUTC);
  g.userData = { rig: { hips, torso, head, armL, armR, legL, legR, mouth, eyes, paper }, pose: newPose(), kind: 'bot', name: o.name };
  return g;
}

// ================= poses: every action blends smoothly into the next =================
function newPose() { return { hipY: .5, lean: 0, legL: 0, legR: 0, knL: 0, knR: 0, armL: 0, armR: 0, armLz: .08, armRz: -.08, elL: 0, elR: 0, headY: 0, headX: 0, bob: 0 }; }
function targetPose(a, t, ph) {
  const p = newPose(); const bot = a.userData.kind === 'bot'; const st = a.userData.act; p.hipY = bot ? .32 : .82;
  const sitY = a.userData.seatY ?? .44;
  if (st === 'walk') { const s = Math.sin(ph); p.legL = s * .6; p.legR = -s * .6; p.knL = -Math.max(0, -s) * .9; p.knR = -Math.max(0, s) * .9; p.armL = -s * .6; p.armR = s * .6; p.elL = p.elR = -.3; p.bob = Math.abs(Math.cos(ph)) * .035; if (a.userData.carry) { p.armR = -1.2; p.elR = -.6; } }
  else if (st === 'sit' || st === 'work' || st === 'sittalk' || st === 'sitreact') { p.hipY = bot ? .36 : sitY - .02; p.legL = p.legR = 1.5; p.knL = p.knR = -1.5;
    if (st === 'work') { // hands on the keyboard: upper arms forward, forearms level on the desk, small typing taps
      const hi = (a.userData.deskH || .64) > .72; p.lean = -.12; p.armL = p.armR = bot ? 1.25 : hi ? 1.3 : .98; p.elL = p.elR = bot ? .2 : hi ? .62 : .53; p.armLz = .16; p.armRz = -.16;
      p.armL += Math.max(0, Math.sin(t * 13)) * .05; p.armR += Math.max(0, Math.cos(t * 11)) * .05; p.headX = .14 + Math.sin(t * 1.3) * .04; }
    else if (st === 'sittalk') { p.armR = .6 + Math.sin(t * 4) * .3; p.elR = -1.0; p.armRz = -.3; p.headY = Math.sin(t * 1.7) * .25; p.headX = Math.sin(t * 5) * .05; }
    else if (st === 'sitreact') { p.armL = p.armR = 2.6; p.armLz = .4; p.armRz = -.4; p.elL = p.elR = -.2; p.headX = -.15; }
    else { p.armL = p.armR = .4; p.elL = p.elR = -.9; } }
  else if (st === 'talk') { p.armR = .5 + Math.sin(t * 4) * .35; p.elR = -1.1; p.armRz = -.35; p.armL = .1; p.headY = Math.sin(t * 1.5) * .2; p.headX = Math.sin(t * 5.5) * .05; }
  else if (st === 'react') { const j = Math.max(0, Math.sin(t * 9)); p.bob = j * .12; p.armL = p.armR = 2.8; p.armLz = .45; p.armRz = -.45; p.elL = p.elR = -.15; p.headX = -.15; }
  else if (st === 'wave') { p.armR = 2.7; p.armRz = -.2 + Math.sin(t * 9) * .35; p.elR = -.3; }
  else if (st === 'phone') { p.armR = 2.2; p.elR = -2.1; p.armRz = -.1; p.headY = .2; }
  else { /* stand idle */ p.armL = Math.sin(t * 1.2) * .04; p.armR = -Math.sin(t * 1.2) * .04; p.bob = Math.sin(t * 2) * .006; if (a.userData.look && a.userData.look.arms === 'crossed') { p.armL = p.armR = 1.1; p.elL = p.elR = -1.6; p.armLz = -.5; p.armRz = .5; } }
  if (bot) { p.legL *= .6; p.legR *= .6; if (st !== 'walk') p.bob += Math.sin(t * 2.4 + a.userData.uid) * .015; }
  return p;
}
function applyPose(a, dt, t) {
  const u = a.userData, r = u.rig, cur = u.pose; u.ph = (u.ph || 0) + dt * (u.act === 'walk' ? 9 : 0);
  const tg = targetPose(a, t + u.uid, u.ph); if (r.skirt) r.skirt.visible = !/sit|work/.test(u.act); const k = Math.min(1, dt * 9);
  for (const key in tg) cur[key] += (tg[key] - cur[key]) * (key === 'legL' || key === 'legR' || key === 'knL' || key === 'knR' || key === 'armL' || key === 'armR' ? (u.act === 'walk' ? Math.min(1, dt * 20) : k) : k);
  r.hips.position.y = cur.hipY + cur.bob; r.torso.rotation.x = cur.lean;
  r.legL.rotation.x = cur.legL; r.legR.rotation.x = cur.legR; r.legL.userData.kn.rotation.x = cur.knL; r.legR.userData.kn.rotation.x = cur.knR;
  r.armL.rotation.x = cur.armL; r.armR.rotation.x = cur.armR; r.armL.rotation.z = cur.armLz; r.armR.rotation.z = cur.armRz; r.armL.userData.el.rotation.x = cur.elL; r.armR.userData.el.rotation.x = cur.elR;
  r.head.rotation.y = cur.headY; r.head.rotation.x = cur.headX;
  // blink + talking mouth
  const bl = (Math.sin(t * .9 + u.uid * 3) > .985); r.eyes.forEach((e) => (e.scale.y = bl ? .15 : (u.kind === 'bot' ? 1 : 1.25)));
  const talking = u.act === 'talk' || u.act === 'sittalk'; r.mouth.scale.set(1, talking ? 1 + Math.abs(Math.sin(t * 14)) * .9 : 1, 1);
}


// ---------------------------------------------------------------- name tags + text bubbles
const SPR = new Map();
function labelMat(text, o = {}) {
  const k = [text, o.bg, o.border, o.color].join('|'); if (SPR.has(k)) return SPR.get(k);
  const can = document.createElement('canvas'); can.width = 512; can.height = 112; const c = can.getContext('2d');
  c.font = '700 44px Space Grotesk, Segoe UI, Arial, sans-serif'; const tw = Math.min(488, c.measureText(text).width + 56), x0 = (512 - tw) / 2;
  c.fillStyle = o.bg || P.lab[0]; c.strokeStyle = o.border || P.lab[1]; c.lineWidth = 6; c.beginPath(); c.roundRect(x0, 14, tw, 80, 26); c.fill(); c.stroke();
  if (o.tail) { c.beginPath(); c.moveTo(236, 92); c.lineTo(256, 110); c.lineTo(276, 92); c.fill(); }
  c.fillStyle = o.color || P.lab[2]; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 56, 460);
  const t = new T.CanvasTexture(can); t.colorSpace = T.SRGBColorSpace; const m = new T.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false });
  m.userData.w = tw / 512; SPR.set(k, m); return m;
}
// patch 154 (martin): every name is plain page text laid over the 3D view, so it stays sharp at any zoom and in the
// pixel theme (the old picture labels were blurred). Same calls as before: a label is a point in the scene + a <div>.
const LABS = new Set(); let labLayer = null;
function labLayerEl() { if (labLayer && labLayer.isConnected) return labLayer; labLayer = document.createElement('div'); labLayer.className = 'iba-off-3d-labs';
  labLayer.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:3;'; stage.appendChild(labLayer); return labLayer; }
function sprite(text, o = {}, h) {
  const a = new T.Object3D(), el = document.createElement('div'); el.textContent = text; const kind = o.kind || (o.tail ? 'bubble' : o.bg ? 'badge' : 'tag');
  const base = 'position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;font-family:Inter,Segoe UI,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.25;';
  const css = kind === 'room' ? `font-weight:800;font-size:12.5px;letter-spacing:.02em;padding:3px 10px;border-radius:6px;background:${DARK ? '#140E10' : '#1E2433'};color:#F6EBD2;border:1.5px solid ${o.border || '#C9A24A'};box-shadow:0 2px 6px rgba(0,0,0,.35);`
    : kind === 'bubble' ? 'font-weight:600;font-size:12.5px;padding:4px 10px;border-radius:12px;background:#FFFFFF;color:#16132B;border:1.5px solid #9B5CFF;box-shadow:0 2px 8px rgba(0,0,0,.25);'
    : kind === 'badge' ? `font-weight:800;font-size:11px;min-width:20px;text-align:center;padding:1px 6px;border-radius:10px;background:${o.bg};color:${o.color || '#fff'};border:1.5px solid ${o.border || '#fff'};`
    : `font-weight:700;font-size:11.5px;padding:1px 7px;border-radius:8px;background:${o.bg || P.lab[0]};color:${o.color || P.lab[2]};border:1.5px solid ${o.border || P.lab[1]};`;
  el.style.cssText = base + css + 'transform:translate(-9999px,0);'; labLayerEl().appendChild(el); a.userData.dom = el; a.userData.kind = kind; LABS.add(a); return a;
}
const _lv = new T.Vector3();
function updateLabs() {
  const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight, ox = cv.offsetLeft, oy = cv.offsetTop;
  LABS.forEach((a) => { const el = a.userData.dom; let o = a, shown = true; while (o && o !== scene) { if (o.visible === false) shown = false; o = o.parent; }
    if (!o) { el.remove(); LABS.delete(a); return; }
    _lv.setFromMatrixPosition(a.matrixWorld).project(camera); let x = ox + (_lv.x + 1) / 2 * w, y = oy + (1 - _lv.y) / 2 * h;
    if (a.userData.kind === 'bubble' && x > -80 && x < w + 80 && y > -300 && y < h + 40) { const bh = el.offsetHeight || 26, bw = (el.offsetWidth || 120) / 2; y = Math.max(oy + bh + 4, y); x = Math.min(ox + w - bw - 4, Math.max(ox + bw + 4, x)); } // p162: a talk bubble near the top edge stays in view
    if (a.userData.kind === 'tag' && view.size * zoomMul > 30) shown = false;
    if (a.userData.kind === 'room' && view.size * zoomMul <= 30) shown = false; // p157: zoomed in, the door plates carry the names // whole office: room signs only, names show when you zoom in
    if (!shown || x < -80 || y < -40 || x > w + 80 || y > h + 40) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    if (el.style.display === 'none') el.style.display = ''; el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`; });
}
function sizeLabels() {}

// ---------------------------------------------------------------- people looks (default + saved per person)
const LOOK_PATH = 'system_settings/office_look_v1';
let LOOKS = {}, looksLoaded = false;
const hash = (s) => { let h = 0; String(s || '').split('').forEach((ch) => (h = (h * 31 + ch.charCodeAt(0)) | 0)); return Math.abs(h); };
function keyOf(p) { return String(p.key || p.full || p.name || '').replace(/[.#$\[\]\/]/g, '_'); }
function defaultLook(p) {
  const h = hash(p.full || p.name), room = p.room || '';
  if (p.me) return { g: 'm', skin: 2, hair: 'spiky', hairC: 'black', eyes: '#2A4A7A', glasses: true, outfit: 'suit', top: '#22263A', tie: '#2FB8D0', mood: 'happy' };
  const outfit = LEAD.includes(room) ? 'suit' : room === 'wh' || room === 'log' ? 'polo' : room === 'acc' ? (h & 2 ? 'vest' : 'shirt') : 'shirt';
  return { g: 'm', skin: p.skin || 1, hair: ['side', 'slick', 'spiky', 'buzz', 'curly'][h % 5], hairC: p.hair || 'black', eyes: ['#3A2A1E', '#4A2E1E', '#2A4A7A', '#3A6A4A'][(h >> 3) % 4],
    beard: p.beard ? ((h >> 4) & 1 ? 'full' : 'short') : null, glasses: !!((h >> 6) & 1) && ((h >> 7) & 1), outfit, top: outfit === 'shirt' ? ['#DCE6F5', '#F4F4F4', '#9EC3EA'][(h >> 5) % 3] : outfit === 'polo' ? '#2A8F8A' : (p.suit || '#22305A'),
    tie: ['#2FB8D0', '#8A2D3A', '#7A3FB0', '#C9A24A'][(h >> 2) % 4], mood: (h >> 8) & 1 ? 'happy' : 'calm' };
}
function lookOf(p) { const saved = LOOKS[keyOf(p)]; return Object.assign({}, defaultLook(p), saved || {}); }
function loadLooks() { const d = fdb(); if (!d || looksLoaded) return Promise.resolve(); looksLoaded = true;
  return d.ref(LOOK_PATH).once('value').then((s) => { LOOKS = s.val() || {}; actors.forEach((a, p) => { if (p.human) rebuildActor(p); }); }).catch((e) => { looksLoaded = false; console.warn('Office 3D: looks', e); }); }
const BOTLOOK = { Rina: { bow: true, skirt: true }, Sami: { tie: true }, Rafi: { glasses: true }, Ana: { heart: true, skirt: true } };

// ---------------------------------------------------------------- scene
let renderer, scene, camera, host, stage, built = null, people3 = null, badges = null, roomLab = new Map(), lights = [];
let actors = new Map(), pickables = [], cabinets = new Map(), uid = 1, lastTheme = '', lastSize = '';
let azimuth = Math.PI / 4, elevation = .74, drag = null, view = { x: 0, z: 0, size: 44 }, pan = { x: 0, z: 0 }, lastT = 0;
// patch 154: your own view on top of the app's My office / Whole office: a room you clicked, your wheel zoom, your drag
let focusRoom = null, zoomMul = 1, lastAppView = '', azGoal = Math.PI / 4;
const raycaster = new T.Raycaster(), pointer = new T.Vector2();
function themeKey(s) { return s.theme === 'clean' ? 'warm' : 'noir'; }
function disposeTree(o) { if (!o) return; o.traverse((m) => { if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }); if (o.parent) o.parent.remove(o); }
function setLights() { lights.forEach((l) => l.parent && l.parent.remove(l)); lights = [];
  const hemi = new T.HemisphereLight(DARK ? 0xD8CCFF : 0xFFFFFF, DARK ? 0x2A2040 : 0xC8BFAF, P.hemi);
  const sun = new T.DirectionalLight(DARK ? 0xE8DCFF : 0xFFF4E2, P.sun); sun.position.set(-16, 30, -10); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 34, bottom: -34, near: 1, far: 110 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; lights.push(hemi, sun);
  if (DARK) [[0, 2.4, -4, P.trimA], [-16, 2.4, 12, P.trimB], [-4, 2.4, 12, P.trimA], [18, 2.4, 12, P.trimB], [-12, 2.4, -16, P.trimB], [8, 2.4, -16, P.accent], [17, 2.4, -2, P.trimA]].forEach(([x, y, z, c]) => { const l = new T.PointLight(c, 8, 11, 1.5); l.position.set(x, y, z); lights.push(l); });
  lights.forEach((l) => scene.add(l)); scene.background = new T.Color(P.bg); }
function build(state) {
  const k = themeKey(state); P = THEMES[k]; DARK = !!P.dark; lastTheme = state.theme; const edit = !!BLD;
  if (built) { if (built.edit) disposeTree(built.edit); disposeTree(built.statics); disposeTree(built.low); disposeTree(built.sign); built.clocks.forEach(disposeTree); if (built.fount) disposeTree(built.fount.g); if (built.kiosk) disposeTree(built.kiosk.g); }
  disposeTree(people3); disposeTree(badges); roomLab.forEach((s) => s.parent && s.parent.remove(s)); roomLab.clear(); SPR.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); SPR.clear();
  actors.clear(); pickables = []; cabinets.clear();
  materials(); built = buildOffice(state, edit); addOutlines(built.low, OUT);
  scene.add(built.statics, built.low, built.sign); if (built.fount) scene.add(built.fount.g); if (built.kiosk && !edit) scene.add(built.kiosk.g); if (built.edit) scene.add(built.edit); built.clocks.forEach((c) => scene.add(c));
  people3 = new T.Group(); badges = new T.Group(); scene.add(people3, badges);
  disposeTree(rideG); rideG = new T.Group(); scene.add(rideG); RIDES = []; PARKED = {}; parkT = 0; // p157 rides
  setLights(); if (!edit) addBadges(state); if (edit) bldAfterBuild();
  const px = P.px || 1; renderer.setPixelRatio(px > 1 ? 1 / px : Math.min(1.5, devicePixelRatio || 1)); renderer.domElement.style.imageRendering = px > 1 ? 'pixelated' : '';
  resize3d();
}
// where a room's name sign hangs: over its door (the one onto the hub when it has several), else the room's middle
function doorSign(state, r) { const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; let best = null;
  (state.walls || []).forEach(([x1, y1, x2, y2, , doors]) => { if (!doors || !doors.length) return; const v = x1 === x2; const cells = doors.filter((c) => v ? (inR(x1 - 1, c) || inR(x1, c)) : (inR(c, y1 - 1) || inR(c, y1))); if (!cells.length) return;
    const m = cells.reduce((p, c) => p + c, 0) / cells.length + .5; const out = v ? (inR(x1, cells[0]) ? [x1 - 1, cells[0]] : [x1, cells[0]]) : (inR(cells[0], y1) ? [cells[0], y1 - 1] : [cells[0], y1]);
    const hub = roomOf(state, out[0], out[1]).id === 'plaza'; const p = v ? W(x1, m) : W(m, y1); if (!best || (hub && !best.hub)) best = { p, hub }; });
  if (best) return [best.p[0], 2.75, best.p[1]]; const [x, z] = W(r.x + r.w / 2, r.y + r.h / 2); return [x, 2.6, z]; }
function roomLabels(state) {
  state.rooms.forEach((r) => { if (!r.name) return; const text = r.name, old = roomLab.get(r.id); if (old && old.userData.text === text) return; if (old) scene.remove(old);
    const [x, y, z] = doorSign(state, r); const s = sprite(text, { kind: 'room', border: r.id === 'me' ? '#F3C45B' : '#C9A24A' }, .62); s.position.set(x, y, z); s.userData.text = text; scene.add(s); roomLab.set(r.id, s); });
}
function addBadges(state) {
  (state.cabs || []).forEach((cab) => { if (!cab.at || cab.at[0] < 0) return; const f = state.furniture.find((o) => Math.floor(o.x) === cab.at[0] && Math.floor(o.y) === cab.at[1]); if (!f) return;
    const [x, z] = W(f.x + f.w / 2, f.y + f.d / 2); const hit = add(badges, new T.BoxGeometry(Math.max(1, f.w), 2.4, Math.max(1, f.d)), new T.MeshBasicMaterial({ visible: false }), x, 1.2, z, { cast: false, noOutline: true });
    hit.userData.hit = { type: 'cab', id: cab.id }; pickables.push(hit); cabinets.set(cab.id, { x, z, h: f.t === 'exec' || f.t === 'desk' ? 1.5 : f.t === 'printer' ? 1.45 : 2.3, old: -1, label: null }); });
}
function updateBadges(state) {
  (state.cabs || []).forEach((cab, i) => { const b = cabinets.get(cab.id); if (!b) return; let n = 0; try { n = cab.rtp ? (window.ibaOfficePrint && window.ibaOfficePrint.count ? window.ibaOfficePrint.count() : 0) : (state.counts[i] || 0); } catch (_) {}
    if (n === b.old) return; b.old = n; if (b.label) badges.remove(b.label); b.label = sprite(String(n), { bg: n ? '#D63D49' : (DARK ? '#2A2024' : '#6A7480'), border: n ? '#FF8790' : '#9AA3AD', color: '#FFFFFF' }, .36); b.label.position.set(b.x, b.h + .25, b.z); badges.add(b.label); });
}
// ---------------------------------------------------------------- actors (people + bots) follow the office's state
function makeActor(p) {
  const holder = new T.Group(); people3.add(holder); let g;
  if (p.human) g = person(holder, Object.assign({ name: p.name }, lookOf(p)));
  else g = bot(holder, Object.assign({ name: p.name, color: new T.Color(p.hair || '#3FD1C1').getHex() }, BOTLOOK[p.name] || {}));
  g.userData.uid = uid++; g.userData.act = 'stand';
  const tag = sprite(p.me ? (p.name || 'You') : (p.name || ''), { border: p.human ? (p.me ? '#C9A24A' : P.lab[1]) : '#' + new T.Color(p.hair || '#3FD1C1').getHexString() }, .3);
  tag.position.y = p.human ? 2.02 : 1.62; holder.add(tag);
  const hit = add(holder, new T.BoxGeometry(.7, 1.8, .6), new T.MeshBasicMaterial({ visible: false }), 0, .9, 0, { cast: false, noOutline: true }); hit.userData.hit = { type: 'person', name: p.name }; pickables.push(hit);
  const a = { holder, g, tag, hit, bubble: null, bubbleText: '', ry: FACE.S, lx: p.x, ly: p.y };
  const [x, z] = W(p.x + .5, p.y + .5); holder.position.set(x, 0, z); holder.rotation.y = a.ry; actors.set(p, a);
  try { a.bar = deskBar(window.ibaOffice3DState ? window.ibaOffice3DState() : { rooms: [] }, p); if (a.bar) people3.add(a.bar); } catch (e) { console.warn('Office 3D: desk bar', e); }
  return a;
}
function rebuildActor(p) { const a = actors.get(p); if (!a) return; pickables = pickables.filter((m) => m !== a.hit); const keep = { ry: a.ry, lx: a.lx, ly: a.ly }; disposeTree(a.holder); if (a.bar) { disposeTree(a.bar); a.bar = null; } actors.delete(p); const n = makeActor(p); Object.assign(n, keep); n.holder.rotation.y = n.ry; }
function stepActor(p, a, dt, t) {
  const u = a.g.userData, moving = !!(p.path && p.path.length), ch = !moving && chairByTile.get(Math.round(p.x) + ',' + Math.round(p.y));
  const seated = ch && Math.abs(p.x - Math.round(p.x)) < .06 && Math.abs(p.y - Math.round(p.y)) < .06;
  const [x, z] = W(p.x + .5, p.y + .5); const dx = p.x - a.lx, dy = p.y - a.ly; a.lx = p.x; a.ly = p.y;
  let want = a.ry; if (moving && Math.hypot(dx, dy) > 1e-4) want = Math.atan2(dx, dy) + Math.PI; else if (seated) want = FACE[ch.dir] != null ? FACE[ch.dir] : a.ry;
  let df = want - a.ry; df = ((df + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; a.ry += df * Math.min(1, dt * 10);
  a.holder.position.set(x, 0, z); a.holder.rotation.y = a.ry; a.holder.visible = !p.hidden;
  const talk = p.bubble && performance.now() < p.bubbleT ? String(p.bubble) : '';
  const bubble = talk; // p162 (martin): no "In the hall · time" sign over the head any more (only talk / chat bubbles)
  u.carry = !!p.carry; if (u.rig.paper) u.rig.paper.visible = !!p.carry;
  u.act = moving ? 'walk' : seated ? (talk ? 'sittalk' : (ch.sprite === 'work' && !ch.noDesk ? 'work' : 'sit')) : (talk ? 'talk' : 'stand');
  u.seatY = seatY(ch); u.deskH = ch ? ch.deskH : 0;
  if (bubble !== a.bubbleText) { if (a.bubble) a.holder.remove(a.bubble); a.bubbleText = bubble; a.bubble = null;
    if (bubble) { const chat = !!p.chatBubble && bubble === String(p.bubble || ''); const lim = chat ? 120 : 34; a.bubble = sprite(bubble.length > lim ? bubble.slice(0, lim - 1) + '…' : bubble, { bg: '#FFFFFF', border: chat === 'pub' ? '#E0A526' : '#9B5CFF', color: '#16132B', tail: true }, .42);
      if (chat) { const el = a.bubble.userData.dom; if (el) { if (bubble.length > 30) { el.style.whiteSpace = 'normal'; el.style.width = '230px'; el.style.textAlign = 'left'; } el.style.borderColor = p.chatBubble === 'pub' ? '#E0A526' : '#9B5CFF'; if (/^writing/.test(bubble)) el.style.fontStyle = 'italic'; } } /* p162: chat bubbles wrap */ a.bubble.position.y = p.human ? 2.45 : 2.02; a.holder.add(a.bubble); } }
  if (u.act === 'walk') u.ph = (u.ph || 0) + dt * 5;
  applyPose(a.g, dt, t);
}
// ---------------------------------------------------------------- camera: whole office <-> your room, drag to turn, right-drag to move
function focusGoal(state) {
  if (focusRoom) { const f = state.rooms.find((q) => q.id === focusRoom); if (f) { const hub = f.id === 'plaza'; const [fx, fz] = hub ? W(23.5, 19.5) : W(f.x + f.w / 2, f.y + f.h / 2); return { x: fx, z: fz, size: hub ? 20 : Math.max(8, f.w * 1.25, f.h * 1.2) }; } }
  const r = state.rooms.find((q) => q.id === state.currentRoom) || state.rooms[0]; const [rx, rz] = W(r.x + r.w / 2, r.y + r.h / 2);
  const k = Math.max(0, Math.min(1, state.zoom || 0)), e = k * k * (3 - 2 * k); const room = Math.max(9, r.w * 1.3, r.h * 1.25);
  return { x: rx * e - 3 * (1 - e), z: rz * e, size: 40 + (room - 40) * e }; // whole view also shows the parking
}
function placeCamera() {
  const aspect = Math.max(.6, stage.clientWidth / Math.max(1, stage.clientHeight)), half = view.size * zoomMul / 2;
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
  const tx = view.x + pan.x, tz = view.z + pan.z, d = 80, flat = Math.cos(elevation);
  camera.position.set(tx + Math.sin(azimuth) * d * flat, d * Math.sin(elevation), tz + Math.cos(azimuth) * d * flat); camera.lookAt(tx, 0, tz);
}
// the entrance door slides open when someone is close to it
function slideDoor(state, dt) { const door = state.door || [0, 3]; let near = false; (state.people || []).forEach((p) => { if (!p.hidden && Math.abs(p.x - door[0]) < 2.2 && Math.abs(p.y - door[1]) < 1.6) near = true; });
  OUTER.forEach((w) => { if (!w.door || !w.door.userData.leaves) return; const u = w.door.userData; u.open = (u.open || 0) + ((near ? 1 : 0) - (u.open || 0)) * Math.min(1, dt * 4);
    u.leaves.forEach((l) => (l.position.x = l.userData.home + l.userData.side * l.userData.w * .92 * u.open)); }); }
window.ibaOffice3DPan = (x, z) => { pan.x = +x || 0; pan.z = +z || 0; };
window.ibaOffice3DFocus = (id, z) => { focusRoom = id || null; pan.x = pan.z = 0; zoomMul = +z || 1; };
function lowerWalls(dt) { const cd = new T.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth));
  OUTER.forEach((w) => { if (w.k !== 1) { w.k = 1; w.g.scale.y = 1; } }); /* p157 (martin): all outside walls always stay up */
  ADS.forEach((a) => { a.tm += dt; if (a.tm > 4.5) { a.tm = 0; a.i++; drawAd(a.t.image.getContext('2d'), a.t.image.width, a.t.image.height, a.i); a.t.needsUpdate = true; } }); }
// 18.0.0 patch 157 (martin): rides. Staff come and go by Uber at the entrance; Irwin + the managers use their own car
// in the reserved bays (it stays parked while they are in). ibaOffice3DRide(room, 'in'|'out') returns ms to wait.
const CAR_COL = { me: 0x22305A, md: 0x1E1E24, coo: 0xF2F4F8, fin: 0x8A2D3A, spA: 0x9AA3AD, pd: 0x2F5A48 };
let rideG = null, RIDES = [], PARKED = {}, parkT = 0;
const LANE = -27.9, BAYX = -32.4;
function rideCar(col, uber) { const g = car(rideG, 0, 0, 0, col); if (uber) { add(g, RB(.7, .22, .3, .04), toon({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: .05 }), 0, 1.42, .15, { noOutline: true });
    const t = tex(128, 40, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 26px Inter, Segoe UI, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TAXI', w / 2, h / 2 + 1); });
    [1, -1].forEach((sd) => add(g, new T.PlaneGeometry(.66, .2), new T.MeshBasicMaterial({ map: t }), sd * .36, 1.42, .15, { ry: sd * Math.PI / 2, cast: false, noOutline: true })); }
  addOutlines(g, OUT); return g; }
// a ride = waypoints [x, z, ry, seconds]; ry PI = heading +z (down the road), 0 = heading -z
function startRide(g, pts, end) { g.position.set(pts[0][0], 0, pts[0][1]); g.rotation.y = pts[0][2]; RIDES.push({ g, pts, i: 1, t: 0, end }); }
function stepRides(state, dt) { if (!rideG) return;
  RIDES = RIDES.filter((r) => { const a = r.pts[r.i - 1], b = r.pts[r.i]; if (!b) { if (r.end) r.end(r.g); return false; } r.t += dt; const k = Math.min(1, r.t / Math.max(.01, b[3])), e = k * k * (3 - 2 * k);
    r.g.position.x = a[0] + (b[0] - a[0]) * e; r.g.position.z = a[1] + (b[1] - a[1]) * e; let d = b[2] - a[2]; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; r.g.rotation.y = a[2] + d * e;
    if (k >= 1) { r.i++; r.t = 0; } return true; });
  parkT -= dt; if (parkT > 0) return; parkT = 2; // keep the managers' cars parked while they are in
  CAR_ROOMS.forEach((rid, i) => { const z = BAYS[i]; if (z === undefined) return; const busy = RIDES.some((r) => r.rid === rid); if (busy) return;
    const want = (state.people || []).some((p) => p.room === rid && !p.bot && p.inside); if (want && !PARKED[rid]) { const g = rideCar(CAR_COL[rid], false); g.position.set(BAYX, 0, z); g.rotation.y = Math.PI / 2; PARKED[rid] = g; }
    else if (!want && PARKED[rid]) { disposeTree(PARKED[rid]); delete PARKED[rid]; } }); }
window.ibaOffice3DRide = (rid, dir) => { if (!rideG || !renderer) return 0; const root = document.getElementById('iba-office'); if (root && root.hidden) return 0;
  const i = CAR_ROOMS.indexOf(rid), z = BAYS[i], top = -24, bot = 24;
  if (i >= 0 && z !== undefined) { // own car: drive in and park / back out and drive off
    if (dir === 'in') { if (PARKED[rid]) return 0; const g = rideCar(CAR_COL[rid], false); startRide(g, [[LANE, top, Math.PI, 0], [LANE, z - 2.2, Math.PI, 3], [BAYX, z, Math.PI / 2, 1.6]], (g2) => { PARKED[rid] = g2; }); RIDES[RIDES.length - 1].rid = rid; return 4800; }
    const g = PARKED[rid] || rideCar(CAR_COL[rid], false); delete PARKED[rid]; g.position.set(BAYX, 0, z); g.rotation.y = Math.PI / 2;
    startRide(g, [[BAYX, z, Math.PI / 2, 0], [LANE, z + 2, Math.PI, 1.8], [LANE, bot, Math.PI, 3]], (g2) => disposeTree(g2)); RIDES[RIDES.length - 1].rid = rid; return 0; }
  if (RIDES.filter((r) => r.uber).length >= 2) return 0; // a rush (6 PM): two taxis are enough
  const g = rideCar(0xF2C230, true), wait = dir === 'in' ? 1.2 : 2.6;
  startRide(g, [[LANE, top, Math.PI, 0], [LANE + .4, DOORZ, Math.PI, 3.2], [LANE + .4, DOORZ + .01, Math.PI, wait], [LANE, bot, Math.PI, 3]], (g2) => disposeTree(g2)); RIDES[RIDES.length - 1].uber = true;
  return dir === 'in' ? 3600 : 0; };
function resize3d() { if (!renderer || !stage) return; const w = Math.max(1, stage.clientWidth), h = w < 700 ? Math.round(Math.max(300, Math.min(window.innerHeight * .62, w * 1.35))) : Math.max(360, Math.min(window.innerHeight * .76, w * .56)); /* p155: taller view on a phone */ stage.style.height = h + 'px'; renderer.setSize(w, h, false); lastSize = w + 'x' + h; }
// 18.0.0 patch 155: touch. One finger = move, two fingers = pinch to zoom + twist to turn, tap = open (same as a click).
const touches = new Map(); let pinch = null;
function pinchNow() { const [a, b] = [...touches.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) }; }
function touchDown(e) { if (e.pointerType !== 'touch') return false; touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) { const p = pinchNow(); pinch = { d: p.d, a: p.a, zoom0: zoomMul, az0: azimuth }; drag = null; return true; } return touches.size > 2; }
function touchMove(e) { if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return false; touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (!pinch || touches.size < 2) return false; const p = pinchNow();
  zoomMul = Math.max(.22, Math.min(1.5, pinch.zoom0 * pinch.d / p.d)); azimuth = pinch.az0 - (p.a - pinch.a); azGoal = azimuth; return true; }
function touchUp(e) { if (e.pointerType !== 'touch') return; touches.delete(e.pointerId); if (touches.size < 2) pinch = null; }
function onDown(e) { if (touchDown(e)) return; if (BLD && bldDown(e)) return; drag = { x: e.clientX, y: e.clientY, moved: false, pan: !(e.button === 2 || e.shiftKey) }; /* left-drag moves, right-drag (or Shift) turns */ try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {} }
function onMove(e) { if (touchMove(e)) return; if (BLD && bldMoveP(e)) return; if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; if (!drag.moved) return; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.pan) { const k = view.size * zoomMul / Math.max(1, stage.clientHeight); const cx = Math.cos(azimuth), sx = Math.sin(azimuth); pan.x += (-dx * cx - dy * sx / Math.sin(elevation)) * k; pan.z += (dx * sx - dy * cx / Math.sin(elevation)) * k; pan.x = Math.max(-26, Math.min(26, pan.x)); pan.z = Math.max(-22, Math.min(22, pan.z)); }
  else { azimuth -= dx * .008; azGoal = azimuth; elevation = Math.max(.42, Math.min(1.25, elevation + dy * .004)); } }
function onUp(e) { touchUp(e); if (BLD && bldUp(e)) return; if (!drag) return; const click = !drag.moved; drag = null; if (!click) return; if (BLD) { bldClick(e); return; } const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  // 18.0.0 patch 157: right-CLICK (no drag) on the floor = small menu "Go here"; right-drag still turns the view
  if (e.button === 2) { raycaster.setFromCamera(pointer, camera); const ph = raycaster.intersectObjects(pickables, false).find((h) => h.object.userData.hit && h.object.userData.hit.type === 'person' && h.object.parent && h.object.parent.visible !== false);
    if (ph && window.ibaOfficeWheel && window.ibaOfficeWheel(ph.object.userData.hit.name, e.clientX, e.clientY)) return; // p159: right-click a person / bot = the wheel
    if (!ph && raycaster.intersectObjects(pickables, false).some((h) => h.object.userData.hit && h.object.userData.hit.type === 'kiosk')) { if (window.ibaOffice3DSelectKiosk) window.ibaOffice3DSelectKiosk(); return; } // p161: right-click the info robot = search too
    const g = groundAt(e); if (!g) return; const tx = Math.floor(g.x + 23), ty = Math.floor(g.z + 20); if (tx < 0 || ty < 0 || tx >= 46 || ty >= 40) return; if (window.ibaOfficeGoMenu) window.ibaOfficeGoMenu(tx, ty, e.clientX, e.clientY); return; }
  raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(pickables, false).find((h) => { let o = h.object; while (o) { if (o.visible === false && !o.userData.hit) return false; o = o.parent; } return true; });
  if (!hit) { const g = groundAt(e); if (!g) return; const s = window.ibaOffice3DState(); const tx = Math.floor(g.x + 23), ty = Math.floor(g.z + 20); if (tx < 0 || ty < 0 || tx >= 46 || ty >= 40) return;
    const room = roomOf(s, tx, ty); if (!room) return; if (focusRoom === room.id) return; focusRoom = room.id; pan.x = pan.z = 0; zoomMul = 1; return; } // click a room = zoom into it
  const q = hit.object.userData.hit; if (q.type === 'kiosk') { if (window.ibaOffice3DSelectKiosk) window.ibaOffice3DSelectKiosk(); return; } if (q.type === 'cab') window.ibaOffice3DSelectCab(q.id); else window.ibaOffice3DSelectPerson(q.name); }
const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
function groundAt(e) { const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const v = new T.Vector3(); return raycaster.ray.intersectPlane(groundPlane, v) ? v : null; }
// wheel = zoom in / out toward the mouse (the point under the mouse stays put)
function onWheel(e) { e.preventDefault(); const before = groundAt(e); zoomMul = Math.max(.22, Math.min(1.5, zoomMul * (e.deltaY < 0 ? .86 : 1.16))); placeCamera(); const after = groundAt(e);
  if (before && after) { pan.x += before.x - after.x; pan.z += before.z - after.z; pan.x = Math.max(-26, Math.min(26, pan.x)); pan.z = Math.max(-22, Math.min(22, pan.z)); } }
function resetView() { focusRoom = null; zoomMul = 1; pan.x = pan.z = 0; azGoal = Math.PI / 4; elevation = .74; }
function turn(by) { azGoal += by; }
function addViewButtons() { if (stage.querySelector('.iba-off-3d-btns')) return; const box = document.createElement('div'); box.className = 'iba-off-3d-btns';
  box.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:5;display:flex;gap:6px;';
  [['⟲', 'Turn left', () => turn(Math.PI / 4)], ['⟳', 'Turn right', () => turn(-Math.PI / 4)], ['+', 'Zoom in', () => (zoomMul = Math.max(.22, zoomMul * .8))], ['−', 'Zoom out', () => (zoomMul = Math.min(1.5, zoomMul * 1.25))], ['⌂', 'Back to the normal view', resetView]].forEach(([t, tip, fn]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.title = tip; b.setAttribute('aria-label', tip);
    b.style.cssText = 'width:34px;height:34px;border-radius:10px;border:1px solid rgba(201,162,74,.7);background:rgba(20,16,18,.78);color:#F3E6C8;font:700 18px/1 Segoe UI,Arial,sans-serif;cursor:pointer;';
    b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); }); box.appendChild(b); });
  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative'; stage.appendChild(box); }
function setup(state) {
  if (renderer) return; host = document.querySelector('#iba-office .iba-off-3d-host'); stage = document.querySelector('#iba-office .iba-off-stage'); if (!host || !stage) return;
  const oldCanvas = stage.querySelector('canvas'); if (oldCanvas) oldCanvas.classList.add('iba-off-legacy-canvas');
  renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.className = 'iba-off-3d-canvas'; renderer.domElement.setAttribute('aria-label', 'IBA Office in 3D: drag to move, right-drag to turn, wheel to zoom, click a room to zoom into it, right-click the floor to walk there, double-click to reset'); host.appendChild(renderer.domElement);
  scene = new T.Scene(); camera = new T.OrthographicCamera(-20, 20, 20, -20, -200, 400);
  const el = renderer.domElement; el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', (e) => { drag = null; touchUp(e); }); el.addEventListener('wheel', onWheel, { passive: false }); el.addEventListener('contextmenu', (e) => e.preventDefault()); el.addEventListener('dblclick', () => resetView());
  new ResizeObserver(() => resize3d()).observe(stage); window.addEventListener('resize', resize3d);
  build(state); const g = focusGoal(state); Object.assign(view, g); stage.classList.add('iba-off-3d-ready'); window.ibaOffice3DActive = true;
  const load = document.querySelector('#iba-office .iba-off-load'); if (load) load.textContent = '3D office ready';
  addLookButton(); addBuildButton(); addViewButtons(); loadLooks();
}
function frame(t, state) {
  if (!renderer || !stage) return; const root = document.getElementById('iba-office'); if (root && root.hidden) return;
  const dt = Math.min(.08, Math.max(0, (t - lastT) / 1000) || .016); lastT = t; const ts = t / 1000;
  if (state.theme !== lastTheme) build(state);
  if (BLD) bldFrame();
  roomLabels(state);
  const live = new Set(state.people); actors.forEach((a, p) => { if (live.has(p)) return; pickables = pickables.filter((m) => m !== a.hit); disposeTree(a.holder); if (a.bar) { disposeTree(a.bar); a.bar = null; } actors.delete(p); });
  state.people.forEach((p) => { const a = actors.get(p) || makeActor(p); stepActor(p, a, dt, ts); });
  if (IBA) IBA.rotation.y = ts * .35;
  if (built.fount) fountainTick(built.fount, ts);
  if (built.kiosk) kioskTick(built.kiosk, ts, dt);
  const d = new Date(); built.clocks.forEach((c) => { const [h, m] = c.userData.hands; h.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2; m.rotation.z = -d.getMinutes() / 60 * Math.PI * 2; });
  updateBadges(state);
  const appView = (state.zoom || 0).toFixed(2) + '|' + state.currentRoom; if (appView !== lastAppView) { if (lastAppView) resetView(); lastAppView = appView; } // My office / Whole office = back to that view
  { let dA = azGoal - azimuth; azimuth += dA * Math.min(1, dt * 6); }
  const goal = focusGoal(state), k = Math.min(1, dt * 5); view.x += (goal.x - view.x) * k; view.z += (goal.z - view.z) * k; view.size += (goal.size - view.size) * k;
  if (stage.clientWidth + 'x' + stage.clientHeight !== lastSize) resize3d();
  slideDoor(state, dt); lowerWalls(dt); stepRides(state, dt); placeCamera(); renderer.render(scene, camera); updateLabs();
}

// ---------------------------------------------------------------- "Characters": pick each person's look (Super Admin; saved per person)
const HAIRS = [['spiky', 'Spiky'], ['side', 'Side part'], ['slick', 'Slick back'], ['curly', 'Curly'], ['buzz', 'Short'], ['bald', 'Bald'], ['ghutra', 'Ghutra'], ['bob', 'Bob'], ['long', 'Long'], ['pony', 'Ponytail'], ['bun', 'Bun'], ['hijab', 'Hijab']];
const UNIS = [['suit', 'Suit + tie'], ['shirt', 'Shirt + ID'], ['vest', 'Sweater vest'], ['polo', 'IBA polo'], ['blouse', 'Blouse + skirt'], ['site', 'Site + helmet'], ['thobe', 'Thobe'], ['abaya', 'Abaya'], ['hoodie', 'Hoodie']];
const EYES = ['#3A2A1E', '#4A2E1E', '#6A3A2A', '#2A4A7A', '#3A6A4A', '#2A6A7A'];
const TOPS = ['#22263A', '#1F2A4A', '#2C3D6B', '#3A2448', '#4A2D6A', '#2A3A2E', '#5D4A3A', '#DCE6F5', '#F4F4F4', '#9EC3EA', '#F4E7EF', '#2A8F8A', '#8A2D3A', '#3A3046'];
const TIES = ['#2FB8D0', '#8A2D3A', '#7A3FB0', '#C9A24A', '#22305A', '#2E7A4A'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lookUI = null;
function addLookButton() {
  const ctrl = document.querySelector('#iba-office .iba-off-ctrl'); if (!ctrl || ctrl.querySelector('.iba-off-looks')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'iba-off-looks'; b.textContent = 'Characters'; b.title = "Change each person's hair, uniform and colours";
  b.addEventListener('click', (e) => { e.stopPropagation(); openLooks(); });
  const setupB = ctrl.querySelector('[data-act="setup"]'); ctrl.insertBefore(b, setupB || null);
}
function humans() { const s = window.ibaOffice3DState(); return (s.people || []).filter((p) => p.human); }
function openLooks(who) {
  const list = humans(); if (!list.length) { alertBox('Nobody is in the office yet. Put people in rooms with Setup first.'); return; }
  if (!lookUI) lookUI = makeLookUI();
  const sel = lookUI.querySelector('.ilk-who'); sel.innerHTML = list.map((p, i) => `<option value="${i}">${esc(p.full || p.name)}${p.me ? ' (you)' : ''}</option>`).join('');
  const i = Math.max(0, list.findIndex((p) => who ? p === who : p.me)); sel.value = String(i);
  lookUI.hidden = false; pickPerson(list[i]); lookUI.querySelector('.ilk-who').focus();
}
function alertBox(msg) { const s = document.querySelector('#iba-office .iba-off-load'); if (s) { s.textContent = msg; s.style.display = ''; setTimeout(() => (s.style.display = 'none'), 4000); } }
let cur = null, curP = null, prev = null;
function makeLookUI() {
  const st = document.createElement('style'); st.textContent = `
#iba-off-look{position:fixed;inset:0;z-index:2147481000;background:rgba(8,10,16,.45);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.4 Inter,Segoe UI,sans-serif}
#iba-off-look[hidden]{display:none}
#iba-off-look .ilk-box{background:#1C1F27;color:#EEF0F4;border:1px solid #3A3F4C;border-radius:14px;max-width:880px;width:100%;max-height:92vh;overflow:auto;display:grid;grid-template-columns:280px 1fr;gap:0}
#iba-off-look .ilk-prev{background:#262A34;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;border-radius:14px 0 0 14px}
#iba-off-look canvas{width:256px;height:340px;display:block}
#iba-off-look .ilk-side{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
#iba-off-look h3{margin:0;font:700 18px Space Grotesk,Segoe UI,sans-serif}
#iba-off-look .ilk-row{display:flex;flex-direction:column;gap:6px}
#iba-off-look .ilk-row>span{font-size:12px;color:#A3AAB6;text-transform:uppercase;letter-spacing:.06em}
#iba-off-look .ilk-chips{display:flex;flex-wrap:wrap;gap:6px}
#iba-off-look .ilk-chips button{background:#2A2F3A;color:#EEF0F4;border:1px solid #3A3F4C;border-radius:999px;padding:5px 11px;cursor:pointer;font:inherit;font-size:13px}
#iba-off-look .ilk-chips button[aria-pressed="true"]{background:#C9A24A;color:#1C1F27;border-color:#C9A24A;font-weight:600}
#iba-off-look .ilk-sw{width:28px;height:28px;padding:0!important;border-radius:50%!important}
#iba-off-look .ilk-sw[aria-pressed="true"]{outline:3px solid #C9A24A;outline-offset:2px}
#iba-off-look select{background:#2A2F3A;color:#EEF0F4;border:1px solid #3A3F4C;border-radius:8px;padding:7px 10px;font:inherit}
#iba-off-look .ilk-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px}
#iba-off-look .ilk-foot button{border-radius:8px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #3A3F4C;background:#2A2F3A;color:#EEF0F4}
#iba-off-look .ilk-foot .ilk-save{background:#C9A24A;color:#1C1F27;border-color:#C9A24A}
#iba-off-look .ilk-msg{font-size:13px;color:#A3AAB6;min-height:1.2em}
@media (max-width:720px){#iba-off-look .ilk-box{grid-template-columns:1fr}#iba-off-look .ilk-prev{border-radius:14px 14px 0 0}#iba-off-look canvas{width:180px;height:240px}}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'iba-off-look'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Characters');
  const chips = (name, items) => `<div class="ilk-chips" data-k="${name}">${items.map(([v, l]) => `<button type="button" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  const sw = (name, cols) => `<div class="ilk-chips" data-k="${name}">${cols.map((c) => `<button type="button" class="ilk-sw" data-v="${c}" style="background:${c}" title="${c}" aria-label="${name} ${c}"></button>`).join('')}</div>`;
  const hairCols = Object.keys(HAIRC).map((k) => HAIRC[k]);
  d.innerHTML = `<div class="ilk-box"><div class="ilk-prev"><canvas width="512" height="680"></canvas><div class="ilk-msg" style="text-align:center;margin-top:6px">Drag to turn</div></div><div class="ilk-side">
<h3>Characters</h3>
<label class="ilk-row"><span>Person</span><select class="ilk-who"></select></label>
<div class="ilk-row"><span>Body</span>${chips('g', [['m', 'Man'], ['f', 'Woman']])}</div>
<div class="ilk-row"><span>Hair</span>${chips('hair', HAIRS)}</div>
<div class="ilk-row"><span>Hair colour</span>${sw('hairC', hairCols)}</div>
<div class="ilk-row"><span>Skin</span>${sw('skin', SKIN)}</div>
<div class="ilk-row"><span>Eyes</span>${sw('eyes', EYES)}</div>
<div class="ilk-row"><span>Uniform</span>${chips('outfit', UNIS)}</div>
<div class="ilk-row"><span>Uniform colour</span>${sw('top', TOPS)}</div>
<div class="ilk-row"><span>Tie / accent</span>${sw('tie', TIES)}</div>
<div class="ilk-row"><span>Extras</span>${chips('extra', [['glasses', 'Glasses'], ['mustache', 'Moustache'], ['beard:short', 'Short beard'], ['beard:full', 'Full beard'], ['hat:helmet', 'Helmet']])}</div>
<div class="ilk-row"><span>Face</span>${chips('mood', [['happy', 'Smile'], ['calm', 'Calm'], ['plain', 'Plain']])}</div>
<div class="ilk-msg" aria-live="polite"></div>
<div class="ilk-foot"><button type="button" class="ilk-reset">Back to default</button><button type="button" class="ilk-close">Close</button><button type="button" class="ilk-save">Save</button></div>
</div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('.ilk-close')) { closeLooks(); return; }
    if (e.target.closest('.ilk-save')) { saveLook(); return; }
    if (e.target.closest('.ilk-reset')) { cur = defaultLook(curP); paintLook(); msg('Default look shown. Press Save to keep it.'); return; }
    const b = e.target.closest('.ilk-chips button'); if (!b) return; const k = b.parentElement.dataset.k, v = b.dataset.v;
    if (k === 'extra') { if (v === 'glasses' || v === 'mustache') cur[v] = !cur[v]; else { const [f, val] = v.split(':'); cur[f] = cur[f] === val ? null : val; } }
    else if (k === 'skin') cur.skin = SKIN.indexOf(v);
    else if (k === 'hairC') cur.hairC = Object.keys(HAIRC).find((n) => HAIRC[n] === v) || v;
    else cur[k] = v;
    if (k === 'hair' && v === 'hijab' && !cur.hijab) cur.hijab = '#5A4E7A';
    if (k === 'outfit') { delete cur.top; delete cur.bottom; if (v === 'site') { cur.hat = 'helmet'; cur.vest = cur.vest || '#D8F020'; } }
    paintLook();
  });
  d.querySelector('.ilk-who').addEventListener('change', (e) => pickPerson(humans()[+e.target.value]));
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeLooks(); } });
  // preview: its own small renderer
  const can = d.querySelector('canvas'); const r = new T.WebGLRenderer({ canvas: can, antialias: true, alpha: true }); r.outputColorSpace = T.SRGBColorSpace; r.setPixelRatio(1); r.setSize(512, 680, false);
  const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xFFFFFF, 0xC8BFAF, 1.5)); const sun = new T.DirectionalLight(0xFFF4E2, 2.2); sun.position.set(-2, 4, -3); sc.add(sun);
  const cam = new T.PerspectiveCamera(24, 512 / 680, .1, 50); cam.position.set(.6, 1.35, -4.6); cam.lookAt(0, .92, 0);
  const holder = new T.Group(); sc.add(holder); let spin = 0, dragX = null;
  can.addEventListener('pointerdown', (e) => { dragX = e.clientX; can.setPointerCapture(e.pointerId); }); can.addEventListener('pointermove', (e) => { if (dragX == null) return; spin += (e.clientX - dragX) * .01; dragX = e.clientX; }); can.addEventListener('pointerup', () => (dragX = null));
  prev = { r, sc, cam, holder, get spin() { return spin; }, set spin(v) { spin = v; }, raf: 0 };
  return d;
}
function msg(t) { const m = lookUI && lookUI.querySelector('.ilk-side .ilk-msg'); if (m) m.textContent = t || ''; }
function pickPerson(p) { if (!p) return; curP = p; cur = lookOf(p); msg(''); paintLook(); }
function paintLook() {
  const L = cur; const set = (k, on) => lookUI.querySelectorAll(`.ilk-chips[data-k="${k}"] button`).forEach((b) => b.setAttribute('aria-pressed', String(on(b.dataset.v))));
  set('g', (v) => v === (L.g || 'm')); set('hair', (v) => v === L.hair); set('hairC', (v) => v === (HAIRC[L.hairC] || L.hairC)); set('skin', (v) => v === (typeof L.skin === 'string' ? L.skin : SKIN[L.skin ?? 1]));
  set('eyes', (v) => v === L.eyes); set('outfit', (v) => v === L.outfit); set('top', (v) => v === L.top); set('tie', (v) => v === L.tie); set('mood', (v) => v === (L.mood || 'plain'));
  set('extra', (v) => v === 'glasses' ? !!L.glasses : v === 'mustache' ? !!L.mustache : (([f, val]) => L[f] === val)(v.split(':')));
  // rebuild the preview person
  disposeTree(prev.holder.children[0]); const g = person(prev.holder, Object.assign({ name: curP.name }, L)); g.userData.uid = 1; g.userData.act = 'stand';
  cancelAnimationFrame(prev.raf); let last = performance.now();
  const tick = (now) => { if (lookUI.hidden) return; const dt = Math.min(.05, (now - last) / 1000); last = now;  g.rotation.y = -.35 + prev.spin; applyPose(g, dt, now / 1000); prev.r.render(prev.sc, prev.cam); prev.raf = requestAnimationFrame(tick); };
  prev.raf = requestAnimationFrame(tick);
}
function closeLooks() { if (!lookUI) return; lookUI.hidden = true; cancelAnimationFrame(prev.raf); }
function saveLook() {
  const p = curP, k = keyOf(p), d = fdb(); if (!k) { msg('This person has no user key, so the look cannot be saved.'); return; }
  const clean = {}; ['g', 'skin', 'hair', 'hairC', 'eyes', 'outfit', 'top', 'tie', 'glasses', 'mustache', 'beard', 'hat', 'hatC', 'vest', 'hijab', 'mood'].forEach((f) => { if (cur[f] != null && cur[f] !== false && cur[f] !== '') clean[f] = cur[f]; });
  clean.by = (window.ibaOffice3DState().people.find((q) => q.me) || {}).name || ''; clean.at = Date.now();
  LOOKS[k] = clean; rebuildActor(p); msg('Saving…');
  if (!d) { msg('Saved on this screen only (no database connection).'); return; }
  d.ref(`${LOOK_PATH}/${k}`).set(clean).then(() => msg(`Saved. ${p.full || p.name} now looks like this in the office.`), (e) => { console.warn('Office 3D: save look', e); msg('Could not save: ' + (e && e.message ? e.message : 'database error')); });
}
function fdb() { try { if (typeof db !== 'undefined' && db && db.ref) return db; } catch (_) {} try { if (window.db && window.db.ref) return window.db; } catch (_) {} try { return (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null; } catch (_) { return null; } }

// 18.0.0 patch 159 (martin): real faces in the Bot tasks panel. One small renderer of its own, head + shoulders,
// cached per person + look, so it is drawn once and not every frame.
let PORT = null; const PORTC = new Map();
function portrait(name) {
  try {
    if (!T || !OUTP || !renderer) return ''; const st = window.ibaOffice3DState ? window.ibaOffice3DState() : null; const list = st ? st.people || [] : [];
    const p = list.find((q) => q.name === name || (name === '@me' && q.me)); if (!p) return '';
    const o = p.human ? Object.assign({ name: p.name }, lookOf(p)) : Object.assign({ name: p.name, color: new T.Color(p.hair || '#3FD1C1').getHex() }, BOTLOOK[p.name] || {});
    const key = (p.human ? 'h|' : 'b|') + JSON.stringify(o); if (PORTC.has(key)) return PORTC.get(key);
    if (!PORT) { const can = document.createElement('canvas'); const r = new T.WebGLRenderer({ canvas: can, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = T.SRGBColorSpace; r.setPixelRatio(1); r.setSize(160, 160, false);
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xFFFFFF, 0xC8BFAF, 1.6)); const sun = new T.DirectionalLight(0xFFF4E2, 2.0); sun.position.set(-1.5, 3, -3); sc.add(sun);
      const cam = new T.PerspectiveCamera(20, 1, .05, 30); const holder = new T.Group(); sc.add(holder); PORT = { r, sc, cam, holder }; }
    PORT.holder.children.slice().forEach((c) => disposeTree(c));
    const g = p.human ? person(PORT.holder, o) : bot(PORT.holder, o); g.userData.uid = 9999; g.userData.act = 'stand'; g.rotation.y = -.3;
    try { applyPose(g, .016, 0); } catch (_) {}
    g.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(g); const top = bb.max.y, hy = top - (p.human ? .27 : .3);
    PORT.cam.position.set(.32, hy + .06, p.human ? -2.05 : -2.45); PORT.cam.lookAt(0, hy - .04, 0);
    PORT.r.render(PORT.sc, PORT.cam); const url = PORT.r.domElement.toDataURL('image/png'); PORTC.set(key, url); return url;
  } catch (e) { console.warn('Office 3D: portrait', name, e); return ''; }
}
window.ibaOffice3DPortrait = portrait;

// ================= 18.0.0 patch 161 (martin): BUILD MODE (Super Admin only, Clean look) =================
// Click Build: the office pauses (people hidden), a floor grid shows and every piece can be picked.
// Drag = move, R = turn, Delete = remove, arrows = nudge, Ctrl+Z / Ctrl+Y = undo / redo. The left panel adds new pieces
// and paints room floors. Save writes js/iba-office-layout.js straight into the Live folder on this PC (the folder is
// picked once), with the old file copied to Backup\office-layout first. Nothing goes to Firebase.
let BLD = null; const BPIECES = new Map();
const BLD_DRAFT = 'iba-office-build-draft-v1';
const S3 = () => window.ibaOffice3DState();
const isChairP = (o) => o && o.t === undefined;
const ROTF = { N: 'E', E: 'S', S: 'W', W: 'N' };
const FACE_T = new Set(['books', 'shelf', 'cabinet', 'cubby', 'printer', 'kitchen', 'fridge', 'tv', 'sink', 'toilet', 'urinal', 'lowcab', 'board', 'art', 'logo', 'cooler', 'vending', 'drinks', 'adtv', 'sofa']);
const SIZE_T = new Set(['rug', 'tilefloor', 'table', 'sofa', 'books', 'bar', 'kitchen', 'rack', 'board', 'lowcab', 'divider', 'stall', 'sink', 'adtv', 'logo', 'exec', 'tv', 'boxes']);
const PNAME = { desk: 'Work desk', exec: 'Manager desk', counter: 'Counter', table: 'Table', sofa: 'Sofa', books: 'Bookcase', shelf: 'Shelf', cabinet: 'Cabinet', cubby: 'Cubby', printer: 'Printer', kitchen: 'Coffee bar', fridge: 'Fridge', bar: 'High table', rack: 'Store rack', boxes: 'Boxes', tv: 'TV', sink: 'Sink', toilet: 'Toilet', urinal: 'Urinal', stall: 'Toilet wall', plant: 'Plant', rug: 'Rug', tilefloor: 'Tile patch', lowcab: 'Low cabinet', board: 'Whiteboard', art: 'Wall art', logo: 'IBA logo wall', divider: 'Glass divider', cooler: 'Water cooler', vending: 'Snack machine', drinks: 'Drinks fridge', adtv: 'Welcome screen', fountain: 'Info robot (kiosk)' };
function pieceName(o) { if (!isChairP(o)) return PNAME[o.t] || o.t; return o.stool ? 'Bar stool' : o.hidden ? 'Sofa seat' : o.sprite === 'visitor' ? 'Visitor chair' : o.sprite === 'lounge' ? 'Armchair' : 'Work chair'; }
const nid = (i) => 'n' + Date.now().toString(36) + (i || 0);
// the catalog: [label, make(x, y) -> pieces]  (f = furniture, c = chair)
const CATALOG = [
  ['Desks + chairs', [
    ['Work desk + chair', (x, y) => [{ x, y: y + 1, w: 1, d: 1, h: 24, col: '#B07A45', t: 'desk' }, { x, y, dir: 'S', col: '#2E3A4E', sprite: 'work', seat: ['?', 999] }]],
    ['Manager desk + chair', (x, y) => [{ x: x - 1, y: y + 1, w: 3, d: 1, h: 24, col: '#8A5A35', t: 'exec' }, { x, y, dir: 'S', col: '#3A2A20', sprite: 'work', seat: ['?', 999] }]],
    ['Visitor chair', (x, y) => [{ x, y, dir: 'N', col: '#3A3F4A', sprite: 'visitor', noDesk: true }]],
    ['Armchair', (x, y) => [{ x, y, dir: 'S', col: '#69528C', sprite: 'lounge', noDesk: true }]],
    ['Bar stool', (x, y) => [{ x, y, dir: 'S', col: '#5A4632', stool: true, noDesk: true }]],
  ]],
  ['Tables + sofas', [
    ['Sofa (2)', (x, y) => [{ x, y, w: 2, d: 1, h: 16, col: '#7152A3', t: 'sofa', face: 'S' }]],
    ['Sofa (3)', (x, y) => [{ x, y, w: 3, d: 1, h: 16, col: '#7152A3', t: 'sofa', face: 'S' }]],
    ['Small table', (x, y) => [{ x, y, w: 1, d: 1, h: 12, col: '#E9E2D2', t: 'table' }]],
    ['Meeting table', (x, y) => [{ x, y, w: 4, d: 2, h: 14, col: '#8A5A35', t: 'table' }]],
    ['High table', (x, y) => [{ x, y, w: 3, d: 1, h: 30, col: '#5A4632', t: 'bar' }]],
  ]],
  ['Storage', [
    ['Cabinet', (x, y) => [{ x, y, w: 1, d: 1, h: 56, col: '#7A5232', t: 'cabinet', face: 'S' }]],
    ['Bookcase', (x, y) => [{ x, y, w: 2, d: 1, h: 62, col: '#6B4A2E', t: 'books', face: 'S' }]],
    ['Low cabinet', (x, y) => [{ x, y, w: 2, d: 1, h: 30, col: '#6B4A2E', t: 'lowcab', face: 'S' }]],
    ['Shelf', (x, y) => [{ x, y, w: 1, d: 1, h: 56, col: '#7A5232', t: 'shelf', face: 'S' }]],
    ['Store rack', (x, y) => [{ x, y, w: 3, d: 1, h: 64, col: '#5A6470', t: 'rack' }]],
    ['Boxes', (x, y) => [{ x, y, w: 1, d: 1, h: 20, col: '#B08A5A', t: 'boxes' }]],
  ]],
  ['Office', [
    ['Printer', (x, y) => [{ x, y, w: 1, d: 1, h: 30, col: '#2D3550', t: 'printer', face: 'S' }]],
    ['TV', (x, y) => [{ x, y, w: 2, d: 1, h: 40, col: '#2D3550', t: 'tv', face: 'S' }]],
    ['Whiteboard', (x, y) => [{ x, y, w: 2, d: 1, h: 40, col: '#F4F6F8', t: 'board', face: 'S' }]],
    ['Glass divider', (x, y) => [{ x, y: y + .46, w: 2, d: .08, h: 20, col: '#C9D4DE', t: 'divider', block: false }]],
    ['Welcome screen', (x, y) => [{ x, y, w: 3, d: 1, h: 60, col: '#1E2433', t: 'adtv', face: 'S', block: false }]],
  ]],
  ['Pantry + toilet', [
    ['Coffee bar', (x, y) => [{ x, y, w: 3, d: 1, h: 28, col: '#D7D2C6', t: 'kitchen', face: 'S' }]],
    ['Fridge', (x, y) => [{ x, y, w: 1, d: 1, h: 56, col: '#EEF2F7', t: 'fridge', face: 'S' }]],
    ['Water cooler', (x, y) => [{ x, y, w: 1, d: 1, h: 30, col: '#E0E6EC', t: 'cooler', face: 'S' }]],
    ['Snack machine', (x, y) => [{ x, y, w: 1, d: 1, h: 60, col: '#C8323C', t: 'vending', face: 'S' }]],
    ['Drinks fridge', (x, y) => [{ x, y, w: 1, d: 1, h: 60, col: '#2A2F3A', t: 'drinks', face: 'S' }]],
    ['Sink', (x, y) => [{ x, y, w: 1, d: 1, h: 26, col: '#E6EAEE', t: 'sink', face: 'S' }]],
    ['Toilet', (x, y) => [{ x, y, w: 1, d: 1, h: 22, col: '#F4F6F8', t: 'toilet', face: 'N' }]],
    ['Urinal', (x, y) => [{ x, y, w: 1, d: 1, h: 30, col: '#F4F6F8', t: 'urinal', face: 'E' }]],
    ['Toilet wall', (x, y) => [{ x, y, w: .12, d: 2, h: 46, col: '#C9D4DE', t: 'stall', block: false }]],
  ]],
  ['Plants + rugs', [
    ['Plant', (x, y) => [{ x, y, w: 1, d: 1, h: 26, col: '#3E8E4A', t: 'plant' }]],
    ['Rug', (x, y) => [{ x, y, w: 3, d: 2, h: 1, col: '#3C4A66', t: 'rug', block: false }]],
    ['Tile patch', (x, y) => [{ x, y, w: 2, d: 2, h: 1, col: '#DCE7EE', t: 'tilefloor', block: false }]],
  ]],
];
const FLOORS = [['wood', 'Wood'], ['carpet', 'Navy carpet'], ['carpet2', 'Sand carpet'], ['carpet3', 'Teal carpet'], ['tiles', 'Tiles'], ['', 'As the plan (original)']];
function editPiece(parent, state, o, chairP) {
  const h = new T.Group(); const k0 = KIOSK;
  try { if (chairP) chair(h, o); else furniture(h, state, o); } catch (e) { console.warn('Office build: piece', o.t, e); }
  const g = h.children.length ? mergeStatic(h) : new T.Group(); g.userData.piece = o;
  if (KIOSK && KIOSK !== k0) g.add(KIOSK.g);
  parent.add(g); BPIECES.set(o, g); return g;
}
function bldFoot(o) { const w = isChairP(o) ? 1 : Math.max(1, Math.round(o.w)), d = isChairP(o) ? 1 : Math.max(1, Math.round(o.d)); const out = []; for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([Math.floor(o.x) + i, Math.floor(o.y) + j]); return out; }
function bldInside(o, dx = 0, dy = 0) { const L = window.ibaOfficeLayout; return bldFoot(o).every(([x, y]) => { x += dx; y += dy; return x >= 0 && y >= 0 && x < 46 && y < 40 && (!L || L.inOct(x, y)); }); }
function bldAttached(s, o) { // chairs that go with a desk / table / sofa when it moves
  if (isChairP(o) || ['rug', 'tilefloor', 'divider', 'stall', 'art', 'fountain'].includes(o.t)) return [];
  const x0 = Math.floor(o.x), y0 = Math.floor(o.y), x1 = x0 + Math.max(1, Math.round(o.w)), y1 = y0 + Math.max(1, Math.round(o.d)); const inF = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  return s.chairs.filter((c) => { if (c.hidden) return inF(c.x, c.y); const v = DIRV[c.dir] || DIRV.S; return inF(c.x + v[0], c.y + v[1]); });
}
function bldDesksOf(s, list) { const out = new Set(); list.forEach((c) => { if (!isChairP(c)) return; const v = DIRV[c.dir] || DIRV.S; const x = c.x + v[0], y = c.y + v[1];
  s.furniture.forEach((o) => { if ((o.t === 'desk' || o.t === 'exec') && x >= Math.floor(o.x) && x < Math.floor(o.x) + Math.max(1, Math.round(o.w)) && y >= Math.floor(o.y) && y < Math.floor(o.y) + Math.max(1, Math.round(o.d))) out.add(o); }); }); return [...out]; }
function bldSnap() { return JSON.stringify(window.ibaOfficeLayout.now()); }
function bldRestore(txt) { window.ibaOfficeLayout.apply(typeof txt === 'string' ? JSON.parse(txt) : txt); BLD.sel = []; build(S3()); }
function bldChanged() { BLD.dirty = true; clearTimeout(BLD.dt); BLD.dt = setTimeout(() => { try { localStorage.setItem(BLD_DRAFT, JSON.stringify({ at: Date.now(), L: window.ibaOfficeLayout.now() })); } catch (_) {} }, 700); bldPaintUI(); }
function bldPush() { BLD.undo.push(bldSnap()); if (BLD.undo.length > 80) BLD.undo.shift(); BLD.redo = []; }
function bldRefresh(list) { const s = S3(); const all = new Set(list); list.forEach((o) => { if (isChairP(o)) bldDesksOf(s, [o]).forEach((d) => all.add(d)); });
  all.forEach((o) => { const g = BPIECES.get(o); if (g) { disposeTree(g); BPIECES.delete(o); } const alive = isChairP(o) ? s.chairs.includes(o) : s.furniture.includes(o); if (alive && built && built.edit) { const k0 = KIOSK; editPiece(built.edit, s, o, isChairP(o)); if (KIOSK !== k0) built.kiosk = KIOSK; } });
  bldMarks(); }
function bldToast(t, ms = 4200) { const el = BLD && BLD.ui && BLD.ui.querySelector('.ibld-toast'); if (!el) return; el.innerHTML = t; el.hidden = false; clearTimeout(BLD.tt); BLD.tt = setTimeout(() => { el.hidden = true; }, ms); }
function bldTile(e) { const g = groundAt(e); return g ? [Math.floor(g.x + 23), Math.floor(g.z + 20), g] : null; }
function bldPick(e) {
  const r = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
  const hits = built && built.edit ? raycaster.intersectObjects(built.edit.children, true) : [];
  let best = null; for (const h of hits) { let o = h.object; while (o && !o.userData.piece) o = o.parent; if (!o) continue; const p = o.userData.piece; if (!best) best = p; if (p.t !== 'rug' && p.t !== 'tilefloor') { best = p; break; } }
  if (best) return best; const t = bldTile(e); if (!t) return null; const s = S3();
  return s.chairs.find((c) => c.x === t[0] && c.y === t[1] && !c.hidden) || s.furniture.find((o) => o.t !== 'rug' && o.t !== 'tilefloor' && bldFoot(o).some(([x, y]) => x === t[0] && y === t[1])) || s.furniture.find((o) => bldFoot(o).some(([x, y]) => x === t[0] && y === t[1])) || null;
}
function bldSelect(o) { const s = S3(); BLD.sel = o ? [o, ...bldAttached(s, o)] : []; bldMarks(); bldPaintUI(); }
function bldMarks(dx = 0, dy = 0, bad = false) {
  const m = BLD.marks; m.children.slice().forEach((c) => { c.geometry.dispose(); m.remove(c); }); m.position.set(0, 0, 0);
  const col = bad ? 0xE0504A : 0xF3C45B; const fill = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .3, depthWrite: false }), line = new T.LineBasicMaterial({ color: col });
  BLD.sel.forEach((o, i) => { const w = isChairP(o) ? 1 : Math.max(.12, o.w), d = isChairP(o) ? 1 : Math.max(.12, o.d); const [cx, cz] = W((isChairP(o) ? o.x + .5 : o.x + o.w / 2) + dx, (isChairP(o) ? o.y + .5 : o.y + o.d / 2) + dy);
    const pg = new T.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2); const pm = new T.Mesh(pg, fill); pm.position.set(cx, .05, cz); pm.renderOrder = 5; m.add(pm);
    const eg = new T.EdgesGeometry(pg); const lm = new T.LineSegments(eg, line); lm.position.set(cx, .06, cz); m.add(lm);
    if (i === 0) { const ag = new T.ConeGeometry(.14, .3, 12); const ar = new T.Mesh(ag, new T.MeshBasicMaterial({ color: col })); ar.rotation.x = Math.PI; ar.position.set(cx, 2.35, cz); m.add(ar); } });
}
function bldGrid() { const pts = [], L = window.ibaOfficeLayout, seen = new Set(); const seg = (x0, y0, x1, y1) => { const k = x0 + ',' + y0 + ',' + x1 + ',' + y1; if (seen.has(k)) return; seen.add(k); const a = W(x0, y0), b = W(x1, y1); pts.push(a[0], .03, a[1], b[0], .03, b[1]); };
  for (let x = 0; x < 46; x++) for (let y = 0; y < 40; y++) { if (L && !L.inOct(x, y)) continue; seg(x, y, x + 1, y); seg(x, y + 1, x + 1, y + 1); seg(x, y, x, y + 1); seg(x + 1, y, x + 1, y + 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); return new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xC9A24A, transparent: true, opacity: .45, depthWrite: false })); }
function bldAfterBuild() { if (!BLD) return; if (people3) people3.visible = false; if (badges) badges.visible = false; if (rideG) rideG.visible = false; if (!BLD.grid) BLD.grid = bldGrid(); scene.add(BLD.grid, BLD.marks);
  const s = S3(); BLD.sel = BLD.sel.filter((o) => s.furniture.includes(o) || s.chairs.includes(o)); bldMarks(); }
function bldFrame() { if (people3 && people3.visible) people3.visible = false; if (rideG && rideG.visible) rideG.visible = false; }
// ---- changes
function bldMove(dx, dy, quiet) {
  if (!BLD.sel.length || (!dx && !dy)) return false; if (!BLD.sel.every((o) => bldInside(o, dx, dy))) { if (!quiet) bldToast('That spot is outside the building.'); bldRefreshPos(); return false; }
  const s = S3(); const rec = s.rooms.find((r) => r.id === 'rec'); const inRec = (o) => rec && isChairP(o) && o.x >= rec.x && o.x < rec.x + rec.w && o.y >= rec.y && o.y < rec.y + rec.h;
  bldPush(); const before = bldDesksOf(s, BLD.sel); let full = BLD.sel.some(inRec); BLD.sel.forEach((o) => { o.x += dx; o.y += dy; }); full = full || BLD.sel.some(inRec);
  BLD.sel.forEach((o) => { const g = BPIECES.get(o); if (g) g.position.set(0, 0, 0); });
  if (full) build(s); else bldRefresh([...BLD.sel, ...before]); bldChanged(); return true;
}
function bldRefreshPos() { BLD.sel.forEach((o) => { const g = BPIECES.get(o); if (g) g.position.set(0, 0, 0); }); bldMarks(); }
function faceNow(s, o) { if (o.face && DIRV[o.face]) return o.face; const a = o.t === 'sofa' ? faceInSofa(s, o) - Math.PI : faceIn(s, o, 1); const v = [Math.round(Math.sin(a)), Math.round(Math.cos(a))]; return Object.keys(DIRV).find((k) => DIRV[k][0] === v[0] && DIRV[k][1] === v[1]) || 'S'; }
function bldRotate() {
  if (!BLD.sel.length) return; const s = S3(), main = BLD.sel[0]; const cen = (o) => isChairP(o) ? [o.x + .5, o.y + .5] : [o.x + o.w / 2, o.y + o.d / 2]; const [px, py] = cen(main);
  const plan = BLD.sel.map((o) => { const [cx, cy] = cen(o); const nx = px - (cy - py), ny = py + (cx - px); const whole = Number.isInteger(o.x) && Number.isInteger(o.y);
    if (isChairP(o)) return { o, x: Math.round(nx - .5), y: Math.round(ny - .5), dir: ROTF[o.dir || 'S'] || 'S' };
    const w = o.d, d = o.w; let x = nx - w / 2, y = ny - d / 2; if (whole) { x = Math.round(x); y = Math.round(y); } return { o, x, y, w, d, face: FACE_T.has(o.t) ? ROTF[faceNow(s, o)] : o.face }; });
  if (!plan.every((p) => bldInside(Object.assign({}, p.o, p), 0, 0))) { bldToast('No room to turn it here. Move it away from the outside wall first.'); return; }
  bldPush(); const before = bldDesksOf(s, BLD.sel); plan.forEach((p) => { Object.keys(p).forEach((k) => { if (k !== 'o' && p[k] !== undefined) p.o[k] = p[k]; }); });
  if (BLD.sel.some((o) => isChairP(o) && (roomOf(s, o.x, o.y) || {}).id === 'rec')) build(s); else bldRefresh([...BLD.sel, ...before]); bldChanged();
}
function bldDelete() {
  if (!BLD.sel.length) return; const s = S3(); const L = window.ibaOfficeLayout; bldPush(); const before = bldDesksOf(s, BLD.sel);
  const who = BLD.sel.filter(isChairP).map((c) => L.seatOwner(c)).filter(Boolean); const recs = BLD.sel.filter((o) => (o.cabs || []).length).map((o) => o.cabs.map((id) => (L.cabs().find((c) => c.id === id) || {}).title || id).join(', '));
  BLD.sel.forEach((o) => { const arr = isChairP(o) ? s.chairs : s.furniture; const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); });
  const gone = BLD.sel.slice(); BLD.sel = []; bldRefresh([...gone, ...before]); bldChanged();
  bldToast(`Removed ${gone.length > 1 ? gone.length + ' pieces' : esc(pieceName(gone[0]))}.` + (who.length ? ` <b>${esc(who.join(', '))}</b> has no chair now.` : '') + (recs.length ? ` It held <b>${esc(recs.join(', '))}</b>: pick another piece and set "Holds records".` : '') + ' Undo brings it back.', 7000);
}
function bldResize(dw, dd) {
  const o = BLD.sel[0]; if (!o || isChairP(o) || !SIZE_T.has(o.t)) return; const w = o.w >= 1 ? Math.max(1, Math.min(16, o.w + dw)) : o.w, d = o.d >= 1 ? Math.max(1, Math.min(16, o.d + dd)) : o.d;
  if (w === o.w && d === o.d) return; if (!bldInside(Object.assign({}, o, { w, d }))) { bldToast('No room for that size here.'); return; } bldPush(); o.w = w; o.d = d; bldSelect(o); bldRefresh([o]); bldChanged();
}
function bldHolds(id) { const o = BLD.sel[0]; if (!o || isChairP(o)) return; const s = S3(); bldPush(); s.furniture.forEach((f) => { if (f.cabs && f !== o) { f.cabs = f.cabs.filter((c) => c !== id); if (!f.cabs.length) delete f.cabs; } });
  if (id) o.cabs = [id]; else delete o.cabs; bldChanged(); bldToast(id ? 'These records now live in this piece.' : 'This piece holds no records now.'); }
function bldAdd(make) {
  const r = renderer.domElement.getBoundingClientRect(); const g = groundAt({ clientX: r.left + r.width * .55, clientY: r.top + r.height / 2 }); let x = g ? Math.floor(g.x + 23) : 23, y = g ? Math.floor(g.z + 20) : 20;
  x = Math.max(9, Math.min(36, x)); y = Math.max(8, Math.min(30, y)); const s = S3(); const items = make(x, y); items.forEach((o, i) => { o.id = nid(i); });
  bldPush(); items.forEach((o) => (isChairP(o) ? s.chairs : s.furniture).push(o)); items.forEach((o) => editPiece(built.edit, s, o, isChairP(o))); bldRefresh(items.filter((o) => !isChairP(o)));
  BLD.sel = items.filter((o) => !isChairP(o)).concat(items.filter(isChairP)); if (!BLD.sel.length) BLD.sel = items; bldMarks(); bldChanged(); bldToast('Added in the middle of your view. Drag it to its place.');
}
function bldFloor(e) { const t = bldTile(e); if (!t) return; const s = S3(); const r = s.rooms.find((q) => q.id !== 'plaza' && t[0] >= q.x && t[0] < q.x + q.w && t[1] >= q.y && t[1] < q.y + q.h);
  if (!r) { bldToast('The hub floor stays as it is for now. Click a room.'); return; } bldPush(); if (BLD.paint === '-') delete r.mat; else r.mat = BLD.paint; build(s); bldChanged(); bldToast(`${esc(r.name || r.id)}: ${esc((FLOORS.find((f) => f[0] === (BLD.paint === '-' ? '' : BLD.paint)) || [])[1] || '')}`); }
function bldUndo() { if (!BLD || !BLD.undo.length) return; BLD.redo.push(bldSnap()); bldRestore(BLD.undo.pop()); bldChanged(); }
function bldRedo() { if (!BLD || !BLD.redo.length) return; BLD.undo.push(bldSnap()); bldRestore(BLD.redo.pop()); bldChanged(); }
// ---- pointer (called from onDown / onMove / onUp while Build mode is on)
function bldDown(e) { if (e.button !== 0 || BLD.paint) return false; const p = bldPick(e); if (!p) return false; if (!BLD.sel.includes(p) || BLD.sel[0] !== p && isChairP(p)) bldSelect(p); const g = groundAt(e); if (!g) return true;
  BLD.drag = { x0: g.x, z0: g.z, dx: 0, dy: 0, sx: e.clientX, sy: e.clientY, moved: false }; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {} return true; }
function bldMoveP(e) { const d = BLD.drag; if (!d) return false; if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true; if (!d.moved) return true; const g = groundAt(e); if (!g) return true;
  const dx = Math.round(g.x - d.x0), dy = Math.round(g.z - d.z0); if (dx === d.dx && dy === d.dy) return true; d.dx = dx; d.dy = dy;
  BLD.sel.forEach((o) => { const gr = BPIECES.get(o); if (gr) gr.position.set(dx, .04, dy); }); bldMarks(dx, dy, !BLD.sel.every((o) => bldInside(o, dx, dy))); return true; }
function bldUp(e) { const d = BLD.drag; if (!d) return false; BLD.drag = null; if (d.moved && (d.dx || d.dy)) bldMove(d.dx, d.dy); else bldRefreshPos(); return true; }
function bldClick(e) { if (BLD.paint) { bldFloor(e); return; } bldSelect(null); }
function bldKey(e) { if (!BLD) return; const tg = e.target; if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return; const k = e.key;
  if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) bldRedo(); else bldUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); bldRedo(); return; }
  if (k === 'Escape') { if (BLD.paint) { BLD.paint = null; bldPaintUI(); } else bldSelect(null); return; }
  if (!BLD.sel.length) return; if (k === 'r' || k === 'R') { e.preventDefault(); bldRotate(); } else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); bldDelete(); }
  else { const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k]; if (mv) { e.preventDefault(); bldMove(mv[0], mv[1]); } } }
// ---- catalog pictures: each piece drawn once by a small renderer of its own
let THB = null; const THBC = new Map();
function thumb(label, make) {
  if (THBC.has(label)) return THBC.get(label);
  try { if (!THB) { const can = document.createElement('canvas'); const r = new T.WebGLRenderer({ canvas: can, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = T.SRGBColorSpace; r.setPixelRatio(1); r.setSize(120, 96, false);
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xFFFFFF, 0xC8BFAF, 1.6)); const sun = new T.DirectionalLight(0xFFF4E2, 2.2); sun.position.set(-3, 6, -2); sc.add(sun); THB = { r, sc, cam: new T.OrthographicCamera(-1, 1, 1, -1, -50, 50), holder: new T.Group() }; sc.add(THB.holder); }
    THB.holder.children.slice().forEach((c) => disposeTree(c)); const s = S3(); const items = make(23, 20); const k0 = KIOSK;
    items.forEach((o) => { try { if (isChairP(o)) chair(THB.holder, o); else furniture(THB.holder, Object.assign({}, s, { chairs: items.filter(isChairP), furniture: items.filter((q) => !isChairP(q)) }), o); } catch (_) {} });
    KIOSK = k0; THB.holder.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(THB.holder); if (bb.isEmpty()) return ''; const c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()); const R = Math.max(.6, sz.length() * .52);
    const cam = THB.cam; cam.left = -R * 1.25; cam.right = R * 1.25; cam.top = R; cam.bottom = -R; cam.updateProjectionMatrix(); cam.position.set(c.x + 6, c.y + 6, c.z + 6); cam.lookAt(c);
    THB.r.render(THB.sc, cam); const url = THB.r.domElement.toDataURL('image/png'); THBC.set(label, url); return url; } catch (e) { console.warn('Office build: thumb', label, e); return ''; }
}
// ---- the panels
function addBuildButton() {
  const ctrl = document.querySelector('#iba-office .iba-off-ctrl'); if (!ctrl || ctrl.querySelector('.iba-off-build')) return;
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900) return; // a PC tool
  const b = document.createElement('button'); b.type = 'button'; b.className = 'iba-off-build'; b.innerHTML = '&#9874; Build'; b.title = 'Arrange the office: move, turn, add and remove furniture, change floors (only you)';
  b.addEventListener('click', (e) => { e.stopPropagation(); if (BLD) return; bldEnter(); }); const looks = ctrl.querySelector('.iba-off-looks'); ctrl.insertBefore(b, looks || ctrl.querySelector('[data-act="setup"]') || null);
}
function bldEnter() {
  if (BLD || !renderer || !window.ibaOfficeLayout) return; const s = S3();
  BLD = { sel: [], undo: [], redo: [], start: bldSnap(), drag: null, paint: null, ui: null, marks: new T.Group(), grid: null, dirty: false, keep: { elevation, azGoal, zoomMul, focusRoom } };
  stage.classList.add('iba-off-building'); bldUI(); focusRoom = null; zoomMul = .9; elevation = 1.12; build(s); window.addEventListener('keydown', bldKey, true);
  let dr = null; try { dr = JSON.parse(localStorage.getItem(BLD_DRAFT) || 'null'); } catch (_) {}
  const db = BLD.ui.querySelector('[data-b="draft"]'); if (dr && dr.L && db) { db.hidden = false; const t = new Date(dr.at); db.textContent = 'Continue unsaved work (' + t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ')'; BLD.draft = dr.L; }
  bldToast('Build mode: click a piece to pick it, drag to move it. People are paused while you build.', 6000);
}
function bldExit(msg) {
  if (!BLD) return; window.removeEventListener('keydown', bldKey, true); clearTimeout(BLD.dt); const k = BLD.keep; if (BLD.grid) { scene.remove(BLD.grid); BLD.grid.geometry.dispose(); } scene.remove(BLD.marks);
  if (BLD.ui) BLD.ui.remove(); stage.classList.remove('iba-off-building'); BLD = null; BPIECES.clear(); elevation = k.elevation; azGoal = k.azGoal; zoomMul = k.zoomMul; focusRoom = k.focusRoom; build(S3());
  if (msg && window.ibaOfficeLog) try { window.ibaOfficeLog(msg); } catch (_) {}
}
function bldText(L) {
  const line = (o) => '    ' + JSON.stringify(o);
  return '/* js/iba-office-layout.js: the IBA Office arrangement, saved by Build mode (Super Admin) on ' + new Date().toString().replace(/ GMT.*/, '') + '.\n' +
    '   Leave this file out (or delete it) and the office goes back to the original plan in js/iba-office.js. */\n' +
    'window.IBA_OFFICE_LAYOUT = {\n  "v": 1,\n  "savedAt": ' + JSON.stringify(L.savedAt || '') + ',\n  "by": ' + JSON.stringify(L.by || '') + ',\n  "floors": ' + JSON.stringify(L.floors || {}) + ',\n' +
    '  "furn": [\n' + L.furn.map(line).join(',\n') + '\n  ],\n  "chairs": [\n' + L.chairs.map(line).join(',\n') + '\n  ]\n};\n';
}
function idb(op, key, val) { return new Promise((ok) => { try { const rq = indexedDB.open('iba-office-build', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('h'); rq.onerror = () => ok(null);
  rq.onsuccess = () => { try { const tx = rq.result.transaction('h', op === 'get' ? 'readonly' : 'readwrite'); const st = tx.objectStore('h'); const r = op === 'get' ? st.get(key) : op === 'del' ? st.delete(key) : st.put(val, key); r.onsuccess = () => ok(op === 'get' ? r.result : true); r.onerror = () => ok(null); } catch (_) { ok(null); } }; } catch (_) { ok(null); } }); }
async function subDir(h, n) { try { return await h.getDirectoryHandle(n); } catch (_) { return null; } }
async function hasFile(h, n) { try { await h.getFileHandle(n); return true; } catch (_) { return false; } }
async function bldWritePc(text) {
  if (!window.showDirectoryPicker) return null; let h = await idb('get', 'root');
  if (h) { try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' }); if (p !== 'granted') h = null; } catch (_) { h = null; } }
  if (!h) h = await window.showDirectoryPicker({ id: 'iba-office-live', mode: 'readwrite' });
  let js = null, backup = null, label = ''; const live = await subDir(h, 'Live');
  if (live && await subDir(live, 'js')) { js = await subDir(live, 'js'); backup = await subDir(h, 'Backup'); label = h.name + '\\Live\\js'; }
  else if (await subDir(h, 'js') && await hasFile(h, 'index.html')) { js = await subDir(h, 'js'); label = h.name + '\\js'; }
  else if (await hasFile(h, 'iba-office.js')) { js = h; label = h.name; }
  if (!js) { await idb('del', 'root'); return { wrong: h.name }; }
  await idb('put', 'root', h);
  let backed = ''; try { const old = await (await (await js.getFileHandle('iba-office-layout.js')).getFile()).text(); const bk = backup || (live ? null : null);
    if (bk && old) { const d = await bk.getDirectoryHandle('office-layout', { create: true }); const n = new Date(); const stamp = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0') + '_' + String(n.getHours()).padStart(2, '0') + String(n.getMinutes()).padStart(2, '0');
      const f = await d.getFileHandle('iba-office-layout-' + stamp + '.js', { create: true }); const w = await f.createWritable(); await w.write(old); await w.close(); backed = 'Backup\\office-layout\\iba-office-layout-' + stamp + '.js'; } } catch (_) {}
  const fh = await js.getFileHandle('iba-office-layout.js', { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close();
  return { path: label + '\\iba-office-layout.js', backed };
}
function bldDownload(text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' })); a.download = 'iba-office-layout.js'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
async function bldSave() {
  if (!BLD || BLD.saving) return; BLD.saving = true; const btn = BLD.ui.querySelector('[data-b="save"]'); if (btn) btn.textContent = 'Saving…';
  const L = window.ibaOfficeLayout.now(); L.savedAt = new Date().toISOString(); L.by = ((S3().people || []).find((p) => p.me) || {}).name || ''; const text = bldText(L);
  let res = null; try { res = await bldWritePc(text); } catch (e) { if (e && e.name === 'AbortError') { BLD.saving = false; if (btn) btn.textContent = 'Save layout'; bldToast('Not saved yet. Pick the folder (Project_01 or Live) to save into.'); return; } console.warn('Office build: save to PC', e); }
  if (res && res.wrong) { BLD.saving = false; if (btn) btn.textContent = 'Save layout'; bldToast(`"${esc(res.wrong)}" is not the right folder. Pick <b>Project_01</b> (the one with Live and Backup) or <b>Live</b>.`, 8000); return; }
  if (!res) bldDownload(text);
  try { localStorage.setItem('iba-office-layout-last-v1', text); localStorage.removeItem(BLD_DRAFT); } catch (_) {}
  window.IBA_OFFICE_LAYOUT = L; window.ibaOfficeLayout.apply(L);
  bldExit(res ? `Office layout saved to <b>${esc(res.path)}</b>${res.backed ? ' (old one in ' + esc(res.backed) + ')' : ''}. Upload <b>js/iba-office-layout.js</b> to GitHub when you are happy.` : 'Office layout downloaded as <b>iba-office-layout.js</b>. Put it in Live\\js and upload it to GitHub.');
}
function bldUI() {
  const ui = document.createElement('div'); ui.className = 'ibld'; BLD.ui = ui;
  const cats = CATALOG.map(([g, list], gi) => `<h5>${esc(g)}</h5><div class="ibld-grid">${list.map(([n], i) => `<button type="button" data-cat="${gi}.${i}" title="Add ${esc(n)}"><img alt="" data-th="${gi}.${i}"><span>${esc(n)}</span></button>`).join('')}</div>`).join('');
  const floors = FLOORS.map(([k, n]) => `<button type="button" data-floor="${k || '-'}"><i class="ibld-sw ibld-sw-${k || 'orig'}"></i>${esc(n)}</button>`).join('');
  ui.innerHTML = `<div class="ibld-bar"><b>BUILD MODE</b><span>Only you · people paused</span>
      <button type="button" data-b="undo" title="Undo (Ctrl+Z)">&#8630; Undo</button><button type="button" data-b="redo" title="Redo (Ctrl+Y)">&#8631; Redo</button>
      <button type="button" data-b="top" title="Look straight down / normal angle">Top view</button><button type="button" data-b="reset" title="Put everything back as the original plan">Original layout</button>
      <button type="button" data-b="draft" hidden></button><i class="ibld-sp"></i><button type="button" data-b="cancel">Cancel</button><button type="button" data-b="save" class="ibld-pri">Save layout</button></div>
    <div class="ibld-cat"><div class="ibld-tabs"><button type="button" data-tab="add" class="on">Add furniture</button><button type="button" data-tab="floor">Floors</button></div>
      <div class="ibld-pane" data-pane="add">${cats}</div><div class="ibld-pane" data-pane="floor" hidden><p>Pick a floor, then click rooms to paint them. Esc = stop.</p><div class="ibld-floors">${floors}</div></div></div>
    <div class="ibld-sel" hidden></div><div class="ibld-toast" hidden></div><div class="ibld-help">Drag = move · R = turn · Del = remove · arrows = nudge · right-drag = turn the view · wheel = zoom</div>`;
  stage.appendChild(ui);
  ui.addEventListener('pointerdown', (e) => e.stopPropagation()); ui.addEventListener('wheel', (e) => e.stopPropagation());
  ui.addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t || !BLD) return; e.stopPropagation();
    if (t.dataset.tab) { ui.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b === t)); ui.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t.dataset.tab; }); if (t.dataset.tab !== 'floor') BLD.paint = null; bldPaintUI(); return; }
    if (t.dataset.cat) { const [gi, i] = t.dataset.cat.split('.').map(Number); bldAdd(CATALOG[gi][1][i][1]); return; }
    if (t.dataset.floor) { BLD.paint = BLD.paint === t.dataset.floor ? null : t.dataset.floor; bldSelect(null); bldPaintUI(); if (BLD.paint) bldToast('Now click a room to give it this floor.'); return; }
    if (t.dataset.s) { const a = t.dataset.s; if (a === 'turn') bldRotate(); else if (a === 'del') bldDelete(); else if (a === 'w+') bldResize(1, 0); else if (a === 'w-') bldResize(-1, 0); else if (a === 'd+') bldResize(0, 1); else if (a === 'd-') bldResize(0, -1); return; }
    const b = t.dataset.b; if (b === 'undo') bldUndo(); else if (b === 'redo') bldRedo(); else if (b === 'top') { elevation = elevation > 1.2 ? .9 : 1.25; }
    else if (b === 'reset') { bldPush(); bldRestore(window.ibaOfficeLayout.original()); bldChanged(); bldToast('Everything is back as the original plan. Save to keep it, or Undo.'); }
    else if (b === 'draft' && BLD.draft) { bldPush(); bldRestore(BLD.draft); bldChanged(); t.hidden = true; bldToast('Your unsaved work is back.'); }
    else if (b === 'save') bldSave();
    else if (b === 'cancel') { if (BLD.dirty && !t.dataset.sure) { t.dataset.sure = '1'; t.textContent = 'Throw away changes?'; t.classList.add('ibld-warn'); setTimeout(() => { if (t.isConnected) { delete t.dataset.sure; t.textContent = 'Cancel'; t.classList.remove('ibld-warn'); } }, 4000); return; }
      const start = BLD.start; window.ibaOfficeLayout.apply(JSON.parse(start)); try { localStorage.removeItem(BLD_DRAFT); } catch (_) {} bldExit(); } });
  ui.addEventListener('change', (e) => { const t = e.target; if (t.matches('[data-holds]')) bldHolds(t.value); });
  // the catalog pictures: drawn one by one after the panel shows, so opening Build stays quick
  const imgs = [...ui.querySelectorAll('img[data-th]')]; let i = 0; const next = () => { if (!BLD || i >= imgs.length) return; const im = imgs[i++]; const [gi, k] = im.dataset.th.split('.').map(Number); const it = CATALOG[gi][1][k]; const u = thumb(it[0], it[1]); if (u) im.src = u; setTimeout(next, 30); }; setTimeout(next, 200);
  bldPaintUI();
}
function bldPaintUI() {
  if (!BLD || !BLD.ui) return; const ui = BLD.ui; ui.querySelector('[data-b="undo"]').disabled = !BLD.undo.length; ui.querySelector('[data-b="redo"]').disabled = !BLD.redo.length;
  ui.querySelectorAll('[data-floor]').forEach((b) => b.classList.toggle('on', b.dataset.floor === BLD.paint)); stage.classList.toggle('iba-off-painting', !!BLD.paint);
  const box = ui.querySelector('.ibld-sel'); const o = BLD.sel[0]; if (!o) { box.hidden = true; return; } const s = S3(), L = window.ibaOfficeLayout;
  const room = roomOf(s, Math.floor(o.x), Math.floor(o.y)); const who = isChairP(o) ? L.seatOwner(o) : BLD.sel.filter(isChairP).map((c) => L.seatOwner(c)).filter(Boolean).join(', ');
  const more = BLD.sel.length > 1 ? `<small>+ ${BLD.sel.length - 1} chair${BLD.sel.length > 2 ? 's' : ''} that go with it</small>` : '';
  const size = !isChairP(o) && SIZE_T.has(o.t) ? `<div class="ibld-size">${o.w >= 1 ? `<span>Width ${o.w}</span><button type="button" data-s="w-">−</button><button type="button" data-s="w+">+</button>` : ''}${o.d >= 1 ? `<span>Depth ${o.d}</span><button type="button" data-s="d-">−</button><button type="button" data-s="d+">+</button>` : ''}</div>` : '';
  const holds = !isChairP(o) && !['rug', 'tilefloor', 'divider', 'stall', 'plant', 'art', 'fountain'].includes(o.t) ? `<label class="ibld-holds">Holds records <select data-holds><option value="">Nothing</option>${L.cabs().map((c) => `<option value="${esc(c.id)}"${(o.cabs || []).includes(c.id) ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>` : '';
  box.innerHTML = `<h4>${esc(pieceName(o))}</h4><p>${esc(room && room.name ? room.name : room && room.id === 'plaza' ? 'Hub' : '')}${who ? ` · <b>${esc(who)}</b> sits here` : ''}</p>${more}${size}${holds}
    <div class="ibld-acts"><button type="button" data-s="turn">&#10227; Turn <kbd>R</kbd></button><button type="button" data-s="del" class="ibld-del">Remove <kbd>Del</kbd></button></div>`; box.hidden = false;
}

window.ibaOffice3DInit = setup; window.ibaOffice3DFrame = frame; window.ibaOffice3DLooks = openLooks;
})();
