/* The requirements of the product for every discipline (demande de JP, 25 novembre 2026 : « une page Exigences 1. dans Mécanique et
   Électronique… concevoir avec l'IA à partir des requis de DynamiteAgile, au format de DynamiteAgile »).   node --test tests/node/reqs.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGILE_COLUMNS, readAgile, makeReqs, forDiscipline, parentsOf, keyOf, toAgileCsv, reqsGuide, designPrompt, proposeAlloc } from "../../web/js/core/reqs.js";
import { NAV } from "../../web/js/core/app.js";

const csv = readFileSync(new URL("../../web/data/exemple_exigences_rover.csv", import.meta.url), "utf8");

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
