/* DesignOrbit.ai — reading a solved mesh at a point : what an instrument put on the product would say there.
   A result is kept with what it takes to be read anywhere, afterwards, without solving again :
     probe = { meshes: [{ grid: { nx, ny, nz, h, origin }, elemCell, elems, elemBody, T?, u? }], planes: [{ axis, at, keep, bc }],
               bodies: [{ name, E, nu }], scale (how much the deformed shape is amplified in the view), kind }
   The meshes do not overlap : the fine cubes of each refinement zone first, then the model without them ; T is a temperature per
   node (or one number : a uniform temperature), u three displacements per node. A point is read in the cube that holds it —
   or in the nearest one, a little way off : the cubes follow the product, they are not the product — with the trilinear
   interpolation of its eight corners, the one the solver itself assumes inside a cube. A model reduced by a plane of symmetry
   answers for the half that was removed : the point is read at its mirror image. Pure : no page, no solver. */

import { CORNER_OFFSETS } from "./voxel.js";

/** What it takes to read a solved mesh anywhere : copies, free to leave the worker. fields : { T (per node, or a number), u (3 per node) } */
export function probeMesh(model, fields = {}) {
  const g = model.grid, T = fields.T;
  return { grid: { nx: g.nx, ny: g.ny, nz: g.nz, h: g.h, origin: Array.from(g.origin) }, elemCell: Int32Array.from(model.elemCell), elems: Int32Array.from(model.elems), elemBody: Int16Array.from(model.elemBody),
    ...(T !== undefined && T !== null ? { T: typeof T === "number" ? T : Float32Array.from(T) } : {}), ...(fields.u ? { u: Float32Array.from(fields.u) } : {}) };
}
/** The planes of a reduced model, as a probe keeps them. */
export const probePlanes = (model) => (model && model.cut ? model.cut.planes.map((p) => ({ axis: p.axis, at: p.at, keep: p.keep < 0 ? -1 : 1, bc: p.bc })) : []);
/** The buffers of a probe, to hand them over with the message that carries it. */
export const probeBuffers = (probe) => (probe ? probe.meshes.flatMap((m) => [m.elemCell, m.elems, m.elemBody, m.T, m.u]).filter((a) => a && a.buffer).map((a) => a.buffer) : []);

const lookup = new WeakMap();
/* cell of the grid → its element, or -1 : built once per mesh */
function cellElem(m) {
  let t = lookup.get(m);
  if (!t) { t = new Int32Array(m.grid.nx * m.grid.ny * m.grid.nz).fill(-1); for (let e = 0; e < m.elemCell.length; e++) t[m.elemCell[e]] = e; lookup.set(m, t); }
  return t;
}
/** The cube of a mesh that holds a point, or the nearest one within `reach` cubes. o : { reach = 2, body (index : the cubes of this body
    are preferred, when one of them is within a cube of the point) }
    → { e (element), t (where in the cube, 0 to 1 along X, Y, Z), dist (mm from the point to the cube : 0 inside) } or null */
export function locate(m, p, o = {}) {
  const { nx, ny, nz, h, origin } = m.grid, n = [nx, ny, nz], of = cellElem(m), reach = o.reach ?? 2, body = o.body ?? -1, q = [0, 1, 2].map((d) => Math.floor((p[d] - origin[d]) / h));
  let any = null, own = null;
  for (let dk = -reach; dk <= reach; dk++) for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) {
    const c = [q[0] + di, q[1] + dj, q[2] + dk]; if (c[0] < 0 || c[1] < 0 || c[2] < 0 || c[0] >= n[0] || c[1] >= n[1] || c[2] >= n[2]) continue;
    const e = of[c[0] + nx * (c[1] + ny * c[2])]; if (e < 0) continue;
    const t = [0, 0, 0]; let d2 = 0;
    for (let d = 0; d < 3; d++) { const a = (p[d] - origin[d]) / h - c[d], b = Math.min(1, Math.max(0, a)); t[d] = b; d2 += ((a - b) * h) ** 2; }
    if (!any || d2 < any.d2 - 1e-12) any = { e, t, d2 };
    if (body >= 0 && m.elemBody[e] === body && (!own || d2 < own.d2 - 1e-12)) own = { e, t, d2 };
  }
  const best = own && Math.sqrt(own.d2) <= h ? own : any;
  return best ? { e: best.e, t: best.t, dist: Math.sqrt(best.d2) } : null;
}
/* the weight of corner c at a place of the cube, and its slope along axis j (per mm) */
const weight = (t, c) => { const o = CORNER_OFFSETS[c]; return (o[0] ? t[0] : 1 - t[0]) * (o[1] ? t[1] : 1 - t[1]) * (o[2] ? t[2] : 1 - t[2]); };
const slope = (t, c, j, h) => { const o = CORNER_OFFSETS[c]; let w = (o[j] ? 1 : -1) / h; for (let k = 0; k < 3; k++) if (k !== j) w *= o[k] ? t[k] : 1 - t[k]; return w; };

/** A value per node, read at a place of a cube. field : one value per node, or a number (the same everywhere). */
export function scalarAt(m, field, at) {
  if (typeof field === "number") return field;
  let s = 0; for (let c = 0; c < 8; c++) s += weight(at.t, c) * field[m.elems[8 * at.e + c]];
  return s;
}
/** Three values per node (a displacement), read at a place of a cube. → [x, y, z] */
export function vectorAt(m, u, at) {
  const out = [0, 0, 0];
  for (let c = 0; c < 8; c++) { const w = weight(at.t, c), i = 3 * m.elems[8 * at.e + c]; out[0] += w * u[i]; out[1] += w * u[i + 1]; out[2] += w * u[i + 2]; }
  return out;
}
/** How a displacement changes around a place of a cube : G[i][j] = d u_i / d x_j (no unit : mm per mm). */
export function gradientAt(m, u, at) {
  const G = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], h = m.grid.h;
  for (let c = 0; c < 8; c++) { const i = 3 * m.elems[8 * at.e + c]; for (let j = 0; j < 3; j++) { const s = slope(at.t, c, j, h); G[0][j] += s * u[i]; G[1][j] += s * u[i + 1]; G[2][j] += s * u[i + 2]; } }
  return G;
}
/** The strain along a direction : how much a short line drawn along d (a unit vector) stretches, per unit of length. */
export const stretch = (G, d) => { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += d[i] * G[i][j] * d[j]; return s; };

/** Where a point of the product is read in a probe.
    → { m (the mesh), at (locate), p (the point read : its mirror image when it was on the removed side of a symmetry), flip ([±1, ±1, ±1] :
        a direction given at the point is read with these signs), mirrored, k (index of the mesh) }
      or { gone: "cut" (on the side a cut removed, where nothing was solved) | "mesh" (too far from any cube) } */
export function findIn(probe, p, o = {}) {
  const q = Array.from(p), flip = [1, 1, 1];
  for (const pl of probe.planes || []) {
    if ((q[pl.axis] - pl.at) * (pl.keep < 0 ? -1 : 1) >= -1e-6) continue;      // on the side that is kept, or on the plane
    if (pl.bc !== "sym") return { gone: "cut", plane: pl };
    q[pl.axis] = 2 * pl.at - q[pl.axis]; flip[pl.axis] = -1;
  }
  const body = o.body ? (probe.bodies || []).findIndex((b) => b.name === o.body) : -1; let best = null;
  probe.meshes.forEach((m, k) => { const at = locate(m, q, { reach: o.reach, body }); if (at && (!best || at.dist < best.at.dist - 1e-9)) best = { m, at, k }; });
  return best ? { ...best, p: q, flip, mirrored: flip.some((v) => v < 0) } : { gone: "mesh" };
}
/** The point of the product that the deformed shape shows at `shown` : the view draws every point moved by `scale` times its
    displacement, so a click on the result is brought back to where the product really is. → [x, y, z] */
export function undeform(probe, shown, scale = probe.scale || 0) {
  let q = Array.from(shown); if (!scale) return q;      // below : a long reach, the deformed shape may stand a few cubes off the product
  for (let n = 0; n < 6; n++) { const f = findIn(probe, q, { reach: 8 }); if (f.gone || !f.m.u) break; const u = vectorAt(f.m, f.m.u, f.at).map((v, d) => v * f.flip[d]); q = shown.map((v, d) => v - scale * u[d]); }
  return q;
}
