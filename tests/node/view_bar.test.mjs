/* The bar of a view and the panel at the bottom of a centre (demande de JP : « redimensionner le panneau de mesure du bas central… la vue
   des blocs aussi, pan, zoom, ajuster à la fenêtre, loupe ») : the pure halves of core/view_bar.js and core/panes.js, and the wiring of
   every view that zooms. The gestures themselves were tried in Chromium. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitView, zoomView } from "../../web/js/core/view_bar.js";
import { BOTTOM, clampBottom, readBottom, writeBottom } from "../../web/js/core/panes.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≈ ${b}`);

test("fit : the whole page is in the window, centred, never blown up past its ceiling", () => {
  const box = { w: 1200, h: 600 }, W = 800, H = 500, v = fitView(W, H, box, 24);
  near(v.z, (800 - 48) / 1200);                                    // the width decides
  near(v.x + (W / v.z) / 2, box.w / 2); near(v.y + (H / v.z) / 2, box.h / 2);   // centred both ways
  near(-v.x * v.z, 24, 1e-9);                                       // 24 px of margin on the side that decides
  assert.equal(fitView(4000, 3000, { w: 400, h: 300 }).z, 1.4, "a few tiles are not blown up");
  assert.equal(fitView(100, 100, { w: 1e6, h: 1e6 }).z, 0.15, "nor shrunk to nothing");
});

test("zoom : the point under the pointer stays under it ; the zoom keeps within its limits", () => {
  const v = { x: 40, y: -20, z: 0.8 }, ax = 300, ay = 120, before = [v.x + ax / v.z, v.y + ay / v.z];
  const w = zoomView(v, 1.25, ax, ay);
  near(w.z, 1); near(w.x + ax / w.z, before[0]); near(w.y + ay / w.z, before[1]);
  assert.equal(zoomView({ x: 0, y: 0, z: 3.9 }, 2, 0, 0).z, 4); assert.equal(zoomView({ x: 0, y: 0, z: 0.2 }, 0.1, 0, 0).z, 0.15);
  const back = zoomView(w, 1 / w.z, ax, ay); near(back.z, 1, 1e-12);        // « 100 % » : true size
});

test("bottom panel : a height is clamped, leaves room to the view above, and is kept per screen", () => {
  assert.equal(clampBottom(30), BOTTOM.min); assert.equal(clampBottom(undefined), BOTTOM.start); assert.equal(clampBottom(-5), BOTTOM.start);
  assert.equal(clampBottom(900, 700), 700 - BOTTOM.view, "the view above keeps its share");
  assert.equal(clampBottom(900, 100), BOTTOM.min, "a tiny centre still shows the panel at its smallest");
  assert.deepEqual(readBottom("", "sw"), { h: BOTTOM.start, off: false });
  assert.deepEqual(readBottom("not json", "sw"), { h: BOTTOM.start, off: false });
  const t = writeBottom(writeBottom("", "sw", { h: 340, off: false }), "lab", { h: 200, off: true });
  assert.deepEqual(readBottom(t, "sw"), { h: 340, off: false }); assert.deepEqual(readBottom(t, "lab"), { h: 200, off: true });
  assert.deepEqual(readBottom("[1,2]", "sw"), { h: BOTTOM.start, off: false });
});

test("wiring : one bar for every view that zooms, the magnifier in it, the bottom panels mounted once", () => {
  const bar = read("web/js/core/view_bar.js");
  for (const d of ["data-view-out", "data-view-pct", "data-view-in", "data-view-fit"]) assert.ok(bar.includes(`"${d}"`), d);
  for (const f of ["web/js/core/zoom_pane.js", "web/js/modules/pcba_view.js", "web/js/modules/elab_view.js", "web/js/modules/sw_canvas.js"]) assert.match(read(f), /viewBar\(\{ label: /, `${f} uses the common bar`);
  const sw = read("web/js/modules/sw_canvas.js");
  assert.match(sw, /addEventListener\("wheel"/, "the tiles zoom at the wheel"); assert.match(sw, /fitView\(W, H, cb/, "and fit the window");
  assert.match(sw, /new ResizeObserver/, "a resize refits while the view was not moved");
  const app = read("web/js/core/app.js");
  assert.match(app, /querySelectorAll\("\.bottom-pane"\)\.forEach\(\(b\) => mountBottom\(b\)\)/, "every bottom panel gets its edge, whatever the screen");
  assert.match(read("web/js/modules/sw.js"), /class: "sw-livebox swlab bottom-pane", "data-bottom": "sw"/);
  assert.match(read("web/js/modules/elab.js"), /class: "lab-bottom bottom-pane", "data-bottom": "lab"/);
  const css = read("web/css/views.css");
  assert.match(css, /\.bottom-pane \.bottom-body \{ height: var\(--bottom-h, 240px\);/); assert.match(css, /\.bottom-pane\.folded \.bottom-body \{ display: none; \}/);
  assert.match(read("web/index.html"), /href="css\/views\.css"/);
});
