/* Drawings : the dimension model (every dimension numbered, classed), the tabloid layout of a part and of an assembly. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { SvgSheet } from "../../web/js/draw/svg.js";
import { PdfSheet } from "../../web/js/draw/pdf.js";
import { composeDrawing, viewRequest, PAPER } from "../../web/js/draw/part_drawing.js";
import { composeAssemblyDrawing, placeBalloons } from "../../web/js/draw/asm_drawing.js";
import { dimensionList, setDimClass, dimText, classNotes, DIM_CLASSES } from "../../web/js/draw/dim_model.js";
import { solve, bom } from "../../web/js/core/assembly_logic.js";
import { matPoint } from "../../web/js/cad/vec.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const hlr = (K, shape) => Object.fromEntries(viewRequest().map((v) => [v.name, K.hlr(shape, v.dir, v.xdir, v.hidden)]));
const clear = (a, b) => a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01;

test("every dimension the design defines is listed once, numbered, and can be classed — the class travels with the part", async () => {
  const K = await kernel(), spec = JSON.parse(JSON.stringify(DEMO_DRIVE.parts[0])), built = buildPart(K, spec), dims = dimensionList(spec, built);
  assert.deepEqual(dims.map((d) => d.n), dims.map((_, i) => i + 1), "numbered 1, 2, 3… with no gap"); assert.equal(new Set(dims.map((d) => d.key)).size, dims.length, "each key once");
  assert.deepEqual(dims.slice(0, 3).map((d) => [d.key, d.kind, d.on]), [["bbox:X", "overall", "front"], ["bbox:Y", "overall", "top"], ["bbox:Z", "overall", "front"]]);
  const lengths = Object.entries(spec.params).filter(([, p]) => typeof p.value === "number" && (p.unit === "mm" || p.unit === "°"));
  for (const [k] of lengths) assert.ok(dims.some((d) => d.param === k), `the design parameter « ${k} » is dimensioned`);
  const bolts = built.interfaces.filter((i) => i.type === "bolt_pattern"); assert.ok(bolts.length >= 3);
  for (const it of bolts) { const mine = dims.filter((d) => d.key.startsWith(`iface:${it.id}:`)); assert.ok(mine.length >= 2 && mine.every((d) => d.basic), `${it.id} is located by basic dimensions`); }
  assert.ok(dims.some((d) => d.kind === "hole" && /^\d+× Ø/.test(d.text)), "holes are grouped : n × Ø");
  assert.ok(dims.every((d) => d.cls === "normal"));
  setDimClass(spec, "bbox:X", "csc"); setDimClass(spec, "bbox:Y", "sc"); setDimClass(spec, "bbox:Z", "ref");
  const again = dimensionList(spec, built); assert.deepEqual(again.slice(0, 3).map((d) => d.cls), ["csc", "sc", "ref"]); assert.equal(dimText(again[2]), `(${again[2].text})`, "a reference dimension is written in brackets");
  assert.deepEqual(again.map((d) => d.n), dims.map((d) => d.n), "classing a dimension does not renumber the others");
  assert.equal(classNotes(again).length, 3); assert.match(classNotes(again).join(" "), /Losange « SC »/); assert.equal(Object.keys(DIM_CLASSES).length, 4);
  assert.deepEqual(fromDwiz(toDwiz(spec)).characteristics, { "bbox:X": "csc", "bbox:Y": "sc", "bbox:Z": "ref" }, "the classes survive the .dwiz file");
  setDimClass(spec, "bbox:X", "normal"); setDimClass(spec, "bbox:Y", "normal"); setDimClass(spec, "bbox:Z", "normal"); assert.equal(spec.characteristics, undefined);
  K.flush();
});

test("a part drawing is a tabloid sheet : notes bottom left, isometric view top right, views in the middle, balloons and classes, ASME Y14.5", async () => {
  const K = await kernel(), spec = JSON.parse(JSON.stringify(DEMO_DRIVE.parts[0])), built = buildPart(K, spec), views = hlr(K, built.bodies[0].shape);
  setDimClass(spec, "bbox:X", "csc"); setDimClass(spec, "bbox:Y", "sc");
  assert.deepEqual(PAPER.TABLOID, [431.8, 279.4], "11 × 17 in, landscape");
  const svg = new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: spec.id }), info = composeDrawing(svg, { spec, built, views, project: DEMO_DRIVE, opts: { date: "2026-01-01" } }), L = info.layout, text = svg.toString(0);
  assert.ok(L.notes.x < L.frame.x + 6 && Math.abs(L.notes.y + L.notes.h - (L.frame.y + L.frame.h)) < 4, "notes in the bottom-left corner");
  assert.ok(L.iso.x + L.iso.w > L.frame.x + L.frame.w - 6 && L.iso.y < L.frame.y + 40 && L.iso.w <= 70, "a small isometric view top right");
  assert.ok(clear(L.views, L.notes) && clear(L.views, L.iso) && L.views.x + L.views.w < L.frame.x + L.frame.w - 180, "the views stay clear of the notes, of the isometric view and of the title-block column");
  const cx = L.views.x + L.views.w / 2, mid = L.area.x + L.area.w / 2; assert.ok(Math.abs(cx - mid) < 12, `the views are centred in what is left (${cx.toFixed(0)} vs ${mid.toFixed(0)})`);
  assert.ok(info.onView.length >= 5 && info.onView.includes("bbox:X"), "overall and pattern dimensions are on the views");
  assert.equal(info.dims.length, dimensionList(spec, built).length);
  for (const re of [/ASME Y14\.5-2018/, />CSC</, />SC</, /COTES DE DÉFINITION/, /TABLEAU DES TROUS/, /B \(11 × 17\)/, /NOTES/]) assert.match(text, re);
  for (const d of info.dims.filter((x) => info.onView.includes(x.key))) assert.match(text, new RegExp(`>${d.n}<`), `balloon ${d.n} is on the sheet`);
  assert.match(info.notes[0], /ASME Y14\.5/); assert.ok(info.notes.some((n) => /Triangle « CSC »/.test(n)));
  const pdf = new PdfSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: spec.id }); composeDrawing(pdf, { spec, built, views, project: DEMO_DRIVE, opts: {} }); assert.ok(pdf.toBytes().length > 20000);
  K.flush();
});

test("an assembly drawing numbers its parts with balloons and carries the parts list above the title block", async () => {
  const K = await kernel(), asm = DEMO_DRIVE.assemblies[0], built = {};
  for (const id of new Set(asm.instances.map((i) => i.part))) built[id] = buildPart(K, DEMO_DRIVE.parts.find((p) => p.id === id));
  const sol = solve(asm, built), shapes = asm.instances.map((i) => K.transform(built[i.part].bodies.length === 1 ? built[i.part].bodies[0].shape : K.compound(built[i.part].bodies.map((b) => b.shape)), sol.placements[i.id]));
  const views = Object.fromEntries(viewRequest().map((v) => [v.name, K.hlr(K.compound(shapes), v.dir, v.xdir, false)])), centers = {}; let bbox = null;
  for (const i of asm.instances) { const b = built[i.part].bbox, c = matPoint(sol.placements[i.id], [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]); if (!centers[i.part]) centers[i.part] = c;
    for (const q of [[b[0], b[1], b[2]], [b[3], b[4], b[5]]]) { const w = matPoint(sol.placements[i.id], q); bbox = bbox ? [Math.min(bbox[0], w[0]), Math.min(bbox[1], w[1]), Math.min(bbox[2], w[2]), Math.max(bbox[3], w[0]), Math.max(bbox[4], w[1]), Math.max(bbox[5], w[2])] : [...w, ...w]; } }
  const rows = bom(DEMO_DRIVE, asm, built).map((r) => ({ ...r, rev: "B" })), parts = rows.filter((r) => r.kind === "part");
  const svg = new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: asm.id }), info = composeAssemblyDrawing(svg, { asm, project: DEMO_DRIVE, views, bbox, rows, centers, mass: 464, opts: { date: "2026-01-01" } }), L = info.layout, text = svg.toString(0);
  assert.equal(info.items.length, parts.length); assert.ok(info.items.every((x) => x.view), "every part of the list has its balloon on a view");
  assert.deepEqual(info.dims.map((d) => d.n), [rows.length + 1, rows.length + 2, rows.length + 3], "dimension balloons are numbered after the items : no number twice");
  assert.ok(Math.abs(L.bom.y + L.bom.h - (L.frame.y + L.frame.h - 48)) < 0.01 && Math.abs(L.bom.x + L.bom.w - (L.frame.x + L.frame.w)) < 0.01, "the parts list sits on the title block, bottom right");
  assert.ok(L.notes.x < L.frame.x + 6 && clear(L.views, L.notes) && clear(L.views, L.bom) && clear(L.views, L.iso));
  for (const re of [/NOMENCLATURE/, /DRV-BASE/, /ASME Y14\.5-2018/, /gamme d'assemblage/]) assert.match(text, re);
  const spread = placeBalloons([{ item: 1, p: [50, 50] }, { item: 2, p: [50.2, 50.1] }, { item: 3, p: [80, 50] }], { x: 20, y: 30, w: 60, h: 40 });
  for (let i = 0; i < spread.length; i++) for (let j = i + 1; j < spread.length; j++) assert.ok(Math.hypot(spread[i].b[0] - spread[j].b[0], spread[i].b[1] - spread[j].b[1]) >= 9, "two balloons never touch");
  assert.ok(spread.every((x) => x.b[0] < 20 - 5 || x.b[0] > 80 + 5 || x.b[1] < 30 - 5 || x.b[1] > 70 + 5), "balloons stand outside the view");
  K.flush();
});
