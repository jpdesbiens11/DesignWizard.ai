/* DesignWizard.ai — builds every part of an assembly in the kernel, solves the placements from the mates and shows
   the result in a viewer. Shared by Assemblage, Isolation, DFx, Rapport and Onshape. */

import { store } from "./store.js";
import { kernel } from "../cad/client.js";
import { solve, hardware, bom, massProps } from "./assembly_logic.js";
import { showBuilt } from "./viewport.js";
import { bboxTransform, bboxUnion } from "../cad/vec.js";

/** Build the parts used by `asm`. Returns {built, sol, errors, hardware, bom, mass, bbox}. onProgress(text, done, total) before each part ;
    an operation the user cancelled (kernel.cancel) ends the construction at once. */
export async function buildAssembly(asm, onProgress) {
  const ids = [...new Set(asm.instances.map((i) => i.part))], built = {}, errors = [];
  let n = 0;
  for (const id of ids) {
    const spec = store.part(id);
    if (!spec) { errors.push(`Pièce « ${id} » absente du projet.`); continue; }
    if (onProgress) onProgress(`Construction ${++n} / ${ids.length} : ${id}`, n - 1, ids.length);
    try { built[id] = await kernel.build(spec); } catch (e) { if (e && e.cancelled) throw e; errors.push(`${id} : ${e.message}`); }
  }
  const usable = { ...asm, instances: asm.instances.filter((i) => built[i.part]) };
  const sol = solve(usable, built);
  let bbox = null;
  for (const i of usable.instances) bbox = bboxUnion(bbox, bboxTransform(built[i.part].bbox, sol.placements[i.id]));
  return { built, sol, errors, asm: usable, hardware: hardware(usable, built), bom: bom(store.project, usable, built), mass: massProps(usable, built, sol.placements), bbox: bbox || [0, 0, 0, 0, 0, 0] };
}

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
