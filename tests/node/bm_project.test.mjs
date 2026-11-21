/* The project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026) : the parts of the CORE 1S8P, the CORE, and the module of 8 CORE.
   Iteration 2 : the Molicel P45B from its sheet, the copper sized for 360 A (8 × 45 A), the flex folded in G.
     node --test tests/node/bm_project.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmProject, busbarSizing, CORE_X, CORE_Y, CORE_PITCH, BB_T, ISO_T, I_CORE } from "../../web/js/demo/demo_bm.js";
import { coreFlex, FLEX_T, ADH, DOWN_X } from "../../web/js/demo/demo_bm_flex.js";
import { cell } from "../../web/js/cad/elec_library.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { partTexts, drawingTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { flatAsm, partCounts } from "../../web/js/core/asm_levels.js";
import { candidates } from "../../web/js/core/assembly_logic.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const M = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];

test("the cell is the Molicel INR-21700-P45B of the library, with the values of its sheet ; the larger continuous current, × 8 cells, is the current of a CORE", () => {
  const c = cell("21700-P45B"); assert.equal(c.discharge[1], 45); assert.equal(c.charge, 9); assert.equal(c.seen, "read"); assert.match(c.sheet.ref, /INR21700P45B-01/); assert.equal(c.sheet.ver, "0.2");
  near(c.d, 21.40 + 0.15, "the largest diameter the tolerance allows"); near(c.L, 70.00 + 0.15, "the largest length"); assert.deepEqual(c.envDis, [-40, 60]);
  assert.equal(I_CORE, 8 * Math.max(c.discharge[1], c.charge), "8s8p : the 8 cells in parallel, each at its largest continuous current");
  const p = bmProject(); assert.equal(p.parts.find((x) => x.id === "BM-CELL-21700").library.ref, "21700-P45B");
});

test("the copper is sized for 360 A by the model of the tool : below the ambient the cell allows in discharge, and below 2.5 A/mm² ; 1.6 mm would not be", () => {
  const r = busbarSizing(); assert.equal(r.model, "busbar"); assert.equal(r.part, "BM-BB-POS"); assert.equal(r.inputs.I, 360); assert.equal(r.inputs.t, BB_T); assert.equal(r.inputs.Tmax, 60);
  assert.ok(r.checks.every((c) => c.ok), JSON.stringify(r.checks)); assert.ok(r.values.T < 60 && r.values.J < 2.5);
  assert.equal(BB_T, 2.0); assert.equal(bmProject().physics[0].id, "phy-bm-busbar", "the calculation is kept in the project, under the name of the + busbar");
});

test("the top of a CORE is two rows of four, 3 mm at both ends and between the rows : the size of its board ; every part builds", async () => {
  near(CORE_X, 4 * 21.7 + 6, "length"); near(CORE_Y, 2 * 21.7 + 3, "width");
  const p = bmProject(), board = p.boards[0]; assert.deepEqual(board.board.size, [CORE_X, CORE_Y]); assert.equal(board.part, "CORE-1S8P-PCBA-PCB");
  assert.deepEqual(p.parts.map((x) => x.id), ["BM-CELL-21700", "BM-BB-POS", "BM-BB-NEG", "BM-ISO-SIDE", "BM-FLEX-G", "CORE-1S8P-PCBA-PCB"]);
  const K = await kernel(), box = {};
  for (const s of p.parts) { assert.deepEqual(validateSpec(s).errors, [], s.id); const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error"), [], s.id); box[s.id] = K.bbox(b.bodies[0].shape); }
  const pos = box["BM-BB-POS"], neg = box["BM-BB-NEG"];
  near(pos[4], CORE_Y + ISO_T + BB_T, "the + leg, outer face"); near(neg[1], -(ISO_T + BB_T), "the − leg, outer face"); near(pos[4], CORE_PITCH + neg[1], "the next CORE : its − leg touches this + leg");
  near(pos[0], 3, "the busbars leave the 3 mm of the short ends to the flex"); near(pos[3], CORE_X - 3, "both ends");
});

test("the flex in G : its core under the board, four fingers down each short end in the gap of 3 mm, a thermistor under each cell, B+ and B− — and nothing it touches", async () => {
  const p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), flex = p.parts.find((x) => x.id === "BM-FLEX-G");
  const { checks } = coreFlex({ X: CORE_X, Y: CORE_Y, H: 70.15, t: BB_T, grid: 21.7, gap: 3, rows: [10.85, 35.55] }); assert.ok(checks.ok, JSON.stringify(checks.notes));
  assert.equal(flex.flex.branches.filter((b) => b.end === "temp").length, 8); assert.deepEqual(flex.flex.branches.filter((b) => b.end === "volt").map((b) => b.net), ["B+", "B−"]);
  assert.ok(flex.flex.branches.filter((b) => b.legs.length === 3).every((b) => b.legs[1].bend === -90 && b.legs[2].bend === -90), "a G : down, then back under");
  const at = (id) => core.instances.find((i) => i.id === id).placement.t;
  near(at("flex")[2], 70.15 + BB_T + ADH, "on the adhesive, on the + busbar"); near(at("carte")[2], 70.15 + BB_T + ADH + FLEX_T, "the board on the flex");
  const K = await kernel(), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  const placed = core.instances.map((i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, M(i.placement.t)) })) }));
  const F = placed.find((x) => x.id === "flex"), hits = [];
  for (const other of placed) if (other.id !== "flex") for (const A of F.bodies) for (const B of other.bodies) { const v = K.props(K.common(A.shape, B.shape)).volume; if (v > 1e-3) hits.push(`${A.name} × ${other.id}/${B.name} : ${v.toFixed(3)} mm³`); }
  assert.deepEqual(hits, [], "the flex goes through nothing");
  const film = K.bbox(F.bodies[0].shape); assert.ok(film[0] > 0 && film[0] < 3 && film[3] < CORE_X && film[3] > CORE_X - 3, `down in the gaps : x ${film[0]} … ${film[3]}`);
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t);
  for (const ts of F.bodies.filter((b) => /^ts_/.test(b.name))) {
    const bb = K.bbox(ts.shape), c = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2];
    assert.ok(cells.some((t) => Math.abs(t[0] - c[0]) < 0.05 && Math.abs(Math.abs(t[1] - c[1]) - 4) < 0.05), `${ts.name} under a cell, beside its axis`); assert.ok(bb[5] <= -BB_T - ADH - FLEX_T + 1e-6, `${ts.name} under the flap`);
  }
  near(DOWN_X, 0.8, "the descent, 0.8 mm from the end of the CORE");
});

test("the CORE and the module : 8 CORE side by side, the same way round, at 51.4 mm ; 112 parts — and no joint between two copies by the same face", () => {
  const p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t);
  assert.equal(cells.length, 8); assert.deepEqual([...new Set(cells.map((t) => t[1]))], [10.85, 35.55]); assert.deepEqual([...new Set(cells.map((t) => +t[0].toFixed(2)))], [13.85, 35.55, 57.25, 78.95]);
  near(CORE_PITCH, 51.4, "46.4 + 2 × (0.5 + 2.0)", 1e-9);
  assert.equal(mod.instances.length, 8); assert.ok(mod.instances.every((i, k) => i.asm === "BM-CORE-ASM" && Math.abs(i.placement.t[1] - k * CORE_PITCH) < 1e-9 && i.placement.r.every((v) => v === 0)));
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(mod, find), counts = partCounts(mod, find);
  assert.equal(flat.instances.length, 112); assert.equal(counts.get("BM-CELL-21700"), 64); assert.equal(counts.get("BM-FLEX-G"), 8); assert.equal(counts.get("CORE-1S8P-PCBA-PCB"), 8);
  // the automatic mating once joined the flex of one CORE to the flex of the next by the same face : two copies of a part are not mated by the same interface
  const built = Object.fromEntries(p.parts.map((x) => [x.id, { interfaces: x.interfaces || [] }])), loose = { ...flat, instances: flat.instances.map(({ group, ...i }) => i) };
  assert.deepEqual(candidates(loose, built).filter((c) => c.a.iface === c.b.iface && built[flat.instances.find((i) => i.id === c.a.inst).part] === built[flat.instances.find((i) => i.id === c.b.inst).part]), []);
});

test("wired : the example on the home page, the English of its drawings, the .dwiz file, the documents", () => {
  const p = bmProject(), texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  const back = fromDwiz(toDwiz(p)); assert.equal(back.assemblies.length, 2); assert.equal(back.boards[0].id, "CORE-1S8P-PCBA"); assert.equal(back.physics[0].model, "busbar");
  assert.match(read("web/js/modules/home.js"), /"data-example": "bm"/); assert.match(read("docs/BM_MODULE.md"), /51,4/); assert.match(read("docs/BM_MODULE.md"), /flex en G/i);
});
