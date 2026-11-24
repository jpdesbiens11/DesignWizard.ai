/* DynamiteOrbit.ai — the model and its refinement zones solved as ONE mesh.
   The cubes of the model the zones took are removed (what is left : the « outside ») ; each zone brings its fine cubes ; on the edge
   of a zone, every fine node is tied to the cube of the outside it sits on — it moves, or warms, as that cube says there (the 8
   weights of its corners). The tied nodes are no unknowns : their stiffness and their loads are carried to the corners that lead
   them. One conjugate gradient solves the whole, so a zone stiffens or softens the model as much as it should, and nothing has to
   be guessed on its edge. (Starting it from what the model alone found was tried : it does not help — where a zone uncovers a hole,
   that first guess is far from balanced, and costs more iterations than starting from nothing.) Each part keeps its own cube size, its own element matrix and its own share of the case : the outside
   is a reduced model like the one a cut leaves (regions keep the meaning they have on the product, a load is shared by weight),
   a zone gets what falls in it (refine.js).
   Pure : no DOM. */

import { assemble, exposedFaces, skin, FACE_DIRS, FACE_NODES } from "./voxel.js";
import { structureSystem, structureResults, thermalSystem, thermalResults } from "./index.js";
import { pcg, meshPieces } from "./solve.js";
import { cutFaces, cutSetup } from "./symmetry.js";
import { elementOf, structureSetup, thermalSetup } from "./refine.js";

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** The model without the cubes its zones took. It reads a load case like a model reduced by cuts : `cut` carries the product
    entire, the way from its nodes to these, the share of a load each node keeps (what its cubes outside the zones are of all its
    cubes, times its weight on a cut plane), and the exposed faces that are not surfaces of the product (a cut, or the edge of a
    zone). `toOut` : node of the model → node here, or -1. */
export function outsideModel(model, preps) {
  const { grid, nNodes, nCells, elems, elemCell } = model, { nx, ny, nz } = grid, inZone = new Uint8Array(model.cells.length), cells = Int16Array.from(model.cells);
  for (const p of preps) for (let g = 0; g < inZone.length; g++) if (p.block.mark[g]) { inZone[g] = 1; cells[g] = -1; }
  if (!cells.some((c) => c >= 0)) throw new Error("Les zones couvrent tout le produit : il ne reste rien du modèle. Réduisez-les, ou affinez plutôt le maillage d'ensemble.");
  const out = assemble(grid, cells, model.bodies), toOut = new Int32Array(nNodes).fill(-1), all = new Uint8Array(nNodes), gone = new Uint8Array(nNodes);
  for (let g = 0; g < model.nodeGrid.length; g++) { const a = model.nodeGrid[g], b = out.nodeGrid[g]; if (a >= 0 && b >= 0) toOut[a] = b; }
  for (let e = 0; e < nCells; e++) for (let c = 0; c < 8; c++) { const i = elems[8 * e + c]; all[i]++; if (inZone[elemCell[e]]) gone[i]++; }
  const weight = new Float32Array(out.nNodes);
  for (let a = 0; a < nNodes; a++) if (toOut[a] >= 0) weight[toOut[a]] = (model.cut ? model.cut.weight[a] : 1) * (all[a] - gone[a]) / all[a];
  const full = model.cut ? model.cut.full : model, fromFull = new Int32Array(full.nNodes).fill(-1), planes = model.cut ? model.cut.planes : [];
  for (let k = 0; k < full.nNodes; k++) { const a = model.cut ? model.cut.fromFull[k] : k; fromFull[k] = a >= 0 ? toOut[a] : -1; }
  const faces = exposedFaces(out), onCut = planes.length ? Uint8Array.from(cutFaces({ grid, elemCell: out.elemCell, cut: { planes } }, faces)) : new Uint8Array(faces.count);
  for (let f = 0; f < faces.count; f++) {
    const g = out.elemCell[faces.elem[f]], d = FACE_DIRS[faces.dir[f]], P = [g % nx + d[0], Math.floor(g / nx) % ny + d[1], Math.floor(g / (nx * ny)) + d[2]];
    if (P[0] >= 0 && P[1] >= 0 && P[2] >= 0 && P[0] < nx && P[1] < ny && P[2] < nz && inZone[P[0] + nx * (P[1] + ny * P[2])]) onCut[f] = 1;
  }
  out.cut = { full, fromFull, weight, planes, copies: model.cut ? model.cut.copies : 1, onCut };
  out.toOut = toOut;
  return out;
}

/** Solves several assembled systems as one : `outside` first, then one per zone, the edge nodes of each zone tied to the outside.
    D : unknowns per node (3 displacements, or 1 temperature). → { xs (one solution per system), run } */
function tiedSolve(D, model, out, sysOut, parts, { tol = 1e-6, maxIter = 20000, onProgress, held } = {}) {
  const systems = [sysOut, ...parts.map((p) => p.sys)], offset = [0]; for (const s of systems) offset.push(offset[offset.length - 1] + s.n);
  const N = offset[systems.length], b = new Float64Array(N), x = new Float64Array(N), fixed = new Uint8Array(N), diag = new Float64Array(N);
  systems.forEach((s, k) => { b.set(s.f || s.b, offset[k]); fixed.set(s.isFixed, offset[k]); diag.set(s.op.diag, offset[k]); if (s.x) x.set(s.x, offset[k]); });
  /* the ties : a tied dof, the 8 dofs of the outside that lead it, their weights */
  const slave = [], lead = [], w = [];
  parts.forEach((p, k) => { const { nodes, elem, w: weights } = p.prep.bound;
    for (let i = 0; i < nodes.length; i++) for (let d = 0; d < D; d++) { slave.push(offset[k + 1] + D * nodes[i] + d); for (let c = 0; c < 8; c++) { lead.push(D * out.toOut[model.elems[8 * elem[i] + c]] + d); w.push(weights[8 * i + c]); } } });
  for (let s = 0; s < slave.length; s++) { const i = slave[s];
    for (let c = 0; c < 8; c++) { const j = lead[8 * s + c], wc = w[8 * s + c]; if (wc) { b[j] += wc * b[i]; diag[j] += wc * wc * diag[i]; } }
    b[i] = 0; fixed[i] = 2; }
  const follow = (v) => { for (let s = 0; s < slave.length; s++) { let sum = 0; for (let c = 0; c < 8; c++) { const wc = w[8 * s + c]; if (wc) sum += wc * v[lead[8 * s + c]]; } v[slave[s]] = sum; } };
  if (held) held(fixed, offset);      // every piece of the whole must stand on something : the caller looks, and says
  function apply(v, y) {
    follow(v);
    systems.forEach((s, k) => s.op.apply(v.subarray(offset[k], offset[k + 1]), y.subarray(offset[k], offset[k + 1])));
    for (let s = 0; s < slave.length; s++) { const i = slave[s], yi = y[i]; if (yi) for (let c = 0; c < 8; c++) { const wc = w[8 * s + c]; if (wc) y[lead[8 * s + c]] += wc * yi; } y[i] = 0; }
  }
  const run = pcg({ apply, diag, b, x, fixed, tol, maxIter, onProgress });
  follow(x);
  return { xs: systems.map((s, k) => x.slice(offset[k], offset[k + 1])), run, dofs: N - fixed.reduce((s, v) => s + (v ? 1 : 0), 0) };
}

/** Names the body of a piece of the composite mesh that nothing holds (no node marked), or null. A piece : cubes that share a
    node, across the outside, the zones and their ties. */
function unheld(model, out, parts, mark, offset, D) {
  const meshes = [out, ...parts.map((p) => p.prep.local)], labels = meshes.map((m) => meshPieces(m)), base = [0]; for (const l of labels) base.push(base[base.length - 1] + l.count);
  const parent = Array.from({ length: base[meshes.length] }, (_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  parts.forEach((p, k) => { const { nodes, elem } = p.prep.bound; for (let i = 0; i < nodes.length; i++) parent[find(base[k + 1] + labels[k + 1].piece[nodes[i]])] = find(labels[0].piece[out.toOut[model.elems[8 * elem[i]]]]); });
  const has = new Uint8Array(parent.length);
  meshes.forEach((m, k) => { for (let i = 0; i < m.nNodes; i++) { let on = false; for (let d = 0; d < D; d++) if (mark[offset[k] + D * i + d] === 1) on = true; if (on) has[find(base[k] + labels[k].piece[i])] = 1; } });
  for (let k = 0; k < meshes.length; k++) { const m = meshes[k]; for (let e = 0; e < m.nCells; e++) if (!has[find(base[k] + labels[k].piece[m.elems[8 * e]])]) return m.bodies[m.elemBody[e]].name ?? `n° ${m.elemBody[e] + 1}`; }
  return null;
}

/**
 * Solves the model with its zones, as one mesh.
 * @param kind  "structure" | "thermal" | "thermo"
 * @param preps the zones, prepared (prepareZones of refine.js : only those that have a `prep`)
 * @param load  the case of the whole model, as the worker receives it (before the cut planes add their conditions)
 * @returns { out (the outside), r / rt (its results : structure / thermal), parts: [{ prep, r, rt }], iterations, residual, dofs, ms }
 */
export function solveComposite(kind, model, preps, load, onProgress) {
  const t0 = clock(), out = outsideModel(model, preps), parts = preps.map((prep) => ({ prep }));
  const check = (D, what) => (fixed, offset) => { const body = unheld(model, out, parts, fixed, offset, D); if (body !== null) throw new Error(`Avec ses zones de raffinement, une partie du corps « ${body} » ${what}. Le maillage fin a peut-être séparé ce que les cubes du modèle tenaient ensemble : agrandissez la zone ou déplacez-la.`); };
  let rt = null, r = null, iterations = 0, residual = 0, dofs = 0;
  const heat = (c) => {
    const sysOut = thermalSystem(out, cutSetup(out, c, "thermal")); parts.forEach((p) => { p.sys = thermalSystem(p.prep.local, thermalSetup(p.prep, model, c)); });
    /* a temperature to start from, the same everywhere ; « held » for heat : an imposed temperature or a cooled face */
    const start = sysOut.start ?? parts.map((p) => p.sys.start).find((v) => v !== null) ?? 0; for (const s of [sysOut, ...parts.map((p) => p.sys)]) for (let i = 0; i < s.n; i++) if (!s.isFixed[i]) s.x[i] = start;
    const anchored = (fixed, offset) => { const mark = Uint8Array.from(fixed, (v) => (v === 1 ? 1 : 0)); [sysOut, ...parts.map((p) => p.sys)].forEach((s, k) => { for (let i = 0; i < s.n; i++) if (s.film[i] > 0) mark[offset[k] + i] = 1; }); check(1, "n'a ni température imposée ni convection : sa température est indéfinie")(mark, offset); };
    const t = tiedSolve(1, model, out, sysOut, parts, { onProgress, held: anchored });
    if (!t.run.converged) throw new Error(`Le calcul thermique avec les zones n'a pas convergé après ${t.run.iterations} itérations (résidu ${t.run.residual.toExponential(1)}).`);
    iterations += t.run.iterations; residual = t.run.residual; dofs = t.dofs;
    parts.forEach((p, k) => { p.rt = thermalResults(p.prep.local, p.sys, t.xs[k + 1]); });
    return thermalResults(out, sysOut, t.xs[0]);
  };
  if (kind === "thermal") rt = heat(load);
  else {
    let fields = null;      // the temperature of every part, when the case is thermo-mechanical
    if (kind === "thermo") { const th = load.thermal || {}, Tref = load.Tref ?? 20;
      if (typeof th.uniform === "number") fields = [out, ...preps.map((p) => p.local)].map(() => ({ T: th.uniform, Tref })); else { rt = heat(th.case || {}); fields = [{ T: rt.T, Tref }, ...parts.map((p) => ({ T: p.rt.T, Tref }))]; } }
    const base = { fixed: load.fixed, loads: load.loads || [] }, sysOut = structureSystem(out, cutSetup(out, { ...base, ...(fields ? { thermal: fields[0] } : {}) }, "structure"));
    parts.forEach((p, k) => { p.sys = structureSystem(p.prep.local, structureSetup(p.prep, model, base, fields ? fields[k + 1] : null)); });
    const t = tiedSolve(3, model, out, sysOut, parts, { onProgress, held: check(3, "n'est plus reliée à aucun appui") });
    if (!t.run.converged) throw new Error(`Le calcul avec les zones n'a pas convergé après ${t.run.iterations} itérations (résidu ${t.run.residual.toExponential(1)}). Une partie du maillage fin ne tient peut-être que par une arête : agrandissez la zone ou déplacez-la.`);
    iterations += t.run.iterations; residual = t.run.residual; dofs = t.dofs;
    r = structureResults(out, sysOut, t.xs[0]); parts.forEach((p, k) => { p.r = structureResults(p.prep.local, p.sys, t.xs[k + 1]); });
  }
  for (const p of parts) delete p.sys;
  return { out, r, rt, parts, iterations, residual, dofs, ms: clock() - t0 };
}

/** A field of the outside (D values per node), written on the nodes of the model ; a node the zones swallowed keeps `fill`. */
export function onModel(model, out, field, D = 1, fill = null) {
  const res = fill ? Float32Array.from(fill) : new Float32Array(D * model.nNodes);
  for (let a = 0; a < model.nNodes; a++) { const b = out.toOut[a]; if (b >= 0) for (let d = 0; d < D; d++) res[D * a + d] = field[D * b + d]; }
  return res;
}
/** The largest (sign 1) or smallest (-1) value over the whole composite : outside and zones. fieldOf(part) → its field, at(part) → its mesh.
    → { value, at } */
export function peakOf(meshes, fields, sign = 1) {
  let best = null;
  meshes.forEach((m, k) => { const f = fields[k]; for (let i = 0; i < m.nNodes; i++) if (best === null || sign * f[i] > sign * best.value) best = { value: f[i], at: Array.from(m.nodes.subarray(3 * i, 3 * i + 3)) }; });
  return best;
}
/** The largest value of a field of the model on the cubes a zone took (what the model alone said there) : { value, at } or null. */
export function blockPeak(prep, model, field) {
  let best = -1; for (let e = 0; e < model.nCells; e++) if (prep.block.mark[model.elemCell[e]]) for (let c = 0; c < 8; c++) { const i = model.elems[8 * e + c]; if (best < 0 || field[i] > field[best]) best = i; }
  return best < 0 ? null : { value: field[best], at: Array.from(model.nodes.subarray(3 * best, 3 * best + 3)) };
}

/**
 * The skin of the model with its zones in place : the faces of the cubes the zones took are hidden (they keep their place in the
 * arrays, so what is aligned on the faces of the model stays so), the fine cubes of each zone follow, then the few faces of the model
 * that the fine mesh uncovers where it meets it (a hole the fine mesh sees and the model did not).
 * @param field per node of the model (or null) ; parts [{ prep, field (per node of the zone, or null), u (3 per node of the zone, or null) }]
 * @returns { pos, idx, val, epos, faces, zone (per face : 0 the model, k the k-th zone), body (per face : index of its body) }
 */
export function compositeSkin(model, field, parts, { u, scale = 1 } = {}) {
  const cf = exposedFaces(model), hide = new Uint8Array(cf.count), ofCell = elementOf(model), { nx, ny, nz } = model.grid, taken = (g) => parts.some((p) => p.prep.block.mark[g]);
  for (let f = 0; f < cf.count; f++) if (taken(model.elemCell[cf.elem[f]])) hide[f] = 1;
  const pieces = [skin(model, field, { u, scale, hide })], zone = [new Uint8Array(cf.count)], body = [Int16Array.from(cf.elem, (e) => model.elemBody[e])];
  parts.forEach((part, k) => {
    const { local, inner } = part.prep, lf = exposedFaces(local);
    pieces.push(skin(local, part.field, { u: part.u, scale, hide: Uint8Array.from(inner, (v) => (v === 1 ? 1 : 0)) }));
    zone.push(new Uint8Array(lf.count).fill(k + 1)); body.push(Int16Array.from(lf.elem, (e) => local.elemBody[e]));
  });
  /* where the fine mesh leaves a cube of the model uncovered, that cube shows its face again */
  const pos = [], val = [], bodies = [], place = (i, d) => model.nodes[3 * i + d] + (u ? scale * u[3 * i + d] : 0);
  for (const part of parts) {
    const { block, zone: { ratio: r }, local } = part.prep, n = [local.grid.nx, local.grid.ny, local.grid.nz];
    for (let g = 0; g < block.mark.length; g++) {
      if (!block.mark[g] || ofCell[g] < 0) continue;      // a cube the model did not have : its neighbour already shows its face
      const q = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))];
      for (let d = 0; d < 6; d++) {
        const P = [q[0] + FACE_DIRS[d][0], q[1] + FACE_DIRS[d][1], q[2] + FACE_DIRS[d][2]]; if (P[0] < 0 || P[1] < 0 || P[2] < 0 || P[0] >= nx || P[1] >= ny || P[2] >= nz) continue;
        const gp = P[0] + nx * (P[1] + ny * P[2]), e = ofCell[gp]; if (e < 0 || taken(gp)) continue;
        const a = d >> 1, [s, t] = [0, 1, 2].filter((x) => x !== a), base = q.map((v, x) => (v - block.lo[x]) * r); let covered = true;
        for (let i = 0; i < r && covered; i++) for (let j = 0; j < r; j++) { const c = base.slice(); c[a] += d & 1 ? r - 1 : 0; c[s] += i; c[t] += j; if (local.cells[c[0] + n[0] * (c[1] + n[1] * c[2])] < 0) { covered = false; break; } }
        if (covered) continue;
        for (const c of FACE_NODES[d ^ 1]) { const i = model.elems[8 * e + c]; pos.push(place(i, 0), place(i, 1), place(i, 2)); val.push(field ? field[i] : 0); }
        bodies.push(model.elemBody[e]);
      }
    }
  }
  if (bodies.length) { const idx = new Uint32Array(6 * bodies.length); for (let f = 0; f < bodies.length; f++) idx.set([4 * f, 4 * f + 1, 4 * f + 2, 4 * f, 4 * f + 2, 4 * f + 3], 6 * f);
    pieces.push({ pos: Float32Array.from(pos), idx, val: Float32Array.from(val), epos: new Float32Array(0), faces: bodies.length }); zone.push(new Uint8Array(bodies.length)); body.push(Int16Array.from(bodies)); }
  const total = pieces.reduce((s, p) => s + p.faces, 0), out = { pos: new Float32Array(12 * total), idx: new Uint32Array(6 * total), val: new Float32Array(4 * total), epos: new Float32Array(pieces.reduce((s, p) => s + p.epos.length, 0)), faces: total, zone: new Uint8Array(total), body: new Int16Array(total) };
  let f0 = 0, e0 = 0;
  pieces.forEach((p, k) => { out.pos.set(p.pos, 12 * f0); out.val.set(p.val, 4 * f0); for (let i = 0; i < p.idx.length; i++) out.idx[6 * f0 + i] = p.idx[i] + 4 * f0; out.epos.set(p.epos, e0); out.zone.set(zone[k], f0); out.body.set(body[k], f0); f0 += p.faces; e0 += p.epos.length; });
  return out;
}
