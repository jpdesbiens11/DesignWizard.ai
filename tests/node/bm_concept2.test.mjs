/* BM 8s8p — CONCEPT 2 « consumer product interface », on its own branch (JP, 22 novembre 2026 : « on commence le design de l'interface +/− des
   Core 2.0, commence un point de sauvegarde du MAIN et fait une branche parallèle » ; his answers by menu : the CORE in line and pressed,
   louvred bands on the − face, the + rigid with bosses, a quarter-turn handle on a double-lobe face cam, the bottom lid active).
     node --test tests/node/bm_concept2.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bmProject, C2_BRANCH } from "../../web/js/demo/demo_bm.js";
import { C2, camLayout, conceptTwo } from "../../web/js/demo/demo_bm_c2.js";
import { branchNames, rebuild } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);

test("the history of the project : concept 1 kept on MAIN, concept 2 on its branch ; the home card opens on the branch", () => {
  const p = bmProject(), h = p.history, names = branchNames(h);
  assert.deepEqual(h.points.map((x) => [x.id, names.get(x.id)]), [["P1", "MAIN"], ["P2", C2_BRANCH]]); assert.equal(C2_BRANCH, "concept 2 - consumer product interface");
  assert.equal(h.head, "P1", "by default, the project is concept 1 — what every screen and test knew"); assert.ok(p.assemblies.some((a) => a.id === "BM-8S8P-ASM"));
  const c2 = rebuild(h, "P2"); assert.ok(c2.assemblies.some((a) => a.id === "BM2-MODULE-ASM")); assert.ok(!c2.parts.some((x) => x.id === "BM-BB-LAM"), "concept 2 is not concept 1 with more parts");
  assert.ok(c2.parts.some((x) => x.id === p.boards[0].part) && c2.parts.some((x) => x.id === p.boards[1].part), "the two boards keep their twins");
  const b = bmProject({ branch: true }); assert.equal(b.history.head, "P2"); assert.ok(b.assemblies.some((a) => a.id === "BM2-MODULE-ASM"));
  assert.match(read("web/js/modules/home.js"), /bmProject\(\{ branch: true \}\), "#\/assembly\/BM2-MODULE-ASM"/);
});

test("the stack in numbers : a CORE is a big cell ; the bands of one press the + plate of the one before down to its bosses ; the handle presses them all", () => {
  near(C2.pitch, C2.H + 2 * C2.PT + C2.BAND.h, "the pitch : the cells, the two plates, the bands at their working height");
  assert.ok(C2.BAND.h >= 1.5 && C2.BAND.h <= 1.9, "the working height of the bands read in iteration 9 (1.5–1.9 mm)");
  const c = camLayout(); assert.equal(c.lamellae, 20); assert.equal(c.joint, 280); assert.ok(c.amps >= 360, "the lamellae carry the 360 A of a CORE"); assert.ok(c.preload > c.joint, "the Belleville washers give more than the bands ask");
  near(c.stroke, (75 * Math.PI) / 180 * 15 * Math.tan((6 * Math.PI) / 180), "the stroke of a quarter turn, its dwell taken off");
  assert.equal(c.selfLock, false, "at μ = 0.1 a ramp of 6° does not hold itself : the dwell plateau does — said on the cam"); assert.equal(camLayout({ mu: 0.12 }).selfLock, true);
  assert.ok(c.hand < 60, `the hand turns it : ${c.hand} N at the end of the lever`);
  assert.equal(C2.lobe.d, 10, "JP's note : the lobes of the screws at Ø10");
});

test("concept 2 builds, and nothing goes through anything : CORE 1, 2 and 8, the two ends, the casing", async () => {
  const K = await kernel(), p = bmProject(), c2 = conceptTwo({ core: p.boards[0].part, bms: p.boards[1].part }), parts = [...c2.parts, ...p.parts.filter((x) => x.id === p.boards[0].part || x.id === p.boards[1].part)];
  const built = new Map(parts.map((s) => [s.id, buildPart(K, s)]));
  for (const [id, b] of built) assert.deepEqual(b.log.filter((l) => l.level === "error").map((l) => l.text), [], id);
  const find = (id) => c2.assemblies.find((a) => a.id === id), flat = flatAsm(find("BM2-MODULE-ASM"), find);
  assert.equal(flat.instances.filter((i) => /^core\d~c\d\d$/.test(i.id)).length, 64, "8 CORE of 8 cells");
  const T = (i) => ({ ...i.placement, t: i.placement.t.map((v, n) => v + (i.group ? flat.groups[i.group].placement.t[n] : 0)) });
  const inst = flat.instances.filter((i) => !/^core[3-7]~/.test(i.id)).map((i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(T(i))) })) }));
  const bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < inst.length; i++) for (let j = i + 1; j < inst.length; j++) for (const a of inst[i].bodies) for (const b of inst[j].bodies) {
    if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${inst[i].id}/${a.name} × ${inst[j].id}/${b.name} : ${v.toFixed(3)}`); }
  assert.deepEqual(out, []);
  const box = (id) => K.bbox(inst.find((x) => x.id === id).bodies[0].shape);
  near(box("core2~bande_1")[1], C2.H + C2.PT, "the bands of CORE 2 on the + plate of CORE 1"); near(box("core2~bande_1")[4], box("core1~plaque_plus")[4], "as high as its bosses : the stop");
  near(box("couvercle_haut~bande_1")[1], C2.top.yPlus8, "the bands of the pressure plate on the + plate of CORE 8"); near(box("couvercle_haut~plaque_cu")[1], box("core8~plaque_plus")[4], "the pressure plate on the bosses of CORE 8");
  near(box("shunt")[2], box("retour")[5], "the strap on the return busbar"); K.flush && K.flush();
});

test("said in the documentation", () => {
  const d = read("docs/BM_MODULE.md"); for (const re of [/Concept 2/, /consumer product interface/, /bandes à lamelles/, /came/]) assert.match(d, re);
});
