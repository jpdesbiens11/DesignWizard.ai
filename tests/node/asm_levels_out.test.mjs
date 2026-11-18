/* What leaves an assembly with its levels kept (v0.93) : the parts list of ONE level as its drawing writes it, the assembly as a
   tree of placed nodes, and the STEP file the real kernel writes from it — a sub-assembly is a product of its own. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { solveLevels, placedTree, bom, bomTop } from "../../web/js/core/assembly_logic.js";
import { composeAssemblyDrawing, centerKey } from "../../web/js/draw/asm_drawing.js";
import { drawingTexts } from "../../web/js/core/drawing_words.js";
import { matMul, matPoint } from "../../web/js/cad/vec.js";
import { SvgSheet } from "../../web/js/draw/svg.js";
import { viewRequest, PAPER } from "../../web/js/draw/part_drawing.js";
import { kernel } from "./kernel_helper.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const up = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "A", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] } });
const down = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "B", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] } });
const part = (interfaces, mass = 10) => ({ interfaces, bodies: [], bbox: [0, 0, 0, 10, 10, 5], mass, cog: [5, 5, 2.5] });
/* BASE carries the module (P1 on its seat, P2 on P1) twice, a cap (P3) placed at this level, and a deeper level : BIG holds MID holds SUB */
const built = { BASE: part([up("IF1", 0, 0, 10, "k1"), up("IF2", 50, 0, 10, "k1")], 100), P1: part([down("IF1", 0, 0, 0, "k1"), up("IF3", 0, 0, 5, "k3")]), P2: part([down("IF3", 0, 0, 0, "k3")], 4), P3: part([], 2) };
const SUB = { id: "SUB", name: "Module", revision: "C", instances: [{ id: "i1", part: "P1", fixed: true }, { id: "i2", part: "P2" }, { id: "i3", part: "P3", off: true }], mates: [{ id: "M1", a: { inst: "i1", iface: "IF3" }, b: { inst: "i2", iface: "IF3" } }] };
const TOP = { id: "TOP", name: "Produit", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "s1", asm: "SUB" }, { id: "s2", asm: "SUB" }, { id: "i4", part: "P3", placement: { t: [0, 80, 0], r: [0, 0, 0] } }, { id: "i5", part: "P1", off: true }],
  mates: [{ id: "J1", a: { inst: "i1", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF1" } }, { id: "J2", a: { inst: "i1", iface: "IF2" }, b: { inst: "s2~i1", iface: "IF1" } }] };
const MID = { id: "MID", name: "Étage", instances: [{ id: "a", asm: "SUB", placement: { t: [0, 0, 30], r: [0, 0, 0] } }, { id: "b", part: "P3", fixed: true }], mates: [] };
const BIG = { id: "BIG", name: "Machine", instances: [{ id: "m", asm: "MID", placement: { t: [200, 0, 0], r: [0, 0, 90] } }, { id: "g", asm: "GONE" }], mates: [] };
const project = { name: "Essai", parts: Object.keys(built).map((id) => ({ id, name: `Pièce ${id}`, material: "AL6061-T6" })), assemblies: [SUB, TOP, MID, BIG] };
const find = (id) => project.assemblies.find((a) => a.id === id) || null;
const near = (a, b, what) => a.forEach((x, k) => assert.ok(Math.abs(x - b[k]) < 1e-9, `${what} : ${a} ≠ ${b}`));

test("the list of one level : a sub-assembly is one line, the parts and the hardware are those of this level", () => {
  const { asm: opened } = solveLevels(TOP, built, find), flat = bom(project, opened, built), top = bomTop(project, opened, built);
  assert.deepEqual(flat.filter((r) => r.kind === "part").map((r) => [r.id, r.qty]), [["BASE", 1], ["P1", 2], ["P2", 2], ["P3", 1]], "flat : every part through the levels");
  assert.deepEqual(top.map((r) => [r.item, r.kind, r.id, r.qty]), [[1, "assembly", "SUB", 2], [2, "part", "BASE", 1], [3, "part", "P3", 1]], "by level : the module twice in ONE line, then what is placed here");
  const line = top[0]; assert.equal(line.name, "Module"); assert.equal(line.rev, "C", "at its own revision"); assert.equal(line.parts, 2, "what one of it holds — the part put aside in it is not counted"); assert.equal(line.mass, 14, "the mass of one"); assert.equal(line.group, "s1");
  assert.ok(!top.some((r) => r.id === "P1" || r.id === "P2"), "its parts are on its own list, not here");
  /* nothing to open : the two lists are the same */
  const plain = solveLevels(SUB, built, find).asm; assert.deepEqual(bomTop(project, plain, built), bom(project, plain, built));
  /* hardware : the joints of this level only — the module's own joint stays on the module's list */
  const hwTop = bomTop(project, opened, built).filter((r) => r.kind === "hardware").length, hwFlat = flat.filter((r) => r.kind === "hardware").length; assert.ok(hwTop <= hwFlat);
  assert.match(read("web/js/core/assembly_logic.js"), /mates: \(opened\.mates \|\| \[\]\)\.filter\(\(m\) => !m\.of\)/);
});

test("the assembly as a tree of placed nodes : each matrix in the frame of the node above, the same content for the same sub-assembly", () => {
  const tree = placedTree(TOP, built, find), { sol } = solveLevels(TOP, built, find);
  assert.deepEqual(tree.map((n) => [n.inst, n.part || n.asm, n.children ? n.children.length : null]), [["i1", "BASE", null], ["s1", "SUB", 2], ["s2", "SUB", 2], ["i4", "P3", null]], "what is put aside is left out, at every level");
  /* walking down the tree gives each part where the solver put it */
  const walk = (nodes, M, path, out = []) => { for (const n of nodes) { const W = M ? matMul(M, n.matrix) : n.matrix, id = [...path, n.inst].join("~"); if (n.children) walk(n.children, W, [...path, n.inst], out); else out.push([id, W]); } return out; };
  const leaves = walk(tree, null, []); assert.equal(leaves.length, 6);
  for (const [id, W] of leaves) near(matPoint(W, [1, 2, 3]), matPoint(sol.placements[id], [1, 2, 3]), id);
  near(matPoint(sol.placements["s2~i2"], [0, 0, 0]), [50, 0, 15], "the second module sits on the second seat, its P2 on its P1");
  assert.deepEqual(tree[1].children, tree[2].children, "the module placed twice holds the same children at the same places");
  /* through two levels, a rotated block, and a sub-assembly gone from the project */
  const big = placedTree(BIG, built, find), deep = solveLevels(BIG, built, find).sol; assert.deepEqual(big.map((n) => n.inst), ["m"], "the one that is gone is left out");
  const all = walk(big, null, []); assert.deepEqual(all.map(([id]) => id).sort(), ["m~a~i1", "m~a~i2", "m~b"]);
  for (const [id, W] of all) near(matPoint(W, [4, 5, 6]), matPoint(deep.placements[id], [4, 5, 6]), id);
  assert.deepEqual(placedTree(SUB, built, find).map((n) => n.inst), ["i1", "i2"], "an assembly without a sub-assembly : its parts, flat");
  assert.deepEqual(placedTree(TOP, { BASE: built.BASE, P3: built.P3 }, find).map((n) => n.inst), ["i1", "i4"], "a sub-assembly none of whose parts could be built has no place : left out");
});

test("the drawing of an assembly : the sub-assembly has its line and its balloon ; flat, every part has", async () => {
  const K = await kernel(), { asm: opened } = solveLevels(TOP, built, find), block = K.compound([K.box([0, 0, 0], [100, 60, 10]), K.box([10, 10, 10], [30, 30, 40])]);
  const views = Object.fromEntries(viewRequest().map((v) => [v.name, K.hlr(block, v.dir, v.xdir, false)])); let text = "";
  const draw = (rows, centers) => { const sheet = new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: "TOP" }), info = composeAssemblyDrawing(sheet, { asm: TOP, project, views, bbox: [0, 0, 0, 100, 60, 40], rows, centers, mass: 128, count: { parts: 6, inSubs: 4, subs: 2, joints: 4 }, opts: { date: "2026-01-01" } }); text = sheet.toString(0); return info; };
  const top = bomTop(project, opened, built).map((r) => ({ ...r, rev: r.rev || "A" })), info = draw(top, { "asm:SUB": [20, 20, 25], BASE: [50, 30, 5], P3: [90, 50, 5] });
  assert.deepEqual(info.items.map((x) => [x.item, x.id, x.kind]), [[1, "SUB", "assembly"], [2, "BASE", "part"], [3, "P3", "part"]]); assert.ok(info.items.every((x) => x.view), "each line has its balloon on a view");
  assert.equal(centerKey({ kind: "assembly", id: "SUB" }), "asm:SUB"); assert.equal(centerKey({ kind: "part", id: "SUB" }), "SUB", "a part and an assembly may bear the same id");
  assert.ok(text.includes(">Sub-assembly, 2 parts<"), "the line says what it is and what it holds"); assert.ok(text.includes(">Module<") && text.includes(">C<"), "its name, at its revision"); assert.ok(!text.includes(">P1<"), "its parts are not on this sheet");
  assert.match(info.notes[1], /each part and each sub-assembly is defined by its own drawing/); assert.match(info.notes[2], /^6 part\(s\) placed, 4 of them inside 2 sub-assemblies listed as one item each, 4 joint\(s\)/);
  const flat = draw(bom(project, opened, built).map((r) => ({ ...r, rev: "A" })), { BASE: [50, 30, 5], P1: [20, 20, 15], P2: [20, 20, 30], P3: [90, 50, 5] }); assert.ok(text.includes(">P1<") && !text.includes(">Sub-assembly"), "flat : the parts, no line for the block"); K.flush();
  assert.deepEqual(flat.items.map((x) => x.id), ["BASE", "P1", "P2", "P3"]); assert.match(flat.notes[2], /^6 part\(s\) placed, through 2 sub-assemblies \(every part listed\), 4 joint\(s\)/); assert.match(flat.notes[1], /each part is defined by its own drawing/);
  /* the English of the sheet is asked for the name of a sub-assembly too */
  assert.deepEqual(drawingTexts(project, "assembly:TOP"), ["Produit", "Pièce BASE", "Pièce P1", "Pièce P2", "Pièce P3", "Module", "Essai"]);
  assert.deepEqual(drawingTexts(project, "assembly:TOP", top), ["Produit", "Module", "Pièce BASE", "Pièce P3", "Essai"], "by level : only what the sheet lists");
  const screen = read("web/js/modules/drawings.js");
  assert.match(screen, /byLevel = Object\.keys\(groups\)\.length > 0 && \(extra\.bom \|\| \(store\.project\.drawing \|\| \{\}\)\.asmBom\) !== "flat"/, "by level unless the project asks for every part");
  assert.match(screen, /"aria-label": "Nomenclature du dessin"/); assert.match(screen, /\(spec\.instances \|\| \[\]\)\.some\(\(i\) => i\.asm\) \? field\("Nomenclature du dessin"/, "the choice shows only where there is a sub-assembly");
});

test("STEP : the file keeps the levels — a sub-assembly is a product of its own, written once, placed twice", async () => {
  const K = await kernel(), I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], at = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const base = K.box([0, 0, 0], [100, 40, 10]), p1 = K.box([0, 0, 0], [10, 10, 5]), p2 = K.box([0, 0, 0], [6, 6, 3]);
  const leaf = (key, shape, matrix, inst) => ({ key, name: key, instanceName: `${key} ${inst}`, shape, matrix });
  const module = (inst, matrix) => ({ key: "asm:SUB", name: "SUB Module", instanceName: `SUB ${inst}`, matrix, children: [leaf("P1", p1, I, "i1"), leaf("P2", p2, at(0, 0, 5), "i2")] });
  const nested = K.stepWrite([leaf("BASE", base, I, "i1"), module("s1", at(0, 0, 10)), module("s2", at(50, 0, 10))], "TOP Produit");
  const flat = K.stepWrite([leaf("BASE", base, I, "i1"), leaf("P1", p1, at(0, 0, 10), "s1~i1"), leaf("P2", p2, at(0, 0, 15), "s1~i2"), leaf("P1", p1, at(50, 0, 10), "s2~i1"), leaf("P2", p2, at(50, 0, 15), "s2~i2")], "TOP Produit");
  const count = (text, what) => (text.match(new RegExp(what, "g")) || []).length, products = (text) => [...text.matchAll(/PRODUCT\('([^']*)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(products(nested), ["BASE", "P1", "P2", "SUB Module", "TOP Produit"], "the module is a product, between the product and its parts");
  assert.deepEqual(products(flat), ["BASE", "P1", "P2", "TOP Produit"]);
  assert.equal(count(nested, "NEXT_ASSEMBLY_USAGE_OCCURRENCE\\("), 5, "BASE and the module twice under the product, P1 and P2 once under the module");
  assert.equal(count(flat, "NEXT_ASSEMBLY_USAGE_OCCURRENCE\\("), 5, "flat : five parts under the product");
  /* read back, the parts are where they were : the same boxes as the flat file */
  const boxes = (text) => K.stepRead(text).map((s) => s.bbox.map((x) => Math.round(x * 100) / 100).join(" ")).sort();
  assert.deepEqual(boxes(nested), boxes(flat)); assert.equal(boxes(nested).length, 5); assert.ok(boxes(nested).includes("50 0 15 56 6 18"), "the P2 of the second module, 50 along and on its P1");
  K.flush();
  /* the three places that write the STEP of an assembly go through the same list */
  for (const f of ["web/js/modules/assembly.js", "web/js/core/artifacts.js", "web/js/modules/onshape.js"]) { assert.match(read(f), /stepItems\(asm(\(\))?, (st\.)?ctx\.built\)/, f); assert.ok(!/instanceName: `\$\{i\.part\} \$\{i\.id\}`/.test(read(f)), `${f} no longer lists the parts flat`); }
  assert.match(read("web/js/core/asm_scene.js"), /return placedTree\(asm, built, find\)\.map\(node\)/);
  assert.match(read("web/js/cad/worker.js"), /if \(it\.children\) \{ list\.push\(\{ key: it\.key, name: it\.name, instanceName: it\.instanceName \|\| it\.name, matrix: it\.matrix \|\| ID, children: expand\(it\.children, true\) \}\); continue; \}/);
});
