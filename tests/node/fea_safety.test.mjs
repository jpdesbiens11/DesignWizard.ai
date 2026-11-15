/* Simulation : the safety factor of a result, point by point, and the colours it is read with against the factor aimed at. */
import test from "node:test";
import assert from "node:assert/strict";
import { FS_TARGETS, FS_COLORS, fsBands, fsBand, fsColour, safetyOf, safetyField, safetySummary, safetyText } from "../../web/js/analysis/fea/safety.js";

const hex = (c) => "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

test("the bands of a target : red below it — darker beyond yield — then orange, blue, green", () => {
  assert.deepEqual(fsBands(1.5).map((b) => [b.key, b.from, b.to]), [["yield", 0, 1], ["under", 1, 1.5], ["tight", 1.5, 2.25], ["ok", 2.25, 4.5], ["ample", 4.5, Infinity]]);
  assert.deepEqual(fsBands(2).map((b) => b.to), [1, 2, 3, 6, Infinity]); assert.deepEqual(fsBands(1).map((b) => b.key), ["under", "tight", "ok", "ample"], "aiming at 1 : below it is beyond yield, one red band");
  assert.deepEqual(fsBands("x").map((b) => b.to), fsBands(1.5).map((b) => b.to), "a target that is not a number falls back on 1,5");
  assert.deepEqual([0.5, 1.2, 1.5, 2.2, 2.25, 4.4, 4.5, 99, Infinity, NaN].map((v) => fsBand(v, 1.5)), ["yield", "under", "tight", "tight", "ok", "ok", "ample", "ample", "ample", "none"]);
  assert.ok(FS_TARGETS.includes(1.5) && FS_TARGETS.includes(2) && FS_TARGETS.every((t, i, a) => i === 0 || t > a[i - 1]));
});

test("the colours : flat red under the target, a shade inside the orange and blue bands, green beyond, grey when the yield is unknown", () => {
  assert.equal(hex(fsColour(1.2, 1.5)), FS_COLORS.under[0]); assert.equal(hex(fsColour(1.49, 1.5)), FS_COLORS.under[0], "just under the target is red, whatever else");
  assert.equal(hex(fsColour(0.4, 1.5)), FS_COLORS.yield[0]); assert.equal(hex(fsColour(1.5, 1.5)), FS_COLORS.tight[0]); assert.equal(hex(fsColour(2.25, 1.5)), FS_COLORS.ok[0]);
  assert.equal(hex(fsColour(10, 1.5)), FS_COLORS.ample[0]); assert.equal(hex(fsColour(Infinity, 1.5)), FS_COLORS.ample[0]); assert.equal(hex(fsColour(NaN, 1.5)), FS_COLORS.none[0]);
  const mid = fsColour(1.875, 1.5), a = fsColour(1.5, 1.5), b = fsColour(2.2499, 1.5); assert.ok(mid.every((c, i) => c >= Math.min(a[i], b[i]) - 1e-9 && c <= Math.max(a[i], b[i]) + 1e-9), "inside a band the shade goes from one end to the other");
  assert.notEqual(hex(fsColour(2, 1.5)), hex(fsColour(2, 2)), "the same factor reads differently against another target");
});

test("the factor on the skin of a result, per face material, and what it says against the target", () => {
  assert.deepEqual([safetyOf(100, 250), safetyOf(0, 250)], [2.5, Infinity]); assert.ok(Number.isNaN(safetyOf(100, 0)));
  // two faces : aluminium (Re 240) stressed 100, 50, 10, 0 ; a body of unknown yield
  const fs = safetyField(Float32Array.from([100, 50, 10, 0, 300, 20, 20, 20]), Float32Array.from([240, 0]));
  assert.deepEqual(Array.from(fs.subarray(0, 4)).map((v) => Math.round(v * 100) / 100), [2.4, 4.8, 24, Infinity]); assert.ok(Array.from(fs.subarray(4)).every(Number.isNaN));
  const s = safetySummary(fs, 1.5); assert.equal(Math.round(s.min * 100) / 100, 2.4); assert.deepEqual([s.at, s.under, s.yield, s.known, s.band], [0, 0, 0, 0.5, "ok"]);
  assert.match(safetyText(s), /Facteur de sécurité minimal 2,4 pour 1,5 visé : la marge est tenue partout\./);
  const hard = safetySummary(fs, 3); assert.deepEqual([hard.under, hard.band], [0.5, "under"]); assert.match(safetyText(hard), /50 % de la surface est sous la marge\./);
  const one = safetyField(Float32Array.from([300, 100, 100, 100, 100, 100, 100, 100]), 240), y = safetySummary(one, 1.5);
  assert.equal(Math.round(y.min * 10) / 10, 0.8); assert.deepEqual([y.under, y.yield, y.band], [0.5, 0.5, "yield"]); assert.match(safetyText(y), /dont 50 % au-delà de la limite élastique/);
  assert.equal(safetySummary(safetyField(Float32Array.from([10, 10, 10, 10]), 0), 2).min, null); assert.match(safetyText(safetySummary(safetyField(Float32Array.from([10, 10, 10, 10]), 0), 2)), /Limite élastique inconnue/);
});
