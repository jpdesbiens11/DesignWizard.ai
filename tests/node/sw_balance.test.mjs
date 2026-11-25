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
import { playProfile, profileOf } from "../../web/js/sw/sw_story.js";
import { ocv, socAt, balanceSpec, balanceStart, balanceStep, balanceSummary } from "../../web/js/sw/sw_balance.js";

test("the block « Passive balancing » : on above the floor voltage and the delta, off under the return gap, never while discharging ; its C and its sentence", () => {
  const K = KINDS.balancing, c = { v_min: 3900, delta: 20, hyst: 10 }, s = K.init(), run = (v, low, i = 0) => K.step(s, c, { v, low, i }, 10).bleed;
  assert.equal(run(3850, 3700), 0, "under the floor : no balancing"); assert.equal(run(4000, 3985), 0, "15 mV : under the delta"); assert.equal(run(4000, 3975), 1, "25 mV : bleeds");
  assert.equal(run(4000, 3985), 1, "15 mV : still bleeding (hysteresis)"); assert.equal(run(4000, 3991), 0, "9 mV : stops");
  run(4000, 3950); assert.equal(run(4000, 3950, 5000), 0, "the pack discharges : never");
  assert.match(LIB.balancing.c, /dw_balance_step/); assert.ok(LIBRARY.some((x) => x.kind === "balancing") && !LIBRARY.some((x) => x.planned && x.id === "balancing"), "a block that runs, no longer « à venir »");
  const d = moduleDesign(); assert.match(requirement(d, d.objects.find((o) => o.kind === "balancing")), /above 3900 mV and above .* by more than 20 mV/);
});

test("the charge of the 8 CORE : from 3,0 V at rest, 0,1 C then 2 C, slower while a resistor bleeds, constant voltage at 4,2 V — and at the end balanced", () => {
  assert.equal(ocv(0), 2.5); assert.equal(ocv(1), 4.2); assert.ok(Math.abs(ocv(socAt(3.0)) - 3.0) < 1e-9, "0 % = 2,5 V, 100 % = 4,2 V");
  const free = balanceSpec(moduleDesign()), F = balanceStart(free); while (!F.done && F.t < 12 * 3600) balanceStep(F, 10);
  assert.ok(F.done && F.trace.some((p) => p.bleed.some(Boolean) && p.i > 70), "by default the resistors bleed WHILE it charges at 2 C (balancing during charge)"); assert.ok(!F.trace.some((p) => p.phase === "bal"), "no slowing by default");
  const S = balanceSpec(moduleDesign(), { cBal: 0.5 }), B = balanceStart(S); assert.equal(S.cfg.v_min, 3900, "the settings of the software's block");
  const rest = B.v.reduce((a, x) => a + x, 0) / B.v.length; assert.ok(Math.abs(rest - 3.0) < 0.06, `starts about 3,0 V (${rest})`);
  const seen = new Set(), rates = []; let flips = 0, last = "";
  while (!B.done && B.t < 12 * 3600) { balanceStep(B, 10); const R = balanceSummary(B); seen.add(R.phase); rates.push(R.cRate); if (R.phase !== last) { flips++; last = R.phase; } }
  assert.ok(B.done, "the charge ends"); for (const p of ["soft", "cc", "bal", "cv", "done"]) assert.ok(seen.has(p), p);
  assert.ok(Math.abs(rates[0] - 0.1) < 1e-9 && Math.max(...rates) <= 2 + 1e-9 && Math.max(...rates) > 1.99, "0,1 C first, 2 C at most (9 A per cell, 8 in parallel)");
  assert.ok(flips < 12, `the phases do not beat (${flips})`); const R = balanceSummary(B); assert.ok(R.spread <= S.cfg.delta, `balanced : ${R.spread} mV`); assert.ok(R.socMean > 0.98); assert.ok(R.heatWh > 0, "the resistors turned energy into heat");
});

test("the charge profile starts at 3,0 V and tells the balancing ; the window is in « Essayer »", () => {
  const d = moduleDesign(), P = playProfile(d, profileOf(d, "charge")), all = P.events.flatMap((e) => e.answers.map((a) => a.text));
  assert.equal(d.profiles[0].events[0].set.adc_vmin, 3000); assert.ok(all.some((t) => /résistance de la CORE la plus haute est branchée/.test(t)) && all.some((t) => /résistance débranchée/.test(t)));
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8"); assert.match(read("sw_balance_ui.js"), /swBalanceOpen/); assert.match(read("sw.js"), /swBalance\(design/); assert.match(read("sw_balance_ui.js"), /dragWindow\(win, bar/, "the window moves by its title bar"); assert.match(read("sw_monitor_ui.js"), /data-swm-cores/);
});
