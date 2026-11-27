/* The central BMS board 3 in × 3 in of the module BM (JP, 25 novembre 2026) : its functions and blocks as JP chose them — isolated CAN FD, contactor
   + precharge + pyrofuse, the shunt of the return busbar, the module or the 12 V, the first present —, no electrical error ; what the router left
   is said, never hidden ; the software runs on it and the guide says what each side still lacks.   node --test tests/node/bm_bms3.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bms3Board, BMS3_BOARD_ID } from "../../web/js/demo/demo_bms3.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { hostBoard, hwProblems, hwTag, mcuNets, netRole } from "../../web/js/sw/sw_blocks.js";
import { KINDS } from "../../web/js/sw/sw_objects.js";

test("3 in × 3 in : the blocks JP chose, no electrical error, and only routing left", () => {
  const b = bms3Board(); assert.equal(b.id, BMS3_BOARD_ID); assert.deepEqual(b.board.size, [76.2, 76.2]); assert.equal(b.board.layers, 4);
  const T = b.blocks.map((x) => `${x.template}${x.params.name ? `:${x.params.name}` : ""}`);
  for (const k of ["power_or", "can", "rs485", "load_switch:CONTACTEUR", "load_switch:PRECHARGE", "load_switch:PYRO", "din:WAKE", "din:AUX", "mcu",
    "load_switch:PUMP", "load_switch:FAN", "din:ENABLE", "din:PRES", "din:ACK", "buzzer", "ntc", "eeprom"]) assert.ok(T.includes(k), k);
  assert.equal(b.blocks.filter((x) => x.template === "led").length, 3, "green, yellow, red"); assert.equal(b.blocks.filter((x) => x.template === "vbus_sense").length, 2, "the module and the output");
  /* every signal a block hands to the microcontroller reaches it (the board of 27 novembre first left six of them short of pins) */
  const reach = new Set(mcuNets(b).map((x) => x.net));
  for (const n of b.nets.filter((x) => /^(AIN|DIN|DOUT|LED_)\w*$/.test(x.name))) assert.ok(reach.has(n.name), `${n.name} reaches the microcontroller`);
  assert.ok(b.functions.some((f) => /combiné LV \+ HV/.test(f.name)) && b.functions.some((f) => /EFC/.test(f.name)), "the swap connector, combined ; the energy flow counter");
  assert.equal(b.blocks.filter((x) => x.template === "dcdc_iso").length, 2, "two isolated sides : the chain of the CORE and the CAN FD");
  assert.equal(b.blocks.find((x) => x.template === "shunt").params.ext, 1, "the shunt is part of the return busbar");
  assert.equal(erc(b, LIBRARY).summary.error, 0);
  const d = checkBoard(b, LIBRARY), errs = d.findings.filter((x) => x.severity === "error");
  assert.ok(errs.every((x) => x.rule === "PCBA-04"), `only links left to route : ${errs.filter((x) => x.rule !== "PCBA-04").map((x) => x.message).join(" | ")}`);
  assert.match(b.review.open.join(" "), /précharge/); assert.match(b.review.open.join(" "), /pyrofusible/);
});

test("the software of the BM runs on it : its pins on its nets, and the guide says what the board carries that the software does not command yet", () => {
  const p = bmProject(), d = p.software[0]; assert.equal(hostBoard(p, d).id, BMS3_BOARD_ID);
  for (const [id, net] of [["adc_i", "AIN1"], ["k_fb", "DIN1"], ["k_drv", "DOUT0"], ["led_g", "LED_STATUS"]]) assert.equal(d.objects.find((o) => o.id === id).hw.net, net, id);
  /* JP, 27 novembre 2026 : « aligner le logiciel avec les 2 types de cartes, CORE × 8 + main » — every pin of the software is on a net of the main
     board that does what the pin does, or is read from the chain of the CORE boards ; nothing is left open */
  const b = hostBoard(p, d), at = new Map(mcuNets(b).map((x) => [x.net, x.pin])), role = (o) => netRole(b, o.hw.net);
  for (const o of d.objects.filter((x) => KINDS[x.kind] && KINDS[x.kind].pin)) {
    assert.ok(o.bench || (o.hw && o.hw.net), `${o.id} : on a net of the board, or read from the chain`);
    if (o.bench) { assert.match(o.bench, /cartes de CORE|liaison RS-485/, `${o.id} : said where it comes from`); continue; }
    assert.equal(at.get(o.hw.net), o.hw.pin, `${o.id} : ${o.hw.net} reaches ${o.hw.pin}`);
  }
  const want = { pump: /PUMP/, fan: /FAN/, buzz: /Avertisseur/, veh_en: /ENABLE/, pres: /PRES/, ack: /ACK/, k_fb: /AUX/, k_drv: /CONTACTEUR/, adc_i: /shunt/, adc_vm: /tension du bus/, adc_vo: /tension du bus/, adc_to: /CTN/, led_y: /Témoin/, led_r: /Témoin/ };
  for (const [id, re] of Object.entries(want)) assert.match(role(d.objects.find((o) => o.id === id)), re, `${id} : its net does what it does`);
  assert.equal(b.blocks.find((x) => Object.values(x.connect || {}).includes("AIN2")).connect.VBUS, "VOUT_TAP", "the output voltage : the tap after the contactor");
  assert.equal(hwTag(p, d, d.objects.find((o) => o.id === "adc_v")).state, "bench");
  const H = hwProblems(p, d).map((x) => x.text).join(" ");
  assert.match(H, /DOUT1 — PRECHARGE, DOUT2 — PYRO/); assert.doesNotMatch(H, /DIN0 — WAKE/, "the 12 V is read (JP, par menu : sans 12 V, le principal veille sur le module, le contacteur reste ouvert)"); assert.ok(!hwProblems(p, d).some((x) => x.level === "error" || x.level === "check"), "nothing to fix by hand : what is missing is a block or a net to add, said as a tip");
});
