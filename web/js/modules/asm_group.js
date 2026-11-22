/* DesignOrbit.ai — Assemblage : what is done to SEVERAL elements at once (demande de JP : « quand on sélectionne plusieurs
   pièces… il faut être capable de changer les propriétés de tout le groupe de sélection, en un seul clic » — before, a setting
   touched on a line changed that line only). One rule, held here : a setting touched while several elements are chosen applies
   to ALL of them — the swatch of a line, its On / Off switch, its eye, the menu of the right click (on the line and on the part
   in the view), the card of the right panel — each as ONE undoable step.
   And the FOLDER of an assembly (core/folders.js) : a line that gathers elements and folds. It ranges ; it is not « Grouper »,
   which forms a sub-assembly and changes the structure of the product. */

import { el, icon, btn, onOff, toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { setInstOff } from "../core/asm_live.js";
import { chosenWords } from "../core/multi_select.js";
import { folderRows, setFolder, renameFolder, dropFolder, nextFolderName, folderState } from "../core/folders.js";
import { folderHead, folderTools, askFolderName } from "../core/folders_ui.js";
import { openInstsLookPicker } from "./part_look.js";

/** c : { id (assembly), st (st.multi, st.sel, st.anchor), asm() (the document), name(inst) → its name, form(ids) (make a sub-assembly), left (the left panel), redraw() } */
export function asmGroup(c) {
  const { id, st } = c, insts = (ids) => c.asm().instances.filter((i) => ids.includes(i.id));
  /** What a setting touched on the line of `iid` applies to : every element chosen when the line is one of them, the line alone otherwise. */
  const of = (iid) => (st.multi.length > 1 && st.multi.includes(iid) ? st.multi.slice() : [iid]);
  const say = (ids, one) => (ids.length > 1 ? `${ids.length} éléments` : one);
  const off = (ids, on, one) => store.updateAssembly(id, (x) => { for (const g of ids) setInstOff(x, g, on); }, `${say(ids, one)} ${on ? "à Off" : "à On"}`);
  const flag = (ids, key, on, word, one) => store.updateAssembly(id, (x) => { for (const i of x.instances) if (ids.includes(i.id)) { if (on) i[key] = true; else delete i[key]; } }, `${say(ids, one)} ${word}`);
  const look = (ids, anchor) => openInstsLookPicker(id, ids, anchor || c.left);
  const toFolder = async (ids) => {
    const name = await askFolderName(nextFolderName(c.asm().instances)); if (!name) return;
    store.updateAssembly(id, (x) => { x.instances = setFolder(x.instances, (i) => ids.includes(i.id), name); }, `${ids.length} éléments rangés dans « ${name} »`);
    toast(`Dossier « ${name} » : ${ids.length} éléments. Il se replie d'un clic ; l'assemblage n'a pas changé.`, "success", 4200);
  };
  const state = (ids) => { const some = insts(ids); return { some, allOff: some.every((i) => i.off), allHid: some.every((i) => i.hidden), allFixed: some.every((i) => i.fixed) }; };
  /** The menu of the right click when several elements are chosen : the same actions as the bar, where the hand is. */
  function menu(ids) {
    const s = state(ids), n = ids.length;
    return [{ title: chosenWords(n, "élément", "éléments") }, { label: "Apparence ici… (couleur, camouflage, finition)", icon: "palette", run: () => look(ids) }, "—",
      { label: s.allHid ? "Afficher" : "Masquer", icon: s.allHid ? "eye" : "eye-off", run: () => flag(ids, "hidden", !s.allHid, s.allHid ? "à l'écran" : "masqués") },
      { label: s.allOff ? "Remettre à On" : "Mettre à Off (de côté, sans les retirer)", icon: "power", run: () => off(ids, !s.allOff) }, "—",
      { label: "Ranger dans un dossier…", icon: "folder", run: () => toFolder(ids) }, { label: "Former un sous-assemblage…", icon: "assembly", run: () => c.form(ids) }, "—",
      { label: "Ne plus rien choisir", icon: "close", keys: "Échap", run: () => { st.multi = []; c.redraw(); } }];
  }
  /** The card of the right panel when several elements are chosen : what they are, and what is set for all of them. */
  function card(body) {
    const ids = st.multi, s = state(ids), n = ids.length;
    body.append(el("h3", null, chosenWords(n, "élément", "éléments")), el("p", { class: "muted", style: { fontSize: ".84rem" } }, s.some.map((i) => c.name(i)).join(" · ")),
      el("div", { class: "side-section", "data-group-card": "" }, el("h3", null, "Pour tous, d'un coup"),
        el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
          btn("Apparence…", (e, b) => look(ids, b), { small: true, primary: true, icon: "palette", tip: "Une couleur, un motif, une finition pour tous les éléments choisis, dans cet assemblage" }),
          btn(s.allHid ? "Afficher" : "Masquer", () => flag(ids, "hidden", !s.allHid, s.allHid ? "à l'écran" : "masqués"), { small: true, icon: s.allHid ? "eye" : "eye-off" }),
          btn(s.allOff ? "Remettre à On" : "Mettre à Off", () => off(ids, !s.allOff), { small: true, icon: "power", tip: "À Off : gardés à leur place, ils ne comptent pour rien" }),
          btn("Dossier…", () => toFolder(ids), { small: true, icon: "folder", tip: "Ranger ces éléments dans un dossier repliable — l'assemblage ne change pas" }),
          btn("Grouper…", () => c.form(ids), { small: true, icon: "assembly", tip: "Former un sous-assemblage : la structure du produit change" })),
        el("p", { class: "muted small" }, "Ce que vous changez ici, sur une ligne choisie ou par le clic droit s'applique à tous les éléments choisis — une seule étape, annulable. Échap : ne plus rien choisir.")));
  }
  /** The lines of the list with its folders. line(inst, inFolder) → the line of one element. → [nodes] */
  function rows(list, line) {
    const out = [];
    for (const r of folderRows(list)) {
      if (r.kind === "item") { out.push(line(r.item, false)); continue; }
      const ids = r.rows.map((x) => x.item.id), s = folderState(r.rows, { offKey: "off", hideKey: "hidden" });
      const F = folderHead({ scope: `asm:${id}`, key: r.key, name: r.name, note: s.note, redraw: c.redraw,
        onAll: () => { st.multi = [...new Set([...st.multi, ...ids])]; st.anchor = ids[0]; st.sel = ids[ids.length - 1]; c.redraw(); },
        tools: [el("button", { class: "icon-btn", type: "button", "aria-label": `Apparence de tout le dossier « ${r.name} »`, "data-tip": "Une apparence pour tout le dossier, dans cet assemblage", onClick: (e) => { e.stopPropagation(); look(ids, e.currentTarget); } }, icon("palette")),
          onOff(!s.allOff, (on) => off(ids, !on, `Dossier « ${r.name} »`), r.name, s.allOff ? "Tout le dossier est à Off — cliquer pour le remettre à On" : "Mettre à Off tout le dossier, d'un coup"),
          el("button", { class: "icon-btn", type: "button", "aria-label": `${s.allHidden ? "Afficher" : "Masquer"} le dossier « ${r.name} »`, "data-tip": s.allHidden ? "Afficher tout le dossier" : "Masquer tout le dossier", onClick: (e) => { e.stopPropagation(); flag(ids, "hidden", !s.allHidden, s.allHidden ? "à l'écran" : "masqués", `Dossier « ${r.name} »`); } }, icon(s.allHidden ? "eye-off" : "eye")),
          ...folderTools({ name: r.name, rename: (to) => store.updateAssembly(id, (x) => { x.instances = renameFolder(x.instances, r.name, to); }, `Dossier « ${r.name} » renommé « ${to} »`), drop: () => store.updateAssembly(id, (x) => { x.instances = dropFolder(x.instances, r.name); }, `Dossier « ${r.name} » défait`) })] });
      out.push(F.head); if (!F.folded) for (const x of r.rows) out.push(line(x.item, true));
    }
    return out;
  }
  return { of, off, flag, look, toFolder, menu, card, rows };
}
