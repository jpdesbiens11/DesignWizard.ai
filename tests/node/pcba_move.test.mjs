/* PCBA: a sub-circuit moves as one brick — its own copper follows, the links to the rest are laid again, nothing is cleaned by hand. */
import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { connectivity } from "../../web/js/pcba/connect.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { zoneProblems, placementProblems } from "../../web/js/pcba/place.js";
import { flowStatus } from "../../web/js/pcba/status.js";
import { erc } from "../../web/js/pcba/erc.js";
import { moveGroup, blockRefs, groupNets, pruneCopper, followMoves } from "../../web/js/pcba/move.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";

const open = (b) => connectivity(resolveBoard(b, LIBRARY)).open, at = (b, ref) => b.parts.find((p) => p.ref === ref).at;
const reconnect = (b, m) => { const r = autoroute(b, LIBRARY, { nets: m.nets, keep: true, maxMs: 20000, passes: 2 }); pruneCopper(b, LIBRARY, m.nets); return r; };

test("a block moves with its own copper ; what tied it to the rest is taken away and laid again", () => {
  const b = demoBoard(), refs = blockRefs(b, "B7"), R = resolveBoard(b, LIBRARY), nets = groupNets(R, refs), before = JSON.parse(JSON.stringify(b));
  assert.equal(refs.length, 7); assert.ok(nets.inside.length >= 1 && nets.crossing.length >= 5, "a CAN block has a net of its own and several shared ones");
  assert.deepEqual(pruneCopper(JSON.parse(JSON.stringify(b)), LIBRARY, b.nets.map((n) => n.name)), { removed: 0, trimmed: 0 }, "a finished board has no dead end");
  const own = before.tracks.filter((t) => nets.inside.includes(t.net)), m = moveGroup(b, LIBRARY, refs, { delta: [-1, 0.5], block: "B7" });
  assert.ok(!m.refused); assert.equal(m.parts, 7); assert.ok(m.tracks >= own.length && m.vias > 0 && m.ripped > 0); assert.equal(m.clashes, 0);
  for (const r of refs) assert.deepEqual(at(b, r), [at(before, r)[0] - 1, at(before, r)[1] + 0.5]);
  const t0 = own[0], t1 = b.tracks.find((t) => t.net === t0.net && Math.abs(t.pts[0][0] - (t0.pts[0][0] - 1)) < 1e-6 && Math.abs(t.pts[0][1] - (t0.pts[0][1] + 0.5)) < 1e-6); assert.ok(t1, "its own track moved by the same vector");
  for (const p of before.parts) if (!refs.includes(p.ref)) assert.deepEqual(at(b, p.ref), p.at, "nothing else moved");
  const left = open(b); assert.ok(left > 0 && left <= 12, "only the links of the block are open"); for (const n of connectivity(resolveBoard(b, LIBRARY)).nets) if (n.open) assert.ok(m.nets.includes(n.name), n.name);
  const kept = before.tracks.filter((t) => !m.nets.includes(t.net)).length; assert.equal(b.tracks.filter((t) => !m.nets.includes(t.net)).length, kept, "the copper of the other nets is untouched");
  const r = reconnect(b, m); assert.equal(r.failed.length, 0); assert.equal(open(b), 0); const d = checkBoard(b, LIBRARY); assert.equal(d.summary.error, 0, JSON.stringify(d.findings.filter((f) => f.severity === "error").slice(0, 2)));
  assert.equal(placementProblems(b, LIBRARY).length, 0); assert.equal(flowStatus(b, { erc: erc(b, LIBRARY), zones: zoneProblems(b, LIBRARY), placement: [], drc: d }).steps.find((s) => s.key === "cdr").state, "done", "the board is still ready for its review");
});

test("a block turns about its middle ; a single part moves the same way ; what cannot move is refused", () => {
  const b = demoBoard(), before = JSON.parse(JSON.stringify(b)), refs = blockRefs(b, "B9"), m = moveGroup(b, LIBRARY, refs, { turn: 90, block: "B9" });
  assert.ok(!m.refused && m.parts === refs.length); for (const r of refs) assert.equal(b.parts.find((p) => p.ref === r).rot, ((before.parts.find((p) => p.ref === r).rot || 0) + 90) % 360);
  const R0 = resolveBoard(before, LIBRARY), R1 = resolveBoard(b, LIBRARY), span = (R, k) => { const ps = R.parts.filter((p) => refs.includes(p.ref)); return Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k])); };
  assert.ok(Math.abs(span(R0, "x") - span(R1, "y")) < 0.3 && Math.abs(span(R0, "y") - span(R1, "x")) < 0.3, "the brick is the same, a quarter turn further");
  reconnect(b, m); assert.equal(open(b), 0); assert.equal(checkBoard(b, LIBRARY).summary.error, 0);
  const one = demoBoard(), ref = blockRefs(one, "B4")[0], m1 = moveGroup(one, LIBRARY, [ref], { delta: [0.5, 0] }); assert.equal(m1.parts, 1); assert.ok(m1.nets.length >= 1); reconnect(one, m1); assert.equal(open(one), 0);
  const far = demoBoard(); assert.match(moveGroup(far, LIBRARY, blockRefs(far, "B9"), { delta: [500, 0] }).refused, /sortirait/); assert.deepEqual(far, demoBoard(), "a refused move changes nothing");
  const fixed = demoBoard(), j = fixed.parts.find((p) => p.block === "B9"); j.fixed = true; assert.match(moveGroup(fixed, LIBRARY, [j.ref], { delta: [1, 0] }).refused, /imposées/); assert.ok(!blockRefs(fixed, "B9").includes(j.ref));
  const was = [...j.at], mf = moveGroup(fixed, LIBRARY, fixed.parts.filter((p) => p.block === "B9").map((p) => p.ref), { delta: [0, 1] }); assert.equal(mf.parts, blockRefs(fixed, "B9").length); assert.deepEqual(j.at, was, "an imposed position stays where it is while its block moves");
});

test("dead ends are pruned : a stub, a lone via, the tail of a track beyond its last junction — locked copper stays", () => {
  const b = demoBoard(), n0 = b.tracks.length, v0 = b.vias.length, net = b.tracks[0].net, layer = b.tracks[0].layer, end = b.tracks[0].pts[b.tracks[0].pts.length - 1];
  b.tracks.push({ net, layer, w: 0.2, pts: [[2.6, 50], [2.6, 52]], auto: true }); b.vias.push({ net, at: [2.6, 54], d: 0.6, drill: 0.3, auto: true }); b.tracks.push({ net, layer, w: 0.2, pts: [[2.6, 56], [2.6, 57]], locked: true });
  const r = pruneCopper(b, LIBRARY, [net]); assert.equal(r.removed, 2); assert.equal(b.tracks.length, n0 + 1); assert.equal(b.vias.length, v0); assert.ok(b.tracks.some((t) => t.locked));
  assert.ok(end && open(b) === 0, "the real copper of the net is still there");
});

test("an artefact comes back with parts moved (an AI did it) : their copper follows, their links are laid again", () => {
  const before = demoBoard(), refs = blockRefs(before, "B8"), text = toDwiz(before), after = fromDwiz(text);
  for (const p of after.parts) if (refs.includes(p.ref)) p.at = [p.at[0], p.at[1] + 1.25];      // what « move the NTC block 1.25 mm up » comes back as : positions only
  const f = followMoves(before, after, LIBRARY); assert.deepEqual([...f.moved].sort(), [...refs].sort()); assert.ok(f.nets.length > 0);
  for (const r of refs) assert.deepEqual(after.parts.find((p) => p.ref === r).at, [before.parts.find((p) => p.ref === r).at[0], before.parts.find((p) => p.ref === r).at[1] + 1.25]);
  const m = { nets: f.nets }; reconnect(after, m); assert.equal(open(after), 0); assert.equal(checkBoard(after, LIBRARY).summary.error, 0);
  const same = fromDwiz(text); assert.deepEqual(followMoves(before, same, LIBRARY), { moved: [], nets: [] }, "nothing moved, nothing touched"); assert.deepEqual(same, before);
  const redrawn = fromDwiz(text); redrawn.parts.find((p) => p.ref === refs[0]).at[0] += 1; redrawn.tracks.pop(); assert.deepEqual(followMoves(before, redrawn, LIBRARY).moved, [], "an answer that redraws the copper is taken as it is");
  const turned = fromDwiz(text), u = turned.parts.find((p) => p.ref === refs[0]); u.rot = ((u.rot || 0) + 180) % 360; const ft = followMoves(before, turned, LIBRARY); assert.deepEqual(ft.moved, [u.ref]); assert.equal(turned.parts.find((p) => p.ref === u.ref).rot, u.rot);
});
