/* DesignOrbit.ai — small 3D vector / frame / 4x4 matrix helpers (plain arrays, no dependency). */

export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  unit: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  neg: (a) => [-a[0], -a[1], -a[2]],
};

/* Faces of the part box, named by their outward normal. Each has a right-handed frame (u, v, n):
   2D positions on a face are given in MODEL coordinates of its plane (see `plane`), e.g. [x, y] on "+Z". */
export const FACES = {
  "+Z": { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], axis: 2, plane: [0, 1] },
  "-Z": { n: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0], axis: 2, plane: [0, 1] },
  "+Y": { n: [0, 1, 0], u: [-1, 0, 0], v: [0, 0, 1], axis: 1, plane: [0, 2] },
  "-Y": { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], axis: 1, plane: [0, 2] },
  "+X": { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], axis: 0, plane: [1, 2] },
  "-X": { n: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1], axis: 0, plane: [1, 2] },
};
export const FACE_ALIASES = { top: "+Z", bottom: "-Z", front: "-Y", back: "+Y", right: "+X", left: "-X",
  dessus: "+Z", dessous: "-Z", avant: "-Y", arriere: "+Y", droite: "+X", gauche: "-X" };
export function faceKey(name) {
  const k = FACE_ALIASES[String(name).toLowerCase()] || String(name).toUpperCase().replace(/\s+/g, "");
  if (!FACES[k]) throw new Error(`Face inconnue « ${name} ». Faces : +Z (top), -Z (bottom), +X (right), -X (left), +Y (back), -Y (front).`);
  return k;
}

/** 3D point of a face from its 2D model coordinates `p2` and the plane position `level` along the face axis. */
export function facePoint(face, p2, level) {
  const f = FACES[face], p = [0, 0, 0];
  p[f.plane[0]] = p2[0]; p[f.plane[1]] = p2[1]; p[f.axis] = level;
  return p;
}

/* Sketch planes: "XY" (extrudes along +Z), "XZ" (along +Y), "YZ" (along +X). Sketch (a, b) are the two model axes named. */
export const PLANES = {
  XY: { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], axis: 2 },
  XZ: { u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], axis: 1 },
  YZ: { u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], axis: 0 },
};

/** Frame {o, u, v, n} -> column-major 4x4 matrix (three.js layout) mapping frame coordinates to model coordinates. */
export function frameMatrix(f) {
  return [f.u[0], f.u[1], f.u[2], 0, f.v[0], f.v[1], f.v[2], 0, f.n[0], f.n[1], f.n[2], 0, f.o[0], f.o[1], f.o[2], 1];
}
export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function matMul(a, b) {   // column-major, returns a * b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
/** Inverse of a rigid transform (rotation + translation). */
export function matInvRigid(m) {
  const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
  o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
  o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  return o;
}
export function matPoint(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
export function matDir(m, d) {
  return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
}
export function matTranslate(t) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1]; }
export function matRotAxis(axis, deg) {
  const [x, y, z] = v3.unit(axis), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1];
}
/** Euler placement {t:[x,y,z], r:[rx,ry,rz] degrees, applied X then Y then Z} -> matrix. */
export function matFromPlacement(pl = {}) {
  const t = pl.t || [0, 0, 0], r = pl.r || [0, 0, 0];
  let m = matRotAxis([0, 0, 1], r[2] || 0);
  m = matMul(m, matRotAxis([0, 1, 0], r[1] || 0));
  m = matMul(m, matRotAxis([1, 0, 0], r[0] || 0));
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
export function matIsIdentity(m) { return m.every((x, i) => Math.abs(x - IDENTITY[i]) < 1e-12); }

/** Rotate a frame's in-plane axes about its normal by `deg`. */
export function rotateFrame(f, deg) {
  if (!deg) return f;
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { o: f.o, n: f.n, u: v3.add(v3.mul(f.u, c), v3.mul(f.v, s)), v: v3.add(v3.mul(f.u, -s), v3.mul(f.v, c)) };
}
export function bboxUnion(a, b) {
  if (!a) return b && b.slice();
  if (!b) return a.slice();
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])];
}
export function bboxTransform(bb, m) {
  let out = null;
  for (let i = 0; i < 8; i++) {
    const p = matPoint(m, [bb[i & 1 ? 3 : 0], bb[i & 2 ? 4 : 1], bb[i & 4 ? 5 : 2]]);
    out = bboxUnion(out, [p[0], p[1], p[2], p[0], p[1], p[2]]);
  }
  return out;
}
