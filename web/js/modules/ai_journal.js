/* DynamiteOrbit — the journal of the AI answers applied, as a box one can put on any screen (demande de JP : « pouvoir
   revenir en arrière si l'IA n'a pas bien compris et le résultat est décevant »). Each line is one answer — what it was asked,
   when, what it created, changed or took away — and « Revenir à avant » undoes THAT answer, even after other changes, as one
   undoable step (core/ai_door.js : revertEntry). The door of the Shop and the common AI loop both show it. */

import { el, icon, btn, toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { journalLines, revertEntry } from "../core/ai_door.js";

/** o : { changed() (called after a return to before), title } → the box (hidden while the journal is empty) ; box.draw() reads the journal again. */
export function journalBox(o = {}) {
  const box = el("section", { class: "card ai-journal", "data-ai-journal": "" });
  box.draw = () => {
    const lines = journalLines(store.project); box.hidden = !lines.length; if (!lines.length) { box.replaceChildren(); return; }
    box.replaceChildren(el("h2", null, icon("undo"), o.title || "Journal des réponses d'IA appliquées", el("small", { class: "floor-sub" }, "revenir à avant une réponse, même après d'autres changements")),
      ...lines.map((l) => el("div", { class: "ai-log" }, el("span", { class: "grow" }, el("b", null, l.ask || l.what || "(sans phrase)"), el("small", null, `${new Date(l.when).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })} · ${l.words}${l.ask && l.what ? ` · ${l.what}` : ""}`)),
        btn("Revenir à avant", () => { let r = null; store.commit(`Retour à avant la réponse d'IA « ${(l.ask || l.what || "").slice(0, 40)} »`, (x) => { r = revertEntry(x, l.id); });
          toast(`${r.removed.length} retiré${r.removed.length > 1 ? "s" : ""}, ${r.restored.length} remis comme avant${r.kept.length ? ` ; gardé${r.kept.length > 1 ? "s" : ""} : ${r.kept.map((k) => `${k.id} (${k.why})`).join(", ")}` : ""}. Ctrl + Z défait ce retour.`, "info", 7000); box.draw(); if (o.changed) o.changed(); },
        { small: true, icon: "undo", tip: "Retirer ce que cette réponse a créé, remettre ce qu'elle a modifié ou retiré comme avant — une étape annulable" }))));
  };
  box.draw();
  return box;
}
