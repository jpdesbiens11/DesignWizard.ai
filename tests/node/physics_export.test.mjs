/* What an analytical calculation leaves with : a note at the template of the house (the neutral document model docx() and
   pdfDoc() print) and a workbook laid out like the tool. The formulas of a workbook that is alive are evaluated here, by a
   small reader of spreadsheet formulas, and must give what the platform computes — whatever is typed in the yellow cells. */
import test from "node:test";
import assert from "node:assert/strict";
import { xlsx, cellRef, colName, XL_STYLES } from "../../web/js/core/xlsx.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { physicsDoc, physicsBook, sweep } from "../../web/js/analysis/physics/export.js";
import { XL, XL_LIVE } from "../../web/js/analysis/physics/xl_formulas.js";
import { MODELS, model, run, sessionDefaults } from "../../web/js/analysis/physics/index.js";
import { mediumProps, medium } from "../../web/js/analysis/physics/media.js";
import { FOOT_NOTE, MARK } from "../../web/js/core/brand.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b)), `${a} ≠ ${b}`);
/* the parts of a stored zip : name → text */
function unzip(bytes) { const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Map(), dec = new TextDecoder(); let o = 0;
  while (o + 30 < bytes.length && dv.getUint32(o, true) === 0x04034b50) { const n = dv.getUint16(o + 26, true), x = dv.getUint16(o + 28, true), size = dv.getUint32(o + 18, true), name = dec.decode(bytes.subarray(o + 30, o + 30 + n)); out.set(name, bytes.subarray(o + 30 + n + x, o + 30 + n + x + size)); o += 30 + n + x + size; }
  return out; }
/* a spreadsheet formula, read and computed : numbers, texts, names, + - * / ^, comparisons, IF AND OR MIN MAX SQRT LOG10 PI */
function evalFormula(src, env) {
  const tk = src.match(/"[^"]*"|\d+\.?\d*(?:E[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_.]*|<=|>=|<>|[-+*/^(),<>=&]/g) || []; let p = 0;
  const peek = () => tk[p], eat = (t) => { if (tk[p] !== t) throw new Error(`« ${t} » expected at ${p} in ${src} (got ${tk[p]})`); p++; };
  const FN = { PI: () => Math.PI, SQRT: (x) => Math.sqrt(x), LOG10: (x) => Math.log10(x), MIN: (...a) => Math.min(...a), MAX: (...a) => Math.max(...a), AND: (...a) => a.every(Boolean), OR: (...a) => a.some(Boolean), IF: (c, a, b) => (c ? a : b) };
  const primary = () => { const t = tk[p++];
    if (t === "(") { const v = compare(); eat(")"); return v; }
    if (t === "-") return -power();
    if (/^"/.test(t)) return t.slice(1, -1);
    if (/^\d/.test(t)) return Number(t);
    if (peek() === "(") { p++; const args = []; if (peek() !== ")") { args.push(compare()); while (peek() === ",") { p++; args.push(compare()); } } eat(")"); if (!FN[t]) throw new Error(`function ${t} in ${src}`); return FN[t](...args); }
    if (!(t in env)) throw new Error(`name « ${t} » is not a cell of the workbook (${src})`); return env[t]; };
  const power = () => { const b = primary(); return peek() === "^" ? (p++, b ** power()) : b; };
  const term = () => { let v = power(); while (peek() === "*" || peek() === "/") v = tk[p++] === "*" ? v * power() : v / power(); return v; };
  const sum = () => { let v = term(); while (peek() === "+" || peek() === "-") v = tk[p++] === "+" ? v + term() : v - term(); return v; };
  const compare = () => { const a = sum(), op = peek(); if (!["=", "<>", "<", ">", "<=", ">="].includes(op)) return a; p++; const b = sum(); return op === "=" ? a === b : op === "<>" ? a !== b : op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b; };
  const v = compare(); if (p !== tk.length) throw new Error(`left over in ${src}`); return v;
}
const rowsOf = (sheet) => sheet.rows.map((r) => (Array.isArray(r) ? r : (r && r.cells) || []));
/* the workbook computed here : the yellow cells take `typed`, the cells a medium gives take its properties, every formula of the sheet is evaluated in order */
function compute(book, m, typed) {
  const sheet = book.sheets[0], rows = rowsOf(sheet), at = (ref) => { const mm = /^([A-Z]+)(\d+)$/.exec(ref); let c = 0; for (const ch of mm[1]) c = c * 26 + ch.charCodeAt(0) - 64; return (rows[Number(mm[2]) - 1] || [])[c - 1]; };
  const env = {}, T = typed.T ?? 20;
  for (const [name, ref] of Object.entries(book.cells)) { const cell = at(ref); if (!cell || cell.f) continue; env[name] = cell.v; }
  for (const d of m.inputs) for (const name of Object.keys(book.cells)) if (name.replace(/_+$/, "") === `in_${d.key}` && book.cells[name] === Object.entries(book.cells).find(([n]) => n.replace(/_+$/, "") === `in_${d.key}` && (d.key === d.key.toLowerCase() ? !n.endsWith("_") || true : true))[1] && d.key in typed) { /* set below, by exact name */ }
  const nameOf = (prefix, key) => Object.keys(book.cells).filter((n) => n.replace(/_+$/, "") === `${prefix}_${key}`);
  for (const d of m.inputs) { const names = nameOf("in", d.key); if (names.length === 1 && d.key in typed) env[names[0]] = typed[d.key]; }
  for (const s of m.media) { const c = medium(typed[s.key]); if (!c) continue; const P = mediumProps(c.id, c.at ? T : undefined);
    for (const [key, prop] of Object.entries(s.gives)) for (const n of nameOf("in", key)) env[n] = P[prop]; for (const prop of s.shows || []) for (const n of nameOf("p", prop)) env[n] = P[prop]; }
  const order = Object.entries(book.cells).map(([name, ref]) => ({ name, ref, row: Number(/\d+/.exec(ref)[0]) })).filter((x) => at(x.ref) && at(x.ref).f && /^(h|o)_/.test(x.name)).sort((a, b) => a.row - b.row);
  for (let pass = 0; pass < 4; pass++) for (const x of order) { try { env[x.name] = evalFormula(at(x.ref).f, env); } catch (e) { if (pass === 3) throw e; } }       // a result may read a result written below it
  return env;
}

test("a spreadsheet file : sheets, named cells, formulas, limits, a verdict that changes colour, a picture and a chart — and the mark", () => {
  assert.deepEqual([colName(0), colName(25), colName(26), colName(701), colName(702)], ["A", "Z", "AA", "ZZ", "AAA"]); assert.deepEqual([cellRef(2, 4), cellRef(2, 4, true)], ["C5", "$C$5"]);
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]), book = { title: "Essai & <titre>", subject: "Sujet", author: "Moi", date: new Date("2026-11-16T12:00:00Z"), names: [{ name: "in_x", ref: "Calcul!$B$2" }],
    sheets: [{ name: "Calcul", cols: [20, 12], freeze: 1, merges: ["A1:B1"], rows: [[{ v: "Titre", s: "title" }], [{ v: "x", s: "label" }, { v: 2.5, s: "input" }], { h: 30, cells: [{ v: "y", s: "label" }, { v: 6.25, f: "in_x^2", s: "output" }, { v: "OK", f: 'IF(B3<10,"OK","NON")', s: "verdict" }] }, [null, "texte nu", 7]],
      limits: [{ ref: "B2", min: 0, max: 10, text: "de 0 à 10" }, { ref: "A4", list: ["a", "b"] }, { ref: "A5", listRef: "Autre!$A$1:$A$3" }], verdicts: [{ ref: "C3" }], pictures: [{ png, col: 0, row: 0, w: 10, h: 10 }], charts: [{ title: "y selon x", x: "Autre!$A$1:$A$3", y: [{ name: "y", ref: "Autre!$B$1:$B$3" }], xTitle: "x", yTitle: "y", from: [3, 0], to: [9, 12] }] },
      { name: "Autre", rows: [[1, 1], [2, 4], [3, 9]], pictures: [{ png, col: 0, row: 0, w: 10, h: 10 }] }] };
  const z = unzip(xlsx(book)), text = (n) => new TextDecoder().decode(z.get(n));
  for (const n of ["[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "docProps/app.xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/drawings/drawing1.xml", "xl/drawings/drawing2.xml", "xl/charts/chart1.xml", "xl/media/image1.png", "xl/worksheets/_rels/sheet1.xml.rels"]) assert.ok(z.has(n), n);
  assert.ok(!z.has("xl/media/image2.png"), "the same picture on two sheets is stored once"); assert.deepEqual([...z.get("xl/media/image1.png")], [...png]);
  const s1 = text("xl/worksheets/sheet1.xml"), wb = text("xl/workbook.xml");
  assert.match(s1, /<c r="B2" s="\d+"><v>2\.5<\/v><\/c>/); assert.match(s1, /<c r="B3" s="\d+"><f>in_x\^2<\/f><v>6\.25<\/v><\/c>/); assert.match(s1, /<c r="C3" s="\d+" t="str"><f>IF\(B3&lt;10,&quot;OK&quot;,&quot;NON&quot;\)<\/f><v>OK<\/v><\/c>/, "a formula that gives a text");
  assert.match(s1, /<c r="B4" t="inlineStr"><is><t xml:space="preserve">texte nu<\/t><\/is><\/c><c r="C4"><v>7<\/v><\/c>/); assert.match(s1, /<row r="3" ht="30" customHeight="1">/); assert.match(s1, /<pane ySplit="1" topLeftCell="A2"/); assert.match(s1, /<mergeCell ref="A1:B1"\/>/);
  assert.match(s1, /<dataValidation type="decimal" operator="between"[^>]*sqref="B2"><formula1>0<\/formula1><formula2>10<\/formula2>/); assert.match(s1, /<dataValidation type="list"[^>]*sqref="A4"><formula1>"a,b"<\/formula1>/); assert.match(s1, /sqref="A5"><formula1>Autre!\$A\$1:\$A\$3<\/formula1>/);
  assert.match(s1, /<conditionalFormatting sqref="C3">.*"OK".*"NON".*"JUSTE"/); assert.match(s1, /<drawing r:id="rId1"\/><\/worksheet>$/); assert.ok(s1.indexOf("<sheetData>") < s1.indexOf("<mergeCells") && s1.indexOf("<mergeCells") < s1.indexOf("<conditionalFormatting") && s1.indexOf("<conditionalFormatting") < s1.indexOf("<dataValidations") && s1.indexOf("<dataValidations") < s1.indexOf("<pageMargins"), "the parts of a sheet in the order the format asks");
  assert.match(wb, /<sheet name="Calcul" sheetId="1" r:id="rId1"\/><sheet name="Autre" sheetId="2" r:id="rId2"\/>/); assert.match(wb, /<definedName name="in_x">Calcul!\$B\$2<\/definedName>/); assert.match(wb, /fullCalcOnLoad="1"/, "the file is recalculated when it opens");
  assert.match(text("xl/charts/chart1.xml"), /<c:scatterChart>.*<c:f>Autre!\$A\$1:\$A\$3<\/c:f>.*<c:f>Autre!\$B\$1:\$B\$3<\/c:f>/s); assert.match(text("xl/drawings/drawing1.xml"), /<xdr:pic>.*r:embed="rId1".*<c:chart[^>]*r:id="rId2"\/>/s);
  assert.match(text("docProps/core.xml"), /<dc:title>Essai &amp; &lt;titre&gt;<\/dc:title>.*<dcterms:created[^>]*>2026-11-16T12:00:00Z/s);
  // the mark : in the properties of the file, on top and at the foot of every printed sheet
  assert.ok(text("docProps/core.xml").includes(FOOT_NOTE.replace(/&/g, "&amp;"))); for (const n of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) { assert.ok(text(n).includes(`<oddHeader>&amp;L&amp;8${MARK}`)); assert.ok(text(n).includes(FOOT_NOTE)); }
  for (const n of [...z.keys()].filter((k) => /\.(xml|rels)$/.test(k))) { const t = text(n); assert.ok(t.startsWith("<?xml"), n); assert.equal((t.match(/<[A-Za-z][^<>]*?(?<!\/)>/g) || []).length, (t.match(/<\/[A-Za-z][^<>]*>/g) || []).length, `${n} : every tag opened is closed`); }
  for (const [k, s] of Object.entries(XL_STYLES)) if (s.font) assert.ok(s.font[0] > 6 && /^[0-9A-F]{6}$/.test(s.font[2]), k); assert.match(text("xl/styles.xml"), /numFmtId="164" formatCode="\[=0\]0;\[&lt;0\.01\]0\.000E\+00;#,##0\.0###"/);
});

test("a workbook that is alive gives what the platform computes, whatever is typed in its yellow cells", () => {
  assert.deepEqual(XL_LIVE, ["pipe_flow", "orifice_flow", "beam_cantilever_point", "beam_cantilever_udl", "beam_simple_point", "beam_simple_udl"]);
  const cases = { pipe_flow: [{}, { d: 8, Q: 12 }, { fluid: "oil46", T: 60, Q: 3 }, { fluid: "helium", Q: 40, eps: 0 }, { Q: 30, eps: 0 }], orifice_flow: [{}, { D: 12, d: 3, Q: 2 }, { fluid: "glycol50", Cd: 0.8 }],
    beam_cantilever_point: [{}, { mat: "STEEL-1018", section: "tube", d: 20, t: 2 }, { section: "round", d: 12, F: 20 }, { section: "custom", Ic: 5000, cc: 8, Ac: 120 }], beam_cantilever_udl: [{}, { L: 350, mat: "TI-6AL-4V" }], beam_simple_point: [{}, { section: "tube", d: 30, t: 3, F: 400 }], beam_simple_udl: [{}, { b: 40, h: 6, mat: "PC" }] };
  for (const id of XL_LIVE) { const m = model(id), X = XL[id];
    for (const o of m.outputs) assert.ok(X.outputs[o.key], `${id} : ${o.key} has its formula`); assert.equal(Object.keys(X.outputs).length, m.outputs.length);
    for (const extra of cases[id]) { const typed = { ...sessionDefaults(id), ...extra }, base = { ...sessionDefaults(id) }, book = physicsBook(id, base, { name: "Essai" }), r = run(id, typed), env = compute(book, m, typed);
      assert.equal(book.live, true); for (const o of m.outputs) { const name = Object.keys(book.cells).find((n) => n.replace(/_+$/, "") === `o_${o.key}`); near(env[name], r.values[o.key], 1e-4); }       // the media of the sheet are written with five digits
    } }
  // the cells of the sheet : every result is a formula that names cells that exist ; every helper opens with its right value
  const book = physicsBook("beam_cantilever_point", { ...sessionDefaults("beam_cantilever_point"), section: "tube", d: 20, t: 2 }, {}), rows = rowsOf(book.sheets[0]), all = rows.flat().filter((c) => c && c.f);
  assert.ok(all.length >= 25); for (const c of all) assert.ok(!/[{}]/.test(c.f), c.f); const named = new Set(book.names.map((n) => n.name));
  for (const c of all) for (const n of c.f.match(/\b(?:in|o|h|p|m)_[A-Za-z0-9_]+/g) || []) assert.ok(named.has(n), `« ${n} » in ${c.f}`);
  assert.equal(new Set(book.names.map((n) => n.name.toLowerCase())).size, book.names.length, "a spreadsheet does not tell D from d : every name is its own"); const ori = physicsBook("orifice_flow", sessionDefaults("orifice_flow"), {}); assert.ok(ori.cells.in_d && ori.cells.in_D_ && ori.cells.in_d !== ori.cells.in_D_);
  for (const k of ["in_b", "in_h", "in_Ic", "in_cc", "in_Ac"]) assert.ok(book.cells[k], `${k} is there though the section is a tube : the section can be changed offline`);
  const text = rows.flat().filter(Boolean).map((c) => (typeof c === "object" ? c.v : c)).join(" | "); assert.match(text, /sert quand section = rect/); assert.match(text, /Ce classeur est vivant/);
  assert.match(rows.flat().find((c) => c && c.f && /^INDEX\(Medias!/.test(c.f)).f, /^INDEX\(Medias!\$D\$\d+:\$D\$\d+,MATCH\(\$B\$\d+,Medias!\$A\$\d+:\$A\$\d+,0\)\)$/, "a property is looked up from the medium chosen, in the sheet of media");
  assert.ok(book.sheets[0].limits.some((l) => /^Medias!\$A\$2:\$A\$\d+$/.test(l.listRef)), "the medium is chosen in the list of the sheet of media"); assert.ok(book.sheets[0].limits.some((l) => l.list && l.list.includes("tube")));
  const pipe = physicsBook("pipe_flow", sessionDefaults("pipe_flow"), {}), ptext = rowsOf(pipe.sheets[0]).flat().filter(Boolean).map((c) => (typeof c === "object" ? c.v : c)).join(" | ");
  assert.ok(!/fluid = custom/.test(ptext), "no cell for a fluid typed by hand"); assert.match(ptext, /figée à l'export/); assert.match(ptext, /psi · .* bar · .* atm/, "a pressure also reads in psi, bar and atm"); assert.match(rowsOf(pipe.sheets[0]).flat().find((c) => c && c.f && /psi/.test(c.f)).f, /^TEXT\(B\d+\/6\.894757293168361/);
  assert.equal(physicsBook("pipe_flow", { ...sessionDefaults("pipe_flow"), fluid: "custom", rho_c: 800, mu_c: 2 }, {}).live, false, "a fluid typed before the base of media : the formulas have nothing to read");
});

test("every model leaves with a workbook : the sweeps, a value to try, the base of media it reads, the method", () => {
  for (const m of MODELS) { const book = physicsBook(m.id, sessionDefaults(m.id), { name: "Essai", part: "P-1", project: "Projet", version: "0.63.0", date: new Date("2026-11-16T12:00:00Z"), logo: new Uint8Array([1, 2, 3]), confidential: "CONFIDENTIEL — essai" });
    assert.deepEqual(book.sheets.map((s) => s.name), ["Calcul", "Iterations", "Medias", "Methode", "Notice"], m.id); assert.equal(book.live, XL_LIVE.includes(m.id)); assert.ok(book.swept.length >= 2 && book.swept.length <= 8, `${m.id} : ${book.swept.length} sweeps`);
    assert.equal(book.sheets[1].charts.length, book.swept.length, "a curve per sweep"); assert.equal(book.sheets[2].rows.length - 1 > 0, m.media.length > 0, `${m.id} : the sheet of media`);
    const bytes = xlsx(book); assert.ok(bytes.length > 4000 && bytes[0] === 0x50 && bytes[1] === 0x4b, m.id); const notice = rowsOf(book.sheets[4]).flat().filter(Boolean).map((c) => c.v).join(" | ");
    assert.match(notice, /CONFIDENTIEL — essai/); assert.ok(notice.includes(FOOT_NOTE)); assert.match(notice, book.live ? /Vivante : les résultats/ : /n'a pas encore ses formules/); assert.ok(rowsOf(book.sheets[0])[0][1].v === MARK); }
  assert.equal(physicsBook("nope", {}), null);
  // a sweep : eleven points from half to one and a half of the value, the platform's own results at each
  const base = sessionDefaults("pipe_flow"), pts = sweep("pipe_flow", base, "d"); assert.equal(pts.length, 11); assert.deepEqual([pts[0].x, pts[5].x, pts[10].x], [2, 4, 6]); near(pts[5].values.dp_kPa, run("pipe_flow", base).values.dp_kPa); assert.ok(pts[0].values.dp_kPa > pts[10].values.dp_kPa);
  assert.deepEqual(sweep("pipe_flow", base, "fluid"), []); assert.deepEqual(sweep("pipe_flow", { ...base, Q: 0 }, "Q"), []); assert.deepEqual(sweep("nope", {}, "x"), []); assert.ok(sweep("beam_cantilever_point", sessionDefaults("beam_cantilever_point"), "sf").every((p) => p.x >= 1), "inside what the model accepts");
  // the cell to try a value : read between two points of the table, and nowhere else
  const book = physicsBook("bolted_joint", sessionDefaults("bolted_joint"), {}), it = rowsOf(book.sheets[1]), sw = book.swept[0], tryRow = it[sw.top + 1];
  assert.equal(tryRow[1].s, "input"); assert.match(tryRow[2].f, /^IF\(OR\(\$B\$\d+<\$A\$\d+,\$B\$\d+>\$A\$\d+\),"hors du tableau",FORECAST\(\$B\$\d+,OFFSET\(\$C\$\d+,MIN\(MATCH\(\$B\$\d+,\$A\$\d+:\$A\$\d+,1\),10\)-1,0,2,1\),OFFSET\(\$A\$\d+,/); assert.equal(sw.last - sw.first, 10);
  assert.ok(!book.swept.some((x) => x.key === "sf"), "a criterion changes no result : it is not swept"); assert.ok(it.some((r) => r[0] && r[0].v === "Journal des itérations"));
  const beamBook = physicsBook("beam_cantilever_point", sessionDefaults("beam_cantilever_point"), {}); assert.deepEqual(beamBook.swept.map((x) => x.key), ["L", "b", "h", "F"], "what the medium gives is not swept either");
  const media = rowsOf(beamBook.sheets[2]); assert.equal(media[0][0].v, "Média"); assert.ok(media.slice(1).every((r) => r[1].v === "Solide") && media.some((r) => r[0].v === "Aluminium 6061-T6" && r[3].v === 69)); assert.ok(rowsOf(physicsBook("pipe_flow", sessionDefaults("pipe_flow"), {}).sheets[2]).slice(1).every((r) => ["Liquide", "Gaz"].includes(r[1].v)));
});

test("the note of a calculation follows the template of the house : one calculation, or all those kept", () => {
  const project = { id: "prj", name: "Projet d'essai", parts: [{ id: "P-1", name: "Tube d'eau" }] }, when = new Date("2026-11-16T12:00:00Z");
  const runs = [{ id: "a", name: "Tube d'eau — perte de charge", model: "pipe_flow", part: "P-1", inputs: { ...sessionDefaults("pipe_flow"), Q: 2.5, d: 6 }, when: "2026-11-15T10:00:00Z" }, { id: "b", name: "Bras — flèche", model: "beam_cantilever_point", part: "", inputs: { ...sessionDefaults("beam_cantilever_point"), mat: "STEEL-1018", F: 5000 }, when: "2026-11-16T10:00:00Z" }, { id: "c", name: "Inconnu", model: "nope", inputs: {} }];
  const one = physicsDoc(runs.slice(0, 1), project, { date: when, author: "Moi", project: project.name, figures: { a: { png: new Uint8Array([1]), pngSize: [4, 3], width: 100, height: 75, caption: "Le modèle" } } }), types = one.blocks.map((b) => b.type);
  assert.deepEqual([one.title, one.subtitle, one.reference, one.revision, one.kind, one.author], ["Note de calcul — Tube d'eau — perte de charge", model("pipe_flow").title, "P-1-CALC", "A", "Note de calcul", "Moi"]); assert.ok(!types.includes("toc")); assert.equal(types.filter((t) => t === "figure").length, 1); assert.equal(types.at(-1), "signatures");
  const heads = one.blocks.filter((b) => b.type === "h2").map((b) => b.text); assert.deepEqual(heads, ["Données", "Résultats", "Vérifications", "Limites de validité", "Calcul", "Hypothèses et domaine de validité"]);
  const kv = one.blocks.find((b) => b.type === "kv").rows; assert.deepEqual(kv.map((r) => r[0]), ["Modèle", "Pièce", "Date du calcul", "Verdict", "Fluide"]); assert.equal(kv[1][1], "P-1 — Tube d'eau"); assert.equal(kv[2][1], "2026-11-15"); assert.match(kv[4][1], /^Water à 20 °C — base des médias$/);
  const data = one.blocks.find((b) => b.type === "table" && b.head[0] === "Donnée").rows; assert.ok(data.some((r) => r[0] === "Density ρ" && /média : Water à 20 °C/.test(r[3])), "what the medium gives is in the data, with where it comes from"); assert.ok(data.some((r) => r[0] === "Diamètre intérieur d" && r[1].text === "6" && r[3] === "entrée"));
  const checks = one.blocks.find((b) => b.type === "table" && b.head[0] === "Vérification").rows; assert.equal(checks[0][4].text, "OK"); assert.equal(checks[0][4].fill, "ok"); assert.ok(one.blocks.some((b) => b.type === "list" && b.ordered && b.items.length >= 5));
  // several : a summary first, a page per calculation ; a model this version does not know is left out
  const all = physicsDoc(runs, project, { date: when }); assert.deepEqual([all.title, all.reference, all.subtitle], ["Notes de calcul analytique", "PRJ-CALC", "2 calculs gardés dans le projet"]); assert.deepEqual(all.blocks.slice(0, 3).map((b) => b.type), ["toc", "pagebreak", "h1"]);
  const sum = all.blocks.find((b) => b.type === "table" && b.head[0] === "Calcul").rows; assert.deepEqual(sum.map((r) => [r[0].text, r[4].text, r[4].fill]), [["Tube d'eau — perte de charge", "À vérifier", "warn"], ["Bras — flèche", "NON", "error"]]); assert.deepEqual(all.blocks.filter((b) => b.type === "h1").map((b) => b.text), ["Synthèse", "1. Tube d'eau — perte de charge", "2. Bras — flèche", "Accord"]);
  const beam = all.blocks.filter((b) => b.type === "table" && b.head[0] === "Donnée")[1].rows; assert.ok(beam.some((r) => r[0] === "Module d'Young E" && r[1].text === "205" && /^média : Steel 1018/.test(r[3])));
  // the same model goes to Word and to PDF, with the cartridge of the house
  const stamped = { ...all, confidential: "CONFIDENTIEL — essai", organisation: "Atelier" }, w = unzip(docx(stamped)), pdf = pdfDoc(stamped);
  assert.ok(new TextDecoder().decode(w.get("word/header1.xml")).includes("PRJ-CALC")); assert.ok(new TextDecoder().decode(w.get("word/footer1.xml")).includes("CONFIDENTIEL — essai")); assert.ok(new TextDecoder().decode(w.get("word/document.xml")).includes("Journal des révisions")); assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
});
