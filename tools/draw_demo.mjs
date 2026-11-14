/* DesignWizard.ai — demo of the 2D drawing kit: renders one A3 sheet that exercises every primitive and
   drafting helper, with both backends.
   Usage: node tools/draw_demo.mjs <outdir>   → <outdir>/demo.pdf and <outdir>/demo.svg
   The module also exports buildDemo() and makeMosaicJpeg() (used by tests/node/draw.test.mjs). */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PdfSheet } from "../web/js/draw/pdf.js";
import { SvgSheet } from "../web/js/draw/svg.js";
import {
  PAPER, STYLE, LW, GREY, GDT_SYMBOLS, drawBorder, drawTitleBlock, drawNotes, drawRevisionTable, drawTable,
  dimLinear, dimDiameter, dimRadius, leaderNote, centerMark, centerLine, gdtSymbol, featureControlFrame,
  datumFeature, surfaceFinish, sectionArrows, viewLabel, hatchPolygon,
} from "../web/js/draw/drafting.js";

/* ---- tiny JPEG synthesiser ----------------------------------------------------------------------------- */

/** Builds a valid baseline JPEG (YCbCr 4:4:4) in which every 8x8 block is a flat colour.
    `blocks` is a grid (rows) of [r, g, b] (0..255). Only DC coefficients are coded, so the encoder needs no
    DCT and two tiny Huffman tables. Returns a Uint8Array. */
export function makeMosaicJpeg(blocks) {
  const rows = blocks.length, cols = blocks[0].length, w = cols * 8, h = rows * 8;
  const out = [];
  const seg = (marker, data) => out.push(0xFF, marker, ((data.length + 2) >> 8) & 0xFF, (data.length + 2) & 0xFF, ...data);
  out.push(0xFF, 0xD8);
  seg(0xE0, [0x4A, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);          // JFIF
  seg(0xDB, [0x00, ...new Array(64).fill(8)]);                                    // quantisation table 0 (all 8)
  seg(0xC0, [8, h >> 8, h & 0xFF, w >> 8, w & 0xFF, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0]); // SOF0
  seg(0xC4, [0x00, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]); // DC: 9 codes of 4 bits
  seg(0xC4, [0x10, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x00, 0xF0]);  // AC: EOB = '0', ZRL = '10'
  seg(0xDA, [3, 1, 0x00, 2, 0x00, 3, 0x00, 0, 63, 0]);                            // start of scan

  let acc = 0, nbits = 0;
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) {
      acc = (acc << 1) | ((value >> i) & 1);
      if (++nbits === 8) { out.push(acc); if (acc === 0xFF) out.push(0x00); acc = 0; nbits = 0; }
    }
  };
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const pred = [0, 0, 0];
  for (const row of blocks) {
    for (const [r, g, b] of row) {
      const ycc = [0.299 * r + 0.587 * g + 0.114 * b, -0.168736 * r - 0.331264 * g + 0.5 * b + 128,
        0.5 * r - 0.418688 * g - 0.081312 * b + 128];
      ycc.forEach((v, c) => {
        const dc = clamp(v) - 128, diff = dc - pred[c];   // DC = 8·(v − 128), quantised by 8
        pred[c] = dc;
        const size = diff === 0 ? 0 : 32 - Math.clz32(Math.abs(diff));
        put(size, 4);                                      // Huffman code of the category (= its value)
        if (size) put(diff > 0 ? diff : diff + (1 << size) - 1, size);
        put(0, 1);                                         // end of block
      });
    }
  }
  if (nbits) put((1 << (8 - nbits)) - 1, 8 - nbits);       // pad the last byte with ones
  out.push(0xFF, 0xD9);
  return new Uint8Array(out);
}

/** Pixel-art preview of the demo part (blue plate with a bore) as a 160 x 120 px JPEG. */
export function demoJpeg() {
  const blocks = [];
  for (let r = 0; r < 15; r++) {
    const row = [];
    for (let c = 0; c < 20; c++) {
      const d = Math.hypot(c - 9.5, r - 7);
      let rgb = [226 - r * 2, 233 - r * 2, 244 - r];                       // background
      if (c >= 3 && c <= 16 && r >= 2 && r <= 12) rgb = [70 + r * 4, 128 + r * 4, 205]; // plate
      if ((c === 4 || c === 15) && (r === 3 || r === 11)) rgb = [28, 40, 62];           // corner holes
      if (d < 4.2) rgb = [150, 190, 235];                                               // counterbore
      if (d < 3.1) rgb = [28, 40, 62];                                                  // bore
      row.push(rgb);
    }
    blocks.push(row);
  }
  return makeMosaicJpeg(blocks);
}

/* ---- the demo sheet ------------------------------------------------------------------------------------ */

const SYMBOL_LABELS = {
  position: "position", flatness: "planéité", perpendicularity: "perpend.", parallelism: "parall.",
  angularity: "inclin.", concentricity: "coaxial.", symmetry: "symétrie", circularity: "circul.",
  cylindricity: "cylindr.", profile_line: "profil ligne", profile_surface: "profil surf.", runout: "battement",
  total_runout: "batt. total", straightness: "rectitude", diameter: "diamètre", mmc: "MMC", lmc: "LMC",
  counterbore: "lamage", countersink: "fraisure", depth: "profondeur",
};

/** Draws the demo drawing on `sheet` (any Sheet backend, A3 landscape). */
export function buildDemo(sheet, { jpeg = demoJpeg() } = {}) {
  const frame = drawBorder(sheet);
  drawTitleBlock(sheet, frame, {
    title: "Plaque support de palier — usinée", partNumber: "DW-2026-0042", revision: "B",
    material: "Aluminium 6061-T6", finish: "Anodisé noir 15 µm", mass: "0,48 kg", scale: "1:1",
    sheet: "1/1", size: "A3", drawnBy: "A. Tremblay", checkedBy: "M. Côté", approvedBy: "L. Bélanger",
    date: "2026-11-14", project: "Banc d'essai — réducteur", generalTolerance: "ISO 2768-mK",
    projection: "first", units: "mm", status: "Préliminaire",
  });
  drawRevisionTable(sheet, frame.x + frame.w, frame.y, [
    { rev: "A", description: "Émission initiale", date: "2026-10-02", by: "ATR" },
    { rev: "B", description: "Ajout du lamage Ø50 ; tolérance de position resserrée", date: "2026-11-14", by: "ATR" },
  ], { align: "right" });

  /* -- front view: plate 120 x 80, corners R10, bore Ø40 H7 with a Ø50 counterbore, 4 holes Ø9 -- */
  const fx = 62, fy = 62, fw = 120, fh = 80, rc = 10, k = rc * 0.5523;
  sheet.path([
    ["M", fx + rc, fy], ["L", fx + fw - rc, fy], ["C", fx + fw - rc + k, fy, fx + fw, fy + rc - k, fx + fw, fy + rc],
    ["L", fx + fw, fy + fh - rc], ["C", fx + fw, fy + fh - rc + k, fx + fw - rc + k, fy + fh, fx + fw - rc, fy + fh],
    ["L", fx + rc, fy + fh], ["C", fx + rc - k, fy + fh, fx, fy + fh - rc + k, fx, fy + fh - rc],
    ["L", fx, fy + rc], ["C", fx, fy + rc - k, fx + rc - k, fy, fx + rc, fy], ["Z"],
  ], STYLE.visible);
  const cx = fx + fw / 2, cy = fy + fh / 2;
  const holes = [[fx + 15, fy + 15], [fx + 105, fy + 15], [fx + 15, fy + 65], [fx + 105, fy + 65]];
  sheet.circle(cx, cy, 20, STYLE.visible).circle(cx, cy, 25, STYLE.visible);
  centerMark(sheet, [cx, cy], 25);
  holes.forEach((p, i) => {
    sheet.circle(p[0], p[1], 4.5, STYLE.visible);
    centerMark(sheet, p, 4.5);
    sheet.text(p[0] + 5.5, p[1] + 7.5, `A${i + 1}`, { size: 2.5, font: "italic", color: GREY });
  });
  sheet.text(cx + 17, cy + 27.5, "B1", { size: 2.5, font: "italic", color: GREY });

  dimLinear(sheet, holes[2], holes[3], { dir: "h", offset: 29, tol: "±0.1" });
  dimLinear(sheet, [fx, fy + fh], [fx + fw, fy + fh], { dir: "h", offset: 22 });
  dimLinear(sheet, holes[0], holes[2], { dir: "v", offset: -24, tol: "±0.1" });
  dimLinear(sheet, [fx, fy], [fx, fy + fh], { dir: "v", offset: -17 });

  const d9 = dimDiameter(sheet, holes[1], 4.5, { angle: -25, leader: 22, text: "4× Ø9" });
  const tw9 = sheet.textWidth(d9.text, { size: 3.5 });
  featureControlFrame(sheet, d9.x - tw9 / 2 - 1, d9.y + 1.7,
    { symbol: "position", tolerance: "0.2", diameter: true, modifier: "mmc", datums: ["A", "B", "C"] });
  const d40 = dimDiameter(sheet, [cx, cy], 20, { angle: 10, leader: 46, text: "Ø40 H7" });
  const tw40 = sheet.textWidth(d40.text, { size: 3.5 });
  featureControlFrame(sheet, d40.x - tw40 / 2 - 1, d40.y + 1.7,
    { symbol: "perpendicularity", tolerance: "0.05", diameter: true, datums: ["A"] });
  dimRadius(sheet, [fx + fw - rc, fy + rc], rc, { angle: -60 });
  datumFeature(sheet, fx + 38, fy, "B", { dir: "up" });
  datumFeature(sheet, fx + fw, fy + 30, "C", { dir: "right" });
  sectionArrows(sheet, [cx, fy - 6], [cx, fy + fh + 6], "A", { flip: true });

  /* -- top view (first angle: below the front view) with hidden lines and an adjacent part -- */
  const ty = 190, td = 20;
  sheet.rect(fx, ty, fw, td, STYLE.visible);
  for (const p of holes.slice(0, 2)) {
    sheet.line(p[0] - 4.5, ty, p[0] - 4.5, ty + td, STYLE.hidden).line(p[0] + 4.5, ty, p[0] + 4.5, ty + td, STYLE.hidden);
    centerLine(sheet, [p[0], ty - 3], [p[0], ty + td + 3]);
  }
  for (const s of [-1, 1]) {
    sheet.polyline([[cx + s * 20, ty], [cx + s * 20, ty + 15], [cx + s * 25, ty + 15], [cx + s * 25, ty + td]], STYLE.hidden);
  }
  sheet.rect(cx - 10, ty - 9, 20, td + 18, STYLE.phantom);
  centerLine(sheet, [cx, ty - 12], [cx, ty + td + 12]);
  leaderNote(sheet, [cx + 10, ty + td + 5], [cx + 24, ty + td + 11], ["Arbre Ø20 h6", "(pièce adjacente)"], { size: 2.5 });
  surfaceFinish(sheet, fx + 88, ty, 3.2);

  /* -- section A-A (seen from the left, placed on the right) -- */
  const sx = 262, st = 20, top = fy, bot = fy + fh;
  const upper = [[sx, top], [sx + st, top], [sx + st, cy - 25], [sx + 15, cy - 25], [sx + 15, cy - 20], [sx, cy - 20]];
  const lower = [[sx, bot], [sx + st - 1, bot], [sx + st, bot - 1], [sx + st, cy + 25], [sx + 15, cy + 25], [sx + 15, cy + 20], [sx, cy + 20]];
  for (const poly of [upper, lower]) {
    hatchPolygon(sheet, poly, { spacing: 2.2 });
    sheet.polyline(poly, { ...STYLE.visible, close: true });
  }
  sheet.line(sx, cy - 20, sx, cy + 20, STYLE.visible).line(sx + st, cy - 25, sx + st, cy + 25, STYLE.visible);
  sheet.line(sx + 15, cy - 20, sx + 15, cy + 20, STYLE.visible);
  centerLine(sheet, [sx - 4, cy], [sx + st + 4, cy]);
  dimLinear(sheet, [sx + 15, cy - 25], [sx + st, top], { dir: "h", offset: -8 });
  dimLinear(sheet, [sx, top], [sx + st, top], { dir: "h", offset: -16 });
  dimLinear(sheet, [sx + st, cy - 25], [sx + st, cy + 25], { dir: "v", offset: 10, text: "Ø50" });
  datumFeature(sheet, sx, bot - 12, "A", { dir: "left" });
  surfaceFinish(sheet, sx, top + 14, 1.6, { angle: -90 });
  sheet.circle(sx + st, bot, 5, { w: LW.fine });
  sheet.text(sx + st + 5.5, bot + 6, "B", { size: 5, font: "bold" });
  viewLabel(sheet, sx + st / 2, bot + 12, "COUPE A-A", "ÉCHELLE 1:1");

  /* -- detail B (5:1): chamfered edge, aligned dimension -- */
  const dx = 176, dy = 240;
  sheet.polyline([[dx, dy], [dx + 22, dy], [dx + 32, dy + 10], [dx + 32, dy + 28]], STYLE.visible);
  sheet.polyline([[dx, dy], [dx - 1.5, dy + 7], [dx + 1.5, dy + 14], [dx - 1, dy + 21], [dx, dy + 28], [dx + 8, dy + 29.2],
    [dx + 16, dy + 26.8], [dx + 24, dy + 29], [dx + 32, dy + 28]], { w: LW.fine });
  dimLinear(sheet, [dx + 22, dy], [dx + 32, dy + 10], { dir: "aligned", offset: -7, text: "1 × 45°" });
  viewLabel(sheet, dx + 14, dy + 33, "DÉTAIL B", "ÉCHELLE 5:1");

  /* -- notes, hole table, GD&T symbol legend, embedded JPEG -- */
  drawNotes(sheet, 28, 236, 118, [
    "Casser les arêtes vives 0,5 × 45° sauf indication contraire.",
    "Tolérances générales selon ISO 2768-mK ; cotes en millimètres.",
    "Rugosité générale Ra 3,2 µm ; alésage Ø40 H7 : Ra 1,6 µm.",
    "Ébavurer et nettoyer avant anodisation ; masquer l'alésage Ø40 H7 pendant le traitement de surface.",
    "Contrôler la position des trous A1 à A4 au calibre fonctionnel (références A, B et C).",
  ]);
  drawTable(sheet, 298, 168, [
    { title: "Repère", width: 16, align: "center" }, { title: "X", width: 16, align: "right" },
    { title: "Y", width: 16, align: "right" }, { title: "Ø", width: 22, align: "center" },
    { title: "Description", width: 38, align: "left" },
  ], [
    ["A1", "15", "65", "Ø9", "Débouchant"], ["A2", "105", "65", "Ø9", "Débouchant"],
    ["A3", "15", "15", "Ø9", "Débouchant"], ["A4", "105", "15", "Ø9", "Débouchant"],
    ["B1", "60", "40", "Ø40 H7", "Lamage Ø50 × 5"],
  ], { title: "TABLEAU DES TROUS" });

  const lx = 232, ly = 206, cell = 12.8;
  sheet.text(lx, ly, "Symboles GD&T (tracés vectoriels)", { size: 2.5, font: "bold", baseline: "top" });
  GDT_SYMBOLS.forEach((name, i) => {
    const gx = lx + (i % 10) * cell, gy = ly + 4.5 + Math.floor(i / 10) * 13;
    sheet.rect(gx, gy, 7, 7, { w: LW.fine, color: "#999" });
    gdtSymbol(sheet, name, gx, gy, 7);
    sheet.text(gx, gy + 9.6, SYMBOL_LABELS[name] || name, { size: 1.8, color: GREY });
  });

  if (jpeg) {
    sheet.image(368, 208, 36, 27, jpeg);
    sheet.rect(368, 208, 36, 27, { w: LW.fine });
    sheet.text(366.5, 235, "Aperçu (JPEG)", { size: 1.8, color: GREY, angle: -90 });
  }
  return sheet;
}

/* ---- command line -------------------------------------------------------------------------------------- */

function main(outDir) {
  const [width, height] = PAPER.A3;
  const title = "DesignWizard.ai — démo du kit de dessin";
  mkdirSync(outDir, { recursive: true });
  const pdf = buildDemo(new PdfSheet({ width, height, title }));
  const svg = buildDemo(new SvgSheet({ width, height, title }));
  writeFileSync(join(outDir, "demo.pdf"), pdf.toBytes());
  writeFileSync(join(outDir, "demo.svg"), svg.toString());
  console.log(`Wrote ${join(outDir, "demo.pdf")} and ${join(outDir, "demo.svg")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) { console.error("Usage: node tools/draw_demo.mjs <outdir>"); process.exit(1); }
  main(resolve(process.argv[2]));
}
