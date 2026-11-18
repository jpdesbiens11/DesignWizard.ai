/* DesignWizard.ai — turning a part of an assembly by hand (demande de JP : « tourner une pièce elle-même… avec une poignée dans la
   vue, au lieu de taper un angle »). What « turning » means depends on what holds the part :
     placed by hand — the ground of the assembly, or a part no joint reaches : it turns about the vertical (Z) through the middle of
                      its box, and its placement is rewritten ; a sub-assembly turns the same way, as the one block it is ;
     held by a joint — it turns about the normal of that joint, through its origin : the ANGLE of the joint changes (the « 90° »
                      button of a joint, by any step). Which way the angle turns the part is tried on the solver, not derived.
   Everything that hangs on the part follows : the caller solves the assembly again with the change (withTurn → solveLevels), so the
   preview during the gesture is what the release will leave. Pure : nothing here draws. */

import { matMul, matPoint, matDir, matRotAxis, matTranslate, matInvRigid, matFromPlacement, bboxTransform, bboxUnion, v3 } from "../cad/vec.js";
import { placementOf } from "./asm_form.js";
import { solveLevels, ifaceOf } from "./assembly_logic.js";
import { SEP } from "./asm_levels.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
/** A turn of `deg` degrees about the axis through the point c, as a matrix (right-handed about the axis). */
export const turnAbout = (c, axis, deg) => matMul(matTranslate(c), matMul(matRotAxis(axis, deg), matTranslate(v3.neg(c))));
/** An angle brought to a step (0 : as it is). */
export const snapTurn = (deg, step = 5) => (step > 0 ? Math.round(deg / step) * step : Math.round(deg * 10) / 10) + 0;
/** An angle as it is written : −180 < a ≤ 180, no noise, no minus zero. */
export const wrapTurn = (deg) => { let a = ((deg % 360) + 360) % 360; if (a > 180) a -= 360; return Math.round(a * 1000) / 1000 + 0; };
/** The step of a turn : 5°, 15° with Shift, free with Alt (a tenth of a degree). */
export const turnSnap = (e = {}) => (e.altKey ? 0 : e.shiftKey ? 15 : 5);

/** What turning the instance `id` of an assembly means. o : { built, find, solved? (what solveLevels(asm) gave) }
    → null (unknown, put aside, not built)
    | { kind: "free", inst, axis: [0, 0, 1], centre, radius, angle (its turn about Z, degrees), matrix (where it stands) }
    | { kind: "mate", inst, mate, axis (the normal of the joint, in the assembly), centre (the origin of the joint), radius,
        angle (of the joint), sign (which way a positive angle turns the part about the axis) } */
export function turnOf(asm, id, o) {
  const inst = ((asm && asm.instances) || []).find((i) => i.id === id); if (!inst || inst.off) return null;
  const s = o.solved || solveLevels(asm, o.built, o.find), opened = s.asm, sol = s.sol, leaves = opened.instances.filter((i) => i.id === id || i.group === id);
  if (!leaves.length || leaves.some((l) => !sol.placements[l.id] || !o.built[l.part])) return null;
  let box = null; for (const l of leaves) box = bboxUnion(box, bboxTransform(o.built[l.part].bbox, sol.placements[l.id]));
  const mid = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2], radius = Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2, by = sol.placedBy[id];
  if (!by) return { kind: "free", inst: id, axis: [0, 0, 1], centre: mid, radius, angle: wrapTurn(placementOf(sol.placements[id]).r[2]), matrix: sol.placements[id].slice() };
  const m = (asm.mates || []).find((k) => k.id === by), mine = m && [m.a, m.b].find((e) => e.inst === id || String(e.inst).startsWith(id + SEP));
  const leaf = mine && opened.instances.find((i) => i.id === mine.inst), f = leaf && ifaceOf(o.built, leaf.part, mine.iface); if (!f) return null;
  const P = sol.placements[leaf.id], axis = v3.unit(matDir(P, f.frame.n)), at = matPoint(P, f.frame.o);
  /* one degree more on the joint : where does a point of the part go ? */
  const probe = clone(asm); probe.mates.find((k) => k.id === by).angle = (m.angle || 0) + 1;
  const P2 = solveLevels(probe, o.built, o.find).sol.placements[leaf.id], w0 = v3.add(at, v3.mul(v3.unit(matDir(P, f.frame.u)), 10)), w1 = matPoint(P2, matPoint(matInvRigid(P), w0));
  const way = v3.dot(axis, v3.cross(v3.sub(w0, at), v3.sub(w1, at)));
  return { kind: "mate", inst: id, mate: by, axis, centre: at, radius, angle: wrapTurn(m.angle || 0), sign: way < 0 ? -1 : 1 };
}
/** The assembly with the instance turned by `delta` degrees about its axis (right-handed) — a copy ; the document is not changed. */
export function withTurn(asm, t, delta) {
  const next = clone(asm);
  if (t.kind === "mate") { const m = next.mates.find((k) => k.id === t.mate), a = wrapTurn((m.angle || 0) + t.sign * delta); if (a) m.angle = a; else delete m.angle; return next; }
  const i = next.instances.find((x) => x.id === t.inst); i.placement = placementOf(matMul(turnAbout(t.centre, t.axis, delta), matFromPlacement(i.placement)));      // from the placement the document has NOW : a second notch asked before the view is rebuilt adds to the first
  return next;
}
/** What changed, to write into the document in one step : the placement of the instance, or the angle of the joint. */
export function applyTurn(asm, t, delta) {
  const next = withTurn(asm, t, delta);
  if (t.kind === "mate") { const m = asm.mates.find((k) => k.id === t.mate), a = next.mates.find((k) => k.id === t.mate).angle; if (a) m.angle = a; else delete m.angle; }
  else asm.instances.find((x) => x.id === t.inst).placement = next.instances.find((x) => x.id === t.inst).placement;
  return asm;
}
/** « +35° » : a turn as the cue writes it. */
export const turnText = (deg) => `${deg > 0 ? "+" : deg < 0 ? "−" : ""}${String(Math.abs(Math.round(deg * 10) / 10)).replace(".", ",")}°`;

/* ---------- the ring of the handle ---------- */
/** Two directions square to an axis, the first as near to `toward` as the plane of the ring allows (the right of the screen, so that
    the grip starts where the hand finds it). */
export function ringFrame(axis, toward) {
  const k = v3.unit(axis); let u = v3.sub(toward, v3.mul(k, v3.dot(toward, k)));
  if (v3.len(u) < 1e-6) { const alt = Math.abs(k[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; u = v3.sub(alt, v3.mul(k, v3.dot(alt, k))); }      // the eye looks at the ring edge-on along `toward` : any direction of the plane
  u = v3.unit(u); return { u, v: v3.cross(k, u) };
}
/** The same ring, started `deg` degrees further round : where the grip goes when its first place is out of the view. */
export const ringFrom = (fr, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { u: v3.add(v3.mul(fr.u, c), v3.mul(fr.v, s)), v: v3.add(v3.mul(fr.u, -s), v3.mul(fr.v, c)) }; };
/** A point of the ring, `deg` degrees from its first direction, counter-clockwise about the axis. */
export const ringAt = (centre, fr, r, deg) => { const a = deg * Math.PI / 180; return v3.add(centre, v3.add(v3.mul(fr.u, r * Math.cos(a)), v3.mul(fr.v, r * Math.sin(a)))); };
/** The points of an arc of the ring, from `from` over `sweep` degrees (360 : the whole ring, closed). */
export function ringPoints(centre, fr, r, from = 0, sweep = 360) {
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / 6)); return Array.from({ length: n + 1 }, (_, i) => ringAt(centre, fr, r, from + sweep * i / n));
}
/** Where a ray (a point, a direction of length 1) meets the plane of the ring, as an angle about the axis from the first direction of
    the ring, in degrees ; null when the ray runs too close to the plane to say (the ring is seen edge-on). */
export function ringAngle(origin, dir, centre, axis, fr) {
  const k = v3.unit(axis), along = v3.dot(dir, k); if (Math.abs(along) < 0.25) return null;
  const p = v3.add(origin, v3.mul(dir, v3.dot(v3.sub(centre, origin), k) / along)), d = v3.sub(p, centre);
  return Math.atan2(v3.dot(d, fr.v), v3.dot(d, fr.u)) * 180 / Math.PI;
}
/** From one angle of the hand to the next, the short way round (degrees). */
export const turnDelta = (a0, a1) => { let d = a1 - a0; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
