// Core of DesignWizard.ai: expressions, profiles, the part builder (real kernel), interfaces, automatic mating,
// linked-interface propagation, the wand's language, the importer and the drawing composer.
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { evaluate, resolveParams, evalDeep } from "../../web/js/cad/expr.js";
import { normalizeProfile, profileArea } from "../../web/js/cad/profile.js";
import { profileMetrics } from "../../web/js/cad/profile_metrics.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { TEMPLATES, fromTemplate } from "../../web/js/cad/templates.js";
import { compatible, patternPoints } from "../../web/js/cad/interfaces.js";
import { solve, autoMate, hardware, bom, candidates } from "../../web/js/core/assembly_logic.js";
import { propagate, outOfSync, evaluatedParams } from "../../web/js/core/links.js";
import { interpret } from "../../web/js/core/nl.js";
import { companionSpec } from "../../web/js/core/companion.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { PdfSheet } from "../../web/js/draw/pdf.js";
import { composeDrawing, viewRequest, PAPER, holeTable } from "../../web/js/draw/part_drawing.js";
import { partPrompt, anticipatedInterfaces } from "../../web/js/core/prompts.js";
import { bboxTransform } from "../../web/js/cad/vec.js";

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("expressions: arithmetic, functions, parameters, errors", () => {
  close(evaluate("L/2 - 10", { L: 120 }), 50);
  close(evaluate("max(t, 2) * 2 + sin(30)", { t: 1 }), 4.5);
  close(evaluate("if(n > 3, 10, 20)", { n: 5 }), 10);
  assert.throws(() => evaluate("L + x", { L: 1 }), /Paramètre inconnu/);
  const { scope } = resolveParams({ L: { value: 100 }, half: { expr: "L/2" }, q: { expr: "half + 1" } });
  close(scope.q, 51);
  assert.throws(() => resolveParams({ a: { expr: "b" }, b: { expr: "a" } }), /boucle/);
  assert.deepEqual(evalDeep({ op: "hole", depth: "through", at: ["L/2", 3] }, { L: 10 }), { op: "hole", depth: "through", at: [5, 3] });
});

test("profiles: rectangle with radius, polygon fillets, SVG path, generators", () => {
  close(profileArea(normalizeProfile({ rect: [0, 0, 40, 20], r: 5 })), 800 - (4 - Math.PI) * 25, 0.3);       // arcs are flattened for the area
  close(profileArea(normalizeProfile({ outer: { rect: [0, 0, 40, 20] }, holes: [{ circle: [20, 10, 10] }] })), 800 - Math.PI * 25, 0.3);
  close(profileArea(normalizeProfile({ path: "M0 0 L10 0 L10 10 L0 10 Z" })), 100);
  const hs = normalizeProfile({ gen: "heatsink", W: 80, base: 5, fin: 18, tf: 2, n: 9 });
  const m = profileMetrics(hs);
  close(m.wallMin, 2, 0.05);
  assert.ok(m.tongueRatio > 1 && m.gapMin > 7 && m.ccd > 80);
  assert.equal(normalizeProfile({ gen: "tube", W: 60, H: 40, t: 2.5 }).holes.length, 1);
});

test("every template builds without error and carries its interfaces", async () => {
  const K = await kernel();
  for (const t of TEMPLATES) {
    const spec = fromTemplate(t.key, `T-${t.key}`);
    assert.deepEqual(validateSpec(spec).errors, []);
    const b = buildPart(K, spec);
    assert.deepEqual(b.log.filter((l) => l.level === "error"), [], `${t.key}: ${JSON.stringify(b.log)}`);
    assert.ok(b.volume > 0 && b.mass > 0, t.key);
    assert.equal(b.interfaces.length, (spec.interfaces || []).length);
    for (const body of b.bodies) assert.ok(K.isValid(body.shape), `${t.key}/${body.name} is not a valid solid`);
    K.flush();
  }
});

test("features: holes, pocket, shell, standoffs change the volume as expected", async () => {
  const K = await kernel();
  const base = { dw: "part/1", id: "X", material: "AL6061-T6", process: "cnc_milling", features: [{ op: "box", size: [40, 30, 10] }] };
  close(buildPart(K, base).volume, 12000, 1e-3);
  const holed = buildPart(K, { ...base, features: [...base.features, { op: "hole", face: "+Z", at: [20, 15], d: 6, depth: "through" }] });
  close(holed.volume, 12000 - Math.PI * 9 * 10, 0.05);
  assert.equal(holed.facts.holes.length, 1);
  const tapped = buildPart(K, { ...base, features: [...base.features, { op: "hole", face: "+Z", at: [20, 15], thread: "M4", depth: 8 }] });
  close(tapped.facts.holes[0].d, 3.3);
  const shell = buildPart(K, { ...base, features: [...base.features, { op: "shell", t: 2, open: ["+Z"] }] });
  close(shell.volume, 12000 - 36 * 26 * 8, 0.5);
  const bad = buildPart(K, { ...base, features: [...base.features, { op: "nope" }] });
  assert.match(bad.log[0].msg, /Opération inconnue/);
  K.flush();
});

test("interfaces: A/B compatibility by key and by signature", () => {
  const a = { type: "bolt_pattern", side: "A", key: "k", params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 50, dy: 40 } } };
  assert.equal(compatible(a, { ...a, side: "B" }).ok, true);
  assert.equal(compatible(a, { ...a, side: "A" }).ok, false);
  assert.equal(compatible(a, { ...a, side: "B", key: "other" }).ok, false);
  assert.equal(compatible({ ...a, key: undefined }, { ...a, side: "B", key: undefined, params: { screw: "M4", pattern: a.params.pattern } }).ok, false);
  assert.equal(patternPoints({ type: "circle", n: 6, pcd: 60 }).length, 6);
});

test("demo drive: parts build, the assembly mates itself and nothing collides in the box", async () => {
  const K = await kernel(), built = {};
  for (const s of DEMO_DRIVE.parts) { built[s.id] = buildPart(K, s); assert.deepEqual(built[s.id].log.filter((l) => l.level === "error"), [], s.id); }
  const asm = JSON.parse(JSON.stringify(DEMO_DRIVE.assemblies[0]));
  assert.equal(candidates(asm, built).length, 0);            // the demo ships with its mates
  const shipped = JSON.stringify(asm.mates.map((m) => [m.a, m.b]));
  asm.mates = [];
  assert.equal(autoMate(asm, built).length, 5);              // and the automatic mating finds the same ones
  assert.equal(JSON.stringify(asm.mates.map((m) => [m.a, m.b])), shipped);
  assert.equal(candidates(asm, built).length, 0);
  const sol = solve(asm, built);
  assert.deepEqual(sol.problems, []);
  assert.deepEqual(sol.floating, []);
  const box = (i) => bboxTransform(built[asm.instances.find((x) => x.id === i).part].bbox, sol.placements[i]);
  close(box("i2")[2], 8.5 - 0.07, 0.02);             // power board sits on its 6 mm standoffs (copper zone under it)
  close(box("i4")[2], 42, 1e-6);                     // cover on top of the base
  close(box("i5")[5], 0, 1e-6);                      // heat sink under the base, fins down
  close(box("i5")[2], -27, 1e-6);
  const hw = hardware(asm, built);
  assert.ok(hw.some((h) => h.id.startsWith("INSERT-M3")) && hw.some((h) => /ISO4762-M4/.test(h.id)));
  assert.ok(bom(DEMO_DRIVE, asm, built).length >= 7);
  K.flush();
});

test("linked interfaces: the partner adapts, through its own driving parameter when it has one", () => {
  const project = JSON.parse(JSON.stringify(DEMO_DRIVE));
  project.assemblies[0].mates = [{ id: "M1", a: { inst: "i2", iface: "IF1" }, b: { inst: "i1", iface: "IF1" }, linked: true }, { id: "M3", a: { inst: "i4", iface: "IF1" }, b: { inst: "i1", iface: "IF3" }, linked: true }];
  assert.deepEqual(outOfSync(project, project.assemblies[0]), []);
  const base = project.parts.find((p) => p.id === "DRV-BASE");
  base.interfaces[0].params.pattern.dx = 64; base.params.L.value = 170;
  const ch = propagate(project, "DRV-BASE");
  assert.equal(ch.length, 2);
  assert.equal(project.parts.find((p) => p.id === "DRV-PWR-PCB").params.mx.value, 64);       // the board's own parameter moved
  assert.equal(project.parts.find((p) => p.id === "DRV-COVER").params.sx.value, 158);       // cover screw spacing follows the longer base
  assert.deepEqual(outOfSync(project, project.assemblies[0]), []);
  project.assemblies[0].mates[0].linked = false;
  base.interfaces[0].params.pattern.dx = 60;
  assert.equal(propagate(project, "DRV-BASE").length, 0);                                    // an unlinked mate no longer propagates
  assert.equal(evaluatedParams(project.parts.find((p) => p.id === "DRV-PWR-PCB"), "IF1").pattern.dx, 64);
});

test("the wand: plain sentences become edits", async () => {
  const K = await kernel(), spec = fromTemplate("block", "B1"), built = buildPart(K, spec);
  const run = (text) => { const r = interpret(text, { spec, built }); assert.ok(r.length && r[0].apply, text); const s = JSON.parse(JSON.stringify(spec)); r[0].apply(s); return s; };
  assert.equal(run("longueur 150").params.L.value, 150);
  const h = run("4 trous M4 aux coins à 8 mm").features.at(-1);
  assert.deepEqual([h.op, h.d, h.at.grid.dx, h.at.grid.dy], ["hole", 4.5, 64, 34]);
  assert.equal(run("trou M6 taraudé au centre").features.at(-1).thread, "M6");
  assert.deepEqual(run("congé 3 vertical").features.at(-1), { op: "fillet", id: "r2", r: 3, edges: "vertical" });
  assert.equal(run("coque 2 ouverte dessus").features.at(-1).t, 2);
  assert.equal(run("matériau PA66-GF30").material, "PA66-GF30");
  assert.equal(interpret("bonjour", { spec, built }).length, 0);
  for (const text of ["4 trous M4 aux coins à 8 mm", "congé 3 vertical", "poche 40x20 profondeur 5"]) assert.deepEqual(buildPart(K, run(text)).log.filter((l) => l.level === "error"), [], text);
  K.flush();
});

test("companion part and prompt: the other side of a free interface", async () => {
  const K = await kernel(), base = DEMO_DRIVE.parts[0], built = buildPart(K, base);
  const comp = companionSpec(base, built, "IF6", "NEW-1");
  assert.equal(comp.interfaces[0].side, "B");
  assert.equal(comp.interfaces[0].key, "io_connector");
  assert.deepEqual(buildPart(K, comp).log.filter((l) => l.level === "error"), []);
  const ant = anticipatedInterfaces(DEMO_DRIVE, ["DRV-BASE"]);
  assert.equal(ant.length, 1);                              // the five other interfaces of the base are already mated
  assert.equal(ant[0].iface.side, "B");
  assert.equal(anticipatedInterfaces(DEMO_DRIVE, ["DRV-BASE"], false).length, 6);
  const prompt = partPrompt(DEMO_DRIVE, { name: "Support", neighbours: ["DRV-BASE"], extras: [], mode: "interview" });
  assert.match(prompt, /INTERFACES ANTICIPÉES/);
  assert.match(prompt, /"key": "io_connector"/);
  assert.match(prompt, /DW part\/1/);
  K.flush();
});

test("drawing: views, hole table and GD&T end in a valid PDF", async () => {
  const K = await kernel(), spec = DEMO_DRIVE.parts[0], built = buildPart(K, spec), views = {};
  for (const v of viewRequest()) views[v.name] = K.hlr(built.bodies[0].shape, v.dir, v.xdir, v.hidden);
  assert.ok(views.front.visible.length > 5 && views.top.visible.length > 5);
  const sheet = new PdfSheet({ width: PAPER.A3[0], height: PAPER.A3[1], title: spec.id });
  const info = composeDrawing(sheet, { spec, built, views, project: DEMO_DRIVE, opts: { date: "2026-01-01" } });
  assert.equal(info.holes.length, holeTable(built).length);
  assert.ok(info.gdt.some((g) => g.symbol === "position" && g.tolerance === 0.2 && g.modifier === "mmc"));      // M3: (3.4 - 3) / 2
  assert.equal(info.datums[0].letter, "A");
  const bytes = sheet.toBytes();
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)), "%PDF-1.4");
  assert.ok(bytes.length > 20000);
  K.flush();
});
