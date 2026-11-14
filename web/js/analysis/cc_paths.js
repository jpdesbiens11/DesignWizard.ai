/* DesignWizard.ai — geometric engine of the "Creepage & Clearance" isolation analysis (IEC 60664-1).
   Measures on the triangle meshes of a complete assembly, between the conductors of two nets:
     - the CLEARANCE: shortest path through air (cc_clearance.js, "the taut string");
     - the CREEPAGE: shortest path along the insulating surfaces (cc_creepage.js, "the ant").
   Pure geometry: runs unchanged in a browser Web Worker and in Node; deterministic.

   Scene body (input): { id, name, kind: "conductor" | "floating" | "insulator" | "ignore", net, group, printed,
                         pos: Float32Array (x, y, z per vertex, world mm), idx: Uint32Array (outward CCW triangles) }. */

import { weldMesh, triNormals, BVH } from "./cc_geom.js";
import { clearance } from "./cc_clearance.js";
import { creepage } from "./cc_creepage.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** One tree over the triangles of several bodies (triBody = index of the body in scene.bodies). */
function union(bodies, list) {
  let nv = 0, nt = 0;
  for (const i of list) { nv += bodies[i].V.length; nt += bodies[i].I.length; }
  const V = new Float64Array(nv), I = new Uint32Array(nt), triBody = new Int32Array(nt / 3);
  let ov = 0, oi = 0;
  for (const i of list) {
    const b = bodies[i];
    V.set(b.V, ov);
    for (let k = 0; k < b.I.length; k++) I[oi + k] = b.I[k] + ov / 3;
    triBody.fill(i, oi / 3, (oi + b.I.length) / 3);
    ov += b.V.length; oi += b.I.length;
  }
  return new BVH(V, I, triBody);
}

/** Prepares a scene: welds the meshes, builds the trees, classifies the bodies.
    opts: { contactTol: 0.02 (mm; parts closer than this touch), step: sampling spacing in mm (default: auto, 0.5–1 mm) }. */
export function prepareScene(bodies, opts = {}) {
  const list = [];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bodies) {
    if (!b || b.kind === "ignore" || !b.pos || !b.idx || !b.idx.length) continue;
    const kind = b.kind === "conductor" && !b.net ? "floating" : b.kind, { V, I } = weldMesh(b.pos, b.idx);
    if (!I.length) continue;
    for (let i = 0; i < V.length; i++) { const k = i % 3; if (V[i] < lo[k]) lo[k] = V[i]; if (V[i] > hi[k]) hi[k] = V[i]; }
    list.push({ id: b.id, name: b.name, kind, net: kind === "conductor" ? String(b.net) : null, group: b.group || null, printed: !!b.printed, V, I, N: triNormals(V, I).N, bvh: new BVH(V, I) });
  }
  const diag = list.length ? Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) : 1, all = list.map((_, i) => i), pick = (k) => all.filter((i) => list[i].kind === k);
  const scene = {
    bodies: list, diag, cache: {},
    contactTol: opts.contactTol ?? 0.02,
    step: opts.step || opts.edgeSample || Math.min(1, Math.max(0.5, diag / 200)),
    eps: Math.min(2e-3, Math.max(5e-4, diag * 1e-5)),          // outward offset of the bend points of the taut string
    solids: union(list, all), floats: pick("floating"), insul: pick("insulator"), nets: new Map(),
  };
  scene.cond = union(list, all.filter((i) => list[i].kind !== "insulator"));     // conductors and floating parts: contact tests
  scene.floatBvh = union(list, scene.floats);
  for (const i of pick("conductor")) { const n = list[i].net; if (!scene.nets.has(n)) scene.nets.set(n, { bodies: [] }); scene.nets.get(n).bodies.push(i); }
  for (const n of scene.nets.values()) n.bvh = union(list, n.bodies);
  return scene;
}

/** Names of the nets that have at least one conductor in the scene. */
export function netsOf(scene) { return [...scene.nets.keys()]; }

/** Clearance and creepage between two nets.
    opts: { x: groove width X in mm (1.0), maxClearance: 80, maxCreepage: 120, step: sampling spacing (auto), exact: bool }. */
export function measurePair(scene, netA, netB, opts = {}) {
  const t0 = now();
  if (!scene.nets.has(netA) || !scene.nets.has(netB) || netA === netB) {
    return { clearance: { d: null, path: [], direct: false, via: [], capped: false }, creepage: { d: null, path: [], group: null, printed: false, bridges: 0, bodies: [], capped: false, none: true }, ms: 0 };
  }
  const o = { ...opts, step: opts.step || (opts.exact ? scene.step / 2 : scene.step) };
  const cl = clearance(scene, netA, netB, o), cr = creepage(scene, netA, netB, o);
  return { clearance: cl, creepage: cr, ms: now() - t0 };
}

/** Every pair of distinct nets (or the given pairs [[a, b], ...]). onProgress(done, total, result) after each pair. */
export function measureAll(scene, pairs, opts = {}, onProgress = null) {
  if (!pairs) { const n = netsOf(scene); pairs = []; for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) pairs.push([n[i], n[j]]); }
  const out = [];
  pairs.forEach(([a, b], i) => { const r = { a, b, ...measurePair(scene, a, b, opts) }; out.push(r); if (onProgress) onProgress(i + 1, pairs.length, r); });
  return out;
}
