/* Turning a part of an assembly by hand (core/asm_turn.js) : what it turns about, what is written, and that what hangs on it
   follows — a part placed by hand, a part a joint holds (either end of the joint), a sub-assembly. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { turnAbout, snapTurn, wrapTurn, turnSnap, turnOf, withTurn, applyTurn, turnText, ringFrame, ringFrom, ringAt, ringPoints, ringAngle, turnDelta } from "../../web/js/core/asm_turn.js";
import { solveLevels } from "../../web/js/core/assembly_logic.js";
import { matPoint, matFromPlacement } from "../../web/js/cad/vec.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`), nearP = (p, q, what = "") => p.forEach((x, k) => near(x, q[k], 1e-6) || 0) || what;
const up = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "A", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] } });
const down = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "B", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1] } });
const side = (id, x, y, z, key) => ({ id, name: id, type: "planar", side: "A", key, params: {}, opts: {}, frame: { o: [x, y, z], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] } });      // a seat on the +X face
const part = (interfaces, box = [0, 0, 0, 10, 10, 5]) => ({ interfaces, bodies: [], bbox: box, mass: 10, cog: [5, 5, 2.5] });
/* a base (the ground) with a seat on its top at (20, 10, 10) and one on its +X face ; a plate on the top seat carries a board ; a lug on the side seat ; a loose part */
const built = { BASE: part([up("IF1", 20, 10, 10, "k1"), side("IF2", 40, 10, 5, "k2")], [0, 0, 0, 40, 20, 10]), PLATE: part([down("IF1", 0, 0, 0, "k1"), up("IF3", 6, 0, 5, "k3")]), BOARD: part([down("IF3", 0, 0, 0, "k3")]),
  LUG: part([down("IF2", 0, 0, 0, "k2")]), LOOSE: part([]) };
const asm = () => ({ id: "TOP", instances: [{ id: "base", part: "BASE", fixed: true }, { id: "plate", part: "PLATE" }, { id: "board", part: "BOARD" }, { id: "lug", part: "LUG" }, { id: "loose", part: "LOOSE", placement: { t: [100, 50, 0], r: [0, 0, 30] } }],
  mates: [{ id: "M1", a: { inst: "base", iface: "IF1" }, b: { inst: "plate", iface: "IF1" } }, { id: "M2", a: { inst: "board", iface: "IF3" }, b: { inst: "plate", iface: "IF3" } }, { id: "M3", a: { inst: "base", iface: "IF2" }, b: { inst: "lug", iface: "IF2" } }] });
const find = () => null, o = { built, find }, where = (a, id, p = [0, 0, 0]) => matPoint(solveLevels(a, built, find).sol.placements[id], p);
/* how far a point went round an axis, in degrees, right-handed */
const went = (p0, p1, c, axis) => { const a = p0.map((x, k) => x - c[k]), b = p1.map((x, k) => x - c[k]), cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(cr[0] * axis[0] + cr[1] * axis[1] + cr[2] * axis[2], dot - (a[0] * axis[0] + a[1] * axis[1] + a[2] * axis[2]) * (b[0] * axis[0] + b[1] * axis[1] + b[2] * axis[2])) * 180 / Math.PI; };

test("turn : angles — a notch, the way they are written, the step of a gesture", () => {
  assert.equal(snapTurn(12.4), 10); assert.equal(snapTurn(12.6), 15); assert.equal(snapTurn(-7.6, 15), -15); assert.equal(snapTurn(33.33, 0), 33.3, "free : a tenth of a degree"); assert.ok(Object.is(snapTurn(-1), 0), "no minus zero");
  assert.equal(wrapTurn(190), -170); assert.equal(wrapTurn(-180), 180); assert.equal(wrapTurn(360), 0); assert.equal(wrapTurn(725), 5); assert.equal(wrapTurn(89.99999999), 90);
  assert.equal(turnSnap({}), 5); assert.equal(turnSnap({ shiftKey: true }), 15); assert.equal(turnSnap({ altKey: true }), 0);
  assert.equal(turnText(35), "+35°"); assert.equal(turnText(-12.5), "−12,5°"); assert.equal(turnText(0), "0°");
  nearP(matPoint(turnAbout([10, 0, 0], [0, 0, 1], 90), [20, 0, 0]), [10, 10, 0]); nearP(matPoint(turnAbout([10, 0, 0], [0, 0, 1], 90), [10, 0, 7]), [10, 0, 7], "the axis does not move");
});

test("turn : a part placed by hand turns about the vertical through the middle of its box, and its placement is rewritten", () => {
  const a = asm(), t = turnOf(a, "loose", o);
  assert.equal(t.kind, "free"); assert.deepEqual(t.axis, [0, 0, 1]); assert.equal(t.angle, 30, "its present turn about Z"); near(t.centre[2], 2.5); assert.ok(t.radius > 5);
  const mid = where(a, "loose", [5, 5, 2.5]); nearP(t.centre, mid, "the middle of the box, where it stands");
  const next = withTurn(a, t, 45); assert.deepEqual(a.instances[4].placement, { t: [100, 50, 0], r: [0, 0, 30] }, "the document is not changed");
  assert.equal(next.instances[4].placement.r[2], 75); nearP(where(next, "loose", [5, 5, 2.5]), mid, "it turned on the spot"); near(went(where(a, "loose", [10, 5, 2.5]), where(next, "loose", [10, 5, 2.5]), mid, [0, 0, 1]), 45);
  applyTurn(a, t, -30); assert.equal(a.instances[4].placement.r[2], 0); near(a.instances[4].placement.r[0], 0); nearP(where(a, "loose", [5, 5, 2.5]), mid);
  /* the ground : everything that hangs on it goes round with it */
  const g = turnOf(a, "base", o); assert.equal(g.kind, "free"); const b0 = where(a, "board", [0, 0, 0]), turned = withTurn(a, g, 90); near(went(b0, where(turned, "board", [0, 0, 0]), g.centre, [0, 0, 1]), 90); near(where(turned, "board")[2], b0[2]);
  assert.equal(turnOf(a, "nope", o), null); a.instances[4].off = true; assert.equal(turnOf(a, "loose", o), null, "a part put aside has nothing to turn");
});

test("turn : a part a joint holds turns about the normal of the joint — the angle of the joint changes, whichever end it is", () => {
  const a = asm(), t = turnOf(a, "plate", o);      // the plate is the B end of M1, on the top of the base
  assert.deepEqual([t.kind, t.mate, t.angle], ["mate", "M1", 0]); nearP(t.centre, [20, 10, 10], "the origin of the joint"); near(Math.abs(t.axis[2]), 1, 1e-9); assert.ok(t.sign === 1 || t.sign === -1);
  const p0 = where(a, "plate", [6, 0, 5]), next = withTurn(a, t, 40), p1 = where(next, "plate", [6, 0, 5]); near(went(p0, p1, t.centre, t.axis), 40, 1e-6); nearP(where(next, "plate", [0, 0, 0]), where(a, "plate", [0, 0, 0]), "the origin of the joint stays");
  assert.equal(Math.abs(next.mates[0].angle), 40); assert.equal(next.instances[1].placement, undefined, "nothing is written on the part : the joint carries the angle");
  /* the board hangs on the plate : it goes round with it */
  near(went(where(a, "board", [0, 0, 0]), where(next, "board", [0, 0, 0]), t.centre, t.axis), 40, 1e-6);
  /* the board is the A end of M2 (the joint is walked backwards to place it) : the same gesture, the same result — the sign is found on the solver */
  const tb = turnOf(a, "board", o); assert.deepEqual([tb.kind, tb.mate], ["mate", "M2"]); const q0 = where(a, "board", [4, 3, 0]), nb = withTurn(a, tb, 25); near(went(q0, where(nb, "board", [4, 3, 0]), tb.centre, tb.axis), 25, 1e-6);
  assert.notEqual(t.sign * tb.sign, 0); nearP(where(nb, "plate", [1, 2, 3]), where(a, "plate", [1, 2, 3]), "what holds it does not move");
  /* a joint on a side face : the axis is the normal of that face, not the vertical */
  const tl = turnOf(a, "lug", o); near(Math.abs(tl.axis[0]), 1, 1e-9); nearP(tl.centre, [40, 10, 5]); near(went(where(a, "lug", [0, 4, 0]), where(withTurn(a, tl, -60), "lug", [0, 4, 0]), tl.centre, tl.axis), -60, 1e-6);
  /* back to zero : the angle leaves the file ; and one step applied to the document */
  applyTurn(a, t, 40); assert.equal(Math.abs(a.mates[0].angle), 40); const t2 = turnOf(a, "plate", o); assert.equal(Math.abs(t2.angle), 40); applyTurn(a, t2, -40); assert.ok(!("angle" in a.mates[0]), "an angle of zero is not written");
  applyTurn(a, turnOf(a, "plate", o), 200); assert.equal(Math.abs(a.mates[0].angle), 160, "written between −180 and 180");
});

test("turn : a sub-assembly turns as the one block it is", () => {
  const sub = { id: "MOD", instances: [{ id: "i1", part: "PLATE", fixed: true }, { id: "i2", part: "BOARD" }], mates: [{ id: "M1", a: { inst: "i2", iface: "IF3" }, b: { inst: "i1", iface: "IF3" } }] };
  const top = { id: "TOP", instances: [{ id: "base", part: "BASE", fixed: true }, { id: "s1", asm: "MOD" }, { id: "s2", asm: "MOD", placement: { t: [200, 0, 0], r: [0, 0, 0] } }], mates: [{ id: "J1", a: { inst: "base", iface: "IF1" }, b: { inst: "s1~i1", iface: "IF1" } }] };
  const f = (id) => (id === "MOD" ? sub : null), oo = { built, find: f }, at = (a, id, p) => matPoint(solveLevels(a, built, f).sol.placements[id], p);
  const held = turnOf(top, "s1", oo); assert.deepEqual([held.kind, held.mate], ["mate", "J1"], "held by a joint of the parent that goes to a part inside"); nearP(held.centre, [20, 10, 10]);
  const n1 = withTurn(top, held, 30); near(went(at(top, "s1~i2", [0, 0, 0]), at(n1, "s1~i2", [0, 0, 0]), held.centre, held.axis), 30, 1e-6); near(went(at(top, "s1~i1", [8, 2, 0]), at(n1, "s1~i1", [8, 2, 0]), held.centre, held.axis), 30, 1e-6);
  const free = turnOf(top, "s2", oo); assert.equal(free.kind, "free"); const c = free.centre, n2 = withTurn(top, free, 90);
  for (const [leaf, p] of [["s2~i1", [0, 0, 0]], ["s2~i2", [3, 1, 2]]]) near(went(at(top, leaf, p), at(n2, leaf, p), c, [0, 0, 1]), 90, 1e-6);
  assert.equal(n2.instances[2].placement.r[2], 90); nearP(matPoint(matFromPlacement(n2.instances[2].placement), [0, 0, 0]).slice(2), [0], "it stays at its height");
});

test("turn : the ring of the handle — where the grip starts, where the hand is on it, the short way round", () => {
  const fr = ringFrame([0, 0, 1], [1, 0.2, 0.5]); near(fr.u[2], 0); assert.ok(fr.u[0] > 0.9, "the first direction leans to the right of the screen, in the plane of the ring"); nearP(fr.v, [-fr.u[1], fr.u[0], 0]);
  const edge = ringFrame([0, 0, 1], [0, 0, 1]); near(Math.hypot(...edge.u), 1); near(edge.u[2], 0, 1e-9, "looked at along its axis' direction : any direction of the plane");
  nearP(ringAt([1, 2, 3], { u: [1, 0, 0], v: [0, 1, 0] }, 10, 90), [1, 12, 3]); const pts = ringPoints([0, 0, 0], { u: [1, 0, 0], v: [0, 1, 0] }, 10); nearP(pts[0], pts.at(-1), "a closed ring"); assert.ok(pts.length > 40);
  assert.equal(ringPoints([0, 0, 0], { u: [1, 0, 0], v: [0, 1, 0] }, 10, 0, 30).length, 6); nearP(ringPoints([0, 0, 0], { u: [1, 0, 0], v: [0, 1, 0] }, 10, 0, -90).at(-1), [0, -10, 0]);
  /* a ray from above, straight down, onto a ring that lies flat */
  const flat = { u: [1, 0, 0], v: [0, 1, 0] }; near(ringAngle([0, 10, 50], [0, 0, -1], [0, 0, 0], [0, 0, 1], flat), 90); near(ringAngle([-7, 0, 50], [0, 0, -1], [0, 0, 0], [0, 0, 1], flat), 180); near(ringAngle([5, -5, 50], [0.1, 0, -0.995], [0, 0, 0], [0, 0, 1], flat), Math.atan2(-5, 5 + 50 * 0.1 / 0.995) * 180 / Math.PI, 1e-6);
  assert.equal(ringAngle([0, 10, 0], [1, 0, 0.1], [0, 0, 0], [0, 0, 1], flat), null, "seen edge-on, the plane says nothing : the gesture goes along the tangent instead");
  /* the grip may start further round the ring : the same ring, another first direction */
  const far = ringFrom(flat, 90); nearP(far.u, [0, 1, 0]); nearP(far.v, [-1, 0, 0]); nearP(ringAt([0, 0, 0], far, 10, 0), ringAt([0, 0, 0], flat, 10, 90)); nearP(ringAt([0, 0, 0], ringFrom(flat, 180), 10, 45), ringAt([0, 0, 0], flat, 10, 225));
  assert.match(read("web/js/modules/asm_turn.js"), /\[0, 180, 90, 270, 45, 135, 225, 315\]\.find\(\(a\) => seen\(ringAt\(t\.centre, first, r, a\)\)\)/, "the grip is put where the view shows the ring");
  /* a second notch asked before the scene is rebuilt adds to the first : the turn starts from the placement the document has */
  { const a = asm(), t = turnOf(a, "loose", o); applyTurn(a, t, 5); applyTurn(a, t, 5); assert.equal(a.instances[4].placement.r[2], 40); nearP(where(a, "loose", [5, 5, 2.5]), t.centre); }
  assert.equal(turnDelta(170, -170), 20); assert.equal(turnDelta(-170, 170), -20); assert.equal(turnDelta(10, 40), 30);
});

test("turn : the screen — a ring and a grip round the chosen part, the same angle as a number, one undoable step", () => {
  const m = read("web/js/modules/asm_turn.js"), a = read("web/js/modules/assembly.js"), css = read("web/css/app.css");
  assert.match(a, /const turner = mountTurn\(vp, \{ id, ctx: \(\) => st\.ctx, selected: \(\) => \(st\.tab === "inst" && !st\.mate \? st\.sel : null\)/, "for the part chosen, while its card is the one shown");
  assert.match(a, /clear\(right\); turner\.draw\(\);/, "the handle follows the selection"); assert.equal((a.match(/turner\.section\(\)/g) || []).length, 2, "the angle as a number, in the card of a part and of a sub-assembly");
  assert.match(m, /const commit = \(t, d\) => \{ if \(d\) store\.updateAssembly\(o\.id, \(x\) => \{ applyTurn\(x, t, d\); \}, said\(t, d\)\); \};/, "one named step, undone by Ctrl + Z ; nothing for a turn of zero");
  assert.match(m, /const s = solveLevels\(withTurn\(live\.doc, live\.t, d\), live\.ctx\.built, find\)/, "the preview is the assembly solved with the turn : what the release leaves");
  assert.match(m, /grip\.setAttribute\("role", "slider"\)/); assert.match(m, /\{ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 \}\[e\.key\]/, "a slider for the keyboard"); assert.match(m, /if \(ev\.key === "Escape"\) \{ ev\.stopPropagation\(\); end\(false\); \}/, "Escape gives the gesture up");
  assert.match(m, /type: "number", step: "5"/, "an ordinary numeric field : it inherits the arrows of the application"); assert.ok(!/new Blob|innerHTML/.test(m));
  assert.match(css, /\.dw-view-label\.turn-grip \{[^}]*touch-action: none;/); assert.ok(m.split("\n").length < 500 && read("web/js/core/asm_turn.js").split("\n").length < 500);
});
