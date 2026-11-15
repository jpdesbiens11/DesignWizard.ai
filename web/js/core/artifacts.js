/* DesignWizard.ai — artefacts: what a part or an assembly hands to the rest of the industry. One generator for the
   downloads, for the project tree in Google Drive and for the report:
     part      .dwiz (source) · STEP AP214 · STL · DXF (views) · DXF (flat outline, plate and sheet) · DXF (flat pattern
               with bend lines, folded sheet) · PDF drawing ·
               FeatureScript (Onshape, experimental) · routing sheet
     assembly  .dwiz · STEP · bill of materials (CSV)
   DWG itself is a closed, undocumented format: the platform writes DXF, which every DWG tool opens. */

import { store } from "./store.js";
import { kernel } from "../cad/client.js";
import { meshesToStl } from "../cad/stl.js";
import { viewsToDxf, flatOutlineDxf } from "../draw/dxf.js";
import { foldedDxf } from "../draw/dxf_folded.js";
import { evalDeep } from "../cad/expr.js";
import { toFeatureScript } from "../cad/featurescript.js";
import { expandSpec, routing } from "../cad/shop.js";
import { STOCK_FORMS } from "../cad/stock.js";
import { viewRequest } from "../draw/part_drawing.js";
import { makeDrawing } from "../modules/drawings.js";
import { processPlan } from "../cad/process_plan.js";
import { planText } from "./plan_doc.js";
import { buildAssembly } from "./asm_scene.js";
import { TREE } from "../google/drive_fs.js";
import { toDwiz } from "./dwiz.js";
import { orderCheck, rfqText } from "../cad/order.js";
import { runDfx } from "../analysis/dfx_api.js";
import { zip } from "./zip.js";

const isFlat = (spec) => !spec.folded && ((spec.stock && STOCK_FORMS[spec.stock.form] && STOCK_FORMS[spec.stock.form].flat) || ["plate", "sheet", "busbar"].includes(spec.family));

/* key -> what it is, for whom, and how it is made. `when(spec)` hides an artefact that does not apply. */
export const ARTIFACTS = [
  { key: "dwiz", ext: ".part.dwiz", label: "Fiche de pièce .dwiz", icon: "copy", mime: "text/plain", text: "La pièce dans le format de la plateforme : une instruction par ligne, lisible par un humain, un atelier et une IA.",
    make: async (spec) => toDwiz(spec) },
  { key: "step", ext: ".step", label: "STEP AP214", icon: "step", mime: "application/step", text: "Le solide exact, pour tout logiciel de CAO et tout atelier.",
    make: async (spec) => { await kernel.build(spec); return kernel.step([{ key: spec.id, name: `${spec.id} ${spec.name || ""}`.trim() }], spec.id); } },
  { key: "stl", ext: ".stl", label: "STL", icon: "stl", mime: "model/stl", text: "Le maillage, pour l'impression 3D et la visualisation.",
    make: async (spec) => { const b = await kernel.build(spec); return meshesToStl(b.bodies.map((x) => x.mesh), { name: spec.id }); } },
  { key: "dxf", ext: ".dxf", label: "DXF — vues", icon: "dxf", mime: "image/vnd.dxf", text: "Face, dessus et droite à l'échelle 1 : ouvert par tous les logiciels DWG / DXF.",
    make: async (spec) => { await kernel.build(spec); return viewsToDxf(await kernel.hlr(spec.id, viewRequest(), true), { title: `${spec.id} ${spec.name || ""}`.trim() }); } },
  { key: "flat", ext: "_decoupe.dxf", label: "DXF — contour de découpe", icon: "laser", mime: "image/vnd.dxf", text: "Le contour à plat et ses perçages, pour le laser ou le jet d'eau.", when: isFlat,
    make: async (spec) => { const b = await kernel.build(spec); return flatOutlineDxf(b, await kernel.hlr(spec.id, viewRequest(), true)); } },
  { key: "unfold", ext: "_developpe.dxf", label: "DXF — développé à plat", icon: "laser", mime: "image/vnd.dxf", text: "La tôle avant pliage : contour et perçages à découper, lignes de pliage sur leur calque, sens, angle et rayon de chaque pli.", when: (spec) => !!spec.folded,
    make: async (spec, out) => { const b = await kernel.build(spec); let feats = []; try { feats = evalDeep(spec.features || [], (b.params && b.params.scope) || {}); } catch (e) { out.warnings.push("Découpes non reportées au développé : une expression de la pièce n'a pas pu être évaluée."); } const r = foldedDxf(b, feats); out.warnings.push(...r.warnings); return r.text; } },
  { key: "pdf", ext: ".pdf", label: "Dessin PDF", icon: "pdf", mime: "application/pdf", text: "Le dessin coté : vues, GD&T tiré des interfaces, cartouche, notes.", when: (spec) => !spec.step,
    make: async (spec) => (await makeDrawing(spec.id)).pdfBytes() },
  { key: "fs", ext: ".fs", label: "FeatureScript Onshape", icon: "fs", mime: "text/plain", text: "Expérimental : la pièce reconstruite nativement dans Onshape, paramètres compris.", when: (spec) => !spec.step,
    make: async (spec, out) => { const r = toFeatureScript(expandSpec(spec)); out.warnings.push(...r.warnings); if (r.skipped.length) out.warnings.push(`${r.skipped.length} opération(s) non converties sur ${r.total}.`); return r.code; } },
  { key: "gamme", ext: "_gamme.txt", label: "Gamme de fabrication", icon: "gamme", mime: "text/plain", text: "Phase par phase : poste, prise de pièce, opérations, outils, contrôles — et les points à discuter avec le fournisseur.", when: (spec) => !spec.step && spec.process !== "purchased",
    make: async (spec) => planText(processPlan(spec, await kernel.build(spec))) },
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
  files.push({ key: "dwiz", name: `${asm.id}.assembly.dwiz`, mime: "text/plain", bytes: toDwiz(asm), warnings: [] });
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
    for (const f of r.files) items.push({ of: { kind: "part", id: spec.id, name: spec.name || "" }, name: f.name, mime: f.mime, bytes: f.bytes });
    errors.push(...r.errors.map((e) => ({ ...e, of: spec.id })));
  }
  for (const asm of p.assemblies) {
    onStep(`${asm.id} : STEP et nomenclature…`);
    try { const r = await assemblyArtifacts(asm.id); for (const f of r.files) items.push({ of: { kind: "assembly", id: asm.id, name: asm.name || "" }, name: f.name, mime: f.mime, bytes: f.bytes }); errors.push(...r.errors.map((e) => ({ ...e, of: asm.id }))); }
    catch (e) { errors.push({ key: "step", label: "Assemblage", message: e.message, of: asm.id }); }
  }
  if ((p.physics || []).length) items.push({ path: [TREE.analyses], name: "physique.dwiz", mime: "text/plain", bytes: toDwiz({ dw: "analysis/1", id: "physique", name: "Physique vérifiée", runs: p.physics }) });
  return { items, errors };
}

/** Is the part ready to order, and in how many days? { check, route, built, dfx } — order defaults to spec.order. */
export async function orderStatus(partId, order) {
  const spec = store.part(partId), built = await kernel.build(spec), dfx = await runDfx(spec, built), route = routing(spec, built);
  return { spec, built, dfx, route, check: orderCheck(spec, built, dfx, route, order || spec.order || {}) };
}
/** The order package of a prototype part: one .zip with the request for quotation and every file a shop needs. */
export async function orderPackage(partId, order) {
  const st = await orderStatus(partId, order), spec = st.spec, keys = artifactsFor(spec).map((a) => a.key).filter((k) => k !== "fs");
  const { files, errors } = await partArtifacts(partId, keys);
  const rfq = rfqText(spec, st.built, st.route, st.check, order || spec.order || {}, files.map((f) => f.name));
  const bytes = zip([{ name: `${spec.id}/demande_de_prix.txt`, bytes: rfq }, ...files.map((f) => ({ name: `${spec.id}/${f.name}`, bytes: f.bytes }))]);
  return { name: `${spec.id}_commande.zip`, bytes, rfq, files: files.map((f) => f.name), errors, check: st.check };
}
