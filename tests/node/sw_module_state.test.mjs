/* The state machine of the module BM 8s8p (architecture de JP : « le BMS central juge et agit — état envoyé au véhicule : normal, dératé,
   urgence, arrêt (contactors ouverts) ») : a new kind of object, its step in integers, its C, its sentence — and the software of the module,
   run on its bench, then written in C, compiled and compared, back to back.   node --test tests/node/sw_module_state.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { problems, simulate, events } from "../../web/js/sw/sw_design.js";
import { cFiles, cExpected, requirement } from "../../web/js/sw/sw_c.js";
import { cpuOf } from "../../web/js/sw/sw_cpu.js";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { sustainedCurrent } from "../../web/js/demo/demo_bm_heat.js";

const sure = (d) => ({ ...d, objects: d.objects.map((o) => ({ ...o, sure: KINDS[o.kind].params.map((p) => p.key) })) });
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the state of the module : stop on a fault and until a reset ; emergency when the chain is silent, stop when it lasts ; derated while a warning holds", () => {
  const K = KINDS.module_state, c = { t_lost: 500, t_emerg: 1000 }, s = K.init(), run = (i, n = 1) => { let o; for (let k = 0; k < n; k++) o = K.step(s, c, { fault: 0, lost: 0, warn_a: 0, warn_b: 0, reset: 0, ...i }, 10); return o; };
  assert.deepEqual(run({}), { state: 0, close: 1, derate: 0, emergency: 0 }); assert.equal(run({ warn_b: 1 }).state, 1); assert.equal(run({}).state, 0);
  assert.equal(run({ lost: 1 }, 49).state, 0, "490 ms of silence : still normal"); assert.equal(run({ lost: 1 }).state, 2, "500 ms : emergency");
  assert.equal(run({ lost: 1 }, 99).state, 2); const o = run({ lost: 1 }); assert.equal(o.state, 3); assert.equal(o.close, 0, "the emergency lasted 1 s : stop, the contactor opens");
  assert.equal(run({}).state, 3, "the chain speaks again : it stays stopped"); assert.equal(run({ reset: 1 }).state, 0, "a reset with no fault : normal");
  assert.equal(run({ fault: 1 }).state, 3); assert.equal(run({ fault: 1, reset: 1 }).state, 3, "no way out while the fault holds");
});

test("the software of the module, on its bench : derated above the sustained current, emergency when the chain falls silent, then stop and the contactor opens", () => {
  const d = moduleDesign(); assert.deepEqual(problems(d).filter((p) => p.level === "error"), []);
  const over = d.objects.find((o) => o.id === "over_i"); assert.equal(over.params.trip, Math.floor(sustainedCurrent(459.4).I / 5) * 5 * 1000, "the derating current is the one the closed module carries for ever");
  const R = simulate(d); assert.equal(R.ok, true);
  const ev = events(d, R).map((e) => `${e.t} ${e.ref} ${e.to}`);
  for (const e of ["2490 module.derate 1", "4010 module.derate 0", "5490 module.emergency 1", "6490 module.close 0", "6490 k.drive 0", "6520 k_fb.level 0"]) assert.ok(ev.includes(e), e);
  assert.ok(!ev.some((e) => / latch\.fault 1$/.test(e)), "no fault : the stop comes from the emergency that lasted");
  assert.match(requirement(d, d.objects.find((o) => o.id === "module")), /STOP, the contactor open, as soon as Fault latch is 1.*EMERGENCY when Round of the CORE silent, 12 V present has held for 500 ms/);
  assert.ok(bmProject().software.some((x) => x.id === "BM-SW"), "the software is in the project BM");
});

test("its C : the module of the state machine in the library — and, compiled, it prints what the model gives, character for character", (t) => {
  const d = sure(moduleDesign()), files = cFiles(d, { cpu: cpuOf(d) }), names = files.map((f) => f.name);
  for (const n of ["bms/lib/dw_state.h", "bms/lib/dw_state.c", "bms/app/bms_app.c"]) assert.ok(names.includes(n), n);
  assert.match(files.find((f) => f.name === "bms/app/bms_app.c").text, /dw_state_step\(&s_module, /);
  const want = cExpected(d); assert.equal(want.split("\n").length, 802);
  const cc = spawnSync("cc", ["--version"]); if (cc.error || cc.status !== 0) { t.diagnostic("no C compiler here : the back-to-back run is skipped"); return; }
  const dir = mkdtempSync(join(tmpdir(), "dwbm-")); for (const f of files) { const p = join(dir, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const B = join(dir, "bms"), src = files.filter((f) => /\.c$/.test(f.name) && !/hal\/tms/.test(f.name)).map((f) => join(dir, f.name)), inc = ["lib", "cfg", "io", "app", "hal"].map((x) => `-I${join(B, x)}`);
  const made = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...inc, ...src, "-o", join(dir, "t")], { encoding: "utf8" }); assert.equal(made.status, 0, `the C compiles without a warning : ${made.stderr}`);
  const ran = spawnSync(join(dir, "t"), [], { encoding: "utf8" }); assert.equal(ran.status, 0); assert.equal(ran.stdout, want, "back to back");
  const doc = read("docs/BM_MODULE.md"); for (const re of [/Itération 15/, /module_state/, /[Dd]os à dos/]) assert.match(doc, re);
});

test("without the 12 V the CORE boards are silent : a silent round-robin is no emergency then — with the 12 V it is (JP, 27 novembre 2026, par menu)", async () => {
  const { liveStart, liveSet, liveStep } = await import("../../web/js/sw/sw_live.js");
  const d = moduleDesign(), L = liveStart(d, 10), at = (r) => L.m.last[r];
  liveSet(L, "wake", 0); liveSet(L, "lost", 1); liveStep(L, 200);
  assert.equal(at("module.emergency"), 0, "standby : the round is silent, as it should be"); assert.equal(at("k.drive"), 0, "the contactor stays open without the 12 V");
  liveSet(L, "wake", 1); liveStep(L, 60); assert.equal(at("module.emergency"), 1, "the 12 V is there and the round stays silent : timeout, emergency");
  assert.ok(d.wires.some((w) => w.from === "silent.y" && w.to === "module.lost") && d.wires.some((w) => w.from === "wake.level" && w.to === "silent.b"));
});
