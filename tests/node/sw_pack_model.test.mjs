/* The module on the bench as a 1.5D system model, and a mission by phases (JP, 28 novembre 2026 : « les paramètres du pack… performance et aspect
   thermique transitoire… de manière système 1.5D comme dans LMS Amesim… les conditions aux frontières… la partie profil de mission »).
   node --test tests/node/sw_pack_model.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODEL_GROUPS, MODEL_PARAMS, MODEL_GAPS, modelOf, setParam, confirmAll, unsureParams, rFactor, capFactor, solvePower, thermalStart, thermalStep, modelSummary } from "../../web/js/sw/sw_pack_model.js";
import { packStart, packDrive, packStep, packState } from "../../web/js/sw/sw_pack.js";
import { examplePhases, parsePhases, phaseSummary, phaseProfile } from "../../web/js/sw/sw_phases.js";
import { playMission } from "../../web/js/sw/sw_campaign.js";
import { PLANT_VARS } from "../../web/js/sw/sw_profiles.js";
import { SIGNALS } from "../../web/js/core/req_oracle.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what} : ${a} vs ${b}`);

test("the panel : five groups, every value with its unit, its name in the trade and where it comes from — the cell's from its sheet, read ; an example until entered or confirmed", () => {
  assert.deepEqual(MODEL_GROUPS.map((g) => g.key), ["cell", "pack", "thermal", "bc", "limits"]);
  for (const p of MODEL_PARAMS) { assert.ok(MODEL_GROUPS.some((g) => g.key === p.group), p.key); assert.ok(p.fr && p.en && p.basis && p.typical !== undefined, p.key); }
  for (const k of ["capCell", "mCell", "iMaxCell", "iChgCell"]) assert.match(MODEL_PARAMS.find((p) => p.key === k).basis, /P45B.*lue/, `${k} : from the sheet`);
  for (const k of ["amb", "tInit", "tCoolIn", "ends"]) assert.equal(MODEL_PARAMS.find((p) => p.key === k).group, "bc", `${k} : a boundary condition`);
  assert.ok(MODEL_GAPS.length >= 3);
  const d = bmProject().software[0]; assert.equal(unsureParams(d).length, MODEL_PARAMS.length, "every value a proposal at first");
  let m = setParam(undefined, "amb", 40); assert.deepEqual([m.values.amb, m.sure], [40, ["amb"]], "entered : confirmed");
  m = setParam(m, "hExt", 1e9); assert.equal(m.values.hExt, 200, "held to its range"); m = setParam(m, "ends", "nowhere"); assert.equal(m.values.ends, "lids");
  assert.equal(modelOf({ plant: { model: m } }).v.amb, 40); assert.equal(unsureParams({ plant: { model: confirmAll(m) } }).length, 0);
  const S = modelSummary(modelOf(d).v); near(S.eWh, 1036.8, 0.1, "8 × 3,6 V × 36 Ah"); assert.equal(S.iMax, 360); assert.equal(S.iChg, 72); assert.ok(S.stableDt > 10, "a second a step is far inside what the network allows");
});

test("the physics : the resistance follows Arrhenius and rises when nearly empty ; the capacity falls in the cold ; a power gives the current that holds P = (V − IR)·I", () => {
  const v = modelOf(null).v;
  near(rFactor(25, 0.5, v), 1, 0.01, "25 °C, half charged"); assert.ok(rFactor(0, 0.5, v) > 2 && rFactor(45, 0.5, v) < 0.6, "cold : higher ; hot : lower"); assert.ok(rFactor(25, 0.05, v) > 1.4, "nearly empty : higher");
  assert.equal(capFactor(25, v), 1); near(capFactor(0, v), 0.9, 1e-9, "capCold at 0 °C"); assert.ok(capFactor(-20, v) < 0.9);
  const V = 29.6, R = 0.0256;
  for (const P of [2000, 6000, -1500]) { const { i } = solvePower(P, V, R), I = -i; near((V - I * R) * I, P, 1e-6, `P = ${P} W`); }
  assert.ok(solvePower(2000, V, R).i < 0, "+ : discharge, the current leaves the pack"); assert.ok(solvePower(-1500, V, R).i > 0);
  assert.equal(solvePower(V * V / (4 * R) * 1.2, V, R).max, true, "beyond the most the module can give : held there, and said");
});

test("the 1.5D network : heat is kept (nothing leaves when every way out is closed) ; the ends are cooler beside their lids ; the pump cools and the coolant warms along the stack", () => {
  const v = { ...modelOf(null).v, hExt: 0, gEnd: 0, ends: "adiabatic" }, C = v.mCell / 1000 * v.cpCell * v.np * v.inertia, Th = thermalStart(8, v), q = [0, 0, 0, 40, 0, 0, 0, 0];
  for (let s = 0; s < 600; s++) thermalStep(Th, q, v);
  near(Th.tk.reduce((a, t) => a + C * (t - 25), 0) + v.cCase * (Th.tc - 25), 40 * 600, 1e-6, "the energy of the nodes : all the heat given");
  const w = modelOf(null).v, A = thermalStart(8, w), B = thermalStart(8, w), q8 = new Array(8).fill(10);
  for (let s = 0; s < 1800; s++) { thermalStep(A, q8, w); thermalStep(B, q8, w, { pump: true }); }
  assert.ok(A.tk[0] < A.tk[3] && A.tk[7] < A.tk[4], `the ends : ${A.tk.map((t) => t.toFixed(1)).join(" ")}`);
  assert.ok(Math.max(...B.tk) < Math.max(...A.tk) - 3, "the pump cools"); assert.ok(B.cool[8] > B.cool[0], "the coolant leaves warmer than it came");
});

test("the module on the bench runs on it : a power imposed, the current found and held to the cells ; the record carries SoC, power, every CORE, the casing, the coolant", () => {
  const d = bmProject().software[0], P = packStart(d, { start: 4.0 }); assert.equal(P.S.capAh, 36); near(P.S.r, 0.0032, 1e-9, "25,6 mΩ / 8");
  packDrive(P, { mode: "power", power: 3 }); for (let s = 0; s < 60; s++) packStep(P, { closed: true });
  const st = packState(P); near(st.pw, 3000, 30, "3 kW given"); assert.ok(P.i < 0 && P.phase === "power"); assert.equal(st.tk.length, 8); assert.ok(st.soc < 800 && st.soc > 700, `${st.soc} ‰ : from 4,0 V at rest (about 79 %), a minute at 3 kW`);
  packDrive(P, { power: 50 }); packStep(P, { closed: true }); assert.equal(P.phase, "pmax", "beyond its peak power"); assert.ok(-P.i <= P.S.iMax + 1e-9);
  packDrive(P, { mode: "discharge", a: 1000 }); packStep(P, { closed: true }); assert.equal(P.i, -360, "the cells' 45 A each, 8 in parallel");
  /* 2 kW : under the 95 A the software holds before it derates (ESS-REQ-016) — 4 kW would be derated to 18 A after 2 s, as the software decides */
  const L = playMission(d, phaseProfile([{ name: "Climb", kw: 2, min: 3 }, { name: "Cruise", kw: 1, min: 3 }], { id: "t" })), x = L.rec[150];
  assert.ok(x.soc && x.pw && x.tk.length === 8 && x.tc && x.tco, JSON.stringify(x)); assert.ok(Math.abs(x.pw - 2000) < 100, `${x.pw} W in the climb`);
  assert.ok(SIGNALS.soc && SIGNALS.power, "a requirement may read them"); assert.ok(PLANT_VARS.some((p) => p.key === "power") && PLANT_VARS.find((p) => p.key === "mode").values.includes("power"));
});

test("a mission by phases : the example scaled to the module, a table pasted from a spreadsheet, the events of a profile of the bank ; wiring of the panel, the window and the views", () => {
  const E = examplePhases(10); assert.deepEqual(E.map((p) => p.name), ["Taxi", "Takeoff", "Climb", "Cruise", "Descent", "Landing"]); assert.ok(phaseSummary(E).kwhOut < 1.04, "it fits one module");
  const r = parsePhases("Phase\tkW\tmin\nTakeoff\t6\t1,5\nCharge;-2;10\nbad line\n"); assert.deepEqual(r.phases, [{ name: "Takeoff", kw: 6, min: 1.5 }, { name: "Charge", kw: -2, min: 10 }]); assert.equal(r.errors.length, 1, "the header is skipped, the bad line said");
  const S = phaseSummary(r.phases); near(S.kwhOut, 0.15, 1e-9, "6 kW × 1,5 min"); near(S.kwhIn, 2 / 6, 1e-9, "2 kW × 10 min"); assert.equal(S.peak, 6);
  const p = phaseProfile(r.phases, { id: "x", name: "X" }); assert.equal(p.events.length, 4); assert.deepEqual(p.events.map((e) => e.t), [0, 90000, 690000, 810000]);
  assert.deepEqual([p.events[0].plant.mode, p.events[0].plant.power, p.events[1].plant.power, p.events[2].plant.mode], ["power", 6, -2, "rest"]); assert.ok(p.events[0].phase.color && p.events[1].phase.name === "Charge");
  assert.match(read("web/js/modules/sw.js"), /plantSections\(d, change/); assert.match(read("web/js/modules/sw.js"), /openPhases\(design, change/);
  const ui = read("web/js/modules/sw_plant_ui.js"); for (const w of [/data-sw-param/, /swp-row\$\{sure \? "" : " guess"\}/, /confirmAll/, /sketch\(n\)/]) assert.match(ui, w);
  const mi = read("web/js/modules/sw_mission.js"); for (const w of [/"SoC"/, /"Puissance"/, /x\.tk\[q\]/, /e\.phase \? e\.phase\.color/]) assert.match(mi, w);
});
