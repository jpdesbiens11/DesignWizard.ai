/* Simulation : a face the designer points at — inner faces included — as a region of the load case ; what a load case
   lacks or gets wrong, said before the run ; the guide that lists it. Real kernel for the geometry. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { buildModel, selectNodes, regionInfo, solveStructure, solveThermal, skin } from "../../web/js/analysis/fea/index.js";
import { exposedFaces } from "../../web/js/analysis/fea/voxel.js";
import { patchAt, patchKey, parsePatchKey, patchInfo, patchFaces, patchNodes, patchSpots, patchFlags, DIR_KEYS } from "../../web/js/analysis/fea/patch.js";
import { caseIssues, blocking, asks } from "../../web/js/analysis/fea/case_check.js";
import { bcTree } from "../../web/js/analysis/fea/bc_tree.js";
import { guideSort, guideCount, guideSummary, GUIDE_LEVELS } from "../../web/js/core/guide.js";

const K = await kernel(), alu = { E: 69000, nu: 0.33, k: 167, rho: 2700 };
const meshOf = (features) => { const b = buildPart(K, { dw: "part/1", id: "T", name: "T", material: "AL6061-T6", params: {}, interfaces: [], features }); return K.tessellate(b.bodies[0].shape); };
const modelOf = (features, o = { h: 2 }) => { const m = meshOf(features); return buildModel({ bodies: [{ name: "main", pos: m.pos, idx: m.idx, material: alu }], ...o }); };
const close = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what} : ${got} instead of ${want}`);
/* an open housing : 80 × 60 × 30 outside, walls and floor 4 thick */
const housing = modelOf([{ op: "box", size: [80, 60, 30] }, { op: "pocket", face: "+Z", rect: [4, 4, 72, 52], depth: 26 }]);

test("a click inside a housing finds its floor and its inner walls : the faces the six outer sides cannot name", () => {
  const floor = patchAt(housing, [40, 30, 4], [0, 0, 1]), i = patchInfo(housing, floor);
  assert.deepEqual([floor.dir, i.level, i.outer], ["+Z", 4, false]); close(i.area, 72 * 52, 1e-6, "floor of the housing"); assert.deepEqual([i.lo, i.hi], [[4, 4, 4], [76, 56, 4]]);
  assert.deepEqual(patchAt(housing, [12, 50, 4], [0, 0, 1]), floor, "wherever the face is clicked, the same patch gives the same answer");
  assert.equal(patchKey(floor), "patch:+Z:5,5,4"); assert.deepEqual(parsePatchKey(patchKey(floor)), floor); assert.equal(parsePatchKey("face:+Z"), null);
  const wall = patchInfo(housing, patchAt(housing, [4, 30, 15], [1, 0, 0])); close(wall.area, 52 * 26, 1e-6, "inner wall, looking at +X"); assert.deepEqual([wall.level, wall.outer, wall.dir], [4, false, "+X"]);
  close(patchInfo(housing, patchAt(housing, [76, 30, 15], [-1, 0, 0])).area, 52 * 26, 1e-6, "inner wall across");
  const rim = patchInfo(housing, patchAt(housing, [2, 30, 30], [0, 0, 1])); close(rim.area, 80 * 60 - 72 * 52, 1e-6, "top of the rim"); assert.equal(rim.outer, true, "the rim is the outermost plane : the plain side +Z says the same");
  assert.equal(patchInfo(housing, patchAt(housing, [80, 30, 15], [1, 0, 0])).outer, true); assert.equal(patchInfo(housing, patchAt(housing, [40, 30, 0], [0, 0, -1])).outer, true);
  assert.equal(patchAt(housing, [40, 30, 15], [0, 0, 1]), null, "nothing in the air of the cavity"); assert.equal(patchAt(housing, [40, 30, 4], [0.5, 0.5, 0.5]), null, "a normal that looks nowhere");
  assert.equal(patchInfo(housing, { at: [500, 0, 0], dir: "+Z" }), null); assert.throws(() => patchFaces(housing, { at: [0, 0, 0], dir: "up" }), /direction inconnue/); assert.equal(DIR_KEYS.length, 6);
});

test("the nodes, the symbols and the highlight of a pointed face come from the same faces", () => {
  const floor = patchAt(housing, [40, 30, 4], [0, 0, 1]), faces = patchFaces(housing, floor), all = exposedFaces(housing);
  assert.equal(faces.length, 36 * 26); assert.ok(faces.every((f) => all.dir[f] === 5), "every face of the patch looks up");
  assert.equal(patchNodes(housing, floor).length, 37 * 27); assert.deepEqual(Array.from(selectNodes(housing, { patch: floor })), Array.from(patchNodes(housing, floor)), "the solver reads the same nodes");
  const info = regionInfo(housing, { patch: floor }); close(info.area, 72 * 52, 1e-6, "area seen by the hand calculation"); assert.deepEqual(info.normal.map((v) => Math.round(v)), [0, 0, 1]);
  const spots = patchSpots(housing, floor, 4); assert.equal(spots.length, 4); assert.ok(spots.every((p) => p[2] === 4 && p[0] > 4 && p[0] < 76 && p[1] > 4 && p[1] < 56));
  assert.ok(Math.hypot(spots[0][0] - 40, spots[0][1] - 30) < 3, "the first symbol sits in the middle of the face"); assert.ok(Math.hypot(spots[1][0] - spots[2][0], spots[1][1] - spots[2][1]) > 30, "the others are far apart");
  const flags = patchFlags(housing, floor), s = skin(housing, null); assert.equal(flags.length, s.idx.length / 3, "one flag per triangle of the skin"); assert.equal(flags.reduce((a, b) => a + b, 0), 2 * faces.length);
});

test("a sloped wall — a staircase on this mesh — stays one face ; with step 0 only its plane is taken", () => {
  // a wedge : 40 long, 20 wide, 20 high at one end, 4 at the other — its top slopes
  const wedge = modelOf([{ op: "extrude", profile: { poly: [[0, 0], [40, 0], [40, 4], [0, 20]] }, plane: "XZ", length: 20 }]);
  const top = patchAt(wedge, [20, -10, 12], [0, 0, 1]) || patchAt(wedge, [20, 10, 12], [0, 0, 1]); assert.ok(top, "a tread of the slope");
  const i = patchInfo(wedge, top); assert.equal(i.level, null, "it steps : no single plane"); close(i.area, 40 * 20, 1e-6, "every tread of the slope, seen from above");
  const flat = patchInfo(wedge, { ...top, step: 0 }); assert.ok(flat.level !== null && flat.area < i.area / 3, "one tread only");
});

test("the solver takes a pointed face : a pressure on the inner floor, a force on an inner wall — the supports answer for exactly that", () => {
  const floor = patchAt(housing, [40, 30, 4], [0, 0, 1]), wall = patchAt(housing, [4, 30, 15], [1, 0, 0]);
  const p = solveStructure(housing, { fixed: [{ face: "-Z" }], loads: [{ region: { patch: floor }, pressure: 0.1 }] });
  close(p.reaction[2], 0.1 * 72 * 52, 0.5, "0,1 MPa on 3 744 mm² of floor"); assert.ok(Math.abs(p.reaction[0]) < 1e-3 && Math.abs(p.reaction[1]) < 1e-3);
  const f = solveStructure(housing, { fixed: [{ face: "-Z" }], loads: [{ region: { patch: wall }, force: [-50, 0, 0] }] });
  close(f.reaction[0], 50, 1e-3, "50 N pushed on the inner wall"); assert.ok(f.maxU.value > 0);
  const t = solveThermal(housing, { power: [{ region: { patch: floor }, P: 5 }], fixedT: [{ region: { face: "-Z" }, T: 25 }], convection: [] });
  assert.ok(t.maxT.value > 25 && t.maxT.value < 26, "5 W through 4 mm of aluminium : a fraction of a degree"); close(t.balance.out, 5, 0.05, "what comes in goes out");
  assert.throws(() => solveStructure(housing, { fixed: [{ face: "-Z" }], loads: [{ region: { patch: { at: [500, 0, 0], dir: "+Z" } }, pressure: 0.1 }] }), /face pointée \+Z/);
});

test("the load case says what it lacks or gets wrong, the most serious first — and what blocks a run", () => {
  const base = { kind: "structure", fixed: ["face:-X"], loads: [{ region: "face:+X", mode: "force", F: 100, dir: "-Z", p: 0.1 }], power: [], fixedT: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 } };
  const ids = (st, o) => caseIssues(st, o).map((x) => `${x.level}:${x.id || "-"}`);
  assert.deepEqual(caseIssues(base), [], "a complete case has nothing to say");
  assert.deepEqual(ids({ ...base, fixed: [], loads: [] }), ["error:-", "error:-"]); assert.match(caseIssues({ ...base, fixed: [] })[0].text, /tenu nulle part/);
  const ex = { ...base, loads: [{ ...base.loads[0], ask: ["F"] }] }, todo = caseIssues(ex);
  assert.deepEqual(todo.map((x) => [x.level, x.id, x.field]), [["todo", "E1", "F"]]); assert.match(todo[0].text, /E1 : entrez la force \(100 N est un exemple\)/); assert.deepEqual(asks(ex.loads[0]), ["F"]); assert.deepEqual(asks("face:+X"), []);
  assert.equal(blocking(todo).length, 1, "an example value waits for the designer : no run before it is entered or confirmed");
  assert.deepEqual(ids({ ...base, loads: [{ ...base.loads[0], region: "face:-X" }] }), ["warn:E1"], "a load on a clamped face goes straight into the support");
  assert.equal(blocking(caseIssues({ ...base, loads: [{ ...base.loads[0], region: "face:-X" }] })).length, 0, "a warning does not block");
  assert.deepEqual(ids({ ...base, loads: [{ ...base.loads[0], F: 0 }, { region: "face:+Z", mode: "pressure", p: 250, F: 100, dir: "-Z" }, { region: "face:+Y", mode: "force", F: -5, dir: "-Z", p: 0.1 }] }), ["warn:E1", "warn:E2", "tip:E3"]);
  assert.match(caseIssues({ ...base, loads: [{ region: "face:+Z", mode: "pressure", p: 250, F: 1, dir: "-Z" }] })[0].text, /2500 bar/);
  assert.deepEqual(ids({ ...base, fixed: ["face:-X", "patch:+Z:5,5,4", "face:-X"] }, { regionOk: (k) => !k.startsWith("patch:") }), ["error:A2", "tip:A3"], "a face that is gone from the mesh ; the same face held twice");
  const heat = { ...base, kind: "thermal", power: [{ region: "face:-Z", P: 5, ask: ["P"] }], fixedT: [], conv: { on: false, h: 10, Tamb: 25 } };
  assert.deepEqual(ids(heat), ["error:-", "todo:Q1"]); assert.match(caseIssues(heat)[0].text, /aucune sortie/);
  assert.deepEqual(ids({ ...heat, power: [{ region: "face:-Z", P: 0 }], fixedT: [{ region: "face:-Z", T: -300 }] }), ["error:T1", "warn:Q1", "warn:Q1"]);
  assert.deepEqual(ids({ ...heat, power: [], fixedT: [], conv: { on: true, h: 0 } }), ["error:-", "error:-"]);
  assert.deepEqual(ids({ ...base, kind: "thermo", thermo: { uniform: true, T: 20, Tref: 20 } }), ["warn:-"]);
});

test("the tree carries what each item still asks ; the guide sorts, counts and sums up a list the same way everywhere", () => {
  const st = { kind: "structure", fixed: ["face:-X"], loads: [{ region: "face:+X", mode: "force", F: 100, dir: "-Z", p: 0.1, ask: ["F"] }, { region: "face:+Z", mode: "pressure", F: 1, dir: "-Z", p: 0.2 }], power: [], fixedT: [], thermo: { uniform: true } };
  const tree = bcTree(st); assert.deepEqual(tree.map((g) => g.items.map((it) => it.ask)), [[[]], [["F"], []]]);
  const list = [{ level: "tip", text: "c" }, { level: "todo", text: "b" }, { level: "error", text: "a" }, { level: "warn", text: "d" }, { level: "odd", text: "e" }, { level: "warn" }];
  assert.deepEqual(guideSort(list).map((x) => x.text), ["a", "b", "d", "c", "e"], "an entry without words is dropped, an unknown level is a tip");
  assert.deepEqual(guideCount(list), { error: 1, todo: 1, warn: 1, tip: 2, blocking: 2 }); assert.equal(guideSummary(list), "1 à corriger · 1 à entrer · 1 à vérifier · 2 conseil"); assert.equal(guideSummary([]), "");
  assert.deepEqual(Object.keys(GUIDE_LEVELS).filter((k) => GUIDE_LEVELS[k].blocks), ["error", "todo"]);
});
