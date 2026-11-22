/* DesignOrbit.ai — what a mate is, shown : the definition of the joint between two parts, whatever its kind — bolt pattern,
   dowel pins, shaft / bore fit, planar contact, bonded joint, panel cut-out, rail, weld, pressure contact. From the two
   interfaces it ties, three things come out, all pure :
   · mateDefinition — the two sides, the plane they meet on (in the frame of the assembly), the shared parameters, the
     options of each side, the hardware it asks for, and the facts that define it, in words ;
   · mateSolids — the hardware as solids in the assembly : every screw with its head, its insert or its nut, every pin,
     the shaft of a fit, and the outline of the contact area ;
   · mateSection — a schematic cross-section of the joint, as drawing primitives (not to scale, real values written on it).
   Side A is the side the screw enters, the shaft, the tongue, the panel ; side B the thread, the bore, the groove. */

import { v3, matPoint, matDir } from "../cad/vec.js";
import { interfaceType, patternPoints, ADHESIVES } from "../cad/interfaces.js";
import { thread, clearanceHole } from "../cad/standards.js";
import { WELD_PROCESSES, PLATINGS, CONTACT_FORMS, contactForm } from "../cad/interfaces_elec.js";
import { ifaceOf, mateHardware } from "./assembly_logic.js";

const r2 = (x) => Math.round(x * 100) / 100, fr = (x) => String(r2(x)).replace(".", ",");
export const MATE_COLORS = { A: "#9b7bff", B: "#2ec4b6", screw: "#3a3f47", insert: "#c9a94f", nut: "#8d949a", pin: "#e0b422", shaft: "#9b7bff", film: "#f2c94c", area: "#ff8a3d" };
const PATTERN = (p) => (!p || p.type === "single" ? "1 point" : p.type === "circle" ? `${p.n} sur un cercle Ø ${fr(p.pcd)}` : p.type === "points" ? `${(p.pts || []).length} points` : `${p.nx} × ${p.ny}, entraxes ${fr(p.dx)} × ${fr(p.dy)} mm`);
const pinPoints = (p) => { const n = Math.max(1, Math.round(p.n || 2)); return Array.from({ length: n }, (_, i) => [(i - (n - 1) / 2) * p.pitch, 0]); };

/** The definition of a mate. placements : instance id → matrix (the result of solve()) ; names : instance id → the name shown. → null when a side is gone */
export function mateDefinition(asm, built, placements, m, names = {}) {
  const ia = asm.instances.find((i) => i.id === m.a.inst), ib = asm.instances.find((i) => i.id === m.b.inst), fa = ia && ifaceOf(built, ia.part, m.a.iface), fb = ib && ifaceOf(built, ib.part, m.b.iface);
  if (!fa || !fb || !placements[ia.id] || !placements[ib.id]) return null;
  const [A, B, iA, iB] = fa.side === "B" && fb.side !== "B" ? [fb, fa, ib, ia] : [fa, fb, ia, ib], T = interfaceType(A.type), p = { ...T.params, ...(A.params || {}) }, oA = { ...(T.optsA || {}), ...(A.opts || {}) }, oB = { ...(T.optsB || {}), ...(B.opts || {}) };
  const M = placements[iA.id], frame = { o: matPoint(M, A.frame.o), u: matDir(M, A.frame.u), v: matDir(M, A.frame.v), n: matDir(M, A.frame.n) };      // n : out of part A, toward part B
  const body = (built[iA.part].bodies || []).find((x) => x.name === A.body), bb = body ? body.bbox : built[iA.part].bbox, n0 = A.frame.n, extent = Math.abs(n0[0]) * (bb[3] - bb[0]) + Math.abs(n0[1]) * (bb[4] - bb[1]) + Math.abs(n0[2]) * (bb[5] - bb[2]);
  const grip = r2(typeof oA.depth === "number" ? Math.min(oA.depth, extent) : extent), hardware = mateHardware(asm, built, m), uv = A.type === "bolt_pattern" ? patternPoints(p.pattern) : A.type === "pins" ? pinPoints(p) : [[0, 0]];
  const facts = [], say = (k, v) => { if (v !== null && v !== undefined && v !== "") facts.push([k, String(v)]); }, hw = (kind) => hardware.find((h) => h.kind === kind);
  if (A.type === "bolt_pattern") { const th = thread(p.screw), s = hw("screw"), g = T.gdt(p, oA, oB), so = oB.standoff && oB.standoff.h > 0 ? oB.standoff : null;
    say("Screws", s ? `${s.qty} × ${s.name}` : p.screw); say("Pattern", PATTERN(p.pattern));
    say("Side A — clearance hole", `Ø ${fr(clearanceHole(p.screw, oA.fit || "medium"))} (${oA.fit || "medium"} fit)${oA.head === "cbore" ? `, counterbore Ø ${fr(th.cbore)}` : oA.head === "csink" ? `, countersink Ø ${fr(th.csk)} à 90°` : ""}${typeof oA.depth === "number" ? `, sur ${fr(oA.depth)} mm` : ", débouchant"}`);
    say("Side B — thread", oB.port ? "screw channel du profilé" : oB.thread === "insert" ? `heat-set insert ${p.screw} — trou Ø ${fr(th.insert[0])}, ${fr(oB.depth ?? th.insert[1] + 1)} mm` : oB.thread === "clearance" ? `clearance hole Ø ${fr(clearanceHole(p.screw, "medium"))} et hex nut ${p.screw}` : `tapped hole ${p.screw} — avant-trou Ø ${fr(th.tap)}, ${fr(oB.depth ?? 2.5 * th.d)} mm`);
    if (so) say("Side B — standoff", `${fr(so.h)} mm de haut${so.d ? `, Ø ${fr(so.d)}` : ""}`); say("Grip", `${fr(grip)} mm serrés sous la tête`);
    say("Position tolerance", `Ø ${fr(g.tolerance)} au maximum de matière — ${g.rule}`); }
  else if (A.type === "pins") { const s = hw("pin"); say("Dowel pins", s ? `${s.qty} × ${s.name}` : `${Math.round(p.n || 2)} × Ø ${fr(p.d)}`); say("Pitch", `${fr(p.pitch)} mm entre goupilles`);
    say("Side A — slip fit", `Ø ${fr(p.d)} F7${oA.depth === "through" || oA.depth === undefined ? ", débouchant" : `, ${fr(oA.depth)} mm`} : la pièce se pose et se retire`); say("Side B — press fit", `Ø ${fr(p.d)} P7, ${fr(oB.depth ?? (p.length || 12) * 0.5)} mm : la goupille y est chassée`); say("Position tolerance", "Ø 0,02 entre les deux alésages"); }
  else if (A.type === "fit") { say("Fit", `Ø ${fr(p.d)} ${p.fit || "H7/g6"}`); say("Side A — shaft", `portée de ${fr(p.length)} mm`); say("Side B — bore", `${fr(oB.depth ?? p.length + 0.5)} mm de profond`); say("Perpendicularity", "Ø 0,05 sur l'appui"); }
  else if (A.type === "planar") { say("Contact area", `${fr(p.w)} × ${fr(p.h)} mm`); if (oB.pad > 0) say("Side B — pad", `surélevé de ${fr(oB.pad)} mm`); say("Flatness", "à porter sur le dessin des deux faces"); }
  else if (A.type === "bond") { const g = ADHESIVES[p.adhesive || "epoxy"]; say("Adhesive", g ? g.label : p.adhesive); say("Bond area", `${fr(p.w)} × ${fr(p.h)} mm`); say("Bond line", `${fr(p.gap)} mm de film`);
    say("Side B", oB.well ? `glue well, lèvre d'appui de ${fr(p.lip ?? 3)} mm` : oB.pips === false ? "plage lisse" : "plots de calage (pips) à la hauteur du film"); for (const h of hardware) say("Quantity", `${String(h.qty).replace(".", ",")} ${h.unit || "×"} ${h.name}`); }
  else if (A.type === "cutout") { say("Opening", p.shape === "round" ? `ronde Ø ${fr(p.d)}` : `${fr(p.w)} × ${fr(p.h)} mm, coins R ${fr(p.r || 0)}`); say("Side A — panel", typeof oA.depth === "number" ? `découpé sur ${fr(oA.depth)} mm` : "découpe débouchante"); say("Side B", "le composant qui s'y monte");
    if (p.fix && p.fix.screw) say("Fixing", `${Math.round(p.fix.n || 2)} × ${p.fix.screw}, entraxe ${fr(p.fix.pitch || 0)} mm`); }
  else if (A.type === "rail") { say("Side A — tongue", `${fr(p.t)} mm d'épaisseur`); say("Side B — groove", `${fr(p.depth)} mm de profond, jeu de ${fr(oB.clearance ?? 0.2)} mm par face`); say("Length", `${fr(p.length)} mm de guidage`); }
  else if (A.type === "weld") { const W = WELD_PROCESSES[p.process || "laser"]; say("Process", W ? W.label : p.process); say("Weld area", `${fr(p.w)} × ${fr(p.h)} mm`); say(p.process === "wirebond" ? "Wires" : "Welds", `${Math.round(p.n || 1)}${p.process === "wirebond" ? ` × Ø ${fr(p.wire || 0.3)} mm (${p.wireMat || "Al"})` : ""}`);
    say("Side A — tab", `${fr(p.t)} mm d'épaisseur`); if (p.i > 0) say("Current", `${fr(p.i)} A`); }
  else if (A.type === "contact") { const f = contactForm(p, oA), P = PLATINGS[p.plating || "Ag"]; say("Form", (CONTACT_FORMS[f] || {}).label || f); say("Contact area", `${fr(p.w)} × ${fr(p.h)} mm`); say("Contact points", `${Math.round(p.n || 1)}, écrasés de ${fr(p.gap)} mm`);
    say("Plating", P ? P.label : p.plating); say("Force", `${fr(p.force)} N par point`); if (p.i > 0) say("Current", `${fr(p.i)} A`); }
  return { id: m.id, type: A.type, same: A.type === B.type, label: T.label, fr: T.fr, params: p, frame, uv, pts: uv.map(([a, b]) => v3.add(v3.add(frame.o, v3.mul(frame.u, a)), v3.mul(frame.v, b)).map(r2)), grip, hardware, facts,
    A: { inst: iA.id, part: iA.part, name: names[iA.id] || iA.part, iface: A.id, title: A.name || A.id, opts: oA }, B: { inst: iB.id, part: iB.part, name: names[iB.id] || iB.part, iface: B.id, title: B.name || B.id, opts: oB } };
}

/** The hardware and the contact of a mate, as simple solids in the frame of the assembly :
    [{ shape: "cyl", a, b, r, color, what }] — a and b the ends of an axis — and [{ shape: "loop", pts, color, what }] for an outline to draw. */
export function mateSolids(def) {
  if (!def) return [];
  const { frame: F, params: p, A, B } = def, out = [], along = (q, d) => v3.add(q, v3.mul(F.n, d)), cyl = (a, b, r, color, what) => out.push({ shape: "cyl", a: a.map(r2), b: b.map(r2), r: r2(r), color, what });
  const P = (a, b, c = 0) => v3.add(v3.add(v3.add(F.o, v3.mul(F.u, a)), v3.mul(F.v, b)), v3.mul(F.n, c)), loop = (w, h, what, color = MATE_COLORS.area) => out.push({ shape: "loop", pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]].map(([a, b]) => P(a, b).map(r2)), color, what });
  const ring = (d, what, color = MATE_COLORS.area) => out.push({ shape: "loop", pts: Array.from({ length: 33 }, (_, k) => P(Math.cos(k / 32 * 2 * Math.PI) * d / 2, Math.sin(k / 32 * 2 * Math.PI) * d / 2).map(r2)), color, what });
  if (def.type === "bolt_pattern") { const th = thread(p.screw), s = def.hardware.find((h) => h.kind === "screw"), L = s ? s.length : 10, sunk = A.opts.head === "cbore" ? th.head[1] + 0.4 : 0, flat = A.opts.head === "csink";
    for (const q of def.pts) { const seat = along(q, -(def.grip - sunk));                              // under the head : the far face of part A, or the bottom of its counterbore
      if (!flat) cyl(seat, along(seat, -th.head[1]), th.head[0] / 2, MATE_COLORS.screw, `tête ${p.screw}`); else cyl(along(seat, 0.01), along(seat, th.d * 0.55), th.csk / 2, MATE_COLORS.screw, `tête fraisée ${p.screw}`);
      cyl(seat, along(seat, L), th.d / 2, MATE_COLORS.screw, `vis ${p.screw} × ${L}`);
      if (B.opts.thread === "insert") cyl(q, along(q, th.insert[1]), th.insert[0] / 2 + 0.3, MATE_COLORS.insert, `insert ${p.screw}`);
      if (B.opts.thread === "clearance") { const end = along(seat, L); cyl(along(end, -th.d * 0.8 - 0.5), along(end, -0.5), th.d * 0.9, MATE_COLORS.nut, `écrou ${p.screw}`); } } }
  else if (def.type === "pins") { const len = p.length || 12, inB = B.opts.depth ?? len * 0.5; for (const q of def.pts) cyl(along(q, inB), along(q, inB - len), p.d / 2, MATE_COLORS.pin, `goupille Ø ${fr(p.d)} × ${fr(len)}`); }
  else if (def.type === "fit") { cyl(F.o, along(F.o, p.length), p.d / 2 + 0.05, MATE_COLORS.shaft, `portée Ø ${fr(p.d)} ${p.fit || "H7/g6"}`); ring(p.d + 3, "alésage"); }
  else if (def.type === "cutout") { if (p.shape === "round") ring(p.d, `ouverture Ø ${fr(p.d)}`); else loop(p.w, p.h, `ouverture ${fr(p.w)} × ${fr(p.h)}`); }
  else if (def.type === "rail") loop(p.length, p.t + 2 * (B.opts.clearance ?? 0.2), `rainure ${fr(p.length)} × ${fr(p.t)}`);
  else if (def.type === "bond") loop(p.w, p.h, `film de colle ${fr(p.gap)} mm`, MATE_COLORS.film);
  else loop(p.w || 10, p.h || 10, def.type === "weld" ? "zone soudée" : def.type === "contact" ? "zone de contact" : "appui");
  return out;
}

/* ---------- the cross-section : two parts, one above the other, and what ties them ---------- */
const INK = "#1f2a37", FA = "#e7e0fb", FB = "#d3f1ec", W = 260, H = 150;
const R = (x, y, w, h, fill, extra = {}) => ({ t: "rect", x, y, w, h, fill, stroke: INK, ...extra }), LN = (x1, y1, x2, y2, extra = {}) => ({ t: "line", x1, y1, x2, y2, stroke: INK, ...extra }), TX = (x, y, s, extra = {}) => ({ t: "text", x, y, s, size: 8.5, anchor: "start", fill: INK, ...extra });
/** The joint in section, as primitives of a drawing W × H : rect, line, text, poly. Schematic : the values written are the real ones, the proportions are not. */
export function mateSection(def) {
  if (!def) return { w: W, h: H, items: [] };
  const p = def.params, oA = def.A.opts, oB = def.B.opts, it = [], top = 34, mid = 76, bot = 122, cx = 115, tag = (y, s) => TX(45, y, s, { size: 9, weight: 700 }),      // the blocks span x 40 … 190 ; the notes stand right of them
     title = (s) => it.push(TX(8, 12, s, { size: 9.5, weight: 700 }));
  const blocks = (aTop = top, bBot = bot) => { it.push(R(40, aTop, 150, mid - aTop, FA), R(40, mid, 150, bBot - mid, FB), tag(aTop + 11, "A"), tag(bBot - 5, "B")); };
  const note = (y, s) => it.push(TX(W - 6, y, s, { anchor: "end", size: 7.5 }));
  title(def.label);
  if (def.type === "bolt_pattern") { const th = thread(p.screw), so = oB.standoff && oB.standoff.h > 0, s = def.hardware.find((h) => h.kind === "screw"), clr = oB.thread === "clearance", ins = oB.thread === "insert", cb = oA.head === "cbore", cs = oA.head === "csink";
    if (so) { it.push(R(40, top, 150, mid - top, FA), R(40, 104, 150, bot - 104, FB), R(cx - 22, mid, 44, 28, FB), tag(top + 11, "A"), tag(bot - 5, "B")); } else blocks();
    it.push(R(cx - 7, top, 14, mid - top, "#ffffff", { stroke: "none" }), LN(cx - 7, top, cx - 7, mid), LN(cx + 7, top, cx + 7, mid));                                 // the clearance hole in A
    if (cb) it.push(R(cx - 13, top, 26, 10, "#ffffff"));
    const end = clr ? bot + 6 : so ? mid + 24 : mid + 30; it.push(R(cx - 5, cb ? top + 10 : top, 10, end - (cb ? top + 10 : top), "#8b929b"));                           // the shank
    it.push(cs ? { t: "poly", pts: [[cx - 13, top], [cx + 13, top], [cx + 5, top + 8], [cx - 5, top + 8]], fill: MATE_COLORS.screw, stroke: INK } : R(cx - 12, cb ? top : top - 9, 24, cb ? 9 : 9, MATE_COLORS.screw));
    if (ins) it.push(R(cx - 9, mid, 18, 20, MATE_COLORS.insert)); else if (clr) it.push(R(cx - 11, bot, 22, 8, MATE_COLORS.nut)); else for (let y = mid + 3; y < end - 2; y += 4) it.push(LN(cx - 8, y, cx - 5, y + 2), LN(cx + 5, y + 2, cx + 8, y));
    note(22, s ? s.name.replace("Socket head cap screw ", "").replace("Countersunk screw ", "") : p.screw); note(top + 16, `clearance Ø ${fr(clearanceHole(p.screw, oA.fit || "medium"))}`); note(mid + 14, ins ? `insert ${p.screw}` : clr ? `nut ${p.screw}` : `tapped ${p.screw}`);
    if (so) note(mid + 26, `standoff ${fr(oB.standoff.h)} mm`); it.push(LN(30, top, 30, mid, { stroke: "#0c66e4" }), TX(27, (top + mid) / 2 + 3, `grip ${fr(def.grip)}`, { anchor: "end", size: 7.5, fill: "#0c66e4" }), TX(8, H - 6, `${def.pts.length} × — ${PATTERN(p.pattern)}`, { size: 7.5 })); void th; }
  else if (def.type === "pins") { blocks(); const xs = [cx - 30, cx + 30];
    for (const x of xs) it.push(R(x - 6, top, 12, mid - top, "#ffffff", { stroke: "none" }), LN(x - 6, top, x - 6, mid), LN(x + 6, top, x + 6, mid), R(x - 5.5, mid - 22, 11, 44, MATE_COLORS.pin));
    it.push(LN(xs[0], top - 8, xs[1], top - 8, { stroke: "#0c66e4" }), TX((xs[0] + xs[1]) / 2, top - 11, `pitch ${fr(p.pitch)}`, { anchor: "middle", size: 7.5, fill: "#0c66e4" })); note(top + 16, `A : Ø ${fr(p.d)} F7 slip`); note(mid + 16, `B : Ø ${fr(p.d)} P7 press`); it.push(TX(8, H - 6, `${Math.round(p.n || 2)} × dowel pin Ø ${fr(p.d)} × ${fr(p.length || 12)}`, { size: 7.5 })); }
  else if (def.type === "fit") { blocks(); it.push(R(cx - 22, mid, 44, 30, FA), LN(cx - 22, mid, cx + 22, mid, { stroke: FA }), TX(cx, mid + 18, `Ø ${fr(p.d)}`, { anchor: "middle", size: 8 })); note(top + 16, "A : shaft"); note(mid + 16, `B : bore ${String(p.fit || "H7/g6").split("/")[0]}`); it.push(TX(8, H - 6, `${p.fit || "H7/g6"} — portée ${fr(p.length)} mm`, { size: 7.5 })); }
  else if (def.type === "cutout") { it.push(R(40, mid - 8, cx - 68, 8, FA), R(cx + 28, mid - 8, cx - 68, 8, FA), R(cx - 22, 40, 44, 74, FB), tag(mid - 12, "A"), TX(cx, 110, "B", { anchor: "middle", size: 9, weight: 700 }), LN(cx - 28, mid + 8, cx + 28, mid + 8, { stroke: "#0c66e4" }), TX(cx, mid + 18, p.shape === "round" ? `Ø ${fr(p.d)}` : `${fr(p.w)} × ${fr(p.h)}`, { anchor: "middle", size: 8, fill: "#0c66e4" })); it.push(TX(8, H - 6, `B — ${def.B.name}${p.fix && p.fix.screw ? ` · ${Math.round(p.fix.n || 2)} × ${p.fix.screw}` : ""}`, { size: 7.5 })); }
  else if (def.type === "rail") { it.push(R(40, mid, 150, bot - mid, FB), R(cx - 7, mid, 14, 26, "#ffffff"), R(cx - 5, 26, 10, mid + 24 - 26, FA), TX(cx + 10, 40, "A", { size: 9, weight: 700 }), tag(bot - 5, "B")); note(mid + 14, `groove ${fr(p.depth)} mm`); note(mid + 26, `jeu ${fr(oB.clearance ?? 0.2)} / face`); it.push(TX(8, H - 6, `tongue ${fr(p.t)} mm · ${fr(p.length)} mm de guidage`, { size: 7.5 })); }
  else { blocks(def.type === "weld" ? mid - 10 : top);
    if (def.type === "bond") { it.push(R(cx - 55, mid - 2, 110, 4, MATE_COLORS.film)); note(mid - 6, `bond line ${fr(p.gap)} mm`); it.push(TX(8, H - 6, `${fr(p.w)} × ${fr(p.h)} mm · ${(ADHESIVES[p.adhesive || "epoxy"] || {}).label || p.adhesive}`, { size: 7.5 })); }
    else if (def.type === "weld") { const n = Math.min(6, Math.max(1, Math.round(p.n || 1))); for (let k = 0; k < n; k++) it.push({ t: "poly", pts: [[cx - 30 + k * 60 / Math.max(1, n - 1 || 1) - 4, mid], [cx - 30 + k * 60 / Math.max(1, n - 1 || 1) + 4, mid], [cx - 30 + k * 60 / Math.max(1, n - 1 || 1), mid + 9]], fill: "#d6453d", stroke: INK }); note(mid - 14, `tab ${fr(p.t)} mm`); it.push(TX(8, H - 6, `${(WELD_PROCESSES[p.process || "laser"] || {}).label || p.process} · ${Math.round(p.n || 1)} · ${fr(p.w)} × ${fr(p.h)} mm`, { size: 7.5 })); }
    else if (def.type === "contact") { const n = Math.min(7, Math.max(2, Math.round(p.n || 2))); for (let k = 0; k < n; k++) { const x = cx - 54 + k * 108 / (n - 1); it.push({ t: "poly", pts: [[x - 5, mid - 7], [x + 5, mid - 7], [x, mid]], fill: MATE_COLORS.area, stroke: INK }); } note(mid - 12, `${Math.round(p.n || 1)} points`); it.push(TX(8, H - 6, `${(CONTACT_FORMS[contactForm(p, oA)] || {}).label || ""} · ${fr(p.force)} N / point · ${(PLATINGS[p.plating || "Ag"] || {}).label || ""}`, { size: 7.5 })); }
    else { it.push(LN(cx - 55, mid, cx + 55, mid, { stroke: MATE_COLORS.area, width: 3 })); if (oB.pad > 0) note(mid + 14, `pad ${fr(oB.pad)} mm`); it.push(TX(8, H - 6, `${fr(p.w)} × ${fr(p.h)} mm en appui`, { size: 7.5 })); } }
  return { w: W, h: H, items: it };
}
