/* DynamiteOrbit.ai — an assembly inside an assembly (demande de JP : « Sous-assemblages »). An instance of an assembly names a part
   (`part`) or another assembly (`asm`) : a sub-assembly, put together in its own document and carried here as ONE RIGID WHOLE.
   What counts parts reads the assembly OPENED : flatAsm() gives every part through every level as an instance of its own —
   « S~i2 » is the instance i2 of the sub-assembly placed as S — with the joints of every level, so that the view, the mass, the
   bill of materials, the checks, the drawings and the exports see each part once, where it is. A joint of the parent may hold to
   a part inside a sub-assembly : it names it by that id. An assembly cannot contain itself, at any depth.
   In the file : { id, asm: "<assembly id>", placement, fixed?, hidden?, off? } among the instances. Pure : the project is read
   through `find(id) → assembly`. */

import { liveAsm } from "./asm_live.js";
import { overLook } from "./part_look.js";

export const SEP = "~";
/** The instance of the assembly an id goes through : « S » for « S~i2 ». */
export const topOf = (id) => String(id === undefined || id === null ? "" : id).split(SEP)[0];
/** Is this instance a sub-assembly ? */
export const isSub = (i) => !!(i && i.asm);
/** Does an object of the view (« <instance>/<body> ») belong to this instance — a part, or everything of a sub-assembly ? */
export const ownsKey = (inst, key) => !!inst && (String(key).startsWith(`${inst}/`) || String(key).startsWith(`${inst}${SEP}`));

/** find(id) → assembly, from a project. */
export const finder = (project) => (id) => ((project && project.assemblies) || []).find((a) => a.id === id) || null;
/** Does `asm` hold the assembly `id`, at any depth ? */
export function holds(asm, id, find, seen = new Set()) {
  if (!asm || seen.has(asm.id)) return false; seen.add(asm.id);
  return (asm.instances || []).some((i) => isSub(i) && (i.asm === id || holds(find(i.asm), id, find, seen)));
}
/** Can the assembly `sub` go into `parent` ? Not itself, and not one that holds `parent` : an assembly cannot contain itself. */
export const canHold = (parent, sub, find) => !!(parent && sub) && sub.id !== parent.id && !holds(sub, parent.id, find);

/** The assembly as it counts, OPENED : without what is put aside, each sub-assembly replaced by its parts and its joints.
    → the same object when there is nothing to open ; else { ...asm, instances (every part : id, part, group — the instance of
    this assembly it came through —, sub — the assembly it belongs to), mates (those of this level, then those of each
    sub-assembly, marked `of`), groups: { S: { asm, name, placement, fixed, hidden, parts } }, lost: [{ inst, asm, why }] }
    lost : a sub-assembly that is gone from the project (« missing ») or that would contain itself (« cycle ») — left out. */
export function flatAsm(asm, find, trail = []) {
  const live = liveAsm(asm);
  if (!live || !(live.instances || []).some(isSub)) return live;
  const instances = [], mates = [...(live.mates || [])], groups = {}, lost = [], here = [...trail, live.id];
  for (const i of live.instances) {
    if (!isSub(i)) { instances.push(i); continue; }
    const sub = find(i.asm);
    if (!sub || here.includes(i.asm)) { lost.push({ inst: i.id, asm: i.asm, why: sub ? "cycle" : "missing" }); continue; }
    const inner = flatAsm(sub, find, here);
    for (const l of inner.lost || []) lost.push({ ...l, inst: `${i.id}${SEP}${l.inst}` });
    groups[i.id] = { asm: i.asm, name: sub.name || sub.id, placement: i.placement, fixed: !!i.fixed, hidden: !!i.hidden, parts: inner.instances.length };
    for (const leaf of inner.instances) {
      const c = { ...leaf, id: `${i.id}${SEP}${leaf.id}`, group: i.id, sub: leaf.sub || i.asm }; delete c.fixed; delete c.local; delete c.burst;      // one rigid whole : what was fixed inside is carried with the rest
      if (i.hidden) c.hidden = true; else delete c.hidden;
      if (i.look) c.look = overLook(c.look, i.look);      // what this assembly says of the look of the block covers what the block says of its own parts
      instances.push(c);
    }
    for (const m of inner.mates || []) mates.push({ ...m, id: `${i.id}${SEP}${m.id}`, a: { ...m.a, inst: `${i.id}${SEP}${m.a.inst}` }, b: { ...m.b, inst: `${i.id}${SEP}${m.b.inst}` }, of: i.id });
  }
  return { ...live, instances, mates, groups, ...(lost.length ? { lost } : {}) };
}
/** The instances of the assembly opened : every part through every level (what is put aside left out). */
export const openInstances = (asm, find) => ((flatAsm(asm, find) || {}).instances || []);
/** How many of each part the assembly holds, through every level : Map(part id → quantity). */
export function partCounts(asm, find) {
  const n = new Map(); for (const i of ((flatAsm(asm, find) || {}).instances || [])) if (i.part) n.set(i.part, (n.get(i.part) || 0) + 1);
  return n;
}
/** The part an instance id names, through the levels (« S~i2 ») : the instance as flatAsm gives it, or null. */
export const leafOf = (asm, id, find) => ((flatAsm(asm, find) || {}).instances || []).find((i) => i.id === id) || null;
/** The assemblies that hold the assembly `id` directly : [{ id, name, qty }]. */
export const usedIn = (assemblies, id) => (assemblies || []).map((a) => ({ id: a.id, name: a.name || "", qty: (a.instances || []).filter((i) => i.asm === id).length })).filter((x) => x.qty > 0);

/** The bill of materials by level : [{ level, kind: "part" | "assembly", id, qty, lost? }] — a sub-assembly is one line with its
    quantity, and what ONE of it holds comes under it, one level in. What is put aside (off) is not counted. */
export function bomLevels(asm, find, level = 0, trail = []) {
  const live = liveAsm(asm) || { instances: [] }, count = new Map(), rows = [], here = [...trail, live.id];
  for (const i of live.instances || []) { const k = isSub(i) ? `a:${i.asm}` : `p:${i.part}`; count.set(k, (count.get(k) || 0) + 1); }
  for (const [k, qty] of count) {
    const id = k.slice(2); if (k[0] === "p") { rows.push({ level, kind: "part", id, qty }); continue; }
    const sub = find(id), ok = !!sub && !here.includes(id);
    rows.push({ level, kind: "assembly", id, qty, ...(ok ? {} : { lost: true }) });
    if (ok) rows.push(...bomLevels(sub, find, level + 1, here));
  }
  return rows;
}
/** Takes out of every assembly the instances that `gone(instance)` names — a part that left the project, a sub-assembly that was
    deleted — with the joints that go through them : at their level, and in the assemblies that hold them through a sub-assembly
    (a joint of a parent may hold to a part inside). The assemblies given are changed. → how many instances left */
export function dropInstances(assemblies, gone) {
  const by = new Map((assemblies || []).map((a) => [a.id, a])), lost = new Map();      // assembly id → what left it, as its joints name it (« i3 », « S~i2 »)
  const lostIn = (a, trail = []) => { if (lost.has(a.id)) return lost.get(a.id); const out = new Set(); lost.set(a.id, out);
    for (const i of a.instances || []) { if (gone(i)) out.add(i.id); else if (isSub(i) && by.has(i.asm) && !trail.includes(i.asm) && i.asm !== a.id) for (const g of lostIn(by.get(i.asm), [...trail, a.id])) out.add(`${i.id}${SEP}${g}`); }
    return out; };
  let n = 0; for (const a of assemblies || []) lostIn(a);
  for (const a of assemblies || []) { const out = [...lost.get(a.id)]; if (!out.length) continue;
    const hit = (id) => out.some((g) => id === g || String(id).startsWith(g + SEP));
    const keep = (a.instances || []).filter((i) => !out.includes(i.id)); n += (a.instances || []).length - keep.length; a.instances = keep;
    a.mates = (a.mates || []).filter((m) => !hit(m.a.inst) && !hit(m.b.inst)); }
  return n;
}
/** How deep the assembly goes : 0 without a sub-assembly. */
export const depthOf = (asm, find) => bomLevels(asm, find).reduce((d, r) => Math.max(d, r.level), 0);
