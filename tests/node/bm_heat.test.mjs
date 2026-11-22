/* The BM resumed (JP, 22 novembre 2026 : « effort sur la pile et tenue des vis, échauffement du module fermé ») : the screws of the lids in the
   polycarbonate, by a published pull-out formula ; the heat of the closed module, at the full current of its cells and at the current it
   carries for ever.   node --test tests/node/bm_heat.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run, model } from "../../web/js/analysis/physics/index.js";
import { NONE } from "../../web/js/analysis/validation_cases.js";
import { lidForces } from "../../web/js/demo/demo_bm_lid.js";
import { lidScrews, screwHolding, moduleHeat, sustainedCurrent, heatCalcs } from "../../web/js/demo/demo_bm_heat.js";
import { bmProject, CASE_L } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("a screw in a plastic boss : F = Ss π Dp L with Ss = St / √3, the plastic read from its medium ; its rules of thumb said ; no published case, said", () => {
  const r = run("plastic_screw", { mat: "PC", d: 4, Dp: 3.4, L: 10, Db: 10, F: 200, sf: 3 });
  assert.equal(r.inputs.St, 62, "the yield strength comes from the medium, not from the keyboard");
  assert.ok(Math.abs(r.values.F_pull - (62 / Math.sqrt(3)) * Math.PI * 3.4 * 10) < 1e-9); assert.equal(r.verdict, "ok"); assert.equal(r.warnings.length, 0);
  const thin = run("plastic_screw", { mat: "PC", d: 4, Dp: 3.4, L: 6, Db: 7, F: 200 }); assert.ok(thin.warnings.some((w) => /2,5 Dp/.test(w)) && thin.warnings.some((w) => /fendre/.test(w)), "a short engagement and a thin boss are said");
  assert.equal(run("plastic_screw", { mat: "PC", F: 5000 }).verdict, "fail");
  assert.match(NONE.plastic_screw, /n'en donne pas/); assert.match(model("plastic_screw").reference, /Engineers Edge/);
});

test("the screws of the lids : the load of the worst ring, the hole for the pitch diameter, the lobe for the boss — they hold, and the lobe is said thin", () => {
  const s = lidScrews(), k = screwHolding(); assert.equal(s.perScrew, lidForces().perScrew); assert.equal(s.perScrew, 350);
  assert.equal(k.inputs.F, 350); assert.ok(k.values.sf_pull > 3, "a margin above the factor asked"); assert.ok(k.checks.every((c) => c.ok !== false));
  assert.ok(k.values.Db_d < 2.5, "the lobe is thinner than 2.5 d : said, not hidden"); assert.equal(k.verdict, "warn");
});

test("the closed module : the cells dominate the heat ; at the full current it reaches the limit of the cells within one discharge ; it carries about 95 A for ever", () => {
  const H = moduleHeat(360, CASE_L), cells = H.sources.find((x) => x.id === "cells").W;
  assert.ok(H.P > 1000 && cells / H.P > 0.95, "the cells, counted at their lowest, give nearly all of it"); assert.ok(H.sources.every((x) => x.W > 0));
  const [full, cont] = heatCalcs(CASE_L), sus = sustainedCurrent(CASE_L);
  assert.equal(full.verdict, "fail"); assert.ok(full.values.t_lim < full.inputs.time, "the limit comes before the end of the discharge");
  assert.ok(sus.I > 80 && sus.I < 110); assert.equal(cont.verdict, "ok"); assert.ok(cont.values.T_inf <= 80);
  assert.equal(full.inputs.mat, "LI-ION-CELL"); assert.equal(full.inputs.cp, 1000, "the heat capacity comes from the medium");
});

test("the calculations are kept in the project ; the document says what is counted, what is bounded and what is not done", () => {
  const ids = bmProject().physics.map((x) => x.id); for (const id of ["phy-bm-screws", "phy-bm-heat", "phy-bm-heat-cont"]) assert.ok(ids.includes(id), id);
  const doc = read("docs/BM_MODULE.md"); for (const re of [/Itération 13/, /plastic_screw/, /borne basse/, /Pas fait/]) assert.match(doc, re);
});
