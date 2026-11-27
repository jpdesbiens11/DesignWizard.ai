/* A requirement read by the machine, its dashed line on the Mission, its verdict (JP, 27 novembre 2026, par menu : « Requis lisibles + pointillés » ;
   « des missions tirées des requis »).   node --test tests/node/req_oracle.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proposeOracles, oraclesFor, keepOracles, oracleText, judge, verdicts, seriesOf, chartLines, oracleGuide } from "../../web/js/core/req_oracle.js";
import { makeReqs, mergeReqs, readAgile, toAgileCsv, forDiscipline, keyOf } from "../../web/js/core/reqs.js";
import { essList } from "../../web/js/demo/demo_ess_reqs.js";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { liveStart, liveStep, liveSet, liveDrive } from "../../web/js/sw/sw_live.js";
import { expandProfile } from "../../web/js/sw/sw_story.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const ESS = () => makeReqs(essList()), row = (R, id) => R.rows.find((r) => r.external_id === id);
const P = (id) => proposeOracles(row(ESS(), id));

test("the machine reads the usual phrasings : a band per cell block, the envelope, a condition held a while and the answer expected in time", () => {
  assert.deepEqual(P("ESS-REQ-002").list, [{ kind: "bound", signal: "vblock_min", min: 2.8 }, { kind: "bound", signal: "vblock_max", max: 4.2 }]);
  assert.deepEqual(P("ESS-REQ-003").list, [{ kind: "envelope", signal: "current", max: 360 }]); assert.deepEqual(P("ESS-REQ-004").list, [{ kind: "envelope", signal: "current", min: -72 }]);
  assert.deepEqual(P("ESS-REQ-013").list, [{ kind: "reaction", if: [{ signal: "vblock_max", op: ">", value: 4.25 }], mode: "", hold: 100, then: { signal: "contactor", is: 0 }, within: 150 }], "« entre 100 et 150 ms » : the answer by 150 ms");
  assert.equal(P("ESS-REQ-014").list[0].if[0].signal, "vblock_min"); assert.equal(P("ESS-REQ-014").list[0].within, 250);
  const t = P("ESS-REQ-015").list; assert.deepEqual(t.map((o) => [o.if[0].value, o.mode, o.hold]), [[75, "discharge", 500], [65, "charge", 500]], "« , ou 65 °C en charge, pendant plus de 500 ms » : the duration said at the end holds for the group");
  const d = P("ESS-REQ-016").list; assert.deepEqual(d.map((o) => [o.if[0].signal, o.hold, o.then.atLeast, o.within]), [["temp_max", 0, 1, 3000], ["current_abs", 2000, 1, 3000]], "two verbs : the 2 s belong to the current only");
  assert.deepEqual(P("ESS-REQ-024").list[0].if, [{ signal: "vblock_max", op: ">", value: 3.9 }, { signal: "vspread", op: ">", value: 0.02 }]);
  assert.deepEqual(P("ESS-REQ-047").list.map((o) => [o.if[0].op, o.if[0].value, o.then.is]), [[">", 45, 1], ["<", 38, 0]], "« … et l'arrêter sous 38 °C » : the answer undone");
  assert.equal(P("ESS-REQ-040").why, "offbench", "a demonstration is not judged on the bench"); assert.equal(P("ESS-REQ-017").why, "unread", "a silent chain : nothing the bench records, said");
  assert.equal(P("ESS-REQ-010").why, "tbd"); assert.equal(P("ESS-BES-01").why, "need");
  assert.equal(oracleText(P("ESS-REQ-013").list[0]), "V bloc max > 4,25 V · 100 ms ⇒ contactor ouvert ≤ 150 ms"); assert.equal(oracleText(P("ESS-REQ-004").list[0]), "Les missions vont jusqu'à 72 A en charge");
});

/* a record of the bench, one line a second : vmax and vmin in mV, temp in 0.1 °C, current in mA (+ discharge), the outputs */
const line = (t, o = {}) => ({ t: t * 1000, vmax: 4000, vmin: 3900, temp: 300, current: 50000, state: 0, bleed: 0, out: [1, 0], ...o });
const S = (lines) => seriesOf(lines, ["k_drv.level", "pump.level"], { contactor: "k_drv.level", pump: "pump.level" });

test("the verdict on a record : held, failed, not exercised — a time shorter than a line of the bench is not judged, and said", () => {
  const ov = P("ESS-REQ-013").list[0];
  assert.equal(judge(ov, S([line(0), line(1, { vmax: 4260 }), line(2, { vmax: 4100, out: [0, 0], state: 3 })])).verdict, "pass", "opened at the next line : within 150 ms + one line");
  assert.equal(judge(ov, S([line(0), line(1, { vmax: 4260 }), line(2, { vmax: 4260 }), line(3, { vmax: 4260 })])).verdict, "fail");
  assert.equal(judge(ov, S([line(0), line(1)])).verdict, "none");
  const hot = P("ESS-REQ-015").list[1];      // 65 °C in charge
  assert.equal(judge(hot, S([line(0, { temp: 700 }), line(1, { temp: 700 })])).verdict, "none", "70 °C in DISCHARGE : the charge clause does not apply");
  assert.equal(judge(hot, S([line(0, { temp: 700, current: -40000 }), line(1, { temp: 700, current: -40000 })])).verdict, "fail");
  const band = P("ESS-REQ-002").list[1];
  assert.equal(judge(band, S([line(0), line(1, { vmax: 4230 }), line(2, { vmax: 4230 })])).verdict, "fail", "two seconds above 4,20 V, contactor closed");
  assert.equal(judge(band, S([line(0), line(1, { vmax: 4230 }), line(2)])).verdict, "pass", "one line : under a second, not judged");
  assert.equal(judge(band, S([line(0), line(1, { vmax: 4230, out: [0, 0] }), line(2, { vmax: 4230, out: [0, 0] })])).verdict, "pass", "out of the band, but the contactor is open");
  assert.equal(judge(P("ESS-REQ-003").list[0], S([line(0), line(1, { current: 120000 })])).verdict, "uncovered"); assert.equal(judge(P("ESS-REQ-003").list[0], S([line(0, { current: 360000 })])).verdict, "covered");
  assert.equal(judge(P("ESS-REQ-047").list[0], S([line(0, { temp: 460 }), line(1, { temp: 460, out: [1, 1] })])).verdict, "pass", "the pump asked within a line");
});

test("a reading confirmed by a person is the project's, follows its line when DynamiteAgile gives the key, and is to read again when the statement changes", () => {
  const R = ESS(), r = row(R, "ESS-REQ-013");
  assert.equal(oraclesFor(R, r).sure, false, "proposed by the tool"); keepOracles(R, r, oraclesFor(R, r).list); assert.equal(oraclesFor(R, r).sure, true);
  const n = row(R, "ESS-REQ-040"); keepOracles(R, n, []); assert.equal(oraclesFor(R, n).why, "person", "« ne pas juger au banc »");
  const back = readAgile(toAgileCsv(R)).list; back.rows.forEach((x, i) => { x.key = `ESS-${i + 1}`; });
  row({ rows: back.rows }, "ESS-REQ-014").statement += " ";      // untouched : not a change (trimmed)
  const r15 = row({ rows: back.rows }, "ESS-REQ-015"); keepOracles(R, row(R, "ESS-REQ-015"), oraclesFor(R, row(R, "ESS-REQ-015")).list); r15.statement = r15.statement.replace("65 °C", "60 °C");
  const { R: N, plan } = mergeReqs(R, back);
  assert.equal(oraclesFor(N, row(N, "ESS-REQ-013")).sure, true, "under its new key"); assert.ok(N.oracles[row(N, "ESS-REQ-013").key]);
  assert.deepEqual(plan.reread, [row(N, "ESS-REQ-015").key], "the statement changed : the reading is proposed again"); assert.equal(oraclesFor(N, row(N, "ESS-REQ-015")).list[1].if[0].value, 60);
});

test("the chart of a mission draws the limits of the requirements on their panel, tagged by their key ; the guide asks to confirm and to write", () => {
  const R = ESS(), res = verdicts(R, S([line(0), line(1, { temp: 700, current: -40000 }), line(2, { temp: 700, current: -40000 })]));
  const T = chartLines(R, res, "t"); assert.deepEqual([...new Set(T.map((l) => l.key))].sort(), ["ESS-REQ-015", "ESS-REQ-016", "ESS-REQ-047"]);
  assert.ok(T.some((l) => l.key === "ESS-REQ-015" && l.value === 65 && l.when === "charge" && l.verdict === "fail"));
  const I = chartLines(R, res, "i"); assert.ok(I.some((l) => l.value === 95) && I.some((l) => l.value === -95), "|I| > 95 A : a line each way");
  assert.ok(chartLines(R, res, "v").some((l) => l.key === "ESS-REQ-002" && l.value === 4.2));
  const G = oracleGuide(R, forDiscipline(R, "sw").reqs); assert.equal(G[0].level, "warn"); assert.ok(G[0].keys.includes("ESS-REQ-013")); assert.ok(G[1].keys.includes("ESS-REQ-017"));
  const m = read("web/js/modules/sw_mission.js"); assert.match(m, /chartLines\(RQ, res, pk\)/); assert.match(m, /data-swmi-reqs/);
  const q = read("web/js/modules/reqs_page.js"); assert.match(q, /oracleSection\(L, r/); assert.match(q, /oracleLine\(L, r\)/);
});

test("played on the bench of the BMS : the charge profile shows what the requirements ask and the software does not do yet (ESS-REQ-015 in charge)", () => {
  const d = moduleDesign(), p = d.profiles.find((x) => x.id === "charge"), L = liveStart(d, 10), E = expandProfile(p.events); let at = 0;
  for (let k = 0; k * 10 <= E[E.length - 1].t; k++) { while (at < E.length && E[at].t <= k * 10) { const e = E[at++]; if (e.plant) liveDrive(L, e.plant); for (const [i, v] of Object.entries(e.set || {})) liveSet(L, i, v); } liveStep(L, 1); }
  const res = verdicts(ESS(), seriesOf(L.rec, L.recRefs, d.plant)), v = (k, n = 0) => res.find((x) => x.key === k && x.n === n).verdict;
  assert.equal(v("ESS-REQ-015", 1), "fail", "65 °C in charge : the software has one threshold, 75 °C"); assert.equal(v("ESS-REQ-016", 0), "pass"); assert.equal(v("ESS-REQ-047", 0), "pass");
  assert.equal(v("ESS-REQ-003"), "uncovered", "the profiles do not reach 360 A : the missions of the requirements will (phase 2)");
  assert.ok(res.every((x) => keyOf(x.req) === x.key));
});
