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
  assert.equal(measureOf([E(40), E(20), F([0, 0, 0], [0, 0, 1]), V([0, 0, 0])]), "1 face · 2 arêtes · 1 point · 60 mm d'arêtes");
});
