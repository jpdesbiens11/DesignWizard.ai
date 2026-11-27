/* The AI loop of the software (JP, 27 novembre 2026 : « export de toutes les données HIL + prompt → IA → nouvelle version du logiciel importée,
   qui rejoue tous les duty cycles » ; choix par menu : « Boucle IA »).   node --test tests/node/sw_loop.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loopFiles, loopPrompt, readCandidate, compareCampaigns, compareMd, visibleCampaign } from "../../web/js/sw/sw_loop.js";
import { campaignMissions } from "../../web/js/sw/sw_req_missions.js";
import { runCampaign } from "../../web/js/sw/sw_campaign.js";
import { isMarked } from "../../web/js/core/brand.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const answer = (d, fn) => { const x = JSON.parse(JSON.stringify(d)); fn(x); return `Ce que je change.\n\`\`\`json\n${JSON.stringify(x)}\n\`\`\`\n`; };
const set = (x, id, p) => Object.assign(x.objects.find((o) => o.id === id).params, p);

test("an answer read back : the hardware interfaces, the bench, the missions and the board are put back ; a changed value is an example again ; a software that does not run is said", () => {
  const d = bmProject().software[0];
  const c = readCandidate(answer(d, (x) => { set(x, "ov", { trip: 4200 }); x.objects.find((o) => o.id === "ov").sure = ["trip", "clear"]; x.objects.find((o) => o.id === "k_drv").hw = { board: "X", net: "DOUT1", pin: "U11.PB4" }; x.plant = null; x.profiles = []; }), d);
  assert.ok(c.ok, c.errors.join(" ")); assert.deepEqual(c.doc.plant, d.plant); assert.deepEqual(c.doc.profiles, d.profiles); assert.deepEqual(c.doc.objects.find((o) => o.id === "k_drv").hw, d.objects.find((o) => o.id === "k_drv").hw);
  assert.ok(c.kept.some((t) => /k_drv/.test(t)) && c.kept.some((t) => /plant/.test(t)), "what was put back is said");
  assert.ok(!c.doc.objects.find((o) => o.id === "ov").sure.includes("trip"), "a value the answer changed is an example : not confirmed by it");
  assert.ok(c.lines.some((t) => /Over-voltage : trip 4250 → 4200/.test(t)));
  assert.ok(!readCandidate("pas de json", d).ok); assert.match(readCandidate(answer(d, (x) => { x.objects.push({ id: "zz", kind: "warp_drive", name: "?" }); }), d).errors[0], /Genres inconnus/);
  assert.match(readCandidate(answer(d, () => {}), d).errors[0], /Aucun changement/);
  assert.ok(readCandidate(answer(d, (x) => { x.wires = x.wires.filter((w) => w.to !== "k.request"); }), d).errors.some((t) => /Ne tourne pas/.test(t)), "an input left unwired : it does not run");
});

test("the gate : a cell that held and no longer holds is a regression — one, and the version is refused ; a fail that holds now is corrected", () => {
  const C = (by) => ({ profiles: [{ id: "a", name: "A" }, { id: "b", name: "B" }], rows: by.map(([key, a, b, overall]) => ({ key, n: 0, text: key, by: { a, b }, overall })) });
  const before = C([["R1", "fail", "pass", "fail"], ["R2", "pass", "pass", "pass"], ["R3", "none", "none", "none"], ["R4", "uncovered", "uncovered", "uncovered"]]);
  const good = compareCampaigns(before, C([["R1", "pass", "pass", "pass"], ["R2", "pass", "pass", "pass"], ["R3", "none", "pass", "pass"], ["R4", "covered", "uncovered", "uncovered"]]));
  assert.equal(good.accept, true); assert.deepEqual(good.rows.map((r) => r.change), ["fixed", "same", "moved", "same"]); assert.equal(good.fixed, 1);
  const bad = compareCampaigns(before, C([["R1", "pass", "fail", "fail"], ["R2", "pass", "pass", "pass"], ["R3", "fail", "none", "fail"], ["R4", "uncovered", "uncovered", "uncovered"]]));
  assert.equal(bad.accept, false); assert.deepEqual(bad.rows.map((r) => r.change), ["regressed", "same", "regressed", "same"], "R1 : still failing overall, but mission B regressed ; R3 : a new fail");
  assert.ok(isMarked(compareMd(bad)) && /REFUSÉE/.test(compareMd(bad)));
});

test("one turn of the loop on the BM : the package (the holdout set never leaves) ; three versions at the gate — 4,20 V trips at the end of a nominal charge, refused ; 4,21 V fails on the holdout set ; 4,201 V corrects ESS-REQ-002, accepted", () => {
  const p = bmProject(), d = p.software[0], M = campaignMissions(p, d), base = runCampaign(p, d, { profiles: M, when: "a" });
  const F = loopFiles(p, d, base), names = F.map((f) => f.name); assert.deepEqual(names, ["PROMPT.md", "constat.md", "constat.csv", "requirements.md", "software.json"]);
  for (const f of F.filter((x) => x.name !== "software.json")) assert.ok(isMarked(f.bytes), f.name);
  assert.ok(!/Réserve/.test(F[1].bytes + F[2].bytes), "the holdout set is not in the findings the assistant sees");
  const P = loopPrompt(p, d, base); assert.match(P, /ESS-REQ-015/); assert.match(P, /CE QUI NE CHANGE PAS/); assert.match(P, /k_drv \(.*\) → DOUT0/); assert.match(P, /LOT DE RÉSERVE de 4 missions/);
  const version = (trip) => { const c = readCandidate(answer(d, (x) => set(x, "ov", { trip, clear: 4120 })), d); assert.ok(c.ok, c.errors.join(" ")); return c.doc; };
  /* 4,20 V : the nominal missions are enough to refuse it */
  const nominal = M.filter((m) => m.origin === "nominal"), r200 = compareCampaigns(base, runCampaign(p, version(4200), { profiles: nominal, when: "b" }));
  assert.equal(r200.accept, false); assert.deepEqual(r200.rows.filter((r) => r.change === "regressed").map((r) => r.key), ["NOMINAL"], "a contactor that opens at the end of a normal charge");
  /* 4,21 V : it holds every mission the assistant sees of ESS-REQ-002, not the holdout set */
  const some = M.filter((m) => m.id === "rq-vblock_max-hi-4_2-charge" || m.origin === "reserve"), V = visibleCampaign(runCampaign(p, version(4210), { profiles: some, when: "c" }));
  const r002 = V.rows.find((r) => r.key === "ESS-REQ-002" && r.n === 1); assert.equal(r002.overall, "pass"); assert.equal(r002.heldOut, true, "it fails only where the assistant does not look");
  /* 4,201 V : over 4,20 V the contactor opens, at 4,20 V (the end of a charge) it stays closed */
  const cmp = compareCampaigns(base, runCampaign(p, version(4201), { profiles: M, when: "d" }));
  assert.equal(cmp.accept, true); assert.deepEqual(cmp.rows.filter((r) => r.change === "fixed").map((r) => `${r.key}#${r.n}`), ["ESS-REQ-002#1"]); assert.equal(cmp.regressed, 0);
  /* a mission the first campaign did not play is no regression */
  assert.equal(compareCampaigns({ profiles: [{ id: "a" }], rows: [] }, { profiles: [{ id: "a" }, { id: "b" }], rows: [{ key: "R", n: 0, text: "R", by: { a: "pass", b: "fail" }, overall: "fail" }] }).accept, true);
  const ui = read("web/js/modules/sw_loop_ui.js"); assert.match(ui, /journalChange\(before, p/); assert.match(ui, /accept\.disabled = !cmp\.accept/, "accepted only without regression");
  assert.match(ui, /profiles: missionsOf\(d\)/, "the gate replays the missions of the version in hand"); assert.match(ui, /missionSig/, "a campaign played on other missions is played again first");
  assert.match(read("web/js/modules/sw_findings.js"), /loopSection\(d, C\)/);
});
