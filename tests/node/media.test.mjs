/* The base of media : every solid, liquid and gas the analytical models know. A model asks for a medium, not for a value ;
   the properties follow from it and cannot be typed over. Solids first, then liquids, then gases. */
import test from "node:test";
import assert from "node:assert/strict";
import { MEDIA, MEDIA_STATES, MEDIA_PROPS, MODEL_MEDIA, medium, mediumProps, mediaMenu, mediaSlots, mediaDefaults, mediaValues } from "../../web/js/analysis/physics/media.js";
import { MODELS, model, defaults, sessionDefaults, run, prefill, exampleKeys, inputIssues } from "../../web/js/analysis/physics/index.js";
import { FLUIDS, FLUID_OPTIONS, PROP_IDS } from "../../web/js/analysis/physics/props.js";
import { MATERIALS } from "../../web/js/cad/materials.js";

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≠ ${b}`);

test("the base holds the solids of the library of parts, then the liquids, then the gases — by group, by name", () => {
  assert.deepEqual(MEDIA_STATES.map((s) => s.id), ["solid", "liquid", "gas"]); assert.ok(MEDIA_STATES.every((s) => s.label && s.hint && s.icon && /^#[0-9a-f]{6}$/.test(s.color)));
  const states = MEDIA.map((m) => m.state); assert.deepEqual(states, [...states].sort((a, b) => ["solid", "liquid", "gas"].indexOf(a) - ["solid", "liquid", "gas"].indexOf(b)), "solids, then liquids, then gases");
  assert.equal(MEDIA.filter((m) => m.state === "solid").length, PROP_IDS.filter((id) => MATERIALS.some((m) => m.id === id)).length, "every material of the parts that has properties is a medium"); assert.equal(new Set(MEDIA.map((m) => m.id)).size, MEDIA.length);
  assert.deepEqual(MEDIA.filter((m) => m.state === "liquid").map((m) => m.id).sort(), ["glycol50", "oil32", "oil46", "oil68", "water"]); assert.deepEqual(MEDIA.filter((m) => m.state === "gas").map((m) => m.id).sort(), ["air", "co2", "helium", "nitrogen"]);
  for (const m of MEDIA) { assert.ok(m.name && m.group && m.basis && m.basis.length > 30, m.id); assert.ok(Number.isFinite(m.props.rho) && m.props.rho > 0, `${m.id} has a density`); for (const k of Object.keys(m.props)) assert.ok(MEDIA_PROPS[k], `${m.id}.${k} is a known property`); }
  for (const [k, d] of Object.entries(MEDIA_PROPS)) assert.ok(d.label && d.fr && typeof d.unit === "string" && !/[éèàç]/.test(d.label), k);
  // the menu : the states in their order, metals before plastics, a group in alphabetical order inside
  const menu = mediaMenu(); assert.deepEqual(menu.map((s) => s.id), ["solid", "liquid", "gas"]); const solids = menu[0].groups.map((g) => g.group);
  assert.ok(solids.indexOf("Aluminium") < solids.indexOf("ABS") && solids.indexOf("Titanium") < solids.indexOf("Polycarbonate (PC)"), "the metals come first"); assert.ok(solids.indexOf("Aluminium") < solids.indexOf("Copper") && solids.indexOf("Copper") < solids.indexOf("Steel"));
  for (const s of menu) for (const g of s.groups) assert.deepEqual(g.list.map((m) => m.name), [...g.list.map((m) => m.name)].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })), `${g.group} is in the order of the names`);
  assert.deepEqual(mediaMenu(["liquid", "gas"]).map((s) => [s.id, s.count]), [["liquid", 5], ["gas", 4]]); assert.deepEqual(mediaMenu(null, "glycol").flatMap((s) => s.groups.flatMap((g) => g.list.map((m) => m.id))), ["glycol50"]); assert.deepEqual(mediaMenu(null, "hélium").map((s) => s.id), ["gas"], "found by its French name too"); assert.deepEqual(mediaMenu(null, "zzz"), []);
});

test("a medium gives its properties : a solid at room temperature, a fluid at the temperature asked", () => {
  const al = medium("AL6061-T6"); assert.deepEqual([al.state, al.group, al.name], ["solid", "Aluminium", "Aluminium 6061-T6"]); assert.deepEqual([al.props.E, al.props.Re, al.props.rho, al.props.k, al.props.cp, al.props.cte, al.props.Tmelt], [69, 276, 2700, 167, 896, 23.6, 582]);
  assert.equal(medium("CU-C110").props.rhoE_n, 17.24, "the resistivity of copper, in nΩ·m"); assert.equal(medium("ABS").props.rhoE_n, null, "a plastic has none"); assert.equal(medium("nope"), null); assert.equal(mediumProps("nope"), null);
  const w = mediumProps("water"), w80 = mediumProps("water", 80); near(w.rho, 998.2); near(w.mu_mPa, 1.002, 5e-3); near(w80.mu_mPa, 0.351, 0.02); assert.ok(w80.rho < w.rho); assert.deepEqual(medium("water").range, [0, 100]);
  // the gases added to the base, against the usual values at 20 °C and 1 atm
  near(mediumProps("nitrogen").rho, 1.165, 5e-3); near(mediumProps("nitrogen").mu_mPa, 0.0176, 0.01); near(mediumProps("co2").rho, 1.83, 0.01); near(mediumProps("co2").mu_mPa, 0.0147, 0.01); near(mediumProps("helium").rho, 0.1664, 5e-3); near(mediumProps("helium").mu_mPa, 0.0196, 0.01); near(mediumProps("helium").k, 0.15, 0.02);
  near(FLUIDS.oil46.at(40).nu, 46e-6, 0.01); near(FLUIDS.oil68.at(40).nu, 68e-6, 0.01); near(FLUIDS.oil68.at(100).nu, 8.7e-6, 0.02); assert.ok(mediumProps("oil68").mu_mPa > mediumProps("oil46").mu_mPa && mediumProps("oil46").mu_mPa > mediumProps("oil32").mu_mPa);
  for (const id of ["nitrogen", "co2", "helium", "oil46", "oil68"]) assert.match(medium(id).basis, /non relue?s?/, `${id} says its figures were not read again`);
  assert.deepEqual(FLUID_OPTIONS.filter((o) => !o.legacy).map((o) => o.value), ["glycol50", "oil32", "oil46", "oil68", "water", "air", "co2", "helium", "nitrogen"], "liquids, then gases, by name"); assert.equal(FLUID_OPTIONS.at(-1).value, "custom");
});

test("a model asks for a medium : its properties follow, and what was typed over them does not count", () => {
  for (const [id, slots] of Object.entries(MODEL_MEDIA)) { const m = model(id); assert.ok(m, id); assert.deepEqual(m.media, slots);
    for (const s of slots) { assert.ok(s.key && s.label && medium(s.def) && s.states.includes(medium(s.def).state), `${id}.${s.key}`); for (const [k, prop] of Object.entries(s.gives)) { const d = m.inputs.find((x) => x.key === k); assert.ok(d && !d.options, `${id} : ${k} is one of its inputs`); assert.ok(MEDIA_PROPS[prop], prop);
      near(mediumProps(s.def)[prop], d.default, 5e-3);      // the medium proposed gives the value the model had by default (G of 6061 : 25,94 for the 26 it showed)
    } } }
  assert.equal(MODELS.filter((m) => m.media.length).length, 19); assert.deepEqual(MODELS.filter((m) => !m.media.length).map((m) => m.id), ["junction_temperature", "pcb_trace"]);
  assert.deepEqual(mediaDefaults("thermal_mismatch"), { mat1: "AL6061-T6", mat2: "STEEL-1018" }); assert.deepEqual(mediaSlots("nope"), []); assert.equal(sessionDefaults("beam_simple_udl").mat, "AL6061-T6"); assert.equal(defaults("beam_simple_udl").mat, undefined, "the bare defaults stay values : a script may still give its own");
  // the same beam in aluminium, then in steel : only the medium changes
  const base = { ...sessionDefaults("beam_cantilever_point") }, al = run("beam_cantilever_point", base), st = run("beam_cantilever_point", { ...base, mat: "STEEL-1018" });
  assert.deepEqual([al.inputs.E, st.inputs.E, st.inputs.Re, st.inputs.rho], [69, 205, 370, 7870]); near(st.values.delta, al.values.delta * 69 / 205, 1e-9); assert.match(st.media.from.E.name, /^Steel 1018/);
  assert.equal(run("beam_cantilever_point", { ...base, mat: "STEEL-1018", E: 1 }).values.delta, st.values.delta, "a value typed over the medium is not taken"); assert.equal(run("beam_cantilever_point", { ...defaults("beam_cantilever_point"), E: 138 }).inputs.E, 138, "without a medium, the value given stands (a run kept before the base)");
  assert.equal(run("beam_cantilever_point", { ...base, mat: "water" }).inputs.mat, "", "a liquid is not a beam"); assert.equal(run("beam_cantilever_point", { ...base, mat: "water" }).inputs.E, 69);
  // two media in one model, and a fluid that follows its temperature
  const mm = run("thermal_mismatch", { ...sessionDefaults("thermal_mismatch"), mat1: "CU-C110", mat2: "SS-304" }); assert.deepEqual([mm.inputs.cte1, mm.inputs.E1, mm.inputs.cte2, mm.inputs.E2], [17, 117, 17.3, 193]);
  const hot = mediaValues("pipe_flow", { fluid: "helium", T: 80 }); assert.deepEqual(hot.shown[0].rows.map((r) => r[0]), ["Density ρ", "Dynamic viscosity μ"]); near(hot.shown[0].rows[0][1], 0.1381, 2e-3); assert.equal(hot.shown[0].T, 80);
  assert.ok(run("pipe_flow", { ...sessionDefaults("pipe_flow"), fluid: "nitrogen", Q: 5 }).steps[0].includes("Nitrogen N₂"), "the new gases run in the pipe model");
  // a property the medium does not have : the run says so, and keeps the example
  const pl = run("busbar", { ...sessionDefaults("busbar"), mat: "ABS" }); assert.ok(pl.warnings.some((w) => /ABS : résistivité électrique à 20 °C inconnue de la base des médias/.test(w))); assert.equal(pl.verdict === "ok", false);
  // the guide : the medium proposed is the example to confirm, not the values it gives
  const eg = exampleKeys(model("beam_cantilever_point"), base, new Set()); assert.equal(eg[0], "mat"); assert.ok(!eg.includes("E") && !eg.includes("Re") && !eg.includes("rho") && eg.includes("L"));
  assert.ok(!exampleKeys(model("beam_cantilever_point"), base, new Set(["mat"])).includes("mat")); assert.match(inputIssues(model("beam_cantilever_point"), base, al, { examples: eg })[0].text, /Matériau de la poutre/);
  assert.deepEqual(prefill("press_fit", { spec: { material: "SS-304" } }).inputs, { mat_h: "SS-304" }, "the part gives the first medium of the model");
});
