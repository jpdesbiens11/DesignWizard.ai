// Shop brick (« Atelier »): raw stock, Shop verbs, routing sheet and synthesis of a part from its design intent.
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { expandSpec, routing, SHOP_VERBS } from "../../web/js/cad/shop.js";
import { stockFacts, STOCK_FORMS, nextStd, PLATE_THICKNESS } from "../../web/js/cad/stock.js";
import { synthesize, recommend, footprint, arrange } from "../../web/js/core/shop_intent.js";
import { interfaceSignature, compatible } from "../../web/js/cad/interfaces.js";
import { LANGUAGE_REFERENCE } from "../../web/js/cad/language_doc.js";

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const errors = (b) => b.log.filter((l) => l.level === "error");
const bolt = (screw, nx, ny, dx, dy, extra = {}) => ({ type: "bolt_pattern", params: { screw, pattern: { type: "rect", nx, ny, dx, dy } }, ...extra });

test("stock: commercial size, exact or next standard up, with advice", () => {
  const exact = stockFacts({ form: "plate", L: 120, W: 80, t: 6 }, "cnc_milling");
  assert.equal(exact.exact, true); assert.equal(exact.raw.t, 6); assert.equal(exact.raw.L, 124); assert.equal(exact.advice.length, 0);
  const odd = stockFacts({ form: "plate", L: 120, W: 80, t: 7 }, "cnc_milling");
  assert.equal(odd.exact, false); assert.equal(odd.raw.t, 8); assert.match(odd.advice[0], /6 ou 8 mm/);
  assert.equal(stockFacts({ form: "sheet", L: 100, W: 60, t: 2 }, "laser_cut").raw.L, 100, "a laser-cut sheet needs no machining allowance");
  assert.equal(stockFacts({ form: "bar_round", d: 23, L: 60 }).raw.d, 25);
  assert.equal(nextStd(PLATE_THICKNESS, 13), 15);
  assert.throws(() => stockFacts({ form: "plate", L: 10, W: 10 }), /stock\.t/);
  assert.throws(() => stockFacts({ form: "foam" }), /inconnue/);
});

test("expandSpec is structural: expressions survive, plain parts are untouched", () => {
  const plain = { features: [{ op: "box", size: [1, 2, 3] }] };
  assert.equal(expandSpec(plain), plain);
  const out = expandSpec({ stock: { form: "plate", L: "L", W: "W", t: "t" }, features: [{ op: "tap", id: "a", face: "+Z", at: ["L/2", 5], thread: "M4", depth: "t - 1" }, { op: "step", id: "s", face: "+Z", rect: [0, 0, 10, "W"], to: "t/2" }, { op: "deburr" }] });
  assert.equal(out.stock, undefined);
  assert.deepEqual(out.features[0].size, ["L", "W", "t"]);
  assert.equal(out.features[1].op, "hole"); assert.equal(out.features[1].depth, "t - 1"); assert.equal(out.features[1].shop, "tap");
  assert.equal(out.features[2].op, "box"); assert.equal(out.features[2].mode, "cut"); assert.equal(out.features[2].at[2], "t/2");
  assert.equal(out.features.length, 3, "deburr adds no geometry");
  const log = []; expandSpec({ features: [{ op: "cbore", id: "x", screw: "M7" }] }, log);
  assert.match(log[0].msg, /M7/);
});

test("every Shop verb is documented in the language reference", () => {
  for (const verb of Object.keys(SHOP_VERBS)) assert.ok(LANGUAGE_REFERENCE.includes(`"op":"${verb}"`), `verb ${verb} missing from the reference`);
  for (const form of Object.keys(STOCK_FORMS)) if (form !== "laminate") assert.ok(LANGUAGE_REFERENCE.includes(`"${form}"`), `stock form ${form} missing from the reference`);
});

test("plate from stock with Shop verbs: volume, facts and routing", async () => {
  const K = await kernel();
  const spec = { dw: "part/1", id: "T1", name: "Plaque", process: "cnc_milling", material: "AL6061-T6", params: { L: 120, W: 80, t: 8 }, stock: { form: "plate", L: "L", W: "W", t: "t" },
    features: [{ op: "mill", id: "p1", face: "+Z", rect: [20, 20, 40, 30], r: 3, depth: 3 }, { op: "tap", id: "t1", face: "+Z", at: { grid: { origin: [10, 10], nx: 2, ny: 2, dx: 100, dy: 60 } }, thread: "M4", depth: 6 },
      { op: "step", id: "s1", face: "+Z", rect: [100, -1, 30, 82], to: "t - 2" }] };
  assert.deepEqual(validateSpec(spec).errors, []);
  const b = buildPart(K, spec);
  assert.deepEqual(errors(b), []);
  assert.deepEqual(b.bbox.map((x) => Math.round(x)), [0, 0, 0, 120, 80, 8]);
  assert.ok(b.volume < 120 * 80 * 8 && b.volume > 0.8 * 120 * 80 * 8);
  assert.equal(b.facts.holes.length, 4); assert.equal(b.facts.holes[0].thread, "M4");
  assert.equal(b.facts.pockets.length, 1, "an open step is not a pocket: no corner-radius rule applies to it");
  near(b.facts.stock.utilisation, b.volume / (8 * 124 * 84), 1e-6);
  const r = routing(spec, b);
  assert.equal(r.steps[0].kind, "stock"); assert.match(r.steps[0].text, /Plaque de 8 mm/);
  assert.ok(r.steps.some((s) => /4 × Ø3,3 et tarauder M4/.test(s.text)));
  assert.ok(r.tools.includes("Taraud M4") && r.tools.includes("Fraise 2 tailles Ø6"));
  assert.equal(r.steps.at(-1).kind, "check"); assert.deepEqual(r.steps.map((s) => s.n), r.steps.map((_, i) => (i + 1) * 10));
  K.flush();
});

test("turned part from a round bar and bracket from a commercial angle", async () => {
  const K = await kernel();
  const shaft = { dw: "part/1", id: "T2", process: "cnc_turning", material: "SS-304", params: { D: 25, L: 60 }, stock: { form: "bar_round", d: "D", L: "L" },
    features: [{ op: "turn", id: "u1", from: 40, to: "L", d: 12 }, { op: "bore", id: "b1", d: 6, depth: 20 }] };
  const b = buildPart(K, shaft);
  assert.deepEqual(errors(b), []);
  near(b.volume, Math.PI / 4 * (25 * 25 * 40 + 12 * 12 * 20 - 6 * 6 * 20), 60);
  assert.ok(routing(shaft, b).steps.some((s) => /Charioter Ø12 de 40 à 60/.test(s.text)));
  const br = buildPart(K, { dw: "part/1", id: "T3", process: "cnc_milling", material: "AL6061-T6", stock: { form: "angle", a: 40, b: 50, t: 4, L: 40 }, features: [{ op: "drill", face: "-Z", at: [[10, 25], [30, 25]], d: 5.5 }] });
  assert.deepEqual(errors(br), []);
  assert.deepEqual(br.bbox.map((x) => Math.round(x)), [0, 0, 0, 40, 40, 50]);
  assert.ok(br.facts.stock.utilisation > 0.85, "an angle is almost all in the part");
  K.flush();
});

test("laser-cut sheet: contour and holes in one pass, no drill in the tool list", async () => {
  const K = await kernel();
  const spec = { dw: "part/1", id: "T4", process: "laser_cut", material: "SS-304", params: { L: 100, W: 60, t: 2 }, stock: { form: "sheet", L: "L", W: "W", t: "t" },
    features: [{ op: "outline", id: "o1", profile: { rect: [0, 0, "L", "W"], r: 8 } }, { op: "drill", id: "d1", face: "+Z", at: [50, 30], d: 10 }] };
  const b = buildPart(K, spec), r = routing(spec, b);
  assert.deepEqual(errors(b), []);
  near(b.volume, (100 * 60 - (4 - Math.PI) * 64 - Math.PI * 25) * 2, 2);
  assert.equal(r.tools.length, 0); assert.ok(r.steps.some((s) => /même passe/.test(s.text)));
  K.flush();
});

test("companion: footprints, nesting and stock recommendation", () => {
  const big = { name: "grand", fp: footprint({ ...bolt("M5", 2, 2, 80, 60), side: "A" }, "AL6061-T6") }, small = { name: "petit", fp: footprint({ ...bolt("M3", 2, 2, 20, 20), side: "B" }, "AL6061-T6") };
  assert.equal(small.fp.need, 4.5, "M3 tapped in aluminium: 1.5 d");
  const lay = arrange([small, big]);
  assert.equal(small.host, big); assert.equal(small.du, big.du); near(lay.w, big.fp.w);
  assert.equal(recommend({ interfaces: [{ ...bolt("M4", 2, 2, 40, 30), where: "-Z" }, { ...bolt("M3", 2, 2, 20, 20), where: "+Z", side: "B" }], material: "AL6061-T6" }).form, "plate");
  assert.equal(recommend({ interfaces: [{ ...bolt("M4", 2, 1, 20, 0), where: "-Z" }, { ...bolt("M4", 2, 1, 20, 0), where: "-Y" }], material: "AL6061-T6" }).form, "angle");
  assert.equal(recommend({ interfaces: [{ type: "fit", params: { d: 12, length: 10 }, where: "+Z" }], material: "SS-304" }).form, "bar_round");
  assert.equal(recommend({ interfaces: [{ ...bolt("M4", 2, 2, 40, 30), where: "+Z" }], material: "PA12", quantity: 3 }).form, "print");
});

test("companion: an adapter plate written from its intent builds, and mates with what it was written for", async () => {
  const K = await kernel();
  const brief = { name: "Plaque d'adaptation capteur", fn: "Porte le capteur sur le bâti.", material: "AL6061-T6", quantity: 10, loads: "5 N",
    interfaces: [{ ...bolt("M5", 2, 2, 80, 50), name: "Fixation au bâti", partner: "Bâti", side: "A", where: "-Z", key: "frame_mount" },
      { ...bolt("M3", 2, 2, 24, 18), name: "Fixation du capteur", partner: "Capteur", side: "B", where: "+Z" }] };
  const { spec, decisions, form } = synthesize(brief, "PN-0042");
  assert.equal(form, "plate"); assert.equal(spec.stock.form, "plate"); assert.equal(spec.id, "PN-0042");
  assert.deepEqual(validateSpec(spec).errors, []);
  assert.ok(decisions.some((d) => /concentriques/.test(d)), "the sensor pattern nests inside the frame pattern");
  assert.ok(PLATE_THICKNESS.includes(spec.params.t.value), "the thickness is a commercial one");
  const b = buildPart(K, spec);
  assert.deepEqual(errors(b), []);
  assert.equal(b.interfaces.length, 2); assert.equal(b.facts.holes.length, 8);
  const frame = b.interfaces.find((i) => i.key === "frame_mount");
  assert.equal(frame.side, "A"); assert.equal(frame.face, "-Z");
  assert.ok(compatible(frame, { type: "bolt_pattern", side: "B", key: "frame_mount", params: bolt("M5", 2, 2, 80, 50).params }).ok);
  assert.equal(interfaceSignature(frame), interfaceSignature(bolt("M5", 2, 2, 80, 50)));
  assert.ok(b.bbox[3] >= 80 + 10 && b.bbox[4] >= 50 + 10, "the envelope carries the pattern plus the edge distance");
  assert.equal(b.facts.stock.exact, true);
  const r = routing(spec, b);
  assert.ok(r.steps.length >= 6 && r.setups.length === 2);
  assert.equal(spec.intent.quantity, 10);
  K.flush();
});

test("companion: bracket, turned part, block and printed part all build without error", async () => {
  const K = await kernel();
  const cases = [
    [{ name: "Équerre", material: "AL6061-T6", interfaces: [{ ...bolt("M5", 2, 1, 30, 0), side: "A", where: "-Z", name: "Sol" }, { ...bolt("M4", 2, 1, 24, 0), side: "A", where: "-Y", name: "Mur" }] }, "angle"],
    [{ name: "Moyeu", material: "SS-304", interfaces: [{ type: "fit", params: { d: 12, length: 10, fit: "H7/g6" }, side: "A", where: "+Z", name: "Portée" }, { type: "bolt_pattern", params: { screw: "M4", pattern: { type: "circle", n: 4, pcd: 30 } }, side: "B", where: "-Z", name: "Bride" }] }, "bar_round"],
    [{ name: "Bloc", material: "AL6061-T6", interfaces: [{ ...bolt("M4", 2, 2, 30, 20), side: "B", where: "+Z" }, { ...bolt("M4", 2, 1, 20, 0), side: "B", where: "+X" }, { type: "pins", params: { d: 4, pitch: 20, n: 2, length: 12 }, side: "B", where: "-Y" }] }, "block"],
    [{ name: "Support imprimé", material: "PA12", quantity: 2, interfaces: [{ ...bolt("M3", 2, 2, 30, 20), side: "B", where: "+Z" }] }, "print"],
    [{ name: "Tôle", material: "SS-304", form: "sheet", interfaces: [{ ...bolt("M4", 2, 2, 60, 40), side: "A", where: "+Z" }, { type: "cutout", params: { shape: "rect", w: 20, h: 10, r: 1 }, side: "A", where: "+Z" }] }, "sheet"],
  ];
  for (const [brief, form] of cases) {
    const out = synthesize(brief, "PN-1");
    assert.equal(out.form, form, brief.name);
    assert.deepEqual(validateSpec(out.spec).errors, [], brief.name);
    const b = buildPart(K, out.spec);
    assert.deepEqual(errors(b), [], `${brief.name}: ${JSON.stringify(b.log)}`);
    assert.equal(b.interfaces.length, brief.interfaces.length, brief.name);
    assert.ok(b.volume > 100, brief.name);
    assert.ok(routing(out.spec, b).steps.length >= 3, brief.name);
    K.flush();
  }
});
