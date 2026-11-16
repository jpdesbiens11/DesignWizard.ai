/* The hybrid rocket example : a CAD exercise — every part builds, the assembly is instances and mates only and solves without
   a conflict, nothing collides, every joint is healthy ; the nozzle carries its helical coil, the fins stand at 45° of the
   rail buttons, the stack is 3,66 m long for 203,2 mm of diameter. */
import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ROCKET } from "../../web/js/demo/demo_rocket.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { solve, candidates, bom } from "../../web/js/core/assembly_logic.js";
import { jointHealth } from "../../web/js/core/joint_health.js";
import { matPoint } from "../../web/js/cad/vec.js";
import { kernel } from "./kernel_helper.mjs";

const r1 = (x) => Math.round(x * 10) / 10;
const placed = (bb, m) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) for (const z of [bb[2], bb[5]]) { const p = matPoint(m, [x, y, z]); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } } return [...lo, ...hi].map(r1); };

test("the rocket says what it is : an exercise, with its systems and their interfaces", () => {
  assert.equal(DEMO_ROCKET.parts.length, 22); assert.equal(new Set(DEMO_ROCKET.parts.map((p) => p.id)).size, 22);
  assert.match(DEMO_ROCKET.description, /ni dimensionnée ni validée/);
  for (const p of DEMO_ROCKET.parts) { assert.deepEqual(validateSpec(p).errors, [], p.id); assert.ok(p.function && p.interfaces.length, p.id); for (const i of p.interfaces) assert.ok(i.key && i.partner, `${p.id} ${i.id}`); }
  const names = DEMO_ROCKET.parts.map((p) => p.name).join(" | ");
  for (const word of ["Tuyère refroidie", "Serpentin", "Chambre de combustion", "polyuréthane", "Plaque d'injection", "Vanne principale", "Réservoir de protoxyde d'azote", "Aileron", "Carte de commande", "Faisceau", "Parachute", "Ogive"]) assert.ok(names.includes(word), word);
  assert.ok(DEMO_ROCKET.parts.find((p) => p.id === "FUS-1020").features.some((f) => f.op === "coil"), "the cooling coil is a real helix");
  assert.match(DEMO_ROCKET.parts.find((p) => p.id === "FUS-3020").notes.join(" "), /Récipient sous pression/); assert.match(DEMO_ROCKET.parts.find((p) => p.id === "FUS-3010").notes.join(" "), /Variante pyrotechnique/);
  const asm = DEMO_ROCKET.assemblies[0];
  assert.equal(asm.instances.length, 26); assert.equal(asm.mates.length, 25); assert.equal(asm.instances.filter((i) => i.fixed).length, 1);
});

test("the rocket builds, stacks itself along its axis, and nothing collides", async () => {
  const K = await kernel(), built = {};
  for (const s of DEMO_ROCKET.parts) { built[s.id] = buildPart(K, s); assert.deepEqual(built[s.id].log.filter((l) => l.level === "error"), [], s.id); }
  const asm = JSON.parse(JSON.stringify(DEMO_ROCKET.assemblies[0])), sol = solve(asm, built);
  assert.deepEqual(sol.problems, []); assert.deepEqual(sol.floating, []); assert.equal(candidates(asm, built).length, 0);
  const box = Object.fromEntries(asm.instances.map((i) => [i.id, placed(built[i.part].bbox, sol.placements[i.id])]));
  assert.deepEqual([box.tuyere[2], box.chambre[2], box.chambre[5], box.reservoir[5], box.ogive[5]], [0, 230, 1130, 2585, 3660], "nozzle, chamber, tank, nose : 3,66 m from the exit to the tip");
  assert.deepEqual([box.jupe[2], box.jupe[5], box.serpentin[2]], [20, 207, 11], "the skirt hides the coil, the nozzle shows 20 mm under it");
  assert.deepEqual([box.coque_arriere[2], box.coque_centrale[5], box.coque_avant[5]], [215, 2650, 3050], "three airframe sections, each in the next");
  assert.deepEqual(box.ligne.slice(0, 2).concat(box.ligne.slice(3, 5)), [47, -3, 97, 3], "the coolant line climbs from the coil to the valve, between chamber and airframe");
  /* the fins : four, at 45° of the axes, swept back — the tip chord is lower than the root's top */
  const fin = built["FUS-4020"], tips = [1, 2, 3, 4].map((k) => matPoint(sol.placements[`aileron_${k}`], [190, 0, 70]).map(r1));
  assert.deepEqual(tips.map((p) => p[2]), [325, 325, 325, 325], "every fin stands the right way up"); assert.deepEqual(tips.map((p) => r1(Math.hypot(p[0], p[1]))), [298, 298, 298, 298], "tip at 298 mm of the axis");
  assert.deepEqual(tips.map((p) => r1(Math.abs(p[0]) - Math.abs(p[1]))), [0, 0, 0, 0], "at 45° of X and Y"); assert.ok(fin.volume > 0);
  const button = matPoint(sol.placements.bouton_bas, [0, 0, 12]).map(r1); assert.ok(Math.min(Math.abs(button[0]), Math.abs(button[1])) < 0.1, "the rail buttons stand between two fins");
  const all = Object.values(box).reduce((a, b) => [0, 1, 2].map((k) => Math.min(a[k], b[k])).concat([3, 4, 5].map((k) => Math.max(a[k], b[k]))));
  assert.deepEqual([all[2], all[5]], [0, 3660]);
  const ids = Object.keys(box), solids = (id) => built[asm.instances.find((x) => x.id === id).part].bodies.map((q) => K.transform(q.shape, sol.placements[id])), hits = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = box[ids[i]], b = box[ids[j]]; if (![0, 1, 2].every((k) => Math.min(a[k + 3], b[k + 3]) - Math.max(a[k], b[k]) > -0.01)) continue;
    let v = 0; for (const sa of solids(ids[i])) for (const sb of solids(ids[j])) { try { v += K.props(K.common(sa, sb)).volume; } catch (e) { /* nothing in common */ } } if (v > 0.5) hits.push(`${ids[i]} × ${ids[j]} : ${r1(v)} mm³`); }
  assert.deepEqual(hits, []);
  const specs = Object.fromEntries(DEMO_ROCKET.parts.map((p) => [p.id, p]));
  assert.deepEqual(jointHealth(asm, built, specs, sol).filter((r) => r.state !== "ok"), [], "every joint is healthy");
  const rows = bom(DEMO_ROCKET, asm, built); assert.equal(rows.find((r) => r.id === "FUS-4020").qty, 4); assert.equal(rows.find((r) => r.id === "FUS-4050").qty, 2);
  K.flush();
});
