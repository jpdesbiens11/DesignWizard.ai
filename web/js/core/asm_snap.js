/* DynamiteOrbit.ai — Assemblage : a part DRAGGED in the view snaps on an interface (demande de JP, 28 novembre 2026 : « que l'interface soit
   reconnue pour le mating en promenant la pièce devant l'interface parent à l'écran »). The convention is the one of the mechanical modellers :
   a component dragged in the plane of the screen, a compatible feature of another component lights up when the dragged feature comes near
   it on the screen, the component is shown where the mate would put it, and the mate is made when the button is released — the « drag and
   drop on a feature » of SolidWorks SmartMates and of the Assemble command of Inventor. The software blocks of the platform do the same
   (sw/sw_blocks.js snapAt). Here :
     - what moves is the chosen instance (a part, or a whole sub-assembly) WITH what hangs on it : the parts its joints place follow ;
     - what it may snap on is a free interface of a part placed from the base of the assembly — never one of the block, never one of a part
       that floats ; the pair must be compatible as the automatic mating says (cad/interfaces.js compatible) : same type, sides A and B, same
       key or same geometry ;
     - a part a joint holds stays where it is until the hand has gone REACH pixels away : then it lets go (the joints that tie the block to
       the rest are removed and remembered as set aside, so that the automatic mating does not bring them back) ;
     - the base of the assembly does not move : everything else is placed from it.
   Pure : what the view needs (a projection of a point to the screen) is passed in. */

import { matMul, matInvRigid, matPoint, matTranslate, bboxTransform, bboxUnion, v3 } from "../cad/vec.js";
import { compatible } from "../cad/interfaces.js";
import { freeInterfaces, mateMatrix, nextJoint, pairKey } from "./assembly_logic.js";
import { topOf } from "./asm_levels.js";
import { placementOf } from "./asm_form.js";

/** On the screen, in pixels : how near an interface must come to another to snap, and how far a held part must be pulled to let go. */
export const REACH = 36;

/** What dragging the instance `id` of an assembly means. doc : the assembly as the project has it ; opened, sol : what solveLevels gave ;
    built : part id → built part.
    → null (unknown, put aside, not built)
    | { inst, ground (the base : it does not move), hold (the joint that holds it, or null), block (the instances that move with it),
        moving (the parts of the view that move), detach (the joints the move removes when it lets go), top (where it stands), centre,
        targets: [{ a, b (the joint, side A first), by, flip?, type, label, from (its interface, in the assembly), at (the other one),
                    delta (the move that makes them meet), linked }] } */
export function dragPlan(doc, opened, sol, built, id) {
  const inst = ((doc && doc.instances) || []).find((i) => i.id === id); if (!inst || inst.off || !opened || !sol) return null;
  const leaves = (opened.instances || []).filter((i) => topOf(i.id) === id);
  if (!leaves.length || leaves.some((l) => !sol.placements[l.id] || !built[l.part]) || !sol.placements[id]) return null;
  const floating = new Set(sol.floating || []), by = sol.placedBy || {}, mates = doc.mates || [], hold = by[id] || null;
  /* the block : this instance, and every instance a joint places from it, from them, … */
  const parent = {};
  for (const t of doc.instances) { const m = by[t.id] && mates.find((k) => k.id === by[t.id]); if (!m) continue; const ends = [topOf(m.a.inst), topOf(m.b.inst)]; parent[t.id] = ends[0] === t.id ? ends[1] : ends[0]; }
  const block = new Set([id]); for (let grew = true; grew;) { grew = false; for (const [c, p] of Object.entries(parent)) if (block.has(p) && !block.has(c)) { block.add(c); grew = true; } }
  const detach = hold ? mates.filter((m) => block.has(topOf(m.a.inst)) !== block.has(topOf(m.b.inst))).map((m) => m.id) : [];
  let box = null; for (const l of leaves) box = bboxUnion(box, bboxTransform(built[l.part].bbox, sol.placements[l.id]));
  const plan = { inst: id, ground: !hold && !floating.has(id), hold, block: [...block], moving: (opened.instances || []).filter((i) => block.has(topOf(i.id))).map((i) => i.id), detach,
    top: sol.placements[id].slice(), centre: [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2], targets: [] };
  if (plan.ground) return plan;
  /* the interfaces free once the block has let go, on each side */
  const free = freeInterfaces({ ...opened, mates: (opened.mates || []).filter((m) => m.of || !detach.includes(m.id)) }, built);
  const mine = free.filter((f) => topOf(f.inst) === id), theirs = free.filter((f) => !block.has(topOf(f.inst)) && !floating.has(topOf(f.inst)));
  for (const x of mine) for (const y of theirs) {
    if (x.part === y.part && x.iface.id === y.iface.id && (x.iface.side === "B") === (y.iface.side === "B")) continue;      // the same face of two copies of one part
    const c = compatible(x.iface, y.iface); if (!c.ok) continue;
    const [a, b] = x.iface.side === "B" ? [y, x] : [x, y], flip = x.iface.type === "rail";      // a tongue slides IN : the frames coincide
    const Mm = sol.placements[x.inst], Mo = sol.placements[y.inst], T = mateMatrix(Mo, y.iface.frame, x.iface.frame, flip ? { flip: true } : {});
    plan.targets.push({ a: { inst: a.inst, iface: a.iface.id }, b: { inst: b.inst, iface: b.iface.id }, by: c.by, ...(flip ? { flip: true } : {}), type: x.iface.type,
      label: `${x.iface.name || x.iface.id} ↔ ${y.iface.name || y.iface.id}`, other: y.inst, otherPart: y.part, from: matPoint(Mm, x.iface.frame.o), at: matPoint(Mo, y.iface.frame.o),
      delta: matMul(T, matInvRigid(Mm)), linked: !(x.iface.found || y.iface.found) });      // a geometry read in a file is not driven by its neighbour
  }
  return plan;
}

/** The target in reach : the one whose interface is nearest, on the screen, to where the moved interface now is. D : the move of the hand
    (a matrix) ; toScreen(p) → [x, y]. → { target, dist } | null */
export function snapPick(plan, D, toScreen, reach = REACH) {
  let best = null;
  for (const t of (plan && plan.targets) || []) { const p = toScreen(matPoint(D, t.from)), q = toScreen(t.at), d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d <= reach && (!best || d < best.dist)) best = { target: t, dist: d }; }
  return best;
}
/** Has a held part been pulled far enough to let go ? dx, dy : how far the hand went, in pixels. */
export const letsGo = (dx, dy, reach = REACH) => Math.hypot(dx, dy) > reach;
/** A move of the hand in the plane of the screen : dx, dy in pixels, right and up the screen directions in the assembly, perPx the length
    of a pixel. → the move, as a matrix */
export const screenMove = (dx, dy, right, up, perPx) => matTranslate(v3.add(v3.mul(right, dx * perPx), v3.mul(up, -dy * perPx)));

/* the joints the block lets go of : removed, and remembered as set aside — the automatic mating never brings them back */
function letGo(doc, plan, keep = null) {
  const gone = (doc.mates || []).filter((m) => plan.detach.includes(m.id));
  if (!gone.length) return gone;
  doc.mates = doc.mates.filter((m) => !plan.detach.includes(m.id));
  const rej = [...new Set([...(doc.rejected || []), ...gone.map((m) => pairKey(m.a, m.b))])].filter((k) => k !== keep);
  if (rej.length) doc.rejected = rej; else delete doc.rejected;
  return gone;
}
/** The drop on a target, written into the assembly (in place) : the joints let go, the new joint — one number more, for ever (asm.mseq) —
    and the place the joint gives the instance, kept in case the joint goes. Dropped back on the joint that held it : nothing changes.
    → the new joint, or null */
export function applySnap(doc, plan, t) {
  const k = pairKey(t.a, t.b);
  if (plan.hold && (doc.mates || []).some((m) => m.id === plan.hold && pairKey(m.a, m.b) === k)) return null;
  const n = nextJoint(doc); letGo(doc, plan, k);
  if (doc.rejected) { doc.rejected = doc.rejected.filter((x) => x !== k); if (!doc.rejected.length) delete doc.rejected; }
  const mate = { id: `M${n}`, a: t.a, b: t.b, linked: t.linked !== false, by: t.by, ...(t.flip ? { flip: true } : {}), snapped: true };
  doc.mates = [...(doc.mates || []), mate]; doc.mseq = n;
  doc.instances.find((i) => i.id === plan.inst).placement = placementOf(matMul(t.delta, plan.top));
  return mate;
}
/** The drop anywhere else : the joints let go (a held part), and the instance where the hand left it. → the joints removed */
export function applyDrop(doc, plan, D) {
  const gone = letGo(doc, plan), at = placementOf(matMul(D, plan.top));
  at.t = at.t.map((x) => Math.round(x * 10) / 10 + 0);      // where a hand leaves it : to the tenth of a millimetre
  doc.instances.find((i) => i.id === plan.inst).placement = at;
  return gone;
}
