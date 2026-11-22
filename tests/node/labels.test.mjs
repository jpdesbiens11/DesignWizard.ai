/* Labels and stickers : where one sits from a point picked on a part, its frame, its mesh — flat on a plane, developed
   without stretching on a cylinder —, its artwork at scale, what it asks for, the list for the printer. */
import test from "node:test";
import assert from "node:assert/strict";
import { LABEL_KINDS, LABEL_ARTS, blankLabel, brandSticker, nextLabelId, isWrapped, surfaceAt, labelFrame, labelPatch, moveLabel, labelSvg, textEms, textHeight, labelGuide, labelRows, labelsCsv, tidyLabel, IMAGE_LIMIT } from "../../web/js/core/labels.js";
import { DEMO_ROCKET } from "../../web/js/demo/demo_rocket.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { stampText, isMarked } from "../../web/js/core/brand.js";
import { methodById } from "../../web/js/core/methods.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`), R = 101.6;
const onCyl = (extra = {}) => ({ ...brandSticker("E1"), inst: "i1", w: 200, h: 60, on: { p: [R, 0, 500], axis: [0, 0, 1], c: [0, 0, 0], r: R }, ...extra });
const onFlat = (extra = {}) => ({ ...brandSticker("E1"), inst: "i1", on: { p: [10, 0, 5], n: [0, -1, 0] }, ...extra });

test("a point picked on a part says where a label sits : a plane, a cylinder, or the tangent plane of another face", () => {
  assert.deepEqual(surfaceAt({ local: [10, 0, 5], normal: [0, -2, 0], face: { type: "plane" } }), { p: [10, 0, 5], n: [0, -1, 0] });
  const c = surfaceAt({ local: [R, 0, 500], normal: [1, 0, 0], face: { type: "cylinder", axis: [0, 0, -1], o: [0, 0, 0], r: R } });
  assert.deepEqual(c, { p: [R, 0, 500], axis: [0, 0, 1], c: [0, 0, 0], r: R }, "the axis is turned upward : the label reads the right way round");
  assert.equal(surfaceAt({ local: [0, 0, 0], normal: [1, 0, 0], face: { type: "cylinder", axis: [0, 0, 1], o: [0, 0, 0], r: 5, inner: true } }).tangent, true, "the wall of a hole is not a place to wrap a label");
  assert.equal(surfaceAt({ local: [0, 0, 0], normal: [0, 0, 1], face: { type: "cone" } }).tangent, true);
  assert.ok(isWrapped({ on: c })); assert.ok(!isWrapped(onFlat()));
});
test("the frame of a label : right, up and normal, read from outside", () => {
  const f = labelFrame(onFlat()); assert.deepEqual([f.wrap, f.u, f.v, f.n], ["flat", [1, 0, 0], [0, 0, 1], [0, -1, 0]], "on a wall facing −Y : right is +X, up is +Z");
  const top = labelFrame(onFlat({ on: { p: [0, 0, 3], n: [0, 0, 1] } })); assert.deepEqual([top.u, top.v], [[1, 0, 0], [0, 1, 0]]);
  const c = labelFrame(onCyl()); assert.equal(c.wrap, "cyl"); near(c.u[1], 1); near(c.v[2], 1); near(c.n[0], 1); assert.equal(c.s0, 500);
  assert.equal(labelFrame(blankLabel()), null, "a label not yet placed has no frame");
});
test("flat : a quad a hair above the face ; on a cylinder : every point at the radius, and a millimetre of label is a millimetre of arc", () => {
  const q = labelPatch(onFlat()); assert.equal(q.pos.length, 12); assert.equal(q.idx.length, 6); assert.deepEqual(Array.from(q.uv), [0, 0, 1, 0, 0, 1, 1, 1]);
  near(q.pos[0], 10 - 90); near(q.pos[1], -0.1, 1e-6); near(q.pos[2], 5 - 30); near(q.pos[9], 10 + 90); near(q.pos[11], 5 + 30);
  const c = labelPatch(onCyl()), n = c.pos.length / 3;
  for (let k = 0; k < n; k++) near(Math.hypot(c.pos[3 * k], c.pos[3 * k + 1]), R + 0.1, 1e-4);
  const a0 = Math.atan2(c.pos[1], c.pos[0]), a1 = Math.atan2(c.pos[3 * c.segments + 1], c.pos[3 * c.segments]); near((a1 - a0) * R, 200, 1e-3);     // the bottom edge spans its 200 mm of arc
  near(c.pos[2], 470, 1e-4); near(c.pos[3 * (n - 1) + 2], 530, 1e-4); assert.ok(c.segments >= 20, "enough facets to look round");
  const up = labelPatch(onCyl({ turn: 90 })), zs = Array.from({ length: up.pos.length / 3 }, (_, k) => up.pos[3 * k + 2]);
  near(Math.max(...zs) - Math.min(...zs), 200, 1e-3, "turned a quarter : its width runs along the axis");
  assert.equal(labelPatch(blankLabel()), null); assert.ok(labelPatch(onCyl({ kind: "plate" })).pos[0] !== c.pos[0], "a plate stands prouder than a sticker");
});
test("a label slides on its surface : straight on a plane, around and along a cylinder", () => {
  assert.deepEqual(moveLabel(onFlat(), 3, -2).on.p, [13, 0, 3]);
  assert.deepEqual(moveLabel(onCyl(), Math.PI * R / 2, 20).on.p, [0, R, 520], "a quarter of a turn, 20 mm up");
});
test("the artwork is an SVG at scale : millimetres for the printer, pixels for the screen ; text is fitted inside", () => {
  const svg = labelSvg(onCyl());
  assert.match(svg, /viewBox="0 0 200 60" width="200mm" height="60mm"/); assert.match(svg, /DesignOrbit\.ai/); assert.match(svg, /by DynamiteAgile™/); assert.match(svg, /stroke="#0c66e4"/, "the arc of the mark, in its blue");
  assert.match(labelSvg(onCyl(), { px: 4 }), /width="800" height="240"/);
  const t = { ...blankLabel(), art: { ...blankLabel().art, text: "N2O — DANGER" } }, size = +labelSvg(t).match(/font-size="([\d.]+)"/)[1];
  assert.ok(size * textEms("N2O — DANGER") <= 80 - 2 * 3.6, "the line stays inside the label"); assert.equal(textHeight(t), size);
  assert.match(labelSvg({ ...t, art: { ...t.art, text: "<b>&" } }), /&lt;b&gt;&amp;/, "what is typed is text, never markup");
  assert.match(labelSvg({ ...t, art: { ...t.art, type: "image", src: "data:image/png;base64,AAAA" } }), /<image [^>]*href="data:image\/png;base64,AAAA"/);
  assert.equal(textHeight({ ...t, art: { ...t.art, type: "image" } }), 0);
  assert.ok(isMarked(stampText("E1.svg", svg)), "the file leaves with the note of the platform");
});
test("the guide : to place, to write, too long for the cylinder, too small to read", () => {
  assert.deepEqual(labelGuide([onCyl(), onFlat({ id: "E2" })], ["i1"]), []);
  assert.deepEqual(labelGuide([], []).map((x) => [x.level, x.field]), [["tip", "add"]]);
  const g = (l, inst = ["i1"]) => labelGuide([l], inst).map((x) => `${x.level}:${x.field}`);
  assert.deepEqual(g(blankLabel()), ["todo:on", "todo:text"]);
  assert.deepEqual(g(onCyl({ w: 700 })), ["error:w"]); assert.match(labelGuide([onCyl({ w: 700 })], ["i1"])[0].text, /700 mm autour d'un cylindre de 638,37 mm de tour/);
  assert.deepEqual(g(onCyl({ w: 400 })), ["warn:w"], "more than half a turn");
  assert.deepEqual(g(onCyl({ w: 400, h: 100, turn: 90 })), [], "turned along the axis, only its height goes around");
  assert.deepEqual(g(onCyl(), ["other"]), ["error:on"], "the instance that carried it is gone");
  assert.deepEqual(g(onFlat({ w: 20, h: 5, art: { type: "text", text: "Référence 123-456-789", ink: "#000000", paper: "#ffffff" } })), ["warn:h"]);
  assert.deepEqual(g(onFlat({ art: { type: "image", src: "" } })), ["todo:src"]); assert.deepEqual(g(onFlat({ art: { type: "image", src: "x".repeat(IMAGE_LIMIT + 1) } })), ["warn:src"]);
  assert.deepEqual(g(onFlat({ art: { type: "text", text: "A", ink: "#FFFFFF", paper: "#ffffff" } })), ["warn:ink"]);
  assert.deepEqual(labelGuide([onCyl(), onCyl()], ["i1"]).map((x) => x.level), ["error"], "two labels with one number");
});
test("the list for the printer, and a label put back in order", () => {
  const rows = labelRows([onCyl(), onFlat({ id: "E2", kind: "plate" }), blankLabel("E3")], { i1: "Coque centrale" });
  assert.deepEqual(rows.map((r) => [r.id, r.kind, r.on, r.surface, r.area]), [["E1", "Sticker", "Coque centrale", "cylindre Ø 203,2", 120], ["E2", "Nameplate", "Coque centrale", "face plane", 108], ["E3", "Sticker", "—", "à poser", 24]]);
  assert.match(labelsCsv(rows).split("\n")[1], /^"E1","Sticker DesignOrbit\.ai","Sticker","Marque DesignOrbit.ai","Coque centrale","cylindre Ø 203,2","200","60","0","120"$/);
  assert.equal(nextLabelId([{ id: "E1" }, { id: "E7" }]), "E8"); assert.deepEqual(Object.keys(LABEL_KINDS), ["sticker", "plate", "marking"]); assert.deepEqual(Object.keys(LABEL_ARTS), ["logo", "text", "image"]);
  const t = tidyLabel({ id: 4, kind: "banner", w: "120", h: null, turn: "x", art: { type: "hologram", text: "A" }, on: { p: [1, 2] } });
  assert.deepEqual([t.id, t.kind, t.w, t.h, t.turn, t.art.type, t.art.text, t.on], ["4", "sticker", 120, 30, 0, "text", "A", null]);
});
test("the rocket wears the sticker of the platform, and it travels in the file of the assembly", () => {
  const asm = DEMO_ROCKET.assemblies[0], l = asm.labels[0];
  assert.equal(l.art.type, "logo"); assert.equal(l.inst, "coque_centrale"); assert.ok(isWrapped(l)); assert.deepEqual(labelGuide(asm.labels, asm.instances.map((i) => i.id)), []);
  const back = fromDwiz(toDwiz(asm)); assert.deepEqual(back.labels, JSON.parse(JSON.stringify(asm.labels)));
  assert.match(toDwiz(asm), /\nlabel E1 sticker name="Sticker DesignOrbit\.ai" inst=coque_centrale w=420 h=120 turn=90\n  on p=\[58\.28, 83\.23, 760\]/);
  assert.equal(methodById("label-wrap").how, "tested");
});
