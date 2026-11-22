/* Point 14 (JP, 20 novembre 2026 : « c'est vraiment important ») : two complete teaching examples — an injection-moulded plastic part and a
   high-pressure die-cast part — whose whole flow is seen : design, routing played in the shop, the 2D drawing, what goes to the supplier.
     node --test tests/node/molded_examples.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moldedProject } from "../../web/js/demo/demo_molded.js";
import { buildPart } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { moldPlan, moldGuide } from "../../web/js/core/mold_plan.js";
import { fabPlayable } from "../../web/js/core/fab_path.js";
import { sceneOf, solidBox } from "../../web/js/core/fab_scene.js";
import { processPlan, stateSpec } from "../../web/js/cad/process_plan.js";
import { partTexts, wordsLeft, wordsUnused } from "../../web/js/core/drawing_words.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("each example builds, passes its DFx rules — the lesson is that it passes — and its mould says gate, parting line, slides", async () => {
  const K = await kernel(), p = moldedProject();
  for (const s of p.parts) { const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error"), [], s.id);
    const f = checkPart(s, b); assert.deepEqual((f.findings || f).filter((x) => x.severity === "error" || x.severity === "warn").map((x) => x.id || x.rule), [], `${s.id} : no DFx error or warning`);
    const mp = moldPlan(s, b); assert.ok(mp && mp.gate, `${s.id} : a gate`); assert.ok(moldGuide(mp).every((g) => g.level !== "error"), `${s.id} : nothing to correct in its mould`);
    assert.equal(fabPlayable(s).ok, true, `${s.id} : its routing is played in the shop`); }
  const [im, hp] = p.parts; assert.equal(im.process, "injection_molding"); assert.equal(hp.process, "die_casting");
  assert.equal(im.mold.gating.kind, "edge"); assert.equal(hp.mold.gating.kind, "ingate");
  assert.ok(im.features.some((f) => f.op === "pad" && f.draft) && im.features.some((f) => f.op === "boss" && f.draft) && im.features.some((f) => f.op === "tub" && f.draft), "ribs, bosses and walls drafted");
  assert.ok(hp.features.some((f) => f.op === "face") && hp.features.some((f) => f.op === "tap"), "cast, then reworked by machining");
  K.flush();
});

test("in the shop, the mould is THEIR mould : the halves part where the plan says, the sprue and the runner reach the gate it chose, the overflows face the ingate — and nothing of it enters the part", async () => {
  const K = await kernel(), [im, hp] = moldedProject().parts, inter = (a, b) => [0, 1, 2].reduce((v, k) => v * Math.max(0, Math.min(a[k + 3], b[k + 3]) - Math.max(a[k], b[k])), 1);
  const stage = (s) => { const b = buildPart(K, s), plan = processPlan(s, b), i = plan.phases.findIndex((p) => p.key === "stock"), st = stateSpec(s, plan, i), bb = st ? buildPart(K, st).bbox : b.bbox; return sceneOf(plan.phases[i], s.process, bb, moldPlan(s, b)); };
  const a = stage(im), byId = (sc, id) => sc.solids.find((x) => x.id === id), top = a.place.box[5];
  assert.equal(a.kind, "mould"); const fix = solidBox(byId(a, "half-fixed")), mov = solidBox(byId(a, "half-moving"));
  assert.ok(Math.abs(fix[5] - top) < 0.01 && Math.abs(mov[2] - top) < 0.01, "the shell : the halves part at its top rim — the core comes in from above");
  const run = byId(a, "runner"); assert.ok(run && Math.abs(run.b[1] - a.place.box[1]) < 0.01 && Math.abs(run.b[2] - top) < 0.01, "the runner ends on the −Y edge, at the parting line : an edge gate");
  const b = stage(hp), bf = solidBox(byId(b, "half-fixed")); assert.ok(Math.abs(bf[5]) < 0.01, "the bracket : the parting plane is its seating face, the cover die flat under it");
  const ing = solidBox(byId(b, "ingate")), ov = b.solids.filter((x) => /^overflow/.test(x.id)).map(solidBox);
  assert.ok(Math.abs(ing[0] - b.place.box[3]) < 0.01, "the ingate on +X"); assert.equal(ov.length, 3); assert.ok(ov.every((o) => o[3] < b.place.box[0]), "three overflows on −X, opposite the ingate");
  for (const sc of [a, b]) for (const x of sc.solids.filter((q) => !q.around)) assert.ok(inter(solidBox(x), sc.place.box) < 1e-3, `${x.id} stays out of the part`);
  K.flush();
});

test("every text of their drawings has its English ; the home offers them ; the doc says the flow and what was read", () => {
  const p = moldedProject(), texts = [...new Set(p.parts.flatMap((s) => partTexts(s, p)))];
  assert.deepEqual(wordsLeft(p.drawing.words, texts), []); assert.deepEqual(wordsUnused(p), []);
  assert.match(read("web/js/modules/home.js"), /moldedProject\(\)/);
  const doc = read("docs/EXEMPLES_MOULES.md"); for (const re of [/Atelier de fab/, /Dessins/, /\.pptx/, /dfx-mold/, /im-guide-read/, /Lu le 22 novembre 2026/, /sans nombre repris/]) assert.match(doc, re);
  assert.match(read("web/js/core/methods.js"), /M\("im-guide-read", "fab", "guide", "read"/, "the guide read has its line in the registry, with its true level");
});
