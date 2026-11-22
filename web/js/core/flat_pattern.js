/* DynamiteOrbit — a thin folded part, seen flat (JP, 21 novembre 2026 : « voir des pièces minces pliées dans la forme finale de la pièce
   à plat, et que les lignes des plis soient visibles… on verra le flex PCB à plat en changeant la vue de la pièce, et on peut revenir à
   plier »). The usual way of the mechanical modelers : a « flat » state of a sheet-metal part, the bend lines drawn on it with their notes
   (UP / DOWN, the angle, the inside radius). Four kinds of parts unfold :
     a branched flexible circuit (spec.flex with a core) — the core flat, each branch laid out from its edge ;
     a folded flexible strip (spec.flex with legs) and a busbar (spec.busbar) — one strip, laid along X ;
     a folded sheet-metal part (spec.folded) — its flat pattern, already computed by the kernel (cad/family_folded.js).
   The developed length runs along the neutral fibre : in a 90° bend of inside radius r, the strip of thickness t is as long as a quarter
   circle of radius r + k·t. k : 0.5 for a film (it bends about its middle), the k of the tool for a metal (core/busbar.js : KFACTOR) —
   typical values, said on the screen ; the maker of the part corrects them.
   flatOf(spec, built) → { kind, t, size, pieces: [{ at, size }] | outline, holes, bends: [{ a, b, dir, angle, r, label, id }], marks, k, notes }
   flatSpec(flat, spec) → a part : the blank at z = 0..t, its holes, what stands on it (a probe, a tab). Pure : no kernel, no DOM. */

import { KFACTOR } from "./busbar.js";
import { EDGES, isTree } from "./flex_tree.js";
import { SENSOR_KINDS } from "./flex.js";
import { flatHoles } from "../cad/family_folded.js";

const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000, fr = (x) => String(r2(x)).replace(".", ",");
export const K_FILM = 0.5;
const ROOT = 1;      // a branch of a branched circuit starts this far inside its core (core/flex_tree.js)

/** The legs of a strip, laid flat. legs : [{ L (the centre line, from one sharp corner to the next), bend }], t, r (inside radius), k.
    → { total, bends: [{ i (the leg it starts), from, to, at (the middle of the bend zone), dir, angle }], dev(i, s) (where a point at s along leg i lands) } */
export function develop(legs, t, r, k) {
  const rc = r + t / 2, A = (Math.PI / 2) * (r + k * t), D = 2 * rc - A, V = [], bends = [];
  let acc = 0;
  legs.forEach((g, i) => {
    V.push(acc);
    if (i) { const from = acc - rc - (i - 1) * D; bends.push({ i, from: r3(from), to: r3(from + A), at: r3(from + A / 2), dir: (Number(g.bend) || 90) > 0 ? "UP" : "DOWN", angle: Math.abs(Number(g.bend) || 90) }); }
    acc += Number(g.L) || 0;
  });
  return { total: r3(acc - bends.length * D), bends, deduction: r3(D), arc: r3(A), dev: (i, s) => r3(V[i] + s - i * D) };
}
export const bendLabel = (b, r) => `${b.dir} ${b.angle}° R${String(r2(r))}`;

/** Can this part be seen flat ? */
export function canFlatten(spec, built) {
  if (!spec) return false;
  if (spec.flex && (isTree(spec.flex) ? spec.flex.branches.some((b) => b.legs.length > 1) : Array.isArray(spec.flex.legs) && spec.flex.legs.length > 1)) return true;
  if (spec.busbar && Array.isArray(spec.busbar.legs) && spec.busbar.legs.length > 1) return true;
  return !!(spec.folded && built && built.facts && built.facts.folded && built.facts.folded.flat);
}

/** A branched circuit, flat : the core where it is, each branch out of its edge by its developed length. */
function treeFlat(def) {
  const c = def.core, t = def.t, pieces = [{ at: [0, 0], size: [c.L, c.W], name: "Cœur" }], bends = [], marks = [];
  for (const b of def.branches) {
    const E = EDGES[b.edge]; if (!E || !(b.w > 0) || !b.legs.length) continue;
    const legs = b.legs.map((g, i) => (i ? g : { ...g, L: (Number(g.L) || 0) + ROOT })), rb = b.r ?? def.r, d = develop(legs, t, rb, K_FILM), ext = r3(d.total - ROOT);      // a branch may bend at its own radius (the tails of the CORE flex)
    const o = E.sign > 0 ? (E.axis === 0 ? c.L : c.W) : 0, out = (u) => r3(o + E.sign * u), lo = r2(b.at - b.w / 2), hi = r2(b.at + b.w / 2);
    const P = (u, a) => (E.axis === 0 ? [out(u), a] : [a, out(u)]);      // u : from the edge of the core, outward ; a : along the edge
    const p0 = P(0, lo), p1 = P(ext, hi);
    pieces.push({ at: [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1])], size: [r3(Math.abs(p1[0] - p0[0])), r3(Math.abs(p1[1] - p0[1]))], name: `Branche ${b.id}` });
    d.bends.forEach((g, k) => bends.push({ id: `${b.id}-${k + 1}`, of: b.id, a: P(g.at - ROOT, lo), b: P(g.at - ROOT, hi), dir: g.dir, angle: g.angle, r: rb, label: bendLabel(g, rb), zone: [r3(g.from - ROOT), r3(g.to - ROOT)] }));
    if (b.end === "temp" || b.end === "volt") {
      const K = SENSOR_KINDS[b.end], tip = P(ext - 3, b.at), back = b.end === "temp" ? (b.side === -1 ? 1 : -1) : (b.side === -1 ? -1 : 1);      // a probe stands on the back of its branch ; a tab on its front
      const len = b.end === "volt" ? 4 : K.size[0], wid = b.end === "volt" ? (b.tabW > 0 ? Math.min(b.tabW, b.w - 1) : Math.max(1, b.w - 1)) : K.size[1];
      marks.push({ id: b.id, kind: b.end, at: tip, face: back > 0 ? "top" : "bottom", len, wid, h: K.size[2], axis: E.axis, net: b.end === "volt" ? b.net || "" : "" });
    }
  }
  for (const p of def.spots || []) { const K = SENSOR_KINDS[p.end]; if (K) marks.push({ id: p.id, kind: p.end, at: [p.x, p.y], face: p.side === -1 ? "bottom" : "top", len: K.size[0], wid: K.size[1], h: K.size[2], axis: 0, net: p.net || "" }); }
  return { kind: "flex-tree", t, k: K_FILM, pieces, bends, marks, holes: [], material: "PI-FILM" };
}
/** A strip — a flexible circuit with legs, or a busbar — flat along X, its width along Y. */
function stripFlat(def, kind) {
  const k = kind === "busbar" ? KFACTOR : K_FILM, d = develop(def.legs, def.t, def.r, k), W = def.W, marks = [], holes = [];
  const bends = d.bends.map((g, n) => ({ id: `P${n + 1}`, a: [g.at, 0], b: [g.at, W], dir: g.dir, angle: g.angle, r: def.r, label: bendLabel(g, def.r), zone: [g.from, g.to] }));
  for (const s of def.sensors || []) { const K = SENSOR_KINDS[s.kind]; if (K && def.legs[s.leg]) marks.push({ id: s.id, kind: s.kind, at: [d.dev(s.leg, s.s), s.y ?? W / 2], face: (s.side ?? 1) > 0 ? "top" : "bottom", len: K.size[0], wid: K.size[1], h: K.size[2], axis: 0, net: s.net || "" }); }
  for (const tm of def.terminals || []) if (def.legs[tm.leg]) holes.push({ id: tm.id, at: [d.dev(tm.leg, tm.s), tm.y ?? W / 2], d: r2((parseFloat(String(tm.screw).replace(/[^0-9.]/g, "")) || 6) + 0.6) });
  for (const h of def.holes || []) if (def.legs[h.leg]) holes.push({ id: h.id, at: [d.dev(h.leg, h.s), h.y ?? W / 2], d: h.d });
  for (const c of def.contacts || []) if (def.legs[c.leg]) marks.push({ id: c.id, kind: "contact", at: [d.dev(c.leg, c.s), c.y ?? W / 2], face: (c.side ?? 1) > 0 ? "top" : "bottom", len: c.turn ? c.h || 6 : c.w || 6, wid: c.turn ? c.w || 6 : c.h || 6, h: 0.05, axis: 0 });
  return { kind, t: def.t, k, pieces: [{ at: [0, 0], size: [d.total, W], name: "Bande" }], bends, marks, holes, material: def.material || (kind === "busbar" ? "CU-C110" : "PI-FILM") };
}
/** A folded sheet-metal part : the flat pattern the kernel computed, with its holes. */
function foldedFlat(spec, built) {
  const F = built.facts.folded, flat = F.flat, holes = flatHoles(F, built.facts.holes || []).list.map((h, i) => ({ id: h.id || `H${i + 1}`, at: [h.x, h.y], d: h.d }));
  return { kind: "folded", t: F.t, k: F.k, outline: flat.outline, bends: flat.bends.map((b, n) => ({ id: `P${n + 1}`, a: b.a, b: b.b, dir: b.dir === "down" ? "DOWN" : "UP", angle: b.angle, r: b.r, label: bendLabel({ dir: b.dir === "down" ? "DOWN" : "UP", angle: b.angle }, b.r) })), marks: [], holes, material: spec.material };
}

/** The part, flat. → null when it does not unfold. */
export function flatOf(spec, built = null) {
  if (!canFlatten(spec, built)) return null;
  const f = spec.flex ? (isTree(spec.flex) ? treeFlat(spec.flex) : stripFlat(spec.flex, "flex")) : spec.busbar ? stripFlat(spec.busbar, "busbar") : foldedFlat(spec, built);
  const pts = f.outline || f.pieces.flatMap((p) => [p.at, [p.at[0] + p.size[0], p.at[1] + p.size[1]]]), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  f.min = [r3(Math.min(...xs)), r3(Math.min(...ys))]; f.size = [r3(Math.max(...xs) - f.min[0]), r3(Math.max(...ys) - f.min[1])];
  const up = f.bends.filter((b) => b.dir === "UP").length;
  f.notes = [`À plat : ${fr(f.size[0])} × ${fr(f.size[1])} mm, ${fr(f.t)} mm d'épaisseur ; ${f.bends.length} pli(s) — ${up} vers le haut (UP), ${f.bends.length - up} vers le bas (DOWN), vus de la face du dessus.`,
    `Longueur développée sur la fibre neutre, k = ${fr(f.k)} (valeur typique ${f.kind === "busbar" || f.kind === "folded" ? "d'un métal" : "d'un film"}, à corriger par le fabricant).`];
  return f;
}

/** The flat blank as a part, for the view : z from 0 to t, the face « top » up. */
export function flatSpec(flat, spec) {
  const t = flat.t, features = [], bodies = {};
  if (flat.outline) features.push({ op: "extrude", id: "flan", name: "Flan à plat", profile: { poly: flat.outline }, plane: "XY", length: t });
  else flat.pieces.forEach((p, i) => features.push({ op: "box", id: `flan_${i + 1}`, name: p.name, at: [p.at[0], p.at[1], 0], size: [p.size[0], p.size[1], t] }));
  flat.holes.forEach((h) => features.push({ op: "cylinder", id: `trou_${h.id}`, name: `Trou ${h.id}`, mode: "cut", d: h.d, h: t + 2, at: [h.at[0], h.at[1], -1], axis: "Z" }));
  flat.marks.forEach((m) => {
    const body = `m_${String(m.id).toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, h = m.h, size = m.axis === 1 ? [m.wid, m.len, h] : [m.len, m.wid, h];
    bodies[body] = m.kind === "temp" ? { material: "GENERIC-COMPONENT", kind: "insulator", label: `Sonde ${m.id}` } : { material: "CU-C110", kind: "conductor", net: m.net || m.id, label: `${m.id}` };
    features.push({ op: "box", id: body, name: `${m.kind === "temp" ? "Sonde" : m.kind === "volt" ? "Prise" : "Contact"} ${m.id}`, body, at: [r3(m.at[0] - size[0] / 2), r3(m.at[1] - size[1] / 2), m.face === "top" ? t : -h], size });
  });
  return { dw: "part/1", id: `${spec.id}~flat`, name: `${spec.name || spec.id} — à plat`, family: spec.family || "sheet", process: spec.process || "purchased", material: flat.material || spec.material, params: {}, bodies, features: [...features, { op: "interfaces" }], interfaces: [], notes: flat.notes };
}
