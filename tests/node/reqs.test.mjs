/* The requirements of the product for every discipline (demande de JP, 25 novembre 2026 : « une page Exigences 1. dans Mécanique et
   Électronique… concevoir avec l'IA à partir des requis de DynamiteAgile, au format de DynamiteAgile »).   node --test tests/node/reqs.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AGILE_COLUMNS, readAgile, makeReqs, forDiscipline, parentsOf, keyOf, toAgileCsv, reqsGuide, designPrompt, proposeAlloc } from "../../web/js/core/reqs.js";
import { NAV } from "../../web/js/core/app.js";

const csv = readFileSync(new URL("../../web/examples/exemple_exigences_rover.csv", import.meta.url), "utf8");

test("the export of DynamiteAgile is read as it is : every column, in its order, a « ; » inside a cell stays text", () => {
  const r = readAgile(csv); assert.ok(r.ok); assert.deepEqual(r.list.head, AGILE_COLUMNS, "the format of reference");
  assert.equal(r.list.rows.length, 33); const x = r.list.rows.find((z) => z.key === "DEMO2-47"); assert.equal(x.acceptance_criteria, "Fonctionne après 6 chutes ; aucune pièce détachée."); assert.equal(x.test_ref, "TST-MEC-05");
  assert.ok(r.list.rows.every((z) => /^\d{4}-/.test(z.updated_at)), "no row shifted"); assert.equal(readAgile("a,b\n1,2").ok, false);
});

test("each requirement goes to the disciplines that carry it : said by the list, otherwise proposed and to confirm ; a need is the why", () => {
  const R = makeReqs(readAgile(csv).list), M = forDiscipline(R, "mech"), E = forDiscipline(R, "elec");
  assert.ok(M.reqs.some((r) => r.key === "DEMO2-47"), "the drop test : mechanical"); assert.ok(E.reqs.some((r) => r.key === "DEMO2-43"), "the battery voltage : electronics");
  assert.ok(M.needs.length && M.needs.every((n) => n.kind === "Need")); assert.ok(Object.values(R.alloc).every((a) => !a.sure), "nothing said by the list : all proposed");
  assert.deepEqual(parentsOf(R, R.rows.find((r) => r.key === "DEMO2-47")).map(keyOf), ["DEMO2-21", "DEMO2-24"], "DEMO-21 read as DEMO2-21 : the export renumbered");
  assert.deepEqual(proposeAlloc({ allocation: "Software", statement: "chute" }), { mech: false, elec: false, sw: true, said: true }, "what the list says wins");
  assert.ok(reqsGuide(R, "mech").some((g) => g.level === "warn" && /confirmez/.test(g.text))); assert.equal(reqsGuide(null, "mech")[0].level, "todo");
});

test("back to DynamiteAgile : the same columns, the allocation filled ; the prompt designs from the requirements and cites their keys", () => {
  const R = makeReqs(readAgile(csv).list), back = readAgile(toAgileCsv(R)).list;
  assert.deepEqual(back.head, AGILE_COLUMNS); assert.equal(back.rows.length, 33); assert.match(back.rows.find((r) => r.key === "DEMO2-47").allocation, /Mechanical/);
  for (const k of AGILE_COLUMNS) if (k !== "allocation") assert.equal(back.rows[20][k], R.rows[20][k], k);
  const P = designPrompt(R, "elec", { name: "Rover" }); assert.match(P, /DEMO2-43/); assert.match(P, /```json```|bloc ```json```/); assert.match(P, /EXEMPLE/);
});

test("the page is the first tile of Mécanique and of Électronique", () => {
  assert.equal(NAV.find((g) => g.id === "mech").keys[0], "mreq"); assert.equal(NAV.find((g) => g.id === "elec").keys[0], "ereq");
  const m = readFileSync(new URL("../../web/js/modules/reqs_page.js", import.meta.url), "utf8"); assert.match(m, /key: "mreq"/); assert.match(m, /key: "ereq"/); assert.match(readFileSync(new URL("../../web/js/main.js", import.meta.url), "utf8"), /reqs_page\.js/);
});

test("the example travels with the site : its file is not ignored by git (a « data/ » folder is)", () => {
  const f = fileURLToPath(new URL("../../web/examples/exemple_exigences_rover.csv", import.meta.url));
  let ignored = true; try { execFileSync("git", ["check-ignore", "-q", f], { stdio: "ignore" }); } catch (e) { ignored = e.status === 0; }
  assert.equal(ignored, false, "git check-ignore : the example is published");
});

/* ---------- the ESS, a draft (JP, 27 novembre 2026 : « une section requis à chacune des branches… la même base des trois métiers… je vais loader en
   mode brouillon au début ; après, des itérations dans DynamiteAgile ; une fois terminés, on les exporte, on les ramène ») ---------- */
import { essList, ESS_FILE } from "../../web/js/demo/demo_ess_reqs.js";
import { stageOf, maturityOf, hasTbd, mergePlan, mergeReqs, isNeed, DISCIPLINES } from "../../web/js/core/reqs.js";
import { agileReqs } from "../../web/js/sw/sw_req_import.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const essCsv = readFileSync(new URL(`../../web/examples/${ESS_FILE}`, import.meta.url), "utf8");
/* the vocabulary Goldmine accepts (DynamiteAgile, modules/agile/goldmine.py) and the Test Base every Space starts with (modules/testing/data_tests.py) */
const AGILE = { category: ["Functional", "Performance", "Interface", "Environmental", "Safety", "Personnel Safety", "Standard / Regulatory"],
  lifecycle: ["Design", "Cost (DTC)", "Part Manufacturing (DFM)", "Assembly (DFA)", "Test & Verification (DFT)", "Transport & Storage", "Installation & Integration", "Operation (Use)", "Maintenance & Repair", "Appearance & Appeal", "Second Life", "End of Life (Disassembly, Recycling)"],
  stakeholder: ["Customer / Buyer", "End User", "Standards Body / Regulator", "Integrator / Distributor", "Production / Assemblers", "Maintenance & Repair", "Logistics", "Recycling / End of Life", "Marketing / Sales", "Project Management", "Health & Safety"],
  source: ["Customer", "Standard", "Internal", "Derived"] };
const TESTS = new Set(["TST-FUN-01", "TST-FUN-02", "TST-FUN-03", "TST-ELE-01", "TST-ELE-02", "TST-ELE-03", "TST-ELE-04", "TST-ELE-05", "TST-ELE-06", "TST-EMC-01", "TST-EMC-02", "TST-EMC-03", "TST-EMC-04", "TST-THR-01", "TST-ENV-01", "TST-ENV-02", "TST-ENV-03",
  "TST-IP-01", "TST-IP-02", "TST-MEC-01", "TST-MEC-02", "TST-MEC-03", "TST-LIF-01", "TST-LIF-02", "TST-MAT-01", "TST-MAT-02", "TST-SW-01", "TST-USA-01", "TST-PRD-01", "TST-VER-01", "TST-VER-02", "TST-VER-03", "TST-VER-04", "TST-CUS-01"]);

test("the ESS base : the file is written from its source, in the columns of DynamiteAgile, and Goldmine can import every line of it", () => {
  const L = essList(); assert.equal(essCsv, toAgileCsv({ head: L.head, rows: L.rows, alloc: {} }), "node tools/ess_reqs_csv.mjs writes the file");
  const r = readAgile(essCsv); assert.ok(r.ok); assert.deepEqual(r.list.head, AGILE_COLUMNS); assert.equal(r.list.rows.length, 62);
  const needs = r.list.rows.filter(isNeed), reqs = r.list.rows.filter((x) => !isNeed(x)); assert.equal(needs.length, 10); assert.equal(reqs.length, 52);
  assert.equal(new Set(r.list.rows.map((x) => x.external_id)).size, 62, "external ids are unique : Goldmine finds a line again by it");
  for (const x of r.list.rows) {
    assert.equal(x.key, "", `${x.external_id} : no key, DynamiteAgile gives one`); assert.match(x.statement, /\S/); assert.ok(x.external_id.length <= 40);
    for (const f of ["category", "source"]) assert.ok(AGILE[f].includes(x[f]), `${x.external_id} : ${f} « ${x[f]} »`);
    for (const f of ["lifecycle", "stakeholder"]) assert.ok(!x[f] || AGILE[f].includes(x[f]), `${x.external_id} : ${f} « ${x[f]} »`);
    assert.ok(["Received", "In Analysis"].includes(x.status), `${x.external_id} : a creation in Goldmine starts « Received » (or one transition further)`);
  }
  for (const x of reqs) {
    assert.ok(x.test_ref.split(/,\s*/).every((t) => TESTS.has(t)), `${x.external_id} names a test of the Test Base : ${x.test_ref}`);
    assert.match(x.verification_method, /^I?A?D?T?$/, `${x.external_id} : the letters in the order Goldmine writes them back (IADT)`); assert.ok(x.verification_method); assert.match(x.criticality, /^[A-D]$/); assert.ok(x.allocation.length <= 120); assert.ok(x.acceptance_criteria);
    assert.ok(parentsOf({ rows: r.list.rows }, x).length >= 1, `${x.external_id} derives from a need of the list`);
  }
  for (const x of reqs.filter((y) => y.source === "Standard")) assert.match(x.rationale, /NON LUE/, `${x.external_id} : a standard named is said not read`);
  assert.ok(needs.every((n) => n.need_status === "Assumption"), "every need an assumption, until the customer confirms it");
});

test("a draft, then the final version : the maturity is the status of the Requirement Workflow ; the ESS is a draft, the Rover is final", () => {
  assert.equal(maturityOf({ status: "Received" }), "draft"); assert.equal(maturityOf({ status: "Customer Clarification" }), "draft"); assert.equal(maturityOf({ status: "" }), "draft", "not yet in DynamiteAgile");
  assert.equal(maturityOf({ status: "Accepted" }), "firm"); assert.equal(maturityOf({ status: "verified" }), "firm"); assert.equal(maturityOf({ status: "Rejected" }), "out"); assert.equal(maturityOf({ status: "Obsolete" }), "out");
  const E = makeReqs(readAgile(essCsv).list, ESS_FILE, "2026-11-27T12:00:00Z"), S = stageOf(E);
  assert.equal(S.stage, "draft"); assert.equal(S.draft, 62); assert.ok(S.tbd >= 10, `${S.tbd} TBD : what the iterations must fix`); assert.ok(hasTbd({ statement: "≤ TBD kg" })); assert.ok(!hasTbd({ statement: "50 ms" }));
  assert.deepEqual(E.loads, [{ file: ESS_FILE, when: "2026-11-27T12:00:00Z", stage: "draft", rows: 62, draft: 62, tbd: S.tbd }], "the trail of the readings starts");
  assert.equal(stageOf(makeReqs(readAgile(csv).list)).stage, "final", "the Rover : every line accepted or after");
  const G = reqsGuide(E, "mech"); assert.ok(G.some((g) => g.level === "tip" && /Brouillon/.test(g.text))); assert.ok(G.some((g) => g.level === "todo" && /TBD/.test(g.text)));
  assert.ok(forDiscipline({ ...E, rows: E.rows.map((r) => (r.external_id === "ESS-REQ-001" ? { ...r, status: "Rejected" } : r)) }, "mech").reqs.every((r) => r.external_id !== "ESS-REQ-001"), "a rejected line counts for no discipline");
});

test("the same base for the three trades : each sees its own, a requirement can be in several ; the allocation is said by the list", () => {
  const E = makeReqs(readAgile(essCsv).list), by = Object.fromEntries(DISCIPLINES.map((d) => [d.id, forDiscipline(E, d.id).reqs.map(keyOf)]));
  assert.ok(by.mech.length >= 20 && by.elec.length >= 25 && by.sw.length >= 25, JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length]))));
  assert.ok(by.mech.includes("ESS-REQ-003") && by.elec.includes("ESS-REQ-003") && by.sw.includes("ESS-REQ-003"), "360 A : the three trades");
  assert.ok(by.mech.includes("ESS-REQ-040") && !by.sw.includes("ESS-REQ-040"), "the quarter-turn handle : mechanical only");
  assert.ok(by.sw.includes("ESS-REQ-013") && !by.mech.includes("ESS-REQ-013"), "the over-voltage : electronics and software");
  assert.ok(Object.values(E.alloc).every((a) => a.sure), "the draft says its allocation : nothing to confirm");
  assert.equal(DISCIPLINES.find((d) => d.id === "sw").screen, "lreq");
  const P = designPrompt(E, "sw", { name: "ESS" }); assert.match(P, /BROUILLON/); assert.match(P, /ESS-REQ-013/); assert.match(P, /dynamiteorbit\/sw-requirements@1/, "the software answers in the format of the Logiciel");
  assert.doesNotMatch(designPrompt(makeReqs(readAgile(csv).list), "mech", {}), /BROUILLON/, "a final list is designed, not tried");
  const V = agileReqs(toAgileCsv(E, forDiscipline(E, "sw"))); assert.equal(V.data.requirements.length, by.sw.length, "into the V : the software requirements of the product, under their keys");
  assert.ok(V.data.requirements.some((r) => r.id === "ESS-REQ-013" && r.kind === "safety"));
});

test("read again from DynamiteAgile : found by external id, keys given, changes said, the allocation kept where the file says none", () => {
  const E = makeReqs(readAgile(essCsv).list, ESS_FILE, "2026-11-27T12:00:00Z");
  E.alloc["ESS-REQ-047"] = { mech: false, elec: false, sw: true, sure: true };      // confirmed here : the pump is the software's
  /* what Goldmine gives back (as checked on a local DynamiteAgile, 27 novembre : 62 lines created, keys ESS-1 to ESS-62, no line refused) — then a review :
     every line accepted, one statement changed, one requirement made obsolete, one requirement added */
  const back = readAgile(toAgileCsv(E)).list; back.rows.forEach((r, i) => { r.key = `ESS-${i + 1}`; r.test_source = r.test_ref ? `${r.test_ref} …` : ""; r.updated_at = "2026-12-03T10:00:00+00:00"; r.last_change = "03122026-JPD"; r.status = isNeed(r) ? "Accepted" : "Accepted"; });
  const v1 = back.rows.find((r) => r.external_id === "ESS-REQ-007"); v1.statement = "La masse d'un module complet ne doit pas dépasser 6,5 kg."; v1.revision = "A";
  back.rows.find((r) => r.external_id === "ESS-REQ-047").allocation = ""; back.rows.find((r) => r.external_id === "ESS-REQ-080").status = "Obsolete";
  back.rows.splice(back.rows.findIndex((r) => r.external_id === "ESS-REQ-071"), 1);
  back.rows.push({ ...back.rows.find((r) => r.external_id === "ESS-REQ-041"), key: "ESS-63", external_id: "ESS-REQ-042B", statement: "La poignée doit se manœuvrer avec des gants." });
  const P = mergePlan(E, back);
  assert.equal(P.added.length, 1); assert.equal(P.removed.length, 1); assert.equal(P.removed[0].external_id, "ESS-REQ-071"); assert.equal(P.keyed.length, 61, "every line of the draft found by its external id, its key given");
  const mass = P.changed.find((c) => c.row.external_id === "ESS-REQ-007"); assert.deepEqual(mass.fields.map((f) => f.h).sort(), ["revision", "statement", "status"]); assert.equal(mass.was, "ESS-REQ-007"); assert.equal(mass.key, "ESS-17");
  assert.ok(P.changed.every((c) => !c.fields.some((f) => ["updated_at", "last_change", "test_source", "key"].includes(f.h))), "the clock, the stamp and what Goldmine derives are not changes");
  const { R: N } = mergeReqs(E, back, "ESS_exigences.csv", "2026-12-03T10:00:00Z");
  const pump = back.rows.find((r) => r.external_id === "ESS-REQ-047").key; assert.deepEqual(N.alloc[pump], { mech: false, elec: false, sw: true, sure: true }, "ESS-REQ-047 : the allocation confirmed here is kept, under its new key");
  assert.equal(N.alloc["ESS-11"].mech, true, "said by the file");
  assert.equal(N.loads.length, 2); assert.equal(N.loads[1].stage, "final"); assert.equal(stageOf(N).stage, "final"); assert.equal(stageOf(N).out, 1);
  assert.ok(!forDiscipline(N, "mech").reqs.some((r) => r.external_id === "ESS-REQ-080"), "obsolete : out of every discipline");
  const same = mergePlan(N, readAgile(toAgileCsv(N)).list); assert.equal(same.changed.filter((c) => c.fields.some((f) => f.h !== "allocation")).length, 0); assert.equal(same.added.length + same.removed.length + same.keyed.length, 0);
});

test("the page is the first tile of each branch, and the BM project opens with the ESS draft, kept by its history", () => {
  assert.equal(NAV.find((g) => g.id === "soft").keys[0], "lreq"); assert.equal(NAV.find((g) => g.id === "soft").keys[1], "swreq", "then the requirements of the software, the V");
  const m = readFileSync(new URL("../../web/js/modules/reqs_page.js", import.meta.url), "utf8"); assert.match(m, /key: "lreq"/); assert.match(m, /essList\(\)/);
  const p = bmProject(); assert.equal(p.reqs.file, ESS_FILE); assert.equal(stageOf(p.reqs).stage, "draft"); assert.equal(p.reqs.rows.length, 62);
  assert.equal(bmProject({ branch: "c4" }).reqs.rows.length, 62, "restored from a point of the history : the list is part of the definition");
});
