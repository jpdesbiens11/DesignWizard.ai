/* PCBA : any even copper count, 2 to 12 (demande de JP, 25 novembre 2026 : « être capable de gérer le nombre de couches requis, quitte à mettre
   à jour la plateforme »). node --test tests/node/pcba_layers.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copperLayers, layerCount, LAYER_COUNTS, LAYER_FR, defaultPlanes, resolveBoard } from "../../web/js/pcba/model.js";
import { LAYER_NAMES, layerArt } from "../../web/js/pcba/art.js";
import { fabPackage, stackup } from "../../web/js/pcba/fabfiles.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { connectivity } from "../../web/js/pcba/connect.js";
import { LIB, smallBoard } from "./pcba_fixture.mjs";

test("the counts : even, 2 to 12, top · in1 … · bottom, each with its name", () => {
  assert.deepEqual(LAYER_COUNTS, [2, 4, 6, 8, 10, 12]);
  assert.deepEqual(copperLayers(2), ["top", "bottom"]); assert.deepEqual(copperLayers(4), ["top", "in1", "in2", "bottom"]);
  assert.deepEqual(copperLayers(6), ["top", "in1", "in2", "in3", "in4", "bottom"]); assert.equal(copperLayers(12).length, 12);
  assert.equal(layerCount(5), 6, "an odd count goes up to the next even one"); assert.equal(layerCount(20), 12); assert.equal(layerCount(undefined), 2);
  for (const k of copperLayers(12)) { assert.ok(LAYER_FR[k], k); assert.ok(LAYER_NAMES[k], k); }
});

test("a 6-layer board : routed on its layers, its stack-up adds up to its thickness, one Gerber per copper layer", () => {
  const b = smallBoard(); b.board.layers = 6; b.planes = defaultPlanes(b, 6);
  assert.deepEqual(b.planes.map((p) => p.layer), ["in1", "in4"], "the ground under the top, the rail over the bottom, two inner layers for signals");
  autoroute(b, LIB); const R = resolveBoard(b, LIB); assert.equal(R.layers.length, 6); assert.equal(connectivity(R).open, 0, "everything routed");
  assert.ok(Object.keys(layerArt(R, b).layers).includes("in4"));
  const S = stackup(b), cu = S.filter((r) => /^L\d/.test(r.layer)), core = S.filter((r) => !/^Vernis/.test(r.layer)).reduce((a, r) => a + r.thickness, 0);
  assert.equal(cu.length, 6); assert.ok(Math.abs(core - 1.6) < 0.01, `${core} mm`);
  const files = fabPackage(b, LIB).files.filter((f) => f.mime === "application/vnd.gerber").map((f) => f.name);
  for (const ext of [".GTL", ".G1", ".G2", ".G3", ".G4", ".GBL"]) assert.ok(files.some((n) => n.endsWith(ext)), ext);
  assert.ok(!files.some((n) => n.endsWith(".G5")), "no file for a layer the board does not have");
  const g = fabPackage(b, LIB).files.find((f) => f.name.endsWith(".G4")).text; assert.match(g, /Copper,L5,Inr/); assert.match(fabPackage(b, LIB).files.find((f) => f.name.endsWith(".GBL")).text, /Copper,L6,Bot/);
});

test("the screen offers every count, and the view has a colour for every inner layer", () => {
  const steps = readFileSync(new URL("../../web/js/modules/pcba_steps.js", import.meta.url), "utf8"), view = readFileSync(new URL("../../web/js/modules/pcba_view.js", import.meta.url), "utf8");
  assert.match(steps, /LAYER_COUNTS\.map/); assert.match(steps, /defaultPlanes\(x, \+v\)/); assert.doesNotMatch(view, /"in1", "in2"\]/);
});
