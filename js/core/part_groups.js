/* DesignWizard.ai — the parts of a project grouped by the way they are made, for a list one chooses in : a group per process
   (its trade name, in English), a colour per group, a pictogram and a short title per part, the imported parts last.
   Pure : the drop-down list of the part studio shows it (modules/part_list.js). */

import { PROCESSES, materialOrDefault } from "../cad/materials.js";
import { shownLook } from "./part_look.js";

export const GROUP_COLORS = ["#2563eb", "#d97706", "#16a34a", "#7c3aed", "#0891b2", "#dc2626", "#b45309", "#64748b"];
/** The pictogram of a part : a board, a profile, an imported solid, or a part. */
export const partMark = (p) => (p.family === "pcb" ? "pcb" : p.family === "extrusion" ? "extrusion" : p.step ? "step" : "part");
/** → [{ key, label, color, items: [{ id, title, sub (number · material), icon, dot (the colour it shows) }] }] */
export function partGroups(parts) {
  const by = new Map();
  for (const p of parts || []) {
    const key = p.step ? "~step" : p.process || "~none", label = p.step ? "Imported (STEP)" : (PROCESSES[p.process] || {}).label || "Procédé à définir", m = materialOrDefault(p.material);
    if (!by.has(key)) by.set(key, { key, label, items: [] });
    by.get(key).items.push({ id: p.id, title: p.name || p.id, sub: `${p.id} · ${m.name}`, icon: partMark(p), dot: shownLook(p, m.color, m.opacity).color });
  }
  return [...by.values()].sort((a, b) => (a.key[0] === "~") - (b.key[0] === "~") || a.label.localeCompare(b.label, "fr")).map((g, i) => ({ ...g, color: GROUP_COLORS[i % GROUP_COLORS.length] }));
}
