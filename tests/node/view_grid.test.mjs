// The triad of a 3D view and the grid behind the part, and the size of what is shown.
// Run from the repository root:  node --test tests/node/view_grid.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AXES, triadOf, gridStep, gridOf, gridKey } from "../../web/js/core/view_grid.js";
import { SCALES, scaleOf, ICON_SCALES, ICON_DEFAULT, iconScaleOf } from "../../web/js/core/theme.js";

test("the triad : X, Y and Z as the camera sees them, the nearest drawn last", () => {
  // seen from above (the eye on +Z, X to the right, Y up the screen)
  const top = triadOf([1, 0, 0], [0, 1, 0], [0, 0, 1]), by = Object.fromEntries(top.map((a) => [a.key, a]));
  assert.deepEqual([by.X.x, by.X.y], [1, -0]); assert.deepEqual([by.Y.x, by.Y.y], [0, -1], "up the screen is a negative y"); assert.deepEqual([by.Z.x, by.Z.y, by.Z.depth], [0, -0, 1], "Z comes straight at the eye");
  assert.equal(top[top.length - 1].key, "Z", "the axis that comes toward the eye is drawn last, on top"); assert.deepEqual(AXES.map((a) => a.key), ["X", "Y", "Z"]); assert.equal(new Set(AXES.map((a) => a.color)).size, 3);
  // seen from the front (the eye on −Y) : Y goes away
  const front = triadOf([1, 0, 0], [0, 0, 1], [0, -1, 0]); assert.equal(front[0].key, "Y"); assert.ok(front[0].depth < 0); for (const a of front) assert.ok(Math.hypot(a.x, a.y) <= 1 + 1e-9);
});

test("the grid : a round step, on the three faces of the box away from the eye", () => {
  assert.deepEqual([gridStep([8, 4, 2]), gridStep([100, 60, 25]), gridStep([113, 91, 30]), gridStep([400, 300, 50]), gridStep([2500, 10, 10]), gridStep([0, 0, 0])], [0.5, 5, 10, 20, 200, 0.5]);
  const box = [0, 0, 0, 100, 60, 25], g = gridOf(box, [0.6, 0.7, 0.4]);
  assert.equal(g.step, 5); assert.deepEqual(g.min, [-5, -5, -5]); assert.deepEqual(g.max, [105, 65, 30], "one step of margin, on multiples of the step");
  assert.deepEqual(g.planes, [{ axis: 0, at: -5 }, { axis: 1, at: -5 }, { axis: 2, at: -5 }], "the eye is on the + side of each axis : the grid is on the − faces, behind the part");
  assert.deepEqual(gridOf(box, [-0.6, 0.7, -0.4]).planes.map((p) => p.at), [105, -5, 30]);
  assert.equal(g.minor.length % 6, 0); assert.equal(g.heavy.length % 6, 0); assert.ok(g.heavy.length > 0 && g.minor.length > g.heavy.length, "a heavier line every five steps");
  for (const arr of [g.minor, g.heavy]) for (let i = 0; i < arr.length; i += 6) { const p = [...arr.slice(i, i + 3)], q = [...arr.slice(i + 3, i + 6)], same = [0, 1, 2].filter((k) => p[k] === q[k]);
    assert.equal(same.length, 2, "a line runs along one axis"); assert.ok(g.planes.some((pl) => p[pl.axis] === pl.at && q[pl.axis] === pl.at), "and lies in one of the three back faces"); for (let k = 0; k < 3; k++) assert.ok(p[k] >= g.min[k] && q[k] <= g.max[k]); }
  for (let i = 0; i < g.heavy.length; i += 6) { const p = [...g.heavy.slice(i, i + 3)], q = [...g.heavy.slice(i + 3, i + 6)], pl = g.planes.find((x) => p[x.axis] === x.at && q[x.axis] === x.at), run = [0, 1, 2].find((k) => p[k] !== q[k]), u = [0, 1, 2].find((k) => k !== pl.axis && k !== run); assert.equal(Math.abs(p[u] / g.step) % 5, 0, "heavy lines are on every fifth step"); }
  assert.equal(gridKey(box, [0.6, 0.7, 0.4]), gridKey(box, [0.1, 0.9, 0.2]), "the view turns on the same side : the grid stays"); assert.notEqual(gridKey(box, [0.6, 0.7, 0.4]), gridKey(box, [-0.6, 0.7, 0.4])); assert.notEqual(gridKey(box, [1, 1, 1]), gridKey([0, 0, 0, 101, 60, 25], [1, 1, 1]));
});

test("the size of what is shown : five steps, kept by the browser, applied before the first paint", () => {
  assert.deepEqual(SCALES.map(([k]) => k), [90, 100, 115, 130, 150]); assert.deepEqual([scaleOf("130"), scaleOf(115), scaleOf("nope"), scaleOf(999), scaleOf(null)], [130, 115, 100, 100, 100]);
  const boot = readFileSync(new URL("../../web/js/boot.js", import.meta.url), "utf8"), css = readFileSync(new URL("../../web/css/app.css", import.meta.url), "utf8");
  assert.match(boot, /localStorage\.getItem\("dw\.scale"\)/); assert.match(boot, /\[90, 100, 115, 130, 150\]/, "the same five steps before the first paint"); assert.match(boot, /setProperty\("--ui-scale"/);
  assert.deepEqual(ICON_SCALES.map(([k]) => k), [100, 125, 150, 175]); assert.equal(ICON_DEFAULT, 125);
  assert.deepEqual([iconScaleOf("150"), iconScaleOf(100), iconScaleOf("x"), iconScaleOf(999)], [150, 100, 125, 125]);
  assert.match(boot, /localStorage\.getItem\("dw\.iconScale"\)/); assert.match(boot, /\[100, 125, 150, 175\]/, "the same four ratios before the first paint"); assert.match(boot, /setProperty\("--icon-scale"/);
  const nav = readFileSync(new URL("../../web/css/nav.css", import.meta.url), "utf8");
  assert.match(nav, /:is\(\.topbar, #levels, \.side-head, \.page-head > \.stair-btn\) \.sk-icon[^{]*\{ width: calc\(var\(--ib, 20px\) \* var\(--icon-scale, 1\.25\)\)/, "the top bar, the levels and the heads of both panes follow the ratio");
  assert.match(css, /html \{[^}]*font-size: calc\(100% \* var\(--ui-scale, 1\)\)/); assert.match(css, /--topbar-h: calc\(56px \* var\(--ui-scale, 1\)\)/); assert.ok(!/body \{[^}]*font-size: \d+px/.test(css), "the text of the page is in rem : it follows the size");
});
