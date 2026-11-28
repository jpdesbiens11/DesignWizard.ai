/* The history of a design (core/history.js) : restore points that keep the whole product, each artefact stored once ; going back ; branches ;
   the tree laid out as a commit graph ; what changed ; the automatic point after an answer of an AI ; and the store, whose undo leaves the
   history alone. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fingerprint, cut, historyOf, addPoint, rebuild, restoreInto, sinceThen, diffTrees, changeCount, pathTo, layout, branches, setDropped, weight,
  pointProject, withoutHistory, newAiAnswer, historyGuide, historyRows, contextOf, POINT_KINDS, pointOf } from "../../web/js/core/history.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const STEP = "ISO-10303-21;\n" + "DATA;#1=CARTESIAN_POINT('',(0.,0.,0.));\n".repeat(4000);          // a heavy imported file, about 170 ko
const project = () => ({ dw: "project/1", id: "essai-1", name: "Essai", log: [{ when: "2026-11-21T00:00:00.000Z", text: "Pièce ajoutée : DW-0001" }],
  parts: [{ dw: "part/1", id: "DW-0001", name: "Boîtier", params: { L: { value: 100 } } }, { dw: "part/1", id: "IMP", name: "Connecteur importé", step: { text: STEP, file: "c.step" } }],
  assemblies: [{ dw: "assembly/1", id: "ASM-001", name: "Produit", instances: [{ id: "i1", part: "DW-0001" }], mates: [] }], boards: [], review: { items: {} } });
const definition = (p) => JSON.stringify(withoutHistory({ ...p, log: undefined, updated: undefined, id: undefined }));
let clock = 0; const at = () => new Date(Date.UTC(2026, 10, 21, 1, clock++)).toISOString();

test("a fingerprint : equal texts, equal prints ; one character apart, different", () => {
  assert.equal(fingerprint("abc"), fingerprint("abc")); assert.notEqual(fingerprint("abc"), fingerprint("abd")); assert.notEqual(fingerprint(""), fingerprint(" "));
  assert.match(fingerprint(STEP), /^[0-9a-z]+\.[0-9a-z]+$/);
});

test("a point keeps the WHOLE definition ; an artefact that does not change is stored once — the imported STEP too", () => {
  const p = project();
  assert.deepEqual(cut(p).map(([k]) => k), ["key:dw", "key:name", "part:DW-0001", "part:IMP", "list:parts", "assembly:ASM-001", "list:assemblies", "list:boards", "key:review"], "the log, the id and the clock are not the definition");
  const a = addPoint(p, { kind: "manual", label: "Premier", when: at() }).point, w1 = weight(p.history);
  assert.equal(a.id, "P1"); assert.equal(a.parent, null); assert.equal(p.history.head, "P1"); assert.equal(a.journal.length, 1, "its journal : what was done before it");
  p.parts[0].params.L.value = 120; p.log.push({ when: at(), text: "L = 120" });
  const b = addPoint(p, { kind: "manual", label: "Plus long", when: at() }).point, w2 = weight(p.history);
  assert.equal(b.parent, "P1"); assert.equal(w2.objects - w1.objects, 1, "one part changed : one object more");
  assert.ok(w2.bytes - w1.bytes < 3000, `the second point costs the part that changed, not the STEP (${w2.bytes - w1.bytes} octets)`);
  assert.deepEqual(b.journal.map((x) => x.text), ["L = 120"], "its own journal : what was done since the point before");
  assert.equal(rebuild(p.history, "P1").parts[0].params.L.value, 100); assert.equal(rebuild(p.history, "P2").parts[0].params.L.value, 120);
  assert.equal(rebuild(p.history, "P1").parts[1].step.text, STEP, "the heavy file comes back whole");
});

test("an automatic point is not posed when nothing changed ; a point asked by hand is", () => {
  const p = project(); addPoint(p, { kind: "manual", label: "A", when: at() });
  const r = addPoint(p, { kind: "ai", when: at() }); assert.equal(r.same, true); assert.equal(p.history.points.length, 1);
  const m = addPoint(p, { kind: "manual", label: "B", when: at() }); assert.equal(m.same, true); assert.equal(p.history.points.length, 2, "by hand : posed, and said to be the same");
  assert.equal(addPoint(p, { kind: "nonsense", when: at() }).point.kind, "manual"); assert.ok(POINT_KINDS.ai && POINT_KINDS.before);
});

test("going back : the definition becomes that of the point, the id, the log and the history stay ; continuing opens a branch", () => {
  const p = project(); addPoint(p, { kind: "manual", label: "Départ", when: at() });
  p.parts[0].params.L.value = 150; p.parts.push({ dw: "part/1", id: "DW-0002", name: "Couvercle" }); delete p.review; p.mvp = { iterations: [] };
  addPoint(p, { kind: "manual", label: "Avec couvercle", when: at() });
  const d = sinceThen(p, "P1"); assert.deepEqual(d.added.map((x) => x.key).sort(), ["key:mvp", "part:DW-0002"]); assert.deepEqual(d.changed.map((x) => x.key), ["part:DW-0001"]); assert.deepEqual(d.removed.map((x) => x.key), ["key:review"]);
  assert.equal(d.added.find((x) => x.key === "part:DW-0002").name, "Couvercle"); assert.equal(d.removed[0].name, "registre de revue");
  const log = p.log.length, keep = p.history;
  restoreInto(p, "P1");
  assert.equal(p.id, "essai-1"); assert.equal(p.log.length, log); assert.equal(p.history, keep); assert.equal(p.history.head, "P1");
  assert.equal(p.parts.length, 2); assert.equal(p.parts[0].params.L.value, 100); assert.ok(p.review); assert.equal(p.mvp, undefined, "what the point did not have is gone");
  assert.equal(changeCount(sinceThen(p, "P1")), 0, "the product is that of the point");
  p.parts[0].name = "Boîtier épais"; const c = addPoint(p, { kind: "manual", label: "Autre idée", when: at() }).point;
  assert.equal(c.parent, "P1", "continuing from a point opens a branch");
  const L = layout(p.history); assert.equal(L.lanes, 2); assert.deepEqual(L.rows.map((r) => [r.id, r.lane]), [["P1", 0], ["P2", 0], ["P3", 1]]);
  assert.deepEqual(pathTo(p.history, "P3").map((x) => x.id), ["P1", "P3"]);
  const B = branches(p.history); assert.equal(B.length, 2); assert.deepEqual(B.find((b) => b.tip === "P2").points, ["P2"]); assert.ok(B.find((b) => b.tip === "P3").here);
  assert.equal(setDropped(p, "P3", true), false, "the branch of « vous êtes ici » is not set aside");
  assert.equal(setDropped(p, "P2", true), true); assert.ok(pointOf(p.history, "P2").dropped); assert.ok(branches(p.history).find((b) => b.tip === "P2").dropped);
  assert.equal(setDropped(p, "P2", false), true); assert.equal(pointOf(p.history, "P2").dropped, undefined, "taken up again ; nothing was deleted");
  const between = diffTrees(pointOf(p.history, "P2").tree, pointOf(p.history, "P3").tree, p.history.objects); assert.ok(changeCount(between) >= 3);
});

test("a point leaves as a project that stands alone ; the history survives the .dwiz file", () => {
  const p = project(); addPoint(p, { kind: "manual", label: "À emporter", note: "pour l'essai", when: at() }); p.parts[0].name = "Changé"; addPoint(p, { kind: "ai", label: "Après l'IA", ai: "ai-1", when: at() });
  const doc = pointProject(p, "P1"); assert.equal(doc.id, "essai-1-P1"); assert.equal(doc.history, undefined); assert.equal(doc.parts[0].name, "Boîtier"); assert.match(doc.name, /P1 À emporter/);
  const back = fromDwiz(toDwiz(p)); assert.deepEqual(back.history, p.history, "written and read back the same");
  assert.equal(fromDwiz(toDwiz(doc)).parts[1].step.text, STEP);
  assert.equal(withoutHistory(p).history, undefined); assert.ok(withoutHistory(p).parts);
});

test("the answer of an AI : a new first line in the journal is a new answer", () => {
  const p = project(); assert.equal(newAiAnswer(p, null), null);
  p.aiJournal = [{ id: "ai-1", ask: "un couvercle" }]; assert.equal(newAiAnswer(p, null).id, "ai-1"); assert.equal(newAiAnswer(p, "ai-1"), null);
  p.aiJournal.unshift({ id: "ai-2" }); assert.equal(newAiAnswer(p, "ai-1").id, "ai-2");
});

test("the guide, the context of a point, the lines of the report", () => {
  const p = project(); assert.equal(historyGuide(p)[0].level, "tip"); assert.match(historyGuide(p)[0].text, /Aucun point/);
  p.mvp = { iterations: [{ n: 1, name: "MVP 1", trl: 3, reviews: [] }] }; p.plm = { releases: [{ key: "part:DW-0001", pn: "PRT-1", rev: "A", state: "frozen" }] };
  const c = contextOf(p); assert.equal(c.mvp.name, "MVP 1"); assert.equal(c.mvp.state, "open"); assert.equal(c.revs.frozen, 1); assert.equal(c.revs.last[0].fr, "Gelée");
  addPoint(p, { kind: "manual", label: "Avec contexte", context: c, when: at() }); assert.deepEqual(historyGuide(p), []);
  p.parts[0].name = "Autre"; assert.match(historyGuide(p)[0].text, /1 artéfact a changé depuis « Avec contexte »/);
  const rows = historyRows(p); assert.equal(rows.length, 1); assert.match(rows[0][0], /P1 ◀ ici/); assert.match(rows[0][5], /MVP 1/); assert.match(rows[0][6], /1 gelée/);
  historyOf(p); assert.equal(p.history.v, 1);
});

test("the store : an undo step does not carry the history, and an undo leaves the restore points where they are", async () => {
  globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
  const { store } = await import("../../web/js/core/store.js");
  store.adopt(project()); addPoint(store.project, { kind: "manual", label: "Avant", when: at() });
  store.commit("L = 130", (x) => { x.parts[0].params.L.value = 130; });
  assert.ok(!store.undoStack.at(-1).snap.includes("\"history\""), "the undo step is the project without its history");
  store.writeHistory("Point", (x) => addPoint(x, { kind: "manual", label: "Après", when: at() }));
  assert.equal(store.undoStack.length, 1, "a point is not an undo step");
  store.undo(); assert.equal(store.project.parts[0].params.L.value, 100); assert.equal(store.project.history.points.length, 2, "the points stay");
  store.commit("Retour", (x) => { restoreInto(x, "P2"); }); assert.equal(store.project.parts[0].params.L.value, 130); assert.equal(store.project.history.head, "P2");
  clearTimeout(store.saveTimer);
});

test("wiring : a screen, a place in the menu Produit, a step up, the automatic point, the history kept out of AI requests and mirrors", () => {
  assert.match(read("web/js/core/app.js"), /keys: \["dfx", "review", "report", "history"/);
  assert.match(read("web/js/core/app.js"), /go\("#\/history"\)/);
  assert.match(read("web/js/core/stairs.js"), /case "history": (case "eco": )?return \{ hash: "#\/review"/);
  assert.match(read("web/js/main.js"), /import "\.\/modules\/history\.js";/); assert.match(read("web/js/main.js"), /installHistoryAuto\(\);/);
  assert.match(read("web/js/modules/ai_loop.js"), /delete d\.history;/); assert.match(read("web/js/modules/mvp.js"), /delete d\.history;/);
  assert.match(read("web/js/modules/team.js"), /toDwiz\(withoutHistory\(store\.project\)\)/); assert.match(read("web/js/modules/shop_ai.js"), /toDwiz\(withoutHistory\(p\)\)/);
  const screen = read("web/js/modules/history.js"); assert.match(screen, /class: "studio" \}, left, view, right/); assert.match(screen, /class: "side-head"/);
  assert.match(screen, /returnTo/); assert.match(read("web/js/modules/history_demo_ui.js"), /store\.commit\(`Retour au point/, "going back is one undoable step");
  for (const s of ["web/img/icons.svg", "web/img/icons-crisp.svg"]) { assert.match(read(s), /id="i-history"/); assert.match(read(s), /id="i-branch"/); }
  assert.match(read("web/index.html"), /href="css\/history\.css"/);
});
