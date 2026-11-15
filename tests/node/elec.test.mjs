/* The electrical library : connector families and cells as parts ; welded, wire-bonded and lamella-contact joints. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { CONNECTORS, CELLS, ELEC_STANDARDS, CONNECTOR_KINDS, connector, cell, pickConnectors } from "../../web/js/cad/elec_library.js";
import { connectorPart, cellPart, connectorEnvelope, poleNets } from "../../web/js/core/elec_parts.js";
import { ELEC_INTERFACES, WELD_PROCESSES, PLATINGS, CONTACT_BASES, contactEstimate, weldEstimate, elecProcess } from "../../web/js/cad/interfaces_elec.js";
import { INTERFACE_TYPES, compatible, interfaceSignature } from "../../web/js/cad/interfaces.js";
import { solve, autoMate, joints, hardware } from "../../web/js/core/assembly_logic.js";
import { jointHealth } from "../../web/js/core/joint_health.js";
import { material } from "../../web/js/cad/materials.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

test("the library names real families : each with its maker, its current, how it was checked — and no duplicate", () => {
  assert.ok(CONNECTORS.length >= 45); assert.equal(new Set(CONNECTORS.map((c) => c.id)).size, CONNECTORS.length);
  for (const c of CONNECTORS) { assert.ok(c.maker && c.series && CONNECTOR_KINDS[c.kind] && (c.domain === "lv" || c.domain === "hv"), c.id); assert.ok(c.a > 0 && (c.v === null || c.v > 0), `${c.id} : current and voltage`); assert.ok(["read", "excerpt"].includes(c.seen), `${c.id} says how it was checked`); assert.ok(c.use, c.id); }
  assert.deepEqual([connector("te-hva280").a, connector("te-hva280").v, connector("te-hva280").hvil], [40, 600, true]); assert.deepEqual([connector("amass-xt60").a, connector("amass-xt60").v], [35, 80]); assert.equal(connector("staubli-mc4").v, 1000);
  const hv = pickConnectors({ domain: "hv", amps: 200, volts: 800, hvil: true }); assert.ok(hv.length >= 4 && hv.every((c) => c.a >= 200 && c.v >= 800 && c.hvil)); assert.ok(hv[0].a <= hv.at(-1).a, "the smallest that does the job first");
  assert.ok(pickConnectors({ domain: "lv", sealed: true }).every((c) => c.sealed)); assert.ok(ELEC_STANDARDS.some((s) => s.id === "USCAR-37") && ELEC_STANDARDS.some((s) => s.id === "IEC 60664-1"));
  assert.deepEqual(CELLS.map((c) => [c.id, c.iec, c.d, c.L]), [["18650", "INR19/66", 18.6, 65.2], ["21700", "INR22/71", 21.7, 70.8]]);
});

test("a high-voltage connector becomes a part : flange, body, one conductor per pole with its net, a wall interface and an external one", async () => {
  const K = await kernel(), c = connector("te-hvp800"), s = connectorPart(c, { id: "CN-HV", poles: 2, net: "HV", partner: "Onduleur" });
  assert.deepEqual(validateSpec(s).errors, []); assert.equal(s.process, "purchased"); assert.deepEqual(poleNets(c, 2, "HV"), ["HV+", "HV-"]); assert.deepEqual(poleNets(connector("jst-xh"), 6), ["LV"]);
  assert.deepEqual(Object.values(s.bodies).map((b) => [b.net, b.kind, b.material]), [["HV+", "conductor", "CU-C110"], ["HV-", "conductor", "CU-C110"]]);
  assert.deepEqual(s.interfaces.map((i) => [i.type, i.side, i.face, !!i.external]), [["cutout", "B", "-Y", false], ["planar", "A", "-Y", true]], "the connection leaves the product : external");
  assert.deepEqual([s.library.ref, s.library.a, s.library.v, s.library.hvil], ["te-hvp800", 250, 1000, true]); assert.match(s.notes.join(" "), /TE Connectivity AMP\+ HVP 800 — 250 A par contact, 1000 V/); assert.match(s.notes.join(" "), /Enveloppe indicative/);
  const b = buildPart(K, s); assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.equal(b.bodies.length, 3);
  assert.deepEqual(b.bodies.map((x) => [x.name, x.conductive, x.net]), [["main", false, null], ["pole1", true, "HV+"], ["pole2", true, "HV-"]]);
  const E = connectorEnvelope(c, 2); assert.ok(Math.abs((b.bbox[3] - b.bbox[0]) - (E.L + 2 * s.params.e.value)) < 0.01 && b.bbox[1] < -5, "the flange is wider than the body, the nose passes the wall");
  assert.deepEqual(fromDwiz(toDwiz(s)), s, "the part and its library reference survive the .dwiz file");
  const lv = connectorPart(connector("jst-xh"), { id: "CN-LV", poles: 6 }), bl = buildPart(K, lv); assert.equal(bl.log.filter((l) => l.level === "error").length, 0);
  assert.deepEqual(lv.interfaces.map((i) => [i.face, !!i.external]), [["-Z", false], ["+Z", false]]); assert.ok(Math.abs((bl.bbox[3] - bl.bbox[0]) - 17.5) < 0.01, "2,5 mm pitch × (6 + 1)");
  K.flush();
});

test("a cell is a part of its largest published size, with two welded terminals ; a tab welds on it and the joint is in the register", async () => {
  const K = await kernel(), s = cellPart(cell("21700"), { id: "CELL-1", net: "S1" }), b = buildPart(K, s);
  assert.deepEqual(validateSpec(s).errors, []); assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.ok(Math.abs((b.bbox[3] - b.bbox[0]) - 21.7) < 0.01 && Math.abs((b.bbox[5] - b.bbox[2]) - 70.8) < 0.01); assert.ok(b.mass > 65 && b.mass < 73, `mass ${b.mass.toFixed(1)} g, close to the 69–70 g published`);
  assert.equal(material("LI-ION-CELL").conductive, true); assert.deepEqual(s.interfaces.map((i) => [i.type, i.side, i.face]), [["weld", "B", "+Z"], ["weld", "B", "-Z"]]);
  const P = (v) => ({ value: v, min: 1, max: 200, step: 1, unit: "mm", label: "x" }), top = s.interfaces[0];
  const tab = { dw: "part/1", id: "TAB", name: "Languette", family: "busbar", process: "laser_cut", material: "CU-C110", elec: { kind: "conductor", net: "S1" }, params: { L: P(30), W: P(8), t: { ...P(0.3), min: 0.1 } }, features: [{ op: "box", id: "b", size: ["L", "W", "t"] }, { op: "interfaces" }],
    interfaces: [{ id: "IF1", type: "weld", name: "Soudure sur la cellule", key: top.key, side: "A", face: "-Z", at: [5, 4], params: top.params }] };
  const built = { "CELL-1": b, TAB: buildPart(K, tab) }, asm = { id: "A", instances: [{ id: "i1", part: "CELL-1", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "TAB", placement: { t: [0, 0, 0], r: [0, 0, 0] } }], mates: [] };
  assert.equal(autoMate(asm, built).length, 1); assert.equal(solve(asm, built).problems.length, 0);
  const reg = joints(asm, built, { "CELL-1": s, TAB: tab }); assert.equal(reg[0].kind, "Soudé"); assert.match(reg[0].process, /Soudure laser · 1 cordon · zone 7,6 × 7,6 mm/);
  assert.equal(jointHealth(asm, built, { "CELL-1": s, TAB: tab }, solve(asm, built))[0].state, "ok");
  assert.equal(jointHealth(asm, built, { "CELL-1": s, TAB: { ...tab, material: "PC" } }, solve(asm, built))[0].state, "broken", "an electrical joint needs two conductors");
  K.flush();
});

test("a wire-bonded joint : the wires are in the bill of materials and their fusing current is estimated", () => {
  const p = { ...ELEC_INTERFACES.weld.params, process: "wirebond", n: 3, wire: 0.3, wireMat: "Al", i: 10 }, e = weldEstimate(p);
  assert.ok(Math.abs(e.fuse - 59.2 * 0.3 ** 1.5) < 1e-9 && Math.abs(e.fuseTotal - 3 * e.fuse) < 1e-9, "Preece : I = K · d^1,5 per wire"); assert.equal(e.notes.length, 0);
  assert.match(weldEstimate({ ...p, i: 20 }).notes[0], /plus de fils, ou un fil plus gros/); assert.match(weldEstimate({ process: "resistance", t: 0.5 }).notes[0], /jusqu'à 0,3 mm/);
  assert.deepEqual(ELEC_INTERFACES.weld.hardware(p), [{ id: "WIRE-AL-300", name: "Fil de câblage en aluminium Ø 0,3 mm", qty: 3, kind: "wire" }]); assert.deepEqual(ELEC_INTERFACES.weld.hardware({ ...p, process: "laser" }), []);
  assert.match(elecProcess("weld", p), /Câblage par fils \(wirebonding\) · 3 fils Ø 0,3 mm en aluminium · fusion ≈ 29,2 A/); assert.equal(Object.keys(WELD_PROCESSES).length, 4);
  assert.equal(INTERFACE_TYPES.weld, ELEC_INTERFACES.weld); assert.equal(ELEC_INTERFACES.weld.compile("A", p, {}).length, 0);
});

test("a lamella contact between two flat lands : bumps on side A hold the gap, the estimate follows force, plating and count, and it wants a clamp", async () => {
  const K = await kernel(), T = ELEC_INTERFACES.contact, p = { ...T.params };
  const e = contactEstimate(p); assert.ok(e.rPoint > 0.2 && e.rPoint < 0.5 && Math.abs(e.rTotal - e.rPoint / 8) < 1e-9, `silver, 2 N : ${e.rPoint.toFixed(2)} mΩ per point`); assert.ok(e.iMax > 150 && e.ok);
  assert.ok(contactEstimate({ ...p, force: 8 }).rPoint < e.rPoint, "more force, less resistance"); assert.ok(contactEstimate({ ...p, plating: "Sn" }).iMax < e.iMax, "tin carries less than silver");
  assert.match(contactEstimate({ ...p, duty: "signal", i: 0.01 }).notes[0], /or dur sur nickel conseillé/); assert.equal(contactEstimate({ ...p, plating: "Au", duty: "signal", force: 0.5, i: 0.01 }).ok, true);
  assert.match(contactEstimate({ ...p, n: 2, i: 400 }).notes[0], /400 A demandés pour environ/); assert.ok(PLATINGS.Ag.std.includes("ASTM B700") && CONTACT_BASES.CuBe.std === "ASTM B194");
  const bumps = T.compile("A", p, {}); assert.deepEqual([bumps[0].op, bumps[0].uv.length, bumps[0].h, bumps[0].lift], ["boss", 8, 0.6, 0.6]); assert.equal(T.compile("B", p, {}).length, 0, "the land stays flat");
  assert.equal(T.hardware(p, { band: "insert" })[0].kind, "contact"); assert.equal(T.hardware(p, { band: "integral" }).length, 0);
  const Pm = (v) => ({ value: v, min: 1, max: 400, step: 1, unit: "mm", label: "x" }), bar = (id, side, extra = []) => ({ dw: "part/1", id, name: id, family: "busbar", process: "laser_cut", material: "CU-C110", elec: { kind: "conductor", net: "HV+" }, params: { L: Pm(80), W: Pm(20), t: Pm(3) },
    features: [{ op: "box", id: "b", size: ["L", "W", "t"] }, { op: "interfaces" }], interfaces: [{ id: "CT1", type: "contact", name: "Contact à lamelles CT1", key: "ct1", side, face: side === "A" ? "+Z" : "-Z", at: [15, 10], params: p }, ...extra] });
  const a = bar("BAR-A", "A"), b = bar("BAR-B", "B"), built = { "BAR-A": buildPart(K, a), "BAR-B": buildPart(K, b) };
  assert.equal(built["BAR-A"].log.filter((l) => l.level === "error").length, 0); assert.ok(Math.abs(built["BAR-A"].bbox[5] - 3.6) < 0.01, "the lamellae stand 0,6 mm proud of the bar");
  assert.equal(compatible(built["BAR-A"].interfaces[0], built["BAR-B"].interfaces[0]).ok, true); assert.equal(interfaceSignature(a.interfaces[0]), "20x8|n8|Ag");
  const asm = { id: "A", instances: [{ id: "i1", part: "BAR-B", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "BAR-A", placement: { t: [0, 0, 0], r: [0, 0, 0] } }], mates: [] };
  autoMate(asm, built); const sol = solve(asm, built), specs = { "BAR-A": a, "BAR-B": b }, reg = joints(asm, built, specs);
  assert.equal(reg[0].kind, "Contact à pression"); assert.match(reg[0].process, /8 points · argent · 2 N par point/); assert.ok(hardware(asm, built).some((h) => h.kind === "contact"));
  const h = jointHealth(asm, built, specs, sol)[0]; assert.equal(h.state, "check"); assert.match(h.notes.join(" "), /demande une vis ou un clip/);
  const common = K.props(K.common(built["BAR-B"].bodies[0].shape, K.transform(built["BAR-A"].bodies[0].shape, sol.placements.i2))).volume; assert.ok(common < 0.01, "the bars do not cross : the gap is held by the lamellae");
  K.flush();
});
