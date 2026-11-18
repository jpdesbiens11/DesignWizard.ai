/* Several load cases under a name for a part or an assembly : one in use — a living case, what the screen changes goes to it —,
   the others kept beside it as they were left. analysis/fea/case_store.js, modules/fea_cases.js, modules/fea.js. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blankCase, caseFrom, caseOf, takeCase, withCase, sameCase, FIRST_CASE, caseName, caseList, freshCaseName, caseNameFree, addCase, useCase, renameCase, dropCase } from "../../web/js/analysis/fea/case_store.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { artefacts } from "../../web/js/core/team.js";
import { simulationSummary } from "../../web/js/analysis/fea/summary.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const project = () => ({ dw: "project/1", id: "p1", name: "Essai", parts: [{ id: "DW-001", name: "Bride" }, { id: "DW-002", name: "Capot" }], assemblies: [], log: [] });
const screen = () => ({ ...blankCase(), target: { type: "part", id: "DW-001" }, sel: null, view: "model" });
const service = (st) => { st.fixed = ["face:-X"]; st.loads = [{ region: "face:+X", mode: "force", F: 250, dir: "-Z", p: 0.1 }]; return st; };

test("cases : a document nobody set has one case, « Cas 1 », and nothing is written for it", () => {
  const p = project(), st = screen();
  assert.equal(FIRST_CASE, "Cas 1"); assert.deepEqual(caseList(p, "DW-001"), [{ name: "Cas 1", on: true, note: "" }]); assert.equal(caseName(null), "Cas 1");
  assert.equal(withCase(p, "DW-001", st), false); assert.equal(p.cases, undefined, "a visit writes nothing");
  service(st); withCase(p, "DW-001", st);
  assert.deepEqual(Object.keys(p.cases[0]).slice(0, 2), ["id", "kind"], "a single case nobody named is written as before : no name, no list");
  assert.deepEqual(caseList(p, "DW-001"), [{ name: "Cas 1", on: true, note: "1 appui · 1 effort" }]); assert.equal(freshCaseName(caseList(p, "DW-001")), "Cas 2");
});

test("cases : a new case is a copy of the one in use — it comes in use, the other waits as it was", () => {
  const p = project(), st = service(screen()); withCase(p, "DW-001", st);
  assert.equal(addCase(p, "DW-001", st, "  Transport   routier "), "Transport routier", "the name is tidied");
  assert.deepEqual(caseList(p, "DW-001").map((c) => [c.name, c.on]), [["Cas 1", false], ["Transport routier", true]], "right after the one it was copied from");
  assert.ok(sameCase(caseOf(p, "DW-001"), st), "nothing changes on the screen : the same conditions, under another name"); assert.equal(p.cases[0].name, "Transport routier"); assert.equal(p.cases[0].at, 1); assert.equal(p.cases[0].others.length, 1);
  assert.equal(addCase(p, "DW-001", st, "Cas 1"), null, "a name already taken"); assert.equal(addCase(p, "DW-001", st, "   "), null); assert.equal(caseNameFree(p, "DW-001", "Autre"), "Autre"); assert.equal(caseNameFree(p, "DW-001", "Cas 1", "Cas 1"), "Cas 1", "a case may keep its own name");
  /* the case in use is a living one : what the screen changes goes to it, and only to it */
  st.loads[0].F = 900; withCase(p, "DW-001", st);
  assert.equal(p.cases[0].loads[0].F, 900); assert.equal(p.cases[0].others[0].loads[0].F, 250, "the case aside did not move"); assert.equal(p.cases[0].name, "Transport routier", "writing the case keeps its name and the others");
  assert.equal(freshCaseName(caseList(p, "DW-001")), "Cas 3"); assert.equal(p.cases.length, 1, "one entry per document, whatever the number of its cases");
});

test("cases : a click brings another case in use — each comes back as it was left, the list keeps its order", () => {
  const p = project(), st = service(screen()); withCase(p, "DW-001", st); addCase(p, "DW-001", st, "Transport"); st.loads[0].F = 900; st.cells = 6000; withCase(p, "DW-001", st); addCase(p, "DW-001", st, "Chute"); st.loads.push({ region: "face:+Z", mode: "force", F: 50, dir: "-Z", p: 0.1 });
  const back = useCase(p, "DW-001", st, "Cas 1");      // « Chute » still has a change the project has not seen : it is written as it leaves
  assert.equal(back.loads[0].F, 250); assert.equal(back.cells, 3000); assert.deepEqual(Object.keys(back), Object.keys(blankCase()), "what comes back is a case, without name nor list");
  assert.deepEqual(caseList(p, "DW-001").map((c) => [c.name, c.on, c.note]), [["Cas 1", true, "1 appui · 1 effort"], ["Transport", false, "1 appui · 1 effort"], ["Chute", false, "1 appui · 2 efforts"]], "the order of the list does not depend on the case in use");
  takeCase(st, back); assert.equal(st.loads.length, 1); assert.equal(st.target.id, "DW-001", "the screen keeps what is its own");
  const t = useCase(p, "DW-001", st, "Transport"); assert.equal(t.loads[0].F, 900); assert.equal(t.cells, 6000, "the mesh setting belongs to the case"); takeCase(st, t);
  assert.deepEqual(caseList(p, "DW-001").map((c) => c.on), [false, true, false]); assert.equal(useCase(p, "DW-001", st, "Transport"), null, "already in use"); assert.equal(useCase(p, "DW-001", st, "Inconnu"), null);
  assert.deepEqual(caseList(p, "DW-001", st).map((c) => c.note), ["1 appui · 1 effort", "1 appui · 1 effort", "1 appui · 2 efforts"]);
  const c = useCase(p, "DW-001", st, "Chute"); assert.equal(c.loads.length, 2, "the change made before leaving was kept");
});

test("cases : renamed and taken away — a document always has a case", () => {
  const p = project(), st = service(screen()); withCase(p, "DW-001", st); addCase(p, "DW-001", st, "Transport"); addCase(p, "DW-001", st, "Chute");
  assert.equal(renameCase(p, "DW-001", st, "Chute", "Chute 1 m"), true); assert.equal(renameCase(p, "DW-001", st, "Cas 1", "Service"), true, "a case aside is renamed too");
  assert.equal(renameCase(p, "DW-001", st, "Service", "Transport"), false, "not to a name already taken"); assert.equal(renameCase(p, "DW-001", st, "Inconnu", "X"), false); assert.equal(renameCase(p, "DW-001", st, "Service", " "), false);
  assert.deepEqual(caseList(p, "DW-001").map((c) => [c.name, c.on]), [["Service", false], ["Transport", false], ["Chute 1 m", true]]);
  /* a case aside leaves : the screen keeps its own */
  assert.deepEqual(dropCase(p, "DW-001", st, "Service"), { gone: true, take: null }); assert.deepEqual(caseList(p, "DW-001").map((c) => [c.name, c.on]), [["Transport", false], ["Chute 1 m", true]]);
  /* the one in use leaves : its neighbour comes in use */
  st.loads[0].F = 5; const d = dropCase(p, "DW-001", st, "Chute 1 m"); assert.equal(d.take.loads[0].F, 250, "the last of the list : the one before comes in use"); takeCase(st, d.take);
  assert.deepEqual(caseList(p, "DW-001"), [{ name: "Transport", on: true, note: "1 appui · 1 effort" }]); assert.equal(p.cases[0].others, undefined, "alone again : no list left in the file"); assert.equal(p.cases[0].name, "Transport", "but its name stays");
  assert.equal(dropCase(p, "DW-001", st, "Inconnu"), null);
  /* the only case : emptied, not removed */
  const e = dropCase(p, "DW-001", st, "Transport"); assert.deepEqual(e.take, blankCase()); assert.equal(p.cases, undefined, "a single blank « Cas 1 » is not written"); assert.deepEqual(caseList(p, "DW-001"), [{ name: "Cas 1", on: true, note: "" }]);
  /* a named case with nothing set yet is kept : somebody typed that name */
  takeCase(st, null); renameCase(p, "DW-001", st, "Cas 1", "À faire"); assert.equal(p.cases[0].name, "À faire"); assert.equal(withCase(p, "DW-001", st), false, "writing it again changes nothing"); assert.equal(p.cases.length, 1);
});

test("cases : the first of three taken away while in use — the next one takes its place", () => {
  const p = project(), st = service(screen()); withCase(p, "DW-001", st); addCase(p, "DW-001", st, "B"); st.loads[0].F = 2; withCase(p, "DW-001", st); addCase(p, "DW-001", st, "C"); st.loads[0].F = 3; withCase(p, "DW-001", st);
  takeCase(st, useCase(p, "DW-001", st, "Cas 1")); const d = dropCase(p, "DW-001", st, "Cas 1");
  assert.equal(d.take.loads[0].F, 2); assert.deepEqual(caseList(p, "DW-001").map((c) => [c.name, c.on]), [["B", true], ["C", false]]);
});

test("cases : each document has its own, they travel in the .dwiz text, and the team merges them under the id of the part", () => {
  const p = project(), a = service(screen()), b = screen(); withCase(p, "DW-001", a); addCase(p, "DW-001", a, "Transport"); a.loads[0].F = 900; withCase(p, "DW-001", a);
  b.target = { type: "part", id: "DW-002" }; b.cells = 5000; withCase(p, "DW-002", b);
  assert.deepEqual(p.cases.map((c) => [c.id, caseName(c), (c.others || []).length]), [["DW-001", "Transport", 1], ["DW-002", "Cas 1", 0]]);
  const back = fromDwiz(toDwiz(p)); assert.deepEqual(back.cases, p.cases, "names, list and order come back the same");
  assert.deepEqual(caseList(back, "DW-001").map((c) => [c.name, c.on]), [["Cas 1", false], ["Transport", true]]);
  assert.ok(artefacts(p).has("case:DW-001") && artefacts(p).has("case:DW-002")); assert.equal([...artefacts(p).keys()].filter((k) => k.startsWith("case:")).length, 2, "one artefact per document : its cases travel together");
  p.parts = p.parts.filter((x) => x.id !== "DW-002"); withCase(p, "DW-001", a); assert.deepEqual(p.cases.map((c) => c.id), ["DW-001"], "the cases of a part that is gone leave with it — all of them");
});

test("cases : a file written before the names reads as one case, « Cas 1 », and is not rewritten by a visit", () => {
  const st = service(screen()), old = { ...project(), cases: [{ id: "DW-001", ...caseFrom(st) }] }, before = JSON.stringify(old.cases);
  assert.deepEqual(caseList(old, "DW-001").map((c) => [c.name, c.on]), [["Cas 1", true]]); takeCase(st, caseOf(old, "DW-001"));
  assert.equal(withCase(old, "DW-001", st), false); assert.equal(JSON.stringify(old.cases), before, "the same bytes");
  const odd = { ...project(), cases: [{ id: "DW-001", ...caseFrom(st), others: [{ name: "B", ...blankCase() }], at: 9 }] }; assert.deepEqual(caseList(odd, "DW-001").map((c) => [c.name, c.on]), [["B", false], ["Cas 1", true]], "a place out of the list is brought back in");
});

test("cases : a simulation kept for the report says which case it ran", () => {
  const row = (extra) => simulationSummary({ simulations: [{ id: "S1", kind: "structure", target: "DW-001", cells: 3000, h: 2, estimate: { sigma: 10, delta: 0.1 }, result: { sigma: 11, delta: 0.1 }, verdict: "ok", worst: 0.1, ...extra }] })[0];
  assert.equal(row({}).target, "DW-001"); assert.equal(row({ case: "Transport" }).target, "DW-001 — Transport");
});

test("wiring : the Simulation lists its cases, each change is one undoable step, and a trial names its case", () => {
  const f = read("web/js/modules/fea.js"), c = read("web/js/modules/fea_cases.js"), r = read("web/js/modules/fea_result.js");
  assert.match(c, /export function casesSection\(o\)/); assert.match(c, /class: "side-section", "data-fold-note":/); assert.match(c, /el\("h3", null, el\("span", \{ class: "grow" \}, `Cas de charge \(\$\{list\.length\}\)`\)/);
  assert.match(c, /"aria-current": x\.on \? "true" : null/); assert.match(c, /role: "button", tabindex: "0"/);
  assert.match(f, /casesSection\(\{ list: caseList\(store\.project, st\.target\.id, st\)/);
  for (const [fn, label] of [["addCase", "nouveau cas"], ["useCase", "cas « "], ["renameCase", "renommé"], ["dropCase", "retiré"]]) assert.match(f, new RegExp(`store\\.commit\\(\`Cas de charge : \\$\\{st\\.target\\.id\\} — [^\`]*${label}[^\`]*\`, \\(x\\) => \\{ [a-z]+ = ${fn}\\(x, st\\.target\\.id, st, `), `${fn} : one named step`);
  assert.match(f, /el\("h3", null, "Conditions du cas"\)/, "the tree of the case in use has its own title");
  assert.match(f, /case: \{ \.\.\.ran, name: caseNow\(\) \}/, "a trial remembers the name of its case"); assert.match(r, /x\.case\.name/);
  assert.match(f, /\.\.\.\(named\(\) \? \{ case: last\.case\.name \} : \{\}\)/, "a kept simulation names the case it ran, when the document has several or a named one");
  assert.match(f, /sig = \(\) => JSON\.stringify\(caseList\(store\.project, st\.target\.id\)\.map\(\(x\) => \[x\.name, x\.on\]\)\)/, "an undo that only renames is seen too");
});
