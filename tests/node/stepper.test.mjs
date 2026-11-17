/* The arrows of a number field : 1 at a time, faster when held or clicked quickly — ×2, ×5, ×10 — and a value that stays clean. */
import test from "node:test";
import assert from "node:assert/strict";
import { SPEEDS, HOLD_AT, QUICK, REPEAT, speedByHold, speedByStreak, stepSpeed, nextStreak, baseStep, stepValue } from "../../web/js/core/stepper.js";

test("the speeds : ×1, ×2, ×5, ×10 — by the time an arrow is held, or by a streak of quick clicks", () => {
  assert.deepEqual(SPEEDS, [1, 2, 5, 10]); assert.equal(HOLD_AT.length, SPEEDS.length); assert.ok(HOLD_AT.every((t, i) => i === 0 || t > HOLD_AT[i - 1]), "each speed comes later than the one before");
  assert.deepEqual([0, 500, 999, 1000, 2199, 2200, 3599, 3600, 60000].map(speedByHold), [1, 1, 1, 2, 2, 5, 5, 10, 10]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 40].map(speedByStreak), [1, 1, 2, 2, 5, 5, 10, 10, 10], "two clicks at each speed"); assert.equal(speedByStreak(0), 1); assert.equal(speedByStreak(undefined), 1);
  assert.equal(stepSpeed(), 1); assert.equal(stepSpeed({ heldMs: 2500 }), 5); assert.equal(stepSpeed({ streak: 4 }), 2); assert.equal(stepSpeed({ heldMs: 1200, streak: 7 }), 10, "the faster of the two");
  assert.ok(REPEAT.wait > REPEAT.every && REPEAT.every >= 60, "a held arrow waits, then repeats at a pace one can follow"); assert.ok(QUICK > REPEAT.every);
});

test("a streak : quick clicks on the same arrow of the same field ; a pause, the other arrow or another field starts again", () => {
  const last = { at: 1000, dir: 1, key: "w" };
  assert.equal(nextStreak(null, 0, 1, "w", 1), 1); assert.equal(nextStreak(last, 1000 + QUICK - 1, 1, "w", 3), 4); assert.equal(nextStreak(last, 1000 + QUICK, 1, "w", 3), 1, "a pause");
  assert.equal(nextStreak(last, 1100, -1, "w", 3), 1, "the other arrow"); assert.equal(nextStreak(last, 1100, 1, "h", 3), 1, "another field");
  let s = 1, l = null, t = 0; const speeds = []; for (let i = 0; i < 8; i++) { s = nextStreak(l, t, 1, "w", s); speeds.push(stepSpeed({ streak: s })); l = { at: t, dir: 1, key: "w" }; t += 200; }
  assert.deepEqual(speeds, [1, 1, 2, 2, 5, 5, 10, 10], "eight quick clicks climb through the four speeds");
});

test("one step : 1 by default, the decimals typed are kept, the value stays within its limits", () => {
  assert.equal(stepValue(160, 1), 161); assert.equal(stepValue(160, -1), 159); assert.equal(stepValue(160, 1, 5), 165); assert.equal(stepValue(160, -1, 10), 150);
  assert.equal(stepValue(12.5, 1), 13.5, "a decimal typed stays"); assert.equal(stepValue(0.15, 1), 1.15); assert.equal(stepValue(0.1 + 0.2, 1), 1.3, "no dust of the floating point"); assert.equal(stepValue(2.675, -1, 2), 0.675);
  assert.equal(stepValue(NaN, 1), 1, "an empty field starts from zero"); assert.equal(stepValue(NaN, -1), -1); assert.equal(stepValue(NaN, 1, 1, { min: 5 }), 6, "or from its smallest value");
  assert.equal(stepValue(9, 1, 5, { max: 10 }), 10); assert.equal(stepValue(2, -1, 10, { min: 0 }), 0); assert.equal(stepValue(10, 1, 1, { max: 10 }), 10, "at its limit, a field stays there");
  assert.equal(stepValue(3, 1, 1, { min: NaN, max: NaN }), 4, "a field without limits has none");
  assert.equal(stepValue(1e-7, 1), 1.0000001);
});

test("a field whose whole range is 2 or less steps by a tenth : an arrow must not jump across it", () => {
  assert.equal(baseStep(), 1); assert.equal(baseStep({ min: 0, max: 200 }), 1); assert.equal(baseStep({ min: 0 }), 1); assert.equal(baseStep({ min: 0, max: 1 }), 0.1); assert.equal(baseStep({ min: 0, max: 2 }), 0.1); assert.equal(baseStep({ min: 0, max: 2.5 }), 1);
  assert.equal(stepValue(0.8, 1, 1, { min: 0, max: 1 }), 0.9); assert.equal(stepValue(0.8, 1, 5, { min: 0, max: 1 }), 1); assert.equal(stepValue(0.85, -1, 2, { min: 0, max: 1 }), 0.65); assert.equal(stepValue(0.3, -1, 10, { min: 0, max: 1 }), 0);
  assert.equal(stepValue(5, 1, 2, { base: 0.5 }), 6, "a step given wins");
});
