/* DynamiteOrbit.ai — Logiciel : SNAPPING the pieces of the puzzle by hand (demande de JP, 25 novembre 2026 : « est-ce que ce serait possible de
   déconnecter et connecter les blocs à la souris manuellement ; pour les grands blocs, il prendrait de la hauteur si on branche le dernier
   connecteur, si c'est possible de l'agrandir ; pour un bloc fermé in/out, aucune expansion automatique »).
   - Every piece shows its FREE inputs as empty sockets, keyed by their type (`freeSlots`) ; a piece is dropped on one (`connectTo` : the output
     of the piece that fits that very input — the unit adopted when the input follows it) ; dragged away, it comes off (`detach`).
   - A piece GROWS only where the model allows it without changing the C of a kind : a logic gate AND, OR or XOR (associative) whose inputs are
     all taken offers one more socket « + » ; a piece dropped there adds a gate of the same operation IN CASCADE (`growInto`) — the new gate says
     whose it is (`grownOf`) and the puzzle shows the chain as ONE taller piece (sw/sw_puzzle.js pieces). Every other kind is CLOSED : its
     sockets are its ports, and none is added.
   Pure : no page. */

import { KINDS, portsOf } from "./sw_objects.js";
import { liveWires, split, wireCheck } from "./sw_design.js";
import { typeOf, REF_BY_UNIT } from "./sw_blocks.js";

export const GROW_OPS = ["AND", "OR", "XOR"];
const live = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]);
const opOf = (o) => (o && o.params && o.params.op) || "AND";
/** May this object grow ? a logic gate whose operation is associative. */
export const growable = (o) => !!o && o.kind === "logic" && GROW_OPS.includes(opOf(o));
/** The gates grown out of a head, in the order they were added. */
export const grownOf = (d, head) => live(d).filter((o) => o.grownOf === head);
/** The free inputs of a piece : every input of its members no wire reaches — and, for a gate that can grow and has none left, the socket « + ».
    piece : { id, members }. → [{ ref, type, label, grow? }] */
export function freeSlots(d, piece) {
  const W = liveWires(d), taken = new Set(W.map((w) => w.to)), O = Object.fromEntries(live(d).map((o) => [o.id, o])), out = [];
  for (const id of piece.members) { const o = O[id]; if (!o) continue; for (const p of portsOf(o).in) { const ref = `${id}.${p.key}`; if (!taken.has(ref)) out.push({ ref, type: typeOf(p.unit), label: p.label, of: o.name }); } }
  const head = O[piece.id]; if (!out.length && growable(head)) out.push({ ref: `${head.id}.+`, type: "bool", label: "+", of: head.name, grow: true });
  return out;
}
/** Wires the output of piece A that fits the input `to` (a free socket of another piece). A block whose unit follows a parameter takes the unit it
    is given. pieces : the pieces of the design. → { wires, set, why } — no wire : `why` says why */
export function connectTo(d, pieces, A, to) {
  const pa = pieces.find((p) => p.id === A), O = Object.fromEntries(live(d).map((o) => [o.id, o])), [bid, bkey] = split(to), B = O[bid];
  if (!pa || !B) return { wires: [], set: {}, why: "Cette prise n'existe plus." };
  if (pa.members.includes(bid)) return { wires: [], set: {}, why: "Une pièce ne se branche pas sur elle-même." };
  if (liveWires(d).some((w) => w.to === to)) return { wires: [], set: {}, why: "Cette prise est déjà prise." };
  const outs = []; for (const id of [...pa.members].reverse()) for (const p of portsOf(O[id]).out) outs.push({ ref: `${id}.${p.key}`, unit: p.unit });
  for (const f of outs) { const c = wireCheck(d, f.ref, to); if (c.ok && !c.level) return { wires: [{ from: f.ref, to }], set: {}, why: "" }; }
  const K = KINDS[B.kind], raw = (K.ports.in.find((q) => q.key === bkey) || {}).unit, U = K.params.find((q) => q.key === "unit");
  if (raw === "*" && U) for (const f of outs) if (U.choices.includes(f.unit)) return { wires: [{ from: f.ref, to }], set: { [bid]: { unit: f.unit, ...((REF_BY_UNIT[B.kind] || {})[f.unit] || {}) } }, why: "" };
  const c = outs.length ? wireCheck(d, outs[0].ref, to) : { text: "Cette pièce ne donne rien." };
  return { wires: [], set: {}, why: c.text || "Ce que la pièce donne n'entre pas dans cette prise : la clé n'est pas la même." };
}
/** The output of piece A that may grow the gate `head` (a decision 0 / 1), or null. */
export function growFrom(d, pieces, A, head) {
  const pa = pieces.find((p) => p.id === A), O = Object.fromEntries(live(d).map((o) => [o.id, o])); if (!pa || !growable(O[head]) || pa.members.includes(head)) return null;
  for (const id of [...pa.members].reverse()) for (const p of portsOf(O[id]).out) if (p.unit === "0/1") return `${id}.${p.key}`;
  return null;
}
/** The wires that join piece A (what gives) to piece B (what takes) : what « détacher » removes. → [wire] */
export function detach(d, pieces, A, B) {
  const pa = pieces.find((p) => p.id === A), pb = pieces.find((p) => p.id === B); if (!pa || !pb) return [];
  return liveWires(d).filter((w) => pa.members.includes(split(w.from)[0]) && pb.members.includes(split(w.to)[0]));
}
/** Grows the gate `head` by one input, IN CASCADE, and plugs `from` into it — on a design being changed (it is changed in place). The deepest
    gate of the chain gives its input b to a new gate of the same operation ; the new gate takes, on a, what that input received and, on b,
    `from` ; its output goes back into b. The decision is the same, one input more. → the new gate, or null when the head cannot grow */
export function growInto(x, head, from) {
  const H = (x.objects || []).find((o) => o.id === head); if (!growable(H)) return null;
  const chain = [H, ...grownOf(x, head)], last = chain[chain.length - 1], W = x.wires.find((w) => w.to === `${last.id}.b` && !w.off);
  let n = chain.length + 1, id = `${head}_g${n}`; while (x.objects.some((o) => o.id === id)) id = `${head}_g${++n}`;
  const N = { id, kind: "logic", name: `${H.name} · entrée ${chain.length + 2}`, params: { op: opOf(H) }, sure: (H.sure || []).filter((k) => k === "op"), x: (last.x || 0) - 40, y: (last.y || 0) + 80, grownOf: head };
  x.objects.push(N);
  if (W) W.to = `${id}.a`; x.wires.push({ from, to: `${id}.b` }, { from: `${id}.y`, to: `${last.id}.b` });
  return N;
}
