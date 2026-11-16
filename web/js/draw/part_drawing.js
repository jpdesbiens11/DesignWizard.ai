/* DesignWizard.ai — composes the 2D drawing of a part on a Sheet (PDF or SVG backend), on a tabloid page (11 × 17 in) :
   the three standard views fitted in the middle of the sheet, a small isometric view top right, the notes always bottom
   left, the title block bottom right with the tables above it. Every dimension the design defines is there — on the view
   that shows it, or in a table — with its round balloon, and its class symbol (reference, SC, CSC) right after it. A part
   with something inside gets a section A-A, hatched, beside the top view, and its cutting plane on the top view. Datums and geometric
   tolerances come from the interfaces and read as ASME Y14.5. Pure layout code (browser and Node). */

import { PAPER, STYLE, LW, dimLinear, centerMark, featureControlFrame, datumFeature, viewLabel, drawBorder, drawTitleBlock, drawNotes, drawTable, drawRevisionTable, leaderNote, sectionArrows, TITLE_BLOCK_H } from "./drafting.js";
import { hatch } from "./hatch.js";
import { interfaceType, patternPoints } from "../cad/interfaces.js";
import { materialOrDefault, PROCESSES } from "../cad/materials.js";
import { FACES } from "../cad/vec.js";
import { dimensionList, holeRows, dimText, classNotes, f2 } from "./dim_model.js";

export const VIEW_DEFS = {
  front: { dir: [0, 1, 0], xdir: [1, 0, 0], ax: [0, 2], label: "FACE" },
  top: { dir: [0, 0, -1], xdir: [1, 0, 0], ax: [0, 1], label: "DESSUS" },
  right: { dir: [-1, 0, 0], xdir: [0, 1, 0], ax: [1, 2], label: "DROITE" },
  iso: { dir: [-0.577, 0.577, -0.577], xdir: [0.7071, 0.7071, 0], label: "ISOMÉTRIQUE", hidden: false },
};
/** The views to ask the kernel for : the standard ones, and the section when the part has one (cad/section_view.js : sectionOf). */
export const viewRequest = (section = null) => [...Object.entries(VIEW_DEFS).map(([name, v]) => ({ name, dir: v.dir, xdir: v.xdir, hidden: v.hidden !== false })), ...(section ? [{ ...section, name: "section", hidden: false }] : [])];
export const SHEET = "TABLOID";
const SCALES = [[10, "10:1"], [5, "5:1"], [2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.4, "1:2,5"], [0.25, "1:4"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"]];
const RAD = Math.PI / 180, BAL_R = 2.5, RIGHT_W = 180;

export function bounds(view) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of ["visible", "smooth", "hidden", "cut"]) for (const seg of view[k] || []) for (const p of seg.pts || seg) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return Number.isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } : { x0: 0, y0: 0, x1: 1, y1: 1, w: 1, h: 1 };
}
export function drawView(sheet, view, b, ox, oy, s, hidden) {
  const T = (p) => [ox + (p[0] - b.x0) * s, oy + (b.y1 - p[1]) * s];
  const lines = (list, style) => { for (const seg of list || []) if (seg.pts.length > 1) sheet.polyline(seg.pts.map(T), style); };
  if (hidden) lines(view.hidden, { ...STYLE.hidden, w: 0.2, color: "#555555" });
  lines(view.smooth, { w: LW.fine, color: "#444444" });
  lines(view.visible, { w: LW.visible, cap: "round" });
  return T;
}
/** A round balloon with the number of a dimension. */
export function balloon(sheet, c, n, r = BAL_R) { sheet.circle(c[0], c[1], r, { w: LW.thin, fill: "#ffffff" }); sheet.text(c[0], c[1] + r * 0.36, String(n), { size: r * 0.95, align: "center" }); }
/** The symbol of a special characteristic : a diamond for SC, a triangle pointing down for CSC, with the letters after it. → its width. */
export function classSymbol(sheet, x, y, cls, h = 4.4) {
  if (cls !== "sc" && cls !== "csc") return 0;
  const w = h * 0.9, pts = cls === "sc" ? [[x + w / 2, y - h / 2], [x + w, y], [x + w / 2, y + h / 2], [x, y]] : [[x, y - h / 2], [x + w, y - h / 2], [x + w / 2, y + h / 2]];
  sheet.polyline(pts, { w: LW.medium, close: true });
  const label = cls.toUpperCase(); sheet.text(x + w + 0.7, y + 0.95, label, { size: 2.6, font: "bold" });
  return w + 0.7 + sheet.textWidth(label, { size: 2.6, font: "bold" });
}
/** What follows the text of a dimension drawn on a view : its balloon, then its class symbol, along the direction of the text — never over it. */
function annotate(sheet, d, r) {
  const a = r.angle * RAD, al = [Math.cos(a), Math.sin(a)], up = [Math.sin(a), -Math.cos(a)], tw = sheet.textWidth(r.text, { size: 3.5 });
  if (d.basic && d.cls !== "ref") { const hw = tw / 2 + 0.9, c = [r.x + up[0] * 2.35, r.y + up[1] * 2.35], q = (i, j) => [c[0] + al[0] * hw * i + up[0] * 2.15 * j, c[1] + al[1] * hw * i + up[1] * 2.15 * j]; sheet.polyline([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)], { w: LW.fine, close: true }); }
  const run = tw / 2 + 2 + BAL_R, c = [r.x + al[0] * run + up[0] * 2.3, r.y + al[1] * run + up[1] * 2.3];
  balloon(sheet, c, d.n);
  if (d.cls === "sc" || d.cls === "csc") { if (Math.abs(al[0]) > 0.5) classSymbol(sheet, c[0] + BAL_R + 1, c[1], d.cls); else classSymbol(sheet, c[0] - 2, c[1] - BAL_R - 3.4, d.cls); }
}

/** Datum letters and GD&T derived from the interfaces of the part. */
export function drawingSemantics(spec, built) {
  const ifs = built.interfaces || [], datums = [], gdt = [];
  const primary = ifs.find((i) => i.type === "planar") || ifs.find((i) => i.type === "bolt_pattern") || ifs[0] || null;
  const faceA = primary ? primary.face : "-Z";
  datums.push({ letter: "A", face: faceA, level: primary ? primary.level : built.bbox[2], why: primary ? `plan d'appui de l'interface « ${primary.name} »` : "face inférieure" });
  const side = ["-X", "-Y", "-Z"].filter((f) => f[1] !== faceA[1]);
  datums.push({ letter: "B", face: side[0], why: "face latérale longue" }, { letter: "C", face: side[1], why: "face latérale perpendiculaire" });
  for (const it of ifs) {
    let g = null;
    try { g = interfaceType(it.type).gdt(it.params, it.side === "A" ? it.opts : null, it.side === "B" ? it.opts : null); } catch (e) { g = null; }
    if (!g) continue;
    const n = it.type === "bolt_pattern" ? patternPoints(it.params.pattern).length : 1;
    gdt.push({ iface: it.id, name: it.name, face: it.face, symbol: g.symbol, tolerance: g.tolerance, diameter: !!g.diameter, modifier: g.modifier || null, datums: g.symbol === "flatness" ? [] : g.symbol === "position" ? ["A", "B", "C"] : ["A"], count: n, rule: g.rule || "", fit: g.fit || "" });
  }
  return { datums, gdt };
}
export const holeTable = holeRows;
/** The notes every part drawing carries, then those of the part. */
export function drawingNotes(spec, sem, dims) {
  const mat = materialOrDefault(spec.material), rules = new Map();
  for (const g of sem.gdt) if (g.rule) rules.set(g.rule, [...(rules.get(g.rule) || []), g.name]);
  return [`Cotation et tolérancement géométrique interprétés selon ASME Y14.5-2018 ; cotes en millimètres ; tolérances générales des cotes non tolérancées : ISO 2768-mK.`,
    `Matériau : ${mat.name}.${spec.finish ? ` Finition : ${spec.finish}.` : ""} Procédé : ${(PROCESSES[spec.process] || {}).fr || "à définir"}. Casser les arêtes vives 0,2 à 0,5 mm ; ébavurer.`,
    "Chaque cote porte une bulle numérotée, sur la vue qui la montre ou au tableau. Les cotes encadrées (entre crochets au tableau) sont des cotes de base : elles situent un groupe tolérancé en position par rapport aux références A, B et C.",
    ...classNotes(dims), ...[...rules].map(([rule, names]) => `Tolérances de position calculées (${rule}) : ${names.join(" ; ")}.`), ...(spec.notes || [])];
}
/** The height a block of notes takes. */
export function notesHeight(sheet, notes, width, size = 2.3) { const indent = sheet.textWidth(`${notes.length}.`, { size }) + size * 0.6; return (size + 1) * 0.718 + 0.9 + size * 0.9 + notes.reduce((h, n) => h + sheet.wrapText(String(n), width - indent, { size }).length * size * 1.5 + size * 0.35, 0); }

/** Draw the whole sheet. data = {spec, built, views, project, opts:{projection, hidden, drawnBy, checkedBy, approvedBy, status, date, revisions}}. Returns what was drawn. */
export function composeDrawing(sheet, data) {
  const { spec, built, views, project } = data, o = data.opts || {};
  const frame = drawBorder(sheet, { confidential: o.confidential }), mat = materialOrDefault(spec.material), sem = drawingSemantics(spec, built), dims = dimensionList(spec, built), holes = holeRows(built);
  const B = { front: bounds(views.front), top: bounds(views.top), right: bounds(views.right), iso: bounds(views.iso) }, third = (o.projection || "third") === "third";
  /* the furniture first : it says what room is left for the views */
  const notes = drawingNotes(spec, sem, dims), notesW = 150, nH = Math.min(notesHeight(sheet, notes, notesW), 80), notesY = frame.y + frame.h - nH - 3, colX = frame.x + frame.w - RIGHT_W;
  const revs = o.revisions && o.revisions.length ? o.revisions : [{ rev: spec.revision || "A", description: o.revisionText || "Émission", date: o.date || "", by: o.drawnBy || "" }];
  const revH = (Math.min(revs.length, 4) + 2) * 5, isoBox = { x: frame.x + frame.w - 66, y: frame.y + revH + 3, w: 62, h: 48 };
  /* the three views, at the largest standard scale that fits, centred in what is left */
  const gap = 24, padL = 34, padR = 40, padT = 31, padB = 36, area = { x: frame.x + 4, y: frame.y + 4, w: colX - frame.x - 10, h: notesY - frame.y - 10 };
  let scale = SCALES[SCALES.length - 1];
  for (const sc of SCALES) { const k = sc[0]; if ((B.front.w + B.right.w) * k + gap + padL + padR <= area.w && (B.front.h + B.top.h) * k + gap + padT + padB <= area.h) { scale = sc; break; } }
  const s = scale[0], bw = (B.front.w + B.right.w) * s + gap, bh = (B.front.h + B.top.h) * s + gap;
  const fx = area.x + padL + (area.w - padL - padR - bw) / 2, y0 = area.y + padT + (area.h - padT - padB - bh) / 2;
  const topY = third ? y0 : y0 + B.front.h * s + gap, frontY = third ? y0 + B.top.h * s + gap : y0, rightX = fx + B.front.w * s + gap;
  const T = { front: drawView(sheet, views.front, B.front, fx, frontY, s, o.hidden !== false), top: drawView(sheet, views.top, B.top, fx, topY, s, o.hidden !== false), right: drawView(sheet, views.right, B.right, rightX, frontY, s, o.hidden !== false) };
  const isoS = Math.min(isoBox.w / Math.max(B.iso.w, 1), isoBox.h / Math.max(B.iso.h, 1));                       // illustrative, not to scale
  drawView(sheet, views.iso, B.iso, isoBox.x + (isoBox.w - B.iso.w * isoS) / 2, isoBox.y + (isoBox.h - B.iso.h * isoS) / 2, isoS, false);

  /* dimensions on the views : each stands OUTSIDE its view, in a row of its own, so that none sits on another or on the part ;
     its balloon and its class follow its text. A side that is full sends the next dimension to the table. */
  const box = { front: [fx, frontY, B.front.w * s, B.front.h * s], top: [fx, topY, B.top.w * s, B.top.h * s], right: [rightX, frontY, B.right.w * s, B.right.h * s] };
  /* rows around each view : h (the outer side of the view), hB (the side of the top view that faces the front view, in the gap between them),
     vL and vR (left and right ; for the front view, vR is the gap toward the right view) */
  const cap = { "top:h": 3, "top:hB": 2, "top:vL": 1, "top:vR": 3, "front:h": 3, "front:vL": 2, "front:vR": 2, "right:h": 3, "right:vR": 3 }, used = {}, onView = [];
  const place = (d, p1, p2, view, slots) => {
    const [vx, vy, vw, vh] = box[view], slot = slots.find((q) => (used[`${view}:${q}`] || 0) < (cap[`${view}:${q}`] || 0)); if (!slot) return false;
    const key = `${view}:${slot}`, k = used[key] || 0, above = view === "top" && third, lo = Math.min(p1[1], p2[1]) - vy, hi = vy + vh - Math.max(p1[1], p2[1]); used[key] = k + 1;
    const off = slot === "h" ? (above ? -(lo + 10 + 8 * k) : hi + 10 + 8 * k) : slot === "hB" ? (above ? hi + 7 + 7 * k : -(lo + 7 + 7 * k))
      : slot === "vL" ? -(Math.min(p1[0], p2[0]) - vx + 17 + 10 * k) : vx + vw - Math.max(p1[0], p2[0]) + (view === "front" ? 7 + 8 * k : 10 + 10 * k);      // 17 : a datum symbol stands between the view and its first dimension
    annotate(sheet, d, dimLinear(sheet, p1, p2, { dir: slot === "h" || slot === "hB" ? "h" : "v", offset: off, text: dimText(d) })); onView.push(d.key); return true;
  };
  const slotsOf = (d) => (d.dir === "h" ? (d.on === "top" && d.kind === "detail" ? ["hB", "h"] : ["h"]) : d.on === "front" ? (d.kind === "detail" ? ["vR", "vL"] : ["vL"]) : ["vR"]);
  const bb = built.bbox;
  for (const d of dims.filter((x) => x.kind === "overall")) {
    if (d.axis === 0) place(d, T.front([B.front.x0, B.front.y0]), T.front([B.front.x1, B.front.y0]), "front", ["h"]);
    else if (d.axis === 2) place(d, T.front([B.front.x0, B.front.y0]), T.front([B.front.x0, B.front.y1]), "front", ["vL"]);
    else place(d, T.top([B.top.x0, B.top.y0]), T.top([B.top.x0, B.top.y1]), "top", ["vL"]);
  }
  /* detail dimensions first : each design parameter where its operation shows it ; a radius is told by a leader from its corner.
     Then the basic dimensions of the bolt patterns take the rows that are left ; the others go to the table, which the standard allows for a group. */
  for (const d of dims.filter((x) => x.kind === "detail")) {
    if (!d.leader) { place(d, T[d.on](d.p1), T[d.on](d.p2), d.on, slotsOf(d)); continue; }
    const from = T[d.on](d.leader), to = [from[0] + 7, from[1] + 8], note = leaderNote(sheet, from, to, [dimText(d)], { size: 3.2 });
    balloon(sheet, [note.x + note.width + 1.5 + BAL_R, to[1]], d.n); if (d.cls === "sc" || d.cls === "csc") classSymbol(sheet, note.x + note.width + 2 * BAL_R + 3, to[1], d.cls); onView.push(d.key);
  }
  for (const d of dims.filter((x) => x.kind === "pattern")) place(d, T[d.on](d.p1), T[d.on](d.p2), d.on, slotsOf(d));
  /* the section A-A : in the row of the top view, clear of its dimensions, at the scale of the sheet when it fits — its cut face hatched,
     its plane shown on the top view with the arrows of the look */
  let section = null; const sec = views.section && views.section.cut && views.section.cut.length ? views.section : null;
  if (sec) {
    const Bs = bounds(sec), rows = used["top:vR"] || 0, sx = Math.max(rightX, fx + B.top.w * s + (rows ? 30 + 10 * rows : 0)), rowH = B.top.h * s, roomW = area.x + area.w - sx - 4, roomH = rowH + padT - 14;
    const k = SCALES.find((c) => c[0] <= s && Bs.w * c[0] <= roomW && Bs.h * c[0] <= roomH);
    if (k) {
      const sw = Bs.w * k[0], sh = Bs.h * k[0], sy = third ? topY + rowH - sh : topY, TS = drawView(sheet, sec, Bs, sx, sy, k[0], false);
      for (const [a, b] of hatch(sec.cut.map((pl) => pl.map(TS)), 1.3, 45)) sheet.line(a[0], a[1], b[0], b[1], { w: LW.fine, color: "#333333" });      // close lines : a thin wall must still show that it is cut
      for (const pl of sec.cut) sheet.polyline(pl.map(TS), { w: LW.visible, cap: "round" });
      viewLabel(sheet, sx + sw / 2, sy + sh + 4, "COUPE A-A", k[0] !== s ? `ÉCHELLE ${k[1]}` : "", { size: 3.6 });
      const at = sec.plane.at, ends = sec.plane.axis === "x" ? [T.top([at, B.top.y1]), T.top([at, B.top.y0])] : [T.top([B.top.x1, at]), T.top([B.top.x0, at])], out = 5, ux = Math.sign(ends[1][0] - ends[0][0]), uy = Math.sign(ends[1][1] - ends[0][1]);
      sectionArrows(sheet, [ends[0][0] - ux * out, ends[0][1] - uy * out], [ends[1][0] + ux * out, ends[1][1] + uy * out], "A", { size: 3.6, arrowLen: 7 });
      section = { x: sx, y: sy, w: sw, h: sh, scale: k[1], axis: sec.plane.axis, at };
    }
  }
  /* holes : centre marks and tags in the view that faces them */
  const viewOf = { "+Z": "top", "-Z": "top", "-Y": "front", "+Y": "front", "+X": "right", "-X": "right" }, pos = new Map();
  for (const h of holes) { const v = viewOf[h.face]; if (!v) continue; const c = T[v]([h.x, h.y]), r = Math.max(h.d / 2 * s, 0.8); pos.set(h.tag, c); centerMark(sheet, c, r, { over: 1.5 }); if (holes.length <= 40) sheet.text(c[0] + r + 0.8, c[1] - r - 0.5, h.tag, { size: 2.2, font: "italic", color: "#333333" }); }
  /* datums */
  const dA = sem.datums[0], FA = FACES[dA.face];
  if (FA && FA.axis === 2) { const zA = dA.level ?? (FA.n[2] > 0 ? bb[5] : bb[2]); const p = T.front([B.front.x0 + B.front.w * 0.78, zA]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[2] > 0 ? "up" : "down" }); }
  else if (FA && FA.axis === 1) { const p = T.top([B.top.x0 + B.top.w * 0.78, FA.n[1] > 0 ? bb[4] : bb[1]]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[1] > 0 ? "up" : "down" }); }
  else if (FA) { const p = T.top([FA.n[0] > 0 ? bb[3] : bb[0], B.top.y0 + B.top.h * 0.3]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[0] > 0 ? "right" : "left" }); }
  for (const d of sem.datums.slice(1)) {
    const F = FACES[d.face];
    if (F.axis === 0) { const p = T.top([bb[0], B.top.y0 + B.top.h * 0.1]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "left", stem: 2.5 }); }
    else if (F.axis === 1) { const p = T.top([B.top.x0 + B.top.w * (used["top:hB"] && third ? 0.66 : 0.2), bb[1]]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "down" }); }      // clear of the dimensions that stand under the top view
    else { const p = T.front([B.front.x0 + B.front.w * 0.2, bb[2]]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "down" }); }
  }
  /* right column, under the isometric view and above the title block : geometric tolerances, then the tables — every row with its balloon */
  const limit = frame.y + frame.h - TITLE_BLOCK_H - 4; let gy = frame.y + revH + 6, left = 0;      // the tolerances stand beside the isometric view, the tables under it
  for (const g of sem.gdt) {
    if (gy + 9 > limit) { left++; continue; }
    const tagged = holes.find((h) => h.iface === g.iface && pos.has(h.tag)), text = `${g.count > 1 ? `${g.count}× ` : ""}${g.name}${g.fit ? ` ${g.fit}` : ""}`;
    const fr = featureControlFrame(sheet, colX, gy, { symbol: g.symbol, tolerance: f2(g.tolerance), diameter: g.diameter, modifier: g.modifier, datums: g.datums }, { h: 6, leaderTo: tagged && sem.gdt.length <= 3 ? pos.get(tagged.tag) : undefined });
    const room = (gy < isoBox.y + isoBox.h + 2 ? isoBox.x : frame.x + frame.w) - colX - (fr.width || 44) - 5, fit = Math.max(8, Math.floor(room / 1.25));
    sheet.text(colX + (fr.width || 44) + 2.5, gy + 4.1, text.length > fit ? `${text.slice(0, fit - 1)}…` : text, { size: 2.5 });
    gy += (fr.height || 6) + 2.2;
  }
  gy = Math.max(gy + 3, isoBox.y + isoBox.h + 5);
  const tableOf = (title, list, cols, cells) => {
    if (!list.length) return; const room = Math.floor((limit - gy) / 4.4) - 2; if (room < 1) { left += list.length; return; }
    const shown = list.slice(0, room), t = drawTable(sheet, colX + 7, gy, cols, shown.map(cells), { size: 2.2, rowH: 4.4, title });
    shown.forEach((d, i) => { const cy = gy + (i + 2) * 4.4 + 2.2; balloon(sheet, [colX + 3.2, cy], d.n, 2); if (d.cls === "sc" || d.cls === "csc") classSymbol(sheet, colX + 7 + t.w + 1.2, cy, d.cls, 3.4); });
    left += list.length - shown.length; gy += t.h + 5;
  };
  /* the holes first : their table is short, and the definition table takes what room is left */
  tableOf("TABLEAU DES TROUS", dims.filter((d) => d.table === "holes"), [{ title: "Repères", width: 22 }, { title: "Trou", width: 28 }, { title: "Description", width: 88 }], (d) => [d.tags, dimText(d), d.label]);
  tableOf("COTES DE DÉFINITION", dims.filter((d) => d.table === "def" || ((d.kind === "pattern" || d.kind === "detail") && !onView.includes(d.key))), [{ title: "Cote", width: 110 }, { title: "Valeur", width: 30, align: "right" }], (d) => [d.label, `${d.basic && d.cls !== "ref" ? "[" : ""}${dimText(d)}${d.basic && d.cls !== "ref" ? "]" : ""}`]);
  if (left) sheet.text(colX, Math.min(gy, limit), `… et ${left} autre(s) élément(s) : voir le modèle 3D et la liste des cotes.`, { size: 2.3, font: "italic" });
  drawNotes(sheet, frame.x + 4, notesY, notesW, notes, { title: "NOTES", size: 2.3 });
  viewLabel(sheet, fx + B.front.w * s / 2, frontY + B.front.h * s + 10 + 8 * (used["front:h"] || 1) + 5, "", `ÉCHELLE ${scale[1]}`);
  drawRevisionTable(sheet, frame.x + frame.w, frame.y, revs.slice(-4), { align: "right" });
  drawTitleBlock(sheet, frame, { title: spec.name || spec.id, partNumber: spec.id, revision: spec.revision || "A", material: mat.name, finish: spec.finish || "—", mass: built.mass >= 1000 ? `${f2(built.mass / 1000)} kg` : `${f2(built.mass)} g`,
    scale: scale[1], sheet: "1/1", size: "B (11 × 17)", drawnBy: o.drawnBy || "", checkedBy: o.checkedBy || "", approvedBy: o.approvedBy || "", date: o.date || "", company: o.organisation || "DesignWizard.ai", project: (project && project.name) || "",
    generalTolerance: "ISO 2768-mK", projection: third ? "third" : "first", units: "mm", status: o.status || "Préliminaire" });
  return { scale: scale[1], holes, gdt: sem.gdt, datums: sem.datums, notes, dims, onView, section, layout: { notes: { x: frame.x + 4, y: notesY, w: notesW, h: nH }, iso: isoBox, views: { x: fx, y: y0, w: bw, h: bh }, area, frame } };
}
export { PAPER };
