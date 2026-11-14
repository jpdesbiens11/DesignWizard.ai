// Geometric engine of the isolation analysis: clearance (taut string) and creepage (the ant) on triangle meshes.
//   node --test tests/node/cc_paths.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoHvbScene } from "./demo_scene.mjs";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { sceneBody } from "../../web/js/analysis/cc_scene.js";
import { prepareScene, netsOf, measurePair, measureAll } from "../../web/js/analysis/cc_paths.js";
import { weldMesh, BVH, meshDistance, segmentBlocked } from "../../web/js/analysis/cc_geom.js";

/** Axis-aligned box mesh like an OpenCascade tessellation: vertices duplicated per face, every face split n × n. */
function boxMesh(x0, y0, z0, x1, y1, z1, n = 1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, pos = [], idx = [];
  const faces = [   // origin, u, v with u × v = outward normal
    [[x0, y0, z1], [dx, 0, 0], [0, dy, 0]], [[x0, y0, z0], [0, dy, 0], [dx, 0, 0]], [[x1, y0, z0], [0, dy, 0], [0, 0, dz]],
    [[x0, y0, z0], [0, 0, dz], [0, dy, 0]], [[x0, y1, z0], [0, 0, dz], [dx, 0, 0]], [[x0, y0, z0], [dx, 0, 0], [0, 0, dz]],
  ];
  for (const [o, u, v] of faces) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) for (let k = 0; k < 3; k++) pos.push(o[k] + (u[k] * i) / n + (v[k] * j) / n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = base + j * (n + 1) + i, b = a + 1, c = a + n + 2, d = a + n + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const body = (id, kind, box, extra = {}) => ({ id, name: id, kind, net: null, group: kind === "insulator" ? "II" : null, printed: false, ...boxMesh(...box, extra.n || 2), ...extra });
const conductor = (id, net, box, extra) => body(id, "conductor", box, { net, ...extra });
const near = (got, want, what) => {
  assert.ok(got !== null && got !== undefined, `${what}: no value (expected ${want})`);
  const tol = Math.max(0.15, 0.015 * want);
  assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(4)} instead of ${want}`);
  assert.ok(got >= want * 0.995 - 1e-6, `${what}: ${got.toFixed(4)} is shorter than the true value ${want}`);
};
const pathLength = (path) => path.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]), 0);

// ---------------------------------------------------------------- mesh utilities
test("cc_geom: weld, tree queries, mesh distance", () => {
  const m = boxMesh(0, 0, 0, 10, 10, 2, 3), w = weldMesh(m.pos, m.idx);
  assert.equal(m.pos.length / 3, 6 * 16);
  assert.equal(w.V.length / 3, 4 ** 3 - 2 ** 3, "welded vertices of a 3 × 3 split box: the surface of a 4 × 4 × 4 grid");
  const t = new BVH(w.V, w.I);
  assert.ok(t.pointInSolid([5, 5, 1]) && !t.pointInSolid([5, 5, 3]) && !t.pointInSolid([-1, 5, 1]));
  const q = t.closestPoint([5, 5, 6]);
  assert.ok(Math.abs(q.d - 4) < 1e-9 && Math.abs(q.point[2] - 2) < 1e-9);
  assert.equal(t.closestPoint([5, 5, 6], 3), null);
  assert.equal(t.segmentHits([5, 5, 5], [5, 5, -5]), true);
  assert.equal(t.segmentHits([5, 5, 5], [5, 5, 2], { ignoreEndsEps: 1e-6 }), false);
  assert.equal(t.segmentHits([1, 5, 2], [9, 5, 2]), false, "a segment lying in a face is not a hit");
  assert.equal(segmentBlocked(t, [{ bvh: t }], [-1, 5, 2], [11, 5, 2]), false, "grazing along a face, over its edges");
  const f = t.segmentHits([5, 5, 5], [5, 5, -5], { first: true });
  assert.ok(Math.abs(f.point[2] - 2) < 1e-9);
  const m2 = boxMesh(13, 14, 0, 20, 20, 2), w2 = weldMesh(m2.pos, m2.idx), t2 = new BVH(w2.V, w2.I), d = meshDistance(t, t2);
  assert.ok(Math.abs(d.d - 5) < 1e-9, "corner to corner: 3-4-5");
  assert.equal(meshDistance(t, t2, 4), null);
  assert.equal(segmentBlocked(t, [{ bvh: t }], [5, 5, 2], [5, 5, 0]), true);
  assert.equal(segmentBlocked(t, [{ bvh: t }], [0, 0, 2], [10, 10, 2]), false);
});

// ---------------------------------------------------------------- DEMO-HVB (distances known by construction)
const demo = await demoHvbScene();
const scene = prepareScene(demo.bodies);

test("DEMO-HVB: nets", () => {
  assert.deepEqual(netsOf(scene).sort(), ["Chassis", "HV+", "HV-", "LV sense"]);
});

test("DEMO-HVB: clearance and creepage of the 6 pairs (pollution degree 2, X = 1 mm)", () => {
  const t0 = Date.now(), res = measureAll(scene, null, { x: 1.0 }), rows = [];
  assert.equal(res.length, 6);
  for (const r of res) {
    const e = demo.expected[`${r.a}|${r.b}`] || demo.expected[`${r.b}|${r.a}`];
    rows.push(`${`${r.a} | ${r.b}`.padEnd(20)} clearance ${r.clearance.d.toFixed(3).padStart(7)} (${e.clearance})  creepage ${r.creepage.d.toFixed(3).padStart(7)} (${e.creepage})  ${r.ms.toFixed(0)} ms`);
    near(r.clearance.d, e.clearance, `clearance ${r.a}|${r.b}`);
    near(r.creepage.d, e.creepage, `creepage ${r.a}|${r.b}`);
    near(pathLength(r.clearance.path), r.clearance.d, `clearance path ${r.a}|${r.b}`);
    near(pathLength(r.creepage.path), r.creepage.d, `creepage path ${r.a}|${r.b}`);
    assert.ok(r.creepage.d >= r.clearance.d - 0.05, "creepage is never shorter than clearance");
    assert.equal(r.creepage.group, "II");                                   // every path stays on the PA66 base
    assert.deepEqual(r.creepage.bodies, ["HVB-BASE/main"]);
    assert.equal(r.creepage.printed, false);
    assert.ok(!r.clearance.capped && !r.creepage.capped && !r.creepage.none);
  }
  console.log(rows.join("\n") + `\n6 pairs in ${Date.now() - t0} ms`);
  const by = (a, b) => res.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  assert.equal(by("HV-", "LV sense").clearance.direct, true);
  assert.equal(by("HV-", "LV sense").creepage.bridges, 1, "the 0.8 mm slot is bridged");
  assert.equal(by("HV+", "HV-").clearance.direct, false);
  assert.equal(by("HV+", "HV-").creepage.bridges, 0);
  assert.ok(Date.now() - t0 < 10000);
});

test("DEMO-HVB: exact values of the taut string and of the ant", () => {
  const a = measurePair(scene, "HV+", "HV-"), b = measurePair(scene, "HV+", "LV sense");
  assert.ok(Math.abs(a.clearance.d - (2 * Math.sqrt(53) + 2)) < 0.02, `over the rib: ${a.clearance.d}`);
  assert.ok(Math.abs(a.creepage.d - 26) < 0.02, `2 + 10 + 2 + 10 + 2: ${a.creepage.d}`);
  const over = Math.hypot(Math.sqrt(53) + 2 + Math.hypot(26, 8), 8);       // unfolded around the two top edges of the rib
  assert.ok(Math.abs(b.clearance.d - over) < 0.02, `over the rib, 8 mm sideways: ${b.clearance.d} / ${over}`);
  assert.ok(Math.abs(b.creepage.d - (Math.hypot(2, 16) + 2 + Math.hypot(26, 4))) < 0.02, `around the end of the rib: ${b.creepage.d}`);
});

test("DEMO-HVB: in pollution degree 1 (X = 0.25 mm) the slot is followed", () => {
  const r = measurePair(scene, "HV-", "LV sense", { x: 0.25 });
  near(r.creepage.d, 12, "creepage PD1");
  assert.equal(r.creepage.bridges, 0);
  near(r.clearance.d, 8, "clearance PD1");
  const r3 = measurePair(scene, "LV sense", "HV-", { x: 1.5 });
  near(r3.creepage.d, 8, "creepage PD3");
});

test("DEMO-HVB: caps", () => {
  const r = measurePair(scene, "HV+", "HV-", { maxClearance: 10, maxCreepage: 20 });
  assert.deepEqual([r.clearance.d, r.clearance.capped, r.creepage.d, r.creepage.capped, r.creepage.none], [null, true, null, true, false]);
});

// ---------------------------------------------------------------- synthetic scenes
test("two plates facing each other: clearance = gap, direct; no creepage", () => {
  const s = prepareScene([conductor("a", "A", [0, 0, 0, 10, 10, 1]), conductor("b", "B", [2, 3, 4, 12, 13, 5])]);
  const r = measurePair(s, "A", "B");
  assert.ok(Math.abs(r.clearance.d - 3) < 1e-6 && r.clearance.direct && r.clearance.path.length === 2);
  assert.deepEqual([r.creepage.d, r.creepage.none, r.creepage.capped], [null, true, false]);
  const c = measurePair(s, "A", "B", { maxClearance: 2 });
  assert.deepEqual([c.clearance.d, c.clearance.capped], [null, true]);
  assert.equal(measurePair(s, "A", "nope").clearance.d, null);
});

test("a barrier forces the string over it; the joint under the barrier is a creepage path", () => {
  const s = prepareScene([
    body("base", "insulator", [-2, -7, -1, 12, 17, 0], { group: "I" }), body("wall", "insulator", [4.5, -5, 0, 5.5, 15, 6], { group: "IIIa" }),
    conductor("a", "A", [0, 0, 0, 2, 10, 2]), conductor("b", "B", [8, 0, 0, 10, 10, 2]),
  ]);
  const r = measurePair(s, "A", "B");
  near(r.clearance.d, 2 * Math.hypot(2.5, 4) + 1, "over the wall");           // around its ends: 2 × 5.59 + 1 = 12.18
  assert.equal(r.clearance.direct, false);
  assert.ok(r.clearance.path.some((p) => p[2] > 5.9), "the path goes over the top of the wall");
  near(r.creepage.d, 6, "through the uncemented joint between the base and the wall");
  const j = measurePair(s, "A", "B", { jointClearance: true });                // IEC examples 9-10: the joint is a clearance path too
  assert.deepEqual([j.clearance.joint, j.clearance.d], [true, j.creepage.d]);
  assert.equal(r.clearance.joint, undefined);
});

test("a conductor of another net is an obstacle, a floating part is crossed for free (d1 + d2)", () => {
  const mk = (kind, net) => prepareScene([
    body("plate", "insulator", [0, 0, -1, 40, 10, 0]), conductor("a", "A", [2, 2, 0, 6, 8, 2]), conductor("b", "B", [24, 2, 0, 28, 8, 2]),
    body("mid", kind, [10, 0, 0, 20, 10, 2], { net }),
  ]);
  const f = measurePair(mk("floating", null), "A", "B");
  near(f.clearance.d, 8, "clearance through the floating block");
  assert.deepEqual(f.clearance.via, ["mid"]);
  near(f.creepage.d, 8, "creepage through the floating block");
  const o = measurePair(mk("conductor", "C"), "A", "B");
  near(o.clearance.d, 18, "clearance over the block of net C");               // straight line grazing its top face
  assert.deepEqual(o.clearance.via, []);
  near(o.creepage.d, 2 * Math.hypot(4, 2) + 10, "creepage around the footprint, along the side of the plate");
  assert.ok(o.creepage.path.some((p) => p[2] < -0.01), "the path leaves the top face");
  const m = measurePair(mk("conductor", "C"), "A", "C");
  near(m.clearance.d, 4, "A to C"); near(m.creepage.d, 4, "A to C");
});

test("two insulators in contact carry the path from one to the other; worst material group; printed", () => {
  const mk = (g1, g2, p1 = false, p2 = false, gap = 0) => prepareScene([
    body("p1", "insulator", [0, 0, -1, 20, 10, 0], { group: g1, printed: p1 }), body("p2", "insulator", [20 + gap, 0, -1, 40 + gap, 10, 0], { group: g2, printed: p2 }),
    conductor("a", "A", [2, 2, 0, 6, 8, 1]), conductor("b", "B", [34 + gap, 2, 0, 38 + gap, 8, 1]),
  ]);
  const r = measurePair(mk("I", "IIIa", true, true), "A", "B");
  near(r.creepage.d, 28, "across the joint");
  assert.equal(r.creepage.group, "IIIa");
  assert.deepEqual(r.creepage.bodies, ["p1", "p2"]);
  assert.equal(r.creepage.printed, true);
  assert.equal(r.creepage.bridges, 0);
  near(r.clearance.d, 28, "clearance"); assert.equal(r.clearance.direct, true);
  const r2 = measurePair(mk("IIIb", "II", true, false), "B", "A");
  assert.equal(r2.creepage.group, "IIIb");
  assert.deepEqual(r2.creepage.bodies, ["p2", "p1"]);
  assert.equal(r2.creepage.printed, false);
  const g = measurePair(mk("I", "II", false, false, 0.6), "A", "B");          // 0.6 mm gap: narrower than X, bridged
  near(g.creepage.d, 28.6, "bridged gap"); assert.equal(g.creepage.bridges, 1);
  const n = measurePair(mk("I", "II", false, false, 3), "A", "B");            // 3 mm gap: no surface connects the nets
  assert.deepEqual([n.creepage.d, n.creepage.none, n.creepage.capped], [null, true, false]);
  near(n.clearance.d, 31, "clearance across the gap");
  const c = measurePair(mk("I", "II"), "A", "B", { maxCreepage: 10 });
  assert.deepEqual([c.creepage.d, c.creepage.capped, c.creepage.none], [null, true, false]);
});

test("an insulating sheet between two plates: the string and the ant go around its edge", () => {
  const s = prepareScene([conductor("a", "A", [0, 0, 0, 20, 20, 1]), body("sheet", "insulator", [-5, -5, 1, 25, 25, 1.5]), conductor("b", "B", [0, 0, 1.5, 20, 20, 2.5])]);
  const r = measurePair(s, "A", "B");
  near(r.clearance.d, 10.5, "clearance around the sheet"); assert.equal(r.clearance.direct, false);
  near(r.creepage.d, 10.5, "creepage around the sheet"); assert.deepEqual(r.creepage.bodies, ["sheet"]);
});

test("thin printed tracks and small pads are not missed", () => {
  const mk = (w, gap, len) => prepareScene([
    body("pcb", "insulator", [0, 0, -1.6, 50, 30, 0], { group: "IIIa", printed: true, n: 1 }),
    conductor("t1", "A", [10.13, 10.07, 0, 10.13 + len, 10.07 + w, 0.035], { n: 1 }), conductor("t2", "B", [10.13, 10.07 + w + gap, 0, 10.13 + len, 10.07 + 2 * w + gap, 0.035], { n: 1 }),
    conductor("pad", "C", [40.21, 3.33, 0, 40.21 + w, 3.33 + w, 0.035], { n: 1 }),
  ]);
  for (const [w, gap, len] of [[0.15, 0.2, 20], [0.1, 1.27, 0.4]]) {
    const s = mk(w, gap, len), r = measurePair(s, "A", "B"), q = measurePair(s, "A", "C"), far = Math.hypot(40.21 - 10.13 - len, 10.07 - 3.33 - w);
    assert.ok(Math.abs(r.clearance.d - gap) < 0.01 && Math.abs(r.creepage.d - gap) < 0.01, `tracks ${w} mm, gap ${gap}: ${r.clearance.d} / ${r.creepage.d}`);
    assert.ok(Math.abs(q.clearance.d - far) < 0.02 && Math.abs(q.creepage.d - far) < 0.05, `track to pad ${far}: ${q.clearance.d} / ${q.creepage.d}`);
    assert.deepEqual([r.creepage.printed, r.creepage.group, r.clearance.direct], [true, "IIIa", true]);
  }
});

test("tessellated cylinder (OpenCascade): the string wraps around the post, the ant follows its surface", async () => {
  const K = await kernel(), box = (x0, y0, z0, x1, y1, z1) => ({ op: "box", at: [x0, y0, z0], size: [x1 - x0, y1 - y0, z1 - z0] });
  const mk = (id, material, elec, features) => {
    const built = buildPart(K, { dw: "part/1", id, name: id, family: "prismatic", process: "cnc_milling", material, elec, features });
    assert.ok(!built.log.some((l) => l.level === "error"), JSON.stringify(built.log));
    return built.bodies.map((b) => { const m = K.tessellate(b.shape); return sceneBody(id, id, b, { pos: m.pos, idx: m.idx }, null); });
  };
  const s = prepareScene([
    ...mk("post", "PA66-GF30", { kind: "insulator" }, [{ op: "cylinder", at: [0, 0, -20], axis: "z", d: 10, h: 40 }]),
    ...mk("a", "CU-C110", { kind: "conductor", net: "A" }, [box(-12, -1, -1, -10, 1, 1)]), ...mk("b", "CU-C110", { kind: "conductor", net: "B" }, [box(10, -1, -1, 12, 1, 1)]),
    ...mk("c", "CU-C110", { kind: "conductor", net: "C" }, [box(-8, -0.5, 5, -4.9, 0.5, 6)]), ...mk("d", "CU-C110", { kind: "conductor", net: "D" }, [box(4.9, -0.5, 5, 8, 0.5, 6)]),
  ]);
  K.flush();
  const D = Math.hypot(10, 1), wrap = 2 * Math.sqrt(D * D - 25) + 5 * (Math.PI - 2 * Math.acos(5 / D) - 2 * Math.atan(0.1));   // two tangents and an arc
  const r = measurePair(s, "A", "B");
  near(r.clearance.d, wrap, "string around the post"); assert.equal(r.clearance.direct, false);
  assert.equal(r.creepage.none, true);
  const q = measurePair(s, "C", "D");
  near(q.creepage.d, 5 * (Math.PI - 2 * Math.asin(0.1)), "ant around the post");
  assert.ok(q.clearance.d > 9.8 && q.clearance.d <= q.creepage.d + 0.6, `clearance ${q.clearance.d}`);
});

test("measureAll: pairs, progress, determinism", () => {
  const s = prepareScene([body("plate", "insulator", [0, 0, -1, 30, 10, 0]), conductor("a", "A", [2, 2, 0, 6, 8, 1]), conductor("b", "B", [12, 2, 0, 16, 8, 1]), conductor("c", "C", [22, 2, 0, 26, 8, 1]),
    { id: "x", kind: "ignore", pos: new Float32Array(9), idx: new Uint32Array([0, 1, 2]) }]);
  const seen = [], all = measureAll(s, null, {}, (i, n, r) => seen.push(`${i}/${n} ${r.a}|${r.b}`));
  assert.deepEqual(seen, ["1/3 A|B", "2/3 A|C", "3/3 B|C"]);
  near(all[0].creepage.d, 6, "A|B"); near(all[2].creepage.d, 6, "B|C");
  near(all[1].clearance.d, 16, "A|C");                                         // the string grazes the top of b
  near(all[1].creepage.d, 16, "A|C creepage");                                 // b is as wide as a and c: the ant hugs its footprint
  assert.ok(all[1].creepage.path.some((p) => p[1] > 8 || p[1] < 2), "the ant goes around the footprint of b");
  const again = measureAll(s, [["A", "B"]], {});
  assert.equal(again[0].creepage.d, all[0].creepage.d);
  assert.deepEqual(again[0].clearance.path, all[0].clearance.path);
});

test("copper on both faces of a board: the board is solid insulation, the string goes around its edge", () => {
  // 70 µm pads overlapping in plan on the two faces of a 1.6 mm board: the closest points are 1.6 mm apart THROUGH the
  // board, which is not a clearance. Regression: tightening used to take that raw closest point for the first leg.
  const scene = prepareScene([
    body("board", "insulator", [0, 0, 0, 40, 40, 1.6], { printed: true, group: "IIIa" }),
    conductor("top", "A", [5, 15, 1.6, 15, 25, 1.67]), conductor("bottom", "B", [10, 15, -0.07, 25, 25, 0]),
  ]);
  for (const o of [{}, { maxClearance: 40, maxCreepage: 60 }]) {
    const r = measurePair(scene, "A", "B", o);
    assert.equal(r.clearance.direct, false);
    near(r.clearance.d, 16.6, "clearance around the board edge");          // 5 to the edge + 1.6 down + 10 back under
    near(r.creepage.d, 16.6, "creepage around the board edge");
    assert.equal(r.creepage.printed, true);
  }
});
