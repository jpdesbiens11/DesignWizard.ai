// Reference cases : published worked examples replayed by the analytical models and by the solver of the simulation.
//   node --test tests/node/validation.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCase, caseProblems, casesFor, coverage, gapText, verdictOf, READ_LEVELS, HOW, FEA_KINDS } from "../../web/js/analysis/validation.js";
import { CASES, GAPS, NONE } from "../../web/js/analysis/validation_cases.js";
import { FEA_CASES, FEA_GAPS, solveFea } from "../../web/js/analysis/validation_fea.js";
import { MODELS, model, defaults } from "../../web/js/analysis/physics/index.js";
import { THREADS } from "../../web/js/analysis/physics/models_joints.js";
import { METHODS } from "../../web/js/core/methods.js";
import { validationDoc } from "../../tools/validation_doc.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), ALL = [...CASES, ...FEA_CASES];

test("every case names its source, says how it was read and how it is replayed, and quotes what the source prints", () => {
  assert.equal(new Set(ALL.map((c) => c.id)).size, ALL.length, "ids are unique");
  for (const c of ALL) assert.deepEqual(caseProblems(c), [], c.id);
  for (const c of ALL) { assert.ok(READ_LEVELS[c.source.read] && HOW[c.how], c.id); assert.ok(c.source.licence, `${c.id} says the licence its source states`); assert.ok(c.given.length >= 2, `${c.id} gives what the source gives`); }
  // a faulty case is caught : no source, a tolerance too wide, a value that is not quoted as printed, an input the model does not know
  const bad = caseProblems({ id: "x", title: "x", model: "beam_cantilever_point", how: "direct", source: { name: "", where: "", read: "read" }, given: [], inputs: { nope: 1 }, expect: [{ key: "delta", value: 1, tol: 0.5 }, { key: "ghost", value: 1, printed: "1", tol: 0.01 }] });
  for (const word of [/source sans nom/, /dit quelle page/, /données de la source/, /telle qu'imprimée/, /tolérance/, /n'est pas une entrée/, /n'est pas un résultat/]) assert.ok(bad.some((t) => word.test(t)), String(word));
});

test("the expected value is the one the source prints : it is never worked out with the model", () => {
  const cases = read("web/js/analysis/validation_cases.js"), fea = read("web/js/analysis/validation_fea.js");
  assert.ok(!/^import /m.test(cases), "the cases of the analytical models import nothing : no formula of the tool can enter an expected value");
  assert.deepEqual([...fea.matchAll(/^import .* from "(.*)";$/gm)].map((m) => m[1]), ["./fea/index.js"], "the cases of the simulation import the solver only");
  for (const [file, text] of [["cases", cases], ["fea", fea]]) for (const m of text.matchAll(/\bvalue: ([^,}]+)/g)) assert.match(m[1].trim(), /^(?:[\d.e+\-*/ ()]|IN4?|INLBF|LBF|PSI|beta|alpha|k)+$/, `${file} : « value: ${m[1]} » is a number of the source, with at most a unit conversion`);
  for (const c of ALL) for (const e of c.expect) assert.ok(typeof e.printed === "string" && /\d/.test(e.printed), `${c.id}.${e.key} quotes the source`);
});

test("every analytical case is found again, inside the tolerance its source allows, and replayed faithfully", () => {
  for (const c of CASES) {
    const r = runCase(c);
    assert.deepEqual(r.unfaithful, [], `${c.id} : the model took the data of the source as they are`);
    for (const x of r.rows) assert.ok(x.ok, `${c.id} · ${x.label} : source ${x.printed} (${x.expected}), tool ${x.obtained}, gap ${gapText(x.gap)} for ± ${x.tol * 100} %`);
    assert.ok(r.ok && r.ran);
    for (const k of Object.keys(c.inputs)) assert.ok(model(c.model).inputs.some((d) => d.key === k), `${c.id} : ${k}`);
  }
  assert.equal(verdictOf(CASES.map((c) => runCase(c))).bad, 0);
});

test("a case replayed unfaithfully fails, whatever it finds", () => {
  const c = CASES.find((x) => x.id === "cantilever-end-ub"), far = runCase({ ...c, inputs: { ...c.inputs, L: 5e6 } });      // 5 km : outside what the model accepts, it is brought back to 50 m
  assert.equal(far.ok, false); assert.match(far.unfaithful[0], /« L » : 5000000 entré, 50000 retenu/);
  const euler = CASES.find((x) => x.id === "euler-fixed-fixed"), stocky = runCase({ ...euler, inputs: { ...euler.inputs, Ac: 150 } });      // a stocky column : the model leaves Euler for Johnson, it is no longer the case of the source
  assert.equal(stocky.ok, false); assert.match(stocky.unfaithful.join(" "), /johnson/);
  const off = runCase({ ...c, expect: [{ key: "delta", value: 9, printed: "9 mm", tol: 0.01 }] }); assert.equal(off.ok, false); assert.equal(off.rows[0].ok, false);
  assert.equal(runCase(FEA_CASES[0]).ran, false, "a case of the simulation is not run without its solver");
});

test("the solver of the simulation finds the published examples again, each on the mesh it states", () => {
  const got = {};
  for (const c of FEA_CASES) { const r = runCase(c, { fea: solveFea }); got[c.id] = r; assert.ok(c.mesh && /maille/.test(c.mesh), `${c.id} says its mesh`);
    for (const x of r.rows) assert.ok(x.ok, `${c.id} · ${x.label} : source ${x.printed}, solver ${x.obtained}, gap ${gapText(x.gap)} for ± ${x.tol * 100} %`); }
  const gap = (id, key) => got[id].rows.find((x) => x.key === key).gap;
  assert.ok(Math.abs(gap("fea-two-rods", "joint")) < 0.002 && Math.abs(gap("fea-two-rods", "P")) < 0.005, "conduction in series : to a few tenths of a percent");
  assert.ok(Math.abs(gap("fea-rod-tension", "sigma")) < 0.005 && Math.abs(gap("fea-blocked-concrete", "sigma")) < 0.005);
  // the round bar is the honest one : cubes draw a round section in steps, and the case says the gap it has — it is not hidden by a finer mesh
  const round = gap("fea-cantilever-round", "tip"); assert.ok(round < -0.02 && round > -0.08, `round cantilever ${gapText(round)}`); assert.match(FEA_CASES.find((c) => c.id === "fea-cantilever-round").mesh, /en escalier/);
  console.log(`  simulation : ${FEA_CASES.map((c) => `${c.id} ${got[c.id].rows.map((x) => gapText(x.gap)).join(" / ")}`).join(" ; ")}`);
});

test("nothing is validated by default : a model has a case, or the word that it has none ; a model with cases says what they leave out", () => {
  const cov = coverage(ALL), ids = [...MODELS.map((m) => m.id), ...FEA_KINDS.map((k) => k.id)];
  assert.equal(cov.total, ids.length); assert.equal(cov.cases, ALL.length);
  assert.deepEqual(cov.missing.map((m) => m.id).sort(), Object.keys(NONE).sort(), "the models without a case are exactly those that say so");
  for (const id of ids) { const n = casesFor(ALL, id).length, gaps = GAPS[id] || FEA_GAPS[id];
    if (n) assert.ok(gaps && gaps.length > 30 && !NONE[id], `${id} says what its ${n} case(s) do not cover`); else assert.ok(NONE[id] && NONE[id].length > 30 && !gaps, `${id} says it has no case`); }
  for (const k of [...Object.keys(GAPS), ...Object.keys(NONE), ...Object.keys(FEA_GAPS)]) assert.ok(ids.includes(k), `${k} is a model`);
  assert.ok(cov.covered >= 18 && cov.read >= 25);
  assert.equal(coverage([]).covered, 0); assert.equal(gapText(0.00004), "0,0 %"); assert.equal(gapText(-0.049), "−4,9 %"); assert.equal(gapText(0.12), "+12 %"); assert.equal(gapText(NaN), "—");
});

test("the bolt model reaches the M30 of the published example", () => {
  assert.deepEqual(THREADS.M30, [3.5, 33]); assert.deepEqual(THREADS.M20, [2.5, 22]); assert.deepEqual(THREADS.M24, [3, 26]);
  assert.match(model("bolted_joint").validity, /M2 à M30/); assert.ok(model("bolted_joint").inputs.find((d) => d.key === "size").options.some((o) => o.value === "M30"));
  assert.equal(defaults("bolted_joint").size, "M6");
});

test("the cases are on the screens, in the register of sources and in the document", () => {
  const view = read("web/js/modules/validation_view.js");
  assert.match(read("web/js/modules/physics_panels.js"), /validationSection\(\{ id: cur\.id, load: o\.loadCase \}\)/); assert.match(read("web/js/modules/physics.js"), /function loadCase\(c\)/);
  assert.match(read("web/js/modules/fea.js"), /validationSection\(\{ ids: \{ structure: \["fea:structure"\]/); assert.match(read("web/js/modules/help.js"), /validationCard\(/);
  assert.match(view, /"data-fold-note": note/); assert.match(view, /La valeur attendue n'est jamais calculée ici/); assert.match(view, /Ce que ces cas ne couvrent pas/); assert.match(view, /underVeil\(pageVeil\(\)/);
  assert.match(read("web/css/shop.css"), /\.val-case \{/);
  for (const id of ["validation-cases", "validation-openstax", "validation-toolbox", "validation-others"]) { const m = METHODS.find((x) => x.id === id); assert.ok(m && m.where === "#/help/validation" && m.doc === "docs/VALIDATION.md" && m.check.length > 60, id); }
  assert.match(METHODS.find((x) => x.id === "validation-others").check, /le Roark lui-même n'a pas été ouvert/);
  assert.equal(read("docs/VALIDATION.md"), validationDoc(), "docs/VALIDATION.md is what `node tools/validation_doc.mjs` writes");
});
