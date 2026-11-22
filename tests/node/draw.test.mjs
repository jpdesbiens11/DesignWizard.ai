/* DynamiteOrbit — tests of the 2D drawing kit (web/js/draw): metrics, WinAnsi, PDF structure, SVG
   well-formedness, drafting helpers on both backends and the demo sheet.
   Run: node --test tests/node/draw.test.mjs */

import test from "node:test";
import assert from "node:assert/strict";
import {
  Sheet, textWidth, wrapText, toWinAnsi, fromWinAnsi, sanitizeText, parseJpeg, base64Encode, base64Decode,
  arcToBeziers, resolveStyle,
} from "../../web/js/draw/sheet.js";
import { PdfSheet } from "../../web/js/draw/pdf.js";
import { SvgSheet } from "../../web/js/draw/svg.js";
import * as D from "../../web/js/draw/drafting.js";
import { buildDemo, makeMosaicJpeg, demoJpeg } from "../../tools/draw_demo.mjs";

const latin1 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return s; };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

/** Checks header, trailer and that every xref offset points at 'N 0 obj'. Returns the file as a Latin-1 string. */
function checkPdf(bytes) {
  const s = latin1(bytes);
  assert.ok(s.startsWith("%PDF-1.4\n"), "header");
  assert.ok(s.trimEnd().endsWith("%%EOF"), "%%EOF");
  const xrefPos = Number(/startxref\n(\d+)\n%%EOF/.exec(s)[1]);
  assert.equal(s.slice(xrefPos, xrefPos + 5), "xref\n", "startxref points at the xref table");
  const head = /^xref\n0 (\d+)\n/.exec(s.slice(xrefPos));
  const count = Number(head[1]);
  const entries = s.slice(xrefPos + head[0].length, xrefPos + head[0].length + count * 20);
  assert.equal(entries.slice(0, 20), "0000000000 65535 f \n");
  for (let i = 1; i < count; i++) {
    const entry = entries.slice(i * 20, i * 20 + 20);
    assert.match(entry, /^\d{10} 00000 n \n$/);
    const off = Number(entry.slice(0, 10));
    assert.ok(s.startsWith(`${i} 0 obj\n`, off), `xref entry ${i} points at '${i} 0 obj'`);
  }
  assert.ok(s.includes(`/Size ${count}`), "trailer /Size");
  // Every stream has an exact /Length.
  for (const m of s.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(s.slice(start + Number(m[1]), start + Number(m[1]) + 10), "\nendstream", "stream /Length");
  }
  return s;
}

/** Minimal well-formedness check: balanced tags, quoted attributes, no raw '<' or '&' in text. */
function checkSvg(svg) {
  const stack = [];
  let last = 0;
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g;
  for (let m; (m = tag.exec(svg));) {
    const between = svg.slice(last, m.index);
    assert.ok(!between.includes("<"), `stray '<' before offset ${m.index}`);
    assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(between), `raw '&' in text: ${between.slice(0, 40)}`);
    last = tag.lastIndex;
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], `closing </${m[2]}>`);
    else stack.push(m[2]);
  }
  assert.equal(stack.length, 0, "all tags closed");
  assert.equal(svg.slice(last).trim(), "", "nothing after the root element");
}

/** Backend that only records calls: proves the helpers rely on nothing but the Sheet primitives. */
class Recorder extends Sheet {
  constructor(opts) { super(opts); this.calls = []; }
  _rec(name, args) { this.calls.push([name, ...args]); return this; }
  line(...a) { return this._rec("line", a); }
  polyline(...a) { return this._rec("polyline", a); }
  rect(...a) { return this._rec("rect", a); }
  circle(...a) { return this._rec("circle", a); }
  arc(...a) { return this._rec("arc", a); }
  path(...a) { return this._rec("path", a); }
  text(...a) { return this._rec("text", a); }
  image(...a) { return this._rec("image", a); }
  newPage() { return this._rec("newPage", []); }
  count(name) { return this.calls.filter((c) => c[0] === name).length; }
}

test("textWidth uses the Helvetica / Helvetica-Bold / Courier AFM tables", () => {
  near(textWidth("Hello", { size: 10 }), 22.78);                 // 722 + 556 + 222 + 222 + 556
  near(textWidth("Hello", { size: 10, font: "bold" }), 24.45);   // 722 + 556 + 278 + 278 + 611
  near(textWidth("Hello", { size: 10, font: "italic" }), 22.78); // Helvetica-Oblique = Helvetica widths
  near(textWidth("Hello", { size: 10, font: "mono" }), 30);      // Courier: 600 everywhere
  near(textWidth("Ø12 ±0.1°", { size: 1 }), (778 + 556 * 2 + 278 + 584 + 556 + 278 + 556 + 400) / 1000);
  near(textWidth("éèàçù", { size: 1 }), (556 * 3 + 500 + 556) / 1000);
  near(textWidth("", {}), 0);
  near(textWidth("a漢b", { size: 1 }), (556 + 556 + 556) / 1000); // unknown character measured as '?'
  near(new PdfSheet().textWidth("Hello", { size: 10 }), new SvgSheet().textWidth("Hello", { size: 10 }));
});

test("wrapText keeps every line within the width and breaks long words", () => {
  const opts = { size: 2.5 };
  const lines = wrapText("Casser les arêtes vives et ébavurer toutes les surfaces usinées avant anodisation", 40, opts);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(textWidth(l, opts) <= 40, l);
  assert.equal(lines.join(" "), "Casser les arêtes vives et ébavurer toutes les surfaces usinées avant anodisation");
  assert.deepEqual(wrapText("a\nb", 100), ["a", "b"]);
  const broken = wrapText("X".repeat(60), 20, opts);
  assert.ok(broken.length > 1 && broken.every((l) => textWidth(l, opts) <= 20));
  assert.equal(broken.join(""), "X".repeat(60));
});

test("WinAnsi: accents and technical characters round-trip, others become '?'", () => {
  const s = "é è à ç ù ° ± × Ø µ € — œ";
  const bytes = toWinAnsi(s);
  assert.deepEqual([...bytes].filter((b) => b !== 32), [0xE9, 0xE8, 0xE0, 0xE7, 0xF9, 0xB0, 0xB1, 0xD7, 0xD8, 0xB5, 0x80, 0x97, 0x9C]);
  assert.equal(fromWinAnsi(bytes), s);
  assert.deepEqual([...toWinAnsi("漢\u{1F600}")], [0x3F, 0x3F]);
  assert.equal(sanitizeText("⌀12 μm x≤y"), "Ø12 µm x<=y"); // stand-ins for ⌀, μ, ≤
});

test("PDF: valid structure, fonts, MediaBox, Info, WinAnsi text", () => {
  const pdf = new PdfSheet({ width: 420, height: 297, title: "Pièce d'essai", date: new Date(Date.UTC(2026, 10, 14)) });
  pdf.line(10, 10, 100, 10, { w: 0.5, dash: "hidden" })
    .rect(10, 20, 50, 30, { fill: "#ff0000", color: "#00f" })
    .circle(100, 100, 20, { dash: "center", cap: "round" })
    .arc(100, 100, 30, 0, 90).polyline([[0, 0], [10, 10], [20, 0]], { close: true, fill: "#ccc", opacity: 0.5 })
    .path([["M", 0, 0], ["L", 10, 0], ["C", 12, 0, 14, 2, 14, 4], ["Z"]], { w: 0.35 })
    .text(50, 50, "Matériau (Ø12 ±0.1) \\ ok", { size: 5, font: "bold", align: "center", angle: -90 })
    .text(10, 10, "mono", { font: "mono" }).text(10, 15, "oblique", { font: "italic" });
  const s = checkPdf(pdf.toBytes());
  assert.equal(pdf.pageCount, 1);
  assert.ok(s.includes("/Type /Pages") && s.includes("/Count 1"));
  for (const f of ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier"]) {
    assert.ok(s.includes(`/BaseFont /${f} /Encoding /WinAnsiEncoding`), f);
  }
  assert.ok(s.includes("/MediaBox [0 0 1190.5512 841.8898]"), "A3 in points");
  assert.ok(s.includes("q 2.834646 0 0 -2.834646 0 841.8898 cm"), "single mm / y-flip matrix");
  assert.ok(s.includes("/Creator (DynamiteOrbit)"));
  assert.ok(s.includes("/Title <FEFF0050006900E800630065"), "UTF-16BE title");
  assert.ok(s.includes("/CreationDate (D:20261114000000Z)"));
  assert.ok(s.includes("(Mat\\351riau \\(\\33012 \\2610.1\\) \\\\ ok) Tj"), "escaped WinAnsi string");
  assert.ok(s.includes("[3 1.5] 0 d") && s.includes("[8 1.5 1.5 1.5] 0 d"), "dash patterns");
  assert.ok(s.includes("1 0 0 rg") && s.includes("0 0 1 RG"), "RGB colours");
  assert.ok(s.includes("/ExtGState") && s.includes("/CA 0.5 /ca 0.5"), "opacity");
  assert.ok(/0 -1 -1 0 [\d.]+ [\d.]+ Tm/.test(s), "text rotated by -90°");
  assert.equal(s.match(/ c\b/g).length >= 6, true, "circles and arcs are Béziers");
});

test("PDF and SVG: multi-page", () => {
  const pdf = new PdfSheet({ width: 297, height: 210, title: "x" });
  pdf.text(10, 10, "page 1").newPage().text(10, 10, "page 2").newPage({ width: 210, height: 297 });
  const s = checkPdf(pdf.toBytes());
  assert.equal(pdf.pageCount, 3);
  assert.ok(s.includes("/Count 3"));
  assert.equal(s.match(/\/Type \/Page /g).length, 3);
  assert.ok(s.includes("/MediaBox [0 0 595.2756 841.8898]"));

  const svg = new SvgSheet({ width: 297, height: 210, title: "x" });
  svg.text(10, 10, "page 1").newPage().text(10, 10, "page 2");
  const pages = svg.toStrings();
  assert.equal(pages.length, 2);
  pages.forEach(checkSvg);
  assert.ok(pages[0].includes("page 1") && !pages[0].includes("page 2"));
  assert.equal(svg.toString(), pages[1], "toString() = current page");
  assert.equal(svg.toString(0), pages[0]);
});

test("SVG: standalone, well-formed, escaped, sized in mm", () => {
  const svg = new SvgSheet({ width: 420, height: 297, title: "A <b> & c" });
  svg.line(0, 0, 10, 10, { dash: "phantom" }).rect(5, 5, 10, 10, { fill: "#abc" }).circle(20, 20, 5)
    .arc(50, 50, 10, 0, 270, { cap: "round" }).polyline([[0, 0], [5, 5], [10, 0]], { close: true })
    .path([["M", 0, 0], ["C", 1, 1, 2, 2, 3, 3], ["Z"]])
    .text(10, 10, "a < b & \"c\" > d é", { align: "right", angle: 30, font: "mono" });
  const s = svg.toString();
  checkSvg(s);
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(s.includes('width="420mm" height="297mm" viewBox="0 0 420 297"'));
  assert.ok(s.includes('font-family="Helvetica, Arial, sans-serif"'));
  assert.ok(s.includes("a &lt; b &amp; &quot;c&quot; &gt; d é</text>"));
  assert.ok(s.includes("<title>A &lt;b&gt; &amp; c</title>"));
  assert.ok(s.includes('stroke-dasharray="8 1.5 1.5 1.5 1.5 1.5"'));
  assert.ok(s.includes("A10 10 0 1 1"), "270° arc uses the large-arc flag");
  assert.ok(s.includes('transform="rotate(30 10 10)"'));
  const loose = new SvgSheet({ exactText: false, background: null }).text(10, 10, "abc", { align: "center" }).toString();
  assert.ok(loose.includes('text-anchor="middle"') && !loose.includes("textLength") && !loose.includes("<rect"));
});

test("shared geometry / style helpers", () => {
  const { start, curves } = arcToBeziers(0, 0, 10, 0, 360);
  assert.equal(curves.length, 4);
  near(start[0], 10); near(curves[0][4], 0, 1e-9); near(curves[0][5], 10, 1e-9); // 0° → 90° goes toward +y
  assert.equal(arcToBeziers(0, 0, 1, 350, 10).curves.length, 1);                 // wraps: 20° sweep
  assert.deepEqual(resolveStyle({ dash: "hidden" }).dash, [3, 1.5]);
  assert.equal(resolveStyle({}).w, 0.25);
  assert.equal(resolveStyle({ w: 0, fill: "#f00" }).stroke, false);
  assert.equal(resolveStyle({ color: "#abc" }).color, "#aabbcc");
});

test("JPEG: synthesised image is parsed and embedded by both backends", () => {
  const jpeg = makeMosaicJpeg([[[255, 0, 0], [0, 255, 0], [0, 0, 255]], [[0, 0, 0], [128, 128, 128], [255, 255, 255]]]);
  assert.deepEqual(parseJpeg(jpeg), { bits: 8, height: 16, width: 24, components: 3 });
  assert.deepEqual([...base64Decode(base64Encode(jpeg))], [...jpeg]);
  assert.throws(() => parseJpeg(new Uint8Array([0x89, 0x50, 0x4E, 0x47])), /JPEG/);
  const dataUrl = `data:image/jpeg;base64,${base64Encode(jpeg)}`;

  const pdf = new PdfSheet();
  pdf.image(10, 10, 30, 20, jpeg).image(50, 10, 30, 20, dataUrl).image(90, 10, 30, 20, jpeg);
  const s = checkPdf(pdf.toBytes());
  assert.equal(s.match(/\/Subtype \/Image/g).length, 2, "the same source is embedded once");
  assert.ok(s.includes(`/Width 24 /Height 16 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length}`));
  assert.ok(s.includes("q 30 0 0 -20 10 30 cm /Im1 Do Q"));

  const svg = new SvgSheet().image(10, 10, 30, 20, jpeg).toString();
  checkSvg(svg);
  assert.ok(svg.includes(`xlink:href="${dataUrl}"`));
});

test("drafting helpers use only Sheet primitives and return their documented values", () => {
  const r = new Recorder({ width: 420, height: 297 });
  const frame = D.drawBorder(r);
  assert.deepEqual(frame, { x: 20, y: 10, w: 390, h: 277 });
  assert.deepEqual(D.drawTitleBlock(r, frame, { title: "Essai" }), { x: 230, y: 239, w: 180, h: 48 });
  const labels = r.calls.filter((c) => c[0] === "text").map((c) => c[3]);
  for (const l of ["Title", "Part No.", "Rev.", "Material", "Finish", "Mass", "Scale", "Sheet", "Size",
    "Drawn", "Checked", "Approved", "Date", "General tolerances", "Project", "Status", "Units",
    "DynamiteOrbit™", "by DynamiteAgile™", "ISO 2768-mK", "mm", "1/1", "Essai"]) assert.ok(labels.includes(l), l);
  assert.ok(labels.some((l) => /Co-Intelligence WorkFlow™ — document généré par DynamiteOrbit/.test(l)), "the note of the platform under the frame of every sheet");
  for (const z of ["1", "8", "A", "F"]) assert.ok(labels.includes(z), `zone ${z}`);
  assert.ok(!labels.includes("9") && !labels.includes("G"), "A3 = 8 x 6 zones");

  const dim = D.dimLinear(r, [10, 10], [50, 10], { dir: "h", offset: -8, tol: "±0.1" });
  assert.equal(dim.text, "40 ±0.1");
  near(dim.value, 40); near(dim.y, 2); near(dim.x, 30);
  near(D.dimLinear(r, [0, 0], [30, 40], { dir: "aligned" }).value, 50);
  assert.equal(D.dimLinear(r, [0, 0], [0, 25.5], { dir: "v" }).angle, -90);
  // Short span: arrows flip outside (the dimension line gets tails on both sides).
  const n0 = r.calls.length;
  D.dimLinear(r, [100, 100], [104, 100], { dir: "h", offset: 10 });
  const dimLine = r.calls.slice(n0).filter((c) => c[0] === "line").at(-1);
  assert.ok(dimLine[1] < 100 && dimLine[3] > 104, "tails beyond the extension lines");

  assert.equal(D.dimDiameter(r, [50, 50], 6).text, "Ø12");
  assert.equal(D.dimDiameter(r, [50, 50], 6, { text: "Ø12 H7", angle: 135 }).text, "Ø12 H7");
  D.dimDiameter(r, [50, 50], 30, { leader: false });
  D.dimDiameter(r, [50, 50], 3, { leader: false });
  assert.equal(D.dimRadius(r, [50, 50], 5).text, "R5");
  D.dimRadius(r, [50, 50], 25);
  assert.equal(D.leaderNote(r, [0, 0], [10, -10], ["a", "b"]).height > 3.5, true);
  D.leaderNote(r, [0, 0], [-10, -10], "seul", { end: "dot" });
  D.centerMark(r, [10, 10], 5); D.centerMark(r, [10, 10], 1); D.centerLine(r, [0, 0], [100, 0]); D.centerLine(r, [0, 0], [5, 0]);
  for (const dir of ["up", "down", "left", "right"]) assert.equal(D.datumFeature(r, 10, 10, "A", { dir }).w, 7);
  D.surfaceFinish(r, 10, 10, 1.6); D.surfaceFinish(r, 10, 10, "Rz 6.3", { angle: -90 });
  D.sectionArrows(r, [0, 0], [0, 100], "A"); D.viewLabel(r, 50, 50, "SECTION A-A", "SCALE 2:1");
  D.hatchPolygon(r, [[0, 0], [10, 0], [10, 10], [0, 10]]);
  D.projectionSymbol(r, 50, 50, "third");

  const fcf = D.featureControlFrame(r, 10, 10, { symbol: "position", tolerance: "0.2", diameter: true, modifier: "mmc", datums: ["A", "B", "C"] }, { h: 7 });
  assert.equal(fcf.height, 7);
  const tolW = Math.max(7, 2 * 7 * 0.22 + r.textWidth("Ø0.2", { size: 3.5 }) + 3.5 * 0.18 + 3.5 * 1.45);
  near(fcf.width, 7 + tolW + 3 * 7, 1e-9);
  near(D.featureControlFrame(r, 10, 10, { symbol: "flatness", tolerance: "0.05" }, { leaderTo: [0, 30] }).width, 7 + 2 * 7 * 0.22 + r.textWidth("0.05", { size: 3.5 }), 1e-9);

  assert.equal(D.GDT_SYMBOLS.length, 20);
  for (const name of D.GDT_SYMBOLS) {
    const before = r.calls.length;
    assert.equal(D.gdtSymbol(r, name, 0, 0, 7), 7);
    const drawn = r.calls.slice(before);
    assert.ok(drawn.length > 0 && drawn.every((c) => c[0] !== "text"), `${name} is drawn with vector strokes`);
  }

  assert.ok(D.drawNotes(r, 10, 10, 60, ["Une note assez longue pour être repliée sur plusieurs lignes.", "Deux"]) > 10);
  assert.deepEqual(D.drawTable(r, 0, 0, [{ title: "A", width: 10 }, { title: "B", width: 30, align: "right" }], [[1, 2], [3, 4]], { size: 2.5 }), { w: 40, h: 15 });
  assert.deepEqual(D.drawTable(r, 0, 0, [{ width: 10 }], [["x"]], { rowH: 6, title: "T" }), { w: 10, h: 12 });
  assert.deepEqual(D.drawRevisionTable(r, 410, 10, [{ rev: "A", description: "Initial release", date: "2026-11-14", by: "ATR" }], { align: "right" }), { w: 120, h: 15 });
  assert.deepEqual(D.PAPER, { A4: [297, 210], A3: [420, 297], A2: [594, 420], TABLOID: [431.8, 279.4] });
  assert.equal(r.count("image") + r.count("newPage"), 0);
  assert.ok(r.count("line") > 100 && r.count("text") > 60 && r.count("polyline") > 20);
});

test("demo sheet renders on both backends with the same content", () => {
  const [width, height] = D.PAPER.A3;
  const pdf = buildDemo(new PdfSheet({ width, height, title: "Démo" }));
  const svg = buildDemo(new SvgSheet({ width, height, title: "Démo" }));
  const p = checkPdf(pdf.toBytes());
  const s = svg.toString();
  checkSvg(s);
  assert.ok(p.includes("/Filter /DCTDecode") && s.includes("data:image/jpeg;base64,"));
  assert.ok(p.includes("(Material) Tj") && s.includes(">Material</text>"));
  assert.ok(p.includes("(M. C\\364t\\351) Tj") && s.includes(">M. Côté</text>"), "accented letters keep their code in the PDF");
  assert.ok(p.includes("(\\33040 H7) Tj") && s.includes(">Ø40 H7</text>"));
  assert.ok(p.includes("(General tolerances) Tj") && p.includes("(Part No.) Tj"));
  assert.equal(p.match(/\) Tj ET/g).length, s.match(/<text /g).length, "same number of text runs");
  assert.equal(parseJpeg(demoJpeg()).width, 160);
  assert.ok(!p.includes("NaN") && !s.includes("NaN"));
});
