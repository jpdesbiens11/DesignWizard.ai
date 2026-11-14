/* DesignWizard.ai — the hand calculation before the simulation. A good analyst never launches a finite-element model
   without first estimating the answer with a simple equivalent model (a beam, a bar, a thermal resistance): it says
   what to expect, and it is what the simulation is checked against. This module reads the load case, picks the
   equivalent model, takes the REAL cross-section from the mesh at the support, and writes the calculation step by
   step. After the solve, compare() says whether the two agree. Pure functions over the model of index.js. */

import { regionInfo, sectionAt, skin } from "./index.js";

const AX = ["X", "Y", "Z"];
const n = (x, d = 3) => {
  if (typeof x !== "number" || !Number.isFinite(x)) return "—";
  const a = Math.abs(x), k = a === 0 || a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? d : Math.min(9, d - Math.floor(Math.log10(a)));
  return (Math.round(x * 10 ** k) / 10 ** k).toLocaleString("fr-CA", { maximumFractionDigits: k });
};
const dominant = (v) => { let a = 0; for (let i = 1; i < 3; i++) if (Math.abs(v[i]) > Math.abs(v[a])) a = i; return a; };
/** Resultant and point of application of the loads (pressures become their resultant on the exposed faces). */
function resultant(model, loads) {
  const F = [0, 0, 0], at = [0, 0, 0];
  let w = 0, pressure = false;
  for (const l of loads || []) {
    const info = regionInfo(model, l.region);
    let f = l.force;
    if (!f && typeof l.pressure === "number" && info.normal) { f = info.normal.map((c) => -c * l.pressure * info.area); pressure = true; }
    if (!f) continue;
    const m = Math.hypot(f[0], f[1], f[2]);
    for (let i = 0; i < 3; i++) { F[i] += f[i]; at[i] += info.centroid[i] * m; }
    w += m;
  }
  return w > 0 ? { F, at: at.map((c) => c / w), pressure } : null;
}

/** Structure: the equivalent beam or bar of a load case. material = { E (MPa), Re (MPa or null), name }. */
export function precheckStructure(model, load, material) {
  const none = (why) => ({ kind: "none", title: "Pas de modèle équivalent simple", steps: [why], values: {}, warnings: [] });
  if (!load.fixed || !load.fixed.length) return none("Aucun appui défini : ajoutez un encastrement.");
  const R = resultant(model, load.loads);
  if (!R) return none("Aucun effort défini : ajoutez une force ou une pression.");
  const sup = regionInfo(model, load.fixed[0]), d = R.at.map((c, i) => c - sup.centroid[i]), a = dominant(d), L = Math.abs(d[a]), others = [0, 1, 2].filter((i) => i !== a), [p, q] = others;
  const h = model.grid.h, dir = Math.sign(d[a]) || 1, S = sectionAt(model, a, sup.centroid[a] + dir * 0.5 * h);
  if (!S || !(S.area > 0)) return none("Section introuvable au droit de l'appui.");
  const E = material.E, Fa = R.F[a], Fp = R.F[p], Fq = R.F[q], steps = [], warnings = [];
  // a force along p bends about the axis parallel to q (second moment Ib, fibre distance cb) ; along q : Ia, ca
  const bend = [[Fp, S.Ib, S.cb, AX[p]], [Fq, S.Ia, S.ca, AX[q]]].filter(([f]) => Math.abs(f) > 1e-9);
  steps.push(`Lecture du cas : appui en ${AX[a]} = ${n(sup.centroid[a])} mm, effort résultant (${R.F.map((x) => n(x)).join(" ; ")}) N appliqué à ${n(L)} mm de l'appui le long de ${AX[a]}.`);
  steps.push(`Section réelle au droit de l'appui (lue sur le maillage) : A = ${n(S.area)} mm², ${n(S.size[0])} × ${n(S.size[1])} mm ; I = ${n(S.Ia)} et ${n(S.Ib)} mm⁴.`);
  let sigma = 0, d2 = 0;
  for (const [f, I, c, name] of bend) {
    const M = Math.abs(f) * L, s = M * c / I, del = Math.abs(f) * L ** 3 / (3 * E * I);
    sigma += s; d2 += del * del;
    steps.push(`Flexion sous F${name} = ${n(Math.abs(f))} N : M = F L = ${n(M)} N·mm ; σ = M c / I = ${n(M)} × ${n(c)} / ${n(I)} = ${n(s)} MPa ; δ = F L³ / (3 E I) = ${n(del)} mm (poutre encastrée, Roark).`);
  }
  let delta = Math.sqrt(d2);
  if (Math.abs(Fa) > 1e-9) {
    const s = Math.abs(Fa) / S.area, del = Math.abs(Fa) * L / (E * S.area);
    sigma += s; delta = Math.hypot(delta, del);
    steps.push(`Effort normal F${AX[a]} = ${n(Math.abs(Fa))} N : σ = F / A = ${n(s)} MPa ; δ = F L / (E A) = ${n(del)} mm (barre en traction-compression).`);
  }
  const kind = bend.length ? "cantilever" : "axial", depth = Math.max(S.size[0], S.size[1]);
  if (bend.length && L < 2 * depth) warnings.push(`Pièce trapue (portée ${n(L)} mm pour ${n(depth)} mm de section) : le modèle de poutre est grossier, le cisaillement compte.`);
  if (R.pressure) warnings.push("La pression est ramenée à sa résultante : la contrainte à l'appui est juste, la flèche est celle du point d'application.");
  if (load.fixed.length > 1) warnings.push("Plusieurs appuis : l'estimation ne retient que le premier (encastrement unique) ; elle majore alors contrainte et flèche.");
  const sf = material.Re ? material.Re / sigma : null;
  steps.push(`Attendu : contrainte maximale ≈ ${n(sigma)} MPa à l'appui, sur la fibre la plus éloignée ; déplacement ≈ ${n(delta)} mm au point d'application${sf ? ` ; marge Re / σ = ${n(material.Re)} / ${n(sigma)} = ${n(sf)}` : ""}.`);
  return { kind, title: kind === "cantilever" ? "Modèle équivalent : poutre encastrée chargée en bout" : "Modèle équivalent : barre en traction-compression",
    values: { sigma, delta, L, area: S.area, sf }, where: sup.centroid, at: R.at, axis: a, steps, warnings };
}

/** Thermal: the equivalent resistance of a load case. material = { k (W/m.K), name }. */
export function precheckThermal(model, load, material) {
  const none = (why) => ({ kind: "none", title: "Pas de modèle équivalent simple", steps: [why], values: {}, warnings: [] });
  const P = (load.power || []).reduce((s, x) => s + (x.P || 0), 0), k = material.k / 1000, steps = [], warnings = [];
  if (!(P > 0)) return none("Aucune puissance définie : ajoutez une source de chaleur.");
  const src = regionInfo(model, load.power[0].region);
  if (load.fixedT && load.fixedT.length) {
    const sink = regionInfo(model, load.fixedT[0].region), d = src.centroid.map((c, i) => c - sink.centroid[i]), a = dominant(d), L = Math.abs(d[a]);
    let A = 0, m = 0;
    for (const t of [0.25, 0.5, 0.75]) { const S = sectionAt(model, a, sink.centroid[a] + d[a] * t); if (S && S.area > 0) { A += S.area; m++; } }
    if (!m || !(L > 0)) return none("Chemin de conduction introuvable entre la source et la température imposée.");
    A /= m;
    const dT = P * L / (k * A), T0 = load.fixedT[0].T;
    steps.push(`Lecture du cas : ${n(P)} W entrent à ${n(L)} mm de la face tenue à ${n(T0)} °C, le long de ${AX[a]}.`);
    steps.push(`Section moyenne du chemin (lue sur le maillage) : A = ${n(A)} mm² ; conductivité k = ${n(material.k)} W/m·K.`);
    steps.push(`Résistance de conduction : R = L / (k A) = ${n(L)} / (${n(k)} × ${n(A)}) = ${n(L / (k * A))} K/W ; ΔT = P R = ${n(dT)} K (mur plan, Incropera).`);
    if (load.convection && load.convection.length) warnings.push("Une partie de la chaleur part aussi par convection : cette estimation majore la température.");
    steps.push(`Attendu : température maximale ≈ ${n(T0 + dT)} °C à la source.`);
    return { kind: "conduction", title: "Modèle équivalent : conduction 1-D vers la température imposée", values: { Tmax: T0 + dT, dT, R: L / (k * A) }, where: src.centroid, steps, warnings };
  }
  if (load.convection && load.convection.length) {
    const c = load.convection[0], hc = c.h / 1e6, ext = c.region && c.region !== "exterior" ? regionInfo(model, c.region).area : skin(model, null).faces * model.grid.h ** 2;
    const Tm = c.Tamb + P / (hc * ext), Lc = model.volume / ext, Bi = hc * Lc / k, dTin = Bi * (Tm - c.Tamb);
    steps.push(`Lecture du cas : ${n(P)} W à évacuer par convection, h = ${n(c.h)} W/m²·K, air à ${n(c.Tamb)} °C, surface d'échange A = ${n(ext)} mm².`);
    steps.push(`Température moyenne : T = T∞ + P / (h A) = ${n(c.Tamb)} + ${n(P)} / (${n(c.h)} × ${n(ext / 1e6, 4)} m²) = ${n(Tm)} °C (bilan global).`);
    steps.push(`Nombre de Biot : Bi = h Lc / k = ${n(Bi, 4)} avec Lc = V / A = ${n(Lc)} mm. ${Bi < 0.1 ? "Bi < 0,1 : la pièce est quasi isotherme, le bilan global suffit presque." : "Bi ≥ 0,1 : la température varie nettement dans la pièce, la simulation est utile."}`);
    steps.push(`Attendu : température maximale ≈ ${n(Tm + dTin)} °C (moyenne + écart interne ≈ Bi × échauffement = ${n(dTin)} K).`);
    return { kind: "convection", title: "Modèle équivalent : bilan global de convection", values: { Tmax: Tm + dTin, Tmean: Tm, biot: Bi, dT: Tm - c.Tamb }, where: src.centroid, steps, warnings };
  }
  return none("Ni température imposée ni convection : la chaleur n'a pas de sortie, la température n'est pas définie.");
}

const dev = (fea, ref) => (ref ? (fea - ref) / ref : null);
/** Simulation against hand calculation: rows { label, analytic, fea, unit, deviation } and a plain verdict. */
export function compare(kind, estimate, result) {
  const rows = [];
  if (kind === "thermal") {
    if (estimate.values.Tmax !== undefined) rows.push({ label: "Température maximale", analytic: estimate.values.Tmax, fea: result.maxT.value, unit: "°C", deviation: dev(result.maxT.value - (estimate.values.Tmax - estimate.values.dT), estimate.values.dT) });
  } else {
    if (estimate.values.delta !== undefined) rows.push({ label: "Déplacement maximal", analytic: estimate.values.delta, fea: result.maxU.value, unit: "mm", deviation: dev(result.maxU.value, estimate.values.delta) });
    if (estimate.values.sigma !== undefined) rows.push({ label: "Contrainte maximale (von Mises)", analytic: estimate.values.sigma, fea: result.maxVm.value, unit: "MPa", deviation: dev(result.maxVm.value, estimate.values.sigma) });
  }
  const worst = rows.reduce((m, r) => (r.deviation === null ? m : Math.max(m, Math.abs(r.deviation))), 0);
  const verdict = !rows.length ? "none" : worst <= 0.2 ? "ok" : worst <= 0.5 ? "warn" : "fail";
  const text = { none: "Pas de modèle simple à comparer : le résultat n'est pas recoupé.", ok: "Le calcul à la main et la simulation concordent (écart de 20 % ou moins) : le résultat est crédible.",
    warn: "Écart notable entre le calcul à la main et la simulation : regardez où la simulation concentre la contrainte, et si la pièce ressemble vraiment au modèle simple.",
    fail: "Le calcul à la main et la simulation ne concordent pas : ne retenez ni l'un ni l'autre avant d'avoir compris pourquoi (appuis, efforts, section, maillage trop grossier)." }[verdict];
  return { rows, worst, verdict, text };
}
