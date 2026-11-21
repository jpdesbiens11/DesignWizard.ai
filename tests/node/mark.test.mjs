/* Laser marking (JP, 21 novembre 2026 : « label with laser marking on the busbar surface around each contact interface ») : the single-stroke
   font of the tool and the operation « mark » of the part language — a text engraved in a face, read the right way from outside.
     node --test tests/node/mark.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textStrokes, textWidth, unmarkable, MARK_CHARS } from "../../web/js/cad/stroke_font.js";
import { buildPart } from "../../web/js/cad/build.js";
import { toFeatureScript } from "../../web/js/cad/featurescript.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const box = (strokes) => strokes.reduce((b, [a, c, d, e]) => [Math.min(b[0], a, d), Math.min(b[1], c, e), Math.max(b[2], a, d), Math.max(b[3], c, e)], [Infinity, Infinity, -Infinity, -Infinity]);

test("the font of the tool : capitals, digits and a few signs, a few strokes each ; a text is centred where it is put, read along its direction", () => {
  for (const c of "ABCDEFGHIKLMNOPRSTUVWXYZ0123456789+-./") assert.ok(MARK_CHARS.includes(c), c);
  assert.deepEqual(unmarkable("HV1 − rs485 a"), [], "a lower case letter is marked as its capital, the minus sign as a hyphen"); assert.deepEqual(unmarkable("Ω é"), ["Ω", "é"]);
  assert.equal(textStrokes("HV1 +", { h: 3 }).length, 10); assert.equal(textWidth("HV1 +", 3), 14);
  const s = textStrokes("RS485 A", { h: 2.5, at: [10, 20] }), b = box(s);
  assert.ok(Math.abs((b[0] + b[2]) / 2 - 10) < 0.6 && Math.abs((b[1] + b[3]) / 2 - 20) < 1e-9, "centred on its point"); assert.ok(Math.abs(b[3] - b[1] - 2.5) < 1e-9, "capitals 2.5 high");
  const back = textStrokes("HV1", { h: 3, dir: [-1, 0], up: [0, 1] }); assert.ok(back[0][0] > back[back.length - 1][0], "read toward −X : the first letter is at the +X end");
});

test("« mark » engraves the text in a face, as deep as asked, the right way up from outside ; a sign the font has not is refused", async () => {
  const K = await kernel(), plate = (marks) => ({ dw: "part/1", id: "M", name: "m", process: "laser_cut", material: "CU-C110", params: {}, interfaces: [],
    features: [{ op: "box", at: [0, 0, 0], size: [40, 2, 20] }, ...marks] });
  const bare = buildPart(K, plate([])), v0 = K.props(bare.bodies[0].shape).volume;
  const b = buildPart(K, plate([{ op: "mark", face: "+Y", at: [20, 10], text: "HV1 +", h: 3, w: 0.3, depth: 0.05, dir: [-1, 0] }]));
  assert.deepEqual(b.log.filter((l) => l.level === "error"), []); const cut = v0 - K.props(b.bodies[0].shape).volume;
  assert.ok(cut > 0.05 && cut < 14 * 3 * 0.05, `the strokes take a little copper : ${cut.toFixed(3)} mm³`);
  const gone = K.cut(bare.bodies[0].shape, [b.bodies[0].shape]), bb = K.bbox(gone);
  assert.ok(Math.abs(bb[1] - 1.95) < 1e-3 && Math.abs(bb[4] - 2) < 1e-3, "0.05 deep, from the face"); assert.ok(bb[0] > 12 && bb[3] < 28 && bb[2] > 8 && bb[5] < 12, "where it was put");
  assert.deepEqual(b.facts.marks.map((m) => [m.text, m.face]), [["HV1 +", "+Y"]]);
  const bad = buildPart(K, plate([{ op: "mark", face: "+Y", at: [20, 10], text: "Ω 1" }])); assert.ok(bad.log.some((l) => l.level === "error" && /ne se marque pas/.test(l.msg)));
});

test("wired : the language says it, the tree names it, FeatureScript leaves it to the drawing", () => {
  assert.match(read("web/js/cad/language_doc.js"), /"op":"mark"/); assert.match(read("web/js/core/part_edit.js"), /mark: "Laser marking"/);
  const fs = toFeatureScript({ dw: "part/1", id: "M", name: "m", process: "laser_cut", material: "CU-C110", params: {}, interfaces: [], features: [{ op: "box", at: [0, 0, 0], size: [40, 2, 20] }, { op: "mark", face: "+Y", at: [20, 10], text: "HV1 +" }] });
  assert.match(typeof fs === "string" ? fs : fs.code, /marquage laser « HV1 \+ »/);
});
