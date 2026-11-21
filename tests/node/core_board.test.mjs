/* The CORE board (architecture de JP, 21 novembre 2026 : une petite carte par CORE de 8 cellules 21700 en parallèle, posée sur son
   dessus ; les 8 CTN sur les rabats d'un flex ; RS-485 isolé, côté bus alimenté par le faisceau ; équilibrage passif).
     node --test tests/node/core_board.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBlock } from "../../web/js/pcba/blocks.js";
import { blockTests, runTest } from "../../web/js/pcba/lab_bench.js";
import { footprint } from "../../web/js/pcba/footprints.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { coreBoard, CORE_BOARD_ID } from "../../web/js/demo/demo_core.js";
import { rs485Links } from "../../web/js/sw/hwsw.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const ports = (o) => Object.fromEntries(Object.entries(o.ports).map(([k, v]) => [k, v.suggest]));
const meas = (r, label) => r.measures.find((m) => m.label.startsWith(label));

test("passive balancing : two bleed resistors across the cell block on command, sized from the current asked, tried on the bench", () => {
  const o = buildBlock("balance", { v: 4.2, i: 100 }), c = (l) => o.calc.find((x) => x.label.startsWith(l)).value;
  assert.deepEqual(o.parts.map((p) => p.comp), ["Q-NMOS-SOT23-P", "R-2512", "R-2512", "R-0603", "R-0603"]);
  assert.deepEqual(ports(o), { VCELL: "+4V2", IN: "DOUT", GND: "GND" }); assert.equal(o.ports.IN.pool, true, "a logic output of the microcontroller");
  assert.equal(c("Résistances de purge"), 91, "2 × 4,2 V / 100 mA = 84 Ω, the E24 value above : 91 Ω each");
  assert.ok(Math.abs(c("Courant de purge") - 92.3) < 0.1); assert.ok(c("Puissance dans chaque résistance") > 0.125, "over half of a 1206 : the 2512");
  assert.equal(buildBlock("balance", { v: 4.2, i: 20 }).parts[1].comp, "R-1206", "a small current keeps the small package");
  assert.match(o.notes.join(" "), /purge coupée/);
  assert.deepEqual(blockTests("balance").map((t) => t.id), ["power", "bleed"]);
  const r = runTest("balance", "bleed", { v: 4.2, i: 100 });
  assert.ok(Math.abs(meas(r, "Courant de purge").value - 0.0923) < 0.003, `${meas(r, "Courant de purge").value} A`);
  assert.ok(meas(r, "Tension du drain, purge en marche").value < 0.05); assert.ok(Math.abs(meas(r, "Tension du drain, purge coupée").value - 4.2) < 0.01);
});

test("an NTC on a flex : the bridge stays on the board, the probe comes by the joint ; the bench reads the same curve", () => {
  const on = buildBlock("ntc", { vref: 3.0 }), off = buildBlock("ntc", { vref: 3.0, remote: 1 });
  assert.ok(on.parts.some((p) => p.comp === "NTC-0603")); assert.ok(!off.parts.some((p) => p.comp === "NTC-0603"), "no probe on the board");
  assert.equal(off.ports.NTC.suggest, "NTC"); assert.equal(off.ports.NTC.pool, true); assert.equal(on.ports.NTC, undefined);
  const a = runTest("ntc", "levels", { vref: 3.0 }).table.rows.map((x) => x.y.toFixed(4)), b = runTest("ntc", "levels", { vref: 3.0, remote: 1 }).table.rows.map((x) => x.y.toFixed(4));
  assert.deepEqual(b, a); assert.equal(+a[1], 1.5, "half the reference at 25 °C");
});

test("an RS-485 whose bus side is isolated, an isolator that carries the serial link, a flex joint, two more analog inputs", () => {
  assert.deepEqual(ports(buildBlock("rs485", { vdd: 5 })), { VCC: "+5V", GND: "GND", DI: "UART_TX", RO: "UART_RX", DE: "RS485_DE", A: "RS485_A", B: "RS485_B" }, "by default, as before");
  assert.deepEqual(ports(buildBlock("rs485", { vdd: 5, iso: 1 })), { VCC: "+5V_ISO", GND: "GND_ISO", DI: "ISO_UART_TX", RO: "ISO_UART_RX", DE: "ISO_RS485_DE", A: "RS485_A", B: "RS485_B" });
  const spi = ports(buildBlock("iso_digital", {})), uart = ports(buildBlock("iso_digital", { uart: 1, v1: 3, v2: 5 }));
  assert.equal(spi.INA, "SPI_SCK"); assert.equal(spi.OUTD, "SPI_MISO");
  assert.deepEqual([uart.INA, uart.OUTA, uart.INB, uart.OUTB, uart.IND, uart.OUTD, uart.VDD2, uart.GND2], ["UART_TX", "ISO_UART_TX", "RS485_DE", "ISO_RS485_DE", "ISO_UART_RX", "UART_RX", "+5V_ISO", "GND_ISO"]);
  assert.equal(uart.INC, undefined, "the third channel is not used");
  const j = buildBlock("conn_wire", { signals: "A,B,C,D,E,F,G,H,I,J,K,L", flex: 1 }); assert.equal(j.parts[0].comp, "J-FLEX-12");
  const fp = footprint("FLEXJ-12-1.0"); assert.equal(fp.pads.length, 12); assert.ok(Math.abs(fp.pads[1].x - fp.pads[0].x - 1.0) < 1e-9, "1 mm pitch");
  assert.ok(LIBRARY["J-FLEX-12"] || (Array.isArray(LIBRARY) && LIBRARY.some((p) => p.id === "J-FLEX-12")));
  const mcu = buildBlock("mcu", { pins: 48 }); assert.equal(mcu.ports.AIN7.pin, "U.PA7"); assert.equal(mcu.ports.AIN8.pin, "U.PB0"); assert.equal(mcu.ports.AIN7.lazy, true);
});

test("the CORE board : the size of the top of a CORE, eight probes by the flex, its voltage, its balancing, its isolated bus — clean", () => {
  const b = coreBoard(); assert.equal(b.id, CORE_BOARD_ID); assert.deepEqual(b.board.size, [92.8, 46.4]);
  const net = (n) => b.nets.find((x) => x.name === n), parts = new Map(b.parts.map((p) => [p.ref, p])), comps = (n) => (net(n) ? net(n).pins.map((x) => parts.get(x.split(".")[0]).comp) : []);
  for (let i = 0; i < 8; i++) assert.ok(comps(`NTC${i}`).includes("J-FLEX-12"), `NTC${i} reaches the flex joint`);
  assert.ok(!b.parts.some((p) => p.comp === "NTC-0603"), "no probe on the rigid board : they are on the flaps");
  assert.ok(comps("+4V2").includes("J-FLEX-12") && comps("GND").includes("J-FLEX-12"), "B+ and B− come by the flex");
  for (let k = 0; k <= 8; k++) assert.ok(net(`AIN${k}`), `AIN${k} : 8 probes and the voltage of the CORE`);
  const en = b.blocks.find((x) => x.template === "balance").connect.IN; assert.ok(comps(en).some((c) => /^U-MCU/.test(c)) && comps(en).includes("R-0603"), `the microcontroller drives the balancing (${en})`);
  const bus = new Set([...comps("+5V_ISO"), ...comps("GND_ISO")]); assert.ok(bus.has("U-RS485-SOIC8") && bus.has("U-ISO-SOIC16W") && bus.has("J-WTB-4"));
  assert.ok(!comps("GND").includes("U-RS485-SOIC8") && !comps("+3V").includes("U-RS485-SOIC8"), "the transceiver lives on the bus side only");
  assert.equal(comps("RS485_A").filter((c) => c === "J-WTB-4").length, 2, "in chain : in and out");
  const e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY); assert.equal(e.summary.error, 0); assert.equal(d.summary.error, 0);
  const L = rs485Links(b)[0]; assert.deepEqual(L.problems, []); assert.deepEqual(L.pins.map((p) => p.mcu.split(".")[1]), ["PA9", "PA10", "PB1"]);
  assert.ok(L.pins.every((p) => /↔/.test(p.via)), "followed across the isolator"); assert.match(L.bus[0].at, /J\d+\.1, J\d+\.1/);
  assert.ok(b.functions.some((f) => /dessus du CORE/.test(f.name) && f.kind === "contrainte"));
  for (const f of ["web/js/demo/demo_core_data.js", "web/js/demo/demo_core_data2.js"]) assert.ok(read(f).split("\n").length < 500, f);
});

test("wired : the example in the PCBA, the sources, the news, the documents", () => {
  const pcba = read("web/js/modules/pcba.js"); assert.match(pcba, /coreButton\(false\)/); assert.match(pcba, /coreButton\(true\)/); assert.match(pcba, /dataset\.coreExample/);
  assert.ok(METHODS.some((m) => m.id === "core-board")); assert.ok(METHODS.some((m) => m.id === "balance-passive"));
  assert.ok(NEWS.some((n) => n.v === "0.130.0" && n.where === "#/pcba" && /data-core-example/.test(n.sel)));
  assert.match(read("docs/PCBA.md"), /Carte de CORE/); assert.match(read("tools/gen_demo_core.mjs"), /DEMO_CORE_1/);
});
