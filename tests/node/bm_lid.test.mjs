/* The project « BM 8s8p - 21700 », iteration 11 a (JP, 22 novembre 2026 : « un busbar le long du boîtier qui se connecte aux 2 couvercles… le
   2e couvercle vient fermer la boucle de courant interne, pousse sur les cores pour écraser les contacts en série et se lock avec un latch
   rotatif… l'interface des 2 couvercles est vissée au casing… métal ou plastique robuste » ; « Go, c'est bien les modifs » : a quarter-turn
   cam latch, interface rings in machined aluminium) : the return busbar and the top lid.
     node --test tests/node/bm_lid.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, CORE_PITCH, CASE_Y0, CASE_L } from "../../web/js/demo/demo_bm.js";
import { lidForces } from "../../web/js/demo/demo_bm_lid.js";
import { RETURN, caseSection } from "../../web/js/demo/demo_bm_case.js";
import { COPPER } from "../../web/js/demo/demo_bm_contacts.js";
import { buildPart } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { fabPlayable } from "../../web/js/core/fab_path.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const TOP = ["BM-RETURN-BB", "BM-LID-RING-TOP", "BM-LID-TOP", "BM-LATCH-CAM", "BM-PRESS-PLATE", "BM-BRIDGE", "BM-SPRING-PLATE", "BM-SPRING-PAD-A", "BM-SPRING-PAD-B"];
let cache = null;
async function topEnd() {
  if (cache) return cache;
  const K = await kernel(), p = bmProject(), find = (id) => p.assemblies.find((a) => a.id === id), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  const flat = flatAsm(find("BM-8S8P-ASM"), find), T = (i) => ({ ...i.placement, t: i.placement.t.map((v, n) => v + (i.group ? flat.groups[i.group].placement.t[n] : 0)) });      // a part in a CORE : the place of its CORE added
  const place = (i) => ({ id: i.id, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(T(i))) })) });
  const near8 = flat.instances.filter((i) => /^(couvercle_haut~|retour$|boitier$|borne_plus$|core8~)/.test(i.id)).map(place);
  cache = { K, p, built, flat, near8, box: (id, body) => { const x = near8.find((q) => q.id === id); return K.bbox((body ? x.bodies.find((b) => b.name === body) : x.bodies[0]).shape); } }; return cache;
}

test("the top end builds : no error ; the machined ring and the molded parts pass their DFx rules", async () => {
  const { p, built } = await topEnd();
  for (const id of TOP) { assert.deepEqual(built.get(id).log.filter((l) => l.level === "error"), [], id); }
  for (const id of ["BM-LID-RING-TOP", "BM-LID-TOP", "BM-PRESS-PLATE"]) { const f = checkPart(p.parts.find((s) => s.id === id), built.get(id)); assert.deepEqual((f.findings || f).filter((x) => x.severity === "error" || x.severity === "warn").map((x) => x.id || x.rule), [], id); }
  assert.equal(p.parts.find((s) => s.id === "BM-LID-RING-TOP").material, "AL6061-T6", "JP's choice : a ring that does not creep");
  assert.deepEqual(fabPlayable(p.parts.find((s) => s.id === "BM-LID-RING-TOP")), { ok: true, kind: "machined" });
  for (const id of ["BM-RETURN-BB", "BM-BRIDGE", "BM-LATCH-CAM"]) assert.equal(fabPlayable(p.parts.find((s) => s.id === id)).ok, false, `${id} : a specialist's part is not played`);
});

test("the top end closes : nothing goes through anything — lid, springs, bridge, return busbar, + terminal, casing, CORE 8", async () => {
  const { K, near8 } = await topEnd(), bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < near8.length; i++) for (let j = i + 1; j < near8.length; j++) { const A = near8[i], B = near8[j]; if (A.id.startsWith("core8~") && B.id.startsWith("core8~")) continue;
    for (const a of A.bodies) for (const b of B.bodies) { if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${A.id}/${a.name} × ${B.id}/${b.name} : ${v.toFixed(3)}`); } }
  assert.deepEqual(out, []);
});

test("the loop closes by pressure : pad A on the land of the + terminal, pad B on the tab of the return busbar — each face against face", async () => {
  const { box } = await topEnd(), land = 8 * CORE_PITCH - 2.25 + 2;
  near(box("borne_plus", "plaque")[4], land, "the back of the + terminal");
  const pA = box("couvercle_haut~pont", "plotA"), pB = box("couvercle_haut~pont", "plotB"), tab = box("retour");
  near(pA[1], land, "pad A on the land"); assert.ok(pA[2] >= 66 && pA[5] <= 80, "pad A on the bare land, above the backing plate");
  near(pB[1], tab[4], "pad B on the tab"); assert.ok(pB[0] >= tab[0] && pB[3] <= tab[3], "pad B within the tab");
  near(box("couvercle_haut~plaque")[1], box("borne_plus", "appui")[4], "the pressure plate on the backing plate of the + terminal");
});

test("the latch holds the cap : the arm bears on both lips of the ring ; the springs stand between their seats ; the ring is screwed to the casing", async () => {
  const { box, p } = await topEnd(), arm = box("couvercle_haut~came"), ring = box("couvercle_haut~anneau"), cap = box("couvercle_haut~couvercle");
  near(ring[1], CASE_Y0 + CASE_L - 9, "the lips, 9 mm inside the casing"); near(ring[4], CASE_Y0 + CASE_L + 6, "the flange on the end of the casing");
  near(arm[1], ring[1] + 3, "the arm on the lips"); near(cap[1], ring[4], "the cap on the ring");
  const c = 0.02;      // the box of a helix is measured on its surface : a few micrometres off
  for (const k of [1, 2, 3, 4]) { const s = box(`couvercle_haut~ressort_p${k}`); near(s[1], box("couvercle_haut~plaque")[4], "a plate spring on the plate", c); near(s[4], cap[1], "and under the cap", c); }
  for (const k of [1, 2]) { near(box(`couvercle_haut~ressort_a${k}`)[1], box("couvercle_haut~pont", "plotA")[4], "on pad A", c); near(box(`couvercle_haut~ressort_b${k}`)[4], cap[1], "pad B springs under the cap", c); }
  const S = caseSection(), hole = p.parts.find((s) => s.id === "BM-LID-RING-TOP").features.find((f) => f.id === "vis");
  assert.deepEqual(hole.at, S.ports.map((q) => [q[0], q[1]]), "the screws go into the ports of the casing");
});

test("the forces, in one place : every planar joint pressed by the springs, its resistance bounded with Holm ; what each screw of the ring pulls", () => {
  const F = lidForces();
  assert.deepEqual([F.stack, F.padA, F.padB], [800, 300, 300]); assert.equal(F.joint, F.stack + F.padA, "every joint of the stack carries the plate and pad A");
  assert.equal(F.total, 1400); assert.equal(F.perScrew, 350);
  near(F.jointR.R, COPPER.rho / 2 * Math.sqrt(Math.PI * COPPER.H / F.joint), "R = (ρ/2) √(πH/F)", 1e-12);
  assert.ok(F.jointR.R < 14e-6 && F.padAR.R < 26e-6 && F.padBR.R < 26e-6, `at most : ${(F.jointR.R * 1e6).toFixed(1)} µΩ a joint, ${(F.padAR.R * 1e6).toFixed(1)} µΩ a pad`);
  const p = bmProject(); assert.match(p.parts.find((s) => s.id === "BM-LID-RING-TOP").function, /350 N/); assert.match(p.parts.find((s) => s.id === "BM-LID-TOP").notes.join(" "), /1400 N/);
  assert.match(p.parts.find((s) => s.id === "BM-BRIDGE").notes.join(" "), /Holm/);
});

test("the return busbar : 50 × 4 mm in the channel, its tab raised through the window milled at the top end ; every conductor of the loop on PACK+", async () => {
  const { box, p } = await topEnd(), S = caseSection(), b = box("retour");
  near(b[3] - b[0], RETURN.w, "its width"); assert.ok(b[2] >= S.channel.z0 && b[0] >= S.channel.x0 && b[3] <= S.channel.x1, "in the channel"); assert.ok(b[1] < CASE_Y0, "it leaves the casing at the bottom, toward the bottom lid");
  const casing = p.parts.find((s) => s.id === "BM-CASING"); assert.ok(casing.features.some((f) => f.id === "fenetre_retour" && f.mode === "cut"));
  assert.equal(p.parts.find((s) => s.id === "BM-RETURN-BB").bodies.main.net, "PACK+"); assert.ok(Object.values(p.parts.find((s) => s.id === "BM-BRIDGE").bodies).every((x) => x.net === "PACK+"));
  assert.equal(p.parts.find((s) => s.id === "BM-TERM-POS").bodies.plaque.net, "PACK+"); assert.equal(p.parts.find((s) => s.id === "BM-TERM-POS").bodies.goujons, undefined, "no studs : the + terminal is contacted by pressure");
  assert.ok(p.physics.some((x) => x.id === "phy-bm-return"), "the calculation of the bar is kept");
});
