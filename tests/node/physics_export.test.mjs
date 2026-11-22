/* What an analytical calculation leaves with : a note at the template of the house (the neutral document model docx() and
   pdfDoc() print) and a workbook laid out like the tool. Every model leaves ALIVE : the formulas of its workbook are computed
   here as a spreadsheet computes them (xl_eval.js — its own rules, its own errors) and must give what the platform
   computes, results, margins and verdicts — whatever is typed in the yellow cells. */
import test from "node:test";
import assert from "node:assert/strict";
import { xlsx, cellRef, colName, XL_STYLES } from "../../web/js/core/xlsx.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { physicsDoc, physicsBook, sweep } from "../../web/js/analysis/physics/export.js";
import { XL, XL_LIVE } from "../../web/js/analysis/physics/xl_formulas.js";
import { xlEval, xlParse, xlBook, XlError } from "../../web/js/analysis/physics/xl_eval.js";
import { pick, between, bisection, substitutions } from "../../web/js/analysis/physics/xl_tools.js";
import { MODELS, model, run, sessionDefaults } from "../../web/js/analysis/physics/index.js";
import { mediumProps, medium } from "../../web/js/analysis/physics/media.js";
import { FOOT_NOTE, MARK } from "../../web/js/core/brand.js";

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b)), `${a} ≠ ${b}`);
/* the parts of a stored zip : name → text */
function unzip(bytes) { const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Map(), dec = new TextDecoder(); let o = 0;
  while (o + 30 < bytes.length && dv.getUint32(o, true) === 0x04034b50) { const n = dv.getUint16(o + 26, true), x = dv.getUint16(o + 28, true), size = dv.getUint32(o + 18, true), name = dec.decode(bytes.subarray(o + 30, o + 30 + n)); out.set(name, bytes.subarray(o + 30 + n + x, o + 30 + n + x + size)); o += 30 + n + x + size; }
  return out; }
const rowsOf = (sheet) => sheet.rows.map((r) => (Array.isArray(r) ? r : (r && r.cells) || []));
const sheetOf = (book, name) => book.sheets.find((x) => x.name === name);
/* what one types in the yellow cells of a workbook, and what the media chosen then give : { name of a cell : value } */
function typedCells(book, m, typed) {
  const over = {}, T = typed.T ?? 20;
  for (const d of m.inputs) if (book.inputs[d.key] && d.key in typed) over[book.inputs[d.key]] = typed[d.key];
  for (const s of m.media) { const c = medium(typed[s.key]); if (!c) continue; const P = mediumProps(c.id, c.at ? T : undefined);
    for (const [key, prop] of Object.entries(s.gives)) if (Number.isFinite(P[prop])) over[book.inputs[key]] = P[prop]; for (const prop of s.shows || []) over[book.props[prop]] = P[prop]; }
  return over;
}
const wordOf = (c) => (c.ok ? (c.tight ? "JUSTE" : "OK") : c.soft ? "JUSTE" : "NON");

test("a formula is read as a spreadsheet reads it : its order, its errors, the branch it takes", () => {
  assert.equal(xlEval("-2^2"), 4, "a minus sign binds before a power"); assert.equal(xlEval("2^3^2"), 64, "powers read from the left"); assert.equal(xlEval("2+3*4^2/8-1"), 7); assert.equal(xlEval("10^-2"), 0.01); near(xlEval("5.670374E-8*2"), 1.1340748e-7);
  assert.equal(xlEval('IF(in_x>2,"big","small")', { in_x: 3 }), "big"); assert.equal(xlEval("IF(in_x=0,0,1/in_x)", { in_x: 0 }), 0, "IF computes only the branch it takes"); assert.equal(xlEval('"a"&1&"b"'), "a1b");
  assert.equal(xlEval('OR(in_c="8.8",in_c=8.8)', { in_c: 8.8 }), true, "a choice read back as a number"); assert.equal(xlEval('in_c="m6"', { in_c: "M6" }), true, "a spreadsheet does not tell M from m"); assert.equal(xlEval('in_c=8.8', { in_c: "8.8" }), false);
  assert.deepEqual([xlEval("ROUND(2.5,0)"), xlEval("ROUND(-2.5,0)"), xlEval("ROUND(1.23456,3)"), xlEval("MAX(1,ROUND(2.4,0))"), xlEval("MIN(3,2,5)"), xlEval("ABS(-3)")], [3, -3, 1.235, 2, 2, 3]);
  near(xlEval("LN(EXP(2))+LOG10(1000)+SQRT(16)+TANH(0)+PI()"), 9 + Math.PI);
  for (const [f, code] of [["1/0", "#DIV/0!"], ["SQRT(-1)", "#NUM!"], ["LN(0)", "#NUM!"], ["(-8)^0.5", "#NUM!"], ["0^-1", "#DIV/0!"], ['1+"a"', "#VALUE!"], ["nothing+1", "#NAME? nothing"], ["SUM(1,2)", "#NAME? SUM"]]) assert.throws(() => xlEval(f), (e) => e instanceof XlError && e.code === code, f);
  assert.throws(() => xlParse("1+"), XlError); assert.throws(() => xlParse("(1+2"), XlError); assert.throws(() => xlParse("1 # 2"), XlError); assert.deepEqual(xlParse("a+1"), ["bin", "+", ["name", "a"], ["num", 1]]);
  // what the formulas are written with
  assert.equal(pick("size", { M3: 3, "8.8": 580 }, 6), 'IF({size}="M3",3,IF(OR({size}="8.8",{size}=8.8),580,6))'); const line = between([1, 2, 4], [10, 20, 60], "x");
  for (const [x, y] of [[0, 10], [1, 10], [1.5, 15], [2, 20], [3, 40], [4, 60], [9, 60]]) near(xlEval(line, { x }), y);
  // a workbook : named cells, cells by address, another sheet, a cell kept as written when its formula calls what this reader does not know
  const book = { names: [{ name: "in_x", ref: "A!$B$1" }, { name: "s_y", ref: "B!$A$1" }], sheets: [{ name: "A", rows: [[null, { v: 2 }], [{ f: "in_x*3" }, { f: "A2+s_y" }, { v: 7, f: "INDEX(B!$A$1:$A$2,1)" }, { f: "C2+1" }], { cells: [{ f: "A3+1" }] }] }, { name: "B", rows: [[{ f: "in_x^2" }]] }] };
  const get = xlBook(book); assert.deepEqual([get("in_x"), get("A2"), get("B2"), get("B!A1"), get("s_y"), get("D2")], [2, 6, 10, 4, 4, 8]);
  const marks = { names: [], sheets: [{ name: "A", rows: [[{ v: "OK" }, { v: "NON" }], [{ v: "JUSTE" }, { f: "1/0" }], [{ f: 'IF(COUNTIF(A1:B2,"NON")>0,"NON","OK")' }, { f: 'COUNTIF(A1:A2,"juste")' }, { f: 'COUNTIF($A$1:$B$2,"OK")' }, { f: 'COUNTIF(A1:B2,"—")' }]] }] }, count = xlBook(marks);
  assert.deepEqual([count("A3"), count("B3"), count("C3"), count("D3")], ["NON", 1, 1, 0], "a range is counted cell by cell ; a cell in error counts for nothing"); assert.deepEqual(xlParse('COUNTIF(F12:F30,"NON")'), ["call", "COUNTIF", [["range", "F12", "F30"], ["str", "NON"]]]); assert.throws(() => xlEval("COUNTIF(A1:A2,1)"), (e) => /#REF!/.test(e.code)); assert.throws(() => get("A3"), (e) => /circular/.test(e.code)); assert.equal(xlBook(book, { in_x: 5 })("B2"), 40, "what is typed in a named cell");
  // a root found step by step : the table of a bisection gives the root of x² − 2, the table of substitutions the fixed point of cos
  const B = bisection("x", "x", 0, 2, 40, [{ key: "f", label: "f", f: (x) => `${x}^2-2` }]), cellsOf = (g, extra) => { const env = {}; const all = Object.fromEntries(g.rows.flat().filter((c) => c && c.f).map((c) => [c.key, c.f.replace(/\{s:([A-Za-z0-9_]+)\}/g, "$1")]));
    const val = (n) => (n in env ? env[n] : (env[n] = xlEval(all[n], new Proxy({}, { has: () => true, get: (_, k) => val(k) })))); return val(extra.replace(/\{s:([A-Za-z0-9_]+)\}/g, "$1")); };
  near(cellsOf(B.grid, B.root), Math.SQRT2, 1e-10); assert.equal(B.grid.rows.length, 41); assert.equal(B.grid.head.length, 5);
  const F = substitutions("x", "x", 1, 30, [{ key: "x", label: "x", f: (prev) => `(${prev}+2/${prev})/2` }]); near(cellsOf(F.grid, F.last("x")), Math.SQRT2, 1e-12);
});

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

/* what is typed in the yellow cells, model by model : the defaults, then what wakes each branch of the model — another choice, a load that is nothing, a size out of its range */
const CASES = {
  pipe_flow: [{}, { d: 8, Q: 12 }, { fluid: "oil46", T: 60, Q: 3 }, { fluid: "helium", Q: 40, eps: 0 }, { Q: 30, eps: 0 }, { dp_max: 0 }], orifice_flow: [{}, { D: 12, d: 3, Q: 2 }, { fluid: "glycol50", Cd: 0.8 }],
  beam_cantilever_point: [{}, { mat: "STEEL-1018", section: "tube", d: 20, t: 2 }, { section: "round", d: 12, F: 20 }, { section: "custom", Ic: 5000, cc: 8, Ac: 120 }, { F: 0 }, { section: "tube", d: 10, t: 8 }], beam_cantilever_udl: [{}, { L: 350, mat: "TI-6AL-4V" }],
  beam_simple_point: [{}, { section: "tube", d: 30, t: 3, F: 400 }], beam_simple_udl: [{}, { b: 40, h: 6, mat: "PC" }],
  column_buckling: [{}, { ends: "ff", L: 800 }, { section: "tube", d: 25, t: 2, mat: "STEEL-1018", F: 5000 }, { ends: "fx", L: 60, section: "round", d: 20 }, { F: 0 }, { ends: "fp", section: "custom", Ic: 900, Ac: 60, L: 1500 }],
  shaft_torsion: [{}, { di: 8 }, { di: 15 }, { T: 0 }, { mat: "SS-304", do: 30, di: 29, L: 500, T: 120 }],
  plate_pressure: [{}, { edges: "fixed" }, { a: 100, b: 300 }, { a: 600, b: 100, t: 2, p: 50 }, { a: 150, b: 150, edges: "fixed", p: 0 }, { a: 310, b: 200, edges: "fixed", t: 60 }],
  thermal_mismatch: [{}, { play: 0.05 }, { play: 2 }, { T: -40 }, { mat1: "PC", mat2: "AL6061-T6", A1: 50, T: 120 }, { T: 20 }],
  bolted_joint: [{}, { Fa: 4000 }, { Fs: 3000 }, { Fa: 20000, Fs: 500, size: "M8", cls: "10.9", T: 25 }, { mode: "nut", Fs: 100 }, { size: "M2.5", cls: "A2-70", T: 0.5, nb: 2.6, lk: 2 }, { cls: "4.8", T: 12 }, { Fa: 90000, cls: "12.9", Le: 30 }, { T: 0, Fa: 100 }],
  press_fit: [{}, { di: 10 }, { Do: 15 }, { Treq: 50, Freq: 2000 }, { delta: 0 }, { mat_h: "AL6061-T6", delta: 40, di: 25 }, { Treq: 5000, L: 100 }],
  dowel_pin: [{}, { planes: "2", np: 3 }, { F: 0 }, { t: 2, d: 8, np: 2.4 }, { F: 90000 }],
  spring_stop: [{}, { l: 9.5, lift: 0.5, tol: 0.05, n: 10 }, { l: 7, lift: 0.65, tol: 0.05, n: 10 }, { plating: "Au", n: 4, l: 5.5, w: 1, t: 0.1, lift: 0.45, tol: 0.05, I: 0.05, Fmin: 0.5 }, { lift: 0.4, tol: 0.2 }, { lift: 0.65, hs: 0.35 }, { lift: 0.2, hs: 0.35 }, { plating: "Au", I: 0.05, n: 4, l: 3, w: 1, t: 0.1, lift: 0.3, hs: 0.2 }, { plating: "Sn", Fmin: 30 }, { I: 3000 }, { t: 1.2 }],
  plastic_screw: [{}, { F: 0 }, { L: 6, Db: 7.8 }, { mat: "PA66-GF30", F: 1500, sf: 2 }, { Dp: 5, d: 4 }],
  face_cam: [{}, { dwell: 0 }, { dwell: 0, alpha: 4 }, { alpha: 10, mu: 0.3, muB: 0 }, { lobes: 1, turn: 200 }, { k: 50, Freq: 500 }, { lever: 10 }, { dwell: 90 }],
  louvre_strip: [{}, { strips: 1, L: 10 }, { mate: "al", I: 900 }, { mate: "brass", Rl: 2000, I: 500 }, { h: 1.45, tol: 0.1 }, { h: 1.95 }, { L: 2, p: 3.5 }, { strips: 3.4, Umax: 3 }],
  conduction_stack: [{}, { t2: 1.6, t3: 2 }, { tim_t: 0, Rc: 0 }, { P: 0 }, { mat1: "CU-C110", t1: 40, A: 100 }, { P: 500, Tmax: 30 }],
  junction_temperature: [{}, { P: 0 }, { Rsa: 0, Rjc: 0, Rcs: 0 }, { P: 80, Rsa: 2 }, { Tjmax: 30 }, { P: 0.001, Tjmax: 400 }],
  heatsink_natural: [{}, { P: 0 }, { eps: 0 }, { N: 40 }, { N: 60 }, { P: 200, Ta: 60, mat: "CU-C110" }, { P: 0.5 }, { P: 3000, Lf: 400 }],
  heatsink_forced: [{}, { P: 0 }, { v: 20, Lf: 600 }, { v: 0.5, N: 30 }, { P: 500, Ta: 50 }, { N: 80 }],
  lumped_mass: [{}, { P: 0 }, { time: 0 }, { P: 50 }, { h: 100, mat: "PC" }, { Tmax: 20 }],
  busbar: [{}, { I: 0 }, { hc: 15 }, { I: 1 }, { I: 2000, t: 10 }, { eps: 0, mat: "AL6061-T6" }, { I: 50000, w: 1, t: 0.1 }],
  pcb_trace: [{}, { I: 0 }, { layer: "internal", I: 5 }, { w: 12, tcu: 105, I: 40 }, { I: 30, w: 0.2 }],
  adiabatic_pulse: [{}, { I: 0 }, { time: 10 }, { I: 20000 }, { mat: "AL6061-T6", Tmax: 30 }, { I: 3000, time: 0.01 }],
};
test("every workbook is alive : it gives what the platform computes — results, margins, verdicts — whatever is typed in its yellow cells", () => {
  assert.deepEqual(XL_LIVE.slice().sort(), MODELS.map((m) => m.id).sort(), "every model has its formulas"); assert.deepEqual(Object.keys(CASES).sort(), XL_LIVE.slice().sort()); let n = 0, judged = 0, same = 0, outside = 0; const seen = new Set();
  for (const m of MODELS) { const X = XL[m.id], base = sessionDefaults(m.id), book = physicsBook(m.id, base, { name: "Essai" });
    for (const o of m.outputs) assert.ok(X.outputs[o.key], `${m.id} : ${o.key} has its formula`); assert.equal(Object.keys(X.outputs).length, m.outputs.length); assert.equal(book.live, true, m.id);
    for (const extra of CASES[m.id]) { const typed = { ...base, ...extra }, r = run(m.id, typed), get = xlBook(book, typedCells(book, m, typed)), tag = `${m.id} ${JSON.stringify(extra)}`; n++;
      for (const o of m.outputs) { const want = r.values[o.key], got = get(book.outputs[o.key]); if (typeof want === "number") { assert.equal(typeof got, "number", `${tag} : ${o.key} = ${got}`); assert.ok(Math.abs(got - want) <= 1e-4 * Math.max(1e-12, Math.abs(want)), `${tag} : ${o.key} = ${got} ≠ ${want}`); } else assert.equal(got, "—", `${tag} : ${o.key}`); }       // the media of the sheet are written with five digits
      for (const c of r.checks) assert.ok(book.checks.some((x) => x.label === c.label), `${tag} : the check « ${c.label} » is in the workbook`);
      assert.equal(get("B4"), { ok: "OK", warn: "JUSTE", fail: "NON" }[r.verdict], `${tag} : the verdict of the sheet is the verdict of the screen (${r.warnings.length} limit(s) of validity)`); if (r.verdict === "warn" && r.checks.every((c) => c.ok && !c.tight)) outside++;
      for (const x of book.checks) { const c = r.checks.find((q) => q.label === x.label), margin = get(`E${x.row}`), word = get(`F${x.row}`);
        if (!c) { assert.deepEqual([margin, word], ["—", "—"], `${tag} : « ${x.label} » sleeps`); continue; } seen.add(`${m.id}|${x.label}`);
        assert.ok(Math.abs(margin - c.margin) <= 2e-3, `${tag} : margin of « ${x.label} » ${margin} ≠ ${c.margin}`); judged++;
        if (Math.abs(margin - c.margin) < 1e-9) { same++; assert.equal(word, wordOf(c), `${tag} : verdict of « ${x.label} »`); } } } }       // a margin is rounded to the thousandth : the same margin gives the same verdict
  assert.ok(same >= 0.97 * judged && judged >= 180, `${same} margins of ${judged} are the platform's own to the last digit`); assert.ok(outside >= 15, `${outside} cases where every check passes and the model is outside its domain : the sheet says JUSTE, like the screen`);
  assert.ok(n >= 110, `${n} sets of yellow cells`); for (const id of XL_LIVE) for (const x of XL[id].checks) assert.ok(seen.has(`${id}|${x.label}`), `${id} : the check « ${x.label} » woke up in a case at least`);
  // the cells of the sheet : every result is a formula that names cells that exist ; every cell written without a value opens with the right one
  const book = physicsBook("beam_cantilever_point", { ...sessionDefaults("beam_cantilever_point"), section: "tube", d: 20, t: 2 }, {}), rows = rowsOf(book.sheets[0]), all = rows.flat().filter((c) => c && c.f);
  assert.ok(all.length >= 25); for (const c of all) assert.ok(!/[{}]/.test(c.f), c.f); const named = new Set(book.names.map((x) => x.name));
  for (const c of all) for (const x of c.f.match(/\b(?:in|o|h|p|m|s)_[A-Za-z0-9_]+/g) || []) assert.ok(named.has(x), `« ${x} » in ${c.f}`);
  near(rows.flat().find((c) => c && c.f === "IF(OR(in_section=\"round\",in_section=\"tube\"),PI()*(in_d^4-h_di^4)/64,IF(in_section=\"custom\",in_Ic,in_b*in_h^3/12))").v, Math.PI * (20 ** 4 - 16 ** 4) / 64); assert.ok(all.every((c) => c.v !== undefined), "no formula leaves without its value");
  assert.equal(new Set(book.names.map((x) => x.name.toLowerCase())).size, book.names.length, "a spreadsheet does not tell D from d : every name is its own"); const ori = physicsBook("orifice_flow", sessionDefaults("orifice_flow"), {}); assert.ok(ori.cells.in_d && ori.cells.in_D_ && ori.cells.in_d !== ori.cells.in_D_);
  for (const k of ["in_b", "in_h", "in_Ic", "in_cc", "in_Ac"]) assert.ok(book.cells[k], `${k} is there though the section is a tube : the section can be changed offline`);
  const text = rows.flat().filter(Boolean).map((c) => (typeof c === "object" ? c.v : c)).join(" | "); assert.match(text, /sert quand section = rect/); assert.match(text, /Ce classeur est vivant/); assert.match(text, /DOMAINE DE VALIDITÉ \|.*Poutre élancée[^|]*\| Oui/);
  assert.match(rows.flat().find((c) => c && c.f && /^INDEX\(Medias!/.test(c.f)).f, /^INDEX\(Medias!\$D\$\d+:\$D\$\d+,MATCH\(\$B\$\d+,Medias!\$A\$\d+:\$A\$\d+,0\)\)$/, "a property is looked up from the medium chosen, in the sheet of media");
  assert.ok(book.sheets[0].limits.some((l) => /^Medias!\$A\$2:\$A\$\d+$/.test(l.listRef)), "the medium is chosen in the list of the sheet of media"); assert.ok(book.sheets[0].limits.some((l) => l.list && l.list.includes("tube")));
  const pipe = physicsBook("pipe_flow", sessionDefaults("pipe_flow"), {}), ptext = rowsOf(pipe.sheets[0]).flat().filter(Boolean).map((c) => (typeof c === "object" ? c.v : c)).join(" | ");
  assert.ok(!/fluid = custom/.test(ptext), "no cell for a fluid typed by hand"); assert.match(ptext, /figée à l'export/); assert.match(ptext, /psi · .* bar · .* atm/, "a pressure also reads in psi, bar and atm"); assert.match(rowsOf(pipe.sheets[0]).flat().find((c) => c && c.f && /psi/.test(c.f)).f, /^TEXT\(B\d+\/6\.894757293168361/);
  const frozen = physicsBook("pipe_flow", { ...sessionDefaults("pipe_flow"), fluid: "custom", rho_c: 800, mu_c: 2 }, {}); assert.equal(frozen.live, false, "a fluid typed before the base of media : the formulas have nothing to read"); assert.ok(rowsOf(frozen.sheets[0]).flat().every((c) => !c || !c.f || /^TEXT\(/.test(c.f)), "only the reading of a pressure in other units is a formula"); assert.match(rowsOf(sheetOf(frozen, "Notice")).flat().filter(Boolean).map((c) => c.v).join(" | "), /saisi à la main/);
  // a check that needs a load sleeps until its yellow cell is filled ; a temperature is judged on its rise above the reference
  const bolt = physicsBook("bolted_joint", sessionDefaults("bolted_joint"), {}), brow = rowsOf(bolt.sheets[0]), dec = bolt.checks.find((x) => /^Décollement/.test(x.label)), bc = brow[dec.row - 1];
  assert.equal(bolt.checks.length, 9); assert.deepEqual([bc[4].v, bc[5].v], ["—", "—"]); assert.match(bc[4].f, /^IF\(in_Fa>0,IF\(B\d+=0,IF\(C\d+>0,999,0\),ROUND\(MIN\(999,MAX\(0,C\d+\/B\d+\)\),3\)\),"—"\)$/); assert.match(bc[5].f, /^IF\(in_Fa>0,IF\(E\d+<1,"NON",IF\(E\d+<1\.5,"JUSTE","OK"\)\),"—"\)$/);
  const lum = physicsBook("lumped_mass", sessionDefaults("lumped_mass"), {}), lc = rowsOf(lum.sheets[0])[lum.checks[1].row - 1]; assert.match(lc[4].f, /^IF\(\(B\d+-in_Ta\)=0,IF\(\(C\d+-in_Ta\)>0,999,0\),ROUND\(MIN\(999,MAX\(0,\(C\d+-in_Ta\)\/\(B\d+-in_Ta\)\)\),3\)\)$/); assert.match(lc[5].f, /"JUSTE",IF/, "a rule of thumb never says NON");
  assert.match(rowsOf(bolt.sheets[0])[3][1].f, /^IF\(COUNTIF\(F\d+:F\d+,"NON"\)>0,"NON",IF\(COUNTIF\(F\d+:F\d+,"JUSTE"\)>0,"JUSTE","OK"\)\)$/);
  // the domain of validity : a state beside each line, read by the verdict of the sheet ; a word of context counts for nothing
  const flagRows = brow.filter((line) => line[0] && XL.bolted_joint.flags.some((f) => f.label === line[0].v)), span = /COUNTIF\(F(\d+):F(\d+)/.exec(brow[3][1].f), lastFlag = brow.findIndex((line) => line[0] && line[0].v === "Prise de filet (≤ 2,5 d)") + 1;
  assert.equal(flagRows.length, 4); assert.deepEqual(flagRows.map((line) => line[5].v), ["—", "—", "OK", "OK"]); assert.match(flagRows[2][5].f, /^IF\(B\d+="Oui","OK","JUSTE"\)$/); assert.ok(!flagRows[0][5].f); assert.equal(Number(span[2]), lastFlag, "the verdict reads down to the last line of the domain"); assert.equal(Number(span[1]), bolt.checks[0].row);
  const shortGrip = xlBook(bolt, { [bolt.inputs.lk]: 4 }); assert.equal(shortGrip(`F${lastFlag - 1}`), "JUSTE"); assert.equal(shortGrip("B4"), "JUSTE", "a grip shorter than the screw : every check passes, the verdict says JUSTE"); assert.equal(run("bolted_joint", { ...sessionDefaults("bolted_joint"), lk: 4 }).verdict, "warn");
  const pipeBook = physicsBook("pipe_flow", sessionDefaults("pipe_flow"), {}), regime = rowsOf(pipeBook.sheets[0]).find((line) => line[0] && line[0].v === "Régime"); assert.match(regime[5].f, /^IF\(B\d+="Laminaire : Hagen-Poiseuille","OK","JUSTE"\)$/, "the words that mean « inside the domain » are the line's own");
  const column = physicsBook("column_buckling", sessionDefaults("column_buckling"), {}); assert.ok(rowsOf(column.sheets[0]).some((line) => line[5] && /="Euler : flambement élastique","OK","JUSTE"/.test(line[5].f || "")));
  // a root the model finds step by step has its own sheet : a bisection for the heat sink in still air and the busbar, six passes for the heat sink in moving air
  for (const [id, lines, cols] of [["heatsink_natural", 37, 8], ["busbar", 41, 6], ["heatsink_forced", 6, 7]]) { const b = physicsBook(id, sessionDefaults(id), {}), sv = sheetOf(b, "Solveur"), grid = rowsOf(sv).slice(5);
    assert.deepEqual(b.sheets.map((x) => x.name), ["Calcul", "Iterations", "Medias", "Solveur", "Methode", "Notice"], id); assert.equal(grid.length, lines, id); assert.equal(rowsOf(sv)[4].length, cols); assert.ok(grid.flat().filter((c) => c.f).every((c) => typeof c.v === "number"), `${id} : every step opens with its value`);
    assert.ok(Object.keys(b.cells).some((k) => /^s_dT_/.test(k) && /^Solveur![A-Z]+\d+$/.test(b.cells[k]))); assert.match(rowsOf(sheetOf(b, "Notice")).flat().filter(Boolean).map((c) => c.v).join(" | "), /Feuille Solveur/); assert.ok(xlsx(b).length > 9000); }
  assert.ok(!sheetOf(book, "Solveur")); const keep = XL.pipe_flow.outputs.v; XL.pipe_flow.outputs.v = "{h:nope}";
  try { assert.throws(() => physicsBook("pipe_flow", sessionDefaults("pipe_flow"), {}), /\{h:nope\} is not a cell of the workbook/, "a formula that names a cell that does not exist is refused"); } finally { XL.pipe_flow.outputs.v = keep; }
});

test("every model leaves with a workbook : the sweeps, a value to try, the base of media it reads, the method", () => {
  for (const m of MODELS) { const book = physicsBook(m.id, sessionDefaults(m.id), { name: "Essai", part: "P-1", project: "Projet", version: "0.63.0", date: new Date("2026-11-16T12:00:00Z"), logo: new Uint8Array([1, 2, 3]), confidential: "CONFIDENTIEL — essai" });
    assert.deepEqual(book.sheets.map((s) => s.name).filter((x) => x !== "Solveur"), ["Calcul", "Iterations", "Medias", "Methode", "Notice"], m.id); assert.equal(book.live, true); assert.equal(!!sheetOf(book, "Solveur"), !!XL[m.id].grid, m.id); assert.ok(book.swept.length >= 2 && book.swept.length <= 8, `${m.id} : ${book.swept.length} sweeps`);
    assert.equal(book.sheets[1].charts.length, book.swept.length, "a curve per sweep"); assert.equal(book.sheets[2].rows.length - 1 > 0, m.media.length > 0, `${m.id} : the sheet of media`);
    const bytes = xlsx(book); assert.ok(bytes.length > 4000 && bytes[0] === 0x50 && bytes[1] === 0x4b, m.id); const notice = rowsOf(sheetOf(book, "Notice")).flat().filter(Boolean).map((c) => c.v).join(" | ");
    assert.match(notice, /CONFIDENTIEL — essai/); assert.ok(notice.includes(FOOT_NOTE)); assert.match(notice, /Vivante : les résultats/); assert.ok(rowsOf(book.sheets[0])[0][1].v === MARK); }
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
