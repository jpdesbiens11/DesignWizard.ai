/* The AI round trip on three more artefacts (point 2 of the roadmap) : the drawing sheet, the load case, the isolation settings — the
   document each screen hands over, what is wrong with an answer, how it is written into the project, and how the journal undoes it.
     node --test tests/node/ai_more.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moreKey, moreLabel, moreDoc, moreCheck, moreApply, MORE_HELP, SHEET_KEYS } from "../../web/js/core/ai_more.js";
import { snapshotLists, journalChange, revertEntry } from "../../web/js/core/ai_door.js";
import { aiTargetOf } from "../../web/js/core/stairs.js";
import { aiRead } from "../../web/js/core/ai_loop.js";
import { toDwiz } from "../../web/js/core/dwiz.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../../web/js/demo/demo_hvb.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const project = () => ({ dw: "project/1", id: "p", name: "P", parts: clone(DEMO_HVB_PARTS), assemblies: [clone(DEMO_HVB_ASSEMBLY)], boards: [{ ...demoBoard(false), id: "B1", name: "Carte" }],
  drawing: { drawnBy: "JP", words: { "Busbar": "Busbar" } }, log: [] });
const blocks = (notes) => notes.filter((n) => n.severity === "block").map((n) => n.text);
/** As the dialog does : the document travels as text, comes back, is checked, then written inside one step — with the journal around it. */
function roundTrip(p, key, change) {
  const doc = aiRead(toDwiz(moreDoc(p, key))); change(doc);
  const notes = moreCheck(p, key, doc); if (blocks(notes).length) return { notes };
  const before = snapshotLists(p); moreApply(p, key, doc); const entry = journalChange(before, p, { ask: "essai" });
  return { notes, entry };
}

test("the keys : a sheet of a part or an assembly, the case of a part or an assembly, the isolation of an assembly or a board — and each screen hands over its own", () => {
  const p = project(), part = p.parts[0].id;
  assert.deepEqual(moreKey(`drawing:part:${part}`, p), { kind: "drawing", of: "part", id: part }); assert.deepEqual(moreKey("case:DEMO-HVB", p), { kind: "case", of: "assembly", id: "DEMO-HVB" });
  assert.deepEqual(moreKey("iso:board:B1", p), { kind: "iso", of: "board", id: "B1" });
  for (const bad of ["drawing:board:B1", "iso:part:" + part, "case:NONE", "drawing:part:NONE", "part:" + part]) assert.equal(moreKey(bad, p), null, bad);
  assert.match(moreLabel(p, moreKey("iso:assembly:DEMO-HVB", p)), /^l'isolation de « HV busbar demo »$/);
  assert.equal(aiTargetOf("drawings", [part], p).key, `drawing:part:${part}`); assert.equal(aiTargetOf("fea", ["DEMO-HVB"], p).key, "case:DEMO-HVB"); assert.equal(aiTargetOf("creepage", ["board", "B1"], p).key, "iso:board:B1");
  for (const k of ["drawing", "case", "iso"]) assert.ok(MORE_HELP[k].length >= 2, k);
});

test("the drawing sheet : the title block of the project, the English of every text the sheet writes, the section, the classes of dimensions, the notes", () => {
  const p = project(), s = p.parts[0], key = `drawing:part:${s.id}`, doc = moreDoc(p, key);
  assert.equal(doc.dw, "drawing/1"); assert.equal(doc.id, s.id); assert.deepEqual(doc.sheet, { drawnBy: "JP" }); assert.ok(Object.values(doc.words).includes(""), "the texts without English come empty, for the AI to fill");
  assert.equal(doc.section, null); assert.deepEqual(doc.characteristics, {});
  const { entry } = roundTrip(p, key, (d) => { d.sheet.approvedBy = "M. Tremblay"; d.sheet.projection = "first"; d.notes = ["BREAK ALL EDGES 0.2"]; d.section = { axis: "y", at: 5 }; d.characteristics = { D1: "sc" };
    for (const t of Object.keys(d.words)) if (!d.words[t]) d.words[t] = `${t} EN`; });
  assert.equal(p.drawing.approvedBy, "M. Tremblay"); assert.equal(p.drawing.projection, "first"); assert.equal(p.drawing.drawnBy, "JP");
  assert.deepEqual(p.parts[0].notes, ["BREAK ALL EDGES 0.2"]); assert.deepEqual(p.parts[0].section, { axis: "y", at: 5 }); assert.deepEqual(p.parts[0].characteristics, { D1: "sc" });
  assert.ok(Object.keys(p.drawing.words).length > 1);
  assert.deepEqual(entry.modified.map((m) => `${m.kind}:${m.id}`).sort(), ["part:" + s.id, "sheet:cartouche"].sort(), "the journal holds the part and the title block");
  revertEntry(p, entry.id); assert.equal(p.drawing.approvedBy, undefined); assert.equal(p.drawing.projection, undefined); assert.equal(p.parts[0].section, undefined, "back to before, title block and part");
  const bad = moreDoc(project(), key); bad.sheet.projection = "second"; bad.characteristics = { D1: "gold" }; bad.notes = "one note";
  assert.equal(blocks(moreCheck(project(), key, bad)).length, 3); assert.deepEqual(SHEET_KEYS.slice(0, 2), ["projection", "hidden"]);
});

test("the load case : the case in use and the others by name ; a wrong kind or two cases of the same name is refused ; the journal takes it back", () => {
  const p = project(), key = "case:DEMO-HVB", doc = moreDoc(p, key);
  assert.equal(doc.dw, "loadcase/1"); assert.equal(doc.kind, "structure"); assert.equal(doc.of, "assembly");
  const { entry } = roundTrip(p, key, (d) => { d.kind = "thermal"; d.name = "Été"; d.others = [{ name: "Hiver", kind: "thermal", conv: { on: true, h: 10, Tamb: -40 } }]; });
  const c = p.cases.find((x) => x.id === "DEMO-HVB"); assert.equal(c.kind, "thermal"); assert.equal(c.name, "Été"); assert.equal(c.others[0].name, "Hiver"); assert.equal(c.others[0].conv.Tamb, -40);
  assert.ok(!("dw" in c) && !("title" in c) && !("of" in c), "only the case is kept, not the wrapping");
  assert.deepEqual(entry.created, [{ kind: "case", id: "DEMO-HVB" }]); revertEntry(p, entry.id); assert.ok(!(p.cases || []).some((x) => x.id === "DEMO-HVB"), "a case the answer created goes");
  const bad = moreDoc(project(), key); bad.kind = "magnetic"; bad.others = [{ name: "Cas 1", kind: "structure" }];
  assert.equal(blocks(moreCheck(project(), key, { ...bad, name: "Cas 1" })).length, 2);
});

test("the isolation : the potentials, the parameters, the levels of the pairs, the roles ; the results of the last analysis go — they no longer hold", () => {
  const p = project(), key = "iso:assembly:DEMO-HVB", doc = moreDoc(p, key);
  assert.equal(doc.dw, "isolation/1"); assert.ok(doc.nets.some((n) => n.name === "HV+" && n.voltage === 400)); assert.equal(doc.params.altitude_m, 3000); assert.equal(doc.params.voltage_factor, 1);
  p.assemblies[0].isolation.results = [{ a: "HV+", b: "LV sense", ok: true }];
  const { entry, notes } = roundTrip(p, key, (d) => { d.params.pollution_degree = 3; d.levels["HV+|Chassis"] = "basic"; d.nets.find((n) => n.name === "HV+").voltage = 800; });
  assert.ok(notes.some((n) => /résultats de la dernière analyse seront retirés/.test(n.text)));
  const iso = p.assemblies[0].isolation; assert.equal(iso.params.pollution_degree, 3); assert.equal(iso.levels["HV+|Chassis"], "basic"); assert.equal(iso.nets.find((n) => n.name === "HV+").voltage, 800); assert.equal(iso.results, undefined);
  revertEntry(p, entry.id); assert.equal(p.assemblies[0].isolation.params.pollution_degree, 2); assert.equal(p.assemblies[0].isolation.results.length, 1);
  const bad = moreDoc(project(), key); bad.params.pollution_degree = 5; bad.params.ovc = "V"; bad.levels["HV+|Chassis"] = "double"; bad.overrides = { "i1/main": { kind: "magnet" } };
  assert.equal(blocks(moreCheck(project(), key, bad)).length, 4);
  const b = moreDoc(project(), "iso:board:B1"); assert.equal(b.params.level, "functional"); assert.ok(!("nets" in b), "a board's potentials come from the PCBA");
  assert.ok(moreCheck(project(), "iso:board:B1", b).some((n) => /viennent du PCBA/.test(n.text)));
});

test("wired : the common loop opens them, the Simulation reads its case again after an answer, the journal keeps the cases and the title block", () => {
  const read = (f) => readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8");
  assert.match(read("modules/ai_loop.js"), /moreTarget\(key\)/); assert.match(read("modules/ai_loop.js"), /\{ external: true \}/);
  assert.match(read("modules/fea.js"), /e\.undo \|\| e\.external/); assert.match(read("core/ai_door.js"), /case: "cases"/);
});
