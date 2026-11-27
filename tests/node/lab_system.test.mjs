/* The two kinds of boards at work on the lab table (JP, 27 novembre 2026 : « 2 pcb types that speak to each other when powered with 12 V and
   do all functions related to HW » ; choix par menu : « Les 2 cartes en marche »).   node --test tests/node/lab_system.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { systemOf, systemPower, railsOf, roundRobin, coreFrame, nodeReadings, benchFromBoards, hwFunctions, FRAME, SYSTEM_GAPS } from "../../web/js/pcba/lab_system.js";
import { rtuCheck } from "../../web/js/sw/rs485_link.js";
import { tableLinks } from "../../web/js/pcba/lab_table.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { liveStart, liveSet, liveStep, liveDrive } from "../../web/js/sw/sw_live.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the table of the BM : the main board 3 in × 3 in and a CORE board, linked by the four wires of the daisy chain — no cable by a name met by chance", () => {
  const p = bmProject(), L = tableLinks(p); assert.deepEqual(L.map((l) => l.A.net).sort(), ["+5V_ISO", "GND_ISO", "RS485_A", "RS485_B"]); assert.ok(L.every((l) => l.ok));
  const S = systemOf(p); assert.equal(S.main.id, "BMS-CENTRAL-3X3", "the main : the board that feeds the bus side"); assert.equal(S.node.id, "CORE-1S8P-PCBA"); assert.equal(S.n, 8, "nine nodes on the bus : eight CORE boards");
});

test("the power path, read from the blocks : with the 12 V the bus side of the CORE boards lives ; without it the main lives on the module and the CORE boards are silent", () => {
  const S = systemOf(bmProject()), on = systemPower(S, { v12: true }), off = systemPower(S, { v12: false });
  for (const r of ["+12V", "VSYS", "+5V", "+3V3", "+5V_ISO", "+5V_CISO"]) assert.ok(on.main.on.has(r), r);
  assert.ok(on.bus && on.node.on.has("+5V_ISO") && on.node.on.has("+3V"), "the CORE board : its own cell block for its microcontroller, the main's 12 V for its bus side");
  assert.ok(!off.bus && !off.main.on.has("+5V_ISO") && off.main.on.has("+3V3") && off.node.on.has("+3V"), "without 12 V : standby — the main on the module, the CORE boards on their cells, no bus side");
  assert.deepEqual(off.own, ["+4V2"]); assert.ok(railsOf(S.main, ["+12V_IN"]).steps.some((x) => x.template === "dcdc_iso" && x.to === "+5V_ISO"), "the isolated DC-DC of the bus side takes the 12 V");
  assert.deepEqual(benchFromBoards(on), { wake: 1, lost: 0 }); assert.deepEqual(benchFromBoards(off), { wake: 0, lost: 1 }); assert.deepEqual(benchFromBoards(on, true), { wake: 1, lost: 1 }, "a chain cut : silent");
});

test("the round-robin : each CORE frame framed and checked, CORE 1 opens the cycle, each slot after the frame before it and its silence — the cycle within its period", () => {
  const R = roundRobin(8); assert.equal(R.slots.length, 8); assert.ok(R.fits, `${R.cycle} ms`); assert.ok(Math.abs(R.frame - (FRAME.bytes * 11 / 115200) * 1000) < 1e-9);
  for (let k = 1; k < 8; k++) assert.ok(Math.abs(R.slots[k].t0 - (R.slots[k - 1].t1 + R.gap)) < 1e-9, "after the frame before and its silence");
  assert.equal(roundRobin(8, { baud: 19200 }).fits, false, "too slow : the tool says the cycle does not hold in its period");
  const f = coreFrame(3, { mv: 3712, ntc: new Array(8).fill(251), bleed: true }); assert.equal(f.length, FRAME.bytes); assert.equal(f[0], 3); assert.equal(f[1], 0x41); assert.ok(rtuCheck(f).ok, "its CRC holds");
  assert.deepEqual([f[2], f[3]], [0x0e, 0x80]); assert.equal(f[20], 1, "balancing ON");
  const r = nodeReadings({ v: [3.7, 3.8], temp: 30.04, bleed: [0, 1] }, 2); assert.deepEqual(r.map((x) => [x.mv, x.ntc[0], x.bleed]), [[3700, 300, false], [3800, 300, true]]);
});

test("every hardware function of the main board, exercised : the software run against the module, read on the net and the pin it drives ; without the 12 V the contactor opens, and a silent round is no emergency", () => {
  const p = bmProject(), S = systemOf(p), d = p.software.find((x) => x.board === S.main.id), L = liveStart(d, 10);
  liveDrive(L, { mode: "discharge", a: 72, start: 3.9 }); for (const [k, v] of Object.entries(benchFromBoards(systemPower(S, { v12: true })))) liveSet(L, d.plant[k], v); liveStep(L, 300);
  const G = hwFunctions(S.main, d, L.m.last), all = G.flatMap((g) => g.items), it = (id) => all.find((x) => x.id === id);
  assert.equal(it("k_drv").on, 1, "the contactor closed"); assert.equal(it("k_drv").net, "DOUT0"); assert.match(it("adc_i").text, /^7[0-9] A$|^72 A$/, it("adc_i").text);
  assert.ok(G.some((g) => /Autoriser l'énergie/.test(g.name) && g.items.some((x) => x.id === "k_drv")), "under the function of the board that carries it");
  assert.ok(G.at(-1).fn === "frames" && G.at(-1).items.some((x) => x.id === "adc_v"), "what the CORE boards say, last");
  for (const [k, v] of Object.entries(benchFromBoards(systemPower(S, { v12: false })))) liveSet(L, d.plant[k], v); liveStep(L, 200);
  assert.equal(L.m.last["k_drv.level"], 0, "no 12 V : contactor open"); assert.equal(L.m.last["module.emergency"], 0, "the silent round is standby, not an emergency");
  assert.ok(SYSTEM_GAPS.length >= 4);
  const t = read("web/js/modules/elab_table.js"); assert.match(t, /\["run", "En marche", "play"\]/); assert.match(read("web/js/modules/elab_system.js"), /systemPower\(s, \{ v12: st\.v12 \}\)/);
});
