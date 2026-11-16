// The mark every document of the platform carries : the words, and how each format takes them without breaking its readers.
// Run from the repository root:  node --test tests/node/brand.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { BRAND, BRAND_LINE, MARK, FOOT_NOTE, FOOT_NOTE_ASCII, STL_HEADER, LOGO, stampLine, stampText, markKind, isMarked, drawLogo, logoSvg } from "../../web/js/core/brand.js";
import { logoPng } from "../../web/js/core/brand_logo.js";
import { toDwiz, fromDwiz } from "../../web/js/core/dwiz.js";
import { readGerber } from "../../web/js/pcba/gerber_read.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { docx } from "../../web/js/core/docx.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";

test("the words of the mark, as the house writes them", () => {
  assert.equal(BRAND_LINE, "DesignWizard.ai™ by DynamiteAgile™"); assert.equal(MARK, "DesignWizard.ai™ by DynamiteAgile™ · Co-Intelligence WorkFlow™");
  assert.equal(FOOT_NOTE, "DesignWizard.ai™ by DynamiteAgile™ · Co-Intelligence WorkFlow™ — document généré par DesignWizard.ai. La version électronique fait foi ; la version imprimée est pour référence.");
  assert.ok(/^[\x20-\x7e]+$/.test(FOOT_NOTE_ASCII) && /Co-Intelligence WorkFlow\(TM\)/.test(FOOT_NOTE_ASCII) && !/[*%]/.test(FOOT_NOTE_ASCII), "plain ASCII, and nothing a Gerber file would trip on");
  assert.ok(STL_HEADER.length <= 72 && !/^solid/i.test(STL_HEADER)); assert.equal(BRAND.workflow, "Co-Intelligence WorkFlow™");
  assert.equal(stampLine(new Date(2026, 10, 16, 9, 5), "0.42.0"), "Extrait le 2026-11-16 09:05 — DesignWizard.ai v0.42.0"); assert.match(stampLine("nope"), /^Extrait le 1970-01-01|^Extrait le 1969-12-31/);
});

test("every text format takes the note where it may carry a comment — once, and without breaking what reads it", () => {
  const cases = { "a.txt": "ligne\n", "a.md": "# Titre\n", "a.csv": "ref;qte\nR1;2\n", "p.part.dwiz": toDwiz(DEMO_DRIVE.parts[0]), "f.fs": "FeatureScript 2000;\n", "v.dxf": "0\nSECTION\n0\nENDSEC\n0\nEOF\n", "s.step": "ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n", "s.stp": "ISO-10303-21;\nHEADER;\n",
    "d.drawio": "<?xml version=\"1.0\"?>\n<mxfile><diagram/></mxfile>", "c-F_Cu.gbr": "%FSLAX46Y46*%\n%MOMM*%\nM02*\n", "c.GTL": "%FSLAX46Y46*%\n", "c-PTH.DRL": "M48\nMETRIC\n%\nM30\n", "n.ipc": "P  JOB x\n", "o.json": "{\n  \"a\": 1\n}\n", "r.html": "<html><body><p>x</p></body></html>" };
  for (const [name, text] of Object.entries(cases)) { const s = stampText(name, text);
    assert.ok(isMarked(s) && s !== text, `${name} carries the note`); assert.equal(stampText(name, s), s, `${name} : marked once`); assert.ok(markKind(name), name); }
  assert.ok(cases["a.csv"] && stampText("a.csv", cases["a.csv"]).startsWith("ref;qte\nR1;2\n\""), "a CSV keeps its rows ; the note is one last quoted cell");
  assert.ok(stampText("v.dxf", cases["v.dxf"]).startsWith(`999\n${FOOT_NOTE_ASCII}\n0\nSECTION`), "a DXF comment is group 999"); assert.ok(stampText("s.step", cases["s.step"]).startsWith(`ISO-10303-21;\n/* ${FOOT_NOTE_ASCII} */\nHEADER;`));
  assert.ok(stampText("c-PTH.DRL", cases["c-PTH.DRL"]).startsWith(`M48\n; ${FOOT_NOTE_ASCII}\nMETRIC`)); assert.ok(stampText("f.fs", cases["f.fs"]).startsWith("FeatureScript 2000;"), "the version line of a FeatureScript stays first");
  assert.ok(stampText("d.drawio", cases["d.drawio"]).startsWith("<?xml version=\"1.0\"?>\n<!-- DesignWizard.ai™"), "after the prolog, before the root"); assert.match(stampText("r.html", cases["r.html"]), /<!-- DesignWizard\.ai™[^>]*-->\n<\/body>/);
  // the readers of the platform still read what it marks
  const back = fromDwiz(stampText("p.part.dwiz", cases["p.part.dwiz"])); assert.equal(back.id, DEMO_DRIVE.parts[0].id); assert.equal(toDwiz(back), cases["p.part.dwiz"], "the note is a comment of the .dwiz : the part comes back the same");
  const g = readGerber(stampText("c-F_Cu.gbr", cases["c-F_Cu.gbr"])); assert.equal(g.units, "mm"); assert.deepEqual(JSON.parse(stampText("o.json", cases["o.json"])), { _mark: FOOT_NOTE, a: 1 });
  for (const n of ["c.GTL", "c.GBL", "c.G1", "c.G2", "c.GP1", "c.GTS", "c.GBS", "c.GTO", "c.GTP", "c.GKO", "c-vernis.gbr"]) assert.equal(markKind(n), "gbr", `${n} is a Gerber file`);
  // what is not a text document of the platform is left alone
  assert.equal(stampText("l.json", "[1, 2]"), "[1, 2]"); assert.equal(stampText("b.json", "{oops"), "{oops"); assert.equal(stampText("acces.json", "{\"a\":1}"), "{\"a\":1}", "a setting of the site is not a document"); assert.equal(stampText("x.png", "abc"), "abc"); assert.equal(markKind("x.zip"), "");
  const bytes = new Uint8Array([1, 2, 3]); assert.equal(stampText("a.txt", bytes), bytes, "bytes go through untouched");
});

test("the mark as a drawing : the same figure for the PDF, the page and the Word header", () => {
  const calls = [], sheet = { line: (...a) => calls.push(["line", ...a]), polyline: (...a) => calls.push(["polyline", ...a]) };
  drawLogo(sheet, 10, 20, 32); assert.deepEqual(calls.map((c) => c[0]), ["line", "line", "polyline", "polyline"]);
  const pts = calls.flatMap((c) => (c[0] === "line" ? [[c[1], c[2]], [c[3], c[4]]] : c[1])); assert.ok(pts.every(([x, y]) => x >= 10 - 1e-9 && x <= 42 + 1e-9 && y >= 20 - 1e-9 && y <= 52 + 1e-9), "inside its 32 × 32 box");
  assert.deepEqual([calls[0][5].color, calls[2][2].color, calls[3][2].fill, calls[3][2].close], [LOGO.ink, LOGO.blue, LOGO.yellow, true]); assert.match(logoSvg(24), /^<svg [^>]*viewBox="0 0 64 64" width="24" height="24"/); assert.equal((logoSvg().match(/<path /g) || []).length, 4);
  const png = logoPng(); assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "a PNG"); assert.ok(png.length > 2000 && png.length < 12000);
});

test("a PDF and a Word document : the mark on top of every page, the note at the bottom", () => {
  const doc = { title: "Gamme — P-1", subtitle: "Pièce", author: "A", date: new Date(Date.UTC(2026, 10, 16)), reference: "P-1-GAMME", revision: "B", header: "P-1 — Gamme", footer: "P-1 rév. B", blocks: [{ type: "h1", text: "1. Synthèse" }, { type: "p", text: "Texte." }, { type: "pagebreak" }, { type: "h1", text: "2. Suite" }] };
  const pdf = new TextDecoder("latin1").decode(pdfDoc(doc)), pages = (pdf.match(/\/Type \/Page\b/g) || []).length;
  assert.ok(pages >= 3); assert.equal((pdf.match(/Co-Intelligence WorkFlow\\231 \\227 document/g) || []).length, pages, "the note on every page, the title page too"); assert.equal((pdf.match(/\(DesignWizard\.ai\\231 by DynamiteAgile\\231\)/g) || []).length, pages - 1, "who made it, in the header of every page after the title");
  const files = new Map(); { const z = docx(doc), dv = new DataView(z.buffer); let o = 0; while (dv.getUint32(o, true) === 0x04034b50) { const n = dv.getUint16(o + 26, true), x = dv.getUint16(o + 28, true), size = dv.getUint32(o + 18, true), name = new TextDecoder().decode(z.subarray(o + 30, o + 30 + n)); files.set(name, z.subarray(o + 30 + n + x, o + 30 + n + x + size)); o += 30 + n + x + size; } }
  const xml = (n) => new TextDecoder().decode(files.get(n)); assert.ok(files.has("word/media/dw_logo.png")); assert.match(xml("word/header1.xml"), /DesignWizard\.ai™/); assert.match(xml("word/header1.xml"), /P-1-GAMME/); assert.match(xml("word/header1.xml"), /NUMPAGES/); assert.ok(xml("word/footer1.xml").includes(FOOT_NOTE) && xml("word/footer1.xml").includes("P-1 rév. B"));
});

test("no writer of a document goes round the mark : the files that write one import it, or leave by download()", () => {
  const read = (p) => readFileSync(new URL(`../../web/js/${p}`, import.meta.url), "utf8");
  for (const p of ["core/pdfdoc.js", "core/docx.js", "draw/drafting3.js", "cad/stl.js", "pcba/fabfiles.js", "core/artifacts.js", "core/dom.js", "modules/report.js"]) assert.match(read(p), /from "\.{1,2}\/(core\/)?brand\.js"/, `${p} carries the mark`);
  assert.match(read("core/dom.js"), /new Blob\(\[stampText\(name, data\)\]/, "every text that leaves by a download is marked");
  const bare = readdirSync(new URL("../../web/js/modules/", import.meta.url)).filter((f) => /\.js$/.test(f)).filter((f) => /URL\.createObjectURL\(new Blob\(\[/.test(read(`modules/${f}`)));
  assert.deepEqual(bare, [], "a screen saves a file through download(), never through a Blob of its own");
});
