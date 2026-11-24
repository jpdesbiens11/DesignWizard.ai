/* The software as BLOCKS that key into each other (demande de JP, 24 novembre 2026) : the conventional blocks of embedded software, their C proved
   back to back ; the keys of the ports ; the layout from left to right ; blocks that key in when brought together ; the requirements as a
   standard input, their values pending until the requirement is confirmed ; typical sensors and actuators ; the software aligned on the board.
     node --test tests/node/sw_blocks.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { KINDS, cfgOf } from "../../web/js/sw/sw_objects.js";
import { problems, simulate, unsure } from "../../web/js/sw/sw_design.js";
import { cFiles, cExpected, requirement, LIB } from "../../web/js/sw/sw_c.js";
import { cpuOf } from "../../web/js/sw/sw_cpu.js";
import { SIGNAL_TYPES, typeOf, keyPath, FAMILIES, familyOf, LIBRARY, PACKS, columns, flowLayout, snapAt, docked, BLOCK, valueChips, hostBoard, mcuNets, hwTag, hwProblems } from "../../web/js/sw/sw_blocks.js";
import { REQ_FORMAT, reqPrompt, parseReqs, planImport, toolUnit } from "../../web/js/sw/sw_req_import.js";
import { DEVICES, DEVICES_PLANNED, devicePlacement } from "../../web/js/sw/sw_devices.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const run = (kind, c, seq, dt = 10) => { const K = KINDS[kind], s = K.init(); return seq.map((i) => K.step(s, { ...cfgOf({ kind, params: {} }), ...c }, i, dt)); };

test("the conventional blocks : debounce, on-delay timer, logic gate, PI regulator, ramp — each a step in whole numbers", () => {
  const db = run("debounce", { t: 30 }, [{ in: 1 }, { in: 1 }, { in: 1 }, { in: 0 }, { in: 1 }, { in: 1 }]).map((o) => o.out); assert.deepEqual(db, [0, 0, 1, 1, 1, 1], "believed after 30 ms ; a 10 ms drop is ignored");
  const ton = run("on_delay", { pt: 20 }, [{ in: 1 }, { in: 1 }, { in: 1 }, { in: 0 }, { in: 1 }]).map((o) => o.q); assert.deepEqual(ton, [0, 1, 1, 0, 0]);
  for (const [op, want] of [["AND", [0, 0, 0, 1]], ["OR", [0, 1, 1, 1]], ["XOR", [0, 1, 1, 0]], ["NOT", [1, 1, 0, 0]]]) assert.deepEqual(run("logic", { op }, [{ a: 0, b: 0 }, { a: 0, b: 1 }, { a: 1, b: 0 }, { a: 1, b: 1 }]).map((o) => o.y), want, op);
  const pi = run("pid", { kp: 500, ki: 100, umin: 0, umax: 1000 }, Array(600).fill({ sp: 1000, pv: 0 })).map((o) => o.u); assert.equal(pi[0], 501, "500 from P, 1 from I"); assert.equal(pi[199], 700, "the integral climbs 1 ‰ a step"); assert.equal(pi[599], 1000, "clamped");
  const back = run("pid", { kp: 0, ki: 1000, umin: 0, umax: 100 }, [...Array(300).fill({ sp: 1000, pv: 0 }), { sp: 0, pv: 1000 }]).map((o) => o.u); assert.equal(back[299], 100); assert.equal(back[300], 90, "anti-windup : the integral stopped at the bound, it comes back at once");
  const r = run("ramp", { rate: 1000 }, [{ x: 0 }, { x: 500 }, { x: 500 }, { x: -20 }]).map((o) => o.y); assert.deepEqual(r, [0, 10, 20, 10], "10 per step of 10 ms");
});

test("every block of the library runs and is written in C ; a planned block is shown and never placed", () => {
  for (const x of LIBRARY) { assert.ok(PACKS.some((p) => p.id === x.pack), `${x.kind || x.id || x.device} : its pack`); assert.ok(FAMILIES.some((f) => f.id === x.family), "its family");
    if (x.planned) assert.ok(x.label && x.fr && x.text.length > 20 && !KINDS[x.id], `${x.id} : said, never runnable`);
    else if (x.device) assert.ok(DEVICES[x.device]);
    else { const K = KINDS[x.kind]; assert.ok(K, x.kind); assert.ok(K.pin || LIB[x.kind], `${x.kind} has its C`); } }
  for (const k of Object.keys(KINDS)) assert.ok(LIBRARY.some((x) => x.kind === k), `${k} is in the library`);
  for (const id of ["core", "io", "bms", "robot", "drive", "device"]) assert.ok(LIBRARY.some((x) => x.pack === id), id);
});

test("the keys : one shape and one colour per type ; the tab of an output fits the notch of an input", () => {
  assert.deepEqual(["0/1", "counts", "mV", "‰", "state", "ms"].map(typeOf), ["bool", "raw", "quantity", "command", "state", "time"]);
  assert.equal(new Set(Object.values(SIGNAL_TYPES).map((t) => t.shape)).size, Object.keys(SIGNAL_TYPES).length, "a shape per type");
  assert.equal(new Set(Object.values(SIGNAL_TYPES).map((t) => t.color)).size, Object.keys(SIGNAL_TYPES).length, "a colour per type");
  for (const t of Object.keys(SIGNAL_TYPES)) { const pts = (p) => [...p.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => `${m[1]},${m[2]}`).sort().join(" ");
    if (t !== "quantity") assert.equal(pts(keyPath(t, 0, 0, 1)), pts(keyPath(t, 0, 0, -1)), `${t} : the same shape going down the right edge and up the left one`); }
  assert.equal(familyOf("pin_adc").id, "hw_in"); assert.equal(familyOf("pin_dout").id, "hw_out"); assert.equal(familyOf("pid").id, "control"); assert.equal(familyOf("pin_adc", { device: "ntc" }).id, "sensor"); assert.equal(familyOf("pin_dout", { device: "relay" }).id, "actuator");
});

test("from left to right : the board's inputs first, every block after what it reads, the board's outputs last", () => {
  const d = bmProject().software[0], col = columns(d), pos = flowLayout(d);
  assert.equal(col.adc_v, 0); assert.ok(col.v_max < col.ov && col.ov < col.latch && col.latch < col.module && col.module < col.k && col.k < col.k_drv);
  assert.equal(col.k_drv, Math.max(...Object.values(col)), "the outputs of the board in the last column");
  assert.ok(pos.adc_v.x < pos.v_max.x && pos.v_max.x < pos.ov.x, "x follows the column"); assert.equal(pos.k_drv.x, 20 + col.k_drv * BLOCK.COL);
  const same = Object.entries(pos).filter(([id]) => col[id] === col.ov).map(([, p]) => p.y).sort((a, b) => a - b); for (let i = 1; i < same.length; i++) assert.ok(same[i] > same[i - 1], "no two blocks of a column on each other");
});

test("blocks key in : brought together with a compatible interface, they join — and part when pulled apart", () => {
  const d = { period: 10, objects: [{ id: "btn", kind: "pin_din", params: {}, x: 20, y: 20 }, { id: "db", kind: "debounce", params: {}, x: 600, y: 300 }, { id: "ov", kind: "limit", params: {}, x: 900, y: 20 }], wires: [] };
  const s = snapAt(d, "db", 20 + BLOCK.W + 12, 30); assert.deepEqual(s && { x: s.x, y: s.y, wires: s.wires }, { x: 20 + BLOCK.W, y: 20, wires: [{ from: "btn.level", to: "db.in" }] });
  assert.equal(snapAt(d, "db", 20 + BLOCK.W + 60, 30), null, "too far : nothing");
  assert.equal(snapAt(d, "ov", 20 + BLOCK.W, 20), null, "a 0 / 1 tab does not fit the round notch of a quantity");
  d.objects[1].x = s.x; d.objects[1].y = s.y; d.wires.push(...s.wires); assert.equal(docked(d, s.wires[0]), true);
  d.objects[1].x += 40; assert.equal(docked(d, s.wires[0]), false, "pulled apart");
  const sw = read("web/js/modules/sw.js"); assert.match(sw, /snapAt\(d0, id, x, y\)/); assert.match(sw, /emboîté/); assert.match(sw, /déboîté/);
  assert.match(read("web/js/modules/sw_canvas.js"), /if \(docked\(d, w\)\) \{/, "a keyed joint draws no wire");
});

test("the C of the conventional blocks and of a sensor, compiled with every warning an error, prints what the model gives — back to back", (t) => {
  const P = devicePlacement("ntc", 20, 20, (b) => b), d = { id: "BLK-SW", name: "Blocs communs", cpu: "generic", period: 10,
    objects: [...P.objects, { id: "btn", kind: "pin_din", name: "Bouton", params: { pin: 1 }, x: 0, y: 200 }, { id: "db", kind: "debounce", name: "Debounce", params: { t: 30 }, x: 300, y: 200 },
      { id: "ton", kind: "on_delay", name: "TON", params: { pt: 100 }, x: 600, y: 200 }, { id: "en", kind: "pin_din", name: "Enable", params: { pin: 2 }, x: 0, y: 400 },
      { id: "and", kind: "logic", name: "AND", params: { op: "AND" }, x: 900, y: 200 }, { id: "rmp", kind: "ramp", name: "Ramp", params: { unit: "0.1 °C", rate: 2000 }, x: 600, y: 20 },
      { id: "pi", kind: "pid", name: "PI", params: { unit: "0.1 °C", kp: 800, ki: 50, umin: 0, umax: 1000 }, x: 900, y: 20 }, { id: "heat", kind: "pin_dout", name: "Heater", device: "heater", params: { pin: 3 }, x: 1200, y: 200 }],
    wires: [...P.wires, ...[["btn.level", "db.in"], ["db.out", "ton.in"], ["ton.q", "and.a"], ["en.level", "and.b"], ["and.y", "heat.level"], ["ntc.value", "rmp.x"], ["rmp.y", "pi.sp"], ["ntc.value", "pi.pv"]].map(([from, to]) => ({ from, to }))],
    scenario: { steps: 90, pins: { ntc_pin: { points: [[0, 2048], [300, 1500]] }, btn: { points: [[0, 0], [100, 1], [120, 0], [130, 1]] }, en: { points: [[0, 1], [700, 0]] } } } };
  for (const o of d.objects) o.sure = KINDS[o.kind].params.map((p) => p.key);
  assert.deepEqual(problems(d).filter((p) => p.level === "error"), []); const R = simulate(d); assert.ok(R.ports["heat.level"].includes(1), "the heater is commanded");
  assert.match(requirement(d, d.objects.find((o) => o.id === "pi")), /shall command, in per mille between 0 and 1000/); assert.match(requirement(d, d.objects.find((o) => o.id === "db")), /held its new value for 30 ms/);
  const files = cFiles(d, { cpu: cpuOf(d) }), names = files.map((f) => f.name); for (const m of ["dw_debounce", "dw_ton", "dw_logic", "dw_pi", "dw_ramp"]) assert.ok(names.includes(`bms/lib/${m}.c`), m);
  const cc = spawnSync("cc", ["--version"]); if (cc.error || cc.status !== 0) { t.diagnostic("no C compiler here : the back-to-back run is skipped"); return; }
  const dir = mkdtempSync(join(tmpdir(), "dwblk-")); for (const f of files) { const p = join(dir, f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  const B = join(dir, "bms"), src = files.filter((f) => /\.c$/.test(f.name) && !/hal\/(?!host)/.test(f.name)).map((f) => join(dir, f.name)), inc = ["lib", "cfg", "io", "app", "hal"].map((x) => `-I${join(B, x)}`);
  const made = spawnSync("cc", ["-std=c99", "-Wall", "-Wextra", "-pedantic", "-Werror", ...inc, ...src, "-o", join(dir, "t")], { encoding: "utf8" }); assert.equal(made.status, 0, `the C compiles without a warning : ${made.stderr}`);
  const ran = spawnSync(join(dir, "t"), [], { encoding: "utf8" }); assert.equal(ran.status, 0); assert.equal(ran.stdout, cExpected(d), "back to back");
});

test("typical sensors and actuators : a brick puts the pin and what reads it, its typical values to confirm", () => {
  for (const [k, D] of Object.entries(DEVICES)) { const P = devicePlacement(k, 0, 0, (b) => b); assert.ok(P.objects.length >= 1 && D.label && D.fr && D.text.length > 30, k);
    assert.equal(P.objects[0].device, k); assert.ok(P.objects.every((o) => !(o.sure || []).length), `${k} : nothing taken for confirmed`);
    const d = { period: 10, objects: P.objects, wires: P.wires }; assert.deepEqual(problems(d).filter((p) => p.level === "error" && !/n'est reliée à rien/.test(p.text)), [], k); }
  const ntc = devicePlacement("ntc", 0, 0, (b) => b).objects[1], K = KINDS.analog_in, s = K.init(); assert.equal(K.step(s, cfgOf(ntc), { counts: 2048 }).value, 250, "1650 mV at the pin : 25.0 °C");
  assert.ok(DEVICES_PLANNED.every((x) => x.text && !DEVICES[x.id]));
  assert.ok(Object.values(DEVICES).some((D) => D.side === "sensor") && Object.values(DEVICES).some((D) => D.side === "actuator"));
});

test("requirements as a standard input : a prompt for an assistant, a plan, then the blocks — the values pending until the requirement is confirmed", () => {
  const P0 = reqPrompt(); assert.match(P0, new RegExp(REQ_FORMAT.replace(/[/@]/g, "\\$&"))); for (const k of Object.keys(KINDS).filter((x) => !KINDS[x].pin)) assert.ok(P0.includes(`\`${k}\``), `the prompt lists ${k}`); assert.match(P0, /Do not invent a number/);
  assert.deepEqual(toolUnit("V"), ["mV", 1000]); assert.deepEqual(toolUnit("°C"), ["0.1 °C", 10]);
  assert.equal(parseReqs("nope").ok, false); assert.equal(parseReqs('{"format":"x","requirements":[]}').ok, false);
  const data = { format: REQ_FORMAT, system: { name: "Pack", domain: "bms" },
    signals: [{ id: "cell_v", name: "Cell voltage", dir: "in", type: "analog", unit: "V", min: 2.5, max: 4.5, hw: { pin: "ADC3", net: "VCELL" } }, { id: "k", name: "Contactor coil", dir: "out", type: "digital" }],
    requirements: [{ id: "SWR-010", text: "The software shall trip when the cell voltage stays above 4.25 V for 100 ms.", kind: "safety", block: "limit", input: "cell_v", values: { trip: "4.25 V", delay: "100 ms", clear: 4150 } },
      { id: "SWR-011", text: "The software shall hold the fault until a reset.", block: "fault_latch", input: "SWR-010" },
      { id: "SWR-012", text: "The software shall open the contactor on a fault.", block: "logic", input: "SWR-011", output: "k", values: { op: "NOT" } },
      { id: "SWR-013", text: "The software shall kick a watchdog.", block: "watchdog" }] };
  const p = planImport(parseReqs(JSON.stringify(data)).data, null), d = p.design;
  assert.deepEqual(p.counts, { reqs: 4, blocks: 3, fromReq: 4, reference: 1, planned: 1 });
  const lim = d.objects.find((o) => o.kind === "limit"); assert.deepEqual([cfgOf(lim).trip, cfgOf(lim).delay, cfgOf(lim).clear, cfgOf(lim).unit], [4250, 100, 4150, "mV"]);
  assert.equal(d.objects.find((o) => o.kind === "pin_adc").params.channel, 3); assert.deepEqual(d.objects.find((o) => o.kind === "pin_adc").hw, { net: "VCELL", pin: "ADC3" });
  assert.deepEqual(problems(d).filter((x) => x.level === "error"), [], "wired from left to right without an error");
  assert.ok(d.wires.some((w) => w.to === `${lim.id}.value`) && d.wires.some((w) => /^k_out\.level$/.test(w.to)), "the input and the output the requirements name are wired");
  assert.ok(d.reqs.every((r) => r.sure === false), "an import through an assistant confirms nothing");
  assert.ok(unsure(d).some((u) => u.obj === lim.id && u.key === "trip"), "pending"); assert.ok(valueChips(lim, d).find((c) => c.key === "trip").pending);
  assert.equal(valueChips(lim, d).find((c) => c.key === "above").source, "ref", "a value the requirement does not give : the reference value");
  d.reqs.find((r) => r.id === "SWR-010").sure = true; assert.ok(!unsure(d).some((u) => u.obj === lim.id && u.key === "trip"), "confirming the requirement confirms its values");
  assert.equal(d.reqs.find((r) => r.id === "SWR-013").objs.length, 0, "a planned block : the requirement is kept, allocated to nothing");
  const again = planImport(data, d), blocks = (x) => x.objects.filter((o) => !KINDS[o.kind].pin && o.kind !== "analog_in").length;
  assert.equal(blocks(again.design), blocks(d), "the same list again : a requirement already there with its block is kept, not doubled"); assert.equal(again.design.reqs.length, d.reqs.length); assert.ok(again.rows.filter((r) => r.state === "kept").length === 3);
});

test("the software is aligned on the board of the project : its host board, the nets of its microcontroller, a tag on every block", () => {
  const P = bmProject(), d = P.software[0], b = hostBoard(P, d); assert.ok(b, "the BMS board of the project"); assert.match(`${b.id} ${b.name}`, /BMS|central/i);
  const nets = mcuNets(b); assert.ok(nets.length > 5 && nets.every((n) => n.net && /\./.test(n.pin)));
  assert.equal(hwTag(P, d, d.objects.find((o) => o.id === "adc_v")).state, "bench", "a value read from the chain is held by the bench, not a pin to link");
  assert.equal(hwTag(P, d, d.objects.find((o) => o.id === "adc_i")).state, "linked"); assert.ok(!hwProblems(P, d).some((x) => x.level === "check" || x.level === "error"), "the software of the BM : nothing to fix on the board, what it lacks is a tip");
  assert.ok(hwProblems(P, d).some((x) => x.level === "tip" && /n'a pas assez de nets de sortie logique.*Buzzer/.test(x.text)), "outputs the board cannot carry : hardware to add, said");
  const pin = d.objects.find((o) => o.id === "adc_i"); delete pin.hw; assert.equal(hwTag(P, d, pin).state, "missing"); assert.equal(hwTag(P, d, d.objects.find((o) => o.kind === "limit")).state, "board");
  assert.ok(hwProblems(P, d).some((x) => x.level === "check" && /net de la carte/.test(x.text)));
  pin.hw = { board: b.id, net: nets[0].net, pin: nets[0].pin }; assert.equal(hwTag(P, d, pin).state, "linked"); pin.hw.net = "NO-SUCH-NET"; assert.ok(hwProblems(P, d).some((x) => x.level === "error"));
  assert.equal(hostBoard({ boards: [] }, d), null);
});
