/* The guide of three more screens : isolation (what the analysis of an assembly still asks for), drawings (the title block and the review
   of a sheet), order (what stops or slows the order of a prototype). Pure lists, four levels. */
import test from "node:test";
import assert from "node:assert/strict";
import { netsOf, isolationGuide } from "../../web/js/analysis/cc_guide.js";
import { drawingIssues } from "../../web/js/core/drawing_guide.js";
import { orderGuide, orderCheck } from "../../web/js/cad/order.js";
import { projectIssues, issuesHere } from "../../web/js/core/guide_checks.js";
import { GUIDE_LEVELS, guideCount } from "../../web/js/core/guide.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const one = (list, field) => list.find((x) => x.field === field), sound = (list) => { for (const x of list) { assert.ok(GUIDE_LEVELS[x.level], x.level); assert.ok(x.text && x.field, "a text and a field"); } return list; };
const copy = (x) => JSON.parse(JSON.stringify(x)), byId = (p) => (id) => p.parts.find((q) => q.id === id);

test("the nets of an assembly : those it keeps, completed with those its parts declare", () => {
  const asm = { id: "A", instances: [{ id: "i1", part: "PCB" }, { id: "i2", part: "SINK" }, { id: "i3", part: "GONE" }], isolation: { nets: [{ name: "HV+", kind: "dc", voltage: 800 }] } };
  const parts = { PCB: { pcb: { nets: { "HV+": { voltage: 400 }, LV: { voltage: 12, floating: true } } } }, SINK: { elec: { net: "Chassis" } } }, nets = netsOf(asm, (id) => parts[id]);
  assert.deepEqual(nets.map((n) => [n.name, n.voltage]), [["HV+", 800], ["LV", 12], ["Chassis", 0]], "what the assembly keeps wins over what a part declares"); assert.equal(nets[1].floating, true);
  assert.deepEqual(netsOf({ instances: [] }), []); assert.deepEqual(netsOf(null), []); assert.equal(netsOf(DEMO_DRIVE.assemblies[0], byId(DEMO_DRIVE)).length, 4);
});

test("isolation : nothing to compare, voltages to enter, analysis to launch, pairs that fail, results out of date", () => {
  const N = (name, voltage) => ({ name, kind: "dc", voltage }), asm = { id: "PACK", instances: [] };
  assert.deepEqual(isolationGuide(asm, []), [], "an assembly without potentials says nothing to the project"); assert.equal(sound(isolationGuide(asm, [N("HV+", 400)], { here: true }))[0].level, "tip");
  let g = sound(isolationGuide(asm, [N("A", 0), N("B", 0)])); assert.deepEqual(g.map((x) => [x.level, x.field]), [["todo", "voltage"]]); assert.match(g[0].text, /^PACK — isolation : aucun des 2 potentiels n'a de tension/);
  g = sound(isolationGuide(asm, [N("HV+", 400), N("HV-", 0)])); assert.deepEqual(g.map((x) => [x.level, x.field]), [["tip", "run"]], "not launched yet : a piece of advice, not a fault");
  const R = (a, b, ok, more = {}) => ({ a, b, ok, level: "basic", u: 400, clrReq: 5.5, clr: 8, crpReq: 6.3, crp: 9, ...more }), nets = [N("HV+", 400), N("HV-", 0), N("LV", 12)];
  assert.deepEqual(isolationGuide({ ...asm, isolation: { results: [R("HV+", "HV-", true), R("HV+", "LV", true)] } }, nets), [], "every pair passes : nothing to say");
  g = sound(isolationGuide({ ...asm, isolation: { results: [R("HV+", "HV-", false, { clr: 5.2 }), R("HV+", "LV", false, { crp: 4 }), R("HV-", "LV", null)] } }, nets));
  assert.deepEqual(g.map((x) => [x.level, x.field]), [["error", "results"], ["warn", "results"]]); assert.match(g[0].text, /2 paires en défaut — HV\+ ↔ HV- \(clearance 5,2 mm pour 5,5 requis\)…$/); assert.match(g[1].text, /1 paire sans verdict \(HV- ↔ LV\)/);
  assert.match(isolationGuide({ ...asm, isolation: { results: [R("HV+", "LV", false, { crp: 4 })] } }, nets)[0].text, /creepage 4 mm pour 6,3 requis/);
  g = sound(isolationGuide({ ...asm, isolation: { results: [R("HV+", "BUS", true)] } }, nets)); assert.deepEqual(g.map((x) => [x.level, x.field]), [["warn", "run"]]); assert.match(g[0].text, /résultats périmés — un potentiel analysé n'existe plus \(BUS\)/);
});

test("a drawing : who drew, who checked, who approved — and a status that does not say more than the names", () => {
  let g = sound(drawingIssues({}, { id: "DRV-BASE" })); assert.deepEqual(g.map((x) => [x.level, x.field]), [["todo", "drawnBy"], ["tip", "checkedBy"], ["tip", "organisation"]]); assert.match(g[0].text, /^DRV-BASE — dessin : le cartouche n'a pas de dessinateur/);
  g = drawingIssues({}, { id: "X", author: "Bureau d'études" }); assert.equal(one(g, "drawnBy"), undefined, "the author of the project draws when nobody else is named");
  g = sound(drawingIssues({ drawnBy: "A", checkedBy: "B", status: "Émis", organisation: "Atelier" }, { id: "X" })); assert.deepEqual(g.map((x) => [x.level, x.field]), [["error", "approvedBy"]]); assert.match(g[0].text, /le statut dit « Émis », mais le cartouche n'a pas de approbateur/);
  assert.match(drawingIssues({ drawnBy: "A", status: "Released", organisation: "O" }, {})[0].text, /n'a pas de vérificateur ni d'approbateur — nommez-les/);
  assert.match(one(drawingIssues({ drawnBy: "A", checkedBy: "B", organisation: "O" }, {}), "approvedBy").text, /« Approuvé » est à remplir avant d'émettre/);
  assert.deepEqual(drawingIssues({ drawnBy: "A", checkedBy: "B", approvedBy: "C", status: "Émis", organisation: "O" }, { id: "X", state: "ok" }), [], "a complete title block says nothing");
  g = sound(drawingIssues({ drawnBy: "A", checkedBy: "B", approvedBy: "C", organisation: "O" }, { id: "X", state: "changed" })); assert.deepEqual(g.map((x) => [x.level, x.field]), [["warn", "status"]]); assert.match(g[0].text, /a changé depuis sa revue/);
  assert.deepEqual(drawingIssues(null).map((x) => x.level), ["todo", "tip", "tip"]);
});

test("an order : what stops it is to correct, what slows it is to check, a quantity nobody gave is to confirm", () => {
  const spec = { id: "P-1", material: "AL6061-T6", process: "cnc_milling" }, built = { bodies: [{}], log: [], bbox: [0, 0, 0, 10, 10, 10], mass: 5 }, clean = { summary: { errors: 0, warnings: 0 } };
  let c = orderCheck(spec, built, clean, null), g = sound(orderGuide(spec, c));
  assert.equal(c.ready, true); assert.deepEqual(g.filter((x) => x.level !== "warn").map((x) => [x.level, x.field]), [["todo", "quantity"], ["tip", "need_by"]]); assert.match(one(g, "quantity").text, /^P-1 — commande : quantité à confirmer — 1 par défaut/);
  assert.equal(one(orderGuide({ ...spec, order: { quantity: 4 } }, c), "quantity"), undefined); assert.equal(one(orderGuide({ ...spec, intent: { quantity: 20 } }, c), "quantity"), undefined, "the quantity of the intent is one somebody gave");
  assert.equal(one(orderGuide({ ...spec, order: { quantity: 1, need_by: "2026-12-01" } }, c), "need_by"), undefined);
  c = orderCheck({ id: "P-2" }, built, { summary: { errors: 3, warnings: 2 } }, null); g = sound(orderGuide({ id: "P-2", order: { quantity: 2 } }, c));
  assert.equal(c.ready, false); assert.deepEqual(g.filter((x) => x.level === "error").map((x) => x.text), ["P-2 — commande : Matériau non défini.", "P-2 — commande : Procédé non défini.", "P-2 — commande : 3 règle(s) DFx à corriger : la pièce n'est pas fabricable telle quelle."]);
  assert.ok(g.some((x) => x.level === "warn" && /2 remarque\(s\) DFx/.test(x.text))); assert.equal(one(g, "need_by"), undefined, "no advice on the date of an order that cannot go yet");
  assert.equal(guideCount(g).blocking, 3); assert.deepEqual(orderGuide(spec, null), []);
});

test("the guide of the project carries the isolation of its assemblies, in millimetres, with the screen to go to", () => {
  const all = projectIssues(DEMO_DRIVE), iso = all.filter((x) => x.screen === "creepage");
  assert.deepEqual(iso.map((x) => [x.level, x.ref, x.hash, x.si]), [["tip", "DRV-ASM", "#/creepage/DRV-ASM", true]], "the demonstration has four potentials and no analysis yet : advice"); assert.match(iso[0].text, /4 potentiels, analyse pas encore lancée/);
  const p = copy(DEMO_DRIVE); p.assemblies[0].isolation.results = [{ a: "HV+", b: "LV", ok: false, clrReq: 5.5, clr: 3.1, crpReq: 6.3, crp: 7 }];
  const bad = projectIssues(p).filter((x) => x.screen === "creepage"); assert.deepEqual(bad.map((x) => x.level), ["error"]); assert.match(bad[0].text, /DRV-ASM — isolation : 1 paire en défaut — HV\+ ↔ LV \(clearance 3,1 mm pour 5,5 requis\)$/);
  assert.deepEqual(issuesHere(projectIssues(p), "creepage", null), bad);
});
