/* A part made elsewhere, imported and mated (demande de JP, 28 novembre 2026 : « faire les pièces les plus complexes en 3D dans OnShape ou
   Inventor et les importer comme une nouvelle pièce en stp… et que l'interface soit reconnue pour le mating en promenant la pièce devant
   l'interface parent à l'écran »). A plate is built by the real kernel, written to STEP and read back as a file made elsewhere : its holes,
   its bore, its shaft and its largest flat face are read, proposed as interfaces, confirmed ; nothing of the solid changes ; the proposals
   land on the holes ; a proposal waits until it is confirmed ; dragged in front of a parent pattern — even one turned by a quarter — the part
   snaps on it, the solver puts it where the preview showed, and pulled away it lets go.
   node --test tests/node/step_import.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { readFeatures, axisOf } from "../../web/js/cad/step_read.js";
import { screwsFor, holesOf, shaftsOf, patternOf, toPattern, proposeInterfaces, applyProposals, confirmInterface, dropProposal, proposalKey, projectInterfaces } from "../../web/js/core/step_interfaces.js";
import { patternPoints, interfaceFrame } from "../../web/js/cad/interfaces.js";
import { candidates, freeInterfaces, solve, solveLevels } from "../../web/js/core/assembly_logic.js";
import { dragPlan, snapPick, letsGo, screenMove, applySnap, applyDrop, REACH } from "../../web/js/core/asm_snap.js";
import { partIssues } from "../../web/js/core/guide_checks.js";
import { matPoint, matMul, IDENTITY } from "../../web/js/cad/vec.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
const PLATE = { id: "MADE", name: "plate", material: "AL6061-T6", stock: { form: "plate", L: 80, W: 60, t: 6 }, features: [], interfaces: [
  { id: "H1", type: "bolt_pattern", side: "A", face: "-Z", at: [40, 30], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } }, opts: { head: "cbore" } },
  { id: "H2", type: "fit", side: "A", face: "+Z", at: [40, 30], params: { d: 10, length: 8 } },
  { id: "H3", type: "bolt_pattern", side: "B", face: "+Z", at: [12, 30], level: 6, params: { screw: "M3", pattern: { type: "rect", nx: 1, ny: 2, dx: 0, dy: 20 } } },
  { id: "H4", type: "pins", side: "B", face: "-Z", at: [40, 8], params: { d: 4, pitch: 30, n: 2 } }] };
/* a STEP file made « elsewhere » : the plate above, built by the kernel and written as a supplier would send it */
async function madeElsewhere(spec = PLATE) {
  const K = await kernel(), b = buildPart(K, spec);
  assert.deepEqual(b.log.filter((l) => l.level === "error"), []);
  const text = K.stepWrite([{ key: spec.id, name: spec.name, instanceName: spec.name, shape: b.bodies[0].shape, matrix: null }], spec.name);
  return { K, text, volume: b.volume, holes: b.facts.holes };
}
const imported = (text, interfaces = []) => ({ dw: "part/1", id: "IMP", name: "imported", family: "purchased", process: "purchased", material: "", step: { text, file: "plate.step" }, imported: { from: "step", file: "plate.step" }, features: [], interfaces });
/* where the holes of a built bolt pattern are, in the part : its frame, its pattern, its side */
const holesAt = (it) => patternPoints(it.params.pattern).map(([pu, pv]) => { const s = it.side === "B" ? -1 : 1, f = it.frame; return [0, 1, 2].map((k) => f.o[k] + f.u[k] * pu + f.v[k] * pv * s); });

test("the diameters of the table : a clearance hole, a tap drill, the basic minor diameter of ISO 724 — closest first", () => {
  assert.deepEqual(screwsFor(4.5)[0], { screw: "M4", kind: "clearance", fit: "medium", gap: 0 });
  assert.equal(screwsFor(3.3)[0].screw, "M4"); assert.equal(screwsFor(3.3)[0].kind, "tap");
  assert.equal(screwsFor(3.242)[0].kind, "tap", "Inventor models a tapped hole at the minor diameter : M4 × 0,7 → 3,242");
  assert.equal(screwsFor(3.4)[0].screw, "M3", "M3 medium clearance 3,4 is not M4 tap 3,3 : the windows do not overlap"); assert.deepEqual(screwsFor(7.2), []);
  assert.deepEqual(axisOf([0, 0, -1]), { k: 2, s: -1 }); assert.equal(axisOf([0, 0.7071, 0.7071]), null);
});

test("a set of points of a face becomes a pattern of the platform : rect, circle, points, single — and a turned pattern reads back", () => {
  assert.deepEqual(patternOf([[0, 0], [40, 0], [0, 30], [40, 30]]).pattern, { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 });
  const c = patternOf([0, 60, 120, 180, 240, 300].map((a) => [25 * Math.cos(a * Math.PI / 180), 25 * Math.sin(a * Math.PI / 180) + 7]));
  assert.deepEqual(c.pattern, { type: "circle", n: 6, pcd: 50, start: 0 }); assert.ok(near(c.centre[1], 7));
  assert.equal(patternOf([[0, 0], [10, 3], [4, 20]]).pattern.type, "points"); assert.deepEqual(patternOf([[5, 6]]), { pattern: { type: "single" }, centre: [5, 6] });
  assert.deepEqual(toPattern([10, 5], 0, "A"), [10, 5]); assert.deepEqual(toPattern([10, 5], 0, "B"), [10, -5], "side B is mirrored in v");
  assert.deepEqual(toPattern([0, 10], 90, "A"), [10, 0], "a quarter turn of the frame : what ran along v runs along u");
});

test("a STEP made elsewhere : its holes, its bore, its shaft and its flat face are read and proposed — nothing is guessed", async () => {
  const { K, text } = await madeElsewhere(), solid = K.stepRead(text)[0], found = readFeatures(K, solid.shape); K.flush();
  assert.ok(found.faces > 15 && found.planes.length && found.cyls.length); assert.equal(found.slanted, 0);
  const holes = holesOf(found), shafts = shaftsOf(found);
  assert.equal(holes.filter((h) => h.d === 4.5 && h.cbore && h.cbore.end === "lo").length, 4, "four M4 clearance holes, counterbored from below");
  assert.equal(holes.filter((h) => h.d === 2.5 && h.entries.lo && h.entries.hi).length, 2); assert.deepEqual(shafts.map((s) => [s.d, s.sign, s.base, s.length]), [[10, 1, 6, 8]]);
  const r = proposeInterfaces(found), by = (n) => r.proposals.find((p) => p.name === n);
  const bolt = by("4 × M4 clearance"); assert.ok(bolt, r.proposals.map((p) => p.name).join(", "));
  assert.equal(bolt.side, "A"); assert.equal(bolt.face, "+Z", "the head sits in the counterbore : the part meets its neighbour on the other face"); assert.equal(bolt.level, 6);
  assert.deepEqual(bolt.params, { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } }); assert.deepEqual(bolt.opts, { fit: "medium", head: "cbore", depth: "through" }); assert.ok(!bolt.alt, "a counterbore says the face");
  const tap = by("2 × M3 tapped"); assert.equal(tap.side, "B"); assert.ok(tap.alt, "a through tapped hole can be met from either face"); assert.notEqual(tap.alt.face, tap.face);
  assert.equal(by("Dowel holes 2 × Ø4").type, "pins"); assert.equal(by("Shaft Ø10").type, "fit"); assert.equal(by("Shaft Ø10").face, "+Z");
  const flat = r.proposals.find((p) => p.type === "planar"); assert.equal(flat.on, false, "a flat face is Off by default : it mates only with one of the same size");
  assert.ok(r.proposals.every((p) => p.found && p.proposed && p.why && /^IF\d+$/.test(p.id))); assert.equal(new Set(r.proposals.map((p) => p.id)).size, r.proposals.length);
  // what the part already has, or what a person set aside, is not proposed again
  const again = proposeInterfaces(found, { have: [{ ...bolt, id: "IF9" }], dropped: [proposalKey(tap)] });
  assert.ok(!again.proposals.some((p) => p.name === bolt.name) && !again.proposals.some((p) => p.name === tap.name)); assert.ok(again.proposals.every((p) => p.id !== "IF9"));
});

test("confirmed, the interfaces land on the holes of the file — and the solid is not changed", async () => {
  const { K, text, volume, holes } = await madeElsewhere(), found = readFeatures(K, K.stepRead(text)[0].shape); K.flush();
  const r = proposeInterfaces(found), spec = imported(text);
  applyProposals(spec, r.proposals.map((p) => ({ p, on: p.on, flip: false })), { at: "2026-11-28", faces: found.faces });
  assert.equal(spec.interfaces.filter((i) => i.proposed).length, 1, "what is Off stays a proposal"); assert.equal(spec.imported.read.faces, found.faces);
  assert.ok(spec.interfaces.every((i) => i.alt === undefined && i.on === undefined && i.found));
  const b = buildPart(K, spec); K.flush();
  assert.deepEqual(b.log.filter((l) => l.level === "error"), []); assert.ok(near(b.volume, volume, 1e-3 * volume), "found : nothing drilled, nothing added");
  const hole = (x, y) => holes.some((h) => near(h.at[0], x, 0.01) && near(h.at[1], y, 0.01));
  for (const it of b.interfaces.filter((i) => i.type === "bolt_pattern")) for (const p of holesAt(it)) assert.ok(hole(p[0], p[1]), `${it.name} : a hole at ${p}`);
  assert.ok(b.interfaces.some((i) => i.proposed), "the proposal is built (its frame can be shown) but marked");
});

test("a proposal waits : it is not offered to the assembly until a person confirms it ; then it mates with a parent pattern", async () => {
  const { K, text } = await madeElsewhere(), found = readFeatures(K, K.stepRead(text)[0].shape); K.flush();
  const parent = { id: "BASE", name: "base", material: "AL6061-T6", stock: { form: "plate", L: 120, W: 100, t: 10 }, features: [],
    interfaces: [{ id: "T1", type: "bolt_pattern", side: "B", face: "+Z", at: [60, 50], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } } }] };
  const r = proposeInterfaces(found, { others: projectInterfaces([parent], "IMP") }), spec = imported(text);
  applyProposals(spec, r.proposals.map((p) => ({ p, on: false })), null);
  const built = { BASE: buildPart(K, parent), IMP: buildPart(K, spec) }; K.flush();
  const asm = { id: "A", instances: [{ id: "i1", part: "BASE", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "IMP", placement: { t: [200, 0, 0], r: [0, 0, 0] } }], mates: [] };
  assert.equal(freeInterfaces(asm, built).filter((f) => f.inst === "i2").length, 0, "nothing proposed is offered"); assert.deepEqual(candidates(asm, built), []);
  const bolt = spec.interfaces.find((i) => i.name === "4 × M4 clearance"); confirmInterface(spec, bolt.id); built.IMP = buildPart(K, spec); K.flush();
  const c = candidates(asm, built); assert.equal(c.length, 1); assert.deepEqual([c[0].a, c[0].b], [{ inst: "i2", iface: bolt.id }, { inst: "i1", iface: "T1" }]);
  // set aside : removed, and not proposed by the next reading
  const tap = spec.interfaces.find((i) => i.name === "2 × M3 tapped"); assert.ok(dropProposal(spec, tap.id)); assert.ok(!spec.interfaces.includes(tap));
  assert.ok(!proposeInterfaces(found, { have: spec.interfaces, dropped: spec.imported.dropped }).proposals.some((p) => p.name === tap.name));
});

test("dragged in front of the parent, the part snaps ; the solver puts it where the preview showed ; pulled away, it lets go", async () => {
  const { K, text } = await madeElsewhere(), found = readFeatures(K, K.stepRead(text)[0].shape); K.flush();
  /* the parent pattern is turned by a quarter : 30 along X, 40 along Y — the proposal takes its pattern and the turn */
  const parent = { id: "BASE", name: "base", material: "AL6061-T6", stock: { form: "plate", L: 120, W: 100, t: 10 }, features: [],
    interfaces: [{ id: "T1", type: "bolt_pattern", side: "B", face: "+Z", at: [60, 50], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 30, dy: 40 } } }] };
  const r = proposeInterfaces(found, { others: projectInterfaces([parent], "IMP") }), bolt = r.proposals.find((p) => p.name === "4 × M4 clearance");
  assert.ok([90, 270].includes(bolt.rot), `turned by a quarter (${bolt.rot})`); assert.deepEqual(bolt.params.pattern, parent.interfaces[0].params.pattern); assert.match(bolt.like, /BASE · T1/);
  const spec = imported(text); applyProposals(spec, [{ p: bolt, on: true }], null);
  const built = { BASE: buildPart(K, parent), IMP: buildPart(K, spec) }; K.flush();
  const doc = { id: "A", instances: [{ id: "i1", part: "BASE", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "IMP", placement: { t: [200, 0, 0], r: [0, 0, 0] } }], mates: [] };
  let sol = solve(doc, built);
  assert.equal(dragPlan(doc, doc, sol, built, "i1").ground, true, "the base does not move");
  const P = dragPlan(doc, doc, sol, built, "i2"); assert.equal(P.ground, false); assert.equal(P.hold, null); assert.equal(P.targets.length, 1); assert.equal(P.targets[0].linked, false, "a geometry read in a file is not driven by its neighbour");
  const flat = (p) => [p[0], p[1]];      // looking down Z : the screen is the XY plane
  assert.equal(snapPick(P, IDENTITY, flat), null, "far away : nothing lights up");
  const t = P.targets[0], near1 = screenMove(t.at[0] - t.from[0] + 10, -(t.at[1] - t.from[1]) + 10, [1, 0, 0], [0, 1, 0], 1);      // the hand brings it within 14 px
  const hit = snapPick(P, near1, flat); assert.ok(hit && hit.dist < REACH, "in reach : the target lights up");
  const before = JSON.stringify(doc); const m = applySnap(doc, P, hit.target); assert.notEqual(JSON.stringify(doc), before);
  assert.equal(m.id, "M1"); assert.equal(doc.mseq, 1); assert.deepEqual([m.a, m.b], [{ inst: "i2", iface: bolt.id }, { inst: "i1", iface: "T1" }]);
  sol = solve(doc, built); assert.equal(sol.placedBy.i2, "M1"); assert.deepEqual(sol.problems, []);
  const got = sol.placements.i2, shown = matMul(hit.target.delta, P.top);      // the preview : the move that makes them meet, from where it stood
  for (let i = 0; i < 16; i++) assert.ok(near(got[i], shown[i], 1e-6), `the solver puts it where the preview showed (${i})`);
  // the holes meet the tapped holes of the parent
  const mine = built.IMP.interfaces.find((i) => i.id === bolt.id), theirs = built.BASE.interfaces[0];
  const W = (M, pts) => pts.map((p) => matPoint(M, p).map((x) => Math.round(x * 100) / 100));
  const a = W(sol.placements.i2, holesAt(mine)), b = W(sol.placements.i1, holesAt(theirs));
  for (const p of a) assert.ok(b.some((q) => near(p[0], q[0], 0.01) && near(p[1], q[1], 0.01) && near(p[2], q[2], 0.01)), `hole ${p} meets a tapped hole`);
  // held : it stays until the hand is REACH px away, then lets go
  const H = dragPlan(doc, doc, sol, built, "i2"); assert.equal(H.hold, "M1"); assert.deepEqual(H.detach, ["M1"]); assert.equal(H.targets.length, 1, "its own joint is a target again, once let go");
  assert.equal(letsGo(REACH - 1, 0), false); assert.equal(letsGo(REACH, 5), true);
  assert.equal(applySnap(JSON.parse(JSON.stringify(doc)), H, H.targets[0]), null, "dropped back on the joint that held it : nothing changes");
  applyDrop(doc, H, screenMove(80, 0, [1, 0, 0], [0, 1, 0], 1));
  assert.deepEqual(doc.mates, []); assert.equal(doc.rejected.length, 1, "set aside : the automatic mating does not bring it back"); assert.deepEqual(candidates(doc, built), []);
  sol = solve(doc, built); assert.deepEqual(sol.floating, ["i2"]); assert.ok(near(sol.placements.i2[12], got[12] + 80, 1e-6), "it stays where the hand left it");
  // snapped again on purpose : the joint comes back, under a new number, and is no longer set aside
  const Q = dragPlan(doc, doc, sol, built, "i2"); const m2 = applySnap(doc, Q, Q.targets[0]); assert.equal(m2.id, "M2"); assert.equal(doc.rejected, undefined);
});

test("a whole sub-assembly is dragged as one block : it snaps by the interface of one of its parts, and the joint names that part by its path", async () => {
  const { K, text } = await madeElsewhere(), found = readFeatures(K, K.stepRead(text)[0].shape); K.flush();
  const parent = { id: "BASE", name: "base", material: "AL6061-T6", stock: { form: "plate", L: 120, W: 100, t: 10 }, features: [],
    interfaces: [{ id: "T1", type: "bolt_pattern", side: "B", face: "+Z", at: [60, 50], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } } }] };
  const spec = imported(text), r = proposeInterfaces(found); applyProposals(spec, [{ p: r.proposals.find((p) => p.name === "4 × M4 clearance"), on: true }], null);
  const built = { BASE: buildPart(K, parent), IMP: buildPart(K, spec) }; K.flush();
  const SUB = { id: "SUB", name: "module", instances: [{ id: "j1", part: "IMP", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }], mates: [] };
  const A = { id: "A", instances: [{ id: "i1", part: "BASE", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "S", asm: "SUB", placement: { t: [300, 0, 0], r: [0, 0, 0] } }], mates: [] };
  const find = (id) => ({ SUB, A })[id] || null;
  let L = solveLevels(A, built, find); const P = dragPlan(A, L.asm, L.sol, built, "S");
  assert.deepEqual(P.moving, ["S~j1"]); assert.equal(P.targets.length, 1); assert.equal(P.targets[0].a.inst, "S~j1");
  applySnap(A, P, P.targets[0]); L = solveLevels(A, built, find);
  assert.equal(L.sol.placedBy.S, A.mates[0].id); const M = L.sol.placements["S~j1"], want = matMul(P.targets[0].delta, P.top);
  for (let i = 0; i < 16; i++) assert.ok(near(M[i], want[i], 1e-6), "the block is where the preview showed it");
});

test("the guide of a part made elsewhere : its material and its interfaces to enter, a proposal to confirm, no key needed for what was read", () => {
  const spec = { id: "IMP", name: "x", family: "purchased", process: "purchased", step: { text: "ISO-10303-21;" }, imported: { from: "step" }, features: [], interfaces: [] };
  const L = (s) => partIssues(s).map((x) => `${x.level}:${x.text}`);
  assert.ok(L(spec).some((t) => /^todo:.*matière à entrer/.test(t))); assert.ok(L(spec).some((t) => /^todo:.*interfaces à reconnaître/.test(t)));
  const withOne = { ...spec, material: "AL6061-T6", interfaces: [{ id: "IF1", type: "bolt_pattern", side: "A", face: "+Z", found: true, proposed: true, name: "4 × M4 clearance", params: {} }] };
  assert.ok(L(withOne).some((t) => /^warn:.*IF1.*proposée.*à confirmer/.test(t))); assert.ok(!L(withOne).some((t) => /^todo/.test(t)));
  delete withOne.interfaces[0].proposed; assert.ok(!L(withOne).some((t) => /sans clé/.test(t)), "read in a file : it mates by its geometry");
});

test("the screens : the Assembly takes a STEP and moves the chosen part by a grip ; the part studio reads its file ; the formats not read are said", () => {
  const asm = read("web/js/modules/assembly.js"), drag = read("web/js/modules/asm_drag.js"), panels = read("web/js/modules/part_panels.js"), imp = read("web/js/core/importer.js"), dlg = read("web/js/modules/step_import.js");
  assert.match(asm, /stepHook\.take = takeStep/); assert.match(asm, /if \(stepHook\.take === takeStep\) stepHook\.take = null/, "the hook leaves with the screen"); assert.match(asm, /mover\.draw\(\)/);
  assert.match(drag, /"move-grip"/); assert.match(drag, /letsGo\(dx, dy\)/); assert.match(drag, /Escape/); assert.match(drag, /e\.key === "Enter"/);
  assert.match(panels, /Reconnaître les interfaces/); assert.match(panels, /confirmInterface\(x, it\.id\)/); assert.match(dlg, /onOff\(x\.on/); assert.match(dlg, /data-step-material/);
  assert.match(imp, /if \(stepHook\.take\)/); assert.match(read("web/js/main.js"), /r\.placed\) return/);
  assert.match(read("web/js/cad/build.js"), /if \(!iface\.found\) runFeatures/); assert.match(read("web/js/cad/worker.js"), /recognize\(\{ key \}\)/);
  for (const k of ["igs", "stl", "x_t", "ipt", "sldprt"]) assert.match(imp, new RegExp(`"${k}"`));
});
