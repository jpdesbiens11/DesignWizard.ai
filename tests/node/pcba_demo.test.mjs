/* PCBA: the demonstration board end to end, and the AI round trip. */
import test from "node:test";
import assert from "node:assert/strict";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { zoneProblems, placementProblems } from "../../web/js/pcba/place.js";
import { flowStatus } from "../../web/js/pcba/status.js";
import { fabPackage } from "../../web/js/pcba/fabfiles.js";
import { readGerber, readExcellon } from "../../web/js/pcba/gerber_read.js";
import { reviewData } from "../../web/js/pcba/review_data.js";
import { reviewVerdict } from "../../web/js/pcba/review.js";
import { functionRows } from "../../web/js/pcba/synth.js";
import { boardFromPart } from "../../web/js/pcba/twin.js";
import { aiBrief, aiRead, aiDiff } from "../../web/js/core/ai_loop.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { clearanceViolations } from "./pcba_fixture.mjs";

test("demonstration board: from its functions to its Gerber files, nothing left to do", () => {
  const b = demoBoard(), R = resolveBoard(b, LIBRARY), e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY);
  assert.equal(b.id, "DRV-CTRL-PCBA"); assert.deepEqual(R.problems, []); assert.equal(b.blocks.length, 12); assert.ok(b.parts.length >= 60 && b.parts.every((p) => p.at));
  assert.equal(e.summary.error + e.summary.warn, 0); assert.equal(d.summary.error, 0, d.findings.filter((f) => f.severity === "error").map((f) => f.message).join(" | ")); assert.equal(d.summary.warn, 0); assert.equal(d.stats.open, 0);
  assert.deepEqual(clearanceViolations(b, LIBRARY), []); assert.deepEqual(zoneProblems(b, LIBRARY), []); assert.deepEqual(placementProblems(b, LIBRARY), []);
  const flow = flowStatus(b, { erc: e, zones: [], placement: [], drc: d }); assert.ok(flow.steps.every((s) => s.state === "done"), flow.steps.map((s) => `${s.key}:${s.state}`).join(" "));
  const part = DEMO_DRIVE.parts.find((p) => p.id === b.part), m = boardFromPart(part); assert.deepEqual(b.board.size, m.size); assert.deepEqual(b.board.holes.map((h) => h.at), m.holes.map((h) => h.at), "the board still fits its mechanical part");
  const rows = functionRows(b, LIBRARY); assert.equal(rows.filter((r) => r.level === 1).length, 8); assert.equal(rows.filter((r) => r.kind === "contrainte").length, 2); assert.ok(rows.filter((r) => r.block).length === 12);
  const pk = fabPackage(b, LIBRARY, { date: new Date("2026-11-14T12:00:00Z") });
  assert.equal(pk.files.length, 21); assert.match(pk.files.find((f) => f.key === "gamme").text, /^GAMME D.ASSEMBLAGE DE LA CARTE — DRV-CTRL-PCBA/); assert.equal(pk.stats.layers, 4); assert.equal(pk.stats.fab, "standard");
  for (const f of pk.files.filter((x) => x.mime === "application/vnd.gerber")) assert.equal(readGerber(f.text).units, "mm", f.name);
  assert.equal(readExcellon(pk.files.find((f) => f.key === "pth").text).hits.length, R.vias.length + R.pads.filter((p) => p.drill).length);
  assert.equal(readGerber(pk.files.find((f) => f.key === "in1").text).regions.length, 1, "the ground plane"); assert.ok(readGerber(pk.files.find((f) => f.key === "coat_top").text).regions.length > 8, "coating with its keep-outs");
  assert.equal(reviewVerdict(reviewData(b, LIBRARY, { kind: "CDR", date: new Date(0) })).ready, true); assert.equal(demoBoard(false).part, undefined);
  assert.deepEqual(fromDwiz(toDwiz(b)), b);
  console.log(`  demo board: ${b.parts.length} parts, ${b.nets.length} nets, ${d.stats.tracks} tracks, ${Math.round(d.stats.length)} mm, ${d.stats.vias} vias, min space ${d.stats.minSpace.toFixed(3)} mm, ${pk.files.length} files`);
});

test("AI round trip: the brief carries the artefact, the answer is read back, the changes are listed", () => {
  const b = demoBoard(), brief = aiBrief(b, "Passe le régulateur 5 V à 2 A.", ["Blocs disponibles : buck, ldo."]);
  assert.ok(brief.includes("DEMANDE : Passe le régulateur 5 V à 2 A.") && brief.includes("```dwiz\ndwiz board/1 DRV-CTRL-PCBA") && brief.includes("- Blocs disponibles : buck, ldo.") && /carte électronique « DRV-CTRL-PCBA »/.test(brief));
  const text = brief.split("```dwiz\n")[1].split("\n```")[0];
  assert.deepEqual(aiDiff(b, aiRead(`Voici :\n\`\`\`dwiz\n${text}\n\`\`\`\nRien changé.`)), [], "an untouched answer shows no change");
  const back = aiRead(`\`\`\`dwiz\n${text.replace(/(block B3 buck[\s\S]*?iout=)1/, "$12").replace(/part TP1 [^\n]*\n/, "")}\n\`\`\``), diff = aiDiff(b, back);
  assert.deepEqual(diff.map((d) => d.kind).sort(), ["changed", "removed"]); assert.ok(diff.some((d) => d.text === "blocks B3.params.iout : 1 → 2") && diff.some((d) => d.text === "parts TP1 retiré"));
  // the whole project makes the round trip too : its parts, assemblies and boards come back as one document
  const project = { ...JSON.parse(JSON.stringify(DEMO_DRIVE)), boards: [b] }, pb = aiBrief(project, "Passe le couvercle en révision B.", []), ptext = pb.split("```dwiz\n")[1].split("\n```")[0];
  assert.ok(/^dwiz project\/1 demo-variateur/.test(ptext) && ptext.includes("\ndwiz part/1 DRV-COVER") && ptext.includes("\ndwiz assembly/1 DRV-ASM") && ptext.includes("\ndwiz board/1 DRV-CTRL-PCBA"));
  const pback = aiRead(ptext.replace(/(dwiz part\/1 DRV-COVER[\s\S]*?\nrevision )A/, "$1B")), pdiff = aiDiff(project, pback);
  assert.equal(pback.parts.length, project.parts.length); assert.equal(pback.boards[0].id, "DRV-CTRL-PCBA"); assert.deepEqual(pdiff.map((d) => d.text), ["parts DRV-COVER.revision : A → B"]);
  assert.equal(aiRead('```json\n{"dw":"part/1","id":"X"}\n```').id, "X"); assert.throws(() => aiRead("Désolé, je ne peux pas."), /Aucun artéfact/);
  assert.deepEqual(aiDiff({ a: [1, 2], n: { x: 1 } }, { a: [1, 2, 3], n: { x: 2, y: 3 } }).map((d) => d.path), ["a", "n.x", "n.y"]);
});
