/* PCBA: layer artwork, Gerber and drill files, the fabrication package. */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { layerArt, coatingKeepouts, LAYER_NAMES } from "../../web/js/pcba/art.js";
import { gerber } from "../../web/js/pcba/gerber.js";
import { excellon, drillTable } from "../../web/js/pcba/drill.js";
import { readGerber, readExcellon } from "../../web/js/pcba/gerber_read.js";
import { fabPackage, fabZip, stackup, FAB_FILES } from "../../web/js/pcba/fabfiles.js";
import { textStrokes, textWidth } from "../../web/js/pcba/strokefont.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { LIB, smallBoard } from "./pcba_fixture.mjs";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
/** The small board, routed, with a ground plane underneath and an acrylic coating on both sides. */
function routed() { const b = smallBoard(); b.board.coating = { type: "AR", thickness: 50, sides: "both" }; b.planes = [{ net: "GND", layer: "bottom" }]; autoroute(b, LIB); return b; }

test("stroke font: every character draws inside its cell, text can be centred, turned and mirrored", () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-.,_/:()#%=µΩ°") for (const pts of textStrokes(ch, { h: 6 })) for (const [x, y] of pts) assert.ok(x >= -1e-9 && x <= 4 + 1e-9 && y >= -1e-9 && y <= 6 + 1e-9, ch);
  near(textWidth("R12", 1), (3 * 6 - 2) / 6); assert.equal(textStrokes("a", {}).length, textStrokes("A", {}).length); assert.equal(textStrokes("~", {}).length, 1, "an unknown character is a box");
  const c = textStrokes("U1", { x: 10, y: 5, h: 1.2, align: "center" }).flat(), xs = c.map((p) => p[0]);
  near((Math.min(...xs) + Math.max(...xs)) / 2, 10, 0.15);          // the ink of « 1 » is narrower than its cell
  const m = textStrokes("L", { x: 0, y: 0, h: 6, mirror: true }).flat(); assert.ok(m.every((p) => p[0] <= 1e-9), "mirrored text runs to the left");
  const r = textStrokes("I", { x: 0, y: 0, h: 6, rot: 90 }).flat(); assert.ok(r.every((p) => p[0] <= 1e-9 && p[1] >= -1e-9), "turned text runs upwards");
});

test("artwork: lands on their layers, paste for surface-mount only, mask larger than the lands, silkscreen clear of them, coating keep-outs", () => {
  const b = routed(), R = resolveBoard(b, LIB), art = layerArt(R, b), L = art.layers, pads = (k) => L[k].filter((p) => p.t === "pad" && !p.clear);
  assert.equal(pads("top").length, 20); assert.equal(pads("bottom").length, 4, "only the four through-hole pads reach the bottom");
  assert.equal(L.paste_top.length, 16); assert.equal(L.paste_bottom.length, 0);
  for (const m of L.mask_top.filter((p) => p.t === "pad")) { const land = pads("top").find((p) => p.x === m.x && p.y === m.y); near(m.w - land.w, 2 * R.fab.maskExp); }
  assert.equal(L.mask_bottom.length, 4 + 2, "through-hole pads and the two holes");
  const open = R.pads.map((p) => [p.x - p.w / 2 - R.fab.maskExp, p.y - p.h / 2 - R.fab.maskExp, p.x + p.w / 2 + R.fab.maskExp, p.y + p.h / 2 + R.fab.maskExp]);
  for (const s of L.silk_top.filter((p) => p.t === "track")) for (const [x, y] of s.pts) for (const k of open) assert.ok(x < k[0] - 0.05 || x > k[2] + 0.05 || y < k[1] - 0.05 || y > k[3] + 0.05, "silkscreen over a pad opening");
  assert.ok(L.silk_top.length > 30 && art.notes.every((n) => !/non sérigraphié/.test(n)), "every repère found a place");
  const plane = L.bottom; assert.equal(plane[0].t, "region"); assert.ok(plane[1].clear && plane.filter((p) => p.clear).length >= 1 + 2 + 2, "edge pull-back, the two foreign through-hole pads, the two holes");
  assert.ok(plane.findIndex((p) => p.clear) < plane.findIndex((p) => p.t === "pad" && !p.clear), "clearances come before the lands drawn back on top");
  const keep = coatingKeepouts(R, b); assert.equal(keep.length, 2 * (2 + 2) - 2, "two headers on top, two holes on each side"); assert.equal(L.coat_top.filter((p) => p.clear).length, 4);
  assert.equal(art.drills.filter((d) => d.kind === "pad").length, 4); assert.equal(art.drills.filter((d) => d.kind === "hole" && !d.plated).length, 2); assert.equal(art.drills.filter((d) => d.kind === "via").length, b.vias.length);
  assert.deepEqual(art.order.filter((k) => !LAYER_NAMES[k]), []);
  b.board.coating.type = "none"; assert.equal(layerArt(R, b).layers.coat_top, undefined);
});

test("Gerber: every layer reads back — units, apertures, flashes at the pad positions, polarity for planes and keep-outs", () => {
  const b = routed(), R = resolveBoard(b, LIB), pk = fabPackage(b, LIB, { date: new Date("2026-11-14T12:00:00Z") }), file = (key) => pk.files.find((f) => f.key === key);
  for (const f of pk.files.filter((x) => x.mime === "application/vnd.gerber")) { const g = readGerber(f.text); assert.equal(g.units, "mm"); assert.deepEqual(g.digits, [4, 6]); assert.ok(g.attributes.FileFunction, f.name); assert.match(f.text, /M02\*\n$/); }
  const top = readGerber(file("top").text);
  assert.equal(top.attributes.FileFunction, "Copper,L1,Top"); assert.equal(readGerber(file("bottom").text).attributes.FileFunction, "Copper,L2,Bot");
  for (const p of R.pads.filter((x) => x.layers.includes("top"))) { const fl = top.flashes.find((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6); assert.ok(fl, p.pin); const a = top.apertures.get(fl.aperture); near(a.w, p.w); near(a.h, p.h); assert.equal(a.shape, p.shape === "round" ? "C" : "R"); }
  assert.ok(top.bbox[0] > 0 && top.bbox[1] > 0 && top.bbox[2] < 40 && top.bbox[3] < 30, "copper stays inside the board");
  assert.ok(top.strokes.length >= 8 && top.strokes.every((s) => top.apertures.get(s.aperture).shape === "C"));
  assert.match(file("top").text, /%TO\.N,\+12V\*%/); assert.ok(!/%TO\.N/.test(file("silk_top").text));
  const bot = readGerber(file("bottom").text); assert.equal(bot.regions.length, 1); assert.ok(bot.clear >= 1 && bot.flashes.some((q) => !q.dark), "foreign pads are cleared out of the plane");
  const coat = readGerber(file("coat_top").text); assert.equal(coat.regions.filter((r) => r.dark).length, 1); assert.equal(coat.regions.filter((r) => !r.dark).length, 4);
  assert.equal(readGerber(file("mask_top").text).attributes.FilePolarity, "Negative"); assert.equal(readGerber(file("outline").text).attributes.FileFunction, "Profile,NP");
  assert.equal(readGerber(file("outline").text).strokes[0].pts.length, 37, "the rounded outline is closed");
  assert.throws(() => readGerber("%FSLAX46Y46*%\nD10*\nX1Y1D03*\nM02*\n"), /unités|ouverture/); assert.throws(() => readGerber(file("top").text.replace("M02*", "")), /M02/); assert.throws(() => readGerber("%FSLAX46Y46*%\n%MOMM*%\nG03*\nM02*\n"), /non prise en charge/);
  assert.equal(gerber([{ t: "track", w: 0.2, pts: [[1, 1], [1, 1]] }]).match(/D03/g).length, 1, "a zero-length stroke is flashed");
});

test("drill files, pick-and-place, bill of materials, notes, archive", () => {
  const b = routed(), pk = fabPackage(b, LIB, { date: new Date("2026-11-14T12:00:00Z"), quantity: 5 }), file = (key) => pk.files.find((f) => f.key === key);
  const pth = readExcellon(file("pth").text), npth = readExcellon(file("npth").text);
  assert.equal(pth.units, "mm"); assert.equal(pth.plated, true); assert.equal(pth.hits.length, 4 + b.vias.length); assert.equal(pth.hits.filter((h) => h.d === 1).length, 4);
  assert.equal(npth.plated, false); assert.deepEqual(npth.hits.map((h) => [h.x, h.y, h.d]), [[3, 3, 3.2], [37, 27, 3.2]]);
  assert.deepEqual(drillTable([{ d: 0.3, plated: true }, { d: 0.3, plated: true }, { d: 3.2, plated: false }]).map((t) => [t.tool, t.d, t.count]), [[1, 0.3, 2], [1, 3.2, 1]]);
  assert.throws(() => readExcellon("M48\nMETRIC,TZ\n%\nX1Y1\nM30\n"), /sans outil/); assert.match(excellon([], { plated: true }), /M30\n$/);
  const pnp = file("pnp").text.trim().split("\r\n"); assert.equal(pnp[0], "Designator,Comment,Layer,Footprint,Center-X(mm),Center-Y(mm),Rotation,Description"); assert.equal(pnp.length, 1 + 7);
  assert.ok(pnp.includes("J1,,TopLayer,\"1x02 2,54\",5.000,15.000,90,\"Barrette 2 broches 2,54\""));
  const bom = file("bom").text.trim().split("\r\n"); assert.equal(bom.length, 1 + 6); assert.match(bom[1], /^1,1,C1,10 µF,/);
  assert.equal(file("netcsv").text.trim().split("\r\n").length, 1 + 17); assert.match(file("ipc").text, /^327\+12V {13}U1 {4}-1 {4}/m); assert.match(file("ipc").text, /999\n$/);
  const notes = file("notes").text;
  for (const s of ["40 × 30 mm", "2 couches", "Acrylique (AR), 50 µm, deux faces", "IPC-CC-830", "Quantité : 5", "Non métallisé Ø 3,2 mm × 2", "J1     dessus  — connecteur"]) assert.ok(notes.includes(s), s);
  assert.equal(pk.stats.layers, 2); assert.equal(pk.stats.smd, 16); assert.equal(pk.stats.tht, 4); assert.deepEqual(pk.stats.sides, ["top"]); assert.equal(pk.stats.fab, "standard");
  near(stackup(b).reduce((s, r) => s + r.thickness, 0), 1.6 + 0.04, 1e-9); near(stackup({ board: { layers: 4, t: 1.6, copper: 35 } }).reduce((s, r) => s + r.thickness, 0), 1.64, 1e-9);
  assert.equal(stackup({ board: { layers: 4 } }).length, 9); assert.ok(FAB_FILES.every((f) => f.label && f.ext));
  const z = fabZip(b, LIB, { date: new Date("2026-11-14T12:00:00Z") }), names = [];
  for (let p = 0; z[p] === 0x50 && z[p + 1] === 0x4b && z[p + 2] === 3 && z[p + 3] === 4;) { const v = new DataView(z.buffer, p), n = v.getUint16(26, true), size = v.getUint32(18, true); names.push(new TextDecoder().decode(z.subarray(p + 30, p + 30 + n))); p += 30 + n + size; }
  assert.deepEqual(names, pk.files.map((f) => f.name)); assert.ok(names.includes("T-PCBA-revA.GTL") && names.includes("T-PCBA-revA-PTH.DRL"));
});
