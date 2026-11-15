/* The load case of a simulation as a tree : numbers, words, colours, and which labels the view shows. */
import test from "node:test";
import assert from "node:assert/strict";
import { BC_COLORS, BC_GROUPS, bcGroups, bcTree, bcFind, bcLabels } from "../../web/js/analysis/fea/bc_tree.js";

const st = (kind, more = {}) => ({ kind, fixed: ["iface:IF1", "face:-Z"], loads: [{ region: "face:+Z", mode: "force", F: 120.04, dir: "-Z", p: 0.1 }, { region: "face:+X", mode: "pressure", F: 100, dir: "-X", p: 0.0925 }],
  power: [{ region: "face:+Z", P: 5 }], fixedT: [{ region: "face:-Z", T: 25 }], thermo: { uniform: true }, ...more });
const names = { "iface:IF1": "Interface IF1 « Fixation »", "face:-Z": "Face dessous (−Z)", "face:+Z": "Face dessus (+Z)", "face:+X": "Face droite (+X)" }, labelOf = (k) => names[k] || k;

test("a type per physics : supports and loads for a structure, sources and temperatures for heat", () => {
  assert.deepEqual(bcGroups(st("structure")).map((g) => g.key), ["fixed", "loads"]); assert.deepEqual(bcGroups(st("thermal")).map((g) => g.key), ["power", "fixedT"]);
  assert.deepEqual(bcGroups(st("thermo")).map((g) => g.key), ["fixed"], "a part at a uniform temperature needs no source"); assert.deepEqual(bcGroups(st("thermo", { thermo: { uniform: false } })).map((g) => g.key), ["fixed", "power", "fixedT"]);
  assert.equal(new Set(Object.values(BC_COLORS)).size, 5, "one colour per type, none shared"); assert.deepEqual(BC_GROUPS.map((g) => g.tag), ["A", "E", "Q", "T"]);
});

test("the tree : each item has its number, its words, where it is and the colour of its type", () => {
  const tree = bcTree(st("structure"), labelOf), [a, e] = tree;
  assert.deepEqual(a.items.map((x) => [x.id, x.text, x.where, x.short, x.color]), [["A1", "Encastrement", "Interface IF1 « Fixation »", "A1", BC_COLORS.fixed], ["A2", "Encastrement", "Face dessous (−Z)", "A2", BC_COLORS.fixed]]);
  assert.deepEqual(e.items.map((x) => [x.id, x.kind, x.text, x.short, x.color]), [["E1", "force", "Force 120 N vers −Z", "E1 · 120 N −Z", BC_COLORS.force], ["E2", "pressure", "Pression 0,093 MPa", "E2 · 0,093 MPa", BC_COLORS.pressure]], "a force is red, a pressure orange");
  const heat = bcTree(st("thermal"), labelOf); assert.deepEqual(heat.map((g) => g.items.map((x) => x.short)), [["Q1 · 5 W"], ["T1 · 25 °C"]]);
  assert.deepEqual([bcFind(tree, "E2").item.region, bcFind(tree, "E2").group.key, bcFind(tree, "E9"), bcFind(tree, null)], ["face:+X", "loads", null, null]);
  assert.equal(bcTree(st("structure"))[0].items[0].where, "iface:IF1", "without names, the key of the region");
  assert.deepEqual(bcTree({ kind: "structure" }).map((g) => g.items.length), [0, 0], "an empty load case is a tree of empty types");
});

test("the labels of the view : a whole type when its eye is open, the selected item always", () => {
  const tree = bcTree(st("structure"), labelOf), ids = (l) => l.map((x) => x.id + (x.selected ? "*" : ""));
  assert.deepEqual(ids(bcLabels(tree)), ["A1", "A2", "E1", "E2"], "everything shows at first");
  assert.deepEqual(ids(bcLabels(tree, { fixed: false })), ["E1", "E2"]); assert.deepEqual(ids(bcLabels(tree, { fixed: false, loads: false })), []);
  assert.deepEqual(ids(bcLabels(tree, { fixed: false, loads: false }, "A2")), ["A2*"], "what is selected stays labelled"); assert.deepEqual(ids(bcLabels(tree, {}, "E1")), ["A1", "A2", "E1*", "E2"]);
});
