/* Revisions from the part to the assembly : an assembly remembers the revision of each part it was reviewed with. */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewItems, approve, whereUsed, revisionRows, staleParts, partsOf } from "../../web/js/core/review.js";

const P = (value) => ({ value, min: 1, max: 500, step: 1, unit: "mm", label: "x" });
const part = (id, L) => ({ dw: "part/1", id, name: id, family: "plate", process: "cnc_milling", material: "AL6061-T6", params: { L: P(L) }, interfaces: [], features: [{ op: "box", id: "b", size: ["L", 40, 5] }] });
const project = () => ({ dw: "project/1", id: "P", name: "Module", parts: [part("BASE", 100), part("CAPOT", 100)], boards: [], physics: [], simulations: [],
  assemblies: [{ dw: "assembly/1", id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }, { id: "i3", part: "CAPOT" }], mates: [] }] });
const of = (p, id) => reviewItems(p).find((x) => x.id === id), D = (d) => ({ date: new Date(`2026-0${d}-01T10:00:00Z`) });

test("an assembly is reviewed WITH given revisions of its parts ; when a part moves on, the assembly asks to be reviewed again and takes its own next revision", () => {
  const p = project(); for (const it of reviewItems(p)) approve(p, it.key, D(1));
  assert.deepEqual(reviewItems(p).map((x) => [x.id, x.rev, x.state]), [["BASE", "A", "ok"], ["CAPOT", "A", "ok"], ["ASM", "A", "ok"]]);
  assert.deepEqual(Object.fromEntries(Object.entries(p.review.items["assembly:ASM"].parts).map(([k, v]) => [k, v.rev])), { BASE: "A", CAPOT: "A" });
  assert.deepEqual(whereUsed(p, "CAPOT"), [{ id: "ASM", name: "Ensemble", qty: 2, rev: "A", reviewedWith: "A", upToDate: true }]);
  /* the part changes : it says so, and so does the assembly — although nothing was touched in the assembly itself */
  p.parts[0].params.L.value = 120;
  assert.equal(of(p, "BASE").state, "changed"); assert.equal(of(p, "ASM").state, "changed"); assert.match(of(p, "ASM").facts, /à revalider : BASE modifiée \(rév\. A pas encore revue\)/); assert.equal(of(p, "CAPOT").state, "ok");
  assert.deepEqual(staleParts(p, p.assemblies[0], p.review.items["assembly:ASM"]), [{ part: "BASE", from: "A", to: "A" }]);
  /* the part is reviewed again : revision B ; the assembly was reviewed with A */
  assert.deepEqual(approve(p, "part:BASE", D(2)), { rev: "B", bumped: true }); assert.equal(of(p, "BASE").state, "ok");
  assert.equal(of(p, "ASM").state, "changed"); assert.match(of(p, "ASM").facts, /BASE rév\. A → B/);
  assert.deepEqual(whereUsed(p, "BASE")[0], { id: "ASM", name: "Ensemble", qty: 1, rev: "A", reviewedWith: "A", upToDate: false });
  assert.match(revisionRows(p).find((r) => r[0] === "BASE")[4], /ASM rév\. A — revu avec la rév\. A : à revalider/); assert.match(revisionRows(p).find((r) => r[0] === "CAPOT")[4], /ASM rév\. A \(× 2\) — revu avec la rév\. A$/);
  /* the assembly is reviewed again : its revision B, with the reason in its history */
  assert.deepEqual(approve(p, "assembly:ASM", D(3)), { rev: "B", bumped: true }); assert.equal(of(p, "ASM").state, "ok"); assert.equal(p.assemblies[0].revision, "B");
  assert.match(p.review.items["assembly:ASM"].history.at(-1).note, /Révision B validée \(suite de la A\) — BASE rév\. A → B/); assert.equal(whereUsed(p, "BASE")[0].upToDate, true); assert.equal(whereUsed(p, "BASE")[0].reviewedWith, "B");
  /* a part added to the assembly, a part taken away : its own content changed, and the list of what it was reviewed with follows */
  p.parts.push(part("PATTE", 30)); p.assemblies[0].instances.push({ id: "i4", part: "PATTE" }); p.assemblies[0].instances = p.assemblies[0].instances.filter((i) => i.part !== "CAPOT");
  assert.equal(of(p, "ASM").state, "changed"); assert.deepEqual(approve(p, "assembly:ASM", D(4)), { rev: "C", bumped: true }); assert.deepEqual(Object.keys(partsOf(p, p.assemblies[0])), ["BASE", "PATTE"]); assert.deepEqual(whereUsed(p, "CAPOT"), []);
  assert.equal(revisionRows(p).find((r) => r[0] === "CAPOT")[4], "aucun assemblage");
});

test("an assembly never reviewed, or reviewed before this was kept, is not said stale", () => {
  const p = project(); assert.equal(of(p, "ASM").state, "todo"); assert.deepEqual(of(p, "ASM").stale, []); assert.equal(whereUsed(p, "BASE")[0].reviewedWith, null);
  p.review = { items: { "assembly:ASM": { state: "ok", sig: of(p, "ASM").sig, rev: "A", history: [] } } };       // an older ledger, without the parts
  p.parts[0].params.L.value = 130; assert.equal(of(p, "ASM").state, "ok", "no record of the parts : nothing to compare");
});
