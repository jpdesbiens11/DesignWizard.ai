/* The ecosystem of a product, packed for an AI (core/eco.js) : the map of what depends on what, what a change disturbs, where the checks stand,
   the frame of the design — the rules the tool checks and those of the project, On / Off —, the request framed by a screen, the files. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ecoMap, ecoImpact, ecoChecks, ecoFrame, ecoBrief, ecoFiles, ecoGuide, ecoRows, rulesOf, addRule, copyRule, setRule, removeRule, EDGE_KINDS } from "../../web/js/core/eco.js";
import { RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const demo = () => { const p = JSON.parse(JSON.stringify(DEMO_DRIVE)); p.physics = [{ id: "PH1", model: "beam", part: "DRV-BASE", name: "Poutre de la base" }]; p.cases = [{ id: "DRV-BASE", kind: "structure" }];
  p.boards = [{ id: "PCBA-001", name: "Carte de puissance", part: "DRV-PWR-PCB", blocks: [] }]; p.software = [{ id: "BMS-SW", name: "Logiciel", objects: [], wires: [] }];
  p.parts.push({ dw: "part/1", id: "IMP", name: "Connecteur importé", process: "purchased", step: { text: "X".repeat(5000), file: "c.step" } });
  p.history = { v: 1, head: "P1", objects: { a: "{}" }, points: [] }; return p; };

test("the map : an assembly mounts its parts, parts share interface keys and mates, a board has its twin, an analysis and a case read a part", () => {
  const m = ecoMap(demo()), has = (from, to, kind) => m.edges.some((e) => e.from === from && e.to === to && e.kind === kind);
  assert.equal(m.nodes.filter((n) => n.kind === "part").length, 9); assert.ok(m.nodes.some((n) => n.key === "software:BMS-SW")); assert.ok(m.nodes.some((n) => n.key === "board:PCBA-001"));
  assert.ok(has("assembly:DRV-ASM", "part:DRV-BASE", "mounts")); assert.ok(has("part:DRV-BASE", "part:DRV-PWR-PCB", "key")); assert.ok(has("part:DRV-PWR-PCB", "part:DRV-BASE", "mate"));
  assert.ok(has("part:DRV-PWR-PCB", "board:PCBA-001", "twin")); assert.ok(has("analysis:PH1", "part:DRV-BASE", "reads")); assert.ok(has("case:DRV-BASE", "part:DRV-BASE", "case"));
  for (const e of m.edges) { assert.ok(EDGE_KINDS[e.kind], e.kind); assert.ok(m.nodes.some((n) => n.key === e.from) && m.nodes.some((n) => n.key === e.to), "a link joins two artefacts that exist"); }
  assert.equal(m.nodes.find((n) => n.key === "part:IMP").nature, "Imported (STEP)", "a part carries the colour of the way it is made");
  assert.deepEqual(ecoMap({}), { nodes: [], edges: [] });
});

test("what a change disturbs : near and far, both ways along a shared interface", () => {
  const m = ecoMap(demo()), at = (k) => new Map(ecoImpact(m, k).map((x) => [x.key, x]));
  const base = at("part:DRV-BASE");
  for (const k of ["assembly:DRV-ASM", "part:DRV-PWR-PCB", "part:DRV-COVER", "part:DRV-HEATSINK", "analysis:PH1", "case:DRV-BASE"]) assert.equal(base.get(k).depth, 1, k);
  assert.equal(base.get("part:DRV-ISO").depth, 2, "the insulator sits on the heat sink, which sits on the base");
  assert.ok(at("board:PCBA-001").has("part:DRV-PWR-PCB"), "a board changed moves its mechanical twin");
  assert.ok(at("part:DRV-PWR-PCB").has("board:PCBA-001"));
  assert.equal(at("assembly:DRV-ASM").size, 0, "nothing depends on the top assembly");
});

test("the rules of the project : On / Off, a copy born Off, rewritten, removed", () => {
  const p = demo(); assert.deepEqual(rulesOf(p), []);
  const r = addRule(p, "  Le boîtier reste en aluminium moulé  "); assert.deepEqual(r, { id: "R1", text: "Le boîtier reste en aluminium moulé", on: true });
  const c = copyRule(p, "R1"); assert.equal(c.id, "R2"); assert.equal(c.on, false, "a copy is born Off"); assert.deepEqual(rulesOf(p).map((x) => x.id), ["R1", "R2"]);
  setRule(p, "R2", { text: "Pas de pièce plus large que 120 mm", on: true }); assert.equal(rulesOf(p)[1].text, "Pas de pièce plus large que 120 mm");
  setRule(p, "R1", { on: false });
  const own = ecoFrame(p, RULEBOOK).find((s) => s.id === "project"); assert.deepEqual(own.lines, ["R2 Pas de pièce plus large que 120 mm"], "a rule Off does not leave");
  assert.deepEqual(ecoRows(p), [["R1", "Le boîtier reste en aluminium moulé", "Off"], ["R2", "Pas de pièce plus large que 120 mm", "On"]]);
  assert.ok(removeRule(p, "R1")); assert.equal(addRule(p, "x").id, "R3", "a number is never given twice"); assert.equal(copyRule(p, "nope"), null);
});

test("the frame : the DFx of the processes the product uses, interfaces with their keys, isolation as typed, units, MVP — each with how far it was verified", () => {
  const p = demo(), F = ecoFrame(p, RULEBOOK), ids = F.map((s) => s.id);
  assert.ok(ids.includes("dfx-injection_molding") && ids.includes("dfx-pcb") && ids.includes("dfx-interfaces") && ids.includes("dfx-assembly"));
  assert.ok(!ids.includes("dfx-cnc_turning"), "a process the product does not use is not in the frame");
  assert.ok(F.find((s) => s.id === "interfaces").lines.some((l) => /^pwr_pcb_mount : DRV-BASE\/IF1/.test(l)));
  assert.equal(F.find((s) => s.id === "isolation").how, "typed", "the tables of insulation were typed, not checked against the standard : the frame says so");
  assert.match(F.find((s) => s.id === "units").lines[0], /millimètres et en SI/);
  for (const s of F) assert.ok(s.lines.length >= 1, s.id);
});

test("the checks, the request framed by a screen, the files — without the history, the STEP replaced by a mark", () => {
  const p = demo(); p.mvp = { iterations: [{ n: 2, name: "MVP 2", trl: 4, reviews: [] }] };
  const c = ecoChecks(p); assert.ok(c.review.counts.todo > 0); assert.equal(c.mvp.name, "MVP 2"); assert.ok(Array.isArray(c.issues.list));
  const t = { key: "part:DRV-BASE", label: "la pièce « Base du boîtier »" };
  const brief = ecoBrief(p, { target: t, screen: "Pièces", ask: "alléger de 10 %", keep: "les trous de fixation", done: "", questions: true });
  assert.match(brief, /Écran d'où elle vient : Pièces/); assert.match(brief, /Ce que je veux : alléger de 10 %/); assert.match(brief, /Ce qui ne doit pas bouger : les trous de fixation/);
  assert.match(brief, /Comment je saurai que c'est réussi : \(rien de dit — propose un critère\)/); assert.match(brief, /Pose-moi tes questions d'abord/);
  assert.match(brief, /- assembly:DRV-ASM \(monte\)/); assert.match(brief, /part:DRV-ISO \(accouplée à, à 2 pas\)/); assert.match(brief, /Ce que cela dérange/);
  const F = ecoFiles(p, { target: t, screen: "Pièces", rulebook: RULEBOOK, language: "LANGAGE", toDwiz }), names = F.map((f) => f.name);
  assert.deepEqual(names, ["consigne.md", "projet.dwiz", "dependances.md", "dependances.json", "verifications.md", "cadre.md", "etat.md", "langage.md"]);
  const project = fromDwiz(F[1].text); assert.equal(project.history, undefined, "the history does not leave"); assert.match(String(project.parts.find((x) => x.id === "IMP").step), /géométrie STEP importée/);
  assert.equal(p.parts.find((x) => x.id === "IMP").step.text.length, 5000, "the project itself is untouched");
  assert.deepEqual(JSON.parse(F[3].text).edges.length, ecoMap(p).edges.length);
  assert.match(F[6].text, /MVP 2/); assert.match(F[5].text, /typed/);
  assert.ok(!F.some((f) => /@[a-z0-9.-]+\.[a-z]{2,}/i.test(f.text)), "no address in the package");
});

test("the guide : no rule of the project is a tip, an empty rule is to enter, what depends on the artefact is said", () => {
  const p = demo(); assert.match(ecoGuide(p)[0].text, /aucune règle à lui/);
  addRule(p, "Règle"); addRule(p, ""); assert.ok(ecoGuide(p).some((x) => x.level === "todo" && /vide/.test(x.text)));
  assert.ok(ecoGuide(p, { key: "part:DRV-BASE" }).some((x) => /dépendent de part:DRV-BASE/.test(x.text)));
});

test("wiring : a screen in the menu Produit, a step up, the dialogue IA leads here, the screen is a studio with a map that zooms", () => {
  assert.match(read("web/js/core/app.js"), /keys: \["dfx", "review", "report", "history", "eco"\]/); assert.match(read("web/js/core/app.js"), /go\("#\/eco"\)/);
  assert.match(read("web/js/core/stairs.js"), /case "eco": return \{ hash: "#\/review"/); assert.match(read("web/js/main.js"), /import "\.\/modules\/eco\.js";/);
  assert.match(read("web/js/modules/ai_loop.js"), /Tout le contexte \(\.zip\)/); assert.match(read("web/js/modules/ai_loop.js"), /ecoKey: t\.key/);
  const s = read("web/js/modules/eco.js"); assert.match(s, /class: "studio" \}, left, view, right/); assert.match(s, /stampText\(x\.name, x\.text\)/, "every file carries the note of the platform");
  assert.match(read("web/js/modules/eco_map.js"), /svgView\(host/); assert.match(read("web/js/modules/history_tree.js"), /svgView\(host/, "the tree of the history pans and zooms the same way");
  assert.match(read("web/index.html"), /href="css\/eco\.css"/);
});
