/* BM 8s8p — CONCEPT 5 « U handle and asymmetric cams », on its branch from the tip of concept 4 (JP, 27 novembre 2026 : the concept sheet
   CB-6.29 of DynamiteAgile, « Cames asymétriques sous poignée en U : pousser puis barrer le BM » ; by menu : « Concept 5, depuis concept 4 » ;
   « just modify what you need to and try keeping as much as possible of the rest untouched »).
     node --test tests/node/bm_concept5.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, C4_BRANCH, C5_BRANCH } from "../../web/js/demo/demo_bm.js";
import { C5, camOutline, camTravel, travelOf, contactBand, moduleSizes, layout5 } from "../../web/js/demo/demo_bm_c5.js";
import { HI, layoutHi, windowOf } from "../../web/js/demo/demo_bm_c5_hi.js";
import { branchNames, rebuild, tipOf } from "../../web/js/core/history.js";
import { buildPart } from "../../web/js/cad/build.js";
import { solveLevels } from "../../web/js/core/assembly_logic.js";
import { matMul, matFromPlacement, matRotAxis, matTranslate } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const r3 = (v) => Math.round(v * 1000) / 1000;
const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const strip = (x) => JSON.stringify(x);

test("concept 5 is a branch from the tip of concept 4 ; what concept 4 had is kept, only the swap handle is added", () => {
  const p = bmProject({ branch: "c5" }), h = p.history, names = branchNames(h), pt = h.points.find((x) => x.id === h.head), first = h.points.find((x) => x.id === pt.parent);
  assert.equal(names.get(pt.id), C5_BRANCH); assert.equal(names.get(first.id), C5_BRANCH, "iteration 2 follows the first jet on the branch");
  assert.equal(names.get(first.parent), C4_BRANCH); assert.equal(first.parent, tipOf(h, C4_BRANCH).id);
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

test("iteration 2 (pivot high) keeps the first jet in the history, and changes only what the pivot asks for", () => {
  const p = bmProject({ branch: "c5" }), h = p.history, pt = h.points.find((x) => x.id === h.head), first = rebuild(h, pt.parent), part = (d, id) => d.parts.find((x) => x.id === id);
  assert.equal(part(first, "BM5-HANDLE").features.find((f) => f.id === "bras_g").op, "box", "the first jet : vertical arms, kept");
  assert.equal(part(p, "BM5-HANDLE").features.find((f) => f.id === "bras_g").op, "extrude", "iteration 2 : the arms lean to the grip");
  const changed = p.parts.filter((q) => strip(q) !== strip(part(first, q.id))).map((q) => q.id).sort();
  assert.deepEqual(changed, ["BM-LID-RING-TOP", "BM5-HANDLE", "BM5-ROD", "BM5-STOP", "BM5-SWAP-PLATE", "BM5-TRIGGER"]);
  assert.deepEqual(p.parts.map((q) => q.id), first.parts.map((q) => q.id), "no part added, none taken out");
  const ring = part(p, "BM-LID-RING-TOP"), ring1 = part(first, "BM-LID-RING-TOP");
  for (const f of ring1.features.filter((q) => !/^oreille_/.test(q.id))) assert.equal(strip(ring.features.find((g) => g.id === f.id)), strip(f), `the ring keeps ${f.id}`);
  const grip = (d) => d.parts.find((x) => x.id === "BM5-HANDLE").features.find((f) => f.id === "grip"), place = (d) => d.assemblies.find((a) => a.id === "BM-8S8P-ASM").instances.find((i) => i.id === "poignee").placement.t;
  const abs = (d) => [grip(d).at[1] + place(d)[1], grip(d).at[2] + place(d)[2]];
  near(abs(p)[0], abs(first)[0], "the grip stays where it was (Y)"); near(abs(p)[1], abs(first)[1], "the grip stays where it was (Z)");
  for (const id of ["BM5-HANDLE-ASM", "BM5-SWAP-ASM"]) { const a = p.assemblies.find((x) => x.id === id), b = first.assemblies.find((x) => x.id === id);
    assert.deepEqual(a.instances.map((i) => i.id), b.instances.map((i) => i.id), `${id} : the same instances`); }
  assert.ok(p.description.startsWith(first.description), "the description of the first jet is kept, iteration 2 added after it");
  const m = moduleSizes(p), L = layoutHi(m), L1 = layout5(m);
  assert.ok(L1.yS + C5.stop.l - Math.max(L.yS + C5.stop.l, L1.yP + C5.grip.d / 2) > 40, "about 42 mm shorter behind the lid");
  assert.ok(Math.abs(L.lever - L1.lever) < 1, `about the lever of the first jet (${L.lever} for ${L1.lever} mm) : the same effort at the hand`); const W = windowOf(L, m);
  assert.ok(W && W.x0 >= L.arm[0] - 1e-9 && W.x1 <= L.mir(L.arm[0]) + 1e-9, "the window of the plate stays between the arms, short of the stops");
});

test("the sheet CB-6.29 : 8 mm of stroke, the flat bars the module, the grip under the top, room for the gloved hand", () => {
  const pts = camOutline(), T = camTravel(pts), c = C5.cam;
  near(travelOf(pts, -90), c.r0, "lying open, the cam shows r0 to the stop"); near(travelOf(pts, 0), c.r0 + c.stroke, "closed, the flat at r0 + stroke");
  assert.equal(T.stroke, c.stroke); assert.ok(T.stroke >= 5 && T.stroke <= 10, "course 5–10 mm");
  assert.ok(T.over > 0.2 && T.over < C5.loads.wipe, `the corner of the flat passes the stop, then the flat gives back ${T.over} mm`); assert.ok(T.holdsClosed, "past closed, the cam pushes again : a detent");
  for (let i = 1; i < T.rows.length; i++) if (T.rows[i].th <= T.peakAt) assert.ok(T.rows[i].d >= T.rows[i - 1].d - 1e-9, `the module only goes toward the connector until the peak (${T.rows[i].th}°)`);
  const ramp = T.rows.filter((r) => r.th > -88 && r.th <= -32).map((r) => r.k); assert.ok(Math.max(...ramp) - Math.min(...ramp) < 0.3, "a constant slope on the ramp : the same effort all along");
  const p = bmProject({ branch: "c5" }), m = moduleSizes(p), L = layoutHi(m);
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
  const m = moduleSizes(p), L = layoutHi(m), band = contactBand();
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
  /* iteration 2 : the whole handle, turned and hanging — the module home (the handle opened), or as far back as the cam lets it (the handle
     raised) — nothing of it goes into the module or the surface. The pawls are drawn engaged in the ears : before the handle turns, the
     trigger pulls them out (or their chamfer lets them ride on the ear), so they are left out of the swing. */
  const hasm = find("BM5-HANDLE-ASM"), hsol = solveLevels(hasm, built, find).sol, fixed = ["surface", "butee_g", "butee_d"].map((id) => at(id).bodies[0].shape);
  const top = inst.filter((i) => /^module~(boitier|couvercle_haut~)/.test(i.id)).flatMap((i) => i.bodies.map((b) => b.shape)), hit = [];
  for (const th of [-90, -60, -30]) for (const back of [0, r3(C5.cam.stroke - (travelOf(camOutline(), th) - C5.cam.r0))]) {
    const T = matMul(matTranslate([0, L.yP + back, L.zP]), matRotAxis([1, 0, 0], th));
    for (const i of hasm.instances.filter((q) => !/^pawl_/.test(q.id))) for (const b of built[i.part].bodies) {
      const s = K.transform(b.shape, matMul(T, hsol.placements[i.id])), sb = bb(s);
      top.forEach((t) => { const u = K.transform(t, matTranslate([0, back, 0])); if (ov(sb, bb(u)) && K.props(K.common(s, u)).volume > 1e-3) hit.push(`${th}°/${back} : ${i.id} × module`); });
      fixed.forEach((t, k) => { if (ov(sb, bb(t)) && K.props(K.common(s, t)).volume > 1e-3) hit.push(`${th}°/${back} : ${i.id} × ${["surface", "butée G", "butée D"][k]}`); });
    }
  }
  assert.deepEqual(hit, [], `the turned handle touches nothing (open : ${HI.under} mm into the window)`);
  K.flush && K.flush();
});
