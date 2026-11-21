/* The software in a V-cycle (demande de JP : « sortir et bonifier la suite d'outils logiciel de l'onglet électronique… la même suite d'outils
   que pour la mécanique et l'électronique… garantir un résultat aux normes et pratiques industrielles » ; choix cliqués : « Cycle en V »,
   « Au choix du projet »).
     node --test tests/node/sw_v.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { demoDesign } from "../../web/js/sw/sw_design.js";
import { cpuOf } from "../../web/js/sw/sw_cpu.js";
import { STANDARDS, STD_SOURCES, V_PAIRS, stdOf, levelOf, stdAsks } from "../../web/js/sw/sw_std.js";
import { REQ_KINDS, VERIFY, reqsOf, liveReqs, addReq, copyReq, setReq, removeReq, reqQuality, designReqs, trace, TRACE_STATES, reqGuide } from "../../web/js/sw/sw_req.js";
import { addTest, copyTest, setTest, removeTest, runTest, runAll, modelCoverage, testGuide, pinScales, pointsText, parsePoints, outputsOf, expectText } from "../../web/js/sw/sw_test.js";
import { DEMO_REQS, DEMO_TESTS } from "../../web/js/sw/sw_demo_v.js";
import { releaseChecks, releaseReady } from "../../web/js/sw/sw_release.js";
import { VSTEPS, STEPS, vstepOf, vOfPage, vStates, nextV, wordsIn } from "../../web/js/sw/sw_steps.js";
import { stairOf, downOf } from "../../web/js/core/stairs.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const sure = (d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, sure: KINDS[o.kind].params.map((p) => p.key) })) });
/** The example, all confirmed, the reference chosen, the analysis signed : what a project would deliver. */
const done = () => { const d = sure(demoDesign()); d.std = { ref: "do178c", level: "C" }; for (const r of d.reqs) { r.sure = true; if (r.verify !== "test") r.signed = { by: "Relecteur", at: "2026-11-21" }; } for (const t of d.tests) t.sure = true; return d; };

test("two references, chosen by the project ; what the tool says of each comes from public pages, and what they do not say is said unknown", () => {
  assert.deepEqual(Object.keys(STANDARDS), ["do178c", "iso26262"]);
  const D = STANDARDS.do178c, I = STANDARDS.iso26262;
  assert.deepEqual(D.levels.map((l) => l.id), ["A", "B", "C", "D", "E"]); assert.deepEqual(D.levels.map((l) => [l.objectives, l.independence]), [[71, 30], [69, 18], [62, 5], [26, 2], [0, 0]], "as the secondary page tabulates them");
  assert.deepEqual(I.levels.map((l) => l.id), ["D", "C", "B", "A", "QM"]);
  assert.deepEqual(D.levels.filter((l) => l.coverage).map((l) => l.id), ["A"], "MC/DC is said for level A only : the coverage of B, C, D is not on the pages read");
  assert.deepEqual(I.levels.filter((l) => l.coverage).map((l) => l.id), ["D"]); assert.match(I.levels[0].coverage, /highly recommended/);
  for (const S of [D, I]) { assert.ok(STD_SOURCES.some((s) => s.id === S.source), S.id); assert.match(S.unknown, /pas affirmée|ne sont pas affirmées/); assert.ok(S.says.length >= 3); }
  for (const s of STD_SOURCES) { assert.match(s.url, /^https:\/\/en\.wikipedia\.org\/wiki\//); assert.match(s.read, /21 novembre 2026/); assert.equal(s.licence, "CC BY-SA 4.0"); }
  assert.match(read("web/js/sw/sw_std.js"), /were NOT read/, "the standards themselves were not read, and the module says so");
  assert.deepEqual(V_PAIRS.map((p) => p.test), ["Essai d'acceptation", "Essai d'intégration", "Essai unitaire"]);
  const none = stdAsks({}); assert.equal(none.std, null); assert.match(none.lines[0], /Aucun référentiel choisi/);
  const a = stdAsks({ std: { ref: "do178c", level: "A" } }); assert.equal(a.coverage, "MC/DC"); assert.match(a.lines.join(" "), /71 objectifs, dont 30 avec indépendance/); assert.match(a.lines.join(" "), /sur le C compilé/);
  const c = stdAsks({ std: { ref: "do178c", level: "C" } }); assert.equal(c.coverage, null); assert.match(c.lines.join(" "), /n'est pas donnée par les pages lues/);
  assert.equal(stdAsks({ std: { ref: "do178c", level: "E" } }).trace, false, "level E asks no trace");
  assert.equal(stdOf({ std: { ref: "nope" } }), null); assert.equal(levelOf({ std: { ref: "iso26262", level: "QM" } }).id, "QM");
});

test("a requirement : one sentence with « doit », of one kind, proven one way, allocated to tiles ; On / Off, a copy born Off", () => {
  for (const k of Object.values(REQ_KINDS)) assert.ok(k.fr && k.label && /^#[0-9a-f]{6}$/.test(k.color) && k.icon && k.text, k.label);
  assert.deepEqual(Object.keys(VERIFY), ["test", "analysis", "review"]);
  const d = { objects: [], reqs: [] }, r1 = addReq(d, { text: "Le logiciel doit ouvrir K+ en 200 ms.", kind: "safety" }), r2 = addReq(d, { kind: "nope", verify: "nope" });
  assert.deepEqual([r1.id, r2.id, r2.kind, r2.verify, r1.on, r1.sure], ["SWR-001", "SWR-002", "functional", "test", true, true]);
  const c = copyReq(d, "SWR-001"); assert.equal(c.id, "SWR-003"); assert.equal(c.on, false, "a copy is born Off"); assert.equal(reqsOf(d)[1].id, "SWR-003", "next to its original");
  assert.deepEqual(liveReqs(d).map((r) => r.id), ["SWR-001", "SWR-002"]);
  setReq(d, "SWR-002", { text: "Autre", objs: ["a"], bogus: 1 }); assert.equal(reqsOf(d)[2].text, "Autre"); assert.equal(reqsOf(d)[2].bogus, undefined);
  d.tests = [{ id: "TC-001", reqs: ["SWR-001", "SWR-002"] }]; assert.equal(removeReq(d, "SWR-001"), true); assert.deepEqual(d.tests[0].reqs, ["SWR-002"], "a test forgets the requirement removed"); assert.equal(removeReq(d, "SWR-001"), false);
  assert.equal(copyReq(d, "nope"), null); assert.equal(setReq(d, "nope", {}), null);
});

test("how a requirement is written : a « doit », no vague word, a number when it is a performance or a safety", () => {
  assert.equal(reqQuality({ text: "" })[0].level, "todo");
  assert.deepEqual(reqQuality({ kind: "safety", text: "Le logiciel doit ouvrir K+ au plus 200 ms après le dépassement." }), []);
  assert.match(reqQuality({ kind: "functional", text: "Le logiciel ouvre K+." })[0].text, /doit/);
  const vague = reqQuality({ kind: "functional", text: "Le logiciel doit réagir rapidement, si possible." }).map((q) => q.text).join(" "); assert.match(vague, /« rapidement »/); assert.match(vague, /« si possible »/);
  assert.doesNotMatch(reqQuality({ kind: "functional", text: "Le logiciel doit tenir sa période." }).map((q) => q.text).join(" "), /« peu »/, "a vague word is a whole word, not a part of one");
  assert.match(reqQuality({ kind: "performance", text: "Le logiciel doit exécuter son pas souvent." }).map((q) => q.text).join(" "), /se chiffre/);
  assert.equal(reqQuality({ kind: "functional", text: "Le logiciel doit lire. Il doit écrire." })[0].level, "tip");
  for (const r of DEMO_REQS) assert.deepEqual(reqQuality(r), [], `${r.id} is written as the tool asks`);
});

test("the trace, both ways : a requirement to its tiles and its tests, a tile back to the requirement that asks for it", () => {
  const d = demoDesign(), run = runAll(d), T = trace(d, run.results);
  assert.deepEqual(T.rows.map((x) => [x.req.id, x.state]), [["SWR-001", "verified"], ["SWR-002", "verified"], ["SWR-003", "verified"], ["SWR-004", "verified"], ["SWR-005", "verified"], ["SWR-006", "tosign"]]);
  assert.deepEqual(T.orphans, [], "every tile of the example is asked for by a requirement");
  assert.deepEqual(trace(d).rows.map((x) => x.state).slice(0, 2), ["untested", "untested"], "without a run, nothing is proven");
  const cut = demoDesign(); cut.reqs[1].objs = []; cut.reqs.find((r) => r.id === "SWR-004").objs = ["adc_i", "i_pack", "adc_v", "v_pack"]; const C = trace(cut, runAll(cut).results);
  assert.equal(C.rows[1].state, "untraced"); assert.deepEqual(C.orphans, ["req", "efc"], "a tile no requirement asks for is a function nobody asked for");
  const off = demoDesign(); off.reqs[0].on = false; assert.equal(trace(off).rows[0].state, "off");
  const signed = demoDesign(); signed.reqs[5].signed = { by: "X" }; assert.equal(trace(signed).rows[5].state, "signed");
  const bad = demoDesign(); bad.tests[0].expect[1].within = [500, 520]; assert.equal(trace(bad, runAll(bad).results).rows[0].state, "failed");
  for (const s of ["verified", "failed", "untested", "untraced", "signed", "tosign", "off"]) assert.ok(TRACE_STATES[s], s);
  const low = designReqs(d); assert.equal(low.length, d.objects.length); assert.ok(low.every((x) => x.text.length > 20), "each tile says in one sentence what it does : the low-level requirements");
  const G = reqGuide(d, run.results).map((g) => g.text).join(" "); assert.match(G, /SWR-001 est une exigence d'exemple/);
  assert.equal(reqGuide({ objects: [] })[0].level, "todo"); assert.match(reqGuide(cut).map((g) => g.text).join(" "), /n'est allouée à aucune tuile[\s\S]*2 tuiles qu'aucune exigence ne demande \(req, efc\)/);
});

test("the tests run on the model — the very step the tool writes in C — and the five of the example pass", () => {
  const d = demoDesign(), run = runAll(d);
  assert.deepEqual([run.total, run.passed, run.failed, run.empty], [5, 5, 0, 0]);
  assert.deepEqual(DEMO_TESTS.map((t) => t.id), ["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"]); assert.ok([...DEMO_REQS, ...DEMO_TESTS].every((x) => x.sure === false), "examples, to confirm");
  const r1 = run.results["TC-001"]; assert.equal(r1.checks.length, 2); assert.match(r1.checks[1].got, /^à \d+ ms$/); const ms = Number(/\d+/.exec(r1.checks[1].got)[0]); assert.ok(ms >= 500 && ms <= 700, `K+ opens within 200 ms of the over-voltage (${ms} ms)`);
  assert.match(expectText(d, DEMO_TESTS[0].expect[1]), /passe à 0 entre 500 et 700 ms/); assert.match(expectText(d, DEMO_TESTS[3].expect[0]), /vaut au moins 1 mWh à 1190 ms/);
  const late = demoDesign(); late.tests[0].expect[1].within = [500, 520]; const L = runTest(late, late.tests[0]); assert.equal(L.ok, false); assert.match(L.checks[1].got, /jamais dans la fenêtre/);
  const ghost = runTest(d, { steps: 10, pins: {}, expect: [{ ref: "nope.x", at: 0, op: "==", value: 1 }] }); assert.equal(ghost.ok, false); assert.match(ghost.checks[0].got, /n'existe pas/);
  assert.equal(runTest(d, { steps: 10, pins: {}, expect: [] }).ok, false, "a test that expects nothing proves nothing");
  const e = { ...demoDesign(), tests: [] }; const t = addTest(e, { name: " Essai " }); assert.deepEqual([t.id, t.name, t.on, t.expect.length], ["TC-001", "Essai", true, 0]); assert.ok(Object.keys(t.pins).length > 0, "a new test starts from the scenario of the design");
  const c = copyTest(e, "TC-001"); assert.deepEqual([c.id, c.on, c.name], ["TC-002", false, "Essai (copie)"]); setTest(e, "TC-002", { on: true, bogus: 1 }); assert.equal(e.tests[1].on, true); assert.equal(e.tests[1].bogus, undefined);
  const R = runAll(e); assert.deepEqual([R.total, R.empty, R.passed], [2, 2, 0]); assert.equal(removeTest(e, "TC-002"), true); assert.equal(removeTest(e, "TC-002"), false);
  const G = testGuide(e, runAll(e)).map((g) => g.text).join(" "); assert.match(G, /TC-001 n'attend rien/); assert.match(G, /ne prouve aucune exigence/);
  assert.match(testGuide(late, runAll(late)).map((g) => g.text).join(" "), /TC-001 « Surtension d'une cellule » échoue/);
  assert.equal(testGuide({ tests: [] }, { results: {} })[0].level, "todo");
});

test("the coverage of the MODEL : every 0 / 1 output of every tile has taken both values — the structural coverage of the C is not claimed", () => {
  const d = demoDesign(), M = modelCoverage(d, runAll(d).results); assert.ok(M.of > 5); assert.ok(M.full > 0 && M.full <= M.of); assert.ok(M.ratio > 0 && M.ratio <= 1);
  const one = modelCoverage(d, { "TC-002": runAll(d).results["TC-002"] }); assert.ok(one.full < M.full, "fewer tests, less covered");
  assert.equal(modelCoverage(d, {}).full, 0);
  const src = read("web/js/sw/sw_test.js"); assert.match(src, /coverage of the\s+MODEL/); assert.match(src, /model does not give it/);
});

test("a scenario is written as an engineer reads it : in mV for a channel that measures a voltage, written and read back the same", () => {
  const d = demoDesign(), S = pinScales(d); assert.equal(S.adc_cell.unit, "mV"); assert.equal(S.adc_cell.kind, "analog"); assert.equal(S.req.kind, "digital"); assert.equal(S.req.unit, "0/1");
  for (let n = 0; n <= 4095; n += 7) { const v = S.adc_cell.phys(n); assert.equal(S.adc_cell.phys(S.adc_cell.counts(v)), v, `${v} mV : written and read back the same`); }
  const txt = pointsText([[0, 2420], [500, 2680]], S.adc_cell), back = parsePoints(txt, S.adc_cell); assert.equal(pointsText(back.points, S.adc_cell), txt, "the text read back says the same"); assert.match(txt, /^0 : \d+ ; 500 : \d+$/);
  assert.deepEqual(parsePoints("500 : 1 ; 0 : 0", S.req).points, [[0, 0], [500, 1]], "sorted by instant");
  assert.deepEqual(parsePoints("0 ms : 4 330", null).points, [[0, 4330]], "a space between thousands is read");
  assert.match(parsePoints("bonjour", null).error, /instant en ms : valeur/); assert.match(parsePoints("", null).error, /Au moins un point/);
  const outs = outputsOf(d); assert.ok(outs.some((o) => o.ref === "k_drv.level" && o.unit === "0/1")); assert.ok(outs.some((o) => o.ref === "efc.e_out"));
});

test("the list of delivery : what must hold before the package leaves, each line says where to settle it", () => {
  const d = demoDesign(), cpu = cpuOf(d), C = releaseChecks(d, cpu, runAll(d)), by = Object.fromEntries(C.map((c) => [c.id, c]));
  assert.deepEqual(C.map((c) => c.id), ["std", "cpu", "reqs", "alloc", "design", "values", "tests", "proven", "signed"]);
  assert.equal(by.std.ok, false); assert.match(by.reqs.text, /des exemples à confirmer/); assert.equal(by.values.ok, false); assert.match(by.tests.text, /Des essais d'exemple/); assert.equal(by.proven.ok, true); assert.equal(by.signed.ok, false);
  assert.equal(releaseReady(C), false, "the example is not ready to deliver : its values, requirements and tests are examples");
  for (const c of C) assert.ok(VSTEPS.some((s) => s.key === c.step), `${c.id} says where to settle it`);
  const ok = done(), D = releaseChecks(ok, cpuOf(ok), runAll(ok)); assert.deepEqual(D.filter((c) => !c.ok).map((c) => c.id), [], D.filter((c) => !c.ok).map((c) => c.text).join(" | ")); assert.equal(releaseReady(D), true);
  assert.equal(releaseChecks(null)[0].ok, false);
  assert.match(read("web/js/sw/sw_release.js"), /does not replace the design review, nor the\s+authority/);
});

test("seven steps of the V : left branch defines, bottom writes the code, right branch proves and delivers ; each page belongs to one step", () => {
  assert.deepEqual(VSTEPS.map((s) => s.key), ["req", "arch", "design", "sim", "code", "verify", "release"]); assert.deepEqual(VSTEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(VSTEPS.map((s) => s.mod), ["swreq", "swarch", "sw", "swsim", "swcode", "swtest", "swrel"]);
  for (const s of VSTEPS) { assert.ok(s.title && s.en && s.long && s.icon && /^#[0-9a-f]{6}$/.test(s.color), s.key); assert.ok(s.plain.length > 120 && s.do.length > 40, s.key); assert.ok(wordsIn(`${s.plain} ${s.do}`).length >= 1, `${s.key} unfolds its words`); }
  assert.deepEqual(STEPS.map((p) => vOfPage(p.key).key), ["arch", "design", "design", "sim", "sim", "code", "release"], "every page of before has its step");
  assert.equal(vstepOf("verify").pair, "req"); assert.equal(vstepOf("req").pair, "verify"); assert.equal(vstepOf("nope").key, "req");
  assert.equal(wordsIn("On remonte le V").some((w) => w.id === "vmodel"), true); assert.equal(wordsIn("une tension de 5 V").some((w) => w.id === "vmodel"), false, "a volt is not the V");
  const none = vStates(null, null); assert.equal(none.req.state, "todo"); assert.ok(VSTEPS.slice(1).every((s) => none[s.key].state === "wait"));
  const d = demoDesign(), cpu = cpuOf(d), S = vStates(d, cpu, runAll(d)); assert.equal(S.req.state, "todo"); assert.match(S.req.text, /6 exigences d'exemple à confirmer/); assert.equal(S.arch.state, "todo"); assert.match(S.arch.text, /Référence de sécurité à choisir/); assert.equal(S.verify.state, "done"); assert.equal(nextV(d, cpu), "req");
  const ok = done(), O = vStates(ok, cpuOf(ok), runAll(ok)); assert.deepEqual(["req", "arch", "design", "verify"].map((k) => O[k].state), ["done", "done", "done", "done"]); assert.match(O.arch.text, /RTCA DO-178C DAL C/); assert.equal(nextV(ok, cpuOf(ok), runAll(ok)), "sim", "nothing left to do : the simulation");
  assert.equal(vStates(ok, cpuOf(ok), null).verify.state, "todo", "not proven before the tests run");
});

test("a group of its own in the top bar, seven screens wired, the V drawn above each, the old addresses lead to their step", () => {
  const app = read("web/js/core/app.js"); assert.match(app, /id: "soft", label: "Logiciel"[^}]*keys: \["swreq", "swarch", "sw", "swsim", "swcode", "swtest", "swrel"\]/); assert.match(app, /id: "elec"[^}]*keys: \["pcb", "pcba", "elab", "creepage"\]/, "the software has left the Electronics group");
  const sw = read("web/js/modules/sw.js"); assert.match(sw, /for \(const k of \["arch", "design", "sim", "code", "release"\]\)/); assert.match(sw, /location\.replace\(vHash\(/, "an old address (#/sw/live) leads to the step of its page");
  assert.match(read("web/js/modules/sw_req.js"), /registerModule\(\{ key: "swreq"/); assert.match(read("web/js/modules/sw_verify.js"), /registerModule\(\{ key: "swtest"/);
  const main = read("web/js/main.js"); assert.match(main, /import "\.\/modules\/sw_req\.js";/); assert.match(main, /import "\.\/modules\/sw_verify\.js";/);
  assert.match(read("web/index.html"), /<link rel="stylesheet" href="css\/sw_v\.css">/);
  for (const f of ["sw_vband.js", "sw_req.js", "sw_verify.js", "sw_trace_map.js", "sw_release.js"]) { const s = read(`web/js/modules/${f}`); assert.ok(s.split("\n").length < 500, f); assert.doesNotMatch(s, /innerHTML/, `${f} : DOM by el() and textContent`); }
  for (const f of ["sw_std.js", "sw_req.js", "sw_test.js", "sw_release.js", "sw_demo_v.js"]) assert.doesNotMatch(read(`web/js/sw/${f}`), /document\.|window\./, `${f} is pure`);
  assert.match(read("web/js/modules/sw_verify.js"), /structurelle|structural/i, "the screen says the coverage of the C is not the model's");
});

test("the V, up and down : each step hangs from the one it answers, the PCBA leads down to the requirements", () => {
  const p = { boards: [{ id: "B1", name: "BMS" }], software: [demoDesign()] };
  assert.equal(stairOf("swreq", [], p).hash, "#/pcba/B1"); assert.equal(stairOf("swarch", [], p).hash, "#/swreq"); assert.equal(stairOf("swtest", [], p).hash, "#/swreq");
  assert.equal(stairOf("sw", [], p).hash, "#/swarch"); assert.equal(stairOf("swsim", [], p).hash, "#/sw"); assert.equal(stairOf("swcode", [], p).hash, "#/sw"); assert.equal(stairOf("swrel", [], p).hash, "#/swtest");
  const down = (k) => downOf(k, [], p).map((x) => x.hash); assert.deepEqual(down("swreq"), ["#/swarch", "#/swtest"]); assert.deepEqual(down("swarch"), ["#/sw"]); assert.deepEqual(down("sw"), ["#/swsim", "#/swcode"]); assert.deepEqual(down("swtest"), ["#/swrel"]);
  for (const k of ["swarch", "sw", "swsim", "swcode", "swtest", "swrel"]) for (const d of downOf(k, [], p)) assert.equal(stairOf(d.hash.slice(2), [], p).hash, `#/${k}`, `${k} → ${d.hash} → back`);
  assert.equal(stairOf("swarch", [], { boards: [] }), null, "no software, no step");
  assert.ok(downOf("pcba", ["B1"], p).some((d) => d.hash === "#/swreq"));
});

test("the sources and the news say what came in", () => {
  for (const id of ["sw-v", "sw-std", "sw-req", "sw-test"]) { const m = METHODS.find((x) => x.id === id); assert.ok(m, id); assert.ok(m.check.length > 80, `${id} says how it was checked`); }
  assert.equal(METHODS.find((x) => x.id === "sw-std").how, "excerpt", "the standards are known by a secondary summary, not read");
  const N = NEWS.filter((n) => n.v === "0.128.0"); assert.ok(N.length >= 3); for (const n of N) assert.ok(n.where.startsWith("#/sw"), n.id);
  const doc = read("docs/LOGICIEL.md"); assert.match(doc, /cycle en V/i); assert.match(doc, /DO-178C/); assert.match(doc, /ISO 26262/); assert.match(doc, /non lu|n'ont pas été lu|pas été lues/);
});
