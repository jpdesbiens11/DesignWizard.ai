/* PCBA: the flow status, the mechanical twin, the design-review report as a document model, as .docx and as PDF. */
import test from "node:test";
import assert from "node:assert/strict";
import { reviewData } from "../../web/js/pcba/review_data.js";
import { reviewDoc, reviewVerdict, REVIEW_KINDS } from "../../web/js/pcba/review.js";
import { docx } from "../../web/js/core/docx.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { flowStatus, FLOW } from "../../web/js/pcba/status.js";
import { boardFromPart, inheritFromPart, twinPart } from "../../web/js/pcba/twin.js";
import { erc } from "../../web/js/pcba/erc.js";
import { checkBoard } from "../../web/js/pcba/drc.js";
import { floorplan, placeParts, zoneProblems, placementProblems } from "../../web/js/pcba/place.js";
import { autoroute } from "../../web/js/pcba/route.js";
import { LIBRARY } from "../../web/js/pcba/library.js";
import { DEMO_DRIVE } from "../../web/js/demo/demo_drive.js";
import { LIB, smallBoard, controlBoard } from "./pcba_fixture.mjs";

const when = new Date("2026-11-14T12:00:00Z");
/** Files of a stored ZIP : name → bytes. */
function unzip(z) { const out = new Map(); for (let p = 0; z[p] === 0x50 && z[p + 1] === 0x4b && z[p + 2] === 3 && z[p + 3] === 4;) { const v = new DataView(z.buffer, z.byteOffset + p), n = v.getUint16(26, true), size = v.getUint32(18, true); out.set(new TextDecoder().decode(z.subarray(p + 30, p + 30 + n)), z.subarray(p + 30 + n, p + 30 + n + size)); p += 30 + n + size; } return out; }
/** Every tag of an XML text closes in order. */
function wellFormed(xml) { const stack = []; for (const m of xml.replace(/<\?[^>]*\?>/g, "").matchAll(/<(\/?)([\w:.]+)((?:"[^"]*"|[^">])*?)(\/?)>/g)) { if (m[4]) continue; if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]); } return stack.length === 0; }

test("flow: where a board stands — functions, architecture, layout, reviews", () => {
  const st = (b) => flowStatus(b, { erc: erc(b, LIBRARY), zones: zoneProblems(b, LIBRARY), placement: placementProblems(b, LIBRARY), drc: checkBoard(b, LIBRARY) }), state = (s) => Object.fromEntries(s.steps.map((x) => [x.key, x.state]));
  assert.deepEqual(FLOW.map((f) => f.key), ["fonctions", "architecture", "implantation", "pdr", "layout", "verifs", "fabrication", "cdr"]);
  const b = controlBoard([60, 90], 4);
  let s = st(b); assert.equal(s.current, "implantation"); assert.equal(state(s).fonctions, "done"); assert.equal(state(s).pdr, "todo"); assert.match(s.steps[0].detail, /11 fonctions/);
  floorplan(b, LIBRARY); s = st(b); assert.equal(state(s).pdr, "done"); assert.equal(s.current, "layout"); assert.match(s.steps.find((x) => x.key === "layout").detail, /57 composants à placer/);
  placeParts(b, LIBRARY); s = st(b); assert.match(s.steps.find((x) => x.key === "layout").detail, /liaisons à router/); assert.equal(state(s).verifs, "todo");
  const e = controlBoard(); e.functions.push({ id: "F99", parent: null, name: "Mesurer la vitesse", kind: "principale", criteria: [], block: null });
  s = st(e); assert.equal(state(s).fonctions, "todo"); assert.match(s.steps[0].detail, /1 sans solution/); assert.equal(s.current, "fonctions");
  const small = smallBoard(); autoroute(small, LIB); s = flowStatus(small, { erc: { summary: { error: 0, warn: 0 } }, zones: [], placement: [], drc: checkBoard(small, LIB) }); assert.equal(state(s).cdr, "done"); assert.equal(state(s).fabrication, "done");
});

test("mechanical twin: the board takes outline and holes from its part and gives back its components", () => {
  const part = DEMO_DRIVE.parts.find((p) => p.id === "DRV-CTRL-PCB"), m = boardFromPart(part);
  assert.deepEqual(m.size, [60, 90]); assert.equal(m.t, 1.6); assert.deepEqual(m.holes.map((h) => h.at), [[5, 5], [55, 5], [5, 85], [55, 85]]); assert.equal(m.holes[0].d, 3.4);
  const b = controlBoard(); assert.equal(inheritFromPart(b, part), true); assert.equal(b.part, "DRV-CTRL-PCB"); assert.equal(inheritFromPart(b, part), false, "nothing changes the second time");
  floorplan(b, LIBRARY); placeParts(b, LIBRARY);
  const twin = twinPart(b, LIBRARY, part);
  assert.equal(twin.interfaces.length, 1, "the part keeps its bolt pattern"); assert.ok(twin.pcb.components.length > 40 && twin.pcb.components.every((c) => c.size[2] >= 0.3)); assert.equal(twin.pcb.nets["+24V"].voltage, 24); assert.equal(twin.pcb.nets.LV.voltage, 12, "what the part declared stays");
  assert.equal(twinPart(b, LIBRARY).family, "pcb"); assert.equal(boardFromPart({ id: "X" }), null);
});

test("review: the document follows the data — sections, tables, verdict, check-list", () => {
  const b = controlBoard([60, 90], 4); floorplan(b, LIBRARY); placeParts(b, LIBRARY);
  const pdr = reviewData(b, LIBRARY, { kind: "PDR", author: "Bureau d'études", date: when, project: { id: "P1", name: "Variateur compact" }, open: ["Choisir la référence du microcontrôleur."] }), doc = reviewDoc(pdr);
  assert.equal(reviewVerdict(pdr).ready, true); assert.equal(doc.title, "Revue de conception préliminaire — CTRL"); assert.equal(doc.reference, "CTRL-RCP");
  assert.deepEqual(doc.blocks.filter((x) => x.type === "h1").map((x) => x.text.replace(/^\d+\. /, "")), ["Objet et périmètre", "Besoin et arbre fonctionnel", "Architecture", "Implantation conceptuelle", "Nomenclature préliminaire", "Risques et points ouverts", "Liste de vérification de la revue préliminaire", "Décisions, réserves et signatures"]);
  const tables = doc.blocks.filter((x) => x.type === "table"); assert.equal(tables[0].rows.length, 11, "one row per function"); assert.equal(tables[tables.length - 1].rows.length, pdr.bom.length);
  assert.ok(doc.blocks.some((x) => x.type === "list" && x.items.some((i) => /Inductance : L = Vs/.test(i))), "the sizing of the buck regulator is printed");
  assert.ok(doc.blocks.find((x) => x.type === "checklist").items.every((i) => i.state === "ok")); assert.ok(doc.blocks.some((x) => x.type === "signatures"));
  const cdr = reviewData(b, LIBRARY, { kind: "CDR", date: when }), v = reviewVerdict(cdr), d2 = reviewDoc(cdr);
  assert.equal(v.ready, false, "an unrouted board is not ready for the detailed review"); assert.ok(v.blockers.some((x) => /liaison/.test(x))); assert.ok(d2.blocks.some((x) => x.type === "h1" && /Dossier de fabrication/.test(x.text)));
  assert.ok(d2.blocks.find((x) => x.type === "checklist").items.some((i) => i.text === "Le routage est complet" && i.state === "open")); assert.equal(Object.keys(REVIEW_KINDS).length, 2);
  const e = controlBoard(); e.functions.push({ id: "F99", parent: null, name: "Mesurer la vitesse", kind: "principale", criteria: [], block: null });
  assert.equal(reviewVerdict(reviewData(e, LIBRARY, { kind: "PDR", date: when })).ready, false);
});

test(".docx and PDF: valid packages, the same content, figures and page numbers", () => {
  const b = smallBoard(); autoroute(b, LIB);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0x90, 0x77, 0x53, 0xde, 0, 0, 0, 12, 0x49, 0x44, 0x41, 0x54, 8, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0, 0, 3, 1, 1, 0, 0x18, 0xdd, 0x8d, 0xb0, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  let drawn = 0; const figures = { floorplan: { png, pngSize: [1, 1], draw: (sheet, x, y, w, h) => { drawn++; sheet.rect(x, y, w, h, { color: "#000" }); }, width: 80, height: 60, caption: "Figure 1 — Implantation" } };
  const doc = reviewDoc(reviewData(b, LIB, { kind: "CDR", author: "É. Tremblay", date: when, figures })), z = docx(doc), files = unzip(z), text = (n) => new TextDecoder().decode(files.get(n));
  for (const n of ["[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "docProps/app.xml", "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/settings.xml", "word/header1.xml", "word/footer1.xml", "word/_rels/document.xml.rels", "word/media/image1.png"]) assert.ok(files.has(n), n);
  for (const [n, bytes] of files) if (n.endsWith(".xml") || n.endsWith(".rels")) assert.ok(wellFormed(new TextDecoder().decode(bytes)), `${n} is well formed`);
  assert.deepEqual([...files.get("word/media/image1.png")], [...png]);
  const body = text("word/document.xml");
  for (const s of ["Revue de conception détaillée — T-PCBA", "Besoin et arbre fonctionnel", "Abaisser 12 V vers 5 V", "É. Tremblay", "10 µF", "Figure 1 — Implantation", "TOC \\o"]) assert.ok(body.includes(s), s);
  assert.ok(body.includes('r:embed="rId6"') && text("word/_rels/document.xml.rels").includes('Id="rId6"') && text("word/_rels/document.xml.rels").includes("media/image1.png"));
  assert.match(text("word/header1.xml"), /NUMPAGES/); assert.match(text("word/header1.xml"), /DynamiteOrbit™/); assert.match(text("word/header1.xml"), /r:embed="rIdLogo"/); assert.ok(text("word/media/dw_logo.png").length > 1000 && /rIdLogo/.test(text("word/_rels/header1.xml.rels")), "the mark of the platform in the header of every page");
  assert.match(text("word/footer1.xml"), /DynamiteOrbit™ by DynamiteAgile™ · Co-Intelligence WorkFlow™ — document généré par DynamiteOrbit\. La version électronique fait foi ; la version imprimée est pour référence\./); assert.ok(!/[<>&](?![a-z#/?!w]|amp;|lt;|gt;|quot;)/.test(text("docProps/core.xml").replace(/<[^>]+>/g, "")));
  const pdf = pdfDoc(doc), raw = new TextDecoder("latin1").decode(pdf), pages = (raw.match(/\/Type \/Page\b/g) || []).length;
  assert.ok(raw.startsWith("%PDF-1.4")); assert.ok(pages >= 4, `${pages} pages`); assert.ok(drawn >= 2, "the figure is drawn in both layout passes");
  assert.ok(raw.includes(`(2 de ${pages})`) && raw.includes(`(${pages} de ${pages})`) && !raw.includes(`(${pages + 1} de`), "the page of the title block, on every page"); assert.ok(raw.includes("(Sommaire)") && raw.includes("Revue de conception d\\351taill\\351e"));
});
