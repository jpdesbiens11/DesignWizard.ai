/* The central BMS board of the module BM 8s8p (architecture de JP, 21 novembre 2026 : « le BMS central interroge les cartes, juge et agit ») :
   built by tools/gen_demo_bms.mjs from its functions to its copper, every link routed ; on the lab table with a CORE board, linked by the four
   wires of the chain.   node --test tests/node/bm_bms.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmsBoard, BMS_BOARD_ID } from "../../web/js/demo/demo_bms.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { tableLinks, tableIssues } from "../../web/js/pcba/lab_table.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the central BMS : its functions, its blocks, every link routed, no error from the electrical and layout checks", () => {
  const b = bmsBoard(); assert.equal(b.id, BMS_BOARD_ID); assert.deepEqual(b.board.size, [85, 62]); assert.equal(b.board.layers, 4);
  const fn = b.functions.map((f) => f.name); for (const n of ["S'alimenter sur le 12 V du véhicule", "Interroger les 8 cartes de CORE", "Lire le courant du module", "Commander le contacteur", "Dire l'état au véhicule", "Juger et décider"]) assert.ok(fn.includes(n), n);
  const kinds = b.blocks.map((x) => x.template); for (const k of ["rs485", "iso_digital", "dcdc_iso", "can", "load_switch", "din", "mcu", "buck"]) assert.ok(kinds.includes(k), k);
  assert.equal(erc(b, LIBRARY).summary.error, 0); const d = checkBoard(b, LIBRARY); assert.equal(d.summary.error, 0, d.findings.filter((x) => x.severity === "error").map((x) => x.message).join(" | "));
  assert.ok(!d.findings.some((x) => x.rule === "PCBA-04"), "nothing left to route");
  assert.match(b.review.open.join(" "), /30 × 48 mm/, "the board does not fit the room the bottom lid kept : said");
});

test("in the project : a product board with its twin, on the lab table with a CORE board, the four wires of the chain linked by themselves", () => {
  const p = bmProject(), twin = p.parts.find((x) => x.id === `${BMS_BOARD_ID}-PCB`); assert.ok(twin); assert.equal(twin.name, "BMS central du module");
  const links = tableLinks(p); assert.equal(links.length, 4); assert.ok(links.every((l) => l.ok && l.a.startsWith(`${BMS_BOARD_ID}:`)));
  assert.deepEqual(links.map((l) => l.A.net).sort(), ["+5V_ISO", "GND_ISO", "RS485_A", "RS485_B"]); assert.deepEqual(tableIssues(p), []);
  const doc = read("docs/BM_MODULE.md"); for (const re of [/Itération 14/, /gen_demo_bms\.mjs/, /85 × 62 mm/, /Pas fait/]) assert.match(doc, re);
});
