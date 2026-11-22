/* DesignOrbit.ai — « Gamme » tab of the assembly : the assembly routing to talk with the prototyping engineers.
   One step per part, in the order the mated interfaces give ; a click on a step shows the product as it stands at
   that step, the part being mounted highlighted ; the order is changed with the arrows and kept in the assembly, with
   the notes and the points to discuss. The Word and PDF sheets carry one picture of the view per step. */

import { el, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { ownsKey } from "../core/asm_levels.js";
import { assemblyPlan } from "../core/asm_plan.js";
import { mateHardware } from "../core/assembly_logic.js";
import { planPanel, shot, setPlanNote, setPlanPoints } from "./plan_view.js";

const keysOf = (v, iid) => [...v.objects.keys()].filter((k) => ownsKey(iid, k));      // a part, or every part of a sub-assembly : it is mounted as one block
/** Every part visible again, nothing highlighted. */
export function showWhole(vp) { const v = vp.viewer; for (const k of v.objects.keys()) v.setVisible(k, true); v.highlight([]); v.invalidate(); }

export function gammeTab(body, a, { st, vp, id }) {
  const c = st.ctx, v = vp.viewer, plan = assemblyPlan(a, store.project, { hardwareOf: (m) => mateHardware(c.asm, c.built, m), mass: c.mass.mass, dfa: st.dfa }), order = plan.order;
  /* the product at step k of the order (null : whole) : what is mounted so far, the part of the step highlighted */
  const showStep = (k) => {
    const upto = k === null || k >= order.length ? order.length : k + 1;
    order.forEach((iid, i) => { for (const key of keysOf(v, iid)) v.setVisible(key, i < upto); });
    v.highlight(k !== null && k < order.length ? keysOf(v, order[k]) : []); v.invalidate();
  };
  const index = () => plan.phases.findIndex((ph) => ph.key === st.step), mark = () => body.querySelectorAll(".plan-phase").forEach((li) => li.classList.toggle("on", li.dataset.phase === st.step));
  const reorder = (list, label) => store.updateAssembly(id, (x) => { x.plan = x.plan || {}; if (list) x.plan.order = list; else { delete x.plan.order; if (!Object.keys(x.plan).length) delete x.plan; } }, label);
  const move = (i, d) => { const list = [...order]; [list[i], list[i + d]] = [list[i + d], list[i]]; reorder(list, `${id} : ordre de montage modifié`); };
  const arrow = (tip, on, fn, up) => { const b = el("button", { class: "icon-btn", type: "button", disabled: !on, "data-tip": tip, "aria-label": tip, onClick: (e) => { e.stopPropagation(); fn(); } }, icon("chevron-down")); if (up) b.firstChild.style.transform = "rotate(180deg)"; return b; };
  if (a.plan && a.plan.order) body.append(el("p", { class: "atelier-hint" }, icon("info"), el("span", null, "L'ordre de montage a été fixé à la main. ",
    el("button", { class: "link-btn", type: "button", onClick: () => reorder(null, `${id} : ordre de montage automatique`) }, "Revenir à l'ordre tiré des interfaces"))));
  planPanel(body, plan, { selected: st.step, aiKey: `assembly:${id}`,
    onSelect: (ph, i) => { st.step = st.step === ph.key ? null : ph.key; showStep(st.step ? i : null); mark(); },
    onNote: (key, text) => store.updateAssembly(id, (x) => setPlanNote(x, key, text), `${id} : note de gamme`),
    onPoints: (list) => store.updateAssembly(id, (x) => setPlanPoints(x, list), `${id} : points à discuter`),
    phaseExtra: (ph, i) => (i < order.length ? el("span", { class: "plan-step-btns" }, arrow("Monter cette pièce plus tôt", i > 0, () => move(i, -1), true), arrow("Monter cette pièce plus tard", i < order.length - 1, () => move(i, 1))) : null),
    figures: () => {
      const out = [];
      try { showStep(null); out.push(shot(v, `${a.id} — le produit assemblé`, null, 120)); order.forEach((iid, i) => { showStep(i); out.push(shot(v, `Étape ${plan.phases[i].n} — ${plan.phases[i].title}`, plan.phases[i].key)); }); }
      finally { const k = index(); showStep(k >= 0 ? k : null); }
      return out;
    } });
  const k = index();
  if (k >= 0) showStep(k); else { st.step = null; showStep(null); }
}
