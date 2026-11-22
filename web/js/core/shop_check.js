/* DynamiteOrbit — what the brief of the Shop lacks or gets wrong, said while the designer types it : a part with no
   name, a material that does not come in the stock chosen, a quantity of zero… Pure : the Shop shows the list next to
   the proposal, marks the field that waits, and holds « Créer la pièce » until what blocks is dealt with.
   An entry : { level, text, field (key of the brief the entry is about, when one) } — levels of core/guide.js. */

import { material, materialMenu, materialShort, processWords } from "../cad/materials.js";
import { printProcess } from "../cad/special_processes.js";

const FORM_NEEDS = {
  sheet: [(m) => m.processes.includes("laser_cut") || m.processes.includes("sheet_metal"), "ne se vend pas en tôle ni en feuille"],
  print: [(m) => !!printProcess(m.id), "ne s'imprime pas"],
  molded: [(m) => ["injection_molding", "die_casting", "lp_die_casting", "permanent_mold", "sand_casting"].some((k) => m.processes.includes(k)), "ne se moule pas"],
  profile: [(m) => m.processes.some((k) => /^extrusion_/.test(k)), "ne s'extrude pas"],
};
const SOLID = ["plate", "block", "bar_flat", "bar_round", "angle"];
const machined = (m) => m.processes.includes("cnc_milling") || m.processes.includes("cnc_turning");

/** Whether a stock form — and the process that goes with it — can work a material, from the processes the library gives it.
    → { ok, why (a few words that follow the name of the material ; "" when ok) } */
export function formTakes(form, materialId) {
  const m = material(materialId), need = FORM_NEEDS[form], no = (why) => ({ ok: false, why });
  if (!m || !form) return { ok: true, why: "" };
  if (need) return need[0](m) ? { ok: true, why: "" } : no(need[1]);
  if (SOLID.includes(form)) {
    if (m.cls === "sheet" || m.cls === "pcb") return no("est une matière en feuille");
    if (form === "angle" && m.cls !== "metal") return no("ne se vend pas en cornière");
    if (!machined(m)) return no("ne s'usine pas dans la masse, d'après la bibliothèque");
  }
  return { ok: true, why: "" };
}
/* the materials of the Shop by nature : a colour and a pictogram per nature, the colour of each material as its swatch */
export const MATERIAL_CLASSES = [{ cls: "metal", label: "Métaux", color: "#64748b", icon: "block" }, { cls: "plastic", label: "Plastiques", color: "#7c3aed", icon: "part" },
  { cls: "sheet", label: "Feuilles isolantes", color: "#b45309", icon: "sheet" }, { cls: "pcb", label: "Stratifiés (carte)", color: "#15803d", icon: "pcb" }];
const HIDDEN = new Set(["GENERIC-COMPONENT", "EPOXY"]);
/** What the designer may pick, by nature, once a stock form is chosen by hand (form "" : nothing is held back).
    also(id) : true for a material the companion would itself put in this form — it is never greyed.
    In a nature, the materials are filed by name — every aluminium together, every stainless steel together — and each one
    carries its processes in parentheses.
    → [{ cls, label, color, icon, possible, list: [{ id, name, short, procs, family, color, ok, why }], families: [{ family, list }] }] */
export function materialChoices(form, also = () => false) {
  return MATERIAL_CLASSES.map((g) => {
    const families = materialMenu((m) => m.cls === g.cls && !HIDDEN.has(m.id)).map(({ family, list }) => ({ family, list: list.map((m) => { const t = form && !also(m.id) ? formTakes(form, m.id) : { ok: true, why: "" };
      return { id: m.id, name: m.name, short: materialShort(m), procs: processWords(m), family, color: m.color, ok: t.ok, why: t.why }; }) }));
    const list = families.flatMap((f) => f.list);
    return { ...g, list, families, possible: list.filter((x) => x.ok).length };
  });
}

/** @param brief  the intent of the Shop   @param project  the open project (names already taken)
    @param o  { proposed : the interfaces the companion added of its own (synthesize().proposed) — they wait for a yes or a no }   @returns the entries */
export function briefIssues(brief, project, o = {}) {
  const out = [], add = (level, text, field) => out.push({ level, text, ...(field ? { field } : {}) }), b = brief || {};
  const name = String(b.name || "").trim(), mat = b.material ? material(b.material) : null, list = b.interfaces || [];
  if (!name) add("todo", "Donnez un nom à la pièce : il la suit dans l'arbre, sur le dessin et dans la commande.", "name");
  else if (((project && project.parts) || []).some((p) => String(p.name || "").trim().toLowerCase() === name.toLowerCase())) add("warn", `Une pièce du projet s'appelle déjà « ${name} » : deux pièces du même nom se confondent dans la nomenclature.`, "name");
  const own = (o && o.proposed) || [];
  if (own.length) add("todo", `Le compagnon ajoute de lui-même ${own.length > 1 ? `${own.length} interfaces` : "une interface"} que vous n'avez pas demandée${own.length > 1 ? "s" : ""} (${own.map((x) => `« ${x.name} »`).join(", ")}) : gardez-${own.length > 1 ? "les" : "la"} ou retirez-${own.length > 1 ? "les" : "la"}, dans « Ses interfaces ».`, "proposed");
  if (!list.length && !own.length && !(b.contents || []).length && !(b.folds && (b.folds.sides || []).length)) add("warn", "Aucune interface : la pièce n'est reliée à rien, elle n'a qu'une enveloppe par défaut. Ajoutez « je me visse sur… », « on se visse sur moi », « je reçois un arbre »…", "interfaces");
  const q = Number(b.quantity);
  if (!(q >= 1)) add("warn", "Quantité : au moins 1. Elle oriente le procédé — une pièce, dix ou mille ne se fabriquent pas de la même façon.", "quantity");
  else if (!Number.isInteger(q)) add("tip", "Quantité : un nombre entier de pièces.", "quantity");
  if (b.material && !mat) add("warn", `Matière « ${b.material} » inconnue de la bibliothèque.`, "material");
  if (mat && b.form) {
    const need = FORM_NEEDS[b.form];
    if (need && !need[0](mat)) add("warn", `${mat.name} ${need[1]} : la proposition forcera un procédé qui ne lui convient pas. Correctif : changez de matière — celles que ce procédé ne travaille pas sont grisées — ou reprenez la matière première conseillée.`, "form");
    else if (SOLID.includes(b.form) && (mat.cls === "sheet" || mat.cls === "pcb")) add("warn", `${mat.name} est une matière en feuille : elle ne se prend pas dans un bloc ou une barre. Correctif : « Tôle ou feuille ».`, "form");
  }
  const names = list.map((it) => String(it.name || "").trim().toLowerCase()).filter(Boolean), twice = names.find((x, i) => names.indexOf(x) < i);
  if (twice) add("tip", `Deux interfaces s'appellent « ${twice} » : un nom par interface évite de les confondre à l'assemblage.`, "interfaces");
  for (const k of ["L", "W", "H"]) if (b.envelope && b.envelope[k] !== undefined && !(b.envelope[k] > 0)) { add("warn", "Enveloppe : chaque dimension à contenir doit être positive.", "envelope"); break; }
  if (!String(b.fn || "").trim()) add("tip", "À quoi sert-elle ? Une phrase aide la revue de conception, et l'IA quand vous lui confiez la pièce.", "fn");
  return out;
}
