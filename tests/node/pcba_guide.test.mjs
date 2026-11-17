/* The guide of a board : what the board shows of itself (cheap, for the whole project) and what its checks found (for its screen).
   Four levels, a step to go to for every line. */
import test from "node:test";
import assert from "node:assert/strict";
import { boardGuide, boardChecksGuide } from "../../web/js/pcba/guide.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { emptyBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { zoneProblems, placementProblems } from "../../web/js/pcba/place.js";
import { flowStatus, FLOW } from "../../web/js/pcba/status.js";
import { projectIssues, issuesHere } from "../../web/js/core/guide_checks.js";
import { GUIDE_LEVELS, guideCount } from "../../web/js/core/guide.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

const results = (b) => { const e = erc(b, LIBRARY), drc = checkBoard(b, LIBRARY), zones = zoneProblems(b, LIBRARY), placement = placementProblems(b, LIBRARY); return { erc: e, drc, zones, placement, flow: flowStatus(b, { erc: e, zones, placement, drc }) }; };
const STEPS = new Set([...FLOW.filter((f) => !f.gate).map((f) => f.key), "classes", "bom"]), one = (list, field) => list.find((x) => x.field === field);
const sound = (list) => { for (const x of list) { assert.ok(GUIDE_LEVELS[x.level], x.level); assert.ok(STEPS.has(x.step), `a step to go to : ${x.step}`); assert.match(x.text, /^[A-Z0-9-]+ — /, "the line names its board"); } return list; };

test("what a board shows of itself : nothing to do on a finished board but two pieces of advice, a first step on an empty one", () => {
  const b = demoBoard(), own = sound(boardGuide(b));
  assert.deepEqual(own.map((x) => [x.level, x.field]), [["tip", "mpn"]]); assert.match(own[0].text, /^DRV-CTRL-PCBA — 63 composants sans référence de fabricant/); assert.equal(own[0].step, "bom");
  const e = sound(boardGuide(emptyBoard("PCBA-001", "Nouvelle carte")));
  assert.deepEqual(e.map((x) => [x.level, x.step]), [["todo", "fonctions"]], "an empty board asks for one thing : say what it must do"); assert.deepEqual(boardGuide(null).map((x) => x.level), ["todo"]);
});

test("each thing a board lacks has its line, at its level", () => {
  const b = demoBoard();
  b.functions.push({ id: "F99", parent: null, kind: "technique", name: "Mesurer la température", block: null }); b.functions.push({ id: "F98", parent: null, kind: "contrainte", name: "Tenir dans le boîtier", block: null });
  let g = sound(boardGuide(b)); assert.equal(one(g, "functions").level, "todo"); assert.match(one(g, "functions").text, /1 fonction sans solution \(F99\) : donnez-lui un bloc/, "a constraint asks for no block");
  b.functions[0].ai = { draft: true, norms: ["IPC-2221B"] }; b.blocks[0].ai = { draft: true, norms: [] };
  g = sound(boardGuide(b)); assert.equal(one(g, "drafts").level, "warn"); assert.match(one(g, "drafts").text, /2 éléments proposés par une IA attendent votre lecture : confirmez-les, avec l'édition et la clause des normes citées \(1\)/);
  b.board.holes = []; assert.equal(one(sound(boardGuide(b)), "holes").level, "tip"); b.board.size = [0, 90];
  g = sound(boardGuide(b)); assert.equal(one(g, "size").level, "error"); assert.equal(one(g, "size").step, "implantation"); assert.equal(one(g, "holes"), undefined, "no advice on the holes of a board that has no size yet");
  b.nets.find((n) => n.class === "power").class = "hv"; const hv = b.nets.find((n) => n.class === "hv"); delete hv.voltage;
  g = sound(boardGuide(b)); assert.equal(one(g, "voltage").level, "warn"); assert.equal(one(g, "voltage").step, "classes"); assert.ok(one(g, "voltage").text.includes(hv.name));
  delete b.parts[0].at; delete b.parts[1].at;
  g = sound(boardGuide(b)); assert.equal(one(g, "place").level, "todo"); assert.match(one(g, "place").text, new RegExp(`2 composants à placer \\(${b.parts[0].ref}, ${b.parts[1].ref}\\)`)); assert.equal(one(g, "mpn"), undefined, "references come once everything is placed");
  assert.deepEqual(guideCount(g), { error: 1, todo: 2, warn: 2, tip: 0, blocking: 3 });
});

test("what the checks found : the finished board is ready ; links to route, then the rules once the layout is complete", () => {
  const b = demoBoard(), r = results(b), ok = sound(boardChecksGuide(b, r));
  assert.deepEqual(ok.map((x) => [x.level, x.step]), [["tip", "fabrication"]]); assert.match(ok[0].text, /dossier de fabrication prêt : faites-le relire par l'atelier/);
  const open = demoBoard(); open.tracks = []; open.vias = []; const ro = results(open), g = sound(boardChecksGuide(open, ro));
  assert.ok(ro.drc.stats.open > 10); assert.equal(one(g, "route").level, "todo"); assert.match(one(g, "route").text, new RegExp(`${ro.drc.stats.open} liaisons à router : bouton « Router », ou tracez-les à la main`));
  assert.equal(one(g, "drc"), undefined, "before the layout is complete, the design rules stay silent"); assert.equal(one(g, "fab"), undefined);
  const out = demoBoard(), moved = out.parts.find((p) => p.at && !p.fixed); moved.at = [-20, -20]; const rp = results(out), gp = sound(boardChecksGuide(out, rp));
  assert.ok(rp.placement.length >= 1); assert.equal(one(gp, "placement").level, "error"); assert.equal(one(gp, "placement").step, "layout"); assert.ok(one(gp, "placement").text.includes(rp.placement[0].message));
});

test("the results a screen hands over are read as they are : electrical rules, zones, design rules", () => {
  const b = demoBoard(), done = (...keys) => ({ steps: FLOW.map((f) => ({ ...f, state: keys.includes(f.key) ? "done" : "todo" })) }), F = (rule, title, severity) => ({ rule, title, severity, message: "…" });
  const g = sound(boardChecksGuide(b, { flow: done("layout"), zones: ["La zone du bloc B3 « Régulateur » dépasse de la carte."], placement: [{ message: "R1 n'est pas encore placé." }],
    erc: { summary: { error: 2, warn: 1 }, findings: [F("ERC-09", "Net name", "warn"), F("ERC-03", "Unconnected pin", "error"), F("ERC-05", "Two sources", "error")] },
    drc: { stats: { open: 0 }, summary: { error: 1, warn: 3 }, findings: [F("PCBA-21", "Solder mask dam", "warn"), F("PCBA-02", "Clearance", "error")] } }));
  assert.deepEqual(g.map((x) => [x.level, x.step, x.field]), [["error", "architecture", "erc"], ["warn", "architecture", "erc"], ["error", "implantation", "zones"], ["error", "verifs", "drc"], ["warn", "verifs", "drc"]]);
  assert.match(g[0].text, /2 erreurs du contrôle électrique : ERC-03 Unconnected pin…$/); assert.match(g[1].text, /1 avertissement du contrôle électrique : ERC-09 Net name$/); assert.match(g[2].text, /1 point à régler à l'implantation : La zone du bloc B3/);
  assert.match(g[3].text, /1 erreur de règles de conception : PCBA-02 Clearance$/); assert.match(g[4].text, /3 avertissements des vérifications à examiner : PCBA-21 Solder mask dam…$/);
  assert.equal(one(g, "placement"), undefined, "a part not placed yet is said once, by the board itself");
  assert.deepEqual(boardChecksGuide(b, { flow: done("implantation"), zones: ["x"] }), [], "zones retouched at the layout are no longer a point to settle"); assert.deepEqual(boardChecksGuide(b), []);
});

test("the guide of the project carries the boards : their lines are on the board screen, and elsewhere in the top bar", () => {
  const b = demoBoard(); delete b.parts[0].at; const p = { ...DEMO_DRIVE, boards: [b] }, all = projectIssues(p), mine = all.filter((x) => x.screen === "pcba");
  assert.equal(mine.length, 1); assert.equal(mine[0].level, "todo"); assert.equal(mine[0].ref, "DRV-CTRL-PCBA"); assert.equal(mine[0].hash, "#/pcba/DRV-CTRL-PCBA/layout");
  assert.deepEqual(issuesHere(all, "pcba", null), mine); assert.equal(projectIssues(DEMO_DRIVE).filter((x) => x.screen === "pcba").length, 0, "a project without a board says nothing of boards");
});
