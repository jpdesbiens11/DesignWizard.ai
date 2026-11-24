/* DynamiteOrbit.ai — Dessins : the English of what the project writes on a sheet. A drawing is written in English ; the
   name of a part, of an interface, the label of a parameter, a finish, a note are the project's own words, often French.
   This dialog lists the texts the sheet in view writes and takes their English, one line each — or hands the list to an AI
   as one would to a technician, and reads its answer back for the human to check before saving (one undoable step).
   The words are kept once for the project (project.drawing.words) : a text translated for a part is translated everywhere. */

import { el, btn, badge, toast, modal, copyText } from "../core/dom.js";
import { store } from "../core/store.js";
import { tidyWords, wordsLeft, wordsBrief, readWords, wordsUnused } from "../core/drawing_words.js";

const words = () => tidyWords(store.project && store.project.drawing && store.project.drawing.words);

/** The section of the right pane : how many texts of the sheet have their English, and the way to give the others theirs. */
export function wordsSection(texts, sheetName) {
  const left = wordsLeft(words(), texts);
  return el("div", { class: "side-section", "data-words": String(left.length) }, el("h3", null, "Anglais du dessin"),
    el("p", { style: { fontSize: ".84rem", margin: "0 0 .4rem" } }, left.length ? badge(`${left.length} sans anglais`, "warn") : badge("tout en anglais", "ok"), ` ${texts.length} texte${texts.length > 1 ? "s" : ""} du projet sur cette feuille : nom, interfaces, paramètres, finition, notes.`),
    el("div", { class: "form-actions" }, btn(left.length ? "Donner l'anglais" : "Revoir l'anglais", () => wordsDialog(texts, sheetName), { small: true, primary: !!left.length, icon: "drawing", tip: "Le dessin écrit l'anglais d'un texte quand le projet l'a donné ; les écrans gardent le texte tel qu'il a été tapé" })),
    el("p", { class: "muted", style: { fontSize: ".8rem" } }, "Le dessin est rédigé en anglais. Ce que le projet a tapé reste tel quel à l'écran ; son anglais, donné une fois, vaut pour tous les dessins du projet."));
}

/** The dialog : a line per text, the round trip with an AI, one save. */
export function wordsDialog(texts, sheetName) {
  const have = words(), rows = texts.map((t) => ({ t, input: el("input", { type: "text", value: have[t] || "", "data-word": t, "aria-label": `Anglais de « ${t} »`, placeholder: "English" }) }));
  const count = el("span", { class: "muted small" }), tally = () => { const n = rows.filter((r) => !r.input.value.trim()).length; count.textContent = n ? `${n} sans anglais` : "tout a son anglais"; };
  const list = el("div", { class: "dw-words" }, rows.map((r) => { r.input.addEventListener("input", tally);
    return el("div", { class: "dw-word" }, el("span", { class: "dw-word-fr" }, r.t), r.input, btn("=", () => { r.input.value = r.t; tally(); }, { small: true, tip: "Ce texte est déjà en anglais : le garder tel quel" })); }));
  const values = () => Object.fromEntries(rows.map((r) => [r.t, r.input.value.trim()]));
  const paste = el("textarea", { rows: 4, placeholder: "Collez ici la réponse de l'IA : le même objet JSON, rempli", "aria-label": "Réponse de l'IA" });
  const read = () => { try { const got = readWords(paste.value, texts); let n = 0; for (const r of rows) if (got.words[r.t]) { r.input.value = got.words[r.t]; r.input.classList.add("flash"); n++; } tally();
    toast(`${n} texte${n > 1 ? "s" : ""} rempli${n > 1 ? "s" : ""}${got.unknown.length ? ` · ${got.unknown.length} clé(s) hors de la liste, ignorée(s)` : ""}${got.empty.length ? ` · ${got.empty.length} resté(s) sans réponse` : ""}. Relisez, puis enregistrez.`, n ? "success" : "warn", 7000); } catch (e) { toast(e.message, "error", 7000); } };
  const save = () => { const v = values(), n = Object.values(v).filter(Boolean).length;
    store.commit(`Dessins : anglais du dessin (${n} texte${n > 1 ? "s" : ""})`, (p) => { const all = { ...tidyWords(p.drawing && p.drawing.words) }; for (const [k, en] of Object.entries(v)) { if (en) all[k] = en; else delete all[k]; } p.drawing = { ...(p.drawing || {}), words: all }; });
    dlg.close(); toast(`Anglais enregistré : ${n} texte${n > 1 ? "s" : ""} sur ${texts.length} (Ctrl+Z pour annuler).`, "success"); };
  const unused = wordsUnused(store.project), sweep = unused.length ? btn(`Retirer ${unused.length} mot${unused.length > 1 ? "s" : ""} inutilisé${unused.length > 1 ? "s" : ""}`, () => { store.commit("Dessins : mots anglais inutilisés retirés", (p) => { const all = { ...tidyWords(p.drawing && p.drawing.words) }; for (const k of unused) delete all[k]; p.drawing = { ...(p.drawing || {}), words: all }; }); sweep.remove(); toast("Mots inutilisés retirés (Ctrl+Z pour annuler).", "success"); },
    { small: true, tip: "Des textes dont le nom a changé : plus aucun dessin du projet ne les écrit" }) : null;
  const dlg = modal(`Anglais du dessin — ${sheetName}`, [
    el("p", { class: "muted", style: { fontSize: ".86rem", marginTop: 0 } }, "Chaque texte que le projet écrit sur cette feuille, et son anglais de dessin. Un texte laissé vide s'écrit tel quel."), el("div", { class: "form-actions", style: { justifyContent: "space-between" } }, count, sweep), list,
    el("details", { class: "dw-words-ai" }, el("summary", null, "Confier la liste à une IA"), el("p", { class: "muted", style: { fontSize: ".84rem" } }, "Copiez la consigne et la liste, collez-les dans l'IA de votre choix, puis collez sa réponse ici : les lignes se remplissent, vous relisez avant d'enregistrer."),
      el("div", { class: "form-actions" }, btn("Copier pour une IA", async () => { const ok = await copyText(wordsBrief(texts, values())); toast(ok ? "Consigne et liste copiées." : "Copie impossible : sélectionnez le texte à la main.", ok ? "success" : "error"); }, { small: true, icon: "sparkle" })), paste, el("div", { class: "form-actions" }, btn("Lire la réponse", read, { small: true }))),
    el("div", { class: "form-actions" }, btn("Annuler", () => dlg.close(), { small: true }), btn("Enregistrer l'anglais", save, { primary: true, small: true, icon: "check" }))], { wide: true });
  tally(); return dlg;
}
