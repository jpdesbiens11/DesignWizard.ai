/* A mate, shown : whatever the kind of interface — bolt pattern, dowel pins, fit, planar contact, bond, cut-out, rail, weld,
   pressure contact — a mate has a definition (two sides, a plane, facts), solids for its hardware and a schematic section.
   Checked on pairs of plates built by the real kernel, and on the Rover. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { INTERFACE_TYPES } from "../../web/js/cad/interfaces.js";
import { solve } from "../../web/js/core/assembly_logic.js";
import { mateDefinition, mateSolids, mateSection, MATE_COLORS } from "../../web/js/core/mate_view.js";
import { DEMO_ROVER } from "../../web/js/demo/demo_rover.js";

const plate = (id, t, iface) => ({ dw: "part/1", id, name: id, family: "plate", process: "cnc_milling", material: "AL6061-T6", features: [{ op: "box", size: [80, 40, t] }, { op: "interfaces" }], interfaces: [iface] });
/* a 4 mm plate (side A, the screw enters it) on a 12 mm base (side B) : the mate is written base first, to check that side A is found */
async function pair(type, params = {}, optsA = {}, optsB = {}, moreB = {}) {
  const K = await kernel(), I = (side, face, opts) => ({ id: "IF1", type, key: "k1", name: side === "A" ? "Dessus" : "Dessous", side, face, at: [40, 20], params, opts });
  const built = { BASE: buildPart(K, plate("BASE", 12, { ...I("B", "+Z", optsB), ...moreB })), TOP: buildPart(K, plate("TOP", 4, I("A", "-Z", optsA))) };
  for (const [k, b] of Object.entries(built)) assert.deepEqual(b.log.filter((l) => l.level === "error"), [], `${type} ${k}`);
  const asm = { dw: "assembly/1", id: "A1", name: "Paire", instances: [{ id: "base", part: "BASE", fixed: true }, { id: "top", part: "TOP" }], mates: [{ id: "M1", a: { inst: "base", iface: "IF1" }, b: { inst: "top", iface: "IF1" }, linked: true, by: "key" }] };
  const sol = solve(asm, built); assert.deepEqual(sol.problems, [], type);
  const def = mateDefinition(asm, built, sol.placements, asm.mates[0], { base: "Socle", top: "Plaque" });
  return { asm, built, sol, def, solids: mateSolids(def), section: mateSection(def) };
}
const fact = (def, k) => (def.facts.find((f) => f[0] === k) || [])[1] || "", cyls = (s) => s.filter((x) => x.shape === "cyl"), loops = (s) => s.filter((x) => x.shape === "loop");
const texts = (sec) => sec.items.filter((p) => p.t === "text").map((p) => p.s).join(" | ");
const span = (loop, axis) => Math.round((Math.max(...loop.pts.map((q) => q[axis])) - Math.min(...loop.pts.map((q) => q[axis]))) * 100) / 100;
/* every primitive of a section stays inside its frame */
function inside(sec) {
  for (const p of sec.items) {
    const xs = p.t === "rect" ? [p.x, p.x + p.w] : p.t === "line" ? [p.x1, p.x2] : p.t === "poly" ? p.pts.map((q) => q[0]) : [p.x], ys = p.t === "rect" ? [p.y, p.y + p.h] : p.t === "line" ? [p.y1, p.y2] : p.t === "poly" ? p.pts.map((q) => q[1]) : [p.y];
    for (const x of xs) assert.ok(x >= 0 && x <= sec.w, `x ${x} of a ${p.t}`); for (const y of ys) assert.ok(y >= 0 && y <= sec.h, `y ${y} of a ${p.t}`);
  }
}

test("a bolted joint is shown whole : every screw with its head, the thread that takes it, the grip, the tolerance", async () => {
  const rect = { type: "rect", nx: 2, ny: 2, dx: 60, dy: 24 };
  const { def, solids, section } = await pair("bolt_pattern", { screw: "M3", pattern: rect });
  assert.equal(def.type, "bolt_pattern"); assert.equal(def.label, "Bolt pattern"); assert.equal(def.same, true);
  assert.deepEqual([def.A.inst, def.A.name, def.B.inst, def.B.name], ["top", "Plaque", "base", "Socle"], "side A is the plate the screw enters, whichever side the mate names first");
  assert.deepEqual(def.frame.o, [40, 20, 12]); assert.deepEqual(def.frame.n.map((x) => Math.round(x)), [0, 0, -1], "the normal leaves part A toward part B");
  assert.equal(def.grip, 4); assert.equal(def.pts.length, 4); assert.deepEqual(def.pts.map((q) => q[2]), [12, 12, 12, 12]);
  assert.deepEqual(def.pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), [[10, 8], [10, 32], [70, 8], [70, 32]]);
  assert.match(fact(def, "Screws"), /^4 × Socket head cap screw ISO 4762 M3 × \d+$/); assert.match(fact(def, "Pattern"), /2 × 2, entraxes 60 × 24 mm/);
  assert.match(fact(def, "Side A — clearance hole"), /Ø 3,4 \(medium fit\), débouchant/); assert.match(fact(def, "Side B — thread"), /tapped hole M3 — avant-trou Ø 2,5/); assert.match(fact(def, "Grip"), /^4 mm/); assert.match(fact(def, "Position tolerance"), /Ø 0,\d+ au maximum de matière/);
  // four screws : a head that sits on the far face of the plate, a shank that goes down through it into the base
  assert.equal(solids.length, 8); assert.equal(loops(solids).length, 0);
  const heads = solids.filter((s) => /^tête/.test(s.what)), shanks = solids.filter((s) => /^vis/.test(s.what)), L = def.hardware.find((h) => h.kind === "screw").length;
  assert.equal(heads.length, 4); assert.equal(shanks.length, 4);
  for (const h of heads) { assert.equal(h.a[2], 16); assert.equal(h.b[2], 19, "an M3 cap head is 3 mm high"); assert.equal(h.r, 2.75); assert.equal(h.color, MATE_COLORS.screw); }
  for (const s of shanks) { assert.equal(s.a[2], 16); assert.equal(s.b[2], 16 - L); assert.equal(s.r, 1.5); assert.ok(s.b[2] >= 0, "the screw stays inside the base"); }
  inside(section); assert.match(texts(section), /Bolt pattern/); assert.match(texts(section), /clearance Ø 3,4/); assert.match(texts(section), /tapped M3/); assert.match(texts(section), /grip 4/); assert.deepEqual(section.items.filter((p) => p.t === "text" && p.weight === 700).map((p) => p.s), ["Bolt pattern", "A", "B"], "the two sides are named as on the card");
});

test("the variants of a bolted joint : insert on a standoff under a counterbore, nut behind a clearance hole, countersunk head", async () => {
  const one = { type: "circle", n: 3, pcd: 20 };
  const a = await pair("bolt_pattern", { screw: "M3", pattern: one }, { head: "cbore" }, { thread: "insert", standoff: { h: 5, d: 8 } }, { level: 17 });
  assert.deepEqual(a.def.frame.o, [40, 20, 17], "the plate sits on the top of the standoffs"); assert.match(fact(a.def, "Pattern"), /3 sur un cercle Ø 20/);
  assert.match(fact(a.def, "Side A — clearance hole"), /counterbore Ø 6,5/); assert.match(fact(a.def, "Side B — thread"), /heat-set insert M3 — trou Ø 4/); assert.match(fact(a.def, "Side B — standoff"), /5 mm de haut, Ø 8/);
  assert.equal(a.solids.length, 9, "three heads, three shanks, three inserts"); const ins = a.solids.filter((s) => /^insert/.test(s.what)); assert.equal(ins.length, 3);
  for (const s of ins) { assert.equal(s.a[2], 17); assert.ok(s.b[2] < 17, "the insert goes down into the standoff"); assert.equal(s.color, MATE_COLORS.insert); }
  const head = a.solids.find((s) => /^tête/.test(s.what)); assert.ok(head.a[2] < 21 && head.b[2] < head.a[2] + 3.01 && head.a[2] > 17, "the head is sunk in its counterbore");
  inside(a.section); assert.match(texts(a.section), /insert M3/); assert.match(texts(a.section), /standoff 5 mm/);
  const b = await pair("bolt_pattern", { screw: "M3", pattern: { type: "single" } }, {}, { thread: "clearance" });
  assert.match(fact(b.def, "Side B — thread"), /clearance hole Ø 3,4 et hex nut M3/); assert.match(fact(b.def, "Pattern"), /1 point/); assert.equal(b.solids.length, 3); const nut = b.solids.find((s) => /^écrou/.test(s.what)); assert.ok(nut && nut.color === MATE_COLORS.nut);
  assert.ok(b.def.hardware.some((h) => h.kind === "nut"), "the nut is in the hardware of the joint"); inside(b.section); assert.match(texts(b.section), /nut M3/);
  const c = await pair("bolt_pattern", { screw: "M4", pattern: { type: "points", pts: [[-20, 0], [20, 0]] } }, { head: "csink" });
  assert.match(fact(c.def, "Side A — clearance hole"), /countersink Ø [\d,]+ à 90°/); assert.match(fact(c.def, "Pattern"), /2 points/); assert.ok(c.solids.some((s) => /^tête fraisée M4/.test(s.what))); assert.ok(c.section.items.some((p) => p.t === "poly"), "a countersunk head is drawn as a cone"); inside(c.section);
});

test("dowel pins are shown where they are : pressed in side B, a slip fit in side A, straddling the joint plane", async () => {
  const { def, solids, section } = await pair("pins", { d: 4, pitch: 50, n: 2, length: 12 });
  assert.equal(def.label, INTERFACE_TYPES.pins.label); assert.deepEqual(def.pts, [[15, 20, 12], [65, 20, 12]]);
  assert.match(fact(def, "Dowel pins"), /^2 × Dowel pin ISO 8734/); assert.match(fact(def, "Pitch"), /50 mm/); assert.match(fact(def, "Side A — slip fit"), /Ø 4 F7, débouchant/); assert.match(fact(def, "Side B — press fit"), /Ø 4 P7, 6 mm/); assert.match(fact(def, "Position tolerance"), /0,02/);
  assert.equal(solids.length, 2); for (const s of solids) { assert.equal(s.shape, "cyl"); assert.equal(s.r, 2); assert.deepEqual([s.a[2], s.b[2]], [6, 18], "6 mm in the base, 6 mm up through the plate"); assert.equal(s.color, MATE_COLORS.pin); }
  inside(section); assert.match(texts(section), /pitch 50/); assert.match(texts(section), /F7 slip/); assert.match(texts(section), /P7 press/); assert.match(texts(section), /2 × dowel pin Ø 4 × 12/);
  assert.equal(section.items.filter((p) => p.t === "rect" && p.fill === MATE_COLORS.pin).length, 2);
});

test("the other kinds of interface have their definition too : fit, planar, bond, cut-out, rail, weld, pressure contact", async () => {
  const fit = await pair("fit", { d: 10, length: 6, fit: "H7/g6" });
  assert.match(fact(fit.def, "Fit"), /Ø 10 H7\/g6/); assert.match(fact(fit.def, "Side B — bore"), /6,5 mm/); assert.equal(cyls(fit.solids).length, 1); assert.equal(loops(fit.solids).length, 1); assert.deepEqual([cyls(fit.solids)[0].a[2], cyls(fit.solids)[0].b[2]], [12, 6], "the shaft goes 6 mm down into the bore"); inside(fit.section); assert.match(texts(fit.section), /bore H7/);
  const planar = await pair("planar", { w: 50, h: 20 }, {}, { pad: 2 });
  assert.match(fact(planar.def, "Contact area"), /50 × 20 mm/); assert.match(fact(planar.def, "Side B — pad"), /2 mm/); assert.equal(planar.solids.length, 1); assert.deepEqual([span(planar.solids[0], 0), span(planar.solids[0], 1), span(planar.solids[0], 2)], [50, 20, 0]); assert.equal(planar.solids[0].pts[0][2], 14, "on the top of the pad"); inside(planar.section); assert.match(texts(planar.section), /pad 2 mm/);
  const bond = await pair("bond", { w: 40, h: 16, gap: 0.2, adhesive: "epoxy", prep: "abrade" });
  assert.match(fact(bond.def, "Adhesive"), /époxy/i); assert.match(fact(bond.def, "Bond line"), /0,2 mm/); assert.match(fact(bond.def, "Quantity"), /mL/); assert.equal(bond.solids[0].color, MATE_COLORS.film); assert.deepEqual([span(bond.solids[0], 0), span(bond.solids[0], 1)], [40, 16]); inside(bond.section); assert.match(texts(bond.section), /bond line 0,2 mm/);
  const cut = await pair("cutout", { shape: "rect", w: 30, h: 12, r: 1 });
  assert.match(fact(cut.def, "Opening"), /30 × 12 mm, coins R 1/); assert.deepEqual([span(cut.solids[0], 0), span(cut.solids[0], 1)], [30, 12]); inside(cut.section); assert.match(texts(cut.section), /30 × 12/);
  const round = await pair("cutout", { shape: "round", d: 16 });
  assert.match(fact(round.def, "Opening"), /ronde Ø 16/); assert.equal(round.solids[0].pts.length, 33); assert.equal(span(round.solids[0], 0), 16); inside(round.section);
  const rail = await pair("rail", { t: 1.6, depth: 3, length: 30 });
  assert.match(fact(rail.def, "Side A — tongue"), /1,6 mm/); assert.match(fact(rail.def, "Side B — groove"), /3 mm de profond, jeu de 0,2 mm/); assert.equal(span(rail.solids[0], 0), 30); inside(rail.section); assert.match(texts(rail.section), /groove 3 mm/);
  const weld = await pair("weld", { process: "laser", w: 10, h: 5, n: 3, t: 0.3 });
  assert.match(fact(weld.def, "Process"), /laser/i); assert.match(fact(weld.def, "Welds"), /^3$/); assert.match(fact(weld.def, "Side A — tab"), /0,3 mm/); assert.deepEqual([span(weld.solids[0], 0), span(weld.solids[0], 1)], [10, 5]); inside(weld.section); assert.equal(weld.section.items.filter((p) => p.t === "poly").length, 3, "one mark per weld");
  const wire = await pair("weld", { process: "wirebond", w: 10, h: 5, n: 4, wire: 0.3, wireMat: "Al" }); assert.match(fact(wire.def, "Wires"), /4 × Ø 0,3 mm \(Al\)/);
  const contact = await pair("contact", { w: 24, h: 8, n: 6, gap: 0.6, force: 2, plating: "Ag", i: 40 });
  assert.match(fact(contact.def, "Contact points"), /6, écrasés de 0,6 mm/); assert.match(fact(contact.def, "Force"), /2 N par point/); assert.match(fact(contact.def, "Current"), /40 A/); assert.ok(fact(contact.def, "Form") && fact(contact.def, "Plating")); inside(contact.section); assert.equal(contact.section.items.filter((p) => p.t === "poly").length, 6);
  // no kind of interface is left without its picture
  const seen = { fit, planar, bond, cutout: cut, rail, weld, contact };
  for (const type of Object.keys(INTERFACE_TYPES)) { if (type === "bolt_pattern" || type === "pins") continue; const s = seen[type]; assert.ok(s, `${type} is covered`); assert.equal(s.def.type, type); assert.equal(s.def.label, INTERFACE_TYPES[type].label); assert.ok(s.def.facts.length >= 3, `${type} : facts`); assert.ok(s.solids.length >= 1, `${type} : solids`); assert.ok(s.section.items.length >= 5, `${type} : section`); }
});

test("a mate whose side is gone has no definition, and nothing is drawn for it", async () => {
  const { asm, built, sol } = await pair("planar", { w: 20, h: 10 });
  assert.equal(mateDefinition(asm, built, sol.placements, { ...asm.mates[0], b: { inst: "top", iface: "IF9" } }), null);
  assert.equal(mateDefinition(asm, built, {}, asm.mates[0]), null, "not placed : nothing to show");
  assert.deepEqual(mateSolids(null), []); assert.deepEqual(mateSection(null).items, []);
});

test("on the Rover every one of the 29 mates has its definition, and the screws of the plate stand on its four posts", async () => {
  const K = await kernel(), built = {}; for (const s of DEMO_ROVER.parts) built[s.id] = buildPart(K, s);
  const asm = JSON.parse(JSON.stringify(DEMO_ROVER.assemblies[0])), sol = solve(asm, built), kinds = new Set();
  for (const m of asm.mates) { const d = mateDefinition(asm, built, sol.placements, m); assert.ok(d, m.id); kinds.add(d.type); assert.ok(d.facts.length >= 2, m.id); assert.ok(mateSolids(d).length >= 1, m.id); inside(mateSection(d)); assert.equal(d.pts.length, d.uv.length); }
  assert.deepEqual([...kinds].sort(), ["bolt_pattern", "cutout", "fit", "pins", "planar"]);
  const m1 = mateDefinition(asm, built, sol.placements, asm.mates.find((m) => m.id === "M1")), s1 = mateSolids(m1);
  assert.equal(m1.A.part, "RVR-2200-04", "the plate is the side the screws enter"); assert.equal(m1.grip, 4); assert.deepEqual(m1.pts.map((q) => q[2]), [53, 53, 53, 53]);
  assert.deepEqual(m1.pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), [[45, 8], [45, 92], [225, 8], [225, 92]]);
  assert.equal(s1.length, 12); for (const s of s1.filter((x) => /^tête/.test(x.what))) assert.deepEqual([s.a[2], s.b[2]], [57, 60], "the heads sit on the top of the plate");
  const pins = asm.mates.map((m) => mateDefinition(asm, built, sol.placements, m)).find((d) => d.type === "pins"), sp = mateSolids(pins);
  assert.equal(sp.length, 2); for (const s of sp) assert.equal(Math.round(Math.hypot(s.a[0] - s.b[0], s.a[1] - s.b[1], s.a[2] - s.b[2]) * 100) / 100, pins.params.length, "a pin is as long as its interface says");
});
