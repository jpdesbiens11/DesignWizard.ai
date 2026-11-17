/* The lengths of a board, as an electronics designer reads them : millimetres in SI ; mil under an inch and inches from there
   in the imperial system ; a foil by its weight. The board itself never changes : only what is written and what is typed. */
import test from "node:test";
import assert from "node:assert/strict";
import { boardRule, boardUnit, boardNum, boardLen, boardDims, boardField, boardBack, boardLabel, foilLen, foilField, foilBack, copperName, COPPER_WEIGHT, boardProse, boardDoc } from "../../web/js/pcba/board_units.js";
import { proseUnits } from "../../web/js/core/units.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { PCBA_BOOK } from "../../web/js/pcba/drc_rules.js";
import { boardAssemblyPlan } from "../../web/js/pcba/assembly_plan.js";
import { planDoc } from "../../web/js/core/plan_doc.js";
import { fabPackage } from "../../web/js/pcba/fabfiles.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";

const SI = { system: "si", pressure: "auto" }, IMP = { system: "imperial", pressure: "auto" };

test("a board length : millimetres in SI, mil under an inch, inches from there", () => {
  assert.deepEqual(boardRule(0.15, SI), ["mm", 1]); assert.deepEqual(boardRule(0.15, IMP), ["mil", 0.0254]); assert.deepEqual(boardRule(25.4, IMP), ["in", 25.4]); assert.deepEqual(boardRule(25.39, IMP), ["mil", 0.0254]);
  assert.equal(boardLen(0.15, 2, SI), "0,15 mm"); assert.equal(boardLen(0.15, 2, IMP), "5,91 mil"); assert.equal(boardLen(0.127, 3, IMP), "5 mil", "5 mil is 0.127 mm exactly");
  assert.equal(boardLen(1.6, 2, IMP), "63 mil"); assert.equal(boardLen(80, 2, IMP), "3,15 in"); assert.equal(boardLen(1250.4, 0, SI), "1250 mm"); assert.equal(boardLen(1250.4, 0, IMP), "49,2 in"); assert.equal(boardLen(NaN, 2, IMP), "—");
  assert.equal(boardLen(30000, 0, IMP), "1181 in", "never rounded coarser than the unit");
  assert.equal(boardDims([80, 50], 1, SI), "80 × 50 mm"); assert.equal(boardDims([80, 50], 1, IMP), "3,15 × 1,97 in"); assert.equal(boardDims([7, 7, 1.4], 2, IMP), "276 × 276 × 55,1 mil", "one unit for the lot : the one of the largest");
  assert.equal(boardDims([0.6, 0.3], 2, IMP, " / "), "23,6 / 11,8 mil"); assert.equal(boardDims([0.6, 0.3], 2, SI, " / "), "0,6 / 0,3 mm");
  assert.equal(boardUnit("mil", SI), "mm"); assert.equal(boardUnit("in", SI), "mm"); assert.equal(boardUnit("mil", IMP), "mil"); assert.equal(boardUnit("in", IMP), "in");
  assert.equal(boardNum(0.035, "mil", 3, SI), "0,035"); assert.equal(boardNum(0.035, "mil", 3, IMP), "1,38"); assert.equal(boardNum(1250, "in", 0, IMP), "49,2"); assert.equal(boardNum(undefined, "mil", 2, IMP), "—");
});

test("a field : what it shows, what is typed, its label — and nothing moves in SI", () => {
  assert.equal(boardField(0.15, "mil", SI), 0.15); assert.equal(boardBack(0.15, "mil", SI), 0.15); assert.equal(boardLabel("Largeur (mm)", "mil", SI), "Largeur (mm)"); assert.equal(boardLabel("Rayon", "mil", SI), "Rayon");
  assert.equal(boardField(0.15, "mil", IMP), 5.9055); assert.equal(boardBack(6, "mil", IMP), 0.1524, "6 mil is 0.1524 mm, without the dust of the floating point"); assert.equal(boardBack(10, "mil", IMP), 0.254);
  assert.equal(boardField(80, "in", IMP), 3.1496); assert.equal(boardBack(3.5, "in", IMP), 88.9); assert.equal(boardBack(NaN, "mil", IMP) !== boardBack(NaN, "mil", IMP), true, "nothing typed stays nothing");
  assert.equal(boardLabel("Largeur (mm)", "mil", IMP), "Largeur (mil)"); assert.equal(boardLabel("Largeur (mm)", "in", IMP), "Largeur (in)"); assert.equal(boardLabel("X", "mil", IMP), "X (mil)"); assert.equal(boardLabel("Épaisseur (µm)", "mil", IMP), "Épaisseur (mil)");
  for (const mm of [0.1, 0.15, 0.25, 0.6, 1.6, 3.2]) assert.ok(Math.abs(boardBack(boardField(mm, "mil", IMP), "mil", IMP) - mm) < mm * 1e-4, `${mm} mm shown (five significant digits) then read back stays ${mm} mm to a ten-thousandth`);
});

test("a foil and a coating : micrometres or mil ; a copper foil by its weight", () => {
  assert.equal(foilLen(50, SI), "50 µm"); assert.equal(foilLen(50, IMP), "1,97 mil"); assert.equal(foilField(50, IMP), 1.9685); assert.equal(foilBack(2, IMP), 50.8); assert.equal(foilField(50, SI), 50); assert.equal(foilBack(50, SI), 50);
  assert.equal(copperName(35, SI), "35 µm"); assert.equal(copperName(35, IMP), "1 oz (1,38 mil)"); assert.equal(copperName(18, IMP), "½ oz (0,709 mil)"); assert.equal(copperName(70, IMP), "2 oz (2,76 mil)"); assert.equal(copperName(105, IMP), "4,13 mil", "a foil without a trade name keeps its thickness");
  assert.deepEqual(Object.keys(COPPER_WEIGHT), ["18", "35", "70"]);
});

test("a sentence about a board reads in mil ; the same sentence elsewhere reads in inches", () => {
  assert.equal(boardProse("Piste de 0,12 mm : limite 0,15 mm.", IMP), "Piste de 4,72 mil : limite 5,91 mil."); assert.equal(boardProse("Piste de 0,12 mm : limite 0,15 mm.", SI), "Piste de 0,12 mm : limite 0,15 mm.");
  assert.equal(proseUnits("Piste de 0,12 mm", IMP), "Piste de 0,00472 in", "the mil is the board's own reading");
  assert.equal(boardProse("IPC-2221 : 3 A demandent 1,2 mm de large (35 µm, +10 K).", IMP), "IPC-2221 : 3 A demandent 47,2 mil de large (1,38 mil, +10 K).");
  assert.equal(boardProse("Carte de 80 × 50 mm, épaisseur 1,6 mm ; masse 12 g", IMP), "Carte de 3,15 × 1,97 in, épaisseur 63 mil ; masse 12 g (0,423 oz)", "the outline in inches, the thickness in mil, the mass with its ounces");
  assert.equal(boardProse("Routage complet : 1250 mm, 12 vias.", IMP), "Routage complet : 49,2 in, 12 vias."); assert.equal(boardProse("0,5 mm de pas, 48 broches, 3,3 V", IMP), "19,7 mil de pas, 48 broches, 3,3 V");
});

test("the real texts of a board : findings, rule book and routing sheet read in mil, and the fabrication files stay in millimetres", () => {
  const b = demoBoard(), drc = checkBoard(b, LIBRARY), texts = [...drc.findings.map((f) => f.message), ...PCBA_BOOK.flatMap((g) => [...g.steps, ...g.rules.flatMap((r) => [r.limit, r.why])])].filter(Boolean);
  const mm = texts.filter((t) => /\d\s?mm(?![A-Za-z²³])/.test(t)); assert.ok(mm.length >= 10, `${mm.length} texts of the board carry millimetres`);
  for (const t of mm) { const out = boardProse(t, IMP); assert.ok(!/\d\s?mm(?![A-Za-z²³])/.test(out), `nothing left in millimetres : ${out}`); assert.ok(/ (?:mil|in)(?![A-Za-z])/.test(out), out); assert.equal(boardProse(t, SI), t); }
  const plan = boardAssemblyPlan(b, LIBRARY), doc = planDoc(plan, { date: new Date("2026-11-17T12:00:00Z"), project: "Variateur compact", author: "Bureau d'études" }), shown = boardDoc(doc, IMP), flat = (d) => JSON.stringify(d.blocks);
  assert.equal(boardDoc(doc, SI), doc, "nothing to do in SI"); assert.equal(shown.blocks.length, doc.blocks.length); assert.ok(/\d mm/.test(flat(doc)) && !/\d mm(?![A-Za-z²³])/.test(flat(shown)), "the routing of the board, read in mil");
  const z = docx(shown), pdf = new TextDecoder("latin1").decode(pdfDoc(shown)); assert.ok(z[0] === 0x50 && z[1] === 0x4b && z.length > 8000); assert.ok(pdf.startsWith("%PDF-1.4"));
  const pk = fabPackage(b, LIBRARY, { date: new Date("2026-11-17T12:00:00Z") }), drill = pk.files.find((f) => /drl|perc|drill/i.test(f.name) || f.key === "drill"), gerber = pk.files.find((f) => /\.g(tl|bl|ko|m1)$|\.gbr$/i.test(f.name));
  assert.ok(drill && /METRIC/.test(drill.text), "the drill file says METRIC"); assert.ok(gerber && /%MOMM\*%/.test(gerber.text), "a Gerber file says millimetres");
});
