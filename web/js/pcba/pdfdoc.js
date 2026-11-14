/* DesignWizard.ai — PCBA: the same document model as docx.js, laid out on A4 pages with the project's own vector PDF
   writer : title page, table of contents with page numbers, headings, wrapped paragraphs, lists, tables whose header
   repeats on each page, figures drawn as vectors, check-lists, a sign-off table, header and footer. The layout runs
   twice : once to learn on which page each heading falls and how many pages there are, once for good. */

import { PdfSheet } from "../draw/pdf.js";

const W = 210, H = 297, M = 18, CW = W - 2 * M, INK = "#1c2430", HEADC = "#1F3A5F", MUTED = "#5A6472", LINE = "#9AA5B4", FILL = { ok: "#DCF2E3", warn: "#FCEFC7", error: "#F9D9D9", muted: "#EEF0F3", head: "#DDE5F0" };
/** Text the standard PDF fonts can show : characters outside Windows-1252 are spelled out. */
const SPELL = { "Ω": "ohm", "≤": "<=", "≥": ">=", "→": "->", "−": "-", "≈": "~", "Δ": "delta ", "τ": "tau", "π": "pi", "α": "alpha", "η": "eta", "θ": "theta", "λ": "lambda", "ρ": "rho", "σ": "sigma", "\u00a0": " ", "\u202f": " ", "\u2011": "-" };
const safe = (s) => String(s ?? "").replace(/[Ω≤≥→−≈Δτπαηθλρσ\u00a0\u202f\u2011]/g, (c) => SPELL[c]);
const cellOf = (c) => (c !== null && typeof c === "object" ? c : { text: c });

function layout(doc, pagesOf, total) {
  const sheet = new PdfSheet({ width: W, height: H, title: doc.title, date: doc.date || new Date(0) }), seen = new Map();
  let y = M, page = 1;
  const furniture = () => { if (page === 1) return; sheet.text(M, 11, safe(doc.header || doc.title), { size: 2.6, color: MUTED }); sheet.line(M, 13, W - M, 13, { w: 0.15, color: LINE });
    sheet.text(W - M, H - 10, safe(`${doc.footer || ""} — Page ${page}${total ? ` de ${total}` : ""}`), { size: 2.6, color: MUTED, align: "right" }); };
  const next = () => { sheet.newPage(); page++; y = M + 2; furniture(); };
  const need = (h) => { if (y + h > H - M - 4) next(); };
  const lines = (text, width, o) => sheet.wrapText(safe(text), width, o);
  const write = (text, o = {}) => { const size = o.size || 3.3, lh = size * 1.42, x = M + (o.indent || 0); for (const l of lines(text, CW - (o.indent || 0), { size, font: o.font })) { need(lh); sheet.text(o.align === "center" ? W / 2 : x, y, l, { size, font: o.font, color: o.color || INK, baseline: "top", align: o.align }); y += lh; } y += o.after ?? 1.6; };
  const table = (head, rows, widths, o = {}) => {
    const n = (head || rows[0] || []).length, sum = (widths || []).reduce((s, w) => s + w, 0) || n, cols = Array.from({ length: n }, (_, i) => CW * ((widths && widths[i]) || 1) / sum), size = 2.75, lh = size * 1.36, pad = 1.1;
    const row = (cells, isHead) => {
      const wrapped = cells.map((c, i) => { const x = cellOf(c); return lines(x.text, cols[i] - 2 * pad, { size, font: isHead || x.bold || (o.firstCol && i === 0) ? "bold" : "sans" }); }), h = Math.max(o.height || 0, Math.max(1, ...wrapped.map((l) => l.length)) * lh + 2 * pad);
      if (y + h > H - M - 4) { next(); if (head && !isHead) row(head, true); }
      let x = M;
      cells.forEach((c, i) => { const cell = cellOf(c), fill = isHead ? FILL.head : cell.fill ? FILL[cell.fill] : o.firstCol && i === 0 ? FILL.muted : null;
        sheet.rect(x, y, cols[i], h, { fill, color: LINE, w: 0.15 });
        wrapped[i].forEach((l, k) => sheet.text(cell.align === "right" ? x + cols[i] - pad : x + pad, y + pad + k * lh, l, { size, font: isHead || cell.bold || (o.firstCol && i === 0) ? "bold" : "sans", color: INK, baseline: "top", align: cell.align === "right" ? "right" : "left" }));
        x += cols[i]; });
      y += h;
    };
    if (head) row(head, true);
    for (const r of rows) row(r, false);
    y += 3;
  };
  const heading = (b) => { const size = { h1: 5, h2: 4, h3: 3.5 }[b.type], lh = size * 1.3; if (b.type === "h1" && y > M + 30) y += 3; need(lh + 12); seen.set(b, page); y += b.type === "h1" ? 2 : 1; sheet.text(M, y, safe(b.text), { size, font: "bold", color: HEADC, baseline: "top" }); y += lh; if (b.type === "h1") { sheet.line(M, y, W - M, y, { w: 0.3, color: HEADC }); y += 1; } y += 1.6; };

  // title page
  y = 78; write(doc.title, { size: 8.5, font: "bold", color: HEADC, after: 2 }); write(doc.subtitle || "", { size: 5, color: MUTED, after: 14 });
  table(null, [["Référence", doc.reference || "—"], ["Révision", doc.revision || "—"], ["Rédacteur", doc.author || "—"], ["Date", (doc.date || new Date(0)).toISOString().slice(0, 10)]], [30, 70], { firstCol: true });
  sheet.text(W / 2, H - 22, safe(doc.footer || ""), { size: 3, color: MUTED, align: "center" });
  next();
  for (const b of doc.blocks) {
    if (/^h[123]$/.test(b.type)) heading(b);
    else if (b.type === "p") write(b.runs ? b.runs.map((r) => r.text).join("") : b.text, { color: b.style === "muted" ? MUTED : b.style === "warn" ? "#A14A00" : INK, font: b.style === "note" ? "italic" : b.style === "warn" ? "bold" : "sans" });
    else if (b.type === "list") { b.items.forEach((it, i) => { const x = cellOf(it), ind = 4 + 4 * (x.level || 0), size = 3.2, lh = size * 1.42, ls = lines(x.text, CW - ind, { size }); need(lh); sheet.text(M + ind - 3.4, y, b.ordered ? `${i + 1}.` : "•", { size, color: INK, baseline: "top" }); for (const l of ls) { need(lh); sheet.text(M + ind, y, l, { size, color: INK, baseline: "top" }); y += lh; } y += 0.5; }); y += 1.6; }
    else if (b.type === "table") { table(b.head, b.rows, b.widths); if (b.caption) { y -= 1.5; write(b.caption, { size: 2.7, font: "italic", color: MUTED, align: "center", after: 3 }); } }
    else if (b.type === "kv") table(null, b.rows, [30, 70], { firstCol: true });
    else if (b.type === "checklist") { for (const it of b.items) { const size = 3.2, lh = size * 1.42, ls = lines(it.text, CW - 8, { size }); need(ls.length * lh + 1.2); sheet.rect(M, y + 0.3, 3.2, 3.2, { color: INK, w: 0.25, fill: it.state === "ok" ? FILL.ok : it.state === "na" ? FILL.muted : null });
      if (it.state === "ok") sheet.polyline([[M + 0.6, y + 1.9], [M + 1.4, y + 2.8], [M + 2.7, y + 0.9]], { w: 0.45, color: "#1f7a4d" }); if (it.state === "na") sheet.line(M + 0.7, y + 1.9, M + 2.5, y + 1.9, { w: 0.35, color: MUTED });
      ls.forEach((l) => { sheet.text(M + 6, y, l, { size, color: INK, baseline: "top" }); y += lh; }); y += 1.2; } y += 2; }
    else if (b.type === "signatures") table(["Rôle", "Nom", "Date", "Signature"], b.roles.map((r) => [r, "", "", ""]), [28, 26, 16, 30], { height: 14 });
    else if (b.type === "pagebreak") next();
    else if (b.type === "toc") { heading({ type: "h1", text: "Sommaire" }); for (const h of doc.blocks.filter((q) => q.type === "h1" || q.type === "h2")) { const size = h.type === "h1" ? 3.3 : 3, ind = h.type === "h1" ? 0 : 5; need(size * 1.6); sheet.text(M + ind, y, safe(h.text), { size, font: h.type === "h1" ? "bold" : "sans", color: INK, baseline: "top" }); if (pagesOf && pagesOf.has(h)) sheet.text(W - M, y, String(pagesOf.get(h)), { size, color: INK, baseline: "top", align: "right" }); y += size * 1.6; } y += 2; }
    else if (b.type === "figure") {
      if (b.draw) { const ratio = (b.height || 100) / (b.width || 160), w = Math.min(b.width || 160, CW), h = Math.min(w * ratio, H - 2 * M - 30); need(h + 9); try { b.draw(sheet, M + (CW - h / ratio) / 2, y, h / ratio, h); } catch (e) { sheet.text(W / 2, y + h / 2, "Figure non disponible", { size: 3, color: MUTED, align: "center" }); } y += h + 2; }
      else write("Figure disponible dans la version Word du rapport.", { size: 2.9, font: "italic", color: MUTED, align: "center", after: 1 });
      if (b.caption) write(b.caption, { size: 2.7, font: "italic", color: MUTED, align: "center", after: 3.5 });
    }
  }
  return { sheet, pages: page, seen };
}

/** A PDF file from a document model. → Uint8Array */
export function pdfDoc(doc) {
  const first = layout(doc, null, 0);
  return layout(doc, first.seen, first.pages).sheet.toBytes();
}
