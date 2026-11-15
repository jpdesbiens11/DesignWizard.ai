/* The Shop companion for an extruded profile : drawn around what slides, rests or fits in it, with the extruder's rules — aluminium and plastic. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { synthesize, recommend } from "../../web/js/core/shop_intent.js";
import { EXTRUSION_RULES, extrusionProcess } from "../../web/js/core/shop_extrusion.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { solve, autoMate, joints } from "../../web/js/core/assembly_logic.js";
import { assemblyHealth } from "../../web/js/core/joint_health.js";
import { routing } from "../../web/js/cad/shop.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const val = (spec, k) => spec.params[k].value;
const made = (K, spec) => { const b = buildPart(K, spec), mesh = K.tessellate(b.bodies[0].shape); return { b, d: checkPart(spec, b, { mesh }) }; };
const twoCards = { name: "Boîtier du contrôleur", material: "AL6063-T5", form: "profile", length: 140, contents: [{ name: "Carte de puissance", w: 100, h: 18, hold: "rail", edge: 1.6, below: 4 }, { name: "Carte de commande", w: 100, h: 12, hold: "rail", edge: 1.6, below: 3 }],
  interfaces: [{ type: "planar", side: "A", name: "Appui au châssis", where: "-Z", external: true, params: { w: 40, h: 40 } }] };

test("an aluminium profile draws itself around two sliding boards : one wall, grooves with their clearance, screw channels, no warning", async () => {
  const K = await kernel(), r = synthesize(twoCards, "PN-0300"), s = r.spec, R = EXTRUSION_RULES.extrusion_al;
  assert.equal(r.form, "profile"); assert.equal(s.family, "extrusion"); assert.equal(s.process, "extrusion_al"); assert.deepEqual(validateSpec(s).errors, []);
  assert.equal(val(s, "t"), R.wall(Math.hypot(val(s, "Wc") + 4, val(s, "Hc") + 4)), "the wall follows the circumscribed circle");
  assert.ok(val(s, "Wc") >= 100 + 2 * R.side, "the boards fit across with their clearance");
  const p = s.extrusion.profile; assert.equal(p.gen, "fitted"); assert.equal(p.rails.length, 2); assert.ok(p.ports && p.ports.d === R.port.M3);
  for (const g of p.rails) { assert.equal(g.g, 1.9, "groove = edge + twice the clearance"); assert.ok(g.d / g.g <= R.groove, "a groove no deeper than three times its width"); }
  const rails = s.interfaces.filter((i) => i.type === "rail"); assert.equal(rails.length, 2); assert.ok(rails.every((i) => i.side === "B" && i.face === "+Y" && i.key && i.params.t === 1.6 && i.params.length === 100), "each groove is an interface with its identity, ready for its board");
  assert.equal(s.interfaces.filter((i) => i.type === "bolt_pattern" && i.opts.port).length, 2, "one screw pattern per end, for the end plates"); assert.ok(s.interfaces.find((i) => i.type === "planar").external);
  const { b, d } = made(K, s), m = b.facts.extrusion.metrics;
  assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.equal(m.hollows, 1, "the screw channels are open : one mandrel only"); assert.ok(Math.abs(m.wallMin - val(s, "t")) < 0.05, `thinnest wall ${m.wallMin}`);
  assert.ok(b.facts.extrusion.envelopes.length >= 4 && b.facts.extrusion.envelopes.every((e) => !e.collides), "what it holds fits, clearance included");
  assert.deepEqual([d.summary.errors, d.summary.warnings], [0, 0], d.findings.filter((f) => f.severity === "warn" || f.severity === "error").map((f) => `${f.id} ${f.message}`).join(" | "));
  assert.ok(routing(s, b).steps.some((x) => /Extruder le profilé/.test(x.text)));
  assert.ok(r.decisions.some((x) => /canal de vis ouvert en « C »/.test(x)) && r.decisions.some((x) => /glissière à/.test(x)));
  assert.deepEqual(fromDwiz(toDwiz(s)), s, "the profile survives the .dwiz round trip");
});

test("plastic, open, mixed contents : a U with no hollow, a board on a hook when it is narrower than the cavity, a module resting on the bosses", async () => {
  const K = await kernel(), brief = { name: "Gouttière", material: "PVC-U", form: "profile", length: 200, open: true, contents: [{ name: "Module", w: 60, h: 20, hold: "flat" }, { name: "Carte", w: 50, h: 10, hold: "rail", edge: 1.6 }], interfaces: [] };
  const r = synthesize(brief, "PN-0301"), s = r.spec; assert.equal(s.process, "extrusion_plastic"); assert.equal(extrusionProcess("PVC-U"), "extrusion_plastic"); assert.equal(s.extrusion.profile.open, true);
  const { b, d } = made(K, s); assert.equal(b.facts.extrusion.metrics.hollows, 0); assert.ok(b.facts.extrusion.envelopes.every((e) => !e.collides));
  assert.deepEqual([d.summary.errors, d.summary.warnings], [0, 0], d.findings.filter((f) => f.severity !== "info").map((f) => `${f.id} ${f.message}`).join(" | "));
  assert.ok(r.decisions.some((x) => /posé à plat sur les bossages/.test(x)) && r.decisions.some((x) => /plus étroit que la cavité/.test(x)));
  const closed = synthesize({ ...brief, open: undefined }, "PN-0302"); assert.ok(closed.decisions.some((x) => /calibrage interne/.test(x)), "a closed plastic profile is said to cost a calibrator");
  assert.throws(() => synthesize({ ...brief, contents: [{ name: "Rien", w: 0, h: 5 }] }, "PN-0303"), /largeur et une hauteur/);
});

test("the profile is advised when the part guides what it holds, and without ports it is a plain tube", async () => {
  const K = await kernel();
  assert.equal(recommend({ material: "AL6063-T5", interfaces: [{ type: "rail", side: "B", where: "+Y", params: { t: 1.6, depth: 2, length: 72 } }] }).form, "profile");
  assert.notEqual(recommend({ material: "AL6061-T6", interfaces: [{ type: "rail", side: "B", where: "+Y", params: { t: 1.6, depth: 2, length: 72 } }] }).form, "profile", "a grade that is not extruded keeps its machined form");
  const s = synthesize({ name: "Tube", material: "AL6063-T5", form: "profile", length: 100, ports: false, contents: [{ name: "Pile", w: 40, h: 20, hold: "flat" }, { name: "Câbles", w: 20, h: 8, hold: "free" }], interfaces: [] }, "PN-0304").spec;
  assert.equal(s.interfaces.length, 0); assert.equal(s.extrusion.profile.ports, undefined);
  const { b, d } = made(K, s); assert.equal(d.summary.errors + d.summary.warnings, 0); assert.ok(b.facts.extrusion.envelopes.every((e) => !e.collides));
});

test("a board born from the groove of the profile slides in : same key, tongue on its edge, mated flush inside with no clash", async () => {
  const K = await kernel(), box = synthesize({ name: "Fourreau", material: "AL6063-T5", form: "profile", length: 90, contents: [{ name: "Carte", w: 72, h: 14, hold: "rail", edge: 1.6, below: 4 }], interfaces: [] }, "PN-0310").spec;
  const rail = box.interfaces.find((i) => i.type === "rail");
  const card = synthesize({ name: "Carte", material: "AL6061-T6", form: "plate", envelope: { W: 80 }, interfaces: [{ type: "rail", side: "A", name: rail.name, key: rail.key, partner: "Fourreau", where: "-Y", params: rail.params, from: { part: "PN-0310", iface: rail.id } }] }, "PN-0311").spec;
  assert.equal(val(card, "L"), 72, "the width of the board is the one the groove holds"); assert.equal(val(card, "t"), 1.6);
  const tongue = card.interfaces.find((i) => i.type === "rail"); assert.deepEqual([tongue.side, tongue.face, tongue.key], ["A", "+Y", rail.key]);
  const built = { "PN-0310": buildPart(K, box), "PN-0311": buildPart(K, card) };
  const asm = { id: "A1", instances: [{ id: "i1", part: "PN-0310", fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } }, { id: "i2", part: "PN-0311", placement: { t: [0, 0, 0], r: [0, 0, 0] } }], mates: [] };
  const added = autoMate(asm, built); assert.equal(added.length, 1); assert.equal(added[0].flip, true, "a tongue slides in : the frames coincide"); assert.equal(added[0].by, "key");
  const sol = solve(asm, built); assert.equal(sol.problems.length, 0); assert.equal(joints(asm, built)[0].kind, "Guidé");
  const T = sol.placements.i2, moved = K.transform(built["PN-0311"].bodies[0].shape, T), bb = K.props(moved).bbox || K.bbox(moved), L = val(box, "L");
  assert.ok(Math.abs(bb[4] - L) < 0.01 && bb[1] > -0.01, `the board is inside, flush with the end (y ${bb[1].toFixed(2)} → ${bb[4].toFixed(2)})`);
  const zc = val(box, "t") + parseFloat(rail.at[1].split("+")[1]);
  assert.ok(Math.abs((bb[2] + bb[5]) / 2 - zc) < 0.01, "at the height of its groove");
  const common = K.props(K.common(built["PN-0310"].bodies[0].shape, moved)).volume; assert.ok(common < 0.01, `no shared volume (${common.toFixed(3)} mm³)`);
  const h = assemblyHealth(asm, built, { "PN-0310": box, "PN-0311": card }, sol, []); assert.equal(h.counts.ok, 1, h.rows[0].notes.join(" ")); assert.equal(h.counts.check + h.counts.broken, 0);
});
