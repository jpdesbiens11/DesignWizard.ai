/* DesignOrbit.ai — the real geometry as the place of a condition. The mesh is cubes ; a support or a load is set on the product
   itself : one of its faces (plane, cylindrical, sloped, inside a housing…), one of its edges, one of its points. This finds what of
   the mesh carries it :
     a face  { tris }  — the triangles of the face (9 numbers each, outward winding) → the exposed faces of the cubes that lie on it
                         (within 0.8 cube of it, and looking the same way), and their nodes ;
     an edge { path }  — its line, as points → the surface nodes along it ;
     a point           — { near: p, r: 0 } of index.js : the nearest node.
   It also reads the walls of a product along an axis (how many, how thick) for the refinement zones. Pure. Units : mm. */

import { exposedFaces, FACE_DIRS } from "./voxel.js";
import { cutFaces } from "./symmetry.js";

const REACH = 0.8;      // a face of a cube belongs to a face of the product when its centre is within this many cubes of it

/** Distance from point p to the triangle at offset o of t (closest point on the triangle : Ericson, Real-Time Collision Detection). */
function triDistance(px, py, pz, t, o) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2], abx = t[o + 3] - ax, aby = t[o + 4] - ay, abz = t[o + 5] - az, acx = t[o + 6] - ax, acy = t[o + 7] - ay, acz = t[o + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v;      // the closest point is a + u ab + v ac
  if (d1 <= 0 && d2 <= 0) { u = 0; v = 0; }
  else {
    const bpx = apx - abx, bpy = apy - aby, bpz = apz - abz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 1; v = 0; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { u = d1 / (d1 - d3); v = 0; }
      else {
        const cpx = apx - acx, cpy = apy - acy, cpz = apz - acz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 1; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { u = 0; v = d2 / (d2 - d6); }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { v = (d4 - d3) / (d4 - d3 + d5 - d6); u = 1 - v; }
            else { const den = 1 / (va + vb + vc); u = vb * den; v = vc * den; }
          }
        }
      }
    }
  }
  return Math.hypot(apx - u * abx - v * acx, apy - u * aby - v * acy, apz - u * abz - v * acz);
}

const cache = new WeakMap();
/** What of the mesh carries a face of the product. region : { tris } → { nodes (sorted), faces (exposed faces of the mesh that are
    surfaces of the product) }. The answer is kept for the region object : the screen asks again at every redraw. */
export function trisRegion(model, region) {
  let per = cache.get(model); if (!per) cache.set(model, per = new WeakMap());
  const known = per.get(region); if (known) return known;
  const t = region.tris, nT = Math.floor(t.length / 9), h = model.grid.h, reach = REACH * h, faces = exposedFaces(model), cut = cutFaces(model, faces), { nodes } = model;
  const N = new Float32Array(3 * nT), B = new Float32Array(6 * nT), all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let k = 0; k < nT; k++) {
    const o = 9 * k, ux = t[o + 3] - t[o], uy = t[o + 4] - t[o + 1], uz = t[o + 5] - t[o + 2], vx = t[o + 6] - t[o], vy = t[o + 7] - t[o + 1], vz = t[o + 8] - t[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; N[3 * k] = nx / l; N[3 * k + 1] = ny / l; N[3 * k + 2] = nz / l;
    for (let d = 0; d < 3; d++) { const lo = Math.min(t[o + d], t[o + 3 + d], t[o + 6 + d]) - reach, hi = Math.max(t[o + d], t[o + 3 + d], t[o + 6 + d]) + reach; B[6 * k + d] = lo; B[6 * k + 3 + d] = hi; if (lo < all[d]) all[d] = lo; if (hi > all[d + 3]) all[d + 3] = hi; }
  }
  const mark = new Uint8Array(model.nNodes), list = [];
  for (let f = 0; f < faces.count && nT; f++) {
    if (cut && cut[f]) continue;
    const q = 4 * f, a = faces.nodes[q], b = faces.nodes[q + 1], c = faces.nodes[q + 2], e = faces.nodes[q + 3];
    const x = (nodes[3 * a] + nodes[3 * b] + nodes[3 * c] + nodes[3 * e]) / 4, y = (nodes[3 * a + 1] + nodes[3 * b + 1] + nodes[3 * c + 1] + nodes[3 * e + 1]) / 4, z = (nodes[3 * a + 2] + nodes[3 * b + 2] + nodes[3 * c + 2] + nodes[3 * e + 2]) / 4;
    if (x < all[0] || y < all[1] || z < all[2] || x > all[3] || y > all[4] || z > all[5]) continue;
    const dir = FACE_DIRS[faces.dir[f]]; let on = false;
    for (let k = 0; k < nT && !on; k++) {
      if (N[3 * k] * dir[0] + N[3 * k + 1] * dir[1] + N[3 * k + 2] * dir[2] < 0.2) continue;      // looking the same way : the other side of a thin wall is another face
      const o = 6 * k; if (x < B[o] || y < B[o + 1] || z < B[o + 2] || x > B[o + 3] || y > B[o + 4] || z > B[o + 5]) continue;
      if (triDistance(x, y, z, t, 9 * k) <= reach) on = true;
    }
    if (on) { list.push(f); mark[a] = mark[b] = mark[c] = mark[e] = 1; }
  }
  const picked = []; for (let i = 0; i < model.nNodes; i++) if (mark[i]) picked.push(i);
  const out = { nodes: Int32Array.from(picked), faces: list };
  per.set(region, out); return out;
}

const skinCache = new WeakMap();
/** The nodes that lie on a surface of the product (1), per node. */
function surfaceNodes(model) {
  let m = skinCache.get(model); if (m) return m;
  const faces = exposedFaces(model), cut = cutFaces(model, faces); m = new Uint8Array(model.nNodes);
  for (let f = 0; f < faces.count; f++) if (!cut || !cut[f]) for (let c = 0; c < 4; c++) m[faces.nodes[4 * f + c]] = 1;
  skinCache.set(model, m); return m;
}
/** The node nearest to a point, among those `mask` allows (all, without it), within `reach` grid steps around it ; -1 when there is none. */
export function nearestNode(model, p, mask, reach = 2) {
  const { grid: { nx, ny, nz, h, origin }, nodeGrid, nodes } = model, nxn = nx + 1, nyn = ny + 1, c = [0, 1, 2].map((d) => Math.round((p[d] - origin[d]) / h));
  let best = -1, bd = Infinity;
  for (let k = Math.max(0, c[2] - reach); k <= Math.min(nz, c[2] + reach); k++) for (let j = Math.max(0, c[1] - reach); j <= Math.min(ny, c[1] + reach); j++) for (let i = Math.max(0, c[0] - reach); i <= Math.min(nx, c[0] + reach); i++) {
    const id = nodeGrid[i + nxn * (j + nyn * k)]; if (id < 0 || (mask && !mask[id])) continue;
    const d = (nodes[3 * id] - p[0]) ** 2 + (nodes[3 * id + 1] - p[1]) ** 2 + (nodes[3 * id + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = id; }
  }
  return best;
}
/** The nodes that carry an edge of the product : along its line (path : [[x, y, z], …]), the surface node nearest to it every half cube.
    → sorted ids ; empty when the line is nowhere near the mesh */
export function pathNodes(model, path) {
  const h = model.grid.h, surf = surfaceNodes(model), out = new Set(), take = (p) => { let i = nearestNode(model, p, surf); if (i < 0) i = nearestNode(model, p, null); if (i >= 0) out.add(i); };
  if (path.length === 1) take(path[0]);
  for (let s = 0; s + 1 < path.length; s++) { const a = path[s], b = path[s + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (h / 2))); for (let k = s ? 1 : 0; k <= n; k++) take([0, 1, 2].map((d) => a[d] + (b[d] - a[d]) * k / n)); }
  return Int32Array.from([...out].sort((p, q) => p - q));
}

/** The walls a volume meets along an axis : the stretches where some cube of the product lies in its cross-section. inside(u, v) says
    whether a point of the plane square to the axis is in that section (u, v : the two other axes, in increasing order).
    → [{ lo, hi }] in mm, from the low end of the grid to the high one */
export function wallRuns(model, axis, inside) {
  const { grid: { nx, ny, nz, h, origin }, cells } = model, n = [nx, ny, nz], [u, v] = [0, 1, 2].filter((d) => d !== axis), step = [1, nx, nx * ny], cols = [];
  for (let j = 0; j < n[v]; j++) for (let i = 0; i < n[u]; i++) if (inside(origin[u] + (i + 0.5) * h, origin[v] + (j + 0.5) * h)) cols.push(i * step[u] + j * step[v]);
  const runs = []; let open = null;
  for (let k = 0; k < n[axis]; k++) {
    const solid = cols.some((c) => cells[c + k * step[axis]] >= 0);
    if (solid && !open) open = { lo: origin[axis] + k * h, hi: 0 };
    if (open && (!solid || k === n[axis] - 1)) { open.hi = origin[axis] + (solid ? k + 1 : k) * h; runs.push(open); open = null; }
  }
  return runs;
}
/** The walls of the product a refinement zone crosses : those its length reaches, among those its cross-section meets. → [{ lo, hi }] */
export function zoneWalls(model, z) {
  const [u, v] = [0, 1, 2].filter((d) => d !== z.axis), r = z.size / 2 + 0.4999 * model.grid.h, a = z.at[z.axis] - z.length / 2, b = z.at[z.axis] + z.length / 2;
  const inside = (pu, pv) => (z.shape === "prism" ? Math.abs(pu - z.at[u]) <= r && Math.abs(pv - z.at[v]) <= r : (pu - z.at[u]) ** 2 + (pv - z.at[v]) ** 2 <= r * r);
  return wallRuns(model, z.axis, inside).filter((w) => w.hi > a + 1e-9 && w.lo < b - 1e-9);
}
/** A zone fitted to ONE wall : the wall of the product nearest to its centre, among those its cross-section meets — the zone is centred
    in it and as long as it is thick, plus half a cube on each side. → { at, length, wall } or null when its section meets no wall */
export function fitToWall(model, z) {
  const walls = zoneWalls(model, { ...z, length: Infinity }), c = z.at[z.axis]; if (!walls.length) return null;
  const gap = (w) => (c < w.lo ? w.lo - c : c > w.hi ? c - w.hi : 0), wall = walls.reduce((m, w) => (gap(w) < gap(m) ? w : m)), at = z.at.slice(); at[z.axis] = (wall.lo + wall.hi) / 2;
  return { at, length: wall.hi - wall.lo + model.grid.h, wall };
}
