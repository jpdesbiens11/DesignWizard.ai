// From an analytical model to the simulation, with the same geometry : the simplified model and its load case.
//   node --test tests/node/study.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { studyOf, putStudy, studyId, STUDY_MODELS } from "../../web/js/analysis/physics/to_fea.js";
import { run, sessionDefaults, MODELS } from "../../web/js/analysis/physics/index.js";
import { CASE_KEYS } from "../../web/js/analysis/fea/case_store.js";
import { NATURES, natureKey } from "../../web/js/core/shop_levels.js";
import { stairOf } from "../../web/js/core/stairs.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const of = (id, patch = {}) => studyOf(id, run(id, { ...sessionDefaults(id), ...patch }).inputs);

test("a cantilever, a plate and a wall are carried as they are : same dimensions, same material, same supports and load", () => {
  const c = of("beam_cantilever_point", { L: 1000, b: 100, h: 100, F: 1000 });
  assert.ok(c.ok); assert.equal(c.id, "MS-CANT"); assert.deepEqual(c.part.features, [{ op: "box", id: "bar", name: "Poutre", size: [1000, 100, 100] }]); assert.equal(c.part.material, "AL6061-T6");
  assert.deepEqual(c.case.fixed, ["face:-X"]); assert.deepEqual(c.case.loads, [{ region: "face:+X", mode: "force", F: 1000, dir: "-Z", p: 0.1 }]); assert.equal(c.case.kind, "structure"); assert.equal(c.case.id, "MS-CANT");
  for (const k of CASE_KEYS) assert.ok(k in c.case, `the case is whole : ${k}`);
  assert.equal(c.part.study.model, "beam_cantilever_point"); assert.equal(c.part.study.inputs.L, 1000); assert.match(c.part.function, /Ce n'est pas une pièce du produit/); assert.deepEqual(c.notes, []);
  const round = of("beam_cantilever_point", { section: "round", d: 25.4, L: 254 }); assert.deepEqual(round.part.features[0], { op: "cylinder", id: "bar", name: "Barreau", d: 25.4, h: 254, at: [0, 0, 0], axis: "X" }); assert.match(round.says, /en escalier/);
  const udl = of("beam_cantilever_udl", { L: 200, b: 20, h: 10, F: 400 }); assert.equal(udl.case.loads[0].mode, "pressure"); assert.equal(udl.case.loads[0].region, "face:+Z"); assert.ok(Math.abs(udl.case.loads[0].p - 400 / (200 * 20)) < 1e-9, "the distributed load is the same total, as a pressure");
  const plate = of("plate_pressure", { edges: "fixed", a: 100, b: 200, t: 4, p: 50 }); assert.deepEqual(plate.part.features[0].size, [200, 100, 4]); assert.deepEqual(plate.case.fixed, ["face:-X", "face:+X", "face:-Y", "face:+Y"]); assert.ok(Math.abs(plate.case.loads[0].p - 0.05) < 1e-12); assert.equal(plate.case.cells, 6000);
  const wall = of("conduction_stack", { A: 400, P: 20, Tc: 40, t1: 3, t2: 0, t3: 0, tim_t: 0, Rc: 0 }); assert.equal(wall.case.kind, "thermal"); assert.deepEqual(wall.case.fixedT, [{ region: "face:-Z", T: 40 }]); assert.deepEqual(wall.case.power, [{ region: "face:+Z", P: 20 }]); assert.equal(wall.case.conv.on, false); assert.deepEqual(wall.part.features[0].size, [20, 20, 3]);
  // typed values instead of a medium : the simulation takes a known material, and says so
  const typed = studyOf("beam_cantilever_point", run("beam_cantilever_point", { L: 100, b: 10, h: 10, F: 10, E: 200, mat: "" }).inputs); assert.equal(typed.part.material, "AL6061-T6"); assert.match(typed.notes[0], /valeurs de matière tapées/);
});

test("what the simulation cannot hold exactly is said, and nothing is made", () => {
  assert.match(of("beam_cantilever_point", { section: "custom" }).why, /n'a pas de forme/); assert.match(of("beam_cantilever_point", { section: "tube" }).why, /tube/); assert.match(of("beam_cantilever_udl", { section: "round" }).why, /section rectangulaire/);
  assert.match(of("plate_pressure", { edges: "ss" }).why, /simplement appuyés/); assert.match(of("conduction_stack", {}).why, /qu'un matériau/);
  assert.match(of("beam_simple_point").why, /appuis simples/); assert.match(of("column_buckling").why, /flambement/); assert.match(of("shaft_torsion").why, /couple/); assert.match(of("busbar").why, /pas de géométrie/); assert.equal(studyOf("nope", {}).ok, false);
  for (const m of MODELS) { const s = of(m.id); assert.ok(s.ok === true || (s.ok === false && s.why.length > 30), `${m.id} is carried, or says why not`); }
  assert.deepEqual(STUDY_MODELS, ["beam_cantilever_point", "beam_cantilever_udl", "plate_pressure", "conduction_stack"]); assert.equal(studyId("beam_cantilever_point"), "MS-CANT"); assert.equal(studyId("some_model"), "MS-SOME-MODEL");
});

test("one simplified model per analytical model : made once, then updated ; filed last, outside the product", () => {
  const p = { id: "p", parts: [{ id: "A", process: "cnc_milling" }], assemblies: [], cases: [{ id: "A", kind: "structure" }] };
  const s1 = of("beam_cantilever_point", { F: 100 }); assert.equal(putStudy(p, s1), "MS-CANT"); assert.equal(p.parts.length, 2); assert.equal(p.cases.length, 2);
  p.parts[1].look = { color: "#ff0000" }; const s2 = of("beam_cantilever_point", { F: 250, L: 300 }); putStudy(p, s2);
  assert.equal(p.parts.length, 2, "the same part"); assert.equal(p.parts[1].features[0].size[0], 300); assert.equal(p.parts[1].look.color, "#ff0000", "what the person gave it is kept"); assert.equal(p.cases.filter((c) => c.id === "MS-CANT").length, 1); assert.equal(p.cases.find((c) => c.id === "MS-CANT").loads[0].F, 250);
  assert.equal(p.cases.find((c) => c.id === "A").kind, "structure", "the cases of the other parts are left alone");
  assert.equal(natureKey(p.parts[1]), "study"); assert.equal(NATURES[NATURES.length - 1].key, "study", "simplified models come last in the Shop"); assert.equal(natureKey(p.parts[0]), "machined");
  const up = stairOf("fea", ["MS-CANT"], p); assert.equal(up.hash, "#/physics/beam_cantilever_point/MS-CANT"); assert.match(up.tip, /modèle analytique/);
  const ui = read("web/js/modules/physics.js"); assert.match(ui, /function toSimulation\(\)/); assert.match(ui, /putStudy\(p, s\)/); assert.match(ui, /made\.study\.model === cur\.id/); assert.match(read("web/css/shop.css"), /\.sim-chip/);
});
