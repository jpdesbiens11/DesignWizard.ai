/* DesignWizard.ai — builds every part of an assembly in the kernel, solves the placements from the mates and shows
   the result in a viewer. Shared by Assemblage, Isolation, DFx, Rapport and Onshape. */

import { store } from "./store.js";
import { flatAsm, bomLevels } from "./asm_levels.js";
import { kernel } from "../cad/client.js";
import { solveLevels, hardware, bom, massProps, placedTree } from "./assembly_logic.js";
import { showBuilt } from "./viewport.js";
import { bboxTransform, bboxUnion } from "../cad/vec.js";

/** Build the parts used by `asm`. Returns {built, sol, errors, hardware, bom, mass, bbox, asm, levels}. onProgress(text, done, total) before
    each part ; an operation the user cancelled (kernel.cancel) ends the construction at once.
    asm (returned) : the assembly OPENED — every part through every level as an instance (« S~i2 » : inside the sub-assembly placed
    as S), a sub-assembly carried as one rigid whole (core/asm_levels.js) ; levels : its bill of materials by level. */
export async function buildAssembly(asm, onProgress) {
  const find = (id) => store.assembly(id), opened = flatAsm(asm, find);      // an instance put aside (off) is neither built nor placed : it counts for nothing downstream
  const ids = [...new Set(opened.instances.map((i) => i.part))], built = {}, errors = (opened.lost || []).map((l) => (l.why === "cycle" ? `Le sous-assemblage « ${l.asm} » se contiendrait lui-même : il est laissé de côté.` : `Sous-assemblage « ${l.asm} » absent du projet.`));
  let n = 0;
  for (const id of ids) {
    const spec = store.part(id);
    if (!spec) { errors.push(`Pièce « ${id} » absente du projet.`); continue; }
    if (onProgress) onProgress(`Construction ${++n} / ${ids.length} : ${id}`, n - 1, ids.length);
    try { built[id] = await kernel.build(spec); } catch (e) { if (e && e.cancelled) throw e; errors.push(`${id} : ${e.message}`); }
  }
  const { asm: usable, sol } = solveLevels(asm, built, find);      // each sub-assembly solved on its own, then carried whole ; parts that could not be built are left out
  let bbox = null;
  for (const i of usable.instances) bbox = bboxUnion(bbox, bboxTransform(built[i.part].bbox, sol.placements[i.id]));
  return { built, sol, errors, asm: usable, levels: bomLevels(asm, find), hardware: hardware(usable, built), bom: bom(store.project, usable, built), mass: massProps(usable, built, sol.placements), bbox: bbox || [0, 0, 0, 0, 0, 0] };
}

/** What the STEP of an assembly is made of (kernel.step) : its parts where they are, and each sub-assembly as ONE node that holds
    its own — the file keeps the levels, and a sub-assembly placed twice is written once. `built` : the parts built (buildAssembly). */
export function stepItems(asm, built) {
  const find = (id) => store.assembly(id), named = (id, doc) => `${id} ${(doc && doc.name) || ""}`.trim();
  const node = (n) => (n.asm ? { key: `asm:${n.asm}`, name: named(n.asm, find(n.asm)), instanceName: `${n.asm} ${n.inst}`, matrix: n.matrix, children: n.children.map(node) }
    : { key: n.part, name: named(n.part, store.part(n.part)), instanceName: `${n.part} ${n.inst}`, matrix: n.matrix });
  return placedTree(asm, built, find).map(node);
}
/** How many parts a list of STEP items places, through its levels. */
export const stepCount = (items) => items.reduce((n, it) => n + (it.children ? stepCount(it.children) : 1), 0);

/** Show the solved assembly. opts: {colorOf(inst, body) -> css colour | null, opacityOf(inst, body), skipHidden} */
export function showAssembly(viewer, ctx, opts = {}) {
  const keep = new Set();
  for (const inst of ctx.asm.instances) {
    if (inst.hidden && opts.skipHidden !== false) continue;
    const b = ctx.built[inst.part], colors = {};
    if (opts.colorOf) for (const body of b.bodies) { const c = opts.colorOf(inst, body); if (c) colors[body.name] = c; }
    for (const id of showBuilt(viewer, b, { prefix: inst.id, matrix: ctx.sol.placements[inst.id], explodeDir: ctx.sol.explode[inst.id], inst: inst.id, colors,
      opacity: opts.opacityOf ? undefined : undefined })) keep.add(id);
    if (opts.opacityOf) for (const body of b.bodies) { const o = opts.opacityOf(inst, body); if (o !== undefined && o !== null) viewer.setOpacity(`${inst.id}/${body.name}`, o); }
  }
  for (const k of [...viewer.objects.keys()]) if (!keep.has(k)) viewer.remove(k);
  return keep;
}
