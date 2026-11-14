/* PCBA: conceptual layout (zones), detailed placement, automatic routing on two and four layers. */
import test from "node:test";
import assert from "node:assert/strict";
import { floorplan, zoneProblems, placeParts, placementProblems } from "../../web/js/pcba/place.js";
import { autoroute, clearRoutes, routeStats } from "../../web/js/pcba/route.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { connectivity } from "../../web/js/pcba/connect.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { LIB, smallBoard, controlBoard, clearanceViolations } from "./pcba_fixture.mjs";

test("small board: zones are legal, parts are placed around the imposed connectors, routing completes without a clearance fault", () => {
  const b = smallBoard();
  for (const p of b.parts) if (!p.fixed) delete p.at;
  for (const k of b.blocks) delete k.zone;
  assert.equal(zoneProblems(b, LIB).length, 3, "no zone yet");
  const f = floorplan(b, LIB);
  assert.equal(f.zones.length, 3); assert.deepEqual(zoneProblems(b, LIB), []);
  const z = Object.fromEntries(b.blocks.map((k) => [k.id, k.zone]));
  assert.ok(z.B1[0] < z.B2[0] && z.B2[0] < z.B3[0], "the blocks follow the imposed connectors : input on the left, output on the right");
  const p = placeParts(b, LIB);
  assert.deepEqual(p.failed, []); assert.equal(p.placed, 5); assert.deepEqual(placementProblems(b, LIB), []);
  assert.deepEqual(b.parts.find((x) => x.ref === "J1").at, [5, 15]); assert.ok(p.wirelength > 0);
  const r = autoroute(b, LIB);
  assert.equal(r.complete, true); assert.equal(r.routed, 13); assert.equal(connectivity(resolveBoard(b, LIB)).complete, true);
  assert.deepEqual(clearanceViolations(b, LIB), []);
  const R = resolveBoard(b, LIB);
  assert.ok(b.tracks.every((t) => t.auto && t.pts.length >= 2 && t.w >= R.fab.track));
  assert.ok(R.tracks.filter((t) => t.net === "+12V").some((t) => t.w >= 0.5), "the supply runs at the width of its class where the pads allow");
  const st = routeStats(b, LIB);
  assert.equal(st.open, 0); assert.ok(Math.abs(st.length - r.length) < 1e-6); assert.ok(st.byNet.length >= 4);
});

test("routing: locked copper is kept, a plane replaces the tracks of its net, four layers route too", () => {
  const b = smallBoard(), at = (pin) => { const p = resolveBoard(b, LIB).pads.find((x) => x.pin === pin); return [p.x, p.y]; };
  b.tracks.push({ net: "LED_A", layer: "top", w: 0.25, pts: [at("R1.2"), at("D1.2")], locked: true });
  let r = autoroute(b, LIB);
  assert.equal(r.complete, true); assert.ok(b.tracks.some((t) => t.locked && !t.auto)); assert.equal(r.total, 12, "the locked track already made one connection");
  r = autoroute(b, LIB); assert.equal(r.complete, true, "routing again starts from the kept copper"); assert.deepEqual(clearanceViolations(b, LIB), []);
  b.planes = [{ net: "GND", layer: "bottom" }];
  r = autoroute(b, LIB);
  assert.equal(r.complete, true); assert.ok(b.vias.filter((v) => v.net === "GND").length >= 3, "surface-mount ground pads drop a via into the plane");
  assert.ok(!b.tracks.some((t) => t.layer === "bottom"), "nothing is routed on the plane layer"); assert.deepEqual(clearanceViolations(b, LIB), []);
  clearRoutes(b); assert.ok(b.tracks.length === 1 && b.vias.length === 0); clearRoutes(b, { all: true }); assert.equal(b.tracks.length, 1, "locked copper survives even a full clear");
  const c = smallBoard(); c.board.layers = 4; c.planes = [{ net: "GND", layer: "in1" }, { net: "+5V", layer: "in2" }];
  r = autoroute(c, LIB); assert.equal(r.complete, true); assert.deepEqual(clearanceViolations(c, LIB), []);
  assert.ok(c.tracks.every((t) => t.layer === "top" || t.layer === "bottom"));
});

test("control board (57 parts, 60 × 90 mm): floor plan, placement and routing on four layers", () => {
  const b = controlBoard([60, 90], 4), t0 = Date.now();
  const f = floorplan(b, LIBRARY); assert.deepEqual(zoneProblems(b, LIBRARY), []); assert.ok(f.fill > 3);
  const p = placeParts(b, LIBRARY); assert.deepEqual(p.failed, []); assert.deepEqual(placementProblems(b, LIBRARY), []);
  const power = b.parts.find((x) => x.local === "J" && x.block === "B1"); assert.ok(power.at[1] < 5 || power.at[0] < 5 || power.at[0] > 55 || power.at[1] > 85, "the supply terminal sits on the board edge");
  const cap = b.parts.find((x) => x.block === "B5" && x.pin === "24"), R0 = resolveBoard(b, LIBRARY), pin = R0.pads.find((x) => x.pin === "U3.24");
  assert.ok(Math.hypot(cap.at[0] - pin.x, cap.at[1] - pin.y) < 6, "a decoupling capacitor stays next to the supply pin it serves");
  const r = autoroute(b, LIBRARY, { maxMs: 40000 }), ms = Date.now() - t0;
  console.log(`  control board, 4 layers: ${r.routed}/${r.total} connections, ${Math.round(r.length)} mm, ${r.vias} vias, ${ms} ms`);
  assert.ok(r.routed / r.total >= 0.95, `${r.routed}/${r.total}`); assert.deepEqual(clearanceViolations(b, LIBRARY), []); assert.ok(ms < 60000);
  assert.ok(!b.tracks.some((t) => t.layer === "in1" || t.layer === "in2"));
});
