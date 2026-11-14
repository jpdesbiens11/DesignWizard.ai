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
  const sups = load.fixed.map((r) => regionInfo(model, r).centroid), mean = [0, 1, 2].map((i) => sups.reduce((t, c) => t + c[i], 0) / sups.length);
  const h = model.grid.h, E = material.E, steps = [], warnings = [];
  // several supports with the load between them along their longest spread: a beam on two supports
  const spread = [0, 1, 2].map((i) => Math.max(...sups.map((c) => c[i])) - Math.min(...sups.map((c) => c[i]))), sa = dominant(spread);
  const lo = Math.min(...sups.map((c) => c[sa])), hi = lo + spread[sa], between = sups.length > 1 && spread[sa] > 2 * h && R.at[sa] > lo + 0.05 * spread[sa] && R.at[sa] < hi - 0.05 * spread[sa];
  let a, L, S, where, title, kind, factorM, factorD, model1;
  if (between) {
    a = sa; L = spread[sa]; S = sectionAt(model, a, R.at[a]); where = R.at;
    const xi = (R.at[a] - lo) / L;
    // a pressure is a load spread over the span (M = F L / 8, 5 F L^3 / 384 E I); a force is a point load at xi
    factorM = R.pressure ? 1 / 8 : xi * (1 - xi); factorD = R.pressure ? 5 / 384 : xi * xi * (1 - xi) * (1 - xi) / 3; kind = "span";
    model1 = R.pressure ? "poutre sur deux appuis simples, charge répartie" : "poutre sur deux appuis simples, charge ponctuelle";
    title = "Modèle équivalent : poutre sur deux appuis, chargée entre les deux";
    steps.push(`Lecture du cas : ${sups.length} appuis écartés de ${n(L)} mm le long de ${AX[a]}, effort résultant (${R.F.map((x) => n(x)).join(" ; ")}) N appliqué entre eux, à ${n(xi * 100, 0)} % de la portée.`);
    warnings.push("Des appuis vissés tiennent entre l'appui simple et l'encastrement : le calcul donne donc une fourchette, des appuis encastrés (borne basse) aux appuis simples (borne haute).");
  } else {
    const sup = sups.length > 1 ? sups.reduce((m, c) => (Math.hypot(...c.map((x, i) => x - R.at[i])) < Math.hypot(...m.map((x, i) => x - R.at[i])) ? c : m)) : sups[0];
    const d = R.at.map((c, i) => c - sup[i]);
    a = dominant(d); L = Math.abs(d[a]); where = sup; factorM = 1; factorD = 1 / 3; model1 = "poutre encastrée";
    S = sectionAt(model, a, sup[a] + (Math.sign(d[a]) || 1) * 0.5 * h);
    steps.push(`Lecture du cas : appui en ${AX[a]} = ${n(sup[a])} mm, effort résultant (${R.F.map((x) => n(x)).join(" ; ")}) N appliqué à ${n(L)} mm de l'appui le long de ${AX[a]}.`);
    if (sups.length > 1) warnings.push("Plusieurs appuis du même côté de l'effort : l'estimation ne retient que le plus proche (encastrement unique).");
  }
  if (!S || !(S.area > 0)) return none("Section introuvable au droit de l'appui.");
  if (!(L > 0.5 * h)) return none("L'effort s'applique sur l'appui lui-même : aucun bras de levier, pas de poutre équivalente.");
  const others = [0, 1, 2].filter((i) => i !== a), [p, q] = others, Fa = R.F[a], Fp = R.F[p], Fq = R.F[q];
  // a force along p bends about the axis parallel to q (second moment Ib, fibre distance cb) ; along q : Ia, ca
  const bend = [[Fp, S.Ib, S.cb, AX[p]], [Fq, S.Ia, S.ca, AX[q]]].filter(([f]) => Math.abs(f) > 1e-9);
  steps.push(`Section réelle ${between ? "sous l'effort" : "au droit de l'appui"} (lue sur le maillage) : A = ${n(S.area)} mm², ${n(S.size[0])} × ${n(S.size[1])} mm ; I = ${n(S.Ia)} et ${n(S.Ib)} mm⁴.`);
  let sigma = 0, d2 = 0;
  for (const [f, I, c, name] of bend) {
    const M = Math.abs(f) * L * factorM, sg = M * c / I, del = Math.abs(f) * L ** 3 * factorD / (E * I);
    sigma += sg; d2 += del * del;
    steps.push(`Flexion sous F${name} = ${n(Math.abs(f))} N : M = ${n(M)} N·mm ; σ = M c / I = ${n(M)} × ${n(c)} / ${n(I)} = ${n(sg)} MPa ; δ = ${between ? (R.pressure ? "5 F L³ / (384 E I)" : "F L³ ξ²(1−ξ)² / (3 E I)") : "F L³ / (3 E I)"} = ${n(del)} mm (${model1}, Roark).`);
  }
  let delta = Math.sqrt(d2);
  if (Math.abs(Fa) > 1e-9 && !between) {
    const sg = Math.abs(Fa) / S.area, del = Math.abs(Fa) * L / (E * S.area);
    sigma += sg; delta = Math.hypot(delta, del);
    steps.push(`Effort normal F${AX[a]} = ${n(Math.abs(Fa))} N : σ = F / A = ${n(sg)} MPa ; δ = F L / (E A) = ${n(del)} mm (barre en traction-compression).`);
  }
  if (!bend.length && between) return none("Effort dans l'axe des appuis : pas de modèle simple pour ce cas.");
  kind = kind || (bend.length ? "cantilever" : "axial");
  const depth = !bend.length ? Math.max(S.size[0], S.size[1]) : Math.abs(Fp) >= Math.abs(Fq) ? S.size[0] : S.size[1];   // the section size in the direction of the bending force
  if (bend.length && L < 2 * depth) warnings.push(`Pièce trapue (portée ${n(L)} mm pour ${n(depth)} mm de section) : le modèle de poutre est grossier, le cisaillement compte.`);
  if (R.pressure && !between) warnings.push("La pression est ramenée à sa résultante : la contrainte à l'appui est juste, la flèche est celle du point d'application.");
  const sf = material.Re ? material.Re / sigma : null;
  // clamped ends instead of simple supports: the moment drops to 2/3 (spread load) or 1/2 (point load), the deflection to 1/5 or 1/4
  const low = between ? { sigma: sigma * (R.pressure ? 2 / 3 : 1 / 2), delta: delta * (R.pressure ? 1 / 5 : 1 / 4) } : null;
  if (low) steps.push(`Avec des appuis encastrés, la contrainte tombe à ${n(low.sigma)} MPa et la flèche à ${n(low.delta)} mm : la réalité est entre les deux.`);
  steps.push(`Attendu : contrainte maximale ≈ ${n(sigma)} MPa ${between ? "sous l'effort" : "à l'appui"}, sur la fibre la plus éloignée ; déplacement ≈ ${n(delta)} mm au point d'application${sf ? ` ; marge Re / σ = ${n(material.Re)} / ${n(sigma)} = ${n(sf)}` : ""}.`);
  return { kind, title: title || (kind === "cantilever" ? "Modèle équivalent : poutre encastrée chargée en bout" : "Modèle équivalent : barre en traction-compression"),
    values: { sigma, delta, L, area: S.area, sf, ...(low ? { sigmaLow: low.sigma, deltaLow: low.delta } : {}) }, where, at: R.at, axis: a, steps, warnings };
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

/** Thermo-mechanical: what a temperature does to a held part — how far it wants to grow, and the stress if it cannot.
    load = { fixed: [regions], thermal: { uniform: T } | { case: thermal load case }, Tref }. material = { E, nu, alpha (1/K), Re, k }. */
export function precheckThermo(model, load, material) {
  const none = (why) => ({ kind: "none", title: "Pas de modèle équivalent simple", steps: [why], values: {}, warnings: [] });
  if (!load.fixed || !load.fixed.length) return none("Aucun appui défini : ajoutez au moins un encastrement.");
  const E = material.E, a = material.alpha || 0, Tref = load.Tref ?? 20, steps = [], warnings = [];
  if (!(a > 0)) return none("Coefficient de dilatation inconnu pour ce matériau : pas d'estimation possible.");
  let dTmean, dTmax, dTint;
  if (load.thermal && typeof load.thermal.uniform === "number") {
    dTmean = dTmax = load.thermal.uniform - Tref; dTint = 0;
    steps.push(`Lecture du cas : pièce portée uniformément à ${n(load.thermal.uniform)} °C, montée sans contrainte à ${n(Tref)} °C : ΔT = ${n(dTmean)} K.`);
  } else {
    const th = precheckThermal(model, (load.thermal && load.thermal.case) || {}, material);
    if (th.kind === "none") return none(th.steps[0]);
    const Tmax = th.values.Tmax, Tmean = th.kind === "conduction" ? Tmax - th.values.dT / 2 : th.values.Tmean;
    dTmax = Tmax - Tref; dTmean = Tmean - Tref; dTint = th.kind === "conduction" ? th.values.dT : Math.max(0, Tmax - Tmean);
    steps.push(`Températures attendues (${th.kind === "conduction" ? "conduction 1-D" : "bilan de convection"}) : moyenne ≈ ${n(Tmean)} °C, maximale ≈ ${n(Tmax)} °C, pour un montage sans contrainte à ${n(Tref)} °C : ΔT moyen = ${n(dTmean)} K, écart interne ≈ ${n(dTint)} K.`);
  }
  const sups = load.fixed.map((r) => regionInfo(model, r.region || r).centroid), h = model.grid.h, b = model.bbox;
  const spread = [0, 1, 2].map((i) => Math.max(...sups.map((c) => c[i])) - Math.min(...sups.map((c) => c[i]))), sa = dominant(spread), restrained = sups.length > 1 && spread[sa] > 2 * h;
  const c0 = sups[0], far = Math.hypot(...[0, 1, 2].map((i) => Math.max(Math.abs(b[i] - c0[i]), Math.abs(b[3 + i] - c0[i])))), delta = a * Math.abs(dTmean) * far;
  const bound = E * a * Math.abs(dTmax), grad = E * a * Math.abs(dTint) / (2 * (1 - (material.nu || 0.3)));
  steps.push(`Dilatation libre : δ = α ΔT L = ${n(a * 1e6, 1)} × 10⁻⁶ × ${n(Math.abs(dTmean))} × ${n(far)} = ${n(delta)} mm au point le plus éloigné de l'appui.`);
  steps.push(`Si cette dilatation est totalement empêchée : σ = E α ΔT = ${n(E)} × ${n(a * 1e6, 1)} × 10⁻⁶ × ${n(Math.abs(dTmax))} = ${n(bound)} MPa. C'est la borne haute : aucune contrainte d'origine thermique ne la dépasse loin des appuis.`);
  if (dTint > 0) steps.push(`Contrainte due au seul écart de température dans la pièce : σ ≈ E α ΔT / (2 (1 − ν)) = ${n(grad)} MPa (gradient linéaire bridé, ordre de grandeur).`);
  const alphas = [...new Set((model.bodies || []).map((x) => x.material && x.material.alpha).filter((x) => x > 0))];
  let mismatch = null;
  if (alphas.length > 1) { mismatch = E * (Math.max(...alphas) - Math.min(...alphas)) * Math.abs(dTmean) / 2; steps.push(`Matériaux différents collés : σ ≈ E Δα ΔT / 2 = ${n(mismatch)} MPa à leur jonction (bilame de Timoshenko, couches égales).`); }
  if (restrained) {
    steps.push(`Lecture des appuis : ${sups.length} appuis écartés de ${n(spread[sa])} mm le long de ${AX[sa]} — la pièce est bridée entre eux. Attendu : contrainte entre ${n(Math.max(grad, mismatch || 0))} et ${n(bound)} MPa selon la raideur des appuis ; déplacement inférieur à ${n(delta)} mm.`);
    warnings.push("Des appuis vissés ne sont pas infiniment raides et la pièce peut fléchir : le taux de bridage réel se lit sur la simulation (contrainte nominale / borne haute).");
  } else steps.push(`Lecture des appuis : un seul appui — la pièce se dilate presque librement. Attendu : déplacement ≈ ${n(delta)} mm, contrainte faible loin de l'appui${dTint > 0 ? ` (≈ ${n(grad)} MPa)` : ""}, forte seulement contre l'appui qui l'empêche de s'élargir.`);
  const sf = material.Re ? material.Re / bound : null;
  if (sf !== null && sf < 1) warnings.push(`Totalement bridée, la pièce dépasserait sa limite élastique (marge ${n(sf)}) : laissez-la se dilater (trou oblong, appui glissant) ou réduisez l'écart de température.`);
  return { kind: restrained ? "restrained" : "free", title: restrained ? "Modèle équivalent : dilatation bridée entre appuis" : "Modèle équivalent : dilatation libre depuis un appui",
    values: { delta, sigma: bound, sigmaGrad: grad, mismatch, dTmean, dTmax, restrained, sf }, where: c0, steps, warnings };
}

const dev = (fea, ref) => (ref ? (fea - ref) / ref : null);
/** Deviation from an upper bound: zero below it, the relative excess above. */
const devBound = (fea, bound) => (bound ? Math.max(0, fea / bound - 1) : null);
/** Deviation from a bracket [low, high]: zero inside it, relative to the nearer bound outside. */
const devRange = (fea, low, high) => (fea >= low && fea <= high ? 0 : fea < low ? dev(fea, low) : dev(fea, high));
/** Simulation against hand calculation: rows { label, analytic, fea, unit, deviation } and a plain verdict. */
export function compare(kind, estimate, result) {
  const rows = [];
  if (kind === "thermo") {
    const v = estimate.values, nominal = result.nominalVm ? result.nominalVm.value : result.maxVm.value;
    if (v.delta !== undefined) rows.push({ label: "Déplacement maximal", analytic: v.delta, bound: v.restrained, fea: result.maxU.value, unit: "mm", deviation: v.restrained ? devBound(result.maxU.value, v.delta) : dev(result.maxU.value, v.delta) });
    if (v.sigma !== undefined) rows.push({ label: "Contrainte nominale, hors appuis (von Mises)", analytic: v.sigma, bound: true, fea: nominal, unit: "MPa", deviation: devBound(nominal, v.sigma), note: v.sigma ? `bridage ${Math.round(100 * nominal / v.sigma)} %` : "" });
  } else if (kind === "thermal") {
    if (estimate.values.Tmax !== undefined) rows.push({ label: "Température maximale", analytic: estimate.values.Tmax, fea: result.maxT.value, unit: "°C", deviation: dev(result.maxT.value - (estimate.values.Tmax - estimate.values.dT), estimate.values.dT) });
  } else {
    const v = estimate.values, range = v.deltaLow !== undefined;
    if (v.delta !== undefined) rows.push({ label: "Déplacement maximal", analytic: v.delta, low: range ? v.deltaLow : undefined, fea: result.maxU.value, unit: "mm", deviation: range ? devRange(result.maxU.value, v.deltaLow, v.delta) : dev(result.maxU.value, v.delta) });
    const nominal = result.nominalVm ? result.nominalVm.value : result.maxVm.value;      // a hand calculation predicts the nominal stress, not the peak under a support
    if (v.sigma !== undefined) rows.push({ label: result.nominalVm ? "Contrainte nominale, hors appuis (von Mises)" : "Contrainte maximale (von Mises)", analytic: v.sigma, low: range ? v.sigmaLow : undefined, fea: nominal, unit: "MPa", deviation: range ? devRange(nominal, v.sigmaLow, v.sigma) : dev(nominal, v.sigma) });
  }
  const worst = rows.reduce((m, r) => (r.deviation === null ? m : Math.max(m, Math.abs(r.deviation))), 0);
  const verdict = !rows.length ? "none" : worst <= 0.2 ? "ok" : worst <= 0.5 ? "warn" : "fail";
  const text = { none: "Pas de modèle simple à comparer : le résultat n'est pas recoupé.", ok: "Le calcul à la main et la simulation concordent (écart de 20 % ou moins) : le résultat est crédible.",
    warn: "Écart notable entre le calcul à la main et la simulation : regardez où la simulation concentre la contrainte, et si la pièce ressemble vraiment au modèle simple.",
    fail: "Le calcul à la main et la simulation ne concordent pas : ne retenez ni l'un ni l'autre avant d'avoir compris pourquoi (appuis, efforts, section, maillage trop grossier)." }[verdict];
  return { rows, worst, verdict, text };
}
