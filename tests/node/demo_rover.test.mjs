/* The Rover example : the product of the guided tour of DynamiteAgile, in 3D — every part builds, the assembly is nothing
   but instances and mates and solves without a conflict, nothing collides, every joint is healthy, the BOM carries the
   part numbers of its bill of materials and the screws its joints ask for. */
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ROVER } from "../../web/js/demo/demo_rover.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { solve, candidates, bom, hardware } from "../../web/js/core/assembly_logic.js";
import { jointHealth } from "../../web/js/core/joint_health.js";
import { matPoint } from "../../web/js/cad/vec.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const r1 = (x) => Math.round(x * 10) / 10;
/* the box of a part once placed */
const placed = (bb, m) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) for (const z of [bb[2], bb[5]]) { const p = matPoint(m, [x, y, z]); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } } return [...lo, ...hi].map(r1); };

test("the Rover carries the part numbers of its bill of materials, each part with its interfaces", () => {
  const ids = DEMO_ROVER.parts.map((p) => p.id);
  assert.equal(ids.length, 24); assert.equal(new Set(ids).size, 24);
  for (const pn of ["RVR-1010-01", "RVR-1020-01", "RVR-1040-02", "RVR-2200-04", "RVR-2210-01", "RVR-2211-01", "RVR-3100-01", "RVR-3120-01", "RVR-3130-01", "RVR-3140-02", "RVR-3141-01", "RVR-3150-02", "RVR-3160-01", "RVR-5030-01", "RVR-5050-01", "RVR-5070-01", "RVR-5080-01", "RVR-5090-02", "RVR-5170-01", "RVR-5180-01", "RVR-5190-03", "RVR-5220-01"]) assert.ok(ids.includes(pn), pn);
  for (const p of DEMO_ROVER.parts) { assert.deepEqual(validateSpec(p).errors, [], p.id); assert.ok(p.function && p.interfaces.length, `${p.id} says what it does and how it is held`); for (const i of p.interfaces) assert.ok(i.key && i.partner, `${p.id} ${i.id}`); }
  const asm = DEMO_ROVER.assemblies[0];
  assert.equal(asm.instances.length, 30); assert.equal(asm.mates.length, 29); assert.equal(asm.instances.filter((i) => i.fixed).length, 1, "only the chassis is fixed : everything else is held by a mate");
  assert.deepEqual(fromDwiz(toDwiz(DEMO_ROVER.parts[6])), JSON.parse(JSON.stringify(DEMO_ROVER.parts[6])), "the laser-cut plate travels in a .dwiz file");
});

test("the Rover builds, mates itself, and nothing collides", async () => {
  const K = await kernel(), built = {};
  for (const s of DEMO_ROVER.parts) { built[s.id] = buildPart(K, s); assert.deepEqual(built[s.id].log.filter((l) => l.level === "error"), [], s.id); }
  const asm = JSON.parse(JSON.stringify(DEMO_ROVER.assemblies[0])), sol = solve(asm, built);
  assert.deepEqual(sol.problems, []); assert.deepEqual(sol.floating, []); assert.equal(candidates(asm, built).length, 0, "every interface has found its twin");
  const box = Object.fromEntries(asm.instances.map((i) => [i.id, placed(built[i.part].bbox, sol.placements[i.id])]));
  assert.deepEqual(box.plaque, [30, -10, 53, 240, 110, 57], "the plate sits on its 50 mm posts");
  assert.deepEqual(box.boitier, [36, 2, 57, 186, 98, 105], "the enclosure stands on the plate");
  assert.deepEqual([box.roue_av_g[1], box.roue_av_d[4]], [117, -17], "the wheels stand outside the axle beams, left and right");
  assert.ok(box.convertisseur[5] === 53 && box.convertisseur[2] > 20, "the converter hangs under the plate, above the battery");
  assert.deepEqual([box.pare_chocs[0], box.pare_chocs[2], box.pare_chocs[5]], [270, -2, 20], "the bumper pivots at the front, upright");
  assert.ok(box.us_gauche[4] > box.us_centre[4] && box.us_droite[1] < box.us_centre[1], "the side sensors look outward");
  const all = Object.values(box).reduce((a, b) => [0, 1, 2].map((k) => Math.min(a[k], b[k])).concat([3, 4, 5].map((k) => Math.max(a[k], b[k]))));
  assert.deepEqual(all, [0, -49, -26, 296, 149, 121], "296 × 198 × 147 mm, wheels on the ground 26 mm under the floor");
  /* real interference : the common volume of every pair of instances whose boxes meet */
  const ids = Object.keys(box), solids = (id) => built[asm.instances.find((x) => x.id === id).part].bodies.map((q) => K.transform(q.shape, sol.placements[id])), hits = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = box[ids[i]], b = box[ids[j]]; if (![0, 1, 2].every((k) => Math.min(a[k + 3], b[k + 3]) - Math.max(a[k], b[k]) > -0.01)) continue;
    let v = 0; for (const sa of solids(ids[i])) for (const sb of solids(ids[j])) { try { v += K.props(K.common(sa, sb)).volume; } catch (e) { /* nothing in common */ } } if (v > 0.5) hits.push(`${ids[i]} × ${ids[j]} : ${r1(v)} mm³`); }
  assert.deepEqual(hits, []);
  const specs = Object.fromEntries(DEMO_ROVER.parts.map((p) => [p.id, p]));
  assert.deepEqual(jointHealth(asm, built, specs, sol).filter((r) => r.state !== "ok"), [], "every joint is healthy");
  const hw = hardware(asm, built), rows = bom(DEMO_ROVER, asm, built);
  assert.ok(hw.some((h) => /M3/.test(h.id)) && hw.some((h) => /M2\.5/.test(h.id)) && hw.some((h) => /INSERT-M3/.test(h.id)), "screws and inserts come from the joints");
  assert.equal(rows.find((r) => r.id === "RVR-1010-W").qty, 4); assert.equal(rows.find((r) => r.id === "RVR-3100-01").qty, 3); assert.equal(rows.find((r) => r.id === "RVR-3150-02").qty, 2);
  K.flush();
});
