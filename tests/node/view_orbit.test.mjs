/* Turning a 3D view : the turntable about the point that was grabbed, the cue that shows it, the automatic rotation — the pure half
   of core/view_orbit.js, and its wiring in the viewer. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { turned, orbitAbout, ringOf, ringPoint, tiltPoint, arcOf, holdProgress, orbitText, autoSpeed, ORBIT, AUTO_SPEEDS } from "../../web/js/core/view_orbit.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
/* where a point is on the screen of a camera that keeps Z up : along its right and its up, from its target */
const onScreen = (cam, p) => { const right = unit(cross([0, 0, 1], cam.dir)), up = cross(cam.dir, right), d = [p[0] - cam.target[0], p[1] - cam.target[1], p[2] - cam.target[2]]; return [dot(d, right), dot(d, up)]; };
const iso = () => ({ target: [10, 20, 5], dir: unit([1, -1, 0.8]) });

test("orbit : a vector turned about an axis", () => {
  const v = turned([1, 0, 0], [0, 0, 1], Math.PI / 2); near(v[0], 0, 1e-12); near(v[1], 1, 1e-12); near(v[2], 0, 1e-12);
  const w = turned([0, 0, 2], [0, 0, 1], 1.3); assert.deepEqual(w.map((x) => +x.toFixed(9)), [0, 0, 2], "what lies on the axis does not move");
});

test("orbit : the point that was grabbed keeps its place on the screen, whatever the turn", () => {
  const pivot = [60, -15, 22];
  for (const [yaw, pitch] of [[0.4, 0], [0, 0.25], [-0.9, -0.3], [2.5, 0.1]]) {
    const cam = iso(), before = onScreen(cam, pivot), next = orbitAbout(cam, pivot, yaw, pitch), after = onScreen(next, pivot);
    near(after[0], before[0], 1e-9); near(after[1], before[1], 1e-9); near(Math.hypot(...next.dir), 1, 1e-12);
  }
  /* another point does move : the view really turned */
  const cam = iso(), other = [0, 0, 0], a = onScreen(cam, other), b = onScreen(orbitAbout(cam, pivot, 0.4, 0), other); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1);
});

test("orbit : about the centre of the view, the view turns as it always did", () => {
  const cam = iso(), next = orbitAbout(cam, cam.target, 0.3, 0.2);
  assert.deepEqual(next.target.map((x) => +x.toFixed(9)), cam.target, "the centre stays the centre");
  near(next.pitch, 0.2);
  const yawOnly = orbitAbout(cam, cam.target, 0.3, 0); near(yawOnly.dir[2], cam.dir[2], 1e-12); near(yawOnly.pitch, 0);
});

test("orbit : the tilt stops before straight up or down, the turn about the vertical goes on", () => {
  const cam = { target: [0, 0, 0], dir: unit([0.2, 0, 0.98]) }, up = orbitAbout(cam, [0, 0, 0], 0.5, 0.15), down = orbitAbout(cam, [0, 0, 0], 0.5, -0.15);
  const [stopped, went] = up.pitch === 0 ? [up, down] : [down, up];
  assert.equal(stopped.pitch, 0, "toward the pole : no tilt was made"); near(stopped.dir[2], cam.dir[2], 1e-12);
  assert.ok(Math.abs(stopped.dir[1]) > 0.05, "but the view turned about Z");
  assert.notEqual(went.pitch, 0, "away from the pole the tilt is made"); assert.ok(went.dir[2] < cam.dir[2]);
  assert.ok(Math.abs(went.dir[2]) < ORBIT.pole);
});

test("cue : the ring flattens as the eye comes down, and its arc follows the hand", () => {
  const top = ringOf(0.9, 40), low = ringOf(0.1, 40), under = ringOf(-0.6, 40);
  assert.equal(top.rx, 40); near(top.ry, 36); assert.ok(low.ry >= 40 * 0.16, "never so flat that it is a line"); assert.equal(under.below, true);
  assert.ok(top.axis < low.axis, "seen from above the vertical axis is short ; from the side it is long");
  /* the nearest point of the ring is at the bottom seen from above, at the top seen from underneath ; to the right goes right */
  assert.deepEqual(ringPoint(top, 0), [0, 36]); assert.deepEqual(ringPoint(under, 0), [0, -24]); assert.ok(ringPoint(top, 0.5)[0] > 0 && ringPoint(top, -0.5)[0] < 0);
  assert.ok(tiltPoint(40, 0.5)[1] > 0 && tiltPoint(40, -0.5)[1] < 0, "the tilt arc goes down when the hand goes down");
});

test("cue : an arc has its arrow head, a turn too small has nothing, a long one stops short of a full ring", () => {
  const g = ringOf(0.7, 40), a = arcOf((p) => ringPoint(g, p), 0.8);
  assert.match(a.d, /^M0\.0 28\.0L/); assert.equal(a.head.split(" ").length, 3);
  const head = a.head.split(" ").map((s) => s.split(",").map(Number)), end = ringPoint(g, 0.8); assert.ok(head[0][0] > end[0], "the head points the way the arc goes : to the right");
  const b = arcOf((p) => ringPoint(g, p), -0.8); assert.ok(b.head.split(" ")[0].split(",")[0] < ringPoint(g, -0.8)[0]);
  assert.deepEqual(arcOf((p) => ringPoint(g, p), 0.01), { d: "", head: "" });
  assert.equal(arcOf((p) => ringPoint(g, p), 50).d, arcOf((p) => ringPoint(g, p), 5.65).d);
});

test("hold : nothing shows at once, then the hold fills until the automatic rotation ; three speeds", () => {
  assert.equal(holdProgress(0), 0); assert.equal(holdProgress(ORBIT.show), 0); assert.equal(holdProgress(ORBIT.hold), 1); assert.equal(holdProgress(9999), 1);
  near(holdProgress((ORBIT.show + ORBIT.hold) / 2), 0.5); assert.equal(ORBIT.hold, 2000);
  assert.deepEqual(AUTO_SPEEDS.map((s) => s.key), ["slow", "medium", "fast"]); assert.ok(AUTO_SPEEDS[0].deg < AUTO_SPEEDS[1].deg && AUTO_SPEEDS[1].deg < AUTO_SPEEDS[2].deg);
  assert.equal(autoSpeed("fast").deg, 72); assert.equal(autoSpeed("nope").key, "slow");
  assert.equal(orbitText(0.6, 0), "Z 34°"); assert.equal(orbitText(-0.6, 0.21), "Z 34° · incl. 12°"); assert.equal(orbitText(0, 0), "");
});

test("wiring : the viewer turns about the pivot, shows the cue, and a held button is not a click", () => {
  const v = read("web/js/core/viewer.js");
  assert.match(v, /this\.orbit = mountOrbit\(this\);/); assert.match(v, /this\.orbit\.press\(e, drag\)/); assert.match(v, /this\.orbit\.turn\(dx, dy\)/);
  assert.match(v, /this\.orbit\.release\(\); if \(!d \|\| d\.moved \|\| d\.auto\) return;/); assert.match(v, /this\.orbit\.dispose\(\)/);
  assert.doesNotMatch(v, /applyAxisAngle\(new THREE\.Vector3\(0, 0, 1\), yaw\)/, "one turntable, in view_orbit.js");
  assert.match(read("web/js/core/view_place.js"), /viewer\.holdBusy = \(\) => !!tool;/, "a tool armed keeps the held button for itself");
  const css = read("web/css/app.css"); assert.match(css, /\.dw-orbit \{ position: absolute; pointer-events: none;/); assert.match(css, /\.dw-auto \{/);
});
