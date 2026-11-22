/* DesignOrbit.ai — creepage: the shortest path along the insulating surfaces between the conductors of two nets ("the ant").
   Graph on the surfaces of the insulators: the big triangles are bisected (edges ≤ 5 × step), Steiner points are put on
   the triangle edges (spacing ≤ step) and all the points on the boundary of a triangle see each other in a straight line.
   - sources / targets: surface points in contact with a conductor of net A / B (distance ≤ contactTol); a leg that leaves
     or enters a contact region only counts for its part outside (bisection on the distance to the conductor);
   - the footprint of a conductor of another net is not crossed; the footprint of a floating part is crossed for free;
   - the cut edge of a sheet flagged `cutEdge` (an insulator cut by laser, whose edge may be charred) is walked for free,
     like a floating conductor that runs all round the sheet: only the way to the edge and from the edge counts;
   - from a Steiner point the path may jump to the closest facing surface: another insulator in contact (uncemented
     joint, free) or, through air, a wall or another insulator closer than X (a groove narrower than X is bridged);
   - the outline of the footprints (sharp edges of the conductors that touch a surface) gives extra source and target
     points, so that thin tracks and small pads are not missed between two Steiner points;
   - Dijkstra from the sources to the first target; then the path is pulled tight: a crossing point is dropped when the
     straight segment between its neighbours stays on the surface, the others slide along the line of their mesh edge
     and the two ends go to the foot of the perpendicular, so that straight runs and unfolded runs are exact. */

import { BVH, subdivide, triNormals, insideAny, segmentBlocked, sharpEdges } from "./cc_geom.js";
import { Heap } from "./cc_clearance.js";

const GROUPS = ["I", "II", "IIIa", "IIIb"], MAX_TRIS = 150000;
const dst = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

/** Refined surface of the insulators with its Steiner points and contact flags (cached per step). */
function surface(scene, step) {
  const key = "surf:" + step;
  if (scene.cache[key]) return scene.cache[key];
  const Vs = [], Is = [], tb = []; let nv = 0, area = 0;
  for (const bi of scene.insul) area += triNormals(scene.bodies[bi].V, scene.bodies[bi].I).area.reduce((a, b) => a + b, 0);
  step = Math.max(step, Math.sqrt(11 * area / MAX_TRIS) / 5);    // keeps the refined mesh within the budget on big scenes
  for (const bi of scene.insul) {
    const m = subdivide(scene.bodies[bi].V, scene.bodies[bi].I, 5 * step);
    for (let i = 0; i < m.V.length; i++) Vs.push(m.V[i]);
    for (let i = 0; i < m.I.length; i++) Is.push(m.I[i] + nv);
    for (let i = 0; i < m.I.length / 3; i++) tb.push(bi);
    nv += m.V.length / 3;
  }
  const V = new Float64Array(Vs), I = new Uint32Array(Is), triBody = new Int32Array(tb), nt = triBody.length;
  const emap = new Map(), triEdge = new Int32Array(3 * nt), ev = [], et = [], vOff = new Int32Array(nv + 1);
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) {
    const a = I[3 * t + j], b = I[3 * t + (j + 1) % 3], k = a < b ? a * nv + b : b * nv + a;
    let e = emap.get(k);
    if (e === undefined) { e = ev.length / 2; emap.set(k, e); ev.push(a, b); et.push(t, -1); } else if (et[2 * e + 1] < 0) et[2 * e + 1] = t;
    triEdge[3 * t + j] = e; vOff[a + 1]++;
  }
  for (let i = 0; i < nv; i++) vOff[i + 1] += vOff[i];
  const vTri = new Int32Array(3 * nt), cur = vOff.slice(0, nv);
  for (let t = 0; t < nt; t++) for (let j = 0; j < 3; j++) vTri[cur[I[3 * t + j]]++] = t;
  const ne = ev.length / 2, eV = new Int32Array(ev), eT = new Int32Array(et), eN0 = new Int32Array(ne + 1);
  const elen = (e) => Math.hypot(V[3 * eV[2 * e]] - V[3 * eV[2 * e + 1]], V[3 * eV[2 * e] + 1] - V[3 * eV[2 * e + 1] + 1], V[3 * eV[2 * e] + 2] - V[3 * eV[2 * e + 1] + 2]);
  for (let e = 0; e < ne; e++) eN0[e + 1] = eN0[e] + Math.max(1, Math.ceil(elen(e) / step));
  const NP = eN0[ne], nP = new Float64Array(3 * NP), nE = new Int32Array(NP), nC = new Int32Array(NP), floatNodes = new Map(), ct = scene.contactTol;
  const tF = new Uint8Array(nt);                                 // triangles near a conductor: their legs are checked for contact
  for (let t = 0; t < nt; t++) {
    const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2], g = [(V[a] + V[b] + V[c]) / 3, (V[a + 1] + V[b + 1] + V[c + 1]) / 3, (V[a + 2] + V[b + 2] + V[c + 2]) / 3];
    const r = Math.max(dst(g, [V[a], V[a + 1], V[a + 2]]), dst(g, [V[b], V[b + 1], V[b + 2]]), dst(g, [V[c], V[c + 1], V[c + 2]]));
    if (scene.cond.closestPoint(g, r + 2 * ct)) tF[t] = 1;
  }
  for (let e = 0; e < ne; e++) for (let i = eN0[e], k = eN0[e + 1] - i, j = 0; j < k; j++, i++) {
    const t = (j + 0.5) / k, a = 3 * eV[2 * e], b = 3 * eV[2 * e + 1];
    nE[i] = e; for (let c = 0; c < 3; c++) nP[3 * i + c] = V[a + c] + t * (V[b + c] - V[a + c]);
    const q = tF[eT[2 * e]] || (eT[2 * e + 1] >= 0 && tF[eT[2 * e + 1]]) ? scene.cond.closestPoint([nP[3 * i], nP[3 * i + 1], nP[3 * i + 2]], ct) : null;
    if (!q) continue;
    nC[i] = q.body + 1;                                          // conductor or floating part in contact (index + 1)
    if (scene.bodies[q.body].kind === "floating") { if (!floatNodes.has(q.body + 1)) floatNodes.set(q.body + 1, []); floatNodes.get(q.body + 1).push(i); }
  }
  /* the cut edge of a laser-cut sheet : the two faces of a sheet carry most of its area — what does not look their way is the
     edge. Its nodes (those in contact with no conductor) form one group, walked for free like a floating part. */
  const TN = triNormals(V, I), cutIds = new Map(), nB = scene.bodies.length;
  for (const bi of scene.insul) {
    if (!scene.bodies[bi].cutEdge) continue;
    let big = -1; for (let t = 0; t < nt; t++) if (triBody[t] === bi && (big < 0 || TN.area[t] > TN.area[big])) big = t;
    if (big < 0) continue;
    const n0 = [TN.N[3 * big], TN.N[3 * big + 1], TN.N[3 * big + 2]], sum = [0, 0, 0];
    for (let t = 0; t < nt; t++) if (triBody[t] === bi) { const d = TN.N[3 * t] * n0[0] + TN.N[3 * t + 1] * n0[1] + TN.N[3 * t + 2] * n0[2], w = TN.area[t] * (d < 0 ? -1 : 1); for (let c = 0; c < 3; c++) sum[c] += w * TN.N[3 * t + c]; }
    const L = Math.hypot(sum[0], sum[1], sum[2]) || 1, id = nB + 1 + cutIds.size, nodes = [], onEdge = (t) => t >= 0 && triBody[t] === bi && Math.abs(TN.N[3 * t] * sum[0] + TN.N[3 * t + 1] * sum[1] + TN.N[3 * t + 2] * sum[2]) / L < 0.5;
    for (let i = 0; i < NP; i++) if (!nC[i] && (onEdge(eT[2 * nE[i]]) || onEdge(eT[2 * nE[i] + 1]))) { nC[i] = id; nodes.push(i); }
    if (nodes.length) { cutIds.set(id, bi); floatNodes.set(id, nodes); }
  }
  return (scene.cache[key] = { step, V, I, triBody, nt, triEdge, eV, eT, eN0, NP, nP, nE, nC, tF, vOff, vTri, floatNodes, cutIds, N: TN.N, bvh: new BVH(V, I, triBody), jumps: new Map(), touch: new Map() });
}

/** Triangles that contain the surface point c of triangle T (several when c lies on an edge or on a vertex of T). */
function trisAt(S, c, T) {
  const { V, I } = S, near = [];
  for (let j = 0; j < 3; j++) {
    const a = 3 * I[3 * T + j], b = 3 * I[3 * T + (j + 1) % 3], ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2];
    const s = Math.max(0, Math.min(1, ((c[0] - V[a]) * ux + (c[1] - V[a + 1]) * uy + (c[2] - V[a + 2]) * uz) / (ux * ux + uy * uy + uz * uz)));
    near.push(Math.hypot(c[0] - V[a] - s * ux, c[1] - V[a + 1] - s * uy, c[2] - V[a + 2] - s * uz) < 1e-6);
  }
  const n = near[0] + near[1] + near[2];
  if (n >= 2) { const v = I[3 * T + (near[0] && near[1] ? 1 : near[1] && near[2] ? 2 : 0)]; return Array.from(S.vTri.subarray(S.vOff[v], S.vOff[v + 1])); }
  if (n === 0) return [T];
  const e = S.triEdge[3 * T + near.indexOf(true)], o = S.eT[2 * e] === T ? S.eT[2 * e + 1] : S.eT[2 * e];
  return o >= 0 ? [T, o] : [T];
}

/** Surface points touched by the sharp edges of the conductors of a net: the outline of their footprints (cached).
    They make the thin conductors (tracks, pads) that fall between the Steiner points reachable. */
function touchOf(S, scene, net) {
  if (S.touch.has(net)) return S.touch.get(net);
  const out = [], seen = new Set();
  for (const bi of scene.nets.get(net).bodies) {
    const b = scene.bodies[bi];
    for (const e of sharpEdges(b.V, b.I, b.N)) {
      const p = [b.V[3 * e.a], b.V[3 * e.a + 1], b.V[3 * e.a + 2]], q = [b.V[3 * e.b], b.V[3 * e.b + 1], b.V[3 * e.b + 2]], n = Math.max(1, Math.ceil(dst(p, q) / S.step));
      for (let i = 0; i <= n; i++) {
        const x = lerp(p, q, i / n), k = x.map((v) => Math.round(v * 1e4)).join(), c = seen.has(k) ? null : S.bvh.closestPoint(x, scene.contactTol);
        seen.add(k);
        if (c) out.push({ point: c.point, tris: trisAt(S, c.point, c.tri) });
      }
    }
  }
  S.touch.set(net, out);
  return out;
}

/** Jumps available from a Steiner point (geometry only, cached per X): [{point, tri, d, air}] — contact with another
    insulator (air = false) or closest facing surface through air closer than X (air = true). */
function jumpsOf(S, scene, u, X) {
  let cache = S.jumps.get(X);
  if (!cache) S.jumps.set(X, (cache = new Array(S.NP)));
  if (cache[u] !== undefined) return cache[u];
  const { nP, nE, eT, triBody, N } = S, ct = scene.contactTol, p = [nP[3 * u], nP[3 * u + 1], nP[3 * u + 2]], T0 = eT[2 * nE[u]], T1 = eT[2 * nE[u] + 1], bu = triBody[T0], out = [];
  for (const same of [true, false]) {
    const q = S.bvh.closestPoint(p, Math.max(X - 1e-9, ct), (t, x, y, z, d2) => {
      if (t === T0 || t === T1 || (triBody[t] === bu) !== same) return false;
      if (d2 <= ct * ct) return !same;
      return (p[0] - x) * N[3 * t] + (p[1] - y) * N[3 * t + 1] + (p[2] - z) * N[3 * t + 2] > 0.5 * Math.sqrt(d2) && d2 < X * X;
    });
    if (!q) continue;
    const air = q.d > ct, mid = lerp(p, q.point, 0.5);
    if (air && (S.bvh.closestPoint(mid, Math.max(1e-4, 0.05 * q.d)) || scene.solids.segmentHits(p, q.point, { ignoreEndsEps: 1e-6 }) || insideAny(scene.bodies, mid))) continue;
    out.push({ point: q.point, tri: q.tri, d: q.d, air });
  }
  return (cache[u] = out);
}

/** Creepage between two nets of a prepared scene (searched from the net that touches the insulators the least). */
export function creepage(scene, netA, netB, opts = {}) {
  const S = surface(scene, opts.step || scene.step), n = { [netA]: touchOf(S, scene, netA).length, [netB]: touchOf(S, scene, netB).length };
  for (let i = 0; i < S.NP; i++) if (S.nC[i]) { const b = scene.bodies[S.nC[i] - 1]; if (b && (b.net === netA || b.net === netB)) n[b.net]++; }      // no body : the node is on the cut edge of a sheet
  if (n[netB] >= n[netA]) return run(scene, S, netA, netB, opts);
  const res = run(scene, S, netB, netA, opts);
  res.path.reverse(); res.bodies.reverse();
  return res;
}

function run(scene, S, netA, netB, opts) {
  const step = S.step, X = opts.x ?? 1.0, cap = opts.maxCreepage ?? 120, ct = scene.contactTol, ws = step / 2;
  const res = { d: null, path: [], group: null, printed: false, bridges: 0, bodies: [], cutEdges: [], capped: false, none: false };
  const { NP, nP, nE, eV, eT, eN0, triEdge, triBody, tF, nC, V } = S, bodies = scene.bodies, cond = scene.cond;
  const role = new Uint8Array(bodies.length + 1 + S.cutIds.size);   // 0 free, 1 net A, 2 net B, 3 floating (a part, or the cut edge of a sheet), 4 another net
  for (const id of S.cutIds.keys()) role[id] = 3;
  bodies.forEach((b, i) => { role[i + 1] = b.kind === "floating" ? 3 : b.kind === "conductor" ? (b.net === netA ? 1 : b.net === netB ? 2 : 4) : 0; });
  const roleAt = (p) => { const q = cond.closestPoint(p, ct); return q ? role[q.body + 1] : 0; };
  const dist = new Float64Array(NP).fill(Infinity), pred = new Int32Array(NP).fill(-1), ptri = new Int32Array(NP).fill(-1);
  const vP = [], vT = [], vD = [], vPred = [], vPtri = [], vR = [], vFloat = new Map(), starts = new Map(), heap = new Heap(), targets = new Map();
  let best = { d: Infinity }, capped = false;
  const pos = (id) => (id < NP ? [nP[3 * id], nP[3 * id + 1], nP[3 * id + 2]] : vP[id - NP]);
  const getD = (id) => (id < NP ? dist[id] : vD[id - NP]);
  const set = (id, d, from, tri, st) => {
    if (id < NP) { dist[id] = d; pred[id] = from; ptri[id] = tri; } else { vD[id - NP] = d; vPred[id - NP] = from; vPtri[id - NP] = tri; }
    if (st) starts.set(id, st); else starts.delete(id);
    heap.push(d, id);
  };
  const virtual = (p, tris, d, from, type, r = 0) => { vP.push(p); vT.push(tris); vD.push(Infinity); vPred.push(-1); vPtri.push(-1); vR.push(r); set(NP + vP.length - 1, d, from, type); return NP + vP.length - 1; };

  /** Role at x and the length that can be walked from x without meeting a conductor (sphere tracing). */
  const probe = (x) => { const c = cond.closestPoint(x, ws + ct); return !c ? [0, ws] : c.d <= ct ? [role[c.body + 1], ws] : [0, Math.max(c.d - ct, 1.5 * ct)]; };
  /** Leg p → q across a triangle near conductors: {cost (outside the contacts), reset (went through net A), start, hit}. */
  const walk = (p, q, rP, rQ) => {
    const L = dst(p, q);
    let cost = 0, start = null, reset = false, t = 0, r = rP, adv = rP === 0 ? probe(p)[1] : ws;
    while (t < 1) {
      const tn = Math.min(1, t + Math.min(adv, ws) / L), [rn, an] = tn === 1 ? [rQ, ws] : probe(lerp(p, q, tn));
      if (rn === 4) return null;
      if (rn === r) { if (r === 0) cost += (tn - t) * L; t = tn; adv = an; continue; }
      let lo = t, hi = tn;                                         // the role changes between lo and hi
      for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (probe(lerp(p, q, m))[0] === r) lo = m; else hi = m; }
      const [rh, ah] = hi === tn ? [rn, an] : probe(lerp(p, q, hi));
      if (rh === 4) return null;
      if (r === 0) cost += (lo - t) * L;
      if ((r === 0 && rh === 3) || (r === 3 && rh === 0)) { const c = cond.closestPoint(lerp(p, q, r === 0 ? lo : hi), 4 * ct); cost += c ? c.d : 0; }   // up to the floating part itself
      if (rh === 2) { const x = lerp(p, q, r === 0 ? lo : hi), a = cond.closestPoint(x, 4 * ct); return { cost: cost + (a ? a.d : 0), start, reset, hit: a ? a.point : x }; }
      if (rh === 1) { cost = 0; start = null; reset = true; }
      if (r === 1) { const x = lerp(p, q, hi), a = cond.closestPoint(x, 4 * ct); start = a ? a.point : x; cost = a ? a.d : 0; reset = true; }
      t = hi; r = rh; adv = ah;
    }
    return { cost, start, reset, hit: null };
  };

  const relax = (u, pu, ru, du, v, T) => {
    const rv = role[nC[v]];
    if (rv === 4 || rv === 1) return;
    if (!tF[T]) {
      const dx = nP[3 * v] - pu[0], dy = nP[3 * v + 1] - pu[1], dz = nP[3 * v + 2] - pu[2], nd = du + Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (nd < dist[v] && nd < best.d) set(v, nd, u, T);
      return;
    }
    if (rv !== 2 && ru !== 1 && du >= dist[v]) return;
    const w = walk(pu, pos(v), ru, rv);
    if (!w) return;
    const nd = (w.reset ? 0 : du) + w.cost;
    if (w.hit) { if (nd < best.d) best = { d: nd, u, T, end: w.hit, reset: w.reset, start: w.start }; return; }
    if (nd < dist[v] && nd < best.d) set(v, nd, u, T, w.reset ? w.start : null);
  };

  for (let i = 0; i < NP; i++) if (role[nC[i]] === 1) set(i, 0, -1, -1);
  for (const c of touchOf(S, scene, netA)) virtual(c.point, c.tris, 0, -1, -1, 1);
  for (const c of touchOf(S, scene, netB)) for (const T of c.tris) { if (!targets.has(T)) targets.set(T, []); targets.get(T).push(c.point); }
  if (!heap.size) { res.none = true; return res; }
  while (heap.size) {
    const [du, u] = heap.pop();
    if (du > getD(u)) continue;
    if (du >= best.d) break;
    if (du > cap) { capped = true; break; }
    if (u >= NP && !vT[u - NP]) {                                 // floating part: free jump to every point that touches it
      for (const v of S.floatNodes.get(vP[u - NP])) if (du < dist[v]) set(v, du, u, -3);
      continue;
    }
    const pu = pos(u), ru = u < NP ? role[nC[u]] : vR[u - NP], tris = u < NP ? [eT[2 * nE[u]], eT[2 * nE[u] + 1]] : vT[u - NP];
    for (const T of tris) {
      if (T < 0) continue;
      for (let j = 0; j < 3; j++) { const e = triEdge[3 * T + j]; for (let v = eN0[e]; v < eN0[e + 1]; v++) if (v !== u) relax(u, pu, ru, du, v, T); }
      for (const c of targets.get(T) || []) {                     // points of the footprint of net B in this triangle
        const w = walk(pu, c, ru, 2), nd = w && w.hit ? (w.reset ? 0 : du) + w.cost : Infinity;
        if (nd < best.d) best = { d: nd, u, T, end: w.hit, reset: w.reset, start: w.start };
      }
    }
    if (u >= NP) continue;
    if (ru === 3) { const f = vFloat.get(nC[u]); if (f === undefined) vFloat.set(nC[u], virtual(nC[u], null, du, u, -3)); else if (du < vD[f - NP]) set(f, du, u, -3); }
    for (const j of jumpsOf(S, scene, u, X)) {
      const r = roleAt(j.point), nd = du + j.d, type = j.air ? -2 : -4;
      if (r === 4 || r === 1 || nd >= best.d) continue;
      if (r === 2) best = { d: nd, u, T: type, end: j.point, reset: false, start: null };
      else virtual(j.point, trisAt(S, j.point, j.tri), nd, u, type);
    }
  }
  if (best.d > cap) { res.capped = capped || best.d < Infinity; res.none = !res.capped; return res; }

  // ---- the path: start point, crossing points, end point; leg i arrives at element i
  const chain = []; let startPt = best.reset ? best.start : null;
  if (!best.reset) for (let id = best.u; id !== -1; id = id < NP ? pred[id] : vPred[id - NP]) { chain.push(id); if (starts.has(id)) { startPt = starts.get(id); break; } }
  const els = startPt ? [{ p: startPt, id: -1, D: 0 }] : [], touched = [];
  for (const id of chain.reverse()) {
    if (id >= NP && !vT[id - NP]) { const cut = S.cutIds.get(vP[id - NP]); if (cut !== undefined && !res.cutEdges.includes(bodies[cut].id)) res.cutEdges.push(bodies[cut].id); continue; }
    els.push({ p: pos(id), id, tri: id < NP ? ptri[id] : vPtri[id - NP], D: getD(id) });
    touched.push(triBody[id < NP ? eT[2 * nE[id]] : vT[id - NP][0]]);
  }
  els.push({ p: best.end, id: -1, tri: best.T, D: best.d });
  if (best.T >= 0) touched.push(triBody[best.T]);
  for (let i = 1; i < els.length; i++) {
    const el = els[i], L = dst(els[i - 1].p, el.p), c = el.D - els[i - 1].D;
    if (el.tri < 0) { el.c = el.tri === -3 ? 0 : L; el.plain = false; if (el.tri === -2) res.bridges++; } else { el.plain = (i === 1 && !!startPt) || c >= L - 1e-6; el.c = el.plain ? L : c; }
  }
  /** Is the straight segment a valid surface leg? (on an insulating surface, clear of the conductors but at its ends) */
  const straightOK = (P, Q, rP, rQ) => {
    const L = dst(P, Q), n = Math.max(2, Math.ceil(L / ws) + 1);
    if (segmentBlocked(scene.solids, bodies, P, Q, false)) return false;                // cuts a corner of a solid
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = lerp(P, Q, t);
      if (!S.bvh.closestPoint(x, (i === 0 && rP) || (i === n && rQ) ? ct : 2e-3)) return false;
      const r = roleAt(x);
      if (r !== 0 && !(r === rP && t * L <= 3 * ct) && !(r === rQ && (1 - t) * L <= 3 * ct)) return false;
    }
    return true;
  };
  const legOK = (i, P, Q) => straightOK(P, Q, i === 1 ? 1 : 0, i === els.length - 1 ? 2 : 0);
  // 1. shortcuts: a crossing point is dropped when the straight segment between its neighbours stays on the surface
  for (let i = 0; i + 2 < els.length; i++) {
    while (i + 2 < els.length && els[i + 1].plain && els[i + 2].plain && straightOK(els[i].p, els[i + 2].p, i === 0 ? 1 : 0, i + 3 === els.length ? 2 : 0)) {
      els[i + 2].c = dst(els[i].p, els[i + 2].p); els.splice(i + 1, 1);
    }
  }
  // 2. the remaining points slide along the line of their mesh edge; the ends go to the foot of the perpendicular
  const A = scene.nets.get(netA).bvh, B = scene.nets.get(netB).bvh, last = els.length - 1;
  for (let pass = 0; pass < 200; pass++) {
    let gain = 0;
    for (let i = 1; i < last; i++) {
      const el = els[i];
      if (el.id < 0 || el.id >= NP || !el.plain || !els[i + 1].plain) continue;
      const a = 3 * eV[2 * nE[el.id]], b = 3 * eV[2 * nE[el.id] + 1], ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], l2 = ux * ux + uy * uy + uz * uz;
      const par = (r) => ((r[0] - V[a]) * ux + (r[1] - V[a + 1]) * uy + (r[2] - V[a + 2]) * uz) / l2, at = (t) => [V[a] + t * ux, V[a + 1] + t * uy, V[a + 2] + t * uz];
      const r1 = els[i - 1].p, r2 = els[i + 1].p, t1 = par(r1), t2 = par(r2), h1 = dst(r1, at(t1)), h2 = dst(r2, at(t2)), t0 = par(el.p);
      const tt = h1 + h2 > 1e-12 ? (t1 * h2 + t2 * h1) / (h1 + h2) : (t1 + t2) / 2;
      for (const t of [tt, Math.max(0, Math.min(1, tt)), t0 + (tt - t0) / 2, t0 + (tt - t0) / 8]) {   // free, on the mesh edge, damped
        const np = at(t), c1 = dst(r1, np), c2 = dst(np, r2), g = el.c + els[i + 1].c - c1 - c2;
        if (g < 1e-10 || !legOK(i, r1, np) || !legOK(i + 1, np, r2)) continue;
        el.p = np; el.c = c1; els[i + 1].c = c2; gain += g;
        break;
      }
    }
    if (last < 1) break;
    if (els[1].plain) {
      const q = A.closestPoint(els[1].p);
      if (q.d < els[1].c - 1e-10 && legOK(1, q.point, els[1].p)) { gain += els[1].c - q.d; els[0].p = q.point; els[1].c = q.d; }
    }
    if (els[last].plain) {
      const q = B.closestPoint(els[last - 1].p);
      if (q.d < els[last].c - 1e-10 && legOK(last, els[last - 1].p, q.point)) { gain += els[last].c - q.d; els[last].p = q.point; els[last].c = q.d; }
    }
    if (gain < 1e-9) break;
  }
  res.d = 0;
  for (let i = 1; i <= last; i++) res.d += els[i].c;
  res.path = els.map((e) => [e.p[0], e.p[1], e.p[2]]);
  const ids = [...new Set(touched)];
  res.bodies = ids.map((i) => bodies[i].id);
  res.group = GROUPS[Math.max(-1, ...ids.map((i) => GROUPS.indexOf(bodies[i].group)))] || null;
  res.printed = ids.length > 0 && ids.every((i) => bodies[i].printed);
  return res;
}
