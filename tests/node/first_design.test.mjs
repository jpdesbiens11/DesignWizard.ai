/* A first complete design written by an AI after an interview : the prompt, the reading of the answer — built,
   computed and filed as a draft, never believed — and the design review ledger that follows. */
import test from "node:test";
import assert from "node:assert/strict";
import { kernel } from "./kernel_helper.mjs";
import { buildPart } from "../../web/js/cad/build.js";
import { checkPart } from "../../web/js/analysis/dfx_rules.js";
import { firstDesignPrompt, readFirstDesign, adoptIteration, blockCatalogue, physicsCatalogue, FIRST_DESIGN_BLOCKS } from "../../web/js/core/first_design.js";
import { reviewItems, reviewProgress, approve, askRevision, setNote, markDrafts, changedKeys, iterationRequest, reviewRows, signature, nextRevision, REVIEW_STATES } from "../../web/js/core/review.js";
import { FIRST_DESIGN_ANSWER, FIRST_DESIGN_DESCRIPTION } from "../../web/js/demo/demo_first_design.js";
import { BLOCKS } from "../../web/js/pcba/blocks.js";
import { resolveBoard } from "../../web/js/pcba/model.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { MODELS, run, defaults } from "../../web/js/analysis/physics/index.js";
import { LANGUAGE_REFERENCE } from "../../web/js/cad/language_doc.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const D0 = new Date(Date.UTC(2026, 0, 5)), answer = () => JSON.parse(FIRST_DESIGN_ANSWER), clone = (x) => JSON.parse(JSON.stringify(x));
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);

test("the prompt : the description, an interview with answers to click, the catalogues and the language", () => {
  const p = firstDesignPrompt({ description: FIRST_DESIGN_DESCRIPTION, name: "Module de température" });
  assert.ok(p.includes(FIRST_DESIGN_DESCRIPTION) && p.includes("## Le produit — Module de température"));
  for (const w of [/Une seule question par message/, /Des réponses à cliquer/, /\(Recommandé\)/, /Je ne sais pas/, /C'est bon \(Recommandé\)/, /Ne redemande rien/, /Ne donne AUCUN résultat/, /même "key"/, /UN SEUL objet JSON/, /"dw": "project\/1"/, /"brief"/, /N'écris ni composant ni piste/, /jamais de mot de passe/]) assert.match(p, w);
  for (const id of Object.keys(BLOCKS)) assert.ok(blockCatalogue().includes(`- ${id} — `), id); for (const m of MODELS) assert.ok(physicsCatalogue().includes(`- ${m.id} — `), m.id);
  assert.ok(p.includes(blockCatalogue()) && p.includes(physicsCatalogue()) && p.includes(LANGUAGE_REFERENCE)); assert.match(physicsCatalogue(), /bolted_joint — .*T \[N·m\]/); assert.match(blockCatalogue(), /buck — Régulateur abaisseur \[Alimenter\] : vin=24 V, vout=5 V/);
  assert.equal(FIRST_DESIGN_BLOCKS.length, 6); for (const [title] of FIRST_DESIGN_BLOCKS) assert.ok(p.includes(title)); assert.ok(p.length < 40000, `a prompt an assistant reads at once : ${p.length} characters`);
  assert.match(firstDesignPrompt({}), /aucune description : commence par demander/); assert.ok(!/@|https?:\/\//.test(firstDesignPrompt({})), "no address, no link : nothing to call");
});

test("the answer is read, not believed : parts built, the board made from its blocks, the analyses computed here, everything a draft", async () => {
  const K = await kernel(), src = answer();
  src.physics[1].values = { sigma: 0.001 }; src.physics[1].verdict = "ok"; src.physics[1].checks = [];                    // a result the assistant made up
  const r = readFirstDesign(`Voici le premier design.\n\n\`\`\`json\n${JSON.stringify(src)}\n\`\`\`\n\nÀ vérifier en premier : la hauteur du bornier.`, { description: FIRST_DESIGN_DESCRIPTION, date: D0 }), p = r.project;
  assert.deepEqual(r.counts, { parts: 4, assemblies: 1, boards: 1, physics: 4, pairs: 4, outside: 2, refused: 0, problems: 0 }); assert.equal(r.fix, ""); assert.deepEqual(r.refused, []);
  assert.deepEqual(r.outside, ["TMP-BOITIER « tmp_connecteur »", "TMP-PLATINE « tmp_armoire »"]); assert.equal(p.name, "Module de température CAN"); assert.equal(p.brief.description, FIRST_DESIGN_DESCRIPTION); assert.equal(p.brief.open.length, 4); assert.equal(p.brief.answers[0].q, "Où vit le produit ?");
  for (const s of p.parts) { const b = buildPart(K, s), d = checkPart(s, b, { mesh: K.tessellate(b.bodies[0].shape) }); assert.equal(b.log.filter((l) => l.level === "error").length, 0, s.id); assert.ok(b.volume > 5000, s.id); assert.equal(d.summary.errors, 0, `${s.id} ${JSON.stringify(d.findings.filter((f) => f.severity === "error").map((f) => f.message))}`); assert.equal(s.revision, "A"); }
  const asm = p.assemblies[0]; assert.deepEqual(asm.instances.map((i) => i.part), ["TMP-BOITIER", "TMP-CARTE", "TMP-COUVERCLE", "TMP-PLATINE"]); assert.ok(asm.instances[0].fixed && asm.instances.every((i) => i.placement)); assert.deepEqual(asm.mates, []);
  const b = p.boards[0]; assert.equal(b.id, "TMP-PCBA"); assert.equal(b.part, "TMP-CARTE"); assert.deepEqual(b.board.size, [90, 60]); assert.equal(b.board.holes.length, 4, "outline and mounting holes come from the pcb part");
  assert.equal(b.functions.filter((f) => !f.parent).length, 7); assert.equal(b.blocks.length, 13); assert.ok(b.parts.length > 50 && b.nets.length > 20); assert.deepEqual(resolveBoard(b, LIBRARY).problems, []);
  assert.ok(b.functions.every((f) => f.ai && f.ai.draft) && b.blocks.every((x) => x.ai && x.ai.draft), "every function and block waits for a human"); assert.equal(b.blocks.filter((x) => x.template === "ntc").length, 4);
  const beam = p.physics[1], own = run("beam_cantilever_point", { ...defaults("beam_cantilever_point"), ...beam.inputs });
  assert.deepEqual(beam.values, own.values, "computed here"); assert.notEqual(beam.values.sigma, 0.001); assert.ok(beam.checks.length > 0); assert.equal(beam.part, "TMP-PLATINE"); assert.equal(beam.inputs.E, 69, "the material of the part fills what the assistant left out"); assert.match(beam.why, /porte-à-faux/);
  assert.deepEqual(r.items.map((x) => x.key), ["part:TMP-BOITIER", "part:TMP-COUVERCLE", "part:TMP-CARTE", "part:TMP-PLATINE", "assembly:TMP-ASM", "board:TMP-PCBA", "physics:phy-1", "physics:phy-2", "physics:phy-3", "physics:phy-4"]);
  assert.deepEqual(reviewProgress(p), { total: 10, ok: 0, draft: 10, todo: 0, revise: 0, changed: 0, left: 10, ratio: 0 }); assert.match(r.items[5].facts, /7 fonctions, 13 blocs → \d+ composants/);
  assert.deepEqual(readFirstDesign(src, { date: D0 }).counts, r.counts, "an object is read as well as a text"); p.id = "tmp"; assert.deepEqual(canon(fromDwiz(toDwiz(p))), canon(p), "the project, its brief and its ledger travel in .dwiz without loss");
});

test("what cannot be read is refused with its reason, the rest is kept, and a correction request is ready", () => {
  const src = answer();
  src.parts.push({ id: "TMP-BOITIER", name: "Doublon", features: [{ op: "box", size: [1, 1, 1] }] }, { id: "tmp cassé", name: "Cassée", family: "prismatic", features: [{ op: "teleport", to: "mars" }] });
  src.assemblies[0].instances.push({ id: "i9", part: "TMP-FANTOME" }); src.boards[0].functions[1].blocks.push({ template: "flux_capacitor", params: {} }); src.physics.push({ model: "warp_drive", inputs: {} }, { model: "pcb_trace", part: "NOPE", inputs: { I: 1, bogus: 3 } });
  const r = readFirstDesign(src, { date: D0 });
  assert.equal(r.counts.parts, 4); assert.deepEqual(r.refused.map((x) => `${x.kind} ${x.id}`), ["part TMP-BOITIER", "part TMP-CASS", "physics phy-5"].map((t) => t.replace("TMP-CASS", r.refused[1].id))); assert.match(r.refused[0].why, /double/); assert.match(r.refused[1].why, /teleport/); assert.match(r.refused[2].why, /warp_drive.*inconnu/);
  assert.match(r.items.find((x) => x.kind === "assembly").problems[0], /TMP-FANTOME.*absente/); assert.equal(r.project.assemblies[0].instances.length, 4); assert.match(r.items.find((x) => x.kind === "board").problems[0], /flux_capacitor.*inconnu/); assert.equal(r.project.boards[0].blocks.length, 13);
  const extra = r.items.find((x) => x.key === "physics:phy-6"); assert.ok(extra.notes.some((t) => /bogus/.test(t)) && extra.notes.some((t) => /NOPE.*introuvable/.test(t))); assert.equal(r.project.physics.at(-1).part, null);
  assert.match(r.fix, /^Le fichier que tu m'as rendu a été relu/); for (const w of [/pièce « TMP-BOITIER » refusée : repère en double/, /teleport/, /analyse « phy-5 » refusée/, /assemblage « TMP-ASM » : pièce « TMP-FANTOME »/, /carte « TMP-PCBA » : bloc « flux_capacitor »/]) assert.match(r.fix, w);
  // no assembly given : the parts are put together ; a key carried by three parts is said ; nothing readable : a French message with its remedy
  const lone = answer(); delete lone.assemblies; lone.parts[3].interfaces.push({ ...clone(lone.parts[1].interfaces[0]), id: "IF9" });
  const r2 = readFirstDesign(lone, { date: D0 }); assert.equal(r2.project.assemblies[0].instances.length, 4); assert.match(r2.items.find((x) => x.kind === "assembly").notes[0], /ne donnait pas d'assemblage/); assert.ok(r2.items[0].notes.some((t) => /3 pièces la portent/.test(t)));
  assert.throws(() => readFirstDesign("Bonjour, voici mes idées pour votre produit."), /Aucun design trouvé.*Correctif/s); assert.throws(() => readFirstDesign({ name: "vide" }), /il lui manque la liste « parts »/);
  assert.equal(readFirstDesign(answer().parts[0]).counts.parts, 1, "a single part is a design of one part");
});

test("the review ledger : draft, revise, reviewed — and a reviewed piece that changes makes its next revision", () => {
  assert.equal(signature({ a: 1, b: [1, { c: 2, d: 3 }] }), signature({ b: [1, { d: 3, c: 2 }], a: 1 })); assert.notEqual(signature({ a: 1 }), signature({ a: 2 })); assert.equal(signature({ a: 1, revision: "A" }), signature({ a: 1, revision: "C" }));
  assert.deepEqual(["A", "B", "Z", "AZ", "ZZ", "", "c"].map(nextRevision), ["B", "C", "AA", "BA", "AAA", "B", "D"]);
  const p = readFirstDesign(answer(), { date: D0 }).project, at = (key) => reviewItems(p).find((x) => x.key === key), day = (n) => ({ date: new Date(Date.UTC(2026, 0, 5 + n)) });
  assert.equal(iterationRequest(p), "", "nothing asked yet"); assert.equal(at("part:TMP-BOITIER").state, "draft"); assert.equal(at("part:TMP-BOITIER").facts, "Moulage par injection · PC/ABS"); assert.match(at("physics:phy-2").facts, /^TMP-PLATINE — La platine en porte-à-faux/); assert.equal(at("physics:phy-2").rev, "");
  assert.deepEqual(approve(p, "part:TMP-BOITIER", day(1)), { rev: "A", bumped: false }); assert.equal(at("part:TMP-BOITIER").state, "ok"); assert.deepEqual(at("part:TMP-BOITIER").history.map((h) => [h.rev, h.note]), [["A", "Première revue"]]);
  assert.deepEqual(approve(p, "physics:phy-2", day(1)), { rev: "", bumped: false }); assert.equal(approve(p, "part:NOPE"), null); assert.equal(askRevision(p, "part:NOPE", "x"), false);
  // changed by hand after its review : it says so ; validated again : revision B
  p.parts[0].params.wall.value = 3; assert.equal(at("part:TMP-BOITIER").state, "changed"); assert.equal(reviewProgress(p).changed, 1);
  setNote(p, "part:TMP-BOITIER", "Paroi portée à 3 mm pour la tenue au choc"); assert.equal(at("part:TMP-BOITIER").state, "changed", "a note does not change the state");
  assert.deepEqual(approve(p, "part:TMP-BOITIER", day(3)), { rev: "B", bumped: true }); assert.equal(p.parts[0].revision, "B"); assert.equal(at("part:TMP-BOITIER").state, "ok"); assert.deepEqual(at("part:TMP-BOITIER").history.map((h) => [h.rev, h.note]), [["A", "Première revue"], ["B", "Paroi portée à 3 mm pour la tenue au choc"]]); assert.equal(at("part:TMP-BOITIER").note, "");
  assert.deepEqual(approve(p, "part:TMP-BOITIER", day(4)), { rev: "B", bumped: false }, "validating twice does not make a revision");
  // the reviewer asks : the request for one complete outside iteration carries every note and names what must not move
  assert.ok(askRevision(p, "part:TMP-COUVERCLE", " Passer à 4 mm : trop souple entre les vis ")); setNote(p, "board:TMP-PCBA", "Prévoir une cinquième voie en réserve");
  const req = iterationRequest(p); for (const w of [/À RÉVISER :\n- Pièce TMP-COUVERCLE \(rév\. A\) « Couvercle » : Passer à 4 mm : trop souple entre les vis/, /REMARQUES À PRENDRE EN COMPTE :\n- Carte TMP-PCBA/, /DÉJÀ REVUS[^\n]*TMP-BOITIER, phy-2/, /ne donne aucun résultat/, /même clé/]) assert.match(req, w);
  assert.deepEqual(reviewProgress(p), { total: 10, ok: 2, draft: 7, todo: 0, revise: 1, changed: 0, left: 8, ratio: 0.2 }); assert.deepEqual(reviewRows(p)[1].slice(0, 5), ["Pièce", "TMP-COUVERCLE", "Couvercle", "A", "À réviser"]);
  // the iteration comes back : what it changed is a draft again, what it left alone keeps its state ; the ledger and the brief are the project's own
  const after = clone(p); delete after.review; after.brief = { open: ["effacé par l'assistant"] }; after.parts[1].params.t.value = 4; after.physics[1].inputs.F = 60; after.physics[1].values = { sigma: 1e-9 }; after.physics[2].verdict = "fail";
  const before = clone(p), next = adoptIteration(before, after, day(6)), keys = changedKeys(before, next);
  assert.deepEqual(keys, ["part:TMP-COUVERCLE", "physics:phy-2"]); assert.deepEqual(next.brief, p.brief); assert.deepEqual(next.review, p.review); assert.equal(next.physics[1].inputs.F, 60); assert.ok(next.physics[1].values.sigma > 1, "computed again from the new inputs"); assert.deepEqual(next.physics[2], p.physics[2], "an analysis whose inputs did not move keeps the result computed here");
  assert.equal(markDrafts(next, keys), 2); const st = Object.fromEntries(reviewItems(next).map((x) => [x.key, x.state])); assert.equal(st["part:TMP-COUVERCLE"], "draft"); assert.equal(st["physics:phy-2"], "draft"); assert.equal(st["part:TMP-BOITIER"], "ok"); assert.equal(st["part:TMP-CARTE"], "draft");
  assert.deepEqual(approve(next, "physics:phy-2", day(7)), { rev: "", bumped: false }); assert.deepEqual(approve(next, "part:TMP-COUVERCLE", day(7)), { rev: "A", bumped: false }, "never validated before : this is its first review");
  // an artefact made by hand has never been reviewed ; one that leaves the project leaves the ledger ; the report's own decision lives beside the ledger
  next.parts.push({ dw: "part/1", id: "TMP-CALE", name: "Cale", features: [] }); assert.equal(reviewItems(next).find((x) => x.key === "part:TMP-CALE").state, "todo"); next.parts = next.parts.filter((x) => x.id !== "TMP-PLATINE"); markDrafts(next, []); assert.ok(!("part:TMP-PLATINE" in next.review.items));
  next.review.decision = "Approuvé avec actions"; next.review.actions = [{ text: "Confirmer la classe de flamme", owner: "JP", status: "Ouverte" }]; next.id = "tmp"; assert.deepEqual(canon(fromDwiz(toDwiz(next))), canon(next));
  assert.deepEqual(Object.keys(REVIEW_STATES), ["draft", "todo", "revise", "changed", "ok"]);
});

test("a round trip through .dwiz changes nothing : the list of changes of an iteration shows only what the assistant changed", async () => {
  const { aiDiff, aiRead } = await import("../../web/js/core/ai_loop.js");
  const p = readFirstDesign(answer(), { date: D0 }).project; p.id = "tmp";
  const back = aiRead("Voici.\n```dwiz\n" + toDwiz(p) + "\n```\nRien changé.");
  assert.deepEqual(aiDiff(p, back), [], "keys written in another order are not a change");
  back.parts[1].params.t.value = 4; assert.deepEqual(aiDiff(p, back).map((d) => d.text), ["parts TMP-COUVERCLE.params.t.value : 3 → 4"]);
  assert.deepEqual(aiDiff({ a: [{ op: "x", n: 1 }] }, { a: [{ n: 1, op: "x" }] }), []); assert.equal(aiDiff({ a: [{ op: "x", n: 1 }] }, { a: [{ n: 2, op: "x" }] }).length, 1);
});
