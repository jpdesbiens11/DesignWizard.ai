/* DesignWizard.ai — clearance: the shortest path through air between the conductors of two nets ("the taut string").
   1. minimum distance between the two meshes; if the straight segment crosses no solid, it is the clearance (direct);
   2. otherwise a visibility graph: candidate bend points sampled on the convex sharp edges of every solid, moved a hair
      (scene.eps) outward so that segments graze instead of touching; the two nets are virtual nodes reached by the
      closest-point segment of a bend point; floating conductors are virtual nodes crossed for free (d1 + d2);
      A* with lazy visibility tests, bounded by the cap;
   3. tightening: every bend point slides along its edge until the polyline is the taut string. */

import { meshDistance, segmentBlocked, sharpEdges, insideAny, triNormals } from "./cc_geom.js";

const MAX_NODES = 9000;

/** Tiny binary heap of (key, id). */
export class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = [k[0], v[0]], key = k.pop(), val = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = key; v[i] = val;
    }
    return top;
  }
}

/** Sharp convex edges of all the solids: 10 numbers per edge (origin, direction, offset direction, length). */
function sceneEdges(scene) {
  if (scene.cache.edges) return scene.cache.edges;
  const E = [];
  for (const b of scene.bodies) for (const e of sharpEdges(b.V, b.I, b.N)) {
    const a = 3 * e.a, c = 3 * e.b, dx = b.V[c] - b.V[a], dy = b.V[c + 1] - b.V[a + 1], dz = b.V[c + 2] - b.V[a + 2];
    E.push(b.V[a], b.V[a + 1], b.V[a + 2], dx, dy, dz, e.o[0], e.o[1], e.o[2], Math.hypot(dx, dy, dz));
  }
  return (scene.cache.edges = new Float64Array(E));
}

const edgePoint = (E, eps, e, t, out = [0, 0, 0]) => {
  const o = 10 * e; out[0] = E[o] + t * E[o + 3] + eps * E[o + 6]; out[1] = E[o + 1] + t * E[o + 4] + eps * E[o + 7]; out[2] = E[o + 2] + t * E[o + 5] + eps * E[o + 8]; return out;
};

/** Candidate bend points in air for a sampling step (cached): {n, P, edge, t}. */
function bendPoints(scene, step) {
  const key = "bend:" + step;
  if (scene.cache[key]) return scene.cache[key];
  const E = sceneEdges(scene), eps = scene.eps, P = [], edge = [], ts = [], p = [0, 0, 0];
  for (let e = 0; e < E.length / 10; e++) {
    const len = E[10 * e + 9], n = len <= step ? 0 : Math.ceil(len / step), over = Math.min(0.25, eps / len);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i === 0 ? -over : i === n ? 1 + over : i / n;
      edgePoint(E, eps, e, t, p);
      if (insideAny(scene.bodies, p)) continue;
      P.push(p[0], p[1], p[2]); edge.push(e); ts.push(t);
    }
  }
  return (scene.cache[key] = { n: edge.length, P: new Float64Array(P), edge: new Int32Array(edge), t: new Float64Array(ts) });
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Is the segment [a b] cut by a solid? Crossings, plus the middle of the segment: the crossing test ignores a small
    window at each end (bend points graze edges), and a thin layer such as the copper of a board (70 µm) fits in that
    window — its middle being inside the board is what tells that the string would go through solid insulation. */
const cut = (scene, a, b, hit) => scene.solids.segmentHits(a, b, hit) || insideAny(scene.bodies, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);

/** Point of a net seen from the bend point p: its closest point when the segment is in air, otherwise the foot of the
    perpendicular on another face (non-convex conductors); edges and corners are covered by the bend points of the net. */
function reach(scene, net, p, maxDist, first = null) {
  const hit = { ignoreEndsEps: scene.eps / 4 }, tried = [];
  let q = first || net.bvh.closestPoint(p, maxDist);
  for (let k = 0; q && k < 4; k++) {
    if (!cut(scene, p, q.point, hit)) return q;
    tried.push(q.point);
    const N = net.N || (net.N = triNormals(net.bvh.V, net.bvh.I).N);
    q = net.bvh.closestPoint(p, maxDist, (t, x, y, z, d2) => {
      const h = (p[0] - x) * N[3 * t] + (p[1] - y) * N[3 * t + 1] + (p[2] - z) * N[3 * t + 2];
      return h > 0 && h * h > d2 * (1 - 1e-6) && tried.every((c) => Math.abs(c[0] - x) + Math.abs(c[1] - y) + Math.abs(c[2] - z) > 1e-6);
    });
  }
  return null;
}

/** Leg between two path elements. An element is a bend point {p, e, t} or an anchor {bvh} (a net or a floating body).
    Returns {d, pts, ok}: length, the points to draw, and whether the leg is in air. */
function leg(scene, x, y) {
  const hit = { ignoreEndsEps: scene.eps / 4 };
  if (x.bvh && y.bvh) { const m = meshDistance(x.bvh, y.bvh); return { d: m.d, pts: [m.a, m.b], ok: !segmentBlocked(scene.solids, scene.bodies, m.a, m.b) }; }
  if (!x.bvh && !y.bvh) return { d: dist(x.p, y.p), pts: [x.p, y.p], ok: !cut(scene, x.p, y.p) };
  // bend point to a net or a floating body: the point reach() would take (the closest one when its segment is in
  // air, else the foot of a perpendicular on another face) — never the raw closest point, which may lie behind a wall
  const p = x.bvh ? y.p : x.p, anchor = x.bvh ? x : y, c = reach(scene, anchor, p, Infinity);
  if (!c) return { d: Infinity, pts: [p, p], ok: false };
  return { d: c.d, pts: x.bvh ? [c.point, p] : [p, c.point], ok: true };
}

/** Slides the bend points of a path along their edges (reflection principle, a few passes) and measures it. */
function tighten(scene, els) {
  const E = sceneEdges(scene), eps = scene.eps, legs = [];
  for (let i = 1; i < els.length; i++) legs.push(leg(scene, els[i - 1], els[i]));
  const ref = (el, p) => (el.bvh ? el.bvh.closestPoint(p).point : el.p);
  for (let pass = 0; pass < 80; pass++) {
    let gain = 0;
    for (let i = 1; i < els.length - 1; i++) {
      const el = els[i]; if (el.bvh) continue;
      const o = 10 * el.e, len = E[o + 9], over = Math.min(0.25, eps / len), r1 = ref(els[i - 1], el.p), r2 = ref(els[i + 1], el.p), b = edgePoint(E, eps, el.e, 0);
      const par = (r) => ((r[0] - b[0]) * E[o + 3] + (r[1] - b[1]) * E[o + 4] + (r[2] - b[2]) * E[o + 5]) / (len * len);
      const t1 = par(r1), t2 = par(r2), h1 = dist(r1, edgePoint(E, eps, el.e, t1)), h2 = dist(r2, edgePoint(E, eps, el.e, t2));
      let t = h1 + h2 > 1e-12 ? (t1 * h2 + t2 * h1) / (h1 + h2) : (t1 + t2) / 2;
      t = Math.max(-over, Math.min(1 + over, t));
      if (Math.abs(t - el.t) * len < 1e-7) continue;
      const cand = { p: edgePoint(E, eps, el.e, t), e: el.e, t }, la = leg(scene, els[i - 1], cand), lb = leg(scene, cand, els[i + 1]);
      const g = legs[i - 1].d + legs[i].d - la.d - lb.d;
      if (g > 1e-10 && la.ok && lb.ok) { els[i] = cand; legs[i - 1] = la; legs[i] = lb; gain += g; }
    }
    if (gain < 1e-8) break;
  }
  const path = []; let d = 0;
  if (legs.some((l) => !l.ok)) return { d: Infinity, path: [] };            // a leg through a solid: not a path
  for (const l of legs) { d += l.d; for (const p of l.pts) if (!path.length || dist(path[path.length - 1], p) > 1e-9) path.push([p[0], p[1], p[2]]); }
  return { d, path };
}

/** One search on the bend points sampled at `step`, bounded by U. Returns the elements of the best path or null. */
function search(scene, netA, netB, floats, step, U, direct) {
  const A = netA.bvh, B = netB.bvh;
  const all = bendPoints(scene, step), solids = scene.solids, hit = { ignoreEndsEps: scene.eps / 4 }, nf = floats.length;
  const FB = nf ? scene.floatBvh : null, hF = nf ? Math.min(...floats.map((f) => f.dB)) : Infinity;
  // corridor: only the points that can be on a path shorter than U
  const ids = [], dA = [], dB = [], cA = [], cB = [], hs = [];
  for (let i = 0; i < all.n; i++) {
    const p = [all.P[3 * i], all.P[3 * i + 1], all.P[3 * i + 2]];
    let h = Infinity; const qb = B.closestPoint(p, U);
    if (qb) h = qb.d;
    if (nf) { const qf = FB.closestPoint(p, U); if (qf && qf.d + hF < h) h = qf.d + hF; }
    if (h >= U) continue;
    const qa = A.closestPoint(p, U - h);
    let g0 = qa ? qa.d : Infinity;
    if (nf && g0 === Infinity) { const qf = FB.closestPoint(p, U - h); if (qf) g0 = 0; }    // reachable only through a floating part
    if (g0 === Infinity) continue;
    ids.push(i); dA.push(qa ? qa.d : Infinity); cA.push(qa ? qa.point : null); dB.push(qb ? qb.d : Infinity); cB.push(qb ? qb.point : null); hs.push(h);
  }
  const n = ids.length, T = n, total = n + 1 + nf, g = new Float64Array(total).fill(Infinity), pred = new Int32Array(total).fill(-2), heap = new Heap();
  const P = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) { P[3 * i] = all.P[3 * ids[i]]; P[3 * i + 1] = all.P[3 * ids[i] + 1]; P[3 * i + 2] = all.P[3 * ids[i] + 2]; }
  const pt = (i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]], h = (i) => (i < n ? hs[i] : i === T ? 0 : hF);
  const set = (i, d, from) => { g[i] = d; pred[i] = from; heap.push(d + h(i), i); };
  for (let i = 0; i < n; i++) if (dA[i] < U) { const q = reach(scene, netA, pt(i), U - hs[i], { d: dA[i], point: cA[i] }); if (q) set(i, q.d, -1); }
  if (direct) set(T, direct, -1);
  floats.forEach((f, k) => { if (f.dA + f.dB < U && !segmentBlocked(solids, scene.bodies, f.mA.a, f.mA.b)) set(n + 1 + k, f.dA, -1); });
  const bound = () => Math.min(U, g[T]);
  while (heap.size) {
    const [key, u] = heap.pop();
    if (key >= bound() || u === T) break;
    const gu = key - h(u);
    if (gu > g[u] + 1e-12) continue;
    if (u < n) {
      const pu = pt(u), ux = pu[0], uy = pu[1], uz = pu[2];
      if (gu + dB[u] < bound()) { const q = reach(scene, netB, pu, bound() - gu, { d: dB[u], point: cB[u] }); if (q && gu + q.d < bound()) set(T, gu + q.d, u); }
      floats.forEach((f, k) => {
        const q = f.bvh.closestPoint(pu, Math.min(g[n + 1 + k], bound()) - gu);
        if (q && gu + q.d < g[n + 1 + k] - 1e-12 && !cut(scene, pu, q.point, hit)) set(n + 1 + k, gu + q.d, u);
      });
      for (let v = 0; v < n; v++) {
        const dx = P[3 * v] - ux, dy = P[3 * v + 1] - uy, dz = P[3 * v + 2] - uz, nd = gu + Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (nd >= g[v] - 1e-12 || nd + hs[v] >= bound() || v === u) continue;
        if (!cut(scene, pu, pt(v))) set(v, nd, u);
      }
    } else {
      const f = floats[u - n - 1];
      if (gu + f.dB < bound() && !segmentBlocked(solids, scene.bodies, f.mB.a, f.mB.b)) set(T, gu + f.dB, u);
      floats.forEach((f2, k) => {
        if (f2 === f || gu >= g[n + 1 + k]) return;
        const m = meshDistance(f.bvh, f2.bvh, g[n + 1 + k] - gu);
        if (m && !segmentBlocked(solids, scene.bodies, m.a, m.b)) set(n + 1 + k, gu + m.d, u);
      });
      for (let v = 0; v < n; v++) {
        if (gu + hs[v] >= bound() || gu >= g[v]) continue;
        const q = f.bvh.closestPoint(pt(v), g[v] - gu);
        if (q && gu + q.d < g[v] - 1e-12 && !cut(scene, pt(v), q.point, hit)) set(v, gu + q.d, u);
      }
    }
  }
  if (g[T] >= U || pred[T] === -1) return null;
  const els = [{ bvh: B, net: true }];
  for (let u = pred[T]; u !== -1; u = pred[u]) els.push(u < n ? { p: pt(u), e: all.edge[ids[u]], t: all.t[ids[u]] } : { bvh: floats[u - n - 1].bvh, id: floats[u - n - 1].id });
  els.push({ bvh: A, net: true });
  return els.reverse();
}

/** Clearance between two nets of a prepared scene. */
export function clearance(scene, netA, netB, opts = {}) {
  const cap = opts.maxClearance ?? 80, A = scene.nets.get(netA).bvh, B = scene.nets.get(netB).bvh;
  const res = { d: null, path: [], direct: false, via: [], capped: false };
  const md = meshDistance(A, B, cap);
  if (!md) { res.capped = true; return res; }
  const free = !segmentBlocked(scene.solids, scene.bodies, md.a, md.b);
  let U = free ? md.d : cap * (1 + 1e-9);
  // floating conductors that could shorten the path: d(A, F) + d(F, B) below the bound
  const floats = [];
  for (const i of scene.floats) {
    const b = scene.bodies[i], mA = meshDistance(A, b.bvh, U), mB = mA && meshDistance(b.bvh, B, U - mA.d);
    if (mB) floats.push({ id: b.id, bvh: b.bvh, mA, mB, dA: mA.d, dB: mB.d });
  }
  if (free) { res.d = md.d; res.path = [md.a, md.b]; res.direct = true; if (!floats.length) return res; }
  let step = opts.clearanceStep || 2 * (opts.step || scene.step);
  while (bendPoints(scene, step).n > MAX_NODES) step *= 1.5;
  const els = search(scene, scene.nets.get(netA), scene.nets.get(netB), floats, step, U, free ? md.d : 0);
  if (els) {
    const t = tighten(scene, els);
    if (t.d < U) { res.d = t.d; res.path = t.path; res.direct = false; res.via = els.filter((e) => e.id !== undefined).map((e) => e.id); }
  }
  if (res.d === null) res.capped = true;
  return res;
}
