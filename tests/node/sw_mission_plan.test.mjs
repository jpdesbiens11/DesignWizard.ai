/* The plan of the missions (JP, 27 novembre 2026 : « déplacées et réordonnées… classées de fonctionnelle vers performance puis par safety / corner
   case / malfunction… les tags des requis dans le graph temporel du profil de mission… disable / enable… un niveau de difficulté — une priorité de
   conception, du plus facile au plus difficile »).   node --test tests/node/sw_mission_plan.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLASSES, LEVELS, applyPlan, moveMission, nudgeMission, setOff, setLevel, confirmLevels, sortByLevel, profileSeries, tagLines } from "../../web/js/sw/sw_mission_plan.js";
import { campaignMissions, missionSig } from "../../web/js/sw/sw_req_missions.js";
import { runCampaign } from "../../web/js/sw/sw_campaign.js";
import { readCandidate, loopPrompt } from "../../web/js/sw/sw_loop.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const ids = (L, cls) => L.filter((m) => m.cls === cls).map((m) => m.id);

test("the classes in JP's order — Functional, Performance, Safety, Corner cases, Malfunction, then the holdout set — proposed from what a mission is and from the category its requirements carry", () => {
  assert.deepEqual(CLASSES.map((c) => c.key), ["functional", "performance", "safety", "corner", "malfunction", "reserve"]); for (const c of CLASSES) assert.ok(c.fr && c.says && c.color && c.icon);
  assert.deepEqual(LEVELS.map((l) => l.n), [1, 2, 3, 4, 5]);
  const p = bmProject(), M = campaignMissions(p, p.software[0]);
  assert.deepEqual([...new Set(M.map((m) => m.cls))], ["functional", "performance", "safety", "corner", "malfunction", "reserve"], "played class after class");
  assert.deepEqual(ids(M, "functional"), ["nom-charge", "nom-discharge", "rq-vblock_max-hi-3_9-charge", "rq-temp_max-hi-45-discharge", "rq-temp_max-lo-38-discharge"], "ESS-REQ-024 and 047 are Functional in DynamiteAgile");
  assert.deepEqual(ids(M, "performance"), ["rq-vblock_max-hi-4_2-charge", "env-ESS-REQ-003-0", "env-ESS-REQ-004-0"]);
  assert.ok(ids(M, "safety").includes("rq-vblock_max-hi-4_25-charge") && ids(M, "safety").includes("rq-vblock_min-lo-2_8-discharge"), "ESS-REQ-014 is Safety : the shared mission of 2,80 V is Safety");
  assert.deepEqual(ids(M, "malfunction"), ["fault-discharge"]); assert.equal(ids(M, "reserve").length, 4);
  assert.ok(M.every((m) => !m.off && !m.levelSure && m.level >= 1 && m.level <= 5), "every difficulty is a proposal until a person sets it");
});

test("moved, nudged, set Off, given a difficulty, ranged from the easiest : each a new plan — the holdout set takes no other mission and gives none", () => {
  const p = bmProject(), d = p.software[0], R = p.reqs, M = campaignMissions(p, d), at = (plan) => applyPlan(M, plan, R);
  let plan = moveMission({}, M, "rq-temp_max-hi-45-discharge", "functional", "nom-charge"); assert.equal(at(plan)[0].id, "rq-temp_max-hi-45-discharge", "placed before the first");
  plan = moveMission(plan, at(plan), "corner-charge", "safety"); assert.equal(at(plan).find((m) => m.id === "corner-charge").cls, "safety"); assert.equal(ids(at(plan), "safety").at(-1), "corner-charge", "at the end of its new class");
  assert.equal(at(moveMission(plan, at(plan), "nom-charge", "reserve")).find((m) => m.id === "nom-charge").cls, "functional"); assert.equal(at(moveMission(plan, at(plan), "reserve-2", "safety")).find((m) => m.id === "reserve-2").cls, "reserve");
  const L = at(plan), f = ids(L, "functional"); let q = nudgeMission(plan, L, f[1], -1); assert.deepEqual(ids(at(q), "functional").slice(0, 2), [f[1], f[0]]);
  q = nudgeMission(plan, L, f.at(-1), 1); assert.deepEqual(ids(at(q), "functional"), f, "the last of its class stays : it does not leave it by the keyboard");
  q = nudgeMission(plan, L, f[0], 1); assert.deepEqual(ids(at(q), "functional").slice(0, 2), [f[1], f[0]]);
  plan = setOff(plan, "nom-discharge", true); assert.ok(at(plan).find((m) => m.id === "nom-discharge").off); assert.ok(!at(setOff(plan, "nom-discharge", false)).find((m) => m.id === "nom-discharge").off);
  plan = setLevel(plan, "nom-charge", 4); const nc = at(plan).find((m) => m.id === "nom-charge"); assert.deepEqual([nc.level, nc.levelSure], [4, true]); assert.equal(at(setLevel(plan, "nom-charge", 9)).find((m) => m.id === "nom-charge").level, 5);
  const all = at(confirmLevels(plan, at(plan))); assert.ok(all.every((m) => m.levelSure)); assert.equal(all.find((m) => m.id === "nom-charge").level, 4, "what a person set stays");
  const sorted = at(sortByLevel(plan, at(plan))), fl = sorted.filter((m) => m.cls === "functional").map((m) => m.level); assert.deepEqual(fl, [...fl].sort((a, b) => a - b), "each class from the easiest"); assert.equal(sorted.filter((m) => m.cls === "functional").at(-1).id, "nom-charge");
});

test("the campaign plays the missions that are On, in the plan's order ; the signature counts what is played, not its order ; the AI loop never changes the plan", () => {
  const p = bmProject(), d = p.software[0], M = campaignMissions(p, d), two = M.filter((m) => ["env-ESS-REQ-003-0", "rq-vblock_max-hi-4_25-charge"].includes(m.id));
  const C = runCampaign(p, d, { profiles: two.map((m) => (m.id === "env-ESS-REQ-003-0" ? { ...m, off: true } : m)), when: "x" }); assert.deepEqual(C.profiles.map((x) => x.id), ["rq-vblock_max-hi-4_25-charge"]);
  assert.equal(C.profiles[0].cls, "safety"); assert.ok(C.profiles[0].level);
  const d2 = { ...d, missionPlan: moveMission({}, M, "nom-discharge", "functional", "nom-charge") }, d3 = { ...d, missionPlan: setOff({}, "nom-discharge", true) };
  assert.equal(missionSig(campaignMissions(p, d2)), missionSig(M), "moved : the same missions"); assert.notEqual(missionSig(campaignMissions(p, d3)), missionSig(M), "Off : one less played");
  assert.equal(campaignMissions(p, d3).find((m) => m.id === "nom-discharge").off, true, "an Off mission stays in the list : the bench can still play it");
  const x = JSON.parse(JSON.stringify(d)); x.missionPlan = setOff({}, "fault-discharge", true); Object.assign(x.objects.find((o) => o.id === "ov").params, { trip: 4201 });
  const c = readCandidate(`\`\`\`json\n${JSON.stringify(x)}\n\`\`\``, d); assert.ok(c.ok); assert.equal(c.doc.missionPlan, undefined, "the yardstick : put back as it was"); assert.ok(c.kept.some((t) => /missionPlan/.test(t)));
});

test("the profile graph : what the mission imposes, lane by lane, and the limits it aims at, tagged with their key and their verdict", () => {
  const p = bmProject(), d = p.software[0], M = campaignMissions(p, d), m = (id) => M.find((q) => q.id === id);
  const G = profileSeries(m("rq-vblock_max-hi-4_25-charge"), 36, 25); assert.deepEqual(G.lanes.map((l) => l.key), ["i", "v"]);
  assert.deepEqual(G.lanes[1].pts.map((q) => q[1]).filter((v, i, a) => v !== a[i - 1]), [null, 4.23, 4.28, null], "the cell emulator : off, near, past, off");
  assert.ok(G.lanes[0].pts.every((q) => q[1] === -36), "the charger at 1 C"); assert.ok(G.marks.some((x) => x.cross));
  assert.deepEqual(tagLines(m("rq-vblock_max-hi-4_25-charge"), p.reqs).map((x) => `${x.key}@${x.value}`), ["ESS-REQ-013@4.25"]);
  assert.deepEqual(tagLines(m("rq-temp_max-hi-75-discharge"), p.reqs).map((x) => `${x.lane}:${x.key}@${x.value}`), ["t:ESS-REQ-015@75"], "only the limit it aims at, not the 65 °C of the same requirement");
  assert.deepEqual(tagLines(m("rq-current_abs-hi-95-charge"), p.reqs).map((x) => x.value), [95, -95], "|I| : both ways");
  assert.deepEqual(tagLines(m("nom-charge"), p.reqs).map((x) => `${x.key}@${x.value}`), ["ESS-REQ-002@2.8", "ESS-REQ-002@4.2"]);
  const C = { rows: [{ key: "ESS-REQ-013", n: 0, by: { "rq-vblock_max-hi-4_25-charge": "pass" } }] }; assert.equal(tagLines(m("rq-vblock_max-hi-4_25-charge"), p.reqs, C)[0].verdict, "pass");
  assert.equal(profileSeries(m("fault-discharge"), 36, 25).lanes.length, 1, "a fault mission imposes only its current : its faults are marks");
});

test("the AI loop's instruction lists what fails from the easiest mission ; wiring : the Missions screen drags, switches, sets the difficulty and draws the graph", () => {
  const C = { profiles: [{ id: "a", name: "A", level: 4 }, { id: "b", name: "B", level: 1 }], rows: [
    { key: "R1", n: 0, text: "R1", req: { statement: "un" }, by: { a: "fail" }, overall: "fail", oracle: { kind: "bound" } }, { key: "R2", n: 0, text: "R2", req: { statement: "deux" }, by: { b: "fail" }, overall: "fail", oracle: { kind: "bound" } }] };
  const P = loopPrompt({ reqs: null }, { objects: [] }, C); assert.ok(P.indexOf("- R2") < P.indexOf("- R1"), "the easiest first"); assert.match(P, /B \(difficulté 1\)/);
  const m = read("web/js/modules/sw_missions.js"); for (const w of [/dragstart/, /moveMission/, /nudgeMission/, /onOff\(/, /setLevel/, /sortByLevel/, /missionGraph\(/, /data-sw-start/]) assert.match(m, w);
  assert.match(read("web/js/modules/sw_mission_graph.js"), /swg-tag/); assert.match(read("web/js/modules/sw_findings.js"), /swf2-lv/); assert.match(read("web/js/modules/sw_lean_ui.js"), /missionPlan/, "the list follows the plan");
});
