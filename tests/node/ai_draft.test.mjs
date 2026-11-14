/* Co-intelligence guardrails, as on DynamiteAgile : an AI's proposal is a draft until a human confirms it ; a standard
   an AI names waits for its edition and clause ; a function number is never given twice. */
import test from "node:test";
import assert from "node:assert/strict";
import { markAiDraft, draftsOf, confirmDraft, normsIn } from "../../web/js/core/ai_draft.js";
import { addFunction, removeFunction, addBlock, nextFunctionId } from "../../web/js/pcba/synth.js";
import { emptyBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { reviewData } from "../../web/js/pcba/review_data.js";
import { reviewVerdict } from "../../web/js/pcba/review.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

test("a function number is kept for ever : removed, it is not given again", () => {
  const b = emptyBoard("T", "essai"), a = addFunction(b, { name: "Alimenter" }), c = addFunction(b, { name: "Mesurer" }); assert.deepEqual([a, c], ["F1", "F2"]);
  const k = addFunction(b, { parent: "F2", name: "Mesurer le courant" }); assert.equal(k, "F2.1"); removeFunction(b, "F2"); assert.equal(nextFunctionId(b), "F3", "F2 is not reused"); assert.equal(addFunction(b, { name: "Communiquer" }), "F3");
  addFunction(b, { parent: "F3", name: "CAN" }); removeFunction(b, "F3.1"); assert.equal(addFunction(b, { parent: "F3", name: "LIN" }), "F3.2"); assert.deepEqual(fromDwiz(toDwiz(b)), b, "the counter travels in the file");
  const d = demoBoard(), last = d.functions.filter((f) => !f.parent).length; addBlock(d, "button", {}); const id = d.functions[d.functions.length - 1].id; removeFunction(d, id); addBlock(d, "buzzer", {}); assert.notEqual(d.functions[d.functions.length - 1].id, id); assert.ok(last > 0);
});

test("what an AI adds or changes arrives as a draft ; what it leaves alone keeps its state ; a human confirms", () => {
  const before = demoBoard(), after = fromDwiz(toDwiz(before)), f1 = after.functions[0].id;
  after.functions[0].name = "Alimenter la logique à partir du 24 V du véhicule"; after.functions.push({ id: "F99", parent: null, name: "Résister aux transitoires selon ISO 7637-2", kind: "contrainte", criteria: [{ name: "Impulsion 5b", level: "87 V, selon ISO 16750-2", flex: "F0" }], block: null });
  const m = markAiDraft(before, after, "board"); assert.deepEqual(m.drafts.map((x) => x.key).sort(), [f1, "F99"].sort()); assert.deepEqual(m.norms.sort(), ["ISO 16750-2", "ISO 7637-2"]);
  assert.ok(after.functions[0].ai.draft && !after.functions[0].ai.norms && !after.functions[1].ai, "an untouched function carries no tag"); assert.equal(draftsOf(after).length, 2);
  // the review does not pass while something waits
  const v = reviewVerdict(reviewData(after, LIBRARY, { kind: "PDR" })); assert.ok(v.blockers.some((t) => /Brouillon IA.*F99.*normes à confirmer.*ISO 7637-2/.test(t)), JSON.stringify(v.blockers)); assert.ok(!reviewVerdict(reviewData(before, LIBRARY, { kind: "PDR" })).blockers.some((t) => /Brouillon IA/.test(t)));
  // a second answer that leaves F99 alone does not lift its tag ; one that changes a confirmed item tags it again
  const again = fromDwiz(toDwiz(after)); again.functions[1].name = "Calculer"; const m2 = markAiDraft(after, again, "board"); assert.deepEqual(m2.drafts.map((x) => x.key), [again.functions[1].id]); assert.ok(again.functions.find((f) => f.id === "F99").ai.draft && again.functions[0].ai.draft);
  // confirming : a plain draft at once ; a draft that names standards only with edition and clause for each
  assert.deepEqual(confirmDraft(after.functions[0]), { ok: true, missing: [] }); assert.equal(after.functions[0].ai, undefined);
  const f99 = after.functions.find((f) => f.id === "F99"); assert.deepEqual(confirmDraft(f99, { "ISO 7637-2": { edition: "2011", clause: "5.6" } }), { ok: false, missing: ["ISO 16750-2"] }); assert.ok(f99.ai.draft, "nothing changes while an edition or a clause is missing");
  assert.ok(confirmDraft(f99, { "ISO 7637-2": { edition: "2011", clause: "5.6" }, "ISO 16750-2": { edition: "2023", clause: "4.6.4" } }).ok); assert.deepEqual(f99.norms, [{ ref: "ISO 7637-2", edition: "2011", clause: "5.6" }, { ref: "ISO 16750-2", edition: "2023", clause: "4.6.4" }]); assert.equal(draftsOf(after).length, 0);
  const later = fromDwiz(toDwiz(after)); later.functions.find((f) => f.id === "F99").note = "Voir aussi ISO 7637-2."; assert.deepEqual(markAiDraft(after, later, "board").norms, [], "a standard already confirmed is not asked again"); assert.deepEqual(fromDwiz(toDwiz(after)), after);
  assert.deepEqual(normsIn("Selon IPC-2221B et IEC 60664-1, voir aussi EN 755-9 ; 24 V, M3, F0."), ["IPC-2221B", "IEC 60664-1", "EN 755-9"]); assert.deepEqual(markAiDraft(before, fromDwiz(toDwiz(before)), "board"), { drafts: [], norms: [] });
});
