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
