/* On / Off and copies outside the Simulation : the parts of an assembly put aside, the operations of a part switched and copied,
   the other values a parameter keeps beside the one that counts. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { liveAsm, offOf, instOff, setInstOff } from "../../web/js/core/asm_live.js";
import { featureOff, withFeatureOff, copyFeature, paramAlts, canKeepAlts, addAlt, swapAlt, setAlt, dropAlt, keptAside } from "../../web/js/core/variants.js";
import { assemblyOrder } from "../../web/js/core/asm_plan.js";
import { assemblyIssues } from "../../web/js/core/guide_checks.js";
import { resolveParams } from "../../web/js/cad/expr.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const asm = () => ({ id: "ASM", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "COVER" }, { id: "i3", part: "PCB" }],
  mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "i2", iface: "IF1" } }, { id: "M2", a: { inst: "i1", iface: "IF2" }, b: { inst: "i3", iface: "IF1" } }] });

test("assembly : a part put aside leaves the assembly that counts, with the joints that hold to it", () => {
  const a = asm(); assert.equal(liveAsm(a), a, "nothing off : the same assembly, untouched");
  a.instances[1].off = true; const live = liveAsm(a);
  assert.deepEqual(live.instances.map((i) => i.id), ["i1", "i3"]); assert.deepEqual(live.mates.map((m) => m.id), ["M2"]);
  assert.equal(a.instances.length, 3, "the assembly itself keeps the part"); assert.equal(a.mates.length, 2, "and its joint, for its return");
  assert.deepEqual(offOf(a), { instances: ["i2"], mates: ["M1"] }); assert.equal(instOff(a.instances[1]), true); assert.equal(instOff(a.instances[0]), false);
  assert.equal(live.id, "ASM", "everything else of the assembly is kept");
  assert.deepEqual(liveAsm({}), {}); assert.equal(liveAsm(null), null);
});

test("assembly : off and on again by its switch ; the routing and the guide take only what is on", () => {
  const a = asm(); assert.equal(setInstOff(a, "i3", true), true); assert.equal(a.instances[2].off, true);
  assert.deepEqual(assemblyOrder(a, new Map()), ["i1", "i2"], "the part put aside is not in the assembly sequence");
  const parts = new Map([["BASE", { id: "BASE", interfaces: [{ id: "IF1" }, { id: "IF2" }] }], ["COVER", { id: "COVER", interfaces: [{ id: "IF1" }] }], ["PCB", { id: "PCB", interfaces: [{ id: "IF1" }] }]]);
  const said = assemblyIssues(a, parts); assert.ok(said.some((x) => x.level === "tip" && /1 pièce à Off, 1 accouplement en attente/.test(x.text)), "the guide says what is put aside");
  assert.ok(!said.some((x) => /M2/.test(x.text)), "a joint that waits for its part is not a broken joint");
  setInstOff(a, "i3", false); assert.equal("off" in a.instances[2], false); assert.deepEqual(assemblyOrder(a, new Map()).length, 3);
  assert.equal(setInstOff(a, "nope", true), false);
  for (const i of a.instances) i.off = true; assert.ok(assemblyIssues(a, parts).some((x) => /toutes les pièces sont à Off/.test(x.text)));
});

test("part : an operation is put aside or copied, the copy born off under its own id", () => {
  const feats = [{ op: "box", id: "body" }, { op: "hole", id: "h1", name: "Trou M4", d: 4.5 }];
  const off = withFeatureOff(feats[1], true); assert.equal(featureOff(off), true); assert.equal(featureOff(feats[1]), false, "the operation given is not changed");
  assert.deepEqual(withFeatureOff(off, false), feats[1]);
  const list = copyFeature(feats, 1, "f3");
  assert.deepEqual(list.map((f) => [f.id, !!f.suppressed]), [["body", false], ["h1", false], ["f3", true]]);
  assert.equal(list[2].name, "Trou M4 (copie)"); assert.equal(list[2].d, 4.5); list[2].d = 6; assert.equal(feats[1].d, 4.5, "the copy shares nothing with the first");
  assert.equal(feats.length, 2); assert.deepEqual(copyFeature(feats, 9, "x"), feats);
});

test("part : a parameter keeps other values beside the one that counts, and one of them is turned on in its place", () => {
  const L = { value: 160, min: 120, max: 260, unit: "mm" };
  const kept = addAlt(L); assert.deepEqual(paramAlts(kept), [160]); assert.equal(L.alts, undefined, "the definition given is not changed");
  const changed = setAlt(kept, 0, 200), on = swapAlt(changed, 0);
  assert.equal(on.value, 200); assert.deepEqual(on.alts, [160], "the value that counted is kept in its stead"); assert.equal(on.min, 120);
  assert.deepEqual(swapAlt(on, 0), changed, "and back");
  assert.deepEqual(dropAlt(kept, 0), L, "removed, the parameter is as it was");
  /* a plain number */
  const n = addAlt(42, 50); assert.deepEqual(n, { value: 42, alts: [50] }); assert.equal(dropAlt(n, 0), 42);
  assert.equal(swapAlt(n, 3), n); assert.equal(setAlt(n, -1, 0), n);
  assert.equal(canKeepAlts({ expr: "L / 2" }), false); assert.equal(canKeepAlts(12), true);
  /* the part language ignores what is kept beside : only the value that counts is resolved */
  assert.equal(resolveParams({ L: on, half: { expr: "L / 2" } }).scope.half, 100);
  assert.deepEqual(keptAside({ features: [{ op: "box" }, { op: "hole", suppressed: true }], params: { L: on, W: 110 } }), { features: 1, values: 1 });
});

test("wiring : every reader of an assembly goes through what counts ; the trees carry the same switch", () => {
  assert.match(read("web/js/core/asm_scene.js"), /asm = liveAsm\(asm\);/, "what is built, placed, weighed, listed and sent out");
  assert.match(read("web/js/core/asm_plan.js"), /asm = liveAsm\(asm\);/); assert.match(read("web/js/analysis/dfa_rules.js"), /asm = liveAsm\(asm \|\| \{\}\);/);
  assert.match(read("web/js/core/render_looks.js"), /asm = liveAsm\(asm\);/); assert.match(read("web/js/draw/asm_drawing.js"), /liveAsm\(asm\)\.instances\.length/);
  const screen = read("web/js/modules/assembly.js"); assert.match(screen, /onOff\(!inst\.off/); assert.match(screen, /Cette pièce est à Off/);
  const studio = read("web/js/modules/part_studio.js"); assert.match(studio, /onOff\(!f\.suppressed/); assert.match(studio, /copyFeature\(x\.features, i, nextFeatureId\(x\)\)/);
  assert.match(read("web/js/modules/part_panels.js"), /swapAlt\(s\.params\[name\], k\)/);
  assert.match(read("web/js/draw/dim_model.js"), /if \(!f \|\| f\.suppressed\) continue;/, "an operation put aside is not dimensioned");
  assert.doesNotMatch(read("web/js/core/asm_live.js"), /^import /m, "the helper every tool takes has no import of its own");
});
