/* Units : SI inside, converted at the edges. Two systems — SI, and an imperial engineering hybrid that keeps the metre, the
   metre per second and the kilogram — and a choice of its own for a pressure : kPa, bar, psi, atm. */
import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_SYSTEMS, PRESSURE_UNITS, SI_UNITS, tidyUnits, pressureUnit, shownUnit, toShown, fromShown, converts, dualOf, pressureEquivalents, quantity, fieldValue, getUnits, setUnits } from "../../web/js/core/units.js";
import { MODELS, model, defaults, run } from "../../web/js/analysis/physics/index.js";
import { sceneOf } from "../../web/js/analysis/physics/scene3d.js";
import { physicsSummary, qty } from "../../web/js/modules/physics_panels.js";

const IMP = { system: "imperial" }, near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("the preferences are tidy : two systems, four pressure units, SI by default", () => {
  assert.deepEqual(Object.keys(UNIT_SYSTEMS), ["si", "imperial"]); assert.deepEqual(Object.keys(PRESSURE_UNITS), ["kPa", "bar", "psi", "atm"]);
  assert.deepEqual(tidyUnits(null), { system: "si", pressure: "auto" }); assert.deepEqual(tidyUnits({ system: "cgs", pressure: "torr" }), { system: "si", pressure: "auto" }); assert.deepEqual(tidyUnits({ system: "imperial", pressure: "bar" }), { system: "imperial", pressure: "bar" });
  assert.deepEqual(tidyUnits({ pressure: "toString" }), { system: "si", pressure: "auto" }, "a name of the language is not a unit");
  assert.equal(pressureUnit(SI_UNITS), "kPa"); assert.equal(pressureUnit(IMP), "psi"); assert.equal(pressureUnit({ system: "imperial", pressure: "atm" }), "atm"); assert.equal(pressureUnit({ pressure: "bar" }), "bar");
  assert.deepEqual(getUnits(), { system: "si", pressure: "auto" }, "without a browser : SI"); assert.deepEqual(setUnits({ system: "imperial" }), { system: "imperial", pressure: "auto" }); assert.equal(getUnits().system, "imperial"); setUnits({ system: "si" });
});

test("the factors are the defined ones, and they agree with one another", () => {
  near(toShown(25.4, "mm", IMP), 1); near(toShown(1, "µm", IMP), 39.37007874015748); near(toShown(645.16, "mm²", IMP), 1); near(toShown(6.4516, "cm²", IMP), 1); near(toShown(25.4 ** 4, "mm⁴", IMP), 1);
  near(toShown(4.4482216152605, "N", IMP), 1); near(toShown(0.45359237 * 9.80665, "N", IMP), 1, 1e-12);                       // a pound-force is a pound under standard gravity
  near(toShown(1, "kPa", IMP), 0.1450377377302092, 1e-12); near(toShown(4.4482216152605 / 645.16, "MPa", IMP), 0.001, 1e-12);        // a psi is a pound-force on a square inch
  near(toShown(6.894757293168361, "MPa", IMP), 1); near(toShown(6.894757293168361, "GPa", IMP), 1); near(toShown(6894.757293168361, "Pa", IMP), 1);
  near(toShown(4.4482216152605 * 0.0254, "N·m", IMP), 1); near(toShown(1, "N·m", IMP), 8.8507, 1e-5); near(toShown(4.4482216152605 * 25.4, "N·mm", IMP), 1); near(toShown(4.4482216152605 / 25.4, "N/mm", IMP), 1); near(toShown(1, "N/mm", IMP), 5.7101, 1e-5);
  near(toShown(231 * 25.4 ** 3 / 1e6, "L/min", IMP), 1, 1e-12);                                                              // a US gallon is 231 cubic inches
  near(toShown(101.325, "kPa", { pressure: "atm" }), 1); near(toShown(100, "kPa", { pressure: "bar" }), 1); near(toShown(6.894757293168361, "kPa", { pressure: "psi" }), 1); assert.equal(toShown(12, "kPa", SI_UNITS), 12);
  assert.deepEqual(dualOf(0.45359237, "kg", IMP), [1, "lb"]); near(dualOf(453.59237, "g", IMP)[0], 16); assert.equal(dualOf(1, "kg", SI_UNITS), null); assert.equal(dualOf(1, "mm", IMP), null);
});

test("imperial is a hybrid : the inch, the pound-force and what derives from them — the metre, the m/s and the kg stay", () => {
  const shown = { "mm": "in", "µm": "µin", "mm²": "in²", "cm²": "in²", "mm³": "in³", "mm⁴": "in⁴", "N": "lbf", "kN": "lbf", "N·m": "lbf·in", "N·mm": "lbf·in", "N/mm": "lbf/in", "N·m/rad": "lbf·in/rad", "MPa": "ksi", "GPa": "Msi", "kPa": "psi", "Pa": "psi", "L/min": "gal/min" };
  for (const [u, v] of Object.entries(shown)) { assert.equal(shownUnit(u, IMP), v, u); assert.equal(shownUnit(u, SI_UNITS), u); assert.ok(converts(u, IMP)); assert.ok(!converts(u, SI_UNITS)); }
  for (const u of ["m", "m/s", "kg", "g", "kg/m³", "°C", "K", "K/W", "W", "W/m·K", "W/m²·K", "J/kg·K", "A", "A/mm²", "mPa·s", "m³/h", "s", "Hz", "%", "°", ""]) { assert.equal(shownUnit(u, IMP), u, `« ${u} » stays`); assert.equal(toShown(3.5, u, IMP), 3.5); assert.ok(!converts(u, IMP)); }
  // every unit a model reads or writes is either kept or converted : nothing falls through, and nothing reads in slugs
  const units = new Set(); for (const m of MODELS) for (const d of [...m.inputs, ...m.outputs]) units.add(d.unit || "");
  for (const u of units) { const s = shownUnit(u, IMP); assert.equal(typeof s, "string"); assert.ok(!/slug|pdl|poundal|BTU|°F|ft/i.test(s), `${u} → ${s}`); }
  assert.ok(units.has("mm") && units.has("kPa") && units.has("MPa") && units.has("L/min"));
  assert.equal(quantity(1.83, "kg", IMP), "1,83 kg (4,034495849943583 lb)".replace("4,034495849943583", String(1.83 / 0.45359237).replace(".", ","))); assert.equal(quantity(1.83, "kg", SI_UNITS), "1,83 kg"); assert.equal(quantity(528.7, "", IMP), "528,7");
  assert.equal(qty(1.83, "kg", IMP), "1,83 kg (4,034 lb)"); assert.equal(qty(25.4, "mm", IMP), "1 in"); assert.equal(qty(0.1326, "m/s", IMP), "0,1326 m/s");
});

test("a value typed comes back clean : a quarter of an inch is 6.35 mm, and a field shows five digits", () => {
  assert.equal(fromShown(0.25, "mm", IMP), 6.35); assert.equal(fromShown(1, "kPa", { pressure: "bar" }), 100); assert.equal(fromShown(1, "kPa", { pressure: "atm" }), 101.325); assert.equal(fromShown(7, "mm", SI_UNITS), 7); assert.equal(fromShown(2, "m/s", IMP), 2);
  assert.equal(fromShown(null, "mm", IMP), null); assert.ok(Number.isNaN(fromShown(NaN, "mm", IMP)));
  for (const [v, u] of [[4, "mm"], [1000, "mm"], [1.5, "µm"], [0.1, "L/min"], [10, "kPa"], [69, "GPa"], [250, "MPa"], [50, "N"], [12, "N·m"]]) near(fromShown(toShown(v, u, IMP), u, IMP), v, 1e-11);
  assert.equal(fieldValue(4, "mm", IMP), 0.15748); assert.equal(fieldValue(1000, "mm", IMP), 39.37); assert.equal(fieldValue(10, "kPa", IMP), 1.4504); assert.equal(fieldValue(10, "kPa", { pressure: "bar" }), 0.1); assert.equal(fieldValue(1.23456789, "mm", SI_UNITS), 1.23456789); assert.equal(fieldValue(null, "mm", IMP), null);
});

test("a pressure reads in the four units, the chosen one first", () => {
  const eq = pressureEquivalents(101.325, SI_UNITS); assert.deepEqual(eq.map((e) => e[0]), ["kPa", "bar", "psi", "atm"]); near(eq[1][1], 1.01325); near(eq[2][1], 14.695948775513, 1e-11); near(eq[3][1], 1);
  assert.deepEqual(pressureEquivalents(1, IMP).map((e) => e[0]), ["psi", "kPa", "bar", "atm"]); assert.deepEqual(pressureEquivalents(1, { pressure: "atm" }).map((e) => e[0]), ["atm", "kPa", "bar", "psi"]); assert.deepEqual(pressureEquivalents(NaN), []);
});

test("the pressure loss in a round pipe reads in kPa, psi, bar and atm, and the model follows the system", () => {
  const m = model("pipe_flow"), r = run("pipe_flow", defaults("pipe_flow")), dp = r.values.dp_kPa;
  near(dp, 128 * 1.002e-3 * 1 * (0.1 / 60000) / (Math.PI * 0.004 ** 4) / 1000, 0.02);                                         // Hagen-Poiseuille, water at 20 °C, by hand
  const eq = Object.fromEntries(pressureEquivalents(dp, SI_UNITS)); near(eq.psi, dp * 0.1450377377302092, 1e-12); near(eq.bar, dp / 100); near(eq.atm, dp / 101.325);
  assert.equal(shownUnit(m.outputs.find((o) => o.key === "dp_kPa").unit, { pressure: "psi" }), "psi"); assert.equal(shownUnit(m.inputs.find((d) => d.key === "d").unit, IMP), "in"); assert.equal(shownUnit(m.inputs.find((d) => d.key === "Q").unit, IMP), "gal/min"); assert.equal(shownUnit(m.outputs.find((o) => o.key === "v").unit, IMP), "m/s", "a speed stays in m/s");
  // the same calculation whatever is shown : the inputs stay SI inside
  const typed = { ...defaults("pipe_flow"), d: fromShown(0.25, "mm", IMP) }; near(run("pipe_flow", typed).values.dp_kPa, dp * (4 / 6.35) ** 4, 1e-9);
  const saved = { physics: [{ id: "p1", name: "Tube", model: "pipe_flow", values: r.values, checks: r.checks, verdict: r.verdict }] };
  assert.match(physicsSummary(saved, SI_UNITS)[0].result, /^Perte de charge : 0,26\d+ kPa$/); assert.match(physicsSummary(saved, IMP)[0].result, /^Perte de charge : 0,038\d+ psi$/); assert.match(physicsSummary(saved, { pressure: "bar" })[0].result, /^Perte de charge : 0,0026\d+ bar$/);
  assert.equal(physicsSummary(saved)[0].result, physicsSummary(saved, SI_UNITS)[0].result, "SI when nothing is chosen");
  const si = sceneOf(m, defaults("pipe_flow")).labels.map((l) => l.text).join(" / "), imp = sceneOf(m, defaults("pipe_flow"), IMP).labels.map((l) => l.text).join(" / ");
  assert.match(si, /Ø4 intérieur · L = 1000 mm/); assert.match(si, /Q = 0,1 L\/min/); assert.match(imp, /Ø0,157 in intérieur · L = 39,4 in/); assert.match(imp, /Q = 0,0264 gal\/min/);
  for (const mod of MODELS) for (const l of sceneOf(mod, defaults(mod.id), IMP).labels) assert.ok(!/NaN|undefined| mm\b|\bkPa\b/.test(l.text), `${mod.id} : « ${l.text} »`);
});
