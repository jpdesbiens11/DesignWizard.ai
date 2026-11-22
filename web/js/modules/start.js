/* DynamiteOrbit — Premiers pas : the eight steps of a newcomer, grouped by what one does (begin, design, check, deliver),
   each group in its colour, each step with its pictogram, its few words and its state — read off the project, never
   declared. The next step is open, with how to do it ; « Y aller » opens its screen. Route : #/start. */

import { el, icon, btn, badge } from "../core/dom.js";
import { registerModule, go, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { firstSteps, firstStepsLine } from "../core/first_steps.js";

let open = null;      // the step the reader unfolded ; the next one is unfolded by itself

function render(main) {
  const page = el("div", { class: "page" }), F = firstSteps(store.project); main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Premiers pas"),
    el("p", { class: "muted" }, "De la page blanche à la révision libérée, en huit étapes. Rien à cocher : une étape est faite quand le projet le montre — une pièce existe, un assemblage tient, un calcul est gardé.")),
    F.next ? btn(`Continuer : ${F.next.title}`, () => go(F.next.hash), { primary: true, icon: "play" }) : badge("Tout est fait", "ok")));
  const bar = el("div", { class: "fs-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(F.total), "aria-valuenow": String(F.done), "aria-label": firstStepsLine(F) }, F.steps.map((s) => { const d = el("span", { class: "fs-tick" + (s.done ? " done" : s.next ? " next" : ""), "data-tip": `${s.n}. ${s.title}` }); d.style.setProperty("--dom", s.color); return d; }));
  page.append(bar, el("p", { class: "muted small", "data-first-line": "" }, `${firstStepsLine(F)}.`));
  for (const g of F.groups) {
    const sec = el("section", { class: "src-group", "data-step-group": g.id }); sec.style.setProperty("--dom", g.color);
    sec.append(el("header", { class: "src-group-head" }, icon(g.icon), el("span", { class: "grow" }, el("b", null, g.label), el("small", null, g.hint)), el("span", { class: "src-count" }, `${g.steps.filter((s) => s.done).length} / ${g.steps.length}`)));
    const grid = el("div", { class: "fs-steps" });
    for (const s of g.steps) {
      const shown = open ? open === s.id : s.next, card = el("article", { class: "fs-step" + (s.done ? " done" : s.next ? " next" : ""), "data-step": s.id, "data-done": s.done ? "1" : "0" });
      card.style.setProperty("--dom", s.color);
      card.append(el("button", { class: "fs-head", type: "button", "aria-expanded": shown ? "true" : "false", onClick: () => { open = shown ? "none" : s.id; main.replaceChildren(); render(main); } },
        el("span", { class: "fs-pic", "aria-hidden": "true" }, icon(s.icon)), el("span", { class: "fs-text" }, el("b", null, `${s.n}. ${s.title}`), el("small", null, s.what)),
        s.done ? badge("fait", "ok") : s.next ? badge("à faire maintenant", "info") : badge("ensuite", "neutral")));
      if (shown) card.append(el("div", { class: "fs-how" }, el("ul", null, s.how.map((h) => el("li", null, h))), el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Y aller", () => go(s.hash), { small: true, primary: !s.done, icon: "play" }))));
      grid.append(card);
    }
    sec.append(grid); page.append(sec);
  }
  page.append(el("p", { class: "muted small" }, "Sur chaque écran, le bouton « Guide » de la barre du haut rappelle l'étape en cours et dit ce qui manque ou cloche. L'aide complète — raccourcis, sources des méthodes, glossaire — est dans ", el("a", { href: "#/help" }, "Aide"), "."));
  setGuide(F.next ? [{ level: "tip", text: `Premiers pas — ${firstStepsLine(F)}.`, hash: F.next.hash }] : []);
}

registerModule({ key: "start", label: "Premiers pas", icon: "sparkle", hidden: true, tip: "Les huit étapes, de la page blanche à la révision libérée", render });
