/* DynamiteOrbit.ai — Logiciel, Banc HIL : the window « Mission par phases » (JP, 28 novembre 2026 : « la partie profil de mission est vraiment nice ;
   si tu as besoin de plus que la marge de droite, fais une fenêtre pop-up supplémentaire dans cette page »). A table of phases — name, power (kW,
   + the module gives, − it takes), minutes —, a phase bar that follows it (one colour per phase, its width its time), what the phases ask in all
   (time, energy given and taken, peak), and « Enregistrer dans la banque » : the phases become a profile of the bench's bank, one undoable step,
   which the bench plays and the campaign judges. A table copied from a spreadsheet is pasted as it is. What it follows : the phase table of a
   mission planner, and the paste of a spreadsheet's rows. */

import { el, btn, icon, modal, toast } from "../core/dom.js";
import { examplePhases, parsePhases, phaseSummary, phaseProfile, phaseColor } from "../sw/sw_phases.js";
import { modelOf, modelSummary } from "../sw/sw_pack_model.js";

const f = (x, d = 2) => String(+(+x).toFixed(d)).replace(".", ",");

/** design() ; change(label, fn) : one undoable step on the software ; choose(id) : the bench opens on the profile saved. */
export function openPhases(design, change, choose = null) {
  const d0 = design(), v = modelOf(d0).v, cap = modelSummary(v).eWh / 1000;
  let phases = examplePhases(v.pPeak), name = "Mission par phases";
  const rows = el("tbody"), bar = el("div", { class: "swph-bar", "data-swph-bar": "" }), sum = el("p", { class: "small", "data-swph-sum": "" });
  const nameIn = el("input", { type: "text", value: name, "aria-label": "Nom de la mission", onInput: (e) => { name = e.target.value; } });
  const paste = el("textarea", { rows: 3, placeholder: "Coller un tableau (nom, kW, min) copié d'un tableur : une phase par ligne", "aria-label": "Coller un tableau de phases", "data-swph-paste": "" });
  const read = btn("Lire le tableau", () => { const r = parsePhases(paste.value); if (r.errors.length) toast(r.errors.slice(0, 3).join(" ; "), "error", 6000); if (r.phases.length) { phases = r.phases; draw(); toast(`${r.phases.length} phases lues.`, "success"); } }, { small: true, icon: "paste" });
  function draw() {
    rows.replaceChildren(...phases.map((p, i) => el("tr", { "data-swph-row": String(i) },
      el("td", null, el("i", { class: "swph-dot", style: `background:${phaseColor(p)}` })),
      el("td", null, el("input", { type: "text", value: p.name, "aria-label": `Nom de la phase ${i + 1}`, onChange: (e) => { p.name = e.target.value; draw(); } })),
      el("td", null, el("input", { type: "number", value: String(p.kw), step: 0.1, "aria-label": `Puissance de la phase ${i + 1} (kW)`, onChange: (e) => { const x = Number(e.target.value); if (Number.isFinite(x)) { p.kw = x; draw(); } } })),
      el("td", null, el("input", { type: "number", value: String(p.min), step: 0.5, min: 0.1, "aria-label": `Durée de la phase ${i + 1} (min)`, onChange: (e) => { const x = Number(e.target.value); if (Number.isFinite(x) && x > 0) { p.min = x; draw(); } } })),
      el("td", null, (() => { const b = btn("", () => { phases.splice(i, 1); draw(); }, { small: true, icon: "trash", tip: "Retirer la phase" }); b.setAttribute("aria-label", `Retirer la phase ${i + 1}`); return b; })()))));
    const S = phaseSummary(phases), tot = Math.max(1e-6, S.min);
    bar.replaceChildren(...phases.map((p) => el("span", { style: `width:${(100 * p.min) / tot}%;background:${phaseColor(p)}`, title: `${p.name} : ${f(p.kw)} kW, ${f(p.min, 1)} min` }, p.min / tot > 0.08 ? p.name : "")));
    sum.textContent = `${f(S.min, 1)} min · ${f(S.kwhOut)} kWh donnés${S.kwhIn ? `, ${f(S.kwhIn)} kWh reçus` : ""} · crête ${f(S.peak)} kW — le module tient ${f(cap)} kWh au plus (${Math.round((100 * S.kwhOut) / Math.max(1e-6, cap))} %) et ${f(v.pPeak)} kW de crête.${S.kwhOut > cap ? " Les phases demandent plus que le module : la tension basse l'arrêtera." : ""}`;
  }
  const add = btn("Ajouter une phase", () => { phases.push({ name: `Phase ${phases.length + 1}`, kw: 1, min: 5 }); draw(); }, { small: true, icon: "plus" });
  const save = btn("Enregistrer dans la banque", () => {
    if (!phases.length) { toast("Aucune phase.", "error"); return; }
    const taken = new Set(((design() || {}).profiles || []).map((p) => p.id)); let k = 1, id = "phases"; while (taken.has(id)) id = `phases-${++k}`;
    if (choose) choose(id);      // before the step : the bench, drawn again by it, opens on the new mission
    m.close(); change(`Logiciel : mission par phases « ${name} » dans la banque`, (x) => { x.profiles = [...(x.profiles || []), phaseProfile(phases, { id, name })]; });
    toast("Mission enregistrée dans la banque : le banc la joue, la campagne la juge.", "success", 6000);
  }, { primary: true, icon: "check", tip: "Une étape annulable : un profil de la banque du banc" }); save.dataset.swphSave = "";
  const body = el("div", { class: "swph", "data-swph": "" },
    el("p", { class: "small" }, "Chaque phase demande une puissance au module : + il la donne, − il la reçoit. Le courant en découle, tenu à ses limites (marge de droite). L'exemple est celui de l'outil, à l'échelle d'un module : remplacez-le par vos phases."),
    el("label", { class: "small" }, "Nom ", nameIn), bar, sum,
    el("table", { class: "swph-table" }, el("thead", null, el("tr", null, ["", "Phase", "kW", "min", ""].map((h) => el("th", null, h)))), rows),
    el("div", { class: "form-actions" }, add, el("span", { class: "grow" })), paste, el("div", { class: "form-actions" }, read));
  draw();
  const m = modal("Mission par phases", [body, el("div", { class: "form-actions" }, el("span", { class: "grow" }), btn("Fermer", () => m.close()), save)], { wide: true });
  return m;
}
