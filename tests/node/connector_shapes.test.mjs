/* The indicative shape of a connector, by kind : written once as boxes and cylinders, read as features of the part (expressions of
   the envelope) and as plain solids for the preview — and the maker's STEP put in its place. */
import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS, CONNECTOR_KINDS } from "../../web/js/cad/elec_library.js";
import { connectorSolids, connectorSolidsAt, connectorFeatures, shapeConstants, SHAPE_WORDS, TONES } from "../../web/js/core/connector_shapes.js";
import { connectorPart, connectorEnvelope, poleNets, defaultPoles, useMakerModel, dropMakerModel } from "../../web/js/core/elec_parts.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { evaluate as evalExpr } from "../../web/js/cad/expr.js";
import { kernel } from "./kernel_helper.mjs";

const fam = (id) => CONNECTORS.find((c) => c.id === id), opt = (c, mount) => { const poles = defaultPoles(c), E = connectorEnvelope(c, poles), panel = mount === "panel"; return { E, o: { poles, nets: poleNets(c, poles), panel, e: panel ? Math.max(4, E.H * 0.25) : 0 } }; };

test("every kind of connector has its shape and its words ; kinds do not look alike", () => {
  const kinds = [...new Set(CONNECTORS.map((c) => c.kind))];
  assert.deepEqual(kinds.filter((k) => !SHAPE_WORDS[k] || !CONNECTOR_KINDS[k]), []); assert.ok(TONES.housing.hv !== TONES.housing.lv);
  const sig = kinds.map((k) => { const c = CONNECTORS.find((x) => x.kind === k), { E, o } = opt(c, c.domain === "hv" ? "panel" : "board"); return connectorSolids(c, E, o).map((s) => `${s.shape}${s.cut ? "-" : "+"}`).join(""); });
  assert.equal(new Set(sig).size, kinds.length, "the make-up of each kind is its own");
  const hv = fam("te-hvp800"), H = opt(hv, "panel"), solids = connectorSolids(hv, H.E, H.o);
  assert.deepEqual(solids.filter((s) => /^port/.test(s.id)).map((s) => s.shape), ["cyl", "cyl"], "a round port per pole"); assert.equal(solids.filter((s) => /^fix/.test(s.id)).length, 4, "four holes in the flange"); assert.equal(solids.filter((s) => /^hvil/.test(s.id)).length, 2);
  assert.deepEqual(solids.filter((s) => s.body).map((s) => s.body), ["pole1", "pole2"]); assert.ok(solids.every((s) => (s.shape === "box" ? s.size.every((v) => v > 0) : s.d > 0 && s.h > 0)), "no solid of no size");
});

test("how many poles a family is shown with : inside what it exists in", () => {
  assert.equal(defaultPoles(fam("jst-ph")), 4); assert.equal(defaultPoles(fam("te-hvp800")), 2); assert.equal(defaultPoles(fam("hirose-df40")), 40, "a 40 to 100 pole mezzanine starts at 40");
  assert.equal(defaultPoles({ domain: "lv" }), 4); assert.equal(defaultPoles({ domain: "hv", pos: "1" }), 1); assert.equal(connectorPart(fam("hirose-df40"), { id: "CN-1" }).library.poles, 40);
});

test("the features of the part are the same solids, as expressions of the envelope : stretching L, W, H or e moves them as the generator would", () => {
  for (const c of [fam("jst-xh"), fam("m12-a"), fam("te-hvp800"), fam("phoenix-mstb"), fam("te-msd"), fam("molex-mx150"), fam("anderson-sb50") || fam("amass-xt60")].filter(Boolean)) for (const mount of ["panel", "board"]) {
    const { E, o } = opt(c, mount), F = connectorFeatures(c, E, o), E2 = { L: E.L * 1.3 + 2, W: E.W * 0.8 + 1, H: E.H * 1.15 }, e2 = o.e + 1.5, scope = { L: E2.L, W: E2.W, H: E2.H, e: e2 }, S2 = connectorSolidsAt(c, E, o, scope);
    assert.equal(F.length, S2.length);
    F.forEach((f, i) => { const s = S2[i], val = (x) => (typeof x === "number" ? x : evalExpr(x, scope)), same = (a, b, what) => assert.ok(Math.abs(val(a) - b) < 2e-3 * Math.max(1, Math.abs(b)), `${c.id} ${mount} ${f.id} ${what} : ${a} → ${val(a)} for ${b}`);
      assert.equal(f.op, s.shape === "box" ? "box" : "cylinder"); assert.equal(f.mode, s.cut ? "cut" : undefined); assert.equal(f.body, s.body);
      f.at.forEach((a, k) => same(a, s.at[k], `at[${k}]`)); if (s.shape === "box") f.size.forEach((a, k) => same(a, s.size[k], `size[${k}]`)); else { same(f.d, s.d, "d"); same(f.h, s.h, "h"); assert.equal(f.axis, s.axis); } });
  }
  const K = shapeConstants(fam("jst-xh"), connectorEnvelope(fam("jst-xh"), 6), { poles: 6, nets: ["LV"], panel: false }); assert.equal(K.fl, 0); assert.equal(K.nose, 0); assert.equal(K.shown, 6);
});

test("every family builds, on a wall and on a board, with one conductor per net", async () => {
  const K = await kernel(), bad = [];
  for (const c of CONNECTORS) for (const mount of ["panel", "board"]) { const s = connectorPart(c, { id: "CN-1", mount }), v = validateSpec(s).errors, b = buildPart(K, s), errs = b.log.filter((l) => l.level === "error").map((l) => l.msg);
    if (v.length || errs.length) bad.push(`${c.id} ${mount} : ${[...v, ...errs].join(" ; ")}`);
    else { const nets = poleNets(c, s.library.poles), cond = b.bodies.filter((x) => x.conductive); if (cond.length !== nets.length || cond.some((x, i) => x.net !== nets[i]) || b.bodies[0].name !== "main" || b.bodies[0].conductive) bad.push(`${c.id} ${mount} : bodies ${b.bodies.map((x) => `${x.name}:${x.net}`).join(", ")}`); }
    if (K.flush) K.flush(); }
  assert.deepEqual(bad, []);
  const hv = buildPart(K, connectorPart(fam("te-hvp800"), { id: "CN-HV" })); assert.equal(hv.bodies[0].color, TONES.housing.hv, "a high-voltage connector shows its colour"); assert.equal(buildPart(K, connectorPart(fam("jst-xh"), { id: "CN-LV" })).bodies[0].color, TONES.housing.lv);
});

test("the maker's STEP takes the place of the indicative shape, and gives it back", () => {
  const s = connectorPart(fam("te-hvp800"), { id: "CN-HV" }), was = JSON.parse(JSON.stringify(s)), step = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n";
  assert.throws(() => useMakerModel(s, "not a step file", "x.txt"), /n'est pas un STEP/); assert.deepEqual(s, was, "a wrong file changes nothing");
  useMakerModel(s, step, "hvp800-2p.stp");
  assert.deepEqual(s.step, { text: step, file: "hvp800-2p.stp" }); assert.deepEqual(s.features, [{ op: "interfaces" }]); assert.equal(s.library.model, "hvp800-2p.stp"); assert.equal(s.library.ref, "te-hvp800");
  assert.deepEqual(s.interfaces, was.interfaces, "the interfaces are kept"); assert.deepEqual(s.params, was.params, "and the parameters that place them"); assert.ok(s.notes.some((n) => /^Modèle 3D du fabricant : hvp800-2p.stp/.test(n)) && !s.notes.some((n) => /^Forme indicative/.test(n))); assert.ok(s.notes.some((n) => /^Référence : TE Connectivity/.test(n)));
  useMakerModel(s, step, "hvp800-3p.stp"); assert.equal(s.step.file, "hvp800-3p.stp"); assert.deepEqual(s.indicative.features, was.features, "the indicative shape waits aside, once");
  dropMakerModel(s); assert.equal(s.step, undefined); assert.equal(s.indicative, undefined); assert.deepEqual(s.features, was.features); assert.deepEqual(s.params, was.params); assert.deepEqual(s.bodies, was.bodies); assert.equal(s.library.model, undefined);
  assert.deepEqual(dropMakerModel(JSON.parse(JSON.stringify(was))), was, "nothing to take out of a part that has no model");
});
