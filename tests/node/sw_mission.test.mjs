/* The mission view (JP, 26 novembre 2026 : « an overlay that shows the duty cycle of the components vs. time… export/import the actual profile…
   when we meet a limit, user must restart the profile by clicking on "continue" if fault is manageable »).   node --test tests/node/sw_mission.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { liveStart, liveStep, liveDrive, recordCsv } from "../../web/js/sw/sw_live.js";
import { dutyOf } from "../../web/js/modules/sw_mission.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the record of a mission : one sample a second — the pins, the state, each output, the balancing — as CSV ; the duty cycle of each component", () => {
  const d = moduleDesign(), L = liveStart(d); liveDrive(L, { mode: "charge", start: 3.0 }); liveStep(L, 100 * 120);
  assert.ok(L.rec.length >= 120 && L.rec.length <= 122, `${L.rec.length} samples for 2 min`); assert.ok(L.recRefs.includes("k_drv.level") && L.recRefs.includes("pump.level"));
  const csv = recordCsv(L, { "k_drv.level": "Contactor coil" }); assert.match(csv.split("\r\n")[0], /^t \(s\),Vmax \(V\),Vmin \(V\),T max \(°C\),I \(A, \+ discharge\),state,bleeding CORE,Contactor coil/);
  const D = dutyOf(L.rec, L.recRefs); assert.ok(D["k_drv.level"] > 0.9, "the contactor is closed nearly all the time"); assert.equal(D["buzz.level"], 0, "the buzzer never sounds");
});

test("the screen : the mission takes the place of the pieces, a limit stops the profile until « Continuer », the profile goes out and comes in", () => {
  const m = read("web/js/modules/sw_mission.js"), s = read("web/js/modules/sw_story_ui.js"), w = read("web/js/modules/sw.js");
  assert.match(m, /Exporter le profil \(\.txt\)/); assert.match(m, /openBank\(/); assert.match(m, /recordCsv\(L/); assert.match(m, /stampText\(name/, "the CSV carries the brand");
  assert.match(s, /now >= 2 && \(st\.lastRed \|\| 0\) < 2/, "URGENCE or ARRÊT stops the profile"); assert.match(s, /function cont\(\)/); assert.match(s, /if \(st\.halt\) return L;/, "nothing runs while it is stopped");
  assert.match(w, /swMission\(bench, design, story, change/); assert.match(w, /mission\.halt/);
});

test("the rack, compact while a module is on the bench : what it drives is read, what one injects stays a switch", () => {
  const r = read("web/js/modules/sw_lab.js"); assert.match(r, /node\.classList\.toggle\("compact", !!L\.plant\)/); assert.match(r, /swlab-chip read/); assert.match(r, /swlab-seg mini/);
});

test("full screen is the browser's own (the whole screen), with the root of the page when it is refused", () => {
  const m = read("web/js/modules/sw_mission.js"); assert.match(m, /node\.requestFullscreen\(\)/); assert.match(m, /document\.body\.append\(node\)/); assert.match(m, /addEventListener\("fullscreenchange", fsChange\)/);
});
