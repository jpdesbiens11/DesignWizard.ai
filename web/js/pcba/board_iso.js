/* DesignWizard.ai — isolation of a board ALONE (demande de JP : « analyser l'isolation du PCBA… analyse PCBA ou analyse Assy ») : the
   scene the creepage and clearance engine measures (analysis/cc_paths.js), built from the REAL copper of the board — the pads, the tracks
   and the vias of its two outer layers — and from its bare laminate, holes included. Pure : no kernel, no DOM.

   What is measured, and what is not :
   - the nets are grouped by POTENTIAL (every net at 24 V is one potential) : two nets at the same voltage ask for no distance, and
     the verdict of a pair of potentials is that of its closest two nets — whose names the result gives (netAt) ;
   - a pad that no net reaches is a floating conductor : a path may hop over it (d1 + d2) ;
   - round copper is described by a polygon that ENCLOSES it (its sides are tangent to the circle) : a distance measured is equal to
     the true one or a little shorter — never longer ;
   - the inner layers are left out : between two layers the laminate insulates (solid insulation), and this analysis only measures
     paths through air and along a surface ; a copper plane on an OUTER layer is not drawn either, and the notes say so ;
   - the bodies of the components are left out : the measure is that of the bare board. What a component bridges (an optocoupler,
     a transformer) has the distances of its own datasheet. */

import { resolveBoard } from "./model.js";
import { padShape, discShape, trackShapes, gap, polyArea } from "./geom2d.js";

const N = 8, H = Math.PI / (2 * N);                       // 8 sides per half circle ; half the angle of a side
const fr = (v) => String(Math.round(v * 1000) / 1000).replace(".", ",").replace("-", "−");
/** The name of a potential : its voltage. */
export const levelName = (v) => `${fr(Number(v) || 0)} V`;

/** The polygon (counter-clockwise) that encloses a copper shape of geom2d. */
export function shapePoly(s) {
  if (s.rect) { const [x0, y0, x1, y1] = s.rect; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], a0 = dx || dy ? Math.atan2(dy, dx) : 0, R = s.r / Math.cos(H), out = [];
  for (const [c, from] of [[s.b, a0 - Math.PI / 2], [s.a, a0 + Math.PI / 2]]) for (let i = 0; i < N; i++) { const a = from + (2 * i + 1) * H; out.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]); }
  return out;
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const inTri = (p, a, b, c) => cross(a, b, p) > 1e-12 && cross(b, c, p) > 1e-12 && cross(c, a, p) > 1e-12;
const meet = (a, b, c, d) => { const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d); return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12)); };
/** Triangles of a polygon with holes (ear clipping ; each hole is first tied to the outline by a bridge). outline : counter-clockwise ;
    holes : any sense. → { pts: [[x, y]…] (the outline, then each hole), tris: [i, j, k…] (counter-clockwise) } */
export function triangulate(outline, holes = []) {
  const pts = outline.map((p) => [p[0], p[1]]); let ring = pts.map((_, i) => i);
  if (polyArea(pts) < 0) ring.reverse();
  const loops = [ring.slice()];
  for (const h0 of [...holes].sort((a, b) => Math.max(...b.map((p) => p[0])) - Math.max(...a.map((p) => p[0])))) {
    const base = pts.length, h = polyArea(h0) > 0 ? [...h0].reverse() : h0; for (const p of h) pts.push([p[0], p[1]]);
    const hi = h.map((_, i) => base + i); loops.push(hi);
    const edges = []; for (const L of loops) for (let i = 0; i < L.length; i++) edges.push([L[i], L[(i + 1) % L.length]]);
    let best = null;
    for (let i = 0; i < ring.length; i++) for (const k of hi) { const a = pts[ring[i]], b = pts[k], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (best && d >= best.d) continue;
      if (edges.some(([u, v]) => u !== ring[i] && v !== ring[i] && u !== k && v !== k && meet(a, b, pts[u], pts[v]))) continue;
      best = { d, i, k }; }
    if (!best) continue;                                                             // a hole that cannot be reached is left closed
    const at = hi.indexOf(best.k), turn = [...hi.slice(at), ...hi.slice(0, at), best.k];
    ring = [...ring.slice(0, best.i + 1), ...turn, ...ring.slice(best.i)];
  }
  const tris = []; let guard = ring.length * ring.length + 10;
  while (ring.length > 3 && guard-- > 0) {
    let cut = -1;
    for (let i = 0; i < ring.length && cut < 0; i++) { const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
      if (cross(pts[a], pts[b], pts[c]) <= 1e-12) continue;                           // a reflex or flat corner is not an ear
      if (ring.some((k) => k !== a && k !== b && k !== c && inTri(pts[k], pts[a], pts[b], pts[c]))) continue;
      cut = i; tris.push(a, b, c); }
    if (cut < 0) { let flat = ring.findIndex((b, i) => Math.abs(cross(pts[ring[(i + ring.length - 1) % ring.length]], pts[b], pts[ring[(i + 1) % ring.length]])) <= 1e-12); if (flat < 0) flat = 0; cut = flat; }      // a flat corner (the two sides of a bridge) is dropped
    ring.splice(cut, 1);
  }
  if (ring.length === 3 && cross(pts[ring[0]], pts[ring[1]], pts[ring[2]]) > 1e-12) tris.push(ring[0], ring[1], ring[2]);
  return { pts, tris, loops };
}

/* a prism between z0 and z1, written into acc = { pos, nrm, idx, epos } : flat faces (a vertex per face), outward triangles */
function prism(acc, loops, pts, tris, z0, z1) {
  const v = (p, z, n) => { acc.pos.push(p[0], p[1], z); acc.nrm.push(n[0], n[1], n[2]); return acc.pos.length / 3 - 1; };
  const top = pts.map((p) => v(p, z1, [0, 0, 1])), bot = pts.map((p) => v(p, z0, [0, 0, -1]));
  for (let i = 0; i < tris.length; i += 3) { acc.idx.push(top[tris[i]], top[tris[i + 1]], top[tris[i + 2]]); acc.idx.push(bot[tris[i]], bot[tris[i + 2]], bot[tris[i + 1]]); }
  for (const L of loops) for (let i = 0; i < L.length; i++) {
    const a = pts[L[i]], b = pts[L[(i + 1) % L.length]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [dy / l, -dx / l, 0];
    const p0 = v(a, z0, n), p1 = v(b, z0, n), p2 = v(b, z1, n), p3 = v(a, z1, n); acc.idx.push(p0, p1, p2, p0, p2, p3);
    acc.epos.push(a[0], a[1], z0, b[0], b[1], z0, a[0], a[1], z1, b[0], b[1], z1);
    const c = pts[L[(i + 2) % L.length]], bend = Math.abs(cross(a, b, c)) / (l * (Math.hypot(c[0] - b[0], c[1] - b[1]) || 1));
    if (bend > 0.5) acc.epos.push(b[0], b[1], z0, b[0], b[1], z1);              // a vertical line at a sharp corner only : a round stays smooth
  }
}
const solid = (acc, poly, z0, z1) => { const idx = []; for (let i = 1; i + 1 < poly.length; i++) idx.push(0, i, i + 1); prism(acc, [poly.map((_, i) => i)], poly, idx, z0, z1); };
const mesh = (acc) => ({ pos: new Float32Array(acc.pos), nrm: new Float32Array(acc.nrm), idx: new Uint32Array(acc.idx), epos: new Float32Array(acc.epos) });
const blank = () => ({ pos: [], nrm: [], idx: [], epos: [] });
const circle = (x, y, d) => { const out = [], n = 2 * N; for (let i = 0; i < n; i++) { const a = -2 * Math.PI * i / n; out.push([x + d / 2 * Math.cos(a), y + d / 2 * Math.sin(a)]); } return out; };      // a hole : inscribed (the laminate is never wider than it is)

/** The potentials of a board : its nets that have copper on an outer layer, grouped by voltage. kinds : { "<name>": "ac" } kept by the
    analysis. → [{ name, voltage, kind, nets: [names] }], the highest first */
export function boardLevels(R, kinds = {}) {
  const has = new Set(); for (const p of R.pads) if (p.net && p.layers.some(outer)) has.add(p.net);
  for (const t of R.tracks) if (t.net && outer(t.layer)) has.add(t.net); for (const v of R.vias) if (v.net) has.add(v.net);
  const by = new Map();
  for (const n of R.nets) { if (!has.has(n.name)) continue; const v = Number(n.voltage) || 0, name = levelName(v); if (!by.has(name)) by.set(name, { name, voltage: v, kind: kinds[name] === "ac" ? "ac" : "dc", nets: [] }); by.get(name).nets.push(n.name); }
  return [...by.values()].sort((a, b) => Math.abs(b.voltage) - Math.abs(a.voltage) || b.voltage - a.voltage);
}
const outer = (l) => l === "top" || l === "bottom";

/** The scene of a board for the isolation engine and for the view.
    board : the document ; lib : the trade library ; o : { cti (of the laminate, 175 when absent), kinds }
    → { bodies: [{ id, name, kind: "insulator" | "conductor" | "floating", net (the potential), boardNet, group, printed, material, color?, mesh, pos, idx }],
        levels, shapes: [{ net, level, layer, s, what }], t, cu, notes: [{ id, text }] } */
export function boardIsoScene(board, lib = {}, o = {}) {
  const R = resolveBoard(board, lib), t = R.t, cu = Math.max(0.018, ((board.board || {}).copper || 35) / 1000), levels = boardLevels(R, o.kinds || {}), levelOf = new Map(levels.flatMap((l) => l.nets.map((n) => [n, l.name])));
  const cti = o.cti ?? 175, group = cti >= 600 ? "I" : cti >= 400 ? "II" : cti >= 175 ? "IIIa" : "IIIb", bodies = [], shapes = [], notes = [];
  const lam = blank(), T = triangulate(R.outline, R.holes.map((h) => circle(h.x, h.y, h.d))); prism(lam, T.loops, T.pts, T.tris, 0, t);
  bodies.push({ id: "board", name: "Carte nue (stratifié)", kind: "insulator", net: null, boardNet: null, group, printed: true, material: o.material || "FR4", color: "#2f7d4f", ...meshOf(lam) });
  const byNet = new Map(), put = (net, s, layers, what, id) => { for (const l of layers) { if (!outer(l)) continue; const z = l === "top" ? [t, t + cu] : [-cu, 0];
    if (!net) { const acc = blank(); solid(acc, shapePoly(s), z[0], z[1]); bodies.push({ id: `Pad:${id}@${l}`, name: `${what} — sans net`, kind: "floating", net: null, boardNet: null, group: null, printed: false, material: "Cuivre", color: "#c9a94f", layer: l, ...meshOf(acc) }); shapes.push({ net: null, level: null, layer: l, s, what }); continue; }
    if (!byNet.has(net)) byNet.set(net, blank()); solid(byNet.get(net), shapePoly(s), z[0], z[1]); shapes.push({ net, level: levelOf.get(net) || null, layer: l, s, what }); } };
  R.pads.forEach((p) => put(p.net, padShape(p), p.layers, `pastille ${p.pin}`, p.pin));
  R.tracks.forEach((tr) => trackShapes(tr).forEach((s) => put(tr.net, s, [tr.layer], `piste ${tr.net}`, "")));
  R.vias.forEach((v) => put(v.net, discShape(v.x, v.y, v.d), ["top", "bottom"], `via ${v.net}`, `via${v.x},${v.y}`));
  for (const [net, acc] of byNet) bodies.push({ id: `Cu:${net}`, name: `Cuivre ${net}`, kind: "conductor", net: levelOf.get(net), boardNet: net, group: null, printed: false, material: "Cuivre", ...meshOf(acc) });
  const inner = R.layers.filter((l) => !outer(l)), planes = R.planes.filter((p) => outer(p.layer));
  if (inner.length) notes.push({ id: "inner", text: `Les ${inner.length} couches internes ne sont pas mesurées : entre deux couches, c'est le stratifié qui isole, et cette analyse ne mesure que des chemins dans l'air et en surface.` });
  if (planes.length) notes.push({ id: "plane", warn: true, text: `Plan de cuivre sur une couche externe (${planes.map((p) => p.net).join(", ")}) : il n'est pas représenté — les distances à ce plan ne sont pas mesurées ici.` });
  notes.push({ id: "bare", text: "La mesure est celle de la carte nue : les corps des composants ne comptent pas. Ce qu'un composant ponte (optocoupleur, transformateur) a les distances de sa propre fiche." });
  if (R.holes.length) notes.push({ id: "holes", text: `${R.holes.length} trou(s) de fixation, comptés comme des trous nus : la vis et sa tête se regardent dans l'analyse de l'assemblage.` });
  return { bodies, levels, shapes, t, cu, notes, size: [R.w, R.h], problems: R.problems };
}
const meshOf = (acc) => { const m = mesh(acc); return { mesh: m, pos: m.pos, idx: m.idx }; };

/** Whose copper is at a point of a path (its end) : the nearest copper of the layer the point is on. → { net, level, layer, what } or null */
export function netAt(scene, p, level = null) {
  const layer = p[2] >= scene.t / 2 ? "top" : "bottom", dot = { a: [p[0], p[1]], b: [p[0], p[1]], r: 0 }; let best = null;
  for (const x of scene.shapes) { if (x.layer !== layer || (level && x.level !== level)) continue; const d = gap(x.s, dot); if (!best || d < best.d) best = { d, x }; }
  return best && best.d < 0.5 ? { net: best.x.net, level: best.x.level, layer, what: best.x.what } : null;
}
/** The two nets a measured path joins. path : [[x, y, z]…] ; a, b : the names of the two potentials. → { a, b, layer } with what could be named */
export function pathNets(scene, path, a, b) {
  if (!path || path.length < 2) return null;
  const p = path[0], q = path[path.length - 1], pa = netAt(scene, p, a) || netAt(scene, q, a), pb = netAt(scene, q, b) || netAt(scene, p, b);
  return pa || pb ? { a: pa ? pa.net : null, b: pb ? pb.net : null, layer: pa && pb && pa.layer !== pb.layer ? "both" : (pa || pb).layer } : null;
}

/** The shortest straight gap between the copper of two potentials on one outer layer — exact (the shapes of geom2d, not their polygons),
    blind to what stands in the way. → the distance in mm, or null when they share no layer */
export function exactGap(scene, a, b) {
  let best = null; const A = scene.shapes.filter((x) => x.level === a), B = scene.shapes.filter((x) => x.level === b);
  for (const x of A) for (const y of B) { if (x.layer !== y.layer) continue; const d = gap(x.s, y.s); if (best === null || d < best) best = d; }
  return best === null ? null : Math.max(0, best);
}
/** A measure of the engine made exact where it can be : a straight path on one layer is the gap of the true shapes (the engine measured
    their enclosing polygons, a little shorter). A path that bends, hops over a floating pad or turns round an edge is left as measured.
    r : { clearance, creepage } of measurePair → the same, d corrected ; `exact: true` where it was */
export function refine(scene, r, a, b) {
  const ex = exactGap(scene, a, b); if (ex === null) return r;
  const flat = (m) => m && typeof m.d === "number" && m.path && m.path.length === 2 && (m.path[0][2] >= scene.t / 2) === (m.path[1][2] >= scene.t / 2) && !(m.via && m.via.length) && !m.bridges;
  const fix = (m) => (flat(m) && m.d <= ex + 1e-6 && ex - m.d <= 0.03 ? { ...m, d: ex, exact: true } : m);
  return { ...r, clearance: fix(r.clearance), creepage: fix(r.creepage) };
}
