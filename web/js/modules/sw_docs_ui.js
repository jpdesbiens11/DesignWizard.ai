/* DesignOrbit.ai — Logiciel : the two documents, at hand (cycle en V) — the specification of the requirements on the step « 1 Exigences », the
   report of verification on « 6 Vérification », both on « 7 Livraison ». One row : the document's name, « Word », « PDF ». The content is
   sw/sw_docs.js ; what every document of the platform carries (title block, title page, approvals, the note) is added here by docMeta. */

import { el, btn, toast, download } from "../core/dom.js";
import { store } from "../core/store.js";
import { docMeta, APP_VERSION } from "../core/app.js";
import { docx } from "../core/docx.js";
import { pdfDoc } from "../core/pdfdoc.js";
import { srsDoc, svrDoc } from "../sw/sw_docs.js";

const DOCS = {
  srs: { name: "Spécification", long: "La spécification des exigences du logiciel", file: "specification-exigences", make: srsDoc, tip: "Ce que le logiciel doit faire : chaque exigence, sa preuve, ses tuiles, la trace — au gabarit des documents" },
  svr: { name: "Rapport de vérification", long: "Le rapport de vérification du logiciel", file: "rapport-verification", make: svrDoc, tip: "Ce qui a été prouvé : chaque essai sur le modèle, ses attendus, la matrice, la couverture du modèle, la liste de livraison" },
};
/** Writes one document. which : "srs" | "svr" ; kind : "docx" | "pdf" */
export function saveDoc(d, which, kind) {
  const D = DOCS[which], p = store.project || {};
  try {
    const model = { ...D.make(d, { date: new Date(), author: (p.drawing && p.drawing.drawnBy) || p.author || "", version: APP_VERSION }), ...docMeta() }, name = `${d.id}-${D.file}`;
    if (kind === "docx") download(`${name}.docx`, docx(model), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); else download(`${name}.pdf`, pdfDoc(model), "application/pdf");
    toast(`${D.long} : ${kind === "docx" ? "Word" : "PDF"} écrit.`, "success", 3500);
  } catch (e) { toast(`${D.long} : ${e.message}`, "error", 8000); }
}
/** A row : the document, Word, PDF. → an element */
export function docRow(d, which) {
  const D = DOCS[which], w = btn("Word", () => saveDoc(d, which, "docx"), { small: true, icon: "download", tip: `${D.tip} (.docx)` }), p = btn("PDF", () => saveDoc(d, which, "pdf"), { small: true, icon: "download", tip: `${D.tip} (.pdf)` });
  w.dataset.swDoc = `${which}-docx`; p.dataset.swDoc = `${which}-pdf`;
  return el("div", { class: "sw-doc-row", "data-sw-docs": which }, el("span", { class: "sw-doc-name", "data-tip": D.tip }, D.name), w, p);
}
/** The section of « 7 Livraison » : what leaves with the software. */
export function docsSection(d) {
  return el("div", { class: "side-section", "data-box": "docs", "data-fold-note": "2 documents" }, el("h3", null, "Les documents du logiciel"),
    el("p", { class: "muted small" }, "Ils partent avec le paquet, au gabarit des documents de la plateforme ; le paquet C en porte la même matière, en anglais : doc/REQUIREMENTS.md et doc/VERIFICATION.md."),
    docRow(d, "srs"), docRow(d, "svr"),
    el("p", { class: "muted small" }, "Leur plan suit l'usage du métier, écrit de mémoire : aucun gabarit d'une norme n'a été lu. Les essais qu'ils rapportent ont tourné sur le modèle, pas sur le CPU."));
}
