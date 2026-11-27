/* BM 8s8p — CONCEPT 5 « U handle and asymmetric cams », on its branch from the tip of concept 4 (JP, 27 novembre 2026 : the concept sheet
   CB-6.29 of DynamiteAgile, « Cames asymétriques sous poignée en U : pousser puis barrer le BM » ; by menu : « Concept 5, depuis concept 4 » ;
   « just modify what you need to and try keeping as much as possible of the rest untouched »).
     node --test tests/node/bm_concept5.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, C4_BRANCH, C5_BRANCH } from "../../web/js/demo/demo_bm.js";
import { C5, camOutline, camTravel, travelOf, contactBand, moduleSizes, layout5 } from "../../web/js/demo/demo_bm_c5.js";
import { branchNames, rebuild, tipOf } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { solveLevels } from "../../web/js/core/assembly_logic.js";
import { matMul, matFromPlacement, matRotAxis, matTranslate } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const strip = (x) => JSON.stringify(x);

test("concept 5 is a branch from the tip of concept 4 ; what concept 4 had is kept, only the swap handle is added", () => {
  const p = bmProject({ branch: "c5" }), h = p.history, names = branchNames(h), pt = h.points.find((x) => x.id === h.head);
  assert.equal(names.get(pt.id), C5_BRANCH); assert.equal(names.get(pt.parent), C4_BRANCH); assert.equal(pt.parent, tipOf(h, C4_BRANCH).id);
  const c4 = rebuild(h, tipOf(h, C4_BRANCH).id), ids4 = c4.parts.map((x) => x.id);
  for (const q of c4.parts) if (q.id !== "BM-LID-RING-TOP") assert.equal(strip(p.parts.find((x) => x.id === q.id)), strip(q), `${q.id} untouched`);
  const ring4 = c4.parts.find((x) => x.id === "BM-LID-RING-TOP"), ring5 = p.parts.find((x) => x.id === "BM-LID-RING-TOP");
  for (const f of ring4.features.filter((f) => f.op !== "interfaces")) assert.equal(strip(ring5.features.find((g) => g.id === f.id)), strip(f), `the ring keeps ${f.id}`);
  assert.deepEqual(ring5.features.filter((f) => !ring4.features.some((g) => g.id === f.id)).map((f) => f.id).filter((id) => !/^oreille_[gd]/.test(id)), [], "only the ears are added to the ring");
  assert.deepEqual(p.parts.map((x) => x.id).filter((id) => !ids4.includes(id)).sort(), ["BM5-BUMPER", "BM5-CAM", "BM5-HANDLE", "BM5-PAWL", "BM5-PIN", "BM5-RECEPT", "BM5-ROD", "BM5-STOP", "BM5-SWAP-PLATE", "BM5-TRIGGER"]);
  for (const a of c4.assemblies) { const b = p.assemblies.find((x) => x.id === a.id); if (a.id !== "BM-8S8P-ASM") assert.equal(strip(b), strip(a), `${a.id} untouched`); else assert.equal(strip(b.instances.slice(0, a.instances.length)), strip(a.instances), "the module keeps its instances"); }
  assert.ok(p.description.startsWith(c4.description), "the description of concept 4 is kept, concept 5 is added after it");
  for (const c of c4.physics) assert.equal(strip(p.physics.find((x) => x.id === c.id)), strip(c), `${c.id} kept`);
  const P1 = rebuild(h, "P1"); assert.ok(!P1.parts.some((x) => /^BM5-/.test(x.id)), "MAIN knows nothing of concept 5");
});

test("the sheet CB-6.29 : 8 mm of stroke, the flat bars the module, the grip under the top, room for the gloved hand", () => {
  const pts = camOutline(), T = camTravel(pts), c = C5.cam;
  near(travelOf(pts, -90), c.r0, "lying open, the cam shows r0 to the stop"); near(travelOf(pts, 0), c.r0 + c.stroke, "closed, the flat at r0 + stroke");
  assert.equal(T.stroke, c.stroke); assert.ok(T.stroke >= 5 && T.stroke <= 10, "course 5–10 mm");
  assert.ok(T.over > 0.2 && T.over < C5.loads.wipe, `the corner of the flat passes the stop, then the flat gives back ${T.over} mm`); assert.ok(T.holdsClosed, "past closed, the cam pushes again : a detent");
  for (let i = 1; i < T.rows.length; i++) if (T.rows[i].th <= T.peakAt) assert.ok(T.rows[i].d >= T.rows[i - 1].d - 1e-9, `the module only goes toward the connector until the peak (${T.rows[i].th}°)`);
  const ramp = T.rows.filter((r) => r.th > -88 && r.th <= -32).map((r) => r.k); assert.ok(Math.max(...ramp) - Math.min(...ramp) < 0.3, "a constant slope on the ramp : the same effort all along");
  const p = bmProject({ branch: "c5" }), m = moduleSizes(p), L = layout5(m);
  assert.ok(m.top - (L.zP + L.zG + C5.grip.d / 2) >= C5.grip.under - 1e-9, "the grip 10 mm under the top at least"); assert.ok(L.span >= C5.hand.w, "120 mm between the arms"); assert.ok(L.hand >= C5.hand.d - 1e-9, "45 mm behind the grip");
  const calc = p.physics.find((x) => x.id === "phy-bm5-cam"); assert.equal(calc.model, "lever_cam"); assert.equal(calc.verdict, "ok"); assert.ok(calc.values.F_hand <= C5.loads.Fhand);
  near(calc.values.e, T.over, "the calculation and the drawing agree on the over-travel", 0.01);
});

test("concept 5 builds ; the module barred on its swap surface : nothing goes through anything ; the cams clear the surface all along the swing", async () => {
  const K = await kernel(), p = bmProject({ branch: "c5" }), built = {}, find = (id) => p.assemblies.find((a) => a.id === id);
  for (const s of p.parts) { const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error").map((l) => l.text), [], s.id); built[s.id] = b; }
  const { asm, sol } = solveLevels(find("BM5-SWAP-ASM"), built, find), keep = (id) => !/~core[2-7]~/.test(id);
  const inst = asm.instances.filter((i) => keep(i.id)).map((i) => ({ id: i.id, bodies: built[i.part].bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, sol.placements[i.id]) })) }));
  const bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  const boxes = inst.map((i) => i.bodies.map((b) => bb(b.shape)));
  for (let i = 0; i < inst.length; i++) for (let j = i + 1; j < inst.length; j++) inst[i].bodies.forEach((a, x) => inst[j].bodies.forEach((b, y) => {
    if (!ov(boxes[i][x], boxes[j][y])) return; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${inst[i].id}/${a.name} × ${inst[j].id}/${b.name} : ${v.toFixed(3)}`); }));
  assert.deepEqual(out, []);
  /* the handle turned : the cam stays in front of its stop, above the surface ; the arm and the grip pass beside the stop */
  const m = moduleSizes(p), L = layout5(m), band = contactBand();
  const at = (id) => inst.find((x) => x.id === id), stop = bb(at("butee_g").bodies[0].shape);
  near(stop[1], L.yS, "the stop face, the flat of the cam on it"); assert.ok(stop[5] >= L.zP + band.z1 + 1, "the stop covers where the cam touches it");
  const camG = built["BM5-CAM"].bodies[0].shape, handle = built["BM5-HANDLE"].bodies[0].shape, stopG = at("butee_g").bodies[0].shape;
  for (const th of [-90, -60, -30, -12, 0]) {
    const back = C5.cam.stroke - (travelOf(camOutline(), th) - C5.cam.r0);      // the module, still that far from home
    const pose = (x) => matMul(matTranslate([0, L.yP + back, L.zP]), matMul(matRotAxis([1, 0, 0], th), matTranslate([x, 0, 0])));
    const cam = K.transform(camG, pose(L.cam[0])), cb = bb(cam);
    assert.ok(cb[2] >= m.bottom + 2, `${th}° : the cam clears the surface (${cb[2].toFixed(2)})`); assert.ok(cb[4] <= stop[1] + 1e-3, `${th}° : the cam stays in front of its stop (${cb[4].toFixed(3)})`);
    assert.ok(K.props(K.common(K.transform(handle, pose(0)), stopG)).volume < 1e-3, `${th}° : the handle passes beside the stop`);
  }
  K.flush && K.flush();
});
