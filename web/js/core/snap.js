/* DesignWizard.ai — assisted positioning : where a feature lands when the mouse lets it go on a flat face, and where the
   second point of a measure goes when its line is nearly parallel to an axis. No number to type : the symmetry axis of the
   face catches the feature first, then the line of a feature already there, then a 5 mm grid ; each of the two directions
   of the face is caught on its own. What is caught is told, so that the screen can draw the centre line, the alignment and
   the dimensions before the drop. The designer can switch each catch off, and type the values afterwards. Pure : no DOM. */

export const SNAP_DEFAULT = { grid: 5, tol: 1.5, axes: true, align: true, gridOn: true, direction: true, angle: 6 };
const r2 = (x) => Math.round(x * 100) / 100, clamp = (x, [a, b]) => Math.max(a, Math.min(b, x));

/** One direction of the face : the middle of the face, else the line of another feature, else the grid. */
function catchOne(x, range, others, o) {
  const [a, b] = range, mid = (a + b) / 2;
  if (o.axes && Math.abs(x - mid) <= o.tol) return { at: r2(mid), kind: "axis", ref: null };
  if (o.align) { let best = null; for (const q of others) { const d = Math.abs(x - q.at); if (d <= o.tol * 0.8 && (!best || d < best.d)) best = { ...q, d }; } if (best) return { at: r2(best.at), kind: "align", ref: best.id }; }
  if (o.gridOn && o.grid > 0) { const g = a + Math.round((x - a) / o.grid) * o.grid; if (g >= a - 1e-9 && g <= b + 1e-9) return { at: r2(g), kind: "grid", ref: null }; }
  return { at: r2(x), kind: null, ref: null };
}
/** Where a point lands on a face. p : [u, v] under the mouse. face : { u: [u0, u1], v: [v0, v1] (the edges of the face),
    keep: { u: [a, b], v: [c, d] } (where the feature may sit ; default the whole face), others: [{ id, u, v }] }.
    opts : SNAP_DEFAULT fields ; free : true to catch nothing (Alt held).
    → { u, v, snap: { u: { kind: "axis" | "align" | "grid" | "limit" | null, ref }, v: { … } }, dims: { u0, u1, v0, v1 } (to the four edges) } */
export function snapPoint(p, face, opts = {}) {
  const o = { ...SNAP_DEFAULT, ...opts }, off = { ...o, axes: false, align: false, gridOn: false }, use = opts.free ? off : o, others = face.others || [], keep = face.keep || { u: face.u, v: face.v };
  const one = (x, range, key, lim) => { const c = catchOne(x, range, others.map((q) => ({ id: q.id, at: q[key] })), use), k = clamp(c.at, lim); return Math.abs(k - c.at) > 1e-9 ? { at: r2(k), kind: "limit", ref: null } : c; };
  const cu = one(p[0], face.u, "u", keep.u), cv = one(p[1], face.v, "v", keep.v);
  return { u: cu.at, v: cv.at, snap: { u: { kind: cu.kind, ref: cu.ref }, v: { kind: cv.kind, ref: cv.ref } }, dims: { u0: r2(cu.at - face.u[0]), u1: r2(face.u[1] - cu.at), v0: r2(cv.at - face.v[0]), v1: r2(face.v[1] - cv.at) } };
}
/** What to draw for a caught point, in the coordinates of the face : the lines of the grid, the centre lines and the alignments that
    caught it, and the two dimensions to the nearer edges. → { grid: { u: [values], v: [values] }, lines: [{ kind, along: "u" | "v", at, ref }],
    dims: [{ along, from: [u, v], to: [u, v], value }] } — a line « along u » runs in the u direction, at a constant v. */
export function snapGuides(s, face, opts = {}) {
  const o = { ...SNAP_DEFAULT, ...opts }, ticks = ([a, b]) => { const out = []; if (!(o.gridOn && o.grid > 0)) return out; for (let x = a; x <= b + 1e-9 && out.length < 400; x += o.grid) out.push(r2(x)); return out; };
  const lines = [];
  if (s.snap.u.kind === "axis" || s.snap.u.kind === "align") lines.push({ kind: s.snap.u.kind, along: "v", at: s.u, ref: s.snap.u.ref });
  if (s.snap.v.kind === "axis" || s.snap.v.kind === "align") lines.push({ kind: s.snap.v.kind, along: "u", at: s.v, ref: s.snap.v.ref });
  const nu = s.dims.u0 <= s.dims.u1 ? [face.u[0], s.dims.u0] : [face.u[1], s.dims.u1], nv = s.dims.v0 <= s.dims.v1 ? [face.v[0], s.dims.v0] : [face.v[1], s.dims.v1];
  return { grid: { u: ticks(face.u), v: ticks(face.v) }, lines, dims: [{ along: "u", from: [nu[0], s.v], to: [s.u, s.v], value: nu[1] }, { along: "v", from: [s.u, nv[0]], to: [s.u, s.v], value: nv[1] }] };
}
/** The words of what caught a point, for the window of coordinates. names : { u, v } — what the two directions are called. */
export function snapWords(s, names = { u: "X", v: "Y" }) {
  const say = (c, name) => (c.kind === "axis" ? `${name} : sur l'axe de symétrie` : c.kind === "align" ? `${name} : aligné sur ${c.ref}` : c.kind === "limit" ? `${name} : en limite` : "");
  return [say(s.snap.u, names.u), say(s.snap.v, names.v)].filter(Boolean);
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
/** The second point of a line, caught when the line is nearly parallel to a reference direction (so, perpendicular to the others of
    an orthogonal set). a, b : points [x, y, z] ; refs : [{ name, dir: [x, y, z] }] (default the three axes of the model).
    → { point (b, or b brought onto the reference line through a), ref (its name) | null, angle (degrees off the nearest reference) } */
export function snapDirection(a, b, refs = AXES, tolDeg = SNAP_DEFAULT.angle) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = len(d);
  if (L < 1e-9) return { point: b.slice(), ref: null, angle: 0 };
  let best = null;
  for (const r of refs) { const n = len(r.dir) || 1, u = r.dir.map((x) => x / n), c = dot(d, u), ang = Math.acos(Math.min(1, Math.abs(c) / L)) * 180 / Math.PI; if (!best || ang < best.angle) best = { name: r.name, u, c, angle: ang }; }
  if (!best || best.angle > tolDeg) return { point: b.slice(), ref: null, angle: best ? r2(best.angle) : 0 };
  return { point: [a[0] + best.u[0] * best.c, a[1] + best.u[1] * best.c, a[2] + best.u[2] * best.c], ref: best.name, angle: r2(best.angle) };
}
export const AXES = [{ name: "X", dir: [1, 0, 0] }, { name: "Y", dir: [0, 1, 0] }, { name: "Z", dir: [0, 0, 1] }];
