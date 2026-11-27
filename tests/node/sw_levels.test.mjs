/* The software at three levels (demande de JP, 24 novembre 2026) : novice, intermediate, expert ; the blocks a novice is given keyed in on their
   own ; every quantity in the units of physics ; the requirements of DynamiteAgile read as they are, and the prompt of the « IA » button with what
   the project has ; the software tried on its board, step by step, what each output must read computed by the model.
     node --test tests/node/sw_levels.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, cfgOf } from "../../web/js/sw/sw_objects.js";
import { problems } from "../../web/js/sw/sw_design.js";
import { LEVELS, DEFAULT_LEVEL, levelSteps, shows, noviceOffers } from "../../web/js/sw/sw_levels.js";
import { LIBRARY, autoPlace, VIEW, blockBox, BLOCK, REF_BY_UNIT } from "../../web/js/sw/sw_blocks.js";
import { physText, toInside, toShown, shownUnit } from "../../web/js/sw/sw_units.js";
import { agileReqs, parseReqs, planImport, reqPromptWith, csvRows, REQ_FORMAT } from "../../web/js/sw/sw_req_import.js";
import { devicePlacement } from "../../web/js/sw/sw_devices.js";
import { hilSteps, hilState, touchOf, netOf } from "../../web/js/sw/sw_hil.js";
import { aiTargetOf } from "../../web/js/core/stairs.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("three levels : 3 steps for a novice, 5 for an intermediate, the 7 of the V for an expert ; a novice sees the blocks bare", () => {
  assert.equal(DEFAULT_LEVEL, "novice"); assert.deepEqual(Object.keys(LEVELS), ["novice", "intermediate", "expert"]);
  assert.deepEqual(levelSteps("novice").map((s) => s.key), ["req", "design", "sim"]); assert.equal(levelSteps("intermediate").length, 5); assert.equal(levelSteps("expert").length, 7);
  for (const s of levelSteps("expert")) assert.ok(s.kid && s.says && s.icon && s.color, s.key);
  assert.equal(shows("novice", "vband"), false); assert.equal(shows("expert", "vband"), true); assert.equal(shows("novice", "blockChips"), false); assert.equal(shows("novice", "autoPlace"), true);
  const offer = noviceOffers(new Set(["module_state"])), offered = LIBRARY.filter(offer);
  assert.ok(offered.some((x) => x.device === "ntc") && offered.some((x) => x.kind === "limit") && offered.some((x) => x.kind === "module_state"), "sensors, decisions, the blocks of the domain in use");
  assert.ok(!offered.some((x) => x.planned) && !offered.some((x) => x.kind === "pin_adc"), "no planned block, no raw pin for a novice");
  const o = { id: "l", kind: "limit", params: {}, x: 0, y: 0 }, full = blockBox(o).h; VIEW.tags = false; VIEW.chips = false; assert.ok(blockBox(o).h < full - 30, "a bare block is smaller"); VIEW.tags = true; VIEW.chips = true;
  const band = read("web/js/modules/sw_vband.js"); assert.match(band, /stepPath\(lv, cur/); assert.match(band, /levelSwitch\(\)/);
  assert.match(read("web/js/modules/sw_level_ui.js"), /"dw\.sw\.level"/, "the level is kept by the browser of each person");
});

test("a novice is given the block keyed in : on the latest free output of the same key, in the unit of what feeds it", () => {
  const P = devicePlacement("ntc", 20, 20, (b) => b), d = { period: 10, objects: [...P.objects, { id: "lim", kind: "limit", params: {}, x: 340, y: 400 }], wires: [...P.wires] };
  assert.equal(P.objects[1].x - P.objects[0].x, BLOCK.W, "a sensor and what reads it : one piece, keyed");
  const a = autoPlace(d, "lim"); assert.deepEqual(a.wires, [{ from: "ntc.value", to: "lim.value" }]); assert.equal(a.x, P.objects[1].x + BLOCK.W); assert.equal(a.unit, "0.1 °C");
  assert.deepEqual(a.params, { unit: "0.1 °C", ...REF_BY_UNIT.limit["0.1 °C"] }, "an over-temperature, not an over-voltage : a reference value of temperature");
  Object.assign(d.objects[2], { x: a.x, y: a.y, params: a.params }); d.wires.push(...a.wires); assert.deepEqual(problems(d).filter((p) => p.level === "error"), []);
  const led = devicePlacement("led", 0, 600, (b) => b).objects[0]; d.objects.push(led); const b = autoPlace(d, led.id); assert.equal(b.wires[0].from, "lim.trip", "the lamp on the decision, the latest free 0 / 1 output");
  assert.equal(cfgOf({ kind: "analog_in", params: P.objects[1].params }).unit, "0.1 °C"); assert.deepEqual(P.scenario.ntc_pin.points[0][0], 0);
  const K = KINDS.analog_in, s = K.init(); assert.ok(Math.abs(K.step(s, cfgOf(P.objects[1]), { counts: P.scenario.ntc_pin.points[0][1] }).value - 300) <= 2, "the bench starts the sensor in the middle of its range : 30 °C, to a count");
});

test("the units of physics on the screen : V, A, °C, % — the whole numbers of the software behind", () => {
  assert.equal(physText(4250, "mV"), "4,25 V"); assert.equal(physText(95000, "mA"), "95 A"); assert.equal(physText(-660000, "mA"), "−660 A"); assert.equal(physText(250, "0.1 °C"), "25 °C"); assert.equal(physText(1000, "‰"), "100 %"); assert.equal(physText(3, "state"), "ARRÊT"); assert.equal(physText(1, "0/1"), "1");
  assert.equal(toInside("4.25", "mV"), 4250); assert.equal(toInside("60", "0.1 °C"), 600); assert.equal(toShown(95000, "mA"), 95); assert.equal(shownUnit("0.1 °C"), "°C"); assert.equal(shownUnit("counts"), "comptes");
  for (const f of ["web/js/modules/sw_canvas.js", "web/js/modules/sw_lab.js", "web/js/modules/sw_bench.js", "web/js/modules/sw_sheet.js"]) assert.match(read(f), /sw_units\.js/, `${f} writes in the units of physics`);
});

test("the requirements of DynamiteAgile, read as they are : its Goldmine export, the software ones kept", () => {
  const csv = "﻿key,external_id,kind,stakeholder,derived_from,title,statement,status,source,source_doc,category,lifecycle,criticality,verification_method,acceptance_criteria,allocation\r\n" +
    'ROV-1,,Requirement,,,Speed,"The rover shall stop within 0,5 s, ""always"".",Open,Customer,SPEC §2,Safety,,A,Test,,SW\r\n' +
    "ROV-2,,Requirement,,,Mass,The rover shall weigh less than 5 kg.,Open,Customer,,Performance,,B,Inspection,,MECH\r\n" +
    "ROV-3,,Need,,,Fun,Kids want it to be fun.,Open,Customer,,Functional,,,,,\r\n" +
    "ROV-4,,Requirement,,,Temp,The firmware shall derate above 60 °C.,Open,Internal,,Functional,,C,Analysis,,Firmware\r\n";
  assert.equal(csvRows(csv)[1][6], 'The rover shall stop within 0,5 s, "always".');
  const A = agileReqs(csv); assert.deepEqual(A.data.requirements.map((r) => r.id), ["ROV-1", "ROV-4"], "the software ones, by their allocation ; a need is not a requirement");
  assert.deepEqual([A.data.requirements[0].kind, A.data.requirements[0].verify, A.data.requirements[1].verify], ["safety", "test", "analysis"]); assert.match(A.data.requirements[0].source, /DynamiteAgile ROV-1 · SPEC §2/);
  const P = parseReqs(csv); assert.equal(P.ok, true); assert.equal(P.from, "dynamiteagile"); assert.equal(P.data.format, REQ_FORMAT);
  const p = planImport(P.data, null); assert.equal(p.design.reqs.length, 2); assert.ok(p.design.reqs.every((r) => r.sure === false && r.objs.length === 0), "to confirm, allocated to nothing yet");
  /* the assistant sends them back with their blocks : the same ids, allocated, not doubled */
  const back = { format: REQ_FORMAT, signals: [{ id: "t", name: "Motor temperature", dir: "in", type: "analog", unit: "°C", min: -20, max: 120 }], requirements: [{ id: "ROV-4", text: "The firmware shall derate above 60 °C.", block: "limit", input: "t", values: { trip: "60 °C", clear: "55 °C" } }] };
  const q = planImport(back, p.design); assert.equal(q.design.reqs.length, 2); const r4 = q.design.reqs.find((r) => r.id === "ROV-4"); assert.equal(r4.objs.length, 1);
  assert.equal(cfgOf(q.design.objects.find((o) => o.id === r4.objs[0])).trip, 600);
  const all = agileReqs(csv.replace(/,SW\r\n/, ",\r\n").replace(/,Firmware\r\n/, ",\r\n")); assert.equal(all.data.requirements.length, 3, "no software allocation in the list : all of them, and said"); assert.match(all.notes[0], /Aucune exigence n'est allouée au logiciel/);
});

test("the « IA » button of the Logiciel group : its own round trip, the prompt with what the project has", () => {
  const P = bmProject(), d = P.software[0]; d.reqs = [{ id: "SWR-001", text: "The software shall open the contactor.", kind: "safety", verify: "test", objs: ["ov"], on: true }];
  assert.deepEqual(aiTargetOf("swreq", [], P), { key: "sw:req", label: "les exigences du logiciel" }); assert.equal(aiTargetOf("sw", [], P).key, "sw:design"); assert.equal(aiTargetOf("swsim", [], P).key, "sw:design");
  const t = reqPromptWith(d, P.boards.find((b) => b.id === "BMS-CENTRAL-PCBA"), [{ net: "AIN0", pin: "U9.PA0" }]); assert.match(t, /"id": "SWR-001"/); assert.match(t, /"allocated": true/); assert.match(t, /AIN0 \(U9\.PA0\)/); assert.match(t, /SAME ids/);
  assert.match(read("web/js/main.js"), /\/\^sw:\/\.test\(key\) \? import\("\.\/modules\/sw_ai\.js"\)/); assert.match(read("web/js/core/ai_door.js"), /software: "software"/, "an answer applied enters the journal");
});

test("the software tried on its board : the probe, the supply, a short sought before the power, the program loaded, then each case read — expected by the model", () => {
  const P = bmProject(), d = P.software[0], { board, steps, notes } = hilSteps(P, d); assert.equal(board.id, "BMS-CENTRAL-3X3");
  const ids = steps.map((s) => s.id); for (const k of ["safety", "probe", "set-supply", "con-supply", "guard", "power", "flash", "off"]) assert.ok(ids.includes(k), k);
  assert.ok(ids.indexOf("guard") < ids.indexOf("power") && ids.indexOf("power") < ids.indexOf("flash"), "the short sought BEFORE the power, the program after it");
  assert.deepEqual(steps.find((s) => s.id === "probe").points.map((p) => p.ref), ["J6", "J6", "J6"]); assert.deepEqual(steps.find((s) => s.id === "con-supply").points.map((p) => `${p.ref}.${p.pin}`)[1], "J1.1");
  assert.match(steps.find((s) => s.id === "set-supply").text, /12 V/);
  const rest = steps.find((s) => s.id === "read-rest-k_drv"), past = steps.find((s) => s.id === "read-adc_i-over_i-k_drv");
  assert.deepEqual([rest.expect.lo, rest.expect.unit], [2.6, "V"], "at rest the contactor is commanded : 3,3 V on its net"); assert.deepEqual([past.expect.lo, past.expect.hi], [2.6, 3.6], "above the sustained current the module derates : the contactor stays closed");
  assert.match(rest.points[1].ref, /^R\d+$/, "the output read where it is easy to touch : a resistor pad, not the pin of the chip");
  assert.ok(!steps.some((s) => s.id === "src-adc_v") && notes.some((n) => /dite par les 8 cartes de CORE dans leur tour.*aucune broche de la carte ne la porte/.test(n)), "a value read from the chain is never injected on a pin");
  assert.ok(!notes.some((n) => /^Bouton/.test(n)) || notes.some((n) => /Bouton : acquitter le défaut : aucun net/.test(n)), "the button is not given the net of the wake-up");
  assert.ok(!notes.some((n) => /aucun net de la carte/.test(n)), "JP, 27 novembre 2026 : the main board carries every pin of the software — what it would not carry is said (sw/sw_hil.js)");
  assert.match(touchOf(board, "DOUT0").ref, /^R\d+$/); assert.deepEqual(netOf(board, d, d.objects.find((o) => o.id === "k_drv")), { net: "DOUT0", proposed: false }, "linked in the software of the BM"); assert.deepEqual(netOf(board, d, d.objects.find((o) => o.id === "led_y")), { net: "LED_WARN", proposed: false }, "its own net : never DOUT1 (the precharge) nor LED_STATUS (the green LED) by its number");
  /* the order protects the board ; a reading out of its band stops the test */
  const nb = { ticks: Object.fromEntries(ids.slice(0, ids.indexOf("power")).map((k) => [k, "t"])), readings: { power: 0.04 } }, S = hilState(steps, nb);
  assert.equal(S[ids.indexOf("power")].done, true); assert.equal(S[ids.indexOf("flash")].open, true); assert.equal(S[ids.indexOf("flash") + 1].open, false);
  const bad = hilState(steps, { ...nb, readings: { power: 0.2 } }); assert.equal(bad[ids.indexOf("power")].bad, true); assert.equal(bad[ids.indexOf("flash")].open, false, "a current at the limit stops the test");
  const ui = read("web/js/modules/sw_hil_ui.js"); assert.match(ui, /labBoard\(boardHost\)/); assert.match(ui, /placedPoints\(R, s\)/); assert.match(ui, /gearPic\(s\.gear/, "the same screen as the Labo's manipulation"); assert.match(ui, /p\.swLab/);
});
