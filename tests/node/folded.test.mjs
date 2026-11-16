/* Folded sheet metal : the « folded » block built by the real kernel, its flat pattern and DXF, the measured bend rules,
   the routing sheet, and the part the Shop writes from an intent. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { foldedFacts, compileFolded, flatPattern, flatPoint, flatHoles, holeToBend, holeToEdge, foldSteps, K_FACTOR, FOLD_SIDES } from "../../web/js/cad/family_folded.js";
import { foldedDxf, flatCutouts } from "../../web/js/draw/dxf_folded.js";
import { parseDxf } from "../../web/js/draw/dxf.js";
import { polyArea } from "../../web/js/cad/profile.js";
import { checkPart, RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { applyPatch } from "../../web/js/analysis/dfx_core.js";
import { routing } from "../../web/js/cad/shop.js";
import { processPlan } from "../../web/js/cad/process_plan.js";
import { toFeatureScript } from "../../web/js/cad/featurescript.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { synthesize, recommend } from "../../web/js/core/shop_intent.js";
import { canFold, foldSides, FOLD_RULES, foldBrief } from "../../web/js/core/shop_folded.js";
import { specialRows, SOURCES } from "../../web/js/cad/special_processes.js";
import { LANGUAGE_REFERENCE } from "../../web/js/cad/language_doc.js";

const K = await kernel();
const t = 1.5, r = 1.5, R = 3, bend = Math.PI / 4 * (R * R - r * r);                       // section of one bend : a quarter ring
const part = (folded, features = [], more = {}) => ({ dw: "part/1", id: "T-FOLD", name: "Tôle pliée", family: "sheet", process: "sheet_metal", material: "AL5052-H32", params: {}, interfaces: [], folded, features, ...more });
const close = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what} : ${got} instead of ${want}`);
const ids = (out) => out.findings.filter((f) => f.severity !== "info").map((f) => f.id).sort();

test("the block reads itself : radius, bend allowance, where each edge runs — and refuses what cannot be folded", () => {
  const F = foldedFacts({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "+Y", h: 12, dir: "down" }] });
  assert.deepEqual([F.L, F.W, F.t, F.r, F.R, F.k, F.relief, F.corners], [80, 50, 1.5, 1.5, 3, K_FACTOR, 3.5, 1]);
  close(F.ba, Math.PI / 2 * (r + K_FACTOR * t), 1e-3, "developed length of a 90° bend");
  const [x, y] = F.flanges; assert.deepEqual([x.from, x.to, y.from, y.to, x.dir, y.dir, x.id, y.id], [0, 46.5, 0, 76.5, "up", "down", "pli_droite", "pli_arriere"]);
  close(x.flat, F.ba + 20 - R, 1e-3, "an edge on the flat : its bend and its wall");
  assert.equal(foldedFacts({ base: [80, 50], t, flanges: [] }).r, t, "no radius given : one thickness");
  assert.equal(Object.keys(FOLD_SIDES).length, 4);
  assert.throws(() => foldedFacts({ base: [80], t }), /folded\.base/);
  assert.throws(() => foldedFacts({ base: [80, 50], t, flanges: [{ side: "+Z", h: 10 }] }), /inconnu/);
  assert.throws(() => foldedFacts({ base: [80, 50], t, flanges: [{ side: "+X", h: 10 }, { side: "+X", h: 12 }] }), /même côté/);
  assert.throws(() => foldedFacts({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 3 }] }), /plus court que son pli/);
  assert.throws(() => foldedFacts({ base: [8, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "-X", h: 20 }, { side: "+Y", h: 20 }] }), /dégagements d'angle/);
});

test("the kernel builds one solid with true bend radii : an angle, a U, a tray with notched corners, an edge folded down", () => {
  const vol = (folded) => { const b = buildPart(K, part(folded)); assert.deepEqual(b.log.filter((l) => l.level === "error"), []); assert.equal(b.bodies.length, 1); return b; };
  let b = vol({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }] });
  close(b.volume, 6000 + (bend + t * 17) * 50, 0.5, "angle"); assert.deepEqual(b.bbox.map((v) => Math.round(v * 100) / 100), [0, 0, 0, 83, 50, 20]);
  b = vol({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "-X", h: 20 }] }); close(b.volume, 6000 + 2 * (bend + t * 17) * 50, 0.5, "U");
  b = vol({ base: [80, 50], t, r, flanges: [{ side: "-Y", h: 20, dir: "down" }] });
  close(b.volume, 6000 + (bend + t * 17) * 80, 0.5, "edge folded down"); assert.deepEqual(b.bbox.map((v) => Math.round(v * 100) / 100), [0, -3, -18.5, 80, 50, 1.5]);
  b = vol({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "-X", h: 20 }, { side: "+Y", h: 12 }, { side: "-Y", h: 12 }] });
  close(b.volume, (4000 - 4 * 3.5 * 3.5) * t + 2 * (bend + t * 17) * 43 + 2 * (bend + t * 9) * 73, 0.5, "tray : four edges, four square reliefs");
  assert.equal(b.facts.folded.corners, 4); assert.equal(b.facts.stock.folded, true); assert.match(b.facts.stock.label, /flan développé 120,8 × 74,8 mm/);
  b = vol({ base: [80, 50], t, r: 0, flanges: [{ side: "+X", h: 20 }] }); close(b.volume, 6000 + (Math.PI / 4 * t * t + t * 18.5) * 50, 0.5, "sharp inside corner");
  const bad = buildPart(K, part({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 2 }] }));
  assert.ok(bad.log.some((l) => l.level === "error" && /Tôle pliée/.test(l.msg)), "an edge shorter than its bend is an error of the part, not a crash");
  assert.deepEqual(validateSpec(part({ base: [80, 50], t, flanges: [] }, undefined, { features: undefined })).errors.filter((e) => /géométrie/.test(e)), [], "a folded block is geometry enough");
});

test("the flat pattern : a cross for a tray, bend lines in the middle of each bend, holes carried from the base and from the edges", () => {
  const F = compileFolded({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "-X", h: 20 }, { side: "+Y", h: 12 }, { side: "-Y", h: 12 }] }).facts, flat = F.flat;
  assert.equal(flat.outline.length, 12, "a cross has twelve corners"); assert.deepEqual(flat.size, [120.786, 74.786]); assert.deepEqual(flat.min, [-20.393, -12.393]);
  close(Math.abs(polyArea(flat.outline)), (80 - 7) * 74.786 + 2 * (20.393 + 3.5) * (50 - 7), 0.01, "area of the cross : the bar of the long edges and the two arms, each reaching the notch");
  assert.deepEqual(flat.bends.map((b) => [b.side, b.angle, b.dir, b.r]), [["+X", 90, "up", 1.5], ["-X", 90, "up", 1.5], ["+Y", 90, "up", 1.5], ["-Y", 90, "up", 1.5]]);
  assert.deepEqual([flat.bends[0].a, flat.bends[0].b], [[81.697, 3.5], [81.697, 46.5]], "the bend line sits half a bend allowance beyond the base");
  const one = flatPattern(foldedFacts({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }] }));
  assert.deepEqual(one.outline, [[0, 0], [100.393, 0], [100.393, 50], [0, 50]], "an angle unfolds to a rectangle"); assert.deepEqual(one.size, [100.393, 50]);
  assert.deepEqual(flatPoint(F, "+Z", [40, 25]), [40, 25]); assert.deepEqual(flatPoint(F, "+X", [25, 12]), [92.393, 25]); assert.deepEqual(flatPoint(F, "-Y", [40, 8]), [40, -8.393]);
  assert.equal(flatPoint(F, "+X", [25, 2]), null, "a point in the bend has no place on the flat");
  const H = flatHoles(F, [{ at: [40, 25, 20], axis: [0, 0, -1], d: 5, through: true, face: "+Z", source: "h1" }, { at: [83, 25, 12], axis: [-1, 0, 0], d: 4, depth: 1.5, face: "+X", source: "h2" },
    { at: [40, -3, 8], axis: [0, 1, 0], d: 3, through: true, face: "-Y", source: "h3" }, { at: [83, 10, 2], axis: [-1, 0, 0], d: 2, depth: 1.5, face: "+X", source: "h4" }, { at: [20, 20, 20], axis: [0, 0, -1], d: 3, depth: 0.5, face: "+Z", source: "blind" }]);
  assert.deepEqual(H.list.map((h) => [h.source, h.x, h.y, h.d]), [["h1", 40, 25, 5], ["h2", 92.393, 25, 4], ["h3", 40, -8.393, 3], ["h3", 40, 58.393, 3]], "a hole drilled through from an edge also pierces the edge across ; a blind hole is not a cut");
  assert.deepEqual(H.lost, ["h4"]);
});

test("the DXF of the flat pattern : what is cut on CUT, the bend lines on BEND, the figures of the fold in the notes", () => {
  const spec = part({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "-X", h: 20 }, { side: "+Y", h: 12 }] },
    [{ op: "hole", id: "h1", face: "+Z", at: [40, 25], d: 5, depth: "through" }, { op: "hole", id: "h2", face: "+X", at: [25, 12], d: 4, depth: 1.5 }, { op: "pocket", id: "p1", face: "+Z", rect: [20, 10, 12, 8], r: 1, depth: "through" }, { op: "pocket", id: "p2", face: "+X", rect: [10, 1, 6, 6], depth: 1.5 }]);
  const b = buildPart(K, spec), r1 = foldedDxf(b, spec.features), d = parseDxf(r1.text);
  assert.ok(d.eof); assert.deepEqual(d.layers.filter((l) => l.name !== "0").map((l) => [l.name, l.linetype]), [["CUT", "CONTINUOUS"], ["BEND", "CENTER"], ["NOTES", "CONTINUOUS"]]);
  const of = (type, layer) => d.entities.filter((e) => e.type === type && e.layer === layer);
  assert.equal(of("POLYLINE", "CUT").length, 2, "the outline and the cut-out of the base"); assert.equal(of("LINE", "BEND").length, 3); assert.equal(of("LINE", "CUT").length, 0, "a bend line is never on the cut layer");
  assert.deepEqual(of("CIRCLE", "CUT").map((c) => [c.cx, c.cy, c.r]), [[40, 25, 2.5], [92.393, 25, 2]]);
  const notes = of("TEXT", "NOTES").map((x) => x.text).join(" | ");
  assert.match(notes, /PLI 90 VERS LE HAUT R1\.5/); assert.match(notes, /TOLE 1\.5 mm - 3 PLI\(S\)/); assert.match(notes, /FACTEUR K 0\.44, VALEUR TYPIQUE : A CORRIGER PAR L'ATELIER/);
  assert.deepEqual(r1.warnings.length, 1); assert.match(r1.warnings[0], /p2/, "a cut-out that touches a bend is reported, not drawn");
  assert.equal(flatCutouts(b.facts.folded, spec.features).loops.length, 1);
  assert.throws(() => foldedDxf(buildPart(K, { dw: "part/1", id: "B", name: "b", params: {}, interfaces: [], features: [{ op: "box", size: [10, 10, 2] }] })), /folded/);
});

test("the bend rules are measured, each with its one-click fix : radius, edge height, hole near a bend, hole near a free edge, corner relief", () => {
  const spec = part({ base: [80, 50], t, r: 0.5, relief: 1, flanges: [{ side: "+X", h: "h" }, { side: "-X", h: 20 }, { side: "+Y", h: 12 }] },
    [{ op: "hole", id: "ok", face: "+Z", at: [40, 25], d: 5, depth: "through" }, { op: "hole", id: "pres_du_pli", face: "+Z", at: [76, 25], d: 4, depth: "through" }, { op: "hole", id: "pres_du_bord", face: "+Z", at: [40, 3], d: 3, depth: "through" }, { op: "hole", id: "haut_du_bord", face: "-X", at: [25, 18], d: 3, depth: 1.5 }],
    { params: { h: { value: 5, min: 2, max: 60, step: 1, unit: "mm", label: "Hauteur" } } });
  const out = checkPart(spec, buildPart(K, spec), {}), by = (id) => out.findings.filter((f) => f.id === id);
  assert.deepEqual(out.skipped, []); assert.deepEqual(ids(out), ["SM-01", "SM-02", "SM-03", "SM-04", "SM-04", "SM-07"]);
  assert.equal(by("SM-01")[0].limit, 1.5); assert.equal(by("SM-02")[0].severity, "error"); assert.match(by("SM-02")[0].message, /Bord plié droite haut de 5 mm/);
  assert.equal(by("SM-03")[0].feature, "pres_du_pli"); assert.equal(by("SM-03")[0].value, 2); assert.equal(by("SM-03")[0].limit, 4.25);
  assert.deepEqual(by("SM-04").map((f) => [f.feature, f.value]).sort((x, y) => y[1] - x[1]), [["pres_du_bord", 1.5], ["haut_du_bord", 0.5]], "a hole near the free edge of the base, another near the top of a folded edge");
  assert.equal(by("SM-07")[0].limit, 3.5, "the relief is asked for the radius the sheet needs, so one pass of fixes is enough");
  let fixed = spec; for (const f of out.findings) if (f.fix) fixed = applyPatch(fixed, f.fix.patch);
  assert.deepEqual([fixed.folded.r, fixed.folded.relief, fixed.params.h.value, fixed.folded.flanges[0].h], [1.5, 3.5, 6, "h"], "a height written as a parameter is fixed on the parameter");
  assert.deepEqual(ids(checkPart(fixed, buildPart(K, fixed), {})), ["SM-03", "SM-04", "SM-04"], "what is left has no automatic fix : the holes are the designer's to move");
  const F = buildPart(K, spec).facts.folded;
  assert.deepEqual(holeToBend(F, { at: [76, 25, 1.5], axis: [0, 0, -1], d: 4, face: "+Z" }), { gap: 2, side: "+X" }); assert.equal(holeToEdge(F, { at: [40, 3, 1.5], axis: [0, 0, -1], d: 3, face: "+Z" }), 1.5);
  const sm = RULEBOOK.find((x) => x.process === "sheet_metal").rules; assert.ok(sm.find((x) => x.id === "SM-01").fix && sm.find((x) => x.id === "SM-07").fix && !sm.find((x) => x.id === "SM-01").manual);
  const flatBlank = { dw: "part/1", id: "P", name: "p", process: "laser_cut", material: "AL5052-H32", params: {}, interfaces: [], folded: { base: [60, 40], t, r, flanges: [{ side: "+X", h: 12 }] }, features: [] };
  assert.ok(checkPart(flatBlank, buildPart(K, flatBlank), {}).findings.some((f) => f.id === "LC-02" && /bords pliés/.test(f.message)), "a folded part is not a flat laser-cut plate");
});

test("the routing : the blank is the flat pattern, the holes are cut in the flat, one line per bend, a bending phase in the plan", () => {
  const spec = part({ base: [80, 50], t, r, flanges: [{ side: "+X", h: 20 }, { side: "+Y", h: 12, dir: "down" }] },
    [{ op: "hole", id: "h1", face: "+Z", at: [40, 25], d: 5, depth: "through" }, { op: "hole", id: "h2", face: "+X", at: [25, 12], d: 4, depth: 1.5 }, { op: "hole", id: "h3", face: "+Z", at: [20, 25], thread: "M4", depth: "through" }]);
  const b = buildPart(K, spec), r1 = routing(spec, b), text = r1.steps.map((s) => `${s.kind}:${s.text}`);
  assert.match(text[0], /^stock:Approvisionner : Tôle de 1,5 mm, flan développé/); assert.match(text[1], /^cut:Découper le développé au laser/);
  assert.ok(text.includes("cut:Découper Ø5 dans la même passe") && text.includes("cut:Découper Ø4 dans la même passe"), "a hole as deep as the sheet is cut with the blank");
  const bends = r1.steps.filter((s) => s.kind === "bend"); assert.equal(bends.length, 2);
  assert.match(bends[0].text, /Plier le bord droite à 90° vers le haut — rayon intérieur 1,5 mm, hauteur extérieure 20 mm, ligne de pliage de 46,5 mm/); assert.match(bends[1].text, /arrière à 90° vers le bas/);
  const order = r1.steps.map((s) => s.kind); assert.ok(order.indexOf("hole") < order.indexOf("bend") && order.lastIndexOf("bend") < order.indexOf("finish"), "tapping in the flat, then the bends, then deburring");
  assert.ok(r1.tools.some((x) => /Presse plieuse : poinçon R1,5, vé de 9 à 12 mm/.test(x))); assert.ok(r1.advice.some((a) => /Ordre des plis/.test(a))); assert.ok(r1.utilisation > 0.6 && r1.utilisation < 1);
  assert.deepEqual(foldSteps(b.facts.folded).map((s) => s.side), ["+X", "+Y"]);
  const plan = processPlan(spec, b, { route: r1 }), fold = plan.phases.find((p) => p.key === "bend");
  assert.ok(fold && fold.title === "Pliage" && fold.station === "Presse plieuse" && fold.ops.length === 2);
});

test("the part round-trips : .dwiz with its folded block, FeatureScript with its edges, the language reference and the report row", () => {
  const spec = part({ base: ["L", 50], t, r, flanges: [{ side: "+X", h: "h", dir: "up" }, { side: "-Y", h: 12, dir: "down" }] }, [{ op: "hole", id: "h1", face: "+Z", at: [40, 25], d: 5, depth: "through" }],
    { params: { L: { value: 80, min: 20, max: 300, step: 1, unit: "mm", label: "Longueur" }, h: { value: 20, min: 8, max: 80, step: 1, unit: "mm", label: "Hauteur" } } });
  const text = toDwiz(spec); assert.match(text, /^folded base=\[L, 50\] t=1\.5 r=1\.5$/m); assert.match(text, /^ {2}flange \+X h=h dir=up$/m); assert.match(text, /# Sa tôle — la base et ses bords pliés/);
  const back = fromDwiz(text); assert.deepEqual((Array.isArray(back) ? back[0] : back).folded, spec.folded);
  const fs = toFeatureScript(spec); assert.equal(fs.skipped.length, 0); assert.equal(fs.converted, 4, "the base, two folded edges and the hole"); assert.ok(fs.warnings.some((w) => /Tôle pliée/.test(w)));
  assert.match(LANGUAGE_REFERENCE, /## 6b\. Folded sheet metal/); assert.match(LANGUAGE_REFERENCE, /"flanges": \[ \{"side":"\+X","h":"h","dir":"up"\}/);
  const rows = specialRows([spec, { id: "X", process: "cnc_milling", material: "AL6061-T6" }]); assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(0, 3), ["T-FOLD", "Tôle pliée", "Sheet metal bending"]); assert.match(rows[0][5], /2 plis à 90° · tôle 1,5 mm · rayon intérieur 1,5 mm/);
});

test("the Shop writes a folded part from the intent : a side that carries an interface folds, the base keeps its holes away from the bend", () => {
  const brief = { name: "Équerre de capteur", material: "AL5052-H32", quantity: 10, interfaces: [
    { type: "bolt_pattern", name: "Fixation châssis", where: "-Z", side: "A", params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 1, dx: 40, dy: 0 } } },
    { type: "bolt_pattern", name: "Capteur", where: "+X", side: "A", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 1, dx: 20, dy: 0 } } }] };
  assert.ok(canFold("AL5052-H32") && canFold("SS-304") && !canFold("PA12") && !canFold("NOMEX-410") && !canFold("FR4"));
  assert.deepEqual(foldSides(brief), ["+X"]); assert.deepEqual(foldSides({ ...brief, folds: { sides: ["-Y", "+X"] } }), ["+X", "-Y"]); assert.deepEqual(foldSides({ ...brief, material: "PA12" }), []);
  assert.deepEqual([recommend(brief).form, recommend(brief).process], ["sheet", "sheet_metal"]);
  const res = synthesize(brief, "T-EQ"), s = res.spec;
  assert.deepEqual([s.family, s.process, s.stock], ["sheet", "sheet_metal", undefined]); assert.deepEqual(s.folded, { base: ["L", "W"], t: "t", r: "r", flanges: [{ side: "+X", h: "h", dir: "up" }] });
  assert.deepEqual([s.params.t.value, s.params.r.value], [1.5, 1.5]); assert.ok(s.params.h.value >= 4 * 1.5 + 1.5);
  assert.deepEqual(s.interfaces.map((i) => [i.face, i.level, i.opts && i.opts.depth]), [["-Z", 0, undefined], ["+X", undefined, "t + 0.5"]], "an interface of a folded edge only pierces that edge");
  assert.ok(res.decisions.some((d) => /Un seul rayon intérieur de 1,5 mm/.test(d)) && res.decisions.some((d) => /Trous à 5,25 mm au moins de chaque pli/.test(d)));
  const b = buildPart(K, s); assert.deepEqual(b.log.filter((l) => l.level === "error"), []); assert.equal(b.bodies.length, 1);
  assert.deepEqual(ids(checkPart(s, b, {})), [], "the part the Shop writes passes its own bend rules");
  const r1 = routing(s, b); assert.equal(r1.steps.filter((x) => x.kind === "bend").length, 1); assert.equal(r1.steps.filter((x) => x.kind === "hole").length, 0, "every hole is cut in the flat");
  const tray = synthesize({ name: "Bac", material: "SS-304", form: "sheet", folds: { sides: ["+X", "-X", "+Y", "-Y"], h: 30, dir: "down" }, interfaces: [{ type: "bolt_pattern", name: "Fond", where: "+Z", side: "A", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 60, dy: 40 } } }] }, "T-BAC").spec;
  assert.equal(tray.folded.flanges.length, 4); assert.ok(tray.folded.flanges.every((f) => f.dir === "down")); assert.equal(tray.params.h.value, 30); assert.equal(tray.interfaces[0].level, "t");
  const tb = buildPart(K, tray); assert.equal(tb.bodies.length, 1); assert.equal(tb.facts.folded.corners, 4); assert.deepEqual(ids(checkPart(tray, tb, {})), []);
  const flat = synthesize({ name: "Platine", material: "AL5052-H32", form: "sheet", interfaces: [brief.interfaces[0]] }, "T-PL").spec;
  assert.deepEqual([flat.process, flat.folded, flat.stock && flat.stock.form], ["laser_cut", undefined, "sheet"], "without a folded side the sheet stays a flat laser-cut blank");
});

test("the sheet of the process says what was read and what was not", () => {
  assert.equal(FOLD_RULES.chips.length, 6); assert.match(FOLD_RULES.basis, /seuls des résumés de recherche/); assert.match(FOLD_RULES.basis, /Aucun guide n'a été lu en entier/);
  const mine = SOURCES.filter((x) => x.id.startsWith("pliage")); assert.equal(mine.length, 2); assert.ok(mine.every((x) => x.how === "résumé"), "nothing here was read in full : the sources say so");
  const brief = foldBrief(); assert.match(brief, /TÔLERIE PLIÉE/); assert.match(brief, /"folded": \{ "base"/); assert.match(brief, /la table de pliage de l'atelier fait foi/);
});
