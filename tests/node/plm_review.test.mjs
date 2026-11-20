// From a frozen revision to a released one : the states, the list of a lean design review, what stands in the way of a
// decision, the decision written on the record, and the sheet of the review.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { release, releases, plmRows, freeze } from "../../web/js/core/plm.js";
import { REV_STATES, stateOf, revisionOf, reviewItems, reviewProblems, decide, reviewDoc } from "../../web/js/core/plm_review.js";
import { reviewItems as ledger } from "../../web/js/core/review.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { NEWS } from "../../web/js/core/whats_new.js";
import { METHODS } from "../../web/js/core/methods.js";
import { glossary } from "../../web/js/core/terms.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"), D = (d) => new Date(Date.UTC(2026, 0, d));
const part = (id) => ({ dw: "part/1", id, name: `Pièce ${id}`, family: "prismatic", process: "cnc_milling", material: "AL6061-T6", params: {}, interfaces: [], features: [{ op: "box", size: [40, 20, 10] }] });
const project = () => ({ id: "P", name: "Projet", parts: [part("BASE"), part("CAPOT")], assemblies: [{ dw: "assembly/1", id: "ASM", name: "Ensemble", instances: [{ id: "i1", part: "BASE", fixed: true }, { id: "i2", part: "CAPOT", at: [0, 0, 10] }], mates: [] }], boards: [] });
const tick = (items) => Object.fromEntries(items.filter((x) => x.how === "confirm").map((x) => [x.id, true]));

test("the states of a revision : in work, frozen, released, refused — each with its word, its English, its colour", () => {
  assert.deepEqual(Object.keys(REV_STATES), ["working", "frozen", "released", "rejected"]); assert.deepEqual(Object.values(REV_STATES).map((s) => [s.label, s.en]), [["En travail", "In work"], ["Gelée", "Frozen"], ["Libérée", "Released"], ["Refusée", "Rejected"]]);
  assert.equal(new Set(Object.values(REV_STATES).map((s) => s.color)).size, 4); for (const s of Object.values(REV_STATES)) assert.ok(s.icon && s.text.length > 30);
  const p = project(); assert.deepEqual(revisionOf(p, "part:BASE", p.parts[0]), { name: "sans numéro", state: "working", rec: null, moved: false });
  const r = freeze(p, "part:BASE", { date: D(1), by: "Léa" }); assert.equal(r.release.state, "frozen"); assert.equal(stateOf(r.release), "frozen");
  let info = revisionOf(p, "part:BASE", p.parts[0]); assert.equal(info.name, `${r.pn} rév. A`); assert.equal(info.state, "frozen"); assert.equal(info.moved, false);
  p.parts[0].notes = ["Ébavurer."]; info = revisionOf(p, "part:BASE", p.parts[0]); assert.equal(info.moved, true, "the project moved on : the frozen revision did not"); assert.equal(releases(p)[0].doc.notes, undefined, "once frozen, nothing changes");
  assert.equal(stateOf({ key: "part:X" }), "frozen", "a revision frozen before the review existed waits for its review");
  assert.equal(ledger(p).find((x) => x.key === "part:BASE").state !== "ok", true, "freezing is not validating");
});

test("the list of a lean review : what the tool checks itself, what the approver confirms", () => {
  const p = project(), a = release(p, "part:BASE", { date: D(1), by: "Léa" }).release;
  let items = reviewItems(p, a, {}); assert.deepEqual(items.map((x) => [x.id, x.how]), [["intact", "auto"], ["need", "confirm"], ["drawing", "confirm"], ["make", "confirm"]]); assert.equal(items[0].state, "ok");
  items = reviewItems(p, a, { dfx: { errors: 0, warns: 2 } }); assert.deepEqual(items.find((x) => x.id === "dfx"), { id: "dfx", label: "Bilan DFx", how: "auto", state: "warn", text: "Aucun point bloquant ; 2 à vérifier.", blocking: false });
  assert.equal(reviewItems(p, a, { dfx: { errors: 1, warns: 0 } }).find((x) => x.id === "dfx").blocking, true, "a DFx point to correct holds the release");
  a.doc.notes = ["altérée"]; assert.equal(reviewItems(p, a, {})[0].state, "fail", "a frozen content that was altered is seen"); delete a.doc.notes;
  /* an assembly is released only with released parts */
  release(p, "part:CAPOT", { date: D(2), by: "Léa" }); const asm = release(p, "assembly:ASM", { date: D(3), by: "Léa" }).release; let ai = reviewItems(p, asm, { builds: { errors: 0 } });
  assert.equal(ai.find((x) => x.id === "children").state, "fail"); assert.match(ai.find((x) => x.id === "children").text, /Pas encore libéré : BASE .*CAPOT/); assert.equal(ai.find((x) => x.id === "builds").state, "ok");
  for (const r of releases(p).filter((x) => x.key.startsWith("part:"))) decide(p, r.id, { by: "Samuel", why: "Conforme au besoin.", ticks: tick(reviewItems(p, r, {})), date: D(4) });
  ai = reviewItems(p, asm, {}); assert.equal(ai.find((x) => x.id === "children").state, "ok"); assert.match(ai.find((x) => x.id === "children").text, /2 révision\(s\) épinglée\(s\), toutes libérées/);
  /* a board : its rules, and whether it was measured */
  const b = { key: "board:B", pn: "PCB-1", rev: "A", doc: { id: "B" }, sig: "x" }, bi = reviewItems(p, b, { erc: { error: 0, warn: 1 }, drc: { error: 2, warn: 0 }, lab: { tests: 12, measured: 0 } });
  assert.deepEqual(bi.filter((x) => x.how === "auto").map((x) => [x.id, x.state, x.blocking]), [["intact", "fail", true], ["erc", "warn", false], ["drc", "fail", true], ["lab-read", "warn", false]]); assert.deepEqual(bi.filter((x) => x.how === "confirm").map((x) => x.id), ["need", "lab", "fab"]);
});

test("the decision : an approver who is not the author, a justification, every point confirmed — then released, in the record", () => {
  const p = project(), rec = release(p, "part:BASE", { date: D(1), by: "Léa" }).release, items = reviewItems(p, rec, {});
  assert.deepEqual(reviewProblems(rec, items, {}), ["L'approbateur n'est pas nommé.", "La justification de la décision n'est pas écrite.", "À confirmer : La pièce répond à sa fonction et à ses interfaces.", "À confirmer : Son dessin de définition est à jour avec cette révision.", "À confirmer : Le procédé, la matière et les tolérances sont ceux que le fournisseur tient."]);
  assert.match(reviewProblems(rec, items, { by: " léa ", why: "ok", ticks: tick(items) })[0], /quelqu'un d'autre que l'auteur de la révision \(Léa\)/, "the author cannot approve his own revision, whatever the case of the letters");
  assert.throws(() => decide(p, rec.id, { by: "Léa", why: "ok", ticks: tick(items) }), /quelqu'un d'autre que l'auteur/); assert.equal(stateOf(rec), "frozen", "nothing was written");
  assert.throws(() => decide(p, rec.id, { by: "Samuel", why: "ok", ticks: {} }), /À confirmer/); assert.throws(() => decide(p, rec.id, { by: "Samuel", why: "ok", ticks: tick(items), facts: { dfx: { errors: 3, warns: 0 } } }), /Bilan DFx — 3 point\(s\) à corriger/);
  assert.match(reviewProblems({ ...rec, by: "" }, items, { by: "Samuel", why: "ok", ticks: tick(items) })[0], /L'auteur de la révision n'est pas nommé/);
  const done = decide(p, rec.id, { by: "Samuel", why: "Conforme au besoin, dessin relu.", open: ["Confirmer la tolérance du perçage", " "], ticks: { ...tick(items), make: "na" }, date: D(5) });
  assert.equal(done.state, "released"); assert.deepEqual([done.review.by, done.review.decision, done.review.at.slice(0, 10), done.review.open.length], ["Samuel", "released", "2026-01-05", 1]); assert.deepEqual(done.review.items.map((x) => x.state), ["ok", "ok", "ok", "na"]);
  assert.equal(ledger(p).find((x) => x.key === "part:BASE").state, "ok", "a released revision is a validated one"); assert.match(p.review.items["part:BASE"].history.at(-1).note, /libérée par Samuel — Conforme au besoin/);
  assert.match(reviewProblems(done, items, { by: "X", why: "y", ticks: tick(items) })[0], /déjà libérée : sa revue est close/); assert.throws(() => decide(p, "nope", {}), /introuvable/);
  assert.deepEqual(plmRows(p)[0].slice(3, 5), ["Libérée", "Samuel (2026-01-05)"]); assert.deepEqual(revisionOf(p, "part:BASE", p.parts[0]).state, "released");
  /* the open points of a review come back at the next one */
  p.parts[0].notes = ["v2"]; const next = release(p, "part:BASE", { date: D(6), by: "Léa" }).release; assert.equal(next.rev, "B"); const again = reviewItems(p, next, {}); assert.equal(again[1].id, "open"); assert.match(again[1].text, /rév\. A : Confirmer la tolérance du perçage/);
  /* refusing : a name and a reason are enough ; the revision stays in the record, and the work goes on in the next one */
  assert.deepEqual(reviewProblems(next, again, { decision: "rejected", by: "Samuel" }), ["La raison du refus n'est pas écrite."]);
  const no = decide(p, next.id, { decision: "rejected", by: "Samuel", why: "La tolérance n'est pas tenue par le fournisseur.", date: D(7) }); assert.equal(no.state, "rejected"); assert.equal(releases(p).length, 2, "nothing is erased");
  p.parts[0].notes = ["v3"]; assert.equal(release(p, "part:BASE", { date: D(8), by: "Léa" }).release.rev, "C");
});

test("the sheet of a review, and the screen", () => {
  const p = project(), rec = release(p, "part:BASE", { date: D(1), by: "Léa" }).release; let doc = reviewDoc(p, rec, { date: D(2) }), text = JSON.stringify(doc.blocks);
  assert.equal(doc.reference, `${rec.pn}-REV-A`); for (const w of ["Gelée (Frozen)", "en attente", "l'approbateur", "l'outil", "Une fois gelée, une révision ne change plus"]) assert.ok(text.includes(w), w); assert.ok(doc.blocks.some((b) => b.type === "signatures"));
  decide(p, rec.id, { by: "Samuel", why: "Conforme.", ticks: tick(reviewItems(p, rec, {})), date: D(3) }); doc = reviewDoc(p, rec, { date: D(3) }); text = JSON.stringify(doc.blocks); for (const w of ["Libérée (Released)", "LIBÉRÉE", "Samuel", "Conforme."]) assert.ok(text.includes(w), w);
  assert.ok(pdfDoc({ ...doc, kind: "Revue de conception" }).length > 8000);
  const screen = read("web/js/modules/plm.js"), dialog = read("web/js/modules/plm_review.js");
  assert.match(screen, /"Geler la révision…"/); assert.match(screen, /"Geler la révision suivante…"/); assert.ok(!/"Libérer…"|Libérer la suite/.test(screen), "« Libérer… » is gone : one freezes, then a review releases");
  assert.match(screen, /revisionChip\(info\)/, "the name and the state of the revision are on the line"); assert.match(screen, /b\.dataset\.revReview = ""/); assert.match(screen, /Nommez l'auteur de la révision/);
  assert.match(dialog, /"data-rev-state": info\.state/); assert.match(dialog, /store\.commit\(`\$\{rec\.pn\} rév\. \$\{rec\.rev\} \$\{decision === "released" \? "libérée" : "refusée"\}`/, "the decision is one undoable step"); assert.match(dialog, /release\.disabled = pr\.length > 0/);
  assert.ok(NEWS.some((n) => n.id === "rev-freeze" && n.sel === "[data-rev-freeze]") && NEWS.some((n) => n.id === "rev-review")); assert.equal(METHODS.find((m) => m.id === "plm-review").how, "own");
  const g = glossary().map((r) => r.en); for (const t of ["Frozen revision", "Released revision", "Design review"]) assert.ok(g.includes(t), t);
});
