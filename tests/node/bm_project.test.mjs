/* The project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026) : the parts of the CORE 1S8P, the CORE, and the module of 8 CORE.
     node --test tests/node/bm_project.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmProject, CORE_X, CORE_Y, CORE_PITCH, BB_T, ISO_T } from "../../web/js/demo/demo_bm.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { partTexts, drawingTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { flatAsm, partCounts } from "../../web/js/core/asm_levels.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg} : ${a} ≠ ${b}`);

test("the top of a CORE is two rows of four 21700, 3 mm at both ends and between the rows : the size of its board", () => {
  near(CORE_X, 4 * 21.7 + 6, "length"); near(CORE_Y, 2 * 21.7 + 3, "width");
  const p = bmProject(), board = p.boards[0]; assert.deepEqual(board.board.size, [CORE_X, CORE_Y]);
  assert.equal(p.name, "BM 8s8p - 21700"); assert.equal(board.part, "CORE-1S8P-PCBA-PCB", "the board comes with its mechanical twin");
  assert.deepEqual(p.parts.map((x) => x.id), ["BM-CELL-21700", "BM-BB-POS", "BM-BB-NEG", "BM-ISO-SIDE", "CORE-1S8P-PCBA-PCB"]);
});

test("every part of the CORE builds, each in the frame of the CORE ; the + leg of one CORE meets the − leg of the next", async () => {
  const p = bmProject(), K = await kernel(), box = {};
  for (const s of p.parts) { assert.deepEqual(validateSpec(s).errors, [], s.id); const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error"), [], s.id); box[s.id] = K.bbox(b.bodies[0].shape); }
  const pos = box["BM-BB-POS"], neg = box["BM-BB-NEG"];
  near(pos[4], CORE_Y + ISO_T + BB_T, "the + leg, outer face"); near(neg[1], -(ISO_T + BB_T), "the − leg, outer face");
  near(pos[4], CORE_PITCH + neg[1], "the next CORE : its − leg touches this + leg, face to face");
  assert.ok(pos[2] > neg[2] && pos[5] > neg[5], "the + leg stops above the bottom, the − leg below the top");
  near(box["BM-CELL-21700"][5], 70.8, "a 21700, the largest published length"); near(box["BM-ISO-SIDE"][4], ISO_T, "the insulating sheet");
});

test("the CORE : 8 cells in two rows of 4, the busbars, the sheets, the board on top ; the module : 8 CORE side by side, the same way round", () => {
  const p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t);
  assert.equal(cells.length, 8); assert.deepEqual([...new Set(cells.map((t) => t[1]))], [10.85, 35.55], "two rows, 3 mm apart");
  assert.deepEqual([...new Set(cells.map((t) => +t[0].toFixed(2)))], [13.85, 35.55, 57.25, 78.95], "four side by side, 3 mm from each end");
  near(core.instances.find((i) => i.id === "carte").placement.t[2], 70.8 + BB_T, "the board on the + busbar");
  assert.equal(mod.instances.length, 8); assert.ok(mod.instances.every((i, k) => i.asm === "BM-CORE-ASM" && Math.abs(i.placement.t[1] - k * CORE_PITCH) < 1e-9 && i.placement.r.every((v) => v === 0)));
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(mod, find), counts = partCounts(mod, find);
  assert.equal(flat.instances.length, 104); assert.equal(counts.get("BM-CELL-21700"), 64, "8s8p : 64 cells"); assert.equal(counts.get("BM-BB-POS"), 8); assert.equal(counts.get("CORE-1S8P-PCBA-PCB"), 8);
});

test("wired : the example on the home page, the English of its drawings, the .dwiz file, the documents", () => {
  const p = bmProject(), texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  const back = fromDwiz(toDwiz(p)); assert.equal(back.assemblies.length, 2); assert.equal(back.boards[0].id, "CORE-1S8P-PCBA");
  assert.match(read("web/js/modules/home.js"), /"data-example": "bm"/); assert.match(read("docs/BM_MODULE.md"), /CORE_PITCH|49,4/);
});
