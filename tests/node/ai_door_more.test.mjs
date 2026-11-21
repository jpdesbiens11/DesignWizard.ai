/* The end of point 2 of the roadmap (JP, 21 novembre 2026 : « 1 à 4 en continu ») : the door « Avec l'IA » of the Shop reads boards and drawing
   sheets too — planned, applied in the order a sheet needs, journaled, undone — and the screens that have their own round trip (flex, branched
   flex, labels, photo, Labo) put their answer in the same journal as the common loop.
     node --test tests/node/ai_door_more.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readAnswer, planAnswer, applyPlan, revertEntry, doorPrompt } from "../../web/js/core/ai_door.js";
import { moreDoc } from "../../web/js/core/ai_more.js";
import { toDwiz } from "../../web/js/core/dwiz.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../../web/js/demo/demo_hvb.js";
import { firstBoard } from "../../web/js/demo/demo_first.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const project = () => ({ dw: "project/1", id: "p", name: "P", parts: clone(DEMO_HVB_PARTS), assemblies: [clone(DEMO_HVB_ASSEMBLY)], boards: [], drawing: { drawnBy: "JP" }, log: [] });
const read = (f) => readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8");

test("an answer may hold boards and drawing sheets, beside parts and assemblies — each read for what it is", () => {
  const p = project(), part = p.parts[0], sheet = moreDoc(p, `drawing:part:${part.id}`), board = firstBoard();
  const r = readAnswer([{ name: "a.json", text: "```json\n" + JSON.stringify({ parts: [part], boards: [board], drawings: [sheet] }) + "\n```" }]);
  assert.deepEqual(r.errors, []); assert.deepEqual(r.docs.map((d) => d.kind).sort(), ["board", "drawing", "part"]);
  assert.deepEqual(readAnswer([{ name: "b.dwiz", text: toDwiz(board) }]).docs.map((d) => d.kind), ["board"], "a board alone, in .dwiz");
  assert.match(doorPrompt(p, { ask: "x" }), /« dw »: "board\/1"[\s\S]*"drawings"/);
});

test("the plan : a board created, modified or set aside ; a sheet for a part of the project or of the same answer, checked as the loop checks it", () => {
  const p = project(), part = p.parts[0], board = firstBoard();
  let rows = planAnswer(p, [{ kind: "board", doc: board }]); assert.equal(rows[0].action, "create"); assert.equal(rows[0].where, "Électronique ▸ PCBA");
  p.boards = [clone(board)]; const changed = { ...clone(board), name: "Autre nom" };
  rows = planAnswer(p, [{ kind: "board", doc: changed }]); assert.equal(rows[0].action, "modify");
  rows = planAnswer(p, [{ kind: "board", doc: { ...clone(board), id: "X", blocks: [{ id: "B1", template: "warp_drive" }] } }]); assert.equal(rows[0].action, "skip"); assert.match(rows[0].why, /warp_drive/);
  const sheet = { ...moreDoc(p, `drawing:part:${part.id}`), notes: ["DEBURR"] };
  rows = planAnswer(p, [{ kind: "drawing", doc: sheet }]); assert.equal(rows[0].action, "modify"); assert.equal(rows[0].where, "Mécanique ▸ Dessins");
  const fresh = { ...clone(part), id: "NEW-1", name: "Nouvelle" }, its = { ...sheet, id: "NEW-1" };
  rows = planAnswer(p, [{ kind: "part", doc: fresh }, { kind: "drawing", doc: its }]); assert.deepEqual(rows.map((r) => r.action), ["create", "modify"], "the sheet of a part this answer creates");
  rows = planAnswer(p, [{ kind: "drawing", doc: { ...sheet, id: "NOPE" } }]); assert.equal(rows[0].action, "skip");
  rows = planAnswer(p, [{ kind: "drawing", doc: { ...sheet, sheet: { projection: "second" } } }]); assert.equal(rows[0].action, "skip"); assert.match(rows[0].why, /Projection/);
});

test("applied in one step — parts first, then the sheets that need them — journaled with the title block, and undone", () => {
  const p = project(), part = p.parts[0], fresh = { ...clone(part), id: "NEW-1", name: "Nouvelle" }, sheet = { ...moreDoc(p, `drawing:part:${part.id}`), id: "NEW-1", notes: ["BREAK EDGES"], sheet: { drawnBy: "JP", approvedBy: "M. T." } };
  const rows = planAnswer(p, [{ kind: "drawing", doc: sheet }, { kind: "part", doc: fresh }, { kind: "board", doc: firstBoard() }]);
  const entry = applyPlan(p, rows, { ask: "essai" });
  assert.deepEqual(p.parts.find((x) => x.id === "NEW-1").notes, ["BREAK EDGES"], "the sheet went on the part created in the same step"); assert.equal(p.drawing.approvedBy, "M. T.");
  assert.deepEqual(entry.created.map((c) => `${c.kind}:${c.id}`).sort(), ["board:FIRST-PCBA", "part:NEW-1"]); assert.ok(entry.modified.some((m) => m.kind === "sheet"));
  assert.equal(p.aiJournal[0].id, entry.id);
  revertEntry(p, entry.id); assert.ok(!p.parts.some((x) => x.id === "NEW-1") && !(p.boards || []).some((b) => b.id === "FIRST-PCBA")); assert.equal(p.drawing.approvedBy, undefined);
});

test("wired : the screens with their own round trip put their answer in the journal ; the door shows boards and sheets", () => {
  assert.match(read("modules/ai_loop.js"), /export function applyAnswer\(own, ask, fn\)/);
  for (const [f, key] of [["modules/flex.js", "part"], ["modules/flex_tree.js", "part"], ["modules/labels.js", "assembly"], ["modules/render.js", "assembly"], ["modules/elab.js", "board"]]) assert.match(read(f), new RegExp(`applyAnswer\\(\\[\`${key}:\\$\\{id\\}\`\\]`), f);
  assert.match(read("modules/shop_ai.js"), /r\.kind === "board" \? "chip"/); assert.match(read("modules/shop_ai.js"), /d\.kind === "sheet"/);
});
