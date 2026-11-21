/* DesignWizard.ai — symmetries and cuts : solving a part of the model instead of the whole.
   A product that is the same on both sides of a plane, held and loaded the same on both sides, need only be solved on one
   side : on the plane nothing crosses — no displacement through it, no heat through it. A half, a quarter or an eighth of
   the cubes gives the same answer, or a finer mesh for the same time. A cut can also isolate a zone : the plane then carries
   the condition the analyst chooses (held, free, a temperature).
   cuts : [{ axis: 0 | 1 | 2, at (mm), keep: 1 | -1 (the side that is kept), bc: "sym" | "fixed" | "free" | "temp", T }]
   The whole model is meshed first, with a grid plane on every cut (voxel.js : planes) ; the reduced model keeps the cells of
   one side. Regions are still chosen on the whole model, so a support or a load keeps its meaning. Pure. */

import { assemble } from "./voxel.js";

export const CUT_BC = { sym: "Symétrie : rien ne traverse le plan", fixed: "Tenu : la matière retirée est rigide", free: "Libre : rien de l'autre côté", temp: "Température imposée sur le plan" };
const AX = "XYZ";
/** The grid plane of a cut : its index along the axis, and where it really is. */
export function planeOf(model, cut) {
  const g = model.grid, n = [g.nx, g.ny, g.nz][cut.axis], i = Math.max(0, Math.min(n, Math.round((cut.at - g.origin[cut.axis]) / g.h)));
  return { axis: cut.axis, i, at: g.origin[cut.axis] + i * g.h, n };
}

/** The planes about which the meshed product is its own mirror. → [{ axis, at, mismatch (share of the cells that have no twin), ok }] */
export function findSymmetries(model, tol = 0.012) {
  const { grid: { nx, ny, nz, h, origin }, cells, nCells } = model, n = [nx, ny, nz], out = [];
  for (let axis = 0; axis < 3; axis++) {
    let off = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const g = i + nx * (j + ny * k), q = [i, j, k]; q[axis] = n[axis] - 1 - q[axis];
      if (cells[g] !== cells[q[0] + nx * (q[1] + ny * q[2])] && cells[g] >= 0) off++;
    }
    out.push({ axis, name: AX[axis], at: origin[axis] + n[axis] * h / 2, mismatch: nCells ? off / nCells : 1, ok: nCells > 0 && off / nCells <= tol });
  }
  return out;
}

/** The model reduced by its cuts. It keeps the grid of the whole model ; `cut` holds what the solvers need :
    full (the whole model), fromFull (node of the whole → node here, or -1), weight (per node : 1, ½ on a cut plane, ¼ on two…),
    onCut (per exposed face : 1 when the face is a cut face, not a surface of the product), planes, copies. */
export function reduceModel(full, cuts) {
  const list = (cuts || []).filter((c) => c && c.axis >= 0 && c.axis <= 2 && Number.isFinite(c.at)); if (!list.length) return full;
  const { grid, cells } = full, { nx, ny, nz } = grid, kept = Int16Array.from(cells), planes = list.map((c) => ({ ...planeOf(full, c), keep: c.keep < 0 ? -1 : 1, bc: CUT_BC[c.bc] ? c.bc : "sym", T: c.T }));
  for (const pl of planes) { if (pl.i <= 0 || pl.i >= pl.n) throw new Error(`Le plan de coupe ${AX[pl.axis]} = ${Math.round(pl.at * 100) / 100} mm ne traverse pas la pièce.`);
    for (let g = 0; g < kept.length; g++) { if (kept[g] < 0) continue; const q = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))][pl.axis]; if (pl.keep > 0 ? q < pl.i : q >= pl.i) kept[g] = -1; } }
  if (!kept.some((c) => c >= 0)) throw new Error("Les coupes ne laissent rien de la pièce : inversez le côté gardé d'un plan.");
  const model = assemble(grid, kept, full.bodies), fromFull = new Int32Array(full.nNodes).fill(-1), weight = new Float32Array(model.nNodes).fill(1), nxn = nx + 1, nyn = ny + 1;
  for (let g = 0; g < full.nodeGrid.length; g++) { const a = full.nodeGrid[g], b = model.nodeGrid[g]; if (a >= 0 && b >= 0) { fromFull[a] = b; const q = [g % nxn, Math.floor(g / nxn) % nyn, Math.floor(g / (nxn * nyn))]; for (const pl of planes) if (q[pl.axis] === pl.i) weight[b] *= 0.5; } }
  model.cut = { full, fromFull, weight, planes, copies: full.nCells / model.nCells, onCut: null };
  return model;
}
/** Marks, among the exposed faces of a reduced model, those that lie on a cut : they are inside the product, not on its surface. */
export function cutFaces(model, faces) {
  const c = model.cut; if (!c) return model.inner || null; if (c.onCut) return c.onCut;      // a refinement zone marks its own (refine.js) : where it meets the rest of the product
  const { grid: { nx, ny }, elemCell } = model, on = new Uint8Array(faces.count);
  for (let f = 0; f < faces.count; f++) { const g = elemCell[faces.elem[f]], q = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))], d = faces.dir[f] >> 1, out = faces.dir[f] & 1;      // dir : −X, +X, −Y, +Y, −Z, +Z
    for (const pl of c.planes) if (pl.axis === d && (pl.keep > 0 ? !out && q[d] === pl.i : out && q[d] === pl.i - 1)) on[f] = 1; }
  c.onCut = on; return on;
}

/** One plane of symmetry at a time, for now : the first one stays, any other falls back to a plain cut (« libre »).
    → { cuts (a new list, or the same when nothing changed), dropped: [axis letters] } */
export function oneSymmetry(cuts) {
  let seen = false; const dropped = [], out = (cuts || []).map((c) => { if (!c || c.bc !== "sym") return c; if (!seen) { seen = true; return c; } dropped.push(AX[c.axis]); return { ...c, bc: "free" }; });
  return { cuts: dropped.length ? out : (cuts || []), dropped };
}
/** The plane of symmetry in use (the cut and its index), or null. */
export function symmetryOf(cuts) { const i = (cuts || []).findIndex((c) => c && c.bc === "sym"); return i < 0 ? null : { index: i, cut: cuts[i], name: `${AX[cuts[i].axis]} = ${Math.round(cuts[i].at * 100) / 100} mm`.replace(".", ",") }; }

/** The conditions the cut planes add to a load case. kind : "structure" | "thermal". → the case, completed. */
export function cutSetup(model, setup, kind) {
  if (!model.cut) return setup;
  const out = { ...setup }, region = (pl) => ({ plane: { axis: pl.axis, i: pl.i } });
  if (kind === "thermal") { const add = model.cut.planes.filter((pl) => pl.bc === "temp" && Number.isFinite(pl.T)).map((pl) => ({ region: region(pl), T: pl.T })); if (add.length) out.fixedT = [...(setup.fixedT || []), ...add]; return out; }
  const add = [];
  for (const pl of model.cut.planes) { if (pl.bc === "sym") add.push({ region: region(pl), dofs: [0, 1, 2].map((d) => d === pl.axis), cut: true }); else if (pl.bc === "fixed") add.push({ region: region(pl), cut: true }); }
  if (add.length) out.fixed = [...(setup.fixed || []), ...add];
  return out;
}

/** Is the load case the same on both sides of a plane ? Each support and each load must be its own mirror, or have a twin.
    regionOf(region) → { count, centroid, lo, hi } on the WHOLE model (regionInfo). entries : [{ what, region, vector (a force, or null) }] → { ok, notes } */
export function loadSymmetry(entries, plane, regionOf, h) {
  const notes = [], info = entries.map((e) => ({ ...e, r: regionOf(e.region) })), mirror = (c) => c.map((v, d) => (d === plane.axis ? 2 * plane.at - v : v)), near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 0.6 * h;
  for (const e of info) {
    if (!e.r || !e.r.count) continue;
    const mid = e.r.lo && e.r.hi ? (e.r.lo[plane.axis] + e.r.hi[plane.axis]) / 2 : e.r.centroid[plane.axis];      // its own mirror : the region reaches as far on one side as on the other
    const self = Math.abs(mid - plane.at) <= 0.26 * h && Math.abs(e.r.centroid[plane.axis] - plane.at) <= 0.6 * h, twin = info.find((o) => o !== e && o.what === e.what && o.r && o.r.count === e.r.count && near(o.r.centroid, mirror(e.r.centroid)));
    if (!self && !twin) notes.push(`${e.label || e.what} : rien ne lui répond de l'autre côté du plan ${AX[plane.axis]}.`);
    else if (self && e.vector && Math.abs(e.vector[plane.axis]) > 1e-9) notes.push(`${e.label || e.what} : l'effort pousse à travers le plan ${AX[plane.axis]} — le chargement est antisymétrique, pas symétrique.`);
    else if (!self && twin && e.vector && twin.vector && e.vector.some((v, d) => Math.abs((d === plane.axis ? -v : v) - twin.vector[d]) > 1e-6 * (1 + Math.abs(v)))) notes.push(`${e.label || e.what} : l'effort d'en face n'est pas son image.`);
  }
  return { ok: !notes.length, notes };
}
