/* DynamiteOrbit — a list drawn as a tree : groups by state or by type, each with its colour dot, its count and — when
   the screen asks for it — an eye that shows or hides what the group puts in the view ; items with their number, their
   few words and a chip. A click selects an item, a second one lets it go ; the selected item may open an editor under it.
   The same look as the trees of the Assembly and of the Simulation (.bc-tree). The models are in core/trees.js. */

import { el, icon, badge } from "../core/dom.js";

/** o : { label (what the tree lists), tree, sel (item id), select(id | null), none (the words of an empty tree), keep [group keys shown even empty],
    attr (the data attribute of a row), shown(key) → is the eye of a group open (no eye without it), toggle(key, on), eye (what the eye shows, a few words),
    hover(item | null), editor(item, group) → an element under the selected item } → element */
export function stateTree(o) {
  const box = el("div", { class: "bc-tree", role: "tree", "aria-label": o.label }), total = o.tree.reduce((n, g) => n + g.items.length, 0), attr = o.attr || "data-tree-row";
  const dot = (color) => { const d = el("span", { class: "bc-dot", "aria-hidden": "true" }); d.style.background = color; return d; };
  if (!total) { box.append(el("p", { class: "bc-none muted small" }, o.none || "Rien à montrer.")); return box; }
  for (const g of o.tree) {
    if (!g.items.length && !(o.keep || []).includes(g.key)) continue;
    const head = el("div", { class: "bc-ghead", "data-tree-group": g.key }, dot(g.color), el("b", { class: "grow", "data-tip": g.tip || null }, `${g.fr} (${g.items.length})`));
    const on = o.shown && g.items.length ? o.shown(g.key) : null;      // null : this group puts nothing in the view, it has no eye
    if (on !== null && on !== undefined) {
      head.append(el("button", { class: "icon-btn" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", "aria-label": `${o.eye || "Dans la vue"} : ${g.fr.toLowerCase()}`, "data-tip": on ? "Affiché dans la vue — cliquer pour masquer" : "Masqué — cliquer pour afficher", onClick: () => o.toggle(g.key, !on) }, icon(on ? "eye" : "eye-off"))); }
    box.append(head);
    for (const it of g.items) {
      const sel = o.sel === it.id, pick = () => o.select(sel ? null : it.id);
      const row = el("div", { class: "bc-item" + (sel ? " sel" : ""), role: "treeitem", "aria-selected": sel ? "true" : "false", tabindex: "0", [attr]: String(it.id), onClick: pick, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } } }, dot(it.color || g.color));
      if (it.n !== undefined && it.n !== null) row.append(el("b", null, String(it.n)));
      const text = el("span", { class: "bc-text" }, el("span", null, it.text)); if (it.sub) text.append(el("small", null, it.sub)); row.append(text);
      if (it.chip) row.append(badge(it.chip.text, it.chip.tone));
      if (o.hover) { row.addEventListener("mouseenter", () => o.hover(it)); row.addEventListener("mouseleave", () => o.hover(null)); }
      if (sel) row.style.borderColor = it.color || g.color;
      box.append(row);
      if (sel && o.editor) { const e = o.editor(it, g); if (e) box.append(e); }
    }
  }
  return box;
}
