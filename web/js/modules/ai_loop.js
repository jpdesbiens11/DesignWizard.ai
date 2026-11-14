/* DesignWizard.ai — the AI round trip, as a dialogue : say what you want done, copy the request with the artefact,
   paste the answer, read the list of changes, apply — or not. The human stays in the loop. */

import { el, btn, badge, toast, modal, copyText, download } from "../core/dom.js";
import { aiBrief, aiRead, aiDiff } from "../core/ai_loop.js";
import { toDwiz } from "../core/dwiz.js";
import { dwizFileName } from "../core/dwiz_names.js";
import { store } from "../core/store.js";
import { validateSpec } from "../cad/build.js";

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

const replace = (target, doc) => { for (const k of Object.keys(target)) if (k !== "id") delete target[k]; Object.assign(target, doc, { id: target.id }); };
/** The round trip for whatever the current screen shows : a board, a part, an assembly — otherwise the whole project. */
export async function openCurrentAiLoop() {
  if (!store.project) { toast("Ouvrez d'abord un projet.", "info"); return null; }
  const [key, id] = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent), board = key === "pcba" ? store.board(id) || store.boards[0] : null, part = id ? store.part(id) : null, asm = id ? store.assembly(id) : null;
  if (board) { const { boardAiHelp, boardAiCheck } = await import("./pcba_out.js"); return openAiLoop({ doc: board, title: `Confier la carte ${board.id} à l'IA`, help: boardAiHelp(), check: (d) => boardAiCheck(board, d), apply: (d) => store.updateBoard(board.id, (b) => replace(b, d), `Carte ${board.id} mise à jour par l'IA`) }); }
  if (part) return openAiLoop({ doc: part, title: `Confier la pièce ${part.id} à l'IA`, help: ["Garde les « key » des interfaces : elles lient la pièce à ses voisines.", "Une cote s'écrit par un paramètre (param) plutôt que par un nombre répété."],
    check: (d) => { const v = validateSpec(d); return [...v.errors.map((t) => ({ severity: "block", text: t })), ...v.warnings.map((t) => ({ severity: "warn", text: t }))]; }, apply: (d) => store.updatePart(part.id, (s) => replace(s, d), `Pièce ${part.id} mise à jour par l'IA`) });
  if (asm) return openAiLoop({ doc: asm, title: `Confier l'assemblage ${asm.id} à l'IA`, help: ["Une ligne « place » par pièce posée ; une ligne « mate » par paire d'interfaces accouplées. Ne cite que des pièces du projet."],
    check: (d) => (d.instances || []).filter((i) => !store.part(i.part)).map((i) => ({ severity: "block", text: `La pièce « ${i.part} » n'existe pas dans le projet.` })), apply: (d) => store.updateAssembly(asm.id, (a) => replace(a, d), `Assemblage ${asm.id} mis à jour par l'IA`) });
  const light = JSON.parse(JSON.stringify(store.project)); for (const p of light.parts || []) if (p.step) p.step = "(géométrie STEP importée, non modifiable)";
  return openAiLoop({ doc: light, title: "Confier le projet à l'IA", help: ["Le projet porte ses pièces, ses assemblages et ses cartes à la suite, chacun commençant par sa ligne « dwiz … »."],
    check: () => [{ severity: "block", text: "Pour modifier, ouvrez la pièce, l'assemblage ou la carte concernés : l'aller-retour s'y applique document par document." }], apply: () => {} });
}
