/* The module on the bench, one simulation for every window (demande de JP, 25 novembre 2026 : « ces 2 fenêtres doivent suivre le même profil…
   couvrir tous les cas de l'enveloppe de fonctionnement et trigger les safety… exporter et importer… le démarrer et voir les conséquences dans la
   logique SW » ; choix cliqué : « Tirés des seuils du logiciel »).   node --test tests/node/sw_pack.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { packStart, packStep, packSense, packDrive, packLimits, coverage } from "../../web/js/sw/sw_pack.js";
import { liveStart, liveStep, liveSet, liveDrive, plantPins } from "../../web/js/sw/sw_live.js";
import { expandProfile } from "../../web/js/sw/sw_story.js";
import { profileTxt, parseProfileTxt, profilePrompt } from "../../web/js/sw/sw_profiles.js";

test("the plant obeys the software : no current with the contactor open, the current held low while derated, the pump cools", () => {
  const d = moduleDesign(), P = packStart(d, { start: 3.6 }); packDrive(P, { mode: "discharge", a: 72 });
  packStep(P, { closed: true }); assert.equal(P.i, -72); packStep(P, { closed: false }); assert.equal(P.i, 0, "open : nothing flows");
  packStep(P, { closed: true, derate: true }); assert.equal(P.i, -18, "derated : 0,5 C"); packStep(P, { closed: true }); assert.equal(P.i, -18, "the vehicle holds the derating a while");
  const hot = packStart(d); packDrive(hot, { heatTo: 70 }); for (let s = 0; s < 300; s++) packStep(hot, {});
  assert.ok(Math.abs(hot.temp - 70) < 1.5, `heat from outside brings it to 70 °C (${hot.temp})`); assert.equal(packSense(hot).temp, Math.round(hot.temp * 10), "0,1 °C as the software keeps it");
  const air = packStart(d), pump = packStart(d); air.temp = pump.temp = 60; packStep(air, {}); packStep(pump, { pump: true }); assert.ok(pump.temp < air.temp, "the pump cools faster than the air");
});

test("every limit of the software is crossed by the physics, the software answering : charge and discharge played on the bench", () => {
  const d = moduleDesign(), want = { charge: ["over_ic", "cool", "hot", "ot", "hvw", "ov"], discharge: ["over_i", "cool", "hot", "ot", "lvw", "uv"] };
  assert.deepEqual(packLimits(d).map((l) => l.id).sort(), ["cool", "hot", "hvw", "lvw", "ot", "ov", "over_i", "over_ic", "uv"]); assert.deepEqual(coverage(d, d.profiles).left, []);
  for (const p of d.profiles) { const L = liveStart(d, 10), E = expandProfile(p.events), seen = new Set(); let at = 0, opened = 0, prevK = 1;
    assert.ok(plantPins(L).has("adc_v") && plantPins(L).has("adc_i"), "the module drives the pins it names");
    for (let k = 0; k * 10 <= E[E.length - 1].t; k++) { while (at < E.length && E[at].t <= k * 10) { const e = E[at++]; if (e.plant) liveDrive(L, e.plant); for (const [i, v] of Object.entries(e.set || {})) liveSet(L, i, v); }
      liveStep(L, 1); for (const id of want[p.id]) if (L.m.last[`${id}.trip`]) seen.add(id); const kk = L.m.last["k_drv.level"]; if (prevK && !kk) opened++; prevK = kk; }
    assert.deepEqual([...seen].sort(), [...want[p.id]].sort(), `${p.id} : each limit tripped by the module itself`);
    assert.ok(opened >= 2, `${p.id} : the software opened the contactor (${opened})`); }
});

test("a profile goes out as text and comes back unchanged — what drives the module, the inputs, the limits it crosses ; the prompt names them", () => {
  const d = moduleDesign();
  for (const p of d.profiles) { const back = parseProfileTxt(profileTxt(p, d), d); assert.deepEqual(back.errors, []);
    assert.deepEqual(back.profile.events.map((e) => [e.t, e.plant, e.set, e.pulse, e.target]), p.events.map((e) => [e.t, e.plant, e.set, e.pulse, e.target])); }
  const bad = parseProfileTxt("name: X\n0 | a | b | module.mode = fly ; module.load = 9 V | zz\n", d); assert.equal(bad.errors.length, 3);
  assert.match(parseProfileTxt("0 | a | b | module.mode = charge\n", { objects: [], wires: [] }).errors[0].text, /pas de module simulé/);
  const ask = profilePrompt(d); for (const re of [/module\.heat_to/, /module\.cv_fail/, /5e champ/, /ov — /]) assert.match(ask, re);
});
