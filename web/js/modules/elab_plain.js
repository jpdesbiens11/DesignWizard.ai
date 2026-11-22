/* DynamiteOrbit — Labo, said plainly, on the page (demande de JP : « simplifier et expliquer comme à un enfant de 16 ans… expliquer
   pourquoi les mesures virtuelles diffèrent de ce qui est demandé dans le labo réel »). The same three boxes for the Labo and for the
   bench mode ; the words are those of pcba/lab_plain.js, nothing is decided here.
     - benchTable(sheet) : « à l'écran du Labo » ↔ « au vrai banc », a line per thing the screen shows ;
     - whyList(sheet) : why the two differ — a short title, two or three sentences ;
     - wordList(words) : the words of the bench, each in a sentence. */

import { el, icon } from "../core/dom.js";
import { screenToBench, whyDifferent, WORDS } from "../pcba/lab_plain.js";

const DOT = { 1: "#ffd60a", 2: "#5ac8fa" };
/** What the screen shows, and what one does at the bench for it. */
export function benchTable(sheet) {
  const rows = screenToBench(sheet); if (!rows.length) return el("p", { class: "atelier-hint", "data-plain-map": "none" }, icon("info"), " Carte éteinte : l'écran ne trace rien. Tout se fait au multimètre, les pointes sur la carte.");
  return el("div", { class: "plain-map", "data-plain-map": String(rows.length) }, rows.map((r) => el("div", { class: "plain-map-row" },
    el("span", { class: "plain-screen" }, el("small", null, ...[r.ch ? el("i", { style: `background:${DOT[r.ch]}` }) : null, "À l'écran du Labo"].filter(Boolean)), r.screen), el("span", { class: "plain-bench" }, el("small", null, "Au vrai banc"), r.bench))));
}
/** Why the screen and the bench differ, for this test. */
export const whyList = (sheet) => el("div", { class: "plain-why", "data-plain-why": "" }, whyDifferent(sheet).map((w) => el("div", { class: "plain-why-item", "data-why": w.id }, el("b", null, w.title), el("p", null, w.text))));
/** The words of the bench, each in a sentence. */
export const wordList = (words = WORDS) => el("dl", { class: "plain-words" }, words.map((w) => [el("dt", null, w.word, w.en ? el("small", null, ` · ${w.en}`) : null), el("dd", null, w.says)]));
