/* The variants of an assembly — which of its parts are on, kept under a name — and a drawing for each variant, of a part or of an
   assembly, that does not change the document : core/asm_live.js, modules/part_variants.js, modules/drawings.js. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liveAsm, asmVariantOf, isAsmVariant, asmVariantNow, applyAsmVariant, asVariant, keepAsmVariant, dropAsmVariant, asmVariantDiff } from "../../web/js/core/asm_live.js";
import { applyVariant, keepVariant, variantNow } from "../../web/js/core/variants.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const asm = () => ({ id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }, { id: "i3", part: "ISOLANT", off: true }, { id: "i4", part: "CARTE" }],
  mates: [{ id: "M1", a: { inst: "i1" }, b: { inst: "i2" } }, { id: "M2", a: { inst: "i1" }, b: { inst: "i3" } }, { id: "M3", a: { inst: "i1" }, b: { inst: "i4" } }] });

test("assembly variant : what the assembly is now, kept under a name", () => {
  const a = asm(); assert.deepEqual(asmVariantOf(a), { off: ["i3"] }); assert.equal(asmVariantNow(a), null, "a state without a name");
  a.variants = keepAsmVariant(a, "  Sans   isolant "); assert.deepEqual(a.variants, [{ name: "Sans isolant", off: ["i3"] }]); assert.equal(asmVariantNow(a), "Sans isolant");
  a.instances[2].off = false; delete a.instances[2].off; assert.equal(asmVariantNow(a), null); a.variants = keepAsmVariant(a, "Complet"); assert.deepEqual(a.variants.map((v) => v.name), ["Sans isolant", "Complet"]); assert.deepEqual(a.variants[1].off, []);
  a.instances[1].off = true; a.variants = keepAsmVariant(a, "Complet"); assert.deepEqual(a.variants.map((v) => v.name), ["Sans isolant", "Complet"], "a name already there is replaced, at its place"); assert.deepEqual(a.variants[1].off, ["i2"]);
  assert.deepEqual(keepAsmVariant(a, "   "), a.variants, "no name : nothing kept"); assert.deepEqual(dropAsmVariant(a, "Complet").map((v) => v.name), ["Sans isolant"]);
});

test("assembly variant : one step brings every part on or off as the variant says", () => {
  const a = asm(); a.variants = [{ name: "Sans isolant", off: ["i3"] }, { name: "Nu", off: ["i2", "i3", "i4"] }, { name: "Complet", off: [] }];
  assert.deepEqual(asmVariantDiff(a, a.variants[1], { i2: "Couvercle", i4: "Carte de contrôle" }), ["Couvercle à Off", "Carte de contrôle à Off"]); assert.deepEqual(asmVariantDiff(a, a.variants[2]), ["ISOLANT à On"]); assert.deepEqual(asmVariantDiff(a, a.variants[0]), []);
  assert.equal(applyAsmVariant(a, a.variants[1]), 2); assert.deepEqual(a.instances.map((i) => !!i.off), [false, true, true, true]); assert.equal(asmVariantNow(a), "Nu");
  assert.equal(liveAsm(a).instances.length, 1); assert.equal(liveAsm(a).mates.length, 0, "everything that reads the assembly follows : the joints of the parts put aside wait");
  assert.equal(applyAsmVariant(a, a.variants[2]), 3); assert.ok(a.instances.every((i) => !("off" in i)), "on again : the mark is gone, not left as false"); assert.equal(applyAsmVariant(a, a.variants[2]), 0);
  assert.equal(a.instances[0].fixed, true, "nothing else of a part is touched");
});

test("assembly variant : a part added later belongs to every variant ; a part that is gone does not make another one", () => {
  const a = asm(); a.variants = [{ name: "Sans isolant", off: ["i3", "i9"] }];
  assert.ok(isAsmVariant(a, a.variants[0]), "i9 is no longer in the assembly : the variant is still this one");
  a.instances.push({ id: "i5", part: "VIS" }); assert.ok(isAsmVariant(a, a.variants[0]), "a new part, on : still this variant");
  a.instances[4].off = true; assert.equal(isAsmVariant(a, a.variants[0]), false);
});

test("assembly variant : seen as a variant without being changed — for its drawing", () => {
  const a = asm(), nu = { name: "Nu", off: ["i2", "i3", "i4"] }, seen = asVariant(a, nu);
  assert.notEqual(seen, a); assert.deepEqual(seen.instances.map((i) => !!i.off), [false, true, true, true]); assert.deepEqual(a.instances.map((i) => !!i.off), [false, false, true, false], "the assembly itself is as it was");
  assert.equal(liveAsm(seen).instances.length, 1); assert.equal(seen.name, "Ensemble"); assert.equal(seen.mates, a.mates);
  assert.equal(asVariant(a, { name: "Sans isolant", off: ["i3"] }), a, "the variant it is in already : the same object"); assert.equal(asVariant(a, null), a);
  const full = asVariant(a, { name: "Complet", off: [] }); assert.ok(full.instances.every((i) => !("off" in i))); assert.equal(a.instances[2].off, true);
});

test("part variant : drawn as a variant without being changed", () => {
  const part = { id: "P", name: "Bride", params: { L: { value: 160, label: "Longueur" }, e: 4 }, features: [{ id: "f1", op: "box" }, { id: "f2", op: "hole" }, { id: "f3", op: "fillet", suppressed: true }] };
  part.variants = keepVariant(part, "Courte"); const long = { name: "Longue", off: ["f2"], params: { L: 200, e: 4 } };
  const seen = { ...part, ...applyVariant(part, long) };
  assert.equal(seen.params.L.value, 200); assert.equal(seen.features[1].suppressed, true); assert.equal(seen.features[2].suppressed, undefined); assert.equal(seen.id, "P");
  assert.equal(part.params.L.value, 160); assert.equal(part.features[1].suppressed, undefined); assert.equal(variantNow(part), "Courte", "the part is still the variant it was in");
});

test("wiring : the assembly has its variants group, each variant its drawing, and the sheet says which one it shows", () => {
  const a = read("web/js/modules/assembly.js"), v = read("web/js/modules/part_variants.js"), d = read("web/js/modules/drawings.js");
  assert.match(a, /scroll\.append\(sec, asmVariantsSection\(\{ asm: a, id, names: /); assert.doesNotMatch(a.split("asmVariantsSection({")[1].split("\n")[0], /instName/, "the left panel is drawn before instName exists : the names come from the store");
  assert.match(v, /export function variantPanel\(o\)/); assert.match(v, /export function variantsSection\(o\)/); assert.match(v, /export function asmVariantsSection\(o\)/, "one group, the same for a part and for an assembly");
  assert.match(v, /store\.updateAssembly\(o\.id, \(x\) => \{ applyAsmVariant\(x, v\); \}, `\$\{a\.id\} : variante « \$\{v\.name\} »`\)/, "one named step, undone by Ctrl + Z");
  assert.match(v, /drawing: \(v\) => `#\/drawings\/\$\{encodeURIComponent\(o\.id\)\}\/\$\{encodeURIComponent\(v\.name\)\}`/); assert.match(v, /drawing: \(v\) => `#\/drawings\/asm\/\$\{encodeURIComponent\(o\.id\)\}\/\$\{encodeURIComponent\(v\.name\)\}`/);
  assert.match(d, /const o = partOut\(own, extra\.variant\), spec = o\.doc;/, "a part is drawn as a variant from a copy (core/variant_out.js)");
  assert.match(d, /const key = o\.copy \? "drawing:variant" : partId, built = await kernel\.build\(spec, undefined, key\);/, "built beside the part : the kernel keeps the part as the other screens show it");
  assert.match(d, /const o = asmOut\(own, extra\.variant\), asm = o\.doc;/);
  assert.equal((d.match(/variant: o\.variant \}\)/g) || []).length, 2, "the sheet names the variant it shows — the one asked for, or the one the document is in");
  assert.match(d, /aria-label": "Variante dessinée"/); assert.match(d, /makeAssemblyDrawing\(id, \{ variant \}\) : await makeDrawing\(id, \{ variant \}\)/);
  for (const f of ["web/js/draw/part_drawing.js", "web/js/draw/asm_drawing.js"]) assert.match(read(f), /\$\{o\.variant \? ` — VARIANT \$\{say\(o\.variant\)\}` : ""\}/, `${f} : the title block says the variant, in English`);
  assert.doesNotMatch(read("web/js/core/asm_live.js"), /^import /m, "what reads an assembly still imports nothing");
});
