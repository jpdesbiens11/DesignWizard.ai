/* The health of the joints : healthy, to check, broken — from what the two sides say, the solver and the interferences. */
import test from "node:test";
import assert from "node:assert/strict";
import { jointHealth, assemblyHealth, HEALTH, engagement } from "../../web/js/core/joint_health.js";
import { jointsCsv } from "../../web/js/core/assembly_logic.js";

const bolt = (side, extra = {}) => ({ id: "IF1", type: "bolt_pattern", name: "Fixation", key: "k1", side, params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } }, frame: { o: [0, 0, 0], n: [0, 0, 1], u: [1, 0, 0] }, ...extra });
const asmOf = (mates, n = 2) => ({ id: "A", instances: Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, part: `P${i + 1}`, ...(i ? {} : { fixed: true }), placement: { t: [0, 0, 0], r: [0, 0, 0] } })), mates });
const M = (extra = {}) => ({ id: "M1", a: { inst: "i1", iface: "IF1" }, b: { inst: "i2", iface: "IF1" }, linked: true, ...extra });
const specs = { P1: { material: "AL6061-T6" }, P2: { material: "AL6061-T6" } }, one = (asm, built, sp = specs, sol = null, cl = []) => jointHealth(asm, built, sp, sol, cl)[0];

test("a bolted joint is healthy when both sides agree, to check when the thread is short or cut in plastic", () => {
  const built = { P1: { interfaces: [bolt("A")] }, P2: { interfaces: [bolt("B", { opts: { depth: 6 } })] } };
  assert.deepEqual(one(asmOf([M()]), built), { id: "M1", state: "ok", notes: [] });
  assert.equal(engagement("AL6061-T6"), 1.5); assert.equal(engagement("PC-ABS"), 2);
  const short = one(asmOf([M()]), { ...built, P2: { interfaces: [bolt("B", { opts: { depth: 3 } })] } }); assert.equal(short.state, "check"); assert.match(short.notes[0], /Prise de filet de 3 mm dans P2 : il en faut 6/);
  const plastic = one(asmOf([M()]), built, { ...specs, P2: { material: "PC-ABS" } }); assert.equal(plastic.state, "check"); assert.match(plastic.notes.join(" "), /insert/);
  assert.equal(one(asmOf([M()]), { ...built, P2: { interfaces: [bolt("B", { opts: { thread: "insert" } })] } }, { ...specs, P2: { material: "PC-ABS" } }).state, "ok", "an insert in plastic is healthy");
  assert.equal(one(asmOf([M()]), { ...built, P2: { interfaces: [bolt("B", { opts: { depth: 10, port: true } })] } }, { ...specs, P2: { material: "PVC-U" } }).state, "ok", "a screw channel of a profile is not a tapped hole");
  assert.deepEqual(one(asmOf([M()]), { ...built, P2: { interfaces: [bolt("B", { opts: { thread: "clearance", depth: 3 } })] } }, { ...specs, P2: { material: "PMMA" } }), { id: "M1", state: "ok", notes: [] }, "a plain hole with a nut behind is no thread : nothing to say about its depth or about plastic");
});

test("a joint that drifted is to check ; a joint that lost a side, clashes or fights the others is broken", () => {
  const built = { P1: { interfaces: [bolt("A")] }, P2: { interfaces: [bolt("B", { opts: { depth: 6 } })] } };
  const drift = one(asmOf([M({ linked: false })]), { ...built, P2: { interfaces: [bolt("B", { opts: { depth: 6 }, params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } } })] } });
  assert.equal(drift.state, "check"); assert.match(drift.notes[0], /ne disent plus la même chose/); assert.match(drift.notes[0], /non lié/);
  assert.equal(one(asmOf([M()]), { ...built, P2: { interfaces: [bolt("A")] } }).state, "check", "two A sides");
  const gone = one(asmOf([M()]), { ...built, P2: { interfaces: [] } }); assert.equal(gone.state, "broken"); assert.match(gone.notes[0], /a disparu de P2/);
  assert.equal(one(asmOf([M()]), { ...built, P2: { interfaces: [{ ...bolt("B"), type: "planar", params: { w: 10, h: 10 } }] } }).state, "broken");
  const fight = one(asmOf([M()]), built, specs, { problems: [{ mate: "M1", kind: "conflict", dev: 1.234, msg: "x" }], floating: [] }); assert.equal(fight.state, "broken"); assert.match(fight.notes[0], /Sur-contraint .* 1,23 mm/);
  const clash = one(asmOf([M()]), built, specs, null, [{ a: "i2", b: "i1", volume: 12.5 }]); assert.equal(clash.state, "broken"); assert.match(clash.notes[0], /se traversent : 12,5 mm³/);
});

test("a rail wants its clearance and its tongue inside ; a bond wants its film in the range of its adhesive", () => {
  const rail = (side, opts) => ({ id: "IF1", type: "rail", name: "Glissière", key: "r", side, params: { t: 1.6, depth: 1.9, length: 100 }, ...(opts ? { opts } : {}) });
  const built = (c) => ({ P1: { interfaces: [rail("A")] }, P2: { interfaces: [rail("B", { clearance: c, extruded: true })] } });
  assert.equal(one(asmOf([M({ flip: true })]), built(0.15)).state, "ok");
  assert.match(one(asmOf([M()]), built(0.15)).notes[0], /devant la rainure/);
  assert.match(one(asmOf([M({ flip: true })]), built(0.05)).notes[0], /risque de coincer/); assert.match(one(asmOf([M({ flip: true })]), built(0.8)).notes[0], /flotte/);
  const bond = (side, gap, opts) => ({ id: "IF1", type: "bond", name: "Collage", key: "b", side, params: { w: 40, h: 16, gap, adhesive: "epoxy", prep: "abrade" }, ...(opts ? { opts } : {}) });
  const glued = (gap, opts) => ({ P1: { interfaces: [bond("A", gap)] }, P2: { interfaces: [bond("B", gap, opts)] } });
  assert.equal(one(asmOf([M()]), glued(0.2)).state, "ok"); assert.match(one(asmOf([M()]), glued(3)).notes[0], /hors de la plage/); assert.match(one(asmOf([M()]), glued(0.2, { pips: false })).notes[0], /Ni logement de colle ni plot de calage/);
  // a glue well holds the film : its lip is what the mate rests on, 3 mm and more
  assert.equal(one(asmOf([M()]), glued(0.2, { well: true })).state, "ok"); assert.equal(one(asmOf([M()]), glued(0.2, { well: true, pips: false })).state, "ok", "the well is enough");
  const narrow = { P1: { interfaces: [bond("A", 0.2)] }, P2: { interfaces: [{ ...bond("B", 0.2, { well: true }), params: { w: 40, h: 16, gap: 0.2, lip: 2, adhesive: "epoxy", prep: "abrade" } }] } };
  assert.match(one(asmOf([M()]), narrow).notes[0], /Lèvre d'appui de 2 mm autour du logement de colle : 3 mm et plus/);
});

test("the assembly as a whole : joints counted, internal interfaces without a twin and loose parts make it « to check », and the register carries the health", () => {
  const built = { P1: { interfaces: [bolt("A"), { ...bolt("A"), id: "IF2", key: "k2" }, { ...bolt("A"), id: "IF3", key: "k3", external: true }] }, P2: { interfaces: [bolt("B", { opts: { depth: 6 } })] }, P3: { interfaces: [] } };
  const asm = asmOf([M()], 3), h = assemblyHealth(asm, built, specs, { problems: [], floating: ["i3"] });
  assert.deepEqual(h.counts, { ok: 1, check: 0, broken: 0 }); assert.equal(h.free, 1, "the external interface waits for no twin"); assert.equal(h.floating, 1); assert.equal(h.state, "check");
  assert.equal(h.text, "1 joint : 1 sain · 1 interface interne sans jumelle · 1 pièce non accouplée");
  const clean = assemblyHealth(asmOf([M()]), { P1: { interfaces: [bolt("A")] }, P2: built.P2 }, specs, { problems: [], floating: [] }); assert.equal(clean.state, "ok"); assert.equal(HEALTH[clean.state].fr, "Sain");
  const row = () => ({ id: "M1", kind: "Boulonné", a: "P1 · Fixation", b: "P2 · Fixation", key: "k1", hardware: [{ name: "Vis M4 × 12", qty: 4, unit: "" }], process: "4 × M4" });
  const csv = jointsCsv([{ ...row(), health: HEALTH[h.rows[0].state].fr, notes: h.rows[0].notes }]).split("\r\n"); assert.match(csv[0], /Santé;Remarques$/); assert.match(csv[1], /;Sain;$/);
  assert.doesNotMatch(jointsCsv([row()]).split("\r\n")[0], /Santé/, "no health column when the register does not carry it");
});
