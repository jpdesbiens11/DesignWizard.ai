// The instruments of a simulation : temperature sensors and strain gauges read on a solved mesh, against closed-form results ;
// the colour scales of a result, the infrared ones among them.
//   node --test tests/node/fea_sensors.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, solveStructure, solveThermal } from "../../web/js/analysis/fea/index.js";
import { reduceModel, cutSetup } from "../../web/js/analysis/fea/symmetry.js";
import { prepareZones } from "../../web/js/analysis/fea/refine.js";
import { solveComposite } from "../../web/js/analysis/fea/composite.js";
import { probeMesh, probePlanes, probeBuffers, locate, findIn, scalarAt, gradientAt, stretch, undeform } from "../../web/js/analysis/fea/probe.js";
import { SENSOR_KINDS, ROSETTE, isSensorId, nextSensorId, sensorKindsFor, newSensor, copySensor, asksAngle, tangent, gaugeAxes, rosetteReduce, planeStress, readSensor, readSensors, sensorText, rosetteLines, sensorIssues, sensorNote, keptSensors, keptSensorsText } from "../../web/js/analysis/fea/sensors.js";
import { PALETTES, paletteColour, paletteCss, luminance, fieldColours, isInfrared } from "../../web/js/analysis/fea/palette.js";
import { readFileSync } from "node:fs";
import { blankCase, takeCase, withCase, caseOf, sameCase, sameSolve, caseNote, addCase } from "../../web/js/analysis/fea/case_store.js";
import { blocking } from "../../web/js/analysis/fea/case_check.js";
import { simulationSummary, instrumentsText } from "../../web/js/analysis/fea/summary.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { glossary } from "../../web/js/core/terms.js";
import { METHODS } from "../../web/js/core/methods.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

const steel = { name: "Steel", E: 210000, nu: 0.3, k: 50, rho: 7850, Re: 250 };
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const pos = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { pos, idx };
}
const barBodies = [{ name: "Bar", ...boxMesh(0, 0, 0, 100, 10, 10), material: steel }], bar = (h, planes) => buildModel({ bodies: barBodies, h, planes });
const near = (actual, expected, rel, label) => assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected), `${label}: ${actual} vs ${expected} (tolerance ${rel * 100} %)`);
const close = (actual, expected, abs, label) => assert.ok(Math.abs(actual - expected) <= abs, `${label}: ${actual} vs ${expected} (± ${abs})`);
const probeOf = (kind, model, fields, more = {}) => ({ kind, meshes: [probeMesh(model, fields)], planes: probePlanes(model), bodies: model.bodies.map((b) => ({ name: b.name, E: b.material.E, nu: b.material.nu })), ...more });
const gauge = (at, n, more = {}) => ({ id: "SG1", kind: "gauge", at, n, angle: 0, ...more }), tc = (at, more = {}) => ({ id: "TC1", kind: "temp", at, ...more });

test("probe — a point is read in the cube that holds it, or in the nearest one : where, how far, and which body is preferred", () => {
  const m = bar(5), pm = probeMesh(m, { T: Float32Array.from({ length: m.nNodes }, (_, i) => m.nodes[3 * i]) });
  const inside = locate(pm, [37, 2, 6]); assert.equal(inside.dist, 0); close(inside.t[0], 0.4, 1e-6, "its place along X in its cube");
  close(scalarAt(pm, pm.T, inside), 37, 1e-4, "a field that is straight is read exactly");
  const off = locate(pm, [37, 5, 13]); close(off.dist, 3, 1e-6, "three millimetres above the bar"); close(scalarAt(pm, pm.T, off), 37, 1e-4, "read on the nearest cube");
  assert.equal(locate(pm, [37, 5, 40]), null, "too far : no cube within reach"); assert.ok(locate(pm, [37, 5, 40], { reach: 8 }), "a longer reach finds it");
  assert.equal(scalarAt(pm, 80, inside), 80, "a uniform temperature is one number");
  assert.equal(probeBuffers({ meshes: [pm] }).length, 4, "its buffers travel with it"); assert.notEqual(pm.elems.buffer, m.elems.buffer, "copies : the model keeps its own");
  /* two bodies side by side : a sensor on their joint reads the one it was put on */
  const two = buildModel({ bodies: [{ name: "A", ...boxMesh(0, 0, 0, 50, 10, 10), material: steel }, { name: "B", ...boxMesh(50, 0, 0, 100, 10, 10), material: steel }], h: 5 }), p2 = { meshes: [probeMesh(two, { T: 20 })], bodies: [{ name: "A" }, { name: "B" }] };
  const onA = findIn(p2, [50, 5, 10], { body: "A" }), onB = findIn(p2, [50, 5, 10], { body: "B" });
  assert.equal(two.elemBody[onA.at.e], 0); assert.equal(two.elemBody[onB.at.e], 1); assert.equal(onA.at.dist, 0);
});

test("temperature sensor — a bar between two temperatures : the sensor reads the straight line, on the surface and inside", () => {
  const m = bar(5), r = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 0 }, { region: { face: "+X" }, T: 100 }] }), probe = probeOf("thermal", m, { T: r.T });
  const top = readSensor(probe, tc([37, 5, 10])), core = readSensor(probe, tc([81.3, 2.2, 4.1]));
  assert.equal(top.state, "ok"); close(top.value, 37, 0.02, "on the top face"); close(core.value, 81.3, 0.02, "inside"); assert.equal(top.unit, "°C"); assert.equal(sensorText(top), "37 °C");
  assert.deepEqual(top.shown, [37, 5, 10], "no deformed shape in a thermal result : drawn where it is");
  assert.equal(readSensor(probe, gauge([37, 5, 10], [0, 0, 1])).state, "idle", "a gauge has nothing to read in a thermal result"); assert.equal(sensorText({ kind: "gauge", state: "idle" }), "attend un calcul de structure");
  assert.equal(readSensor(null, tc([1, 2, 3])).state, "none"); assert.equal(readSensor(probe, tc([37, 5, 10], { off: true })).state, "off"); assert.equal(readSensor(probe, tc([37, 5, 99])).state, "far");
  assert.equal(readSensor(probe, { id: "TC9", kind: "temp", at: [1, NaN, 0] }).state, "bad");
});

test("strain gauge — a bar pulled : the gauge along the bar reads σ / E, the one across reads −ν times as much", () => {
  const m = bar(2.5), F = 10000, r = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [F, 0, 0] }] }), probe = probeOf("structure", m, { u: r.u }, { scale: 100 });
  const eps = F / 100 / steel.E * 1e6, along = readSensor(probe, gauge([70, 5, 10], [0, 0, 1])), across = readSensor(probe, gauge([70, 5, 10], [0, 0, 1], { angle: 90 }));
  near(along.value, eps, 0.01, "along the bar"); near(across.value, -steel.nu * eps, 0.02, "across the bar"); assert.equal(along.unit, "µm/m"); assert.equal(sensorText(along), "+476 µm/m");
  near(readSensor(probe, gauge([70, 0, 5], [0, -1, 0])).value, eps, 0.01, "on a side face, its 0° is still along X");
  /* a rosette, turned 30° : the same two principal strains, the first one 30° back from its first grid ; the stress it tells is the pull */
  const ros = readSensor(probe, gauge([70, 5, 10], [0, 0, 1], { angle: 30, rosette: true }));
  near(ros.e1, eps, 0.01, "ε1"); near(ros.e2, -steel.nu * eps, 0.02, "ε2"); close(ros.phi, -30, 0.3, "the angle to ε1"); near(ros.stress.s1, 100, 0.01, "σ1"); close(ros.stress.s2, 0, 1, "σ2"); near(ros.stress.vm, 100, 0.015, "von Mises");
  assert.equal(ros.grids.length, 3); assert.equal(rosetteLines(ros).length, 3); assert.match(sensorText(ros), /^ε1 \+476 · ε2 −143 µm\/m$/);
  assert.equal(readSensor({ ...probe, kind: "thermo" }, gauge([70, 5, 10], [0, 0, 1], { rosette: true })).stress, undefined, "a heated part : no stress is told from the strains");
  /* drawn on the deformed shape : where the point went, amplified as the view amplifies it */
  close(along.shown[0], 70 + 100 * eps * 1e-6 * 70, 0.05, "its place on the deformed shape"); assert.equal(readSensor(probe, gauge([70, 5, 10], [0, 0, 1], { ask: ["angle"] })).state, "wait", "an axis the tool chose is confirmed before the gauge is read");
  /* a click on the deformed shape is brought back to the product */
  const back = undeform(probe, along.shown); close(back[0], 70, 0.01, "undeformed X"); close(back[2], 10, 0.01, "undeformed Z"); assert.deepEqual(undeform({ ...probe, scale: 0 }, [1, 2, 3]), [1, 2, 3]);
});

test("strain gauge — a cantilever : stretched on top, shortened below, by M c / (E I)", () => {
  const m = bar(2.5), r = solveStructure(m, { fixed: [{ face: "-X" }], loads: [{ region: { face: "+X" }, force: [0, 0, -100] }] }), probe = probeOf("structure", m, { u: r.u });
  const eps = 100 * 50 * 5 / (10 ** 4 / 12) / steel.E * 1e6, top = readSensor(probe, gauge([50, 5, 10], [0, 0, 1])), under = readSensor(probe, gauge([50, 5, 0], [0, 0, -1]));
  near(top.value, eps, 0.05, "top fibre"); near(under.value, -eps, 0.05, "bottom fibre"); close(top.value + under.value, 0, 0.02 * eps, "as much one way as the other");
  close(readSensor(probe, gauge([50, 5, 5], [0, 1, 0])).value, 0, 0.03 * eps, "on the neutral fibre, nothing");
  const G = gradientAt(probe.meshes[0], probe.meshes[0].u, locate(probe.meshes[0], [50, 5, 10])); near(stretch(G, [1, 0, 0]) * 1e6, eps, 0.05, "the same, from the gradient");
});

test("symmetry and cuts — the removed half is read at its mirror image ; behind a plain cut there is nothing to read", () => {
  const load = { fixedT: [{ region: { face: "-X" }, T: 0 }, { region: { face: "+X" }, T: 0 }], power: [{ region: { box: [50, 0, 0, 50, 10, 10] }, P: 2 }] }, cuts = [{ axis: 0, at: 50, keep: 1, bc: "sym" }];
  const whole = bar(5, cuts), half = reduceModel(whole, cuts), a = solveThermal(whole, load), b = solveThermal(half, cutSetup(half, load, "thermal"));
  const full = probeOf("thermal", whole, { T: a.T }), part = probeOf("thermal", half, { T: b.T }); assert.deepEqual(part.planes, [{ axis: 0, at: 50, keep: 1, bc: "sym" }]);
  const there = readSensor(part, tc([30, 5, 10])), ref = readSensor(full, tc([30, 5, 10]));
  assert.equal(there.state, "ok"); assert.equal(there.mirrored, true); near(there.value, ref.value, 2e-3, "the half answers for the whole"); assert.equal(readSensor(part, tc([70, 5, 10])).mirrored, false);
  assert.deepEqual(findIn(part, [30, 5, 10]).flip, [-1, 1, 1], "a direction given there is read mirrored"); assert.deepEqual(findIn(part, [30, 5, 10]).p, [70, 5, 10]);
  const cut = probeOf("thermal", reduceModel(whole, [{ ...cuts[0], bc: "free" }]), { T: b.T }); assert.equal(readSensor(cut, tc([30, 5, 10])).state, "cut"); assert.equal(readSensor(cut, tc([50, 5, 10])).state, "ok", "on the plane itself : still the model");
});

test("refinement zone — a sensor inside a zone is read on its fine cubes, and says the same as the model where the field is straight", () => {
  const m = bar(5), load = { fixedT: [{ region: { face: "-X" }, T: 0 }, { region: { face: "+X" }, T: 100 }] }, preps = prepareZones(m, barBodies, [{ id: "Z1", shape: "prism", axis: 0, size: 20, length: 20, at: [50, 5, 5], ratio: 2 }]);
  for (const p of preps) assert.ok(p.prep, p.error);
  const comp = solveComposite("thermal", m, preps.map((p) => p.prep), load), probe = { kind: "thermal", meshes: [...comp.parts.map((p) => probeMesh(p.prep.local, { T: p.rt.T })), probeMesh(comp.out, { T: comp.rt.T })], planes: [], bodies: [{ name: "Bar" }] };
  const inZone = readSensor(probe, tc([51, 5, 10])), outside = readSensor(probe, tc([20, 5, 10]));
  assert.equal(inZone.zone, true); assert.equal(outside.zone, false); close(inZone.value, 51, 0.05, "in the zone"); close(outside.value, 20, 0.05, "outside it"); assert.equal(inZone.h, 2.5); assert.equal(outside.h, 5);
});

test("instruments — numbers, copies, the plane of a gauge, the rosette, what each physics reads", () => {
  assert.equal(SENSOR_KINDS.temp.label, "Temperature sensor"); assert.equal(SENSOR_KINDS.gauge.label, "Strain gauge"); assert.ok(SENSOR_KINDS.temp.fr && SENSOR_KINDS.gauge.fr && ROSETTE.label && ROSETTE.fr);
  const list = []; list.push(newSensor(list, "temp", [1.234, 2, 3])); list.push(newSensor(list, "gauge", [4, 5, 6], { normal: [0, 0, 2], body: "Lid" })); list.push(newSensor(list, "temp", [7, 8, 9]));
  assert.deepEqual(list.map((s) => s.id), ["TC1", "SG1", "TC2"]); assert.deepEqual(list[0].at, [1.23, 2, 3]); assert.deepEqual(list[1].n, [0, 0, 1]); assert.equal(list[1].body, "Lid");
  assert.ok(asksAngle(list[1]), "the axis of a new gauge is an example"); assert.ok(!asksAngle(list[0]));
  list.splice(0, 1); assert.equal(nextSensorId(list, "temp"), "TC3", "a number is not given twice"); copySensor(list, 0);
  assert.equal(list[1].id, "SG2"); assert.equal(list[1].off, true); assert.equal(list[0].off, undefined); assert.ok(isSensorId("TC12") && isSensorId("SG1") && !isSensorId("T1") && !isSensorId("Z1") && !isSensorId(null));
  assert.deepEqual(sensorKindsFor("thermal", true), ["temp"]); assert.deepEqual(sensorKindsFor("structure", false), ["gauge"]); assert.deepEqual(sensorKindsFor("thermo", true), ["gauge", "temp"]); assert.deepEqual(sensorKindsFor("thermo", false), ["gauge"]);
  /* the plane of a face : 0° follows X on a face that holds X, and the axes of a gauge stay in the plane, of length one */
  for (const n of [[0, 0, 1], [0, 0, -1], [0, 1, 0], [1, 0, 0], [1, 1, 0], [0.3, -0.2, 0.9]]) { const t = tangent(n), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    close(dot(t.u, t.n), 0, 1e-9, "u in the plane"); close(dot(t.v, t.n), 0, 1e-9, "v in the plane"); close(dot(t.u, t.v), 0, 1e-9, "u ⟂ v"); close(dot(t.u, t.u), 1, 1e-9, "unit");
    for (const d of gaugeAxes({ n, angle: 37, rosette: true })) { close(dot(d, t.n), 0, 1e-9, "a grid in the plane"); close(dot(d, d), 1, 1e-9, "unit"); } }
  assert.deepEqual(tangent([0, 0, 1]).u, [1, 0, 0]); assert.deepEqual(tangent([0, 0, 1]).v, [0, 1, 0]); assert.deepEqual(tangent([1, 0, 0]).u, [0, 1, 0]); assert.equal(tangent(null).axis, 0);
  assert.equal(gaugeAxes({ n: [0, 0, 1], angle: 0 }).length, 1); close(gaugeAxes({ n: [0, 0, 1], angle: 90 })[0][1], 1, 1e-9, "90° is Y on a face that looks up");
  /* a rosette against the strain it sits on : εxx, εyy, εxy → the eigenvalues, and the angle of the first */
  for (const [exx, eyy, exy] of [[500, -150, 0], [100, 300, 80], [-200, -50, -120], [40, 40, 0]]) {
    const R = rosetteReduce(exx, (exx + eyy) / 2 + exy, eyy), mean = (exx + eyy) / 2, rad = Math.hypot((exx - eyy) / 2, exy);
    close(R.e1, mean + rad, 1e-9, "ε1"); close(R.e2, mean - rad, 1e-9, "ε2");
    if (rad > 1e-9) { const a = R.phi * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); close(exx * c * c + eyy * s * s + 2 * exy * s * c, R.e1, 1e-9, "the strain along φ is ε1"); } else assert.equal(R.phi, 0);
  }
  const S = planeStress(1000, -300, 210000, 0.3); close(S.s1, 210, 1e-9, "uniaxial : σ1 = E ε1"); close(S.s2, 0, 1e-9, "σ2"); close(S.vm, 210, 1e-9, "von Mises");
});

test("instruments — the guide, the notes and what a kept simulation remembers", () => {
  const m = bar(5), r = solveThermal(m, { fixedT: [{ region: { face: "-X" }, T: 0 }, { region: { face: "+X" }, T: 100 }] }), probe = probeOf("thermal", m, { T: r.T });
  const list = [tc([10, 5, 10], { name: "côté froid" }), tc([10, 5, 10], { id: "TC2" }), tc([10, 5, 17], { id: "TC3" }), tc([10, 5, 99], { id: "TC4" }), tc([5, 5, 5], { id: "TC5", off: true }), gauge([20, 5, 10], [0, 0, 1], { ask: ["angle"] })], rows = readSensors(probe, list), found = sensorIssues(list, rows);
  assert.ok(found.every((x) => x.soft), "an instrument never stops a run"); const of = (id) => found.filter((x) => x.id === id);
  assert.equal(of("TC1").length, 0); assert.match(of("TC2")[0].text, /même point que TC1/); assert.equal(of("TC2")[0].level, "tip"); assert.match(of("TC3")[0].text, /cube le plus proche, à 7 mm/); assert.equal(of("TC4")[0].level, "warn"); assert.match(of("TC4")[0].text, /hors du maillage/);
  assert.equal(of("TC5").length, 0, "what is off asks for nothing"); assert.equal(of("SG1")[0].level, "todo"); assert.equal(of("SG1")[0].field, "angle"); assert.match(of("SG1")[0].text, /confirmez l'axe/);
  assert.match(sensorIssues([tc([1, 1, 1], { off: true })], [])[0].text, /Tous les instruments sont à Off/); assert.deepEqual(sensorIssues([], []), []); assert.deepEqual(sensorIssues(undefined), []);
  const cut = sensorIssues([tc([30, 5, 5])], [{ id: "TC1", state: "cut" }]); assert.match(cut[0].text, /côté que la coupe a retiré/);
  assert.equal(sensorNote(list), "5 capteurs (1 à Off) · 1 jauge"); assert.equal(sensorNote([]), ""); assert.equal(sensorNote([gauge([0, 0, 0], [0, 0, 1], { off: true })]), "1 jauge (1 à Off)");
  const kept = keptSensors(rows); assert.deepEqual(kept.map((x) => x.id), ["TC1", "TC2", "TC3"], "only what was read is kept"); assert.equal(kept[0].name, "côté froid"); close(kept[0].value, 10, 0.01, "its value");
  assert.match(keptSensorsText(kept), /^TC1 \(côté froid\) 10 °C · TC2 10 °C · TC3 10 °C$/);
  assert.equal(sensorText(null), "—"); assert.equal(sensorText({ state: "wait" }), "axe à confirmer"); assert.equal(sensorText({ state: "cut" }), "côté retiré par la coupe"); assert.deepEqual(rosetteLines(rows[0]), []);
});

test("colour scales — Rainbow for a calculation, Iron and White hot for an infrared image : each gets lighter all the way up", () => {
  assert.deepEqual(Object.keys(PALETTES), ["rainbow", "iron", "white"]); for (const p of Object.values(PALETTES)) assert.ok(p.label && p.fr && p.overFr && p.underFr && p.stops.length >= 2);
  assert.ok(isInfrared("iron") && isInfrared("white") && !isInfrared("rainbow") && !isInfrared("nope"));
  for (const name of ["iron", "white"]) { let last = -1; for (let i = 0; i <= 100; i++) { const l = luminance(paletteColour(name, i / 100)); assert.ok(l >= last - 1e-9, `${name} : darker at ${i} %`); last = l; }
    assert.ok(luminance(paletteColour(name, 0)) < 0.06, "cold is black"); assert.ok(luminance(paletteColour(name, 1)) > 0.94, "hot is white"); }
  assert.deepEqual(paletteColour("rainbow", 0), [0.05, 0.25, 0.85]); assert.deepEqual(paletteColour("rainbow", 1), [0.9, 0.12, 0.1]); assert.deepEqual(paletteColour("rainbow", 7), paletteColour("rainbow", 1)); assert.deepEqual(paletteColour("nope", NaN), paletteColour("rainbow", 0));
  assert.match(paletteCss("white"), /^linear-gradient\(90deg, rgb\(8, 8, 8\), rgb\(255, 255, 255\)\)$/);
  const col = fieldColours(Float32Array.from([0, 50, 100, 150, -20]), [0, 100], "iron"), at = (i) => Array.from(col.subarray(3 * i, 3 * i + 3)).map((v) => Math.round(v * 100) / 100);
  assert.deepEqual(at(0), [0.02, 0.02, 0.09]); assert.deepEqual(at(2), [1, 1, 0.96]); assert.deepEqual(at(3), [0.2, 0.95, 0.45], "above the scale : a colour the scale does not have"); assert.deepEqual(at(4), [0.15, 0.5, 1], "below it");
  for (const p of Object.values(PALETTES)) for (const s of p.stops) for (const c of [p.over, p.under]) assert.ok(Math.hypot(s[0] - c[0], s[1] - c[1], s[2] - c[2]) > 0.2, `${p.label} : what is off the scale cannot be mistaken for a colour of the scale`);
});

test("instruments — kept in the load case : written, read back, copied with a new case ; they are not part of what is solved", () => {
  assert.deepEqual(blankCase().sensors, []);
  const p = { id: "P", name: "x", parts: [{ id: "DW-001", name: "a", ops: [] }], assemblies: [] }, st = takeCase({}, null); st.fixed = ["face:-X"];
  st.sensors = [tc([1, 2, 3], { name: "côté froid" }), gauge([4, 5, 6.5], [0, 0, 1], { angle: 30, rosette: true, off: true, body: "Lid" })];
  assert.equal(withCase(p, "DW-001", st), true); assert.deepEqual(caseOf(p, "DW-001").sensors, st.sensors); assert.equal(withCase(p, "DW-001", st), false, "nothing changed : nothing written");
  assert.equal(caseNote(st), "1 appui · 1 capteur · 1 jauge (1 à Off)"); assert.deepEqual(fromDwiz(toDwiz(p)).cases, p.cases, "the .dwiz file carries them, there and back");
  const moved = takeCase({}, caseOf(p, "DW-001")); moved.sensors[0].at = [9, 2, 3];
  assert.equal(sameCase(moved, st), false, "the case changed…"); assert.equal(sameSolve(moved, st), true, "…but not what the solver is asked"); moved.fixed.push("face:+X"); assert.equal(sameSolve(moved, st), false);
  assert.equal(addCase(p, "DW-001", st, "Chaud"), "Chaud"); assert.deepEqual(caseOf(p, "DW-001").others[0].sensors, st.sensors, "a new case is a copy : the instruments come along");
  /* a sensor alone does not make a case : but it is kept */
  const only = takeCase({}, null); only.sensors = [tc([0, 0, 0])]; const q = { parts: [{ id: "A" }], assemblies: [] }; assert.equal(withCase(q, "A", only), true); assert.equal(q.cases[0].sensors.length, 1);
  /* what waits for an instrument is its reading, not the run */
  assert.deepEqual(blocking([{ level: "todo", id: "SG1", soft: true }, { level: "todo", id: "E1" }, { level: "error", id: null }, { level: "warn", id: "TC1", soft: true }]).map((x) => x.id), ["E1", null]);
});

test("instruments — a kept simulation carries its readings to the report ; the words and the sources are there", () => {
  const kept = [{ id: "TC1", kind: "temp", name: "côté froid", value: 42.31, unit: "°C" }, { id: "SG1", kind: "gauge", value: -312.4, unit: "µm/m" }, { id: "SG2", kind: "gauge", value: 476.2, unit: "µm/m", grids: [1, 2, 3], e1: 476.2, e2: -143, phi: 0 }];
  assert.equal(instrumentsText(kept), "TC1 (côté froid) 42,3 °C · SG1 −312,4 µm/m · SG2 ε1 +476,2 · ε2 −143 µm/m"); assert.equal(instrumentsText(undefined), "");
  const rows = simulationSummary({ simulations: [{ id: "S1", kind: "thermal", target: "DW-001", cells: 3000, h: 2, estimate: { Tmax: 40 }, result: { Tmax: 42, Tmin: 25 }, sensors: kept.slice(0, 1), verdict: "ok" }, { id: "S2", kind: "thermal", target: "DW-001", cells: 3000, h: 2, estimate: { Tmax: 40 }, result: { Tmax: 42, Tmin: 25 }, verdict: "ok" }] });
  assert.equal(rows[0].instruments, "TC1 (côté froid) 42,3 °C"); assert.equal(rows[1].instruments, "");
  const words = glossary().filter((g) => g.group === "analysis"), has = (en) => words.some((w) => w.en === en && w.fr);
  for (const en of ["Temperature sensor", "Strain gauge", "Rosette 0°/45°/90°", "Rainbow", "Iron", "White hot", "Uniaxial", "Infrared (IR)"]) assert.ok(has(en), `the glossary has « ${en} », with its French`);
  for (const id of ["fea-sensors", "fea-rosette", "fea-infrared"]) { const m = METHODS.find((x) => x.id === id); assert.ok(m && m.check.length > 80 && m.where === "#/fea", `the register of sources has ${id}`); }
  assert.equal(METHODS.find((x) => x.id === "fea-infrared").how, "own", "the infrared scales are a choice of the platform, and said so"); assert.match(METHODS.find((x) => x.id === "fea-rosette").check, /Aucune note d'application d'un fabricant de jauges n'a été relue/);
});

test("wiring — the Simulation puts, reads and draws its instruments without solving again, and paints a thermal result on the chosen scale", () => {
  const f = read("web/js/modules/fea.js"), r = read("web/js/modules/fea_result.js"), w = read("web/js/analysis/fea/worker.js"), s = read("web/js/modules/fea_sensors.js");
  assert.match(w, /probe: keep\(\[probeMesh\(model, \{ T: r\.T \}\)\]\)/, "the worker keeps what it takes to read a thermal result"); assert.match(w, /probeMesh\(comp\.out, \{ u: comp\.r\.u/, "and a structural one, with its zones"); assert.match(w, /\.\.\.probeBuffers\(out\.probe\)\]\);/, "handed over, not copied");
  assert.match(f, /probe: m\.probe \|\| null \};/); assert.match(f, /runs\[runs\.length - 7\]\.probe = null;/, "an old trial lets its probe go with its skin");
  assert.match(f, /const sensorsChanged = \(s\) => \{ saveCase\(\); drawLeft\(\); showSensors\(\); if \(last\) drawRight\(\);/, "an instrument that changes is saved and read again — the result is not outdated"); assert.doesNotMatch(f, /const sensorsChanged = [^\n]*outdate\(\)/);
  assert.match(f, /undeform\(probeNow\(\), hit\.point\)/, "a click on the deformed shape is brought back to the product"); assert.match(f, /sameSolve\(kept, st\)\) \{ st\.sensors = kept\.sensors;/, "an undo that only moves an instrument leaves the result standing");
  assert.match(f, /\.\.\.sensorIssues\(st\.sensors, readings\(\)\)\]/, "the guide follows them"); assert.match(f, /fieldColours\(s\.val, last\.range, thermal \? st\.palette : "rainbow"\)/); assert.match(f, /epos: thermal && isInfrared\(st\.palette\) \? null : s\.epos/, "an infrared image shows no mesh");
  assert.match(f, /if \(thermal && isInfrared\(st\.palette\)\) \{ const q = last\.result\.minT;/, "and marks its cold spot"); assert.match(f, /\.\.\.\(read\.length \? \{ sensors: read \} : \{\}\)/, "a kept run keeps its readings");
  assert.match(f, /if \(st\.zones\.length \|\| st\.sensors\.length\) drawLeft\(\);/, "after a run each card says what it reads");
  assert.match(r, /sensorsResult\(o\.sensors\)/); assert.match(r, /"Vue thermique"\)\);/); assert.match(r, /Ce n'est pas une image de caméra simulée — ni émissivité, ni reflets/, "the infrared view says what it is not"); assert.match(r, /background: paletteCss\(scale\)/);
  assert.match(s, /"data-sensor": s\.id/); assert.match(s, /needField\(input, \{ hint: "Axe d'exemple/, "the axis the tool chose blinks"); assert.match(s, /onOff\(!s\.off,/); assert.match(s, /copySensor\(list, i\)/); assert.match(s, /setAttribute\("data-fold-note", sensorNote\(list\) \|\| "aucun"\)/, "the group says what it holds when folded");
  for (const file of ["web/js/analysis/fea/probe.js", "web/js/analysis/fea/sensors.js", "web/js/analysis/fea/palette.js"]) assert.doesNotMatch(read(file), /\bdocument\.[a-zA-Z]|\bwindow\.[a-zA-Z]|from "\.\.\/\.\.\/(core|modules)\//, `${file} is pure`);
  for (const file of ["web/js/modules/fea.js", "web/js/modules/fea_sensors.js", "web/js/modules/fea_result.js", "web/js/analysis/fea/sensors.js", "web/js/analysis/fea/probe.js", "web/js/analysis/fea/worker.js"]) assert.ok(read(file).split("\n").length < 500, `${file} stays under 500 lines`);
  assert.match(read("docs/SIMULATION.md"), /## 5 bis\. Instruments/); assert.match(read("CLAUDE.md"), /\*\*Instruments de la simulation, vue infrarouge\*\* \(demande de JP\)/); assert.match(read("docs/FORMAT.md"), /`sensors` : les\n  instruments posés sur le produit/); assert.match(read("web/js/modules/help.js"), /Instruments et vue infrarouge/);
});
