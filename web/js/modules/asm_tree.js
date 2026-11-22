/* DynamiteOrbit — Assembly : the tree of the mates in the left panel, by health. A click on a mate selects it — its two
   parts light up, its label shows, its card opens on the right ; the eye of a state shows or hides its labels in the view.
   The model of the tree is core/asm_tree.js ; this module only draws it, with the look of the load-case tree. */

import { el, icon } from "../core/dom.js";
import { mateShown } from "../core/asm_tree.js";

/** o : { tree, sel (mate id), show, select(id | null), hover(item | null), relabel(key, on) } → element */
export function mateSection(o) {
  const box = el("div", { class: "bc-tree", role: "tree", "aria-label": "Accouplements, par état" }), total = o.tree.reduce((n, g) => n + g.items.length, 0);
  const dot = (color) => { const d = el("span", { class: "bc-dot", "aria-hidden": "true" }); d.style.background = color; return d; };
  if (!total) { box.append(el("p", { class: "bc-none muted small" }, "Aucun accouplement : « Mates » à droite propose ceux que les clés d'interface permettent.")); return box; }
  for (const g of o.tree) {
    if (!g.items.length && g.key !== "broken") continue;      // « rompus (0) » is good news worth a line ; an empty « à vérifier » is not
    const on = mateShown(o.show, g.key);
    box.append(el("div", { class: "bc-ghead" }, dot(g.color), el("b", { class: "grow", "data-tip": g.tip }, `${g.fr} (${g.items.length})`),
      ...(g.items.length ? [el("button", { class: "icon-btn" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", "aria-label": `Étiquettes des accouplements ${g.fr.toLowerCase()} dans la vue`, "data-tip": on ? "Étiquettes affichées sur le modèle — cliquer pour les masquer" : "Étiquettes masquées — cliquer pour les afficher", onClick: () => o.relabel(g.key, !on) }, icon(on ? "eye" : "eye-off"))] : [])));
    for (const it of g.items) {
      const sel = o.sel === it.id, row = el("div", { class: "bc-item" + (sel ? " sel" : ""), role: "treeitem", "aria-selected": sel ? "true" : "false", tabindex: "0", "data-mate-row": it.id,
        onClick: () => o.select(sel ? null : it.id), onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.select(sel ? null : it.id); } }, onMouseenter: () => o.hover(it), onMouseleave: () => o.hover(null) },
        dot(it.color), el("b", null, it.id), el("span", { class: "bc-text" }, el("span", null, it.text), el("small", null, it.notes.length ? it.notes[0] : `${it.where}${it.linked ? "" : " · délié"}`)));
      if (sel) row.style.borderColor = it.color;
      box.append(row);
    }
  }
  return box;
}
