/* Point 4 of the roadmap (JP, 21 novembre 2026 : « une pile, deux boutons, une DEL rouge et une DEL jaune ») : the first board of the Labo — the two
   blocks born for it (a coin cell ; a button that lights its LED by itself), their tests, the test of the whole board on its own cell, and the
   steps at the bench : the cell put in after the search for a short circuit, the button pressed and held, then released.
     node --test tests/node/first_board.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, buildBlock } from "../../web/js/pcba/blocks.js";
import { blockTests, runTest } from "../../web/js/pcba/lab_bench.js";
import { boardTests, runBoardTest } from "../../web/js/pcba/lab_board.js";
import { boardSheets } from "../../web/js/pcba/lab_plan.js";
import { manipSteps } from "../../web/js/pcba/lab_manip.js";
import { plainStep } from "../../web/js/pcba/lab_plain.js";
import { firstBoard, FIRST_BOARD_ID } from "../../web/js/demo/demo_first.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { NEWS } from "../../web/js/core/whats_new.js";
import { methodById } from "../../web/js/core/methods.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("two blocks born for it : a coin cell, and a button that closes the circuit of its LED — each with its sizing and its tests", () => {
  assert.ok(BLOCKS.battery && BLOCKS.push_led);
  const cell = buildBlock("battery", {}); assert.equal(cell.ports.VBAT.dir, "power_out"); assert.equal(cell.ports.VBAT.suggest, "+3V"); assert.ok(cell.parts.some((p) => p.comp === "BAT-CR2032"));
  assert.match(cell.calc[0].text, /typique.*pas lue sur une fiche/);
  const red = buildBlock("push_led", { color: "rouge" }), yellow = buildBlock("push_led", { color: "jaune" }), R = (b) => b.calc.find((c) => /Résistance/.test(c.label)).value;
  assert.deepEqual([R(red), R(yellow)], [560, 510], "(3 − 1,9) / 2 mA → 560 Ω ; (3 − 2,0) / 2 mA → 510 Ω, série E24");
  assert.ok(red.nets.find((n) => n.name === "VDD").pins.includes("SW.A") && red.nets.find((n) => n.name === "LIT").pins.join() === "SW.B,R.1", "the button is in series : nothing passes without it");
  assert.deepEqual(blockTests("battery").map((t) => t.id), ["loaded"]); assert.deepEqual(blockTests("push_led").map((t) => t.id), ["press"], "no power-up of its own : at rest it draws nothing");
  for (const t of [...blockTests("battery"), ...blockTests("push_led")]) for (const k of ["why", "expect", "learn"]) assert.ok(t[k], `${t.id} says ${k}`);
});

test("the tests run : the cell sags under 5 mA, the LED lights at about 2 mA when the button is held", () => {
  const cell = runTest("battery", "loaded"); assert.ok(cell.ok); const v = Object.fromEntries(cell.measures.map((m) => [m.label, m.value]));
  assert.ok(Math.abs(v["Tension à vide"] - 3) < 0.01 && Math.abs(v["Tension sous 5 mA"] - 2.95) < 0.01, "10 Ω × 5 mA = 50 mV");
  for (const color of ["rouge", "jaune"]) { const r = runTest("push_led", "press", { color }); assert.ok(r.ok, color); const i = r.measures.find((m) => /Courant de la DEL/.test(m.label));
    assert.ok(i.value > 1.6e-3 && i.value < 2.4e-3, `${color} : ${i.value}`); assert.ok(r.log.some((e) => e.instr === "press" && e.to === "SW.A")); }
});

test("the example board : routed and clean, its plan — the cell, each button, then the whole board on its cell, every button at once", () => {
  const b = firstBoard(); assert.equal(b.id, FIRST_BOARD_ID); assert.deepEqual(b.blocks.map((x) => x.template), ["battery", "push_led", "push_led", "test"]);
  assert.equal(erc(b, LIBRARY).summary.error, 0); assert.equal(checkBoard(b, LIBRARY).summary.error, 0); assert.ok(b.tracks.length > 5);
  assert.ok(read("web/js/demo/demo_first_data.js").split("\n").length < 500); assert.match(read("tools/gen_demo_first.mjs"), /addBlock\(b, "push_led", \{ v: 3, i: 2, color: "jaune"/);
  assert.deepEqual(boardTests(b).map((t) => t.id), ["cell"]);
  const whole = runBoardTest(b, "cell"); assert.ok(whole.ok); const m = Object.fromEntries(whole.measures.map((x) => [x.label, x.value]));
  assert.ok(m["Tension de la pile, boutons relâchés"] > m["Tension de la pile, tous les boutons appuyés"], "the LEDs share the cell : its voltage sags");
  const sheets = boardSheets(b); assert.deepEqual(sheets.map((s) => s.test).filter((t) => t !== "continuity"), ["loaded", "press", "press", "cell"], "the test points have their continuity check besides"); assert.ok(sheets.every((s) => s.ok));
});

test("at the bench : the cell goes in after the search for a short circuit ; the button is pressed, held, released — pointed on the board", () => {
  const sheets = boardSheets(firstBoard()), steps = (t, n = 0) => manipSteps(sheets.filter((s) => s.test === t)[n]), ids = (S) => S.map((s) => s.id);
  const cell = steps("loaded"); assert.ok(ids(cell).indexOf("guard") < ids(cell).indexOf("cell-in"), "short circuit searched with the cell out, then the cell put in");
  assert.match(cell.find((s) => s.id === "cell-in").text, /\+ » vers le haut|face marquée « \+ »/); assert.match(cell.find((s) => s.kind === "off").title, /Retirer la pile/);
  const press = steps("press"), first = ids(press).indexOf("press-0"), reads = press.map((s, i) => (s.kind === "read" ? i : -1)).filter((i) => i >= 0);
  assert.ok(first > 0 && first < reads[0] && ids(press).indexOf("release") > reads[reads.length - 1], "press, read, release");
  assert.deepEqual(press[first].points.map((p) => p.ref), ["SW1"]); assert.match(press.find((s) => s.kind === "set" && /alimentation/i.test(s.title)).text, /retirez-la d'abord de son support/);
  const whole = steps("cell"), k = ids(whole);
  assert.ok(k.indexOf("read-0") < k.indexOf("press-0") && k.indexOf("press-1") < k.indexOf("read-1"), "the cell read at rest BEFORE the buttons are pressed");
  assert.ok(whole.filter((s) => /^press-/.test(s.id)).length === 2);
  for (const s of [...cell, ...press, ...whole]) assert.ok(plainStep(s), `${s.id} is said in plain words`);
});

test("wired : offered on the PCBA and in the Labo, said in the news, in the register of sources", () => {
  assert.match(read("web/js/modules/pcba.js"), /b\.dataset\.firstExample = ""/); assert.match(read("web/js/modules/elab.js"), /store\.addBoard\(firstBoard\(\)\)/);
  assert.ok(NEWS.some((n) => n.id === "first-board" && n.sel === "[data-first-example]")); assert.equal(methodById("first-board").how, "own");
  assert.match(read("web/js/modules/elab_manip.js"), /do: \["Geste à la main"/); assert.match(read("web/js/pcba/lab_manip_doc.js"), /do: "Geste à la main"/);
});
