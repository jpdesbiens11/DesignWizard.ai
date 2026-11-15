/* Routing sheets: manufacturing of a part (for the supplier), assembly of a product and of a board (for prototyping). */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { processPlan, stateSpec } from "../../web/js/cad/process_plan.js";
import { assemblyPlan, assemblyOrder } from "../../web/js/core/asm_plan.js";
import { boardAssemblyPlan } from "../../web/js/pcba/assembly_plan.js";
import { planText, planDoc, planKeys, planSummary, PLAN_KINDS } from "../../web/js/core/plan_doc.js";
import { aiBrief } from "../../web/js/core/ai_loop.js";
import { boardSummary } from "../../web/js/pcba/summary.js";
import { fabPackage } from "../../web/js/pcba/fabfiles.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const part = (id) => JSON.parse(JSON.stringify(DEMO_DRIVE.parts.find((p) => p.id === id)));

test("manufacturing routing: phases with station, work holding, tools and checks ; what to hold ; what to ask the supplier", async () => {
  const K = await kernel(), spec = part("DRV-HEATSINK"), built = buildPart(K, spec), plan = processPlan(spec, built, { order: { quantity: 5 } });
  assert.deepEqual(plan.phases.map((p) => p.key), ["stock", "setup:-Z", "deburr", "surface", "check", "pack"]); assert.deepEqual(plan.phases.map((p) => p.n), [10, 20, 30, 40, 50, 60]);
  const mill = plan.phases[1]; assert.match(mill.title, /posage 1, dessous/); assert.match(mill.hold, /face opposée \(dessus\)/); assert.deepEqual(mill.tools, ["Foret Ø3,3", "Taraud M4"]);
  assert.equal(mill.ops[0].n, "20.1"); assert.match(mill.ops[0].text, /Percer 4 × Ø3,3 et tarauder M4/); assert.match(mill.ops[0].control, /Tampon fileté/); assert.equal(mill.ops[0].iface, "IF1");
  assert.equal(plan.phases[3].outsourced, true); assert.match(plan.phases[3].ops[0].text, /Anodisé noir/);
  assert.equal(plan.characteristics.length, 2, "the tapped pattern, and the seat of the insulator"); assert.match(plan.characteristics[0].text, /4 × M4 taraudés, entraxes 60 × 66/); assert.ok(plan.phases[4].checks.some((c) => /4 × M4 taraudés/.test(c)));
  const topics = plan.questions.map((q) => q.topic); for (const t of ["Délai et prix", "Matière", "Filetages", "Finition", "Outillage", "Contrôle"]) assert.ok(topics.includes(t), t);
  assert.match(plan.questions[0].text, /pour 5 pièces \?/); assert.deepEqual(plan.facts[0], ["Matériau", "Aluminium 6063-T5 (extrusion)"]);
  const raw = stateSpec(spec, plan, 0); assert.ok(raw && raw.interfaces.length === 0, "after the first phase : the cut profile, no hole yet"); assert.ok(buildPart(K, raw).volume > built.volume);
  assert.equal(stateSpec(spec, plan, 1), null, "after the machining phase the part is whole"); assert.equal(stateSpec(spec, plan, plan.phases.length - 1), null);
  const text = planText(plan); for (const s of ["GAMME DE FABRICATION — DRV-HEATSINK", " 20  Usinage — posage 1, dessous — Centre d'usinage (reprises)", "Prise de pièce :", "CARACTÉRISTIQUES À TENIR", "POINTS À DISCUTER AVEC LE FOURNISSEUR", "(sous-traité)"]) assert.ok(text.includes(s), s);
  spec.plan = { notes: { "setup:-Z": "Le fournisseur propose un taraudage par déformation." }, points: ["Demander un essai d'anodisation sur chute."] };
  const noted = processPlan(spec, built); assert.equal(noted.phases[1].note, "Le fournisseur propose un taraudage par déformation."); assert.deepEqual(noted.points, ["Demander un essai d'anodisation sur chute."]); assert.ok(planText(noted).includes("Note : Le fournisseur"));
  assert.deepEqual(fromDwiz(toDwiz(spec)), spec, "notes travel in the .dwiz file");
  const cover = part("DRV-COVER"), cp = processPlan(cover, buildPart(K, cover)); assert.equal(cp.phases[0].title, "Mise en forme"); assert.ok(cp.questions.some((q) => /Plan de joint, points d'injection/.test(q.text))); assert.equal(stateSpec(cover, cp, 0), null);
});

test("assembly routing: order from the mated interfaces, screws, torques, tools, checks ; reordered by hand", () => {
  const asm = JSON.parse(JSON.stringify(DEMO_DRIVE.assemblies[0]));
  /* the demonstration gives its own order : the insulator goes in its window before the power board covers it */
  const shipped = assemblyPlan(JSON.parse(JSON.stringify(asm)), DEMO_DRIVE, {}); assert.deepEqual(shipped.order, ["i1", "i5", "i6", "i2", "i3", "i4"]); assert.match(shipped.phases[2].title, /Isolant de la fenêtre thermique/);
  /* the order found alone, on the five screwed parts */
  asm.instances = asm.instances.filter((i) => i.id !== "i6"); asm.mates = asm.mates.filter((m) => m.id !== "M6"); delete asm.plan;
  const plan = assemblyPlan(asm, DEMO_DRIVE, { mass: 812 });
  assert.deepEqual(plan.order, ["i1", "i2", "i3", "i5", "i4"], "base, the two boards, the heat sink, the cover last"); assert.equal(plan.phases.length, 6); assert.equal(plan.phases[5].key, "final");
  const pwr = plan.phases[1]; assert.match(pwr.title, /Monter Carte de puissance/); assert.equal(pwr.ops.length, 3); assert.match(pwr.ops[1].text, /Engager 4 vis .* M3 × \d+ dans les inserts de Base du boîtier/); assert.match(pwr.ops[2].text, /Serrer en croix à 0,6 N·m/);
  assert.ok(pwr.checks.some((c) => /décharges/.test(c)) && pwr.checks.some((c) => /Raccorder J3/.test(c))); assert.ok(pwr.tools.includes("Clé six pans de 2,5 mm"));
  const sink = plan.phases[3]; assert.match(sink.ops[0].text, /interface thermique/); assert.match(sink.ops[3].text, /à 1,95 N·m/, "M4 in an aluminium thread : three quarters of 2.6");
  assert.ok(!plan.phases[1].ops.some((o) => /thermique/.test(o.text)), "no thermal paste under a board");
  assert.deepEqual(plan.hardware.map((h) => [h.qty, h.name.replace(/ISO.*? /, "")]).slice(0, 1), [[12, "Insert à chaud M3"]]); assert.equal(plan.hardware.reduce((s, h) => s + (/^Vis/.test(h.name) ? h.qty : 0), 0), 16);
  assert.ok(plan.facts.some(([k, v]) => k === "Vis" && v === "16 en 2 tailles") && plan.facts.some(([k, v]) => k === "Masse" && v === "812 g"));
  for (const t of ["Posage", "Accès", "Visserie", "Cartes", "Thermique", "Essai", "Couples"]) assert.ok(plan.questions.some((q) => q.topic === t), t);
  asm.plan = { order: ["i1", "i5", "i3", "i2", "i4"], notes: { i5: "Monter le dissipateur en premier : accès par dessous." } };
  const mine = assemblyPlan(asm, DEMO_DRIVE); assert.deepEqual(mine.order, ["i1", "i5", "i3", "i2", "i4"]); assert.equal(mine.phases[1].note, "Monter le dissipateur en premier : accès par dessous.");
  assert.deepEqual(assemblyOrder({ instances: [{ id: "a", part: "X" }, { id: "b", part: "Y" }], mates: [] }, new Map()), ["a", "b"]);
  const lone = assemblyPlan({ id: "A", instances: [{ id: "a", part: "DRV-BASE" }, { id: "b", part: "DRV-COVER" }], mates: [] }, DEMO_DRIVE); assert.ok(lone.questions.some((q) => q.topic === "Tenue")); assert.match(lone.phases[1].ops[0].text, /à la main/);
  assert.deepEqual(fromDwiz(toDwiz(asm)), asm);
});

test("board assembly routing, and the three sheets as text, Word and PDF", () => {
  const b = demoBoard(), plan = boardAssemblyPlan(b, LIBRARY);
  assert.deepEqual(plan.phases.map((p) => p.key), ["prep", "paste_top", "place_top", "reflow_top", "inspect", "tht", "clean", "test", "coat", "final"]);
  assert.match(plan.phases[2].ops[0].control, /3 mires/); assert.match(plan.phases[2].ops[1].text, /LQFP-48, LGA-14/); assert.match(plan.phases[5].ops[0].text, /3 composants : J1, J2, J3/);
  assert.match(plan.phases[7].ops[0].text, /Programmer le microcontrôleur par J3/); assert.match(plan.phases[8].ops[0].text, /Masquer \d+ zones/); assert.ok(plan.questions.some((q) => q.topic === "Vernis") && plan.questions.some((q) => q.topic === "Pas fin"));
  b.board.coating.type = "none"; b.parts.find((p) => p.ref === "R1").side = "bottom";
  const two = boardAssemblyPlan(b, LIBRARY); assert.ok(two.phases.some((p) => p.key === "paste_bottom") && !two.phases.some((p) => p.key === "coat")); assert.ok(two.questions.some((q) => q.topic === "Deux faces") && two.questions.some((q) => q.topic === "Mires"));
  for (const p of [plan, assemblyPlan(DEMO_DRIVE.assemblies[0], DEMO_DRIVE)]) {
    const doc = planDoc(p, { date: new Date("2026-11-14T12:00:00Z"), project: "Variateur compact", author: "Bureau d'études" });
    assert.ok(doc.title.startsWith(PLAN_KINDS[p.kind].title)); assert.equal(doc.blocks.filter((x) => x.type === "h2").length, p.phases.length); assert.ok(doc.blocks.some((x) => x.type === "signatures" && x.roles.length === 2));
    const q = doc.blocks.filter((x) => x.type === "table").pop(); assert.deepEqual(q.head, ["N°", "Sujet", "Question", "Réponse"]); assert.equal(q.rows.length, p.questions.length);
    const z = docx(doc), pdf = new TextDecoder("latin1").decode(pdfDoc(doc));
    assert.ok(z[0] === 0x50 && z[1] === 0x4b && z.length > 8000); assert.ok(pdf.startsWith("%PDF-1.4") && pdf.includes("Page 2 de"));
  }
  assert.match(planText(plan), /^GAMME D'ASSEMBLAGE DE LA CARTE — DRV-CTRL-PCBA/);
  assert.equal(planSummary(plan), "10 phases · 9 points à discuter avec l'assembleur de cartes".replace("9", String(plan.questions.length)));
  const b2 = demoBoard(); b2.plan = { notes: { reflow_top: "Profil sans plomb, pic à 245 °C." }, points: ["Pochoir de 0,12 mm ?"] };
  const noted = boardAssemblyPlan(b2, LIBRARY); assert.equal(noted.phases.find((p) => p.key === "reflow_top").note, "Profil sans plomb, pic à 245 °C."); assert.match(planSummary(noted), /1 note de discussion$/); assert.deepEqual(fromDwiz(toDwiz(b2)), b2);
  assert.match(fabPackage(b2, LIBRARY, { date: new Date("2026-11-14T12:00:00Z") }).files.find((f) => f.key === "gamme").text, /Note : Profil sans plomb/); assert.equal(boardSummary({ boards: [b2] })[0].assembly, planSummary(noted));
  /* the sheet goes to the AI with the artefact, for reference, with the keys its notes are filed under */
  assert.match(planKeys(noted), /reflow_top : \d+ Refusion/); const brief = aiBrief(b2, "Ajoute une note sur le nettoyage.", ["x"], `${planText(noted)}\n\n${planKeys(noted)}`);
  assert.ok(brief.indexOf("POUR RÉFÉRENCE") > brief.indexOf("ARTÉFACT :") && brief.includes("CLÉS DES PHASES") && brief.includes("point \"Pochoir de 0,12 mm ?\""));
});
