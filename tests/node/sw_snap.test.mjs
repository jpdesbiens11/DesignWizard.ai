/* Snapping the pieces by hand (JP, 25 novembre 2026 : « déconnecter et connecter les blocs à la souris… pour les grands blocs, il prendrait de la
   hauteur si on branche le dernier connecteur, si c'est possible de l'agrandir ; pour un bloc fermé in/out, aucune expansion »).
   node --test tests/node/sw_snap.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { moduleDesign } from "../../web/js/sw/sw_bm_design.js";
import { pieces, puzzleForest, SNAP } from "../../web/js/sw/sw_puzzle.js";
import { freeSlots, connectTo, detach, growable, growFrom, growInto } from "../../web/js/sw/sw_snap.js";
import { machine, problems } from "../../web/js/sw/sw_design.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

test("free sockets : every input no wire reaches, keyed by its type, under what is snapped", () => {
  const d = clone(moduleDesign()); d.wires = d.wires.filter((w) => w.to !== "latch.reset"); const P = pieces(d), latch = P.find((p) => p.members.includes("latch"));
  const s = freeSlots(d, latch).find((q) => q.ref === "latch.reset"); assert.ok(s && s.type === "bool", "the reset of the fault latch, free, keyed as a decision");
  const F = puzzleForest(d, P), n = F.nodes.find((q) => q.id === latch.id && !q.twin); assert.ok(n.slots.length >= 1 && n.slots.every((q) => q.y > n.body), "under the body of what is snapped");
  assert.equal(n.h, n.body + n.slots.length * SNAP.SLOT, "the piece is taller by its sockets");
});

test("unplug, then plug back by hand : the same wire ; a key that does not fit is refused with its reason", () => {
  const d = clone(moduleDesign()), P = pieces(d), ws = detach(d, P, "ov", "v_fault"); assert.deepEqual(ws.map((w) => [w.from, w.to]), [["ov.trip", "v_fault.a"]], "Over-voltage feeds « Voltage fault » once");
  d.wires = d.wires.filter((w) => !ws.includes(w)); const P2 = pieces(d), sock = freeSlots(d, P2.find((p) => p.id === "v_fault")).find((q) => q.ref === "v_fault.a"); assert.ok(sock, "the socket is free again");
  assert.deepEqual(connectTo(d, P2, "ov", sock.ref).wires, [{ from: "ov.trip", to: "v_fault.a" }], "plugged back : the same wire");
  const e = clone(moduleDesign()); e.wires = e.wires.filter((w) => w.to !== "ov.value"); const bad = connectTo(e, pieces(e), "hvw", "ov.value");
  assert.equal(bad.wires.length, 0, "a decision 0 / 1 does not enter a voltage"); assert.match(bad.why, /unités/);
});

test("a gate AND / OR / XOR grows in cascade when its inputs are full — one piece, one input more, the same decision ; every other kind is closed", () => {
  const d = clone(moduleDesign()), head = d.objects.find((o) => o.kind === "logic" && o.params && o.params.op === "OR"); assert.ok(head, "an OR gate in the module");
  const P = pieces(d), hp = P.find((p) => p.members.includes(head.id)); assert.ok(freeSlots(d, hp).some((q) => q.grow), "full : the socket « + »");
  assert.equal(growable(d.objects.find((o) => o.kind === "fault_latch")), false, "a fault latch is closed"); assert.equal(growable({ kind: "logic", params: { op: "NOT" } }), false, "NOT does not grow");
  const from = growFrom(d, P, "lost", head.id) || growFrom(d, P, P.find((p) => p.band === "decide" && p.id !== hp.id && !p.members.includes(head.id)).id, head.id); assert.ok(from, "a decision may grow it");
  const N = growInto(d, head.id, from); assert.equal(N.grownOf, head.id); assert.deepEqual(problems(d).filter((x) => x.level === "error"), [], "the design stays sound");
  const P2 = pieces(d), g = P2.find((p) => p.id === head.id); assert.ok(g.members.includes(N.id) && /\(3 entrées\)/.test(g.title), "one piece, three inputs"); assert.ok(!P2.some((p) => p.id === N.id), "the cascade gate is no piece of its own");
  const m = machine(d); m.step(() => 0); assert.ok(Number.isFinite(m.dt), "it runs");
});
