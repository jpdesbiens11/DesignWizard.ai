/* Deleting a restore point, one at a time (JP, 22 novembre 2026 : « je veux dorénavant être capable d'effacer ces points de sauvegarde
   individuellement et ensuite les autres se réattachent, ou si un seul concept sur la branche, elle meurt et on revient par défaut au
   MAIN ») : its children hang from its parent, the branches keep their names, what no other point cites goes away ; a branch left without a
   point dies, and when « vous êtes ici » was on it, the product goes back to the last point of MAIN.
     node --test tests/node/history_delete.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addPoint, restoreInto, pointOf, branchNames, historyOf, rebuild, deletePlan, deletePoint, MAIN } from "../../web/js/core/history.js";
import { startBranch } from "../../web/js/core/history_branches.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
let clock = 0; const at = () => new Date(Date.UTC(2026, 10, 22, 2, clock++)).toISOString();
const project = () => ({ dw: "project/1", id: "essai-del", name: "Essai", log: [], parts: [{ dw: "part/1", id: "DW-0001", name: "Boîtier", params: { L: { value: 100 } } }], assemblies: [], boards: [] });
const L = (p) => p.parts[0].params.L.value;

/** MAIN : P1 (L 100) → P2 (110) → P3 (120) ; branch « Essai court » from P1 : P4 (90) → P5 (80) ; branch « Seul » from P2 : P6 (115). */
function story() {
  const p = project(); addPoint(p, { label: "Départ", when: at() });
  p.parts[0].params.L.value = 110; addPoint(p, { label: "110", when: at() });
  p.parts[0].params.L.value = 120; addPoint(p, { label: "120", when: at() });
  restoreInto(p, "P1"); historyOf(p).on = "Essai court"; p.parts[0].params.L.value = 90; addPoint(p, { label: "90", when: at() });
  p.parts[0].params.L.value = 80; addPoint(p, { label: "80", when: at() });
  restoreInto(p, "P2"); historyOf(p).on = "Seul"; p.parts[0].params.L.value = 115; addPoint(p, { label: "115", when: at() });
  return p;
}

test("a point in the middle of MAIN : its child hangs from its parent, every other point keeps its branch and its product", () => {
  const p = story(), h = historyOf(p), before = branchNames(h), plan = deletePlan(h, "P2");
  assert.deepEqual([plan.parent, plan.children.sort(), plan.branch, plan.dies, plan.here], ["P1", ["P3", "P6"], MAIN, false, false]);
  assert.ok(plan.freed.length >= 1, "the part as it was at P2 is cited by no other point : it goes away");
  deletePoint(p, "P2");
  assert.equal(pointOf(h, "P2"), null); assert.equal(pointOf(h, "P3").parent, "P1"); assert.equal(pointOf(h, "P6").parent, "P1", "the branch that left from P2 now leaves from P1");
  const after = branchNames(h); for (const id of ["P1", "P3", "P4", "P5", "P6"]) assert.equal(after.get(id), before.get(id), `${id} keeps its branch`);
  assert.equal(rebuild(h, "P3").parts[0].params.L.value, 120); assert.equal(rebuild(h, "P6").parts[0].params.L.value, 115, "the points left are whole");
  assert.equal(h.head, "P6", "« vous êtes ici » did not move"); assert.equal(L(p), 115, "the product did not change");
  const cited = new Set(h.points.flatMap((x) => x.tree.map(([, f]) => f))); assert.ok(Object.keys(h.objects).every((f) => cited.has(f)), "nothing is kept that no point cites");
});

test("the only point of a branch, where one is : the branch dies, and the product goes back to the last point of MAIN", () => {
  const p = story(), h = historyOf(p), plan = deletePlan(h, "P6");
  assert.equal(plan.branch, "Seul"); assert.equal(plan.dies, true); assert.equal(plan.here, true); assert.deepEqual([plan.back.id, plan.back.restore], ["P3", true]);
  deletePoint(p, "P6");
  assert.ok(![...branchNames(h).values()].includes("Seul"), "the branch « Seul » is gone"); assert.equal(h.head, "P3"); assert.equal(L(p), 120, "back to MAIN");
});

test("a point of a branch that has others : the branch lives on ; « vous êtes ici » goes one point up, the product stays", () => {
  const p = story(); restoreInto(p, "P5"); const h = historyOf(p);
  const plan = deletePlan(h, "P5"); assert.equal(plan.dies, false); assert.deepEqual([plan.back.id, plan.back.restore], ["P4", false]);
  deletePoint(p, "P5"); assert.equal(h.head, "P4"); assert.equal(L(p), 80, "the product is not touched : it is the one of P5 until a point keeps it");
  assert.equal(branchNames(h).get("P4"), "Essai court");
  const q = story(), hq = historyOf(q); deletePoint(q, "P4"); assert.equal(pointOf(hq, "P5").parent, "P1"); assert.equal(branchNames(hq).get("P5"), "Essai court", "the first point of a branch deleted : the branch keeps its name");
});

test("a branch opened with « Nouvelle branche ici » and deleted at once : back to MAIN ; a point that is not there says why", () => {
  const p = story(); restoreInto(p, "P3"); historyOf(p).head = "P3";
  const id = startBranch(p, "concept 2 - consumer product interface", {}).id, h = historyOf(p);
  assert.equal(branchNames(h).get(id), "concept 2 - consumer product interface");
  const plan = deletePoint(p, id); assert.equal(plan.dies, true); assert.equal(h.head, "P3");
  assert.equal(deletePlan(h, "P99").ok, false); assert.equal(deletePoint(p, "P99"), null);
});

test("on the screen : « Effacer ce point » on every point, what it does said first, the deletion kept in the history", () => {
  const s = read("web/js/modules/history.js");
  assert.match(s, /btn\("Effacer ce point"/); assert.match(s, /deletePlan\(h, id\)/); assert.match(s, /confirmBox\(`Effacer le point/); assert.match(s, /ne revient pas/);
  assert.match(read("docs/HISTORIQUE.md"), /Effacer ce point/);
});
