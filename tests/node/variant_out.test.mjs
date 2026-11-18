/* What leaves follows a chosen variant : the files, the order, the routings and the drawings say which variant they are, and are
   made for a variant the document is not in without changing it — core/variant_out.js and its readers. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { namedVariant, partOut, asmOut, variantTag, variantFacts, variantWords, outChoices, outGuide, variantRows } from "../../web/js/core/variant_out.js";
import { variantNow } from "../../web/js/core/variants.js";
import { asmVariantNow, liveAsm } from "../../web/js/core/asm_live.js";
import { assemblyPlan } from "../../web/js/core/asm_plan.js";
import { planText } from "../../web/js/core/plan_doc.js";
import { rfqText } from "../../web/js/cad/order.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const part = () => ({ id: "BASE", name: "Socle", revision: "B", material: "al6061", process: "cnc_milling",
  params: { L: { value: 200, label: "Longueur" }, e: 6, half: { expr: "L / 2" } },
  features: [{ id: "f1", op: "box", size: ["L", 40, "e"] }, { id: "f2", op: "hole", d: 5, suppressed: true }, { id: "f3", op: "pocket" }],
  variants: [{ name: "Longue", off: ["f2"], params: { L: 200, e: 6 } }, { name: "Courte percée", off: [], params: { L: 160, e: 6 } }] });
const asm = () => ({ id: "ASM", name: "Ensemble", revision: "A", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }, { id: "i3", part: "ISOLANT", off: true }],
  mates: [{ id: "M1", a: { inst: "i1" }, b: { inst: "i2" } }, { id: "M2", a: { inst: "i1" }, b: { inst: "i3" } }],
  variants: [{ name: "Sans isolant", off: ["i3"] }, { name: "Nu", off: ["i2", "i3"] }, { name: "Complet", off: [] }] });

test("variant out : a part leaves as it is, and says the variant it is in", () => {
  const p = part(), o = partOut(p);
  assert.equal(o.doc, p, "nothing asked : the part itself"); assert.equal(o.variant, "Longue", "the name of the variant it is in goes on what leaves"); assert.equal(o.copy, false);
  assert.deepEqual(partOut(p, "Longue"), { doc: p, variant: "Longue", copy: false }, "asked for the variant it is in : no copy");
  assert.deepEqual(partOut(p, "Disparue"), { doc: p, variant: "Longue", copy: false }, "a name that is gone : the part as it is");
  p.params.L.value = 180; assert.deepEqual(partOut(p), { doc: p, variant: null, copy: false }, "a state nobody named : no name on what leaves");
  assert.equal(namedVariant(p, "Longue").name, "Longue"); assert.equal(namedVariant(p, ""), null); assert.equal(namedVariant(null, "x"), null); assert.equal(namedVariant({ id: "X" }, "x"), null);
});

test("variant out : a part leaves as another variant from a copy — the part is not changed", () => {
  const p = part(), before = JSON.stringify(p), o = partOut(p, "Courte percée");
  assert.equal(o.copy, true); assert.equal(o.variant, "Courte percée"); assert.notEqual(o.doc, p);
  assert.equal(o.doc.params.L.value, 160); assert.equal(o.doc.params.L.label, "Longueur", "the definition of the parameter is kept"); assert.equal(o.doc.features[1].suppressed, undefined, "the hole is made in this cousin");
  assert.equal(o.doc.id, "BASE"); assert.equal(o.doc.revision, "B"); assert.equal(o.doc.material, "al6061", "the number, the revision and the material are those of the document");
  assert.equal(variantNow(o.doc), "Courte percée", "the copy is that variant : every reader that asks finds its name");
  assert.equal(JSON.stringify(p), before, "the part itself is untouched"); assert.equal(variantNow(p), "Longue");
});

test("variant out : an assembly leaves as a variant — the parts it puts aside are off in the copy only", () => {
  const a = asm(), before = JSON.stringify(a);
  assert.deepEqual(asmOut(a), { doc: a, variant: "Sans isolant", copy: false });
  const o = asmOut(a, "Nu"); assert.equal(o.copy, true); assert.equal(o.variant, "Nu"); assert.deepEqual(liveAsm(o.doc).instances.map((i) => i.id), ["i1"]); assert.equal(liveAsm(o.doc).mates.length, 0, "the joints of the parts put aside wait");
  const full = asmOut(a, "Complet"); assert.equal(liveAsm(full.doc).instances.length, 3); assert.equal(asmVariantNow(full.doc), "Complet");
  assert.equal(JSON.stringify(a), before, "the assembly itself is untouched");
  delete a.instances[2].off; a.instances[1].off = true; assert.deepEqual(asmOut(a), { doc: a, variant: null, copy: false }, "a state nobody named");
});

test("variant out : the name of a file, the line of a sheet, the words of a sentence", () => {
  assert.equal(variantTag("Longue"), "_Longue"); assert.equal(variantTag("Courte percée"), "_Courte-percée", "letters kept, accents too ; a space is a dash");
  assert.equal(variantTag(" 2 × M4 / rév.B "), "_2-M4-rév-B"); assert.equal(variantTag(null), ""); assert.equal(variantTag(""), "", "no variant : the name is not changed");
  assert.deepEqual(variantFacts("Longue"), [["Variante", "Longue"]]); assert.deepEqual(variantFacts(null), []);
  assert.equal(variantWords("Longue"), ", variante « Longue »"); assert.equal(variantWords(null), "");
});

test("variant out : the menu offers the document as it is first, then each cousin", () => {
  const p = part(); assert.deepEqual(outChoices(p), [{ value: "", label: "La pièce telle qu'elle est (Longue)" }, { value: "Longue", label: "Longue" }, { value: "Courte percée", label: "Courte percée" }]);
  p.params.e = 8; assert.equal(outChoices(p)[0].label, "La pièce telle qu'elle est (état sans nom)");
  assert.equal(outChoices(asm(), true)[0].label, "L'assemblage tel qu'il est (Sans isolant)"); assert.equal(outChoices(asm(), true).length, 4);
  assert.deepEqual(outChoices({ id: "X" }), [{ value: "", label: "La pièce telle qu'elle est (état sans nom)" }]);
});

test("variant out : the guide warns when what leaves is not what the screen shows, and when the state has no name", () => {
  const p = part(); assert.deepEqual(outGuide(p, ""), [], "the part leaves as the named variant it is in : nothing to say");
  const w = outGuide(p, "Courte percée"); assert.equal(w.length, 1); assert.equal(w[0].level, "warn"); assert.equal(w[0].field, "out"); assert.match(w[0].text, /^BASE — ce qui sort est la variante « Courte percée » ; la pièce est dans « Longue » à l'écran/);
  p.params.e = 8; const t = outGuide(p, ""); assert.equal(t[0].level, "tip"); assert.match(t[0].text, /garde 2 variantes, mais son état en ce moment n'a pas de nom : ce qui sort n'en portera aucun/);
  assert.match(outGuide(p, "Longue")[0].text, /la pièce est dans un état sans nom à l'écran/);
  assert.deepEqual(outGuide({ id: "X", features: [] }, ""), [], "a document without variants : the guide asks nothing");
  assert.match(outGuide(asm(), "Nu", true)[0].text, /^ASM — ce qui sort est la variante « Nu » ; l'assemblage est dans « Sans isolant » à l'écran/);
});

test("variant out : the report lists each document that keeps variants, the one shown and what the others change", () => {
  const p = part(), a = asm(), rows = variantRows({ parts: [p, { id: "CAPOT", name: "Couvercle" }, { id: "ISOLANT" }], assemblies: [a, { id: "AUTRE", instances: [] }] });
  assert.deepEqual(rows.map((r) => [r.kind, r.id, r.now]), [["part", "BASE", "Longue"], ["assembly", "ASM", "Sans isolant"]], "a document without variants is not listed");
  assert.deepEqual(rows[0].variants, [{ name: "Longue", on: true, diff: [] }, { name: "Courte percée", on: false, diff: ["1 opération bascule", "Longueur 200 → 160"] }]);
  assert.deepEqual(rows[1].variants, [{ name: "Sans isolant", on: true, diff: [] }, { name: "Nu", on: false, diff: ["CAPOT Couvercle à Off"] }, { name: "Complet", on: false, diff: ["ISOLANT à On"] }]);
  assert.deepEqual(variantRows({}), []); assert.deepEqual(variantRows(null), []);
});

test("variant out : the assembly routing says which variant it mounts, and mounts only its parts", () => {
  const spec = (id, name) => ({ id, name, features: [], interfaces: [] }), project = { parts: [spec("BASE", "Socle"), spec("CAPOT", "Couvercle"), spec("ISOLANT", "Isolant")], assemblies: [] };
  const a = asm(), now = assemblyPlan(a, project);
  assert.deepEqual(now.facts[0], ["Variante", "Sans isolant"], "the variant the assembly is in, first of the facts"); assert.deepEqual(now.facts[1], ["Pièces", "2"]);
  const nu = assemblyPlan(asmOut(a, "Nu").doc, project); assert.deepEqual(nu.facts.slice(0, 2), [["Variante", "Nu"], ["Pièces", "1"]]);
  const full = assemblyPlan(asmOut(a, "Complet").doc, project); assert.deepEqual(full.facts.slice(0, 2), [["Variante", "Complet"], ["Pièces", "3"]]);
  assert.match(planText(full), /^Variante : Complet$/m, "the text sheet carries the line");
  assert.deepEqual(assemblyPlan(a, project, { variant: null }).facts[0], ["Pièces", "2"], "a caller can say there is none");
  const plain = { ...a }; delete plain.variants; assert.deepEqual(assemblyPlan(plain, project).facts[0], ["Pièces", "2"], "an assembly without variants : no line");
});

test("variant out : the request for quotation names the variant ordered", () => {
  const spec = { id: "BASE", name: "Socle", revision: "B", material: "al6061", process: "cnc_milling" }, built = { bbox: [0, 0, 0, 160, 40, 6], mass: 103.7 }, check = { quantity: 2, days: [3, 5], blockers: [], cautions: [] };
  const t = rfqText(spec, built, null, check, {}, ["BASE_Courte-percée.step"], "Courte percée");
  assert.match(t, /^Pièce : BASE — Socle \(rév\. B\)\nVariante : Courte percée — les fichiers joints sont ceux de cette variante\nQuantité : 2$/m); assert.match(t, / {2}- BASE_Courte-percée\.step/);
  assert.doesNotMatch(rfqText(spec, built, null, check, {}, []), /Variante/, "no variant : no line");
});

test("wiring : every way out goes through core/variant_out.js", () => {
  const a = read("web/js/core/artifacts.js"), d = read("web/js/modules/drawings.js"), pp = read("web/js/cad/process_plan.js");
  assert.match(a, /export async function makeArtifact\(partId, key, opts = \{\}\)/); assert.match(a, /const o = partOut\(own, opts\.variant\), spec = o\.doc;/);
  assert.match(a, /name: `\$\{spec\.id\}\$\{variantTag\(o\.variant\)\}\$\{def\.ext\}`/, "the file carries the name of its variant");
  assert.match(a, /const OUT_KEY = "out:variant", atOf = \(o\) => \(o\.copy \? OUT_KEY : o\.doc\.id\);/, "a variant the part is not in is built beside it : the kernel keeps the part the screens show");
  assert.equal((a.match(/kernel\.build\(spec\)/g) || []).length, 0, "no artefact builds under the id of the part what may be a copy");
  assert.ok((a.match(/kernel\.build\(spec, undefined, out\.at\)/g) || []).length >= 6); assert.match(a, /kernel\.hlr\(out\.at, viewRequest\(\), true\)/); assert.match(a, /kernel\.step\(\[\{ key: out\.at,/);
  assert.match(a, /makeDrawing\(spec\.id, \{ variant: out\.asked \}\)/, "the PDF drawing of the package is that of the variant");
  assert.match(a, /export async function partArtifacts\(partId, keys, onStep = \(\) => \{\}, opts = \{\}\)/); assert.match(a, /export async function orderStatus\(partId, order, opts = \{\}\)/); assert.match(a, /export async function orderPackage\(partId, order, onStep = \(\) => \{\}, opts = \{\}\)/);
  assert.match(a, /dir = `\$\{spec\.id\}\$\{variantTag\(st\.variant\)\}`/); assert.match(a, /return \{ name: `\$\{dir\}_commande\.zip`/, "the archive of an order names the variant ordered");
  assert.match(a, /export async function assemblyArtifacts\(asmId, opts = \{\}\)/); assert.match(a, /const o = asmOut\(own, opts\.variant\), asm = o\.doc, tag = variantTag\(o\.variant\);/);
  assert.match(pp, /facts: \[\.\.\.variantFacts\(opts\.variant === undefined \? variantNow\(spec\) : opts\.variant\),/, "the routing of a part says its variant");
  assert.match(d, /download\(`\$\{id\}\$\{variantTag\(st\.doc\.variant\)\}_rev/, "the PDF of a sheet carries the variant the sheet shows");
  assert.doesNotMatch(read("web/js/core/variant_out.js"), /document\.|window\.|store\./, "the model is pure");
});

test("wiring : the screens that let something out offer the same menu, and the order follows it", () => {
  const g = read("web/js/modules/part_gamme.js"), v = read("web/js/modules/part_variants.js"), o = read("web/js/modules/onshape.js"), a = read("web/js/modules/assembly.js"), r = read("web/js/modules/report.js"), pv = read("web/js/modules/plan_view.js");
  assert.match(v, /export function outPicker\(o\)/); assert.match(v, /"aria-label": "Variante qui sort", "data-field": "out"/); assert.match(v, /class: "out-variant" \+ \(out\.copy \? " other" : ""\)/, "tinted when what leaves is not the cousin on the screen");
  assert.match(g, /const picker = outPicker\(\{ doc: st\.spec, value: asked, what: "La commande et les fichiers"/); assert.match(g, /orderStatus\(id, order, opts\)/); assert.equal((g.match(/orderPackage\(id, order, say, opts\)/g) || []).length, 3, "the three ways an order leaves — copied, archived, put in Drive — follow the variant");
  assert.match(g, /makeArtifact\(id, a\.key, opts\)/); assert.match(g, /saveOrder\(store\.project, p, \{ partId: id, quantity: c\.quantity, variant: p\.variant \}\)/); assert.match(g, /guide = \[\.\.\.outGuide\(kept, asked\), \.\.\.orderGuide\(kept, s\.check\)\]/, "the guide of the tab says what is about to leave");
  assert.match(read("web/js/google/drive_fs.js"), /safeName\(`\$\{day\(when\)\} \$\{partId\}\$\{variant \? ` \$\{variant\}` : ""\} ×\$\{quantity\}`\)/, "the folder of an order in Drive names the variant ordered");
  assert.match(o, /outPicker\(\{ doc: store\.assembly\(asmSel\.value\), isAsm: true, value: state\.out \|\| ""/); assert.match(o, /const leaving = asmOut\(store\.assembly\(asmSel\.value\), state\.out\), asm = leaving\.doc/, "Onshape receives the variant chosen");
  for (const name of ["`${id}${tagNow()}.step`", "`${id}${tagNow()}-joints.csv`", "`${id}${tagNow()}_BOM_niveaux.csv`", "`${id}${tagNow()}_BOM.csv`"]) assert.ok(a.includes(`download(${name}`), `the assembly screen : ${name}`);
  assert.match(r, /const fam = variantRows\(store\.project\);/); assert.match(r, /el\("h2", null, "Variantes"\)/); assert.match(r, /\["Variante montrée", partOut\(s\)\.variant \|\| "état sans nom"\]/);
  assert.match(pv, /variant = \(plan\.facts\.find\(\(\[k\]\) => k === "Variante"\) \|\| \[\]\)\[1\]/, "the routing panel shows the variant it routes");
  assert.match(read("web/css/app.css"), /\.out-variant\.other \{/);
});
