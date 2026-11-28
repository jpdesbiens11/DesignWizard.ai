/* BM 8s8p — CONCEPT 5 « U handle and asymmetric cams », on its branch from the tip of concept 4 (JP, 27–28 novembre 2026 : the concept sheet
   CB-6.29 of DynamiteAgile, « Cames asymétriques sous poignée en U : pousser puis barrer le BM » ; by menu : « Concept 5, depuis concept 4 » ;
   « just modify what you need to and try keeping as much as possible of the rest untouched »). Three points on the branch : the first jet (P9),
   the pivot high (P10), the thick lid with the pivot in it, the handle closed vertical (P11). Each keeps the one before in the history.
     node --test tests/node/bm_concept5.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, C4_BRANCH, C5_BRANCH } from "../../web/js/demo/demo_bm.js";
import { C5, camOutline, camTravel, travelOf, contactBand, moduleSizes, layout5 } from "../../web/js/demo/demo_bm_c5.js";
import { layoutHi, windowOf } from "../../web/js/demo/demo_bm_c5_hi.js";
import { LID, layoutLid } from "../../web/js/demo/demo_bm_c5_lid.js";
import { branchNames, rebuild, tipOf } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { solveLevels } from "../../web/js/core/assembly_logic.js";
import { matMul, matRotAxis, matTranslate } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const r3 = (v) => Math.round(v * 1000) / 1000;
const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const strip = (x) => JSON.stringify(x);
const points = (p) => { const h = p.history, head = h.points.find((x) => x.id === h.head), up = (pt) => h.points.find((x) => x.id === pt.parent); const p10 = up(head), p9 = up(p10); return { h, head, p10, p9 }; };
const part = (d, id) => d.parts.find((x) => x.id === id);
const changedBetween = (a, b) => a.parts.filter((q) => part(b, q.id) && strip(q) !== strip(part(b, q.id))).map((q) => q.id).sort();

test("concept 5 is a branch from the tip of concept 4, three points long ; the first jet keeps concept 4 and only adds the swap handle", () => {
  const p = bmProject({ branch: "c5" }), { h, head, p10, p9 } = points(p), names = branchNames(h);
  for (const pt of [head, p10, p9]) assert.equal(names.get(pt.id), C5_BRANCH);
  assert.equal(names.get(p9.parent), C4_BRANCH); assert.equal(p9.parent, tipOf(h, C4_BRANCH).id);
  const c4 = rebuild(h, p9.parent), first = rebuild(h, p9.id), ids4 = c4.parts.map((x) => x.id);
  for (const q of c4.parts) if (q.id !== "BM-LID-RING-TOP") assert.equal(strip(part(first, q.id)), strip(q), `${q.id} untouched by the first jet`);
  const ring4 = part(c4, "BM-LID-RING-TOP"), ring5 = part(first, "BM-LID-RING-TOP");
  for (const f of ring4.features.filter((f) => f.op !== "interfaces")) assert.equal(strip(ring5.features.find((g) => g.id === f.id)), strip(f), `the ring keeps ${f.id}`);
  assert.deepEqual(ring5.features.filter((f) => !ring4.features.some((g) => g.id === f.id)).map((f) => f.id).filter((id) => !/^oreille_[gd]/.test(id)), [], "only the ears are added to the ring");
  assert.deepEqual(first.parts.map((x) => x.id).filter((id) => !ids4.includes(id)).sort(), ["BM5-BUMPER", "BM5-CAM", "BM5-HANDLE", "BM5-PAWL", "BM5-PIN", "BM5-RECEPT", "BM5-ROD", "BM5-STOP", "BM5-SWAP-PLATE", "BM5-TRIGGER"]);
  for (const a of c4.assemblies) { const b = first.assemblies.find((x) => x.id === a.id); if (a.id !== "BM-8S8P-ASM") assert.equal(strip(b), strip(a), `${a.id} untouched`); else assert.equal(strip(b.instances.slice(0, a.instances.length)), strip(a.instances), "the module keeps its instances"); }
  for (const d of [first, p]) assert.ok(d.description.startsWith(c4.description), "the description of concept 4 is kept, each iteration added after it");
  for (const c of c4.physics) assert.equal(strip(part({ parts: first.physics }, c.id)), strip(c), `${c.id} kept`);
  const P1 = rebuild(h, "P1"); assert.ok(!P1.parts.some((x) => /^BM5-/.test(x.id)), "MAIN knows nothing of concept 5");
});

test("iteration 2 (pivot high) keeps the first jet in the history, and changes only what the pivot asks for", () => {
  const p = bmProject({ branch: "c5" }), { h, p10, p9 } = points(p), it2 = rebuild(h, p10.id), first = rebuild(h, p9.id);
  assert.equal(part(first, "BM5-HANDLE").features.find((f) => f.id === "bras_g").op, "box", "the first jet : vertical arms, kept");
  assert.equal(part(it2, "BM5-HANDLE").features.find((f) => f.id === "bras_g").op, "extrude", "iteration 2 : the arms lean to the grip");
  assert.deepEqual(changedBetween(it2, first), ["BM-LID-RING-TOP", "BM5-HANDLE", "BM5-ROD", "BM5-STOP", "BM5-SWAP-PLATE", "BM5-TRIGGER"]);
  assert.deepEqual(it2.parts.map((q) => q.id), first.parts.map((q) => q.id), "no part added, none taken out");
  const grip = (d) => part(d, "BM5-HANDLE").features.find((f) => f.id === "grip"), place = (d) => d.assemblies.find((a) => a.id === "BM-8S8P-ASM").instances.find((i) => i.id === "poignee").placement.t;
  near(grip(it2).at[1] + place(it2)[1], grip(first).at[1] + place(first)[1], "the grip stays where it was (Y)"); near(grip(it2).at[2] + place(it2)[2], grip(first).at[2] + place(first)[2], "(Z)");
  const m = moduleSizes(it2), L = layoutHi(m), L1 = layout5(m), W = windowOf(L, m);
  assert.ok(L1.yS + C5.stop.l - Math.max(L.yS + C5.stop.l, L1.yP + C5.grip.d / 2) > 40, "about 42 mm shorter behind the lid");
  assert.ok(W && W.x0 >= L.arm[0] - 1e-9 && W.x1 <= L.mir(L.arm[0]) + 1e-9, "the window of the plate stays between the arms");
});

test("iteration 3 : a 16 mm lid machined from solid carries the pivot ; the handle closed is vertical, its grip 45 mm off the lid ; the rest kept", () => {
  const p = bmProject({ branch: "c5" }), { h, p10 } = points(p), it2 = rebuild(h, p10.id), m = moduleSizes(p), L = layoutLid(m);
  assert.deepEqual(changedBetween(p, it2), ["BM-LID-RING-TOP", "BM5-HANDLE", "BM5-ROD", "BM5-STOP", "BM5-SWAP-PLATE", "BM5-TRIGGER"]);
  assert.deepEqual(it2.parts.map((q) => q.id).filter((id) => !part(p, id)), ["BM-LID-TOP", "BM-LATCH-CAM"], "the PA66 cap and the quarter-turn latch are gone into the one lid");
  assert.ok(!p.parts.some((q) => !part(it2, q.id)), "no part added");
  for (const id of ["BM5-CAM", "BM5-PIN", "BM5-PAWL", "BM5-RECEPT", "BM5-BUMPER"]) assert.equal(strip(part(p, id)), strip(part(it2, id)), `${id} unchanged : the same cam, the same pins`);
  const lid = part(p, "BM-LID-RING-TOP"), plaque = lid.features.find((f) => f.id === "plaque");
  near(plaque.at[1] + plaque.size[1] - m.ringEnd, LID.t, "the lid is 16 mm long"); assert.equal(lid.material, "AL6061-T6");
  assert.ok(lid.features.filter((f) => /^poche_/.test(f.id)).length >= 8, "pocketed like an aero part");
  assert.ok(L.yP > L.lid0 && L.yP < L.lid1, "the pivot inside the 16 mm of the lid");
  const arm = part(p, "BM5-HANDLE").features.find((f) => f.id === "bras_g"); assert.equal(arm.op, "box"); near(arm.size[2], L.zG, "the straight end, vertical, from the pivot");
  assert.ok(L.grip[0] - C5.grip.d / 2 - L.lid1 >= LID.fingers - 1e-9, "45 mm for the gloved fingers between the grip and the lid");
  assert.ok(m.top - (L.grip[1] + C5.grip.d / 2) >= C5.grip.under - 1e-9, "the grip 10 mm under the top"); assert.ok(L.span >= C5.hand.w, "120 mm between the arms");
  const T = camTravel(), calc = p.physics.find((x) => x.id === "phy-bm5-cam");
  near(T.rows.at(-1).d, C5.cam.stroke, "closed — vertical — the cam pushes its whole stroke, its flat on the stop"); assert.ok(T.holdsClosed);
  const left = C5.cam.stroke - (travelOf(camOutline(), -LID.swing) - C5.cam.r0);
  assert.ok(left >= 5 && left <= 10, `opened ${LID.swing}°, the cam still gives ${left.toFixed(2)} mm (5–10)`);
  assert.equal(calc.verdict, "ok"); assert.ok(calc.values.F_hand <= C5.loads.Fhand); near(calc.inputs.lever, L.lever, "the calculation on the lever drawn", 0.01);
  assert.ok(p.description.startsWith(it2.description), "the description of iteration 2 is kept");
});

test("the sheet CB-6.29 : 8 mm of stroke, the flat bars the module", () => {
  const pts = camOutline(), T = camTravel(pts), c = C5.cam;
  near(travelOf(pts, -90), c.r0, "lying open, the cam shows r0 to the stop"); near(travelOf(pts, 0), c.r0 + c.stroke, "closed, the flat at r0 + stroke");
  assert.equal(T.stroke, c.stroke);
  assert.ok(T.over > 0.2 && T.over < C5.loads.wipe, `the corner of the flat passes the stop, then the flat gives back ${T.over} mm`); assert.ok(T.holdsClosed, "past closed, the cam pushes again : a detent");
  for (let i = 1; i < T.rows.length; i++) if (T.rows[i].th <= T.peakAt) assert.ok(T.rows[i].d >= T.rows[i - 1].d - 1e-9, `the module only goes toward the connector until the peak (${T.rows[i].th}°)`);
  const ramp = T.rows.filter((r) => r.th > -88 && r.th <= -32).map((r) => r.k); assert.ok(Math.max(...ramp) - Math.min(...ramp) < 0.3, "a constant slope on the ramp : the same effort all along");
  const calc = bmProject({ branch: "c5" }).physics.find((x) => x.id === "phy-bm5-cam"); assert.equal(calc.model, "lever_cam");
  near(calc.values.e, T.over, "the calculation and the drawing agree on the over-travel", 0.01);
});

test("concept 5 builds ; the module barred on its swap surface : nothing goes through anything ; the handle turned through its swing touches nothing", async () => {
  const K = await kernel(), p = bmProject({ branch: "c5" }), built = {}, find = (id) => p.assemblies.find((a) => a.id === id);
  for (const s of p.parts) { const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error").map((l) => l.text), [], s.id); built[s.id] = b; }
  const { asm, sol } = solveLevels(find("BM5-SWAP-ASM"), built, find), keep = (id) => !/~core[2-7]~/.test(id);
  const inst = asm.instances.filter((i) => keep(i.id)).map((i) => ({ id: i.id, bodies: built[i.part].bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, sol.placements[i.id]) })) }));
  const bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  const boxes = inst.map((i) => i.bodies.map((b) => bb(b.shape)));
  for (let i = 0; i < inst.length; i++) for (let j = i + 1; j < inst.length; j++) inst[i].bodies.forEach((a, x) => inst[j].bodies.forEach((b, y) => {
    if (!ov(boxes[i][x], boxes[j][y])) return; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${inst[i].id}/${a.name} × ${inst[j].id}/${b.name} : ${v.toFixed(3)}`); }));
  assert.deepEqual(out, []);
  /* the cam stays in front of its stop and above the surface, along the swing */
  const m = moduleSizes(p), L = layoutLid(m), band = contactBand(), at = (id) => inst.find((x) => x.id === id), stop = bb(at("butee_g").bodies[0].shape);
  near(stop[1], L.yS, "the stop face, the flat of the cam on it"); assert.ok(stop[5] >= L.zP + band.z1 + 1, "the stop covers where the cam touches it");
  const camG = built["BM5-CAM"].bodies[0].shape, swing = [0, -12, -30, -60, -LID.swing];
  for (const th of swing) {
    const back = C5.cam.stroke - (travelOf(camOutline(), th) - C5.cam.r0);
    const cb = bb(K.transform(camG, matMul(matTranslate([0, L.yP + back, L.zP]), matMul(matRotAxis([1, 0, 0], th), matTranslate([L.cam[0], 0, 0])))));
    assert.ok(cb[2] >= m.bottom + 2, `${th}° : the cam clears the surface (${cb[2].toFixed(2)})`); assert.ok(cb[4] <= stop[1] + 1e-3, `${th}° : the cam stays in front of its stop (${cb[4].toFixed(3)})`);
  }
  /* the whole handle, turned — the module home (the handle opened), or as far back as the cam lets it — goes into nothing. The pawls are drawn
     engaged in the lugs : before the handle turns, the trigger pulls them out, so they are left out of the swing. */
  const hasm = find("BM5-HANDLE-ASM"), hsol = solveLevels(hasm, built, find).sol, fixed = ["surface", "butee_g", "butee_d"].map((id) => at(id).bodies[0].shape);
  const top = inst.filter((i) => /^module~(boitier|couvercle_haut~)/.test(i.id)).flatMap((i) => i.bodies.map((b) => b.shape)), hit = [];
  for (const th of swing.slice(2)) for (const back of [0, r3(C5.cam.stroke - (travelOf(camOutline(), th) - C5.cam.r0))]) {
    const T = matMul(matTranslate([0, L.yP + back, L.zP]), matRotAxis([1, 0, 0], th));
    for (const i of hasm.instances.filter((q) => !/^pawl_/.test(q.id))) for (const b of built[i.part].bodies) {
      const s = K.transform(b.shape, matMul(T, hsol.placements[i.id])), sb = bb(s);
      top.forEach((t) => { const u = K.transform(t, matTranslate([0, back, 0])); if (ov(sb, bb(u)) && K.props(K.common(s, u)).volume > 1e-3) hit.push(`${th}°/${back} : ${i.id} × module`); });
      fixed.forEach((t, k) => { if (ov(sb, bb(t)) && K.props(K.common(s, t)).volume > 1e-3) hit.push(`${th}°/${back} : ${i.id} × ${["surface", "butée G", "butée D"][k]}`); });
    }
  }
  assert.deepEqual(hit, [], `the turned handle touches nothing (up to ${LID.swing}°, ${LID.under} mm into the window)`);
  K.flush && K.flush();
});
