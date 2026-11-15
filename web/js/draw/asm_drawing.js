/* DesignWizard.ai — composes the drawing of an ASSEMBLY on a tabloid sheet : the three standard views of the placed
   parts in the middle, a small isometric view top right, the notes bottom left, and above the title block — bottom
   right — the parts list. Each part of the list is shown on a view by a round balloon with its item number ; the overall
   dimensions carry their own small balloons, numbered after the items, so that no number is used twice on the sheet.
   Pure layout code (browser and Node). */

import { LW, dimLinear, drawBorder, drawTitleBlock, drawNotes, drawTable, drawRevisionTable, viewLabel, TITLE_BLOCK_H } from "./drafting.js";
import { bounds, drawView, balloon, notesHeight } from "./part_drawing.js";
import { f2 } from "./dim_model.js";

const SCALES = [[5, "5:1"], [2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.4, "1:2,5"], [0.25, "1:4"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"], [0.02, "1:50"]];
const RIGHT_W = 180, ITEM_R = 4, AX = { front: [0, 2], top: [0, 1], right: [1, 2] };

/** Where the balloons of a view stand : on the rectangle of the view grown by `out`, in the direction of each part, pushed apart when two would touch. */
export function placeBalloons(items, box, out = 13, r = ITEM_R) {
  const c = [box.x + box.w / 2, box.y + box.h / 2], hw = box.w / 2 + out, hh = box.h / 2 + out;
  const list = items.map((it) => { const dx = it.p[0] - c[0], dy = it.p[1] - c[1]; return { ...it, a: Math.hypot(dx, dy) < 0.5 ? -Math.PI / 2 : Math.atan2(dy, dx) }; }).sort((p, q) => p.a - q.a);
  const at = (a) => { const t = Math.min(hw / Math.max(Math.abs(Math.cos(a)), 1e-9), hh / Math.max(Math.abs(Math.sin(a)), 1e-9)); return [c[0] + t * Math.cos(a), c[1] + t * Math.sin(a)]; };
  for (let pass = 0; pass < 40; pass++) { let moved = false;
    for (let i = 1; i < list.length; i++) { const p = at(list[i - 1].a), q = at(list[i].a); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 2 * r + 1.5) { list[i].a += 0.06; moved = true; } }
    if (!moved) break; }
  return list.map((it) => ({ ...it, b: at(it.a) }));
}

/** data = { asm, project, views, bbox, rows (the BOM), centers: { partId: [x, y, z] }, mass, joints, opts }. Returns what was drawn. */
export function composeAssemblyDrawing(sheet, data) {
  const { asm, project, views, bbox: bb, rows } = data, o = data.opts || {}, frame = drawBorder(sheet, {});
  const B = { front: bounds(views.front), top: bounds(views.top), right: bounds(views.right), iso: bounds(views.iso) }, third = (o.projection || "third") === "third";
  const parts = rows.filter((r) => r.kind === "part"), hw = rows.filter((r) => r.kind !== "part");
  const notes = ["Cotation interprétée selon ASME Y14.5-2018 ; cotes en millimètres ; cotes hors tout de l'assemblage monté.", "Les bulles renvoient aux repères de la nomenclature ; chaque pièce est définie par son propre dessin, à la révision indiquée.",
    `${asm.instances.length} pièce(s) posée(s), ${(asm.mates || []).length} joint(s)${hw.length ? `, visserie et consommables : ${hw.length} ligne(s) de nomenclature` : ""}.`, "Ordre de montage, outillage et couples de serrage : voir la gamme d'assemblage.", ...(asm.notes || [])];
  const notesW = 150, nH = Math.min(notesHeight(sheet, notes, notesW), 80), notesY = frame.y + frame.h - nH - 3, colX = frame.x + frame.w - RIGHT_W;
  const revs = o.revisions && o.revisions.length ? o.revisions : [{ rev: asm.revision || "A", description: "Émission", date: o.date || "", by: o.drawnBy || "" }];
  const revH = (Math.min(revs.length, 4) + 2) * 5, isoBox = { x: frame.x + frame.w - 66, y: frame.y + revH + 3, w: 62, h: 48 };
  const gap = 32, pad = 30, area = { x: frame.x + 4, y: frame.y + 4, w: colX - frame.x - 10, h: notesY - frame.y - 10 };
  let scale = SCALES[SCALES.length - 1];
  for (const sc of SCALES) { const k = sc[0]; if ((B.front.w + B.right.w) * k + gap + 2 * pad <= area.w && (B.front.h + B.top.h) * k + gap + 2 * pad <= area.h) { scale = sc; break; } }
  const s = scale[0], bw = (B.front.w + B.right.w) * s + gap, bh = (B.front.h + B.top.h) * s + gap, fx = area.x + (area.w - bw) / 2, y0 = area.y + (area.h - bh) / 2;
  const topY = third ? y0 : y0 + B.front.h * s + gap, frontY = third ? y0 + B.top.h * s + gap : y0, rightX = fx + B.front.w * s + gap;
  const O = { front: [fx, frontY], top: [fx, topY], right: [rightX, frontY] }, T = {};
  for (const v of ["front", "top", "right"]) T[v] = drawView(sheet, views[v], B[v], O[v][0], O[v][1], s, false);
  const isoS = Math.min(isoBox.w / Math.max(B.iso.w, 1), isoBox.h / Math.max(B.iso.h, 1));
  drawView(sheet, views.iso, B.iso, isoBox.x + (isoBox.w - B.iso.w * isoS) / 2, isoBox.y + (isoBox.h - B.iso.h * isoS) / 2, isoS, false);
  /* each part of the list goes to the view where it stands clear of those already placed there */
  const onView = { front: [], top: [], right: [] }, where = {};
  for (const r of parts) { const c = (data.centers || {})[r.id]; if (!c) continue;
    const v = ["front", "top", "right"].find((k) => { const p = T[k]([c[AX[k][0]], c[AX[k][1]]]); return onView[k].every((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) > 7); }) || "front";
    onView[v].push({ item: r.item, p: T[v]([c[AX[v][0]], c[AX[v][1]]]) }); where[r.id] = v; }
  for (const v of ["front", "top", "right"]) for (const it of placeBalloons(onView[v], { x: O[v][0], y: O[v][1], w: B[v].w * s, h: B[v].h * s })) {
    const d = Math.hypot(it.b[0] - it.p[0], it.b[1] - it.p[1]) || 1, e = [it.b[0] - (it.b[0] - it.p[0]) / d * ITEM_R, it.b[1] - (it.b[1] - it.p[1]) / d * ITEM_R];
    sheet.line(it.p[0], it.p[1], e[0], e[1], { w: LW.fine }); sheet.circle(it.p[0], it.p[1], 0.55, { w: LW.fine, fill: "#000000" }); balloon(sheet, it.b, it.item, ITEM_R);
  }
  /* overall dimensions, numbered after the items */
  let n = rows.length;
  const dim = (p1, p2, dir, off, value) => { const r = dimLinear(sheet, p1, p2, { dir, offset: off, text: f2(value) }), a = r.angle * Math.PI / 180, al = [Math.cos(a), Math.sin(a)], up = [Math.sin(a), -Math.cos(a)], run = sheet.textWidth(r.text, { size: 3.5 }) / 2 + 4.5;
    balloon(sheet, [r.x + al[0] * run + up[0] * 2.3, r.y + al[1] * run + up[1] * 2.3], ++n); return n; };
  const dims = [["Longueur hors tout", bb[3] - bb[0], dim(T.front([B.front.x0, B.front.y0]), T.front([B.front.x1, B.front.y0]), "h", 24, bb[3] - bb[0])],
    ["Hauteur hors tout", bb[5] - bb[2], dim(T.front([B.front.x0, B.front.y0]), T.front([B.front.x0, B.front.y1]), "v", -24, bb[5] - bb[2])],
    ["Largeur hors tout", bb[4] - bb[1], dim(T.top([B.top.x0, B.top.y0]), T.top([B.top.x0, B.top.y1]), "v", -24, bb[4] - bb[1])]];
  /* the parts list sits on the title block */
  const rowH = 4.8, room = Math.floor((frame.y + frame.h - TITLE_BLOCK_H - (isoBox.y + isoBox.h + 8)) / rowH) - 2, shown = rows.slice(0, Math.max(1, room)), th = (shown.length + 2) * rowH;
  drawTable(sheet, colX, frame.y + frame.h - TITLE_BLOCK_H - th, [{ title: "Rep.", width: 12, align: "center" }, { title: "Qté", width: 12, align: "center" }, { title: "N° de pièce", width: 42 }, { title: "Désignation", width: 62 }, { title: "Rév.", width: 12, align: "center" }, { title: "Matière", width: 40 }],
    shown.map((r) => [String(r.item), String(r.qty).replace(".", ","), r.id, r.name, r.kind === "part" ? r.rev || "A" : "—", r.kind === "part" ? r.material || "—" : "du commerce"]), { size: 2.3, rowH, title: "NOMENCLATURE" });
  if (rows.length > shown.length) sheet.text(colX, frame.y + frame.h - TITLE_BLOCK_H - th - 2, `… et ${rows.length - shown.length} ligne(s) de plus : voir la nomenclature de l'assemblage.`, { size: 2.3, font: "italic" });
  drawNotes(sheet, frame.x + 4, notesY, notesW, notes, { title: "NOTES", size: 2.3 });
  viewLabel(sheet, fx + B.front.w * s / 2, frontY + B.front.h * s + 34, "", `ÉCHELLE ${scale[1]}`);
  drawRevisionTable(sheet, frame.x + frame.w, frame.y, revs.slice(-4), { align: "right" });
  drawTitleBlock(sheet, frame, { title: asm.name || asm.id, partNumber: asm.id, revision: asm.revision || "A", material: "Assemblage", finish: "—", mass: data.mass >= 1000 ? `${f2(data.mass / 1000)} kg` : `${f2(data.mass || 0)} g`,
    scale: scale[1], sheet: "1/1", size: "B (11 × 17)", drawnBy: o.drawnBy || "", checkedBy: o.checkedBy || "", approvedBy: o.approvedBy || "", date: o.date || "", company: "DesignWizard.ai", project: (project && project.name) || "",
    generalTolerance: "ISO 2768-mK", projection: third ? "third" : "first", units: "mm", status: o.status || "Préliminaire" });
  return { scale: scale[1], notes, items: parts.map((r) => ({ item: r.item, id: r.id, view: where[r.id] || null })), dims: dims.map(([label, value, k]) => ({ n: k, label, value })), bom: shown.length,
    layout: { notes: { x: frame.x + 4, y: notesY, w: notesW, h: nH }, iso: isoBox, views: { x: fx, y: y0, w: bw, h: bh }, bom: { x: colX, y: frame.y + frame.h - TITLE_BLOCK_H - th, w: RIGHT_W, h: th }, area, frame } };
}
