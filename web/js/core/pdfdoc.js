/* DesignWizard.ai — PCBA: the same document model as docx.js, laid out on A4 pages with the project's own vector PDF
   writer : title page, table of contents with page numbers, headings, wrapped paragraphs, lists, tables whose header
   repeats on each page, figures drawn as vectors, check-lists, a sign-off table, header and footer. The layout runs
   twice : once to learn on which page each heading falls and how many pages there are, once for good. */

import { PdfSheet } from "../draw/pdf.js";
import { BRAND, FOOT_NOTE, drawLogo, confidentialNote } from "./brand.js";

const W = 210, H = 297, M = 18, CW = W - 2 * M, TOP = 35, BOTTOM = H - 22, INK = "#1c2430", HEADC = "#1F3A5F", MUTED = "#5A6472", LINE = "#9AA5B4", FILL = { ok: "#DCF2E3", warn: "#FCEFC7", error: "#F9D9D9", muted: "#EEF0F3", head: "#DDE5F0" };
/** Text the standard PDF fonts can show : characters outside Windows-1252 are spelled out. */
const SPELL = { "Ω": "ohm", "≤": "<=", "≥": ">=", "→": "->", "−": "-", "≈": "~", "Δ": "delta ", "τ": "tau", "π": "pi", "α": "alpha", "η": "eta", "θ": "theta", "λ": "lambda", "ρ": "rho", "σ": "sigma", "\u00a0": " ", "\u202f": " ", "\u2011": "-" };
const safe = (s) => String(s ?? "").replace(/[Ω≤≥→−≈Δτπαηθλρσ\u00a0\u202f\u2011]/g, (c) => SPELL[c]);
const cellOf = (c) => (c !== null && typeof c === "object" ? c : { text: c });

function layout(doc, pagesOf, total) {
  const sheet = new PdfSheet({ width: W, height: H, title: doc.title, date: doc.date || new Date(0) }), seen = new Map();
  let y = TOP, page = 1;
  /* every page : a framed title block on top — the mark, what the document is, its number, revision, date and page — and at
     the bottom the confidentiality note of the project, then the note of the platform (core/brand.js) */
  const date = (doc.date || new Date(0)).toISOString().slice(0, 10), conf = doc.confidential || confidentialNote();
  const furniture = () => {
    const x0 = M, x1 = M + 46, x2 = W - M - 50, y0 = 8, hh = 18, thin = { w: 0.2, color: HEADC };
    sheet.rect(x0, y0, CW, hh, { w: 0.45, color: HEADC }); sheet.line(x1, y0, x1, y0 + hh, thin); sheet.line(x2, y0, x2, y0 + hh, thin);
    drawLogo(sheet, x0 + 2, y0 + 3, 12); sheet.text(x0 + 15.5, y0 + 8.6, safe(BRAND.product), { size: 3.5, font: "bold", color: HEADC }); sheet.text(x0 + 15.5, y0 + 12.6, safe(`by ${BRAND.by}`), { size: 2.2, color: MUTED });
    const tl = sheet.wrapText(safe(doc.header || doc.title), x2 - x1 - 6, { size: 3.5, font: "bold" }).slice(0, 2), ty = y0 + (tl.length > 1 ? 5.6 : 7.8);
    tl.forEach((l, i) => sheet.text((x1 + x2) / 2, ty + i * 4.4, l, { size: 3.5, font: "bold", color: INK, align: "center" }));
    sheet.text((x1 + x2) / 2, y0 + hh - 2.4, safe(String(doc.kind || doc.subject || "Document").toUpperCase()), { size: 2.3, color: MUTED, align: "center" });
    [["N° doc.", doc.reference || "—"], ["Révision", doc.revision || "—"], ["Date", date], ["Page", `${page}${total ? ` de ${total}` : ""}`]].forEach(([k, v], i) => { const yy = y0 + 4.5 * (i + 1); if (i) sheet.line(x2, yy - 4.5, W - M, yy - 4.5, { w: 0.12, color: LINE });
      sheet.text(x2 + 1.6, yy - 1.3, `${k} :`, { size: 2.2, color: MUTED }); let size = 2.5, shown = safe(v); const room = W - M - x2 - 18; while (size > 1.75 && sheet.textWidth(shown, { size, font: "bold" }) > room) size -= 0.1; while (shown.length > 4 && sheet.textWidth(shown, { size, font: "bold" }) > room) shown = `${shown.slice(0, -2)}…`;
      sheet.text(x2 + 16.5, yy - 1.3, shown, { size, font: "bold", color: INK }); });
    if (doc.stamp) sheet.text(M, y0 + hh + 3.4, safe(doc.stamp), { size: 2.1, color: MUTED }); if (doc.project) sheet.text(W - M, y0 + hh + 3.4, safe(doc.project), { size: 2.1, color: MUTED, align: "right" });
    sheet.line(M, H - 17.5, W - M, H - 17.5, { w: 0.3, color: HEADC });
    sheet.wrapText(safe(conf), CW, { size: 2.1, font: "bold" }).slice(0, 2).forEach((l, i) => sheet.text(M, H - 14.4 + i * 2.8, l, { size: 2.1, font: "bold", color: INK }));
    sheet.wrapText(safe(FOOT_NOTE), CW, { size: 2.05 }).slice(0, 2).forEach((l, i) => sheet.text(M, H - 8.4 + i * 2.7, l, { size: 2.05, color: MUTED }));
  };
  const next = () => { sheet.newPage(); page++; y = TOP; furniture(); };
  const need = (h) => { if (y + h > BOTTOM) next(); };
  const lines = (text, width, o) => sheet.wrapText(safe(text), width, o);
  const write = (text, o = {}) => { const size = o.size || 3.3, lh = size * 1.42, x = M + (o.indent || 0); for (const l of lines(text, CW - (o.indent || 0), { size, font: o.font })) { need(lh); sheet.text(o.align === "center" ? W / 2 : x, y, l, { size, font: o.font, color: o.color || INK, baseline: "top", align: o.align }); y += lh; } y += o.after ?? 1.6; };
  const table = (head, rows, widths, o = {}) => {
    const n = (head || rows[0] || []).length, sum = (widths || []).reduce((s, w) => s + w, 0) || n, cols = Array.from({ length: n }, (_, i) => CW * ((widths && widths[i]) || 1) / sum), size = 2.75, lh = size * 1.36, pad = 1.1;
    const row = (cells, isHead) => {
      const wrapped = cells.map((c, i) => { const x = cellOf(c); return lines(x.text, cols[i] - 2 * pad, { size, font: isHead || x.bold || (o.firstCol && i === 0) ? "bold" : "sans" }); }), h = Math.max(o.height || 0, Math.max(1, ...wrapped.map((l) => l.length)) * lh + 2 * pad);
      if (y + h > BOTTOM) { next(); if (head && !isHead) row(head, true); }
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
  const heading = (b) => { const size = { h1: 5, h2: 4, h3: 3.5 }[b.type], lh = size * 1.3; if (b.type === "h1" && y > TOP + 12) y += 3; need(lh + 12); seen.set(b, page); y += b.type === "h1" ? 2 : 1; sheet.text(M, y, safe(b.text), { size, font: "bold", color: HEADC, baseline: "top" }); y += lh; if (b.type === "h1") { sheet.line(M, y, W - M, y, { w: 0.3, color: HEADC }); y += 1; } y += 1.6; };

  // title page : what the document is, who stands behind it, what changed
  furniture(); y = 62; write(doc.title, { size: 8.5, font: "bold", color: HEADC, after: 2 }); write(doc.subtitle || "", { size: 5, color: MUTED, after: 10 });
  table(null, [...(doc.project ? [["Projet", doc.project]] : []), ["N° de document", doc.reference || "—"], ["Révision", doc.revision || "—"], ["Date", date], ...(doc.organisation ? [["Organisation", doc.organisation]] : [])], [30, 70], { firstCol: true });
  const who = doc.approvals && doc.approvals.length ? doc.approvals : [{ role: "Préparé par", name: doc.author || "", date: doc.author ? date : "" }, { role: "Vérifié par", name: "", date: "" }, { role: "Approuvé par", name: "", date: "" }];
  y += 4; write("Approbation", { size: 3.6, font: "bold", color: HEADC, after: 1.2 }); table(["", "Nom", "Date", "Signature"], who.map((a) => [{ text: a.role, bold: true }, a.name || "", a.date || "", ""]), [24, 30, 18, 28], { height: 11 });
  const log = doc.revisions && doc.revisions.length ? doc.revisions : [{ rev: doc.revision || "A", reason: "Émission du document", sections: "Toutes", by: doc.author || (who[0] && who[0].name) || "", date }];
  y += 4; write("Journal des révisions", { size: 3.6, font: "bold", color: HEADC, after: 1.2 }); table(["Rév.", "Motif de la révision", "Sections touchées", "Nom", "Date"], log.slice(-8).map((r) => [{ text: r.rev || "", bold: true }, r.reason || "", r.sections || "Toutes", r.by || "", r.date || ""]), [9, 42, 19, 14, 16]);
  next();
  for (const b of doc.blocks) {
    if (/^h[123]$/.test(b.type)) heading(b);
    else if (b.type === "p") write(b.runs ? b.runs.map((r) => r.text).join("") : b.text, { color: b.style === "muted" ? MUTED : b.style === "warn" ? "#A14A00" : INK, font: b.style === "note" ? "italic" : b.style === "warn" ? "bold" : "sans" });
    else if (b.type === "list") { const wide = b.ordered && b.items.length > 9 ? 1.9 : 0; b.items.forEach((it, i) => { const x = cellOf(it), ind = 4 + wide + 4 * (x.level || 0), size = 3.2, lh = size * 1.42, ls = lines(x.text, CW - ind, { size }); need(lh); sheet.text(M + ind - 3.4 - wide, y, b.ordered ? `${i + 1}.` : "•", { size, color: INK, baseline: "top" }); for (const l of ls) { need(lh); sheet.text(M + ind, y, l, { size, color: INK, baseline: "top" }); y += lh; } y += 0.5; }); y += 1.6; }
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
      else if (b.jpeg) { const ratio = b.size ? b.size[1] / b.size[0] : 0.62, w = Math.min(b.width || 150, CW), h = Math.min(w * ratio, BOTTOM - TOP - 14); need(h + 9); try { sheet.image(M + (CW - h / ratio) / 2, y, h / ratio, h, b.jpeg); sheet.rect(M + (CW - h / ratio) / 2, y, h / ratio, h, { w: 0.15, color: LINE }); } catch (e) { sheet.text(W / 2, y + h / 2, "Figure non disponible", { size: 3, color: MUTED, align: "center" }); } y += h + 2; }
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
