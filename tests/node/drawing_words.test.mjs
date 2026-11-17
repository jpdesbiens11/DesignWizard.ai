/* The English of a drawing : which texts of the project a sheet writes, their English kept once for the project, the
   round trip with an AI — and the demonstration projects, whose drawings must leave no text without its English. */
import test from "node:test";
import assert from "node:assert/strict";
import { partTexts, asmTexts, drawingTexts, tidyWords, sayWith, wordsLeft, wordsUnused, wordsIssues, wordsBrief, readWords } from "../../web/js/core/drawing_words.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { DEMO_ROVER } from "../../web/js/demo/demo_rover.js";
import { DEMO_ROCKET } from "../../web/js/demo/demo_rocket.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../../web/js/demo/demo_hvb.js";
import { WORDS_DRIVE, WORDS_ROVER, WORDS_ROCKET, WORDS_HVB } from "../../web/js/demo/demo_words.js";
import { say, inDrawingWords } from "../../web/js/draw/dim_model.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";

const part = { id: "P-1", name: "Support du capteur", finish: "Anodisé noir", notes: ["Ébavurer.", "  ", "Ébavurer."], params: { L: { value: 40, label: "Longueur" }, n: 4, t: { value: 2 } },
  interfaces: [{ id: "IF1", name: "Fixation sur la base" }, { id: "IF2" }, { id: "IF3", name: "Fixation sur la base" }] };
const project = { name: "Banc d'essai", parts: [part, { id: "P-2", name: "Capot" }], assemblies: [{ id: "A-1", name: "Ensemble", notes: ["Serrer à 2 N·m."], instances: [{ id: "i1", part: "P-1" }, { id: "i2", part: "P-2" }, { id: "i3", part: "P-2" }] }] };

test("the texts a sheet writes : the project's own words, each once, in the order of the sheet", () => {
  assert.deepEqual(partTexts(part, project), ["Support du capteur", "Anodisé noir", "Fixation sur la base", "Longueur", "Ébavurer.", "Banc d'essai"]);
  assert.deepEqual(partTexts({ id: "X" }), []); assert.deepEqual(partTexts(null), []);
  assert.deepEqual(asmTexts(project.assemblies[0], [{ kind: "part", name: "Support du capteur" }, { kind: "hardware", name: "Socket head cap screw M3" }, { kind: "part", name: "Capot" }], project), ["Ensemble", "Support du capteur", "Capot", "Serrer à 2 N·m.", "Banc d'essai"], "a purchased item already has its name");
  assert.deepEqual(drawingTexts(project, "part:P-1"), partTexts(part, project)); assert.deepEqual(drawingTexts(project, "assembly:A-1"), ["Ensemble", "Support du capteur", "Capot", "Serrer à 2 N·m.", "Banc d'essai"]); assert.deepEqual(drawingTexts(project, "part:nope"), []); assert.deepEqual(drawingTexts(null, "assembly:A-1"), []);
});

test("the words of a project : a text is said in English when the project gave its English, as typed otherwise", () => {
  const words = { "Support du capteur": " Sensor bracket ", Longueur: "Length", "": "x", vide: "  ", nombre: 3 };
  assert.deepEqual(tidyWords(words), { "Support du capteur": "Sensor bracket", Longueur: "Length" }); assert.deepEqual(tidyWords(null), {}); assert.deepEqual(tidyWords("x"), {});
  const en = sayWith(words); assert.deepEqual([en("Support du capteur"), en("Longueur"), en("Anodisé noir"), en(undefined), en(""), en(12)], ["Sensor bracket", "Length", "Anodisé noir", undefined, "", 12]);
  assert.equal(sayWith(null)("Capot"), "Capot"); assert.equal(sayWith({ toString: "x" })("toString"), "x"); assert.equal(sayWith({})("toString"), "toString", "a text is never confused with a word of the language");
  const texts = partTexts(part, project); assert.deepEqual(wordsLeft(words, texts), ["Anodisé noir", "Fixation sur la base", "Ébavurer.", "Banc d'essai"]); assert.deepEqual(wordsLeft({}, []), []);
  assert.deepEqual(wordsUnused({ ...project, drawing: { words: { Capot: "Cover", "Ancien nom": "Old name", Ensemble: "Assembly" } } }), ["Ancien nom"], "a name that changed leaves a word nobody reads"); assert.deepEqual(wordsUnused(project), []);
  // the drawing reads them for the time of one composition
  assert.equal(say("Capot"), "Capot"); assert.equal(inDrawingWords(sayWith({ Capot: "Cover" }), () => say("Capot")), "Cover"); assert.equal(say("Capot"), "Capot"); assert.throws(() => inDrawingWords(sayWith({}), () => { throw new Error("x"); })); assert.equal(inDrawingWords(null, () => say("Capot")), "Capot");
});

test("the guide counts the texts left as typed ; the list goes to an AI and comes back for the human to check", () => {
  const texts = partTexts(part, project);
  assert.deepEqual(wordsIssues(Object.fromEntries(texts.map((t) => [t, t])), texts), []); const [tip] = wordsIssues({ Longueur: "Length" }, texts); assert.equal(tip.level, "tip"); assert.match(tip.text, /^5 textes du projet sont écrits tels quels sur ce dessin en anglais \(« Support du capteur », « Anodisé noir », « Fixation sur la base »…\)/);
  assert.match(wordsIssues({}, ["Capot"])[0].text, /^1 texte du projet est écrit tel quel .* donnez-lui son anglais/);
  const brief = wordsBrief(texts, { Longueur: "Length" }), sent = JSON.parse(brief.slice(brief.indexOf("{"))); assert.match(brief, /anglais de dessin technique/); assert.deepEqual(Object.keys(sent), texts); assert.equal(sent.Longueur, "Length"); assert.equal(sent["Anodisé noir"], "");
  const reply = "Voici :\n```json\n" + JSON.stringify({ "Support du capteur": "Sensor bracket", "Anodisé noir": "Black anodize", "Autre chose": "Something else", "Ébavurer.": "" }) + "\n```", got = readWords(reply, texts);
  assert.deepEqual(got.words, { "Support du capteur": "Sensor bracket", "Anodisé noir": "Black anodize" }); assert.deepEqual(got.unknown, ["Autre chose"]); assert.deepEqual(got.empty, ["Fixation sur la base", "Longueur", "Ébavurer.", "Banc d'essai"]);
  assert.throws(() => readWords("pas de JSON", texts), /Aucun objet JSON/); assert.throws(() => readWords("{ oups }", texts), /JSON lisible/); assert.throws(() => readWords("[1]", texts), /Aucun objet JSON/);
});

test("the demonstration projects leave no text of their drawings without its English, and keep no word nobody reads", () => {
  const hvb = { name: "DEMO-HVB — busbars 800 V (référence creepage)", parts: DEMO_HVB_PARTS, assemblies: [DEMO_HVB_ASSEMBLY], drawing: { words: WORDS_HVB } };
  for (const [p, words, least] of [[DEMO_DRIVE, WORDS_DRIVE, 70], [DEMO_ROVER, WORDS_ROVER, 95], [DEMO_ROCKET, WORDS_ROCKET, 90], [hvb, WORDS_HVB, 7]]) {
    assert.equal(p.drawing.words, words); const texts = [...new Set([...p.parts.flatMap((s) => partTexts(s, p)), ...p.assemblies.flatMap((a) => drawingTexts(p, `assembly:${a.id}`))])];
    assert.ok(texts.length >= least, `${p.name} : ${texts.length} texts`); assert.deepEqual(wordsLeft(words, texts), [], `${p.name} : every text has its English`); assert.deepEqual(wordsUnused(p), [], `${p.name} : no word left behind`);
    for (const [fr, en] of Object.entries(words)) { assert.ok(en && en === en.trim(), fr); assert.ok(!/[àâçéèêëîïôûùüÿœ]/i.test(en), `« ${en} » reads as English`); assert.ok(!/\d,\d/.test(en), `« ${en} » : a decimal point on a drawing`); } }
  for (const p of [DEMO_DRIVE, DEMO_ROVER, DEMO_ROCKET]) assert.deepEqual(fromDwiz(toDwiz(p)).drawing, JSON.parse(JSON.stringify(p.drawing)), `${p.id} : the words survive the .dwiz file of the project`);
  assert.equal(WORDS_DRIVE["Base du boîtier"], "Housing base"); assert.equal(WORDS_DRIVE["Planéité de la face d'appui 0,1 mm."], "Flatness of the seating face 0.1 mm.");
  // the caution of the rocket example travels with its English
  assert.match(WORDS_ROCKET[Object.keys(WORDS_ROCKET).find((k) => /^Exemple de CAO/.test(k))], /^CAD example: concept geometry, neither sized nor validated\./); assert.match(WORDS_ROCKET[Object.keys(WORDS_ROCKET).find((k) => /^Récipient sous pression/.test(k))], /none of this is done here/);
});
