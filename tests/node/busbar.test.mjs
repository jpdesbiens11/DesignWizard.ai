/* Busbars : a strip folded and punched, its terminals and its lamella contacts laid on its flat faces. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { blankBusbar, busbarPart, busbarChecks, legsOf, locate, onLeg, addContact, addTerminal, fit, stripProfile, KFACTOR } from "../../web/js/core/busbar.js";
import { solve, autoMate, joints } from "../../web/js/core/assembly_logic.js";
import { jointHealth } from "../../web/js/core/joint_health.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

test("a strip with two bends : its legs, its faces, its section with the bend radii — and a part that builds and passes the sheet rules", async () => {
  const K = await kernel(), def = blankBusbar(), legs = legsOf(def);
  assert.deepEqual(legs.map((g) => [g.d, g.face(1), g.level(1), g.face(-1), g.level(-1)]), [[[1, 0], "+Z", 3, "-Z", 0], [[0, 1], "-X", 58.5, "+X", 61.5], [[1, 0], "+Z", 33, "-Z", 30]]);
  assert.deepEqual([legs[1].from, legs[1].to], [6.5, 23.5], "the flat part of a leg stops before its bends");
  assert.deepEqual(stripProfile(def).poly, [[0, 0], [61.5, 0, 6], [61.5, 30, 3], [110, 30], [110, 33], [58.5, 33, 6], [58.5, 3, 3], [0, 3]], "inside radius r, outside radius r + t");
  const s = busbarPart(def, "BB-1"), b = buildPart(K, s), d = checkPart(s, b, { mesh: K.tessellate(b.bodies[0].shape) });
  assert.deepEqual(validateSpec(s).errors, []); assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.deepEqual(b.bbox.map((x) => Math.round(x * 100) / 100), [0, 0, 0, 110, 20, 33]);
  assert.deepEqual([s.family, s.process, s.elec.net, s.finish], ["busbar", "sheet_metal", "HV+", "Étamé"]); assert.deepEqual([d.summary.errors, d.summary.warnings], [0, 0], d.findings.filter((f) => f.severity !== "info").map((f) => f.message).join(" | "));
  const T1 = b.interfaces.find((i) => i.id === "T1"); assert.deepEqual([T1.type, T1.face, T1.frame.o], ["bolt_pattern", "+Z", [12, 10, 3]]);
  const c = busbarChecks(def); assert.deepEqual([c.S, c.J, c.length, c.bends], [60, 1.67, 140, 2]); assert.ok(Math.abs(c.flat - (140 - 2 * 2 * 4.5 + 2 * (Math.PI / 2) * (3 + KFACTOR * 3))) < 0.01, "developed length : straights plus bend allowances"); assert.ok(c.ok && !c.notes.length);
  assert.equal(busbarPart({ ...def, legs: [{ L: 80 }] }, "BB-2").process, "laser_cut", "a straight bar is only cut");
  assert.deepEqual(fromDwiz(toDwiz(s)), s, "the definition travels in the part");
  K.flush();
});

test("the rules of the trade : current density, bend radius, a leg too short, a hole too close", () => {
  const def = blankBusbar(), notes = (d) => busbarChecks(d).notes.map((n) => `${n.level}:${n.text}`).join(" | ");
  assert.match(notes({ ...def, I: 200 }), /check:3,33 A\/mm² : au-dessus du repère de 2,5/); assert.match(notes({ ...def, I: 400 }), /bad:6,67 A\/mm²/); assert.equal(busbarChecks({ ...def, I: 400 }).ok, false);
  assert.match(notes({ ...def, r: 1 }), /bad:Rayon de pliage intérieur de 1 mm pour 3 mm d'épaisseur : au moins 3 mm/); assert.match(notes({ ...def, legs: [{ L: 60 }, { L: 12, bend: 90 }, { L: 50, bend: -90 }] }), /bad:Branche 2 de 12 mm : trop courte entre ses plis/);
  assert.match(notes({ ...def, terminals: [{ id: "T1", leg: 0, s: 4, screw: "M6" }] }), /check:T1 \(M6\) : à moins de 1,5 × d d'un bout/); assert.match(notes({ ...def, material: "PC" }), /bad:.* ne conduit pas/);
  assert.match(notes({ ...def, W: 10 }), /check:T1 \(M6\) : largeur de 10 mm pour une vis de 6 mm/);
});

test("a contact is laid where the designer points : the leg, the face, the place — kept on the flat part ; it keeps its number for good", async () => {
  const K = await kernel(), def = blankBusbar();
  assert.deepEqual(locate(def, [80, 7, 33], [0, 0, 1]), { leg: 2, side: 1, s: 20, y: 7 }); assert.deepEqual(locate(def, [61.5, 5, 15], [1, 0, 0]), { leg: 1, side: -1, s: 13.5, y: 5 }); assert.deepEqual(locate(def, [20, 12, 0], [0, 0, -1]), { leg: 0, side: -1, s: 20, y: 12 });
  assert.equal(locate(def, [30, 0, 1.5], [0, -1, 0]), null, "an edge is not a place for a contact"); assert.equal(locate(def, [62, 7, 33], [0, 0, 1]).s, 6.5, "a point in a bend is brought back to the flat part");
  const c1 = addContact(def, locate(def, [80, 7, 33], [0, 0, 1])), c2 = addContact(def, locate(def, [61.5, 5, 15], [1, 0, 0]), { n: 4, w: 10, h: 6, duty: "signal", plating: "Au", force: 0.5, i: 0.02 });
  assert.deepEqual([c1.id, c2.id, c1.y, c2.s], ["CT1", "CT2", 7, 13.5]); def.contacts = def.contacts.filter((x) => x.id !== "CT1"); assert.equal(addContact(def, { leg: 0, side: 1, s: 30, y: 10 }).id, "CT3", "a number is never given twice");
  const far = fit(def, { ...c2, s: 100, y: 50 }); assert.deepEqual([far.s, far.y], [18.5, 17], "pushed too far, it stops at the end of the flat and at the edge");
  const t2 = addTerminal(def, { leg: 2, side: 1, s: 38, y: 3 }); assert.deepEqual([t2.id, t2.y], ["T2", 10], "a terminal sits in the middle of the width");
  const s = busbarPart(def, "BB-1"), b = buildPart(K, s); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  const I = Object.fromEntries(b.interfaces.map((i) => [i.id, i])); assert.deepEqual(Object.keys(I), ["T1", "T2", "CT2", "CT3"]);
  assert.deepEqual([I.CT2.type, I.CT2.side, I.CT2.face, I.CT2.frame.n, I.CT2.name], ["contact", "A", "+X", [1, 0, 0], "Contact à lamelles CT2 — HV+"]); assert.ok(Math.abs(I.CT2.frame.o[0] - 62.1) < 0.01 && Math.abs(I.CT2.frame.o[2] - 15) < 0.01, "on the +X face of the upright leg, on the tops of its lamellae");
  assert.deepEqual(onLeg(def, legsOf(def), 1, -1, 13.5, 5), { face: "+X", level: 61.5, at: [5, 15], along: 90 }); assert.equal(s.interfaces.find((i) => i.id === "CT2").rot, 90, "on an upright leg the contact still runs along the leg");
  assert.deepEqual(busbarChecks(def).notes, [], "gold, half a newton, a signal : nothing to say");
  /* written again from its definition, the part keeps what the definition does not own */
  const again = busbarPart(def, "BB-1", { ...s, revision: "B", characteristics: { "bbox:X": "sc" }, interfaces: [...s.interfaces, { id: "IF9", type: "planar", name: "Appui", side: "A", face: "-Z", at: [20, 10], params: { w: 10, h: 10 } }] });
  assert.deepEqual([again.revision, again.characteristics, again.interfaces.at(-1).id], ["B", { "bbox:X": "sc" }, "IF9"]);
  K.flush();
});

test("two bars pressed together through a lamella contact : same key, a healthy joint once a screw clamps them", async () => {
  const K = await kernel(), a = { ...blankBusbar(), name: "Barre A", legs: [{ L: 80 }], terminals: [{ id: "T1", leg: 0, s: 60, screw: "M6" }] }, b = JSON.parse(JSON.stringify(a)); b.name = "Barre B";
  addContact(a, { leg: 0, side: 1, s: 20, y: 10 }, { key: "ct_ab" }); addContact(b, { leg: 0, side: -1, s: 20, y: 10 }, { key: "ct_ab", role: "B" });
  a.terminals[0].key = "vis_ab"; b.terminals[0].key = "vis_ab";
  const sa = busbarPart(a, "BA"), sb = busbarPart(b, "BB"); sb.interfaces.find((i) => i.id === "T1").side = "B"; sb.interfaces.find((i) => i.id === "T1").face = "-Z"; sb.interfaces.find((i) => i.id === "T1").level = 0; sb.interfaces.find((i) => i.id === "T1").opts = { thread: "clearance" };
  const built = { BA: buildPart(K, sa), BB: buildPart(K, sb) }, asm = { id: "A", instances: [{ id: "i1", part: "BA", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "BB", placement: { t: [0, 0, 0], r: [0, 0, 0] } }], mates: [] };
  const added = autoMate(asm, built); assert.equal(added.length, 2); const sol = solve(asm, built), reg = joints(asm, built, { BA: sa, BB: sb });
  assert.ok(reg.some((r) => r.kind === "Contact à pression") && reg.some((r) => r.kind === "Boulonné"));
  const h = jointHealth(asm, built, { BA: sa, BB: sb }, sol).find((x) => x.id === asm.mates.find((m) => m.a.iface === "CT1" || m.b.iface === "CT1").id);
  assert.doesNotMatch(h.notes.join(" "), /demande une vis ou un clip/, "the screw next to it clamps the contact");
  K.flush();
});
