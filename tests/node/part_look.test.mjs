/* The look of a part : a colour and a shade its designer picks, kept in the part, shown on its main body, and never
   mistaken for a change of the design. */
import test from "node:test";
import assert from "node:assert/strict";
import { HUES, SHADES, OPACITIES, validHex, mix, shade, lighter, darker, luminance, palette, colorName, lookOf, shownLook, setLook, autoLooks } from "../../web/js/core/part_look.js";
import { signature } from "../../web/js/core/review.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";

test("a colour is a six-digit code ; a shade pulls it toward white or toward black", () => {
  assert.equal(validHex("#3D86E6"), "#3d86e6"); assert.equal(validHex("abc"), "#aabbcc"); assert.equal(validHex("3d86e6"), "#3d86e6");
  for (const bad of ["", null, undefined, "#12", "red", "#12345g", 12]) assert.equal(validHex(bad), null);
  assert.equal(mix("#000000", -1), "#ffffff"); assert.equal(mix("#ffffff", 1), "#000000"); assert.equal(mix("#808080", 0), "#808080"); assert.equal(mix("nope", 0.2), null);
  assert.equal(shade("#3d86e6", 0), "#3d86e6"); assert.ok(luminance(shade("#3d86e6", -2)) > luminance(shade("#3d86e6", -1)) && luminance(shade("#3d86e6", -1)) > luminance("#3d86e6"));
  assert.ok(luminance(shade("#3d86e6", 2)) < luminance(shade("#3d86e6", 1)) && luminance(shade("#3d86e6", 1)) < luminance("#3d86e6")); assert.equal(shade("#3d86e6", 9), shade("#3d86e6", 2));
  assert.ok(luminance(lighter("#3d86e6")) > luminance("#3d86e6") && luminance(darker("#3d86e6")) < luminance("#3d86e6")); assert.equal(lighter("#ffffff"), "#ffffff"); assert.equal(darker("#000000"), "#000000");
});

test("the picker offers a row per colour and a column per shade, every cell its own colour and its name", () => {
  const P = palette(), cells = P.flatMap((r) => r.cells);
  assert.equal(P.length, HUES.length); assert.ok(P.every((r) => r.cells.length === SHADES.length)); assert.equal(cells.length, 55);
  assert.equal(new Set(cells.map((c) => c.hex)).size, cells.length, "no two cells alike"); assert.ok(cells.every((c) => validHex(c.hex) === c.hex));
  assert.equal(colorName("#3d86e6"), "Bleu franc"); assert.equal(colorName(shade("#ee8a32", -1)), "Orange clair"); assert.equal(colorName("#123456"), "#123456"); assert.equal(colorName("x"), "");
  assert.deepEqual(OPACITIES.map((o) => o.v), [1, 0.6, 0.3]);
});

test("a part keeps what its designer chose ; nothing is kept for an opaque part of the colour of its material", () => {
  const p = { id: "P-1", material: "AL6061-T6" };
  assert.deepEqual(lookOf(p), { color: null, opacity: null, pattern: null, sheen: null }); assert.deepEqual(shownLook(p, "#b9c6ce"), { color: "#b9c6ce", opacity: 1, pattern: null, sheen: "satin", own: false });
  setLook(p, { color: "#3D86E6" }); assert.deepEqual(p.look, { color: "#3d86e6" }); assert.deepEqual(shownLook(p, "#b9c6ce"), { color: "#3d86e6", opacity: 1, pattern: null, sheen: "satin", own: true });
  setLook(p, { opacity: 0.6 }); assert.deepEqual(p.look, { color: "#3d86e6", opacity: 0.6 }); setLook(p, { opacity: 1 }); assert.deepEqual(p.look, { color: "#3d86e6" });
  setLook(p, { opacity: 0.01 }); assert.equal(p.look.opacity, 0.2, "never invisible"); setLook(p, { color: null }); assert.deepEqual(p.look, { opacity: 0.2 }); assert.equal(shownLook(p, "#b9c6ce").color, "#b9c6ce");
  setLook(p, { opacity: null }); assert.equal("look" in p, false); setLook(p, { color: "not a colour" }); assert.equal("look" in p, false);
  assert.deepEqual(lookOf({ look: { color: "zzz", opacity: "0.5", pattern: "tartan", sheen: 3 } }), { color: null, opacity: null, pattern: null, sheen: null });
});

test("one colour per part : the parts without a colour get one each, different, and the chosen ones stay", () => {
  const parts = Array.from({ length: 14 }, (_, k) => ({ id: `P-${k + 1}` })); parts[2].look = { color: HUES[1].hex };
  const A = autoLooks(parts);
  assert.equal(A.size, 13); assert.equal(A.has("P-3"), false); assert.equal(new Set([...A.values(), HUES[1].hex]).size, 14, "all different, the chosen one included");
  assert.ok([...A.values()].every((h) => validHex(h) === h)); assert.equal(autoLooks([]).size, 0); assert.equal(autoLooks(parts.map((p) => ({ ...p, look: { color: "#111111" } }))).size, 0);
});

test("a look is not a change of the design : same signature, and it travels in the file", () => {
  const p = { id: "P-1", name: "Essai", material: "AL6061-T6", features: [{ id: "f1", op: "box", size: [10, 10, 5] }] }, was = signature(p);
  setLook(p, { color: "#e8554b", opacity: 0.3 }); assert.equal(signature(p), was);
  const text = toDwiz(p); assert.match(text, /look color="#e8554b" opacity=0\.3/); assert.deepEqual(fromDwiz(text).look, { color: "#e8554b", opacity: 0.3 });
});

test("the look paints the main body of the built part ; a body with a colour of its own keeps it", async () => {
  const K = await kernel(), buildSpec = (k, x) => buildPart(k, x);
  const spec = { id: "P-1", material: "AL6061-T6", features: [{ id: "f1", op: "box", size: [20, 10, 5] }, { id: "f2", op: "box", size: [4, 4, 4], at: [0, 0, 5], body: "plot", mode: "new" }], bodies: { plot: { color: "#111111" } } };
  const plain = buildSpec(K, spec), main = (b) => b.bodies.find((x) => x.name === "main"), plot = (b) => b.bodies.find((x) => x.name === "plot");
  assert.equal(main(plain).color, "#b9c6ce"); assert.equal(main(plain).opacity, 1);
  const painted = buildSpec(K, { ...spec, look: { color: "#3d86e6", opacity: 0.6 } });
  assert.equal(main(painted).color, "#3d86e6"); assert.equal(main(painted).opacity, 0.6); assert.deepEqual(main(painted).rgb.map((v) => Math.round(v * 255)), [61, 134, 230]);
  assert.equal(plot(painted).color, "#111111"); assert.equal(plot(painted).opacity, 1); assert.equal(Math.round(main(painted).volume), Math.round(main(plain).volume), "the shape is the same");
});
