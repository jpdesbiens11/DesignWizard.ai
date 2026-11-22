/* DynamiteOrbit — the line of a folder in a list (core/folders.js says what a folder is). One look for every list : a chevron,
   the pictogram of a folder, its name, how many entries it holds — and, at the end of the line, what applies to all of them.
   A click folds or unfolds ; with Ctrl or Shift it chooses every entry of the folder, as it would choose a line. */

import { el, icon, promptBox } from "./dom.js";
import { isFolded, setFolded } from "./folders.js";

/** o : { scope (the list : « part:ID », « asm:ID »), key, name, note (« 4 · 1 à Off »), flag (a mark when something inside needs a look, folded or not),
        tools: [nodes], onAll(event) (Ctrl / Shift + click : choose them all), redraw() } → { head, folded } */
export function folderHead(o) {
  const folded = isFolded(o.scope, o.key);
  const toggle = (e) => { if (o.onAll && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); o.onAll(e); return; } setFolded(o.scope, o.key, !folded); o.redraw(); };
  const head = el("div", { class: "folder-head" + (folded ? " folded" : ""), "data-folder": o.key },
    el("button", { class: "folder-toggle", type: "button", "aria-expanded": folded ? "false" : "true", "aria-label": `${folded ? "Déplier" : "Replier"} le dossier « ${o.name} » (${o.note})`,
      "data-tip": `Dossier « ${o.name} » — ${folded ? "replié : cliquer pour voir le détail" : "déplié : cliquer pour ne garder que la vue d'ensemble"}. Ctrl + clic : choisir tout ce qu'il contient. Un dossier range, il ne change rien.`, onClick: toggle },
      icon(folded ? "chevron-right" : "chevron-down"), icon("folder"), el("span", { class: "grow" }, o.name), o.flag || null, el("small", null, o.note)),
    ...(o.tools || []).filter(Boolean));
  return { head, folded };
}
const tool = (pict, tip, fn) => el("button", { class: "icon-btn", type: "button", "aria-label": tip, "data-tip": tip, onClick: (e) => { e.stopPropagation(); fn(e); } }, icon(pict));
/** Rename and undo, the two tools every folder has. o : { name, rename(to), drop() } */
export const folderTools = (o) => [
  tool("edit", `Renommer le dossier « ${o.name} »`, async () => { const to = await askFolderName(o.name, "Renommer le dossier", "Donner le nom d'un autre dossier les réunit."); if (to && to !== o.name) o.rename(to); }),
  tool("unlink", `Défaire le dossier « ${o.name} » : ce qu'il contient reste là, tel quel`, () => o.drop())];
/** Ask the name of a folder. → the name, or null */
export const askFolderName = (suggest, title = "Ranger dans un dossier", hint = "Un dossier range, il ne change rien : ni la pièce, ni l'assemblage, ni leur révision. Il se replie pour la vue d'ensemble, se déplie pour le détail, et se défait d'un clic.") => promptBox(title, "Nom du dossier", suggest, hint);
