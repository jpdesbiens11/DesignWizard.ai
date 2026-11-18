/* Turning a 3D view : three axes about the point that was grabbed and nothing blocked, the cue that shows it, the automatic
   rotation — the pure half of core/view_orbit.js, and its wiring in the viewer. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { turned, orbitAbout, yawOf, horizonOf, ringOf, ringPoint, tiltPoint, rollPoint, arcOf, cometOf, autoToggled, autoText, holdProgress, orbitText, autoSpeed, ORBIT, AUTO_SPEEDS } from "../../web/js/core/view_orbit.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
/* a camera that looks at its target from `dir`, level : its up is square to the line of sight, in the vertical plane */
const level = (target, d) => { const dir = unit(d), right = unit(cross([0, 0, 1], dir)); return { target, dir, up: cross(dir, right) }; };
const top = (target = [0, 0, 0]) => ({ target, dir: [0, 0, 1], up: [0, 1, 0] });      // the view from the top, as the « Dessus » button leaves it
/* where a point is on the screen of a camera : along its right and its up, from its target */
const onScreen = (cam, p) => { const right = cross(cam.up, cam.dir), d = [p[0] - cam.target[0], p[1] - cam.target[1], p[2] - cam.target[2]]; return [dot(d, right), dot(d, cam.up)]; };
const square = (cam) => { near(Math.hypot(...cam.dir), 1, 1e-9); near(Math.hypot(...cam.up), 1, 1e-9); near(dot(cam.dir, cam.up), 0, 1e-9); };
const iso = () => level([10, 20, 5], [1, -1, 0.8]);

test("orbit : a vector turned about an axis", () => {
  const v = turned([1, 0, 0], [0, 0, 1], Math.PI / 2); near(v[0], 0, 1e-12); near(v[1], 1, 1e-12); near(v[2], 0, 1e-12);
  assert.deepEqual(turned([0, 0, 2], [0, 0, 1], 1.3).map((x) => +x.toFixed(9)), [0, 0, 2], "what lies on the axis does not move");
});

test("orbit : the point that was grabbed keeps its place on the screen, whatever the turn", () => {
  const pivot = [60, -15, 22];
  for (const [yaw, rise, roll] of [[0.4, 0, 0], [0, 0.25, 0], [-0.9, -0.3, 0], [2.5, 0.1, 0], [0, 0, 0.7], [0.3, 1.9, -0.4]]) {
    const cam = iso(), before = onScreen(cam, pivot), next = orbitAbout(cam, pivot, yaw, rise, roll), after = onScreen(next, pivot);
    near(after[0], before[0], 1e-9); near(after[1], before[1], 1e-9); square(next);
  }
  const cam = iso(), other = [0, 0, 0], a = onScreen(cam, other), b = onScreen(orbitAbout(cam, pivot, 0.4, 0), other); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1, "another point does move : the view really turned");
});

test("orbit : about the centre of the view, the centre stays the centre ; the eye rises when asked", () => {
  const cam = iso(), next = orbitAbout(cam, cam.target, 0.3, 0.2);
  assert.deepEqual(next.target.map((x) => +x.toFixed(9)), cam.target);
  assert.ok(orbitAbout(cam, cam.target, 0, 0.2).dir[2] > cam.dir[2], "a positive rise : the eye goes up"); near(orbitAbout(cam, cam.target, 0.3, 0).dir[2], cam.dir[2], 1e-12);
});

test("orbit : nothing is blocked — from the top the turn about Z spins the picture, and the tilt goes on over the top", () => {
  /* from the top view, left / right : the line of sight does not change, the picture turns in its plane */
  const t = top(), spun = orbitAbout(t, [0, 0, 0], 0.5, 0); square(spun);
  near(spun.dir[2], 1, 1e-12); assert.ok(Math.abs(spun.up[0]) > 0.4, "the up of the screen turned : the picture spun");
  const p = [30, 0, 0], a = onScreen(t, p), b = onScreen(spun, p); near(Math.hypot(...a), Math.hypot(...b), 1e-9); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 5, "a point off the pivot swings round it");
  /* from the top view, up / down both tilt : neither way is refused */
  assert.ok(orbitAbout(t, [0, 0, 0], 0, 0.3).dir[2] < 1 - 1e-3); assert.ok(orbitAbout(t, [0, 0, 0], 0, -0.3).dir[2] < 1 - 1e-3);
  /* the eye rises past straight above without a stop : the view goes on, upside down, in one smooth move */
  let cam = level([0, 0, 0], [1, 0, 2]); const steps = [];
  for (let i = 0; i < 12; i++) { const next = orbitAbout(cam, [0, 0, 0], 0, 0.15); steps.push(dot(next.dir, cam.dir)); cam = next; square(cam); }
  assert.ok(steps.every((c) => Math.abs(c - Math.cos(0.15)) < 1e-9), "every step turns by what was asked, before, at and after the top");
  assert.ok(cam.up[2] < 0 && cam.dir[0] < 0, "after the top the eye is on the other side, the view upside down");
});

test("orbit : Alt rolls the picture about the line of sight ; upside down the model still follows the hand", () => {
  const cam = iso(), rolled = orbitAbout(cam, cam.target, 0, 0, 0.6); square(rolled);
  assert.deepEqual(rolled.dir.map((x) => +x.toFixed(9)), cam.dir.map((x) => +x.toFixed(9)), "the line of sight is kept"); near(dot(rolled.up, cam.up), Math.cos(0.6), 1e-9);
  assert.equal(yawOf(0.2, 0.7), -0.2); assert.equal(yawOf(0.2, -0.7), 0.2, "upside down the same turn would show the other way round : it is reversed"); assert.equal(yawOf(0.2, 0), -0.2);
  /* what is near the eye goes to the right on the screen when the hand goes right — level, and upside down */
  for (const c of [level([0, 0, 0], [0, -1, 0.5]), orbitAbout(level([0, 0, 0], [0, -1, 0.5]), [0, 0, 0], 0, 2.2)]) {
    const nearPoint = [c.dir[0] * 10, c.dir[1] * 10, 0], x0 = onScreen(c, nearPoint)[0], x1 = onScreen(orbitAbout(c, [0, 0, 0], yawOf(0.2, c.up[2]), 0), nearPoint)[0];
    assert.ok(x1 > x0 + 0.5, `near goes right (up.z ${c.up[2].toFixed(2)})`);
  }
});

test("cue : the Z axis lies on the screen as the model does ; the ring flattens as the eye comes level", () => {
  const c = iso(), right = cross(c.up, c.dir); near(horizonOf(right, c.up), 0, 1e-9);
  const over = orbitAbout(level([0, 0, 0], [0, -1, 0.5]), [0, 0, 0], 0, 2.2); near(Math.abs(horizonOf(cross(over.up, over.dir), over.up)), 180, 1e-6);
  const r = orbitAbout(c, c.target, 0, 0, 0.5); assert.ok(Math.abs(horizonOf(cross(r.up, r.dir), r.up)) > 10, "a rolled view shows its Z axis leaning");
  assert.equal(horizonOf([1, 0, 0], [0, 1, 0]), 0, "straight down : no direction to give, no jump");
  const hi = ringOf(0.9, 40), low = ringOf(0.1, 40), under = ringOf(-0.6, 40);
  assert.equal(hi.rx, 40); near(hi.ry, 36); assert.ok(low.ry >= 40 * 0.16); assert.equal(under.below, true); assert.ok(hi.axis < low.axis);
  assert.deepEqual(ringPoint(hi, 0), [0, 36]); assert.deepEqual(ringPoint(under, 0), [0, -24]); assert.ok(ringPoint(hi, 0.5)[0] > 0 && ringPoint(hi, -0.5)[0] < 0);
  assert.ok(tiltPoint(40, 0.5)[1] > 0 && tiltPoint(40, -0.5)[1] < 0); assert.deepEqual(rollPoint(40, 0), [0, -40]); assert.ok(rollPoint(40, 0.5)[0] > 0, "the roll arc starts at the top and goes clockwise");
});

test("cue : an arc has its arrow head, a turn too small has nothing, a long one stops short of a full ring", () => {
  const g = ringOf(0.7, 40), a = arcOf((p) => ringPoint(g, p), 0.8);
  assert.match(a.d, /^M0\.0 28\.0L/); assert.equal(a.head.split(" ").length, 3);
  assert.ok(+a.head.split(" ")[0].split(",")[0] > ringPoint(g, 0.8)[0], "the head points the way the arc goes");
  assert.ok(+arcOf((p) => ringPoint(g, p), -0.8).head.split(" ")[0].split(",")[0] < ringPoint(g, -0.8)[0]);
  assert.deepEqual(arcOf((p) => ringPoint(g, p), 0.01), { d: "", head: "" }); assert.equal(arcOf((p) => ringPoint(g, p), 50).d, arcOf((p) => ringPoint(g, p), 5.65).d);
});

test("hold : nothing shows at once, then the hold fills until the automatic rotation ; three speeds", () => {
  assert.equal(holdProgress(0), 0); assert.equal(holdProgress(ORBIT.show), 0); assert.equal(holdProgress(ORBIT.hold), 1); near(holdProgress((ORBIT.show + ORBIT.hold) / 2), 0.5); assert.equal(ORBIT.hold, 2000);
  assert.deepEqual(AUTO_SPEEDS.map((s) => s.key), ["slow", "medium", "fast"]); assert.equal(autoSpeed("fast").deg, 72); assert.equal(autoSpeed("nope").key, "slow");
  assert.equal(orbitText(0.6, 0), "Z 34°"); assert.equal(orbitText(-0.6, 0.21, 0.14), "Z 34° · incl. 12° · roulis 8°"); assert.equal(orbitText(0, 0), "");
});

test("automatic rotation : the ways combine — one switch per axis, two or three at once", () => {
  const rest = { x: 0, y: 0, r: 0 };
  assert.deepEqual(autoToggled(rest, "x", 1), { x: 1, y: 0, r: 0 });
  assert.deepEqual(autoToggled({ x: 1, y: 0, r: 0 }, "y", -1), { x: 1, y: -1, r: 0 }, "a second way does not put the first one out : both go");
  assert.deepEqual(autoToggled({ x: 1, y: -1, r: 0 }, "r", 1), { x: 1, y: -1, r: 1 }, "three at once");
  assert.deepEqual(autoToggled({ x: 1, y: -1, r: 0 }, "x", 1), { x: 0, y: -1, r: 0 }, "the same way again : that axis stops, the other goes on");
  assert.deepEqual(autoToggled({ x: 1, y: -1, r: 0 }, "x", -1), { x: -1, y: -1, r: 0 }, "the opposite way of an axis replaces it");
  assert.deepEqual(autoToggled({ x: 1, y: -1, r: 1 }), rest, "no axis : everything stops");
  assert.deepEqual(autoToggled({ x: 1, speed: "fast" }, "y", 1), { x: 1, y: 1, r: 0 }, "only the ways come back");
  assert.equal(autoText({ x: 1, y: -1, r: 0 }, 27), "Z ▶ + ▲ · 27 °/s"); assert.equal(autoText({ x: 0, y: 1, r: -1 }, 9), "▼ + ↺ · 9 °/s"); assert.equal(autoText({ x: -1, y: 0, r: 0 }, 72), "Z ◀ · 72 °/s"); assert.equal(autoText(rest, 9), "");
  /* two turns at once are one move : the eye goes round Z and rises in the same step, and the pivot keeps its place */
  const cam = iso(), pivot = [5, 5, 5], both = orbitAbout(cam, pivot, -0.2, 0.2), a = onScreen(cam, pivot), b = onScreen(both, pivot); square(both);
  near(a[0], b[0], 1e-9); near(a[1], b[1], 1e-9); assert.ok(both.dir[2] > cam.dir[2] + 0.05, "it rose"); assert.ok(Math.abs(Math.atan2(both.dir[1], both.dir[0]) - Math.atan2(cam.dir[1], cam.dir[0])) > 0.15, "and it went round Z");
  /* kept in one sense, the turn about Z goes on over the top : the horizontal of the screen never turns back */
  let c = level([0, 0, 0], [1, 0, 1]); const turns = [];
  for (let i = 0; i < 40; i++) { const next = orbitAbout(c, [0, 0, 0], -0.1, 0.1), r0 = cross(c.up, c.dir), r1 = cross(next.up, next.dir); turns.push(r0[0] * r1[1] - r0[1] * r1[0]); c = next; }
  assert.ok(turns.every((t) => t < -0.05), "the same way before, at and after the top"); assert.ok(c.up[2] !== undefined && turns.length === 40);
});

test("cue : an arrow that goes round its ring for a turn that does not end", () => {
  const circle = (p) => rollPoint(40, p), c = cometOf(circle, 2, 1), back = cometOf(circle, 2, -1);
  assert.ok(c.d.startsWith("M") && c.head.split(" ").length === 3); assert.notEqual(c.d, back.d, "the other way round, the arrow points the other way");
  assert.deepEqual(cometOf(circle, 2, 0), { d: "", head: "" }, "an axis at rest draws nothing");
  const end = (d) => d.split("L").pop().split(" ").map(Number), at = rollPoint(40, 2); near(end(c.d)[0], at[0], 0.06); near(end(c.d)[1], at[1], 0.06);      // the head is where the turn is
  assert.notEqual(cometOf(circle, 2.5, 1).d, c.d, "it moves as the turn goes on"); assert.equal(cometOf(circle, 2 + 40 * Math.PI, 1).d, c.d, "and never stops at the end of a ring");
});

test("wiring : the viewer turns about the pivot on three axes, shows the cue, and a held button is not a click", () => {
  const v = read("web/js/core/viewer.js"), o = read("web/js/core/view_orbit.js");
  assert.match(v, /this\.orbit = mountOrbit\(this\);/); assert.match(v, /this\.orbit\.press\(e, drag\)/); assert.match(v, /this\.orbit\.turn\(dx, dy, e\.altKey\)/);
  assert.match(v, /this\.orbit\.release\(\); if \(!d \|\| d\.moved \|\| d\.auto\) return;/); assert.match(v, /this\.orbit\.dispose\(\)/);
  assert.doesNotMatch(v, /applyAxisAngle\(new THREE\.Vector3\(0, 0, 1\), yaw\)/, "one orbit, in view_orbit.js");
  assert.match(o, /viewer\.camera\.up\.set\(\.\.\.next\.up\)/, "the up of the screen is kept from one move to the next : no turn is lost at the top");
  assert.doesNotMatch(o, /pole/, "no stop before straight up or down");
  assert.match(read("web/js/core/view_place.js"), /viewer\.holdBusy = \(\) => !!tool;/);
  const css = read("web/css/app.css"); assert.match(css, /\.dw-orbit \{ position: absolute; pointer-events: none;/); assert.match(css, /"rl up rr"/);
  assert.match(o, /Object\.assign\(auto, autoToggled\(auto, axis, val\), \{ last: 0 \}\)/, "a way is a switch of its axis : the others are left as they are");
  assert.match(o, /turn = sense \? -dxAngle \* sense : yawOf\(dxAngle, c\.up\[2\]\)/, "alone, the turn about Z keeps its sense over the top");
  assert.match(o, /auto \? \[cometOf\(onRing, -yaw, -went\[0\]\), cometOf\(onTilt, tip, went\[1\]\), cometOf\(onRoll, spun, went\[2\]\)\]/, "one arrow per axis that goes");
});
