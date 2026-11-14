/* PCBA: copper laid by hand — the designer finishes what the router leaves, and nothing is laid that breaks a rule. */
import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { connectivity } from "../../web/js/pcba/connect.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { autoroute, clearRoutes } from "../../web/js/pcba/route.js";
import { copperFaults, pickCopper, snapPoint, angle45, penOf, addTrack, addVia, removeCopper, keepCopper, moveCorner } from "../../web/js/pcba/manual.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { clearanceViolations } from "./pcba_fixture.mjs";

const open = (b) => connectivity(resolveBoard(b, LIBRARY)).open;

test("a link is drawn by hand, pad to pad : snapped, checked, kept by the router", () => {
  const b = demoBoard(), R0 = resolveBoard(b, LIBRARY), net = R0.nets.find((n) => !R0.planes.some((p) => p.net === n.name) && n.class === "signal" && n.pads.length === 2 && n.pads.every((i) => !R0.pads[i].drill && R0.pads[i].side === "top")).name;
  clearRoutes(b, { nets: [net] }); assert.equal(open(b), 1, "one link is open again");
  const R = resolveBoard(b, LIBRARY), [pa, pb] = R.nets.find((n) => n.name === net).pads.map((i) => R.pads[i]), pen = penOf(b, LIBRARY, net); assert.ok(pen.w >= 0.15 && pen.via[0] > pen.via[1]);
  const s0 = snapPoint(b, LIBRARY, [pa.x + 0.1, pa.y - 0.05], { net, layer: "top" }); assert.equal(s0.on, "pad"); assert.deepEqual(s0.at, [pa.x, pa.y]); assert.equal(s0.pin, pa.pin);
  assert.equal(snapPoint(b, LIBRARY, [3.07, 30.04], { net: "INEXISTANT" }).on, "grid"); assert.deepEqual(snapPoint(b, LIBRARY, [3.07, 30.04], { net: "INEXISTANT" }).at, [3.125, 30]);
  assert.deepEqual(angle45([0, 0], [5, 0.3]), [5, 0]); assert.deepEqual(angle45([0, 0], [0.2, -4]), [0, -4]); assert.deepEqual(angle45([0, 0], [3, 2]), [2.5, 2.5]); assert.deepEqual(angle45([1, 1], [1, 1]), [1, 1]);
  // the router finds the way ; the same way is then laid by hand, piece by piece
  const auto = JSON.parse(JSON.stringify(b)); autoroute(auto, LIBRARY, { nets: [net], keep: true, maxMs: 20000 }); const ways = auto.tracks.filter((t) => t.net === net), vias = auto.vias.filter((v) => v.net === net); assert.ok(ways.length >= 1 && open(auto) === 0);
  for (const v of vias) assert.ok(addVia(b, LIBRARY, { net, at: v.at }).ok);
  for (const t of ways) { const r = addTrack(b, LIBRARY, { net, layer: t.layer, pts: t.pts, w: t.w }); assert.ok(r.ok, JSON.stringify(r.faults)); }
  assert.equal(open(b), 0); assert.ok(b.tracks.filter((t) => t.net === net).every((t) => !t.auto), "hand copper carries no auto mark");
  clearRoutes(b, { nets: [net] }); assert.equal(open(b), 0, "the router does not take hand copper away"); assert.deepEqual(clearanceViolations(b, LIBRARY), []); assert.equal(checkBoard(b, LIBRARY).summary.error, 0);
  const nv = b.vias.length, spot = [pa.x, pa.y - 30 < 2 ? pa.y + 3 : pa.y]; if (vias.length) { assert.ok(addVia(b, LIBRARY, { net, at: vias[0].at }).ok); assert.equal(b.vias.length, nv, "a via laid twice is laid once"); } assert.ok(spot);
});

test("what breaks a rule is refused, with the reason ; pieces are picked, kept, moved and removed", () => {
  const b = demoBoard(), R = resolveBoard(b, LIBRARY), u = R.pads.find((p) => p.name === "PA0"), nb = R.pads.find((p) => p.ref === u.ref && p.net && p.net !== u.net && Math.hypot(p.x - u.x, p.y - u.y) < 0.6), n0 = b.tracks.length;
  const across = addTrack(b, LIBRARY, { net: u.net, layer: "top", pts: [[u.x, u.y], [nb.x, nb.y]] }); assert.equal(across.ok, false); assert.match(across.faults[0].text, /mm de la pastille .* : il en faut 0,(15|2)/); assert.equal(b.tracks.length, n0, "nothing is laid");
  assert.match(addTrack(b, LIBRARY, { net: u.net, layer: "in1", pts: [[u.x, u.y], [u.x - 2, u.y]] }).faults[0].text, /plan/); assert.match(addTrack(b, LIBRARY, { net: "RIEN", layer: "top", pts: [[1, 1], [2, 2]] }).faults[0].text, /n'existe pas/);
  assert.match(addTrack(b, LIBRARY, { net: u.net, layer: "bottom", pts: [[30, 45], [30, 200]] }).faults.map((f) => f.text).join(" "), /bord de la carte/); assert.match(addTrack(b, LIBRARY, { net: u.net, layer: "top", pts: [[1, 1]] }).faults[0].text, /deux points/);
  const hole = b.board.holes[0].at; assert.ok(copperFaults(b, LIBRARY, u.net, { at: [hole[0] + 2, hole[1]], d: 0.6, drill: 0.3 }).some((f) => /trou de fixation/.test(f.text)));
  const v0 = b.vias[0]; assert.ok(copperFaults(b, LIBRARY, v0.net === "GND" ? "+3V3" : "GND", { at: [v0.at[0] + 0.5, v0.at[1]], d: 0.6, drill: 0.3 }).length >= 1, "a via too close to another via");
  // pick : a pad, a via, a track
  const p = pickCopper(b, LIBRARY, [u.x, u.y]); assert.equal(p.pin, u.pin); assert.equal(p.net, u.net); assert.equal(pickCopper(b, LIBRARY, v0.at).via, 0);
  const mids = b.tracks.map((t) => { let k = 1; for (let i = 2; i < t.pts.length; i++) if (Math.hypot(t.pts[i][0] - t.pts[i - 1][0], t.pts[i][1] - t.pts[i - 1][1]) > Math.hypot(t.pts[k][0] - t.pts[k - 1][0], t.pts[k][1] - t.pts[k - 1][1])) k = i; return { t, mid: [(t.pts[k][0] + t.pts[k - 1][0]) / 2, (t.pts[k][1] + t.pts[k - 1][1]) / 2] }; });
  const long = mids.find((m) => { const q = pickCopper(b, LIBRARY, m.mid, [m.t.layer]); return q && q.track !== undefined && b.tracks[q.track] === m.t; }), pk = pickCopper(b, LIBRARY, long.mid, [long.t.layer]); assert.ok(pk.net === long.t.net && pk.layer === long.t.layer);
  assert.equal(pickCopper(b, LIBRARY, long.mid, [long.t.layer === "top" ? "bottom" : "top"]) === null || pickCopper(b, LIBRARY, long.mid, [long.t.layer === "top" ? "bottom" : "top"]).track !== pk.track, true, "a track is picked on the layers shown only"); assert.equal(pickCopper(b, LIBRARY, [-5, -5]), null);
  // keep : a piece laid by the router becomes the designer's
  assert.ok(b.tracks[pk.track].auto); keepCopper(b, pk); assert.ok(!b.tracks[pk.track].auto); const kept = b.tracks[pk.track]; clearRoutes(b, { nets: [kept.net] }); assert.ok(b.tracks.includes(kept)); keepCopper(b, { track: b.tracks.indexOf(kept) }, false); assert.ok(kept.auto);
  // move a corner : refused onto a neighbour, accepted in free space (and the track becomes the designer's)
  const c = demoBoard(), k = c.tracks.findIndex((t) => t.pts.length >= 3), t = c.tracks[k], before = JSON.stringify(t.pts), bad = moveCorner(c, LIBRARY, k, 1, [u.x, u.y]);
  if (t.net !== u.net) { assert.equal(bad.ok, false); assert.equal(JSON.stringify(t.pts), before); }
  const same = moveCorner(c, LIBRARY, k, 1, t.pts[1]); assert.ok(same.ok && !t.auto); assert.equal(moveCorner(c, LIBRARY, 9999, 0, [0, 0]).ok, false);
  const n = c.tracks.length, m = c.vias.length; assert.ok(removeCopper(c, { track: k }) && removeCopper(c, { via: 0 })); assert.equal(c.tracks.length, n - 1); assert.equal(c.vias.length, m - 1); assert.equal(removeCopper(c, { track: 9999 }), false);
});
