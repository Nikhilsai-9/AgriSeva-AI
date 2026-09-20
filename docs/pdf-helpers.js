// Drawing helpers, palette, layout primitives.
const path = require("path");
const fs   = require("fs");

const C = {
  ink:     "#0f172a", inkSoft: "#334155", inkMute: "#64748b",
  rule:    "#e2e8f0", brand:   "#0f766e", brandLt: "#ccfbf1",
  accent:  "#b45309", warn:    "#b91c1c", ok:      "#15803d",
  gold:    "#a16207", paper:   "#ffffff", paper2:  "#f8fafc",
  paper3:  "#f1f5f9", emerald: "#047857", indigo:  "#3730a3",
  sky:     "#0369a1", violet:  "#6d28d9", rose:    "#9f1239",
  slate:   "#334155",
};

const F = {
  sans: "Helvetica",       sansBold: "Helvetica-Bold",
  sansOblique: "Helvetica-Oblique",  sansBoldOblique: "Helvetica-BoldOblique",
  serif: "Times-Roman",    serifBold: "Times-Bold",  serifItalic: "Times-Italic",
  mono: "Courier",         monoBold: "Courier-Bold",
};

const SIZE = {
  docTitle: 28, h1: 22, h2: 17, h3: 13,
  body: 10, small: 9, tiny: 8, cover: 42, coverSub: 16,
};

const PAGE = { size: "A4", margins: { top: 64, bottom: 64, left: 64, right: 64 } };

function cellColor(v) {
  if (typeof v !== "string") return C.ink;
  const s = v.toUpperCase();
  if (s.includes("✅") || s === "OK" || s === "PASS" || s === "LIVE"
      || s === "REAL" || s === "DONE" || s.includes("DONE & STABLE")
      || s === "MIGRATED" || s === "NET-NEW" || s === "COMPLETE")
    return C.ok;
  if (s.includes("⚠") || s.includes("PARTIAL") || s.includes("MOCK")
      || s.includes("NOT STARTED") || s.includes("DEFERRED")
      || s === "LEGACY")
    return C.accent;
  if (s.includes("❌") || s === "FAIL" || s === "BLOCKED") return C.warn;
  return C.ink;
}

function equalWidths(n, total) {
  const each = Math.floor(total / n);
  const rem = total - each * n;
  const arr = new Array(n).fill(each);
  arr[n - 1] += rem;
  return arr;
}

function createHelpers(PDFDocument, OUT_PATH, base) {
  const { C, F, SIZE, PAGE, cellColor, equalWidths } = base;
  const doc = new PDFDocument({
    size: PAGE.size,
    margins: PAGE.margins,
    info: {
      Title:    "AgriSeva-AI — Project Bible",
      Author:   "Project Owner",
      Subject:  "Comprehensive architecture, features and status report",
      Keywords: "AgriSeva-AI, agriculture, advisory, LangGraph, MCP, MongoDB",
    },
    bufferPages: true,
    autoFirstPage: false,
  });
  doc.pipe(fs.createWriteStream(OUT_PATH));

  function addPage() { doc.addPage(); }

  function H1(text) {
    addPage();
    doc.save();
    doc.font(F.serifBold).fontSize(SIZE.h1).fillColor(C.brand).text(text, { width: doc.page.width - 128 });
    const y = doc.y + 4;
    doc.moveTo(64, y).lineTo(doc.page.width - 64, y).lineWidth(1).strokeColor(C.brand).stroke();
    doc.restore();
    doc.moveDown(1.2);
  }

  function H2(text) {
    doc.moveDown(0.8);
    doc.save();
    doc.font(F.sansBold).fontSize(SIZE.h2).fillColor(C.ink).text(text, { width: doc.page.width - 128 });
    doc.restore();
    doc.moveDown(0.4);
  }

  function H3(text) {
    doc.moveDown(0.4);
    doc.font(F.sansBold).fontSize(SIZE.h3).fillColor(C.inkSoft).text(text, { width: doc.page.width - 128 });
    doc.moveDown(0.2);
  }

  function P(text, opts = {}) {
    doc.font(F.sans).fontSize(opts.size || SIZE.body).fillColor(opts.color || C.ink).text(text, {
      width: doc.page.width - 128,
      align: opts.align || "justify",
      paragraphGap: 4, lineGap: 2,
    });
    doc.moveDown(opts.gap !== undefined ? opts.gap : 0.3);
  }

  function BR() { doc.moveDown(0.4); }

  function UL(items, opts = {}) {
    const indent = opts.indent || 14;
    doc.font(F.sans).fontSize(opts.size || SIZE.body).fillColor(C.ink);
    items.forEach((item) => {
      doc.text(`•  ${item}`, {
        indent, width: doc.page.width - 128 - indent,
        align: "left", paragraphGap: 2,
      });
    });
    doc.moveDown(0.3);
  }

  function KV(rows, opts = {}) {
    const labelW = opts.labelW || 130;
    doc.font(F.sans).fontSize(SIZE.body);
    rows.forEach(([k, v]) => {
      doc.save();
      doc.font(F.sansBold).fillColor(C.inkSoft).text(k, 64, doc.y, { width: labelW, continued: false });
      const y = doc.y;
      doc.font(F.sans).fillColor(C.ink).text(v, 64 + labelW + 8, y, {
        width: doc.page.width - 64 - 64 - labelW - 8, align: "left",
      });
      doc.moveDown(0.25);
      doc.restore();
    });
    doc.moveDown(0.2);
  }

  function CALL(text, color = C.brandLt, ink = C.ink) {
    const x = 64; const w = doc.page.width - 128; const y = doc.y + 4;
    const padding = 14;
    const h = doc.heightOfString(text, { width: w - padding * 2, font: F.sans, fontSize: SIZE.body }) + padding * 2;
    doc.save();
    doc.roundedRect(x, y, w, h, 8).fillColor(color).fill();
    doc.fillColor(ink).font(F.sans).fontSize(SIZE.body).text(text, x + padding, y + padding, { width: w - padding * 2 });
    doc.restore();
    doc.y = y + h + 6; doc.x = x;
  }

  function bullet(items, ordered = false) {
    let i = 1;
    doc.font(F.sans).fontSize(SIZE.body).fillColor(C.ink);
    items.forEach((it) => {
      const marker = ordered ? `${i}.` : "•";
      doc.text(`${marker}  ${it}`, { indent: 14, width: doc.page.width - 128 - 14, align: "left", paragraphGap: 2 });
      i++;
    });
    doc.moveDown(0.3);
  }

  function TABLE(headers, rows, opts = {}) {
    const widths = opts.widths || equalWidths(headers.length, doc.page.width - 128);
    const x = 64; let y = doc.y + 4;
    const fontSize = opts.fontSize || SIZE.small;
    const rowH = opts.rowH || 22;
    const headH = opts.headH || 26;

    function drawHeader() {
      doc.save();
      const totalW = widths.reduce((a, b) => a + b, 0);
      doc.rect(x, y, totalW, headH).fillColor(C.brand).fill();
      let cx = x;
      headers.forEach((h, i) => {
        doc.font(F.sansBold).fontSize(fontSize).fillColor("#ffffff").text(h, cx + 6, y + 7, {
          width: widths[i] - 12, height: headH - 4, ellipsis: true,
        });
        cx += widths[i];
      });
      y += headH;
      doc.restore();
    }

    function drawRow(r, ri) {
      const bg = ri % 2 === 0 ? C.paper2 : C.paper3;
      doc.save();
      const totalW = widths.reduce((a, b) => a + b, 0);
      doc.rect(x, y, totalW, rowH).fillColor(bg).fill();
      doc.moveTo(x, y).lineTo(x, y + rowH).strokeColor(C.rule).stroke();
      let cx = x;
      r.forEach((cell, i) => {
        doc.moveTo(cx, y).lineTo(cx, y + rowH).strokeColor(C.rule).stroke();
        const c = typeof cell === "object" && cell !== null
          ? cell : { text: String(cell ?? ""), color: cellColor(cell), bold: false };
        doc.font(c.bold ? F.sansBold : F.sans).fontSize(fontSize).fillColor(c.color || C.ink).text(c.text, cx + 6, y + 5, {
          width: widths[i] - 12, height: rowH - 4, ellipsis: true,
        });
        cx += widths[i];
      });
      doc.moveTo(x + totalW, y).lineTo(x + totalW, y + rowH).strokeColor(C.rule).stroke();
      doc.moveTo(x, y + rowH).lineTo(x + totalW, y + rowH).strokeColor(C.rule).stroke();
      y += rowH;
      doc.restore();
    }

    drawHeader();
    rows.forEach((r, i) => drawRow(r, i));
    doc.y = y + 6; doc.x = 64;
  }

  function CODE(text) {
    const x = 64; const w = doc.page.width - 128; const y = doc.y + 4;
    const padding = 10;
    const lineH = doc.heightOfString(text, { font: F.mono, fontSize: SIZE.small, width: w - padding * 2 });
    const h = lineH + padding * 2;
    doc.save();
    doc.roundedRect(x, y, w, h, 6).fillColor("#0b1220").fill();
    doc.fillColor("#e2e8f0").font(F.mono).fontSize(SIZE.small).text(text, x + padding, y + padding, { width: w - padding * 2 });
    doc.restore();
    doc.y = y + h + 6; doc.x = x;
  }

  function cover() {
    doc.addPage();
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fillColor("#0f172a").fill();
    doc.restore();
    doc.save();
    doc.fillColor("#ffffff").font(F.serifBold).fontSize(SIZE.cover)
      .text("AgriSeva-AI", 0, 240, { width: doc.page.width, align: "center" });
    doc.fillColor("#5eead4").font(F.serif).fontSize(SIZE.coverSub)
      .text("Project Bible", 0, 320, { width: doc.page.width, align: "center" });
    doc.fillColor("#cbd5e1").font(F.sans).fontSize(13)
      .text("A multilingual AI advisory platform for Indian agriculture", 0, 360, { width: doc.page.width, align: "center" });
    doc.restore();
    doc.save();
    doc.fillColor("#94a3b8").font(F.sans).fontSize(SIZE.body);
    const coverY = doc.page.height - 200;
    doc.text("Owner:   Atul Saini", 64, coverY, { width: doc.page.width - 128, align: "center" });
    doc.text("Audience: Stakeholders, reviewers and new contributors", 64, coverY + 18, { width: doc.page.width - 128, align: "center" });
    doc.text("Generated: September 2026", 64, coverY + 36, { width: doc.page.width - 128, align: "center" });
    doc.text("Version: 1.0  ·  COMPREHENSIVE EDITION", 64, coverY + 56, { width: doc.page.width - 128, align: "center" });
    doc.fillColor("#475569").fontSize(SIZE.tiny).text(
      "CONFIDENTIAL — This document is the sole property of the project owner.",
      64, coverY + 96, { width: doc.page.width - 128, align: "center" }
    );
    doc.restore();
    doc.save();
    doc.rect(64, doc.page.height - 64, doc.page.width - 128, 4).fillColor("#14b8a6").fill();
    doc.restore();
  }

  function drawHeaderFooter() {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - 36;
      doc.save();
      doc.fontSize(SIZE.tiny).fillColor(C.inkMute).font(F.sans);
      doc.text("AgriSeva-AI  ·  Project Bible  ·  Confidential", 64, y, { width: doc.page.width - 128, align: "left", height: 12, lineBreak: false });
      doc.text(`Page ${i + 1} of ${pageCount}`, 64, y, { width: doc.page.width - 128, align: "right", height: 12, lineBreak: false });
      doc.restore();
      doc.save();
      doc.moveTo(64, doc.page.height - 50).lineTo(doc.page.width - 64, doc.page.height - 50).lineWidth(0.5).strokeColor(C.rule).stroke();
      doc.restore();
    }
  }

  function finish() {
    drawHeaderFooter();
    doc.end();
  }

  return {
    doc, H1, H2, H3, P, UL, KV, CALL, BR, bullet,
    addPage, TABLE, CODE, cover, finish,
  };
}

module.exports = { C, F, SIZE, PAGE, cellColor, equalWidths, createHelpers };
