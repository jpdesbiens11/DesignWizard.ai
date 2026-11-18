/* DesignWizard.ai — Simulation : what the result panel shows once a run is done, and the switch between the two views.
   The designer goes back and forth : the MODEL, grey, with its supports, loads and their labels — where the case is
   changed ; the RESULT, coloured — the last run, kept while the case is reworked and said to be « of before » until the
   next run. The result is read as a stress (or a temperature) on an adjustable scale, or as a SAFETY FACTOR against the
   factor aimed at : red below it, then orange, blue, green. The trials of the session are listed, to see a case converge. */

import { el, btn, badge, table, icon, fmt } from "../core/dom.js";
import { VERDICT, show } from "../analysis/fea/summary.js";
import { FS_TARGETS, FS_COLORS, fsBands, safetySummary, safetyText } from "../analysis/fea/safety.js";
import { zonesResult } from "./fea_zones.js";

const n = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const seg = (items, value, pick, label) => el("div", { class: "seg text", role: "group", "aria-label": label }, items.map(([k, text, tip, off]) => el("button", { class: "seg-btn" + (k === value ? " on" : ""), type: "button", "aria-pressed": k === value ? "true" : "false", disabled: !!off, "data-tip": tip || null, onClick: () => pick(k) }, text)));

/** The two views, as one control. o : { view ("model" | "result"), last (the run shown, or null), onView(v) } */
export function viewSwitch(o) {
  const r = o.last, word = r ? `Résultat ${r.n}${r.stale ? " (d'avant)" : ""}` : "Résultat";
  return seg([["model", "Modèle et conditions", "Le modèle, ses appuis, ses efforts et leurs étiquettes : c'est ici que le cas se modifie"],
    ["result", word, r ? (r.stale ? "Le dernier calcul — le cas ou le maillage a changé depuis : relancez pour le mettre à jour" : "Le dernier calcul, en couleurs") : "Aucun calcul encore : lancez la simulation", !r]], o.view, o.onView, "Ce que la vue montre");
}
/** The legend of the safety factor for a target : the bands, their bounds and their words. */
export function fsLegend(target) {
  const bands = fsBands(target), grad = ([a, b]) => (a === b ? a : `linear-gradient(90deg, ${a}, ${b})`);
  return el("div", { class: "fs-legend", role: "img", "aria-label": `Légende du facteur de sécurité pour ${n(target)} visé` }, bands.map((b) => {
    const sw = el("i"); sw.style.background = grad(FS_COLORS[b.key]);
    return el("div", { class: "fs-band" }, sw, el("b", null, b.to === Infinity ? `≥ ${n(b.from)}` : b.from === 0 ? `< ${n(b.to)}` : `${n(b.from)} à ${n(b.to)}`), el("small", null, b.fr)); }));
}

/** Everything about « the result » in the right panel — at its top, since it is what one came for ; each part is a group that folds. o : { last, st, runs, mat (first material), repaint(), setView(v), keep(), pick(run) } */
export function resultPanel(body, o) {
  const { last, st } = o, r = last.result, c = last.compare, thermal = last.kind === "thermal", unit = thermal ? "°C" : "MPa";
  const S = !thermal && last.fs ? safetySummary(last.fs, st.fsTarget) : null, sf = S && S.min !== null ? S.min : null;
  const head = el("div", { class: "side-section", "data-fold-note": thermal ? `${show(r.maxT.value, 1)} °C` : `${show(r.maxVm.value, 1)} MPa` }, el("h3", null, `Résultat ${last.n}`, last.stale ? badge("d'avant", "warn") : null));
  body.append(head);
  if (last.stale) head.append(el("p", { class: "atelier-hint warn" }, icon("warning"), " Ce résultat est celui d'avant : le cas de charge ou le maillage a changé depuis. Relancez la simulation pour le mettre à jour."));
  head.append(el("div", { class: "kpis" }, ...(thermal
    ? [el("div", { class: "kpi" }, el("b", null, `${show(r.maxT.value, 1)} °C`), el("span", null, "Température maximale")), el("div", { class: "kpi" }, el("b", null, `${show(r.minT.value, 1)} °C`), el("span", null, "Température minimale")), el("div", { class: "kpi" }, el("b", null, `${show(r.balance.out, 2)} W`), el("span", null, `évacués sur ${show(r.balance.in, 2)} W`))]
    : [el("div", { class: "kpi" }, el("b", null, `${show(r.maxVm.value, 1)} MPa`), el("span", null, `Contrainte de pointe${r.nominalVm ? ` · nominale ${show(r.nominalVm.value, 1)}` : ""}`)), el("div", { class: "kpi" }, el("b", null, `${show(r.maxU.value)} mm`), el("span", null, "Déplacement maximal")),
      el("div", { class: "kpi" + (S && S.min !== null ? ` fs-${S.band}` : "") }, el("b", null, sf === null ? "—" : Number.isFinite(sf) ? show(sf, 2) : "∞"), el("span", null, `Facteur de sécurité minimal · ${n(st.fsTarget)} visé`)),
      ...(last.kind === "thermo" ? [el("div", { class: "kpi" }, el("b", null, `${show(r.maxT.value, 1)} °C`), el("span", null, r.minT.value === r.maxT.value ? "Température uniforme" : `Température, de ${show(r.minT.value, 1)} °C`))] : [])])));
  { const zones = zonesResult(r.zones, thermal); if (zones) body.append(zones); }      // a group of its own      // what each refinement zone found, against the model alone
  /* what the colours of the view mean : a stress on a scale, or the safety factor against the one aimed at */
  const sec = el("div", { class: "side-section" }, el("h3", null, "Ce que les couleurs montrent"));
  if (!thermal) sec.append(seg([["stress", "Contrainte", "Contrainte de von Mises, en MPa"], ["fs", "Facteur de sécurité", "Limite élastique du matériau sur la contrainte, en chaque point"]], st.quantity === "fs" ? "fs" : "stress", (k) => { st.quantity = k; o.repaint(); }, "Grandeur affichée"));
  if (!thermal && st.quantity === "fs") {
    const input = el("input", { type: "number", min: 1, max: 20, step: 0.05, value: st.fsTarget, "aria-label": "Facteur de sécurité visé", onChange: (e) => { const v = parseFloat(e.target.value); if (v >= 1 && v <= 20) { st.fsTarget = v; o.repaint(); } } });
    sec.append(el("div", { class: "bc-row" }, el("small", null, "Facteur visé"), input, ...FS_TARGETS.map((t) => el("button", { class: "chip-btn" + (t === st.fsTarget ? " on" : ""), type: "button", "aria-pressed": t === st.fsTarget ? "true" : "false", onClick: () => { st.fsTarget = t; o.repaint(); } }, n(t)))),
      fsLegend(st.fsTarget), el("p", { class: "small" }, S ? safetyText(S) : ""),
      el("p", { class: "muted small" }, `Limite élastique : ${o.mat.Re ? `${fmt(o.mat.Re, 0)} MPa pour ${o.mat.name}` : "inconnue pour ce matériau"} — valeur typique, la fiche de la nuance fait foi. Sur ce maillage grossier, le facteur est indicatif : les concentrations locales ne sont pas résolues.`));
  } else {
    const [d0, d1] = last.data, span = (d1 - d0) || 1, clampV = (x) => Math.min(d1, Math.max(d0, x));
    const lo = el("input", { type: "number", step: "any", value: +last.range[0].toPrecision(4), "aria-label": "Bas de l'échelle" }), hi = el("input", { type: "number", step: "any", value: +last.range[1].toPrecision(4), "aria-label": "Haut de l'échelle" });
    const sLo = el("input", { type: "range", min: 0, max: 1000, value: Math.round(1000 * (last.range[0] - d0) / span), "aria-label": "Bas de l'échelle (curseur)" }), sHi = el("input", { type: "range", min: 0, max: 1000, value: Math.round(1000 * (last.range[1] - d0) / span), "aria-label": "Haut de l'échelle (curseur)" });
    const out = el("p", { class: "muted small" }), tell = () => { out.textContent = last.range[0] > d0 || last.range[1] < d1 ? `Résultat de ${show(d0, 1)} à ${show(d1, 1)} ${unit}. Hors échelle : au-dessus en magenta, en dessous en gris.` : `Échelle automatique : tout le résultat, de ${show(d0, 1)} à ${show(d1, 1)} ${unit}.`; };
    const setRange = (a, b, from) => { if (!(b > a)) return; last.range = [a, b]; if (from !== "n") { lo.value = +a.toPrecision(4); hi.value = +b.toPrecision(4); } if (from !== "s") { sLo.value = Math.round(1000 * (clampV(a) - d0) / span); sHi.value = Math.round(1000 * (clampV(b) - d0) / span); } o.repaint(true); tell(); };
    lo.addEventListener("input", () => setRange(parseFloat(lo.value), last.range[1], "n")); hi.addEventListener("input", () => setRange(last.range[0], parseFloat(hi.value), "n"));
    sLo.addEventListener("input", () => setRange(d0 + span * Math.min(+sLo.value, +sHi.value - 5) / 1000, last.range[1], "s")); sHi.addEventListener("input", () => setRange(last.range[0], d0 + span * Math.max(+sHi.value, +sLo.value + 5) / 1000, "s"));
    tell();
    sec.append(el("div", { class: "bc-row" }, el("small", { class: "grow" }, `Échelle (${unit})`), btn("Auto", () => setRange(d0, d1), { small: true, icon: "refresh", tip: "Revenir à l'échelle qui couvre tout le résultat" })), el("div", { class: "fea-legend" }, lo, el("i"), hi), el("div", { class: "fea-scale" }, sLo, sHi), out);
  }
  if (!thermal) sec.append(el("p", { class: "muted small" }, `Déformée amplifiée ${fmt(r.scale, 0)} fois.`));
  body.append(sec);
  body.append(el("div", { class: "side-section" }, el("h3", null, "Le recoupement ", badge(VERDICT[c.verdict][0], VERDICT[c.verdict][1])),
    c.rows.length ? table(["", "À la main", "Simulation", "Écart"], c.rows.map((x) => [x.label, x.low !== undefined ? `${show(x.low, 2)} à ${show(x.analytic, 2)} ${x.unit}` : `${x.bound ? "au plus " : ""}${show(x.analytic, 2)} ${x.unit}`, `${show(x.fea, 2)} ${x.unit}`, x.deviation === null ? "—" : x.low !== undefined && x.deviation === 0 ? "dans la fourchette" : x.bound && x.deviation === 0 ? `sous la borne${x.note ? ` (${x.note})` : ""}` : `${x.deviation > 0 ? "+" : ""}${Math.round(x.deviation * 100)} %`])) : null,
    el("p", { class: "small" }, c.text), ...(c.notes || []).map((t) => el("p", { class: "atelier-hint warn" }, icon("warning"), " ", t)),
    last.info.dropped && last.info.dropped.length ? el("p", { class: "atelier-hint" }, icon("info"), ` ${last.info.dropped.length} corps laissé(s) de côté, car le maillage grossier ne les relie à aucune pièce tenue : ${last.info.dropped.slice(0, 6).join(", ")}${last.info.dropped.length > 6 ? "…" : ""}.`) : null,
    el("p", { class: "muted small" }, `${last.info.cells.toLocaleString("fr-CA")} cubes${last.info.fine ? ` + ${last.info.fine.toLocaleString("fr-CA")} cubes fins` : ""}, ${r.dofs.toLocaleString("fr-CA")} inconnues, ${r.iterations} itérations, ${fmt(r.ms / 1000, 2)} s. La contrainte de pointe d'un maillage grossier est indicative : les concentrations locales (trous, congés, bord de l'encastrement) ne sont pas résolues${last.info.fine ? " hors des zones de raffinement" : " — une zone de raffinement les regarde de près"}.`),
    el("div", { class: "form-actions" }, btn("Ajouter au rapport", () => o.keep(), { small: true, icon: "plus" }))));
  /* the trials of this session : change the case or the mesh, run again, and see whether the answer settles */
  if (o.runs.length > 1) body.append(el("div", { class: "side-section" }, el("h3", null, "Les essais de cette séance"),
    table(["", "Cubes", thermal ? "T max" : "σ de pointe", thermal ? "T min" : "Déplacement", thermal ? "" : "FS min", ""], o.runs.map((x) => { const t = x.kind === "thermal", s = !t && x.fs ? safetySummary(x.fs, st.fsTarget) : null;
      return [el("b", null, `${x.n}${x === last ? " ◂" : ""}`), x.info.cells.toLocaleString("fr-CA"), t ? `${show(x.result.maxT.value, 1)} °C` : `${show(x.result.maxVm.value, 1)} MPa`, t ? `${show(x.result.minT.value, 1)} °C` : `${show(x.result.maxU.value)} mm`, s && s.min !== null ? (Number.isFinite(s.min) ? show(s.min, 2) : "∞") : "—",
        x.skin && x !== last ? btn("Voir", () => o.pick(x), { small: true, icon: "eye", tip: `Afficher le résultat de l'essai ${x.n}` }) : ""]; })),
    el("p", { class: "muted small" }, "Un résultat qui ne bouge plus quand on affine le maillage ou qu'on précise les appuis est un résultat sur lequel on peut s'appuyer. Les six derniers essais restent affichables.")));
}
