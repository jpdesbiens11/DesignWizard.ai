/* Flexible circuits : a folded polyimide strip, a track per function, temperature probes and voltage taps along its way. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { blankFlex, flexPart, flexChecks, addSensor, fitSensor, allTracks, layTracks, trackAmps, SENSOR_KINDS, BEND_RATIO } from "../../web/js/core/flex.js";
import { locate } from "../../web/js/core/busbar.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { aiRead, aiDiff } from "../../web/js/core/ai_loop.js";
import { elementFor, codeSources } from "../../web/js/core/code_sources.js";

test("the tracks : those asked for, then one per sensor and a shared return ; laid side by side, each with what it can carry", () => {
  const def = blankFlex(); assert.deepEqual(allTracks(def).map((t) => [t.id, t.net]), [["P1", "5V"], ["P2", "GND"]]);
  const t1 = addSensor(def, "temp", { leg: 2, side: -1, s: 30, y: 6 }), v1 = addSensor(def, "volt", { leg: 2, side: -1, s: 45, y: 6 }, { net: "S1+" }), t2 = addSensor(def, "temp", { leg: 0, side: 1, s: 25, y: 6 });
  assert.deepEqual([t1.id, v1.id, t2.id], ["TS1", "VS1", "TS2"], "each kind has its own numbers");
  assert.deepEqual(allTracks(def).map((t) => t.net), ["5V", "GND", "TS1", "S1+", "TS2", "T-RET"], "a probe has its track, the probes share one return, a tap brings its potential");
  const lay = layTracks(def); assert.deepEqual(lay.rows.map((t) => t.y), [0.5, 1.3, 2.1, 2.7, 3.3, 3.9]); assert.equal(lay.used, 4.7);
  assert.ok(Math.abs(trackAmps(0.5, 0.035) - 0.024 * 20 ** 0.44 * ((0.5 / 0.0254) * (0.035 / 0.0254)) ** 0.725) < 1e-12 && trackAmps(0.5, 0.035) > 0.9 && trackAmps(0.5, 0.035) < 1.1, "IPC-2221, covered track, 20 K");
  const c = flexChecks(def); assert.equal(c.ok, true); assert.deepEqual([c.pins, c.pitch, c.length], [6, 1, 120]); assert.ok(c.rows.every((t) => t.ok)); assert.match(c.notes.map((n) => n.text).join(" "), /écran Isolation/);
  const notes = (d) => flexChecks(d).notes.map((n) => `${n.level}:${n.text}`).join(" | ");
  assert.match(notes({ ...def, r: 0.5 }), new RegExp(`bad:Rayon de pli de 0,5 mm pour 0,2 mm d'épaisseur : au moins ${BEND_RATIO[1]} × l'épaisseur = 1,2 mm`)); assert.match(notes({ ...def, layers: 2 }), /au moins 12 × l'épaisseur = 2,4 mm/);
  assert.match(notes({ ...def, W: 4 }), /bad:6 pistes prennent 4,7 mm : la bande n'en fait que 4/); assert.match(notes({ ...def, tracks: [{ net: "12V", fn: "Puissance", w: 0.3, i: 2 }] }), /check:P1 \(12V\) : 2 A pour environ 0,68 A admissibles/);
  assert.match(notes({ ...def, sensors: [{ ...v1, net: "" }] }), /check:VS1 : dites quel potentiel/);
  const far = fitSensor(def, { ...t1, s: 500, y: 50 }); assert.deepEqual([far.s, far.y], [58, 10], "kept on the flat part, clear of the bends, inside the width");
});

test("the part : a film, a copper body per track with its net, the sensors, the stiffened tail — and its interfaces", async () => {
  const K = await kernel(), def = blankFlex();
  addSensor(def, "temp", locate(def, [70, 6, 20], [0, 0, -1])); addSensor(def, "volt", locate(def, [85, 6, 20], [0, 0, -1]), { net: "S1+" }); addSensor(def, "volt", { leg: 1, side: 1, s: 10, y: 6 }, { net: "S2+" });
  const s = flexPart(def, "FX-1"), b = buildPart(K, s); assert.deepEqual(validateSpec(s).errors, []); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.deepEqual(b.bodies.map((x) => [x.name, x.material, x.net]), [["main", "PI-FILM", null], ["p1", "CU-C110", "5V"], ["p2", "CU-C110", "GND"], ["p3", "CU-C110", "TS1"], ["p4", "CU-C110", "S1+"], ["p5", "CU-C110", "S2+"], ["p6", "CU-C110", "T-RET"], ["raidisseur", "FR4", null], ["ts1", "GENERIC-COMPONENT", null], ["vs1", "CU-C110", "S1+"], ["vs2", "CU-C110", "S2+"]]);
  const film = b.bodies[0], p1 = b.bodies[1]; assert.ok(K.props(K.common(film.shape, p1.shape)).volume < 1e-6, "the track is in the film, not through it"); assert.ok(Math.abs(p1.volume - 0.5 * 0.035 * (120 - 2 * 2 * 2.1 + 2 * (Math.PI / 2) * 2.1)) < 0.05, "a track follows the strip round its bends");
  const I = Object.fromEntries(b.interfaces.map((i) => [i.id, i])); assert.deepEqual(Object.keys(I), ["IF1", "TS1", "VS1", "VS2"]);
  assert.deepEqual([I.TS1.type, I.TS1.face, I.TS1.frame.o], ["planar", "-Z", [70, 6, 20]]); assert.ok(b.bodies.find((x) => x.name === "ts1").bbox[2] >= 20.2 - 1e-6, "the probe touches by the flat face : its component stands on the back");
  assert.deepEqual([I.VS1.type, I.VS1.side, I.VS1.face, I.VS1.params.process], ["weld", "A", "-Z", "laser"]); assert.ok(Math.abs(I.VS1.frame.o[2] - 19.9) < 1e-6, "the tap welds by its own pad");
  assert.deepEqual([I.VS2.face, I.VS2.rot], ["-X", 90]); assert.match(I.IF1.name, /Queue dans le connecteur Hirose FH12/); assert.deepEqual([s.library.ref, s.library.poles], ["hirose-fh12", 6]);
  assert.ok(Math.abs(b.bbox[2] + 0.1) < 1e-6, "the stiffener brings the tail to 0,3 mm"); assert.equal(buildPart(K, flexPart({ ...def, tail: { mate: "solder", L: 6 } }, "FX-2")).bodies.some((x) => x.name === "raidisseur"), false);
  assert.deepEqual(fromDwiz(toDwiz(s)), s, "the definition travels in the part");
  const again = flexPart(def, "FX-1", { ...s, revision: "C", interfaces: [...s.interfaces, { id: "IF7", type: "planar", name: "Appui", side: "A", face: "-Z", at: [10, 6], params: { w: 5, h: 5 } }] }); assert.deepEqual([again.revision, again.interfaces.at(-1).id], ["C", "IF7"]);
  assert.equal(Object.keys(SENSOR_KINDS).length, 2);
  K.flush();
});

test("the round trip with an AI : the part goes out as text, the definition comes back, and what changed is listed before it is applied", () => {
  const def = blankFlex(), s = flexPart(def, "FX-1"), project = { dw: "project/1", id: "P", name: "Pack", parts: [s], assemblies: [], boards: [] };
  const e = elementFor(project, "#/flex/FX-1"); assert.deepEqual([e.kind, e.id], ["part", "FX-1"]); assert.deepEqual(codeSources(project, e).map((x) => x.key), ["fs", "dwiz"]);
  const text = toDwiz(s), back = aiRead(`Voici le circuit.\n\`\`\`dwiz\n${text.replace("net=GND", "net=0V")}\n\`\`\`\nJ'ai renommé GND.`); assert.ok(back.flex, "the answer carries the definition");
  const edited = JSON.parse(JSON.stringify(back.flex)); edited.tracks.push({ net: "CAN-H", fn: "Bus", w: 0.3, i: 0.05 }); edited.W = 14;
  const diff = aiDiff(def, edited); assert.ok(diff.length >= 2 && diff.some((d) => /W/.test(d.path)) && diff.some((d) => /tracks/.test(d.path)));
  const next = flexPart({ ...blankFlex(), ...edited }, "FX-1", s); assert.equal(next.flex.W, 14); assert.ok(Object.values(next.bodies).some((b) => b.net === "CAN-H"), "the part is written again from the definition that came back");
});
