/* The real geometry as the place of a condition : a face, an edge, a point of the product, the face a cut leaves (entity.js, index.js),
   the mesh of the kernel made ready for the view (core/mesh_clip.js), and the walls a refinement zone crosses. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, solveStructure, solveThermal, selectNodes, regionInfo, regionFaces } from "../../web/js/analysis/fea/index.js";
import { reduceModel, cutSetup } from "../../web/js/analysis/fea/symmetry.js";
import { trisRegion, pathNodes, nearestNode, wallRuns, zoneWalls, fitToWall } from "../../web/js/analysis/fea/entity.js";
import { prepareZone, localRegion, prepareZones } from "../../web/js/analysis/fea/refine.js";
import { solveComposite } from "../../web/js/analysis/fea/composite.js";
import { bakeMesh, clipMesh, faceTris } from "../../web/js/core/mesh_clip.js";
import { bcTree, loadDir, pushInto, dirText, supportKey, supportDofs, supportText, AXIS_DIRS } from "../../web/js/analysis/fea/bc_tree.js";
import { caseIssues, blocking } from "../../web/js/analysis/fea/case_check.js";
import { zoneIssues } from "../../web/js/analysis/fea/refine.js";

const steel = { name: "Steel", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 250 };
const near = (actual, expected, rel, label) => assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${label}: ${actual} vs ${expected} (tolerance ${rel * 100} %)`);
/** Plate sx × sy, thickness t, centred on the Z axis, with a through hole of radius r. Its faces : 0 top, 1 bottom, 2 the four sides, 3 the hole. */
function plate(sx, sy, t, r, n = 96) {
  const pos = [], idx = [], faceOf = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n, c = Math.cos(a), s = Math.sin(a), k = Math.min(sx / 2 / Math.max(1e-9, Math.abs(c)), sy / 2 / Math.max(1e-9, Math.abs(s))); pos.push(r * c, r * s, 0, r * c, r * s, t, k * c, k * s, 0, k * c, k * s, t); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, cb = 4 * i, ct = cb + 1, sb = cb + 2, st = cb + 3, cb2 = 4 * j, ct2 = cb2 + 1, sb2 = cb2 + 2, st2 = cb2 + 3; idx.push(ct, st, st2, ct, st2, ct2, cb, sb2, sb, cb, cb2, sb2); faceOf.push(0, 0, 1, 1); idx.push(sb, sb2, st2, sb, st2, st, cb, ct2, cb2, cb, ct, ct2); faceOf.push(2, 2, 3, 3); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), faceOf: new Uint32Array(faceOf) };
}
const mesh = plate(80, 40, 5, 6), bodies = [{ name: "Plate", pos: mesh.pos, idx: mesh.idx, material: steel }], model = buildModel({ bodies, h: 1.25 }), radius = (m, i) => Math.hypot(m.nodes[3 * i], m.nodes[3 * i + 1]);
const hole = { tris: faceTris(mesh, 3) }, top = { tris: faceTris(mesh, 0) }, rim = { path: Array.from({ length: 49 }, (_, k) => [6 * Math.cos(k * Math.PI / 24), 6 * Math.sin(k * Math.PI / 24), 5]) }, corner = { near: [40, 20, 5], r: 0 };

test("entity — a face of the product : the cubes that lie on it, whatever its shape, and not the other side of the wall", () => {
  assert.equal(hole.tris.length, 9 * 2 * 96, "the triangles of one face, 9 numbers each");
  const h = trisRegion(model, hole), t = trisRegion(model, top);
  assert.ok(h.faces.length > 100 && h.nodes.length > 100); for (const i of h.nodes) assert.ok(radius(model, i) > 4.5 && radius(model, i) < 7.5, "a node of the wall of the hole is at its radius, give or take a cube");
  near(t.faces.length * 1.25 ** 2, 80 * 40 - Math.PI * 36, 0.01, "area of the top face, on the cubes"); for (const i of t.nodes) assert.equal(model.nodes[3 * i + 2], 5, "the top face holds no node of the bottom, 4 cubes below");
  assert.equal(trisRegion(model, hole), h, "asked again, the same answer is given back"); assert.deepEqual(Array.from(selectNodes(model, hole)), Array.from(h.nodes)); assert.deepEqual(regionFaces(model, hole), h.faces);
  near(regionInfo(model, top).area, t.faces.length * 1.5625, 1e-9, "the area a region reports"); assert.equal(trisRegion(model, { tris: new Float32Array(0) }).nodes.length, 0);
  const far = trisRegion(model, { tris: Float32Array.from([500, 0, 0, 501, 0, 0, 500, 1, 0]) }); assert.equal(far.nodes.length + far.faces.length, 0, "a face away from the product holds nothing");
});

test("entity — a pressure on a curved face, a force of any direction on a point : the solver takes them", () => {
  const p = solveStructure(model, { fixed: [{ face: "-X" }], loads: [{ region: hole, pressure: 5 }] });
  for (const v of p.reaction) assert.ok(Math.abs(v) < 1e-3, "a pressure all around a hole pushes the plate nowhere (1 250 N of pressure, less than a thousandth of a newton left)"); assert.ok(p.maxVm.value > 5 && Math.hypot(p.maxVm.at[0], p.maxVm.at[1]) < 8, "and its peak is at the hole");
  const f = solveStructure(model, { fixed: [{ face: "-X" }], loads: [{ region: corner, force: [3, -4, -12] }] }); [3, -4, -12].forEach((v, d) => near(f.reaction[d], -v, 1e-6, `reaction ${"XYZ"[d]}`));
  const heat = solveThermal(model, { fixedT: [{ region: hole, T: 80 }], convection: [{ region: top, h: 50, Tamb: 20 }] }); near(heat.maxT.value, 80, 1e-9, "the wall of the hole is held at 80 °C"); assert.ok(heat.minT.value < 79 && heat.minT.value > 20, "and the top face, cooled, is colder");
});

test("entity — an edge and a point of the product, and several places as one", () => {
  const e = pathNodes(model, rim.path); assert.ok(e.length >= 30 && e.length <= 60); for (const i of e) { assert.equal(model.nodes[3 * i + 2], 5, "the rim of the hole, on the top face"); assert.ok(radius(model, i) > 4.5 && radius(model, i) < 7.5); }
  assert.deepEqual(Array.from(selectNodes(model, rim)), Array.from(e)); const c = selectNodes(model, corner); assert.equal(c.length, 1); assert.deepEqual(Array.from(model.nodes.subarray(3 * c[0], 3 * c[0] + 3)), [40, 20, 5]);
  assert.equal(pathNodes(model, [[40, 20, 5]]).length, 1, "a line of one point is a point"); assert.equal(pathNodes(model, [[900, 0, 0], [910, 0, 0]]).length, 0); assert.equal(nearestNode(model, [900, 0, 0], null), -1);
  const both = selectNodes(model, { any: [rim, corner] }); assert.equal(both.length, e.length + 1); assert.ok(both.every((v, k) => !k || v > both[k - 1]), "sorted, each node once"); assert.equal(selectNodes(model, { any: [rim, rim] }).length, e.length);
  assert.equal(regionFaces(model, { any: [hole, top] }).length, trisRegion(model, hole).faces.length + trisRegion(model, top).faces.length); assert.equal(regionFaces(model, rim).length, 0, "an edge carries no face : a force, not a pressure");
  assert.throws(() => solveStructure(model, { fixed: [{ face: "-X" }], loads: [{ region: rim, pressure: 1 }] }), /arête de la pièce.*aucune face/); assert.throws(() => selectNodes(model, { sphere: 1 }), /\{ tris \}, \{ path \}/);
  const line = solveStructure(model, { fixed: [{ face: "-X" }], loads: [{ region: { any: [rim] }, force: [0, 0, -30] }] }); near(line.reaction[2], 30, 1e-6, "30 N spread along the rim");
});

test("entity — the face a cut leaves : held, pushed or pulled like any face, and whole", () => {
  const cuts = [{ axis: 0, at: 0, keep: -1, bc: "free" }], half = reduceModel(buildModel({ bodies, h: 1.25, planes: cuts }), cuts), face = { cut: 0 }, nodes = selectNodes(half, face), faces = regionFaces(half, face);
  assert.ok(nodes.length > 50 && faces.length > 50); for (const i of nodes) assert.equal(half.nodes[3 * i], 0); assert.equal(selectNodes(model, face).length, 0, "a model that is not cut has no cut face"); assert.equal(regionFaces(half, { cut: 1 }).length, 0);
  const pulled = solveStructure(half, cutSetup(half, { fixed: [{ face: "-X" }], loads: [{ region: face, pressure: -10 }] }, "structure")); near(pulled.reaction[0], -10 * faces.length * 1.5625, 1e-6, "10 MPa on the whole cut face");
  const pushed = solveStructure(half, cutSetup(half, { fixed: [{ face: "-X" }], loads: [{ region: face, force: [0, 0, -50] }] }, "structure")); near(pushed.reaction[2], 50, 1e-6, "50 N on the cut face are 50 N — not halved like a load the plane shares");
  const on = selectNodes(half, hole); assert.ok(on.length < on.whole && on.whole === trisRegion(model, hole).nodes.length, "a face of the product keeps the size it has on the whole product");
  const held = solveStructure(half, cutSetup(half, { fixed: [face], loads: [{ region: { face: "-X" }, force: [0, 100, 0] }] }, "structure")); near(held.reaction[1], -100, 1e-6, "held by its cut face");
  const mixed = selectNodes(half, { any: [face, hole] }); assert.ok(mixed.length >= nodes.length && mixed.whole >= mixed.length);
});

test("entity — in a refinement zone : the same face, edge and point, read on the small cubes", () => {
  const coarse = buildModel({ bodies, h: 2.5 }), z = { id: "Z1", shape: "cylinder", axis: 2, size: 24, length: 5, at: [0, 0, 2.5], ratio: 2 }, prep = prepareZone(coarse, bodies, z), L = prep.local;
  const h = localRegion(prep, coarse, hole); assert.ok(h.faces.length > trisRegion(coarse, hole).faces.length, "more, smaller faces around the hole"); for (const i of h.nodes) assert.ok(radius(L, i) > 5 && radius(L, i) < 7);
  const e = localRegion(prep, coarse, rim); assert.ok(e.nodes.length >= 20 && e.faces.length === 0); for (const i of e.nodes) assert.equal(L.nodes[3 * i + 2], 5);
  assert.equal(localRegion(prep, coarse, corner).nodes.length, 0, "a point outside the zone is not in it"); assert.equal(localRegion(prep, coarse, { near: [6, 0, 5], r: 0 }).nodes.length, 1);
  assert.equal(localRegion(prep, coarse, { any: [hole, rim] }).faces.length, h.faces.length); assert.equal(localRegion(prep, coarse, { cut: 0 }).nodes.length, 0, "no cut, no cut face");
  /* a pressure in the hole, the hole in a zone : still balanced, and the zone carries its share */
  const load = { fixed: [{ face: "-X" }], loads: [{ region: hole, pressure: 5 }] }, preps = prepareZones(coarse, bodies, [z]).map((p) => p.prep), c = solveComposite("structure", coarse, preps, load);
  for (const v of c.r.reaction) assert.ok(Math.abs(v) < 1e-3); const alone = solveStructure(coarse, load); assert.ok(c.parts[0].r.maxVm.value > 0.5 * alone.maxVm.value && c.parts[0].r.maxVm.value < 3 * alone.maxVm.value);
  /* on half the plate, the cut face in the zone */
  const cuts = [{ axis: 1, at: 0, keep: 1, bc: "free" }], half = reduceModel(buildModel({ bodies, h: 2.5, planes: cuts }), cuts), ph = prepareZone(half, bodies, z), cf = localRegion(ph, half, { cut: 1 });
  assert.ok(cf.nodes.length > 0 && cf.faces.length > 0); for (const i of cf.nodes) assert.equal(ph.local.nodes[3 * i + 1], 0);
});

test("entity — the walls a zone crosses : one wall of a plate, two of a box, and a zone fitted to the one under its centre", () => {
  const z = { shape: "cylinder", axis: 2, size: 14, length: 40, at: [0, 0, 2.5] };
  assert.deepEqual(zoneWalls(model, z), [{ lo: 0, hi: 5 }], "a zone on the hole still meets the wall the hole is drilled in"); assert.deepEqual(fitToWall(model, { ...z, at: [0, 0, 30] }), { at: [0, 0, 2.5], length: 6.25, wall: { lo: 0, hi: 5 } });
  /* a box : two walls 30 mm apart along Z */
  const quad = (x0, y0, z0, x1, y1, z1) => ({ pos: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), idx: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) });
  const box = buildModel({ bodies: [{ name: "Bottom", ...quad(0, 0, 0, 40, 40, 4), material: steel }, { name: "Top", ...quad(0, 0, 34, 40, 40, 38), material: steel }, { name: "Side", ...quad(0, 0, 0, 4, 40, 38), material: steel }], h: 2 });
  const through = { shape: "prism", axis: 2, size: 8, length: 60, at: [25, 20, 19] }, walls = zoneWalls(box, through);
  assert.deepEqual(walls, [{ lo: 0, hi: 4 }, { lo: 34, hi: 38 }], "a prism through the box meets its floor and its lid"); assert.equal(zoneWalls(box, { ...through, length: 10, at: [25, 20, 36] }).length, 1, "shortened, it meets one");
  assert.deepEqual(fitToWall(box, { ...through, at: [25, 20, 36] }), { at: [25, 20, 36], length: 6, wall: { lo: 34, hi: 38 } }); assert.deepEqual(fitToWall(box, { ...through, at: [25, 20, 10] }).wall, { lo: 0, hi: 4 }, "the nearest wall");
  assert.equal(zoneWalls(box, { ...through, at: [3, 20, 19] }).length, 1, "against the side wall, floor and lid are one piece of material"); assert.equal(fitToWall(box, { ...through, at: [500, 500, 0] }), null);
  assert.deepEqual(wallRuns(box, 2, () => false), []); assert.equal(wallRuns(box, 0, (y, zz) => zz > 10 && zz < 30 && y > 10 && y < 30).length, 1, "along X, between floor and lid : only the side wall");
});

test("mesh — placed where its part stands, and cut by a plane : faces and edges keep their numbers", () => {
  const src = { ...mesh, nrm: Float32Array.from({ length: mesh.pos.length }, (_, i) => (i % 3 === 2 ? 1 : 0)), epos: new Float32Array([-40, -20, 0, 40, -20, 0, -40, 20, 0, -30, 20, 0]), edgeOf: new Uint32Array([7, 9]), faces: [{ type: "plane", n: [0, 0, 1], o: [0, 0, 5] }, {}, {}, { type: "cylinder", axis: [0, 0, 1], o: [0, 0, 0], r: 6 }], edges: [{ type: "line", p0: [-40, -20, 0], p1: [40, -20, 0] }] };
  assert.equal(clipMesh(src, []), src, "no plane : the mesh itself"); assert.equal(bakeMesh(src, null), src);
  const k = clipMesh(src, [{ axis: 0, at: 0, keep: 1 }]); for (let i = 0; i < k.pos.length; i += 3) assert.ok(k.pos[i] >= -1e-6, "nothing left on the side that was removed");
  assert.ok(k.idx.length / 3 > 300 && k.idx.length / 3 < src.idx.length / 3 + 50); assert.deepEqual([...new Set(k.faceOf)].sort(), [0, 1, 2, 3]); assert.equal(k.faceOf.length, k.idx.length / 3); assert.equal(k.nrm.length, k.pos.length);
  assert.deepEqual(Array.from(k.epos), [0, -20, 0, 40, -20, 0], "an edge the plane crosses is cut at the plane ; one wholly on the other side is gone"); assert.deepEqual(Array.from(k.edgeOf), [7]); assert.equal(k.faces, src.faces);
  near(faceTris(k, 3).length, faceTris(src, 3).length / 2, 0.1, "half the wall of the hole");
  const two = clipMesh(src, [{ axis: 0, at: 0, keep: 1 }, { axis: 1, at: 0, keep: -1 }]); for (let i = 0; i < two.pos.length; i += 3) assert.ok(two.pos[i] >= -1e-6 && two.pos[i + 1] <= 1e-6); assert.equal(clipMesh(src, [{ axis: 2, at: 99, keep: 1 }]).idx.length, 0);
  /* a quarter turn about Z, then 100 mm along X */
  const m = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 100, 0, 0, 1], b = bakeMesh(src, m);
  assert.deepEqual(Array.from(b.pos.subarray(0, 3)).map((v) => Math.round(v * 1e4) / 1e4), [100, 6, 0], "the first point of the hole, (6, 0, 0), turned and moved"); assert.deepEqual(b.faces[0].o, [100, 0, 5]); assert.deepEqual(b.faces[0].n, [0, 0, 1]); assert.deepEqual(b.edges[0].p0, [120, -40, 0]);
  assert.deepEqual(Array.from(b.epos.subarray(0, 3)), [120, -40, 0]); assert.equal(b.idx, src.idx); assert.deepEqual(Array.from(b.nrm.subarray(0, 3)), [0, 0, 1]);
});

test("load case — a force takes any direction, a support blocks the directions it is told to", () => {
  assert.deepEqual(loadDir({ dir: "-Z" }), [0, 0, -1]); assert.equal(Object.keys(AXIS_DIRS).length, 6); assert.equal(loadDir({ dir: "up" }), null); assert.equal(loadDir(null), null);
  const u = loadDir({ dir: "free", vec: [3, 0, -4] }); assert.deepEqual(u.map((c) => Math.round(c * 1e6) / 1e6), [0.6, 0, -0.8], "its own vector, brought to length 1"); for (const bad of [[0, 0, 0], [1, 2], [1, NaN, 0], undefined]) assert.equal(loadDir({ dir: "free", vec: bad }), null);
  assert.deepEqual(pushInto([0, 0, 1]), { dir: "-Z" }, "a load pushes into the face it is put on"); assert.deepEqual(pushInto([-1, 0, 0]), { dir: "+X" }); assert.deepEqual(pushInto([0.6, 0, 0.8]), { dir: "free", vec: [-0.6, 0, -0.8] }, "a sloped face : its own direction");
  assert.equal(dirText({ dir: "-Z" }), "vers −Z"); assert.equal(dirText({ dir: "+X" }, true), "+X"); assert.equal(dirText({ dir: "free", vec: [1, 0, -1] }), "direction (0,707 ; 0 ; −0,707)"); assert.equal(dirText({ dir: "free", vec: [0, 0, 0] }), "sans direction");
  assert.equal(supportKey("face:-X"), "face:-X"); assert.equal(supportKey({ region: "place:2", dofs: [false, false, true] }), "place:2"); assert.deepEqual(supportDofs("face:-X"), [true, true, true]); assert.deepEqual(supportDofs({ region: "p", dofs: [0, 1, 0] }), [false, true, false]);
  assert.equal(supportText("face:-X"), "Encastrement"); assert.equal(supportText({ region: "p", dofs: [false, false, true] }), "Appui : bloque Z"); assert.equal(supportText({ region: "p", dofs: [true, false, true] }), "Appui : bloque X et Z"); assert.equal(supportText({ region: "p", dofs: [false, false, false] }), "Appui : ne bloque rien");
  const st = { kind: "structure", fixed: ["face:-X", { region: "place:1", dofs: [false, false, true] }], loads: [{ region: "place:2", mode: "force", F: 100, dir: "free", vec: [1, 0, -1] }, { region: "face:+Z", mode: "force", F: 50, dir: "-Y" }], power: [], fixedT: [], conv: { on: false }, thermo: { uniform: true } };
  const tree = bcTree(st, (k) => `« ${k} »`), [sup, loads] = tree; assert.deepEqual(sup.items.map((x) => [x.id, x.text, x.region, x.short]), [["A1", "Encastrement", "face:-X", "A1"], ["A2", "Appui : bloque Z", "place:1", "A2 · Z"]]);
  assert.deepEqual(loads.items.map((x) => [x.text, x.short]), [["Force 100 N direction (0,707 ; 0 ; −0,707)", "E1 · 100 N (0,707 ; 0 ; −0,707)"], ["Force 50 N vers −Y", "E2 · 50 N −Y"]]);
  assert.deepEqual(caseIssues(st), [], "nothing to say of a sound case");
  const odd = caseIssues({ ...st, fixed: ["face:-X", { region: "place:1", dofs: [false, false, false] }], loads: [{ region: "place:2", mode: "force", F: 100, dir: "free", vec: [0, 0, 0] }, { region: "face:-X", mode: "pressure", p: 0.1 }] });
  assert.ok(odd.some((x) => x.level === "error" && x.id === "A2" && x.field === "dofs" && /ne bloque aucune direction/.test(x.text))); assert.ok(odd.some((x) => x.level === "error" && x.id === "E1" && x.field === "vec" && /n'a pas de direction/.test(x.text)));
  assert.ok(odd.some((x) => x.level === "warn" && x.id === "E2" && /encastrée \(A1\)/.test(x.text)), "a load on a face that is fully held is said"); assert.equal(blocking(odd).length, 2);
  assert.ok(!caseIssues({ ...st, fixed: [{ region: "face:+Z", dofs: [false, false, true] }] }).some((x) => /encastrée/.test(x.text)), "a face that only rests can still be pushed sideways");
  assert.deepEqual(caseIssues({ ...st, fixed: ["face:-X", "face:-X"] }).filter((x) => x.level === "tip").map((x) => x.id), ["A2"]); assert.equal(caseIssues({ ...st, fixed: ["face:-X", { region: "face:-X", dofs: [true, false, false] }] }).filter((x) => x.level === "tip").length, 0, "the same place held another way is not a repeat");
});

test("zone — the guide says when it runs through several walls of the part", () => {
  const z = { id: "Z1", shape: "prism", axis: 2, size: 12, length: 60, at: [0, 0, 0], ratio: 2 }, info = (walls) => () => ({ cells: 800, block: 100, h: 2, walls });
  assert.deepEqual(zoneIssues([z], info(1)), []); const two = zoneIssues([z], info(2)); assert.deepEqual(two.map((x) => [x.level, x.id, x.field]), [["tip", "Z1", "length"]]); assert.match(two[0].text, /Z1 traverse 2 parois de la pièce.*« Une seule paroi »/);
  assert.equal(blocking(two).length, 0, "a word of advice : the run does not wait for it");
});
