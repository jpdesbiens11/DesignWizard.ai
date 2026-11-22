/* BM 8s8p — CONCEPT 4 « flat louvred faces », on its branch from the tip of concept 3 (JP, 22 novembre 2026 : « comment on s'assure que les
   employés d'usine ne s'électrocutent pas… des contacts flexibles sur les faces des busbars » ; by menu : « Faces planes à lamelles »).
     node --test tests/node/bm_concept4.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, C4_BRANCH, CORE_PITCH } from "../../web/js/demo/demo_bm.js";
import { F4 } from "../../web/js/demo/demo_bm_c4.js";
import { branchNames, rebuild } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);

test("concept 4 is a branch from the tip of concept 3 ; nothing sticks out of a CORE any more", () => {
  const p = bmProject({ branch: "c4" }), h = p.history, names = branchNames(h), pt = h.points.find((x) => x.id === h.head);
  assert.equal(names.get(pt.id), C4_BRANCH); assert.equal(names.get(pt.parent), "concept 3 - blade and fork");
  const lam = p.parts.find((x) => x.id === "BM-BB-LAM"), ids = lam.features.map((f) => f.id);
  for (const f of ["lame", "oreille_plus", "machoire_int", "machoire_ext"]) assert.ok(!ids.includes(f), `${f} is gone`);
  for (const f of ["rainure_1", "rainure_2", "cadre", "fenetre_1", "fenetre_2"]) assert.ok(ids.includes(f), f);
  assert.ok(!p.parts.some((x) => x.id === "BM3-LAMELLES") && p.parts.some((x) => x.id === "BM4-LAMELLES"));
  const cas = (d) => d.parts.find((x) => x.id === "BM-CASING"), c1 = rebuild(h, "P1");
  assert.deepEqual(cas(p).extrusion.profile.holes[0], cas(c1).extrusion.profile.holes[0], "the section of concept 1 : no fork at +X");
  near(cas(c1).params.L.value - cas(p).params.L.value, 32.9, "32.9 mm shorter than concept 1");
  const j = p.physics.find((c) => c.id === "phy-bm4-joint"); assert.equal(j.verdict, "ok"); assert.ok(j.values.Irat >= 3 * 360); assert.ok(!p.physics.some((c) => /^phy-bm3-(fork|blade|jaw)$/.test(c.id)));
});

test("concept 4 builds, and nothing goes through anything ; each band works between its groove and the + face of the CORE before", async () => {
  const K = await kernel(), p = bmProject({ branch: "c4" }), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  for (const [id, b] of built) assert.deepEqual(b.log.filter((l) => l.level === "error").map((l) => l.text), [], id);
  const find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(find("BM-8S8P-ASM"), find);
  const T = (i) => ({ ...i.placement, t: i.placement.t.map((v, n) => v + (i.group ? flat.groups[i.group].placement.t[n] : 0)) });
  const inst = flat.instances.filter((i) => !/^core[3-6]~/.test(i.id)).map((i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(T(i))) })) }));
  const bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < inst.length; i++) for (let j = i + 1; j < inst.length; j++) for (const a of inst[i].bodies) for (const b of inst[j].bodies) {
    if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${inst[i].id}/${a.name} × ${inst[j].id}/${b.name} : ${v.toFixed(3)}`); }
  assert.deepEqual(out, []);
  const body = (id, name) => K.bbox(inst.find((x) => x.id === id).bodies.find((b) => b.name === name).shape), P = CORE_PITCH + F4.frame;
  for (const [n, band, cadre] of [[1, "core2~lamelles", "core2~bb"], [8, "lamelles_plus", "borne_plus"]]) {
    const b = body(band, "bande_1"), plusFace = (n - 1) * P + 48.65;
    near(b[1], plusFace, `the band of joint ${n} on the + face before it`); near(b[4] - b[1], F4.h, "at its working height");
    near(body(cadre, "cadre")[1], plusFace, `the frame of joint ${n} on the + face : the stop`);
  }
  K.flush && K.flush();
});
