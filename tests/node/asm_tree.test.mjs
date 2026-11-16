/* Assembly : the mates as a tree, by health — numbers, words, colours, and which labels the view shows. */
import test from "node:test";
import assert from "node:assert/strict";
import { MATE_COLORS, MATE_GROUPS, mateTree, mateFind, mateLabels, mateShown } from "../../web/js/core/asm_tree.js";

const asm = { mates: [{ id: "M1", a: { inst: "i2", iface: "IF1" }, b: { inst: "i1", iface: "IF1" } }, { id: "M2", a: { inst: "i3", iface: "IF1" }, b: { inst: "i1", iface: "IF2" }, linked: false }, { id: "M3", a: { inst: "i4", iface: "IF2" }, b: { inst: "i1", iface: "IF4" } }] };
const rows = [{ id: "M1", state: "ok", notes: [] }, { id: "M2", state: "broken", notes: ["L'interface IF1 de la carte n'existe plus."] }, { id: "M3", state: "check", notes: ["Prise de filet courte."] }];
const names = { i1: "Base", i2: "Carte de puissance", i3: "Carte de contrôle", i4: "Couvercle" }, nameOf = (i) => names[i] || i;

test("the mates sort themselves by health, the worst first, each in the colour of its state", () => {
  const tree = mateTree(asm, rows, nameOf);
  assert.deepEqual(tree.map((g) => [g.key, g.items.map((x) => x.id)]), [["broken", ["M2"]], ["check", ["M3"]], ["ok", ["M1"]]]); assert.deepEqual(MATE_GROUPS.map((g) => g.key), ["broken", "check", "ok"]);
  const m2 = mateFind(tree, "M2"); assert.deepEqual([m2.text, m2.where, m2.color, m2.linked, m2.notes.length], ["Carte de contrôle ↔ Base", "IF1 ↔ IF2", MATE_COLORS.broken, false, 1]);
  assert.equal(new Set(Object.values(MATE_COLORS)).size, 3); assert.equal(mateFind(tree, "M9"), null);
  assert.deepEqual(mateTree(asm, [], nameOf).map((g) => g.items.length), [0, 0, 3], "a mate nobody judged is sound until shown otherwise"); assert.deepEqual(mateTree(null, rows).map((g) => g.items.length), [0, 0, 0]);
  assert.deepEqual(mateTree(asm, [{ id: "M1", state: "bizarre" }]).find((g) => g.key === "ok").items.length, 3, "an unknown state does not lose the mate");
});

test("what is wrong shows on the model by default, what is sound stays quiet ; the selected mate always shows", () => {
  const tree = mateTree(asm, rows, nameOf), ids = (list) => list.map((x) => x.id);
  assert.deepEqual([mateShown({}, "broken"), mateShown({}, "check"), mateShown({}, "ok"), mateShown(null, "ok")], [true, true, false, false]);
  assert.deepEqual(ids(mateLabels(tree, {})), ["M2", "M3"]); assert.deepEqual(ids(mateLabels(tree, { ok: true })), ["M2", "M3", "M1"]); assert.deepEqual(ids(mateLabels(tree, { broken: false, check: false })), []);
  const sel = mateLabels(tree, { broken: false, check: false }, "M1"); assert.deepEqual(sel.map((x) => [x.id, x.selected]), [["M1", true]]);
});
