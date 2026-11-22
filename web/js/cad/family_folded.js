/* DynamiteOrbit — "folded" family : a sheet-metal part, a flat base and edges folded at 90° on a press brake.
   spec.folded = {
     base: [L, W],       // the flat base : min corner at the origin, thickness from z = 0 to z = t
     t,                  // thickness of the sheet
     r,                  // inside radius of every bend (one tool for the whole part)
     flanges: [{ side: "+X" | "-X" | "+Y" | "-Y", h, dir: "up" | "down" }],
                         // h : OUTSIDE height of the folded edge, measured from the far face of the base
     relief,             // square corner relief where two folded edges meet (default : r + t + 0.5)
     k                   // position of the neutral fibre in the thickness, for the flat pattern (default 0.44)
   }
   Holes, cut-outs and interfaces go in spec.features / spec.interfaces as for any part : on the base (faces ±Z) or on a
   folded edge (faces ±X, ±Y ; give the hole the depth of the sheet, "through" pierces the edge across too). The block
   compiles to plain kernel features — the base is one extrusion of its outline, notched where two folded edges meet,
   each folded edge one extrusion of its bend and its wall — so the kernel and the FeatureScript export need nothing new.
   The flat pattern is computed here, pure : outline, bend lines, holes carried to the flat. Its bend allowance uses the
   k factor above, a TYPICAL value : the press brake and the tooling of the shop decide, and the shop corrects it. */

export const FOLD_SIDES = { "+X": { axis: 0, sign: 1, fr: "droite", plane: "XZ", id: "pli_droite" }, "-X": { axis: 0, sign: -1, fr: "gauche", plane: "XZ", id: "pli_gauche" }, "+Y": { axis: 1, sign: 1, fr: "arrière", plane: "YZ", id: "pli_arriere" }, "-Y": { axis: 1, sign: -1, fr: "avant", plane: "YZ", id: "pli_avant" } };
export const K_FACTOR = 0.44;
const r3 = (x) => Math.round(x * 1000) / 1000, pos = (v, what) => { if (typeof v !== "number" || !Number.isFinite(v) || !(v > 0)) throw new Error(`folded.${what} doit être un nombre positif (reçu ${JSON.stringify(v)}).`); return v; };

/** Reads an evaluated block : sizes, each folded edge with where it runs along its side, the bend allowance. Throws in French. */
export function foldedFacts(fo) {
  if (!fo || !Array.isArray(fo.base) || fo.base.length < 2) throw new Error("folded.base doit donner la longueur et la largeur de la base : [L, W].");
  const L = pos(fo.base[0], "base[0]"), W = pos(fo.base[1], "base[1]"), t = pos(fo.t, "t"), r = fo.r === 0 ? 0 : pos(fo.r ?? t, "r"), R = r + t;
  const k = typeof fo.k === "number" && fo.k > 0 && fo.k <= 0.5 ? fo.k : K_FACTOR, relief = typeof fo.relief === "number" && fo.relief >= 0 ? fo.relief : r3(r + t + 0.5), ba = r3((Math.PI / 2) * (r + k * t));
  const seen = new Set(), list = [];
  for (const [i, f] of (fo.flanges || []).entries()) {
    const S = FOLD_SIDES[f && f.side]; if (!S) throw new Error(`folded.flanges[${i}].side « ${f && f.side} » inconnu (+X, -X, +Y ou -Y).`);
    if (seen.has(f.side)) throw new Error(`Deux bords pliés sur le même côté (${f.side}) : un seul par côté.`); seen.add(f.side);
    const h = pos(f.h, `flanges[${i}].h`); if (h < R + 0.5) throw new Error(`Bord plié ${S.fr} de ${h} mm : plus court que son pli (rayon ${r} + épaisseur ${t} = ${r3(R)} mm). Correctif : au moins ${r3(4 * t + r)} mm.`);
    list.push({ index: i, side: f.side, h, dir: f.dir === "down" ? "down" : "up", ...S });
  }
  for (const f of list) {                                        // an edge stops short of a corner it shares with another folded edge
    const other = f.axis === 0 ? ["-Y", "+Y"] : ["-X", "+X"], run = f.axis === 0 ? W : L;
    f.from = seen.has(other[0]) ? relief : 0; f.to = run - (seen.has(other[1]) ? relief : 0); f.flat = r3(ba + f.h - R);
    if (!(f.to - f.from > 2 * t)) throw new Error(`Bord plié ${f.fr} : il ne reste pas de longueur entre les dégagements d'angle. Correctif : agrandir la base ou réduire le dégagement.`);
  }
  return { L, W, t, r, R, k, relief, ba, flanges: list, corners: list.reduce((n, f) => n + (f.from > 0 ? 1 : 0) + (f.to < (f.axis === 0 ? W : L) ? 1 : 0), 0) / 2 };
}

/** Outline of the base, counter-clockwise : a square notch of `relief` at every corner shared by two folded edges. */
function baseOutline(F) {
  const { L, W, relief: q } = F, has = (s) => F.flanges.some((f) => f.side === s), n = (a, b) => q > 0 && has(a) && has(b);
  return [
    ...(n("-X", "-Y") ? [[0, q], [q, q], [q, 0]] : [[0, 0]]), ...(n("+X", "-Y") ? [[L - q, 0], [L - q, q], [L, q]] : [[L, 0]]),
    ...(n("+X", "+Y") ? [[L, W - q], [L - q, W - q], [L - q, W]] : [[L, W]]), ...(n("-X", "+Y") ? [[q, W], [q, W - q], [0, W - q]] : [[0, W]]),
  ];
}
/* drops repeated points and the middle one of three in a line */
function tidy(pts) {
  let out = pts.map((p) => [r3(p[0]), r3(p[1])]).filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9; });
  for (let again = true; again && out.length > 3;) { again = false; out = out.filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length], n = a[(i + 1) % a.length], flat = Math.abs((p[0] - q[0]) * (n[1] - p[1]) - (p[1] - q[1]) * (n[0] - p[0])) < 1e-9; if (flat && !again) { again = true; return false; } return true; }); }
  return out;
}

/** The kernel features of a folded part, and what the rules and the routing sheet read. */
export function compileFolded(fo) {
  const F = foldedFacts(fo), { L, W, t, r, R } = F, e = Math.min(1, L / 10, W / 10);
  const features = [{ op: "extrude", id: "base", name: "Base", profile: { poly: tidy(baseOutline(F)) }, plane: "XY", length: t }];
  for (const f of F.flanges) {
    /* the bend and the wall in the plane across the bend line : u runs outward from the edge of the base, z up. Written as a
       path with its two true arcs (a polygon would have its vertex fillets shortened to half of the neighbouring edge). */
    const edge = f.axis === 0 ? L : W, odd = (f.sign < 0) !== (f.dir === "down"), P = (u, z) => `${r3(f.sign > 0 ? edge + u : -u)} ${r3(f.dir === "up" ? z : t - z)}`;
    const path = `M${P(-e, 0)} L${P(0, 0)} A${R} ${R} 0 0 ${odd ? 0 : 1} ${P(R, R)} L${P(R, f.h)} L${P(r, f.h)} L${P(r, R)}${r > 0 ? ` A${r} ${r} 0 0 ${odd ? 1 : 0} ${P(0, t)}` : ""} L${P(-e, t)} Z`;
    features.push({ op: "extrude", id: f.id, name: `Bord plié ${f.fr}`, profile: { path }, plane: f.plane, at: f.from, length: r3(f.to - f.from), fold: f.side });
  }
  return { features, facts: { ...F, flat: flatPattern(F) } };
}

/** The flat pattern : { outline: [[x, y]…] (closed, base at its place), bends: [{ a, b, side, dir, angle, r }], size: [w, h], min: [x, y], ba, k }. */
export function flatPattern(F) {
  const { L, W, ba } = F, by = Object.fromEntries(F.flanges.map((f) => [f.side, f])), B = baseOutline(F), raw = [];
  const corner = (x, y) => B.filter((p) => Math.abs(p[0] - x) <= F.relief + 1e-9 && Math.abs(p[1] - y) <= F.relief + 1e-9);
  let f = by["-Y"]; raw.push(...corner(0, 0)); if (f) raw.push([f.from, 0], [f.from, -f.flat], [f.to, -f.flat], [f.to, 0]);
  f = by["+X"]; raw.push(...corner(L, 0)); if (f) raw.push([L, f.from], [L + f.flat, f.from], [L + f.flat, f.to], [L, f.to]);
  f = by["+Y"]; raw.push(...corner(L, W)); if (f) raw.push([f.to, W], [f.to, W + f.flat], [f.from, W + f.flat], [f.from, W]);
  f = by["-X"]; raw.push(...corner(0, W)); if (f) raw.push([0, f.to], [-f.flat, f.to], [-f.flat, f.from], [0, f.from]);
  const out = tidy(raw);
  const bends = F.flanges.map((g) => { const c = (g.axis === 0 ? L : W), off = g.sign > 0 ? c + ba / 2 : -ba / 2;
    return { a: g.axis === 0 ? [r3(off), g.from] : [g.from, r3(off)], b: g.axis === 0 ? [r3(off), g.to] : [g.to, r3(off)], side: g.side, dir: g.dir, angle: 90, r: F.r }; });
  const xs = out.map((p) => p[0]), ys = out.map((p) => p[1]), min = [Math.min(...xs), Math.min(...ys)];
  return { outline: out, bends, size: [r3(Math.max(...xs) - min[0]), r3(Math.max(...ys) - min[1])], min, ba, k: F.k };
}

const holeFace = (F, h) => { if (h.face) return h.face; const a = h.axis || [0, 0, -1], m = Math.abs(a[2]) > 0.7 ? 2 : Math.abs(a[0]) > 0.7 ? 0 : 1; return m === 2 ? "+Z" : `${h.at[m] > (m === 0 ? F.L : F.W) / 2 ? "+" : "-"}${"XY"[m]}`; };
/** Height of a point of a folded edge above the far face of the base (the side the edge is folded to). */
const rise = (F, f, z) => (f.dir === "up" ? z : F.t - z);

/** A point given in the frame of a face — (x, y) on ±Z, (y, z) on ±X, (x, z) on ±Y — carried to the flat pattern : [x, y],
    or null when it lies in a bend (it would deform) or on a side that has no folded edge. */
export function flatPoint(F, face, p) {
  if (face === "+Z" || face === "-Z") return [r3(p[0]), r3(p[1])];
  const f = F.flanges.find((x) => x.side === face); if (!f) return null;
  const v = rise(F, f, p[1]); if (v < F.R - 1e-9) return null;
  const far = (f.axis === 0 ? F.L : F.W) * (f.sign > 0 ? 1 : 0) + f.sign * (F.ba + v - F.R);
  return f.axis === 0 ? [r3(far), r3(p[0])] : [r3(p[0]), r3(far)];
}
/** The holes of the built part on the flat pattern : [{ x, y, d, source }] ; `lost` lists those that sit in a bend. A hole
    drilled "through" from a folded edge also pierces the edge across, when there is one. */
export function flatHoles(F, holes) {
  const list = [], lost = [];
  for (const h of holes || []) {
    if (!h || !h.at || !(h.d > 0)) continue;
    if (!(h.through || (h.depth || 0) >= F.t - 1e-6)) continue;               // a blind hole is a later operation, not a cut of the flat
    const face = holeFace(F, h), m = face[1] === "Z" ? 2 : face[1] === "X" ? 0 : 1;
    const sides = m === 2 ? [face] : [face, ...(h.through ? [`${face[0] === "+" ? "-" : "+"}${face[1]}`] : [])];
    for (const [i, s] of sides.entries()) {
      const p = flatPoint(F, s, m === 2 ? [h.at[0], h.at[1]] : [h.at[1 - m], h.at[2]]);
      if (p) list.push({ x: p[0], y: p[1], d: h.d, source: h.source }); else if (i === 0) lost.push(h.source);
    }
  }
  return { list, lost: [...new Set(lost)] };
}
/** Distance from the edge of a hole to the nearest bend (its tangent line), on the part : { gap, side }, null without a bend. */
export function holeToBend(F, hole) {
  const face = holeFace(F, hole), p = hole.at, d = (hole.d || 0) / 2; let best = null;
  if (face[1] === "Z") { for (const f of F.flanges) { const c = f.axis === 0 ? F.L : F.W, q = p[f.axis], along = p[1 - f.axis]; if (along < f.from - d || along > f.to + d) continue; const gap = (f.sign > 0 ? c - q : q) - d; if (best === null || gap < best.gap) best = { gap: r3(gap), side: f.side }; } return best; }
  const f = F.flanges.find((x) => x.side === face); if (!f) return null;
  return { gap: r3(rise(F, f, p[2]) - F.R - d), side: face };
}
/** Distance from the edge of a hole to the nearest free edge of the sheet (not a bend) : a number, null when there is none. */
export function holeToEdge(F, hole) {
  const face = holeFace(F, hole), p = hole.at, d = (hole.d || 0) / 2, has = (s) => F.flanges.some((f) => f.side === s); let best = Infinity;
  if (face[1] === "Z") { if (!has("-X")) best = Math.min(best, p[0]); if (!has("+X")) best = Math.min(best, F.L - p[0]); if (!has("-Y")) best = Math.min(best, p[1]); if (!has("+Y")) best = Math.min(best, F.W - p[1]); }
  else { const f = F.flanges.find((x) => x.side === face); if (!f) return null; const along = p[1 - f.axis]; best = Math.min(f.h - rise(F, f, p[2]), along - f.from, f.to - along); }
  return Number.isFinite(best) ? r3(best - d) : null;
}

/** The bends as the press brake makes them : one line per folded edge, its tools. The order is the shop's to confirm. */
export function foldSteps(F) {
  const n = (x) => String(Math.round(x * 100) / 100).replace(".", ","), tool = `Presse plieuse : poinçon R${n(F.r)}, vé de ${n(6 * F.t)} à ${n(8 * F.t)} mm (6 à 8 × t, ordre de grandeur : l'atelier choisit)`;
  return F.flanges.map((f) => ({ side: f.side, tools: [tool], text: `Plier le bord ${f.fr} à 90° vers le ${f.dir === "up" ? "haut" : "bas"} — rayon intérieur ${n(F.r)} mm, hauteur extérieure ${n(f.h)} mm, ligne de pliage de ${n(f.to - f.from)} mm` }));
}
