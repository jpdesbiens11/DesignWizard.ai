/* Busbars : plain through holes, round or oblong, laid on the flat part of a leg — and the face of a leg as the mouse sees it. */
import test from "node:test";
import assert from "node:assert/strict";
import { blankBusbar, busbarPart, busbarChecks, addHole, fitHole, addContact, legFace, legsOf, connections, locate } from "../../web/js/core/busbar.js";
import { snapPoint } from "../../web/js/core/snap.js";
import { buildPart } from "../../web/js/cad/build.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test("a hole takes the next number, sits on the centre line by default and stays on the flat part", () => {
  const d = blankBusbar(), h1 = addHole(d, { leg: 0, s: 40 }), h2 = addHole(d, { leg: 0, s: 59, y: 19.5 }, { d: 5 });
  assert.deepEqual(h1, { id: "H1", leg: 0, s: 40, y: 10, d: 6.6 }); assert.equal(h2.id, "H2");
  const g = legsOf(d)[0]; assert.ok(h2.s <= g.to - 2.5 - 1 + 1e-9 && h2.y <= d.W - 2.5 - 1 + 1e-9, "a millimetre of metal is kept around it");
  d.holes = d.holes.filter((h) => h.id !== "H1"); assert.equal(addHole(d, { leg: 0, s: 30 }).id, "H3", "a number is never given twice");
  const wide = fitHole(d, { id: "H9", leg: 0, s: 30, y: 2, d: 19.5 }); assert.equal(wide.y, 10, "a hole as wide as the bar can only sit on its axis");
  assert.deepEqual(connections(d).map((x) => `${x.id}:${x.kind}`), ["T1:terminal", "H2:hole", "H3:hole"]);
});

test("the part drills them : a round hole, an oblong along the leg, an oblong across — on any leg", async () => {
  const K = await kernel(), d = blankBusbar(), before = buildPart(K, busbarPart(d, "BB-1")).volume;
  addHole(d, { leg: 0, s: 40 }); addHole(d, { leg: 2, s: 30, y: 6 }, { d: 5, l: 12 }); addHole(d, { leg: 1, s: 15 }, { d: 4, l: 9, turn: 1 });
  const part = busbarPart(d, "BB-1"), b = buildPart(K, part);
  assert.deepEqual(b.log.filter((l) => l.level === "error"), []);
  assert.deepEqual(part.features.filter((f) => /^trou_/.test(f.id)).map((f) => [f.id, f.op, f.name]), [["trou_h1", "hole", "Trou de passage H1"], ["trou_h2", "slot", "Trou oblong H2"], ["trou_h3", "slot", "Trou oblong H3"]]);
  const gone = Math.PI * 3.3 ** 2 * 3 + (Math.PI * 2.5 ** 2 + 7 * 5) * 3 + (Math.PI * 2 ** 2 + 5 * 4) * 3;
  assert.ok(near(before - b.volume, gone, 1e-3), "what is removed is the three prisms, through the thickness");
  assert.deepEqual(busbarChecks(d).notes, []); assert.deepEqual(fromDwiz(toDwiz(part)).busbar.holes, part.busbar.holes, "the holes travel in the file");
  // under a sleeve, the hole goes through the sleeve too
  const ins = { ...blankBusbar(), insulation: { material: "PET-FILM", t: 0.19 } }; addHole(ins, { leg: 0, s: 40 });
  assert.equal(busbarPart(ins, "BB-2").features.find((f) => f.id === "trou_h1").bodies, "all"); assert.deepEqual(buildPart(K, busbarPart(ins, "BB-2")).log.filter((l) => l.level === "error"), []);
});

test("a hole that leaves too little copper is said", () => {
  const d = blankBusbar(); addHole(d, { leg: 0, s: 40 }, { d: 16 });
  const n = busbarChecks(d).notes.map((x) => `${x.level} ${x.text}`);
  assert.ok(n.some((t) => /^check H1 : au droit du trou il reste 4 mm de large — 8,33 A\/mm²/.test(t)) && n.some((t) => /moins d'une épaisseur \(3 mm\) de métal entre le trou et le bord/.test(t)));
  const cut = blankBusbar(); cut.holes = [{ id: "H1", leg: 0, s: 40, y: 10, d: 20 }]; assert.ok(busbarChecks(cut).notes.some((x) => x.level === "bad" && /coupe la barre/.test(x.text)));
  const end = blankBusbar(); end.holes = [{ id: "H1", leg: 0, s: 6, y: 10, d: 6.6 }]; assert.ok(busbarChecks(end).notes.some((x) => /à moins de 1,5 × d du bout/.test(x.text)));
  const two = blankBusbar(); two.holes = [{ id: "H1", leg: 0, s: 40, y: 10, d: 6.6 }, { id: "H2", leg: 0, s: 43, y: 10, d: 6.6 }]; assert.deepEqual(busbarChecks(two).notes.filter((x) => /chevauche/.test(x.text)).map((x) => x.text), ["H1 : chevauche H2."]);
  const gone = blankBusbar(); gone.holes = [{ id: "H1", leg: 7, s: 4, y: 10, d: 5 }]; assert.ok(busbarChecks(gone).notes.some((x) => x.level === "bad" && /sa branche n'existe plus/.test(x.text)));
});

test("the face of a leg, as the mouse sees it : along the leg and across, where a feature may sit, its neighbours, its points in space", () => {
  const d = blankBusbar(); addHole(d, { leg: 0, s: 40 }); const c = addContact(d, { leg: 1, side: -1, s: 15 });
  const f = legFace(d, { leg: 0, side: 1 }, [4.3, 4.3]);
  assert.deepEqual([f.u, f.v, f.keep.u, f.keep.v], [[0, 60], [0, 20], [4.3, 49.2], [4.3, 15.7]]); assert.deepEqual(f.others, [{ id: "T1", u: 12, v: 10 }, { id: "H1", u: 40, v: 10 }]);
  assert.deepEqual(f.P(10, 5).map((x) => Math.round(x * 100) / 100), [10, 5, 3.04], "just above the top face of the first leg"); assert.equal(legFace(d, { leg: 0, side: 1 }, [0, 0], "H1").others.length, 1, "a feature being moved is not its own neighbour");
  const up = legFace(d, { leg: 1, side: -1 }), p = up.P(c.s, c.y), back = locate(d, [p[0] + 0.04 * (p[0] > 60 ? -1 : 1), p[1], p[2]], [p[0] > 60 ? 1 : -1, 0, 0]);
  assert.ok(back && back.leg === 1 && back.side === -1 && Math.abs(back.s - c.s) < 0.01, "a point of the face is found again on the same leg, side and place"); assert.equal(legFace(d, { leg: 9, side: 1 }), null);
  // dropped near the middle of the bar : the symmetry axis takes it ; near the hole along the bar : the hole's line
  const s = snapPoint([41.1, 10.6], f); assert.deepEqual([s.u, s.v, s.snap.u.kind, s.snap.u.ref, s.snap.v.kind], [40, 10, "align", "H1", "axis"]);
});
