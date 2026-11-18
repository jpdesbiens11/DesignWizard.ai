/* Refinement zones of the Simulation : what a zone is (refine.js) and the model solved with its zones as one mesh (composite.js). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, solveStructure, solveThermal, skin } from "../../web/js/analysis/fea/index.js";
import { exposedFaces } from "../../web/js/analysis/fea/voxel.js";
import { reduceModel } from "../../web/js/analysis/fea/symmetry.js";
import { ZONE_SHAPES, ZONE_RATIOS, ZONE_MAX_CELLS, normZone, inZone, zoneBox, zoneOutline, zoneText, zoneBlock, prepareZone, prepareZones, localRegion, zoneIssues } from "../../web/js/analysis/fea/refine.js";
import { outsideModel, solveComposite, compositeSkin, onModel, peakOf, blockPeak } from "../../web/js/analysis/fea/composite.js";
import { simulationSummary } from "../../web/js/analysis/fea/summary.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { METHODS } from "../../web/js/core/methods.js";
import { glossary } from "../../web/js/core/terms.js";

const steel = { name: "Steel", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 250, alpha: 12e-6 };
function boxMesh(x0, y0, z0, x1, y1, z1) {
  return { pos: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), idx: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) };
}
/** Plate sx × sy, thickness t, centred on the Z axis (z from 0 to t), with a through hole of radius r. */
function plateWithHole(sx, sy, t, r, n = 96) {
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n, c = Math.cos(a), s = Math.sin(a), k = Math.min(sx / 2 / Math.max(1e-9, Math.abs(c)), sy / 2 / Math.max(1e-9, Math.abs(s))); pos.push(r * c, r * s, 0, r * c, r * s, t, k * c, k * s, 0, k * c, k * s, t); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, cb = 4 * i, ct = cb + 1, sb = cb + 2, st = cb + 3, cb2 = 4 * j, ct2 = cb2 + 1, sb2 = cb2 + 2, st2 = cb2 + 3; idx.push(ct, st, st2, ct, st2, ct2, cb, sb2, sb, cb, cb2, sb2); idx.push(sb, sb2, st2, sb, st2, st, cb, ct2, cb2, cb, ct, ct2); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const slide = (face, axis) => ({ region: { face }, dofs: [axis === 0, axis === 1, axis === 2] });
const near = (actual, expected, rel, label) => assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${label}: ${actual} vs ${expected} (tolerance ${rel * 100} %)`);
const barBodies = [{ name: "Bar", ...boxMesh(0, 0, 0, 100, 10, 10), material: steel }];
const zone = (o) => ({ id: "Z1", shape: "cylinder", axis: 2, size: 10, length: 10, at: [0, 0, 0], ratio: 2, ...o });
/** The model with its zones, solved as one mesh ; a zone that cannot be prepared fails the test. */
function composite(kind, model, bodies, zones, load) {
  const preps = prepareZones(model, bodies, zones); for (const p of preps) assert.ok(p.prep, p.error);
  return solveComposite(kind, model, preps.map((p) => p.prep), load);
}
const peakNear = (m, vm, R) => { let b = 0; for (let i = 0; i < m.nNodes; i++) if (Math.hypot(m.nodes[3 * i], m.nodes[3 * i + 1]) <= R && vm[i] > b) b = vm[i]; return b; };

test("zone — its shape : a cylinder or a square prism along X, Y or Z, with its box and its outline", () => {
  const c = zone({ axis: 0, size: 8, length: 20, at: [50, 5, 5] }), p = { ...c, shape: "prism" };
  assert.ok(inZone(c, [50, 5, 5]) && inZone(c, [59.9, 5, 8.9]) && !inZone(c, [60.1, 5, 5]) && !inZone(c, [50, 8, 8]), "a cylinder : inside its radius, between its two ends");
  assert.ok(inZone(p, [50, 8.9, 8.9]) && !inZone(p, [50, 9.1, 5]), "a prism : the corner of its square is inside"); assert.ok(inZone(c, [60.4, 5, 5], 0.5), "grown by half a cube");
  assert.deepEqual(zoneBox(c), [40, 1, 1, 60, 9, 9]);
  const oc = zoneOutline(c, 16), op = zoneOutline(p); assert.equal(oc.loops.length, 2); assert.equal(oc.loops[0].length, 17, "a closed loop"); assert.equal(op.loops[0].length, 5); assert.equal(oc.lines.length, 4);
  for (const q of oc.loops[0]) { assert.equal(q[0], 40); near(Math.hypot(q[1] - 5, q[2] - 5), 4, 1e-9, "on the circle"); } assert.deepEqual(op.lines[0], [[40, 1, 1], [60, 1, 1]]);
  assert.equal(zoneText(c), "Cylindre ⌀ 8 × 20 mm, axe X"); assert.equal(zoneText({ ...p, size: 2.5 }), "Prisme carré □ 2,5 × 20 mm, axe X");
  assert.equal(normZone({ ...c, ratio: 7 }).ratio, 2, "an unknown fineness falls back on twice finer"); assert.deepEqual(ZONE_RATIOS, [2, 3, 4]); assert.ok(ZONE_SHAPES.cylinder.en && ZONE_SHAPES.prism.en);
  for (const bad of [null, { ...c, shape: "sphere" }, { ...c, axis: 3 }, { ...c, size: 0 }, { ...c, length: -1 }, { ...c, at: [1, 2] }, { ...c, at: [1, NaN, 3] }]) assert.equal(normZone(bad), null);
});

test("zone — the cubes it takes and its fine mesh : whole cubes of the model, cut in ratio³, on the same grid lines", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), z = zone({ shape: "prism", axis: 0, size: 10, length: 20, at: [50, 5, 5] }), block = zoneBlock(model, z);
  assert.equal(block.count, 16, "4 cubes along X, the whole 2 × 2 section"); assert.equal(block.kept, 16); assert.deepEqual([block.lo, block.hi], [[8, 0, 0], [11, 1, 1]]);
  const prep = prepareZone(model, barBodies, z), L = prep.local;
  assert.equal(L.nCells, 128); near(L.grid.h, 2.5, 1e-12, "cube of the zone"); assert.deepEqual(L.grid.origin, [40, 0, 0]);
  assert.equal(prep.bound.nodes.length, 50, "the two ends of the zone, 5 × 5 fine nodes each, are tied to the model"); assert.equal(prep.inner.reduce((s, v) => s + (v === 1), 0), 32, "and their 2 × 16 fine faces are not surfaces of the product");
  for (let k = 0; k < prep.bound.nodes.length; k++) { let sum = 0; for (let c = 0; c < 8; c++) sum += prep.bound.w[8 * k + c]; near(sum, 1, 1e-12, "the weights of a tie"); const x = L.nodes[3 * prep.bound.nodes[k]]; assert.ok(x === 40 || x === 60); }
  assert.ok(prep.weight.every((w) => w === 1)); assert.equal(prep.dropped, 0);
  assert.equal(prepareZone(model, barBodies, { ...z, ratio: 3 }).local.nCells, 16 * 27);
  /* a small zone still takes the cube it sits in ; a zone away from the product, or that takes all of it, says so */
  assert.equal(zoneBlock(model, zone({ axis: 0, size: 1, length: 1, at: [52, 2, 2] })).count, 1);
  assert.throws(() => prepareZone(model, barBodies, zone({ at: [500, 5, 5] })), /hors du maillage/);
  assert.throws(() => prepareZone(model, barBodies, zone({ shape: "prism", axis: 0, size: 40, length: 400, at: [50, 5, 5] })), /rien d'autre ne la porte/);
  assert.throws(() => prepareZone(buildModel({ bodies: barBodies, h: 1 }), barBodies, zone({ shape: "prism", axis: 0, size: 10, length: 60, at: [50, 5, 5], ratio: 4 })), /cubes fins|trop grande/);
  assert.ok(ZONE_MAX_CELLS >= 20000);
  /* two zones : the second takes no cube of the first, nor one that touches it — a cube of the model always stands between them */
  const two = prepareZones(model, barBodies, [z, zone({ id: "Z2", shape: "prism", axis: 0, size: 10, length: 30, at: [65, 5, 5] }), zone({ id: "Z3", at: [900, 0, 0] })]);
  assert.equal(two.length, 3); assert.equal(two[0].prep.block.count, 16); assert.deepEqual(two[1].prep.block.lo, [13, 0, 0], "it starts one cube after the gap"); assert.match(two[2].error, /Z3 est hors du maillage/);
  for (let g = 0; g < model.cells.length; g++) assert.ok(!(two[0].prep.block.mark[g] && two[1].prep.block.mark[g]));
});

test("composite — a bar pulled evenly : every cube, large or small, carries the same stress, and the bar stretches as before", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), load = { fixed: [slide("-X", 0), slide("-Y", 1), slide("-Z", 2)], loads: [{ region: { face: "+X" }, pressure: -10 }] }, plain = solveStructure(model, load);
  for (const zs of [[zone({ shape: "prism", axis: 0, size: 10, length: 20, at: [50, 5, 5] })], [zone({ axis: 0, size: 8, length: 10, at: [97.5, 5, 5], ratio: 3 })], [zone({ shape: "prism", axis: 2, size: 6, length: 30, at: [3, 3, 5] }), zone({ id: "Z2", shape: "prism", axis: 1, size: 4, length: 4, at: [60, 8, 8], ratio: 4 })]]) {
    const c = composite("structure", model, barBodies, zs, load);
    for (const vm of [c.r.vm, ...c.parts.map((p) => p.r.vm)]) for (const v of vm) near(v, 10, 1e-4, "von Mises");
    near(peakOf([c.out, ...c.parts.map((p) => p.prep.local)], [c.r.mag, ...c.parts.map((p) => p.r.mag)]).value, plain.maxU.value, 1e-4, "largest displacement");
    assert.equal(c.out.nCells + c.parts.reduce((s, p) => s + p.prep.block.kept, 0), model.nCells, "the outside is the model without the cubes the zones took");
  }
});

test("composite — a plate with a hole : the zone reads the peak a uniformly fine mesh reads, whatever its size", () => {
  const load = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, pressure: -10 }] };
  for (const [hole, off] of [[4, 0.1], [1, 0.4]]) {      // a hole of three cubes, then one smaller than a cube : the model alone is that far from the fine mesh, at least
    const bodies = [{ name: "Plate", ...plateWithHole(80, 40, 5, hole), material: steel }], model = buildModel({ bodies, h: 2.5 }), plain = solveStructure(model, load), R = 3 * hole + 2.5;
    const fine = buildModel({ bodies, h: 1.25 }), want = peakNear(fine, solveStructure(fine, load).vm, R);
    assert.ok(Math.abs(peakNear(model, plain.vm, R) / want - 1) > off, `hole r ${hole} : the model alone misses the peak (${peakNear(model, plain.vm, R).toFixed(1)} against ${want.toFixed(1)} MPa)`);
    for (const size of [12, 24]) {
      const c = composite("structure", model, bodies, [zone({ size, length: 5, at: [0, 0, 2.5] })], load), got = c.parts[0].r.maxVm.value;
      near(got, want, 0.03, `hole r ${hole}, zone ⌀ ${size}`); assert.ok(c.iterations > 0 && c.residual <= 1e-6 && c.dofs > 0);
      const b = blockPeak(c.parts[0].prep, model, plain.vm); assert.ok(b && b.value > 0 && b.at.length === 3, "what the model alone said on the cubes the zone took");
    }
  }
});

test("composite — a plane of symmetry : half the plate with its zone answers like the whole plate", () => {
  const bodies = [{ name: "Plate", ...plateWithHole(80, 40, 5, 4), material: steel }], cuts = [{ axis: 1, at: 0, keep: 1, bc: "sym" }], z = [zone({ size: 20, length: 5, at: [0, 0, 2.5] })];
  const load = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, pressure: -10 }, { region: { face: "+Z" }, force: [0, 0, -50] }] };
  const whole = buildModel({ bodies, h: 2.5, planes: cuts }), half = reduceModel(whole, cuts), a = composite("structure", whole, bodies, z, load), b = composite("structure", half, bodies, z, load);
  near(b.parts[0].r.maxVm.value, a.parts[0].r.maxVm.value, 1e-3, "peak in the zone"); near(b.r.maxU.value, a.r.maxU.value, 1e-3, "largest displacement");
  assert.equal(b.parts[0].prep.local.nCells * 2, a.parts[0].prep.local.nCells); const pl = b.parts[0].prep.planes[0];
  assert.ok(pl.nodes.length > 0 && pl.bc === "sym"); for (const i of pl.nodes) { assert.equal(b.parts[0].prep.local.nodes[3 * i + 1], 0); assert.equal(b.parts[0].prep.weight[i], 0.5, "a node on the plane counts for half"); }
  assert.ok(b.parts[0].prep.inner.some((v) => v === 2), "the faces of the zone on the plane are not surfaces of the product");
});

test("composite — the load is shared, not counted twice : a zone under a pushed face and against a support changes no reaction", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), F = [0, 0, -120];
  for (const load of [{ fixed: [{ face: "-X" }], loads: [{ region: { face: "+Z" }, force: F }] }, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+Z" }, pressure: 0.12 }] }]) {
    const plain = solveStructure(model, load), z = [zone({ shape: "prism", axis: 2, size: 6, length: 6, at: [70, 7, 8], ratio: 2 })], c = composite("structure", model, barBodies, z, load);
    near(c.r.reaction[2], plain.reaction[2], 1e-4, "reaction along Z"); near(plain.reaction[2], 120, 1e-4, "the whole load reaches the support");
    near(peakOf([c.out, c.parts[0].prep.local], [c.r.mag, c.parts[0].r.mag]).value, plain.maxU.value, 0.03, "the beam bends as much");
  }
  /* a zone that holds part of the support : its fine nodes are held too */
  const load = { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }, c = composite("structure", model, barBodies, [zone({ shape: "prism", axis: 0, size: 4, length: 8, at: [2, 3, 3], ratio: 2 })], load), L = c.parts[0].prep.local;
  let held = 0; for (let i = 0; i < L.nNodes; i++) if (L.nodes[3 * i] === 0) { held++; assert.ok(c.parts[0].r.mag[i] < 1e-12, "a fine node on the clamped face does not move"); } assert.ok(held >= 9);
  near(peakOf([c.out, L], [c.r.mag, c.parts[0].r.mag]).value, solveStructure(model, load).maxU.value, 0.03, "the cantilever bends as much");
});

test("zone — a region of the product found again on the fine mesh : a face carried over, a box and a neighbourhood in space", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), prep = prepareZone(model, barBodies, zone({ shape: "prism", axis: 2, size: 6, length: 6, at: [70, 7, 8], ratio: 2 })), L = prep.local, lf = exposedFaces(L);
  const top = localRegion(prep, model, { face: "+Z" }); assert.ok(top.faces.length > 0 && top.faces.length % 4 === 0, "ratio² fine faces over each face of the model");
  for (const f of top.faces) { assert.equal(lf.dir[f], 5); assert.equal(prep.inner[f], 0); } for (const i of top.nodes) assert.equal(L.nodes[3 * i + 2], 10);
  assert.equal(localRegion(prep, model, { face: "-X" }).nodes.length, 0, "a face of the product the zone does not reach");
  const all = localRegion(prep, model, "exterior"); assert.ok(all.faces.length >= top.faces.length && all.faces.every((f) => !prep.inner[f]));
  const box = localRegion(prep, model, { box: [60, 0, 10, 80, 10, 10] }); assert.deepEqual(Array.from(box.nodes).sort(), Array.from(top.nodes).sort(), "a box laid on the same face finds the same nodes");
  const spot = localRegion(prep, model, { near: [70, 7.5, 10], r: 2.6 }); assert.ok(spot.nodes.length >= 5 && spot.nodes.length < top.nodes.length);
  assert.equal(localRegion(prep, model, { near: [5, 5, 5], r: 2 }).nodes.length, 0);
});

test("composite — heat : a straight line of temperature stays straight, a source balances its convection, and expansion follows", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), z = [zone({ shape: "prism", axis: 0, size: 10, length: 20, at: [50, 5, 5] })];
  const line = composite("thermal", model, barBodies, z, { fixedT: [{ region: { face: "-X" }, T: 100 }, { region: { face: "+X" }, T: 20 }] });
  for (const [m, T] of [[line.out, line.rt.T], [line.parts[0].prep.local, line.parts[0].rt.T]]) for (let i = 0; i < m.nNodes; i++) assert.ok(Math.abs(T[i] - (100 - 0.8 * m.nodes[3 * i])) < 1e-3, "on the line");
  const load = { power: [{ region: { face: "-X" }, P: 3 }], convection: [{ region: "exterior", h: 20, Tamb: 25 }] }, plain = solveThermal(model, load), c = composite("thermal", model, barBodies, z, load);
  near(c.rt.balance.in + c.parts[0].rt.balance.in, 3, 1e-6, "watts in"); near(c.rt.balance.out + c.parts[0].rt.balance.out, 3, 1e-4, "watts out");
  near(peakOf([c.out, c.parts[0].prep.local], [c.rt.T, c.parts[0].rt.T]).value, plain.maxT.value, 0.01, "hottest point"); near(peakOf([c.out, c.parts[0].prep.local], [c.rt.T, c.parts[0].rt.T], -1).value, plain.minT.value, 0.01, "coldest point");
  /* a bar held at both ends and warmed evenly : the zone, in the middle, carries the stress of the middle of the bar */
  const thermo = { fixed: [{ face: "-X" }, { face: "+X" }], loads: [], Tref: 20, thermal: { uniform: 80 } }, t = composite("thermo", model, barBodies, z, thermo), ref = solveStructure(model, { fixed: thermo.fixed, thermal: { T: 80, Tref: 20 } });
  near(t.parts[0].r.maxVm.value, blockPeak(t.parts[0].prep, model, ref.vm).value, 0.01, "stress in the zone"); near(t.r.maxVm.value, ref.maxVm.value, 0.01, "stress at the clamps"); assert.equal(t.rt, null, "an even temperature needs no thermal solve");
  /* … and with a temperature field computed first */
  const field = composite("thermo", model, barBodies, z, { ...thermo, thermal: { case: { fixedT: [{ region: { face: "-X" }, T: 100 }, { region: { face: "+X" }, T: 20 }] } } });
  assert.ok(field.rt && field.parts[0].rt && field.parts[0].r.maxVm.value > 0); near(field.rt.maxT.value, 100, 1e-6, "the field was solved");
});

test("composite — the skin : the cubes the zones took are hidden in place, the fine cubes follow, the values come along", () => {
  const model = buildModel({ bodies: barBodies, h: 5 }), prep = prepareZone(model, barBodies, zone({ shape: "prism", axis: 0, size: 10, length: 20, at: [50, 5, 5] })), cf = exposedFaces(model), lf = exposedFaces(prep.local);
  const fieldM = Float32Array.from({ length: model.nNodes }, (_, i) => i), fieldL = Float32Array.from({ length: prep.local.nNodes }, (_, i) => 1000 + i), s = compositeSkin(model, fieldM, [{ prep, field: fieldL, u: null }]);
  assert.equal(s.faces, cf.count + lf.count, "no face uncovered here"); assert.equal(s.pos.length, 12 * s.faces); assert.equal(s.idx.length, 6 * s.faces); assert.equal(s.zone.length, s.faces); assert.equal(s.body.length, s.faces);
  const plain = skin(model, fieldM); let hidden = 0;
  for (let f = 0; f < cf.count; f++) { const dead = s.idx[6 * f] === s.idx[6 * f + 1] && s.idx[6 * f + 1] === s.idx[6 * f + 2]; if (dead) hidden++; else assert.deepEqual(Array.from(s.idx.subarray(6 * f, 6 * f + 6)), Array.from(plain.idx.subarray(6 * f, 6 * f + 6))); assert.equal(s.zone[f], 0); }
  assert.equal(hidden, 4 * 8, "the 4 sides of the bar over 4 cubes, 2 faces each"); assert.deepEqual(Array.from(s.pos.subarray(0, 12 * cf.count)), Array.from(plain.pos), "the faces of the model keep their place");
  let dead = 0; for (let f = cf.count; f < s.faces; f++) { assert.equal(s.zone[f], 1); assert.ok(s.val[4 * f] >= 1000); if (s.idx[6 * f] === s.idx[6 * f + 1]) dead++; } assert.equal(dead, 32, "the faces where the zone meets the model are not drawn");
  assert.ok(s.epos.length > 0 && s.epos.length < plain.epos.length + skin(prep.local, null).epos.length, "the edges of hidden faces are left out");
  /* a hole the fine mesh sees at the edge of the zone uncovers a face of the model : it is drawn again */
  const bodies = [{ name: "Plate", ...plateWithHole(40, 40, 5, 4), material: steel }], m2 = buildModel({ bodies, h: 5 }), p2 = prepareZone(m2, bodies, zone({ shape: "prism", size: 4, length: 5, at: [2.5, 2.5, 2.5], ratio: 4 }));
  const s2 = compositeSkin(m2, null, [{ prep: p2, field: null, u: null }]); assert.ok(s2.faces >= exposedFaces(m2).count + exposedFaces(p2.local).count);
  const out = outsideModel(model, [prep]), back = onModel(model, out, Float32Array.from({ length: out.nNodes }, () => 7), 1, new Float32Array(model.nNodes).fill(-1));
  assert.equal(out.nCells, model.nCells - 16); assert.ok(back.some((v) => v === 7) && back.some((v) => v === -1), "a node the zone swallowed keeps what the model alone said"); assert.equal(out.cut.onCut.reduce((a, v) => a + v, 0), 8, "the 2 × 4 faces of the outside that look at the zone are not surfaces");
  assert.throws(() => outsideModel(model, [{ block: { mark: new Uint8Array(model.cells.length).fill(1) } }]), /couvrent tout le produit/);
});

test("zone — the guide : what is missing, what the tool invented, what will not work, what is too small", () => {
  const z = { id: "Z1", shape: "cylinder", axis: 2, size: 12, length: 30, at: [0, 0, 0], ratio: 2 }, info = () => ({ cells: 800, block: 100, h: 2.5 });
  assert.deepEqual(zoneIssues([z], info), []); assert.deepEqual(zoneIssues([], info), []);
  const asked = zoneIssues([{ ...z, ask: ["size", "length"] }], info); assert.deepEqual(asked.map((x) => [x.level, x.field]), [["todo", "size"], ["todo", "length"]]); assert.match(asked[0].text, /Z1 : entrez le diamètre de la zone \(12 mm est un exemple\)/);
  assert.match(zoneIssues([{ ...z, shape: "prism", ask: ["size"] }], info)[0].text, /le côté/);
  const broken = zoneIssues([{ ...z, size: 0 }], info); assert.equal(broken[0].level, "error"); assert.equal(broken[0].field, "size");
  const off = zoneIssues([z], () => ({ error: "La zone Z1 est hors du maillage : placez son centre sur la pièce." })); assert.deepEqual([off[0].level, off[0].id], ["error", "Z1"]);
  const small = zoneIssues([{ ...z, size: 4 }], info); assert.equal(small[0].level, "warn"); assert.match(small[0].text, /plus petite que deux cubes du modèle \(5 mm\)/); assert.equal(small[0].field, "size");
});

test("zone — a kept simulation carries its zones : in the project file, in the report, and the brick names its source and its words", () => {
  const sim = { id: "S1", kind: "structure", target: "PLQ", cells: 1000, h: 2.5, zones: [{ id: "Z1", shape: "cylinder", axis: "Z", size: 12, length: 5, at: [0, 0, 2.5], ratio: 2, h: 1.25, cells: 832, peak: 25.3, alone: 29.7 }, { id: "Z2", shape: "prism", axis: "X", size: 6, length: 20, at: [30, 5, 2.5], ratio: 4, h: 0.625, cells: 2048, peak: 12.1, alone: null }],
    estimate: { sigma: 10, delta: 0.004 }, result: { sigma: 25.3, nominal: 10, delta: 0.004, sf: 9.9 }, worst: 0.02, verdict: "ok", when: "2026-11-18T12:00:00.000Z" };
  const project = { dw: "project/1", id: "P", name: "Essai", parts: [], assemblies: [], boards: [], physics: [], simulations: [sim] }, back = fromDwiz(toDwiz(project));
  assert.deepEqual(back.simulations[0].zones, sim.zones, "the zones come back from the .dwiz as they went");
  const row = simulationSummary(back)[0]; assert.match(row.mesh, /^1000 cubes de 2,5 mm — 2 zones de raffinement : Z1 cylindre ⌀ 12 × 5 mm, axe Z, cubes de 1,25 mm \(pointe 25,3 contre 29,7 sans la zone\) ; Z2 prisme □ 6 × 20 mm, axe X, cubes de 0,625 mm \(pointe 12,1\)$/);
  assert.ok(!/zone/.test(simulationSummary({ simulations: [{ ...sim, zones: undefined }] })[0].mesh), "a simulation without zones reads as before");
  const m = METHODS.find((x) => x.id === "fea-zones"); assert.ok(m && m.how === "tested" && /maillage fin partout/.test(m.check) && /aucun ouvrage n'a été relu/.test(m.check), "the register says how the method was checked — and what was not read");
  const words = glossary().filter((r) => /zone de raffinement|nœud lié/.test(r.fr)); assert.equal(words.length, 2); assert.ok(words.every((r) => r.en && r.note));
});
