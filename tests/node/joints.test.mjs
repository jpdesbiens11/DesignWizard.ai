/* Joints : the bonded joint as an interface, the joint register with its permanent numbers, what holds each joint in the
   bill and in the routing, the snapped cover, and the interfaces that look outside the product. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { INTERFACE_TYPES, ADHESIVES, BOND_PREPS, compatible, interfaceSignature } from "../../web/js/cad/interfaces.js";
import { autoMate, solve, joints, jointsCsv, nextJoint, hardware, bom, freeInterfaces } from "../../web/js/core/assembly_logic.js";
import { assemblyPlan } from "../../web/js/core/asm_plan.js";
import { checkAssembly } from "../../web/js/analysis/dfa_rules.js";
import { synthesize } from "../../web/js/core/shop_intent.js";
import { anticipatedInterfaces } from "../../web/js/core/prompts.js";
import { hostOf } from "../../web/js/core/shop_mold_more.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const plate = (id, ifaces, t = 4) => ({ dw: "part/1", id, name: id, family: "plate", process: "cnc_milling", material: "AL6061-T6", features: [{ op: "box", size: [60, 30, t] }, { op: "interfaces" }], interfaces: ifaces });
const bondP = { w: 40, h: 16, gap: 0.2, adhesive: "epoxy", prep: "abrade" };
const text = (plan) => plan.phases.flatMap((p) => p.ops.map((o) => o.text)).join("\n");

test("a bonded joint is an interface : a land on each part, pips that keep the bond line, the adhesive in the bill", async () => {
  const K = await kernel(), T = INTERFACE_TYPES.bond;
  assert.deepEqual(T.compile("A", bondP, {}), []); const pips = T.compile("B", bondP, { pips: true })[0]; assert.equal(pips.op, "boss"); assert.equal(pips.h, 0.2); assert.equal(pips.lift, 0.2); assert.equal(pips.uv.length, 4, "four pips at the corners of the land");
  assert.equal(T.compile("B", { ...bondP, w: 30, h: 4 }, {})[0].uv.length, 3, "a narrow land : three in a row"); assert.equal(T.compile("B", { ...bondP, w: 3, h: 3 }, {})[0].uv.length, 1); assert.deepEqual(T.compile("B", { ...bondP, adhesive: "tape" }, {}), [], "a tape is its own gap"); assert.deepEqual(T.compile("B", bondP, { pips: false }), []);
  assert.deepEqual(T.hardware(bondP), [{ id: "ADH-EPOXY", name: "Colle époxy bicomposant", kind: "adhesive", adhesive: "epoxy", unit: "mL", qty: 0.17 }]); assert.deepEqual([T.hardware({ ...bondP, adhesive: "tape" })[0].unit, T.hardware({ ...bondP, adhesive: "tape" })[0].qty], ["cm²", 6.4]);
  assert.equal(interfaceSignature({ type: "bond", params: bondP }), "40x16@0.2|epoxy"); assert.deepEqual(compatible({ type: "bond", side: "A", key: "c1" }, { type: "bond", side: "B", key: "c1" }), { ok: true, same: true, by: "key" }); assert.equal(compatible({ type: "bond", side: "A", key: "c1" }, { type: "planar", side: "B", key: "c1" }).ok, false);
  for (const a of Object.values(ADHESIVES)) assert.ok(a.fr && a.gap[0] < a.gap[1] && a.shear > 0 && a.cure && a.hold && a.tool && !/[A-Z]{2,}\d/.test(a.fr), a.fr); assert.deepEqual(Object.keys(BOND_PREPS), ["degrease", "abrade", "primer", "plasma"]);
  // two plates bonded : the upper one rests on the pips of its own land, 0.2 mm above the lower one
  const base = plate("BASE", [{ id: "IF1", type: "bond", key: "colle1", name: "Collage du capot", side: "A", face: "+Z", at: [30, 15], params: bondP }]), cap = plate("CAP", [{ id: "IF1", type: "bond", key: "colle1", name: "Collage du capot", side: "B", face: "-Z", at: [30, 15], params: bondP }], 3);
  const built = { BASE: buildPart(K, base), CAP: buildPart(K, cap) }; for (const b of Object.values(built)) assert.equal(b.log.filter((l) => l.level === "error").length, 0);
  assert.equal(built.CAP.facts.bosses.length, 4); assert.ok(Math.abs(built.CAP.bbox[2] + 0.2) < 1e-6, "the pips stand 0.2 mm proud of the land"); assert.ok(Math.abs(built.CAP.interfaces[0].frame.o[2] + 0.2) < 1e-6, "the mating plane is on their tops"); assert.equal(built.BASE.facts.bosses.length, 0);
  const asm = { dw: "assembly/1", id: "A1", name: "Collé", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAP" }], mates: [] };
  assert.deepEqual(autoMate(asm, built).map((m) => m.id), ["M1"]); const sol = solve(asm, built), z = sol.placements.i2[14]; assert.ok(Math.abs(z - 4.2) < 1e-6, `the land of the cap is ${(z - 4).toFixed(2)} mm above the base : the bond line`);
  const reg = joints(asm, built); assert.deepEqual(reg.map((r) => [r.id, r.kind, r.type, r.key]), [["M1", "Collé", "bond", "colle1"]]); assert.match(reg[0].process, /film 0\.2 mm · 40 × 16 mm · epoxy · préparation abrade/); assert.deepEqual(reg[0].hardware, [{ name: "Colle époxy bicomposant", qty: 0.17, unit: "mL" }]);
  assert.equal(hardware(asm, built)[0].qty, 0.17); assert.ok(bom({ parts: [base, cap] }, asm, built).some((r) => r.kind === "hardware" && r.name === "Colle époxy bicomposant (mL)" && r.qty === 0.17));
  const plan = assemblyPlan(asm, { parts: [base, cap] }), all = text(plan);
  for (const w of [/Dégraisser, poncer au grain 180 à 320.*Collage du capot/, /Déposer 0,17 mL de colle époxy bicomposant en cordon continu sur la plage de CAP/, /jusqu'en butée sur les plots de calage : film de 0,2 mm/, /Maintenir : 30 min sous pinces\. Polymérisation : 24 h à 23 °C/]) assert.match(all, w);
  assert.ok(plan.hardware.some((h) => h.name === "Colle époxy bicomposant (mL)" && h.qty === 0.17)); assert.ok(plan.questions.some((q) => q.topic === "Collage" && /essai de cisaillement/.test(q.text)));
  const thick = JSON.parse(JSON.stringify([base, cap])); for (const p of thick) p.interfaces[0].params.gap = 1.5; assert.ok(assemblyPlan(asm, { parts: thick }).questions.some((q) => q.topic === "Collage" && /film de 1,5 mm.*plage usuelle est 0,1 à 0,3 mm/.test(q.text)), "a bond line out of the range of the adhesive is questioned");
  base.id = "BASE"; assert.deepEqual(fromDwiz(toDwiz(base)), base);
});

test("the joint register : a number for ever, the kind of joint, what holds it — a snapped cover says so", async () => {
  const K = await kernel(), housing = (closure) => synthesize({ name: "Boîtier", quantity: 2000, material: "PC-ABS", form: "molded", closure, envelope: { L: 110, W: 70, H: 28 }, interfaces: [] }, "H1").spec;
  const coverOf = (h) => synthesize({ name: "Couvercle", quantity: 2000, material: "PC-ABS", form: "molded", hosts: { H1: hostOf(h) }, interfaces: anticipatedInterfaces({ parts: [h], assemblies: [] }, ["H1"]).filter((a) => /couvercle/.test(a.iface.key)).map((a) => ({ from: a.from, type: a.iface.type, name: a.iface.name, partner: a.iface.partner, key: a.iface.key, side: a.iface.side, params: a.iface.params, where: "-Z" })) }, "C1").spec;
  for (const closure of ["screws", "clips"]) {
    const h = housing(closure), c = coverOf(h), built = { H1: buildPart(K, h), C1: buildPart(K, c) }, specs = { H1: h, C1: c }, asm = { dw: "assembly/1", id: "A2", name: "Boîtier fermé", instances: [{ id: "i1", part: "H1", fixed: true }, { id: "i2", part: "C1" }], mates: [] };
    const added = autoMate(asm, built), sol = solve(asm, built); assert.equal(added.length, closure === "screws" ? 2 : 1); assert.deepEqual(sol.floating, []); assert.deepEqual(sol.problems, []); assert.ok(Math.abs(sol.placements.i2[14] - h.params.H.value) < 1e-6, "the cover sits on the rim");
    const reg = joints(asm, built, specs), plan = assemblyPlan(asm, { parts: [h, c] }), all = text(plan);
    if (closure === "screws") { assert.deepEqual(reg.map((r) => r.kind).sort(), ["Boulonné", "En appui"]); assert.match(reg.find((r) => r.kind === "Boulonné").process, /^4 × M3$/); assert.ok(reg.find((r) => r.kind === "Boulonné").hardware.some((x) => /screw/i.test(x.name) && x.qty === 4)); assert.match(all, /Serrer en croix/); assert.ok(!/Encliqueter/.test(all)); }
    else { assert.deepEqual(reg.map((r) => [r.kind, r.process]), [["Encliqueté", "crochets dans les fenêtres"]]); assert.match(all, /Encliqueter Couvercle \(C1\) sur Boîtier \(H1\) : présenter les crochets en face des fenêtres, appuyer jusqu'au clic/); assert.ok(plan.questions.some((q) => q.topic === "Clips")); assert.ok(!/Serrer en croix/.test(all)); }
    const csv = jointsCsv(reg); assert.ok(csv.startsWith("﻿N°;Joint;Pièce A · interface;Pièce B · interface;Clé;Ce qui le tient;Procédé\r\n")); assert.equal(csv.trim().split("\r\n").length, reg.length + 1);
  }
  // a joint removed does not give its number back
  const a = { id: "A3", instances: [], mates: [{ id: "M1" }, { id: "M2" }], mseq: 2 }; assert.equal(nextJoint(a), 3); a.mates.pop(); assert.equal(nextJoint(a), 3, "M2 was used : the next one is M3"); assert.equal(nextJoint({ mates: [] }), 1); assert.equal(nextJoint({ mates: [{ id: "M7" }] }), 8);
});

test("an external interface is the contract with the outside : it is listed, and nobody looks for its partner", async () => {
  const K = await kernel(), bolt = (id, extra) => ({ id, type: "bolt_pattern", name: id === "IF1" ? "Fixation au mur" : "Fixation du module", key: id === "IF1" ? "mur" : "module", partner: id === "IF1" ? "Mur" : "Module", side: "A", face: "+Z", at: [30, 15], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 1, dx: id === "IF1" ? 40 : 20, dy: 0 } }, ...extra });
  const part = plate("EQ", [bolt("IF1", { external: true }), bolt("IF2", {})]), built = { EQ: buildPart(K, part) }, asm = { id: "A4", instances: [{ id: "i1", part: "EQ", fixed: true }], mates: [] };
  assert.equal(built.EQ.interfaces[0].external, true); assert.deepEqual(freeInterfaces(asm, built).map((f) => [f.iface.id, f.external]), [["IF1", true], ["IF2", false]]);
  const dfa = checkAssembly(asm, { parts: { EQ: { spec: part, built: built.EQ } }, hardware: [], placements: { i1: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } }), f = dfa.findings.find((x) => x.id === "DFA-02");
  assert.ok(f && /1 interface\(s\) sans liaison — IF2/.test(f.message) && !/IF1/.test(f.message), f && f.message);
  // the Shop carries the flag from the brief to the part, and a bonded land is one of its shapes
  const s = synthesize({ name: "Capot collé", material: "AL6061-T6", form: "plate", interfaces: [{ type: "bond", side: "B", name: "Plage de collage", where: "-Z", params: { w: 30, h: 12, gap: 0.2, adhesive: "acrylic", prep: "degrease" } }, { type: "bolt_pattern", side: "A", name: "Fixation au mur", where: "+Z", external: true, params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 1, dx: 40, dy: 0 } } }] }, "S1").spec;
  assert.equal(s.interfaces.find((i) => i.type === "bolt_pattern").external, true); assert.equal(s.interfaces.find((i) => i.type === "bond").external, undefined); const b = buildPart(K, s); assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.ok(b.facts.bosses.length >= 1, "its pips are in the part");
});
