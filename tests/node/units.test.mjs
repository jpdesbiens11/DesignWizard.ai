/* Units : SI inside, converted at the edges. Two systems — SI, and an imperial engineering hybrid that keeps the metre, the
   metre per second and the kilogram — and a choice of its own for a pressure : kPa, bar, psi, atm. */
import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_SYSTEMS, PRESSURE_UNITS, SI_UNITS, CALC_UNITS, tidyUnits, pressureUnit, shownUnit, toShown, fromShown, converts, dualOf, pressureEquivalents, quantity, fieldValue, getUnits, setUnits, shownNumber, measure, measures, massText, proseUnits, docUnits } from "../../web/js/core/units.js";
import { MODELS, model, defaults, run } from "../../web/js/analysis/physics/index.js";
import { sceneOf } from "../../web/js/analysis/physics/scene3d.js";
import { physicsSummary, qty } from "../../web/js/modules/physics_panels.js";

const IMP = { system: "imperial" }, near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("the preferences are tidy : two systems, four pressure units, SI by default", () => {
  assert.deepEqual(Object.keys(UNIT_SYSTEMS), ["si", "imperial"]); assert.deepEqual(Object.keys(PRESSURE_UNITS), ["kPa", "bar", "psi", "atm"]);
  assert.deepEqual(tidyUnits(null), { system: "si", pressure: "auto" }); assert.deepEqual(tidyUnits({ system: "cgs", pressure: "torr" }), { system: "si", pressure: "auto" }); assert.deepEqual(tidyUnits({ system: "imperial", pressure: "bar" }), { system: "imperial", pressure: "bar" });
  assert.deepEqual(tidyUnits({ pressure: "toString" }), { system: "si", pressure: "auto" }, "a name of the language is not a unit");
  assert.equal(pressureUnit(SI_UNITS), "kPa"); assert.equal(pressureUnit(IMP), "psi"); assert.equal(pressureUnit({ system: "imperial", pressure: "atm" }), "atm"); assert.equal(pressureUnit({ pressure: "bar" }), "bar");
  assert.deepEqual(getUnits(), { system: "si", pressure: "auto" }, "without a browser : SI"); assert.deepEqual(setUnits({ system: "imperial" }), { system: "imperial", pressure: "auto" }); assert.equal(getUnits().system, "imperial"); setUnits({ system: "si" });
  assert.deepEqual(setUnits({ system: "imperial", pressure: "bar" }), { system: "imperial", pressure: "auto" }, "the choice is the system : a pressure follows it"); assert.deepEqual(setUnits({ pressure: "atm" }), { system: "imperial", pressure: "auto" }); setUnits({ system: "si" });
  assert.deepEqual(CALC_UNITS, { system: "si", pressure: "auto" }, "a calculation is written in SI, whatever the design is read in"); assert.equal(shownUnit("MPa", CALC_UNITS), "MPa"); assert.equal(fieldValue(12.5, "mm", CALC_UNITS), 12.5);
});

test("in a document, the sections that report calculations stay as written", () => {
  const doc = { title: "Revue", blocks: [{ type: "h1", text: "Pièces" }, { type: "p", text: "Paroi de 2 mm." }, { type: "h1", text: "Physique — modèles analytiques" }, { type: "p", text: "Contrainte : 120 MPa sous 500 N." },
    { type: "table", head: ["Question", "Résultat"], rows: [["Flèche", "0,8 mm"]] }, { type: "h2", text: "Détail" }, { type: "p", text: "Portée de 80 mm." }, { type: "h1", text: "Assemblage" }, { type: "p", text: "Jeu de 0,5 mm." },
    { type: "h2", text: "Isolation — creepage et clearance (IEC 60664-1)" }, { type: "p", text: "Clearance de 5,5 mm." }, { type: "h2", text: "DFA — montage" }, { type: "p", text: "Vis à 4 mm du bord." }] };
  const B = docUnits(doc, IMP, { si: /^(?:Physique — modèles analytiques|Isolation — creepage)/ }).blocks;
  assert.equal(B[1].text, "Paroi de 0,0787 in."); assert.equal(B[3].text, "Contrainte : 120 MPa sous 500 N.", "the calculation keeps its megapascals and its newtons"); assert.deepEqual(B[4].rows, [["Flèche", "0,8 mm"]]);
  assert.equal(B[6].text, "Portée de 80 mm.", "a sub-section belongs to its section"); assert.equal(B[8].text, "Jeu de 0,0197 in.", "the next section of the same level is converted again");
  assert.equal(B[10].text, "Clearance de 5,5 mm.", "a section may be kept at any level"); assert.equal(B[12].text, "Vis à 0,157 in du bord.");
  assert.equal(docUnits(doc, IMP).blocks[3].text, "Contrainte : 17,4 ksi sous 112 lbf.", "without the pattern, everything is converted");
});

test("the factors are the defined ones, and they agree with one another", () => {
  near(toShown(25.4, "mm", IMP), 1); near(toShown(1, "µm", IMP), 39.37007874015748); near(toShown(645.16, "mm²", IMP), 1); near(toShown(6.4516, "cm²", IMP), 1); near(toShown(25.4 ** 4, "mm⁴", IMP), 1);
  near(toShown(4.4482216152605, "N", IMP), 1); near(toShown(0.45359237 * 9.80665, "N", IMP), 1, 1e-12);                       // a pound-force is a pound under standard gravity
  near(toShown(1, "kPa", IMP), 0.1450377377302092, 1e-12); near(toShown(4.4482216152605 / 645.16, "MPa", IMP), 0.001, 1e-12);        // a psi is a pound-force on a square inch
  near(toShown(6.894757293168361, "MPa", IMP), 1); near(toShown(6.894757293168361, "GPa", IMP), 1); near(toShown(6894.757293168361, "Pa", IMP), 1);
  near(toShown(4.4482216152605 * 0.0254, "N·m", IMP), 1); near(toShown(1, "N·m", IMP), 8.8507, 1e-5); near(toShown(4.4482216152605 * 25.4, "N·mm", IMP), 1); near(toShown(4.4482216152605 / 25.4, "N/mm", IMP), 1); near(toShown(1, "N/mm", IMP), 5.7101, 1e-5);
  near(toShown(231 * 25.4 ** 3 / 1e6, "L/min", IMP), 1, 1e-12);                                                              // a US gallon is 231 cubic inches
  near(toShown(101.325, "kPa", { pressure: "atm" }), 1); near(toShown(100, "kPa", { pressure: "bar" }), 1); near(toShown(6.894757293168361, "kPa", { pressure: "psi" }), 1); assert.equal(toShown(12, "kPa", SI_UNITS), 12);
  assert.deepEqual(dualOf(0.45359237, "kg", IMP), [1, "lb"]); near(dualOf(453.59237, "g", IMP)[0], 16); assert.equal(dualOf(1, "kg", SI_UNITS), null); assert.equal(dualOf(1, "mm", IMP), null);
});

test("imperial is a hybrid : the inch, the pound-force and what derives from them — the metre, the m/s and the kg stay", () => {
  const shown = { "mm": "in", "µm": "µin", "mm²": "in²", "cm²": "in²", "mm³": "in³", "mm⁴": "in⁴", "N": "lbf", "kN": "lbf", "N·m": "lbf·in", "N·mm": "lbf·in", "N/mm": "lbf/in", "N·m/rad": "lbf·in/rad", "MPa": "ksi", "GPa": "Msi", "kPa": "psi", "Pa": "psi", "L/min": "gal/min" };
  for (const [u, v] of Object.entries(shown)) { assert.equal(shownUnit(u, IMP), v, u); assert.equal(shownUnit(u, SI_UNITS), u); assert.ok(converts(u, IMP)); assert.ok(!converts(u, SI_UNITS)); }
  for (const u of ["m", "m/s", "kg", "g", "kg/m³", "°C", "K", "K/W", "W", "W/m·K", "W/m²·K", "J/kg·K", "A", "A/mm²", "mPa·s", "m³/h", "s", "Hz", "%", "°", ""]) { assert.equal(shownUnit(u, IMP), u, `« ${u} » stays`); assert.equal(toShown(3.5, u, IMP), 3.5); assert.ok(!converts(u, IMP)); }
  // every unit a model reads or writes is either kept or converted : nothing falls through, and nothing reads in slugs
  const units = new Set(); for (const m of MODELS) for (const d of [...m.inputs, ...m.outputs]) units.add(d.unit || "");
  for (const u of units) { const s = shownUnit(u, IMP); assert.equal(typeof s, "string"); assert.ok(!/slug|pdl|poundal|BTU|°F|ft/i.test(s), `${u} → ${s}`); }
  assert.ok(units.has("mm") && units.has("kPa") && units.has("MPa") && units.has("L/min"));
  assert.equal(quantity(1.83, "kg", IMP), "1,83 kg (4,034495849943583 lb)".replace("4,034495849943583", String(1.83 / 0.45359237).replace(".", ","))); assert.equal(quantity(1.83, "kg", SI_UNITS), "1,83 kg"); assert.equal(quantity(528.7, "", IMP), "528,7");
  assert.equal(qty(1.83, "kg", IMP), "1,83 kg (4,034 lb)"); assert.equal(qty(25.4, "mm", IMP), "1 in"); assert.equal(qty(0.1326, "m/s", IMP), "0,1326 m/s");
});

test("a value typed comes back clean : a quarter of an inch is 6.35 mm, and a field shows five digits", () => {
  assert.equal(fromShown(0.25, "mm", IMP), 6.35); assert.equal(fromShown(1, "kPa", { pressure: "bar" }), 100); assert.equal(fromShown(1, "kPa", { pressure: "atm" }), 101.325); assert.equal(fromShown(7, "mm", SI_UNITS), 7); assert.equal(fromShown(2, "m/s", IMP), 2);
  assert.equal(fromShown(null, "mm", IMP), null); assert.ok(Number.isNaN(fromShown(NaN, "mm", IMP)));
  for (const [v, u] of [[4, "mm"], [1000, "mm"], [1.5, "µm"], [0.1, "L/min"], [10, "kPa"], [69, "GPa"], [250, "MPa"], [50, "N"], [12, "N·m"]]) near(fromShown(toShown(v, u, IMP), u, IMP), v, 1e-11);
  assert.equal(fieldValue(4, "mm", IMP), 0.15748); assert.equal(fieldValue(1000, "mm", IMP), 39.37); assert.equal(fieldValue(10, "kPa", IMP), 1.4504); assert.equal(fieldValue(10, "kPa", { pressure: "bar" }), 0.1); assert.equal(fieldValue(1.23456789, "mm", SI_UNITS), 1.23456789); assert.equal(fieldValue(null, "mm", IMP), null);
});

test("a pressure reads in the four units, the chosen one first", () => {
  const eq = pressureEquivalents(101.325, SI_UNITS); assert.deepEqual(eq.map((e) => e[0]), ["kPa", "bar", "psi", "atm"]); near(eq[1][1], 1.01325); near(eq[2][1], 14.695948775513, 1e-11); near(eq[3][1], 1);
  assert.deepEqual(pressureEquivalents(1, IMP).map((e) => e[0]), ["psi", "kPa", "bar", "atm"]); assert.deepEqual(pressureEquivalents(1, { pressure: "atm" }).map((e) => e[0]), ["atm", "kPa", "bar", "psi"]); assert.deepEqual(pressureEquivalents(NaN), []);
});

test("the pressure loss in a round pipe reads in kPa, psi, bar and atm, and the model follows the system", () => {
  const m = model("pipe_flow"), r = run("pipe_flow", defaults("pipe_flow")), dp = r.values.dp_kPa;
  near(dp, 128 * 1.002e-3 * 1 * (0.1 / 60000) / (Math.PI * 0.004 ** 4) / 1000, 0.02);                                         // Hagen-Poiseuille, water at 20 °C, by hand
  const eq = Object.fromEntries(pressureEquivalents(dp, SI_UNITS)); near(eq.psi, dp * 0.1450377377302092, 1e-12); near(eq.bar, dp / 100); near(eq.atm, dp / 101.325);
  assert.equal(shownUnit(m.outputs.find((o) => o.key === "dp_kPa").unit, { pressure: "psi" }), "psi"); assert.equal(shownUnit(m.inputs.find((d) => d.key === "d").unit, IMP), "in"); assert.equal(shownUnit(m.inputs.find((d) => d.key === "Q").unit, IMP), "gal/min"); assert.equal(shownUnit(m.outputs.find((o) => o.key === "v").unit, IMP), "m/s", "a speed stays in m/s");
  // the same calculation whatever is shown : the inputs stay SI inside
  const typed = { ...defaults("pipe_flow"), d: fromShown(0.25, "mm", IMP) }; near(run("pipe_flow", typed).values.dp_kPa, dp * (4 / 6.35) ** 4, 1e-9);
  const saved = { physics: [{ id: "p1", name: "Tube", model: "pipe_flow", values: r.values, checks: r.checks, verdict: r.verdict }] };
  assert.match(physicsSummary(saved, SI_UNITS)[0].result, /^Perte de charge : 0,26\d+ kPa$/); assert.match(physicsSummary(saved, IMP)[0].result, /^Perte de charge : 0,038\d+ psi$/); assert.match(physicsSummary(saved, { pressure: "bar" })[0].result, /^Perte de charge : 0,0026\d+ bar$/);
  assert.equal(physicsSummary(saved)[0].result, physicsSummary(saved, SI_UNITS)[0].result, "SI when nothing is chosen");
  const si = sceneOf(m, defaults("pipe_flow")).labels.map((l) => l.text).join(" / "), imp = sceneOf(m, defaults("pipe_flow"), IMP).labels.map((l) => l.text).join(" / ");
  assert.match(si, /Ø4 intérieur · L = 1000 mm/); assert.match(si, /Q = 0,1 L\/min/); assert.match(imp, /Ø0,157 in intérieur · L = 39,4 in/); assert.match(imp, /Q = 0,0264 gal\/min/);
  for (const mod of MODELS) for (const l of sceneOf(mod, defaults(mod.id), IMP).labels) assert.ok(!/NaN|undefined| mm\b|\bkPa\b/.test(l.text), `${mod.id} : « ${l.text} »`);
});

test("a length, a mass, a list of dimensions : the tools keep their millimetres, the screens write the unit chosen", () => {
  assert.deepEqual([measure(12.5, "mm", 2), measure(12.5, "mm", 2, IMP), measure(42, "mm", 1, IMP), measure(0.5, "mm", 2, IMP)], ["12,5 mm", "0,4921 in", "1,654 in", "0,01969 in"]);
  assert.deepEqual([shownNumber(12.3456, "mm", 2), shownNumber(12.3456, "mm", 2, IMP), shownNumber(Infinity, "mm"), shownNumber(45, "°", 1, IMP)], [12.35, 0.486, Infinity, 45], "d decimals in the tool's unit, four significant digits when it converts");
  assert.equal(measures([160, 110, 42], "mm", 1), "160 × 110 × 42 mm"); assert.equal(measures([160, 110, 42], "mm", 1, IMP), "6,299 × 4,331 × 1,654 in"); assert.equal(measure(58.3, "cm³", 1, IMP), "3,558 in³"); assert.equal(measure(800, "mm²", 2, IMP), "1,24 in²");
  assert.deepEqual([massText(111.13), massText(1830), massText(111.13, IMP), massText(1830, IMP), massText(NaN)], ["111,1 g", "1,83 kg", "111,1 g (3,92 oz)", "1,83 kg (4,03 lb)", "—"], "a mass keeps the kilogram and adds the pound");
  assert.equal(measure(NaN, "mm"), "—"); assert.equal(measure(3, "", 0, IMP), "3"); assert.equal(measure(2.5, "mm", 2, IMP, (x) => String(x)), "0.09843 in", "the caller's own way to write a number");
});

test("a sentence written in millimetres is read in the unit chosen : every quantity where it stands, nothing else", () => {
  const same = ["Vis M3 × 0,5, prise 1,5 d, ISO 2768-mK, 90°, 25 °C, 3 A/mm², 100 mm/s, 12 V, 4 trous."];
  for (const t of same) { assert.equal(proseUnits(t, IMP), t); assert.equal(proseUnits(t, SI_UNITS), t); }
  assert.equal(proseUnits("Enveloppe 160 × 110 × 42 mm, masse 111,1 g.", SI_UNITS), "Enveloppe 160 × 110 × 42 mm, masse 111,1 g.", "nothing changes in SI");
  assert.equal(proseUnits("Enveloppe 160 × 110 × 42 mm, masse 111,1 g.", IMP), "Enveloppe 6,3 × 4,33 × 1,65 in, masse 111,1 g (3,92 oz).");
  assert.equal(proseUnits("Lèvre de plus de 3 mm, profondeur de 0,2 à 0,4 mm ; jeu 0,2–0,4 mm ; ±0,05 mm.", IMP), "Lèvre de plus de 0,118 in, profondeur de 0,00787 à 0,0157 in ; jeu 0,00787–0,0157 in ; ±0,00197 in.");
  assert.equal(proseUnits("Break sharp edges 0.2 to 0.5 mm; deburr.", IMP), "Break sharp edges 0.00787 to 0.0197 in; deburr.", "a sentence written with points keeps its points");
  assert.equal(proseUnits("Section 3 mm² ; 276 MPa ; 69 GPa ; 12 N/mm ; 1 250 N ; 15 N·m ; 2,5 kN ; 35 µm ; 58,3 cm³ ; barres de 6 000 mm.", IMP), "Section 0,00465 in² ; 40 ksi ; 10 Msi ; 68,5 lbf/in ; 281 lbf ; 133 lbf·in ; 562 lbf ; 1380 µin ; 3,56 in³ ; barres de 236 in.");
  assert.equal(proseUnits("Masse 1,83 kg ; 12 kPa ; 2,5 L/min.", IMP), "Masse 1,83 kg (4,03 lb) ; 1,74 psi ; 0,66 gal/min."); assert.equal(proseUnits("12 kPa et 3 mm", { system: "si", pressure: "bar" }), "0,12 bar et 3 mm", "a pressure has its own choice");
  assert.equal(proseUnits("les 4 trous de 3,4 mm", IMP), "les 4 trous de 0,134 in", "a count is not a thousand"); assert.equal(proseUnits("", IMP), ""); assert.equal(proseUnits(null, IMP), null); assert.equal(proseUnits(12, IMP), 12);
  // what comes back in millimetres is what was typed : a field converts both ways
  for (const mm of [3, 6.35, 12.7, 160, 0.2]) near(fromShown(fieldValue(mm, "mm", IMP), "mm", IMP), mm, 1e-4);
});

test("« a / b mm » is two quantities in the unit that follows ; a document to read is converted block by block, what it is made of left alone", () => {
  assert.equal(proseUnits("clr 16,56 / 6,27 mm · crp 26 / 6,27 mm", IMP), "clr 0,652 / 0,247 in · crp 1,02 / 0,247 in", "measured / required : never one in inches and the other in millimetres");
  assert.equal(proseUnits("Clé six pans de 3 mm ; serrer à 2,5 N·m, cordon de 6 mm", IMP), "Clé six pans de 3 mm ; serrer à 22,1 lbf·in, cordon de 0,236 in", "the size of a metric tool is its name, not a measure");
  assert.equal(proseUnits("Poser la clé. Fente de 3 mm", IMP), "Poser la clé. Fente de 0,118 in", "the tool of another sentence protects nothing");
  assert.equal(proseUnits("3 A/mm² ; 1,27 g/cm³ ; 1/4 de tour ; 100 mm/s", IMP), "3 A/mm² ; 1,27 g/cm³ ; 1/4 de tour ; 100 mm/s", "a rate and a fraction are not a pair of lengths");
  const png = new Uint8Array([1, 2, 3]), when = new Date("2026-11-17T12:00:00Z");
  const doc = { title: "Gamme — plaque de 3 mm", reference: "P-1-GAMME", date: when, blocks: [{ type: "h1", text: "Perçage de 4,5 mm" }, { type: "p", text: "Serrer à 1,2 N·m.", style: "warn" }, { type: "list", ordered: true, items: ["Foret de 2,5 mm", "Tarauder M3 × 0,5"] },
    { type: "table", head: ["Cote", "Valeur", "Unité"], widths: [40, 30, 30], rows: [["Entraxe", { text: "50 mm", align: "right", fill: "ok" }, ""], ["Paroi", "2,5", "mm"]] }, { type: "kv", rows: [["Masse", "111,1 g"], ["Matière", "PC/ABS"]] }, { type: "figure", png, pngSize: [4, 3], caption: "Vue de 160 × 110 mm" }, { type: "pagebreak" }] };
  assert.equal(docUnits(doc, SI_UNITS), doc, "nothing to do in SI"); assert.equal(docUnits(null, IMP), null);
  const out = docUnits(doc, IMP), B = out.blocks;
  assert.deepEqual([B[0].text, B[1].text, B[1].style, B[2].items, B[2].ordered], ["Perçage de 0,177 in", "Serrer à 10,6 lbf·in.", "warn", ["Foret de 0,0984 in", "Tarauder M3 × 0,5"], true]);
  assert.deepEqual(B[3].rows, [["Entraxe", { text: "1,97 in", align: "right", fill: "ok" }, ""], ["Paroi", "2,5", "mm"]], "a value and its unit in two cells stay together, in millimetres"); assert.deepEqual(B[3].widths, [40, 30, 30]); assert.deepEqual(B[3].head, ["Cote", "Valeur", "Unité"]);
  assert.deepEqual(B[4].rows, [["Masse", "111,1 g (3,92 oz)"], ["Matière", "PC/ABS"]]); assert.equal(B[5].png, png); assert.deepEqual(B[5].pngSize, [4, 3]); assert.equal(B[5].caption, "Vue de 6,3 × 4,33 in"); assert.deepEqual(B[6], { type: "pagebreak" });
  assert.equal(out.title, doc.title, "the title and the reference of the file are its own"); assert.equal(out.date, when); assert.equal(doc.blocks[0].text, "Perçage de 4,5 mm", "the model given is not touched");
});
