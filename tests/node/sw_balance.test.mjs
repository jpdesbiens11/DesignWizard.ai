/* Charge and passive balancing (demande de JP, 24 novembre 2026 : « partir avec les batteries à 3,0 V, plage de 100 % de SOC de 2,5 V à 4,2 V…
   un balancement passif visuel entre plusieurs cellules débalancées… la charge ralentit… de 0,1 C à 2 C… en accéléré »).
   node --test tests/node/sw_balance.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { LIB, requirement } from "../../web/js/sw/sw_c.js";
import { LIBRARY } from "../../web/js/sw/sw_blocks.js";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { profileOf } from "../../web/js/sw/sw_story.js";
import { ocv, socAt, balanceSpec, balanceStart, balanceStep, balanceSummary, CORE_BALANCE, coreBleed, localRule } from "../../web/js/sw/sw_balance.js";
import { packStart, packDrive, packStep, packSense } from "../../web/js/sw/sw_pack.js";
import { monitorOf } from "../../web/js/sw/sw_monitor.js";

/* a BMS that balances CENTRALLY : the software of the module with the library's « Passive balancing » block, wired to the highest and the lowest
   CORE and to the current — what the module of JP did until 27 novembre 2026, and what the library still offers */
const central = () => { const d = moduleDesign(); d.objects.push({ id: "bal", kind: "balancing", name: "Passive balancing (per CORE)", x: 700, y: 640, params: { v_min: 3900, delta: 20, hyst: 10 }, sure: [] });
  d.wires.push({ from: "v_max.value", to: "bal.v" }, { from: "v_min.value", to: "bal.low" }, { from: "i_mod.value", to: "bal.i" }); delete d.plant.balance; return d; };

test("the block « Passive balancing » : on above the floor voltage and the delta, off under the return gap, never while discharging ; its C and its sentence", () => {
  const K = KINDS.balancing, c = { v_min: 3900, delta: 20, hyst: 10 }, s = K.init(), run = (v, low, i = 0) => K.step(s, c, { v, low, i }, 10).bleed;
  assert.equal(run(3850, 3700), 0, "under the floor : no balancing"); assert.equal(run(4000, 3985), 0, "15 mV : under the delta"); assert.equal(run(4000, 3975), 1, "25 mV : bleeds");
  assert.equal(run(4000, 3985), 1, "15 mV : still bleeding (hysteresis)"); assert.equal(run(4000, 3991), 0, "9 mV : stops");
  run(4000, 3950); assert.equal(run(4000, 3950, 5000), 0, "the pack discharges : never");
  assert.match(LIB.balancing.c, /dw_balance_step/); assert.ok(LIBRARY.some((x) => x.kind === "balancing") && !LIBRARY.some((x) => x.planned && x.id === "balancing"), "a block that runs, no longer « à venir »");
  const d = central(); assert.match(requirement(d, d.objects.find((o) => o.kind === "balancing")), /above 3900 mV and above .* by more than 20 mV/);
});

test("a central balancing : the charge of the 8 CORE from 3,0 V at rest, 0,1 C then 2 C, slower while a resistor bleeds, constant voltage at 4,2 V — and at the end balanced", () => {
  assert.equal(ocv(0), 2.5); assert.equal(ocv(1), 4.2); assert.ok(Math.abs(ocv(socAt(3.0)) - 3.0) < 1e-9, "0 % = 2,5 V, 100 % = 4,2 V");
  const free = balanceSpec(central()), F = balanceStart(free); while (!F.done && F.t < 12 * 3600) balanceStep(F, 10);
  assert.ok(F.done && F.trace.some((p) => p.bleed.some(Boolean) && p.i > 70), "by default the resistors bleed WHILE it charges at 2 C (balancing during charge)"); assert.ok(!F.trace.some((p) => p.phase === "bal"), "no slowing by default");
  const S = balanceSpec(central(), { cBal: 0.5 }), B = balanceStart(S); assert.equal(S.cfg.v_min, 3900, "the settings of the software's block"); assert.equal(S.local, undefined);
  const rest = B.v.reduce((a, x) => a + x, 0) / B.v.length; assert.ok(Math.abs(rest - 3.0) < 0.06, `starts about 3,0 V (${rest})`);
  const seen = new Set(), rates = []; let flips = 0, last = "";
  while (!B.done && B.t < 12 * 3600) { balanceStep(B, 10); const R = balanceSummary(B); seen.add(R.phase); rates.push(R.cRate); if (R.phase !== last) { flips++; last = R.phase; } }
  assert.ok(B.done, "the charge ends"); for (const p of ["soft", "cc", "bal", "cv", "done"]) assert.ok(seen.has(p), p);
  assert.ok(Math.abs(rates[0] - 0.1) < 1e-9 && Math.max(...rates) <= 2 + 1e-9 && Math.max(...rates) > 1.99, "0,1 C first, 2 C at most (9 A per cell, 8 in parallel)");
  assert.ok(flips < 12, `the phases do not beat (${flips})`); const R = balanceSummary(B); assert.ok(R.spread <= S.cfg.delta, `balanced : ${R.spread} mV`); assert.ok(R.socMean > 0.98); assert.ok(R.heatWh > 0, "the resistors turned energy into heat");
});

test("the module BM : each CORE board balances ALONE at its threshold — the central software commands nothing, hears it in their round, passes it to the vehicle", () => {
  const d = moduleDesign(); assert.ok(!d.objects.some((o) => o.kind === "balancing"), "no balancing commanded by the central board (JP, 27 novembre 2026)");
  assert.deepEqual(localRule(d), CORE_BALANCE); const S = balanceSpec(d); assert.deepEqual(S.local, { on: 4150, off: 4130 });
  assert.equal(coreBleed(0, 4149, S.local), 0); assert.equal(coreBleed(0, 4150, S.local), 1); assert.equal(coreBleed(1, 4131, S.local), 1, "hysteresis"); assert.equal(coreBleed(1, 4130, S.local), 0);
  /* the window's own charge : the charger stops at the end of its constant voltage, then each CORE above the threshold comes down to it — they meet there */
  const B = balanceStart(S), seen = new Set(); while (!B.done && B.t < 30 * 3600) { balanceStep(B, 10); seen.add(B.phase); }
  assert.ok(B.done, "the charge ends, the boards stop bleeding"); for (const p of ["soft", "cc", "cv", "top", "done"]) assert.ok(seen.has(p), p);
  const R = balanceSummary(B); assert.ok(R.spread <= 25, `the CORE meet at their threshold : ${R.spread} mV`); assert.ok(B.v.every((v) => v < 4.15 && v > 4.1), B.v.map((v) => v.toFixed(3)).join(" "));
  /* the module on the bench runs the same rule ; what the boards say goes to the pin of the round */
  const P = packStart(d); packDrive(P, { mode: "charge" }); let said = 0, top = 0; for (let k = 0; k < 6 * 3600 && !P.done; k++) { packStep(P, { closed: true }); said += packSense(P).bleed; if (P.phase === "top") top++; }
  assert.ok(said > 0 && top > 0, "the boards bleed after the charge, and say it"); assert.equal(d.plant.bleed, "bal_in");
  const pin = d.objects.find((o) => o.id === "bal_in"); assert.equal(pin.vehicle, "CAN FD", "passed to the vehicle with the round"); assert.ok(pin.bench, "a value of the round : no pin of the central board");
  assert.ok(monitorOf(d).product.some((p) => p.ref === "bal_in.level" && /local, signalé/.test(p.label)), "the monitoring shows it");
  assert.ok(d.objects.some((o) => o.id === "wake" && o.hw.net === "DIN0"), "the 12 V read on WAKE : without it the contactor stays open, the board keeps watching");
  assert.match(readFileSync(new URL("../../web/js/modules/sw_balance_ui.js", import.meta.url), "utf8"), /data-bal-local/);
});

test("the charge profile starts at 3,0 V and drives the module the windows show ; the window is in « Essayer »", () => {
  const d = moduleDesign(), e0 = profileOf(d, "charge")[0]; assert.equal(e0.plant.mode, "charge"); assert.equal(e0.plant.start, 3);
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8"); assert.match(read("sw_balance_ui.js"), /swBalanceOpen/); assert.match(read("sw.js"), /swBalance\(design, \{ bench/); assert.match(read("sw_balance_ui.js"), /dragWindow\(win, bar/, "the window moves by its title bar"); assert.match(read("sw_monitor_ui.js"), /data-swm-cores/);
  assert.match(read("sw_balance_ui.js"), /o\.bench\.plant/, "the window shows the module of the bench : the same simulation as the monitoring");
});
