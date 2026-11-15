/* The Shop companion for a moulded part : from what it holds and what it meets, with the moulder's rules — plastic and metal. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { synthesize, recommend } from "../../web/js/core/shop_intent.js";
import { MOLD_RULES, moldProcess } from "../../web/js/core/shop_mold.js";
import { checkPart, RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { meshWallThickness } from "../../web/js/analysis/dfx_core.js";
import { routing } from "../../web/js/cad/shop.js";
import { processPlan } from "../../web/js/cad/process_plan.js";
import { orderCheck } from "../../web/js/cad/order.js";
import { material, PROCESSES } from "../../web/js/cad/materials.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const brief = (mat, extra = {}) => ({ name: "Boîtier de capteur", fn: "Loge et protège la carte de mesure", quantity: 2000, material: mat, form: "molded", envelope: { L: 110, W: 70, H: 28 },
  interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation de la carte", partner: "Carte", where: "+Z", inside: true, params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 90, dy: 55 } } },
    { type: "cutout", side: "A", name: "Passage du connecteur", partner: "Connecteur", where: "-Y", params: { shape: "rect", w: 16, h: 8, r: 1 } },
    { type: "bolt_pattern", side: "A", name: "Fixation au châssis", partner: "Châssis", where: "-Z", params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 1, dx: 60, dy: 0 } } }], ...extra });
const val = (spec, k) => spec.params[k].value;
const small = (mat) => brief(mat, { envelope: { L: 180, W: 60, H: 25 }, interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation de la carte", where: "+Z", inside: true, params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } } }] });
/** Built and checked as the browser does : the rules see the mesh, so a sliver or a mass cannot hide. */
const made = (K, spec) => { const b = buildPart(K, spec), mesh = K.tessellate(b.bodies[0].shape); return { b, mesh, d: checkPart(spec, b, { mesh }), w: meshWallThickness(mesh) }; };

test("a plastic housing draws itself : one wall for the material, radii made before the shell, bosses clear of the walls, inserts, a declared draft", async () => {
  const K = await kernel(), r = synthesize(brief("PC-ABS"), "PN-0100"), s = r.spec, lim = material("PC-ABS").wall;
  assert.equal(r.form, "molded"); assert.equal(s.process, "injection_molding"); assert.equal(s.family, "enclosure"); assert.deepEqual(s.stock, { form: "molded" }); assert.deepEqual(validateSpec(s).errors, []);
  const wall = val(s, "wall"); assert.ok(wall >= lim[0] && wall <= lim[1]); assert.equal(wall, 2.5); assert.ok(val(s, "rc") >= 1.5 * wall && val(s, "rf") >= 1.5 * wall, "outside radii leave half a wall inside");
  assert.ok(val(s, "L") >= 110 + 2 * wall && val(s, "W") >= 70 + 2 * wall && val(s, "H") >= 28 + wall, "the volume asked for fits inside");
  const ops = s.features.map((f) => f.op); assert.deepEqual(ops.slice(0, 4), ["box", "fillet", "fillet", "shell"], "the radii come before the shell"); assert.equal(ops.at(-1), "interfaces"); assert.deepEqual(s.features[3].open, ["+Z"]);
  const boss = s.features.find((f) => f.op === "boss"), [bx, c] = boss.at.grid.origin; assert.ok(c - val(s, "bd") / 2 >= wall + Math.max(wall, 1.5) - 0.06, "a boss stands clear of the wall by at least a wall"); assert.ok(val(s, "bd") >= (val(s, "H") - wall) / 3 - 0.5, "and is not taller than three diameters");
  assert.ok(bx > c + 10 && r.decisions.some((t) => /glissés à .* mm des coins/.test(t)), "the board columns stand in the corners : the closing bosses slide along the long walls instead of merging with them");
  assert.equal(s.features.filter((f) => f.op === "pad" && /Gousset/.test(f.name)).length, 4, "one gusset ties each boss to the wall it stands near"); assert.equal(s.features.filter((f) => /Nervure/.test(f.name || "")).length, 1);
  const core = s.features.find((f) => f.id === "evid"); assert.ok(core && core.face === "-Z" && core.depth <= 3 * core.d + 1e-9 && core.d <= val(s, "bd") - 2 * 0.8 * wall + 1e-9, "a second pin cores each boss from underneath, no deeper than three diameters"); assert.deepEqual(core.at.grid, boss.at.grid);
  const board = s.interfaces.find((i) => i.name === "Fixation de la carte"); assert.equal(board.level, "wall + so"); assert.equal(board.opts.thread, "insert"); assert.equal(board.opts.standoff.h, "so"); assert.ok(board.opts.standoff.d >= 2 * 4);
  const cover = s.interfaces.find((i) => i.name === "Fixation du couvercle"); assert.ok(cover && cover.side === "B" && cover.opts.thread === "insert", "a closing is proposed when none is declared"); assert.equal(cover.opts.depth, 12, "the insert hole goes as deep as a core pin can : three times its 4 mm");
  assert.equal(val(s, "H") - cover.opts.depth - core.depth, wall, "between the two pins only a web of one wall is left : no mass"); assert.ok(s.interfaces.some((i) => i.type === "planar" && i.name === "Plan de joint"));
  assert.equal(s.interfaces.find((i) => i.type === "cutout").opts.depth, "wall + 0.5"); assert.equal(s.interfaces.find((i) => i.name === "Fixation au châssis").opts.depth, "wall + 0.5");
  assert.deepEqual({ ...s.mold, gate: undefined, ejection: undefined }, { process: "injection_molding", pull: "+Z", parting: "bord supérieur", wall: 2.5, draft: 1, draft_inside: 1, slides: 1, machined: 0, gate: undefined, ejection: undefined });
  for (const w of [/Paroi nominale 2,5 mm/, /avant d'évider/, /colonnettes Ø 8 mm.*insert M3/, /détachés des parois/, /noyautés des deux côtés/, /tiroir/, /Dépouille 1°/]) assert.ok(r.decisions.some((t) => w.test(t)), String(w));
  const { b, d, w } = made(K, s); assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.ok(b.volume > 30000 && b.volume < 80000);
  assert.equal(d.summary.errors, 0, JSON.stringify(d.findings.filter((f) => f.severity === "error").map((f) => f.message))); assert.equal(d.summary.warnings, 0, JSON.stringify(d.findings.filter((f) => f.severity === "warn").map((f) => f.id))); assert.ok(d.findings.some((f) => f.id === "MLD-02"));
  assert.ok(w.min > 1.3 && Math.abs(w.median - wall) < 0.05 && w.p90 < 1.5 * w.p10, `measured on the mesh the wall is the same everywhere : ${w.min.toFixed(2)} / ${w.median.toFixed(2)} / ${w.p90.toFixed(2)} mm`);
  // with room in the corners the bosses stay there, tied to both walls
  const roomy = synthesize(small("PC-ABS"), "PN-0102").spec, m2 = made(K, roomy); assert.equal(roomy.features.filter((f) => /Gousset/.test(f.name || "")).length, 8); assert.equal(roomy.features.find((f) => f.op === "boss").at.grid.origin[0], roomy.features.find((f) => f.op === "boss").at.grid.origin[1]);
  assert.equal(m2.d.summary.errors + m2.d.summary.warnings, 0, JSON.stringify(m2.d.findings.filter((f) => f.severity !== "info").map((f) => f.message))); assert.ok(m2.w.p90 < 1.5 * m2.w.p10);
  const route = routing(s, b); assert.match(route.steps[0].text, /Matière à mouler/); assert.ok(route.steps.some((x) => /Mouler par injection/.test(x.text))); const plan = processPlan(s, b, { route }); assert.equal(plan.phases[0].title, "Mise en forme"); assert.ok(plan.questions.some((q) => /Plan de joint, points d'injection/.test(q.text)));
  assert.equal(orderCheck(s, b, d, route).express, false, "a moulded part is not a rapid prototype"); assert.deepEqual(fromDwiz(toDwiz(s)), s, "the moulding record travels in the file");
  const none = synthesize(brief("PC-ABS", { cover: false }), "PN-0101").spec; assert.ok(!none.interfaces.some((i) => i.name === "Fixation du couvercle") && !none.features.some((f) => f.op === "boss"));
});

test("a metal housing is cast : thicker figures, threads cut afterwards, its own rules ; the wall follows the flow length", async () => {
  const K = await kernel(), s = synthesize(brief("AL-A380"), "PN-0200").spec, { b, d, w } = made(K, s);
  assert.equal(s.process, "die_casting"); assert.equal(moldProcess("AL-A380"), "die_casting"); assert.equal(moldProcess("AL-A356-T6"), "sand_casting"); assert.equal(moldProcess("ABS"), "injection_molding");
  const board = s.interfaces.find((i) => i.name === "Fixation de la carte"); assert.equal(board.opts.thread, undefined, "no insert in metal"); assert.ok(board.opts.depth >= 6); assert.equal(s.mold.draft_inside, 2); assert.equal(s.mold.machined, 0.5); assert.ok(s.notes.some((n) => /repris en usinage/.test(n)));
  assert.equal(b.log.filter((l) => l.level === "error").length, 0); assert.equal(d.summary.errors + d.summary.warnings, 0, JSON.stringify(d.findings.filter((f) => f.severity !== "info").map((f) => f.message))); assert.ok(w.p90 <= 2 * val(s, "wall"), "no mass : bosses cored from underneath");
  for (const mat of ["ZAMAK-3", "AL-A356-T6"]) for (const bf of [brief(mat), small(mat)]) { const x = made(K, synthesize(bf, "PN-0210").spec); assert.equal(x.d.summary.errors + x.d.summary.warnings, 0, `${mat} : ${JSON.stringify(x.d.findings.filter((f) => f.severity !== "info").map((f) => f.message))}`); }
  assert.ok(d.findings.some((f) => f.id === "CST-02" && /2° sur les noyaux/.test(f.message)) && d.findings.some((f) => f.id === "CST-05" && /taraudage\(s\)/.test(f.message)) && d.findings.some((f) => f.id === "CST-08"));
  assert.ok(routing(s, b).steps.some((x) => /Couler sous pression/.test(x.text))); assert.ok(processPlan(s, b).questions.some((q) => q.topic === "Fonderie") && processPlan(s, b).questions.some((q) => q.topic === "Reprises"));
  const sand = synthesize(brief("AL-A356-T6"), "PN-0201").spec; assert.equal(sand.process, "sand_casting"); assert.equal(val(sand, "wall"), 5); assert.equal(buildPart(K, sand).log.filter((l) => l.level === "error").length, 0);
  // a thin wall cast in A380 is refused by its own rule ; a far corner asks for a thicker wall
  const thin = JSON.parse(JSON.stringify(s)); thin.params.wall.value = 1.0; assert.ok(checkPart(thin, buildPart(K, thin)).findings.some((f) => f.id === "CST-01" && f.severity === "error"));
  const big = synthesize(brief("PC-ABS", { envelope: { L: 420, W: 260, H: 90 } }), "PN-0300"); assert.equal(val(big.spec, "wall"), 3, "the melt has 430 mm to go : at 150 times the wall that asks for 2,9 mm, taken to the next half"); assert.ok(big.decisions.some((t) => /la matière parcourt/.test(t))); assert.ok(big.spec.features.filter((f) => /Nervure/.test(f.name || "")).length >= 3);
  const books = RULEBOOK.filter((x) => /casting/.test(x.process)); assert.equal(books.length, 2); assert.ok(books.every((x) => x.rules.length >= 6 && x.fr === PROCESSES[x.process].fr)); assert.equal(Object.keys(MOLD_RULES).length, 3);
});

test("the companion advises moulding when it fits : a casting alloy, or a plastic part that holds things in series", () => {
  const holds = { interfaces: [{ type: "bolt_pattern", side: "B", where: "+Z", inside: true, params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } } }], envelope: { L: 60, W: 40, H: 20 } };
  assert.equal(recommend({ ...holds, material: "AL-A380", quantity: 5 }).form, "molded"); assert.match(recommend({ ...holds, material: "ZAMAK-3", quantity: 5 }).why, /alliage de fonderie/);
  assert.equal(recommend({ ...holds, material: "PC-ABS", quantity: 2000 }).form, "molded"); assert.equal(recommend({ ...holds, material: "PC-ABS", quantity: 2000 }).process, "injection_molding");
  assert.notEqual(recommend({ ...holds, material: "ABS", quantity: 5 }).form, "molded", "five parts are printed, not moulded"); assert.notEqual(recommend({ interfaces: holds.interfaces.map((i) => ({ ...i, inside: false })), material: "AL6061-T6", quantity: 2000 }).form, "molded");
  const chosen = synthesize({ name: "Capot", material: "AL6061-T6", form: "molded", interfaces: [] }, "PN-1"); assert.equal(chosen.spec.process, "die_casting", "the designer's choice is kept : a wrought alloy asked to be moulded goes to die casting");
});
