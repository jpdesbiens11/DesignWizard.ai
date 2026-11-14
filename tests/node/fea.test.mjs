// Simplified finite elements (voxel mesh, hex8 with incompatible modes, matrix-free PCG) against closed-form results.
//   node --test tests/node/fea.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, selectNodes, regionInfo, sectionAt, solveStructure, solveThermal, skin } from "../../web/js/analysis/fea/index.js";
import { structureElement, conductionElement } from "../../web/js/analysis/fea/hex8.js";

const steel = { name: "Steel", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 250 };
const alu = { name: "Aluminium", E: 70000, nu: 0.33, k: 200, rho: 2700, Re: 240 };
const poor = { name: "Poor conductor", E: 70000, nu: 0.33, k: 20, rho: 2700, Re: null };

/** Closed box, 8 vertices and 12 triangles, outward winding. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const pos = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { pos, idx };
}

/** Closed cylinder of axis Z centred on (cx, cy), n facets. */
function cylinderMesh(cx, cy, z0, z1, r, n = 64) {
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    pos.push(x, y, z0, x, y, z1);
  }
  pos.push(cx, cy, z0, cx, cy, z1);
  for (let i = 0; i < n; i++) {
    const b0 = 2 * i, t0 = b0 + 1, b1 = 2 * ((i + 1) % n), t1 = b1 + 1;
    idx.push(b0, b1, t1, b0, t1, t0, 2 * n, b1, b0, 2 * n + 1, t0, t1);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

/** Square plate (side `size`, thickness t, centred on the Z axis, z from 0 to t) with a through hole of radius r. */
function plateWithHole(size, t, r, n = 64) {
  const pos = [], idx = [], half = size / 2;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n, c = Math.cos(a), s = Math.sin(a), k = half / Math.max(Math.abs(c), Math.abs(s));
    pos.push(r * c, r * s, 0, r * c, r * s, t, k * c, k * s, 0, k * c, k * s, t);   // hole bottom, hole top, rim bottom, rim top
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, cb = 4 * i, ct = cb + 1, sb = cb + 2, st = cb + 3, cb2 = 4 * j, ct2 = cb2 + 1, sb2 = cb2 + 2, st2 = cb2 + 3;
    idx.push(ct, st, st2, ct, st2, ct2, cb, sb2, sb, cb, cb2, sb2);       // top and bottom rings
    idx.push(sb, sb2, st2, sb, st2, st, cb, ct2, cb2, cb, ct, ct2);       // outer wall, hole wall
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

const bar = (h, material = steel) => buildModel({ bodies: [{ name: "Bar", ...boxMesh(0, 0, 0, 100, 10, 10), material }], h });
const mean = (field, sel, stride = 1, offset = 0) => sel.reduce((s, i) => s + field[stride * i + offset], 0) / sel.length;
const near = (actual, expected, rel, label) => assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${label}: ${actual} vs ${expected} (tolerance ${rel * 100} %)`);

test("voxeliser: a box is meshed exactly when h divides its sizes", () => {
  const m = bar(5);
  assert.deepEqual([m.grid.nx, m.grid.ny, m.grid.nz], [20, 2, 2]);
  assert.equal(m.nCells, 80);                     // 20 x 2 x 2
  assert.equal(m.nNodes, 21 * 3 * 3);
  assert.equal(m.volume, 10000);                  // 100 x 10 x 10 mm3, exact
  assert.deepEqual(m.bbox, [0, 0, 0, 100, 10, 10]);
  assert.equal(m.elems.length, 8 * m.nCells);
  assert.equal(m.bodies[0].cells, 80);
  // hex8 order: bottom face counter-clockwise, then top face — check the first element
  const p = (c) => Array.from(m.nodes.subarray(3 * m.elems[c], 3 * m.elems[c] + 3));
  assert.deepEqual([p(0), p(1), p(2), p(3), p(4), p(6)], [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0], [0, 0, 5], [5, 5, 5]]);
  for (let e = 0; e < m.nCells; e++) assert.equal(m.cells[m.elemCell[e]], m.elemBody[e]);
});

test("voxeliser: cylinder volume within 5 % at about 4000 cells, also through a placement matrix", () => {
  const exact = Math.PI * 10 * 10 * 40;           // pi r^2 L = 12566 mm3
  const m = buildModel({ bodies: [{ name: "Cyl", ...cylinderMesh(0, 0, 0, 40, 10), material: steel }], target: 4000 });
  assert.ok(m.nCells > 2500 && m.nCells < 6000, `cells ${m.nCells}`);
  near(m.volume, exact, 0.05, "cylinder volume");
  // column-major matrix: rotation of 90 degrees about Y (the axis goes to X) and a translation (5, 6, 7)
  const matrix = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 5, 6, 7, 1];
  const t = buildModel({ bodies: [{ name: "Cyl", ...cylinderMesh(0, 0, 0, 40, 10), matrix, material: steel }], target: 4000 });
  near(t.volume, exact, 0.05, "placed cylinder volume");
  assert.ok(Math.abs(t.bbox[0] - 5) < t.grid.h && Math.abs(t.bbox[3] - 45) < t.grid.h, `bbox ${t.bbox}`);
  assert.ok(Math.abs(t.bbox[1] + 4) < t.grid.h && Math.abs(t.bbox[5] - 17) < t.grid.h, `bbox ${t.bbox}`);
});

test("voxeliser: a plate with a through hole loses the volume of the hole within 10 %", () => {
  const m = buildModel({ bodies: [{ name: "Plate", ...plateWithHole(40, 5, 8), material: steel }], h: 1 });
  const lost = 40 * 40 * 5 - m.volume;            // hole: pi 8^2 x 5 = 1005 mm3
  near(lost, Math.PI * 64 * 5, 0.1, "hole volume");
  assert.equal(m.cells[20 + 40 * (20 + 40 * 2)], -1, "the centre of the hole is empty");
  const auto = buildModel({ bodies: [{ name: "Plate", ...plateWithHole(40, 5, 8), material: steel }] });
  assert.ok(auto.nCells > 2000 && auto.nCells < 8000, `default target gives ${auto.nCells} cells`);
  assert.ok(Math.abs(auto.grid.nz * auto.grid.h - 5) < 1e-9 && auto.grid.nz >= 2, "the thickness is divided exactly, 2 cells or more");
});

test("voxeliser: two touching boxes of different materials share nodes and keep their body index", () => {
  const m = buildModel({ bodies: [{ name: "A", ...boxMesh(0, 0, 0, 50, 10, 10), material: alu }, { name: "B", ...boxMesh(50, 0, 0, 100, 10, 10), material: poor }], h: 5 });
  assert.equal(m.nCells, 80);
  assert.equal(m.nNodes, 21 * 3 * 3);             // 189 shared, not 2 x 99 = 198
  assert.deepEqual(m.bodies.map((b) => b.cells), [40, 40]);
  assert.deepEqual(m.bodies.map((b) => b.volume), [5000, 5000]);
  for (let e = 0; e < m.nCells; e++) {
    const x = m.grid.origin[0] + (m.elemCell[e] % m.grid.nx + 0.5) * m.grid.h;
    assert.equal(m.elemBody[e], x < 50 ? 0 : 1);
  }
  assert.equal(selectNodes(m, { face: "+X", body: "A" }).length, 9);   // the interface x = 50
  assert.equal(m.nodes[3 * selectNodes(m, { face: "+X", body: "A" })[0]], 50);
  assert.throws(() => buildModel({ bodies: [{ name: "Sheet", pos: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0]), idx: new Uint32Array([0, 1, 2, 0, 2, 3]), material: steel }], h: 2 }), /Maillage vide/);
});

test("element matrices: symmetric, no force under rigid motion, exact uniform strain, heat matrix sums to zero", () => {
  const h = 2, { K, S } = structureElement(h, 210000, 0.3), corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const times = (M, rows, u) => Array.from({ length: rows }, (_, i) => u.reduce((s, v, j) => s + M[24 * i + j] * v, 0));
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) assert.ok(Math.abs(K[24 * i + j] - K[24 * j + i]) < 1e-6);
  const translation = corners.flatMap(() => [1, 0, 0]), rotation = corners.flatMap(([x, y]) => [-y * h, x * h, 0]);   // about Z
  for (const f of [...times(K, 24, translation), ...times(K, 24, rotation)]) assert.ok(Math.abs(f) < 1e-6, `rigid motion force ${f}`);
  // uniform strain exx = 1e-3 with free lateral contraction (-nu exx): sigma_xx = E exx = 210 MPa at every corner, nothing else
  const u = corners.flatMap(([x, y, z]) => [1e-3 * x * h, -0.3e-3 * y * h, -0.3e-3 * z * h]), sigma = times(S, 48, u);
  for (let c = 0; c < 8; c++) {
    near(sigma[6 * c], 210, 1e-9, "sigma_xx");
    for (let r = 1; r < 6; r++) assert.ok(Math.abs(sigma[6 * c + r]) < 1e-7);
  }
  const C = conductionElement(h);
  for (let a = 0; a < 8; a++) assert.ok(Math.abs(C.subarray(8 * a, 8 * a + 8).reduce((s, v) => s + v, 0)) < 1e-12);
  near(C[0], h / 3, 1e-12, "conduction diagonal");   // known value of the trilinear cube: k h / 3
});

test("regions: face, box, near, exposed area and normal; section properties", () => {
  const m = bar(5);
  const tip = selectNodes(m, { face: "+X" });
  assert.equal(tip.length, 9);
  assert.ok(tip.every((i, k) => m.nodes[3 * i] === 100 && (k === 0 || i > tip[k - 1])), "sorted nodes on x = 100");
  const info = regionInfo(m, { face: "+X" });
  assert.deepEqual([info.count, info.area, info.normal, info.centroid], [9, 100, [1, 0, 0], [100, 5, 5]]);   // 10 x 10 mm2
  assert.equal(regionInfo(m, { face: "-Z" }).area, 1000);
  assert.deepEqual(regionInfo(m, { face: "-Z" }).normal, [0, 0, -1]);
  assert.equal(selectNodes(m, { box: [50, 0, 0, 50, 10, 10] }).length, 9);
  assert.equal(selectNodes(m, { near: [51, 4, 11], r: 0 }).length, 1);
  assert.deepEqual(Array.from(m.nodes.subarray(3 * selectNodes(m, { near: [51, 4, 11], r: 0 })[0]).subarray(0, 3)), [50, 5, 10]);
  assert.equal(regionInfo(m, { near: [50, 5, 10], r: 0 }).normal, null);
  const s = sectionAt(m, 0, 50);                  // 10 x 10 section: A = 100, I = 10^4 / 12 = 833.3, c = 5
  assert.deepEqual([s.area, s.centroid, s.ca, s.cb, s.size, s.cells], [100, [5, 5], 5, 5, [10, 10], 4]);
  near(s.Ia, 833.333, 1e-5, "Ia"); near(s.Ib, 833.333, 1e-5, "Ib");
  const flat = sectionAt(m, 2, 2);                // 100 x 10 layer: I about the X axis = 100 x 10^3 / 12, about Y = 10 x 100^3 / 12
  near(flat.Ia, 8333.33, 1e-5, "Ia of the plan section"); near(flat.Ib, 833333.3, 1e-5, "Ib of the plan section");
});

test("structure: bar in tension, sigma = F / A and delta = F L / (E A)", () => {
  const m = bar(5), F = 1000;
  const r = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [F, 0, 0] }] });
  const sigma = mean(r.vm, selectNodes(m, { box: [50, 0, 0, 50, 10, 10] }));
  const delta = mean(r.u, selectNodes(m, { face: "+X" }), 3, 0);
  near(sigma, 10, 0.01, "axial stress");                    // 1000 N / 100 mm2 = 10 MPa
  near(delta, (F * 100) / (210000 * 100), 0.03, "elongation");   // 1000 x 100 / (210000 x 100) = 0.004762 mm
  near(r.reaction[0], -F, 1e-3, "reaction");
  near(r.energy, 0.5 * F * delta, 1e-3, "strain energy = work of the load");
  assert.equal(r.dofs, 3 * (m.nNodes - 9));
});

// Cantilever 100 x 10 x 10, steel, F = 100 N at the tip: I = 10 x 10^3 / 12 = 833.3 mm4, G = 210000 / 2.6 = 80769 MPa
//   bending F L^3 / (3 E I) = 1e8 / 5.25e8 = 0.1905 mm, shear 6 F L / (5 G A) = 0.0015 mm, total 0.1920 mm
//   stress on the outer fibre at mid-length: 6 F (L - x) / (b h^2) = 6 x 100 x 50 / 1000 = 30 MPa
const beamDeflection = (100 * 100 ** 3) / (3 * 210000 * (10 ** 4 / 12)) + (6 * 100 * 100) / (5 * (210000 / 2.6) * 100);

function cantilever(h, force, axis) {
  const m = bar(h), r = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force }], tol: 1e-9 });
  return { m, r, tip: mean(r.u, selectNodes(m, { face: "+X" }), 3, axis) };
}

test("structure: cantilever with 2 x 2 cells in the section (h = 5) within 5 %", () => {
  const { m, r, tip } = cantilever(5, [0, 0, -100], 2);
  near(-tip, beamDeflection, 0.05, "tip deflection");
  near(r.vm[selectNodes(m, { near: [50, 5, 10], r: 0 })[0]], 30, 0.1, "bending stress at mid-length");
  near(r.reaction[2], 100, 1e-3, "reaction");
  assert.ok(Math.abs(r.reaction[0]) < 1e-3 && Math.abs(r.reaction[1]) < 1e-3);
  assert.equal(m.nodes[3 * r.maxU.node], 100, "largest displacement at the tip");
  assert.ok(m.nodes[3 * r.maxVm.node] <= 5, "largest stress next to the clamp");
  assert.equal(r.vmElem.length, m.nCells);
  console.log(`  cantilever h = 5: tip ${(-tip).toFixed(4)} mm vs ${beamDeflection.toFixed(4)}, stress ${r.vm[selectNodes(m, { near: [50, 5, 10], r: 0 })[0]].toFixed(2)} MPa vs 30, ${r.iterations} iterations`);
});

test("structure: cantilever with ONE cell through the thickness (h = 10) within 8 % — incompatible modes", () => {
  const { m, r, tip } = cantilever(10, [0, 0, -100], 2);
  assert.equal(m.nCells, 10);
  near(-tip, beamDeflection, 0.08, "tip deflection");
  near(r.vm[selectNodes(m, { near: [50, 0, 10], r: 0 })[0]], 30, 0.1, "bending stress at mid-length");
  near(r.reaction[2], 100, 1e-3, "reaction");
  console.log(`  cantilever h = 10: tip ${(-tip).toFixed(4)} mm vs ${beamDeflection.toFixed(4)}, stress ${r.vm[selectNodes(m, { near: [50, 0, 10], r: 0 })[0]].toFixed(2)} MPa vs 30, ${r.iterations} iterations`);
});

test("structure: the same beam loaded along +Y deflects as much (isotropy of the element)", () => {
  const z = cantilever(5, [0, 0, -100], 2), y = cantilever(5, [0, 100, 0], 1);
  near(y.tip, -z.tip, 1e-5, "deflection along Y");
  near(y.r.maxVm.value, z.r.maxVm.value, 1e-4, "largest stress");
});

test("structure: pressure pushes into the material, gravity uses the density", () => {
  const m = bar(5);
  const p = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, pressure: 10 }] });
  near(p.reaction[0], 1000, 1e-3, "reaction to 10 MPa on 100 mm2");                        // the support pushes back along +X
  near(mean(p.u, selectNodes(m, { face: "+X" }), 3, 0), -1000 * 100 / (210000 * 100), 0.03, "shortening");   // -F L / (E A)
  const g = solveStructure(m, { fixed: [{ face: "-X" }], gravity: [0, 0, -9.81] });
  near(g.reaction[2], 7850 * 1e-5 * 9.81, 1e-3, "weight");                                 // 7850 kg/m3 x 1e-5 m3 x 9.81 = 0.770 N
  // uniform load w = 0.0077 N/mm: tip deflection w L^4 / (8 E I) = 5.5e-4 mm (plus a little shear)
  near(-mean(g.u, selectNodes(m, { face: "+X" }), 3, 2), (0.770085 / 100) * 1e8 / (8 * 210000 * 833.333), 0.05, "sag under its own weight");
});

test("structure: clamped square plate under pressure with ONE cell through the thickness", () => {
  const m = buildModel({ bodies: [{ name: "Plate", ...boxMesh(0, 0, 0, 100, 100, 5), material: steel }], h: 5 });
  const r = solveStructure(m, { fixed: [{ face: "-X" }, { face: "+X" }, { face: "-Y" }, { face: "+Y" }], loads: [{ region: { face: "+Z" }, pressure: 0.1 }] });
  // thin-plate theory: D = E t^3 / (12 (1 - nu^2)) = 2.404e6 N.mm, w = 0.00126 q a^4 / D = 0.00524 mm (shear adds a few %)
  // edge stress 0.3078 q a^2 / t^2 = 12.3 MPa with sigma_y = nu sigma_x -> von Mises 12.3 x sqrt(1 - nu + nu^2) = 10.9 MPa
  const D = (210000 * 5 ** 3) / (12 * (1 - 0.09)), w = (0.00126 * 0.1 * 100 ** 4) / D, vm = ((0.3078 * 0.1 * 100 ** 2) / 25) * Math.sqrt(1 - 0.3 + 0.09);
  near(r.maxU.value, w, 0.1, "centre deflection");
  assert.deepEqual(r.maxU.at.slice(0, 2), [50, 50]);
  assert.ok(r.maxVm.value > 0.8 * vm && r.maxVm.value < 1.1 * vm, `edge stress ${r.maxVm.value} vs ${vm}: 80 % of reality or better`);
  near(r.reaction[2], 0.1 * 100 * 100, 1e-3, "reaction = q a^2 = 1000 N");
  console.log(`  clamped plate, 1 cell thick: w ${r.maxU.value.toFixed(5)} mm vs ${w.toFixed(5)}, von Mises ${r.maxVm.value.toFixed(2)} MPa vs ${vm.toFixed(2)}`);
});

test("thermal: 1-D conduction, T = T0 + P L / (k A), linear profile, balance", () => {
  const m = bar(5, alu);                           // k = 200 W/m.K, A = 1e-4 m2, L = 0.1 m
  const r = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }] });
  const hot = mean(r.T, selectNodes(m, { face: "+X" })), mid = mean(r.T, selectNodes(m, { box: [50, 0, 0, 50, 10, 10] }));
  near(hot, 70, 0.01, "hot end");                  // 20 + 10 x 0.1 / (200 x 1e-4) = 70 degrees C
  near(mid, 45, 0.01, "mid-length");               // linear profile
  near(mean(r.T, selectNodes(m, { box: [25, 0, 0, 25, 10, 10] })), 32.5, 0.01, "quarter length");
  near(r.balance.out, r.balance.in, 0.01, "heat balance");
  assert.equal(r.balance.in, 10);
  assert.equal(r.minT.value, 20);
  assert.equal(m.nodes[3 * r.maxT.node], 100);
  console.log(`  thermal bar: hot end ${hot.toFixed(2)} C vs 70, mid ${mid.toFixed(2)} vs 45, out ${r.balance.out.toFixed(4)} W vs 10, ${r.iterations} iterations`);
});

test("thermal: block cooled by convection, mean T = Tamb + P / (h A)", () => {
  const m = buildModel({ bodies: [{ name: "Block", ...boxMesh(0, 0, 0, 40, 40, 10), material: alu }], h: 2.5 });
  const r = solveThermal(m, { power: [{ region: { face: "-Z" }, P: 5 }], convection: [{ region: "exterior", h: 10, Tamb: 25 }] });
  // exposed area 2 x 40 x 40 + 4 x 40 x 10 = 4800 mm2 = 0.0048 m2 -> 25 + 5 / (10 x 0.0048) = 129.2 degrees C
  const expected = 25 + 5 / (10 * 0.0048), all = Array.from({ length: m.nNodes }, (_, i) => i);
  near(mean(r.T, all), expected, 0.03, "mean temperature");
  assert.ok(r.maxT.value - r.minT.value < 2, `spread ${r.maxT.value - r.minT.value} K (tiny Biot number)`);
  near(r.balance.out, 5, 0.01, "heat balance");
  // convection on one face only: 1600 mm2 -> 25 + 5 / (10 x 0.0016) = 337.5 degrees C
  const one = solveThermal(m, { power: [{ region: { face: "-Z" }, P: 5 }], convection: [{ region: { face: "+Z" }, h: 10, Tamb: 25 }] });
  near(mean(one.T, selectNodes(m, { face: "+Z" })), 25 + 5 / (10 * 0.0016), 0.01, "one cooled face");
  console.log(`  convection block: mean ${mean(r.T, all).toFixed(2)} C vs ${expected.toFixed(2)}, spread ${(r.maxT.value - r.minT.value).toFixed(3)} K, ${r.iterations} iterations`);
});

test("thermal: two materials in series, interface and end temperatures from the resistances", () => {
  const m = buildModel({ bodies: [{ name: "A", ...boxMesh(0, 0, 0, 50, 10, 10), material: alu }, { name: "B", ...boxMesh(50, 0, 0, 100, 10, 10), material: poor }], h: 5 });
  const r = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }] });
  // R1 = 0.05 / (200 x 1e-4) = 2.5 K/W, R2 = 0.05 / (20 x 1e-4) = 25 K/W -> interface 20 + 25 = 45, end 45 + 250 = 295 degrees C
  near(mean(r.T, selectNodes(m, { face: "+X", body: "A" })), 45, 0.02, "interface");
  near(mean(r.T, selectNodes(m, { face: "+X" })), 295, 0.02, "end");
  near(r.balance.out, 10, 0.01, "heat balance");
});

// ---- Thermal expansion (thermo-mechanical loading) and supports per direction ----
const alu23 = { name: "Aluminium 6061", E: 69000, nu: 0.33, k: 200, rho: 2700, Re: 240, alpha: 23e-6 };
/** Sliding plane: the nodes of a model face are held along one axis only (0 = X, 1 = Y, 2 = Z). */
const slide = (face, axis) => ({ region: { face }, dofs: [axis === 0, axis === 1, axis === 2] });
const threePlanes = [slide("-X", 0), slide("-Y", 1), slide("-Z", 2)];
const strip = (x, y, z, h, material = alu23) => buildModel({ bodies: [{ name: "Strip", ...boxMesh(0, 0, 0, x, y, z), material }], h });
const nodeAt = (m, x, y, z) => selectNodes(m, { near: [x, y, z], r: 0 })[0];

test("supports per direction: three sliding planes make an exact patch test in tension", () => {
  const m = bar(5), r = solveStructure(m, { fixed: threePlanes, loads: [{ region: { face: "+X" }, pressure: -10 }], tol: 1e-10 });
  // uniform traction of 10 MPa on 100 mm2: sigma = 10 MPa everywhere, delta = sigma L / E = 10 x 100 / 210000 = 0.0047619 mm
  assert.ok(Math.abs(Math.min(...r.vm) - 10) < 1e-4 && Math.abs(Math.max(...r.vm) - 10) < 1e-4, `stress ${Math.min(...r.vm)} .. ${Math.max(...r.vm)}`);
  near(mean(r.u, selectNodes(m, { face: "+X" }), 3, 0), 1000 / 210000, 1e-5, "elongation");
  near(mean(r.u, selectNodes(m, { face: "+Y" }), 3, 1), (-0.3 * 10 * 10) / 210000, 1e-5, "lateral contraction -nu sigma b / E");
  near(r.reactions[0][0], -1000, 1e-6, "reaction of the X plane");
  assert.ok(Math.abs(r.reactions[1][1]) < 1e-5 && Math.abs(r.reactions[2][2]) < 1e-5, "the other planes carry nothing");
  assert.equal(r.dofs, 3 * m.nNodes - 9 - 63 - 63);   // one dof per node of each plane
  assert.equal(r.thermal, undefined);
});

test("thermal expansion: free uniform heating expands by alpha dT L and makes no stress", () => {
  const m = strip(40, 20, 10, 5), r = solveStructure(m, { fixed: threePlanes, thermal: { T: 120, Tref: 20 }, tol: 1e-10 });
  const grow = [0, 1, 2].map((d) => mean(r.u, selectNodes(m, { face: "+" + "XYZ"[d] }), 3, d));
  near(grow[0], 0.092, 0.005, "u_x");            // 23e-6 x 100 K x 40 mm = 0.092 mm
  near(grow[1], 0.046, 0.005, "u_y");            // 23e-6 x 100 x 20 = 0.046 mm
  near(grow[2], 0.023, 0.005, "u_z");            // 23e-6 x 100 x 10 = 0.023 mm
  assert.ok(r.maxVm.value < 0.5, `free expansion stress ${r.maxVm.value} MPa`);
  assert.ok(Math.abs(r.energy) < 1e-3 && Math.hypot(...r.reaction) < 1e-3, `energy ${r.energy} N.mm, reaction ${r.reaction}`);
  assert.equal(r.thermal, true);
  console.log(`  free heating: u = ${grow.map((v) => v.toFixed(5)).join(", ")} mm vs 0.092, 0.046, 0.023; max von Mises ${r.maxVm.value.toExponential(1)} MPa`);
});

test("thermal expansion: bar restrained along X, sigma = -E alpha dT", () => {
  const m = strip(100, 10, 10, 5), fixed = [slide("-X", 0), slide("+X", 0), slide("-Y", 1), slide("-Z", 2)];
  const r = solveStructure(m, { fixed, thermal: { T: 120 }, tol: 1e-10 });   // Tref defaults to 20
  const sigma = 69000 * 23e-6 * 100;            // 158.7 MPa (compression), lateral expansion free -> von Mises = 158.7 MPa
  near(Math.min(...r.vm), sigma, 0.01, "lowest von Mises"); near(Math.max(...r.vm), sigma, 0.01, "largest von Mises");
  near(r.reactions[0][0], sigma * 100, 0.01, "reaction of the -X face");   // E alpha dT A = 15870 N, the wall pushes along +X
  near(r.reactions[1][0], -sigma * 100, 0.01, "reaction of the +X face");
  assert.ok(Math.abs(r.reaction[0]) < 1e-3, "the two walls balance");
  near(mean(r.u, selectNodes(m, { face: "+Y" }), 3, 1), 1.33 * 23e-6 * 100 * 10, 0.01, "lateral growth (1 + nu) alpha dT b");
  near(r.energy, (sigma * sigma * 10000) / (2 * 69000), 0.01, "elastic energy sigma^2 V / (2 E) = 1825 N.mm");
  console.log(`  restrained bar: von Mises ${Math.min(...r.vm).toFixed(2)} .. ${Math.max(...r.vm).toFixed(2)} MPa vs ${sigma.toFixed(1)}, reaction ${r.reactions[0][0].toFixed(1)} N vs ${(sigma * 100).toFixed(0)}`);
});

test("thermal expansion: a temperature difference through the thickness bends a free strip, kappa = alpha dT / t", () => {
  // Supports that leave the strip free to bend: the -X face slides in its plane (X held), the -Y face slides in its plane
  // (Y held), and Z is held on the single node at the origin. The free solution has u_x = 0 on x = 0 and u_y = 0 on y = 0.
  const fixed = [slide("-X", 0), slide("-Y", 1), { region: { near: [0, 0, 0], r: 0 }, dofs: [false, false, true] }];
  for (const h of [5, 2.5]) {                    // ONE cell through the thickness, then two
    const m = strip(100, 10, 5, h), T = Float32Array.from({ length: m.nNodes }, (_, i) => 20 + (100 * m.nodes[3 * i + 2]) / 5);
    const r = solveStructure(m, { fixed, thermal: { T, Tref: 20 }, tol: 1e-10 });
    const end = r.u[3 * nodeAt(m, 100, 0, 0) + 2];
    near(end, -2.3, 0.05, `end deflection, h = ${h}`);   // kappa = 23e-6 x 100 / 5 = 4.6e-4 /mm, kappa L^2 / 2 = 2.3 mm (hot side convex)
    assert.ok(r.maxVm.value < 0.05 * 158.7, `stress ${r.maxVm.value} MPa: free bending makes none`);
    assert.ok(Math.abs(r.energy) < 1e-3, `elastic energy ${r.energy} N.mm`);
    console.log(`  thermal bending h = ${h}: end ${end.toFixed(5)} mm vs -2.3, max von Mises ${r.maxVm.value.toExponential(1)} MPa`);
  }
});

test("thermal expansion: bimetal strip, Timoshenko curvature 1.5 (alpha1 - alpha2) dT / t", () => {
  const metal = (alpha) => ({ name: "Metal", E: 100000, nu: 0.3, k: 50, rho: 8000, Re: null, alpha });
  const m = buildModel({ bodies: [{ name: "Bottom", ...boxMesh(0, 0, 0, 100, 10, 2.5), material: metal(20e-6) }, { name: "Top", ...boxMesh(0, 0, 2.5, 100, 10, 5), material: metal(10e-6) }], h: 2.5 });
  const r = solveStructure(m, { fixed: [{ face: "-X" }], thermal: { T: 120, Tref: 20 } });
  const tip = mean(r.u, selectNodes(m, { face: "+X" }), 3, 2);
  near(tip, 1.5, 0.08, "tip deflection");        // kappa = 1.5 x 10e-6 x 100 / 5 = 3.0e-4 /mm, kappa L^2 / 2 = 1.5 mm, towards the low-expansion layer
  // stress at the interface, away from the clamp: E (alpha1 - alpha2) dT / 2 = 50 MPa for a narrow beam (uniaxial), and
  // 50 / (1 - nu) = 71.4 MPa for a plate that curves both ways (biaxial); this strip is 10 wide for 5 thick: in between
  const bond = r.vm[nodeAt(m, 50, 5, 2.5)];
  assert.ok(bond >= 0.98 * 50 && bond <= 1.02 * 71.43, `interface stress ${bond} MPa, expected between 50 and 71.4`);
  assert.ok(m.nodes[3 * r.maxVm.node] <= 2.5, "the largest stress is at the clamp, where the expansion is blocked");
  console.log(`  bimetal: tip ${tip.toFixed(4)} mm vs 1.5, interface von Mises ${bond.toFixed(2)} MPa (beam 50, plate 71.4), ${r.maxVm.value.toFixed(0)} MPa at the clamp`);
});

test("thermal expansion: the field of solveThermal drives solveStructure", () => {
  const m = strip(100, 10, 10, 5);
  const heat = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }] });
  const r = solveStructure(m, { fixed: threePlanes, thermal: { T: heat.T, Tref: 20 } });
  // T goes linearly from 20 to 70: growth = alpha x mean rise x L = 23e-6 x 25 x 100 = 0.0575 mm
  const grow = mean(r.u, selectNodes(m, { face: "+X" }), 3, 0);
  near(grow, 0.0575, 0.03, "expansion of the heated bar");
  console.log(`  heated bar: growth ${grow.toFixed(5)} mm vs 0.0575, max von Mises ${r.maxVm.value.toFixed(2)} MPa`);
});

test("thermal expansion: backward compatibility and superposition with a mechanical load", () => {
  const m = strip(100, 10, 10, 5), fixed = [{ face: "-X" }], loads = [{ region: { face: "+X" }, force: [0, 0, -100] }], tol = 1e-12;
  const T = Float32Array.from({ length: m.nNodes }, (_, i) => 20 + 0.6 * m.nodes[3 * i] + 4 * m.nodes[3 * i + 2]);
  const mech = solveStructure(m, { fixed, loads, tol }), heat = solveStructure(m, { fixed, thermal: { T }, tol }), both = solveStructure(m, { fixed, loads, thermal: { T }, tol });
  for (const i of selectNodes(m, { face: "-X" })) assert.deepEqual(Array.from(both.u.subarray(3 * i, 3 * i + 3)), [0, 0, 0]);   // a plain region holds x, y, z
  assert.equal(both.dofs, 3 * (m.nNodes - 9));
  let gap = 0;
  for (let i = 0; i < both.u.length; i++) gap = Math.max(gap, Math.abs(both.u[i] - (mech.u[i] + heat.u[i])));
  assert.ok(gap <= 1e-6 * both.maxU.value, `superposition gap ${gap} mm on ${both.maxU.value} mm`);
  near(both.reaction[2], 100, 1e-6, "the thermal load adds no net reaction");
  assert.deepEqual(both.reactions.length, 1);
  // no alpha, or alpha = 0: the thermal load does nothing
  const cold = solveStructure(bar(5), { fixed, loads, thermal: { T: 300 }, tol }), plain = solveStructure(bar(5), { fixed, loads, tol });
  assert.deepEqual(Array.from(cold.u), Array.from(plain.u));
});

test("errors are in French and say what to fix", () => {
  const m = bar(10), load = [{ region: { face: "+X" }, force: [0, 0, -100] }];
  assert.throws(() => solveStructure(m, { loads: load }), /appui/);
  assert.throws(() => solveStructure(m, { fixed: [{ box: [500, 500, 500, 510, 510, 510] }], loads: load }), /boîte \[500, 500, 500, 510, 510, 510\].*aucun nœud/);
  assert.throws(() => solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X", body: "Ghost" }, force: [1, 0, 0] }] }), /Ghost/);
  assert.throws(() => solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { near: [50, 5, 10], r: 1 }, pressure: 1 }] }), /aucune face/);
  assert.throws(() => solveThermal(m, { power: [{ region: { face: "+X" }, P: 1 }] }), /Température indéfinie/);
  assert.throws(() => solveThermal(m, { fixedT: [{ region: { face: "*" }, T: 20 }] }), /Face inconnue/);
  // two parts that do not touch: the second one has no support and no heat path
  const two = buildModel({ bodies: [{ name: "Held", ...boxMesh(0, 0, 0, 20, 10, 10), material: steel }, { name: "Loose", ...boxMesh(40, 0, 0, 60, 10, 10), material: steel }], h: 5 });
  assert.throws(() => solveStructure(two, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -1] }] }), /Loose.*appui/);
  assert.throws(() => solveThermal(two, { fixedT: [{ region: { face: "-X" }, T: 20 }] }), /Loose/);
  // supports on a single line of nodes leave a hinge: refused before solving
  assert.throws(() => solveStructure(m, { fixed: [{ box: [0, 0, 0, 0, 10, 0] }], loads: load }), /ligne de nœuds.*pivoter/);
  assert.throws(() => solveStructure(m, { fixed: [{ near: [0, 0, 0], r: 0 }], loads: load }), /un seul nœud/);
  // two cubes that touch along one edge only: an internal hinge, the solver cannot converge and says so
  const hinge = buildModel({ bodies: [{ name: "Base", ...boxMesh(0, 0, 0, 10, 10, 10), material: steel }, { name: "Flap", ...boxMesh(10, 0, 10, 20, 10, 20), material: steel }], h: 5 });
  assert.throws(() => solveStructure(hinge, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -10] }], maxIter: 300 }), /pas convergé.*arête/);
});

test("errors of the supports per direction and of the thermal load", () => {
  const m = strip(100, 10, 10, 5), thermal = { T: 120 };
  // one sliding plane: the part still slides in the plane and spins about its normal
  assert.throws(() => solveStructure(m, { fixed: [slide("-X", 0)], thermal }), /Strip.*peut encore glisser le long de Y et Z.*pivoter autour d'un axe parallèle à X/);
  // two planes: it still slides along Z; X and Y held on one face: it still spins about X
  assert.throws(() => solveStructure(m, { fixed: [slide("-X", 0), slide("-Y", 1)], thermal }), /peut encore glisser le long de Z\./);
  assert.throws(() => solveStructure(m, { fixed: [{ region: { face: "-Z" }, dofs: [false, false, true] }, { region: { near: [0, 0, 0], r: 0 }, dofs: [true, true, false] }], thermal }), /peut encore pivoter autour d'un axe parallèle à Z\./);
  assert.throws(() => solveStructure(m, { fixed: [{ region: { face: "-X" }, dofs: [true, false] }], thermal }), /dofs/);
  assert.doesNotThrow(() => solveStructure(m, { fixed: threePlanes, thermal }));
  assert.throws(() => solveStructure(m, { fixed: threePlanes, thermal: { T: new Float32Array(m.nNodes - 1) } }), /température par nœud \(189 valeurs attendues, 188 reçues\)/);
  assert.throws(() => solveStructure(m, { fixed: threePlanes, thermal: {} }), /Charge thermique invalide/);
});

test("performance and skin: a 4000-cell cantilever solves in well under 5 s", () => {
  const m = buildModel({ bodies: [{ name: "Beam", ...boxMesh(0, 0, 0, 100, 10, 10), material: steel }], target: 4000 });
  assert.ok(m.nCells > 3000 && m.nCells < 5000, `cells ${m.nCells}`);
  let calls = 0;
  const r = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, () => calls++);
  console.log(`  ${m.nCells} cells, ${r.dofs} dofs: ${r.iterations} iterations, residual ${r.residual.toExponential(1)}, ${r.ms.toFixed(0)} ms`);
  assert.ok(r.ms < 5000, `solve time ${r.ms} ms`);
  assert.ok(r.residual <= 1e-6 && calls === Math.floor(r.iterations / 50));
  near(r.maxU.value, beamDeflection, 0.03, "tip deflection of the fine beam");
  const t = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 20 }], power: [{ region: { face: "+X" }, P: 10 }] });
  console.log(`  thermal on the same mesh: ${t.iterations} iterations, ${t.ms.toFixed(0)} ms`);
  assert.ok(t.ms < 5000);

  const s = skin(m, r.vm, { u: r.u, scale: 10 }), flat = skin(m, null);
  const faces = 2 * (70 * 7 + 70 * 7 + 7 * 7);    // 70 x 7 x 7 cells: exposed faces of the box
  assert.equal(s.faces, faces);
  assert.deepEqual([s.pos.length, s.idx.length, s.val.length], [12 * faces, 6 * faces, 4 * faces]);
  assert.equal(s.epos.length % 6, 0);
  assert.equal(s.epos.length / 6, 2 * faces);     // a closed quad surface has twice as many edges as faces
  assert.ok(flat.val.every((v) => v === 0) && Math.max(...s.val) > 0);
  // outward winding: the summed signed volume of the triangles equals the volume of the mesh
  let six = 0;
  for (let k = 0; k < flat.idx.length; k += 3) {
    const [a, b, c] = [0, 1, 2].map((q) => flat.pos.subarray(3 * flat.idx[k + q], 3 * flat.idx[k + q] + 3));
    six += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  near(six / 6, m.volume, 1e-4, "volume enclosed by the skin");
  assert.ok(Math.abs(Math.min(...s.pos.filter((_, k) => k % 3 === 2)) + 10 * r.maxU.value) < 0.05, "the skin follows the displacement");
});
