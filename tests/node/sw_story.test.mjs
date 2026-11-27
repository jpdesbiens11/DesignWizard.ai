/* The USAGE PROFILE of the « Essayer » step (demande de JP, 24 novembre 2026) : typical events in time that reach the software through the
   board, and what the software and the product answer — told in a bubble over the pieces, the chronogram kept below.   node --test tests/node/sw_story.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { autoProfile, profileOf, playProfile } from "../../web/js/sw/sw_story.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the profile the tool writes : at rest, each input past its threshold and back, the one that latches a fault last", () => {
  const d = { ...bmProject().software[0], plant: undefined }, P = autoProfile(d);      // the bench driven by hand : without its simulated module (sw/sw_pack.js)
  assert.equal(P[0].id, "start"); assert.equal(P[P.length - 1].id, "end"); for (let i = 1; i < P.length; i++) assert.ok(P[i].t > P[i - 1].t, "in time");
  for (const e of P) assert.ok(e.title && e.says && typeof e.set === "object", e.id);
  assert.match(P.find((e) => e.id === "hot-in").says, /24,9 °C à 62,4 °C — au-delà du seuil de 60 °C/, "in the units of physics");
  assert.ok(P.findIndex((e) => e.id === "ov-in") > P.findIndex((e) => e.id === "lost-on"), "the over-voltage latches the fault : it comes after the others");
  assert.equal(profileOf({ ...d, profiles: undefined, profile: [{ t: 0, id: "x", title: "X", says: "x", set: {} }] }).length, 1, "the project's own profile when it has one");
});

test("played on the model : what the software and the product answer, and when", () => {
  const d = { ...bmProject().software[0], plant: undefined }, R = playProfile(d, autoProfile(d)), at = (id) => R.events.find((e) => e.id === id).answers.map((a) => `${a.text} @${a.after}`);
  assert.ok(at("hot-in").includes("Module state : DÉRATÉ @1020"), at("hot-in").join(" | "));
  for (const w of ["Module state : URGENCE @490", "Module state : ARRÊT @1490", "Contactor : ouvert @1490", "Sortie : bobine du contacteur : relâché @1490", "General state lamp : rouge @490", "Buzzer — alarme : sonne @490"]) assert.ok(at("lost-on").includes(w), `${w} — ${at("lost-on").join(" | ")}`);
  assert.ok(at("ov-in").includes("Fault latch : défaut retenu @110"));
  assert.ok(R.events.every((e) => e.answers.every((a) => !/^Banc|^Entrée/.test(a.text))), "the pins the software reads are not answers");
  assert.equal(R.events.find((e) => e.id === "lost-on").answers.find((a) => a.text === "Contactor : ouvert").when, "1,49 s");
  const ui = read("web/js/modules/sw_story_ui.js"); assert.match(ui, /data-sw-bubble/); assert.match(ui, /bench\.set\(id, v\)/, "the events set the instruments of the bench"); assert.match(ui, /bench\.drive\(e\.plant\)/, "and drive the module on the bench");
  assert.match(read("web/js/modules/sw.js"), /story\.line/, "the storyline above the chronogram, which stays");
});
