/* DesignOrbit.ai — what a kept simulation looks like in the design-review report. No dependency on the solver, so the
   report can list the simulations of a project without loading it. */

export const VERDICT = { ok: ["Concordant", "ok"], warn: ["Écart notable", "warn"], fail: ["Discordant", "danger"], none: ["Non recoupé", "neutral"] };
/** A number the way a result is read: one decimal above 100, three significant-ish below. */
export const show = (v, d = 3) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const k = Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 1 ? d : 4;
  return (Math.round(v * 10 ** k) / 10 ** k).toLocaleString("fr-CA", { maximumFractionDigits: k });
};

/** What the instruments of a kept simulation read, in one line : « TC1 (côté froid) 42,3 °C · SG1 +312 µm/m » (its `sensors`, as
    sensors.js keeps them : a temperature in °C, a strain in µm/m, the two principal strains for a rosette). */
export function instrumentsText(list) {
  const sign = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${show(Math.abs(v), 0)}`;
  return (list || []).map((r) => `${r.id}${r.name ? ` (${r.name})` : ""} ${r.kind === "temp" ? `${show(r.value, 1)} °C` : Array.isArray(r.grids) ? `ε1 ${sign(r.e1)} · ε2 ${sign(r.e2)} µm/m` : `${sign(r.value)} µm/m`}`).join(" · ");
}
/** Rows of the design-review report: one per saved simulation (project.simulations). */
export function simulationSummary(project) {
  return ((project && project.simulations) || []).map((r) => ({ id: r.id, kind: r.kind === "thermal" ? "Thermique" : r.kind === "thermo" ? "Thermo-mécanique" : "Structure", target: `${r.target}${r.case ? ` — ${r.case}` : ""}`, mesh: `${r.cells} cubes de ${show(r.h, 2)} mm${r.cuts && r.cuts.length ? ` — modèle 1/${show(r.copies, 1)} : ${r.cuts.map((c) => `${c.bc === "sym" ? "symétrie" : c.bc === "fixed" ? "coupe tenue" : c.bc === "temp" ? `coupe à ${show(c.T, 1)} °C` : "coupe libre"} ${c.axis} = ${show(c.at, 2)}`).join(", ")}` : ""}${r.zones && r.zones.length ? ` — ${r.zones.length} zone${r.zones.length > 1 ? "s" : ""} de raffinement : ${r.zones.map((z) => `${z.id} ${z.shape === "prism" ? "prisme □" : "cylindre ⌀"} ${show(z.size, 2)} × ${show(z.length, 2)} mm, axe ${z.axis}, cubes de ${show(z.h, 2)} mm${typeof z.peak === "number" ? ` (pointe ${show(z.peak, 1)}${typeof z.alone === "number" ? ` contre ${show(z.alone, 1)} sans la zone` : ""})` : ""}`).join(" ; ")}` : ""}`,
    estimate: r.kind === "thermal" ? `${show(r.estimate.Tmax, 1)} °C` : r.kind === "thermo" ? `≤ ${show(r.estimate.sigma, 1)} MPa au cœur · ≤ ${show(r.estimate.delta)} mm` : `${show(r.estimate.sigma, 1)} MPa · ${show(r.estimate.delta)} mm`,
    result: r.kind === "thermal" ? `${show(r.result.Tmax, 1)} °C` : `${r.kind === "thermo" && typeof r.result.core === "number" ? `${show(r.result.core, 1)} MPa au cœur, pointe ` : ""}${show(r.result.sigma, 1)} MPa · ${show(r.result.delta)} mm${r.result.sf ? ` · marge ${show(r.result.sf, 2)}` : ""}`,
    instruments: instrumentsText(r.sensors), verdict: r.verdict, verdictLabel: (VERDICT[r.verdict] || VERDICT.none)[0], deviation: typeof r.worst === "number" ? `${Math.round(r.worst * 100)} %` : "—", when: r.when || "" }));
}
