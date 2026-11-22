/* A thin folded part, seen flat (demande de JP, 21 novembre 2026) : the developed length on the neutral fibre, the bend lines and their notes,
   the four kinds of parts that unfold, and the flat blank built by the kernel.
     node --test tests/node/flat_pattern.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { develop, bendLabel, canFlatten, flatOf, flatSpec, K_FILM } from "../../web/js/core/flat_pattern.js";
import { blankBusbar, busbarPart, KFACTOR } from "../../web/js/core/busbar.js";
import { exampleTree, treePart } from "../../web/js/core/flex_tree.js";
import { blankFlex, flexPart } from "../../web/js/core/flex.js";
import { bmProject, CORE_X } from "../../web/js/demo/demo_bm.js";
import { buildPart } from "../../web/js/cad/build.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the developed length runs along the neutral fibre : each 90° bend gives back 2 (r + t/2) and takes a quarter circle of radius r + k·t", () => {
  const legs = [{ L: 60 }, { L: 30, bend: 90 }, { L: 50, bend: -90 }], t = 3, r = 3, k = 0.4, d = develop(legs, t, r, k);
  const A = (Math.PI / 2) * (r + k * t), D = 2 * (r + t / 2) - A;
  near(d.total, 140 - 2 * D, "total"); near(d.arc, A, "arc"); near(d.deduction, D, "deduction");
  assert.deepEqual(d.bends.map((b) => b.dir), ["UP", "DOWN"]); near(d.bends[0].from, 60 - (r + t / 2), "the first bend starts where the first straight ends");
  near(d.bends[1].from, 90 - (r + t / 2) - D, "the second, less what the first took back"); near(d.dev(2, 10), 100 - 2 * D, "a point of the third leg");
  assert.equal(bendLabel({ dir: "UP", angle: 90 }, 2), "UP 90° R2"); assert.equal(K_FILM, 0.5);
  near(develop([{ L: 10 }], 0.2, 2, 0.5).total, 10, "a straight strip is its length");
});

test("which parts unfold : a branched circuit with a fold, a strip with legs, a busbar, a folded sheet — not a block", () => {
  assert.equal(canFlatten(treePart(exampleTree(), "T")), true); assert.equal(canFlatten(flexPart(blankFlex(), "F")), true); assert.equal(canFlatten(busbarPart(blankBusbar(), "B")), true);
  assert.equal(canFlatten({ id: "X", features: [{ op: "box" }] }), false); assert.equal(flatOf({ id: "X" }), null);
  assert.equal(canFlatten({ id: "S", folded: {} }), false, "a folded sheet waits for its build (the flat pattern comes from the kernel)");
  const flat = { ...exampleTree(), branches: exampleTree().branches.map((b) => ({ ...b, legs: [b.legs[0]] })) }; assert.equal(canFlatten(treePart(flat, "T2")), false, "nothing folded, nothing to unfold");
});

test("the flex of the sensors of a CORE, flat : its core and its one full-width panel in one strip, 2 bends UP, a thermistor on the core under each cell ; the cones are formed after", async () => {
  const p = bmProject(), s = p.parts.find((x) => x.id === "BM-FLEX-BASE"), f = flatOf(s), def = s.flex, panels = f.bends.filter((b) => /^PA-/.test(b.id));
  assert.equal(f.kind, "flex-tree"); assert.equal(f.bends.length, 2); assert.equal(panels.length, 2);
  assert.ok(panels.every((b) => b.dir === "UP" && b.r === 1.2 && b.label === "UP 90° R1.2"), "6 × the thickness of the film : the bend passes under the end of the floor of the support");
  const pa = def.branches[0], d = develop([{ ...pa.legs[0], L: pa.legs[0].L + 1 }, ...pa.legs.slice(1)], def.t, pa.r, K_FILM);
  near(f.size[0], def.core.L + (d.total - 1), "the core plus the panel, developed", 0.01); near(f.size[1], def.core.W, "the width of the core", 0.01);
  assert.ok(f.size[0] > 2 * CORE_X, `a long strip, flat : ${f.size[0]} mm`);
  const temps = f.marks.filter((m) => m.kind === "temp"); assert.equal(temps.length, 8); for (const sp of def.spots.filter((x) => x.end === "temp")) assert.ok(temps.some((m) => m.at[0] === sp.x && m.at[1] === sp.y && m.face === "top"));
  assert.deepEqual(f.marks.filter((m) => m.kind === "volt"), [], "the voltage is taken by the nickel tabs, not by the flex");
  const K = await kernel(), spec = flatSpec(f, s), b = buildPart(K, spec); assert.deepEqual(b.log.filter((l) => l.level === "error"), []);
  assert.ok(!spec.features.some((x) => x.id === "cones"), "the flat pattern has no cone : they are formed after the flex is made");
  const bb = K.bbox(b.bodies[0].shape); near(bb[3] - bb[0], f.size[0], "its length", 0.01);
  assert.ok(f.notes.some((n) => /fibre neutre, k = 0,5/.test(n)));
});

test("a busbar flat : one strip, its terminal holes where they fall once unfolded, the k of a metal", async () => {
  const s = busbarPart(blankBusbar(), "BB"), f = flatOf(s), d = develop(s.busbar.legs, s.busbar.t, s.busbar.r, KFACTOR);
  assert.equal(f.kind, "busbar"); assert.equal(f.k, KFACTOR); near(f.size[0], d.total, "developed"); near(f.size[1], s.busbar.W, "width");
  const T = s.busbar.terminals[0], h = f.holes.find((x) => x.id === T.id); near(h.at[0], d.dev(T.leg, T.s), "the hole of the terminal, on the flat");
  const K = await kernel(), b = buildPart(K, flatSpec(f, s)); assert.deepEqual(b.log.filter((l) => l.level === "error"), []);
  assert.ok(K.props(b.bodies[0].shape).volume < f.size[0] * f.size[1] * s.busbar.t - 1, "the hole is cut through the blank");
});

test("a folded sheet-metal part flat : the flat pattern the kernel computed, its bend line and its note", async () => {
  const s = { dw: "part/1", id: "P", name: "p", process: "laser_cut", material: "AL5052-H32", params: {}, interfaces: [], folded: { base: [60, 40], t: 1.5, r: 1.5, flanges: [{ side: "+X", h: 12 }] }, features: [] };
  const K = await kernel(), built = buildPart(K, s); assert.equal(canFlatten(s, built), true);
  const f = flatOf(s, built); assert.equal(f.kind, "folded"); assert.equal(f.bends.length, 1); assert.match(f.bends[0].label, /^(UP|DOWN) 90° R1\.5$/);
  near(f.size[0], built.facts.folded.flat.size[0], "the same flat pattern as the « Développé » tab");
  const b = buildPart(K, flatSpec(f, s)); assert.deepEqual(b.log.filter((l) => l.level === "error"), []); near(K.bbox(b.bodies[0].shape)[5], 1.5, "the blank, at its thickness");
});

test("wired : the switch « Plié · À plat » in the four studios, the news, the doc", () => {
  for (const f of ["web/js/modules/part_studio.js", "web/js/modules/flex_tree.js", "web/js/modules/flex.js", "web/js/modules/busbar.js"]) assert.match(read(f), /flatToggle\(vp,/, f);
  assert.match(read("web/js/modules/flat_view.js"), /"data-flat-toggle"/); assert.match(read("web/js/core/whats_new.js"), /\[data-flat-toggle\]/);
  assert.match(read("docs/ELECTRIQUE.md"), /À plat/);
  assert.match(read("web/css/app.css"), /\.seg\[hidden\] \{ display: none; \}/, "a part that does not unfold has no switch : the hidden switch stays hidden, whatever its display");
});
