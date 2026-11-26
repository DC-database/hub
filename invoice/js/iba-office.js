/* ==========================================================================
   js/iba-office.js — 18.0.0 patch 150 (3D visual refinement; business/bot logic retained)
   A 3D (isometric) office that shows the REAL invoice system as rooms.
   SUPER ADMIN ONLY until martin announces it: the "Office" menu button is
   added by a small boot in index.html, and this file is only downloaded when
   the Super Admin clicks it. Nothing here runs for anyone else.

   - Rooms: Reception, Scan desk, Sorting, Logistics, your office, CEO, COO,
     Report room, Accounts, Meeting room, Break room, Pantry, Toilet.
   - Each cabinet holds the real records for that step (counted from the
     saved invoice copy window.ibaInvoiceEntriesLoad(): only changed POs are
     downloaded, never the full tree). Click a cabinet = the list; a row's
     "Open" button goes to Invoice Records with that PO searched.
   - People in the rooms come from the user list. The red number over a
     person = open invoices with Attention on that person. Click = the list.
   - Printer (Report room) = the real print basket.
   - Bots (Rina, Sami, Rafi, Ana) walk to their cabinet and say the count,
     then take breaks (pantry, toilet, sofa with the news) when idle.
   - Setup (gear): put people in rooms and pick their colours. Saved in
     system_settings/office_v1 (tiny node).
   - Starts zoomed on your own office (or the whole office: "Whole office"
     remembers it, localStorage iba-office-start-v1). +/- and mouse wheel zoom.
   - Patch 137: Rina collects Reception entries into Under Review, your desk tray sorts
     them (For SRV / Report), Sami sends them. Nothing leaves your desk without Done.
   - When closed, the drawing and timers stop completely.
   ========================================================================== */
(function () {
'use strict';
if (window.ibaOffice && window.ibaOffice.ready) return;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ---------- page ----------
const root = document.createElement('div');
root.id = 'iba-office'; root.hidden = true;
root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'IBA Office');
root.innerHTML = `
<div class="iba-off-top">
   <div class="iba-off-title"><b>IBA</b> OFFICE</div>
  <div class="iba-off-ctrl">
    <button type="button" data-act="zin" title="Zoom in" aria-label="Zoom in">+</button>
    <button type="button" data-act="zout" title="Zoom out" aria-label="Zoom out">&minus;</button>
    <button type="button" data-act="me">My office</button>
    <button type="button" data-act="all">Whole office</button>
   <button type="button" data-act="theme" class="iba-off-theme" title="Switch between Clean · Walnut and Pixel · Crimson noir">Pixel · Crimson noir</button>
    <button type="button" data-act="refresh" title="Read the latest changes">Refresh</button>
    <button type="button" data-act="away" class="iba-off-away" title="Lunch, toilet, meeting or out: the office shows you are away">I'm in</button>
    <button type="button" data-act="setup" title="Put people in rooms">Setup</button>
    <button type="button" data-act="close" class="iba-off-x">Close</button>
  </div>
</div>
<div class="iba-off-body">
  <div class="iba-off-stagewrap">
    <div class="iba-off-stage"><canvas aria-label="Legacy fallback office map"></canvas><div class="iba-off-3d-host" aria-label="Interactive three-dimensional office"></div><div class="iba-off-load">Opening the cabinets…</div></div>
    <form class="iba-off-cmd" autocomplete="off">
      <label for="iba-off-in">COMMAND</label>
      <input id="iba-off-in" placeholder="call Bot 1  ·  Rina find PO for Multilink  ·  find site 175  ·  Sami take a break">
      <button type="submit">Send</button>
    </form>
  </div>
  <aside class="iba-off-side">
    <section><h3>In the cabinets now</h3><div class="iba-off-sum"></div></section>
    <section><h3>Bots</h3><div class="iba-off-team"></div></section>
    <section><h3>Office log</h3><ul class="iba-off-feed"></ul></section>
  </aside>
</div>
<div class="iba-off-pop" hidden><div class="iba-off-box" role="dialog" aria-modal="true"><button type="button" class="iba-off-popx">Close</button><h3></h3><p></p><div class="iba-off-popb"></div></div></div>`;
document.body.appendChild(root);
const Q = (s) => root.querySelector(s);
let officeTheme = 'pixel'; try { officeTheme = localStorage.getItem('iba-office-theme-v1') || 'pixel'; } catch (_) {}
root.dataset.theme = officeTheme;
function setOfficeTheme(theme) {
  officeTheme = theme === 'clean' ? 'clean' : 'pixel'; root.dataset.theme = officeTheme;
  const b = Q('.iba-off-theme'); if (b) b.textContent = officeTheme === 'pixel' ? 'Pixel · Crimson noir' : 'Clean · Walnut';
  try { localStorage.setItem('iba-office-theme-v1', officeTheme); } catch (_) {}
}
setOfficeTheme(officeTheme);
// Generated art atlases: shared across both themes so layout, staff and bots stay identical.
const ART={architecture:null,furniture:null,human:null,bot:null};
function loadOfficeAtlas(key,file){const a=new Image();a.onload=()=>{ART[key]=a;if(staticDone){sc.clearRect(0,0,CW,CH);drawStatic(sc);}};a.onerror=()=>console.warn('Office art atlas unavailable:',file);a.src='design/ai-office/'+file;}
function drawAtlasCell(c,a,col,row,x,y,w,h){if(!a||!a.complete||!a.naturalWidth)return false;const cw=a.naturalWidth/4,ch=a.naturalHeight/4,px=cw*.035,py=ch*.035;c.drawImage(a,col*cw+px,row*ch+py,cw-px*2,ch-py*2,x,y,w,h);return true;}
const GW=46,GH=40,TW=60,TH=30,WALL=118,PART=44;
const OX=GH*TW/2+30,OY=WALL+60;
const CW=(GW+GH)*TW/2+60,CH=(GW+GH)*TH/2+WALL+90;
const cv=Q('canvas'),vctx=cv.getContext('2d');const scene=document.createElement('canvas'),ctx=scene.getContext('2d');
// Patch 148 draws the live Office with WebGL geometry; the generated sprite atlases
// remain in design/ai-office/ as approved art references and are not downloaded here.
const DPR=Math.min(2,window.devicePixelRatio||1);
cv.width=CW*DPR;cv.height=CH*DPR;scene.width=CW*DPR;scene.height=CH*DPR;ctx.scale(DPR,DPR);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const iso=(x,y,z=0)=>[OX+(x-y)*TW/2,OY+(x+y)*TH/2-z];
function poly(c,pts,fill,stroke){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
function shade(hex,k){let r,g,b;const m=/^rgb\((\d+),(\d+),(\d+)\)/.exec(hex);if(m){r=+m[1];g=+m[2];b=+m[3];}else{const n=parseInt(hex.slice(1),16);r=n>>16;g=n>>8&255;b=n&255;}const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return `rgb(${f(r)},${f(g)},${f(b)})`;}
// box: x,y tile origin, w,d size, h height, z base; col base color
function box(c,x,y,w,d,h,col,z=0,opts={}){
  const A=iso(x,y,z+h),B=iso(x+w,y,z+h),C=iso(x+w,y+d,z+h),D=iso(x,y+d,z+h);
  const Cb=iso(x+w,y+d,z),Db=iso(x,y+d,z),Bb=iso(x+w,y,z);
  const a=opts.alpha==null?1:opts.alpha;c.globalAlpha=a;
  poly(c,[D,C,Cb,Db],opts.left||shade(col,-.22));
  poly(c,[B,C,Cb,Bb],opts.right||shade(col,-.38));
  poly(c,[A,B,C,D],opts.top||col);
  if(opts.edge){c.strokeStyle=opts.edge;c.lineWidth=1;c.beginPath();c.moveTo(D[0],D[1]);c.lineTo(C[0],C[1]);c.lineTo(B[0],B[1]);c.stroke();}
  c.globalAlpha=1;}
function shadowAt(c,x,y,rx,ry,a=.28){const p=iso(x,y);c.fillStyle=`rgba(0,0,0,${a})`;c.beginPath();c.ellipse(p[0],p[1],rx,ry,0,0,Math.PI*2);c.fill();}
// ---------- map ----------
// 18.0.0 patch 154 (martin): the building is an OCTAGON (the four corners are cut on the diagonal). The middle is a
// hub with an octagon fountain + the IBA sign and waiting sofas; every room has its own door onto the hub. Walls
// between rooms are solid; glass is used only inside shared rooms (desk pod dividers, the Procurement lead's room).
// Private offices are the same size; the Managing Director has the corner office with sofa + TV.
const OCT = 8; // corner cut (tiles): a tile is inside when its outer corner is on the inside of every diagonal
function inOct(x, y) { return x + y >= OCT && (GW - 1 - x) + y >= OCT && x + (GH - 1 - y) >= OCT && (GW - 1 - x) + (GH - 1 - y) >= OCT; }
const ROOMS=[
  {id:'me',name:'IRWIN',x:0,y:0,w:8,h:9,floor:'#2E4C6E',kind:'carpet'},
  {id:'pantry',name:'Pantry',x:8,y:0,w:6,h:7,floor:'#E9E2D2',kind:'tile'},
  {id:'bot',name:'Bot room',x:14,y:0,w:6,h:7,floor:'#33465C',kind:'carpet'},
  {id:'log',name:'Logistics',x:20,y:0,w:6,h:7,floor:'#4B5D7A',kind:'carpet'},
  {id:'fin',name:'Finance Manager',x:26,y:0,w:6,h:7,floor:'#3E5A4E',kind:'carpet'},
  {id:'coo',name:'COO office',x:32,y:0,w:6,h:7,floor:'#3E4A5E',kind:'carpet'},
  {id:'md',name:'Managing Director',x:38,y:0,w:8,h:12,floor:'#5A4632',kind:'carpet'},
  {id:'meet',name:'Meeting room',x:0,y:9,w:8,h:8,floor:'#B98A58',kind:'wood'},
  {id:'rec',name:'Reception',x:0,y:17,w:8,h:9,floor:'#2F6468',kind:'carpet'},
  {id:'wc',name:'Toilet',x:0,y:26,w:8,h:5,floor:'#DCE7EE',kind:'tile'},
  {id:'pd',name:'Project Director',x:38,y:12,w:8,h:6,floor:'#4E3E5A',kind:'carpet'},
  {id:'spA',name:'MEP Manager',x:38,y:18,w:8,h:7,floor:'#4A4F5E',kind:'carpet'},
  {id:'spB',name:'Office B',x:34,y:25,w:4,h:6,floor:'#4A4F5E',kind:'carpet'},
  {id:'wh',name:'Warehouse',x:38,y:25,w:8,h:6,floor:'#B7BEC6',kind:'tile'},
  {id:'plaza',name:'',x:8,y:7,w:30,h:24,floor:'#243047',kind:'tile'},
  {id:'break',name:'Lounge',x:0,y:31,w:15,h:9,floor:'#7A5A86',kind:'carpet'},
  {id:'acc',name:'Accounts',x:15,y:31,w:7,h:9,floor:'#C9935A',kind:'wood'},
  {id:'hr',name:'Procurement',x:22,y:31,w:8,h:9,floor:'#5A4E3E',kind:'carpet'},
  {id:'site',name:'Site room',x:30,y:31,w:16,h:9,floor:'#A9824F',kind:'wood'},
];
// doors per room side: cells along that side that stay open (2 cells = a door), all onto the hub except Warehouse -> Site
const ROOM_DOORS={
  me:{E:[7,8]}, pantry:{S:[10,11]}, bot:{S:[16,17]}, log:{S:[22,23]}, fin:{S:[28,29]}, coo:{S:[34,35]}, md:{W:[7,8]},
  meet:{E:[15,16]}, rec:{E:[17,18,19,20,21,22,23,24,25]}, wc:{E:[27,28]}, pd:{W:[14,15]}, spA:{W:[21,22]}, spB:{W:[27,28]}, wh:{S:[40,41,42,43]},
  break:{N:[9,10]}, acc:{N:[16,17]}, hr:{N:[26,27]}, site:{N:[30,31]},
};
// Walls between rooms (shared sides once; the outside octagon wall is drawn by the 3D view). g: 1 = solid, 2 = glass.
// Glass only inside rooms: Procurement split into team / lead / architect, Site room split into QS area / Site DC area,
// and the Managing Director's private toilet (solid).
const WALLS=(()=>{const GW0=46,GH0=40,edges=new Map();
  const put=(k,line,c,open,g)=>{const key=k+'|'+line+'|'+c,e=edges.get(key);edges.set(key,{k,line,c,open:open||(e&&e.open),g:g||(e&&e.g)||1});};
  ROOMS.forEach((r)=>{if(r.id==='plaza')return;const d=ROOM_DOORS[r.id]||{};
    for(let x=r.x;x<r.x+r.w;x++){if(r.y>0)put('h',r.y,x,(d.N||[]).includes(x));if(r.y+r.h<GH0)put('h',r.y+r.h,x,(d.S||[]).includes(x));}
    for(let y=r.y;y<r.y+r.h;y++){if(r.x>0)put('v',r.x,y,(d.W||[]).includes(y));if(r.x+r.w<GW0)put('v',r.x+r.w,y,(d.E||[]).includes(y));}});
  for(let x=22;x<30;x++)put('h',37,x,x===24||x===27,2);for(let y=37;y<40;y++)put('v',26,y,false,2); // Procurement: lead | architect
  for(let y=34;y<40;y++)put('v',35,y,false,2); // Site room: QS area | Site DC area (open at the top)
  for(let x=44;x<46;x++)put('h',10,x,x===44);for(let y=10;y<12;y++)put('v',44,y,false); // MD's private toilet (toilet + sink)
  const lines=new Map();edges.forEach((e)=>{const key=e.k+'|'+e.line+'|'+e.g;if(!lines.has(key))lines.set(key,[]);lines.get(key).push(e);});
  const out=[];lines.forEach((list)=>{list.sort((a,b)=>a.c-b.c);let run=null;list.forEach((e)=>{if(run&&e.c===run.end){run.end++;if(e.open)run.doors.push(e.c);}else{if(run)out.push(run);run={k:e.k,line:e.line,g:e.g,start:e.c,end:e.c+1,doors:e.open?[e.c]:[]};}});if(run)out.push(run);});
  return out.map((r)=>r.k==='v'?[r.line,r.start,r.line,r.end,r.g,r.doors]:[r.start,r.line,r.end,r.line,r.g,r.doors]);})();
const blockedEdge=new Set();
function edgeKey(a,b){return a<b?a+'|'+b:b+'|'+a;}
const tk=(x,y)=>x+','+y;
WALLS.forEach(([x1,y1,x2,y2,g,doors])=>{
  if(x1===x2){for(let y=y1;y<y2;y++){if(doors.includes(y))continue;blockedEdge.add(edgeKey(tk(x1-1,y),tk(x1,y)));}}
  else{for(let x=x1;x<x2;x++){if(doors.includes(x))continue;blockedEdge.add(edgeKey(tk(x,y1-1),tk(x,y1)));}}
});
const blocked=new Set();
for(let x=0;x<GW;x++)for(let y=0;y<GH;y++)if(!inOct(x,y))blocked.add(tk(x,y)); // outside the octagon
const FURN=[];
function F(o){FURN.push(o);if(o.block!==false)for(let i=0;i<Math.max(1,Math.round(o.w));i++)for(let j=0;j<Math.max(1,Math.round(o.d));j++)blocked.add(tk(Math.floor(o.x)+i,Math.floor(o.y)+j));}
const PLANT=(x,y)=>F({x,y,w:1,d:1,h:26,col:'#3E8E4A',t:'plant'});
const CAB=(x,y,face,t)=>F({x,y,w:1,d:1,h:56,col:'#7A5232',t:t||'cabinet',face});
const RUG=(x,y,w,d)=>F({x,y,w,d,h:1,col:'#3C4A66',t:'rug',block:false});
 // Private offices (same for everyone): desk + chair facing the door, two visitor chairs, a cabinet, books, plants.
[['fin',26],['coo',32]].forEach(([id,X])=>{F({x:X+2,y:3,w:3,d:1,h:24,col:'#8A5A35',t:'exec'});CAB(X+5,0,'S');F({x:X,y:0,w:1,d:2,h:62,col:'#6B4A2E',t:'books',face:'E'});PLANT(X,6);PLANT(X+5,6);});
 // Project Director + MEP Manager (right side, door on the west): the same set turned to face their door.
[['pd',12],['spA',18]].forEach(([id,Y])=>{F({x:41,y:Y+2,w:1,d:3,h:24,col:'#8A5A35',t:'exec'});CAB(45,Y+1,'W');F({x:45,y:Y+3,w:1,d:2,h:62,col:'#6B4A2E',t:'books',face:'W'});PLANT(38,Y);PLANT(45,Y+5);});
 // IRWIN: the corner office. Desk facing the door, two visitor chairs, printer (Ready to Print), cabinet, books, rug.
RUG(3,3,4,5);F({x:5,y:4,w:1,d:3,h:24,col:'#7A4A2A',t:'exec'});F({x:2,y:7,w:1,d:2,h:62,col:'#6B4A2E',t:'books',face:'E'});F({x:7,y:2,w:1,d:1,h:30,col:'#2D3550',t:'printer',face:'W'});F({x:3,y:6,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});
 // Managing Director: the corner office. Desk, two visitor chairs, sofa facing his own TV over a rug, books, cabinet.
F({x:39,y:4,w:3,d:1,h:24,col:'#7A4A2A',t:'exec'});F({x:38,y:1,w:1,d:2,h:62,col:'#6B4A2E',t:'books',face:'E'});
 // his sofa corner: a 2-seater facing the TV + a single by the door facing the window (L shape), further from the TV
RUG(39,7,4,4);F({x:40,y:7,w:2,d:1,h:16,col:'#7152A3',t:'sofa',face:'S'});F({x:40.5,y:9,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});F({x:40,y:11,w:2,d:1,h:40,col:'#2D3550',t:'tv',face:'N'});
CAB(38,10,'E');PLANT(38,11);
 // his private toilet by the window corner: just a toilet and a sink
F({x:45,y:10,w:1,d:1,h:26,col:'#E6EAEE',t:'sink',face:'W'});F({x:45,y:11,w:1,d:1,h:22,col:'#F4F6F8',t:'toilet',face:'W'});F({x:44,y:10,w:2,d:2,h:1,col:'#DCE7EE',t:'tilefloor',block:false});
 // Pantry: kitchen + fridge on the back wall, a high table with stools on both sides, water cooler; door kept clear.
F({x:8,y:0,w:4,d:1,h:28,col:'#D7D2C6',t:'kitchen',face:'S'});F({x:12,y:0,w:1,d:1,h:56,col:'#EEF2F7',t:'fridge',face:'S'});F({x:9,y:3,w:3,d:1,h:30,col:'#5A4632',t:'bar'});F({x:13,y:5,w:1,d:1,h:30,col:'#E0E6EC',t:'cooler',face:'W'});PLANT(13,0);
 // Bot room: the three bots in a cubicle pod; Sami's cubby on the wall.
CAB(19,0,'S','cubby');PLANT(14,6);PLANT(19,6);
 // Logistics (4): one cubicle pod, a low cabinet on the wall.
F({x:25,y:1,w:1,d:2,h:30,col:'#6B4A2E',t:'lowcab',face:'W'});PLANT(20,6);PLANT(25,6);
 // Meeting room: one table, 12 chairs around it, screen on the wall; the door is at the far end.
F({x:2,y:12,w:4,d:2,h:14,col:'#8A5A35',t:'table'});F({x:3,y:9,w:2,d:1,h:40,col:'#2D3550',t:'tv',face:'S'});PLANT(0,9);PLANT(7,9);PLANT(0,16);
 // Reception: open to the hub. One long desk facing the entrance door, a waiting corner, records shelf, plants.
CAB(6,17,'S','shelf');PLANT(0,17);PLANT(0,25);PLANT(6,25);F({x:2,y:18,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});
 // Toilet: sinks on the back wall, two cubicles, two urinals.
F({x:2,y:26,w:3,d:1,h:26,col:'#E6EAEE',t:'sink',face:'S'});F({x:0,y:28,w:1,d:1,h:30,col:'#F4F6F8',t:'urinal',face:'E'});F({x:0,y:29,w:1,d:1,h:30,col:'#F4F6F8',t:'urinal',face:'E'});
F({x:3,y:30,w:1,d:1,h:22,col:'#F4F6F8',t:'toilet',face:'N'});F({x:5,y:30,w:1,d:1,h:22,col:'#F4F6F8',t:'toilet',face:'N'});
F({x:2,y:29,w:.12,d:2,h:46,col:'#C9D4DE',t:'stall',block:false});F({x:4,y:29,w:.12,d:2,h:46,col:'#C9D4DE',t:'stall',block:false});F({x:6,y:29,w:.12,d:2,h:46,col:'#C9D4DE',t:'stall',block:false});
 // Lounge (corner, the room for later): a U of sofas round a coffee table open to the TV, a reading corner, big plants.
RUG(8,32,7,6);F({x:9,y:34,w:1,d:3,h:16,col:'#7C5CB0',t:'sofa',face:'E',block:false});F({x:11,y:33,w:3,d:1,h:16,col:'#7152A3',t:'sofa',face:'S',block:false});F({x:11,y:37,w:3,d:1,h:16,col:'#7152A3',t:'sofa',face:'N',block:false});
F({x:12,y:35,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});F({x:14,y:35,w:1,d:1,h:40,col:'#2D3550',t:'tv',face:'W'});F({x:4,y:34,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});
PLANT(1,32);PLANT(6,32);PLANT(14,32);PLANT(14,39);PLANT(8,39);PLANT(6,37);
 // Accounts (4): one pod of four desks (glass dividers), the six cabinets on one wall (incl. the reports shelf).
[32,33,34,35,36].forEach((y)=>CAB(21,y,'W'));F({x:21,y:37,w:1,d:1,h:62,col:'#6B4A2E',t:'books',face:'W'});
 // their sofa corner by the window: a 2-seater on the window side + two singles = a U round a small table
F({x:16,y:39,w:2,d:1,h:16,col:'#7152A3',t:'sofa',face:'N',block:false});F({x:16.5,y:38,w:1,d:1,h:12,col:'#E9E2D2',t:'table'});PLANT(15,32);PLANT(20,39);
 // Procurement: three areas behind glass: the team of 3 (pod, cabinets on the wall), the lead (own cabinet), the architect.
CAB(23,31,'S');CAB(24,31,'S');CAB(25,31,'S');CAB(22,38,'E');CAB(29,39,'W');PLANT(29,32);PLANT(22,33);
 // Site room: QS area (pod of 4 + the head draftsman) | Site DC area (two pods of 4, whiteboard); opens to the Warehouse.
[32,33,34,35,36].forEach((x)=>CAB(x,31,'S'));[31,32,33].forEach((x)=>CAB(x,39,'N'));F({x:37,y:31,w:3,d:1,h:40,col:'#F4F6F8',t:'board',face:'S'});PLANT(44,32);PLANT(38,38);PLANT(42,34);PLANT(36,39);
 // Warehouse: racks + boxes.
F({x:45,y:25,w:1,d:5,h:64,col:'#5A6470',t:'rack'});F({x:38,y:25,w:2,d:1,h:20,col:'#B08A5A',t:'boxes'});
 // Office B.
F({x:35,y:27,w:2,d:1,h:24,col:'#8A5A35',t:'exec'});CAB(37,25,'S');PLANT(37,30);
 // Finishing touches: art frames on the walls, water dispensers in the hub corners, IBA logo walls in Reception + Lounge.
const FRAME=(x,y,face,k)=>F({x,y,w:1,d:1,h:1,col:'#C9A24A',t:'art',face,k,block:false});
 // (art frames removed 26-Nov per martin; FRAME helper kept for later)
[[36,7,'S'],[8,30,'E'],[33,30,'N']].forEach(([x,y,f])=>F({x,y,w:1,d:1,h:30,col:'#E0E6EC',t:'cooler',face:f})); // water dispensers
 // snack vending machine + glass-door drinks fridge on the hub wall by the pantry
F({x:13,y:7,w:1,d:1,h:60,col:'#C8323C',t:'vending',face:'S'});F({x:14,y:7,w:1,d:1,h:60,col:'#2A2F3A',t:'drinks',face:'S'});
F({x:2,y:17,w:3,d:1,h:60,col:'#1E2433',t:'adtv',face:'S',block:false});F({x:2,y:31,w:3,d:1,h:60,col:'#1E2433',t:'logo',face:'S'});
 // The hub: octagon fountain with the IBA sign, long waiting sofas with small tables, big plants.
F({x:20,y:16,w:7,d:7,h:20,col:'#2D3550',t:'fountain'});
F({x:21,y:13,w:5,d:1,h:16,col:'#7152A3',t:'sofa',face:'S'});F({x:21,y:25,w:5,d:1,h:16,col:'#7152A3',t:'sofa',face:'N'});
F({x:16,y:17,w:1,d:5,h:16,col:'#7152A3',t:'sofa',face:'E'});F({x:30,y:17,w:1,d:5,h:16,col:'#7152A3',t:'sofa',face:'W'});
[[19,13],[27,13],[19,25],[27,25],[16,15],[16,23],[30,15],[30,23]].forEach(([x,y])=>F({x,y,w:1,d:1,h:12,col:'#E9E2D2',t:'table'}));
[[17,13],[29,13],[17,25],[29,25],[9,8],[36,8],[9,29],[36,12]].forEach(([x,y])=>PLANT(x,y));
// ---------- path finding ----------
function walkable(x,y){return x>=0&&y>=0&&x<GW&&y<GH&&!blocked.has(tk(x,y));}
function findPath(from,to){const s=tk(from[0],from[1]),g=tk(to[0],to[1]);if(s===g)return [];
  const q=[from],prev=new Map([[s,null]]);
  while(q.length){const [x,y]=q.shift();const k=tk(x,y);if(k===g)break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=tk(nx,ny);
      if(prev.has(nk))continue;if(!walkable(nx,ny)&&nk!==g)continue;if(blockedEdge.has(edgeKey(k,nk)))continue;prev.set(nk,k);q.push([nx,ny]);}}
  if(!prev.has(g))return [to];const out=[];let k=g;while(k&&k!==s){out.unshift(k.split(',').map(Number));k=prev.get(k);}return out;}
// ---------- static layer ----------
const st=document.createElement('canvas');st.width=CW*DPR;st.height=CH*DPR;const sc=st.getContext('2d');sc.scale(DPR,DPR);
function drawStatic(c){
  // floors
  ROOMS.forEach(r=>{for(let x=r.x;x<r.x+r.w;x++)for(let y=r.y;y<r.y+r.h;y++){
    const p=[iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)];let col=r.floor;
    if(r.kind==='wood'){col=shade(r.floor,((x*7+y*13)%5-2)*.025);}
    if(r.kind==='tile'){col=((x+y)%2)?r.floor:shade(r.floor,-.06);}
    if(r.kind==='carpet'){col=shade(r.floor,((x+y)%2)*.03);}
    const artCol=root.dataset.theme==='pixel'?(r.id==='plaza'?1:r.kind==='wood'?0:r.kind==='tile'?2:3):(r.kind==='wood'?0:r.id==='plaza'||r.kind==='tile'?2:3);
    const center=iso(x+.5,y+.5,0);
    if(!drawAtlasCell(c,ART.architecture,artCol,0,center[0]-TW/2-2,center[1]-TH/2-3,TW+4,TH+6))poly(c,p,col);
    if(r.kind==='wood'){c.strokeStyle='rgba(90,55,25,.18)';c.lineWidth=1;for(let k=1;k<3;k++){const a=iso(x+k/3,y),b=iso(x+k/3,y+1);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}}
    if(r.kind==='tile'){c.strokeStyle='rgba(0,0,0,.06)';c.stroke();}
  }
  if(r.gold||r.kind==='carpet'){const p=[iso(r.x+.15,r.y+.15),iso(r.x+r.w-.15,r.y+.15),iso(r.x+r.w-.15,r.y+r.h-.15),iso(r.x+.15,r.y+r.h-.15)];c.strokeStyle=r.gold?'rgba(227,201,138,.85)':'rgba(255,255,255,.14)';c.lineWidth=r.gold?2:1.2;c.beginPath();p.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();c.stroke();}
  });
  // back walls
  const wl='#E7DDCB',wr='#D9CDB7';
  poly(c,[iso(0,0,WALL),iso(GW,0,WALL),iso(GW,0),iso(0,0)],wl);
  poly(c,[iso(0,0,WALL),iso(0,GH,WALL),iso(0,GH),iso(0,0)],wr);
  // wall tops
  poly(c,[iso(0,0,WALL),iso(GW,0,WALL),iso(GW,-.25,WALL),iso(-.25,-.25,WALL)],'#F5EFE3');
  poly(c,[iso(0,0,WALL),iso(0,GH,WALL),iso(-.25,GH,WALL),iso(-.25,-.25,WALL)],'#F5EFE3');
  // baseboards
  poly(c,[iso(0,0,8),iso(GW,0,8),iso(GW,0),iso(0,0)],'#8A6A4A');
  poly(c,[iso(0,0,8),iso(0,GH,8),iso(0,GH),iso(0,0)],'#7A5C40');
  // windows on back wall (x along)
  [0.7,7.6,12.4,15.3,20.2,25.2,30.4,33.2,37.6,41.2,43.7].forEach(x=>winX(c,x,1.3));
  [9.6,16.4,25.4,33.2].forEach(y=>winY(c,y,1.6));
  // entrance door on left wall at y=3
  poly(c,[iso(0,2.6,70),iso(0,3.6,70),iso(0,3.6,0),iso(0,2.6,0)],'#7A4E2B');poly(c,[iso(0,2.7,64),iso(0,3.5,64),iso(0,3.5,0),iso(0,2.7,0)],'#9C6636');
  poly(c,[iso(0,3.35,34),iso(0,3.42,34),iso(0,3.42,30),iso(0,3.35,30)],'#E3C98A');
  {const q=iso(1.3,4.2,2);c.save();c.translate(q[0],q[1]);c.fillStyle='rgba(8,13,24,.82)';rr(c,-74,-10,148,20,7);c.fill();c.fillStyle='#7df4ed';c.font='800 9px Inter,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('MAIN ENTRANCE / EXIT',0,0);c.restore();}
  // posters / boards
  posterX(c,3.0,'#2B3A55',null,'IBA');posterX(c,17.2,'#F4F1EA',ctxChart);
  // wall clock drawn dynamically
}
function winX(c,x,w){if(ART.architecture&&ART.architecture.complete){const p=iso(x+w/2,0,0),dw=w*TW+16,dh=142;drawAtlasCell(c,ART.architecture,2,1,p[0]-dw/2,p[1]-dh,dw,dh);return;}const z1=40,z2=96;poly(c,[iso(x,0,z2),iso(x+w,0,z2),iso(x+w,0,z1),iso(x,0,z1)],'#6E4A2A');
  const g=c.createLinearGradient(...iso(x,0,z2),...iso(x,0,z1));g.addColorStop(0,'#8FD3F5');g.addColorStop(1,'#D8F1FC');
  poly(c,[iso(x+.08,0,z2-4),iso(x+w-.08,0,z2-4),iso(x+w-.08,0,z1+4),iso(x+.08,0,z1+4)],g);
  poly(c,[iso(x+w/2-.03,0,z2-4),iso(x+w/2+.03,0,z2-4),iso(x+w/2+.03,0,z1+4),iso(x+w/2-.03,0,z1+4)],'#6E4A2A');
  poly(c,[iso(x+.2,0,z2-10),iso(x+.5,0,z2-10),iso(x+.3,0,z1+14),iso(x+.15,0,z1+14)],'rgba(255,255,255,.45)');}
function winY(c,y,w){const z1=40,z2=96;poly(c,[iso(0,y,z2),iso(0,y+w,z2),iso(0,y+w,z1),iso(0,y,z1)],'#6E4A2A');
  const g=c.createLinearGradient(...iso(0,y,z2),...iso(0,y,z1));g.addColorStop(0,'#7EC4E8');g.addColorStop(1,'#CDEBF8');
  poly(c,[iso(0,y+.08,z2-4),iso(0,y+w-.08,z2-4),iso(0,y+w-.08,z1+4),iso(0,y+.08,z1+4)],g);
  poly(c,[iso(0,y+w/2-.03,z2-4),iso(0,y+w/2+.03,z2-4),iso(0,y+w/2+.03,z1+4),iso(0,y+w/2-.03,z1+4)],'#6E4A2A');}
function ctxChart(c,x){[[.2,14],[.45,22],[.7,18],[.95,30]].forEach(([o,h])=>poly(c,[iso(x+o,0,48+h),iso(x+o+.15,0,48+h),iso(x+o+.15,0,48),iso(x+o,0,48)],'#4FB286'));}
function posterX(c,x,col,fn,label){poly(c,[iso(x,0,90),iso(x+1.3,0,90),iso(x+1.3,0,44),iso(x,0,44)],'#6E4A2A');poly(c,[iso(x+.06,0,87),iso(x+1.24,0,87),iso(x+1.24,0,47),iso(x+.06,0,47)],col);if(fn)fn(c,x);if(label){const p=iso(x+.65,0,67);c.save();c.translate(p[0],p[1]);c.transform(1,.5,0,1,0,0);c.fillStyle='#E3C98A';c.font='800 13px Inter,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,0,0);c.restore();}}
// ---------- furniture drawing ----------
function drawFurn(c,o,t){const z=o.z||0;
  const map={desk:[0,0],exec:[1,0],counter:[2,0],table:o.w>=4?[3,0]:[2,2],shelf:[2,1],books:[2,1],cabinet:[2,1],cubby:[3,1],sofa:o.w>=2.5?[0,2]:[1,2],printer:[0,3],kitchen:[1,3],rack:[2,3],plant:[3,3]};
  const sprite=map[o.t];if(sprite&&ART.furniture&&ART.furniture.complete){const p=iso(o.x+o.w/2,o.y+o.d/2,z),dw=Math.max(54,(o.w+o.d)*TW*.58),dh=Math.max(68,(o.h||20)*1.15+(o.w+o.d)*TH*.34);drawAtlasCell(c,ART.furniture,sprite[0],sprite[1],p[0]-dw/2,p[1]-dh+5,dw,dh);return;}
  shadowAt(c,o.x+o.w/2,o.y+o.d/2+.1,o.w*TW*.36,o.d*TH*.5,.16);
  switch(o.t){
    case 'plant':{box(c,o.x+.28,o.y+.28,.44,.44,16,'#B5502B');const p=iso(o.x+.5,o.y+.5,16);const leaf=(dx,dy,r,col)=>{c.fillStyle=col;c.beginPath();c.ellipse(p[0]+dx,p[1]+dy,r,r*.8,0,0,Math.PI*2);c.fill();};
      leaf(0,-14,12,'#2F7A40');leaf(-8,-8,9,'#3E8E4A');leaf(8,-9,9,'#3E8E4A');leaf(0,-24,9,'#4FB286');leaf(-5,-19,6,'#5FC596');break;}
    case 'desk':case 'counter':case 'exec':{box(c,o.x,o.y,o.w,o.d,o.h,o.col,z,{edge:'rgba(255,255,255,.12)'});
      if(o.t!=='counter'||o.pc){monitor(c,o.x+o.w/2-.35,o.y+.15,o.h);}
      if(o.t==='exec'){box(c,o.x+.25,o.y+.35,.6,.45,4,'#3A2E24',o.h);box(c,o.x+o.w-.8,o.y+.4,.5,.35,2,'#F4F1EA',o.h);}
      break;}
    case 'scanner':box(c,o.x,o.y,o.w,o.d,o.h,o.col,z);box(c,o.x+.1,o.y+.1,o.w-.2,.2,2,'#2B3A55',z+o.h);{const p=iso(o.x+o.w-.15,o.y+o.d-.1,z+8);c.fillStyle='#3DDC97';c.beginPath();c.arc(p[0],p[1],2,0,7);c.fill();}break;
    case 'shelf':case 'books':case 'cabinet':{box(c,o.x,o.y,o.w,o.d,o.h,o.col);
      const cols=['#C84B45','#3FD1C1','#E3C98A','#5AA9FF','#A47CF3','#3DDC97'];for(let r=0;r<3;r++)for(let i=0;i<o.w*4;i++){const bx=o.x+.1+i*.22;if(bx>o.x+o.w-.2)break;box(c,bx,o.y+o.d-.05,.16,.05,12,cols[(i+r)%6],12+r*16);}break;}
    case 'cubby':{box(c,o.x,o.y,o.w,o.d,o.h,o.col);break;}
    case 'cooler':box(c,o.x+.25,o.y+.25,.5,.5,22,'#E0E6EC');box(c,o.x+.3,o.y+.3,.4,.4,16,'#9FD8F0',22,{alpha:.85});break;
    case 'sofa':box(c,o.x,o.y,o.w,o.d,o.h,o.col);box(c,o.x,o.y,o.w,.3,o.h+14,shade(o.col,-.1));box(c,o.x,o.y,.25,o.d,o.h+8,shade(o.col,-.05));box(c,o.x+o.w-.25,o.y,.25,o.d,o.h+8,shade(o.col,-.05));break;
    case 'table':box(c,o.x,o.y,o.w,o.d,o.h,o.col,0,{edge:'rgba(255,255,255,.2)'});break;
    case 'tv':box(c,o.x+.1,o.y+.2,.3,.6,o.h,'#1A1C26');poly(c,[iso(o.x+.4,o.y+.15,o.h-2),iso(o.x+.4,o.y+.85,o.h-2),iso(o.x+.4,o.y+.85,12),iso(o.x+.4,o.y+.15,12)],'#2B5A8A');break;
    case 'printer':box(c,o.x+.1,o.y+.1,.8,.8,o.h,o.col);box(c,o.x+.25,o.y+.2,.5,.3,3,'#F4F1EA',o.h);break;
    case 'kitchen':box(c,o.x,o.y,o.w,o.d,o.h,o.col);box(c,o.x,o.y,o.w,o.d,3,'#9AA6B2',o.h);box(c,o.x+1.2,o.y+.2,.6,.5,10,'#3A3F48',o.h+3);break;
    case 'fridge':box(c,o.x+.1,o.y+.1,.8,.8,o.h,o.col,0,{edge:'rgba(0,0,0,.15)'});break;
    case 'stall':box(c,o.x,o.y,o.w,o.d,o.h,o.col,0,{edge:'rgba(0,0,0,.12)'});break;
    case 'bar':box(c,o.x,o.y+.3,o.w,o.d-.3,o.h-4,shade(o.col,-.15));box(c,o.x,o.y,o.w,o.d,4,'#3A2E24',o.h-4,{edge:'rgba(255,255,255,.15)'});[.3,1.4,2.5].forEach((dx)=>box(c,o.x+dx,o.y+.25,.18,.18,7,'#F4F1EA',o.h));break;
    case 'rack':{box(c,o.x,o.y,o.w,o.d,4,o.col);for(let k=1;k<=3;k++)box(c,o.x,o.y,o.w,o.d,3,o.col,k*20);box(c,o.x,o.y,.08,.08,o.h,o.col);box(c,o.x+o.w-.08,o.y,.08,.08,o.h,o.col);box(c,o.x,o.y+o.d-.08,.08,.08,o.h,o.col);box(c,o.x+o.w-.08,o.y+o.d-.08,.08,.08,o.h,o.col);
      const bc=['#B08A5A','#C9A06A','#9C7A4C'];for(let k=0;k<3;k++)for(let j=0;j<o.d;j++)box(c,o.x+.15,o.y+j+.15,.7,.7,14,bc[(j+k)%3],4+k*20,{edge:'rgba(0,0,0,.12)'});break;}
    case 'boxes':box(c,o.x+.1,o.y+.1,.8,.8,12,o.col,0,{edge:'rgba(0,0,0,.15)'});box(c,o.x+.2,o.y+.2,.6,.6,10,shade(o.col,.1),12,{edge:'rgba(0,0,0,.15)'});break;
    case 'sink':box(c,o.x,o.y,o.w,o.d,o.h,o.col);[.25,1.25].forEach((dx)=>{box(c,o.x+dx,o.y+.25,.5,.5,2,'#BFD7E6',o.h);box(c,o.x+dx+.2,o.y+.08,.1,.1,8,'#9AA6B2',o.h);});break;
    case 'urinal':box(c,o.x,o.y+.3,.1,.4,o.h+10,'#D9E1E8');box(c,o.x+.08,o.y+.3,.22,.4,22,o.col,14,{edge:'rgba(0,0,0,.12)'});break;
    case 'toilet':box(c,o.x+.3,o.y+.08,.4,.2,o.h+8,'#E6EAEE');box(c,o.x+.28,o.y+.3,.44,.5,o.h-8,o.col,0,{edge:'rgba(0,0,0,.12)'});{const q=iso(o.x+.5,o.y+.55,o.h-8);c.fillStyle='#BFD7E6';c.beginPath();c.ellipse(q[0],q[1],7,3.5,0,0,7);c.fill();}break;
    default:box(c,o.x,o.y,o.w,o.d,o.h,o.col);
  }}
function monitor(c,x,y,deskH){box(c,x+.3,y+.25,.1,.1,8,'#2A2D36',deskH);box(c,x,y,.7,.12,26,'#1A1C26',deskH+8);
  poly(c,[iso(x+.06,y+.12,deskH+31),iso(x+.64,y+.12,deskH+31),iso(x+.64,y+.12,deskH+12),iso(x+.06,y+.12,deskH+12)],'#2F5D8A');
  poly(c,[iso(x+.1,y+.12,deskH+27),iso(x+.4,y+.12,deskH+27),iso(x+.4,y+.12,deskH+24),iso(x+.1,y+.12,deskH+24)],'rgba(63,209,193,.9)');}
// ---------- partitions (dynamic sort) ----------
const WALLOBJ=[];
WALLS.forEach(([x1,y1,x2,y2,g,doors])=>{
  if(x1===x2){for(let y=y1;y<y2;y++){if(doors.includes(y))continue;WALLOBJ.push({x:x1-.06,y:y,w:.12,d:1,h:PART,g});}}
  else{for(let x=x1;x<x2;x++){if(doors.includes(x))continue;WALLOBJ.push({x:x,y:y1-.06,w:1,d:.12,h:PART,g});}}
});
function drawWall(c,o){if(o.frame){box(c,o.x,o.y,o.w,o.d,o.h,'#6B4A2E',o.z||0);return;}if(o.g){box(c,o.x,o.y,o.w,o.d,o.h,'#BFE3F2',0,{alpha:.35,top:'rgba(230,248,255,.9)'});box(c,o.x,o.y,o.w,o.d,4,'#8AA3B5');box(c,o.x,o.y,o.w,o.d,3,'#8AA3B5',o.h-3);}
  else box(c,o.x,o.y,o.w,o.d,o.h,'#EFE6D4',0,{top:'#FBF7EE'});}
function go(p,to){return new Promise(res=>{const path=findPath([Math.round(p.x),Math.round(p.y)],to);if(reduce||!path.length){p.x=to[0];p.y=to[1];p.path=[];return setTimeout(res,reduce?150:0);}p.path=path;p.res=res;});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function say(p,txt,ms=2600){p.bubble=txt;p.bubbleT=performance.now()+ms;}
function drawLegacyPerson(c,p,t){if(p.hidden)return;const [sx,sy]=iso(p.x+.5,p.y+.5);const walking=p.path.length>0;
  const bob=walking?Math.abs(Math.sin(t/110))*3:Math.sin(t/700+p.x)*0.8;const s=p.human?1:1;
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(sx,sy,13,6,0,0,7);c.fill();
  const st=walking?null:seatAt(p);const seated=!!st;const back=!!(st&&(st.dir==='N'||st.dir==='W'));
  c.save();c.translate(sx,sy-bob+(seated?(st.stool?2:8):0));if(st?(st.dir==='W'||st.dir==='S'?false:st.dir==='E'):p.face<0)c.scale(-1,1);
  // legs
  const lk=walking?Math.sin(t/110)*3:0;c.fillStyle=p.human?'#2A2F3A':'#D7DEE8';
  if(!seated){c.fillRect(-6,-12+Math.max(0,lk),4,12-Math.max(0,lk));c.fillRect(2,-12+Math.max(0,-lk),4,12-Math.max(0,-lk));
  c.fillStyle=p.human?'#1A1C22':shade(p.suit,-.3);c.fillRect(-7,-2,6,3);c.fillRect(1,-2,6,3);}
  // body
  c.fillStyle=p.suit;rr(c,-9,-30,18,20,6);c.fill();
  if(p.human){c.fillStyle='#FFFFFF';c.beginPath();c.moveTo(-3,-30);c.lineTo(3,-30);c.lineTo(0,-24);c.fill();}
  else{c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(0,-21,3,0,7);c.fill();c.fillStyle=p.hair;c.beginPath();c.arc(0,-21,1.8,0,7);c.fill();}
  // arms
  c.fillStyle=p.suit;const ak=walking?Math.sin(t/110)*4:0;rr(c,-13,-29+ak,5,13,2.5);c.fill();rr(c,8,-29-ak,5,13,2.5);c.fill();
  c.fillStyle=p.human?p.skin:'#EEF2F7';c.beginPath();c.arc(-10.5,-15+ak,2.6,0,7);c.arc(10.5,-15-ak,2.6,0,7);c.fill();
  // head
  const hy=-46;c.fillStyle=p.human?p.skin:'#F1F5FA';c.beginPath();c.ellipse(0,hy,15,14,0,0,7);c.fill();
  if(!p.human){c.fillStyle=p.hair;c.beginPath();c.arc(-15,hy+1,4,0,7);c.arc(15,hy+1,4,0,7);c.fill();}
  // hair
  c.fillStyle=p.hair;
  if(p.human){c.beginPath();c.ellipse(0,hy-6,16,10,0,Math.PI,0);c.fill();c.beginPath();c.moveTo(-15,hy-4);c.lineTo(-11,hy+4);c.lineTo(-6,hy-4);c.lineTo(0,hy+1);c.lineTo(6,hy-5);c.lineTo(12,hy+2);c.lineTo(15,hy-4);c.closePath();c.fill();
    if(p.beard){c.fillStyle=p.hair;c.beginPath();c.ellipse(0,hy+10,9,4,0,0,Math.PI);c.fill();}}
  else if(p.style==='spike'){c.beginPath();c.moveTo(-15,hy-2);for(let i=0;i<=6;i++){const a=Math.PI+i*Math.PI/6;c.lineTo(Math.cos(a)*(i%2?21:15),hy-4+Math.sin(a)*(i%2?20:13));}c.closePath();c.fill();c.beginPath();c.ellipse(0,hy-6,15,8,0,Math.PI,0);c.fill();}
  else if(p.style==='bob'){c.beginPath();c.ellipse(0,hy-4,17,13,0,Math.PI*1.02,Math.PI*-0.02);c.fill();c.fillRect(-17,hy-4,6,14);c.fillRect(11,hy-4,6,14);c.beginPath();c.moveTo(-14,hy-4);c.quadraticCurveTo(0,hy+2,14,hy-4);c.lineTo(14,hy-10);c.lineTo(-14,hy-10);c.fill();}
  else{c.beginPath();c.ellipse(0,hy-5,16,10,0,Math.PI,0);c.fill();c.beginPath();c.ellipse(-17,hy+2,4,9,.3,0,7);c.ellipse(17,hy+2,4,9,-.3,0,7);c.fill();c.beginPath();c.moveTo(-14,hy-4);c.quadraticCurveTo(-4,hy+3,2,hy-6);c.quadraticCurveTo(8,hy+1,14,hy-4);c.lineTo(14,hy-9);c.lineTo(-14,hy-9);c.fill();}
  // antenna for bots
  if(!p.human){c.strokeStyle=p.hair;c.lineWidth=2;c.beginPath();c.moveTo(4,hy-14);c.lineTo(7,hy-22);c.stroke();c.fillStyle=p.hair;c.beginPath();c.arc(7,hy-23,2.6,0,7);c.fill();}
  if(back){c.fillStyle=p.human?p.hair:shade(p.hair,-.1);c.beginPath();c.ellipse(0,hy-1,p.human?15.5:13,p.human?14:11,0,0,7);c.fill();if(p.human){c.fillStyle=p.skin;c.fillRect(-4,hy+11,8,4);}}
  if(!back){
  // eyes (anime)
  const blink=(Math.floor(t/90)+Math.floor(p.home[0]*13))%48===0;
  if(blink){c.strokeStyle='#1B1F2A';c.lineWidth=2;c.beginPath();c.moveTo(-8,hy+3);c.lineTo(-3,hy+3);c.moveTo(3,hy+3);c.lineTo(8,hy+3);c.stroke();}
  else{const eye=(ex)=>{c.fillStyle='#1B1F2A';c.beginPath();c.ellipse(ex,hy+2,3.2,4.6,0,0,7);c.fill();c.fillStyle=p.human?'#5A3A22':p.hair;c.beginPath();c.ellipse(ex,hy+3.5,2.2,2.6,0,0,7);c.fill();c.fillStyle='#FFFFFF';c.beginPath();c.arc(ex-1,hy,1.4,0,7);c.fill();};eye(-5.5);eye(5.5);}
  c.fillStyle='rgba(255,120,140,.35)';c.beginPath();c.ellipse(-9,hy+7,2.6,1.4,0,0,7);c.ellipse(9,hy+7,2.6,1.4,0,0,7);c.fill();
  c.strokeStyle='#7A3B3B';c.lineWidth=1.2;c.beginPath();c.arc(0,hy+7,2.2,.2,Math.PI-.2);c.stroke();
  }
  // carry
  if(p.carry){c.fillStyle='#F7F4EC';c.save();c.rotate(-.12);rr(c,7,-30,12,15,1.5);c.fill();c.fillStyle='#9AA6B2';c.fillRect(9,-26,8,1.2);c.fillRect(9,-22,6,1.2);c.restore();}
  if(p.paper){c.fillStyle='#F7F4EC';rr(c,-11,-34,22,14,1.5);c.fill();c.fillStyle='#9AA6B2';for(let i=0;i<3;i++)c.fillRect(-8,-31+i*3.5,16,1.2);}
  c.restore();
  // name + bubble
  c.font='700 10.5px Inter,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
  const label=p.me?'You':p.name;const lw=c.measureText(label).width+10;c.fillStyle='rgba(14,17,23,.72)';rr(c,sx-lw/2,sy-bob-80,lw,15,7);c.fill();c.fillStyle=p.human?'#E3C98A':p.hair;c.fillText(label,sx,sy-bob-72.5);
  if(p.bubble&&performance.now()<p.bubbleT){c.font='700 11.5px Inter,sans-serif';const w=Math.min(230,c.measureText(p.bubble).width+16);const bx=sx-w/2,by=sy-bob-112;
    c.fillStyle='#FFFFFF';rr(c,bx,by,w,24,10);c.fill();c.beginPath();c.moveTo(sx-5,by+24);c.lineTo(sx,by+31);c.lineTo(sx+5,by+24);c.fill();c.fillStyle='#1B1F2A';c.fillText(p.bubble,sx,by+12.5,w-10);}
}
function drawPerson(c,p,t){
  if(p.hidden)return;
  const atlas=p.human?ART.human:ART.bot;
  if(!atlas||!atlas.complete||!atlas.naturalWidth){drawLegacyPerson(c,p,t);return;}
  const [sx,sy]=iso(p.x+.5,p.y+.5),walking=p.path.length>0,st=walking?null:seatAt(p),now=performance.now();
  const row=walking?1:(st||p.sit)?2:(p.bubble&&now<p.bubbleT)?3:0;
  let col;
  if(p.human){const h=hash(p.full||p.name);col=p.room==='site'?3:p.beard?1:(h%2?2:0);}
  else{col=Math.max(0,BOTS.findIndex((b)=>b.name===p.name));}
  const w=84,h=100,y=sy-h+5;c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(sx,sy-2,18,7,0,0,Math.PI*2);c.fill();
  c.save();if(p.face<0){c.translate(sx,0);c.scale(-1,1);drawAtlasCell(c,atlas,col,row,-w/2,y,w,h);}else drawAtlasCell(c,atlas,col,row,sx-w/2,y,w,h);c.restore();
  c.font='700 10.5px Inter,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
  const label=p.me?'You':p.name,lw=c.measureText(label).width+10;c.fillStyle='rgba(14,17,23,.78)';rr(c,sx-lw/2,sy-105,lw,15,7);c.fill();c.fillStyle=p.human?'#E3C98A':p.hair;c.fillText(label,sx,sy-97.5);
  if(p.bubble&&now<p.bubbleT){c.font='700 11.5px Inter,sans-serif';const bw=Math.min(230,c.measureText(p.bubble).width+16),bx=sx-bw/2,by=sy-137;c.fillStyle='#FFFFFF';rr(c,bx,by,bw,24,10);c.fill();c.beginPath();c.moveTo(sx-5,by+24);c.lineTo(sx,by+31);c.lineTo(sx+5,by+24);c.fill();c.fillStyle='#1B1F2A';c.fillText(p.bubble,sx,by+12.5,bw-10);}
}function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function stackAt(c,x,y,z,k){for(let i=0;i<Math.min(k,7);i++)box(c,x,y,.4,.3,2,'#F7F4EC',z+i*2.4,{edge:'rgba(0,0,0,.08)'});}
function drawClock(c){const p=iso(9.6,0,76);c.save();c.translate(p[0],p[1]);c.transform(1,.5,0,1,0,0);c.fillStyle='#FFFFFF';c.beginPath();c.arc(0,0,13,0,7);c.fill();c.strokeStyle='#6E4A2A';c.lineWidth=2.5;c.stroke();
  const d=new Date(),ha=((d.getHours()%12)+d.getMinutes()/60)/12*Math.PI*2,ma=d.getMinutes()/60*Math.PI*2;c.strokeStyle='#1B1F2A';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(ha)*6,-Math.cos(ha)*6);c.moveTo(0,0);c.lineTo(Math.sin(ma)*9.5,-Math.cos(ma)*9.5);c.stroke();c.restore();}
// ---------- app hooks ----------
function mainDb() { try { return (typeof db !== 'undefined' && db && db.ref) ? db : (window.db || null); } catch (_) { return window.db || null; } }
function meUser() { try { return (typeof currentApprover !== 'undefined' && currentApprover) || window.currentApprover || window.currentUser || null; } catch (_) { return window.currentApprover || null; } }
function meName() { const u = meUser() || {}; return String(u.Name || u.username || 'You').trim(); }
function approvers() {
  let all = {};
  try { all = (typeof window.getApproversDataSafe === 'function' && window.getApproversDataSafe()) || {}; } catch (_) {}
  if (!all || !Object.keys(all).length) { try { all = (typeof allApproverData !== 'undefined' && allApproverData) || {}; } catch (_) {} }
  return Object.keys(all || {}).map((k) => Object.assign({ key: k }, all[k] || {})).filter((a) => a.Name);
}
// vendor + site: same source as Invoice Records (the PO list allPOData), then the invoice's own fields (patch 134)
const okTxt = (v) => { const t = String(v == null ? '' : v).trim(); return t && !/^n\/?a$/i.test(t) ? t : ''; };
function poInfo(po, inv) {
  let p = null; try { p = (typeof allPOData !== 'undefined' && allPOData && allPOData[po]) || null; } catch (_) {}
  const r = inv || {};
  return { vendor: okTxt(p && (p['Supplier Name'] || p['Supplier'])) || okTxt(r.vendorName || r.vendor_name || r.vendor || r.supplierName),
           site: okTxt(p && p['Project ID']) || okTxt(r.site || r.site_name || r.siteName) };
}
async function ensurePOList() {
  try { if (typeof ensureInvoicePOBaseDataFetched === 'function') await ensureInvoicePOBaseDataFetched(false); } catch (e) { console.warn('Office: PO list not loaded', e); }
}
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// ---------- people ----------
const people = [];
function person(o) { Object.assign(o, { px: o.x, py: o.y, path: [], res: null, carry: false, bubble: '', bubbleT: 0, hidden: false, face: 1, busy: false, sit: false }); people.push(o); return o; }
const BOTS = [
  person({ name: 'Rina', tag: 'Bot 1', role: 'Reception', room: 'rec', hair: '#3FD1C1', suit: '#1E7E75', style: 'twin', x: 5, y: 22, home: [5, 22], dir: 'W', cab: [6, 18] }),
  person({ name: 'Sami', tag: 'Bot 2', role: 'Sorting', room: 'bot', hair: '#E3C98A', suit: '#8A6A2E', style: 'spike', x: 16, y: 2, home: [16, 2], cab: [19, 1] }),
  person({ name: 'Rafi', tag: 'Bot 3', role: 'Reports', room: 'bot', hair: '#5AA9FF', suit: '#2F5F9C', style: 'spike', x: 17, y: 2, home: [17, 2], cab: [20, 37] }),
  person({ name: 'Ana', tag: 'Bot 4', role: 'Accounts', room: 'bot', hair: '#FF7EB6', suit: '#A34676', style: 'bob', x: 16, y: 4, home: [16, 4], dir: 'N', cab: [20, 32] }),
];
// lounge sofa seats [x, y, facing]
const SOFA_SEATS = [[9, 34, 'E'], [9, 35, 'E'], [9, 36, 'E'], [11, 33, 'S'], [12, 33, 'S'], [13, 33, 'S'], [11, 37, 'N'], [12, 37, 'N'], [13, 37, 'N']];
const SPOT = { myFront: [6, 5], sofa: SOFA_SEATS.map(([x, y]) => [x, y]), pantry: [[9, 2], [10, 2], [11, 2], [9, 4], [10, 4], [11, 4]], wc: [[3, 29], [5, 29]], cooler: [12, 5] };
const MEET_SEATS = [[2, 11, 'S'], [3, 11, 'S'], [4, 11, 'S'], [5, 11, 'S'], [2, 14, 'N'], [3, 14, 'N'], [4, 14, 'N'], [5, 14, 'N'], [1, 12, 'E'], [1, 13, 'E'], [6, 12, 'W'], [6, 13, 'W']];
// seats [x, y, facing]: facing = where the desk is (S = toward you, N = back to you, W / E = sideways).
// Shared rooms: desks in pods (two rows back to back sharing one desk row, glass dividers between them).
const SEATS = {
  rec: [[5, 20, 'W']], // Hafiz; Rina (bot) has the 2nd chair at the same desk
  log: [[22, 2, 'S'], [23, 2, 'S'], [22, 4, 'N'], [23, 4, 'N']],
  me: [[4, 5, 'E']], md: [[40, 3, 'S']], spA: [[42, 21, 'W']], fin: [[29, 2, 'S']], coo: [[35, 2, 'S']], pd: [[42, 15, 'W']],
  acc: [[17, 34, 'S'], [18, 34, 'S'], [17, 36, 'N'], [18, 36, 'N']],
  hr: [[23, 39, 'N'], [23, 33, 'S'], [24, 33, 'S'], [23, 35, 'N'], [27, 39, 'N']], // lead, team of 3, architect
  site: [[37, 33, 'S'], [38, 33, 'S'], [37, 35, 'N'], [38, 35, 'N'], [40, 33, 'S'], [41, 33, 'S'], [40, 35, 'N'], [41, 35, 'N'], [31, 33, 'S'], [32, 33, 'S'], [31, 35, 'N'], [32, 35, 'N'], [34, 37, 'W']], // 8 Site DC, 4 QS, head draftsman
  wh: [[40, 26, 'S'], [41, 26, 'S'], [40, 28, 'N'], [41, 28, 'N']],
  spB: [[36, 26, 'S']],
};const DIRV = { S: [0, 1], N: [0, -1], W: [-1, 0], E: [1, 0] };
// every seat = a chair + its own desk and PC in the facing direction (an existing desk/counter/table there is shared)
const CHAIRS = [];
function deskAt(x, y) { return FURN.find((o) => o.t !== 'divider' && o.t !== 'rug' && o.t !== 'tilefloor' && o.t !== 'art' && x >= Math.floor(o.x) && x < Math.floor(o.x) + Math.max(1, Math.round(o.w)) && y >= Math.floor(o.y) && y < Math.floor(o.y) + Math.max(1, Math.round(o.d))); }
function addSeat(x, y, dir, col, opts) {
  dir = dir || 'S'; CHAIRS.push(Object.assign({ x, y, dir, col: col || '#2E3A4E', sprite: 'work' }, opts || {}));
  if (opts && opts.noDesk) return; const v = DIRV[dir]; const dx = x + v[0], dy = y + v[1];
  if (!deskAt(dx, dy)) F({ x: dx, y: dy, w: 1, d: 1, h: 24, col: '#B07A45', t: 'desk' });
}
Object.keys(SEATS).forEach((rid) => SEATS[rid].forEach(([x, y, d], i) => addSeat(x, y, d, ['me', 'md', 'coo', 'pd', 'fin', 'spA', 'spB'].includes(rid) || (rid === 'hr' && i === 0) || (rid === 'site' && i === 12) ? '#3A2A20' : null)));
BOTS.forEach((b) => addSeat(b.home[0], b.home[1], b.dir || 'S', '#24303F'));
 // Pod dividers: glass along the middle of each shared desk row, and between the two desks of a row.
const DIV = (x, y, w, d) => F({ x, y, w, d, h: 20, col: '#C9D4DE', t: 'divider', block: false });
[[17, 35, 2], [23, 34, 2], [37, 34, 2], [40, 34, 2], [31, 34, 2], [22, 3, 2], [40, 27, 2], [16, 3, 2]].forEach(([x, y, n]) => { DIV(x, y + .46, n, .08); DIV(x + 1 - .04, y, .08, 1); });
 // Visitor chairs: two in front of every private desk, meeting table, reception waiting corner.
[26, 32].forEach((X) => { addSeat(X + 2, 4, 'N', '#3A3F4A', { noDesk: true, sprite: 'visitor' }); addSeat(X + 4, 4, 'N', '#3A3F4A', { noDesk: true, sprite: 'visitor' }); });
[[39, 5], [41, 5], [35, 28], [36, 28]].forEach(([x, y]) => addSeat(x, y, 'N', '#3A3F4A', { noDesk: true, sprite: 'visitor' }));
[[40, 14], [40, 16], [40, 20], [40, 22]].forEach(([x, y]) => addSeat(x, y, 'E', '#3A3F4A', { noDesk: true, sprite: 'visitor' }));
[[6, 4], [6, 6]].forEach(([x, y]) => addSeat(x, y, 'W', '#3A3F4A', { noDesk: true, sprite: 'visitor' }));
[[3, 34, 'E'], [5, 34, 'W'], [15, 38, 'E'], [18, 38, 'W'], [39, 8, 'E']].forEach(([x, y, d]) => addSeat(x, y, d, '#69528C', { noDesk: true, sprite: 'lounge' })); // single sofas: Lounge reading corner, Accounts U, MD's L
[[16, 39, 'N'], [17, 39, 'N']].forEach(([x, y, d]) => addSeat(x, y, d, '', { noDesk: true, hidden: true })); // Accounts 2-seater
MEET_SEATS.forEach(([x, y, d]) => addSeat(x, y, d, '#2E3A4E', { noDesk: true, sprite: 'visitor' }));
[[1, 18, 'E'], [3, 18, 'W'], [2, 19, 'N']].forEach(([x, y, d]) => addSeat(x, y, d, '#3A3F4A', { noDesk: true, sprite: 'visitor' }));
SPOT.pantry.forEach(([x, y]) => addSeat(x, y, y < 3 ? 'S' : 'N', '#5A4632', { noDesk: true, stool: true }));
SOFA_SEATS.forEach(([x, y, d]) => addSeat(x, y, d, '', { noDesk: true, hidden: true }));
function seatAt(p) { return CHAIRS.find((o) => Math.abs(p.x - o.x) < .05 && Math.abs(p.y - o.y) < .05); }
function drawChair(c,o,t){
  if(o.hidden)return;
  if(o.stool){}
  else if(ART.furniture&&ART.furniture.complete){const p=iso(o.x+.5,o.y+.5,0),cell=o.sprite==='visitor'?[1,1]:o.sprite==='lounge'?[3,2]:[0,1];drawAtlasCell(c,ART.furniture,cell[0],cell[1],p[0]-37,p[1]-80,74,84);return;}
  if (o.hidden) return;
  if (o.stool) { shadowAt(c, o.x + .5, o.y + .5, 9, 4, .16); box(c, o.x + .45, o.y + .45, .1, .1, 18, '#8A8F98'); box(c, o.x + .28, o.y + .28, .44, .44, 4, o.col, 18, { edge: 'rgba(255,255,255,.12)' }); return; }
  const occ = people.some((p) => !p.hidden && !p.path.length && Math.round(p.x) === o.x && Math.round(p.y) === o.y);
  shadowAt(c, o.x + .5, o.y + .5, 13, 6, .18);
  box(c, o.x + .44, o.y + .44, .12, .12, 10, '#4A4F5A');
  box(c, o.x + .2, o.y + .2, .6, .6, 5, o.col, 10, { edge: 'rgba(255,255,255,.1)' });
  const hb = occ ? 22 : 26;
  if (o.dir === 'S') box(c, o.x + .2, o.y + .14, .6, .12, hb, o.col, 14);
  else if (o.dir === 'N') box(c, o.x + .2, o.y + .74, .6, .12, hb, o.col, 14);
  else if (o.dir === 'W') box(c, o.x + .74, o.y + .2, .12, .6, hb, o.col, 14);
  else box(c, o.x + .14, o.y + .2, .12, .6, hb, o.col, 14);
}
// door frames: two posts and a top bar on every door of a partition
WALLS.forEach(([x1, y1, x2, y2, g, doors]) => doors.forEach((d) => {
  if (x1 === x2) { if (d < y1 || d >= y2) return; WALLOBJ.push({ x: x1 - .08, y: d - .02, w: .16, d: .1, h: PART + 14, frame: 1 }, { x: x1 - .08, y: d + .92, w: .16, d: .1, h: PART + 14, frame: 1 }, { x: x1 - .08, y: d, w: .16, d: 1, h: 6, z: PART + 8, frame: 1 }); }
  else { if (d < x1 || d >= x2) return; WALLOBJ.push({ x: d - .02, y: y1 - .08, w: .1, d: .16, h: PART + 14, frame: 1 }, { x: d + .92, y: y1 - .08, w: .1, d: .16, h: PART + 14, frame: 1 }, { x: d, y: y1 - .08, w: 1, d: .16, h: 6, z: PART + 8, frame: 1 }); }
}));
const SKIN = ['#F2C9A0', '#D9A77E', '#C99470', '#E0B48C', '#B98563'];
const HAIR = ['#2B1E1A', '#4A2E1E', '#1E1A18', '#3A3A3A', '#5A3A22'];
const SUIT = ['#3B5B8A', '#5B7A3B', '#A34676', '#2F5F9C', '#8A6A2E', '#1E7E75', '#4A3A5E', '#2B2F3A'];
function hash(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
let cfg = null;      // { rooms: { roomId: [{key,name,suit,beard}] } }
let staff = [];      // person objects of humans
function defaultCfg() {
  const list = approvers(); const me = norm(meName()); const used = new Set([me]);
  const pick = (fn, max) => { const out = list.filter((a) => !used.has(norm(a.Name)) && fn(a)).slice(0, max); out.forEach((a) => used.add(norm(a.Name))); return out.map((a) => ({ key: a.key, name: String(a.Name).trim() })); };
  const pos = (a) => norm(a.Position); const nm = (a) => norm(a.Name);
  return { rooms: {
    me: [{ key: (meUser() || {}).key || 'me', name: meName() }],
    md: pick((a) => /managing director|^ceo\b|chief executive/.test(pos(a)), 1),
    coo: pick((a) => /^coo\b|chief operat/.test(pos(a)), 1),
    pd: pick((a) => /project director/.test(pos(a)) || /\be\.?\s*bara\b/.test(nm(a)), 1),
    fin: pick((a) => /finance manager/.test(pos(a)) || /\bmustafa\b|\bmostafa\b/.test(nm(a)), 1),
  hr: pick((a) => /procurement|purchasing/.test(pos(a)), 4),
    log: pick((a) => /\b(imran|suhil|suhail)\b/.test(nm(a)) || /logistic/.test(pos(a)), 6),
    rec: pick((a) => /\bhafiz\b/.test(nm(a)) || /reception/.test(pos(a)), 2),
    acc: pick((a) => /\bgio\b/.test(nm(a)) || /account/.test(pos(a)), 6),
    wh: pick((a) => /store ?keeper|warehouse/.test(pos(a)), 4),
    site: pick((a) => /\bdc\b|document control/.test(pos(a)), 7),
  }, names: {} };
}
function buildStaff() {
  staff.forEach((p) => { const i = people.indexOf(p); if (i >= 0) people.splice(i, 1); });
  staff = [];
  const rooms = (cfg && cfg.rooms) || {};
  Object.keys(rooms).forEach((rid) => {
    const seats = SEATS[rid] || []; const list = Array.isArray(rooms[rid]) ? rooms[rid] : [];
    list.slice(0, seats.length).forEach((m, i) => {
      const h = hash(m.name || m.key); const isMe = norm(m.name) === norm(meName());
      const p = person({ name: isMe ? meName() : String(m.name || '').split(/\s+/).slice(0, 2).join(' '), full: m.name, key: m.key, human: true, me: isMe, room: rid,
        hair: m.hair || HAIR[h % HAIR.length], skin: m.skin || SKIN[(h >> 3) % SKIN.length], suit: m.suit || (isMe ? '#E3C98A' : SUIT[(h >> 5) % SUIT.length]), beard: m.beard != null ? !!m.beard : !!(h & 1),
        x: seats[i][0], y: seats[i][1], home: seats[i] });
      staff.push(p);
    });
  });
}
// who is logged in (the chat's presence list: presence/{userKey} status online + heartbeat every 2 min)
let online = null;
function isOnline(p) { if (p.me || !online) return true; return online.keys.has(String(p.key)) || online.names.has(norm(p.full || p.name)); }
// patch 141 (martin): everyone who signs in comes in through the entrance door and walks to their desk;
// signing off = walks out through the door. Office closes at 6:00 PM (Qatar): whoever is still in goes home
// then, so after 6 no one is in the office (until 6:00 AM). All times shown as 8:30 AM / 5:45 PM.
const DOOR = [0, 21];
function qatarMin() { try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()); return (+p.find((x) => x.type === 'hour').value % 24) * 60 + (+p.find((x) => x.type === 'minute').value); } catch (_) { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); } }
function officeClosed() { const m = qatarMin(); return m >= 18 * 60 || m < 6 * 60; }
function awayHides(p) { return !!(p.away && AWAY[p.away.what] && AWAY[p.away.what].hide); }
function walkIn(p) { p.walking = 'in'; p.hidden = false; p.x = DOOR[0]; p.y = DOOR[1]; p.path = []; const to = p.away && p.awaySpot && !awayHides(p) ? p.awaySpot : p.home; return go(p, to).then(() => { if (p.walking === 'in') p.walking = null; }); }
function walkOut(p) { if (p.hidden) { p.walking = null; return Promise.resolve(); } p.walking = 'out'; return go(p, DOOR).then(() => { if (p.walking === 'out') { p.walking = null; if (p.inside === false) p.hidden = true; } }); }
let closedLogged = false;
function todayQ() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qatar' }).format(new Date()); } catch (_) { return new Date().toDateString(); } }
function markWalkInToday() { try { localStorage.setItem('iba-office-in-v1', todayQ()); } catch (_) {} }
function applyPresence(quiet) {
  const closed = officeClosed();
  if (closed && !closedLogged && staff.some((p) => p.inside)) { closedLogged = true; log('6:00 PM · The office is closed. Everyone went home.'); }
  if (!closed) closedLogged = false;
  staff.forEach((p) => {
    const on = isOnline(p) && !closed;
    if (p.inside === undefined) {   // first look: people already in stay at their desk; you walk in once a day
      p.inside = on; p.hidden = !on || awayHides(p);
      if (on && p.me && !awayHides(p)) { let seen = ''; try { seen = localStorage.getItem('iba-office-in-v1') || ''; } catch (_) {} if (seen !== todayQ()) { markWalkInToday(); walkIn(p); } }
      return;
    }
    if (on && !p.inside) { p.inside = true; if (!quiet) log(`<b>${esc(p.full || p.name)}</b> came in.`); if (awayHides(p)) { p.walking = null; p.hidden = true; } else { if (p.me) markWalkInToday(); walkIn(p); } }
    else if (!on && p.inside) { p.inside = false; if (!quiet && !closed) log(`<b>${esc(p.full || p.name)}</b> left the office.`); walkOut(p); }
    else if (!p.walking) p.hidden = !on || (awayHides(p) && !p.path.length);
  });
}
async function loadPresence(quiet) {
  const d = mainDb(); if (!d) { applyPresence(quiet); return; }
  try { const snap = await d.ref('presence').once('value'); const v = snap.val() || {}; const now = Date.now(); const o = { keys: new Set(), names: new Set() };
    Object.keys(v).forEach((k) => { const x = v[k] || {}; const seen = Number(x.lastSeen) || 0; if (x.status === 'online' && (!seen || now - seen < 10 * 60000)) { o.keys.add(String(k)); if (x.name) o.names.add(norm(x.name)); } });
    online = o; applyPresence(quiet); } catch (e) { console.warn('Office: presence read failed', e); }
  try { const a = (await d.ref(AWAY_ROOT).once('value')).val() || {}; awayAll = a; applyAway(); } catch (_) {}
  staff.forEach((p) => { if (p.inside === false && p.walking !== 'out') p.hidden = true; });
}
function myRoom() { const m = staff.find((p) => p.me); return m ? m.room : 'me'; }
// ---------- real data ----------
const CLOSED = /^(with accounts|cancelled|paid|closed|original po|report approved)$/i;
const CABS = [
  { id: 'rec', at: [6, 17], title: 'Reception · New entries', jobs: true },
  { id: 'tray', at: [5, 4], tray: true, title: 'Your desk · Under Review', st: ['Under Review'] },
  { id: 'bot', at: [19, 0], title: 'Bot room · SRV / IPC / Summary', st: ['For SRV', 'For IPC', 'IPC Application', 'For Summary', 'Pending'] },
  { id: 'log', at: [25, 1], title: 'Logistics · On hold / inquiry', st: ['On Hold', 'For Inquiry', 'Unresolved'] },
  { id: 'me', at: [2, 7], title: 'Your office · For Approval', st: ['For Approval'] },
  { id: 'rtp', at: [7, 2], rtp: true, title: 'Printer · Ready to Print' },
  { id: 'print', at: [-1, -1], printer: true, title: 'Print basket' },
  { id: 'md', at: [38, 10], title: 'Managing Director · CEO Approval', st: ['CEO Approval'] },
  { id: 'acc', at: [21, 32], title: 'Accounts · With Accounts', st: ['With Accounts'] },
  { id: 'rep', at: [21, 37], title: 'Accounts · Reports', st: ['Report', 'Report Approval'] },
  { id: 'coo', at: [37, 0], title: 'COO office · In Process', st: ['In Process'] },
];let rows = [];          // flat invoices
let byStatus = {}, byAtt = {};
let loadedAt = 0, loading = false;
// last change of an invoice = newest of its dates and history lines
function dateOf(r) {
  if (r.__t != null) return r.__t; let t = 0;
  [r.lastUpdated, r.updatedAt, r.timestamp, r.createdAt, r.originTimestamp, r.releaseDate, r.invoiceDate].forEach((d) => { const x = typeof d === 'number' ? d : Date.parse(d); if (Number.isFinite(x) && x > t) t = x; });
  if (r.history && typeof r.history === 'object') Object.keys(r.history).forEach((k) => { const h = r.history[k] || {}; const x = Number(h.timestamp || h.at || h.time); if (Number.isFinite(x) && x > t) t = x; });
  if (t > Date.now() + 864e5) t = 0; r.__t = t; return t;
}
function sinceYesterday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - 864e5; }
function isNew(r) { return dateOf(r) >= sinceYesterday(); }
async function loadData(quiet) {
  if (loading) return; loading = true;
  if (!quiet) Q('.iba-off-load').hidden = false;
  try {
    let data = null;
    const poList = ensurePOList();
    if (typeof window.ibaInvoiceEntriesLoad === 'function') { const r = await window.ibaInvoiceEntriesLoad(); data = r && r.data; }
    await poList;
    const out = [];
    Object.keys(data || {}).forEach((po) => { const invs = data[po] || {}; if (typeof invs !== 'object') return;
      Object.keys(invs).forEach((k) => { const v = invs[k]; if (!v || typeof v !== 'object') return; out.push(Object.assign({ po, key: k }, v)); }); });
    rows = out; byStatus = {}; byAtt = {};
    out.forEach((r) => { const s = String(r.status || '').trim(); (byStatus[s] = byStatus[s] || []).push(r);
      const a = norm(r.attention); if (a && !CLOSED.test(s)) (byAtt[a] = byAtt[a] || []).push(r); });
    Object.keys(byStatus).forEach((s) => byStatus[s].sort((a, b) => dateOf(b) - dateOf(a)));
    Object.keys(byAtt).forEach((s) => byAtt[s].sort((a, b) => dateOf(b) - dateOf(a)));
    await loadJobs();
    loadedAt = Date.now(); paintSum();
    rtpScan(out);
    log(`Cabinets filled: <b>${out.length.toLocaleString()}</b> invoices read from the saved copy.`);
  } catch (e) { console.warn('Office: load failed', e); log('Could not read the invoices. Try Refresh.'); }
  finally { loading = false; Q('.iba-off-load').hidden = true; }
}
function rtpN() { try { return window.ibaOfficePrint ? window.ibaOfficePrint.count() : 0; } catch (_) { return 0; } }
function cabRows(c) {
  if (c.printer || c.rtp) return [];
  if (c.jobs) return jobRows.slice();
  let list = []; (c.st || []).forEach((s) => { list = list.concat(byStatus[s] || []); });
  return list.sort((a, b) => dateOf(b) - dateOf(a));
}
function cabNew(c) { return c.rtp ? rtpN() : c.printer ? cabCount(c) : cabRows(c).filter(isNew).length; }
function cabCount(c) { if (c.rtp) return rtpN(); if (c.printer) { try { return window.ibaPrintBasket ? window.ibaPrintBasket.list().length : 0; } catch (_) { return 0; } } return cabRows(c).length; }
function attRows(p) { return byAtt[norm(p.full || p.name)] || []; }
// ---------- room labels + counters ----------
function badge(c, x, y, num) { if (!num) return; const s = String(num); c.font = '800 11px Inter,system-ui,sans-serif'; const w = Math.max(18, c.measureText(s).width + 10); c.fillStyle = '#E5484D'; rr(c, x - w / 2, y - 9, w, 18, 9); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y + .5); }
function inRoom(r) { return people.filter((q) => !q.hidden && q.x + .5 >= r.x && q.x + .5 < r.x + r.w && q.y + .5 >= r.y && q.y + .5 < r.y + r.h); }
function roomName(r) { return r.id === 'me' ? 'IRWIN' : r.name; }
function drawLabels(c) {
  const vr = myRoom();
  ROOMS.forEach((r) => { if (!r.name) return; const own = r.id === vr; const name = own && r.id !== 'me' ? 'Your office · ' + r.name : roomName(r); const p = iso(r.x + r.w / 2, r.y + r.h / 2, 0);
    c.font = '800 12px Inter,system-ui,sans-serif'; const w = c.measureText(name).width + 18;
    c.fillStyle = own ? 'rgba(227,201,138,.95)' : 'rgba(14,17,23,.66)'; rr(c, p[0] - w / 2, p[1] - 10, w, 20, 10); c.fill(); c.fillStyle = own ? '#1A140C' : '#F1E6CF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, p[0], p[1] + .5);
    if (zoom < .5) { const who = inRoom(r).map((q) => q.me ? 'You' : q.name); const txt = who.length ? (who.length > 4 ? who.slice(0, 4).join(', ') + ' +' + (who.length - 4) : who.join(', ')) : 'empty'; c.font = '700 10.5px Inter,system-ui,sans-serif'; const w2 = c.measureText(txt).width + 14; c.fillStyle = 'rgba(14,17,23,.8)'; rr(c, p[0] - w2 / 2, p[1] + 12, w2, 16, 8); c.fill(); c.fillStyle = who.length ? '#3FD1C1' : '#8094A8'; c.fillText(txt, p[0], p[1] + 20.5); }
    if (own) { const q = [iso(r.x + .1, r.y + .1), iso(r.x + r.w - .1, r.y + .1), iso(r.x + r.w - .1, r.y + r.h - .1), iso(r.x + .1, r.y + r.h - .1)]; c.strokeStyle = 'rgba(227,201,138,.95)'; c.lineWidth = 2.5; c.beginPath(); q.forEach((v, i) => i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])); c.closePath(); c.stroke(); } });
  // patch 139: an empty chair shows where its person is ("At lunch · 12:40")
  staff.forEach((p) => { if (!p.away) return; const h = iso(p.home[0] + .5, p.home[1] + .5, 34); const txt = awayText(p.away); c.font = '800 10.5px Inter,system-ui,sans-serif'; const w = c.measureText(txt).width + 14;
    c.fillStyle = 'rgba(247,165,49,.95)'; rr(c, h[0] - w / 2, h[1] - 9, w, 17, 8); c.fill(); c.fillStyle = '#1A140C'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, h[0], h[1]); });
}
function drawIbaLogo(c,t){
  const bx=20.5,by=14.8,bw=5,bd=2.4,bh=22,p=iso(bx+bw/2,by+bd/2,bh),pixel=root.dataset.theme==='pixel';
  const metal=pixel?'#27355A':'#737D8A',edge=pixel?'#55E8F0':'#D5DCE4',dark=pixel?'#11182B':'#3F4852';
  shadowAt(c,bx+bw/2,by+bd/2,90,30,.25);box(c,bx,by,bw,bd,bh,metal,0,{edge});
  box(c,bx+.22,by+.18,bw-.44,bd-.36,4,pixel?'#394B72':'#929DA8',bh-4,{edge});
  const f1=iso(bx+.5,by+bd,bh-4),f2=iso(bx+bw-.5,by+bd,bh-4),f3=iso(bx+bw-.5,by+bd,5),f4=iso(bx+.5,by+bd,5);
  poly(c,[f1,f2,f3,f4],dark,edge);
  const plate=iso(bx+bw/2,by+bd,10);c.save();c.translate(plate[0],plate[1]);c.transform(1,.5,0,1,0,0);c.fillStyle=pixel?'#72F2EA':'#F1F4F7';c.font='900 16px Segoe UI,Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('IBA OFFICE',0,0);c.restore();
  const angle=t*.00075,sx=Math.cos(angle),top=iso(bx+bw/2,by+bd/2,bh+3);c.save();c.translate(top[0],top[1]);c.scale(Math.max(-1,Math.min(1,sx)),1);
  c.font='900 88px Segoe UI,Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';
  for(let d=16;d>=1;d--){c.fillStyle=d>9?(pixel?'#263B72':'#556272'):(pixel?'#315FA3':'#3D6C97');c.fillText('IBA',0,-22-d);}
  const g=c.createLinearGradient(0,-74,0,28);g.addColorStop(0,pixel?'#A5FFF0':'#F9FCFF');g.addColorStop(.5,pixel?'#38CEE1':'#8FC6E8');g.addColorStop(1,pixel?'#927BFF':'#496B96');
  c.fillStyle=g;c.strokeStyle=edge;c.lineWidth=2;c.strokeText('IBA',0,-22);c.fillText('IBA',0,-22);c.restore();
}// ---------- camera ----------
const START_KEY = 'iba-office-start-v1';
let zoom = 1; try { zoom = localStorage.getItem(START_KEY) === 'all' ? 0 : 1; } catch (_) {}
function roomRect(r) { const xs = [iso(r.x, r.y + r.h)[0], iso(r.x + r.w, r.y)[0]]; const y0 = iso(r.x, r.y, WALL)[1] - 30, y1 = iso(r.x + r.w, r.y + r.h)[1] + 20; return { x: xs[0], y: y0, w: xs[1] - xs[0], h: y1 - y0 }; }
function camTarget() {
  if (zoom <= 0.001) return { x: 0, y: 0, w: CW, h: CH };
  const r = ROOMS.find((q) => q.id === myRoom()) || ROOMS[0], b = roomRect(r), asp = CW / CH;
  let w0 = Math.min(CW, Math.max(b.w * 1.45, b.h * 1.25 * asp, CW * .4)); const w = CW + (w0 - CW) * zoom, h = w / asp;
  let x = b.x + b.w / 2 - w / 2, y = b.y + b.h / 2 - h / 2; x = Math.max(0, Math.min(CW - w, x)); y = Math.max(0, Math.min(CH - h, y)); return { x, y, w, h };
}
let cam = camTarget();
function dimOthers(c) {
  if (zoom < .35) return; const r = ROOMS.find((q) => q.id === myRoom()); if (!r) return;
  const L = iso(r.x, r.y + r.h), T = iso(r.x, r.y), Rt = iso(r.x + r.w, r.y), B = iso(r.x + r.w, r.y + r.h), up = 120;
  c.save(); c.fillStyle = `rgba(8,11,16,${(.55 * (zoom - .35) / .65).toFixed(3)})`; c.beginPath(); c.rect(0, 0, CW, CH);
  c.moveTo(L[0], L[1]); c.lineTo(L[0], L[1] - up); c.lineTo(T[0], T[1] - up); c.lineTo(Rt[0], Rt[1] - up); c.lineTo(Rt[0], Rt[1]); c.lineTo(B[0], B[1]); c.closePath(); c.fill('evenodd'); c.restore();
}
function composite() {
  const tg = camTarget(), k = reduce ? 1 : .1; ['x', 'y', 'w', 'h'].forEach((q) => { cam[q] += (tg[q] - cam[q]) * k; });
  vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.clearRect(0, 0, cv.width, cv.height);
  vctx.drawImage(scene, cam.x * DPR, cam.y * DPR, cam.w * DPR, cam.h * DPR, 0, 0, cv.width, cv.height);
  if (cam.w < CW * .98) { const mw = cv.width * .24, mh = mw * CH / CW, mx = cv.width - mw - 12 * DPR, my = cv.height - mh - 12 * DPR;
    vctx.fillStyle = 'rgba(14,17,23,.86)'; vctx.fillRect(mx - 4 * DPR, my - 20 * DPR, mw + 8 * DPR, mh + 24 * DPR);
    vctx.drawImage(scene, 0, 0, scene.width, scene.height, mx, my, mw, mh); vctx.strokeStyle = '#E3C98A'; vctx.lineWidth = 2 * DPR; vctx.strokeRect(mx + cam.x / CW * mw, my + cam.y / CH * mh, cam.w / CW * mw, cam.h / CH * mh);
    vctx.fillStyle = '#E3C98A'; vctx.font = `800 ${11 * DPR}px Inter,system-ui,sans-serif`; vctx.textAlign = 'left'; vctx.textBaseline = 'middle'; vctx.fillText('Whole office', mx, my - 10 * DPR); }
}
// ---------- frame ----------
function frame(t) {
  ctx.clearRect(0, 0, CW, CH); ctx.drawImage(st, 0, 0, CW, CH); drawClock(ctx);
   const objs = [];
  FURN.forEach((o) => objs.push({ d: o.x + o.w + o.y + o.d - .2, f: () => drawFurn(ctx, o, t) }));
  WALLOBJ.forEach((o) => objs.push({ d: o.x + o.w + o.y + o.d - .15, f: () => drawWall(ctx, o) }));
  CHAIRS.forEach((o) => objs.push({ d: o.x + o.y + 1.5, f: () => drawChair(ctx, o, t) }));
  people.forEach((p) => objs.push({ d: p.x + p.y + 1.6, f: () => drawPerson(ctx, p, t) }));
  objs.push({d:43,f:()=>drawIbaLogo(ctx,t)});
  objs.sort((a, b) => a.d - b.d).forEach((o) => o.f());
   dimOthers(ctx); drawLabels(ctx);
  // counts over cabinets and people
  CABS.forEach((c, i) => { const o = furnAt(c.at[0], c.at[1]); if (!o) return; const n = (cabNewN[i] || 0); const p = iso(o.x + o.w / 2, o.y + o.d / 2, o.h + 18); badge(ctx, p[0], p[1], n); });
  staff.forEach((p) => { if (p.hidden) return; const n = attRows(p).length; const s = iso(p.x + .5, p.y + .5); badge(ctx, s[0] + 22, s[1] - 92, n); });
}
let last = 0, raf = 0, running = false;
function loop(t) { if (!running) return; const dt = Math.min(.08, (t - last) / 1000 || 0); last = t;
  people.forEach((p) => { if (!p.path.length) return; const [tx, ty] = p.path[0]; const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy), sp = 2.6 * dt;
    if (dx - dy !== 0) p.face = (dx - dy) > 0 ? 1 : -1;
    if (dist <= sp) { p.x = tx; p.y = ty; p.path.shift(); if (!p.path.length && p.res) { const r = p.res; p.res = null; r(); } } else { p.x += dx / dist * sp; p.y += dy / dist * sp; } });
  if (window.ibaOffice3DActive) { try { window.ibaOffice3DFrame(t, window.ibaOffice3DState()); } catch (e) { console.warn('Office 3D frame failed', e); } }
  else { frame(t); composite(); }
  raf = requestAnimationFrame(loop); }
// ---------- side panel ----------
function ampm(t) { const d = new Date(Number(t) || Date.now()); const h = d.getHours(); return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
function log(html) { const ul = Q('.iba-off-feed'); const li = document.createElement('li'); li.innerHTML = `<time>${ampm()}</time><span>${html}</span>`; ul.prepend(li); while (ul.children.length > 40) ul.lastChild.remove(); }
function team() { Q('.iba-off-team').innerHTML = BOTS.map((b) => `<div class="iba-off-mem"><i style="background:${b.hair}"></i><div><b>${esc(b.name)} · ${esc(b.tag)}</b><span data-bot="${esc(b.name)}">${esc(b.status || b.role)}</span></div></div>`).join(''); }
function status(b, s) { b.status = s; const el = Q(`[data-bot="${b.name}"]`); if (el) el.textContent = s; }
let cabN = [], cabNewN = [];
function paintSum() {
  cabN = CABS.map(cabCount); cabNewN = CABS.map(cabNew);
  Q('.iba-off-sum').innerHTML = CABS.map((c, i) => `<button type="button" class="iba-off-sumrow" data-cab="${i}"><span>${esc(c.title)}${!c.printer && !c.rtp && cabNewN[i] ? ` <em>+${cabNewN[i]} new</em>` : ''}</span><b>${cabN[i]}</b></button>`).join('')
    + `<div class="iba-off-note">${loadedAt ? 'Red number on a cabinet = changed today or yesterday. Read ' + ampm(loadedAt) + ' · Rina ' + (rinaOn() ? 'collects by herself' : 'is paused') : ''}</div>`;
}
// ---------- pop-up lists ----------
function money(v) { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
let popState = null;
function showList(title, note, list, recent, side) {
  popState = { list, recent, main: list, side: side || null };
  Q('.iba-off-pop h3').textContent = title; Q('.iba-off-pop p').textContent = note;
  Q('.iba-off-popb').innerHTML = (side ? `<div class="iba-off-tabs"><button type="button" class="on" data-tab="main">Desk (${list.length})</button><button type="button" data-tab="side">Side cabinet (${side.length})</button></div>` : '') + '<div class="iba-off-search"><input type="search" placeholder="Search PO, invoice no., vendor, site, person or value" aria-label="Search"><span class="iba-off-cnt"></span></div><div class="iba-off-rows"></div>';
  const inp = Q('.iba-off-search input'); inp.addEventListener('input', () => renderRows(inp.value));
  Q('.iba-off-popb').querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { Q('.iba-off-popb').querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b)); popState.list = b.dataset.tab === 'side' ? popState.side : popState.main; renderRows(inp.value); }));
  renderRows(''); Q('.iba-off-pop').hidden = false; setTimeout(() => { try { inp.focus(); } catch (_) {} }, 30);
}
function renderRows(q) {
  const { list, recent } = popState || { list: [] }; const t = norm(q); let pick;
  if (t) pick = list.filter((r) => { const pi = poInfo(r.po, r); return [r.po, r.invNumber, r.key, pi.vendor, pi.site, r.site_name, r.attention, r.status, r.invValue].some((v) => norm(v).includes(t)); });
  else pick = recent ? list.filter(isNew) : list;
  const MAX = 150; const shown = pick.slice(0, MAX);
  Q('.iba-off-cnt').textContent = (t ? `${pick.length} found in ${list.length}` : recent ? `${pick.length} changed today or yesterday · ${list.length} in this cabinet · type to search them all` : `${list.length} in total`) + (pick.length > MAX ? ` · showing the newest ${MAX}` : '');
  Q('.iba-off-rows').innerHTML = shown.length ? `<table><thead><tr><th>PO</th><th>Invoice</th><th>Vendor</th><th>Site</th><th>Value</th><th>Status</th><th>Attention</th><th></th></tr></thead><tbody>${shown.map((r) => { const pi = poInfo(r.po, r);
    return `<tr><td><b>${esc(r.po)}</b></td><td>${esc(r.invNumber || r.key)}</td><td>${esc(pi.vendor || '')}</td><td>${esc(pi.site)}</td><td class="n">${esc(money(r.invValue))}</td><td><span class="iba-off-st">${esc(r.status || '')}</span></td><td>${esc(r.attention || '')}</td><td><button type="button" class="iba-off-open" data-po="${esc(r.po)}">Open</button></td></tr>`; }).join('')}</tbody></table>`
    : `<div class="iba-off-empty">${t ? 'Nothing found.' : recent ? 'Nothing changed today or yesterday. Type above to search the whole cabinet.' : 'Nothing here right now.'}</div>`;
}
function hidePop() { Q('.iba-off-pop').hidden = true; }
function openRecords(po) {
  close();
  const nav = document.querySelector('#iba-app-shell [data-iba-nav="im-reporting"]') || document.querySelector('[data-iba-nav="im-reporting"]');
  if (nav) nav.click();
  setTimeout(() => { const inp = document.getElementById('im-reporting-search'); if (inp) { inp.value = po; inp.dispatchEvent(new Event('input', { bubbles: true })); const b = document.getElementById('im-reporting-search-btn'); if (b) b.click(); } }, 600);
}
function openCab(c) {
  if (c.rtp) return openRtp();
  if (c.printer) {
    if (window.ibaPrintBasket && typeof window.ibaPrintBasket.open === 'function') { close(); window.ibaPrintBasket.open(); }
    else log('The print basket is not loaded on this page.');
    return;
  }
  if (c.tray) return openTray();
  if (c.jobs) return showList(c.title, 'Reception entries waiting to become invoices. Rina collects them to your desk from 4:00 to 4:30 PM Qatar time while the Office is open. The ones she is not sure about stay here.', cabRows(c), false);
  showList(c.title, 'Shows what changed today and yesterday. Search finds anything in this cabinet. Read only.', cabRows(c), true);
  log(`Opened the cabinet: <b>${esc(c.title)}</b>.`);
}
// patch 137 (martin): a person's desk = only the work of their job; everything else on them = side cabinet
const ROLE_ST = {
  site: ['For SRV', 'On Hold'], wh: ['For SRV', 'On Hold'], log: ['For SRV', 'On Hold', 'For Inquiry', 'Unresolved'],
  acc: ['Report', 'Report Approval', 'With Accounts'], coo: ['In Process', 'For Approval'], md: ['CEO Approval'],
  me: ['For Approval'], pd: ['For Approval'], fin: ['For Approval', 'For Inquiry'],
};
function openPerson(p) {
  const all = attRows(p), who = p.me ? 'you' : (p.full || p.name);
  const st = ROLE_ST[p.room];
  if (!st) return showList((p.me ? 'You' : p.full || p.name) + ' · waiting', `Open invoices with Attention on ${who}.`, all, false);
  const want = new Set(st.map(norm));
  const desk = all.filter((r) => want.has(norm(r.status))), side = all.filter((r) => !want.has(norm(r.status)));
  showList((p.me ? 'You' : p.full || p.name) + ' · desk', `${st.join(', ')} with Attention on ${who}. Other open tasks on ${who} are in the side cabinet.`, desk, false, side);
}
// ---------- clicks on the canvas ----------
function furnAt(x, y) { return FURN.find((o) => Math.floor(o.x) === x && Math.floor(o.y) === y); }
function furnRect(o) { return { l: iso(o.x, o.y + o.d)[0], r: iso(o.x + o.w, o.y)[0], t: iso(o.x, o.y, o.h)[1] - 24, b: iso(o.x + o.w, o.y + o.d)[1] }; }
function scenePt(ev) { const b = cv.getBoundingClientRect(); return [cam.x + (ev.clientX - b.left) / b.width * cam.w, cam.y + (ev.clientY - b.top) / b.height * cam.h]; }
function pick(ev) {
  const [sx, sy] = scenePt(ev);
  const who = staff.slice().reverse().find((p) => { if (p.hidden) return false; const s = iso(p.x + .5, p.y + .5); return Math.abs(sx - s[0]) < 16 && sy < s[1] + 4 && sy > s[1] - 86; });
  if (who) return { person: who };
  const c = CABS.find((q) => { const o = furnAt(q.at[0], q.at[1]); if (!o) return false; const r = furnRect(o); return sx >= r.l && sx <= r.r && sy >= r.t && sy <= r.b; });
  return c ? { cab: c } : null;
}
cv.addEventListener('mousemove', (e) => { cv.style.cursor = pick(e) ? 'pointer' : 'default'; });
cv.addEventListener('click', (e) => { const h = pick(e); if (!h) return; if (h.person) openPerson(h.person); else openCab(h.cab); });
cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(0, Math.min(1, zoom - (e.deltaY > 0 ? .12 : -.12))); }, { passive: false });
// ---------- bots ----------
async function busy(b, fn) { b.busy = true; b.idleCancel = true; try { await fn(); } finally { b.busy = false; } }
const BOTCAB = { Rina: 'rec', Sami: 'bot', Rafi: 'rep', Ana: 'acc' };
async function botReport(b) {
  if (b.busy) return; const c = CABS.find((q) => q.id === BOTCAB[b.name]); if (!c) return;
  await busy(b, async () => { status(b, 'Checking the cabinet'); b.hidden = false; b.paper = false; await go(b, b.cab); await wait(500); const n = cabCount(c);
    const nn = cabNew(c); say(b, nn ? `${nn} new since yesterday (${n} in all)` : (n ? `Nothing new (${n} in all)` : 'All clear here'), 3600); status(b, nn ? `${nn} new · ${n} in all` : `${n} in all`); await wait(1600); await go(b, b.home); });
}
function botsReport() { BOTS.forEach((b, i) => setTimeout(() => botReport(b), 400 + i * 700)); }
const IDLE = [
  { where: () => SPOT.sofa[Math.floor(Math.random() * SPOT.sofa.length)], say: 'Reading the news', paper: true, ms: 6000, label: 'Break room, reading the news' },
  { where: () => SPOT.pantry[Math.floor(Math.random() * SPOT.pantry.length)], say: 'Snack time', ms: 5000, label: 'Pantry' },
  { where: () => SPOT.wc[Math.floor(Math.random() * 2)], say: '', hide: true, ms: 4000, label: 'Toilet' },
  { where: () => SPOT.cooler, say: 'Water break', ms: 3000, label: 'Water cooler' },
];
async function idleTick() { for (const b of BOTS) { if (b.busy || b.idleBusy) continue; if (Math.random() > .15) continue;
  b.idleBusy = true; b.idleCancel = false; const it = IDLE[Math.floor(Math.random() * IDLE.length)];
  (async () => { const old = b.status; status(b, it.label); await go(b, it.where()); if (b.idleCancel) { b.idleBusy = false; return; } if (it.say) say(b, it.say, 2400); if (it.hide) b.hidden = true; if (it.paper) b.paper = true;
    await wait(it.ms); b.hidden = false; b.paper = false; if (!b.busy) { status(b, old || b.role); await go(b, b.home); } b.idleBusy = false; })(); } }
// ---------- commands ----------
function findAny(term, bot) {
  const b = bot || BOTS[0];
  const sm = term.match(/^(?:site|project)\s*(?:no\.?|#)?\s*(.+)$/i); const siteQ = sm ? norm(sm[1]) : '';
  const q = norm(term); const digits = /^\d{4,}$/.test(term);
  const F = window.ibaFuzzy && typeof window.ibaFuzzy.score === 'function' ? window.ibaFuzzy : null;
  const vScore = {}; // vendor name -> fuzzy score (cached per name)
  const hit = rows.filter((r) => {
    if (digits) return String(r.po) === term || norm(r.invNumber) === q;
    const pi = poInfo(r.po, r);
    if (siteQ) return norm(pi.site) === siteQ || norm(pi.site).includes(siteQ);
    if ([pi.vendor, pi.site, r.attention, r.invNumber, r.po].some((v) => norm(v).includes(q))) return true;
    if (F && pi.vendor) { if (vScore[pi.vendor] == null) { try { vScore[pi.vendor] = F.score(term, pi.vendor); } catch (_) { vScore[pi.vendor] = 0; } } return vScore[pi.vendor] >= .55; }
    return false;
  }).sort((x, y) => dateOf(y) - dateOf(x));
  const vendors = Array.from(new Set(hit.map((r) => poInfo(r.po, r).vendor).filter(Boolean)));
  const pos = new Set(hit.map((r) => r.po));
  say(b, hit.length ? `Found ${pos.size} PO, ${hit.length} invoice(s)` : `Nothing for "${term}"`, 4000);
  if (!hit.length) { log(`<b>${esc(b.name)}</b>: nothing found for "${esc(term)}". Try part of the name, a site or a PO number.`); return; }
  log(`<b>${esc(b.name)}</b> found ${pos.size} PO and ${hit.length} invoice(s) for "${esc(term)}"${vendors.length ? ' (' + esc(vendors.slice(0, 3).join(', ')) + (vendors.length > 3 ? '…' : '') + ')' : ''}.`);
  showList(`Found: ${term}`, `${pos.size} PO · ${hit.length} invoice(s)${vendors.length ? ' · ' + vendors.slice(0, 3).join(', ') + (vendors.length > 3 ? ' and more' : '') : ''}. Newest first. Type to narrow it down.`, hit, false);
}
function findBot(s) { s = s.toLowerCase().trim(); const m = s.match(/bot\s*(\d)/); if (m) return BOTS[+m[1] - 1]; return BOTS.find((b) => s.includes(b.name.toLowerCase())); }
async function command(txt) {
  const s = String(txt || '').trim(); if (!s) return; log(`You: "${esc(s)}"`); const low = s.toLowerCase(); let m;
  if ((m = low.match(/^call\s+(.+)/))) { const b = findBot(m[1]); if (!b) { log('No bot with that name. Bots: Rina, Sami, Rafi, Ana (Bot 1 to 4).'); return; }
    b.idleCancel = true; b.hidden = false; b.paper = false;
    await busy(b, async () => { status(b, 'Coming to your office'); say(b, 'Coming!'); await go(b, SPOT.myFront); say(b, 'Yes boss?', 4000); status(b, 'Waiting in your office'); }); return; }
  // patch 135: "rina find PO for multilink", "find invoices of site 175", "search Imran" -> any word search
  if ((m = s.match(/^(?:(?:bot\s*\d|rina|sami|rafi|ana)\s*,?\s+)?(?:please\s+)?(?:find|search(?:\s+for)?|look\s*for|show(?:\s+me)?|get|where\s+is|check)\s+(.+)$/i))) {
    let term = m[1].trim().replace(/^(?:all\s+)?(?:the\s+)?(?:pos?|p\.o\.?|invoices?|inv|records?)\b\.?\s*(?:no\.?|number|#)?\s*(?:for|of|from|with|by)?\s*/i, '').replace(/[?.!]+$/, '').trim();
    if (term) { findAny(term, findBot(low)); return; }
  }
  if ((m = low.match(/(?:find|show|where(?:\s+is)?)?\s*po\s*#?\s*(\d{4,})/))) { const po = m[1]; const list = rows.filter((r) => String(r.po) === po);
    const b = findBot(low) || BOTS[0]; say(b, list.length ? `PO ${po}: ${list.length} invoice(s)` : `PO ${po} not found`, 3500);
    if (list.length) showList('PO ' + po, 'Every invoice of this PO, with its status and Attention.', list, false); else log(`PO ${esc(po)} is not in the saved copy. Try Refresh.`); return; }
  if ((m = low.match(/(.+?)\s+take a break/))) { const b = findBot(m[1]); if (b && !b.busy) { say(b, 'Thanks boss!'); b.idleBusy = true; status(b, 'Break room, reading the news'); await go(b, SPOT.sofa[0]); b.paper = true; await wait(7000); b.paper = false; status(b, b.role); await go(b, b.home); b.idleBusy = false; } return; }
  if (/^send\b/.test(low)) { log('Sending work to people by command comes in the next step. For now the office only reads.'); return; }
  log('Try: "call Bot 1", "find PO 12345", "Rina find PO for Multilink", "find site 175", "Sami take a break".');
}
Q('.iba-off-cmd').addEventListener('submit', (e) => { e.preventDefault(); const i = Q('#iba-off-in'); const v = i.value; i.value = ''; command(v); });
// ---------- setup (people in rooms) ----------
const CFG_PATH = 'system_settings/office_v1';
const ROOM_SETUP = ['me', 'md', 'coo', 'pd', 'fin', 'hr', 'acc', 'log', 'rec', 'site', 'wh', 'spA', 'spB'];
const BASE_NAMES = {}; ROOMS.forEach((r) => { BASE_NAMES[r.id] = r.name; });
const FIXED_ROOM_NAMES={rec:'Reception',me:'IRWIN',md:'Managing Director',spA:'MEP Manager',fin:'Finance Manager',coo:'COO office',pd:'Project Director',hr:'Procurement',acc:'Accounts',site:'Site room',break:'Lounge'};
function applyNames(){const n=(cfg&&cfg.names)||{};ROOMS.forEach((r)=>{r.name=FIXED_ROOM_NAMES[r.id]||n[r.id]||BASE_NAMES[r.id]||'';});}

async function loadCfg() {
  const d = mainDb(); let v = null;
  if (d) { try { const s = await d.ref(CFG_PATH).once('value'); v = s.val(); } catch (e) { console.warn('Office setup read failed', e); } }
  if (v && v.rooms) { const r = v.rooms; if (r.imran && !r.log) { r.log = r.imran; delete r.imran; } if (r.ceo && !r.md) { r.md = r.ceo; delete r.ceo; } delete r.sort; delete r.meet; }
  cfg = (v && v.rooms) ? v : defaultCfg(); cfg.names = cfg.names || {}; applyNames(); buildStaff();
}
function openSetup() {
  const list = approvers().sort((a, b) => String(a.Name).localeCompare(String(b.Name)));
  const opts = list.map((a) => `<option value="${esc(a.key)}">${esc(a.Name)}${a.Position ? ' · ' + esc(a.Position) : ''}${a.Site ? ' · ' + esc(a.Site) : ''}</option>`).join('');
  const rooms = (cfg && cfg.rooms) || {};
  Q('.iba-off-pop h3').textContent = 'Office setup';
  Q('.iba-off-pop p').textContent = 'Put people in rooms, pick a suit colour, and rename a room (Office A / Office B are spare rooms for a new department). Same-name users stay separate (picked by their user record). Saved for the office only.';
  Q('.iba-off-popb').innerHTML = ROOM_SETUP.map((id) => { const label = id === 'me' ? 'Your office' : (FIXED_ROOM_NAMES[id] || (cfg.names || {})[id] || BASE_NAMES[id] || 'Support / expansion'); return `<div class="iba-off-room" data-room="${id}"><h4>${id === 'me' ? 'Your office' : `<input class="iba-off-rname" value="${esc(label)}" aria-label="Room name" maxlength="28">`} <small>${(SEATS[id] || []).length} desks</small></h4><div class="iba-off-ppl">${(rooms[id] || []).map((m) => pplRow(m)).join('')}</div><div class="iba-off-add"><select aria-label="Add a person to ${esc(label)}"><option value="">+ Add person…</option>${opts}</select></div></div>`; }).join('')
    + '<div class="iba-off-actions"><button type="button" class="iba-off-save">Save</button><button type="button" class="iba-off-reset">Reset to suggested</button></div>';
  Q('.iba-off-pop').hidden = false;
}
function pplRow(m) { const h = hash(m.name || m.key); const suit = m.suit || SUIT[(h >> 5) % SUIT.length];
  return `<div class="iba-off-p" data-key="${esc(m.key)}" data-name="${esc(m.name)}"><span>${esc(m.name)}</span><input type="color" value="${esc(suit)}" aria-label="Suit colour"><label><input type="checkbox" ${m.beard ? 'checked' : ''}> beard</label><button type="button" class="iba-off-rm" aria-label="Remove">×</button></div>`; }
async function saveSetup() {
  const rooms = {};
  root.querySelectorAll('.iba-off-room').forEach((el) => { const id = el.dataset.room; const max = (SEATS[id] || []).length;
    rooms[id] = Array.from(el.querySelectorAll('.iba-off-p')).slice(0, max).map((p) => ({ key: p.dataset.key, name: p.dataset.name, suit: p.querySelector('input[type=color]').value, beard: p.querySelector('input[type=checkbox]').checked })); });
  const names = {}; root.querySelectorAll('.iba-off-room').forEach((el) => { const i = el.querySelector('.iba-off-rname'); if (i && i.value.trim() && i.value.trim() !== BASE_NAMES[el.dataset.room]) names[el.dataset.room] = i.value.trim().slice(0, 28); });
  cfg = { rooms, names }; applyNames(); buildStaff(); applyPresence(true);
  const d = mainDb();
  if (d) { try { await d.ref(CFG_PATH).set({ rooms, names, by: meName(), at: firebase.database.ServerValue.TIMESTAMP }); log('Office setup saved.'); } catch (e) { console.warn(e); log('Could not save the setup (kept for now).'); } }
  hidePop();
}
root.addEventListener('change', (e) => {
  const sel = e.target.closest('.iba-off-add select'); if (!sel || !sel.value) return;
  const a = approvers().find((x) => x.key === sel.value); const box = sel.closest('.iba-off-room').querySelector('.iba-off-ppl');
  if (a && !box.querySelector(`[data-key="${CSS.escape(a.key)}"]`)) box.insertAdjacentHTML('beforeend', pplRow({ key: a.key, name: String(a.Name).trim() }));
  sel.value = '';
});
root.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.iba-off-rm')) { t.closest('.iba-off-p').remove(); return; }
  if (t.closest('.iba-off-save')) { saveSetup(); return; }
  if (t.closest('.iba-off-reset')) { cfg = defaultCfg(); openSetup(); return; }
  if (t.closest('.iba-off-open')) { openRecords(t.closest('.iba-off-open').dataset.po); return; }
  if (t.closest('.iba-off-popx') || t.classList.contains('iba-off-pop')) { hidePop(); return; }
  const sr = t.closest('.iba-off-sumrow'); if (sr) { openCab(CABS[+sr.dataset.cab]); return; }
  const b = t.closest('.iba-off-ctrl button'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'close') close();
  else if (act === 'theme') setOfficeTheme(officeTheme === 'pixel' ? 'clean' : 'pixel');
  else if (act === 'zin') zoom = Math.min(1, zoom + .25);
  else if (act === 'zout') zoom = Math.max(0, zoom - .25);
  else if (act === 'me' || act === 'all') { zoom = act === 'me' ? 1 : 0; try { localStorage.setItem(START_KEY, act); } catch (_) {} log(act === 'me' ? 'Opens on your office from now on.' : 'Opens on the whole office from now on.'); }
  else if (act === 'refresh') loadData().then(botsReport);
  else if (act === 'setup') openSetup();
  else if (act === 'away') openAway();
});
document.addEventListener('keydown', (e) => { if (root.hidden || e.key !== 'Escape') return; if (!Q('.iba-off-pop').hidden) hidePop(); else close(); });
// ==========================================================================
// patch 137 (martin): the bots do real work, two tasks only for now.
//  1. Rina collects your Reception entries (WorkDesk jobs for Invoice) by herself:
//     each becomes an invoice in Under Review (same routine as "New entries to
//     Batch": next Inv Entry ID, PO-style invoice no., auto invoice name) and the
//     reception entry is closed as Converted to Invoice. Not sure (no PO in the
//     list, no invoice no. or amount, invoice no. already on the PO) = stays in
//     Reception for you.
//  2. Your desk tray = every Under Review invoice. You tick For SRV or Report
//     (Rina pre-ticks: IPC in the invoice no. = Report), fix the invoice name or who
//     it goes to, and press Done. Sami sends them 10 s later (Undo until then):
//     For SRV -> the site DC (same routing as Batch Entry), Report -> Gio.
//  The bots never decide alone: nothing leaves your desk without your Done.
// ==========================================================================
const RINA_KEY = 'iba-office-rina-v1';
function rinaOn() { try { return localStorage.getItem(RINA_KEY) !== 'off'; } catch (_) { return true; } }
function setRina(on) { try { localStorage.setItem(RINA_KEY, on ? 'on' : 'off'); } catch (_) {} }
const G = (n) => { try { return eval('typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined'); } catch (_) { return undefined; } }; // app globals (let/const live outside window)
const invDb = () => G('invoiceDb') || null;
const today = () => { const f = G('getTodayDateString'); if (typeof f === 'function') return f(); const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nameText = (v) => { const f = G('normalizeNameText'); return typeof f === 'function' ? f(v) : String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); };
const cutText = (v, n) => { const f = G('truncateNameText'); return typeof f === 'function' ? f(v, n) : String(v || '').slice(0, n).trim(); };
const TS = () => { try { return firebase.database.ServerValue.TIMESTAMP; } catch (_) { return Date.now(); } };
const amountOk = (v) => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) > 0;
const NN = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---- Reception cabinet = your reception entries (saved Job Records copy, no big read) ----
let jobRows = [], jobUnsure = {};
async function loadJobs() {
  const f = G('fetchInvoiceEntrySidePanelJobs');
  if (typeof f !== 'function') { jobRows = []; return; }
  try {
    const list = (await f(true)) || [];
    jobRows = list.filter((j) => j && j.key && j.source === 'job_entry').map((j) => {
      const po = String(j.po || '').trim().toUpperCase();
      return { po, key: j.key, job: j, invNumber: j.ref || '', invValue: j.amount || '', status: jobUnsure[j.key] ? 'Needs you: ' + jobUnsure[j.key] : 'New Entry',
        attention: j.enteredBy || '', site_name: j.site || '', vendor_name: j.vendorName || j.vendor || '', timestamp: Number(j.timestamp) || 0, releaseDate: j.date || '' };
    }).sort((a, b) => dateOf(b) - dateOf(a));
  } catch (e) { console.warn('Office: reception list failed', e); }
}

// ---- Rina: reception entry -> Under Review invoice ----
let collecting = false;
async function makeInvoice(j) {
  const db1 = invDb(), RB = window.ibaReceptionBatch;
  const po = String(j.po || '').trim().toUpperCase();
  const fresh = (await (G('imReadPOInvoicesFresh') || (async () => null))(po)) || {};
  const nf = RB.numberFor(po, j.ref, fresh, null);
  const dup = Object.keys(fresh).map((k) => fresh[k]).find((v) => v && v.invNumber && (NN(v.invNumber) === NN(j.ref) || NN(v.invNumber) === NN(nf.no)));
  if (dup) return { unsure: 'invoice no. already on this PO (' + (dup.invEntryID || dup.invNumber) + ')' };
  // claim the entry first: two open offices (or Batch Entry at the same time) never make it twice
  const now = (await mainDb().ref('job_entries/' + j.key).once('value')).val();
  if (!now || now.convertedToInvoice || /converted/i.test(String(now.remarks || ''))) return { skip: true };
  const claim = await mainDb().ref('job_entries/' + j.key + '/ibaOfficeClaim').transaction((cur) => (cur ? undefined : Date.now()));
  if (!claim || !claim.committed) return { skip: true };
  const used = (G('imUsedInvEntryNumbers') || (() => ({ max: 0 })))(fresh);
  const invEntryID = (G('imInvEntryIdFromNumber') || ((n) => 'INV-' + String(n).padStart(2, '0')))((used.max || 0) + 1);
  const pd = (G('allPOData') || {})[po] || {};
  const site = nameText(pd['Project ID'] || pd['Project ID:'] || j.site || 'N/A');
  const vendor = nameText(pd['Supplier Name'] || pd['Supplier Name:'] || j.vendorName || 'N/A');
  let group = j.group || j.category || 'Normal'; try { const g = G('imNormalizeInvoiceGroupValue'); if (typeof g === 'function') group = g(group); } catch (_) {}
  group = nameText(group) || 'Normal';
  const amt = String(j.amount || '').replace(/[,\s]/g, '');
  const inv = {
    invNumber: nf.no, invName: nameText(`${site}-${po}-${invEntryID}-${cutText(vendor, 21) || 'Vendor'}`), details: '', srvName: '',
    invoiceDate: RB.isoDate(j.invoiceDate || j.date) || today(), invValue: amt, amountPaid: amt, status: 'Under Review', attention: '',
    summaryNote: '', note: '', group, invoiceGroup: group, releaseDate: today(), lastUpdated: TS(),
    invEntryID, vendor_name: vendor, vendor_id: pd['Supplier ID'] || pd['Vendor ID'] || '', po_number: po, site_name: site,
    enteredAt: TS(), enteredBy: meName(), collectedBy: 'Rina (IBA Office)',
  };
  const fake = { dataset: { jobKey: j.key, jobTs: String(Number(j.timestamp) || ''), jobDate: String(j.date || j.dateEntered || ''), jobBy: String(j.enteredBy || '') }, getAttribute: () => group };
  const jobKey = RB.prepare(fake, inv);
  if (window.ibaApprovals && window.ibaApprovals.prepareStatusSave) { try { await window.ibaApprovals.prepareStatusSave(po, '', {}, inv, 'Under Review'); } catch (_) {} }
  const ref = db1.ref('invoice_entries/' + po).push();
  await ref.set(inv);
  await RB.convert(jobKey, po, ref.key, inv);
  try { const u = G('updateInvoiceTaskLookup'); if (typeof u === 'function') await u(po, ref.key, inv, null); } catch (_) {}
  try { if (window.logInvoiceHistory) await window.logInvoiceHistory(po, ref.key, 'Under Review', 'Collected from Reception by Rina (IBA Office)' + (nf.changed ? ' · invoice no. ' + j.ref + ' -> ' + nf.no : '')); } catch (_) {}
  try { const all = G('allInvoiceData'); if (all) { all[po] = all[po] || {}; all[po][ref.key] = Object.assign({ key: ref.key }, inv); } window.__imInvoiceReportingDirty = true; } catch (_) {}
  return { ok: true, po, key: ref.key, inv };
}
async function rinaCollect() {
  if (collecting || !rinaOn() || !running || !allowed()) return;
  const qMin = qatarMin(); if (qMin < 16 * 60 || qMin >= 16 * 60 + 30) return;
  const RB = window.ibaReceptionBatch, b = BOTS[0];
  if (!RB || !RB.numberFor || !RB.prepare || !RB.convert || !invDb() || !mainDb()) return;
  const todo = jobRows.filter((r) => !jobUnsure[r.key]);
  if (!todo.length) return;
  collecting = true;
  try {
    b.idleCancel = true;
    for (let i = 0; i < 40 && (b.busy || b.idleBusy); i++) await wait(500);
    const made = [], unsure = [];
    await busy(b, async () => {
      await ensurePOList();
      status(b, `Collecting ${todo.length} from Reception`); b.hidden = false; await go(b, b.cab); say(b, `${todo.length} new at Reception, taking them`, 2600); await wait(900); b.carry = true;
      for (const r of todo) {
        const j = r.job; let why = '';
        if (!r.po) why = 'no PO on the entry'; else if (!String(j.ref || '').trim()) why = 'no invoice no.'; else if (!amountOk(j.amount)) why = 'no amount';
        else if (!(G('allPOData') || {})[r.po]) why = 'PO not in the PO list yet';
        if (!why) { try { const out = await makeInvoice(j); if (out.ok) { made.push(out); continue; } if (out.skip) continue; why = out.unsure; } catch (e) { console.warn('Office: Rina could not collect', r.po, e); why = 'could not save (' + ((e && e.message) || 'error') + ')'; } }
        jobUnsure[r.key] = why; unsure.push(`PO ${esc(r.po || '—')} ${esc(j.ref || '')}: ${esc(why)}`);
      }
      if (made.length) await loadData(true); else { await loadJobs(); paintSum(); }
      await go(b, SPOT.myFront); b.carry = false;
      say(b, made.length ? `${made.length} on your desk for review` + (unsure.length ? `, ${unsure.length} need you` : '') : `${unsure.length} need you at Reception`, 4200);
      status(b, made.length ? `Put ${made.length} on your desk` : 'Some need you'); await wait(1800); await go(b, b.home);
    });
    if (made.length) log(`<b>Rina</b> collected <b>${made.length}</b> from Reception into Under Review on your desk: ${made.map((m) => esc(m.po + ' ' + m.inv.invNumber)).join(', ')}.`);
    if (unsure.length) log(`<b>Rina</b> left ${unsure.length} at Reception for you: ${unsure.join('; ')}.`);
  } finally { collecting = false; }
}

// ---- your desk tray ----
// martin: invoice no. with IPC = Report (to Gio); everything else = For SRV (to the site's SRV person)
function guessTask(r) {
  if (/ipc/i.test(String(r.invNumber || '') + ' ' + String(r.invName || ''))) return { task: 'Report', why: 'IPC in the invoice no. / name' };
  return { task: 'For SRV', why: 'no IPC in the invoice no.' };
}
async function whoFor(task, r) {
  const site = poInfo(r.po, r).site, group = r.group || r.invoiceGroup || 'Normal';
  try {
    if (task === 'Report') { const f = G('imBatchFixedAttentionForStatus'); const n = typeof f === 'function' ? f('Report') : ''; return { pick: n || 'Gio', list: [n || 'Gio'], why: 'Report always goes to ' + (n || 'Gio') }; }
    // martin: the bot must KNOW who does SRV for the site: 1) the person you last sent this site to,
    // 2) the person on this site's latest For SRV invoices, 3) only then the normal site routing
    const learned = srvPersonFor(site);
    const cf = G('imBatchGetAttentionCandidatesForSRV'), bf = G('imSrvBestCandidate');
    let names = [], route = '';
    if (typeof cf === 'function') { const c = await cf(site, group); names = Array.from(new Set(c.map((x) => x.name).filter(Boolean))).filter((n) => !/^irwin$/i.test(n) || c.length === 1); route = (typeof bf === 'function' && bf(c)) || names[0] || ''; }
    if (learned) return { pick: learned.name, why: learned.why, list: [learned.name].concat(learned.others, names) };
    return { pick: route, why: route ? 'site routing (no SRV history for site ' + site + ' yet)' : '', list: names };
  } catch (_) {}
  return { pick: '', list: [] };
}
const SRV_MEM = 'iba-office-srv-site-v1';
function srvMem() { try { return JSON.parse(localStorage.getItem(SRV_MEM) || '{}') || {}; } catch (_) { return {}; } }
function rememberSrv(site, name) { if (!site || !name) return; try { const m = srvMem(); m[norm(site)] = { name, at: Date.now() }; localStorage.setItem(SRV_MEM, JSON.stringify(m)); } catch (_) {} }
function srvPersonFor(site) {
  const s = norm(site); if (!s || s === 'n/a') return null;
  const mine = srvMem()[s];
  // who has this site's For SRV invoices, newest first (the SRV person keeps them until SRV Done)
  const seen = {}; rows.filter((v) => /\bsrv\b/i.test(String(v.status || '')) && String(v.attention || '').trim() && norm(poInfo(v.po, v).site) === s)
    .sort((a, b) => dateOf(b) - dateOf(a)).forEach((v) => { const n = String(v.attention).trim(); const k = norm(n); if (!seen[k]) seen[k] = { name: n, n: 0, last: dateOf(v) }; seen[k].n++; });
  const ranked = Object.keys(seen).map((k) => seen[k]).sort((a, b) => b.last - a.last);
  if (mine && mine.name) return { name: mine.name, why: `you last sent site ${site} SRV to ${mine.name}`, others: ranked.map((x) => x.name) };
  if (ranked.length) return { name: ranked[0].name, why: `site ${site} SRV is with ${ranked[0].name} (${ranked[0].n} now)`, others: ranked.slice(1).map((x) => x.name) };
  return null;
}
let tray = null;
const uid = (r) => r.po + '/' + r.key;
function autoName(r) { const pi = poInfo(r.po, r); return nameText(`${nameText(pi.site || 'N/A')}-${r.po}-${nameText(r.invEntryID || 'INV-XX')}-${cutText(nameText(pi.vendor || 'N/A'), 21) || 'Vendor'}`); } // { rows, choice: {key: {task, name, to}}, timer }
async function openTray() {
  const list = (byStatus['Under Review'] || []).slice().sort((a, b) => String(poInfo(a.po, a).site).localeCompare(String(poInfo(b.po, b).site), undefined, { numeric: true }) || String(a.po).localeCompare(String(b.po), undefined, { numeric: true }));
  const names = approvers().map((a) => String(a.Name || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  tray = { rows: list, choice: {}, names };
  for (const r of list) { const g = guessTask(r); const w = await whoFor(g.task, r); tray.choice[uid(r)] = { task: g.task, why: g.why, toWhy: w.why || '', name: r.invName || autoName(r), to: w.pick, cands: w.list, cand: { [g.task]: w.list }, candWhy: { [g.task]: w.why || '' } }; }
  Q('.iba-off-pop h3').textContent = 'Your desk · Under Review';
  Q('.iba-off-pop p').textContent = 'Sorted by site. Rina pre-ticked each one: IPC in the invoice no. = Report (to Gio), else For SRV (to the person who does SRV for that site). Change anything, then press Done and Sami sends them. "Later" keeps it on your desk.';
  Q('.iba-off-popb').innerHTML = `<div class="iba-off-trayhead"><label><input type="checkbox" class="iba-off-rina" ${rinaOn() ? 'checked' : ''}> Rina collects Reception entries 4:00–4:30 PM</label><span class="iba-off-cnt">${list.length} on your desk</span><button type="button" class="iba-off-copyall" title="Same list as the Under Review list skill: no header, tab between cells, one row per invoice name, vendor A-Z">Copy all for Excel</button></div><div class="iba-off-rows"></div><div class="iba-off-actions"><button type="button" class="iba-off-done">Done</button><span class="iba-off-undo" hidden></span></div>`;
  paintTray(); Q('.iba-off-pop').hidden = false;
}
function optList(c) { const seen = new Set(); const out = []; (c.cands || []).concat(tray.names).forEach((n) => { const k = norm(n); if (!n || seen.has(k)) return; seen.add(k); out.push(n); }); if (c.to && !seen.has(norm(c.to))) out.unshift(c.to); return out; }
function paintTray() {
  const box = Q('.iba-off-rows'); if (!box || !tray) return;
  if (!tray.rows.length) { box.innerHTML = '<div class="iba-off-empty">Your desk is clear. Nothing in Under Review.</div>'; Q('.iba-off-done').disabled = true; return; }
  box.innerHTML = `<table class="iba-off-tray"><thead><tr><th>PO</th><th>Invoice</th><th>Vendor · Site</th><th>Value</th><th>Invoice name</th><th>Task</th><th>Goes to</th></tr></thead><tbody>${tray.rows.map((r) => { const pi = poInfo(r.po, r), c = tray.choice[uid(r)];
    const radio = (t, l) => `<label class="iba-off-tk"><input type="radio" name="tk-${esc(uid(r))}" value="${t}" ${c.task === t ? 'checked' : ''}> ${l}</label>`;
    return `<tr data-k="${esc(uid(r))}" class="${c.task === 'Later' ? 'is-later' : ''}"><td><b>${esc(r.po)}</b><br><small>${esc(r.invEntryID || '')}</small></td><td>${esc(r.invNumber || '')}</td><td>${esc(pi.vendor || '')}<br><small>Site ${esc(pi.site || '')}</small></td><td class="n">${esc(money(r.invValue))}</td>
      <td><div class="iba-off-name"><input type="text" value="${esc(c.name)}" data-f="name" aria-label="Invoice name"><button type="button" data-copy title="Copy the name">Copy</button></div></td>
      <td>${radio('For SRV', 'For SRV')}${radio('Report', 'Report')}${radio('Later', 'Later')}<small class="iba-off-why">${esc(c.why)}</small></td>
      <td><select data-f="to" ${c.task === 'Later' ? 'disabled' : ''}>${optList(c).map((n) => `<option ${norm(n) === norm(c.to) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>${c.task !== 'Later' && c.toWhy ? `<small class="iba-off-why">${esc(c.toWhy)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table>`;
  const n = tray.rows.filter((r) => tray.choice[uid(r)].task !== 'Later').length;
  const d = Q('.iba-off-done'); d.disabled = !n || !!tray.timer; d.textContent = n ? `Done · send ${n}` : 'Done';
}
Q('.iba-off-pop').addEventListener('change', async (e) => {
  const t = e.target; if (t.classList.contains('iba-off-rina')) { setRina(t.checked); log(t.checked ? '<b>Rina</b> collects Reception entries by herself again.' : '<b>Rina</b> paused: Reception entries stay at Reception.'); paintSum(); if (t.checked) rinaCollect(); return; }
  const tr = t.closest('tr[data-k]'); if (!tr || !tray) return; const c = tray.choice[tr.dataset.k], r = tray.rows.find((x) => uid(x) === tr.dataset.k);
  if (t.type === 'radio') { c.task = t.value; if (c.task !== 'Later') { if (!c.cand[c.task]) { const w = await whoFor(c.task, r); c.cand[c.task] = w.list; c.candWhy[c.task] = w.why || ''; c.to = w.pick; } else c.to = (c.cand[c.task][0] || c.to); c.cands = c.cand[c.task]; c.toWhy = c.candWhy[c.task] || ''; } paintTray(); }
  else if (t.dataset.f === 'to') { c.to = t.value; c.toWhy = 'you picked'; paintTray(); }
});
Q('.iba-off-pop').addEventListener('input', (e) => { const t = e.target; if (t.dataset.f !== 'name' || !tray) return; const tr = t.closest('tr[data-k]'); if (tr) tray.choice[tr.dataset.k].name = t.value; });
Q('.iba-off-pop').addEventListener('click', (e) => {
  const cp = e.target.closest('[data-copy]'); if (cp) { const i = cp.parentElement.querySelector('input'); try { navigator.clipboard.writeText(i.value); } catch (_) { i.select(); document.execCommand('copy'); } cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1200); return; }
  if (e.target.closest('.iba-off-copyall')) { const b = e.target.closest('.iba-off-copyall'); const t = trayTsv(); const ok = () => { b.textContent = `Copied ${t.n} rows`; setTimeout(() => { b.textContent = 'Copy all for Excel'; }, 1800); };
    try { navigator.clipboard.writeText(t.tsv).then(ok, () => { const a = document.createElement('textarea'); a.value = t.tsv; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); ok(); }); } catch (_) {} log(`Copied ${t.n} Under Review rows for Excel.`); return; }
  if (e.target.closest('.iba-off-done')) return trayDone();
  if (e.target.closest('[data-undo]')) { if (tray && tray.timer) { clearInterval(tray.timer); tray.timer = null; Q('.iba-off-undo').hidden = true; paintTray(); log('Sending cancelled. Nothing changed.'); } }
});
// patch 138 (martin): "Copy all" = exactly the Under Review list skill (xl_ur): Time, PO, Site, Inv No, Inv name,
// Inv Amount, Amount Paid, Status; no header, tabs; vendor A-Z, PO, invoice date; one row per invoice name.
// The name is the one in the box (your fix included).
function trayTsv() {
  const reached = (r) => { const f = G('ibaStatusReachedAt'); const t = typeof f === 'function' ? f(r, 'under review') : Number(r.statusChangedAt) || 0; return t || 0; };
  const day = (t) => { if (!t) return ''; if (typeof window.ibaDay === 'function') return window.ibaDay(t); const d = new Date(t); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'); };
  const clock = (t) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)); } catch (_) { return ''; } };
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
  const list = tray.rows.map((r) => { const pi = poInfo(r.po, r), c = tray.choice[uid(r)] || {}; const at = reached(r);
    return { since: at ? day(at) + ' ' + clock(at) : '', po: r.po, site: pi.site || '', no: String(r.invNumber || '').trim(), file: String(c.name || r.invName || '').trim(), value: num(r.invValue), paid: num(r.amountPaid), status: r.status || 'Under Review', vendor: pi.vendor || '', idate: Date.parse(r.invoiceDate || '') || 0 }; });
  list.sort((x, y) => String(x.vendor || '~').localeCompare(String(y.vendor || '~'), undefined, { sensitivity: 'base' }) || String(x.po).localeCompare(String(y.po), undefined, { numeric: true }) || (x.idate - y.idate) || x.no.localeCompare(y.no, undefined, { numeric: true }));
  const seen = new Set(), keep = list.filter((r) => { const n = norm(r.file); if (n && seen.has(n)) return false; if (n) seen.add(n); return true; });
  const cell = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ').trim();
  return { n: keep.length, tsv: keep.map((r) => [r.since, r.po, r.site, r.no, r.file, r.value.toFixed(2), r.paid.toFixed(2), r.status].map(cell).join('\t')).join('\r\n') };
}
function trayDone() {
  if (!tray || tray.timer) return;
  const send = tray.rows.filter((r) => tray.choice[uid(r)].task !== 'Later').map((r) => ({ r, c: Object.assign({}, tray.choice[uid(r)]) }));
  const bad = send.find((x) => !String(x.c.to || '').trim()); if (bad) { log(`PO ${esc(bad.r.po)}: pick who it goes to first.`); return; }
  if (!send.length) return;
  let left = 10; const u = Q('.iba-off-undo'); u.hidden = false;
  const show = () => { u.innerHTML = `Sami sends ${send.length} in ${left} s <button type="button" data-undo>Undo</button>`; };
  show(); Q('.iba-off-done').disabled = true;
  tray.timer = setInterval(() => { left--; if (left > 0) return show(); clearInterval(tray.timer); tray.timer = null; u.innerHTML = 'Sending…'; samiSend(send); }, 1000);
}
async function sendOne(x) {
  const db1 = invDb(); const { r, c } = x; const path = `invoice_entries/${r.po}/${r.key}`;
  const orig = (await db1.ref(path).once('value')).val();
  if (!orig) return 'gone';
  if (norm(orig.status) !== 'under review') return 'changed to ' + (orig.status || '?') + ' by someone';
  const upd = { status: c.task, attention: c.to, releaseDate: today(), statusChangedAt: TS(), lastUpdated: TS(), updatedAt: TS(), updatedBy: meName() };
  if (c.task === 'For SRV') upd.forSrvAt = TS();
  const nm = nameText(c.name); if (nm && nm !== nameText(orig.invName)) upd.invName = nm;
  if (window.ibaApprovals && window.ibaApprovals.prepareStatusSave) { try { await window.ibaApprovals.prepareStatusSave(r.po, r.key, orig, upd, c.task); } catch (_) {} }
  await db1.ref(path).update(upd);
  try { const f = G('updateInvoiceTaskLookup'); if (typeof f === 'function') await f(r.po, r.key, Object.assign({}, orig, upd), String(orig.attention || '').trim()); } catch (_) {}
  try { if (window.logInvoiceHistory) await window.logInvoiceHistory(r.po, r.key, c.task, `Sorted in IBA Office by ${meName()} · Sami sent it to ${c.to}`); } catch (_) {}
  try { const all = G('allInvoiceData'); if (all && all[r.po] && all[r.po][r.key]) Object.assign(all[r.po][r.key], upd); window.__imInvoiceReportingDirty = true; } catch (_) {}
  return '';
}
async function samiSend(send) {
  const b = BOTS[1]; const done = [], fail = [];
  for (const x of send) { try { const why = await sendOne(x); if (why) fail.push(`PO ${esc(x.r.po)}: ${esc(why)}`); else done.push(x); } catch (e) { console.warn('Office: Sami could not send', x.r.po, e); fail.push(`PO ${esc(x.r.po)}: could not save`); } }
  done.forEach((x) => { if (x.c.task === 'For SRV') rememberSrv(poInfo(x.r.po, x.r).site, x.c.to); });
  if (done.length) log(`<b>Sami</b> sent ${done.length}: ${done.map((x) => esc(`${x.r.po} ${x.c.task} → ${x.c.to}`)).join(', ')}.`);
  if (fail.length) log(`<b>Sami</b> did not send ${fail.length}: ${fail.join('; ')}.`);
  hidePop(); tray = null;
  const srv = done.filter((x) => x.c.task === 'For SRV').length, rep = done.length - srv;
  busy(b, async () => { status(b, 'Delivering'); b.hidden = false; await go(b, SPOT.myFront); b.carry = true; say(b, `Taking ${done.length}`, 1800); await wait(700);
    if (srv) { await go(b, [31, 32]); say(b, `${srv} For SRV delivered`, 2600); await wait(1400); }
    if (rep) { await go(b, [16, 32]); say(b, `${rep} for Gio`, 2600); await wait(1400); }
    b.carry = false; status(b, b.role); await go(b, b.home); });
  await loadData(true);
}

// ==========================================================================
// patch 139 (martin): "I'm in" button = Lunch / Toilet / Meeting / Out of office / Back.
// Your avatar walks there, your chair shows "At lunch · 12:40". Saved in system_settings/office_away/{yourKey}
// (its own node: the chat's presence/{key} is rewritten on every sign-in/reconnect). Older than 12 h = ignored.
// ==========================================================================
const AWAY_ROOT = 'system_settings/office_away'; // same branch as the office setup (already allowed by the rules)
const AWAY = {
  lunch: { label: 'At lunch', btn: 'Lunch', spots: () => SPOT.pantry },
  toilet: { label: 'In the toilet', btn: 'Toilet', spots: () => SPOT.wc, hide: true },
  meeting: { label: 'In a meeting', btn: 'Meeting', spots: () => MEET_SEATS.map(([x, y]) => [x, y]) },
  out: { label: 'Out of office', btn: 'Out of office', spots: () => [[0, 21]], hide: true },
};
let awayAll = {}, myAway = null;
function hhmm(t) { return ampm(t); }
function awayText(a) { const k = AWAY[a.what]; return (k ? k.label : 'Away') + ' · ' + hhmm(a.since); }
function awayOf(p) { const a = awayAll[String(p.key)] || null; if (!a || !AWAY[a.what]) return null; const t = Number(a.since) || 0; if (t && Date.now() - t > 12 * 3600e3) return null; return a; }
function placeAway(p, a, walk) {
  const was = p.away; p.away = a || null;
  if (p.inside === false) { p.hidden = true; if (a && AWAY[a.what]) { const all = AWAY[a.what].spots(); p.awaySpot = all[0]; } return; }
  if (!a) { if (was) { p.hidden = false; if (walk) go(p, p.home); else { p.x = p.home[0]; p.y = p.home[1]; p.path = []; } } return; }
  const k = AWAY[a.what], all = k.spots();
  const taken = (q) => staff.some((o) => o !== p && o.away && o.awaySpot && o.awaySpot[0] === q[0] && o.awaySpot[1] === q[1]) || BOTS.some((b) => Math.round(b.x) === q[0] && Math.round(b.y) === q[1]);
  const to = k.hide ? all[0] : (all.find((q) => !taken(q)) || all[hash(p.key || p.name) % all.length]); p.awaySpot = to;
  if (walk) { p.hidden = false; go(p, to).then(() => { if (p.away === a && k.hide) p.hidden = true; }); }
  else { p.x = to[0]; p.y = to[1]; p.path = []; p.hidden = !!k.hide; }
}
function applyAway() {
  staff.forEach((p) => { const a = awayOf(p); const same = (a && p.away && a.what === p.away.what && a.since === p.away.since) || (!a && !p.away);
    if (same) return; if (p.me) { myAway = a; paintAwayBtn(); }
    if (!p.me || !p.away) placeAway(p, a, false);
    if (!p.me && a && p.hidden === false && AWAY[a.what].hide) p.hidden = true; });
}
function paintAwayBtn() { const b = Q('.iba-off-away'); if (b) { b.textContent = myAway ? awayText(myAway) : "I'm in"; b.classList.toggle('is-away', !!myAway); } }
function openAway() {
  Q('.iba-off-pop h3').textContent = myAway ? awayText(myAway) : "You're in the office";
  Q('.iba-off-pop p').textContent = 'Pick where you are going. Your avatar walks there and your chair shows it, so everyone looking at the office knows you are away.';
  Q('.iba-off-popb').innerHTML = `<div class="iba-off-awaybtns">${Object.keys(AWAY).map((k) => `<button type="button" data-away="${k}" class="${myAway && myAway.what === k ? 'on' : ''}">${AWAY[k].btn}</button>`).join('')}<button type="button" data-away="" class="iba-off-back">Back at my desk</button></div>`;
  Q('.iba-off-pop').hidden = false;
}
async function setAway(what) {
  const me = staff.find((p) => p.me), u = meUser() || {}, key = String(u.key || (me && me.key) || '');
  const a = what ? { what, since: Date.now(), name: meName() } : null;
  myAway = a; paintAwayBtn(); hidePop();
  if (me) placeAway(me, a, true);
  if (key) { awayAll[key] = a; const d = mainDb(); if (d) { try { if (a) await d.ref(AWAY_ROOT + '/' + key).set({ what, since: TS(), name: meName() }); else await d.ref(AWAY_ROOT + '/' + key).remove(); } catch (e) { console.warn('Office: away not saved', e); log('Could not save where you are. Check the connection.'); } } }
  log(a ? `You: <b>${esc(AWAY[what].label)}</b>.` : 'You are back at your desk.');
  if (!a) { const r = BOTS[0]; const n = (byStatus['Under Review'] || []).length; if (n) setTimeout(() => say(r, `Welcome back! ${n} on your desk`, 3200), 1200); }
}
Q('.iba-off-pop').addEventListener('click', (e) => { const b = e.target.closest('[data-away]'); if (b) setAway(b.dataset.away || null); });

// ==========================================================================
// patch 140 (martin): Ready to Print. The logic lives in js/iba-office-print.js
// (loaded with the office); here only the glue: the printer opens it, Rafi walks.
// ==========================================================================
function rtpCtx() {
  return {
    body: Q('.iba-off-popb'), title: (t) => { Q('.iba-off-pop h3').textContent = t; }, note: (t) => { Q('.iba-off-pop p').textContent = t; },
    show: () => { Q('.iba-off-pop').hidden = false; }, log, poInfo, refreshSum: paintSum,
    basket: () => openCab(CABS.find((q) => q.printer)),
    botSay: (n, t) => { const b = BOTS.find((q) => q.name === n); if (b && !b.busy) busy(b, async () => { b.hidden = false; await go(b, SPOT.myFront); say(b, t, 3200); await wait(2600); await go(b, b.home); }); },
    botWalk: (n, t) => { const b = BOTS.find((q) => q.name === n); if (b && !b.busy) busy(b, async () => { status(b, 'Printing'); b.hidden = false; b.paper = true; await go(b, SPOT.myFront); say(b, t, 3000); await wait(2200); b.paper = false; status(b, b.role); await go(b, b.home); }); },
  };
}
function rtpScan(list, n) { try { if (window.ibaOfficePrint) window.ibaOfficePrint.scan(list, rtpCtx()).then(paintSum, () => {}); else if ((n || 0) < 20) setTimeout(() => rtpScan(rows, (n || 0) + 1), 1000); } catch (e) { console.warn('Office: ready to print scan', e); } }
function openRtp() {
  if (!window.ibaOfficePrint) { log('Ready to Print is still loading. Try again in a moment.'); return; }
  window.ibaOfficePrint.open(rtpCtx());
}

// ---------- open / close ----------
let timers = [], staticDone = false;
function allowed() { try { if (window.ibaTestAs) return false; return (typeof imIsCurrentUserSuperAdmin === 'function') && imIsCurrentUserSuperAdmin(); } catch (_) { return false; } }
async function open() {
  if (!allowed()) return;
  if (!staticDone) { drawStatic(sc); staticDone = true; team(); paintSum(); }
  root.hidden = false; document.body.classList.add('iba-office-on');
  if (window.ibaOffice3DInit) { try { window.ibaOffice3DInit(window.ibaOffice3DState()); } catch (e) { console.error('Office 3D could not start', e); log('The 3D office could not start. Check that WebGL is available and the Three.js library loaded.'); } }
  if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
  timers.push(setInterval(idleTick, 3000), setInterval(() => { if (!document.hidden) loadData(true).then(() => { botsReport(); setTimeout(rinaCollect, 6000); }); }, 180000), setInterval(paintSum, 5000));
  if (!cfg) { await loadCfg(); log('Office opened.'); }
  await loadPresence(true);
  timers.push(setInterval(() => { if (!document.hidden) loadPresence(false); }, 60000));
  cam = camTarget();
  if (!loadedAt || Date.now() - loadedAt > 120000) await loadData(); botsReport(); setTimeout(rinaCollect, 5000);
}
function close() {
  root.hidden = true; document.body.classList.remove('iba-office-on'); hidePop();
  running = false; cancelAnimationFrame(raf); timers.forEach(clearInterval); timers = [];
}
window.ibaOffice3DState = () => ({ rooms: ROOMS, walls: WALLS, furniture: FURN, chairs: CHAIRS, people, cabs: CABS, door: DOOR, oct: OCT, counts: cabNewN, currentRoom: myRoom(), theme: officeTheme, zoom });
window.ibaOffice3DSelectCab = (id) => { const c = CABS.find((q) => q.id === id); if (c) openCab(c); };
window.ibaOffice3DSelectPerson = (name) => { const p = people.find((q) => q.name === name); if (p) openPerson(p); };
window.ibaOffice3DSetZoom = (value) => { zoom = Math.max(0, Math.min(1, Number(value) || 0)); };
// 18.0.0 patch 155: a short summary for the phone "My office" card (filled once the office has been opened)
function summary() { return { at: loadedAt || 0, open: !root.hidden, cabs: CABS.map((c, i) => ({ id: c.id, title: c.title, n: (cabN && cabN[i]) || 0 })), bots: BOTS.map((b) => ({ name: b.name, status: b.status || b.role })) }; }
window.ibaOffice = { ready: true, summary, open, close, refresh: () => loadData(), collect: () => rinaCollect() };
})();




