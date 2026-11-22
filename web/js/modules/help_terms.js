/* DesignOrbit.ai — Aide : the glossary. The screens name every technical term as the trade names it, in English ; here
   each one has its French equivalent, grouped by nature with a colour and a pictogram, and a box to look one up in either
   language. The words come from core/terms.js. Route : #/help/terms. */

import { el, icon } from "../core/dom.js";
import { glossary, glossaryByGroup } from "../core/terms.js";

export function glossaryCard(open = false) {
  const host = el("div"), count = el("small", { class: "muted" }), find = el("input", { type: "search", placeholder: "Chercher un terme, en anglais ou en français : riser, tiroir, draft…", "aria-label": "Chercher un terme", "data-terms-find": "", style: { width: "100%", margin: ".4rem 0 .7rem" } });
  const draw = () => { const groups = glossaryByGroup(find.value), n = groups.reduce((s, g) => s + g.terms.length, 0);
    count.textContent = `${n} terme${n > 1 ? "s" : ""}${find.value.trim() ? ` sur ${glossary().length}` : ""}`;
    host.replaceChildren(...(groups.length ? groups.map((g) => el("details", { class: "src-group term-group", style: `--dom:${g.color}`, "data-term-group": g.id, open: open || find.value.trim() ? "" : null },
      el("summary", { class: "src-group-head" }, icon(g.icon), el("div", { class: "grow" }, el("b", null, g.label), el("small", null, g.hint)), el("span", { class: "src-count" }, String(g.terms.length))),
      el("table", { class: "data term-table" }, el("thead", null, el("tr", null, el("th", null, "Terme (anglais)"), el("th", null, "En français"), el("th", null, ""))), el("tbody", null, g.terms.map((t) => el("tr", { "data-term": t.en }, el("td", null, el("b", null, t.en)), el("td", null, t.fr), el("td", { class: "muted small" }, t.note))))))) : [el("p", { class: "muted" }, "Aucun terme ne correspond.")])); };
  find.addEventListener("input", draw); draw();
  return el("section", { class: "card", style: { marginBottom: "1rem" }, id: "glossaire" }, el("h2", null, "Glossaire — les termes techniques, anglais et français"),
    el("p", { class: "muted" }, "La plateforme nomme chaque terme technique comme le métier le nomme, en anglais : un procédé, une opération, une interface, le vocabulaire du mold. L'explication autour reste en français. Voici l'équivalent de chacun. ", count), find, host);
}
