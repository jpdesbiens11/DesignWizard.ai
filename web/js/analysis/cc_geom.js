/* DesignWizard.ai — mesh utilities of the isolation analysis (creepage & clearance).
   Pure computational geometry on indexed triangle meshes: no DOM, no Node API, no dependency (browser worker and Node).
   Conventions: V = Float64Array of x,y,z per vertex, I = Uint32Array of 3 vertex indices per triangle (outward CCW).
   Units are those of the meshes (mm). */

/** Weld the vertices of a mesh by position (OpenCascade duplicates the nodes between faces). Drops degenerate triangles. */
export function weldMesh(pos, idx, tol = 1e-5) {
  const q = 1 / (4 * tol), map = new Map(), remap = new Uint32Array(pos.length / 3), out = [], tri = [];
  for (let i = 0; i < remap.length; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2], key = Math.round(x * q) + "," + Math.round(y * q) + "," + Math.round(z * q);
    let id = map.get(key);
    if (id === undefined) { id = out.length / 3; map.set(key, id); out.push(x, y, z); }
    remap[i] = id;
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a !== b && b !== c && a !== c) tri.push(a, b, c);
  }
  return { V: new Float64Array(out), I: new Uint32Array(tri) };
}

/** Unit normals (3 per triangle) and areas. */
export function triNormals(V, I) {
  const nt = I.length / 3, N = new Float64Array(3 * nt), area = new Float64Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    N[3 * t] = nx / l; N[3 * t + 1] = ny / l; N[3 * t + 2] = nz / l; area[t] = l / 2;
  }
  return { N, area };
}

const put = (out, x, y, z, px, py, pz) => { out[0] = x; out[1] = y; out[2] = z; return (x - px) * (x - px) + (y - py) * (y - py) + (z - pz) * (z - pz); };

/** Closest point of triangle (a, b, c = offsets in V) to p; writes it in out, returns the squared distance (Ericson). */
export function closestOnTri(px, py, pz, V, a, b, c, out) {
  const ax = V[a], ay = V[a + 1], az = V[a + 2], bx = V[b], by = V[b + 1], bz = V[b + 2], cx = V[c], cy = V[c + 1], cz = V[c + 2];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return put(out, ax, ay, az, px, py, pz);
  const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return put(out, bx, by, bz, px, py, pz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return put(out, ax + v * abx, ay + v * aby, az + v * abz, px, py, pz); }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return put(out, cx, cy, cz, px, py, pz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return put(out, ax + w * acx, ay + w * acy, az + w * acz, px, py, pz); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); return put(out, bx + w * (cx - bx), by + w * (cy - by), bz + w * (cz - bz), px, py, pz); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return put(out, ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w, px, py, pz);
}

/** Closest points of segments [p1 q1] (offsets in V1) and [p2 q2] (offsets in V2); writes both in out[0..5], returns d². */
function segSeg(V1, p1, q1, V2, p2, q2, out) {
  const d1x = V1[q1] - V1[p1], d1y = V1[q1 + 1] - V1[p1 + 1], d1z = V1[q1 + 2] - V1[p1 + 2];
  const d2x = V2[q2] - V2[p2], d2y = V2[q2 + 1] - V2[p2 + 1], d2z = V2[q2 + 2] - V2[p2 + 2];
  const rx = V1[p1] - V2[p2], ry = V1[p1 + 1] - V2[p2 + 1], rz = V1[p1 + 2] - V2[p2 + 2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  const c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b, cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  let s = 0, t = 0;
  if (a > 1e-18 && e > 1e-18) {
    s = den > 1e-12 * a * e ? cl((b * f - c * e) / den) : 0; t = (b * s + f) / e;
    if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
  } else if (a > 1e-18) s = cl(-c / a); else if (e > 1e-18) t = cl(f / e);
  out[0] = V1[p1] + d1x * s; out[1] = V1[p1 + 1] + d1y * s; out[2] = V1[p1 + 2] + d1z * s;
  out[3] = V2[p2] + d2x * t; out[4] = V2[p2 + 1] + d2y * t; out[5] = V2[p2 + 2] + d2z * t;
  return (out[0] - out[3]) ** 2 + (out[1] - out[4]) ** 2 + (out[2] - out[5]) ** 2;
}

const T3 = new Float64Array(3), T6 = new Float64Array(6), R6 = new Float64Array(6);
const RAYS = [[0.5377, 0.2731, 0.7974], [-0.3519, 0.8412, -0.4107], [0.7071, -0.6123, 0.3536]];

/** Minimum distance between two triangles (vertex-face and edge-edge cases); closest points in out[0..5] (A then B). */
function triTri(VA, ta, VB, tb, out) {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    let d = closestOnTri(VA[ta[i]], VA[ta[i] + 1], VA[ta[i] + 2], VB, tb[0], tb[1], tb[2], T3);
    if (d < best) { best = d; out[0] = VA[ta[i]]; out[1] = VA[ta[i] + 1]; out[2] = VA[ta[i] + 2]; out[3] = T3[0]; out[4] = T3[1]; out[5] = T3[2]; }
    d = closestOnTri(VB[tb[i]], VB[tb[i] + 1], VB[tb[i] + 2], VA, ta[0], ta[1], ta[2], T3);
    if (d < best) { best = d; out[3] = VB[tb[i]]; out[4] = VB[tb[i] + 1]; out[5] = VB[tb[i] + 2]; out[0] = T3[0]; out[1] = T3[1]; out[2] = T3[2]; }
    for (let j = 0; j < 3; j++) {
      d = segSeg(VA, ta[i], ta[(i + 1) % 3], VB, tb[j], tb[(j + 1) % 3], T6);
      if (d < best) { best = d; out.set(T6); }
    }
  }
  return best;
}

/** Axis-aligned bounding-box tree over the triangles of one mesh (or of several bodies: triBody[t] = body index). */
export class BVH {
  constructor(V, I, triBody = null) {
    const nt = I.length / 3, order = new Uint32Array(nt), cen = new Float64Array(3 * nt), size = Math.max(1, 2 * nt);
    Object.assign(this, { V, I, triBody, nt, order, nb: new Float64Array(6 * size), nl: new Int32Array(size).fill(-1), ns: new Uint32Array(size), nc: new Uint32Array(size) });
    for (let t = 0; t < nt; t++) { order[t] = t; for (let k = 0; k < 3; k++) cen[3 * t + k] = (V[3 * I[3 * t] + k] + V[3 * I[3 * t + 1] + k] + V[3 * I[3 * t + 2] + k]) / 3; }
    let nn = 1;
    const build = (node, s, e) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], cl = [Infinity, Infinity, Infinity], ch = [-Infinity, -Infinity, -Infinity];
      for (let i = s; i < e; i++) {
        const t = order[i];
        for (let k = 0; k < 3; k++) {
          for (let j = 0; j < 3; j++) { const v = V[3 * I[3 * t + j] + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
          const c = cen[3 * t + k]; if (c < cl[k]) cl[k] = c; if (c > ch[k]) ch[k] = c;
        }
      }
      this.nb.set(lo, 6 * node); this.nb.set(hi, 6 * node + 3); this.ns[node] = s; this.nc[node] = e - s;
      if (e - s <= 4) return;
      const ex = ch[0] - cl[0], ey = ch[1] - cl[1], ez = ch[2] - cl[2], ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
      order.subarray(s, e).sort((p, q) => cen[3 * p + ax] - cen[3 * q + ax]);
      const m = (s + e) >> 1, l = nn; nn += 2; this.nl[node] = l; build(l, s, m); build(l + 1, m, e);
    };
    if (nt) build(0, 0, nt); else this.nb.fill(0);
  }

  /** Squared distance from a point to the box of a node. */
  boxD2(node, x, y, z) {
    const b = this.nb, o = 6 * node;
    const dx = x < b[o] ? b[o] - x : x > b[o + 3] ? x - b[o + 3] : 0, dy = y < b[o + 1] ? b[o + 1] - y : y > b[o + 4] ? y - b[o + 4] : 0, dz = z < b[o + 2] ? b[o + 2] - z : z > b[o + 5] ? z - b[o + 5] : 0;
    return dx * dx + dy * dy + dz * dz;
  }

  /** Closest surface point within maxDist: {d, point, tri, body} or null. filter(tri, x, y, z, d²) may reject candidates. */
  closestPoint(p, maxDist = Infinity, filter = null) {
    if (!this.nt) return null;
    const { V, I, order, nl, ns, nc } = this, px = p[0], py = p[1], pz = p[2], stack = [0];
    let best = maxDist * maxDist * (1 + 1e-12) + 1e-300, bt = -1, bx = 0, by = 0, bz = 0;
    while (stack.length) {
      const node = stack.pop();
      if (this.boxD2(node, px, py, pz) >= best) continue;
      const l = nl[node];
      if (l < 0) {
        for (let i = ns[node], e = i + nc[node]; i < e; i++) {
          const t = order[i], d = closestOnTri(px, py, pz, V, 3 * I[3 * t], 3 * I[3 * t + 1], 3 * I[3 * t + 2], T3);
          if (d < best && (!filter || filter(t, T3[0], T3[1], T3[2], d))) { best = d; bt = t; bx = T3[0]; by = T3[1]; bz = T3[2]; }
        }
      } else if (this.boxD2(l, px, py, pz) < this.boxD2(l + 1, px, py, pz)) stack.push(l + 1, l); else stack.push(l, l + 1);
    }
    return bt < 0 ? null : { d: Math.sqrt(best), point: [bx, by, bz], tri: bt, body: this.triBody ? this.triBody[bt] : 0 };
  }

  /** Does the ray a + t·d (0 ≤ t ≤ tmax) touch the box of a node? */
  rayBox(node, ax, ay, az, dx, dy, dz, tmax) {
    const b = this.nb, o = 6 * node, e = 1e-7;
    let t0 = 0, t1 = tmax;
    for (let k = 0; k < 3; k++) {
      const a = k === 0 ? ax : k === 1 ? ay : az, d = k === 0 ? dx : k === 1 ? dy : dz, lo = b[o + k] - e, hi = b[o + 3 + k] + e;
      if (Math.abs(d) < 1e-300) { if (a < lo || a > hi) return false; continue; }
      let u = (lo - a) / d, v = (hi - a) / d;
      if (u > v) { const w = u; u = v; v = w; }
      if (u > t0) t0 = u; if (v < t1) t1 = v;
      if (t0 > t1) return false;
    }
    return true;
  }

  /** Visits the triangles crossed by the ray a + t·d for t in [t0, t1]; visit(t, tri) returns true to stop. */
  castRay(ax, ay, az, dx, dy, dz, t0, t1, tol, visit) {
    if (!this.nt) return false;
    const { V, I, order, nl, ns, nc } = this, stack = [0], len = Math.hypot(dx, dy, dz);
    while (stack.length) {
      const node = stack.pop();
      if (!this.rayBox(node, ax, ay, az, dx, dy, dz, t1)) continue;
      const l = nl[node];
      if (l >= 0) { stack.push(l, l + 1); continue; }
      for (let i = ns[node], e = i + nc[node]; i < e; i++) {
        const t = order[i], a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
        const e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2], e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
        const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x, det = e1x * hx + e1y * hy + e1z * hz;
        if (Math.abs(det) < 1e-9 * len * Math.hypot(e1x, e1y, e1z) * Math.hypot(e2x, e2y, e2z)) continue;   // parallel: grazing is not a hit
        const f = 1 / det, sx = ax - V[a], sy = ay - V[a + 1], sz = az - V[a + 2], u = f * (sx * hx + sy * hy + sz * hz);
        if (u < -tol || u > 1 + tol) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (dx * qx + dy * qy + dz * qz);
        if (v < -tol || u + v > 1 + tol) continue;
        const tt = f * (e2x * qx + e2y * qy + e2z * qz);
        if (tt >= t0 && tt <= t1 && visit(tt, t)) return true;
      }
    }
    return false;
  }

  /** Does the segment [a b] touch a triangle? Hits closer than ignoreEndsEps to an end are ignored; segments lying in the
      plane of a triangle (grazing) do not count. opts.first: returns the first hit {t, point, tri, body} or null.
      opts.collect: array that receives the parameter t of every hit. */
  segmentHits(a, b, opts = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (len < 1e-12) return opts.first ? null : false;
    const t0 = (opts.ignoreEndsEps || 0) / len;
    if (t0 >= 0.5) return opts.first ? null : false;
    let bt = Infinity, btri = -1, any = false;
    this.castRay(a[0], a[1], a[2], dx, dy, dz, t0, 1 - t0, opts.tol ?? 1e-9, (t, tri) => {
      any = true;
      if (opts.collect) { opts.collect.push(t); return false; }
      if (!opts.first) return true;
      if (t < bt) { bt = t; btri = tri; }
      return false;
    });
    if (!opts.first) return any;
    return btri < 0 ? null : { t: bt, point: [a[0] + dx * bt, a[1] + dy * bt, a[2] + dz * bt], tri: btri, body: this.triBody ? this.triBody[btri] : 0 };
  }

  /** Is p inside the watertight solid of this tree? (ray parity, 2 rays + a third one when they disagree) */
  pointInSolid(p) {
    const b = this.nb;
    if (!this.nt || p[0] < b[0] || p[0] > b[3] || p[1] < b[1] || p[1] > b[4] || p[2] < b[2] || p[2] > b[5]) return false;
    const odd = (r) => { let n = 0; this.castRay(p[0], p[1], p[2], r[0], r[1], r[2], 1e-9, Infinity, 0, () => { n++; return false; }); return n & 1; };
    const o0 = odd(RAYS[0]);
    return (o0 === odd(RAYS[1]) ? o0 : odd(RAYS[2])) === 1;
  }
}

const boxBoxD2 = (A, na, B, nb) => {
  const a = A.nb, b = B.nb, i = 6 * na, j = 6 * nb; let s = 0;
  for (let k = 0; k < 3; k++) { const d = a[i + k] > b[j + 3 + k] ? a[i + k] - b[j + 3 + k] : b[j + k] > a[i + 3 + k] ? b[j + k] - a[i + 3 + k] : 0; s += d * d; }
  return s;
};

/** Minimum distance between the meshes of two trees, with its closest points: {d, a, b, triA, triB}, or null beyond maxDist. */
export function meshDistance(A, B, maxDist = Infinity) {
  if (!A.nt || !B.nt) return null;
  let best = maxDist * maxDist * (1 + 1e-12) + 1e-300, ta = -1, tb = -1;
  const ia = [0, 0, 0], ib = [0, 0, 0], q0 = B.closestPoint([A.V[3 * A.I[0]], A.V[3 * A.I[0] + 1], A.V[3 * A.I[0] + 2]]), q1 = A.closestPoint(q0.point), q2 = B.closestPoint(q1.point);
  if (q2.d * q2.d < best) { best = q2.d * q2.d * (1 + 1e-12) + 1e-300; ta = q1.tri; tb = q2.tri; R6.set(q1.point); R6.set(q2.point, 3); }
  const rec = (na, nb) => {
    if (boxBoxD2(A, na, B, nb) >= best) return;
    const la = A.nl[na], lb = B.nl[nb];
    if (la < 0 && lb < 0) {
      for (let i = A.ns[na], ea = i + A.nc[na]; i < ea; i++) {
        const t = A.order[i]; ia[0] = 3 * A.I[3 * t]; ia[1] = 3 * A.I[3 * t + 1]; ia[2] = 3 * A.I[3 * t + 2];
        for (let j = B.ns[nb], eb = j + B.nc[nb]; j < eb; j++) {
          const u = B.order[j]; ib[0] = 3 * B.I[3 * u]; ib[1] = 3 * B.I[3 * u + 1]; ib[2] = 3 * B.I[3 * u + 2];
          const d = triTri(A.V, ia, B.V, ib, T6s);
          if (d < best) { best = d; ta = t; tb = u; R6.set(T6s); }
        }
      }
    } else if (lb < 0 || (la >= 0 && A.nc[na] >= B.nc[nb])) {
      if (boxBoxD2(A, la, B, nb) < boxBoxD2(A, la + 1, B, nb)) { rec(la, nb); rec(la + 1, nb); } else { rec(la + 1, nb); rec(la, nb); }
    } else if (boxBoxD2(A, na, B, lb) < boxBoxD2(A, na, B, lb + 1)) { rec(na, lb); rec(na, lb + 1); } else { rec(na, lb + 1); rec(na, lb); }
  };
  rec(0, 0);
  return ta < 0 ? null : { d: Math.sqrt(Math.max(0, (R6[0] - R6[3]) ** 2 + (R6[1] - R6[4]) ** 2 + (R6[2] - R6[5]) ** 2)), a: [R6[0], R6[1], R6[2]], b: [R6[3], R6[4], R6[5]], triA: ta, triB: tb };
}
const T6s = new Float64Array(6);

/** Is p strictly inside one of the solids? bodies: [{bvh}] (watertight meshes). */
export function insideAny(bodies, p, skip = -1) {
  for (let i = 0; i < bodies.length; i++) if (i !== skip && bodies[i].bvh.pointInSolid(p)) return true;
  return false;
}

/** Robust test for a segment whose ends may lie on surfaces: is a part of [a b] out of the air?
    The hits cut the segment in intervals; an interval is blocked when its middle is strictly inside a solid, or lies on
    a surface with solid on both sides (the zero-gap interface of two parts in contact; not tested when joints = false).
    Grazing a face is not blocked. */
export function segmentBlocked(solids, bodies, a, b, joints = true, tol = 1e-4) {
  const ts = [0, 1], V = solids.V, I = solids.I;
  solids.segmentHits(a, b, { collect: ts, tol: 1e-6 });
  ts.sort((x, y) => x - y);
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] - ts[i - 1] < 1e-9) continue;
    const m = (ts[i] + ts[i - 1]) / 2, p = [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m], q = solids.closestPoint(p, tol);
    if (!q) { if (ts.length > 2 && insideAny(bodies, p)) return true; continue; }
    if (!joints) continue;
    const u = 3 * I[3 * q.tri], v = 3 * I[3 * q.tri + 1], w = 3 * I[3 * q.tri + 2];
    const e1 = [V[v] - V[u], V[v + 1] - V[u + 1], V[v + 2] - V[u + 2]], e2 = [V[w] - V[u], V[w + 1] - V[u + 1], V[w + 2] - V[u + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], k = 20 * tol / (Math.hypot(n[0], n[1], n[2]) || 1);
    if (insideAny(bodies, [p[0] + k * n[0], p[1] + k * n[1], p[2] + k * n[2]]) && insideAny(bodies, [p[0] - k * n[0], p[1] - k * n[1], p[2] - k * n[2]])) return true;
  }
  return false;
}

/** Convex sharp edges of a welded mesh (candidate bend lines of a taut string): [{a, b, o:[x,y,z]}] with a, b vertex
    indices and o the outward offset direction, scaled so that a point at o·ε is ε clear of both faces. */
export function sharpEdges(V, I, N, minAngleDeg = 3) {
  const nv = V.length / 3, map = new Map(), out = [], cosMin = Math.cos(minAngleDeg * Math.PI / 180);
  for (let t = 0; t < I.length / 3; t++) for (let j = 0; j < 3; j++) {
    const a = I[3 * t + j], b = I[3 * t + (j + 1) % 3], key = a < b ? a * nv + b : b * nv + a, e = map.get(key);
    if (e) e.t.push(t); else map.set(key, { a, b, t: [t] });
  }
  for (const e of map.values()) {
    const t1 = 3 * e.t[0], t2 = 3 * (e.t.length > 1 ? e.t[1] : e.t[0]);
    const n1x = N[t1], n1y = N[t1 + 1], n1z = N[t1 + 2], n2x = N[t2], n2y = N[t2 + 1], n2z = N[t2 + 2], cos = n1x * n2x + n1y * n2y + n1z * n2z;
    if (e.t.length === 2) {
      if (cos > cosMin) continue;                                                                       // flat
      const ex = V[3 * e.b] - V[3 * e.a], ey = V[3 * e.b + 1] - V[3 * e.a + 1], ez = V[3 * e.b + 2] - V[3 * e.a + 2];
      if ((n1y * n2z - n1z * n2y) * ex + (n1z * n2x - n1x * n2z) * ey + (n1x * n2y - n1y * n2x) * ez <= 0) continue;   // concave
    }
    const sx = n1x + n2x, sy = n1y + n2y, sz = n1z + n2z, l = Math.hypot(sx, sy, sz);
    if (l < 1e-9) continue;
    const k = Math.min(4, 1 / Math.sqrt(Math.max(1e-9, (1 + cos) / 2))) / l;
    out.push({ a: e.a, b: e.b, o: [sx * k, sy * k, sz * k] });
  }
  return out;
}

/** Conforming refinement: every edge longer than hmax is bisected (repeatedly). Returns {V, I}. */
export function subdivide(V, I, hmax) {
  const P = Array.from(V); let T = Array.from(I);
  for (let pass = 0; pass < 24; pass++) {
    const mids = new Map(), nv0 = P.length / 3, out = [];
    const mid = (a, b) => {
      const dx = P[3 * a] - P[3 * b], dy = P[3 * a + 1] - P[3 * b + 1], dz = P[3 * a + 2] - P[3 * b + 2];
      if (dx * dx + dy * dy + dz * dz <= hmax * hmax) return -1;
      const key = a < b ? a * nv0 + b : b * nv0 + a; let m = mids.get(key);
      if (m === undefined) { m = P.length / 3; P.push((P[3 * a] + P[3 * b]) / 2, (P[3 * a + 1] + P[3 * b + 1]) / 2, (P[3 * a + 2] + P[3 * b + 2]) / 2); mids.set(key, m); }
      return m;
    };
    const d2 = (a, b) => (P[3 * a] - P[3 * b]) ** 2 + (P[3 * a + 1] - P[3 * b + 1]) ** 2 + (P[3 * a + 2] - P[3 * b + 2]) ** 2;
    for (let t = 0; t < T.length; t += 3) {
      let a = T[t], b = T[t + 1], c = T[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      const n = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (n === 0) { out.push(a, b, c); continue; }
      if (n === 3) { out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); continue; }
      // rotate so that the first split edge is ab (n = 1), or the split edges are ab and bc (n = 2)
      while (n === 1 ? ab < 0 : ab < 0 || bc < 0) { const v = a, m = ab; a = b; b = c; c = v; ab = bc; bc = ca; ca = m; }
      if (n === 1) out.push(a, ab, c, ab, b, c);
      else { out.push(ab, b, bc); if (d2(a, bc) < d2(ab, c)) out.push(a, ab, bc, a, bc, c); else out.push(a, ab, c, ab, bc, c); }
    }
    T = out;
    if (!mids.size) break;
  }
  return { V: new Float64Array(P), I: new Uint32Array(T) };
}
