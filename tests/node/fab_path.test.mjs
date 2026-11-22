/* The virtual fabrication shop, corrected (JP, 21 novembre 2026 : « seules les pièces machinées et moulées, extrudées, stampées ou découpées
   au laser peuvent être animées… tu ne devrais pas rendre une démo de la gamme qui est fausse… voir l'outil d'usinage bouger seulement pour
   les pièces usinées ou sur-usinées après moulage métallique… un parcours d'usinage avec les allers-retours IA »).
     node --test tests/node/fab_path.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fabPlayable, toolMoves, parseGcode, passesOf, pathIssues, faceOf, timeline, tipAt, pathAsk, FAB_TOOLS } from "../../web/js/core/fab_path.js";
import { emptyState, blankSpec } from "../../web/js/core/fab_flow.js";
import { processPlan, stateSpec } from "../../web/js/cad/process_plan.js";
import { buildPart } from "../../web/js/cad/build.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { DEMO_ROCKET } from "../../web/js/demo/demo_rocket.js";
import { DEMO_PATHS } from "../../web/js/demo/demo_paths.js";
import { bmProject } from "../../web/js/demo/demo_bm.js";
import { downOf } from "../../web/js/core/stairs.js";
import { glossary } from "../../web/js/core/terms.js";
import { kernel } from "./kernel_helper.mjs";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("the shop plays only what it can show right : machined, moulded or cast, extruded, stamped, laser-cut — never a board, a flex, a laminate, a print", () => {
  for (const p of ["cnc_milling", "cnc_turning", "injection_molding", "die_casting", "sand_casting", "extrusion_al", "sheet_metal", "laser_cut"]) assert.ok(fabPlayable({ process: p }).ok, p);
  for (const p of ["pcb", "purchased", "fdm", "mjf", "sla", "lpbf", undefined]) { const r = fabPlayable({ process: p }); assert.ok(!r.ok && r.why && r.short, String(p)); }
  assert.ok(!fabPlayable({ process: "laser_cut", flex: {} }).ok, "a flex is not played, whatever its process says");
  const bm = bmProject(); assert.ok(!fabPlayable(bm.parts.find((p) => p.id === "BM-BB-LAM")).ok, "the laminated busbar of JP's capture : not played"); assert.ok(!fabPlayable(bm.parts.find((p) => p.id === "BM-FLEX-BASE")).ok);
  assert.ok(!downOf("parts", ["BM-BB-LAM"], bm).some((d) => /#\/fab\//.test(d.hash)), "no step down to the shop for a part it does not play");
  assert.ok(toolMoves({ process: "cnc_milling" }, { key: "setup:+Z" }) && toolMoves({ process: "die_casting" }, { key: "rework" }) && toolMoves({ process: "extrusion_al" }, { key: "setup:-Z" }), "machined, machined after casting or extrusion : the tool moves");
  assert.ok(!toolMoves({ process: "injection_molding" }, { key: "rework" }) && !toolMoves({ process: "laser_cut" }, { key: "setup:+Z" }) && !toolMoves({ process: "cnc_milling" }, { key: "deburr" }), "elsewhere, it does not");
});

test("a tool path is read from the G-code an AI writes — moves, arcs, drilling cycles — and what it cannot read is said", () => {
  const g = parseGcode("(spot)\nG21 G90\nG0 X10 Y10 Z-30\nG81 X10 Y10 Z1 R-2\nX70\nG80\nG0 Z5\nG1 X20 Y0 F200\nG3 X0 Y20 I-20 J0 ; a quarter turn\n");
  assert.deepEqual(g.errors, []); assert.deepEqual(g.moves.slice(0, 5), [[0, 10, 10, -30], [0, 10, 10, -30], [0, 10, 10, -2], [1, 10, 10, 1], [0, 10, 10, -2]], "a cycle : over the hole, down to R, feed to Z, back to R");
  const last = g.moves[g.moves.length - 1]; assert.deepEqual(last.slice(1).map(Math.round), [0, 20, 5], "the arc ends where it was asked");
  assert.ok(g.moves.filter((m) => m[0] === 1).length > 5, "the arc is cut in small segments");
  assert.match(parseGcode("G20\nG0 X1 Y1 Z1").errors.join(), /millimètres/); assert.match(parseGcode("G91\nG0 X1 Y1 Z1").errors.join(), /absolu/); assert.match(parseGcode("G0 X1 Y1").errors.join(), /sans Z/); assert.match(parseGcode("G0 X0 Y0 Z1\nG73 X1").errors.join(), /G73 n'est pas lu/);
  const spec = { plan: { paths: { "setup:+Z": [{ tool: "drill", d: 5, moves: [[0, 0, 0, 10], [1, 0, 0, -9], [0, 0, 0, 10], [0, 0, 0, 4], [7, 0, 0, 0]] }, { tool: "laser-sword", d: 0, moves: [[0, 0, 0, 1]] }] } } };
  const ps = passesOf(spec, "setup:+Z"), issues = pathIssues(ps, { bbox: [-20, -20, 0, 20, 20, 6], face: faceOf("setup:+Z") }), text = issues.map((x) => `${x.level} ${x.text}`).join("\n");
  assert.match(text, /error .*illisible/); assert.match(text, /error .*inconnu/); assert.match(text, /error .*diamètre/); assert.match(text, /error .*moins de deux/);
  assert.match(text, /warn .*l'étau/, "a drill 9 mm under a 6 mm part goes into the vise"); assert.match(text, /warn .*rapide/, "a rapid down into the material");
  const tl = timeline(ps.slice(0, 1)); assert.ok(tl.T > 0 && tl.length > 18); assert.deepEqual(tipAt(tl, 0).p, [0, 0, 10]); assert.deepEqual(tipAt(tl, tl.T).p, [0, 0, 4]);
});

test("the demo paths, written by an AI for three parts of interest, are read clean against the part as it stands before their phase", async () => {
  const K = await kernel(), parts = [...DEMO_DRIVE.parts, ...DEMO_ROCKET.parts];
  assert.deepEqual(Object.keys(DEMO_PATHS), ["DRV-HEATSINK", "FUS-5010", "FUS-1030"]);
  for (const [id, paths] of Object.entries(DEMO_PATHS)) {
    const spec = parts.find((p) => p.id === id), built = buildPart(K, spec), plan = processPlan(spec, built); assert.deepEqual(spec.plan.paths, paths, `${id} carries its paths`);
    for (const key of Object.keys(paths)) {
      const i = plan.phases.findIndex((ph) => ph.key === key); assert.ok(i > 0, `${id} : ${key} is a phase of its routing`); assert.ok(toolMoves(spec, plan.phases[i]), `${id} : the tool moves in ${key}`);
      const sp = stateSpec(spec, plan, i - 1); let pre = sp ? buildPart(K, sp) : built; if (emptyState(pre)) pre = buildPart(K, blankSpec(spec, built));
      const ps = passesOf(spec, key); assert.ok(ps.every((p) => p.by && p.note && FAB_TOOLS[p.tool]), `${id} : each pass says who wrote it and what to discuss`);
      assert.deepEqual(pathIssues(ps, { bbox: pre.bbox, face: faceOf(key), lathe: spec.process === "cnc_turning" }), [], `${id} ${key}`);
    }
  }
  const disc = parts.find((p) => p.id === "FUS-5010"), b = buildPart(K, disc), plan = processPlan(disc, b), s0 = stateSpec(disc, plan, 0);
  assert.ok(emptyState(s0 ? buildPart(K, s0) : null), "the disc is all made by its machining : nothing stands after the cut");
  const blank = buildPart(K, blankSpec(disc, b)); assert.deepEqual(blank.bbox.map(Math.round), b.bbox.map(Math.round), "so it stands as its assumed blank, the box of the part");
  assert.equal(blankSpec({ ...disc, process: "cnc_turning" }, b).features.length, 1, "a bar on a lathe");
  const tube = parts.find((p) => p.id === "FUS-1030"), tb = blankSpec(tube, buildPart(K, tube)); assert.deepEqual(tb.features.map((f) => [f.op, f.mode || "", f.d]), [["cylinder", "", 205.2], ["cylinder", "cut", 194.8]], "a part hollow from end to end : a tube, 1 mm of stock on each side");
  K.flush();
});

test("what goes to Claude : the request of the phase, its holes, the frame and the format — and the screen says the AI writes, the tool reads", () => {
  const spec = DEMO_DRIVE.parts.find((p) => p.id === "DRV-HEATSINK"), ph = { key: "setup:-Z", n: 20, title: "Usinage — posage 1, dessous", ops: [{ n: "20.1", text: "Percer 4 × Ø3,3 et tarauder M4" }] };
  const a = pathAsk(spec, ph, [{ d: 3.3, depth: 6, face: "-Z", at: [10, 10, 0], axis: [0, 0, 1], thread: "M4" }, { d: 9, face: "+Z", at: [0, 0, 27] }], [0, 0, 0, 80, 86, 27], false);
  assert.match(a.ask, /phase 20/); const help = a.help.join("\n"); assert.match(help, /plan paths/); assert.match(help, /G81/); assert.match(help, /face -Z/); assert.match(help, /Ø3,3 en \(10, 10, 0\)/); assert.doesNotMatch(help, /Ø9/, "only the holes of the face"); assert.match(help, /pas un programme de machine/);
  const scr = read("web/js/modules/fab.js"); assert.match(scr, /Demander le parcours à Claude/); assert.match(scr, /il ne l'écrit pas/); assert.match(scr, /Brut SUPPOSÉ/); assert.match(scr, /Ne se jouent pas ici/); assert.match(scr, /ne se joue pas à l'atelier/);
  assert.ok(glossary().some((r) => r.en === "Spot drill" && r.fr === "foret à centrer"), "the tools of a path in the glossary");
});
