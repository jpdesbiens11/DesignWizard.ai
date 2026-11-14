// The hand calculation before the simulation, and the comparison after it.
import test from "node:test";
import assert from "node:assert/strict";
import { buildModel, solveStructure, solveThermal } from "../../web/js/analysis/fea/index.js";
import { precheckStructure, precheckThermal, compare } from "../../web/js/analysis/fea/precheck.js";

function boxMesh(x0, y0, z0, x1, y1, z1) {
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const q = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]], idx = [];
  for (const [a, b, c, d] of q) idx.push(a, b, c, a, c, d);
  return { pos: new Float32Array(p.flat()), idx: new Uint32Array(idx) };
}
const steel = { name: "Acier", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 350 }, alu = { name: "Aluminium", E: 69000, nu: 0.33, k: 200, rho: 2700, Re: 240 };
const near = (a, b, rel) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b} (±${rel * 100} %)`);
const beam = (mat = steel, h = 5) => buildModel({ bodies: [{ name: "poutre", ...boxMesh(0, 0, 0, 100, 10, 10), material: mat }], h });

test("structure: the cantilever is recognised and its section is read from the mesh", () => {
  const m = beam(), load = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, e = precheckStructure(m, load, steel);
  assert.equal(e.kind, "cantilever"); assert.equal(e.axis, 0);
  near(e.values.L, 100, 1e-6); near(e.values.area, 100, 1e-6);
  near(e.values.sigma, 60, 1e-6);          // 6 F L / (b h^2) = 6 * 100 * 100 / (10 * 100) = 60 MPa
  near(e.values.delta, 0.19048, 1e-4);     // F L^3 / (3 E I) = 100 * 1e6 / (3 * 210000 * 833.33) = 0.1905 mm
  near(e.values.sf, 350 / 60, 1e-6);
  assert.ok(e.steps.length >= 4 && e.steps.some((s) => /σ = M c \/ I/.test(s)) && e.steps.at(-1).startsWith("Attendu"));
  const side = precheckStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 50, 0] }] }, steel);
  near(side.values.sigma, 30, 1e-6);       // same square section, half the load
  const pull = precheckStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [1000, 0, 0] }] }, steel);
  assert.equal(pull.kind, "axial"); near(pull.values.sigma, 10, 1e-6); near(pull.values.delta, 1000 * 100 / (210000 * 100), 1e-6);
  assert.equal(precheckStructure(m, { fixed: [], loads: [] }, steel).kind, "none");
  assert.match(precheckStructure(m, { fixed: [{ face: "-X" }], loads: [] }, steel).steps[0], /effort/);
  const stubby = buildModel({ bodies: [{ name: "bloc", ...boxMesh(0, 0, 0, 20, 20, 20), material: steel }], h: 5 });
  assert.ok(precheckStructure(stubby, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, steel).warnings.some((w) => /trapue/.test(w)));
});

test("structure: the simulation agrees with the hand calculation on a beam, and compare() says so", () => {
  const m = beam(), load = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, e = precheckStructure(m, load, steel), r = solveStructure(m, load);
  near(r.maxU.value, e.values.delta, 0.06);
  const c = compare("structure", e, r);
  assert.equal(c.rows.length, 2); assert.equal(c.rows[0].label, "Déplacement maximal"); assert.ok(Math.abs(c.rows[0].deviation) < 0.06);
  assert.ok(["ok", "warn"].includes(c.verdict), `verdict ${c.verdict}, worst ${c.worst}`);
  assert.equal(compare("structure", e, { maxU: { value: e.values.delta * 3 }, maxVm: { value: e.values.sigma } }).verdict, "fail");
  assert.equal(compare("structure", { values: {} }, r).verdict, "none");
});

test("thermal: conduction to a held face, and the global convection balance with its Biot number", () => {
  const m = beam(alu), load = { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }], convection: [] }, e = precheckThermal(m, load, alu);
  assert.equal(e.kind, "conduction"); near(e.values.dT, 50, 1e-6); near(e.values.Tmax, 70, 1e-6);       // P L / (k A) = 10 * 100 / (0.2 * 100) = 50 K
  const r = solveThermal(m, load), c = compare("thermal", e, r);
  near(r.maxT.value, 70, 0.02); assert.equal(c.verdict, "ok");
  const block = buildModel({ bodies: [{ name: "bloc", ...boxMesh(0, 0, 0, 40, 40, 10), material: alu }], h: 5 });
  const conv = { power: [{ region: { face: "-Z" }, P: 5 }], fixedT: [], convection: [{ region: "exterior", h: 10, Tamb: 25 }] }, ec = precheckThermal(block, conv, alu);
  assert.equal(ec.kind, "convection"); near(ec.values.Tmean, 25 + 5 / (10 * 4800e-6), 1e-6);            // exposed area 2 * 1600 + 4 * 400 = 4800 mm2 -> 129.2 degrees C
  assert.ok(ec.values.biot < 0.01 && ec.steps.some((s) => /quasi isotherme/.test(s)));
  near(solveThermal(block, conv).maxT.value, ec.values.Tmax, 0.03);
  assert.equal(precheckThermal(m, { power: [], fixedT: [], convection: [] }, alu).kind, "none");
  assert.match(precheckThermal(m, { power: [{ region: { face: "+X" }, P: 1 }], fixedT: [], convection: [] }, alu).steps[0], /pas de sortie/);
});
