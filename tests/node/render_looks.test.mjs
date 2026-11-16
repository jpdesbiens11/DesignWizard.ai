/* The marketing render : finishes grouped by nature, what a body shows when nothing is chosen and when a finish is, the rows
   of the screen, the guide, the patterns as pixels, the texture coordinates of a mesh that has none, where the camera stands. */
import test from "node:test";
import assert from "node:assert/strict";
import { FINISH_GROUPS, FINISHES, SCENES, SHOTS, SIZES, blankRender, renderOf, defaultFinish, bodyLook, lookRows, renderGuide, patternPixels, boxUv, cameraFor, tidyRender } from "../../web/js/core/render_looks.js";
import { DEMO_ROCKET } from "../../web/js/demo/demo_rocket.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { methodById } from "../../web/js/core/methods.js";

test("finishes are grouped by nature, each group with its colour ; scenes, points of view and sizes say what they are", () => {
  assert.deepEqual(FINISH_GROUPS.map((g) => g.id), ["paint", "metal", "plastic", "composite", "clear"]); assert.equal(new Set(FINISH_GROUPS.map((g) => g.color)).size, 5);
  assert.equal(Object.keys(FINISHES).length, 15);
  for (const [k, f] of Object.entries(FINISHES)) { assert.ok(FINISH_GROUPS.some((g) => g.id === f.group), k); assert.ok(f.fr && f.text, k); assert.ok(f.metal >= 0 && f.metal <= 1 && f.rough > 0 && f.rough <= 1 && f.coat >= 0 && f.coat <= 1, k); if (f.pattern) assert.ok(f.period > 0, k); }
  for (const g of FINISH_GROUPS) assert.ok(Object.values(FINISHES).some((f) => f.group === g.id), g.id);
  assert.deepEqual(Object.keys(SCENES), ["studio", "dark", "sky"]); assert.deepEqual(Object.keys(SHOTS), ["hero", "side", "front", "low", "top"]); assert.deepEqual([SIZES.hd.w, SIZES.hd.h, SIZES.uhd.w], [1920, 1080, 3840]);
  assert.equal(methodById("render-finishes").how, "own");
});
test("a body shows the finish of its material until one is chosen for its part", () => {
  assert.equal(defaultFinish("AL6061-T6"), "metal-brushed"); assert.equal(defaultFinish("ABS"), "plastic-grain"); assert.equal(defaultFinish("SILICONE"), "rubber"); assert.equal(defaultFinish("FR4"), "laminate"); assert.equal(defaultFinish("PMMA", 0.45), "clear-plastic");
  const alu = { name: "main", material: "AL6061-T6", color: "#b9c6ce" };
  assert.deepEqual(bodyLook(alu), { finish: "metal-brushed", color: "#b9c6ce", opacity: 1, metal: 1, rough: 0.36, coat: 0, pattern: "brushed", period: 30 });
  const red = bodyLook(alu, { finish: "paint-gloss", color: "#d6453d" }); assert.deepEqual([red.finish, red.color, red.metal, red.coat], ["paint-gloss", "#d6453d", 0, 1]);
  assert.equal(bodyLook(alu, { finish: "metal-polished", color: "#d6453d" }).color, "#d6453d", "a colour asked for is shown, even where the guide says the finish has its own");
  assert.equal(bodyLook(alu, { finish: "carbon" }).color, "#17191d", "carbon has its own black"); assert.equal(bodyLook(alu, { finish: "glass" }).opacity, 0.22);
  assert.equal(bodyLook({ name: "pneu", material: "SILICONE", color: "#26282b" }, { finish: "paint-gloss", color: "#ff0000" }).finish, "rubber", "the choice dresses the main body ; the others keep their material");
  assert.equal(bodyLook(alu, { finish: "hologram" }).finish, "metal-brushed", "an unknown finish is ignored");
});
test("the rows of the screen : one per part, with its quantity, its finish and whether it was chosen", () => {
  const asm = { instances: [{ id: "a", part: "P1" }, { id: "b", part: "P1" }, { id: "c", part: "P2" }, { id: "d", part: "GONE" }], render: { looks: { P1: { finish: "paint-satin", color: "#112233" } } } };
  const built = { P1: { main: "main", bodies: [{ name: "main", material: "ABS", color: "#e8e3d8" }] }, P2: { main: "main", bodies: [{ name: "main", material: "CU-C110", color: "#c8763f" }] } };
  assert.deepEqual(lookRows(asm, built, { P1: "Coque" }), [{ part: "P1", name: "Coque", qty: 2, finish: "paint-satin", label: "Satin paint", group: "paint", color: "#112233", chosen: true },
    { part: "P2", name: "P2", qty: 1, finish: "metal-brushed", label: "Brushed metal", group: "metal", color: "#c8763f", chosen: false }]);
  assert.deepEqual(renderOf({}).looks, {}); assert.equal(renderOf(asm).scene, "studio");
});
test("the guide : nothing chosen is a word of advice ; an unknown finish, a stray part, an unreadable colour are said", () => {
  assert.deepEqual(renderGuide({}, ["P1"]).map((x) => [x.level, x.field]), [["tip", "looks"]]);
  const g = (render, parts = ["P1"]) => renderGuide({ render }, parts).map((x) => `${x.level}:${x.field}`);
  assert.deepEqual(g({ looks: { P1: { finish: "paint-gloss", color: "#d6453d" } } }), []);
  assert.deepEqual(g({ scene: "moon", shot: "drone", size: "poster", looks: { P1: { finish: "paint-gloss" } } }), ["error:scene", "error:shot", "error:size"]);
  assert.deepEqual(g({ looks: { P9: { finish: "paint-gloss" } } }), ["warn:looks"]); assert.deepEqual(g({ looks: { P1: { finish: "chrome" } } }), ["error:looks"]);
  assert.deepEqual(g({ looks: { P1: { finish: "paint-gloss", color: "rouge" } } }), ["error:looks"]); assert.deepEqual(g({ looks: { P1: { finish: "metal-brushed", color: "#112233" } } }), ["tip:looks"]);
  assert.deepEqual(g({ shot: "drone", view: { az: 10, el: 5, dist: 900 }, looks: { P1: { finish: "rubber" } } }), [], "a kept view stands for the point of view");
});
test("patterns are tiles of grey levels, the same every time ; a mesh without texture coordinates gets them from its box", () => {
  for (const name of ["brushed", "weave", "grain", "flakes"]) { const a = patternPixels(name, 64), b = patternPixels(name, 64); assert.equal(a.length, 4096); assert.deepEqual(Array.from(a.slice(0, 64)), Array.from(b.slice(0, 64)), name); assert.ok(Math.min(...a) >= 90 && Math.max(...a) <= 255, name); }
  const br = patternPixels("brushed", 64), row = (y) => Array.from(br.slice(y * 64, y * 64 + 64)), spread = (v) => Math.max(...v) - Math.min(...v), col = (x) => Array.from({ length: 64 }, (_, y) => br[y * 64 + x]);
  assert.ok([0, 10, 20, 30].reduce((a, y) => a + spread(row(y)), 0) < [0, 10, 20, 30].reduce((a, x) => a + spread(col(x)), 0), "streaks run along x : a row varies less than a column");
  const w = patternPixels("weave", 64); assert.ok(Math.max(...w) - Math.min(...w) > 80, "the weave has over and under");
  assert.deepEqual(Array.from(boxUv([0, 0, 0, 10, 20, 30, 5, 6, 7.5], [0, 0, 1, 1, 0, 0, 0, -1, 0], 10)), [0, 0, 2, 3, 0.5, 0.75], "up : x and y ; sideways : y and z, or x and z");
});
test("the camera stands where the whole product fits : a slender one fills a tall picture", () => {
  const rocket = [-219, -219, 0, 219, 219, 3660], c = cameraFor(rocket, SHOTS.hero, 2 / 3);
  assert.deepEqual(c.target, [0, 0, 1830]); assert.equal(c.az, -35); assert.equal(c.el, 18);
  const tv = Math.tan(14 * Math.PI / 180), el = 18 * Math.PI / 180, top = (1830 * Math.cos(el)) / (c.dist - 1830 * Math.sin(el));          // the tip, as a share of the half height of the picture
  assert.ok(top / tv > 0.7 && top / tv <= 0.83, `the tip stands at ${(top / tv).toFixed(2)} of the half height`);
  assert.ok(cameraFor(rocket, SHOTS.hero, 3).dist === c.dist, "wider or taller, the height of the rocket decides");
  assert.ok(cameraFor([0, 0, 0, 3660, 438, 438], SHOTS.side, 16 / 9).dist < cameraFor([0, 0, 0, 3660, 438, 438], SHOTS.side, 2 / 3).dist, "a long product needs more room in a tall picture");
  assert.equal(cameraFor(rocket, { az: 0, el: 0, dist: 5000 }, 1).dist, 5000, "a kept distance is kept"); const e = cameraFor([0, 0, 0, 100, 100, 100], SHOTS.front, 1).eye; assert.ok(e[0] > 100 && Math.abs(e[1] - 50) < 1e-6);
});
test("a render put back in order, and the one of the rocket in its file", () => {
  const t = tidyRender({ scene: "moon", shot: "low", size: "x", ground: false, looks: { A: { finish: "paint-gloss", color: "white" }, B: { finish: "nope" }, C: { finish: "rubber", color: "#102030" } }, view: { az: "10", el: 5, dist: 900 } });
  assert.deepEqual(t, { scene: "studio", shot: "low", size: "hd", ground: false, labels: true, looks: { A: { finish: "paint-gloss" }, C: { finish: "rubber", color: "#102030" } }, view: { az: 10, el: 5, dist: 900 } });
  assert.deepEqual(tidyRender(null), blankRender());
  const asm = DEMO_ROCKET.assemblies[0], back = fromDwiz(toDwiz(asm));
  assert.deepEqual(back.render, JSON.parse(JSON.stringify(asm.render))); assert.match(toDwiz(asm), /\nrender scene=studio shot=hero size=portrait ground=true labels=true\n/); assert.match(toDwiz(asm), /\n  look FUS-4060 paint-gloss color="#d6453d"\n/);
  assert.deepEqual(renderGuide(asm, DEMO_ROCKET.parts.map((p) => p.id)), []); assert.deepEqual(tidyRender(asm.render), asm.render);
});
