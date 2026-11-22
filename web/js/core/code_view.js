/* DynamiteOrbit — the preview / code switch of the top bar, as in a chat with Claude : one click and the screen gives way
   to the code of what it shows — FeatureScript and .dwiz — ready to copy for Onshape or for an AI ; one click back and the
   screen is there again, untouched. Alt + C switches ; Escape comes back. */

import { el, btn, icon, toast, copyText, download } from "./dom.js";
import { store } from "./store.js";
import { elementFor, codeSources, aiCodePrompt } from "./code_sources.js";

/** Builds the switch. app : the application state (its context says what the screen is editing). → the node to put in the top bar. */
export function mountCodeSwitch(app) {
  let panel = null, tab = "", off = null;
  const bPrev = el("button", { class: "seg-btn on", type: "button", "aria-pressed": "true", "aria-label": "Aperçu", "data-tip": "Aperçu : l'écran lui-même", onClick: () => set(false) }, icon("eye"));
  const bCode = el("button", { class: "seg-btn", type: "button", "aria-pressed": "false", "aria-label": "Code", "data-tip": "Code : le FeatureScript (définition Onshape) et le .dwiz de ce que montre l'écran — Alt + C", onClick: () => set(true) }, icon("code"));
  function draw() {
    if (!panel) return;
    if (!store.project) { panel.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Aucun projet ouvert"), el("p", null, "Ouvrez un projet : son code s'affichera ici."))); return; }
    const e = elementFor(store.project, location.hash, app.context || {}), sources = codeSources(store.project, e), src = sources.find((s) => s.key === tab) || sources[0]; tab = src.key;
    const copy = async (text, ok) => toast((await copyText(text)) ? ok : "Copie impossible.", "success", 5000);
    panel.replaceChildren(el("div", { class: "code-head" }, el("div", { class: "grow" }, el("b", null, e.label), el("small", { class: "muted" }, ` — ${src.text.split("\n").length} lignes`)),
      el("div", { class: "subtabs", style: { margin: 0, border: 0 } }, sources.map((s) => el("button", { class: "subtab" + (s.key === tab ? " active" : ""), type: "button", onClick: () => { tab = s.key; draw(); } }, s.label))),
      btn("Copier", () => copy(src.text, `${src.label} copié.`), { small: true, icon: "copy", tip: src.key === "fs" ? "Pour un Feature Studio d'Onshape" : "Le texte tel quel" }),
      btn("Copier pour une IA", () => copy(aiCodePrompt(store.project, e, src), "Copié avec sa consigne : l'entrevue à mener, et la réponse attendue pour revenir dans DynamiteOrbit."), { small: true, icon: "sparkle", primary: true, tip: "Le code précédé d'une consigne courte : comment mener l'entrevue, et sous quelle forme répondre" }),
      btn("", () => download(src.file, src.text, "text/plain;charset=utf-8"), { small: true, icon: "download", tip: `Télécharger ${src.file}` })),
      el("ul", { class: "code-notes" }, src.notes.map((n) => el("li", null, n))), el("pre", { class: "code-text", tabindex: "0" }, src.text));
  }
  function set(on) {
    if (on === !!panel) return;
    bPrev.classList.toggle("on", !on); bCode.classList.toggle("on", on); bPrev.setAttribute("aria-pressed", String(!on)); bCode.setAttribute("aria-pressed", String(on));
    if (on) { panel = el("div", { class: "code-view", role: "region", "aria-label": "Code de l'élément affiché" }); document.body.append(panel); off = store.on("change", draw); draw(); }
    else { panel.remove(); panel = null; if (off) off(); off = null; }
  }
  window.addEventListener("hashchange", () => setTimeout(draw, 60));       // the new screen first says what it shows
  document.addEventListener("keydown", (e) => { if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "c") { e.preventDefault(); set(!panel); } else if (e.key === "Escape" && panel && !document.querySelector(".modal-backdrop")) set(false); });
  return el("div", { class: "seg", role: "group", "aria-label": "Aperçu ou code" }, bPrev, bCode);
}
