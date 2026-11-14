/* PCBA: the trade library, the function blocks, the synthesis of a board from its functions, the electrical rule check. */
import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY, CATEGORIES, checkComponent, findComponents, makeComponent } from "../../web/js/pcba/library.js";
import { footprint, packageList } from "../../web/js/pcba/footprints.js";
import { BLOCKS, BLOCK_CATEGORIES, buildBlock, blockSentence } from "../../web/js/pcba/blocks.js";
import { eSeries, ohm, farad, henry } from "../../web/js/pcba/blocks_util.js";
import { railName, netClass, checkNetName, NET_CONVENTION } from "../../web/js/pcba/netnames.js";
import { addBlock, removeBlock, rebuildBlock, connectPort, renameNet, addFunction, removeFunction, functionRows, functionTree, functionCsv, functionOutline } from "../../web/js/pcba/synth.js";
import { erc, ERC_RULES } from "../../web/js/pcba/erc.js";
import { emptyBoard, resolveBoard, boardBom } from "../../web/js/pcba/model.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { controlBoard } from "./pcba_fixture.mjs";

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
test("library: every component is complete, every package generates, a user component is built in one call", () => {
  const all = Object.values(LIBRARY);
  assert.ok(all.length >= 100, `${all.length} components`);
  for (const c of all) { assert.deepEqual(checkComponent(c), [], c.id); assert.ok(c.name && c.prefix && c.price >= 0 && typeof c.coat === "boolean"); }
  for (const name of packageList().filter((p) => !p.includes("N"))) assert.ok(footprint(name).pads.length > 0, name);
  assert.equal(footprint("HDR-1x06-2.54").pads.length, 6); assert.equal(footprint("TB-3-5.08").pads[0].shape, "rect"); assert.equal(footprint("INCONNU"), null);
  assert.equal(all.filter((c) => !c.coat).every((c) => ["connector", "terminal", "switch", "testpoint", "fiducial"].includes(c.kind)), true);
  assert.equal(footprint("WTB-4-2.0").pads.length, 4); assert.equal(footprint("SIP-4").pads.length, 4); assert.equal(footprint("USB-C-2.0").pads.filter((q) => q.drill).length, 4); assert.equal(footprint("HTSSOP-28").pads.length, 29);
  for (const q of ["QFN-16", "QFN-24", "QFN-32", "QFN-48"]) { const f = footprint(q), lands = f.pads.filter((x) => x.n !== "EP"); let gap = Infinity; for (let i = 0; i < lands.length; i++) for (let j = i + 1; j < lands.length; j++) { const a = lands[i], c = lands[j]; gap = Math.min(gap, Math.hypot(Math.max(0, Math.abs(a.x - c.x) - (a.w + c.w) / 2), Math.max(0, Math.abs(a.y - c.y) - (a.h + c.h) / 2))); } assert.ok(gap >= 0.15, `${q} : ${gap.toFixed(3)} mm between lands`); }
  assert.equal(CATEGORIES.reduce((s, cat) => s + all.filter((c) => cat.kinds.includes(c.kind)).length, 0), all.length, "every component is in a category");
  assert.deepEqual(findComponents("régulateur abaisseur").map((c) => c.id).sort(), ["U-BUCK-SOIC8", "U-BUCK-SOT23-6"]);
  const mine = makeComponent({ id: "U-MONCAPTEUR", kind: "sensor", name: "Capteur de pression", package: "SOIC-8", pins: ["VDD", "GND", "SCL", "SDA", "NC", "NC", "INT", "NC"] });
  assert.deepEqual(checkComponent(mine), []); assert.equal(mine.pins[0].type, "power_in"); assert.equal(mine.pins[2].type, "in"); assert.equal(mine.prefix, "U");
  assert.throws(() => makeComponent({ id: "X", package: "RIEN" }), /Boîtier inconnu/);
  assert.ok(checkComponent({ id: "Y", pins: [{ n: "1", name: "A" }], pads: [{ n: "2", x: 0, y: 0, w: 1, h: 1 }], body: [1, 1, 1] }).length >= 2);
});

test("blocks: every template builds from its defaults and only names parts and pins that exist ; sizing matches the hand calculation", () => {
  assert.ok(Object.keys(BLOCKS).length >= 18);
  for (const [id, t] of Object.entries(BLOCKS)) {
    assert.ok(BLOCK_CATEGORIES.includes(t.category), id);
    const b = buildBlock(id), ids = new Map(b.parts.map((p) => [p.id, p]));
    for (const p of b.parts) assert.ok(LIBRARY[p.comp], `${id}: ${p.comp}`);
    for (const n of b.nets) for (const pin of n.pins) { const dot = pin.indexOf("."), def = LIBRARY[ids.get(pin.slice(0, dot)).comp], key = pin.slice(dot + 1); assert.ok(def.pins.some((q) => q.n === key || q.name === key), `${id}: ${pin}`); }
    assert.ok(!blockSentence(t, b.params).includes("{"), id);
  }
  near(eSeries(52500, "E96"), 52300, 1); near(eSeries(13e-6, "E6", "up"), 15e-6, 1e-9); assert.equal(ohm(4700), "4,7 kΩ"); assert.equal(farad(1e-7), "100 nF"); assert.equal(henry(33e-6), "33 µH");
  const bk = buildBlock("buck", { vin: 24, vout: 5, iout: 1, ripple: 30 }), calc = Object.fromEntries(bk.calc.map((c) => [c.label, c.value]));
  near(calc.Inductance, 33, 1e-9);                             // 5 × 19 / (24 × 500 kHz × 0.3 A) = 26.4 µH → 33 µH
  near(calc["Tension de sortie réelle"], 0.8 * (1 + 52300 / 10000), 1e-9);                             // 4.984 V
  assert.equal(bk.parts.find((p) => p.id === "L").comp, "L-4040"); assert.equal(buildBlock("buck", { iout: 3 }).parts.find((p) => p.id === "U").comp, "U-BUCK-SOIC8");
  near(buildBlock("led", { v: 3.3, i: 2 }).calc[0].value, 680, 1e-9);                                  // (3.3 − 2) / 2 mA = 650 Ω → 680 Ω
  near(buildBlock("shunt", { imax: 10, vdd: 3.3 }).calc[0].value, 13, 1e-9);                           // 0.9 × 3.3 / (20 × 10) = 14.85 mΩ → 13 mΩ, below
  assert.equal(buildBlock("input_protection", { v: 24, i: 3 }).calc[0].value, 5); assert.equal(buildBlock("conn_io", { signals: "A,B,C,D,E" }).parts[0].comp, "J-HDR-1x05");
  assert.throws(() => buildBlock("rien"), /Bloc inconnu/);
});

test("net names: rails, classes and the convention", () => {
  assert.deepEqual([24, 3.3, 1.8, -12].map(railName), ["+24V", "+3V3", "+1V8", "-12V"]);
  assert.deepEqual(["GND", "+24V_IN", "CAN_H", "+400V"].map((n) => netClass(n, n === "+400V" ? 400 : 0)), ["ground", "power", "signal", "hv"]);
  assert.equal(checkNetName("B3_SW").ok, true); assert.equal(checkNetName("can_h").ok, false); assert.ok(NET_CONVENTION.length >= 6);
});

test("synthesis: a control board assembled function by function resolves, passes the electrical check and reads as a functional tree", () => {
  const b = controlBoard(), R = resolveBoard(b, LIBRARY);
  assert.deepEqual(R.problems, []); assert.equal(b.blocks.length, 11); assert.equal(b.functions.length, 11); assert.ok(b.parts.length > 50 && b.nets.length > 20);
  assert.deepEqual(new Set(b.parts.map((p) => p.ref)).size, b.parts.length, "repères are unique");
  assert.deepEqual(b.nets.find((n) => n.name === "CAN_TX").pins.sort(), ["U3.PA12", "U4.TXD"]);          // the microcontroller pin joined the net the CAN block brought
  assert.ok(b.nets.find((n) => n.name === "AIN0").pins.includes("U3.PA0")); assert.ok(!b.nets.some((n) => n.name === "UART_TX"), "an unused pin makes no net");
  assert.equal(b.nets.find((n) => n.name === "GND").class, "ground"); assert.equal(b.nets.find((n) => n.name === "+24V").current, 2);
  const e = erc(b);
  assert.equal(e.summary.error, 0, e.findings.filter((f) => f.severity === "error").map((f) => f.message).join(" | ")); assert.equal(e.summary.warn, 0);
  const rows = functionRows(b), buck = rows.find((r) => r.template === "buck");
  assert.equal(rows.length, 11); assert.equal(buck.parts.length, 10); assert.ok(buck.nets.includes("+5V") && buck.nets.includes("B3_SW")); assert.ok(buck.cost > 1.5);
  assert.equal(functionTree(b).length, 11); assert.equal(functionCsv(rows).split("\r\n").length, 13); assert.ok(functionCsv(rows).startsWith("﻿Repère;Niveau"));
  assert.match(functionOutline(rows), /F3 {2}Abaisser 24 V vers 5 V, 1 A {2}\[principale\] {2}→ B3 Régulateur abaisseur \(10 composants\)/);
  assert.ok(boardBom(b, LIBRARY).length < b.parts.length);
  assert.deepEqual(fromDwiz(toDwiz(b)), b, "the board is lossless in .dwiz");
});

test("synthesis: rebuilding keeps repères and positions, removing cleans up, ports can be re-bound", () => {
  const b = controlBoard(), u = b.parts.find((p) => p.block === "B5" && p.local === "U");
  u.at = [30, 40]; u.fixed = true;
  rebuildBlock(b, "B5", { pins: 32, xtal: 0 });
  const u2 = b.parts.find((p) => p.ref === u.ref);
  assert.equal(u2.comp, "U-MCU-LQFP32"); assert.deepEqual(u2.at, [30, 40]); assert.equal(u2.fixed, true); assert.ok(!b.parts.some((p) => p.block === "B5" && p.local === "Y"));
  assert.deepEqual(resolveBoard(b, LIBRARY).problems, []); assert.match(b.functions.find((f) => f.block === "B5").name, /32 broches/);
  connectPort(b, "B9", "IN", "+3V3");                           // the LED becomes a power indicator
  const rled = b.parts.find((p) => p.block === "B9" && p.local === "R").ref;
  assert.ok(b.nets.find((n) => n.name === "+3V3").pins.includes(`${rled}.1`)); assert.ok(!b.nets.some((n) => n.name === "LED_STATUS"));
  removeBlock(b, "B6");
  assert.ok(!b.nets.some((n) => n.name === "CAN_TX")); assert.ok(!b.parts.some((p) => p.block === "B6")); assert.ok(!b.functions.some((f) => f.name === "Communiquer sur le bus CAN"));
  assert.ok(erc(b).findings.some((f) => f.rule === "ERC-04" && f.nets[0] === "CAN_H"));
  renameNet(b, "+24V_IN", "+VBAT"); assert.ok(b.nets.some((n) => n.name === "+VBAT")); assert.equal(b.blocks[0].connect.VIN, "+VBAT");
  const f = addFunction(b, { name: "Mesurer la vitesse", kind: "principale", criteria: [{ name: "Précision", level: "± 1 %", flex: "F1" }] }), c = addFunction(b, { parent: f, name: "Compter les impulsions" });
  assert.equal(c, `${f}.1`); assert.ok(erc(b).findings.some((x) => x.rule === "ERC-01" && x.message.includes("Compter"))); addBlock(b, "rs485", {}, { function: c });
  assert.equal(b.functions.find((x) => x.id === c).block, b.blocks[b.blocks.length - 1].id);
  removeFunction(b, f); assert.ok(!b.functions.some((x) => x.id === c)); assert.ok(erc(b).findings.some((x) => x.rule === "ERC-02"));
});

test("electrical check: a supply without a source, a pin in the air, an under-rated capacitor are caught", () => {
  const b = emptyBoard("X"); addBlock(b, "half_bridge", {}); addBlock(b, "shunt", { imax: 20, vbus: 48 });
  const e = erc(b);
  assert.ok(e.findings.some((f) => f.rule === "ERC-06" && f.nets[0] === "+3V3"), "the amplifier supply has no source");
  assert.ok(e.findings.some((f) => f.rule === "ERC-04" && f.nets[0] === "PWM_H"));
  b.nets.find((n) => n.name === "GND").pins = b.nets.find((n) => n.name === "GND").pins.filter((p) => p !== "U1.COM");
  assert.ok(erc(b).findings.some((f) => f.rule === "ERC-03" && f.severity === "error" && f.refs[0] === "U1"));
  const c = emptyBoard("Y"); addBlock(c, "buck", { vin: 48, vout: 5 }); c.parts.find((p) => p.local === "CHF").comp = "C-0603";
  assert.ok(erc(c).findings.some((f) => f.rule === "ERC-08" && /50 V/.test(f.message) && /48 V/.test(f.message)));
  assert.equal(ERC_RULES.length, 11);
});
