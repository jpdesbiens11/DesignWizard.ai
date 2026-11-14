// The .dwiz format: lossless over the JSON model, readable, with clear errors.
import test from "node:test";
import assert from "node:assert/strict";
import { toDwiz, fromDwiz, parseValue, findDwiz } from "../../web/js/core/dwiz.js";
import { KINDS, RESERVED_KINDS, dwizFileName, kindOfDoc } from "../../web/js/core/dwiz_names.js";
import { TEMPLATES, fromTemplate } from "../../web/js/cad/templates.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { DEMO_HVB_PARTS, DEMO_HVB_ASSEMBLY } from "../../web/js/demo/demo_hvb.js";
import { synthesize } from "../../web/js/core/shop_intent.js";
import { validateSpec, buildPart } from "../../web/js/cad/build.js";
import { kernel } from "./kernel_helper.mjs";
import { readFileSync } from "node:fs";

const same = (x) => JSON.parse(JSON.stringify(x));             // what JSON keeps (no undefined)
const round = (x, label) => { const text = toDwiz(x); let back; try { back = fromDwiz(text); } catch (e) { assert.fail(`${label}: ${e.message}\n${text}`); } assert.deepEqual(back, same(x), label); return text; };

test("every template, demo part, assembly and project survives the round trip unchanged", () => {
  for (const t of TEMPLATES) round(fromTemplate(t.key, `T-${t.key}`), `template ${t.key}`);
  for (const p of [...DEMO_DRIVE.parts, ...DEMO_HVB_PARTS]) round(p, `part ${p.id}`);
  for (const a of [...DEMO_DRIVE.assemblies, DEMO_HVB_ASSEMBLY]) round(a, `assembly ${a.id}`);
  const project = round({ ...DEMO_DRIVE, physics: [{ id: "r1", model: "beam_cantilever_point", part: "DRV-COVER", inputs: { L: 200, F: 50 }, values: { delta: 1.159 }, verdict: "ok" }] }, "project");
  assert.equal((project.match(/^dwiz /gm) || []).length, 1 + DEMO_DRIVE.parts.length + DEMO_DRIVE.assemblies.length, "a project file carries its parts and assemblies as documents");
  round([fromTemplate("plate", "A"), fromTemplate("bracket", "B")], "list of parts");
});

test("a part written by the Shop reads like a shop traveller", () => {
  const { spec } = synthesize({ name: "Plaque d'adaptation", fn: "Porte le capteur sur le bâti.", material: "AL6061-T6", quantity: 10,
    interfaces: [{ type: "bolt_pattern", params: { screw: "M5", pattern: { type: "rect", nx: 2, ny: 2, dx: 80, dy: 50 } }, side: "A", where: "-Z", key: "frame_mount", partner: "Bâti", name: "Fixation au bâti" }] }, "PN-0042");
  const text = round(spec, "synthesised");
  const lines = text.split("\n");
  assert.equal(lines[0], 'dwiz part/1 PN-0042 "Plaque d\'adaptation"');
  for (const expected of ['function "Porte le capteur sur le bâti."', "intent quantity=10", "material AL6061-T6", "stock plate L=L W=W t=t", "do interfaces", "do deburr id=ebavurage",
    'note "Casser les angles vifs 0,2 à 0,5 mm"', "  params screw=M5 pattern={type: rect, nx: 2, ny: 2, dx: 80, dy: 50}"]) assert.ok(lines.includes(expected), `missing line: ${expected}\n${text}`);
  assert.ok(lines.some((l) => /^interface IF1 bolt_pattern side=A face=-Z at=\[L\/2, W\/2\] key=frame_mount/.test(l)) && lines.some((l) => /^param L \d+ min=/.test(l)) && lines.some((l) => /^do outline .*profile=\{rect: \[0, 0, L, W\], r: r\}/.test(l)));
  const order = ["# Pourquoi", "# À quoi elle se raccorde", "# De quoi elle est faite", "# Ses poignées", "# Comment elle se fait", "# Ce qu'il faut savoir"].map((h) => lines.findIndex((l) => l.startsWith(h)));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "sections come in the reading order: why, interfaces, matter, parameters, operations, notes");
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual(validateSpec(fromDwiz(text)).errors, []);
  assert.ok(text.length < JSON.stringify(spec, null, 1).length * 0.9, "more compact than indented JSON, comments included");
});

test("awkward values keep their exact type and content", () => {
  const doc = { dw: "part/1", id: "X-1", name: "essai « spécial »", params: { n: 3, wall: "2.5", half: { expr: "L/2" }, "+24V": { value: 24 }, flag: true, none: null },
    features: [{ op: "box", size: ["L - 2*inset", "max(t, 2)", "(H)"], at: [0, -0.5, 1e-7], name: "Base 2", note: "a=b", when: "n >= 3", color: "#b9c6ce", ratio: "10:1", empty: "", sp: " x ", list: [], map: {}, deep: { a: [{ b: [1, "2", "x y"] }] } },
      { op: "hole", face: "+Z", at: { grid: { origin: [10, 10], nx: 2, ny: 2, dx: "L - 20", dy: 60 } }, d: 5, text: "true", q: "?", eq: "=" }, {}],
    notes: ["ligne 1\nligne 2", "x".repeat(400), 'guillemets "doubles" et \\ barre'], "clé avec espace": 1, do: "collision", note: [1, 2], stock: "pas une forme", interfaces: [],
    weird: { "a b": 1, c: { "d-e": [true, false, null] } }, step: { text: "ISO-10303-21;\nHEADER;\nENDSEC;\n", name: "x.step" }, interview: { assumptions: ["une hypothèse"], questions: [{ q: "Charge ?", a: "20 N" }] } };
  const text = round(doc, "awkward");
  assert.ok(text.includes("size=[L - 2*inset, max(t, 2), ((H))]"), "formulas are written bare inside a list");
  assert.ok(text.includes('when=(n >= 3)') && text.includes('name="Base 2"') && text.includes('param wall = "2.5"') && text.includes("param n = 3"));
  assert.ok(text.includes("<<<\nISO-10303-21;") && text.includes('asked q="Charge ?" a="20 N"') && text.includes('assume "une hypothèse"') && text.includes('stock = "pas une forme"'));
  round({ id: "sans-dw", features: [{ op: "box" }], parts: [] }, "no dw field: read word for word");
  round({ dw: "order/1", id: "CMD-1", name: "Lot proto", lines: [{ part: "DW-1", qty: 5 }], need_by: "2026-12-01" }, "a kind of a module to come");
  round({ dw: "project/1", id: "p", name: "vide", parts: [], assemblies: [] }, "empty project");
});

test("reading: comments, French quotes, continuation lines, tabs, and errors that name their line", () => {
  const doc = fromDwiz(`# en-tête libre
dwiz part/1 DW-7 «Entretoise»      # commentaire en bout de ligne
material AL6061-T6
stock bar_round d=D L=L
param D 20 min=8 max=60
\tunit=mm label="Diamètre"
param L = 30
do turn from=20 to=L d=12
do bore d=6 depth=10
note « Ébavurer »
`);
  assert.deepEqual(doc, { dw: "part/1", id: "DW-7", name: "Entretoise", material: "AL6061-T6", stock: { form: "bar_round", d: "D", L: "L" },
    params: { D: { value: 20, min: 8, max: 60, unit: "mm", label: "Diamètre" }, L: 30 }, features: [{ op: "turn", from: 20, to: "L", d: 12 }, { op: "bore", d: 6, depth: 10 }], notes: ["Ébavurer"] });
  assert.deepEqual(validateSpec(doc).errors, []);
  assert.throws(() => fromDwiz("material AL6061-T6"), /Ligne 1 : le fichier doit commencer par « dwiz/);
  assert.throws(() => fromDwiz("dwiz part/1 A\ndo drill d=5 6"), /Ligne 2 : valeur sans nom/);
  assert.throws(() => fromDwiz('dwiz part/1 A\nnote "pas fermé'), /Ligne 2 : guillemet fermant manquant/);
  assert.throws(() => fromDwiz("dwiz part/1 A\nmaterial"), /Ligne 2 : « material » n'a pas de valeur/);
  assert.throws(() => fromDwiz("dwiz part/1 A\ndo drill at=[1, 2"), /Ligne 2/);
  assert.equal(parseValue("(L - 2*inset)"), "L - 2*inset"); assert.equal(parseValue("-1.5e3"), -1500); assert.deepEqual(parseValue("{a: [1, x y, «z»], \"b c\": true}"), { a: [1, "x y", "z"], "b c": true });
  assert.equal(findDwiz("Voici la pièce :\n```\ndwiz part/1 A \"x\"\nmaterial PC\n```\nBonne journée"), 'dwiz part/1 A "x"\nmaterial PC');
  assert.equal(findDwiz('{"dw": "part/1"}'), null);
});

test("names: kinds of today, kinds reserved for the modules to come, file names", () => {
  assert.deepEqual(Object.keys(KINDS), ["part", "assembly", "project"]);
  assert.ok(RESERVED_KINDS.map((k) => k.kind).includes("order") && RESERVED_KINDS.every((k) => !KINDS[k.kind] && k.fr && k.text));
  assert.equal(dwizFileName({ dw: "part/1", id: "DW-0042" }), "DW-0042.part.dwiz"); assert.equal(dwizFileName({ dw: "assembly/1", id: "DRV ASM" }), "DRV_ASM.assembly.dwiz");
  assert.equal(kindOfDoc({ parts: [], assemblies: [] }), "project"); assert.equal(kindOfDoc({ instances: [] }), "assembly");
  for (const K of Object.values(KINDS)) for (const [title, keys] of K.sections) assert.ok(title && keys.length);
});

test("the .dwiz examples of the documentation are real parts: they read, validate and build", async () => {
  const K = await kernel();
  for (const file of ["../../docs/FORMAT.md", "../../README.md"]) {
    const md = readFileSync(new URL(file, import.meta.url), "utf8"), block = /```text\n(dwiz part\/1[\s\S]*?)```/.exec(md);
    assert.ok(block, `${file}: no .dwiz example found`);
    const spec = fromDwiz(block[1]);
    assert.deepEqual(validateSpec(spec).errors, [], file);
    const built = buildPart(K, spec);
    assert.deepEqual(built.log.filter((l) => l.level === "error"), [], file);
    assert.equal(built.interfaces.length, spec.interfaces.length, file);
    assert.ok(built.volume > 1000, file);
    K.flush();
  }
});
