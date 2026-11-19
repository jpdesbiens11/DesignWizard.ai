/* The load case of a simulation is kept in the project : written at each change as one undoable step, read back at the next
   visit, carried by the .dwiz text and by the team merge — analysis/fea/case_store.js and its wiring in modules/fea.js. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blankCase, CASE_KEYS, caseFrom, isBlankCase, sameCase, caseOf, takeCase, withCase, caseNote } from "../../web/js/analysis/fea/case_store.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { artefacts, labelOf } from "../../web/js/core/team.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const project = () => ({ dw: "project/1", id: "p1", name: "Essai", parts: [{ id: "DW-001", name: "Bride" }, { id: "DW-002", name: "Capot" }], assemblies: [{ id: "ASM-1", name: "Ensemble", instances: [], mates: [] }], log: [] });
/* the state of the screen : its case, and what belongs to the visit only */
const screen = () => ({ ...blankCase(), target: { type: "part", id: "DW-001" }, sel: "E1", view: "result", show: { zones: false }, quantity: "fs" });
const set = (st) => { st.fixed = ["face:-X", { region: "place:P1", dofs: [true, false, true], off: true }]; st.loads = [{ region: "face:+X", mode: "force", F: 250, dir: "-Z", p: 0.1 }, { region: "place:P1", mode: "pressure", F: 100, dir: [0.6, 0, -0.8], p: 0.004, off: true, ask: ["p"] }];
  st.cuts = [{ axis: 1, at: 75, keep: 1, bc: "sym" }, { axis: 1, at: 60, keep: -1, bc: "free", off: true }]; st.zones = [{ id: "Z1", shape: "cyl", axis: 2, size: 12, length: 20, at: [10, 20.5, 3], ratio: 3, off: true }];
  st.places = { "place:P1": { label: "Face 3", items: [{ kind: "face", body: 0, faceId: 3, sig: "a1b2" }], region: { any: [{ tris: new Float32Array(9000) }] }, gone: false } }; st.placeSeq = 1; st.cells = 4000; return st; };

test("case : a blank case, and what a screen holds of its case", () => {
  assert.deepEqual(CASE_KEYS, ["kind", "cells", "fsTarget", "fixed", "loads", "power", "fixedT", "conv", "thermo", "cuts", "zones", "places", "placeSeq", "sensors"]);      // sensors : the instruments, read on a result (fea_sensors.test.mjs)
  assert.ok(isBlankCase(blankCase())); assert.ok(isBlankCase(screen()), "the target, the view, what is selected are not the case");
  const st = set(screen()), c = caseFrom(st);
  assert.deepEqual(Object.keys(c), CASE_KEYS); assert.equal(c.target, undefined); assert.equal(c.sel, undefined);
  assert.deepEqual(c.places["place:P1"], { label: "Face 3", items: [{ kind: "face", body: 0, faceId: 3, sig: "a1b2" }] }, "what the screen worked out on the mesh is not written");
  assert.ok(JSON.stringify(c).length < 2000, "and the triangles of a place never reach the file");
  c.loads[0].F = 1; assert.equal(st.loads[0].F, 250, "a copy : the screen keeps its own");
  assert.ok(!isBlankCase(st)); assert.ok(sameCase(st, c) === false && sameCase(st, caseFrom(st)));
  assert.ok(!isBlankCase({ ...blankCase(), cells: 3500 }), "a setting that was changed is worth keeping too");
});

test("case : written in the project, read back, and taken away when nothing is left", () => {
  const p = project(), st = set(screen());
  assert.equal(caseOf(p, "DW-001"), null); assert.equal(withCase(p, "DW-001", screen()), false, "a case nobody touched is not written"); assert.equal(p.cases, undefined);
  assert.equal(withCase(p, "DW-001", st), true); assert.equal(p.cases.length, 1); assert.equal(p.cases[0].id, "DW-001"); assert.equal(p.cases[0].loads[1].off, true, "what is Off is kept, as Off");
  assert.equal(withCase(p, "DW-001", st), false, "the same case again changes nothing : no step to undo");
  /* a second target has its own case ; the first one stays in its place when it changes */
  const other = { ...blankCase(), kind: "thermal", power: [{ region: "face:-Z", P: 5 }] }; assert.equal(withCase(p, "ASM-1", other), true); assert.deepEqual(p.cases.map((c) => c.id), ["DW-001", "ASM-1"]);
  st.loads[0].F = 300; assert.equal(withCase(p, "DW-001", st), true); assert.deepEqual(p.cases.map((c) => c.id), ["DW-001", "ASM-1"]); assert.equal(p.cases[0].loads[0].F, 300);
  /* read back into a fresh screen : everything of the case, nothing else */
  const fresh = { target: { id: "DW-001" }, sel: "A2", view: "model" }; takeCase(fresh, caseOf(p, "DW-001"));
  assert.ok(sameCase(fresh, st)); assert.equal(fresh.sel, "A2"); assert.equal(fresh.zones[0].off, true); assert.deepEqual(fresh.loads[1].dir, [0.6, 0, -0.8]);
  caseOf(p, "DW-001").loads[0].F = 9; assert.equal(p.cases[0].loads[0].F, 300, "caseOf hands out a copy");
  takeCase(fresh, null); assert.ok(isBlankCase(fresh), "no case kept : a blank one");
  /* emptied : it leaves the file ; the last one takes the list with it */
  assert.equal(withCase(p, "DW-001", screen()), true); assert.deepEqual(p.cases.map((c) => c.id), ["ASM-1"]);
  assert.equal(withCase(p, "ASM-1", blankCase()), true); assert.equal(p.cases, undefined);
});

test("case : the case of a part that is gone leaves with it", () => {
  const p = project(); withCase(p, "DW-001", set(screen())); withCase(p, "DW-002", { ...blankCase(), cells: 5000 });
  p.parts = p.parts.filter((x) => x.id !== "DW-002"); withCase(p, "DW-001", set(screen()));
  assert.deepEqual(p.cases.map((c) => c.id), ["DW-001"]);
});

test("case : what a kept case holds, in a few words", () => {
  assert.equal(caseNote(caseFrom(set(screen()))), "2 appuis (1 à Off) · 2 efforts (1 à Off) · 1 zone (1 à Off) · 2 plans (1 à Off)");
  assert.equal(caseNote({ ...blankCase(), fixed: ["face:-X"], power: [{ region: "face:-Z", P: 5 }] }), "1 appui · 1 source"); assert.equal(caseNote(blankCase()), ""); assert.equal(caseNote(null), "");
});

test("case : it travels in the .dwiz text of the project and comes back the same", () => {
  const p = project(); withCase(p, "DW-001", set(screen()));
  const text = toDwiz(p), back = fromDwiz(text);
  assert.match(text, /^case DW-001 structure cells=4000 fsTarget=1\.5$/m); assert.match(text, /# Les cas de charge de la Simulation/);
  assert.deepEqual(back.cases, p.cases);
});

test("case : it is an artefact of the team — merged under the id of its part, with a name", () => {
  const p = project(); withCase(p, "DW-001", set(screen()));
  assert.ok(artefacts(p).has("case:DW-001")); assert.match(labelOf(p, "case:DW-001"), /^Cas de charge DW-001/);
});

test("wiring : the Simulation reads its case from the project, writes each change, and reads an undo back", () => {
  const f = read("web/js/modules/fea.js"), r = read("web/js/modules/fea_result.js");
  assert.match(f, /takeCase\(st, caseOf\(p, st\.target\.id\)\);/, "at each visit");
  assert.match(f, /takeCase\(st, caseOf\(store\.project, id\)\); loadGeometry\(\);/, "and when another part is chosen");
  assert.match(f, /const saveCase = \(\) => \{ if \(alive && st\.target\) store\.commit\(`Cas de charge : \$\{st\.target\.id\}`, \(x\) => \{ withCase\(x, st\.target\.id, st\); \}\); \};/);
  assert.match(f, /const outdate = \(\) => \{ if \(last\) last\.stale = true; st\.view = "model"; saveCase\(\); \};/, "whatever changes the case goes through here");
  assert.match(f, /store\.on\("change", \(e\) => \{ if \(!alive \|\| !e \|\| !e\.undo \|\| !geo\) return;/); assert.match(f, /return \(\) => \{ alive = false; unsee\(\);/);
  assert.match(f, /if \(!\(st\.fixed\.length \|\| st\.loads\.length \|\| st\.power\.length \|\| st\.fixedT\.length\)/, "a first case is invented only when nothing is set");
  assert.equal((r.match(/o\.saveCase\(\); o\.repaint\(\);/g) || []).length, 2, "the safety factor aimed at is kept too");
  assert.doesNotMatch(read("web/js/analysis/fea/case_store.js"), /from "/, "the store of the cases imports nothing");
});
