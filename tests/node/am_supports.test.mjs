/* 3D printing : the surfaces a build direction leaves to support, measured on the mesh of the part. Real kernel. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { supportReport, rankDirections, buildDir, BUILD_DIRS, DIR_WORDS } from "../../web/js/analysis/am_supports.js";

const K = await kernel();
const meshOf = (features) => { const b = buildPart(K, { dw: "part/1", id: "T", name: "T", material: "PA12", process: "mjf", params: {}, interfaces: [], features }); return K.tessellate(b.bodies[0].shape); };
const close = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what} : ${got} instead of ${want}`);

test("a block rests on the plate : nothing to support, whichever side is up ; its height is what stands up", () => {
  const m = meshOf([{ op: "box", size: [60, 40, 30] }]);
  for (const d of Object.keys(BUILD_DIRS)) { const r = supportReport(m, d, 45); assert.equal(r.area, 0, d); assert.equal(r.faces, 0); close(r.total, 2 * (60 * 40 + 60 * 30 + 40 * 30), 0.5, "area of the block"); }
  assert.deepEqual([supportReport(m, "+Z").height, supportReport(m, "+X").height, supportReport(m, "-Y").height], [30, 60, 40]);
  close(supportReport(m, "+Z").plate, 2400, 0.5, "the face on the plate"); close(supportReport(m, "+X").plate, 1200, 0.5, "the face on the plate, part standing");
  assert.equal(rankDirections(m)[0].height, 30, "nothing to support anywhere : the lowest build comes first");
  assert.equal(Object.keys(DIR_WORDS).length, 6);
});

test("a table top : its underside is supported when it looks down, not when the part is turned over", () => {
  // a 60 × 40 plate 4 thick on a 20 × 20 foot 26 high : 60 × 40 − 20 × 20 = 2000 mm² look down
  const m = meshOf([{ op: "box", size: [20, 20, 26], at: [20, 10, 0] }, { op: "box", size: [60, 40, 4], at: [0, 0, 26] }]);
  const up = supportReport(m, "+Z", 45), down = supportReport(m, "-Z", 45);
  close(up.area, 2000, 1, "underside of the top"); close(up.volume, 2000 * 26, 60, "what the supports fill, down to the plate"); assert.ok(up.faces >= 1); close(up.plate, 400, 0.5, "the foot stands on the plate");
  assert.equal(down.area, 0, "turned over, the top lies on the plate"); close(down.plate, 2400, 0.5, "the whole top on the plate");
  assert.equal(rankDirections(m, 45)[0].dir, "-Z"); assert.ok(up.flags.filter((f) => f === 1).length > 0 && down.flags.every((f) => f !== 1));
  close(up.share, 2000 / up.total, 0.002, "share of the surface");
});

test("the limit angle of the process : a 45° chamfer holds at 45°, not at 55° ; a small cross hole prints round", () => {
  const m = meshOf([{ op: "box", size: [20, 20, 26], at: [20, 10, 0] }, { op: "box", size: [60, 40, 4], at: [0, 0, 26] }, { op: "chamfer", d: 3, edges: "bottom" }]);
  // a wedge : the sloping face of a 45° prism looks down at exactly 45°
  const wedge = meshOf([{ op: "extrude", profile: { poly: [[0, 0], [10, 10], [0, 10]] }, plane: "XZ", length: 30 }]);
  assert.equal(supportReport(wedge, "+Z", 45).area, 0, "at the limit, it holds"); close(supportReport(wedge, "+Z", 55).area, 30 * Math.hypot(10, 10), 1, "a material that asks 55° does not");
  const holes = meshOf([{ op: "box", size: [60, 40, 30] }, { op: "hole", id: "petit", face: "-Y", at: [20, 15], d: 6, depth: "through" }, { op: "hole", id: "grand", face: "-Y", at: [42, 15], d: 12, depth: "through" }]);
  const all = supportReport(holes, "+Z", 45), round = supportReport(holes, "+Z", 45, { hole: 8 });
  assert.ok(all.area > round.area + 100 && round.area > 100, `${all.area} with both roofs, ${round.area} with the large one only`); assert.equal(all.faces, 2); assert.equal(round.faces, 1, "the Ø6 hole prints round");
  assert.equal(supportReport(holes, "-Y", 45, { hole: 8 }).area, 0, "standing on its holes, nothing to support"); assert.ok(m.pos.length > 0);
  assert.deepEqual([buildDir({}), buildDir({ print: { dir: "-Y" } }), buildDir({ print: { dir: "sideways" } }), buildDir(null)], ["+Z", "-Y", "+Z", "+Z"]);
  assert.equal(supportReport(holes, "sideways").dir, "+Z", "an unknown direction is read as +Z");
});

test("the direction is a word of the part : it survives the file format, and the routing sheet says it", async () => {
  const { toDwiz, fromDwiz } = await import("../../web/js/core/dwiz.js"), { routing } = await import("../../web/js/cad/shop.js");
  const spec = { dw: "part/1", id: "T-AM", name: "Support imprimé", material: "TI-6AL-4V", process: "lpbf", print: { dir: "-Z" }, params: {}, interfaces: [], features: [{ op: "box", size: [30, 20, 10] }] };
  const back = fromDwiz(toDwiz(spec)); assert.deepEqual((Array.isArray(back) ? back[0] : back).print, { dir: "-Z" }); assert.match(toDwiz(spec), /^print dir=-Z$|print\s+dir[ =:]+-Z/m);
  const b = buildPart(K, spec); assert.match(routing(spec, b).steps.map((s) => s.text).join(" | "), /Fusionner sur lit de poudre[^|]*retournée, dessous vers le haut \(−Z\)/);
  const plain = { ...spec }; delete plain.print; assert.ok(!/vers le haut/.test(routing(plain, buildPart(K, plain)).steps.map((s) => s.text).join(" | ")), "a part that says nothing : the routing sheet does not invent a direction");
});
