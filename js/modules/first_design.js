/* DynamiteOrbit.ai — « Premier design avec une IA » : the dialogue. The engineer writes a detailed description, copies
   the interview prompt, runs the interview in the assistant of their choice, and pastes back the file it gives.
   The preview says what the file holds and what was refused ; nothing is created before « Créer le projet ». */

import { el, btn, badge, toast, modal, copyText, download, field } from "../core/dom.js";
import { go } from "../core/app.js";
import { store } from "../core/store.js";
import { firstDesignPrompt, readFirstDesign } from "../core/first_design.js";
import { REVIEW_KINDS } from "../core/review.js";

const HINT = "Plus la description est précise, plus l'entrevue est courte. Dites : ce que fait le produit ; où il vit (températures, eau, poussière) ; son énergie et ses tensions ; les pièces que vous imaginez et ce qui est acheté ; les dimensions connues ; les efforts ; la quantité visée.";

export function openFirstDesign(seed = {}) {
  const name = el("input", { type: "text", value: seed.name || "", placeholder: "Ex. : Module de mesure de température" });
  const desc = el("textarea", { rows: 8, placeholder: "Décrivez le produit comme vous le feriez à un collègue qui arrive sur le projet…", style: { width: "100%" } }, seed.description || "");
  const answer = el("textarea", { rows: 6, spellcheck: false, placeholder: "Collez ici le fichier rendu par l'assistant à la fin de l'entrevue (l'objet JSON complet), ou déposez-le avec « Choisir un fichier ».", style: { width: "100%", fontFamily: "var(--mono, monospace)", fontSize: ".78rem" } });
  const out = el("div", { class: "fd-preview" }), create = btn("Créer le projet", null, { primary: true, icon: "check", disabled: true });
  let read = null;
  const show = () => {
    out.replaceChildren(); read = null; create.disabled = true;
    if (!answer.value.trim()) return;
    try { read = readFirstDesign(answer.value, { description: desc.value, name: name.value.trim() }); } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); return; }
    const c = read.counts, b = read.project.brief;
    out.append(el("h3", null, `Aperçu — « ${read.project.name} »`), el("div", { class: "atelier-chips" },
      el("span", { class: "chip done" }, `${c.parts} pièce(s)`), el("span", { class: "chip" }, `${c.assemblies} assemblage(s)`), el("span", { class: "chip" }, `${c.boards} carte(s)`), el("span", { class: "chip" }, `${c.physics} analyse(s) calculée(s) ici`),
      el("span", { class: "chip", "data-tip": read.outside.join(" · ") || null }, `${c.pairs} interface(s) accouplée(s), ${c.outside} vers l'extérieur`), c.refused ? el("span", { class: "chip bad" }, `${c.refused} refusé(s)`) : null));
    out.append(el("table", { class: "table small" }, el("thead", null, el("tr", null, ["Genre", "Repère", "Nom", "Ce que l'outil y lit", "À voir"].map((h) => el("th", null, h)))),
      el("tbody", null, read.items.map((it) => el("tr", null, el("td", null, REVIEW_KINDS[it.kind]), el("td", null, el("code", null, it.id)), el("td", null, it.name), el("td", null, it.facts),
        el("td", null, ...it.problems.map((t) => el("div", { class: "form-error", style: { margin: 0 } }, t)), ...it.notes.slice(0, 3).map((t) => el("div", { class: "muted" }, t)), !it.problems.length && !it.notes.length ? badge("Brouillon IA", "warn") : null))))));
    for (const r of read.refused) out.append(el("p", { class: "form-error" }, `${REVIEW_KINDS[r.kind]} « ${r.id} » refusée — ${r.why}`));
    if (read.fix) out.append(el("p", { class: "atelier-hint warn" }, el("span", { class: "grow" }, "Des éléments ont été refusés ou signalés. Vous pouvez créer le projet avec le reste, ou renvoyer la demande de correction à l'assistant."),
      btn("Copier la demande de correction", async () => { await copyText(read.fix); toast("Copié : collez-le dans la même conversation.", "success"); }, { small: true, icon: "copy" })));
    if (b.assumptions.length || b.open.length) out.append(el("p", { class: "atelier-hint" }, `${b.assumptions.length} hypothèse(s) et ${b.open.length} question(s) ouverte(s) de l'assistant vous attendent dans la revue.`));
    out.append(el("p", { class: "muted small" }, "Tout arrive en « Brouillon IA » : chaque pièce est construite et vérifiée à l'ouverture de la revue, les analyses sont calculées par l'outil (jamais reprises de la réponse), et rien n'est tenu pour revu avant que vous l'ayez dit."));
    create.disabled = !read.project.parts.length;
  };
  answer.addEventListener("input", show);
  const pick = () => { const input = el("input", { type: "file", accept: ".json,.dwiz,.txt,.md" }); input.addEventListener("change", async () => { if (input.files[0]) { answer.value = await input.files[0].text(); show(); } }); input.click(); };
  const m = modal("Premier design avec une IA", el("div", { class: "ai-loop" },
    el("p", { class: "muted small" }, "Le même geste que le Project Starter de DynamiteAgile : vous copiez le prompt, l'assistant de votre choix mène l'entrevue — une question à la fois, des réponses à cliquer — puis rend un fichier. L'outil le relit, construit, calcule, et vous présente le tout à passer en revue. Rien ne quitte votre poste sans votre geste."),
    el("h3", null, "1. Décrivez le produit"), el("div", { class: "form-row" }, field("Nom du produit", name)), desc, el("p", { class: "muted small" }, HINT),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
      btn("Copier le prompt d'entrevue", async () => { await copyText(firstDesignPrompt({ description: desc.value, name: name.value.trim() })); toast("Prompt copié : collez-le dans votre assistant IA et répondez à ses questions.", "success", 6000); }, { primary: true, icon: "copy" }),
      btn("Télécharger le prompt (.md)", () => download("premier_design_prompt.md", firstDesignPrompt({ description: desc.value, name: name.value.trim() }), "text/markdown"), { icon: "download" }),
      btn("Voir un exemple", async () => { const d = await import("../demo/demo_first_design.js"); if (!desc.value.trim()) desc.value = d.FIRST_DESIGN_DESCRIPTION; if (!name.value.trim()) name.value = "Module de température CAN"; answer.value = d.FIRST_DESIGN_ANSWER; show(); toast("Exemple chargé : la description d'un module de température, et le fichier qu'un assistant rend après l'entrevue.", "info", 6000); }, { icon: "sparkle", tip: "Remplit la description et la réponse avec un exemple complet : boîtier moulé, couvercle, platine, carte, analyses" })),
    el("h3", null, "2. Chargez le fichier rendu par l'assistant"), answer,
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Choisir un fichier…", pick, { icon: "upload" })), out,
    el("div", { class: "form-actions" }, create)), { wide: true, xl: true });
  create.addEventListener("click", async () => {
    if (!read) return;
    const p = await store.create(read.project.name, read.project);
    m.close(); toast(`Projet « ${p.name} » créé : ${read.counts.parts} pièce(s) en brouillon, à passer en revue.`, "success", 6000); go("#/review");
  });
  return { ...m, name, desc, answer };
}
