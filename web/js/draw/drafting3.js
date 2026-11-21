/* DesignWizard.ai — drafting helpers, part 3: sheet furniture — ISO 5457 border with zone grid, ISO 7200
   style title block ("cartouche", French labels), projection symbol, notes, generic and revision tables.
   Built ONLY on the Sheet primitives (PDF and SVG backends render the same). Units: mm, y down.
   Re-exported by drafting.js. */

import { LW, TEXT_H, TEXT_SMALL, GREY, fitText } from "./drafting2.js";
import { BRAND, FOOT_NOTE, drawLogo, confidentialNote } from "../core/brand.js";

/* ---- border -------------------------------------------------------------------------------------------- */

/** ISO 5457 drawing frame: thick frame `margin` mm from the sheet edge (`left` mm on the filing side),
    5 mm grid-reference band around it, centring marks and zone letters / numbers every `zone` mm
    (counted from the centre of the sheet, letters top → bottom without I and O, numbers left → right).
    opts: { margin = 10, left = margin + 10, grid = true, zone = 50, color }.
    Returns the inner frame { x, y, w, h } (the usable drawing space). */
export function drawBorder(sheet, { margin = 10, left, grid = true, zone = 50, color = "#000", confidential = "" } = {}) {
  const ml = left ?? margin + 10;
  const f = { x: ml, y: margin, w: sheet.width - ml - margin, h: sheet.height - 2 * margin };
  const band = Math.min(5, margin / 2), thin = { w: LW.thin, color }, thick = { w: LW.frame, color };
  const cx = sheet.width / 2, cy = sheet.height / 2, x1 = f.x + f.w, y1 = f.y + f.h;
  sheet.rect(f.x, f.y, f.w, f.h, thick);
  /* in the margin under the frame : the confidentiality note of the project, then the note of the platform (core/brand.js) */
  const low = sheet.height - Math.max(1.2, (margin - band) / 2 - 1.3);
  sheet.text(f.x, low - 2.3, confidential || confidentialNote(), { size: 1.8, font: "bold", color: "#1c2430" }); sheet.text(f.x, low, FOOT_NOTE, { size: 1.8, color: "#3a4450" });
  if (!grid) return f;
  sheet.rect(f.x - band, f.y - band, f.w + 2 * band, f.h + 2 * band, thin);

  // Centring marks: from the outer edge of the band to 5 mm inside the frame.
  const inset = 5;
  sheet.line(cx, f.y - band, cx, f.y + inset, thick).line(cx, y1 + band, cx, y1 - inset, thick);
  sheet.line(f.x - band, cy, f.x + inset, cy, thick).line(x1 + band, cy, x1 - inset, cy, thick);

  // Zone boundaries, measured from the centring marks outward.
  const cuts = (c, lo, hi) => {
    const out = [lo];
    for (let v = c - Math.floor((c - lo) / zone) * zone; v < hi - 1e-6; v += zone) if (v > lo + 1e-6) out.push(v);
    out.push(hi);
    return out;
  };
  const xs = cuts(cx, f.x, x1), ys = cuts(cy, f.y, y1);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ", size = Math.min(TEXT_H, band * 0.7);
  const label = (x, y, s) => sheet.text(x, y, s, { size, align: "center", baseline: "middle", color });
  xs.forEach((x, i) => {
    if (i > 0 && i < xs.length - 1 && Math.abs(x - cx) > 1e-6) {
      sheet.line(x, f.y - band, x, f.y, thin).line(x, y1, x, y1 + band, thin);
    }
    if (i < xs.length - 1 && xs[i + 1] - x >= 8) {
      const mid = (x + xs[i + 1]) / 2;
      label(mid, f.y - band / 2, String(i + 1));
      label(mid, y1 + band / 2, String(i + 1));
    }
  });
  ys.forEach((y, i) => {
    if (i > 0 && i < ys.length - 1 && Math.abs(y - cy) > 1e-6) {
      sheet.line(f.x - band, y, f.x, y, thin).line(x1, y, x1 + band, y, thin);
    }
    if (i < ys.length - 1 && ys[i + 1] - y >= 8) {
      const mid = (y + ys[i + 1]) / 2, s = letters[i % letters.length];
      label(f.x - band / 2, mid, s);
      label(x1 + band / 2, mid, s);
    }
  });
  return f;
}

/* ---- projection symbol --------------------------------------------------------------------------------- */

/** First / third angle projection symbol (truncated cone + two concentric circles) centred on (cx, cy).
    method: 'first' (cone left, circles right — ISO, Europe) | 'third' (circles left, cone right — ASME).
    opts: { scale = 1 (the symbol is 21 x 8 mm at scale 1), color }. */
export function projectionSymbol(sheet, cx, cy, method = "first", { scale = 1, color = "#000" } = {}) {
  const k = scale, len = 9 * k, rSmall = 2 * k, rBig = 4 * k, gap = 4 * k, over = 1.5 * k;
  const st = { w: LW.medium, color }, axis = { w: 0.13, color, dash: [3 * k, 0.8 * k, 0.8 * k, 0.8 * k] };
  const x0 = cx - (len + gap + 2 * rBig) / 2;
  const third = method === "third";
  const coneX = third ? x0 + 2 * rBig + gap : x0, circX = third ? x0 + rBig : x0 + len + gap + rBig;
  // Side view of the cone: small end on the left, large end on the right (same for both methods).
  sheet.polyline([[coneX, cy - rSmall], [coneX + len, cy - rBig], [coneX + len, cy + rBig], [coneX, cy + rSmall]],
    { ...st, close: true });
  sheet.line(coneX - over, cy, coneX + len + over, cy, axis);
  sheet.circle(circX, cy, rBig, st).circle(circX, cy, rSmall, st);
  sheet.line(circX - rBig - over, cy, circX + rBig + over, cy, axis);
  sheet.line(circX, cy - rBig - over, circX, cy + rBig + over, axis);
  return sheet;
}

/* ---- title block --------------------------------------------------------------------------------------- */

export const TITLE_BLOCK_W = 180;
export const TITLE_BLOCK_H = 48;
/** The tolerance block « UNLESS OTHERWISE SPECIFIED », left of the title block, as tall as it (draw/uos.js gives its lines). */
export const TOL_BLOCK_W = 62;

/** The tolerance block : its lines in a box TOL_BLOCK_W × TITLE_BLOCK_H, the first one bold ; example values are said in red under them. */
export function drawTolBlock(sheet, x, y, lines = [], { example = false } = {}) {
  sheet.rect(x, y, TOL_BLOCK_W, TITLE_BLOCK_H, { w: LW.frame });
  const step = Math.min(4.2, (TITLE_BLOCK_H - 12) / Math.max(1, lines.length));      // the bottom 8 mm stay free : the centring mark of the frame comes up there
  lines.forEach((l, i) => { const f = fitText(sheet, l, TOL_BLOCK_W - 3, i ? 2.2 : 2.3, i ? "sans" : "bold"); sheet.text(x + 1.5, y + 4 + i * step, f.str, { size: f.size, font: i ? "sans" : "bold" }); });
  if (example) { const f = fitText(sheet, "EXAMPLE VALUES - TO BE CONFIRMED", TOL_BLOCK_W - 3, 2.2, "bold"); sheet.text(x + 1.5, y + 4 + lines.length * step + 0.6, f.str, { size: f.size, font: "bold", color: "#c0392b" }); }
  return { x, y, w: TOL_BLOCK_W, h: TITLE_BLOCK_H };
}

/** One labelled field: small grey label top-left, value on the lower line (shrunk to fit). */
function field(sheet, x, y, w, h, label, value, { font = "sans", size = TEXT_H } = {}) {
  sheet.text(x + 1.2, y + 2.7, label, { size: 1.8, color: GREY });
  const v = String(value ?? "");
  if (!v) return;
  const fit = fitText(sheet, v, w - 2.4, size, font);
  sheet.text(x + 1.2, y + h - 1.7, fit.str, { size: fit.size, font });
}

/** Title block ("cartouche", ISO 7200 style), 180 x 48 mm, in the bottom-right corner of `frame`
    (the { x, y, w, h } returned by drawBorder). All fields of `data` are optional:
    { title, partNumber, revision, material, finish, mass, scale, sheet: '1/1', size: 'A3', drawnBy,
      checkedBy, approvedBy, date, company: 'DesignWizard.ai', project, generalTolerance: 'ISO 2768-mK',
      projection: 'first'|'third', units: 'mm', status, uos: { lines, example } }
    uos : the tolerance block, drawn left of the title block ; the field of the general tolerances then names the standard.
    Returns the block rectangle { x, y, w, h } (with `tol`, the rectangle of the tolerance block, when there is one). */
export function drawTitleBlock(sheet, frame, data = {}) {
  const d = { company: "DesignWizard.ai", generalTolerance: "ISO 2768-mK", projection: "first", units: "mm",
    sheet: "1/1", ...data };
  const W = TITLE_BLOCK_W, H = TITLE_BLOCK_H, R = 8; // six rows of 8 mm
  const x = frame.x + frame.w - W, y = frame.y + frame.h - H;
  const thin = { w: LW.thin }, X = (u) => x + u, Y = (v) => y + v;
  const hl = (v, u0, u1) => sheet.line(X(u0), Y(v), X(u1), Y(v), thin);
  const vl = (u, v0, v1) => sheet.line(X(u), Y(v0), X(u), Y(v1), thin);

  // Grid. Left column (0..60): company, project, projection + scale/format, status.
  // Right part (60..180): signatures, material/finish, tolerances/mass/units, title, identification.
  hl(R, 60, W); hl(2 * R, 0, W); hl(3 * R, 0, W); hl(4 * R, 30, 60); hl(5 * R, 0, W);
  vl(30, 3 * R, 5 * R); vl(90, 0, R); vl(120, 0, 3 * R); vl(120, 5 * R, H);
  vl(150, 0, R); vl(150, 2 * R, 3 * R); vl(150, 5 * R, H);
  sheet.line(X(60), Y(0), X(60), Y(H), { w: LW.medium });
  sheet.rect(x, y, W, H, { w: LW.frame });

  // Who made the drawing : the mark of the platform, its name and its house — and the company of the designer when one is given.
  drawLogo(sheet, X(2.5), Y(2.2), 11.5);
  const own = d.company && !/^DesignWizard\.ai/i.test(d.company) ? fitText(sheet, d.company, 42, 3.2, "bold") : null, name = fitText(sheet, BRAND.product, 42, 4.6, "bold");
  sheet.text(X(16), Y(own ? 4.6 : 6.2), name.str, { size: name.size, font: "bold", baseline: "middle" });
  sheet.text(X(16), Y(own ? 8.6 : 10.8), `by ${BRAND.by}`, { size: 2.6, baseline: "middle", color: "#3a4450" });
  if (own) sheet.text(X(16), Y(12.6), own.str, { size: own.size, font: "bold", baseline: "middle" });

  const F = (u, v, w, h, label, value, o) => field(sheet, X(u), Y(v), w, h, label, value, o);
  F(0, 2 * R, 60, R, "Project", d.project);
  projectionSymbol(sheet, X(15), Y(4 * R), d.projection);
  F(30, 3 * R, 30, R, "Scale", d.scale);
  F(30, 4 * R, 30, R, "Size", d.size);
  F(0, 5 * R, 60, R, "Status", d.status);

  F(60, 0, 30, R, "Drawn", d.drawnBy);
  F(90, 0, 30, R, "Checked", d.checkedBy);
  F(120, 0, 30, R, "Approved", d.approvedBy);
  F(150, 0, 30, R, "Date", d.date);
  F(60, R, 60, R, "Material", d.material);
  F(120, R, 60, R, "Finish", d.finish);
  const tol = d.uos ? drawTolBlock(sheet, x - TOL_BLOCK_W, y, d.uos.lines, { example: d.uos.example }) : null;
  F(60, 2 * R, 60, R, tol ? "Tolerancing" : "General tolerances", tol ? d.uos.std || "ASME Y14.5-2018" : d.generalTolerance);
  F(120, 2 * R, 30, R, "Mass", d.mass);
  F(150, 2 * R, 30, R, "Units", d.units);
  F(60, 5 * R, 60, R, "Part No.", d.partNumber, { font: "bold" });
  F(120, 5 * R, 30, R, "Rev.", d.revision, { font: "bold" });
  F(150, 5 * R, 30, R, "Sheet", d.sheet);

  // Title: 5 mm bold, one or two lines (smaller sizes are tried before truncating).
  sheet.text(X(61.2), Y(3 * R + 2.7), "Title", { size: 1.8, color: GREY });
  const title = String(d.title ?? ""), maxW = 120 - 5;
  if (title) {
    let size = 5, lines = sheet.wrapText(title, maxW, { size, font: "bold" });
    while (lines.length > 2 && size > 3.5) { size -= 0.5; lines = sheet.wrapText(title, maxW, { size, font: "bold" }); }
    if (lines.length > 2) lines = [lines[0], fitText(sheet, lines.slice(1).join(" "), maxW, size, "bold", 1).str];
    const lineH = size * 1.25, mid = Y(3 * R + 9.2), top = mid - ((lines.length - 1) * lineH) / 2;
    lines.forEach((s, i) => sheet.text(X(62.5), top + i * lineH, s, { size, font: "bold", baseline: "middle" }));
  }
  return tol ? { x, y, w: W, h: H, tol } : { x, y, w: W, h: H };
}

/* ---- notes --------------------------------------------------------------------------------------------- */

/** Numbered, word-wrapped notes with their top-left corner at (x, y), in a column `width` mm wide.
    opts: { title = 'NOTES' (falsy: none), size = 2.5, color }. Returns the total height in mm. */
export function drawNotes(sheet, x, y, width, notes = [], { title = "NOTES", size = TEXT_SMALL, color = "#000" } = {}) {
  const lineH = size * 1.5, cap = 0.718;
  let cy = y;
  if (title) {
    const ts = size + 1;
    sheet.text(x, cy, String(title), { size: ts, font: "bold", baseline: "top", color });
    cy += ts * cap + 0.9;
    sheet.line(x, cy, x + sheet.textWidth(String(title), { size: ts, font: "bold" }), cy, { w: LW.thin, color });
    cy += size * 0.9;
  }
  const indent = sheet.textWidth(`${notes.length}.`, { size }) + size * 0.6;
  notes.forEach((note, i) => {
    sheet.text(x + indent - size * 0.6, cy, `${i + 1}.`, { size, align: "right", baseline: "top", color });
    const lines = sheet.wrapText(String(note ?? ""), width - indent, { size });
    lines.forEach((s, k) => sheet.text(x + indent, cy + k * lineH, s, { size, baseline: "top", color }));
    cy += lines.length * lineH + size * 0.35;
  });
  return cy - y;
}

/* ---- tables -------------------------------------------------------------------------------------------- */

/** Generic table (hole table, BOM, ...) with its top-left corner at (x, y).
    columns: [{ title, width (mm), align: 'left'|'center'|'right' }]; rows: array of arrays of cell values.
    opts: { size = 2.5, rowH = 2 * size, title (optional caption row spanning the table), header = true,
    color }. Cell text is shrunk / truncated to fit its column. Returns { w, h }. */
export function drawTable(sheet, x, y, columns = [], rows = [], opts = {}) {
  const { size = TEXT_SMALL, title, color = "#000" } = opts;
  const rowH = opts.rowH ?? size * 2, pad = Math.min(1.2, size * 0.45);
  const w = columns.reduce((s, c) => s + (c.width ?? 20), 0);
  const header = opts.header !== false && columns.some((c) => c.title);
  const thin = { w: LW.fine, color }, medium = { w: LW.medium, color };
  const cell = (cx, cy, cw, value, align, font) => {
    const fit = fitText(sheet, String(value ?? ""), cw - 2 * pad, size, font);
    const tx = align === "center" ? cx + cw / 2 : align === "right" ? cx + cw - pad : cx + pad;
    sheet.text(tx, cy + rowH / 2, fit.str, { size: fit.size, font, align, baseline: "middle", color });
  };
  let cy = y;
  if (title) {
    cell(x, cy, w, title, "center", "bold");
    cy += rowH;
    sheet.line(x, cy, x + w, cy, medium);
  }
  const gridTop = cy;
  if (header) {
    let cx = x;
    for (const c of columns) { cell(cx, cy, c.width ?? 20, c.title ?? "", "center", "bold"); cx += c.width ?? 20; }
    cy += rowH;
    sheet.line(x, cy, x + w, cy, medium);
  }
  rows.forEach((row, i) => {
    let cx = x;
    columns.forEach((c, k) => { cell(cx, cy, c.width ?? 20, row?.[k], c.align ?? "left", "sans"); cx += c.width ?? 20; });
    cy += rowH;
    if (i < rows.length - 1) sheet.line(x, cy, x + w, cy, thin);
  });
  let cx = x;
  for (const c of columns.slice(0, -1)) { cx += c.width ?? 20; sheet.line(cx, gridTop, cx, cy, thin); }
  sheet.rect(x, y, w, cy - y, medium);
  return { w, h: cy - y };
}

export const REVISION_TABLE_W = 120;

/** Revision table. rows: [{ rev, description, date, by }].
    opts: { align = 'left' ((x, y) is the top-left corner) | 'right' ((x, y) is the top-right corner, handy
    to hang the table in the top-right corner of the frame), size = 2.5, title = 'REVISIONS' }.
    Returns { w, h } (w = 120). */
export function drawRevisionTable(sheet, x, y, rows = [], { align = "left", size = TEXT_SMALL, title = "REVISIONS" } = {}) {
  const columns = [
    { title: "Rev.", width: 12, align: "center" },
    { title: "Description", width: 66, align: "left" },
    { title: "Date", width: 24, align: "center" },
    { title: "By", width: 18, align: "center" },
  ];
  const x0 = align === "right" ? x - REVISION_TABLE_W : x;
  return drawTable(sheet, x0, y, columns, rows.map((r) => [r?.rev, r?.description, r?.date, r?.by]), { size, title });
}
