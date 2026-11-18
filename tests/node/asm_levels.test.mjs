/* An assembly inside an assembly : the structure opened through its levels (core/asm_levels.js), the placements with a
   sub-assembly carried as one rigid whole (core/assembly_logic.js solve / solveLevels), the joints between levels, the bill of
   materials by level, and what is put aside. */
import test from "node:test";
import assert from "node:assert/strict";
import { SEP, topOf, isSub, ownsKey, holds, canHold, flatAsm, partCounts, leafOf, usedIn, bomLevels, depthOf } from "../../web/js/core/asm_levels.js";
import { liveAsm, offOf } from "../../web/js/core/asm_live.js";
import { solve, solveLevels, candidates, autoMate, freeInterfaces, bom, massProps } from "../../web/js/core/assembly_logic.js";
import { matPoint } from "../../web/js/cad/vec.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const at = (sol, id) => matPoint(sol.placements[id], [0, 0, 0]).map((x) => +x.toFixed(6));
/* an interface on the top of a part (side A, normal up) or under it (side B, normal down), at (x, y, z) */
const up = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "A", key, params: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] } });
const down = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "B", key, params: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] } });
const part = (interfaces, mass = 10) => ({ interfaces, bodies: [], bbox: [0, 0, 0, 10, 10, 5], mass, cog: [5, 5, 2.5] });
/* BASE : 10 high, a seat at the origin and another at x = 50 ; P1 : 5 high, sits by its bottom and carries P2 on its top ; P2 : sits by its bottom, a second foot at x = 3 */
const built = { BASE: part([up("IF1", 0, 0, 10, "k1"), up("IF2", 50, 0, 10, "k4")], 100), P1: part([down("IF1", 0, 0, 0, "k1"), up("IF3", 0, 0, 5, "k3")]), P2: part([down("IF3", 0, 0, 0, "k3"), down("IF4", 3, 0, 0, "k4")], 4), P3: part([]) };
const SUB = () => ({ id: "SUB", name: "Module", instances: [{ id: "i1", part: "P1", fixed: true }, { id: "i2", part: "P2" }, { id: "i3", part: "P3", off: true }], mates: [{ id: "M1", a: { inst: "i1", iface: "IF3" }, b: { inst: "i2", iface: "IF3" } }] });
const TOP = (extra = {}) => ({ id: "TOP", name: "Produit", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "s1", asm: "SUB", placement: { t: [100, 0, 0], r: [0, 0, 0] } }], mates: [], ...extra });
const project = (...list) => { const by = Object.fromEntries(list.map((a) => [a.id, a])); return (id) => by[id] || null; };

test("levels : the ids, and what belongs to an instance in the view", () => {
  assert.equal(SEP, "~"); assert.equal(topOf("s1~i2"), "s1"); assert.equal(topOf("s1~t2~i7"), "s1"); assert.equal(topOf("i4"), "i4"); assert.equal(topOf(undefined), "");
  assert.ok(isSub({ id: "s1", asm: "SUB" })); assert.ok(!isSub({ id: "i1", part: "P1" }));
  assert.ok(ownsKey("s1", "s1~i2/Corps")); assert.ok(ownsKey("i1", "i1/Corps")); assert.ok(ownsKey("s1~i2", "s1~i2/Corps"));
  assert.ok(!ownsKey("s1", "s10/Corps"), "« s1 » does not own « s10 »"); assert.ok(!ownsKey("s1", "s10~i2/Corps")); assert.ok(!ownsKey("", "i1/Corps"));
});

test("levels : an assembly cannot contain itself, at any depth", () => {
  const sub = SUB(), top = TOP(), mid = { id: "MID", instances: [{ id: "a", asm: "SUB" }], mates: [] }, big = { id: "BIG", instances: [{ id: "b", asm: "MID" }], mates: [] }, find = project(sub, top, mid, big);
  assert.ok(holds(top, "SUB", find)); assert.ok(holds(big, "SUB", find), "through a level"); assert.ok(!holds(sub, "TOP", find));
  assert.ok(canHold(top, mid, find)); assert.equal(canHold(top, top, find), false, "not itself"); assert.equal(canHold(sub, big, find), false, "BIG holds SUB : SUB cannot hold BIG"); assert.equal(canHold(mid, null, find), false);
  /* a loop already in a file is opened without going round for ever : the sub-assembly that would close it is left out, and said */
  const a = { id: "A", instances: [{ id: "x", asm: "B" }], mates: [] }, b = { id: "B", instances: [{ id: "p", part: "P1" }, { id: "y", asm: "A" }], mates: [] }, f = flatAsm(a, project(a, b));
  assert.deepEqual(f.instances.map((i) => i.id), ["x~p"]); assert.deepEqual(f.lost, [{ inst: "x~y", asm: "A", why: "cycle" }]); assert.ok(!holds(a, "ZZ", project(a, b)), "and the search ends");
});

test("levels : the assembly opened — every part once, where it came through", () => {
  const sub = SUB(), top = TOP({ instances: [...TOP().instances, { id: "s2", asm: "SUB", hidden: true }, { id: "s3", asm: "GONE" }] }), find = project(sub, top), f = flatAsm(top, find);
  assert.deepEqual(f.instances.map((i) => `${i.id}:${i.part}`), ["i1:BASE", "s1~i1:P1", "s1~i2:P2", "s2~i1:P1", "s2~i2:P2"], "what is off inside the sub-assembly is not there");
  assert.deepEqual(f.instances.map((i) => i.group || "-"), ["-", "s1", "s1", "s2", "s2"]); assert.ok(f.instances.slice(1).every((i) => i.sub === "SUB" && !("fixed" in i)), "what was fixed inside is carried with the rest");
  assert.deepEqual(f.instances.map((i) => !!i.hidden), [false, false, false, true, true], "a sub-assembly hidden hides its parts");
  assert.deepEqual(f.mates.map((m) => `${m.id}${m.of ? `<${m.of}` : ""}:${m.a.inst}-${m.b.inst}`), ["s1~M1<s1:s1~i1-s1~i2", "s2~M1<s2:s2~i1-s2~i2"]);
  assert.deepEqual(f.groups.s1, { asm: "SUB", name: "Module", placement: { t: [100, 0, 0], r: [0, 0, 0] }, fixed: false, hidden: false, parts: 2 });
  assert.deepEqual(f.lost, [{ inst: "s3", asm: "GONE", why: "missing" }]);
  assert.deepEqual(flatAsm(sub, find), liveAsm(sub), "nothing to open : the assembly as it counts"); const plain = { id: "X", instances: [{ id: "i1", part: "P1" }], mates: [] }; assert.equal(flatAsm(plain, find), plain, "and the same object when nothing is off either");
  assert.deepEqual([...partCounts(top, find)], [["BASE", 1], ["P1", 2], ["P2", 2]]); assert.equal(leafOf(top, "s2~i2", find).part, "P2"); assert.equal(leafOf(top, "s9~i2", find), null);
  assert.deepEqual(usedIn([top, sub], "SUB"), [{ id: "TOP", name: "Produit", qty: 2 }]);
  /* two levels : the ids chain, the group is the instance of THIS assembly */
  const big = { id: "BIG", name: "Système", instances: [{ id: "t1", asm: "TOP" }], mates: [] }, g = flatAsm(big, project(sub, top, big));
  assert.deepEqual(g.instances.map((i) => `${i.id}@${i.group}/${i.sub}`), ["t1~i1@t1/TOP", "t1~s1~i1@t1/SUB", "t1~s1~i2@t1/SUB", "t1~s2~i1@t1/SUB", "t1~s2~i2@t1/SUB"]); assert.equal(g.groups.t1.parts, 5); assert.equal(depthOf(big, project(sub, top, big)), 2);
});

test("levels : the bill of materials by level", () => {
  const sub = SUB(), top = TOP({ instances: [...TOP().instances, { id: "s2", asm: "SUB" }, { id: "i9", part: "P2" }, { id: "s3", asm: "GONE" }] }), find = project(sub, top);
  assert.deepEqual(bomLevels(top, find), [{ level: 0, kind: "part", id: "BASE", qty: 1 }, { level: 0, kind: "assembly", id: "SUB", qty: 2 }, { level: 1, kind: "part", id: "P1", qty: 1 }, { level: 1, kind: "part", id: "P2", qty: 1 },
    { level: 0, kind: "part", id: "P2", qty: 1 }, { level: 0, kind: "assembly", id: "GONE", qty: 1, lost: true }], "a sub-assembly is one line with its quantity ; what ONE of it holds comes under it");
  assert.equal(depthOf(top, find), 1); assert.equal(depthOf(sub, find), 0);
  /* opened, the quantities multiply : 2 sub-assemblies of one P2 each, and one P2 of its own */
  assert.equal(partCounts(top, find).get("P2"), 3); assert.deepEqual(bom({ parts: [] }, { ...flatAsm(top, find), mates: [] }, built).filter((r) => r.kind === "part").map((r) => `${r.id}×${r.qty}`), ["BASE×1", "P1×2", "P2×3"]);
});

test("solver : a sub-assembly nobody joins stays where it was put, whole", () => {
  const sub = SUB(), top = TOP(), { asm, sol } = solveLevels(top, built, project(sub, top));
  assert.deepEqual(at(sol, "i1"), [0, 0, 0]); assert.deepEqual(at(sol, "s1~i1"), [100, 0, 0]); assert.deepEqual(at(sol, "s1~i2"), [100, 0, 5], "P2 keeps the place it has in the sub-assembly : on P1");
  assert.deepEqual(at(sol, "s1"), [100, 0, 0], "the sub-assembly itself has its placement, under the id of its instance");
  assert.deepEqual(sol.floating, ["s1"], "counted once, not once per part"); assert.equal(sol.placedBy.s1, null); assert.equal(sol.problems.length, 0);
  assert.deepEqual(asm.instances.map((i) => i.id), ["i1", "s1~i1", "s1~i2"]); assert.ok(asm.instances[2].local);
});

test("solver : a joint of the parent to a part inside takes the whole sub-assembly with it", () => {
  const sub = SUB(), top = TOP({ mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF1" } }] }), { sol } = solveLevels(top, built, project(sub, top));
  assert.deepEqual(at(sol, "s1~i1"), [0, 0, 10], "P1 sits on the base"); assert.deepEqual(at(sol, "s1~i2"), [0, 0, 15], "and P2 came with it, on P1");
  assert.equal(sol.placedBy.s1, "M1"); assert.equal(sol.placedBy["s1~i2"], "M1"); assert.deepEqual(sol.floating, []); assert.equal(sol.problems.length, 0, "the joint inside the sub-assembly agrees with the places its parts keep");
  /* joined by the OTHER part of the sub-assembly — not the one that is fixed inside : the whole still follows */
  const top2 = TOP({ mates: [{ id: "M1", a: { inst: "i1", iface: "IF2" }, b: { inst: "s1~i2", iface: "IF4" } }] }), s2 = solveLevels(top2, built, project(sub, top2)).sol;
  assert.deepEqual(at(s2, "s1~i2"), [47, 0, 10], "the foot of P2 (at x = 3) sits on the seat at x = 50"); assert.deepEqual(at(s2, "s1~i1"), [47, 0, 5], "P1 hangs under it, as in the sub-assembly"); assert.equal(s2.problems.length, 0);
  const m = massProps(solveLevels(top2, built, project(sub, top2)).asm, built, s2.placements); near(m.mass, 114);
});

test("solver : a sub-assembly that is the ground, or turned ; two of the same", () => {
  const sub = SUB(), turned = { id: "TOP", instances: [{ id: "s1", asm: "SUB", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 90] } }, { id: "s2", asm: "SUB", placement: { t: [0, 200, 0], r: [0, 0, 0] } }, { id: "i1", part: "BASE" }], mates: [] };
  const { sol } = solveLevels(turned, built, project(sub, turned));
  assert.equal(sol.placedBy.s1, null); assert.deepEqual(sol.floating, ["s2", "i1"], "the fixed sub-assembly is the ground : it does not float"); assert.deepEqual(at(sol, "s1~i2"), [0, 0, 5]); assert.deepEqual(at(sol, "s2~i2"), [0, 200, 5], "the second one has its own place");
  const corner = matPoint(sol.placements["s1~i2"], [3, 0, 0]).map((x) => +x.toFixed(6)); assert.deepEqual(corner, [0, 3, 5], "turned a quarter about Z, the parts turn with their sub-assembly");
  /* nothing fixed anywhere : the first instance is the ground — here a sub-assembly */
  const loose = { id: "TOP", instances: [{ id: "s1", asm: "SUB", placement: { t: [7, 0, 0], r: [0, 0, 0] } }], mates: [] }, l = solveLevels(loose, built, project(sub, loose)).sol; assert.deepEqual(at(l, "s1~i2"), [7, 0, 5]); assert.deepEqual(l.floating, []);
});

test("solver : two levels deep, and a part that cannot be built is left out", () => {
  const sub = SUB(), mid = { id: "MID", name: "Bloc", instances: [{ id: "b", part: "BASE", fixed: true }, { id: "m", asm: "SUB" }], mates: [{ id: "M1", a: { inst: "b", iface: "IF1" }, b: { inst: "m~i1", iface: "IF1" } }] };
  const big = { id: "BIG", instances: [{ id: "x", asm: "MID", placement: { t: [0, 0, 1000], r: [0, 0, 0] } }], mates: [] }, find = project(sub, mid, big), { asm, sol } = solveLevels(big, built, find);
  assert.deepEqual(asm.instances.map((i) => i.id), ["x~b", "x~m~i1", "x~m~i2"]); assert.deepEqual(at(sol, "x~m~i2"), [0, 0, 1015], "base 10 + P1 5, lifted by 1000 with the whole");
  const some = { BASE: built.BASE, P1: built.P1 }, less = solveLevels(big, some, find); assert.deepEqual(less.asm.instances.map((i) => i.id), ["x~b", "x~m~i1"]); assert.deepEqual(at(less.sol, "x~m~i1"), [0, 0, 1010]);
  /* an assembly without a sub-assembly is solved as before */
  const flatSol = solveLevels(sub, built, find).sol; assert.deepEqual(at(flatSol, "i2"), [0, 0, 5]); assert.deepEqual(solve(liveAsm(sub), built).placements.i2, flatSol.placements.i2);
});

test("joints between levels : found between the parts, never inside one sub-assembly, and written in the parent", () => {
  const sub = { ...SUB(), mates: [] }, top = TOP(), find = project(sub, top), opened = solveLevels(top, built, find).asm;
  assert.ok(freeInterfaces(opened, built).some((f) => f.inst === "s1~i1" && f.group === "s1"));
  const c = candidates(opened, built).map((x) => `${x.a.inst}.${x.a.iface}-${x.b.inst}.${x.b.iface}`);
  assert.deepEqual(c.sort(), ["i1.IF1-s1~i1.IF1", "i1.IF2-s1~i2.IF4"], "P1 ↔ P2 would fit too, but both are in the sub-assembly : that joint belongs to it");
  const added = autoMate(top, built, opened); assert.equal(added.length, 2); assert.deepEqual(top.mates.map((m) => m.b.inst), ["s1~i1", "s1~i2"], "written in the parent, the part inside named through its sub-assembly"); assert.equal(top.mseq, 2);
});

test("on / off : a sub-assembly put aside takes its parts and the joints that go through it", () => {
  const top = TOP({ mates: [{ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF1" } }] }); top.instances[1].off = true;
  assert.deepEqual(offOf(top), { instances: ["s1"], mates: ["M1"] }); assert.equal(liveAsm(top).mates.length, 0); assert.deepEqual(flatAsm(top, project(SUB(), top)).instances.map((i) => i.id), ["i1"]);
});
