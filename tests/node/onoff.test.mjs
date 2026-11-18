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
  assert.match(read("web/js/core/asm_scene.js"), /opened = flatAsm\(asm, find\);/, "what is built, placed, weighed, listed and sent out"); assert.match(read("web/js/core/asm_levels.js"), /const live = liveAsm\(asm\);/, "opened through its levels, and still without what is put aside");
  assert.match(read("web/js/core/asm_plan.js"), /asm = liveAsm\(asm\);/); assert.match(read("web/js/analysis/dfa_rules.js"), /asm = liveAsm\(asm \|\| \{\}\);/);
  assert.match(read("web/js/core/render_looks.js"), /asm = liveAsm\(asm\);/); assert.match(read("web/js/draw/asm_drawing.js"), /liveAsm\(asm\)\.instances\.length/);
  const screen = read("web/js/modules/assembly.js"); assert.match(screen, /onOff\(!inst\.off/); assert.match(screen, /Cette pièce est à Off/);
  const studio = read("web/js/modules/part_studio.js"); assert.match(studio, /onOff\(!f\.suppressed/); assert.match(studio, /copyFeature\(x\.features, i, nextFeatureId\(x\)\)/);
  assert.match(read("web/js/modules/part_panels.js"), /swapAlt\(s\.params\[name\], k\)/);
  assert.match(read("web/js/draw/dim_model.js"), /if \(!f \|\| f\.suppressed\) continue;/, "an operation put aside is not dimensioned");
  assert.doesNotMatch(read("web/js/core/asm_live.js"), /^import /m, "the helper every tool takes has no import of its own");
});

/* ---------- named variants of a part, and the planes of the Simulation ---------- */
import { variantOf, isVariant, variantNow, applyVariant, keepVariant, dropVariant, variantDiff } from "../../web/js/core/variants.js";
import { liveCuts, cutOn, caseWords as caseSaid, bcTree as treeOf } from "../../web/js/analysis/fea/bc_tree.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const cousin = () => ({ id: "P", params: { L: { value: 160, min: 120, max: 260, label: "Longueur", alts: [140] }, W: 110, half: { expr: "L / 2" } },
  features: [{ op: "box", id: "body" }, { op: "hole", id: "h1" }, { op: "pocket", id: "win", suppressed: true }, { op: "interfaces" }] });

test("variant : what tells one cousin from the other is kept under a name, and found again", () => {
  const p = cousin(); assert.deepEqual(variantOf(p), { off: ["win"], params: { L: 160, W: 110 } }, "a calculated parameter has nothing of its own to remember");
  p.variants = keepVariant(p, "  Fermée "); assert.deepEqual(p.variants, [{ name: "Fermée", off: ["win"], params: { L: 160, W: 110 } }]);
  assert.equal(variantNow(p), "Fermée"); assert.equal(isVariant(p, p.variants[0]), true);
  p.params.L.value = 200; assert.equal(variantNow(p), null, "a value changed : a cousin without a name");
  p.variants = keepVariant(p, "Longue"); p.variants = keepVariant(p, "Longue"); assert.equal(p.variants.length, 2, "the same name is replaced, not added twice");
  assert.deepEqual(keepVariant(p, "   "), p.variants, "a name is needed");
  assert.deepEqual(dropVariant(p, "Fermée").map((v) => v.name), ["Longue"]);
});

test("variant : a click brings the whole cousin back, and nothing else moves", () => {
  const p = cousin(); p.variants = keepVariant(p, "Fermée");
  p.features[2] = { op: "pocket", id: "win" }; p.features[1].suppressed = true; p.params.L.value = 200; p.params.W = 90;
  assert.deepEqual(variantDiff(p, p.variants[0], { L: "Longueur" }), ["2 opérations basculent", "Longueur 200 → 160", "W 90 → 110"]);
  const r = applyVariant(p, p.variants[0]);
  assert.deepEqual(r.features.map((f) => !!f.suppressed), [false, false, true, false], "operations on and off as the variant says ; the interfaces are never put aside");
  assert.equal(r.params.L.value, 160); assert.deepEqual(r.params.L.alts, [140], "the values kept beside a parameter stay"); assert.equal(r.params.L.min, 120); assert.equal(r.params.W, 110);
  assert.deepEqual(r.params.half, { expr: "L / 2" }); assert.equal(p.params.L.value, 200, "the part given is not changed");
  assert.equal(isVariant({ ...p, ...r }, p.variants[0]), true); assert.deepEqual(variantDiff({ ...p, ...r }, p.variants[0]), []);
});

test("variant : what was added to the part since belongs to every variant", () => {
  const p = cousin(); p.variants = keepVariant(p, "Fermée");
  p.features.push({ op: "fillet", id: "r1" }); p.params.T = 3;
  assert.equal(isVariant(p, p.variants[0]), true, "a new operation that is on, a new parameter : still the same cousin");
  const gone = { ...p, features: p.features.filter((f) => f.id !== "win") }; assert.equal(isVariant(gone, { name: "x", off: [], params: {} }), true, "an operation that no longer exists does not count");
  const r = applyVariant(p, p.variants[0]); assert.equal(r.params.T, 3); assert.equal(r.features[4].suppressed, undefined);
});

test("variant : a part with its variants, its kept values and its operations put aside goes through .dwiz without loss", () => {
  const base = JSON.parse(JSON.stringify(DEMO_DRIVE.parts.find((x) => Array.isArray(x.features) && x.features.length > 2 && x.params)));
  const name = Object.keys(base.params).find((k) => base.params[k] && typeof base.params[k] === "object" && typeof base.params[k].value === "number");
  base.params[name] = { ...base.params[name], alts: [base.params[name].value + 5] }; base.features[base.features.length - 1].suppressed = true; base.variants = keepVariant(base, "Sans la dernière opération");
  assert.deepEqual(fromDwiz(toDwiz(base)), base);
});

test("simulation : a plane put aside cuts nothing ; one plane per axis counts", () => {
  const cuts = [{ axis: 1, at: 55, keep: 1, bc: "sym" }, { axis: 1, at: 75, keep: 1, bc: "free", off: true }, { axis: 0, at: 80, keep: 1, bc: "free" }];
  assert.deepEqual(liveCuts(cuts).map((c) => c.at), [55, 80]);
  const next = cutOn(cuts, 1, true); assert.deepEqual(next.map((c) => !!c.off), [true, false, false], "turned on, it takes the place of the plane of its axis");
  assert.equal(cuts[0].off, undefined, "the list given is not changed");
  assert.deepEqual(cutOn(cuts, 1, true, true).map((c) => !!c.off), [true, false, true], "alone : every other plane goes off");
  assert.deepEqual(cutOn(cuts, 2, false).map((c) => !!c.off), [false, true, true]);
  assert.equal(cutOn(cuts, 9, true), cuts);
  /* the tree shows a symmetry only while its plane is on ; a trial names its free cuts */
  const st = { kind: "structure", fixed: ["face:-X"], loads: [{ region: "face:+X", mode: "force", F: 100, dir: "-Z" }], power: [], fixedT: [], cuts };
  assert.ok(treeOf(st).find((g) => g.key === "fixed").items.some((it) => it.id === "S1"));
  assert.ok(!treeOf({ ...st, cuts: next }).find((g) => g.key === "fixed").items.some((it) => it.kind === "symmetry"), "its plane off, the symmetry is no longer a boundary");
  const said = caseSaid(treeOf({ ...st, cuts: next }), [], liveCuts(next)); assert.equal(said.ids, "A1 E1 CY CX"); assert.match(said.text, /CY coupe Y = 75 mm · CX coupe X = 80 mm/);
});

/* ---------- the menu of a part of an assembly : one part shown alone, all of them back ---------- */
import { shownOf, isAlone, showAlone, showEvery, instanceMenu } from "../../web/js/core/asm_live.js";

test("assembly : one part shown alone, the others hidden — not off — and all of them back", () => {
  const a = asm(); showAlone(a, "i2");
  assert.deepEqual(a.instances.map((i) => !!i.hidden), [true, false, true]); assert.equal(isAlone(a, "i2"), true); assert.equal(isAlone(a, "i1"), false);
  assert.equal(liveAsm(a), a, "hidden parts still count : nothing is off"); assert.deepEqual(shownOf(a).map((i) => i.id), ["i2"]);
  showEvery(a); assert.ok(a.instances.every((i) => !("hidden" in i))); assert.equal(isAlone(a, "i2"), false);
  a.instances[0].off = true; a.instances[2].off = true; assert.equal(isAlone(a, "i2"), true, "alone too when the others are off");
});

test("assembly : the menu of a part follows its state, the same on its line and in the view", () => {
  const acts = (a, id) => instanceMenu(a, id, "Couvercle").filter((x) => x && x.act).map((x) => x.act), a = asm();
  assert.deepEqual(acts(a, "i2"), ["open", "alone", "hide", "off", "fix", "remove"]);
  assert.equal(instanceMenu(a, "i2", "Couvercle")[0].title, "Couvercle · i2");
  assert.deepEqual(acts(a, "i1"), ["open", "alone", "hide", "off", "free", "remove"], "the fixed part is offered to be freed");
  showAlone(a, "i2");
  assert.deepEqual(acts(a, "i2"), ["open", "all", "hide", "off", "fix", "remove"], "shown alone : it offers to bring the others back, not to be shown alone again");
  assert.match(instanceMenu(a, "i2").find((x) => x.act === "all").label, /Montrer toutes les pièces \(2 masquées\)/);
  assert.deepEqual(acts(a, "i3"), ["open", "alone", "all", "show", "off", "fix", "remove"], "a hidden part : show it, alone or with the others");
  showEvery(a); a.instances[1].off = true;
  assert.deepEqual(acts(a, "i2"), ["open", "on", "remove"], "a part that is off : turn it on, open it, remove it");
  assert.deepEqual(instanceMenu(a, "nope"), []);
  const one = { instances: [{ id: "i1", part: "BASE" }] }; assert.ok(!acts(one, "i1").includes("alone"), "a single part has nothing to be alone among");
  assert.match(read("web/js/modules/assembly.js"), /onContextmenu: \(e\) => \{ e\.preventDefault\(\);/); assert.match(read("web/js/modules/assembly.js"), /instanceMenu\(asm\(\), iid,/);
});
