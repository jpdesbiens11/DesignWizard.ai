/* The points a demonstration gained since a copy of it was saved, offered to the copy without moving anything of it ; the rows of the tree,
   newest first, titles whole, the name of a branch once per run (JP, 28 novembre 2026 : « où est le concept 5 ? … met à jour l'historique
   pour plus de clarté et me permette de naviguer aisément plus on avance » ; by menu : « Proposer, aperçu d'abord », « Plus récent en haut,
   bascule », « Titres complets, branche une fois »).
     node --test tests/node/history_demo.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { addPoint, restoreInto, historyOf, pointOf, branchNames, deletePoint, rebuild, withoutHistory, cut, diffTrees, sinceThen, changeCount, MAIN } from "../../web/js/core/history.js";
import { demoKey, demoPlan, addDemoPoints, demoLine } from "../../web/js/core/history_demo.js";
import { treeRows, wrapText, ROW_GEOM } from "../../web/js/core/history_view.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { seedOf, DEMO_SEEDS } from "../../web/js/demo/demo_seeds.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const by = "DynamiteOrbit.ai";
/** A demonstration : MAIN P1 → P2 ; branch « Idée » from P1 : P3 → P4 ; branch « Suite » from P4 : P5. Every point dated by hand and signed. */
function demo() {
  const p = { dw: "project/1", id: "demo-x", name: "Démo X", log: [], parts: [{ dw: "part/1", id: "A", name: "Boîtier", params: { L: { value: 100 } } }], assemblies: [], boards: [] };
  addPoint(p, { label: "Départ", when: "2026-11-20T10:00:00.000Z", by });
  p.parts[0].params.L.value = 120; addPoint(p, { label: "Plus long", when: "2026-11-20T11:00:00.000Z", by });
  restoreInto(p, "P1"); historyOf(p).on = "Idée"; p.parts.push({ dw: "part/1", id: "B", name: "Couvercle" }); addPoint(p, { label: "Avec couvercle", when: "2026-11-21T10:00:00.000Z", by });
  p.parts[1].name = "Couvercle embouti"; addPoint(p, { label: "Embouti", when: "2026-11-22T10:00:00.000Z", by });
  return p;
}
const grow = (p) => { historyOf(p).on = "Suite"; p.parts[1].name = "Couvercle usiné"; restoreInto(p, "P4"); p.parts[1].name = "Couvercle usiné"; addPoint(p, { kind: "manual", branch: "Suite", label: "Usiné, une seule pièce", when: "2026-11-28T02:00:00.000Z", by }); return p; };

test("a copy that stops before the demonstration's newest points : they are found, each hangs from the copy's own point, and nothing of the copy moves", () => {
  const copy = clone(demo()); copy.id = "demo-x-mia1"; restoreInto(copy, "P2");
  copy.parts[0].name = "Boîtier renommé à la main";      // what the person changed since, kept by no point
  const seed = grow(demo()), plan = demoPlan(copy.history, seed.history);
  assert.equal(plan.none, false); assert.equal(plan.present, 4); assert.equal(plan.last, "P4");
  assert.deepEqual(plan.fresh.map((f) => [f.seed, f.id, f.parent, f.branch, f.onto]), [["P5", "P5", "P4", "Suite", "same"]]);
  assert.deepEqual(plan.anchors.map((a) => [a.mine, a.drift]), [["P4", false]]);
  assert.equal(demoLine(plan), "1 point nouveau — Suite, P5");
  const before = JSON.stringify(withoutHistory(copy)), head = copy.history.head, n = copy.history.points.length;
  const pts = addDemoPoints(copy, seed.history, plan, { when: "2026-11-28T12:00:00.000Z" });
  assert.equal(pts.length, 1); assert.equal(copy.history.points.length, n + 1); assert.equal(copy.history.head, head, "« vous êtes ici » does not move");
  assert.equal(JSON.stringify(withoutHistory(copy)), before, "the product does not move : what the person changed is still there");
  assert.equal(pts[0].demo, "2026-11-28T12:00:00.000Z"); assert.equal(branchNames(copy.history).get("P5"), "Suite");
  assert.deepEqual(rebuild(copy.history, "P5"), rebuild(seed.history, "P5"), "the point keeps the demonstration's product, its texts stored in the copy");
  assert.ok(demoPlan(copy.history, seed.history).nothing, "added once : nothing more to offer");
});

test("a point of a demonstration is known by its date and its author, not its content : a copy made by an older tool still finds it, and the preview says it drifted", () => {
  const copy = clone(demo()); restoreInto(copy, "P4");
  const seed = grow(demo()); seed.history.points.forEach((q) => { q.tree = q.tree.map(([k, f]) => [k, f]); });
  const P4 = pointOf(seed.history, "P4"), text = JSON.stringify({ dw: "part/1", id: "B", name: "Couvercle embouti", rev: "écrit par un outil plus récent" });
  seed.history.objects.drift = text; P4.tree = P4.tree.map(([k, f]) => [k, k === "part:B" ? "drift" : f]);      // the same point, its part written otherwise today
  const plan = demoPlan(copy.history, seed.history);
  assert.deepEqual(plan.fresh.map((f) => [f.id, f.parent]), [["P5", "P4"]]); assert.deepEqual(plan.anchors.map((a) => [a.mine, a.drift]), [["P4", true]]);
  assert.equal(demoKey(P4), `2026-11-22T10:00:00.000Z|${by}|manual`);
});

test("the copy's own points : numbers go on after them ; a branch the copy continued itself is not continued by the demonstration, which opens its own, named", () => {
  const copy = clone(demo()); restoreInto(copy, "P4"); copy.parts[1].name = "Mon couvercle"; addPoint(copy, { label: "Mon essai", when: "2026-11-23T09:00:00.000Z", by: "JP" });      // P5, the copy's own, continues « Idée »
  const seed = demo(); restoreInto(seed, "P4"); seed.parts[1].name = "Couvercle usiné"; addPoint(seed, { label: "Usiné", when: "2026-11-28T02:00:00.000Z", by });      // the demonstration continues « Idée » too
  const plan = demoPlan(copy.history, seed.history);
  assert.deepEqual(plan.fresh.map((f) => [f.seed, f.id, f.parent, f.branch]), [["P5", "P6", "P4", "Idée (2)"]], "a second branch beside the copy's, never mixed with it");
  addDemoPoints(copy, seed.history, plan); const names = branchNames(copy.history);
  assert.equal(names.get("P5"), "Idée"); assert.equal(names.get("P6"), "Idée (2)");
});

test("only what the demonstration gained after the last point both have : a point the person deleted is not offered again ; a copy of something else shares nothing", () => {
  const copy = clone(demo()); restoreInto(copy, "P4"); deletePoint(copy, "P2");
  const seed = grow(demo()), plan = demoPlan(copy.history, seed.history);
  assert.deepEqual(plan.fresh.map((f) => f.seed), ["P5"], "P2, deleted by hand and older, stays deleted");
  const other = { dw: "project/1", id: "autre", name: "Autre", log: [], parts: [], assemblies: [], boards: [] }; addPoint(other, { label: "À moi", when: "2026-11-25T10:00:00.000Z", by: "JP" });
  const none = demoPlan(other.history, seed.history); assert.equal(none.none, true); assert.equal(none.nothing, true);
  assert.equal(demoPlan({ points: [] }, seed.history).none, true);
});

test("a demonstration point whose parent is no longer in the copy hangs from the nearest point the copy still has, and says so", () => {
  const seed = demo(); restoreInto(seed, "P3"); historyOf(seed).on = "Autre"; seed.parts[1].name = "Couvercle d'une autre piste"; addPoint(seed, { label: "Autre piste", when: "2026-11-28T03:00:00.000Z", by });
  const copy = clone(demo()); restoreInto(copy, "P4"); deletePoint(copy, "P3");      // P4 hangs from P1 now ; P3, the parent of the new point, is gone
  const plan = demoPlan(copy.history, seed.history);
  assert.deepEqual(plan.fresh.map((f) => [f.seed, f.id, f.parent, f.onto, f.branch]), [["P5", "P5", "P1", "ancestor", "Autre"]]);
  assert.deepEqual(plan.anchors.map((a) => a.mine), ["P1"]);
});

test("JP's case : the BM demonstration, a copy stopped at concept 4 (P8) — concept 5 comes as P9 to P11 on its branch, hung from P8 ; every point of the demonstration has its own identity", () => {
  const seed = bmProject({ branch: "c5" }), copy = clone(seed);
  for (const id of ["P11", "P10", "P9"]) deletePoint(copy, id);
  restoreInto(copy, "P8"); copy.id = "bm-8s8p-21700-mia1x2";
  const keys = seed.history.points.map(demoKey); assert.equal(new Set(keys).size, keys.length, "no two points of the demonstration share a date and an author");
  const plan = demoPlan(copy.history, seed.history);
  assert.deepEqual(plan.fresh.map((f) => [f.id, f.parent]), [["P9", "P8"], ["P10", "P9"], ["P11", "P10"]]);
  assert.ok(plan.fresh.every((f) => f.branch.startsWith("concept 5")));
  assert.equal(plan.last, "P8"); assert.equal(plan.present, 8);
  assert.match(demoLine(plan), /^3 points nouveaux — concept 5 .*, P9 à P11$/);
  addDemoPoints(copy, seed.history, plan); assert.equal(copy.history.head, "P8");
  restoreInto(copy, "P11"); assert.ok(copy.assemblies.some((a) => a.id === "BM5-SWAP-ASM"), "at P11, the copy has concept 5");
  assert.equal(seedOf(copy), DEMO_SEEDS[0]); assert.equal(seedOf({ id: "autre", name: "BM 8s8p - 21700 (2)" }), DEMO_SEEDS[0]); assert.equal(seedOf({ id: "rover-1", name: "Rover" }), null);
});

test("the date a project was made is not part of its definition, and never a change — even against a point that still carries it", () => {
  const p = { dw: "project/1", id: "p", name: "P", created: "2026-11-01T00:00:00.000Z", log: [], parts: [], assemblies: [] };
  assert.ok(!cut(p).some(([k]) => k === "key:created"));
  addPoint(p, { label: "Un", when: "2026-11-02T00:00:00.000Z" });
  const h = p.history; h.points[0].tree.push(["key:created", "x"]);      // a point posed before « created » was set aside
  assert.equal(changeCount(sinceThen(p, "P1")), 0);
  assert.equal(changeCount(diffTrees([["key:created", "a"]], [["key:created", "b"]], {})), 0);
});

/** A history of n points on MAIN, then a branch of two, the titles of the length asked. */
function long(n = 3) {
  const p = { dw: "project/1", id: "l", name: "L", log: [], parts: [{ id: "A", v: 0 }], assemblies: [] };
  for (let i = 1; i <= n; i++) { p.parts[0].v = i; addPoint(p, { label: i === 2 ? "Un titre assez long pour tenir sur plus d'une ligne quand la place manque vraiment beaucoup" : `Point ${i}`, when: `2026-11-2${i}T10:00:00.000Z`, by: "JP" }); }
  restoreInto(p, "P1"); historyOf(p).on = "Essai"; p.parts[0].v = 9; addPoint(p, { label: "Essai A", when: "2026-11-27T10:00:00.000Z", by: "JP" }); p.parts[0].v = 10; addPoint(p, { label: "Essai B", when: "2026-11-28T10:00:00.000Z", by: "Sam" });
  return p;
}

test("the rows of the tree : the newest on top by default, the order turned over at will ; the name of a branch once, at the head of its run", () => {
  const h = long().history, T = treeRows(h), ids = T.rows.map((r) => r.id);
  assert.deepEqual(ids, ["P5", "P4", "P3", "P2", "P1"], "newest on top");
  assert.deepEqual(treeRows(h, { newest: false }).rows.map((r) => r.id), ["P1", "P2", "P3", "P4", "P5"]);
  assert.deepEqual(T.rows.map((r) => [r.id, r.head]), [["P5", true], ["P4", false], ["P3", true], ["P2", false], ["P1", false]], "a branch named at the first row of each run, not on every row");
  assert.ok(T.rows.every((r, i) => !i || r.top === T.rows[i - 1].top + T.rows[i - 1].h), "rows follow one another");
  assert.equal(T.height, T.rows.at(-1).top + T.rows.at(-1).h);
  const one = { points: [], head: null }; addPoint({ dw: "project/1", id: "o", log: [], parts: [], assemblies: [], history: one }, { label: "Seul", when: "2026-11-20T10:00:00.000Z" });
  assert.equal(treeRows(one).rows[0].head, false, "a single branch : no name to repeat");
});

test("the line under a title : the date, the kind when it is not a point posed by hand, the author only when it changes — never the branch nor « Point posé »", () => {
  const h = long().history, when = (iso) => iso.slice(5, 10), T = treeRows(h, { when });
  const sub = Object.fromEntries(T.rows.map((r) => [r.id, r.sub.join(" · ")]));
  assert.equal(sub.P5, "11-28 · Sam"); assert.equal(sub.P4, "11-27 · JP", "the author changed from the row above"); assert.equal(sub.P3, "11-23"); assert.equal(sub.P1, "11-21");
  assert.ok(!Object.values(sub).some((s) => /branche|Point posé|MAIN/.test(s)));
  h.points.find((p) => p.id === "P3").kind = "before"; assert.match(treeRows(h, { when }).rows.find((r) => r.id === "P3").sub.join(" · "), /Avant un retour/);
  h.points.find((p) => p.id === "P5").demo = "x"; h.points.find((p) => p.id === "P4").demo = "x";
  const D = treeRows(h, { when }).rows; assert.match(D[0].sub.join(), /ajouté de la démonstration/); assert.doesNotMatch(D[1].sub.join(), /démonstration/, "said once for a run");
});

test("a title is written whole : cut at the words into lines, at most three, the rest in its tooltip ; a longer title makes a taller row ; « Maintenant » at the newest end", () => {
  assert.deepEqual(wrapText("un deux trois quatre", 9 * 7.4), ["un deux", "trois", "quatre"]);
  assert.deepEqual(wrapText("court", 500), ["court"]); assert.deepEqual(wrapText("", 100), [""]);
  const w = wrapText("a b c d e f g h i j k l", 3 * 7.4, undefined, 3); assert.equal(w.length, 3); assert.match(w[2], /…$/);
  const h = long().history, T = treeRows(h, { width: 300 }), p2 = T.rows.find((r) => r.id === "P2"), p1 = T.rows.find((r) => r.id === "P1");
  assert.ok(p2.lines.length > 1 && p2.lines.join(" ").replace(" …", "").length > 40); assert.ok(p2.h > p1.h); assert.equal(p2.lineY.length, p2.lines.length);
  assert.equal(p2.h - p1.h, (p2.lines.length - 1) * ROW_GEOM.line);
  const here = treeRows(h, { width: 300, hereWidth: 120 }).rows.find((r) => r.id === h.head); assert.ok(here.lines.length >= 1);
  const now = treeRows(h, { pending: 3 }); assert.equal(now.rows[0].now, true, "newest on top : « Maintenant » first"); assert.equal(treeRows(h, { pending: 3, newest: false }).rows.at(-1).now, true);
  assert.equal(MAIN, "MAIN");
});
