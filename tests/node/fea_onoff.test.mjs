/* Simulation : a condition of the load case is put aside (Off) or copied — several cases kept side by side, one solved at a time. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bcTree, bcLabels, isOff, onOf, withOff, copyOf, soloOn, caseWords, supportKey, supportDofs } from "../../web/js/analysis/fea/bc_tree.js";
import { caseIssues, blocking } from "../../web/js/analysis/fea/case_check.js";
import { zoneIssues } from "../../web/js/analysis/fea/refine.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const base = () => ({ kind: "structure", fixed: ["face:-X"], loads: [{ region: "face:+X", mode: "force", F: 100, dir: "-Z", p: 0.1 }], power: [], fixedT: [], cuts: [], conv: { on: true, h: 10, Tamb: 25 }, thermo: { uniform: true, T: 80, Tref: 20 } });

test("on / off : a condition put aside keeps its values, and a support keeps its plain form while it is on and holds everything", () => {
  const load = { region: "face:+X", mode: "force", F: 100, dir: "-Z" }, off = withOff(load, true, "loads");
  assert.equal(isOff(load), false); assert.equal(isOff(off), true); assert.equal(off.F, 100); assert.equal(load.off, undefined, "the condition given is not changed");
  assert.deepEqual(withOff(off, false, "loads"), load, "on again : as it was");
  const s = withOff("face:-X", true, "fixed"); assert.deepEqual(s, { region: "face:-X", off: true }); assert.equal(supportKey(s), "face:-X"); assert.deepEqual(supportDofs(s), [true, true, true]);
  assert.equal(withOff(s, false, "fixed"), "face:-X", "a support that holds everything goes back to its key");
  const part = { region: "face:-X", dofs: [true, false, false] }; assert.deepEqual(withOff(withOff(part, true, "fixed"), false, "fixed"), part, "a support that slides keeps its directions through off and on");
  assert.equal(isOff("face:-X"), false); assert.equal(isOff(null), false);
});

test("on / off : a copy is born off, and one condition is turned on alone among its type", () => {
  const load = { region: "face:+X", mode: "pressure", p: 0.002, ask: ["p"] }, c = copyOf(load);
  assert.equal(c.off, true); assert.equal(c.p, 0.002); c.ask.pop(); assert.deepEqual(load.ask, ["p"], "the copy shares nothing with the first");
  assert.deepEqual(copyOf("face:-X"), { region: "face:-X", off: true });
  const list = soloOn([load, c, { ...load, p: 0.01 }], 1, "loads");
  assert.deepEqual(list.map(isOff), [true, false, true]);
  assert.deepEqual(onOf(list).map(([x, i]) => [x.p, i]), [[0.002, 1]], "what counts, with its place — its number stays E2");
  assert.deepEqual(soloOn(["a", "b"], 0, "fixed"), ["a", { region: "b", off: true }]);
});

test("on / off : the tree marks what is off, asks nothing of it, and labels it only while it is selected", () => {
  const st = base(); st.loads.push({ ...st.loads[0], F: 250, ask: ["F"], off: true });
  const tree = bcTree(st), E = tree.find((g) => g.key === "loads").items;
  assert.deepEqual(E.map((it) => [it.id, it.off, it.ask.length]), [["E1", false, 0], ["E2", true, 0]]);
  assert.deepEqual(bcLabels(tree, {}, null).map((x) => x.id), ["A1", "E1"]);
  assert.deepEqual(bcLabels(tree, {}, "E2").map((x) => x.id), ["A1", "E1", "E2"]);
  const w = caseWords(tree, [{ id: "Z1" }]); assert.equal(w.ids, "A1 E1 Z1"); assert.match(w.text, /^A1 Encastrement · E1 Force 100 N vers −Z · Z1 zone$/); assert.equal(w.off, 1);
});

test("on / off : the checks look only at what is on, and keep the numbers of the tree", () => {
  const st = base(); st.loads = [{ ...st.loads[0], off: true }, { region: "face:+X", mode: "force", F: 0, dir: "-Z" }];
  const list = caseIssues(st);
  assert.ok(!list.some((x) => x.id === "E1"), "E1 is off : nothing is said of it");
  assert.ok(list.some((x) => x.id === "E2" && /force nulle/.test(x.text)), "E2 keeps its number");
  /* an example value that waits does not block once its condition is off */
  const ask = base(); ask.loads[0].ask = ["F"]; assert.equal(blocking(caseIssues(ask)).length, 1);
  ask.loads[0].off = true; ask.loads.push({ region: "face:+X", mode: "force", F: 50, dir: "-Z" }); assert.equal(blocking(caseIssues(ask)).length, 0);
});

test("on / off : a case with everything off is not a case, and the guide says what to turn on again", () => {
  const st = base(); st.loads[0].off = true;
  const e = caseIssues(st).find((x) => x.level === "error"); assert.match(e.text, /Aucun effort.*l'effort est à Off : remettez-le à On/);
  const held = base(); held.fixed = [{ region: "face:-X", off: true }];
  assert.match(caseIssues(held).find((x) => x.level === "error").text, /tenu nulle part.*l'appui est à Off/);
  assert.doesNotMatch(caseIssues({ ...base(), fixed: [] }).find((x) => x.level === "error").text, /à Off/, "nothing to turn on when there is nothing");
  /* a load on a held face : only a support that is on makes it a warning */
  const push = base(); push.loads[0].region = "face:-X"; assert.ok(caseIssues(push).some((x) => /encastrée \(A1\)/.test(x.text)));
  push.fixed = [{ region: "face:-X", off: true }, "face:+Y"]; assert.ok(!caseIssues(push).some((x) => /encastrée/.test(x.text)));
  /* thermal : sources and temperatures follow the same rule */
  const heat = { ...base(), kind: "thermal", power: [{ region: "face:-Z", P: 5, off: true }], fixedT: [{ region: "face:+Z", T: 25 }], conv: { on: false } };
  assert.match(caseIssues(heat).find((x) => x.level === "error").text, /Aucune source de chaleur.*la source est à Off/);
});

test("on / off : a zone put aside is not checked", () => {
  const z = { id: "Z1", shape: "cylinder", axis: 2, size: 10, length: 10, at: [0, 0, 0], ratio: 2, ask: ["size"] };
  assert.equal(zoneIssues([z], null).length, 1); assert.equal(zoneIssues([{ ...z, off: true }], null).length, 0);
});

test("wiring : the solver, the hand estimate and the symbols take only what is on ; each trial remembers its case", () => {
  const fea = read("web/js/modules/fea.js"), tree = read("web/js/modules/fea_tree.js"), zones = read("web/js/modules/fea_zones.js"), result = read("web/js/modules/fea_result.js");
  assert.match(fea, /const supports = \(\) => onOf\(st\.fixed\)/); assert.match(fea, /loads: onOf\(st\.loads\)/); assert.match(fea, /power: onOf\(st\.power\)/); assert.match(fea, /fixedT: onOf\(st\.fixedT\)/);
  assert.match(fea, /zones: liveZones\(\)\.map\(normZone\)/, "a zone that is off is not sent to the solver");
  assert.match(fea, /if \(it\.off\) continue;/, "no symbol for what is off");
  assert.match(fea, /case: \{ \.\.\.ran, name: caseNow\(\) \}/); assert.match(result, /Cas calculé : /); assert.match(result, /"Cas", "Cubes"/);
  assert.match(tree, /onOff\(!it\.off/); assert.match(tree, /Dupliquer \$\{it\.id\}/); assert.match(zones, /Dupliquer la zone/);
  assert.match(read("web/js/core/dom.js"), /export function onOff\(/); assert.match(read("web/css/app.css"), /\.switch\.on \{/);
});
