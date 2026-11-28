/* DynamiteOrbit.ai — Logiciel, Banc HIL : the RIGHT PANE of the MODULE ON THE BENCH, a 1.5D system model (JP, 28 novembre 2026 : « mettre dans la marge
   de droite les paramètres du pack qui permettent d'évaluer performance et aspect thermique transitoire durant les missions… de manière système 1.5D
   comme dans LMS Amesim ; les conditions aux frontières sont aussi définies dans ce pan »). On top, the network drawn as a system-simulation tool
   draws it — the CORE in a row and their links, the casing, the air, the coolant along the stack — and what follows from the values (voltage,
   energy, time constant). Then one group per nature : Cell, Pack, Thermique 1.5D, Conditions aux frontières, Limites — each value with its unit,
   its name in the trade (on hover) and where it comes from ; a value the tool proposes is an EXAMPLE, dashed and blinking until it is entered or
   confirmed. Each change is one undoable step on the software's module (`design.plant.model`, sw/sw_pack_model.js) ; the bench starts again with
   it, and the campaign plays with it. An AI never changes it. What it follows : the parameter panel of a system-simulation tool, grouped by
   component, beside a sketch of the network ; the example values of the platform. */

import { el, svg, icon, btn } from "../core/dom.js";
import { MODEL_GROUPS, MODEL_PARAMS, MODEL_GAPS, modelOf, setParam, confirmAll, modelSummary } from "../sw/sw_pack_model.js";

const f = (x, d = 1) => String(+(+x).toFixed(d)).replace(".", ",");

/* the network, as a system-simulation tool draws it */
function sketch(n) {
  const W = 300, x = (k) => 16 + k * ((W - 32) / n), w = (W - 32) / n - 6, kids = [];
  kids.push(svg("path", { d: `M8 14 H${W - 8}`, class: "swp-cool" }), svg("text", { x: 8, y: 10, class: "swp-t" }, "liquide (pompe en marche) →"));
  for (let k = 0; k < n; k++) { kids.push(svg("rect", { x: x(k), y: 24, width: w, height: 26, rx: 3, class: "swp-core" }), svg("text", { x: x(k) + w / 2, y: 41, class: "swp-t c", "text-anchor": "middle" }, `${k + 1}`),
    svg("line", { x1: x(k) + w / 2, y1: 50, x2: x(k) + w / 2, y2: 62, class: "swp-link" }), svg("line", { x1: x(k) + w / 2, y1: 24, x2: x(k) + w / 2, y2: 14, class: "swp-link cool" }));
    if (k < n - 1) kids.push(svg("line", { x1: x(k) + w, y1: 37, x2: x(k + 1), y2: 37, class: "swp-link" })); }
  kids.push(svg("rect", { x: 10, y: 62, width: W - 20, height: 10, rx: 2, class: "swp-case" }), svg("text", { x: W / 2, y: 70, class: "swp-t", "text-anchor": "middle" }, "boîtier"),
    svg("path", { d: `M${W / 2} 72 V84`, class: "swp-link" }), svg("text", { x: W / 2, y: 94, class: "swp-t", "text-anchor": "middle" }, "air ambiant"),
    svg("line", { x1: 4, y1: 37, x2: 16, y2: 37, class: "swp-link end" }), svg("line", { x1: W - 16, y1: 37, x2: W - 4, y2: 37, class: "swp-link end" }));
  return svg("svg", { class: "swp-sketch", viewBox: `0 0 ${W} 98`, role: "img", "aria-label": `Le réseau 1.5D : ${n} CORE en ligne reliés l'un à l'autre, chacun au boîtier puis à l'air, et au liquide qui longe l'empilement ; les deux bouts aux couvercles` }, ...kids);
}
/** The sections of the right pane. d : the software ; change(label, fn(design)) : one undoable step ; phases() : opens the window of a mission by phases. */
export function plantSections(d, change, { phases } = {}) {
  if (!d || !d.plant) return [];
  const M = modelOf(d), v = M.v, n = (d.plant && d.plant.n) || 8, S = modelSummary(v, n), guess = MODEL_PARAMS.filter((p) => !M.sure.includes(p.key));
  const put = (p, value) => change(`Module 1.5D : ${p.fr} = ${value}${p.unit ? ` ${p.unit}` : ""}`, (x) => { x.plant = { ...x.plant, model: setParam(x.plant.model, p.key, value) }; });
  const head = el("div", { class: "side-section swp", "data-fold-note": guess.length ? `${guess.length} exemples` : "confirmé", "data-sw-plant": "" }, el("h3", null, "Module simulé · 1.5D"),
    el("p", { class: "small" }, "Le module sur le banc, en modèle système : un nœud par CORE le long de l'empilement, le boîtier, l'air et le liquide en travers. Le logiciel le commande, la mission le pousse ; les vues de la Mission en montrent le SoC, la puissance et la température de chaque CORE."),
    sketch(n),
    el("div", { class: "swp-figs" }, [["Tension nominale", `${f(S.vNom)} V`], ["Énergie", `${f(S.eWh / 1000, 2)} kWh`], ["Capacité", `${f(S.capAh, 1)} Ah`], ["Cellules", `${f(S.massKg, 2)} kg`], ["I max", `${f(S.iMax, 0)} A · ${f(S.iChg, 0)} A en charge`], ["τ d'un CORE au boîtier", `${f(S.tauMin, 0)} min`]]
      .map(([a, b]) => el("div", null, el("small", null, a), el("b", null, b)))),
    el("div", { class: "swp-acts" }, phases ? (() => { const b = btn("Mission par phases…", phases, { small: true, primary: true, icon: "flow", tip: "Une mission en puissance, phase par phase (nom, kW, minutes) : elle entre dans la banque et la campagne la joue" }); b.dataset.swPhasesOpen = ""; return b; })() : null,
      guess.length ? (() => { const b = btn(`Confirmer ${guess.length} valeur${guess.length > 1 ? "s" : ""}`, () => change("Module 1.5D : valeurs confirmées telles quelles", (x) => { x.plant = { ...x.plant, model: confirmAll(x.plant.model) }; }), { small: true, icon: "check", tip: "Les valeurs proposées par l'outil, prises telles quelles" }); b.dataset.swPlantConfirm = ""; return b; })() : null));
  const groups = MODEL_GROUPS.map((G) => el("div", { class: "side-section swp-group", style: `--g:${G.color}`, "data-fold-note": `${MODEL_PARAMS.filter((p) => p.group === G.key).length}`, "data-sw-plant-group": G.key },
    el("h3", null, icon(G.icon), ` ${G.fr}`), el("p", { class: "small muted" }, G.says),
    MODEL_PARAMS.filter((p) => p.group === G.key).map((p) => { const sure = M.sure.includes(p.key), val = v[p.key];
      const input = p.values ? el("select", { "aria-label": p.fr, "data-sw-param": p.key, onChange: (e) => put(p, e.target.value) }, p.values.map(([k, w]) => el("option", { value: k, selected: k === val ? "" : null }, w)))
        : el("input", { type: "number", value: String(val), min: p.min, max: p.max, step: p.step, "aria-label": `${p.fr} (${p.unit})`, "data-sw-param": p.key, onChange: (e) => { const x = Number(e.target.value); if (Number.isFinite(x)) put(p, x); } });
      return el("label", { class: `swp-row${sure ? "" : " guess"}`, "data-tip": `${p.en} — ${p.basis}${sure ? "" : " · exemple : à entrer ou à confirmer"}` }, el("span", null, p.fr), input, el("small", null, p.unit)); })));
  const gaps = el("div", { class: "side-section", "data-fold-note": `${MODEL_GAPS.length}` }, el("h3", null, "Ce que le modèle ne fait pas"), el("ul", { class: "small" }, MODEL_GAPS.map((t) => el("li", null, t))));
  return [head, ...groups, gaps];
}
