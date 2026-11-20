/* DesignWizard.ai — Aide : the words of a battery system, with the published document behind each (core/battery_terms.js).
   Grouped by nature — what stores, what watches and cuts, the whole — each group with its colour and its pictogram ; then
   the words of a house, with what was found about each ; then what public documents say about the buses. Nothing is
   decided here. Route : #/help/batteries. */

import { el, icon, badge } from "../core/dom.js";
import { BATTERY_GROUPS, BATTERY_READ, HOUSE_WORDS, BATTERY_BUSES, BATTERY_TERMS, batteryGlossary } from "../core/battery_terms.js";

const TONE = { read: "ok", preview: "warn", abstract: "warn", unread: "neutral" };
export function batteryCard(open = false) {
  const all = batteryGlossary();
  const src = (s) => el("li", null, s.url ? el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name) : s.name, ` — ${s.where} `, badge(BATTERY_READ[s.read].label, TONE[s.read]));
  const group = (g) => { const terms = all.filter((t) => BATTERY_TERMS[t.key].group === g.id);
    return el("details", { class: "src-group term-group", style: `--dom:${g.color}`, "data-battery-group": g.id, open: open ? "" : null }, el("summary", { class: "src-group-head" }, icon(g.icon), el("div", { class: "grow" }, el("b", null, g.label), el("small", null, g.hint)), el("span", { class: "src-count" }, String(terms.length))),
      el("table", { class: "data term-table" }, el("thead", null, el("tr", null, el("th", null, "Terme (anglais)"), el("th", null, "En français"), el("th", null, "Ce que c'est, et qui le définit"))),
        el("tbody", null, terms.map((t) => el("tr", { "data-battery-term": t.key }, el("td", null, el("b", null, t.label)), el("td", null, t.fr), el("td", null, t.text, el("ul", { class: "small", style: { margin: ".3rem 0 0", paddingLeft: "1.1rem" } }, t.sources.map(src))))))));
  };
  const card = el("section", { class: "card battery-card", style: { marginBottom: "1rem" }, id: "batteries" }, el("h2", null, "Vocabulaire des systèmes de batteries — ce que les normes publient"),
    el("p", { class: "muted" }, "L'outil écrit le terme établi par une norme ou par une autorité ; un mot de maison reste ici, avec ce qui a été trouvé. Chaque ligne dit quel document publié la porte, et comment il a été lu."),
    ...BATTERY_GROUPS.map(group),
    el("details", { class: "src-group term-group", style: "--dom:#8a7df0", "data-battery-group": "house", open: open ? "" : null }, el("summary", { class: "src-group-head" }, icon("edit"), el("div", { class: "grow" }, el("b", null, "Mots de maison"), el("small", null, "des sigles courants qu'aucune norme lue ne porte, ou qui en portent deux sens")), el("span", { class: "src-count" }, String(HOUSE_WORDS.length))),
      el("table", { class: "data term-table" }, el("thead", null, el("tr", null, el("th", null, "Sigle"), el("th", null, "Ce qui a été trouvé"), el("th", null, "L'outil écrit"))), el("tbody", null, HOUSE_WORDS.map((w) => el("tr", { "data-house-word": w.word }, el("td", null, el("b", null, w.word), w.said ? el("small", { class: "muted", style: { display: "block" } }, w.said) : null), el("td", null, w.found), el("td", null, w.use ? BATTERY_TERMS[w.use].label : badge("par sa fonction", "neutral"))))))),
    el("details", { class: "src-group term-group", style: "--dom:#0891b2", "data-battery-group": "bus", open: open ? "" : null }, el("summary", { class: "src-group-head" }, icon("cloud"), el("div", { class: "grow" }, el("b", null, "Quel bus, dans une batterie d'aéronef ?"), el("small", null, "ce que les documents publics disent — et ne disent pas")), el("span", { class: "src-count" }, String(BATTERY_BUSES.length))),
      el("ul", { style: { paddingLeft: "1.1rem" } }, BATTERY_BUSES.map((t) => el("li", null, t)))),
    el("p", { class: "muted small" }, Object.values(BATTERY_READ).map((r) => `« ${r.label} » : ${r.text}`).join(" ")));
  return card;
}
