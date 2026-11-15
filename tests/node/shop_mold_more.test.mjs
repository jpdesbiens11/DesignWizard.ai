/* The other moulded parts of the Shop companion : the cover that matches its housing, the clips, the ribbed plate. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { synthesize } from "../../web/js/core/shop_intent.js";
import { anticipatedInterfaces } from "../../web/js/core/prompts.js";
import { moldArch, clipPlan, hostOf } from "../../web/js/core/shop_mold_more.js";
import { checkPart, RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { meshWallThickness } from "../../web/js/analysis/dfx_core.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const housing = (mat, extra = {}) => synthesize({ name: "Boîtier", quantity: 2000, material: mat, form: "molded", envelope: { L: 110, W: 70, H: 28 }, interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation de la carte", partner: "Carte", where: "+Z", inside: true, params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 90, dy: 55 } } },
  { type: "cutout", side: "A", name: "Passage du connecteur", where: "-Y", params: { shape: "rect", w: 16, h: 8, r: 1 } }], ...extra }, "H1");
const coverOf = (h, mat, extra = {}) => synthesize({ name: "Couvercle", quantity: 2000, material: mat, form: "molded", hosts: { H1: hostOf(h) },
  interfaces: anticipatedInterfaces({ parts: [h], assemblies: [] }, ["H1"]).filter((a) => /couvercle/.test(a.iface.key)).map((a) => ({ from: a.from, type: a.iface.type, name: a.iface.name, partner: a.iface.partner, key: a.iface.key, side: a.iface.side, params: a.iface.params, where: "-Z" })), ...extra }, "C1");
const made = (K, spec) => { const b = buildPart(K, spec), mesh = K.tessellate(b.bodies[0].shape); return { b, d: checkPart(spec, b, { mesh }), w: meshWallThickness(mesh) }; };
const clean = (x, tag) => { assert.equal(x.b.log.filter((l) => l.level === "error").length, 0, tag); assert.ok(x.b.bodies[0], tag); assert.equal(x.d.summary.errors + x.d.summary.warnings, 0, `${tag} : ${JSON.stringify(x.d.findings.filter((f) => f.severity !== "info").map((f) => f.message))}`); };
/** The volume two parts share when the cover sits on the rim of its housing : none, if they were drawn from the same numbers. */
const clash = (K, hb, cb, H) => K.props(K.common(hb.bodies[0].shape, K.transform(cb.bodies[0].shape, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, H, 1]))).volume;

test("a moulded cover matches its housing : same outline, a lip between wall and bosses, holes on the bosses, no interference", async () => {
  const K = await kernel();
  for (const mat of ["PC-ABS", "AL-A380"]) {
    const h = housing(mat).spec, r = coverOf(h, mat), c = r.spec, host = hostOf(h), hm = made(K, h), cm = made(K, c);
    assert.equal(r.form, "molded"); assert.equal(c.mold.arch, "cover"); assert.equal(c.mold.host, "H1"); assert.equal(c.family, "plate"); assert.deepEqual(validateSpec(c).errors, []); assert.equal(h.mold.arch, "shell"); assert.equal(h.mold.closure, "screws");
    assert.deepEqual([c.params.L.value, c.params.W.value, c.params.rc.value, c.params.dp.value], [host.L, host.W, host.rc, host.dp], "the housing's outline, radii and draft");
    assert.deepEqual(c.features.map((f) => f.id), ["plaque", "angles", "levre", "levre_int", undefined]); const lip = c.features[2]; assert.equal(lip.face, "-Z"); assert.equal(lip.start, 0); assert.equal(lip.rect[0], host.wall + 0.25, "a quarter of a millimetre from the wall of the housing");
    assert.ok(lip.h <= 0.3 * (host.H - host.wall) - 0.5 + 1e-9, "the lip stays above the gussets of the housing"); assert.ok(lip.rect[0] + c.features[3].rect[0] - lip.rect[0] < host.wall + h.mold.gap, "and passes between the wall and the bosses");
    const [screws, joint] = [c.interfaces.find((i) => i.type === "bolt_pattern"), c.interfaces.find((i) => i.type === "planar")], theirs = h.interfaces.find((i) => i.name === "Fixation du couvercle");
    assert.equal(screws.key, theirs.key); assert.equal(screws.side, "A"); assert.equal(screws.face, "-Z"); assert.equal(screws.level, 0); assert.equal(joint.key, `${theirs.key}_joint`); assert.deepEqual(joint.params, { ...joint.params, w: "L", h: "W" });
    clean(hm, `${mat} housing`); clean(cm, `${mat} cover`); assert.ok(clash(K, hm.b, cm.b, host.H) < 0.01, `${mat} : the cover sits on its housing without touching anything but the rim`);
    assert.ok(Math.abs(cm.w.median - c.params.wall.value) < 0.05); assert.ok(cm.b.bbox[2] < -1.4 && Math.abs(cm.b.bbox[5] - c.params.wall.value) < 1e-6, "the lip hangs under the joint plane");
    assert.ok(r.decisions.some((t) => /assorti à H1/.test(t)) && r.decisions.some((t) => /Lèvre de centrage/.test(t)) && r.decisions.some((t) => /trous de passage au droit des bossages/.test(t))); c.id = "C1"; assert.deepEqual(fromDwiz(toDwiz(c)), c);
  }
  // which part is it : it takes the joint plane of a neighbour → a cover ; said otherwise → what is said
  assert.equal(moldArch({}, [{ type: "planar", from: { part: "H1" } }]), "cover"); assert.equal(moldArch({}, [{ type: "planar" }]), "shell"); assert.equal(moldArch({ arch: "plate" }, [{ type: "planar", from: {} }]), "plate"); assert.equal(moldArch({}, [{ type: "planar", from: {} }, { type: "bolt_pattern", inside: true }]), "shell");
  // alone, without its housing : the joint plane gives the size, the lip is drawn from its own wall
  const lone = synthesize({ name: "Capot", material: "ABS", form: "molded", arch: "cover", interfaces: [{ type: "planar", side: "A", name: "Plan de joint", where: "-Z", params: { w: 90, h: 50 } }] }, "C2").spec; assert.equal(lone.params.L.value, 90); assert.equal(lone.params.W.value, 50); clean(made(K, lone), "lone cover");
  assert.equal(hostOf({ id: "X", params: {}, mold: { arch: "cover" } }), null); assert.equal(hostOf(null), null);
});

test("clips : a blade sized by its strain, windows in the housing, hooks on the cover — and screws again when it cannot bend", async () => {
  const K = await kernel(), p = clipPlan("PC-ABS", 2.5, 25, 110), g = clipPlan("PA66-GF30", 2, 25, 110);
  assert.deepEqual([p.t, p.y, p.lb, p.hh, p.eps, p.n], [1.5, 1, 11, 1.5, 0.02, 2]); assert.ok(p.strain <= p.eps && p.fits); assert.equal(g.eps, 0.01); assert.ok(g.lb > p.lb && g.strain <= g.eps, "a glass-filled blade must be longer"); assert.equal(clipPlan("PC-ABS", 2.5, 25, 200).n, 3); assert.equal(clipPlan("PC-ABS", 2.5, 10, 110).fits, false);
  for (const mat of ["PC-ABS", "PA66-GF30"]) {
    const hr = housing(mat, { closure: "clips" }), h = hr.spec, c = coverOf(h, mat).spec, hm = made(K, h), cm = made(K, c), k = h.mold.clips;
    assert.equal(h.mold.closure, "clips"); assert.equal(h.mold.slides, 3, "two rows of windows and the connector opening"); assert.ok(!h.features.some((f) => f.op === "boss") && !h.interfaces.some((i) => i.type === "bolt_pattern" && /couvercle/.test(i.key || "")), "no boss, no screw");
    assert.equal(h.features.filter((f) => /Fenêtre de clip/.test(f.name || "")).length, 4); assert.ok(h.interfaces.some((i) => i.type === "planar" && /_couvercle_joint$/.test(i.key)));
    assert.equal(c.features.filter((f) => /Lame de clip/.test(f.name || "")).length, 4); assert.equal(c.features.filter((f) => /Crochet de clip/.test(f.name || "")).length, 4); assert.equal(c.mold.lifters, 4); assert.ok(!c.interfaces.some((i) => i.type === "bolt_pattern"));
    clean(hm, `${mat} housing with windows`); assert.equal(cm.b.log.filter((l) => l.level === "error").length, 0); assert.equal(cm.d.summary.errors, 0); assert.ok(clash(K, hm.b, cm.b, hostOf(h).H) < 0.01, `${mat} : the hooks stand in the windows, nothing collides`);
    assert.ok(Math.abs(cm.b.bbox[2] + (k.lb + k.hh)) < 0.06, "the blades reach down to the windows");
    const rule = hm.d.findings.find((f) => f.id === "MLD-11"); assert.ok(rule && rule.severity === "info" && new RegExp(`déformation ${String(Math.round(1000 * k.strain) / 10).replace(".", ",")}`).test(rule.message), rule && rule.message);
    assert.ok(hr.decisions.some((t) => /Fermeture par clips : 4 fenêtres/.test(t)) && hr.decisions.some((t) => /tiroir/.test(t)));
    const stiff = JSON.parse(JSON.stringify(h)); stiff.mold.clips.lb = 5; assert.ok(checkPart(stiff, hm.b).findings.some((f) => f.id === "MLD-11" && f.severity === "warn" && /allonger la lame/.test(f.message)));
  }
  const metal = housing("AL-A380", { closure: "clips" }); assert.equal(metal.spec.mold.closure, "screws"); assert.ok(metal.decisions.some((t) => /métal ne fléchit pas/.test(t)));
  const flat = synthesize({ name: "Plat", material: "PC-ABS", form: "molded", closure: "clips", envelope: { L: 80, W: 50, H: 8 }, interfaces: [] }, "H2"); assert.equal(flat.spec.mold.closure, "screws"); assert.ok(flat.decisions.some((t) => /la fermeture reste vissée/.test(t)));
  assert.ok(RULEBOOK.find((x) => x.process === "injection_molding").rules.some((x) => x.id === "MLD-11"));
});

test("a solid ribbed plate : one wall, a rim and crossed ribs underneath, bosses under its threads", async () => {
  const K = await kernel();
  const brief = (mat) => ({ name: "Platine", quantity: 2000, material: mat, form: "molded", arch: "plate", envelope: { L: 140, W: 90 }, interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation du module", where: "+Z", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 60, dy: 40 } } },
    { type: "bolt_pattern", side: "A", name: "Fixation au châssis", where: "+Z", params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 2, dx: 120, dy: 70 } } }] });
  for (const mat of ["PC-ABS", "AL-A380"]) {
    const r = synthesize(brief(mat), "P1"), s = r.spec, m = made(K, s), wall = s.params.wall.value;
    assert.equal(s.mold.arch, "plate"); assert.equal(s.family, "plate"); assert.deepEqual(s.stock, { form: "molded" }); clean(m, `${mat} plate`);
    assert.deepEqual(s.features.slice(0, 4).map((f) => f.id), ["plaque", "angles", "ceinture", "ceinture_int"]); const ribs = s.features.filter((f) => f.name === "Nervure"); assert.ok(ribs.length >= 3 && ribs.every((f) => f.face === "-Z" && f.start === 0 && f.h === "rh" && f.draft === "dp"));
    const boss = s.features.find((f) => f.op === "boss"); assert.equal(boss.face, "-Z"); assert.equal(boss.at.length, 4); assert.equal(boss.draft, "dp");
    const mod = s.interfaces.find((i) => i.name === "Fixation du module"); assert.equal(mod.face, "+Z"); assert.ok(mat === "PC-ABS" ? mod.opts.thread === "insert" && mod.opts.depth > wall : mod.opts.depth >= 8, "the thread goes deeper than the wall : into the boss");
    assert.ok(Math.abs(m.w.median - wall) < 0.05 && m.w.p90 <= 1.5 * wall + 0.05, `ribs are not masses : ${m.w.p90.toFixed(2)} mm at most for a wall of ${wall}`); assert.ok(m.b.bbox[2] < -wall, "the ribs hang under the plate"); assert.ok(Math.abs(m.b.bbox[5] - wall) < 1e-6, "its top stays flat for what bolts on");
    for (const w of [/Pièce pleine nervurée/, /ceinture et \d+ nervure\(s\) croisée/, /bossage\(s\) Ø .* sous la plaque/, /Dépouille de \d° modélisée/]) assert.ok(r.decisions.some((t) => w.test(t)), String(w));
  }
});
