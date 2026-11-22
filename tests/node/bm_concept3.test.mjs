/* BM 8s8p — CONCEPT 3 « blade and fork », on its own branch from MAIN (JP, 22 novembre 2026 : « une 3e branche, partie du concept 1… contacts
   haute puissance à lames… commencer simple » ; by menu : « Lame dans une pince », from the whole of concept 1).
     node --test tests/node/bm_concept3.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, C3_BRANCH, CORE_PITCH } from "../../web/js/demo/demo_bm.js";
import { F3 } from "../../web/js/demo/demo_bm_c3.js";
import { branchNames, rebuild } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);

test("the history : concept 3 is a branch of MAIN (P1), beside concept 2 ; it is concept 1 with its joints changed", () => {
  const p = bmProject({ branch: "c3" }), h = p.history, names = branchNames(h);
  assert.deepEqual(h.points.map((x) => [x.id, x.parent, names.get(x.id)]), [["P1", null, "MAIN"], ["P2", "P1", "concept 2 - consumer product interface"], ["P3", "P1", C3_BRANCH], ["P4", "P3", C3_BRANCH]]);
  assert.equal(h.head, "P4", "the home card opens on the tip of concept 3"); assert.equal(bmProject().history.head, "P1", "by default, MAIN"); assert.equal(bmProject({ branch: true }).history.head, "P2");
  const main = rebuild(h, "P1"), ids = (d) => d.parts.map((x) => x.id);
  assert.deepEqual(ids(p).filter((id) => !ids(main).includes(id)), ["BM3-LAMELLES", "BM3-DISCS", "BM3-LAMELLES-HAUT"]); assert.deepEqual(ids(main).filter((id) => !ids(p).includes(id)), ["BM-SPRING-PLATE", "BM-SPRING-PAD-A", "BM-SPRING-PAD-B"]);
  const first = rebuild(h, "P3"); assert.ok(first.parts.some((x) => x.id === "BM-SPRING-PAD-A"), "the first jet keeps the pads of concept 1 : the lid is its own point");
  const lam = p.parts.find((x) => x.id === "BM-BB-LAM"); for (const f of ["lame", "oreille_plus", "machoire_int", "machoire_ext", "fond_pince"]) assert.ok(lam.features.some((x) => x.id === f), f);
  assert.ok(!main.parts.find((x) => x.id === "BM-BB-LAM").features.some((x) => x.id === "lame"), "MAIN keeps concept 1");
  const k = (id) => p.physics.find((c) => c.id === id);
  assert.equal(k("phy-bm3-fork").verdict, "ok"); assert.ok(k("phy-bm3-fork").values.Irat >= 360 * 3, "the lamellae of a fork carry three times the 360 A");
  assert.equal(k("phy-bm3-blade").verdict, "ok", "the blade at 2.5 mm holds the criterion of the busbar model");
  /* the fork in detail (JP, by menu : « Pince détaillée ») : the housings of the bands, the lead-ins, the brazed heel ; the jaw under the strongest force of the sheet */
  for (const f of ["logement_int", "logement_ext", "talon"]) assert.ok(lam.features.some((x) => x.id === f), f);
  assert.equal(lam.features.find((x) => x.id === "lame").op, "extrude", "the blade drawn with its nose"); assert.equal(lam.features.find((x) => x.id === "machoire_int").profile.poly.length, 5, "the jaw with its mouth chamfer");
  near(F3.jawIn[1] - F3.louvIn[0], F3.groove, "the band stands in its housing"); near(F3.blade[0] - F3.jawIn[1], F3.play, "0.5 mm of air between a jaw and the blade");
  const jaw = k("phy-bm3-jaw"); assert.ok(jaw.checks.every((c) => c.ok), JSON.stringify(jaw.checks)); assert.equal(jaw.inputs.F, 16 * 30, "16 plates at 30 N, the most the sheet of the 112 gives"); assert.ok(jaw.values.delta < 0.1);
});

test("concept 3 builds, and nothing goes through anything ; each blade sits in the next fork, between its two bands", async () => {
  const K = await kernel(), p = bmProject({ branch: "c3" }), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  for (const [id, b] of built) assert.deepEqual(b.log.filter((l) => l.level === "error").map((l) => l.text), [], id);
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(find("BM-8S8P-ASM"), find);
  const T = (i) => ({ ...i.placement, t: i.placement.t.map((v, n) => v + (i.group ? flat.groups[i.group].placement.t[n] : 0)) });
  const inst = flat.instances.filter((i) => !/^core[3-6]~/.test(i.id)).map((i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(T(i))) })) }));
  const bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < inst.length; i++) for (let j = i + 1; j < inst.length; j++) for (const a of inst[i].bodies) for (const b of inst[j].bodies) {
    if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${inst[i].id}/${a.name} × ${inst[j].id}/${b.name} : ${v.toFixed(3)}`); }
  assert.deepEqual(out, []);
  const body = (id, name) => K.bbox(inst.find((x) => x.id === id).bodies.find((b) => b.name === name).shape);
  for (const [n, plus, moins] of [[1, "core1~bb", "core2~lamelles"], [7, "core7~bb", "core8~lamelles"], [8, "core8~bb", "lamelles_plus"]]) {
    const lam = body(plus, "plus"), bi = body(moins, "bande_int"), be = body(moins, "bande_ext");
    near(lam[3], F3.blade[1], `blade ${n} : its outer face`); near(bi[3], F3.blade[0], `blade ${n} on its inner band`); near(be[0], lam[3], `blade ${n} on its outer band`);
    assert.ok(lam[4] >= bi[4] + 0.5, `blade ${n} covers its bands along Y`);
  }
  const neg = body("borne_moins", "plaque"), b1 = body("core1~lamelles", "bande_int"); near(neg[3], F3.blade[1], "the − terminal has a blade"); near(b1[3], F3.blade[0], "in the fork of CORE 1"); assert.ok(neg[4] >= b1[4] + 0.5, "its blade covers the bands");
  near(CORE_PITCH, 50.9, "the pitch is that of concept 1 : no length added");
  /* the top lid (JP : « Pinces côté module ») : each blade of the rigid bridge in its fork, between its two bands */
  for (const tag of ["a", "b"]) {
    const bl = body("couvercle_haut~pont", "pont"), lo = body("couvercle_haut~lamelles_haut", `bande_${tag}_bas`), hi = body("couvercle_haut~lamelles_haut", `bande_${tag}_haut`);
    const blade = K.bbox(K.common(inst.find((x) => x.id === "couvercle_haut~pont").bodies[0].shape, K.box([0, lo[1], lo[5]], [120, lo[4], hi[2]])));
    near(blade[2], lo[5], `blade ${tag} on its lower band`); near(blade[5], hi[2], `blade ${tag} under its upper band`); assert.ok(bl[1] < lo[1], `blade ${tag} covers its bands`);
  }
  K.flush && K.flush();
});
