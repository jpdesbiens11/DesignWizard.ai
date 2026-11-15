/* Filling a cavity in the assembly : the filler takes the room left by the housing and by what is in it. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { fillCavity } from "../../web/js/cad/fill.js";
import { synthesize } from "../../web/js/core/shop_intent.js";

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const part = (id, features) => ({ dw: "part/1", id, name: id, family: "prismatic", process: "cnc_milling", material: "AL6061-T6", params: {}, interfaces: [], features });

test("the filler takes the room left : the whole cavity, less what is in it, up to the level asked", async () => {
  const K = await kernel(), box = buildPart(K, part("BOX", [{ op: "box", id: "b", size: [60, 40, 20] }, { op: "pocket", id: "p", face: "+Z", rect: [3, 3, 54, 34], depth: 17 }])), blk = buildPart(K, part("BLK", [{ op: "box", id: "b", size: [20, 10, 8] }]));
  const shape = { BOX: box.bodies[0].shape, BLK: blk.bodies[0].shape }, place = (it) => (it.matrix === I ? shape[it.key] : K.transform(shape[it.key], it.matrix));
  const empty = fillCavity(K, place, { key: "BOX", matrix: I }); assert.ok(Math.abs(empty.volume - 54 * 34 * 17) < 1, `the empty cavity : ${empty.volume.toFixed(0)} mm³`); assert.deepEqual(empty.bbox.map((x) => Math.round(x)), [3, 3, 3, 57, 37, 20]);
  const full = fillCavity(K, place, { key: "BOX", matrix: I }, [{ key: "BLK", matrix: at(10, 10, 3) }]); assert.ok(Math.abs(full.volume - (54 * 34 * 17 - 20 * 10 * 8)) < 1, "less the block standing on the floor");
  assert.ok(K.props(K.common(full.shape, K.transform(shape.BLK, at(10, 10, 3)))).volume < 1e-6 && K.props(K.common(full.shape, shape.BOX)).volume < 1e-6, "the filler enters neither the housing nor the part");
  const half = fillCavity(K, place, { key: "BOX", matrix: I }, [{ key: "BLK", matrix: at(10, 10, 3) }], 3 + 8.5); assert.ok(Math.abs(half.volume - (54 * 34 * 8.5 - 20 * 10 * 8)) < 1 && Math.abs(half.bbox[5] - 11.5) < 1e-6, "poured to mid height");
  const moved = fillCavity(K, place, { key: "BOX", matrix: at(100, 0, 0) }, [{ key: "BLK", matrix: at(110, 10, 3) }]); assert.ok(Math.abs(moved.volume - full.volume) < 1 && Math.abs(moved.bbox[0] - 103) < 1e-6, "computed where the housing stands in the assembly");
  assert.throws(() => fillCavity(K, place, { key: "BLK", matrix: I }), /Aucune cavité à remplir/); assert.throws(() => fillCavity(K, place, { key: "BOX", matrix: I }, [], -5), /sous le fond/);
  const text = K.stepWrite([{ key: "fill", name: "Remplissage", shape: full.shape, matrix: null }], "Remplissage"), back = K.stepRead(text); assert.equal(back.length, 1); assert.ok(Math.abs(K.props(back[0].shape).volume - full.volume) < 1, "the filler travels as a STEP part");
  K.flush();
});

test("in a moulded housing with drafted walls and round corners, only what the walls enclose is kept", async () => {
  const K = await kernel(), s = synthesize({ name: "Boîtier", material: "PC-ABS", form: "molded", quantity: 2000, envelope: { L: 80, W: 50, H: 20 }, cover: false, interfaces: [] }, "H").spec, b = buildPart(K, s);
  const f = fillCavity(K, () => b.bodies[0].shape, { key: "H", matrix: I }), wall = s.params.wall.value, inside = (80) * (50) * (20);
  assert.ok(f.volume > 0.8 * inside && f.volume < 1.05 * (b.bbox[3] - b.bbox[0]) * (b.bbox[4] - b.bbox[1]) * (b.bbox[5] - b.bbox[2]), `the cavity : ${(f.volume / 1000).toFixed(1)} cm³`);
  assert.ok(f.bbox[0] > b.bbox[0] + wall * 0.5 && f.bbox[3] < b.bbox[3] - wall * 0.5, "the slivers outside the leaning walls are not the filler");
  K.flush();
});
