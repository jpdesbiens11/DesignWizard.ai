/* DynamiteOrbit.ai — PCBA: the two layouts of a board.
   floorplan() is the CONCEPTUAL layout : one zone per function block, blocks that share nets side by side, blocks
   that hold imposed parts (connectors fixed by the mechanical design) around those parts.
   placeParts() is the first step of the DETAILED layout : inside each zone the largest part first, then every other
   part as close as possible to the pads it connects to — a decoupling capacitor against the supply pin it serves.
   Both are proposals : the designer moves zones and parts afterwards, and locks what must stay (fixed: true). */

import { resolveBoard, libraryOf, outlineOf, place, turned } from "./model.js";
import { connectivity, ratsnest } from "./connect.js";

const snap = (v, g = 0.25) => Math.round(v / g) * g;
const overlap = (a, b, gap = 0) => a[0] < b[2] + gap && b[0] < a[2] + gap && a[1] < b[3] + gap && b[1] < a[3] + gap;
const courtOf = (def) => def.courtyard || [def.body[0] + 0.5, def.body[1] + 0.5];
function boxAt(def, at, rot) { const [w, h] = turned(...courtOf(def), rot); return [at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2]; }
const bboxOf = (board) => { const o = outlineOf(board.board || {}), xs = o.map((p) => p[0]), ys = o.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const blockOfRef = (board) => new Map((board.parts || []).map((p) => [p.ref, p.block || null]));

/** How strongly two blocks are tied : the number of signal and supply nets they share (grounds do not count). */
function ties(board) {
  const owner = blockOfRef(board), w = new Map(), key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const n of board.nets || []) {
    if (n.class === "ground") continue;
    const bs = [...new Set(n.pins.map((p) => owner.get(p.slice(0, p.indexOf(".")))).filter(Boolean))];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) w.set(key(bs[i], bs[j]), (w.get(key(bs[i], bs[j])) || 0) + 1 / (bs.length - 1));
  }
  return (a, b) => w.get(key(a, b)) || 0;
}

/** Conceptual layout : gives every block a zone [x, y, w, h]. → { zones, fill, notes } */
export function floorplan(board, lib = {}, opts = {}) {
  const L = libraryOf(board, lib), bb = bboxOf(board), m = opts.margin ?? 1, area = [bb[0] + m, bb[1] + m, bb[2] - m, bb[3] - m], notes = [], tie = ties(board);
  const blocks = (board.blocks || []).map((b) => {
    const parts = (board.parts || []).filter((p) => p.block === b.id && L[p.comp]), fixed = parts.filter((p) => p.fixed && p.at);
    const need = parts.reduce((s, p) => s + courtOf(L[p.comp])[0] * courtOf(L[p.comp])[1], 0), big = Math.max(1, ...parts.map((p) => Math.max(...courtOf(L[p.comp]))));
    return { id: b.id, b, need: Math.max(need, 4), big, edge: parts.some((p) => p.edge), imposed: fixed.length > 0, anchor: fixed.length ? [fixed.reduce((s, p) => s + p.at[0], 0) / fixed.length, fixed.reduce((s, p) => s + p.at[1], 0) / fixed.length] : null, pos: null };
  });
  if (!blocks.length) return { zones: [], fill: 0, notes: ["Aucun bloc à implanter."] };
  // where each block wants to be : imposed parts pin it, edge blocks go to the rim, the others settle between their neighbours
  const cx = (area[0] + area[2]) / 2, cy = (area[1] + area[3]) / 2, W = area[2] - area[0], H = area[3] - area[1], rim = blocks.filter((k) => k.edge && !k.anchor);
  rim.forEach((k, i) => { const t = (i + 0.5) / rim.length * 2 * (W + H); k.anchor = t < H ? [area[0], area[3] - t] : t < H + W ? [area[0] + (t - H), area[1]] : t < 2 * H + W ? [area[2], area[1] + (t - H - W)] : [area[2] - (t - 2 * H - W), area[3]]; });
  blocks.forEach((k, i) => { k.pos = k.anchor ? [...k.anchor] : [cx + 0.01 * W * Math.cos(i * 2.4), cy + 0.01 * H * Math.sin(i * 2.4)]; });
  for (let it = 0; it < 60; it++) for (const k of blocks) {
    if (k.anchor) continue;
    let sx = 0, sy = 0, sw = 0;
    for (const o of blocks) { const w = o === k ? 0 : tie(k.id, o.id); sx += w * o.pos[0]; sy += w * o.pos[1]; sw += w; }
    if (sw > 0) k.pos = [0.5 * k.pos[0] + 0.5 * sx / sw, 0.5 * k.pos[1] + 0.5 * sy / sw];
  }
  const total = blocks.reduce((s, k) => s + k.need, 0), fill = (W * H) / total;
  if (fill < 1.6) notes.push(`La carte est petite pour ces blocs : ${String(Math.round(100 / fill)).replace(".", ",")} % de la surface serait couverte de composants. Agrandissez la carte ou passez des composants au-dessous.`);
  // recursive bisection : the rectangle is cut across its longer side, blocks sorted along it, areas in proportion
  const zones = [];
  const cut = (list, r) => {
    if (list.length === 1) { zones.push({ block: list[0].id, zone: [snap(r[0] + 0.25, 0.5), snap(r[1] + 0.25, 0.5), snap(r[2] - r[0] - 0.5, 0.5), snap(r[3] - r[1] - 0.5, 0.5)] }); return; }
    // cut across the direction along which the blocks are spread out ; when they are not, across the longer side
    const sp = [0, 1].map((i) => (Math.max(...list.map((k) => k.pos[i])) - Math.min(...list.map((k) => k.pos[i]))) / Math.max(1e-6, r[2 + i] - r[i]));
    const dims = [r[2] - r[0], r[3] - r[1]], pref = sp[0] > sp[1] ? 0 : 1;                        // … but never into thin strips
    const wide = Math.abs(sp[0] - sp[1]) > 0.15 && dims[pref] >= 0.6 * dims[1 - pref] ? pref === 0 : dims[0] >= dims[1], ax = wide ? 0 : 1, sorted = [...list].sort((a, c) => a.pos[ax] - c.pos[ax] || a.id.localeCompare(c.id, "fr", { numeric: true })), sum = sorted.reduce((s, k) => s + k.need, 0);
    let acc = 0, at = 1, best = Infinity;
    for (let i = 1; i < sorted.length; i++) { acc += sorted[i - 1].need; if (Math.abs(acc - sum / 2) < best) { best = Math.abs(acc - sum / 2); at = i; } }
    const a = sorted.slice(0, at), c = sorted.slice(at), share = a.reduce((s, k) => s + k.need, 0) / sum, lo = Math.max(...a.map((k) => k.big)), hi = Math.max(...c.map((k) => k.big));
    const span = wide ? r[2] - r[0] : r[3] - r[1];
    let len = Math.min(Math.max(span * share, Math.min(lo + 1, span / 2)), span - Math.min(hi + 1, span / 2));
    // imposed parts stay on their side of the cut
    // (a block that merely prefers the rim has no say here : its place on the rim is a wish, not a constraint)
    const keepLo = Math.max(-Infinity, ...a.filter((k) => k.imposed).map((k) => k.anchor[ax] - r[ax] + k.big / 2 + 0.5)), keepHi = Math.min(Infinity, ...c.filter((k) => k.imposed).map((k) => k.anchor[ax] - r[ax] - k.big / 2 - 0.5));
    if (keepLo <= keepHi) len = Math.min(Math.max(len, keepLo), keepHi, span - 1); len = Math.max(1, len);
    cut(a, wide ? [r[0], r[1], r[0] + len, r[3]] : [r[0], r[1], r[2], r[1] + len]); cut(c, wide ? [r[0] + len, r[1], r[2], r[3]] : [r[0], r[1] + len, r[2], r[3]]);
  };
  cut(blocks, area);
  for (const z of zones) board.blocks.find((b) => b.id === z.block).zone = z.zone;
  for (const k of blocks) if (k.anchor && !k.edge) { const z = k.b.zone; if (k.anchor[0] < z[0] || k.anchor[0] > z[0] + z[2] || k.anchor[1] < z[1] || k.anchor[1] > z[1] + z[3]) notes.push(`Le bloc ${k.id} « ${k.b.name} » a des composants imposés hors de sa zone : déplacez la zone ou libérez-les.`); }
  return { zones, fill, notes };
}

/** What is wrong with the zones, in plain French. */
export function zoneProblems(board, lib = {}) {
  const L = libraryOf(board, lib), bb = bboxOf(board), out = [], bs = (board.blocks || []).filter((b) => Array.isArray(b.zone)), rect = (z) => [z[0], z[1], z[0] + z[2], z[1] + z[3]];
  for (const b of board.blocks || []) if (!Array.isArray(b.zone)) out.push(`Le bloc ${b.id} « ${b.name} » n'a pas encore de zone.`);
  for (let i = 0; i < bs.length; i++) {
    const r = rect(bs[i].zone), parts = (board.parts || []).filter((p) => p.block === bs[i].id && L[p.comp]), need = parts.reduce((s, p) => s + courtOf(L[p.comp])[0] * courtOf(L[p.comp])[1], 0);
    if (r[0] < bb[0] - 1e-6 || r[1] < bb[1] - 1e-6 || r[2] > bb[2] + 1e-6 || r[3] > bb[3] + 1e-6) out.push(`La zone du bloc ${bs[i].id} « ${bs[i].name} » dépasse de la carte.`);
    if (need > bs[i].zone[2] * bs[i].zone[3] * 0.8) out.push(`La zone du bloc ${bs[i].id} « ${bs[i].name} » est trop petite pour ses ${parts.length} composants.`);
    for (let j = i + 1; j < bs.length; j++) if (overlap(r, rect(bs[j].zone), -0.01)) out.push(`Les zones des blocs ${bs[i].id} et ${bs[j].id} se recouvrent.`);
  }
  return out;
}

/** Detailed placement of the parts that are not fixed. opts : { only: [refs], keep, gap, grid }. → { placed, failed, wirelength, notes } */
export function placeParts(board, lib = {}, opts = {}) {
  const L = libraryOf(board, lib), R = resolveBoard(board, lib), bb = bboxOf(board), gap = opts.gap ?? 0.25, grid = opts.grid ?? 0.5, notes = [], failed = [];
  const info = new Map(R.parts.map((rp) => [rp.ref, { nets: rp.pads.map((i) => R.pads[i].net), def: rp.def }])), spec = new Map((board.parts || []).map((p) => [p.ref, p]));
  const groundish = new Set(R.nets.filter((n) => n.class === "ground").map((n) => n.name)), holes = R.holes.map((h) => [h.x - h.land / 2 - 0.5, h.y - h.land / 2 - 0.5, h.x + h.land / 2 + 0.5, h.y + h.land / 2 + 0.5]);
  const only = opts.only ? new Set(opts.only) : null, taken = [], netPads = new Map();     // taken : courtyard boxes ; netPads : net → positions of pads already placed
  const padsAt = (p, at, rot) => info.get(p.ref).def.pads.map((pad) => place([pad.x, pad.y], { at, rot, side: p.side }));
  const commit = (p) => { taken.push({ ref: p.ref, box: boxAt(info.get(p.ref).def, p.at, p.rot || 0), side: p.side || "top" }); padsAt(p, p.at, p.rot || 0).forEach((pt, i) => { const n = info.get(p.ref).nets[i]; if (n) { if (!netPads.has(n)) netPads.set(n, []); netPads.get(n).push({ pt, ref: p.ref, n: info.get(p.ref).def.pads[i].n }); } }); };
  // a part keeps 1 mm from the board edge ; an edge part (a connector) may sit flush : its courtyard may overhang by 0.6 mm, its body may not
  const legal = (box, side, edge) => { const m = edge ? -0.6 : 1; return box[0] >= bb[0] + m - 1e-6 && box[1] >= bb[1] + m - 1e-6 && box[2] <= bb[2] - m + 1e-6 && box[3] <= bb[3] - m + 1e-6
    && !holes.some((h) => overlap(box, h)) && !taken.some((t) => t.side === side && overlap(box, t.box, gap)); };
  const todo = [];
  for (const p of board.parts || []) {
    if (!info.has(p.ref)) continue;
    const stay = p.fixed || (only && !only.has(p.ref)) || (opts.keep && p.at && legal(boxAt(info.get(p.ref).def, p.at, p.rot || 0), p.side || "top", p.edge));
    if (stay && p.at) commit(p); else todo.push(p);
  }
  const size = (p) => { const c = courtOf(info.get(p.ref).def); return c[0] * c[1]; };
  // order : connectors on the edge, then block by block — the part the others gather around, its decoupling capacitors (each against
  // its supply pin), the rest of its satellites in the order of the template, then what is left ; fiducials last
  const hubs = new Set((board.parts || []).map((p) => p.near).filter(Boolean)), blockNo = new Map((board.blocks || []).map((k, i) => [k.id, i]));
  const tier = (p) => (hubs.has(p.ref) && !p.near ? 0 : p.near && p.pin ? 1 : p.near ? 2 : 3);
  todo.sort((a, b) => (b.edge ? 1 : 0) - (a.edge ? 1 : 0) || (a.corner ? 1 : 0) - (b.corner ? 1 : 0) || (blockNo.get(a.block) ?? 1e6) - (blockNo.get(b.block) ?? 1e6) || tier(a) - tier(b) || (tier(a) === 0 || tier(a) === 3 ? size(b) - size(a) : 0));
  const zoneOf = (p) => { const b = (board.blocks || []).find((x) => x.id === p.block); return b && Array.isArray(b.zone) ? [b.zone[0], b.zone[1], b.zone[0] + b.zone[2], b.zone[1] + b.zone[3]] : [bb[0] + 1, bb[1] + 1, bb[2] - 1, bb[3] - 1]; };
  const cost = (p, at, rot, zone) => {
    const pts = padsAt(p, at, rot), nets = info.get(p.ref).nets, def = info.get(p.ref).def;
    let c = 0, linked = 0;
    pts.forEach((pt, i) => {
      const others = (netPads.get(nets[i]) || []).filter((o) => o.ref !== p.ref); if (!others.length) return;
      const want = p.near && p.pin ? others.filter((o) => o.ref === p.near && o.n === String(p.pin)) : p.near ? others.filter((o) => o.ref === p.near) : [];
      const d = Math.min(...(want.length ? want : others).map((o) => Math.hypot(o.pt[0] - pt[0], o.pt[1] - pt[1])));
      c += d * (want.length ? 4 : groundish.has(nets[i]) ? 0.3 : 1) / Math.sqrt(def.pads.length / 2); linked++;
    });
    const centre = Math.hypot(at[0] - (zone[0] + zone[2]) / 2, at[1] - (zone[1] + zone[3]) / 2);
    c += linked ? (p.near ? 0 : 0.15 * centre) : 0.5 * centre;     // the main part of a block leans towards the middle of its zone
    return c;
  };
  const search = (p, zone, edge) => {
    const def = info.get(p.ref).def, rots = def.pads.length === 1 ? [0] : [0, 90, 180, 270];
    let best = null;
    for (const rot of rots) {
      const [w, h] = turned(...courtOf(def), rot), [bw, bh] = turned(def.body[0], def.body[1], rot);
      const cand = [];
      if (edge) {                                                // flush with the board edge the zone touches, long side along it
        const sides = [[zone[0] - bb[0], "L"], [bb[2] - zone[2], "R"], [zone[1] - bb[1], "B"], [bb[3] - zone[3], "T"]].sort((a, b) => a[0] - b[0]).filter((s, i, all) => s[0] <= all[0][0] + 1.5);
        for (const [, s] of sides) {
          if (s === "L" || s === "R" ? bh < bw : bw < bh) continue;
          if (s === "L" || s === "R") for (let y = zone[1] + h / 2; y <= zone[3] - h / 2 + 1e-6; y += grid) cand.push([s === "L" ? bb[0] + bw / 2 : bb[2] - bw / 2, snap(y)]);
          else for (let x = zone[0] + w / 2; x <= zone[2] - w / 2 + 1e-6; x += grid) cand.push([snap(x), s === "B" ? bb[1] + bh / 2 : bb[3] - bh / 2]);
        }
      } else for (let x = zone[0] + w / 2; x <= zone[2] - w / 2 + 1e-6; x += grid) for (let y = zone[1] + h / 2; y <= zone[3] - h / 2 + 1e-6; y += grid) cand.push([snap(x), snap(y)]);
      for (const at of cand) {
        if (!legal(boxAt(def, at, rot), p.side || "top", edge)) continue;
        const k = cost(p, at, rot, zone);
        if (!best || k < best.k - 1e-9) best = { at, rot, k };
      }
    }
    return best;
  };
  let placed = 0;
  for (const p of todo) {
    const zone = zoneOf(p), whole = [bb[0] + 1, bb[1] + 1, bb[2] - 1, bb[3] - 1];
    let hit = null;
    if (p.corner) {                                               // fiducials : one per corner, 3 mm in, slid along the edge until free
      const cs = [[bb[0] + 3, bb[1] + 3, 1], [bb[2] - 3, bb[1] + 3, -1], [bb[0] + 3, bb[3] - 3, 1], [bb[2] - 3, bb[3] - 3, -1]], c = cs[(p.corner - 1) % 4];
      for (let k = 0; k < 40 && !hit; k++) { const at = [snap(c[0] + c[2] * k * 1.5), c[1]]; if (legal(boxAt(info.get(p.ref).def, at, 0), p.side || "top", false)) hit = { at, rot: 0 }; }
    }
    // a part that others gather around keeps 2.5 mm of its zone free on every side, for them
    const room = hubs.has(p.ref) && !p.edge && zone[2] - zone[0] > 12 && zone[3] - zone[1] > 12 ? [zone[0] + 2.5, zone[1] + 2.5, zone[2] - 2.5, zone[3] - 2.5] : zone;
    if (!hit) hit = search(p, room, !!p.edge) || (room !== zone ? search(p, zone, false) : null) || (p.edge ? search(p, whole, true) : null) || search(p, zone, false);
    if (!hit && !p.edge) { hit = search(p, whole, false); if (hit) notes.push(`${p.ref} ne tenait pas dans la zone de son bloc : placé à côté.`); }
    if (!hit) { failed.push(p.ref); continue; }
    p.at = hit.at; p.rot = hit.rot; p.side = p.side || "top"; commit(p); placed++;
  }
  if (failed.length) notes.push(`${failed.length} composant(s) sans place : ${failed.join(", ")}. Agrandissez la carte ou la zone du bloc.`);
  const R2 = resolveBoard(board, lib);
  return { placed, failed, wirelength: ratsnest(R2, connectivity(R2)).reduce((s, l) => s + l.length, 0), notes };
}

/** Placement faults : courtyards that overlap, parts off the board, parts outside the zone of their block. → [{ refs, message, at }] */
export function placementProblems(board, lib = {}) {
  const R = resolveBoard(board, lib), bb = R.bbox, out = [], spec = new Map((board.parts || []).map((p) => [p.ref, p]));
  for (let i = 0; i < R.parts.length; i++) {
    const a = R.parts[i], s = spec.get(a.ref) || {};
    if (!s.at) { out.push({ refs: [a.ref], message: `${a.ref} n'est pas encore placé.`, at: [a.x, a.y] }); continue; }
    const body = s.edge ? [a.x - a.w / 2, a.y - a.h / 2, a.x + a.w / 2, a.y + a.h / 2] : a.box;      // a connector on the edge is judged on its body
    if (body[0] < bb[0] - 1e-6 || body[1] < bb[1] - 1e-6 || body[2] > bb[2] + 1e-6 || body[3] > bb[3] + 1e-6) out.push({ refs: [a.ref], message: `${a.ref} dépasse du contour de la carte.`, at: [a.x, a.y] });
    const b = (board.blocks || []).find((x) => x.id === a.block);
    if (b && Array.isArray(b.zone) && !s.edge && !s.corner && (a.x < b.zone[0] || a.x > b.zone[0] + b.zone[2] || a.y < b.zone[1] || a.y > b.zone[1] + b.zone[3])) out.push({ refs: [a.ref], message: `${a.ref} est hors de la zone du bloc ${b.id}.`, at: [a.x, a.y] });
    for (let j = i + 1; j < R.parts.length; j++) { const c = R.parts[j]; if (spec.get(c.ref) && spec.get(c.ref).at && a.side === c.side && overlap(a.box, c.box, -0.01)) out.push({ refs: [a.ref, c.ref], message: `${a.ref} et ${c.ref} se recouvrent.`, at: [(a.x + c.x) / 2, (a.y + c.y) / 2] }); }
  }
  return out;
}
