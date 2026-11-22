/* DesignOrbit.ai — a face of the meshed product, as the designer points at it : the connected set of exposed cell faces
   that look the same way as the one under the pointer. It reaches what the six outer sides cannot — the floor and the
   inner walls of a housing, the underside of a cover, a step, the bottom of a pocket. Neighbours are joined in their
   plane and across one layer of cells at most, so a drafted or gently sloped wall (a staircase on this mesh) stays one
   face, while the floor of a housing and the top of its rim do not merge. Pure : the solver, the hand calculation and the
   screen share it.   patch = { at: [x, y, z], dir: "+X" | "-X" | "+Y" | "-Y" | "-Z" | "+Z", step (default 1) } */

import { exposedFaces } from "./voxel.js";

export const DIR_KEYS = ["-X", "+X", "-Y", "+Y", "-Z", "+Z"];
const cache = new WeakMap(), r2 = (v) => Math.round(v * 100) / 100;

/* per model, per direction : the exposed faces as { f (index in exposedFaces), a, b (cell in the plane), n (grid plane of the face) }, and (a, b) → entries */
function index(model) {
  let ix = cache.get(model); if (ix) return ix;
  const faces = exposedFaces(model), { grid: { nx, ny }, elemCell } = model;
  ix = DIR_KEYS.map(() => ({ list: [], at: new Map() }));
  for (let f = 0; f < faces.count; f++) {
    const g = elemCell[faces.elem[f]], q = [g % nx, Math.floor(g / nx) % ny, Math.floor(g / (nx * ny))], d = faces.dir[f], axis = d >> 1, [a, b] = [0, 1, 2].filter((k) => k !== axis);
    const e = { f, a: q[a], b: q[b], n: q[axis] + (d & 1) }, key = e.a * 65536 + e.b, D = ix[d];
    D.list.push(e); if (D.at.has(key)) D.at.get(key).push(e); else D.at.set(key, [e]);
  }
  cache.set(model, ix); return ix;
}
/** Centre of an entry of direction d. */
function centre(model, d, e) {
  const { h, origin } = model.grid, axis = d >> 1, [a, b] = [0, 1, 2].filter((k) => k !== axis), p = [0, 0, 0];
  p[a] = origin[a] + (e.a + 0.5) * h; p[b] = origin[b] + (e.b + 0.5) * h; p[axis] = origin[axis] + e.n * h; return p;
}
const dirOf = (patch) => { const d = DIR_KEYS.indexOf(patch && patch.dir); if (d < 0) throw new Error(`Face pointée : direction inconnue « ${patch && patch.dir} » (+X, -X, +Y, -Y, +Z ou -Z).`); return d; };
/* the exposed face of that direction nearest to the point, when it is within `reach` cells */
function seed(model, d, at, reach = 2.5) {
  let best = null, bd = Infinity;
  for (const e of index(model)[d].list) { const c = centre(model, d, e), q = (c[0] - at[0]) ** 2 + (c[1] - at[1]) ** 2 + (c[2] - at[2]) ** 2; if (q < bd) { bd = q; best = e; } }
  return best && Math.sqrt(bd) <= reach * model.grid.h ? best : null;
}
function entries(model, patch) {
  const d = dirOf(patch), D = index(model)[d], s = seed(model, d, patch.at || [0, 0, 0]); if (!s) return [];
  const step = patch.step === 0 ? 0 : 1, seen = new Set([s.f]), out = [s], stack = [s];
  while (stack.length) {
    const e = stack.pop();
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const c of D.at.get((e.a + da) * 65536 + (e.b + db)) || []) if (!seen.has(c.f) && Math.abs(c.n - e.n) <= step) { seen.add(c.f); out.push(c); stack.push(c); }
  }
  return out.sort((x, y) => x.f - y.f);
}

/** Indices (into exposedFaces) of the faces of a patch, sorted ; empty when nothing of that direction is near the point. */
export function patchFaces(model, patch) { return entries(model, patch).map((e) => e.f); }
/** Sorted, unique ids of the nodes of a patch. */
export function patchNodes(model, patch) {
  const faces = exposedFaces(model), set = new Set();
  for (const f of patchFaces(model, patch)) for (let c = 0; c < 4; c++) set.add(faces.nodes[4 * f + c]);
  return Int32Array.from([...set].sort((a, b) => a - b));
}
/** What a patch is : { faces, area (mm²), centre, lo, hi, dir, level (coordinate of its plane ; null when it steps), outer (it lies on
    the outermost plane of the product on its side : the same place as the plain side `face`) } — null when it is empty. */
export function patchInfo(model, patch) {
  const d = dirOf(patch), list = entries(model, patch); if (!list.length) return null;
  const { h, origin } = model.grid, axis = d >> 1, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], sum = [0, 0, 0];
  let nMin = Infinity, nMax = -Infinity;
  for (const e of list) { const c = centre(model, d, e); for (let k = 0; k < 3; k++) { sum[k] += c[k]; const half = k === axis ? 0 : h / 2; lo[k] = Math.min(lo[k], c[k] - half); hi[k] = Math.max(hi[k], c[k] + half); } nMin = Math.min(nMin, e.n); nMax = Math.max(nMax, e.n); }
  let ext = d & 1 ? -Infinity : Infinity; for (const e of index(model)[d].list) ext = d & 1 ? Math.max(ext, e.n) : Math.min(ext, e.n);
  return { faces: list.length, area: list.length * h * h, centre: sum.map((v) => v / list.length), lo, hi, dir: DIR_KEYS[d], level: nMin === nMax ? r2(origin[axis] + nMin * h) : null,
    outer: nMin === nMax && nMin === ext };
}
/** The patch under a pick : { at, dir }, `at` being the centre of its first face — wherever the face is clicked, the same
    patch gives the same answer. normal : the outward normal of what was hit. → null when no exposed face is there. */
export function patchAt(model, point, normal) {
  if (!point || !normal) return null;
  const axis = [0, 1, 2].reduce((m, i) => (Math.abs(normal[i]) > Math.abs(normal[m]) ? i : m), 0); if (Math.abs(normal[axis]) < 0.7) return null;
  const d = 2 * axis + (normal[axis] > 0 ? 1 : 0), s = seed(model, d, point, 1.5); if (!s) return null;
  const list = entries(model, { at: centre(model, d, s), dir: DIR_KEYS[d] });
  return { at: centre(model, d, list[0]).map(r2), dir: DIR_KEYS[d] };
}
/** The name a patch travels under in a load case, and back. */
export const patchKey = (p) => `patch:${p.dir}:${p.at.map(r2).join(",")}`;
export function parsePatchKey(key) {
  const m = /^patch:([+-][XYZ]):(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/.exec(String(key)); return m ? { dir: m[1], at: [+m[2], +m[3], +m[4]] } : null;
}
/** Up to n points spread over a patch (the centres of faces far from one another) : where its symbols go. */
export function patchSpots(model, patch, n = 4) {
  const d = dirOf(patch), pts = entries(model, patch).map((e) => centre(model, d, e)); if (!pts.length) return [];
  const mid = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length), dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const out = [pts.reduce((b, p) => (dist(p, mid) < dist(b, mid) ? p : b))], far = pts.map((p) => dist(p, out[0]));
  while (out.length < Math.min(n, pts.length)) { let k = 0; for (let i = 1; i < pts.length; i++) if (far[i] > far[k]) k = i; if (far[k] <= 0) break; out.push(pts[k]); for (let i = 0; i < pts.length; i++) far[i] = Math.min(far[i], dist(pts[i], pts[k])); }
  return out;
}
/** One flag per triangle of the skin of the model (two per exposed face) : 1 on the patch. For the highlight of the view. */
export function patchFlags(model, patch) {
  const flags = new Uint8Array(2 * exposedFaces(model).count);
  for (const f of patchFaces(model, patch)) { flags[2 * f] = 1; flags[2 * f + 1] = 1; }
  return flags;
}
