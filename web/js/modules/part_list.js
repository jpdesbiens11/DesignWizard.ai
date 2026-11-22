/* DesignOrbit.ai — Pièces : choosing the part one looks at, and choosing several to change them together (demandes de JP).
   At the head of the left panel, a drop-down list one can search (core/pick_list.js) : the parts grouped by the way they are made,
   a colour per group, a pictogram, a name and the colour of the part — thirty parts no longer push the construction tree off the
   screen. The whole list stays, UNDER the tree : « Toutes les pièces », where Ctrl + click and Shift + click choose several parts
   (core/multi_select.js) ; a bar then offers what can be done to them at once — their look, their material, an assembly of them —
   each as one undoable step. */

import { el, icon, btn, promptBox, toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { go } from "../core/app.js";
import { pickStep, modsOf, isMulti, keepChosen, chosenWords } from "../core/multi_select.js";
import { pickList } from "../core/pick_list.js";
import { materialMenu, materialOrDefault } from "../cad/materials.js";
import { partGroups, partMark } from "../core/part_groups.js";
import { lookSwatch, lookTools, openPartsLookPicker } from "./part_look.js";

/** The drop-down list at the head of the left panel : the part one looks at. o : { parts, id, key (the screen : « parts », « pcb »…) } */
export function partPicker(o) {
  const n = o.parts.length;
  return el("div", { class: "side-actions", "data-part-pick": "" }, pickList({ label: "Pièce affichée", value: o.id, groups: partGroups(o.parts), empty: "Aucune pièce : le « + » en crée une", onPick: (pid) => go(`#/${o.key}/${encodeURIComponent(pid)}`) }),
    n > 1 ? el("small", { class: "muted", style: { display: "block", marginTop: ".25rem" } }, `${n} pièces, par procédé — tapez pour chercher.`) : null);
}

/* what can be done to several parts at once */
function partBatch(ids, o) {
  const n = ids.length, words = chosenWords(n, "pièce", "pièces", true), clear = () => { o.st.multi = []; o.redraw(); };
  const mat = el("select", { "aria-label": "Matériau des pièces choisies", "data-tip": "Le même matériau pour toutes les pièces choisies — une seule étape annulable",
    onChange: (e) => { const m = e.target.value; if (!m) return; store.commit(`${n} pièces : matériau ${m}`, (p) => { for (const x of p.parts || []) if (ids.includes(x.id)) x.material = m; }); toast(`${materialOrDefault(m).name} : matériau de ${n} pièces. Ctrl + Z pour revenir.`, "success", 4200); } },
    el("option", { value: "" }, "Matériau…"), materialMenu().map((f) => el("optgroup", { label: f.family }, f.list.map((m) => el("option", { value: m.id }, m.name)))));
  const group = async () => {
    const name = await promptBox("Nouvel assemblage", "Nom", "Sous-ensemble", `Un assemblage fait des ${n} pièces choisies : la première est fixe, les autres s'accouplent ensuite par leurs interfaces.`); if (!name) return;
    const aid = store.uniqueId(`ASM-${String(store.assemblies.length + 1).padStart(3, "0")}`);
    store.commit(`Assemblage ${aid} formé de ${n} pièces`, (p) => { p.assemblies.push({ dw: "assembly/1", id: aid, name, instances: ids.map((pid, k) => ({ id: `i${k + 1}`, part: pid, ...(k ? {} : { fixed: true }), placement: { t: [0, 0, 0], r: [0, 0, 0] } })), mates: [] }); }, { assembly: aid });
    o.st.multi = []; go(`#/assembly/${encodeURIComponent(aid)}`);
  };
  return el("div", { class: "batch-bar", role: "group", "aria-label": words, "data-batch": "parts" }, el("b", null, words),
    btn("Apparence", (e, b) => openPartsLookPicker(ids, b), { small: true, icon: "palette", tip: "Une couleur, un motif, une finition pour toutes les pièces choisies — la palette s'ouvre dans la marge de droite" }), mat,
    btn("Assemblage", group, { small: true, icon: "assembly", tip: "Un nouvel assemblage avec les pièces choisies" }),
    el("button", { class: "icon-btn", type: "button", "aria-label": "Ne plus rien choisir", "data-tip": "Ne plus rien choisir", onClick: clear }, icon("close")));
}
/** « Toutes les pièces » : every part of the project, under the tree — to see them at a glance, and to choose several and change
    them together. o : { parts, id, key, st (it keeps st.multi and st.anchor), redraw() } */
export function partsSection(o) {
  const { parts, st } = o, order = parts.map((p) => p.id); st.multi = keepChosen(st.multi, order);
  const sec = el("div", { class: "side-section", "data-fold-note": `${parts.length}${st.multi.length > 1 ? ` · ${st.multi.length} choisies` : ""}`, "data-all-parts": "" }, el("h3", null, el("span", { class: "grow" }, `Toutes les pièces (${parts.length})`), lookTools(parts)));
  if (st.multi.length > 1) sec.append(partBatch(st.multi, o));
  for (const p of parts) {
    const on = st.multi.includes(p.id);
    sec.append(el("div", { class: "nav-row" }, el("a", { class: "nav-item" + (p.id === o.id ? " active" : "") + (on ? " multi" : ""), href: `#/${o.key}/${encodeURIComponent(p.id)}`, "data-part": p.id, "aria-current": p.id === o.id ? "true" : null,
      onClick: (e) => { if (!isMulti(e)) { st.multi = []; st.anchor = p.id; return; }      // a plain click opens the part ; with Ctrl or Shift it builds a choice, and the page stays
        e.preventDefault(); const r = pickStep(st.multi.length ? st.multi : [o.id].filter((x) => order.includes(x)), order, p.id, modsOf(e), st.anchor ?? o.id); st.multi = r.ids; st.anchor = r.anchor; o.redraw(); } },
      icon(partMark(p)), el("span", { class: "grow" }, p.name || p.id), el("small", null, p.id)), lookSwatch(p, { group: () => (st.multi.length > 1 && st.multi.includes(p.id) ? st.multi : null) })));      // the swatch of a part chosen with others paints them all
  }
  if (!parts.length) sec.append(el("p", { class: "muted" }, "Aucune pièce."));
  else sec.append(el("p", { class: "muted small" }, "Ctrl + clic : choisir plusieurs pièces · Maj + clic : toute une suite — pour changer ensemble leur apparence ou leur matériau, ou en faire un assemblage."));
  return sec;
}
