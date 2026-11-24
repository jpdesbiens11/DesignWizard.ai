/* DynamiteOrbit.ai — PCBA: a sub-circuit moves as one brick, and the board stays connected.
   moveGroup() moves a set of parts — a block, or a single part — as a rigid body, with the copper that joins only
   them (their own nets, their fan-out to a plane). The copper that tied them to the rest of the board goes, back to
   the last junction that still serves the others ; the copper of other nets the brick now sits on goes too. What
   comes back is the list of nets to reconnect : the router (route.js, option keep) lays only the missing links,
   around everything that stayed. No clean-up by hand. */

import { resolveBoard } from "./model.js";
import { padShape, discShape, trackShapes, gap, shapeBox, edgeGap, ptSeg, inPoly } from "./geom2d.js";

const TOUCH = 1e-3, r3 = (v) => Math.round(v * 1000) / 1000, q4 = (v) => Math.round(v * 4) / 4;

/** The parts of a block that are placed and free to move. */
export const blockRefs = (board, id) => (board.parts || []).filter((p) => p.block === id && p.at && !p.fixed).map((p) => p.ref);

/** Nets of a group of parts : inside = every pad is on the group ; crossing = pads on both sides. */
export function groupNets(R, refs) {
  const set = new Set(refs), inside = [], crossing = [];
  for (const n of R.nets) { const k = n.pads.filter((i) => set.has(R.pads[i].ref)).length; if (k) (k === n.pads.length ? inside : crossing).push(n.name); }
  return { inside, crossing };
}

/** The copper of one net as items that touch one another : pads (except `gone`), tracks, vias, planes. */
function netItems(R, board, name, gone, planes) {
  const net = R.nets.find((n) => n.name === name), items = [];
  if (!net) return null;
  for (const i of net.pads) if (!gone.has(i)) items.push({ shapes: [padShape(R.pads[i])], layers: R.pads[i].layers, fixed: true, at: [[R.pads[i].x, R.pads[i].y]] });
  (board.tracks || []).forEach((t, k) => { if (t.net === name) items.push({ shapes: trackShapes(t), layers: [t.layer], track: k, t, fixed: !!t.locked, at: [t.pts[0], t.pts[t.pts.length - 1]] }); });
  (board.vias || []).forEach((v, k) => { if (v.net === name) items.push({ shapes: [discShape(v.at[0], v.at[1], v.d)], layers: null, via: k, fixed: !!v.locked, at: [v.at] }); });
  if (planes) for (const pl of R.planes) if (pl.net === name) items.push({ plane: pl.layer, fixed: true });
  const touch = (a, b) => {
    if (a.plane !== undefined || b.plane !== undefined) { const o = a.plane !== undefined ? b : a, pl = a.plane !== undefined ? a.plane : b.plane; return o.plane === undefined && (!o.layers || o.layers.includes(pl)); }
    if (a.layers && b.layers && !a.layers.some((l) => b.layers.includes(l))) return false;
    return a.shapes.some((s) => b.shapes.some((q) => gap(s, q) <= TOUCH));
  };
  const adj = items.map(() => []);
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (touch(items[i], items[j])) { adj[i].push(j); adj[j].push(i); }
  const alive = items.map(() => true);                          // dead ends fall one after the other
  for (let again = true; again;) { again = false; items.forEach((it, i) => { if (alive[i] && !it.fixed && adj[i].filter((j) => alive[j]).length < 2) { alive[i] = false; again = true; } }); }
  return { items, adj, alive };
}
const keyOf = (it) => (it.track !== undefined ? `t${it.track}` : it.via !== undefined ? `v${it.via}` : null);
/** Keys (« t3 », « v5 ») of the tracks and vias of a net that lie on a way between two pads, or a pad and a plane. */
function useful(R, board, name, gone, planes = true) {
  const g = netItems(R, board, name, gone, planes), out = new Set();
  if (g) g.items.forEach((it, i) => { if (g.alive[i] && keyOf(it)) out.add(keyOf(it)); });
  return out;
}

/** Takes away the copper of the given nets that joins nothing — dead ends, and the tail of a track beyond its last
    junction. Locked copper stays. → { removed, trimmed } */
export function pruneCopper(board, lib, nets) {
  const R = resolveBoard(board, lib), dropT = new Set(), dropV = new Set(), none = new Set();
  let trimmed = 0;
  for (const name of new Set(nets)) {
    const g = netItems(R, board, name, none, true);
    if (!g) continue;
    g.items.forEach((it, i) => {
      if (it.fixed || keyOf(it) === null) return;
      if (!g.alive[i]) { (it.track !== undefined ? dropT : dropV).add(it.track ?? it.via); return; }
      if (it.track === undefined) return;
      const nb = g.adj[i].filter((j) => g.alive[j]).map((j) => g.items[j]), pts = it.t.pts, w = it.t.w, last = pts.length - 1, reach = [];
      if (nb.some((o) => o.plane !== undefined)) return;        // on its plane, a track is joined all along
      for (const o of nb) {
        for (const e of [0, last]) if (o.shapes.some((s) => gap(discShape(pts[e][0], pts[e][1], w), s) <= TOUCH)) reach.push(e);
        for (const q of o.at) for (let k = 0; k < last; k++) if (ptSeg(q, pts[k], pts[k + 1]) <= w / 2 + 0.05) { const a = pts[k], b = pts[k + 1], L = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2; reach.push(k + (L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / L)) : 0)); }
      }
      if (!reach.length) return;
      const s0 = Math.min(...reach), s1 = Math.max(...reach), at = (s) => { const k = Math.min(last - 1, Math.floor(s)), t = s - k; return [r3(pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t), r3(pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t)]; };
      if (s1 - s0 < 1e-6) { dropT.add(it.track); return; }
      if (s0 < 1e-6 && s1 > last - 1e-6) return;
      const cut = [at(s0)]; for (let k = Math.floor(s0) + 1; k <= Math.ceil(s1) - 1; k++) cut.push(pts[k]); cut.push(at(s1));
      it.t.pts = cut.filter((p, k) => !k || Math.hypot(p[0] - cut[k - 1][0], p[1] - cut[k - 1][1]) > 1e-6); trimmed++;
      if (it.t.pts.length < 2) dropT.add(it.track);
    });
  }
  board.tracks = (board.tracks || []).filter((t, k) => !dropT.has(k)); board.vias = (board.vias || []).filter((v, k) => !dropV.has(k));
  return { removed: dropT.size + dropV.size, trimmed };
}

/** Moves a group of parts as one brick. o : { delta: [dx, dy], turn: 0 | 90 | 180 | 270, about: [x, y], block: id (its zone follows) }.
    → { nets: nets to reconnect, parts, tracks, vias (moved with the brick), ripped (copper taken away), clashes } or { refused: text }. */
export function moveGroup(board, lib, refs, o = {}) {
  const R = resolveBoard(board, lib), free = new Set(refs.filter((r) => { const p = (board.parts || []).find((x) => x.ref === r); return p && p.at && !p.fixed; }));
  const mine = R.parts.filter((p) => free.has(p.ref)), turn = (((Math.round((o.turn || 0) / 90) % 4) + 4) % 4), d = o.delta || [0, 0];
  if (!mine.length) return { refused: "Aucun composant libre à déplacer (les positions imposées restent en place)." };
  const xs = mine.map((p) => p.x), ys = mine.map((p) => p.y), c = o.about || [q4((Math.min(...xs) + Math.max(...xs)) / 2), q4((Math.min(...ys) + Math.max(...ys)) / 2)];
  const T = (pt) => { let x = pt[0] - c[0], y = pt[1] - c[1]; for (let k = 0; k < turn; k++) [x, y] = [-y, x]; return [r3(x + c[0] + d[0]), r3(y + c[1] + d[1])]; };
  if (mine.some((p) => !inPoly(T([p.x, p.y]), R.outline))) return { refused: "Le déplacement sortirait un composant de la carte." };
  const { inside, crossing } = groupNets(R, [...free]), gone = new Set(), stay = new Set(), none = new Set();
  R.pads.forEach((p, i) => { (free.has(p.ref) ? gone : stay).add(i); });
  /* the copper of a crossing net : what serves the others stays ; what joins only pads of the brick (and its plane) goes with it ; the rest is taken away */
  const withBrick = new Set(), drop = new Set(), touched = new Set(crossing);
  for (const name of crossing) {
    const out = useful(R, board, name, gone), own = useful(R, board, name, stay);
    (board.tracks || []).forEach((t, k) => { if (t.net !== name || t.locked) return; const key = `t${k}`; if (out.has(key)) return; (own.has(key) ? withBrick : drop).add(key); });
    (board.vias || []).forEach((v, k) => { if (v.net !== name || v.locked) return; const key = `v${k}`; if (out.has(key)) return; (own.has(key) ? withBrick : drop).add(key); });
  }
  const inSet = new Set(inside), movedT = [], movedV = [];
  board.tracks = (board.tracks || []).filter((t, k) => { if (drop.has(`t${k}`)) return false; if (inSet.has(t.net) || withBrick.has(`t${k}`)) { t.pts = t.pts.map(T); movedT.push(t); } return true; });
  board.vias = (board.vias || []).filter((v, k) => { if (drop.has(`v${k}`)) return false; if (inSet.has(v.net) || withBrick.has(`v${k}`)) { v.at = T(v.at); movedV.push(v); } return true; });
  for (const p of board.parts) if (free.has(p.ref)) { p.at = T(p.at); if (turn) p.rot = ((p.rot || 0) + turn * 90) % 360; }
  const blk = o.block ? (board.blocks || []).find((b) => b.id === o.block) : null;

  /* where the brick lands : the copper of other nets under it goes ; its own copper goes where it meets a pad, a hole or the board edge */
  const R1 = resolveBoard(board, lib);
  if (blk && Array.isArray(blk.zone)) {                           // the zone of the block follows only as far as its parts ask : it slides, grows if it must, and stays on the board
    const bx = R1.parts.filter((p) => p.block === blk.id).map((p) => p.box), z = blk.zone, h5 = (v) => Math.round(v * 2) / 2;
    const x0 = Math.min(...bx.map((q) => q[0])) - 0.5, y0 = Math.min(...bx.map((q) => q[1])) - 0.5, x1 = Math.max(...bx.map((q) => q[2])) + 0.5, y1 = Math.max(...bx.map((q) => q[3])) + 0.5;
    const w = Math.max(z[2], h5(x1 - x0 + 0.49)), h = Math.max(z[3], h5(y1 - y0 + 0.49)), fit = (lo, size, a, b, min, max) => Math.max(min, Math.min(max - size, Math.max(b - size, Math.min(a, lo))));
    blk.zone = [h5(fit(z[0], w, x0, x1, R1.bbox[0], R1.bbox[2])), h5(fit(z[1], h, y0, y1, R1.bbox[1], R1.bbox[3])), Math.min(w, R1.bbox[2] - R1.bbox[0]), Math.min(h, R1.bbox[3] - R1.bbox[1])];
  }
  const movedSet = new Set([...movedT, ...movedV]), killT = new Set(), killV = new Set();
  const shapesOf = (x, isVia) => (isVia ? [discShape(x.at[0], x.at[1], x.d)] : trackShapes(x));
  const A = [], B = [];                                           // A = what moved ; B = what stayed
  R1.pads.forEach((p) => (free.has(p.ref) ? A : B).push({ s: padShape(p), net: p.net, layers: p.layers, pad: true }));
  for (const h of R1.holes) B.push({ s: discShape(h.x, h.y, Math.max(h.land, h.d)), net: "#trou", layers: null, clr: 0.5, pad: true });
  board.tracks.forEach((t) => { for (const s of trackShapes(t)) (movedSet.has(t) ? A : B).push({ s, net: t.net, layers: [t.layer], t, locked: !!t.locked }); });
  board.vias.forEach((v) => (movedSet.has(v) ? A : B).push({ s: discShape(v.at[0], v.at[1], v.d), net: v.net, layers: null, v, locked: !!v.locked }));
  for (const x of [...A, ...B]) x.box = shapeBox(x.s);
  let clashes = 0;
  const kill = (x) => { if (x.t) killT.add(x.t); else killV.add(x.v); touched.add(x.net); };
  for (const a of A) {
    if (!a.pad && edgeGap(a.s, R1.outline) < R1.fab.edge - 1e-6) { kill(a); continue; }
    for (const b of B) {
      if (a.net !== null && a.net === b.net) continue;
      const clr = b.clr ?? R1.rules.clearance(a.net, b.net);
      if (a.box[0] > b.box[2] + clr || a.box[2] < b.box[0] - clr || a.box[1] > b.box[3] + clr || a.box[3] < b.box[1] - clr) continue;
      if (a.layers && b.layers && !a.layers.some((l) => b.layers.includes(l))) continue;
      if (gap(a.s, b.s) >= clr - 1e-6) continue;
      if (!b.pad && !b.locked) kill(b); else if (!a.pad && !a.locked) kill(a); else clashes++;
    }
  }
  board.tracks = board.tracks.filter((t) => !killT.has(t)); board.vias = board.vias.filter((v) => !killV.has(v));
  for (const n of inside) touched.add(n);
  const pr = pruneCopper(board, lib, [...touched]);
  return { nets: [...touched], parts: mine.length, tracks: movedT.filter((t) => board.tracks.includes(t)).length, vias: movedV.filter((v) => board.vias.includes(v)).length, ripped: drop.size + killT.size + killV.size + pr.removed, clashes };
}

/** An artefact comes back with parts at new places — an AI moved them, a file was edited by hand — and the copper it
    carries is still the old one : each moved part takes its own copper along as if it had been dragged, and the nets to
    reconnect come back. Parts moved by the same vector go as one brick. `after` is modified. → { moved: [refs], nets } */
export function followMoves(before, after, lib) {
  const same = (k) => JSON.stringify(before[k] || []) === JSON.stringify(after[k] || []), old = new Map((before.parts || []).map((p) => [p.ref, p])), nets = new Set(), moved = [], bricks = new Map();
  if (!same("tracks") || !same("vias") || !(after.tracks || []).length) return { moved, nets: [] };      // the answer drew its own copper, or there is none to keep
  for (const p of after.parts || []) {
    const q = old.get(p.ref); if (!q || !q.at || !p.at || p.fixed || p.comp !== q.comp) continue;
    const d = [r3(p.at[0] - q.at[0]), r3(p.at[1] - q.at[1])], turn = ((((p.rot || 0) - (q.rot || 0)) % 360) + 360) % 360, flip = (p.side || "top") !== (q.side || "top");
    if (!d[0] && !d[1] && !turn && !flip) continue;
    moved.push(p.ref);
    if (flip) { for (const n of after.nets || []) if ((n.pins || []).some((pin) => String(pin).startsWith(`${p.ref}.`))) nets.add(n.name); continue; }
    p.at = [...q.at]; if (q.rot === undefined) delete p.rot; else p.rot = q.rot;      // back where the copper knows it, then moved as a drag would
    const key = turn ? `${p.ref}` : `${d[0]},${d[1]}`; if (!bricks.has(key)) bricks.set(key, { refs: [], delta: d, turn, about: [...q.at] }); bricks.get(key).refs.push(p.ref);
  }
  if (nets.size) { const drop = (x) => x.auto && !x.locked && nets.has(x.net); after.tracks = after.tracks.filter((t) => !drop(t)); after.vias = (after.vias || []).filter((v) => !drop(v)); }
  for (const b of bricks.values()) { const m = moveGroup(after, lib, b.refs, b.turn ? { delta: b.delta, turn: b.turn, about: b.about } : { delta: b.delta }); if (m.refused) throw new Error(`${b.refs.join(", ")} : ${m.refused}`); for (const n of m.nets) nets.add(n); }
  return { moved, nets: [...nets] };
}
