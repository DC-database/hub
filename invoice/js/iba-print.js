/* ==========================================================================
   IBA 14.0.0 patch 16 - clean printed reports
   --------------------------------------------------------------------------
   - WorkDesk Job Records "Print" now prints a clean report page of its own
     (white A4 landscape, company header, summary, readable table, the
     header row repeated on every page, status shown as a coloured label).
     The page's dark theme no longer leaks into the print.
   - The rows, columns, title and totals are exactly the ones the system
     already prepared for printing; nothing is added or left out.
   - window.ibaPrint.table(...) is the shared printer; patch 17 adds a small
     bar chart to the printed page and ibaPrint.excel(...), which makes a
     real .xlsx file in the browser (no extra library, nothing uploaded).
   Nothing is saved or changed in any data.
   ========================================================================== */
(function () {
  "use strict";
  if (window.ibaPrint) return;

  const LOGO = "https://raw.githubusercontent.com/DC-database/hub/refs/heads/main/logo%20(1).png";
  const COMPANY = "ISMAIL BIN ALI TRADING & CONT. CO. W.L.L";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function niceDate(v) {
    const s = String(v == null ? "" : v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return m[3] + "-" + MONTHS[Number(m[2]) - 1] + "-" + m[1];
    return s;
  }
  function niceAmount(v) {
    const s = String(v == null ? "" : v).trim();
    if (!s) return "";
    const n = Number(s.replace(/,/g, ""));
    if (!/^-?[\d,]+(\.\d+)?$/.test(s) || !Number.isFinite(n)) return s;
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function statusTone(v) {
    const s = String(v || "").toLowerCase();
    if (/cancel|reject|issue|unresolved/.test(s)) return "bad";
    if (/hold|inquiry/.test(s)) return "hold";
    if (/paid|done|complete|converted|approved|closed|with accounts/.test(s)) return "ok";
    if (/new entry/.test(s)) return "new";
    if (/pending|waiting|for |process|review|report|approval|srv|ipc/.test(s)) return "wait";
    return "plain";
  }
  function whoAmI() {
    try { if (typeof currentApprover !== "undefined" && currentApprover && currentApprover.Name) return String(currentApprover.Name); } catch (_) {}
    return "";
  }

  const CSS = [
    "@page { size: A4 landscape; margin: 9mm 8mm 10mm; }",
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0;background:#fff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    ".hd{display:flex;align-items:center;gap:12px;padding-bottom:9px;border-bottom:2px solid #0b3a5b}",
    ".hd img{height:34px;width:auto}",
    ".hd .co{flex:1;min-width:0}",
    ".hd .co b{display:block;font-size:13.5pt;color:#0b3a5b;letter-spacing:.2px}",
    ".hd .co span{display:block;margin-top:2px;font-size:8pt;color:#64748b}",
    ".hd .ti{text-align:right}",
    ".hd .ti b{display:block;font-size:13pt;color:#111827}",
    ".hd .ti span{display:block;margin-top:2px;font-size:7.5pt;color:#64748b}",
    ".meta{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;margin:8px 0 9px;padding:7px 10px;border:1px solid #dbe3ec;border-radius:6px;background:#f6f9fc}",
    ".meta div{font-size:8pt;color:#64748b}",
    ".meta div b{margin-left:4px;font-size:9pt;color:#0f172a}",
    ".meta .counts{flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px 6px;font-size:7.5pt}",
    ".chip{display:inline-block;padding:1px 7px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#334155;white-space:nowrap}",
    ".chip b{margin-left:3px;color:#0f172a}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.6pt;line-height:1.3}",
    "thead{display:table-header-group}",
    "th{background:#0b3a5b;color:#fff;font-weight:700;text-align:left;padding:5px 5px;font-size:7.2pt;text-transform:uppercase;letter-spacing:.3px;border-right:1px solid #2a5878}",
    "th:last-child{border-right:0}",
    "td{padding:4px 5px;border-bottom:1px solid #e3e8ef;vertical-align:top;color:#1f2937;overflow-wrap:anywhere;word-break:normal}",
    "tbody tr:nth-child(even) td{background:#f7f9fb}",
    "tr{page-break-inside:avoid;break-inside:avoid}",
    ".r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-right:10px}",
    ".nw{white-space:nowrap}",
    ".mut{color:#94a3b8}",
    ".st{display:inline-block;padding:1px 6px;border-radius:8px;font-size:7pt;font-weight:700;border:1px solid}",
    ".st.new{color:#1d4ed8;border-color:#bfd3fb;background:#eef4ff}",
    ".st.wait{color:#9a5b00;border-color:#f3d79a;background:#fff8e6}",
    ".st.ok{color:#0f7a43;border-color:#b5e2c8;background:#ecf9f1}",
    ".st.hold{color:#7c3aed;border-color:#d9c9fb;background:#f5f0ff}",
    ".st.bad{color:#b42318;border-color:#f5c2bd;background:#fff1f0}",
    ".st.plain{color:#334155;border-color:#cbd5e1;background:#f8fafc}",
    ".ft{margin-top:8px;font-size:7pt;color:#94a3b8;display:flex;justify-content:space-between}",
    ".sum{display:flex;gap:10px;align-items:stretch;margin:8px 0 9px}",
    ".sum .meta{flex:1 1 55%;margin:0}",
    ".chart{flex:1 1 45%;padding:7px 10px;border:1px solid #dbe3ec;border-radius:6px;background:#fff}",
    ".chart .ct{font-size:7.5pt;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.3px;margin-bottom:5px}",
    ".bar{display:flex;align-items:center;gap:6px;margin:2px 0;font-size:7.5pt;color:#334155}",
    ".bar .bl{flex:0 0 34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".bar .bt{flex:1;height:8px}",
    ".bar .bt i{display:block;height:8px;background:#2f6f9f;border-radius:0 4px 4px 0}",
    ".bar b{flex:0 0 auto;min-width:18px;text-align:right;color:#0f172a;font-variant-numeric:tabular-nums}",
    "@media screen{body{padding:14px}}"
  ].join("\n");

  // opts: { title, subtitle, meta:[{label,value}], counts:{label:n}, columns:[{label,width,kind:'text'|'amount'|'date'|'status'|'muted'}], rows:[[...]], note }
  function buildHtml(opts) {
    const o = opts || {};
    const cols = o.columns || [];
    const head = "<colgroup>" + cols.map(function (c) { return '<col style="width:' + esc(c.width || "auto") + '">'; }).join("") + "</colgroup>" +
      "<thead><tr>" + cols.map(function (c) { return "<th" + (c.kind === "amount" ? ' class="r"' : "") + ">" + esc(c.label) + "</th>"; }).join("") + "</tr></thead>";
    const body = (o.rows || []).map(function (r) {
      return "<tr>" + cols.map(function (c, i) {
        let v = r[i];
        const empty = v == null || String(v).trim() === "" || String(v).trim() === "—";
        if (c.kind === "amount") return '<td class="r">' + esc(niceAmount(v)) + "</td>";
        if (c.kind === "date") return '<td class="nw' + (empty ? " mut" : "") + '">' + esc(empty ? "—" : niceDate(v)) + "</td>";
        if (c.kind === "status") return "<td>" + (empty ? "" : '<span class="st ' + statusTone(v) + '">' + esc(v) + "</span>") + "</td>";
        return "<td" + (empty ? ' class="mut"' : "") + ">" + esc(empty ? "—" : v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    const counts = o.counts ? Object.keys(o.counts) : [];
    const meta = (o.meta || []).filter(function (m) { return m && m.value !== "" && m.value != null; });
    const printedBy = whoAmI();
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + esc(o.title || "Report") + "</title><style>" + CSS + "</style></head><body>" +
      '<div class="hd"><img src="' + LOGO + '" alt="" onerror="this.remove()"><div class="co"><b>' + esc(COMPANY) + "</b><span>" + esc(o.subtitle || "") + "</span></div>" +
      '<div class="ti"><b>' + esc(o.title || "Report") + "</b><span>" + esc(o.generated || "") + (printedBy ? " · Printed by " + esc(printedBy) : "") + "</span></div></div>" +
      summaryHtml(meta, counts, o) +
      "<table>" + head + "<tbody>" + body + "</tbody></table>" +
      '<div class="ft"><span>' + esc(o.note || "") + "</span><span>" + esc(COMPANY) + "</span></div>" +
      "</body></html>";
  }

  function chartHtml(ch) {
    const keys = ch && ch.data ? Object.keys(ch.data).filter(function (k) { return Number(ch.data[k]) > 0; }) : [];
    if (keys.length < 2) return "";
    const shown = keys.slice(0, 10);
    const max = Math.max.apply(null, shown.map(function (k) { return Number(ch.data[k]); }));
    return '<div class="chart"><div class="ct">' + esc(ch.title || "Count") + "</div>" + shown.map(function (k) {
      const w = Math.max(2, Math.round(Number(ch.data[k]) / max * 100));
      return '<div class="bar"><span class="bl">' + esc(k) + '</span><span class="bt"><i style="width:' + w + '%"></i></span><b>' + esc(ch.data[k]) + "</b></div>";
    }).join("") + (keys.length > shown.length ? '<div class="bar"><span class="bl">+' + (keys.length - shown.length) + " more</span></div>" : "") + "</div>";
  }
  function summaryHtml(meta, counts, o) {
    const chart = chartHtml(o.chart);
    const showChips = counts.length && !chart;
    if (!meta.length && !showChips && !chart) return "";
    const box = '<div class="meta">' + meta.map(function (m) { return "<div>" + esc(m.label) + "<b>" + esc(m.value) + "</b></div>"; }).join("") +
      (showChips ? '<div class="counts">' + counts.map(function (k) { return '<span class="chip">' + esc(k) + "<b>" + esc(o.counts[k]) + "</b></span>"; }).join("") + "</div>" : "") + "</div>";
    return chart ? '<div class="sum">' + box + chart + "</div>" : box;
  }

  // ---------------- tiny .xlsx writer (no library) ----------------
  const CRC = (function () { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    files.forEach(function (f) {
      const name = enc.encode(f.name);
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce(function (n, a) { return n + a.length; }, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function colName(i) { let s = ""; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function xesc(v) {
    return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function toNum(v) { const s = String(v == null ? "" : v).replace(/,/g, "").trim(); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; }
  // cells: {v, s(style), n(true = number)}
  function cellXml(ref, c) {
    if (!c || c.v == null || c.v === "") return "";
    const st = c.s ? ' s="' + c.s + '"' : "";
    if (c.n) return '<c r="' + ref + '"' + st + "><v>" + c.v + "</v></c>";
    return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(c.v) + "</t></is></c>";
  }
  function sheetXml(rows, widths, opt) {
    const o = opt || {};
    const cols = widths.length ? "<cols>" + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>" : "";
    const data = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (c, ci) { return cellXml(colName(ci) + (ri + 1), c); }).join("") + "</row>";
    }).join("");
    const view = o.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      view + '<sheetFormatPr defaultRowHeight="15"/>' + cols + "<sheetData>" + data + "</sheetData>" + (o.filter ? '<autoFilter ref="' + o.filter + '"/>' : "") + "</worksheet>";
  }
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="14"/><color rgb="FF0B3A5B"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0B3A5B"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function safeFile(s) { return String(s || "IBA report").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "IBA report"; }
  function xlsxBlob(opts) {
    const o = opts || {};
    const cols = o.columns || [];
    const head = cols.map(function (c) { return { v: c.label, s: 1 }; });
    const body = (o.rows || []).map(function (r) {
      return cols.map(function (c, i) {
        const v = r[i];
        if (v == null || String(v).trim() === "" || String(v).trim() === "—") return null;
        if (c.kind === "amount") { const n = toNum(v); return n == null ? { v: v } : { v: n, n: true, s: 3 }; }
        if (c.kind === "number") { const n = toNum(v); return n == null ? { v: v } : { v: n, n: true, s: 4 }; }
        if (c.kind === "date") return { v: niceDate(v) };
        return { v: String(v) };
      });
    });
    const widths = cols.map(function (c, i) {
      let w = String(c.label || "").length;
      (o.rows || []).forEach(function (r) { const v = r[i]; const len = c.kind === "amount" ? niceAmount(v).length : String(v == null ? "" : v).length; if (len > w) w = len; });
      return Math.max(8, Math.min(60, w + 2));
    });
    const lastRow = body.length + 1;
    const dataSheet = sheetXml([head].concat(body), widths, { freeze: true, filter: cols.length ? "A1:" + colName(cols.length - 1) + lastRow : "" });
    const sum = [[{ v: o.title || "Report", s: 2 }], [{ v: COMPANY }], [{ v: [o.generated || "", whoAmI() ? "Printed by " + whoAmI() : ""].filter(Boolean).join(" · ") }], []];
    (o.meta || []).forEach(function (m) { if (m && m.value !== "" && m.value != null) sum.push([{ v: m.label, s: 5 }, { v: String(m.value) }]); });
    const cnt = (o.chart && o.chart.data) || o.counts;
    if (cnt && Object.keys(cnt).length) {
      sum.push([]);
      sum.push([{ v: (o.chart && o.chart.title) || "Count", s: 1 }, { v: "Count", s: 1 }]);
      Object.keys(cnt).forEach(function (k) { sum.push([{ v: k }, { v: Number(cnt[k]) || 0, n: true, s: 4 }]); });
    }
    if (o.note) { sum.push([]); sum.push([{ v: o.note }]); }
    const sumSheet = sheetXml(sum, [34, 46], {});
    const files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", data: STYLES },
      { name: "xl/worksheets/sheet1.xml", data: dataSheet },
      { name: "xl/worksheets/sheet2.xml", data: sumSheet }
    ];
    return zipStore(files);
  }
  let lastExcel = null;
  function excel(opts) {
    const blob = xlsxBlob(opts);
    lastExcel = blob;
    const name = safeFile(opts && (opts.fileName || opts.title)) + ".xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (_) {} }, 5000);
    return name;
  }

  let lastHtml = "";
  function printHtml(html) {
    lastHtml = html;
    const old = document.getElementById("iba-print-frame");
    if (old) old.remove();
    const f = document.createElement("iframe");
    f.id = "iba-print-frame";
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open(); d.write(html); d.close();
    let done = false;
    const go = function () {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {}
      setTimeout(function () { try { f.remove(); } catch (_) {} }, 60000);
    };
    const img = d.querySelector("img");
    if (img && !img.complete) { img.addEventListener("load", go); img.addEventListener("error", go); setTimeout(go, 1500); }
    else setTimeout(go, 60);
  }
  function table(opts) { printHtml(buildHtml(opts)); }

  // ---------------- WorkDesk Job Records ----------------
  const JR_COLS = [
    { width: "8%" }, { width: "8%" }, { width: "5%", kind: "text" }, { width: "6%" }, { width: "14%" }, { width: "7.5%", kind: "amount" },
    { width: "7%" }, { width: "7.5%", kind: "date" }, { width: "8%" }, { width: "7.5%", kind: "date" }, { width: "11.5%" }, { width: "10%", kind: "status" }
  ];
  function txt(id) { const el = document.getElementById(id); return el ? String(el.textContent || "").trim() : ""; }
  function jobRecordsReport() {
    const labels = Array.from(document.querySelectorAll("#wd-job-records-print-table thead th")).map(function (th) { return String(th.textContent || "").trim(); });
    const rows = Array.from(document.querySelectorAll("#wd-job-records-print-body tr")).map(function (tr) {
      return Array.from(tr.cells).map(function (td) { return String(td.textContent || "").trim(); });
    });
    if (!rows.length || labels.length !== JR_COLS.length) return null;
    const statusAt = labels.length - 1;
    const counts = {};
    rows.forEach(function (r) { const k = r[statusAt] || "—"; counts[k] = (counts[k] || 0) + 1; });
    const search = txt("wd-job-records-print-search");
    return {
      title: txt("wd-job-records-print-title") || "Job Records Report",
      subtitle: "WorkDesk Records Center",
      generated: txt("wd-job-records-print-generated"),
      meta: [
        { label: "Category", value: txt("wd-job-records-print-category") || "All Job Records" },
        { label: "Search", value: search },
        { label: "Total records", value: txt("wd-job-records-print-total") || String(rows.length) }
      ],
      counts: Object.keys(counts).length > 1 ? counts : null,
      columns: JR_COLS.map(function (c, i) { return Object.assign({ label: labels[i] }, c); }),
      rows: rows,
      note: "Job Records as listed on screen when printed."
    };
  }
  // The system's own print (kept as the fallback if the clean page cannot be made)
  function systemPrint() {
    const area = document.getElementById("reporting-printable-area");
    if (area) area.classList.add("printing");
    document.body.classList.add("workdesk-print-active");
    document.documentElement.classList.add("workdesk-print-active");
    const clear = function () {
      if (area) area.classList.remove("printing");
      document.body.classList.remove("workdesk-print-active");
      document.documentElement.classList.remove("workdesk-print-active");
      try { if (typeof cleanupWorkdeskJobRecordsPrint === "function") cleanupWorkdeskJobRecordsPrint(); } catch (_) {}
    };
    window.addEventListener("afterprint", clear, { once: true });
    setTimeout(clear, 5 * 60 * 1000);
    window.print();
  }
  document.addEventListener("click", function (e) {
    const btn = e.target && e.target.closest ? e.target.closest("#print-report-button") : null;
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    let ok = true;
    try { if (typeof prepareWorkdeskJobRecordsPrint === "function") ok = prepareWorkdeskJobRecordsPrint() !== false; } catch (_) {}
    if (!ok) { alert("No Job Records are currently available to print."); return; }
    let rep = null;
    try { rep = jobRecordsReport(); } catch (_) { rep = null; }
    if (!rep) { systemPrint(); return; }
    try { if (typeof cleanupWorkdeskJobRecordsPrint === "function") cleanupWorkdeskJobRecordsPrint(); } catch (_) {}
    try { table(rep); } catch (_) { systemPrint(); }
  }, true);

  window.ibaPrint = { table: table, html: buildHtml, excel: excel, last: function () { return lastHtml; }, lastExcel: function () { return lastExcel; }, jobRecords: jobRecordsReport };
})();
