/* Point 7 (JP) : a NEW demonstration — the die-cast housing of a three-phase traction inverter mounted on the cylinder of its motor ; curved
   sides, chamfered corners, cavities of different depths ; a stamped cover with flanges and a glued silicone gasket ; a small cover underneath ;
   potting ; connectors (three AC, DC + / −), filter, control board, power board under the IGBTs, IGBTs, DC-link capacitor, laminated busbars.
     node --test tests/node/inverter.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inverterProject, outline, MOTOR, Z0, ZTOP } from "../../web/js/demo/demo_inverter.js";
import { buildPart } from "../../web/js/cad/build.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { matFromPlacement } from "../../web/js/cad/vec.js";
import { partTexts, drawingTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
let cache = null;
async function world() {
  if (cache) return cache;
  const K = await kernel(), p = inverterProject(), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)])), A = p.assemblies[0], flat = flatAsm(A, (id) => p.assemblies.find((a) => a.id === id));
  const placed = flat.instances.map((i) => ({ id: i.id, part: i.part, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, matFromPlacement(i.placement)) })) }));
  cache = { K, p, built, placed, box: (id) => K.bbox(placed.find((x) => x.id === id).bodies[0].shape) }; return cache;
}

test("every part of the inverter builds without error ; the housing is die cast, the cover stamped, the bought items are envelopes", async () => {
  const { p, built } = await world();
  assert.equal(p.parts.length, 16); for (const s of p.parts) assert.deepEqual(built.get(s.id).log.filter((l) => l.level === "error").map((l) => l.text || l.msg), [], s.id);
  const H = p.parts.find((s) => s.id === "INV-HOUSING"); assert.equal(H.process, "die_casting"); assert.equal(p.parts.find((s) => s.id === "INV-COVER").process, "sheet_metal");
  for (const s of p.parts.filter((x) => x.process === "purchased" && x.id !== "INV-MOTOR" && x.id !== "INV-GASKET" && x.id !== "INV-POTTING")) assert.match(s.name, /enveloppe|Carte/, `${s.id} : a generic envelope, said`);
  assert.ok(H.features.filter((f) => f.op === "pocket" && f.face === "+Z").map((f) => f.depth).length >= 3, "cavities of different depths");
  assert.deepEqual([...new Set(H.features.filter((f) => /^cavite/.test(f.id)).map((f) => ZTOP - f.depth))].sort((a, b) => a - b), [118, 125, 140]);
});

test("the housing sits on the motor : a saddle that follows the cylinder, four lugs on the pads ; the cover over the gasket, the small cover underneath", async () => {
  const { box } = await world(), h = box("boitier"), m = box("moteur"), c = box("couvercle"), g = box("joint"), b = box("couvercle_dessous");
  assert.ok(Math.abs(h[2] - Z0) < 0.5 && h[2] < MOTOR.d / 2, "the housing goes down below the top of the motor : a saddle");
  assert.ok(Math.abs(g[2] - ZTOP) < 0.01 && Math.abs(c[5] - (ZTOP + 3.5)) < 0.01, "the gasket on the sealing face, the cover above it");
  assert.ok(b[3] > MOTOR.L && Math.abs(b[5] - Z0) < 0.01, "the small cover under the overhang, past the end of the motor");
  assert.ok(m[3] <= MOTOR.L + 0.01);
  const o = outline(0).poly, xs = o.map((p) => p[0]); assert.ok(Math.min(...xs) < 10 && Math.max(...xs) === 250, "a curved end over the motor, chamfered corners on the connector end");
});

test("the inverter closes : nothing goes through anything", async () => {
  const { K, placed } = await world(), bb = (s) => K.bbox(s), ov = (a, b) => a[0] < b[3] && b[0] < a[3] && a[1] < b[4] && b[1] < a[4] && a[2] < b[5] && b[2] < a[5], out = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) { const A = placed[i], B = placed[j];
    for (const a of A.bodies) for (const b of B.bodies) { if (!ov(bb(a.shape), bb(b.shape))) continue; const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${A.id}/${a.name} × ${B.id}/${b.name} : ${v.toFixed(3)}`); } }
  assert.deepEqual(out, []);
  K.flush();
});

test("every text its drawings write has its English ; no word kept that nobody reads ; the home offers it", () => {
  const p = inverterProject(), texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  assert.match(read("web/js/modules/home.js"), /inverterProject\(\)/); assert.doesNotMatch(JSON.stringify(p), /Infineon|Semikron|Tesla|Bosch|TE Connectivity|Amphenol/i, "no brand");
});
