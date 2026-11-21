/* The project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026) : the parts of the CORE 1S8P, the CORE, and the module of 8 CORE.
   Iteration 2 : the Molicel P45B from its sheet, the copper sized for 360 A (8 × 45 A). Iteration 3 : the cell holder, top and bottom.
   Iteration 4 : the two L in one laminated busbar ; the flex delivered flat, folded into a box ; a thermistor under the centre of each cell,
   through its thermal washer.
     node --test tests/node/bm_project.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmProject, busbarSizing, CORE_X, CORE_Y, CORE_PITCH, BB_T, I_CORE, STACK } from "../../web/js/demo/demo_bm.js";
import { coreBox, FLEX_T, FLEX_X0, NTC_H } from "../../web/js/demo/demo_bm_box.js";
import { INS_T, WRAP_T } from "../../web/js/demo/demo_bm_lam.js";
import { coreHolder } from "../../web/js/demo/demo_bm_holder.js";
import { cell } from "../../web/js/cad/elec_library.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { partTexts, drawingTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { flatAsm, partCounts } from "../../web/js/core/asm_levels.js";
import { candidates } from "../../web/js/core/assembly_logic.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const M = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
const ROWS = [10.85, 35.55], O = { X: CORE_X, Y: CORE_Y, H: 70.15, t: BB_T, ins: INS_T, w: WRAP_T, grid: 21.7, gap: 3, rows: ROWS };
let cache = null;
/** The parts built once, and the CORE placed : every body in the frame of the CORE. */
async function placedCore() {
  if (cache) return cache;
  const K = await kernel(), p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  const placed = core.instances.map((i) => ({ id: i.id, part: i.part, t: i.placement.t, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, M(i.placement.t)) })) }));
  cache = { K, p, core, built, placed }; return cache;
}

test("the cell is the Molicel INR-21700-P45B of the library, with the values of its sheet ; the larger continuous current, × 8 cells, is the current of a CORE", () => {
  const c = cell("21700-P45B"); assert.equal(c.discharge[1], 45); assert.equal(c.charge, 9); assert.equal(c.seen, "read"); assert.match(c.sheet.ref, /INR21700P45B-01/); assert.equal(c.sheet.ver, "0.2");
  near(c.d, 21.40 + 0.15, "the largest diameter the tolerance allows"); near(c.L, 70.00 + 0.15, "the largest length"); assert.deepEqual(c.envDis, [-40, 60]);
  assert.equal(I_CORE, 8 * Math.max(c.discharge[1], c.charge), "8s8p : the 8 cells in parallel, each at its largest continuous current");
  const p = bmProject(); assert.equal(p.parts.find((x) => x.id === "BM-CELL-21700").library.ref, "21700-P45B");
});

test("the copper is sized for 360 A by the model of the tool : below the ambient the cell allows in discharge, and below 2.5 A/mm²", () => {
  const r = busbarSizing(); assert.equal(r.model, "busbar"); assert.equal(r.part, "BM-BB-LAM"); assert.equal(r.inputs.I, 360); assert.equal(r.inputs.t, BB_T); assert.equal(r.inputs.Tmax, 60);
  assert.ok(r.checks.every((c) => c.ok), JSON.stringify(r.checks)); assert.ok(r.values.T < 60 && r.values.J < 2.5);
  assert.equal(BB_T, 2.0); assert.equal(bmProject().physics[0].id, "phy-bm-busbar", "the calculation is kept in the project, under the name of the busbar");
});

test("the parts of the CORE : each one builds, the top of a CORE is the size of its board", async () => {
  near(CORE_X, 4 * 21.7 + 6, "length"); near(CORE_Y, 2 * 21.7 + 3, "width");
  const { K, p, built } = await placedCore(), board = p.boards[0]; assert.deepEqual(board.board.size, [CORE_X, CORE_Y]); assert.equal(board.part, "CORE-1S8P-PCBA-PCB");
  assert.deepEqual(p.parts.map((x) => x.id), ["BM-CELL-21700", "BM-BB-LAM", "BM-FLEX-BOX", "BM-PUCK", "BM-HOLDER", "CORE-1S8P-PCBA-PCB"]);
  for (const s of p.parts) { assert.deepEqual(validateSpec(s).errors, [], s.id); assert.deepEqual(built.get(s.id).log.filter((l) => l.level === "error"), [], s.id); }
  assert.equal(K.props(built.get("BM-PUCK").bodies[0].shape).volume > 0, true);
});

test("the laminated busbar : the two L of a CORE in one part — two conductors, the paper toward the cells, a thin film outside ; the legs press the next CORE", async () => {
  const { K, p, built } = await placedCore(), lam = p.parts.find((x) => x.id === "BM-BB-LAM"), b = built.get("BM-BB-LAM"), body = (n) => b.bodies.find((x) => x.name === n);
  assert.deepEqual(b.bodies.map((x) => x.name).sort(), ["aramide", "enveloppe", "moins", "plus"]);
  assert.equal(lam.bodies.plus.kind, "conductor"); assert.equal(lam.bodies.moins.kind, "conductor"); assert.equal(lam.bodies.aramide.material, "NOMEX-410"); assert.equal(lam.bodies.enveloppe.material, "PET-FILM");
  const plus = K.bbox(body("plus").shape), moins = K.bbox(body("moins").shape);
  near(plus[4], CORE_Y + INS_T + BB_T, "the + leg, outer face", 1e-3); near(moins[1], -(INS_T + BB_T), "the − leg, outer face", 1e-3);
  near(CORE_PITCH, CORE_Y + 2 * (INS_T + BB_T), "pitch", 1e-9); near(plus[4], CORE_PITCH + moins[1], "the next CORE : its − leg touches this + leg", 1e-3);
  near(plus[0], 3, "the copper leaves the 3 mm of the short ends to the flex", 1e-3); near(plus[3], CORE_X - 3, "both ends", 1e-3);
  for (const pair of [["plus", "moins"], ["plus", "aramide"], ["moins", "aramide"], ["plus", "enveloppe"], ["moins", "enveloppe"]]) assert.ok(K.props(K.common(body(pair[0]).shape, body(pair[1]).shape)).volume < 1e-6, `${pair} : no overlap inside the laminate`);
  const feats = (re) => lam.features.filter((f) => re.test(f.id)).length;
  assert.equal(feats(/^fenetre_c\d\d$/), 8, "a window of the paper over each + cap"); assert.equal(feats(/^bossage_c\d\d$/), 8, "a weld boss in each");
  assert.equal(feats(/^trou_c\d\d$/), 8, "a hole under the centre of each cell"); assert.equal(feats(/^bossage_c\d\d[ab]$/), 16, "two − welds per cell, beside the hole");
  assert.ok(lam.features.some((f) => f.id === "fenetre_bplus") && lam.features.some((f) => f.id === "fenetre_bmoins"), "the windows where the flex takes B+ and B−");
  assert.ok(lam.notes.some((n) => /bord serti/.test(n)), "the note says why the paper is over the + ends");
});

test("the flex in a box : flat central section under the CORE, two full-width panels up the short ends, the board on top ; a thermistor under the centre of each cell, through its washer", async () => {
  const { K, p, core, placed } = await placedCore(), flex = p.parts.find((x) => x.id === "BM-FLEX-BOX"), box = coreBox(O);
  assert.ok(box.checks.ok, JSON.stringify(box.checks.notes));
  assert.equal(flex.flex.spots.filter((s) => s.end === "temp").length, 8); assert.deepEqual(flex.flex.spots.filter((s) => s.end === "volt").map((s) => s.net), ["B−"]);
  assert.deepEqual(flex.flex.branches.filter((b) => b.end === "volt").map((b) => b.net), ["B+"]);
  assert.ok(flex.flex.branches.every((b) => b.w >= CORE_Y - 3 && b.legs[1].bend === 90 && b.legs[2].bend === 90), "full width, up then over the top : a box");
  const at = (id) => core.instances.find((i) => i.id === id).placement.t;
  near(at("flex")[2], -STACK - FLEX_T, "under the film of the busbar"); near(at("carte")[2], 70.15 + STACK + FLEX_T, "the board on the flex, on the busbar");
  const F = placed.find((x) => x.id === "flex"), film = K.bbox(F.bodies.find((b) => b.name === "main").shape);
  assert.ok(film[0] > 0 && film[0] < 1.2 && film[3] > CORE_X - 1.2 && film[3] < CORE_X, `the panels rise in the gaps of the ends : x ${film[0]} … ${film[3]}`);
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t), pucks = core.instances.filter((i) => i.part === "BM-PUCK").map((i) => i.placement.t);
  for (const ts of F.bodies.filter((b) => /^sp_t/.test(b.name))) {
    const bb = K.bbox(ts.shape), c = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2];
    assert.ok(cells.some((t) => Math.hypot(t[0] - c[0], t[1] - c[1]) < 0.05), `${ts.name} under the centre of a cell`); near(bb[5], -STACK + NTC_H, `${ts.name} : its top under its washer`, 1e-3);
  }
  assert.equal(pucks.length, 8); for (const t of pucks) near(t[2] + STACK - NTC_H, 0, "the washer reaches the bottom of the can", 1e-9);
  near(FLEX_X0, 8, "the central section starts 8 mm from the end of the CORE");
});

test("the CORE : nothing goes through anything — busbar, flex, washers, holders, board, cells", async () => {
  const { K, placed } = await placedCore(), hits = [], mine = new Set(["BM-BB-LAM", "BM-FLEX-BOX", "BM-PUCK", "BM-HOLDER", "CORE-1S8P-PCBA-PCB"]);
  for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
    const A = placed[a], B = placed[b]; if (!mine.has(A.part) && !mine.has(B.part)) continue;
    for (const x of A.bodies) for (const y of B.bodies) { const v = K.props(K.common(x.shape, y.shape)).volume; if (v > 1e-3) hits.push(`${A.id}/${x.name} × ${B.id}/${y.name} : ${v.toFixed(3)} mm³`); }
  }
  assert.deepEqual(hits, []);
});

test("the cell holder : one solid, two per CORE, top and bottom — a pocket around each cell, the channel of the flex left free, moldable walls", async () => {
  const { K, p, core, built } = await placedCore(), h = p.parts.find((x) => x.id === "BM-HOLDER"), c = cell("21700-P45B"), b = built.get("BM-HOLDER");
  assert.equal(h.process, "injection_molding"); assert.ok(h.params.dp.value >= c.d + 0.2, "a pocket leaves room around the largest cell");
  assert.ok(h.params.ch.value > 1.0, "the bars leave the panels of the flex their channel"); assert.equal(h.params.h.label, "Hauteur du support (exemple)");
  const sup = core.instances.filter((i) => i.part === "BM-HOLDER").map((i) => i.placement.t[2]); assert.deepEqual(sup.sort((x, y) => x - y), [0, 70.15 - h.params.h.value]);
  assert.equal(b.bodies.length, 1); assert.equal(K.explore(b.bodies[0].shape, K.oc.TopAbs_ShapeEnum.TopAbs_SOLID).length, 1, "one piece");
  const bb = K.bbox(b.bodies[0].shape); near(bb[0], h.params.ch.value, "the X- bar starts after the channel", 1e-3); near(bb[3], CORE_X - h.params.ch.value, "the X+ bar", 1e-3);
  const same = coreHolder({ X: CORE_X, Y: CORE_Y, grid: 21.7, gap: 3, h: 8 }); assert.equal(same.features.filter((f) => /^poche_/.test(f.id)).length, 8); assert.equal(same.features.filter((f) => /^noyau_/.test(f.id)).length, 5);
  const dfx = checkPart(h, b, { mesh: K.tessellate(b.bodies[0].shape) });
  assert.deepEqual(dfx.findings.filter((f) => f.severity === "error").map((f) => `${f.id} ${f.value}`), [], "no error from the molding rules"); assert.ok(!dfx.findings.some((f) => f.id === "MLD-01"));
  const tip = h.params.grid.value - 2 * Math.sqrt((h.params.dp.value / 2) ** 2 - h.params.tooth.value ** 2); assert.ok(tip >= 1.2, `the tip of a tooth : ${tip.toFixed(2)} mm`);
});

test("the module : 8 CORE side by side, the same way round ; 168 parts (21 per CORE) — and no joint between two copies by the same face", () => {
  const p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t);
  assert.equal(cells.length, 8); assert.deepEqual([...new Set(cells.map((t) => t[1]))], ROWS); assert.deepEqual([...new Set(cells.map((t) => +t[0].toFixed(2)))], [13.85, 35.55, 57.25, 78.95]);
  near(CORE_PITCH, 50.9, "46.4 + 2 × (0.25 + 2.0)", 1e-9);
  assert.equal(mod.instances.length, 8); assert.ok(mod.instances.every((i, k) => i.asm === "BM-CORE-ASM" && Math.abs(i.placement.t[1] - k * CORE_PITCH) < 1e-9 && i.placement.r.every((v) => v === 0)));
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(mod, find), counts = partCounts(mod, find);
  assert.equal(flat.instances.length, 168); assert.equal(counts.get("BM-CELL-21700"), 64); assert.equal(counts.get("BM-PUCK"), 64); assert.equal(counts.get("BM-BB-LAM"), 8);
  assert.equal(counts.get("BM-FLEX-BOX"), 8); assert.equal(counts.get("BM-HOLDER"), 16); assert.equal(counts.get("CORE-1S8P-PCBA-PCB"), 8);
  const built = Object.fromEntries(p.parts.map((x) => [x.id, { interfaces: x.interfaces || [] }])), loose = { ...flat, instances: flat.instances.map(({ group, ...i }) => i) };
  assert.deepEqual(candidates(loose, built).filter((c) => c.a.iface === c.b.iface && built[flat.instances.find((i) => i.id === c.a.inst).part] === built[flat.instances.find((i) => i.id === c.b.inst).part]), []);
});

test("wired : the example on the home page, the English of its drawings, the .dwiz file, the documents", () => {
  const p = bmProject(), texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  const back = fromDwiz(toDwiz(p)); assert.equal(back.assemblies.length, 2); assert.equal(back.boards[0].id, "CORE-1S8P-PCBA"); assert.equal(back.physics[0].model, "busbar");
  assert.match(read("web/js/modules/home.js"), /"data-example": "bm"/);
  for (const re of [/50,9/, /support de cellules/i, /busbar laminé/i, /flex en boîte/i, /rondelle/i]) assert.match(read("docs/BM_MODULE.md"), re);
});
