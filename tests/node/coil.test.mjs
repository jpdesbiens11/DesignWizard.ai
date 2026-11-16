/* The helical coil of the part language : a tube wound on a cylinder or a cone — its volume against the length of the helix,
   its bore, its axis, and what it refuses. */
import test from "node:test";
import assert from "node:assert/strict";
import { buildPart } from "../../web/js/cad/build.js";
import { toFeatureScript } from "../../web/js/cad/featurescript.js";
import { FEATURE_LABEL, FEATURE_DEFAULT } from "../../web/js/core/part_edit.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const part = (...features) => ({ dw: "part/1", id: "T", name: "Serpentin", material: "CU-C110", features });
const tube = (R, h, n, d, di = 0) => Math.PI / 4 * (d * d - di * di) * Math.hypot(2 * Math.PI * R * n, h);       // section × length of the helix
const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} ≉ ${b}`);

test("a coil is a tube swept along a helix : solid or bored, on a cylinder or on a cone, along any axis", async () => {
  const K = await kernel(), made = (f, ...more) => { const b = buildPart(K, part(f, ...more)); K.flush(); return b; };
  const solid = made({ op: "coil", d: 6, r: 40, h: 50, turns: 5 });
  assert.deepEqual(solid.log.filter((l) => l.level === "error"), []); close(solid.volume, tube(40, 50, 5, 6)); assert.deepEqual(solid.bbox.map((x) => Math.round(x)), [-43, -43, -3, 43, 43, 53]);
  close(made({ op: "coil", d: 6, di: 4, r: 40, h: 50, turns: 5 }).volume, tube(40, 50, 5, 6, 4));
  const cone = made({ op: "coil", d: 6, di: 4, r: 30, r1: 60, h: 120, turns: 10, at: [0, 0, 10] });
  close(cone.volume, tube(45, 120, 10, 6, 4), 2e-3); assert.ok(cone.bbox[3] > 62 && cone.bbox[5] > 132 && cone.bbox[2] > 6, "it opens toward the top, from its base");
  const lying = made({ op: "coil", d: 4, r: 20, h: 40, turns: 4, at: [5, 0, 0], axis: "X" });
  assert.deepEqual(lying.bbox.map((x) => Math.round(x)), [3, -22, -22, 47, 22, 22]);
  const onBody = made({ op: "cylinder", d: 60, h: 80 }, { op: "coil", d: 6, di: 4, r: 33, h: 60, turns: 6, at: [0, 0, 10], body: "serpentin" });
  assert.equal(onBody.bodies.length, 2, "a coil can be a body of its own, around another");
});
test("a coil refuses what cannot be wound", async () => {
  const K = await kernel(), errors = (f) => { const b = buildPart(K, part(f)); K.flush(); return b.log.filter((l) => l.level === "error").map((l) => l.msg).join(" "); };
  assert.match(errors({ op: "coil", d: 6, r: 40, h: 20, turns: 5 }), /pas \(4\) est plus court que le diamètre du tube \(6\)/);
  assert.match(errors({ op: "coil", d: 6, r: 2, h: 60, turns: 5 }), /rayon de l'hélice/);
  assert.match(errors({ op: "coil", d: 6, di: 6, r: 40, h: 60, turns: 5 }), /alésage/);
});
test("the coil has its words in the editor, travels in a .dwiz file, and is left to Onshape in a FeatureScript", () => {
  assert.equal(FEATURE_LABEL.coil, "Coil (helical tube)"); assert.equal(FEATURE_DEFAULT.coil.op, "coil");
  const p = part({ op: "coil", id: "helice", d: 8, di: 6, r: 78.6, r1: 41.9, h: 125, turns: 11, at: [0, 0, 15], axis: "Z" });
  assert.deepEqual(fromDwiz(toDwiz(p)), p);
  assert.match(toFeatureScript(p).code || toFeatureScript(p), /serpentin \(coil\)/);
});
