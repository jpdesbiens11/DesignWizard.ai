/* DesignWizard.ai — PCBA: what is electrically joined on a resolved board, and what is still to route.
   Copper of the same net is joined when it touches on a common layer : a track on a pad, two tracks, a via on
   anything it crosses (a via spans every layer), and everything that reaches a plane of that net. */

import { padShape, discShape, trackShapes, gap, dist } from "./geom2d.js";

const TOUCH = 1e-3;                                             // copper closer than a micron is joined

/** Connectivity of a resolved board (model.js resolveBoard).
    → { nets: [{ name, groups: [[pad indices], …], open }], open, complete }
    groups = sets of pads already joined by copper ; open = connections still missing (groups − 1). */
export function connectivity(R) {
  const out = [];
  let open = 0;
  for (const net of R.nets) {
    const items = [];                                           // { shape, layers: Set | null (every layer), pad }
    for (const i of net.pads) items.push({ shape: padShape(R.pads[i]), layers: new Set(R.pads[i].layers), pad: i });
    for (const t of R.tracks) if (t.net === net.name) for (const s of trackShapes(t)) items.push({ shape: s, layers: new Set([t.layer]) });
    for (const v of R.vias) if (v.net === net.name) items.push({ shape: discShape(v.x, v.y, v.d), layers: null });
    const parent = items.map((_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }, join = (a, b) => { parent[find(a)] = find(b); };
    const shares = (a, b) => !a.layers || !b.layers || [...a.layers].some((l) => b.layers.has(l));
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (shares(items[i], items[j]) && gap(items[i].shape, items[j].shape) <= TOUCH) join(i, j);
    for (const pl of R.planes) {                                // a plane joins everything of its net that reaches its layer
      if (pl.net !== net.name) continue;
      let first = -1;
      items.forEach((it, i) => { if (!it.layers || it.layers.has(pl.layer)) { if (first < 0) first = i; else join(i, first); } });
    }
    const groups = new Map();
    items.forEach((it, i) => { if (it.pad === undefined) return; const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it.pad); });
    const list = [...groups.values()];
    out.push({ name: net.name, groups: list, open: Math.max(0, list.length - 1) });
    open += Math.max(0, list.length - 1);
  }
  return { nets: out, open, complete: open === 0 };
}

/** The connections still to make, as the shortest links between the groups of each net (a spanning tree).
    → [{ net, from: pad index, to: pad index, a: [x, y], b: [x, y], length }] */
export function ratsnest(R, conn = connectivity(R)) {
  const lines = [], at = (i) => [R.pads[i].x, R.pads[i].y];
  for (const net of conn.nets) {
    if (net.groups.length < 2) continue;
    const done = [net.groups[0]], todo = net.groups.slice(1);
    while (todo.length) {
      let best = null;
      for (const g of done) for (let k = 0; k < todo.length; k++) for (const i of g) for (const j of todo[k]) { const d = dist(at(i), at(j)); if (!best || d < best.length) best = { net: net.name, from: i, to: j, a: at(i), b: at(j), length: d, k }; }
      done.push(todo[best.k]); todo.splice(best.k, 1); delete best.k; lines.push(best);
    }
  }
  return lines;
}
