/* DesignWizard.ai — composes the 2D drawing of a part on a Sheet (PDF or SVG backend): three orthographic views with
   hidden lines and an isometric view from the kernel's hidden-line projection, overall dimensions, a hole table,
   datums and GD&T derived from the interfaces, notes, title block. Pure layout code (browser and Node). */

import { PAPER, STYLE, LW, dimLinear, centerMark, featureControlFrame, datumFeature, viewLabel, drawBorder, drawTitleBlock, drawNotes, drawTable, drawRevisionTable, leaderNote, TITLE_BLOCK_H } from "./drafting.js";
import { interfaceType, patternPoints } from "../cad/interfaces.js";
import { materialOrDefault, PROCESSES } from "../cad/materials.js";
import { FACES } from "../cad/vec.js";

export const VIEW_DEFS = {
  front: { dir: [0, 1, 0], xdir: [1, 0, 0], ax: [0, 2], label: "FACE" },
  top: { dir: [0, 0, -1], xdir: [1, 0, 0], ax: [0, 1], label: "DESSUS" },
  right: { dir: [-1, 0, 0], xdir: [0, 1, 0], ax: [1, 2], label: "DROITE" },
  iso: { dir: [-0.577, 0.577, -0.577], xdir: [0.7071, 0.7071, 0], label: "ISOMÉTRIQUE", hidden: false },
};
export const viewRequest = () => Object.entries(VIEW_DEFS).map(([name, v]) => ({ name, dir: v.dir, xdir: v.xdir, hidden: v.hidden !== false }));
const SCALES = [[10, "10:1"], [5, "5:1"], [2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.4, "1:2,5"], [0.25, "1:4"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"]];
const f2 = (v) => (Math.round(v * 100) / 100).toString().replace(".", ",");

function bounds(view) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of ["visible", "smooth", "hidden"]) for (const seg of view[k] || []) for (const p of seg.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return Number.isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } : { x0: 0, y0: 0, x1: 1, y1: 1, w: 1, h: 1 };
}
function drawView(sheet, view, b, ox, oy, s, hidden) {
  const T = (p) => [ox + (p[0] - b.x0) * s, oy + (b.y1 - p[1]) * s];
  const lines = (list, style) => { for (const seg of list || []) if (seg.pts.length > 1) sheet.polyline(seg.pts.map(T), style); };
  if (hidden) lines(view.hidden, { ...STYLE.hidden, w: 0.2, color: "#555555" });
  lines(view.smooth, { w: LW.fine, color: "#444444" });
  lines(view.visible, { w: LW.visible, cap: "round" });
  return T;
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

/** Rows of the hole table: every drilled hole of the part, grouped by face, with a tag (A1, A2... B1...). */
export function holeTable(built) {
  const rows = [], byFace = new Map();
  for (const h of built.facts.holes || []) { const k = h.face || "?"; if (!byFace.has(k)) byFace.set(k, []); byFace.get(k).push(h); }
  let g = 0;
  for (const [face, list] of byFace) {
    const letter = String.fromCharCode(65 + g++), F = FACES[face];
    list.forEach((h, i) => {
      const p = F ? [h.at[F.plane[0]], h.at[F.plane[1]]] : [h.at[0], h.at[1]];
      const desc = [h.thread ? `${h.thread} taraudé` : null, h.fit === "insert" ? "insert à chaud" : null, h.fit && /^[A-Z]\d$/.test(h.fit) ? h.fit : null, h.through ? "débouchant" : `prof. ${f2(h.depth)}`,
        h.cbore ? `lamage Ø${f2(h.cbore.d)} × ${f2(h.cbore.depth)}` : null, h.csink ? `fraisure Ø${f2(h.csink.d)} × ${h.csink.angle || 90}°` : null].filter(Boolean).join(", ");
      rows.push({ tag: `${letter}${i + 1}`, face, x: p[0], y: p[1], d: h.d, desc, at: h.at, iface: h.iface });
    });
  }
  return rows;
}

/** Draw the whole sheet. data = {spec, built, views, project, opts:{size, projection, hidden, drawnBy, checkedBy, approvedBy, status, date}}. Returns what was drawn. */
export function composeDrawing(sheet, data) {
  const { spec, built, views, project } = data, o = data.opts || {};
  const frame = drawBorder(sheet, {}), mat = materialOrDefault(spec.material);
  const B = { front: bounds(views.front), top: bounds(views.top), right: bounds(views.right), iso: bounds(views.iso) };
  const gap = 26, dimPad = 20, notesW = 118;
  const areaW = frame.w - notesW - dimPad - 14, areaH = frame.h - TITLE_BLOCK_H - 26;
  let scale = SCALES[SCALES.length - 1];
  for (const sc of SCALES) { const s = sc[0]; if ((B.front.w + B.right.w) * s + gap + dimPad <= areaW && (B.front.h + B.top.h) * s + gap + 2 * dimPad <= areaH + TITLE_BLOCK_H - 8) { scale = sc; break; } }
  const s = scale[0], third = (o.projection || "third") === "third";
  const fx = frame.x + dimPad + 6, baseY = frame.y + frame.h - dimPad - 14;
  // third angle: top view above the front view, right view to its right (first angle: top view below, right view on the left is not offered here)
  const frontY = third ? baseY - B.front.h * s : frame.y + 16;
  const topY = third ? frontY - gap - B.top.h * s : frontY + B.front.h * s + gap;
  const rightX = fx + B.front.w * s + gap;
  const Tf = drawView(sheet, views.front, B.front, fx, frontY, s, o.hidden !== false);
  const Tt = drawView(sheet, views.top, B.top, fx, topY, s, o.hidden !== false);
  const Tr = drawView(sheet, views.right, B.right, rightX, frontY, s, o.hidden !== false);
  const isoS = Math.min(Math.max(s, 0.2) * 1.4, 105 / Math.max(B.iso.w, 1), 80 / Math.max(B.iso.h, 1));       // illustrative view, not to scale
  const isoX = frame.x + frame.w - notesW - B.iso.w * isoS - 10, isoY = frame.y + 14;
  if (isoX > rightX + B.right.w * s + 6 || isoY + B.iso.h * isoS < frontY - 8) { drawView(sheet, views.iso, B.iso, Math.max(isoX, rightX + 4), isoY, isoS, false); }

  // overall dimensions
  const bb = built.bbox, dx = bb[3] - bb[0], dy = bb[4] - bb[1], dz = bb[5] - bb[2];
  dimLinear(sheet, Tf([B.front.x0, B.front.y0]), Tf([B.front.x1, B.front.y0]), { dir: "h", offset: 12, text: f2(dx) });
  dimLinear(sheet, Tf([B.front.x0, B.front.y0]), Tf([B.front.x0, B.front.y1]), { dir: "v", offset: -12, text: f2(dz) });
  dimLinear(sheet, Tt([B.top.x0, B.top.y0]), Tt([B.top.x0, B.top.y1]), { dir: "v", offset: -12, text: f2(dy) });

  // holes: centre marks and tags in the view that faces them, table on the right
  const holes = holeTable(built), sem = drawingSemantics(spec, built);
  const viewOf = { "+Z": [Tt, (h) => [h.at[0], h.at[1]]], "-Z": [Tt, (h) => [h.at[0], h.at[1]]], "-Y": [Tf, (h) => [h.at[0], h.at[2]]], "+Y": [Tf, (h) => [h.at[0], h.at[2]]], "+X": [Tr, (h) => [h.at[1], h.at[2]]], "-X": [Tr, (h) => [h.at[1], h.at[2]]] };
  const pos = new Map();
  for (const h of holes) {
    const v = viewOf[h.face];
    if (!v) continue;
    const c = v[0](v[1](h));
    pos.set(h.tag, c);
    centerMark(sheet, c, Math.max(h.d / 2 * s, 0.8), { over: 1.5 });
    if (holes.length <= 40) sheet.text(c[0] + Math.max(h.d / 2 * s, 0.8) + 0.8, c[1] - Math.max(h.d / 2 * s, 0.8) - 0.5, h.tag, { size: 2.2, font: "italic", color: "#333333" });
  }
  // datums
  const dA = sem.datums[0], FA = FACES[dA.face];
  if (FA && FA.axis === 2) { const zA = dA.level ?? (FA.n[2] > 0 ? bb[5] : bb[2]); const p = Tf([B.front.x0 + B.front.w * 0.22, zA]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[2] > 0 ? "up" : "down" }); }
  else if (FA && FA.axis === 1) { const p = Tt([B.top.x0 + B.top.w * 0.22, FA.n[1] > 0 ? bb[4] : bb[1]]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[1] > 0 ? "up" : "down" }); }
  else if (FA) { const p = Tt([FA.n[0] > 0 ? bb[3] : bb[0], B.top.y0 + B.top.h * 0.3]); datumFeature(sheet, p[0], p[1], "A", { dir: FA.n[0] > 0 ? "right" : "left" }); }
  for (const d of sem.datums.slice(1)) {
    const F = FACES[d.face];
    if (F.axis === 0) { const p = Tt([bb[0], B.top.y0 + B.top.h * 0.7]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "left" }); }
    else if (F.axis === 1) { const p = Tt([B.top.x0 + B.top.w * 0.7, bb[1]]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "down" }); }
    else { const p = Tf([B.front.x0 + B.front.w * 0.7, bb[2]]); datumFeature(sheet, p[0], p[1], d.letter, { dir: "down" }); }
  }
  // GD&T frames: attached to the first hole of each pattern when it is visible, else stacked in the notes column
  const colX = frame.x + frame.w - notesW;
  let gy = Math.max(isoY + B.iso.h * isoS + 10, frame.y + 92);
  for (const g of sem.gdt) {
    const tagged = holes.find((h) => h.iface === g.iface && pos.has(h.tag));
    const text = `${g.count > 1 ? `${g.count}× ` : ""}${g.name}${g.fit ? ` ${g.fit}` : ""}`;
    sheet.text(colX, gy, text.length > 58 ? `${text.slice(0, 57)}…` : text, { size: 2.5 });
    const fr = featureControlFrame(sheet, colX, gy + 1.5, { symbol: g.symbol, tolerance: f2(g.tolerance), diameter: g.diameter, modifier: g.modifier, datums: g.datums }, { h: 6, leaderTo: tagged && sem.gdt.length <= 4 ? pos.get(tagged.tag) : undefined });
    gy += fr.height + 8;
  }
  // tables and notes
  let ty = gy + 2;
  if (holes.length) {
    const groups = new Map();
    for (const h of holes) { const k = `${h.face}|${f2(h.d)}|${h.desc}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
    const detail = holes.length <= 14;
    const rows = detail ? holes.map((h) => [h.tag, h.face, f2(h.x), f2(h.y), `Ø${f2(h.d)}`, h.desc]) : [...groups.values()].map((l) => [`${l[0].tag}–${l[l.length - 1].tag}`, l[0].face, "—", "—", `${l.length}× Ø${f2(l[0].d)}`, l[0].desc]);
    const t = drawTable(sheet, colX, ty, [{ title: "Repère", width: 14 }, { title: "Face", width: 10 }, { title: "X", width: 13, align: "right" }, { title: "Y", width: 13, align: "right" }, { title: "Ø", width: 18 }, { title: "Description", width: notesW - 72 }], rows.slice(0, 22), { size: 2.2, title: "TABLEAU DES TROUS" });
    ty += t.h + 6;
  }
  const notes = [`Matériau : ${mat.name}.${spec.finish ? ` Finition : ${spec.finish}.` : ""}`, `Procédé : ${(PROCESSES[spec.process] || {}).fr || "à définir"}.`,
    "Tolérances générales ISO 2768-mK ; cotes en millimètres.", "Casser les arêtes vives 0,2 à 0,5 mm ; ébavurer.", "Les cotes non indiquées sont définies par le modèle 3D (STEP).",
    ...sem.gdt.filter((g) => g.rule).map((g) => `${g.name} : tolérance de position calculée (${g.rule}).`), ...(spec.notes || [])];
  const maxNotesY = frame.y + frame.h - TITLE_BLOCK_H - 4;
  if (ty < maxNotesY - 20) drawNotes(sheet, colX, ty, notesW - 4, notes.slice(0, Math.max(3, Math.floor((maxNotesY - ty) / 6))), { title: "NOTES", size: 2.4 });
  viewLabel(sheet, fx + B.front.w * s / 2, (third ? baseY : frontY + B.front.h * s) + 15, "", `ÉCHELLE ${scale[1]}`);
  if (spec.revision) drawRevisionTable(sheet, frame.x + frame.w, frame.y, [{ rev: spec.revision, description: o.revisionText || "Émission", date: o.date || "", by: o.drawnBy || "" }], { align: "right" });
  drawTitleBlock(sheet, frame, { title: spec.name || spec.id, partNumber: spec.id, revision: spec.revision || "A", material: mat.name, finish: spec.finish || "—", mass: built.mass >= 1000 ? `${f2(built.mass / 1000)} kg` : `${f2(built.mass)} g`,
    scale: scale[1], sheet: "1/1", size: o.size || "A3", drawnBy: o.drawnBy || "", checkedBy: o.checkedBy || "", approvedBy: o.approvedBy || "", date: o.date || "", company: "DesignWizard.ai", project: (project && project.name) || "",
    generalTolerance: "ISO 2768-mK", projection: third ? "third" : "first", units: "mm", status: o.status || "Préliminaire" });
  return { scale: scale[1], holes, gdt: sem.gdt, datums: sem.datums, notes };
}
export { PAPER };
