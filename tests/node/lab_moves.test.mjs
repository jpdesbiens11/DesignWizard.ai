/* A lead moved by hand on the bench (JP, 22 novembre 2026 : « permettre les changements de connexion à la souris… même si officiellement la
   majeure partie seront faits par AI, peut-être lock / unlock setup… un expert HW designer pourra jouer avec les réglages en connaissance de
   cause ») : the set-up locked on opening ; unlocked, a lead is dropped on a pad ; the tool refuses what would harm the board and says why ;
   the move is kept in the notebook of the board, travels in a .dwiz, and the test is simulated again with it.
     node --test tests/node/lab_moves.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { testSheet, labOf, setMove, movesOf, movesEnv, testKey, sheetJobs, jobSheet, MOVE_ROLES } from "../../web/js/pcba/lab_plan.js";
import { benchGear, checkMove, moveWords } from "../../web/js/pcba/lab_gear.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { measure } from "../../web/js/pcba/lab_mna.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const B = demoBoard(), ldo = B.blocks.find((x) => x.template === "ldo"), refs = Object.fromEntries(B.parts.filter((p) => p.block === ldo.id && p.local).map((p) => [p.local, p.ref])), key = testKey(ldo.id, "levels");
const run = (board) => { const moves = movesEnv(board, key, refs); return testSheet("ldo", "levels", ldo.params || {}, { refs, ...(Object.keys(moves).length ? { env: { moves } } : {}) }); };
const row = (s, re) => s.rows.find((r) => re.test(r.label));

test("the notebook keeps a moved lead : one per instrument and role, taken back one by one or all at once, and it travels in a .dwiz", () => {
  let b = { ...B, lab: setMove(B, key, "supply:VIN", "plus", "C9.1") }; b = { ...b, lab: setMove(b, key, "scope", "probe", "C9.1") };
  assert.deepEqual(movesOf(b, key), { "supply:VIN": { plus: "C9.1" }, scope: { probe: "C9.1" } });
  const local = movesEnv(b, key, refs); assert.match(local["supply:VIN"].plus, /^[A-Za-z_]\w*\.1$/, "named by the part of the block"); assert.notEqual(local["supply:VIN"].plus, "C9.1");
  assert.deepEqual(movesEnv(b, key, null), movesOf(b, key), "the whole board keeps the references of the board");
  assert.deepEqual(movesEnv({ ...B, lab: setMove(B, key, "scope", "probe", "U99.1") }, key, refs), {}, "a pad outside the block is not in its circuit");
  assert.deepEqual(movesOf({ ...b, lab: setMove(b, key, "scope", "probe", null) }, key), { "supply:VIN": { plus: "C9.1" } });
  assert.deepEqual(movesOf({ ...b, lab: setMove(b, key, "supply:VIN", null, null) }, key), { scope: { probe: "C9.1" } });
  assert.deepEqual(labOf({ lab: { moves: [{ test: "a", gear: "scope", role: "nose", to: "C1.1" }, { test: "a", gear: "scope", role: "probe", to: "nowhere" }, { test: "a", gear: "scope", role: "probe", to: "C1.1" }] } }).moves, [{ test: "a", gear: "scope", role: "probe", to: "C1.1" }]);
  assert.deepEqual(labOf(fromDwiz(toDwiz(b))).moves, labOf(b).moves); assert.ok(MOVE_ROLES.includes("loadBack") && MOVE_ROLES.includes("clip"));
});

test("a probe moved : its curve follows the pad it is on — the circuit is the same", () => {
  const s0 = run(B), b = { ...B, lab: setMove(B, key, "scope", "probe", "C9.1") }, s1 = run(b);
  const v = (y) => measure(y, 0.6).mean, out0 = v(s0.result.ch2.y);
  assert.ok(Math.abs(v(s0.result.ch1.y) - out0) > 1, "before : channel 1 reads the input, channel 2 the output");
  assert.ok(Math.abs(v(s1.result.ch1.y) - out0) < 1e-6, "after : channel 1, moved to the output, reads what channel 2 reads");
  assert.ok(Math.abs(row(s1, /Tension de sortie/).expected - row(s0, /Tension de sortie/).expected) < 1e-9, "a probe changes nothing in the circuit");
  assert.match(s1.result.ch1.label, /→ C9\.1$/, "the channel says the pad of the board");
  const g = benchGear(s1).find((x) => x.kind === "scope" || x.kind === "meter"), p = g.leads.find((l) => l.role === "probe"); assert.equal(`${p.ref}.${p.pin}`, "C9.1"); assert.equal(p.moved, true); assert.equal(g.moved, true);
  assert.match(moveWords(benchGear(s1)).join(" "), /la sonde de la voie 1 déplacée sur C9\.1 — la courbe suit/);
});

test("a supply moved : the circuit is simulated with it, and what is expected follows", () => {
  const s0 = run(B), s1 = run({ ...B, lab: setMove(B, key, "supply:VIN", "plus", "C9.1") });
  const vin = benchGear(s0).find((g) => g.kind === "supply").v; assert.ok(vin > 4);
  assert.ok(Math.abs(row(s0, /Tension de sortie/).expected - 3.25) < 0.1, "the regulator gives its 3,3 V");
  assert.ok(Math.abs(row(s1, /Tension de sortie/).expected - vin) < 0.2, "the + put on the output : the output is the supply");
  const sup = benchGear(s1).find((g) => g.kind === "supply"), plus = sup.leads.find((l) => l.role === "plus"); assert.equal(`${plus.ref}.${plus.pin}`, "C9.1"); assert.equal(sup.key, "supply:VIN", "the instrument keeps its name : its settings and moves stay with it");
  assert.ok(s1.setup.some((t) => /le \+ sur .*C9/.test(t)), "the set-up says where the lead now is");
  const job = sheetJobs({ ...B, lab: setMove(B, key, "supply:VIN", "plus", "C9.1") }).find((j) => j.blockId === ldo.id && j.test === "levels"); assert.ok(Math.abs(row(jobSheet(job), /Tension de sortie/).expected - vin) < 0.2, "the plan follows the bench as it is set");
});

test("what would harm the board, or mean nothing, is refused — and said", () => {
  const s = run(B), G = benchGear(s), sup = G.find((g) => g.kind === "supply"), meter = G.find((g) => g.kind === "meter" || g.kind === "scope");
  const pad = (ref, pin, net, ground = false) => ({ ref, pin, net, ground });
  assert.equal(checkMove(sup, "plus", pad("C9", "1", "VOUT"), { inBlock: true, otherNet: "GND" }).ok, true);
  assert.match(checkMove(sup, "plus", pad("C9", "2", "GND", true), { inBlock: true, otherNet: "GND" }).text, /court-circuit franc/);
  assert.match(checkMove(sup, "plus", pad("U9", "1", "X"), { inBlock: false }).text, /pas dans le bloc à l'essai.*La carte entière/);
  assert.match(checkMove(sup, "plus", pad("C9", "3", null), { inBlock: true }).text, /relié à rien/);
  assert.match(checkMove({ ...meter, kind: "scope", movable: true, leads: [{ role: "clip" }] }, "clip", pad("C9", "1", "VOUT"), { inBlock: true }).text, /pince de masse .* jamais sur un point vivant/);
  assert.equal(checkMove({ ...meter, kind: "scope", movable: true, leads: [{ role: "clip" }] }, "clip", pad("C9", "2", "GND", true), { inBlock: true }).ok, true);
  assert.match(checkMove({ kind: "press", movable: false, leads: [] }, "part", pad("S1", "1", "X")).text, /doigt/);
  assert.match(checkMove({ kind: "load", movable: true, leads: [{ role: "load" }, { role: "loadBack" }] }, "load", pad("C9", "2", "GND", true), { inBlock: true, otherNet: "GND" }).text, /même net/);
});

test("in the Labo : locked on opening, a lead taken by its dot and dropped on a pad, checked, kept in one undoable step ; an AI answer keeps the bench", () => {
  const lab = read("web/js/modules/elab.js"), view = read("web/js/modules/elab_view.js"), bread = read("web/js/modules/elab_bread.js");
  assert.match(lab, /"Montage déverrouillé" : "Montage verrouillé"/); assert.match(lab, /pcb\.unlock\(st\.free, moveLead\)/); assert.doesNotMatch(lab, /free: true/);
  assert.match(lab, /checkMove\(g, role/); assert.match(lab, /setMove\(x, key\(\), gearKey, role, pin\)/); assert.match(lab, /setMove\(b, key\(\), g\.key, null, null\)/, "the undo of the card takes the leads back too");
  assert.match(lab, /gears: mine\.gears, moves: mine\.moves/, "an AI answer does not move a lead");
  assert.match(view, /unlock\(on, move\)/); assert.match(view, /"data-role": p\.role/); assert.match(view, /Escape/); assert.match(bread, /"data-role": l\.role/);
  assert.match(read("docs/LABO.md"), /Montage verrouillé/);
});
