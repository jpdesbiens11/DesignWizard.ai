/* Drawings : the dimension model (every dimension numbered, classed), the tabloid layout of a part and of an assembly. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { SvgSheet } from "../../web/js/draw/svg.js";
import { PdfSheet } from "../../web/js/draw/pdf.js";
import { composeDrawing, viewRequest, bounds, PAPER, tagRange } from "../../web/js/draw/part_drawing.js";
import { hatch } from "../../web/js/draw/hatch.js";
import { sectionOf, sectionView } from "../../web/js/cad/section_view.js";
import { composeAssemblyDrawing, placeBalloons } from "../../web/js/draw/asm_drawing.js";
import { dimensionList, locateParams, setDimClass, dimText, classNotes, DIM_CLASSES } from "../../web/js/draw/dim_model.js";
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
  assert.equal(classNotes(again).length, 3); assert.match(classNotes(again).join(" "), /Diamond “SC”/); assert.equal(Object.keys(DIM_CLASSES).length, 4);
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
  const block = { x: L.frame.x + L.frame.w - 180, y: L.frame.y + L.frame.h - 48, w: 180, h: 48 };
  for (const [name, v] of Object.entries(L.boxes)) assert.ok(clear(v, L.notes) && clear(v, L.stack) && clear(v, block) && v.x >= L.area.x && v.y >= L.area.y && v.x + v.w <= L.area.x + L.area.w && v.y + v.h <= L.area.y + L.area.h, `the ${name} view stays clear of the notes, of the tables of the corner and of the title block`);
  /* the views take the sheet : no micro-view. The base (160 × 110 × 42) is drawn at 1:1,5 — it was 1:2,5 when a column of tables took the right of the sheet */
  assert.equal(info.scale, "1:1.5"); assert.ok(L.views.w * L.views.h > 0.3 * L.area.w * L.area.h, "the block of the views covers a good third of the sheet"); assert.ok(L.stack.w <= 150 && L.stack.x + L.stack.w > L.frame.x + L.frame.w - 1 && L.stack.y === L.frame.y, "the tables keep to the top right corner");
  /* a geometric tolerance is tied to what it controls : a hexagonal flag on the feature, the same flag in the table, with the tags of its holes */
  assert.deepEqual(info.gdt.map((g) => g.flag), info.gdt.map((_, i) => `T${i + 1}`)); assert.ok(info.gdt.length >= 4 && info.gdt.every((g) => g.at && g.at.every(Number.isFinite)), "every tolerance has its flag on a view");
  for (const g of info.gdt) { assert.equal((text.match(new RegExp(`>${g.flag}<`, "g")) || []).length, 2, `${g.flag} : once on the view, once in the table`); if (g.symbol === "position" && g.count > 1) assert.match(g.tags, /^[A-Z]\d+–[A-Z]\d+$/, `${g.flag} names its holes (${g.tags})`); }
  assert.match(text, /GEOMETRIC TOLERANCES/); assert.match(text, /4× · A1–A4 · /); assert.equal(tagRange(["A1", "A2", "A3", "A4"]), "A1–A4"); assert.equal(tagRange(["A1", "A3"]), "A1, A3"); assert.equal(tagRange(["B2"]), "B2");
  for (let i = 0; i < info.gdt.length; i++) for (let j = i + 1; j < info.gdt.length; j++) assert.ok(Math.hypot(info.gdt[i].at[0] - info.gdt[j].at[0], info.gdt[i].at[1] - info.gdt[j].at[1]) >= 6.5, `flags ${i + 1} and ${j + 1} do not sit on one another`);
  /* the long table of the definition dimensions is on a second sheet, with the same frame and title block */
  assert.equal(info.sheets, 2); const pages = svg.toStrings(); assert.equal(pages.length, 2); assert.match(pages[1], /DEFINITION DIMENSIONS — DRV-BASE/); assert.match(pages[0], />1\/2</); assert.match(pages[1], />2\/2</); assert.ok(!pages[0].includes("DEFINITION DIMENSIONS") && pages[1].includes("Hauteur des colonnettes"));
  assert.ok(info.onView.length >= 5 && info.onView.includes("bbox:X"), "overall and pattern dimensions are on the views");
  assert.equal(info.dims.length, dimensionList(spec, built).length);
  for (const re of [/ASME Y14\.5-2018/, />CSC</, />SC</, /GEOMETRIC TOLERANCES/, /HOLE TABLE/, /B \(11 × 17\)/, /NOTES/]) assert.match(text, re);
  for (const d of info.dims.filter((x) => info.onView.includes(x.key))) assert.match(text, new RegExp(`>${d.n}<`), `balloon ${d.n} is on the sheet`);
  assert.match(info.notes[0], /ASME Y14\.5/); assert.ok(info.notes.some((n) => /Triangle “CSC”/.test(n)));
  const pdf = new PdfSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: spec.id }); composeDrawing(pdf, { spec, built, views, project: DEMO_DRIVE, opts: {} }); assert.ok(pdf.toBytes().length > 20000);
  K.flush();
});

test("a design parameter is dimensioned where its operation shows it : the wall, a window, its centre, a corner radius — a formula stays in the table", async () => {
  const K = await kernel(), spec = DEMO_DRIVE.parts.find((p) => p.id === "DRV-BASE"), built = buildPart(K, spec), where = locateParams(spec, built), dims = dimensionList(spec, built), by = (k) => dims.find((d) => d.key === `param:${k}`);
  assert.deepEqual([...where.keys()].sort(), ["L", "W", "pwrX", "rc", "wall", "winL", "winW"], "L and W are found too : they are the overall sizes, dimensioned as such");
  assert.deepEqual(where.get("winL"), { on: "top", dir: "h", p1: [25, 80], p2: [69, 80] }, "the window of the floor, on the view that faces it"); assert.deepEqual(where.get("winW"), { on: "top", dir: "v", p1: [69, 30], p2: [69, 80] });
  assert.deepEqual(where.get("pwrX"), { on: "top", dir: "h", p1: [0, 55], p2: [47, 55] }, "« pwrX - winL/2 » : the centre of the window, from the datum edge"); assert.deepEqual(where.get("wall"), { on: "top", dir: "h", p1: [0, 55], p2: [2.5, 55] }, "the wall of the shell, seen from its open side");
  assert.deepEqual([where.get("rc").radius, where.get("rc").on, where.get("rc").leader.map((v) => Math.round(v * 100) / 100)], [true, "top", [158.24, 1.76]], "a radius : a leader from the middle of its corner");
  assert.deepEqual(["wall", "rc", "pwrX", "winL", "winW", "so", "ctlX"].map((k) => by(k).kind), ["detail", "detail", "detail", "detail", "detail", "param", "param"], "what is only reached through a formula stays in the table");
  assert.deepEqual([by("rc").text, by("so").table, by("winL").table, by("winL").text], ["R 6", "def", undefined, "44"]); assert.deepEqual(dims.map((d) => d.n), dims.map((d, i) => i + 1));
  const moved = { ...spec, features: spec.features.map((f) => (f.id === "window" ? { ...f, face: "+Y" } : f)) }; assert.equal(locateParams(moved, built).get("winL").on, "front", "a pocket on a side face is dimensioned on the view of that face");
  assert.equal(locateParams({ ...spec, features: [] }, built).size, 0); K.flush();
});

test("hatching fills what is cut and leaves the holes white, whatever the order of the outlines", () => {
  const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]], len = (h) => h.reduce((t, [a, b]) => t + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
  const ring = hatch([sq(0, 0, 10), sq(3, 3, 4)], 1, 0); assert.equal(ring.length, 6 + 2 * 4, "ten lines ; the four that meet the hole are cut in two"); assert.ok(Math.abs(len(ring) - 84) < 1e-9, "length × spacing = the area of the ring");
  assert.ok(Math.abs(len(hatch([sq(0, 0, 10), sq(3, 3, 4)], 0.5, 45)) * 0.5 - 84) < 1.5, "at 45° too");
  const pieces = sq(0, 0, 10).slice(0, 4).map((p, i, l) => [l[(i + 3) % 4], l[(i + 2) % 4]].reverse()); assert.ok(Math.abs(len(hatch(pieces, 1, 30)) - 100) < 2, "the outline may come as loose segments, in any order");
  assert.deepEqual(hatch([], 1), []); assert.deepEqual(hatch([sq(0, 0, 10)], 0), []);
});

test("a section view : the part cut across, what stays behind the plane, the cut outline closed and hatched — on the sheet, in the row of the front view", async () => {
  const K = await kernel(), spec = DEMO_DRIVE.parts.find((p) => p.id === "DRV-BASE"), built = buildPart(K, spec), shape = built.bodies[0].shape, ask = sectionOf(spec, built), r = (x) => Math.round(x * 100) / 100;
  assert.deepEqual([ask.axis, ask.dir, ask.xdir], ["x", [-1, 0, 0], [0, 1, 0]], "across the length, seen like the right view"); assert.ok(Math.abs(ask.at - 80) < 0.2, "through the middle");
  const v = sectionView(K, shape, ask), ends = new Map(); for (const pl of v.cut) for (const q of [pl[0], pl.at(-1)]) { const k = q.map((x) => x.toFixed(3)).join(); ends.set(k, (ends.get(k) || 0) + 1); }
  assert.ok(v.cut.length >= 8 && [...ends.values()].every((n) => n % 2 === 0), "every end of the cut outline meets another : closed loops"); assert.equal(v.hidden.length, 0);
  const b = bounds(v); assert.deepEqual([b.x0, b.x1, b.y0, b.y1].map(r), [0, 110, 0, 42], "the width and the height of the part");
  const area = hatch(v.cut, 0.25, 45).reduce((t, [p, q]) => t + Math.hypot(q[0] - p[0], q[1] - p[1]), 0) * 0.25; assert.ok(area > 450 && area < 560, `the cut is a thin U : two walls and a floor of 2,5 mm (${area.toFixed(0)} mm²)`);
  assert.throws(() => sectionView(K, shape, { ...ask, at: 999 }), /ne traverse pas/);
  /* what a part asks for : nothing when it has nothing inside, nothing when told so, another plane when given */
  const plate = { dw: "part/1", id: "P", name: "Plaque", params: {}, features: [{ op: "box", id: "b", size: [40, 20, 5] }], interfaces: [] }; assert.equal(sectionOf(plate, buildPart(K, plate)), null);
  assert.equal(sectionOf({ ...spec, section: { axis: "none" } }, built), null); assert.deepEqual([sectionOf({ ...spec, section: { axis: "y", at: 30 } }, built).at, sectionOf({ ...spec, section: { axis: "y", at: 30 } }, built).dir], [30, [0, 1, 0]]); assert.ok(Math.abs(sectionOf({ ...spec, section: { axis: "x", at: 999 } }, built).at - 80) < 0.2, "a plane outside the part falls back to the middle");
  /* on the sheet */
  const views = { ...hlr(K, shape), section: v }, svg = new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: spec.id }), info = composeDrawing(svg, { spec, built, views, project: DEMO_DRIVE, opts: { date: "2026-01-01" } }), S = info.section, L = info.layout, text = svg.toStrings().join("\n");
  assert.ok(S && S.scale === info.scale && S.axis === "x", "at the scale of the sheet"); assert.ok(clear(S, L.notes) && clear(S, L.stack) && Object.values(L.boxes).every((v) => clear(S, v)) && S.x >= L.area.x && S.x + S.w <= L.area.x + L.area.w && S.y >= L.frame.y, "inside the room of the views, clear of the notes, of the corner and of the three views");
  assert.ok(Math.abs(S.y + S.h - (L.boxes.front.y + L.boxes.front.h)) < 0.01 && S.x > L.boxes.right.x + L.boxes.right.w, "in the row of the front view, right of the right view");
  assert.match(text, /SECTION A-A/); assert.match(text, />A</, "the letters of the cutting plane, on the top view");
  for (const k of ["wall", "rc", "pwrX", "winL", "winW"]) assert.ok(info.onView.includes(`param:${k}`), `${k} is on a view`);
  assert.ok(!text.includes("Fenêtre thermique (X)") && text.includes("Hauteur des colonnettes"), "a dimension drawn on a view is not repeated in the table ; the others are there");
  for (const d of info.dims.filter((x) => info.onView.includes(x.key))) assert.match(text, new RegExp(`>${d.n}<`), `balloon ${d.n} is on the sheet`);
  assert.equal(composeDrawing(new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1], title: "x" }), { spec, built, views: hlr(K, shape), project: DEMO_DRIVE, opts: {} }).section, null, "no section asked, none drawn");
  assert.deepEqual(viewRequest(ask).map((q) => q.name), ["front", "top", "right", "iso", "section"]); assert.equal(viewRequest().length, 4);
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
  for (const re of [/BILL OF MATERIALS/, /DRV-BASE/, /ASME Y14\.5-2018/, /assembly routing/]) assert.match(text, re);
  const spread = placeBalloons([{ item: 1, p: [50, 50] }, { item: 2, p: [50.2, 50.1] }, { item: 3, p: [80, 50] }], { x: 20, y: 30, w: 60, h: 40 });
  for (let i = 0; i < spread.length; i++) for (let j = i + 1; j < spread.length; j++) assert.ok(Math.hypot(spread[i].b[0] - spread[j].b[0], spread[i].b[1] - spread[j].b[1]) >= 9, "two balloons never touch");
  assert.ok(spread.every((x) => x.b[0] < 20 - 5 || x.b[0] > 80 + 5 || x.b[1] < 30 - 5 || x.b[1] > 70 + 5), "balloons stand outside the view");
  K.flush();
});
