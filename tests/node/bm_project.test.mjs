/* The project « BM 8s8p - 21700 » (demande de JP, 21 novembre 2026) : the parts of the CORE 1S8P, the CORE, and the module of 8 CORE.
   Iteration 2 : the Molicel P45B from its sheet, the copper sized for 360 A (8 × 45 A). Iteration 3 : the cell holder, top and bottom.
   Iteration 4 : the two L in one laminated busbar ; the flex delivered flat, folded into a box ; a thermistor under the centre of each cell,
   through its thermal washer. Iteration 5 : the bottom holder with a floor under the cells and its washers molded in (2K). Iteration 6 : the
   4 contacts between two CORE — springs on the + leg pressed to their stops, lands on the − leg, the LV contacts on insulated islands.
   Iteration 7 : the HV blades stay elastic at the longest travel of the tolerance window ; the plastic crown kept as a variant, to compare.
   Iteration 9 (JP : « ces contacts n'ont pas l'air réalistes… fais-les en lamelles unidirectionnelles, en te basant sur un cas réel de l'industrie ») :
   louvred contact strips modelled on real ones, held in a frame, the gap held by copper stops ; four LV contacts on raised islands, their flex
   tails ; the joint between two CORE measured by the Isolation engine. Iteration 12 (JP : a planar contact with a spring ; the laminated busbar of
   an industrial maker ; the welds visible ; the sensors in the bottom support) : both layers stacked on top, thin tongues welded on each cell, the
   joints face against face, the LV lands flush with their tails inside the legs, the flex of the sensors on cones in the bottom support.
     node --test tests/node/bm_project.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmProject, busbarSizing, CORE_X, CORE_Y, CORE_PITCH, BB_T, I_CORE, STACK, BELOW, FLOOR_T, SLOT, CLIP_T } from "../../web/js/demo/demo_bm.js";
import { coreFlex, FLEX_T, FLEX_X0, NTC_H, CONE } from "../../web/js/demo/demo_bm_box.js";
import { INS_T, WRAP_T, WELD, stackOf, weldSpots } from "../../web/js/demo/demo_bm_lam.js";
import { coreHolder } from "../../web/js/demo/demo_bm_holder.js";
import { ISLAND, LV_NETS, contactLayout, planarJoint, COPPER, tailY } from "../../web/js/demo/demo_bm_contacts.js";
import { lidForces } from "../../web/js/demo/demo_bm_lid.js";
import { sceneBody } from "../../web/js/analysis/cc_scene.js";
import { prepareScene, measurePair } from "../../web/js/analysis/cc_paths.js";
import { BUILTIN, requirement } from "../../web/js/analysis/cc_rules.js";
import { textWidth } from "../../web/js/cad/stroke_font.js";
import { cell } from "../../web/js/cad/elec_library.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { partTexts, drawingTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { flatAsm, partCounts } from "../../web/js/core/asm_levels.js";
import { candidates } from "../../web/js/core/assembly_logic.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";
import { downOf } from "../../web/js/core/stairs.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const M = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
const ROWS = [10.85, 35.55], O = { X: CORE_X, Y: CORE_Y, H: 70.15, t: BB_T, ins: INS_T, w: WRAP_T, floor: FLOOR_T, grid: 21.7, gap: 3, rows: ROWS };
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
  const { p, built } = await placedCore(), board = p.boards[0]; assert.deepEqual(board.board.size, [CORE_X, CORE_Y]); assert.equal(board.part, "CORE-1S8P-PCBA-PCB");
  assert.deepEqual(p.parts.map((x) => x.id), ["BM-CELL-21700", "BM-BB-LAM", "BM-FLEX-BASE", "BM-HOLDER", "BM-HOLDER-BASE", "BM-BASE-CLIP", "BM-LV-PLUS", "BM-LV-MOINS", "BM-TAP-NI-P", "BM-TAP-NI-M", "BM-CASING", "BM-TERM-NEG", "BM-TERM-POS", "BM-RETURN-BB", "BM-LID-RING-TOP", "BM-LID-TOP", "BM-LATCH-CAM", "BM-PRESS-PLATE", "BM-BRIDGE", "BM-SPRING-PLATE", "BM-SPRING-PAD-A", "BM-SPRING-PAD-B", "BM-LID-RING-BOT", "BM-POST", "BM-LID-BOT", "BM-SWAP-CONN", "BM-CONTACTOR", "BM-BMS-BOARD", "BM-LID-STRAPS", "CORE-1S8P-PCBA-PCB", "BMS-CENTRAL-PCBA-PCB"]);
  for (const s of p.parts) { assert.deepEqual(validateSpec(s).errors, [], s.id); assert.deepEqual(built.get(s.id).log.filter((l) => l.level === "error"), [], s.id); }
  near(BELOW, FLOOR_T + SLOT + CLIP_T, "under the cans : the floor, the slot of the flex, the clipped plate"); near(BELOW, 3.8, "the casing sees the same bottom as before");
  near(STACK, 2 * INS_T + 2 * BB_T + WRAP_T, "on the cans : paper, − copper, paper, + copper, film");
});

test("the laminated busbar, as the trade makes them : both layers stacked on top of the cells, insulated, enveloped ; its exit tabs bent at 90° are the contact faces", async () => {
  const { K, p, built } = await placedCore(), lam = p.parts.find((x) => x.id === "BM-BB-LAM"), b = built.get("BM-BB-LAM"), body = (n) => b.bodies.find((x) => x.name === n), z = stackOf({ H: 70.15, ins: INS_T, t: BB_T, w: WRAP_T });
  assert.deepEqual(b.bodies.map((x) => x.name).sort(), ["aramide", "enveloppe", "isolant_lv", "moins", "plus"]);
  assert.equal(lam.bodies.plus.net, "CORE+"); assert.equal(lam.bodies.moins.net, "CORE-"); assert.equal(lam.bodies.aramide.material, "NOMEX-410"); assert.equal(lam.bodies.enveloppe.material, "PET-FILM");
  const plus = K.bbox(body("plus").shape), moins = K.bbox(body("moins").shape);
  near(plus[4], CORE_Y + INS_T + BB_T, "the + leg, outer face", 1e-3); near(moins[1], -(INS_T + BB_T), "the − leg, outer face", 1e-3);
  near(CORE_PITCH, CORE_Y + 2 * (INS_T + BB_T), "pitch : face against face, no gap", 1e-9); near(plus[4], CORE_PITCH + moins[1], "the next CORE : its − leg lies on this + leg", 1e-3);
  near(plus[5], z.zP1, "the + layer on top", 1e-3); near(moins[5], z.zM1, "the − layer under it", 1e-3); near(moins[2], 5, "the legs stop 5 mm above the bottom of the cells", 1e-3);
  near(plus[2], 5, "nothing of the + under the cells : its leg stops 5 mm up", 1e-3); near(K.bbox(body("aramide").shape)[2], 0, "the paper of the flanks reaches the bottom of the cells", 1e-3);
  assert.ok(!lam.features.some((f) => /papier_bas|plaque_moins|film_bas/.test(f.id)), "nothing under the cells any more : the bottom belongs to the support and the sensors");
  const names = b.bodies.map((x) => x.name);
  for (const pair of names.flatMap((x, i) => names.slice(i + 1).map((y) => [x, y]))) assert.ok(K.props(K.common(body(pair[0]).shape, body(pair[1]).shape)).volume < 1e-6, `${pair} : no overlap inside the laminate`);
  /* the two conductors never touch : the − layer stops short of the + leg, the + layer starts clear of the − leg */
  const gapPM = K.props(K.common(body("plus").shape, body("moins").shape)).volume; assert.ok(gapPM < 1e-9);
  /* the thin parts on the cells and their welds, drawn */
  const cells = weldSpots({ gap: 3, grid: 21.7, rows: ROWS }); assert.equal(cells.length, 8); assert.equal(cells.flatMap((c) => c.spots).length, 16, "two − welds per cell, on the shoulder");
  for (const c of cells) for (const s of c.spots) near(Math.hypot(s[0] - c.x, s[1] - c.y), WELD.spotR, "on the shoulder", 2e-3);
  const f = (id) => lam.features.find((x) => x.id === id); assert.equal(f("disques_plus").at.length, 8); assert.equal(f("disques_moins").at.length, 16);
  assert.equal(f("soudures_plus").at.length, 8, "a weld ring on each cap"); assert.equal(f("soudures_moins").at.length, 16, "and on each − spot");
  assert.equal(lam.features.filter((x) => /^montee_c\d\d$/.test(x.id)).length, 8, "a + tongue rises from each cap to the + layer");
  assert.ok(WELD.rise[1] < WELD.well / 2 - 0.8, "the + tongue passes the − layer with air around it"); assert.ok(WELD.spotR - WELD.spot / 2 >= WELD.well / 2 - 1e-9, "the − discs lie outside the well"); assert.ok(WELD.spotR + WELD.spot / 2 <= 21.55 / 2, "and on the can, not over its edge");
  assert.ok(lam.notes.some((n) => /épaule/.test(n) && /confirmer/.test(n)), "the − on the shoulder of the can, said to be confirmed"); assert.ok(lam.notes.some((n) => /anneau gravé/.test(n)), "the welds, drawn and said");
});

test("the flex of the sensors : it slides into the bottom support, a cone under each cell carries its thermistor to the bottom of the can ; one panel up to the board", async () => {
  const { K, p, core, placed } = await placedCore(), flex = p.parts.find((x) => x.id === "BM-FLEX-BASE"), fx = coreFlex({ ...O, top: STACK });
  assert.ok(fx.checks.ok, JSON.stringify(fx.checks.notes)); assert.equal(flex.flex.spots.filter((s) => s.end === "temp").length, 8); assert.equal(flex.flex.spots.filter((s) => s.end === "volt").length, 0, "the voltage is taken by the nickel tabs");
  assert.deepEqual(flex.flex.branches.map((b) => b.id), ["PA"], "one panel, at the −X end"); assert.equal(flex.flex.branches[0].tracks, 16);
  const at = (id) => core.instances.find((i) => i.id === id).placement.t;
  near(at("flex")[2], -(FLOOR_T + FLEX_T), "the flex against the floor of the support"); near(at("carte")[2], 70.15 + STACK + FLEX_T, "the board on the panel of the flex, on the busbar");
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t), F = placed.find((x) => x.id === "flex");
  for (const ts of F.bodies.filter((b) => /^sp_t/.test(b.name))) {
    const bb = K.bbox(ts.shape), c = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2];
    assert.ok(cells.some((t) => Math.hypot(t[0] - c[0], t[1] - c[1]) < 0.05), `${ts.name} under the centre of a cell`); near(bb[5], 0, `${ts.name} touches the bottom of the can`, 1e-3);
  }
  const cone = flex.features.find((f) => f.id === "cones"); assert.equal(cone.at.length, 8); assert.equal(cone.tip, CONE.tip); near(cone.h + NTC_H, FLOOR_T, "the cone and its thermistor : the thickness of the floor");
  const base = p.parts.find((x) => x.id === "BM-HOLDER-BASE"); assert.ok(base.features.some((f) => f.id === "trous_cones" && f.at.length === 8)); assert.ok(base.params.hc.value > CONE.d, "the hole of the floor lets the foot of the cone pass");
  const clip = p.parts.find((x) => x.id === "BM-BASE-CLIP"); assert.equal(clip.bodies.mousse.material, "SILICONE"); assert.equal(clip.features.find((f) => f.id === "pastilles").at.length, 8, "a pad of foam under each cone");
  assert.ok(!Object.values(base.bodies || {}).some((x) => x.material === "THERMAL-PAD"), "no washer any more"); near(FLEX_X0, 8, "the flex starts 8 mm from the end of the CORE");
  assert.match(flex.notes.join(" "), /cône/); assert.match(flex.notes.join(" "), /développé à plat n'en a pas/);
});

test("the CORE : nothing goes through anything — cells, holders, the clipped plate, the flex and its cones, the laminated busbar, the LV contacts, the nickel tabs, the board", async () => {
  const { K, placed } = await placedCore(), hits = [], bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5];
  for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
    const A = placed[a], B = placed[b]; if (A.part === "BM-CELL-21700" && B.part === "BM-CELL-21700") continue;
    for (const x of A.bodies) for (const y of B.bodies) { if (!ov(bb(x.shape), bb(y.shape))) continue; const v = K.props(K.common(x.shape, y.shape)).volume; if (v > 1e-3) hits.push(`${A.id}/${x.name} × ${B.id}/${y.name} : ${v.toFixed(3)} mm³`); }
  }
  assert.deepEqual(hits, []);
  /* the next CORE, at the pitch : its − leg lies on this + leg, nothing goes into it */
  const next = placed.map((P) => ({ ...P, bodies: P.bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, M([0, CORE_PITCH, 0])) })) })), into = [];
  for (const A of placed) for (const B of next) for (const x of A.bodies) for (const y of B.bodies) { if (!ov(bb(x.shape), bb(y.shape))) continue; const v = K.props(K.common(x.shape, y.shape)).volume; if (v > 1e-3) into.push(`${A.id}/${x.name} × ${B.id}/${y.name} : ${v.toFixed(3)}`); }
  assert.deepEqual(into, []);
});

test("the cell holders : the top one solid ; the bottom support with its floor pierced under each cell, and its clipped plate that leaves the slot of the flex — moldable", async () => {
  const { K, p, core, built } = await placedCore(), h = p.parts.find((x) => x.id === "BM-HOLDER"), c = cell("21700-P45B"), b = built.get("BM-HOLDER");
  assert.equal(h.process, "injection_molding"); assert.ok(h.params.dp.value >= c.d + 0.2, "a pocket leaves room around the largest cell");
  assert.deepEqual(core.instances.filter((i) => /^BM-(HOLDER|BASE)/.test(i.part)).map((i) => [i.part, i.placement.t[2]]), [["BM-HOLDER", 70.15 - h.params.h.value], ["BM-HOLDER-BASE", 0], ["BM-BASE-CLIP", 0]]);
  assert.equal(b.bodies.length, 1); assert.equal(K.explore(b.bodies[0].shape, K.oc.TopAbs_ShapeEnum.TopAbs_SOLID).length, 1, "one piece");
  const same = coreHolder({ X: CORE_X, Y: CORE_Y, grid: 21.7, gap: 3, h: 8 }); assert.equal(same.features.filter((f) => /^poche_/.test(f.id)).length, 8); assert.equal(same.features.filter((f) => /^noyau_/.test(f.id)).length, 5);
  const dfx = checkPart(h, b, { mesh: K.tessellate(b.bodies[0].shape) }); assert.deepEqual(dfx.findings.filter((f) => f.severity === "error").map((f) => `${f.id} ${f.value}`), [], "no error from the molding rules");
  const bp = p.parts.find((x) => x.id === "BM-HOLDER-BASE"), main = built.get("BM-HOLDER-BASE").bodies.find((x) => x.name === "main");
  near(K.bbox(main.shape)[2], -FLOOR_T, "the floor under the cells", 1e-3); assert.equal(K.explore(main.shape, K.oc.TopAbs_ShapeEnum.TopAbs_SOLID).length, 1, "the support is one piece");
  assert.deepEqual(checkPart(bp, built.get("BM-HOLDER-BASE"), { mesh: K.tessellate(main.shape) }).findings.filter((f) => f.severity === "error").map((f) => f.id), []);
  const clip = p.parts.find((x) => x.id === "BM-BASE-CLIP"), cb = built.get("BM-BASE-CLIP"), plate = K.bbox(cb.bodies.find((x) => x.name === "main").shape);
  near(plate[2], -BELOW, "the plate is the bottom of the CORE", 1e-3); near(plate[5], -FLOOR_T, "its rims reach the floor : the slot between them", 1e-3);
  assert.deepEqual(checkPart(clip, cb, { mesh: K.tessellate(cb.bodies[0].shape) }).findings.filter((f) => f.severity === "error").map((f) => f.id), [], "the clipped plate : no molding error");
  assert.ok(!clip.features.some((f) => f.id === "bord_d"), "no rim at the −X end : the flex comes in there");
});

test("the contacts between two CORE : face against face ; the four LV lands flush, their tails inside the legs ; the bound of Holm, with the force of the lid", async () => {
  const { K, p, core, placed } = await placedCore(), L = contactLayout(CORE_X), Yp = CORE_Y + INS_T + BB_T, Ym = -(INS_T + BB_T);
  assert.deepEqual(L.lv.map((c) => c.net), LV_NETS); assert.deepEqual(LV_NETS, ["GND_ISO", "RS485_A", "RS485_B", "+5V_ISO"], "the 4 wires of the chain connectors of the CORE board");
  assert.ok(!p.parts.some((x) => /^BM-(LAM-HV|LAM-LV|LAM-CAGE|STOP)$/.test(x.id)), "no louvred strip, no frame, no stop any more");
  /* the lands flush with the outer faces, on both legs ; behind each, a pin and a tail up to the board */
  const lvp = placed.find((x) => x.id === "lvp"), lvm = placed.find((x) => x.id === "lvm"), zb = core.instances.find((i) => i.id === "carte").placement.t[2];
  assert.deepEqual(lvp.bodies.map((b) => b.name).sort(), ["5viso", "gndiso", "rs485a", "rs485b"]);
  for (const B of lvp.bodies) { const bb = K.bbox(B.shape); near(bb[4], Yp, `${B.name} : flush with the + leg`, 1e-3); near(bb[5], zb, `${B.name} : its tail reaches the board`, 1e-3); near(bb[1], tailY(CORE_Y, 1)[0], "its tail inside the leg", 1e-3); }
  for (const B of lvm.bodies) { const bb = K.bbox(B.shape); near(bb[1], Ym, `${B.name} : flush with the − leg`, 1e-3); near(bb[5], zb, `${B.name} : its tail reaches the board`, 1e-3); }
  /* the tails climb where the cans are far from the legs : the valleys a cell from the middle */
  for (const c of L.lv) assert.ok(Math.min(...[13.85, 35.55, 57.25, 78.95].map((x) => Math.abs(c.x - x))) >= 7.5, `${c.net} : clear of the tangent line of a can`);
  const lam = p.parts.find((x) => x.id === "BM-BB-LAM"), f = (re) => lam.features.filter((x) => re.test(x.id)).map((x) => x.id);
  assert.equal(f(/^ilot_[a-z0-9]+_[pm]$/).length, 8, "an insert for each LV contact, on both legs"); assert.equal(f(/^fente_/).length, 8, "a slot of each tail through the top of the laminate");
  const marks = lam.features.filter((x) => x.op === "mark"); assert.deepEqual(marks.map((m) => `${m.face} ${m.text}`).sort(), ["+Y 0V", "+Y 5V", "+Y A", "+Y B", "+Y HV +", "+Y HV +", "-Y 0V", "-Y 5V", "-Y A", "-Y B", "-Y HV −", "-Y HV −"]);
  for (const m of marks) { const w = textWidth(m.text, m.h) / 2 + m.w, hh = m.h / 2 + m.w, [x, z] = m.at; assert.ok(x - w > 3 && x + w < CORE_X - 3 && z - hh > 5 && z + hh < 70, `${m.face} ${m.text} : on the leg`);
    for (const c of L.lv) assert.ok(Math.hypot(Math.max(Math.abs(x - c.x) - w, 0), Math.max(Math.abs(z - c.z) - hh, 0)) > ISLAND.hole / 2 + 0.2, `${m.text} clear of the island ${c.net}`); }
  /* the bound : Holm's single spot, as printed by Lu et al. ; the force of the springs of the top lid */
  const F = lidForces(I_CORE), r = planarJoint(F.joint, I_CORE);
  near(r.a, Math.sqrt(F.joint / (Math.PI * COPPER.H)), "a = √(F / (π H))", 1e-12); near(r.R, COPPER.rho / (2 * r.a), "R = ρ / (2a)", 1e-15);
  assert.equal(F.joint, 1100); assert.ok(r.R < 14e-6 && r.U < 5e-3, `a joint : ${(r.R * 1e6).toFixed(1)} µΩ, ${(r.U * 1e3).toFixed(2)} mV at 360 A — at most`);
  assert.ok(planarJoint(2 * F.joint, I_CORE).R < r.R, "more force, less resistance"); assert.equal(COPPER.rho, 16.78e-9); assert.equal(COPPER.H, 878e6);
  assert.ok(!p.physics.some((x) => x.id === "phy-bm-lam"), "the calculation of the louvres is gone with them");
});

test("the islands, measured by the Isolation engine on the joint between CORE 7 and CORE 8 : the bus against the copper of the joint", async () => {
  const { K, p, placed, built } = await placedCore(), J = p.assemblies.find((a) => a.id === "BM-JOINT-ASM"), iso = J.isolation;
  assert.deepEqual(J.instances.map((i) => i.id), ["bb", "lvp", "bb2", "lvm2"]); assert.equal(iso.params.level, "functional"); assert.deepEqual(iso.nets.map((n) => [n.name, n.voltage]), [["N7", 29.4], ["+5V_ISO", 5], ["RS485_A", 5], ["RS485_B", 5], ["GND_ISO", 0]]); assert.deepEqual([iso.overrides["bb/moins"].kind, iso.overrides["bb2/plus"].kind], ["ignore", "ignore"], "the far conductors are left out : the islands face the copper of the joint");
  const byId = new Map(placed.map((x) => [x.id, x])), src = { bb: "bb", lvp: "lvp", bb2: "bb", lvm2: "lvm" }, bodies = [];
  for (const inst of J.instances) {
    const from = byId.get(src[inst.id]), shift = inst.placement.t[1], part = p.parts.find((x) => x.id === inst.part), meta = built.get(inst.part);
    for (const b of from.bodies) { const raw = meta.bodies.find((x) => x.name === b.name), id = `${inst.id}/${b.name}`, shape = shift ? K.transform(b.shape, M([0, shift, 0])) : b.shape, mesh = K.tessellate(shape);
      bodies.push(sceneBody(id, `${part.name} · ${b.name}`, { ...raw, mesh }, { pos: mesh.pos, idx: mesh.idx }, null, iso.overrides[id] || {})); }
  }
  const scene = prepareScene(bodies.map((b) => ({ id: b.id, name: b.name, kind: b.kind, net: b.net, group: b.group, printed: b.printed, pos: b.pos, idx: b.idx })), {}), net = (n) => iso.nets.find((x) => x.name === n), out = [];
  for (const sig of ["GND_ISO", "RS485_A"]) {
    const req = requirement(BUILTIN, iso.params, net(sig), net("N7"), "functional"), m = measurePair(scene, sig, "N7", { x: req.x_mm, maxClearance: 25, maxCreepage: 40 });
    const crpReq = req.creepage_mm[m.creepage.group || "IIIa"] ?? req.creepage_mm.IIIb;
    out.push({ sig, clr: m.clearance.d, crp: m.creepage.d, clrReq: req.clearance_mm, crpReq });
    assert.ok(m.clearance.d >= req.clearance_mm, `${sig} ↔ N7 : clearance ${m.clearance.d} ≥ ${req.clearance_mm} mm`); assert.ok(m.creepage.d >= crpReq, `${sig} ↔ N7 : creepage ${m.creepage.d} ≥ ${crpReq} mm`);
  }
  assert.ok(out.every((x) => x.clr > 0.5 && x.crp > 0.5), JSON.stringify(out));
});

test("the module : 8 CORE side by side, the same way round ; 144 parts in the CORE (18 each), the casing, the two terminals, the return busbar and the two lids — 171 — and no joint between two copies by the same face", () => {
  const p = bmProject(), core = p.assemblies.find((a) => a.id === "BM-CORE-ASM"), mod = p.assemblies.find((a) => a.id === "BM-8S8P-ASM");
  const cells = core.instances.filter((i) => i.part === "BM-CELL-21700").map((i) => i.placement.t);
  assert.equal(cells.length, 8); assert.deepEqual([...new Set(cells.map((t) => t[1]))], ROWS); assert.deepEqual([...new Set(cells.map((t) => +t[0].toFixed(2)))], [13.85, 35.55, 57.25, 78.95]);
  near(CORE_PITCH, 50.9, "46.4 + 2 × (0.25 + 2.0) : face against face", 1e-9);
  const cores = mod.instances.filter((i) => i.asm === "BM-CORE-ASM"); assert.equal(mod.instances.length, 14); assert.equal(cores.length, 8); assert.equal(core.instances.length, 18);
  assert.ok(cores.every((i, k) => Math.abs(i.placement.t[1] - k * CORE_PITCH) < 1e-9 && i.placement.r.every((v) => v === 0)));
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(mod, find), counts = partCounts(mod, find);
  assert.equal(flat.instances.length, 171); assert.equal(counts.get("BM-LV-PLUS"), 8); assert.equal(counts.get("BM-LV-MOINS"), 8); assert.equal(counts.get("BM-TAP-NI-P"), 8); assert.equal(counts.get("BM-BASE-CLIP"), 8);
  assert.equal(counts.get("BM-CASING"), 1); assert.equal(counts.get("BM-TERM-NEG"), 1); assert.equal(counts.get("BM-TERM-POS"), 1); assert.equal(counts.get("BM-CELL-21700"), 64); assert.equal(counts.get("BM-BB-LAM"), 8);
  assert.equal(counts.get("BM-FLEX-BASE"), 8); assert.equal(counts.get("BM-HOLDER"), 8); assert.equal(counts.get("BM-HOLDER-BASE"), 8); assert.equal(counts.get("CORE-1S8P-PCBA-PCB"), 8);
  const built = Object.fromEntries(p.parts.map((x) => [x.id, { interfaces: x.interfaces || [] }])), loose = { ...flat, instances: flat.instances.map(({ group, ...i }) => i) };
  assert.deepEqual(candidates(loose, built).filter((c) => c.a.iface === c.b.iface && built[flat.instances.find((i) => i.id === c.a.inst).part] === built[flat.instances.find((i) => i.id === c.b.inst).part]), []);
});

test("wired : the example on the home page, the English of its drawings, the .dwiz file, the documents", () => {
  const p = bmProject(), texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  const back = fromDwiz(toDwiz(p)); assert.equal(back.assemblies.length, 5); assert.equal(back.boards[0].id, "CORE-1S8P-PCBA"); assert.equal(back.physics[0].model, "busbar");
  assert.match(read("web/js/modules/home.js"), /"data-example": "bm"/);
  assert.deepEqual(downOf("assembly", ["BM-8S8P-ASM"], p).map((d) => d.label), ["CORE 1S8P", "Isolation", "Dessin"], "one button for the sub-assemblies (JP : « juste un bouton assemblage, pas 4 ») — the CORE, which comes most often");
  for (const re of [/Itération 12/, /Holm/, /arXiv 1701\.00447/, /épaule/, /cône/, /Itération 11 b/, /contacteur/, /connecteur d'échange/i, /Itération 11/, /came quart de tour/i, /sectionneur/i, /Itération 10/, /EVO PT/, /boîtier extrudé/i, /borne −/i, /50,9 mm/, /Itération 9/, /lamelles/, /LOUVER_tron 112/, /Itération 8/, /sertie/, /Itération 6/, /couronne de lames/i, /butée/, /support de cellules/i, /busbar laminé/i, /flex en boîte/i, /rondelle/i, /2K/, /Itération 5/]) assert.match(read("docs/BM_MODULE.md"), re);
});
