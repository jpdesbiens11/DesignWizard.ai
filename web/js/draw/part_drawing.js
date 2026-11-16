/* DesignWizard.ai — composes the 2D drawing of a part on a Sheet (PDF or SVG backend), on a tabloid page (11 × 17 in).
   The views take the sheet : the three standard views at the largest scale that fits, the notes in a band at the bottom
   beside the title block, and — in the top right corner a three-view layout leaves empty — the revisions, a small
   isometric view, the geometric tolerances and the holes as tables. A geometric tolerance is tied to what it controls :
   a hexagonal flag (T1, T2…) with a leader on the feature, the same flag in the table beside its frame and the tags of
   its holes. The long table of the definition dimensions goes to a second sheet. Every dimension the design defines is
   there — on the view that shows it, or in a table — with its round balloon, and its class symbol right after it. A part
   with something inside gets a section A-A, hatched, beside the top view, and its cutting plane on the top view. Datums and geometric
   tolerances come from the interfaces and read as ASME Y14.5. Pure layout code (browser and Node). */

import { PAPER, STYLE, LW, dimLinear, centerMark, featureControlFrame, datumFeature, viewLabel, drawBorder, drawTitleBlock, drawNotes, drawTable, drawRevisionTable, leaderNote, sectionArrows, arrowHead, fitText, TITLE_BLOCK_H, TITLE_BLOCK_W } from "./drafting.js";
import { hatch } from "./hatch.js";
import { interfaceType, patternPoints } from "../cad/interfaces.js";
import { materialOrDefault, PROCESSES, processName } from "../cad/materials.js";
import { FACES } from "../cad/vec.js";
import { dimensionList, holeRows, dimText, classNotes, f2 } from "./dim_model.js";

export const VIEW_DEFS = {
  front: { dir: [0, 1, 0], xdir: [1, 0, 0], ax: [0, 2], label: "FRONT" },
  top: { dir: [0, 0, -1], xdir: [1, 0, 0], ax: [0, 1], label: "TOP" },
  right: { dir: [-1, 0, 0], xdir: [0, 1, 0], ax: [1, 2], label: "RIGHT" },
  iso: { dir: [-0.577, 0.577, -0.577], xdir: [0.7071, 0.7071, 0], label: "ISOMETRIC", hidden: false },
};
/** The views to ask the kernel for : the standard ones, and the section when the part has one (cad/section_view.js : sectionOf). */
export const viewRequest = (section = null) => [...Object.entries(VIEW_DEFS).map(([name, v]) => ({ name, dir: v.dir, xdir: v.xdir, hidden: v.hidden !== false })), ...(section ? [{ ...section, name: "section", hidden: false }] : [])];
export const SHEET = "TABLOID";
const SCALES = [[10, "10:1"], [5, "5:1"], [2, "2:1"], [1, "1:1"], [2 / 3, "1:1.5"], [0.5, "1:2"], [0.4, "1:2.5"], [0.25, "1:4"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"]];
const RAD = Math.PI / 180, BAL_R = 2.5, STACK_W = 150, GDT_ROW = 6.2;

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
/** The flag of a geometric tolerance : a hexagon with its tag — not a round balloon, which numbers a dimension — and a leader with an arrow to what it controls. */
export function gdtFlag(sheet, c, tag, to = null, r = 3.3) {
  if (to) { const a = Math.atan2(to[1] - c[1], to[0] - c[0]); sheet.line(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), to[0], to[1], { w: LW.thin }); arrowHead(sheet, to, a / RAD, { len: 2.6 }); }
  sheet.polyline(Array.from({ length: 6 }, (_, i) => [c[0] + r * Math.cos(i * Math.PI / 3), c[1] + r * Math.sin(i * Math.PI / 3)]), { w: LW.medium, close: true, fill: "#ffffff" });
  sheet.text(c[0], c[1] + r * 0.27, tag, { size: r * 0.7, font: "bold", align: "center" });
}
/** Hole tags as one reads them : « A1–A4 » for a run, « A1, A3 » otherwise. */
export function tagRange(tags) {
  const list = [...tags], m = list.map((t) => /^([A-Z]+)(\d+)$/.exec(t));
  if (list.length > 2 && m.every((x) => x && x[1] === m[0][1]) && m.every((x, i) => !i || +x[2] === +m[i - 1][2] + 1)) return `${list[0]}–${list[list.length - 1]}`;
  return list.join(", ");
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
  datums.push({ letter: "A", face: faceA, level: primary ? primary.level : built.bbox[2], why: primary ? `seating plane of interface “${primary.name}”` : "bottom face" });
  const side = ["-X", "-Y", "-Z"].filter((f) => f[1] !== faceA[1]);
  datums.push({ letter: "B", face: side[0], why: "long side face" }, { letter: "C", face: side[1], why: "perpendicular side face" });
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
  return [`Dimensioning and tolerancing per ASME Y14.5-2018; dimensions in millimetres; general tolerances for untoleranced dimensions: ISO 2768-mK.`,
    `Material: ${mat.name}.${spec.finish ? ` Finish: ${spec.finish}.` : ""} Process: ${processName(spec.process) || "to be defined"}. Break sharp edges 0.2 to 0.5 mm; deburr.`,
    "Each dimension carries a numbered round balloon, on the view that shows it or in the table (sheet 2 when there is one). Each geometric tolerance carries a hexagonal flag (T1, T2… — a mark of this drawing, not a symbol of the standard): on the feature it controls, and in the tolerance table. Boxed dimensions (in brackets in the table) are basic dimensions: they locate a pattern toleranced in position relative to datums A, B and C.",
    ...classNotes(dims), ...[...rules].map(([rule, names]) => `Position tolerances calculated (${rule}): ${names.join("; ")}.`), ...(spec.notes || [])];
}
/** The height a block of notes takes. */
export function notesHeight(sheet, notes, width, size = 2.3) { const indent = sheet.textWidth(`${notes.length}.`, { size }) + size * 0.6; return (size + 1) * 0.718 + 0.9 + size * 0.9 + notes.reduce((h, n) => h + sheet.wrapText(String(n), width - indent, { size }).length * size * 1.5 + size * 0.35, 0); }

/** Draw the whole sheet. data = {spec, built, views, project, opts:{projection, hidden, drawnBy, checkedBy, approvedBy, status, date, revisions}}. Returns what was drawn. */
export function composeDrawing(sheet, data) {
  const { spec, built, views, project } = data, o = data.opts || {};
  const frame = drawBorder(sheet, { confidential: o.confidential }), mat = materialOrDefault(spec.material), sem = drawingSemantics(spec, built), dims = dimensionList(spec, built), holes = holeRows(built);
  const B = { front: bounds(views.front), top: bounds(views.top), right: bounds(views.right), iso: bounds(views.iso) }, third = (o.projection || "third") === "third";
  /* the furniture first : it says what room is left for the views. Bottom band : the notes beside the title block. Top right corner :
     the revisions, the isometric view, the geometric tolerances and the holes — where three views leave the sheet empty. */
  const flags = sem.gdt.map((g, i) => ({ ...g, flag: `T${i + 1}` })), holeDims = dims.filter((d) => d.table === "holes");
  const notes = drawingNotes(spec, sem, dims), notesW = frame.w - TITLE_BLOCK_W - 12, nH = Math.min(notesHeight(sheet, notes, notesW), 70), notesY = frame.y + frame.h - nH - 3, bandH = Math.max(TITLE_BLOCK_H, nH) + 6;
  const revs = o.revisions && o.revisions.length ? o.revisions : [{ rev: spec.revision || "A", description: o.revisionText || "Initial release", date: o.date || "", by: o.drawnBy || "" }];
  const revH = (Math.min(revs.length, 4) + 2) * 5, stackX = frame.x + frame.w - STACK_W, isoBox = { x: frame.x + frame.w - 60, y: frame.y + revH + 3, w: 56, h: 36 };
  const gdtH = flags.length ? 5 + flags.length * GDT_ROW + 3 : 0, holesH = holeDims.length ? (holeDims.length + 2) * 4.4 + 3 : 0, stackBottom = isoBox.y + isoBox.h + 3 + gdtH + holesH, stack = { x: stackX, y: frame.y, w: STACK_W, h: stackBottom - frame.y };
  /* the three views, at the largest standard scale that fits : top and front on the left, the right view beside the front one — under
     the tables of the corner, or left of them */
  /* the room the dimensions take round the views : a row is 8 mm ; only the rows this part needs are kept free */
  const rowsOn = (view) => Math.min(3, dims.filter((d) => d.on === view && d.dir === "h" && d.kind !== "overall").length), padT = 11 + 8 * Math.max(1, rowsOn("top")), padB = 18 + 8 * Math.min(3, 1 + rowsOn("front"));
  const gap = 24, padL = 34, padR = 40, topR = 40, area = { x: frame.x + 4, y: frame.y + 4, w: frame.w - 8, h: frame.h - bandH - 8 };
  const sec = views.section && views.section.cut && views.section.cut.length ? views.section : null, Bs = sec ? bounds(sec) : null;      // a section A-A has its place in the row of the front view, right of the right view
  const fitAt = (k) => {
    const secW = Bs ? 30 + Bs.w * k : 0, colW = padL + Math.max(B.front.w, B.top.w) * k, W = colW + gap + B.right.w * k + padR + secW, H = padT + B.top.h * k + gap + Math.max(B.front.h, Bs ? Bs.h : 0) * k + padB;
    if (W > area.w || H > area.h || area.x + colW + topR > stackX - 4) return null;
    const span = B.front.w * k + gap + B.right.w * k + padR - 16 + secW, mid = area.x + padL + Math.max(0, Math.min((area.w - W) / 2, stackX - 4 - topR - (area.x + colW))), tops = [area.y + (area.h - H) / 2, area.y + area.h - H];      // 16 : the right view rarely carries three rows of dimensions
    /* the right view under the tables of the corner, the block centred — or, when the corner comes too low, the whole block left of it */
    for (const top of tops) { const fy = (third ? top + padT + B.top.h * k + gap : top + padT) - Math.max(0, (Bs ? Bs.h : 0) - B.front.h) * k; if (mid + span <= stackX - 4 || fy - 4 >= stackBottom) return { x: mid, y: top + padT }; }
    const leftMost = stackX - 4 - span; if (leftMost >= area.x + padL) return { x: Math.min(mid, leftMost), y: tops[0] + padT };
    return null;
  };
  let scale = SCALES[SCALES.length - 1], fit = null;
  for (const sc of SCALES) { const f = fitAt(sc[0]); if (f) { scale = sc; fit = f; break; } }
  const s = scale[0], bw = (B.front.w + B.right.w) * s + gap, bh = (B.front.h + B.top.h) * s + gap, fx = fit ? fit.x : area.x + padL, y0 = fit ? fit.y : area.y + padT;
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
  let section = null;
  if (sec) {
    const rows = used["top:vR"] || 0, sx = Math.max(rightX, fx + B.top.w * s + (rows ? 30 + 10 * rows : 0)), rowH = B.top.h * s, roomW = (topY < stackBottom + 4 ? stackX - 6 : area.x + area.w - 4) - sx, roomH = rowH + padT - 14;
    /* at the scale of the sheet : in the row of the front view, right of the right view — the fit of the views kept that room ; beside the
       top view otherwise, at a smaller scale as the last resort, said under the view */
    const rx = rightX + B.right.w * s + 30, ry = frontY + B.front.h * s - Bs.h * s, inRow = rx + Bs.w * s <= area.x + area.w - 2 && ry >= area.y && (ry - 3 >= stackBottom || rx + Bs.w * s <= stackX - 4), beside = !inRow && Bs.w * s <= roomW && Bs.h * s <= roomH;
    const k = beside || inRow ? scale : SCALES.find((c) => c[0] <= s && Bs.w * c[0] <= roomW && Bs.h * c[0] <= roomH);
    if (k) {
      const sw = Bs.w * k[0], sh = Bs.h * k[0], px = inRow ? rx : sx, sy = inRow ? ry : third ? topY + rowH - sh : topY, TS = drawView(sheet, sec, Bs, px, sy, k[0], false);
      for (const [a, b] of hatch(sec.cut.map((pl) => pl.map(TS)), 1.3, 45)) sheet.line(a[0], a[1], b[0], b[1], { w: LW.fine, color: "#333333" });      // close lines : a thin wall must still show that it is cut
      for (const pl of sec.cut) sheet.polyline(pl.map(TS), { w: LW.visible, cap: "round" });
      viewLabel(sheet, px + sw / 2, sy + sh + 4, "SECTION A-A", k[0] !== s ? `SCALE ${k[1]}` : "", { size: 3.6 });
      const at = sec.plane.at, ends = sec.plane.axis === "x" ? [T.top([at, B.top.y1]), T.top([at, B.top.y0])] : [T.top([B.top.x1, at]), T.top([B.top.x0, at])], out = 5, ux = Math.sign(ends[1][0] - ends[0][0]), uy = Math.sign(ends[1][1] - ends[0][1]);
      sectionArrows(sheet, [ends[0][0] - ux * out, ends[0][1] - uy * out], [ends[1][0] + ux * out, ends[1][1] + uy * out], "A", { size: 3.6, arrowLen: 7 });
      section = { x: px, y: sy, w: sw, h: sh, scale: k[1], axis: sec.plane.axis, at };
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
  /* geometric tolerances : each one is tied to what it controls by a flag — on the feature in a view, with a leader, and in the table of
     the corner beside its frame. A hole pattern is flagged on one of its holes (« 4× » says the rest) ; a surface on its edge. */
  const centre = { top: [fx + B.top.w * s / 2, topY + B.top.h * s / 2], front: [fx + B.front.w * s / 2, frontY + B.front.h * s / 2], right: [rightX + B.right.w * s / 2, frontY + B.right.h * s / 2] }, put = [];
  flags.forEach((g, i) => {
    const it = (built.interfaces || []).find((x) => x.id === g.iface), hs = holes.filter((h) => h.iface === g.iface && pos.has(h.tag)); let to = null, dir = [0.7, -0.7];
    g.tags = hs.length ? tagRange(hs.map((h) => h.tag)) : "";
    if (g.symbol !== "flatness" && hs.length) { const v = viewOf[hs[0].face], far = hs.reduce((b0, h) => (Math.hypot(pos.get(h.tag)[0] - centre[v][0], pos.get(h.tag)[1] - centre[v][1]) > Math.hypot(pos.get(b0.tag)[0] - centre[v][0], pos.get(b0.tag)[1] - centre[v][1]) ? h : b0)), c = pos.get(far.tag), d = [c[0] - centre[v][0], c[1] - centre[v][1]], n = Math.hypot(d[0], d[1]) || 1;
      dir = [d[0] / n, d[1] / n]; to = [c[0] + dir[0] * Math.max(far.d / 2 * s, 0.8), c[1] + dir[1] * Math.max(far.d / 2 * s, 0.8)]; }
    else if (it && it.frame) { const F = FACES[it.face] || FACES["+Z"], org = it.frame.o, up = F.n[F.axis] > 0;
      if (g.symbol === "flatness" || it.type === "planar" || it.type === "bond") {                                // a surface : flagged where it shows as an edge
        const q = 0.42 + 0.08 * (i % 3);                           // on the right view when it can : it carries the fewest dimensions, and no datum symbol
        if (F.axis === 2) { to = T.right([B.right.x0 + B.right.w * q, org[2]]); dir = [0, up ? -1 : 1]; }
        else if (F.axis === 1) { to = T.right([org[1], B.right.y0 + B.right.h * q]); dir = [up ? 1 : -1, 0]; }
        else { to = T.front([org[0], B.front.y0 + B.front.h * q]); dir = [up ? 1 : -1, 0]; }
      } else { const v = viewOf[it.face] || "top", ax = VIEW_DEFS[v].ax, c = T[v]([org[ax[0]], org[ax[1]]]), d = [c[0] - centre[v][0], c[1] - centre[v][1]], n = Math.hypot(d[0], d[1]); to = c; dir = n > 1 ? [d[0] / n, d[1] / n] : [0.7, -0.7]; }
    }
    if (!to) return;
    let c = null; for (let k = 0; k < 9 && !c; k++) { const a = Math.atan2(dir[1], dir[0]) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6, q = [to[0] + Math.cos(a) * 11, to[1] + Math.sin(a) * 11]; if (!put.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 8)) c = q; }
    c = c || [to[0] + dir[0] * 11, to[1] + dir[1] * 11]; put.push(c); gdtFlag(sheet, c, g.flag, to); g.at = c;
  });
  /* the corner : under the isometric view, the tolerances then the holes — every row with its flag or its balloon */
  let gy = isoBox.y + isoBox.h + 3, left = 0;
  if (flags.length) {
    sheet.rect(stackX, gy, STACK_W - 2, 5 + flags.length * GDT_ROW, { w: LW.medium }); sheet.line(stackX, gy + 5, stackX + STACK_W - 2, gy + 5, { w: LW.fine }); sheet.text(stackX + (STACK_W - 2) / 2, gy + 3.6, "GEOMETRIC TOLERANCES", { size: 2.4, font: "bold", align: "center" });
    flags.forEach((g, i) => { const ry = gy + 5 + i * GDT_ROW; if (i) sheet.line(stackX, ry, stackX + STACK_W - 2, ry, { w: LW.fine }); gdtFlag(sheet, [stackX + 5, ry + GDT_ROW / 2], g.flag, null, 2.6);
      const fr = featureControlFrame(sheet, stackX + 10.5, ry + (GDT_ROW - 4.8) / 2, { symbol: g.symbol, tolerance: f2(g.tolerance), diameter: g.diameter, modifier: g.modifier, datums: g.datums }, { h: 4.8 }), tx = stackX + 10.5 + (fr.width || 40) + 2.5;
      const words = fitText(sheet, [g.count > 1 ? `${g.count}×` : "", g.tags, g.name, g.fit].filter(Boolean).join(" · "), stackX + STACK_W - 3.5 - tx, 2.4, "sans", 0.72); sheet.text(tx, ry + GDT_ROW / 2 + 0.9, words.str, { size: words.size }); });
    gy += 5 + flags.length * GDT_ROW + 3;
  }
  const tableOf = (title, list, cols, cells, x, y, room) => {
    if (!list.length) return 0; const shown = list.slice(0, Math.max(0, room)), t = drawTable(sheet, x + 7, y, cols, shown.map(cells), { size: 2.2, rowH: 4.4, title });
    shown.forEach((d, i) => { const cy = y + (i + 2) * 4.4 + 2.2; balloon(sheet, [x + 3.2, cy], d.n, 2); if (d.cls === "sc" || d.cls === "csc") classSymbol(sheet, x + 7 + t.w + 1.2, cy, d.cls, 3.4); });
    return shown.length;
  };
  left += holeDims.length - tableOf("HOLE TABLE", holeDims, [{ title: "Tags", width: 22 }, { title: "Hole", width: 28 }, { title: "Description", width: 88 }], (d) => [d.tags, dimText(d), d.label], stackX, gy, holeDims.length);
  /* the definition dimensions that no view shows : a long table, on a second sheet — the views keep the first one */
  const defs = dims.filter((d) => d.table === "def" || ((d.kind === "pattern" || d.kind === "detail") && !onView.includes(d.key))), sheets = defs.length ? 2 : 1;
  if (left) sheet.text(stackX, Math.min(gy + holesH, frame.y + frame.h - bandH - 4), `… and ${left} more feature(s): see the 3D model.`, { size: 2.3, font: "italic" });
  drawNotes(sheet, frame.x + 4, notesY, notesW, notes, { title: "NOTES", size: 2.3 });
  viewLabel(sheet, fx + B.front.w * s / 2, frontY + B.front.h * s + 10 + 8 * (used["front:h"] || 1) + 5, "", `SCALE ${scale[1]}`);
  drawRevisionTable(sheet, frame.x + frame.w, frame.y, revs.slice(-4), { align: "right" });
  const block = (n) => drawTitleBlock(sheet, frame, { title: spec.name || spec.id, partNumber: spec.id, revision: spec.revision || "A", material: mat.name, finish: spec.finish || "—", mass: built.mass >= 1000 ? `${f2(built.mass / 1000)} kg` : `${f2(built.mass)} g`,
    scale: n === 1 ? scale[1] : "—", sheet: `${n}/${sheets}`, size: "B (11 × 17)", drawnBy: o.drawnBy || "", checkedBy: o.checkedBy || "", approvedBy: o.approvedBy || "", date: o.date || "", company: o.organisation || "DesignWizard.ai", project: (project && project.name) || "",
    generalTolerance: "ISO 2768-mK", projection: third ? "third" : "first", units: "mm", status: o.status || "Preliminary" });
  block(1);
  if (sheets === 2) {                                           // sheet 2 : the table of the definition dimensions, in columns, with the same frame and title block
    sheet.newPage(); drawBorder(sheet, { confidential: o.confidential }); drawRevisionTable(sheet, frame.x + frame.w, frame.y, revs.slice(-4), { align: "right" });
    sheet.text(frame.x + 6, frame.y + 9, `DEFINITION DIMENSIONS — ${spec.id} ${spec.name || ""}`.trim(), { size: 4.2, font: "bold" }); sheet.text(frame.x + 6, frame.y + 14.5, "Dimensions that sheet 1 does not show on a view, each with its balloon. A dimension in brackets is a basic dimension: it locates a pattern toleranced in position relative to the datums.", { size: 2.4 });
    const cols = [{ title: "Dimension", width: 104 }, { title: "Value", width: 26, align: "right" }], colW = 150, top = frame.y + 20, per = (k) => Math.floor((frame.y + frame.h - (frame.x + 6 + (k + 1) * colW > frame.x + frame.w - TITLE_BLOCK_W ? TITLE_BLOCK_H + 6 : 4) - top) / 4.4) - 2;
    let at = 0; for (let k = 0; at < defs.length && frame.x + 6 + (k + 1) * colW <= frame.x + frame.w - 2; k++) at += tableOf(k ? "DEFINITION DIMENSIONS (continued)" : "DEFINITION DIMENSIONS", defs.slice(at), cols, (d) => [d.label, `${d.basic && d.cls !== "ref" ? "[" : ""}${dimText(d)}${d.basic && d.cls !== "ref" ? "]" : ""}`], frame.x + 6 + k * colW, top, per(k));
    if (at < defs.length) sheet.text(frame.x + 6, frame.y + frame.h - 4, `… and ${defs.length - at} more dimension(s): see the dimension list of the model.`, { size: 2.3, font: "italic" });
    block(2);
  }
  const boxes = { top: { x: fx, y: topY, w: B.top.w * s, h: B.top.h * s }, front: { x: fx, y: frontY, w: B.front.w * s, h: B.front.h * s }, right: { x: rightX, y: frontY, w: B.right.w * s, h: B.right.h * s } };
  return { scale: scale[1], sheets, holes, gdt: flags, datums: sem.datums, notes, dims, onView, section, layout: { notes: { x: frame.x + 4, y: notesY, w: notesW, h: nH }, iso: isoBox, stack, views: { x: fx, y: y0, w: bw, h: bh }, boxes, area, frame } };
}
export { PAPER };
