/* The project « BM 8s8p - 21700 », iteration 10 (JP, 22 novembre 2026, par menu : « fil LV et isolation des îlots, puis boîtier et borne du
   module » ; « un boîtier extrudé en plastique le long des 8 modules qui contient ces 8 derniers… des trous sont extrudés dans la section centrale
   et des vis autotaraudeuses se font des filets au premier assemblage ») : the casing extruded in polycarbonate, its screw ports for the lids, the
   channel of the return busbar, the two terminals of the module.
     node --test tests/node/bm_case.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { bmProject, CORE_X, CORE_Y, CORE_PITCH, CASE_Y0, CASE_L, I_CORE } from "../../web/js/demo/demo_bm.js";
import { CASE, RETURN, CORE_ENV, caseSection, casingPart } from "../../web/js/demo/demo_bm_case.js";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { normalizeProfile } from "../../web/js/cad/profile.js";
import { sectionMaxThickness } from "../../web/js/analysis/dfx_rules_extrusion.js";
import { flatAsm } from "../../web/js/core/asm_levels.js";
import { processPlan } from "../../web/js/cad/process_plan.js";
import { fabPlayable, toolMoves, passesOf, pathIssues, faceOf } from "../../web/js/core/fab_path.js";
import { kernel } from "./kernel_helper.mjs";

const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${msg} : ${a} ≠ ${b}`);
const M = (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
let cache = null;
async function module() {
  if (cache) return cache;
  const K = await kernel(), p = bmProject(), find = (id) => p.assemblies.find((a) => a.id === id), flat = flatAsm(find("BM-8S8P-ASM"), find), built = new Map(p.parts.map((s) => [s.id, buildPart(K, s)]));
  const place = (i) => ({ id: i.id, part: i.part, bodies: built.get(i.part).bodies.map((b) => ({ name: b.name, shape: K.transform(b.shape, M(i.placement.t)) })) });
  cache = { K, p, flat, built, place }; return cache;
}
const clashes = (K, A, list) => { const out = []; for (const a of A.bodies) for (const B of list) for (const b of B.bodies) { const v = K.props(K.common(a.shape, b.shape)).volume; if (v > 1e-3) out.push(`${A.id}/${a.name} × ${B.id}/${b.name} : ${v.toFixed(3)} mm³`); } return out; };

test("the section is drawn around the CORE : its walls, its rails and ribs with their play, a lobe and a closed screw hole in each corner, the channel of the return busbar", () => {
  const S = caseSection(), E = CORE_ENV, C = CASE;
  near(E.x1, CORE_X, "the board is the widest thing of a CORE"); near(S.cavity.x0, E.x0 - C.side, "beside the board"); near(S.cavity.x1, E.x1 + C.side, "both sides");
  near(S.cavity.z1 - E.z1, C.top, "over the tallest component"); near(E.z0 - (S.cavity.z0 + C.rail.h), 0.5, "the rails : 0.5 mm under the flex");
  near((E.flex0 - 0.5) - S.cavity.x0, C.rib.h, "a side rib reaches 0.5 mm from the flex panel");
  near(S.R - C.port.hole / 2, C.t, "a wall as thick as the casing around the screw hole");
  for (const [k, p] of S.ports.entries()) { const cx = k === 0 || k === 3 ? S.cavity.x0 : S.cavity.x1, cz = k < 2 ? S.cavity.z0 : S.cavity.z1;
    assert.ok(Math.hypot(p[0] - cx, p[1] - cz) - C.port.hole / 2 >= C.t - 1e-9, `port ${k + 1} : the wall to the cavity`); }
  near(S.channel.x1 - S.channel.x0, RETURN.w + 2 * C.keel.clr, "the channel : the bar and its play"); near(S.channel.z1 - S.channel.z0, RETURN.t + 2 * C.keel.clr, "its height");
  near(S.xm, CORE_X / 2, "a section symmetric about the middle of the CORE");
});

test("the screw ports follow what the maker of the screw prints : hole 0.85 × d1 ± 0.05, 2 × d1 at least, counterbore 1.05 × d1 by 0.1 × d1 — the extruded hole never larger than the drilled one", () => {
  const P = CASE.port;
  near(P.hole, 0.85 * P.d1, "pre-hole"); assert.ok(P.depth >= 2 * P.d1, "installation depth"); near(P.cb, 1.05 * P.d1, "counterbore"); near(P.cbDepth, 0.1 * P.d1, "its depth");
  assert.ok(P.ext + 0.3 < P.hole, "a section holds ± 0.3 mm : the extruded hole stays under the drilled size, and the drill always cuts");
  const spec = casingPart({ L: CASE_L }), holes = spec.features.filter((f) => f.op === "hole");
  assert.deepEqual(holes.map((h) => h.face), ["-Y", "+Y"]); assert.ok(holes.every((h) => h.d === P.hole && h.depth === P.depth && h.cbore.d === P.cb && h.at.length === 4));
  assert.ok(spec.interfaces.every((i) => i.type === "bolt_pattern" && i.opts.port && i.params.pattern.nx === 2 && i.params.pattern.ny === 2), "the lids : a bolt pattern on each end, in the ports");
  assert.match(spec.notes.join(" "), /EVO PT 40/); assert.match(spec.notes.join(" "), /EVO CALC/);
});

test("the casing builds, extruded in polycarbonate : no DFx error ; six closed hollows said ; no section thicker than 4 mm ; nothing inside touches it", async () => {
  const { built, p } = await module(), spec = p.parts.find((s) => s.id === "BM-CASING"), b = built.get("BM-CASING");
  assert.deepEqual(validateSpec(spec).errors, []); assert.deepEqual(b.log.filter((l) => l.level === "error"), []);
  assert.equal(spec.process, "extrusion_plastic"); assert.equal(spec.material, "PC"); near(b.bbox[4] - b.bbox[1], CASE_L, "cut length", 1e-6);
  const f = checkPart(spec, b), bad = (f.findings || f).filter((x) => x.severity === "error" || x.severity === "warn").map((x) => x.id || x.rule);
  assert.deepEqual(bad, ["EXT-05"], "the hollows : the only warning, explained in the notes");
  assert.ok(sectionMaxThickness(normalizeProfile(spec.extrusion.profile)).tMax <= 4, "EXT-12 : no thick spot");
  assert.equal(b.facts.extrusion.envelopes.length, 3); assert.ok(b.facts.extrusion.envelopes.every((e) => !e.collides));
});

test("the module closes : casing, − terminal before CORE 1, + terminal after CORE 8 — no interference, each terminal face against its CORE", async () => {
  const { K, flat, place } = await module(), at = (id) => flat.instances.find((i) => i.id === id), core = (k) => flat.instances.filter((i) => i.id.startsWith(`core${k}~`)).map((i) => ({ ...i, placement: { ...i.placement, t: i.placement.t.map((v, n) => v + flat.groups[i.group].placement.t[n]) } })).map(place);
  const casing = place(at("boitier")), neg = place(at("borne_moins")), plus = place(at("borne_plus"));
  near(at("boitier").placement.t[1], CASE_Y0, "the casing"); assert.ok(CASE_Y0 < -16.25 && CASE_Y0 + CASE_L > 7 * CORE_PITCH + 53.65, "it runs past the studs of the − terminal and the backing plate of the + terminal");
  assert.deepEqual(clashes(K, casing, [...core(1), neg, plus]), [], "the section is the same all along : CORE 1 stands for the 8");
  assert.deepEqual(clashes(K, neg, core(1)), []); assert.deepEqual(clashes(K, plus, core(8)), []);
  near(K.bbox(neg.bodies.find((b) => b.name === "plaque").shape)[4], -(0.25 + 2.0), "the − terminal : face against the − leg of CORE 1", 1e-3);
  near(K.bbox(plus.bodies.find((b) => b.name === "plaque").shape)[1], 7 * CORE_PITCH + CORE_Y + 0.25 + 2.0, "the + terminal : face against the + leg of CORE 8", 1e-3);
});

test("the terminals : copper and a backing plate, the LV islands of a leg, studs to the lids ; the end of the RS-485 chain terminated there", async () => {
  const { p, built } = await module(), neg = p.parts.find((s) => s.id === "BM-TERM-NEG"), pos = p.parts.find((s) => s.id === "BM-TERM-POS");
  for (const s of [neg, pos]) { assert.equal(s.bodies.plaque.kind, "conductor"); assert.equal(s.bodies.appui.kind, "insulator"); assert.equal(Object.keys(s.bodies).filter((k) => /^lv_/.test(k)).length, 4); assert.deepEqual(built.get(s.id).log.filter((l) => l.level === "error"), [], s.id); }
  assert.equal(neg.bodies.plaque.net, "PACK-"); assert.equal(pos.bodies.plaque.net, "PACK+");
  const rs = p.boards[0].blocks.find((b) => b.template === "rs485"); assert.equal(rs.params.term, 0, "8 identical boards, none terminated");
  assert.match(pos.notes.join(" "), /120 Ω/); assert.equal(fabPlayable(neg).ok, false); assert.equal(fabPlayable(pos).ok, false);
});

test("the return busbar : 50 × 4 mm for the 360 A of the module, under the limit the cell allows ; the calculation kept in the project", () => {
  const p = bmProject(), r = p.physics.find((x) => x.id === "phy-bm-return");
  assert.equal(r.model, "busbar"); assert.equal(r.inputs.I, I_CORE); assert.equal(r.inputs.w, RETURN.w); assert.equal(r.inputs.t, RETURN.t);
  assert.ok(r.checks.every((c) => c.ok), JSON.stringify(r.checks)); assert.ok(r.values.T < 60 && r.values.J < 2.5); assert.match(r.why, /canal fermé/);
});

test("in the fabrication shop : the casing is played — extruded, cut, both ends drilled along a path written by an AI ; the tool moves only there", async () => {
  const { p, built } = await module(), spec = p.parts.find((s) => s.id === "BM-CASING"), b = built.get("BM-CASING");
  assert.deepEqual(fabPlayable(spec), { ok: true, kind: "extruded" });
  const phases = processPlan(spec, b).phases; assert.deepEqual(phases.map((x) => x.key), ["stock", "setup:-Y", "setup:+Y", "deburr", "check", "pack"]);
  assert.deepEqual(phases.filter((x) => toolMoves(spec, x)).map((x) => x.key), ["setup:-Y", "setup:+Y"]);
  for (const key of ["setup:-Y", "setup:+Y"]) { const ps = passesOf(spec, key);
    assert.deepEqual(ps.map((x) => x.tool), ["drill", "reamer", "endmill"]); assert.ok(ps.every((x) => /Claude/.test(x.by) && x.errors.length === 0));
    assert.deepEqual(pathIssues(ps, { bbox: b.bbox, face: faceOf(key) }), [], key); }
});
