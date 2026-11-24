/* The PUZZLE view of the software (choix cliqué de JP, 24 novembre 2026 : « Casse-tête 2D, 1 lien ») : pieces a beginner names, three bands,
   ONE link per pair of pieces, and two pieces connected by wiring their right ports in the background.   node --test tests/node/sw_puzzle.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { problems } from "../../web/js/sw/sw_design.js";
import { BANDS, pieces, links, puzzleLayout, connectPieces, PIECE } from "../../web/js/sw/sw_puzzle.js";
import { devicePlacement } from "../../web/js/sw/sw_devices.js";
import { pieceOutline } from "../../web/js/modules/sw_puzzle_view.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the pieces : a sensor and what reads it are one piece, a driver and its pin one piece — three bands, left to right", () => {
  const d = bmProject().software[0], P = pieces(d);
  assert.deepEqual(BANDS.map((b) => b.id), ["sense", "decide", "act"]);
  assert.deepEqual(P.find((p) => p.id === "v_max").members, ["adc_v", "v_max"]); assert.deepEqual(P.find((p) => p.id === "k").members, ["k", "k_drv"]);
  assert.equal(P.length, 28, "34 blocks, 28 pieces"); assert.equal(new Set(P.flatMap((p) => p.members)).size, d.objects.length, "every block in exactly one piece");
  assert.equal(P.find((p) => p.id === "v_max").band, "sense"); assert.equal(P.find((p) => p.id === "latch").band, "decide"); assert.equal(P.find((p) => p.id === "k").band, "act");
  const L = links(d, P); assert.ok(L.every((l) => l.from !== l.to)); assert.equal(new Set(L.map((l) => `${l.from}>${l.to}`)).size, L.length, "ONE link per pair");
  assert.ok(L.find((l) => l.from === "k" && l.to === "latch").delay, "the loop back : the value of the step before");
  const Y = puzzleLayout(d, P, L); assert.ok(Y.layout.v_max.x < Y.layout.ov.x && Y.layout.ov.x < Y.layout.latch.x && Y.layout.latch.x < Y.layout.module.x && Y.layout.module.x < Y.layout.k.x, "left to right, as the chain goes");
  for (const c of new Set(Object.values(Y.layout).map((q) => q.col))) { const ys = Object.values(Y.layout).filter((q) => q.col === c).map((q) => q.y).sort((a, b) => a - b); for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= PIECE.H, "no piece on another"); }
});

test("connecting two pieces wires their right ports in the background — the unit adopted, a reference value of that unit", () => {
  const n = devicePlacement("ntc", 0, 0, (b) => b), led = devicePlacement("led", 0, 0, (b) => b).objects[0], d = { period: 10, objects: [...n.objects, { id: "lim", kind: "limit", params: {}, x: 0, y: 0 }, led], wires: [...n.wires] };
  const c = connectPieces(d, "ntc", "lim"); assert.deepEqual(c.wires, [{ from: "ntc.value", to: "lim.value" }], "the measure, not the raw counts"); assert.deepEqual(c.set.lim, { unit: "0.1 °C", trip: 600, clear: 550 });
  d.objects[2].params = c.set.lim; d.wires.push(...c.wires);
  assert.deepEqual(connectPieces(d, "lim", led.id).wires, [{ from: "lim.trip", to: `${led.id}.level` }]); assert.deepEqual(connectPieces(d, led.id, "lim").wires, [], "an actuator gives nothing");
  d.wires.push({ from: "lim.trip", to: `${led.id}.level` }); assert.deepEqual(problems(d).filter((p) => p.level === "error"), []);
  assert.deepEqual(connectPieces(d, "ntc", "lim").wires, [], "an input already taken is not taken twice");
});

test("the screen : jigsaw pieces with a knob and a socket, the view by level, the switch", () => {
  const both = pieceOutline(200, 90, true, true), none = pieceOutline(200, 90, false, false); assert.ok(both.split(" C ").length > none.split(" C ").length + 3, "a knob and a socket drawn");
  const v = read("web/js/modules/sw_puzzle_view.js"); assert.match(v, /connectPieces\(d, pending, p\.id\)/, "the pieces that cannot take it are greyed"); assert.match(v, /physText/, "values in the units of physics"); assert.match(v, /viewBar\(\{ label: /);
  assert.match(read("web/js/modules/sw_level_ui.js"), /return lv === "expert" \? "blocks" : "puzzle"/, "the puzzle for the novice and the intermediate, the blocks for the expert");
  assert.match(read("web/js/modules/sw.js"), /make = mode === "puzzle" \? swPuzzle : swCanvas/);
});
