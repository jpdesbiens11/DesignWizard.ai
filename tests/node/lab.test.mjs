// The electronics lab : the circuit solver against exact answers, what each component is taken for, the bench and its tests,
// the functional test plan, and what the lab keeps on a board.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { waveAt, dcOp, transient, acSweep, measure, frequency, riseTime, cutoff, gainAt, pwmShare } from "../../web/js/pcba/lab_mna.js";
import { parseValue, siValue, family, ntcOhms, blockCircuit, i2cWrite, uartFrame, I2C_ADDR } from "../../web/js/pcba/lab_devices.js";
import { NATURES, INSTRUMENTS, eng, blockTests, testedBlocks, runTest } from "../../web/js/pcba/lab_bench.js";
import { knob, timeBase, expectedText, gapText, channelSetting, band, SAFETY, SAFETY_HV, testSheet, boardSheet, boardSheets, sheetJobs, jobSheet, labSummary, labPlanDoc, labGuide, labOf, setReading, setSkip, skipped, verdict, labStatus, testKey } from "../../web/js/pcba/lab_plan.js";
import { BLOCKS, blockParams } from "../../web/js/pcba/blocks.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { boardSummary } from "../../web/js/pcba/summary.js";
import { boardCircuit, powerTree, boardTests, runBoardTest, BOARD_KEY } from "../../web/js/pcba/lab_board.js";
import { METHODS, METHOD_HOW } from "../../web/js/core/methods.js";
import { glossary } from "../../web/js/core/terms.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), near = (a, b, rel = 0.01, abs = 0) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);
const V = (id, a, v) => ({ t: "V", id, a, b: "0", v }), Rz = (id, a, b, r) => ({ t: "R", id, a, b, r });

test("the solver against exact answers : a divider, a diode, an amplifier and its rails", () => {
  let r = dcOp({ els: [V("V1", "in", 10), Rz("R1", "in", "mid", 1000), Rz("R2", "mid", "0", 3000)] }); assert.ok(r.ok); assert.ok(near(r.v.mid, 7.5, 1e-6)); assert.ok(near(r.i.R1, 0.0025, 1e-6)); assert.ok(near(r.i.V1, 0.0025, 1e-6), "a source gives the current the circuit takes");
  r = dcOp({ els: [V("V1", "in", 5), Rz("R1", "in", "a", 430), { t: "D", id: "D1", a: "a", k: "0", vf: 0.7, at: 0.01 }] }); assert.ok(near(r.v.a, 0.7, 0.01) && near(r.i.D1, 0.01, 0.02), "a diode drops what it is said to drop at its current");
  r = dcOp({ els: [V("V1", "in", -5), Rz("R1", "in", "a", 430), { t: "D", id: "D1", a: "a", k: "0", vf: 0.7, at: 0.01 }] }); assert.ok(Math.abs(r.i.D1) < 1e-6 && near(r.v.a, -5, 0.001), "and blocks the other way");
  const amp = (vin) => dcOp({ els: [V("V1", "in", vin), { t: "OP", id: "U", o: "out", p: "in", n: "fb", lo: 0, hi: 5 }, Rz("R2", "out", "fb", 9000), Rz("R1", "fb", "0", 1000)] }).v.out;
  assert.ok(near(amp(0.2), 2, 0.001), "a gain of ten"); assert.ok(near(amp(0.9), 5, 0.01), "and no more than its rail");
  assert.equal(dcOp({ els: [V("V1", "a", 1), V("V2", "a", 2)] }).ok, false, "two sources that disagree have no answer");
  /* a pin left in the air does not stop the solver */
  assert.ok(dcOp({ els: [V("V1", "in", 3), Rz("R1", "in", "x", 100), { t: "C", id: "C1", a: "p", b: "q", c: 1e-7 }] }).ok);
});

test("the solver in time and in frequency : RC, RL, RLC, against their formulas", () => {
  const RC = { els: [V("V1", "in", { kind: "step", low: 0, high: 1 }), Rz("R1", "in", "out", 1000), { t: "C", id: "C1", a: "out", b: "0", c: 1e-6 }] };
  let t = transient(RC, { tEnd: 8e-3, steps: 4000, from: "zero" }); assert.ok(t.ok); assert.ok(near(t.v.out[500], 1 - Math.exp(-1), 0.002), "63 % after one time constant"); assert.ok(near(riseTime(t.t, t.v.out).rise, 2.197e-3, 0.02), "a rise time of 2,2 RC");
  let ac = acSweep(RC, { source: "V1", out: "out", fStart: 1, fEnd: 1e5, points: 200 }); assert.ok(near(cutoff(ac), 1 / (2 * Math.PI * 1e-3), 0.01)); assert.ok(near(gainAt(ac, 1591.5), 0.0995, 0.02), "a decade above : a tenth"); assert.ok(near(ac.phase[199], -90, 0.01, 0.5));
  t = transient({ els: [V("V1", "in", { kind: "step", low: 0, high: 12 }), Rz("R1", "in", "x", 120), { t: "L", id: "L1", a: "x", b: "0", l: 0.06 }] }, { tEnd: 2.5e-3, steps: 2500, from: "zero" }); assert.ok(near(t.i.L1[500], 0.1 * (1 - Math.exp(-1)), 0.003), "a coil takes L / R to reach 63 % of its current");
  ac = acSweep({ els: [V("V1", "in", 1), Rz("R1", "in", "x", 10), { t: "L", id: "L1", a: "x", b: "out", l: 1e-3 }, { t: "C", id: "C1", a: "out", b: "0", c: 1e-6 }] }, { source: "V1", out: "out", fStart: 100, fEnd: 1e5, points: 900 });
  const pk = ac.db.indexOf(Math.max(...ac.db)), Q = Math.sqrt(1e-3 / 1e-6) / 10; assert.ok(near(ac.f[pk], (1 / (2 * Math.PI * Math.sqrt(1e-9))) * Math.sqrt(1 - 1 / (2 * Q * Q)), 0.01), "the peak of a resonance"); assert.ok(near(ac.gain[pk], Q / Math.sqrt(1 - 1 / (4 * Q * Q)), 0.01));
  /* what an instrument reads */
  const sq = transient({ els: [V("V1", "in", { kind: "square", low: 0, high: 3.3, freq: 1000 }), Rz("R1", "in", "out", 1000), { t: "C", id: "C1", a: "out", b: "0", c: 1e-8 }] }, { tEnd: 5e-3, steps: 5000 });
  assert.ok(near(frequency(sq.t, sq.v.out, 0.2), 1000, 0.005)); const m = measure(sq.v.out, 0.2); assert.ok(near(m.pp, 3.3, 0.01) && near(m.mean, 1.65, 0.02) && m.rms > m.mean);
  assert.equal(frequency(sq.t, new Float64Array(sq.t.length).fill(2)), 0, "a flat line has no frequency");
  const stairs = Float64Array.from({ length: 400 }, (_, k) => { const x = (k % 100) / 100; return x < 0.25 ? 0 : x < 0.3 ? 0.5 : x < 0.75 ? 1 : x < 0.8 ? 0.5 : 0; }), tt = Float64Array.from({ length: 400 }, (_, k) => k * 1e-5); assert.ok(near(frequency(tt, stairs), 1000, 0.02), "a step on the way up is not counted twice");
  assert.equal(waveAt(3, 9), 3); assert.equal(waveAt({ kind: "pulse", high: 5, delay: 1, width: 2 }, 2), 5); assert.equal(waveAt({ kind: "pwl", points: [[0, 0], [1, 10]] }, 0.5), 5); assert.ok(near(waveAt({ kind: "sine", amp: 2, freq: 1, offset: 1 }, 0.25), 3, 1e-9));
  assert.ok(near(pwmShare(0, 1e-6, 1e5, 0.5), 1, 1e-9)); assert.ok(near(pwmShare(4e-6, 6e-6, 1e5, 0.5), 0.5, 1e-9), "an edge inside a step : the switch is closed for half of it"); assert.ok(near(pwmShare(0, 1e-5, 1e5, 0.3), 0.3, 1e-9));
});

test("what a part is, read off its reference and its value", () => {
  assert.deepEqual(parseValue("10 kΩ 1 %"), { v: 10000, unit: "Ω" }); assert.ok(near(siValue("100 nF", "F"), 1e-7, 1e-9)); assert.ok(near(siValue("4,7 µH"), 4.7e-6, 1e-9)); assert.equal(siValue("5,1 V", "V"), 5.1); assert.ok(near(siValue("13 mΩ 1 %"), 0.013, 1e-9)); assert.equal(siValue("22 µF 25 V", "V"), null, "the first value is the one of the part");
  assert.equal(parseValue("verte"), null); assert.equal(siValue("", "Ω"), null);
  assert.deepEqual(["R-0603", "C-0805", "CE-D8", "L-4040", "NTC-0603", "LED-0603", "D-SCH-SMA", "D-ZEN-SOD123", "D-TVS-SMB", "Q-NMOS-DPAK", "Q-PMOS-DPAK", "K-RELAY-SPDT", "SW-TACT-6", "U-LDO-SOT223", "U-CAN-SOIC8", "J-TB-2-5.08", "TP-1.0", "U-ESD-USB-SOT23-6"].map(family),
    ["R", "C", "C", "L", "NTC", "LED", "D", "Z", "Z", "NMOS", "PMOS", "RELAY", "BUTTON", "U:LDO", "U:CAN", "", "", ""]);
  assert.ok(near(ntcOhms(1e4, 3950, 25), 1e4, 1e-9)); assert.ok(ntcOhms(1e4, 3950, 85) < 1500 && ntcOhms(1e4, 3950, 0) > 30000, "a NTC loses its resistance as it warms");
  /* every block of the catalogue gives a circuit, and every integrated circuit has a behaviour */
  for (const t of Object.values(BLOCKS)) { const P = blockParams(t), c = blockCircuit(t.build(P), t.id, P); assert.ok(Array.isArray(c.els), t.id); assert.ok(!c.notes.some((n) => /pas de comportement/.test(n)), `${t.id} : ${c.notes.join(" ")}`); for (const e of c.els) assert.ok(e.id && e.t, t.id); }
  const led = BLOCKS.led, c = blockCircuit(led.build(blockParams(led)), "led", blockParams(led)); assert.equal(c.nets.GND, "0", "the ground of the block is the reference"); assert.ok(c.states.some((s) => s.kind === "led"));
});

test("a bus that is listened to : I²C answered at the right address only ; a byte on a serial line", () => {
  const ack = (addr) => { const r = runTest("eeprom", "i2c"); return r; }, r = ack(); assert.ok(r.ok); assert.equal(r.measures[0].value, 3, "the address and two bytes : three acknowledgements");
  assert.equal(I2C_ADDR.eeprom, 0x50); const w = i2cWrite(0x50, [0x10, 0x3a], 1e5, 0); assert.equal(w.bits, 27); assert.deepEqual(w.at(0), { scl: 1, sda: 1 }); assert.deepEqual(w.at(0.75e-5), { scl: 1, sda: 0 }, "a start : data falls while the clock is high"); assert.deepEqual(w.at(w.end + 1), { scl: 1, sda: 1 });
  const mem = r.states.find((s) => s.kind === "memory"); assert.match(mem.at(r.frames - 1).text, /écrit 0x3A à l'adresse 0x10/, "the memory says what was written"); assert.equal(mem.at(0).on, false);
  const u = uartFrame([0x55], 115200, 0), T = 1 / 115200; assert.equal(u.at(-1), 1); assert.equal(u.at(T * 0.5), 0, "a start bit"); assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((k) => u.at(T * (k + 0.5))), [1, 0, 1, 0, 1, 0, 1, 0]); assert.equal(u.at(T * 9.5), 1);
});

test("the bench : natures and instruments say what they are ; every block has its tests, written for someone who learns", () => {
  assert.deepEqual(NATURES.map((n) => n.id), ["power", "static", "dynamic", "frequency", "function", "bus"]); assert.equal(new Set(NATURES.map((n) => n.color)).size, 6); for (const n of NATURES) assert.ok(n.label && n.fr && n.text);
  for (const [k, i] of Object.entries(INSTRUMENTS)) assert.ok(i.label && i.fr && i.text, k); assert.deepEqual([INSTRUMENTS.scope.label, INSTRUMENTS.supply.label, INSTRUMENTS.generator.label, INSTRUMENTS.dmm.label], ["Oscilloscope", "DC power supply", "Function generator", "Multimeter"]);
  assert.equal(eng(0.0033, "A"), "3,3 mA"); assert.equal(eng(4.7e-6, "H"), "4,7 µH"); assert.equal(eng(12000, "Hz"), "12 kHz"); assert.equal(eng(0, "V"), "0 V"); assert.equal(eng(NaN, "V"), "—"); assert.equal(eng(3e-13, "A"), "0 A");
  assert.equal(testedBlocks().length, Object.keys(BLOCKS).length, "every block of the catalogue has a test of its own");
  for (const tpl of Object.keys(BLOCKS)) { const tests = blockTests(tpl); assert.ok(tests.length >= 1, tpl); assert.equal(new Set(tests.map((t) => t.id)).size, tests.length, tpl);
    for (const t of tests) { assert.ok(NATURES.some((n) => n.id === t.nature), `${tpl}/${t.id}`); assert.ok(t.title && t.why.length > 60 && t.learn.length > 30 && t.expect, `${tpl}/${t.id} says why, what to expect and what to keep`); for (const g of t.gear) assert.ok(INSTRUMENTS[g], `${tpl}/${t.id} ${g}`); } }
  assert.equal(runTest("nope", "x").ok, false); assert.equal(runTest("led", "nope").ok, false);
});

test("every test of every block runs, and gives what the design calculation said — or says why not", () => {
  const got = {}; let n = 0;
  for (const tpl of Object.keys(BLOCKS)) for (const t of blockTests(tpl)) { const r = runTest(tpl, t.id); n++; assert.ok(r.ok, `${tpl}/${t.id} runs`); for (const m of r.measures) assert.ok(Number.isFinite(m.value), `${tpl}/${t.id} : « ${m.label} » is a number`); got[`${tpl}/${t.id}`] = r;
    if (r.kind === "tran") { assert.ok(r.ch1.y.length === r.t.length && r.ch2.y.length === r.t.length, `${tpl}/${t.id}`); assert.ok(r.frames > 20 && r.log.some((e) => e.instr === "scope"), `${tpl}/${t.id} has a set-up`); for (const a of Object.values(r.activity)) assert.ok(a.a.every((x) => x >= 0 && x <= 1.0001), `${tpl}/${t.id}`); } }
  assert.ok(n >= 85, `${n} tests`);
  const val = (key, re) => got[key].measures.find((m) => re.test(m.label)), close = (key, re, rel) => { const m = val(key, re); assert.ok(m && m.design !== null && near(m.value, m.design, rel), `${key} « ${m && m.label} » : ${m && m.value} against ${m && m.design}`); };
  /* regulators hold their output ; a chopper ripples as its inductance says */
  close("ldo/levels", /Tension de sortie/, 0.02); close("vref/levels", /Tension de sortie/, 0.005); close("buck/levels", /Tension de sortie/, 0.02); close("boost/levels", /Tension de sortie/, 0.03); close("dcdc_iso/levels", /Tension isolée/, 0.05);
  assert.ok(near(val("buck/ripple", /Fréquence/).value, 4e5, 0.02)); assert.ok(near(val("buck/ripple", /inductance/).value, 0.3, 0.15), "30 % of 1 A, as it was sized"); assert.ok(val("buck/ripple", /crête à crête/).value < 0.03);
  assert.ok(val("ldo/dropout", /minimale/).value > 3.3 && val("ldo/dropout", /minimale/).value < 3.9, "a linear regulator needs its output plus its drop");
  /* sensing */
  close("ntc/levels", /Tension de sortie/, 0.01); assert.deepEqual(got["ntc/levels"].table.rows.map((r) => r.x), [0, 25, 50, 85]); assert.ok(got["ntc/levels"].table.rows.every((r, i, a) => !i || r.y < a[i - 1].y), "warmer : lower");
  const f = val("ntc/filter", /coupure/); assert.ok(near(f.value, 17.7, 0.03) && f.gap < -0.5, "the filter of the NTC cuts six times lower than the design said : the bridge adds its own resistance");
  close("shunt/levels", /Tension de sortie/, 0.01); close("hall_current/levels", /Tension de sortie/, 0.01); close("vbus_sense/levels", /Tension de sortie/, 0.01); close("din/levels", /état haut/, 0.01); close("din/edge", /montée/, 0.05); close("temp_analog/levels", /Tension de sortie/, 0.02);
  close("amp/bode", /Gain/, 0.01); close("amp/bode", /coupure/, 0.03); assert.ok(val("amp/sine", /Sommet/).value <= 3.3 && val("amp/sine", /Creux/).value >= 0, "an amplifier stays between its rails");
  close("comparator/hysteresis", /Hystérésis/, 0.08); assert.ok(val("comparator/hysteresis", /montée/).value > val("comparator/hysteresis", /descente/).value); close("opto_in/switch", /DEL/, 0.03); close("supervisor/threshold", /relâchement/, 0.02);
  /* driving */
  close("load_switch/switch", /charge/, 0.02); close("load_switch/switch", /Pointe/, 0.02); close("relay/switch", /bobine/, 0.01); close("relay/switch", /Pointe/, 0.02); close("hbridge/switch", /avant/, 0.08); close("hbridge/switch", /arrière/, 0.08); close("stepper/switch", /Fréquence/, 0.01); close("half_bridge/switch", /Niveau haut/, 0.01); close("half_bridge/switch", /Fréquence/, 0.01); close("buzzer/switch", /Fréquence/, 0.01);
  /* buses */
  close("can/levels", /Écart dominant/, 0.03); close("can/levels", /CANH/, 0.02); close("can/levels", /CANL/, 0.03); assert.ok(val("can/levels", /récessif/).value < 0.05); assert.ok(val("rs485/levels", /pour un 1/).value > 1.5 && val("rs485/levels", /pour un 0/).value < -1.5); assert.ok(val("rs232/levels", /repos/).value < -5 && val("rs232/levels", /un 0/).value > 5);
  close("lin/levels", /récessif/, 0.05); assert.ok(val("lin/levels", /dominant/).value < 2.4, "under 20 % of the battery"); close("usb_uart/frame", /Durée/, 0.01); close("iso_digital/pass", /Niveau haut/, 0.01); close("level_shift/shift", /côté haut/, 0.01); close("usb_c/levels", /CC1/, 0.01); assert.equal(val("imu/i2c", /Acquittements/).value, 3); assert.equal(val("rtc/i2c", /Acquittements/).value, 3);
  /* signalling : a LED lights when it is driven, and says so */
  close("led/levels", /Courant/, 0.15); const blink = got["led/blink"], lamp = blink.states.find((s) => s.kind === "led"), on = Array.from({ length: blink.frames }, (_, q) => lamp.at(q).on); assert.ok(on.includes(true) && on.includes(false), "the LED blinks"); assert.equal(val("button/bounce", /après le filtre/).value, 1); assert.equal(val("button/bounce", /Rebonds/).value, 3);
  assert.ok(val("input_protection/reverse", /Tension de sortie/).value > -0.1, "polarity reversed : nothing negative gets through"); assert.ok(near(val("input_protection/surge", /Crête à la sortie/).value, 28, 0.05) && val("input_protection/surge", /injectée/).value > 45);
});

test("the plan : a sheet for the one who does the test ; knobs, bands, safety", () => {
  assert.deepEqual([0.3, 1, 1.2, 2.1, 5.5, 70].map(knob), [0.5, 1, 2, 5, 10, 100]); assert.equal(knob(0), 1); assert.equal(timeBase(20.0000001e-6), 2e-6, "a window of 20 µs is 2 µs a division, whatever the rounding"); assert.equal(timeBase(3e-3), 5e-4);
  const flat = channelSetting(new Float64Array(50).fill(1e-4)); assert.ok(flat.vdiv >= 0.05, "a flat line is not shown as its noise"); assert.equal(channelSetting(Float64Array.from([0, 12, 24])).vdiv, 5); assert.equal(channelSetting(Float64Array.from([4.99, 5.01]), true).coupling, "AC");
  assert.match(band({ value: 5, unit: "V" }).text, /^4,75 V à 5,25 V$/); assert.ok(near(band({ value: 0.01, unit: "A" }).high, 0.012, 1e-6)); assert.match(band({ value: 3, unit: "", exact: true }).text, /exactement 3/); assert.equal(band({ value: NaN, unit: "V" }).text, "à relever"); assert.ok(band({ value: 0, unit: "V" }).high >= 0.05);
  /* a ceiling, a width, an idle current : each judged for what it is */
  assert.deepEqual(band({ value: 0.004, unit: "V", under: 0.02 }), { low: -0.02, high: 0.02, text: "moins de 20 mV" }); assert.match(band({ value: 0.05, unit: "V", swing: true }).text, /^37,5 mV à 62,5 mV$/); assert.equal(band({ value: 0.001, unit: "V", swing: true }).low > 0, true);
  assert.equal(band({ value: 1e-11, unit: "A", idle: true }).text, "moins de 10 mA"); assert.match(band({ value: 0.02, unit: "A", idle: true }).text, /^16 mA à 34 mA$/); assert.equal(band({ value: -1e-4, unit: "V" }).text, "0 V ± 50 mV"); assert.match(band({ value: 0.498, unit: "" }).text, /^0,448 à 0,548$/);
  assert.equal(expectedText({ ceiling: true, expected: 4e-7, unit: "A", band: { high: 0.01 } }), "≈ 0 A"); assert.equal(expectedText({ ceiling: true, expected: 0.004, unit: "V", band: { high: 0.02 } }), "4 mV"); assert.equal(expectedText({ expected: 3.3, unit: "V", band: {} }), "3,3 V"); assert.deepEqual([gapText(-0.834), gapText(0.2)], ["−83 %", "+20 %"]);
  for (const [tpl, t, re, txt] of [["buck", "ripple", /crête à crête/, /^moins de \d+(,\d+)? mV$/], ["can", "power", /Courant absorbé sur VIO/, /^moins de 10 mA$/], ["can", "power", /Courant absorbé sur VCC/, /^4 mA à 16 mA$/], ["lin", "levels", /dominant/, /^moins de 2,4 V$/], ["flash_spi", "spi", /Fronts/, /^exactement 18$/], ["comparator", "hysteresis", /Hystérésis/, /mV à .* mV$/]]) { const r = testSheet(tpl, t).rows.find((x) => re.test(x.label)); assert.match(r.band.text, txt, `${tpl}/${t}`); assert.ok(r.band.low <= r.expected && r.expected <= r.band.high, `${tpl}/${t} : what is simulated is within its own band`); }
  for (const tpl of Object.keys(BLOCKS)) for (const t of blockTests(tpl)) for (const r of testSheet(tpl, t.id).rows) { assert.ok(!(r.band.low < 0 && r.expected > 1e-6 && !r.ceiling), `${tpl}/${t.id} « ${r.label} » : a positive value is not accepted negative (${r.band.text})`); assert.doesNotMatch(r.band.text, /\d m à|\d m$/, `${tpl}/${t.id} « ${r.label} » : a number without a unit has no prefix`); }
  assert.ok(SAFETY.length >= 6 && SAFETY.some((x) => /limite de courant/.test(x)) && SAFETY_HV.some((x) => /50 V/.test(x)));
  const s = testSheet("buck", "ripple", {}, { refs: { U: "U7", L: "L3", COUT1: "C12", CIN: "C9" }, name: "Abaisseur (B3)", id: "E-01" });
  assert.ok(s.ok); assert.equal(s.nature.id, "dynamic"); assert.match(s.setup.join("\n"), /Alimentation de laboratoire : le \+ sur VIN — patte 1 de C9/); assert.match(s.setup.join("\n"), /voie 1 : sonde ×10 sur la broche SW de U7/); assert.match(s.setup.join("\n"), /ressort de masse/);
  assert.match(s.settings.join("\n"), /Alimentation de VIN : 24 V, limite de courant 1,5 A — réglée SORTIE COUPÉE/); assert.match(s.settings.join("\n"), /voie 1 \(Nœud de commutation\) : 5 V par division, couplage DC/); assert.match(s.settings.join("\n"), /Base de temps : \d+ µs par division/);
  assert.ok(s.steps.length >= 8 && /AVANT d'alimenter/.test(s.steps[0]) && /Relevez « Fréquence de découpage »/.test(s.steps.join("\n")) && /^Coupez la sortie de l'alimentation\./.test(s.steps[s.steps.length - 1])); assert.equal(s.rows.length, 4); assert.ok(s.notes.some((n) => /typiques/.test(n)), "what was assumed is said");
  /* what one cannot read without an instrument of its own is said, and not owed */
  const coil = s.rows.find((r) => /inductance/.test(r.label)); assert.equal(coil.optional, true); assert.match(s.steps.join("\n"), /« Ondulation du courant dans l'inductance » demande une sonde de courant : sans elle, laissez la case vide/); assert.doesNotMatch(s.steps.join("\n"), /générateur/, "no generator in this test : none is spoken of");
  /* a test read with a multimeter is written for a multimeter */
  const lv = testSheet("ldo", "levels", {}, { refs: { U: "U2", CIN: "C8", COUT: "C9" } }); assert.deepEqual(lv.gearIds, ["supply", "load", "dmm"]); assert.match(lv.setup.join("\n"), /Multimètre, en tension continue : pointe rouge sur VOUT/); assert.doesNotMatch([...lv.setup, ...lv.settings, ...lv.steps, ...lv.traps].join("\n"), /[Oo]scilloscope|sonde ×10|déclenchement|générateur/); assert.match(lv.settings.join("\n"), /Multimètre : tension continue/); assert.match(lv.settings.join("\n"), /EN SÉRIE/); assert.match(lv.steps.join("\n"), /Posez les pointes du multimètre/);
  const gn = testSheet("din", "edge"); assert.match(gn.steps[gn.steps.length - 1], /^Coupez le générateur, puis l'alimentation\./, "with a generator, it is switched off first");
  for (const tpl of Object.keys(BLOCKS)) for (const t of blockTests(tpl)) { const x = testSheet(tpl, t.id), all = [...x.setup, ...x.settings, ...x.steps, ...x.traps].join("\n"); if (!t.gear.includes("scope")) assert.doesNotMatch(all, /Oscilloscope|sonde ×10/, `${tpl}/${t.id} lists no oscilloscope, and asks for none`); if (!t.gear.includes("generator") && !t.gear.includes("logic")) assert.doesNotMatch(x.steps.join("\n"), /Coupez le générateur/, `${tpl}/${t.id}`); }
  const c = testSheet("conn_io", "continuity"); assert.ok(c.steps.some((x) => /HORS TENSION/.test(x)) && c.rows.every((r) => /moins de 1 Ω/.test(r.band.text))); assert.equal(testSheet("nope", "x"), null);
  const bode = testSheet("amp", "bode"); assert.match(bode.settings.join("\n"), /trois points par décade/); assert.ok(bode.steps.some((x) => /0,71 fois/.test(x)));
});

test("the plan of a board : in the order of the bench, as a document, with the house template", () => {
  const board = demoBoard(), sheets = boardSheets(board); assert.ok(sheets.length >= 20); assert.deepEqual(sheets.slice(0, 3).map((s) => s.id), ["E-01", "E-02", "E-03"]); assert.ok(sheets.every((s) => s.ok));
  const cat = sheets.filter((s) => !s.board).map((s) => BLOCKS[s.tpl].category), order = ["Raccorder", "Protéger", "Alimenter", "Calculer", "Mesurer", "Commander", "Communiquer", "Signaler", "Tester"]; assert.deepEqual(cat, [...cat].sort((a, b) => order.indexOf(a) - order.indexOf(b)), "what feeds is tested before what thinks");
  const buck = sheets.find((s) => s.tpl === "buck" && s.test === "ripple"); assert.match(buck.refs, /U\d+/); assert.doesNotMatch(buck.setup.join(" "), / de (CIN|COUT1)\b/, "the parts are named as on the board");
  const doc = labPlanDoc(board, { date: new Date("2026-11-19"), sheets }), text = doc.blocks.map((b) => [b.text, ...(b.items || []).map((i) => (typeof i === "string" ? i : i.text)), ...(b.rows || []).flat()].filter((x) => typeof x === "string").join(" ")).join("\n");
  assert.equal(doc.reference, `${board.id}-PTF`); assert.match(doc.title, /Plan de test fonctionnel/);
  for (const want of ["À qui s'adresse ce plan", "Sécurité", "Matériel", "Avant de mettre sous tension", "Ordre des essais", "Fiches d'essai", "Essais d'ensemble", "Feuille de résultats", "Comprendre", "Faire", "Pourquoi cet essai.", "À quoi s'attendre.", "À retenir.", "comportement TYPIQUE", "Hypothèse de la simulation"]) assert.ok(text.includes(want), want);
  assert.ok(doc.blocks.some((b) => b.type === "table" && b.head.includes("Mesuré") && b.head.includes("Calcul de conception"))); assert.ok(doc.blocks.some((b) => b.type === "checklist") && doc.blocks.some((b) => b.type === "signatures")); assert.ok(doc.blocks.filter((b) => b.type === "table" && b.head.includes("Mesuré") && b.head.includes("Plage acceptée")).every((b) => b.rows.every((r) => r[5] === "oui / non")), "a box one can print : no glyph a PDF font lacks"); assert.doesNotMatch(JSON.stringify(doc.blocks), /☐/);
  const meta = { kind: "Plan de test fonctionnel", project: "Essai" }, w = docx({ ...doc, ...meta }), p = pdfDoc({ ...doc, ...meta }); assert.ok(w.length > 100000 && w[0] === 0x50 && w[1] === 0x4b, "a Word file"); assert.ok(p.length > 100000 && String.fromCharCode(...p.slice(0, 5)) === "%PDF-", "a PDF file"); assert.match(read("web/js/core/pdfdoc.js"), /const wide = b\.ordered && b\.items\.length > 9 \? 1\.9 : 0;/, "a tenth step keeps its number clear of its text");
  assert.deepEqual(labGuide({ blocks: [] }).map((g) => g.level), ["todo"]); assert.ok(labGuide(board).some((g) => /typiques/.test(g.text))); assert.ok(labGuide({ blocks: board.blocks, nets: [{ name: "HV", class: "hv", voltage: 400 }] }).some((g) => g.level === "warn" && /50 V/.test(g.text)));
  assert.ok(labPlanDoc({ ...board, nets: [...board.nets, { name: "HVDC", class: "hv", voltage: 400, pins: [] }] }, { sheets }).blocks.some((b) => b.type === "h2" && /tension dangereuse/.test(b.text)), "a board with a dangerous voltage gets its own rules");
});

test("the blocks of a board, simulated together : joined by the nets of the board, each rail born of the one before", () => {
  const board = demoBoard(), C = boardCircuit(board), ids = C.els.map((e) => e.id), refs = new Set(board.parts.map((p) => p.ref));
  assert.equal(new Set(ids).size, ids.length, "every element has a name of its own"); assert.ok(ids.filter((id) => refs.has(id.split(":")[0])).length > 40, "an element is named by the reference of its part"); assert.equal(C.nets.GND, "0"); assert.equal(C.nets["+5V"], "+5V"); assert.equal(C.blocks.length, board.blocks.length);
  for (const e of C.els) for (const k of ["a", "b", "k", "o", "p", "n"]) if (typeof e[k] === "string") assert.ok(e[k] === "0" || board.nets.some((n) => n.name === e[k]) || /^B\d+:/.test(e[k]) || /^(PS|LOAD)_/.test(e[k]), `${e.id}.${k} = ${e[k]} : a net of the board, or a name of its block`);
  const T = powerTree(board); assert.deepEqual(T.inputs, [{ net: "+24V_IN", volts: 24 }]); assert.deepEqual(T.rails.map((r) => [r.net, r.volts, r.by]), [["+24V", 24, "B2"], ["+5V", 5, "B3"], ["+3V3", 3.3, "B4"]], "the rails, in the order the power travels");
  /* a block that has no part on the board yet is left out, and said */
  const bare = { ...board, parts: board.parts.filter((p) => p.block !== "B8") }, Cb = boardCircuit(bare); assert.equal(Cb.blocks.length, board.blocks.length - 1); assert.ok(Cb.notes.some((n) => /^B8 : ce bloc n'a pas encore ses composants/.test(n)));
  assert.deepEqual(boardTests(board).map((t) => [t.id, t.nature]), [["powerup", "power"], ["thresholds", "static"]]); for (const t of boardTests(board)) { assert.ok(t.why.length > 80 && t.learn.length > 40 && typeof t.expect === "function"); for (const g of t.gear) assert.ok(INSTRUMENTS[g]); }
  assert.deepEqual(boardTests({ blocks: [], nets: [], parts: [] }), [], "nothing to try together on a board that makes no rail"); assert.equal(runBoardTest(board, "nope").ok, false);

  const R = runBoardTest(board, "powerup"), val = (X, re) => X.measures.find((m) => re.test(m.label)); assert.ok(R.ok && R.board && R.kind === "tran");
  for (const [re, v] of [[/rail \+24V/, 24], [/rail \+5V/, 5], [/rail \+3V3/, 3.3]]) { const m = val(R, re); assert.ok(near(m.value, v, 0.02), `${m.label} : ${m.value}`); assert.equal(m.design, v); }
  const cur = val(R, /Courant d'entrée/); assert.ok(cur.value > 2e-3 && cur.value < 0.05 && cur.under === 0.1, `idle current ${cur.value} : above what the regulators take themselves, under half the limit`); const settle = val(R, /Temps d'établissement de \+3V3/); assert.ok(settle.value > 0 && settle.value < 5e-3 && settle.under === 0.05);
  assert.ok(Object.keys(R.activity).length > 20 && Object.keys(R.activity).every((k) => refs.has(k)), "what lights up is a part of the board"); assert.ok(R.nets["+5V"] && R.nets["+3V3"] && near(R.nets["+5V"].max, 5, 0.1), "and a net of the board");
  const sw = R.states.find((x) => x.kind === "switching"); assert.ok(sw && refs.has(sw.part) && sw.at(R.frames - 1).on !== undefined); assert.ok(R.notes.some((n) => /programme du microcontrôleur ne tourne pas/.test(n)) && R.notes.some((n) => /^U\d+ : découpage/.test(n)), "the assumptions are said with the references of the board");
  assert.deepEqual(R.log.filter((e) => e.instr === "supply").map((e) => [e.to, e.v, e.ilim]), [["+24V_IN", 24, 0.2]], "one supply, on what comes from outside");

  const H = runBoardTest(board, "thresholds"), up5 = val(H, /\+5V s'établit/).value, up3 = val(H, /\+3V3 s'établit/).value, dn5 = val(H, /\+5V lâche/).value, dn3 = val(H, /\+3V3 lâche/).value;
  assert.ok(H.ok && H.measures.length === 4 && H.measures.every((m) => m.tol === 0.15), "thresholds of typical behaviours : a wide band"); assert.ok(up5 > 4.9 && up5 < 5.9 && dn5 > 4.9 && dn5 < 5.9, `the 5 V rail needs its output over its largest duty : ${up5}, ${dn5}`); assert.ok(up3 >= 4.4 && up3 <= up5 && dn3 >= 4.2 && dn3 < dn5, `the lowest rail comes first and lets go last : ${up3}, ${dn3}`);
  /* a regulator follows its input at once : half the nominal input, the rail is still right */
  const vin = H.sim.v["+24V_IN"], v5 = H.sim.v["+5V"], k = vin.findIndex((x) => x >= 12); assert.ok(near(v5[k], 5, 0.03), `at 12 V in, +5V = ${v5[k]}`);
});

test("the plan ends on the board as a whole : the same sheet, said on the nets of the board", () => {
  const board = demoBoard(), jobs = sheetJobs(board), last = jobs.slice(-2); assert.deepEqual(last.map((j) => [j.id, j.blockId, j.test]), [["E-25", BOARD_KEY, "powerup"], ["E-26", BOARD_KEY, "thresholds"]]); assert.ok(!board.blocks.some((b) => b.id === BOARD_KEY));
  const s = jobSheet(last[0]); assert.ok(s.ok && s.board && s.blockId === BOARD_KEY); assert.equal(s.block, "Carte entière"); assert.equal(s.id, "E-25");
  assert.match(s.setup.join("\n"), /Alimentation de laboratoire : le \+ sur \+24V_IN — broche \d+ du connecteur J\d+/); assert.match(s.setup.join("\n"), /voie 2 : sonde ×10 sur \+3V3 — point de test TP\d+/, "a rail is probed on its test point"); assert.match(s.settings.join("\n"), /Alimentation de \+24V_IN : 24 V, limite de courant 200 mA/);
  assert.equal(s.rows.length, 5); assert.match(s.rows.find((r) => /Courant d'entrée/.test(r.label)).band.text, /^moins de 100 mA$/); assert.match(s.expect, /peut passer un instant en limitation/); assert.match(s.steps.join("\n"), /Une limitation d'un instant, le temps de charger les condensateurs, est normale/);
  const h = boardSheet(board, "thresholds"); assert.deepEqual(h.gearIds, ["supply", "dmm"]); assert.doesNotMatch([...h.setup, ...h.settings, ...h.steps, ...h.traps].join("\n"), /[Oo]scilloscope|sonde ×10/, "a sweep by hand is read with a multimeter"); assert.match(h.steps.join("\n"), /par pas de 1 V depuis zéro/); assert.match(h.rows[0].band.text, /V à .* V$/); assert.equal(boardSheet(board, "nope"), null);
  const sheets = boardSheets(board), doc = labPlanDoc(board, { sheets }), heads = doc.blocks.filter((b) => b.type === "h1" || b.type === "h2").map((b) => b.text), at = heads.findIndex((t) => /Essais d'ensemble/.test(t));
  assert.equal(doc.sheets.length, 26); assert.deepEqual(heads.slice(at + 1, at + 3).map((t) => t.slice(0, 22)), ["E-25 — Carte entière :", "E-26 — Carte entière :"], "the two sheets of the whole board are in « Essais d'ensemble »"); assert.ok(heads.findIndex((t) => /^E-24 /.test(t)) < at && heads.findIndex((t) => /^E-01 /.test(t)) < at);
  assert.ok(doc.blocks.some((b) => b.type === "p" && /blocs sont reliés par les nets de la carte/.test(b.text)));
  /* a reading of the whole board is kept like any other */
  const key = testKey(BOARD_KEY, "powerup"), b2 = { ...board, lab: setReading(board, key, "Tension du rail +5V", 5.02) }; assert.match(toDwiz(b2), /\n {2}reading BOARD\/powerup what="Tension du rail \+5V" value=5\.02\n/); assert.deepEqual(labOf(fromDwiz(toDwiz(b2))), labOf(b2)); assert.equal(labStatus(b2, sheets).rows.find((r) => r.key === key).state, "part");
  assert.match(labSummary(board).text, /^26 essai\(s\) au plan/);
  const screen = read("web/js/modules/elab.js"); assert.match(screen, /data: \{ "data-block": BOARD_KEY \}, run: \(\) => pick\(BOARD_KEY\)/); assert.match(screen, /b\.whole \? boardSheet\(board\(\), st\.test\) : testSheet\(/); assert.match(screen, /b\.whole \? local : st\.netMap\[local\]/);
  assert.doesNotMatch(read("web/js/pcba/lab_board.js"), /\bdocument\.[a-zA-Z]|\bwindow\.[a-zA-Z]|\bfetch\(/, "pure");
});

test("what the lab keeps on a board : readings, tests set aside, notes — and where it stands", () => {
  const board = demoBoard(), sheets = boardSheets(board), s = sheets.find((x) => x.tpl === "ldo" && x.test === "levels"), key = testKey(s.blockId, s.test), row = s.rows[0];
  assert.deepEqual(labOf({}), { readings: [], skips: [], notes: [], ticks: [], passes: [] }); assert.deepEqual(labOf({ lab: { readings: [{ test: "a", what: "x", value: "3.5" }, { test: 3 }, { test: "a", what: "y", value: "z" }], skips: "no", notes: [{ test: "a", text: "  " }, { test: "a", text: " vu " }] } }), { readings: [{ test: "a", what: "x", value: 3.5 }], skips: [], notes: [{ test: "a", text: "vu" }], ticks: [], passes: [] });
  assert.equal(verdict(row, null), "none"); assert.equal(verdict(row, row.expected), "ok"); assert.equal(verdict(row, row.expected * 1.5), "out"); assert.equal(verdict(row, row.band.high), "ok"); assert.equal(verdict({ band: { low: 3, high: 3 } }, 3), "ok"); assert.equal(verdict({ band: { low: 3, high: 3 } }, 2), "out");
  let st = labStatus(board, sheets); assert.equal(st.total, sheets.length); assert.equal(st.todo, sheets.length); assert.equal(st.ok + st.out + st.off, 0);
  let b = { ...board, lab: setReading(board, key, row.label, row.expected) }; assert.equal(labStatus(b, sheets).rows.find((r) => r.key === key).state, s.rows.length > 1 ? "part" : "ok");
  for (const r of s.rows) b = { ...b, lab: setReading(b, key, r.label, r.expected) }; assert.equal(labStatus(b, sheets).rows.find((r) => r.key === key).state, "ok"); { const rp = sheets.find((x) => x.tpl === "buck" && x.test === "ripple"), k2 = testKey(rp.blockId, rp.test); let b2 = board; for (const r of rp.rows.filter((r) => !r.optional)) b2 = { ...b2, lab: setReading(b2, k2, r.label, r.expected) }; assert.equal(labStatus(b2, sheets).rows.find((r) => r.key === k2).state, "ok", "a sheet is complete without the reading that asks for a current probe"); } assert.equal(labStatus(b, sheets).ok, 1);
  const bad = { ...b, lab: setReading(b, key, row.label, row.expected * 2) }; assert.equal(labStatus(bad, sheets).rows.find((r) => r.key === key).state, "out"); assert.equal(labOf(bad).readings.filter((r) => r.test === key && r.what === row.label).length, 1, "a reading written again replaces the one before");
  assert.equal(labOf({ ...b, lab: setReading(b, key, row.label, null) }).readings.some((r) => r.what === row.label), false, "an emptied field takes the reading away");
  const off = { ...b, lab: setSkip(b, key, true) }; assert.equal(skipped(off, key), true); assert.equal(labStatus(off, sheets).rows.find((r) => r.key === key).state, "off"); assert.equal(skipped({ ...off, lab: setSkip(off, key, false) }, key), false);
  assert.equal(labPlanDoc(off, { sheets }).sheets.length, sheets.length - 1, "a test set aside is not in the plan"); assert.ok(labOf(off).readings.length > 0, "but its readings are kept");
  /* a report says where the lab stands without simulating anything ; a screen makes the plan one test at a time */
  const jobs = sheetJobs(board); assert.equal(jobs.length, sheets.length); assert.deepEqual(jobs.map((j) => j.id), sheets.map((x) => x.id)); assert.deepEqual(jobs.map((j) => `${j.blockId}/${j.test}`), sheets.map((x) => `${x.blockId}/${x.test}`)); assert.deepEqual(jobSheet(jobs[0]).rows, sheets[0].rows);
  assert.match(labSummary(board).text, /^\d+ essai\(s\) au plan — aucun relevé encore$/); assert.deepEqual([labSummary(off).off, labSummary(off).measured, labSummary(off).tests], [1, 1, sheets.length]); assert.match(labSummary(off).text, /, 1 de côté — 1 avec des relevés \(\d+ valeur\(s\)\)$/); assert.match(labSummary({ blocks: [] }).text, /aucun essai/);
  assert.equal(boardSummary({ boards: [off] })[0].lab, labSummary(off).text, "the review report carries it");
  /* it travels in the text of the board, and comes back the same */
  const kept = { ...off, lab: { ...labOf(off), notes: [{ test: key, text: "vérifier la limite de courant" }] } }, back = fromDwiz(toDwiz(kept)); assert.deepEqual(labOf(back), labOf(kept)); assert.match(toDwiz(kept), /\n {2}skip B\d+\/levels\n/); assert.match(toDwiz(kept), /\n {2}note B\d+\/levels text="vérifier la limite de courant"\n/);
});

test("wiring : the screen plays the test on the board and on two oscilloscopes ; the top bar flips down by discipline", () => {
  const screen = read("web/js/modules/elab.js"), view = read("web/js/modules/elab_view.js"), app = read("web/js/core/app.js"), main = read("web/js/main.js");
  assert.match(main, /import "\.\/modules\/elab\.js";/); assert.match(screen, /registerModule\(\{ key: "elab", label: "Labo"/);
  assert.match(screen, /testSheet\(b\.template, st\.test, b\.params \|\| \{\}, \{ refs: refsOf\(b\)/); assert.match(screen, /pcb\.light\(f\)/); assert.match(screen, /S1\.draw\(R\.t, R\.ch1\.y, st\.q/); assert.match(screen, /BD\.draw\(R\.ac, R\.cut, st\.q\)/);
  assert.match(screen, /store\.updateBoard\(id, \(b\) => \{ b\.lab = setReading\(b, k, r\.label, val\); \}, `Relevé : \$\{r\.label\}`\)/, "a reading is one undoable step"); assert.match(screen, /onOff\(!off, \(on\) => store\.updateBoard\(id, \(x\) => \{ x\.lab = setSkip\(x, k, !on\); \}/, "a test has the On \/ Off of every list");
  assert.match(screen, /download\(`\$\{name\}\.docx`, docx\(full\)/); assert.match(screen, /download\(`\$\{name\}\.pdf`, pdfDoc\(full\)/); assert.match(screen, /\.\.\.docMeta\(\)/, "the plan carries the identity of the documents"); assert.match(screen, /readings: mine\.readings/, "an answer of an AI cannot rewrite what was measured");
  assert.match(screen, /setGuide\(guide\(\)\)/); assert.match(screen, /underVeil\(pageVeil\(\), "Plan de test : simulation de chaque essai…"/, "the plan is made under the veil, one test at a time"); assert.match(screen, /if \(signal\.off\) return null;/, "and stops between two"); assert.match(screen, /cancelled: "Plan de test annulé : aucun fichier n'a été enregistré\."/);
  assert.match(read("web/js/modules/pcba.js"), /href: `#\/elab\/\$\{encodeURIComponent\(id\)\}`, "data-lab": ""/, "the PCBA opens the lab of its board"); assert.match(read("web/js/modules/report.js"), /"Labo — plan de test"/);
  assert.match(read("web/js/core/busy.js"), /if \(sig === shown && actions\.childNodes\.length === sig\.length\) return;/, "a line of progress does not take « Annuler » away from under the pointer");
  /* sources and words : said with their true level */
  const src = Object.fromEntries(METHODS.filter((m) => m.id.startsWith("lab-")).map((m) => [m.id, m])); assert.deepEqual(Object.keys(src), ["lab-mna", "lab-devices", "lab-bus", "lab-board", "lab-plan", "lab-manip"]); assert.deepEqual(Object.values(src).map((m) => m.how), ["tested", "usual", "typed", "own", "own", "own"]); assert.match(src["lab-board"].check, /Aucune carte réelle n'a été mesurée/); for (const m of Object.values(src)) { assert.ok(METHOD_HOW[m.how] && m.check.length > 120 && m.doc === "docs/LABO.md" && m.where === "#/elab", m.id); }
  assert.match(src["lab-devices"].check, /aucune fiche technique n'a été lue/); assert.match(src["lab-bus"].check, /sans relecture/); assert.match(src["lab-mna"].check, /de mémoire/);
  const words = glossary().filter((r) => r.group === "electrical").map((r) => r.en); for (const w of ["Oscilloscope", "DC power supply", "Time response", "Frequency response", "Ripple", "Transfer function", "Functional test plan", "Ground spring"]) assert.ok(words.includes(w), w); assert.match(screen, /e\.key === " "/, "the space bar plays and pauses");
  assert.match(view, /heat\(a\)/); assert.match(view, /url\(#lab-glow\)/); assert.match(view, /s\.kind === "led"/); assert.match(view, /lab-air/, "a net not routed yet still shows where the current goes"); assert.doesNotMatch(view, /https?:|<img/);
  assert.match(app, /export const NAV = \[/); assert.match(app, /keys: \["pcb", "pcba", "elab", "creepage"\]/); assert.match(app, /keys: \["shop", "parts", "assembly", "drawings", "physics", "fea"\]/); assert.match(app, /class: "menu nav-pop", role: "menu"/); assert.match(app, /e\.key === "ArrowDown"/); assert.match(app, /\.nav-group\[aria-expanded="true"\]'\)\.forEach\(\(x\) => x\.setAttribute\("aria-expanded", "false"\)\)/, "a group closed by a click elsewhere says it is closed");
  const css = read("web/css/nav.css"); assert.match(read("web/index.html"), /href="css\/nav\.css"/); assert.ok(read("web/css/app.css").split("\n").length <= 500, "the main sheet stays under 500 lines"); assert.match(css, /\.topbar \.tabs \{ flex: 1 0 auto; \}/, "the groups keep their width : the tools never cover them"); assert.match(css, /\.top-tools > #kernel-chip \{ flex: 0 1 auto;/, "what gives way is the status word"); assert.match(screen, /pick\(first\.id, cyc \? "ripple" : undefined\)/, "the lab opens on a chopper when the board has one");
  for (const f of ["web/js/pcba/lab_mna.js", "web/js/pcba/lab_devices.js", "web/js/pcba/lab_bench.js", "web/js/pcba/lab_plan.js"]) assert.doesNotMatch(read(f), /\bdocument\.[a-zA-Z]|\bwindow\.[a-zA-Z]|\bfetch\(|from "\.\.\/core\/dom\.js"/, `${f} is pure`);
});
