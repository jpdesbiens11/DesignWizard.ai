/* DynamiteOrbit — PCBA: copper laid by hand. The router proposes ; the designer finishes — a track drawn click by
   click, a via, a corner moved, a stretch removed. Hand copper carries no « auto » mark : the router routes around it
   and never takes it away. Nothing is laid that crowds a pad, a hole, other copper or the board edge : every piece is
   checked against the rules of its net first, and the reason is given when it is refused. */

import { resolveBoard } from "./model.js";
import { padShape, discShape, trackShapes, gap, shapeBox, edgeGap, ptSeg, dist, inPoly } from "./geom2d.js";

const r3 = (v) => Math.round(v * 1000) / 1000, fr = (v) => String(Math.round(v * 100) / 100).replace(".", ",");

/** What a piece of copper of net `net` would crowd. piece : { pts, w, layer } (a track) or { at, d, drill } (a via) ;
    skip : { track, via } indices of pieces to leave out (the piece being moved). → [{ text, gap, need }] */
export function copperFaults(board, lib, net, piece, skip = {}, R = resolveBoard(board, lib)) {
  const via = !piece.pts, mine = via ? [discShape(piece.at[0], piece.at[1], piece.d)] : trackShapes(piece), layers = via ? null : [piece.layer], out = [], seen = new Set();
  const hit = (s, sNet, sLayers, what, clr = R.rules.clearance(net, sNet)) => {
    if (sNet !== null && sNet === net) return;
    if (layers && sLayers && !sLayers.includes(piece.layer)) return;
    const bx = shapeBox(s);
    for (const m of mine) { const mb = shapeBox(m); if (bx[0] > mb[2] + clr || bx[2] < mb[0] - clr || bx[1] > mb[3] + clr || bx[3] < mb[1] - clr) continue; const g = gap(m, s); if (g < clr - 1e-6 && !seen.has(what)) { seen.add(what); out.push({ text: `${fr(Math.max(0, g))} mm de ${what} : il en faut ${fr(clr)}`, gap: g, need: clr }); } }
  };
  for (const m of mine) { if (!inPoly(via ? piece.at : m.a, R.outline) || edgeGap(m, R.outline) < R.fab.edge - 1e-6) { out.push({ text: `à moins de ${fr(R.fab.edge)} mm du bord de la carte`, gap: 0, need: R.fab.edge }); break; } }
  for (const p of R.pads) hit(padShape(p), p.net, p.layers, `la pastille ${p.pin}`);
  for (const h of R.holes) hit(discShape(h.x, h.y, Math.max(h.land, h.d)), "#trou", null, "un trou de fixation", 0.5);
  (board.tracks || []).forEach((t, k) => { if (k !== skip.track) for (const s of trackShapes(t)) hit(s, t.net, [t.layer], `une piste de ${t.net}`); });
  (board.vias || []).forEach((v, k) => { if (k !== skip.via) hit(discShape(v.at[0], v.at[1], v.d), v.net, null, `un via de ${v.net}`); });
  if (via) {                                                    // drilled holes keep their distance, whatever their net
    for (const v of board.vias || []) if (dist(v.at, piece.at) > 1e-6 && dist(v.at, piece.at) - (v.drill + piece.drill) / 2 < R.fab.holeGap - 1e-6) out.push({ text: `perçage à moins de ${fr(R.fab.holeGap)} mm d'un autre via`, gap: 0, need: R.fab.holeGap });
    for (const p of R.pads) if (p.drill && Math.hypot(p.x - piece.at[0], p.y - piece.at[1]) - (p.drill + piece.drill) / 2 < R.fab.holeGap - 1e-6 && p.net !== net) out.push({ text: `perçage trop près de celui de ${p.pin}`, gap: 0, need: R.fab.holeGap });
  }
  return out;
}

/** What lies under a point : a pad first, then a via, then a track of one of the layers shown. → { net, pin, pad, via, track, layer, at } or null */
export function pickCopper(board, lib, pt, layers = null, R = resolveBoard(board, lib)) {
  const on = (l) => !layers || layers.includes(l), probe = discShape(pt[0], pt[1], 0.02);
  for (const p of R.pads) if (p.layers.some(on) && gap(probe, padShape(p)) <= 0) return { net: p.net, pin: p.pin, pad: p, layer: p.layers.find(on), at: [p.x, p.y] };
  for (let k = (board.vias || []).length - 1; k >= 0; k--) { const v = board.vias[k]; if (dist(v.at, pt) <= v.d / 2) return { net: v.net, via: k, at: [...v.at] }; }
  for (let k = (board.tracks || []).length - 1; k >= 0; k--) { const t = board.tracks[k]; if (!on(t.layer)) continue; for (let i = 1; i < t.pts.length; i++) if (ptSeg(pt, t.pts[i - 1], t.pts[i]) <= t.w / 2 + 0.03) return { net: t.net, track: k, seg: i - 1, layer: t.layer, at: pt }; }
  return null;
}

/** Where a click of the pen lands : the centre of a pad or a via of the net, an end or a corner of one of its tracks,
    a point on one of them — otherwise the grid. → { at, on: "pad" | "via" | "track" | "grid", pin } */
export function snapPoint(board, lib, pt, o = {}, R = resolveBoard(board, lib)) {
  const reach = o.reach ?? 0.5, g = o.grid ?? 0.125, on = (l) => !o.layer || l === o.layer;
  let best = null; const take = (at, kind, d, extra = {}) => { if (d <= reach && (!best || d < best.d)) best = { at: [r3(at[0]), r3(at[1])], on: kind, d, ...extra }; };
  for (const p of R.pads) if (p.net === o.net && p.net !== null && p.layers.some(on)) { const d = gap(discShape(pt[0], pt[1], 0.02), padShape(p)); if (d <= 0) take([p.x, p.y], "pad", 0, { pin: p.pin }); else take([p.x, p.y], "pad", Math.hypot(p.x - pt[0], p.y - pt[1]), { pin: p.pin }); }
  for (const v of board.vias || []) if (v.net === o.net) take(v.at, "via", Math.max(0, dist(v.at, pt) - v.d / 2));
  if (!best || best.d > 0) for (const t of board.tracks || []) if (t.net === o.net && on(t.layer)) for (const q of t.pts) take(q, "track", dist(q, pt) * 1.01 + 0.01);
  if (best) return best;
  return { at: [r3(Math.round(pt[0] / g) * g), r3(Math.round(pt[1] / g) * g)], on: "grid", d: 0 };
}

/** The point nearest `to` that leaves `from` at 0, 45 or 90 degrees. */
export function angle45(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 1e-9 && ay < 1e-9) return [...from];
  if (ay < ax * 0.4142) return [to[0], from[1]];
  if (ax < ay * 0.4142) return [from[0], to[1]];
  const m = (ax + ay) / 2; return [r3(from[0] + Math.sign(dx) * m), r3(from[1] + Math.sign(dy) * m)];
}

const tidy = (pts) => pts.map((p) => [r3(p[0]), r3(p[1])]).filter((p, i, a) => !i || dist(p, a[i - 1]) > 1e-6).filter((p, i, a) => !i || i === a.length - 1 || Math.abs((p[0] - a[i - 1][0]) * (a[i + 1][1] - p[1]) - (p[1] - a[i - 1][1]) * (a[i + 1][0] - p[0])) > 1e-9);
/** The width and the via of a net by its rules ; a track entering a narrow pad may be drawn thinner by hand. */
export function penOf(board, lib, net, R = resolveBoard(board, lib)) { const r = R.rules.of(net); return { w: r.track, via: r.via, min: R.fab.track, clearance: r.clearance }; }

/** Lays a hand track. → { ok, faults, index } ; nothing is laid when a rule is broken. */
export function addTrack(board, lib, { net, layer, pts, w }) {
  const R = resolveBoard(board, lib), clean = tidy(pts);
  if (!R.nets.some((n) => n.name === net)) return { ok: false, faults: [{ text: `le net « ${net} » n'existe pas` }] };
  if (!R.layers.includes(layer) || R.planes.some((p) => p.layer === layer && p.net !== net)) return { ok: false, faults: [{ text: "cette couche est un plan : on n'y trace pas de piste" }] };
  if (clean.length < 2) return { ok: false, faults: [{ text: "une piste a au moins deux points" }] };
  const width = Math.max(R.fab.track, w || R.rules.of(net).track), faults = copperFaults(board, lib, net, { pts: clean, w: width, layer }, {}, R);
  if (faults.length) return { ok: false, faults };
  board.tracks = board.tracks || []; board.tracks.push({ net, layer, w: width, pts: clean });
  return { ok: true, faults: [], index: board.tracks.length - 1 };
}
/** Lays a hand via. → { ok, faults, index } */
export function addVia(board, lib, { net, at, d, drill }) {
  const R = resolveBoard(board, lib), size = R.rules.of(net).via, v = { net, at: [r3(at[0]), r3(at[1])], d: d || size[0], drill: drill || size[1] };
  if ((board.vias || []).some((x) => x.net === net && dist(x.at, v.at) < 1e-6)) return { ok: true, faults: [], index: board.vias.findIndex((x) => x.net === net && dist(x.at, v.at) < 1e-6) };
  const faults = copperFaults(board, lib, net, v, {}, R);
  if (faults.length) return { ok: false, faults };
  board.vias = board.vias || []; board.vias.push(v);
  return { ok: true, faults: [], index: board.vias.length - 1 };
}
/** Takes one piece away : { track: index } or { via: index }. */
export function removeCopper(board, pick) {
  if (pick.track !== undefined && board.tracks[pick.track]) { board.tracks.splice(pick.track, 1); return true; }
  if (pick.via !== undefined && board.vias[pick.via]) { board.vias.splice(pick.via, 1); return true; }
  return false;
}
/** Keeps a piece laid by the router as if it had been drawn by hand (the router will not take it away), or gives it back. */
export function keepCopper(board, pick, keep = true) { const x = pick.track !== undefined ? board.tracks[pick.track] : board.vias[pick.via]; if (!x) return false; if (keep) delete x.auto; else x.auto = true; return true; }
/** Moves one corner of a track ; refused when the new shape breaks a rule. → { ok, faults } */
export function moveCorner(board, lib, track, corner, to) {
  const t = (board.tracks || [])[track]; if (!t || !t.pts[corner]) return { ok: false, faults: [{ text: "ce sommet n'existe plus" }] };
  const pts = t.pts.map((p, i) => (i === corner ? [r3(to[0]), r3(to[1])] : p)), faults = copperFaults(board, lib, t.net, { pts, w: t.w, layer: t.layer }, { track });
  if (faults.length) return { ok: false, faults };
  t.pts = pts; delete t.auto;
  return { ok: true, faults: [] };
}
