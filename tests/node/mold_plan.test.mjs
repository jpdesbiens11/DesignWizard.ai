/* A moulded part, thought through its mold : the gate, the parting line and the pull, the slides, the risers of a casting,
   and what they leave on the part once cut off and buffed. Plastic and metal, five processes — with their English names. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart, validateSpec } from "../../web/js/cad/build.js";
import { synthesize } from "../../web/js/core/shop_intent.js";
import { MOLD_RULES, moldProcess, moldProcesses } from "../../web/js/core/shop_mold.js";
import { MOLDS, GATES, WITNESS, BASIS, isMolded, moldPlan, moldGuide, moldMarks, moldBrief, riserFor } from "../../web/js/core/mold_plan.js";
import { PROCESSES, processName, CAST_PROCESSES, MOLD_PROCESSES, material, materialLabel } from "../../web/js/cad/materials.js";
import { checkPart, RULEBOOK } from "../../web/js/analysis/dfx_rules.js";
import { routing } from "../../web/js/cad/shop.js";
import { orderCheck, LEAD } from "../../web/js/cad/order.js";
import { partIssues } from "../../web/js/core/guide_checks.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const brief = (mat, extra = {}) => ({ name: "Carter de capteur", fn: "Loge et protège la carte de mesure", quantity: 2000, material: mat, form: "molded", envelope: { L: 110, W: 70, H: 28 },
  interfaces: [{ type: "bolt_pattern", side: "B", name: "Fixation de la carte", partner: "Carte", where: "+Z", inside: true, params: { screw: "M3", pattern: { type: "rect", nx: 2, ny: 2, dx: 90, dy: 55 } } },
    { type: "cutout", side: "A", name: "Passage du connecteur", partner: "Connecteur", where: "-Y", params: { shape: "rect", w: 16, h: 8, r: 1 } }], ...extra });
const closed = (mat, extra = {}) => brief(mat, { interfaces: [brief(mat).interfaces[0]], ...extra });      // nothing in the side walls : an open / close mold
const kinds = (plan) => plan.witness.map((w) => w.kind);

test("the casting processes are named as the trade names them, and there are five molds", () => {
  assert.deepEqual(MOLD_PROCESSES, ["injection_molding", "die_casting", "lp_die_casting", "permanent_mold", "sand_casting"]); assert.deepEqual(CAST_PROCESSES, MOLD_PROCESSES.slice(1)); assert.deepEqual(Object.keys(MOLDS), MOLD_PROCESSES); assert.deepEqual(Object.keys(MOLD_RULES), MOLD_PROCESSES);
  assert.equal(processName("die_casting"), "High pressure die casting (HPDC)"); assert.equal(processName("lp_die_casting"), "Low pressure die casting (LPDC)"); assert.equal(processName("permanent_mold"), "Permanent mold casting"); assert.equal(processName("sand_casting"), "Sand casting"); assert.equal(processName("injection_molding"), "Injection molding"); assert.equal(processName("nope"), "");
  for (const [k, p] of Object.entries(PROCESSES)) { assert.ok(p.label && p.fr, k); assert.ok(!/[éèêàçùî]/i.test(p.label), `${k} : « ${p.label} » is English`); }
  for (const k of MOLD_PROCESSES) { const M = MOLDS[k]; assert.ok(M.label && M.tool && M.how && M.gates.length, k); for (const g of M.gates) assert.ok(GATES[g], `${k} → ${g}`); assert.equal(MOLD_RULES[k].label, M.label); assert.ok(RULEBOOK.some((b) => b.process === k), `${k} has its book of rules`); assert.ok(LEAD[k] && LEAD[k].days[0] < LEAD[k].days[1], `${k} has a lead time`); }
  assert.deepEqual(MOLD_PROCESSES.filter((k) => MOLDS[k].risers), ["lp_die_casting", "permanent_mold", "sand_casting"], "a riser stands on what is poured or filled from below, not on what a piston packs");
  assert.deepEqual([MOLDS.injection_molding.fill, MOLDS.die_casting.fill, MOLDS.lp_die_casting.fill, MOLDS.permanent_mold.fill, MOLDS.sand_casting.fill], ["pressure", "pressure", "bottom", "gravity", "gravity"]); assert.equal(MOLDS.sand_casting.side, "core"); assert.equal(MOLDS.die_casting.overflows, true);
  for (const [k, g] of Object.entries(GATES)) { assert.ok(g.label && g.mark && g.after && g.note && g.vestige[0] < g.vestige[1], k); assert.ok(["face", "parting", "wall", "bottom"].includes(g.on)); }
  for (const b of Object.values(BASIS)) assert.ok(b.length > 60, "a basis says how the figure was checked"); assert.match(BASIS.riser, /extrait/); assert.match(BASIS.lpdc, /extrait/); assert.match(BASIS.count, /n'est pas calculé/);
  // the alloy that goes to three molds, and what its menu says
  assert.deepEqual(moldProcesses("AL-A356-T6"), ["sand_casting", "permanent_mold", "lp_die_casting"]); assert.equal(moldProcess("AL-A356-T6"), "sand_casting"); assert.deepEqual(moldProcesses("AL-A380"), ["die_casting"]); assert.deepEqual(moldProcesses("AL6061-T6"), []);
  assert.equal(materialLabel(material("AL-A356-T6")), "Aluminium A356-T6 (sand casting, permanent mold, LPDC, machining)"); assert.equal(materialLabel(material("AL-A380")), "Aluminium A380 (HPDC)");
});

test("a riser is sized by the modulus of what it feeds", () => {
  assert.deepEqual(riserFor(2.5), { d: 18, h: 18, neck: 11, M: 2.5 }); const R = riserFor(4);
  assert.ok(R.d / 6 >= 1.2 * 4 - 1e-9, "a cylinder as high as wide has a modulus of D / 6 : at least 1.2 times the mass"); assert.ok(R.neck / 4 >= 1.1 * 4 - 1e-9, "its neck : 1.1 times"); assert.equal(R.h, R.d);
});

test("an injected housing : open / close or a slide, a gate proposed until it is chosen, and what it leaves", async () => {
  const K = await kernel(), s = synthesize(brief("PC-ABS"), "PN-0300").spec, b = buildPart(K, s), plan = moldPlan(s, b);
  assert.deepEqual(validateSpec(s).errors, []); assert.ok(isMolded(s)); assert.equal(plan.process, "injection_molding"); assert.equal(plan.pull, "+Z");
  assert.equal(plan.parting.level, Math.round(b.bbox[5] * 10) / 10, "the parting line runs round the rim"); assert.equal(plan.parting.loop.length, 5); assert.deepEqual(plan.parting.loop[0], plan.parting.loop[4]); assert.ok(plan.parting.loop.every((p) => p[2] === plan.parting.level));
  assert.equal(plan.simple, false); assert.deepEqual(plan.slides.map((x) => [x.dir, x.kind, x.what]), [["-Y", "slide", ["Passage du connecteur"]]], "the opening in a side wall asks for a slide");
  assert.deepEqual([plan.gate.kind, plan.gate.auto, plan.gate.face], ["pin", true, "-Z"]); assert.deepEqual(plan.gate.at, [Math.round((b.bbox[0] + b.bbox[3]) * 5) / 10, Math.round((b.bbox[1] + b.bbox[4]) * 5) / 10, Math.round(b.bbox[2] * 10) / 10], "a pin gate at the centre of the floor, outside");
  assert.deepEqual(plan.risers, []); assert.equal(plan.overflow, null); assert.deepEqual(kinds(plan), ["gate", "parting", "ejector", "slide"]); assert.equal(plan.witness[2].where, "+Z", "the ejector pins are on the core side, inside the housing");
  assert.match(plan.notes[0], /^Mold : Injection molding — pull \+Z, parting line au bord supérieur.*1 slide\(s\) \(-Y\)$/); assert.match(plan.notes[1], /^Gate : Pin gate \/ hot tip, face -Z\. Gate vestige ≤ 0,5 mm/); assert.match(plan.notes[2], /^Ejector pin marks côté core seulement$/);
  const g = moldGuide(plan); assert.deepEqual(g.map((x) => [x.level, x.field]), [["todo", "gate"], ["tip", "slides"]], "the proposed gate is an example : to confirm"); assert.match(g[0].text, /Gate proposé : Pin gate/);
  assert.ok(partIssues(s).some((x) => x.level === "todo" && /mold : Gate proposé/.test(x.text)), "the guide of the top bar says it too");
  // the designer chooses an edge gate : it stands at the parting line, on a short side, and is no longer an example
  const s2 = { ...s, mold: { ...s.mold, gating: { kind: "edge" }, cosmetic: ["-X"] } }, p2 = moldPlan(s2, b), g2 = moldGuide(p2);
  assert.deepEqual([p2.gate.kind, p2.gate.auto, p2.gate.face, p2.gate.at[2]], ["edge", false, "-X", p2.parting.level]); assert.ok(b.bbox[3] - b.bbox[0] > b.bbox[4] - b.bbox[1], "the housing is longer along X");
  assert.deepEqual(g2.map((x) => x.level), ["error", "tip"]); assert.match(g2[0].text, /face -X, déclarée face d'aspect/); assert.match(p2.notes[2], /aucune trace de gate, d'ejector pin ni de riser sur la face -X$/);
  const p3 = moldPlan({ ...s2, mold: { ...s2.mold, gating: { kind: "edge", side: "+X" } } }, b); assert.equal(p3.gate.face, "+X"); assert.deepEqual(moldGuide(p3).map((x) => x.level), ["tip"]);
  assert.equal(moldPlan({ ...s, mold: { ...s.mold, gating: { kind: "stalk" } } }, b).gate.kind, "pin", "a gate that is not of this process is not taken");
  assert.deepEqual(fromDwiz(toDwiz(s2)).mold.gating, { kind: "edge" }, "the choice travels in the .dwiz file"); assert.deepEqual(fromDwiz(toDwiz(s2)).mold.cosmetic, ["-X"]);
  // a housing with nothing in its side walls : two halves are enough
  const s4 = synthesize(closed("PC-ABS"), "PN-0301").spec, p4 = moldPlan(s4, buildPart(K, s4)); assert.equal(p4.simple, true); assert.match(p4.notes[0], /open \/ close \(aucun slide\)$/); assert.match(p4.log.join(" "), /Mold simple : deux moitiés/);
  // clips : windows in the long walls, a slide per row
  const s5 = synthesize(closed("PC-ABS", { closure: "clips" }), "PN-0302").spec, p5 = moldPlan(s5, buildPart(K, s5)); assert.deepEqual(p5.slides.map((x) => x.dir), ["-Y", "+Y"]); assert.ok(p5.slides.every((x) => x.what.includes("Fenêtre de clip")));
});

test("a cast housing : filled from below in low pressure, risers on its bosses, and what they leave once buffed", async () => {
  const K = await kernel(), s = synthesize(closed("AL-A356-T6", { process: "lp_die_casting" }), "PN-0310").spec, b = buildPart(K, s), plan = moldPlan(s, b);
  assert.equal(s.process, "lp_die_casting"); assert.equal(s.mold.process, "lp_die_casting"); assert.ok(s.params.wall.value >= 3 && s.params.wall.min === 3, "low pressure has its own wall range, thinner than gravity"); assert.ok(s.notes.some((n) => /riser tube/.test(n)));
  assert.deepEqual(b.log.filter((l) => l.level === "error"), []); assert.equal(checkPart(s, b).summary.errors, 0, "the casting rules know the process");
  assert.deepEqual([plan.gate.kind, plan.gate.face, plan.gate.at[2]], ["stalk", "-Z", Math.round(b.bbox[2] * 10) / 10], "the metal comes in at the lowest point"); assert.equal(plan.simple, true);
  const top = Math.round(b.bbox[5] * 10) / 10, bosses = b.facts.bosses.filter((x) => x.source === "bossages");
  assert.equal(bosses.length, 4); assert.equal(plan.risers.length, 4, "one riser over each closing boss, at the top of the mold"); assert.ok(plan.risers.every((r) => r.at[2] === top && r.on === "+Z"));
  const want = riserFor(Math.max(bosses[0].d / 4, s.params.wall.value / 2)); assert.ok(plan.risers.every((r) => r.d === want.d && r.h === want.d && r.neck === want.neck));
  assert.deepEqual(plan.risers.map((r) => [r.at[0], r.at[1]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]), bosses.map((x) => [Math.round(x.at[0] * 10) / 10, Math.round(x.at[1] * 10) / 10]).sort((p, q) => p[0] - q[0] || p[1] - q[1]));
  assert.deepEqual(kinds(plan), ["gate", "parting", "ejector", "riser", "riser", "riser", "riser"]); assert.match(plan.witness[3].text, /scié, puis meulé et poncé \(buffed\)\. Il reste une pastille Ø \d+ mm, sur une face reprise en usinage \(1,5 mm de surépaisseur\) : la trace disparaît/);
  assert.match(plan.log.join(" "), /En low pressure, c'est d'abord le gate du bas, tenu sous pression, qui nourrit la pièce/); assert.match(plan.notes[2], /^Risers : 4 sur la face \+Z, sciés puis poncés \(buffed\) à fleur ; les faces usinées gardent 1,5 mm de surépaisseur$/);
  assert.match(routing(s, b).steps.map((x) => x.text).join(" | "), /low pressure die casting.*Scier le gate et les risers, meuler et poncer \(buff\) à fleur/); assert.match(orderCheck(s, b, null, routing(s, b)).drivers.join(" "), /Low pressure die casting \(LPDC\) : 30 à 60 jours/);
  // the same alloy poured by gravity : a gate at the parting line, on a short side ; in sand, a core where a metal mold would have a slide
  const g = synthesize(brief("AL-A356-T6"), "PN-0311").spec, gb = buildPart(K, g), gp = moldPlan(g, gb);
  assert.equal(g.process, "sand_casting"); assert.deepEqual([gp.gate.kind, gp.gate.face, gp.gate.at[2]], ["gravity", "-X", gp.parting.level]); assert.deepEqual(gp.slides.map((x) => [x.dir, x.kind]), [["-Y", "core"]]); assert.ok(kinds(gp).includes("core") && !kinds(gp).includes("ejector"), "a sand mold has no ejector pins");
  assert.match(gp.notes[0], /^Mold : Sand casting — .*1 core\(s\) en sable \(-Y\)$/); assert.match(moldGuide(gp).map((x) => x.text).join(" "), /à noyauter \(-Y\) : un core par forme, ou une reprise d'usinage/);
  const pm = moldPlan({ ...g, process: "permanent_mold", mold: { ...g.mold, process: "permanent_mold" } }, gb); assert.deepEqual(pm.slides.map((x) => x.kind), ["slide"]); assert.equal(pm.risers.length, gp.risers.length); assert.ok(kinds(pm).includes("ejector"));
  // a riser on a face that must stay clean, and risers placed by hand
  assert.ok(moldGuide(moldPlan({ ...s, mold: { ...s.mold, cosmetic: ["+Z"] } }, b)).some((x) => x.level === "check" && x.field === "risers" && /pastille visible/.test(x.text)));
  const hand = moldPlan({ ...s, mold: { ...s.mold, risers: [{ at: [20, 30], d: 24 }] } }, b); assert.deepEqual(hand.risers.map((r) => [r.at, r.d, r.why]), [[[20, 30, top], 24, "placé par le concepteur"]]);
  // high pressure : no riser — overflows and vents, opposite the ingate
  const h = synthesize(closed("AL-A380"), "PN-0312").spec, hp = moldPlan(h, buildPart(K, h));
  assert.equal(h.process, "die_casting"); assert.deepEqual(hp.risers, []); assert.deepEqual([hp.gate.kind, hp.gate.face, hp.overflow.face], ["ingate", "-X", "+X"]); assert.deepEqual(kinds(hp), ["gate", "parting", "ejector", "overflow"]); assert.match(hp.notes[2], /côté ejector die/);
});

test("the mold shows on the model, reads without the kernel, and goes to an AI or a moldmaker", async () => {
  const K = await kernel(), s = synthesize(brief("AL-A356-T6", { process: "permanent_mold" }), "PN-0320").spec, b = buildPart(K, s), plan = moldPlan(s, b), marks = moldMarks(plan, 120);
  const by = (k) => marks.filter((m) => m.kind === k);
  assert.deepEqual(by("parting").map((m) => m.t), ["loop", "label"]); assert.deepEqual(by("pull").map((m) => m.t), ["arrow", "label"]); assert.deepEqual(by("slide").map((m) => m.t), ["arrow", "label"]); assert.deepEqual(by("gate").map((m) => m.t), ["cyl", "label"]);
  assert.equal(by("riser").filter((m) => m.t === "cyl").length, plan.risers.length); assert.equal(by("neck").length, plan.risers.length); assert.ok(by("riser").filter((m) => m.t === "cyl").every((m) => m.a[2] > plan.parting.level && m.b[2] > m.a[2] && m.opacity < 1), "a riser stands above the part, on its neck");
  assert.ok(marks.every((m) => m.color && (m.t !== "label" || m.text)) && marks.some((m) => m.text === "Parting line") && marks.some((m) => /^Gate — Sprue, runner and ingate$/.test(m.text))); assert.deepEqual(moldMarks(null), []);
  // before the part is built : the box written in its mold block is enough for the gate and the parting line
  const dry = moldPlan(s); assert.equal(dry.parting.level, s.mold.H); assert.equal(dry.gate.kind, "gravity"); assert.equal(dry.risers.length, 2, "no boss known yet : the wall is fed at the middle of its long sides"); assert.ok(dry.risers.every((r) => /aucune masse en haut du moule/.test(r.why)));
  assert.equal(moldPlan({ id: "P", process: "cnc_milling" }), null); assert.deepEqual(moldGuide(null), []); assert.equal(isMolded({ process: "cnc_milling" }), false); assert.ok(moldGuide(moldPlan({ id: "P", process: "sand_casting" })).some((x) => /pas encore construite/.test(x.text)));
  const text = moldBrief(s, plan); assert.match(text, /^PN-0320 — Carter de capteur : Permanent mold casting\n/); assert.match(text, /WITNESS MARKS/); assert.match(text, /Riser pads \(R1\)/); assert.match(text, /Consigne : revoir ce plan de moule comme le ferait un mouliste ou un fondeur/); assert.match(text, /gating \{ kind, side \}/);
  for (const w of Object.values(WITNESS)) assert.ok(w.label && /^#/.test(w.color));
});
