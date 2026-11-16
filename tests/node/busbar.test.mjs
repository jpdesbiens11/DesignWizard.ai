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
  assert.deepEqual([I.CT2.type, I.CT2.side, I.CT2.face, I.CT2.frame.n, I.CT2.name], ["contact", "A", "+X", [1, 0, 0], "Contact à bossages CT2 — HV+"]); assert.ok(Math.abs(I.CT2.frame.o[0] - 62) < 0.01 && Math.abs(I.CT2.frame.o[2] - 15) < 0.01, "on the +X face of the upright leg, on the tops of its bosses (0,5 mm)");
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
  assert.ok(reg.some((r) => r.kind === "Pressure contact") && reg.some((r) => r.kind === "Bolted"));
  const h = jointHealth(asm, built, { BA: sa, BB: sb }, sol).find((x) => x.id === asm.mates.find((m) => m.a.iface === "CT1" || m.b.iface === "CT1").id);
  assert.doesNotMatch(h.notes.join(" "), /demande une vis ou un clip/, "the screw next to it clamps the contact");
  K.flush();
});

import { blankLaminate, blankLamFlex, lamFlexTracks, laminatePart, laminateChecks, thermalPadPart, PAPER_THICKNESS } from "../../web/js/core/busbar_lam.js";

test("an insulated busbar wears a sleeve of its own body, open by a window at each terminal and each contact", async () => {
  const K = await kernel(), def = blankBusbar(); addContact(def, { leg: 2, side: 1, s: 25, y: 10 }); def.insulation = { material: "EPOXY", t: 0.3 };
  const s = busbarPart(def, "BB-I"), b = buildPart(K, s); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.deepEqual(b.bodies.map((x) => [x.name, x.material, x.conductive, x.net]), [["main", "CU-C110", true, "HV+"], ["isolant", "EPOXY", false, null]]);
  const iso = b.bodies.find((x) => x.name === "isolant"), main = b.bodies.find((x) => x.name === "main"); assert.ok(K.props(K.common(iso.shape, main.shape)).volume < 0.001, "the sleeve is around the metal, not in it");
  assert.deepEqual(b.bbox.slice(0, 3).map((x) => Math.round(x * 100) / 100), [-0.3, -0.3, -0.3], "it covers the edges and the ends too");
  assert.equal(s.features.filter((f) => /^fen_/.test(f.id)).length, 3, "two windows for the screw (head side and lug side), one for the contact"); assert.match(s.notes.join(" "), /Isolant : epoxy powder coating de 0,3 mm, ouvert par une fenêtre/);
  const bare = buildPart(K, busbarPart({ ...def, insulation: null }, "BB-N")); assert.equal(bare.bodies.length, 1);
  assert.ok(iso.volume < 0.3 * 2 * (110 + 30) * 20 * 1.3 && iso.volume > 1000, `a thin skin : ${iso.volume.toFixed(0)} mm³`);
  K.flush();
});

test("a laminated busbar : conductors of opposite potentials, aramid paper between, a film outside — one body per layer, tabs side by side", async () => {
  const K = await kernel(), def = blankLaminate(), s = laminatePart(def, "LAM-1"), b = buildPart(K, s);
  assert.deepEqual(validateSpec(s).errors, []); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.deepEqual(b.bodies.map((x) => [x.name, x.material, x.net]).sort(), [["c2", "CU-C110", "HV-"], ["enveloppe", "PET-FILM", null], ["main", "CU-C110", "HV+"], ["p1", "NOMEX-410", null]]);
  const z = (name) => { const x = b.bodies.find((q) => q.name === name).bbox; return [Math.round(x[2] * 100) / 100, Math.round(x[5] * 100) / 100]; };
  assert.deepEqual([z("main"), z("p1"), z("c2")], [[0.19, 1.69], [1.69, 1.94], [1.94, 3.44]], "film, conductor, paper, conductor, film"); assert.ok(Math.abs(b.bbox[5] - 3.63) < 0.01);
  const cu = b.bodies.find((q) => q.name === "main"), cu2 = b.bodies.find((q) => q.name === "c2"), paper = b.bodies.find((q) => q.name === "p1");
  assert.ok(K.props(K.common(cu.shape, cu2.shape)).volume < 1e-6 && K.props(K.common(cu.shape, paper.shape)).volume < 1e-6, "no layer enters another");
  assert.ok(paper.bbox[0] === -4 && paper.bbox[1] === -4 && paper.bbox[3] === 124, "the paper overhangs the conductors by 4 mm all round"); assert.ok(cu.bbox[0] === -18 && cu.bbox[3] === 138, "the tabs come out past the insulation");
  assert.deepEqual(s.interfaces.map((i) => [i.id, i.body || "main", i.level]), [["T1a", "main", 1.69], ["T1b", "main", 1.69], ["T2a", "c2", 3.44], ["T2b", "c2", 3.44]]);
  assert.deepEqual(s.interfaces.map((i) => i.at[1]), [8, 8, 32, 32], "each conductor has its own tab, side by side across the width");
  const c = laminateChecks(def); assert.deepEqual([c.tabW, c.creep, c.ok], [16, 8.25, true]); assert.ok(c.withstand > c.test, "0,25 mm of aramid paper holds the dielectric test of 800 V");
  assert.match(laminateChecks({ ...def, paper: { ...def.paper, t: 0.05 } }).notes[0].text, /il tient environ 1,35 kV, pour un essai diélectrique de 2 U \+ 1000 V = 2,6 kV/);
  assert.match(laminateChecks({ ...def, W: 20 }).notes.map((n) => n.text).join(" "), /Pattes de 6 mm de large pour une vis M6/); assert.ok(PAPER_THICKNESS.includes(0.25));
  assert.deepEqual(fromDwiz(toDwiz(s)), s);
  K.flush();
});

test("a laminate may carry its own measuring circuit : a flexible circuit in a slot of the paper, a tap on each plate, a probe at the core, a tail out by the side", async () => {
  const K = await kernel(), def = { ...blankLaminate(), flex: blankLamFlex() }, s = laminatePart(def, "LAM-2"), b = buildPart(K, s), body = (n) => b.bodies.find((q) => q.name === n), r = (x) => Math.round(x * 1000) / 1000, vol = (q) => K.props(q.shape).volume;
  assert.deepEqual(validateSpec(s).errors, []); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.deepEqual(b.bodies.filter((x) => x.net).map((x) => [x.name, x.net]), [["main", "HV+"], ["c2", "HV-"], ["piste1", "HV+"], ["vs1", "HV+"], ["piste2", "TS1"], ["piste3", "T-RET"], ["piste4", "HV-"], ["vs2", "HV-"]], "each track and each tap is a conductor with its potential : the isolation analysis reads them");
  for (let i = 0; i < b.bodies.length; i++) for (let j = i + 1; j < b.bodies.length; j++) assert.ok(vol({ shape: K.common(b.bodies[i].shape, b.bodies[j].shape) }) < 1e-6, `${b.bodies[i].name} enters ${b.bodies[j].name}`);
  /* the film lies on the lower plate, inside the thickness of the paper, which gives it a slot */
  const flex = body("flex"), paper = body("p1"), plain = buildPart(K, laminatePart(blankLaminate(), "LAM-1"));
  assert.deepEqual([r(flex.bbox[2]), r(flex.bbox[5]), r(paper.bbox[5])], [1.69, 1.89, 1.94]); assert.ok(Math.abs(vol(plain.bodies.find((q) => q.name === "p1")) - vol(paper) - 10.4 * 34.2 * 0.25) < 0.01, "the slot : the strip and 0,2 mm round it, out to the edge of the paper");
  assert.ok(Math.abs(b.bbox[5] - plain.bbox[5]) < 1e-6, "the stack is not one micron thicker");
  /* a tap touches its plate ; the probe sits in a pocket of the plate above ; the tail leaves past the insulation */
  assert.deepEqual([r(body("vs1").bbox[2]), r(body("main").bbox[5]), r(body("vs2").bbox[5]), r(body("c2").bbox[2])], [1.69, 1.69, 1.94, 1.94]);
  assert.ok(Math.abs(vol(plain.bodies.find((q) => q.name === "c2")) - vol(body("c2")) - 2.6 * 1.8 * 0.6) < 0.01); assert.deepEqual([r(body("ts1").bbox[2]), r(body("ts1").bbox[5])], [1.89, 2.39]);
  assert.deepEqual([flex.bbox[1], flex.bbox[4], paper.bbox[4]], [10, 64, 44], "30 mm between the plates, then out by the +Y side : 4 mm of overhang and 20 mm of tail");
  const fq = s.interfaces.find((i) => i.id === "FQ"); assert.deepEqual([fq.type, fq.body, fq.level, fq.at], ["planar", "flex", 1.89, ["L/2", "W + e + 17"]]); assert.match(fq.name, /Queue du circuit de mesure — Hirose FH12/);
  assert.deepEqual(lamFlexTracks(def).rows.map((t) => [t.id, t.net, t.x]), [["VS1", "HV+", 0.5], ["TS1", "TS1", 1.3], ["T-RET", "T-RET", 2.1], ["VS2", "HV-", 9.2]], "the two potentials of the stack at the two edges of the strip");
  /* what it is worth, and what stops it */
  const c = laminateChecks(def), text = (d) => laminateChecks(d).notes.map((n) => n.text).join(" "); assert.deepEqual([c.ok, c.flex.pins, c.flex.cover, c.flex.hold > c.test], [true, 4, 0.083, true]);
  assert.match(text({ ...def, paper: { ...def.paper, t: 0.13 } }), /Circuit de mesure de 0,2 mm dans un papier de 0,13 mm : il ferait une bosse dans l'empilage — passer le papier à 0,25 mm au moins/);
  assert.match(text({ ...def, layers: def.layers.map((l) => ({ ...l, t: 1 })) }), /lamage de 0,6 mm de la plaque du dessus, qui n'a que 1 mm/); assert.match(text({ ...def, flex: { ...def.flex, after: 2 } }), /un dessous et un dessus/);
  assert.match(text({ ...def, flex: { ...def.flex, W: 3 } }), /4 pistes prennent 3,7 mm : le circuit de mesure n'en fait que 3/); assert.match(text({ ...def, U: 6000 }), /Couverture du circuit de mesure : 82,5 µm de polyimide .* environ 12,38 kV pour un essai de 13 kV/);
  assert.match(text(def), /prévoir une résistance ou un fusible en série sur chaque prise/); assert.equal(laminateChecks(blankLaminate()).flex, null);
  /* three plates, the circuit between the upper two, no probe : two tracks, nothing asked of the plate above */
  const three = { ...blankLaminate(), W: 60, layers: [{ net: "HV+", t: 1.5 }, { net: "MID", t: 1.5 }, { net: "HV-", t: 1.5 }], flex: { ...blankLamFlex(), after: 2, ntc: 0 } }, s3 = laminatePart(three, "LAM-3"), b3 = buildPart(K, s3);
  assert.equal(b3.log.filter((l) => l.level === "error").length, 0); assert.deepEqual(lamFlexTracks(three).rows.map((t) => t.net), ["MID", "HV-"]); assert.equal(b3.bodies.some((q) => q.name === "ts1"), false);
  assert.ok(b3.bodies.find((q) => q.name === "flex").bbox[2] > b3.bodies.find((q) => q.name === "c2").bbox[5] - 1e-6, "it lies on the second plate");
  assert.match(s.notes[0], /Circuit de mesure entre HV\+ et HV- : polyimide de 0,2 mm dans une fente du papier/); assert.match(s.function, /il mesure lui-même ses tensions et sa température/);
  const d = checkPart(s, b, { mesh: K.tessellate(b.bodies[0].shape) }); assert.equal(d.summary.errors, 0, d.findings.filter((f) => f.severity === "error").map((f) => f.message).join(" | "));
  assert.deepEqual(fromDwiz(toDwiz(s)), s);
  K.flush();
});

test("a thermal pad is drawn squeezed, with its thermal resistance", async () => {
  const K = await kernel(), s = thermalPadPart({ id: "PAD-1", L: 50, W: 40, t: 1, squeeze: 0.2 }), b = buildPart(K, s);
  assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.ok(Math.abs(b.bbox[5] - 0.8) < 1e-6); assert.equal(s.thermal.R, 0.13, "0,8 mm / (3 W/m·K × 2000 mm²)");
  assert.deepEqual(s.interfaces.map((i) => [i.type, i.face]), [["planar", "-Z"], ["planar", "+Z"]]); assert.match(s.function, /≈ 0,13 K\/W une fois écrasé à 0,8 mm/);
  K.flush();
});
