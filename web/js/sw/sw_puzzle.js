/* DynamiteOrbit.ai — Logiciel : the PUZZLE view, ONE link per pair of pieces (demande de JP, 24 novembre 2026 : « une vue simplifiée du schéma
   bloc qui branche en arrière-plan ses bonnes interfaces pour être fonctionnelle, mais qui montre un seul lien en UI, comme Node-RED pour les
   débutants… après un super spaghetti de liens dans un gros logiciel LabVIEW, ça devient vite incompréhensible… des pièces de casse-tête qui
   ont des interfaces compatibles » ; choix cliqué : « Casse-tête 2D, 1 lien »).
   The design does not change : this file only says how it is SEEN.
     - a PIECE is what a beginner names : a sensor and the block that reads it are one piece (« CTN · 25 °C »), an output pin and the
       actuator it drives are one piece ; every other block is a piece of its own ;
     - three BANDS, left to right : what senses, what decides, what acts — decisions spread over as many columns as they chain ;
     - ONE LINK between two pieces, however many wires join them (the count is said on the link) ;
     - CONNECTING two pieces wires their right ports in the background : every free input of the second that an output of the first fits
       (sw/sw_design.js wireCheck), the first that fits for each — the ports are not shown.
   Pure : no page. */

import { KINDS, portsOf, cfgOf } from "./sw_objects.js";
import { liveWires, split, wireCheck } from "./sw_design.js";
import { DEVICES } from "./sw_devices.js";
import { typeOf, REF_BY_UNIT } from "./sw_blocks.js";
import { freeSlots } from "./sw_snap.js";

export const BANDS = [
  { id: "sense", fr: "Capter", says: "Ce que le logiciel apprend du monde : un capteur, un bouton, un contact.", color: "#0f766e", icon: "sensor" },
  { id: "decide", fr: "Décider", says: "Comparer, attendre, retenir, réguler : ce qui fait d'une mesure une décision.", color: "#7c3aed", icon: "wizard" },
  { id: "act", fr: "Agir", says: "Ce que le logiciel commande : une bobine, un témoin, une vanne.", color: "#dc2626", icon: "power" },
];
const live = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]);
/** The pieces of a design. → [{ id (the object that names the piece), members: [ids], band, title, icon, kind, device?, show: { ref, unit } | null }] */
export function pieces(d) {
  const objs = live(d), W = liveWires(d), O = Object.fromEntries(objs.map((o) => [o.id, o])), taken = new Set(), out = [];
  const reader = (pin) => { const K = KINDS[pin.kind]; if (K.pin !== "ain" && K.pin !== "din") return null; const port = K.ports.out[0].key, ws = W.filter((w) => w.from === `${pin.id}.${port}`); if (ws.length !== 1) return null; const r = O[split(ws[0].to)[0]]; return r && (r.kind === "analog_in" || r.kind === "debounce") ? r : null; };
  for (const p of objs.filter((o) => KINDS[o.kind].pin === "ain" || KINDS[o.kind].pin === "din")) { const r = reader(p), D = p.device && DEVICES[p.device], main = r || p;
    out.push({ id: main.id, members: r ? [p.id, r.id] : [p.id], band: "sense", title: D ? D.label : r ? r.name : p.name, icon: D ? D.icon : KINDS[main.kind].icon, kind: main.kind, device: p.device || null, show: { ref: `${main.id}.${KINDS[main.kind].ports.out[0].key}`, unit: portsOf(main).out[0].unit } }); taken.add(p.id); if (r) taken.add(r.id); }
  for (const o of objs.filter((x) => KINDS[x.kind].pin === "dout")) { const D = o.device && DEVICES[o.device], w = W.find((x) => x.to === `${o.id}.level`), drv = w && O[split(w.from)[0]], cmd = drv && KINDS[drv.kind].nature === "command" && !taken.has(drv.id) ? drv : null;      // a driver and the pin it drives : one piece
    out.push({ id: cmd ? cmd.id : o.id, members: cmd ? [cmd.id, o.id] : [o.id], band: "act", title: cmd ? cmd.name : D ? D.label : o.name.replace(/^Sortie\s*:\s*/i, ""), icon: D ? D.icon : cmd ? KINDS[cmd.kind].icon : "power", kind: (cmd || o).kind, device: o.device || null, show: { ref: `${o.id}.level`, unit: "0/1" } }); taken.add(o.id); if (cmd) taken.add(cmd.id); }
  /* a gate grown in cascade (sw/sw_snap.js growInto) belongs to the piece of its head : one piece, as tall as its inputs */
  const grown = (id) => objs.filter((x) => x.grownOf === id).map((x) => x.id);
  for (const o of objs.filter((x) => !taken.has(x.id) && !(x.grownOf && O[x.grownOf]))) { const K = KINDS[o.kind], first = portsOf(o).out[0], g = grown(o.id); out.push({ id: o.id, members: [o.id, ...g], band: K.nature === "command" ? "act" : K.nature === "measure" ? "sense" : "decide", title: g.length ? `${o.name} (${g.length + 2} entrées)` : o.name, icon: K.icon, kind: o.kind, device: null, show: first ? { ref: `${o.id}.${first.key}`, unit: first.unit } : null }); }
  return out;
}
/** The pieces each object belongs to. */
const owner = (P) => { const m = {}; for (const p of P) for (const id of p.members) m[id] = p.id; return m; };
/** ONE link per pair of pieces. → [{ from, to (piece ids), wires: [wire], types: [type], delay }] */
export function links(d, P = pieces(d)) {
  const own = owner(P), by = new Map();
  for (const w of liveWires(d)) { const a = own[split(w.from)[0]], b = own[split(w.to)[0]]; if (!a || !b || a === b) continue; const k = `${a}>${b}`; if (!by.has(k)) by.set(k, { from: a, to: b, wires: [], types: [], delay: false });
    const L = by.get(k), o = (d.objects || []).find((x) => x.id === split(w.from)[0]), port = o && portsOf(o).out.find((p) => p.key === split(w.from)[1]); L.wires.push(w); if (port) { const t = typeOf(port.unit); if (!L.types.includes(t)) L.types.push(t); } if (w.delay) L.delay = true; }
  return [...by.values()];
}
/** Where each piece goes : its band, and in the band of the decisions one column per step of the chain. → { layout: { id: { x, y, col } }, cols: [{ band, x }], w, h } */
export const PIECE = { W: 210, H: 92, COL: 280, GAP: 26, TOP: 54 };
export function puzzleLayout(d, P = pieces(d), L = links(d, P)) {
  const depth = {}, dec = P.filter((p) => p.band === "decide"), feeders = (id) => L.filter((l) => l.to === id && !l.delay).map((l) => l.from);
  for (let pass = 0; pass < dec.length + 1; pass++) for (const p of dec) depth[p.id] = Math.max(0, ...feeders(p.id).filter((f) => dec.some((q) => q.id === f)).map((f) => (depth[f] ?? 0) + 1));
  const nDec = dec.length ? Math.max(...dec.map((p) => depth[p.id])) + 1 : 1, colOf = (p) => (p.band === "sense" ? 0 : p.band === "act" ? nDec + 1 : 1 + depth[p.id]), cols = [];
  for (let c = 0; c < nDec + 2; c++) cols.push({ band: c === 0 ? "sense" : c === nDec + 1 ? "act" : "decide", x: 20 + c * PIECE.COL });
  const layout = {}, inCol = {}; for (const p of P) (inCol[colOf(p)] = inCol[colOf(p)] || []).push(p);
  for (const c of Object.keys(inCol).map(Number).sort((a, b) => a - b)) { const at = (p) => { const f = feeders(p.id).map((x) => layout[x]).filter(Boolean); return f.length ? f.reduce((s, q) => s + q.y, 0) / f.length : Infinity; };
    let y = PIECE.TOP; for (const p of [...inCol[c]].sort((a, b) => at(a) - at(b))) { const want = at(p), top = Number.isFinite(want) ? Math.max(y, Math.round(want)) : y; layout[p.id] = { x: cols[c].x, y: top, col: c }; y = top + PIECE.H + PIECE.GAP; } }
  const h = Math.max(PIECE.TOP + PIECE.H, ...Object.values(layout).map((q) => q.y + PIECE.H)) + 30;
  return { layout, cols, w: 20 + cols.length * PIECE.COL, h };
}
/** Connects piece A to piece B in the background : for each free input of B's members, the first output of A's members that fits — a block whose
    unit follows a parameter takes the unit of what it is given (with a reference value of that unit, sw/sw_blocks.js REF_BY_UNIT).
    → { wires: [wire], set: { objId: params } } — no wire : they do not fit */
export function connectPieces(d, A, B) {
  const P = pieces(d), pa = P.find((p) => p.id === A), pb = P.find((p) => p.id === B), none = { wires: [], set: {} }; if (!pa || !pb || A === B) return none;
  const W0 = liveWires(d), taken = new Set(W0.map((w) => w.to)), O = Object.fromEntries(live(d).map((o) => [o.id, o])), outs = [], set = {}, wires = [];
  for (const id of [...pa.members].reverse()) for (const p of portsOf(O[id]).out) outs.push({ ref: `${id}.${p.key}`, unit: p.unit });      // the piece's own output first : the measure, not the raw counts
  const inner = (to) => pb.members.some((m) => W0.some((w) => w.to === to && split(w.from)[0] === m));
  for (const id of pb.members) for (const p of portsOf(O[id]).in) { const to = `${id}.${p.key}`; if (taken.has(to) || inner(to) || (p.free && wires.length)) continue;
    const K = KINDS[O[id].kind], raw = (K.ports.in.find((q) => q.key === p.key) || {}).unit, U = K.params.find((q) => q.key === "unit");
    let hit = outs.find((f) => { const c = wireCheck(d, f.ref, to); return c.ok && !c.level; });
    if (!hit && raw === "*" && U && !set[id]) { hit = outs.find((f) => U.choices.includes(f.unit) && wireCheck({ ...d, objects: d.objects.map((q) => (q.id === id ? { ...q, params: { ...(q.params || {}), unit: f.unit } } : q)) }, f.ref, to).ok); if (hit) set[id] = { unit: hit.unit, ...((REF_BY_UNIT[O[id].kind] || {})[hit.unit] || {}) }; }
    if (hit) { wires.push({ from: hit.ref, to }); taken.add(to); } }
  return { wires, set };
}
/** What a piece shows now, in words a beginner reads : its title and the value of its main output. */
export const pieceUnit = (p) => (p.show ? p.show.unit : "");
export { cfgOf };

/* ---------- WITHOUT A WIRE (demande de JP, 25 novembre 2026 : « enlever les lignes pour connecter directement les blocs par l'interface
   physique… des blocs connectés par une interface dont le keying peut différer selon le type de compatibilité » ; puis « s'il faut dupliquer une
   fonction pour la mettre à 3 places mais pouvoir ouvrir un bloc d'interface où on voit la combinaison de tout, let's do it… simple, compris
   d'un coup d'œil ») : the pieces SNAP. Every action ends a row ; what feeds a piece sits against its left edge, the tab of one in the notch of
   the other, keyed by the type it carries (sw/sw_blocks.js keyPath) ; a piece that takes two branches is as tall as both. A piece that feeds
   several others is laid ONCE, where it is first needed ; elsewhere it is a TWIN — the same piece, dashed, its value live — that opens the
   interface block : what it takes, and every place it goes. A loop (the value of the step before) is a twin marked ↺.
   What it follows : the rungs of ladder logic (IEC 61131-3), one output per rung, a contact repeated as often as it is read ; the stacks of
   block languages (Scratch) that snap without a wire. Pure : no page. */
export const SNAP = { W: 196, H: 64, GAP: 12, TREE: 30, TOP: 20, SLOT: 30 };
const keyType = (l) => (l && l.types[0]) || "quantity";
/** → { nodes: [{ key, id, twin, loop, type (of the tab toward its parent), count (wires), parent, x, y, w, h, col, ins: [{ y, type }] }],
         rows: [{ root, y, h }], copies: { pieceId: number of places it plugs }, w, h } */
export function puzzleForest(d, P = pieces(d), L = links(d, P)) {
  const by = Object.fromEntries(P.map((p) => [p.id, p])), feed = (id) => L.filter((l) => l.to === id && !l.delay), loop = (id) => L.filter((l) => l.to === id && l.delay);
  const outs = (id) => L.filter((l) => l.from === id && !l.delay), reach = {};
  const size = (id, seen = new Set()) => { if (seen.has(id)) return 0; seen.add(id); return 1 + feed(id).reduce((s, l) => s + size(l.from, seen), 0); };
  for (const p of P) reach[p.id] = size(p.id);
  const rank = { act: 0, decide: 1, sense: 2 }, sinks = P.filter((p) => !outs(p.id).length).sort((a, b) => rank[a.band] - rank[b.band] || reach[b.id] - reach[a.id]);
  const placed = new Set(), build = (id, l, stack) => {
    if (placed.has(id) || stack.has(id)) return { id, twin: true, loop: false, link: l, kids: [] };
    placed.add(id); const st = new Set(stack).add(id);
    return { id, twin: false, loop: false, link: l, slots: by[id] ? freeSlots(d, by[id]) : [], kids: [...feed(id).sort((a, b) => reach[b.from] - reach[a.from]).map((x) => build(x.from, x, st)), ...loop(id).map((x) => ({ id: x.from, twin: true, loop: true, link: x, kids: [] }))] }; };
  const trees = sinks.map((s) => build(s.id, null, new Set())); for (const p of P) if (!placed.has(p.id)) trees.push(build(p.id, null, new Set()));      // a closed loop with no end : laid on its own
  /* a piece is as tall as what it takes, then its free sockets (each SNAP.SLOT high) */
  const height = (n) => { n.body = Math.max(SNAP.H, n.kids.reduce((s, k) => s + height(k), 0) + SNAP.GAP * Math.max(0, n.kids.length - 1)); return (n.h = n.body + (n.slots || []).length * SNAP.SLOT); };
  const depth = (n) => 1 + Math.max(0, ...n.kids.map(depth)); trees.forEach(height); const D = Math.max(1, ...trees.map(depth));
  const nodes = [], rows = []; let y = SNAP.TOP;
  const place = (n, col, top, parent, key) => { const ins = []; let ky = top;
    n.kids.forEach((k, i) => { place(k, col - 1, ky, key, `${key}.${i}`); ins.push({ y: ky + k.h / 2 - top, type: keyType(k.link) }); ky += k.h + SNAP.GAP; });
    const slots = (n.slots || []).map((q, i) => ({ ...q, y: n.body + i * SNAP.SLOT + SNAP.SLOT / 2 }));      // the free sockets, under what is snapped
    nodes.push({ key, id: n.id, twin: n.twin, loop: n.loop, type: n.link ? keyType(n.link) : null, count: n.link ? n.link.wires.length : 0, parent, x: 20 + col * SNAP.W, y: top, w: SNAP.W, h: n.h, body: n.body, col, ins, slots }); };
  trees.forEach((t, i) => { place(t, D - 1, y, null, `t${i}`); rows.push({ root: t.id, y, h: t.h }); y += t.h + SNAP.TREE; });
  const N = Object.fromEntries(nodes.map((q) => [q.key, q])); for (const q of nodes) q.parentId = q.parent && N[q.parent] ? N[q.parent].id : null;      // the piece it is snapped into
  const copies = {}; for (const n of nodes) copies[n.id] = (copies[n.id] || 0) + 1;
  void by; return { nodes, rows, copies, w: 40 + D * SNAP.W + 24, h: y + 10 };
}
/** The interface block of a piece : what it takes, every place it goes, and how many copies of it the view shows. */
export function pieceInterface(d, id, P = pieces(d), L = links(d, P)) {
  const by = Object.fromEntries(P.map((p) => [p.id, p])), side = (ls, end) => ls.map((l) => ({ piece: by[l[end]], type: keyType(l), count: l.wires.length, loop: !!l.delay, wires: l.wires })).filter((x) => x.piece);
  return { piece: by[id] || null, takes: side(L.filter((l) => l.to === id), "from"), gives: side(L.filter((l) => l.from === id), "to") };
}
