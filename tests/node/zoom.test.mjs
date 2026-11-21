/* The centre of a page zooms and the magnifier follows the pointer : the pure halves of core/zoom_pane.js and core/loupe.js, and
   what wires them to the application. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ZOOM, clampZoom, zoomStep, zoomWheel, pointIn, scrollBack, zoomText } from "../../web/js/core/zoom_pane.js";
import { LOUPE, loupeFactor, factorText, readLoupe, writeLoupe, lensOffset, lensSource, isArtefact } from "../../web/js/core/loupe.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("zoom : the buttons go from step to step, from any zoom, and stop at the ends", () => {
  assert.equal(zoomStep(1, 1), 1.25); assert.equal(zoomStep(1, -1), 0.8);
  assert.equal(zoomStep(1.1, 1), 1.25, "between two steps : the next one up");
  assert.equal(zoomStep(1.1, -1), 1, "and the next one down");
  assert.equal(zoomStep(ZOOM.max, 1), ZOOM.max); assert.equal(zoomStep(ZOOM.min, -1), ZOOM.min);
  let z = ZOOM.min, n = 0; while (z < ZOOM.max && n < 50) { z = zoomStep(z, 1); n++; } assert.equal(n, ZOOM.steps.length - 1, "every step is reached, once");
  assert.equal(clampZoom(100), ZOOM.max); assert.equal(clampZoom(0.01), ZOOM.min); assert.equal(clampZoom(NaN), 1);
});

test("zoom : the wheel zooms by the same ratio for the same move, both ways, within the limits", () => {
  const up = zoomWheel(1, -120), down = zoomWheel(1, 120);
  assert.ok(up > 1 && down < 1); near(up * down, 1, 1e-9);
  near(zoomWheel(up, 120), 1, 1e-9);
  assert.equal(zoomWheel(ZOOM.max, -120), ZOOM.max); assert.equal(zoomWheel(ZOOM.min, 120), ZOOM.min);
  assert.equal(zoomWheel(1, -5000), zoomWheel(1, -240), "one move of the wheel never jumps");
  assert.equal(zoomText(1), "100 %"); assert.equal(zoomText(1.25), "125 %"); assert.equal(zoomText(0.666), "67 %");
});

test("zoom : the point of the sheet under the pointer comes back under it once the sheet has grown", () => {
  const at = { x: 700, y: 500 }, before = { left: 300, top: 120, width: 1000, height: 650 }, p = pointIn(before, at);
  near(p.u, 0.4); near(p.v, 380 / 650);
  /* the sheet twice as large, still at the same place : the page must scroll by what the point moved */
  const after = { left: 300, top: 120, width: 2000, height: 1300 }, d = scrollBack(after, p, at);
  near(d.dx, 400); near(d.dy, 380);
  /* scrolled by that much, the sheet is there : */
  const moved = { ...after, left: after.left - d.dx, top: after.top - d.dy }, q = pointIn(moved, at);
  near(q.u, p.u); near(q.v, p.v);
  assert.deepEqual(scrollBack(before, p, at), { dx: 0, dy: 0 }, "a sheet that did not change asks for no move");
  assert.deepEqual(pointIn({ left: 0, top: 0, width: 0, height: 0 }, at), { u: 0, v: 0 });
});

test("magnifier : its factor stays within its slider, by its steps, and is kept", () => {
  assert.equal(loupeFactor(3), 3); assert.equal(loupeFactor(3.2), 3); assert.equal(loupeFactor(3.3), 3.5);
  assert.equal(loupeFactor(100), LOUPE.max); assert.equal(loupeFactor(0), LOUPE.min); assert.equal(loupeFactor(undefined), LOUPE.base); assert.equal(loupeFactor("x"), LOUPE.base);
  assert.equal(factorText(2.5), "× 2,5"); assert.equal(factorText(6), "× 6");
  const m = new Map(), store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  assert.deepEqual(readLoupe(store), { k: LOUPE.base });
  assert.ok(writeLoupe(store, { on: true, k: 6 })); assert.deepEqual(readLoupe(store), { k: 6 }, "the factor is kept ; the magnifier itself starts put away");
  m.set("dw.loupe", "not json"); assert.deepEqual(readLoupe(store), { k: LOUPE.base });
  assert.equal(writeLoupe({ setItem() { throw new Error("private"); } }, { k: 2 }), false);
});

test("magnifier : the point under the pointer sits at the centre of the lens", () => {
  const rect = { left: 200, top: 100, width: 800, height: 500 }, at = { x: 500, y: 300 }, S = 240, k = 4;
  const o = lensOffset(rect, at, S, k);
  /* the copy is scaled k times from its corner : the point (300, 200) of the artefact lands at o + k × (300, 200) */
  near(o.left + k * (at.x - rect.left), S / 2); near(o.top + k * (at.y - rect.top), S / 2);
  /* a painted view of 1600 × 1000 pixels shown in 800 × 500 : the lens reads a square of S / k on the page, twice that in pixels */
  const q = lensSource(rect, at, S, k, [1600, 1000]);
  near(q.sw, 120); near(q.sh, 120); near(q.sx + q.sw / 2, 600); near(q.sy + q.sh / 2, 400);
  assert.ok(lensSource(rect, { x: 201, y: 101 }, S, k, [1600, 1000]).sx < 0, "at the edge the lens reaches outside : blank there");
});

test("magnifier : an icon is not an artefact", () => {
  assert.equal(isArtefact(20, 20), false); assert.equal(isArtefact(96, 51), false);
  assert.equal(isArtefact(400, 300), true); assert.equal(isArtefact(LOUPE.least[0], LOUPE.least[1]), true);
});

test("wiring : the drawings zoom, the magnifier is beside the zoom of each view — not in the top bar —, the styles are there", () => {
  const app = read("web/js/core/app.js"), css = read("web/css/app.css"), drawings = read("web/js/modules/drawings.js");
  assert.match(drawings, /zoomPane\(center\)/, "the centre of the drawing screen zooms");
  assert.doesNotMatch(app, /loupeButton/, "demande de JP : « enlever la loupe du menu du haut, ça n'a pas d'affaire là »");
  assert.match(app, /newsButton\(\), guideButton\(\)/); assert.match(app, /installLoupe\(\);/, "the lens itself is installed once");
  assert.match(read("web/js/core/view_bar.js"), /loupeButton\(\{ compact: true \}\)/, "the bar of a view carries it");
  assert.match(read("web/js/core/viewport.js"), /loupeButton\(\)\);/, "a 3D view carries it in its toolbar");
  assert.match(css, /\.zoom-host \.sheet-view \{ width: calc\(var\(--zoom, 1\) \* 100%\); max-width: none;/);
  assert.match(css, /\.loupe \{ position: fixed;[^}]*pointer-events: none;/, "the pointer works through the lens");
  assert.match(read("web/js/modules/help.js"), /Ctrl \+ molette sur un dessin/);
});
