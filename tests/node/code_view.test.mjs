/* The code behind a screen : FeatureScript and .dwiz of what it shows, and the request that goes with it to an AI. */
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { elementFor, codeSources, aiCodePrompt } from "../../web/js/core/code_sources.js";
import { fromDwiz } from "../../web/js/core/dwiz.js";

const p = DEMO_DRIVE, part = p.parts[0], asm = p.assemblies[0];

test("each screen has its element : the part it edits, the assembly it shows, the proposal of the Shop, the project otherwise", () => {
  assert.deepEqual([elementFor(p, `#/parts/${part.id}`).kind, elementFor(p, `#/parts/${part.id}`).id], ["part", part.id]);
  assert.equal(elementFor(p, `#/drawings/asm/${asm.id}`).id, asm.id); assert.equal(elementFor(p, `#/drawings/${part.id}`).kind, "part"); assert.equal(elementFor(p, "#/assembly").id, asm.id, "no id : the first assembly");
  assert.equal(elementFor(p, `#/creepage/${asm.id}`).kind, "assembly"); assert.equal(elementFor(p, "#/pcba").kind, p.boards && p.boards.length ? "board" : "project");
  assert.equal(elementFor(p, "#/review").kind, "project"); assert.equal(elementFor(p, "#/home").label, `Projet — ${p.name}`);
  const proposal = { id: "PN-9", name: "Support", params: {}, features: [] }; assert.equal(elementFor(p, "#/shop", { spec: proposal }).label, "Proposition de l'Atelier — Support"); assert.equal(elementFor(p, "#/shop").kind, "project");
  assert.equal(elementFor(p, "#/parts", { spec: part }).id, part.id, "the part studio says which part it edits");
});

test("a part reads as FeatureScript — the definition Onshape runs — and as .dwiz ; an assembly as .dwiz and the FeatureScript of its parts", () => {
  const src = codeSources(p, elementFor(p, `#/parts/${part.id}`)); assert.deepEqual(src.map((s) => [s.key, s.file]), [["fs", `${part.id}.fs`], ["dwiz", `${part.id}.dwiz`]]);
  assert.match(src[0].text, /defineFeature\(function\(context is Context, id is Id, definition is map\)/); assert.match(src[0].text, /FeatureScript \d+;/); assert.match(src[0].text, /EXPÉRIMENTAL — NON TESTÉ DANS ONSHAPE/);
  assert.match(src[0].notes.join(" "), /opération\(s\) sur \d+ converties/); assert.equal(fromDwiz(src[1].text).id, part.id, "the .dwiz is the part itself");
  const a = codeSources(p, elementFor(p, `#/assembly/${asm.id}`)); assert.deepEqual(a.map((s) => s.key), ["dwiz", "fs"]);
  for (const id of new Set(asm.instances.map((i) => i.part))) assert.match(a[1].text, new RegExp(`// ===== ${id} — `));
  assert.equal((a[1].text.match(/defineFeature\(/g) || []).length, new Set(asm.instances.map((i) => i.part)).size);
  const all = codeSources(p, elementFor(p, "#/report")); assert.deepEqual(all.map((s) => s.key), ["dwiz"]); assert.doesNotMatch(all[0].text, /^review /m, "the ledgers stay in DynamiteOrbit");
  assert.match(codeSources(p, { kind: "part", id: "S", doc: { id: "S", step: { text: "x" } } })[0].text, /géométrie STEP importée/);
});

test("handed to an AI, the code comes after a short formal request : the interview, then the answer that can come back", () => {
  const e = elementFor(p, `#/parts/${part.id}`), [fs, dwiz] = codeSources(p, e), t = aiCodePrompt(p, e, fs);
  for (const re of [/^Tu es l'assistant de conception de DynamiteOrbit\. Voici la pièce « /, /sous forme de FeatureScript Onshape/, /ENTREVUE — .*au plus cinq questions, une à la fois/, /RÉPONSE ATTENDUE — un seul bloc de code ```dwiz/, /c'est le bloc dwiz qui revient dans DynamiteOrbit/, /RETOUR — /, /----- FeatureScript -----/, /----- \.dwiz — le format de ta réponse -----/]) assert.match(t, re);
  assert.ok(t.indexOf("ENTREVUE") < t.indexOf("----- FeatureScript -----"), "the request comes first, the code after"); assert.ok(t.includes(fs.text.trimEnd()) && t.includes(dwiz.text.trimEnd()));
  const d = aiCodePrompt(p, e, dwiz); assert.match(d, /sous forme de spécification \.dwiz/); assert.doesNotMatch(d, /FeatureScript te donne/); assert.equal((d.match(/-----/g) || []).length, 2, "the .dwiz alone : once");
  assert.match(aiCodePrompt(p, elementFor(p, `#/assembly/${asm.id}`), codeSources(p, elementFor(p, `#/assembly/${asm.id}`))[0]), /Voici l'assemblage « /);
});
