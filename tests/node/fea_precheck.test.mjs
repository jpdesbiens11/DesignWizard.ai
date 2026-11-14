// The hand calculation before the simulation, and the comparison after it.
import test from "node:test";
import assert from "node:assert/strict";
import { buildModel, solveStructure, solveThermal } from "../../web/js/analysis/fea/index.js";
import { precheckStructure, precheckThermal, precheckThermo, compare } from "../../web/js/analysis/fea/precheck.js";

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

test("structure: a load between two supports is read as a beam on two supports", () => {
  const m = beam(), load = { fixed: [{ face: "-X" }, { face: "+X" }], loads: [{ region: { near: [50, 5, 10], r: 3 }, force: [0, 0, -100] }] }, e = precheckStructure(m, load, steel);
  assert.equal(e.kind, "span"); near(e.values.L, 100, 1e-6);
  near(e.values.sigma, 15, 0.02);           // M = F L / 4 = 2500 N.mm ; sigma = M c / I = 2500 * 5 / 833.3 = 15 MPa
  near(e.values.delta, 0.011905, 0.02);     // F L^3 / (48 E I) = 1e8 / (48 * 210000 * 833.3) = 0.0119 mm
  assert.ok(e.warnings.some((w) => /appui simple et l'encastrement/.test(w)));
  near(e.values.deltaLow, e.values.delta / 4, 1e-9); near(e.values.sigmaLow, 7.5, 0.02);       // clamped ends: F L^3 / (192 E I), M = F L / 8
  const r = solveStructure(m, load), c = compare("structure", e, r);                           // both ends are clamped in the simulation
  assert.ok(r.maxU.value < e.values.delta * 1.05 && r.maxU.value > e.values.deltaLow * 0.8, `fea ${r.maxU.value} vs [${e.values.deltaLow}, ${e.values.delta}]`);
  assert.equal(c.rows[0].low, e.values.deltaLow); assert.ok(Math.abs(c.rows[0].deviation) <= 0.2, `deflection deviation ${c.rows[0].deviation}`);
  const spread = precheckStructure(m, { fixed: [{ face: "-X" }, { face: "+X" }], loads: [{ region: { face: "+Z" }, pressure: 0.1 }] }, steel);
  assert.equal(spread.kind, "span"); near(spread.values.sigma, 100 * 100 / 8 * 5 / 833.33, 0.02);   // F = 0.1 * 1000 = 100 N spread: M = F L / 8 = 1250 N.mm -> 7.5 MPa
  near(spread.values.delta, 5 * 100 * 1e6 / (384 * 210000 * 833.33), 0.02); near(spread.values.deltaLow, spread.values.delta / 5, 1e-9);
  const onSupport = precheckStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "-X" }, force: [0, 0, -100] }] }, steel);
  assert.equal(onSupport.kind, "none"); assert.match(onSupport.steps[0], /bras de levier/);
});

test("thermo-mechanical: free growth from one support, the full-restraint bound, the gradient stress", () => {
  const al = { ...alu, alpha: 23e-6 }, m = buildModel({ bodies: [{ name: "barre", ...boxMesh(0, 0, 0, 100, 10, 10), material: al }], h: 5 });
  const free = precheckThermo(m, { fixed: [{ face: "-X" }], thermal: { uniform: 120 }, Tref: 20 }, al);
  assert.equal(free.kind, "free"); near(free.values.dTmean, 100, 1e-9);
  near(free.values.sigma, 69000 * 23e-6 * 100, 1e-9);                                  // E alpha dT = 158.7 MPa
  near(free.values.delta, 23e-6 * 100 * Math.hypot(100, 5, 5), 1e-6);                  // alpha dT x distance to the farthest corner = 0.2306 mm
  assert.ok(free.steps.some((s) => /σ = E α ΔT/.test(s)) && free.steps.at(-1).includes("un seul appui"));
  assert.ok(free.warnings.length === 0, "276 MPa of yield is above the 158.7 MPa bound");
  const held = precheckThermo(m, { fixed: [{ face: "-X" }, { face: "+X" }], thermal: { uniform: 220 }, Tref: 20 }, { ...al, Re: 240 });
  assert.equal(held.kind, "restrained"); near(held.values.sigma, 317.4, 1e-3);
  assert.ok(held.warnings.some((w) => /limite élastique/.test(w)) && held.steps.at(-1).includes("bridée"));
  const grad = precheckThermo(m, { fixed: [{ face: "-X" }], Tref: 20, thermal: { case: { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }], convection: [] } } }, al);
  near(grad.values.dTmax, 50, 1e-6); near(grad.values.dTmean, 25, 1e-6);               // conduction: 20 -> 70 degrees C, mean 45
  near(grad.values.sigmaGrad, 69000 * 23e-6 * 50 / (2 * (1 - 0.33)), 1e-6);            // E alpha dT / (2 (1 - nu)) = 59.2 MPa
  assert.equal(precheckThermo(m, { fixed: [{ face: "-X" }], thermal: { uniform: 80 } }, alu).kind, "none", "no expansion coefficient, no estimate");
  assert.equal(precheckThermo(m, { fixed: [], thermal: { uniform: 80 } }, al).kind, "none");
  const two = buildModel({ bodies: [{ name: "bas", ...boxMesh(0, 0, 0, 100, 10, 2.5), material: { ...al, alpha: 20e-6 } }, { name: "haut", ...boxMesh(0, 0, 2.5, 100, 10, 5), material: { ...al, alpha: 10e-6 } }], h: 2.5 });
  near(precheckThermo(two, { fixed: [{ face: "-X" }], thermal: { uniform: 120 }, Tref: 20 }, { ...al, alpha: 20e-6 }).values.mismatch, 69000 * 10e-6 * 100 / 2, 1e-6);   // E dalpha dT / 2 = 34.5 MPa
});

test("thermo-mechanical: compare() reads a bound as a bound, and a free growth as a value", () => {
  const free = { values: { delta: 0.23, sigma: 158.7, restrained: false } }, held = { values: { delta: 0.23, sigma: 158.7, restrained: true } };
  const a = compare("thermo", free, { maxU: { value: 0.24 }, maxVm: { value: 190 }, nominalVm: { value: 20 } });
  assert.equal(a.verdict, "ok"); assert.equal(a.rows[1].bound, true); assert.equal(a.rows[1].deviation, 0); assert.match(a.rows[1].note, /bridage 13 %/);
  assert.equal(compare("thermo", free, { maxU: { value: 0.4 }, maxVm: { value: 50 }, nominalVm: { value: 20 } }).verdict, "fail", "a free part cannot grow 74 % more than alpha dT L");
  assert.equal(compare("thermo", held, { maxU: { value: 0.05 }, maxVm: { value: 200 }, nominalVm: { value: 150 } }).verdict, "ok", "under both bounds");
  assert.equal(compare("thermo", held, { maxU: { value: 0.05 }, maxVm: { value: 400 }, nominalVm: { value: 260 } }).verdict, "fail", "a nominal stress above E alpha dT is not thermal");
});
