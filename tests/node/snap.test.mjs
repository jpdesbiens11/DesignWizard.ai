/* Assisted positioning : a feature dropped on a face is caught by the symmetry axis, then by the line of another feature, then
   by a 5 mm grid — each direction on its own ; a measured line is caught when it runs nearly along an axis. */
import test from "node:test";
import assert from "node:assert/strict";
import { SNAP_DEFAULT, AXES, snapPoint, snapGuides, snapWords, snapDirection } from "../../web/js/core/snap.js";

const face = { u: [0, 60], v: [0, 24], others: [{ id: "T1", u: 13, v: 7 }] };

test("the symmetry axis catches first, then another feature, then the grid — each direction on its own", () => {
  const s = snapPoint([31.2, 12.9], face);      // near the middle of both directions
  assert.deepEqual([s.u, s.v], [30, 12]); assert.deepEqual([s.snap.u.kind, s.snap.v.kind], ["axis", "axis"]); assert.deepEqual(s.dims, { u0: 30, u1: 30, v0: 12, v1: 12 });
  const a = snapPoint([13.6, 20.4], face);      // in line with T1 along the bar ; on the grid across
  assert.deepEqual([a.u, a.v, a.snap.u.kind, a.snap.u.ref, a.snap.v.kind], [13, 20, "align", "T1", "grid"]);
  const g = snapPoint([42.4, 3.1], face); assert.deepEqual([g.u, g.v, g.snap.u.kind, g.snap.v.kind], [40, 5, "grid", "grid"]);
  assert.deepEqual(snapPoint([42.4, 3.1], face, { free: true }).snap, { u: { kind: null, ref: null }, v: { kind: null, ref: null } }); assert.deepEqual([snapPoint([42.4, 3.1], face, { free: true }).u, snapPoint([42.4, 3.1], face, { free: true }).v], [42.4, 3.1]);
  // the axis of a 24 mm wide face is at 12, off the grid : it still wins near it, and the grid takes over away from it
  assert.equal(snapPoint([20, 11], face).v, 12); assert.equal(snapPoint([20, 9.4], face).v, 10);
  assert.equal(SNAP_DEFAULT.grid, 5);
});

test("each catch switches off ; a feature never leaves the place it may sit in", () => {
  assert.equal(snapPoint([31.2, 12.9], face, { axes: false }).u, 30, "30 is also on the grid"); assert.equal(snapPoint([31.2, 12.9], face, { axes: false }).snap.u.kind, "grid");
  assert.equal(snapPoint([20, 11.4], face, { axes: false }).v, 10); assert.equal(snapPoint([13.6, 3], face, { align: false }).u, 15);
  assert.deepEqual([snapPoint([13.6, 3.3], face, { gridOn: false, align: false }).u, snapPoint([13.6, 3.3], face, { gridOn: false, align: false }).v], [13.6, 3.3]);
  assert.equal(snapPoint([42, 3], face, { grid: 2.5 }).v, 2.5);
  const k = snapPoint([1.2, 23.5], { ...face, keep: { u: [8, 52], v: [4, 20] } }); assert.deepEqual([k.u, k.v, k.snap.u.kind, k.snap.v.kind], [8, 20, "limit", "limit"], "brought back inside, and said so");
  assert.deepEqual(snapPoint([58, 12], { ...face, keep: { u: [8, 52], v: [4, 20] } }).dims, { u0: 52, u1: 8, v0: 12, v1: 12 });
});

test("what is drawn before the drop : the grid, the centre line that caught the feature, the two dimensions to the nearer edges", () => {
  const s = snapPoint([13.6, 12.9], face), G = snapGuides(s, face);
  assert.deepEqual(G.grid.v, [0, 5, 10, 15, 20]); assert.equal(G.grid.u.length, 13); assert.deepEqual(G.grid.u.slice(0, 3), [0, 5, 10]);
  assert.deepEqual(G.lines, [{ kind: "align", along: "v", at: 13, ref: "T1" }, { kind: "axis", along: "u", at: 12, ref: null }]);
  assert.deepEqual(G.dims, [{ along: "u", from: [0, 12], to: [13, 12], value: 13 }, { along: "v", from: [13, 0], to: [13, 12], value: 12 }]);
  const far = snapGuides(snapPoint([52, 21], face), face); assert.deepEqual(far.dims.map((d) => d.value), [10, 4], "measured from the nearer edge"); assert.deepEqual(far.dims[0].from, [60, 20]);
  assert.deepEqual(snapGuides(s, face, { gridOn: false }).grid, { u: [], v: [] });
  assert.deepEqual(snapWords(s, { u: "le long", v: "en travers" }), ["le long : aligné sur T1", "en travers : sur l'axe de symétrie"]); assert.deepEqual(snapWords(snapPoint([42.4, 3.1], face)), []);
});

test("a measured line is caught when it runs nearly along an axis ; farther off, it stays where the mouse is", () => {
  const a = [10, 10, 5], s = snapDirection(a, [50, 12, 5.5]);     // 3° off X
  assert.equal(s.ref, "X"); assert.deepEqual(s.point.map((x) => Math.round(x * 1000) / 1000), [50, 10, 5]); assert.ok(s.angle > 2 && s.angle < 4);
  assert.equal(snapDirection(a, [10.5, 10.4, 40]).ref, "Z"); assert.deepEqual(snapDirection(a, [10.5, 10.4, 40]).point, [10, 10, 40]);
  const off = snapDirection(a, [50, 30, 5]); assert.equal(off.ref, null); assert.deepEqual(off.point, [50, 30, 5]); assert.ok(off.angle > 20);
  assert.equal(snapDirection(a, [50, 12, 5.5], AXES, 1).ref, null, "a tighter catch lets it go"); assert.equal(snapDirection(a, a).ref, null);
  // any set of references : the edges of a face turned 45°
  const refs = [{ name: "arête", dir: [1, 1, 0] }, { name: "travers", dir: [-1, 1, 0] }], t = snapDirection([0, 0, 0], [10, 10.6, 0], refs);
  assert.equal(t.ref, "arête"); assert.ok(Math.abs(t.point[0] - t.point[1]) < 1e-9 && Math.abs(t.point[0] - 10.3) < 1e-9); assert.equal(snapDirection([0, 0, 0], [-10, 10.5, 0], refs).ref, "travers");
});
