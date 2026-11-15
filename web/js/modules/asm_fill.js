/* DesignWizard.ai — fill a cavity in the assembly : choose the housing, the filler and the level ; the kernel takes the room
   left by everything already in place, and the result becomes a part of the assembly — with its volume, its mass, its
   place in the bill of materials. Done again in one click when the parts around it move. */

import { el, btn, field, toast, modal, fmt, fmtMass } from "../core/dom.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { material } from "../cad/materials.js";

export const FILLERS = { "GAP-FILLER": "Composé thermique de remplissage (k ≈ 2,5 W/m·K)", EPOXY: "Résine époxy d'enrobage", SILICONE: "Silicone d'enrobage souple" };

/** ctx : the built assembly ({ asm, sol }) ; instId : the housing to fill ; redo : the filling part to compute again. */
export function openFill(asmId, instId, ctx, redo = null) {
  const inst = ctx.asm.instances.find((i) => i.id === instId), spec = store.part(inst.part), prev = redo ? store.part(redo).fill : null, st = { material: prev ? prev.material : "GAP-FILLER", pct: prev ? prev.pct : 100, res: null };
  const out = el("p", { class: "muted" }, "Le calcul prend la boîte du contenant jusqu'au niveau choisi, et en retire le contenant et toutes les autres pièces posées."), go = btn(redo ? "Remplacer le remplissage" : "Créer la pièce de remplissage", () => apply(), { primary: true, icon: "check", disabled: true });
  async function compute() {
    go.disabled = true; out.textContent = "Calcul du volume libre…";
    const others = ctx.asm.instances.filter((i) => i.id !== instId && i.part !== redo && !store.part(i.part).fill).map((i) => ({ key: i.part, matrix: ctx.sol.placements[i.id] })), M = ctx.sol.placements[instId];
    try {
      const pre = await kernel.fill({ key: inst.part, matrix: M }, [], null), z0 = pre.bbox[2], z1 = pre.bbox[5];       // the empty housing first : its cavity gives the levels
      st.res = await kernel.fill({ key: inst.part, matrix: M }, others, z0 + (z1 - z0) * st.pct / 100, `Remplissage de ${spec.id}`);
      const m = material(st.material), g = st.res.volume / 1000 * m.rho;
      out.textContent = `${fmt(st.res.volume / 1000, 1)} cm³ de ${m.name.toLowerCase()} — ${fmtMass(g)}, jusqu'à ${fmt(st.res.bbox[5] - st.res.bbox[2], 1)} mm au-dessus du fond de la cavité (cavité vide : ${fmt(pre.volume / 1000, 1)} cm³).`;
      go.disabled = false;
    } catch (e) { st.res = null; out.textContent = e.message; }
  }
  function apply() {
    if (!st.res) return;
    const id = redo || store.uniqueId(`${spec.id}-FILL`.slice(0, 32)), part = { dw: "part/1", id, name: `Remplissage de ${spec.name || spec.id}`, family: "filler", process: "purchased", material: st.material, function: `Remplit la cavité de ${spec.id} une fois tout en place : tenue, isolation, conduction de la chaleur.`,
      elec: { kind: "insulator" }, fill: { of: instId, part: spec.id, material: st.material, pct: st.pct, volume: Math.round(st.res.volume) }, step: { text: st.res.step, file: `${id}.step` }, features: [],
      notes: [`Volume calculé dans l'assemblage ${asmId} : ${fmt(st.res.volume / 1000, 1)} cm³ — à recalculer si les pièces autour changent.`, "Coulé en production une fois les pièces en place ; dégazage et polymérisation selon la fiche du produit."] };
    store.commit(redo ? `${id} recalculé` : `${id} : remplissage de ${spec.id}`, (p) => {
      const at = p.parts.findIndex((x) => x.id === id); if (at >= 0) p.parts[at] = { ...p.parts[at], ...part }; else p.parts.push(part);
      const a = p.assemblies.find((x) => x.id === asmId); if (!a.instances.some((i) => i.part === id)) a.instances.push({ id: `i${Date.now().toString(36)}`, part: id, fixed: true, placement: { t: [0, 0, 0], r: [0, 0, 0] } });
    });
    kernel.forget(id).catch(() => {}); m.close(); toast(`${id} : ${fmt(st.res.volume / 1000, 1)} cm³ posés dans ${asmId}.`, "success", 5000);
  }
  const m = modal(`Remplir la cavité de ${spec.name || spec.id}`, [el("p", null, "Comme en production : le produit se coule une fois tout en place, et prend la place qui reste."),
    el("div", { class: "form-row" }, field("Produit", el("select", { onChange: (e) => { st.material = e.target.value; compute(); } }, Object.entries(FILLERS).map(([k, l]) => el("option", { value: k, selected: k === st.material }, l)))),
      field("Niveau de remplissage (% de la cavité)", el("input", { type: "number", min: 5, max: 100, step: 5, value: st.pct, onChange: (e) => { st.pct = Math.max(5, Math.min(100, parseFloat(e.target.value) || 100)); compute(); } }))),
    out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), go)], { wide: true });
  compute();
}
