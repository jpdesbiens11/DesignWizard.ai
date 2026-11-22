/* Point 6 (JP, 20 novembre 2026) : the Labo set ON the instrument — each instrument of a test drawn above the board, its cords run to the
   points of the board, its settings typed on its front and kept in the notebook of the board ; the test, its sheet and its plan follow ;
   what has nothing to turn says why ; a button of the board is pressed by a click on it in the view.
     node --test tests/node/lab_gear.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { benchGear, checkKnob, gearWords, pressFrames, KNOBS, CIRCUIT_NOTE } from "../../web/js/pcba/lab_gear.js";
import { testSheet, boardSheet, setGear, gearEnv, labOf, testKey, sheetJobs, jobSheet } from "../../web/js/pcba/lab_plan.js";
import { blockTests } from "../../web/js/pcba/lab_bench.js";
import { BLOCKS } from "../../web/js/pcba/blocks.js";
import { boardTests, BOARD_KEY } from "../../web/js/pcba/lab_board.js";
import { JACKS } from "../../web/js/modules/elab_gear.js";
import { firstBoard } from "../../web/js/demo/demo_first.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const sheetOf = (B, tpl, id, env) => { const b = B.blocks.find((x) => x.template === tpl), refs = Object.fromEntries(B.parts.filter((p) => p.block === b.id && p.local).map((p) => [p.local, p.ref])); return { b, s: testSheet(tpl, id, b.params || {}, { refs, ...(env ? { env } : {}) }) }; };

test("the instruments of a test : what each is, where its leads go, what turns on its front — and why not, when nothing does", () => {
  const { s } = sheetOf(firstBoard(), "push_led", "press"), G = benchGear(s);
  assert.deepEqual(G.map((g) => g.kind), ["supply", "meter", "press"]);
  const sup = G[0]; assert.equal(sup.key, "supply:VDD"); assert.deepEqual(sup.knobs.map((k) => k.k), ["v", "ilim"]); assert.equal(sup.knobs[0].value, 3); assert.equal(sup.fixed, "");
  assert.deepEqual(sup.leads.map((l) => l.lead), ["minus", "plus"]); assert.ok(sup.leads.every((l) => l.ref && l.pin), "each lead on a pad of the board");
  assert.match(G[1].fixed, /lit ; il ne change rien/); assert.match(G[2].fixed, /Cliquez sur le bouton dans la vue/);
  const { s: dip } = sheetOf(demoBoard(), "ldo", "dropout"), d = benchGear(dip).find((g) => g.kind === "supply");
  assert.deepEqual(d.knobs.map((k) => k.k), ["ilim"], "a supply whose shape is the test : only its limit turns"); assert.match(d.fixed, /forme .* écrite par l'essai/);
  assert.match(CIRCUIT_NOTE, /Le circuit vient du PCBA/);
});

test("a value typed on an instrument is checked against what the bench accepts", () => {
  assert.deepEqual(checkKnob("supply", "v", "4,5"), { ok: true, value: 4.5, text: "" });
  assert.equal(checkKnob("supply", "v", 80).ok, false); assert.match(checkKnob("supply", "v", 80).text, /entre 0 et 60 V/);
  assert.equal(checkKnob("supply", "ilim", 0).ok, false); assert.equal(checkKnob("load", "r", "abc").ok, false); assert.equal(checkKnob("meter", "v", 3).ok, false);
  for (const [kind, list] of Object.entries(KNOBS)) for (const k of list) assert.ok(k.min < k.max && k.unit && k.label, `${kind}.${k.k}`);
});

test("a setting is kept in the notebook of the board, taken back one value or all at once, and travels in a .dwiz", () => {
  const B = firstBoard(), k = testKey("B2", "press");
  B.lab = setGear(B, k, "supply:VDD", { v: 4.5, ilim: 0.03 }); assert.deepEqual(gearEnv(B, k), { "supply:VDD": { v: 4.5, ilim: 0.03 } }); assert.deepEqual(gearEnv(B, "B3/press"), {});
  assert.deepEqual(labOf(fromDwiz(toDwiz(B))).gears, labOf(B).gears, "the notebook travels");
  B.lab = setGear(B, k, "supply:VDD", { v: null }); assert.deepEqual(gearEnv(B, k), { "supply:VDD": { ilim: 0.03 } });
  B.lab = setGear(B, k, "supply:VDD", null); assert.deepEqual(labOf(B).gears, []);
  assert.deepEqual(labOf({ lab: { gears: [{ test: "a", gear: "scope", v: 3 }, { test: 2, gear: "supply:X" }, { test: "a", gear: "load:Y", r: "100" }] } }).gears, [{ test: "a", gear: "load:Y", r: 100 }], "only what an instrument can be set to");
});

test("the test is simulated with the bench as it is set : the sheet, its expected values and the plan follow", () => {
  const B = firstBoard(), base = sheetOf(B, "push_led", "press").s, set = sheetOf(B, "push_led", "press", { gear: { "supply:VDD": { v: 4.5, ilim: 0.05 } } }).s;
  const i0 = base.rows[0].expected, i1 = set.rows[0].expected; assert.ok(i1 > 2 * i0, `more volts, more current : ${i0} → ${i1}`);
  const l = set.links.find((x) => x.instr === "supply"); assert.equal(l.v, 4.5); assert.equal(l.ilim, 0.05); assert.equal(l.set, true); assert.equal(base.links.find((x) => x.instr === "supply").set, undefined);
  assert.match(set.settings.join("\n"), /4,5 V/); assert.match(gearWords(benchGear(set))[0], /réglée à 4,5 V, limite 50 mA : les valeurs attendues suivent/);
  B.lab = setGear(B, testKey("B2", "press"), "supply:VDD", { v: 4.5 }); const job = sheetJobs(B).find((j) => j.blockId === "B2" && j.test === "press");
  assert.deepEqual(job.gear, { "supply:VDD": { v: 4.5 } }); assert.equal(jobSheet(job).links.find((x) => x.instr === "supply").v, 4.5, "the plan is the bench as it is set");
  const shape = sheetOf(demoBoard(), "ldo", "dropout", { gear: { "supply:VIN": { v: 12 } } }).s; assert.notEqual(shape.links.find((x) => x.instr === "supply").v, 12, "a ramp stays the test's");
  const D = demoBoard(), t = boardTests(D)[0]; if (t) { const w = boardSheet(D, t.id, { env: { gear: { "supply:+24V_IN": { v: 20 } } } }), sup = w.links.find((x) => x.instr === "supply"); assert.equal(sup.v, 20, "the whole board too"); assert.equal(sup.set, true); }
});

test("a button of the board : the moments of the run where it is held, and released", () => {
  const { s } = sheetOf(firstBoard(), "push_led", "press"), R = s.result, pf = pressFrames(R, R.test.env(R.P));
  assert.ok(pf && pf.pressed.length === R.frames); assert.ok(pf.down > pf.up, "released before, held after"); assert.equal(pf.pressed[Math.round(pf.down * (R.frames - 1))], true); assert.equal(pf.pressed[Math.round(pf.up * (R.frames - 1))], false);
  assert.equal(pressFrames(R, {}), null); assert.equal(pressFrames({ kind: "ac" }, { press: () => true }), null);
});

test("every instrument of every test of every block : drawn, its cords leave from a jack of its drawing", () => {
  let n = 0;
  for (const tpl of Object.keys(BLOCKS)) for (const t of blockTests(tpl)) { if (t.noSim) continue; let s = null; try { s = testSheet(tpl, t.id, {}, {}); } catch (e) { continue; } if (!s) continue;
    for (const g of benchGear(s)) { n++; assert.ok(JACKS[g.kind], `${tpl}/${t.id} : ${g.kind} has a drawing`); for (const l of g.leads) assert.ok(JACKS[g.kind][l.lead], `${tpl}/${t.id} : ${g.kind} has a jack for ${l.lead}`); assert.ok(g.knobs.length || g.fixed, `${tpl}/${t.id} : ${g.kind} turns, or says why not`); } }
  assert.ok(n > 60, `${n} instruments`);
  void BOARD_KEY;
});

test("wired : the strip above the board, settings as undoable steps, the test run again when the notebook changes, the button pressed in the view", () => {
  const screen = read("web/js/modules/elab.js"), strip = read("web/js/modules/elab_bench.js"), view = read("web/js/modules/elab_view.js");
  assert.match(screen, /benchStrip\(bench, bench, pcb/); assert.match(screen, /setGear\(b, key\(\), g\.key/); assert.match(screen, /JSON\.stringify\(gearEnv\(board\(\), key\(\)\)\) !== st\.gearSig\) run\(\)/, "a setting, or its undo, runs the test again");
  assert.match(screen, /pressable\(pcb\.partNode/); assert.match(screen, /gears: mine\.gears/, "an answer of an AI does not rewrite the bench");
  assert.match(strip, /checkKnob\(g\.kind/); assert.match(strip, /CIRCUIT_NOTE/); assert.match(strip, /lab-cord/); assert.match(view, /onView\(fn\)/); assert.match(view, /partNode\(ref\)/);
  assert.match(read("web/js/core/dwiz_names.js"), /gears: \{ word: "gear"/); assert.match(read("web/css/pcba.css"), /\.lab-gear-row/);
});

test("the generator turns on its front too : the high and low levels and the frequency of a plain sine or square — the run, the sheet and the words follow ; a wave the test writes stays the test's", () => {
  const s0 = testSheet("amp", "sine", {}, {}), g0 = benchGear(s0).find((g) => g.kind === "generator");
  assert.deepEqual(g0.knobs.map((k) => k.k), ["high", "low", "freq"]); assert.equal(g0.fixed, ""); assert.equal(g0.knobs[2].value, 100);
  const s1 = testSheet("amp", "sine", {}, { env: { gear: { "generator:IN": { high: 0.6, low: 0.4, freq: 50 } } } }), g1 = benchGear(s1).find((g) => g.kind === "generator");
  assert.equal(g1.set, true); assert.deepEqual(g1.knobs.map((k) => k.value), [0.6, 0.4, 50]); assert.ok(Math.abs(s1.rows[0].expected - 1.2) < 0.01 && Math.abs(s1.rows[1].expected - 0.8) < 0.01, "gain 2 : the expected peaks follow the setting");
  assert.match(gearWords(benchGear(s1))[0], /réglé de 0,4 à 0,6 V, 50 Hz : les valeurs attendues suivent/); assert.match(s1.settings.join("\n"), /réglé sur l'appareil/);
  const pwl = benchGear(testSheet("led", "blink", {}, {})).find((g) => g.kind === "generator"); assert.deepEqual(pwl.knobs, []); assert.match(pwl.fixed, /point par point/);
  const sweep = benchGear(testSheet("ntc", "filter", {}, {})).find((g) => g.kind === "generator"); assert.deepEqual(sweep.knobs, []); assert.match(sweep.fixed, /balaie toute la plage/, "a frequency response sweeps : nothing to set, said");
  assert.equal(checkKnob("generator", "freq", 0).ok, false); assert.equal(checkKnob("generator", "high", 3.3).ok, true);
  const B = { lab: setGear({}, "B1/sine", "generator:IN", { high: 0.6, freq: 50 }) }; assert.deepEqual(gearEnv(B, "B1/sine"), { "generator:IN": { high: 0.6, freq: 50 } }, "the notebook keeps them");
  assert.match(read("web/js/modules/elab_bench.js"), /generator: \{ high: \[/, "its three fields sit on the screen of its drawing");
});
