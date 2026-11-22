/* DynamiteOrbit — Aide : where the tools take their methods, conventions and standards from. Grouped by nature, a colour
   and a pictogram per group ; each line is closed until it is clicked, then says what the reference covers, what the tool
   takes from it and how it was checked. The words come from core/methods.js. Route : #/help/sources[/<group or id>]. */

import { el, icon } from "../core/dom.js";
import { METHOD_GROUPS, METHOD_KINDS, METHOD_HOW, METHODS, methodsByGroup, methodCounts } from "../core/methods.js";

const REPO = "https://github.com/jpdesbiens11/DynamiteOrbit.ai";
const howBadge = (how) => { const h = METHOD_HOW[how] || METHOD_HOW.none; return el("span", { class: `badge badge-${h.tone} src-how`, "data-tip": h.text }, h.label); };

function item(m, open) {
  const kind = METHOD_KINDS[m.kind] || METHOD_KINDS.method, line = (label, text) => (text ? el("p", null, el("b", null, `${label} : `), text) : null);
  return el("details", { class: "src-item", "data-method": m.id, "data-how": m.how, open: open ? "" : null },
    el("summary", null, icon(kind.icon), el("span", { class: "src-kind" }, kind.label), el("b", null, m.name), el("span", { class: "src-title" }, m.title), howBadge(m.how)),
    el("div", { class: "src-body" }, ...[line("Ce qu'elle couvre", m.covers), line("Ce que l'outil en prend", m.uses), line("Vérification", m.check)].filter(Boolean),
      el("p", { class: "src-links" }, ...[m.where ? el("a", { href: m.where }, icon("chevron-right"), m.tool || "Ouvrir l'outil") : null,
        m.doc ? el("a", { href: `${REPO}/blob/main/${m.doc}`, target: "_blank", rel: "noopener noreferrer" }, icon("external"), m.doc) : null].filter(Boolean))));
}

/** The card of the sources. focus : a group id or a method id (from the route) — its group is shown, the method opened. */
export function sourcesCard(focus = "") {
  const counts = methodCounts(), target = METHODS.find((m) => m.id === focus), host = el("div"), bar = el("div", { class: "src-filters", role: "group", "aria-label": "Filtrer par vérification" });
  let how = "all";
  const draw = () => {
    bar.replaceChildren(...[["all", "Tout", METHODS.length], ...Object.entries(METHOD_HOW).filter(([k]) => counts[k]).map(([k, h]) => [k, h.label, counts[k]])].map(([k, label, n]) =>
      el("button", { class: `chip-btn${how === k ? " on" : ""}`, type: "button", "data-how": k, "aria-pressed": how === k ? "true" : "false", "data-tip": k === "all" ? "Toutes les références" : METHOD_HOW[k].text, onClick: () => { how = k; draw(); } }, `${label} `, el("small", null, String(n)))));
    host.replaceChildren(...methodsByGroup().map((g) => { const list = g.methods.filter((m) => how === "all" || m.how === how);
      return list.length ? el("section", { class: "src-group", style: `--dom:${g.color}`, "data-group": g.id, id: `src-${g.id}` },
        el("header", { class: "src-group-head" }, icon(g.icon), el("div", { class: "grow" }, el("b", null, g.label), el("small", null, g.hint)), el("span", { class: "src-count" }, String(list.length))),
        list.map((m) => item(m, target && target.id === m.id))) : null; }).filter(Boolean));
  };
  draw();
  const card = el("section", { class: "card src-card", id: "sources", style: { marginBottom: "1rem" } }, el("h2", null, "Sources des méthodes, conventions et normes"),
    el("p", { class: "muted" }, "Chaque outil s'appuie sur une norme, un manuel, un guide ou une convention. Un clic sur une ligne dit ce que la référence couvre, ce que l'outil en prend et comment elle a été vérifiée. La norme, ou la fiche du fabricant, fait toujours foi : la plateforme aide à concevoir, elle ne certifie pas."),
    bar, host);
  const group = target ? target.group : METHOD_GROUPS.some((g) => g.id === focus) ? focus : "";
  if (focus) setTimeout(() => { const node = (target && card.querySelector(`[data-method="${target.id}"]`)) || (group && card.querySelector(`[data-group="${group}"]`)) || card; if (node.scrollIntoView) node.scrollIntoView({ block: "start" }); }, 0);
  return card;
}
