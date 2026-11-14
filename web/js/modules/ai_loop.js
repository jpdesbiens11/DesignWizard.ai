/* DesignWizard.ai — the AI round trip, as a dialogue : say what you want done, copy the request with the artefact,
   paste the answer, read the list of changes, apply — or not. The human stays in the loop. */

import { el, btn, badge, toast, modal, copyText, download } from "../core/dom.js";
import { aiBrief, aiRead, aiDiff } from "../core/ai_loop.js";
import { toDwiz } from "../core/dwiz.js";
import { dwizFileName } from "../core/dwiz_names.js";

/** opts : { doc, title, help: [lines], check(newDoc) → [{ severity, text }], apply(newDoc) }. */
export function openAiLoop(opts) {
  const ask = el("textarea", { rows: 3, placeholder: "Ce que vous demanderiez à un technicien : « passe le régulateur à 2 A », « ajoute une mesure de température », « renomme les nets du bus CAN »…", style: { width: "100%" } });
  const answer = el("textarea", { rows: 7, placeholder: "Collez ici la réponse de l'IA (l'artéfact complet, commençant par « dwiz … »).", spellcheck: false, style: { width: "100%", fontFamily: "var(--mono, monospace)", fontSize: ".78rem" } });
  const out = el("div", { class: "ai-diff" }), go = btn("Appliquer les changements", null, { primary: true, icon: "check", disabled: true });
  let next = null;
  const read = () => {
    out.replaceChildren(); next = null; go.disabled = true;
    if (!answer.value.trim()) return;
    try {
      const doc = aiRead(answer.value);
      if (doc.id !== opts.doc.id) out.append(el("p", { class: "atelier-hint warn" }, `La réponse porte le numéro « ${doc.id} » : il est ramené à « ${opts.doc.id} ».`));
      doc.id = opts.doc.id; if (opts.doc.dw && !doc.dw) doc.dw = opts.doc.dw;
      const notes = opts.check ? opts.check(doc) : [], diff = aiDiff(opts.doc, doc);      // check() may complete the answer (a block built again) : the list shows the whole consequence
      out.append(el("p", null, el("b", null, diff.length ? `${diff.length} changement(s)` : "Aucun changement"), " ", ...["added", "changed", "removed"].map((k) => { const n = diff.filter((d) => d.kind === k).length; return n ? badge(`${n} ${{ added: "ajout(s)", changed: "modification(s)", removed: "retrait(s)" }[k]}`, { added: "ok", changed: "warn", removed: "danger" }[k]) : null; })));
      out.append(el("ul", { class: "small" }, diff.slice(0, 60).map((d) => el("li", { class: `ai-${d.kind}` }, d.text)), diff.length > 60 ? el("li", { class: "muted" }, `… et ${diff.length - 60} autres`) : null));
      for (const n of notes) out.append(el("p", { class: `atelier-hint ${n.severity === "error" ? "warn" : ""}` }, n.text));
      if (diff.length && !notes.some((n) => n.severity === "block")) { next = doc; go.disabled = false; }
    } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); }
  };
  answer.addEventListener("input", read);
  const m = modal(opts.title || "Confier à l'IA", el("div", { class: "ai-loop" },
    el("p", { class: "muted small" }, "L'artéfact part en texte lisible (.dwiz) avec votre demande ; rien ne quitte votre poste sans votre geste. Au retour, vous voyez chaque changement avant de l'accepter — une seule étape, annulable."),
    el("h3", null, "1. Votre demande"), ask,
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Copier la demande et l'artéfact", async () => { await copyText(aiBrief(opts.doc, ask.value, opts.help || [])); toast("Copié : collez-le dans votre assistant IA.", "success"); }, { primary: true, icon: "copy" }),
      btn("Télécharger l'artéfact (.dwiz)", () => download(dwizFileName(opts.doc), toDwiz(opts.doc), "text/plain"), { icon: "download" })),
    el("h3", null, "2. La réponse"), answer, out,
    el("div", { class: "form-actions" }, go)), { wide: true });
  go.addEventListener("click", () => { if (!next) return; try { opts.apply(next); toast("Changements appliqués (Ctrl+Z pour revenir en arrière).", "success"); if (m && m.close) m.close(); else document.querySelector(".modal-backdrop")?.remove(); } catch (e) { toast(e.message, "error"); } });
  return m;
}
