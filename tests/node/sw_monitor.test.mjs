/* The monitoring of the module BM (demande de JP, 24 novembre 2026) : the status lamp green · yellow · red, the extreme cases of the usage profile
   — the contactor open about 2 s, the buzzer, the coolant pump —, and the dashboard « Monitoring du BM-SWAP » read from the software.
   node --test tests/node/sw_monitor.test.mjs */
import test from "node:test";
import { coverage } from "../../web/js/sw/sw_pack.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS } from "../../web/js/sw/sw_objects.js";
import { LIB, requirement } from "../../web/js/sw/sw_c.js";
import { LIBRARY } from "../../web/js/sw/sw_blocks.js";
import { DEVICES } from "../../web/js/sw/sw_devices.js";
import { problems } from "../../web/js/sw/sw_design.js";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { playProfile, profileOf, profilesOf, expandProfile } from "../../web/js/sw/sw_story.js";
import { profileTxt, parseProfileTxt, profilePrompt } from "../../web/js/sw/sw_profiles.js";
import { monitorOf, monitorRead } from "../../web/js/sw/sw_monitor.js";
import { liveStart, liveStep } from "../../web/js/sw/sw_live.js";

test("the status lamp : one lamp lit at a time, green for normal, yellow for derated, red for emergency and stop ; its C, its sentence, its place in the library", () => {
  const K = KINDS.state_lamp, s = K.init();
  assert.deepEqual([0, 1, 2, 3].map((q) => K.step(s, {}, { state: q })), [{ green: 1, yellow: 0, red: 0 }, { green: 0, yellow: 1, red: 0 }, { green: 0, yellow: 0, red: 1 }, { green: 0, yellow: 0, red: 1 }]);
  assert.match(LIB.state_lamp.c, /dw_lamp_step/); assert.ok(LIBRARY.some((x) => x.kind === "state_lamp"));
  const d = moduleDesign(); assert.match(requirement(d, d.objects.find((o) => o.id === "lamp")), /green lamp while Module state · state is NORMAL|green lamp while .* is NORMAL/);
  assert.equal(DEVICES.pump.side, "actuator");
  assert.deepEqual(problems(d).filter((p) => p.level === "error"), []);
});

test("the mission profiles of the module : a charge and a discharge, written from the thresholds of the software — every limit crossed on purpose", () => {
  const d = moduleDesign(); assert.deepEqual(profilesOf(d).map((p) => p.kind), ["charge", "discharge"]);
  assert.deepEqual(coverage(d, d.profiles).left, [], "no limit of the software left untouched");
  for (const p of d.profiles) { assert.ok(p.events.some((e) => e.pulse), `${p.id} : an acknowledgement is a button pressed then released`); assert.ok(p.events.some((e) => e.plant && e.plant.mode === p.kind), `${p.id} : the module ${p.kind === "charge" ? "charges" : "discharges"}`); }
  assert.deepEqual(expandProfile([{ t: 100, id: "a", set: {}, pulse: { ack: 300 } }]).map((e) => [e.t, e.set.ack, !!e.hidden]), [[100, 1, false], [400, 0, true]]);
});

test("the bank : a profile as text and back, unchanged ; a wrong line said with its reason ; the prompt names the variables of this bench", () => {
  const d = moduleDesign(), p = d.profiles[1], back = parseProfileTxt(profileTxt(p, d), d);
  assert.deepEqual(back.errors, []); assert.equal(back.profile.kind, "discharge");
  assert.deepEqual(back.profile.events.map((e) => [e.t, e.set, e.pulse]), p.events.map((e) => [e.t, e.set, e.pulse]));
  const bad = parseProfileTxt("name: X\n0 | a | b | foo = 1 V ; adc_v = 9 V ; adc_t = 20 V ; ack = pulse 0.3 s\n", d);
  assert.equal(bad.errors.length, 3); assert.match(bad.errors.map((e) => e.text).join(" "), /« foo » n'est pas une entrée.*adc_v : 9 V est hors.*adc_t se donne en °C/);
  const ask = profilePrompt(d, "une charge en hiver"); for (const re of [/mission-profile@1/, /adc_i — Module current — en A/, /ack — Bouton : acquitter le défaut — logique/, /charge\) est négatif/, /LA DEMANDE : une charge en hiver/]) assert.match(ask, re);
});

test("the dashboard is read from the software : its title, the colour of each condition, the values in physical units, what the product does", () => {
  const d = moduleDesign(), M = monitorOf(d);
  assert.equal(M.title, "Monitoring du BM-SWAP"); assert.ok(M.lamp && M.state);
  const sev = Object.fromEntries(M.rows.map((r) => [r.id, r.sev]));
  assert.deepEqual(sev, { hvw: "yellow", ov: "red", lvw: "yellow", uv: "red", hot: "yellow", ot: "red", over_i: "yellow", over_ic: "yellow" }, "a limit that ends in a fault is red ; one that derates is yellow ; the pump's is an action, not a condition");
  assert.ok(M.product.some((p) => p.id === "pump" && p.sev === "green") && M.product.some((p) => p.id === "buzz") && M.product.some((p) => p.id === "k"));
  const L = liveStart({ ...d, plant: undefined }); liveStep(L, 5); const R = monitorRead(M, (r) => L.m.last[r]);      // the bench at its scenario, without the simulated module
  assert.equal(R.general, "green"); assert.equal(R.stateName, "NORMAL"); assert.equal(R.rows.find((r) => r.id === "ov").valueText, "3,9 V"); assert.equal(R.alarm, false);
  assert.match(monitorOf({ name: "X", objects: [{ id: "m", kind: "module_state", params: {} }], wires: [] }).title, /Monitoring — X/);
});

test("the screens : the bubble under the storyline, « Suivant », the window and its sound", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/modules/${f}`, import.meta.url), "utf8");
  assert.match(read("sw_story_ui.js"), /swStoryNext/); assert.match(read("sw_story_ui.js"), /data-sw-profiles/); assert.match(read("sw_profile_bank.js"), /Ajouter à la banque/); assert.match(read("sw.js"), /\[story\.line\] : \[\]\), \.\.\.\(mission \? \[mission\.halt\] : \[\]\), \.\.\.\(story \? \[story\.bubble\]/, "the line of the profile, the banner of a limit, then the bubble");
  assert.match(read("sw_monitor_ui.js"), /Fenêtre à part/); assert.match(read("sw_sound.js"), /createOscillator/);
});
