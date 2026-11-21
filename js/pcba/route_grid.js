/* DesignWizard.ai — PCBA: the routing grid. One node every `g` millimetres on every copper layer. For the net being
   routed, a node is BLOCKED when a track centred there would come closer to foreign copper, a hole or the board edge
   than the rules allow ; a node is VIA-BLOCKED when a via there would. The search itself (route.js) only reads
   these maps. */

import { padShape, discShape, trackShapes, inPoly, polyEdge } from "./geom2d.js";

/** Binary heap of (priority, node index) pairs in typed arrays. */
export class Heap {
  constructor(n) { this.k = new Float32Array(n); this.v = new Int32Array(n); this.n = 0; }
  push(key, val) {
    if (this.n === this.k.length) { const k = new Float32Array(this.n * 2), v = new Int32Array(this.n * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const top = this.v[0], key = this.k[--this.n], val = this.v[this.n];
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++; if (this.k[c] >= key) break; this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c; }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
}

/** The grid of a resolved board : geometry, distance of every node to the board edge, and every piece of copper as a
    shape with its net and its layers (null = every layer). */
export function makeGrid(R, g = 0.25) {
  const x0 = R.bbox[0], y0 = R.bbox[1], nx = Math.floor((R.bbox[2] - x0) / g + 1e-6) + 1, ny = Math.floor((R.bbox[3] - y0) / g + 1e-6) + 1, edge = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const p = [x0 + i * g, y0 + j * g]; edge[j * nx + i] = inPoly(p, R.outline) ? polyEdge(p, R.outline) : -1; }
  const shapes = [];
  R.pads.forEach((p, i) => shapes.push({ s: padShape(p), net: p.net, layers: p.layers, pad: i, smd: !p.drill }));
  for (const h of R.holes) shapes.push({ s: discShape(h.x, h.y, Math.max(h.land, h.d)), net: "#trou", layers: null, clr: 0.5, hole: h.d });
  const G = { g, x0, y0, nx, ny, n: nx * ny, edge, shapes, layers: R.layers, R,
    at: (k) => [x0 + (k % nx) * g, y0 + Math.floor(k / nx) * g], near: (pt) => Math.max(0, Math.min(ny - 1, Math.round((pt[1] - y0) / g))) * nx + Math.max(0, Math.min(nx - 1, Math.round((pt[0] - x0) / g))) };
  for (const t of R.tracks) addTrack(G, t);
  for (const v of R.vias) addVia(G, v);
  return G;
}
export function addTrack(G, t) { for (const s of trackShapes(t)) G.shapes.push({ s, net: t.net, layers: [t.layer], auto: !!t.auto }); }
export function addVia(G, v) { G.shapes.push({ s: discShape(v.x ?? v.at[0], v.y ?? v.at[1], v.d), net: v.net, layers: null, via: v.drill, auto: !!v.auto }); }

/** Marks the nodes closer than `reach` to a shape. */
function stamp(G, map, s, reach) {
  const { g, x0, y0, nx, ny } = G, rect = s.rect, r = rect ? reach : reach + s.r;
  const bx0 = rect ? rect[0] : Math.min(s.a[0], s.b[0]), by0 = rect ? rect[1] : Math.min(s.a[1], s.b[1]), bx1 = rect ? rect[2] : Math.max(s.a[0], s.b[0]), by1 = rect ? rect[3] : Math.max(s.a[1], s.b[1]);
  const i0 = Math.max(0, Math.ceil((bx0 - r - x0) / g)), i1 = Math.min(nx - 1, Math.floor((bx1 + r - x0) / g)), j0 = Math.max(0, Math.ceil((by0 - r - y0) / g)), j1 = Math.min(ny - 1, Math.floor((by1 + r - y0) / g));
  const ax = rect ? 0 : s.a[0], ay = rect ? 0 : s.a[1], dx = rect ? 0 : s.b[0] - ax, dy = rect ? 0 : s.b[1] - ay, l2 = dx * dx + dy * dy, r2 = r * r;
  for (let j = j0; j <= j1; j++) {
    const py = y0 + j * g;
    for (let i = i0; i <= i1; i++) {
      const px = x0 + i * g;
      let ex, ey;
      if (rect) { ex = Math.max(rect[0] - px, 0, px - rect[2]); ey = Math.max(rect[1] - py, 0, py - rect[3]); }
      else { const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0; ex = px - ax - t * dx; ey = py - ay - t * dy; }
      if (ex * ex + ey * ey < r2) map[j * nx + i] = 1;
    }
  }
}

/** Maps for one net : blocked[layer index] for a track of width w, viaOk for a via [d, drill].
    Planes close their whole layer to tracks. slack covers what happens between two nodes. With ignoreAuto the copper
    laid by the router is left out. */
export function netMaps(G, net, w, via, planes = [], ignoreAuto = false) {
  const R = G.R, slack = (r) => Math.sqrt(r * r + G.g * G.g / 2) - r, blocked = G.layers.map(() => new Uint8Array(G.n)), viaNo = new Uint8Array(G.n);
  const closed = new Set(planes.map((p) => p.layer)), edgeT = R.fab.edge + w / 2, edgeV = R.fab.edge + via[0] / 2;
  for (let k = 0; k < G.n; k++) { if (G.edge[k] < edgeT) for (const b of blocked) b[k] = 1; if (G.edge[k] < edgeV) viaNo[k] = 1; }
  G.layers.forEach((l, li) => { if (closed.has(l)) blocked[li].fill(1); });
  for (const sh of G.shapes) {
    if (ignoreAuto && sh.auto) continue;                        // "what if the router's own copper were not there" : used to decide what to rip up
    const own = sh.net !== null && sh.net === net, clr = sh.clr ?? R.rules.clearance(net, sh.net);
    if (!own) {
      const rt = w / 2 + clr, rv = via[0] / 2 + clr;
      G.layers.forEach((l, li) => { if (!sh.layers || sh.layers.includes(l)) stamp(G, blocked[li], sh.s, rt + slack(rt)); });
      stamp(G, viaNo, sh.s, rv + slack(rv));
    }
    if (sh.smd) stamp(G, viaNo, sh.s, via[0] / 2);                                           // no via in a pad, own or not : solder would wick into it
    const drill = sh.hole || sh.via || (sh.pad !== undefined && R.pads[sh.pad].drill) || 0;   // drilled holes keep their distance, same net or not
    if (drill) { const c = sh.s.rect ? [(sh.s.rect[0] + sh.s.rect[2]) / 2, (sh.s.rect[1] + sh.s.rect[3]) / 2] : [(sh.s.a[0] + sh.s.b[0]) / 2, (sh.s.a[1] + sh.s.b[1]) / 2]; stamp(G, viaNo, discShape(c[0], c[1], drill), via[1] / 2 + R.fab.holeGap); }
  }
  return { blocked, viaNo };
}

/** Grid nodes that stand on a pad : inside its copper, else the node nearest its centre. */
export function padNodes(G, pad) {
  const s = padShape(pad), out = [], { g, x0, y0, nx, ny } = G, box = s.rect || [Math.min(s.a[0], s.b[0]) - s.r, Math.min(s.a[1], s.b[1]) - s.r, Math.max(s.a[0], s.b[0]) + s.r, Math.max(s.a[1], s.b[1]) + s.r];
  for (let j = Math.max(0, Math.ceil((box[1] - y0) / g)); j <= Math.min(ny - 1, Math.floor((box[3] - y0) / g)); j++) for (let i = Math.max(0, Math.ceil((box[0] - x0) / g)); i <= Math.min(nx - 1, Math.floor((box[2] - x0) / g)); i++) {
    const px = x0 + i * g, py = y0 + j * g;
    if (s.rect) out.push(j * nx + i);
    else { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - s.a[0]) * dx + (py - s.a[1]) * dy) / l2)) : 0; if (Math.hypot(px - s.a[0] - t * dx, py - s.a[1] - t * dy) <= s.r) out.push(j * nx + i); }
  }
  return out.length ? out : [G.near([pad.x, pad.y])];
}
