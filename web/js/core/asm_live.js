/* DesignWizard.ai — a part of an assembly put aside (demande de JP). An instance that is « off » stays in the assembly, with its
   place and its joints, and counts for nothing : not in the view, the bill of materials, the mass, the joints, the routing, the
   drawing, the checks, nor what is sent out. Turned on again, it comes back as it was. Different from « hidden », which only
   takes a part out of sight. Pure, and without any import : every tool that reads an assembly takes it through liveAsm(). */

/** Is an instance put aside ? */
export const instOff = (i) => !!(i && i.off);
/** The assembly as it counts : without the instances put aside and the joints that hold to one of them. The same object when
    nothing is off. */
export function liveAsm(asm) {
  const inst = (asm && Array.isArray(asm.instances) ? asm.instances : null); if (!inst || !inst.some(instOff)) return asm;
  const off = new Set(inst.filter(instOff).map((i) => i.id));
  return { ...asm, instances: inst.filter((i) => !instOff(i)), mates: (asm.mates || []).filter((m) => !(m.a && off.has(m.a.inst)) && !(m.b && off.has(m.b.inst))) };
}
/** What is put aside, to say it : { instances: [ids], mates: [ids of the joints that wait for them] }. */
export function offOf(asm) {
  const inst = (asm && asm.instances) || [], off = new Set(inst.filter(instOff).map((i) => i.id));
  return { instances: [...off], mates: ((asm && asm.mates) || []).filter((m) => (m.a && off.has(m.a.inst)) || (m.b && off.has(m.b.inst))).map((m) => m.id) };
}
/** An instance turned off, or on again — the assembly given is changed (inside store.updateAssembly). A part that was the fixed
    one and goes off leaves the others where the solver puts them : the first instance left is the ground. */
export function setInstOff(asm, id, off) { const i = (asm.instances || []).find((x) => x.id === id); if (!i) return false; if (off) i.off = true; else delete i.off; return true; }

/* ---------- what is shown : one part alone, all of them ---------- */
/** The instances one sees : on, and not hidden. */
export const shownOf = (asm) => ((asm && asm.instances) || []).filter((i) => !instOff(i) && !i.hidden);
/** Is this part the only one shown ? */
export const isAlone = (asm, id) => { const s = shownOf(asm); return s.length === 1 && s[0].id === id; };
/** Shows one part alone (the others hidden — not off : they still count), or brings them all back. The assembly given is changed. */
export function showAlone(asm, id) { for (const i of asm.instances || []) { if (i.id === id) delete i.hidden; else i.hidden = true; } }
export function showEvery(asm) { for (const i of asm.instances || []) delete i.hidden; }
/** The menu of a part, the same on its line of the list and on the part in the view : what it offers follows the state of the part.
    → [{ title } | "—" | { act, label, icon, keys? }] — act : open, alone, all, hide, show, off, on, fix, free, remove ; [] for no part. */
export function instanceMenu(asm, id, name = "") {
  const i = ((asm && asm.instances) || []).find((x) => x.id === id); if (!i) return [];
  const hidden = ((asm && asm.instances) || []).filter((x) => x.hidden && !instOff(x)).length, alone = isAlone(asm, id), many = ((asm && asm.instances) || []).filter((x) => !instOff(x)).length > 1;
  const all = hidden ? [{ act: "all", label: `Montrer toutes les pièces (${hidden} masquée${hidden > 1 ? "s" : ""})`, icon: "eye", keys: "Maj+H" }] : [];
  const head = [{ title: `${name || i.part} · ${i.id}` }, { act: "open", label: "Ouvrir la pièce", icon: "edit", keys: "Entrée" }];
  if (instOff(i)) return [...head, "—", { act: "on", label: "Remettre à On (elle compte de nouveau)", icon: "power" }, ...all, "—", { act: "remove", label: "Retirer de l'assemblage", icon: "trash", keys: "Suppr" }];
  return [...head, "—",
    ...(many && !alone ? [{ act: "alone", label: "Montrer seulement cette pièce", icon: "eye", keys: "I" }] : []), ...all,
    i.hidden ? { act: "show", label: "Afficher", icon: "eye", keys: "H" } : { act: "hide", label: "Masquer", icon: "eye-off", keys: "H" }, "—",
    { act: "off", label: "Mettre à Off (de côté, sans la retirer)", icon: "power" }, { act: i.fixed ? "free" : "fix", label: i.fixed ? "Libérer" : "Fixer (elle porte les autres)", icon: "lock" }, "—",
    { act: "remove", label: "Retirer de l'assemblage", icon: "trash", keys: "Suppr" }];
}
