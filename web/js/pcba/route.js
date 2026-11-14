/* DesignWizard.ai — PCBA: the automatic router. A maze router on a grid (A*) : one net after the other, each
   connection from the copper of the net already laid to the nearest group of pads still apart, on any copper layer,
   changing layer through a via. Tracks follow the width and the clearance of their net class ; a net that owns a
   plane only needs a short stub and a via from each surface-mount pad. What it lays is marked `auto` ; manual and
   locked copper is kept and routed around. It is a first routing for a prototype : the designer reads it, locks
   what is right, moves a part and routes again. */

import { resolveBoard } from "./model.js";
import { connectivity } from "./connect.js";
import { dist, gap, trackShapes, discShape, shapeBox, edgeGap } from "./geom2d.js";
import { makeGrid, netMaps, padNodes, addTrack, addVia, Heap } from "./route_grid.js";

const SQ2 = Math.SQRT2, MOVES = [[1, 0, 1, 0], [-1, 0, 1, 0], [0, 1, 1, 1], [0, -1, 1, 1], [1, 1, SQ2, 2], [1, -1, SQ2, 2], [-1, 1, SQ2, 2], [-1, -1, SQ2, 2]];

/** Removes the copper laid by the router (or every track and via with all: true) ; locked copper stays. */
export function clearRoutes(board, { all = false, nets = null } = {}) {
  const drop = (x) => (all ? !x.locked : x.auto && !x.locked) && (!nets || nets.includes(x.net));
  board.tracks = (board.tracks || []).filter((t) => !drop(t)); board.vias = (board.vias || []).filter((v) => !drop(v));
}

/** One search : from the source states to the first state that passes `goal`. States are layer × node. */
function search(G, maps, S, sources, goal, targets, viaCost) {
  const { nx, ny, n, g } = G, nl = G.layers.length;
  S.epoch++;
  const heap = S.heap; heap.n = 0;
  const h = (k) => { if (!targets) return 0; const x = k % nx, y = (k - x) / nx; let best = Infinity; for (const t of targets) { const dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]), d = (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * g; if (d < best) best = d; } return best; };
  for (const s of sources) { const id = s.l * n + s.k; if (S.seen[id] === S.epoch) continue; S.seen[id] = S.epoch; S.cost[id] = 0; S.prev[id] = -1; heap.push(h(s.k), id); }
  while (heap.n) {
    const id = heap.pop(), l = Math.floor(id / n), k = id - l * n, c = S.cost[id];
    if (S.done[id] === S.epoch) continue;
    S.done[id] = S.epoch;
    if (goal(l, k) && S.prev[id] !== -1) { const path = []; for (let p = id; p !== -1; p = S.prev[p]) path.push({ l: Math.floor(p / n), k: p % n }); return path.reverse(); }
    const x = k % nx, y = (k - x) / nx, bl = maps.blocked[l], across = l % 2;      // even layers run mostly along X, odd layers along Y
    for (const [dx, dy, len, dir] of MOVES) {
      const x2 = x + dx, y2 = y + dy;
      if (x2 < 0 || y2 < 0 || x2 >= nx || y2 >= ny) continue;
      const k2 = y2 * nx + x2;
      if (bl[k2] && !S.open[k2]) continue;
      if (dir === 2 && ((bl[y * nx + x2] && !S.open[y * nx + x2]) || (bl[y2 * nx + x] && !S.open[y2 * nx + x]))) continue;     // never cut a corner between two obstacles
      const id2 = l * n + k2, c2 = c + len * g * (dir === 2 ? 1.1 : dir === across ? 1 : 1.35);
      if (S.seen[id2] === S.epoch && S.cost[id2] <= c2) continue;
      S.seen[id2] = S.epoch; S.cost[id2] = c2; S.prev[id2] = id; heap.push(c2 + h(k2), id2);
    }
    if (!maps.viaNo[k]) for (let l2 = 0; l2 < nl; l2++) {
      if (l2 === l || maps.blocked[l2][k]) continue;
      const id2 = l2 * n + k, c2 = c + viaCost;
      if (S.seen[id2] === S.epoch && S.cost[id2] <= c2) continue;
      S.seen[id2] = S.epoch; S.cost[id2] = c2; S.prev[id2] = id; heap.push(c2 + h(k), id2);
    }
  }
  return null;
}

/** A path of states → tracks (one per run on a layer, collinear points merged) and vias. */
function lay(G, path, net, w, via, first, last) {
  const tracks = [], vias = [];
  let run = [], layer = path[0].l;
  const flush = () => {
    if (run.length > 1) { const pts = [run[0]]; for (let i = 1; i < run.length; i++) { const a = pts[pts.length - 1], b = run[i], c = run[i + 1]; if (dist(a, b) < 1e-9) continue; if (c && Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0) continue; pts.push(b); }
      if (pts.length > 1) tracks.push({ net, layer: G.layers[layer], w, pts, auto: true }); }
    run = [];
  };
  path.forEach((s, i) => {
    if (s.l !== layer) { flush(); vias.push({ net, at: G.at(s.k), d: via[0], drill: via[1], auto: true }); layer = s.l; }
    if (i === 0 && first) run.push(first);
    run.push(G.at(s.k));
    if (i === path.length - 1 && last) run.push(last);
  });
  flush();
  return { tracks, vias };
}

function routeAll(board, lib, order, opts, t0) {
  const R = resolveBoard(board, lib), G = makeGrid(R, opts.grid ?? 0.25), nl = G.layers.length, size = nl * G.n;
  const S = { seen: new Int32Array(size), done: new Int32Array(size), cost: new Float32Array(size), prev: new Int32Array(size), open: new Uint8Array(G.n), heap: new Heap(4096), epoch: 0 };
  let tracks = [], vias = [];
  const failed = new Map(), viaCost = opts.viaCost ?? 6, li = (name) => G.layers.indexOf(name), byName = new Map(R.nets.map((n) => [n.name, n])), rips = new Map();
  const queue = [...order.filter((n) => byName.has(n)), ...R.nets.map((n) => n.name).filter((n) => !order.includes(n))].filter((n) => !opts.nets || opts.nets.includes(n));
  // pad groups of one net with the copper laid so far
  const groupsOf = (name) => connectivity({ ...R, nets: [byName.get(name)], tracks: [...R.tracks, ...tracks], vias: [...R.vias, ...vias.map((v) => ({ ...v, x: v.at[0], y: v.at[1] }))] }).nets[0].groups;
  const rip = (name) => { tracks = tracks.filter((t) => t.net !== name); vias = vias.filter((v) => v.net !== name); G.shapes = G.shapes.filter((sh) => !(sh.auto && sh.net === name)); rips.set(name, (rips.get(name) || 0) + 1); if (!queue.includes(name)) queue.push(name); };
  /** Exact check of new copper against everything on the board : `hard` when it crowds a pad, a hole, kept copper or the board
      edge ; `nets` = nets whose routed copper is in the way and could be ripped up. Nothing is laid without passing here. */
  const conflicts = (res, name) => {
    const mine = [...res.tracks.flatMap((t) => trackShapes(t).map((sh) => ({ s: sh, layers: [t.layer] }))), ...res.vias.map((v) => ({ s: discShape(v.at[0], v.at[1], v.d), layers: null }))], nets = new Set();
    let hard = false, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of mine) { m.box = shapeBox(m.s); x0 = Math.min(x0, m.box[0]); y0 = Math.min(y0, m.box[1]); x1 = Math.max(x1, m.box[2]); y1 = Math.max(y1, m.box[3]); if (edgeGap(m.s, R.outline) < R.fab.edge - 1e-6) hard = true; }
    for (const sh of G.shapes) {
      if (sh.net !== null && sh.net === name) continue;
      const clr = sh.clr ?? R.rules.clearance(name, sh.net), bx = sh.box || (sh.box = shapeBox(sh.s));
      if (bx[0] > x1 + clr || bx[2] < x0 - clr || bx[1] > y1 + clr || bx[3] < y0 - clr || (sh.auto && nets.has(sh.net))) continue;
      for (const m of mine) {
        if (m.layers && sh.layers && !m.layers.some((l) => sh.layers.includes(l))) continue;
        if (bx[0] > m.box[2] + clr || bx[2] < m.box[0] - clr || bx[1] > m.box[3] + clr || bx[3] < m.box[1] - clr || gap(m.s, sh.s) >= clr - 1e-6) continue;
        if (sh.auto) nets.add(sh.net); else hard = true;
        break;
      }
    }
    return { hard, nets: [...nets] };
  };
  let routed = 0;
  while (queue.length) {
    const name = queue.shift(), net = byName.get(name), rules = R.rules.of(name), plane = R.planes.find((p) => p.net === name), cache = new Map(), groups = groupsOf(name);
    failed.delete(name);
    if (groups.length < 2 && !plane) continue;
    const mapsFor = (w, via, loose = false) => { const key = `${w}/${via[0]}${loose ? "L" : ""}`; if (!cache.has(key)) cache.set(key, netMaps(G, name, w, via, R.planes, loose)); return cache.get(key); };
    const small = [R.fab.viaD, R.fab.drill], viaSet = small[0] < rules.via[0] - 1e-9 ? [rules.via, small] : [rules.via];     // the via of the class, then the smallest the shop drills
    // the width of the net class, grown for the current of the net ; a track narrows to enter a small pad (0.1 mm less than the pad) :
    // the branch that feeds one pin of a circuit does not carry the current of the whole net
    const widthFor = (pads) => { const lim = Math.min(...pads.map((i) => Math.min(R.pads[i].w, R.pads[i].h))) - 0.1, w = Math.round(Math.max(R.fab.track, Math.min(rules.track, lim)) * 100) / 100, thin = Math.max(R.fab.track, Math.min(rules.need, lim, 0.2)); return thin < w - 1e-9 ? [w, Math.round(thin * 100) / 100] : [w]; };
    const states = (pad, maps) => {                              // where a track may stand on a pad : free nodes first, the centre node if none is free
      const all = padNodes(G, pad), ls = pad.layers.map(li).filter((l) => l >= 0), out = [];
      for (const l of ls) { const free = all.filter((k) => !maps.blocked[l][k]); for (const k of free.length ? free : [G.near([pad.x, pad.y])]) out.push({ l, k, pad }); }
      return out;
    };
    const commit = (res) => { for (const t of res.tracks) { tracks.push(t); addTrack(G, t); } for (const v of res.vias) { vias.push(v); addVia(G, v); } cache.clear(); routed++; if (opts.onProgress) opts.onProgress({ done: routed, net: name }); };
    const fail = (from, to) => { if (!failed.has(name)) failed.set(name, []); failed.get(name).push({ net: name, from, to }); };
    /** One connection : search with every obstacle, at the full width then narrower ; if that fails, search as if the router's
        copper were not there and rip up what is in the way. */
    const connect = (widths, src, goalOf, targets, cost, finish) => {
      if (Date.now() - t0 > opts.maxMs) return false;
      for (const loose of [false, true]) for (const via of viaSet) for (const w of widths) {
        const maps = mapsFor(w, via, loose), s = src(maps), goal = goalOf(maps);
        if (!s.length) continue;
        S.open.fill(0); for (const x of s) S.open[x.k] = 1; if (goal.open) for (const x of goal.open) S.open[x.k] = 1;
        const path = search(G, maps, S, s, goal.test, targets ? targets(goal) : null, cost);
        if (!path) continue;
        const res = finish(path, s, goal, w, via), bad = conflicts(res, name);
        if (bad.hard || (!loose && bad.nets.length) || bad.nets.some((v) => (rips.get(v) || 0) >= 3)) continue;
        bad.nets.forEach(rip);
        commit(res); return path;
      }
      return false;
    };
    if (plane) {                                                 // a net with a plane : each surface-mount group drops a via into it
      for (const group of groups) {
        if (group.some((i) => R.pads[i].layers.includes(plane.layer))) continue;
        const ok = connect(widthFor(group), (maps) => group.flatMap((i) => states(R.pads[i], maps)), (maps) => ({ test: (l, k) => !maps.viaNo[k] && !maps.blocked[l][k] }), null, 0, (path, s, goal, w, via) => {
          const start = s.find((x) => x.k === path[0].k && x.l === path[0].l), res = lay(G, path, name, w, via, start ? [start.pad.x, start.pad.y] : null, null);
          res.vias.push({ net: name, at: G.at(path[path.length - 1].k), d: via[0], drill: via[1], auto: true }); return res;
        });
        if (!ok) fail(R.pads[group[0]].pin, "plan");
      }
      continue;
    }
    const gs = groups.map((g) => ({ pads: g })), tree = { pads: [...gs[0].pads], nodes: [] }, rest = gs.slice(1);
    while (rest.length) {
      let bi = 0, bd = Infinity;                                 // nearest group still apart
      rest.forEach((gp, i) => { for (const a of gp.pads) for (const b of tree.pads) { const d = dist([R.pads[a].x, R.pads[a].y], [R.pads[b].x, R.pads[b].y]); if (d < bd) { bd = d; bi = i; } } });
      const target = rest.splice(bi, 1)[0];
      // sources : the pads already joined and the nodes of the tracks laid for this net — a wider branch may not start where only a narrow track fits
      const from = (maps) => [...tree.pads.flatMap((i) => states(R.pads[i], maps)), ...tree.nodes.filter((x) => !maps.blocked[x.l][x.k])];
      const to = (maps) => { const dst = target.pads.flatMap((i) => states(R.pads[i], maps)), at = new Map(dst.map((x) => [x.l * G.n + x.k, x])); return { open: dst, at, test: (l, k) => at.has(l * G.n + k) }; };
      const path = connect(widthFor(target.pads), from, to, (goal) => goal.open.map((x) => [x.k % G.nx, Math.floor(x.k / G.nx)]), viaCost, (p, s, goal, w, via) => {
        const a = s.find((x) => x.k === p[0].k && x.l === p[0].l && x.pad), b = goal.at.get(p[p.length - 1].l * G.n + p[p.length - 1].k);
        return lay(G, p, name, w, via, a ? [a.pad.x, a.pad.y] : null, [b.pad.x, b.pad.y]);
      });
      if (!path) { fail(R.pads[tree.pads[0]].pin, R.pads[target.pads[0]].pin); continue; }
      tree.pads.push(...target.pads); for (const x of path) tree.nodes.push({ l: x.l, k: x.k });
    }
  }
  return { tracks, vias, failed: [...failed.values()].flat(), routed };
}

/** Routes every open connection. opts : { grid, maxMs, onProgress, nets, keep, viaCost, passes }.
    → { routed, total, open, failed: [{ net, from, to }], length, vias, ms, passes, complete } */
export function autoroute(board, lib = {}, opts = {}) {
  const t0 = Date.now(), o = { maxMs: 15000, passes: 2, ...opts };
  if (!o.keep) clearRoutes(board, { nets: o.nets || null });      // keep : the copper in place stays, only the missing links are laid
  const before = connectivity(resolveBoard(board, lib)).open;
  // order : nets that own a plane (short stubs), then grounds, then supplies, then signals — the shortest first in each family
  const R = resolveBoard(board, lib), planes = new Set(R.planes.map((p) => p.net)), rank = (n) => (planes.has(n.name) ? 0 : n.class === "ground" ? 1 : n.class === "signal" ? 3 : 2);
  const span = new Map(R.nets.map((n) => { const xs = n.pads.map((i) => R.pads[i].x), ys = n.pads.map((i) => R.pads[i].y); return [n.name, rank(n) * 1e6 + (n.pads.length ? Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) : 0)]; }));
  let order = [...span.keys()].sort((a, b) => span.get(a) - span.get(b)), best = null, passes = 0;
  for (; passes < o.passes; passes++) {
    const res = routeAll(board, lib, order, o, t0);
    if (!best || res.failed.length < best.failed.length) best = res;
    if (!res.failed.length || Date.now() - t0 > o.maxMs) { passes++; break; }
    const bad = [...new Set(res.failed.map((f) => f.net))];       // next pass : the nets that failed go first
    order = [...bad, ...order.filter((n) => !bad.includes(n))];
  }
  board.tracks = [...(board.tracks || []), ...best.tracks]; board.vias = [...(board.vias || []), ...best.vias];
  const length = best.tracks.reduce((s, t) => s + t.pts.reduce((a, p, i) => (i ? a + dist(t.pts[i - 1], p) : 0), 0), 0);
  const open = connectivity(resolveBoard(board, lib)).open;
  return { routed: before - open, total: before, open, failed: best.failed, length, vias: best.vias.length, ms: Date.now() - t0, passes, complete: open === 0 };
}

/** Figures of the copper laid on a board. → { tracks, vias, length, byLayer, byNet, open } */
export function routeStats(board, lib = {}) {
  const R = resolveBoard(board, lib), byLayer = {}, byNet = new Map(), len = (t) => t.pts.reduce((a, p, i) => (i ? a + dist(t.pts[i - 1], p) : 0), 0);
  for (const t of R.tracks) { const l = len(t); byLayer[t.layer] = (byLayer[t.layer] || 0) + l; const n = byNet.get(t.net) || { net: t.net, length: 0, vias: 0 }; n.length += l; byNet.set(t.net, n); }
  for (const v of R.vias) { const n = byNet.get(v.net) || { net: v.net, length: 0, vias: 0 }; n.vias++; byNet.set(v.net, n); }
  return { tracks: R.tracks.length, vias: R.vias.length, length: Object.values(byLayer).reduce((s, x) => s + x, 0), byLayer, byNet: [...byNet.values()].sort((a, b) => b.length - a.length), open: connectivity(R).open };
}
