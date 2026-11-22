/* The breadboard of the Labo (JP, 22 novembre 2026 : « une vue breadboard plus clean… les traces vers le breadboard de manière clean…
   les instruments sur les pins du breadboard bien identifiés par tag de carte et d'équipement ») : each point of the board an instrument
   touches has its own row, its own jumper, its tag ; the leads go into the holes of their row ; no two jumpers ever cross ; what the
   hand does on the board stays on the board.   node --test tests/node/lab_breadboard.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { breadLayout, crossings, leadTag, kindOf, GEAR_TAG } from "../../web/js/pcba/lab_breadboard.js";
import { boardSheets } from "../../web/js/pcba/lab_plan.js";
import { benchGear } from "../../web/js/pcba/lab_gear.js";
import { placedPoints } from "../../web/js/pcba/lab_manip.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { firstBoard } from "../../web/js/demo/demo_first.js";
import { rs485Board } from "../../web/js/demo/demo_rs485.js";

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const pointsOf = (R, s) => placedPoints(R, { points: benchGear(s).flatMap((g) => g.leads.filter((l) => l.ref).map((l) => ({ ...l, gear: g.key }))) }).points;

test("every test of the three example boards : a row per point, each lead in a hole of its row, each jumper from its pad to its row — and none crosses another", () => {
  let n = 0;
  for (const B of [demoBoard(), firstBoard(), rs485Board()]) { const R = resolveBoard(B, LIBRARY);
    for (const s of boardSheets(B)) { if (s.noSim) continue; const P = pointsOf(R, s), L = breadLayout(P, R.bbox, { board: B.name }), wired = P.filter((p) => p.at && !["press", "cell"].includes(kindOf(p.gear)));
      if (!wired.length) { assert.equal(L.rows.length, 0); continue; } n++;
      const where = `${B.id} ${s.test}`, keys = L.rows.map((r) => r.key);
      assert.equal(new Set(keys).size, keys.length, `${where} : one row per pad`); assert.deepEqual(new Set(keys), new Set(wired.map((p) => `${p.ref}.${p.pin}`)), `${where} : every wired point has its row`);
      for (const p of wired) { const r = L.rows.find((x) => x.key === `${p.ref}.${p.pin}`), l = r.leads.find((x) => x.gear === p.gear && x.lead === p.lead); assert.ok(l && r.holes.slice(1).some((h) => h === l.hole), `${where} : ${p.gear} ${p.lead} in a hole of its row`); }
      for (const r of L.rows) { assert.equal(new Set(r.leads.map((l) => l.hole)).size, r.leads.length, `${where} : one lead per hole`); assert.equal(r.key, `${r.ref}.${r.pin}`, "the tag of the row : the reference and the pin of the board"); }
      for (const j of L.jumpers) { const r = L.rows.find((x) => x.key === j.key); assert.deepEqual(j.pts[0], [r.at.x, r.at.y], "the jumper leaves from the pad"); assert.deepEqual(j.pts.at(-1), r.holes[0], "and lands in the first hole of its row"); }
      assert.deepEqual(crossings(L.jumpers), [], `${where} : no two jumpers cross`);
      assert.ok(L.box[0] > R.bbox[2], `${where} : the breadboard is beside the board, not on it`); assert.match(L.title, /Plaque d'essai — /); }
  }
  assert.ok(n >= 35, `${n} tests drawn on a breadboard`);
});

test("pads on one line, pads anywhere : three thousand random sets, never a crossing", () => {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 3000; t++) { const pts = [];
    for (let i = 0, k = 2 + Math.floor(rnd() * 9); i < k; i++) { const y = rnd() < 0.4 ? 10 + 2.54 * Math.floor(rnd() * 3) : rnd() * 60, x = rnd() < 0.5 ? 5 + 2.54 * Math.floor(rnd() * 8) : rnd() * 80;
      if (pts.some((q) => Math.abs(q.at.x - x) < 1.2 && Math.abs(q.at.y - y) < 1.2)) continue; pts.push({ ref: `U${i}`, pin: 1, at: { x, y }, gear: "scope", lead: "probe", label: "S", signal: `S${i}` }); }
    assert.deepEqual(crossings(breadLayout(pts, [0, 0, 80, 60]).jumpers), [], JSON.stringify(pts.map((p) => [p.at.x, p.at.y]))); }
});

test("what the hand does on the board stays there ; the tags say the instrument and its lead ; ground is black, the + of a supply red", () => {
  const B = firstBoard(), R = resolveBoard(B, LIBRARY), s = boardSheets(B).find((x) => x.test === "press"), L = breadLayout(pointsOf(R, s), R.bbox);
  assert.ok(L.stay.some((p) => kindOf(p.gear) === "press"), "the finger presses the button ON the board"); assert.ok(L.rows.every((r) => r.leads.every((l) => kindOf(l.gear) !== "press")));
  assert.equal(leadTag({ gear: "supply:VIN", label: "+" }), "Alim. +"); assert.equal(leadTag({ gear: "scope", label: "S2" }), "Osc. S2"); assert.equal(GEAR_TAG.meter, "Multi.");
  const D = demoBoard(), RD = resolveBoard(D, LIBRARY), rip = boardSheets(D).find((x) => x.test === "ripple"), LD = breadLayout(pointsOf(RD, rip), RD.bbox);
  const gnd = LD.rows.find((r) => r.ground), plus = LD.rows.find((r) => r.leads.some((l) => l.lead === "plus")); assert.ok(gnd && plus); assert.equal(gnd.color, "#1f2937"); assert.equal(plus.color, "#dc2626");
  assert.deepEqual(breadLayout([], R.bbox).rows, []);
});

test("in the Labo : a switch « Plaque d'essai · Carte », the board view draws the breadboard, the leads are the marks the cords look for", () => {
  const lab = read("web/js/modules/elab.js"), view = read("web/js/modules/elab_view.js"), draw = read("web/js/modules/elab_bread.js");
  assert.match(lab, /role: "radiogroup", "aria-label": "Vue du banc"/); assert.match(lab, /Plaque d'essai/); assert.match(lab, /dw\.lab\.view/);
  assert.match(view, /breadLayout\(marked, bb/); assert.match(view, /bread\(on\)/);
  assert.match(draw, /class: "lab-mark lab-bb-lead", "data-mark"[^\n]*"data-gear": l\.gear/); assert.match(draw, /class: "lab-mark-dot"/);
  assert.match(read("docs/LABO.md"), /Plaque d'essai/);
});
