/* DesignWizard.ai — forming a sub-assembly from parts already placed, and dissolving one back into its parent (demande de JP :
   « Sous-assemblages », la suite). The two are the reverse of each other, and NOTHING MOVES :
     formSub      the instances chosen in an assembly leave it together and come back as ONE instance of a new assembly ; the joints
                  between them go inside, the joints to the rest stay in the parent and name their part by its path (« s3~i2 »).
     dissolveSub  the instance of a sub-assembly is replaced by what the sub-assembly holds ; its joints come up into the parent,
                  the joints that went through it name the parts directly again. The sub-assembly itself stays in the project.
   What names an instance of the parent follows : the order of the routing (plan.order), the labels, the pinned messages, the
   variants (a variant cannot switch a part INSIDE a sub-assembly : it lets go of the parts that went in, and says so).
   Places : the caller gives where the solver has put things (placements / the node of placedTree), so that a part no joint holds
   stays where it was ; without them, places come from the joints and from the placements already written.
   Pure : the project given is changed ; the caller applies it inside one undoable step. */

import { SEP, topOf } from "./asm_levels.js";
import { matMul, matFromPlacement } from "../cad/vec.js";

const clone = (x) => JSON.parse(JSON.stringify(x)), deg = (a) => Math.round(a * 180 / Math.PI * 1e6) / 1e6 + 0, mm = (x) => Math.round(x * 1e6) / 1e6 + 0;
/** A rigid matrix as a placement { t, r } — degrees, applied X then Y then Z : the inverse of matFromPlacement. */
export function placementOf(m) {
  const cy = Math.hypot(m[0], m[1]), ry = Math.atan2(-m[2], cy);
  const [rx, rz] = cy > 1e-9 ? [Math.atan2(m[6], m[10]), Math.atan2(m[1], m[0])] : [Math.atan2(-m[9], m[5]), 0];      // looking straight along Z : the turn about Z is folded into the one about X
  return { t: [mm(m[12]), mm(m[13]), mm(m[14])], r: [deg(rx), deg(ry), deg(rz)] };
}
const asmOf = (project, id) => (project.assemblies || []).find((a) => a.id === id) || null;
/** An id no instance of the assembly bears : « s1 », « s2 »… */
export function freshInstance(asm, stem = "s") { const used = new Set((asm.instances || []).map((i) => i.id)); let n = 1; while (used.has(`${stem}${n}`)) n++; return `${stem}${n}`; }
/** Among the instances chosen, those no joint between them ties to the first one : inside the sub-assembly they would only be put by hand. */
export function looseIn(asm, chosen) {
  const ids = (asm.instances || []).filter((i) => chosen.includes(i.id)).map((i) => i.id); if (ids.length < 2) return [];
  const set = new Set(ids), ground = ((asm.instances || []).find((i) => set.has(i.id) && i.fixed) || { id: ids[0] }).id, seen = new Set([ground]), queue = [ground];
  while (queue.length) { const cur = queue.shift(); for (const m of asm.mates || []) { const a = topOf(m.a.inst), b = topOf(m.b.inst); if (!set.has(a) || !set.has(b)) continue; const next = a === cur ? b : b === cur ? a : null; if (next && !seen.has(next)) { seen.add(next); queue.push(next); } } }
  return ids.filter((x) => !seen.has(x));
}
/** What forming a sub-assembly from these instances would do, without doing it : { ids (in the order of the assembly), inner (joints
    that go inside), across (joints kept between the block and the rest), loose, variants (names of those that let go of a part), ground }. */
export function formPlan(asm, chosen) {
  const ids = (asm.instances || []).filter((i) => (chosen || []).includes(i.id)).map((i) => i.id), set = new Set(ids), inSet = (e) => set.has(topOf(e.inst));
  const inner = (asm.mates || []).filter((m) => inSet(m.a) && inSet(m.b)).map((m) => m.id), across = (asm.mates || []).filter((m) => inSet(m.a) !== inSet(m.b)).map((m) => m.id);
  return { ids, inner, across, loose: looseIn(asm, ids), variants: (asm.variants || []).filter((v) => (v.off || []).some((x) => set.has(x))).map((v) => v.name), ground: (asm.instances || []).some((i) => set.has(i.id) && i.fixed) };
}

/** The instances chosen leave the assembly `parentId` together and come back as one instance of a NEW assembly.
    o : { id (of the new assembly — required), name, inst (the id its instance takes in the parent, when free),
          placements : instance id → the matrix the solver gave it in the parent }
    → { sub (the new assembly, added to the project), inst (its instance in the parent), ...formPlan } */
export function formSub(project, parentId, chosen, o = {}) {
  const parent = asmOf(project, parentId); if (!parent) throw new Error(`Assemblage « ${parentId} » introuvable.`);
  const plan = formPlan(parent, chosen), set = new Set(plan.ids), inSet = (e) => set.has(topOf(e.inst));
  if (!plan.ids.length) throw new Error("Choisissez au moins une pièce de l'assemblage.");
  if (!o.id || asmOf(project, o.id)) throw new Error(o.id ? `Un assemblage porte déjà le numéro « ${o.id} ».` : "Le sous-assemblage demande un numéro.");
  const sid = o.inst && !parent.instances.some((i) => i.id === o.inst) ? o.inst : freshInstance(parent), path = (e) => (inSet(e) ? { ...e, inst: `${sid}${SEP}${e.inst}` } : e), follow = (id) => (id && set.has(topOf(id)) ? `${sid}${SEP}${id}` : id);
  const moved = parent.instances.filter((i) => set.has(i.id)).map((i) => { const c = clone(i), M = (o.placements || {})[i.id]; if (M) c.placement = placementOf(M); return c; });
  if (!plan.ground) moved[0].fixed = true;      // a sub-assembly has its ground : the first part chosen, unless one of them was the ground of the parent
  const sub = { dw: "assembly/1", id: o.id, name: o.name || o.id, instances: moved, mates: (parent.mates || []).filter((m) => inSet(m.a) && inSet(m.b)) };
  const at = parent.instances.findIndex((i) => set.has(i.id)), block = { id: sid, asm: o.id, ...(plan.ground ? { fixed: true } : {}), placement: { t: [0, 0, 0], r: [0, 0, 0] } };      // it is built in the frame of the parent : it sits where the parent starts
  parent.mates = (parent.mates || []).filter((m) => !(inSet(m.a) && inSet(m.b))).map((m) => ({ ...m, a: path(m.a), b: path(m.b) }));
  parent.instances = parent.instances.flatMap((i, k) => (k === at ? [block] : set.has(i.id) ? [] : [i]));
  if (parent.plan && Array.isArray(parent.plan.order)) { const order = parent.plan.order, first = order.findIndex((x) => set.has(x)); sub.plan = { order: order.filter((x) => set.has(x)) };
    parent.plan = { ...parent.plan, order: order.flatMap((x, k) => (k === first ? [sid] : set.has(x) ? [] : [x])) }; }
  for (const l of parent.labels || []) l.inst = follow(l.inst);
  for (const v of parent.variants || []) if (v.off) v.off = v.off.filter((x) => !set.has(x));
  for (const m of project.talk || []) if (m.on === `assembly:${parentId}` && m.pin && m.pin.inst) m.pin.inst = follow(m.pin.inst);
  project.assemblies.push(sub);
  return { sub, inst: sid, ...plan };
}

/** The instance `instId` of a sub-assembly is replaced, in the assembly `parentId`, by what the sub-assembly holds.
    o.tree : the node of that instance in placedTree(parent) — { matrix, children } — so that each part keeps the place it has.
    → { added (the ids the instances took in the parent), mates (how many joints came up), asm (the sub-assembly dissolved) } */
export function dissolveSub(project, parentId, instId, o = {}) {
  const parent = asmOf(project, parentId), inst = parent && (parent.instances || []).find((i) => i.id === instId && i.asm); if (!inst) throw new Error(`« ${instId} » n'est pas un sous-assemblage de ${parentId}.`);
  const sub = asmOf(project, inst.asm); if (!sub) throw new Error(`Le sous-assemblage « ${inst.asm} » n'est plus dans le projet : retirez-le.`);
  const used = new Set(parent.instances.filter((i) => i.id !== instId).map((i) => i.id)), rename = new Map();
  for (const i of sub.instances || []) { let nid = i.id, k = 1; while (used.has(nid)) nid = `${instId}_${i.id}${k++ > 1 ? `_${k - 1}` : ""}`; used.add(nid); rename.set(i.id, nid); }
  const tree = o.tree || null, G = tree ? tree.matrix : matFromPlacement(inst.placement), child = new Map(((tree && tree.children) || []).map((c) => [c.inst, c.matrix]));
  const up = (id) => { const [head, ...rest] = String(id).split(SEP); return [rename.get(head) || head, ...rest].join(SEP); };      // « i2 » → its new id ; « t1~i2 » keeps its path under the new id of t1
  const through = (id) => (String(id).startsWith(`${instId}${SEP}`) ? up(String(id).slice(instId.length + 1)) : id);      // « s3~i2 », as the parent named it → the part itself
  const copies = (sub.instances || []).map((i) => { const c = clone(i); c.id = rename.get(i.id); c.placement = placementOf(matMul(G, child.get(i.id) || matFromPlacement(i.placement)));
    if (!(inst.fixed && i.fixed)) delete c.fixed; if (inst.off) c.off = true; if (inst.hidden) c.hidden = true; return c; });      // the ground of the sub-assembly is the ground here only if the block was
  const mateIds = new Set((parent.mates || []).map((m) => m.id)), came = (sub.mates || []).map((m) => { const c = clone(m); let mid = m.id, k = 1; while (mateIds.has(mid)) mid = `${instId}_${m.id}${k++ > 1 ? `_${k - 1}` : ""}`; mateIds.add(mid); return { ...c, id: mid, a: { ...c.a, inst: up(c.a.inst) }, b: { ...c.b, inst: up(c.b.inst) } }; });
  parent.mates = [...(parent.mates || []).map((m) => ({ ...m, a: { ...m.a, inst: through(m.a.inst) }, b: { ...m.b, inst: through(m.b.inst) } })), ...came];
  parent.instances = parent.instances.flatMap((i) => (i.id === instId ? copies : [i]));
  const inOrder = ((sub.plan && sub.plan.order) || []).filter((x) => rename.has(x)), all = [...inOrder, ...(sub.instances || []).map((i) => i.id).filter((x) => !inOrder.includes(x))].map((x) => rename.get(x));
  if (parent.plan && Array.isArray(parent.plan.order)) parent.plan = { ...parent.plan, order: parent.plan.order.flatMap((x) => (x === instId ? all : [x])) };
  for (const l of parent.labels || []) if (l.inst) l.inst = through(l.inst);
  for (const v of parent.variants || []) if (v.off && v.off.includes(instId)) v.off = v.off.flatMap((x) => (x === instId ? copies.map((c) => c.id) : [x]));
  for (const m of project.talk || []) if (m.on === `assembly:${parentId}` && m.pin && m.pin.inst) m.pin.inst = through(m.pin.inst);
  return { added: copies.map((c) => c.id), mates: came.length, asm: sub.id };
}
