/* Point 5 of the roadmap (JP, 21 novembre 2026) : the tolerance block « UNLESS OTHERWISE SPECIFIED » and its example values, the room left on
   a sheet where a feature control frame or a detail view goes, the detail views — a circle drawn on a view, enlarged, the views put back by
   themselves — and the AI round trip of all that.
     node --test tests/node/drawing_sheet.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { SvgSheet } from "../../web/js/draw/svg.js";
import { composeDrawing, viewRequest, PAPER } from "../../web/js/draw/part_drawing.js";
import { uosOf, uosLines, uosNote, uosIssues, uosCheck, UOS_EXAMPLE } from "../../web/js/draw/uos.js";
import { Room, placeLabel, placeBox } from "../../web/js/draw/sheet_room.js";
import { clipCircle, newDetail, copyDetail, nextLetter, detailCheck, detailIssues, detailScaleFor, DETAIL_LETTERS } from "../../web/js/draw/detail_view.js";
import { moreDoc, moreCheck, moreApply } from "../../web/js/core/ai_more.js";
import { aiRead } from "../../web/js/core/ai_loop.js";
import { toDwiz } from "../../web/js/core/dwiz.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const clear = (a, b) => a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01;
const read = (f) => readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8");

test("the tolerance block : ASME by decimals or ISO 2768 ; example values said as such until the project enters or confirms them", () => {
  const u = uosOf(null); assert.equal(u.basis, "asme"); assert.equal(u.sure, false); assert.deepEqual(u.mm, UOS_EXAMPLE.mm);
  assert.deepEqual(uosLines(u), ["UNLESS OTHERWISE SPECIFIED:", "DIMENSIONS ARE IN MILLIMETERS", "TOLERANCES:", "X ±0.5", "X.X ±0.2", "X.XX ±0.05", "ANGLES ±0.5°", "INTERPRET GD&T PER ASME Y14.5-2018"]);
  assert.deepEqual(uosLines(u, true).slice(1, 5), ["DIMENSIONS ARE IN INCHES", "TOLERANCES:", "X.XX ±.01", "X.XXX ±.005"], "an inch drawing : its own values, no zero before the point");
  assert.match(uosLines(uosOf({ uos: { basis: "iso2768", iso: "fH" } })).join(" "), /GENERAL TOLERANCES ISO 2768-fH/); assert.match(uosNote(u), /see the tolerance block/);
  assert.equal(uosIssues({}).length, 1); assert.equal(uosIssues({}).at(0).level, "todo"); assert.equal(uosIssues({ status: "Issued" }).at(0).level, "error", "an issued drawing with example values");
  assert.deepEqual(uosIssues({ uos: { ...UOS_EXAMPLE, sure: true } }), []);
  assert.equal(uosOf({ uos: { mm: [1, -2, 3] } }).mm.join(), UOS_EXAMPLE.mm.join(), "a wrong value falls back to the example");
  assert.deepEqual(uosCheck({ basis: "asme", mm: [0.5, 0.2, 0.05], angle: 1 }), []); assert.equal(uosCheck({ basis: "din", mm: [1], iso: "zz", angle: -1, sure: "yes" }).length, 5);
});

test("the room of a sheet : a label goes on white, near what it points at ; when nothing is white, it says it is crowded", () => {
  const room = new Room(200, 100), area = { x: 0, y: 0, w: 200, h: 100 };
  room.rect(50, 30, 60, 40);                                   // a view
  const at = placeLabel(room, { to: [110, 50], dir: [1, 0], w: 30, h: 5, area, own: { x: 50, y: 30, w: 60, h: 40 } });
  assert.ok(at && !at.crowded && at.x >= 110 && Math.hypot(at.stub[0] - 110, at.stub[1] - 50) < 20, "beside the view, toward its outside");
  assert.ok(room.free(at.x, at.y, 30, 5), "on white");
  const full = new Room(60, 30); full.rect(0, 0, 60, 30);
  const c = placeLabel(full, { to: [30, 15], w: 20, h: 5, area: { x: 0, y: 0, w: 60, h: 30 } }); assert.ok(c && c.crowded);
  assert.equal(placeBox(full, 10, 10, [30, 15], { x: 0, y: 0, w: 60, h: 30 }), null); assert.ok(placeBox(room, 40, 25, [0, 0], area), "a box finds white room");
});

test("a detail : the lines of its view inside its circle ; its letter, its scale, its copy born Off ; what the guide and an answer may say", () => {
  assert.deepEqual(clipCircle([[-10, 0], [10, 0]], [0, 0], 5), [[[-5, 0], [5, 0]]]); assert.deepEqual(clipCircle([[-10, 9], [10, 9]], [0, 0], 5), []);
  assert.equal(clipCircle([[-10, 0], [0, 0], [0, 10]], [0, 0], 5).length, 1, "a polyline that turns inside the circle stays one line");
  const part = { id: "P" }, d = newDetail(part, { view: "top", at: [12.345, 6], r: 8, scale: 4 }); assert.deepEqual(d, { id: "det-D", letter: "D", view: "top", at: [12.35, 6], r: 8, scale: 4 });
  part.details = [d]; assert.equal(nextLetter(part), "E"); const c = copyDetail(part, d); assert.equal(c.on, false); assert.equal(c.letter, "E");
  assert.ok(!/[IOQABC]/.test(DETAIL_LETTERS)); assert.equal(detailScaleFor(2 / 3), 2); assert.equal(detailScaleFor(0.5), 1); assert.equal(detailScaleFor(1), 2);
  assert.deepEqual(detailCheck([d]), []); assert.equal(detailCheck([{ ...d, letter: "I", view: "iso", at: [1], r: 0, scale: 3 }]).length, 5);
  const boxes = { top: { x0: 0, y0: 0, x1: 100, y1: 50 } };
  assert.deepEqual(detailIssues({ id: "P", details: [d] }, { boxes, scale: 0.5 }), []);
  assert.equal(detailIssues({ id: "P", details: [{ ...d, at: [500, 500] }] }, { boxes }).at(0).level, "warn", "a detail that no longer covers its view");
  assert.equal(detailIssues({ id: "P", details: [{ ...d, scale: 0.5 }] }, { boxes, scale: 0.5 }).at(0).level, "tip", "a detail no larger than the sheet");
});

test("on the sheet : the details take the white room, the views go down a scale to make some ; a detail too large goes to a sheet of its own", async () => {
  const K = await kernel(), spec = clone(DEMO_DRIVE.parts[0]), built = buildPart(K, spec), views = Object.fromEntries(viewRequest().map((v) => [v.name, K.hlr(built.bodies[0].shape, v.dir, v.xdir, v.hidden)]));
  const draw = (details, uos) => { const svg = new SvgSheet({ width: PAPER.TABLOID[0], height: PAPER.TABLOID[1] }); spec.details = details; const info = composeDrawing(svg, { spec, built, views, project: DEMO_DRIVE, opts: uos ? { uos } : {} }); return { info, pages: svg.toStrings() }; };
  const one = draw([{ id: "det-D", letter: "D", view: "top", at: [12, 12], r: 6, scale: 2 }]);
  assert.equal(one.info.scale, "1:1.5", "a small detail fits beside the views : they keep their scale"); assert.equal(one.info.details.length, 1); assert.equal(one.info.details[0].sheet, 1);
  assert.match(one.pages[0], />DETAIL D</); assert.match(one.pages[0], /SCALE 2:1/);
  for (const [name, v] of Object.entries(one.info.layout.boxes)) assert.ok(clear(one.info.details[0].box, v), `the detail stays off the ${name} view`);
  for (const g of one.info.gdt) assert.ok(clear(one.info.details[0].box, g.box), `the detail and the frame of ${g.name} do not overlap`);
  const two = draw([{ id: "det-D", letter: "D", view: "top", at: [12, 12], r: 12, scale: 4 }, { id: "det-E", letter: "E", view: "front", at: [110, 14], r: 9, scale: 2 }]);
  assert.equal(two.info.scale, "1:2", "two large details : the views go down one scale, by themselves"); assert.ok(two.info.details.every((x) => x.sheet === 1));
  const big = draw([{ id: "det-D", letter: "D", view: "top", at: [80, 55], r: 60, scale: 4 }]);
  assert.equal(big.info.scale, "1:1.5", "no room even smaller : the views keep their scale…"); assert.equal(big.info.details[0].sheet, 3); assert.equal(big.info.sheets, 3); assert.match(big.pages[2], /DETAIL VIEWS — DRV-BASE/);
  const off = draw([{ id: "det-D", letter: "D", view: "top", at: [12, 12], r: 6, scale: 2, on: false }], { ...UOS_EXAMPLE, sure: true });
  assert.equal(off.info.details.length, 0, "a detail at Off is not drawn"); assert.ok(!/EXAMPLE VALUES/.test(off.pages[0]), "confirmed values : the sheet no longer says « example »");
  K.flush();
});

test("the AI round trip of the sheet : the tolerance block, the notes at Off, the details — an answer never confirms the values of the block", () => {
  const p = { dw: "project/1", id: "p", name: "P", parts: clone(DEMO_DRIVE.parts.slice(0, 1)), assemblies: [], drawing: { uos: { ...UOS_EXAMPLE, sure: true } }, log: [] }, key = `drawing:part:${p.parts[0].id}`;
  const doc = aiRead(toDwiz(moreDoc(p, key))); assert.deepEqual(doc.details, []); assert.equal(doc.sheet.uos.sure, true);
  doc.sheet.uos = { ...doc.sheet.uos, mm: [1, 0.3, 0.1], sure: true }; doc.sheet.notesOff = ["marks"]; doc.details = [{ letter: "D", view: "top", at: [10, 10], r: 5, scale: 2 }];
  const notes = moreCheck(p, key, doc); assert.ok(!notes.some((n) => n.severity === "block")); assert.ok(notes.some((n) => /une réponse ne les confirme pas/.test(n.text)));
  moreApply(p, key, doc); assert.deepEqual(p.drawing.uos.mm, [1, 0.3, 0.1]); assert.equal(p.drawing.uos.sure, false, "new values from an answer are examples again"); assert.deepEqual(p.drawing.notesOff, ["marks"]);
  assert.equal(p.parts[0].details[0].id, "det-D");
  const same = aiRead(toDwiz(moreDoc(p, key))); p.drawing.uos.sure = true; moreApply(p, key, same); assert.equal(p.drawing.uos.sure, true, "the same values come back : the confirmation stays");
  const bad = aiRead(toDwiz(moreDoc(p, key))); bad.sheet.uos = { basis: "din" }; bad.details = [{ letter: "O", view: "iso" }]; bad.sheet.notesOff = "marks";
  assert.ok(moreCheck(p, key, bad).filter((n) => n.severity === "block").length >= 3);
});

test("wired : the screen edits the block, the notes and the details in the right margin ; the zone is drawn on the sheet ; the sheet reads them", () => {
  const scr = read("modules/drawings.js"), ui = read("modules/drawing_sheet_ui.js");
  assert.match(scr, /uosSection\(d\(\)/); assert.match(scr, /detailSection\(spec/); assert.match(scr, /autoNotes\(st\.doc\.info\.autoNotes/); assert.match(scr, /detailPicker\(center/);
  assert.match(scr, /uos: uosOf\(d\), notesOff: d\.notesOff/); assert.match(scr, /field\("Titre"/); assert.match(scr, /field\("Date"/);
  assert.match(ui, /getScreenCTM\(\)/); assert.match(ui, /e\.key === "Escape"/); assert.match(ui, /class: "detail-pick"|cls: "detail-pick"/);
  assert.match(read("draw/asm_drawing.js"), /uos: \{ lines: uosLines\(U/);
});
