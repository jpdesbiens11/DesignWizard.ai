// Isolation of a board ALONE (demande de JP : « analyse PCBA ou analyse Assy ») : the scene built from the real copper of the board, measured
// by the common engine — its polygons enclose the copper, its laminate has its holes, its nets are grouped by potential.
//   node --test tests/node/board_iso.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shapePoly, triangulate, boardIsoScene, boardLevels, levelName, exactGap, refine, pathNets, netAt } from "../../web/js/pcba/board_iso.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { ptSeg, polyArea, gap } from "../../web/js/pcba/geom2d.js";
import { prepareScene, measurePair } from "../../web/js/analysis/cc_paths.js";
import { BUILTIN, DEFAULT_PARAMS, requirement } from "../../web/js/analysis/cc_rules.js";
import { boardIsolationGuide, boardLevelNames } from "../../web/js/analysis/cc_guide.js";
import { stairOf, downOf, aiTargetOf } from "../../web/js/core/stairs.js";
import { projectIssues } from "../../web/js/core/guide_checks.js";
import { METHODS } from "../../web/js/core/methods.js";
import { NEWS } from "../../web/js/core/whats_new.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const engine = (S) => prepareScene(S.bodies.map((b) => ({ id: b.id, name: b.name, kind: b.kind, net: b.net, group: b.group, printed: b.printed, pos: b.pos, idx: b.idx })), {});
const volume = (b) => { let v = 0; for (let i = 0; i < b.idx.length; i += 3) { const p = [0, 1, 2].map((k) => [b.pos[3 * b.idx[i + k]], b.pos[3 * b.idx[i + k] + 1], b.pos[3 * b.idx[i + k] + 2]]); v += (p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0])) / 6; } return v; };
/* a board of two pads, one on each face, with or without a bare hole beside them */
const PAD = { PAD: { id: "PAD", kind: "testpoint", prefix: "TP", name: "Pad", pins: [{ n: 1, name: "1", type: "passive" }], pads: [{ n: 1, x: 0, y: 0, w: 2, h: 2, shape: "rect" }], body: [2, 2, 0.1] } };
const twoFaces = (holes) => ({ dw: "board/1", id: "T", name: "Two faces", parts: [{ ref: "P1", comp: "PAD", at: [12, 10], side: "top" }, { ref: "P2", comp: "PAD", at: [12, 10], side: "bottom" }, { ref: "P3", comp: "PAD", at: [24, 4], side: "top" }],
  nets: [{ name: "A", class: "power", voltage: 48, pins: ["P1.1"] }, { name: "B", class: "ground", voltage: 0, pins: ["P2.1"] }], board: { size: [30, 20], t: 1.6, layers: 2, copper: 35, holes }, tracks: [], vias: [], planes: [] });

test("round copper is described by a polygon that ENCLOSES it : a distance measured is never longer than the true one", () => {
  for (const s of [{ a: [0, 0], b: [10, 0], r: 0.3 }, { a: [2, 1], b: [5, 7], r: 0.6 }, { a: [3, 3], b: [3, 3], r: 0.45 }]) {
    const poly = shapePoly(s); assert.equal(poly.length, 16); assert.ok(polyArea(poly) > 0, "counter-clockwise");
    let near = Infinity;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; assert.ok(ptSeg(p, s.a, s.b) >= s.r - 1e-9, "no vertex inside the copper");
      for (let k = 0; k <= 10; k++) near = Math.min(near, ptSeg([p[0] + (q[0] - p[0]) * k / 10, p[1] + (q[1] - p[1]) * k / 10], s.a, s.b)); }
    assert.ok(Math.abs(near - s.r) < 1e-9, `its sides are tangent to the copper (${near} for ${s.r})`);
    assert.ok(Math.max(...poly.map((p) => ptSeg(p, s.a, s.b))) <= s.r * 1.02, "and it sticks out by less than 2 % of the radius");
  }
  assert.deepEqual(shapePoly({ rect: [1, 2, 3, 5] }), [[1, 2], [3, 2], [3, 5], [1, 5]]);
});

test("the laminate keeps its holes : a polygon with holes is cut into triangles of the same area, all the same way round", () => {
  const ring = (x, y, r) => { const o = []; for (let i = 0; i < 16; i++) o.push([x + r * Math.cos(-i * Math.PI / 8), y + r * Math.sin(-i * Math.PI / 8)]); return o; };
  for (const [outline, holes] of [[[[0, 0], [60, 0], [60, 90], [0, 90]], [ring(5, 5, 1.7), ring(55, 5, 1.7), ring(5, 85, 1.7), ring(55, 85, 1.7)]], [[[0, 0], [40, 0], [40, 10], [10, 10], [10, 30], [0, 30]], [ring(5, 20, 2), ring(30, 5, 1.5)]], [[[0, 0], [10, 0], [10, 10], [0, 10]], []]]) {
    const T = triangulate(outline, holes); let area = 0;
    for (let i = 0; i < T.tris.length; i += 3) { const [a, b, c] = [T.pts[T.tris[i]], T.pts[T.tris[i + 1]], T.pts[T.tris[i + 2]]], s = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2; assert.ok(s > 0, "counter-clockwise, never flat"); area += s; }
    const want = Math.abs(polyArea(outline)) - holes.reduce((n, h) => n + Math.abs(polyArea(h)), 0); assert.ok(Math.abs(area - want) < 1e-6, `${area} for ${want}`);
    assert.equal(T.loops.length, 1 + holes.length);
  }
});

test("the scene of the demonstration board : its nets by potential, one body of copper per net, a closed laminate, and what is left out said", () => {
  const board = demoBoard(), R = resolveBoard(board, LIBRARY), S = boardIsoScene(board, LIBRARY);
  assert.deepEqual(S.levels.map((l) => [l.name, l.nets.length]), [["24 V", 9], ["5 V", 1], ["3,3 V", 3], ["0 V", 22]]); assert.equal(levelName(-12.5), "−12,5 V");
  assert.deepEqual(boardLevels(R, { "24 V": "ac" }).map((l) => l.kind), ["ac", "dc", "dc", "dc"]);
  const lam = S.bodies[0]; assert.deepEqual([lam.id, lam.kind, lam.printed, lam.group], ["board", "insulator", true, "IIIa"]); assert.equal(boardIsoScene(board, LIBRARY, { cti: 600 }).bodies[0].group, "I");
  const holes = R.holes.reduce((n, h) => n + 8 * Math.sin(Math.PI / 8) * (h.d / 2) ** 2, 0);      // a hole is a 16-sided polygon inscribed in its circle
  assert.ok(Math.abs(volume(lam) - (Math.abs(polyArea(R.outline)) - holes) * R.t) < 1e-2, `the laminate is closed, outward, its holes through : ${volume(lam)}`);
  const cu = S.bodies.filter((b) => b.kind === "conductor"); assert.equal(cu.length, 35); assert.ok(cu.every((b) => b.id === `Cu:${b.boardNet}` && S.levels.some((l) => l.name === b.net && l.nets.includes(b.boardNet))), "a body per net, under its potential");
  for (const b of S.bodies) { assert.ok(b.idx.length % 3 === 0 && Math.max(...b.idx) < b.pos.length / 3 && b.mesh.nrm.length === b.pos.length && b.mesh.epos.length % 6 === 0, b.id); assert.ok(volume(b) > 0, `${b.id} : outward`); }
  assert.equal(new Set(S.bodies.filter((b) => b.kind === "floating").map((b) => b.id.split("@")[0])).size, R.pads.filter((p) => !p.net).length, "a pad no net reaches is a floating conductor");
  assert.deepEqual(S.notes.map((n) => n.id), ["inner", "bare", "holes"]); assert.match(S.notes[0].text, /2 couches internes ne sont pas mesurées/); assert.match(S.notes[1].text, /corps des composants ne comptent pas/);
  const planed = boardIsoScene({ ...board, planes: [{ net: "GND", layer: "top", inset: 0.5 }] }, LIBRARY).notes.find((n) => n.id === "plane"); assert.ok(planed && planed.warn && /n'est pas représenté/.test(planed.text), "a plane on an outer layer is said not to be measured");
  assert.ok(S.shapes.every((x) => x.layer === "top" || x.layer === "bottom"), "the outer layers only");
});

test("the engine measures the copper of the board : equal to the exact gap or a little shorter, made exact where the path is straight", () => {
  const S = boardIsoScene(demoBoard(), LIBRARY), scene = engine(S), exact = exactGap(S, "5 V", "3,3 V");
  let own = Infinity; for (const x of S.shapes) if (x.level === "5 V") for (const y of S.shapes) if (y.level === "3,3 V" && y.layer === x.layer) own = Math.min(own, gap(x.s, y.s));
  assert.equal(exact, own); assert.ok(Math.abs(exact - 0.35) < 1e-9, `the two closest coppers of 5 V and 3,3 V : ${exact} mm`);
  const r = measurePair(scene, "5 V", "3,3 V", { x: 1, maxClearance: 12, maxCreepage: 12 });
  for (const m of [r.clearance, r.creepage]) assert.ok(m.d <= exact + 1e-6 && m.d >= exact - 0.03, `never longer, shorter by a few microns at most : ${m.d}`);
  assert.equal(r.creepage.printed, true, "the path runs on printed wiring");
  const f = refine(S, r, "5 V", "3,3 V"); assert.equal(f.creepage.d, exact); assert.equal(f.clearance.d, exact); assert.ok(f.creepage.exact && f.clearance.exact);
  const bent = refine(S, { clearance: { d: exact - 0.2, path: [[0, 0, 2], [1, 0, 2]], via: [] }, creepage: { d: exact - 0.01, path: [[0, 0, 2], [1, 0, 2], [2, 1, 2]] } }, "5 V", "3,3 V");
  assert.ok(!bent.clearance.exact && !bent.creepage.exact, "a shorter way found by the engine, or a path that bends, is left as measured");
  const who = pathNets(S, r.creepage.path, "5 V", "3,3 V"); assert.deepEqual([who.a, who.b], ["+5V", "+3V3"]); assert.ok(who.layer === "top" || who.layer === "bottom");
  assert.equal(netAt(S, [-50, -50, 2]), null, "far from any copper : no name");
});

test("from one face to the other : through a bare hole when there is one, round the edge otherwise", () => {
  const S = boardIsoScene(twoFaces([{ at: [15, 10], d: 3 }]), PAD), r = measurePair(engine(S), "48 V", "0 V", { x: 1, maxClearance: 12, maxCreepage: 12 });
  assert.equal(exactGap(S, "48 V", "0 V"), null, "the two potentials share no face : no straight gap");
  assert.ok(Math.abs(r.creepage.d - 2.6) < 0.06, `0,5 mm to the hole, 1,6 mm down its wall, 0,5 mm back : ${r.creepage.d}`); assert.ok(Math.abs(r.clearance.d - 2.6) < 0.1, `the same way through the air : ${r.clearance.d}`);
  const who = pathNets(S, r.creepage.path, "48 V", "0 V"); assert.deepEqual([who.a, who.b, who.layer], ["A", "B", "both"]);
  assert.equal(refine(S, r, "48 V", "0 V").creepage.d, r.creepage.d, "nothing to make exact : the path turns");
  assert.equal(S.bodies.filter((b) => b.kind === "floating").length, 1, "the third pad has no net : a floating conductor");
  const solid = measurePair(engine(boardIsoScene(twoFaces([]), PAD)), "48 V", "0 V", { x: 1, maxClearance: 12, maxCreepage: 12 });
  assert.ok(solid.creepage.d === null && solid.creepage.capped, "without the hole the only way is round the edge, 9 mm away : beyond the 12 mm searched");
});

test("on a board, a pair left at Functional : no dielectric test sets its clearance — a choice of the tool, said where it applies", () => {
  const a = { name: "24 V", kind: "dc", voltage: 24 }, b = { name: "0 V", kind: "dc", voltage: 0 }, P = { ...DEFAULT_PARAMS, level: "functional" };
  const inCircuit = requirement({ ...BUILTIN, validation: { ...BUILTIN.validation, clearance_covers_hipot: false } }, P, a, b, "functional"), barrier = requirement(BUILTIN, P, a, b, "basic");
  assert.equal(inCircuit.clearance_mm, 0.2); assert.equal(inCircuit.creepage_mm.PCB, 0.2); assert.equal(barrier.clearance_mm, 0.5);
  const mod = read("web/js/modules/creepage_board.js"), scr = read("web/js/modules/creepage.js");
  assert.match(mod, /BOARD_RULES = \{ \.\.\.BUILTIN, validation: \{ \.\.\.BUILTIN\.validation, clearance_covers_hipot: false \} \}/); assert.match(mod, /aucun essai diélectrique ne fixe la clearance entre deux nets d'un même circuit \(choix de l'outil\)/);
  assert.match(scr, /inCircuit = onBoard && level === "functional"/); assert.match(scr, /requirement\(inCircuit \? BOARD_RULES : BUILTIN/); assert.match(scr, /req\.steps\.push\(FUNCTIONAL_NOTE\); req\.tests = null/);
  assert.match(scr, /\.\.\.\(onBoard \? \{ level: "functional" \} : \{\}\)/, "a board starts at Functional ; an assembly keeps Basic");
  const m = METHODS.find((x) => x.id === "board-functional"); assert.ok(m && m.how === "own" && m.kind === "convention" && /aucune norme/i.test(m.check), "the register says it is a choice of the tool");
});

test("the screen offers a board or an assembly ; the stairs, the guide, the report and the register follow", () => {
  const scr = read("web/js/modules/creepage.js"), mod = read("web/js/modules/creepage_board.js");
  assert.match(scr, /wantBoard = args\[0\] === "board"/); assert.match(scr, /field\("Ce que l'on analyse", subjectPicker\(onBoard \? "board" : "asm", id\)/); assert.match(mod, /Cartes \(PCBA\) — une carte seule/); assert.match(mod, /Assemblages — le produit monté/); assert.match(mod, /#\/creepage\/board\//);
  assert.match(scr, /Le cuivre d'une carte ne se voit pas dans l'assemblage/, "an assembly with no pair points at the board");
  assert.match(scr, /refine\(st\.scene, r0, r0\.a, r0\.b\)/); assert.match(scr, /pathNets\(st\.scene, far, r\.a, r\.b\)/); assert.match(scr, /focusPair\(key\)/); assert.match(read("web/js/core/viewer.js"), /focus\(p, span = 20\)/);
  const b = { ...demoBoard(false), id: "B1", name: "Carte" }, p = { id: "p", name: "P", parts: [], assemblies: [{ id: "TOP", name: "Top", instances: [], mates: [] }], boards: [b] };
  assert.equal(stairOf("creepage", ["board", "B1"], p).hash, "#/pcba/B1"); assert.ok(downOf("pcba", ["B1"], p).some((d) => d.hash === "#/creepage/board/B1" && /la carte seule/.test(d.tip)), "a step down from the PCBA, and the same step up");
  assert.equal(stairOf("creepage", ["TOP"], p).hash, "#/assembly/TOP"); assert.equal(aiTargetOf("creepage", ["board", "B1"], p).key, "board:B1"); assert.equal(aiTargetOf("creepage", ["TOP"], p).key, "assembly:TOP");
  /* the guide : a board never analysed asks for nothing ; one analysed says its pairs in fault and its stale results */
  assert.deepEqual(boardIsolationGuide(b), []); assert.ok(boardLevelNames(b).some((l) => l.name === "24 V"));
  const bad = { ...b, isolation: { results: [{ a: "24 V", b: "0 V", ok: false, clr: 0.29, clrReq: 0.5, crp: 0.32, crpReq: 0.5 }, { a: "5 V", b: "0 V", ok: true }] } }, g = boardIsolationGuide(bad);
  assert.equal(g.length, 1); assert.equal(g[0].level, "error"); assert.match(g[0].text, /B1 — isolation de la carte seule : 1 paire en défaut — 24 V ↔ 0 V \(clearance 0,29 mm pour 0,5 requis\)/);
  assert.match(boardIsolationGuide({ ...bad, isolation: { results: [{ a: "400 V", b: "0 V", ok: true }] } })[0].text, /résultats périmés/);
  const issue = projectIssues({ ...p, boards: [bad] }).find((x) => x.screen === "creepage" && x.ref === "B1"); assert.ok(issue && issue.hash === "#/creepage/board/B1" && issue.si, "the guide of the project leads to the board");
  const rep = read("web/js/modules/report.js"); assert.match(rep, /\[\.\.\.store\.assemblies, \.\.\.store\.boards\]\.flatMap/); assert.match(rep, /Isolation de la carte seule — /);
  for (const id of ["board-iso", "board-functional"]) { const m = METHODS.find((x) => x.id === id); assert.ok(m && m.group === "isolation" && m.doc === "docs/PCBA.md", id); }
  assert.match(METHODS.find((x) => x.id === "board-iso").check, /0,35 mm/); assert.match(read("docs/PCBA.md"), /## Isolation d'une carte seule/);
  assert.ok(NEWS.some((n) => n.id === "iso-board" && /creepage/.test(n.where)), "what is new is tagged on the screen");
});
