/* PCBA: the wider catalogue of function blocks — every template builds with parts the library knows, sizes itself,
   binds to the microcontroller, passes the electrical check ; a board made of them is placed, routed and clean. */
import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { BLOCKS, BLOCK_CATEGORIES, buildBlock, blockSentence } from "../../web/js/pcba/blocks.js";
import { emptyBoard, resolveBoard } from "../../web/js/pcba/model.js";
import { addBlock } from "../../web/js/pcba/synth.js";
import { erc } from "../../web/js/pcba/erc.js";
import { floorplan, placeParts, zoneProblems, placementProblems } from "../../web/js/pcba/place.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { checkNetName, netClass } from "../../web/js/pcba/netnames.js";
import { clearanceViolations } from "./pcba_fixture.mjs";

const board = (list, size) => { const b = emptyBoard("T-1", "Carte d'essai"); for (const [t, p, o] of list) addBlock(b, t, p || {}, o || {}); if (size) { b.board.size = size; b.board.r = 2; b.board.layers = 4; b.board.holes = [[4, 4], [size[0] - 4, 4], [4, size[1] - 4], [size[0] - 4, size[1] - 4]].map((at) => ({ at, d: 3.2, land: 6 })); b.planes = [{ net: "GND", layer: "in1" }, { net: "+3V3", layer: "in2" }]; } return b; };
const netOf = (b, pin) => (b.nets.find((n) => n.pins.includes(pin)) || {}).name;

test("catalogue: 47 templates, each one builds from parts the library knows and writes its own sizing", () => {
  const ids = Object.keys(BLOCKS); assert.equal(ids.length, 47);
  for (const id of ids) {
    const t = BLOCKS[id], o = buildBlock(id, {}); assert.ok(BLOCK_CATEGORIES.includes(t.category), `${id} : ${t.category}`); assert.ok(t.name && t.desc && !/\{/.test(blockSentence(t, o.params)), id);
    for (const p of o.parts) { const def = LIBRARY[p.comp]; assert.ok(def, `${id} : ${p.comp}`); assert.ok(p.role, `${id}.${p.id} has a role`); }
    const refs = new Set(o.parts.map((p) => p.id));
    for (const n of o.nets) for (const pin of n.pins) { const [r, name] = [pin.slice(0, pin.indexOf(".")), pin.slice(pin.indexOf(".") + 1)]; assert.ok(refs.has(r), `${id} : ${pin}`); const def = LIBRARY[o.parts.find((p) => p.id === r).comp]; assert.ok(def.pins.some((q) => q.name === name || q.n === name), `${id} : ${pin} is not a pin of ${def.id}`); }
    for (const [name, port] of Object.entries(o.ports)) if (!port.lazy) assert.ok(o.nets.some((n) => n.name === port.net), `${id} : port ${name}`);
    for (const c of o.calc) assert.ok(c.label && c.text && Number.isFinite(c.value), `${id} : ${c.label}`);
  }
  assert.ok(checkNetName("GND_ISO").ok && netClass("GND_ISO") === "ground" && netClass("+5V_USB") === "power");
});

test("sizing reads like a hand calculation : step-up converter, protected input, H-bridge, stepper, USB-C", () => {
  const bo = buildBlock("boost", { vin: 5, vout: 12, iout: 0.3 }), d = bo.calc.find((c) => c.label === "Rapport cyclique").value; assert.ok(Math.abs(d - (1 - 0.9 * 5 / 12)) < 1e-9); assert.match(bo.parts.find((p) => p.id === "R1").value, /191 kΩ/); assert.match(bo.calc.find((c) => c.label === "Courant dans l'inductance").text, /interrupteur : 2 A/);
  const di = buildBlock("din", { vin: 24, vdd: 3.3 }); assert.match(di.parts.find((p) => p.id === "R1").value, /75 kΩ/); assert.ok(Math.abs(di.calc[0].value - 24 * 10 / 85) < 1e-9);
  assert.match(buildBlock("hbridge", { i: 2 }).parts.find((p) => p.id === "RL").value, /32,4 kΩ/); assert.match(buildBlock("stepper", { i: 1 }).calc[0].text, /= 5 × 200 mΩ × 1 A = 1 V/);
  assert.match(buildBlock("usb_c", { i: 1.5 }).calc[1].text, /lire la tension des lignes CC/); assert.equal(buildBlock("conn_wire", { signals: "+5V,GND,AIN3,NC,DIN0" }).parts[0].comp, "J-WTB-5"); assert.equal(buildBlock("lin", { role: "esclave" }).parts.length, 3);
  assert.ok(buildBlock("amp", { gain: 1 }).parts.every((p) => p.id !== "R2") && buildBlock("comparator", { hyst: 0 }).parts.every((p) => p.id !== "RH"));
});

test("blocks find their microcontroller pins : pools of inputs and outputs, SPI, second serial link ; the small package offers less", () => {
  const b = board([["mcu"], ["stepper"], ["encoder_in"], ["flash_spi"], ["rs232"], ["hbridge"], ["amp"], ["button"]]);
  assert.deepEqual(["PB3", "PB4", "PB5"].map((p) => netOf(b, `U1.${p}`)), ["DOUT0", "DOUT1", "DOUT2"], "step, direction and enable take three different outputs");
  assert.deepEqual(["PC13", "PC14", "PC15"].map((p) => netOf(b, `U1.${p}`)), ["DIN0", "DIN1", "DIN2"]); assert.equal(b.nets.find((n) => n.name === "DIN3").pins.length >= 1, true, "a fourth input is asked for : no pin left, the check will say so");
  assert.deepEqual(["PB12", "PB13", "PB14", "PB15", "PB10", "PB11", "PB8", "PB9", "PA0"].map((p) => netOf(b, `U1.${p}`)), ["SPI_CS", "SPI_SCK", "SPI_MISO", "SPI_MOSI", "UART2_TX", "UART2_RX", "PWM_A", "PWM_B", "AIN0"]);
  const small = board([["mcu", { pins: 32 }], ["flash_spi"], ["eeprom"]]); assert.equal(small.nets.find((n) => n.name === "SPI_SCK").pins.some((p) => p.startsWith("U1.")), false, "no SPI on the pins of the 32-lead package"); assert.ok(small.nets.find((n) => n.name === "I2C_SCL").pins.includes("U1.PB6"));
  const two = board([["mcu"], ["rs232"], ["lin"]]); assert.ok(erc(two, LIBRARY).findings.some((f) => f.severity === "error" && /UART2_RX relie deux sorties/.test(f.message)), "two links on the same serial port are caught");
});

test("a USB board made of the new blocks : electrical check, floor plan and placement clean ; routed at 97 % or more, with no clearance fault", () => {
  const b = board([["usb_c", {}, { connect: { VBUS: "+5V" } }], ["ldo", { vin: 5, vout: 3.3, iout: 0.3 }], ["mcu"], ["conn_swd"], ["usb_uart"], ["eeprom"], ["rtc"], ["level_shift"], ["button"], ["buzzer"]], [90, 70]);
  assert.ok(b.nets.find((n) => n.name === "+5V").pins.some((p) => p.startsWith("F")), "the USB supply feeds the 5 V rail through its fuse"); assert.ok(!b.nets.some((n) => n.name === "+5V_USB"));
  const e = erc(b, LIBRARY); assert.equal(e.summary.error, 0, JSON.stringify(e.findings.filter((f) => f.severity === "error").map((f) => f.message)));
  floorplan(b, LIBRARY, {}); assert.deepEqual(zoneProblems(b, LIBRARY), []); const pl = placeParts(b, LIBRARY, {}); assert.equal(pl.failed.length, 0); assert.deepEqual(placementProblems(b, LIBRARY), []);
  // the router proposes : on a board this dense it may leave a link or two for the designer (shown as rat's nest, taken up by « Reconnecter ») — what it lays is always clean
  const r = autoroute(b, LIBRARY, { maxMs: 60000, passes: 4 }); assert.ok(r.total >= 130 && r.routed >= 0.97 * r.total, `${r.routed}/${r.total} ; ${r.failed.map((f) => f.net).join(", ")}`); assert.equal(r.open, r.total - r.routed);
  const d = checkBoard(b, LIBRARY), errors = d.findings.filter((f) => f.severity === "error"); assert.ok(errors.every((f) => f.rule === "PCBA-04"), JSON.stringify(errors.filter((f) => f.rule !== "PCBA-04").slice(0, 3))); assert.deepEqual(clearanceViolations(b, LIBRARY), []);
  const R = resolveBoard(b, LIBRARY); assert.equal(R.pads.filter((p) => p.name === "DP" && p.net === "USB_DP").length, 3, "both DP lands of the receptacle and the bridge"); assert.equal(R.problems.length, 0);
});
