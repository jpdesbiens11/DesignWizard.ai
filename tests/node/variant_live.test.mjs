/* The variant in use is alive (demande de JP, sur une capture de l'écran Pièces : « où sont les features modifiables d'une variante de
   pièce mécanique et comment les voir comme la pièce originale ? c'est pas clair ou pas encore possible »). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORIGIN, newVariant, useVariant, followVariant, variantNow, variantOf, keepVariant, dropVariant, isVariant } from "../../web/js/core/variants.js";
import { ASM_ORIGIN, newAsmVariant, followAsmVariant, asmVariantNow, applyAsmVariant, keepAsmVariant } from "../../web/js/core/asm_live.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const wheel = () => ({ id: "W", params: { D: { value: 120, label: "Diamètre" }, w: 40, half: { expr: "D / 2" } }, features: [{ op: "cylinder", id: "hub" }, { op: "cylinder", id: "rim" }, { op: "cylinder", id: "tyre" }, { op: "interfaces" }, { op: "hole", id: "bore" }] });
const add = (p, name) => Object.assign(p, newVariant(p, name));
const go = (p, name) => Object.assign(p, useVariant(p, p.variants.find((v) => v.name === name)));

test("the first variant keeps the original : there is always a part to come back to", () => {
  const p = wheel(); assert.equal(newVariant(p, "   "), null, "a name is needed");
  add(p, "Sans pneu"); assert.deepEqual(p.variants.map((v) => v.name), [ORIGIN, "Sans pneu"]); assert.equal(p.variantOn, "Sans pneu"); assert.equal(variantNow(p), "Sans pneu", "two variants that are the same are told apart by the one in use");
  assert.deepEqual(p.variants[0], { name: "Origine", off: [], params: { D: 120, w: 40 } });
  add(p, "Large"); assert.deepEqual(p.variants.map((v) => v.name), [ORIGIN, "Sans pneu", "Large"], "the original is kept once"); assert.equal(p.variantOn, "Large");
  const q = wheel(); add(q, ORIGIN); assert.deepEqual(q.variants.map((v) => v.name), [ORIGIN], "naming the first one « Origine » does not make two");
});

test("what one changes in the tree belongs to the variant in use ; the others stay as one left them", () => {
  const p = wheel(); add(p, "Sans pneu");
  p.features[2].suppressed = true; p.params.D.value = 100; assert.equal(followVariant(p), true);
  assert.deepEqual(p.variants[1], { name: "Sans pneu", off: ["tyre"], params: { D: 100, w: 40 } }); assert.deepEqual(p.variants[0], { name: ORIGIN, off: [], params: { D: 120, w: 40 } }, "the original did not move");
  assert.equal(variantNow(p), "Sans pneu", "the part never falls into a state without a name"); assert.equal(followVariant(p), false, "nothing more to write");
  /* back to the original : its tree and its values come back, and it is the one in use */
  go(p, ORIGIN); assert.equal(p.variantOn, ORIGIN); assert.equal(p.features[2].suppressed, undefined); assert.equal(p.params.D.value, 120); assert.equal(followVariant(p), false);
  p.params.w = 44; followVariant(p); assert.equal(p.variants[0].params.w, 44); assert.equal(p.variants[1].params.w, 40, "a value changed in the original is the original's");
  go(p, "Sans pneu"); assert.equal(p.features[2].suppressed, true); assert.equal(p.params.D.value, 100); assert.equal(p.params.w, 40);
  /* what the fields of an operation are is the same for every variant : only on / off and the parameters differ */
  p.features[1] = { op: "cylinder", id: "rim", d: "D - 10" }; followVariant(p); go(p, ORIGIN); assert.equal(p.features[1].d, "D - 10", "the fields of an operation are the same in every variant : a dimension that must differ is written with a parameter");
  /* an operation or a parameter added later is known of the one in use, and stays as it is in the others */
  p.features.push({ op: "fillet", id: "r1" }); p.params.T = 3; followVariant(p); assert.equal(p.variants[0].params.T, 3); assert.equal(isVariant(p, p.variants[1]), false); go(p, "Sans pneu"); assert.equal(p.params.T, 3);
});

test("a part kept before variants were alive takes the variant its state is ; a name removed is no longer in use", () => {
  const p = wheel(); p.variants = keepVariant(p, "Variante 1"); assert.equal(p.variantOn, undefined);
  assert.equal(followVariant(p), true, "opened : the state is « Variante 1 », which becomes the one in use"); assert.equal(p.variantOn, "Variante 1");
  p.features[0].suppressed = true; followVariant(p); assert.deepEqual(p.variants[0].off, ["hub"]); assert.equal(variantNow(p), "Variante 1");
  const lost = wheel(); lost.variants = [{ name: "Autre", off: ["rim"], params: {} }]; assert.equal(followVariant(lost), false); assert.equal(variantNow(lost), null, "a state no variant is : said as such, nothing is invented");
  p.variants = dropVariant(p, "Variante 1"); delete p.variants; assert.equal(followVariant(p), true); assert.equal(p.variantOn, undefined, "no variant left : nothing is in use");
  const none = wheel(); assert.equal(followVariant(none), false); assert.deepEqual(none, wheel(), "a part without variants is not touched");
  /* it goes through .dwiz */
  const w = wheel(); add(w, "Large"); w.params.w = 60; followVariant(w); const back = fromDwiz(toDwiz(w)); assert.equal(back.variantOn, "Large"); assert.deepEqual(back.variants, w.variants); assert.deepEqual(variantOf(back), variantOf(w));
});

test("an assembly : the same — the parts put on or off belong to the variant in use", () => {
  const a = { id: "A", instances: [{ id: "i1", part: "P1" }, { id: "i2", part: "P2" }, { id: "i3", part: "P3" }] };
  Object.assign(a, newAsmVariant(a, "Sans capot")); assert.deepEqual(a.variants.map((v) => v.name), [ASM_ORIGIN, "Sans capot"]); assert.equal(asmVariantNow(a), "Sans capot");
  a.instances[2].off = true; assert.equal(followAsmVariant(a), true); assert.deepEqual(a.variants[1].off, ["i3"]); assert.deepEqual(a.variants[0].off, []); assert.equal(followAsmVariant(a), false);
  applyAsmVariant(a, a.variants[0]); a.variantOn = ASM_ORIGIN; assert.equal(a.instances[2].off, undefined); assert.equal(asmVariantNow(a), ASM_ORIGIN); assert.equal(followAsmVariant(a), false);
  const old = { id: "B", instances: [{ id: "i1", part: "P1", off: true }] }; old.variants = keepAsmVariant(old, "V1"); assert.equal(followAsmVariant(old), true); assert.equal(old.variantOn, "V1");
  assert.equal(newAsmVariant(a, ""), null); assert.doesNotMatch(read("web/js/core/asm_live.js"), /^import /m);
});

test("wiring : the tree says whose it is, the store keeps the variant in step, and what is new is marked", () => {
  const main = read("web/js/main.js"), st = read("web/js/core/store.js"), v = read("web/js/modules/part_variants.js"), ps = read("web/js/modules/part_studio.js"), pp = read("web/js/modules/part_panels.js"), as = read("web/js/modules/assembly.js");
  assert.match(main, /store\.hooks\.push\(followAll\); store\.loaders\.push\(followAll\);/, "after every change, and when a project is opened"); assert.match(st, /for \(const f of this\.loaders \|\| \[\]\) f\(p\);/);
  assert.match(ps, /variantChip\(variantNow\(st\.spec\)\)/, "the title of the tree carries the variant in use"); assert.match(pp, /data-variant-params/, "and so do the parameters"); assert.match(as, /variantChip\(asmVariantNow\(a\), "La liste"\)/);
  assert.match(ps, /valent pour TOUTES les variantes/, "the editor of an operation says what a variant does not hold");
  assert.doesNotMatch(v, /Mettre à jour la variante/, "no button to update a variant : the one in use follows by itself"); assert.match(v, /x\.variantOn = r\.variantOn/); assert.match(v, /dataset\.variantAdd/);
  assert.ok(NEWS.some((n) => n.id === "variant-live" && n.v === "0.120.0" && n.sel === "[data-variant-on]" && n.where === "#/parts"));
});
