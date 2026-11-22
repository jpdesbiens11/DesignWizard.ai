/* Exchange with DynamiteAgile in its own file format : the functional analysis of a design as a Project Starter file,
   checked with the rules of that format, and the functional tree of such a file read into a board. */
import test from "node:test";
import assert from "node:assert/strict";
import { toProjectStarter, checkStarter, importDiamond, starterKey, STARTER_FORMAT } from "../../web/js/core/dynamite.js";
import { readFirstDesign } from "../../web/js/core/first_design.js";
import { FIRST_DESIGN_ANSWER } from "../../web/js/demo/demo_first_design.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { demoBoard } from "../../web/js/demo/demo_pcba.js";
import { emptyBoard } from "../../web/js/pcba/model.js";
import { draftsOf } from "../../web/js/core/ai_draft.js";

const D0 = new Date(Date.UTC(2026, 0, 5)), clone = (x) => JSON.parse(JSON.stringify(x));
const starter = () => ({ format: STARTER_FORMAT, format_version: 1, language: "fr", project: { key: "SONDE", name: "Sonde de température" },
  diamond: { functions: [{ ref: "F1", text: "Mesurer la température d'un liquide", type: "usage", parent: null }, { ref: "F2", text: "Capter la température", parent: "F1", kano: "B", importance: "indispensable" }, { ref: "F3", text: "Convertir la résistance en tension", parent: "F2" },
    { ref: "F4", text: "Pont diviseur et filtre", type: "technique", parent: "F3" }, { ref: "F5", text: "Afficher la mesure", parent: "F1", notes: "Lisible à un mètre." }, { ref: "F6", text: "Résister aux projections", type: "contrainte", parent: "F1", kano: "C", critical: true }, { ref: "F7", text: "Plaire à l'œil", type: "estime", parent: null }],
    ports: [{ ref: "E1", side: "in", label: "Chaleur du liquide", kind: "energy" }, { ref: "S1", side: "out", label: "Valeur lue", kind: "information" }],
    flows: [{ view: "general", kind: "energy", label: "chaleur", src: "E1", dst: "F2" }, { view: "general", kind: "information", label: "tension", src: "F2", dst: "F5" }, { view: "general", kind: "information", src: "F5", dst: "S1" }, { view: "detail", kind: "energy", src: "E1", dst: "F3" }],
    parts: [{ ref: "P1", name: "Sonde NTC", kind: "bought", functions: ["F2", "F3"] }, { name: "Boîtier", functions: ["F6"] }] } });

test("a design leaves as a Project Starter file that holds by the rules of the format", () => {
  for (const project of [readFirstDesign(FIRST_DESIGN_ANSWER, { date: D0 }).project, { ...DEMO_DRIVE, boards: [demoBoard()] }, { name: "Vide", parts: [], boards: [] }]) {
    const { file, notes } = toProjectStarter(project, { date: D0 }); assert.deepEqual(checkStarter(file), [], project.name); assert.deepEqual(notes, []);
    assert.equal(file.format, "dynamite-project-starter"); assert.equal(file.format_version, 1); assert.equal(file.generated_at, "2026-01-05"); assert.equal(file.generated_by, "DesignOrbit.ai"); assert.match(file.project.key, /^[A-Z][A-Z0-9]{1,9}$/);
    assert.equal(file.diamond.functions[0].ref, "F0"); assert.equal(file.diamond.functions[0].type, "usage"); assert.equal(file.diamond.functions[0].parent, null);
  }
  const p = readFirstDesign(FIRST_DESIGN_ANSWER, { date: D0 }).project, d = toProjectStarter(p, { date: D0 }).file.diamond, fn = (ref) => d.functions.find((f) => f.ref === ref);
  assert.equal(d.functions.length, 24); assert.equal(fn("F2").text, "Alimenter la logique à partir du 24 V"); assert.equal(fn("F2").parent, "F0"); assert.match(fn("F2").notes, /Tension d'entrée : 18 à 30 V.*Brouillon IA/); assert.equal(fn("F7").type, "contrainte"); assert.equal(fn("F7").kano, "C");
  assert.ok(d.functions.filter((f) => f.type === "technique").length >= 13 && d.functions.filter((f) => f.type === "technique").every((f) => fn(f.parent).parent === "F0"), "the block functions are the technique functions, under the function they realise");
  assert.equal(fn("M1").text, p.parts[0].function); assert.deepEqual(d.parts.map((x) => [x.ref, x.kind, x.functions.join(",")]), [["TMP-BOITIER", "designed", "M1"], ["TMP-COUVERCLE", "designed", "M2"], ["TMP-CARTE", "designed", "F1,F2,F3,F4,F5,F6,F7"], ["TMP-PLATINE", "designed", "M3"]]);
  assert.ok(d.ports.length >= 1 && d.ports.every((x) => ["in", "out"].includes(x.side))); assert.ok(d.flows.some((f) => f.src === "E1" && f.dst === "F2" && f.kind === "energy" && /\+24V_IN/.test(f.label)), "the 24 V enters by the connector and goes to the supply function");
  assert.ok(d.flows.every((f) => f.view === "general" && f.src !== f.dst) && d.flows.some((f) => f.kind === "information"));
  // text is cleaned to what the format takes : no tag, 160 characters, a key of capitals
  const odd = toProjectStarter({ name: "ça <b>4x4</b>", description: `${"Très long. ".repeat(40)}`, parts: [{ id: "A", name: "x".repeat(200), function: `Tenir <i>fort</i> ${"y".repeat(300)}`, family: "purchased" }], boards: [] }, { date: D0 }).file;
  assert.deepEqual(checkStarter(odd), []); assert.equal(odd.diamond.parts[0].kind, "bought"); assert.ok(odd.diamond.functions[1].text.length <= 160 && !/[<>]/.test(odd.diamond.functions[1].text)); assert.equal(odd.project.key, "CAB4X4B");
  assert.deepEqual(["Module de température CAN", "4x4", "é", ""].map(starterKey), ["MODULEDETE", "X4", "EDW", "DW"]);
});

test("the rules of the format are checked one by one", () => {
  assert.deepEqual(checkStarter(starter()), []);
  const broke = (change, expect) => { const f = starter(); change(f); const faults = checkStarter(f); assert.ok(faults.some((t) => expect.test(t)), `${expect} — ${JSON.stringify(faults)}`); };
  broke((f) => { f.format = "autre"; }, /^format : « autre »/); broke((f) => { f.format_version = 9; }, /format_version/); broke((f) => { f.project.key = "sonde"; }, /project\.key/); broke((f) => { delete f.project.name; }, /project\.name/);
  broke((f) => { f.diamond.functions[0].type = "estime"; }, /première fonction sans parent est la fonction primaire/); broke((f) => { f.diamond.functions[2].parent = "F9"; }, /fonction « F9 » introuvable plus haut/);
  broke((f) => { f.diamond.functions[3].type = "usage"; }, /niveau 4 : trois niveaux, une fonction technique seule/); broke((f) => { f.diamond.functions[4].ref = "F2"; }, /déjà utilisée/); broke((f) => { f.diamond.functions[1].text = "x".repeat(161); }, /plus de 160/);
  broke((f) => { f.diamond.functions[1].kano = "Z"; }, /kano/); broke((f) => { f.diamond.functions[1].importance = "vitale"; }, /importance/); broke((f) => { f.diamond.functions[1].text = "Capter <b>fort</b>"; }, /balise HTML/);
  broke((f) => { f.diamond.ports[0].side = "gauche"; }, /ports\[0\]\.side/); broke((f) => { f.diamond.ports[1].ref = "F2"; }, /ports\[1\]\.ref/); broke((f) => { f.diamond.ports[0].kind = "magie"; }, /ports\[0\]\.kind/);
  broke((f) => { f.diamond.flows[0].src = "S1"; }, /« S1 » est une sortie/); broke((f) => { f.diamond.flows[2].dst = "E1"; }, /« E1 » est une entrée/); broke((f) => { f.diamond.flows[1].dst = "F3"; }, /« F3 » n'est pas une fonction de la vue general/);
  broke((f) => { f.diamond.flows[3].dst = "F4"; }, /« F4 » n'est pas une fonction de la vue detail/); broke((f) => { f.diamond.flows[1].dst = "F2"; }, /vers lui-même/); broke((f) => { f.diamond.flows.push({ src: "E1", dst: "S1" }); }, /entrée directement vers une sortie/);
  broke((f) => { f.diamond.parts[0].functions = ["F4"]; }, /fonction hors de la structure/); broke((f) => { f.diamond.parts[0].kind = "volée"; }, /parts\[0\]\.kind/); broke((f) => { f.diamond.functions = []; }, /sans arbre fonctionnel/);
  broke((f) => { f.diamond.ports = Array.from({ length: 41 }, (_, i) => ({ ref: `E${i + 10}`, side: "in", label: "x" })); }, /diamond\.ports : 41 éléments \(au plus 40\)/);
  assert.deepEqual(checkStarter(null), ["fichier : objet JSON attendu"]);
});

test("the functional tree of a DynamiteAgile file becomes the functions of a board : drafts, nothing deleted, twice changes nothing", () => {
  const b = emptyBoard("SONDE-PCBA", "Carte de la sonde"), mine = { id: "F1", parent: null, name: "Afficher la mesure", kind: "principale", criteria: [{ name: "Écran", level: "3 chiffres" }], block: null }; b.functions.push(mine);
  const before = clone(b), dry = importDiamond(b, starter(), true); assert.deepEqual(dry, { added: 5, same: 1, primary: "Mesurer la température d'un liquide", problems: [] }); assert.deepEqual(b, before, "a dry run changes nothing");
  assert.deepEqual(importDiamond(b, starter()), dry); assert.equal(b.description, "Mesurer la température d'un liquide", "the primary function is the product : it names the board, it is not one of its functions");
  const byName = (n) => b.functions.find((f) => f.name === n), cap = byName("Capter la température"), conv = byName("Convertir la résistance en tension"), pont = byName("Pont diviseur et filtre");
  assert.deepEqual(b.functions[0], mine, "what was there is left alone"); assert.equal(cap.parent, null); assert.equal(conv.parent, cap.id); assert.equal(pont.parent, conv.id); assert.equal(pont.kind, "technique"); assert.equal(byName("Résister aux projections").kind, "contrainte"); assert.match(byName("Résister aux projections").note, /Critique/);
  assert.match(byName("Plaire à l'œil").note, /estime/); assert.ok(b.functions.slice(1).every((f) => f.ai && f.ai.draft)); assert.equal(draftsOf(b).filter((w) => w.list === "functions").length, 5, "they wait in the tree as « Brouillon IA »");
  assert.deepEqual(importDiamond(b, starter()), { added: 0, same: 6, primary: dry.primary, problems: [] }); assert.equal(b.functions.length, 6);
  const bad = starter(); bad.diamond.functions[2].parent = "F9"; const r = importDiamond(b, bad); assert.equal(r.added, 0); assert.match(r.problems[0], /introuvable plus haut/); assert.equal(b.functions.length, 6);
  // there and back : what DesignOrbit.ai writes, DesignOrbit.ai reads
  const out = toProjectStarter({ name: "Sonde", description: b.description, parts: [], boards: [b] }, { date: D0 }).file, again = emptyBoard("X", "x"); assert.deepEqual(checkStarter(out), []);
  assert.equal(importDiamond(again, out).added, 6); assert.deepEqual(again.functions.map((f) => f.name).sort(), b.functions.map((f) => f.name).sort());
});
