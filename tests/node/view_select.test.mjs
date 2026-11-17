/* Pointing at the model : a face, an edge when the cursor is on one, a point at the end of an edge ; what a selection measures. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { entityOf, edgeLine, edgeMid, measureOf } from "../../web/js/core/view_select.js";

const block = (features) => ({ dw: "part/1", id: "T-1", name: "Bloc", material: "AL6061-T6", process: "cnc_milling", params: {}, features: [{ op: "box", id: "b1", size: [40, 20, 10], at: [0, 0, 0] }, ...features], interfaces: [] });

test("what a pick points at : the face, the edge when the point is on it, the corner at its end", async () => {
  const K = await kernel(), built = buildPart(K, block([])), mesh = K.tessellate(built.bodies[0].shape), top = mesh.faces.findIndex((f) => f.type === "plane" && f.n[2] > 0.99);
  const hit = (p) => ({ id: "part/main", local: p, point: p, faceId: top, face: mesh.faces[top], normal: [0, 0, 1] });
  const mid = entityOf(hit([20, 10, 10]), mesh, 0.5); assert.equal(mid.kind, "face"); assert.equal(mid.faceId, top); assert.equal(mid.key, `f:part/main:${top}`);
  const edge = entityOf(hit([20, 0.2, 10]), mesh, 0.5); assert.equal(edge.kind, "edge"); assert.equal(edge.edge.type, "line"); assert.ok(Math.abs(edge.edge.len - 40) < 1e-6); assert.deepEqual(edge.at, [20, 0, 10], "an edge is named by its middle");
  const corner = entityOf(hit([39.8, 0.2, 10]), mesh, 0.5); assert.equal(corner.kind, "vertex"); assert.deepEqual(corner.at, [40, 0, 10]);
  assert.equal(entityOf(hit([20, 0.2, 10]), mesh, 0).kind, "face", "no tolerance : faces only"); assert.equal(entityOf(null, mesh, 1), null);
  const line = edgeLine(mesh, edge.edgeId); assert.equal(line.length, 2); assert.deepEqual(edgeMid(mesh, edge.edgeId), [20, 0, 10]);
  // the edges picked one by one make a fillet : each is found again by its middle
  const two = [edge, entityOf(hit([20, 19.8, 10]), mesh, 0.5)], filleted = buildPart(K, block([{ op: "fillet", id: "r1", r: 2, edges: two.map((x) => ({ near: x.at, tol: 0.3 })) }]));
  assert.equal(filleted.log.filter((l) => l.level === "error").length, 0); const lost = built.volume - filleted.volume, expected = 2 * (4 - Math.PI) * 40; assert.ok(Math.abs(lost - expected) < 0.5, `two 40 mm fillets of radius 2 take ${expected.toFixed(1)} mm³, got ${lost.toFixed(1)}`);
  assert.ok(Math.abs((built.volume - buildPart(K, block([{ op: "fillet", id: "r1", r: 2, edges: { near: edge.at, tol: 0.3 } }])).volume) - expected / 2) < 0.3, "one selection, as before");
});

test("what a selection measures : one entity, two, several", () => {
  const V = (at) => ({ kind: "vertex", at }), F = (at, n, extra = {}) => ({ kind: "face", at, face: { type: "plane", n, area: 800, ...extra } }), E = (len, at = [0, 0, 0]) => ({ kind: "edge", at, edge: { type: "line", len } });
  assert.equal(measureOf([]), ""); assert.equal(measureOf([V([1, 2.5, 3])]), "Point (1 ; 2,5 ; 3)"); assert.equal(measureOf([E(40)]), "Arête droite · 40 mm"); assert.equal(measureOf([F([0, 0, 10], [0, 0, 1])]), "Face plane · 800 mm²");
  assert.equal(measureOf([{ kind: "face", at: [0, 0, 0], face: { type: "cylinder", r: 2.75, inner: true } }]), "Cylindre Ø 5,5 (alésage)"); assert.equal(measureOf([{ kind: "edge", at: [0, 0, 0], edge: { type: "circle", r: 3, len: 18.85 } }]), "Arête circulaire Ø 6 · 18,85 mm");
  assert.equal(measureOf([V([0, 0, 0]), V([3, 4, 0])]), "Distance 5 mm (ΔX 3 · ΔY 4 · ΔZ 0)"); assert.equal(measureOf([F([0, 0, 10], [0, 0, 1]), F([5, 5, 0], [0, 0, -1])]), "10 mm entre faces parallèles");
  assert.equal(measureOf([F([0, 0, 10], [0, 0, 1]), F([20, 0, 5], [1, 0, 0])]), "Angle 90° entre les faces"); assert.equal(measureOf([F([0, 0, 10], [0, 0, 1]), V([3, 3, 4])]), "6 mm du point à la face");
  const C = (o) => ({ kind: "face", at: o, face: { type: "cylinder", r: 2, o, axis: [0, 0, 1] } }); assert.equal(measureOf([C([0, 0, 0]), C([30, 40, 7])]), "Entraxe 50 mm");
  // in the imperial system the same measures read in inches ; what had no unit (a point, a diameter, the three deltas) gets one, an angle stays an angle
  const IMP = { system: "imperial" };
  assert.equal(measureOf([V([25.4, 50.8, 0])], IMP), "Point (1 ; 2 ; 0) in"); assert.equal(measureOf([E(40)], IMP), "Arête droite · 1,575 in"); assert.equal(measureOf([F([0, 0, 10], [0, 0, 1])], IMP), "Face plane · 1,24 in²");
  assert.equal(measureOf([{ kind: "face", at: [0, 0, 0], face: { type: "cylinder", r: 2.75, inner: true } }], IMP), "Cylindre Ø 0,2165 in (alésage)"); assert.equal(measureOf([V([0, 0, 0]), V([3, 4, 0])], IMP), "Distance 0,1969 in (ΔX 0,1181 · ΔY 0,1575 · ΔZ 0 in)");
  assert.equal(measureOf([F([0, 0, 10], [0, 0, 1]), F([20, 0, 5], [1, 0, 0])], IMP), "Angle 90° entre les faces"); assert.equal(measureOf([C([0, 0, 0]), C([30, 40, 7])], IMP), "Entraxe 1,969 in"); assert.equal(measureOf([V([0, 0, 0]), V([3, 4, 0])], { system: "si" }), "Distance 5 mm (ΔX 3 · ΔY 4 · ΔZ 0)");
  assert.equal(measureOf([E(40), E(20), F([0, 0, 0], [0, 0, 1]), V([0, 0, 0])]), "1 face · 2 arêtes · 1 point · 60 mm d'arêtes");
});

test("in an assembly a selection is measured where the parts stand, not where each was drawn", async () => {
  const { inWorld, measureOf: measure } = await import("../../web/js/core/view_select.js");
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], up = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 40, 1], turn = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];      // column-major : lifted by 40 ; turned a quarter about Z and moved by 10 along X
  const top = { kind: "face", key: "f:a:1", id: "a", at: [5, 5, 6], face: { type: "plane", n: [0, 0, 1], area: 100 } }, under = { kind: "face", key: "f:b:2", id: "b", at: [1, 1, 0], face: { type: "plane", n: [0, 0, -1], area: 50 } };
  assert.deepEqual(inWorld(top, I), top); assert.equal(inWorld(null, I), null); assert.equal(inWorld(top, null), top);
  assert.match(measure([top, under]), /^6 mm entre faces parallèles/, "each in its own frame : the 6 mm of the drawing");
  assert.match(measure([inWorld(top, I), inWorld(under, up)]), /^34 mm entre faces parallèles/, "the second part stands 40 mm higher : 34 mm between the faces");
  const side = inWorld({ kind: "face", key: "f:c:1", id: "c", at: [3, 0, 0], face: { type: "plane", n: [1, 0, 0], o: [3, 0, 0] } }, turn); assert.deepEqual(side.at, [10, 3, 0]); assert.deepEqual(side.face.n.map((c) => Math.round(c)), [0, 1, 0]); assert.deepEqual(side.face.o, [10, 3, 0]);
  const hole = inWorld({ kind: "face", key: "f:c:2", id: "c", at: [0, 0, 0], face: { type: "cylinder", r: 2, o: [0, 5, 0], axis: [0, 0, 1] } }, up), other = { kind: "face", key: "f:a:3", id: "a", at: [0, 0, 0], face: { type: "cylinder", r: 2, o: [30, 5, 0], axis: [0, 0, 1] } };
  assert.deepEqual(hole.face.o, [0, 5, 40]); assert.match(measure([hole, other]), /^Entraxe 30 mm/, "two axes lifted apart are still 30 mm apart");
  const edge = inWorld({ kind: "edge", key: "e:c:1", id: "c", at: [1, 0, 0], edge: { type: "line", len: 2, p0: [0, 0, 0], p1: [2, 0, 0] } }, turn); assert.deepEqual(edge.edge.p0, [10, 0, 0]); assert.deepEqual(edge.edge.p1, [10, 2, 0]); assert.equal(edge.edge.len, 2);
});
