/* The lean path of the Logiciel (JP, 27 novembre 2026 : « lean tout ce qui n'est pas des requis, interfaces HW, fonctions… des tests logiciels
   embarqués HIL virtuels » ; choix par menu : « Alléger le parcours d'abord »).   node --test tests/node/sw_lean.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEAN, LEAN_KEYS, EXPERT_KEYS, navKeys, interfacesOf, leanStates, V_TO_LEAN } from "../../web/js/sw/sw_lean.js";
import { runCampaign, campaignRun, findingsCsv, findingsMd, playMission } from "../../web/js/sw/sw_campaign.js";
import { isMarked } from "../../web/js/core/brand.js";
import { stairOf, downOf, aiTargetOf } from "../../web/js/core/stairs.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { campaignMissions } from "../../web/js/sw/sw_req_missions.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("six steps for everyone — Exigences · Interfaces · Missions · Banc HIL · Constats · Export — the V and the detailed design at the Expert level", () => {
  assert.deepEqual(LEAN.map((s) => s.title), ["Exigences", "Interfaces", "Missions", "Banc HIL", "Constats", "Export"]);
  assert.deepEqual(navKeys("novice"), ["lreq", "swio", "swmis", "swsim", "swfind", "swrel"]); assert.deepEqual(navKeys("intermediate"), navKeys("novice"));
  assert.deepEqual(navKeys("expert"), [...LEAN_KEYS, ...EXPERT_KEYS]); for (const s of LEAN) assert.ok(s.says && s.icon && s.color && s.en, s.key);
  for (const k of Object.values(V_TO_LEAN)) assert.ok(LEAN.some((s) => s.key === k), k);
  for (const [f, key] of [["sw_io.js", "swio"], ["sw_missions.js", "swmis"], ["sw_findings.js", "swfind"]]) { assert.match(read(`web/js/modules/${f}`), new RegExp(`key: "${key}"`)); assert.match(read("web/js/main.js"), new RegExp(`modules/${f}`)); }
  const p = { software: [{ id: "S" }], boards: [] };
  assert.equal(stairOf("swio", [], p).hash, "#/lreq"); assert.equal(stairOf("swfind", [], p).hash, "#/swmis"); assert.deepEqual(downOf("swmis", [], p).map((x) => x.hash), ["#/swsim", "#/swfind"]);
  assert.equal(aiTargetOf("swfind", [], p).key, "sw:design");
});

test("the interfaces of the BM software, read from its board : each pin under the function of the board that carries it, its range in physics ; what the CORE boards say, last", () => {
  const p = bmProject(), d = p.software[0], I = interfacesOf(p, d); assert.equal(I.board.id, "BMS-CENTRAL-3X3");
  const all = I.groups.flatMap((g) => g.items), it = (id) => all.find((x) => x.id === id);
  assert.equal(it("adc_i").text, "−500 à 500 A"); assert.equal(it("adc_i").net, "AIN1"); assert.equal(it("k_drv").text, "0 / 1 (sortie logique)");
  assert.equal(I.groups.at(-1).fn, "frames"); assert.ok(I.groups.at(-1).items.every((x) => x.from === "frame" && x.source), "said where it comes from");
  assert.ok(!I.problems.some((x) => x.level === "error" || x.level === "check"), "nothing to correct on the BM");
});

test("the campaign : the missions written from the requirements, played on the virtual bench, each requirement judged on each — every limit read is judged ; the findings marked, as CSV and Markdown", () => {
  const p = bmProject(), d = p.software[0], C = runCampaign(p, d, { when: "2026-11-27T12:00:00.000Z" });
  const ids = C.profiles.map((x) => x.id); assert.ok(ids.includes("nom-charge") && ids.includes("rq-vblock_max-hi-4_25-charge") && ids.includes("reserve-4"), ids.join(" "));
  assert.ok(!ids.includes("charge") && !ids.includes("discharge"), "the bench's profiles written from the software's thresholds are not the yardstick");
  assert.deepEqual([...new Set(C.profiles.map((x) => x.origin))], ["nominal", "limit", "envelope", "corner", "fault", "reserve"]);
  const row = (k, n = 0) => C.rows.find((r) => r.key === k && r.n === n);
  assert.equal(row("ESS-REQ-015", 1).by["rq-temp_max-hi-65-charge"], "fail", "65 °C in charge : the software has one threshold, 75 °C"); assert.equal(row("ESS-REQ-015", 1).overall, "fail");
  assert.equal(row("ESS-REQ-002", 1).overall, "fail", "4,20 V held in service : the software lets it climb to 4,25 V"); assert.equal(row("ESS-REQ-016").overall, "pass");
  for (const k of ["ESS-REQ-013", "ESS-REQ-014", "ESS-REQ-015"]) assert.equal(row(k).overall, "pass", `${k} : the cell emulator and the heat cross the limit, the contactor opens`);
  assert.equal(row("ESS-REQ-003").overall, "covered", "360 A : the envelope mission reaches it"); assert.equal(row("ESS-REQ-004").overall, "covered");
  assert.equal(C.counts.none, 0, "every limit read by the machine is played"); assert.ok(C.unread.length > 0 && C.unread.every((u) => u.why));
  assert.equal(row("NOMINAL").overall, "pass", "the nominal rule : nothing trips inside the limits"); assert.ok(row("NOMINAL").rule);
  assert.equal(C.counts.fail, C.rows.filter((r) => r.overall === "fail").length); assert.ok(C.sig);
  const csv = findingsCsv(C), md = findingsMd(C); assert.ok(isMarked(csv) && isMarked(md), "the mark of the platform");
  assert.match(csv, /^key,external_id,limit,read by,Nominal — charge à 1 C jusqu'à la fin,/m); assert.match(md, /banc VIRTUEL/); assert.match(md, /## Ce qui échoue/);
  /* in slices : the same as at once — on two short missions */
  const two = campaignMissions(p, d).filter((m) => ["env-ESS-REQ-003-0", "rq-vblock_max-hi-4_25-charge"].includes(m.id)), once = runCampaign(p, d, { profiles: two, when: C.when });
  const g = campaignRun(p, d, { profiles: two, slice: 5000, when: C.when }); let r = g.next(), n = 0; while (!r.done) { n++; assert.ok(r.value.done <= r.value.total); r = g.next(); }
  assert.ok(n > 2, "a screen can show its progress"); assert.deepEqual(r.value.rows.map((x) => x.overall), once.rows.map((x) => x.overall));
  const S = leanStates(p, d, C); assert.equal(S.findings.state, "todo"); assert.equal(S.export.state, "wait", "the package waits while a requirement fails"); assert.equal(leanStates(p, d, null).findings.state, "todo");
  assert.equal(S.missions.state, "done", "every limit has its mission"); assert.match(S.missions.text, /exigences/);
  assert.ok(playMission(d, d.profiles[0]).rec.length > 3000, "one line a second, the whole mission");
});
