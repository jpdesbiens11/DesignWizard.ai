/* DesignWizard.ai — Simulation : the tree of the load case, in the left panel. Supports, loads, heat sources and imposed
   temperatures are listed by type, each with its number and the colour of its type ; a click on an item selects it — it
   lights up on the model and opens its values ; the eye of a type shows or hides its labels in the view. The model of the
   tree is analysis/fea/bc_tree.js ; this module only draws it. */

import { el, btn, icon } from "../core/dom.js";

/** o : { st, tree, regions, dirs, select(id), hover(regionKey | null), changed(), aim(setRegion), add(groupKey), remove(groupKey, index), relabel() } → element */
export function bcSection(o) {
  const { st, tree } = o, box = el("div", { class: "bc-tree", role: "tree", "aria-label": "Cas de charge" });
  const dot = (color) => { const d = el("span", { class: "bc-dot", "aria-hidden": "true" }); d.style.background = color; return d; };
  const num = (value, set, unit) => el("label", { class: "bc-val" }, el("input", { type: "number", value, step: "any", "aria-label": unit, onChange: (e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) { set(x); o.changed(); } } }), el("small", null, unit));
  const pick = (value, opts, set, label) => el("select", { "aria-label": label, onChange: (e) => { set(e.target.value); o.changed(); } }, opts.map(([k, l]) => el("option", { value: k, selected: k === value }, l)));
  /* the values of the selected item, and where it is : by the mouse first, by the list of regions for what is hard to click */
  function editor(g, it) {
    const x = st[g.key][it.index], setRegion = (k) => { if (g.key === "fixed") st.fixed[it.index] = k; else x.region = k; };
    const rows = [el("div", { class: "bc-row" }, btn("Choisir dans la vue", () => o.aim((k) => { setRegion(k); o.changed(); }), { small: true, icon: "fit", tip: "Cliquez la face (ou l'interface) sur le modèle : elle s'allume sous le curseur" }),
      pick(it.region, o.regions.map((r) => [r.key, r.label]), setRegion, "Endroit"))];
    if (g.key === "loads") rows.push(el("div", { class: "bc-row" }, pick(x.mode, [["force", "Force"], ["pressure", "Pression"]], (v) => { x.mode = v; }, "Genre d'effort"),
      ...(x.mode === "force" ? [num(x.F, (v) => { x.F = v; }, "N"), pick(x.dir, Object.keys(o.dirs).map((d) => [d, `vers ${d}`]), (v) => { x.dir = v; }, "Sens")] : [num(x.p, (v) => { x.p = v; }, "MPa")])));
    if (g.key === "power") rows.push(el("div", { class: "bc-row" }, num(x.P, (v) => { x.P = v; }, "W")));
    if (g.key === "fixedT") rows.push(el("div", { class: "bc-row" }, num(x.T, (v) => { x.T = v; }, "°C")));
    const e = el("div", { class: "bc-edit" }, rows); e.style.borderColor = it.color; return e;
  }
  for (const g of tree) {
    const on = st.show[g.key] !== false;
    box.append(el("div", { class: "bc-ghead" }, dot(g.color), el("b", { class: "grow", "data-tip": g.tip }, `${g.fr} (${g.items.length})`),
      el("button", { class: "icon-btn" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", "aria-label": `Étiquettes des ${g.fr.toLowerCase()} dans la vue`, "data-tip": on ? "Étiquettes affichées sur le modèle — cliquer pour les masquer" : "Étiquettes masquées — cliquer pour les afficher", onClick: () => { st.show[g.key] = !on; o.relabel(); } }, icon(on ? "eye" : "eye-off")),
      btn("", () => o.add(g.key), { small: true, icon: "plus", tip: `Ajouter ${g.one} — puis cliquez la face sur le modèle` })));
    if (!g.items.length) box.append(el("p", { class: "bc-none muted small" }, g.key === "fixed" ? "Aucun appui : le produit n'est pas tenu." : "Aucun."));
    for (const it of g.items) {
      const sel = st.sel === it.id, row = el("div", { class: "bc-item" + (sel ? " sel" : ""), role: "treeitem", "aria-selected": sel ? "true" : "false", tabindex: "0", "data-bc": it.id,
        onClick: () => o.select(sel ? null : it.id), onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.select(sel ? null : it.id); } }, onMouseenter: () => o.hover(it.region, it.color), onMouseleave: () => o.hover(null) },
        dot(it.color), el("b", null, it.id), el("span", { class: "bc-text" }, el("span", null, it.text), el("small", null, it.where)),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer ${it.id}`, "data-tip": "Retirer", onClick: (e) => { e.stopPropagation(); o.remove(g.key, it.index); } }, "×"));
      if (sel) row.style.borderColor = it.color;
      box.append(row); if (sel) box.append(editor(g, it));
    }
  }
  return box;
}
