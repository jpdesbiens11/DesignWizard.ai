// Tests of the board of the DFx page : the items of the project, what the top counts, what each filter shows.
// Run from the repository root:  node --test tests/node/dfx_board.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { DFX_FILTERS, DFX_STATES, PROCESS_ICON, dfxItems, dfxCounts, dfxView, dfxHash, ruleOf, measureText, fixOutcome } from "../../web/js/analysis/dfx_board.js";
import { summarize } from "../../web/js/analysis/dfx_core.js";
import { RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { PROCESSES } from "../../web/js/cad/materials.js";

const F = (id, severity, extra = {}) => ({ id, severity, title: `titre ${id}`, message: `message ${id}`, value: null, limit: null, unit: "", fix: null, ...extra });
const part = (id, process, findings, family) => ({ spec: { id, name: `Pièce ${id}`, process, family }, res: { findings, summary: summarize(findings) } });
const RUN = { parts: [part("P-OK", "cnc_milling", [F("GEN-09", "info")]), part("P-WARN", "sheet_metal", [F("SM-02", "warn", { value: 1.2, limit: 1.5, unit: "mm", fix: { label: "Rayon 1,5 mm", patch: [{ op: "set", path: "folded.r", value: 1.5 }] } }), F("GEN-01", "info")]),
  part("P-BAD", "injection_molding", [F("IM-01", "error"), F("IM-04", "warn"), F("IM-07", "warn")]), part("C-PCB", "pcb", [], "pcb"), part("X-EXT", "extrusion_al", [F("EX-03", "error")], "extrusion")],
  asms: [{ asm: { id: "ASM", name: "Ensemble" }, res: { findings: [F("DFA-03", "warn")], summary: summarize([F("DFA-03", "warn")]), metrics: { instances: 4, dfaIndex: 0.62 } } }, { asm: { id: "ASM-KO", name: "Cassé" }, res: { findings: [], summary: null, metrics: {} }, error: "pièce introuvable" }] };

test("the items of the board : what is to fix first, then to check, then what is in order", () => {
  const items = dfxItems(RUN);
  assert.deepEqual(items.map((x) => `${x.key}:${x.state}`), ["part:P-BAD:fail", "part:X-EXT:fail", "assembly:ASM-KO:fail", "part:P-WARN:review", "assembly:ASM:review", "part:C-PCB:pass", "part:P-OK:pass"]);
  const bad = items[0]; assert.deepEqual([bad.errors, bad.warnings, bad.infos, bad.score, bad.name, bad.process], [1, 2, 0, 70, "Pièce P-BAD", "injection_molding"]); assert.deepEqual(bad.points.map((p) => [p.id, p.item, p.n]), [["IM-01", "part:P-BAD", 0], ["IM-04", "part:P-BAD", 1], ["IM-07", "part:P-BAD", 2]]);
  const ko = items[2]; assert.equal(ko.points.length, 1); assert.match(ko.points[0].message, /pièce introuvable/); assert.equal(ko.score, null); assert.deepEqual(items[4].metrics, { instances: 4, dfaIndex: 0.62 });
  assert.equal(items[6].state, "pass", "a part with advice only is in order"); assert.deepEqual(dfxItems(null), []); assert.deepEqual(dfxItems({}), []);
});

test("the counts of the top of the page, and what a click on each of them shows", () => {
  const items = dfxItems(RUN), c = dfxCounts(items);
  assert.deepEqual(c, { error: 3, warn: 4, info: 2, todo: 7, pass: 2, items: 7, score: Math.round((99 + 94 + 70 + 100 + 80) / 5) });
  const keys = (f, only) => dfxView(items, f, only).map((x) => `${x.ref}:${x.points.map((p) => p.id).join("+")}`);
  assert.deepEqual(keys("todo"), ["P-BAD:IM-01+IM-04+IM-07", "X-EXT:EX-03", "ASM-KO:ASM-00", "P-WARN:SM-02", "ASM:DFA-03"], "to settle : errors and warnings, never the advice, never what is in order");
  assert.deepEqual(keys("error"), ["P-BAD:IM-01", "X-EXT:EX-03", "ASM-KO:ASM-00"]); assert.deepEqual(keys("warn"), ["P-BAD:IM-04+IM-07", "P-WARN:SM-02", "ASM:DFA-03"]); assert.deepEqual(keys("info"), ["P-WARN:GEN-01", "P-OK:GEN-09"]);
  assert.deepEqual(keys("pass"), ["C-PCB:", "P-OK:"], "in order : a line per item, no list"); assert.equal(keys("all").length, 7); assert.deepEqual(keys("nope"), []);
  assert.deepEqual(keys("todo", "P-WARN"), ["P-WARN:SM-02"]); assert.deepEqual(keys("todo", "assembly:ASM"), ["ASM:DFA-03"]); assert.deepEqual(keys("todo", "P-OK"), [], "opened on a part in order : nothing to settle");
  for (const [k] of DFX_FILTERS) assert.equal(dfxView(items, k).reduce((n, x) => n + x.points.length, 0), { todo: c.todo, error: c.error, warn: c.warn, info: c.info, pass: 0, all: c.todo + c.info }[k], `the count of « ${k} » is what its click shows`);
  assert.deepEqual(dfxCounts([]), { error: 0, warn: 0, info: 0, todo: 0, pass: 0, items: 0, score: null }); assert.deepEqual(Object.keys(DFX_STATES), ["fail", "review", "pass"]);
});

test("where a point is settled, why its rule exists, what was measured", () => {
  const items = dfxItems(RUN), at = (ref) => dfxHash(items.find((x) => x.ref === ref));
  assert.deepEqual([at("P-BAD"), at("C-PCB"), at("X-EXT"), at("ASM")], ["#/parts/P-BAD/dfx", "#/pcb/C-PCB", "#/extrusion/X-EXT", "#/assembly/ASM"]); assert.equal(dfxHash({ kind: "part", ref: "A B/1" }), "#/parts/A%20B%2F1/dfx");
  const some = RULEBOOK.find((b) => (b.rules || []).length).rules[0]; assert.equal(ruleOf(RULEBOOK, some.id).id, some.id); assert.ok(ruleOf(RULEBOOK, some.id).why.length > 10); assert.equal(ruleOf(RULEBOOK, "NOPE-99"), null); assert.equal(ruleOf(null, "X"), null);
  const fr = (v) => String(v).replace(".", ",");
  assert.equal(measureText(F("A", "warn", { value: 1.2, limit: 1.5, unit: "mm" }), fr), "Mesuré 1,2 mm · limite 1,5 mm"); assert.equal(measureText(F("A", "warn", { value: 3 })), "Mesuré 3"); assert.equal(measureText(F("A", "warn", { value: "M3", limit: "M4" })), "Mesuré M3 · limite M4"); assert.equal(measureText(F("A", "warn")), "");
  for (const p of Object.keys(PROCESSES)) assert.ok(PROCESS_ICON[p], `a pictogram for the process ${p}`);
});

test("a fix is tried before it is applied : one that creates a point to fix is held back", () => {
  const point = F("IF-03", "warn", { feature: "posts" }), before = [point, F("MLD-03", "warn", { iface: "IF1.1" }), F("MLD-01", "error", { feature: "wall" })];
  const good = fixOutcome(before, [before[1], before[2]], point); assert.deepEqual([good.ok, good.solved, good.added.length], [true, true, 0], "the point is gone, the error that was there before does not count against the fix");
  const bad = fixOutcome(before, [before[1], before[2], F("MLD-01", "error", { feature: "posts" })], point); assert.deepEqual([bad.ok, bad.solved, bad.added.map((f) => f.feature)], [false, true, ["posts"]]);
  const vain = fixOutcome(before, before, point); assert.deepEqual([vain.ok, vain.solved], [true, false]); assert.deepEqual(fixOutcome(null, null, null), { ok: true, solved: false, added: [] });
  assert.equal(fixOutcome(before, [F("GEN-01", "warn"), F("GEN-02", "info")], point).ok, true, "new advice or new checks do not hold a fix back");
});
