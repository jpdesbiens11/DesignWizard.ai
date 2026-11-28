/* DynamiteOrbit.ai — artefacts: what a part or an assembly hands to the rest of the industry. One generator for the
   downloads, for the project tree in Google Drive and for the report:
     part      .dwiz (source) · STEP AP214 · STL · DXF (views) · DXF (flat outline, plate and sheet) · DXF (flat pattern
               with bend lines, folded sheet) · PDF drawing ·
               FeatureScript (Onshape, experimental) · routing sheet
     assembly  .dwiz · STEP · bill of materials (CSV)
   DWG itself is a closed, undocumented format: the platform writes DXF, which every DWG tool opens.
   Every one of them can be made for a variant of the document (opts.variant) : from a copy, built beside the part — the document and
   what the screens show are not changed — and what leaves carries the name of its variant (core/variant_out.js). */

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
import { buildAssembly, stepItems } from "./asm_scene.js";
import { TREE } from "../google/drive_fs.js";
import { toDwiz } from "./dwiz.js";
import { orderCheck, rfqText } from "../cad/order.js";
import { runDfx } from "../analysis/dfx_api.js";
import { zip } from "./zip.js";
import { stampText } from "./brand.js";
import { partOut, asmOut, variantTag, variantWords } from "./variant_out.js";

const isFlat = (spec) => !spec.folded && ((spec.stock && STOCK_FORMS[spec.stock.form] && STOCK_FORMS[spec.stock.form].flat) || ["plate", "sheet", "busbar"].includes(spec.family));

/* key -> what it is, for whom, and how it is made. `when(spec)` hides an artefact that does not apply.
   make(spec, out) : out.at is the key the part is built under in the kernel (its id, or a key of its own for a variant that is not the
   one the part is in), out.variant the name of the variant that leaves, out.asked the variant asked for. */
export const ARTIFACTS = [
  { key: "dwiz", ext: ".part.dwiz", label: "Fiche de pièce .dwiz", icon: "copy", mime: "text/plain", text: "La pièce dans le format de la plateforme : une instruction par ligne, lisible par un humain, un atelier et une IA.",
    make: async (spec) => toDwiz(spec) },
  { key: "step", ext: ".step", label: "STEP AP214", icon: "step", mime: "application/step", text: "Le solide exact, pour tout logiciel de CAO et tout atelier.",
    make: async (spec, out) => { await kernel.build(spec, undefined, out.at); return kernel.step([{ key: out.at, name: `${spec.id} ${spec.name || ""}`.trim() }], spec.id); } },
  { key: "stl", ext: ".stl", label: "STL", icon: "stl", mime: "model/stl", text: "Le maillage, pour l'impression 3D et la visualisation.",
    make: async (spec, out) => { const b = await kernel.build(spec, undefined, out.at); return meshesToStl(b.bodies.map((x) => x.mesh), { name: spec.id }); } },
  { key: "dxf", ext: ".dxf", label: "DXF — vues", icon: "dxf", mime: "image/vnd.dxf", text: "Face, dessus et droite à l'échelle 1 : ouvert par tous les logiciels DWG / DXF.",
    make: async (spec, out) => { await kernel.build(spec, undefined, out.at); return viewsToDxf(await kernel.hlr(out.at, viewRequest(), true), { title: `${spec.id} ${spec.name || ""}${out.variant ? ` — ${out.variant}` : ""}`.trim() }); } },
  { key: "flat", ext: "_decoupe.dxf", label: "DXF — contour de découpe", icon: "laser", mime: "image/vnd.dxf", text: "Le contour à plat et ses perçages, pour le laser ou le jet d'eau.", when: isFlat,
    make: async (spec, out) => { const b = await kernel.build(spec, undefined, out.at); return flatOutlineDxf(b, await kernel.hlr(out.at, viewRequest(), true)); } },
  { key: "unfold", ext: "_developpe.dxf", label: "DXF — développé à plat", icon: "laser", mime: "image/vnd.dxf", text: "La tôle avant pliage : contour et perçages à découper, lignes de pliage sur leur calque, sens, angle et rayon de chaque pli.", when: (spec) => !!spec.folded,
    make: async (spec, out) => { const b = await kernel.build(spec, undefined, out.at); let feats = []; try { feats = evalDeep(spec.features || [], (b.params && b.params.scope) || {}); } catch (e) { out.warnings.push("Découpes non reportées au développé : une expression de la pièce n'a pas pu être évaluée."); } const r = foldedDxf(b, feats); out.warnings.push(...r.warnings); return r.text; } },
  { key: "pdf", ext: ".pdf", label: "Dessin PDF", icon: "pdf", mime: "application/pdf", text: "Le dessin coté : vues, GD&T tiré des interfaces, cartouche, notes.", when: (spec) => !spec.step,
    make: async (spec, out) => (await makeDrawing(spec.id, { variant: out.asked })).pdfBytes() },
  { key: "fs", ext: ".fs", label: "FeatureScript Onshape", icon: "fs", mime: "text/plain", text: "Expérimental : la pièce reconstruite nativement dans Onshape, paramètres compris.", when: (spec) => !spec.step,
    make: async (spec, out) => { const r = toFeatureScript(expandSpec(spec)); out.warnings.push(...r.warnings); if (r.skipped.length) out.warnings.push(`${r.skipped.length} opération(s) non converties sur ${r.total}.`); return r.code; } },
  { key: "gamme", ext: "_gamme.txt", label: "Gamme de fabrication", icon: "gamme", mime: "text/plain", text: "Phase par phase : poste, prise de pièce, opérations, outils, contrôles — et les points à discuter avec le fournisseur.", when: (spec) => !spec.step && spec.process !== "purchased",
    make: async (spec, out) => planText(processPlan(spec, await kernel.build(spec, undefined, out.at), { variant: out.variant })) },
];
export const artifactsFor = (spec) => ARTIFACTS.filter((a) => !a.when || a.when(spec));

/** The key a part is built under for what leaves : its own, or one beside it for a variant the part is not in (the part the screens show stays in the kernel). */
const OUT_KEY = "out:variant", atOf = (o) => (o.copy ? OUT_KEY : o.doc.id);
/** One artefact of a part: { key, name, mime, bytes, warnings, variant }. Throws with a French message when it cannot be made.
    opts.variant : the name of a variant of the part — the file is that of the variant, and the part is not changed. */
export async function makeArtifact(partId, key, opts = {}) {
  const own = store.part(partId), def = ARTIFACTS.find((a) => a.key === key);
  if (!own) throw new Error(`Pièce « ${partId} » introuvable.`);
  if (!def) throw new Error(`Artéfact inconnu « ${key} ».`);
  const o = partOut(own, opts.variant), spec = o.doc;
  const out = { key, name: `${spec.id}${variantTag(o.variant)}${def.ext}`, mime: def.mime, warnings: [], at: atOf(o), variant: o.variant, asked: o.copy ? o.variant : null };
  out.bytes = stampText(out.name, await def.make(spec, out));      // text artefacts carry the note of the platform ; the PDF and the STL carry it by their own writers
  delete out.at; delete out.asked;
  return out;
}
/** Every applicable artefact of a part. A failing one is reported in `errors`, the others are kept ; a cancellation stops them all.
    onStep(label, done, total) says which file is being written. */
export async function partArtifacts(partId, keys, onStep = () => {}, opts = {}) {
  const spec = store.part(partId), list = artifactsFor(spec).filter((a) => !keys || keys.includes(a.key)), files = [], errors = [];
  for (const [i, a] of list.entries()) {
    onStep(a.label, i, list.length);
    try { files.push(await makeArtifact(partId, a.key, opts)); } catch (e) { if (e && e.cancelled) throw e; errors.push({ key: a.key, label: a.label, message: e.message }); }
  }
  return { files, errors };
}
/** STEP and bill of materials of an assembly. opts.variant : the name of one of its variants — the files are those of the variant
    (the parts it puts aside are not in them), and the assembly is not changed. */
export async function assemblyArtifacts(asmId, opts = {}) {
  const own = store.assembly(asmId);
  if (!own) throw new Error(`Assemblage « ${asmId} » introuvable.`);
  const o = asmOut(own, opts.variant), asm = o.doc, tag = variantTag(o.variant);
  const ctx = await buildAssembly(asm), files = [], errors = [...ctx.errors.map((m) => ({ key: "step", label: "STEP", message: m }))];
  try {
    const items = stepItems(asm, ctx.built);      // with its levels : a sub-assembly is a product of its own in the file
    files.push({ key: "step", name: `${asm.id}${tag}.step`, mime: "application/step", bytes: await kernel.step(items, `${asm.id} ${asm.name || ""}${o.variant ? ` — ${o.variant}` : ""}`.trim()), warnings: [] });
  } catch (e) { if (e && e.cancelled) throw e; errors.push({ key: "step", label: "STEP", message: e.message }); }
  files.push({ key: "dwiz", name: `${asm.id}${tag}.assembly.dwiz`, mime: "text/plain", bytes: toDwiz(asm), warnings: [] });
  files.push({ key: "bom", name: `${asm.id}${tag}_nomenclature.csv`, mime: "text/csv", warnings: [],
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
    catch (e) { if (e && e.cancelled) throw e; errors.push({ key: "step", label: "Assemblage", message: e.message, of: asm.id }); }
  }
  if ((p.physics || []).length) items.push({ path: [TREE.analyses], name: "physique.dwiz", mime: "text/plain", bytes: toDwiz({ dw: "analysis/1", id: "physique", name: "Physique vérifiée", runs: p.physics }) });
  return { items, errors };
}

/** Is the part ready to order, and in how many days? { check, route, built, dfx, variant } — order defaults to spec.order.
    opts.variant : the variant ordered — checked as that variant, the part is not changed. */
export async function orderStatus(partId, order, opts = {}) {
  const o = partOut(store.part(partId), opts.variant), spec = o.doc, built = await kernel.build(spec, undefined, atOf(o)), dfx = await runDfx(spec, built), route = routing(spec, built);
  return { spec, built, dfx, route, variant: o.variant, check: orderCheck(spec, built, dfx, route, order || spec.order || {}) };
}
/** The order package of a prototype part: one .zip with the request for quotation and every file a shop needs.
    onStep(text, done, total) says where it stands : the check of the part, then each file, then the archive. */
export async function orderPackage(partId, order, onStep = () => {}, opts = {}) {
  onStep(`Vérification de la pièce${variantWords(partOut(store.part(partId), opts.variant).variant)} avant la commande…`);
  const st = await orderStatus(partId, order, opts), spec = st.spec, keys = artifactsFor(spec).map((a) => a.key).filter((k) => k !== "fs"), dir = `${spec.id}${variantTag(st.variant)}`;
  const { files, errors } = await partArtifacts(partId, keys, (label, i, n) => onStep(`Dossier de commande ${i + 1} / ${n} : ${label}`, i, n), opts);
  onStep("Dossier de commande : archive…", keys.length, keys.length);
  const rfq = rfqText(spec, st.built, st.route, st.check, order || spec.order || {}, files.map((f) => f.name), st.variant);
  const bytes = zip([{ name: `${dir}/demande_de_prix.txt`, bytes: stampText("demande_de_prix.txt", rfq) }, ...files.map((f) => ({ name: `${dir}/${f.name}`, bytes: f.bytes }))]);
  return { name: `${dir}_commande.zip`, bytes, rfq, files: files.map((f) => f.name), errors, check: st.check, variant: st.variant };
}
