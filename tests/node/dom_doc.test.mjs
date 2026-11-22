// A screen as a document : the blocks of the PDF / Word document model read from what the report shows.
// Run from the repository root:  node --test tests/node/dom_doc.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { blocksOf } from "../../web/js/core/dom_doc.js";
import { pdfDoc } from "../../web/js/core/pdfdoc.js";
import { docx } from "../../web/js/core/docx.js";
import { confidentialNote, docIdentity } from "../../web/js/core/brand.js";

const N = (tagName, attrs = {}, ...children) => { const kids = children.filter((c) => typeof c !== "string"), words = children.filter((c) => typeof c === "string").join(" ");
  return { tagName: tagName.toUpperCase(), className: attrs.class || "", children: kids, ...attrs, getAttribute: (k) => (k === "class" ? attrs.class || null : attrs[k] ?? null), get textContent() { return [words, ...kids.map((k) => k.textContent)].join(" "); } }; };
const JPEG = "data:image/jpeg;base64,/9j/4AAQ";

test("the report on screen becomes the blocks of a document : titles, text, tables, key figures, pictures", () => {
  const root = N("article", {},
    N("section", { class: "card" }, N("p", { class: "muted" }, "Dossier de revue"), N("h2", {}, "Variateur"), N("div", { class: "kpis" }, N("div", { class: "kpi" }, N("b", {}, "1,79 kg"), N("span", {}, "Masse")), N("div", { class: "kpi" }, N("b", {}, "0"), N("span", {}, "DFx : à corriger")))),
    N("section", { class: "card" }, N("h2", {}, "Assemblage DRV-ASM"), N("div", { class: "two-col" }, N("figure", {}, N("img", { src: JPEG, alt: "DRV-ASM assemblé", naturalWidth: 900, naturalHeight: 600 }), N("figcaption", {}, "Vue assemblée"))),
      N("h3", {}, "Nomenclature (BOM)"), N("table", { class: "data" }, N("thead", {}, N("tr", {}, N("th", {}, "#"), N("th", {}, "Référence"), N("th", {}, "Qté"))), N("tbody", {}, N("tr", {}, N("td", {}, "1"), N("td", {}, "DRV-BASE"), N("td", {}, "1")), N("tr", {}, N("td", {}, "2"), N("td", {}, "DRV-COVER"), N("td", {}, "1")))),
      N("table", { class: "data" }, N("tbody", {}, N("tr", {}, N("td", {}, "Fonction"), N("td", {}, "Ferme le boîtier")), N("tr", {}, N("td", {}, "Masse"), N("td", {}, "50,4 g")))),
      N("ul", {}, N("li", {}, "Un"), N("li", {}, "Deux")), N("div", { class: "form-actions no-print" }, N("button", {}, "Ajouter")), N("svg", {}, N("text", {}, "dessin"))),
    N("section", { class: "card" }, N("h2", {}, "Décision de la revue"), N("div", { class: "form-row" }, N("label", { class: "field" }, N("span", { class: "field-label" }, "Décision"), N("select", { selectedIndex: 1 }, N("option", {}, ""), N("option", { selected: true }, "Approuvé avec actions"))), N("label", { class: "field" }, N("span", { class: "field-label" }, "Date de la revue"), N("input", { value: "2026-11-20" }))),
      N("table", {}, N("thead", {}, N("tr", {}, N("th", {}, "Action"), N("th", {}, "État"))), N("tbody", {}, N("tr", {}, N("td", {}, N("input", { value: "Épaissir la paroi" })), N("td", {}, N("select", {}, N("option", {}, "Ouverte"), N("option", { selected: true }, "En cours"))))))));
  const b = blocksOf(root);
  assert.deepEqual(b.map((x) => x.type), ["p", "h1", "kv", "h1", "figure", "h2", "table", "kv", "list", "h1", "kv", "table"]);
  assert.deepEqual(b[0], { type: "p", text: "Dossier de revue", style: "muted" }); assert.deepEqual(b[2].rows, [["Masse", "1,79 kg"], ["DFx : à corriger", "0"]]);
  assert.deepEqual([b[4].caption, b[4].size, b[4].jpeg], ["Vue assemblée", [900, 600], JPEG]); assert.deepEqual(b[6], { type: "table", head: ["#", "Référence", "Qté"], rows: [["1", "DRV-BASE", "1"], ["2", "DRV-COVER", "1"]], widths: [5, 9, 5] }, "each column as wide as what it says");
  assert.deepEqual(b[7].rows, [["Fonction", "Ferme le boîtier"], ["Masse", "50,4 g"]], "a table of two columns with no header is a list of facts"); assert.deepEqual(b[8].items, ["Un", "Deux"]);
  assert.deepEqual(b[10].rows, [["Décision", "Approuvé avec actions"], ["Date de la revue", "2026-11-20"]], "a field says its value, a list its chosen option"); assert.deepEqual(b[11].rows, [["Épaissir la paroi", "En cours"]]); assert.deepEqual(b[11].widths, [17, 8]);
  assert.ok(!JSON.stringify(b).includes("Ajouter") && !JSON.stringify(b).includes("dessin"), "buttons and drawings stay on the screen"); assert.deepEqual(blocksOf(null), []);
});

test("the document of the house : title block on every page, approval and log of revisions on the first, confidentiality and mark at the bottom", () => {
  const id = docIdentity({ name: "Variateur", author: "JDE", drawing: { checkedBy: "ADO", approvedBy: "EZA", organisation: "Atelier Démo inc." } }, new Date(2026, 10, 16, 14, 2), "0.44.0");
  assert.deepEqual(id.approvals.map((a) => [a.role, a.name]), [["Préparé par", "JDE"], ["Vérifié par", "ADO"], ["Approuvé par", "EZA"]]); assert.equal(id.stamp, "Extrait le 2026-11-16 14:02 — DynamiteOrbit v0.44.0");
  assert.match(id.confidential, /^CONFIDENTIEL — ce document et les informations qu'il contient sont la propriété de Atelier Démo inc\. Toute reproduction, diffusion ou utilisation sans son autorisation écrite est interdite\.$/);
  assert.match(confidentialNote(), /la propriété de son émetteur/); assert.equal(confidentialNote("X", "Usage interne."), "Usage interne.", "a project may word its own note"); assert.equal(docIdentity({ drawing: { confidentiality: "Diffusion restreinte." } }).confidential, "Diffusion restreinte.");
  const doc = { title: "Dossier de revue de conception", subtitle: "Variateur", kind: "Rapport de revue de conception", reference: "DRV-REVUE", revision: "B", date: new Date(Date.UTC(2026, 10, 16)), header: "Variateur — revue de conception", ...id,
    revisions: [{ rev: "A", reason: "Émission", sections: "Toutes", by: "JDE", date: "2026-11-01" }, { rev: "B", reason: "Paroi épaissie", sections: "3", by: "JDE", date: "2026-11-16" }], blocks: [{ type: "toc" }, { type: "h1", text: "1. Synthèse" }, { type: "p", text: "Texte." }, { type: "pagebreak" }, { type: "h1", text: "2. Pièces" }] };
  const pdf = new TextDecoder("latin1").decode(pdfDoc(doc)), pages = (pdf.match(/\/Type \/Page\b/g) || []).length;
  for (const words of ["(Approbation)", "(Journal des r\\351visions)", "(Pr\\351par\\351 par)", "(V\\351rifi\\351 par)", "(Approuv\\351 par)", "(Paroi \\351paissie)", "(RAPPORT DE REVUE DE CONCEPTION)", "(DRV-REVUE)", "(Atelier D\\351mo inc.)"]) assert.ok(pdf.includes(words), `the PDF says ${words}`);
  assert.equal((pdf.match(/CONFIDENTIEL \\227 ce document/g) || []).length, pages, "the confidentiality note on every page"); assert.equal((pdf.match(/Co-Intelligence WorkFlow\\231 \\227 document/g) || []).length, pages); assert.equal((pdf.match(/\(N\\260 doc\. :\)/g) || []).length, pages, "the title block on every page");
  assert.ok(pdf.includes(`(${pages} de ${pages})`) && pdf.includes(`(1 de ${pages})`)); assert.equal((pdf.match(/Extrait le 2026-11-16 14:02/g) || []).length, pages);
  const z = docx(doc), all = new TextDecoder().decode(z); for (const words of ["Approbation", "Journal des révisions", "Préparé par", "Paroi épaissie", "CONFIDENTIEL — ce document", "RAPPORT DE REVUE DE CONCEPTION", "N° doc. :"]) assert.ok(all.includes(words), `the Word document says « ${words} »`);
});

