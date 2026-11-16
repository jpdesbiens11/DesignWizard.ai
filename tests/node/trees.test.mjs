// Lists as trees : the pairs of nets of the Isolation by verdict, the dimensions of a drawing by nature, the findings of
// a board by severity — every group with its colour, every item with its few words, what is wrong first.
import test from "node:test";
import assert from "node:assert/strict";
import { PAIR_GROUPS, DIM_GROUPS, FINDING_GROUPS, STATE_COLORS, pairTree, pairState, dimTree, dimClasses, findingTree, treeShown, treeFind } from "../../web/js/core/trees.js";

const req = (u, c) => ({ u_rms: u, clearance_mm: c });

test("every group of a tree has its words and a colour of its own", () => {
  for (const G of [PAIR_GROUPS, DIM_GROUPS, FINDING_GROUPS]) { assert.ok(G.every((g) => g.key && g.fr && g.tip && /^#[0-9a-f]{6}$/.test(g.color))); assert.equal(new Set(G.map((g) => g.color)).size, G.length); assert.equal(new Set(G.map((g) => g.key)).size, G.length); }
  assert.deepEqual(PAIR_GROUPS.map((g) => g.key), ["fail", "check", "todo", "ok"], "what fails comes first"); assert.deepEqual(FINDING_GROUPS.map((g) => g.key), ["error", "warn", "info"]);
  assert.equal(treeShown(null, "fail"), true); assert.equal(treeShown({}, "ok"), false, "what is sound stays quiet"); assert.equal(treeShown({ ok: true }, "ok"), true); assert.equal(treeShown({ fail: false }, "fail"), false, "the designer has the last word");
});

test("Isolation : the pairs of nets are filed by verdict, with what was measured against what is required", () => {
  const pairs = [{ a: "HV+", b: "HV-", level: "basic", req: req(400, 3) }, { a: "HV+", b: "PE", level: "reinforced", req: req(400, 5.5) }, { a: "HV-", b: "PE", level: "reinforced", req: req(400, 5.5) }, { a: "LV", b: "PE", level: "functional", req: req(12, 0.2) }];
  const before = pairTree(pairs, null, { levels: { basic: "Basic", reinforced: "Reinforced", functional: "Functional" } });
  assert.deepEqual(before.map((g) => g.items.length), [0, 0, 4, 0], "nothing is judged before the analysis"); assert.equal(before[2].items[0].sub, "400 V · Basic — clearance ≥ 3.00 mm");
  const results = [{ a: "HV-", b: "HV+", verdict: { ok: false, clr: 2.1, clrReq: 3, crp: 4, crpReq: 5 } }, { a: "HV+", b: "PE", verdict: { ok: true, clr: 8, clrReq: 5.5, crpNone: true } }, { a: "HV-", b: "PE", error: "maillage ouvert" }, { a: "LV", b: "PE", verdict: { ok: null, clr: null, clrCapped: true, clrReq: 0.2, crp: null, crpReq: null } }];
  const t = pairTree(pairs, results);
  assert.deepEqual(t.map((g) => [g.key, g.items.map((x) => x.text)]), [["fail", ["HV+ ↔ HV-"]], ["check", ["HV- ↔ PE", "LV ↔ PE"]], ["todo", []], ["ok", ["HV+ ↔ PE"]]], "the order of the nets in a result does not matter");
  assert.equal(t[0].items[0].sub, "clr 2.10 / 3.00 mm · crp 4.00 / 5.00 mm"); assert.equal(t[3].items[0].sub, "clr 8.00 / 5.50 mm · crp aucun chemin"); assert.equal(t[1].items[0].sub, "maillage ouvert"); assert.match(t[1].items[1].sub, /clr > plafond \/ 0\.20 mm · crp — \/ — mm/);
  assert.equal(t[0].items[0].color, STATE_COLORS.fail); assert.equal(treeFind(t, "HV+|PE").state, "ok"); assert.equal(treeFind(t, "nope"), null);
  assert.deepEqual([pairState(null), pairState({ error: "x" }), pairState({ verdict: { ok: false } }), pairState({ verdict: { ok: true } }), pairState({ verdict: { ok: null } })], ["todo", "check", "fail", "ok", "check"]);
  assert.equal(pairTree(pairs, results, { fmt: (v, d) => Number(v).toFixed(d).replace(".", ",") })[0].items[0].sub, "clr 2,10 / 3,00 mm · crp 4,00 / 5,00 mm", "the screen brings its own way of writing a number");
});

test("Drawings : the dimensions are filed by nature, each with its balloon, where it is and its class", () => {
  const dims = [{ key: "bbox:X", n: 1, kind: "overall", cls: "normal", text: "120", label: "Longueur" }, { key: "iface:IF1:u", n: 2, kind: "pattern", cls: "sc", text: "15", label: "Fixation — depuis le bord", basic: true },
    { key: "hole:a", n: 3, kind: "hole", cls: "csc", text: "4× Ø 3,4", label: "trou de passage", table: "holes" }, { key: "param:r", n: 4, kind: "detail", cls: "ref", text: "R 2", label: "Rayon" }, { key: "param:t", n: 5, kind: "param", cls: "normal", text: "3", label: "Épaisseur", table: "def" },
    { key: "iface:IF1:d", n: 6, kind: "iface", cls: "normal", text: "Ø 3,4", label: "Fixation — Ø", table: "def" }];
  const t = dimTree(dims, ["bbox:X", "iface:IF1:u", "param:r"], (d) => `« ${d.text} »`);
  assert.deepEqual(t.map((g) => [g.key, g.items.map((x) => x.n)]), [["overall", [1]], ["pattern", [2]], ["hole", [3]], ["detail", [4]], ["def", [5, 6]]], "parameters and interface values are both definitions");
  assert.deepEqual(t.flatMap((g) => g.items.map((x) => x.where)), ["sur une vue", "sur une vue", "au tableau des trous", "sur une vue", "au tableau des cotes de définition", "au tableau des cotes de définition"]);
  assert.deepEqual(t.flatMap((g) => g.items.map((x) => (x.chip ? x.chip.text : ""))), ["", "SC", "CSC", "REF", "", ""], "a class shows as a chip ; a normal dimension has none"); assert.equal(t[0].items[0].text, "« 120 »"); assert.equal(t[1].items[0].basic, true);
  assert.deepEqual(dimClasses(dims), { normal: 3, ref: 1, sc: 1, csc: 1 }); assert.deepEqual(dimTree([], []).map((g) => g.items.length), [0, 0, 0, 0, 0]); assert.equal(treeFind(t, "hole:a").cls, "csc");
});

test("Board : the findings of the checks are filed by severity, each with where it is and what to do", () => {
  const F = [{ rule: "PCBA-03", title: "Trace width", message: "0,10 mm sous 0,15 mm", severity: "warn", at: [10, 5] }, { rule: "ERC-03", title: "Unconnected pin", message: "U1.4", severity: "error" }, { rule: "PCBA-33", title: "Fiducials", message: "aucune mire", severity: "info" }, { rule: "X", title: "?", message: "", severity: "odd" }];
  const t = findingTree(F, (f) => (f.rule === "PCBA-03" ? "élargir la piste" : ""));
  assert.deepEqual(t.map((g) => [g.key, g.items.map((x) => x.id)]), [["error", [1]], ["warn", [0]], ["info", [2, 3]]], "an unknown severity is a remark"); assert.equal(t[1].items[0].text, "PCBA-03 · Trace width"); assert.equal(t[1].items[0].hint, "élargir la piste");
  assert.deepEqual(t[1].items[0].at, [10, 5]); assert.equal(t[0].items[0].at, null, "a finding of the schematic has no place on the board"); assert.equal(treeFind(t, 2).finding, F[2]); assert.deepEqual(findingTree(null).map((g) => g.items.length), [0, 0, 0]);
});
