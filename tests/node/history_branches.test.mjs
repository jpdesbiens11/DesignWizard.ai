/* The branches of the history, named, MAIN in the centre ; a branch merged into MAIN in one block ; a teammate's work read as a branch
   (demande de JP, 21 novembre 2026 ; choices clicked : the whole branch in one block, a part absent from the side that wins enters at Off).
     node --test tests/node/history_branches.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addPoint, restoreInto, putDefinition, pointOf, branchNames, nextBranch, tipOf, historyOf, changeCount, sinceThen, MAIN, POINT_KINDS } from "../../web/js/core/history.js";
import { baseOf, branchList, branchLayout, mergePlan, importPlan, importBranch, freeName, startBranch, branchSuggestion } from "../../web/js/core/history_branches.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const project = () => ({ dw: "project/1", id: "essai-2", name: "Essai", log: [],
  parts: [{ dw: "part/1", id: "DW-0001", name: "Boîtier", params: { L: { value: 100 } } }],
  assemblies: [{ dw: "assembly/1", id: "ASM-001", name: "Produit", instances: [{ id: "i1", part: "DW-0001" }], mates: [] }], boards: [] });
let clock = 0; const at = () => new Date(Date.UTC(2026, 10, 21, 2, clock++)).toISOString();
const asm = (p) => p.assemblies[0];

/** MAIN : P1 → P2 (L = 120) → P5 (an instance i3 added) ; branch « Couvercle » from P1 : P3 (a lid, its instance i2) → P4 (the lid renamed). */
function story() {
  const p = project(); addPoint(p, { label: "Départ", when: at() });
  p.parts[0].params.L.value = 120; addPoint(p, { label: "Plus long", when: at() });
  restoreInto(p, "P1"); historyOf(p).on = "Couvercle";
  p.parts.push({ dw: "part/1", id: "DW-0002", name: "Couvercle" }); asm(p).instances.push({ id: "i2", part: "DW-0002" }); asm(p).mates.push({ id: "M1", a: { inst: "i1", iface: "top" }, b: { inst: "i2", iface: "seat" } });
  addPoint(p, { label: "Avec couvercle", by: "Coéquipier B", when: at() });
  p.parts[1].name = "Couvercle embouti"; addPoint(p, { label: "Embouti", when: at() });
  restoreInto(p, "P2"); asm(p).instances.push({ id: "i3", part: "DW-0001" }); asm(p).mates.push({ id: "M1", a: { inst: "i1", iface: "side" }, b: { inst: "i3", iface: "side" } });
  addPoint(p, { label: "Deux boîtiers", when: at() });
  return p;
}

test("every point has a branch : MAIN first ; going back to a point that is not the end of its branch opens a new one, under the name given", () => {
  const p = story(), h = p.history, names = branchNames(h);
  assert.deepEqual(h.points.map((x) => [x.id, x.branch]), [["P1", MAIN], ["P2", MAIN], ["P3", "Couvercle"], ["P4", "Couvercle"], ["P5", MAIN]]);
  assert.equal(h.on, undefined, "the name given is used once");
  assert.equal(names.get("P5"), MAIN, "back to the end of MAIN, a point continues MAIN");
  assert.equal(tipOf(h, MAIN).id, "P5"); assert.equal(tipOf(h, "Couvercle").id, "P4");
  for (const x of h.points) delete x.branch;      // a history kept before branches had names takes them by the same rule
  assert.deepEqual([...branchNames(h).entries()], [["P1", MAIN], ["P2", MAIN], ["P3", "Branche 2"], ["P4", "Branche 2"], ["P5", MAIN]]);
  restoreInto(p, "P1"); assert.equal(nextBranch(h), "Branche 3", "from the middle of MAIN, a new branch");
  h.on = "Idée"; assert.equal(nextBranch(h), "Idée"); h.on = MAIN; assert.equal(nextBranch(h), "Branche 3", "MAIN is not a name to take");
  h.head = "P4"; assert.equal(nextBranch(h), "Branche 2", "at the end of a branch, one continues it");
  assert.equal(freeName(h, "Branche 2"), "Branche 2 (2)"); assert.equal(freeName(h, "  Neuve  "), "Neuve");
  assert.ok(POINT_KINDS.merge && POINT_KINDS.import);
});

test("the branches, MAIN first : where each leaves, how far it is ahead ; drawn MAIN in the centre, the others on either side", () => {
  const p = story(), h = p.history, L = branchList(h);
  assert.deepEqual(L.map((b) => b.name), [MAIN, "Couvercle"]);
  const c = L[1]; assert.equal(c.fork, "P1"); assert.equal(c.base, "P1"); assert.equal(c.ahead, 2); assert.equal(c.by, "Coéquipier B"); assert.equal(c.here, false); assert.ok(L[0].here);
  assert.equal(baseOf(h, MAIN), null);
  const G = branchLayout(h); assert.equal(G.cols, 3, "a column kept empty on the left : MAIN in the middle"); assert.equal(G.main, 1); assert.deepEqual(G.lanes.map((x) => [x.name, x.col]), [[MAIN, 1], ["Couvercle", 2]]);
  restoreInto(p, "P1"); historyOf(p).on = "Autre"; p.name = "Essai bis"; addPoint(p, { label: "Autre piste", when: at() });
  const G2 = branchLayout(p.history); assert.equal(G2.cols, 3); assert.equal(G2.main, 1, "a third branch goes to the left : MAIN stays in the centre");
  assert.deepEqual(G2.lanes.map((x) => [x.name, x.col]), [[MAIN, 1], ["Couvercle", 2], ["Autre", 0]]);
});

test("merging a branch into MAIN, in one block : what the branch changed comes ; what MAIN did alone stays ; what both changed, the branch wins and the preview says it ; MAIN's instance comes back at Off with its mate", () => {
  const p = story(), h = p.history, plan = mergePlan(h, "Couvercle");
  assert.equal(plan.base, "P1"); assert.equal(plan.tip, "P4"); assert.equal(plan.main, "P5"); assert.equal(plan.nothing, false);
  assert.deepEqual(plan.take.map((t) => [t.key, t.how]).sort(), [["assembly:ASM-001", "changed"], ["part:DW-0002", "added"]]);
  assert.deepEqual(plan.lost.map((t) => t.key), ["assembly:ASM-001"], "MAIN had added a second casing to the same assembly");
  assert.deepEqual(plan.offs.map((o) => [o.asm, o.inst]), [["ASM-001", "i3"]]);
  const d = plan.doc; assert.equal(d.parts.find((x) => x.id === "DW-0001").params.L.value, 120, "MAIN's change the branch did not touch is kept");
  assert.equal(d.parts.find((x) => x.id === "DW-0002").name, "Couvercle embouti");
  assert.deepEqual(d.assemblies[0].instances.map((i) => [i.id, !!i.off]), [["i1", false], ["i2", false], ["i3", true]], "greyed, at Off, to be switched on");
  assert.deepEqual(d.assemblies[0].mates.map((m) => m.id), ["M1", "M1-MAIN"], "its mate comes back with it, renamed when the id is taken");
  assert.equal(mergePlan(h, MAIN), null);
  putDefinition(p, d); h.head = plan.main; const m = addPoint(p, { kind: "merge", branch: MAIN, merged: plan.tip, label: "Fusion de « Couvercle »", when: at() }).point;
  assert.equal(m.parent, "P5"); assert.equal(m.branch, MAIN); assert.equal(m.merged, "P4"); assert.equal(p.id, "essai-2");
  const c = branchList(h).find((b) => b.name === "Couvercle"); assert.equal(c.mergedAt, m.id); assert.equal(c.ahead, 0);
  assert.equal(mergePlan(h, "Couvercle").nothing, true, "nothing new since it was merged");
  restoreInto(p, "P4"); p.parts[1].name = "Couvercle v3"; const q = addPoint(p, { label: "v3", when: at() }).point; assert.equal(q.branch, "Couvercle", "the branch goes on after a merge");
  const again = mergePlan(h, "Couvercle"); assert.equal(again.base, "P4", "the next merge starts from what was already taken"); assert.deepEqual(again.take.map((t) => t.key), ["part:DW-0002"]); assert.deepEqual(again.lost, []);
});

test("a branch that took a part out : MAIN keeps it — nothing is deleted by a merge", () => {
  const p = project(); p.parts.push({ dw: "part/1", id: "OLD", name: "Ancienne" }); addPoint(p, { label: "A", when: at() }); addPoint(p, { kind: "manual", label: "A bis", when: at() });
  restoreInto(p, "P1"); historyOf(p).on = "Ménage"; p.parts = p.parts.filter((x) => x.id !== "OLD"); p.parts[0].name = "Boîtier 2"; addPoint(p, { label: "Sans l'ancienne", when: at() });
  const plan = mergePlan(p.history, "Ménage"); assert.deepEqual(plan.kept.map((k) => k.key), ["part:OLD"]); assert.ok(plan.doc.parts.some((x) => x.id === "OLD"));
});

test("a teammate's product, read from their file, becomes a branch of its own — from the point both files share ; « vous êtes ici » does not move", () => {
  const p = story(), mate = fromDwiz(toDwiz(p)), h = p.history;      // the teammate opened the same project ; their history came with it
  mate.parts[0].name = "Boîtier alu"; mate.log = [{ when: "2099-01-01T00:00:00.000Z", text: "Matière : aluminium" }];
  const plan = importPlan(h, mate, { by: "Coéquipier B" });
  assert.equal(plan.how, "common"); assert.equal(plan.base, "P5"); assert.equal(plan.name, "Branche de Coéquipier B");
  assert.deepEqual(plan.changes.changed.map((x) => x.key), ["part:DW-0001"]); assert.equal(plan.same, false);
  const bare = JSON.parse(JSON.stringify(mate)); delete bare.history; const loose = importPlan(h, bare, { by: "Coéquipier B" });
  assert.equal(loose.how, "closest", "a file without history : the closest point, said as such"); assert.equal(loose.base, "P5");
  const head = h.head, pt = importBranch(p, mate, plan, { by: "Coéquipier B", when: at() });
  assert.equal(pt.kind, "import"); assert.equal(pt.parent, "P5"); assert.equal(pt.branch, plan.name); assert.equal(h.head, head); assert.equal(pt.journal.length, 1);
  assert.equal(changeCount(sinceThen(p, head)), 0, "the product one works on is untouched");
  const m = mergePlan(h, plan.name); assert.deepEqual(m.take.map((t) => t.key), ["part:DW-0001"]); assert.equal(m.doc.parts[0].name, "Boîtier alu");
  const twice = importPlan(h, mate, { by: "Coéquipier B" }); assert.equal(twice.same, true, "the same work read twice : nothing to bring"); assert.equal(twice.name, "Branche de Coéquipier B (2)");
  assert.equal(importPlan(h, fromDwiz(toDwiz(p)), {}).same, true, "nothing to bring : the same product");
  const shuffled = JSON.parse(JSON.stringify(p)); delete shuffled.history; shuffled.parts = shuffled.parts.map((x) => Object.fromEntries(Object.entries(x).reverse()));
  assert.equal(importPlan(h, shuffled, {}).same, true, "the same artefacts written with their keys in another order : no change");
});

test("« Nouvelle branche ici » on the last point of MAIN : a branch beside it at once, MAIN does not move ; the points after it continue the branch ; back to MAIN, MAIN goes on ; the branch merges back", () => {
  const p = project(); addPoint(p, { label: "Départ", when: at() }); p.parts[0].params.L.value = 110; addPoint(p, { label: "Plus long", when: at() });
  const h = historyOf(p); assert.equal(branchSuggestion(h), "Branche 2"); assert.equal(nextBranch(h), MAIN, "at the end of MAIN, the next point continues MAIN");
  p.parts[0].name = "Boîtier alu";      // a change no point keeps yet : it goes with the branch
  const q = startBranch(p, "Essai alu", { when: at() });
  assert.equal(q.id, "P3"); assert.equal(q.parent, "P2"); assert.equal(branchNames(h).get("P3"), "Essai alu"); assert.equal(q.label, "Départ de « Essai alu »");
  assert.equal(tipOf(h, MAIN).id, "P2", "MAIN does not move"); assert.equal(h.head, "P3"); assert.equal(nextBranch(h), "Essai alu", "the next point continues the branch");
  assert.equal(branchLayout(h).lanes.length, 2); assert.notEqual(branchLayout(h).rows.find((r) => r.id === "P3").col, branchLayout(h).rows.find((r) => r.id === "P2").col, "beside MAIN, in its own column");
  assert.equal(mergePlan(h, "Essai alu").take.length, 1, "the change made before opening it is in the branch");
  restoreInto(p, "P2"); assert.equal(p.parts[0].name, "Boîtier", "back on MAIN : MAIN's product"); assert.equal(nextBranch(h), MAIN, "and MAIN goes on");
  p.parts[0].params.L.value = 130; addPoint(p, { label: "MAIN continue", when: at() }); assert.equal(branchNames(h).get("P4"), MAIN);
  const plan = mergePlan(h, "Essai alu"); assert.ok(!plan.nothing); assert.equal(plan.base, "P2");
  assert.equal(startBranch(project(), "x"), null, "no point, no branch");
});

test("a branch opened from an older point, its name taken : a free one ; a branch that changed nothing brings nothing to MAIN", () => {
  const p = project(); addPoint(p, { label: "A", when: at() }); addPoint(p, { label: "B", kind: "manual", when: at() });
  restoreInto(p, "P1"); const a = startBranch(p, "Essai", { when: at() }); assert.equal(a.parent, "P1"); assert.equal(a.branch, "Essai");
  restoreInto(p, "P1"); const b = startBranch(p, "Essai", { when: at() }); assert.equal(b.branch, "Essai (2)", "a name already taken gets a number");
  assert.ok(mergePlan(historyOf(p), "Essai").nothing, "opened and left as it was : nothing to merge");
  assert.deepEqual(freeName(historyOf(p), "MAIN"), "MAIN (2)");
});

test("wired : the screen, the tree, the sources, the news, the documents", () => {
  const ui = read("web/js/modules/history.js") + read("web/js/modules/history_branches_ui.js");
  assert.match(ui, /mergePlan/); assert.match(ui, /importPlan/); assert.match(ui, /historyMerge:/); assert.match(ui, /data-history-import/);
  assert.match(ui, /startBranch/); assert.match(ui, /historyFork:/); assert.match(ui, /historyForkHere:/); assert.match(ui, /Nouvelle branche ici/);
  assert.match(read("web/js/modules/history_tree.js"), /branchLayout/); assert.match(read("web/js/modules/history_tree.js"), /data-lane/);
  assert.match(read("docs/HISTORIQUE.md"), /MAIN/); assert.match(read("docs/HISTORIQUE.md"), /Nouvelle branche ici/); assert.match(read("CLAUDE.md"), /history_branches\.js/);
});
