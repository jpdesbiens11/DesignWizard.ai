/* DesignWizard.ai — Simulation : the load cases of the model, under their names (demande de JP : « plusieurs cas de charge nommés
   par pièce »). One group of the left panel, above the conditions : each case one line — its mark, its name, what it holds — and
   the one in use marked. A click brings a case in use ; the one that is left waits as it was. The « + » makes a new case, a copy
   of the one in use under another name : service, transport, drop… The convention is the list of load cases — or studies — of
   calculation tools : one is active, a new one starts from a copy, a result belongs to the case that ran. The model is
   analysis/fea/case_store.js ; the screen (modules/fea.js) writes each change as one undoable step. */

import { el, btn, icon } from "../core/dom.js";

const COLOR = "#7c3aed";      // the colour of the cases, on their mark — none of the colours of the conditions

/** The group « Cas de charge ». o : { list: [{ name, on, note }], use(name), add(), rename(name), drop(name) } → the section */
export function casesSection(o) {
  const list = o.list, now = list.find((x) => x.on) || list[0], many = list.length > 1;
  const sec = el("div", { class: "side-section", "data-fold-note": `${list.length} · en cours : ${now.name}` },
    el("h3", null, el("span", { class: "grow" }, `Cas de charge (${list.length})`), btn("", () => o.add(), { small: true, icon: "plus", tip: "Nouveau cas : une copie du cas en cours sous un autre nom — changez-y un effort, un appui ou le maillage, et comparez" })));
  for (const x of list) {
    sec.append(el("div", { class: "nav-item variant case" + (x.on ? " active" : ""), role: "button", tabindex: "0", "data-case": x.name, "aria-current": x.on ? "true" : null,
      "data-tip": x.on ? `${x.name} — le cas en cours : ce que vous changez va dans ce cas` : `${x.name} — passer à ce cas (${x.note || "rien de posé"}) ; le cas en cours est gardé tel qu'il est`,
      onClick: () => { if (!x.on) o.use(x.name); }, onKeydown: (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.currentTarget.click(); } } },
      mark(x.on), el("span", { class: "grow bc-text" }, el("span", null, x.name), el("small", null, x.on ? `en cours${x.note ? ` · ${x.note}` : ""}` : x.note || "rien de posé")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `Renommer le cas ${x.name}`, "data-tip": "Renommer ce cas", style: { fontSize: ".95rem" }, onClick: (e) => { e.stopPropagation(); o.rename(x.name); } }, icon("edit")),
      el("button", { class: "icon-btn", type: "button", "aria-label": `${many ? "Retirer" : "Vider"} le cas ${x.name}`, "data-tip": many ? "Retirer ce cas — les autres ne changent pas" : "Vider ce cas : un modèle garde toujours un cas", onClick: (e) => { e.stopPropagation(); o.drop(x.name); } }, "×")));
  }
  sec.append(el("p", { class: "muted small" }, many ? "Un clic passe à un cas ; celui que l'on quitte est gardé tel qu'il est. Chaque essai dit de quel cas il vient : ils se comparent dans « Les essais de cette séance »."
    : "Un seul cas pour l'instant. Le « + » en fait une copie sous un autre nom — service, transport, chute… — sans rien changer à l'écran : le cas d'origine est gardé."));
  return sec;
}
/* the mark of a case : a part on its support and the effort that pushes on it, filled for the one in use */
function mark(on) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"), add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); s.append(n); };
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.setAttribute("aria-hidden", "true"); s.style.flex = "none";
  add("rect", { x: 4, y: 13, width: 16, height: 6, rx: 1.5, fill: on ? COLOR : "none", "fill-opacity": ".35", stroke: COLOR, "stroke-width": 1.7 });
  add("path", { d: "M12 3v7M8.8 7.2 12 10.4l3.2-3.2", fill: "none", stroke: COLOR, "stroke-width": 1.9, "stroke-linecap": "round", "stroke-linejoin": "round" });
  add("path", { d: "M5 21.5h14", fill: "none", stroke: COLOR, "stroke-width": 1.5, "stroke-linecap": "round", "stroke-dasharray": "2 2.2" });
  return s;
}
