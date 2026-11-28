/* The missions written from the requirements (JP, 27 novembre 2026 : « toutes les missions de l'équipement — les variations in / out que le logiciel
   doit tenir dans les bornes des requis » ; choix par menu : « les missions viennent des requis »).   node --test tests/node/sw_req_missions.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campaignMissions, missionGaps, projectProfiles, reserveSeed, missionSig, reqOracles, ORIGINS, GAPS, goalOf, goalReached, missionOutcome, QUIET } from "../../web/js/sw/sw_req_missions.js";
import { playMission } from "../../web/js/sw/sw_campaign.js";
import { packStart, packDrive, packStep, packSense, missionProfiles } from "../../web/js/sw/sw_pack.js";
import { PLANT_VARS, profileTxt, parseProfileTxt } from "../../web/js/sw/sw_profiles.js";
import { judge } from "../../web/js/core/req_oracle.js";
import { nominalVerdict, NOMINAL_RULE } from "../../web/js/sw/sw_campaign.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("every limit a requirement of the software sets has its mission : approached, crossed by a clear margin and held, brought back, acknowledged ; two limits on the same quantity make one", () => {
  const p = bmProject(), d = p.software[0], M = campaignMissions(p, d), L = M.filter((m) => m.origin === "limit");
  assert.deepEqual(missionGaps(p), [], "no limit read by the machine is left without a mission");
  const keys = new Set(L.flatMap((m) => m.keys)); for (const x of reqOracles(p.reqs).filter((x) => x.o.kind !== "envelope")) assert.ok(keys.has(x.key), x.key);
  const low = L.find((m) => m.id === "rq-vblock_min-lo-2_8-discharge"); assert.deepEqual(low.keys, ["ESS-REQ-002", "ESS-REQ-014"], "the bound of 2,80 V and the reaction at 2,80 V : one mission");
  for (const m of L) { const at = (id) => m.events.find((e) => e.id === id); const near = at("near"), past = at("past"), back = at("back");
    assert.ok(near && past && back && near.t < past.t && past.t < back.t, m.id); assert.ok(past.cross && past.keys.length, m.id);
    assert.ok(m.events.some((e) => e.pulse && e.pulse.ack), `${m.id} : acknowledged`); assert.equal(m.events.at(-1).id, "end"); }
  const ov = L.find((m) => m.id === "rq-vblock_max-hi-4_25-charge"), e = (id) => ov.events.find((x) => x.id === id).plant;
  assert.equal(e("near").cellHi, 4.23); assert.equal(e("past").cellHi, 4.28); assert.equal(e("back").cellHi, 0, "the cell emulator lets the block go");
  const hot = L.find((m) => m.id === "rq-temp_max-hi-65-charge"); assert.equal(hot.kind, "charge", "« en charge » : the mission charges"); assert.equal(hot.events.find((x) => x.id === "past").plant.heatTo, 68);
  assert.ok(L.some((m) => m.id === "rq-current_abs-hi-95-discharge") && L.some((m) => m.id === "rq-current_abs-hi-95-charge"), "|I| : both ways");
  assert.deepEqual(M.filter((m) => m.origin === "envelope").map((m) => m.name), ["ESS-REQ-003 — 360 A en décharge", "ESS-REQ-004 — 72 A en charge"]);
  assert.deepEqual(M.filter((m) => m.origin === "corner").map((m) => m.name), ["Corner case — décharge 360 A à 73 °C", "Corner case — charge 72 A à 63 °C"], "the largest current at the edge of the temperature that removes service");
  const F = M.find((m) => m.origin === "fault"); assert.ok(F.events.some((x) => x.set && x.set.lost === 1) && F.events.some((x) => x.set && x.set.wake === 0) && F.events.some((x) => x.set && x.set.k_fb === "closed"));
  assert.deepEqual(Object.keys(ORIGINS), ["nominal", "limit", "envelope", "corner", "fault", "project", "reserve"]); for (const O of Object.values(ORIGINS)) assert.ok(O.fr && O.en && O.color && O.icon && O.says);
  assert.ok(GAPS.length >= 3);
});

test("the yardstick is read from the requirements, never from the software : the bench's profiles written from the thresholds stay on the bench ; an imported one is played", () => {
  const p = bmProject(), d = p.software[0], P = projectProfiles(d);
  assert.deepEqual(P.bench.map((x) => x.id), ["charge", "discharge"]); assert.deepEqual(P.played, []);
  assert.ok(missionProfiles(d).every((x) => x.from === "thresholds"));
  const old = { ...d, profiles: d.profiles.map(({ from, ...x }) => x) }; assert.deepEqual(projectProfiles(old).bench.map((x) => x.id), ["charge", "discharge"], "a project saved before the mark : recognised by its events");
  const mine = { id: "vol", name: "Vol type", kind: "discharge", events: [{ t: 0, id: "a", title: "Décollage", says: "", set: {}, plant: { mode: "discharge", a: 200 } }, { t: 60000, id: "end", title: "Fin", says: "", set: {} }] };
  const withMine = { ...d, profiles: [...d.profiles, mine] }; assert.deepEqual(projectProfiles(withMine).played.map((x) => x.id), ["vol"]);
  assert.ok(campaignMissions(p, withMine).some((m) => m.id === "vol" && m.origin === "project"));
  /* the candidate of an AI loop changes thresholds : the missions do not move */
  const x = JSON.parse(JSON.stringify(d)); Object.assign(x.objects.find((o) => o.id === "ov").params, { trip: 4201 });
  assert.equal(missionSig(campaignMissions(p, x)), missionSig(campaignMissions(p, d)));
});

test("the holdout set : drawn from a seed read from the requirements — the same lot until they change ; a new reading of a statement, a new lot", () => {
  const p = bmProject(), d = p.software[0], R = (M) => M.filter((m) => m.origin === "reserve");
  const a = R(campaignMissions(p, d)), b = R(campaignMissions(p, d)); assert.equal(a.length, 4); assert.deepEqual(a, b);
  assert.ok(a.every((m) => m.events.filter((e) => /^s\d/.test(e.id)).length === 8 && !m.keys.length));
  const q = bmProject(), r = q.reqs.rows.find((x) => (x.key || x.external_id) === "ESS-REQ-047"); r.statement = r.statement.replace("45 °C", "46 °C");
  assert.notEqual(reserveSeed(q.reqs), reserveSeed(p.reqs)); assert.notDeepEqual(R(campaignMissions(q, q.software[0])), a);
  assert.equal(campaignMissions(p, d, { reserve: false }).filter((m) => m.origin === "reserve").length, 0);
});

test("the cell emulator of the bench holds the highest or lowest cell block at a voltage : what the pins read, what a CORE board's own rule reads ; it travels in a profile's .txt", () => {
  const d = bmProject().software[0], P = packStart(d, { start: 3.8 }); packDrive(P, { mode: "rest", cellHi: 4.28 });
  const s = packSense(P); assert.equal(s.vmax, 4280); assert.ok(s.vmin < 3900);
  packDrive(P, { cellHi: 0, cellLo: 2.75 }); assert.equal(packSense(P).vmin, 2750); assert.ok(packSense(P).vmax < 3900);
  const Q = packStart(d, { start: 3.8 }); packDrive(Q, { mode: "rest", cellHi: 4.2 }); for (let k = 0; k < 3; k++) packStep(Q, { closed: true }); assert.equal(packSense(Q).bleed, 1, "the CORE board of that block bleeds : it reads its emulated block (4,20 V > 4,15 V)");
  assert.ok(PLANT_VARS.some((v) => v.key === "cellHi") && PLANT_VARS.some((v) => v.key === "cellLo"));
  const p = bmProject(), m = campaignMissions(p, d).find((x) => x.id === "rq-vblock_max-hi-4_25-charge"), back = parseProfileTxt(profileTxt(m, d), d);
  assert.equal(back.errors.length, 0, JSON.stringify(back.errors)); assert.equal(back.profile.events.find((e) => /Franchit/.test(e.title)).plant.cellHi, 4.28);
});

test("the judge reads the way the module was going when its contactor cut it off ; the nominal rule : once closed, the contactor stays closed, no Emergency, no Shutdown", () => {
  const line = (t, temp, current, contactor) => ({ t: t * 1000, temp_max: temp, current, contactor, state: contactor ? 1 : 3 });
  const o = { kind: "reaction", if: [{ signal: "temp_max", op: ">", value: 75 }], mode: "discharge", hold: 500, then: { signal: "contactor", is: 0 }, within: 1000 };
  /* the software opens at 75,0 °C : the line past 75 °C has no current — the module was discharging when it was cut off */
  assert.equal(judge(o, [line(1, 74.9, 18, 1), line(2, 75, 18, 1), line(3, 75, 0, 0), line(4, 75.1, 0, 0)]).verdict, "pass");
  assert.equal(judge(o, [line(1, 74, 0, 1), line(2, 76, 0, 1)]).verdict, "none", "at rest, contactor closed : not in discharge");
  const n = (K, st = 0) => K.map((k, i) => ({ t: i * 1000, contactor: k, state: st }));
  assert.equal(nominalVerdict(n([0, 1, 1, 1])), "pass", "it closes at the start"); assert.equal(nominalVerdict(n([0, 1, 0, 1])), "fail"); assert.equal(nominalVerdict(n([0, 1, 1], 2)), "fail"); assert.equal(nominalVerdict(n([0, 0])), "fail", "never closed");
  assert.match(NOMINAL_RULE.statement, /pas une exigence de la liste/);
});

test("wiring : the Missions screen groups by kind and names the requirements ; the bench and the Mission view play a requirement mission ; the findings group their columns", () => {
  const m = read("web/js/modules/sw_missions.js"); assert.match(m, /data-sw-mission-group/); assert.match(m, /missionsOf\(d\)/); assert.match(m, /Restent sur le banc/);
  assert.match(read("web/js/modules/sw_story_ui.js"), /missionsOf\(d\)/); assert.match(read("web/js/modules/sw_mission.js"), /missionsOf\(d\)\.find/);
  const f = read("web/js/modules/sw_findings.js"); assert.match(f, /swf2-og/); assert.match(f, /Règle de la campagne/); assert.match(f, /profiles: P/);
  assert.match(read("web/js/sw/sw_campaign.js"), /profiles: all = campaignMissions\(project, d\)/);
});

test("a mission ends at its goal, before its longest time : the nominal charge when the charger stops, the nominal discharge at its floor, the others when every event is played and nothing moves for 30 s — « Succès » when no requirement it aims at fails", () => {
  const p = bmProject(), d = p.software[0], M = campaignMissions(p, d), m = (id) => M.find((q) => q.id === id);
  assert.deepEqual(goalOf(m("nom-charge")).kind, "charge-end"); assert.equal(goalOf(m("nom-discharge")).kind, "floor"); assert.equal(goalOf(m("rq-vblock_max-hi-4_25-charge")).kind, "events");
  const ch = playMission(d, m("nom-charge")); assert.ok(ch.goal && /chargeur/.test(ch.goal.why)); assert.ok(ch.t < goalOf(m("nom-charge")).max * 0.75, `the charge ends at ${ch.t / 1000} s, its longest is ${goalOf(m("nom-charge")).max / 1000} s`);
  assert.deepEqual(missionOutcome(m("nom-charge"), p.reqs, ch, d.plant), { ok: true, fails: [], idle: [], held: 2, judged: 2 });
  const co = missionOutcome(m("corner-discharge"), p.reqs, playMission(d, m("corner-discharge")), d.plant); assert.deepEqual([co.ok, co.fails, co.idle.length > 0], [false, [], true], "the software derates at 60 °C : the 360 A of the corner never flow — not a success");
  const dis = playMission(d, m("nom-discharge")); assert.ok(dis.goal && /sous 3,2 V/.test(dis.goal.why));
  const ov = playMission(d, m("rq-vblock_max-hi-4_25-charge")), G = goalOf(m("rq-vblock_max-hi-4_25-charge")); assert.ok(ov.goal && ov.t >= G.last + QUIET && ov.t < G.max, "every event played, then 30 s of quiet");
  assert.equal(missionOutcome(m("rq-vblock_max-hi-4_25-charge"), p.reqs, ov, d.plant).ok, true);
  const hot = missionOutcome(m("rq-temp_max-hi-65-charge"), p.reqs, playMission(d, m("rq-temp_max-hi-65-charge")), d.plant); assert.deepEqual([hot.ok, hot.fails], [false, ["ESS-REQ-015"]], "the 65 °C in charge : no threshold in the software");
  /* the rule on a made-up run */
  const L = { t: 50000, plant: { drive: { mode: "rest" }, v: [3.9] }, log: [{ t: 30000 }] }; assert.equal(goalReached({ kind: "events", last: 10000, quiet: 30000 }, L), null, "an output changed 20 s ago");
  assert.ok(goalReached({ kind: "events", last: 10000, quiet: 30000 }, { ...L, t: 61000 }));
  /* on the bench : the story ends the mission and the Mission view says so ; the docked window opens a hidden pane again */
  assert.match(read("web/js/modules/sw_story_ui.js"), /goalReached\(st\.goal, bench\.L\)/); assert.match(read("web/js/modules/sw_mission.js"), /Succès — objectifs atteints en/); assert.match(read("web/js/modules/sw.js"), /mission\.done\(r\)/);
  assert.match(read("web/js/modules/sw_drag.js"), /hiddenPane\(side\)/);
});
