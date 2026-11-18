/* Forming a sub-assembly from parts already placed, and dissolving one back (core/asm_form.js) : nothing moves, the joints go to
   the right level, and what names an instance of the parent follows. */
import test from "node:test";
import assert from "node:assert/strict";
import { placementOf, freshInstance, looseIn, formPlan, formSub, dissolveSub } from "../../web/js/core/asm_form.js";
import { flatAsm, partCounts, bomLevels } from "../../web/js/core/asm_levels.js";
import { solveLevels, placedTree } from "../../web/js/core/assembly_logic.js";
import { matFromPlacement, matPoint } from "../../web/js/cad/vec.js";

const up = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "A", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] } });
const down = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "B", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] } });
const part = (interfaces, mass = 10) => ({ interfaces, bodies: [], bbox: [0, 0, 0, 10, 10, 5], mass, cog: [5, 5, 2.5] });
/* a base with two seats ; a plate on the first seat carries a board and a cap ; a foot on the second seat ; a loose part put by hand */
const built = { BASE: part([up("IF1", 0, 0, 10, "k1"), up("IF2", 50, 0, 10, "k2")], 100), PLATE: part([down("IF1", 0, 0, 0, "k1"), up("IF3", 2, 0, 5, "k3"), up("IF4", 6, 0, 5, "k4")]),
  BOARD: part([down("IF3", 0, 0, 0, "k3")], 4), CAP: part([down("IF4", 0, 0, 0, "k4")], 3), FOOT: part([down("IF2", 0, 0, 0, "k2")], 6), LOOSE: part([], 1) };
const project = () => ({ name: "Essai", parts: Object.keys(built).map((id) => ({ id, name: id })), talk: [{ id: "m1", on: "assembly:TOP", text: "ici", pin: { at: [1, 2, 3], inst: "board" } }, { id: "m2", on: "assembly:TOP", text: "là", pin: { at: [0, 0, 0], inst: "base" } }],
  assemblies: [{ dw: "assembly/1", id: "TOP", name: "Produit", instances: [{ id: "base", part: "BASE", fixed: true }, { id: "plate", part: "PLATE" }, { id: "board", part: "BOARD" }, { id: "cap", part: "CAP", hidden: true }, { id: "foot", part: "FOOT" }, { id: "loose", part: "LOOSE", placement: { t: [7, 8, 9], r: [0, 0, 30] } }],
    mates: [{ id: "M1", a: { inst: "base", iface: "IF1" }, b: { inst: "plate", iface: "IF1" } }, { id: "M2", a: { inst: "plate", iface: "IF3" }, b: { inst: "board", iface: "IF3" } }, { id: "M3", a: { inst: "plate", iface: "IF4" }, b: { inst: "cap", iface: "IF4" } }, { id: "M4", a: { inst: "base", iface: "IF2" }, b: { inst: "foot", iface: "IF2" } }],
    plan: { order: ["base", "foot", "plate", "board", "cap", "loose"] }, labels: [{ id: "E1", inst: "cap" }, { id: "E2", inst: "base" }, { id: "E3", inst: null }], variants: [{ name: "Sans carte", off: ["board", "foot"] }, { name: "Nu", off: ["loose"] }] }] });
const finder = (p) => (id) => p.assemblies.find((a) => a.id === id) || null;
/* where every part is, by the part and the order it comes in — the ids of the instances change, the places must not */
const places = (p, id = "TOP") => { const { asm, sol } = solveLevels(finder(p)(id), built, finder(p)); return asm.instances.map((i) => `${i.part} ${matPoint(sol.placements[i.id], [1, 2, 3]).map((x) => x.toFixed(4)).join(" ")}`).sort(); };

test("a matrix as a placement : the way back from matFromPlacement, the awkward angles included", () => {
  for (const pl of [{ t: [0, 0, 0], r: [0, 0, 0] }, { t: [12.5, -3, 40], r: [10, 20, 30] }, { t: [1, 2, 3], r: [-170, 45, 179] }, { t: [0, 0, 0], r: [0, 0, 90] }, { t: [5, 5, 5], r: [35, 90, 0] }, { t: [5, 5, 5], r: [35, -90, 20] }, { t: [0, 0, 0], r: [180, 0, 0] }]) {
    const M = matFromPlacement(pl), back = matFromPlacement(placementOf(M)); for (const q of [[1, 0, 0], [0, 1, 0], [3, -2, 7]]) matPoint(M, q).forEach((x, k) => assert.ok(Math.abs(x - matPoint(back, q)[k]) < 1e-6, `${JSON.stringify(pl)} → ${JSON.stringify(placementOf(M))}`)); }
  assert.deepEqual(placementOf(matFromPlacement({ t: [1, 2, 3], r: [0, 0, 30] })), { t: [1, 2, 3], r: [0, 0, 30] }, "written as it was typed"); assert.ok(Object.is(placementOf(matFromPlacement({})).r[0], 0), "no minus zero in the file");
});

test("what forming would do, said before it is done", () => {
  const p = project(), top = p.assemblies[0];
  assert.deepEqual(formPlan(top, ["cap", "plate", "board"]), { ids: ["plate", "board", "cap"], inner: ["M2", "M3"], across: ["M1"], loose: [], variants: ["Sans carte"], ground: false }, "in the order of the assembly, whatever the order of the clicks");
  assert.deepEqual(formPlan(top, ["base", "foot"]).ground, true, "the ground of the parent is among them"); assert.deepEqual(formPlan(top, ["board", "cap"]).loose, ["cap"], "nothing ties the board to the cap : the plate, which did, stays outside");
  assert.deepEqual(looseIn(top, ["plate", "board", "cap", "loose"]), ["loose"]); assert.deepEqual(looseIn(top, ["plate"]), []); assert.deepEqual(formPlan(top, ["nope"]).ids, []);
  assert.equal(freshInstance(top), "s1"); assert.equal(freshInstance({ instances: [{ id: "s1" }, { id: "s2" }] }), "s3"); assert.equal(freshInstance(top, "i"), "i1");
});

test("forming : the parts chosen become one instance, the joints go to their level, nothing moves", () => {
  const p = project(), before = places(p), top = p.assemblies[0], sol = solveLevels(top, built, finder(p)).sol;
  const r = formSub(p, "TOP", ["plate", "board", "cap"], { id: "MOD", name: "Module", placements: sol.placements });
  assert.deepEqual([r.inst, r.sub.id, r.inner, r.across], ["s1", "MOD", ["M2", "M3"], ["M1"]]); assert.equal(p.assemblies.length, 2);
  assert.deepEqual(top.instances.map((i) => i.id), ["base", "s1", "foot", "loose"], "the block takes the place of the first part chosen"); assert.deepEqual(top.instances[1], { id: "s1", asm: "MOD", placement: { t: [0, 0, 0], r: [0, 0, 0] } });
  assert.deepEqual(top.mates.map((m) => [m.id, m.a.inst, m.b.inst]), [["M1", "base", "s1~plate"], ["M4", "base", "foot"]], "the joint to the rest names its part by its path");
  assert.deepEqual(r.sub.mates.map((m) => [m.id, m.a.inst, m.b.inst]), [["M2", "plate", "board"], ["M3", "plate", "cap"]]); assert.deepEqual(r.sub.instances.map((i) => [i.id, !!i.fixed, !!i.hidden]), [["plate", true, false], ["board", false, false], ["cap", false, true]], "it has its ground ; what was hidden stays hidden");
  assert.deepEqual(places(p), before, "every part exactly where it was"); assert.deepEqual([...partCounts(top, finder(p))].sort(), [["BASE", 1], ["BOARD", 1], ["CAP", 1], ["FOOT", 1], ["LOOSE", 1], ["PLATE", 1]]);
  /* what named the instances follows */
  assert.deepEqual(top.plan.order, ["base", "foot", "s1", "loose"]); assert.deepEqual(r.sub.plan.order, ["plate", "board", "cap"]);
  assert.deepEqual(top.labels.map((l) => l.inst), ["s1~cap", "base", null]); assert.deepEqual(p.talk.map((m) => m.pin.inst), ["s1~board", "base"]);
  assert.deepEqual(top.variants, [{ name: "Sans carte", off: ["foot"] }, { name: "Nu", off: ["loose"] }], "a variant lets go of the part that went inside"); assert.deepEqual(r.variants, ["Sans carte"], "… and the caller is told which");
  assert.deepEqual(bomLevels(top, finder(p)).map((x) => `${x.level} ${x.kind} ${x.id}`), ["0 part BASE", "0 assembly MOD", "1 part PLATE", "1 part BOARD", "1 part CAP", "0 part FOOT", "0 part LOOSE"]);
  /* refusals */
  assert.throws(() => formSub(p, "TOP", [], { id: "X" }), /au moins une pièce/); assert.throws(() => formSub(p, "TOP", ["foot"], { id: "MOD" }), /porte déjà le numéro/); assert.throws(() => formSub(p, "TOP", ["foot"], {}), /demande un numéro/); assert.throws(() => formSub(p, "NOPE", ["foot"], { id: "X" }), /introuvable/);
});

test("forming with the ground, with a part no joint holds, and a block inside a block", () => {
  const p = project(), before = places(p), top = p.assemblies[0];
  /* the base and its foot : the block is the ground of the parent ; the loose part goes in too and keeps the place it was put at */
  let r = formSub(p, "TOP", ["base", "foot", "loose"], { id: "SOCLE", placements: solveLevels(top, built, finder(p)).sol.placements });
  assert.deepEqual(top.instances[0], { id: "s1", asm: "SOCLE", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }); assert.deepEqual(r.loose, ["loose"]); assert.deepEqual(r.sub.instances.find((i) => i.id === "loose").placement, { t: [7, 8, 9], r: [0, 0, 30] });
  assert.deepEqual(top.mates.find((m) => m.id === "M1").a.inst, "s1~base"); assert.deepEqual(places(p), before);
  /* then the plate and its board : a second block, held to the first by a joint between two sub-assemblies */
  r = formSub(p, "TOP", ["plate", "board"], { id: "PLATEAU", placements: solveLevels(top, built, finder(p)).sol.placements }); assert.equal(r.inst, "s2");
  assert.deepEqual(top.mates.map((m) => [m.id, m.a.inst, m.b.inst]), [["M1", "s1~base", "s2~plate"], ["M3", "s2~plate", "cap"]]); assert.deepEqual(places(p), before, "a joint from a block to a block holds");
  /* and the two blocks, with the cap, into one : sub-assemblies inside a sub-assembly, the paths one level longer */
  r = formSub(p, "TOP", ["s1", "s2", "cap"], { id: "TOUT", placements: solveLevels(top, built, finder(p)).sol.placements });
  assert.deepEqual(top.instances.map((i) => [i.id, i.asm, !!i.fixed]), [["s3", "TOUT", true]]); assert.deepEqual(top.mates, []); assert.deepEqual(r.sub.mates.map((m) => [m.a.inst, m.b.inst]), [["s1~base", "s2~plate"], ["s2~plate", "cap"]]);
  assert.deepEqual(places(p), before, "three levels deep, every part exactly where it was"); assert.deepEqual(flatAsm(top, finder(p)).instances.map((i) => i.id).sort(), ["s3~cap", "s3~s1~base", "s3~s1~foot", "s3~s1~loose", "s3~s2~board", "s3~s2~plate"]);
});

test("dissolving : the reverse — what it holds comes up, its joints with it, nothing moves", () => {
  const p = project(), before = places(p), top = p.assemblies[0], shape = () => JSON.stringify([top.instances.map((i) => [i.id, i.part, !!i.fixed, !!i.hidden]), top.mates.map((m) => [m.id, m.a.inst, m.b.inst]).sort(), top.plan.order, top.labels.map((l) => l.inst), p.talk.map((m) => m.pin.inst)]), was = shape();
  formSub(p, "TOP", ["plate", "board", "cap"], { id: "MOD", placements: solveLevels(top, built, finder(p)).sol.placements }); top.variants[1].off.push("s1");
  const node = placedTree(top, built, finder(p)).find((n) => n.inst === "s1"), r = dissolveSub(p, "TOP", "s1", { tree: node });
  assert.deepEqual(r, { added: ["plate", "board", "cap"], mates: 2, asm: "MOD" }); assert.deepEqual(places(p), before);
  assert.deepEqual(JSON.parse(shape())[0].map((x) => x[0]), ["base", "plate", "board", "cap", "foot", "loose"], "in the place of the block, in its order"); assert.deepEqual(JSON.parse(shape()).slice(1), JSON.parse(was).slice(1), "joints, order, labels and pins as they were before forming");
  assert.ok(!top.instances.find((i) => i.id === "plate").fixed, "the ground of the sub-assembly is not a ground here : the joint to the base holds it again");
  assert.deepEqual(top.variants[1].off, ["loose", "plate", "board", "cap"], "a variant that put the block aside puts aside what it held"); assert.equal(p.assemblies.length, 2, "the sub-assembly stays in the project");
  /* placed twice : the second copy takes ids of its own, joints included */
  const q = project(), t2 = q.assemblies[0]; formSub(q, "TOP", ["plate", "board", "cap"], { id: "MOD" }); t2.instances.push({ id: "s2", asm: "MOD", placement: { t: [200, 0, 0], r: [0, 0, 0] } });
  const two = places(q); dissolveSub(q, "TOP", "s1", { tree: placedTree(t2, built, finder(q)).find((n) => n.inst === "s1") }); dissolveSub(q, "TOP", "s2", { tree: placedTree(t2, built, finder(q)).find((n) => n.inst === "s2") });
  assert.deepEqual(t2.instances.map((i) => i.id), ["base", "plate", "board", "cap", "foot", "loose", "s2_plate", "s2_board", "s2_cap"]); assert.deepEqual(t2.mates.map((m) => m.id), ["M1", "M4", "M2", "M3", "s2_M2", "s2_M3"]);
  assert.deepEqual(places(q), two, "the second copy, which no joint held, stays 200 mm away : its places were written");
  /* through a level : a block inside the block comes up as a block */
  const d = project(), t3 = d.assemblies[0]; formSub(d, "TOP", ["plate", "board"], { id: "IN" }); formSub(d, "TOP", ["s1", "cap"], { id: "OUT" }); const deep = places(d);
  dissolveSub(d, "TOP", "s2", { tree: placedTree(t3, built, finder(d)).find((n) => n.inst === "s2") });
  assert.deepEqual(t3.instances.map((i) => [i.id, i.asm || i.part]), [["base", "BASE"], ["s1", "IN"], ["cap", "CAP"], ["foot", "FOOT"], ["loose", "LOOSE"]]); assert.deepEqual(t3.mates.map((m) => [m.id, m.a.inst, m.b.inst]).sort(), [["M1", "base", "s1~plate"], ["M3", "s1~plate", "cap"], ["M4", "base", "foot"]]); assert.deepEqual(places(d), deep);
  assert.throws(() => dissolveSub(d, "TOP", "base"), /n'est pas un sous-assemblage/); d.assemblies = d.assemblies.filter((a) => a.id !== "IN"); assert.throws(() => dissolveSub(d, "TOP", "s1"), /n'est plus dans le projet/);
});
