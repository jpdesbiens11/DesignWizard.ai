/* PCBA: design-rule check of an assembled board — copper, drilling, placement, assembly, test, coating. */
import test from "node:test";
import assert from "node:assert/strict";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { PCBA_RULES, PCBA_BOOK, fixHints } from "../../web/js/pcba/drc_rules.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIB, smallBoard } from "./pcba_fixture.mjs";

const rules = (r, sev) => r.findings.filter((f) => !sev || f.severity === sev).map((f) => f.rule);
const routed = () => { const b = smallBoard(); autoroute(b, LIB); return b; };
const at = (b, pin) => { const p = resolveBoard(b, LIB).pads.find((x) => x.pin === pin); return [p.x, p.y]; };

test("rule book: every rule has a limit, a reason and a source ; the book groups them all", () => {
  const all = Object.values(PCBA_RULES);
  assert.ok(all.length >= 28); assert.ok(all.every((r) => r.title && r.limit && r.why && r.source && ["error", "warn", "info"].includes(r.severity)));
  assert.equal(PCBA_BOOK.reduce((s, g) => s + g.rules.length, 0), all.length); assert.ok(PCBA_BOOK.every((g) => g.steps.length && g.category.startsWith("PCBA")));
  assert.match(fixHints({ rule: "PCBA-02" }), /vernis/); assert.equal(fixHints({ rule: "PCBA-35" }), "");
});

test("an unrouted board fails on its open connections ; routed, it has no error left", () => {
  const open = checkBoard(smallBoard(), LIB);
  assert.equal(open.ok, false); assert.deepEqual(rules(open, "error"), ["PCBA-04", "PCBA-04", "PCBA-04", "PCBA-04"]); assert.equal(open.stats.open, 13);
  const r = checkBoard(routed(), LIB);
  assert.equal(r.ok, true, r.findings.filter((f) => f.severity === "error").map((f) => f.message).join(" | ")); assert.equal(r.stats.open, 0);
  assert.ok(r.stats.minSpace >= 0.2 - 1e-6 && r.stats.minTrack >= 0.25 - 1e-9 && r.stats.minDrill === 0.4 && r.stats.smd === 16 && r.stats.tht === 4);
  assert.ok(rules(r).includes("PCBA-33") && rules(r).includes("PCBA-32") && rules(r).includes("PCBA-35"), "no fiducial, two through-hole headers, the bill of materials line count");
  assert.ok(r.findings.every((f) => f.title && f.message && Array.isArray(f.refs) && Array.isArray(f.nets)));
});

test("copper rules: short circuit, clearance, width, edge — each provoked alone, with its measure", () => {
  const one = (edit) => { const b = routed(); edit(b); return checkBoard(b, LIB); }, only = (r, id) => r.findings.filter((f) => f.severity === "error" && f.rule !== "PCBA-04").map((f) => f.rule).every((x) => x === id) && rules(r, "error").includes(id);
  let r = one((b) => b.tracks.push({ net: "LED_A", layer: "bottom", w: 0.25, pts: [[10, 2], [20, 2]] }, { net: "+5V", layer: "bottom", w: 0.25, pts: [[10, 2.35], [20, 2.35]] }));
  assert.ok(only(r, "PCBA-02")); const f = r.findings.find((x) => x.rule === "PCBA-02"); assert.ok(Math.abs(f.measured - 0.1) < 1e-9 && f.limit === 0.2 && f.layer === "bottom"); assert.match(f.message, /0,1 mm entre .* minimum 0,2 mm/);
  r = one((b) => b.tracks.push({ net: "LED_A", layer: "top", w: 0.25, pts: [[14.5, 13.1], [19, 13.1]] }));           // across the ground pad of U1
  assert.ok(rules(r, "error").includes("PCBA-01")); assert.ok(r.findings.find((x) => x.rule === "PCBA-01").nets.includes("GND")); assert.match(r.findings.find((x) => x.rule === "PCBA-01").message, /se touchent/);
  r = one((b) => b.tracks.push({ net: "LED_A", layer: "bottom", w: 0.1, pts: [[10, 2], [20, 2]] })); assert.ok(only(r, "PCBA-03")); assert.equal(r.findings.find((x) => x.rule === "PCBA-03").limit, 0.15);
  r = one((b) => { b.nets.find((n) => n.name === "+12V").current = 3; }); assert.ok(r.findings.some((x) => x.rule === "PCBA-03" && x.severity === "warn" && /3 A/.test(x.message)), "a net asked for 3 A on tracks sized for 1 A");
  r = one((b) => b.tracks.push({ net: "LED_A", layer: "bottom", w: 0.25, pts: [[0.3, 10], [0.3, 20]] })); assert.ok(only(r, "PCBA-05")); assert.ok(Math.abs(r.findings.find((x) => x.rule === "PCBA-05").measured - 0.175) < 1e-9);
});

test("drilling and placement rules", () => {
  const one = (edit) => { const b = routed(); edit(b); return checkBoard(b, LIB); };
  let r = one((b) => b.vias.push({ net: "LED_A", at: [20, 3], d: 0.4, drill: 0.15 }));
  assert.ok(rules(r, "error").includes("PCBA-10") && rules(r, "error").includes("PCBA-11")); assert.ok(Math.abs(r.findings.find((x) => x.rule === "PCBA-11").measured - 0.125) < 1e-9);
  r = one((b) => b.vias.push({ net: "LED_A", at: [20, 3], d: 0.6, drill: 0.3 }, { net: "LED_A", at: [20.5, 3], d: 0.6, drill: 0.3 })); assert.ok(rules(r, "error").includes("PCBA-12")); assert.ok(Math.abs(r.findings.find((x) => x.rule === "PCBA-12").measured - 0.2) < 1e-9);
  r = one((b) => b.vias.push({ net: "+5V", at: at(b, "C2.1"), d: 0.6, drill: 0.3 })); assert.ok(rules(r, "warn").includes("PCBA-13"));
  r = one((b) => { b.parts.find((p) => p.ref === "R1").at = [33, 12.5]; }); assert.ok(rules(r, "error").includes("PCBA-20")); assert.deepEqual(r.findings.find((x) => x.rule === "PCBA-20").refs, ["R1", "D1"]);
  r = one((b) => { b.parts.find((p) => p.ref === "D1").at = [36, 25]; }); assert.ok(rules(r, "error").includes("PCBA-23"), "a part under the screw head");
  r = one((b) => { b.parts.find((p) => p.ref === "C1").at = [13.5, 29.7]; }); assert.ok(rules(r, "error").includes("PCBA-21"));
  r = one((b) => { b.parts.find((p) => p.ref === "C1").at = [13.5, 28.6]; }); assert.ok(rules(r, "warn").includes("PCBA-22"));
  r = one((b) => { delete b.parts.find((p) => p.ref === "C1").at; }); assert.ok(rules(r, "error").includes("PCBA-24"));
});

test("high voltage, coating, assembly and board rules", () => {
  const hv = () => { const b = routed(); b.nets.push({ name: "+400V", class: "hv", voltage: 400, pins: [] }); b.tracks.push({ net: "+400V", layer: "bottom", w: 0.6, pts: [[10, 3], [20, 3]] }, { net: "LED_A", layer: "bottom", w: 0.25, pts: [[10, 4.425], [20, 4.425]] }); return b; };
  let b = hv(), r = checkBoard(b, LIB);                           // 1 mm of clearance : too little bare (2.5 mm), enough coated (0.8 mm)
  assert.ok(rules(r, "error").includes("PCBA-02")); assert.equal(r.findings.find((x) => x.rule === "PCBA-02").limit, 2.5); assert.ok(rules(r, "info").includes("PCBA-61") && r.findings.some((x) => x.rule === "PCBA-60" && /B2/.test(x.message)));
  b = hv(); b.board.coating = { type: "AR", thickness: 50, sides: "both" }; r = checkBoard(b, LIB);
  assert.ok(!rules(r, "error").includes("PCBA-02")); assert.ok(r.findings.some((x) => x.rule === "PCBA-60" && x.severity === "info" && /A5/.test(x.message))); assert.ok(!rules(r).includes("PCBA-61"));
  b = hv(); b.board.coating = { type: "AR", thickness: 50, sides: "top" }; r = checkBoard(b, LIB); assert.ok(r.findings.some((x) => x.rule === "PCBA-60" && x.severity === "error"), "high-voltage copper on the side left bare");
  b = routed(); b.board.t = 1.5; b.board.copper = 70; b.board.holes = []; b.parts.find((p) => p.ref === "R1").side = "bottom"; b.parts.push({ ref: "R2", comp: "R0603", value: "1,02 kΩ", at: [10, 26] });
  r = checkBoard(b, LIB);
  for (const id of ["PCBA-50", "PCBA-54", "PCBA-31", "PCBA-33"]) assert.ok(rules(r).includes(id), id);
  assert.match(r.findings.find((x) => x.rule === "PCBA-35").message, /1 kΩ et 1,02 kΩ/);
  b = routed(); b.board.layers = 4; assert.ok(rules(checkBoard(b, LIB)).includes("PCBA-51"));
  const fid = (x, y) => ({ ref: `FID${x}`, comp: "FID", at: [x, y] }); b = routed(); b.library = { FID: { id: "FID", kind: "fiducial", prefix: "FID", name: "Mire", pins: [{ n: "1", name: "F", type: "nc" }], pads: [{ n: "1", x: 0, y: 0, w: 1, h: 1, shape: "round" }], body: [1, 1, 0.04], courtyard: [3, 3], coat: false } };
  b.parts.push(fid(10, 26), fid(30, 26), fid(20, 3)); assert.ok(!rules(checkBoard(b, LIB)).includes("PCBA-33"), "three fiducials on the populated side");
});

test("speed: three thousand track segments are checked in well under two seconds", () => {
  const b = smallBoard(); b.board.size = [200, 200]; b.board.holes = [{ at: [150, 150], d: 3.2, land: 6 }, { at: [160, 150], d: 3.2, land: 6 }];
  for (let i = 0; i < 300; i++) b.tracks.push({ net: i % 2 ? "LED_A" : "+5V", layer: "bottom", w: 0.25, pts: Array.from({ length: 11 }, (_, k) => [45 + k * 14, 45 + i * 0.45 + (k % 2) * 0.01]) });
  const t0 = Date.now(), r = checkBoard(b, LIB), ms = Date.now() - t0;
  console.log(`  ${r.stats.tracks} tracks (${300 * 10} segments), ${r.stats.checked} pairs measured, ${ms} ms`);
  assert.ok(ms < 2000); assert.ok(r.stats.checked > 2000); assert.ok(!rules(r, "error").includes("PCBA-02"), "0.25 mm tracks every 0.45 mm keep exactly the 0.2 mm they need");
});
