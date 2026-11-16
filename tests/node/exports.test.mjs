// Exports of a part: binary STL, DXF (views, profile, flat outline) and Onshape FeatureScript.
// FeatureScript cannot be run against Onshape here: besides the structural checks, the generated script is executed by a
// small emulation of the Onshape operations it uses, on the real kernel, and must rebuild the same solid as buildPart.
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { evaluate, resolveParams } from "../../web/js/cad/expr.js";
import { normalizeProfile, flattenLoop, polyArea, reverseLoop, _internal as PF } from "../../web/js/cad/profile.js";
import { TEMPLATES, fromTemplate } from "../../web/js/cad/templates.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { viewRequest } from "../../web/js/draw/part_drawing.js";
import { v3, bboxUnion } from "../../web/js/cad/vec.js";
import { meshesToStl, stlStats } from "../../web/js/cad/stl.js";
import { DxfDoc, viewsToDxf, profileToDxf, flatOutlineDxf, parseDxf } from "../../web/js/draw/dxf.js";
import { toFeatureScript, exprToFeatureScript, FS_NOTICE, FS_VERSION } from "../../web/js/cad/featurescript.js";
import { expandSpec } from "../../web/js/cad/shop.js";

const close = (a, b, tol = 1e-6, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} ≠ ${b}`);
const BASE = DEMO_DRIVE.parts.find((p) => p.id === "DRV-BASE");
const ALL_PARTS = [...TEMPLATES.map((t) => fromTemplate(t.key, `T-${t.key}`)), ...DEMO_DRIVE.parts];

async function builtBase() {
  const K = await kernel(), built = buildPart(K, BASE), shape = built.bodies[0].shape;
  const mesh = K.tessellate(shape), views = {};
  for (const v of viewRequest()) views[v.name] = K.hlr(shape, v.dir, v.xdir, v.hidden);
  return { K, built, mesh, views };
}

/* ---------- STL ---------- */

test("STL: binary file of the demo base (count, size, bounding box, placement matrices)", async () => {
  const { K, built, mesh } = await builtBase();
  const n = mesh.idx.length / 3, bytes = meshesToStl(mesh, { name: `${BASE.id} ${BASE.name}` });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes.length, 84 + 50 * n);
  const st = stlStats(bytes);
  assert.equal(st.triangles, n);
  assert.match(st.header, /^DesignWizard\.ai\(TM\) by DynamiteAgile\(TM\) - Co-Intelligence WorkFlow\(TM\) - DRV/, "the 80 bytes of the header : the mark first");
  for (let i = 0; i < 6; i++) close(st.bbox[i], built.bbox[i], 1e-3, `bbox[${i}]`);
  // facet normals are unit vectors computed from the vertices
  const dv = new DataView(bytes.buffer);
  for (const t of [0, Math.floor(n / 2), n - 1]) close(Math.hypot(dv.getFloat32(84 + t * 50, true), dv.getFloat32(88 + t * 50, true), dv.getFloat32(92 + t * 50, true)), 1, 1e-5);
  // several meshes, each with its own column-major matrix, plus a global one
  const move = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 500, 0, 0, 1], lift = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 10, 1];
  const two = stlStats(meshesToStl([mesh, { pos: mesh.pos, idx: mesh.idx, matrix: move }], { name: "x2", matrix: lift }));
  assert.equal(two.triangles, 2 * n);
  close(two.bbox[3], built.bbox[3] + 500, 1e-3); close(two.bbox[2], built.bbox[2] + 10, 1e-3); close(two.bbox[5], built.bbox[5] + 10, 1e-3);
  K.flush();
});

test("STL: degenerate triangles are skipped, a mirror flips the winding", () => {
  const pos = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 5, 5, 0]), idx = new Uint32Array([0, 1, 2, 0, 1, 1, 0, 0, 0]);
  const bytes = meshesToStl({ pos, idx }, { name: "tri" });
  assert.equal(bytes.length, 84 + 50);
  assert.deepEqual(stlStats(bytes).bbox, [0, 0, 0, 10, 10, 0]);
  const nz = (b) => new DataView(b.buffer).getFloat32(84 + 8, true);
  close(nz(bytes), 1);
  close(nz(meshesToStl({ pos, idx }, { matrix: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] })), 1);     // mirrored in X: still facing +Z
  assert.equal(stlStats(meshesToStl([], {})).triangles, 0);
  assert.throws(() => stlStats(bytes.slice(0, 100)), /STL binaire invalide/);
});

/* ---------- DXF ---------- */

test("DXF: writer and parser (R12 sections, layers, linetypes, entities)", () => {
  const doc = new DxfDoc();
  doc.layer("Axes", 1, "CENTER");
  doc.line(0, 0, 10, 0, "Axes").polyline([[0, 0], [10, 0], [10, 5]], "contour", true).circle(5, 5, 2, "contour").arc(0, 0, 4, -90, 90, "contour").text(1, 1, 2.5, "Pièce n° 1", "notes");
  const text = doc.toString(), d = parseDxf(text);
  assert.equal(d.version, "AC1009");
  assert.deepEqual(d.sections, ["HEADER", "TABLES", "ENTITIES"]);
  assert.ok(d.eof && /\r\n  0\r\nEOF\r\n$/.test(text));
  assert.deepEqual(d.ltypes, ["CONTINUOUS", "HIDDEN", "CENTER"]);
  assert.deepEqual(d.layers.map((l) => l.name), ["0", "AXES", "CONTOUR", "NOTES"]);
  assert.deepEqual(d.layers[1], { name: "AXES", color: 1, linetype: "CENTER" });
  assert.deepEqual(d.entities.map((e) => e.type), ["LINE", "POLYLINE", "CIRCLE", "ARC", "TEXT"]);
  assert.deepEqual(d.entities[1], { type: "POLYLINE", layer: "CONTOUR", closed: true, points: [[0, 0], [10, 0], [10, 5]] });
  assert.deepEqual([d.entities[3].a0, d.entities[3].a1], [270, 90]);
  assert.equal(d.entities[4].text, "Piece n? 1");                                   // R12 is ASCII
  assert.ok(!/[^\x00-\x7f]/.test(text));
  assert.throws(() => doc.line(0, 0, NaN, 1), /non finie/);
  assert.throws(() => doc.layer("x", 7, "DASHDOT"), /type de ligne inconnu/);
});

test("DXF: views of the demo base, flat outline", async () => {
  const { K, built, views } = await builtBase();
  const text = viewsToDxf(views, { title: `${BASE.id} — ${BASE.name}` }), d = parseDxf(text);
  assert.deepEqual(d.sections, ["HEADER", "TABLES", "ENTITIES"]);
  assert.ok(d.eof);
  const layer = Object.fromEntries(d.layers.map((l) => [l.name, l]));
  assert.deepEqual(layer.VISIBLE, { name: "VISIBLE", color: 7, linetype: "CONTINUOUS" });
  assert.deepEqual(layer.HIDDEN, { name: "HIDDEN", color: 8, linetype: "HIDDEN" });
  assert.ok(layer.THIN && layer.TEXT);
  assert.ok(d.entities.length > 50);
  const known = new Set(d.layers.map((l) => l.name));
  for (const e of d.entities) {
    assert.ok(e.layer && known.has(e.layer), `entity ${e.type} without a declared layer`);
    const nums = e.type === "POLYLINE" ? e.points.flat() : Object.values(e).filter((v) => typeof v === "number");
    assert.ok(nums.length >= 2 && nums.every(Number.isFinite), `${e.type}: non-finite coordinates`);
  }
  for (const k of ["VISIBLE", "HIDDEN"]) assert.ok(d.entities.some((e) => e.layer === k), `no entity on ${k}`);
  const circles = d.entities.filter((e) => e.type === "CIRCLE");
  assert.ok(circles.length >= 4, "the holes seen from the top are CIRCLE entities");
  assert.ok(circles.some((c) => Math.abs(c.r - 2.25) < 1e-6), "Ø4.5 clearance holes of the heat sink");
  assert.equal(d.entities.filter((e) => e.type === "TEXT").length, 1);
  // third-angle layout at 1:1: front view at the origin, top view above it, right view beside it
  const dx = built.bbox[3] - built.bbox[0], dy = built.bbox[4] - built.bbox[1], dz = built.bbox[5] - built.bbox[2];
  let xMax = -Infinity, yMax = -Infinity, xMin = Infinity;
  for (const e of d.entities.filter((q) => q.layer === "VISIBLE")) {
    const pts = e.type === "POLYLINE" ? e.points : e.type === "LINE" ? [[e.x1, e.y1], [e.x2, e.y2]] : [[e.cx - e.r, e.cy - e.r], [e.cx + e.r, e.cy + e.r]];
    for (const p of pts) { xMax = Math.max(xMax, p[0]); yMax = Math.max(yMax, p[1]); xMin = Math.min(xMin, p[0]); }
  }
  close(xMin, 0, 1e-6); close(xMax, dx + 20 + dy, 1e-6); close(yMax, dz + 20 + dy, 1e-6);
  assert.ok(!parseDxf(viewsToDxf(views, { hidden: false })).entities.some((e) => e.layer === "HIDDEN"));

  const flat = parseDxf(flatOutlineDxf(built, views));
  assert.ok(flat.entities.length > 8 && flat.entities.every((e) => e.layer === "CUT"));
  assert.ok(flat.entities.some((e) => e.type === "CIRCLE"));
  let fx = -Infinity, fy = -Infinity;
  for (const e of flat.entities) for (const p of e.type === "POLYLINE" ? e.points : e.type === "LINE" ? [[e.x1, e.y1], [e.x2, e.y2]] : []) { fx = Math.max(fx, p[0]); fy = Math.max(fy, p[1]); }
  close(fx, built.bbox[3], 1e-6); close(fy, built.bbox[4], 1e-6);                   // model coordinates, 1:1
  assert.throws(() => flatOutlineDxf(built, {}), /vue de dessus/);
  K.flush();
});

test("DXF: profile with true arcs", () => {
  const d = parseDxf(profileToDxf(normalizeProfile({ rect: [0, 0, 40, 20], r: 5 })));
  const count = (t) => d.entities.filter((e) => e.type === t).length;
  assert.equal(count("ARC"), 4); assert.equal(count("LINE"), 4); assert.equal(d.entities.length, 8);
  assert.ok(d.entities.every((e) => e.layer === "PROFILE"));
  for (const a of d.entities.filter((e) => e.type === "ARC")) { close(a.r, 5); close((a.a1 - a.a0 + 360) % 360, 90, 1e-6); }
  assert.ok(d.entities.some((a) => a.type === "ARC" && Math.abs(a.cx - 35) < 1e-9 && Math.abs(a.cy - 15) < 1e-9 && Math.abs(a.a0) < 1e-6));      // top-right corner: 0° -> 90°
  // raw definitions are accepted; holes that are whole circles become CIRCLE, an obround keeps its two arcs
  const p = parseDxf(profileToDxf({ outer: { rect: [0, 0, 40, 20] }, holes: [{ circle: [10, 10, 6] }, { slot: [22, 10, 32, 10, 4] }] }, { layer: "die" }));
  assert.deepEqual(p.entities.map((e) => e.type).sort(), ["ARC", "ARC", "CIRCLE", "LINE", "LINE", "LINE", "LINE", "LINE", "LINE"]);
  assert.ok(p.entities.every((e) => e.layer === "DIE"));
  close(p.entities.find((e) => e.type === "CIRCLE").r, 3);
});

/* ---------- FeatureScript: expressions ---------- */

test("FeatureScript: expression translator", () => {
  assert.equal(exprToFeatureScript("L/2 - 10"), "(L / 2 - 10)");
  assert.equal(exprToFeatureScript("max(t, 2)"), "max(t, 2)");
  assert.equal(exprToFeatureScript("sin(30)"), "sin(30 * degree)");
  assert.equal(exprToFeatureScript("if(n > 3, 10, 20)"), "(n > 3 ? 10 : 20)");
  assert.equal(exprToFeatureScript("W - 2*wall"), "(W - 2 * wall)");
  assert.equal(exprToFeatureScript("a - (b - c)"), "(a - (b - c))");
  assert.equal(exprToFeatureScript("a/(b*c)"), "(a / (b * c))");
  assert.equal(exprToFeatureScript("-a^2"), "(-(a ^ 2))");
  assert.equal(exprToFeatureScript("min(a, b, c)"), "min(min(a, b), c)");
  assert.equal(exprToFeatureScript("clamp(v, 1, 2)"), "min(max(v, 1), 2)");
  assert.equal(exprToFeatureScript("2*pi"), "(2 * PI)");
  assert.equal(exprToFeatureScript("cos(a + 15)"), "cos((a + 15) * degree)");
  assert.equal(exprToFeatureScript("atan2(y, x)"), "(atan2(y, x) / degree)");
  assert.equal(exprToFeatureScript("(n > 3) * 5"), "((n > 3 ? 1 : 0) * 5)");
  assert.equal(exprToFeatureScript("if(t, 1, 2)"), "(t != 0 ? 1 : 2)");
  assert.equal(exprToFeatureScript("L", (name) => `p_${name}`), "p_L");
  assert.equal(exprToFeatureScript(12.5), "12.5");
  assert.equal(exprToFeatureScript(-3), "(-3)");
  assert.throws(() => exprToFeatureScript("L +"), /incomplète/);
  assert.throws(() => exprToFeatureScript("foo(L)"), /sans équivalent FeatureScript/);
  // the translation keeps the value: the arithmetic subset reads back with the part-language evaluator (degree = 1, as its sin / cos take degrees)
  const scope = { a: 7, b: 3, c: 2.5, L: 120, t: 4, degree: 1, PI: Math.PI };
  for (const e of ["L/2 - 10", "-(a+b)*c", "a - (b - c) - c", "a/(b*c)/c", "a/b*c", "-a^2", "2^3^2", "a % b * c", "a - b % c", "hypot(a, b + 1)", "clamp(a, 1, 2)", "min(a, b, c) + max(a, b)",
    "sin(a*10) + cos(30)*tan(b)", "pow(a, 2) - sqrt(L)", "-(-a) - -b", "round(L/7) + floor(a/b) + ceil(c) + abs(-t)", "2*pi*a", "a*-b", "(a+b)*(a-b)/(c+1)"]) {
    close(evaluate(exprToFeatureScript(e), scope), evaluate(e, scope), 1e-9, e);
  }
});

/* ---------- FeatureScript: structure of the generated scripts ---------- */

/** Code without comments, with string literals emptied. */
function stripCode(code) {
  let out = "", i = 0;
  while (i < code.length) {
    const two = code.slice(i, i + 2);
    if (two === "//") { while (i < code.length && code[i] !== "\n") i++; continue; }
    if (two === "/*") { const j = code.indexOf("*/", i + 2); assert.ok(j > 0, "unterminated comment"); i = j + 2; continue; }
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { assert.notEqual(code[j], "\n", "unterminated string"); j += code[j] === "\\" ? 2 : 1; }
      out += '""'; i = j + 1; continue;
    }
    out += code[i++];
  }
  return out;
}
function assertBalanced(code, what) {
  const stack = [], pair = { ")": "(", "]": "[", "}": "{" };
  for (const ch of stripCode(code)) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (pair[ch]) assert.equal(stack.pop(), pair[ch], `${what}: unbalanced « ${ch} »`);
  }
  assert.equal(stack.length, 0, `${what}: ${stack.length} bracket(s) left open`);
}
const itemCount = (spec) => (spec.features || []).filter((f) => f.op !== "interfaces").length + (spec.interfaces || []).length + (spec.extrusion ? 1 : 0) + (spec.pcb ? 1 : 0) + (spec.folded ? (spec.folded.flanges || []).length : 0);      // a folded sheet : its base stands for the stock, each folded edge is one more extrusion
const editableParams = (spec) => Object.entries(spec.params || {}).filter(([, d]) => typeof d === "number" || (d && d.expr === undefined && typeof d.value === "number")).map(([k]) => k);

test("FeatureScript: every template and every demo part gives a well-formed Feature Studio source", () => {
  for (const spec of ALL_PARTS) {
    const r = toFeatureScript(spec), code = r.code, what = spec.id;
    assert.ok(code.startsWith(`FeatureScript ${FS_VERSION};\nimport(path : "onshape/std/geometry.fs", version : "${FS_VERSION}.0");\n`), `${what}: header`);
    assert.equal(FS_VERSION, "2014");
    for (const line of FS_NOTICE) assert.ok(code.includes(`// ${line}`), `${what}: experimental notice`);
    assert.match(code, /Généré par DesignWizard\.ai/);
    assert.match(code, /Créez un Feature Studio|créez un Feature Studio/);
    assert.match(code, /Part Studio/);
    assertBalanced(code, what);
    assert.ok(!/undefined|NaN|\[object|Infinity/.test(code), `${what}: leaked JavaScript value`);
    assert.ok(!/[ \t]+\n/.test(code), `${what}: trailing spaces`);
    // one feature, named after the part, one input per editable parameter, one local per parameter
    assert.equal((code.match(/defineFeature\(/g) || []).length, 1);
    assert.ok(code.includes(`annotation { "Feature Type Name" : "${spec.id} ${spec.name}" }`), `${what}: feature name`);
    assert.match(code, new RegExp(`export const ${r.identifier} = defineFeature\\(function\\(context is Context, id is Id, definition is map\\)\\n    precondition\\n    \\{`));
    const params = editableParams(spec);
    assert.equal((code.match(/^ {8}is(Length|Angle|Integer|Real)\(definition\./gm) || []).length, params.length, `${what}: precondition entries`);
    assert.equal((code.match(/^ {8}annotation \{ "Name" : "/gm) || []).length, params.length);
    for (const p of params) {
      assert.match(code, new RegExp(`is(Length|Angle|Integer|Real)\\(definition\\.${p}, \\{ \\((millimeter|degree|unitless)\\) : \\[[-0-9.]+, [-0-9.]+, [-0-9.]+\\] \\} as (Length|Angle|Integer|Real)BoundSpec\\);`), `${what}: input ${p}`);
      assert.match(code, new RegExp(`\\n {8}const ${p} = definition\\.${p}( / millimeter| / degree)?;`), `${what}: local ${p}`);
    }
    // every operation id is unique, every sketch is solved and deleted, every statement line is terminated
    const ids = [...code.matchAll(/\(context, id \+ \(?"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length, `${what}: duplicate operation id`);
    const sketches = ids.filter((i) => i.startsWith("sketch"));
    assert.equal((code.match(/skSolve\(/g) || []).length, sketches.length);
    for (const s of sketches) assert.ok(code.includes(`qCreatedBy(id + "${s}", EntityType.BODY)`), `${what}: ${s} is not deleted`);
    for (const line of stripCode(code).split("\n").map((l) => l.trim()).filter(Boolean)) {
      assert.ok(/[;{},[(\]]$/.test(line) || /^(precondition|else|\]|\)|"" : |annotation \{|for \(|if \(|function |export const )/.test(line), `${what}: suspicious line « ${line} »`);
    }
    // accounting: everything is either converted or listed (and marked in the code)
    assert.equal(r.converted + r.skipped.length, itemCount(spec), `${what}: converted + skipped`);
    assert.equal(r.total, itemCount(spec));
    assert.deepEqual(r.skipped, [], `${what}: ${JSON.stringify(r.skipped)}`);
    assert.ok(!code.includes("NON CONVERTI"));
    assert.ok(r.warnings.every((w) => typeof w === "string" && w.length > 10));
  }
  // integer input (number of fins), fixed generated section announced
  const sink = toFeatureScript(DEMO_DRIVE.parts.find((p) => p.id === "DRV-HEATSINK"));
  assert.match(sink.code, /isInteger\(definition\.n, \{ \(unitless\) : \[4, 10, 20\] \} as IntegerBoundSpec\);/);
  assert.match(sink.code, /\n {8}const n = definition\.n;/);
  assert.ok(sink.warnings.some((w) => /gen:heatsink/.test(w) && /figée/.test(w)));
  // the base stays parametric: expressions of the part reach the script unevaluated
  const base = toFeatureScript(BASE).code;
  for (const frag of ['"endDepth" : H * millimeter', '"thickness" : (-wall) * millimeter', "wall + 3.5 + dwI3 * (L - 2 * wall - 7)", "const dwPlane5 = wall + so;", "BooleanOperationType.SUBTRACTION", "opDeleteBodies(context, id + \"deleteSketches\""]) {
    assert.ok(base.includes(frag), `missing « ${frag} »`);
  }
});

test("FeatureScript: parameters (derived, units, reserved names, overrides) and what is skipped", () => {
  const spec = { dw: "part/1", id: "X-1", name: 'Bloc "test" \\ 1', material: "AL6061-T6",
    params: { L: { value: 60, min: 20, max: 100, label: 'Longueur "L"' }, id: 30, angle: { value: 30, unit: "deg", min: 0, max: 90 }, k: { value: 0.5, unit: "" }, n: { value: 3, unit: "", min: 1, max: 8 },
      half: { expr: "L/2" }, quarter: { expr: "half/2 + if(n > 2, 1, 0)" }, big: { expr: "L > 50" }, size: 12, for: 4 },
    interfaces: [{ type: "bolt_pattern", face: "+Z", at: ["L/2", "id/2"], rot: "angle", params: { screw: "M4", pattern: { type: "circle", n: "n", pcd: "size" } }, opts: { head: "csink", depth: 5 } },
      { id: "BAD", type: "nope", face: "+Z" }, { id: "PINS", type: "pins", side: "B", face: "-X", at: ["id/2", 5], params: { d: 3, pitch: 10, n: 2, length: 8 } }],
    features: [{ op: "box", size: ["L", "id", "size"] },
      { op: "hole", face: "+Z", at: { circle: { center: ["half", "id/2"], n: "n", d: "quarter", start: "angle" } }, d: 3, depth: "for", cbore: { d: 6, depth: 2 } },
      { op: "pocket", face: "+Y", slot: [10, 4, "L - 10", 4, 3], depth: "through" },
      { op: "cylinder", d: 6, h: "size * k", at: [5, 5, "size"], axis: "Z" },
      { op: "fillet", id: "fr", r: 1, edges: { r: 2 } }, { op: "loft", id: "weird" }, { op: "chamfer", d: 0.5, edges: "vertical", suppressed: true },
      { op: "pad", face: "+Z", circle: [40, 15, 8], h: 2, when: "n > 5" }, { op: "interfaces" }, { op: "fillet", id: "all", r: 0.5, edges: "all" }, { op: "hole", body: "ghost", at: [1, 1], d: 2 }] };
  const r = toFeatureScript(spec, { overrides: { L: 80 } }), code = r.code;
  assertBalanced(code, "X-1");
  assert.ok(!/undefined|NaN|\[object/.test(code));
  assert.ok(code.includes('annotation { "Feature Type Name" : "X-1 Bloc \\"test\\" \\\\ 1" }'));
  assert.ok(code.includes('annotation { "Name" : "Longueur \\"L\\"" }'));
  assert.equal(r.identifier, "dw_X_1");
  assert.ok(code.includes("isLength(definition.L, { (millimeter) : [20, 80, 100] } as LengthBoundSpec);"));      // override = default value
  assert.ok(code.includes("isAngle(definition.angle, { (degree) : [0, 30, 90] } as AngleBoundSpec);"));
  assert.ok(code.includes("const angle = definition.angle / degree;"));
  assert.ok(code.includes("isReal(definition.k, { (unitless) : [-1000000, 0.5, 1000000] } as RealBoundSpec);"));
  assert.ok(code.includes("isInteger(definition.n, { (unitless) : [1, 3, 8] } as IntegerBoundSpec);"));
  assert.ok(code.includes("const id_ = definition.id / millimeter;"));               // "id" is the feature id in FeatureScript
  assert.ok(code.includes("const size_ = definition.size / millimeter;"));           // "size" is a function the script calls
  assert.ok(code.includes("isLength(definition.for_, ") && code.includes("const for_ = definition.for_ / millimeter;"));      // keyword
  assert.ok(code.indexOf("const half = L / 2;") > 0 && code.indexOf("const half = L / 2;") < code.indexOf("const quarter = half / 2 + (n > 2 ? 1 : 0);"));
  assert.ok(code.includes("const big = L > 50 ? 1 : 0;"));                           // a comparison is a number (1 / 0) in the part language
  assert.ok(code.includes('"corner2" : vector(L, id_, size_) * millimeter'));
  assert.ok(code.includes("const dwAngle"), "circular patterns are loops");
  assert.ok(code.includes("fCone(context, id + (\"csink"), "countersink as a cone");
  assert.ok(code.includes("cos(angle * degree)"), "a parametric interface rotation stays symbolic");
  assert.ok(code.includes("dwSlot(") && code.includes("function dwSlot(") && !code.includes("function dwPolygon("), "only the helpers used are emitted");
  assert.deepEqual(r.skipped.map((s) => s.feature), ["fr", "weird", "f7", "f8", "BAD", "f11"]);
  assert.equal(r.converted + r.skipped.length, itemCount(spec));
  assert.equal(r.converted, 7);
  assert.equal((code.match(/\/\/ NON CONVERTI : /g) || []).length, r.skipped.length);
  for (const s of r.skipped) assert.ok(s.why.length > 5 && code.includes(`— ${s.why}`), `${s.feature}: ${s.why}`);
  assert.match(r.skipped[0].why, /critère r/);
  assert.match(r.skipped[1].why, /« loft »/);
  assert.match(r.skipped[2].why, /suppressed/);
  assert.match(r.skipped[3].why, /« when » fausse/);
  assert.match(r.skipped[4].why, /type d'interface inconnu/);
  assert.match(r.skipped[5].why, /« ghost »/);
  assert.ok(r.warnings.some((w) => /toutes les arêtes/.test(w)) && r.warnings.some((w) => /6 élément\(s\) sur 13 non converti/.test(w)));
  assert.ok(!r.warnings.some((w) => /« when »/.test(w)), "warnings of a skipped element go away with it");
  assert.ok(code.includes("// Points à vérifier :"));
  assert.throws(() => toFeatureScript({ params: { a: { expr: "b" }, b: { expr: "a" } }, features: [] }), /boucle/);
});

/* ---------- FeatureScript: the generated script rebuilds the same solid ---------- */

/** FeatureScript (the subset the generator writes) -> JavaScript: units are 1 (millimetres, degrees), types are dropped. */
function fsToJs(code) {
  return code.replace(/^FeatureScript \d+;\n/, "").replace(/^import\(.*\);\n/m, "").replace(/^annotation \{.*\}\n/m, "")
    .replace(/ {4}precondition\n {4}\{\n(?:[^]*?\n)? {4}\}\n/, "").replace(/^export const /m, "const ")
    .replace(/ [*/] (millimeter|degree)\b/g, "").replace(/\b(\w+) is \w+/g, "$1").replace(/\) returns \w+/g, ")")
    .replace(/for \(var (\w+) in /g, "for (var $1 of ").replace(/ ~ /g, " + ");
}

/** Minimal emulation, on the real kernel, of the Onshape operations used by the generated scripts. */
function onshape(K) {
  const bodies = [], sketches = new Map(), ids = new Set();
  const newId = (id) => { assert.ok(typeof id === "string" && !ids.has(id), `operation id « ${id} » used twice`); ids.add(id); return id; };
  const addBody = (id, shape) => bodies.push({ id, shape, alive: true });
  const touch = (b, shape) => { b.shape = shape; b.edges = null; };
  const faces = (b) => K.facesInfo(b.shape).map((info) => ({ k: "face", b, info }));
  const edges = (b) => { if (!b.edges) { b.shape = K.unify(b.shape); b.edges = K.edgesInfo(b.shape).map((info) => ({ k: "edge", b, info })); } return b.edges; };
  const resolve = (q) => {
    assert.ok(q && q.k, "not a query");
    if (q.k === "body" || q.k === "face" || q.k === "edge") return q.k !== "body" || q.b.alive ? [q] : [];
    if (q.k === "created") return bodies.filter((b) => b.alive && b.id === q.id).map((b) => ({ k: "body", b }));
    if (q.k === "union") { const seen = new Set(); return q.list.flatMap(resolve).filter((e) => (e.k !== "body" ? true : seen.has(e.b) ? false : (seen.add(e.b), true))); }
    if (q.k === "owned") return resolve(q.q).filter((e) => e.k === "body" && !e.b.sketch).flatMap((e) => (q.type === "FACE" ? faces(e.b) : edges(e.b)));
    if (q.k === "geometry") return resolve(q.q).filter((e) => e.info.type === (q.type === "PLANE" ? "plane" : "line"));
    throw new Error(`query ${q.k}`);
  };
  const solids = (q) => resolve(q).filter((e) => e.k === "body" && !e.b.sketch).map((e) => e.b);
  const circumcentre = (a, m, b) => {
    const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1])), s = (p) => p[0] * p[0] + p[1] * p[1];
    return [(s(a) * (m[1] - b[1]) + s(m) * (b[1] - a[1]) + s(b) * (a[1] - m[1])) / d, (s(a) * (b[0] - m[0]) + s(m) * (a[0] - b[0]) + s(b) * (m[0] - a[0])) / d];
  };
  const profileOf = (sk) => {                                    // chain the sketch entities into closed loops
    const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6, loops = sk.circles.map((c) => PF.loopCircle([c.c[0], c.c[1], 2 * c.r]));
    const segs = sk.segs.map((e) => (e.m ? PF.arcSeg(e.a, e.b, circumcentre(e.a, e.m, e.b), (e.m[0] - e.a[0]) * (e.b[1] - e.m[1]) - (e.m[1] - e.a[1]) * (e.b[0] - e.m[0]) > 0) : PF.lineSeg(e.a, e.b)));
    while (segs.length) {
      const loop = [segs.shift()];
      while (!near(loop[loop.length - 1].b, loop[0].a)) {
        const end = loop[loop.length - 1].b, i = segs.findIndex((s) => near(s.a, end) || near(s.b, end));
        assert.ok(i >= 0, `sketch ${sk.id}: open contour`);
        const s = segs.splice(i, 1)[0];
        loop.push(near(s.a, end) ? s : reverseLoop([s])[0]);
      }
      loops.push(loop);
    }
    const area = (l) => polyArea(flattenLoop(l, 0.01));
    loops.sort((p, q) => Math.abs(area(q)) - Math.abs(area(p)));
    return { outer: area(loops[0]) > 0 ? loops[0] : reverseLoop(loops[0]), holes: loops.slice(1).map((l) => (area(l) < 0 ? l : reverseLoop(l))) };
  };
  const entity = (sk, name) => { assert.ok(typeof name === "string" && !sk.names.has(name), `sketch entity « ${name} » used twice`); sk.names.add(name); };
  const trig = (f) => (deg) => f(deg * Math.PI / 180);
  const api = {
    PI: Math.PI, EntityType: { BODY: "BODY", FACE: "FACE", EDGE: "EDGE" }, BoundingType: { BLIND: "BLIND" }, ChamferType: { EQUAL_OFFSETS: "EQUAL_OFFSETS" },
    BooleanOperationType: { UNION: "UNION", SUBTRACTION: "SUBTRACTION", INTERSECTION: "INTERSECTION" }, GeometryType: { PLANE: "PLANE", LINE: "LINE" },
    defineFeature: (fn) => fn, vector: (...c) => { assert.ok(c.every(Number.isFinite), `vector(${c})`); return c; },
    plane: (origin, normal, x) => ({ origin, normal, x }), line: (origin, direction) => ({ origin, direction }),
    size: (a) => a.length, append: (a, x) => [...a, x], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, round: Math.round, floor: Math.floor, ceil: Math.ceil, sin: trig(Math.sin), cos: trig(Math.cos), tan: trig(Math.tan),
    qCreatedBy: (id, type) => { assert.equal(type, "BODY"); return { k: "created", id }; }, qUnion: (list) => ({ k: "union", list }),
    qOwnedByBody: (q, type) => ({ k: "owned", q, type }), qGeometry: (q, type) => ({ k: "geometry", q, type }), qSketchRegion: (id, inner) => { assert.equal(inner, true); return { k: "region", id }; },
    evaluateQuery: (ctx, q) => resolve(q),
    evBox3d(ctx, d) {
      let bb = null;
      for (const e of resolve(d.topology)) bb = bboxUnion(bb, e.k === "body" ? K.bbox(e.b.shape) : [e.info.p0, e.info.p1, e.info.mid].reduce((acc, p) => bboxUnion(acc, [...p, ...p]), null));
      assert.ok(bb, "evBox3d of nothing");
      return { minCorner: bb.slice(0, 3), maxCorner: bb.slice(3) };
    },
    evPlane: (ctx, d) => ({ origin: d.face.info.o, normal: d.face.info.n }), evLine: (ctx, d) => ({ origin: d.edge.info.p0, direction: d.edge.info.dir }),
    evEdgeTangentLine: (ctx, d) => { assert.equal(d.parameter, 0.5); return { origin: d.edge.info.mid }; },
    newSketchOnPlane(ctx, id, d) { const sk = { id: newId(id), pl: d.sketchPlane, segs: [], circles: [], names: new Set(), solved: false }; sketches.set(id, sk); bodies.push({ id, sketch: sk, alive: true }); return sk; },
    skRectangle(sk, name, d) { entity(sk, name); const [x0, y0] = d.firstCorner, [x1, y1] = d.secondCorner, p = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; p.forEach((a, i) => sk.segs.push({ a, b: p[(i + 1) % 4] })); },
    skCircle(sk, name, d) { entity(sk, name); assert.ok(d.radius > 0); sk.circles.push({ c: d.center, r: d.radius }); },
    skLineSegment(sk, name, d) { entity(sk, name); sk.segs.push({ a: d.start, b: d.end }); },
    skArc(sk, name, d) { entity(sk, name); sk.segs.push({ a: d.start, m: d.mid, b: d.end }); },
    skSolve(sk) { sk.solved = true; },
    opExtrude(ctx, id, d) {
      const sk = sketches.get(d.entities.id);
      assert.ok(sk && sk.solved, "extrude of an unsolved sketch"); assert.equal(d.endBound, "BLIND"); assert.ok(d.endDepth > 0, `extrude depth ${d.endDepth}`); close(v3.len(d.direction), 1);
      addBody(newId(id), K.prism(K.faceOfProfile(profileOf(sk), { o: sk.pl.origin, u: sk.pl.x, v: v3.cross(sk.pl.normal, sk.pl.x) }), v3.mul(d.direction, d.endDepth)));
    },
    opRevolve(ctx, id, d) { const sk = sketches.get(d.entities.id); addBody(newId(id), K.revolve(K.faceOfProfile(profileOf(sk), { o: sk.pl.origin, u: sk.pl.x, v: v3.cross(sk.pl.normal, sk.pl.x) }), d.axis.origin, d.axis.direction, d.angleForward)); },
    fCuboid(ctx, id, d) { const a = d.corner1, b = d.corner2; assert.ok(a.every((x, i) => b[i] > x), "fCuboid corners"); addBody(newId(id), K.box(a, b)); },
    fCylinder(ctx, id, d) { const ax = v3.sub(d.topCenter, d.bottomCenter); assert.ok(d.radius > 0 && v3.len(ax) > 0); addBody(newId(id), K.cylinder(d.bottomCenter, ax, d.radius, v3.len(ax))); },
    fCone(ctx, id, d) { const ax = v3.sub(d.topCenter, d.bottomCenter); assert.ok(d.bottomRadius > 0 && d.topRadius > 0); addBody(newId(id), K.cone(d.bottomCenter, ax, d.bottomRadius, d.topRadius, v3.len(ax))); },
    opBoolean(ctx, id, d) {
      newId(id);
      const tools = solids(d.tools);
      assert.ok(tools.length, "boolean without tools");
      if (d.operationType === "SUBTRACTION") {
        const targets = solids(d.targets);
        assert.ok(targets.length && !targets.some((t) => tools.includes(t)), "boolean targets");
        for (const t of targets) touch(t, K.cut(t.shape, tools.map((b) => b.shape)));
        for (const t of tools) t.alive = false;
      } else {
        assert.ok(tools.length > 1, "union / intersection of a single body");
        touch(tools[0], d.operationType === "UNION" ? K.fuse(tools[0].shape, tools.slice(1).map((b) => b.shape)) : tools.slice(1).reduce((s, b) => K.common(s, b.shape), tools[0].shape));
        for (const t of tools.slice(1)) t.alive = false;
      }
    },
    opShell(ctx, id, d) { newId(id); const f = resolve(d.entities); assert.ok(f.length && f.every((e) => e.k === "face" && e.b === f[0].b) && d.thickness < 0); touch(f[0].b, K.shell(f[0].b.shape, f.map((e) => e.info.face), -d.thickness)); },
    opFillet(ctx, id, d) { newId(id); const e = resolve(d.entities); assert.ok(e.length && e.every((x) => x.k === "edge" && x.b === e[0].b)); touch(e[0].b, K.fillet(e[0].b.shape, e.map((x) => x.info.edge), d.radius)); },
    opChamfer(ctx, id, d) { newId(id); assert.equal(d.chamferType, "EQUAL_OFFSETS"); const e = resolve(d.entities); assert.ok(e.length && e.every((x) => x.k === "edge" && x.b === e[0].b)); touch(e[0].b, K.chamfer(e[0].b.shape, e.map((x) => x.info.edge), d.width)); },
    opDeleteBodies(ctx, id, d) { newId(id); for (const e of resolve(d.entities)) e.b.alive = false; },
  };
  return { api, result: () => { assert.ok(!bodies.some((b) => b.alive && b.sketch), "a sketch is left in the part"); return bodies.filter((b) => b.alive).map((b) => b.shape); } };
}

function runScript(K, spec, overrides = {}) {
  const r = toFeatureScript(spec), { scope, defs } = resolveParams(spec.params, overrides), sim = onshape(K);
  const definition = Object.fromEntries(Object.keys(defs).filter((k) => !defs[k].derived).map((k) => [k, scope[k]]));
  const names = Object.keys(sim.api);
  // eslint-disable-next-line no-new-func
  const feature = new Function(...names, `"use strict";\n${fsToJs(r.code)}\nreturn ${r.identifier};`)(...names.map((n) => sim.api[n]));
  feature({}, "F.", definition);
  const shapes = sim.result();
  let volume = 0, bbox = null;
  for (const s of shapes) { assert.ok(K.isValid(s), `${spec.id}: invalid solid`); const p = K.props(s); volume += p.volume; bbox = bboxUnion(bbox, p.bbox); }
  return { volume, bbox, count: shapes.length };
}

test("FeatureScript: run by an emulation of the Onshape operations, each script rebuilds the solid of buildPart", async () => {
  const K = await kernel();
  for (const spec of ALL_PARTS) {
    const built = buildPart(K, spec), ref = built.bodies.filter((b) => !b.name.startsWith("Cu:"));       // copper zones are not exported
    const want = { volume: ref.reduce((s, b) => s + b.volume, 0), bbox: ref.reduce((bb, b) => bboxUnion(bb, b.bbox), null) };
    const got = runScript(K, spec);
    assert.equal(got.count, ref.length, `${spec.id}: number of bodies`);
    close(got.volume, want.volume, Math.max(1e-4 * want.volume, 0.05), `${spec.id}: volume`);
    for (let i = 0; i < 6; i++) close(got.bbox[i], want.bbox[i], 1e-3, `${spec.id}: bbox[${i}]`);
    K.flush();
  }
});

test("FeatureScript: the script follows its inputs (parameters changed in Onshape, not at generation)", async () => {
  const K = await kernel();
  for (const [id, overrides] of [["DRV-BASE", { L: 190, W: 120, H: 50, wall: 3, so: 8, pwrX: 60, conW: 24 }], ["DRV-COVER", { L: 190, sx: 170, rc: 3 }], ["DRV-CTRL-PCB", { L: 75, W: 100, mx: 60 }]]) {
    const spec = DEMO_DRIVE.parts.find((p) => p.id === id), built = buildPart(K, spec, { overrides });
    const ref = built.bodies.filter((b) => !b.name.startsWith("Cu:")), want = ref.reduce((s, b) => s + b.volume, 0);
    const got = runScript(K, spec, overrides);                    // the script is generated with the default values, then run with other inputs
    close(got.volume, want, Math.max(1e-4 * want, 0.05), `${id}: volume`);
    const bb = ref.reduce((acc, b) => bboxUnion(acc, b.bbox), null);
    for (let i = 0; i < 6; i++) close(got.bbox[i], bb[i], 1e-3, `${id}: bbox[${i}]`);
    K.flush();
  }
  // a part made of the remaining operations: patterns, counterbores, countersinks, slots, pads, intersect, revolve, rotated interfaces
  const spec = { dw: "part/1", id: "X-2", name: "Essai", material: "AL6061-T6",
    params: { L: 80, W: 50, H: 16, n: { value: 5, unit: "" }, a: { value: 20, unit: "deg" }, half: { expr: "L/2" } },
    interfaces: [{ type: "bolt_pattern", face: "+Z", at: ["half", "W/2"], rot: "a", params: { screw: "M3", pattern: { type: "circle", n: "n", pcd: 30, start: 10 } }, opts: { head: "csink", depth: 6 } },
      { type: "cutout", side: "A", face: "-Y", at: ["half", "H/2"], rot: 90, params: { shape: "rect", w: 8, h: 14, r: 1.5, fix: { screw: "M3", n: 2, pitch: 22 } }, opts: { depth: 4 } },
      { type: "fit", side: "A", face: "+X", at: ["W/2", "H/2"], params: { d: 10, length: 6 } }, { type: "planar", side: "B", face: "-Z", at: ["half", "W/2"], rot: 30, params: { w: 20, h: 10 }, opts: { pad: 1 } },
      { type: "pins", side: "B", face: "-X", at: ["W/2", "H/2"], params: { d: 3, pitch: 20, n: 2, length: 8 } }, { type: "rail", side: "B", face: "+Y", at: ["half", 4], params: { t: 1.6, depth: 2, length: 40 } }],
    features: [{ op: "extrude", profile: { outer: { poly: [[0, 0], ["L", 0, 4], ["L", "W", 4], [0, "W"]], r: 1 }, holes: [{ circle: [12, 12, 6] }] }, length: "H" },
      { op: "revolve", profile: { poly: [[0, 0], [6, 0], [6, 3], [3, 8], [0, 8]] }, plane: "XZ", axis: "Z", axis_at: [0, 0, 0], mode: "cut" },
      { op: "hole", face: "+Z", at: { grid: { origin: [10, 40], nx: "n - 2", ny: 1, dx: 12 } }, d: 3.4, cbore: { d: 6.5, depth: 3.4 } },
      { op: "hole", face: "-Z", at: [[60, 10], [70, 10]], thread: "M4", depth: 8 },
      { op: "slot", face: "+Z", from: [50, 40], to: [70, 44], w: 4, depth: 3 }, { op: "pad", face: "+Z", circle: [66, 25, 8], h: 2 },
      { op: "pocket", face: "+Z", profile: { path: "M30 36 L40 36 A3 3 0 0 1 40 42 L30 42 Z" }, depth: 2 },
      { op: "boss", face: "+Z", at: [20, 26], d: 7, h: 4, hole: { thread: "M3", depth: 5 } },
      { op: "cylinder", d: 200, h: 40, at: ["half", "W/2", -5], mode: "intersect" }, { op: "interfaces" },
      { op: "chamfer", d: 0.4, edges: { face: "-Z" } }] };
  for (const overrides of [{}, { L: 90, H: 18, n: 4, a: 35 }]) {
    const built = buildPart(K, spec, { overrides });
    assert.deepEqual(built.log.filter((l) => l.level === "error"), []);
    const r = toFeatureScript(spec);
    assert.deepEqual(r.skipped, []);
    const got = runScript(K, spec, overrides);
    close(got.volume, built.volume, 1e-4 * built.volume, `X-2 ${JSON.stringify(overrides)}: volume`);
    for (let i = 0; i < 6; i++) close(got.bbox[i], built.bbox[i], 1e-3, `X-2: bbox[${i}]`);
    K.flush();
  }
});

test("FeatureScript: Shop parts (stock + verbs, after expandSpec) — « outline », an extrude with mode intersect, becomes a boolean intersection", async () => {
  const K = await kernel();
  const plate = { dw: "part/1", id: "W-1", name: "Platine détourée", material: "AL6061-T6", process: "laser_cut", params: { L: 100, W: 60, t: 5, r: 12 }, stock: { form: "plate", L: "L", W: "W", t: "t" },
    features: [{ op: "outline", id: "contour", profile: { poly: [[0, 0], ["L", 0, "r"], ["L", "W", "r"], [20, "W"], [0, 40]] } }, { op: "drill", id: "d1", face: "+Z", at: [[15, 15], ["L - 15", 15]], d: 5 },
      { op: "tap", id: "t1", face: "+Z", at: ["L/2", "W/2"], thread: "M4", depth: "t - 1" }, { op: "cbore", id: "c1", face: "+Z", at: ["L - 20", "W - 20"], screw: "M4" },
      { op: "step", id: "s1", face: "+Z", rect: [40, 0, 20, 10], to: "t/2" }, { op: "groove", id: "g1", face: "+Z", from: [30, 45], to: [60, 45], w: 4, depth: 2 }, { op: "deburr" }] };
  const shaft = { dw: "part/1", id: "W-2", name: "Axe épaulé", material: "STEEL-1018", process: "cnc_turning", params: { D: 30, L: 80, d1: 20 }, stock: { form: "bar_round", d: "D", L: "L" },
    features: [{ op: "turn", id: "t1", from: 50, to: "L", d: "d1" }, { op: "bore", id: "b1", d: 8, depth: 20 }, { op: "face", id: "f1", face: "+Z", to: "L - 2" }, { op: "break_edges", id: "e1", d: 0.5, edges: { face: "+Z" } }] };
  const flat = expandSpec(plate), r = toFeatureScript(flat), contour = flat.features.find((f) => f.shop === "outline");
  assert.deepEqual([contour.op, contour.mode, flat.features[0].shop], ["extrude", "intersect", "stock"]);
  assert.deepEqual([r.skipped, r.converted, itemCount(flat)], [[], 7, 7]);                    // the stock + six verbs with geometry (deburr has none)
  // the stock is the first solid (element 1); the outline (element 2) is extruded as a body of its own, then intersected with the part
  assert.match(r.code, /opExtrude\(context, id \+ "extrude2", \{[^;]*\}\);\n +opBoolean\(context, id \+ "intersect2", \{\n +"tools" : qUnion\(\[dwMain, qCreatedBy\(id \+ "extrude2", EntityType\.BODY\)\]\),\n +"operationType" : BooleanOperationType\.INTERSECTION\n +\}\);/);
  for (const [spec, overrides] of [[plate, {}], [plate, { L: 130, W: 70, t: 8, r: 6 }], [shaft, {}], [shaft, { D: 40, L: 100, d1: 24 }]]) {
    const built = buildPart(K, spec, { overrides }), got = runScript(K, expandSpec(spec), overrides);
    assert.deepEqual([built.log.filter((l) => l.level === "error"), toFeatureScript(expandSpec(spec)).skipped], [[], []], spec.id);
    close(got.volume, built.volume, 1e-4 * built.volume, `${spec.id} ${JSON.stringify(overrides)}: volume`);
    for (let i = 0; i < 6; i++) close(got.bbox[i], built.bbox[i], 1e-3, `${spec.id}: bbox[${i}]`);
    K.flush();
  }
  const lone = toFeatureScript({ dw: "part/1", id: "W-0", name: "Seul", features: [{ op: "extrude", shop: "outline", profile: { rect: [0, 0, 10, 10] }, length: 5, mode: "intersect" }] });
  assert.deepEqual([lone.converted, lone.skipped], [0, [{ feature: "f1", why: "le corps « main » n'existe pas encore (aucun volume à modifier)" }]]);      // nothing to intersect with: reported, not dropped
  assert.ok(lone.code.includes("// NON CONVERTI : f1 — extrude — le corps « main » n'existe pas encore (aucun volume à modifier)"));
});
