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
import { hostBoard, hwProblems, hwTag } from "../../web/js/sw/sw_blocks.js";

test("3 in × 3 in : the blocks JP chose, no electrical error, and only routing left", () => {
  const b = bms3Board(); assert.equal(b.id, BMS3_BOARD_ID); assert.deepEqual(b.board.size, [76.2, 76.2]); assert.equal(b.board.layers, 4);
  const T = b.blocks.map((x) => `${x.template}${x.params.name ? `:${x.params.name}` : ""}`);
  for (const k of ["power_or", "can", "rs485", "load_switch:CONTACTEUR", "load_switch:PRECHARGE", "load_switch:PYRO", "din:WAKE", "din:AUX", "mcu"]) assert.ok(T.includes(k), k);
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
  assert.equal(hwTag(p, d, d.objects.find((o) => o.id === "adc_v")).state, "bench");
  const H = hwProblems(p, d).map((x) => x.text).join(" ");
  assert.match(H, /DOUT1 — PRECHARGE, DOUT2 — PYRO/); assert.match(H, /DIN0 — WAKE/); assert.ok(!hwProblems(p, d).some((x) => x.level === "error" || x.level === "check"), "nothing to fix by hand : what is missing is a block or a net to add, said as a tip");
});
