// Symmetries and cuts : a half, a quarter of the cubes give the answer of the whole ; a cut face is not a surface of the product.
//   node --test tests/node/fea_symmetry.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, selectNodes, regionInfo, solveStructure, solveThermal } from "../../web/js/analysis/fea/index.js";
import { findSymmetries, reduceModel, cutSetup, planeOf, loadSymmetry, CUT_BC } from "../../web/js/analysis/fea/symmetry.js";

const steel = { name: "Steel", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 250 }, alu = { name: "Aluminium", E: 70000, nu: 0.33, k: 200, rho: 2700, Re: 240 };
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const pos = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  return { pos, idx: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
}
const near = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${what} : ${a} vs ${b}`);
const body = (m, mat = steel) => [{ name: "P", ...m, material: mat }];
/** Solves the whole model and the model reduced by `cuts`, with the same cubes. */
function both(bodies, h, cuts, setup, kind = "structure") {
  const whole = buildModel({ bodies, h, planes: cuts }), part = reduceModel(whole, cuts), solve = kind === "thermal" ? solveThermal : solveStructure;
  return { whole, part, a: solve(whole, setup), b: solve(part, cutSetup(part, setup, kind)) };
}

test("the planes of symmetry of a product are found on its mesh", () => {
  const box = buildModel({ bodies: body(boxMesh(0, 0, 0, 40, 20, 10)), h: 2 });
  assert.deepEqual(findSymmetries(box).map((s) => [s.name, s.at, s.ok, s.mismatch]), [["X", 20, true, 0], ["Y", 10, true, 0], ["Z", 5, true, 0]]);
  const ell = buildModel({ bodies: [{ name: "A", ...boxMesh(0, 0, 0, 40, 10, 10), material: steel }, { name: "B", ...boxMesh(0, 10, 0, 10, 30, 10), material: steel }], h: 2.5 });
  assert.deepEqual(findSymmetries(ell).map((s) => s.ok), [false, false, true], "an L is its own mirror through its thickness only");
  const two = buildModel({ bodies: [{ name: "A", ...boxMesh(0, 0, 0, 20, 10, 10), material: steel }, { name: "B", ...boxMesh(20, 0, 0, 40, 10, 10), material: alu }], h: 2.5 });
  assert.equal(findSymmetries(two)[0].ok, false, "two materials side by side : the shape is symmetric, the product is not");
});

test("a beam bent in its plane of symmetry : half the cubes, the same deflection and the same stress", () => {
  const cuts = [{ axis: 1, at: 5, keep: 1, bc: "sym" }], setup = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] };
  const { whole, part, a, b } = both(body(boxMesh(0, 0, 0, 100, 10, 10)), 2.5, cuts, setup);
  assert.deepEqual([whole.nCells, part.nCells, part.cut.copies], [640, 320, 2]); assert.ok(Math.abs(planeOf(whole, cuts[0]).at - 5) < 1e-9, "a grid plane lies exactly on the cut");
  near(b.maxU.value, a.maxU.value, 2e-3, "deflection"); near(b.maxVm.value, a.maxVm.value, 5e-3, "peak stress");
  near(b.reaction[2], 50, 1e-3, "the half carries half the load"); near(a.reaction[2], 100, 1e-3, "the whole");
  const onPlane = selectNodes(part, { plane: { axis: 1, i: planeOf(whole, cuts[0]).i } });
  for (const i of onPlane) assert.ok(Math.abs(b.u[3 * i + 1]) < 1e-9, "nothing moves through the plane of symmetry");
  assert.ok([...part.cut.weight].filter((w) => w === 0.5).length === onPlane.length && onPlane.length > 0, "a node of the plane carries half of its load");
  /* the other half gives the same */
  const other = reduceModel(whole, [{ ...cuts[0], keep: -1 }]), c = solveStructure(other, cutSetup(other, setup, "structure")); near(c.maxU.value, a.maxU.value, 2e-3, "the other side");
});

test("a clamped plate under pressure : a quarter of the cubes gives the deflection of the whole", () => {
  const cuts = [{ axis: 0, at: 50, keep: 1, bc: "sym" }, { axis: 1, at: 50, keep: 1, bc: "sym" }];
  const setup = { fixed: [{ face: "-X" }, { face: "+X" }, { face: "-Y" }, { face: "+Y" }], loads: [{ region: { face: "+Z" }, pressure: 0.1 }] };
  const { whole, part, a, b } = both(body(boxMesh(0, 0, 0, 100, 100, 2)), 2, cuts, setup);
  assert.equal(part.nCells * 4, whole.nCells); near(b.maxU.value, a.maxU.value, 2e-3, "deflection at the centre"); near(b.reaction[2], a.reaction[2] / 4, 2e-3, "a quarter of the pressure");
  assert.ok([...part.cut.weight].some((w) => w === 0.25), "on the edge where the two planes meet, a quarter");
});

test("heat : the cut face is inside the product — no convection on it, half the power, the same temperatures", () => {
  const cuts = [{ axis: 0, at: 20, keep: 1, bc: "sym" }], setup = { power: [{ region: { face: "-Z" }, P: 5 }], convection: [{ region: "exterior", h: 50, Tamb: 25 }] };
  const { part, a, b } = both(body(boxMesh(0, 0, 0, 40, 20, 10), alu), 2.5, cuts, setup, "thermal");
  near(b.maxT.value - 25, a.maxT.value - 25, 2e-3, "hottest point"); near(b.minT.value - 25, a.minT.value - 25, 2e-3, "coldest point"); near(b.balance.in, 2.5, 1e-9, "half the power"); near(b.balance.out, 2.5, 1e-3, "and it leaves by the real surfaces");
  assert.equal(part.cut.onCut.reduce((n, v) => n + v, 0), 8 * 4, "the faces of the cut are known : 20 × 10 mm in cubes of 2,5");
  /* a temperature held on the cut instead : a zone of the product, its far side replaced by what the analyst knows */
  const zone = reduceModel(buildModel({ bodies: body(boxMesh(0, 0, 0, 40, 20, 10), alu), h: 2.5, planes: cuts }), [{ ...cuts[0], bc: "temp", T: 60 }]);
  const z = solveThermal(zone, cutSetup(zone, { power: [], convection: [{ region: "exterior", h: 50, Tamb: 25 }] }, "thermal")); near(z.maxT.value, 60, 1e-6, "the plane is at the temperature given");
});

test("a cut may isolate a zone : the plane held, the rest of the beam is a shorter beam", () => {
  const cuts = [{ axis: 0, at: 50, keep: 1, bc: "fixed" }], bodies = body(boxMesh(0, 0, 0, 100, 10, 10)), whole = buildModel({ bodies, h: 2.5, planes: cuts }), part = reduceModel(whole, cuts);
  const r = solveStructure(part, cutSetup(part, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, "structure")), I = 10 ** 4 / 12, exact = 100 * 50 ** 3 / (3 * 210000 * I);
  near(r.maxU.value, exact, 0.05, "F L³ / 3 E I with L = 50"); near(r.reaction[2], 100, 1e-3, "the whole load goes to the cut : the support of the −X face is on the side removed");
  assert.throws(() => reduceModel(whole, [{ axis: 0, at: 500, keep: 1 }]), /ne traverse pas/); assert.equal(reduceModel(whole, []), whole); assert.deepEqual(Object.keys(CUT_BC), ["sym", "fixed", "free", "temp"]);
});

test("is the load case symmetric too ? each support and each load is its own mirror, or has a twin", () => {
  const whole = buildModel({ bodies: body(boxMesh(0, 0, 0, 100, 10, 10)), h: 2.5 }), of = (r) => regionInfo(whole, r), plane = { axis: 1, at: 5 }, h = whole.grid.h;
  const ok = loadSymmetry([{ what: "appui", region: { face: "-X" } }, { what: "force", region: { face: "+X" }, vector: [0, 0, -100] }], plane, of, h); assert.deepEqual([ok.ok, ok.notes], [true, []]);
  const side = loadSymmetry([{ what: "force", label: "Force 1", region: { face: "+X" }, vector: [0, 30, -100] }], plane, of, h); assert.equal(side.ok, false); assert.match(side.notes[0], /Force 1 : l'effort pousse à travers le plan Y — le chargement est antisymétrique/);
  const lone = loadSymmetry([{ what: "appui", label: "Appui 1", region: { near: [50, 0, 5], r: 3 } }], plane, of, h); assert.match(lone.notes[0], /Appui 1 : rien ne lui répond de l'autre côté du plan Y/);
  /* a thin plate pushed on its top face : its shape is symmetric through its thickness, its load is not — even with one cube in the thickness */
  const plate = buildModel({ bodies: body(boxMesh(0, 0, 0, 100, 60, 2.5)), h: 2.5 }), top = loadSymmetry([{ what: "effort pressure", label: "Effort 1", region: { face: "+Z" } }], { axis: 2, at: 1.25 }, (r) => regionInfo(plate, r), 2.5);
  assert.equal(findSymmetries(plate)[2].ok, true); assert.equal(top.ok, false); assert.match(top.notes[0], /Effort 1 : rien ne lui répond de l'autre côté du plan Z/);
  const twins = loadSymmetry([{ what: "appui", region: { near: [50, 0, 5], r: 3 } }, { what: "appui", region: { near: [50, 10, 5], r: 3 } }], plane, of, h); assert.equal(twins.ok, true, "two screws facing each other");
});
