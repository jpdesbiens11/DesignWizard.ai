/* DesignWizard.ai — artefacts: what a part or an assembly hands to the rest of the industry. One generator for the
   downloads, for the project tree in Google Drive and for the report:
     part      JSON (source) · STEP AP214 · STL · DXF (views) · DXF (flat outline, plate and sheet) · PDF drawing ·
               FeatureScript (Onshape, experimental) · routing sheet
     assembly  STEP · bill of materials (CSV)
   DWG itself is a closed, undocumented format: the platform writes DXF, which every DWG tool opens. */

import { store } from "./store.js";
import { kernel } from "../cad/client.js";
import { meshesToStl } from "../cad/stl.js";
import { viewsToDxf, flatOutlineDxf } from "../draw/dxf.js";
import { toFeatureScript } from "../cad/featurescript.js";
import { expandSpec, routing } from "../cad/workshop.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { viewRequest } from "../draw/part_drawing.js";
import { makeDrawing } from "../modules/drawings.js";
import { gammeText } from "../modules/part_gamme.js";
import { buildAssembly } from "./asm_scene.js";
import { TREE, safeName } from "../google/drive_fs.js";

const isFlat = (spec) => (spec.stock && STOCK_FORMS[spec.stock.form] && STOCK_FORMS[spec.stock.form].flat) || ["plate", "sheet", "busbar"].includes(spec.family);

/* key -> what it is, for whom, and how it is made. `when(spec)` hides an artefact that does not apply. */
export const ARTIFACTS = [
  { key: "json", ext: ".dwpart.json", label: "Pièce (JSON)", icon: "copy", mime: "application/json", text: "La source de la pièce : lisible, modifiable, comparable dans Git.",
    make: async (spec) => JSON.stringify(spec, null, 1) },
  { key: "step", ext: ".step", label: "STEP AP214", icon: "step", mime: "application/step", text: "Le solide exact, pour tout logiciel de CAO et tout atelier.",
    make: async (spec) => { await kernel.build(spec); return kernel.step([{ key: spec.id, name: `${spec.id} ${spec.name || ""}`.trim() }], spec.id); } },
  { key: "stl", ext: ".stl", label: "STL", icon: "stl", mime: "model/stl", text: "Le maillage, pour l'impression 3D et la visualisation.",
    make: async (spec) => { const b = await kernel.build(spec); return meshesToStl(b.bodies.map((x) => x.mesh), { name: spec.id }); } },
  { key: "dxf", ext: ".dxf", label: "DXF — vues", icon: "dxf", mime: "image/vnd.dxf", text: "Face, dessus et droite à l'échelle 1 : ouvert par tous les logiciels DWG / DXF.",
    make: async (spec) => { await kernel.build(spec); return viewsToDxf(await kernel.hlr(spec.id, viewRequest(), true), { title: `${spec.id} ${spec.name || ""}`.trim() }); } },
  { key: "flat", ext: "_decoupe.dxf", label: "DXF — contour de découpe", icon: "laser", mime: "image/vnd.dxf", text: "Le contour à plat et ses perçages, pour le laser ou le jet d'eau.", when: isFlat,
    make: async (spec) => { const b = await kernel.build(spec); return flatOutlineDxf(b, await kernel.hlr(spec.id, viewRequest(), true)); } },
  { key: "pdf", ext: ".pdf", label: "Dessin PDF", icon: "pdf", mime: "application/pdf", text: "Le dessin coté : vues, GD&T tiré des interfaces, cartouche, notes.", when: (spec) => !spec.step,
    make: async (spec) => (await makeDrawing(spec.id)).pdfBytes() },
  { key: "fs", ext: ".fs", label: "FeatureScript Onshape", icon: "fs", mime: "text/plain", text: "Expérimental : la pièce reconstruite nativement dans Onshape, paramètres compris.", when: (spec) => !spec.step,
    make: async (spec, out) => { const r = toFeatureScript(expandSpec(spec)); out.warnings.push(...r.warnings); if (r.skipped.length) out.warnings.push(`${r.skipped.length} opération(s) non converties sur ${r.total}.`); return r.code; } },
  { key: "gamme", ext: "_gamme.txt", label: "Gamme de fabrication", icon: "gamme", mime: "text/plain", text: "Le brut à acheter, les opérations dans l'ordre de l'atelier, les outils.", when: (spec) => !spec.step && spec.process !== "purchased",
    make: async (spec) => gammeText(spec, routing(spec, await kernel.build(spec))) },
];
export const artifactsFor = (spec) => ARTIFACTS.filter((a) => !a.when || a.when(spec));

/** One artefact of a part: { key, name, mime, bytes, warnings }. Throws with a French message when it cannot be made. */
export async function makeArtifact(partId, key) {
  const spec = store.part(partId), def = ARTIFACTS.find((a) => a.key === key);
  if (!spec) throw new Error(`Pièce « ${partId} » introuvable.`);
  if (!def) throw new Error(`Artéfact inconnu « ${key} ».`);
  const out = { key, name: `${spec.id}${def.ext}`, mime: def.mime, warnings: [] };
  out.bytes = await def.make(spec, out);
  return out;
}
/** Every applicable artefact of a part. A failing one is reported in `errors`, the others are kept. */
export async function partArtifacts(partId, keys) {
  const spec = store.part(partId), list = artifactsFor(spec).filter((a) => !keys || keys.includes(a.key)), files = [], errors = [];
  for (const a of list) { try { files.push(await makeArtifact(partId, a.key)); } catch (e) { errors.push({ key: a.key, label: a.label, message: e.message }); } }
  return { files, errors };
}
/** STEP and bill of materials of an assembly. */
export async function assemblyArtifacts(asmId) {
  const asm = store.assembly(asmId);
  if (!asm) throw new Error(`Assemblage « ${asmId} » introuvable.`);
  const ctx = await buildAssembly(asm), files = [], errors = [...ctx.errors.map((m) => ({ key: "step", label: "STEP", message: m }))];
  try {
    const items = ctx.asm.instances.map((i) => { const s = store.part(i.part); return { key: i.part, name: `${i.part} ${s.name || ""}`.trim(), instanceName: `${i.part} ${i.id}`, matrix: ctx.sol.placements[i.id] }; });
    files.push({ key: "step", name: `${asm.id}.step`, mime: "application/step", bytes: await kernel.step(items, `${asm.id} ${asm.name || ""}`.trim()), warnings: [] });
  } catch (e) { errors.push({ key: "step", label: "STEP", message: e.message }); }
  files.push({ key: "bom", name: `${asm.id}_nomenclature.csv`, mime: "text/csv", warnings: [],
    bytes: "﻿Item;Reference;Designation;Quantite;Materiau;Procede;Masse_g\n" + ctx.bom.map((r) => [r.item, r.id, `"${(r.name || "").replace(/"/g, '""')}"`, r.qty, r.material, r.process, r.mass === null ? "" : r.mass.toFixed(1)].join(";")).join("\n") });
  return { files, errors };
}

/** Everything the project publishes, as items for the Drive tree: [{ path, name, mime, bytes }]. onStep(text). */
export async function projectArtifacts(onStep = () => {}) {
  const p = store.project, items = [], errors = [];
  for (const spec of p.parts) {
    onStep(`${spec.id} : artéfacts…`);
    const r = await partArtifacts(spec.id);
    for (const f of r.files) items.push({ path: [TREE.parts, safeName(`${spec.id} ${spec.name || ""}`)], name: f.name, mime: f.mime, bytes: f.bytes });
    errors.push(...r.errors.map((e) => ({ ...e, of: spec.id })));
  }
  for (const asm of p.assemblies) {
    onStep(`${asm.id} : STEP et nomenclature…`);
    try { const r = await assemblyArtifacts(asm.id); for (const f of r.files) items.push({ path: [TREE.assemblies, safeName(`${asm.id} ${asm.name || ""}`)], name: f.name, mime: f.mime, bytes: f.bytes }); errors.push(...r.errors.map((e) => ({ ...e, of: asm.id }))); }
    catch (e) { errors.push({ key: "step", label: "Assemblage", message: e.message, of: asm.id }); }
  }
  if ((p.physics || []).length) items.push({ path: [TREE.analyses], name: "physique.json", mime: "application/json", bytes: JSON.stringify(p.physics, null, 1) });
  return { items, errors };
}
