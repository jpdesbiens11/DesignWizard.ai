/* DynamiteOrbit.ai — Simulation : the tree of the load case, in the left panel. Supports, loads, heat sources and imposed
   temperatures are listed by type, each with its number and the colour of its type ; a click on an item selects it — it
   lights up on the model and opens its values ; the eye of a type shows or hides its labels in the view. The model of the
   tree is analysis/fea/bc_tree.js ; this module only draws it. Each type folds on a click on its title (core/fold.js) : what
   is not being worked on steps aside ; the type of the selected item is always open. */

import { el, btn, icon, onOff } from "../core/dom.js";
import { needField } from "../core/guide.js";
import { isFolded, fold } from "../core/fold.js";
import { AXIS_DIRS, loadDir, supportKey, supportDofs, isOff } from "../analysis/fea/bc_tree.js";

/** o : { st, tree, regions, dirs, select(id), hover(regionKey | null), changed(), aim(setRegion), add(groupKey), remove(groupKey, index), relabel(),
    toggle(groupKey, index, alone) (On / Off ; alone : this one on, the others of its type off), copy(groupKey, index) (a copy, off, to change and compare),
    unsym(item) (the designer tries to remove the boundary a symmetry blocks : the screen explains and offers to remove the symmetry) } → element
    A value the tool invented (item.ask) blinks in the editor of its item until the designer types his own or confirms it. */
export function bcSection(o) {
  const { st, tree } = o, box = el("div", { class: "bc-tree", role: "tree", "aria-label": "Cas de charge" });
  const dot = (color) => { const d = el("span", { class: "bc-dot", "aria-hidden": "true" }); d.style.background = color; return d; };
  /* x : the item ; f : its field. A field still asked for blinks, and carries a tick that keeps the value as it is. */
  const num = (x, f, unit) => { const ask = Array.isArray(x.ask) && x.ask.includes(f), done = () => { if (Array.isArray(x.ask)) { x.ask = x.ask.filter((k) => k !== f); if (!x.ask.length) delete x.ask; } };
    const input = el("input", { type: "number", value: x[f], step: "any", "aria-label": unit, "data-field": f, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { x[f] = v; done(); o.changed(); } }, onKeydown: (e) => { if (e.key === "Enter" && ask) { done(); o.changed(); } } });
    return el("label", { class: "bc-val" + (ask ? " ask" : "") }, ask ? needField(input, { hint: "Valeur d'exemple : tapez la vôtre, ou confirmez-la (Entrée, ou la coche)" }) : input, el("small", null, unit),
      ...(ask ? [el("button", { class: "icon-btn ask-ok", type: "button", "aria-label": `Garder ${x[f]} ${unit}`, "data-tip": "Garder cette valeur", onClick: () => { done(); o.changed(); } }, icon("check"))] : [])); };
  const pick = (value, opts, set, label) => el("select", { "aria-label": label, onChange: (e) => { set(e.target.value); o.changed(); } }, opts.map(([k, l]) => el("option", { value: k, selected: k === value }, l)));
  /* the values of the selected item, and where it is : by the mouse first, by the list of regions for what is hard to click */
  function editor(g, it) {
    if (it.kind === "symmetry") { const e = el("div", { class: "bc-edit" }, el("p", { class: "small", style: { margin: ".25rem 0" } }, "Cette frontière est bloquée parce que le plan est un plan de symétrie : rien ne le traverse, le produit n'est résolu que d'un côté. Elle ne se retire pas seule — elle part avec la symétrie."),
      el("div", { class: "bc-row" }, btn("Retirer la symétrie…", () => o.unsym(it), { small: true, icon: "trash", tip: "Remet le produit entier dans le calcul" }))); e.style.borderColor = it.color; return e; }
    const x = st[g.key][it.index], setRegion = (k) => { if (g.key === "fixed") st.fixed[it.index] = typeof x === "object" ? { ...x, region: k } : k; else x.region = k; };
    const rows = [el("div", { class: "bc-row" }, btn("Choisir dans la vue", () => o.aim((k) => { setRegion(k); o.changed(); }), { small: true, icon: "fit", tip: "Cliquez la face (ou l'interface) sur le modèle : elle s'allume sous le curseur" }),
      pick(it.region, o.regions.map((r) => [r.key, r.label]), setRegion, "Endroit"))];
    if (g.key === "fixed") {      // what the support blocks : everything (an encastrement), or only some directions — a face that slides, an edge that rests
      const d = supportDofs(x), flip = (k) => { const next = d.slice(); next[k] = !next[k]; st.fixed[it.index] = next.every(Boolean) && !isOff(x) ? supportKey(x) : { region: supportKey(x), dofs: next, ...(isOff(x) ? { off: true } : {}) }; o.changed(); };
      rows.push(el("div", { class: "bc-row", "data-field": "dofs" }, el("small", { "data-tip": "Les directions que l'appui empêche. Les trois : un encastrement. Une seule : l'endroit glisse dans les deux autres." }, "bloque"),
        ...["X", "Y", "Z"].map((a, k) => el("label", { class: "check", style: { margin: 0 } }, el("input", { type: "checkbox", checked: d[k], "aria-label": `Bloquer ${a}`, onChange: () => flip(k) }), a))));
    }
    if (g.key === "loads") {
      rows.push(el("div", { class: "bc-row" }, pick(x.mode, [["force", "Force"], ["pressure", "Pression"]], (v) => { if (Array.isArray(x.ask)) x.ask = x.ask.map((k) => (k === "F" || k === "p" ? (v === "force" ? "F" : "p") : k)); x.mode = v; }, "Genre d'effort"),
        ...(x.mode === "force" ? [num(x, "F", "N"), pick(x.dir, [...Object.keys(AXIS_DIRS).map((d) => [d, `vers ${d}`]), ["free", "autre direction…"]], (v) => { if (v === "free" && !loadDir({ dir: "free", vec: x.vec })) x.vec = (AXIS_DIRS[x.dir] || [0, 0, -1]).slice(); x.dir = v; }, "Direction de la force")] : [num(x, "p", "MPa")])));
      /* any direction : its three components — only their proportions count, the force keeps its value */
      if (x.mode === "force" && x.dir === "free") { const v = Array.isArray(x.vec) && x.vec.length === 3 ? x.vec : [0, 0, -1], u = loadDir({ dir: "free", vec: v });
        rows.push(el("div", { class: "bc-row", "data-field": "vec" }, el("small", { "data-tip": "Les composantes de la direction selon X, Y et Z. Seules leurs proportions comptent : (1 ; 0 ; −1) pousse à 45° entre +X et −Z." }, "direction"),
          ...["X", "Y", "Z"].map((a, k) => el("input", { type: "number", value: v[k], step: "any", "aria-label": `Direction de la force, composante ${a}`, style: { flex: "1 1 0", width: 0, minWidth: 0 }, onChange: (e) => { const c = parseFloat(e.target.value); if (Number.isFinite(c)) { const next = v.slice(); next[k] = c; x.vec = next; o.changed(); } } }))),
          el("p", { class: u ? "muted small" : "form-error small", style: { margin: "0 0 .2rem" } }, u ? `Direction de longueur 1 : (${u.map((c) => String(Math.round(c * 1000) / 1000).replace(".", ",")).join(" ; ")}). La pression, elle, pousse toujours perpendiculairement à la face.` : "Donnez au moins une composante non nulle."));
      }
    }
    if (g.key === "power") rows.push(el("div", { class: "bc-row" }, num(x, "P", "W")));
    if (g.key === "fixedT") rows.push(el("div", { class: "bc-row" }, num(x, "T", "°C")));
    const e = el("div", { class: "bc-edit" }, rows); e.style.borderColor = it.color; return e;
  }
  for (const g of tree) {
    const on = st.show[g.key] !== false, key = `fea.bc:${g.key}`;
    if (st.sel && g.items.some((it) => it.id === st.sel)) fold(key, false);      // what is selected is seen
    const grp = el("div", { class: "bc-group" + (isFolded(key) ? " folded" : ""), role: "group", "data-fold-key": key }); box.append(grp);
    grp.append(el("div", { class: "bc-ghead fold-head" }, dot(g.color), el("b", { class: "grow", "data-tip": g.tip }, `${g.fr} (${g.items.filter((it) => !it.off).length}${g.items.some((it) => it.off) ? ` + ${g.items.filter((it) => it.off).length} à Off` : ""})`), ...(g.items.some((it) => it.ask.length) ? [el("span", { class: "bc-ask fold-only" }, "à entrer")] : []),
      el("button", { class: "icon-btn" + (on ? " on" : ""), type: "button", "aria-pressed": on ? "true" : "false", "aria-label": `Étiquettes des ${g.fr.toLowerCase()} dans la vue`, "data-tip": on ? "Étiquettes affichées sur le modèle — cliquer pour les masquer" : "Étiquettes masquées — cliquer pour les afficher", onClick: () => { st.show[g.key] = !on; o.relabel(); } }, icon(on ? "eye" : "eye-off")),
      btn("", () => o.add(g.key), { small: true, icon: "plus", tip: `Ajouter ${g.one} — puis cliquez la face sur le modèle` })));
    if (!g.items.length) grp.append(el("p", { class: "bc-none muted small" }, g.key === "fixed" ? "Aucun appui : le produit n'est pas tenu." : "Aucun."));
    for (const it of g.items) {
      const sel = st.sel === it.id, row = el("div", { class: "bc-item" + (sel ? " sel" : "") + (it.ask.length ? " ask" : "") + (it.off ? " is-off" : ""), role: "treeitem", "aria-selected": sel ? "true" : "false", tabindex: "0", "data-bc": it.id,
        onClick: () => o.select(sel ? null : it.id), onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.select(sel ? null : it.id); } }, onMouseenter: () => { if (it.region) o.hover(it.region, it.color); }, onMouseleave: () => o.hover(null) },
        dot(it.color), el("b", null, it.id), el("span", { class: "bc-text" }, el("span", null, it.text), el("small", null, it.off ? `Off, hors du calcul · ${it.where}` : it.where)), ...(it.ask.length ? [el("span", { class: "bc-ask", "data-tip": "Une valeur d'exemple attend la vôtre" }, "à entrer")] : []),
        /* On / Off, and a copy : several cases kept side by side, one solved at a time */
        ...(it.locked ? [] : [onOff(!it.off, (on, e) => o.toggle(g.key, it.index, !!(e && e.altKey)), it.id, it.off ? `${it.id} est de côté (Off) : il ne compte pas dans le calcul — cliquer pour le remettre (On). Alt + clic : lui seul à On parmi les ${g.fr.toLowerCase()}` : `${it.id} compte (On) — cliquer pour le mettre de côté (Off) sans le perdre. Alt + clic : lui seul à On parmi les ${g.fr.toLowerCase()}`),
          el("button", { class: "icon-btn bc-copy", type: "button", "aria-label": `Dupliquer ${it.id}`, "data-tip": `Dupliquer ${it.id} : la copie naît à Off — changez-y une valeur, mettez-la à On à la place de ${it.id}, relancez, comparez`, onClick: (e) => { e.stopPropagation(); o.copy(g.key, it.index); } }, icon("copy"))]),
        el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer ${it.id}`, "data-tip": it.locked ? "Frontière bloquée par la symétrie : elle part avec elle" : "Retirer", onClick: (e) => { e.stopPropagation(); if (it.locked) o.unsym(it); else o.remove(g.key, it.index); } }, it.locked ? icon("lock") : "×"));
      if (sel) row.style.borderColor = it.color;
      grp.append(row); if (sel) grp.append(editor(g, it));
    }
  }
  return box;
}
