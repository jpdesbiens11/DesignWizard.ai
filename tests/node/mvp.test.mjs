/* MVP iterations : the gate before a new MVP, the snapshot, the convergence between iterations, the AI review package and its answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { mvpOf, canOpen, openIteration, freeze, thaw, snapshot, convergence, trend, criteria, recordReview, toggleAction, closeIteration, iterationState, trlReached,
  reviewPackage, readReviewAnswer, applyReview, agenda, mvpRows, TRL, GATES } from "../../web/js/core/mvp.js";
import { reviewItems, approve } from "../../web/js/core/review.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const P = (value) => ({ value, min: 1, max: 500, step: 1, unit: "mm", label: "x" });
const bolt = (side, key, extra = {}) => ({ id: "IF1", type: "bolt_pattern", name: "Fixation", key, side, face: "+Z", at: [10, 10], params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } }, ...extra });
const part = (id, fn, L, ifaces) => ({ dw: "part/1", id, name: id, function: fn, family: "plate", process: "cnc_milling", material: "AL6061-T6", params: { L: P(L), W: P(40), t: P(5) }, interfaces: ifaces, features: [{ op: "box", id: "b", size: ["L", "W", "t"] }] });
const project = () => ({ dw: "project/1", id: "P", name: "Module de puissance", parts: [part("BASE", "Porte le module", 100, [bolt("B", "k1")]), part("CAPOT", "Ferme le module", 100, [bolt("A", "k1"), { ...bolt("A", "ext"), id: "IF2", external: true }])],
  assemblies: [{ dw: "assembly/1", id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT" }], mates: [{ id: "M1", a: { inst: "i2", iface: "IF1" }, b: { inst: "i1", iface: "IF1" }, linked: true }] }], boards: [], physics: [], simulations: [] });
const D = (d) => new Date(`2026-0${d}-01T10:00:00Z`);

test("a new MVP opens only when the one before was frozen, reviewed and closed", () => {
  const p = project(); assert.equal(canOpen(p).ok, true);
  const a = openIteration(p, { goal: "Montrer que le module se monte", trl: 3, date: D(1) }); assert.deepEqual([a.n, a.name, a.trl, a.gate, iterationState(a)], [1, "MVP 1", 3, "iteration", "open"]); assert.equal(mvpOf(p).target, 6);
  assert.equal(canOpen(p).ok, false); assert.match(canOpen(p).why, /gelez-la/); assert.throws(() => openIteration(p), /MVP 1 est ouverte/);
  assert.throws(() => recordReview(p, 1, { kind: "humans" }), /Gelez l'itération/, "a review bears on a frozen state");
  freeze(p, 1, { date: D(2) }); assert.equal(iterationState(a), "frozen"); assert.match(canOpen(p).why, /pas encore de revue/); assert.throws(() => closeIteration(p, 1, "go"), /au moins une revue/);
  assert.equal(thaw(p, 1), true, "no review yet : it can go back to work"); assert.equal(iterationState(a), "open"); freeze(p, 1, { date: D(2) });
  const r = recordReview(p, 1, { kind: "humans", who: "5 personnes : mécanique, électronique, essais", decision: "conditional", notes: "Bon départ.", actions: ["Épaissir le capot"], date: D(2) });
  assert.deepEqual([r.id, r.kind, r.decision, r.actions.length, iterationState(a)], ["R1", "humans", "conditional", 1, "reviewed"]); assert.equal(thaw(p, 1), false, "a reviewed iteration stays frozen"); assert.match(canOpen(p).why, /clore par une décision/);
  assert.equal(toggleAction(p, 1, "R1", 0), true); assert.equal(a.reviews[0].actions[0].done, true);
  closeIteration(p, 1, "conditional", { date: D(3) }); assert.equal(iterationState(a), "closed"); assert.equal(trlReached(p), 3); assert.equal(canOpen(p).ok, true);
  const b = openIteration(p, { date: D(3) }); assert.deepEqual([b.n, b.trl], [2, 4], "the next one aims one level higher");
  freeze(p, 2); recordReview(p, 2, { kind: "ai", decision: "redo" }); closeIteration(p, 2, "redo"); assert.equal(trlReached(p), 3, "an iteration to redo reaches nothing"); assert.equal(openIteration(p).trl, 4, "and the next one aims at the same level");
});

test("the snapshot counts what the project is made of ; convergence says what moved, axis by axis, and its trend", () => {
  const p = project(), s0 = snapshot(p);
  assert.deepEqual(s0.metrics, { parts: 2, assemblies: 1, boards: 0, joints: 1, interfaces: 3, paired: 1, alone: 0, external: 1, functions: 2, reviewed: 0, artefacts: 3 });
  openIteration(p, { date: D(1) }); freeze(p, 1); recordReview(p, 1, { decision: "go" }); closeIteration(p, 1, "go");
  /* MVP 2 : much moves — a part is added, two dimensions change, a function is reworded, an interface changes its screws */
  openIteration(p); p.parts[0].params.L.value = 120; p.parts[1].params.L.value = 120; p.parts[1].function = "Ferme et blinde le module";
  p.parts.push(part("PATTE", "Fixe le module au châssis", 30, [{ ...bolt("A", "k2"), id: "IF1" }])); for (const q of p.parts.slice(0, 2)) q.interfaces[0].params.screw = "M5";
  freeze(p, 2); recordReview(p, 2, { decision: "go" }); closeIteration(p, 2, "go");
  const c = convergence(p.mvp.iterations[0].snapshot, p.mvp.iterations[1].snapshot);
  assert.deepEqual([c.shapes.added, c.shapes.removed, c.shapes.changed], [1, 0, 2], "one part added, two changed ; the assembly did not move"); assert.deepEqual([c.dims.changed, c.dims.total], [2, 6]); assert.ok(Math.abs(c.dims.mean - 0.2) < 1e-9, "20 % on average");
  assert.deepEqual([c.functions.added, c.functions.changed], [1, 1]); assert.deepEqual([c.interfaces.added, c.interfaces.changed], [1, 1]); assert.ok(c.churn > 0.3);
  assert.equal(snapshot(p).metrics.alone, 1, "the new bracket waits for its twin");
  /* MVP 3 : one dimension only */
  openIteration(p); p.parts[2].params.L.value = 32; freeze(p, 3);
  const t = trend(p); assert.deepEqual(t.map((x) => [x.n, x.from, x.verdict]), [[2, 1, "first"], [3, 2, "converge"]]); assert.ok(t[1].c.churn < t[0].c.churn);
  assert.deepEqual([t[1].c.dims.changed, t[1].c.shapes.changed, t[1].c.functions.changed], [1, 1, 0]);
  /* MVP 4 would diverge if everything moved again */
  recordReview(p, 3, { decision: "go" }); closeIteration(p, 3, "go"); openIteration(p); for (const q of p.parts) { q.params.L.value += 7; q.params.W.value += 3; q.function += " — revu"; } freeze(p, 4);
  assert.equal(trend(p).at(-1).verdict, "diverge"); assert.equal(criteria(p, 4).find((x) => x.id === "trend").ok, false);
});

test("the exit criteria read the review ledger, the pairing of the interfaces and the actions", () => {
  const p = project(); openIteration(p); let c = Object.fromEntries(criteria(p, 1).map((x) => [x.id, x]));
  assert.deepEqual([c.frozen.ok, c.review.ok, c.reviewed.ok, c.revise.ok, c.paired.ok, c.actions.ok], [false, false, false, true, true, true]); assert.equal(c.reviewed.value, "0 / 3"); assert.ok(c.frozen.blocking && c.review.blocking && !c.reviewed.blocking);
  for (const it of reviewItems(p)) approve(p, it.key); freeze(p, 1); recordReview(p, 1, { decision: "go", actions: ["Refaire le calcul thermique"] });
  c = Object.fromEntries(criteria(p, 1).map((x) => [x.id, x])); assert.deepEqual([c.frozen.ok, c.review.ok, c.reviewed.ok, c.actions.ok], [true, true, true, false]); assert.equal(c.actions.value, "0 / 1");
  assert.equal(c.trend, undefined, "no trend before a second frozen iteration");
});

test("the AI review package carries the facts and the questions of the level ; its answer comes back as a review, actions and requests for revision", () => {
  const p = project(); openIteration(p, { goal: "Valider les composants", trl: 4, gate: "pdr" }); freeze(p, 1);
  const pack = reviewPackage(p, 1, { dwiz: "project P …", facts: ["accouplements : 1 joint sain"] });
  for (const re of [/revue de conception de « Module de puissance », itération MVP 1 \(Revue préliminaire \(PDR\)\)/, /TRL 4 — Composant ou maquette validé en laboratoire/, /Définition \(NASA, texte officiel\) : « Component and\/or breadboard validation in laboratory environment\. »/, /Commission européenne, Horizon 2020, annexe G\) : « technology validated in lab »/, /2 pièce\(s\), 1 assemblage\(s\), 0 carte\(s\), 1 joint\(s\)/, /accouplements : 1 joint sain/, /DFx sans erreur/, /```revue/, /constat \| /, /LE DOSSIER :\nproject P …/]) assert.match(pack, re);
  const answer = "Voici ma revue.\n```revue\nconstat | CAPOT | majeur | paroi de 5 mm pour une portée de 100 mm | passer à 6 mm ou nervurer\nconstat | BASE | bloquant | aucune prise de filet déclarée | donner la profondeur du taraudage M4\nconstat | projet | remarque | pas de plan d'essai |\nconstat | ASM | grave | couple de serrage absent | l'ajouter\ndecision | accepté avec réserves | deux points à corriger avant essais\n```";
  const r = readReviewAnswer(answer); assert.equal(r.findings.length, 4); assert.equal(r.decision, "conditional"); assert.deepEqual(r.findings[0], { target: "CAPOT", severity: "majeur", text: "paroi de 5 mm pour une portée de 100 mm", action: "passer à 6 mm ou nervurer" });
  assert.equal(r.findings[3].severity, "remarque"); assert.match(r.problems[0], /Gravité inconnue « grave »/);
  const out = applyReview(p, 1, r, { date: D(4) }); assert.deepEqual([out.actions, out.asked], [2, 2]); assert.deepEqual([out.review.kind, out.review.decision], ["ai", "conditional"]); assert.match(out.review.notes, /pas de plan d'essai/);
  const items = Object.fromEntries(reviewItems(p).map((x) => [x.id, x])); assert.equal(items.CAPOT.state, "revise"); assert.match(items.CAPOT.note, /passer à 6 mm/); assert.equal(items.BASE.state, "revise"); assert.equal(items.ASM.state, "todo");
  assert.equal(readReviewAnswer("rien d'utile").problems.length, 1); assert.equal(readReviewAnswer("```revue\nconstat | BASE | bloquant | x | y\n```").decision, null);
  const p2 = project(); openIteration(p2); freeze(p2, 1); assert.equal(applyReview(p2, 1, readReviewAnswer("```revue\nconstat | BASE | bloquant | x | y\n```")).review.decision, "redo", "a blocking finding without a decision means « to redo »");
});

test("the agenda for a review in front of colleagues, the rows of the report, and the round trip of the file", () => {
  const p = project(); openIteration(p, { goal: "Montrer le concept", trl: 3, date: D(1) }); freeze(p, 1, { date: D(2) });
  const a = agenda(p, 1); for (const re of [/MVP 1 — Revue d'itération/, /TRL 3 — Preuve de concept/, /CE QUE LA REVUE DOIT TRANCHER/, /Tous les artéfacts sont revus \? Aujourd'hui : 0 \/ 3/, /DÉCISION : accepté/]) assert.match(a, re);
  recordReview(p, 1, { kind: "humans", decision: "go", date: D(2) }); closeIteration(p, 1, "go", { date: D(3) });
  assert.deepEqual(mvpRows(p), [["MVP 1", "Montrer le concept", "TRL 3", "Revue d'itération", "2026-02-01", "R1 collègues : accepté", "—", "Accepté"]]);
  assert.equal(Object.keys(TRL).length, 9); assert.ok(GATES.pdr && GATES.cdr);
  const back = fromDwiz(toDwiz(p)); assert.deepEqual(back.mvp, p.mvp, "iterations, snapshots and reviews survive the .dwiz file");
});
