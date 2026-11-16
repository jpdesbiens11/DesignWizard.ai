/* DesignWizard.ai — what the brief of the Shop lacks or gets wrong, said while the designer types it : a part with no
   name, a material that does not come in the stock chosen, a quantity of zero… Pure : the Shop shows the list next to
   the proposal, marks the field that waits, and holds « Créer la pièce » until what blocks is dealt with.
   An entry : { level, text, field (key of the brief the entry is about, when one) } — levels of core/guide.js. */

import { material } from "../cad/materials.js";
import { printProcess } from "../cad/special_processes.js";

const FORM_NEEDS = {
  sheet: [(m) => m.processes.includes("laser_cut") || m.processes.includes("sheet_metal"), "ne se vend pas en tôle ni en feuille"],
  print: [(m) => !!printProcess(m.id), "ne s'imprime pas"],
  molded: [(m) => ["injection_molding", "die_casting", "sand_casting"].some((k) => m.processes.includes(k)), "ne se moule pas"],
  profile: [(m) => m.processes.some((k) => /^extrusion_/.test(k)), "ne s'extrude pas"],
};
const SOLID = ["plate", "block", "bar_flat", "bar_round", "angle"];

/** @param brief  the intent of the Shop   @param project  the open project (names already taken)   @returns the entries */
export function briefIssues(brief, project) {
  const out = [], add = (level, text, field) => out.push({ level, text, ...(field ? { field } : {}) }), b = brief || {};
  const name = String(b.name || "").trim(), mat = b.material ? material(b.material) : null, list = b.interfaces || [];
  if (!name) add("todo", "Donnez un nom à la pièce : il la suit dans l'arbre, sur le dessin et dans la commande.", "name");
  else if (((project && project.parts) || []).some((p) => String(p.name || "").trim().toLowerCase() === name.toLowerCase())) add("warn", `Une pièce du projet s'appelle déjà « ${name} » : deux pièces du même nom se confondent dans la nomenclature.`, "name");
  if (!list.length && !(b.contents || []).length && !(b.folds && (b.folds.sides || []).length)) add("warn", "Aucune interface : la pièce n'est reliée à rien, elle n'a qu'une enveloppe par défaut. Ajoutez « je me visse sur… », « on se visse sur moi », « je reçois un arbre »…", "interfaces");
  const q = Number(b.quantity);
  if (!(q >= 1)) add("warn", "Quantité : au moins 1. Elle oriente le procédé — une pièce, dix ou mille ne se fabriquent pas de la même façon.", "quantity");
  else if (!Number.isInteger(q)) add("tip", "Quantité : un nombre entier de pièces.", "quantity");
  if (b.material && !mat) add("warn", `Matière « ${b.material} » inconnue de la bibliothèque.`, "material");
  if (mat && b.form) {
    const need = FORM_NEEDS[b.form];
    if (need && !need[0](mat)) add("warn", `${mat.name} ${need[1]} : la proposition forcera un procédé qui ne lui convient pas. Correctif : changez de matière, ou reprenez la matière première conseillée.`, "form");
    else if (SOLID.includes(b.form) && (mat.cls === "sheet" || mat.cls === "pcb")) add("warn", `${mat.name} est une matière en feuille : elle ne se prend pas dans un bloc ou une barre. Correctif : « Tôle ou feuille ».`, "form");
  }
  const names = list.map((it) => String(it.name || "").trim().toLowerCase()).filter(Boolean), twice = names.find((x, i) => names.indexOf(x) < i);
  if (twice) add("tip", `Deux interfaces s'appellent « ${twice} » : un nom par interface évite de les confondre à l'assemblage.`, "interfaces");
  for (const k of ["L", "W", "H"]) if (b.envelope && b.envelope[k] !== undefined && !(b.envelope[k] > 0)) { add("warn", "Enveloppe : chaque dimension à contenir doit être positive.", "envelope"); break; }
  if (!String(b.fn || "").trim()) add("tip", "À quoi sert-elle ? Une phrase aide la revue de conception, et l'IA quand vous lui confiez la pièce.", "fn");
  return out;
}
