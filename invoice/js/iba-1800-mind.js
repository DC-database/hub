/* 18.0.0 patch 62 (martin: "IRIS as my Jarvis"): the meaning matcher. Runs on this PC, no key, no download,
   no Firebase. It takes a free sentence, drops the chat parts ("hi, do me a favor, can you ... tell me"),
   picks out the PO number, the day, a vendor or colleague name, and turns it into what IRIS already knows:
     "hi do me a favor can you navigate this po 12345 tell me what we got"  -> PO 12345 (tracking card)
     "register all new entries we received yesterday"                        -> New entries to Batch, yesterday only
     "what's waiting for my approval" -> approvals    "anything for me today" -> brief
     "show me what we have from khalifa steel"        -> vendor lookup
   iba-assistant.js ask() calls ibaMind.understand(text) only when its own short rules found nothing.
   Rules are words + patterns, so they are instant on any PC (nothing heavy loads). */
(function () {
  'use strict';
  if (window.ibaMind) return;
  var FILL = [
    /\b(?:hi|hello|hey|hiya|yo|good\s+(?:morning|afternoon|evening|day)|iris|jarvis|buddy|bro|sir|mate)\b[\s,!.]*/g,
    /\b(?:please|pls|plz|kindly|thanks?|thank\s+you|thx)\b/g,
    /\b(?:can|could|would|will)\s+(?:you|u)\b/g,
    /\b(?:do|did)\s+me\s+a\s+(?:favou?r|solid)\b/g,
    /\bi\s+(?:want|need|would\s+like|wanna|'d\s+like)\s+(?:you\s+)?to\b/g,
    /\b(?:help\s+me(?:\s+to)?|for\s+me|let\s+me\s+know|if\s+you\s+can|if\s+possible|real\s+quick|quickly|right\s+now|asap)\b/g,
    /\b(?:tell|show|give)\s+me\b/g,
    /\b(?:what|whatever)\s+(?:we|you)\s+(?:got|have|get)\b/g
  ];
  function clean(t) {
    var s = ' ' + String(t || '').toLowerCase().replace(/[’`]/g, "'") + ' ';
    FILL.forEach(function (re) { s = s.replace(re, ' '); });
    return s.replace(/[?!]+/g, ' ').replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  // "today", "yesterday", "2 days ago", "last sunday" / "on sunday", "17 nov", "nov 17", "17/11", "17-11-2026"
  function dayOf(t, now) {
    now = now || new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (/\b(?:today|this\s+morning|tonight)\b/.test(t)) return iso(d);
    if (/\b(?:yesterday|yday|last\s+night)\b/.test(t)) { d.setDate(d.getDate() - 1); return iso(d); }
    var m = t.match(/\b(\d{1,2})\s+days?\s+ago\b/);
    if (m) { d.setDate(d.getDate() - Number(m[1])); return iso(d); }
    m = t.match(/\b(?:last|on|this\s+past)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (m) { var want = DAYS.indexOf(m[1]); var back = (d.getDay() - want + 7) % 7 || 7; d.setDate(d.getDate() - back); return iso(d); }
    m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b/) || null;
    if (m) return mk(Number(m[1]), MON[m[2]], d);
    m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (m) return mk(Number(m[2]), MON[m[1]], d);
    m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if (m && Number(m[2]) <= 12) { var y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null; return mk(Number(m[1]), Number(m[2]) - 1, d, y); }
    return '';
  }
  function mk(day, mon, today, year) {
    if (!(day >= 1 && day <= 31) || mon == null) return '';
    var x = new Date(year || today.getFullYear(), mon, day);
    if (!year && x > today) x.setFullYear(x.getFullYear() - 1);
    return iso(x);
  }

  // ---- vendors from POVALUE2 (already in memory), matched on their distinctive words ----
  var GENERIC = /^(?:w\.?l\.?l\.?|wll|llc|co|company|est|establishment|trading|contracting|services?|group|qatar|doha|and|the|for|of|general|international|intl|ltd|limited|spc|s\.p\.c|enterprises?|industries|industry|factory|w\.l\.l)$/;
  var vIdx = null, vAt = 0;
  function vendors() {
    var src = null; try { src = allPOData; } catch (_) { src = null; }
    if (!src) return [];
    if (vIdx && Date.now() - vAt < 600000) return vIdx;
    var seen = {}, out = [];
    Object.keys(src).forEach(function (po) {
      var n = String((src[po] && src[po]['Supplier Name']) || '').trim();
      if (!n || seen[n.toLowerCase()]) return;
      seen[n.toLowerCase()] = 1;
      var core = n.toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !GENERIC.test(w); });
      if (core.length) out.push({ name: n, core: core });
    });
    vIdx = out; vAt = Date.now();
    return out;
  }
  function vendorIn(t) {
    var words = ' ' + t.replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
    var best = null;
    vendors().forEach(function (v) {
      if (!v.core.every(function (w) { return words.indexOf(' ' + w + ' ') !== -1; })) return;
      var score = v.core.join(' ').length;
      if (!best || score > best.score) best = { name: v.name, short: v.core.slice(0, 3).join(' '), score: score };
    });
    return best && best.score >= 4 ? best : null;
  }

  var STOPWORDS = /^(?:the|a|an|this|that|these|those|it|is|are|was|on|in|at|of|to|for|and|or|me|my|we|our|us|you|any|all|some|about|with|from|please|now|just|got|have|has|what|whats|what's|there)$/;
  // -> null (nothing understood) or one of:
  //    { run: skillId, vals, why }  run that skill now      { text: 'po 12345', why }  ask again with this
  //    { brief: true }  open today's brief
  function understand(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var t = clean(raw);
    if (!t) return null;
    // 1. register the reception New Entries (all, or one day) into Batch Entry
    if (/\b(?:register|convert|process|move|put|add|enter|encode|transfer|bring|load|push)\b/.test(t) && /\b(?:new\s+entr(?:y|ies)|reception|received|receive)\b/.test(t) ||
        /\bnew\s+entr(?:y|ies)\b.*\b(?:to|into|in)\s+(?:the\s+)?batch\b/.test(t)) {
      return { run: 'reception_batch', vals: { day: dayOf(t) }, why: 'register new entries' };
    }
    // 2. a PO number in a sentence -> that PO (tracking card)
    var po = (t.match(/\bp\.?\s?o\.?\s*(?:no\.?|number|#)?\s*[:#-]?\s*(\d{4,7})\b/) || [])[1];
    if (!po && !/\b(?:inv(?:oice)?\.?\s*(?:no\.?|number|#)?|amount|qar|riyals?|value)\s*[:#-]?\s*\d/.test(t)) {
      var nums = t.match(/(?:^|[^\d.,\/-])(\d{5})(?![\d.,\/])/);
      if (nums && /\b(?:navigate|show|check|status|track|where|what|see|look|open|find|details?|about|update|got|have|po)\b/.test(t)) po = nums[1];
    }
    if (po) return { text: 'po ' + po, why: 'PO ' + po };
    // 3. today's brief
    if (/\b(?:brief|my\s+tasks?|my\s+day|to\s?do|todo|what\s+(?:do\s+i|have\s+i)\s+(?:have|got)|anything\s+(?:new\s+)?for\s+me|what'?s\s+(?:new|up|on)(?:\s+today)?|on\s+my\s+plate|pending\s+(?:for|with)\s+me)\b/.test(t)) return { brief: true, why: 'brief' };
    // 4. approvals
    if (/\b(?:approvals?|approve|to\s+sign|signature|for\s+approval|waiting\s+for\s+(?:me|management|the\s+boss|boss|ceo|coo))\b/.test(t)) return { text: 'approvals', why: 'approvals' };
    // 5. a vendor name from the PO list
    var v = vendorIn(t);
    if (v) return { text: v.short, why: 'vendor ' + v.name };
    // 6. a colleague's number / email
    var p = t.match(/\b(?:number|phone|mobile|contact|email|whatsapp|extension|ext)\s+(?:no\.?\s+)?(?:of|for)\s+([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+)?)\b/);
    if (p) return { text: p[1].split(' ').filter(function (w) { return !STOPWORDS.test(w); }).join(' '), why: 'colleague' };
    // 7. the sentence without the chat parts, when that is clearly shorter (skill names, lists, pages)
    var short = t.split(' ').filter(function (w) { return !STOPWORDS.test(w); }).join(' ');
    if (short && short.split(' ').length <= 6 && short.length < raw.length * 0.75) return { text: short, why: 'short' };
    return null;
  }
  window.ibaMind = { understand: understand, clean: clean, dayOf: dayOf, vendorIn: vendorIn };
})();
