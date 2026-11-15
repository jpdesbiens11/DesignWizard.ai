/* 3D view marks : which side a normal looks at, the faces lit for a side, the points of a side, the symbols of a load case. */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../web/vendor/three/three.module.min.js";
import { sideOf, sidePoints, lightSide, lightFace, arrow, clamp, gem, SIDES, LIT } from "../../web/js/core/view_marks.js";

/** A stand-in for the viewer : one object made of a stepped block (a 20 × 10 × 4 base with a 10 × 10 × 4 step on its left half). */
function fakeViewer() {
  const boxes = [[0, 0, 0, 20, 10, 4], [0, 0, 4, 10, 10, 8]], pos = [], idx = [], faceOf = [];
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]];
    for (const q of quads) { const b = pos.length / 3; for (const k of q) pos.push(...c[k]); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); faceOf.push(faceOf.length / 2 | 0, faceOf.length / 2 | 0); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g), group = new THREE.Group(); group.add(mesh);
  return { objects: new Map([["part/body", { group, mesh, def: { id: "part/body", mesh: { faceOf } } }]]), overlays: new THREE.Group(), dirty: false, _size: () => 30 };
}

test("the side a surface looks at, and points spread over the side of a box", () => {
  assert.equal(sideOf([0, 0, 1]), "+Z"); assert.equal(sideOf([0, -0.999, 0.02]), "-Y"); assert.equal(sideOf([0.7, 0.7, 0]), null); assert.equal(sideOf(null), null);
  const pts = sidePoints([0, 0, 0, 30, 20, 10], "+Z", 3); assert.equal(pts.length, 9); assert.ok(pts.every((p) => p[2] === 10 && p[0] > 0 && p[0] < 30 && p[1] > 0 && p[1] < 20)); assert.deepEqual(pts[4], [15, 10, 10]);
  assert.deepEqual(sidePoints([0, 0, 0, 30, 20, 10], "-X", 1), [[0, 10, 5]]); assert.deepEqual(Object.keys(SIDES).length, 6);
});

test("faces light up : the outermost plane of a side, a plane at a given level, every plane of a side, one face of the B-Rep", () => {
  const v = fakeViewer(), tris = (tag) => v.overlays.children.filter((c) => c.userData.tag === tag).reduce((s, c) => s + c.geometry.getIndex().count / 3, 0);
  assert.equal(lightSide(v, "+Z", { tag: "a" }), 2, "the top of the step only : the outermost plane"); assert.equal(tris("a"), 2); assert.ok(v.dirty);
  assert.equal(lightSide(v, "+Z", { tag: "b", level: 4 }), 4, "the plane at z = 4 : the top of the base and the bottom of the step, which lie in it"); assert.equal(lightSide(v, "+Z", { tag: "c", all: true }), 8);
  assert.equal(lightSide(v, "-X", { tag: "d" }), 4, "both boxes reach x = 0"); assert.equal(lightSide(v, "+X", { tag: "e" }), 2); assert.equal(lightSide(v, "+Q"), 0);
  assert.equal(lightSide(v, "+Z", { tag: "f", ids: ["other"] }), 0, "only the objects asked for"); assert.equal(lightSide(v, "+Z", { tag: "f", ids: ["part"] }), 2);
  assert.equal(lightFace(v, "part/body", 1, { tag: "g" }), 2); assert.equal(lightFace(v, "part/body", -1), 0); assert.equal(lightFace(v, "absent", 0), 0);
  const m = v.overlays.children.find((c) => c.userData.tag === "a"); assert.equal(`#${m.material.color.getHexString()}`, LIT.named); assert.ok(m.material.transparent && m.material.polygonOffset);
});

test("symbols : an arrow whose tip touches the surface and points the way of the force, a clamp standing off the surface, a mark for heat", () => {
  const v = fakeViewer(), a = arrow(v, [10, 5, 8], [0, 0, -1], { tag: "sym", len: 6 }), head = a.children[0], shaft = a.children[1];
  assert.ok(head.position.z > 8 && shaft.position.z > head.position.z, "the arrow stands above the face and points down at it"); assert.ok(Math.abs(head.position.z - 8 - 0.9) < 1e-9); assert.equal(a.userData.tag, "sym");
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(head.quaternion); assert.ok(Math.abs(up.z + 1) < 1e-9, "the cone points along the force");
  const c = clamp(v, [0, 5, 2], [-1, 0, 0], { tag: "sym", len: 2 }); assert.ok(c.children.every((k) => k.position.x < 0), "the clamp is outside the part, on the side of the outward normal");
  const g = gem(v, [1, 2, 3], { tag: "sym" }); assert.deepEqual(g.position.toArray(), [1, 2, 3]); assert.equal(v.overlays.children.filter((k) => k.userData.tag === "sym").length, 3);
});
