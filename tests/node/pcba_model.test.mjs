/* PCBA: the board document, its resolved geometry, plane geometry of copper, connectivity. */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveBoard, boardBom, trackForCurrent, netRules, nextRef, outlineOf, copperLayers, place } from "../../web/js/pcba/model.js";
import { segSeg, gap, padShape, discShape, inPoly, edgeGap, polyArea } from "../../web/js/pcba/geom2d.js";
import { connectivity, ratsnest } from "../../web/js/pcba/connect.js";
import { LIB, smallBoard } from "./pcba_fixture.mjs";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("model: parts are placed, turned and mirrored ; pads carry their net and their layers", () => {
  const b = smallBoard(), R = resolveBoard(b, LIB);
  assert.deepEqual(R.problems, []);
  assert.equal(R.parts.length, 7); assert.equal(R.pads.length, 2 + 8 + 2 + 2 + 2 + 2 + 2);
  const j11 = R.pads.find((p) => p.pin === "J1.1"), u1 = R.pads.find((p) => p.pin === "U1.1");
  near(j11.x, 5); near(j11.y, 15 - 1.27); assert.deepEqual(j11.layers, ["top", "bottom"]); assert.equal(j11.net, "+12V"); assert.equal(j11.plated, true);
  near(u1.x, 20 - 2.7); near(u1.y, 15 + 1.905); assert.deepEqual(u1.layers, ["top"]); assert.equal(u1.name, "VIN");
  assert.deepEqual(place([1, 2], { at: [10, 10], rot: 90 }), [8, 11]); assert.deepEqual(place([1, 2], { at: [10, 10], rot: 0, side: "bottom" }), [9, 12]);
  assert.equal(R.pads.filter((p) => p.net === null).map((p) => p.pin).join(), "U1.3,U1.6,U1.7");          // not connected : NC, NC2, PG
  b.parts.push({ ref: "X1", comp: "ABSENT" }); b.nets[0].pins.push("Z9.1");
  assert.equal(resolveBoard(b, LIB).problems.length, 2);
});

test("model: net rules widen with current and voltage ; outline, layers, bill of materials", () => {
  const b = smallBoard();
  near(trackForCurrent(2), 0.78, 0.011);                        // IPC-2221, 2 A, 35 µm, 10 K, outer layer
  assert.ok(trackForCurrent(2, 35, 10, true) > 2 * trackForCurrent(2));
  assert.equal(netRules(b, { class: "signal" }).track, 0.25);
  assert.equal(netRules(b, { class: "power", current: 3 }).track, trackForCurrent(3));
  assert.equal(netRules(b, { class: "hv", voltage: 400 }).clearance, 2.5);                               // IPC-2221B B2, bare board
  b.board.coating.type = "AR"; assert.equal(netRules(b, { class: "hv", voltage: 400 }).clearance, 0.8);    // A5, conformal coating
  assert.deepEqual(copperLayers(4), ["top", "in1", "in2", "bottom"]);
  assert.equal(outlineOf({ size: [40, 30], r: 0 }).length, 4); assert.equal(outlineOf({ size: [40, 30], r: 2 }).length, 36);
  near(polyArea(outlineOf({ size: [40, 30], r: 2 })), 40 * 30 - (4 - Math.PI) * 4, 0.1);       // eight chords per corner
  const bom = boardBom(b, LIB);
  assert.equal(bom.length, 6); assert.deepEqual(bom.find((l) => l.comp === "HDR2").refs, ["J1", "J2"]); assert.equal(bom.find((l) => l.comp === "HDR2").tht, true);
  assert.equal(nextRef(b, "C"), "C3"); assert.equal(nextRef(b, "Q"), "Q1");
});

test("geometry: clear distances between tracks, pads and vias ; board edge", () => {
  near(segSeg([0, 0], [10, 0], [5, 3], [5, 8]), 3); assert.equal(segSeg([0, 0], [10, 0], [5, -1], [5, 1]), 0);
  const pad = padShape({ x: 0, y: 0, w: 2, h: 1, shape: "rect" }), via = discShape(3, 0, 0.6), track = { a: [-5, 2], b: [5, 2], r: 0.125 };
  near(gap(pad, via), 3 - 1 - 0.3); near(gap(pad, track), 2 - 0.5 - 0.125); near(gap(via, track), 2 - 0.3 - 0.125);
  near(gap(padShape({ x: 0, y: 0, w: 3, h: 1, shape: "oval" }), discShape(0, 2, 1)), 2 - 0.5 - 0.5);
  assert.ok(gap(pad, { a: [0, 0], b: [4, 0], r: 0.1 }) <= 0);
  const o = outlineOf({ size: [40, 30] });
  assert.ok(inPoly([1, 1], o) && !inPoly([41, 1], o)); near(edgeGap(discShape(1, 15, 1), o), 0.5); assert.ok(edgeGap(discShape(0.2, 15, 1), o) < 0);
});

test("connectivity: nothing routed, then tracks, a via and a plane join the pads", () => {
  const b = smallBoard();
  let R = resolveBoard(b, LIB), c = connectivity(R);
  assert.equal(c.complete, false); assert.equal(c.open, 3 + 4 + 5 + 1);
  assert.equal(ratsnest(R, c).length, c.open);
  const at = (pin) => { const p = R.pads.find((x) => x.pin === pin); return [p.x, p.y]; };
  b.tracks.push({ net: "LED_A", layer: "top", w: 0.25, pts: [at("R1.2"), at("D1.2")] });
  c = connectivity(resolveBoard(b, LIB)); assert.equal(c.nets.find((n) => n.name === "LED_A").open, 0);
  b.tracks.push({ net: "LED_A", layer: "bottom", w: 0.25, pts: [[1, 1], [2, 1]] });                    // copper on another layer joins nothing
  assert.equal(connectivity(resolveBoard(b, LIB)).open, 3 + 4 + 5);
  const g = at("C2.2"); b.vias.push({ net: "GND", at: [g[0], g[1] - 1.2], d: 0.8, drill: 0.4 }); b.tracks.push({ net: "GND", layer: "top", w: 0.5, pts: [g, [g[0], g[1] - 1.2]] });
  b.planes.push({ net: "GND", layer: "bottom" });                // through-hole pads and the via reach the plane
  c = connectivity(resolveBoard(b, LIB));
  assert.deepEqual(c.nets.find((n) => n.name === "GND").groups.map((x) => x.length).sort(), [1, 1, 1, 3]);   // J1.2, J2.2 and C2.2 joined ; U1.4, C1.2, D1.K still open
  R = resolveBoard(b, LIB); assert.equal(ratsnest(R).filter((l) => l.net === "GND").length, 3);
});
