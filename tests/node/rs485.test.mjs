// RS-485, from the part to the code : the published values and the worked examples they give back, the block of the board, its
// tests on the simulated bench, the model of the link, the C driver the tool writes, and the hardware / software interface.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RS485, RS485_FACTS, RS485_SOURCES, RS485_SERIES, biasResistor, biasNetwork, idleVoltage, unitLoadsLeft, stubMax, rateFor, rs485Guide } from "../../web/js/pcba/rs485.js";
import { RTU, RTU_RULES, RTU_VECTORS, crc16, rtuFrame, rtuCheck, charBits, frameBits, charTime, silences, frameTime, rtuReceiver, replayVectors } from "../../web/js/sw/rs485_link.js";
import { cDriver, cExpected } from "../../web/js/sw/rs485_c.js";
import { rs485Links, hwswDoc, driverFiles, linkTimes, hwswGuide } from "../../web/js/sw/hwsw.js";
import { BLOCKS, blockParams } from "../../web/js/pcba/blocks.js";
import { runTest, blockTests } from "../../web/js/pcba/lab_bench.js";
import { boardSheets } from "../../web/js/pcba/lab_plan.js";
import { manipSteps } from "../../web/js/pcba/lab_manip.js";
import { rs485Board, RS485_BOARD_ID } from "../../web/js/demo/demo_rs485.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { isMarked } from "../../web/js/core/brand.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";
import { glossary } from "../../web/js/core/terms.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), near = (a, b, rel) => Math.abs(a - b) <= Math.abs(b) * rel;
const build = (given = {}) => { const T = BLOCKS.rs485; return T.build(blockParams(T, given)); }, val = (o, id) => (o.parts.find((p) => p.id === id) || {}).value;

test("the bias of an idle bus : the worked examples of two published notes come back", () => {
  /* TI SLYT324, eq. 6 and its example, p. 2-3 : 4.75 V, 0.25 V → 556 Ω ; the next lower E96 value, 549 Ω ; RT2 = 134 Ω → 133 Ω ; 10.14 unit loads */
  assert.ok(near(biasResistor(4.75, 0.25), 556, 0.002)); const a = biasNetwork({ vs: 4.75, vab: 0.25 });
  assert.equal(a.rbStd, 549); assert.equal(Math.floor(a.rt2), 134); assert.equal(a.rt2Std, 133); assert.ok(near(a.left, 10.14, 0.002)); assert.ok(a.idle >= 0.25 && !a.short);
  /* Renesas AN1986, § 4.1, p. 7 : 4.75 V, 0.3 V → 467.6 Ω ; with the 470 Ω it chooses : RT2 = 137.6 Ω and 6.4 unit loads */
  assert.ok(near(biasResistor(4.75, 0.3), 467.6, 0.0005)); assert.ok(near((2 * 470 * 120) / (2 * 470 - 120), 137.6, 0.0005)); assert.equal(Math.floor(unitLoadsLeft(470) * 10) / 10, 6.4);
  assert.ok(near(idleVoltage(4.75, biasResistor(4.75, 0.25)), 0.25, 1e-9), "the idle voltage is the formula read the other way");
  /* a low supply : the formula asks for a resistor that would leave the bus less than its transceivers need — it is raised, and it is said */
  const low = biasNetwork({ vs: 3.135, loads: 1 }); assert.ok(unitLoadsLeft(low.rb) < 1 && low.rbStd > low.rb && low.left >= 1 && low.short && low.idle < 0.25 && low.idle > 0.2); assert.equal(RS485.rcm, 375);
  /* TI SLLA272D, table 6-1, p. 3 : the stub for a rise time, on a cable of 78 % — 7, 19 and 38 ft */
  assert.deepEqual([100e-9, 250e-9, 500e-9].map((t) => Math.floor(stubMax(t) / 0.3048)), [7, 19, 38]);
  assert.deepEqual(rateFor(100), { careful: 1e5, loose: 1e6 }, "both printed rules of thumb are kept");
});

test("what is published says where : every value has its source, and the standard itself is said not read", () => {
  for (const f of RS485_FACTS) { assert.ok(RS485_SOURCES[f.src], f.id); assert.ok(f.where.length > 3 && f.text.length > 10 && f.label, f.id); }
  for (const s of Object.values(RS485_SOURCES)) assert.match(s.url, /^https:\/\/(www\.ti\.com|www\.renesas\.com|www\.modbus\.org)\//);
  for (const s of RS485_SERIES) assert.ok(RS485_SOURCES[s.src] && s.maker && s.series);
  assert.match(read("web/js/pcba/rs485.js"), /TIA\/EIA-485-A — is sold, and was NOT read/);
  const m = Object.fromEntries(METHODS.filter((x) => /^(rs485|modbus|hwsw)/.test(x.id)).map((x) => [x.id, x.how])); assert.deepEqual(m, { "rs485-notes": "read", "rs485-tia": "unread", "modbus-serial": "read", "hwsw-driver": "tested" });
  const g = glossary().map((r) => r.en); for (const t of ["Transceiver", "Termination", "Failsafe biasing", "Stub", "Unit load (UL)", "Hardware / software interface"]) assert.ok(g.includes(t), t);
});

test("the block : the whole link on the board, sized from what was read", () => {
  const d = build(); assert.deepEqual(d.parts.map((p) => p.id), ["U", "C", "RDE", "RSA", "RSB", "D", "RT", "J"]); assert.equal(val(d, "RT"), "120 Ω 1 %"); assert.equal(val(d, "RDE"), "10 kΩ");
  const net = (o, n) => (o.nets.find((x) => x.name === n) || { pins: [] }).pins;
  assert.deepEqual(net(d, "DE").sort(), ["RDE.1", "U.DE", "U.RE_N"], "DE and RE are tied, and pulled to the driver-off state"); assert.ok(net(d, "GND").includes("RDE.2"));
  assert.deepEqual(net(d, "BUS_A").sort(), ["D.IO1", "J.1", "RSA.2", "RT.1"]); assert.deepEqual(net(d, "A").sort(), ["RSA.1", "U.A"], "the series resistor sits between the pin and the suppressor");
  assert.equal(d.ports.A.net, "BUS_A"); assert.equal(d.ports.DI.suggest, "UART_TX"); assert.equal(d.ports.DE.suggest, "RS485_DE");
  const five = build({ bias: 1, vdd: 5 }); assert.equal(val(five, "RBU"), "549 Ω 1 %"); assert.equal(val(five, "RBD"), "549 Ω 1 %"); assert.equal(val(five, "RT"), "133 Ω 1 %", "at 5 V the block is the printed example");
  assert.ok(net(five, "VCC").includes("RBU.1") && net(five, "BUS_A").includes("RBU.2") && net(five, "BUS_B").includes("RBD.1") && net(five, "GND").includes("RBD.2"), "A is pulled up, B is pulled down");
  assert.ok(five.calc.some((c) => /polarisation/.test(c.label) && /AN1986/.test(c.text)) && five.calc.some((c) => /repos/.test(c.label)) && five.calc.some((c) => /Charges unitaires/.test(c.label)));
  const three = build({ bias: 1 }); assert.equal(val(three, "RBU"), "392 Ω 1 %"); assert.ok(three.calc.find((c) => /repos/.test(c.label)).text.includes("SOUS les 0,25 V"), "at 3.3 V the block says what it cannot hold");
  const bare = build({ term: 0, prot: 0, conn: 0 }); assert.deepEqual(bare.parts.map((p) => p.id), ["U", "C", "RDE"]); assert.equal(bare.ports.A.net, "A");
  assert.ok(d.notes.some((n) => /routées ensemble/.test(n)) && d.notes.some((n) => /au plus près du bornier/.test(n)) && d.notes.some((n) => /UN seul endroit/.test(n)) && d.notes.some((n) => /D1 de MODBUS/.test(n)));
  for (const o of [d, five, three]) for (const p of o.parts) assert.ok(LIBRARY[p.comp] || Object.values(LIBRARY).some((x) => x.id === p.comp), `${p.comp} is in the library`);
  assert.deepEqual(rs485Guide({ vdd: 5, bias: 1, term: 1, prot: 1, nodes: 8 }), []); assert.ok(rs485Guide({ vdd: 5, bias: 1, term: 1, prot: 1, nodes: 200 }).some((x) => x.level === "error"), "too many nodes for what the bias leaves");
  assert.ok(rs485Guide({ term: 1, prot: 1, rate: 1e6, length: 500 }).some((x) => x.level === "error") && rs485Guide({ prot: 0, term: 1 }).some((x) => x.level === "warn"));
});

test("the link on the bench : levels, the bus at rest, a frame — each test runs, and reads what the design says", () => {
  assert.deepEqual(blockTests("rs485").map((t) => t.id).sort(), ["frame", "idle", "levels", "power"]);
  for (const t of blockTests("rs485")) assert.ok(t.why && t.learn && t.expect, `${t.id} says why, what to expect, what to keep`);
  const m = (R, re) => R.measures.find((x) => re.test(x.label));
  let R = runTest("rs485", "levels", {}); assert.ok(R.ok && m(R, /pour un 1/).value > 1.2 && m(R, /pour un 0/).value < -1.2);
  R = runTest("rs485", "levels", { prot: 0 }); assert.ok(m(R, /pour un 1/).value > 1.5, "without the series resistors, the bus sees the 1.5 V of the pins");
  R = runTest("rs485", "idle", { bias: 1, vdd: 5 }); assert.ok(R.ok); const idle = m(R, /au repos/); assert.ok(idle.value > 0.2 && near(idle.value, idle.design, 0.03), "the bias holds the idle bus above the threshold, where the design said"); assert.ok(near(m(R, /RO/).value, 5, 0.02)); assert.match(R.expect, /au-dessus du seuil de 0,2 V/); assert.match(R.expect, /le rappel de la carte tient l'émetteur coupé/); assert.ok(!R.log.some((e) => e.instr === "generator"), "nothing drives DE : the pull of the board is what is tested");
  R = runTest("rs485", "idle", {}); assert.ok(Math.abs(m(R, /au repos/).value) < 0.01); assert.match(R.expect, /Sans polarisation/); assert.match(R.expect, /comportement typique/);
  R = runTest("rs485", "frame", {}); assert.ok(R.ok); assert.ok(near(m(R, /DE tient/).value, 45 / 19200, 0.01), "DE holds the bus for the frame and one bit before it"); assert.match(R.expect, /02 07 41 12/); assert.ok(m(R, /pour un 1/).value > 1.2);
  /* on the example board : the tests are in its plan, and the bench mode points at its pads */
  const b = rs485Board(), sheets = boardSheets(b), mine = sheets.filter((s) => s.tpl === "rs485"); assert.deepEqual(mine.map((s) => s.test), ["power", "levels", "idle", "frame"]); assert.ok(sheets.every((s) => s.ok));
  const Rb = resolveBoard(b, LIBRARY), named = mine.flatMap((s) => manipSteps(s).flatMap((x) => x.points)).filter((p) => p.ref); assert.ok(named.length > 15 && named.every((p) => Rb.pads.some((q) => q.ref === p.ref)));
});

test("the model of the link : the frames printed by others, the character, the silences", () => {
  assert.equal(crc16([0x02, 0x07]), 0x1241); assert.deepEqual(rtuFrame(2, 7), [0x02, 0x07, 0x41, 0x12], "the low byte of the CRC goes first");
  const R = replayVectors(); assert.equal(R.length, 4); assert.ok(R.every((r) => r.ok), "each printed frame comes back"); assert.deepEqual(R.map((r) => r.crc), ["41 12", "76 87", "49 AD", "9A 9B"]);
  for (const v of RTU_VECTORS) { assert.equal(v.read, "read"); assert.match(v.url, /^https:\/\//); assert.ok(v.printed && v.where && v.source, v.id); assert.ok(rtuCheck(v.bytes).ok); }
  assert.equal(RTU_VECTORS[0].source.startsWith("MODBUS over Serial Line"), true, "one frame comes from the specification itself");
  assert.deepEqual(charBits(0x02), [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1]); assert.deepEqual(charBits(0x07), [0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1], "even parity : three ones call for one more"); assert.equal(frameBits([2, 7]).length, 22);
  assert.ok(near(charTime(), 11 / 19200, 1e-12)); assert.deepEqual(silences(115200), { t15: 750e-6, t35: 1750e-6 }); assert.ok(near(silences().t35, 3.5 * 11 / 19200, 1e-12)); assert.ok(near(frameTime(4, 19200, 1 / 19200), 45 / 19200, 1e-12));
  assert.equal(rtuFrame(248, 3), null); assert.equal(rtuFrame(1, 0), null); assert.equal(rtuFrame(1, 3, new Array(253).fill(0)), null); assert.equal(rtuCheck([1, 2, 3]).ok, false);
  const bad = [...RTU_VECTORS[1].bytes]; bad[3] ^= 4; assert.equal(rtuCheck(bad).ok, false);
  const rx = rtuReceiver(), T = charTime(); let t = 0; for (const b of RTU_VECTORS[1].bytes) { rx.feed(b, t); t += T; } assert.equal(rx.poll(t), null, "no frame before the silence"); assert.equal(rx.poll(t + silences().t35).ok, true);
  t = 1; RTU_VECTORS[1].bytes.forEach((b, k) => { rx.feed(b, t); t += T + (k === 2 ? silences().t15 * 1.1 : 0); }); assert.equal(rx.poll(t + 1).ok, false, "a gap inside the frame throws it away");
  for (const r of Object.values(RTU_RULES)) assert.ok(r.text.length > 20 && /p\. \d+/.test(r.where)); assert.equal(RTU.poly, 0xa001); assert.equal(RTU.init, 0xffff);
});

test("the C driver the tool writes : sober C, marked, and — compiled — it prints what the model says", (t) => {
  const files = cDriver({ board: "NODE-485-PCBA", pins: rs485Links(rs485Board())[0].pins }), by = Object.fromEntries(files.map((f) => [f.name, f.text]));
  assert.deepEqual(files.map((f) => f.name), ["rs485_link.h", "rs485_link.c", "rs485_link_test.c", "rs485_vectors.txt"]);
  for (const f of files) assert.ok(/DynamiteOrbit\(TM\) by DynamiteAgile\(TM\)/.test(f.text), `${f.name} carries the note of the platform`);
  const h = by["rs485_link.h"], c = by["rs485_link.c"];
  assert.match(h, /#define RS485_BAUD\s+19200u/); assert.match(h, /#define RS485_T15_US\s+859u/); assert.match(h, /#define RS485_T35_US\s+2005u/); assert.match(h, /#define RS485_CHAR_US\s+573u/); assert.match(h, /RS485_UART_TX\s+U2\.PA9\s+-> DI/); assert.match(h, /RS485_UART_RX\s+U2\.PA10\s+<- RO/); assert.match(h, /RS485_DE\s+U2\.PB1\s+-> DE/);
  assert.match(c, /0xFFFFu/); assert.match(c, /0xA001u/); assert.ok(!/malloc|calloc|free\(|#include <stdlib|#include <string/.test(h + c), "no allocation, no library beyond the fixed-width types"); assert.ok(!/\b(int|long|short|unsigned|char)\b(?! \*)/.test(c.replace(/\/\*[\s\S]*?\*\//g, "")), "fixed-width types only in the driver");
  assert.match(c, /tx_complete\(\) != 0u/, "the bus is given back on transmission complete");
  assert.equal(cExpected().at(-1), "ALL PASS"); assert.equal(cExpected().filter((l) => l.startsWith("vector ")).length, 4);
  const cc = spawnSync("cc", ["--version"]); if (cc.error || cc.status !== 0) { t.diagnostic("no C compiler here : the back-to-back run is skipped"); return; }
  const dir = mkdtempSync(join(tmpdir(), "dw-rs485-")); for (const f of files) writeFileSync(join(dir, f.name), f.text);
  const made = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", "-o", join(dir, "t"), join(dir, "rs485_link.c"), join(dir, "rs485_link_test.c")], { encoding: "utf8" }); assert.equal(made.status, 0, `the driver compiles without a warning\n${made.stderr}`);
  const ran = spawnSync(join(dir, "t"), [], { encoding: "utf8" }); assert.equal(ran.status, 0); assert.deepEqual(ran.stdout.trim().split("\n"), cExpected(), "back to back : the C prints what the model says");
});

test("the hardware / software interface, read from the board", () => {
  const b = rs485Board(); assert.equal(b.id, RS485_BOARD_ID); const L = rs485Links(b); assert.equal(L.length, 1);
  assert.deepEqual(L[0].pins.map((p) => [p.sw, p.mcu, p.signal, p.net]), [["RS485_UART_TX", "U2.PA9", "DI", "UART_TX"], ["RS485_UART_RX", "U2.PA10", "RO", "UART_RX"], ["RS485_DE", "U2.PB1", "DE", "RS485_DE"]]);
  assert.deepEqual(L[0].bus.map((x) => [x.net, x.at]), [["RS485_A", "J2.1"], ["RS485_B", "J2.2"], ["GND", "J2.3"]]); assert.ok(L[0].bus[0].parts.some((x) => /549 Ω/.test(x)) && L[0].bus[0].parts.some((x) => /133 Ω/.test(x)) && L[0].bus[0].parts.some((x) => /^D\d/.test(x)));
  assert.deepEqual(L[0].problems, []); assert.deepEqual(hwswGuide(b), []);
  const cut = JSON.parse(JSON.stringify(b)); for (const n of cut.nets) n.pins = n.pins.filter((p) => p !== "U2.PB1"); assert.ok(hwswGuide(cut).some((g) => /DE \(RS485_DE\) n'est relié à aucune broche/.test(g.text)), "a signal the microcontroller does not drive is said");
  assert.equal(linkTimes().length, 7); assert.match(linkTimes()[2][1], /859/);
  const doc = hwswDoc(b, { date: new Date(Date.UTC(2026, 10, 20)) }), text = JSON.stringify(doc.blocks); assert.equal(doc.reference, "NODE-485-PCBA-ICD-485");
  for (const w of ["U2.PA9", "RS485_DE", "J2.1", "transmission terminée", "02 07 41 12", "n'a PAS été lue", "SQUELETTE", "Simulé, non mesuré", "DO-160"]) assert.ok(text.includes(w), w);
  const w = docx({ ...doc, kind: "Interface matériel / logiciel" }), p = pdfDoc({ ...doc, kind: "Interface matériel / logiciel" }); assert.ok(w.length > 20000 && p.length > 10000);
  assert.deepEqual(driverFiles(b).map((f) => f.name), ["rs485_link.h", "rs485_link.c", "rs485_link_test.c", "rs485_vectors.txt"]); assert.ok(isMarked(driverFiles(b)[3].text));
});

test("the example board : a node that answers on an RS-485 bus, from its functions to its copper", () => {
  const b = rs485Board(), e = erc(b, LIBRARY), d = checkBoard(b, LIBRARY); assert.equal(e.summary.error, 0); assert.equal(e.summary.warn, 0); assert.equal(d.summary.error, 0);
  assert.deepEqual(b.blocks.map((x) => x.template), ["conn_io", "ldo", "mcu", "rs485", "ntc", "led", "conn_swd", "test"]); assert.ok(b.tracks.length > 50 && b.parts.length > 35);
  const routed = new Set(b.tracks.map((t) => t.net)); for (const n of ["RS485_A", "RS485_B", "UART_TX", "UART_RX", "RS485_DE"]) assert.ok(routed.has(n), `${n} has its copper`);
  assert.match(read("tools/gen_demo_rs485.mjs"), /addBlock\(b, "rs485", \{ term: 1, bias: 1, prot: 1, conn: 1, nodes: 8, vdd: 5 \}/); assert.ok(read("web/js/demo/demo_rs485_data.js").split("\n").length < 500);
});

test("on the screens : the example, the interface section, what is new", () => {
  const pcba = read("web/js/modules/pcba.js"), out = read("web/js/modules/pcba_out.js");
  assert.match(pcba, /b\.dataset\.example = "rs485"/); assert.match(pcba, /if \(store\.board\(RS485_BOARD_ID\)\)/, "one copy of the example per project");
  assert.match(out, /sec\.dataset\.hwsw = ""/); assert.match(out, /download\(`\$\{n\}\.docx`, docx\(d\)/); assert.match(out, /zipFiles\(driverFiles\(board\)/);
  for (const id of ["rs485-example", "hwsw-sheet"]) assert.ok(NEWS.some((n) => n.id === id && n.v === "0.116.0"), id);
  for (const f of ["web/js/pcba/rs485.js", "web/js/sw/rs485_link.js", "web/js/sw/rs485_c.js", "web/js/sw/hwsw.js", "web/js/pcba/blocks_control.js", "web/js/pcba/lab_bench.js", "web/js/modules/pcba_out.js"]) assert.ok(read(f).split("\n").length < 500, f);
});
